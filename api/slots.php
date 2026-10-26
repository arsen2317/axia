<?php
/* Свободные слоты для календаря на сайте */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/guard.php';
require __DIR__ . '/../lib/booking.php';

if (!settings()['booking_enabled']) json_out(['ok' => true, 'enabled' => false, 'slots' => []]);
rate_or_fail('slots:' . rl_ip(), 60, 60);

$slots = array_map(fn($s) => $s[0]->format(DATE_ATOM), free_slots());
json_out([
    'ok' => true,
    'enabled' => true,
    'timezone' => (string)cfg('timezone'),
    'durationMin' => (int)cfg('booking.duration_min', 30),
    'slots' => $slots,
]);
