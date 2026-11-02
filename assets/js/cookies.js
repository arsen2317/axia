/* Плашка о cookie с выбором: «Принять» или «Отклонить». Выбор запоминается в localStorage этого браузера
   ('accepted' / 'rejected'); пока выбора нет — плашка показывается на каждой странице.
   Технически необходимое (сама отметка о выборе) работает всегда. Необязательные инструменты — веб-аналитику
   (например, Яндекс Метрику, п. 3.5 и 5.2 политики) — запускать только после согласия:
     axiaCookies.onAccept(function () { …подключить счётчик… });
   onAccept вызывает функцию сразу, если согласие уже дано, или в момент нажатия «Принять».
   Если хранилище недоступно (приватный режим и т. п.), выбор действует до перезагрузки страницы. */
(function () {
  'use strict';
  var KEY = 'axia-cookie-consent', OLD = 'axia-cookie-ok';
  var state = null, waiting = [];
  try {
    state = window.localStorage.getItem(KEY);
    if (!state && window.localStorage.getItem(OLD)) window.localStorage.removeItem(OLD);   /* старая плашка без выбора — спросим заново */
  } catch (e) {}
  if (state !== 'accepted' && state !== 'rejected') state = null;

  function runAccepted() { var f; while ((f = waiting.shift())) { try { f(); } catch (e) {} } }
  window.axiaCookies = {
    status: function () { return state; },                                  /* 'accepted' | 'rejected' | null */
    onAccept: function (fn) { if (state === 'accepted') { try { fn(); } catch (e) {} } else waiting.push(fn); }
  };
  if (state) return;

  function show() {
    if (document.querySelector('.cookie')) return;
    var box = document.createElement('div');
    box.className = 'cookie';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Согласие на использование cookie');
    box.innerHTML =
      '<p class="cookie__text">Этот сайт использует cookie для хранения данных. Нажимая «Принять», вы даёте согласие на работу с этими файлами. '
      + '<a class="cookie__link" href="/privacy">Подробнее</a></p>'
      + '<div class="cookie__actions">'
      + '<button class="cookie__btn cookie__btn--ghost" type="button" data-choice="rejected">Отклонить</button>'
      + '<button class="cookie__btn" type="button" data-choice="accepted">Принять</button>'
      + '</div>';
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-choice]');
      if (!b) return;
      state = b.getAttribute('data-choice');
      try { window.localStorage.setItem(KEY, state); } catch (er) {}
      if (state === 'accepted') runAccepted(); else waiting = [];
      box.classList.remove('is-on');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 400);
    });
    document.body.appendChild(box);
    requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add('is-on'); }); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
