<?php
if (PHP_SAPI !== 'cli-server') { http_response_code(404); exit; }
/* Локальный запуск без Apache: php -S localhost:8000 tools/router.php
   Повторяет правила из .htaccess (красивые адреса и закрытые папки). */
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');
$root = dirname(__DIR__);
if (preg_match('#^/(config|lib|data|tools)(/|$)#', $path) || preg_match('#/\.#', $path)) { http_response_code(403); exit('Forbidden'); }
if (preg_match('#^/uploads/.*\.php#i', $path)) { http_response_code(403); exit('Forbidden'); }
if (preg_match('#^/news/?$#', $path)) { require $root . '/news.php'; return true; }
if (preg_match('#^/news/([a-z0-9-]+)/?$#', $path, $m)) { $_GET['slug'] = $m[1]; require $root . '/article.php'; return true; }
if (preg_match('#^/(privacy|consent)/?$#', $path, $m)) { header('Content-Type: text/html; charset=utf-8'); readfile($root . "/{$m[1]}.html"); return true; }
if ($path === '/admin' || $path === '/admin/') { chdir($root . '/admin'); require $root . '/admin/index.php'; return true; }
return false;
