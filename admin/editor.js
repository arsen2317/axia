/* Редактор статьи: поля, обложка, блоки (текст, подзаголовок, картинка с подписью, цитата) */
(function () {
  'use strict';
  var a = JSON.parse(document.getElementById('article-data').textContent);
  var $ = function (id) { return document.getElementById(id); };
  var dirty = false;
  var markDirty = function () { dirty = true; $('save-state').textContent = 'есть несохранённые изменения'; };

  var fields = { title: 'f-title', description: 'f-description', author: 'f-author', published_at: 'f-date', slug: 'f-slug', cover_alt: 'f-cover-alt' };
  Object.keys(fields).forEach(function (k) { $(fields[k]).value = a[k] || ''; $(fields[k]).addEventListener('input', markDirty); });

  var LABELS = { text: 'Текст', heading: 'Подзаголовок', image: 'Картинка', quote: 'Цитата' };

  function upload(file) {
    var fd = new FormData();
    fd.append('file', file);
    $('save-state').textContent = 'загрузка картинки…';
    return adminApi('upload', fd, true).then(function (d) { $('save-state').textContent = ''; return d.url; })
      .catch(function (e) { $('save-state').textContent = ''; alert(e.message); throw e; });
  }

  /* ---- обложка ---- */
  function renderCover() {
    $('cover-img').hidden = !a.cover;
    if (a.cover) $('cover-img').src = a.cover;
    $('cover-remove').hidden = !a.cover;
  }
  $('cover-file').addEventListener('change', function () {
    var f = this.files[0]; this.value = '';
    if (f) upload(f).then(function (url) { a.cover = url; renderCover(); markDirty(); });
  });
  $('cover-remove').addEventListener('click', function () { a.cover = ''; renderCover(); markDirty(); });
  renderCover();

  /* ---- блоки ---- */
  var list = $('blocks');
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function autosize(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }

  function renderBlocks() {
    list.textContent = '';
    a.blocks.forEach(function (b, i) {
      var box = el('div', 'ad-block ad-block--' + b.type);
      var head = el('div', 'ad-block__head');
      head.appendChild(el('span', 'ad-block__type', LABELS[b.type]));
      var tools = el('span', 'ad-block__tools');
      [['↑', 'Выше', -1], ['↓', 'Ниже', 1]].forEach(function (m) {
        var btn = el('button', 'ad-btn ad-btn--small', m[0]); btn.type = 'button'; btn.title = m[1]; btn.setAttribute('aria-label', m[1]);
        btn.disabled = (m[2] < 0 && i === 0) || (m[2] > 0 && i === a.blocks.length - 1);
        btn.onclick = function () { var j = i + m[2]; var t = a.blocks[i]; a.blocks[i] = a.blocks[j]; a.blocks[j] = t; renderBlocks(); markDirty(); };
        tools.appendChild(btn);
      });
      var del = el('button', 'ad-btn ad-btn--small ad-btn--danger', 'Удалить'); del.type = 'button';
      del.onclick = function () { if (b.type === 'text' && b.text && !confirm('Удалить этот блок текста?')) return; a.blocks.splice(i, 1); renderBlocks(); markDirty(); };
      tools.appendChild(del);
      head.appendChild(tools);
      box.appendChild(head);

      if (b.type === 'image') {
        if (b.url) { var img = el('img', 'ad-block__img'); img.src = b.url; img.alt = ''; box.appendChild(img); }
        var lab = el('label', 'ad-btn'); var inp = el('input'); inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp'; inp.hidden = true;
        lab.appendChild(inp); lab.appendChild(document.createTextNode(b.url ? 'Заменить картинку' : 'Выбрать картинку'));
        inp.onchange = function () { var f = inp.files[0]; if (f) upload(f).then(function (url) { b.url = url; renderBlocks(); markDirty(); }); };
        box.appendChild(lab);
        var cap = el('input', 'ad-block__caption'); cap.placeholder = 'Подпись (необязательно)'; cap.maxLength = 500; cap.value = b.caption || '';
        cap.oninput = function () { b.caption = cap.value; markDirty(); };
        box.appendChild(cap);
      } else {
        var t = el(b.type === 'heading' ? 'input' : 'textarea', 'ad-block__text');
        if (b.type !== 'heading') t.rows = 4;
        t.placeholder = b.type === 'heading' ? 'Подзаголовок' : b.type === 'quote' ? 'Текст цитаты' : 'Текст';
        t.value = b.text || '';
        t.oninput = function () { b.text = t.value; markDirty(); if (t.tagName === 'TEXTAREA') autosize(t); };
        box.appendChild(t);
        if (t.tagName === 'TEXTAREA') requestAnimationFrame(function () { autosize(t); });
      }
      list.appendChild(box);
    });
  }
  document.querySelectorAll('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var type = btn.getAttribute('data-add');
      a.blocks.push(type === 'image' ? { type: 'image', url: '', caption: '' } : { type: type, text: '' });
      renderBlocks(); markDirty();
      var last = list.lastElementChild; if (last) { var f = last.querySelector('textarea, input:not([type=file])'); if (f) f.focus(); last.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    });
  });
  renderBlocks();

  /* ---- сохранение ---- */
  function save(status) {
    var body = { id: a.id, cover: a.cover, blocks: a.blocks, status: status };
    Object.keys(fields).forEach(function (k) { body[k] = $(fields[k]).value; });
    if (!body.title.trim()) { $('save-error').textContent = 'Укажите заголовок'; $('save-error').hidden = false; $('f-title').focus(); return; }
    $('save-error').hidden = true;
    $('btn-draft').disabled = $('btn-publish').disabled = true;
    $('save-state').textContent = 'сохранение…';
    adminApi('save', body).then(function (d) {
      a = Object.assign(a, d.article);
      $('f-slug').value = a.slug;
      dirty = false;
      if (location.search.indexOf('id=') < 0) history.replaceState(null, '', '/admin/edit.php?id=' + a.id);
      $('save-state').innerHTML = '';
      var msg = document.createTextNode(status === 'published' ? 'опубликовано · ' : 'черновик сохранён');
      $('save-state').appendChild(msg);
      if (status === 'published') { var l = el('a', '', 'открыть ↗'); l.href = '/news/' + a.slug; l.target = '_blank'; l.rel = 'noopener'; $('save-state').appendChild(l); }
      updateButtons();
    }).catch(function (e) { $('save-error').textContent = e.message; $('save-error').hidden = false; $('save-state').textContent = ''; })
      .then(function () { $('btn-draft').disabled = $('btn-publish').disabled = false; });
  }
  function updateButtons() {
    $('btn-draft').textContent = a.status === 'published' ? 'Снять с публикации' : 'Сохранить черновик';
    $('btn-publish').textContent = a.status === 'published' ? 'Сохранить изменения' : 'Опубликовать';
  }
  $('btn-draft').addEventListener('click', function () { save('draft'); });
  $('btn-publish').addEventListener('click', function () { save('published'); });
  updateButtons();
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
