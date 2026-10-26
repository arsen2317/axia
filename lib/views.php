<?php
/* Внутренние страницы (новости, статья, служебные): та же шапка и тот же подвал, что на главной.
   Разметка шапки и подвала — в lib/partials/, стили — общие с главной (site.css, page.css) плюс pages.css для содержимого. */
declare(strict_types=1);
defined('ROOT') || exit;

/** Шапка страницы (<head> и шапка сайта). $navLabel — подпись в свёрнутом меню */
function page_head_html(string $title, string $description = '', string $navLabel = '', string $ogImage = ''): string
{
    $t = h($title);
    return '<!doctype html>' . "\n" . '<html lang="ru">' . "\n" . '<head>' . "\n"
        . '<meta charset="utf-8">' . "\n"
        . '<meta name="viewport" content="width=device-width, initial-scale=1">' . "\n"
        . '<title>' . $t . '</title>' . "\n"
        . ($description !== '' ? '<meta name="description" content="' . h($description) . '">' . "\n" : '')
        . '<meta property="og:title" content="' . $t . '">' . "\n"
        . ($description !== '' ? '<meta property="og:description" content="' . h($description) . '">' . "\n" : '')
        . ($ogImage !== '' ? '<meta property="og:image" content="' . h(site_url($ogImage)) . '">' . "\n" : '')
        . '<link rel="stylesheet" href="/assets/css/fonts.css">' . "\n"
        . '<link rel="stylesheet" href="/assets/css/site.css">' . "\n"
        . '<link rel="stylesheet" href="/assets/css/page.css">' . "\n"
        . '<link rel="stylesheet" href="/assets/css/pages.css">' . "\n"
        . '</head>' . "\n" . '<body class="pg">' . "\n"
        . '<div class="axia is-top pg-axia">' . "\n"
        . site_header_html($navLabel);
}

function site_header_html(string $navLabel): string
{
    $html = (string)file_get_contents(ROOT . '/lib/partials/header.html');
    $html = preg_replace('/^<!--.*?-->\n/s', '', $html) ?? $html;
    return str_replace('%NAV_LABEL%', h($navLabel), $html);
}

function site_footer_html(): string
{
    $html = (string)file_get_contents(ROOT . '/lib/partials/footer.html');
    return preg_replace('/^<!--.*?-->\n/s', '', $html) ?? $html;
}

function page_foot_html(): string
{
    return site_footer_html() . '</div>' . "\n"
        . '<script src="/assets/js/inner.js"></script>' . "\n"
        . '<script src="/assets/js/typograph.js"></script>' . "\n"
        . '</body>' . "\n" . '</html>' . "\n";
}

function page_open(string $title, string $description = '', array $meta = []): void
{
    header('Content-Type: text/html; charset=utf-8');
    security_headers();
    echo page_head_html($title, $description, (string)($meta['label'] ?? ''), (string)($meta['image'] ?? ''));
}

function page_close(): void
{
    echo page_foot_html();
}
