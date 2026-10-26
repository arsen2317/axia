/* аксиа — логика страницы (перенесено из Claude Design как есть).
   Разметка — в index.html, внутри <template id="page">. */
class Page extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { open: false, glReady: false, navLabel: 'О нас', dir: 0, apprStep: 0, tm: 0, tmPage: 0, tmPageN: 2, light: false, top: true, solOpen: -1 };
    /* ОБСУДИТЬ ЗАДАЧУ: свободные слоты приходят с сервера (/api/slots.php — рабочие часы минус занятость
       Яндекс Календаря). Если сервера нет (превью на Vercel, открытие файла) — показываем данные-примеры,
       а формы ничего не отправляют (this.demo) */
    const t0 = new Date(); this.today = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate());
    this.avail = new Set();
    this.slotMap = {};
    this.demo = false;
    this.captchaKey = '';
    this.openedAt = Date.now();
    Object.assign(this.state, {
      calY: this.today.getFullYear(), calM: this.today.getMonth(), selKey: null,
      slot: null, slotIso: '', step: 'cal', h24: true, guests: false, bookedEmail: '',
      modal: false, modalDone: false, msgEmail: '',
      bookingOn: true, busy: false, bookError: '', msgError: '', inlineError: '', inlineDone: false, inlineEmail: ''
    });
    this.calEl = null;
    this.setCal = (el) => { this.calEl = el; };
    this.personEl = null;
    this.setPerson = (el) => { this.personEl = el; if (el) this.updateMeet(); };
    this.sec = null;
    /* ПОДХОД: закреплённый экран, первое описание сменяется вторым на середине скролла */
    this.apprSec = null;
    this.setApprSection = (el) => { this.apprSec = el; if (el) this.updateAppr(); };
    this.solSec = null;
    this.setSol = (el) => { this.solSec = el; if (el) this.updateSol(); };
    this.wordsPanel = null;
    this.setWordsPanel = (el) => {
      if (el === this.wordsPanel) return;
      this.stopWords();
      this.wordsPanel = el;
      if (el) this.startWords(el);
    };
    this.setSection = (el) => { this.sec = el; if (el) { this.updateDirs(); this.updateDv(); } };
    this.whoSec = null;
    this.setWho = (el) => { this.whoSec = el; if (el) { this.updateWho(); this.updateAb(); } };
    this.root = null;
    this.setRoot = (el) => { this.root = el; };
    this.fieldCanvas = null;
    this.setField = (el) => {
      if (el === this.fieldCanvas) return;
      this.stopField();
      this.fieldCanvas = el;
      if (el) this.startField(el);
    };
    this.canvas = null;
    this.setCanvas = (el) => {
      if (el === this.canvas) return;
      this.stopGL();
      this.canvas = el;
      if (el) this.startGL(el);
    };
  }
  /* подпись в плашке меню = секция, которая сейчас на экране (атрибут data-nav-label) */
  componentDidMount() {
    this.ticking = false;
    this.onScroll = () => {
      /* доводчик «hero → Кто мы»: через паузу после остановки скролла */
      clearTimeout(this.snapT);
      if (!this.snapAnim) this.snapT = setTimeout(() => this.snapWho(), 220);
      if (this.ticking) return;
      this.ticking = true;
      requestAnimationFrame(() => { this.ticking = false; this.updateLabel(); this.updateDirs(); this.updateDv(); this.updateWho(); this.updateAb(); this.updateTmPages(); this.updateAppr(); this.updateSol(); });
    };
    this.updateLabel = () => {
      /* ищем секции по всему документу: ref корневого элемента в редакторе может не приходить */
      const doc = (this.sec && this.sec.ownerDocument) || (this.root && this.root.ownerDocument) || document;
      const win = doc.defaultView || window;
      const mid = win.innerHeight / 2;
      let label = 'О нас';
      doc.querySelectorAll('[data-nav-label]').forEach((el) => {
        const r = el.getBoundingClientRect();
        /* последняя секция, чей верх уже выше середины экрана: промежутки между секциями не сбрасывают подпись */
        if (r.top <= mid) label = el.getAttribute('data-nav-label');
      });
      if (label !== this.state.navLabel) this.setState({ navLabel: label });
      /* шапка над светлой «Командой» — тёмные лого и меню */
      const tmSec = doc.getElementById('team');
      let light = false;
      if (tmSec && tmSec.querySelector('.tm')) { const r = tmSec.getBoundingClientRect(); const hy = 52; light = r.top <= hy && r.bottom > hy; }
      /* планшет и мобильный: под плашкой меню — открытый (светлый) круг «задач» → тот же тёмный вариант меню.
         Плашка считается «над светлым», если светлый круг накрывает хотя бы 2 из 3 точек по её средней линии */
      /* планшет и мобильный: мерцает только круг «задач», который сейчас ближе всего к центру экрана */
      {
        const its = doc.querySelectorAll('.sol__item'), ax0 = its[0] && its[0].closest('.axia');
        let live = -1;
        if (ax0 && ax0.clientWidth <= 1024) {
          let best = Infinity; const vh0 = win.innerHeight;
          its.forEach((it, i) => { const r = it.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh0) return; const d0 = Math.abs((r.top + r.bottom) / 2 - vh0 / 2); if (d0 < best) { best = d0; live = i; } });
        }
        if (live !== (this.state.solLive ?? -1)) this.setState({ solLive: live });
      }
      let lightSol = false;
      if (!light) {
        const card = doc.querySelector('.sol__item.is-open .sol__card'), bar = doc.querySelector('.nav__bar');
        const axr0 = card && card.closest('.axia');
        if (card && bar && axr0 && axr0.clientWidth <= 1024) {
          const cr = card.getBoundingClientRect(), br = bar.getBoundingClientRect();
          const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2, R = cr.width / 2, y = br.top + br.height / 2;
          let n = 0;
          [0.15, 0.5, 0.85].forEach((f) => { const x = br.left + br.width * f; if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < R * R) n++; });
          light = lightSol = n >= 2;
        }
      }
      if (light !== !!this.state.light || lightSol !== !!this.state.lightSol) this.setState({ light, lightSol });
      /* на hero (пока скролл не начался) меню на десктопе развёрнуто в строку разделов */
      const heroEl = doc.getElementById('top');
      const atTop = heroEl ? heroEl.getBoundingClientRect().top > -16 : true;
      if (atTop !== !!this.state.top) this.setState(atTop ? { top: true } : { top: false, open: false });
      /* «αξία» растворяется по мере скролла: к моменту, когда «Направления» закрепятся, её уже не видно */
      const hero = doc.getElementById('top');
      const word = hero && hero.querySelector('.hero__word');
      if (word) {
        const hr = hero.getBoundingClientRect();
        const k = Math.min(Math.max(-hr.top / (hr.height * 0.85), 0), 1);
        word.style.opacity = (0.55 * (1 - k)).toFixed(3);
        const fld = hero.querySelector('.hd-field');
        if (fld) fld.style.opacity = (1 - k).toFixed(3);
      }
      /* НАПРАВЛЕНИЯ, планшет: анимации иллюстраций проигрываются один раз, когда карточки показались на экране */
      {
        const dirs = doc.getElementById('directions'), axr = dirs && dirs.closest('.axia');
        if (dirs && axr) {
          const cw = axr.clientWidth, dr = dirs.getBoundingClientRect();
          if (this.dvPlayed || (false && dr.top < win.innerHeight * 0.35 && dr.bottom > win.innerHeight * 0.5)) this.dvPlayed = true;
          axr.style.setProperty('--dv-play', this.dvPlayed ? 'running' : 'paused');
          /* мобильный: карточки друг под другом — анимация карточки проигрывается, когда карточка целиком
             на экране и её центр в средней части экрана; ушла с середины — анимация сбрасывается и при
             возвращении проиграется снова */
          if (cw <= 1024) {
            this.dvOnM = this.dvOnM || [false, false, false];
            const vhh = win.innerHeight;
            dirs.querySelectorAll('.dv__card').forEach((c, i) => {
              const r = c.getBoundingClientRect(), mid = (r.top + r.bottom) / 2;
              const inC = r.top >= -8 && r.bottom <= vhh + 8 && mid > vhh * 0.3 && mid < vhh * 0.7;
              const out = mid < vhh * 0.12 || mid > vhh * 0.88;
              const anims = () => { const a = []; c.querySelectorAll('.dv__art *').forEach((el) => { if (el.getAnimations) a.push(...el.getAnimations()); }); return a; };
              if (inC && !this.dvOnM[i]) { this.dvOnM[i] = true; anims().forEach((a) => { a.currentTime = 0; a.play(); }); }
              else if (out && this.dvOnM[i]) { this.dvOnM[i] = false; anims().forEach((a) => { a.pause(); a.currentTime = 0; }); }
            });
          }
        }
      }
      /* ПОДВАЛ: «αξία» выезжает снизу одной анимацией (не от скролла), когда страница почти докручена до конца;
         когда подвал ушёл за нижний край экрана — буквы снова опускаются (незаметно), чтобы анимация повторилась */
      const foot = doc.querySelector('.foot'), axRoot = foot && foot.closest('.axia');
      if (foot && axRoot) {
        const fr = foot.getBoundingClientRect(), vh = win.innerHeight;
        const near = fr.bottom - vh < Math.min(fr.height, vh) * 0.15 + 8;   /* до конца страницы осталось чуть-чуть */
        if (near && !this.footUp) this.footUp = true;
        else if (!near && this.footUp && fr.top > vh) this.footUp = false;
        axRoot.style.setProperty('--foot-up', this.footUp ? '1' : '0');   /* переменная, а не класс: класс корня сбрасывается при перерисовке */
      }
    };
    document.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
    window.addEventListener('resize', this.onScroll);
    this.startPaging();
    /* тап за пределами меню закрывает его */
    this.onOutside = (e) => {
      if (!this.state.open) return;
      const nav = e.target && e.target.closest ? e.target.closest('.nav') : null;
      if (!nav) this.setState({ open: false });
    };
    document.addEventListener('pointerdown', this.onOutside, true);
    /* Esc закрывает модальное окно */
    this.onKey = (e) => { if (e.key === 'Escape' && this.state.modal) this.setState({ modal: false }); };
    document.addEventListener('keydown', this.onKey);
    this.updateLabel();
    this.updateDirs();
    this.updateDv();
    this.updateTmPages(true);
    { const d = (this.root && this.root.ownerDocument) || document; if (d.fonts && d.fonts.ready) d.fonts.ready.then(() => this.updateTmPages(true)); }
    this.updateWho();
    this.updateAppr();
    this.loadBooking();
  }
  componentWillUnmount() {
    if (this.pagingStop) this.pagingStop();
    clearTimeout(this.snapT);
    this.stopGL();
    this.stopField();
    this.stopWords();
    document.removeEventListener('scroll', this.onScroll, { capture: true });
    window.removeEventListener('resize', this.onScroll);
    if (this.onKey) document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('pointerdown', this.onOutside, true);
  }

  /* ---- ФОН: паттерн рисуется в WebGL — мерцание гуляет по сетке, курсор его ведёт и подсвечивает (софит).
     Если WebGL недоступен, остаётся обычный SVG-паттерн. ---- */
  startGL(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    if (!gl) return;
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `
precision highp float;
uniform vec2 uRes; uniform float uDpr; uniform float uTime; uniform vec2 uMouse; uniform float uHover; uniform float uPortrait; uniform float uPhase;
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.); m=m*m; m=m*m;
  vec3 x=2.*fract(p*C.www)-1.; vec3 h=abs(x)-.5; vec3 ox=floor(x+.5); vec3 a0=x-ox;
  m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw; return 130.*dot(m,g);
}
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float cover(float dpx,float w){return clamp(w*.5+.5-abs(dpx),0.,1.);}
void main(){
  vec2 fc=gl_FragCoord.xy;
  vec2 V=uRes/uDpr;                       /* размер в css px */
  vec2 q=vec2(fc.x,uRes.y-fc.y)/uDpr;     /* css px, y вниз */
  float cov=0.;
  if(uPortrait>.5){
    /* вертикальный паттерн: 768 шириной, по ширине экрана, линии 1px */
    float s=V.x/768.; vec2 P=vec2(q.x,q.y-uPhase)/s;   /* uPhase — сдвиг сетки, общий с «Направлениями» */
    float dl=min(min(abs(P.x-39.),abs(P.x-384.)),abs(P.x-729.));
    float yy=P.y-235.; float dh=abs(yy-345.*floor(yy/345.+.5));
    float cy=235.+690.*floor((P.y-235.)/690.+.5);
    float dc=1e9;
    for(int k=-1;k<=1;k++){ dc=min(dc,abs(length(P-vec2(384.+690.*float(k),cy))-345.)); }
    cov=cover(min(min(dl,dh),dc)*s*uDpr,uDpr);
  } else {
    /* десктопный паттерн: 1200 шириной, по ширине экрана, бесшовно повторяется вниз с шагом 566
       (так же, как плитка фона в «Направлениях» — сетка продолжается без шва) */
    float s=V.x/1200.; vec2 P=q/s;
    float dl=min(min(abs(P.x-317.),abs(P.x-600.5)),abs(P.x-883.));
    float yy=P.y-259.; float dh=abs(yy-283.*floor(yy/283.+.5));
    float cy=259.+566.*floor((P.y-259.)/566.+.5);
    float dc=min(min(abs(length(P-vec2(34.,cy))-283.),abs(length(P-vec2(600.,cy))-283.)),abs(length(P-vec2(1166.,cy))-283.));
    cov=cover(min(min(dl,dh),dc)*s*uDpr,s*uDpr);
  }
  /* мерцание, которое «гуляет» по сетке; курсор сдвигает поле и усиливает его рядом с собой */
  float md=length(q-uMouse);
  vec2 nq=q/420.+(uMouse/V-.5)*.35*uHover;
  float n1=snoise(nq+vec2(uTime*.05,-uTime*.035));
  float n2=snoise(nq*1.7-vec2(uTime*.04,uTime*.06)+n1*.6);
  float shimmer=smoothstep(.25,.95,n1*.6+n2*.5)*.55;
  shimmer*=1.+.8*exp(-md*md/(2.*260.*260.))*uHover;
  float spot=exp(-md*md/(2.*95.*95.))*uHover*.75;   /* софит ~7.5rem */
  float glow=clamp(shimmer+spot,0.,1.);
  vec3 bg=vec3(.173,.271,.584);     /* #2C4595 */
  vec3 lineC=vec3(.247,.337,.624);  /* #3F569F */
  vec3 lit=vec3(.616,.690,.918);    /* #9DB0EA */
  vec3 col=mix(bg,mix(lineC,lit,glow*.7),cov);
  col+=(hash(fc+fract(uTime)*97.)-.5)*.018;   /* очень лёгкое зерно */
  gl_FragColor=vec4(col,1.);
}`;
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    if (!this.state.glReady) this.setState({ glReady: true });
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n) => gl.getUniformLocation(prog, n);
    const uRes = u('uRes'), uTime = u('uTime'), uMouse = u('uMouse'), uHover = u('uHover'), uDpr = u('uDpr'), uPortrait = u('uPortrait'), uPhase = u('uPhase');

    const win = canvas.ownerDocument.defaultView || window;
    const reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const st = { tx: .5, ty: .5, x: .5, y: .5, th: 0, h: 0 };
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      st.tx = (e.clientX - r.left) / r.width;
      st.ty = 1 - (e.clientY - r.top) / r.height;
      st.th = (st.tx >= 0 && st.tx <= 1 && st.ty >= 0 && st.ty <= 1) ? 1 : 0;
    };
    const onLeave = () => { st.th = 0; };
    const onUp = (e) => { if (e.pointerType !== 'mouse') st.th = 0; };  /* тач: после касания отклик затухает */
    win.addEventListener('pointermove', onMove, { passive: true });
    win.addEventListener('pointerdown', onMove, { passive: true });
    win.addEventListener('pointerup', onUp, { passive: true });
    win.document.addEventListener('pointerleave', onLeave);

    const portraitMq = win.matchMedia ? win.matchMedia('(orientation: portrait)') : null;
    const t0 = performance.now();
    const frame = () => {
      /* hero ушёл за верх экрана — не рисуем, экономим ресурсы */
      if (canvas.getBoundingClientRect().bottom <= 0) { this.raf = win.requestAnimationFrame(frame); return; }
      const dpr = Math.min(win.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
      st.x += (st.tx - st.x) * .035; st.y += (st.ty - st.y) * .035; st.h += (st.th - st.h) * .025;
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, reduce ? 0 : (performance.now() - t0) / 1000);
      gl.uniform2f(uMouse, st.x * canvas.clientWidth, (1 - st.y) * canvas.clientHeight);
      gl.uniform1f(uDpr, dpr);
      gl.uniform1f(uPortrait, portraitMq && portraitMq.matches ? 1 : 0);
      gl.uniform1f(uHover, st.h);
      gl.uniform1f(uPhase, this.patPhase || 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.raf = win.requestAnimationFrame(frame);
    };
    frame();
    this.glCleanup = () => {
      win.cancelAnimationFrame(this.raf);
      win.removeEventListener('pointermove', onMove);
      win.removeEventListener('pointerdown', onMove);
      win.removeEventListener('pointerup', onUp);
      win.document.removeEventListener('pointerleave', onLeave);
      const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
    };
  }
  /* НАПРАВЛЕНИЯ: прогресс скролла секции → ромбы едут по кругу, круг заливается, меняется активное направление */
  /* ---- НАПРАВЛЕНИЯ: знак аксиа → три карточки ----
     Модель в координатах ряда (u — вдоль ряда карточек, v — поперёк), нормированных на половину ряда (Uh) и половину карточки (Vh).
     Три детали знака (L, M, R) — прямоугольники, из которых вырезаны скруглённые «окна» (маски). Ключевые состояния:
     K2 — знак, повёрнутый на 90° (как «[ I ]»), K4 — детали разрослись, окна широкие, K5 — окна ушли в зазоры, детали стали карточками.
     Десктоп и планшет: ряд по горизонтали, в начале знак стоит вертикально (поворот 90° → 0°). Мобильный: столбик, без поворота. */
  dvLayout() {
    const sec = this.sec; if (!sec) return null;
    const st = sec.querySelector('.dirs__sticky'); if (!st) return null;
    const W = st.clientWidth, H = st.clientHeight;
    const doc = sec.ownerDocument, root = sec.closest('.axia');
    const px = parseFloat(getComputedStyle(root || doc.documentElement).fontSize) || 16;
    const ttl = st.querySelector('.dv__title');
    if (ttl && W <= 1024) ttl.style.top = '';   /* положение заголовка от десктопа (ниже) не переносим на планшет и мобильный */
    const tB = ttl ? ttl.offsetTop + ttl.offsetHeight : 0;
    const ctaEl = root ? root.querySelector('.header .cta') : null;
    let bot = H - 2.5 * px;
    if (ctaEl) { const cr = ctaEl.getBoundingClientRect(); if (cr.top > H / 2 && cr.top < H) bot = Math.min(bot, cr.top - 1.5 * px); }
    let g;
    if (W <= 640) {
      const gut = 1 * px, gap = 0.5 * px, top = tB + 1.5 * px;
      const cw = W - 2 * gut, ch = Math.max(120, (bot - top - 2 * gap) / 3);
      g = { vert: true, cx: W / 2, cy: top + (3 * ch + 2 * gap) / 2, Lc: ch, gap, Uh: (3 * ch + 2 * gap) / 2, Vh: cw / 2, rc: 0.75 * px, rot: false };
    } else {
      let Lc, gap, Hc;
      const top = tB + (W <= 1024 ? 3 : 3.5) * px;
      if (W <= 1024) { gap = 0.75 * px; Lc = (W - 5 * px - 2 * gap) / 3; Hc = Math.min(Lc * 2.2, bot - top); }   /* планшет: карточки выше — сверху иллюстрация */
      else {
        /* десктоп (макет): карточки во всю ширину между полями сетки, почти квадратные, с иллюстрацией сверху */
        const f = W / 1200, gut = ttl ? ttl.offsetLeft : 2.5 * px;
        gap = 16 * f; Lc = (W - 2 * gut - 2 * gap) / 3;
        /* карточки прижаты к низу секции (отступ — как поле сетки), заголовок — по центру свободной зоны
           между низом шапки и верхом карточек */
        const hdrB = 4.875 * px, tH = ttl ? ttl.offsetHeight : 0, minGap = 2.75 * px;
        const bot2 = H - gut;
        /* высота: ~квадрат, но не меньше, чем нужно под самый длинный текст + иллюстрацию (≈ 0.55 ширины) */
        Hc = Math.min(Math.max(Lc * 1.05, (this.dvTmax || 0) + Lc * 0.55 + 2.25 * px), bot2 - (hdrB + tH + 2 * minGap));
        Hc = Math.max(Hc, 200);
        const top2 = bot2 - Hc;
        if (ttl) ttl.style.top = ((hdrB + top2) / 2 - tH / 2).toFixed(1) + 'px';
        g = { vert: false, cx: W / 2, cy: top2 + Hc / 2, Lc, gap, Uh: (3 * Lc + 2 * gap) / 2, Vh: Hc / 2, rc: 0.75 * px, rot: true };
      }
      if (!g) {
      Hc = Math.max(Hc, 200);
      g = { vert: false, cx: W / 2, cy: top + Hc / 2, Lc, gap, Uh: (3 * Lc + 2 * gap) / 2, Vh: Hc / 2, rc: 0.75 * px, rot: true };
      }
    }
    /* K2: знак из логотипа (единицы viewBox 20×24, ряд — его вертикаль), масштаб k px на единицу */
    const k = Math.min(g.Uh * 0.0205, g.Vh * 0.05);
    const U = (u) => (u - 11.96) * k / g.Uh, V = (v) => (v - 9.925) * k / g.Vh, Rr = (r) => r * k / g.Vh;
    const K2 = {
      L: [U(0.18), U(6.06), V(0.26), V(19.66), Rr(1)],     hL: [U(3.39), U(8.2), V(1.97), V(18.03), Rr(2.37)],
      M: [U(7.99), U(15.82), V(3.93), V(16.03), Rr(0.15)], hML: [U(6.2), U(10.11), V(4.97), V(14.87), Rr(1.63)], hMR: [U(13.63), U(17.6), V(5.05), V(14.88), Rr(1.63)],
      R: [U(16.75), U(23.74), V(0), V(19.85), Rr(1)],      hR: [U(14.6), U(20.38), V(1.23), V(18.59), Rr(3.1)]
    };
    const e1 = (-g.Uh + g.Lc) / g.Uh, e2 = (g.Lc / 2) / g.Uh, rc = g.rc / g.Vh;
    const K4 = {
      L: [-0.671, -0.425, -0.942, 0.942, 0.07], hL: [-0.501, -0.168, -0.789, 0.789, 0.263],
      M: [-0.239, 0.239, -0.915, 0.915, 0.03], hML: [-0.501, -0.168, -0.789, 0.789, 0.263], hMR: [0.168, 0.501, -0.789, 0.789, 0.263],
      R: [0.425, 0.671, -0.942, 0.942, 0.07], hR: [0.168, 0.501, -0.789, 0.789, 0.263]
    };
    const K5 = {
      L: [-1, e1, -1, 1, rc], hL: [e1, -e2, -1.3, 1.3, 0],
      M: [-e2, e2, -1, 1, rc], hML: [e1, -e2, -1.3, 1.3, 0], hMR: [e2, -e1, -1.3, 1.3, 0],
      R: [-e1, 1, -1, 1, rc], hR: [e2, -e1, -1.3, 1.3, 0]
    };
    g.K2 = K2; g.K4 = K4; g.K5 = K5; g.W = W; g.H = H;
    return g;
  }
  updateDv() {
    const sec = this.sec; if (!sec) return;
    const win = sec.ownerDocument.defaultView || window, vh = win.innerHeight;
    const key = vh + 'x' + (sec.querySelector('.dirs__sticky') || {}).clientWidth;
    if (!this.dvGeo || this.dvKey !== key) { this.dvGeo = this.dvLayout(); this.dvKey = key; }
    const g = this.dvGeo; if (!g) return;
    const r = sec.getBoundingClientRect();
    /* анимация отключена: сразу финальное состояние — три статичные карточки */
    const p = 1;
    const sm = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
    const lerp = (A, B, t) => A.map((a, i) => a + (B[i] - a) * t);
    /* таймлайн (доля от 0.93 с): поворот 0.04–0.26, рост 0.26–0.62, раскладка в карточки 0.62–0.86, текст 0.84–0.97 */
    const rotT = g.rot ? sm(0.04, 0.26, p) : 1;
    const t1 = sm(0.26, 0.62, p), t2 = sm(0.62, 0.86, p);
    const st = {};
    Object.keys(g.K2).forEach((n) => { st[n] = t2 > 0 ? lerp(g.K4[n], g.K5[n], t2) : lerp(g.K2[n], g.K4[n], t1); });
    const box = (q) => {
      const a = g.cx, b = g.cy;
      let x1, x2, y1, y2;
      if (g.vert) { x1 = a + q[2] * g.Vh; x2 = a + q[3] * g.Vh; y1 = b + q[0] * g.Uh; y2 = b + q[1] * g.Uh; }
      else { x1 = a + q[0] * g.Uh; x2 = a + q[1] * g.Uh; y1 = b + q[2] * g.Vh; y2 = b + q[3] * g.Vh; }
      const w = Math.max(0, x2 - x1), h = Math.max(0, y2 - y1);
      return { x: x1, y: y1, w, h, r: Math.max(0, Math.min(q[4] * g.Vh, w / 2, h / 2)) };
    };
    const set = (el, q) => {
      if (!el) return; const b = box(q), s = el.style;
      s.setProperty('x', b.x.toFixed(2) + 'px'); s.setProperty('y', b.y.toFixed(2) + 'px');
      s.setProperty('width', b.w.toFixed(2) + 'px'); s.setProperty('height', b.h.toFixed(2) + 'px');
      s.setProperty('rx', b.r.toFixed(2) + 'px'); s.setProperty('ry', b.r.toFixed(2) + 'px');
    };
    ['L', 'M', 'R'].forEach((n) => set(sec.querySelector('.dv-p' + n), st[n]));
    ['hL', 'hML', 'hMR', 'hR'].forEach((n) => set(sec.querySelector('.dv-h' + n.slice(1)), st[n]));
    const gEl = sec.querySelector('.dv__g');
    if (gEl) { gEl.style.transformOrigin = g.cx.toFixed(1) + 'px ' + g.cy.toFixed(1) + 'px'; gEl.style.transform = 'rotate(' + (90 * (1 - rotT)).toFixed(2) + 'deg)'; }
    /* карточки с текстом — поверх финальных прямоугольников */
    const K = g.K5;
    sec.querySelectorAll('.dv__card').forEach((c, i) => {
      const b = box(K[['L', 'M', 'R'][i]]), s = c.style;
      s.left = b.x.toFixed(1) + 'px'; s.top = b.y.toFixed(1) + 'px'; s.width = b.w.toFixed(1) + 'px'; s.height = b.h.toFixed(1) + 'px';
    });
    sec.style.setProperty('--dv-t', sm(0.84, 0.97, p).toFixed(3));
    /* иллюстрации у всех карточек — одинаковой высоты и на одном уровне: место под ними начинается
       ниже самого длинного текста среди трёх карточек (--dv-tmax) */
    {
      let tmax = 0;
      sec.querySelectorAll('.dv__card').forEach((c) => { const d = c.querySelector('.dv__desc'); if (d) tmax = Math.max(tmax, d.offsetTop + d.offsetHeight); });
      sec.style.setProperty('--dv-tmax', tmax.toFixed(1) + 'px');
      /* текст оказался длиннее/короче, чем при расчёте высоты карточек — пересчитать раскладку */
      if (tmax > 0 && Math.abs(tmax - (this.dvTmax || 0)) > 1) {
        this.dvTmax = tmax; this.dvKey = null;
        const w = sec.ownerDocument.defaultView || window;
        w.requestAnimationFrame(() => this.updateDv());
      }
    }
  }
  /* КТО МЫ: обводка круга прорисовывается по часовой стрелке — от момента, когда верх круга появился снизу экрана,
     до момента, когда центр круга дошёл до центра свободной области экрана. Скролл страницы не меняется */
  /* ДОВОДЧИК ЭКРАНОВ: прокрутка обычная; когда остановились (≈0,15 с без движения), страница плавно доезжает
     до ближайшего экрана с учётом направления: прокрутили вниз дальше 15% экрана от экрана — едем к следующему,
     меньше — возвращаемся. Экраны: hero, «о нас» (1-й и 2-й абзац), «направления», «решения», «команда»,
     «обсудить задачу». Внутри «решений», высокой «команды» и «обсудить задачу» с подвалом — без доводки.
     Любое касание колеса / пальца / клавиш прерывает доводку. Десктоп и планшет; на мобильном — без доводки. */
  startPaging() {
    const doc = (this.root && this.root.ownerDocument) || document, win = doc.defaultView || window;
    let anim = null, timer = 0, startY = null, touching = false, selfScroll = false, restY = 0;   /* restY — где страница стояла до жеста */
    const scroller = () => {
      let sc = doc.querySelector('.ab') || doc.querySelector('section');
      sc = sc && sc.parentElement;
      while (sc && sc !== doc.body && sc !== doc.documentElement) {
        const oy = getComputedStyle(sc).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && sc.scrollHeight > sc.clientHeight + 1) return sc;
        sc = sc.parentElement;
      }
      return null;
    };
    const geo = () => {
      const sc = scroller();
      const vh = sc ? sc.clientHeight : win.innerHeight, W = sc ? sc.clientWidth : win.innerWidth;
      const y = sc ? sc.scrollTop : (win.scrollY || doc.documentElement.scrollTop);
      const max = sc ? sc.scrollHeight - sc.clientHeight : doc.documentElement.scrollHeight - win.innerHeight;
      const top0 = sc ? sc.getBoundingClientRect().top : 0;
      const at = (el) => el ? Math.round(el.getBoundingClientRect().top - top0 + y) : null;
      const q = (s) => doc.querySelector(s);
      const pts = [0], free = [];
      const ab = q('.ab');
      if (ab) { const t = at(ab); pts.push(t, t + Math.max(0, ab.offsetHeight - vh)); }
      const dirs = q('#directions'); if (dirs) pts.push(at(dirs));
      const sol = q('.sol');
      if (sol) {
        const t = at(sol), pb = parseFloat(getComputedStyle(sol).paddingBottom) || 0, b = t + Math.max(0, sol.offsetHeight - pb - vh);
        pts.push(t, b); free.push([t, b]);
      }
      const team = q('.team');
      if (team) { const t = at(team); pts.push(t); if (team.offsetHeight > vh + 4) { pts.push(t + team.offsetHeight - vh); free.push([t, t + team.offsetHeight - vh]); } }
      const meet = q('.meet');
      if (meet) { const t = at(meet); pts.push(t); free.push([t, max + 1]); }
      const P = [...new Set(pts.filter((v) => v != null).map((v) => Math.min(Math.max(v, 0), max)))].sort((a, b) => a - b);
      return { sc, vh, W, y, max, pts: P, free };
    };
    const setY = (sc, v) => { if (sc) sc.scrollTop = v; else win.scrollTo(0, v); };
    const stop = () => { if (anim) { win.cancelAnimationFrame(anim); anim = null; } selfScroll = false; };
    const go = (g, to) => {
      const from = g.y, d = to - from;
      if (Math.abs(d) < 2) return;
      const dur = Math.min(900, Math.max(450, Math.abs(d) * 0.9));
      const t0 = performance.now();
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      stop(); selfScroll = true;
      const step = (now) => {
        const t = Math.min((now - t0) / dur, 1);
        setY(g.sc, from + d * ease(t));
        if (t < 1) anim = win.requestAnimationFrame(step);
        else { anim = null; restY = to; win.setTimeout(() => { selfScroll = false; startY = null; }, 60); }
      };
      anim = win.requestAnimationFrame(step);
    };
    const settle = () => {
      if (touching || anim) return;
      const g = geo();
      if (g.W <= 1024) { startY = null; return; }   /* планшет и мобильный — без доводчика */
      const y = g.y, dir = Math.sign(y - (startY == null ? restY : startY));
      startY = null; restY = y;
      for (const [a, b] of g.free) if (y > a + 2 && y < b - 2) return;          /* внутри свободной зоны */
      let prev = null, next = null;
      for (const p of g.pts) { if (p <= y + 1) prev = p; else if (next == null) next = p; }
      if (prev != null && Math.abs(y - prev) <= 1) return;                       /* уже на экране */
      if (prev == null) prev = 0;
      if (next == null) return;
      const th = g.vh * 0.15;
      let to;
      if (dir > 0) to = y - prev > th ? next : prev;
      else if (dir < 0) to = next - y > th ? prev : next;
      else to = (y - prev) < (next - y) ? prev : next;
      go(g, to);
    };
    const onScroll = () => {
      if (selfScroll) return;
      if (startY == null) startY = restY;
      win.clearTimeout(timer);
      timer = win.setTimeout(settle, 160);
    };
    const onInput = () => { if (anim) stop(); };
    const onTouchStart = () => { touching = true; onInput(); };
    const onTouchEnd = () => { touching = false; win.clearTimeout(timer); timer = win.setTimeout(settle, 220); };
    doc.addEventListener('scroll', onScroll, { capture: true, passive: true });
    win.addEventListener('wheel', onInput, { passive: true });
    win.addEventListener('mousedown', onInput);
    win.addEventListener('keydown', onInput);
    win.addEventListener('touchstart', onTouchStart, { passive: true });
    win.addEventListener('touchend', onTouchEnd, { passive: true });
    this.pagingStop = () => {
      stop(); win.clearTimeout(timer);
      doc.removeEventListener('scroll', onScroll, { capture: true });
      win.removeEventListener('wheel', onInput); win.removeEventListener('mousedown', onInput); win.removeEventListener('keydown', onInput);
      win.removeEventListener('touchstart', onTouchStart); win.removeEventListener('touchend', onTouchEnd);
    };
  }
  /* «О НАС»: смена абзацев справа по фейду — от прогресса закреплённой секции */
  updateAb() {
    const sec = this.whoSec; if (!sec || !sec.classList.contains('ab')) return;
    const vh = (sec.ownerDocument.defaultView || window).innerHeight;
    const r = sec.getBoundingClientRect(), S = Math.max(1, sec.offsetHeight - vh);
    const p = Math.min(Math.max(-r.top / S, 0), 1);
    const t = Math.min(Math.max((p - 0.3) / 0.4, 0), 1);
    sec.style.setProperty('--ab-f', (t * t * (3 - 2 * t)).toFixed(3));
  }
  updateWho() {
    const sec = this.whoSec; if (!sec) return;
    const vh = (sec.ownerDocument.defaultView || window).innerHeight;
    const r = sec.getBoundingClientRect();
    const cy = this.whoCy || sec.offsetHeight / 2, R = this.whoR || 0, T = this.whoT || vh / 2;
    const top = r.top + cy - R;                         /* верх круга во вьюпорте */
    /* старт — когда во вьюпорте уже треть круга (верх круга на ⅓ диаметра выше низа экрана) */
    const start = vh - (2 * R) / 3, end = T - R;
    const span = Math.max(1, start - end);
    const p = Math.min(Math.max((start - top) / span, 0), 1);
    sec.style.setProperty('--who-a', (p * 360).toFixed(2) + 'deg');
  }
  /* ДОВОДЧИК между hero и «Кто мы»: если скролл остановился в пустом промежутке сетки
     (hero уже ушёл, а круг «Кто мы» ещё не дошёл до центра), плавно доводим:
     вниз — до круга по центру экрана, вверх — обратно к началу hero. Сам скролл страницы не перехватываем. */
  snapWho() {
    return;   /* «о нас» закреплена — доводчик между hero и «о нас» не нужен */
    const sec = this.whoSec; if (!sec) return;
    const doc = sec.ownerDocument, win = doc.defaultView || window;
    const vh = win.innerHeight;
    const r = sec.getBoundingClientRect();
    const dir = this.snapPrev == null ? 0 : Math.sign(this.snapPrev - r.top);   /* 1 — вниз, −1 — вверх */
    this.snapPrev = r.top;
    if (this.snapping) { this.snapping = false; return; }               /* это остановка после нашего же доводчика */
    const cy = this.whoCy || sec.offsetHeight / 2, T = this.whoT || vh / 2;
    const c = r.top + cy;                                                /* центр круга во вьюпорте */
    const gap = c - T;                                                   /* сколько ещё до круга по центру */
    let delta = 0;
    /* только в промежутке, где hero ещё виден (верх секции ниже верха экрана), а круг ниже центра */
    if (r.top > 0 && r.top < vh * 0.9 && gap > 8) {
      if (dir < 0) { if (r.top > vh * 0.45) delta = r.top - vh; }
      else if (dir > 0) delta = gap;
    }
    if (Math.abs(delta) < 2) return;
    let sc = sec.parentElement;
    while (sc && sc !== doc.body && sc !== doc.documentElement) {
      const oy = getComputedStyle(sc).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && sc.scrollHeight > sc.clientHeight + 1) break;
      sc = sc.parentElement;
    }
    const isDoc = !sc || sc === doc.body || sc === doc.documentElement;
    const getY = () => isDoc ? (win.scrollY || doc.documentElement.scrollTop) : sc.scrollTop;
    const setY = (y) => { if (isDoc) win.scrollTo(0, y); else sc.scrollTop = y; };
    const reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const y0 = getY();
    if (reduce) { this.snapping = true; setY(y0 + delta); return; }
    /* плавная доводка: своё ease-in-out, длительность от расстояния (0.9–1.6 с); любое действие пользователя её прерывает */
    const dur = Math.min(1600, Math.max(900, 700 + Math.abs(delta) * 1.1));
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    let t0 = null, stop = false;
    const cancel = () => { stop = true; };
    const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    evs.forEach((e) => win.addEventListener(e, cancel, { passive: true, once: true }));
    const done = () => { evs.forEach((e) => win.removeEventListener(e, cancel)); this.snapAnim = false; };
    this.snapAnim = true;
    const step = (now) => {
      if (stop) { done(); return; }
      if (t0 == null) t0 = now;
      const k = Math.min(1, (now - t0) / dur);
      setY(y0 + delta * ease(k));
      if (k < 1) win.requestAnimationFrame(step); else { this.snapping = true; done(); }
    };
    win.requestAnimationFrame(step);
  }
  /* КОМАНДА: разбивка описания на страницы. Основной текст и «подробнее» (абзац с data-br) — всегда разные страницы;
     на десктопе, если абзацы не помещаются по высоте колонки, лишние переносятся на следующую страницу */
  tmPagesSoon(anim) {
    const win = (this.root && this.root.ownerDocument.defaultView) || window;
    try { const s = win.getSelection && win.getSelection(); if (s && s.rangeCount) s.removeAllRanges(); } catch (e) {}
    win.requestAnimationFrame(() => this.updateTmPages(true, anim));
  }
  updateTmPages(force, anim) {
    const root = this.root || document.querySelector('.axia'); if (!root) return;
    const tm = root.querySelector('.tm'); if (!tm) return;
    const win = root.ownerDocument.defaultView || window;
    const key = win.innerWidth + 'x' + win.innerHeight;
    if (!force && key === this.tmPgKey) return;
    this.tmPgKey = key;
    const desktop = root.clientWidth > 1024;
    const map = [];
    tm.querySelectorAll('.tm__card').forEach((card) => {
      const flow = card.querySelector('.tm__flow'), desc = flow && flow.querySelector('.tm__desc');
      if (!flow || !desc) { map.push([]); return; }
      const ps = Array.from(desc.querySelectorAll('p'));
      /* меряем все абзацы в естественном виде: временно показываем их поверх классов и с обычным отступом */
      const saved = ps.map((p) => p.className);
      ps.forEach((p) => { p.className = 'tm__p'; });
      const gap = ps.length > 1 ? parseFloat(getComputedStyle(ps[1]).marginTop) || 0 : 0;
      const H = desktop ? flow.clientHeight - desc.offsetTop : Infinity;
      const pg = []; let page = 0, h = 0, cnt = 0;
      ps.forEach((p) => {
        const ph = p.offsetHeight;
        if (cnt && (p.hasAttribute('data-br') || h + gap + ph > H)) { page++; h = 0; cnt = 0; }
        h += (cnt ? gap : 0) + ph; cnt++; pg.push(page);
      });
      ps.forEach((p, i) => { p.className = saved[i]; });
      map.push(pg);
    });
    const sig = JSON.stringify(map);
    const cur = this.state.tm || 0;
    const n = map[cur] && map[cur].length ? map[cur][map[cur].length - 1] + 1 : 2;
    const upd = {};
    if (sig !== this.tmMapSig) { this.tmMap = map; this.tmMapSig = sig; upd.tmMapV = (this.state.tmMapV || 0) + 1; }
    if (n !== this.state.tmPageN) upd.tmPageN = n;
    if ((this.state.tmPage || 0) > n - 1) upd.tmPage = n - 1;
    if (Object.keys(upd).length) this.setState(upd);
    if (anim) {
      const card = tm.querySelectorAll('.tm__card')[cur], flow = card && card.querySelector('.tm__flow');
      if (flow && flow.animate) flow.animate([{ opacity: 0, transform: 'translateX(0.75rem)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'ease' });
    }
  }
  /* класс абзаца описания: на какой странице он (карта — из updateTmPages; до замера: основное / подробнее) */
  tmQ(ci, pi, br) {
    const map = this.tmMap && this.tmMap[ci];
    const known = map && map.length > pi;
    const page = known ? map[pi] : (pi >= br ? 1 : 0);
    const cur = (this.state.tm || 0) === ci ? (this.state.tmPage || 0) : 0;
    const first = known ? (pi === 0 || map[pi - 1] !== page) : (pi === 0 || pi === br);
    return 'tm__p' + (page === cur ? '' : ' is-hidden') + (first ? ' is-first' : '');
  }
  updateDirs() {
    const sec = this.sec; if (!sec) return;
    const N = 3, STEP = 40;                       /* 3 направления, 40° между ромбами */
    const win = sec.ownerDocument.defaultView || window;
    const r = sec.getBoundingClientRect();
    const span = r.height - win.innerHeight;
    const vh = win.innerHeight;
    /* a0 — угол первого ромба (0° = верх круга, по часовой). Заливка всегда заканчивается ровно на нём */
    let e, a0;
    if (r.top > 0) {
      /* секция въезжает снизу: первый ромб едет от левого края круга (−90°) к верху, заливка тянется за ним;
         наверх он встаёт ровно в момент, когда секция закрепляется во вьюпорте */
      const x = Math.min(Math.max(1 - r.top / vh, 0), 1);
      e = 0;
      a0 = -90 * (1 - x * x * (3 - 2 * x));
    } else {
      const p = span > 0 ? Math.min(Math.max(-r.top / span, 0), 1) : 0;
      /* «ступеньки»: на каждом направлении ромбы ненадолго замирают */
      const s = p * (N - 1), k = Math.min(Math.floor(s), N - 2), f = s - k;
      const t = Math.min(Math.max((f - 0.25) / 0.5, 0), 1);
      e = k + t * t * (3 - 2 * t);
      a0 = e * STEP;
    }
    sec.style.setProperty('--fill', (90 + a0).toFixed(2) + 'deg');
    /* вертикальные экраны: круг ставим туда, где ему место по композиции,
       а фоновую сетку сдвигаем (--pat-phase / uPhase) так, чтобы её горизонтальная линия прошла ровно по верху круга.
       Сдвиг общий для hero и «Направлений», поэтому шва между секциями нет. */
    const sticky = sec.querySelector('.dirs__sticky');
    const root = sec.closest('.axia');
    if (sticky && root) {
      const W = win.innerWidth;
      if (win.matchMedia && win.matchMedia('(orientation: portrait)').matches) {
        let target;
        if (W <= 640) {
          /* мобильный: блок «заголовок + круг + текст» — по центру свободной области между меню и кнопкой */
          const px = parseFloat(getComputedStyle(root).fontSize) || 16;
          let tH = 0, xH = 0;
          sticky.querySelectorAll('.dirs__title').forEach((t) => { tH = Math.max(tH, t.offsetHeight); });
          sticky.querySelectorAll('.dirs__text').forEach((t) => { xH = Math.max(xH, t.offsetHeight); });
          const navEl = root.querySelector('.nav-slot');
          const ctaEl = root.querySelector('.header .cta');
          const top0 = navEl ? navEl.getBoundingClientRect().bottom : 64;
          const bot0 = ctaEl ? vh - (vh - ctaEl.getBoundingClientRect().top) : vh;
          const above = 2 * px + tH, below = 4.5 * px + xH;   /* отступы из CSS: 2rem над кругом, 4.5rem до текста */
          target = (top0 + bot0) / 2 - (below - above) / 2;
        } else {
          target = vh * 0.57;
        }
        const sc = W / 768, P = 345 * sc;
        /* линии сетки на странице: 235·sc + P·k + phase; в закреплённом экране — минус высота hero (vh) */
        let phase = (target - 235 * sc + vh) % P; if (phase < 0) phase += P;
        this.patDn0 = phase;                       /* фаза сетки «Направлений» (дальше от неё считается и hero — см. «Кто мы») */
        root.style.setProperty('--ring-top', target.toFixed(1) + 'px');
      } else {
        this.patDn0 = 0;
        root.style.removeProperty('--ring-top');
      }
    }
    /* зазор перед «Подходом»: чтобы секция начиналась ровно на горизонтальной линии сетки */
    if (root) {
      const W = win.innerWidth;
      const portrait = win.matchMedia && win.matchMedia('(orientation: portrait)').matches;
      const sc = portrait ? W / 768 : W / 1200, P = (portrait ? 345 : 283) * sc, y0 = (portrait ? 235 : 259) * sc;
      /* КТОМЫ (между hero и «Направлениями»), обычная секция без закрепления. Центр круга — на центре
         центральной окружности сетки (центры через две линии, шаг 2P), сверху и снизу от центра — не меньше полуэкрана.
         Горизонтальные экраны: hero без сдвига (фаза 0) — запас сетки уходит в верхнюю часть секции.
         Вертикальные: фазу «Направлений» диктует круг-прогресс (patDn0) — запас уходит в нижнюю часть.
         Всё, что ниже «Кто мы», использует фазу --pat-dn (= фаза hero − высота секции). */
      let D = this.patDn0 || 0;
      {
        const P2 = Math.max(2 * P, 50), yc = y0, rr = (portrait ? 345 : 283) * sc;
        const md = (a) => ((a % P2) + P2) % P2;
        const px = parseFloat(getComputedStyle(root).fontSize) || 16;
        root.style.setProperty('--who-r', rr.toFixed(1) + 'px');
        const bodyEl = root.querySelector('.who__body');
        const bh = Math.min(bodyEl ? bodyEl.offsetHeight : 0, 4 * vh);   /* текст может быть выше круга (мобильный) */
        const cmin = Math.max(rr + 3 * px, vh / 2, bh / 2 + 2.5 * px);
        const navEl = root.querySelector('.nav-slot'), ctaEl = root.querySelector('.header .cta');
        const top0 = navEl ? navEl.getBoundingClientRect().bottom : 78;
        let bot0 = vh;
        if (ctaEl) { const cr = ctaEl.getBoundingClientRect(); if (cr.top > vh / 2 && cr.top < vh) bot0 = cr.top; }
        /* hero: ряд центров окружностей (центральная горизонталь) — ровно посередине экрана, три круга видны целиком.
           «Кто мы» — следующий ряд окружностей, первый, чей центр уже ниже hero */
        const H = md(vh / 2 - yc);
        let cy = vh / 2 + P2; while (cy < vh) cy += P2;
        cy -= vh;                                       /* центр круга «О нас» от верха секции */
        for (let i = 0; i < 20 && cy < bh / 2 + 2 * px; i++) cy += P2;   /* текст не заходит выше начала секции */
        let hs;
        /* «О НАС» закреплена: высота = экран + S, S кратно высоте плитки паттерна (сетка дальше без шва) */
        const tileH = portrait ? 690 * W / 768 : 566 * W / 1200;
        const S = Math.max(1, Math.round((1.5 * vh) / tileH)) * tileH;
        if (W <= 1024) {
          /* планшет и мобильный: не закрепляется — оба абзаца сразу; высота — экран или сколько нужно тексту */
          const abc = root.querySelector('.ab__content');
          let need = vh;
          if (abc) {
            const cs = getComputedStyle(abc), kids = Array.from(abc.children);
            need = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
              + kids.reduce((a, k) => a + k.offsetHeight, 0) + (parseFloat(cs.rowGap) || 0) * Math.max(0, kids.length - 1);
          }
          hs = Math.max(vh, Math.ceil(need));
        } else hs = vh + S;
        D = H - hs;
        this.patPhase = H; this.patDn = D;
        this.whoCy = cy; this.whoR = rr; this.whoT = (top0 + bot0) / 2;
        root.style.setProperty('--pat-phase', H.toFixed(1) + 'px');
        root.style.setProperty('--pat-dn', D.toFixed(1) + 'px');
        root.style.setProperty('--who-h', hs.toFixed(1) + 'px');
        root.style.setProperty('--who-cy', cy.toFixed(1) + 'px');
        root.style.setProperty('--who-r', rr.toFixed(1) + 'px');
      }
      const ph = D;
      /* «Подхода» больше нет: после «Направлений» — зазор сетки (--appr-gap), подобранный так, чтобы центр ряда кругов
         «Решений» встал между двумя горизонталями сетки в лучшем месте экрана (под заголовком, над низом) */
      let gap = 0;
      {
        const px0 = parseFloat(getComputedStyle(root).fontSize) || 16;
        const solEl0 = root.querySelector('.sol');
        /* зазор — минимально возможный: круги «Решений» встают между ЛЮБОЙ парой соседних горизонталей сетки,
           лишь бы ряд помещался под заголовком и над низом экрана. Если пара уже помещается — зазора нет вовсе,
           иначе сдвигаем ровно настолько, чтобы ближайшая пара поднялась в допустимую зону (меньше шага сетки) */
        if (solEl0 && !portrait && P > 1) {
          const it = solEl0.querySelector('.sol__item'), tt = solEl0.querySelector('.sol__title');
          const d0 = it ? it.offsetWidth : 0, tH0 = tt ? tt.offsetHeight : 0;
          const minY0 = 6.5 * px0 + tH0 + 3.5 * px0 + d0 / 2 + (W <= 1024 ? d0 * 0.1 : 0);
          const maxY0 = vh - d0 / 2 - 2 * px0;   /* низ кругов — не ближе 2rem к низу экрана */
          let base0 = (y0 + ph - 2 * vh) % P; if (base0 < 0) base0 += P;
          let fits = false, next = Infinity;
          for (let c = base0 - P / 2; c < vh + 2 * P; c += P) {
            if (c >= minY0 - 0.5 && c <= maxY0 + 0.5) { fits = true; break; }
            if (c > maxY0 && c < next) next = c;
          }
          if (!fits && next < Infinity && maxY0 >= minY0) gap = Math.max(0, next - maxY0);
          if (!(gap >= 0 && gap < P - 0.5)) gap = 0;
        }
      }
      root.style.setProperty('--appr-gap', gap.toFixed(1) + 'px');
      /* КОМАНДА: центры фото — на горизонтальной линии сетки (первая линия, над которой помещается заголовок) */
      const team = root.querySelector('.team');
      if (team) {
        const px = parseFloat(getComputedStyle(root).fontSize) || 16;
        const mobile = W <= 640;
        const D = portrait ? (mobile ? (W - 2 * px - 3 * 0.5 * px) / 2 + 0.5 * px : W <= 1024 ? (W - 5 * px - 3 * 0.5 * px) / 2 + 0.5 * px : W * 0.26) : W * 0.20;   /* вертикальные экраны: две колонки (поля 16 / 40) */
        const titleOff = (mobile ? 6.5 : 9) * px;
        const minY = (portrait ? 2 : 7) * px + titleOff + D / 2;   /* на вертикальных — без лишнего отступа сверху */
        /* «Подхода» нет: в формулах сетки ниже его экран (vh) больше не участвует — компенсируем отрицательной «лишней высотой» */
        /* мобильный: «Направления» выше экрана (карточки друг под другом) — сетка следующих секций сдвигается на эту разницу */
        const dirsEl = root.querySelector('#directions');
        const apprExtra = -vh + (W <= 1024 && dirsEl ? Math.max(0, dirsEl.offsetHeight - vh) : 0);
        root.style.setProperty('--appr-extra', apprExtra.toFixed(1) + 'px');
        /* «Решения» (между «Подходом» и «Командой»): центр ряда кругов — на горизонтальной линии сетки.
           Фон «Решений» закреплён и показывает сетку со сдвигом 3vh + gap + apprExtra − phase */
        const sol = root.querySelector('.sol');
        if (sol) {
          const item = sol.querySelector('.sol__item'), ttl = sol.querySelector('.sol__title');
          const d = item ? item.offsetWidth : 0, tH = ttl ? ttl.offsetHeight : 0;
          const minY = (portrait ? 5.5 : 6.5) * px + tH + 3.5 * px + d / 2 + (W <= 1024 ? d * 0.1 : 0);   /* на планшете и мобильном — ещё высота выступающего номера */
          const maxY = vh - d / 2 - 1 * px;
          let cy = Math.max(minY, Math.min(vh * 0.6, maxY));
          if (!portrait) {
            /* круг вписан между двумя соседними горизонтальными линиями: верх на линии, низ на следующей */
            const off = ph - 3 * vh - gap - apprExtra;
            let base = (y0 + off) % P; if (base < 0) base += P;
            /* лучшая пара линий: помещается под заголовком и над низом экрана; если идеальной нет — с наименьшим заходом
               (заход вверх, на заголовок, штрафуем сильнее, чем вниз) */
            let best = null, bestPen = Infinity;
            for (let y = base - P; y < vh + P; y += P) {
              const c = y + P / 2;
              const pen = Math.max(0, minY - c) * 3 + Math.max(0, c - maxY) + Math.abs(c - vh * 0.62) * 0.01;
              if (pen < bestPen) { bestPen = pen; best = c; }
            }
            if (best !== null) cy = best;
          }
          sol.style.setProperty('--sol-cy', cy.toFixed(1) + 'px');
          /* десктоп: после ряда кругов — отступ до «Команды»: её верх ложится на следующую горизонталь сетки под кругами */
          if (!portrait && d) {
            const below = vh - (cy + d / 2);
            let pb = P - below; while (pb < 2 * px) pb += P;
            sol.style.setProperty('--sol-pb', pb.toFixed(1) + 'px');
            /* сетка в отступе — продолжение закреплённого фона: его фаза плюс (высота секции без отступа − экран) */
            const sbg = sol.querySelector('.sol__bg');
            if (sbg) {
              const content = sol.offsetHeight - (parseFloat(getComputedStyle(sol).paddingBottom) || 0);
              const bpy = parseFloat(getComputedStyle(sbg).backgroundPositionY) || 0;
              sol.style.setProperty('--sol-bgy', (bpy + (content - vh)).toFixed(1) + 'px');
            }
          } else sol.style.removeProperty('--sol-pb');
          /* описания вписаны в круг: блок текста центрируем по вертикали (пересчёт только при смене размера круга) */
          /* мобильный: круги друг под другом, ровно на кругах фоновой сетки (их диаметр = шаг плитки);
             первый — на ближайшем круге сетки под заголовком */
          if (W <= 1024 && d) {
            const sbg = sol.querySelector('.sol__bg'), trk = sol.querySelector('.sol__track');
            if (sbg && trk && ttl) {
              const tile = portrait ? 690 * W / 768 : 566 * W / 1200, c0 = portrait ? 235 * W / 768 : 259 * W / 1200;
              const bpy = parseFloat(getComputedStyle(sbg).backgroundPositionY) || 0;
              let c = ((bpy + c0) % tile + tile) % tile;
              if (true) {
                /* планшет и мобильный: круг сетки — первый, над которым помещается заголовок; заголовок ставим прямо над кругом
                   (не заголовок диктует круг, а круг — заголовок), без пустого шага сетки между ними */
                const tH = ttl.offsetHeight, head = 6.25 * px, gapT = 2.5 * px, over = d * 0.09;
                while (c - 0.41 * d - over - gapT - tH < head) c += tile;
                const tTop = c - 0.41 * d - over - gapT - tH;
                sol.style.setProperty('--sol-pt', tTop.toFixed(1) + 'px');
                sol.style.setProperty('--sol-mt', (c - d / 2 - tTop - tH).toFixed(1) + 'px');
              } else {
                sol.style.removeProperty('--sol-pt');
                const tBot = ttl.offsetTop + ttl.offsetHeight;
                const minTop = tBot + 1.5 * px + d * 0.09;              /* номер выступает над кругом */
                while (c - d / 2 < minTop) c += tile;
                sol.style.setProperty('--sol-mt', (c - d / 2 - tBot).toFixed(1) + 'px');
              }
            }
          } else sol.style.removeProperty('--sol-mt');
          if (d && this.solFitKey !== d) { this.solFitKey = d; this.fitSolText(sol, d); }
        }
        const C0 = 4 * vh - ph + gap + apprExtra;        /* координата сетки у верхнего края секции (+ экран «Решений») */
        const k = Math.ceil((minY + C0 - y0) / P);
        const line = y0 + P * k - C0;
        team.style.setProperty('--team-line', line.toFixed(1) + 'px');
        team.style.setProperty('--team-step', (portrait ? 2 * P : P).toFixed(1) + 'px');   /* крупные фото — через две линии сетки */
        /* высота «Команды» — чтобы сетка следующего блока продолжилась без шва */
        root.style.setProperty('--team-h', team.offsetHeight + 'px');
        /* КОМАНДА, десктоп: список участников прижат к низу; если там он налезает на пиджак на фото
           (широкий и невысокий экран) — поднимаем его под заголовок */
        {
          const list = team.querySelector('.tm__thumbs'), ph0 = team.querySelector('.tm__photo');
          if (list && ph0 && W > 1024) {
            const pr = ph0.getBoundingClientRect(), lr = list.getBoundingClientRect();
            const bottomTop = team.getBoundingClientRect().top + team.offsetHeight - 2 * px - lr.height;   /* верх списка, если он внизу */
            const jacket = pr.left + pr.width * 0.06;                                                     /* левый край пиджака на фото */
            const hit = lr.right > jacket - 8 && bottomTop + lr.height > pr.top + pr.height * 0.45;
            team.style.setProperty('--tm-lt', hit ? '13rem' : 'auto');
            team.style.setProperty('--tm-lb', hit ? 'auto' : '2rem');
          }
        }
        /* ПОДВАЛ: низ «Обсудить задачу» — на ближайшей горизонтальной линии сетки, в подвале сетка продолжается.
           Фон «Обсудить задачу» (закреплённый слой) начинается с фазы bpy; его высоту добираем до линии (--meet-cut) */
        {
          const bpy = ph - 4 * vh - gap - apprExtra - team.offsetHeight;
          let cut = (bpy + y0 - vh) % P; if (cut < 0) cut += P;
          if (cut > P - 0.5) cut = 0;
          root.style.setProperty('--meet-cut', cut.toFixed(1) + 'px');
          const meetEl = root.querySelector('.meet');
          /* планшет: фон «Обсудить задачу» не закреплён — сетка в подвале продолжается после всей высоты блока */
          if (W <= 1024 && meetEl) root.style.setProperty('--foot-pat', (bpy - meetEl.offsetHeight).toFixed(1) + 'px');
          else root.style.setProperty('--foot-pat', (bpy - vh - cut).toFixed(1) + 'px');
        }
        this.updateMeet();
      }
    }
    /* ромбы: угол по кругу и сплошной цвет от #E8E6E0 (активный) к #8A98BE (соседний); дальние уменьшаются до нуля */
    const A = [232, 230, 224], B = [138, 152, 190];
    sec.querySelectorAll('.dirs__dot').forEach((d, i) => {
      const a = a0 - i * STEP, abs = Math.abs(a);
      const m = Math.min(abs / STEP, 1);
      const c = A.map((v, j) => Math.round(v + (B[j] - v) * m));
      const sc = 1 - Math.min(Math.max((abs - 55) / 20, 0), 1);
      d.style.setProperty('--a', a.toFixed(2) + 'deg');
      d.style.setProperty('--dot', 'rgb(' + c.join(',') + ')');
      d.style.setProperty('--s', sc.toFixed(3));
    });
    const active = Math.max(0, Math.round(e));
    if (active !== this.state.dir) this.setState({ dir: active });
  }

  /* ПОДХОД: слова по концентрическим кругам (как на референсе).
     — слова идут группами по 1–3, между группами — прогалы из мелких точек; кегль растёт от центра к краю;
     — круги очень медленно вращаются, буквы изредка пропадают (на их месте точка) и появляются снова;
     — вокруг курсора буквы внутри радиуса пропадают, точки остаются;
     — нажать и держать: всё плавно уменьшается; отпустить — возвращается с пружиной и волной (ripple). */
  startWords(panel) {
    const canvas = panel.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const doc = panel.ownerDocument, win = doc.defaultView || window;
    const reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const WORDS = ['ЦЕННОСТЬ', 'ЗНАЧИМОСТЬ', 'ДОСТОИНСТВО', 'СТРАТЕГИЯ', 'УПРАВЛЕНИЕ', 'КОММУНИКАЦИИ'];
    const HOLE = 90;                                   /* радиус зоны у курсора */
    const FILL = '#192957', COLOR = '#5b7ad4', DOT = '#3a52a0';           /* заливка круга, буквы (светлые, как раньше) и точки */
    const AF = 48;                                     /* кегль букв в атласе (дальше масштабируются; крупный — для приближения в переходе) */
    const hash = (a, b, c) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };

    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, rings = [], round = false, CR = 0, trans = false;
    const stage = panel.parentElement || panel;

    /* атлас: каждая буква и точка рисуются один раз, кадр собирается из готовых картинок */
    const atlas = doc.createElement('canvas'), actx = atlas.getContext('2d');
    let cellW = 0, cellH = 0, glyph = {}, dotX = 0;
    const buildAtlas = () => {
      const uniq = [...new Set(WORDS.join(''))];
      const px = AF * dpr;
      actx.font = '500 ' + px + 'px "IBM Plex Mono", ui-monospace, monospace';
      cellW = Math.ceil(actx.measureText('М').width) + 6;
      cellH = Math.ceil(px * 1.4);
      atlas.width = cellW * (uniq.length + 1); atlas.height = cellH;
      actx.clearRect(0, 0, atlas.width, atlas.height);
      actx.font = '500 ' + px + 'px "IBM Plex Mono", ui-monospace, monospace';
      actx.textAlign = 'center'; actx.textBaseline = 'middle';
      actx.fillStyle = COLOR;
      glyph = {};
      uniq.forEach((ch, i) => { actx.fillText(ch, i * cellW + cellW / 2, cellH / 2); glyph[ch] = i * cellW; });
      dotX = uniq.length * cellW;
      actx.fillStyle = DOT;
      const d = Math.max(2, Math.round(px * 0.09));
      actx.fillRect(dotX + cellW / 2 - d / 2, cellH / 2 - d / 2, d, d);
    };

    /* кольца: кегль и шаг растут с радиусом; слова группами, между группами — точки */
    const build = () => {
      dpr = Math.min(win.devicePixelRatio || 1, 2);
      W = panel.clientWidth; H = panel.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      /* слова всегда в круге. Десктоп: сама панель — круг (CSS, border-radius). Планшет и мобильный: панель —
         квадрат во всю ширину, круг рисуется на холсте во всю ширину контент-зоны (поля 40 / 16 px) */
      round = parseFloat(getComputedStyle(panel).borderTopLeftRadius) > 0;
      cx = W * 0.5; cy = H * 0.5;
      CR = round ? W / 2 : Math.max(40, Math.min(W / 2 - (W <= 640 ? 16 : 40), H / 2));
      /* десктоп: холст во весь экран, круг и переход рисуются на нём — кольца нужны до углов экрана */
      trans = !!this.apprPhase();
      buildAtlas();
      const maxR = (trans ? Math.hypot(W, H) / 2 : CR) / 0.8 + 40;   /* запас на уменьшение */
      rings = [];
      let r = 24;
      for (let k = 0; r < maxR; k++) {
        const fs = Math.min(8 + r * 0.032, 24);        /* кегль, px */
        const adv = fs * 0.78;                          /* шаг буквы по окружности */
        const n = Math.max(8, Math.floor((2 * Math.PI * r) / adv));
        const slots = [];                              /* символ | '.' точка | '_' пробел между словами */
        let w = Math.floor(hash(k, 7, 1) * WORDS.length), j = 0, seed = 0;
        const rnd = () => hash(k, seed++, 3.3);
        /* два самых маленьких круга: слова только целиком (сколько поместится), без выпавших букв и без мигания */
        const steady = k < 2;
        if (steady) {
          let tries = 0;
          for (let g = 2; g > 0 && slots.length < n; g--) slots.push('.');
          while (tries < WORDS.length) {
            const word = WORDS[w % WORDS.length];
            const need = word.length + (slots.length > 2 ? 1 : 0) + 3;   /* слово + пробел + минимум точек до стыка */
            if (slots.length + need > n) { w++; tries++; continue; }
            if (slots.length > 2) slots.push('_');
            for (const ch of word) slots.push(ch);
            w++; tries = 0;
          }
          while (slots.length < n) slots.push('.');
        }
        /* начинаем с прогала, чтобы стык в конце круга не бросался в глаза */
        if (!steady) for (let g = 2 + Math.floor(rnd() * 8); g > 0 && slots.length < n; g--) slots.push('.');
        while (!steady && slots.length < n) {
          const run = 1 + Math.floor(rnd() * 3);
          for (let q = 0; q < run && slots.length < n; q++) {
            if (q) slots.push('_');
            const word = WORDS[w % WORDS.length]; w++;
            for (const ch of word) { if (slots.length >= n) break; slots.push(rnd() < 0.05 ? '.' : ch); }
          }
          const gap = 3 + Math.floor(rnd() * rnd() * 26);   /* прогалы разной длины, чаще короткие */
          for (let g = 0; g < gap && slots.length < n; g++) slots.push('.');
        }
        const blink = new Float32Array(n);
        for (let i = 0; i < n; i++) blink[i] = hash(k, i, 5.1);
        rings.push({ r, n, fs, slots, blink, steady, phase: hash(k, 1, 2) * Math.PI * 2, speed: (0.008 + 0.006 * hash(k, 3, 4)) * (k % 2 ? 1 : 0.8) });
        r += fs * 1.7;
      }
    };

    /* указатель */
    const P = { x: -9999, y: -9999, inside: false, down: false, touch: false };
    let calm = true;                                  /* переход ещё не начался — круг интерактивен */
    const onMove = (e) => {
      const rc = panel.getBoundingClientRect();
      P.x = e.clientX - rc.left; P.y = e.clientY - rc.top;
      P.touch = e.pointerType !== 'mouse';
      if (trans) stage.style.cursor = calm && Math.hypot(P.x - cx, P.y - cy) <= CR ? 'pointer' : '';
    };
    const onEnter = (e) => { P.inside = true; onMove(e); };
    const onLeave = () => { P.inside = false; if (!P.down) P.x = P.y = -9999; release(); };
    const onDown = (e) => {
      onMove(e);
      if (!calm || Math.hypot(P.x - cx, P.y - cy) > CR) return;   /* нажатие вне круга (или во время перехода) не считается */
      P.down = true; P.inside = true; ripple = null;
    };
    const release = () => {
      if (!P.down) return;
      P.down = false;
      ripple = { t: 0, s0: scale };
      if (P.touch) { P.inside = false; P.x = P.y = -9999; }
    };
    const onUp = () => release();
    const noMenu = (e) => e.preventDefault();
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerenter', onEnter);
    stage.addEventListener('pointerleave', onLeave);
    stage.addEventListener('pointerdown', onDown);
    win.addEventListener('pointerup', onUp);
    win.addEventListener('pointercancel', onUp);
    stage.addEventListener('contextmenu', noMenu);

    let scale = 1, ripple = null;
    const MIN_SCALE = 0.84;

    let raf = 0, last = performance.now(), t = 0;
    const frame = (now) => {
      raf = win.requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const rect = panel.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > win.innerHeight) return;      /* вне экрана — не рисуем */
      if (panel.clientWidth !== W || panel.clientHeight !== H) build();
      if (!reduce) t += dt;

      /* ПЕРЕХОД (десктоп): центр, радиус круга, приближение колец и «дыра» в центре — по прогрессу скролла */
      let zoom = 1, holeR = 0;
      let ph = this.apprPhase();
      if (!!ph !== trans) { build(); ph = trans ? this.apprPhase() : null; }   /* режим сменился (ширина окна / ref секции пришёл позже) */
      if (ph) {
        const pr = panel.getBoundingClientRect(), sr = ph.spot.getBoundingClientRect();
        const c0x = sr.left - pr.left + sr.width / 2, c0y = sr.top - pr.top + sr.height / 2, r0 = sr.width / 2;
        const RC = Math.hypot(W, H) / 2 + 8;            /* круг, накрывающий весь экран из его центра */
        cx = c0x + (W / 2 - c0x) * ph.a; cy = c0y + (H / 2 - c0y) * ph.a;
        CR = r0 + (Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 8 - r0) * ph.a;
        zoom = (1 + 0.6 * ph.a) * Math.pow(5, ph.b) * Math.pow(1.6, ph.c);   /* «падение»: кольца летят навстречу */
        holeR = RC * ph.c * ph.c;                        /* сначала маленькая точка, потом раскрывается на весь экран */
        calm = ph.p < 0.04;
        if (!calm) { P.down = false; }
      }

      /* удержание: медленно уменьшаем; отпускание: пружина с колебанием + радиальная волна */
      let rip = 0, ripT = 0;
      if (P.down) {
        scale += (MIN_SCALE - scale) * Math.min(dt * 0.9, 1);
      } else if (ripple) {
        ripple.t += dt; ripT = ripple.t;
        scale = 1 - (1 - ripple.s0) * Math.exp(-3.2 * ripT) * Math.cos(7.5 * ripT);
        rip = Math.exp(-2.4 * ripT) * (1 - Math.exp(-18 * ripT));
        if (ripT > 3) { ripple = null; scale = 1; }
      }
      /* в круге курсор действует только внутри окружности, а не во всём квадрате */
      const inCircle = Math.hypot(P.x - cx, P.y - cy) <= CR + HOLE * 0.5;
      const useHole = calm && P.inside && inCircle && (!P.touch || P.down);
      const H2 = HOLE * HOLE;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      /* круг: тёмная заливка (на планшете и мобильном — здесь, на десктопе её даёт CSS) и обрезка по нему */
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx * dpr, cy * dpr, CR * dpr, 0, Math.PI * 2);
      if (!round) { ctx.fillStyle = FILL; ctx.fill(); }
      ctx.clip();
      const hx = cellW / 2, hy = cellH / 2;
      for (let k = 0; k < rings.length; k++) {
        const R = rings[k];
        const rot = R.phase + t * R.speed;
        const dr = rip ? 16 * rip * Math.sin(R.r * 0.045 - ripT * 9) : 0;
        const rr = (R.r + dr) * scale * zoom;
        if (rr - R.fs * zoom * 2 > CR || rr + R.fs * zoom * 2 < holeR) continue;   /* кольцо вне круга или в «дыре» */
        const sz = (R.fs * scale * zoom) / AF;        /* масштаб глифа из атласа */
        const step = (Math.PI * 2) / R.n, m = 30;
        for (let i = 0; i < R.n; i++) {
          const ch = R.slots[i];
          if (ch === '_') continue;
          const a = rot + i * step;
          const ca = Math.cos(a), sa = Math.sin(a);
          const x = cx + rr * ca, y = cy + rr * sa;
          if (x < -m || y < -m || x > W + m || y > H + m) continue;
          /* курсор: буквы внутри радиуса пропадают, а точки остаются (на месте буквы — тоже точка) */
          let inHole = false;
          if (useHole) { const ddx = x - P.x, ddy = y - P.y; inHole = ddx * ddx + ddy * ddy < H2; }
          let sx = dotX;
          if (ch !== '.' && !inHole && R.steady) sx = glyph[ch];      /* маленькие круги — без мигания */
          else if (ch !== '.' && !inHole) {
            /* мигание: буква изредка и надолго пропадает — на её месте остаётся точка */
            /* у каждой буквы свой темп (раз в 1.5–4 с) и своя фаза — никакой синхронности */
            const b = R.blink[i];
            const sl = Math.floor(t * (0.25 + 0.4 * b) + b * 17.3);
            const hv = Math.sin(b * 912.7 + sl * 78.233) * 43758.5453;
            if (hv - Math.floor(hv) >= 0.03) sx = glyph[ch];
          }
          /* поворот по касательной к кругу */
          ctx.setTransform(-sa * sz, ca * sz, -ca * sz, -sa * sz, x * dpr, y * dpr);
          ctx.drawImage(atlas, sx, 0, cellW, cellH, -hx, -hy, cellW, cellH);
        }
      }
      ctx.restore();
      /* «дыра» в центре: сквозь неё видна «Команда», лежащая под экраном */
      if (holeR > 0.5) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.arc(cx * dpr, cy * dpr, holeR * dpr, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    };

    build();
    if (doc.fonts && doc.fonts.load) doc.fonts.load('500 32px "IBM Plex Mono"', 'ЦЕННОСТЬ').then(build).catch(() => {});
    raf = win.requestAnimationFrame(frame);

    this.wordsCleanup = () => {
      win.cancelAnimationFrame(raf);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerenter', onEnter);
      stage.removeEventListener('pointerleave', onLeave);
      stage.removeEventListener('pointerdown', onDown);
      win.removeEventListener('pointerup', onUp);
      win.removeEventListener('pointercancel', onUp);
      stage.removeEventListener('contextmenu', noMenu);
      stage.style.cursor = '';
    };
  }
  stopWords() { if (this.wordsCleanup) { this.wordsCleanup(); this.wordsCleanup = null; } }

  /* ПЕРЕХОД «Подход» → «Команда» (десктоп): прогресс 0…1 по закреплённой секции.
     Фазы: 0–0.06 покой · 0.06–0.36 круг растёт на весь экран · 0.36–0.68 «падение» внутрь · 0.70–1 из центра
     открывается «Команда». Возвращает null, если перехода нет (планшет и мобильный). */
  apprPhase() {
    const sec = this.apprSec; if (!sec) return null;
    const spot = sec.querySelector('.appr__spot');
    if (!spot || !spot.offsetWidth) return null;
    const win = sec.ownerDocument.defaultView || window;
    const vh = win.innerHeight, r = sec.getBoundingClientRect();
    const span = r.height - vh;
    const p = span > 0 ? Math.min(Math.max(-r.top / span, 0), 1) : 0;
    const ss = (x) => { x = Math.min(Math.max(x, 0), 1); return x * x * (3 - 2 * x); };
    return { p, vh, rect: r, spot,
      a: ss((p - 0.06) / 0.30), b: Math.min(Math.max((p - 0.36) / 0.32, 0), 1), c: Math.min(Math.max((p - 0.70) / 0.30, 0), 1),
      text: 1 - ss((p - 0.04) / 0.14) };
  }
  updateAppr() {
    const sec = this.apprSec; if (!sec) return;
    const root = sec.closest('.axia');
    const next = root && root.querySelector('.sol');      /* следующая секция — «Решения» */
    const text = sec.querySelector('.appr__text');
    const bg = sec.querySelector('.appr__bg');
    const stage = sec.querySelector('.appr__stage');
    const ph = this.apprPhase();
    /* трансформируем не саму секцию (это сделало бы её отдельным слоем, и заглушка низа экрана легла бы поверх),
       а её закреплённый экран (над заглушкой) и фон-сетку (под ней) */
    const parts = next ? [next.querySelector('.sol__stage'), next.querySelector('.sol__bg')].filter(Boolean) : [];
    const clearNext = () => parts.forEach((el) => { el.style.transform = ''; el.style.transformOrigin = ''; });
    if (!ph) {
      clearNext();
      if (stage) stage.style.pointerEvents = '';
      if (text) text.style.opacity = '';
      if (bg) bg.style.visibility = '';
      return;
    }
    if (text) text.style.opacity = ph.text.toFixed(3);
    /* когда из центра открываются «Решения», экран «Подхода» (он всё ещё над ними, пока не уедет вверх)
       перестаёт ловить курсор — наведение на круги «Решений» работает сразу */
    if (stage) stage.style.pointerEvents = ph.p >= 0.7 ? 'none' : '';
    /* «Решения» лежат под закреплённым экраном: пока они заезжают снизу, держим их у верха экрана
       (компенсируем скролл) и увеличиваем из центра 0.5 → 1 — к концу перехода они ровно на своём месте */
    const nextTop = ph.rect.bottom - ph.vh;          /* верх «Решений» на экране без трансформации */
    if (next && nextTop > 0 && nextTop < ph.vh) {
      const k = 0.5 + 0.5 * (1 - Math.pow(1 - ph.c, 2));
      const tf = 'translateY(' + (-nextTop).toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
      const tw = next.offsetWidth;
      parts.forEach((el) => {
        el.style.transformOrigin = (tw / 2 - el.offsetLeft).toFixed(1) + 'px ' + (ph.vh / 2 - el.offsetTop).toFixed(1) + 'px';
        el.style.transform = tf;
      });
    } else clearNext();
    /* сетка «Подхода» прячется, когда под экраном уже «Решения» (иначе она легла бы поверх их сетки) */
    if (bg) bg.style.visibility = nextTop < ph.vh ? 'hidden' : '';
  }

  /* РЕШЕНИЯ: вертикальное центрирование текста, вписанного в круг. Высота блока зависит от его отступа сверху
     (строки ближе к середине круга длиннее), поэтому подбираем отступ за несколько шагов */
  fitSolOne(tx, d) {
    if (!tx || !d) return;
    { const card = tx.closest('.sol__card'); if (card && card.offsetWidth) d = card.offsetWidth; }   /* круг внутри ячейки меньше её */
    /* ищем отступ mt, при котором поля сверху и снизу равны: 2·mt + h(mt) = d. h ступенчато зависит от mt
       (строки у середины длиннее), поэтому — двоичный поиск, а не простая итерация */
    /* текст центрируется относительно всего круга (номер и ромб при наведении — по краям, их не учитываем) */
    const rt = 0, rb = 0;
    let lo = d * 0.05, hi = d * 0.6, best = lo, bestErr = Infinity;
    for (let i = 0; i < 14; i++) {
      const mt = (lo + hi) / 2;
      tx.style.setProperty('--tx-mt', mt.toFixed(1) + 'px');
      const err = (d - rb - tx.offsetHeight - mt) - (mt - rt);   /* > 0 — снизу места больше, опускаем */
      if (Math.abs(err) < bestErr) { bestErr = Math.abs(err); best = mt; }
      if (err > 0) lo = mt; else hi = mt;
    }
    tx.style.setProperty('--tx-mt', best.toFixed(1) + 'px');
  }
  /* РЕШЕНИЯ: касание / клик по кругу — показывает описание; по другому кругу — первый сбрасывается; повторно — закрыть */
  solToggle(i, e) {
    const li = e && e.currentTarget;
    const ax = li && li.closest('.axia');
    if ((ax ? ax.clientWidth : window.innerWidth) > 1024) return;   /* десктоп — по наведению, клик ничего не переключает */
    if (li) this.fitSolOne(li.querySelector('.sol__tx'), li.offsetWidth);
    this.setState({ solOpen: this.state.solOpen === i ? -1 : i });
    (window.requestAnimationFrame || setTimeout)(() => this.updateLabel && this.updateLabel());   /* цвет меню над открытым кругом */
  }
  fitSolText(sol, d) {
    sol.querySelectorAll('.sol__tx').forEach((tx) => this.fitSolOne(tx, d));
    const doc = sol.ownerDocument;
    if (!this.solFontHook && doc.fonts && doc.fonts.ready) {
      this.solFontHook = true;
      doc.fonts.ready.then(() => { this.solFitKey = null; this.fitSolText(sol, d); }).catch(() => {});
    }
  }

  /* РЕШЕНИЯ: прогресс скролла по закреплённой секции → сдвиг ряда кругов */
  updateSol() {
    const sec = this.solSec; if (!sec) return;
    const win = sec.ownerDocument.defaultView || window;
    const r = sec.getBoundingClientRect(), span = r.height - (parseFloat(getComputedStyle(sec).paddingBottom) || 0) - win.innerHeight;   /* без отступа снизу */
    const p = span > 0 ? Math.min(Math.max(-r.top / span, 0), 1) : 0;
    sec.style.setProperty('--sol-p', p.toFixed(4));
  }

  /* ---------- календарь ---------- */
  dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  keyDate(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
  slotsFor(key) { return this.slotMap[key] || []; }
  /* ---- данные для записи: сервер или примеры ---- */
  /* время слотов показываем в часовом поясе компании (по умолчанию Москва) — как в письмах и календаре */
  setSlots(isoList, timeZone) {
    const map = {};
    let fmt = null;
    try { if (timeZone) fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }); } catch (e) { fmt = null; }
    isoList.forEach((iso) => {
      const d = new Date(iso); if (isNaN(d)) return;
      let key = this.dayKey(d), mins = d.getHours() * 60 + d.getMinutes();
      if (fmt) {
        const pt = {}; fmt.formatToParts(d).forEach((x) => { pt[x.type] = +x.value; });
        key = pt.year + '-' + pt.month + '-' + pt.day; mins = (pt.hour % 24) * 60 + pt.minute;
      }
      (map[key] = map[key] || []).push({ mins, iso });
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.mins - b.mins));
    this.slotMap = map;
    this.avail = new Set(Object.keys(map).sort((a, b) => this.keyDate(a) - this.keyDate(b)));
    /* выбранный день остаётся, если в нём ещё есть время; иначе — первый свободный */
    let sel = this.state.selKey && map[this.state.selKey] ? this.state.selKey : null;
    if (!sel) for (const k of this.avail) { sel = k; break; }
    const d = sel ? this.keyDate(sel) : this.today;
    this.setState({ selKey: sel, calY: d.getFullYear(), calM: d.getMonth() });
  }
  demoSlots() {
    const out = [];
    for (let i = 1; i <= 60; i++) {
      const d = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate() + i);
      const wd = d.getDay(), key = this.dayKey(d);
      if (wd === 0 || wd === 6 || this.hash(key) % 5 === 0) continue;
      for (let m = 13 * 60; m <= 18 * 60; m += 30) if (this.hash(key + '@' + m) % 4 !== 0) out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, m).toISOString());
    }
    return out;
  }
  api(path, body) {
    const opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    return fetch(path, opts).then((r) => r.json().catch(() => ({ ok: false, error: 'Сервер недоступен', status: r.status })))
      .catch(() => ({ ok: false, error: 'Нет связи с сервером. Проверьте интернет или напишите нам на hello@axiagroup.ru', offline: true }));
  }
  loadBooking() {
    return this.api('/api/settings.php').then((st) => {
      if (!st || !st.ok) {
        this.demo = true;
        /* демо на Vercel: переключатель записи из демо-админки (хранится в этом браузере) */
        let on = true; try { on = (JSON.parse(localStorage.getItem('axia-demo-settings')) || {}).bookingEnabled !== false; } catch (e) { on = true; }
        this.setState({ bookingOn: on });
        this.setSlots(this.demoSlots());
        return;
      }
      this.captchaKey = st.captchaSiteKey || '';
      this.durationMin = st.durationMin || 30;
      this.setState({ bookingOn: !!st.bookingEnabled });
      if (st.bookingEnabled) return this.loadSlots();
    });
  }
  loadSlots() {
    return this.api('/api/slots.php').then((d) => {
      if (d && d.ok && d.enabled === false) { this.setState({ bookingOn: false }); return; }
      if (d && d.ok) { this.tzLabel = d.timezone === 'Europe/Moscow' ? ' МСК' : ''; this.setSlots(d.slots || [], d.timezone); }
    });
  }
  /* невидимая капча Яндекс SmartCaptcha: проверка запускается только при отправке формы */
  captcha() {
    if (!this.captchaKey) return Promise.resolve('');
    const load = this.captchaLoad || (this.captchaLoad = new Promise((res, rej) => {
      window.__axiaCaptchaReady = res;
      const s = document.createElement('script');
      s.src = 'https://smartcaptcha.yandexcloud.net/captcha.js?render=onload&onload=__axiaCaptchaReady';
      s.defer = true; s.onerror = () => { this.captchaLoad = null; rej(new Error('Не загрузилась проверка «я не робот». Обновите страницу.')); };
      document.head.appendChild(s);
    }));
    return load.then(() => new Promise((resolve, reject) => {
      const sc = window.smartCaptcha;
      if (this.captchaId == null) {
        const box = document.createElement('div'); box.className = 'captcha-box'; document.body.appendChild(box);
        this.captchaId = sc.render(box, { sitekey: this.captchaKey, invisible: true, hl: 'ru', shieldPosition: 'bottom-left' });
      }
      const id = this.captchaId;
      const offs = [];
      const done = () => offs.forEach((f) => f && f());
      offs.push(sc.subscribe(id, 'success', (token) => { done(); resolve(token); }));
      offs.push(sc.subscribe(id, 'challenge-hidden', () => { done(); reject(new Error('Проверка «я не робот» не завершена')); }));
      offs.push(sc.subscribe(id, 'network-error', () => { done(); reject(new Error('Проверка «я не робот» недоступна. Попробуйте ещё раз.')); }));
      sc.reset(id);
      sc.execute(id);
    }));
  }
  /* общая отправка формы: капча → POST → результат. kind: 'book' | 'msg' | 'inline' */
  sendForm(e, path, extra, errKey) {
    const f = this.formData(e);
    if (this.state.busy) return Promise.resolve(null);
    const reset = {}; reset[errKey] = ''; reset.busy = true;
    this.setState(reset);
    const fail = (msg) => { const u = { busy: false }; u[errKey] = msg; this.setState(u); return null; };
    return this.captcha().then((token) => this.api(path, Object.assign({}, f, extra, { captcha: token, elapsed: Date.now() - (this.formAt || this.openedAt) })))
      .then((d) => { if (!d) return null; if (!d.ok) { fail(d.error || 'Не удалось отправить'); return d; } this.setState({ busy: false }); return Object.assign(d, { form: f }); },
        (err) => fail(err.message));
  }
  fmtTime(m) {
    const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
    if (this.state.h24) return h + ':' + mm;
    return (h % 12 || 12) + ':' + mm + (h < 12 ? ' AM' : ' PM');
  }
  dayLabel(key, long) {
    const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const MG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const d = this.keyDate(key);
    return WD[d.getDay()] + ', ' + d.getDate() + '\u00a0' + MG[d.getMonth()];
  }
  goMonth(delta) {
    let y = this.state.calY, m = this.state.calM + delta;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    let sel = this.state.selKey;
    const inMonth = (k) => { const d = this.keyDate(k); return d.getFullYear() === y && d.getMonth() === m; };
    if (!sel || !inMonth(sel)) {
      sel = null;
      for (const k of this.avail) if (inMonth(k)) { sel = k; break; }
    }
    this.setState({ calY: y, calM: m, selKey: sel });
  }
  /* десктоп: низ панели записи всегда на уровне низа кнопки «Просто напишите мне»
     (левая колонка закреплена на высоту экрана, поэтому отступ снизу = расстояние от кнопки до низа экрана) */
  updateMeet() {
    const person = this.personEl; if (!person) return;
    const side = person.parentElement, main = side && side.nextElementSibling;
    if (!side || !main) return;
    const btn = person.querySelector('.meet__write') || person;
    const pb = Math.max(0, side.getBoundingClientRect().bottom - btn.getBoundingClientRect().bottom);
    main.style.setProperty('--meet-pb', pb.toFixed(1) + 'px');
    /* верх панели записи — на уровне верха заголовка «давайте обсудим…» */
    const ttl = side.querySelector('.meet__title');
    if (ttl) main.style.setProperty('--meet-pt', Math.max(0, ttl.getBoundingClientRect().top - side.getBoundingClientRect().top).toFixed(1) + 'px');
  }
  /* выбор даты: слегка докручиваем страницу, чтобы свободные слоты попали в кадр */
  revealSlots() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = this.calEl && this.calEl.querySelector('.slots'); if (!el) return;
      const win = el.ownerDocument.defaultView || window;
      const r = el.getBoundingClientRect();
      if (r.bottom > win.innerHeight - 16) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }));
  }
  /* на планшете и мобильном после смены шага возвращаем верх панели в кадр */
  revealCal() {
    requestAnimationFrame(() => {
      const el = this.calEl; if (!el) return;
      if (el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  formData(e) {
    if (e && e.preventDefault) e.preventDefault();
    const form = e && (e.currentTarget && e.currentTarget.tagName === 'FORM' ? e.currentTarget : e.target);
    const out = {};
    if (form && form.elements) Array.prototype.forEach.call(form.elements, (el) => { if (el.name) out[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    return out;
  }

  /* HERO — ПОЛЕ ТЕКСТА (основной вариант; прежний WebGL-фон — hero: "webgl").
     Оптимизация: статичный слой рисуется ОДИН раз (и при смене размера) — по 2 вызова fillText на строку:
     строка фона (буквы внутри «αξία» заменены пробелами) и строка силуэта (снаружи — пробелы). Моноширинный шрифт
     держит буквы в одной сетке. Маска «αξία» — вектор, уменьшенный до размера сетки (1 пиксель = 1 ячейка),
     поэтому её разбор — это getImageData пары десятков тысяч пикселей один раз.
     Живость: раз в 220 мс у нескольких букв силуэта на время меняется символ — перерисовываются только эти ячейки.
     Тикер стоит, когда hero вне экрана или вкладка скрыта; при prefers-reduced-motion анимации нет.
     Курсор — как в «Подходе»: буквы внутри зоны-звезды пропадают, на их месте остаётся точка. Перерисовываются только ячейки
     старого и нового круга — раз за кадр, через requestAnimationFrame; на тач-устройствах эффекта нет. */
  startField(canvas) {
    const hero = canvas.parentElement;
    const img = hero && hero.querySelector('.hero__word');
    const ctx = canvas.getContext('2d');
    if (!ctx || !img) { this.setState({ fieldFail: true }); return; }
    const doc = hero.ownerDocument, win = doc.defaultView || window;
    const reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* фон hero: цитаты о ценности и достоинстве (с авторами и источниками), идут подряд через « · » */
    const PHRASES = [
      'В царстве целей всё имеет или цену, или достоинство. Иммануил Кант',
      'Не довольствуйся поверхностным взглядом. От тебя не должны ускользнуть ни своеобразие каждой вещи, ни её достоинство. Марк Аврелий',
      'Мы все рождаемся, обладая внутренней ценностью и значимостью. Нам не нужно ничего делать, чтобы обладать достоинством. Донна Хикс',
      'Истинная ценность человека измеряется в тех вещах, к которым он стремится. Марк Аврелий',
      '…Ценностям мы не можем научиться — ценности мы должны пережить. Виктор Франкл',
      'Уникальный смысл сегодня — это универсальная ценность завтра. Виктор Франкл',
      'Цена — это то, что вы платите. Ценность — это то, что вы получаете. Уоррен Баффетт',
      'Мы выдумываем ценности. A priori жизнь не имеет смысла. Это мы создаём ей смысл. Жан-Поль Сартр',
      'В жизни ценнее всего доброта, и при этом доброта умная, целенаправленная. Дмитрий Лихачёв',
      'Культура — это рождение и воплощение человеческих смыслов через человеческие ценности. Александр Асмолов'
    ];
    const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
    /* поток: фразы в перемешанном порядке через « · » */
    const order = PHRASES.map((p, i) => [hash(i, 9), p]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const S = order.map((p) => p.toUpperCase()).join('  ·  ') + '  ·  ';
    const L = S.length;
    const FLIP = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ·';

    let mob = false, W = 0, H = 0, HH = 0, dpr = 1, cw = 0, ch = 0, cols = 0, rows = 0, fs = 12;
    let grid = null, inside = null, sil = [], font = '', cField = '', cWord = '';
    let aField = 0.035, aWord = 0.3, aFlash = 0.57, R = 130, R2 = R * R;
    const INK = 'rgb(232,230,224)';
    const live = new Map();          /* ячейка → { t: время возврата, ch, a } — временно подменённая буква */
    const P = { x: 0, y: 0, on: false }, Q = { x: 0, y: 0, on: false };   /* курсор сейчас / в прошлом кадре */

    const cellY = (r) => r * ch + ch / 2;

    const build = () => {
      /* мобильный (≤ 640px): сетка мельче, слово ярче, фон из фраз почти не виден */
      mob = hero.clientWidth <= 640;
      fs = mob ? 8 : 12;
      aField = mob ? 0.025 : 0.045;   /* фон из фраз (было 0.015 / 0.035) */ aWord = mob ? 0.45 : 0.3; aFlash = Math.min(aWord * 1.9, 0.85);
      cField = 'rgba(232,230,224,' + aField + ')';
      cWord = 'rgba(232,230,224,' + aWord + ')';
      R = 130; R2 = R * R;   /* радиус софита */
      /* холст = hero плюс низ «αξία», который свисает на «Направления»; фон из фраз — только в пределах hero */
      const hr0 = hero.getBoundingClientRect(), ir0 = img.getBoundingClientRect();
      W = hero.clientWidth; HH = hero.clientHeight;
      H = Math.ceil(Math.max(HH, ir0.bottom - hr0.top));
      if (!W || !H) return false;
      canvas.style.height = H + 'px';
      dpr = Math.min(win.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      font = '500 ' + fs + 'px "IBM Plex Mono", ui-monospace, monospace';
      ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      cw = ctx.measureText('Ж').width; ch = Math.round(fs * (mob ? 1.35 : 1.6));
      cols = Math.ceil(W / cw) + 1; rows = Math.ceil(H / ch) + 1;

      /* маска: «αξία» в масштабе сетки */
      const m = doc.createElement('canvas'); m.width = cols; m.height = rows;
      const mx = m.getContext('2d');
      const hr = hero.getBoundingClientRect(), ir = img.getBoundingClientRect();
      inside = new Uint8Array(cols * rows);
      if (ir.width > 0 && img.complete && img.naturalWidth) {
        mx.drawImage(img, (ir.left - hr.left) / cw, (ir.top - hr.top) / ch, ir.width / cw, ir.height / ch);
        try {
          const d = mx.getImageData(0, 0, cols, rows).data;
          /* у вектора прозрачная заливка (fill-opacity 0.07), поэтому порог — половина максимума, а не фиксированный */
          let mxA = 0;
          for (let i = 0; i < cols * rows; i++) if (d[i * 4 + 3] > mxA) mxA = d[i * 4 + 3];
          const th = Math.max(1, mxA * 0.5);
          for (let i = 0; i < cols * rows; i++) inside[i] = d[i * 4 + 3] >= th ? 1 : 0;
        } catch (e) { /* маска недоступна — только поле текста */ }
      }

      /* текст: у каждой строки свой сдвиг по потоку */
      grid = []; sil = [];
      for (let r = 0; r < rows; r++) {
        const o = Math.floor(hash(r, 1.7) * L);
        const row = new Array(cols);
        for (let c = 0; c < cols; c++) row[c] = S[(o + c) % L];
        grid.push(row);
      }
      ctx.clearRect(0, 0, W, H);
      for (let r = 0; r < rows; r++) {
        let a = '', b = '';
        for (let c = 0; c < cols; c++) {
          const k = r * cols + c, chr = grid[r][c];
          if (inside[k]) { a += ' '; b += chr; if (chr !== ' ') sil.push(k); }
          else { a += chr; b += ' '; }
        }
        if (r * ch < HH) { ctx.fillStyle = cField; ctx.fillText(a, 0, cellY(r)); }
        ctx.fillStyle = cWord; ctx.fillText(b, 0, cellY(r));
      }
      live.clear();
      Q.on = false; heat.clear(); shown.clear(); SP.on = false;
      return true;
    };

    /* зона курсора — звезда: 20 лучей, внутренний радиус 78% от внешнего (R — до кончиков лучей) */
    const STAR_N = 20, STAR_K = 0.78, TAU = Math.PI * 2;
    /* софит со шлейфом: центр пятна (SP) догоняет курсор с небольшой задержкой, а подсветка каждой буквы (heat)
       гаснет не сразу, а за ~0.35 с — за курсором тянется хвост, как у кометы */
    const SP = { x: 0, y: 0, on: false };
    const heat = new Map(), shown = new Map();
    const glowAt = (x, y) => {
      if (!SP.on) return 0;
      const dx = x - SP.x, dy = y - SP.y, d2 = dx * dx + dy * dy;
      if (d2 >= R2) return 0;
      const t = 1 - Math.sqrt(d2) / R;            /* 1 в центре → 0 на краю */
      return t * t * (3 - 2 * t);                 /* плавный спад */
    };
    const inHole = (x, y) => {
      if (!P.on) return false;
      const dx = x - P.x, dy = y - P.y, d2 = dx * dx + dy * dy;
      if (d2 >= R2) return false;
      const f = ((Math.atan2(dy, dx) + Math.PI / 2) / TAU * STAR_N) % 1;   /* луч смотрит вверх */
      const tri = 1 - Math.abs(2 * (f < 0 ? f + 1 : f) - 1);           /* 1 — на кончике луча, 0 — во впадине */
      const rad = R * (STAR_K + (1 - STAR_K) * tri);
      return d2 < rad * rad;
    };
    /* перерисовка одной ячейки с учётом подмены буквы и курсора */
    const paint = (k) => {
      const c = k % cols, r = (k - c) / cols, x = c * cw, y = cellY(r);
      ctx.clearRect(x - 0.5, r * ch, cw + 1, ch);
      if (!inside[k] && r * ch >= HH) return;   /* ниже hero — только буквы «αξία» */
      const ov = live.get(k);
      const chr = ov ? ov.ch : grid[r][c];
      if (chr === ' ') return;
      let a = ov ? ov.a : (inside[k] ? aWord : aField);
      /* курсор-звезда подсвечивает буквы: внутри зоны они так же заметны, как буквы «αξία»
         (прежняя механика — буквы стирались до точки — сохранена в «Бэкап 2») */
      /* мягкий «софит»: в центре — яркость букв «αξία», к краю плавно сходит на нет */
      const g = heat.get(k) || 0;
      if (g > 0) shown.set(k, g); else shown.delete(k);
      if (g > 0 && aWord > a) a += (aWord - a) * g;
      ctx.globalAlpha = a;
      ctx.fillStyle = INK;
      ctx.fillText(chr, x, y);
      ctx.globalAlpha = 1;
    };
    const area = (pt, fn) => {
      const c0 = Math.max(0, Math.floor((pt.x - R) / cw)), c1 = Math.min(cols - 1, Math.floor((pt.x + R) / cw));
      const r0 = Math.max(0, Math.floor((pt.y - R) / ch)), r1 = Math.min(rows - 1, Math.floor((pt.y + R) / ch));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const dx = c * cw + cw / 2 - pt.x, dy = cellY(r) - pt.y;
        if (dx * dx + dy * dy < R2) fn(r * cols + c);
      }
    };
    let praf = 0, lastT = 0;
    const step = (now) => {
      praf = 0;
      if (!grid) return;
      const dt = lastT ? Math.min((now - lastT) / 1000, 0.05) : 1 / 60; lastT = now;
      /* центр пятна догоняет курсор */
      if (P.on) {
        if (!SP.on) { SP.x = P.x; SP.y = P.y; SP.on = true; }
        const f = 1 - Math.exp(-dt / 0.13);   /* задержка пятна за курсором */
        SP.x += (P.x - SP.x) * f; SP.y += (P.y - SP.y) * f;
      } else SP.on = false;
      /* шлейф: подсветка гаснет постепенно; под пятном — обновляется */
      const decay = Math.exp(-dt / 0.35);
      heat.forEach((v, k) => { const nv = v * decay; if (nv < 0.02) heat.delete(k); else heat.set(k, nv); });
      if (SP.on) area(SP, (k) => {
        const c = k % cols, r = (k - c) / cols, g = glowAt(c * cw + cw / 2, cellY(r));
        if (g > (heat.get(k) || 0)) heat.set(k, g);
      });
      /* перерисовываем только буквы, чья яркость заметно изменилась */
      const dirty = [];
      heat.forEach((v, k) => { if (Math.abs(v - (shown.get(k) || 0)) > 0.015) dirty.push(k); });
      shown.forEach((v, k) => { if (!heat.has(k)) dirty.push(k); });
      dirty.forEach(paint);
      const moving = P.on && (Math.abs(P.x - SP.x) > 0.5 || Math.abs(P.y - SP.y) > 0.5);
      if (dirty.length || moving) praf = win.requestAnimationFrame(step); else lastT = 0;
    };
    const kick = () => { if (!praf) praf = win.requestAnimationFrame(step); };
    const flush = kick;
    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const hr = canvas.getBoundingClientRect();
      P.x = e.clientX - hr.left; P.y = e.clientY - hr.top; P.on = true;
      kick();
    };
    const onLeave = () => { P.on = false; kick(); };
    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerleave', onLeave);
    /* тач (планшет, мобильный): ховера нет — подсветка загорается по касанию, идёт за пальцем
       и плавно гаснет через ~0.7 с после того, как палец убрали */
    let tapT = 0, tapOn = false;
    const tapAt = (e) => { const hr = canvas.getBoundingClientRect(); P.x = e.clientX - hr.left; P.y = e.clientY - hr.top; P.on = true; kick(); };
    const onTapDown = (e) => { if (e.pointerType === 'mouse') return; win.clearTimeout(tapT); tapOn = true; tapAt(e); };
    const onTapMove = (e) => { if (e.pointerType === 'mouse' || !tapOn) return; tapAt(e); };
    const onTapEnd = (e) => { if (e.pointerType === 'mouse') return; tapOn = false; win.clearTimeout(tapT); tapT = win.setTimeout(() => { P.on = false; kick(); }, 700); };
    hero.addEventListener('pointerdown', onTapDown, { passive: true });
    hero.addEventListener('pointermove', onTapMove, { passive: true });
    hero.addEventListener('pointerup', onTapEnd, { passive: true });
    hero.addEventListener('pointercancel', onTapEnd, { passive: true });

    let visible = true, timer = 0;
    const tick = () => {
      if (!visible || doc.hidden || !sil.length) return;
      const now = performance.now();
      live.forEach((v, k) => {
        if (now < v.t) return;
        live.delete(k);
        paint(k);
      });
      const n = Math.max(2, Math.round(sil.length / 450));
      for (let i = 0; i < n; i++) {
        const k = sil[Math.floor(Math.random() * sil.length)];
        if (live.has(k)) continue;
        const flash = Math.random() < 0.35;
        live.set(k, { t: now + 350 + Math.random() * 1400, ch: flash ? FLIP[Math.floor(Math.random() * FLIP.length)] : '·', a: flash ? aFlash : aWord });
        paint(k);
      }
    };
    const startTicker = () => {
      clearInterval(timer); timer = 0;
      if (!reduce) timer = setInterval(tick, 220);
    };

    let raf = 0;
    const rebuild = () => {
      win.cancelAnimationFrame(raf);
      raf = win.requestAnimationFrame(() => { if (build()) { startTicker(); if (P.on) flush(); } });
    };
    const ro = new ResizeObserver(rebuild);
    ro.observe(hero);
    const io = new IntersectionObserver((es) => { visible = es[0] ? es[0].isIntersecting : true; });
    io.observe(canvas);
    if (!img.complete) img.addEventListener('load', rebuild, { once: true });
    if (doc.fonts && doc.fonts.load) doc.fonts.load('500 12px "IBM Plex Mono"', 'АКСИА').then(rebuild).catch(() => {});
    rebuild();

    this.field = {
      rebuild,
      stop: () => {
        clearInterval(timer); win.cancelAnimationFrame(raf); win.cancelAnimationFrame(praf); ro.disconnect(); io.disconnect();
        hero.removeEventListener('pointermove', onMove); hero.removeEventListener('pointerleave', onLeave);
        hero.removeEventListener('pointerdown', onTapDown); hero.removeEventListener('pointermove', onTapMove);
        hero.removeEventListener('pointerup', onTapEnd); hero.removeEventListener('pointercancel', onTapEnd); win.clearTimeout(tapT);
      }
    };
  }
  stopField() { if (this.field) { this.field.stop(); this.field = null; } }

  stopGL() { if (this.glCleanup) { this.glCleanup(); this.glCleanup = null; } }

  meetVals() {
    const st = this.state;
    const MN = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    const y = st.calY, m = st.calM;
    const lead = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
    const todayKey = this.dayKey(this.today);
    const noop = () => {};
    const days = [];
    for (let i = 0; i < lead; i++) days.push({ num: '', cls: 'cal__day is-empty', disabled: true, pressed: 'false', label: '', pick: noop });
    for (let d = 1; d <= dim; d++) {
      const key = y + '-' + (m + 1) + '-' + d;
      const free = this.avail.has(key), sel = key === st.selKey;
      days.push({
        num: String(d),
        cls: 'cal__day' + (free ? ' is-free' : '') + (sel ? ' is-selected' : '') + (key === todayKey ? ' is-today' : ''),
        disabled: !free, pressed: sel ? 'true' : 'false',
        label: this.dayLabel(key) + (free ? '' : ', нет свободного времени'),
        pick: free ? () => { this.setState({ selKey: key }); this.revealSlots(); } : noop
      });
    }
    const idx = y * 12 + m, t = this.today.getFullYear() * 12 + this.today.getMonth();
    const slots = st.selKey ? this.slotsFor(st.selKey).map((s) => ({
      label: this.fmtTime(s.mins),
      pick: () => { this.formAt = Date.now(); this.setState({ slot: s.mins, slotIso: s.iso, step: 'form', guests: false, bookError: '' }); this.revealCal(); }
    })) : [];
    const when = st.selKey && st.slot != null ? this.dayLabel(st.selKey) + ', ' + this.fmtTime(st.slot) + '–' + this.fmtTime(st.slot + (this.durationMin || 30)) + (this.tzLabel || '') : '';
    return {
      setCal: this.setCal,
      setPerson: this.setPerson,
      isCal: st.step === 'cal', isForm: st.step === 'form', isDone: st.step === 'done',
      monthName: MN[m] + ' ' + y,
      prevDisabled: idx <= t, nextDisabled: idx >= t + 2,
      prevMonth: () => { if (idx > t) this.goMonth(-1); },
      nextMonth: () => { if (idx < t + 2) this.goMonth(1); },
      days,
      hasSel: !!st.selKey, noSel: !st.selKey,
      selLabel: st.selKey ? this.dayLabel(st.selKey) + (this.tzLabel ? ' · время' + this.tzLabel : '') : '',
      slots,
      f12: st.h24 ? '' : 'is-on', f24: st.h24 ? 'is-on' : '',
      set12: () => this.setState({ h24: false }), set24: () => this.setState({ h24: true }),
      when,
      guestsOpen: !!st.guests, guestsClosed: !st.guests,
      openGuests: () => this.setState({ guests: true }),
      backToCal: () => { this.setState({ step: 'cal', slot: null }); this.revealCal(); },
      submitBook: (e) => {
        if (this.demo) { const f = this.formData(e); this.setState({ step: 'done', bookedEmail: f.email || 'вашу почту' }); this.revealCal(); return; }
        this.sendForm(e, '/api/book.php', { start: st.slotIso }, 'bookError').then((d) => {
          if (!d) return;
          if (d.ok) { this.setState({ step: 'done', bookedEmail: d.form.email }); this.revealCal(); this.loadSlots(); }
          else if (d.taken) this.loadSlots();
          else if (d.disabled) this.loadBooking();
        });
      },
      bookedEmail: st.bookedEmail,
      resetBook: () => { this.setState({ step: 'cal', slot: null }); this.revealCal(); },
      busy: !!st.busy,
      bookBtn: st.busy ? 'Отправка…' : 'Подтвердить',
      msgBtn: st.busy ? 'Отправка…' : 'Отправить',
      bookErrOn: !!st.bookError, bookError: st.bookError,
      msgErrOn: !!st.msgError, msgError: st.msgError,
      inlineErrOn: !!st.inlineError, inlineError: st.inlineError,
      /* запись выключена в админке: вместо календаря — форма обратной связи */
      bookingOn: !!st.bookingOn, bookingOff: !st.bookingOn,
      meetLead: st.bookingOn ? 'Выберите удобное время. На\u00a0звонке мы\u00a0обсудим:' : 'Напишите нам, и\u00a0мы договоримся о\u00a0звонке. Обсудим:',
      inlineForm: !st.inlineDone, inlineDone: !!st.inlineDone, inlineEmail: st.inlineEmail,
      submitInline: (e) => {
        if (this.demo) { const f = this.formData(e); this.setState({ inlineDone: true, inlineEmail: f.email || 'вашу почту' }); return; }
        this.sendForm(e, '/api/contact.php', {}, 'inlineError').then((d) => { if (d && d.ok) { this.setState({ inlineDone: true, inlineEmail: d.form.email }); this.revealCal(); } });
      },
      resetInline: () => { this.formAt = Date.now(); this.setState({ inlineDone: false, inlineError: '' }); },
      /* модальное окно */
      modalOpen: !!st.modal, modalForm: !st.modalDone, modalDone: !!st.modalDone, msgEmail: st.msgEmail,
      openModal: () => { this.formAt = Date.now(); this.setState({ modal: true, modalDone: false, msgError: '' }); },
      closeModal: () => this.setState({ modal: false }),
      modalBackdrop: (e) => { if (e.target === e.currentTarget) this.setState({ modal: false }); },
      submitMsg: (e) => {
        if (this.demo) { const f = this.formData(e); this.setState({ modalDone: true, msgEmail: f.email || 'вашу почту' }); return; }
        this.sendForm(e, '/api/contact.php', {}, 'msgError').then((d) => { if (d && d.ok) this.setState({ modalDone: true, msgEmail: d.form.email }); });
      }
    };
  }

  renderVals() {
    const open = !!this.state.open;
    const webgl = !!(this.props.webgl ?? true);
    /* hero: "field" — поле из фраз (основной), "webgl" — прежний мерцающий фон */
    const heroMode = this.props.hero === 'webgl' ? 'webgl' : 'field';
    const fieldOn = heroMode === 'field' && !this.state.fieldFail;
    const glOn = heroMode === 'webgl' && webgl;
    return {
      webgl,
      glOn,
      fieldOn,
      setField: this.setField,
      rootClass: (glOn && this.state.glReady ? 'axia axia--gl' : 'axia') + (fieldOn ? ' hd' : '') + (this.state.navLabel === 'Обсудить задачу' ? ' is-contact' : '') + (this.state.light ? ' is-light' : '') + (this.state.lightSol ? ' is-light-sol' : '') + (this.state.top ? ' is-top' : ''),
      ...this.meetVals(),
      navLabel: this.state.navLabel,
      /* КОМАНДА: выбранный участник (0 — Ксения, 1 — Андрей, 2 — Диана) */
      /* описание участника листается стрелками по страницам: основное / подробнее, а на очень низких экранах
         абзацы, которые не помещаются, переносятся на следующую страницу (страницы считает updateTmPages) */
      /* «Профиль · 1/2»: страницы описания — основное, подробнее; на низких экранах лишние абзацы переносятся на следующую */
      tmPgNum: ((this.state.tmPage || 0) + 1) + '/' + (this.state.tmPageN || 2),
      tmPrevCls: 'tm__pgbtn' + (!(this.state.tmPage > 0) ? ' is-off' : ''), tmPrevDis: !(this.state.tmPage > 0) ? 'true' : 'false',
      tmNextCls: 'tm__pgbtn' + ((this.state.tmPage || 0) >= (this.state.tmPageN || 2) - 1 ? ' is-off' : ''), tmNextDis: (this.state.tmPage || 0) >= (this.state.tmPageN || 2) - 1 ? 'true' : 'false',
      tmPrev: () => { if (this.state.tmPage > 0) { this.setState({ tmPage: this.state.tmPage - 1 }); this.tmPagesSoon(true); } },
      tmNext: () => { if ((this.state.tmPage || 0) < (this.state.tmPageN || 2) - 1) { this.setState({ tmPage: (this.state.tmPage || 0) + 1 }); this.tmPagesSoon(true); } },
      tmQ0_0: this.tmQ(0, 0, 2), tmQ0_1: this.tmQ(0, 1, 2), tmQ0_2: this.tmQ(0, 2, 2), tmQ0_3: this.tmQ(0, 3, 2), tmQ0_4: this.tmQ(0, 4, 2), tmQ1_0: this.tmQ(1, 0, 2), tmQ1_1: this.tmQ(1, 1, 2), tmQ1_2: this.tmQ(1, 2, 2), tmQ1_3: this.tmQ(1, 3, 2), tmQ1_4: this.tmQ(1, 4, 2), tmQ2_0: this.tmQ(2, 0, 2), tmQ2_1: this.tmQ(2, 1, 2), tmQ2_2: this.tmQ(2, 2, 2), tmQ2_3: this.tmQ(2, 3, 2),
      tmP0: 'tm__photo' + (this.state.tm === 0 ? ' is-active' : ''), tmC0: 'tm__card' + (this.state.tm === 0 ? ' is-active' : ''), tmH0: this.state.tm === 0 ? 'false' : 'true', tmT0: 'tm__thumb' + (this.state.tm === 0 ? ' is-active' : ''), tmS0: this.state.tm === 0 ? 'true' : 'false', tmPick0: () => { if (this.state.tm !== 0) { this.setState({ tm: 0, tmPage: 0 }); this.tmPagesSoon(true); } },
      tmP1: 'tm__photo' + (this.state.tm === 1 ? ' is-active' : ''), tmC1: 'tm__card' + (this.state.tm === 1 ? ' is-active' : ''), tmH1: this.state.tm === 1 ? 'false' : 'true', tmT1: 'tm__thumb' + (this.state.tm === 1 ? ' is-active' : ''), tmS1: this.state.tm === 1 ? 'true' : 'false', tmPick1: () => { if (this.state.tm !== 1) { this.setState({ tm: 1, tmPage: 0 }); this.tmPagesSoon(true); } },
      tmP2: 'tm__photo' + (this.state.tm === 2 ? ' is-active' : ''), tmC2: 'tm__card' + (this.state.tm === 2 ? ' is-active' : ''), tmH2: this.state.tm === 2 ? 'false' : 'true', tmT2: 'tm__thumb' + (this.state.tm === 2 ? ' is-active' : ''), tmS2: this.state.tm === 2 ? 'true' : 'false', tmPick2: () => { if (this.state.tm !== 2) { this.setState({ tm: 2, tmPage: 0 }); this.tmPagesSoon(true); } },
      setSection: this.setSection,
      setWho: this.setWho,
      setApprSection: this.setApprSection,
      setSol: this.setSol,
      solI0: 'sol__item' + (this.state.solOpen === 0 ? ' is-open' : '') + (this.state.solLive === 0 ? ' is-live' : ''), solE0: this.state.solOpen === 0 ? 'true' : 'false',
      solT0: (e) => this.solToggle(0, e), solK0: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.solToggle(0, e); } },
      solI1: 'sol__item' + (this.state.solOpen === 1 ? ' is-open' : '') + (this.state.solLive === 1 ? ' is-live' : ''), solE1: this.state.solOpen === 1 ? 'true' : 'false',
      solT1: (e) => this.solToggle(1, e), solK1: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.solToggle(1, e); } },
      solI2: 'sol__item' + (this.state.solOpen === 2 ? ' is-open' : '') + (this.state.solLive === 2 ? ' is-live' : ''), solE2: this.state.solOpen === 2 ? 'true' : 'false',
      solT2: (e) => this.solToggle(2, e), solK2: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.solToggle(2, e); } },
      solI3: 'sol__item' + (this.state.solOpen === 3 ? ' is-open' : '') + (this.state.solLive === 3 ? ' is-live' : ''), solE3: this.state.solOpen === 3 ? 'true' : 'false',
      solT3: (e) => this.solToggle(3, e), solK3: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.solToggle(3, e); } },
      solI4: 'sol__item' + (this.state.solOpen === 4 ? ' is-open' : '') + (this.state.solLive === 4 ? ' is-live' : ''), solE4: this.state.solOpen === 4 ? 'true' : 'false',
      solT4: (e) => this.solToggle(4, e), solK4: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.solToggle(4, e); } },
      solI5: 'sol__item' + (this.state.solOpen === 5 ? ' is-open' : '') + (this.state.solLive === 5 ? ' is-live' : ''), solE5: this.state.solOpen === 5 ? 'true' : 'false',
      solT5: (e) => this.solToggle(5, e), solK5: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.solToggle(5, e); } },
      solI6: 'sol__item' + (this.state.solOpen === 6 ? ' is-open' : '') + (this.state.solLive === 6 ? ' is-live' : ''), solE6: this.state.solOpen === 6 ? 'true' : 'false',
      solT6: (e) => this.solToggle(6, e), solK6: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.solToggle(6, e); } },
      solI7: 'sol__item' + (this.state.solOpen === 7 ? ' is-open' : '') + (this.state.solLive === 7 ? ' is-live' : ''), solE7: this.state.solOpen === 7 ? 'true' : 'false',
      solT7: (e) => this.solToggle(7, e), solK7: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.solToggle(7, e); } },
      fitSolItem: (e) => { const li = e.currentTarget; if (li) this.fitSolOne(li.querySelector('.sol__tx'), li.offsetWidth); },
      setWordsPanel: this.setWordsPanel,
      ad0: 'appr__desc' + (this.state.apprStep === 0 ? ' is-active' : ''),
      ad1: 'appr__desc' + (this.state.apprStep === 1 ? ' is-active' : ''),
      ah0: this.state.apprStep === 0 ? 'false' : 'true',
      ah1: this.state.apprStep === 1 ? 'false' : 'true',
      c0: 'dirs__slide' + (this.state.dir === 0 ? ' is-active' : ''),
      c1: 'dirs__slide' + (this.state.dir === 1 ? ' is-active' : ''),
      c2: 'dirs__slide' + (this.state.dir === 2 ? ' is-active' : ''),
      h0: this.state.dir === 0 ? 'false' : 'true',
      h1: this.state.dir === 1 ? 'false' : 'true',
      h2: this.state.dir === 2 ? 'false' : 'true',
      /* якорные ссылки (#directions и т. п.): плавный скролл внутри страницы, без перехода по адресу;
         ссылки на ещё не сделанные секции просто ничего не делают */
      onAnchor: (e) => {
        const a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
        if (!a) return;
        e.preventDefault();
        /* планшет и мобильный: лого внутри плашки меню — часть кнопки меню: раскрывает / закрывает его */
        if (a.classList.contains('logo--nav')) {
          const r = a.closest('.axia');
          if ((r ? r.clientWidth : window.innerWidth) <= 1024) { this.setState({ open: !this.state.open, suppress: false, solOpen: -1 }); return; }
        }
        /* клик по пункту меню: меню сворачивается сразу (на десктопе — даже если курсор ещё над ним) */
        if (a.closest('.nav')) { this.setState({ open: false, suppress: true }); if (a.blur) a.blur(); }
        const id = a.getAttribute('href').slice(1);
        const doc = a.ownerDocument;
        if (!id || id === 'top') { (this.root || doc.body).scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        const el = doc.getElementById(id);
        /* «команда»: блок «заголовок + (первое) фото + подпись» — по центру видимой области между плашкой меню
           и кнопкой внизу (на мобильном); прокручиваем тот контейнер, который реально скроллится */
        const anchor = id === 'team' && el ? el.querySelector('.team__anchor') : null;
        const win = doc.defaultView || window;
        if (anchor && anchor.offsetHeight) {
          let sc = el.parentElement;
          while (sc && sc !== doc.body && sc !== doc.documentElement) {
            const oy = getComputedStyle(sc).overflowY;
            if ((oy === 'auto' || oy === 'scroll') && sc.scrollHeight > sc.clientHeight + 1) break;
            sc = sc.parentElement;
          }
          const isDoc = !sc || sc === doc.body || sc === doc.documentElement;
          const vr = isDoc ? { top: 0, bottom: win.innerHeight } : sc.getBoundingClientRect();
          let top = vr.top, bottom = vr.bottom;
          const navEl = doc.querySelector('.nav-slot'), ctaEl = doc.querySelector('.header .cta');
          if (navEl) { const r = navEl.getBoundingClientRect(); if (r.bottom > top && r.bottom < (top + bottom) / 2) top = r.bottom; }
          if (ctaEl) { const r = ctaEl.getBoundingClientRect(); if (r.top > (top + bottom) / 2 && r.top < bottom) bottom = r.top; }
          const ar = anchor.getBoundingClientRect();
          const delta = ar.height <= bottom - top ? (ar.top + ar.bottom) / 2 - (top + bottom) / 2 : ar.top - top - 16;
          if (isDoc) win.scrollBy({ top: delta, behavior: 'smooth' }); else sc.scrollBy({ top: delta, behavior: 'smooth' });
          return;
        }
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      setCanvas: this.setCanvas,
      navClass: 'nav' + (open ? ' is-open' : '') + (this.state.suppress ? ' is-suppressed' : ''),
      expanded: open ? 'true' : 'false',
      toggle: () => this.setState({ open: !this.state.open, suppress: false, solOpen: -1 }),
      /* уход курсора закрывает меню только на десктопе; на планшете и мобильном — тап по крестику или мимо меню */
      close: () => {
        const upd = {};
        if (this.state.suppress) upd.suppress = false;
        if (this.state.open && window.innerWidth > 1024) upd.open = false;
        if (Object.keys(upd).length) this.setState(upd);
      }
    };
  }
}

DC.mount(Page, document.getElementById('page'), document.getElementById('root'));
