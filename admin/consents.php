<?php
/* Админка: выгрузка журнала согласий на обработку персональных данных в CSV (открывается в Excel) */
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/admin.php';
require __DIR__ . '/../lib/consent.php';
admin_session();
if (!admin_logged_in()) { header('Location: /admin/'); exit; }
if (!hash_equals(csrf_token(), (string)($_GET['t'] ?? ''))) { http_response_code(403); exit('Страница устарела, обновите админку'); }

$rows = consent_all();
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="consents-' . date('Y-m-d') . '.csv"');
header('Cache-Control: no-store');
$out = fopen('php://output', 'w');
fwrite($out, "\xEF\xBB\xBF");   /* BOM — чтобы Excel открыл кириллицу правильно */
$cols = ['at' => 'Дата и время', 'form' => 'Форма', 'name' => 'Имя', 'email' => 'Почта', 'phone' => 'Телефон', 'ip' => 'IP', 'ua' => 'Браузер', 'page' => 'Страница', 'privacy_doc' => 'Политика (редакция)'];
$forms = ['contact' => 'напишите нам', 'booking' => 'запись на встречу'];
fputcsv($out, array_values($cols), ';', '"', '');
foreach ($rows as $r) {
    $line = [];
    foreach (array_keys($cols) as $k) {
        $v = (string)($r[$k] ?? '');
        if ($k === 'form') $v = $forms[$v] ?? $v;
        if ($v !== '' && strpbrk($v[0], '=+-@') !== false) $v = "'" . $v;   /* защита от формул в Excel */
        $line[] = $v;
    }
    fputcsv($out, $line, ';', '"', '');
}
fclose($out);
