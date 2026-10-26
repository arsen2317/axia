<?php
/*
 * Бронирование встреч: свободные слоты по рабочим часам минус занятое время в Яндекс Календаре (CalDAV),
 * создание конференции в Яндекс Телемосте, событие в календаре, хранение броней (без персональных данных — только хэши).
 */
declare(strict_types=1);

function tz(): DateTimeZone
{
    return new DateTimeZone((string)cfg('timezone', 'Europe/Moscow'));
}

function utc(): DateTimeZone
{
    return new DateTimeZone('UTC');
}

/* ================= Слоты ================= */

/** Все слоты по правилам (без учёта занятости): [[start DateTimeImmutable, end], …] */
function rule_slots(?DateTimeImmutable $now = null): array
{
    $now = $now ?? new DateTimeImmutable('now', tz());
    $dur = max(5, (int)cfg('booking.duration_min', 30));
    $step = max(5, (int)cfg('booking.step_min', 30));
    $earliest = $now->modify('+' . (int)cfg('booking.min_notice_hours', 12) . ' hours');
    $hours = (array)cfg('booking.hours', []);
    $holidays = array_flip((array)cfg('booking.holidays', []));
    $out = [];
    $day = $now->setTime(0, 0);
    for ($i = 0; $i <= (int)cfg('booking.horizon_days', 60); $i++, $day = $day->modify('+1 day')) {
        if (isset($holidays[$day->format('Y-m-d')])) continue;
        foreach ((array)($hours[(int)$day->format('N')] ?? []) as $win) {
            [$a, $b] = $win;
            [$ah, $am] = array_map('intval', explode(':', $a));
            [$bh, $bm] = array_map('intval', explode(':', $b));
            $winEnd = $day->setTime($bh, $bm);
            for ($s = $day->setTime($ah, $am); $s->modify("+$dur minutes") <= $winEnd; $s = $s->modify("+$step minutes")) {
                if ($s < $earliest) continue;
                $out[] = [$s, $s->modify("+$dur minutes")];
            }
        }
    }
    return $out;
}

/** Свободные слоты: правила минус занятость календаря и уже созданные брони */
function free_slots(bool $fresh = false): array
{
    $slots = rule_slots();
    if (!$slots) return [];
    $from = $slots[0][0];
    $to = end($slots)[1];
    $busy = array_merge(calendar_busy($from, $to, $fresh), bookings_busy());
    $buf = (int)cfg('booking.buffer_min', 0) * 60;
    return array_values(array_filter($slots, function ($s) use ($busy, $buf) {
        $a = $s[0]->getTimestamp() - $buf;
        $b = $s[1]->getTimestamp() + $buf;
        foreach ($busy as [$x, $y]) if ($x < $b && $y > $a) return false;
        return true;
    }));
}

/* ================= Брони (data/bookings.json) ================= */

function bookings(): array
{
    return read_json(DATA . '/bookings.json', []);
}

function save_bookings(array $b): void
{
    /* старые (прошедшие больше 30 дней назад) записи удаляем */
    $cut = time() - 30 * 86400;
    write_json(DATA . '/bookings.json', array_values(array_filter($b, fn($x) => ($x['end'] ?? 0) > $cut)));
}

function bookings_busy(): array
{
    $out = [];
    foreach (bookings() as $b) if (in_array($b['status'] ?? '', ['active', 'pending'], true)) $out[] = [(int)$b['start'], (int)$b['end']];
    return $out;
}

/* ================= Яндекс Календарь (CalDAV) ================= */

function caldav_enabled(): bool
{
    return cfg('caldav.url') !== '' && cfg('caldav.login') !== '' && cfg('caldav.password') !== '';
}

function caldav_request(string $method, string $url, ?string $body, array $headers = []): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_USERPWD => cfg('caldav.login') . ':' . cfg('caldav.password'),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    $res = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return [$code, is_string($res) ? $res : '', $err];
}

