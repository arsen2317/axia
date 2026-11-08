<?php
/* Админка: вход, переключатель бронирования, ближайшие встречи, список статей */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/admin.php';
require __DIR__ . '/../lib/booking.php';
require __DIR__ . '/../lib/articles.php';
require __DIR__ . '/../lib/consent.php';
require __DIR__ . '/../lib/site_content.php';

admin_session();
$error = null;
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && isset($_POST['login'])) {
    $t = (string)($_POST['csrf'] ?? '');
    $error = hash_equals(csrf_token(), $t) ? admin_login((string)$_POST['login'], (string)($_POST['password'] ?? '')) : 'Страница устарела, попробуйте ещё раз';
    if ($error === null) { header('Location: /admin/'); exit; }
}
if (isset($_GET['logout']) && hash_equals(csrf_token(), (string)($_GET['t'] ?? ''))) { admin_logout(); header('Location: /admin/'); exit; }

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
<input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
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
$consentN = count(consent_all());
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
<nav class="ad-top__nav"><a href="/" target="_blank" rel="noopener">сайт ↗</a><a href="/news" target="_blank" rel="noopener">новости ↗</a><a href="/admin/?logout=1&amp;t=<?= h(csrf_token()) ?>">выйти</a></nav>
</header>
<main class="ad-main" data-csrf="<?= h(csrf_token()) ?>">

