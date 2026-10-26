<?php
/* Общая часть серверного кода: настройки, ответы JSON, файлы данных, IP клиента. */
declare(strict_types=1);

define('ROOT', dirname(__DIR__));
define('DATA', ROOT . '/data');

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

date_default_timezone_set((string)cfg('timezone', 'Europe/Moscow'));

function secret(): string
{
    $s = (string)cfg('secret', '');
    if ($s !== '') return $s;
    /* секрет не задан — генерируем один раз и храним в data/ */
    $f = DATA . '/.secret';
    if (!is_file($f)) {
        ensure_dir(DATA);
        file_put_contents($f, bin2hex(random_bytes(32)), LOCK_EX);
        @chmod($f, 0600);
    }
    return trim((string)file_get_contents($f));
}

function ensure_dir(string $dir): void
{
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
}

/* ---- JSON-файлы с блокировкой ---- */

function read_json(string $file, $default = [])
{
    if (!is_file($file)) return $default;
    $raw = file_get_contents($file);
    $v = json_decode((string)$raw, true);
    return $v === null ? $default : $v;
}

function write_json(string $file, $data): void
{
    ensure_dir(dirname($file));
    $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
    file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
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
    return read_json(DATA . '/settings.json', []) + ['booking_enabled' => true];
}

function save_settings(array $s): void
{
    write_json(DATA . '/settings.json', $s + settings());
}

/* ---- HTTP ---- */

function client_ip(): string
{
    /* за прокси хостинга (nginx перед Apache) настоящий адрес приходит в X-Real-IP / X-Forwarded-For.
       Берём его, только если запрос пришёл с локального адреса, иначе заголовок мог подделать сам клиент */
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $local = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    if ($local) {
        foreach (['HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR'] as $h) {
            if (!empty($_SERVER[$h])) {
                $cand = trim(explode(',', (string)$_SERVER[$h])[0]);
                if (filter_var($cand, FILTER_VALIDATE_IP)) return $cand;
            }
        }
    }
    return $ip;
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

function str_field(array $d, string $k, int $max, bool $required = false): string
{
    $v = isset($d[$k]) && is_scalar($d[$k]) ? trim((string)$d[$k]) : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
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
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        $base = ($https ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost');
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
    @file_put_contents(DATA . '/logs/error-' . date('Y-m') . '.log', date('c') . ' ' . $msg . "\n", FILE_APPEND | LOCK_EX);
}