/** Занятые интервалы календаря [[startTs, endTs], …]; кэш 60 секунд, чтобы не нагружать Яндекс при каждом открытии страницы */
function calendar_busy(DateTimeImmutable $from, DateTimeImmutable $to, bool $fresh = false): array
{
    if (!caldav_enabled()) return [];
    $cacheFile = DATA . '/cache/busy.json';
    $cache = read_json($cacheFile, []);
    if (!$fresh && isset($cache['at'], $cache['busy']) && $cache['at'] > time() - 60) return $cache['busy'];

    $f = $from->setTimezone(utc())->format('Ymd\THis\Z');
    $t = $to->setTimezone(utc())->format('Ymd\THis\Z');
    $xml = '<?xml version="1.0" encoding="utf-8"?>'
        . '<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">'
        . '<D:prop><C:calendar-data/></D:prop>'
        . '<C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT">'
        . '<C:time-range start="' . $f . '" end="' . $t . '"/>'
        . '</C:comp-filter></C:comp-filter></C:filter></C:calendar-query>';
    [$code, $res, $err] = caldav_request('REPORT', (string)cfg('caldav.url'), $xml, ['Depth: 1', 'Content-Type: application/xml; charset=utf-8']);
    if ($code !== 207) {
        log_error("caldav REPORT: HTTP $code $err " . substr($res, 0, 300));
        /* календарь недоступен: если есть старый кэш — используем его, иначе считаем занятым весь период, чтобы не было двойных броней */
        if (isset($cache['busy'])) return $cache['busy'];
        return [[$from->getTimestamp(), $to->getTimestamp()]];
    }
    $busy = [];
    preg_match_all('#<(?:[a-z0-9]+:)?calendar-data[^>]*>(.*?)</(?:[a-z0-9]+:)?calendar-data>#si', $res, $m);
    foreach ($m[1] as $data) {
        $ics = html_entity_decode(str_replace(['<![CDATA[', ']]>'], '', $data), ENT_QUOTES | ENT_XML1, 'UTF-8');
        foreach (ics_busy($ics, $from->getTimestamp(), $to->getTimestamp()) as $iv) $busy[] = $iv;
    }
    write_json($cacheFile, ['at' => time(), 'busy' => $busy]);
    return $busy;
}

function calendar_cache_clear(): void
{
    @unlink(DATA . '/cache/busy.json');
}

/** Разбор iCalendar: занятые интервалы событий, включая простые повторения (DAILY / WEEKLY с BYDAY, INTERVAL, COUNT, UNTIL, EXDATE) */
function ics_busy(string $ics, int $rangeFrom, int $rangeTo): array
{
    $ics = preg_replace("/\r?\n[ \t]/", '', $ics) ?? $ics;   /* склейка перенесённых строк */
    $out = [];
    preg_match_all('/BEGIN:VEVENT(.*?)END:VEVENT/s', $ics, $evs);
    foreach ($evs[1] as $ev) {
        $p = [];
        foreach (preg_split("/\r?\n/", trim($ev)) as $line) {
            if (!preg_match('/^([A-Z-]+)((?:;[^:]*)?):(.*)$/', $line, $mm)) continue;
            $p[$mm[1]][] = ['params' => $mm[2], 'value' => $mm[3]];
        }
        if (strtoupper($p['TRANSP'][0]['value'] ?? '') === 'TRANSPARENT') continue;      /* «свободен» */
        if (strtoupper($p['STATUS'][0]['value'] ?? '') === 'CANCELLED') continue;
        if (!isset($p['DTSTART'])) continue;
        [$start, $allDay] = ics_time($p['DTSTART'][0]);
        if ($start === null) continue;
        if (isset($p['DTEND'])) [$end] = ics_time($p['DTEND'][0]);
        elseif (isset($p['DURATION'])) $end = $start + ics_duration($p['DURATION'][0]['value']);
        else $end = $start + ($allDay ? 86400 : 0);
        if ($end === null || $end <= $start) $end = $start + ($allDay ? 86400 : 1800);
        $len = $end - $start;

        $starts = [$start];
        if (isset($p['RRULE'])) $starts = ics_expand($start, $p['RRULE'][0]['value'], $rangeTo);
        $ex = [];
        foreach ($p['EXDATE'] ?? [] as $exd) foreach (explode(',', $exd['value']) as $v) {
            [$t] = ics_time(['params' => $exd['params'], 'value' => $v]);
            if ($t !== null) $ex[$t] = true;
        }
        foreach ($starts as $s) {
            if (isset($ex[$s])) continue;
            if ($s < $rangeTo && $s + $len > $rangeFrom) $out[] = [$s, $s + $len];
        }
    }
    return $out;
}

