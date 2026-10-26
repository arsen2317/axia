<?php
/*
 * Запись на встречу. Порядок: антиспам → проверка слота под блокировкой → конференция в Телемосте →
 * событие в Яндекс Календаре → письма клиенту (со ссылкой и .ics), гостям и компании.
 */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/guard.php';
require __DIR__ . '/../lib/mail.php';
require __DIR__ . '/../lib/booking.php';

require_method('POST');
if (!settings()['booking_enabled']) fail('Запись на встречи сейчас недоступна. Напишите нам через форму.', 403, ['disabled' => true]);
$d = json_body();
guard_form($d, 'book');

$name = str_field($d, 'name', 120, true);
$email = str_field($d, 'email', 254, true);
if (!valid_email($email)) fail('Проверьте адрес почты', 422, ['field' => 'email']);
$phone = phone_clean(str_field($d, 'cc', 8), str_field($d, 'phone', 32));
$info = str_field($d, 'info', 3000);
$guestsRaw = str_field($d, 'guests', 1000);
$guests = [];
foreach (preg_split('/[\s,;]+/', $guestsRaw, -1, PREG_SPLIT_NO_EMPTY) as $g) {
    if (!valid_email($g)) fail('Проверьте адреса гостей', 422, ['field' => 'guests']);
    if (email_key($g) !== email_key($email)) $guests[email_key($g)] = $g;
}
$guests = array_values($guests);
if (count($guests) > (int)cfg('booking.max_guests', 3)) fail('Можно добавить не больше ' . (int)cfg('booking.max_guests', 3) . ' гостей', 422, ['field' => 'guests']);

$startIso = str_field($d, 'start', 40, true);
try { $start = new DateTimeImmutable($startIso); } catch (Throwable $e) { fail('Неверное время'); }
$start = $start->setTimezone(tz());

/* --- лимиты на человека и на сайт --- */
$ip = client_ip();
$emailH = pd_hash(email_key($email));
$phoneH = $phone !== '' ? pd_hash($phone) : '';
$ipH = pd_hash($ip);
if (!rate_ok('book:ip-day:' . $ip, (int)cfg('booking.max_per_ip_day', 3), 86400, false)) fail('С этого устройства уже было несколько записей. Если нужно ещё время — напишите нам.', 429);
if (!rate_ok('book:total-day', (int)cfg('booking.max_total_day', 20), 86400, false)) fail('Запись временно недоступна. Напишите нам через форму — мы подберём время.', 429);

$result = with_lock('booking', function () use ($start, $emailH, $phoneH, $ipH, $ip) {
    $now = time();
    $active = array_filter(bookings(), fn($b) => ($b['status'] ?? '') === 'active' && $b['end'] > $now);
    $mine = array_filter($active, fn($b) => $b['email_h'] === $emailH || ($phoneH !== '' && ($b['phone_h'] ?? '') === $phoneH));
    if (count($mine) >= (int)cfg('booking.max_active_per_contact', 1)) {
        return ['error' => 'У вас уже есть запланированная встреча. Чтобы выбрать другое время, отмените её по ссылке из письма.', 'code' => 409];
    }
    /* слот всё ещё свободен? (свежие данные календаря, без кэша) */
    $found = null;
    foreach (free_slots(true) as $s) if ($s[0]->getTimestamp() === $start->getTimestamp()) { $found = $s; break; }
    if (!$found) return ['error' => 'Это время уже заняли. Выберите, пожалуйста, другое.', 'code' => 409, 'taken' => true];

    /* резервируем слот, пока создаём встречу */
    $b = [
        'id' => bin2hex(random_bytes(8)),
        'uid' => bin2hex(random_bytes(12)) . '@axiagroup.ru',
        'start' => $found[0]->getTimestamp(),
        'end' => $found[1]->getTimestamp(),
        'status' => 'pending',
        'email_h' => $emailH, 'phone_h' => $phoneH, 'ip_h' => $ipH,
        'created' => $now,
    ];
    $all = bookings();
    $all[] = $b;
    save_bookings($all);
    rate_ok('book:ip-day:' . $ip, PHP_INT_MAX, 86400);
    rate_ok('book:total-day', PHP_INT_MAX, 86400);
    return ['booking' => $b];
});
if (isset($result['error'])) fail($result['error'], $result['code'], isset($result['taken']) ? ['taken' => true] : []);
$b = $result['booking'];

function set_booking(string $id, array $patch): void
{
    with_lock('booking', function () use ($id, $patch) {
        $all = bookings();
        foreach ($all as &$x) if ($x['id'] === $id) $x = $patch + $x;
        save_bookings($all);
    });
}
function drop_booking(string $id): void
{
    with_lock('booking', fn() => save_bookings(array_values(array_filter(bookings(), fn($x) => $x['id'] !== $id))));
}

