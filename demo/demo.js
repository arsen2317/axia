/* ДЕМО-РЕЖИМ для превью на Vercel (там нет PHP).
   Новости, статьи и админка работают на тех же стилях и том же редакторе, что и настоящие,
   но статьи, картинки и настройки хранятся в браузере (localStorage) — у каждого посетителя свои.
   На настоящем хостинге эти файлы не используются: там работают news.php, article.php и admin/. */
(function () {
  'use strict';
  var KEY_ART = 'axia-demo-articles', KEY_SET = 'axia-demo-settings', KEY_SES = 'axia-demo-session';
  var DEMO_LOGIN = 'admin', DEMO_PASS = 'demo';

  function load(k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
  function save(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { alert('В браузере закончилось место для демо-данных. Удалите часть картинок или нажмите «Сбросить демо».'); return false; }
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function rid() { var a = new Uint8Array(8); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }

  /* ---- примеры статей при первом открытии ---- */
  function seed() {
    return [
      { id: rid(), slug: 'kak-tsennosti-stanovyatsya-strategiey', title: 'Как ценности становятся стратегией', status: 'published', published_at: daysAgo(2),
        description: 'Пример статьи: почему корпоративные ценности работают только тогда, когда из них вырастают решения и правила.',
        author: 'Ксения Лопаткина', cover: '', cover_alt: '',
        blocks: [
          { type: 'text', text: 'Это **демонстрационная статья**: так будет выглядеть публикация на сайте. Текст, подзаголовки, цитаты и картинки добавляются в админке.\n\nВторой абзац — чтобы было видно расстояние между абзацами и длину строки.' },
          { type: 'heading', text: 'Подзаголовок внутри статьи' },
          { type: 'text', text: 'Абзац с [ссылкой](https://axiagroup.ru) и *курсивом*. Обычный текст статьи идёт колонкой удобной для чтения ширины.' },
          { type: 'quote', text: 'Ценности — не слова на стене, а то, как принимаются решения.' },
          { type: 'text', text: 'Заключительный абзац статьи.' }
        ], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: rid(), slug: 'otchet-ob-ustoychivom-razvitii', title: 'Отчёт об устойчивом развитии: с чего начать', status: 'published', published_at: daysAgo(9),
        description: 'Пример: краткое описание статьи, которое показывается в списке новостей под заголовком.',
        author: '', cover: '', cover_alt: '',
        blocks: [{ type: 'text', text: 'Текст второй демонстрационной статьи.' }], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: rid(), slug: 'sotsialnye-programmy-dlya-territoriy', title: 'Социальные программы для территорий', status: 'published', published_at: daysAgo(20),
        description: 'Пример: краткое описание статьи, которое показывается в списке новостей под заголовком.',
        author: '', cover: '', cover_alt: '',
        blocks: [{ type: 'text', text: 'Текст третьей демонстрационной статьи.' }], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: rid(), slug: 'chernovik', title: 'Черновик (не виден на сайте)', status: 'draft', published_at: today(),
        description: 'Черновики видны только в админке.', author: '', cover: '', cover_alt: '',
        blocks: [{ type: 'text', text: 'Текст черновика.' }], created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];
  }
  function articles() {
    var a = load(KEY_ART, null);
    if (!Array.isArray(a)) { a = seed(); save(KEY_ART, a); }
    /* демо-статьи из прошлых версий: убираем примерные картинки (/demo/img/ больше нет) */
    var fixed = false;
    a.forEach(function (x) {
      if (String(x.cover || '').indexOf('/demo/img/') === 0) { x.cover = ''; fixed = true; }
      var bl = (x.blocks || []).filter(function (b) { return !(b.type === 'image' && String(b.url || '').indexOf('/demo/img/') === 0); });
      if (bl.length !== (x.blocks || []).length) { x.blocks = bl; fixed = true; }
    });
    if (fixed) save(KEY_ART, a);
    return a.slice().sort(function (x, y) { return (y.published_at || '').localeCompare(x.published_at || ''); });
  }
  function published() { var t = today(); return articles().filter(function (a) { return a.status === 'published' && a.published_at <= t; }); }

  /* ---- то же, что в lib/articles.php ---- */
  var TR = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya' };
  function slugify(s) {
    s = s.toLowerCase().split('').map(function (c) { return TR[c] != null ? TR[c] : c; }).join('');
    s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    return s || 'statya';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]; }); }
  function inlineMd(s) {
    s = esc(s);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/(?![\/\x5c])[^\s)]*|mailto:[^\s)]+)\)/g, function (m, t, u) {
      return '<a href="' + u + '"' + (u.indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>';
    });
    return s.replace(/\n/g, '<br>');
  }
  function renderBlocks(blocks) {
    return blocks.map(function (b) {
      if (b.type === 'heading') return '<h2>' + esc(b.text) + '</h2>';
      if (b.type === 'quote') return '<blockquote><p>' + inlineMd(b.text) + '</p></blockquote>';
      if (b.type === 'image') return b.url ? '<figure><img src="' + esc(b.url) + '" alt="' + esc(b.caption || '') + '" loading="lazy">' + (b.caption ? '<figcaption>' + esc(b.caption) + '</figcaption>' : '') + '</figure>' : '';
      return (b.text || '').split(/\n\s*\n/).filter(function (p) { return p.trim(); }).map(function (p) { return '<p>' + inlineMd(p.trim()) + '</p>'; }).join('');
    }).join('\n');
  }
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function ruDate(ymd) { var p = (ymd || '').split('-'); return p.length === 3 ? (+p[2]) + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0] : ymd; }

  function normalize(inp, old) {
    var title = String(inp.title || '').trim().slice(0, 200);
    if (!title) throw new Error('Укажите заголовок');
    var id = old ? old.id : rid();
    var slug = slugify(String(inp.slug || '').trim() || title);
    articles().forEach(function (a) { if (a.id !== id && a.slug === slug) slug += '-' + id.slice(0, 4); });
    var date = /^\d{4}-\d{2}-\d{2}$/.test(inp.published_at || '') ? inp.published_at : today();
    var blocks = (inp.blocks || []).filter(function (b) {
      return (b.type === 'image' && b.url) || (['text', 'heading', 'quote'].indexOf(b.type) >= 0 && String(b.text || '').trim());
    }).map(function (b) { return b.type === 'image' ? { type: 'image', url: b.url, caption: String(b.caption || '').trim().slice(0, 500) } : { type: b.type, text: String(b.text).trim() }; });
    return {
      id: id, slug: slug, title: title, description: String(inp.description || '').trim().slice(0, 600), author: String(inp.author || '').trim().slice(0, 120),
      cover: inp.cover || '', cover_alt: String(inp.cover_alt || '').trim().slice(0, 200), blocks: blocks,
      status: inp.status === 'published' ? 'published' : 'draft', published_at: date,
      created_at: old ? old.created_at : new Date().toISOString(), updated_at: new Date().toISOString()
    };
  }

  /* картинка: уменьшаем до 1600 px и сохраняем как JPEG в браузере */
  function readImage(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Нужна картинка JPG, PNG или WebP'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1600 / img.naturalWidth), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать картинку')); };
      img.src = url;
    });
  }

  /* ---- замена /admin/api.php ---- */
  window.adminApi = function (action, body) {
    return new Promise(function (resolve, reject) {
      if (!loggedIn()) return reject(new Error('Нужно войти заново'));
      var all = load(KEY_ART, []);
      if (action === 'booking') { var s = load(KEY_SET, {}); s.bookingEnabled = !!body.enabled; save(KEY_SET, s); return resolve({ ok: true, enabled: s.bookingEnabled }); }
      if (action === 'upload') return readImage(body.get('file')).then(function (u) { resolve({ ok: true, url: u }); }, reject);
      if (action === 'delete') { save(KEY_ART, all.filter(function (a) { return a.id !== body.id; })); return resolve({ ok: true }); }
      if (action === 'save') {
        var old = null; all.forEach(function (a) { if (a.id === body.id) old = a; });
        var a;
        try { a = normalize(body, old); } catch (e) { return reject(e); }
        var next = all.filter(function (x) { return x.id !== a.id; }); next.push(a);
        return save(KEY_ART, next) ? resolve({ ok: true, article: a }) : reject(new Error('Не хватило места в браузере'));
      }
      if (action === 'news') { var s3 = load(KEY_SET, {}); s3.newsEnabled = !!body.enabled; save(KEY_SET, s3); return resolve({ ok: true, enabled: s3.newsEnabled }); }
      if (action === 'booking_settings') {
        var bs;
        try { bs = normalizeBooking(body.settings || {}); } catch (e) { return reject(e); }
        var s2 = load(KEY_SET, {}); s2.booking = bs; delete s2.schedule; save(KEY_SET, s2);
        return resolve({ ok: true, settings: bs });
      }
      if (action === 'cancel') return resolve({ ok: true });
      reject(new Error('Неизвестное действие'));
    });
  };
  function loggedIn() { try { return sessionStorage.getItem(KEY_SES) === '1'; } catch (e) { return false; } }

  /* ---- страницы ---- */
  var root = document.getElementById('demo-root');
  var page = document.body.getAttribute('data-demo');

  /* полоска «демо-режим» — в начале содержимого страницы (под шапкой) */

  if (page === 'news') {
    var list = published();
    root.innerHTML = '<div class="pg-head"><h1 class="pg-title">новости</h1><a class="pg-back" href="/"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 8H3M7 4 3 8l4 4"></path></svg>вернуться на главную</a></div>' + (list.length ? '<ul class="news__list">' + list.map(function (a) {
      return '<li class="news__item"><a class="news__link" href="/news/' + esc(a.slug) + '"><span class="news__cover">' + (a.cover ? '<img src="' + esc(a.cover) + '" alt="' + esc(a.cover_alt) + '" loading="lazy">' : '') + '</span>'
        + '<span class="news__body"><time class="news__date" datetime="' + esc(a.published_at) + '">' + esc(ruDate(a.published_at)) + '</time><span class="news__name">' + esc(a.title) + '</span>'
        + (a.description ? '<span class="news__desc">' + esc(a.description) + '</span>' : '') + '</span></a></li>';
    }).join('') + '</ul>' : '<p class="pg-empty">Здесь скоро появятся публикации.</p>');
  }

  if (page === 'article') {
    var slug = decodeURIComponent(location.pathname.replace(/^\/news\//, '').replace(/\/$/, ''));
    var art = null; published().forEach(function (a) { if (a.slug === slug) art = a; });
    if (!art) {
      document.title = 'Статья не найдена — аксиа';
      root.innerHTML = '<h1 class="pg-title">не найдено</h1><p class="pg-empty">Такой статьи нет или она снята с публикации. <a href="/news">Все новости</a></p>';
    } else {
      document.title = art.title + ' — аксиа';
      root.innerHTML = '<article class="art"><a class="art__back" href="/news">← все новости</a><h1 class="art__title">' + esc(art.title) + '</h1>'
        + '<p class="art__meta"><time datetime="' + esc(art.published_at) + '">' + esc(ruDate(art.published_at)) + '</time>' + (art.author ? ' · ' + esc(art.author) : '') + '</p>'
        + (art.description ? '<p class="art__lead">' + esc(art.description) + '</p>' : '')
        + (art.cover ? '<img class="art__cover" src="' + esc(art.cover) + '" alt="' + esc(art.cover_alt) + '">' : '')
        + '<div class="art__body">' + renderBlocks(art.blocks) + '</div></article>';
    }
  }

  if (page === 'admin') {
    if (!loggedIn()) renderLogin(); else renderDashboard();
  }

  if (page === 'edit') {
    if (!loggedIn()) { location.replace('/admin/'); return; }
    var id = new URLSearchParams(location.search).get('id');
    var a = null; if (id) load(KEY_ART, []).forEach(function (x) { if (x.id === id) a = x; });
    if (id && !a) { root.innerHTML = '<p>Статья не найдена. <a href="/admin/">Назад</a></p>'; return; }
    a = a || { id: '', slug: '', title: '', description: '', author: '', cover: '', cover_alt: '', blocks: [{ type: 'text', text: '' }], status: 'draft', published_at: today() };
    document.getElementById('article-data').textContent = JSON.stringify(a);
    var s = document.createElement('script'); s.src = '/admin/editor.js'; document.body.appendChild(s);
  }

  function renderLogin() {
    root.className = 'ad-login';
    root.innerHTML = '<form class="ad-card ad-login__form"><p class="ad-logo">аксиа · админка</p>'
      + '<p class="ad-note ad-note--warn">Демо-режим. Логин <b>admin</b>, пароль <b>demo</b>. На настоящем сайте логин и пароль задаются в настройках сервера.</p>'
      + '<p class="ad-note ad-note--err" role="alert" hidden></p>'
      + '<label class="ad-field"><span>Логин</span><input name="login" autocomplete="username" required></label>'
      + '<label class="ad-field"><span>Пароль</span><input name="password" type="password" autocomplete="current-password" required></label>'
      + '<button class="ad-btn ad-btn--primary" type="submit">Войти</button></form>';
    root.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      if (f.login.value === DEMO_LOGIN && f.password.value === DEMO_PASS) { sessionStorage.setItem(KEY_SES, '1'); location.reload(); }
      else { var er = f.querySelector('.ad-note--err'); er.textContent = 'Неверный логин или пароль'; er.hidden = false; }
    });
  }

  /* параметры записи (как booking в config/config.example.php); проверки — упрощённая копия booking_normalize() */
  var BOOKING_DEFAULT = { duration_min: 30, step_min: 15, buffer_min: 15, min_notice_hours: 24, horizon_days: 14, max_per_day: 3,
    date_from: '2026-11-16', date_to: '2026-11-30', windows: { 2: [['11:00', '13:00']], 4: [['15:00', '17:00']], 5: [['13:00', '15:00']] }, holidays: [] };
  function demoBooking() { var b = load(KEY_SET, {}).booking; return b && b.windows ? b : BOOKING_DEFAULT; }
  function normalizeBooking(s) {
    var lim = { duration_min: [10, 240, 'Длительность звонка'], step_min: [5, 60, 'Шаг времени начала'], buffer_min: [0, 240, 'Перерыв между звонками'],
      min_notice_hours: [0, 720, 'Минимальный срок записи'], horizon_days: [1, 365, 'Горизонт записи'], max_per_day: [0, 50, 'Звонков в день'] };
    var out = {};
    Object.keys(lim).forEach(function (k) {
      var v = s[k], l = lim[k];
      if (v === '' || v == null || isNaN(v) || Math.floor(+v) !== +v || +v < l[0] || +v > l[1]) throw new Error(l[2] + ': число от ' + l[0] + ' до ' + l[1]);
      out[k] = +v;
    });
    if ([5, 10, 15, 20, 30, 60].indexOf(out.step_min) < 0) throw new Error('Шаг времени начала: 5, 10, 15, 20, 30, 60 минут');
    if (out.duration_min % 5 || out.buffer_min % 5) throw new Error('Длительность и перерыв должны быть кратны 5 минутам');
    out.date_from = s.date_from || ''; out.date_to = s.date_to || '';
    if (out.date_from && out.date_to && out.date_from > out.date_to) throw new Error('Период записи: дата начала позже даты окончания');
    var min = function (t) { var m = /^(\d{2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
    out.windows = {};
    for (var d = 1; d <= 7; d++) {
      var list = ((s.windows || {})[d] || []).map(function (w) {
        var a = min(w[0]), b = min(w[1]);
        if (a == null || b == null) throw new Error('Время в формате ЧЧ:ММ');
        if (b - a < out.duration_min) throw new Error(w[0] + '–' + w[1] + ': интервал короче звонка');
        return [a, b, w[0], w[1]];
      }).sort(function (x, y) { return x[0] - y[0]; });
      for (var i = 1; i < list.length; i++) if (list[i][0] < list[i - 1][1]) throw new Error('Интервалы пересекаются');
      out.windows[d] = list.map(function (x) { return [x[2], x[3]]; });
    }
    out.holidays = (s.holidays || []).filter(Boolean).sort();
    return out;
  }

  var NEWS_ON = 'Новости на сайте показываются: блок на главной, пункты в меню и подвале';
  var NEWS_OFF = 'Новости скрыты: на главной нет блока, в меню и подвале нет пункта «новости»';
  function renderDashboard() {
    var on = load(KEY_SET, {}).bookingEnabled !== false;
    var newsOn = load(KEY_SET, {}).newsEnabled !== false;
    var list = articles(), t = today();
    document.body.insertAdjacentHTML('afterbegin', '<header class="ad-top"><a class="ad-logo" href="/admin/">аксиа · админка <span class="ad-pill">демо</span></a>'
      + '<nav class="ad-top__nav"><a href="/" target="_blank" rel="noopener">сайт ↗</a><a href="/news" target="_blank" rel="noopener">новости ↗</a><a href="#" data-logout>выйти</a></nav></header>');
    root.className = 'ad-main';
    root.innerHTML = '<p class="ad-note ad-note--warn">Демо-режим на Vercel: статьи, картинки и настройки сохраняются только в этом браузере. Переключатель записи влияет на главную страницу в этом же браузере. <button class="ad-btn ad-btn--small" type="button" data-reset>Сбросить демо</button></p>'
      + '<section class="ad-card"><h2>Запись на встречи</h2><label class="ad-switch"><input type="checkbox" id="booking-toggle"' + (on ? ' checked' : '') + '><span class="ad-switch__track" aria-hidden="true"></span>'
      + '<span id="booking-label">' + (on ? 'Включена — на сайте календарь со слотами' : 'Выключена — на сайте вместо календаря форма обратной связи') + '</span></label>'
      + '<p class="ad-hint">Подключения: <span class="ad-pill">Почта (SMTP): тестовый режим</span> <span class="ad-pill">SmartCaptcha: тестовый режим</span> <span class="ad-pill">Яндекс Телемост: тестовый режим</span> <span class="ad-pill">Яндекс Календарь: тестовый режим</span></p>'
      + '<h3>Параметры и расписание</h3><p class="ad-hint">Время — московское. Слот появится на сайте, только если он попадает в расписание и период записи, в Яндекс Календаре в это время (с учётом перерыва) ничего нет и в этот день ещё не набрано максимальное число звонков. В демо параметры влияют на календарь главной в этом же браузере, часть слотов показана занятой — как будто в календаре.</p>'
      + '<div id="schedule" data-settings="' + esc(JSON.stringify(demoBooking())) + '"></div>'
      + '<h3>Ближайшие встречи</h3><p class="ad-hint">В демо-режиме встреч нет. На настоящем сайте здесь список записей с кнопкой «Отменить».</p></section>'
      + '<section class="ad-card"><div class="ad-card__head"><h2>Статьи</h2><a class="ad-btn ad-btn--primary" href="/admin/edit.php">Новая статья</a></div>'
      + '<label class="ad-switch"><input type="checkbox" id="news-toggle"' + (newsOn ? ' checked' : '') + '><span class="ad-switch__track" aria-hidden="true"></span><span id="news-label">' + (newsOn ? NEWS_ON : NEWS_OFF) + '</span></label>'
      + '<p class="ad-hint">Отдельная страница /news и сами статьи остаются доступны по прямой ссылке. Пока нет ни одной опубликованной статьи, блок не показывается в любом случае. В демо переключатель влияет на сайт в этом же браузере.</p>'
      + (list.length ? '<ul class="ad-list">' + list.map(function (a) {
        var st = a.status === 'published' ? (a.published_at > t ? 'запланирована на ' : 'опубликована ') + ruDate(a.published_at) : 'черновик';
        return '<li class="ad-list__row"><span class="ad-list__main">' + (a.cover ? '<img class="ad-thumb" src="' + esc(a.cover) + '" alt="">' : '<span class="ad-thumb"></span>')
          + '<span><b>' + esc(a.title) + '</b><br><span class="ad-hint">' + esc(st) + '</span></span></span><span class="ad-list__actions">'
          + (a.status === 'published' ? '<a href="/news/' + esc(a.slug) + '" target="_blank" rel="noopener">открыть ↗</a>' : '')
          + '<a class="ad-btn ad-btn--small" href="/admin/edit.php?id=' + esc(a.id) + '">Редактировать</a>'
          + '<button class="ad-btn ad-btn--small ad-btn--danger" type="button" data-delete="' + esc(a.id) + '">Удалить</button></span></li>';
      }).join('') + '</ul>' : '<p class="ad-hint">Статей пока нет.</p>') + '</section>';

    var sc = document.createElement('script'); sc.src = '/admin/schedule.js'; document.body.appendChild(sc);
    var nt = document.getElementById('news-toggle');
    nt.addEventListener('change', function () {
      adminApi('news', { enabled: nt.checked }).then(function (d) { document.getElementById('news-label').textContent = d.enabled ? NEWS_ON : NEWS_OFF; });
    });
    var tg = document.getElementById('booking-toggle');
    tg.addEventListener('change', function () {
      adminApi('booking', { enabled: tg.checked }).then(function (d) {
        document.getElementById('booking-label').textContent = d.enabled ? 'Включена — на сайте календарь со слотами' : 'Выключена — на сайте вместо календаря форма обратной связи';
      });
    });
    document.addEventListener('click', function (e) {
      var d = e.target.closest('[data-delete]');
      if (d && confirm('Удалить статью насовсем?')) adminApi('delete', { id: d.getAttribute('data-delete') }).then(function () { d.closest('li').remove(); });
      if (e.target.closest('[data-logout]')) { e.preventDefault(); sessionStorage.removeItem(KEY_SES); location.reload(); }
      if (e.target.closest('[data-reset]') && confirm('Удалить все демо-статьи и вернуть примеры?')) { localStorage.removeItem(KEY_ART); localStorage.removeItem(KEY_SET); location.reload(); }
    });
  }
})();