/** [timestamp|null, allDay] */
function ics_time(array $prop): array
{
    $v = trim($prop['value']);
    $params = $prop['params'];
    if (preg_match('/^(\d{8})$/', $v) || stripos($params, 'VALUE=DATE') !== false && strlen($v) === 8) {
        $d = DateTimeImmutable::createFromFormat('!Ymd', substr($v, 0, 8), tz());
        return [$d ? $d->getTimestamp() : null, true];
    }
    if (str_ends_with($v, 'Z')) {
        $d = DateTimeImmutable::createFromFormat('Ymd\THis\Z', $v, utc());
        return [$d ? $d->getTimestamp() : null, false];
    }
    $zone = tz();
    if (preg_match('/TZID=("?)([^;:"]+)\1/', $params, $m)) {
        try { $zone = new DateTimeZone($m[2]); } catch (Throwable $e) { /* нестандартное имя зоны — считаем временем сайта */ }
    }
    $d = DateTimeImmutable::createFromFormat('Ymd\THis', substr($v, 0, 15), $zone);
    return [$d ? $d->getTimestamp() : null, false];
}

function ics_duration(string $v): int
{
    if (!preg_match('/^(-)?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/', $v, $m)) return 0;
    $s = ((int)($m[2] ?? 0)) * 604800 + ((int)($m[3] ?? 0)) * 86400 + ((int)($m[4] ?? 0)) * 3600 + ((int)($m[5] ?? 0)) * 60 + (int)($m[6] ?? 0);
    return ($m[1] ?? '') === '-' ? -$s : $s;
}

function ics_expand(int $start, string $rrule, int $until): array
{
    $r = [];
    foreach (explode(';', $rrule) as $part) {
        [$k, $v] = array_pad(explode('=', $part, 2), 2, '');
        $r[strtoupper($k)] = $v;
    }
    $freq = strtoupper($r['FREQ'] ?? '');
    $interval = max(1, (int)($r['INTERVAL'] ?? 1));
    $count = isset($r['COUNT']) ? (int)$r['COUNT'] : PHP_INT_MAX;
    if (isset($r['UNTIL'])) {
        [$u] = ics_time(['params' => '', 'value' => $r['UNTIL']]);
        if ($u !== null) $until = min($until, $u + 1);
    }
    $base = (new DateTimeImmutable('@' . $start))->setTimezone(tz());
    $out = [];
    if ($freq === 'DAILY') {
        for ($i = 0, $d = $base; $i < $count && $d->getTimestamp() < $until && $i < 2000; $i++, $d = $d->modify("+$interval day")) $out[] = $d->getTimestamp();
    } elseif ($freq === 'WEEKLY') {
        $map = ['MO' => 1, 'TU' => 2, 'WE' => 3, 'TH' => 4, 'FR' => 5, 'SA' => 6, 'SU' => 7];
        $days = [];
        foreach (array_filter(explode(',', strtoupper($r['BYDAY'] ?? ''))) as $bd) if (isset($map[substr($bd, -2)])) $days[] = $map[substr($bd, -2)];
        if (!$days) $days = [(int)$base->format('N')];
        sort($days);
        $weekStart = $base->modify('-' . ((int)$base->format('N') - 1) . ' days');
        $n = 0;
        for ($w = 0; $w < 600 && $n < $count; $w++) {
            $wk = $weekStart->modify('+' . ($w * $interval * 7) . ' days');
            if ($wk->getTimestamp() >= $until) break;
            foreach ($days as $dn) {
                $d = $wk->modify('+' . ($dn - 1) . ' days');
                if ($d < $base) continue;
                if ($d->getTimestamp() >= $until || $n >= $count) break 2;
                $out[] = $d->getTimestamp();
                $n++;
            }
        }
    } elseif ($freq === 'MONTHLY' || $freq === 'YEARLY') {
        $unit = $freq === 'MONTHLY' ? 'month' : 'year';
        for ($i = 0, $d = $base; $i < $count && $d->getTimestamp() < $until && $i < 600; $i++, $d = $base->modify('+' . ($i * $interval) . " $unit")) $out[] = $d->getTimestamp();
    } else {
        $out[] = $start;   /* редкие правила не разворачиваем — учитываем первое вхождение */
    }
    return $out;
}

