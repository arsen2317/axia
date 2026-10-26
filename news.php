<?php
/* Страница «Новости»: список опубликованных статей */
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/articles.php';
require __DIR__ . '/lib/views.php';

$list = articles_published();
page_open('Новости — аксиа', 'Новости и публикации команды аксиа', ['label' => 'Новости']);
?>
<main class="pg-main">
<h1 class="pg-title">новости</h1>
<?php if (!$list): ?>
<p class="pg-empty">Здесь скоро появятся публикации.</p>
<?php else: ?>
<ul class="news-list">
<?php foreach ($list as $a): ?>
<li class="news-item">
<a class="news-item__link" href="/news/<?= h($a['slug']) ?>">
<span class="news-item__cover"><?php if ($a['cover']): ?><img src="<?= h($a['cover']) ?>" alt="<?= h($a['cover_alt']) ?>" loading="lazy" decoding="async"><?php endif; ?></span>
<span class="news-item__body">
<time class="news-item__date" datetime="<?= h($a['published_at']) ?>"><?= h(ru_date($a['published_at'])) ?></time>
<span class="news-item__title"><?= h($a['title']) ?></span>
<?php if ($a['description'] !== ''): ?><span class="news-item__desc"><?= h($a['description']) ?></span><?php endif; ?>
</span>
</a>
</li>
<?php endforeach; ?>
</ul>
<?php endif; ?>
</main>
<?php page_close();
