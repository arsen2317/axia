/* Типограф: неразрывные пробелы, чтобы короткие слова не «висели» в конце строки.
   - после предлогов, союзов и других слов из 1–2 букв («в», «и», «на», «по», «не»…) и после частых
     трёхбуквенных предлогов («для», «без», «под»…) — неразрывный пробел: слово переносится вместе со следующим;
   - перед частицами «ли», «же», «бы» и перед тире — неразрывный пробел: они остаются на строке с предыдущим словом;
   - между числом и следующим словом («15 лет», «2026 года») и после «№», «§»;
   - между инициалами и фамилией («М. В. Ломоносова»).
   Работает на всех страницах и для текста, который появляется позже (формы, календарь, админка не трогается).
   Поля ввода, код и скрипты не изменяются. */
(function () {
  'use strict';
  var NB = ' ';
  var L = 'A-Za-zА-Яа-яЁё';
  var SHORT3 = 'без|для|над|под|при|про|изо|ото|обо|все|что|как|или|его|она|они|оно|это|нам|вам|нас|вас|них|ней';
  var reShort = new RegExp('(^|[\\s («„"\'—–-])([' + L + ']{1,2}|' + SHORT3 + '|' + upperFirst(SHORT3) + ')[ \\t]+', 'g');
  var reParticle = new RegExp('([' + L + '0-9.,!?»")])[ \\t]+(ли|ль|же|ж|бы|б)(?=$|[\\s .,:;!?…)»"])', 'g');
  var reDash = /[ \t]+([—–])/g;
  var reNum = new RegExp('(\\d)[ \\t]+(?=[' + L + '%‰°])', 'g');
  var reSign = /([№§])[ \t]+(?=\d)/g;
  var reInit = new RegExp('(^|[\\s («])([А-ЯЁA-Z]\\.)[ \\t]+(?=[А-ЯЁA-Z])', 'g');
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CODE: 1, PRE: 1, NOSCRIPT: 1, TEMPLATE: 1 };

  function upperFirst(list) { return list.split('|').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join('|'); }

  function fix(s) {
    if (s.indexOf(' ') < 0 && s.indexOf('\t') < 0) return s;
    var prev;
    do { prev = s; s = s.replace(reShort, '$1$2' + NB).replace(reInit, '$1$2' + NB); } while (s !== prev);   /* подряд: «и в мире», «М. В. Ломоносов» */
    return s.replace(reParticle, '$1' + NB + '$2').replace(reDash, NB + '$1').replace(reNum, '$1' + NB).replace(reSign, '$1' + NB);
  }
  function skip(node) {
    for (var el = node.parentNode; el && el.nodeType === 1; el = el.parentNode) {
      if (SKIP[el.tagName] || el.isContentEditable || (el.hasAttribute && el.hasAttribute('data-no-typo'))) return true;
    }
    return false;
  }
  function fixText(node) {
    var v = node.nodeValue, n = fix(v);
    if (n !== v && !skip(node)) node.nodeValue = n;
  }
  function walk(root) {
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 || SKIP[root.tagName]) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), t;
    while ((t = w.nextNode())) fixText(t);
  }

  window.typograph = { fix: fix, apply: walk };
  if (document.documentElement.hasAttribute('data-no-typo')) return;

  walk(document.body);
  /* текст, который добавляют скрипты (главная собирается React, новости в демо — из браузера) */
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === 'characterData') fixText(m.target);
      else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