function caldav_put_event(string $uid, string $ics): bool
{
    if (!caldav_enabled()) return true;
    $url = rtrim((string)cfg('caldav.url'), '/') . '/' . rawurlencode($uid) . '.ics';
    [$code, $res, $err] = caldav_request('PUT', $url, $ics, ['Content-Type: text/calendar; charset=utf-8', 'If-None-Match: *']);
    if ($code >= 200 && $code < 300) {
        calendar_cache_clear();
        return true;
    }
    log_error("caldav PUT: HTTP $code $err " . substr($res, 0, 300));
    return false;
}

function caldav_delete_event(string $uid): void
{
    if (!caldav_enabled()) return;
    $url = rtrim((string)cfg('caldav.url'), '/') . '/' . rawurlencode($uid) . '.ics';
    [$code, $res] = caldav_request('DELETE', $url, null);
    if ($code >= 300 && $code !== 404) log_error("caldav DELETE: HTTP $code " . substr($res, 0, 200));
    calendar_cache_clear();
}

/* ================= Яндекс Телемост ================= */

function telemost_enabled(): bool
{
    return cfg('telemost.oauth_token') !== '';
}

/** ['id' => …, 'join_url' => …] или null */
function telemost_create(): ?array
{
    if (!telemost_enabled()) return ['id' => '', 'join_url' => ''];
    $ch = curl_init('https://cloud-api.yandex.net/v1/telemost-api/conferences');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['access_level' => (string)cfg('telemost.access_level', 'PUBLIC')]),
        CURLOPT_HTTPHEADER => ['Authorization: OAuth ' . cfg('telemost.oauth_token'), 'Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $res = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $d = is_string($res) ? json_decode($res, true) : null;
    if ($code >= 300 || !is_array($d) || empty($d['join_url'])) {
        log_error("telemost create: HTTP $code " . substr((string)$res, 0, 300));
        return null;
    }
    return ['id' => (string)($d['id'] ?? ''), 'join_url' => (string)$d['join_url']];
}

function telemost_delete(string $id): void
{
    if (!telemost_enabled() || $id === '') return;
    $ch = curl_init('https://cloud-api.yandex.net/v1/telemost-api/conferences/' . rawurlencode($id));
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'DELETE',
        CURLOPT_HTTPHEADER => ['Authorization: OAuth ' . cfg('telemost.oauth_token')],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    curl_exec($ch);
    curl_close($ch);
}

/* ================= iCalendar ================= */

function ics_escape(string $s): string
{
    return str_replace(["\\", ";", ",", "\r\n", "\n"], ["\\\\", "\\;", "\\,", "\\n", "\\n"], $s);
}

