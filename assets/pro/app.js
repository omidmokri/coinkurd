/* entekhab.net — /market/ : the live-market workspace (multi-chart, chart types, any timeframe down to 1 s,
   indicators, drawing tools, replay, watchlist, alerts, economic calendar on the chart, templates, data export,
   automatic saving). Everything personal stays in this browser (localStorage); nothing is sent anywhere.
   Modules: ind.js (maths) · data.js (Binance/OKX/site data) · draw.js (drawings) · i18n.js (four languages)
            app.js (this: workspace, charts, toolbar, dialogs) · panels.js (watchlist, alerts, calendar, objects) · replay.js */
(function () {
  'use strict';
  var P = window.PRO, LW = window.LightweightCharts, I = P.ind, S = P.store, d = document, de = d.documentElement;
  if (!LW || !P || !I) return;
  window.I18N = 1;

  /* ---------------------------------------------------------------- language
     The site's own four (ckb, fa, ar, en) live here at /market/ and follow the site's switch (ck_lang; Arabic: ek_ar,
     translated around the page by ar.js). The other 43 (langs.js) each have a page of their own, /market/<code>/,
     which names its language on <html data-pro-lang>; their strings come from assets/pro/l10n/<code>.js, machine-
     translated by CI (scripts/pro_l10n.py), and a string not translated yet shows in English. */
  var LROW = {}; (P.LANGS || []).forEach(function (r) { LROW[r[0]] = r; });
  var SITE = P.SITE_LANGS || ['ckb', 'fa', 'ar', 'en'];
  var PAGE_LANG = de.getAttribute('data-pro-lang'); if (PAGE_LANG && (!LROW[PAGE_LANG] || SITE.indexOf(PAGE_LANG) >= 0)) PAGE_LANG = null;
  function detectLang() {
    if (PAGE_LANG) return PAGE_LANG;
    var q = /[?&]lang=(fa|ckb|en|ar)\b/.exec(location.search), ls = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
    if (q) { try { localStorage.removeItem('ek_pro_lang'); if (q[1] === 'ar') { localStorage.setItem('ek_ar', '1'); localStorage.setItem('ck_lang', 'en'); } else { localStorage.removeItem('ek_ar'); localStorage.setItem('ck_lang', q[1]); } } catch (e) { } return q[1]; }
    if (ls('ek_ar') === '1') return 'ar';
    var l = ls('ck_lang'); return ['fa', 'ckb', 'en'].indexOf(l) >= 0 ? l : 'fa';
  }
  var LANG = detectLang();
  var T = function (k, a) { return P.tr(LANG, k, a); };
  var RTL = function () { var r = LROW[LANG]; return r ? r[5] === 'rtl' : LANG !== 'en'; };
  /* the language tag pages and screen readers expect: the site's own four as they are, the others by their hreflang
     (the page path /iw/ is Hebrew, he; /jp/ is ja; /cn/ zh-Hans …) */
  var TAG = function (l) { l = l || LANG; return SITE.indexOf(l) >= 0 || !LROW[l] ? l : LROW[l][4]; };
  if (P.fx) P.fx.init(LANG);
  /* a language from the menu: the site's own four at /market/ (the site's switch remembers them), any other at its
     own address (remembered here, so /market/ opens it next time) */
  function goLang(l) {
    if (!LROW[l]) return;
    try {
      if (SITE.indexOf(l) >= 0) {
        localStorage.removeItem('ek_pro_lang');
        if (l === 'ar') { localStorage.setItem('ek_ar', '1'); localStorage.setItem('ck_lang', 'en'); } else { localStorage.removeItem('ek_ar'); localStorage.setItem('ck_lang', l); }
      } else localStorage.setItem('ek_pro_lang', l);
    } catch (e) { }
    if (l === LANG && (PAGE_LANG ? true : SITE.indexOf(l) >= 0)) { closeModal(); return; }
    location.href = SITE.indexOf(l) >= 0 ? '/market/?lang=' + l : '/market/' + l + '/';
  }
  var DIG = { fa: '۰۱۲۳۴۵۶۷۸۹', ckb: '٠١٢٣٤٥٦٧٨٩', ar: '٠١٢٣٤٥٦٧٨٩' };
  function loc(n) { var m = DIG[LANG]; return m ? String(n).replace(/\d/g, function (c) { return m[c]; }) : String(n); }

  /* ---------------------------------------------------------------- tiny DOM helpers */
  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || d).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function h(html) { var t = d.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function debounce(f, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { f.apply(s, a); }, ms); }; }
  var SYM_RE = P.SYM_RE || /^[A-Z0-9]{1,12}$/;

  /* ---------------------------------------------------------------- icons (24×24 line glyphs) */
  var IC = {
    dot: '<circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
    arrowc: '<path d="M6 3v15l4-4 3 6 2-1-3-6h6z"/>',
    eraser: '<path d="M15 4l5 5-9 9H6l-3-3z"/><path d="M10 9l5 5"/><path d="M11 20h9"/>',
    info: '<path d="M4 19 20 5"/><circle cx="4" cy="19" r="1.6"/><circle cx="20" cy="5" r="1.6"/><rect x="12" y="14" width="9" height="6" rx="1"/>',
    angle: '<path d="M4 19 19 6"/><path d="M4 19h16"/><path d="M11 19a7 7 0 0 0-2-5"/>',
    cross: '<path d="M2 12h20M12 2v20"/><circle cx="12" cy="12" r="1.6"/>',
    regress: '<path d="M3 15 21 7"/><path d="M3 9 21 1" stroke-dasharray="2 2"/><path d="M3 21 21 13" stroke-dasharray="2 2"/>',
    flat: '<path d="M3 6h18"/><path d="M3 20 21 10"/>',
    disjoint: '<path d="M3 5 21 9"/><path d="M3 19 21 13"/>',
    schiff: '<path d="M3 15h18"/><path d="M8 8h13M8 20h13"/><path d="M8 8v12"/><path d="M3 20l5-5" stroke-dasharray="2 2"/>',
    mschiff: '<path d="M5 14h16"/><path d="M9 8h12M9 20h12"/><path d="M9 8v12"/><circle cx="5" cy="14" r="1.6"/>',
    inside: '<path d="M3 12h18"/><path d="M9 9h12M9 15h12"/><path d="M3 12 9 5v14z"/>',
    fibch: '<path d="M3 13 21 5M3 17 21 9M3 21 21 13"/>',
    fibtz: '<path d="M4 3v18M7 3v18M10 3v18M14 3v18M20 3v18"/>',
    fibfan: '<path d="M4 20 20 4M4 20 20 9M4 20l16-3M4 20 9 4"/>',
    fibtime: '<path d="M5 3v18M10 3v18M14 3v18M20 3v18"/><path d="M3 16l4-6 4 4" />',
    fibcirc: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="9.5"/>',
    fibspiral: '<path d="M12 12a1.5 1.5 0 0 1 3 0 3 3 0 0 1-3 3 5 5 0 0 1-5-5 7 7 0 0 1 7-7 9 9 0 0 1 9 9"/>',
    fibarc: '<path d="M3 20a5 5 0 0 1 10 0M3 20a9 9 0 0 1 18 0"/><path d="M8 20h0"/>',
    fibwedge: '<path d="M4 20 20 6M4 20h17"/><path d="M12 20a8 8 0 0 0-2-5M17 20a13 13 0 0 0-3-9"/>',
    pitchfan: '<path d="M4 18 20 4M4 18l16-6M4 18h16"/><path d="M20 4v14"/>',
    gannbox: '<rect x="3" y="3" width="18" height="18"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    gannsq: '<rect x="3" y="3" width="18" height="18"/><path d="M3 21 21 3M3 3l18 18"/><path d="M3 21a18 18 0 0 1 18-18"/>',
    xabcd: '<path d="M3 18 8 5l3 9 5-6 5 12"/><path d="M3 18l8-4" stroke-dasharray="2 2"/>',
    cypher: '<path d="M3 16 7 6l4 7 5-9 5 14"/><circle cx="21" cy="18" r="1.4"/>',
    hs: '<path d="M2 18l4-7 3 4 3-10 3 10 3-4 4 7"/><path d="M2 15h20" stroke-dasharray="2 2"/>',
    abcd: '<path d="M3 18 9 6l5 7 7-9"/>',
    tri: '<path d="M3 4l5 14 4-10 4 7 5-4"/><path d="M3 4 21 11M8 18l13-7" stroke-dasharray="2 2"/>',
    drives: '<path d="M2 18l4-5 2 2 5-7 2 2 7-8"/>',
    ewimp: '<path d="M2 19l4-7 3 3 5-10 3 4 5-6"/><text x="13" y="23" font-size="7" fill="currentColor" stroke="none">5</text>',
    ewcor: '<path d="M3 5l6 10 4-5 8 10"/><text x="15" y="10" font-size="7" fill="currentColor" stroke="none">C</text>',
    ewtri: '<path d="M2 6l4 12 4-9 4 7 4-5 4 3"/>',
    ewdbl: '<path d="M3 5l5 7 5-3 8 11"/><text x="2" y="22" font-size="7" fill="currentColor" stroke="none">WXY</text>',
    ewtrp: '<path d="M2 4l4 6 3-2 4 6 3-2 6 8"/>',
    cyclic: '<path d="M4 3v18M10 3v18M16 3v18M22 3v18"/>',
    tcycle: '<path d="M2 18a5 5 0 0 1 10 0 5 5 0 0 1 10 0"/>',
    sine: '<path d="M2 12c2-8 5-8 7 0s5 8 7 0 5-8 6-3"/>',
    forecast: '<path d="M4 18 20 6" stroke-dasharray="3 2"/><circle cx="20" cy="6" r="2.2"/><circle cx="4" cy="18" r="1.6"/>',
    proj: '<path d="M3 18 10 6l11 8z"/>',
    avwap: '<path d="M3 18c4 0 5-6 9-6s5 3 9-6"/><circle cx="3" cy="18" r="1.8"/>',
    vrp: '<path d="M4 4v16"/><path d="M4 6h6M4 9h10M4 12h15M4 15h9M4 18h5"/>',
    prange: '<path d="M12 4v16"/><path d="M8 8l4-4 4 4M8 16l4 4 4-4"/><path d="M5 4h14M5 20h14"/>',
    drange: '<path d="M4 12h16"/><path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/><path d="M4 5v14M20 5v14"/>',
    hl: '<path d="M5 19l5-1 9-9-4-4-9 9z" fill="rgba(250,204,21,.35)"/><path d="M3 21h18"/>',
    arrowmk: '<path d="M3 15h11v4l7-7-7-7v4H3z"/>',
    arrowup: '<path d="M12 3 5 11h4v9h6v-9h4z"/>',
    arrowdn: '<path d="M12 21 5 13h4V4h6v9h4z"/>',
    rrect: '<path d="M6 3 21 9l-4 11L2 14z"/>',
    path: '<path d="M3 18l6-9 5 5 6-9"/><path d="M16 5h4v4"/>',
    circ: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    poly: '<path d="M4 7l7-4 9 6-3 11H7z"/>',
    tri3: '<path d="M12 3 21 20H3z"/>',
    arc: '<path d="M3 18C5 6 19 6 21 18"/>',
    curve: '<path d="M3 19C6 4 18 4 21 19"/><circle cx="12" cy="5" r="1.2" fill="currentColor"/>',
    dcurve: '<path d="M3 18c4-14 9-14 9-6s5 8 9-6"/>',
    note: '<path d="M5 3h14v14l-4 4H5z"/><path d="M15 21v-4h4"/><path d="M8 8h8M8 12h6"/>',
    signpost: '<path d="M12 22V10"/><path d="M5 3h12l3 3-3 3H5z"/>',
    callout: '<rect x="3" y="3" width="18" height="11" rx="2"/><path d="M8 14l-3 7"/>',
    comment: '<path d="M4 4h16v11H10l-5 5v-5H4z"/>',
    plabel: '<path d="M3 12l5-6h13v12H8z"/>',
    pnote: '<circle cx="5" cy="18" r="2"/><path d="M6.5 16.5 12 11"/><rect x="11" y="4" width="10" height="7" rx="1.5"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-3 4 3 4H5"/>',
    emoji: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h0M15 9h0"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2M8 11h6M11 8v6"/>',
    zoomin: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2M8 11h6M11 8v6"/>',
    zoomout: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2M8 11h6"/>',
    magnet2: '<path d="M6 3v8a6 6 0 0 0 12 0V3"/><path d="M6 7h4M14 7h4"/><path d="M12 1v3" stroke-width="2.4"/>',
    cursor: '<path d="M5 3l14 7-6 2-2 6z"/>', trend: '<path d="M4 19 20 5"/><circle cx="4" cy="19" r="1.6"/><circle cx="20" cy="5" r="1.6"/>',
    ray: '<path d="M4 19 21 4"/><circle cx="4" cy="19" r="1.6"/><circle cx="12" cy="12" r="1.6"/>', ext: '<path d="M2 21 22 3"/><circle cx="8" cy="15.6" r="1.6"/><circle cx="16" cy="8.4" r="1.6"/>',
    arrow: '<path d="M4 20 19 5"/><path d="M11 5h8v8"/>', hline: '<path d="M2 12h20"/><circle cx="12" cy="12" r="1.6"/>', hray: '<path d="M8 12h14"/><circle cx="8" cy="12" r="1.6"/>',
    vline: '<path d="M12 2v20"/><circle cx="12" cy="12" r="1.6"/>', channel: '<path d="M3 16 15 4"/><path d="M9 20 21 8"/><path d="M6 18l12-12" stroke-dasharray="2 2"/>',
    rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>', circle: '<ellipse cx="12" cy="12" rx="9" ry="7"/>', brush: '<path d="M4 18c3 0 3-4 6-4s3 4 6 4 3-6 5-8"/>',
    fib: '<path d="M3 5h18M3 9.5h18M3 14h18M3 19h18"/><path d="M5 19 19 5" stroke-dasharray="2 2"/>', fibext: '<path d="M3 6h18M3 11h18M3 16h18"/><path d="M4 20l5-8 4 4" />',
    gann: '<path d="M4 20 20 4"/><path d="M4 20 20 12"/><path d="M4 20 12 4"/><path d="M4 20h16"/>', pitch: '<path d="M3 12h18"/><path d="M6 6l15 0" /><path d="M6 18h15"/><path d="M6 6v12"/>',
    text: '<path d="M5 6V4h14v2"/><path d="M12 4v16"/><path d="M9 20h6"/>', measure: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16l4-5 3 3 5-7"/>',
    long: '<rect x="4" y="4" width="16" height="7" rx="1" fill="rgba(52,211,153,.35)"/><rect x="4" y="11" width="16" height="7" rx="1" fill="rgba(255,90,77,.35)"/>',
    short: '<rect x="4" y="4" width="16" height="7" rx="1" fill="rgba(255,90,77,.35)"/><rect x="4" y="11" width="16" height="7" rx="1" fill="rgba(52,211,153,.35)"/>',
    magnet: '<path d="M6 3v8a6 6 0 0 0 12 0V3"/><path d="M6 7h4M14 7h4"/>', keep: '<path d="M4 20l3-1 9-9-2-2-9 9z"/><path d="M14 6l2-2 2 2-2 2"/><rect x="14" y="15" width="7" height="6" rx="1"/><path d="M15.5 15v-1.5a2 2 0 0 1 4 0V15"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 22 12s-1 2-3 4M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.2-1"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', fold: '<path d="m9 6 6 6-6 6"/><path d="M4 4v16"/>', plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/>',
    fx: '<path d="M8 20c2 0 2-2 2.5-6S12 4 15 4"/><path d="M7 11h7"/><path d="m14 14 6 6M20 14l-6 6"/>', replay: '<path d="M11 7 5 12l6 5z"/><path d="M19 7l-6 5 6 5z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>', grid: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>', down: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>', share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
    chev: '<path d="m6 9 6 6 6-6"/>', candle: '<path d="M7 3v18M17 3v18"/><rect x="4.5" y="7" width="5" height="9" rx="1"/><rect x="14.5" y="6" width="5" height="7" rx="1"/>',
    tpl: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 9v11"/>', play: '<path d="M7 4v16l13-8z"/>', pause: '<path d="M7 4h4v16H7zM14 4h4v16h-4z"/>',
    step: '<path d="M5 4v16l10-8z"/><path d="M18 4v16"/>', back: '<path d="M19 4v16L9 12z"/><path d="M6 4v16"/>', save: '<path d="M5 3h11l4 4v14H5z"/><path d="M8 3v6h8"/><rect x="8" y="13" width="8" height="6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6"/><path d="M12 17h0"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', bt: '<path d="M3 20h18"/><path d="M5 16l4-5 3 3 6-8"/><path d="M15 6h3v3"/>', side: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>', pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>'
  };
  function ic(n, cls) { return '<svg class="pm-ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>'; }

  /* Entekhab's own layers (outputs of the site's data; no indicator code ever reaches this page) */
  var LAYERS = { posts: { src: '/data/impact.json' }, sigs: { src: '/data/signals.json' }, live: { src: '/data/live.json' }, news: { src: '/data/news.json' } };
  var NEWSALIAS = { XAUT: 'GOLD', PAXG: 'GOLD' }, NEWSC = { regulation: '#a78bfa', security: '#ff5a4d', etf_institutional: '#38bdf8', onchain: '#2dd4bf', technical: '#9ca3af', news: '#f7931a' };
  function newsBase(sym) { var b = String(sym).replace(/_[A-Z]{3}$/, ''); return NEWSALIAS[b] || b; }
  function newsTitle(it) { var L = LANG; return (L === 'fa' && it.tfa) || (L === 'ckb' && it.tckb) || it.title; }

  /* ---------------------------------------------------------------- state (saved automatically) */
  var ROT = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'XAUT', 'ADA', 'LINK', 'AVAX', 'TRX', 'LTC', 'DOT', 'NEAR', 'SUI', 'UNI'];
  var LAYOUTS = { '1': 1, '2v': 2, '2h': 2, '3': 3, '3v': 3, '4': 4, '6': 6, '8': 8, '9': 9, '12': 12, '16': 16 };
  var TYPES = ['candle', 'hollow', 'volcandle', 'heikin', 'bars', 'highlow', 'line', 'linemk', 'step', 'area', 'hlcarea', 'baseline', 'columns', 'renko', 'lbreak', 'kagi', 'pnf'];
  var XFORM = { renko: 1, lbreak: 1, kagi: 1, pnf: 1 };          /* rebuilt from price alone (time only orders them) */
  var TFS = { s: ['1s', '5s', '10s', '15s', '20s', '30s', '45s'], m: ['1m', '3m', '5m', '15m', '30m', '45m'], h: ['1h', '2h', '3h', '4h', '6h', '8h', '12h'], d: ['1d', '3d', '1w', '1M'] };
  function hasLogo(s) { return P.hasLogo ? P.hasLogo(s) : (!P._logoSet || P._logoSet.has(s)); }      /* site rule: no coin without its own logo */
  function newChart(sym) { return { sym: sym || 'BTC', tf: '1h', type: 'candle', inds: [{ id: 'vol', p: {}, u: P.uid() }], scale: { mode: 0, auto: 1 } }; }
  function homeSym() { var q = P.fx ? P.fx.cur() : 'IRT'; return q === 'IRT' || q === 'USD' ? 'BTC' : 'BTC_' + q; }
  function defaults() {
    return { v: 1, layout: '1', active: 0, sync: { sym: false, tf: false, cross: true, time: false, ind: false }, charts: [newChart(homeSym())],
      tz: 'local', cal: 'greg', side: null, fav: ['1s', '5s', '15s', '1m', '5m', '15m', '1h', '4h', '1d', '1w'],
      ev: { on: 1, imp: ['H', 'M'], cur: [] }, keep: 0, magnet: 0, sound: 1, saver: null, name: '' };
  }
  function tpSane(t) {                              /* box size (0 = automatic ATR 14), reversal boxes, lines */
    var o = {}, b = +t.box, r = t.rev | 0, l = t.lines | 0;
    if (b > 0 && b < 1e12) o.box = b; if (r >= 1 && r <= 10) o.rev = r; if (l >= 1 && l <= 10) o.lines = l;
    return o;
  }
  function sane(s) {                                /* storage and shared links are untrusted: keep only what we know */
    var D = defaults(); if (!s || typeof s !== 'object') return D;
    var o = D;
    if (LAYOUTS[s.layout]) o.layout = s.layout;
    if (s.sync && typeof s.sync === 'object') ['sym', 'tf', 'cross', 'time', 'ind'].forEach(function (k) { o.sync[k] = !!s.sync[k]; });
    if (Array.isArray(s.charts) && s.charts.length) o.charts = s.charts.slice(0, 16).map(function (c) {
      var n = newChart(c && SYM_RE.test(c.sym) && hasLogo(c.sym) ? c.sym : 'BTC');
      if (c && P.parseTF(c.tf)) n.tf = c.tf;
      if (c && TYPES.indexOf(c.type) >= 0) n.type = c.type;
      if (c && c.tp && typeof c.tp === 'object') n.tp = tpSane(c.tp);
      if (c && Array.isArray(c.inds)) n.inds = c.inds.filter(function (x) { return x && (I.DEF[x.id] || LAYERS[x.id]); }).slice(0, 12).map(function (x) { return { id: x.id, p: I.DEF[x.id] ? I.params(x.id, x.p) : {}, u: typeof x.u === 'string' ? x.u.slice(0, 16) : P.uid(), off: !!x.off }; });
      if (c && c.scale) n.scale = { mode: [0, 1, 2].indexOf(c.scale.mode) >= 0 ? c.scale.mode : 0, auto: c.scale.auto === 0 ? 0 : 1 };
      return n;
    });
    o.active = Math.max(0, Math.min(o.charts.length - 1, s.active | 0));
    if (typeof s.tz === 'string' && s.tz.length < 40) o.tz = s.tz;
    if (s.cal === 'jalali') o.cal = 'jalali';
    /* the side panel always starts folded, so the chart opens at full width */
    if (Array.isArray(s.fav)) { var f = s.fav.filter(function (x) { return P.parseTF(x); }).slice(0, 14); if (f.length) o.fav = f; }
    if (s.ev && typeof s.ev === 'object') { o.ev.on = s.ev.on ? 1 : 0; if (Array.isArray(s.ev.imp)) o.ev.imp = s.ev.imp.filter(function (x) { return /^[HMLX]$/.test(x); }); if (Array.isArray(s.ev.cur)) o.ev.cur = s.ev.cur.filter(function (x) { return /^[A-Z]{3}$/.test(x); }); }
    ['keep', 'sound'].forEach(function (k) { if (k in s) o[k] = s[k] ? 1 : 0; });
    if ('magnet' in s) o.magnet = s.magnet === 2 ? 2 : s.magnet ? 1 : 0;
    if (['cursor', 'dot', 'arrowc'].indexOf(s.cm) >= 0) o.cm = s.cm;
    if (s.tg && typeof s.tg === 'object') { o.tg = {}; ['cur', 'lines', 'fib', 'pat', 'fc', 'shape', 'ann'].forEach(function (g) { if (typeof s.tg[g] === 'string' && /^[a-z0-9]{2,10}$/.test(s.tg[g])) o.tg[g] = s.tg[g]; }); }
    if (typeof s.emoji === 'string' && s.emoji.length <= 4) o.emoji = s.emoji;
    if (s.saver === true || s.saver === false) o.saver = s.saver;
    if (typeof s.name === 'string') o.name = s.name.slice(0, 40);
    return o;
  }
  var st = sane(S.get('ek_pro', null));
  var DRAW = S.get('ek_pro_draw', {}); if (!DRAW || typeof DRAW !== 'object' || Array.isArray(DRAW)) DRAW = {};
  var saveT = null, saved = true;
  function save() {
    saved = false; paintSaved();
    clearTimeout(saveT); saveT = setTimeout(function () {
      var ok1 = S.set('ek_pro', st), ok2 = S.set('ek_pro_draw', DRAW); saved = ok1 && ok2; paintSaved(saved ? 'ok' : 'err');
    }, 350);
  }
  function paintSaved(x) { var e = $('#pm-saved'); if (!e) return; e.className = 'pm-saved ' + (x || (saved ? 'ok' : 'wait')); e.textContent = x === 'err' ? T('saveErr') : saved || x === 'ok' ? T('saved') : T('saving'); }

  /* ---------------------------------------------------------------- shared event bus */
  var bus = {};
  function on(n, f) { (bus[n] = bus[n] || []).push(f); }
  function emit(n) { var a = [].slice.call(arguments, 1); (bus[n] || []).slice().forEach(function (f) { try { f.apply(null, a); } catch (e) { if (window.console) console.error(e); } }); }

  /* ---------------------------------------------------------------- time formatting in the chosen zone */
  var FMT = {};
  function tzName() { return st.tz === 'local' ? undefined : st.tz; }
  function dtf(kind) {
    var key = st.tz + '|' + st.cal + '|' + kind; if (FMT[key]) return FMT[key];
    var base = st.cal === 'jalali' ? (LANG === 'fa' ? 'fa-IR-u-ca-persian-nu-latn' : 'en-u-ca-persian') : SITE.indexOf(LANG) < 0 && LROW[LANG] ? LROW[LANG][3] + '-u-ca-gregory-nu-latn' : 'en-GB';
    var o = { timeZone: tzName(), hourCycle: 'h23' };
    if (kind === 'full') { o.year = '2-digit'; o.month = 'short'; o.day = 'numeric'; o.hour = '2-digit'; o.minute = '2-digit'; }
    if (kind === 'fulls') { o.year = '2-digit'; o.month = 'short'; o.day = 'numeric'; o.hour = '2-digit'; o.minute = '2-digit'; o.second = '2-digit'; }
    if (kind === 'date') { o.year = 'numeric'; o.month = 'short'; o.day = 'numeric'; }
    if (kind === 'y') o.year = 'numeric';
    if (kind === 'm') o.month = 'short';
    if (kind === 'd') { o.day = 'numeric'; o.month = 'short'; }
    if (kind === 'hm') { o.hour = '2-digit'; o.minute = '2-digit'; }
    if (kind === 'hms') { o.hour = '2-digit'; o.minute = '2-digit'; o.second = '2-digit'; }
    try { FMT[key] = new Intl.DateTimeFormat(base, o); } catch (e) { o.timeZone = undefined; FMT[key] = new Intl.DateTimeFormat(base, o); }
    return FMT[key];
  }
  function fmtT(t, kind) { try { return dtf(kind || 'full').format(new Date(t * 1000)); } catch (e) { return ''; } }
  var LOCS = { fa: 'fa-IR', ckb: 'ckb-IQ', ar: 'ar', en: 'en-GB' }, FMTD = {};
  Object.keys(LROW).forEach(function (k) { if (!LOCS[k]) LOCS[k] = LROW[k][3]; });
  /* dates written in the reader's language (lists, tooltips, logs) */
  function fmtD(t, kind) {
    var key = LANG + '|' + st.tz + '|' + st.cal + '|' + kind, f = FMTD[key];
    if (!f) {
      var o = { timeZone: tzName() }, cal = st.cal === 'jalali' ? 'persian' : 'gregory';
      if (kind === 'day') { o.weekday = 'long'; o.day = 'numeric'; o.month = 'long'; }
      else if (kind === 'date') { o.day = 'numeric'; o.month = 'short'; o.year = 'numeric'; }
      else { o.day = 'numeric'; o.month = 'short'; o.hour = '2-digit'; o.minute = '2-digit'; o.hourCycle = 'h23'; }
      try { f = new Intl.DateTimeFormat(LOCS[LANG] + '-u-ca-' + cal + '-nu-latn', o); } catch (e) { try { o.timeZone = undefined; f = new Intl.DateTimeFormat(LOCS[LANG] + '-u-ca-' + cal, o); } catch (e2) { f = dtf('full'); } }
      FMTD[key] = f;
    }
    try { return f.format(new Date(t * 1000)); } catch (e) { return ''; }
  }
  /* seconds east of UTC in the chosen zone at time t (for day/week boundaries) */
  var OFFF = {};
  function tzOffset(t) {
    t = Math.floor(t || Date.now() / 1000);
    if (st.tz === 'UTC') return 0;
    if (st.tz === 'local') return -new Date(t * 1000).getTimezoneOffset() * 60;
    try {
      var f = OFFF[st.tz] || (OFFF[st.tz] = new Intl.DateTimeFormat('en-US', { timeZone: st.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
      var p = {}; f.formatToParts(new Date(t * 1000)).forEach(function (x) { p[x.type] = x.value; });
      return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) / 1000 - t) / 60) * 60;
    } catch (e) { return -new Date(t * 1000).getTimezoneOffset() * 60; }
  }
  function tzLabel() {
    if (st.tz === 'UTC') return 'UTC';
    var off = -new Date().getTimezoneOffset();
    if (st.tz !== 'local') { try { var p = new Intl.DateTimeFormat('en-US', { timeZone: st.tz, timeZoneName: 'shortOffset' }).formatToParts(new Date()).filter(function (x) { return x.type === 'timeZoneName'; })[0]; return p ? p.value.replace('GMT', 'UTC') : st.tz; } catch (e) { return st.tz; } }
    var sg = off >= 0 ? '+' : '-', a = Math.abs(off); return 'UTC' + sg + Math.floor(a / 60) + (a % 60 ? ':' + String(a % 60).padStart(2, '0') : '');
  }
  function locOpts() {
    return { localization: { timeFormatter: function (t) { return fmtT(t, 'fulls'); }, priceFormatter: null },
      timeScale: { tickMarkFormatter: function (t, type) { return fmtT(t, type === 0 ? 'y' : type === 1 ? 'm' : type === 2 ? 'd' : type === 4 ? 'hms' : 'hm'); } } };
  }

  /* ---------------------------------------------------------------- overlays: toast, modal, popover menu */
  function toast(msg, kind) {
    $$('.pm-toast').forEach(function (x) { x.remove(); });
    var t = h('<div class="pm-toast ' + (kind || '') + '" role="status"></div>'); t.textContent = msg; t.dir = RTL() ? 'rtl' : 'ltr';
    ($('#pro') || d.body).appendChild(t); setTimeout(function () { t.classList.add('on'); }, 10);
    setTimeout(function () { t.classList.remove('on'); setTimeout(function () { t.remove(); }, 400); }, kind === 'long' ? 9000 : 4200);
  }
  var openModal = null;
  function modal(title, body, opts) {
    closeModal(); opts = opts || {};
    var m = h('<div class="pm-modal" role="dialog" aria-modal="true"><div class="pm-mbox' + (opts.wide ? ' wide' : '') + '" dir="' + (RTL() ? 'rtl' : 'ltr') + '" lang="' + TAG() + '">' +
      '<div class="pm-mhead"><b>' + esc(title) + '</b><button type="button" class="pm-ib pm-mx" aria-label="' + esc(T('close')) + '">' + ic('x') + '</button></div><div class="pm-mbody"></div></div></div>');
    var b = $('.pm-mbody', m); if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
    m.addEventListener('mousedown', function (e) { if (e.target === m) closeModal(); });
    $('.pm-mx', m).onclick = closeModal;
    ($('#pro') || d.body).appendChild(m); openModal = m; m._onclose = opts.onclose;
    var f = $('input,select,button:not(.pm-mx)', b); if (f && !opts.nofocus) setTimeout(function () { try { f.focus(); } catch (e) { } }, 30);
    return m;
  }
  function closeModal() { if (openModal) { var m = openModal; openModal = null; m.remove(); if (m._onclose) m._onclose(); } }
  function ask(title, value, cb, ph) {
    var f = h('<form class="pm-ask"><input class="pm-in" maxlength="60"><div class="pm-row"><button class="pm-btn pri" type="submit">' + esc(T('ok')) + '</button><button class="pm-btn" type="button" data-x>' + esc(T('cancel')) + '</button></div></form>');
    var inp = $('input', f); inp.value = value || ''; if (ph) inp.placeholder = ph;
    f.onsubmit = function (e) { e.preventDefault(); var v = inp.value.trim(); closeModal(); cb(v); };
    $('[data-x]', f).onclick = closeModal; modal(title, f);
  }
  function confirmBox(title, text, cb, yes) {
    var f = h('<div><p class="pm-p"></p><div class="pm-row"><button class="pm-btn pri" type="button" data-y></button><button class="pm-btn" type="button" data-x></button></div></div>');
    $('p', f).textContent = text; $('[data-y]', f).textContent = yes || T('ok'); $('[data-x]', f).textContent = T('cancel');
    $('[data-y]', f).onclick = function () { closeModal(); cb(); }; $('[data-x]', f).onclick = closeModal; modal(title, f);
  }
  var openMenu = null;
  function menu(anchor, items, opts) {
    closeMenu(); opts = opts || {};
    var m = h('<div class="pm-menu" role="menu" dir="' + (RTL() ? 'rtl' : 'ltr') + '" lang="' + TAG() + '"></div>');
    items.forEach(function (it) {
      if (!it) return;
      if (it.sep) { m.appendChild(h('<div class="pm-msep"></div>')); return; }
      if (it.head) { var hd = h('<div class="pm-mh"></div>'); hd.textContent = it.head; m.appendChild(hd); return; }
      if (it.html) { m.appendChild(it.html); return; }
      var b = h('<button type="button" role="menuitem" class="pm-mi' + (it.on ? ' on' : '') + '">' + (it.icon ? ic(it.icon) : '') + '<span></span>' + (it.hint ? '<small></small>' : '') + '</button>');
      $('span', b).textContent = it.label; if (it.hint) $('small', b).textContent = it.hint;
      if (it.disabled) b.disabled = true;
      b.onclick = function (e) { e.stopPropagation(); if (!it.stay) closeMenu(); it.act && it.act(b); };
      m.appendChild(b);
    });
    ($('#pro') || d.body).appendChild(m); openMenu = m;
    var r = anchor.getBoundingClientRect(), R = ($('#pro') || d.body).getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    var x = r.left - R.left, y = r.bottom - R.top + 4;
    if (x + mw > R.width - 4) x = Math.max(4, r.right - R.left - mw);
    if (y + mh > R.height - 4 && r.top - R.top - mh - 4 > 0) y = r.top - R.top - mh - 4;
    m.style.left = x + 'px'; m.style.top = y + 'px';
    setTimeout(function () { d.addEventListener('mousedown', outside, true); d.addEventListener('touchstart', outside, true); }, 0);
    return m;
  }
  function outside(e) { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } d.removeEventListener('mousedown', outside, true); d.removeEventListener('touchstart', outside, true); }
  function download(name, data, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain' }), a = d.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; d.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /* ---------------------------------------------------------------- Entekhab's own layers: loaded on demand (LAYERS is defined near the top) */
  var LCACHE = {};
  function layerData(id) {
    if (LCACHE[id]) return LCACHE[id];
    return (LCACHE[id] = P.getJSON(LAYERS[id].src + '?v=' + Math.floor(Date.now() / 6e5)).catch(function () { delete LCACHE[id]; return null; }));
  }

  /* ================================================================ a chart cell */
  var cells = [];
  function Cell(i) {
    this.i = i; this.cfg = st.charts[i]; this.bars = []; this.disp = []; this.series = {}; this.state = 'load'; this.sub = null; this.replay = null;
    var self = this;
    this.el = h('<div class="pm-cell" data-i="' + i + '"><div class="pm-leg"></div><div class="pm-chart"></div><div class="pm-msg" hidden></div><div class="pm-tip" hidden></div></div>');
    this.box = $('.pm-chart', this.el);
    this.el.addEventListener('pointerdown', function () { setActive(self.i); }, true);
    this.chart = LW.createChart(this.box, Object.assign({
      autoSize: true,
      layout: { background: { type: 'solid', color: '#0b0b0c' }, textColor: '#b8b8b2', fontFamily: 'Vazirmatn, "Space Grotesk", Tahoma, sans-serif', fontSize: 11, attributionLogo: false,
        panes: { separatorColor: 'rgba(255,255,255,.09)', separatorHoverColor: 'rgba(247,147,26,.25)', enableResize: true } },
      grid: { vertLines: { color: 'rgba(255,255,255,.035)' }, horzLines: { color: 'rgba(255,255,255,.035)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,.1)', scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: 'rgba(255,255,255,.1)', timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 7, shiftVisibleRangeOnNewBar: true },
      crosshair: { mode: 0, vertLine: { color: 'rgba(247,147,26,.45)', labelBackgroundColor: '#3a2a12' }, horzLine: { color: 'rgba(247,147,26,.45)', labelBackgroundColor: '#3a2a12' } }
    }, locOpts()));
    this.ovl = new Overlay(this); this.chart.panes()[0].attachPrimitive(this.ovl.prim);
    this.makeMain();
    this.chart.subscribeCrosshairMove(function (p) { self.onCross(p); });
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(function (r) { self.onRange(r); });
    this.chart.subscribeClick(function (p) { self.onClick(p); });
    this.load();
    if (window.ResizeObserver) { this.ro = new ResizeObserver(function () { self.sizeClass(); }); this.ro.observe(this.el); }
  }
  /* ---- chart types drawn by hand (custom series): volume candles, HLC area, kagi, point & figure */
  function ProView(kind) { var self = this; this.kind = kind; this._d = null; this._r = { draw: function (tg, pc) { self.draw(tg, pc); } }; }
  ProView.prototype.renderer = function () { return this._r; };
  ProView.prototype.update = function (d) { this._d = d; };
  ProView.prototype.priceValueBuilder = function (r) { return [r.low, r.high, r.close]; };
  ProView.prototype.isWhitespace = function (r) { return r.close == null; };
  ProView.prototype.defaultOptions = function () { return Object.assign({}, LW.customSeriesDefaultOptions || {}, { color: '#f7931a' }); };
  ProView.prototype.draw = function (target, pc) {
    var d = this._d, kind = this.kind; if (!d || !d.bars || !d.bars.length || !d.visibleRange) return;
    var UP = '#34d399', DN = '#ff5a4d';
    target.useBitmapCoordinateSpace(function (sc) {
      var x = sc.context, hr = sc.horizontalPixelRatio, vr = sc.verticalPixelRatio, B = d.bars, sp = d.barSpacing;
      var a = Math.max(0, d.visibleRange.from - 1), z = Math.min(B.length, d.visibleRange.to + 2), i, b, o;
      function Y(p) { var y = pc(p); return y == null ? null : y * vr; }
      if (kind === 'volcandle') {
        var vmax = 0; for (i = a; i < z; i++) vmax = Math.max(vmax, +B[i].originalData.v || 0);
        for (i = a; i < z; i++) {
          b = B[i]; o = b.originalData; var col = o.close >= o.open ? UP : DN, w = Math.max(1, sp * (vmax ? 0.12 + 0.78 * (o.v || 0) / vmax : 0.6)) * hr, cx = Math.round(b.x * hr);
          var yh = Y(o.high), yl = Y(o.low), yo = Y(o.open), yc = Y(o.close); if (yh == null || yl == null) continue;
          x.fillStyle = col; var lw = Math.max(1, Math.floor(hr)); x.fillRect(cx - Math.floor(lw / 2), Math.round(yh), lw, Math.max(1, Math.round(yl - yh)));
          var top = Math.min(yo, yc), hgt = Math.max(Math.round(Math.abs(yo - yc)), Math.max(1, Math.floor(vr)));
          x.fillRect(Math.round(cx - w / 2), Math.round(top), Math.max(1, Math.round(w)), hgt);
        }
      } else if (kind === 'hlcarea') {
        var pts = []; for (i = a; i < z; i++) { o = B[i].originalData; pts.push([B[i].x * hr, Y(o.high), Y(o.close), Y(o.low)]); }
        if (!pts.length) return;
        function band(k1, k2, fill) { x.beginPath(); pts.forEach(function (p, j) { if (j) x.lineTo(p[0], p[k1]); else x.moveTo(p[0], p[k1]); }); for (var j = pts.length - 1; j >= 0; j--) x.lineTo(pts[j][0], pts[j][k2]); x.closePath(); x.fillStyle = fill; x.fill(); }
        function line(k, col, w) { x.beginPath(); pts.forEach(function (p, j) { if (j) x.lineTo(p[0], p[k]); else x.moveTo(p[0], p[k]); }); x.strokeStyle = col; x.lineWidth = w * hr; x.stroke(); }
        band(1, 2, 'rgba(52,211,153,.22)'); band(2, 3, 'rgba(255,90,77,.22)');
        line(1, 'rgba(52,211,153,.9)', 1); line(3, 'rgba(255,90,77,.9)', 1); line(2, '#cbd5e1', 1.6);
      } else if (kind === 'kagi') {
        x.lineCap = 'square';
        function seg(x1, y1, x2, y2, yang) { x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.strokeStyle = yang ? UP : DN; x.lineWidth = (yang ? 3 : 1.2) * hr; x.stroke(); }
        for (i = a; i < z; i++) {
          b = B[i]; o = b.originalData; var X = Math.round(b.x * hr), y0 = Y(o.open), y1 = Y(o.close); if (y0 == null || y1 == null) continue;
          if (i > 0) seg(Math.round(B[i - 1].x * hr), y0, X, y0, o.y0);
          if (o.sw != null) { var ys = Y(o.sw); seg(X, y0, X, ys, o.y0); seg(X, ys, X, y1, o.y1); } else seg(X, y0, X, y1, o.y0);
        }
      } else if (kind === 'pnf') {
        for (i = a; i < z; i++) {
          b = B[i]; o = b.originalData; var bs = o.bs; if (!(bs > 0)) continue;
          var cxp = b.x * hr, bh = Math.abs((Y(o.low) || 0) - (Y(o.low + bs) || 0)), sz = Math.max(2 * hr, Math.min(sp * hr * 0.8, bh * 0.9)), r2 = sz / 2;
          x.strokeStyle = o.x ? UP : DN; x.lineWidth = Math.max(1, 1.2 * hr);
          var steps = Math.round((o.high - o.low) / bs);
          if (steps > 400) steps = 400;
          for (var k = 0; k <= steps; k++) {
            var cy = Y(o.low + k * bs); if (cy == null) continue;
            x.beginPath();
            if (o.x) { x.moveTo(cxp - r2, cy - r2); x.lineTo(cxp + r2, cy + r2); x.moveTo(cxp + r2, cy - r2); x.lineTo(cxp - r2, cy + r2); }
            else x.arc(cxp, cy, Math.max(1, r2 * 0.92), 0, Math.PI * 2);
            x.stroke();
          }
        }
      }
    });
  };
  Cell.prototype.prec = function () { var b = this.bars[this.bars.length - 1]; return P.precFor ? P.precFor(this.cfg.sym, b ? b.c : 1) : P.prec(b ? b.c : 1); };
  Cell.prototype.fmt = function (p) { return P.fmt(p, this.prec()); };
  Cell.prototype.makeMain = function () {
    var c = this.cfg, ch = this.chart, t = c.type, UP = '#34d399', DN = '#ff5a4d', s;
    if (this.drawer) { this.drawer.destroy(); this.drawer = null; }
    if (this.mk) { try { this.mk.detach(); } catch (e) { } this.mk = null; }
    if (this.main) { try { ch.removeSeries(this.main); } catch (e) { } }
    if (t === 'bars') s = ch.addSeries(LW.BarSeries, { upColor: UP, downColor: DN, thinBars: false });
    else if (t === 'line' || t === 'linemk' || t === 'step') s = ch.addSeries(LW.LineSeries, { color: '#f7931a', lineWidth: 2, pointMarkersVisible: t === 'linemk', pointMarkersRadius: 2.5, lineType: t === 'step' ? 1 : 0 });
    else if (t === 'area') s = ch.addSeries(LW.AreaSeries, { lineColor: '#f7931a', topColor: 'rgba(247,147,26,.32)', bottomColor: 'rgba(247,147,26,.02)', lineWidth: 2 });
    else if (t === 'baseline') s = ch.addSeries(LW.BaselineSeries, { topLineColor: UP, topFillColor1: 'rgba(52,211,153,.28)', topFillColor2: 'rgba(52,211,153,.04)', bottomLineColor: DN, bottomFillColor1: 'rgba(255,90,77,.04)', bottomFillColor2: 'rgba(255,90,77,.28)', lineWidth: 2 });
    else if (t === 'columns') s = ch.addSeries(LW.HistogramSeries, { color: UP });
    else if (t === 'volcandle' || t === 'hlcarea' || t === 'kagi' || t === 'pnf') s = ch.addCustomSeries(new ProView(t), {});
    else if (t === 'highlow') s = ch.addSeries(LW.CandlestickSeries, { upColor: 'rgba(91,141,239,.75)', downColor: 'rgba(91,141,239,.75)', borderVisible: false, wickVisible: false });
    else if (t === 'renko' || t === 'lbreak') s = ch.addSeries(LW.CandlestickSeries, { upColor: UP, downColor: DN, borderUpColor: UP, borderDownColor: DN, wickVisible: false });
    else s = ch.addSeries(LW.CandlestickSeries, { upColor: UP, downColor: DN, borderUpColor: UP, borderDownColor: DN, wickUpColor: UP, wickDownColor: DN });
    this.main = s; this.applyPrec();
    var self = this;
    this.drawer = new P.Drawer({ chart: ch, series: s, el: this.box, bars: function () { return self.disp; }, sec: function () { return self.tfSec(); }, sym: function () { return self.cfg.sym; },
      list: function (sym) { return DRAW[sym]; }, changed: drawChanged, fmt: function (p) { return self.fmt(p); }, T: T, touch: function () { return matchMedia('(pointer: coarse)').matches; },
      selected: function (dd) { emit('drawsel', self, dd); }, editText: editText, styleFor: function () { return lastStyle; }, blocked: function () { return !!self.picking; },
      settings: function (dd) { drawSettings(self, dd); }, erase: function (id) { removeDrawing(self, id); }, zoom: function (dd) { zoomTo(self, dd); },
      toolDone: function () { if (curTool) setTool(null); }, profiles: function () { return self.cfg.inds.filter(function (x) { return I.DEF[x.id] && I.DEF[x.id].prof && !x.off; }).map(function (x) { return { mode: I.DEF[x.id].prof, rows: x.p.rows }; }); }, emoji: function () { return st.emoji || EMOJI[0]; } });
    this.drawer.keep = !!st.keep; this.drawer.magnet = st.magnet | 0; this.drawer.eraser = eraserOn;
    if (curTool && st.active === this.i) this.drawer.setTool(curTool);
    this.mk = LW.createSeriesMarkers(s, []);
  };
  Cell.prototype.applyPrec = function () {
    var pr = this.prec(), tmn = P.isLocal && P.isLocal(this.cfg.sym) && pr === 0;
    /* toman (and yen, won, dong …) prices run to hundreds of millions: grouped digits on the axis (only for this series, not the oscillators) */
    if (this.main) this.main.applyOptions({ priceFormat: tmn ? { type: 'custom', minMove: 1, formatter: function (p) { return Math.round(p).toLocaleString('en-US'); } } : { type: 'price', precision: pr, minMove: Math.pow(10, -pr) } });
    var sc = this.cfg.scale; this.chart.priceScale('right').applyOptions({ mode: sc.mode, autoScale: !!sc.auto });
  };
  Cell.prototype.tfSec = function () { var tf = P.parseTF(this.cfg.tf); return tf ? tf.sec : 3600; };
  Cell.prototype.load = function () {
    var self = this, c = this.cfg;
    if (this.sub) { this.sub.off(); this.sub = null; }
    this.bars = []; this.disp = []; this.state = 'load'; this.feed = null; this.lastSel = null; this.btMarks = null; this._btHist = null;
    this.main.setData([]); this.clearInds();
    this.chart.applyOptions({ timeScale: { secondsVisible: this.tfSec() < 60 } });
    this.msg(T('loading'));
    var I = P.inst ? P.inst(c.sym) : null, tfo = P.parseTF(c.tf);
    if (I && tfo && tfo.sec < I.minSec) { c.tf = I.minSec >= 86400 ? '1d' : '5m'; toast(T('tfMin', { s: P.pair(c.sym), tf: tfLabel(c.tf) })); paintTop(); save(); }
    this.sub = P.feed(c.sym, c.tf, function (what, F, x) { self.onFeed(what, F, x); });
    if (!this.sub) { this.msg(T('badTf')); return; }
    this.feed = this.sub.feed;
    this.legend(); this.layers();
  };
  Cell.prototype.onFeed = function (what, F, x) {
    if (this.replay) { if (what === 'state') this.legend(); return; }
    if (what === 'reset' || what === 'more') {
      var ts = this.chart.timeScale(), r = ts.getVisibleLogicalRange(), had = this.bars.length, n0 = this.disp.length;
      this.bars = F.bars.slice(); if (what === 'reset') this.boxAuto = null; this.applyPrec(); this.render();
      /* older history arrived: keep the same items in view (bricks/columns are counted, not bars) */
      if (what === 'more' && r && x > 0) { var dx = this.xform() ? this.disp.length - n0 : x; if (dx > 0) ts.setVisibleLogicalRange({ from: r.from + dx, to: r.to + dx }); }
      else if (!had) { this.fit(); }
      if (this.pendingRange) { var pr = this.pendingRange; this.pendingRange = null; this.showRange(pr); }
      if (this.pendingGo) { var pg = this.pendingGo; this.pendingGo = null; goDate(this, pg); }
      this.msg(null); this.legend();
      emit('data', this);
    } else if (what === 'tick') {
      var b = x.bar, n = this.bars.length;
      if (n && this.bars[n - 1].t === b.t) this.bars[n - 1] = b; else if (!n || b.t > this.bars[n - 1].t) this.bars.push(b); else return;
      this.tick(x.isNew); emit('tick', this, b, x.closed);
    } else if (what === 'state') { this.legend(); if (F.state === 'error') this.msg(F.err === 'rate' ? T('noRate', { c: P.quoteOf ? P.quoteOf(this.cfg.sym) : '' }) : T('noData', { s: this.cfg.sym })); }
  };
  Cell.prototype.fit = function () {
    var n = this.disp.length; if (!n) return;
    var w = this.box.clientWidth || 600, show = Math.max(40, Math.min(n, Math.round(w / 7)));
    this.chart.timeScale().setVisibleLogicalRange({ from: n - show, to: n + 6 });
  };
  Cell.prototype.xform = function () { return !!XFORM[this.cfg.type]; };
  Cell.prototype.boxSize = function (bars) {
    var tp = this.cfg.tp || {};
    if (tp.box > 0) return tp.box;
    if (!this.boxAuto) this.boxAuto = I.autoBox(bars);
    return this.boxAuto;
  };
  Cell.prototype.toDisp = function (bars) {
    var t = this.cfg.type, tp = this.cfg.tp || {};
    if (t === 'heikin') return I.heikin(bars);
    if (t === 'renko') return I.renko(bars, this.boxSize(bars));
    if (t === 'kagi') return I.kagi(bars, this.boxSize(bars));
    if (t === 'pnf') return I.pnf(bars, this.boxSize(bars), tp.rev || 3);
    if (t === 'lbreak') return I.lbreak(bars, tp.lines || 3);
    return bars;
  };
  Cell.prototype.point = function (b, prev) {
    var t = this.cfg.type, UP = '#34d399', DN = '#ff5a4d';
    if (t === 'line' || t === 'linemk' || t === 'step' || t === 'area' || t === 'baseline') return { time: b.t, value: b.c };
    if (t === 'columns') return { time: b.t, value: b.c, color: b.c >= (prev ? prev.c : b.o) ? 'rgba(52,211,153,.75)' : 'rgba(255,90,77,.75)' };
    if (t === 'highlow') return { time: b.t, open: b.h, high: b.h, low: b.l, close: b.l };
    var p = { time: b.t, open: b.o, high: b.h, low: b.l, close: b.c };
    if (t === 'volcandle' || t === 'hlcarea') p.v = b.v || 0;
    if (t === 'kagi') { p.y0 = b.y0; p.y1 = b.y1; p.sw = b.sw; }
    if (t === 'pnf') { p.x = b.x; p.bs = b.bs; }
    if (t === 'hollow') {                    /* TradingView's hollow candles: hollow when close > open, colour from the previous close */
      var col = b.c >= (prev ? prev.c : b.o) ? UP : DN;
      p.color = b.c > b.o ? 'rgba(0,0,0,0)' : col; p.borderColor = col; p.wickColor = col;
    }
    return p;
  };
  Cell.prototype.render = function (upto) {
    var bars = upto != null ? this.bars.slice(0, upto + 1) : this.bars, self = this;
    this.disp = this.toDisp(bars);
    var D = this.disp, pts = new Array(D.length);
    for (var i = 0; i < D.length; i++) pts[i] = this.point(D[i], i ? D[i - 1] : null);
    this.main.setData(pts);
    if (this.cfg.type === 'baseline' && D.length) this.main.applyOptions({ baseValue: { type: 'price', price: D[Math.max(0, D.length - 150)].c } });
    this.renderInds(true);
    this.marks();
    this.drawer && this.drawer.update(); this.ovl.update();
  };
  Cell.prototype.tick = function (isNew) {
    if (this.xform()) {                     /* bricks/lines/columns: rebuild (cheap), redraw when one is added */
      var n0 = this.disp.length; this.disp = this.toDisp(this.bars);
      var n1 = this.disp.length; if (!n1) return;
      if (n1 !== n0) { this.render(); this.legendLast(); return; }
      try { this.main.update(this.point(this.disp[n1 - 1], n1 > 1 ? this.disp[n1 - 2] : null)); } catch (e) { this.render(); }
      this.renderInds(false, false); this.legendLast();
      return;
    }
    if (this.cfg.type === 'heikin') {
      var bars = this.bars, n = bars.length, D = this.disp;
      if (isNew || D.length !== n) this.disp = I.heikin(bars);
      else { var po = n > 1 ? D[n - 2] : null, b = bars[n - 1], c = (b.o + b.h + b.l + b.c) / 4, o = po ? (po.o + po.c) / 2 : (b.o + b.c) / 2; D[n - 1] = { t: b.t, o: o, h: Math.max(b.h, o, c), l: Math.min(b.l, o, c), c: c, v: b.v }; }
    } else this.disp = this.bars;
    var L = this.disp.length; if (!L) return;
    this.main.update(this.point(this.disp[L - 1], L > 1 ? this.disp[L - 2] : null));
    this.renderInds(false, isNew);
    if (isNew) { this.applyPrec(); this.drawer && this.drawer.update(); }
    this.legendLast();
  };

  /* ---- indicators */
  Cell.prototype.clearInds = function () {
    var ch = this.chart;
    Object.keys(this.series).forEach(function (u) { (this.series[u].list || []).forEach(function (s) { try { ch.removeSeries(s); } catch (e) { } }); if (this.series[u].band) { try { this.series[u].band.detach(); } catch (e) { } } }, this);
    this.series = {};
    var ps = ch.panes(); for (var k = ps.length - 1; k >= 1; k--) { try { ch.removePane(k); } catch (e) { } }
  };
  Cell.prototype.buildInds = function () {
    this.clearInds();
    var ch = this.chart, self = this, pane = 0;
    this.cfg.inds.forEach(function (x) {
      var D = I.DEF[x.id]; if (!D || x.off) return;
      var pi = D.pane === true ? ++pane : 0, list = [], keys = [];
      D.plots.forEach(function (pl) {
        var key = pl[0], kind = pl[1], col = pl[2], s;
        var base = { priceLineVisible: false, lastValueVisible: pi > 0 && kind !== 'dots', crosshairMarkerVisible: false, title: '' };
        if (D.pane === 'vol') { base.priceScaleId = 'v_' + x.u; base.lastValueVisible = false; }
        if (kind === 'hist') s = ch.addSeries(LW.HistogramSeries, Object.assign(base, { color: 'rgba(148,163,184,.5)', priceFormat: x.id === 'vol' ? { type: 'volume' } : { type: 'price', precision: 2, minMove: 0.01 } }), pi);
        else s = ch.addSeries(LW.LineSeries, Object.assign(base, { color: col, lineWidth: kind === 'dots' ? 1 : 1.5, lineVisible: kind !== 'dots', lineType: kind === 'step' ? 1 : 0, pointMarkersVisible: kind === 'dots', pointMarkersRadius: kind === 'dots' && x.id === 'fract' ? 2.6 : 1.6 }), pi);
        if (D.pane === 'vol') s.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
        list.push(s); keys.push(key);
      });
      if (D.levels && list[0]) D.levels.forEach(function (lv) { list[0].createPriceLine({ price: lv, color: 'rgba(255,255,255,.22)', lineWidth: 1, lineStyle: 2, axisLabelVisible: false }); });
      if (D.range && pi) list[0].applyOptions({ autoscaleInfoProvider: function () { return { priceRange: { minValue: D.range[0], maxValue: D.range[1] } }; } });
      /* pane values: volume-like ones abbreviated (1.2K), price-unit ones with the symbol's decimals, the rest with 2 */
      if (pi && D.fmt === 'vol') list.forEach(function (s) { s.applyOptions({ priceFormat: { type: 'volume' } }); });
      else if (pi && D.fmt === 'price') list.forEach(function (s) { s.applyOptions({ priceFormat: { type: 'price', precision: self.prec(), minMove: Math.pow(10, -self.prec()) } }); });
      else if (pi) list.forEach(function (s) { s.applyOptions({ priceFormat: { type: 'price', precision: 2, minMove: 0.01 } }); });
      if (x.id !== 'vol' && pi === 0 && D.pane !== 'vol') list.forEach(function (s) { s.applyOptions({ priceFormat: { type: 'price', precision: self.prec(), minMove: Math.pow(10, -self.prec()) } }); });
      var rec = { list: list, keys: keys, def: D, x: x, pane: pi };
      if (D.band || D.cloud) { rec.band = new Band(self, rec); list[0].attachPrimitive(rec.band.prim); }
      self.series[x.u] = rec;
    });
    var ps = ch.panes();
    try { ps[0].setStretchFactor(ps.length > 2 ? 2.4 : 3); for (var k = 1; k < ps.length; k++) ps[k].setStretchFactor(1); } catch (e) { }
    this.indSig = this.cfg.inds.map(function (x) { return x.id + JSON.stringify(x.p) + (x.off ? 0 : 1); }).join('|') + this.cfg.type;
  };
  Cell.prototype.indValues = function (x, bars) {
    if (!bars.length) return {};
    var src = this.cfg.type === 'heikin' && x.id !== 'vol' ? this.disp : bars;
    return I.compute(x.id, src, x.p);
  };
  Cell.prototype.renderInds = function (full, isNew) {
    var sig = this.cfg.inds.map(function (x) { return x.id + JSON.stringify(x.p) + (x.off ? 0 : 1); }).join('|') + this.cfg.type;
    if (sig !== this.indSig) { this.buildInds(); full = true; }
    var self = this, bars = this.xform() ? this.disp : this.replay ? this.bars.slice(0, this.replay.i + 1) : this.bars, D = this.disp, n = bars.length, sec = this.tfSec();
    if (!n) return;
    this.lastVals = {};
    Object.keys(this.series).forEach(function (u) {
      var rec = self.series[u], x = rec.x, v = self.indValues(x, bars), id = x.id;
      self.lastVals[u] = v;
      rec.keys.forEach(function (key, j) {
        var s = rec.list[j], arr = v[key]; if (!arr) return;
        var shift = 0;
        if (id === 'ichi') { var dsp = (x.p.disp || 26) - 1; if (key === 'spanA' || key === 'spanB') shift = dsp; if (key === 'lag') shift = -dsp; }
        if (rec.def.shift && rec.def.shift[key]) shift = +x.p[rec.def.shift[key]] || 0;      /* e.g. the Alligator's lines are drawn ahead */
        var color = null;
        if (rec.def.plots[j][1] === 'hist') color = function (i) {
          if (id === 'vol') { var b = D[i] || bars[i]; return b && b.c >= b.o ? 'rgba(52,211,153,.42)' : 'rgba(255,90,77,.42)'; }
          var val = arr[i], pv = arr[i - 1]; return val >= 0 ? (pv != null && val < pv ? 'rgba(52,211,153,.45)' : 'rgba(52,211,153,.85)') : (pv != null && val > pv ? 'rgba(255,90,77,.45)' : 'rgba(255,90,77,.85)');
        };
        if (rec.def.breaks) color = function (i) { var a = arr[i], b = arr[i + 1]; return I.ok(a) && I.ok(b) && a !== b ? 'rgba(0,0,0,0)' : null; };   /* LW colours a segment by its first point */
        function tAt(i) { var k = i + shift; if (k < n) return k >= 0 ? bars[k].t : null; return bars[n - 1].t + (k - n + 1) * sec; }
        function pt(i) { var tt = tAt(i), val = arr[i]; if (tt == null) return null; if (!I.ok(val)) return { time: tt }; var o = { time: tt, value: val }; if (color) { var cl = color(i); if (cl) o.color = cl; } return o; }
        if (full || shift || isNew) {
          var out = [], seen = {};
          for (var i = 0; i < n; i++) { var q = pt(i); if (q && !seen[q.time]) { seen[q.time] = 1; out.push(q); } }
          s.setData(out);
        } else { var q2 = pt(n - 1); if (q2 && q2.value != null) { try { s.update(q2); } catch (e) { } } }
      });
      if (rec.band) rec.band.vals = v;
    });
    if (this.legInds) this.legendInds();
  };

  /* ---- Entekhab layers: channel posts and indicator signals as markers; the live analysis box in the legend */
  Cell.prototype.layers = function () {
    var self = this, want = this.cfg.inds.filter(function (x) { return LAYERS[x.id] && !x.off; }).map(function (x) { return x.id; });
    this.layerSet = {};
    want.forEach(function (id) { layerData(id).then(function (j) { self.layerSet[id] = j; self.marks(); self.legend(); }); });
    if (!want.length) this.marks();
  };
  Cell.prototype.marks = function () {
    if (!this.mk) return;
    var self = this, L = this.layerSet || {}, out = [], bars = this.disp, n = bars.length, sym = this.cfg.sym, on = {};
    this.cfg.inds.forEach(function (x) { if (LAYERS[x.id] && !x.off) on[x.id] = 1; });
    if (!n) { this.mk.setMarkers([]); return; }
    function barT(t) { if (t < bars[0].t || t > bars[n - 1].t + self.tfSec()) return null; var lg = Math.floor(P.t2l(bars, t, self.tfSec())); return bars[Math.max(0, Math.min(n - 1, lg))].t; }
    this.markInfo = {};
    if (on.posts && L.posts) Object.keys(L.posts).forEach(function (id) {
      var r = L.posts[id]; if (!r || r.coin !== sym || !r.t0) return;
      var bt = barT(Math.floor(r.t0 / 1000)); if (bt == null) return;
      out.push({ time: bt, position: 'aboveBar', color: '#f7931a', shape: 'circle', size: 0.8, id: 'p' + id });
      self.markInfo['p' + id] = { kind: 'post', id: id, r: r };
    });
    if (on.sigs && L.sigs && L.sigs.signals) L.sigs.signals.forEach(function (sg) {
      if (sg.sym !== sym + 'USDT') return;
      var bt = barT(Math.floor(Date.parse(sg.t) / 1000)); if (bt == null) return;
      var up = sg.side === 'long', dn = sg.side === 'short';
      out.push({ time: bt, position: dn ? 'aboveBar' : 'belowBar', color: up ? '#34d399' : dn ? '#ff5a4d' : '#a78bfa', shape: up ? 'arrowUp' : dn ? 'arrowDown' : 'square', size: 1, id: 's' + sg.id });
      self.markInfo['s' + sg.id] = { kind: 'sig', s: sg };
    });
    if (on.news && L.news && Array.isArray(L.news.items)) {                       /* headlines about this coin at the moment they were published */
      var nb = newsBase(sym), byBar = {};
      L.news.items.forEach(function (it) {
        if (!it || !Array.isArray(it.coins) || it.coins.indexOf(nb) < 0) return;
        var bt = barT(Math.floor(Date.parse(it.date) / 1000)); if (bt == null) return;
        (byBar[bt] = byBar[bt] || []).push(it);
      });
      Object.keys(byBar).forEach(function (k) {
        var its = byBar[k], cat = ['security', 'regulation', 'etf_institutional', 'onchain', 'technical'].filter(function (c) { return its.some(function (x) { return x.category === c; }); })[0] || 'news';
        out.push({ time: +k, position: 'aboveBar', color: NEWSC[cat], shape: 'square', size: 0.7, text: its.length > 1 ? String(its.length) : '', id: 'n' + k });
        self.markInfo['n' + k] = { kind: 'news', items: its };
      });
    }
    this.cfg.inds.forEach(function (x) {                                           /* candlestick patterns found on the bars */
      if (x.off || !I.DEF[x.id] || !I.DEF[x.id].marks) return;
      I.candles(bars, x.id).slice(-400).forEach(function (m) { out.push({ time: bars[m.i].t, position: m.d > 0 ? 'belowBar' : 'aboveBar', color: m.d > 0 ? '#34d399' : m.d < 0 ? '#ff5a4d' : '#9ca3af', shape: m.d > 0 ? 'arrowUp' : m.d < 0 ? 'arrowDown' : 'circle', size: 0.7, text: m.c, id: 'c' + x.id + m.i }); });
    });
    if (this.btMarks) this.btMarks.forEach(function (m) { var bt = barT(m.time); if (bt != null) out.push(Object.assign({}, m, { time: bt })); });
    out.sort(function (a, b) { return a.time - b.time; });
    try { this.mk.setMarkers(out); } catch (e) { }
  };

  /* ---- legend (top-left): symbol, timeframe, source, OHLC of the bar under the cursor, indicator values */
  Cell.prototype.legend = function () {
    var c = this.cfg, F = this.feed, self = this;
    var stc = this.replay ? 'rep' : !F ? 'load' : F.state === 'live' ? 'live' : F.state === 'poll' ? 'poll' : F.state === 'snap' ? 'snap' : F.state === 'error' ? 'err' : 'load';
    var rs = F && F.R && F.R.source ? F.R.source() : '', rsn = rs === 'own' ? T('yourRate') : rs, ref = F && F.R ? ({ ecb: 'ECB', xapi: 'exchange-api' })[F.R.src] || '' : '';
    var src = F && F.src === 'okx' ? 'OKX' : F && F.src === 'site' ? 'entekhab' : F && F.src === 'tgju' ? 'tgju' : F && (F.src === 'irt' || F.src === 'fiat') ? 'Binance × ' + (rsn || '…') : F && F.src === 'fxr' ? ref : F && F.src === 'bybit' ? 'Bybit' : 'Binance';
    var I0 = P.inst(c.sym) || {}, isFut = I0.kind === 'fut', adj = isFut && P.futAdj && P.futAdj(c.sym);
    var stTitle = (F && F.src === 'fxr' && F.state === 'snap' ? T('refDaily') : T('st_' + stc)) + (F && F.state === 'snap' && F.at && F.src !== 'fxr' ? ' · ' + fmtT(Math.floor(F.at / 1000)) : '');
    var leg = $('.pm-leg', this.el);
    leg.innerHTML = '<div class="pm-l1"><button type="button" class="pm-lsym" data-a="sym"><img src="' + esc(P.logo(c.sym)) + '" alt="" width="18" height="18" onerror="this.style.visibility=\'hidden\'"><b>' + esc(P.pair(c.sym)) + '</b></button>' +
      '<button type="button" class="pm-ltf" data-a="tf">' + esc(tfLabel(c.tf)) + '</button>' + (isFut ? '<button type="button" class="pm-badj' + (adj ? ' on' : '') + '" data-a="badj" aria-pressed="' + !!adj + '" title="' + esc(T('badjT')) + '">B-ADJ</button>' : '') + '<span class="pm-src">' + src + '</span><i class="pm-dot ' + stc + '" title="' + esc(stTitle) + '"></i>' +
      (this.replay ? '<span class="pm-repb">' + esc(T('replay')) + '</span>' : '') + '<span class="pm-ohlc"></span><span class="pm-cd"></span></div><div class="pm-linds"></div><div class="pm-live"></div>';
    leg.querySelector('[data-a="sym"]').onclick = function (e) { setActive(self.i); symbolSearch(''); };
    leg.querySelector('[data-a="tf"]').onclick = function (e) { setActive(self.i); tfMenu(e.currentTarget); };
    var bj = leg.querySelector('[data-a="badj"]');
    if (bj) bj.onclick = function () { var on = P.futAdj(c.sym, !P.futAdj(c.sym)); cells.forEach(function (x) { if (x.cfg.sym === c.sym && !x.replay) x.load(); }); toast(T(on ? 'badjOn' : 'badjOff')); };
    this.legInds = $('.pm-linds', leg); this.legendInds(); this.legendLast(); this.liveBox();
  };
  Cell.prototype.legendLast = function (b, prev) {
    var leg = $('.pm-ohlc', this.el); if (!leg) return;
    var D = this.disp, n = D.length; if (!b) { b = D[n - 1]; prev = D[n - 2]; }
    if (!b) { leg.textContent = ''; return; }
    var ch = prev ? (b.c / prev.c - 1) * 100 : 0, cls = b.c >= b.o ? 'up' : 'dn', f = this.fmt.bind(this);
    leg.innerHTML = '<span>O <b class="' + cls + '">' + f(b.o) + '</b></span><span>H <b class="' + cls + '">' + f(b.h) + '</b></span><span>L <b class="' + cls + '">' + f(b.l) + '</b></span><span>C <b class="' + cls + '">' + f(b.c) + '</b></span>' +
      '<span class="' + (ch >= 0 ? 'up' : 'dn') + '">' + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%</span>' + (b.v ? '<span>V <b>' + P.fmtV(b.v) + '</b></span>' : '');
  };
  Cell.prototype.legendInds = function (idx) {
    var box = this.legInds; if (!box) return;
    var self = this, html = '';
    this.cfg.inds.forEach(function (x, j) {
      var D = I.DEF[x.id], rec = self.series[x.u], v = self.lastVals && self.lastVals[x.u];
      var name = indName(x), vals = '';
      if (D && rec && v && !x.off) {
        var n = (self.replay ? self.replay.i + 1 : self.bars.length), i = idx == null ? n - 1 : idx;
        vals = rec.keys.map(function (k, q) { var a = v[k], val = a ? a[i] : null; if (!I.ok(val)) return ''; var col = D.plots[q][2] || '#9ca3af'; return '<b style="color:' + col + '">' + (x.id === 'vol' && k === 'vol' ? P.fmtV(val) : Math.abs(val) >= 1000 || D.pane !== true ? self.fmt(val) : val.toFixed(2)) + '</b>'; }).join(' ');
      }
      html += '<div class="pm-li' + (x.off ? ' off' : '') + '" data-u="' + esc(x.u) + '"><span class="pm-ln">' + esc(name) + '</span> ' + vals +
        '<span class="pm-lact"><button type="button" class="pm-ib" data-a="eye" title="' + esc(T(x.off ? 'show' : 'hide')) + '">' + ic(x.off ? 'eyeoff' : 'eye') + '</button>' +
        (D && Object.keys(D.p).length ? '<button type="button" class="pm-ib" data-a="set" title="' + esc(T('settings')) + '">' + ic('gear') + '</button>' : '') +
        '<button type="button" class="pm-ib" data-a="del" title="' + esc(T('remove')) + '">' + ic('x') + '</button></span></div>';
    });
    box.innerHTML = html;
    $$('.pm-li', box).forEach(function (row) {
      var u = row.getAttribute('data-u'), x = self.cfg.inds.filter(function (z) { return z.u === u; })[0]; if (!x) return;
      $$('button', row).forEach(function (b) {
        b.onclick = function (e) {
          e.stopPropagation(); var a = b.getAttribute('data-a');
          if (a === 'eye') { x.off = !x.off; self.indsChanged(); }
          if (a === 'del') { self.cfg.inds = self.cfg.inds.filter(function (z) { return z.u !== u; }); self.indsChanged(); }
          if (a === 'set') indSettings(self, x);
        };
      });
    });
  };
  Cell.prototype.liveBox = function () {
    var box = $('.pm-live', this.el); if (!box) return;
    var on = this.cfg.inds.some(function (x) { return x.id === 'live' && !x.off; }), L = this.layerSet && this.layerSet.live, sym = this.cfg.sym + 'USDT', tf = this.cfg.tf, out = [];
    if (on && L && L.items) Object.keys(L.items).forEach(function (k) { (L.items[k].states || []).forEach(function (s) { if (s.sym === sym) out.push(s); }); });
    if (!on) { box.innerHTML = ''; return; }
    if (!L) { box.innerHTML = '<div class="pm-lv">' + esc(T('loading')) + '</div>'; return; }
    if (!out.length) { box.innerHTML = '<div class="pm-lv">' + esc(T('liveNone')) + '</div>'; return; }
    out.sort(function (a, b) { return (a.tf === tf ? -1 : 0) - (b.tf === tf ? -1 : 0); });
    box.innerHTML = out.slice(0, 3).map(function (s) {
      var f = s.f || {}, dir = f.dir === 'long' ? 'up' : f.dir === 'short' ? 'dn' : '';
      return '<div class="pm-lv"><b>' + esc(indTitle(s.ind)) + '</b> · ' + esc(s.tf) + ' · <span class="' + dir + '">' + esc(f.decision || f.dir || s.state || '') + '</span>' +
        (f.score != null ? ' · ' + esc(T('score')) + ' ' + esc(f.score) : '') + (f.regime ? ' · ' + esc(f.regime) : '') + ' <small>' + esc(fmtD(Math.floor(Date.parse(s.t) / 1000))) + '</small></div>';
    }).join('');
  };
  function indTitle(slug) { return String(slug || '').replace(/^kurdistani-/, 'Kurdistani ').replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  Cell.prototype.indsChanged = function () { this.renderInds(true); this.layers(); this.legend(); if (this.drawer) this.drawer.update(); if (st.sync.ind) syncInds(this); save(); emit('inds', this); };
  /* «sync indicators»: every chart gets the same indicators, with the same settings, as the one just changed */
  var syncingInds = false;
  function cloneInds(a) { return a.map(function (x) { return { id: x.id, p: JSON.parse(JSON.stringify(x.p || {})), off: x.off ? 1 : undefined, u: P.uid() }; }).map(function (x) { if (!x.off) delete x.off; return x; }); }
  function syncInds(src) {
    if (syncingInds || !src || cells.length < 2) return;
    syncingInds = true;
    try { cells.forEach(function (c) { if (c === src) return; c.cfg.inds = cloneInds(src.cfg.inds); c.renderInds(true); c.layers(); c.legend(); }); } finally { syncingInds = false; }
  }
  Cell.prototype.onCross = function (p) {
    var prog = this._prog && Date.now() - this._prog < 80;
    if (!p || p.time == null || !p.point) { this.legendLast(); if (this.legInds) this.legendInds(); this.tip(null); if (!prog) syncCross(this, null); return; }
    var D = this.disp, t = p.time, i = -1, lo = 0, hi = D.length - 1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (D[m].t === t) { i = m; break; } if (D[m].t < t) lo = m + 1; else hi = m - 1; }
    if (i >= 0) { this.legendLast(D[i], D[i - 1]); this.legendInds(i); }
    if (prog) return;
    syncCross(this, t);
    var hit = this.ovl.hitEvent(p.point.x, p.point.y), mk = p.hoveredObjectId && this.markInfo && this.markInfo[p.hoveredObjectId];
    if (hit) this.tip(evTip(hit), p.point); else if (mk) this.tip(markTip(mk, this), p.point); else this.tip(null);
  };
  Cell.prototype.tip = function (html, pt) {
    var t = $('.pm-tip', this.el); if (!html) { t.hidden = true; return; }
    t.innerHTML = html; t.hidden = false; t.dir = RTL() ? 'rtl' : 'ltr';
    var W = this.el.clientWidth, x = Math.min(W - t.offsetWidth - 6, Math.max(6, pt.x + 14)), y = Math.max(28, pt.y - t.offsetHeight - 12);
    t.style.left = x + 'px'; t.style.top = y + 'px';
  };
  Cell.prototype.onRange = function (r) {
    if (!r || this.replay) return;
    if (r.from < 40 && this.feed && !this.feed.full && !this.feed.busy) this.feed.more();
    if (st.sync.time && !syncing && st.active === this.i) syncTime(this);
    this.ovl.update();
  };
  Cell.prototype.onClick = function (p) {
    if (!p || !p.point) return;
    var hit = this.ovl.hitEvent(p.point.x, p.point.y);
    if (hit) { emit('openEvent', hit); return; }
    var mk = p.hoveredObjectId && this.markInfo && this.markInfo[p.hoveredObjectId];
    if (mk && mk.kind === 'post') window.open('/p/' + encodeURIComponent(mk.id) + '/', '_blank', 'noopener');
    if (mk && mk.kind === 'news') newsBox(mk.items);
    emit('click', this, p);
  };
  Cell.prototype.sizeClass = function () { var w = this.el.clientWidth, hh = this.el.clientHeight; this.el.classList.toggle('pm-small', w < 430 || hh < 300); this.el.classList.toggle('pm-tiny', w < 300 || hh < 200); };
  Cell.prototype.msg = function (m) { var e = $('.pm-msg', this.el); if (!m) { e.hidden = true; return; } e.hidden = false; e.textContent = m; e.dir = RTL() ? 'rtl' : 'ltr'; };
  Cell.prototype.showRange = function (sec) {
    var D = this.disp; if (!D.length) return;
    var to = D[D.length - 1].t, from = sec === 'all' ? D[0].t : sec === 'ytd' ? Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000 : to - sec;
    if (from < D[0].t && sec !== 'all' && this.feed && !this.feed.full) { this.pendingRange = sec; this.feed.more(); }
    this.chart.timeScale().setVisibleRange({ from: Math.max(D[0].t, from), to: to });
  };
  Cell.prototype.destroy = function () {
    if (this.sub) this.sub.off(); if (this.replay && P.replayStop) P.replayStop(this, true);
    if (this.ro) this.ro.disconnect(); if (this.drawer) this.drawer.destroy(); try { this.chart.remove(); } catch (e) { } this.el.remove();
  };
  Cell.prototype.setSym = function (sym) { if (!SYM_RE.test(sym) || !hasLogo(sym) || sym === this.cfg.sym) return; this.cfg.sym = sym; if (this.replay && P.replayStop) P.replayStop(this, true); this.load(); this.drawer.select(null); save(); emit('sym', this); };
  Cell.prototype.setTF = function (tf) { if (!P.parseTF(tf) || tf === this.cfg.tf) return; this.cfg.tf = tf; if (this.replay && P.replayStop) P.replayStop(this, true); this.load(); save(); emit('tf', this); };
  Cell.prototype.setType = function (t) {
    if (TYPES.indexOf(t) < 0 || t === this.cfg.type) return;
    var wasX = this.xform(); this.cfg.type = t; this.boxAuto = null; this.makeMain(); this.render(this.replay ? this.replay.i : null);
    if (wasX || this.xform()) this.refit();             /* the number of items changed: show the latest ones again */
    this.legend(); save();
  };
  Cell.prototype.refit = function () {
    var self = this; this.fit();
    requestAnimationFrame(function () { if (self.replay) { var n = self.disp.length, r = self.chart.timeScale().getVisibleLogicalRange(), w = r ? r.to - r.from : 120; self.chart.timeScale().setVisibleLogicalRange({ from: n - 1 - w * 0.75, to: n - 1 + w * 0.25 }); } else self.fit(); });
  };
  Cell.prototype.setTP = function (tp) { this.cfg.tp = tpSane(tp || {}); this.boxAuto = null; this.render(this.replay ? this.replay.i : null); this.refit(); this.legend(); save(); };

  /* ---- band fills (Bollinger, Donchian, Keltner) and the Ichimoku cloud, painted under the lines */
  function Band(cell, rec) {
    var self = this; this.cell = cell; this.rec = rec; this.vals = null;
    this.prim = { attached: function (p) { self.req = p.requestUpdate; }, detached: function () { }, updateAllViews: function () { },
      paneViews: function () { return [{ zOrder: function () { return 'bottom'; }, renderer: function () { return { draw: function (tg) { tg.useMediaCoordinateSpace(function (s) { self.paint(s.context); }); } }; } }]; } };
    this.detach = function () { try { rec.list[0].detachPrimitive(self.prim); } catch (e) { } };
  }
  Band.prototype.paint = function (ctx) {
    var v = this.vals, rec = this.rec, D = rec.def, cell = this.cell; if (!v) return;
    var ts = cell.chart.timeScale(), s = rec.list[0], n = cell.replay ? cell.replay.i + 1 : cell.bars.length;
    var r = ts.getVisibleLogicalRange(); if (!r || !n) return;
    var A, B, shift = 0;
    if (D.cloud) { A = v.spanA; B = v.spanB; shift = (rec.x.p.disp || 26) - 1; } else { A = v[D.band[0]]; B = v[D.band[1]]; }
    if (!A || !B) return;
    var i0 = Math.max(1, Math.floor(r.from) - shift - 2), i1 = Math.min(n - 1, Math.ceil(r.to) - shift + 2), prev = null;
    var paths = { u: new Path2D(), d: new Path2D() }, used = { u: false, d: false };
    for (var i = i0 - 1; i <= i1; i++) {
      var pt = null;
      if (I.ok(A[i]) && I.ok(B[i])) {
        var x = ts.logicalToCoordinate(i + shift), ya = s.priceToCoordinate(A[i]), yb = s.priceToCoordinate(B[i]);
        if (x != null && ya != null && yb != null) pt = { x: x, a: ya, b: yb, up: A[i] >= B[i] };
      }
      if (pt && prev) {
        var k = !D.cloud || pt.up ? 'u' : 'd', P2 = paths[k];
        P2.moveTo(prev.x, prev.a); P2.lineTo(pt.x, pt.a); P2.lineTo(pt.x, pt.b); P2.lineTo(prev.x, prev.b); P2.closePath(); used[k] = true;
      }
      prev = pt;
    }
    if (used.u) { ctx.fillStyle = D.cloud ? 'rgba(52,211,153,.14)' : D.band[2]; ctx.fill(paths.u); }
    if (used.d) { ctx.fillStyle = 'rgba(255,90,77,.14)'; ctx.fill(paths.d); }
  };

  /* ---- the overlay of a chart: economic events at the bottom, alert lines, the replay cut */
  function Overlay(cell) {
    var self = this; this.cell = cell; this.req = function () { };
    this.prim = { attached: function (p) { self.req = p.requestUpdate; }, detached: function () { }, updateAllViews: function () { },
      paneViews: function () { return [{ zOrder: function () { return 'top'; }, renderer: function () { return { draw: function (tg) { tg.useMediaCoordinateSpace(function (s) { try { self.paint(s.context, s.mediaSize.width, s.mediaSize.height); } catch (e) { } }); } }; } }]; } };
    this.flags = [];
  }
  Overlay.prototype.update = function () { this.req(); };
  Overlay.prototype.paint = function (ctx, W, H) {
    var cell = this.cell, ts = cell.chart.timeScale(), D = cell.disp, sec = cell.tfSec(), self = this;
    this.flags = []; this.H = H;
    /* alert lines */
    (P.alertLines ? P.alertLines(cell.cfg.sym) : []).forEach(function (a) {
      var y = cell.main.priceToCoordinate(a.v); if (y == null || y < 0 || y > H) return;
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(247,147,26,.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.restore();
      ctx.font = '600 11px Vazirmatn, Tahoma, sans-serif'; var txt = '🔔 ' + cell.fmt(a.v), tw = ctx.measureText(txt).width + 10;
      ctx.fillStyle = 'rgba(247,147,26,.92)'; ctx.fillRect(W - tw - 4, y - 9, tw, 18); ctx.fillStyle = '#1a1207'; ctx.textBaseline = 'middle'; ctx.fillText(txt, W - tw + 1, y + 0.5);
    });
    /* replay cut line while choosing the start */
    if (cell.cutX != null) { ctx.save(); ctx.strokeStyle = '#38bdf8'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cell.cutX, 0); ctx.lineTo(cell.cutX, H); ctx.stroke(); ctx.restore(); }
    /* economic events */
    if (!st.ev.on || !P.calEvents || !D.length) return;
    var evs = P.calEvents(), r = ts.getVisibleLogicalRange(); if (!evs || !r) return;
    var t0 = P.l2t(D, r.from - 1, sec), t1 = P.l2t(D, r.to + 1, sec), slots = {}, R = 7;
    evs.forEach(function (e) {
      if (e.t < t0 || e.t > t1 || st.ev.imp.indexOf(e.i) < 0 || (st.ev.cur.length && st.ev.cur.indexOf(e.c) < 0)) return;
      var lg = P.t2l(D, e.t, sec), x = ts.logicalToCoordinate(Math.floor(lg + 1e-9) + (lg > D.length - 1 ? lg - Math.floor(lg) : 0));
      if (x == null || x < -R || x > W + R) return;
      var key = Math.round(x / (R * 2)), k = slots[key] = (slots[key] || 0) + 1; if (k > 3) return;
      var y = H - R - 3 - (k - 1) * (R * 2 + 2);
      P.flag(ctx, x, y, R, e.c, e.i);
      self.flags.push({ x: x, y: y, r: R, e: e });
    });
  };
  Overlay.prototype.hitEvent = function (x, y) {
    for (var i = this.flags.length - 1; i >= 0; i--) { var f = this.flags[i]; if (Math.hypot(x - f.x, y - f.y) <= f.r + 3) return f.e; }
    return null;
  };
  function evTip(e) { return P.evTipHtml ? P.evTipHtml(e) : ''; }
  function markTip(m, cell) {
    if (m.kind === 'news') {
      return m.items.slice(0, 4).map(function (it) { return '<b>' + esc(newsTitle(it)) + '</b><br><small>' + esc(it.source || '') + ' · ' + esc(fmtD(Math.floor(Date.parse(it.date) / 1000))) + '</small>'; }).join('<br>') +
        (m.items.length > 4 ? '<br><small>+' + loc(m.items.length - 4) + '</small>' : '') + '<br><small>' + esc(T('clickNews')) + '</small>';
    }
    if (m.kind === 'post') {
      var r = m.r, f = function (v) { return v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; };
      return '<b>' + esc(T('postBy')) + '</b><br>' + esc(fmtD(Math.floor(r.t0 / 1000))) + ' · ' + esc(cell.fmt(r.p0)) + '<br>' + esc(T('after')) + ' 1h ' + f(r.r1h) + ' · 4h ' + f(r.r4h) + ' · 24h ' + f(r.r24h) + '<br><small>' + esc(T('clickPost')) + '</small>';
    }
    var s = m.s, o = s.out || {}, rr = o.r || {};
    return '<b>' + esc(indTitle(s.ind)) + '</b> · ' + esc(s.tf) + '<br>' + esc(s.state || s.side) + (s.prev ? ' ← ' + esc(s.prev) : '') + ' · ' + esc(cell.fmt(s.price)) + '<br>' +
      Object.keys(rr).map(function (k) { return k + ' ' + (rr[k] >= 0 ? '+' : '') + rr[k] + '%'; }).join(' · ');
  }

  function newsBox(items) {                                         /* the headlines of one bar, each with its source */
    var f = h('<div class="pm-newsl"></div>');
    items.forEach(function (it) {
      var r = h('<a class="pm-newsi" target="_blank" rel="noopener nofollow"><b></b><small></small></a>');
      if (/^https?:\/\//.test(it.url || '')) r.href = it.url;
      $('b', r).textContent = newsTitle(it); $('small', r).textContent = (it.source || '') + ' · ' + fmtD(Math.floor(Date.parse(it.date) / 1000)) + ' · ' + T('nc_' + (NEWSC[it.category] ? it.category : 'news'));
      f.appendChild(r);
    });
    modal(T('newsTitle'), f);
  }

  /* ================================================================ sync between charts */
  var syncing = false;
  function syncCross(src, t) {
    if (!st.sync.cross || cells.length < 2 || syncing) return;
    syncing = true;
    cells.forEach(function (c) {
      if (c === src) return;
      c._prog = Date.now();
      try {
        if (t == null || !c.disp.length) { c.chart.clearCrosshairPosition(); return; }
        var D = c.disp, lg = Math.floor(P.t2l(D, t, c.tfSec())); if (lg < 0 || lg > D.length - 1) { c.chart.clearCrosshairPosition(); return; }
        c.chart.setCrosshairPosition(D[lg].c, D[lg].t, c.main);
      } catch (e) { }
    });
    syncing = false;
  }
  function syncTime(src) {
    var r = src.chart.timeScale().getVisibleRange(); if (!r) return;
    syncing = true;
    cells.forEach(function (c) { if (c !== src && c.disp.length) { try { c.chart.timeScale().setVisibleRange(r); } catch (e) { } } });
    syncing = false;
  }

  /* ================================================================ drawings: changes, undo/redo, text */
  var undo = [], redo = [], curTool = null, lastStyle = null;
  function drawSnap(sym) { return { sym: sym, list: JSON.parse(JSON.stringify(DRAW[sym] || [])) }; }
  function drawChanged(sym, why, before, dd) {
    if (why === 'add') { undo.push(drawSnap(sym)); (DRAW[sym] = DRAW[sym] || []).push(dd); }
    else if (why === 'move') { var snap = drawSnap(sym); snap.list = snap.list.map(function (x) { return x.id === dd.id ? Object.assign({}, x, { pts: before }) : x; }); undo.push(snap); }
    else undo.push(drawSnap(sym));
    if (undo.length > 80) undo.shift(); redo = [];
    afterDraw(sym);
  }
  function afterDraw(sym) {
    if (DRAW[sym] && !DRAW[sym].length) delete DRAW[sym];
    cells.forEach(function (c) { if (c.cfg.sym === sym) c.drawer.update(); });
    save(); emit('draws', sym); paintUndo();
  }
  function mutate(sym, f) { undo.push(drawSnap(sym)); redo = []; f(DRAW[sym] = DRAW[sym] || []); afterDraw(sym); }
  function doUndo() { var s = undo.pop(); if (!s) return; redo.push(drawSnap(s.sym)); DRAW[s.sym] = s.list; afterDraw(s.sym); }
  function doRedo() { var s = redo.pop(); if (!s) return; undo.push(drawSnap(s.sym)); DRAW[s.sym] = s.list; afterDraw(s.sym); }
  function paintUndo() { var u = $('#pm-undo'), r = $('#pm-redo'); if (u) u.disabled = !undo.length; if (r) r.disabled = !redo.length; }
  function editText(dd) {
    var sym = active().cfg.sym;
    ask(T('editText'), (dd.s && dd.s.x) || '', function (v) { mutate(sym, function (L) { L.forEach(function (x) { if (x.id === dd.id) { x.s = x.s || {}; x.s.x = v.slice(0, 120); } }); }); }, T('textPh'));
  }

  /* ================================================================ the workspace */
  var root, grid, wired = false;
  function active() { return cells[st.active] || cells[0]; }
  function setActive(i) {
    if (i === st.active && cells[i] && cells[i].el.classList.contains('on')) return;
    var prev = active(); if (prev && prev.drawer) { prev.drawer.setTool(null); }
    st.active = Math.max(0, Math.min(cells.length - 1, i));
    cells.forEach(function (c) { c.el.classList.toggle('on', c.i === st.active); });
    var a = active(); if (a && curTool) a.drawer.setTool(curTool);
    paintTop(); save(); emit('active', a);
  }
  function buildGrid() {
    var n = LAYOUTS[st.layout] || 1;
    while (st.charts.length < n) {
      var used = st.charts.map(function (c) { return c.sym; }), sym = ROT.filter(function (s) { return used.indexOf(s) < 0; })[0] || 'BTC';
      var base = st.charts[0], nc = newChart(st.sync.sym ? base.sym : sym); nc.tf = base.tf; nc.type = base.type; if (st.sync.ind) nc.inds = cloneInds(base.inds);
      st.charts.push(nc);
    }
    cells.forEach(function (c) { c.destroy(); }); cells = [];
    grid.setAttribute('data-l', st.layout);
    for (var i = 0; i < n; i++) { var c = new Cell(i); cells.push(c); grid.appendChild(c.el); }
    if (st.active >= n) st.active = 0;
    cells.forEach(function (c) { c.el.classList.toggle('on', c.i === st.active); });
    grid.classList.toggle('multi', n > 1);
    paintTop(); emit('grid');
  }
  function setLayout(l) { if (!LAYOUTS[l]) return; st.layout = l; buildGrid(); save(); }

  /* ---- top toolbar */
  function tfLabel(tf) { var m = /^(\d+)([smhdwM])$/.exec(tf); if (!m) return tf; return m[1] + T('u_' + (m[2] === 'M' ? 'mo' : m[2])); }
  function typeLabel(t) { return T('ty_' + t); }
  function indName(x) {
    if (LAYERS[x.id]) return T('ly_' + x.id);
    var D = I.DEF[x.id], p = x.p || {}, ps = Object.keys(D ? D.p : {}).map(function (k) { return p[k]; }).filter(function (v) { return v != null; });
    return T('in_' + x.id) + (ps.length && x.id !== 'vol' ? ' (' + ps.join(', ') + ')' : '');
  }
  function paintTop() {
    var a = active(); if (!a || !root) return;
    var c = a.cfg, sb = $('#pm-sym'), tb = $('#pm-tfs'), ty = $('#pm-type');
    if (sb) { var In = P.inst(c.sym) || {}; sb.innerHTML = '<img src="' + esc(P.logo(c.sym)) + '" alt="" width="20" height="20" onerror="this.style.visibility=\'hidden\'"><b>' + esc(In.kind === 'ir' || In.kind === 'fut' ? P.pair(c.sym) : In.base || c.sym) + '</b><small>' + (In.kind === 'ir' ? '' : '/' + esc(In.quote === 'IRT' ? T('toman') : In.quote || 'USDT')) + '</small>' + ic('search', 'sm'); }
    if (tb) {
      var favs = st.fav.slice(); if (favs.indexOf(c.tf) < 0) favs.push(c.tf);
      tb.innerHTML = favs.map(function (tf) { return '<button type="button" class="pm-tf' + (tf === c.tf ? ' on' : '') + '" data-tf="' + tf + '">' + esc(tfLabel(tf)) + '</button>'; }).join('') +
        '<button type="button" class="pm-ib" id="pm-tfmore" aria-label="' + esc(T('moreTf')) + '" title="' + esc(T('moreTf')) + '">' + ic('chev') + '</button>';
      /* phones show only the active timeframe: tapping it opens the full list */
      $$('[data-tf]', tb).forEach(function (b) { b.onclick = function () { if (b.classList.contains('on') && matchMedia('(max-width:899px)').matches) { tfMenu(b); return; } applyTF(b.getAttribute('data-tf')); }; });
      $('#pm-tfmore').onclick = function (e) { tfMenu(e.currentTarget); };
    }
    if (ty) ty.innerHTML = ic('candle') + '<span>' + esc(typeLabel(c.type)) + '</span>';
    var lay = $('#pm-lay'); if (lay) lay.setAttribute('data-n', LAYOUTS[st.layout]);
    var sc = $('#pm-scale'); if (sc) { $$('button', sc).forEach(function (b) { var k = b.getAttribute('data-s'); b.classList.toggle('on', k === 'auto' ? !!c.scale.auto : k === 'log' ? c.scale.mode === 1 : c.scale.mode === 2); }); }
    var nm = $('#pm-name'); if (nm) nm.textContent = st.name || T('draft');
    paintUndo();
  }
  function applySym(sym) { if (st.sync.sym) cells.forEach(function (c) { c.setSym(sym); }); else active().setSym(sym); paintTop(); }
  function applyTF(tf) { if (!P.parseTF(tf)) { toast(T('badTf')); return; } if (st.sync.tf) cells.forEach(function (c) { c.setTF(tf); }); else active().setTF(tf); paintTop(); }
  function tfMenu(anchor) {
    var a = active(), items = [];
    ['s', 'm', 'h', 'd'].forEach(function (g) {
      items.push({ head: T('tfg_' + g) });
      var row = h('<div class="pm-tfrow"></div>');
      TFS[g].forEach(function (tf) {
        var b = h('<button type="button" class="pm-tf' + (tf === a.cfg.tf ? ' on' : '') + '"></button>'); b.textContent = tfLabel(tf);
        var fav = st.fav.indexOf(tf) >= 0, star = h('<i class="pm-fav' + (fav ? ' on' : '') + '" title="' + esc(T('favTf')) + '">★</i>');
        star.onclick = function (e) { e.stopPropagation(); var k = st.fav.indexOf(tf); if (k >= 0) st.fav.splice(k, 1); else st.fav.push(tf); st.fav.sort(function (x, y) { return P.parseTF(x).sec - P.parseTF(y).sec; }); star.classList.toggle('on'); paintTop(); save(); };
        b.appendChild(star); b.onclick = function () { closeMenu(); applyTF(tf); }; row.appendChild(b);
      });
      items.push({ html: row });
    });
    var f = h('<form class="pm-tfc"><input class="pm-in" maxlength="4" placeholder="7s · 45m · 3h · 2d" aria-label=""><button class="pm-btn pri" type="submit">' + esc(T('ok')) + '</button></form>');
    $('input', f).setAttribute('aria-label', T('customTf'));
    f.onsubmit = function (e) { e.preventDefault(); var v = $('input', f).value.trim().replace(/\s+/g, ''); if (/^\d+[SHDW]$/.test(v)) v = v.toLowerCase(); if (!P.parseTF(v)) { toast(T('badTf')); return; } closeMenu(); applyTF(v); };
    items.push({ head: T('customTf') }, { html: f });
    var m = menu(anchor, items); m.classList.add('pm-tfmenu');
  }
  function typeMenu(anchor) {
    var a = active(), items = [];
    TYPES.forEach(function (t) {
      if (t === 'renko') items.push({ head: T('ty_price') });
      items.push({ label: typeLabel(t), on: a.cfg.type === t, act: function () { if (st.sync.tf) cells.forEach(function (c) { c.setType(t); }); else a.setType(t); paintTop(); } });
    });
    if (a.xform()) items.push({ sep: 1 }, { label: T('tyOpts'), icon: 'gear', act: function () { typeSettings(a); } });
    var m = menu(anchor, items); m.classList.add('pm-tymenu');
  }
  function typeSettings(cell) {
    var t = cell.cfg.type, tp = cell.cfg.tp || {}, f = h('<form class="pm-iset"></form>');
    function row(k, val, ph) { var r = h('<label class="pm-field"><span></span><input class="pm-in" type="number" step="any" min="0" inputmode="decimal"></label>'); $('span', r).textContent = T('tp_' + k); var i = $('input', r); i.name = k; i.value = val || ''; if (ph) i.placeholder = ph; f.appendChild(r); }
    if (t === 'lbreak') row('lines', tp.lines || 3);
    else { row(t === 'kagi' ? 'rev' : 'box', tp.box || '', T('tpAuto', { v: cell.fmt(cell.boxAuto || I.autoBox(cell.bars)) })); if (t === 'pnf') row('boxes', tp.rev || 3); }
    var note = { lbreak: 'tpLinesNote' }[t] || 'tpBoxNote';
    f.appendChild(h('<p class="pm-note"></p>')); $('.pm-note', f).textContent = T(note);
    f.appendChild(h('<div class="pm-row"><button class="pm-btn pri" type="submit">' + esc(T('apply')) + '</button><button class="pm-btn" type="button" data-r>' + esc(T('reset')) + '</button></div>'));
    f.onsubmit = function (e) {
      e.preventDefault(); var o = {};
      $$('input', f).forEach(function (i) { var v = +i.value; if (i.name === 'lines') o.lines = v; else if (i.name === 'boxes') o.rev = v; else o.box = v; });
      closeModal(); (st.sync.tf ? cells.filter(function (c) { return c.cfg.type === t; }) : [cell]).forEach(function (c) { c.setTP(o); });
    };
    $('[data-r]', f).onclick = function () { closeModal(); cell.setTP({}); };
    modal(typeLabel(t), f);
  }
  function layoutMenu(anchor) {
    var small = innerWidth < 760, row = h('<div class="pm-lays"></div>');
    Object.keys(LAYOUTS).forEach(function (l) {
      if (small && LAYOUTS[l] > 4) return;
      var b = h('<button type="button" class="pm-layb' + (st.layout === l ? ' on' : '') + '" data-l="' + l + '" title="' + LAYOUTS[l] + '"><i></i></button>');
      var n = LAYOUTS[l]; $('i', b).innerHTML = new Array(n + 1).join('<s></s>');
      b.onclick = function () { closeMenu(); setLayout(l); }; row.appendChild(b);
    });
    var items = [{ head: T('layout') }, { html: row }, { head: T('sync') }];
    ['sym', 'tf', 'cross', 'time', 'ind'].forEach(function (k) { items.push({ label: T('sync_' + k), on: st.sync[k], stay: true, act: function (b) { st.sync[k] = !st.sync[k]; b.classList.toggle('on', st.sync[k]); if (k === 'ind' && st.sync.ind) syncInds(active()); if (k === 'sym' && st.sync.sym) { var s = active().cfg.sym; cells.forEach(function (c) { c.setSym(s); }); } if (k === 'tf' && st.sync.tf) { var t = active().cfg.tf; cells.forEach(function (c) { c.setTF(t); }); } save(); } }); });
    menu(anchor, items);
  }

  /* ---- symbol search */
  function symbolSearch(q) {
    var box = h('<div class="pm-ss"><div class="pm-ssh"><input class="pm-in" type="search" autocomplete="off" spellcheck="false"></div><div class="pm-sscat"></div><div class="pm-ssl" role="listbox"></div><p class="pm-note pm-ssn"></p></div>');
    var inp = $('input', box), list = $('.pm-ssl', box), cats = $('.pm-sscat', box), note = $('.pm-ssn', box), cat = 'all', M = null, sel = 0;
    inp.placeholder = T('searchSym'); inp.value = q || '';
    /* markets: every Binance coin in USDT and in the visitor's currency; Iran's toman markets (currencies, gold, coins,
       silver, every coin in toman) where the toman is the currency or the reader is Persian or Kurdish */
    var Q = P.fx ? P.fx.cur() : 'IRT', LOCAL = Q !== 'IRT' && Q !== 'USD', IRC = Q === 'IRT' || LANG === 'fa' || LANG === 'ckb';
    ['all', 'watch', 'usdt'].concat(LOCAL ? ['loc'] : [], IRC ? ['irt', 'fx'] : [], ['gold', 'fut']).forEach(function (k) { var b = h('<button type="button" class="pm-chip' + (k === 'all' ? ' on' : '') + '"></button>'); b.textContent = k === 'loc' ? T('cat_loc', { c: Q }) : T('cat_' + k); b.onclick = function () { cat = k; $$('.pm-chip', cats).forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); }; cats.appendChild(b); });
    function names(x) { var I = P.inst(x); return I && I.name ? [I.name.fa, I.name.ckb, I.name.ar, I.name.en].join(' ').toLowerCase() : ''; }
    function draw() {
      var raw = inp.value.trim(), s = raw.toUpperCase().replace(/[^A-Z0-9]/g, ''), low = raw.toLowerCase(), W = (P.watchSyms ? P.watchSyms() : []);
      var loc = (M && M.loc) || [], goldC = function (x) { return /^(XAUT|PAXG)(_|$)/.test(x); };
      var src = !M ? [] : cat === 'watch' ? W : cat === 'usdt' ? M.usdt : cat === 'loc' ? loc : cat === 'irt' ? M.irt : cat === 'fut' ? (M.fut || []) : cat === 'fx' ? M.ir.filter(function (x) { return P.irGroup(x) === 'fx'; }) :
        cat === 'gold' ? (IRC ? M.ir.filter(function (x) { return /gold|coin|silver/.test(P.irGroup(x)); }) : []).concat(M.usdt.filter(goldC), loc.filter(goldC)) :
        (IRC ? M.ir : []).concat(M.usdt, loc, IRC ? M.irt : [], M.fut || []);
      var r = src.filter(function (x) { return !raw || (s && x.indexOf(s) >= 0) || (low && names(x).indexOf(low) >= 0) || (low && P.pair(x).toLowerCase().indexOf(low) >= 0); });
      r.sort(function (a, b) { return (s && a.indexOf(s) === 0 ? 0 : 1) - (s && b.indexOf(s) === 0 ? 0 : 1); });
      r = r.slice(0, 120); sel = 0;
      list.innerHTML = r.length ? r.map(function (x, i) {
        var tk = P.tickers.d[x], I = P.inst(x) || {}, sub = I.kind === 'ir' ? (I.quote === 'USD' ? 'USD · tgju' : T('toman') + ' · tgju') : I.kind === 'irt' || I.kind === 'fiat' ? T('computed') : I.kind === 'fxr' ? T('refRate') : I.kind === 'fut' ? T('futSub') + ' · Bybit' : 'Binance';
        return '<button type="button" role="option" class="pm-ssi' + (i === 0 ? ' on' : '') + '" data-s="' + x + '"><img src="' + esc(P.logo(x)) + '" alt="" width="22" height="22" loading="lazy"><b>' + esc(P.pair(x)) + '</b><small>' + esc(sub) + '</small>' +
          (tk ? '<span class="pm-num">' + P.fmt(tk.c, P.precFor(x, tk.c)) + '</span><span class="pm-num ' + (tk.chg >= 0 ? 'up' : 'dn') + '">' + (tk.chg >= 0 ? '+' : '') + (tk.chg || 0).toFixed(2) + '%</span>' : '') + '</button>';
      }).join('') : '<p class="pm-empty">' + esc(M ? T('noMatch') : T('loading')) + '</p>';
      note.textContent = cat === 'loc' ? T('locNote', { c: Q }) : cat === 'irt' ? T('irtNote') : cat === 'fx' || (cat === 'gold' && IRC) ? T('irNote') : cat === 'fut' ? T('futNote') : '';
      $$('[data-s]', list).forEach(function (b) { b.onclick = function () { closeModal(); applySym(b.getAttribute('data-s')); }; });
    }
    inp.oninput = draw;
    inp.onkeydown = function (e) {
      var it = $$('[data-s]', list); if (!it.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); it[sel].classList.remove('on'); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + it.length) % it.length; it[sel].classList.add('on'); it[sel].scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'Enter') { e.preventDefault(); closeModal(); applySym(it[sel].getAttribute('data-s')); }
    };
    modal(T('symbol'), box);
    (P.markets ? P.markets() : P.universe().then(function (u) { return { usdt: u, irt: [], ir: [] }; })).then(function (m) { M = m; draw(); }); draw();
    setTimeout(function () { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 40);
  }

  /* ---- indicators dialog */
  var CKTV = [['ksc', 'DRuCJ6Bk-Kurdistani-Style-Cycle'], ['kspiral', 'tECCygHQ-Kurdistani-Bitcoin-Spiral-Historical-Logarithmic-Visualization'], ['kmacro', 'IUgkPeGI-Kurdistani-Macro-Regime']];
  function indDialog() {
    var a = active(), box = h('<div class="pm-id"><div class="pm-idhead"><input class="pm-in" type="search" autocomplete="off"><div class="pm-idm" role="tablist"></div><div class="pm-idt"></div></div><div class="pm-idl"></div><h4 class="pm-h4"></h4><div class="pm-ida"></div><div class="pm-tplrow"></div></div>');
    var inp = $('input', box), mains = $('.pm-idm', box), tabs = $('.pm-idt', box), list = $('.pm-idl', box), act = $('.pm-ida', box), main = 'ind', tab = 'over';
    inp.placeholder = T('searchInd'); $('.pm-h4', box).textContent = T('activeInds');
    /* TradingView's five kinds; the indicators have their own shelf of groups below */
    [['ind', 'indicators'], ['strat', 'mt_strat'], ['prof', 'mt_prof'], ['pat', 'mt_pat']].forEach(function (p) { var b = h('<button type="button" role="tab" class="pm-mtab' + (p[0] === main ? ' on' : '') + '"></button>'); b.textContent = T(p[1]); b.onclick = function () { main = p[0]; $$('.pm-mtab', mains).forEach(function (x) { x.classList.toggle('on', x === b); }); tabs.style.display = main === 'ind' ? '' : 'none'; draw(); }; mains.appendChild(b); });
    [['over', 'cat_over'], ['pane', 'cat_pane'], ['com', 'cat_com'], ['ck', 'cat_ck'], ['ek', 'cat_ek']].forEach(function (p) { var b = h('<button type="button" class="pm-chip' + (p[0] === tab ? ' on' : '') + '"></button>'); b.textContent = T(p[1]); b.onclick = function () { tab = p[0]; $$('.pm-chip', tabs).forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); }; tabs.appendChild(b); });
    var SIDS = Object.keys(P.btStrats || {}).filter(function (k) { return !P.btStrats[k].btc || a.cfg.sym === 'BTC'; });
    function draw() {
      var q = inp.value.trim().toLowerCase(), all = I.ORDER_OVER.concat(I.ORDER_PANE, I.ORDER_COM, I.ORDER_CK, I.ORDER_PROF, I.ORDER_PAT, Object.keys(LAYERS));
      var ids = q ? all : main === 'prof' ? I.ORDER_PROF : main === 'pat' ? I.ORDER_PAT : main === 'strat' ? [] : tab === 'over' ? I.ORDER_OVER : tab === 'pane' ? I.ORDER_PANE : tab === 'com' ? I.ORDER_COM : tab === 'ck' ? I.ORDER_CK : Object.keys(LAYERS);
      ids = ids.filter(function (id) { var nm = (LAYERS[id] ? T('ly_' + id) : T('in_' + id)) + ' ' + id + ' ' + T('ind_' + id); return !q || nm.toLowerCase().indexOf(q) >= 0; });
      var sids = (q || main === 'strat') ? SIDS.filter(function (id) { return !q || (T('sg_' + id) + ' ' + id).toLowerCase().indexOf(q) >= 0; }) : [];
      list.innerHTML = ids.map(function (id) { return '<button type="button" class="pm-idi" data-id="' + id + '"><b>' + esc(LAYERS[id] ? T('ly_' + id) : T('in_' + id)) + '</b><small>' + esc(T('ind_' + id)) + '</small>' + ic('plus') + '</button>'; }).join('') +
        sids.map(function (id) { return '<button type="button" class="pm-idi" data-st="' + id + '"><b>' + esc(T('sg_' + id)) + '</b><small>' + esc(T('stratRun')) + '</small>' + ic('bt') + '</button>'; }).join('');
      if (main === 'strat' && !q) { var sn = h('<p class="pm-p pm-mute"></p>'); sn.textContent = T('stratNote'); list.insertBefore(sn, list.firstChild); }
      if (main === 'prof' && !q) { var pn = h('<p class="pm-p pm-mute"></p>'); pn.textContent = T('profNote'); list.appendChild(pn); }
      $$('[data-st]', list).forEach(function (b) { b.onclick = function () { closeModal(); if (P.bt) P.bt.tester(a, { id: b.getAttribute('data-st') }); }; });
      $$('[data-id]', list).forEach(function (b) { b.onclick = function () { addInd(a, b.getAttribute('data-id')); drawAct(); }; });
      if (main === 'ind' && tab === 'ck' && !q) {                       /* Coin_Kurd's other open-source scripts need TradingView's data: they open there */
        var nt = h('<p class="pm-p pm-mute"></p>'); nt.textContent = T('ckNote'); list.insertBefore(nt, list.firstChild);
        CKTV.forEach(function (x) {
          var l = h('<a class="pm-idi" target="_blank" rel="noopener noreferrer"><b></b><small></small>' + ic('share') + '</a>');
          l.href = 'https://www.tradingview.com/script/' + x[1] + '/'; $('b', l).textContent = T('ck_' + x[0]); $('small', l).textContent = T('ckd_' + x[0]) + ' · ' + T('openTv'); list.appendChild(l);
        });
      }
    }
    function drawAct() {
      act.innerHTML = a.cfg.inds.length ? a.cfg.inds.map(function (x) { return '<div class="pm-ia" data-u="' + esc(x.u) + '"><span>' + esc(indName(x)) + '</span>' + (I.DEF[x.id] && Object.keys(I.DEF[x.id].p).length ? '<button type="button" class="pm-ib" data-a="set">' + ic('gear') + '</button>' : '') + '<button type="button" class="pm-ib" data-a="del">' + ic('trash') + '</button></div>'; }).join('') : '<p class="pm-empty">' + esc(T('noInds')) + '</p>';
      $$('.pm-ia', act).forEach(function (r) {
        var u = r.getAttribute('data-u'), x = a.cfg.inds.filter(function (z) { return z.u === u; })[0];
        $$('button', r).forEach(function (b) { b.onclick = function () { if (b.getAttribute('data-a') === 'del') { a.cfg.inds = a.cfg.inds.filter(function (z) { return z.u !== u; }); a.indsChanged(); drawAct(); } else { closeModal(); indSettings(a, x); } }; });
      });
    }
    inp.oninput = draw; draw(); drawAct();
    modal(T('indicators'), box, { wide: true });
  }
  function addInd(cell, id) {
    if (cell.cfg.inds.length >= 12) { toast(T('maxInds')); return; }
    if (LAYERS[id] && cell.cfg.inds.some(function (x) { return x.id === id; })) return;
    var x = { id: id, p: I.DEF[id] ? I.params(id, {}) : {}, u: P.uid() };
    if (id === 'ema' && cell.cfg.inds.some(function (z) { return z.id === 'ema' && z.p.len === 50; })) x.p.len = 200;
    cell.cfg.inds.push(x); cell.indsChanged(); toast(T('added', { n: indName(x) }));
  }
  function indSettings(cell, x) {
    var D = I.DEF[x.id]; if (!D) return;
    var f = h('<form class="pm-iset"></form>');
    Object.keys(D.p).forEach(function (k) {
      var row = h('<label class="pm-field"><span></span><input class="pm-in" type="number" step="any" inputmode="decimal"></label>');
      $('span', row).textContent = T('p_' + k); $('input', row).value = x.p[k]; $('input', row).name = k; f.appendChild(row);
    });
    f.appendChild(h('<div class="pm-row"><button class="pm-btn pri" type="submit">' + esc(T('apply')) + '</button><button class="pm-btn" type="button" data-r>' + esc(T('reset')) + '</button></div>'));
    f.onsubmit = function (e) { e.preventDefault(); var p = {}; $$('input', f).forEach(function (i) { p[i.name] = i.value; }); x.p = I.params(x.id, p); closeModal(); cell.indsChanged(); };
    $('[data-r]', f).onclick = function () { x.p = I.params(x.id, {}); closeModal(); cell.indsChanged(); };
    modal(T('in_' + x.id), f);
  }

  /* ---- templates (indicator sets) */
  var TPL_BUILTIN = [
    { n: 'tpl_trend', inds: [['ema', { len: 20 }], ['ema', { len: 50 }], ['ema', { len: 200 }], ['vol', {}]] },
    { n: 'tpl_mom', inds: [['rsi', {}], ['macd', {}], ['vol', {}]] },
    { n: 'tpl_vola', inds: [['bb', {}], ['atr', {}], ['vol', {}]] },
    { n: 'tpl_ichi', inds: [['ichi', {}], ['vol', {}]] },
    { n: 'tpl_scalp', inds: [['vwap', {}], ['ema', { len: 9 }], ['st', {}], ['vol', {}]] },
    { n: 'tpl_ek', inds: [['posts', {}], ['sigs', {}], ['live', {}], ['vol', {}]] }
  ];
  function tplMenu(anchor) {
    var a = active(), mine = S.get('ek_pro_tpl', []); if (!Array.isArray(mine)) mine = [];
    function apply(list) { a.cfg.inds = list.filter(function (z) { return I.DEF[z[0]] || LAYERS[z[0]]; }).map(function (z) { return { id: z[0], p: I.DEF[z[0]] ? I.params(z[0], z[1]) : {}, u: P.uid() }; }); a.indsChanged(); }
    var items = [{ head: T('tplBuilt') }];
    TPL_BUILTIN.forEach(function (t) { items.push({ label: T(t.n), act: function () { apply(t.inds); } }); });
    items.push({ head: T('tplMine') });
    if (!mine.length) items.push({ label: T('tplNone'), disabled: true });
    mine.forEach(function (t, k) { items.push({ label: t.n, hint: '✕', act: function (b) { apply(t.inds); } }); });
    items.push({ sep: true }, { label: T('tplSave'), icon: 'save', act: function () {
      ask(T('tplSave'), '', function (n) { if (!n) return; mine = mine.filter(function (t) { return t.n !== n; }); mine.unshift({ n: n.slice(0, 40), inds: a.cfg.inds.map(function (x) { return [x.id, x.p]; }) }); S.set('ek_pro_tpl', mine.slice(0, 30)); toast(T('tplSaved')); }, T('tplName'));
    } });
    if (mine.length) items.push({ label: T('tplDel'), icon: 'trash', act: function () {
      menu(anchor, mine.map(function (t, k) { return { label: t.n, icon: 'trash', act: function () { mine.splice(k, 1); S.set('ek_pro_tpl', mine); toast(T('removed')); } }; }));
    } });
    menu(anchor, items);
  }

  /* ---- workspace menu: named layouts, export/import, share link, CSV */
  function wsMenu(anchor) {
    var L = S.get('ek_pro_layouts', []); if (!Array.isArray(L)) L = [];
    var items = [{ label: T('saveAs'), icon: 'save', act: function () { ask(T('saveAs'), st.name || '', function (n) { if (!n) return; st.name = n.slice(0, 40); L = L.filter(function (x) { return x.n !== st.name; }); L.unshift({ n: st.name, at: Date.now(), s: JSON.parse(JSON.stringify(st)) }); S.set('ek_pro_layouts', L.slice(0, 40)); paintTop(); save(); toast(T('layoutSaved')); }, T('layoutName')); } },
      { label: T('newLayout'), icon: 'plus', act: function () { confirmBox(T('newLayout'), T('newLayoutQ'), function () { var keep = st.name; st = defaults(); st.name = ''; buildGrid(); save(); }); } },
      { head: T('myLayouts') }];
    if (!L.length) items.push({ label: T('noLayouts'), disabled: true });
    L.slice(0, 15).forEach(function (x) { items.push({ label: x.n, hint: fmtD(Math.floor(x.at / 1000), 'date'), act: function () { st = sane(x.s); st.name = x.n; buildGrid(); save(); toast(T('layoutLoaded', { n: x.n })); } }); });
    if (L.length) items.push({ label: T('delLayout'), icon: 'trash', act: function () { menu(anchor, L.map(function (x, k) { return { label: x.n, icon: 'trash', act: function () { L.splice(k, 1); S.set('ek_pro_layouts', L); toast(T('removed')); } }; })); } });
    items.push({ sep: true },
      { label: T('shareLink'), icon: 'share', act: shareLink },
      { label: T('csv'), icon: 'down', act: csv },
      { label: T('csvAll'), icon: 'down', act: csvAll },
      { label: T('exportJson'), icon: 'down', act: exportAll },
      { label: T('importJson'), icon: 'copy', act: importAll });
    menu(anchor, items);
  }
  function b64u(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function packLayout() {
    var syms = {}; st.charts.slice(0, LAYOUTS[st.layout]).forEach(function (c) { syms[c.sym] = 1; });
    var dr = {}; Object.keys(syms).forEach(function (s) { if (DRAW[s]) dr[s] = DRAW[s].slice(0, 60); });
    return { v: 1, l: st.layout, y: st.sync, c: st.charts.slice(0, LAYOUTS[st.layout]), d: dr };
  }
  function shareLink() {
    var json = JSON.stringify(packLayout());
    var done = function (code) {
      var url = location.origin + '/market/#s=' + code;
      if (url.length > 60000) { toast(T('tooBig')); return; }
      var f = h('<div><input class="pm-in" readonly><div class="pm-row"><button class="pm-btn pri" type="button" data-c></button><a class="pm-btn" target="_blank" rel="noopener" data-t>Telegram</a></div><div class="pm-qr"></div><p class="pm-note"></p></div>');
      qrInto($('.pm-qr', f), url);
      $('input', f).value = url; $('[data-c]', f).textContent = T('copy'); $('.pm-note', f).textContent = T('shareNote');
      $('[data-t]', f).href = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(T('shareText'));
      $('[data-c]', f).onclick = function () { var i = $('input', f); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast(T('copied')); }, function () { try { d.execCommand('copy'); toast(T('copied')); } catch (e) { } }); };
      modal(T('shareLink'), f, { nofocus: true });
    };
    if (window.CompressionStream) new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer().then(function (b) { done('z' + b64u(b)); }, function () { done('j' + b64u(new TextEncoder().encode(json))); });
    else done('j' + b64u(new TextEncoder().encode(json)));
  }
  /* a QR code of the link, so a phone can open the same workspace (the library loads only when asked) */
  var QRL = null;
  function qrInto(box, url) {
    if (url.length > 1500) { box.innerHTML = '<p class="pm-note">' + esc(T('qrTooBig')) + '</p>'; return; }
    QRL = QRL || new Promise(function (ok, no) { if (window.qrcode) return ok(); var sc = d.createElement('script'); sc.src = '/assets/vendor/qrcode.js?v=1'; sc.onload = ok; sc.onerror = function () { QRL = null; no(); }; d.head.appendChild(sc); });
    QRL.then(function () {
      try { var q = window.qrcode(0, 'L'); q.addData(url); q.make(); var n = q.getModuleCount() + 4, cs = Math.max(2, Math.floor(232 / n)); box.innerHTML = q.createSvgTag({ cellSize: cs, margin: cs * 2 }) + '<p class="pm-note">' + esc(T('qrNote')) + '</p>'; var sv = $('svg', box); if (sv) { sv.setAttribute('role', 'img'); sv.setAttribute('aria-label', 'QR'); } }
      catch (e) { box.innerHTML = '<p class="pm-note">' + esc(T('qrTooBig')) + '</p>'; }
    }, function () { box.textContent = ''; });
  }
  function readShare() {
    var m = /#s=([zj])([A-Za-z0-9_-]+)$/.exec(location.hash); if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    var bytes; try { bytes = unb64u(m[2]); } catch (e) { return; }
    var p = m[1] === 'z' && window.DecompressionStream ? new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text() : Promise.resolve(new TextDecoder().decode(bytes));
    p.then(function (txt) {
      var o = JSON.parse(txt); if (!o || o.v !== 1) return;
      confirmBox(T('sharedTitle'), T('sharedQ'), function () {
        var L = S.get('ek_pro_layouts', []); if (!Array.isArray(L)) L = [];
        L.unshift({ n: T('beforeShare') + ' ' + fmtD(Math.floor(Date.now() / 1000), 'date'), at: Date.now(), s: JSON.parse(JSON.stringify(st)) }); S.set('ek_pro_layouts', L.slice(0, 40));
        var ns = sane({ layout: o.l, sync: o.y, charts: o.c }); ns.tz = st.tz; ns.side = st.side; ns.fav = st.fav; st = ns;
        Object.keys(o.d || {}).forEach(function (s) {
          if (!SYM_RE.test(s) || !Array.isArray(o.d[s])) return;
          var mine = DRAW[s] = DRAW[s] || [], have = {}; mine.forEach(function (x) { have[x.id] = 1; });
          o.d[s].slice(0, 60).forEach(function (x) { var c = cleanDraw(x); if (c && !have[c.id]) mine.push(c); });
        });
        buildGrid(); save(); toast(T('sharedOpened'));
      }, T('open'));
    }).catch(function () { toast(T('badShare')); });
  }
  function cleanDraw(x) {
    if (!x || !P.TOOLS[x.k] || !Array.isArray(x.pts)) return null;
    var pts = x.pts.slice(0, 400).filter(function (p) { return p && isFinite(p.t); }).map(function (p) { return { t: Math.round(+p.t), p: p.p == null ? null : +p.p }; });
    if (!pts.length) return null;
    var s = x.s || {}, col = /^#[0-9a-fA-F]{6}$/.test(s.c) ? s.c : '#f7931a';
    var o = { c: col, w: Math.max(1, Math.min(6, +s.w || 2)), d: [0, 1, 2].indexOf(s.d) >= 0 ? s.d : 0, x: typeof s.x === 'string' ? s.x.slice(0, 120) : undefined, l: !!s.l, r: !!s.r, f: s.f !== false };
    if (isFinite(s.fs)) o.fs = Math.max(8, Math.min(48, +s.fs));
    if (isFinite(s.fo)) o.fo = Math.max(0, Math.min(0.6, +s.fo));
    if (isFinite(s.dv)) o.dv = Math.max(0.5, Math.min(5, +s.dv));
    if (isFinite(s.rows)) o.rows = Math.max(6, Math.min(80, Math.round(+s.rows)));
    if (/^#[0-9a-fA-F]{6}$/.test(s.tc)) o.tc = s.tc;
    if (Array.isArray(s.lv)) { var lv = s.lv.slice(0, 24).map(Number).filter(function (v) { return isFinite(v) && v >= -10 && v <= 100; }); if (lv.length) o.lv = lv; }
    if (Array.isArray(s.hv)) { var hv = s.hv.filter(function (v) { return ['S', 'm', 'h', 'D', 'W', 'M'].indexOf(v) >= 0; }); if (hv.length) o.hv = hv; }
    return { id: String(x.id || P.uid()).slice(0, 20), k: x.k, pts: pts, s: o, lk: !!x.lk, hd: !!x.hd };
  }
  function csv() {
    var a = active(), bars = a.replay ? a.bars.slice(0, a.replay.i + 1) : a.bars; if (!bars.length) { toast(T('noData', { s: a.cfg.sym })); return; }
    var cols = [], vals = [];
    a.cfg.inds.forEach(function (x) { if (!I.DEF[x.id] || x.off) return; var v = I.compute(x.id, bars, x.p); Object.keys(v).forEach(function (k) { if (k === 'dir') return; cols.push(x.id + (Object.keys(x.p).length ? '(' + Object.keys(x.p).map(function (q) { return x.p[q]; }).join(' ') + ')' : '') + '.' + k); vals.push(v[k]); }); });
    var lines = ['time_utc,time_local,unix,open,high,low,close,volume' + (cols.length ? ',' + cols.join(',') : '')];
    bars.forEach(function (b, i) { lines.push(new Date(b.t * 1000).toISOString().replace('.000Z', 'Z') + ',' + csvq(fmtT(b.t, 'fulls')) + ',' + b.t + ',' + b.o + ',' + b.h + ',' + b.l + ',' + b.c + ',' + b.v + (vals.length ? ',' + vals.map(function (v) { return I.ok(v[i]) ? +v[i].toPrecision(12) : ''; }).join(',') : '')); });
    download('entekhab_' + fileSym(a.cfg.sym) + '_' + a.cfg.tf + '_' + new Date().toISOString().slice(0, 10) + '.csv', '\ufeff' + lines.join('\n') + '\n', 'text/csv');
    toast(T('csvDone', { n: loc(bars.length) }));
  }
  function csvq(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function fileSym(sym) { return String(P.pair ? P.pair(sym) : sym).replace(/[^A-Za-z0-9]+/g, '') || 'chart'; }
  function csvAll() {                                                  /* every chart of the layout in one file, a row per bar */
    var lines = ['symbol,timeframe,time_utc,time_local,unix,open,high,low,close,volume'], n = 0;
    cells.forEach(function (a) {
      var bars = a.replay ? a.bars.slice(0, a.replay.i + 1) : a.bars, sy = csvq(P.pair ? P.pair(a.cfg.sym) : a.cfg.sym);
      bars.forEach(function (b) { n++; lines.push(sy + ',' + a.cfg.tf + ',' + new Date(b.t * 1000).toISOString().replace('.000Z', 'Z') + ',' + csvq(fmtT(b.t, 'fulls')) + ',' + b.t + ',' + b.o + ',' + b.h + ',' + b.l + ',' + b.c + ',' + b.v); });
    });
    if (!n) { toast(T('noData', { s: '' })); return; }
    download('entekhab_layout_' + cells.length + 'charts_' + new Date().toISOString().slice(0, 10) + '.csv', '\ufeff' + lines.join('\n') + '\n', 'text/csv');
    toast(T('csvDone', { n: loc(n) }));
  }
  var KEYS = ['ek_pro', 'ek_pro_draw', 'ek_pro_alerts', 'ek_pro_layouts', 'ek_pro_tpl', 'ek_pro_watch'];
  function exportAll() { var o = { app: 'entekhab.net/market', v: 1, at: new Date().toISOString() }; KEYS.forEach(function (k) { o[k] = S.get(k, null); }); o.ek_pro = st; o.ek_pro_draw = DRAW; download('entekhab-market-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(o), 'application/json'); }
  function importAll() {
    var inp = h('<input type="file" accept="application/json,.json" hidden>'); d.body.appendChild(inp);
    inp.onchange = function () {
      var f = inp.files[0]; inp.remove(); if (!f || f.size > 3e6) { toast(T('badFile')); return; }
      f.text().then(function (txt) {
        var o = JSON.parse(txt); if (!o || o.app !== 'entekhab.net/market') throw 0;
        confirmBox(T('importJson'), T('importQ'), function () {
          st = sane(o.ek_pro); DRAW = {};
          Object.keys(o.ek_pro_draw || {}).forEach(function (s) { if (SYM_RE.test(s) && Array.isArray(o.ek_pro_draw[s])) DRAW[s] = o.ek_pro_draw[s].map(cleanDraw).filter(Boolean); });
          ['ek_pro_alerts', 'ek_pro_layouts', 'ek_pro_tpl', 'ek_pro_watch'].forEach(function (k) { if (o[k] != null) S.set(k, o[k]); });
          save(); location.reload();
        });
      }).catch(function () { toast(T('badFile')); });
    };
    inp.click();
  }

  /* ---- snapshot, fullscreen, settings */
  function pngShot() {
    var a = active(), cv; try { cv = a.chart.takeScreenshot(true); } catch (e) { toast(T('snapErr')); return; }
    var out = d.createElement('canvas'), pad = 34; out.width = cv.width; out.height = cv.height + pad;
    var x = out.getContext('2d'); x.fillStyle = '#0b0b0c'; x.fillRect(0, 0, out.width, out.height); x.drawImage(cv, 0, pad);
    x.fillStyle = '#f7931a'; x.font = '700 15px Vazirmatn, Tahoma, sans-serif'; x.textBaseline = 'middle';
    x.fillText(P.pair(a.cfg.sym) + ' · ' + tfLabel(a.cfg.tf) + ' · ' + fmtT(Math.floor(Date.now() / 1000)) + ' (' + tzLabel() + ')', 12, pad / 2);
    x.fillStyle = '#9a9a94'; x.textAlign = 'right'; x.fillText('entekhab.net/market', out.width - 12, pad / 2);
    out.toBlob(function (b) { if (b) download('entekhab_' + a.cfg.sym + '_' + a.cfg.tf + '_' + Date.now() + '.png', b, 'image/png'); });
  }
  function fullscreen() {
    var r = root;
    if (d.fullscreenElement) { d.exitFullscreen(); return; }
    if (r.requestFullscreen) r.requestFullscreen().catch(function () { r.classList.toggle('pm-fs'); fit(); }); else { r.classList.toggle('pm-fs'); fit(); }
  }
  var TZS = ['local', 'UTC', 'Asia/Tehran', 'Asia/Baghdad', 'Europe/Istanbul', 'Asia/Dubai', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'Asia/Tokyo'];
  function settingsMenu(anchor) {
    var items = [{ label: T('langTitle'), hint: LROW[LANG] ? LROW[LANG][1] : '', icon: 'globe', act: langDialog },
      { label: T('curTitle'), hint: P.fx ? curLabel(P.fx.cur()) : '', act: curDialog }, { head: T('timezone') }];
    TZS.forEach(function (z) { items.push({ label: z === 'local' ? T('tzLocal') : z.replace('_', ' '), on: st.tz === z, act: function () { setTZ(z); } }); });
    items.push({ head: T('calendar') },
      { label: T('greg'), on: st.cal === 'greg', act: function () { st.cal = 'greg'; FMT = {}; relocalize(); save(); } },
      { label: T('jalali'), on: st.cal === 'jalali', act: function () { st.cal = 'jalali'; FMT = {}; relocalize(); save(); } },
      { head: T('data') },
      { label: T('saver'), on: !!P.saver, hint: P.saverAuto ? T('saverAuto') : '', act: function () { st.saver = !P.saver; P.setSaver(st.saver); save(); toast(st.saver ? T('saverOn') : T('saverOff')); } },
      { label: T('sound'), on: !!st.sound, act: function () { st.sound = st.sound ? 0 : 1; save(); } });
    menu(anchor, items);
  }
  function setTZ(z) { st.tz = z; FMT = {}; relocalize(); save(); }
  function relocalize() { cells.forEach(function (c) { c.chart.applyOptions(locOpts()); c.legend(); }); clockTick(); emit('tz'); }

  /* ---- the language menu: every language of the workspace (the site's own first: Kurdish first, English last) */
  /* the header's language group on market pages: a globe first (all 47), then the site's own four (owner, 2026-11-15) */
  function headerGlobe() {
    var g = document.getElementById('langs');
    if (!g || g.querySelector('.pm-hglobe')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'pm-hglobe'; b.title = T('langTitle'); b.setAttribute('aria-label', T('langTitle'));
    b.innerHTML = ic('globe') + '<b>' + ((P.LANGS || []).length || 47) + '</b>';
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); langDialog(); });
    g.insertBefore(b, g.firstChild);
  }
  setTimeout(headerGlobe, 0);
  function langDialog() {
    closeMenu();
    var box = h('<div class="pm-lgd"><input class="pm-in" type="search" autocomplete="off" spellcheck="false"><div class="pm-lgl" role="listbox"></div><p class="pm-note"></p></div>');
    var inp = $('input', box), list = $('.pm-lgl', box);
    inp.placeholder = T('langSearch'); inp.setAttribute('aria-label', T('langSearch')); $('.pm-note', box).textContent = T('langNote');
    function draw() {
      var q = inp.value.trim().toLowerCase();
      var L = (P.LANGS || []).filter(function (r) { return !q || (r[1] + ' ' + r[2] + ' ' + r[0]).toLowerCase().indexOf(q) >= 0; });
      list.innerHTML = L.length ? L.map(function (r) {
        var fl = P.langFlag ? P.langFlag(r[0]) : '';
        return '<button type="button" role="option" aria-selected="' + (r[0] === LANG) + '" class="pm-lgi' + (r[0] === LANG ? ' on' : '') + '" data-lg="' + r[0] + '">' +
          (fl ? '<img class="pm-lgf" src="' + esc(fl) + '" alt="" loading="lazy" width="26" height="26">' : '') +
          '<span class="pm-lgt"><b lang="' + esc(r[4]) + '" dir="' + r[5] + '">' + esc(r[1]) + '</b><small lang="en" dir="ltr">' + esc(r[2]) + '</small></span></button>';
      }).join('') : '<p class="pm-empty">' + esc(T('noMatch')) + '</p>';
      $$('[data-lg]', list).forEach(function (b) { b.onclick = function () { goLang(b.getAttribute('data-lg')); }; });
    }
    inp.oninput = draw; draw();
    var m = modal(T('langTitle'), box, { wide: true, nofocus: matchMedia('(pointer: coarse)').matches });
    rail($('.pm-mbody', m));
  }

  /* The gold bar beside the languages: how tall it is says how much of the list you are seeing, where it sits says
     where you are, and dragging it carries you there. The browser's own bar is a grey sliver on some machines and
     an invisible overlay on others, so the panel draws this one itself — still one bar, not two. */
  function rail(body) {
    if (!body || $('.pm-rail', body)) return;
    var r = h('<div class="pm-rail" aria-hidden="true"><i></i><b></b></div>');
    body.insertBefore(r, body.firstChild);
    var track = $('i', r), thumb = $('b', r), MIN = 28;
    function draw() {
      var hh = body.clientHeight, total = body.scrollHeight, room = total - hh;
      if (room <= 2) { r.style.display = 'none'; return; }
      r.style.display = '';
      track.style.top = '8px'; track.style.height = (hh - 16) + 'px';
      var th = Math.max(MIN, Math.round((hh - 16) * hh / total));
      thumb.style.height = th + 'px';
      thumb.style.top = Math.round(8 + (hh - 16 - th) * (body.scrollTop / room)) + 'px';
    }
    body.addEventListener('scroll', draw, { passive: true });
    body.addEventListener('input', draw);                 /* the search box shortens the list */
    if (window.ResizeObserver) new ResizeObserver(draw).observe(body);
    setTimeout(draw, 0); draw();
    thumb.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var hh = body.clientHeight, th = thumb.offsetHeight, span = hh - 16 - th, room = body.scrollHeight - hh;
      var y0 = e.clientY, top0 = parseFloat(thumb.style.top) || 8;
      r.classList.add('on');
      function move(ev) {
        var t = Math.min(8 + span, Math.max(8, top0 + ev.clientY - y0));
        body.scrollTop = span > 0 ? (t - 8) / span * room : 0;
      }
      function up() { r.classList.remove('on'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
  }

  /* ---- the currency prices are shown in, and the visitor's own rate for it (fx.js keeps both) */
  var UNITS = ['USDT', 'USD'], TGJU = 'tgju';                               /* (kept out of T(…): the strings test reads literals there as keys) */
  function curLabel(c) { return c === 'USD' ? 'USDT' : c === 'IRT' ? T('toman') : c; }
  function refName(src) { return src === 'ecb' ? 'ECB' : src === 'xapi' ? 'exchange-api' : src || ''; }
  function curDialog() {
    closeMenu();
    var box = h('<div class="pm-cud"><div class="pm-cuh"></div><input class="pm-in" type="search" autocomplete="off" spellcheck="false"><div class="pm-cul" role="listbox"></div><p class="pm-note"></p></div>');
    var head = $('.pm-cuh', box), inp = $('input', box), list = $('.pm-cul', box), LT = null;
    inp.placeholder = T('curSearch'); inp.setAttribute('aria-label', T('curSearch')); $('.pm-note', box).textContent = T('curNote');
    function refLine(code) {
      if (code === 'USD') return T('curPlain');
      if (code === 'IRT') { var r = P.rateAt ? P.rateAt(Date.now() / 1000) : null, tm = T('toman'); return r ? T('curRef', { v: P.fmt(r, 0), c: tm, s: TGJU }) : TGJU; }
      var x = LT && LT.r && LT.r[code]; if (!x) return '';
      return T('curRef', { v: P.fmt(x[0], P.prec(x[0])), c: code, s: refName(x[2]) + ' · ' + x[1] });       /* a rate keeps its decimals (155.78 yen) */
    }
    function drawHead() {
      var c = P.fx.cur(), own = P.fx.own(c);
      head.innerHTML = '<div class="pm-cur1"><img src="' + esc(P.fx.flag(c)) + '" alt="" width="30" height="30"><div><b></b><small></small></div></div>' +
        (c === 'USD' ? '' : '<form class="pm-own"><b class="pm-ownt"></b><div class="pm-row"><input class="pm-in" type="number" min="0" step="any" inputmode="decimal" required><select class="pm-in"><option value="USDT"></option><option value="USD"></option></select></div>' +
          '<div class="pm-row"><button class="pm-btn pri" type="submit"></button>' + (own ? '<button class="pm-btn" type="button" data-a="ref"></button>' : '') + '</div><small class="pm-note"></small></form>');
      $('.pm-cur1 b', head).textContent = c === 'IRT' ? P.fx.name(c) : curLabel(c) + ' · ' + P.fx.name(c);
      $('.pm-cur1 small', head).textContent = own ? T('ownLine', { v: P.fmt(own.v, P.prec(own.v)), c: curLabel(c), per: own.per }) : refLine(c);
      var f = $('.pm-own', head); if (!f) return;
      $('.pm-ownt', f).textContent = T('ownRate'); $('button[type=submit]', f).textContent = T('ownSave'); $('.pm-note', f).textContent = T('ownNote', { c: curLabel(c) });
      var vi = $('input', f), pi = $('select', f), ops = $$('option', pi);
      ops[0].textContent = T('perUnit', { u: UNITS[0], c: curLabel(c) }); ops[1].textContent = T('perUnit', { u: UNITS[1], c: curLabel(c) });
      vi.setAttribute('aria-label', T('ownRate'));
      if (own) { vi.value = own.v; pi.value = own.per; }
      else { var rx = c === 'IRT' ? (P.rateAt ? P.rateAt(Date.now() / 1000) : null) : LT && LT.r && LT.r[c] ? LT.r[c][0] : null; if (rx) vi.placeholder = P.fmt(rx, c === 'IRT' ? 0 : P.prec(rx)).replace(/,/g, ''); }
      var rb = $('[data-a="ref"]', f); if (rb) { rb.textContent = T('ownClear'); rb.onclick = function () { P.fx.clearOwn(c); toast(T('ownCleared', { c: curLabel(c) })); drawHead(); draw(); }; }
      f.onsubmit = function (e) {
        e.preventDefault(); var v = +String(vi.value).replace(/[,\s]/g, '');
        if (!(v > 0) || !isFinite(v)) { toast(T('badValue')); return; }
        if (P.fx.setOwn(c, v, pi.value)) { toast(T('ownSet', { c: curLabel(c) })); drawHead(); draw(); }
      };
    }
    function codes() {
      var all = LT && LT.r ? Object.keys(LT.r).filter(function (k) { return /^[A-Z]{3}$/.test(k); }) : [], seen = {}, out = [];
      all.sort(function (a, b) { return P.fx.name(a).localeCompare(P.fx.name(b), LOCS[LANG] || 'en'); });
      [P.fx.cur(), P.fx.defaultFor(LANG), 'USD', 'IRT'].concat(all).forEach(function (k) { if (k && !seen[k]) { seen[k] = 1; out.push(k); } });
      return out;
    }
    function draw() {
      var q = inp.value.trim().toLowerCase(), cur = P.fx.cur(), sug = P.fx.defaultFor(LANG);
      var L = codes().filter(function (k) { return !q || (k + ' ' + curLabel(k) + ' ' + P.fx.name(k) + ' ' + P.fx.name(k, 'en')).toLowerCase().indexOf(q) >= 0; });
      list.innerHTML = L.length ? L.map(function (k) {
        return '<button type="button" role="option" aria-selected="' + (k === cur) + '" class="pm-cui' + (k === cur ? ' on' : '') + '" data-c="' + k + '"><img src="' + esc(P.fx.flag(k)) + '" alt="" width="22" height="22" loading="lazy">' +
          '<b>' + esc(curLabel(k)) + '</b><span>' + esc(P.fx.name(k)) + (k === sug ? ' <i class="pm-sug">' + esc(T('curSuggest')) + '</i>' : '') + '</span><small>' + esc(refLine(k)) + '</small></button>';
      }).join('') : '<p class="pm-empty">' + esc(LT ? T('noMatch') : T('loading')) + '</p>';
      $$('[data-c]', list).forEach(function (b) { b.onclick = function () { P.fx.set(b.getAttribute('data-c')); drawHead(); draw(); }; });
    }
    inp.oninput = draw; drawHead(); draw();
    modal(T('curTitle'), box, { wide: true, nofocus: true });
    P.fx.latest().then(function (j) { LT = j; drawHead(); draw(); }, function () { LT = { r: {} }; draw(); });
    /* the toman's rate (tgju) where the toman matters: shown on its row and offered as the input's example */
    if ((P.fx.cur() === 'IRT' || LANG === 'fa' || LANG === 'ckb') && P.quoteRate && !(P.rateAt && P.rateAt(Date.now() / 1000))) P.quoteRate('IRT').load().then(function () { if (box.isConnected) { drawHead(); draw(); } }, function () { });
  }
  function paintCur() {
    var b = $('#pm-cur'); if (b && P.fx) { var c = P.fx.cur(), own = P.fx.own(c); b.innerHTML = '<img src="' + esc(P.fx.flag(c)) + '" alt="" width="18" height="18"><span>' + esc(curLabel(c)) + '</span>' + (own ? '<i class="pm-owndot" title="' + esc(T('yourRate')) + '"></i>' : ''); }
    var lb = $('#pm-lang span'); if (lb && LROW[LANG]) lb.textContent = LROW[LANG][1];
  }
  /* a new currency: charts of coins in the old one move to the new one (USDT charts stay), lists follow */
  function swapSym(sym, to) {
    var In = P.inst(sym); if (!In) return sym;
    if (In.kind === 'irt' || In.kind === 'fiat') return to === 'USD' ? In.base : In.base + '_' + to;
    if (In.kind === 'fxr') return to === 'USD' ? 'BTC' : to === 'IRT' ? 'IR_USDT' : 'USDT_' + to;
    return sym;
  }
  if (P.fx) P.fx.on(function (what, code) {
    if (!root) return;
    if (what === 'cur') {
      st.charts.forEach(function (c, i) { var n = swapSym(c.sym, code); if (n !== c.sym && SYM_RE.test(n)) { if (cells[i]) cells[i].setSym(n); else c.sym = n; } });
      paintCur(); paintTop(); setSide(st.side, true); emit('cur', code);
    }
    if (what === 'rate') { cells.forEach(function (c) { c.legend(); }); paintCur(); emit('rate', code); }
  });

  /* ---- bottom bar */
  var RANGES = [['1D', 86400, '1m'], ['5D', 432000, '5m'], ['1M', 2592000, '30m'], ['3M', 7776000, '1h'], ['6M', 15552000, '2h'], ['YTD', 'ytd', '1d'], ['1Y', 31536000, '1d'], ['5Y', 157680000, '1w'], ['All', 'all', '1w']];
  function setRange(r) {
    var a = active(), want = r[2];
    if (a.cfg.tf !== want) { a.pendingRange = r[1]; applyTF(want); } else a.showRange(r[1]);
  }
  function goDate(cell, ts) {
    var D = cell.disp; if (!D.length) { cell.pendingGo = ts; return; }
    if (ts < D[0].t) {
      if (cell.feed && !cell.feed.full) { cell.pendingGo = ts; cell.goTries = (cell.goTries || 0) + 1; if (cell.goTries > 12) { cell.pendingGo = null; cell.goTries = 0; toast(T('tooFar')); return; } cell.feed.more().then(function (ok) { if (!ok) { cell.pendingGo = null; toast(T('tooFar')); } }); return; }
      toast(T('tooFar')); ts = D[0].t;
    }
    cell.goTries = 0;
    var lg = P.t2l(D, ts, cell.tfSec()), r = cell.chart.timeScale().getVisibleLogicalRange(), w = r ? (r.to - r.from) : 120;
    cell.chart.timeScale().setVisibleLogicalRange({ from: lg - w / 2, to: lg + w / 2 });
  }
  function goDialog() {
    var f = h('<form class="pm-go"><label class="pm-field"><span></span><input class="pm-in" type="date" required></label><label class="pm-field"><span></span><input class="pm-in" type="time" value="00:00"></label><div class="pm-row"><button class="pm-btn pri" type="submit"></button></div><p class="pm-note"></p></form>');
    var sp = $$('span', f); sp[0].textContent = T('date'); sp[1].textContent = T('time') + ' (UTC)'; $('button', f).textContent = T('go'); $('.pm-note', f).textContent = T('goNote');
    $('input[type=date]', f).max = new Date().toISOString().slice(0, 10);
    f.onsubmit = function (e) { e.preventDefault(); var dv = $('input[type=date]', f).value, tv = $('input[type=time]', f).value || '00:00'; var ts = Date.parse(dv + 'T' + tv + ':00Z') / 1000; if (!isFinite(ts)) return; closeModal(); goDate(active(), ts); };
    modal(T('goTo'), f);
  }
  function clockTick() {
    var c = $('#pm-clock'); if (c) c.textContent = fmtT(Math.floor(Date.now() / 1000), 'hms') + ' (' + tzLabel() + ')';
    cells.forEach(function (cell) {
      var e = $('.pm-cd', cell.el); if (!e) return;
      var D = cell.disp, sec = cell.tfSec(); if (!D.length || cell.replay || sec < 60 || !cell.feed || cell.feed.state === 'snap') { e.textContent = ''; return; }
      var left = D[D.length - 1].t + sec - Date.now() / 1000;
      if (left < 0 || left > sec) { e.textContent = ''; return; }
      var dd = Math.floor(left / 86400), hh = Math.floor(left % 86400 / 3600), mm = Math.floor(left % 3600 / 60), ss = Math.floor(left % 60);
      e.textContent = '⏱ ' + (dd ? dd + 'd ' : '') + (dd || hh ? String(hh).padStart(2, '0') + ':' : '') + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
      e.title = T('countdown');
    });
  }

  /* ================================================================ build the page */
  /* TradingView's left toolbar: each button keeps the tool last picked from its group; the small arrow opens the group */
  var TGROUPS = [
    { id: 'cur', rows: [['cursor', 'dot', 'arrowc', 'eraser']], heads: ['g_cursors'] },
    { id: 'lines', rows: [['trend', 'ray', 'info', 'ext', 'angle', 'hline', 'hray', 'vline', 'cross'], ['channel', 'regress', 'flat', 'disjoint'], ['pitch', 'schiff', 'mschiff', 'inside']], heads: ['g_lines', 'g_channels', 'g_pitch'] },
    { id: 'fib', rows: [['fib', 'fibext', 'fibch', 'fibtz', 'fibfan', 'fibtime', 'fibcirc', 'fibspiral', 'fibarc', 'fibwedge', 'pitchfan'], ['gannbox', 'gannsq', 'gann']], heads: ['g_fib', 'g_gann'] },
    { id: 'pat', rows: [['xabcd', 'cypher', 'hs', 'abcd', 'tri', 'drives'], ['ewimp', 'ewcor', 'ewtri', 'ewdbl', 'ewtrp'], ['cyclic', 'tcycle', 'sine']], heads: ['g_pat', 'g_elliott', 'g_cycles'] },
    { id: 'fc', rows: [['long', 'short', 'forecast', 'proj'], ['avwap', 'vrp'], ['prange', 'drange', 'measure']], heads: ['g_proj', 'g_vol', 'g_measurer'] },
    { id: 'shape', rows: [['brush', 'hl'], ['arrowmk', 'arrow', 'arrowup', 'arrowdn'], ['rect', 'rrect', 'path', 'circ', 'circle', 'poly', 'tri3', 'arc', 'curve', 'dcurve']], heads: ['g_brush', 'g_arrows', 'g_shapes'] },
    { id: 'ann', rows: [['text', 'note', 'callout', 'comment', 'signpost', 'plabel', 'pnote', 'flag']], heads: ['g_text'] },
    { id: 'emo', emoji: 1 }
  ];
  var EMOJI = ['⭐', '🚀', '🔥', '💥', '⚡', '💰', '💸', '💎', '🎯', '📌', '🚩', '⚠️', '✅', '❌', '❓', '❗',
    '🐂', '🐻', '🐳', '🦄', '👀', '😎', '😱', '🤔', '😂', '😭', '👍', '👎', '🙏', '💪',
    '🌙', '☀️', '🎉', '🔔', '⏰', '📈', '📉', '⬆️', '⬇️', '➡️', '⬅️', '🔴', '🟢', '🟡', '🔵', '₿'];
  var CMODES = { cursor: 1, dot: 1, arrowc: 1, eraser: 1 };
  function groupOf(t) { for (var i = 0; i < TGROUPS.length; i++) { var G = TGROUPS[i]; if (G.rows && G.rows.some(function (r) { return r.indexOf(t) >= 0; })) return G; } return null; }
  function grpTool(G) { var t = st.tg && st.tg[G.id]; return t && G.rows.some(function (r) { return r.indexOf(t) >= 0; }) ? t : G.rows[0][0]; }
  function build() {
    root = $('#pro'); if (!root) return;
    root.setAttribute('translate', 'no'); root.classList.add('notranslate'); root.setAttribute('lang', TAG()); d.body.classList.add('pm-on');
    de.lang = TAG(); de.dir = RTL() ? 'rtl' : 'ltr';
    root.innerHTML =
      '<div class="pm-top" role="toolbar">' +
        '<button type="button" class="pm-symb" id="pm-sym"></button>' +
        '<div class="pm-tfs" id="pm-tfs"></div>' +
        '<button type="button" class="pm-tb" id="pm-type"></button>' +
        '<button type="button" class="pm-tb" id="pm-ind">' + ic('fx') + '<span>' + esc(T('indicators')) + '</span></button>' +
        '<button type="button" class="pm-tb" id="pm-tpl" title="' + esc(T('templates')) + '">' + ic('tpl') + '<span class="pm-hide-s">' + esc(T('templates')) + '</span></button>' +
        '<button type="button" class="pm-tb" id="pm-rep">' + ic('replay') + '<span>' + esc(T('replay')) + '</span></button>' +
        '<button type="button" class="pm-tb" id="pm-bt" title="' + esc(T('tester')) + '">' + ic('bt') + '<span class="pm-hide-s">' + esc(T('testerShort')) + '</span></button>' +
        '<button type="button" class="pm-tb" id="pm-alert">' + ic('bell') + '<span>' + esc(T('alert')) + '</span></button>' +
        '<button type="button" class="pm-ib" id="pm-lay" title="' + esc(T('layout')) + '">' + ic('grid') + '</button>' +
        '<button type="button" class="pm-ib" id="pm-undo" title="' + esc(T('undo')) + '">' + ic('undo') + '</button>' +
        '<button type="button" class="pm-ib" id="pm-redo" title="' + esc(T('redo')) + '">' + ic('redo') + '</button>' +
        '<span class="pm-grow"></span>' +
        '<button type="button" class="pm-tb pm-ws" id="pm-ws"><span id="pm-name"></span><i id="pm-saved" class="pm-saved ok"></i>' + ic('chev', 'sm') + '</button>' +
        '<button type="button" class="pm-ib" id="pm-shot" title="' + esc(T('snapshot')) + '">' + ic('camera') + '</button>' +
        '<button type="button" class="pm-ib" id="pm-fs" title="' + esc(T('fullscreen')) + '">' + ic('full') + '</button>' +
        '<button type="button" class="pm-ib" id="pm-set" title="' + esc(T('settings')) + '">' + ic('gear') + '</button>' +
        '<button type="button" class="pm-ib pm-sidebtn" id="pm-sidebtn" title="' + esc(T('panels')) + '">' + ic('side') + '</button>' +
      '</div>' +
      '<div class="pm-body"><div class="pm-tools" id="pm-tools" role="toolbar" aria-label="' + esc(T('drawing')) + '"></div><div class="pm-grid" id="pm-grid"></div>' +
        '<aside class="pm-side" id="pm-side"><div class="pm-stabs" role="tablist"></div><div class="pm-spanel"></div></aside></div>' +
      '<div class="pm-bot"><div class="pm-ranges" id="pm-ranges"></div><button type="button" class="pm-ib" id="pm-go" title="' + esc(T('goTo')) + '">' + ic('cal') + '</button>' +
        '<button type="button" class="pm-ib pm-penb" id="pm-pen" title="' + esc(T('drawing')) + '">' + ic('pen') + '</button><span class="pm-grow"></span>' +
        /* language and currency sit with the clock (the visitor's own settings); first in the row on phones */
        '<button type="button" class="pm-tb pm-lgb" id="pm-lang" title="' + esc(T('langTitle')) + '" aria-label="' + esc(T('langTitle')) + '">' + ic('globe') + '<span class="pm-hide-s"></span></button>' +
        '<button type="button" class="pm-tb pm-curb" id="pm-cur" title="' + esc(T('curTitle')) + '" aria-label="' + esc(T('curTitle')) + '"></button>' +
        '<button type="button" class="pm-clock" id="pm-clock" title="' + esc(T('timezone')) + '"></button><div class="pm-scale" id="pm-scale"><button type="button" data-s="pct">%</button><button type="button" data-s="log">log</button><button type="button" data-s="auto">auto</button></div></div>';
    grid = $('#pm-grid');
    /* tools */
    buildTools();
    /* ranges */
    var rg = $('#pm-ranges'); RANGES.forEach(function (r) { var b = h('<button type="button"></button>'); b.textContent = r[0] === 'All' ? T('all') : r[0]; b.onclick = function () { setRange(r); }; rg.appendChild(b); });
    /* toolbar actions */
    $('#pm-sym').onclick = function () { symbolSearch(''); };
    $('#pm-type').onclick = function (e) { typeMenu(e.currentTarget); };
    $('#pm-ind').onclick = indDialog;
    $('#pm-tpl').onclick = function (e) { tplMenu(e.currentTarget); };
    $('#pm-rep').onclick = function () { if (P.replayToggle) P.replayToggle(active()); };
    $('#pm-bt').onclick = function () { if (P.bt) P.bt.tester(active()); };
    $('#pm-alert').onclick = function () { if (P.alertDialog) P.alertDialog(active()); };
    $('#pm-lay').onclick = function (e) { layoutMenu(e.currentTarget); };
    $('#pm-undo').onclick = doUndo; $('#pm-redo').onclick = doRedo;
    $('#pm-ws').onclick = function (e) { wsMenu(e.currentTarget); };
    $('#pm-shot').onclick = pngShot; $('#pm-fs').onclick = fullscreen;
    $('#pm-set').onclick = function (e) { settingsMenu(e.currentTarget); };
    $('#pm-cur').onclick = curDialog; $('#pm-lang').onclick = langDialog;
    paintCur();
    $('#pm-go').onclick = goDialog;
    $('#pm-clock').onclick = function (e) { settingsMenu(e.currentTarget); };
    $('#pm-pen').onclick = function () { root.classList.toggle('pm-pens'); fit(); };
    $('#pm-sidebtn').onclick = function () { setSide(st.side ? null : 'watch'); };
    $$('#pm-scale button').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-s'), sc = active().cfg.scale;
        if (k === 'auto') sc.auto = sc.auto ? 0 : 1; else if (k === 'log') sc.mode = sc.mode === 1 ? 0 : 1; else sc.mode = sc.mode === 2 ? 0 : 2;
        active().applyPrec(); paintTop(); save();
      };
    });
    buildSide();
    fit();
    if (wired) return;
    wired = true;
    /* language buttons in the site header */
    var LG = d.getElementById('langs');
    if (LG) LG.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-l]'); if (!b) return;
      var l = b.getAttribute('data-l');
      if (PAGE_LANG) { e.preventDefault(); goLang(l); return; }                        /* a /market/<code>/ page: the site's switch goes back to /market/ */
      if (l === 'ar' || LANG === 'ar') return;      /* Arabic switches are handled by ar.js (it reloads) */
      if (['fa', 'ckb', 'en'].indexOf(l) < 0 || l === LANG) return;
      try { localStorage.setItem('ck_lang', l); } catch (er) { }
      LANG = l; FMT = {}; FMTD = {}; if (P.fx) P.fx.init(l); root.setAttribute('lang', l); de.lang = l; de.dir = RTL() ? 'rtl' : 'ltr';
      var keep = st; closeModal(); closeMenu(); cells.forEach(function (c) { c.destroy(); }); cells = []; build(); st = keep; buildGrid(); emit('lang');
      pageText();
    });
    if (window.ResizeObserver) new ResizeObserver(debounce(fit, 60)).observe(d.body);
    addEventListener('storage', function (e) {
      if (e.key === 'ek_pro_draw') { var nd = S.get('ek_pro_draw', {}); if (nd && typeof nd === 'object' && !Array.isArray(nd)) { DRAW = nd; cells.forEach(function (c) { c.drawer.update(); c.ovl.update(); }); } }
      if (e.key) emit('storage', e.key);
    });
    addEventListener('load', function () { fit(); setTimeout(fit, 1200); setTimeout(fit, 3500); });
    addEventListener('resize', debounce(fit, 80));
    d.addEventListener('fullscreenchange', function () { root.classList.toggle('pm-fs', !!d.fullscreenElement); fit(); });
  }
  /* the workspace fills the screen under the site header and above the mobile tab bar */
  function fit() {
    if (!root) return;
    if (root.classList.contains('pm-fs')) { root.style.height = ''; return; }
    var top = root.getBoundingClientRect().top + scrollY, bh = 0;
    ['ekb', 'nxr'].forEach(function (id) { var b = d.getElementById(id); if (!b) return; var cs = getComputedStyle(b); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position !== 'fixed') return; var r = b.getBoundingClientRect(); if (r.height && r.top > innerHeight / 2) bh = Math.max(bh, innerHeight - r.top); });
    var vis = top - scrollY, hgt = Math.max(420, innerHeight - Math.max(0, vis) - bh - 8);
    root.style.height = hgt + 'px';
  }
  var eraserOn = false;
  function setTool(t) {
    closeFly();
    if (CMODES[t]) { eraserOn = t === 'eraser'; if (!eraserOn) { st.cm = t; save(); } curTool = null; }
    else { curTool = t || null; eraserOn = false; }
    cells.forEach(function (c) { c.drawer.setTool(c.i === st.active ? curTool : null); c.drawer.eraser = eraserOn; });
    applyCm(); paintTools(); toolBar();
  }
  /* the tool's own settings appear as soon as it is picked: they are what the next drawing starts with */
  function toolBar() {
    $$('.pm-toolbar').forEach(function (x) { x.remove(); });
    if (!curTool || curTool === 'zoom' || curTool === 'measure') return;
    var cell = active(), bar = h('<div class="pm-selbar pm-toolbar" role="toolbar"><b class="pm-tbn"></b></div>'), ls = lastStyle || {};
    $('.pm-tbn', bar).textContent = T('t_' + curTool);
    function set(k, v) { lastStyle = Object.assign({ c: '#f7931a', w: 2, d: 0 }, lastStyle || {}); lastStyle[k] = v; toolBar(); }
    COLORS.forEach(function (c) { var b = h('<button type="button" class="pm-sw' + ((ls.c || '#f7931a') === c ? ' on' : '') + '" style="background:' + c + '" aria-label="' + c + '"></button>'); b.onclick = function () { set('c', c); }; bar.appendChild(b); });
    var w = h('<button type="button" class="pm-ib pm-wb">' + (ls.w || 2) + 'px</button>'); w.onclick = function () { set('w', ((ls.w || 2) % 4) + 1); }; bar.appendChild(w);
    var ds = h('<button type="button" class="pm-ib pm-wb">' + ['━', '┅', '┈'][ls.d || 0] + '</button>'); ds.onclick = function () { set('d', ((ls.d || 0) + 1) % 3); }; bar.appendChild(ds);
    var hint = h('<small class="pm-tbh"></small>'); hint.textContent = T('toolHint'); bar.appendChild(hint);
    cell.el.appendChild(bar);
  }
  function applyCm() {
    var hide = !curTool && !eraserOn && (st.cm === 'dot' || st.cm === 'arrowc');
    cells.forEach(function (c) { try { c.chart.applyOptions({ crosshair: { vertLine: { visible: !hide }, horzLine: { visible: !hide } } }); } catch (e) { } });
  }
  function buildTools() {
    var tools = $('#pm-tools'), th = '';
    TGROUPS.forEach(function (G) {
      var t = G.emoji ? 'emoji' : grpTool(G), icon = G.emoji ? '<span class="pm-emo">' + esc(st.emoji || EMOJI[0]) + '</span>' : ic(t);
      th += '<div class="pm-tg" data-g="' + G.id + '"><button type="button" class="pm-tool" data-tool="' + t + '" title="' + esc(T(G.emoji ? 't_emoji' : 't_' + t)) + '" aria-label="' + esc(T(G.emoji ? 't_emoji' : 't_' + t)) + '">' + icon + '</button>' +
        '<button type="button" class="pm-tfly" data-fly="' + G.id + '" aria-label="' + esc(T('moreTools')) + '" aria-haspopup="menu"><i></i></button></div>';
    });
    th += '<i class="pm-tsep"></i>' +
      '<button type="button" class="pm-tool" data-tool="measure" title="' + esc(T('t_measure')) + '">' + ic('measure') + '</button>' +
      '<button type="button" class="pm-tool" data-tool="zoom" title="' + esc(T('t_zoom')) + '">' + ic('zoomin') + '</button>' +
      '<button type="button" class="pm-tool" data-opt="zoomout" title="' + esc(T('zoomOut')) + '">' + ic('zoomout') + '</button>' +
      '<i class="pm-tsep"></i>' +
      '<div class="pm-tg"><button type="button" class="pm-tool' + (st.magnet ? ' on' : '') + '" data-opt="magnet" title="' + esc(T(st.magnet === 2 ? 'magnetS' : 'magnetW')) + '">' + ic(st.magnet === 2 ? 'magnet2' : 'magnet') + '</button><button type="button" class="pm-tfly" data-fly="magnet" aria-label="' + esc(T('magnet')) + '"><i></i></button></div>' +
      '<button type="button" class="pm-tool' + (st.keep ? ' on' : '') + '" data-opt="keep" title="' + esc(T('keepDraw')) + '">' + ic('keep') + '</button>' +
      '<button type="button" class="pm-tool" data-opt="lockall" title="' + esc(T('lockAll')) + '">' + ic('lock') + '</button>' +
      '<div class="pm-tg"><button type="button" class="pm-tool" data-opt="hide" title="' + esc(T('hideAll')) + '">' + ic('eye') + '</button><button type="button" class="pm-tfly" data-fly="hide" aria-label="' + esc(T('hideAll')) + '"><i></i></button></div>' +
      '<div class="pm-tg"><button type="button" class="pm-tool" data-opt="clear" title="' + esc(T('clearAll')) + '">' + ic('trash') + '</button><button type="button" class="pm-tfly" data-fly="clear" aria-label="' + esc(T('clearAll')) + '"><i></i></button></div>';
    tools.innerHTML = th;
    $$('[data-tool]', tools).forEach(function (b) { b.onclick = function () { setTool(b.getAttribute('data-tool')); }; });
    $$('[data-fly]', tools).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); flyout(b, b.getAttribute('data-fly')); }; });
    $$('[data-opt]', tools).forEach(function (b) { b.onclick = function () { toolOpt(b.getAttribute('data-opt'), b); }; });
    paintTools();
  }
  function paintTools() {
    var on = curTool || (eraserOn ? 'eraser' : st.cm || 'cursor');
    $$('#pm-tools [data-tool]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tool') === on); });
    $$('#pm-tools [data-opt="magnet"]').forEach(function (b) { b.classList.toggle('on', !!st.magnet); b.innerHTML = ic(st.magnet === 2 ? 'magnet2' : 'magnet'); b.title = T(st.magnet === 2 ? 'magnetS' : st.magnet ? 'magnetW' : 'magnet'); });
    if (root) { root.classList.toggle('pm-cm-dot', st.cm === 'dot' && !curTool && !eraserOn); root.classList.toggle('pm-cm-arrow', st.cm === 'arrowc' && !curTool && !eraserOn); root.classList.toggle('pm-cm-erase', eraserOn && !curTool); }
  }
  /* the group's list, TradingView style: headings, an icon and a name per tool */
  var openFly = null;
  function closeFly() { if (openFly) { openFly.remove(); openFly = null; } }
  function flyout(btn, gid) {
    if (openFly && openFly._g === gid) { closeFly(); return; }
    closeFly(); closeMenu();
    var f = h('<div class="pm-fly" role="menu" dir="' + (RTL() ? 'rtl' : 'ltr') + '" lang="' + TAG() + '"></div>'); f._g = gid;
    function item(key, label, icon, onA, act) {
      var b = h('<button type="button" role="menuitem" class="pm-fi' + (onA ? ' on' : '') + '">' + icon + '<span></span></button>'); $('span', b).textContent = label;
      b.onclick = function (e) { e.stopPropagation(); closeFly(); act(); }; f.appendChild(b);
    }
    function head(k) { var hd = h('<div class="pm-fh"></div>'); hd.textContent = T(k); f.appendChild(hd); }
    var G = TGROUPS.filter(function (x) { return x.id === gid; })[0];
    if (G && G.emoji) {
      head('t_emoji'); var gridE = h('<div class="pm-emog"></div>');
      EMOJI.forEach(function (em) { var b = h('<button type="button" class="pm-emob"></button>'); b.textContent = em; b.onclick = function (e) { e.stopPropagation(); closeFly(); st.emoji = em; save(); var tb = $('#pm-tools [data-g="emo"] [data-tool]'); if (tb) tb.innerHTML = '<span class="pm-emo">' + esc(em) + '</span>'; setTool('emoji'); }; gridE.appendChild(b); });
      f.appendChild(gridE);
    } else if (G) {
      G.rows.forEach(function (row, i) {
        if (G.heads && G.heads[i]) head(G.heads[i]);
        row.forEach(function (t) { item(t, T('t_' + t), ic(t), t === (curTool || (eraserOn ? 'eraser' : st.cm || 'cursor')), function () { st.tg = st.tg || {}; st.tg[G.id] = t; save(); var tb = $('#pm-tools [data-g="' + G.id + '"] [data-tool]'); if (tb) { tb.setAttribute('data-tool', t); tb.innerHTML = ic(t); tb.title = T('t_' + t); tb.setAttribute('aria-label', T('t_' + t)); } setTool(t); }); });
      });
    } else if (gid === 'magnet') {
      item('m0', T('magnetOff'), ic('magnet'), !st.magnet, function () { setMagnet(0); });
      item('m1', T('magnetW'), ic('magnet'), st.magnet === 1, function () { setMagnet(1); });
      item('m2', T('magnetS'), ic('magnet2'), st.magnet === 2, function () { setMagnet(2); });
    } else if (gid === 'hide') {
      item('hd', T('hideDraw'), ic('pen'), false, function () { toolOpt('hide'); });
      item('hi', T('hideInds'), ic('fx'), false, function () { toolOpt('hideinds'); });
      item('ha', T('hideBoth'), ic('eyeoff'), false, function () { toolOpt('hide'); toolOpt('hideinds'); });
    } else if (gid === 'clear') {
      item('cd', T('clearDraw'), ic('pen'), false, function () { toolOpt('clear'); });
      item('ci', T('clearInds'), ic('fx'), false, function () { toolOpt('clearinds'); });
      item('ca', T('clearBoth'), ic('trash'), false, function () { toolOpt('clearboth'); });
    }
    (root || d.body).appendChild(f); openFly = f;
    var r = btn.getBoundingClientRect(), R = root.getBoundingClientRect(), fw = f.offsetWidth, fh = f.offsetHeight, rail = $('#pm-tools').getBoundingClientRect();
    var x, y;
    if (rail.width > rail.height) { x = r.left - R.left; y = rail.top - R.top - fh - 6; }               /* phones: the rail is a row at the bottom */
    else { x = rail.right - R.left + 4; y = r.top - R.top - 6; }
    x = Math.max(4, Math.min(R.width - fw - 4, x)); y = Math.max(4, Math.min(R.height - fh - 4, y));
    f.style.left = x + 'px'; f.style.top = y + 'px';
  }
  d.addEventListener('pointerdown', function (e) { if (openFly && !openFly.contains(e.target) && !(e.target.closest && e.target.closest('.pm-tfly'))) closeFly(); }, true);
  function setMagnet(v) { st.magnet = v; cells.forEach(function (c) { c.drawer.magnet = v; }); save(); paintTools(); }
  function toolOpt(o, b) {
    var a = active(), sym = a.cfg.sym, L = DRAW[sym] || [];
    if (o === 'magnet') setMagnet(st.magnet ? 0 : 1);
    else if (o === 'keep') { st.keep = st.keep ? 0 : 1; if (b) b.classList.toggle('on', !!st.keep); cells.forEach(function (c) { c.drawer.keep = !!st.keep; }); save(); }
    else if (o === 'lockall') { if (!L.length) return; var lk = L.some(function (x) { return !x.lk; }); mutate(sym, function (L2) { L2.forEach(function (x) { x.lk = lk; }); }); toast(T(lk ? 'lockedAll' : 'unlockedAll')); }
    else if (o === 'hide') { if (!L.length) return; var hide = L.some(function (x) { return !x.hd; }); mutate(sym, function (L2) { L2.forEach(function (x) { x.hd = hide; }); }); var hb = $('#pm-tools [data-opt="hide"]'); if (hb) hb.innerHTML = ic(hide ? 'eyeoff' : 'eye'); }
    else if (o === 'hideinds') { if (!a.cfg.inds.length) return; var off = a.cfg.inds.some(function (x) { return !x.off; }); a.cfg.inds.forEach(function (x) { x.off = off; }); a.indsChanged(); }
    else if (o === 'clear') { if (!L.length) return; confirmBox(T('clearAll'), T('clearQ', { s: sym }), function () { mutate(sym, function (L2) { L2.length = 0; }); toast(T('undoHint')); }); }
    else if (o === 'clearinds') { if (!a.cfg.inds.length) return; confirmBox(T('clearInds'), T('clearIndsQ'), function () { a.cfg.inds = []; a.indsChanged(); }); }
    else if (o === 'clearboth') { confirmBox(T('clearBoth'), T('clearQ', { s: sym }), function () { if (L.length) mutate(sym, function (L2) { L2.length = 0; }); if (a.cfg.inds.length) { a.cfg.inds = []; a.indsChanged(); } }); }
    else if (o === 'zoomout') {
      var ts = a.chart.timeScale(), prev = a._zst && a._zst.pop();
      if (prev) ts.setVisibleLogicalRange(prev);
      else { var r = ts.getVisibleLogicalRange(); if (r) { var m = (r.from + r.to) / 2, w = (r.to - r.from) || 50; ts.setVisibleLogicalRange({ from: m - w, to: m + w }); } }
      a.chart.priceScale('right').applyOptions({ autoScale: true });
    }
  }
  /* zoom in: the box the visitor drew becomes the visible time range */
  function zoomTo(cell, dd) {
    var ts = cell.chart.timeScale(), bars = cell.disp, sec = cell.tfSec(), a = P.t2l(bars, dd.pts[0].t, sec), b = P.t2l(bars, dd.pts[1].t, sec);
    if (a == null || b == null || Math.abs(b - a) < 2) { toast(T('zoomSmall')); return; }
    cell._zst = cell._zst || []; var r = ts.getVisibleLogicalRange(); if (r) { cell._zst.push({ from: r.from, to: r.to }); if (cell._zst.length > 20) cell._zst.shift(); }
    ts.setVisibleLogicalRange({ from: Math.min(a, b), to: Math.max(a, b) });
  }

  /* ---- a drawing's settings: Style · Text · Coordinates · Visibility (TradingView's four tabs) */
  var LVKIND = { fib: 'FIB', fibext: 'FIBX', fibch: 1, fibtz: 1, fibfan: 1, fibtime: 1, fibcirc: 1, fibarc: 1, fibwedge: 1, pitchfan: 1, gannbox: 1 };
  var EXTK = { trend: 1, arrow: 1, channel: 1, fib: 1, fibext: 1, info: 1, regress: 1, flat: 1, fibch: 1 };
  var FILLK = { rect: 1, circle: 1, channel: 1, rrect: 1, circ: 1, poly: 1, tri3: 1, arc: 1, regress: 1, flat: 1, disjoint: 1, pitch: 1, schiff: 1, mschiff: 1, inside: 1, fibch: 1, gannbox: 1, gannsq: 1, xabcd: 1, cypher: 1, hs: 1, tri: 1, tcycle: 1, proj: 1 };
  var TFCATS = [['S', 'vSec'], ['m', 'vMin'], ['h', 'vHour'], ['D', 'vDay'], ['W', 'vWeek'], ['M', 'vMonth']];
  function drawSettings(cell, dd) {
    var sym = cell.cfg.sym, s = dd.s || {}, k = dd.k, tabs = [['style', 'stStyle']];
    if (P.TEXTY[k] || k === 'emoji') tabs.push(['text', 'stText']);
    tabs.push(['coord', 'stCoord'], ['vis', 'stVis']);
    var f = h('<form class="pm-dset"><div class="pm-dtabs" role="tablist"></div><div class="pm-dpane"></div><div class="pm-row"><button class="pm-btn pri" type="submit">' + esc(T('ok')) + '</button><button class="pm-btn" type="button" data-x>' + esc(T('cancel')) + '</button></div></form>');
    var panes = {}, tb = $('.pm-dtabs', f), pane = $('.pm-dpane', f);
    function row(lbl, el) { var r = h('<label class="pm-drow"><span></span></label>'); $('span', r).textContent = T(lbl); r.appendChild(el); return r; }
    /* style */
    var P1 = h('<div></div>'), col = h('<input type="color" class="pm-in">'); col.value = /^#[0-9a-f]{6}$/i.test(s.c || '') ? s.c : '#f7931a'; P1.appendChild(row('stColor', col));
    var wd = h('<select class="pm-in"></select>'); [1, 2, 3, 4, 5, 6].forEach(function (n) { var o = h('<option></option>'); o.value = n; o.textContent = n + 'px'; if ((s.w || 2) === n) o.selected = true; wd.appendChild(o); }); P1.appendChild(row('stWidth', wd));
    var dsh = h('<select class="pm-in"></select>'); [['stSolid', 0], ['stDashed', 1], ['stDotted', 2]].forEach(function (x) { var o = h('<option></option>'); o.value = x[1]; o.textContent = T(x[0]); if ((s.d || 0) === x[1]) o.selected = true; dsh.appendChild(o); }); P1.appendChild(row('stLine', dsh));
    var fl = null, fo = null, exl = null, exr = null, lvIn = null, dv = null, rows = null;
    if (FILLK[k]) { fl = h('<input type="checkbox">'); fl.checked = s.f !== false; P1.appendChild(row('stFill', fl)); fo = h('<input type="range" min="0" max="60" step="1" class="pm-rng">'); fo.value = Math.round((s.fo != null ? s.fo : 0.1) * 100); P1.appendChild(row('stOpacity', fo)); }
    if (EXTK[k]) { if (k === 'trend' || k === 'arrow' || k === 'info') { exl = h('<input type="checkbox">'); exl.checked = !!s.l; P1.appendChild(row('stExtL', exl)); } exr = h('<input type="checkbox">'); exr.checked = !!s.r; P1.appendChild(row('stExtR', exr)); }
    if (LVKIND[k]) { var def = LVKIND[k] === 'FIB' ? P.FIB : LVKIND[k] === 'FIBX' ? P.FIBX : P.LV[k]; lvIn = h('<input class="pm-in" dir="ltr" maxlength="200">'); lvIn.value = (s.lv && s.lv.length ? s.lv : def).join(', '); P1.appendChild(row('stLevels', lvIn)); var rs = h('<button type="button" class="pm-btn sm"></button>'); rs.textContent = T('stReset'); rs.onclick = function () { lvIn.value = def.join(', '); }; P1.appendChild(rs); }
    if (k === 'regress') { dv = h('<input type="number" class="pm-in" min="0.5" max="5" step="0.1" dir="ltr">'); dv.value = s.dv || 2; P1.appendChild(row('stDev', dv)); }
    if (k === 'vrp') { rows = h('<input type="number" class="pm-in" min="6" max="80" step="1" dir="ltr">'); rows.value = s.rows || 24; P1.appendChild(row('stRows', rows)); }
    panes.style = P1;
    /* text */
    var tx = null, fs = null, tcol = null;
    if (P.TEXTY[k] || k === 'emoji') {
      var P2 = h('<div></div>');
      if (k === 'emoji') { tx = h('<select class="pm-in"></select>'); EMOJI.forEach(function (em) { var o = h('<option></option>'); o.value = em; o.textContent = em; if (s.x === em) o.selected = true; tx.appendChild(o); }); P2.appendChild(row('t_emoji', tx)); }
      else { tx = h('<textarea class="pm-in" rows="3" maxlength="120"></textarea>'); tx.value = s.x || ''; P2.appendChild(row('stTextL', tx)); tcol = h('<input type="color" class="pm-in">'); tcol.value = /^#[0-9a-f]{6}$/i.test(s.tc || '') ? s.tc : (k === 'text' ? (s.c || '#f7931a') : '#0b0b0c'); if (k !== 'text') P2.appendChild(row('stTextC', tcol)); else tcol = null; }
      fs = h('<select class="pm-in"></select>'); [10, 11, 12, 14, 16, 20, 24, 28, 32, 40].forEach(function (n) { var o = h('<option></option>'); o.value = n; o.textContent = n; if ((s.fs || (k === 'emoji' ? 26 : k === 'text' ? 14 : 11)) === n) o.selected = true; fs.appendChild(o); });
      if (k === 'emoji' && [10, 11, 12, 14, 16, 20, 24, 28, 32, 40].indexOf(s.fs || 26) < 0) { var o26 = h('<option selected></option>'); o26.value = s.fs || 26; o26.textContent = s.fs || 26; fs.appendChild(o26); }
      P2.appendChild(row('stSize', fs)); panes.text = P2;
    }
    /* coordinates: each anchor's price and time (UTC) */
    var P3 = h('<div class="pm-dcoord"></div>'), cin = [];
    dd.pts.slice(0, 12).forEach(function (p, i) {
      var r = h('<div class="pm-drow2"><b></b><input class="pm-in" dir="ltr" inputmode="decimal"><input class="pm-in" dir="ltr" maxlength="16" placeholder="YYYY-MM-DD HH:MM"></div>');
      $('b', r).textContent = '#' + (i + 1); var ins = $$('input', r);
      ins[0].value = p.p == null ? '' : String(+p.p.toPrecision(10)); if (p.p == null) ins[0].disabled = true;
      ins[1].value = new Date(p.t * 1000).toISOString().slice(0, 16).replace('T', ' ');
      cin.push(ins); P3.appendChild(r);
    });
    if (dd.pts.length > 12) { var more = h('<p class="pm-p"></p>'); more.textContent = T('stManyPts'); P3.appendChild(more); }
    var nt = h('<p class="pm-p pm-mute"></p>'); nt.textContent = T('stUtc'); P3.appendChild(nt); panes.coord = P3;
    /* visibility on timeframes */
    var P4 = h('<div></div>'), vis = {};
    TFCATS.forEach(function (c) { var cb = h('<input type="checkbox">'); cb.checked = !(s.hv && s.hv.indexOf(c[0]) >= 0); vis[c[0]] = cb; P4.appendChild(row(c[1], cb)); });
    panes.vis = P4;
    tabs.forEach(function (t, i) {
      var b = h('<button type="button" role="tab" class="pm-dtab' + (i ? '' : ' on') + '"></button>'); b.textContent = T(t[1]);
      b.onclick = function () { $$('.pm-dtab', tb).forEach(function (x) { x.classList.toggle('on', x === b); }); pane.innerHTML = ''; pane.appendChild(panes[t[0]]); };
      tb.appendChild(b);
    });
    pane.appendChild(panes.style);
    $('[data-x]', f).onclick = closeModal;
    f.onsubmit = function (e) {
      e.preventDefault();
      var ns = { c: col.value, w: +wd.value, d: +dsh.value }, bad = false, npts = null;
      if (fl) { ns.f = fl.checked; ns.fo = Math.max(0, Math.min(0.6, +fo.value / 100)); }
      if (exl) ns.l = exl.checked; if (exr) ns.r = exr.checked;
      if (lvIn) { var lv = lvIn.value.split(/[,\s،]+/).filter(Boolean).map(Number); if (!lv.length || lv.length > 24 || lv.some(function (v) { return !isFinite(v) || v < -10 || v > 100; })) { toast(T('stBadLv')); return; } ns.lv = lv; }
      if (dv) ns.dv = Math.max(0.5, Math.min(5, +dv.value || 2)); if (rows) ns.rows = Math.max(6, Math.min(80, Math.round(+rows.value || 24)));
      if (tx) ns.x = String(tx.value).slice(0, 120); if (fs) ns.fs = Math.max(8, Math.min(48, +fs.value || 14)); if (tcol) ns.tc = tcol.value;
      var hv = TFCATS.filter(function (c) { return !vis[c[0]].checked; }).map(function (c) { return c[0]; }); if (hv.length) ns.hv = hv;
      npts = dd.pts.map(function (p, i) {
        if (!cin[i]) return p;
        var pr = cin[i][0].disabled ? p.p : parseFloat(String(cin[i][0].value).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 1632; }).replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - 1776; }).replace(/[,٬]/g, ''));
        var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(String(cin[i][1].value).trim()), tt = m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 1000 : NaN;
        if (!isFinite(pr) || !isFinite(tt)) { bad = true; return p; }
        var keep = Math.abs(tt - Math.floor(p.t / 60) * 60) < 1 ? p.t : tt;     /* the minutes field drops seconds: leave the time alone when unchanged */
        return { t: Math.round(keep), p: p.p == null ? null : pr };
      });
      if (bad) { toast(T('stBadPt')); return; }
      closeModal();
      mutate(sym, function (L) { L.forEach(function (x) { if (x.id === dd.id) { var keepS = x.s || {}; x.s = Object.assign({}, keepS, ns); if (!hv.length) delete x.s.hv; x.pts = npts; lastStyle = { c: x.s.c, w: x.s.w, d: x.s.d }; } }); });
      var nd = cell.drawer.find(dd.id); if (nd) { cell.drawer.select(nd.id); selBar(cell, nd); }
    };
    modal(T('t_' + k) + ' · ' + T('settings'), f, { nofocus: true });
  }
  on('drawsel', function (cell, dd) { selBar(cell, dd); });
  /* the small bar over a selected drawing: colour, width, style, extend, text, alert, lock, copy, delete */
  var COLORS = ['#f7931a', '#facc15', '#34d399', '#38bdf8', '#a78bfa', '#f472b6', '#ff5a4d', '#e5e7eb'];
  function selBar(cell, dd) {
    $$('.pm-selbar').forEach(function (x) { x.remove(); });
    if (!dd) return;
    var sym = cell.cfg.sym, bar = h('<div class="pm-selbar" role="toolbar"></div>');
    function upd(f) { mutate(sym, function (L) { L.forEach(function (x) { if (x.id === dd.id) { x.s = x.s || {}; f(x); lastStyle = { c: x.s.c, w: x.s.w, d: x.s.d }; } }); }); var nd = cell.drawer.find(dd.id); if (nd) selBar(cell, nd); }
    COLORS.forEach(function (c) { var b = h('<button type="button" class="pm-sw' + ((dd.s && dd.s.c) === c ? ' on' : '') + '" style="background:' + c + '" aria-label="' + c + '"></button>'); b.onclick = function () { upd(function (x) { x.s.c = c; }); }; bar.appendChild(b); });
    var w = h('<button type="button" class="pm-ib pm-wb">' + ((dd.s && dd.s.w) || 2) + 'px</button>'); w.onclick = function () { upd(function (x) { x.s.w = ((x.s.w || 2) % 4) + 1; }); }; bar.appendChild(w);
    var ds = h('<button type="button" class="pm-ib pm-wb">' + ['━', '┅', '┈'][(dd.s && dd.s.d) || 0] + '</button>'); ds.onclick = function () { upd(function (x) { x.s.d = ((x.s.d || 0) + 1) % 3; }); }; bar.appendChild(ds);
    if (EXTK[dd.k]) { var ex = h('<button type="button" class="pm-ib pm-wb' + (dd.s && dd.s.r ? ' on' : '') + '" title="' + esc(T('extend')) + '">→|</button>'); ex.onclick = function () { upd(function (x) { x.s.r = !x.s.r; }); }; bar.appendChild(ex); }
    var gs = h('<button type="button" class="pm-ib pm-gsb" title="' + esc(T('settings')) + '">' + ic('gear') + '<span>' + esc(T('settings')) + '</span></button>'); gs.onclick = function () { drawSettings(cell, cell.drawer.find(dd.id) || dd); }; bar.appendChild(gs);
    if (P.TEXTY[dd.k]) { var tx = h('<button type="button" class="pm-ib" title="' + esc(T('editText')) + '">' + ic('text') + '</button>'); tx.onclick = function () { editText(dd); }; bar.appendChild(tx); }
    if (['hline', 'hray', 'trend', 'ray', 'ext', 'channel'].indexOf(dd.k) >= 0 && P.alertDialog) { var al = h('<button type="button" class="pm-ib" title="' + esc(T('alertHere')) + '">' + ic('bell') + '</button>'); al.onclick = function () { P.alertDialog(cell, dd.k === 'hline' || dd.k === 'hray' ? { price: dd.pts[0].p } : { draw: dd }); }; bar.appendChild(al); }
    var lk = h('<button type="button" class="pm-ib" title="' + esc(T(dd.lk ? 'unlock' : 'lock')) + '">' + ic(dd.lk ? 'lock' : 'unlock') + '</button>'); lk.onclick = function () { upd(function (x) { x.lk = !x.lk; }); }; bar.appendChild(lk);
    var cp = h('<button type="button" class="pm-ib" title="' + esc(T('clone')) + '">' + ic('copy') + '</button>'); cp.onclick = function () { var nd = JSON.parse(JSON.stringify(dd)); nd.id = P.uid(); var sec = cell.tfSec() * 5; nd.pts.forEach(function (p) { p.t += sec; }); mutate(sym, function (L) { L.push(nd); }); cell.drawer.select(nd.id); }; bar.appendChild(cp);
    var del = h('<button type="button" class="pm-ib pm-del" title="' + esc(T('remove')) + '">' + ic('trash') + '</button>'); del.onclick = function () { removeDrawing(cell, dd.id); }; bar.appendChild(del);
    cell.el.appendChild(bar);
  }
  function removeDrawing(cell, id) { var sym = cell.cfg.sym; mutate(sym, function (L) { var k = L.findIndex(function (x) { return x.id === id; }); if (k >= 0) L.splice(k, 1); }); cell.drawer.select(null); }

  /* ---- side panel host (the panels themselves are in panels.js) */
  var PANELS = {};
  function buildSide() {
    var tabs = $('.pm-stabs', root);
    tabs.innerHTML = [['watch', 'star', 'watchlist'], ['alerts', 'bell', 'alerts'], ['cal', 'cal', 'ecoCal'], ['obj', 'layers', 'objects'], ['help', 'help', 'helpTab']].map(function (t) {
      return '<button type="button" role="tab" class="pm-stab" data-p="' + t[0] + '" title="' + esc(T(t[2])) + '">' + ic(t[1]) + '<span>' + esc(T(t[2])) + '</span></button>';
    }).join('') + '<button type="button" class="pm-ib pm-sclose" title="' + esc(T('close')) + '" aria-label="' + esc(T('close')) + '">' + ic('x') + '</button>' +
      '<button type="button" class="pm-ib pm-sfold" title="' + esc(T('close')) + '" aria-label="' + esc(T('close')) + '">' + ic('fold') + '</button>';
    $$('.pm-stab', tabs).forEach(function (b) { b.onclick = function () { var p = b.getAttribute('data-p'); setSide(st.side === p ? null : p); }; });   /* a click on the open tab folds the panel away */
    $('.pm-sclose', tabs).onclick = function () { setSide(null); };
    $('.pm-sfold', tabs).onclick = function () { setSide(null); };
    setSide(st.side, true);
  }
  function setSide(p, quiet) {
    st.side = p; root.classList.toggle('pm-noside', !p);
    $$('.pm-stab', root).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-p') === p); b.setAttribute('aria-selected', b.getAttribute('data-p') === p ? 'true' : 'false'); });
    var box = $('.pm-spanel', root); box.innerHTML = ''; box.dir = RTL() ? 'rtl' : 'ltr';
    if (p && PANELS[p]) { var inner = h('<div class="pm-pin"></div>'); box.appendChild(inner); try { PANELS[p](inner); } catch (e) { if (window.console) console.error(e); } }
    if (!quiet) save();
    setTimeout(fit, 0);
  }

  /* ---- keyboard */
  d.addEventListener('keydown', function (e) {
    if (!root || e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
    var a = active(); if (!a) return;
    if (e.key === 'Escape') { if (openModal) closeModal(); else if (openMenu) closeMenu(); else if (openFly) closeFly(); else if (a.drawer.cur) a.drawer.cancel(); else if (openFly) closeFly(); else if (curTool || eraserOn) setTool(null); else a.drawer.select(null); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && a.drawer.sel) { e.preventDefault(); removeDrawing(a, a.drawer.sel); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return; }
    if (e.altKey && !e.ctrlKey) { var map = { t: 'trend', h: 'hline', v: 'vline', f: 'fib', r: 'rect' }, k = map[e.key.toLowerCase()]; if (k) { e.preventDefault(); setTool(k); return; } }
    if (P.replayKey && P.replayKey(a, e)) return;
    if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[a-zA-Z]$/.test(e.key) && !openModal) { e.preventDefault(); symbolSearch(e.key.toUpperCase()); }
  });

  /* ---- the SEO text under the workspace follows the language too */
  function pageText() { $$('.pm-head [data-lang], section.pm-about[data-lang]').forEach(function (e) { e.hidden = e.getAttribute('data-lang') !== LANG; }); }

  /* ================================================================ public surface for panels.js and replay.js */
  P.app = {
    T: T, LANG: function () { return LANG; }, RTL: RTL, loc: loc, esc: esc, h: h, $: $, $$: $$, ic: ic, toast: toast, modal: modal, closeModal: closeModal, ask: ask, confirm: confirmBox,
    menu: menu, closeMenu: closeMenu, on: on, emit: emit, st: function () { return st; }, save: save, cells: function () { return cells; }, active: active, setActive: setActive,
    applySym: applySym, fmtT: fmtT, fmtD: fmtD, tzLabel: tzLabel, panels: PANELS, setSide: setSide, DRAW: function () { return DRAW; }, mutate: mutate, removeDrawing: removeDrawing,
    goDate: goDate, tzOffset: tzOffset, indName: indName, tfLabel: tfLabel, download: download, SYM_RE: SYM_RE, debounce: debounce, symbolSearch: function (q) { symbolSearch(q); },
    indDialog: function () { indDialog(); }, indSettings: function (c, x) { indSettings(c, x); },
    langDialog: function () { langDialog(); }, curDialog: function () { curDialog(); }, curLabel: function (c) { return curLabel(c); }
  };

  function boot() {
    if (!$('#pro')) return;
    P.setSaver(st.saver == null ? P.saverAuto : st.saver);
    build(); buildGrid(); pageText(); readShare();
    /* /market/#lang and /market/#cur open the language or currency menu (the bot's «47 languages» button) */
    if (/^#(lang|cur)$/.test(location.hash)) { var mh = location.hash.slice(1); history.replaceState(null, '', location.pathname + location.search); setTimeout(mh === 'lang' ? langDialog : curDialog, 300); }
    /* a chart restored from storage, a file or a link on a coin the site has no logo for moves to BTC; drawings on such
       coins are not kept (the rule above, once the logo index is known) */
    P.logos().then(function (L) {
      if (!L) return;
      /* P.hasLogo asks about the coin of a symbol (BTC_IRT, BTC_EUR → BTC; IR_USD, USDT_EUR → their own icons):
         L.has(symbol) alone sent every toman chart back to BTC on each visit */
      var has = function (s) { return P.hasLogo ? P.hasLogo(s) : L.has(s); };
      var moved = 0, gone = Object.keys(DRAW).filter(function (s) { return !has(s); });
      cells.forEach(function (c) { if (!has(c.cfg.sym)) { c.setSym('BTC'); moved++; } });
      gone.forEach(function (s) { delete DRAW[s]; });
      if (moved || gone.length) { paintTop(); save(); emit('draws'); }
      if (moved) toast(T('noLogo'));
    });
    setInterval(clockTick, 1000); clockTick();
    emit('ready');
    var ld = $('.pm-loading'); if (ld) ld.remove();
  }
  /* start after every deferred script (panels.js, replay.js) has run: DOMContentLoaded only fires after them. A timer
     set from here could fire between two deferred scripts on a slow connection and start without their panels */
  var started = false;
  function start() { if (started) return; started = true; boot(); }
  if (d.readyState === 'complete') setTimeout(start, 0);
  else { d.addEventListener('DOMContentLoaded', start); addEventListener('load', start); }
})();
