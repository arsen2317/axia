/* Админка: расписание записи — сетка «дни недели × время начала встречи».
   Отмеченный слот доступен для записи на сайте, если в Яндекс Календаре в это время ничего нет;
   неотмеченный не показывается никогда, даже если календарь свободен.
   Разметка: <div id="schedule" data-grid='["08:00",…]' data-slots='{"1":["13:00",…],…}' data-duration="30"></div>.
   Сохраняет через adminApi('schedule', { slots }) — на хостинге это /admin/api.php, в демо — localStorage. */
(function () {
  'use strict';
  var DAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

  window.adminSchedule = function (box) {
    if (!box || box.getAttribute('data-ready')) return;
    box.setAttribute('data-ready', '1');
    var grid = JSON.parse(box.getAttribute('data-grid') || '[]');
    var slots = JSON.parse(box.getAttribute('data-slots') || '{}');
    var dur = +box.getAttribute('data-duration') || 30;
    var on = {};
    for (var d = 1; d <= 7; d++) (slots[d] || []).forEach(function (t) { on[d + '@' + t] = true; });

    var end = function (t) { var m = +t.slice(0, 2) * 60 + +t.slice(3) + dur; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
    var h = '<div class="ad-sched__scroll"><table class="ad-sched"><thead><tr><th></th>';
    DAYS.forEach(function (n, i) { h += '<th><button type="button" class="ad-sched__day" data-day="' + (i + 1) + '" title="Отметить или снять весь день">' + n + '</button></th>'; });
    h += '</tr></thead><tbody>';
    grid.forEach(function (t) {
      h += '<tr><th><button type="button" class="ad-sched__time" data-time="' + t + '" title="Отметить или снять это время во все дни">' + t + '<span>–' + end(t) + '</span></button></th>';
      for (var d = 1; d <= 7; d++) {
        h += '<td><label class="ad-sched__cell"><input type="checkbox" data-d="' + d + '" data-t="' + t + '"' + (on[d + '@' + t] ? ' checked' : '') + ' aria-label="' + DAYS[d - 1] + ' ' + t + '"><span></span></label></td>';
      }
      h += '</tr>';
    });
    h += '</tbody></table></div>'
      + '<div class="ad-sched__bar"><button type="button" class="ad-btn ad-btn--primary" data-save disabled>Сохранить расписание</button><span class="ad-hint" data-status></span></div>';
    box.innerHTML = h;

    var save = box.querySelector('[data-save]'), status = box.querySelector('[data-status]');
    var boxes = function (sel) { return Array.prototype.slice.call(box.querySelectorAll(sel)); };
    var dirty = function () { save.disabled = false; status.textContent = 'Есть несохранённые изменения'; };
    var toggleAll = function (list) {
      var all = list.every(function (c) { return c.checked; });
      list.forEach(function (c) { c.checked = !all; });
      dirty();
    };
    box.addEventListener('change', function (e) { if (e.target.matches('input[type=checkbox]')) dirty(); });
    box.addEventListener('click', function (e) {
      var day = e.target.closest('[data-day]'), time = e.target.closest('[data-time]');
      if (day) toggleAll(boxes('input[data-d="' + day.getAttribute('data-day') + '"]'));
      if (time) toggleAll(boxes('input[data-t="' + time.getAttribute('data-time') + '"]'));
      if (e.target.closest('[data-save]')) {
        var out = {};
        for (var d = 1; d <= 7; d++) out[d] = [];
        boxes('input[data-d]').forEach(function (c) { if (c.checked) out[c.getAttribute('data-d')].push(c.getAttribute('data-t')); });
        save.disabled = true; status.textContent = 'Сохраняем…';
        window.adminApi('schedule', { slots: out }).then(function () {
          var n = boxes('input[data-d]:checked').length;
          status.textContent = 'Сохранено. Слотов в неделю: ' + n + (n ? '' : ' — запись на сайте будет недоступна');
        }).catch(function (er) { save.disabled = false; status.textContent = er.message || 'Не удалось сохранить'; });
      }
    });
    window.addEventListener('beforeunload', function (e) { if (!save.disabled) { e.preventDefault(); e.returnValue = ''; } });
  };
  window.adminSchedule(document.getElementById('schedule'));
})();
