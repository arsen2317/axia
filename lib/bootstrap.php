<?php
/* Общая часть серверного кода: настройки, ответы JSON, файлы данных, IP клиента. */
declare(strict_types=1);

define('ROOT', dirname(__DIR__));

/* Ошибки PHP не показываем посетителям (там пути и детали сервера) — только в журнал */
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

function cfg(?string $path = null, $default = null)
{
    static $c = null;
    if ($c === null) {
        $base = require ROOT . '/config/config.example.php';
        $local = is_file(ROOT . '/config/config.local.php') ? require ROOT . '/config/config.local.php' : [];
        $c = array_replace_recursive($base, is_array($local) ? $local : []);
        /* рабочие часы и праздники заменяются целиком, а не сливаются по ключам */
        if (isset($local['booking']['hours'])) $c['booking']['hours'] = $local['booking']['hours'];
        if (isset($local['booking']['holidays'])) $c['booking']['holidays'] = $local['booking']['holidays'];
    }
    if ($path === null) return $c;
    $v = $c;
    foreach (explode('.', $path) as $k) {
        if (!is_array($v) || !array_key_exists($k, $v)) return $default;
        $v = $v[$k];
    }
    return $v;
}

/* Папка данных. Надёжнее всего вынести её за пределы корня сайта ('data_dir' в config.local.php):
   на виртуальных хостингах статические файлы часто отдаёт nginx в обход .htaccess */
define('DATA', rtrim((string)(cfg('data_dir', '') ?: ROOT . '/data'), '/'));

date_default_timezone_set((string)cfg('timezone', 'Europe/Moscow'));

set_exception_handler(function (Throwable $e) {
    log_error('uncaught: ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['ok' => false, 'error' => 'Ошибка сервера. Попробуйте позже.'], JSON_UNESCAPED_UNICODE);
});

function secret(): string
{
    $s = (string)cfg('secret', '');
    if ($s !== '') return $s;
    /* секрет не задан — генерируем один раз и храним в data/ (в .php-файле: даже если папка доступна снаружи,
       сервер выполнит его, а не отдаст содержимое) */
    $f = DATA . '/secret.php';
    $v = read_json($f, null);
    if (!is_string($v) || strlen($v) < 32) {
        $v = bin2hex(random_bytes(32));
        write_json($f, $v);
        @chmod($f, 0600);
    }
    return $v;
}

function ensure_dir(string $dir): void
{
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
}

/* ---- Файлы данных ----
   Данные лежат в .php-файлах, первая строка которых — <?php exit; ?>. Если веб-сервер по ошибке отдаст такой файл
   по прямой ссылке, PHP его выполнит и вернёт пустую страницу, а не содержимое. */

const DATA_GUARD = "<?php exit; ?>\n";

function read_json(string $file, $default = [])
{
    if (!is_file($file)) return $default;
    $raw = (string)file_get_contents($file);
    if (str_starts_with($raw, DATA_GUARD)) $raw = substr($raw, strlen(DATA_GUARD));
    $v = json_decode($raw, true);
    return $v === null ? $default : $v;
}

function write_json(string $file, $data): void
{
    ensure_dir(dirname($file));
    $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
    $body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    file_put_contents($tmp, (str_ends_with($file, '.php') ? DATA_GUARD : '') . $body, LOCK_EX);
    rename($tmp, $file);
}

/* Выполнить $fn под эксклюзивной блокировкой (например, чтобы два человека не заняли один слот) */
function with_lock(string $name, callable $fn)
{
    ensure_dir(DATA . '/locks');
    $h = fopen(DATA . '/locks/' . preg_replace('/[^a-z0-9_-]/i', '_', $name) . '.lock', 'c');
    flock($h, LOCK_EX);
    try {
        return $fn();
    } finally {
        flock($h, LOCK_UN);
        fclose($h);
    }
}

/* ---- Настройки, которые меняются из админки ---- */

function settings(): array
{
    return read_json(DATA . '/settings.php', []) + ['booking_enabled' => true];
}

function save_settings(array $s): void
{
    write_json(DATA . '/settings.php', $s + settings());
}

/* ---- HTTP ---- */

function client_ip(): string
{
    /* По умолчанию — адрес соединения. Если хостинг ставит перед PHP свой прокси и у всех посетителей адрес
       127.0.0.1 (видно в админке), включите 'trust_proxy'. Тогда заголовкам верим, только если запрос пришёл
       с локального адреса. X-Real-IP прокси выставляет сам; в X-Forwarded-For клиент может дописать что угодно
       В НАЧАЛО, поэтому берём ПОСЛЕДНИЙ адрес — его добавил наш прокси */
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $local = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    if ($local && cfg('trust_proxy', false)) {
        $real = trim((string)($_SERVER['HTTP_X_REAL_IP'] ?? ''));
        if (filter_var($real, FILTER_VALIDATE_IP)) return $real;
        $xff = array_map('trim', explode(',', (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')));
        $last = end($xff);
        if ($last !== false && filter_var($last, FILTER_VALIDATE_IP)) return $last;
    }
    return $ip;
}

/* Ключ для лимитов: для IPv6 — сеть /64 (у одного абонента их миллионы адресов, иначе лимиты легко обойти) */
function rl_ip(): string
{
    $ip = client_ip();
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        $bin = inet_pton($ip);
        return $bin === false ? $ip : bin2hex(substr($bin, 0, 8)) . '::/64';
    }
    return $ip;
}

/* Заголовки безопасности для страниц, которые отдаёт PHP */
function security_headers(bool $isAdmin = false): void
{
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
    header('X-Frame-Options: ' . ($isAdmin ? 'DENY' : 'SAMEORIGIN'));
    header("Content-Security-Policy: default-src 'self'; script-src 'self' https://smartcaptcha.yandexcloud.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://smartcaptcha.yandexcloud.net; font-src 'self'; connect-src 'self' https://smartcaptcha.yandexcloud.net; frame-src https://smartcaptcha.yandexcloud.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors " . ($isAdmin ? "'none'" : "'self'"));
    if (is_https()) header('Strict-Transport-Security: max-age=31536000');
    if ($isAdmin) header('Cache-Control: no-store');
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $code = 400, array $extra = []): void
{
    json_out(['ok' => false, 'error' => $message] + $extra, $code);
}

function require_method(string $m): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $m) fail('Метод не поддерживается', 405);
}

/* Тело запроса JSON (формы шлют fetch с JSON). Запросы с чужих сайтов отклоняем по заголовку Origin */
function json_body(int $maxBytes = 20000): array
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $host = $_SERVER['HTTP_HOST'] ?? '';
        if (parse_url($origin, PHP_URL_HOST) !== parse_url('//' . $host, PHP_URL_HOST)) fail('Запрос с другого сайта', 403);
    }
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) fail('Слишком большой запрос', 413);
    $d = json_decode($raw, true);
    if (!is_array($d)) fail('Неверный формат запроса');
    return $d;
}

