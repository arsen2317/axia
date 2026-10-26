<?php
/* Форма «напишите нам»: письмо на почту компании */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/guard.php';
require __DIR__ . '/../lib/mail.php';

require_method('POST');
$d = json_body();
guard_form($d, 'contact');

$name = name_field($d);
$email = str_field($d, 'email', 254, true);
if (!valid_email($email)) fail('Проверьте адрес почты', 422, ['field' => 'email']);
$phone = phone_clean(str_field($d, 'cc', 8), str_field($d, 'phone', 32));
$comment = str_field($d, 'comment', 4000, false, true);

$ip = rl_ip();
rate_or_fail('contact:hour:' . $ip, 5, 3600);
rate_or_fail('contact:mail:' . pd_hash(email_key($email)), 3, 3600);
rate_or_fail('contact:total', 100, 86400, 'Форма временно недоступна. Напишите нам на ' . cfg('mail.to'));

$rows = ['Имя' => $name, 'Почта' => $email, 'Телефон' => $phone, 'Комментарий' => $comment];
$ok = send_mail(
    (string)cfg('mail.to'),
    'Заявка с сайта: ' . $name,
    mail_layout('Новая заявка с сайта', mail_rows($rows) . '<p style="color:#6b7aa8;font-size:13px">Отправлено ' . date('d.m.Y H:i') . '. Ответить можно прямо на это письмо.</p>'),
    "Новая заявка с сайта\n\n" . mail_text_rows($rows),
    ['reply_to' => [$email, $name]]
);
if (!$ok) fail('Не удалось отправить. Напишите нам на ' . cfg('mail.to'), 502);
json_out(['ok' => true]);
