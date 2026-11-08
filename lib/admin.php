<?php
/* Вход в админку: сессия PHP, защита от перебора пароля, CSRF-токен. */
declare(strict_types=1);
defined('ROOT') || exit;

require_once ROOT . '/lib/guard.php';

function admin_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    /* доступ к админке можно ограничить списком IP (admin.allowed_ips) */
    $allowed = (array)cfg('admin.allowed_ips', []);
    if ($allowed && !in_array(client_ip(), $allowed, true)) {
        http_response_code(404);
        exit;
    }
    session_name(is_https() ? '__Host-axia_admin' : 'axia_admin');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict']);
    ini_set('session.use_only_cookies', '1');
    ensure_dir(DATA . '/sessions');
    session_save_path(DATA . '/sessions');
    ini_set('session.gc_maxlifetime', '43200');
    ini_set('session.use_strict_mode', '1');
    /* сессии лежат в своей папке, системная очистка её не видит — включаем сборку мусора PHP */
    ini_set('session.gc_probability', '1');
    ini_set('session.gc_divisor', '100');
    session_start();
    header('X-Robots-Tag: noindex, nofollow');
    security_headers(true);
}

/* ---- Кто может входить ----
   Основной способ — «Войти с Яндексом» (admin/oauth.php): входят рабочие аккаунты Яндекса из списка доступа.
   Главный адрес (admin.owner, по умолчанию hello@axiagroup.ru) из списка не удаляется, и только он меняет список
   и запасной пароль. Запасной пароль — вход по ссылке «войти по паролю»; задаётся в админке (хэш в data/settings.php),
   пока не задан — действует admin.password_hash из config. Сменить его можно, только войдя через Яндекс.
   Сессия: не дольше 12 часов и выход после 1 часа без действий. */

const ADMIN_IDLE = 3600;
const ADMIN_MAX = 43200;

function admin_owner(): string
{
    return mb_strtolower(trim((string)cfg('admin.owner', 'hello@axiagroup.ru')));
}

/** ClientID и секрет приложения Яндекс ID; пробелы и переносы по краям (частая ошибка при вставке) отбрасываем */
function yandex_cfg(string $key): string
{
    return trim((string)cfg('yandex_id.' . $key, ''));
}

function yandex_configured(): bool
{
    return yandex_cfg('client_id') !== '' && yandex_cfg('client_secret') !== '';
}

function admin_password_hash(): string
{
    $s = (string)(settings()['admin_password_hash'] ?? '');
    return $s !== '' ? $s : (string)cfg('admin.password_hash', '');
}

function admin_pw_version(): int
{
    return (int)(settings()['admin_pw_v'] ?? 0);
}

function admin_configured(): bool
{
    return admin_password_hash() !== '' || yandex_configured();
}

/** Список доступа: ['list' => [почты], 'last' => [почта => время последнего входа]] */
function admin_access(): array
{
    $d = read_json(DATA . '/admins.php', null);
    if (!is_array($d) || !isset($d['list']) || !is_array($d['list'])) {
        $d = ['list' => [admin_owner(), 'klopatkina@axiagroup.ru', 'akosko@axiagroup.ru', 'dstasova@axiagroup.ru'], 'last' => []];
    }
    $list = array_values(array_unique(array_map(fn($e) => mb_strtolower(trim((string)$e)), $d['list'])));
    if (!in_array(admin_owner(), $list, true)) array_unshift($list, admin_owner());
    return ['list' => $list, 'last' => (array)($d['last'] ?? [])];
}

function admin_allowed(string $email): bool
{
    return $email !== '' && in_array(mb_strtolower($email), admin_access()['list'], true);
}

/** Сохранить список (только главный адрес): [список, null] или [null, ошибка] */
function admin_access_save(array $emails): array
{
    $list = [];
    foreach ($emails as $e) {
        $e = mb_strtolower(trim((string)$e));
        if ($e === '') continue;
        if (!filter_var($e, FILTER_VALIDATE_EMAIL)) return [null, 'Проверьте адрес: ' . $e];
        $list[$e] = true;
    }
    $list = array_keys($list);
    if (!in_array(admin_owner(), $list, true)) array_unshift($list, admin_owner());
    if (count($list) > 30) return [null, 'Не больше 30 адресов'];
    with_lock('admins', function () use ($list) {
        $d = admin_access();
        write_json(DATA . '/admins.php', ['list' => $list, 'last' => array_intersect_key($d['last'], array_flip($list))]);
    });
    return [$list, null];
}

