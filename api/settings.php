<?php
/* Публичные настройки для страницы: включено ли бронирование, ключ капчи */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';

json_out([
    'ok' => true,
    'bookingEnabled' => (bool)settings()['booking_enabled'],
    'captchaSiteKey' => (string)cfg('captcha.site_key', ''),
    'durationMin' => (int)cfg('booking.duration_min', 30),
]);
