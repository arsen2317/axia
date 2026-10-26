<?php
/* Общая шапка и подвал для страниц «Новости», статей и служебных страниц */
declare(strict_types=1);
defined('ROOT') || exit;

function page_open(string $title, string $description = '', array $meta = []): void
{
    header('Content-Type: text/html; charset=utf-8');
    security_headers();
    $t = h($title);
    echo '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . $t . '</title>'
        . ($description !== '' ? '<meta name="description" content="' . h($description) . '">' : '')
        . '<meta property="og:title" content="' . $t . '">'
        . ($description !== '' ? '<meta property="og:description" content="' . h($description) . '">' : '')
        . (!empty($meta['image']) ? '<meta property="og:image" content="' . h(site_url($meta['image'])) . '">' : '')
        . '<link rel="stylesheet" href="/assets/css/fonts.css"><link rel="stylesheet" href="/assets/css/pages.css"></head><body class="pg">';
    page_header($meta['active'] ?? '');
}

function page_header(string $active = ''): void
{
    $items = ['/#who' => 'о нас', '/#directions' => 'направления', '/#solutions' => 'решения', '/#team' => 'команда', '/news' => 'новости'];
    echo '<header class="pg-head"><a class="pg-logo" href="/" aria-label="аксиа — на главную"><svg class="pg-logo__mark" viewBox="0 0 20 24" fill="currentColor" aria-hidden="true"><path d="M18.6973 0.181152C19.231 0.181152 19.664 0.613285 19.6641 1.14697V6.06494H18.0332V5.76807C18.0332 4.45692 16.9703 3.39404 15.6592 3.39404H4.3457C3.03457 3.39405 1.97168 4.45693 1.97168 5.76807V6.06494H0.263672V1.14697C0.263733 0.613284 0.696766 0.181152 1.23047 0.181152H18.6973Z"></path><path d="M0.966797 23.7444C0.433176 23.7444 0.000193059 23.3121 5.56181e-08 22.7786L4.02869e-07 16.7483L1.22559 16.7483L1.22559 17.2668C1.22559 18.9877 2.62092 20.3831 4.3418 20.3831L15.4697 20.3831C17.1906 20.3831 18.5859 18.9877 18.5859 17.2668L18.5859 16.7483L19.8457 16.7483L19.8457 22.7786C19.8455 23.3121 19.4125 23.7444 18.8789 23.7444L0.966797 23.7444Z"></path><path d="M16.0264 15.8191H14.8779V15.2634C14.8778 14.3623 14.1473 13.6318 13.2461 13.6316H6.67969C5.77852 13.6318 5.04802 14.3623 5.04785 15.2634V15.8191H3.93359V7.99292H4.96973V8.47534C4.9699 9.3765 5.7004 10.107 6.60156 10.1072H13.2422C14.1434 10.107 14.8739 9.3765 14.874 8.47534V7.99292H16.0264V15.8191Z"></path></svg><span>аксиа</span></a><nav class="pg-nav" aria-label="Разделы сайта"><ul>';
    foreach ($items as $href => $label) echo '<li><a href="' . $href . '"' . ($href === $active ? ' aria-current="page"' : '') . '>' . $label . '</a></li>';
    echo '</ul></nav><a class="pg-cta" href="/#contact">обсудить&nbsp;задачу</a></header>';
}

function page_close(): void
{
    echo '<footer class="pg-foot"><ul><li>ООО «Аксиа Консалтинг»</li><li>ОГРН 1267700204496</li><li>ИНН 9731164515</li></ul>'
        . '<ul><li><a href="/privacy">политика конфиденциальности</a></li><li><a href="/consent">согласие на обработку персональных данных</a></li><li>©&nbsp;' . date('Y') . ' axiagroup.ru</li></ul></footer></body></html>';
}