function admin_touch_login(string $email): void
{
    with_lock('admins', function () use ($email) {
        $d = admin_access();
        $d['last'][mb_strtolower($email)] = date('c');
        write_json(DATA . '/admins.php', $d);
    });
}

/** Начать сессию после успешной проверки. $via: yandex | password */
function admin_begin(string $via, string $email = ''): void
{
    admin_session();
    session_regenerate_id(true);
    $_SESSION = [
        'admin' => true,
        'via' => $via,
        'email' => mb_strtolower($email),
        'at' => time(),
        'last' => time(),
        'pwv' => admin_pw_version(),
        'csrf' => bin2hex(random_bytes(16)),
    ];
}

/** Кто вошёл: ['via' => …, 'email' => …, 'owner' => bool] или null */
function admin_who(): ?array
{
    if (!admin_logged_in()) return null;
    $email = (string)($_SESSION['email'] ?? '');
    return ['via' => (string)$_SESSION['via'], 'email' => $email, 'owner' => $_SESSION['via'] === 'yandex' && $email === admin_owner()];
}

function admin_logged_in(): bool
{
    admin_session();
    if (empty($_SESSION['admin'])) return false;
    $now = time();
    $ok = ($_SESSION['at'] ?? 0) >= $now - ADMIN_MAX && ($_SESSION['last'] ?? 0) >= $now - ADMIN_IDLE;
    $via = (string)($_SESSION['via'] ?? '');
    if ($via === 'yandex') $ok = $ok && admin_allowed((string)($_SESSION['email'] ?? ''));       /* убрали из списка — выход */
    elseif ($via === 'password') $ok = $ok && (int)($_SESSION['pwv'] ?? -1) === admin_pw_version();   /* сменили пароль — выход */
    else $ok = false;
    if (!$ok) { admin_logout(); return false; }
    $_SESSION['last'] = $now;
    return true;
}

/** Вход по запасному паролю. null — вошли, строка — ошибка */
function admin_login(string $login, string $password): ?string
{
    admin_session();
    $ip = rl_ip();
    /* попытку записываем сразу, под блокировкой: параллельные запросы не могут проверить больше 5 паролей */
    if (!rate_ok('admin:login:' . $ip, 5, 900) || !rate_ok('admin:login:all', 100, 900)) return 'Слишком много попыток. Подождите 15 минут.';
    /* пароль проверяем всегда, даже при неверном логине — чтобы по времени ответа нельзя было угадать логин */
    $stored = admin_password_hash();
    $hash = $stored !== '' ? $stored : password_hash(random_bytes(8), PASSWORD_DEFAULT);
    $passOk = password_verify(mb_substr($password, 0, 200), $hash);
    $ok = $stored !== '' && hash_equals((string)cfg('admin.login'), $login) && $passOk;
    if (!$ok) {
        usleep(random_int(300000, 700000));
        return 'Неверный логин или пароль';
    }
    admin_begin('password');
    return null;
}

/** Новый запасной пароль (только главный адрес, вошедший через Яндекс). null — сохранено, строка — ошибка */
function admin_set_password(string $pass): ?string
{
    if (mb_strlen($pass) < 12) return 'Пароль — не короче 12 символов';
    if (mb_strlen($pass) > 200) return 'Слишком длинный пароль';
    save_settings(['admin_password_hash' => password_hash($pass, PASSWORD_DEFAULT), 'admin_pw_v' => admin_pw_version() + 1]);
    return null;
}

function admin_logout(): void
{
    admin_session();
    $_SESSION = [];
    session_destroy();
}

function admin_require(): void
{
    if (!admin_logged_in()) {
        header('Location: /admin/');
        exit;
    }
}

function csrf_token(): string
{
    admin_session();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}

function csrf_check(): void
{
    $t = $_SERVER['HTTP_X_CSRF'] ?? ($_POST['csrf'] ?? '');
    if (!is_string($t) || !hash_equals(csrf_token(), $t)) fail('Сессия устарела, обновите страницу', 403);
}

function admin_head(string $title): void
{
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex, nofollow"><title>' . h($title) . ' — админка аксиа</title>'
        . '<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" href="/favicon.svg" type="image/svg+xml">'
        . '<link rel="stylesheet" href="' . h(asset('/assets/css/fonts.css')) . '"><link rel="stylesheet" href="' . h(asset('/admin/admin.css')) . '"></head><body>';
}
