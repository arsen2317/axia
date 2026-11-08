<?php
/* Действия админки (JSON). Все запросы — POST, с CSRF-токеном в заголовке X-CSRF */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/admin.php';
require __DIR__ . '/../lib/booking.php';
require __DIR__ . '/../lib/articles.php';

if (!admin_logged_in()) fail('Нужно войти заново', 401);
require_method('POST');
csrf_check();

$action = (string)($_GET['action'] ?? '');
switch ($action) {
    case 'booking':
        $d = json_body();
        save_settings(['booking_enabled' => !empty($d['enabled'])]);
        json_out(['ok' => true, 'enabled' => settings()['booking_enabled']]);

    case 'news':
        $d = json_body();
        save_settings(['news_enabled' => !empty($d['enabled'])]);
        json_out(['ok' => true, 'enabled' => (bool)settings()['news_enabled']]);

    case 'booking_settings':
        $d = json_body();
        [$bs, $err] = booking_normalize((array)($d['settings'] ?? []));
        if ($err) fail($err, 422);
        save_settings(['booking' => $bs]);
        json_out(['ok' => true, 'settings' => $bs]);

    case 'cancel':
        $d = json_body();
        $b = cancel_booking((string)($d['id'] ?? ''), 'администратор');
        if (!$b) fail('Встреча не найдена или уже отменена', 404);
        json_out(['ok' => true]);

    case 'save':
        $d = json_body(2_000_000);
        $old = isset($d['id']) && $d['id'] !== '' ? article_get((string)$d['id']) : null;
        if (isset($d['id']) && $d['id'] !== '' && !$old) fail('Статья не найдена', 404);
        [$a, $err] = article_normalize($d, $old);
        if ($err) fail($err, 422);
        article_save($a, $old);
        json_out(['ok' => true, 'article' => $a]);

    case 'archive':
        $d = json_body();
        $a = article_set_archived((string)($d['id'] ?? ''), !empty($d['archived']));
        if (!$a) fail('Статья не найдена', 404);
        json_out(['ok' => true, 'status' => $a['status']]);

    case 'delete':
        $d = json_body();
        article_delete((string)($d['id'] ?? ''));
        json_out(['ok' => true]);

    case 'upload':
        if (!rate_ok('admin:upload', 200, 3600)) fail('Слишком много загрузок, подождите', 429);
        [$url, $err] = upload_image($_FILES['file'] ?? []);
        if ($err) fail($err, 422);
        json_out(['ok' => true, 'url' => $url]);

    default:
        fail('Неизвестное действие', 404);
}
