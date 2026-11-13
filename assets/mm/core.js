/* entekhab.net — the market map: /heatmap/ · /bubbles/ · /money-flow/ · /liquidity/ · /etf/  — shared core.
   Data, in this order (the status chip says which one is on screen):
     1. the site's snapshot data/mm.json (CI every ~15 min: CoinGecko top 250 + Binance klines) — shown at once;
     2. live: Binance public data in the browser — the rolling-window ticker of the chosen timeframe, asked again every
        10–30 s (one request per 100 coins). Prices, market caps (price × circulating supply) and changes move live;
        30-day and 1-year changes are measured from the snapshot's reference price (snapshot price ÷ (1 + change)).
   Coins Binance does not list keep their snapshot values; a value no source gave is "—", never guessed.
   Every coin is drawn with its own logo (the site's rule): one WebP sheet, data/logos/atlas.webp.
   Modules: i18n.js (four languages) · core.js · heat.js · bubbles.js · space3d.js · panel.js · flow.js · liq.js · etf.js */
(function () {
  'use strict';
  var w = window, d = document, de = d.documentElement;
  var MM = w.MM = w.MM || {};
  MM.views = MM.views || {};
  var ASSET_V = '3';
  var API = 'https://data-api.binance.vision/api/v3/';
  MM.API = API;
  MM.WS = 'wss://data-stream.binance.vision/stream';

  /* ================================================================ language */
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function detectLang() {
    var q = /[?&]lang=(fa|ckb|en|ar)\b/.exec(location.search);
    if (q) { try { if (q[1] === 'ar') { localStorage.setItem('ek_ar', '1'); localStorage.setItem('ck_lang', 'en'); } else { localStorage.removeItem('ek_ar'); localStorage.setItem('ck_lang', q[1]); } } catch (e) { } return q[1]; }
    if (ls('ek_ar') === '1') return 'ar';
    var l = ls('ck_lang'); return ['fa', 'ckb', 'en'].indexOf(l) >= 0 ? l : 'fa';
  }
  var LANG = detectLang();
  MM.lang = function () { return LANG; };
  MM.rtl = function () { return LANG !== 'en'; };
  MM.T = function (k, a) { return MM.tr(LANG, k, a); };
  var T = MM.T;
  var DIG = { fa: '۰۱۲۳۴۵۶۷۸۹', ckb: '٠١٢٣٤٥٦٧٨٩', ar: '٠١٢٣٤٥٦٧٨٩' };
  MM.loc = function (s) { var m = DIG[LANG]; return m ? String(s).replace(/\d/g, function (c) { return m[c]; }) : String(s); };

  /* ================================================================ tiny helpers */
  MM.$ = function (s, r) { return (r || d).querySelector(s); };
  MM.$$ = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)); };
  MM.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  MM.h = function (html) { var t = d.createElement('template'); t.innerHTML = String(html).trim(); return t.content.firstChild; };
  MM.clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  MM.debounce = function (f, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { f.apply(s, a); }, ms); }; };
  MM.store = {
    get: function (k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } },
    set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  var esc = MM.esc, h = MM.h, $ = MM.$, $$ = MM.$$;
  var ev = {};
  MM.on = function (n, f) { (ev[n] = ev[n] || []).push(f); };
  MM.off = function (n, f) { var a = ev[n]; if (a) { var i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } };
  MM.emit = function (n, x) { (ev[n] || []).slice().forEach(function (f) { try { f(x); } catch (e) { if (w.console) console.error(e); } }); };
  MM.getJSON = function (url, ms) {
    var c = w.AbortController ? new AbortController() : null, t = setTimeout(function () { if (c) c.abort(); }, ms || 12000);
    return fetch(url, c ? { signal: c.signal } : {}).then(function (r) { clearTimeout(t); if (!r.ok) { var e = new Error('http ' + r.status); e.status = r.status; throw e; } return r.json(); },
      function (e) { clearTimeout(t); throw e; });
  };
  MM.loadScript = function (src) {
    MM._sc = MM._sc || {};
    if (MM._sc[src]) return MM._sc[src];
    return (MM._sc[src] = new Promise(function (ok, no) {
      var s = d.createElement('script'); s.src = src; s.async = true; s.onload = function () { ok(); }; s.onerror = function () { delete MM._sc[src]; no(new Error('script ' + src)); }; d.head.appendChild(s);
    }));
  };
  MM.asset = function (name) { return '/assets/mm/' + name + '?v=' + ASSET_V; };

  /* ================================================================ timeframes */
  MM.TFS = ['5m', '15m', '1h', '2h', '4h', '1d', '7d', '30d', '1y'];
  /* Binance's rolling-window ticker covers 1 minute to 7 days; 30 days and a year come from the snapshot reference price */
  MM.WIN = { '5m': '5m', '15m': '15m', '1h': '1h', '2h': '2h', '4h': '4h', '1d': '1d', '7d': '7d', '30d': '1d', '1y': '1d' };
  MM.TFLBL = { '5m': '5m', '15m': '15m', '1h': '1h', '2h': '2h', '4h': '4h', '1d': '1D', '7d': '1W', '30d': '1M', '1y': '1Y' };
  /* the change at which a tile reaches its strongest colour: a 1 % move in five minutes is as big as 8 % in a day */
  MM.SAT = { '5m': 1, '15m': 1.6, '1h': 2.5, '2h': 3.5, '4h': 5, '1d': 8, '7d': 15, '30d': 25, '1y': 80 };
  MM.POLL = { '5m': 10, '15m': 12, '1h': 20, '2h': 20, '4h': 20, '1d': 30, '7d': 30, '30d': 30, '1y': 30 };

  /* ================================================================ settings (this browser only) */
  var DEF = { tf: '1d', pal: 'rg', saver: false, wrapped: false,
    size: { heatmap: 'mc', bubbles: 'ch' }, top: { heatmap: 100, bubbles: 0, flow: 100 }, stable: { heatmap: true, bubbles: false },
    show: 'all', d3: { heatmap: false, bubbles: false }, hide: [], group: true };
  var S = MM.S = (function () {
    var s = MM.store.get('ek_mm', null) || {};
    var o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (s[k] != null) { if (typeof o[k] === 'object' && !Array.isArray(o[k]) && typeof s[k] === 'object') Object.keys(s[k]).forEach(function (j) { o[k][j] = s[k][j]; }); else o[k] = s[k]; } });
    return o;
  })();
  MM.save = MM.debounce(function () { MM.store.set('ek_mm', S); }, 250);
  /* a shared link (?tf=1h&size=v&top=150&d3=1) opens with those settings without overwriting the saved ones */
  (function () {
    var q = new URLSearchParams(location.search);
    if (MM.TFS.indexOf(q.get('tf')) >= 0) S.tf = q.get('tf');
  })();
  MM.watch = {
    K: 'ek_watch',
    all: function () { var a = MM.store.get('ek_watch', []); return Array.isArray(a) ? a.filter(function (x) { return /^[A-Z0-9]{1,12}$/.test(x); }) : []; },
    has: function (s) { return this.all().indexOf(s) >= 0; },
    toggle: function (s) { var a = this.all(), i = a.indexOf(s); if (i >= 0) a.splice(i, 1); else a.push(s); MM.store.set('ek_watch', a.slice(-20)); MM.emit('watch'); return i < 0; }
  };

  /* ================================================================ number formats (Latin digits in charts, like the live desk) */
  MM.fmtP = function (p) {
    if (p == null || !isFinite(p)) return '—';
    var a = Math.abs(p), dp = a >= 1000 ? 2 : a >= 100 ? 2 : a >= 1 ? 3 : a >= 0.1 ? 4 : a >= 0.01 ? 5 : 0;
    if (!dp && a < 0.01) { var z = Math.ceil(-Math.log10(a)); dp = Math.min(12, z + 3); }
    var s = p.toLocaleString('en-US', { minimumFractionDigits: a >= 1000 ? 0 : Math.min(dp, 2), maximumFractionDigits: a >= 10000 ? 0 : dp });
    return '$' + s;
  };
  MM.fmtUsd = function (v, dp) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v), sg = v < 0 ? '-' : '', x = dp == null ? 1 : dp;
    if (a >= 1e12) return sg + '$' + (a / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return sg + '$' + (a / 1e9).toFixed(a >= 1e11 ? 0 : x + (a < 1e10 ? 1 : 0)) + 'B';
    if (a >= 1e6) return sg + '$' + (a / 1e6).toFixed(a >= 1e8 ? 0 : x) + 'M';
    if (a >= 1e3) return sg + '$' + (a / 1e3).toFixed(a >= 1e5 ? 0 : x) + 'K';
    return sg + '$' + a.toFixed(0);
  };
  MM.fmtSigned = function (v) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '-' : '') + MM.fmtUsd(Math.abs(v)); };
  MM.fmtPct = function (v, dp) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v), k = dp != null ? dp : a >= 100 ? 0 : a >= 10 ? 1 : 2;
    return (v > 0 ? '+' : v < 0 ? '-' : '') + a.toFixed(k) + '%';
  };
  MM.fmtQty = function (v) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(2) + 'T'; if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    return v.toLocaleString('en-US', { maximumFractionDigits: a >= 100 ? 0 : 2 });
  };
  MM.num = function (s) { return '<span class="mm-n">' + esc(s) + '</span>'; };
  MM.cls = function (v) { return v == null || !isFinite(v) ? '' : v > 0 ? 'up' : v < 0 ? 'dn' : ''; };
  /* charts are laid out in real pixels (1 SVG unit = 1 CSS px) so their text stays readable on phones:
     a view renders a placeholder, measures it, and re-renders when its width changes */
  /* SVG <text> that reads correctly in every language. Chart geometry is always left-to-right, so in Persian,
     Sorani and Arabic the text itself gets direction:rtl and its anchor is mirrored (the box stays where it was);
     numbers inside such a label go through MM.ltr() so their sign and digits keep their order. Pure numbers need neither. */
  MM.ltr = function (s) { return '\u2066' + s + '\u2069'; };
  MM.svgText = function (x, y, anchor, cls, txt, o) {
    o = o || {};
    var rtl = MM.rtl(), a = anchor || 'start', st = (rtl ? 'direction:rtl;unicode-bidi:embed;' : '') + (o.fs ? 'font-size:' + o.fs + 'px;' : '');
    if (rtl) a = a === 'start' ? 'end' : a === 'end' ? 'start' : a;
    return '<text x="' + x + '" y="' + y + '" text-anchor="' + a + '"' + (cls ? ' class="' + cls + '"' : '') + (st ? ' style="' + st + '"' : '') + (o.attrs || '') + '>' + MM.esc(txt) + '</text>';
  };
  MM.slot = function (k) { return '<div class="mm-slot" data-slot="' + k + '"></div>'; };
  MM.fill = function (box, k, fn) { var el = box && box.querySelector('[data-slot="' + k + '"]'); if (el) el.innerHTML = fn(Math.max(280, Math.floor(el.clientWidth || 600))); };
  MM.watchWidth = function (el, cb) {
    var w = el.clientWidth, fire = MM.debounce(function () { var n = el.clientWidth; if (n && Math.abs(n - w) >= 8) { w = n; cb(); } }, 140);
    if (window.ResizeObserver) { var ro = new ResizeObserver(fire); ro.observe(el); return function () { ro.disconnect(); }; }
    window.addEventListener('resize', fire);
    return function () { window.removeEventListener('resize', fire); };
  };
  var FMTD = {};
  /* Sorani has no reliable Intl locale: the site's own month names (scripts/build_reality.py CKB_M), Arabic-Indic digits */
  var CKB_M = ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەممووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'];
  MM.fmtDate = function (iso, withTime) {
    if (!iso) return '—';
    var t = typeof iso === 'number' ? new Date(iso) : new Date(String(iso).length === 10 ? iso + 'T00:00:00Z' : iso);
    if (isNaN(t)) return '—';
    if (LANG === 'ckb') {
      var day = String(iso).length === 10;
      var s = (day ? t.getUTCDate() : t.getDate()) + 'ی ' + CKB_M[day ? t.getUTCMonth() : t.getMonth()] + 'ی ' + (day ? t.getUTCFullYear() : t.getFullYear());
      if (withTime && !day) s += '، ' + ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
      return MM.loc(s);
    }
    var k = LANG + (withTime ? 't' : 'd');
    if (!FMTD[k]) {
      var cal = LANG === 'fa' ? 'fa-IR-u-ca-persian' : LANG === 'ar' ? 'ar' : 'en-GB';
      var o = withTime ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { year: 'numeric', month: 'short', day: 'numeric' };
      try { FMTD[k] = new Intl.DateTimeFormat(cal, o); } catch (e) { FMTD[k] = new Intl.DateTimeFormat('en-GB', o); }
    }
    return FMTD[k].format(t);
  };
  MM.ago = function (ms) {
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return T('ago_s', { n: MM.loc(s) });
    if (s < 3600) return T('ago_m', { n: MM.loc(Math.round(s / 60)) });
    if (s < 86400 * 2) return T('ago_h', { n: MM.loc(Math.round(s / 3600)) });
    return T('ago_d', { n: MM.loc(Math.round(s / 86400)) });
  };

  /* ================================================================ colours */
  var RAMP = {
    rg: { up: [[0, 42, 46, 53], [0.18, 30, 78, 58], [0.45, 22, 122, 74], [0.75, 22, 163, 74], [1, 34, 197, 94]],
      dn: [[0, 42, 46, 53], [0.18, 92, 42, 47], [0.45, 155, 44, 51], [0.75, 217, 58, 64], [1, 255, 77, 79]] },
    by: { up: [[0, 42, 46, 53], [0.18, 30, 58, 95], [0.45, 37, 99, 235], [0.75, 59, 130, 246], [1, 96, 165, 250]],
      dn: [[0, 42, 46, 53], [0.18, 92, 58, 18], [0.45, 180, 100, 6], [0.75, 217, 119, 6], [1, 251, 191, 36]] }
  };
  function ramp(stops, x) {
    for (var i = 1; i < stops.length; i++) {
      if (x <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], t = (x - a[0]) / (b[0] - a[0]);
        return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
      }
    }
    var l = stops[stops.length - 1]; return [l[1], l[2], l[3]];
  }
  /* change -> [r,g,b] on the timeframe's scale; null change -> neutral grey */
  MM.rgb = function (chg, tf) {
    if (chg == null || !isFinite(chg)) return [52, 54, 60];
    var x = MM.clamp(chg / (MM.SAT[tf || S.tf] || 8), -1, 1), R = RAMP[S.pal] || RAMP.rg;
    return ramp(x >= 0 ? R.up : R.dn, Math.abs(x));
  };
  MM.css = function (c, a) { return a == null ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')' : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; };
  MM.upc = function () { return S.pal === 'by' ? '#60a5fa' : '#34d399'; };
  MM.dnc = function () { return S.pal === 'by' ? '#fbbf24' : '#ff5a4d'; };
  MM.sideColor = function (v) { return v > 0 ? MM.upc() : v < 0 ? MM.dnc() : '#9a9a94'; };

  /* ================================================================ sectors */
  MM.SECTORS = ['btc', 'l1', 'defi', 'l2', 'ai', 'meme', 'rwa', 'exch', 'infra', 'game', 'privacy', 'other', 'stable', 'wrapped'];
  MM.SECC = { btc: '#f7931a', l1: '#8b5cf6', defi: '#22d3ee', l2: '#60a5fa', ai: '#f472b6', meme: '#facc15', rwa: '#d6a756', exch: '#fb923c',
    infra: '#4ade80', game: '#c084fc', privacy: '#94a3b8', other: '#a1a1aa', stable: '#2dd4bf', wrapped: '#71717a' };
  MM.secName = function (k) { return T('sec_' + k); };

  /* ================================================================ data */
  var D = MM.D = { coins: [], by: {}, t: null, g: {}, fng: null, ok: false, live: { src: 'snap', at: 0, err: null, win: null } };
  function prep(j) {
    var tfs = j.tf || MM.TFS, out = [], by = {};
    (j.c || []).forEach(function (c) {
      if (!c || !/^[A-Z0-9]{1,12}$/.test(c.s)) return;
      var o = { s: c.s, n: c.n || c.s, id: c.id, r: c.r, sec: MM.SECC[c.sec] ? c.sec : 'other', p: c.p, p0: c.p, mc: c.mc, mc0: c.mc, fd: c.fd, v: c.v, cs: c.cs, ts: c.ts, ms: c.ms,
        ath: c.ath, athd: c.athd, atl: c.atl, atld: c.atld, bn: c.bn || null, sp: c.sp, ek: !!c.ek, pg: !!c.pg, dn: !!c.dn, ch: {}, ch0: {}, ref: {}, fl: 0, fx: 0 };
      tfs.forEach(function (tf, i) {
        var v = c.ch ? c.ch[i] : null; v = v == null || !isFinite(v) ? null : +v;
        o.ch[tf] = v; o.ch0[tf] = v;
        if (v != null && c.p > 0 && v > -100) o.ref[tf] = c.p / (1 + v / 100);
      });
      out.push(o); by[o.s] = o;
    });
    out.sort(function (a, b) { return (b.mc || 0) - (a.mc || 0); });
    out.forEach(function (c, i) { c.rk = i + 1; });
    return { coins: out, by: by };
  }
  MM.load = function () {
    var v = Math.floor(Date.now() / 300000);
    return MM.getJSON('/data/mm.json?v=' + v, 20000).then(function (j) {
      var p = prep(j);
      if (D.ok) {          /* a newer snapshot: keep live prices, take everything else */
        p.coins.forEach(function (c) { var o = D.by[c.s]; if (o && D.live.src === 'live' && o.bn) { c.p = o.p; liveMc(c); MM.TFS.forEach(function (tf) { if (D.live.win === MM.WIN[tf] || tf === '30d' || tf === '1y') c.ch[tf] = o.ch[tf]; }); } });
      }
      D.coins = p.coins; D.by = p.by; D.t = j.t; D.g = j.g || {}; D.fng = j.fng; D.cats_t = j.cats_t; D.ok = true;
      MM.emit('data', 'snapshot');
      return D;
    });
  };
  MM.loadFlow = function () {
    if (MM._fl) return MM._fl;
    return (MM._fl = MM.getJSON('/data/mm_flow.json?v=' + Math.floor(Date.now() / 300000), 20000).then(function (j) { D.flow = j; return j; }, function (e) { MM._fl = null; throw e; }));
  };
  function liveMc(c) {
    if (!(c.p > 0)) return;
    if (c.cs > 0) c.mc = c.p * c.cs; else if (c.mc0 && c.p0) c.mc = c.mc0 * c.p / c.p0;
  }
  MM.chg = function (c, tf) { return c.ch[tf || S.tf]; };

  /* the coins a map view shows, in market-cap order */
  MM.pick = function (view, opt) {
    opt = opt || {};
    var stable = opt.stable != null ? opt.stable : (S.stable[view] != null ? S.stable[view] : true), show = S.show, wl = show === 'watch' ? MM.watch.all() : null, tf = S.tf;
    var hide = {}; (S.hide || []).forEach(function (k) { hide[k] = 1; });
    var a = D.coins.filter(function (c) {
      if (c.sec === 'wrapped' && !S.wrapped) return false;
      if (c.sec === 'stable' && !stable) return false;
      if (hide[c.sec]) return false;
      return true;
    });
    if (opt.range) a = a.slice(opt.range[0], opt.range[1]);
    else if (opt.top) a = a.slice(0, opt.top);
    if (wl) a = a.filter(function (c) { return wl.indexOf(c.s) >= 0; });
    if (show === 'up') a = a.filter(function (c) { var v = c.ch[tf]; return v != null && v > 0; });
    if (show === 'dn') a = a.filter(function (c) { var v = c.ch[tf]; return v != null && v < 0; });
    return a;
  };

  /* ================================================================ live updates (Binance rolling-window ticker) */
  var L = { timer: null, busy: false, fails: 0, last: 0 };
  MM.saver = function () {
    var c = navigator.connection || {};
    return !!(S.saver || c.saveData || /2g/.test(c.effectiveType || ''));
  };
  function chunk(a, n) { var o = []; for (var i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
  function poll() {
    clearTimeout(L.timer);
    if (!D.ok) return;
    if (MM.saver()) { D.live.src = 'saver'; MM.emit('status'); return; }
    if (d.hidden) return;
    if (L.busy) return;
    var tf = S.tf, win = MM.WIN[tf], syms = D.coins.filter(function (c) { return c.bn; }).map(function (c) { return c.bn; });
    if (!syms.length) return;
    L.busy = true;
    var reqs = chunk(syms, 100).map(function (part) {
      return MM.getJSON(API + 'ticker?type=MINI&windowSize=' + win + '&symbols=' + encodeURIComponent(JSON.stringify(part)), 15000);
    });
    Promise.all(reqs).then(function (parts) {
      var map = {}; parts.forEach(function (rows) { (Array.isArray(rows) ? rows : []).forEach(function (r) { if (r && r.symbol) map[r.symbol] = r; }); });
      var moved = 0;
      D.coins.forEach(function (c) {
        var r = c.bn && map[c.bn]; if (!r) return;
        var last = +r.lastPrice, open = +r.openPrice;
        if (!(last > 0)) return;
        var prev = c.p;
        c.p = last; liveMc(c);
        if (open > 0) c.ch[tf === '30d' || tf === '1y' ? '1d' : tf] = (last / open - 1) * 100;
        if (win === '1d' && +r.quoteVolume > 0) c.bv = +r.quoteVolume;          /* Binance volume (CoinGecko's v stays the market total) */
        ['30d', '1y'].forEach(function (k) { if (c.ref[k] > 0) c.ch[k] = (last / c.ref[k] - 1) * 100; });
        if (prev && last !== prev) { c.fx = last > prev ? 1 : -1; c.fl = Date.now(); moved++; }
      });
      D.live.src = 'live'; D.live.at = Date.now(); D.live.err = null; D.live.win = win; L.fails = 0;
      MM.emit('data', 'live');
    }, function (e) {
      L.fails++; D.live.err = String(e && e.message || e);
      if (D.live.src === 'live' && L.fails < 3) { /* keep the last live state for a moment */ } else D.live.src = 'snap';
      MM.emit('status');
    }).then(function () {
      L.busy = false;
      var base = (MM.POLL[S.tf] || 30) * 1000, wait = L.fails ? Math.min(180000, base * Math.pow(2, L.fails)) : base;
      clearTimeout(L.timer); L.timer = setTimeout(poll, wait);
    });
  }
  MM.live = { poll: poll, stop: function () { clearTimeout(L.timer); } };
  d.addEventListener('visibilitychange', function () { if (!d.hidden) { poll(); refreshSnap(); } else clearTimeout(L.timer); });
  function refreshSnap() {      /* the snapshot itself is renewed every 5 minutes (it changes every ~15) */
    if (!D.ok || Date.now() - (L.snapAt || 0) < 300000) return;
    L.snapAt = Date.now(); MM.load().catch(function () { });
  }
  setInterval(function () { if (!d.hidden) refreshSnap(); }, 60000);

  /* ================================================================ logos (one WebP sheet; files for the few left out) */
  var A = MM.A = { img: null, meta: null, ready: null, one: {} };
  MM.loadAtlas = function () {
    if (A.ready) return A.ready;
    return (A.ready = MM.getJSON('/data/logos/atlas.json', 15000).then(function (m) {
      A.meta = m;
      return new Promise(function (ok) {
        var im = new Image(); im.decoding = 'async';
        im.onload = function () { A.img = im; ok(A); MM.emit('logos'); };
        im.onerror = function () { ok(A); };
        im.src = sheetUrl(m);
      });
    }, function () { return A; }));
  };
  /* the sheet's file name carries its content hash (the service worker keeps pictures by path) */
  function sheetUrl(m) { return '/data/logos/' + (m && /^atlas-[0-9a-f]{12}\.webp$/.test(m.img || '') ? m.img : 'atlas.webp?s=' + encodeURIComponent((m && m.sig) || '1')); }
  function oneLogo(s) {
    var o = A.one[s]; if (o) return o.ok ? o.im : null;
    o = A.one[s] = { im: new Image(), ok: false };
    o.im.onload = function () { o.ok = true; MM.emit('logos'); };
    o.im.src = '/data/logos/' + s + '.png';
    return null;
  }
  /* draw a coin's logo centred at (x, y), `size` px wide; false when it is not loaded yet */
  MM.drawLogo = function (ctx, s, x, y, size) {
    var m = A.meta, i = m && m.i ? m.i[s] : null;
    if (A.img && i != null) {
      var cell = m.cell, cols = m.cols;
      ctx.drawImage(A.img, (i % cols) * cell, Math.floor(i / cols) * cell, cell, cell, x - size / 2, y - size / 2, size, size);
      return true;
    }
    var im = oneLogo(s); if (im) { ctx.drawImage(im, x - size / 2, y - size / 2, size, size); return true; }
    return false;
  };
  /* the same logo as an HTML element (CSS sprite from the sheet; its own file for the few left out) */
  MM.logo = function (s, px) {
    px = px || 22;
    var m = A.meta, i = m && m.i ? m.i[s] : null;
    if (m && i != null) {
      var k = px / m.cell, cols = m.cols, rows = Math.ceil(m.n / cols);
      return '<i class="mm-lg" aria-hidden="true" style="width:' + px + 'px;height:' + px + 'px;background-image:url(' + esc(sheetUrl(m)) + ');background-size:' + (cols * m.cell * k).toFixed(1) + 'px ' + (rows * m.cell * k).toFixed(1) + 'px;background-position:-' + ((i % cols) * m.cell * k).toFixed(1) + 'px -' + (Math.floor(i / cols) * m.cell * k).toFixed(1) + 'px"></i>';
    }
    return '<img class="mm-lg" src="/data/logos/' + esc(s) + '.png" alt="" width="' + px + '" height="' + px + '" loading="lazy" decoding="async">';
  };

  /* ================================================================ market totals for the stats strip */
  MM.totals = function (coins) {
    var tf = S.tf, mc = 0, w = 0, up = 0, dn = 0, n = 0;
    coins.forEach(function (c) {
      if (c.sec === 'wrapped') return;
      var v = c.ch[tf]; mc += c.mc || 0;
      if (v != null && c.sec !== 'stable') { n++; if (v > 0) up++; else if (v < 0) dn++; w += (c.mc || 0) * v; }
    });
    var mcm = coins.reduce(function (s, c) { return s + (c.sec !== 'wrapped' && c.sec !== 'stable' && c.ch[tf] != null ? c.mc || 0 : 0); }, 0);
    return { mc: mc, avg: mcm ? w / mcm : null, up: up, dn: dn, n: n };
  };

  /* ================================================================ the shell: tabs, toolbar, stats, stage */
  var VIEWS = [
    { k: 'heatmap', path: '/heatmap/', ic: 'grid', map: 1 }, { k: 'bubbles', path: '/bubbles/', ic: 'bubbles', map: 1 },
    { k: 'flow', path: '/money-flow/', ic: 'flow' }, { k: 'liq', path: '/liquidity/', ic: 'book' }, { k: 'etf', path: '/etf/', ic: 'bank' }];
  MM.VIEWS = VIEWS;
  var IC = {
    grid: '<rect x="3" y="3" width="10" height="11" rx="1.5"/><rect x="15" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="11" width="6" height="10" rx="1.5"/><rect x="3" y="16" width="10" height="5" rx="1.5"/>',
    bubbles: '<circle cx="8.5" cy="9" r="5.5"/><circle cx="17" cy="15.5" r="4"/><circle cx="8" cy="19" r="2"/><circle cx="18" cy="6" r="2"/>',
    flow: '<path d="M3 7h9c3 0 3 5 6 5h3"/><path d="M3 17h9c3 0 3-5 6-5"/><path d="m18 9 3 3-3 3"/>',
    book: '<path d="M4 20V10M8 20V6M12 20v-8"/><path d="M14 20v-5M18 20v-9M22 20V8" opacity=".55"/>',
    bank: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20.5h18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/>', more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>', star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8Z"/>',
    cube: '<path d="M12 2.8 20.5 7.5v9L12 21.2 3.5 16.5v-9Z"/><path d="M12 12 20.5 7.5M12 12v9.2M12 12 3.5 7.5"/>', back: '<path d="M15 5l-7 7 7 7"/>',
    filter: '<path d="M3 5h18l-7 8.5V20l-4-2v-4.5Z"/>', img: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>', ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'
  };
  MM.ic = function (n, cls) { return '<svg class="mm-ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>'; };
  var ic = MM.ic;

  var root, cur = null, curKey = null;
  MM.root = function () { return root; };
  MM.view = function () { return curKey; };

  function tabsHtml() {
    return '<nav class="mm-tabs" role="tablist" aria-label="' + esc(T('views')) + '">' + VIEWS.map(function (v) {
      return '<a role="tab" class="mm-tab" data-v="' + v.k + '" href="' + v.path + '">' + ic(v.ic) + '<span>' + esc(T('v_' + v.k)) + '</span></a>';
    }).join('') + '</nav>';
  }
  function toolsHtml() {
    var tfs = MM.TFS.map(function (tf) { return '<button type="button" class="mm-tf" data-tf="' + tf + '" title="' + esc(T('tfn_' + tf)) + '">' + MM.TFLBL[tf] + '</button>'; }).join('');
    return '<div class="mm-tools">' +
      '<div class="mm-tfs" data-for="map flow etf" role="group" aria-label="' + esc(T('timeframe')) + '">' + tfs + '</div>' +
      '<label class="mm-sel" data-for="heatmap bubbles"><span>' + esc(T('size')) + '</span><select id="mm-size"></select></label>' +
      '<label class="mm-sel" data-for="heatmap"><span>' + esc(T('show_n')) + '</span><select id="mm-top"></select></label>' +
      '<label class="mm-sel" data-for="bubbles"><span>' + esc(T('range')) + '</span><select id="mm-range"></select></label>' +
      '<button type="button" class="mm-btn" id="mm-filter" data-for="heatmap bubbles">' + ic('filter') + '<span>' + esc(T('filter')) + '</span><b class="mm-dot" hidden></b></button>' +
      '<div class="mm-find" data-for="heatmap bubbles">' + ic('search') + '<input id="mm-q" type="search" autocomplete="off" spellcheck="false" placeholder="' + esc(T('find')) + '" aria-label="' + esc(T('find')) + '"></div>' +
      '<div class="mm-grow"></div>' +
      '<div class="mm-seg" data-for="heatmap bubbles" role="group" aria-label="2D / 3D"><button type="button" data-d3="0">2D</button><button type="button" data-d3="1">' + ic('cube') + '3D</button></div>' +
      '<button type="button" class="mm-ib" id="mm-png" data-for="heatmap bubbles" title="' + esc(T('png')) + '" aria-label="' + esc(T('png')) + '">' + ic('img') + '</button>' +
      '<button type="button" class="mm-ib" id="mm-share" title="' + esc(T('share')) + '" aria-label="' + esc(T('share')) + '">' + ic('share') + '</button>' +
      '<button type="button" class="mm-ib" id="mm-fs" data-for="heatmap bubbles liq" title="' + esc(T('fullscreen')) + '" aria-label="' + esc(T('fullscreen')) + '">' + ic('full') + '</button>' +
      '<button type="button" class="mm-ib" id="mm-more" title="' + esc(T('settings')) + '" aria-label="' + esc(T('settings')) + '">' + ic('more') + '</button>' +
      '</div>';
  }
  function statsHtml() {
    return '<div class="mm-stats" aria-live="polite">' +
      '<div class="mm-st"><small>' + esc(T('st_mcap')) + '</small><b id="mm-s-mc">—</b></div>' +
      '<div class="mm-st"><small id="mm-s-avgl">' + esc(T('st_avg')) + '</small><b id="mm-s-avg">—</b></div>' +
      '<div class="mm-st"><small>' + esc(T('st_breadth')) + '</small><b id="mm-s-br">—</b><i class="mm-brbar"><i id="mm-s-brb"></i></i></div>' +
      '<div class="mm-st"><small>' + esc(T('st_vol')) + '</small><b id="mm-s-vol">—</b></div>' +
      '<div class="mm-st"><small>' + esc(T('st_btcd')) + '</small><b id="mm-s-btcd">—</b></div>' +
      '<div class="mm-st"><small>' + esc(T('st_fng')) + '</small><b id="mm-s-fng">—</b></div>' +
      '<button type="button" class="mm-live" id="mm-live" aria-label="' + esc(T('st_about')) + '"><i></i><span></span></button>' +
      '</div>';
  }
  function build(initial) {
    root = d.getElementById('mm'); if (!root) return;
    root.setAttribute('lang', LANG); root.dir = MM.rtl() ? 'rtl' : 'ltr';
    root.classList.add('mm-on');
    root.innerHTML = '<div class="mm-top">' + tabsHtml() + '</div>' + toolsHtml() + statsHtml() +
      '<div class="mm-stage" id="mm-stage"><div class="mm-wait">' + esc(T('loading')) + '</div></div>' +
      '<div class="mm-foot"><div class="mm-legend" id="mm-legend"></div><p class="mm-src" id="mm-src"></p></div>';
    wire();
    switchTo(initial, true);
  }
  function fillSelects() {
    var sz = $('#mm-size', root), tp = $('#mm-top', root), rg = $('#mm-range', root), v = curKey;
    var sizes = v === 'bubbles' ? ['ch', 'mc', 'v', 'fl', 'eq'] : ['mc', 'mcs', 'v', 'ch', 'fl', 'eq'];
    sz.innerHTML = sizes.map(function (k) { return '<option value="' + k + '">' + esc(T('size_' + k)) + '</option>'; }).join('');
    sz.value = S.size[v] || sizes[0];
    var n = D.coins.length || 250;
    tp.innerHTML = [50, 100, 150, 200, 250].filter(function (x, i) { return x <= n || i === 0; }).map(function (x) { return '<option value="' + x + '">' + MM.loc(x) + '</option>'; }).join('');
    tp.value = String(S.top.heatmap || 100); if (!tp.value) tp.value = '100';
    var ranges = []; for (var i = 0; i < Math.max(n, 100); i += 100) ranges.push(i);
    rg.innerHTML = ranges.map(function (a, i) { return '<option value="' + i + '">' + MM.loc((a + 1) + '–' + Math.min(a + 100, Math.max(n, a + 1))) + '</option>'; }).join('');
    rg.value = String(Math.min(S.top.bubbles || 0, ranges.length - 1));
  }
  function syncTools() {
    var v = curKey, def = VIEWS.filter(function (x) { return x.k === v; })[0] || {};
    root.setAttribute('data-view', v);
    $$('[data-for]', root).forEach(function (e) {
      var f = e.getAttribute('data-for').split(' ');
      e.hidden = !(f.indexOf(v) >= 0 || (def.map && f.indexOf('map') >= 0));
    });
    $$('.mm-tab', root).forEach(function (a) { var on = a.getAttribute('data-v') === v; a.classList.toggle('on', on); a.setAttribute('aria-selected', on ? 'true' : 'false'); });
    $$('.mm-tf', root).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tf') === S.tf); });
    $$('.mm-seg [data-d3]', root).forEach(function (b) { b.classList.toggle('on', String(+!!S.d3[v]) === b.getAttribute('data-d3')); });
    $('#mm-filter .mm-dot', root).hidden = !(S.show !== 'all' || S.wrapped || (S.hide || []).length || (S.stable[v] != null && S.stable[v] !== (v === 'heatmap')));
    fillSelects();
    var st = $('.mm-stats', root); st.hidden = !(def.map || v === 'flow');
  }
  MM.syncTools = function () { if (root) syncTools(); };

  function wire() {
    root.addEventListener('click', function (e) {
      var t = e.target.closest('.mm-tab');
      if (t && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) { e.preventDefault(); switchTo(t.getAttribute('data-v')); return; }
      var b = e.target.closest('.mm-tf');
      if (b) { setTf(b.getAttribute('data-tf')); return; }
      var s3 = e.target.closest('.mm-seg [data-d3]');
      if (s3) { S.d3[curKey] = s3.getAttribute('data-d3') === '1'; MM.save(); syncTools(); if (cur && cur.set3d) cur.set3d(S.d3[curKey]); return; }
      if (e.target.closest('#mm-filter')) { filterMenu(e.target.closest('#mm-filter')); return; }
      if (e.target.closest('#mm-more')) { moreMenu(e.target.closest('#mm-more')); return; }
      if (e.target.closest('#mm-png')) { png(); return; }
      if (e.target.closest('#mm-share')) { share(); return; }
      if (e.target.closest('#mm-fs')) { fullscreen(); return; }
      if (e.target.closest('#mm-live')) { MM.toast(statusText(true), 6000); return; }
    });
    $('#mm-size', root).addEventListener('change', function (e) { S.size[curKey] = e.target.value; MM.save(); if (e.target.value === 'fl') MM.loadFlow().then(function () { MM.emit('data', 'flow'); }, function () { }); if (cur && cur.update) cur.update('size'); });
    $('#mm-top', root).addEventListener('change', function (e) { S.top.heatmap = +e.target.value; MM.save(); if (cur && cur.update) cur.update('set'); });
    $('#mm-range', root).addEventListener('change', function (e) { S.top.bubbles = +e.target.value; MM.save(); if (cur && cur.update) cur.update('set'); });
    var q = $('#mm-q', root);
    q.addEventListener('input', MM.debounce(function () { MM.q = q.value.trim().toUpperCase(); if (cur && cur.find) cur.find(MM.q); }, 120));
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var c = findCoin(q.value); if (c) MM.openCoin(c.s); } if (e.key === 'Escape') { q.value = ''; MM.q = ''; if (cur && cur.find) cur.find(''); } });
    w.addEventListener('popstate', function () { var k = viewFromPath(); if (k && k !== curKey) switchTo(k, true); });
    d.addEventListener('keydown', function (e) {
      if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
      if (e.key === '/') { var qq = $('#mm-q', root); if (qq && !qq.closest('[hidden]')) { e.preventDefault(); qq.focus(); } }
      var i = '123456789'.indexOf(e.key); if (i >= 0 && !e.ctrlKey && !e.metaKey && !e.altKey && cur && (curKey === 'heatmap' || curKey === 'bubbles' || curKey === 'flow')) setTf(MM.TFS[i]);
    });
    var LG = d.getElementById('langs');
    if (LG) LG.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-l]'); if (!b) return;
      var l = b.getAttribute('data-l'); if (l === 'ar' || LANG === 'ar') return;      /* Arabic is switched by ar.js (it reloads) */
      if (['fa', 'ckb', 'en'].indexOf(l) < 0 || l === LANG) return;
      try { localStorage.setItem('ck_lang', l); } catch (er) { }
      LANG = l; FMTD = {}; docLang();
      var k = curKey; if (cur && cur.unmount) cur.unmount(); cur = null; curKey = null; MM.closeCoin && MM.closeCoin();
      build(k); pageText();
    });
    MM.on('data', function () { stats(); });
    MM.on('status', function () { stats(); });
    setInterval(function () { if (!d.hidden) status(); }, 5000);
  }
  function findCoin(q) {
    q = String(q || '').trim().toUpperCase(); if (!q) return null;
    return D.by[q] || D.coins.filter(function (c) { return c.s.indexOf(q) === 0 || c.n.toUpperCase().indexOf(q) === 0; })[0] || null;
  }
  MM.findCoin = findCoin;
  function setTf(tf) {
    if (MM.TFS.indexOf(tf) < 0 || tf === S.tf) return;
    S.tf = tf; MM.save(); syncTools();
    /* the snapshot's value is shown at once; the live window arrives with the next request */
    D.coins.forEach(function (c) { if (D.live.win !== MM.WIN[tf] && c.ch[tf] == null) c.ch[tf] = c.ch0[tf]; });
    MM.emit('tf', tf); stats(); legend();
    if (cur && cur.update) cur.update('tf');
    poll();
  }
  MM.setTf = setTf;

  function viewFromPath() {
    var p = location.pathname.replace(/index\.html$/, '');
    var v = VIEWS.filter(function (x) { return x.path === p; })[0];
    return v ? v.k : null;
  }
  function switchTo(k, noPush) {
    if (!VIEWS.some(function (v) { return v.k === k; })) k = 'heatmap';
    if (k === curKey) return;
    if (cur && cur.unmount) cur.unmount();
    cur = null; curKey = k;
    var def = VIEWS.filter(function (v) { return v.k === k; })[0];
    if (!noPush && location.pathname !== def.path) { try { history.pushState({ v: k }, '', def.path + location.search); } catch (e) { } }
    d.title = T('title_' + k) + ' | entekhab.net';
    headText(k);
    syncTools(); legend(); stats();
    var stage = $('#mm-stage', root);
    stage.className = 'mm-stage mm-st-' + k;
    stage.innerHTML = '<div class="mm-wait">' + esc(T('loading')) + '</div>';
    var file = { heatmap: 'heat.js', bubbles: 'bubbles.js', flow: 'flow.js', liq: 'liq.js', etf: 'etf.js' }[k];
    var ready = MM.views[k] ? Promise.resolve() : MM.loadScript(MM.asset(file));
    Promise.all([ready, MM._boot]).then(function () {
      if (curKey !== k) return;
      var V = MM.views[k]; if (!V) throw new Error('view ' + k);
      stage.innerHTML = '';
      cur = V; V.mount(stage);
      MM.emit('view', k);
    }).catch(function (e) {
      if (curKey !== k) return;
      stage.innerHTML = '<div class="mm-wait mm-err">' + esc(T('loadErr')) + '<br><button type="button" class="mm-btn" onclick="location.reload()">' + esc(T('retry')) + '</button></div>';
      if (w.console) console.error(e);
    });
  }
  MM.switchTo = switchTo;
  function headText(k) {
    var h1 = d.querySelector('.mm-head h1'), p = d.querySelector('.mm-head p');
    if (h1) h1.innerHTML = '<span>' + esc(T('title_' + k)) + '</span>';
    if (p) p.innerHTML = '<span>' + esc(T('sub_' + k)) + '</span>';
    var page = d.getElementById('mm-main'), first = page && page.getAttribute('data-view');
    $$('section.mm-about[data-lang]').forEach(function (e) { e.hidden = !(e.getAttribute('data-lang') === LANG && k === first); });
  }
  function pageText() { headText(curKey); }

  function stats() {
    if (!root || !D.ok) { status(); return; }
    var tf = S.tf, set = D.coins.slice(0, 250), t = MM.totals(set);
    var put = function (id, html) { var e = d.getElementById(id); if (e) e.innerHTML = html; };
    put('mm-s-mc', MM.num(MM.fmtUsd(t.mc)));
    put('mm-s-avgl', esc(T('st_avg_tf', { tf: MM.TFLBL[tf] })));
    put('mm-s-avg', t.avg == null ? '—' : '<span class="mm-n ' + MM.cls(t.avg) + '">' + MM.fmtPct(t.avg) + '</span>');
    put('mm-s-br', t.n ? '<span class="up mm-n">' + MM.loc(t.up) + '</span> / <span class="dn mm-n">' + MM.loc(t.dn) + '</span>' : '—');   /* in the label's reading order */
    var bb = d.getElementById('mm-s-brb'); if (bb) { bb.style.width = (t.n ? t.up / t.n * 100 : 50).toFixed(1) + '%'; bb.style.background = MM.upc(); bb.parentNode.style.background = MM.dnc(); }
    put('mm-s-vol', MM.num(MM.fmtUsd(D.g.vol || D.coins.reduce(function (s, c) { return s + (c.sec !== 'wrapped' ? c.v || 0 : 0); }, 0))));
    var btc = D.by.BTC; put('mm-s-btcd', btc && t.mc ? MM.num((btc.mc / t.mc * 100).toFixed(1) + '%') : D.g.btc_d ? MM.num(D.g.btc_d.toFixed(1) + '%') : '—');
    put('mm-s-fng', D.fng && D.fng.v != null ? '<span class="mm-n">' + MM.loc(D.fng.v) + '</span> <small>' + esc(T('fng_' + String(D.fng.k || '').toLowerCase().replace(/\s+/g, '_'))) + '</small>' : '—');
    status();
  }
  function statusText(long) {
    var L2 = D.live, s;
    if (!D.ok) return T('loading');
    if (L2.src === 'live') s = T('st_live', { ago: MM.ago(L2.at) });
    else if (L2.src === 'saver') s = T('st_saver', { ago: MM.ago(Date.parse(D.t)) });
    else s = T('st_snap', { ago: MM.ago(Date.parse(D.t)) });
    if (long) s += ' — ' + T('st_about');
    return s;
  }
  function status() {
    var b = root && $('#mm-live', root); if (!b) return;
    b.className = 'mm-live ' + (D.live.src || 'snap');
    $('span', b).textContent = statusText(false);
    var src = $('#mm-src', root);
    if (src) src.innerHTML = esc(T('src_' + (curKey === 'etf' ? 'etf' : curKey === 'liq' ? 'liq' : curKey === 'flow' ? 'flow' : 'map'))) + ' ' + esc(T('nfa'));
  }
  MM.status = status;
  function legend() {
    var e = root && $('#mm-legend', root); if (!e) return;
    var def = VIEWS.filter(function (v) { return v.k === curKey; })[0] || {};
    if (!def.map) { e.innerHTML = ''; return; }
    var s = MM.SAT[S.tf], stops = [-1, -0.5, 0, 0.5, 1];
    e.innerHTML = '<span>' + esc(T('legend', { tf: T('tfn_' + S.tf) })) + '</span><span class="mm-lgbox"><i class="mm-lgbar" style="background:linear-gradient(90deg,' +
      [-1, -0.75, -0.45, -0.18, 0, 0.18, 0.45, 0.75, 1].map(function (x) { return MM.css(MM.rgb(x * s)); }).join(',') + ')"></i><span class="mm-lgt mm-n">' +
      stops.map(function (x) { return '<b>' + (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x * s) + '%' + (Math.abs(x) === 1 ? (x > 0 ? '+' : '') : '') + '</b>'; }).join('') + '</span></span>';
  }
  MM.legend = legend;

  /* ================================================================ menus, toasts, tooltip */
  var menuEl = null;
  MM.closeMenu = function () { if (menuEl) { menuEl.remove(); menuEl = null; } };
  MM.menu = function (anchor, html, onClick) {
    MM.closeMenu();
    var m = menuEl = h('<div class="mm-menu" translate="no" role="menu" dir="' + (MM.rtl() ? 'rtl' : 'ltr') + '" lang="' + LANG + '">' + html + '</div>');
    d.body.appendChild(m);
    var r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    var x = MM.rtl() ? r.right - mw : r.left; x = MM.clamp(x, 8, innerWidth - mw - 8);
    var y = r.bottom + 6; if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 6);
    m.style.left = x + 'px'; m.style.top = y + 'px';
    m.addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (b) onClick(b.getAttribute('data-m'), b, e); });
    setTimeout(function () {
      d.addEventListener('pointerdown', function off(e) { if (menuEl && !menuEl.contains(e.target) && !anchor.contains(e.target)) { MM.closeMenu(); d.removeEventListener('pointerdown', off, true); } }, true);
    }, 0);
    return m;
  };
  function chk(on) { return '<i class="mm-chk' + (on ? ' on' : '') + '"></i>'; }
  function filterMenu(btn) {
    var v = curKey, st = S.stable[v] != null ? S.stable[v] : true, hide = S.hide || [];
    var html = '<div class="mm-mh">' + esc(T('show')) + '</div>' + ['all', 'up', 'dn', 'watch'].map(function (k) { return '<button type="button" role="menuitemradio" data-m="show:' + k + '">' + chk(S.show === k) + esc(T('f_' + k)) + '</button>'; }).join('') +
      '<div class="mm-mh">' + esc(T('include')) + '</div><button type="button" data-m="stable">' + chk(st) + esc(T('f_stable')) + '</button><button type="button" data-m="wrapped">' + chk(S.wrapped) + esc(T('f_wrapped')) + '</button>' +
      (v === 'heatmap' ? '<button type="button" data-m="group">' + chk(S.group !== false) + esc(T('f_group')) + '</button>' : '') +
      '<div class="mm-mh">' + esc(T('sectors')) + '</div><div class="mm-secs">' + MM.SECTORS.filter(function (k) { return k !== 'stable' && k !== 'wrapped'; }).map(function (k) {
        return '<button type="button" data-m="sec:' + k + '" class="mm-chip' + (hide.indexOf(k) < 0 ? ' on' : '') + '"><i style="background:' + MM.SECC[k] + '"></i>' + esc(MM.secName(k)) + '</button>';
      }).join('') + '</div>';
    var m = MM.menu(btn, html, function (k, b) {
      if (k.indexOf('show:') === 0) S.show = k.slice(5);
      else if (k === 'stable') S.stable[v] = !st;
      else if (k === 'wrapped') S.wrapped = !S.wrapped;
      else if (k === 'group') S.group = S.group === false;
      else if (k.indexOf('sec:') === 0) { var s = k.slice(4), a = (S.hide || []).slice(), i = a.indexOf(s); if (i >= 0) a.splice(i, 1); else a.push(s); S.hide = a; }
      MM.save(); syncTools(); if (cur && cur.update) cur.update('set'); filterMenu(btn);
    });
    m.classList.add('wide');
  }
  function moreMenu(btn) {
    var html = '<div class="mm-mh">' + esc(T('colors')) + '</div><button type="button" data-m="pal:rg">' + chk(S.pal === 'rg') + esc(T('pal_rg')) + '</button><button type="button" data-m="pal:by">' + chk(S.pal === 'by') + esc(T('pal_by')) + '</button>' +
      '<div class="mm-mh">' + esc(T('data')) + '</div><button type="button" data-m="saver">' + chk(S.saver) + esc(T('saver')) + '</button>' +
      '<button type="button" data-m="about">' + ic('info') + esc(T('how')) + '</button>';
    MM.menu(btn, html, function (k) {
      if (k.indexOf('pal:') === 0) { S.pal = k.slice(4); MM.save(); legend(); stats(); MM.emit('palette'); if (cur && cur.update) cur.update('pal'); }
      else if (k === 'saver') { S.saver = !S.saver; MM.save(); if (!MM.saver()) { D.live.src = 'snap'; poll(); } else { clearTimeout(L.timer); D.live.src = 'saver'; } status(); }
      else if (k === 'about') { MM.closeMenu(); var a = d.querySelector('section.mm-about:not([hidden])') || d.querySelector('.mm-howto'); if (a) a.scrollIntoView({ behavior: 'smooth' }); else MM.toast(T('st_about'), 7000); return; }
      moreMenu(btn);
    });
  }
  var toastT;
  MM.toast = function (msg, ms) {
    var t = $('.mm-toast'); if (!t) { t = h('<div class="mm-toast" translate="no" role="status"></div>'); d.body.appendChild(t); }
    t.textContent = msg; t.dir = MM.rtl() ? 'rtl' : 'ltr'; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, ms || 2600);
  };
  var tip;
  MM.tip = function (html, x, y) {
    if (!tip) { tip = h('<div class="mm-tip" translate="no" role="tooltip"></div>'); d.body.appendChild(tip); }
    if (html == null) { tip.classList.remove('on'); return; }
    tip.innerHTML = html; tip.dir = MM.rtl() ? 'rtl' : 'ltr'; tip.lang = LANG; tip.classList.add('on');
    var tw = tip.offsetWidth, th = tip.offsetHeight, px = x + 16, py = y + 16;
    if (px + tw > innerWidth - 8) px = x - tw - 16; if (px < 8) px = 8;
    if (py + th > innerHeight - 8) py = y - th - 16; if (py < 8) py = 8;
    tip.style.transform = 'translate(' + px + 'px,' + py + 'px)';
  };
  /* the hover card of a coin (heatmap and bubbles) */
  MM.coinTip = function (c) {
    var tf = S.tf, ch = c.ch[tf], rows = MM.TFS.map(function (k) {
      var v = c.ch[k];
      return '<span class="' + (k === tf ? 'on ' : '') + MM.cls(v) + '"><small>' + MM.TFLBL[k] + '</small><b class="mm-n">' + MM.fmtPct(v) + '</b></span>';
    }).join('');
    return '<div class="mm-th">' + MM.logo(c.s, 30) + '<div><b>' + esc(c.n) + '</b><small>' + esc(c.s) + ' · #' + MM.loc(c.rk) + ' · ' + esc(MM.secName(c.sec)) + '</small></div>' +
      '<div class="mm-tp"><b class="mm-n">' + MM.fmtP(c.p) + '</b><small class="mm-n ' + MM.cls(ch) + '">' + MM.fmtPct(ch) + '</small></div></div>' +
      (c.sp ? '<div class="mm-tsp">' + MM.spark(c, 260, 44) + '<small>' + esc(T('spark7')) + '</small></div>' : '') +
      '<div class="mm-tg">' + rows + '</div>' +
      '<div class="mm-tk"><span><small>' + esc(T('mcap')) + '</small><b class="mm-n">' + MM.fmtUsd(c.mc) + '</b></span><span><small>' + esc(T('vol24')) + '</small><b class="mm-n">' + MM.fmtUsd(c.v) + '</b></span>' +
      '<span><small>' + esc(T('fromAth')) + '</small><b class="mm-n">' + (c.ath && c.p ? MM.fmtPct((c.p / c.ath - 1) * 100) : '—') + '</b></span></div>' +
      '<p class="mm-thint">' + esc(T(c.bn ? (D.live.src === 'live' ? 'tip_live' : 'tip_snap') : 'tip_nobn')) + ' · ' + esc(T('tip_click')) + '</p>';
  };
  /* the 7-day line (CoinGecko, every 4 h) as inline SVG */
  MM.spark = function (c, wpx, hpx) {
    var s = c.sp; if (!s || !s[2] || s[2].length < 2) return '';
    var a = s[2], n = a.length, up = a[n - 1] >= a[0], col = up ? MM.upc() : MM.dnc();
    var pts = a.map(function (v, i) { return (i / (n - 1) * wpx).toFixed(1) + ',' + ((1 - v / 99) * (hpx - 4) + 2).toFixed(1); }).join(' ');
    var id = 'g' + c.s + (Math.random() * 1e6 | 0);
    return '<svg class="mm-spk" viewBox="0 0 ' + wpx + ' ' + hpx + '" width="' + wpx + '" height="' + hpx + '" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".35"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' +
      '<polygon points="0,' + hpx + ' ' + pts + ' ' + wpx + ',' + hpx + '" fill="url(#' + id + ')"/><polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';
  };

  /* ================================================================ picture, share link, full screen */
  function png() {
    if (!cur || !cur.canvas) { MM.toast(T('pngNo')); return; }
    var src = cur.canvas(); if (!src) { MM.toast(T('pngNo')); return; }
    var W = src.width, H = src.height, k = W / src.clientWidth || 1, pad = Math.round(54 * k);
    var c = d.createElement('canvas'); c.width = W; c.height = H + pad;
    var x = c.getContext('2d');
    x.fillStyle = '#0b0b0c'; x.fillRect(0, 0, c.width, c.height);
    try { x.drawImage(src, 0, 0); } catch (e) { MM.toast(T('pngNo')); return; }
    x.fillStyle = '#f7931a'; x.font = '700 ' + Math.round(18 * k) + 'px "Space Grotesk",Vazirmatn,sans-serif'; x.textBaseline = 'middle';
    x.direction = 'ltr'; x.textAlign = 'left';
    x.fillText('entekhab.net', Math.round(14 * k), H + pad / 2);
    x.fillStyle = '#c9c9c4'; x.font = '500 ' + Math.round(14 * k) + 'px Vazirmatn,sans-serif'; x.textAlign = 'right';
    var when = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    x.fillText(T('v_' + curKey) + ' · ' + MM.TFLBL[S.tf] + ' · ' + when, c.width - Math.round(14 * k), H + pad / 2);
    c.toBlob(function (b) {
      if (!b) { MM.toast(T('pngNo')); return; }
      var a = d.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'entekhab-' + curKey + '-' + S.tf + '-' + Date.now() + '.png';
      d.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      MM.toast(T('pngDone'));
    }, 'image/png');
  }
  function share() {
    var def = VIEWS.filter(function (v) { return v.k === curKey; })[0], q = new URLSearchParams();
    if (def.map || curKey === 'flow') q.set('tf', S.tf);
    if (LANG !== 'fa') q.set('lang', LANG);
    var url = location.origin + def.path + (q.toString() ? '?' + q : '') + (MM.shareHash ? MM.shareHash() : '');
    var text = T('title_' + curKey) + ' — entekhab.net';
    if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) { navigator.share({ title: text, url: url }).catch(function () { }); return; }
    var box = h('<div class="mm-share"><input readonly><div class="mm-row"><button type="button" class="mm-btn pri" data-c>' + esc(T('copy')) + '</button><a class="mm-btn" target="_blank" rel="noopener" data-t>Telegram</a></div></div>');
    $('input', box).value = url;
    $('[data-t]', box).href = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);
    $('[data-c]', box).onclick = function () { var i = $('input', box); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { MM.toast(T('copied')); }, function () { try { d.execCommand('copy'); MM.toast(T('copied')); } catch (e) { } }); };
    MM.modal(T('share'), box);
  }
  function fullscreen() {
    var on = !!(d.fullscreenElement || root.classList.contains('mm-fs'));
    if (on) { if (d.fullscreenElement) d.exitFullscreen().catch(function () { }); root.classList.remove('mm-fs'); }
    else if (root.requestFullscreen) root.requestFullscreen().then(function () { root.classList.add('mm-fs'); }, function () { root.classList.add('mm-fs'); });
    else root.classList.add('mm-fs');
    setTimeout(function () { if (cur && cur.resize) cur.resize(); }, 120);
  }
  d.addEventListener('fullscreenchange', function () { if (root) { root.classList.toggle('mm-fs', !!d.fullscreenElement); setTimeout(function () { if (cur && cur.resize) cur.resize(); }, 80); } });
  MM.modal = function (title, body) {
    var m = h('<div class="mm-modal" translate="no" role="dialog" aria-modal="true"><div class="mm-mbox" dir="' + (MM.rtl() ? 'rtl' : 'ltr') + '" lang="' + LANG + '"><div class="mm-mtop"><b>' + esc(title) + '</b><button type="button" class="mm-ib" data-x aria-label="' + esc(T('close')) + '">' + ic('close') + '</button></div></div></div>');
    $('.mm-mbox', m).appendChild(body);
    var close = function () { m.remove(); d.removeEventListener('keydown', k); };
    var k = function (e) { if (e.key === 'Escape') close(); };
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-x]')) close(); });
    d.addEventListener('keydown', k);
    d.body.appendChild(m);
    return { el: m, close: close };
  };

  /* ================================================================ the coin panel (panel.js, loaded on the first click) */
  MM.openCoin = function (s, tab) {
    var c = D.by[s]; if (!c) return;
    MM.loadScript(MM.asset('panel.js')).then(function () { MM.panel.open(c, tab); }, function () { MM.toast(T('loadErr')); });
  };
  MM.closeCoin = function () { if (MM.panel) MM.panel.close(); };

  /* <html lang>: in Arabic it is "en", as on every other page in Arabic. Arabic is the site's ar.js layer: the shared
     header and footer show their English labels for it to translate (assets/chrome.js follows <html lang>), and ar.js
     reads <html lang="ar"> as "a real /ar/p/ post page", which on leaving Arabic would send the reader to /p/undefined/.
     The map's own root and its pop-ups carry lang="ar" and translate="no": they have their own Arabic. */
  function docLang() { de.lang = LANG === 'ar' ? 'en' : LANG; de.dir = MM.rtl() ? 'rtl' : 'ltr'; }

  /* ================================================================ start */
  function start() {
    var main = d.getElementById('mm-main');
    var first = (main && main.getAttribute('data-view')) || viewFromPath() || 'heatmap';
    if (!d.getElementById('mm')) return;
    docLang();
    MM._boot = Promise.all([MM.load(), MM.loadAtlas()]).then(function () { poll(); });
    MM._boot.catch(function () { });
    build(viewFromPath() || first);
    MM._boot.then(function () { syncTools(); stats(); }, function (e) {
      var st = $('#mm-stage', root);
      if (st && (curKey === 'heatmap' || curKey === 'bubbles')) st.innerHTML = '<div class="mm-wait mm-err">' + esc(T('noSnap')) + '<br><button type="button" class="mm-btn" onclick="location.reload()">' + esc(T('retry')) + '</button></div>';
      if (w.console) console.error(e);
    });
    var c0 = new URLSearchParams(location.search).get('coin');
    if (c0) MM._boot.then(function () { if (/^[A-Z0-9]{1,12}$/.test(c0) && D.by[c0]) MM.openCoin(c0); });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
