<?php
/* Отмена встречи по ссылке из письма. GET показывает подтверждение (чтобы предпросмотр ссылок в почте не отменял встречу), POST — отменяет */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/guard.php';
require __DIR__ . '/../lib/booking.php';

$id = preg_replace('/[^a-f0-9]/', '', (string)($_REQUEST['id'] ?? ''));
$t = preg_replace('/[^a-f0-9]/', '', (string)($_REQUEST['t'] ?? ''));
rate_or_fail('cancel:' . rl_ip(), 20, 3600);

$b = null;
foreach (bookings() as $x) if ($x['id'] === $id && hash_equals((string)($x['token_h'] ?? ''), hash('sha256', $t))) $b = $x;

$state = 'invalid';
if ($b) {
    if (($b['status'] ?? '') !== 'active') $state = 'already';
    elseif ($b['end'] < time()) $state = 'past';
    elseif (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') $state = cancel_booking($b['id'], 'клиент по ссылке из письма') ? 'done' : 'already';
    else $state = 'confirm';
}
$when = $b ? ru_when((int)$b['start'], (int)$b['end']) : '';
$msgs = [
    'invalid' => ['Ссылка недействительна', 'Проверьте ссылку из письма или напишите нам на ' . cfg('mail.to') . '.'],
    'already' => ['Встреча уже отменена', 'Выбрать новое время можно на сайте.'],
    'past' => ['Встреча уже прошла', 'Если нужно обсудить что-то ещё — запишитесь на новое время.'],
    'confirm' => ['Отменить встречу?', $when],
    'done' => ['Встреча отменена', 'Время освободилось. Если захотите — выберите новое на сайте.'],
];
[$title, $text] = $msgs[$state];
header('X-Robots-Tag: noindex');
header('Cache-Control: no-store');
require __DIR__ . '/../lib/views.php';
page_open($title . ' — аксиа', '', ['label' => 'Встреча']);
?>
<main class="pg-main pg-msg">
<h1 class="pg-msg__title"><?= h($title) ?></h1>
<p class="pg-msg__text"><?= h($text) ?></p>
<?php if ($state === 'confirm'): ?>
<form method="post" action="/api/cancel.php">
<input type="hidden" name="id" value="<?= h($id) ?>">
<input type="hidden" name="t" value="<?= h($t) ?>">
<button class="btn btn--light" type="submit">Да, отменить</button>
<a class="btn btn--ghost" href="/">Нет, оставить</a>
</form>
<?php else: ?>
<a class="btn btn--light" href="/#contact">На сайт</a>
<?php endif; ?>
</main>
<?php page_close();
