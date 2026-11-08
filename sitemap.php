<?php
/* Карта сайта для поисковиков: /sitemap.xml (адрес — правило в .htaccess). Главная, политика, новости и все
   опубликованные статьи; обновляется сама при публикации. Адреса — боевого домена (CANONICAL_BASE) */
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/views.php';
require __DIR__ . '/lib/articles.php';
require_once __DIR__ . '/lib/site_content.php';

$day = fn(string $file) => is_file($file) ? date('Y-m-d', (int)filemtime($file)) : '';
$urls = [
    ['/', $day(__DIR__ . '/index.html')],
    ['/privacy', substr((string)(privacy_doc()['updated_at'] ?: date('c', (int)filemtime(__DIR__ . '/lib/privacy-default.php'))), 0, 10)],
];
$arts = articles_published();
if ($arts) {
    $urls[] = ['/news', substr((string)($arts[0]['updated_at'] ?? $arts[0]['published_at']), 0, 10)];
    foreach ($arts as $a) $urls[] = ['/news/' . $a['slug'], substr((string)($a['updated_at'] ?? $a['published_at']), 0, 10)];
}

header('Content-Type: application/xml; charset=utf-8');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as [$path, $mod]) {
    echo '<url><loc>' . htmlspecialchars(CANONICAL_BASE . $path, ENT_XML1) . '</loc>'
        . (preg_match('/^\d{4}-\d{2}-\d{2}$/', $mod) ? '<lastmod>' . $mod . '</lastmod>' : '') . "</url>\n";
}
echo "</urlset>\n";
