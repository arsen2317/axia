<?php
/* Статьи (новости): хранение в data/articles/<id>.json, картинки — в uploads/, вывод в HTML. */
declare(strict_types=1);
defined('ROOT') || exit;

const ARTICLE_DIR = DATA . '/articles';

function articles_all(): array
{
    $out = [];
    foreach (glob(ARTICLE_DIR . '/*.php') ?: [] as $f) {
        $a = read_json($f, null);
        if (is_array($a) && isset($a['id'])) $out[] = $a;
    }
    usort($out, fn($a, $b) => strcmp((string)($b['published_at'] ?? $b['updated_at'] ?? ''), (string)($a['published_at'] ?? $a['updated_at'] ?? '')));
    return $out;
}

function articles_published(): array
{
    $today = date('Y-m-d');
    return array_values(array_filter(articles_all(), fn($a) => ($a['status'] ?? '') === 'published' && ($a['published_at'] ?? '') <= $today));
}

function article_get(string $id): ?array
{
    if (!preg_match('/^[a-f0-9]{16}$/', $id)) return null;
    $a = read_json(ARTICLE_DIR . '/' . $id . '.php', null);
    return is_array($a) ? $a : null;
}

function article_by_slug(string $slug): ?array
{
    foreach (articles_published() as $a) if ($a['slug'] === $slug) return $a;
    return null;
}

function article_delete(string $id): void
{
    $a = article_get($id);
    if (!$a) return;
    @unlink(ARTICLE_DIR . '/' . $id . '.php');
    /* картинки статьи больше нигде не используются — удаляем файлы */
    foreach (article_images($a) as $url) upload_delete($url);
}

function article_images(array $a): array
{
    $urls = [];
    if (!empty($a['cover'])) $urls[] = $a['cover'];
    foreach ($a['blocks'] ?? [] as $b) if (($b['type'] ?? '') === 'image' && !empty($b['url'])) $urls[] = $b['url'];
    return $urls;
}

function slugify(string $s): string
{
    $map = ['а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd', 'е' => 'e', 'ё' => 'e', 'ж' => 'zh', 'з' => 'z', 'и' => 'i', 'й' => 'y',
        'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n', 'о' => 'o', 'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't', 'у' => 'u', 'ф' => 'f',
        'х' => 'h', 'ц' => 'ts', 'ч' => 'ch', 'ш' => 'sh', 'щ' => 'sch', 'ъ' => '', 'ы' => 'y', 'ь' => '', 'э' => 'e', 'ю' => 'yu', 'я' => 'ya'];
    $s = strtr(mb_strtolower($s), $map);
    $s = trim(preg_replace('/[^a-z0-9]+/', '-', $s) ?? '', '-');
    return substr($s, 0, 80) ?: 'statya';
}

