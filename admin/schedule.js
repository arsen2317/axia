/* Админка: параметры записи на встречи и расписание.
   Длительность, шаг времени начала, перерыв между звонками, за сколько часов можно записаться, на сколько дней вперёд,
   максимум звонков в день, период записи, интервалы по дням недели и дни без записи.
   Разметка: <div id="schedule" data-settings='{"duration_min":30,…,"windows":{"2":[["11:00","13:00"]]},…}'></div>.
   Сохраняет через adminApi('booking_settings', { settings }) — на хостинге это /admin/api.php, в демо — localStorage.
   Те же проверки, что здесь, сервер повторяет в booking_normalize() (lib/booking.php). */
(function () {
  'use strict';
  var DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  var STEPS = [5, 10, 15, 20, 30, 60];

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function toMin(t) { var m = /^(\d{2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function toHm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function plural(n, a, b, c) { var k = n % 10, h = n % 100; return n + ' ' + (k === 1 && h !== 11 ? a : k >= 2 && k <= 4 && (h < 12 || h > 14) ? b : c); }

  window.adminSchedule = function (box) {
    if (!box || box.getAttribute('data-ready')) return;
    box.setAttribute('data-ready', '1');
    var s = JSON.parse(box.getAttribute('data-settings') || '{}');
    var windows = {};
    for (var d = 1; d <= 7; d++) windows[d] = ((s.windows || {})[d] || []).map(function (w) { return [w[0], w[1]]; });
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
    (function () {
      var f = el('label', 'ad-field'); f.appendChild(el('span', '', 'Шаг времени начала, мин'));
      var sel = el('select');
      STEPS.forEach(function (v) { var o = el('option', '', String(v)); o.value = v; if (v === +s.step_min) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', function () { s.step_min = +sel.value; dirty(); });
      f.appendChild(sel); f.appendChild(el('small', 'ad-hint', 'например, 15 — начало в 12:00, 12:15, 12:30…')); params.appendChild(f);
    })();
    num('buffer_min', 'Перерыв между звонками, мин', 'до и после занятого времени', 0, 240, 5);
    num('min_notice_hours', 'Записаться не позже чем за, ч', 'до начала звонка', 0, 720);
    num('horizon_days', 'Запись вперёд, дней', '14 — на 2 недели вперёд', 1, 365);
    num('max_per_day', 'Звонков в день, не больше', '0 — без ограничения', 0, 50);
    box.appendChild(params);

    /* ---- период ---- */
    var period = el('div', 'ad-bk__period');
    period.appendChild(el('h4', '', 'Период записи'));
    var prow = el('div', 'ad-row');
    ['date_from', 'date_to'].forEach(function (k, n) {
      var f = el('label', 'ad-field'); f.appendChild(el('span', '', n ? 'по (включительно)' : 'с'));
      var i = el('input'); i.type = 'date'; i.value = s[k] || '';
      i.addEventListener('change', function () { s[k] = i.value; dirty(); });
      f.appendChild(i); prow.appendChild(f);
    });
    period.appendChild(prow);
    period.appendChild(el('p', 'ad-hint', 'Пустое поле — без ограничения. Запись всё равно открыта не дальше, чем на «запись вперёд» дней от сегодняшнего.'));
    box.appendChild(period);

    /* ---- дни недели ---- */
    box.appendChild(el('h4', '', 'Дни и часы'));
    box.appendChild(el('p', 'ad-hint', 'Интервал — время, в которое должен уложиться звонок целиком: при интервале 11:00–13:00 и звонке 30 мин последний звонок начинается в 12:30.'));
    var week = el('div', 'ad-bk__week');
    box.appendChild(week);

    /* ---- дни без записи ---- */
    box.appendChild(el('h4', '', 'Дни без записи'));
    box.appendChild(el('p', 'ad-hint', 'Праздники, отпуск — в эти даты запись закрыта, даже если день есть в расписании.'));
    var hol = el('div', 'ad-bk__hol');
    box.appendChild(hol);

    var bar = el('div', 'ad-sched__bar');
    save = el('button', 'ad-btn ad-btn--primary', 'Сохранить'); save.type = 'button'; save.disabled = true;
    status = el('span', 'ad-hint'); status.setAttribute('role', 'status');
    bar.appendChild(save); bar.appendChild(status);
    box.appendChild(bar);

    function render() {
      week.textContent = '';
      var dur = +s.duration_min || 0, step = +s.step_min || 15, total = 0;
      for (var d = 1; d <= 7; d++) (function (d) {
        var row = el('div', 'ad-bk__day' + (windows[d].length ? ' is-on' : ''));
        row.appendChild(el('span', 'ad-bk__name', DAYS[d - 1]));
        var list = el('div', 'ad-bk__wins');
        var starts = [];
        windows[d].forEach(function (w, n) {
          var item = el('span', 'ad-bk__win');
          [0, 1].forEach(function (k) {
            var i = el('input'); i.type = 'time'; i.step = 300; i.value = w[k]; i.required = true;
            i.setAttribute('aria-label', DAYS[d - 1] + (k ? ', до' : ', с'));
            i.addEventListener('change', function () { w[k] = i.value; dirty(); });
            item.appendChild(i);
            if (!k) item.appendChild(el('span', '', '–'));
          });
          var rm = el('button', 'ad-btn ad-btn--small ad-btn--danger', '×'); rm.type = 'button'; rm.title = 'Убрать интервал';
          rm.addEventListener('click', function () { windows[d].splice(n, 1); dirty(); });
          item.appendChild(rm);
          list.appendChild(item);
          var a = toMin(w[0]), b = toMin(w[1]);
          if (a != null && b != null && dur > 0) for (var m = a; m + dur <= b; m += step) starts.push(toHm(m));
        });
        var add = el('button', 'ad-btn ad-btn--small', windows[d].length ? '+ интервал' : '+ добавить время'); add.type = 'button';
        add.addEventListener('click', function () {
          var last = windows[d][windows[d].length - 1], a = last ? Math.min(toMin(last[1]) + 60, 22 * 60) : 11 * 60;
          windows[d].push([toHm(a), toHm(Math.min(a + 120, 23 * 60 + 55))]); dirty();
        });
        list.appendChild(add);
        row.appendChild(list);
        total += starts.length;
        row.appendChild(el('span', 'ad-bk__preview ad-hint', starts.length ? 'начало: ' + starts.join(', ') : 'нет записи'));
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
      var out = Object.assign({}, s, { windows: {}, holidays: holidays.filter(Boolean) });
      for (var d = 1; d <= 7; d++) out.windows[d] = windows[d];
      save.disabled = true; status.textContent = 'Сохраняем…';
      window.adminApi('booking_settings', { settings: out }).then(function (r) {
        s = r.settings;
        for (var d = 1; d <= 7; d++) windows[d] = (s.windows[d] || []).map(function (w) { return [w[0], w[1]]; });
        holidays = s.holidays.slice();
        render();
        var n = +box.getAttribute('data-total');
        status.textContent = n ? 'Сохранено. Вариантов начала в неделю: ' + n : 'Сохранено. В расписании нет ни одного дня — запись на сайте будет недоступна';
      }).catch(function (er) { save.disabled = false; status.textContent = er.message || 'Не удалось сохранить'; });
    });
    window.addEventListener('beforeunload', function (e) { if (!save.disabled) { e.preventDefault(); e.returnValue = ''; } });
  };
  window.adminSchedule(document.getElementById('schedule'));
})();
