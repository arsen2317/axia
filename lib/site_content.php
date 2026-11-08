<?php
/* Тексты сайта, которые меняются в админке: контакты (подвал, «Команда») и политика обработки персональных данных.
   Хранятся в data/settings.php (contacts) и data/privacy.php; пока в админке ничего не сохраняли — значения по умолчанию
   отсюда и из lib/privacy-default.php (не из config: файл настроек на хостинге не обновляется вместе с сайтом). */
declare(strict_types=1);
defined('ROOT') || exit;

const CONTACTS_DEFAULT = [
    'email' => 'hello@axiagroup.ru',
    'phone' => '',
    'telegram' => 'https://t.me/axialogia',
    'team' => ['klopatkina@axiagroup.ru', 'akosko@axiagroup.ru', 'dstasova@axiagroup.ru'],
];
/* подписи почт команды — в том же порядке, что карточки в «Команде» (index.html) */
const CONTACTS_TEAM = ['Ксения Лопаткина', 'Андрей Косько', 'Диана Стасова'];

function contacts(): array
{
    $c = settings()['contacts'] ?? null;
    if (!is_array($c)) return CONTACTS_DEFAULT;
    [$n] = contacts_normalize($c + CONTACTS_DEFAULT);
    return $n ?? CONTACTS_DEFAULT;
}

/** Проверка из админки: [контакты, null] или [null, ошибка] */
function contacts_normalize(array $in): array
{
    $email = trim((string)($in['email'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return [null, 'Почта: проверьте адрес'];
    $phone = trim(preg_replace('/\s+/u', ' ', (string)($in['phone'] ?? '')) ?? '');
    if ($phone !== '' && (!preg_match('/^\+?[0-9 ()\-]{6,24}$/', $phone) || strlen(preg_replace('/\D/', '', $phone)) < 6)) return [null, 'Телефон: только цифры, пробелы, скобки, дефис и + в начале'];
    $tg = trim((string)($in['telegram'] ?? ''));
    if ($tg !== '') {
        if (preg_match('/^@?([a-z0-9_]{4,32})$/i', $tg, $m)) $tg = 'https://t.me/' . $m[1];
        if (!preg_match('#^https://(t\.me|telegram\.me)/[a-z0-9_+/-]{2,64}$#i', $tg)) return [null, 'Телеграм: ссылка вида https://t.me/имя или @имя'];
    }
    $team = [];
    foreach (array_values((array)($in['team'] ?? [])) as $i => $m) {
        if ($i >= count(CONTACTS_TEAM)) break;
        $m = trim((string)$m);
        if ($m !== '' && !filter_var($m, FILTER_VALIDATE_EMAIL)) return [null, 'Почта (' . CONTACTS_TEAM[$i] . '): проверьте адрес'];
        $team[] = $m;
    }
    while (count($team) < count(CONTACTS_TEAM)) $team[] = '';
    return [['email' => $email, 'phone' => $phone, 'telegram' => $tg, 'team' => $team], null];
}

/** Телефон для ссылки tel: — только цифры и + */
function phone_href(string $phone): string
{
    $d = preg_replace('/[^0-9+]/', '', $phone) ?? '';
    if ($d !== '' && $d[0] === '8' && strlen($d) === 11) $d = '+7' . substr($d, 1);
    return $d;
}

/* ---- Политика обработки персональных данных ---- */

function privacy_doc(): array
{
    $d = read_json(DATA . '/privacy.php', null);
    if (is_array($d) && is_string($d['text'] ?? null) && trim($d['text']) !== '') return $d;
    return ['text' => (string)require ROOT . '/lib/privacy-default.php', 'updated_at' => ''];
}

function privacy_save(string $text): ?string
{
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    if (trim($text) === '') return 'Текст политики не может быть пустым';
    if (mb_strlen($text) > 200000) return 'Слишком длинный текст';
    write_json(DATA . '/privacy.php', ['text' => $text, 'updated_at' => date('c')]);
    return null;
}

/** Отпечаток текущей редакции политики — пишется в журнал согласий */
function privacy_hash(): string
{
    return substr(hash('sha256', privacy_doc()['text']), 0, 16);
}

/** Текст политики → HTML: «## » раздел, «### » подраздел, пустая строка — новый абзац, **жирный**, [ссылка](адрес).
    Абзац «Редакция от …» — дата редакции (серым) */
function privacy_html(string $text): string
{
    require_once ROOT . '/lib/articles.php';
    $out = '';
    foreach (preg_split("/\n\s*\n/", str_replace(["\r\n", "\r"], "\n", $text)) as $para) {
        $p = trim($para);
        if ($p === '') continue;
        if (preg_match('/^###\s+(.+)$/su', $p, $m)) $out .= '<h3>' . inline_md(trim($m[1])) . "</h3>\n";
        elseif (preg_match('/^##\s+(.+)$/su', $p, $m)) $out .= '<h2>' . inline_md(trim($m[1])) . "</h2>\n";
        elseif (preg_match('/^Редакция\s/u', $p)) $out .= '<p class="doc__date">' . inline_md($p) . "</p>\n";
        else $out .= '<p>' . inline_md($p) . "</p>\n";
    }
    return $out;
}
