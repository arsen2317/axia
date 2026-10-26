/* dc-lite — маленький движок, который рисует разметку из <template> через React.
   Понимает синтаксис Claude Design: {{путь}} в тексте и атрибутах, onClick="{{fn}}", ref="{{fn}}",
   <sc-if value="{{x}}">…</sc-if>, <sc-for list="{{xs}}" as="x">…</sc-for> (внутри доступен {{$index}}).
   Логика страницы — класс, наследующий DCLogic (это обычный React.Component с методом renderVals()). */
(function () {
  'use strict';
  var h = React.createElement;

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;

  var ATTR_MAP = {
    'class': 'className', 'for': 'htmlFor', 'tabindex': 'tabIndex', 'autocomplete': 'autoComplete',
    'readonly': 'readOnly', 'maxlength': 'maxLength', 'minlength': 'minLength', 'colspan': 'colSpan',
    'rowspan': 'rowSpan', 'crossorigin': 'crossOrigin', 'novalidate': 'noValidate', 'autofocus': 'autoFocus',
    'inputmode': 'inputMode', 'enterkeyhint': 'enterKeyHint', 'srcset': 'srcSet', 'fetchpriority': 'fetchPriority',
    'contenteditable': 'contentEditable', 'spellcheck': 'spellCheck', 'datetime': 'dateTime',
    'accesskey': 'accessKey', 'enctype': 'encType', 'formnovalidate': 'formNoValidate', 'playsinline': 'playsInline',
    'xlink:href': 'xlinkHref', 'xml:space': 'xmlSpace', 'xmlns:xlink': 'xmlnsXlink'
  };
  var BOOL = { required: 1, disabled: 1, checked: 1, selected: 1, hidden: 1, novalidate: 1, readonly: 1,
    multiple: 1, autofocus: 1, open: 1, async: 1, defer: 1, loop: 1, muted: 1, playsinline: 1, controls: 1,
    autoplay: 1, formnovalidate: 1, inert: 1 };
  /* HTML-парсер приводит имена атрибутов к нижнему регистру (onClick → onclick): восстанавливаем имена событий React */
  var EVENTS = {};
  ['Click', 'DoubleClick', 'ContextMenu', 'MouseDown', 'MouseUp', 'MouseEnter', 'MouseLeave', 'MouseMove', 'MouseOver',
    'MouseOut', 'PointerDown', 'PointerUp', 'PointerEnter', 'PointerLeave', 'PointerMove', 'PointerOver', 'PointerOut',
    'PointerCancel', 'TouchStart', 'TouchEnd', 'TouchMove', 'KeyDown', 'KeyUp', 'KeyPress', 'Focus', 'Blur', 'Change',
    'Input', 'Submit', 'Reset', 'Invalid', 'Scroll', 'Wheel', 'Load', 'Error', 'AnimationEnd', 'AnimationStart',
    'TransitionEnd', 'DragStart', 'Drag', 'DragEnd', 'DragOver', 'DragEnter', 'DragLeave', 'Drop'
  ].forEach(function (e) { EVENTS['on' + e.toLowerCase()] = 'on' + e; });
  EVENTS.ondblclick = 'onDoubleClick';
  var NO_TEXT = { select: 1, table: 1, thead: 1, tbody: 1, tfoot: 1, tr: 1, colgroup: 1, ul: 0, ol: 0 };

  function camel(s) { return s.replace(/[-:]([a-z])/g, function (_, c) { return c.toUpperCase(); }); }

  function parseStyle(css) {
    var out = {};
    css.split(';').forEach(function (decl) {
      var i = decl.indexOf(':');
      if (i < 0) return;
      var k = decl.slice(0, i).trim(), v = decl.slice(i + 1).trim();
      if (!k) return;
      if (k.slice(0, 2) === '--') out[k] = v;
      else out[k.indexOf('-ms-') === 0 ? 'ms' + camel(k.slice(3)) : camel(k)] = v;
    });
    return out;
  }

  function lookup(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
    var parts = path.split('.'), v;
    for (var s = scope; s; s = s.$parent) {
      if (Object.prototype.hasOwnProperty.call(s.vars, parts[0])) { v = s.vars[parts[0]]; break; }
    }
    for (var i = 1; i < parts.length && v != null; i++) v = v[parts[i]];
    return v;
  }

  function evalAttr(raw, scope) {
    var m = WHOLE.exec(raw);
    if (m) return { hole: true, v: lookup(m[1], scope) };
    if (raw.indexOf('{{') < 0) return { hole: false, v: raw };
    return { hole: true, v: raw.replace(HOLE, function (_, p) { var x = lookup(p, scope); return x == null ? '' : String(x); }) };
  }

  /* Шаблон компилируется один раз в дерево функций; при каждом рендере дерево вызывается с текущими значениями */
  function compileChildren(parent, svg) {
    var tag = parent.nodeType === 1 ? parent.localName : '';
    var dropWs = !!NO_TEXT[tag];
    var out = [];
    for (var n = parent.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        var t = n.nodeValue;
        if (dropWs && !t.trim()) continue;
        out.push(compileText(t));
      } else if (n.nodeType === 1) {
        out.push(compileEl(n, svg));
      }
    }
    return out;
  }

  function compileText(t) {
    if (t.indexOf('{{') < 0) return function () { return t; };
    return function (scope) {
      return t.replace(HOLE, function (_, p) { var x = lookup(p, scope); return x == null ? '' : String(x); });
    };
  }

  function renderList(fns, scope) {
    var res = [];
    for (var i = 0; i < fns.length; i++) {
      var r = fns[i](scope);
      if (Array.isArray(r)) res.push.apply(res, r); else res.push(r);
    }
    return res;
  }

  function compileEl(el, svg) {
    var tag = el.localName;
    if (tag === 'sc-if') {
      var cond = el.getAttribute('value') || '';
      var kids = compileChildren(el.content || el, svg);
      return function (scope) {
        var v = evalAttr(cond, scope).v;
        return v ? h(React.Fragment, null, renderList(kids, scope)) : null;
      };
    }
    if (tag === 'sc-for') {
      var list = el.getAttribute('list') || '', as = el.getAttribute('as') || 'item';
      var body = compileChildren(el, svg);
      return function (scope) {
        var xs = evalAttr(list, scope).v || [];
        return xs.map(function (x, i) {
          var vars = { $index: i }; vars[as] = x;
          return h(React.Fragment, { key: (x && x.key != null) ? x.key : i }, renderList(body, { vars: vars, $parent: scope }));
        });
      };
    }

    var inSvg = svg || tag === 'svg';
    var attrs = [];
    var selectDefault = null;
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i], name = a.name;
      if (name.indexOf('hint-') === 0) continue;
      attrs.push([name, a.value]);
    }
    if (tag === 'select') {
      var opt = el.querySelector('option[selected]');
      if (opt) selectDefault = opt.hasAttribute('value') ? opt.getAttribute('value') : opt.textContent;
    }
    var textareaDefault = tag === 'textarea' ? el.textContent : null;
    var kidsEl = (tag === 'textarea') ? [] : compileChildren(el, inSvg);

    return function (scope) {
      var props = {};
      for (var j = 0; j < attrs.length; j++) {
        var name = attrs[j][0], r = evalAttr(attrs[j][1], scope), v = r.v, lname = name.toLowerCase();
        if (lname === 'style') { props.style = typeof v === 'string' ? parseStyle(v) : v; continue; }
        if (EVENTS[lname]) { if (typeof v === 'function') props[EVENTS[lname]] = v; continue; }
        if (name === 'ref') { if (v) props.ref = v; continue; }
        if (tag === 'option' && lname === 'selected') continue;
        if (BOOL[lname] && !r.hole) v = true;
        if (tag === 'input' && lname === 'checked' && !r.hole) { props.defaultChecked = true; continue; }
        if ((tag === 'input' || tag === 'textarea') && lname === 'value' && !r.hole) { props.defaultValue = v; continue; }
        var key = ATTR_MAP[lname] || (BOOL[lname] ? camel(lname) : null);
        if (!key) {
          if (lname.indexOf('aria-') === 0 || lname.indexOf('data-') === 0) key = lname;
          else if (inSvg && name.indexOf('-') > 0) key = camel(name);
          else key = name;
        }
        if (key === 'className' && v == null) continue;
        props[key] = v;
      }
      if (selectDefault != null) props.defaultValue = selectDefault;
      if (textareaDefault) props.defaultValue = textareaDefault;
      var children = renderList(kidsEl, scope);
      return h.apply(null, [tag, props].concat(children.length ? [children.map(keyed)] : []));
    };
  }

  function keyed(c, i) {
    return (c && typeof c === 'object' && c.key == null) ? React.cloneElement(c, { key: i }) : c;
  }

  function DCLogic(props) { React.Component.call(this, props); }
  DCLogic.prototype = Object.create(React.Component.prototype);
  DCLogic.prototype.constructor = DCLogic;
  DCLogic.prototype.renderVals = function () { return {}; };
  DCLogic.prototype.render = function () {
    var vals = this.renderVals() || {};
    var nodes = renderList(this.__dcTemplate, { vars: vals, $parent: null });
    return h(React.Fragment, null, nodes.map(keyed));
  };

  function mount(Logic, templateEl, container, props) {
    var tree = compileChildren(templateEl.content);
    Logic.prototype.__dcTemplate = tree;
    ReactDOM.createRoot(container).render(h(Logic, props || {}));
  }

  window.DCLogic = DCLogic;
  window.DC = { mount: mount };
})();
