<?php
/* Внутренние страницы (новости, статья, служебные): та же шапка и тот же подвал, что на главной.
   Разметка шапки и подвала — в lib/partials/, стили — общие с главной (site.css, page.css) плюс pages.css для содержимого. */
declare(strict_types=1);
defined('ROOT') || exit;

/* Основной адрес сайта для поисковиков (canonical, og:url) — всегда боевой домен, в том числе на тестовом поддомене */
const CANONICAL_BASE = 'https://axiagroup.ru';

/** Шапка страницы (<head> и шапка сайта). $navLabel — подпись в свёрнутом меню.
    $meta: path — адрес страницы для поисковиков (/privacy, /news/…), image — картинка для превью, type — website|article,
    body_attr — атрибуты <body> (например ' data-nav="pinned"') */
function page_head_html(string $title, string $description = '', string $navLabel = '', array $meta = []): string
{
    $t = h($title);
    $path = (string)($meta['path'] ?? '');
    $image = (string)($meta['image'] ?? '') ?: '/assets/img/og.png';
    $imageUrl = str_starts_with($image, '/assets/') ? CANONICAL_BASE . $image : site_url($image);
    $css = '';
    foreach (['fonts', 'site', 'page', 'pages'] as $c) $css .= '<link rel="stylesheet" href="' . h(asset("/assets/css/$c.css")) . '">' . "\n";
    return '<!doctype html>' . "\n" . '<html lang="ru">' . "\n" . '<head>' . "\n"
        . '<meta charset="utf-8">' . "\n"
        . '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' . "\n"
        . '<title>' . $t . '</title>' . "\n"
        . ($description !== '' ? '<meta name="description" content="' . h($description) . '">' . "\n" : '')
        . ($path !== '' ? '<link rel="canonical" href="' . h(CANONICAL_BASE . $path) . '">' . "\n" . '<meta property="og:url" content="' . h(CANONICAL_BASE . $path) . '">' . "\n" : '')
        . '<meta property="og:type" content="' . h((string)($meta['type'] ?? 'website')) . '">' . "\n"
        . '<meta property="og:site_name" content="аксиа">' . "\n"
        . '<meta property="og:locale" content="ru_RU">' . "\n"
        . '<meta property="og:title" content="' . $t . '">' . "\n"
        . ($description !== '' ? '<meta property="og:description" content="' . h($description) . '">' . "\n" : '')
        . '<meta property="og:image" content="' . h($imageUrl) . '">' . "\n"
        . '<meta name="twitter:card" content="summary_large_image">' . "\n"
        . '<link rel="icon" href="/favicon.ico" sizes="32x32">' . "\n" . '<link rel="icon" href="/favicon.svg" type="image/svg+xml">' . "\n" . '<link rel="apple-touch-icon" href="/apple-touch-icon.png">' . "\n"
        . $css
        . '</head>' . "\n" . '<body class="pg"' . (string)($meta['body_attr'] ?? '') . '>' . "\n"
        . '<div class="axia is-top pg-axia">' . "\n"
        . site_header_html($navLabel);
}

function site_header_html(string $navLabel): string
{
    $html = (string)file_get_contents(ROOT . '/lib/partials/header.html');
    $html = preg_replace('/^<!--.*?-->\n/s', '', $html) ?? $html;
    return str_replace('%NAV_LABEL%', h($navLabel), $html);
}

/** Подвал: контакты — из админки (lib/site_content.php) */
function site_footer_html(): string
{
    require_once ROOT . '/lib/site_content.php';
    $c = contacts();
    $html = (string)file_get_contents(ROOT . '/lib/partials/footer.html');
    $html = preg_replace('/^<!--.*?-->\n/s', '', $html) ?? $html;
    /* необязательные пункты: <!--if:phone-->…<!--/if:phone--> убираются, если значение пустое */
    $html = preg_replace_callback('#<!--if:(\w+)-->(.*?)<!--/if:\1-->#s', fn($m) => ($c[$m[1]] ?? '') !== '' ? $m[2] : '', $html) ?? $html;
    return strtr($html, [
        '%EMAIL%' => h($c['email']),
        '%TELEGRAM%' => h($c['telegram']),
        '%PHONE%' => h($c['phone']),
        '%PHONE_HREF%' => h(phone_href($c['phone'])),
    ]);
}

function page_foot_html(): string
{
    $js = '';
    foreach (['inner', 'typograph', 'cookies', 'metrika'] as $j) $js .= '<script src="' . h(asset("/assets/js/$j.js")) . '"></script>' . "\n";
    return site_footer_html() . '</div>' . "\n" . $js . '</body>' . "\n" . '</html>' . "\n";
}

function page_open(string $title, string $description = '', array $meta = []): void
{
    header('Content-Type: text/html; charset=utf-8');
    security_headers();
    echo page_head_html($title, $description, (string)($meta['label'] ?? ''), $meta);
}

function page_close(): void
{
    echo page_foot_html();
}
