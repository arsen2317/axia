<?php
/* Публичные настройки для страницы: включено ли бронирование, ключ капчи, показывать ли новости на сайте */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/articles.php';

json_out([
    'ok' => true,
    'bookingEnabled' => (bool)settings()['booking_enabled'],
    'captchaSiteKey' => (string)cfg('captcha.site_key', ''),
    'durationMin' => (int)cfg('booking.duration_min', 30),
    /* блок «Новости» на главной и пункты «новости» в меню и подвале: включены в админке и есть хотя бы одна статья */
    'newsVisible' => (bool)settings()['news_enabled'] && count(articles_published()) > 0,
]);
