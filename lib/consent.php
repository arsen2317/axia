<?php
/*
 * Журнал согласий на обработку персональных данных.
 * Каждая отправка формы с отмеченным согласием добавляет строку в data/consents/YYYY-MM.php (одна JSON-запись на строку,
 * первая строка файла — <?php exit; ?>, как у остальных файлов данных). Записываются: время, форма, имя, почта, телефон,
 * IP и браузер посетителя, страница, с которой отправлена форма, и отпечаток (SHA-256) текста политики,
 * действовавшего в этот момент — так видно, с какой именно редакцией политики согласился человек.
 * Выгрузка в CSV — в админке (/admin/consents.php).
 */
declare(strict_types=1);

function consent_doc_hash(string $file): string
{
    $path = ROOT . '/' . $file;
    if (!is_file($path)) return '';
    $html = (string)file_get_contents($path);
    /* хэшируем только текст документа (<main>), чтобы правки шапки или подвала не меняли отпечаток */
    if (preg_match('#<main\b.*?</main>#s', $html, $m)) $html = $m[0];
    return substr(hash('sha256', $html), 0, 16);
}

function consent_log(string $form, string $name, string $email, string $phone): void
{
    $ref = (string)($_SERVER['HTTP_REFERER'] ?? '');
    $rec = [
        'at' => date('c'),
        'form' => $form,
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'ip' => client_ip(),
        'ua' => mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300),
        'page' => mb_substr($ref, 0, 300),
        'privacy_doc' => '/privacy#' . consent_doc_hash('privacy.html'),
    ];
    $dir = DATA . '/consents';
    ensure_dir($dir);
    $f = $dir . '/' . date('Y-m') . '.php';
    $line = json_encode($rec, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    $h = @fopen($f, 'c+');
    if (!$h) { log_error('consent_log: не удалось открыть ' . $f); return; }
    flock($h, LOCK_EX);
    fseek($h, 0, SEEK_END);
    if (ftell($h) === 0) fwrite($h, DATA_GUARD);
    fwrite($h, $line);
    fflush($h);
    flock($h, LOCK_UN);
    fclose($h);
}

/** Все записи журнала, новые сверху */
function consent_all(): array
{
    $out = [];
    foreach (glob(DATA . '/consents/*.php') ?: [] as $f) {
        foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            if ($line === trim(DATA_GUARD)) continue;
            $r = json_decode($line, true);
            if (is_array($r)) $out[] = $r;
        }
    }
    usort($out, fn($a, $b) => strcmp((string)$b['at'], (string)$a['at']));
    return $out;
}
