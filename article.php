<?php
/* Страница статьи: /news/<адрес> */
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/articles.php';
require __DIR__ . '/lib/views.php';

$a = article_by_slug((string)($_GET['slug'] ?? ''));
if (!$a) {
    http_response_code(404);
    page_open('Статья не найдена — аксиа');
    echo '<main class="pg-main"><h1 class="pg-title">не найдено</h1><p class="pg-empty">Такой статьи нет или она снята с публикации. <a href="/news">Все новости</a></p></main>';
    page_close();
    exit;
}
page_open($a['title'] . ' — аксиа', $a['description'], ['active' => '/news', 'image' => $a['cover']]);
?>
<main class="pg-main">
<article class="art">
<a class="art__back" href="/news">← все новости</a>
<h1 class="art__title"><?= h($a['title']) ?></h1>
<p class="art__meta"><time datetime="<?= h($a['published_at']) ?>"><?= h(ru_date($a['published_at'])) ?></time><?php if ($a['author'] !== ''): ?> · <?= h($a['author']) ?><?php endif; ?></p>
<?php if ($a['description'] !== ''): ?><p class="art__lead"><?= h($a['description']) ?></p><?php endif; ?>
<?php if ($a['cover']): ?><img class="art__cover" src="<?= h($a['cover']) ?>" alt="<?= h($a['cover_alt']) ?>"><?php endif; ?>
<div class="art__body">
<?= render_blocks($a['blocks']) ?>
</div>
</article>
</main>
<?php page_close();
