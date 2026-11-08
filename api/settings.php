<?php
/* Публичные настройки для страницы: включено ли бронирование, ключ капчи, показывать ли новости на сайте, контакты */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/articles.php';
require __DIR__ . '/../lib/booking.php';
require __DIR__ . '/../lib/site_content.php';

json_out([
    'ok' => true,
    'bookingEnabled' => (bool)settings()['booking_enabled'],
    'captchaSiteKey' => (string)cfg('captcha.site_key', ''),
    'durationMin' => (int)bk('duration_min'),
    /* блок «Новости» на главной и пункты «новости» в меню и подвале: включены в админке и есть хотя бы одна статья */
    'newsVisible' => (bool)settings()['news_enabled'] && count(articles_published()) > 0,
    /* контакты в подвале и в «Команде» — правятся в админке */
    'contacts' => contacts(),
]);
