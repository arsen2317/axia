<?php
/* Политика обработки персональных данных: /privacy. Текст правится в админке (lib/site_content.php) */
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/views.php';
require_once __DIR__ . '/lib/site_content.php';

$doc = privacy_doc();
/* data-nav="pinned": меню на десктопе не сжимается при скролле (assets/js/inner.js) */
page_open('Политика обработки персональных данных — аксиа', 'Как ООО «Аксиа Консалтинг» обрабатывает и защищает персональные данные пользователей сайта',
    ['label' => 'Документы', 'path' => '/privacy', 'body_attr' => ' data-nav="pinned"']);
?>
<main class="pg-main">
<article class="doc">
<h1>Политика обработки персональных данных</h1>
<?= privacy_html($doc['text']) ?>
</article>
</main>
<?php page_close();