/* $multiline = false — однострочное поле: переводы строк тоже убираем (защита заголовков писем и .ics) */
function str_field(array $d, string $k, int $max, bool $required = false, bool $multiline = false): string
{
    $v = isset($d[$k]) && is_scalar($d[$k]) ? trim((string)$d[$k]) : '';
    if (!mb_check_encoding($v, 'UTF-8')) fail('Неверная кодировка', 422);
    $v = preg_replace($multiline ? '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u' : '/[\x00-\x1F\x7F\x{2028}\x{2029}]/u', $multiline ? '' : ' ', $v) ?? '';
    $v = trim($v);
    if ($required && $v === '') fail('Заполните обязательные поля', 422, ['field' => $k]);
    if (mb_strlen($v) > $max) fail('Слишком длинное значение', 422, ['field' => $k]);
    return $v;
}

function h(?string $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function site_url(string $path = ''): string
{
    $base = rtrim((string)cfg('site_url', ''), '/');
    if ($base === '') {
        /* адрес сайта не задан: берём из запроса, но только безопасные символы (заголовок Host присылает клиент) */
        $host = preg_replace('/[^a-z0-9.\-:]/i', '', (string)($_SERVER['HTTP_HOST'] ?? 'localhost'));
        $base = (is_https() ? 'https://' : 'http://') . $host;
    }
    return $base . $path;
}

/* Хэш контакта/IP: в файлах храним не сами email и телефоны, а их подписанные хэши (минимизация персональных данных) */
function pd_hash(string $v): string
{
    return hash_hmac('sha256', $v, secret());
}

function log_error(string $msg): void
{
    ensure_dir(DATA . '/logs');
    $f = DATA . '/logs/error-' . date('Y-m') . '.php';
    if (!is_file($f)) {
        @file_put_contents($f, DATA_GUARD, LOCK_EX);
        /* журналы старше полугода удаляем */
        foreach (glob(DATA . '/logs/error-*.php') ?: [] as $old) if (filemtime($old) < time() - 183 * 86400) @unlink($old);
    }
    /* в журнал — без переводов строк и не больше 1000 символов на запись */
    @file_put_contents($f, date('c') . ' ' . mb_substr(str_replace(["\r", "\n"], ' ', $msg), 0, 1000) . "\n", FILE_APPEND | LOCK_EX);
}