<section class="ad-card">
<h2>Запись на встречи</h2>
<label class="ad-switch">
<input type="checkbox" id="booking-toggle" <?= $s['booking_enabled'] ? 'checked' : '' ?>>
<span class="ad-switch__track" aria-hidden="true"></span>
<span id="booking-label"><?= $s['booking_enabled'] ? 'Включена — на сайте календарь со слотами' : 'Выключена — на сайте вместо календаря форма обратной связи' ?></span>
</label>
<p class="ad-hint">Ваш IP, как его видит сервер: <b><?= h(client_ip()) ?></b><?= filter_var(client_ip(), FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false ? ' — внутренний адрес: включите trust_proxy в настройках, иначе лимиты работают на всех посетителей сразу' : '' ?></p>
<p class="ad-hint">Подключения: <?php foreach ($checks as $k => $v): ?><span class="ad-pill <?= $v ? 'is-on' : '' ?>"><?= h($k) ?>: <?= $v ? 'настроено' : 'тестовый режим' ?></span> <?php endforeach; ?></p>

<h3>Параметры и расписание</h3>
<p class="ad-hint">Время — <?= (string)cfg('timezone') === 'Europe/Moscow' ? 'московское' : h((string)cfg('timezone')) ?>. Слот виден на сайте, если на это время в Яндекс Календаре ничего нет и на него ещё никто не записался.</p>
<div id="schedule" data-settings="<?= h(json_encode(booking_cfg(), JSON_UNESCAPED_UNICODE)) ?>"></div>
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

<section class="ad-card" id="contacts" data-contacts="<?= h(json_encode(contacts(), JSON_UNESCAPED_UNICODE)) ?>">
<h2>Контакты на сайте</h2>
<p class="ad-hint">Подвал всех страниц и почты в блоке «Команда». Пустое поле — пункт на сайте не показывается (кроме общей почты).
Заявки и уведомления о встречах приходят на адрес из настроек сайта — его здесь не меняют.</p>
<div class="ad-row">
<label class="ad-field"><span>Общая почта *</span><input name="email" type="email" maxlength="254" required></label>
<label class="ad-field"><span>Телефон</span><input name="phone" type="tel" maxlength="24" placeholder="+7 900 000-00-00"></label>
<label class="ad-field"><span>Телеграм-канал</span><input name="telegram" maxlength="100" placeholder="https://t.me/… или @имя"></label>
</div>
<div class="ad-row">
<?php foreach (CONTACTS_TEAM as $i => $n): ?><label class="ad-field"><span>Почта: <?= h($n) ?></span><input name="team<?= $i ?>" type="email" maxlength="254"></label>
<?php endforeach; ?>
</div>
<div class="ad-sched__bar"><button class="ad-btn ad-btn--primary" type="button" id="contacts-save" disabled>Сохранить</button><span class="ad-hint" id="contacts-state" role="status"></span></div>
</section>

<section class="ad-card">
<div class="ad-card__head"><h2>Политика конфиденциальности</h2><a class="ad-btn" href="/admin/privacy.php">Редактировать текст</a></div>
<p class="ad-hint"><?php $pd = privacy_doc(); echo $pd['updated_at'] !== '' ? 'Последняя правка: ' . h(date('d.m.Y H:i', (int)strtotime($pd['updated_at']))) . '.' : 'Действует исходный текст.'; ?> Страница на сайте — <a href="/privacy" target="_blank" rel="noopener">/privacy ↗</a></p>
</section>

<section class="ad-card">
<div class="ad-card__head"><h2>Согласия на обработку персональных данных</h2><?php if ($consentN): ?><a class="ad-btn" href="/admin/consents.php?t=<?= h(csrf_token()) ?>">Скачать CSV</a><?php endif; ?></div>
<p class="ad-hint"><?= $consentN ? 'В журнале записей: <b>' . $consentN . '</b>.' : 'Пока записей нет.' ?> Каждая отправка формы «напишите нам» и запись на встречу сохраняет, кто, когда, с какого IP и с какой редакцией политики согласился. Файлы журнала — в <code>data/consents/</code>.</p>
</section>
<section class="ad-card">
<div class="ad-card__head"><h2>Статьи</h2><a class="ad-btn ad-btn--primary" href="/admin/edit.php">Новая статья</a></div>
<label class="ad-switch">
<input type="checkbox" id="news-toggle" <?= $s['news_enabled'] ? 'checked' : '' ?>>
<span class="ad-switch__track" aria-hidden="true"></span>
<span id="news-label"><?= $s['news_enabled'] ? 'Блок «Новости» включён: показывается на главной, в меню и подвале' : 'Блок «Новости» выключен: на главной, в меню и подвале его нет' ?></span>
</label>
<p class="ad-hint">Просмотры — уникальные посетители статьи (каждый человек засчитывается один раз; роботы и вы сами, пока вошли в админку, не считаются). «В архив» — статья пропадает с сайта, но не удаляется: её можно вернуть.</p>
<p class="ad-hint">Страница /news и статьи остаются доступны по прямой ссылке.<?php if (!articles_published()): ?> <b>Сейчас нет опубликованных статей, поэтому блока на сайте не видно, даже когда он включён.</b><?php endif; ?></p>
<?php if (!$articles): ?>
<p class="ad-hint">Статей пока нет.</p>
<?php else: ?>
<ul class="ad-list">
<?php foreach ($articles as $a): ?>
<li class="ad-list__row" data-id="<?= h($a['id']) ?>">
<span class="ad-list__main">
<?php if ($a['cover']): ?><img class="ad-thumb" src="<?= h($a['cover']) ?>" alt=""><?php else: ?><span class="ad-thumb"></span><?php endif; ?>
<?php $views = $a['status'] !== 'draft' ? article_views($a['id']) : 0; ?>
<span><b><?= h($a['title']) ?></b><br><span class="ad-hint"><?= $a['status'] === 'published' ? ($a['published_at'] > date('Y-m-d') ? 'запланирована на ' : 'опубликована ') . h(ru_date($a['published_at'])) : ($a['status'] === 'archived' ? 'в архиве — на сайте не видна' : 'черновик') ?><?= $a['status'] !== 'draft' ? ' · просмотров: ' . $views : '' ?></span></span>
</span>
<span class="ad-list__actions">
<?php if ($a['status'] === 'published'): ?><a href="/news/<?= h($a['slug']) ?>" target="_blank" rel="noopener">открыть ↗</a><?php endif; ?>
<a class="ad-btn ad-btn--small" href="/admin/edit.php?id=<?= h($a['id']) ?>">Редактировать</a>
<?php if ($a['status'] === 'published'): ?><button class="ad-btn ad-btn--small" type="button" data-archive="<?= h($a['id']) ?>" data-to="1">В архив</button><?php endif; ?>
<?php if ($a['status'] === 'archived'): ?><button class="ad-btn ad-btn--small" type="button" data-archive="<?= h($a['id']) ?>" data-to="0">Вернуть на сайт</button><?php endif; ?>
<button class="ad-btn ad-btn--small ad-btn--danger" type="button" data-delete="<?= h($a['id']) ?>">Удалить</button>
</span>
</li>
<?php endforeach; ?>
</ul>
<?php endif; ?>
</section>
</main>
<script src="<?= h(asset('/admin/admin.js')) ?>"></script>
<script src="<?= h(asset('/admin/schedule.js')) ?>"></script>
</body></html>
