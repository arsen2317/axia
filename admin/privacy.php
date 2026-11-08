<?php
/* Админка: текст политики обработки персональных данных (/privacy) */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/admin.php';
require_once __DIR__ . '/../lib/site_content.php';

admin_require();
$doc = privacy_doc();
admin_head('Политика конфиденциальности');
?>
<header class="ad-top">
<a class="ad-logo" href="/admin/">← в админку</a>
<nav class="ad-top__nav"><a href="/privacy" target="_blank" rel="noopener">открыть политику ↗</a></nav>
</header>
<main class="ad-main" data-csrf="<?= h(csrf_token()) ?>">
<section class="ad-card">
<h2>Политика обработки персональных данных</h2>
<p class="ad-hint">Как писать: каждый абзац отделяется <b>пустой строкой</b>. Строка, которая начинается с <code>## </code> — заголовок раздела,
с <code>### </code> — подзаголовок. <code>**жирный**</code>, <code>[текст ссылки](https://адрес)</code>, почта — <code>[hello@axiagroup.ru](mailto:hello@axiagroup.ru)</code>.
Абзац, который начинается со слова «Редакция», показывается серым — это дата редакции, не забывайте её обновлять.</p>
<p class="ad-hint">После сохранения новые согласия в журнале будут ссылаться на новую редакцию (у каждой редакции свой отпечаток).
<?= $doc['updated_at'] !== '' ? 'Последнее сохранение: <b>' . h(date('d.m.Y H:i', (int)strtotime($doc['updated_at']))) . '</b>.' : 'Сейчас действует исходный текст — в админке его ещё не сохраняли.' ?></p>
<label class="ad-field"><span>Текст</span><textarea id="privacy-text" rows="30" spellcheck="true"><?= h($doc['text']) ?></textarea></label>
</section>
<div class="ad-savebar">
<p class="ad-note ad-note--err" id="privacy-error" role="alert" hidden></p>
<span class="ad-hint" id="privacy-state"></span>
<button class="ad-btn ad-btn--primary" type="button" id="privacy-save" disabled>Сохранить</button>
</div>
</main>
<script src="<?= h(asset('/admin/admin.js')) ?>"></script>
</body></html>
