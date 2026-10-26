<?php
/* Редактор статьи */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/admin.php';
require __DIR__ . '/../lib/articles.php';

admin_require();
$a = isset($_GET['id']) ? article_get((string)$_GET['id']) : null;
if (isset($_GET['id']) && !$a) { http_response_code(404); admin_head('Не найдено'); echo '<main class="ad-main"><p>Статья не найдена. <a href="/admin/">Назад</a></p></main></body></html>'; exit; }
$a = $a ?? ['id' => '', 'slug' => '', 'title' => '', 'description' => '', 'author' => '', 'cover' => '', 'cover_alt' => '', 'blocks' => [['type' => 'text', 'text' => '']], 'status' => 'draft', 'published_at' => date('Y-m-d')];
admin_head($a['id'] ? 'Редактирование' : 'Новая статья');
?>
<header class="ad-top">
<a class="ad-logo" href="/admin/">← все статьи</a>
<nav class="ad-top__nav"><span class="ad-hint" id="save-state"></span></nav>
</header>
<main class="ad-main ad-editor" data-csrf="<?= h(csrf_token()) ?>">
<script type="application/json" id="article-data"><?= json_encode($a, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>

<section class="ad-card">
<label class="ad-field"><span>Заголовок *</span><input id="f-title" maxlength="200" required></label>
<label class="ad-field"><span>Краткое описание (для списка новостей)</span><textarea id="f-description" rows="3" maxlength="600"></textarea></label>
<div class="ad-row">
<label class="ad-field"><span>Автор (необязательно)</span><input id="f-author" maxlength="120"></label>
<label class="ad-field"><span>Дата публикации</span><input id="f-date" type="date"></label>
<label class="ad-field"><span>Адрес: /news/…</span><input id="f-slug" maxlength="80" placeholder="заполнится из заголовка"></label>
</div>
<div class="ad-field"><span>Обложка</span>
<div class="ad-cover" id="cover-box">
<img id="cover-img" alt="" hidden>
<div class="ad-cover__actions">
<label class="ad-btn"><input type="file" accept="image/jpeg,image/png,image/webp" id="cover-file" hidden>Загрузить обложку</label>
<button class="ad-btn ad-btn--danger" type="button" id="cover-remove" hidden>Убрать</button>
</div>
</div>
<label class="ad-field"><span>Описание обложки для незрячих (alt)</span><input id="f-cover-alt" maxlength="200"></label>
</div>
</section>

<section class="ad-card">
<h2>Текст статьи</h2>
<p class="ad-hint">В тексте: пустая строка — новый абзац, <code>**жирный**</code>, <code>*курсив*</code>, <code>[текст ссылки](https://адрес)</code>.</p>
<div id="blocks"></div>
<div class="ad-add">
<span class="ad-hint">Добавить:</span>
<button class="ad-btn ad-btn--small" type="button" data-add="text">Текст</button>
<button class="ad-btn ad-btn--small" type="button" data-add="heading">Подзаголовок</button>
<button class="ad-btn ad-btn--small" type="button" data-add="image">Картинка</button>
<button class="ad-btn ad-btn--small" type="button" data-add="quote">Цитата</button>
</div>
</section>

<div class="ad-savebar">
<p class="ad-note ad-note--err" id="save-error" role="alert" hidden></p>
<button class="ad-btn" type="button" id="btn-draft">Сохранить черновик</button>
<button class="ad-btn ad-btn--primary" type="button" id="btn-publish">Опубликовать</button>
</div>
</main>
<script src="/admin/admin.js"></script>
<script src="/admin/editor.js"></script>
</body></html>
