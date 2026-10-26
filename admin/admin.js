/* Админка: общий запрос к API + действия на главной панели */
(function () {
  'use strict';
  var main = document.querySelector('[data-csrf]');
  var csrf = main ? main.getAttribute('data-csrf') : '';

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

  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-cancel]');
    if (c && confirm('Отменить встречу? Событие удалится из календаря. Клиенту напишите сами — автоматического письма об отмене нет.')) {
      adminApi('cancel', { id: c.getAttribute('data-cancel') }).then(function () { c.closest('li').remove(); }).catch(function (er) { alert(er.message); });
    }
    var d = e.target.closest('[data-delete]');
    if (d && confirm('Удалить статью насовсем? Картинки статьи тоже удалятся.')) {
      adminApi('delete', { id: d.getAttribute('data-delete') }).then(function () { d.closest('li').remove(); }).catch(function (er) { alert(er.message); });
    }
  });
})();
