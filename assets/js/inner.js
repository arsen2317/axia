/* Шапка и подвал на внутренних страницах (новости, статья, документы) — то же поведение, что на главной:
   - в самом верху страницы меню на десктопе развёрнуто в строку разделов, при скролле сжимается до «подпись + бургер»;
   - бургер (и логотип в плашке на планшете и мобильном) открывает список разделов; тап мимо меню или Esc — закрывает;
   - когда страница докручена почти до конца, «αξία» в подвале выезжает снизу. */
(function () {
  'use strict';
  var root = document.querySelector('.axia');
  if (!root) return;
  var nav = root.querySelector('.nav'), toggle = root.querySelector('.nav__toggle'), foot = root.querySelector('.foot');

  function setOpen(open) {
    if (!nav) return;
    nav.classList.toggle('is-open', open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  var desktop = function () { return root.clientWidth > 1056; };

  if (toggle) toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('is-open')); });
  var navLogo = root.querySelector('.logo--nav');
  if (navLogo) navLogo.addEventListener('click', function (e) {
    if (desktop()) return;                       /* планшет и мобильный: лого в плашке — часть кнопки меню */
    e.preventDefault();
    setOpen(!nav.classList.contains('is-open'));
  });
  if (nav) nav.addEventListener('mouseleave', function () { if (desktop()) setOpen(false); });
  document.addEventListener('pointerdown', function (e) { if (nav && !e.target.closest('.nav')) setOpen(false); }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });

  var ticking = false;
  function update() {
    ticking = false;
    var top = window.scrollY < 16;
    if (top !== root.classList.contains('is-top')) {
      root.classList.toggle('is-top', top);
      if (!top) setOpen(false);
    }
    if (foot) {
      var fr = foot.getBoundingClientRect(), vh = window.innerHeight;
      var near = fr.bottom - vh < Math.min(fr.height, vh) * 0.15 + 8;
      if (near) root.style.setProperty('--foot-up', '1');
      else if (fr.top > vh) root.style.setProperty('--foot-up', '0');
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();
