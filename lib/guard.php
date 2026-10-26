<?php
/* Защита форм: ограничение частоты запросов, капча Яндекс SmartCaptcha, ловушка для ботов. */
declare(strict_types=1);

/* Скользящее окно: не больше $limit событий за $windowSec по ключу. true — можно, false — лимит исчерпан.
   $consume = false — только проверить, не записывая событие */
function rate_ok(string $key, int $limit, int $windowSec, bool $consume = true): bool
{
    $dir = DATA . '/ratelimit';
    ensure_dir($dir);
    $file = $dir . '/' . hash('sha256', $key . secret()) . '.json';
    return with_lock('rl-' . substr(md5($key), 0, 8), function () use ($file, $limit, $windowSec, $consume) {
        $now = time();
        $hits = array_values(array_filter(read_json($file, []), fn($t) => is_int($t) && $t > $now - $windowSec));
        if (count($hits) >= $limit) return false;
        if ($consume) {
            $hits[] = $now;
            write_json($file, $hits);
        }
        return true;
    });
}

function rate_or_fail(string $key, int $limit, int $windowSec, string $msg = 'Слишком много запросов. Попробуйте позже.'): void
{
    if (!rate_ok($key, $limit, $windowSec)) fail($msg, 429);
}

/* Старые файлы лимитов чистим изредка, чтобы папка не росла */
function rate_gc(): void
{
    if (random_int(1, 50) !== 1) return;
    foreach (glob(DATA . '/ratelimit/*.json') ?: [] as $f) if (filemtime($f) < time() - 3 * 86400) @unlink($f);
}

function captcha_enabled(): bool
{
    return cfg('captcha.server_key') !== '' && cfg('captcha.site_key') !== '';
}

/* Проверка токена SmartCaptcha на сервере Яндекса. Без ключей (тестовый режим) — пропускаем */
function captcha_verify(string $token): bool
{
    if (!captcha_enabled()) return true;
    if ($token === '') return false;
    $ch = curl_init('https://smartcaptcha.yandexcloud.net/validate');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query(['secret' => cfg('captcha.server_key'), 'token' => $token, 'ip' => client_ip()]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200 || !is_string($res)) {
        /* сервис капчи недоступен: не блокируем людей, остальные лимиты продолжают работать */
        log_error('smartcaptcha unavailable: HTTP ' . $code);
        return true;
    }
    $d = json_decode($res, true);
    return is_array($d) && ($d['status'] ?? '') === 'ok';
}

/* Общие проверки для публичных форм */
function guard_form(array $d, string $scope): void
{
    rate_gc();
    /* поле-ловушка: люди его не видят и не заполняют */
    if (!empty($d['website'])) fail('Не удалось отправить', 400);
    /* форма отправлена быстрее, чем человек успел бы её заполнить */
    $elapsed = isset($d['elapsed']) && is_numeric($d['elapsed']) ? (int)$d['elapsed'] : 0;
    if ($elapsed < 2500) fail('Не удалось отправить, попробуйте ещё раз', 400);
    $ip = client_ip();
    rate_or_fail($scope . ':burst:' . $ip, 5, 600);
    if (!captcha_verify(str_field($d, 'captcha', 4000))) fail('Проверка «я не робот» не пройдена. Попробуйте ещё раз.', 403, ['captcha' => true]);
    if (empty($d['consent'])) fail('Нужно согласие на обработку персональных данных', 422, ['field' => 'consent']);
}

function valid_email(string $e): bool
{
    return (bool)filter_var($e, FILTER_VALIDATE_EMAIL) && mb_strlen($e) <= 254;
}

/* Email для сравнения «тот же человек»: регистр и метки после «+» не важны */
function email_key(string $e): string
{
    $e = mb_strtolower(trim($e));
    [$local, $domain] = array_pad(explode('@', $e, 2), 2, '');
    $local = preg_replace('/\+.*$/', '', $local);
    if (in_array($domain, ['gmail.com', 'googlemail.com'], true)) $local = str_replace('.', '', $local);
    if (in_array($domain, ['yandex.ru', 'ya.ru', 'yandex.com', 'yandex.by', 'yandex.kz', 'yandex.ua'], true)) {
        $domain = 'yandex.ru';
        $local = str_replace('.', '-', $local);
    }
    return $local . '@' . $domain;
}

function phone_clean(string $cc, string $phone): string
{
    $digits = preg_replace('/\D+/', '', $phone) ?? '';
    if ($digits === '') return '';
    $ccd = preg_replace('/\D+/', '', $cc) ?? '';
    return '+' . $ccd . $digits;
}
