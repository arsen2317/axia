/* Готовый HTML главной для поисковиков (Яндекс почти не выполняет скрипты, а текст главной рисует React).
   Открывает главную в браузере, берёт отрисованную разметку и кладёт её в <div id="root"> в index.html.
   Посетитель видит то же самое: при загрузке React заменяет эту разметку своей, такой же.
   Календарь записи и блок новостей из снимка убраны: они зависят от дня и данных сайта.

   Запуск (нужны Node.js и Playwright), сайт должен быть запущен локально:
     php -S 127.0.0.1:8000 tools/router.php
     node tools/prerender.js            (или node tools/prerender.js http://127.0.0.1:8000)
     php tools/build-pages.php          (номера версий файлов)
   Запускать после любой правки разметки или текстов главной. */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8000';
const FILE = path.join(__dirname, '..', 'index.html');
const START = '<div id="root">', END = '<!--/prerender--></div>';

(async () => {
  const html = fs.readFileSync(FILE, 'utf8');
  const a = html.indexOf(START);
  if (a < 0) throw new Error('В index.html нет <div id="root">');
  const b = html.indexOf(END, a);
  const tail = b >= 0 ? b + END.length : html.indexOf('</div>', a) + 6;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => { try { localStorage.setItem('axia-cookie-consent', 'rejected'); } catch (e) {} });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  const inner = await page.evaluate(() => {
    const root = document.getElementById('root').cloneNode(true);
    root.querySelectorAll('canvas, .news, script').forEach((el) => el.remove());
    root.querySelectorAll('.meet__main').forEach((el) => { el.textContent = ''; });
    return root.innerHTML;
  });
  await browser.close();
  if (inner.length < 5000 || inner.indexOf('intro__title') < 0) throw new Error('Страница не отрисовалась: снимок слишком короткий');

  const out = html.slice(0, a) + START + '<!--prerender: снимок для поисковиков, tools/prerender.js; React заменяет его при загрузке-->' + inner + END + html.slice(tail);
  fs.writeFileSync(FILE, out);
  console.log('✓ index.html: снимок главной ' + Math.round(inner.length / 1024) + ' КБ');
})().catch((e) => { console.error(e.message); process.exit(1); });
