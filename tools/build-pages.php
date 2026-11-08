<?php
/*
 * Пересобирает статические страницы с общей шапкой и подвалом (lib/partials/*.html):
 *   php tools/build-pages.php
 * Содержимое страницы (всё внутри <main>…</main>) берётся из самого файла, поэтому текст политики и согласия
 * правится прямо в privacy.html, а этот скрипт нужен после изменений шапки или подвала.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require __DIR__ . '/../lib/bootstrap.php';
require ROOT . '/lib/views.php';
require_once ROOT . '/lib/site_content.php';

$csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' https://smartcaptcha.yandexcloud.net https://mc.yandex.ru https://yastatic.net; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob: https://smartcaptcha.yandexcloud.net https://mc.yandex.ru https://mc.yandex.com; font-src \'self\'; connect-src \'self\' https://smartcaptcha.yandexcloud.net https://mc.yandex.ru https://mc.yandex.com; frame-src https://smartcaptcha.yandexcloud.net; object-src \'none\'; base-uri \'self\'; form-action \'self\'">' . "\n"
    . '<meta name="referrer" content="strict-origin-when-cross-origin">' . "\n";
$demoHead = '<meta name="robots" content="noindex">' . "\n" . '<link rel="stylesheet" href="/demo/demo.css">' . "\n";

$pages = [
    /* data-nav="pinned": меню на десктопе не сжимается при скролле (assets/js/inner.js) */
    /* политика на хостинге — privacy.php (текст из админки); здесь — статичная копия текста по умолчанию для демо на Vercel */
    'demo/privacy.html' => ['Политика обработки персональных данных — аксиа', 'Как ООО «Аксиа Консалтинг» обрабатывает и защищает персональные данные пользователей сайта', 'Документы', $csp, ' data-nav="pinned"', ''],
    /* демо-режим для Vercel (см. demo/demo.js) */
    'demo/news.html' => ['Новости — аксиа', '', 'Новости', $demoHead, ' data-demo="news"', '<script src="/demo/demo.js"></script>' . "\n"],
    'demo/article.html' => ['Статья — аксиа', '', 'Новости', $demoHead, ' data-demo="article"', '<script src="/demo/demo.js"></script>' . "\n"],
];

foreach ($pages as $file => [$title, $desc, $label, $extraHead, $bodyAttr, $extraScript]) {
    $path = ROOT . '/' . $file;
    if ($file === 'demo/privacy.html') {
        $m = ['<main class="pg-main">' . "\n" . '<article class="doc">' . "\n" . '<h1>Политика обработки персональных данных</h1>' . "\n"
            . privacy_html((string)require ROOT . '/lib/privacy-default.php') . '</article>' . "\n" . '</main>'];
    } else {
        $old = (string)file_get_contents($path);
        if (!preg_match('#<main\b.*?</main>#s', $old, $m)) { fwrite(STDERR, "$file: не найден <main>\n"); exit(1); }
    }
    $html = page_head_html($title, $desc, $label, $file === 'demo/privacy.html' ? ['path' => '/privacy'] : []) . "\n" . $m[0] . "\n" . $extraScript . page_foot_html();
    $html = str_replace("</title>\n", "</title>\n" . $extraHead, $html);
    $html = str_replace('<body class="pg">', '<body class="pg"' . $bodyAttr . '>', $html);
    if (str_starts_with($file, 'demo/')) $html = str_replace("<!doctype html>\n", "<!doctype html>\n<!-- ДЕМО для Vercel: см. demo/demo.js -->\n", $html);
    file_put_contents($path, $html);
    echo "✓ $file\n";
}

/* Номера версий у стилей и скриптов в статичных страницах (?v=… — первые знаки отпечатка файла).
   Файл изменился — меняется адрес, и браузеры посетителей сразу берут новую версию, а не старую из кеша.
   PHP-страницы (новости, админка) ставят версии сами через asset() в lib/bootstrap.php */
foreach (['index.html', 'demo/privacy.html', 'demo/news.html', 'demo/article.html', 'demo/admin.html', 'demo/edit.html'] as $file) {
    $path = ROOT . '/' . $file;
    $html = (string)file_get_contents($path);
    $new = preg_replace_callback('#((?:src|href)=")(/?(?:assets|admin|demo)/[^"?]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"#', function ($m) {
        $f = ROOT . '/' . ltrim($m[2], '/');
        return $m[1] . $m[2] . (is_file($f) ? '?v=' . substr(md5_file($f), 0, 10) : '') . '"';
    }, $html);
    if ($new !== $html) { file_put_contents($path, $new); echo "✓ версии: $file\n"; }
}
