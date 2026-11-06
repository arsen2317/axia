/* Шапка и подвал на внутренних страницах (новости, статья, документы) — то же поведение, что на главной:
   - в самом верху страницы меню на десктопе развёрнуто в строку разделов, при скролле сжимается до «подпись + бургер»;
   - бургер (и логотип в плашке на планшете и мобильном) открывает список разделов; тап мимо меню или Esc — закрывает;
   - когда страница докручена почти до конца, «αξία» в подвале выезжает снизу;
   - над светлой страницей статьи меню и лого — серые;
   - если новости выключены в админке, пунктов «новости» в меню и подвале нет;
   - <body data-nav="pinned"> (политика конфиденциальности): меню на десктопе всегда развёрнуто, при скролле не сжимается. */
(function () {
  'use strict';
  var root = document.querySelector('.axia');
  if (!root) return;
  var nav = root.querySelector('.nav'), toggle = root.querySelector('.nav__toggle'), foot = root.querySelector('.foot');
  var logo = root.querySelector('.header > .logo'), cta = root.querySelector('.header .cta');

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

  /* новости выключены в админке (или статей нет) — прячем пункты «новости» в меню и подвале.
     На Vercel (демо, без PHP) — по настройке демо-админки в этом браузере */
  fetch('/api/settings.php', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.ok && d.newsVisible === false) root.classList.add('no-news');
  }).catch(function () {
    try { if ((JSON.parse(localStorage.getItem('axia-demo-settings')) || {}).newsEnabled === false) root.classList.add('no-news'); } catch (e) {}
  });

  var ticking = false;
  var pinned = document.body.getAttribute('data-nav') === 'pinned';
  function update() {
    ticking = false;
    var top = pinned || window.scrollY < 16;
    if (top !== root.classList.contains('is-top')) {
      root.classList.toggle('is-top', top);
      if (!top) setOpen(false);
    }
    /* над светлой страницей статьи плашка меню и лого становятся серыми (как над светлой «Командой» на главной);
       над тёмным подвалом — снова светлые */
    var artEl = root.querySelector('.art');   /* в демо статья появляется позже — ищем каждый раз */
    var art = artEl && artEl.closest('.pg-main');
    if (art) {
      var ar = art.getBoundingClientRect();
      var over = function (el) {
        if (!el) return false;
        var r = el.getBoundingClientRect();
        return r.width > 0 && ar.top < r.bottom && ar.bottom > r.top && ar.left < r.right && ar.right > r.left;
      };
      root.classList.toggle('is-light-nav', over(nav));
      root.classList.toggle('is-light-logo', over(logo));
      root.classList.toggle('is-light-cta', desktop() ? false : over(cta));   /* прозрачная кнопка внизу экрана (планшет, мобильный) */
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
