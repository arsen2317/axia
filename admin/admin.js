/* Админка: общий запрос к API + действия на главной панели */
(function () {
  'use strict';
  var main = document.querySelector('[data-csrf]');
  var csrf = main ? main.getAttribute('data-csrf') : '';
  var NEWS_ON = 'Блок «Новости» включён: показывается на главной, в меню и подвале';
  var NEWS_OFF = 'Блок «Новости» выключен: на главной, в меню и подвале его нет';

  window.adminApi = function (action, body, isForm) {
    var opts = { method: 'POST', headers: { 'X-CSRF': csrf }, credentials: 'same-origin' };
    if (isForm) opts.body = body;
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body || {}); }
    return fetch('/admin/api.php?action=' + action, opts).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'Ошибка сервера (' + r.status + ')' }; });
    }).then(function (d) {
      if (!d.ok) throw new Error(d.error || 'Ошибка');
      return d;
    });
  };

  var toggle = document.getElementById('booking-toggle');
  if (toggle) toggle.addEventListener('change', function () {
    var label = document.getElementById('booking-label');
    toggle.disabled = true;
    adminApi('booking', { enabled: toggle.checked }).then(function (d) {
      label.textContent = d.enabled ? 'Включена — на сайте календарь со слотами' : 'Выключена — на сайте вместо календаря форма обратной связи';
    }).catch(function (e) { toggle.checked = !toggle.checked; alert(e.message); })
      .then(function () { toggle.disabled = false; });
  });

  var newsToggle = document.getElementById('news-toggle');
  if (newsToggle) newsToggle.addEventListener('change', function () {
    var label = document.getElementById('news-label');
    newsToggle.disabled = true;
    adminApi('news', { enabled: newsToggle.checked }).then(function (d) {
      label.textContent = d.enabled ? NEWS_ON : NEWS_OFF;
    }).catch(function (e) { newsToggle.checked = !newsToggle.checked; alert(e.message); })
      .then(function () { newsToggle.disabled = false; });
  });

  /* контакты на сайте */
  var cbox = document.getElementById('contacts');
  if (cbox) {
    var c = JSON.parse(cbox.getAttribute('data-contacts') || '{}'), cSave = document.getElementById('contacts-save'), cState = document.getElementById('contacts-state');
    var inp = function (n) { return cbox.querySelector('[name="' + n + '"]'); };
    inp('email').value = c.email || ''; inp('phone').value = c.phone || ''; inp('telegram').value = c.telegram || '';
    (c.team || []).forEach(function (m, i) { if (inp('team' + i)) inp('team' + i).value = m; });
    cbox.addEventListener('input', function () { cSave.disabled = false; cState.textContent = 'Есть несохранённые изменения'; });
    cSave.addEventListener('click', function () {
      var team = []; for (var i = 0; inp('team' + i); i++) team.push(inp('team' + i).value);
      cSave.disabled = true; cState.textContent = 'Сохраняем…';
      adminApi('contacts', { contacts: { email: inp('email').value, phone: inp('phone').value, telegram: inp('telegram').value, team: team } }).then(function (d) {
        inp('telegram').value = d.contacts.telegram; cState.textContent = 'Сохранено. На сайте — сразу (обновите страницу)';
      }).catch(function (er) { cSave.disabled = false; cState.textContent = er.message; });
    });
  }

  /* текст политики */
  var ptext = document.getElementById('privacy-text');
  if (ptext) {
    var pSave = document.getElementById('privacy-save'), pState = document.getElementById('privacy-state'), pErr = document.getElementById('privacy-error'), pDirty = false;
    ptext.addEventListener('input', function () { pDirty = true; pSave.disabled = false; pState.textContent = 'Есть несохранённые изменения'; });
    pSave.addEventListener('click', function () {
      pSave.disabled = true; pErr.hidden = true; pState.textContent = 'Сохраняем…';
      adminApi('privacy', { text: ptext.value }).then(function () { pDirty = false; pState.textContent = 'Сохранено'; })
        .catch(function (er) { pSave.disabled = false; pState.textContent = ''; pErr.textContent = er.message; pErr.hidden = false; });
    });
    window.addEventListener('beforeunload', function (e) { if (pDirty) { e.preventDefault(); e.returnValue = ''; } });
  }

  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-cancel]');
    if (c && confirm('Отменить встречу? Событие удалится из календаря. Клиенту напишите сами — автоматического письма об отмене нет.')) {
      adminApi('cancel', { id: c.getAttribute('data-cancel') }).then(function () { c.closest('li').remove(); }).catch(function (er) { alert(er.message); });
    }
    var ar = e.target.closest('[data-archive]');
    if (ar) {
      var toArch = ar.getAttribute('data-to') === '1';
      if (!toArch || confirm('Убрать статью в архив? На сайте её не будет видно, но она сохранится, и её можно вернуть.')) {
        ar.disabled = true;
        adminApi('archive', { id: ar.getAttribute('data-archive'), archived: toArch }).then(function () { location.reload(); })
          .catch(function (er) { ar.disabled = false; alert(er.message); });
      }
    }
    var d = e.target.closest('[data-delete]');
    if (d && confirm('Удалить статью насовсем? Картинки статьи тоже удалятся.')) {
      adminApi('delete', { id: d.getAttribute('data-delete') }).then(function () { d.closest('li').remove(); }).catch(function (er) { alert(er.message); });
    }
  });
})();
