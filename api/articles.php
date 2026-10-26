<?php
/* Последние статьи в JSON — для будущего блока новостей на главной */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/articles.php';

$limit = max(1, min(20, (int)($_GET['limit'] ?? 3)));
$out = array_map(fn($a) => [
    'title' => $a['title'], 'description' => $a['description'], 'date' => $a['published_at'], 'dateLabel' => ru_date($a['published_at']),
    'cover' => $a['cover'], 'url' => '/news/' . $a['slug'],
], array_slice(articles_published(), 0, $limit));
header('Cache-Control: public, max-age=60');
json_out(['ok' => true, 'articles' => $out]);
