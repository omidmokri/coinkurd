/* entekhab.net — the Observatory (/charts/…): derivatives and on-chain charts. Shared core.
   One namespace (window.OB), four languages (assets/obs/i18n.js), no framework.
   Modules: i18n.js · core.js · src.js (exchange data) · liqmodel.js (the liquidation model) · liq.js (heatmap + map view) */
(function () {
  'use strict';
  var w = window, d = document, de = d.documentElement;
  var OB = w.OB = w.OB || {};
  OB.views = OB.views || {};
  OB.V = '2';

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

  /* ================================================================ the shell: tabs of the section + the view */
  /* the pages of the Observatory, in menu order: key, address, icon */
  OB.PAGES = [
    { k: 'liqheat', path: '/charts/liquidation-heatmap/', ic: 'flame' },
    { k: 'liqmap', path: '/charts/liquidation-map/', ic: 'bars' }
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
