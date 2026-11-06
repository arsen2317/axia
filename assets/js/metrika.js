/* Яндекс Метрика — только после согласия на cookie (кнопка «Принять» в плашке, assets/js/cookies.js).
   Вебвизор выключен: он записывал бы, что люди вводят в формы (персональные данные).
   Цели (в интерфейсе Метрики: «JavaScript-событие» с этим идентификатором):
     booking — записался на встречу; contact — отправил форму «напишите нам».
   window.axiaGoal('booking') можно вызывать всегда: без согласия цель просто не отправится.
   Адреса Метрики разрешены в Content-Security-Policy (index.html, privacy.html, lib/bootstrap.php, tools/build-pages.php). */
(function () {
  'use strict';
  var ID = 114107854;
  var on = false;
  window.axiaGoal = function (name) { if (on && window.ym) { try { window.ym(ID, 'reachGoal', name); } catch (e) {} } };
  /* локально и на демо (Vercel) не считаем */
  if (!/(^|\.)axiagroup\.ru$/.test(location.hostname)) return;
  if (!window.axiaCookies) return;
  window.axiaCookies.onAccept(function () {
    if (on) return;
    on = true;
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = 1 * new Date();
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://mc.yandex.ru/metrika/tag.js?id=' + ID;
    document.head.appendChild(s);
    window.ym(ID, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false, referrer: document.referrer, url: location.href });
  });
})();
