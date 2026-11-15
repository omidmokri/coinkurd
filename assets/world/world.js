/* entekhab.net /world/ — «جهان زنده»: live counters of the world and of Bitcoin, with a post studio (studio.js, loaded on
   first use). Facts: /assets/world/facts.json (scripts/world_data.py, every figure with its publisher and year).
   Live: /data/world.json (CI: chain tip, first blocks of the UTC day/year, US debt, crypto totals), mempool.space (tip),
   Binance's public mirror (price). The arithmetic is assets/world/math.js. Nothing is shown that no source gave. */
(function () {
  'use strict';
  var w = window, d = document, WL = w.WL = w.WL || {}, M = WL.M, I = WL.I18N;
  var V = '3';
  WL.V = V;

  /* ================================================================ language */
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function detectLang() {
    var q = /[?&]lang=(fa|ckb|en|ar)\b/.exec(location.search);
    if (q) {
      try { if (q[1] === 'ar') { localStorage.setItem('ek_ar', '1'); localStorage.setItem('ck_lang', 'en'); } else { localStorage.removeItem('ek_ar'); localStorage.setItem('ck_lang', q[1]); } } catch (e) { }
      return q[1];
    }
    if (ls('ek_ar') === '1') return 'ar';
    var l = ls('ck_lang'); return ['fa', 'ckb', 'en'].indexOf(l) >= 0 ? l : 'fa';
  }
  var LANG = detectLang();
  WL.lang = function () { return LANG; };
  WL.rtl = function (lg) { return (lg || LANG) !== 'en'; };
  function Tl(lg, k, a) {
    var s = (I[lg] && I[lg][k] != null) ? I[lg][k] : (I.en[k] != null ? I.en[k] : k);
    if (a) s = s.replace(/\{(\w+)\}/g, function (m, x) { return a[x] != null ? a[x] : m; });
    return s;
  }
  function T(k, a) { return Tl(LANG, k, a); }
  WL.Tl = Tl;
  var DIG = { fa: '۰۱۲۳۴۵۶۷۸۹', ckb: '٠١٢٣٤٥٦٧٨٩', ar: '٠١٢٣٤٥٦٧٨٩' };
  /* digits and separators of the reader's script, for a number already written with Latin digits, "," and "." */
  function loc(s, lg) {
    var m = DIG[lg || LANG]; s = String(s);
    return m ? s.replace(/\d/g, function (c) { return m[c]; }).replace(/,/g, '٬').replace(/\./g, '٫').replace(/%/g, '٪') : s;
  }
  WL.loc = loc;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  WL.esc = esc;

  /* ================================================================ numbers */
  function fixed(n, dec) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function num(n, dec, lg) { return n == null || !isFinite(n) ? '—' : loc(fixed(n, dec || 0), lg); }
  /* 1.23 million — words for the image and the caption */
  function words(n, lg, dec) {
    if (n == null || !isFinite(n)) return '—';
    var a = Math.abs(n), u = null, x = n;
    if (a >= 1e12) { x = n / 1e12; u = 'n_t'; } else if (a >= 1e9) { x = n / 1e9; u = 'n_b'; } else if (a >= 1e6) { x = n / 1e6; u = 'n_m'; } else if (a >= 1e4) { x = n / 1e3; u = 'n_k'; }
    var dd = dec != null ? dec : (Math.abs(x) < 10 && u ? 2 : Math.abs(x) < 100 && u ? 1 : (u ? 0 : (Math.abs(x) < 10 && x % 1 ? 2 : 0)));
    var s = num(x, dd, lg);
    return u ? s + ' ' + Tl(lg, u) : s;
  }
  function usdShort(v, lg) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v), s;
    if (a >= 1e12) s = fixed(v / 1e12, 2) + 'T'; else if (a >= 1e9) s = fixed(v / 1e9, a >= 1e11 ? 0 : 1) + 'B'; else if (a >= 1e6) s = fixed(v / 1e6, 1) + 'M'; else if (a >= 1e4) s = fixed(v / 1e3, 1) + 'K'; else s = fixed(v, 0);
    s = '$' + loc(s, lg);
    return (lg || LANG) === 'en' ? s : '\u2066' + s + '\u2069';      /* kept left-to-right inside right-to-left text */
  }
  WL.num = num; WL.words = words; WL.usdShort = usdShort; WL.fixed = fixed;

  /* ================================================================ data */
  var F = {}, FACTS = null, D = {}, LIVE = { tip: null, tipAt: 0, price: null, priceAt: 0 };
  WL.F = F; WL.D = function () { return D; }; WL.LIVE = LIVE;
  function getJSON(u) {
    return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function loadFacts() {
    return getJSON('/assets/world/facts.json?v=' + V).then(function (j) { FACTS = j; (j.facts || []).forEach(function (f) { F[f.k] = f; }); });
  }
  function loadLive() {
    return getJSON('/data/world.json?m=' + Math.floor(Date.now() / 120000)).then(function (j) { D = j || {}; }, function () { });
  }
  function pollTip() {
    if (d.hidden) return;
    fetch('https://mempool.space/api/blocks/tip/height', { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : null; }).then(function (t) {
      var h = parseInt(t, 10); if (h > 0 && h < 1e8) { LIVE.tip = h; LIVE.tipAt = Date.now(); }
    }, function () { });
  }
  function pollPrice() {
    if (d.hidden) return;
    fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var p = j && parseFloat(j.price); if (p > 0) { LIVE.price = p; LIVE.priceAt = Date.now(); }
    }, function () { });
  }

  /* ================================================================ the counters */
  function tip() { var a = LIVE.tip, b = D.btc && D.btc.tip; return a && (!b || a >= b) ? a : (b || null); }
  function utcDay(now) { return now.toISOString().slice(0, 10); }
  function btcSince(mark, now, isYear) {
    var t = tip(), m = D.btc && D.btc[isYear ? 'year0' : 'day0'];
    if (!t || !m || !(m.h > 0)) return null;
    if (isYear ? m.y !== now.getUTCFullYear() : m.d !== utcDay(now)) return null;
    if (t < m.h) return { btc: 0, blocks: 0 };
    return { btc: M.issuedSat(m.h, t) / M.COIN, blocks: t - m.h + 1 };
  }
  function price() {
    if (LIVE.price) return { p: LIVE.price, live: true };
    var b = D.btc || {}; return b.p ? { p: b.p, live: false, t: b.p_t } : null;
  }
  function paceText(f, lg) {
    if (!f) return '';
    var y = num(f.year, 0, lg).replace(/٬/g, '');
    return (f.atleast ? Tl(lg, 'atleast') + ' · ' : '') + Tl(lg, f.basis === 'proj' ? 'pace_proj' : 'pace_obs', { y: y });
  }
  function rateText(perSec, unit, lg, dec) {
    if (!(perSec > 0)) return '';
    var steps = [['per_s', 1], ['per_m', 60], ['per_h', 3600], ['per_d', 86400]], i = 0;
    while (i < steps.length - 1 && perSec * steps[i][1] < 1) i++;
    var v = perSec * steps[i][1];
    var s = unit === 'usd' ? usdShort(v, lg) : (v >= 1e4 ? words(v, lg) : num(v, v < 10 ? (dec != null ? dec : 1) : 0, lg));
    if (unit && unit !== 'usd') s += ' ' + unitText(unit, lg);
    return Tl(lg, steps[i][0], { v: s });
  }
  WL.rateText = rateText;

  /* every card: id, section, the fact behind it (if any), and value(now, lang) ->
     {v: main number, fmt, unit, v2/k2: second line, rate, foot, src} (numbers raw; formatting is the caller's) */
  var CARDS = [
    { id: 'btc_supply', cat: 'btc', ic: 'btc', val: function (now) {
      var t = tip(); if (!t) return null; var s = M.supplySat(t) / M.COIN;
      return { v: s, dec: 2, unit: 'btc', sub: function (lg) { return Tl(lg, 'of_cap', { p: num(s / 21e6 * 100, 3, lg) + (lg === 'en' ? '%' : '٪') }); },
        foot: function (lg) { return Tl(lg, 'tip', { h: num(t, 0, lg) }); } };
    } },
    { id: 'btc_today', cat: 'btc', ic: 'pick', val: function (now) {
      var r = btcSince('day0', now, false); if (!r) return null;
      return { v: r.btc, dec: 3, unit: 'btc', sub: function (lg) { return Tl(lg, 'blocks', { n: num(r.blocks, 0, lg) }) + ' · ' + Tl(lg, 'utc_day'); } };
    } },
    { id: 'btc_year', cat: 'btc', ic: 'pick', val: function (now) {
      var r = btcSince('year0', now, true); if (!r) return null;
      return { v: r.btc, dec: 3, unit: 'btc', sub: function (lg) { return Tl(lg, 'blocks', { n: num(r.blocks, 0, lg) }) + ' · ' + Tl(lg, 'utc_year'); } };
    } },
    { id: 'btc_left', cat: 'btc', ic: 'hour', val: function () {
      var t = tip(); if (!t) return null; var l = (M.CAP_SAT - M.supplySat(t)) / M.COIN;
      return { v: l, dec: 2, unit: 'btc', sub: function (lg) { return Tl(lg, 'of_cap', { p: num(l / 21e6 * 100, 3, lg) + (lg === 'en' ? '%' : '٪') }); } };
    } },
    { id: 'halving', cat: 'btc', ic: 'half', val: function (now) {
      var t = tip(); if (!t) return null; var nx = M.nextHalving(t), left = nx - t, eta = new Date(now.getTime() + left * 600000);
      return { v: left, dec: 0, unit: 'blocks', sub: function (lg) { return Tl(lg, 'halv_eta', { d: dateText(eta, lg) }); },
        note: function (lg) { return Tl(lg, 'halv_sub', { a: loc(String(+(M.subsidySat(t) / M.COIN).toFixed(8)), lg), b: loc(String(+(M.subsidySat(nx) / M.COIN).toFixed(8)), lg) }); } };
    } },
    { id: 'btc_price', cat: 'btc', ic: 'coin', val: function () {
      var p = price(); if (!p) return null; var t = tip(), mc = t ? p.p * M.supplySat(t) / M.COIN : null;
      return { v: p.p, dec: 0, unit: 'usd', sub: function (lg) { return mc ? Tl(lg, 'btc_mc', { v: usdShort(mc, lg) }) : ''; },
        foot: function (lg) { return p.live ? Tl(lg, 'price_live') : Tl(lg, 'price_snap', { t: timeText(p.t, lg) }); }, live: p.live };
    } },
    { id: 'mcap', cat: 'btc', ic: 'pie', val: function () {
      var c = D.crypto; if (!c || !(c.mcap > 0)) return null;
      return { v: c.mcap, dec: 0, unit: 'usd', sub: function (lg) {
        var pc = function (x, sg) { return x == null ? '—' : '⁦' + loc((sg && x > 0 ? '+' : '') + fixed(x, 2) + '%', lg) + '⁩'; };
        return Tl(lg, 'mcap_d', { p: pc(c.btc_d), c: pc(c.chg24, true) });
      }, foot: function (lg) { return 'CoinGecko · ' + Tl(lg, 'updated', { t: timeText(c.t, lg) }); } };
    } },
    { id: 'pop', cat: 'pop', ic: 'globe', fact: 'pop' },
    { id: 'births', cat: 'pop', ic: 'baby', fact: 'births' },
    { id: 'deaths', cat: 'pop', ic: 'leaf', fact: 'deaths' },
    { id: 'growth', cat: 'pop', ic: 'up', fact: 'growth' },
    { id: 'gdp', cat: 'eco', ic: 'bars', fact: 'gdp' },
    { id: 'military', cat: 'eco', ic: 'shield', fact: 'military' },
    { id: 'usdebt', cat: 'eco', ic: 'bank', val: function (now) {
      var x = D.usdebt; var v = M.debt(x, now); if (v == null) return null;
      return { v: v, dec: 0, unit: 'usd', sub: function (lg) { return Tl(lg, 'debt_sub', { d: dateText(new Date(x.d + 'T12:00:00Z'), lg) }); },
        rate: x.rate, foot: function () { return 'US Treasury · Debt to the Penny'; }, src: { pub: 'US Treasury', t: 'Debt to the Penny (fiscaldata.treasury.gov)', url: 'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/', d: x.d } };
    } },
    { id: 'gold', cat: 'eco', ic: 'gold', fact: 'gold', dec: 2 },
    { id: 'energy', cat: 'env', ic: 'bolt', fact: 'energy' },
    { id: 'oil', cat: 'env', ic: 'drop', fact: 'oil' },
    { id: 'co2', cat: 'env', ic: 'cloud', fact: 'co2' },
    { id: 'forest', cat: 'env', ic: 'tree', fact: 'forest', dec: 0 },
    { id: 'trees', cat: 'env', ic: 'tree', fact: 'trees', dec: 0 },
    { id: 'under5', cat: 'health', ic: 'heart', fact: 'under5' },
    { id: 'tobacco', cat: 'health', ic: 'heart', fact: 'tobacco' },
    { id: 'tb', cat: 'health', ic: 'heart', fact: 'tb' },
    { id: 'road', cat: 'health', ic: 'car', fact: 'road' },
    { id: 'malaria', cat: 'health', ic: 'heart', fact: 'malaria' },
    { id: 'aids', cat: 'health', ic: 'heart', fact: 'aids' },
    { id: 'netusers', cat: 'soc', ic: 'wifi', fact: 'netusers' },
    { id: 'online', cat: 'soc', ic: 'wifi', fact: 'online' }
  ];
  WL.CARDS = CARDS;
  var BY = {}; CARDS.forEach(function (c) { BY[c.id] = c; });

  /* the value of any card now: the same object for the page, the hero, the studio and the captions */
  function value(id, now) {
    var c = BY[id]; if (!c) return null;
    if (c.val) { var r = c.val(now); if (r) { r.cat = c.cat; r.id = id; } return r; }
    var f = F[c.fact]; if (!f) return null;
    var out = { id: id, cat: c.cat, f: f, unit: f.unit, src: f.src };
    if (f.kind === 'stock') { out.v = M.stock(f.base, f.epoch, f.per_year, now); out.dec = 0; out.rate = f.per_year / (365.2425 * 86400); out.stock = true; }
    else if (f.kind === 'static') { out.v = f.value; out.dec = 0; out.static = true; }
    else {
      var fl = M.flow(f.per_year, now);
      out.v = fl[0]; out.v2 = fl[1]; out.rate = M.perSec(f.per_year, now);
      out.dec = c.dec != null ? c.dec : (f.per_year / 365 < 50 ? 2 : 0);
    }
    return out;
  }
  WL.value = value;

  function dateText(dt, lg) {
    try {
      var locs = { fa: 'fa-IR-u-ca-persian', ckb: 'en-GB', ar: 'ar-u-ca-gregory-nu-arab', en: 'en-GB' };
      var s = dt.toLocaleDateString(locs[lg] || 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
      if (lg === 'ckb') { var mo = ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەمموز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم']; s = loc(dt.getDate(), lg) + 'ی ' + mo[dt.getMonth()] + 'ی ' + loc(dt.getFullYear(), lg); }
      return s;
    } catch (e) { return dt.toISOString().slice(0, 10); }
  }
  function timeText(iso, lg) {
    var t = iso ? new Date(iso) : null; if (!t || isNaN(t)) return '—';
    var hh = ('0' + t.getHours()).slice(-2), mm = ('0' + t.getMinutes()).slice(-2);
    return loc(hh + ':' + mm, lg || LANG);
  }
  WL.dateText = dateText; WL.timeText = timeText;
  function unitText(u, lg) { return u === 'usd' ? '' : u === 'blocks' ? Tl(lg, 'blocks', { n: '' }).trim() : Tl(lg, 'u_' + u); }
  WL.unitText = unitText;
  function mainText(r, lg) {
    var s = num(r.v, r.dec, lg);
    return r.unit === 'usd' ? (lg === 'en' ? '$' + s : '$' + s) : s;
  }
  WL.mainText = mainText;
  function srcOf(r) { return r && (r.src || (r.f && r.f.src)) || null; }
  WL.srcOf = srcOf;

  /* ================================================================ icons (generic line glyphs) */
  var IC = {
    btc: '<path d="M9 5v14M12 5v2M12 17v2M8 7h6.5a2.5 2.5 0 0 1 0 5H8m0 0h7a2.5 2.5 0 0 1 0 5H8"/>',
    pick: '<path d="M14 4c3 0 6 2 7 4-2-1-5-1-7 0"/><path d="M14 4c-3 0-6 2-7 4 2-1 5-1 7 0"/><path d="M14 6 5 20"/>',
    hour: '<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 10 5 10 9s-10 4-10 9"/><path d="M17 3c0 5-10 5-10 9s10 4 10 9"/>',
    half: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M12 7h3.5M12 11h5M12 15h3.5"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M10 8h3.2a2 2 0 0 1 0 4H10m0 0h3.6a2 2 0 0 1 0 4H10V8"/>',
    pie: '<path d="M12 3v9h9"/><path d="M20.4 15.5A9 9 0 1 1 8.6 3.6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/>',
    baby: '<circle cx="12" cy="9" r="5"/><path d="M10 9h.01M14 9h.01"/><path d="M10.5 11.2c.8.6 2.2.6 3 0"/><path d="M6 21a6 6 0 0 1 12 0"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z"/><path d="M5 19 13 11"/>',
    up: '<path d="M4 17 10 11l4 4 6-7"/><path d="M15 8h5v5"/>',
    bars: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    shield: '<path d="M12 3 4.5 6v6c0 4.9 3.2 8.2 7.5 9 4.3-.8 7.5-4.1 7.5-9V6Z"/>',
    bank: '<path d="M3 10 12 4l9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/>',
    gold: '<path d="M3 19 6 13h6l3 6Z"/><path d="M12 13 15 7h6l-3 6"/><path d="M9 13l3-6"/>',
    bolt: '<path d="M13 3 5 13h6l-1 8 8-10h-6Z"/>',
    drop: '<path d="M12 3c4 5 6.5 8.4 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 11.4 8 8 12 3Z"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5Z"/>',
    tree: '<path d="M12 3 6 12h3l-4 6h14l-4-6h3Z"/><path d="M12 18v3"/>',
    heart: '<path d="M12 20s-7.5-4.6-9-9.3C1.8 6.8 4.6 4 7.6 4c1.9 0 3.4 1 4.4 2.5C13 5 14.5 4 16.4 4c3 0 5.8 2.8 4.6 6.7-1.5 4.7-9 9.3-9 9.3Z"/>',
    car: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0"/><path d="M5.5 12.5a9.5 9.5 0 0 1 13 0"/><path d="M9 16a4.5 4.5 0 0 1 6 0"/><circle cx="12" cy="19" r="1"/>',
    share: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>', spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'
  };
  function ic(n, cls) { return '<svg class="' + (cls || 'wl-svg') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>'; }
  WL.ic = ic;

  /* ================================================================ rendering */
  var root, cardsEl = {}, visible = {}, heroEls = null;
  function cardHtml(c) {
    var lab = T('k_' + c.id);
    return '<article class="wl-card wl-c-' + c.cat + '" data-id="' + c.id + '" id="c-' + c.id + '">' +
      '<div class="wl-ch"><span class="wl-ico">' + ic(c.ic) + '</span><h3>' + esc(lab) + '</h3>' +
      '<button type="button" class="wl-sh" data-share="' + c.id + '" aria-label="' + esc(T('share')) + '" title="' + esc(T('share')) + '">' + ic('share') + '</button></div>' +
      '<div class="wl-big"><b class="wl-num" dir="ltr">—</b><span class="wl-u"></span></div>' +
      '<div class="wl-l2"></div><div class="wl-rate"></div>' +
      '<button type="button" class="wl-src" data-src="' + c.id + '">' + ic('info', 'wl-svg sm') + '<span></span></button></article>';
  }
  function build() {
    root = d.getElementById('wl'); if (!root) return;
    root.setAttribute('lang', LANG); root.dir = WL.rtl() ? 'rtl' : 'ltr';
    var cats = (FACTS && FACTS.cats) || ['btc', 'pop', 'eco', 'env', 'health', 'soc'];
    var h = heroHtml();
    h += '<nav class="wl-chips" aria-label="' + esc(T('sec_pop')) + '">' + cats.map(function (k) { return '<a href="#s-' + k + '" data-k="' + k + '">' + esc(T('sec_' + k)) + '</a>'; }).join('') + '</nav>';
    cats.forEach(function (k) {
      h += '<section class="wl-sec" id="s-' + k + '" data-k="' + k + '"><header class="wl-sech"><h2>' + esc(T('sec_' + k)) + '</h2><p>' + esc(T('secd_' + k)) + '</p></header><div class="wl-grid">' +
        CARDS.filter(function (c) { return c.cat === k && c.id !== 'pop'; }).map(cardHtml).join('') + '</div></section>';
    });
    h += '<p class="wl-nfa">' + esc(T('method')) + ' ' + esc(T('nfa')) + '</p>';
    root.innerHTML = h;
    cardsEl = {};
    [].forEach.call(root.querySelectorAll('.wl-card'), function (el) {
      cardsEl[el.getAttribute('data-id')] = { el: el, num: el.querySelector('.wl-num'), u: el.querySelector('.wl-u'), l2: el.querySelector('.wl-l2'), rate: el.querySelector('.wl-rate'), src: el.querySelector('.wl-src span') };
    });
    heroEls = { pop: root.querySelector('#wl-pop'), sub: root.querySelector('#wl-hsub'), yr: root.querySelector('#wl-yr'), yrb: root.querySelector('#wl-yrb'), strip: root.querySelectorAll('[data-strip]') };
    observe();
    paint(true);
    globe(root.querySelector('#wl-globe'));
  }
  function heroHtml() {
    var strip = [['btc_today', 'strip_btc'], ['births', 'strip_births'], ['deaths', 'strip_deaths'], ['co2', 'strip_co2']];
    return '<div class="wl-hero"><canvas id="wl-globe" class="wl-globe" aria-hidden="true"></canvas><div class="wl-hin">' +
      '<span class="wl-kick"><i class="wl-dot"></i>' + esc(T('hero_kicker')) + '</span>' +
      '<div class="wl-pop"><b id="wl-pop" dir="ltr">—</b></div><p class="wl-plab">' + esc(T('k_pop')) + '</p>' +
      '<p class="wl-hsub" id="wl-hsub"></p>' +
      '<div class="wl-strip">' + strip.map(function (s) { return '<div class="wl-sc" data-strip="' + s[0] + '"><small>' + esc(T(s[1])) + '</small><b dir="ltr">—</b></div>'; }).join('') + '</div>' +
      '<div class="wl-yr"><span id="wl-yr"></span><i><b id="wl-yrb"></b></i></div>' +
      '<div class="wl-cta"><button type="button" class="wl-btn wl-pri" data-share="digest">' + ic('spark') + esc(T('share')) + '</button>' +
      '<button type="button" class="wl-btn" data-share="btcgold">' + esc(T('tpl_btcgold')) + '</button><button type="button" class="wl-btn" data-share="second">' + esc(T('tpl_second')) + '</button></div>' +
      '</div></div>';
  }
  function observe() {
    if (!('IntersectionObserver' in w)) { Object.keys(cardsEl).forEach(function (k) { visible[k] = true; }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { visible[e.target.getAttribute('data-id')] = e.isIntersecting; }); }, { rootMargin: '120px' });
    Object.keys(cardsEl).forEach(function (k) { io.observe(cardsEl[k].el); });
    var chips = root.querySelectorAll('.wl-chips a');
    var io2 = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) [].forEach.call(chips, function (a) { a.classList.toggle('on', a.getAttribute('data-k') === e.target.getAttribute('data-k')); }); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    [].forEach.call(root.querySelectorAll('.wl-sec'), function (s) { io2.observe(s); });
  }
  function paintCard(id, now, all) {
    var e = cardsEl[id]; if (!e || (!all && !visible[id])) return;
    var r = value(id, now);
    if (!r) { e.num.textContent = '—'; e.u.textContent = ''; e.l2.textContent = T(D.t || FACTS ? 'nodata' : 'loading'); e.el.classList.add('wl-nod'); return; }
    e.el.classList.remove('wl-nod');
    var t = mainText(r, LANG); if (e.num.textContent !== t) e.num.textContent = t;
    var sz = t.length > 20 ? 'xl' : t.length > 16 ? 'l' : t.length > 13 ? 'm' : '';
    if (e._sz !== sz) { e.num.setAttribute('data-sz', sz); e._sz = sz; }
    if (all) {
      e.u.textContent = unitText(r.unit, LANG);
      e.el.classList.toggle('wl-live', !!r.live);
    }
    var l2 = '';
    if (r.v2 != null) l2 = '<span>' + esc(T('today')) + '</span><b dir="ltr">' + esc(mainText({ v: r.v2, dec: r.dec, unit: r.unit }, LANG)) + '</b>';
    else if (r.sub) l2 = '<span class="wl-sub">' + esc(r.sub(LANG)) + '</span>';
    if (e._l2 !== l2) { e.l2.innerHTML = l2; e._l2 = l2; }
    if (all || r.rate) {
      var rt = id === 'usdebt' ? T('debt_rate', { v: usdShort(r.rate * 86400, LANG) }) : r.rate ? rateText(r.rate, r.unit, LANG, r.dec ? 2 : 1) : (r.note ? r.note(LANG) : '');
      if (e._rt !== rt) { e.rate.textContent = rt; e._rt = rt; }
    }
    if (all) {
      var s = srcOf(r), f = r.f;
      e.src.textContent = s ? (s.pub + (f ? ' · ' + paceText(f, LANG) : '')) : r.foot ? r.foot(LANG) : 'Bitcoin · mempool.space';
    }
  }
  function paintHero(now) {
    if (!heroEls || !heroEls.pop) return;
    var p = value('pop', now); heroEls.pop.textContent = p ? num(p.v, 0) : '—';
    var b = F.births, dd = F.deaths;
    if (b && dd && heroEls.sub && !heroEls.sub._ok) { heroEls.sub.textContent = T('hero_sub', { b: num(M.perSec(b.per_year, now), 1), d: num(M.perSec(dd.per_year, now), 1) }); heroEls.sub._ok = 1; }
    [].forEach.call(heroEls.strip, function (el) {
      var id = el.getAttribute('data-strip'), r = value(id, now), out = '—';
      if (r) { var v = r.v2 != null ? r.v2 : r.v; out = r.unit === 't' && v > 1e6 ? words(v, LANG) + ' ' + T('u_t') : (r.unit === 'btc' ? num(v, 3) + ' ₿' : num(v, 0)); }
      var bb = el.querySelector('b'); if (bb.textContent !== out) bb.textContent = out;
    });
    var y = now.getFullYear(), y0 = new Date(y, 0, 1), fr = (now - y0) / (new Date(y + 1, 0, 1) - y0);
    if (heroEls.yr) { var tx = loc(fixed(fr * 100, 3) + '%') + ' · ' + loc(String(y)); if (heroEls.yr.textContent !== tx) heroEls.yr.textContent = tx; heroEls.yrb.style.width = (fr * 100).toFixed(3) + '%'; }
  }
  var lastAll = 0;
  function paint(all) {
    var now = new Date();
    if (!all && now - lastAll > 4000) { all = true; }
    if (all) lastAll = now;
    paintHero(now);
    Object.keys(cardsEl).forEach(function (id) { paintCard(id, now, all); });
  }
  WL.paint = paint;
  var last = 0;
  function loop(t) {
    if (t - last > 110) { last = t; paint(false); }
    w.requestAnimationFrame(loop);
  }

  /* ================================================================ the 3D Earth: real continents (Natural Earth land,
     assets/world/land.json) as lit dots on a sphere in perspective; drag to turn it; every birth (green) and death
     (white) lights a point on land at the UN's rate; a ₿ satellite orbits and passes behind the planet. Canvas 2D only. */
  function globe(cv) {
    if (!cv || !cv.getContext) return;
    var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ctx = cv.getContext('2d'), LAND = [], SEA = [], pings = [], on = true;
    var yaw = -0.9, pitch = 0.32, vy = 0, drag = null, lastT = 0, t0 = 0;
    for (var i = 0, N = 1500; i < N; i++) { var yy = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - yy * yy), th = i * 2.399963229728653; SEA.push([Math.cos(th) * r, yy, Math.sin(th) * r]); }
    function vec(lat, lon) { var a = lat * Math.PI / 180, o = lon * Math.PI / 180; return [Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)]; }
    fetch('/assets/world/land.json?v=' + V).then(function (r) { return r.json(); }).then(function (j) {
      var b = atob(j.p), dv = new DataView(new ArrayBuffer(b.length));
      for (var k = 0; k < b.length; k++) dv.setUint8(k, b.charCodeAt(k));
      for (var k2 = 0; k2 + 3 < b.length; k2 += 4) LAND.push(vec(dv.getInt16(k2, true) / 100, dv.getInt16(k2 + 2, true) / 100));
    }, function () { });
    function size() { var dpr = Math.min(2, w.devicePixelRatio || 1), b = cv.getBoundingClientRect(); cv.width = Math.max(10, b.width * dpr); cv.height = Math.max(10, b.height * dpr); }
    size(); w.addEventListener('resize', size);
    if ('IntersectionObserver' in w) new IntersectionObserver(function (es) { on = es[0].isIntersecting; }).observe(cv);
    cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; vy = 0; try { cv.setPointerCapture(e.pointerId); } catch (er) { } });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
      yaw += dx * 0.008; pitch = Math.max(-1.1, Math.min(1.1, pitch + dy * 0.006)); vy = dx * 0.008;
    });
    function up() { drag = null; }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    var bps = F.births ? M.perSec(F.births.per_year, new Date()) : 4.2, dps = F.deaths ? M.perSec(F.deaths.per_year, new Date()) : 2;
    var SUN = (function () { var v = [-0.55, 0.45, 0.7], l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
    function frame(t) {
      w.requestAnimationFrame(frame);
      if (!on || d.hidden) { lastT = t; return; }
      var dt = Math.min(0.1, (t - lastT) / 1000 || 0); lastT = t; t0 += dt;
      if (!drag) { yaw += reduce ? 0 : dt * 0.09 + vy; vy *= 0.94; }
      if (LAND.length) {
        if (Math.random() < bps * dt) pings.push({ p: LAND[(Math.random() * LAND.length) | 0], a: 0, c: 1 });
        if (Math.random() < dps * dt) pings.push({ p: LAND[(Math.random() * LAND.length) | 0], a: 0, c: 0 });
      }
      var W = cv.width, H = cv.height, R = Math.min(W, H) * 0.38, cx = W / 2, cy = H / 2, CAM = 3.4;
      var cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      /* world -> view (rotate about y by yaw, then x by pitch) -> perspective */
      function rot(p) { var x = p[0] * cyw + p[2] * syw, z = -p[0] * syw + p[2] * cyw, y = p[1] * cp - z * sp; z = p[1] * sp + z * cp; return [x, y, z]; }
      function proj(q, s) { var f = CAM / (CAM - q[2] * (s || 1)); return [cx + q[0] * (s || 1) * R * f, cy - q[1] * (s || 1) * R * f, f]; }
      ctx.clearRect(0, 0, W, H);
      /* atmosphere and the dark disc */
      var g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.5);
      g.addColorStop(0, 'rgba(247,147,26,0.30)'); g.addColorStop(0.35, 'rgba(120,140,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, 6.2832); ctx.fill();
      var gd = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R * 1.06);
      gd.addColorStop(0, '#1d1a24'); gd.addColorStop(0.7, '#0c0b10'); gd.addColorStop(1, '#050507');
      ctx.fillStyle = gd; ctx.beginPath(); ctx.arc(cx, cy, R * 1.06, 0, 6.2832); ctx.fill();
      /* the satellite: drawn before the globe when it is behind it, after when in front */
      var oa = t0 * 0.55, op = [Math.cos(oa) * 1.55, Math.sin(oa) * 0.42, Math.sin(oa) * 1.55], tilt = 0.5;
      var oq = [op[0], op[1] * Math.cos(tilt) - op[2] * Math.sin(tilt), op[1] * Math.sin(tilt) + op[2] * Math.cos(tilt)];
      function sat() {
        var s = proj([oq[0], oq[1], oq[2]]), rr = Math.max(4, R * 0.045) * s[2];
        ctx.save(); ctx.shadowColor = '#f7931a'; ctx.shadowBlur = R * 0.12; ctx.fillStyle = '#f7931a'; ctx.beginPath(); ctx.arc(s[0], s[1], rr, 0, 6.2832); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#1a1006'; ctx.font = '900 ' + Math.round(rr * 1.35) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('₿', s[0], s[1] + rr * 0.05);
      }
      ctx.strokeStyle = 'rgba(255,210,122,0.16)'; ctx.lineWidth = Math.max(1, R * 0.004); ctx.beginPath();
      for (var k = 0; k <= 96; k++) {
        var a = k / 96 * 6.2832, p0 = [Math.cos(a) * 1.55, Math.sin(a) * 0.42, Math.sin(a) * 1.55];
        var q0 = [p0[0], p0[1] * Math.cos(tilt) - p0[2] * Math.sin(tilt), p0[1] * Math.sin(tilt) + p0[2] * Math.cos(tilt)], s0 = proj(q0);
        if (k) ctx.lineTo(s0[0], s0[1]); else ctx.moveTo(s0[0], s0[1]);
      }
      ctx.stroke();
      if (oq[2] < 0) sat();
      /* oceans: a faint grid of dots; land: lit gold dots (the side away from the sun is dim) */
      var ds = Math.max(1, R * 0.009);
      for (var i2 = 0; i2 < SEA.length; i2++) {
        var q = rot(SEA[i2]); if (q[2] < 0.02) continue; var s2 = proj(q);
        ctx.fillStyle = 'rgba(140,160,255,' + (0.05 + q[2] * 0.12).toFixed(3) + ')'; ctx.fillRect(s2[0], s2[1], ds * 0.8, ds * 0.8);
      }
      for (var j = 0; j < LAND.length; j++) {
        var p = LAND[j], q1 = rot(p); if (q1[2] < 0) continue;
        var li = Math.max(0, p[0] * SUN[0] + p[1] * SUN[1] + p[2] * SUN[2]), lum = 0.25 + 0.75 * li, s1 = proj(q1);
        var al = (0.25 + q1[2] * 0.75) * (0.45 + lum * 0.55);
        ctx.fillStyle = 'rgba(' + Math.round(170 + 85 * lum) + ',' + Math.round(110 + 100 * lum) + ',' + Math.round(40 + 80 * lum) + ',' + al.toFixed(3) + ')';
        var sz = ds * (0.8 + q1[2] * 0.7); ctx.fillRect(s1[0] - sz / 2, s1[1] - sz / 2, sz, sz);
      }
      /* the terminator: a soft night shade over the side away from the sun */
      var sv = rot(SUN), sh = ctx.createLinearGradient(cx + sv[0] * R, cy - sv[1] * R, cx - sv[0] * R, cy + sv[1] * R);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.55, 'rgba(0,0,0,0.05)'); sh.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, 6.2832); ctx.fill();
      /* births and deaths */
      for (var n = pings.length - 1; n >= 0; n--) {
        var pg = pings[n]; pg.a += dt * 0.8; if (pg.a > 1) { pings.splice(n, 1); continue; }
        var q3 = rot(pg.p); if (q3[2] < 0.05) continue; var s3 = proj(q3), rr2 = R * (0.01 + pg.a * 0.06) * s3[2], al2 = (1 - pg.a) * (0.4 + q3[2] * 0.6);
        ctx.strokeStyle = pg.c ? 'rgba(52,211,153,' + al2.toFixed(3) + ')' : 'rgba(255,255,255,' + (al2 * 0.7).toFixed(3) + ')';
        ctx.lineWidth = Math.max(1, R * 0.006); ctx.beginPath(); ctx.arc(s3[0], s3[1], rr2, 0, 6.2832); ctx.stroke();
        if (pg.a < 0.25) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(s3[0], s3[1], Math.max(1.5, R * 0.008), 0, 6.2832); ctx.fill(); }
      }
      /* rim light */
      ctx.strokeStyle = 'rgba(255,190,110,0.35)'; ctx.lineWidth = Math.max(1, R * 0.008); ctx.beginPath(); ctx.arc(cx, cy, R * 1.0 * CAM / Math.sqrt(CAM * CAM - 1), 0, 6.2832); ctx.stroke();
      if (oq[2] >= 0) sat();
    }
    w.requestAnimationFrame(frame);
  }

  /* ================================================================ source pop-up */
  function modal(html, cls) {
    var m = d.createElement('div'); m.className = 'wl-modal ' + (cls || ''); m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="wl-mbox" dir="' + (WL.rtl() ? 'rtl' : 'ltr') + '" lang="' + LANG + '" translate="no"><button type="button" class="wl-x" aria-label="' + esc(T('close')) + '">' + ic('close') + '</button>' + html + '</div>';
    function close() { m.remove(); d.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('.wl-x')) close(); });
    d.addEventListener('keydown', key);
    d.body.appendChild(m);
    var x = m.querySelector('.wl-x'); if (x) x.focus();
    m.close = close;
    return m;
  }
  WL.modal = modal;
  function showSource(id) {
    var r = value(id, new Date()); var s = srcOf(r); var c = BY[id];
    var h = '<h3>' + esc(T('k_' + id)) + '</h3>';
    if (s) {
      h += '<p class="wl-sp"><b>' + esc(s.pub) + '</b> — ' + esc(s.t) + '</p><p class="wl-sp">' + esc(T('src')) + ': ' + esc(s.d) + (r.f ? ' · ' + esc(paceText(r.f, LANG)) : '') + '</p>' +
        '<p class="wl-sp wl-mute">' + esc(r.stock ? T('method_stock') : r.static ? '' : (r.f ? T('method') : '')) + '</p>' +
        '<a class="wl-btn" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(T('open_src')) + '</a>';
    } else if (c && c.cat === 'btc') {
      h += '<p class="wl-sp">' + esc(id === 'btc_price' ? 'Binance (data-api.binance.vision) · CoinGecko' : id === 'mcap' ? 'CoinGecko' : 'Bitcoin: mempool.space') + '</p>' +
        '<p class="wl-sp wl-mute">' + esc(LANG === 'en' ? 'Coins issued come from the block subsidy schedule (50 BTC halved every 210,000 blocks) and the real block height; fees are not new coins.' :
          LANG === 'fa' ? 'سکه‌های ساخته‌شده از جدول پاداش بلاک (۵۰ بیت‌کوین، نصف‌شده هر ۲۱۰٬۰۰۰ بلاک) و ارتفاع واقعی بلاک‌ها محاسبه می‌شوند؛ کارمزدها سکهٔ تازه نیستند.' :
          LANG === 'ckb' ? 'دراوە دروستکراوەکان لە خشتەی پاداشتی بلۆک (٥٠ بیتکۆین، نیوە دەبێت هەر ٢١٠٬٠٠٠ بلۆک) و بەرزیی ڕاستەقینەی بلۆکەکانەوە دەژمێردرێن؛ کرێکان دراوی نوێ نین.' :
          'تُحسب العملات المُصدَرة من جدول مكافأة الكتلة (٥٠ بيتكوين تُنصَّف كل ٢١٠٬٠٠٠ كتلة) ومن ارتفاع الكتل الحقيقي؛ الرسوم ليست عملات جديدة.') + '</p>';
    }
    modal(h, 'wl-srcm');
  }

  /* ================================================================ studio (lazy) */
  function loadScript(src) {
    return new Promise(function (res, rej) { var s = d.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; d.head.appendChild(s); });
  }
  function openStudio(what) {
    var go = function () { WL.studio.open(what); };
    if (WL.studio) return go();
    loadScript('/assets/world/studio.js?v=' + V).then(go, function () { });
  }
  WL.openStudio = openStudio;

  function wire() {
    d.addEventListener('click', function (e) {
      var s = e.target.closest('[data-share]'); if (s && root && root.contains(s)) { openStudio(s.getAttribute('data-share')); return; }
      var r = e.target.closest('[data-src]'); if (r && root && root.contains(r)) { showSource(r.getAttribute('data-src')); return; }
    });
    var LG = d.getElementById('langs');
    if (LG) LG.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-l]'); if (!b) return;
      var l = b.getAttribute('data-l'); if (l === 'ar' || LANG === 'ar') return;      /* Arabic is switched by ar.js (it reloads) */
      if (['fa', 'ckb', 'en'].indexOf(l) < 0 || l === LANG) return;
      try { localStorage.setItem('ck_lang', l); } catch (er) { }
      LANG = l; docLang(); build(); pageText();
    });
    d.addEventListener('visibilitychange', function () { if (!d.hidden) { pollTip(); pollPrice(); } });
  }
  /* the static readable text (for search engines and visitors without JavaScript) follows the page language */
  function pageText() {
    [].forEach.call(d.querySelectorAll('#wl-main [data-lang]'), function (e) { e.hidden = e.getAttribute('data-lang') !== LANG; });
  }
  function docLang() { var de = d.documentElement; de.lang = LANG === 'ar' ? 'en' : LANG; de.dir = WL.rtl() ? 'rtl' : 'ltr'; }

  function start() {
    if (!d.getElementById('wl')) return;
    docLang(); pageText();
    Promise.all([loadFacts(), loadLive()]).then(function () {
      build(); wire(); w.requestAnimationFrame(loop);
      var q = new URLSearchParams(location.search).get('post'); if (q) openStudio(q);
    }, function (e) {
      var el = d.getElementById('wl'); if (el) el.innerHTML = '<div class="wl-wait">' + esc(T('nodata')) + '</div>';
      if (w.console) console.error(e);
    });
    pollTip(); pollPrice();
    setInterval(pollTip, 60000); setInterval(pollPrice, 20000);
    setInterval(function () { loadLive(); }, 300000);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
