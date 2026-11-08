<?php
/* Страница «Новости»: список опубликованных статей */
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/articles.php';
require __DIR__ . '/lib/views.php';

$list = articles_published();
page_open('Новости — аксиа', 'Новости и публикации команды аксиа', ['label' => 'Новости', 'path' => '/news']);
?>
<main class="pg-main pg-main--grid">
<div class="pg-head"><h1 class="pg-title">новости</h1><a class="pg-back" href="/"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 8H3M7 4 3 8l4 4"></path></svg>вернуться на главную</a></div>
<?php if (!$list): ?>
<p class="pg-empty">Здесь скоро появятся публикации.</p>
<?php else: ?>
<ul class="news__list">
<?php foreach ($list as $a): ?>
<li class="news__item">
<a class="news__link" href="/news/<?= h($a['slug']) ?>">
<span class="news__cover"><?php if ($a['cover']): ?><img src="<?= h($a['cover']) ?>" alt="<?= h($a['cover_alt']) ?>" loading="lazy" decoding="async"><?php endif; ?></span>
<span class="news__body">
<time class="news__date" datetime="<?= h($a['published_at']) ?>"><?= h(ru_date($a['published_at'])) ?></time>
<span class="news__name"><?= h($a['title']) ?></span>
<?php if ($a['description'] !== ''): ?><span class="news__desc"><?= h($a['description']) ?></span><?php endif; ?>
</span>
</a>
</li>
<?php endforeach; ?>
</ul>
<?php endif; ?>
</main>
<?php page_close();
