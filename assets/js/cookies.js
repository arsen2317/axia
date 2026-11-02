/* Плашка о cookie: показывается внизу экрана, пока посетитель не нажмёт «Понятно».
   Выбор запоминается в localStorage этого браузера; если хранилище недоступно (приватный режим и т. п.) —
   плашка просто закрывается до перезагрузки страницы. Текст положений о cookie — в политике (/privacy). */
(function () {
  'use strict';
  var KEY = 'axia-cookie-ok';
  try { if (window.localStorage.getItem(KEY)) return; } catch (e) {}

  function show() {
    if (document.querySelector('.cookie')) return;
    var box = document.createElement('div');
    box.className = 'cookie';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Уведомление о cookie');
    box.innerHTML =
      '<p class="cookie__text">Этот сайт использует cookie для\u00a0хранения данных. Продолжая использовать сайт, вы\u00a0даёте своё согласие на\u00a0работу с\u00a0этими файлами. '
      + '<a class="cookie__link" href="/privacy">Подробнее</a></p>'
      + '<button class="cookie__btn" type="button">Понятно</button>';
    box.querySelector('.cookie__btn').addEventListener('click', function () {
      try { window.localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
      box.classList.remove('is-on');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 400);
    });
    document.body.appendChild(box);
    requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add('is-on'); }); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
