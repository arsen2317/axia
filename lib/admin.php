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
    session_start();
    header('X-Robots-Tag: noindex, nofollow');
    security_headers(true);
}

function admin_configured(): bool
{
    return (string)cfg('admin.password_hash') !== '';
}

function admin_logged_in(): bool
{
    admin_session();
    if (empty($_SESSION['admin'])) return false;
    /* сессия живёт 12 часов с момента входа */
    if (($_SESSION['at'] ?? 0) < time() - 43200) { admin_logout(); return false; }
    return true;
}

/** null — вошли, строка — ошибка */
function admin_login(string $login, string $password): ?string
{
    admin_session();
    $ip = rl_ip();
    if (!rate_ok('admin:login:' . $ip, 5, 900, false) || !rate_ok('admin:login:all', 100, 900, false)) return 'Слишком много попыток. Подождите 15 минут.';
    /* пароль проверяем всегда, даже при неверном логине — чтобы по времени ответа нельзя было угадать логин */
    $hash = admin_configured() ? (string)cfg('admin.password_hash') : password_hash(random_bytes(8), PASSWORD_DEFAULT);
    $passOk = password_verify(mb_substr($password, 0, 200), $hash);
    $ok = admin_configured() && hash_equals((string)cfg('admin.login'), $login) && $passOk;
    if (!$ok) {
        rate_ok('admin:login:' . $ip, PHP_INT_MAX, 900);
        rate_ok('admin:login:all', PHP_INT_MAX, 900);
        usleep(random_int(300000, 700000));
        return 'Неверный логин или пароль';
    }
    session_regenerate_id(true);
    if (password_needs_rehash($hash, PASSWORD_DEFAULT)) log_error('admin: хэш пароля устарел, сгенерируйте новый');
    $_SESSION['admin'] = true;
    $_SESSION['at'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
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
        . '<link rel="stylesheet" href="/assets/css/fonts.css"><link rel="stylesheet" href="/admin/admin.css"></head><body>';
}