/* --- Телемост --- */
$conf = telemost_create();
if ($conf === null) {
    drop_booking($b['id']);
    fail('Не получилось создать видеовстречу. Попробуйте ещё раз через пару минут или напишите нам.', 502);
}
$b['join_url'] = $conf['join_url'];
$b['conf_id'] = $conf['id'];
$token = bin2hex(random_bytes(16));
$cancelUrl = site_url('/api/cancel.php?id=' . $b['id'] . '&t=' . $token);
$when = ru_when($b['start'], $b['end']);
$title = (string)cfg('booking.title');

/* --- событие в календаре компании (здесь — контакты клиента, они хранятся в Яндекс 360) --- */
$rows = ['Имя' => $name, 'Почта' => $email, 'Телефон' => $phone, 'Гости' => implode(', ', $guests), 'Комментарий' => $info];
$desc = mail_text_rows($rows) . ($b['join_url'] ? "\nТелемост: " . $b['join_url'] : '') . "\nЗапись с сайта " . site_url();
if (!caldav_put_event($b['uid'], build_ics($b, $title . ': ' . $name, $desc))) {
    telemost_delete($b['conf_id']);
    drop_booking($b['id']);
    fail('Не получилось записать встречу в календарь. Попробуйте ещё раз или напишите нам.', 502);
}
set_booking($b['id'], ['status' => 'active', 'join_url' => $b['join_url'], 'conf_id' => $b['conf_id'], 'token_h' => hash('sha256', $token)]);

/* --- письма --- */
$linkHtml = $b['join_url']
    ? '<p><a href="' . h($b['join_url']) . '" style="display:inline-block;padding:12px 20px;background:#2c4595;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold">Подключиться в Телемосте</a></p><p style="font-size:13px;color:#6b7aa8">Ссылка: ' . h($b['join_url']) . '</p>'
    : '<p>Ссылку на видеовстречу мы пришлём отдельным письмом.</p>';
$clientIcs = build_ics($b, $title, ($b['join_url'] ? 'Яндекс Телемост: ' . $b['join_url'] . "\n" : '') . 'Отменить встречу: ' . $cancelUrl, 'PUBLISH');
$attach = [['invite.ics', $clientIcs, 'text/calendar; charset=utf-8; method=PUBLISH']];

$clientHtml = mail_layout('Встреча назначена',
    '<p>' . h($name) . ', спасибо! Ждём вас на встрече.</p><p><b>' . h($when) . '</b></p>' . $linkHtml
    . '<p>Файл во вложении можно добавить в свой календарь.</p>'
    . '<p style="font-size:13px;color:#6b7aa8">Планы изменились? <a href="' . h($cancelUrl) . '" style="color:#2c4595">Отменить встречу</a> — после этого можно выбрать другое время на сайте.</p>');
$clientText = "Встреча назначена\n\n$when\n" . ($b['join_url'] ? "Яндекс Телемост: {$b['join_url']}\n" : '') . "\nОтменить встречу: $cancelUrl\n";
$sentClient = send_mail($email, 'Встреча с аксиа: ' . $when, $clientHtml, $clientText, ['attachments' => $attach, 'reply_to' => [(string)cfg('mail.to'), (string)cfg('mail.from_name')]]);

foreach ($guests as $g) {
    send_mail($g, 'Приглашение на встречу с аксиа: ' . $when,
        mail_layout('Вас пригласили на встречу', '<p>' . h($name) . ' пригласил(а) вас на встречу с командой аксиа.</p><p><b>' . h($when) . '</b></p>' . $linkHtml),
        "Вас пригласили на встречу с аксиа\n\n$when\n" . ($b['join_url'] ? "Яндекс Телемост: {$b['join_url']}\n" : ''),
        ['attachments' => [['invite.ics', build_ics($b, $title, $b['join_url'] ? 'Яндекс Телемост: ' . $b['join_url'] : '', 'PUBLISH'), 'text/calendar; charset=utf-8; method=PUBLISH']]]);
}

send_mail((string)cfg('mail.to'), 'Новая встреча: ' . $name . ', ' . $when,
    mail_layout('Новая встреча с сайта', '<p><b>' . h($when) . '</b></p>' . mail_rows($rows + ['Телемост' => $b['join_url']])
        . (!$sentClient ? '<p style="color:#b00020">Письмо клиенту отправить не удалось — свяжитесь с ним сами.</p>' : '')),
    "Новая встреча с сайта\n\n$when\n" . mail_text_rows($rows + ['Телемост' => $b['join_url']]),
    ['reply_to' => [$email, $name]]);

json_out(['ok' => true, 'when' => $when, 'emailSent' => $sentClient]);
