/* entekhab.net — the Observatory (/charts/…): derivatives and on-chain charts. Shared core.
   One namespace (window.OB), four languages (assets/obs/i18n.js), no framework.
   Modules: i18n.js · core.js · src.js (exchange data) · liqmodel.js (the liquidation model) · liq.js (heatmap + map view) ·
   ts.js (time-series chart) · deriv.js · optmath.js + opt.js · chainmath.js + chain.js · flowmath.js + flow.js + prem.js */
(function () {
  'use strict';
  var w = window, d = document, de = d.documentElement;
  var OB = w.OB = w.OB || {};
  OB.views = OB.views || {};
  OB.V = '10';

  /* ================================================================ language (the site's keys: ck_lang, ek_ar) */
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function detectLang() {
    var q = /[?&]lang=(fa|ckb|en|ar)\b/.exec(location.search);
    if (q) { try { if (q[1] === 'ar') { localStorage.setItem('ek_ar', '1'); localStorage.setItem('ck_lang', 'en'); } else { localStorage.removeItem('ek_ar'); localStorage.setItem('ck_lang', q[1]); } } catch (e) { } return q[1]; }
    if (ls('ek_ar') === '1') return 'ar';
    var l = ls('ck_lang'); return ['fa', 'ckb', 'en'].indexOf(l) >= 0 ? l : 'fa';
  }
  var LANG = detectLang();
  OB.lang = function () { return LANG; };
  OB.rtl = function () { return LANG !== 'en'; };
  OB.T = function (k, a) { return OB.tr(LANG, k, a); };
  var T = OB.T;
  var DIG = { fa: '۰۱۲۳۴۵۶۷۸۹', ckb: '٠١٢٣٤٥٦٧٨٩', ar: '٠١٢٣٤٥٦٧٨٩' };
  OB.loc = function (s) { var m = DIG[LANG]; return m ? String(s).replace(/\d/g, function (c) { return m[c]; }) : String(s); };
  function docLang() { de.lang = LANG === 'ar' ? 'en' : LANG; de.dir = OB.rtl() ? 'rtl' : 'ltr'; }

  /* ================================================================ helpers */
  OB.$ = function (s, r) { return (r || d).querySelector(s); };
  OB.$$ = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)); };
  OB.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  OB.h = function (html) { var t = d.createElement('template'); t.innerHTML = String(html).trim(); return t.content.firstChild; };
  OB.clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  OB.debounce = function (f, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { f.apply(s, a); }, ms); }; };
  OB.store = {
    get: function (k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } },
    set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  var esc = OB.esc, $ = OB.$;
  var ev = {};
  OB.on = function (n, f) { (ev[n] = ev[n] || []).push(f); };
  OB.off = function (n, f) { var a = ev[n]; if (a && f) { var i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } };
  OB.emit = function (n, x) { (ev[n] || []).slice().forEach(function (f) { try { f(x); } catch (e) { if (w.console) console.error(e); } }); };

  /* fetch JSON with a timeout; `opt.body` makes it a POST */
  OB.getJSON = function (url, ms, opt) {
    var c = w.AbortController ? new AbortController() : null, t = setTimeout(function () { if (c) c.abort(); }, ms || 15000);
    var o = c ? { signal: c.signal } : {};
    if (opt && opt.body) { o.method = 'POST'; o.headers = { 'Content-Type': 'application/json' }; o.body = JSON.stringify(opt.body); }
    return fetch(url, o).then(function (r) { clearTimeout(t); if (!r.ok) { var e = new Error('http ' + r.status); e.status = r.status; throw e; } return r.json(); },
      function (e) { clearTimeout(t); throw e; });
  };
  /* run tasks (functions returning promises) at most `n` at a time, results in order */
  OB.pool = function (tasks, n) {
    return new Promise(function (ok, no) {
      var out = new Array(tasks.length), i = 0, live = 0, dead = false;
      if (!tasks.length) return ok(out);
      function next() {
        if (dead) return;
        if (i >= tasks.length) { if (!live) ok(out); return; }
        var k = i++; live++;
        tasks[k]().then(function (v) { out[k] = v; live--; next(); }, function (e) { dead = true; no(e); });
        if (live < n) next();
      }
      next();
    });
  };

  /* ================================================================ numbers and dates (Latin digits inside charts, like the rest of the site) */
  OB.fmtP = function (p) {
    if (p == null || !isFinite(p)) return '—';
    var a = Math.abs(p), dp = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 4 : a >= 0.01 ? 5 : 0;
    if (!dp && a < 0.01 && a > 0) { dp = Math.min(12, Math.ceil(-Math.log10(a)) + 3); }
    return p.toLocaleString('en-US', { minimumFractionDigits: a >= 1000 ? 0 : Math.min(dp, 2), maximumFractionDigits: dp });
  };
  OB.fmtUsd = function (v, dp) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v), sg = v < 0 ? '-' : '', x = dp == null ? 2 : dp;
    if (a >= 1e12) return sg + '$' + (a / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return sg + '$' + (a / 1e9).toFixed(x) + 'B';
    if (a >= 1e6) return sg + '$' + (a / 1e6).toFixed(a >= 1e8 ? Math.min(x, 1) : x) + 'M';
    if (a >= 1e3) return sg + '$' + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K';
    return sg + '$' + a.toFixed(0);
  };
  OB.fmtPct = function (v, dp) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v), k = dp != null ? dp : a >= 100 ? 0 : a >= 10 ? 1 : 2;
    return (v > 0 ? '+' : v < 0 ? '-' : '') + a.toFixed(k) + '%';
  };
  OB.num = function (s) { return '<span class="ob-n">' + esc(s) + '</span>'; };
  /* a number with its sign or unit inside a right-to-left sentence, kept as one left-to-right piece ("42.3%", not "%42.3") */
  OB.ltr = function (s) { return '\u2066' + s + '\u2069'; };
  var FMT = {};
  var CKB_M = ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەممووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'];
  function two(n) { return (n < 10 ? '0' : '') + n; }
  /* a full date and time in the reader's language and calendar (tooltips, captions) */
  OB.fmtDate = function (ms, withTime) {
    var t = new Date(ms); if (isNaN(t)) return '—';
    if (LANG === 'ckb') return OB.loc(t.getDate() + 'ی ' + CKB_M[t.getMonth()] + (withTime ? '، ' + two(t.getHours()) + ':' + two(t.getMinutes()) : 'ی ' + t.getFullYear()));
    var k = LANG + (withTime ? 't' : 'd');
    if (!FMT[k]) {
      var cal = LANG === 'fa' ? 'fa-IR-u-ca-persian' : LANG === 'ar' ? 'ar' : 'en-GB';
      var o = withTime ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false } : { year: 'numeric', month: 'short', day: 'numeric' };
      try { FMT[k] = new Intl.DateTimeFormat(cal, o); } catch (e) { FMT[k] = new Intl.DateTimeFormat('en-GB', o); }
    }
    return FMT[k].format(t);
  };
  /* short axis labels in Latin digits: the Persian calendar for Persian, Gregorian elsewhere */
  OB.axisDay = function (ms) {
    var k = 'ax' + LANG;
    if (!FMT[k]) {
      try { FMT[k] = LANG === 'fa' ? new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { month: 'numeric', day: 'numeric' }) : new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }); }
      catch (e) { FMT[k] = new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }); }
    }
    return FMT[k].format(new Date(ms));
  };
  OB.axisTime = function (ms) { var t = new Date(ms); return two(t.getHours()) + ':' + two(t.getMinutes()); };
  OB.ago = function (ms) {
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return T('ago_s', { n: OB.loc(s) });
    if (s < 3600) return T('ago_m', { n: OB.loc(Math.round(s / 60)) });
    return T('ago_h', { n: OB.loc(Math.round(s / 3600)) });
  };

  /* ================================================================ logos — the site's rule: no coin without its own logo */
  var LG = { set: null, ready: null };
  OB.loadLogos = function () {
    if (LG.ready) return LG.ready;
    return (LG.ready = OB.getJSON('/data/logos/index.json', 15000).then(function (a) { LG.set = {}; (Array.isArray(a) ? a : []).forEach(function (s) { LG.set[s] = 1; }); return LG.set; }, function () { LG.set = null; return null; }));
  };
  /* null = the index did not load (show every coin, the <img> hides itself on error); false = no logo, hide the coin */
  OB.hasLogo = function (base) { return LG.set ? !!LG.set[base] : null; };
  OB.logo = function (base, px) {
    px = px || 20;
    return '<img class="ob-lg" src="/data/logos/' + esc(base) + '.png" alt="" width="' + px + '" height="' + px + '" loading="lazy" decoding="async" onerror="this.style.visibility=\'hidden\'">';
  };

  /* ================================================================ small UI pieces */
  var IC = {
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>',
    flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.6 1 2.4 2 3 .4-3-.6-6 1-9Z"/>',
    bars: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    gear: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    scale: '<path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7 2.5 13a2.6 2.6 0 0 0 5 0Z"/><path d="m19 7-2.5 6a2.6 2.6 0 0 0 5 0Z"/><path d="M8 21h8"/>',
    opt: '<path d="M3 17c4 0 5-10 9-10s5 10 9 10"/><path d="M12 4v16"/>',
    chain: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    bank: '<path d="m3 9 9-5 9 5"/><path d="M5 9v9M9.7 9v9M14.3 9v9M19 9v9"/><path d="M3 20h18"/>',
    pulse: '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
    cycle: '<path d="M20 12a8 8 0 0 1-13.7 5.7"/><path d="M4 12a8 8 0 0 1 13.7-5.7"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    updown: '<path d="M3 12h18"/><path d="M7 12V7M12 12V4M17 12V9"/><path d="M7 12v3M12 12v8M17 12v4"/>',
    delta: '<path d="M12 5 4.5 19h15Z"/>',
    spread: '<path d="M3 18h18"/><path d="M3 18c6 0 7-4 9-7s4-5 9-5"/>',
    coins: '<ellipse cx="12" cy="6.5" rx="7" ry="3"/><path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/><path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/>'
  };
  OB.icon = function (n, cls) {
    return '<svg class="ob-ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>';
  };
  var toastT;
  OB.toast = function (msg, ms) {
    var t = d.getElementById('ob-toast');
    if (!t) { t = d.createElement('div'); t.id = 'ob-toast'; t.setAttribute('role', 'status'); d.body.appendChild(t); }
    t.textContent = msg; t.className = 'on'; clearTimeout(toastT); toastT = setTimeout(function () { t.className = ''; }, ms || 3500);
  };
  OB.copy = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    try { var a = d.createElement('textarea'); a.value = text; a.style.position = 'fixed'; a.style.opacity = '0'; d.body.appendChild(a); a.select(); var okc = d.execCommand('copy'); a.remove(); return Promise.resolve(okc); } catch (e) { return Promise.resolve(false); }
  };
  OB.fullscreen = function (el) {
    var on = !el.classList.contains('ob-fs');
    el.classList.toggle('ob-fs', on); de.classList.toggle('ob-nofs-scroll', on);
    OB.emit('resize');
    return on;
  };

  /* ================================================================ toolbar pieces every view uses */
  OB.ui = {};
  /* a row of exclusive buttons; items: [[value, label, title?], …] */
  OB.ui.seg = function (id, items, cur, cls, html) {          /* html: the labels are markup the caller has escaped (a logo and a ticker) */
    return '<div class="ob-seg' + (cls ? ' ' + cls : '') + '" id="' + id + '" role="group">' + items.map(function (it) {
      return '<button type="button" data-v="' + esc(it[0]) + '"' + (String(it[0]) === String(cur) ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + (it[2] ? ' title="' + esc(it[2]) + '"' : '') + '>' + (html ? it[1] : esc(it[1])) + '</button>';
    }).join('') + '</div>';
  };
  OB.ui.setSeg = function (root, id, v) {
    OB.$$('#' + id + ' button', root).forEach(function (b) { var on = b.getAttribute('data-v') === String(v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  };
  OB.ui.coinBtn = function (sym) {
    return '<button type="button" class="ob-coin" id="ob-coin" aria-haspopup="dialog" aria-expanded="false"><span id="ob-coin-l"></span><b id="ob-coin-s">' + esc(sym) + '</b>' + OB.icon('chev') + '</button>';
  };
  OB.ui.coinLabel = function (root, sym) {
    var l = $('#ob-coin-l', root), s = $('#ob-coin-s', root); if (!l) return;
    l.innerHTML = OB.hasLogo(sym) === false ? '' : OB.logo(sym, 20); s.textContent = sym;
  };
  /* refresh · picture · link · full screen */
  OB.ui.acts = function () {
    function b(id, k, ic) { return '<button type="button" class="ob-ib" id="' + id + '" aria-label="' + esc(T(k)) + '" title="' + esc(T(k)) + '">' + OB.icon(ic) + '</button>'; }
    return '<span class="ob-grow"></span><span class="ob-acts">' + b('ob-refresh', 'refresh', 'refresh') + b('ob-png', 'png', 'camera') + b('ob-share', 'share', 'share') + b('ob-full', 'full', 'full') + '</span>';
  };
  OB.ui.share = function (params) {
    var q = new URLSearchParams(); Object.keys(params).forEach(function (k) { if (params[k] != null) q.set(k, params[k]); });
    var url = location.origin + location.pathname + '?' + q.toString();
    if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { navigator.share({ title: d.title, url: url }).catch(function () { }); return; }
    OB.copy(url).then(function (ok) { OB.toast(T(ok ? 'copied' : 'copy_fail')); });
  };
  /* the coin list (every coin with a perpetual on Binance or Bybit and a logo), with search.
     o.current() → the chosen symbol, o.onPick(symbol), o.filter(coin) → false hides a coin */
  OB.ui.pickCoin = function (o) {
    var old = d.getElementById('ob-pick'); if (old) { old.remove(); return; }
    var box = OB.h('<div class="ob-pick" id="ob-pick" role="dialog" aria-label="' + esc(T('coin')) + '"><div class="ob-pick-h"><span class="ob-find">' + OB.icon('search') +
      '<input type="search" id="ob-pq" placeholder="' + esc(T('search_coin')) + '" autocomplete="off" spellcheck="false"></span><button type="button" class="ob-ib ob-sm" id="ob-pc" aria-label="' + esc(T('close')) + '">' + OB.icon('close') + '</button></div><div class="ob-pick-l" id="ob-pl"><div class="ob-wait">…</div></div></div>');
    d.getElementById('ob').appendChild(box);
    var q = $('#ob-pq', box), list = $('#ob-pl', box), all = null, cur = o.current();
    function render() {
      var term = q.value.trim().toUpperCase();
      var rows = (all || []).filter(function (c) { return OB.hasLogo(c.base) !== false && (!o.filter || o.filter(c)) && (!term || c.base.indexOf(term) >= 0); }).slice(0, term ? 80 : 60);
      if (!rows.length) { list.innerHTML = '<div class="ob-wait">' + esc(all ? T('no_coin') : '…') + '</div>'; return; }
      list.innerHTML = rows.map(function (c) {
        return '<button type="button" class="ob-pi' + (c.base === cur ? ' on' : '') + '" data-c="' + esc(c.base) + '">' + OB.logo(c.base, 22) + '<b>' + esc(c.base) + '</b><small>' +
          (c.bn ? 'Binance' : '') + (c.bn && c.by ? ' · ' : '') + (c.by ? 'Bybit' : '') + '</small><span class="ob-n">' + esc(OB.fmtUsd(c.vol, 1)) + '</span></button>';
      }).join('');
    }
    q.addEventListener('input', OB.debounce(render, 80));
    box.addEventListener('click', function (e) {
      if (e.target.closest('#ob-pc')) { box.remove(); return; }
      var b = e.target.closest('.ob-pi'); if (!b) return;
      box.remove(); o.onPick(b.getAttribute('data-c'));
    });
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.remove(); if (e.key === 'Enter') { var f = $('.ob-pi', list); if (f) f.click(); } });
    render(); OB.coins().then(function (c) { all = c; render(); }, function () { list.innerHTML = '<div class="ob-wait ob-err">' + esc(T('err_net')) + '</div>'; });
    setTimeout(function () { try { q.focus(); } catch (e) { } }, 30);
  };

  /* ================================================================ the shell: tabs of the section + the view */
  /* the pages of the Observatory, in menu order: key, address, icon */
  OB.PAGES = [
    { k: 'liqheat', path: '/charts/liquidation-heatmap/', ic: 'flame' },
    { k: 'liqmap', path: '/charts/liquidation-map/', ic: 'bars' },
    { k: 'liqhist', path: '/charts/liquidations/', ic: 'updown' },
    { k: 'hl', path: '/charts/hyperliquid/', ic: 'target' },
    { k: 'oi', path: '/charts/open-interest/', ic: 'layers' },
    { k: 'funding', path: '/charts/funding-rate/', ic: 'percent' },
    { k: 'ls', path: '/charts/long-short/', ic: 'scale' },
    { k: 'cvd', path: '/charts/cvd/', ic: 'delta' },
    { k: 'basis', path: '/charts/basis/', ic: 'spread' },
    { k: 'options', path: '/charts/options/', ic: 'opt' },
    { k: 'mvrv', path: '/charts/mvrv/', ic: 'chain' },
    { k: 'flows', path: '/charts/exchange-flows/', ic: 'bank' },
    { k: 'stables', path: '/charts/stablecoins/', ic: 'coins' },
    { k: 'network', path: '/charts/network/', ic: 'pulse' },
    { k: 'cycle', path: '/charts/bitcoin-cycle/', ic: 'cycle' }
  ];
  var root, cur = null, curKey = null;
  function headText() {
    OB.$$('#ob-main [data-lang]').forEach(function (el) { el.hidden = el.getAttribute('data-lang') !== LANG; });
  }
  function build(key) {
    root = d.getElementById('ob'); if (!root) return;
    var view = OB.views[key];
    var tabs = OB.PAGES.map(function (p) {
      return '<a class="ob-tab' + (p.k === key ? ' on' : '') + '" href="' + p.path + '"' + (p.k === key ? ' aria-current="page"' : '') + '>' + OB.icon(p.ic) + '<span>' + esc(T('tab_' + p.k)) + '</span></a>';
    }).join('');
    root.innerHTML = '<div class="ob-top"><nav class="ob-tabs" aria-label="' + esc(T('nav')) + '">' + tabs + '</nav>' +
      '<a class="ob-all" href="/charts/">' + OB.icon('grid') + '<span>' + esc(T('all')) + '</span></a></div><div class="ob-view" id="ob-view"></div>';
    root.setAttribute('dir', OB.rtl() ? 'rtl' : 'ltr');
    /* on a narrow screen the row of tabs scrolls sideways: bring the page's own tab to the middle */
    var nav = $('.ob-tabs', root), on = $('.ob-tab.on', root);
    if (nav && on) { var ra = on.getBoundingClientRect(), rb = nav.getBoundingClientRect(); nav.scrollLeft += (ra.left + ra.width / 2) - (rb.left + rb.width / 2); }
    curKey = key; cur = null;
    if (view) { cur = view; try { view.mount($('#ob-view', root)); } catch (e) { if (w.console) console.error(e); $('#ob-view', root).innerHTML = '<div class="ob-wait ob-err">' + esc(T('err_view')) + '</div>'; } }
    else $('#ob-view', root).innerHTML = '<div class="ob-wait">…</div>';
  }
  var started = false;
  function start() {
    if (started) return;
    var main = d.getElementById('ob-main'); if (!main) return;
    started = true;
    docLang(); headText();
    var app = !!d.getElementById('ob');            /* the hub (/charts/) is plain text in four languages: no app to build */
    if (app) { OB.loadLogos(); build(main.getAttribute('data-view')); }
    var LGS = d.getElementById('langs');
    if (LGS) LGS.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-l]'); if (!b) return;
      var l = b.getAttribute('data-l'); if (l === 'ar' || LANG === 'ar') return;      /* Arabic is switched by ar.js (it reloads the page) */
      if (['fa', 'ckb', 'en'].indexOf(l) < 0 || l === LANG) return;
      try { localStorage.setItem('ck_lang', l); } catch (er) { }
      LANG = l; FMT = {}; docLang(); headText();
      if (app) { var k = curKey; if (cur && cur.unmount) cur.unmount(); build(k); }
    });
    var rs = OB.debounce(function () { OB.emit('resize'); }, 120);
    w.addEventListener('resize', rs);
    d.addEventListener('visibilitychange', function () { OB.emit('visible', !d.hidden); });
  }
  OB.start = start;
  /* the view modules are deferred scripts that load after this one: start once they have all run (DOMContentLoaded),
     never from this script's own turn and never from a timer */
  if (d.readyState === 'complete') start();
  else { d.addEventListener('DOMContentLoaded', start); w.addEventListener('load', start); }
})();
