<?php
/* Вход в админку через Яндекс ID (OAuth 2.0, код подтверждения).
   /admin/oauth.php?start — уходим на oauth.yandex.ru; Яндекс возвращает сюда ?code=…&state=…
   Сайт меняет код на токен (с секретом приложения, сервер к серверу), узнаёт подтверждённую почту аккаунта
   (login.yandex.ru/info) и пускает, только если она есть в списке доступа. Пароль сотрудника сайт не видит, токен не хранит.
   state — в отдельной cookie с SameSite=Lax: cookie сессии админки (SameSite=Strict) при возврате с Яндекса не приходит. */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/admin.php';

admin_session();   /* здесь же — ограничение по IP (admin.allowed_ips) */
$cookie = is_https() ? '__Host-axia_oauth' : 'axia_oauth';
$redirect = site_url('/admin/oauth.php');

function oauth_fail(string $msg): void
{
    admin_head('Вход');
    echo '<main class="ad-login"><div class="ad-card ad-login__form"><p class="ad-logo">аксиа · админка</p>'
        . '<p class="ad-note ad-note--err" role="alert">' . h($msg) . '</p><a class="ad-btn" href="/admin/">Назад ко входу</a></div></main></body></html>';
    exit;
}

function oauth_http(string $url, ?array $post, array $headers = []): ?array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_HTTPHEADER => $headers]);
    if ($post !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post)); }
    $res = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $d = is_string($res) ? json_decode($res, true) : null;
    if ($code !== 200 || !is_array($d)) { log_error('yandex oauth: ' . parse_url($url, PHP_URL_HOST) . ' HTTP ' . $code); return null; }
    return $d;
}

if (!yandex_configured()) oauth_fail('Вход через Яндекс ещё не настроен: нет yandex_id в настройках сайта. Войдите по паролю.');

/* 1. начало: state в cookie и переход на Яндекс */
if (isset($_GET['start'])) {
    $state = bin2hex(random_bytes(16));
    setcookie($cookie, $state, ['expires' => time() + 600, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Lax']);
    header('Location: https://oauth.yandex.ru/authorize?' . http_build_query([
        'response_type' => 'code',
        'client_id' => yandex_cfg('client_id'),
        'redirect_uri' => $redirect,
        'state' => $state,
        'force_confirm' => 'yes',   /* всегда показывать, каким аккаунтом входим — удобно, если в браузере их несколько */
    ]));
    exit;
}

/* 2. возврат с Яндекса */
if (!rate_ok('admin:oauth:' . rl_ip(), 20, 900)) oauth_fail('Слишком много попыток. Подождите 15 минут.');
$state = (string)($_GET['state'] ?? '');
$saved = (string)($_COOKIE[$cookie] ?? '');
setcookie($cookie, '', ['expires' => time() - 3600, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Lax']);
if (isset($_GET['error'])) oauth_fail('Вход отменён на стороне Яндекса.');
if ($state === '' || $saved === '' || !hash_equals($saved, $state)) oauth_fail('Ссылка входа устарела. Начните вход заново.');
$code = (string)($_GET['code'] ?? '');
if (!preg_match('/^[A-Za-z0-9_-]{4,64}$/', $code)) oauth_fail('Яндекс не вернул код входа. Попробуйте ещё раз.');

$tok = oauth_http('https://oauth.yandex.ru/token', [
    'grant_type' => 'authorization_code',
    'code' => $code,
    'client_id' => yandex_cfg('client_id'),
    'client_secret' => yandex_cfg('client_secret'),
]);
if (!$tok || !is_string($tok['access_token'] ?? null)) oauth_fail('Не удалось подтвердить вход у Яндекса. Попробуйте ещё раз.');
$info = oauth_http('https://login.yandex.ru/info?format=json', null, ['Authorization: OAuth ' . $tok['access_token']]);
$email = mb_strtolower(trim((string)($info['default_email'] ?? '')));
if ($email === '') oauth_fail('Яндекс не передал адрес почты. В настройках приложения на oauth.yandex.ru нужен доступ «Доступ к адресу электронной почты».');
if (!admin_allowed($email)) oauth_fail('У адреса ' . $email . ' нет доступа к админке. Попросите добавить его владельца hello@axiagroup.ru.');

admin_begin('yandex', $email);
admin_touch_login($email);
/* переходим в админку со своей страницы: после перехода с чужого сайта браузер не прислал бы cookie сессии (SameSite=Strict) */
header('Content-Type: text/html; charset=utf-8');
echo '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/admin/"><title>Вход…</title><a href="/admin/">Перейти в админку</a>';
