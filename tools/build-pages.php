<?php
/*
 * Пересобирает статические страницы с общей шапкой и подвалом (lib/partials/*.html):
 *   php tools/build-pages.php
 * Содержимое страницы (всё внутри <main>…</main>) берётся из самого файла, поэтому текст политики и согласия
 * правится прямо в privacy.html / consent.html, а этот скрипт нужен после изменений шапки или подвала.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require __DIR__ . '/../lib/bootstrap.php';
require ROOT . '/lib/views.php';

$csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' https://smartcaptcha.yandexcloud.net; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob: https://smartcaptcha.yandexcloud.net; font-src \'self\'; connect-src \'self\' https://smartcaptcha.yandexcloud.net; frame-src https://smartcaptcha.yandexcloud.net; object-src \'none\'; base-uri \'self\'; form-action \'self\'">' . "\n"
    . '<meta name="referrer" content="strict-origin-when-cross-origin">' . "\n";
$demoHead = '<meta name="robots" content="noindex">' . "\n" . '<link rel="stylesheet" href="/demo/demo.css">' . "\n";

$pages = [
    'privacy.html' => ['Политика обработки персональных данных — аксиа', 'Как ООО «Аксиа Консалтинг» обрабатывает и защищает персональные данные пользователей сайта', 'Документы', $csp, '', ''],
    'consent.html' => ['Согласие на обработку персональных данных — аксиа', 'Согласие на обработку персональных данных пользователей сайта axiagroup.ru', 'Документы', $csp, '', ''],
    /* демо-режим для Vercel (см. demo/demo.js) */
    'demo/news.html' => ['Новости — аксиа', '', 'Новости', $demoHead, ' data-demo="news"', '<script src="/demo/demo.js"></script>' . "\n"],
    'demo/article.html' => ['Статья — аксиа', '', 'Новости', $demoHead, ' data-demo="article"', '<script src="/demo/demo.js"></script>' . "\n"],
];

foreach ($pages as $file => [$title, $desc, $label, $extraHead, $bodyAttr, $extraScript]) {
    $path = ROOT . '/' . $file;
    $old = (string)file_get_contents($path);
    if (!preg_match('#<main\b.*?</main>#s', $old, $m)) { fwrite(STDERR, "$file: не найден <main>\n"); exit(1); }
    $html = page_head_html($title, $desc, $label) . "\n" . $m[0] . "\n" . $extraScript . page_foot_html();
    $html = str_replace("</title>\n", "</title>\n" . $extraHead, $html);
    $html = str_replace('<body class="pg">', '<body class="pg"' . $bodyAttr . '>', $html);
    if (str_starts_with($file, 'demo/')) $html = str_replace("<!doctype html>\n", "<!doctype html>\n<!-- ДЕМО для Vercel: см. demo/demo.js -->\n", $html);
    file_put_contents($path, $html);
    echo "✓ $file\n";
}
