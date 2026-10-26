<?php
/* Админка: вход, переключатель бронирования, ближайшие встречи, список статей */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/admin.php';
require __DIR__ . '/../lib/booking.php';
require __DIR__ . '/../lib/articles.php';

admin_session();
$error = null;
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && isset($_POST['login'])) {
    $error = admin_login((string)$_POST['login'], (string)($_POST['password'] ?? ''));
    if ($error === null) { header('Location: /admin/'); exit; }
}
if (isset($_GET['logout'])) { admin_logout(); header('Location: /admin/'); exit; }

if (!admin_logged_in()) {
    admin_head('Вход');
    ?>
<main class="ad-login">
<form class="ad-card ad-login__form" method="post" action="/admin/">
<p class="ad-logo">аксиа · админка</p>
<?php if (!admin_configured()): ?>
<p class="ad-note ad-note--warn">Пароль администратора ещё не задан. Укажите <code>admin.password_hash</code> в <code>config/config.local.php</code> (см. README).</p>
<?php endif; ?>
<?php if ($error): ?><p class="ad-note ad-note--err" role="alert"><?= h($error) ?></p><?php endif; ?>
<label class="ad-field"><span>Логин</span><input name="login" autocomplete="username" required autofocus></label>
<label class="ad-field"><span>Пароль</span><input name="password" type="password" autocomplete="current-password" required></label>
<button class="ad-btn ad-btn--primary" type="submit">Войти</button>
</form>
</main>
</body></html>
<?php
    exit;
}

$s = settings();
$now = time();
$upcoming = array_values(array_filter(bookings(), fn($b) => ($b['status'] ?? '') === 'active' && $b['end'] > $now));
usort($upcoming, fn($a, $b) => $a['start'] <=> $b['start']);
$articles = articles_all();
$checks = [
    'Почта (SMTP)' => cfg('mail.smtp_user') !== '' && cfg('mail.smtp_pass') !== '',
    'SmartCaptcha' => captcha_enabled(),
    'Яндекс Телемост' => telemost_enabled(),
    'Яндекс Календарь' => caldav_enabled(),
];
admin_head('Панель');
?>
<header class="ad-top">
<a class="ad-logo" href="/admin/">аксиа · админка</a>
<nav class="ad-top__nav"><a href="/" target="_blank" rel="noopener">сайт ↗</a><a href="/news" target="_blank" rel="noopener">новости ↗</a><a href="/admin/?logout=1">выйти</a></nav>
</header>
<main class="ad-main" data-csrf="<?= h(csrf_token()) ?>">

<section class="ad-card">
<h2>Запись на встречи</h2>
<label class="ad-switch">
<input type="checkbox" id="booking-toggle" <?= $s['booking_enabled'] ? 'checked' : '' ?>>
<span class="ad-switch__track" aria-hidden="true"></span>
<span id="booking-label"><?= $s['booking_enabled'] ? 'Включена — на сайте календарь со слотами' : 'Выключена — на сайте вместо календаря форма обратной связи' ?></span>
</label>
<p class="ad-hint">Подключения: <?php foreach ($checks as $k => $v): ?><span class="ad-pill <?= $v ? 'is-on' : '' ?>"><?= h($k) ?>: <?= $v ? 'настроено' : 'тестовый режим' ?></span> <?php endforeach; ?></p>

<h3>Ближайшие встречи</h3>
<?php if (!$upcoming): ?>
<p class="ad-hint">Пока нет. Контакты клиентов — в событиях Яндекс Календаря и в письмах на <?= h((string)cfg('mail.to')) ?>.</p>
<?php else: ?>
<ul class="ad-list">
<?php foreach ($upcoming as $b): ?>
<li class="ad-list__row" data-id="<?= h($b['id']) ?>">
<span><?= h(ru_when((int)$b['start'], (int)$b['end'])) ?></span>
<span class="ad-list__actions"><?php if (!empty($b['join_url'])): ?><a href="<?= h($b['join_url']) ?>" target="_blank" rel="noopener">Телемост</a><?php endif; ?>
<button class="ad-btn ad-btn--small ad-btn--danger" type="button" data-cancel="<?= h($b['id']) ?>">Отменить</button></span>
</li>
<?php endforeach; ?>
</ul>
<?php endif; ?>
</section>

<section class="ad-card">
<div class="ad-card__head"><h2>Статьи</h2><a class="ad-btn ad-btn--primary" href="/admin/edit.php">Новая статья</a></div>
<?php if (!$articles): ?>
<p class="ad-hint">Статей пока нет.</p>
<?php else: ?>
<ul class="ad-list">
<?php foreach ($articles as $a): ?>
<li class="ad-list__row" data-id="<?= h($a['id']) ?>">
<span class="ad-list__main">
<?php if ($a['cover']): ?><img class="ad-thumb" src="<?= h($a['cover']) ?>" alt=""><?php else: ?><span class="ad-thumb"></span><?php endif; ?>
<span><b><?= h($a['title']) ?></b><br><span class="ad-hint"><?= $a['status'] === 'published' ? ($a['published_at'] > date('Y-m-d') ? 'запланирована на ' : 'опубликована ') . h(ru_date($a['published_at'])) : 'черновик' ?></span></span>
</span>
<span class="ad-list__actions">
<?php if ($a['status'] === 'published'): ?><a href="/news/<?= h($a['slug']) ?>" target="_blank" rel="noopener">открыть ↗</a><?php endif; ?>
<a class="ad-btn ad-btn--small" href="/admin/edit.php?id=<?= h($a['id']) ?>">Редактировать</a>
<button class="ad-btn ad-btn--small ad-btn--danger" type="button" data-delete="<?= h($a['id']) ?>">Удалить</button>
</span>
</li>
<?php endforeach; ?>
</ul>
<?php endif; ?>
</section>
</main>
<script src="/admin/admin.js"></script>
</body></html>