function ics_fold(string $line): string
{
    /* строки длиннее 75 байт переносим, не разрывая символы UTF-8 */
    $out = '';
    while (strlen($line) > 75) {
        $cut = 75;
        while ($cut > 0 && (ord($line[$cut]) & 0xC0) === 0x80) $cut--;
        $out .= substr($line, 0, $cut) . "\r\n ";
        $line = substr($line, $cut);
    }
    return $out . $line;
}

/** $method = '' для события в своём календаре, 'PUBLISH' — файл-приглашение для клиента */
function build_ics(array $b, string $summary, string $description, string $method = '', bool $cancel = false): string
{
    $fmt = fn(int $ts) => gmdate('Ymd\THis\Z', $ts);
    $lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//axia//site booking//RU', 'CALSCALE:GREGORIAN'];
    if ($method !== '') $lines[] = 'METHOD:' . $method;
    $lines[] = 'BEGIN:VEVENT';
    $lines[] = 'UID:' . $b['uid'];
    $lines[] = 'DTSTAMP:' . $fmt(time());
    $lines[] = 'DTSTART:' . $fmt((int)$b['start']);
    $lines[] = 'DTEND:' . $fmt((int)$b['end']);
    $lines[] = 'SUMMARY:' . ics_escape($summary);
    $lines[] = 'DESCRIPTION:' . ics_escape($description);
    if (!empty($b['join_url'])) {
        $lines[] = 'LOCATION:' . ics_escape('Яндекс Телемост: ' . $b['join_url']);
        $lines[] = 'URL:' . $b['join_url'];
    }
    $lines[] = 'STATUS:' . ($cancel ? 'CANCELLED' : 'CONFIRMED');
    $lines[] = 'SEQUENCE:' . ($cancel ? 1 : 0);
    if (!$cancel) {
        $lines[] = 'BEGIN:VALARM';
        $lines[] = 'TRIGGER:-PT15M';
        $lines[] = 'ACTION:DISPLAY';
        $lines[] = 'DESCRIPTION:' . ics_escape($summary);
        $lines[] = 'END:VALARM';
    }
    $lines[] = 'END:VEVENT';
    $lines[] = 'END:VCALENDAR';
    return implode("\r\n", array_map('ics_fold', $lines)) . "\r\n";
}

/* ================= Подписи ================= */

function ru_when(int $start, int $end): string
{
    $months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    $wd = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
    $a = (new DateTimeImmutable('@' . $start))->setTimezone(tz());
    $b = (new DateTimeImmutable('@' . $end))->setTimezone(tz());
    $zone = (string)cfg('timezone') === 'Europe/Moscow' ? 'по Москве' : (string)cfg('timezone');
    return $wd[(int)$a->format('N') - 1] . ', ' . (int)$a->format('j') . ' ' . $months[(int)$a->format('n') - 1] . ' ' . $a->format('Y')
        . ', ' . $a->format('H:i') . '–' . $b->format('H:i') . ' ' . $zone;
}

/* Отмена брони: удаляем событие в календаре и конференцию, слот снова свободен. true — отменено */
function cancel_booking(string $id, string $by): ?array
{
    $b = with_lock('booking', function () use ($id) {
        $all = bookings();
        $found = null;
        foreach ($all as &$x) if ($x['id'] === $id && ($x['status'] ?? '') === 'active') { $x['status'] = 'cancelled'; $x['cancelled'] = time(); $found = $x; }
        if ($found) save_bookings($all);
        return $found;
    });
    if (!$b) return null;
    caldav_delete_event($b['uid']);
    telemost_delete((string)($b['conf_id'] ?? ''));
    require_once ROOT . '/lib/mail.php';
    $when = ru_when((int)$b['start'], (int)$b['end']);
    send_mail((string)cfg('mail.to'), 'Встреча отменена: ' . $when,
        mail_layout('Встреча отменена', '<p><b>' . h($when) . '</b></p><p>Отменил(а): ' . h($by) . '. Событие удалено из календаря, время снова доступно для записи.</p>'),
        "Встреча отменена\n\n$when\nОтменил(а): $by\n");
    return $b;
}
