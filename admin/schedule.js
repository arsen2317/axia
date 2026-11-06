/* Админка: расписание записи на встречи.
   Длительность звонка, за сколько часов можно записаться, на сколько дней вперёд, слоты по дням недели и дни без записи.
   Слот — время начала звонка. Разметка: <div id="schedule" data-settings='{"duration_min":30,…,"slots":{"2":["11:00"]},…}'></div>.
   Сохраняет через adminApi('booking_settings', { settings }) — на хостинге это /admin/api.php, в демо — localStorage.
   Те же проверки, что здесь, сервер повторяет в booking_normalize() (lib/booking.php). */
(function () {
  'use strict';
  var DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function toMin(t) { var m = /^(\d{2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function toHm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

  window.adminSchedule = function (box) {
    if (!box || box.getAttribute('data-ready')) return;
    box.setAttribute('data-ready', '1');
    var s = JSON.parse(box.getAttribute('data-settings') || '{}');
    var slots = {};
    for (var d = 1; d <= 7; d++) slots[d] = ((s.slots || {})[d] || []).slice();
    var holidays = (s.holidays || []).slice();

    var save, status;
    var dirty = function () { save.disabled = false; status.textContent = 'Есть несохранённые изменения'; render(); };

    /* ---- числовые параметры ---- */
    var params = el('div', 'ad-bk__params');
    var num = function (key, label, hint, min, max, stepAttr) {
      var f = el('label', 'ad-field');
      f.appendChild(el('span', '', label));
      var i = el('input'); i.type = 'number'; i.min = min; i.max = max; i.step = stepAttr || 1; i.value = s[key]; i.required = true;
      i.addEventListener('input', function () { s[key] = i.value === '' ? '' : +i.value; dirty(); });
      f.appendChild(i);
      if (hint) f.appendChild(el('small', 'ad-hint', hint));
      params.appendChild(f);
    };
    num('duration_min', 'Длительность звонка, мин', '', 10, 240, 5);
    num('min_notice_hours', 'Записаться не позже чем за, ч', 'до начала звонка', 0, 720);
    num('horizon_days', 'Запись вперёд, дней', '14 — на 2 недели вперёд', 1, 365);
    box.appendChild(params);

    /* ---- дни недели ---- */
    box.appendChild(el('h4', '', 'Слоты по дням недели'));
    box.appendChild(el('p', 'ad-hint', 'Время начала звонка. Сколько слотов в день — столько звонков можно провести. Слот, на время которого в Яндекс Календаре уже что-то есть, на сайте не показывается.'));
    var week = el('div', 'ad-bk__week');
    box.appendChild(week);

    /* ---- дни без записи ---- */
    box.appendChild(el('h4', '', 'Дни без записи'));
    box.appendChild(el('p', 'ad-hint', 'Праздники, отпуск — в эти даты запись закрыта.'));
    var hol = el('div', 'ad-bk__hol');
    box.appendChild(hol);

    var bar = el('div', 'ad-sched__bar');
    save = el('button', 'ad-btn ad-btn--primary', 'Сохранить'); save.type = 'button'; save.disabled = true;
    status = el('span', 'ad-hint'); status.setAttribute('role', 'status');
    bar.appendChild(save); bar.appendChild(status);
    box.appendChild(bar);

    function render() {
      week.textContent = '';
      var dur = +s.duration_min || 0, total = 0;
      for (var d = 1; d <= 7; d++) (function (d) {
        var row = el('div', 'ad-bk__day' + (slots[d].length ? ' is-on' : ''));
        row.appendChild(el('span', 'ad-bk__name', DAYS[d - 1]));
        var list = el('div', 'ad-bk__wins');
        slots[d].forEach(function (t, n) {
          var item = el('span', 'ad-bk__win');
          var i = el('input'); i.type = 'time'; i.step = 300; i.value = t; i.required = true;
          i.setAttribute('aria-label', DAYS[d - 1] + ', слот ' + (n + 1));
          i.addEventListener('change', function () { slots[d][n] = i.value; dirty(); });
          item.appendChild(i);
          var rm = el('button', 'ad-btn ad-btn--small ad-btn--danger', '×'); rm.type = 'button'; rm.title = 'Убрать слот';
          rm.setAttribute('aria-label', 'Убрать слот ' + (t || ''));
          rm.addEventListener('click', function () { slots[d].splice(n, 1); dirty(); });
          item.appendChild(rm);
          list.appendChild(item);
        });
        var add = el('button', 'ad-btn ad-btn--small', '+ добавить слот'); add.type = 'button';
        add.addEventListener('click', function () {
          /* новый слот — сразу после последнего (через длительность звонка + 15 минут), для пустого дня — 11:00 */
          var last = slots[d].map(toMin).filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; }).pop();
          var m = last == null ? 11 * 60 : last + dur + 15;
          if (m + dur > 24 * 60) m = 24 * 60 - dur;
          slots[d].push(toHm(Math.max(0, m - m % 5))); dirty();
        });
        list.appendChild(add);
        row.appendChild(list);

        /* подсказка: итог по дню и пересечения */
        var mins = slots[d].map(toMin).filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
        var note = '';
        if (!mins.length) note = 'нет записи';
        else {
          note = mins.map(function (m) { return toHm(m) + '–' + toHm(m + dur); }).join(', ');
          for (var k = 1; k < mins.length; k++) if (mins[k] < mins[k - 1] + dur) { note += ' · ' + toHm(mins[k - 1]) + ' и ' + toHm(mins[k]) + ' пересекаются: после записи на один второй станет недоступен'; break; }
        }
        total += mins.length;
        row.appendChild(el('span', 'ad-bk__preview ad-hint', note));
        week.appendChild(row);
      })(d);

      hol.textContent = '';
      holidays.forEach(function (v, n) {
        var item = el('span', 'ad-bk__win');
        var i = el('input'); i.type = 'date'; i.value = v;
        i.addEventListener('change', function () { holidays[n] = i.value; dirty(); });
        var rm = el('button', 'ad-btn ad-btn--small ad-btn--danger', '×'); rm.type = 'button'; rm.title = 'Убрать дату';
        rm.addEventListener('click', function () { holidays.splice(n, 1); dirty(); });
        item.appendChild(i); item.appendChild(rm); hol.appendChild(item);
      });
      var addH = el('button', 'ad-btn ad-btn--small', '+ дата'); addH.type = 'button';
      addH.addEventListener('click', function () { holidays.push(''); dirty(); });
      hol.appendChild(addH);
      box.setAttribute('data-total', total);
    }
    render();

    save.addEventListener('click', function () {
      var out = { duration_min: s.duration_min, min_notice_hours: s.min_notice_hours, horizon_days: s.horizon_days, slots: {}, holidays: holidays.filter(Boolean) };
      for (var d = 1; d <= 7; d++) out.slots[d] = slots[d].filter(Boolean);
      save.disabled = true; status.textContent = 'Сохраняем…';
      window.adminApi('booking_settings', { settings: out }).then(function (r) {
        s = r.settings;
        for (var d = 1; d <= 7; d++) slots[d] = (s.slots[d] || []).slice();
        holidays = s.holidays.slice();
        render();
        var n = +box.getAttribute('data-total');
        status.textContent = n ? 'Сохранено. Слотов в неделю: ' + n : 'Сохранено. В расписании нет ни одного слота — запись на сайте будет недоступна';
      }).catch(function (er) { save.disabled = false; status.textContent = er.message || 'Не удалось сохранить'; });
    });
    window.addEventListener('beforeunload', function (e) { if (!save.disabled) { e.preventDefault(); e.returnValue = ''; } });
  };
  window.adminSchedule(document.getElementById('schedule'));
})();