/** Проверка и нормализация данных из редактора; возвращает [article, error] */
function article_normalize(array $in, ?array $old): array
{
    $str = fn($k, $max) => mb_substr(trim((string)($in[$k] ?? '')), 0, $max);
    $title = $str('title', 200);
    if ($title === '') return [null, 'Укажите заголовок'];
    $slug = slugify($str('slug', 80) ?: $title);
    $id = $old['id'] ?? bin2hex(random_bytes(8));
    /* адрес статьи должен быть уникальным */
    foreach (articles_all() as $a) if ($a['id'] !== $id && $a['slug'] === $slug) $slug .= '-' . substr($id, 0, 4);
    $date = $str('published_at', 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $date = date('Y-m-d');
    $blocks = [];
    foreach ((array)($in['blocks'] ?? []) as $b) {
        if (!is_array($b)) continue;
        $type = (string)($b['type'] ?? '');
        if (in_array($type, ['text', 'heading', 'quote'], true)) {
            $text = mb_substr(trim((string)($b['text'] ?? '')), 0, 20000);
            if ($text !== '') $blocks[] = ['type' => $type, 'text' => $text];
        } elseif ($type === 'image') {
            $url = (string)($b['url'] ?? '');
            if (is_upload_url($url)) $blocks[] = ['type' => 'image', 'url' => $url, 'caption' => mb_substr(trim((string)($b['caption'] ?? '')), 0, 500)];
        }
        if (count($blocks) >= 200) break;
    }
    $cover = (string)($in['cover'] ?? '');
    $a = [
        'id' => $id,
        'slug' => $slug,
        'title' => $title,
        'description' => $str('description', 600),
        'author' => $str('author', 120),
        'cover' => is_upload_url($cover) ? $cover : '',
        'cover_alt' => $str('cover_alt', 200),
        'blocks' => $blocks,
        'status' => ($in['status'] ?? '') === 'published' ? 'published' : 'draft',
        'published_at' => $date,
        'created_at' => $old['created_at'] ?? date('c'),
        'updated_at' => date('c'),
    ];
    return [$a, null];
}

function article_save(array $a, ?array $old): void
{
    write_json(ARTICLE_DIR . '/' . $a['id'] . '.php', $a);
    /* картинки, которые убрали из статьи, удаляем с диска */
    if ($old) foreach (array_diff(article_images($old), article_images($a)) as $url) upload_delete($url);
}

/* ---------- Картинки ---------- */

function is_upload_url(string $url): bool
{
    return (bool)preg_match('#^/uploads/\d{4}/[a-f0-9]{20}\.(?:jpg|webp|png)$#', $url);
}

function upload_delete(string $url): void
{
    if (is_upload_url($url)) @unlink(ROOT . $url);
}

/** Принимает загруженный файл, пересохраняет через GD (это убирает всё, кроме самой картинки), возвращает URL или ошибку */
function upload_image(array $file): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) return [null, 'Файл не загрузился (возможно, он больше лимита хостинга)'];
    if (!is_uploaded_file($file['tmp_name'] ?? '')) return [null, 'Файл не загрузился'];
    if ($file['size'] > 15 * 1024 * 1024) return [null, 'Файл больше 15 МБ'];
    $info = @getimagesize($file['tmp_name']);
    $types = [IMAGETYPE_JPEG => 'jpeg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($types[$info[2]])) return [null, 'Нужна картинка JPG, PNG или WebP'];
    [$w, $h] = $info;
    if ($w < 1 || $h < 1 || $w * $h > 40_000_000) return [null, 'Слишком большое разрешение (максимум 40 мегапикселей)'];
    $src = match ($types[$info[2]]) {
        'jpeg' => @imagecreatefromjpeg($file['tmp_name']),
        'png' => @imagecreatefrompng($file['tmp_name']),
        'webp' => @imagecreatefromwebp($file['tmp_name']),
    };
    if (!$src) return [null, 'Не удалось прочитать картинку'];
    if ($types[$info[2]] === 'jpeg' && function_exists('exif_read_data')) {
        /* поворот по EXIF (фото с телефона) */
        $o = (int)(@exif_read_data($file['tmp_name'])['Orientation'] ?? 1);
        $deg = [3 => 180, 6 => -90, 8 => 90][$o] ?? 0;
        if ($deg) { $src = imagerotate($src, $deg, 0); $w = imagesx($src); $h = imagesy($src); }
    }
    $max = 2000;
    if ($w > $max) {
        $nh = (int)round($h * $max / $w);
        $dst = imagecreatetruecolor($max, $nh);
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $max, $nh, $w, $h);
        imagedestroy($src);
        $src = $dst;
    }
    $dir = '/uploads/' . date('Y');
    ensure_dir(ROOT . $dir);
    $name = bin2hex(random_bytes(10));
    if (function_exists('imagewebp')) {
        imagesavealpha($src, true);
        $url = "$dir/$name.webp";
        $ok = imagewebp($src, ROOT . $url, 82);
    } else {
        $url = "$dir/$name.jpg";
        $ok = imagejpeg($src, ROOT . $url, 85);
    }
    imagedestroy($src);
    return $ok ? [$url, null] : [null, 'Не удалось сохранить картинку'];
}

/* ---------- Вывод ---------- */

/** Текст абзаца: **жирный**, *курсив*, [ссылка](https://…); пустая строка — новый абзац, перенос строки — <br> */
function inline_md(string $s): string
{
    $s = h($s);
    $s = preg_replace('/\*\*(.+?)\*\*/su', '<strong>$1</strong>', $s) ?? $s;
    $s = preg_replace('/(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])/su', '<em>$1</em>', $s) ?? $s;
    $s = preg_replace_callback('/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|mailto:[^\s)]+)\)/u', function ($m) {
        $ext = str_starts_with($m[2], 'http') ? ' target="_blank" rel="noopener"' : '';
        return '<a href="' . $m[2] . '"' . $ext . '>' . $m[1] . '</a>';
    }, $s) ?? $s;
    return nl2br($s, false);
}

function render_blocks(array $blocks): string
{
    $out = '';
    foreach ($blocks as $b) {
        switch ($b['type']) {
            case 'heading':
                $out .= '<h2>' . h($b['text']) . "</h2>\n";
                break;
            case 'quote':
                $out .= '<blockquote><p>' . inline_md($b['text']) . "</p></blockquote>\n";
                break;
            case 'image':
                $out .= '<figure><img src="' . h($b['url']) . '" alt="' . h($b['caption'] ?: '') . '" loading="lazy" decoding="async">'
                    . ($b['caption'] !== '' ? '<figcaption>' . h($b['caption']) . '</figcaption>' : '') . "</figure>\n";
                break;
            default:
                foreach (preg_split("/\n\s*\n/", $b['text']) as $para) if (trim($para) !== '') $out .= '<p>' . inline_md(trim($para)) . "</p>\n";
        }
    }
    return $out;
}

function ru_date(string $ymd): string
{
    $months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    $d = DateTimeImmutable::createFromFormat('!Y-m-d', $ymd);
    return $d ? (int)$d->format('j') . ' ' . $months[(int)$d->format('n') - 1] . ' ' . $d->format('Y') : $ymd;
}
