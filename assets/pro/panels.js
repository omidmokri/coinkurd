/* entekhab.net — /market/ side panels: watchlist · alerts · economic calendar (+ its flags on the chart) · objects.
   All personal data (lists, flags, alerts, log) lives only in this browser. */
(function () {
  'use strict';
  var P = window.PRO, A = P && P.app; if (!A) return;
  var T = A.T, esc = A.esc, h = A.h, $ = A.$, $$ = A.$$, ic = A.ic, S = P.store, d = document;
  var BOT = 'Kurd_kurdistan_bot';

  /* ---------------------------------------------------------------- live ticker demand from several places */
  var demand = {};
  function want(src, syms) { demand[src] = syms || []; var all = {}; Object.keys(demand).forEach(function (k) { demand[k].forEach(function (s) { all[s] = 1; }); }); P.tickers.watch(Object.keys(all).slice(0, 150)); }

  /* a time span in words: «19 ساعت و 22 دقیقه», «2 days 5 h» … (two units at most) */
  function durText(sec) {
    sec = Math.max(0, sec); var dd = Math.floor(sec / 86400), hh = Math.floor(sec % 86400 / 3600), mm = Math.floor(sec % 3600 / 60), parts = [];
    if (dd) { parts.push(T('dur_d', { n: dd })); if (hh) parts.push(T('dur_h', { n: hh })); }
    else if (hh) { parts.push(T('dur_h', { n: hh })); if (mm) parts.push(T('dur_m', { n: mm })); }
    else parts.push(T('dur_m', { n: Math.max(1, mm) }));
    return parts.join(T('dur_sep'));
  }
  P.durText = durText;

  /* ================================================================ WATCHLIST */
  var W = S.get('ek_pro_watch', null);
  /* «My watchlist» is the site-wide star list (ek_watch). Until the visitor stars or edits anything it shows these
     coins, without writing them: opening this page must not star coins across the site */
  var SITE_DEF = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'XAUT'];
  function siteList() { var a = S.get('ek_watch', []); a = Array.isArray(a) ? a.filter(function (x) { return A.SYM_RE.test(x); }) : []; return a.length || W.siteEdited ? a : SITE_DEF.slice(); }
  function setSiteList(a) { S.set('ek_watch', a.slice(0, 60)); W.siteEdited = 1; saveW(); }
  if (!W || typeof W !== 'object' || !Array.isArray(W.lists)) W = { lists: [], cur: 'site', flags: {}, sort: null, ff: null };
  W.flags = W.flags && typeof W.flags === 'object' ? W.flags : {};
  function saveW() { S.set('ek_pro_watch', W); }
  var FLAGS = { r: '#ff5a4d', o: '#f7931a', y: '#facc15', g: '#34d399', b: '#38bdf8', p: '#a78bfa' };
  var TOP = [];
  P.getJSON('/data/market.json?v=' + Math.floor(Date.now() / 3e5)).then(function (m) { TOP = (m.coins || []).map(function (c) { return c.coin; }); P.universe().then(function (u) { var set = new Set(u); TOP = TOP.filter(function (c) { return set.has(c); }).slice(0, 30); if (W.cur === 'top' && curBox) drawWatch(curBox); }); }, function () { });
  /* built-in lists: every Binance coin, and Iran's market in toman (currencies, gold, coins, silver, tether) */
  var ALLB = []; P.universe().then(function (u) { ALLB = u || []; if (W.cur === 'all' && curBox) drawWatch(curBox); });
  function listSyms() {
    var a = W.cur === 'site' ? siteList() : W.cur === 'top' ? TOP : W.cur === 'all' ? ALLB : W.cur === 'iran' ? (P.irList ? P.irList() : []) : ((W.lists[W.cur | 0] || {}).s || []);
    return a.filter(function (s) { return !isSec(s) && (P.hasLogo ? P.hasLogo(s) : !P._logoSet || P._logoSet.has(s)); });      /* never a coin without its logo */
  }
  function editable() { return W.cur !== 'top' && W.cur !== 'all' && W.cur !== 'iran'; }
  /* ---- sections (as on TradingView/Faraz): a list's layout is its symbols with '§name' headers between them.
     Custom lists keep the headers in their own array; the site-wide star list (ek_watch, read by other pages) stays
     symbols only, and its headers live in W.lay.site, matched against it every time it is drawn. */
  function isSec(x) { return typeof x === 'string' && x.charAt(0) === '§'; }
  function layout() {
    if (W.cur === 'site') {
      var syms = siteList(), lay = (W.lay && Array.isArray(W.lay.site)) ? W.lay.site : [], seen = {}, out = [];
      lay.forEach(function (x) { if (isSec(x)) out.push(x); else if (syms.indexOf(x) >= 0 && !seen[x]) { seen[x] = 1; out.push(x); } });
      syms.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
      return out;
    }
    if (editable()) return ((W.lists[W.cur | 0] || {}).s || []).slice();
    return listSyms();
  }
  function setLayout(a) {
    if (W.cur === 'site') { W.lay = W.lay || {}; W.lay.site = a.slice(0, 120); var syms = a.filter(function (x) { return !isSec(x); }); if (syms.join() !== siteList().join()) setSiteList(syms); else saveW(); }
    else if (editable()) { var L = W.lists[W.cur | 0]; if (L) { L.s = a.slice(0, 120); saveW(); } }
  }
  function sections() { return layout().filter(isSec); }
  function colKey(sec) { return String(W.cur) + sec; }
  function label(s) {                                   /* BTC · BTC تومان · دلار آمریکا */
    var I = P.inst ? P.inst(s) : null; if (!I || I.kind === 'usdt') return esc(s);
    return I.kind === 'ir' ? esc(P.pair(s)) : esc(I.base) + ' <small class="pm-tmn">' + esc(T('toman')) + '</small>';
  }
  function fmtP(s, v) { return P.fmt(v, P.precFor ? P.precFor(s, v) : null); }
  function addTo(sym) {
    if (!A.SYM_RE.test(sym)) return;
    if (W.cur === 'site') { var a = siteList(); if (a.indexOf(sym) < 0) { a.push(sym); setSiteList(a); } }
    else if (W.cur !== 'top') { var L = W.lists[W.cur | 0]; if (L && L.s.indexOf(sym) < 0) L.s.push(sym); saveW(); }
  }
  function removeFrom(sym) {
    if (W.cur === 'site') setSiteList(siteList().filter(function (x) { return x !== sym; }));
    else if (W.cur !== 'top') { var L = W.lists[W.cur | 0]; if (L) L.s = L.s.filter(function (x) { return x !== sym; }); saveW(); }
  }
  P.watchSyms = function () { return siteList(); };
  var curBox = null;
  function drawWatch(box) {
    curBox = box;
    var lists = [{ k: 'site', n: '⭐ ' + T('myList') }, { k: 'top', n: '🔥 ' + T('topVol') }, { k: 'all', n: '🌐 ' + T('allBinance') }, { k: 'iran', n: '💵 ' + T('iranMarket') }].concat(W.lists.map(function (l, i) { return { k: String(i), n: l.n }; }));
    box.innerHTML = '<div class="pm-ph"><select class="pm-sel" aria-label="' + esc(T('lists')) + '">' + lists.map(function (l) { return '<option value="' + l.k + '"' + (String(W.cur) === l.k ? ' selected' : '') + '>' + esc(l.n) + '</option>'; }).join('') + '</select>' +
      '<button type="button" class="pm-ib" data-a="scr" title="' + esc(T('screener')) + '">' + ic('tpl') + '</button><button type="button" class="pm-ib" data-a="add" title="' + esc(T('addSym')) + '">' + ic('plus') + '</button><button type="button" class="pm-ib" data-a="more" title="' + esc(T('more')) + '">' + ic('menu') + '</button></div>' +
      '<div class="pm-flags"><button type="button" class="pm-fl' + (!W.ff ? ' on' : '') + '" data-f="">' + esc(T('all')) + '</button>' + Object.keys(FLAGS).map(function (f) { return '<button type="button" class="pm-fl' + (W.ff === f ? ' on' : '') + '" data-f="' + f + '" style="--c:' + FLAGS[f] + '" aria-label="' + f + '"><i></i></button>'; }).join('') + '</div>' +
      (listSyms().length > 25 ? '<input class="pm-in pm-wq" type="search" autocomplete="off" placeholder="' + esc(T('filterList')) + '" aria-label="' + esc(T('filterList')) + '">' : '') +
      '<div class="pm-wh"><span data-k="s">' + esc(T('symbolCol')) + '</span><span data-k="c">' + esc(T('last')) + '</span><span data-k="p">' + esc(T('chg')) + '</span></div><div class="pm-wl" role="list"></div><div class="pm-wsum"></div>';
    $('select', box).onchange = function () { W.cur = this.value; saveW(); drawWatch(box); };
    $('[data-a="add"]', box).onclick = function () { if (!editable()) { toastTop(); return; } pickSym(function (s) { addTo(s); drawWatch(box); }); };
    $('[data-a="more"]', box).onclick = function (e) { listMenu(e.currentTarget, box); };
    $('[data-a="scr"]', box).onclick = function () { P.screener(); };
    $$('[data-f]', box).forEach(function (b) { b.onclick = function () { W.ff = b.getAttribute('data-f') || null; saveW(); drawWatch(box); }; });
    $$('.pm-wh [data-k]', box).forEach(function (s) { s.onclick = function () { var k = s.getAttribute('data-k'); W.sort = W.sort && W.sort.k === k ? (W.sort.d > 0 ? { k: k, d: -1 } : null) : { k: k, d: 1 }; saveW(); rows(box); }; });
    var wq = $('.pm-wq', box); if (wq) wq.oninput = A.debounce ? A.debounce(function () { rows(box); }, 150) : function () { rows(box); };
    /* a long list keeps live only the rows on screen; the rest got one REST snapshot */
    var wl = $('.pm-wl', box); if (wl) wl.addEventListener('scroll', visDebounced(box), { passive: true });
    if (W.cur === 'all' && ALLB.length && !box._bulk) { box._bulk = 1; for (var i = 0; i < ALLB.length && i < 600; i += 100) P._tkRest(ALLB.slice(i, i + 100)); }
    rows(box);
  }
  /* ---- market watch: every Binance coin (or Iran's market in toman) with 24h change, volume, where the price sits in
     its 24h range, and the site's 1-hour RSI and trend; sorted and filtered here, a click opens the chart */
  var MKT = null;
  function siteMarket() {
    if (!MKT || MKT.t < Date.now() - 3e5) MKT = { t: Date.now(), p: P.getJSON('/data/market.json?v=' + Math.floor(Date.now() / 3e5)).then(function (m) { var o = {}; ((m && m.coins) || []).forEach(function (c) { o[c.coin] = c; }); return o; }, function () { return {}; }) };
    return MKT.p;
  }
  var SCR = S.get('ek_pro_scr', null); if (!SCR || typeof SCR !== 'object') SCR = {};
  SCR = { m: SCR.m === 'iran' ? 'iran' : 'crypto', f: ['all', 'up', 'down', 'vol', 'os', 'ob', 'hi', 'lo'].indexOf(SCR.f) >= 0 ? SCR.f : 'all', k: ['s', 'c', 'p', 'q', 'r', 'rsi', 'tr'].indexOf(SCR.k) >= 0 ? SCR.k : 'q', d: SCR.d === 1 ? 1 : -1 };
  var SCOLS = ['s', 'c', 'p', 'q', 'r', 'rsi', 'tr'];
  function scrRow(s, site) {
    var t = P.tickers.d[s] || {}, m = site[s] || {}, r = t.h > t.l ? (t.c - t.l) / (t.h - t.l) : null;
    return { s: s, c: t.c, p: t.chg, q: t.q > 0 ? t.q : null, r: r, rsi: m.rsi != null ? m.rsi : null, tr: m.trend || null };
  }
  function scrFilter(rows, f) {
    var ok2 = function (v) { return v != null && isFinite(v); };
    if (f === 'up') return rows.filter(function (x) { return x.p > 0; });
    if (f === 'down') return rows.filter(function (x) { return x.p < 0; });
    if (f === 'vol') return rows.filter(function (x) { return ok2(x.q); }).sort(function (a, b) { return b.q - a.q; }).slice(0, 50);
    if (f === 'os') return rows.filter(function (x) { return ok2(x.rsi) && x.rsi < 30; });
    if (f === 'ob') return rows.filter(function (x) { return ok2(x.rsi) && x.rsi > 70; });
    if (f === 'hi') return rows.filter(function (x) { return ok2(x.r) && x.r >= 0.95; });
    if (f === 'lo') return rows.filter(function (x) { return ok2(x.r) && x.r <= 0.05; });
    return rows;
  }
  function scrSort(rows, k, d) {
    var TR = { up: 2, range: 1, down: 0 };
    return rows.slice().sort(function (a, b) {
      if (k === 's') return d * (a.s < b.s ? -1 : a.s > b.s ? 1 : 0);
      var va = k === 'tr' ? TR[a.tr] : a[k], vb = k === 'tr' ? TR[b.tr] : b[k], na = va == null || !isFinite(va), nb = vb == null || !isFinite(vb);
      if (na || nb) return na === nb ? 0 : na ? 1 : -1;                     /* empty cells go last either way */
      return d * (va - vb);
    });
  }
  P._scr = { row: scrRow, filter: scrFilter, sort: scrSort };          /* for the tests */
  P.screener = function () {
    var f = h('<div class="pm-scr"><div class="pm-scrtop"><div class="pm-seg"><button type="button" data-m="crypto"></button><button type="button" data-m="iran"></button></div><input class="pm-in" type="search" autocomplete="off"></div>' +
      '<div class="pm-chips pm-scrf"></div><div class="pm-scrsum"></div><div class="pm-tw pm-scrw"><table class="pm-tbl pm-scrt" dir="ltr"><thead></thead><tbody></tbody></table></div><p class="pm-note"></p></div>');
    $('[data-m="crypto"]', f).textContent = T('scr_crypto'); $('[data-m="iran"]', f).textContent = T('scr_iran');
    var q = $('input', f); q.placeholder = T('scrSearch'); q.setAttribute('aria-label', T('scrSearch'));
    $('.pm-note', f).textContent = T('scrNote');
    var chips = $('.pm-scrf', f);
    ['all', 'up', 'down', 'vol', 'os', 'ob', 'hi', 'lo'].forEach(function (k) { var b = h('<button type="button" class="pm-chip" data-f="' + k + '"></button>'); b.textContent = T('sf_' + k); chips.appendChild(b); });
    var site = {}, timer = null, busy = false;
    function syms() { return SCR.m === 'iran' ? (P.irList ? P.irList() : []).filter(function (s) { return !isSec(s); }) : ALLB.slice(0, 600); }
    function load() {
      if (busy || (!f.isConnected && timer)) return; busy = true;
      var go = function () {
        var L = syms(), jobs = [siteMarket().then(function (o) { site = o; })];
        if (SCR.m === 'crypto') for (var i = 0; i < L.length; i += 100) jobs.push(P._tkRest(L.slice(i, i + 100)).catch(function () { }));
        else want('screener', L);
        return Promise.all(jobs);
      };
      var done = function () { busy = false; paint(); };
      (SCR.m === 'crypto' && !ALLB.length ? P.universe().then(function (u) { ALLB = u || []; }, function () { }) : Promise.resolve()).then(go).then(done, done);
    }
    function paint() {
      if (timer && !f.isConnected) { clearInterval(timer); want('screener', []); return; }
      $$('[data-m]', f).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-m') === SCR.m); });
      $$('[data-f]', f).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-f') === SCR.f); });
      var all = syms().map(function (s) { return scrRow(s, site); }).filter(function (x) { return x.c > 0; });
      var up = all.filter(function (x) { return x.p > 0; }).length, dn = all.filter(function (x) { return x.p < 0; }).length;
      var ch = all.map(function (x) { return x.p; }).filter(function (v) { return v != null && isFinite(v); }).sort(function (a, b) { return a - b; });
      var med = ch.length ? (ch.length % 2 ? ch[(ch.length - 1) / 2] : (ch[ch.length / 2 - 1] + ch[ch.length / 2]) / 2) : null;
      var byP = all.filter(function (x) { return x.p != null && isFinite(x.p); }).sort(function (a, b) { return b.p - a.p; });
      var mv = function (x) { return '<button type="button" class="pm-mv" data-s="' + esc(x.s) + '"><img src="' + esc(P.logo(x.s)) + '" alt="" width="14" height="14">' + label(x.s) + ' <b class="' + (x.p >= 0 ? 'up' : 'dn') + '">' + (x.p >= 0 ? '+' : '') + x.p.toFixed(2) + '%</b></button>'; };
      $('.pm-scrsum', f).innerHTML = all.length ? '<span>' + esc(T('scrSum', { u: A.loc(up), d: A.loc(dn), m: med == null ? '—' : (med >= 0 ? '+' : '') + med.toFixed(2) + '%' })) + '</span><i class="pm-brd"><b style="width:' + (up + dn ? up / (up + dn) * 100 : 50).toFixed(1) + '%"></b></i>' +
        (byP.length > 6 ? '<div class="pm-mvs">🚀 ' + byP.slice(0, 4).map(mv).join('') + '</div><div class="pm-mvs">📉 ' + byP.slice(-4).reverse().map(mv).join('') + '</div>' : '') : esc(T('loading'));
      var qq = q.value.trim().toUpperCase(), rows = scrFilter(all, SCR.f);
      if (qq) rows = rows.filter(function (x) { return x.s.indexOf(qq) >= 0 || P.pair(x.s).toUpperCase().indexOf(qq) >= 0; });
      rows = scrSort(rows, SCR.k, SCR.d);
      var star = siteList();
      $('thead', f).innerHTML = '<tr><th>#</th>' + SCOLS.map(function (k) { return '<th data-k="' + k + '" class="' + (SCR.k === k ? 'on' : '') + '">' + esc(T('sc_' + k)) + (SCR.k === k ? (SCR.d > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('') + '<th></th></tr>';
      $('tbody', f).innerHTML = rows.slice(0, 600).map(function (x, i) {
        var rg = x.r == null ? '—' : '<i class="pm-rg"><b style="left:' + (x.r * 100).toFixed(1) + '%"></b></i>';
        return '<tr data-s="' + esc(x.s) + '"><td>' + (i + 1) + '</td><td><span class="pm-scs"><img src="' + esc(P.logo(x.s)) + '" alt="" width="16" height="16" loading="lazy">' + label(x.s) + '</span></td><td class="pm-num">' + fmtP(x.s, x.c) +
          '</td><td class="pm-num ' + (x.p >= 0 ? 'up' : 'dn') + '">' + (x.p == null ? '—' : (x.p >= 0 ? '+' : '') + x.p.toFixed(2) + '%') + '</td><td class="pm-num">' + (x.q == null ? '—' : P.fmtV(x.q)) + '</td><td>' + rg +
          '</td><td class="pm-num' + (x.rsi == null ? '' : x.rsi < 30 ? ' up' : x.rsi > 70 ? ' dn' : '') + '">' + (x.rsi == null ? '—' : x.rsi.toFixed(1)) + '</td><td>' + (x.tr ? esc(T('tr_' + x.tr)) : '—') +
          '</td><td><button type="button" class="pm-ib pm-star' + (star.indexOf(x.s) >= 0 ? ' on' : '') + '" data-star="' + esc(x.s) + '" aria-label="' + esc(T('addSym')) + '">' + (star.indexOf(x.s) >= 0 ? '★' : '☆') + '</button></td></tr>';
      }).join('') || '<tr><td colspan="9">' + esc(T('noMatch')) + '</td></tr>';
      $$('thead [data-k]', f).forEach(function (th) { th.onclick = function () { var k = th.getAttribute('data-k'); SCR.d = SCR.k === k ? -SCR.d : k === 's' ? 1 : -1; SCR.k = k; S.set('ek_pro_scr', SCR); paint(); }; });
    }
    f.addEventListener('click', function (e) {
      var st = e.target.closest('[data-star]'); if (st) { var s = st.getAttribute('data-star'), a = siteList(), i = a.indexOf(s); if (i >= 0) a.splice(i, 1); else a.push(s); setSiteList(a); if (curBox && curBox.isConnected) drawWatch(curBox); paint(); return; }
      var r = e.target.closest('tr[data-s], .pm-mv'); if (r) { A.closeModal(); A.applySym(r.getAttribute('data-s')); return; }
      var m = e.target.closest('[data-m]'); if (m) { SCR.m = m.getAttribute('data-m'); S.set('ek_pro_scr', SCR); paint(); load(); return; }
      var c = e.target.closest('[data-f]'); if (c) { SCR.f = c.getAttribute('data-f'); S.set('ek_pro_scr', SCR); paint(); }
    });
    q.oninput = A.debounce ? A.debounce(paint, 150) : paint;
    var pend = null, live = function () { if (pend) return; pend = setTimeout(function () { pend = null; if (f.isConnected && !busy) paint(); }, 900); };   /* a throttle: a stream of ticks still repaints */
    var off = P.tickers.on(live);                                     /* live prices repaint the table (at most about once a second) */
    A.modal(T('screener'), f, { wide: true, nofocus: true, onclose: function () { clearInterval(timer); off(); want('screener', []); } });
    paint(); load();
    timer = setInterval(function () { if (!f.isConnected) { clearInterval(timer); off(); return; } if (!document.hidden && SCR.m === 'crypto') load(); }, 60000);
  };
  function visible(box) {
    var wl = $('.pm-wl', box); if (!wl) return [];
    var r0 = wl.getBoundingClientRect(), out = [];
    $$('.pm-wr', wl).forEach(function (r) { var q = r.getBoundingClientRect(); if (q.bottom >= r0.top - 40 && q.top <= r0.bottom + 40) out.push(r.getAttribute('data-s')); });
    return out;
  }
  function visDebounced(box) { var t; return function () { clearTimeout(t); t = setTimeout(function () { if (listSyms().length > 40) want('watch', visible(box).slice(0, 60)); }, 250); }; }
  function toastTop() { A.toast(T('topFixed')); }
  function rows(box) {
    var syms = listSyms(), wl = $('.pm-wl', box); if (!wl) return;
    if (W.ff) syms = syms.filter(function (s) { return W.flags[s] === W.ff; });
    var q = ($('.pm-wq', box) || {}).value; q = q && q.trim().toLowerCase();
    if (q) syms = syms.filter(function (s) { var I = P.inst ? P.inst(s) : null; return s.toLowerCase().indexOf(q) >= 0 || (I && I.name && (I.name.fa + I.name.ckb + I.name.ar + I.name.en).toLowerCase().indexOf(q) >= 0); });
    if (W.sort) { var k = W.sort.k, dd = W.sort.d; syms = syms.slice().sort(function (a, b) { var x = P.tickers.d[a], y = P.tickers.d[b]; var va = k === 's' ? a : x ? (k === 'c' ? x.c : x.chg) : null, vb = k === 's' ? b : y ? (k === 'c' ? y.c : y.chg) : null; if (va == null) return 1; if (vb == null) return -1; return (va > vb ? 1 : va < vb ? -1 : 0) * dd; }); }
    want('watch', syms.length > 40 ? syms.slice(0, 30) : syms);
    var act = A.active() && A.active().cfg.sym, plain = W.sort || W.ff || q || !editable(), seq = syms, hid = {};
    if (!plain && sections().length) {                    /* in its own order: headers between the rows; a collapsed header hides its rows */
      var okSet = {}; syms.forEach(function (x) { okSet[x] = 1; }); seq = []; var cur = null;
      W.col = W.col || {};
      layout().forEach(function (x) { if (isSec(x)) { cur = x; seq.push(x); } else if (okSet[x]) { if (cur && W.col[colKey(cur)]) hid[x] = 1; else seq.push(x); } });
    }
    function head(x) {
      var n = 0, open = !(W.col && W.col[colKey(x)]), L = layout(), i = L.indexOf(x);
      for (var j = i + 1; j < L.length && !isSec(L[j]); j++) n++;
      return '<div class="pm-wsec' + (open ? '' : ' shut') + '" data-sec="' + esc(x) + '"><button type="button" class="pm-wst"><i>' + (open ? '▾' : (typeof A.RTL === 'function' ? A.RTL() : A.RTL) ? '◂' : '▸') + '</i><b>' + esc(x.slice(1)) + '</b><small>' + A.loc(n) + '</small></button>' +
        '<button type="button" class="pm-ib pm-wsm" aria-label="' + esc(T('more')) + '">' + ic('menu') + '</button></div>';
    }
    wl.innerHTML = seq.length ? seq.map(function (s) {
      if (isSec(s)) return head(s);
      var f = W.flags[s];
      return '<div class="pm-wr' + (s === act ? ' on' : '') + '" role="listitem" data-s="' + s + '"><button type="button" class="pm-wf" style="--c:' + (f ? FLAGS[f] : 'transparent') + '" aria-label="' + esc(T('flag')) + '"></button>' +
        '<button type="button" class="pm-wn"><img src="' + esc(P.logo(s)) + '" alt="" width="20" height="20" loading="lazy"><b>' + label(s) + '</b></button><span class="pm-num pm-wc">—</span><span class="pm-num pm-wp">—</span>' +
        (editable() ? '<button type="button" class="pm-ib pm-wx" aria-label="' + esc(T('remove')) + '">' + ic('x') + '</button>' : '') + '</div>';
    }).join('') : '<p class="pm-empty">' + esc(W.ff ? T('noFlagged') : T('emptyList')) + '</p>';
    $$('.pm-wr', wl).forEach(function (r) {
      var s = r.getAttribute('data-s');
      $('.pm-wn', r).onclick = function () { A.applySym(s); };
      $('.pm-wf', r).onclick = function (e) { flagMenu(e.currentTarget, s, box); };
      var x = $('.pm-wx', r); if (x) x.onclick = function () { removeFrom(s); rows(box); };
      r.oncontextmenu = function (e) { e.preventDefault(); rowMenu(r, s, box); };
      paintRow(r, s);
    });
    $$('.pm-wsec', wl).forEach(function (r) {
      var x = r.getAttribute('data-sec');
      $('.pm-wst', r).onclick = function () { W.col = W.col || {}; if (W.col[colKey(x)]) delete W.col[colKey(x)]; else W.col[colKey(x)] = 1; saveW(); rows(box); };
      $('.pm-wsm', r).onclick = function (e) { secMenu(e.currentTarget, x, box); };
      r.oncontextmenu = function (e) { e.preventDefault(); secMenu(r, x, box); };
    });
    summary(box);
  }
  function paintRow(r, s, flash) {
    var t = P.tickers.d[s]; if (!t) return;
    var c = $('.pm-wc', r), p = $('.pm-wp', r);
    c.textContent = fmtP(s, t.c); p.textContent = (t.chg >= 0 ? '+' : '') + (t.chg == null ? '—' : t.chg.toFixed(2) + '%'); p.className = 'pm-num pm-wp ' + (t.chg >= 0 ? 'up' : 'dn');
    if (flash && t.prev != null && t.prev !== t.c) { c.classList.remove('fu', 'fd'); void c.offsetWidth; c.classList.add(t.c > t.prev ? 'fu' : 'fd'); }
    r.title = t.src === 'site' ? T('fromSnapshot') : t.src === 'irt' ? T('computed') : t.src === 'tgju' ? 'tgju.org' : '';
  }
  function summary(box) {
    var e = $('.pm-wsum', box), a = A.active(); if (!e || !a) return;
    var s = a.cfg.sym, t = P.tickers.d[s];
    if (!t) { e.innerHTML = ''; want('sum', [s]); return; }
    var pos = t.h > t.l ? (t.c - t.l) / (t.h - t.l) * 100 : 50;
    var In = P.inst ? P.inst(s) : {}, qv = In && In.kind === 'usdt' ? '$' + P.fmtV(t.q) : In && In.kind === 'irt' ? P.fmtV(t.q) + ' ' + T('toman') : '';
    e.innerHTML = '<div class="pm-sumh"><img src="' + esc(P.logo(s)) + '" alt="" width="22" height="22"><b>' + esc(P.pair(s)) + '</b><span class="pm-num ' + (t.chg >= 0 ? 'up' : 'dn') + '">' + fmtP(s, t.c) + '</span></div>' +
      '<div class="pm-range"><span class="pm-num">' + fmtP(s, t.l) + '</span><i><b style="inset-inline-start:' + pos.toFixed(1) + '%"></b></i><span class="pm-num">' + fmtP(s, t.h) + '</span></div>' +
      '<div class="pm-sumf">' + (qv ? '<span>' + esc(T('vol24')) + ' <b class="pm-num">' + qv + '</b></span>' : '<span></span>') + '<span>' + esc(T('chg24')) + ' <b class="pm-num ' + (t.chg >= 0 ? 'up' : 'dn') + '">' + (t.chg >= 0 ? '+' : '') + (t.chg || 0).toFixed(2) + '%</b></span></div>';
  }
  P.tickers.on(function (s) {
    if (curBox && curBox.isConnected) { var r = curBox.querySelector('.pm-wr[data-s="' + s + '"]'); if (r) paintRow(r, s, true); var a = A.active(); if (a && a.cfg.sym === s) summary(curBox); }
    checkPrice(s);
  });
  function flagMenu(anchor, s, box) {
    var items = Object.keys(FLAGS).map(function (f) { return { label: T('flag_' + f), on: W.flags[s] === f, act: function () { W.flags[s] = f; saveW(); rows(box); } }; });
    items.push({ label: T('noFlag'), act: function () { delete W.flags[s]; saveW(); rows(box); } });
    var m = A.menu(anchor, items); $$('.pm-mi', m).forEach(function (b, i) { var f = Object.keys(FLAGS)[i]; if (f) b.style.setProperty('--c', FLAGS[f]); b.classList.add('pm-flagi'); });
  }
  function secName(cb, cur) {
    A.ask(cur ? T('renameSection') : T('addSection'), cur || '', function (n) {
      n = (n || '').replace(/[§<>]/g, '').trim().slice(0, 30); if (!n) return;
      if (sections().indexOf('§' + n) >= 0 && '§' + n !== '§' + cur) { A.toast(T('sectionExists')); return; }
      cb('§' + n);
    }, T('sectionName'));
  }
  function secMenu(anchor, x, box) {
    A.menu(anchor, [
      { label: T('renameSection'), act: function () { secName(function (n) { setLayout(layout().map(function (y) { return y === x ? n : y; })); if (W.col && W.col[colKey(x)]) { delete W.col[colKey(x)]; W.col[colKey(n)] = 1; saveW(); } rows(box); }, x.slice(1)); } },
      { label: T('addSymHere'), icon: 'plus', act: function () { pickSym(function (s2) { var L = layout().filter(function (y) { return y !== s2; }), i = L.indexOf(x) + 1; while (i < L.length && !isSec(L[i])) i++; L.splice(i, 0, s2); setLayout(L); rows(box); }); } },
      { label: T('removeSection'), icon: 'trash', act: function () { setLayout(layout().filter(function (y) { return y !== x; })); rows(box); A.toast(T('sectionRemoved')); } }
    ]);
  }
  function moveTo(s, sec, box) {                          /* to the end of a section, or to the top (no section) */
    var L = layout().filter(function (y) { return y !== s; }), i;
    if (!sec) { i = 0; while (i < L.length && !isSec(L[i])) i++; }
    else { i = L.indexOf(sec) + 1; while (i < L.length && !isSec(L[i])) i++; }
    L.splice(i, 0, s); setLayout(L); rows(box);
  }
  function rowMenu(anchor, s, box) {
    var items = [{ label: T('openChart'), act: function () { A.applySym(s); } }, { label: T('newAlert'), icon: 'bell', act: function () { A.applySym(s); P.alertDialog(A.active()); } }];
    if (editable()) items.push({ label: T('remove'), icon: 'trash', act: function () { removeFrom(s); rows(box); } });
    if (editable() && sections().length) {
      items.push({ head: T('moveToSection') }, { label: T('noSection'), act: function () { moveTo(s, null, box); } });
      sections().forEach(function (x) { items.push({ label: x.slice(1), act: function () { moveTo(s, x, box); } }); });
    }
    var others = [{ k: 'site', n: T('myList') }].concat(W.lists.map(function (l, i) { return { k: String(i), n: l.n }; })).filter(function (l) { return l.k !== String(W.cur); });
    if (others.length) { items.push({ head: T('copyTo') }); others.forEach(function (l) { items.push({ label: l.n, act: function () { var cur = W.cur; W.cur = l.k; addTo(s); W.cur = cur; saveW(); A.toast(T('added', { n: s })); } }); }); }
    A.menu(anchor, items);
  }
  function listMenu(anchor, box) {
    var items = [{ label: T('newList'), icon: 'plus', act: function () { A.ask(T('newList'), '', function (n) { if (!n) return; W.lists.push({ n: n.slice(0, 30), s: [] }); W.cur = String(W.lists.length - 1); saveW(); drawWatch(box); }, T('listName')); } }];
    if (editable()) items.push({ label: T('addSection'), icon: 'plus', act: function () { secName(function (n) { var L = layout(); L.push(n); setLayout(L); W.sort = null; W.ff = null; saveW(); drawWatch(box); A.toast(T('sectionAdded')); }); } });
    if (W.cur !== 'site' && W.cur !== 'top') {
      var L = W.lists[W.cur | 0];
      items.push({ label: T('renameList'), act: function () { A.ask(T('renameList'), L.n, function (n) { if (n) { L.n = n.slice(0, 30); saveW(); drawWatch(box); } }); } },
        { label: T('deleteList'), icon: 'trash', act: function () { A.confirm(T('deleteList'), T('deleteListQ', { n: L.n }), function () { W.lists.splice(W.cur | 0, 1); W.cur = 'site'; saveW(); drawWatch(box); }); } });
    }
    items.push({ sep: true }, { label: T('sendBot'), icon: 'share', act: function () {
      var s = listSyms().filter(function (x) { return /^[A-Z0-9]{1,10}$/.test(x); }), arg = 'w_', n = 0;
      for (var i = 0; i < s.length; i++) { if ((arg + s[i]).length + (n ? 1 : 0) > 64) break; arg += (n ? '-' : '') + s[i]; n++; }
      window.open('https://t.me/' + BOT + '?start=' + arg, '_blank', 'noopener');
    } });
    A.menu(anchor, items);
  }
  function pickSym(cb) {                               /* add any symbol of any market to a list */
    var box = h('<div class="pm-ss"><input class="pm-in" type="search" autocomplete="off"><div class="pm-ssl"></div></div>'), inp = $('input', box), list = $('.pm-ssl', box), U = null;
    inp.placeholder = T('searchSym');
    function draw() {
      var raw = inp.value.trim(), q = raw.toUpperCase(), low = raw.toLowerCase();
      var r = (U || []).filter(function (x) { var I = P.inst(x); return !raw || x.indexOf(q) >= 0 || (I && I.name && (I.name.fa + ' ' + I.name.ckb + ' ' + I.name.ar + ' ' + I.name.en).toLowerCase().indexOf(low) >= 0); }).slice(0, 80);
      list.innerHTML = r.map(function (x) { return '<button type="button" class="pm-ssi" data-s="' + x + '"><img src="' + esc(P.logo(x)) + '" alt="" width="22" height="22" loading="lazy"><b>' + esc(P.pair(x)) + '</b></button>'; }).join('') || '<p class="pm-empty">' + esc(U ? T('noMatch') : T('loading')) + '</p>';
      $$('[data-s]', list).forEach(function (b) { b.onclick = function () { A.closeModal(); cb(b.getAttribute('data-s')); }; });
    }
    inp.oninput = draw; A.modal(T('addSym'), box);
    (P.markets ? P.markets().then(function (m) { return m.ir.concat(m.usdt, m.irt); }) : P.universe()).then(function (u) { U = u; draw(); }); draw();
  }
  A.panels.watch = drawWatch;
  A.on('active', function () { if (curBox && curBox.isConnected) rows(curBox); });
  A.on('sym', function () { if (curBox && curBox.isConnected) rows(curBox); });

  /* ================================================================ ALERTS */
  var AL = S.get('ek_pro_alerts', []); if (!Array.isArray(AL)) AL = [];
  var LOG = S.get('ek_pro_alert_log', []); if (!Array.isArray(LOG)) LOG = [];
  var MAXAL = 1000;                                   /* price alerts kept here; indicator alerts stay at 12 (they each watch a feed) */
  AL = AL.filter(function (a) { return a && A.SYM_RE.test(a.sym) && (a.k === 'price' || a.k === 'ind' || a.k === 'draw'); }).slice(0, MAXAL);
  function saveAL() { S.set('ek_pro_alerts', AL); S.set('ek_pro_alert_log', LOG.slice(0, 100)); refreshAlertViews(); }
  P.logos().then(function (L) {                        /* never a coin without its logo: alerts and lists follow the logo index */
    if (!L) return;
    var n = AL.length; AL = AL.filter(function (a) { return L.has(a.sym); }); if (AL.length !== n) { saveAL(); syncIndSubs(); }
    if (curBox && curBox.isConnected) drawWatch(curBox);
  });
  var lastPx = {};
  var PCT = { pup: 1, pdn: 1, pmv: 1 };                 /* moves of n% from the price when the alert was set */
  function targets(a) {
    var b = a.base; if (!PCT[a.c]) return [a.v]; if (!(b > 0)) return [];
    return a.c === 'pup' ? [b * (1 + a.v / 100)] : a.c === 'pdn' ? [b * (1 - a.v / 100)] : [b * (1 + a.v / 100), b * (1 - a.v / 100)];
  }
  P.alertLines = function (sym) { var o = []; AL.forEach(function (a) { if (a.on && a.k === 'price' && a.sym === sym) targets(a).forEach(function (v) { o.push({ v: v }); }); }); return o; };
  /* alerts on drawn lines: the line's price where it is now (a sloped line moves; a channel has two sides) */
  function drawingOf(a) { var L = (A.DRAW()[a.sym] || []); for (var i = 0; i < L.length; i++) if (L[i].id === a.did) return L[i]; return null; }
  function lineAt(d, t) {
    var a = d.pts[0], b = d.pts[1]; if (!a || !b || a.t === b.t) return null;
    var lo = Math.min(a.t, b.t), hi = Math.max(a.t, b.t), ext = d.s && d.s.r;
    if ((d.k === 'trend' || d.k === 'channel') && (t < lo || (t > hi && !ext))) return null;
    if (d.k === 'ray' && (b.t > a.t ? t < a.t : t > a.t)) return null;
    return a.p + (b.p - a.p) * (t - a.t) / (b.t - a.t);
  }
  function levelsAt(a, t) {
    var d = drawingOf(a); if (!d) return null;
    var v = lineAt(d, t); if (v == null) return null;
    if (d.k !== 'channel') return [v, v];
    var c = d.pts[2]; if (!c) return null;
    var off = c.p - lineAt({ k: 'ext', pts: d.pts }, c.t); return [Math.min(v, v + off), Math.max(v, v + off)];
  }
  P.alertLevels = levelsAt;           /* exposed for the tests */
  function condText(a) {
    if (a.k === 'price') return PCT[a.c] ? T('c_' + a.c) + ' ' + a.v + '% (' + targets(a).map(function (v) { return fmtP(a.sym, v); }).join(' / ') + ')' : T('c_' + a.c) + ' ' + fmtP(a.sym, a.v);
    if (a.k === 'draw') return T('dc_' + a.c) + ' · ' + T('t_' + a.dk) + (drawingOf(a) ? '' : ' (' + T('lineGone') + ')');
    var x = a.ind, nm = T('ai_' + x.id) + (x.len ? ' (' + x.len + (x.len2 ? '/' + x.len2 : '') + ')' : '');
    return nm + ' · ' + T('ac_' + x.id + '_' + a.c, { v: a.v }) + ' · ' + A.tfLabel(a.tf);
  }
  function fire(a, msg) {
    var now = Date.now(); a.last = now; a.n = (a.n || 0) + 1;
    if (a.mode !== 'every') a.on = false;
    LOG.unshift({ t: now, id: a.id, sym: a.sym, msg: msg });
    saveAL();
    A.toast('🔔 ' + msg, 'long');
    if (A.st().sound) beep();
    if (window.Notification && Notification.permission === 'granted') { try { new Notification('entekhab.net · ' + a.sym, { body: msg, tag: 'ekpro-' + a.id, icon: '/assets/icon-192.png' }); } catch (e) { } }
    A.cells().forEach(function (c) { if (c.cfg.sym === a.sym) c.ovl.update(); });
  }
  function beep() {
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return; var ctx = beep.c || (beep.c = new C());
      [0, 0.18].forEach(function (dt, k) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = k ? 1046 : 784; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.0001, ctx.currentTime + dt); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dt + 0.16); o.start(ctx.currentTime + dt); o.stop(ctx.currentTime + dt + 0.18); });
    } catch (e) { }
  }
  /* price alerts: checked on every live price of the coin */
  function checkPrice(sym) {
    var t = P.tickers.d[sym]; if (!t) return;
    var p = t.c, q = lastPx[sym], now = Date.now(); lastPx[sym] = p;
    AL.forEach(function (a) {
      if (!a.on || a.sym !== sym || (a.k !== 'price' && a.k !== 'draw')) return;
      if (a.exp && now > a.exp) return;
      var prev = a.px != null ? a.px : q; a.px = p;
      if (prev == null) return;
      var at = function (v, c) { return c === 'cross' ? ((prev < v && p >= v) || (prev > v && p <= v)) : c === 'up' ? (prev < v && p >= v) : c === 'down' ? (prev > v && p <= v) : c === 'gt' ? p > v : c === 'lt' ? p < v : false; };
      var hit = false, msg;
      if (a.k === 'draw') {
        var L = levelsAt(a, now / 1000); if (!L) return;
        hit = a.c === 'cross' ? at(L[0], 'cross') : a.c === 'up' || a.c === 'cup' ? at(L[1], 'up') : a.c === 'down' || a.c === 'cdown' ? at(L[0], 'down') : a.c === 'out' ? at(L[1], 'up') || at(L[0], 'down') : false;
        msg = P.pair(sym) + ' · ' + condText(a) + ' (' + fmtP(sym, p >= L[1] ? L[1] : L[0]) + ') — ' + T('nowAt') + ' ' + fmtP(sym, p);
      } else {
        var tg = targets(a); if (!tg.length) return;
        hit = a.c === 'pup' ? at(tg[0], 'up') : a.c === 'pdn' ? at(tg[0], 'down') : a.c === 'pmv' ? at(tg[0], 'up') || at(tg[1], 'down') : at(a.v, a.c);
        msg = P.pair(sym) + ' ' + condText(a) + ' — ' + T('nowAt') + ' ' + fmtP(sym, p);
      }
      if (!hit) return;
      if (a.mode === 'every' && a.last && now - a.last < 60000) return;
      if (PCT[a.c] && a.mode === 'every') a.base = p;              /* every n%: the next move counts from here */
      fire(a, msg + (a.msg ? ' · ' + a.msg : ''));
    });
  }
  /* expiry: an alert with an end date switches itself off */
  function sweep() {
    var now = Date.now(), ch = false;
    AL.forEach(function (a) { if (a.on && a.exp && now > a.exp) { a.on = false; a.expd = 1; ch = true; LOG.unshift({ t: now, id: a.id, sym: a.sym, msg: P.pair(a.sym) + ' · ' + condText(a) + ' · ' + T('expired') }); } });
    if (ch) { saveAL(); syncIndSubs(); A.cells().forEach(function (c) { c.ovl.update(); }); }
  }
  setInterval(sweep, 30000);
  P._alerts = function () { return AL; }; P._alertSweep = sweep;      /* for the tests */
  /* indicator alerts: checked when a bar of the alert's timeframe closes */
  var indSubs = {};
  function syncIndSubs() {
    var need = {};
    AL.forEach(function (a) { if (a.on && a.k === 'ind') need[a.sym + '|' + a.tf] = 1; });
    Object.keys(indSubs).forEach(function (k) { if (!need[k]) { indSubs[k].off(); delete indSubs[k]; } });
    Object.keys(need).forEach(function (k) {
      if (indSubs[k]) return; var sp = k.split('|');
      indSubs[k] = P.feed(sp[0], sp[1], function (what, F, x) { if (what === 'tick' && x.closed) checkInd(sp[0], sp[1], F.bars); });
    });
    want('alerts', AL.filter(function (a) { return a.on && (a.k === 'price' || a.k === 'draw'); }).map(function (a) { return a.sym; }));
  }
  function indSeries(a, bars) {
    var x = a.ind, I = P.ind;
    if (x.id === 'rsi') return { v: I.compute('rsi', bars, { len: x.len }).v };
    if (x.id === 'ma') { var m = I.compute(x.ma === 'sma' ? 'sma' : 'ema', bars, { len: x.len }).v; return { v: bars.map(function (b) { return b.c; }), ref: m }; }
    if (x.id === 'macd') { var r = I.compute('macd', bars, {}); return { v: r.macd, ref: r.signal }; }
    if (x.id === 'bb') { var bb = I.compute('bb', bars, { len: x.len || 20, mult: 2 }); return { v: bars.map(function (b) { return b.c; }), up: bb.up, lo: bb.lo }; }
    if (x.id === 'st') return { v: I.compute('st', bars, { len: x.len || 10, mult: 3 }).dir };
    if (x.id === 'stoch') return { v: I.compute('stoch', bars, { len: x.len || 14, k: 3, d: 3 }).k };
    if (x.id === 'vol') { var vv = bars.map(function (b) { return b.v || 0; }); return { v: vv, ref: I.sma(vv, x.len || 20) }; }
    if (x.id === 'xma') return { v: I.compute('ema', bars, { len: x.len || 9 }).v, ref: I.compute('ema', bars, { len: x.len2 || 21 }).v };
    return null;
  }
  function evalInd(a, bars) {
    var n = bars.length; if (n < 3) return false;
    var s = indSeries(a, bars); if (!s) return false;
    var i = n - 1, j = n - 2, v1 = s.v[i], v0 = s.v[j], ok = P.ind.ok;
    if (!ok(v1) || !ok(v0)) return false;
    if (a.ind.id === 'rsi' || a.ind.id === 'stoch') { var L = a.v; return a.c === 'up' ? v0 < L && v1 >= L : a.c === 'down' ? v0 > L && v1 <= L : a.c === 'gt' ? v1 > L : v1 < L; }
    if (a.ind.id === 'st') return a.c === 'up' ? v0 > 0 && v1 < 0 : v0 < 0 && v1 > 0;          /* dir < 0: the line is under the price */
    if (a.ind.id === 'vol') return ok(s.ref[j]) && s.ref[j] > 0 && v1 >= a.v * s.ref[j] && !(v0 >= a.v * (s.ref[j - 1] || Infinity));
    if (a.ind.id === 'bb') return a.c === 'gt' ? ok(s.up[i]) && v1 > s.up[i] : ok(s.lo[i]) && v1 < s.lo[i];
    var r1 = s.ref[i], r0 = s.ref[j]; if (!ok(r1) || !ok(r0)) return false;
    return a.c === 'up' ? v0 < r0 && v1 >= r1 : v0 > r0 && v1 <= r1;
  }
  function checkInd(sym, tf, bars) {
    AL.forEach(function (a) {
      if (!a.on || a.k !== 'ind' || a.sym !== sym || a.tf !== tf || (a.exp && Date.now() > a.exp)) return;
      var lastT = bars[bars.length - 1].t; if (a.bar === lastT) return;
      if (evalInd(a, bars)) { a.bar = lastT; fire(a, P.pair(sym) + ' · ' + condText(a) + (a.msg ? ' · ' + a.msg : '')); }
    });
  }
  P.alertEval = evalInd;              /* exposed for the tests */
  function addAlert(a) { AL.unshift(a); if (AL.length > MAXAL) AL.length = MAXAL; saveAL(); syncIndSubs(); A.cells().forEach(function (c) { c.ovl.update(); }); }
  P.alertDialog = function (cell, preset) {
    preset = preset || {};
    var sym = cell.cfg.sym, last = cell.bars.length ? cell.bars[cell.bars.length - 1].c : (P.tickers.d[sym] || {}).c, dd = preset.draw || null;
    var kind = preset.kind || (dd ? 'draw' : 'price');
    var f = h('<form class="pm-af">' +
      '<div class="pm-afsym"><img src="' + esc(P.logo(sym)) + '" alt="" width="22" height="22"><b>' + esc(P.pair(sym)) + '</b>' + (last ? '<span class="pm-num">' + fmtP(sym, last) + '</span>' : '') + '</div>' +
      '<div class="pm-seg" role="tablist"><button type="button" data-k="price"></button><button type="button" data-k="ind"></button>' + (dd ? '<button type="button" data-k="draw"></button>' : '') + '</div>' +
      '<div class="pm-afp"><label class="pm-field"><span data-t="cond"></span><select class="pm-in" name="c"></select></label><label class="pm-field"><span class="pm-vl"></span><input class="pm-in" name="v" type="number" step="any" inputmode="decimal" required></label><p class="pm-note pm-tgt"></p></div>' +
      '<div class="pm-afd" hidden><label class="pm-field"><span data-t="cond"></span><select class="pm-in" name="dc"></select></label><p class="pm-note pm-dnow"></p><p class="pm-note" data-t="drawNote"></p></div>' +
      '<div class="pm-afi" hidden><label class="pm-field"><span data-t="indicator"></span><select class="pm-in" name="ind"></select></label><label class="pm-field pm-len"><span data-t="length"></span><input class="pm-in" name="len" type="number" min="2" max="400" value="14"></label>' +
      '<label class="pm-field pm-len2"><span data-t="slowLen"></span><input class="pm-in" name="len2" type="number" min="3" max="400" value="21"></label>' +
      '<label class="pm-field pm-mat"><span data-t="maType"></span><select class="pm-in" name="ma"><option value="ema">EMA</option><option value="sma">SMA</option></select></label>' +
      '<label class="pm-field"><span data-t="cond"></span><select class="pm-in" name="ic"></select></label><label class="pm-field pm-lvl"><span class="pm-lvt"></span><input class="pm-in" name="lv" type="number" step="any" value="70"></label>' +
      '<label class="pm-field"><span data-t="tf"></span><select class="pm-in" name="tf"></select></label></div>' +
      '<div class="pm-af2"><label class="pm-field"><span data-t="trigger"></span><select class="pm-in" name="mode"><option value="once"></option><option value="every"></option></select></label>' +
      '<label class="pm-field"><span data-t="expires"></span><select class="pm-in" name="exp"></select></label></div>' +
      '<label class="pm-field"><span data-t="message"></span><input class="pm-in" name="msg" maxlength="80"></label>' +
      '<div class="pm-checks"><label><input type="checkbox" name="nt" checked> <span data-t="notif"></span></label><label class="pm-tgl"><input type="checkbox" name="tg"> <span data-t="tgAlso"></span></label></div>' +
      '<p class="pm-note" data-t="alertNote"></p><div class="pm-row"><button class="pm-btn pri" type="submit" data-t="create"></button></div></form>');
    $$('[data-t]', f).forEach(function (e) { e.textContent = T(e.getAttribute('data-t')); });
    $('[data-k="price"]', f).textContent = T('priceAlert'); $('[data-k="ind"]', f).textContent = T('indAlert'); if (dd) $('[data-k="draw"]', f).textContent = T('drawAlert');
    var C = $('[name=c]', f); ['cross', 'up', 'down', 'gt', 'lt', 'pup', 'pdn', 'pmv'].forEach(function (c) { C.appendChild(new Option(T('c_' + c), c)); });
    var V = $('[name=v]', f), pxV = preset.price != null ? +(+preset.price).toPrecision(8) : last ? +last.toPrecision(8) : '';
    V.value = pxV;
    function priceUI() {
      var pc = !!PCT[C.value]; $('.pm-vl', f).textContent = T(pc ? 'valuePct' : 'value');
      if (pc && (+V.value > 100 || !(+V.value > 0))) V.value = 5; if (!pc && +V.value <= 100 && pxV > 100) V.value = pxV;
      var tg = pc && last ? targets({ c: C.value, v: +V.value, base: last }) : [];
      $('.pm-tgt', f).textContent = tg.length ? T('pctTargets', { p: fmtP(sym, last), t: tg.map(function (v) { return fmtP(sym, v); }).join(' / ') }) : '';
      var ok2 = !pc && botArg({ sym: sym, v: +V.value || 1 }); $('.pm-tgl', f).hidden = kind !== 'price' || !ok2;
    }
    C.onchange = priceUI; V.oninput = priceUI;
    if (dd) {
      var DC = $('[name=dc]', f); (dd.k === 'channel' ? ['out', 'cup', 'cdown'] : ['cross', 'up', 'down']).forEach(function (c) { DC.appendChild(new Option(T('dc_' + c), c)); });
      var L0 = levelsAt({ sym: sym, did: dd.id }, Date.now() / 1000);
      $('.pm-dnow', f).textContent = L0 ? T('lineNow', { p: L0[0] === L0[1] ? fmtP(sym, L0[0]) : fmtP(sym, L0[0]) + ' – ' + fmtP(sym, L0[1]) }) : T('lineEnded');
    }
    var IN = $('[name=ind]', f); ['rsi', 'ma', 'xma', 'macd', 'bb', 'st', 'stoch', 'vol'].forEach(function (x) { IN.appendChild(new Option(T('ai_' + x), x)); });
    var TF = $('[name=tf]', f); A.st().fav.concat([cell.cfg.tf]).filter(function (x, i, a) { return a.indexOf(x) === i && P.parseTF(x).sec >= 60; }).forEach(function (x) { TF.appendChild(new Option(A.tfLabel(x), x)); }); TF.value = P.parseTF(cell.cfg.tf).sec >= 60 ? cell.cfg.tf : '1h';
    var M = $('[name=mode]', f); M.options[0].textContent = T('once'); M.options[1].textContent = T('every');
    var EX = $('[name=exp]', f); [['0', 0], ['h', 3600e3], ['d', 86400e3], ['w', 7 * 86400e3], ['m', 30 * 86400e3]].forEach(function (x) { var o = new Option(T('exp_' + x[0]), String(x[1])); EX.appendChild(o); });
    var LEN = { rsi: 14, bb: 20, ma: 50, xma: 9, st: 10, stoch: 14, vol: 20 }, LV = { rsi: 70, stoch: 80, vol: 2 };
    function indUI() {
      var id = IN.value, ic2 = $('[name=ic]', f); ic2.innerHTML = '';
      (id === 'bb' ? ['gt', 'lt'] : id === 'rsi' ? ['up', 'down', 'gt', 'lt'] : id === 'vol' ? ['gt'] : ['up', 'down']).forEach(function (c) { ic2.appendChild(new Option(T('ac_' + id + '_' + c, { v: '…' }), c)); });
      $('.pm-len', f).hidden = id === 'macd'; $('.pm-len2', f).hidden = id !== 'xma'; $('.pm-mat', f).hidden = id !== 'ma'; $('.pm-lvl', f).hidden = !LV[id];
      $('.pm-lvt', f).textContent = T({ vol: 'volTimes' }[id] || 'level');
      $('[name=len]', f).value = LEN[id] || 14; if (LV[id]) $('[name=lv]', f).value = LV[id];
    }
    IN.onchange = indUI; indUI();
    function setKind(k) {
      kind = k; $$('.pm-seg button', f).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-k') === k); });
      $('.pm-afp', f).hidden = k !== 'price'; $('.pm-afi', f).hidden = k !== 'ind'; $('.pm-afd', f).hidden = k !== 'draw'; V.required = k === 'price'; priceUI();
    }
    $$('.pm-seg button', f).forEach(function (b) { b.onclick = function () { setKind(b.getAttribute('data-k')); }; }); setKind(kind);
    f.onsubmit = function (e) {
      e.preventDefault();
      var a = { id: P.uid(), sym: sym, k: kind, mode: M.value, on: true, at: Date.now(), msg: $('[name=msg]', f).value.trim().slice(0, 80) };
      var ex = +EX.value; if (ex > 0) a.exp = Date.now() + ex;
      if (kind === 'price') {
        a.c = C.value; a.v = +V.value; if (!(a.v > 0) || (PCT[a.c] && a.v >= 100 && a.c !== 'pup')) { A.toast(T('badValue')); return; }
        a.px = last || null; if (PCT[a.c]) { if (!(last > 0)) { A.toast(T('loading')); return; } a.base = last; }
      } else if (kind === 'draw') {
        if (!dd || !levelsAt({ sym: sym, did: dd.id }, Date.now() / 1000)) { A.toast(T('lineEnded')); return; }
        a.c = $('[name=dc]', f).value; a.did = dd.id; a.dk = dd.k; a.px = last || null;
      } else {
        var id = IN.value, len = Math.max(2, Math.min(400, Math.round(+$('[name=len]', f).value || 14)));
        a.ind = { id: id }; if (id !== 'macd') a.ind.len = len; if (id === 'ma') a.ind.ma = $('[name=ma]', f).value;
        if (id === 'xma') { a.ind.len2 = Math.max(3, Math.min(400, Math.round(+$('[name=len2]', f).value || 21))); if (a.ind.len2 <= len) { A.toast(T('fastSlowAl')); return; } }
        a.c = $('[name=ic]', f).value; a.tf = TF.value;
        if (LV[id]) { a.v = +$('[name=lv]', f).value; if (!(id === 'vol' ? a.v > 1 && a.v <= 50 : a.v >= 0 && a.v <= 100)) { A.toast(T('badValue')); return; } }
        if (AL.filter(function (z) { return z.on && z.k === 'ind'; }).length >= 12) { A.toast(T('maxIndAlerts')); return; }
      }
      var wantNt = $('[name=nt]', f).checked, tg = kind === 'price' && !PCT[a.c] && $('[name=tg]', f).checked;
      A.closeModal(); addAlert(a); A.toast(T('alertSet', { c: P.pair(sym) + ' · ' + condText(a) }));
      if (wantNt && window.Notification && Notification.permission === 'default') Notification.requestPermission().then(refreshAlertViews);
      if (tg) sendToBot(a);
    };
    A.modal(T('newAlert'), f);
  };
  /* Telegram: the bot watches the price even when this page is closed (t.me deep link; the bot asks before saving) */
  /* a plain decimal with up to 10 significant digits (never "6e-7"): the bot reads it back exactly */
  function plainNum(v) {
    v = +v; if (!(v > 1e-15) || v >= 1e12) return '';
    var s = v.toFixed(Math.max(0, Math.min(18, 9 - Math.floor(Math.log10(v)))));
    return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, '');
  }
  P._plainNum = plainNum;
  /* the bot watches dollar coins (a_<COIN>_<PRICE>) and Iran's prices in toman (t_<ASSET>_<PRICE>, its own asset names);
     coins in toman are computed here, so they stay on this page */
  var BOT_IR = { USD: 'USD', EUR: 'EUR', GBP: 'GBP', AED: 'AED', TRY: 'TRY', GERAM18: 'GOLD_18', MESGHAL: 'GOLD_MESGHAL', SEKEE: 'COIN_EMAMI', USDT: 'USDT' };
  function botArg(a) {
    var I = P.inst ? P.inst(a.sym) : null, v = plainNum(a.v);
    if (!I || !/^\d{1,12}(\.\d{1,18})?$/.test(v)) return null;
    if (I.kind === 'usdt' && /^[A-Z0-9]{1,12}$/.test(a.sym)) return 'a_' + a.sym + '_' + v.replace('.', 'd');
    if (I.kind === 'ir' && BOT_IR[I.base]) return 't_' + BOT_IR[I.base] + '_' + v.replace('.', 'd');
    return null;
  }
  P._botArg = botArg;
  function sendToBot(a) {
    var arg = botArg(a);
    if (!arg) { A.toast(T('badValue')); return; }
    window.open('https://t.me/' + BOT + '?start=' + arg, '_blank', 'noopener');
  }
  var alertBox = null;
  function drawAlerts(box) {
    alertBox = box;
    var perm = window.Notification ? Notification.permission : 'na';
    box.innerHTML = '<div class="pm-ph"><b>' + esc(T('alerts')) + '</b><span class="pm-grow"></span><button type="button" class="pm-btn pri sm" data-a="new">' + ic('plus') + ' ' + esc(T('newAlert')) + '</button></div>' +
      (perm === 'default' ? '<button type="button" class="pm-btn wide" data-a="perm">🔔 ' + esc(T('allowNotif')) + '</button>' : perm === 'denied' ? '<p class="pm-note">' + esc(T('notifDenied')) + '</p>' : '') +
      '<label class="pm-field pm-nal"><span>📰 ' + esc(T('newsAl')) + '</span><select class="pm-in" name="na">' + ['off', 'watch', 'imp', 'all'].map(function (k) { return '<option value="' + k + '"' + (NA.m === k ? ' selected' : '') + '>' + esc(T('na_' + k)) + '</option>'; }).join('') + '</select><small>' + esc(T('newsAlNote')) + '</small></label>' +
      '<div class="pm-al"></div><h4 class="pm-h4">' + esc(T('alertLog')) + '</h4><div class="pm-alog"></div><p class="pm-note">' + esc(T('alertsHow')) + '</p>';
    $('[data-a="new"]', box).onclick = function () { P.alertDialog(A.active()); };
    $('[name="na"]', box).onchange = function () {
      NA = { m: this.value, since: Date.now() }; S.set('ek_pro_newsal', NA);
      if (NA.m !== 'off') { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); newsPoll(); }
    };
    var pb = $('[data-a="perm"]', box); if (pb) pb.onclick = function () { Notification.requestPermission().then(function () { drawAlerts(box); }); };
    var al = $('.pm-al', box);
    al.innerHTML = AL.length ? AL.map(function (a) {
      return '<div class="pm-ar' + (a.on ? '' : ' off') + '" data-id="' + esc(a.id) + '"><img src="' + esc(P.logo(a.sym)) + '" alt="" width="20" height="20"><div class="pm-arb"><b>' + esc(P.pair(a.sym)) + '</b> <span>' + esc(condText(a)) + '</span><small>' +
        esc(T(a.mode === 'every' ? 'every' : 'once')) + (a.n ? ' · ' + esc(T('fired', { n: A.loc(a.n) })) : '') + (a.exp ? ' · ' + esc(a.expd || Date.now() > a.exp ? T('expired') : T('expUntil', { t: A.fmtD(Math.floor(a.exp / 1000)) })) : '') + (a.msg ? ' · ' + esc(a.msg) : '') + '</small></div>' +
        (a.k === 'price' && !PCT[a.c] && botArg(a) ? '<button type="button" class="pm-ib" data-a="tg" title="' + esc(T('tgAlso')) + '">✈</button>' : '') +
        '<button type="button" class="pm-ib" data-a="tog" title="' + esc(T(a.on ? 'pause' : 'resume')) + '">' + ic(a.on ? 'pause' : 'play') + '</button><button type="button" class="pm-ib" data-a="del" title="' + esc(T('remove')) + '">' + ic('trash') + '</button></div>';
    }).join('') : '<p class="pm-empty">' + esc(T('noAlerts')) + '</p>';
    $$('.pm-ar', al).forEach(function (r) {
      var a = AL.filter(function (z) { return z.id === r.getAttribute('data-id'); })[0]; if (!a) return;
      $$('button', r).forEach(function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-a');
          if (k === 'del') AL = AL.filter(function (z) { return z !== a; });
          if (k === 'tog') { a.on = !a.on; if (a.on && (a.k === 'price' || a.k === 'draw')) a.px = (P.tickers.d[a.sym] || {}).c || null; if (a.on && a.exp && Date.now() > a.exp) { delete a.exp; delete a.expd; } }
          if (k === 'tg') { sendToBot(a); return; }
          saveAL(); syncIndSubs(); A.cells().forEach(function (c) { c.ovl.update(); });
        };
      });
    });
    var lg = $('.pm-alog', box);
    lg.innerHTML = LOG.length ? LOG.slice(0, 30).map(function (x) { return '<div class="pm-lgr"><small>' + esc(A.fmtD(Math.floor(x.t / 1000))) + '</small> ' + esc(x.msg) + '</div>'; }).join('') + '<button type="button" class="pm-link" data-a="clr">' + esc(T('clearLog')) + '</button>' : '<p class="pm-empty">' + esc(T('noLog')) + '</p>';
    var cl = $('[data-a="clr"]', lg); if (cl) cl.onclick = function () { LOG = []; saveAL(); };
  }
  function refreshAlertViews() { if (alertBox && alertBox.isConnected) drawAlerts(alertBox); }
  /* news alerts: the site's four-language headline reel (data/newsreel.json, ~13 KB), read every 5 minutes while the page is open */
  var NA = S.get('ek_pro_newsal', null); if (!NA || typeof NA !== 'object' || ['off', 'watch', 'imp', 'all'].indexOf(NA.m) < 0) NA = { m: 'off' };
  var NSEEN = (function () { var a = S.get('ek_pro_newsseen', null); if (!Array.isArray(a)) return null; var o = {}; a.forEach(function (x) { o[x] = 1; }); return o; })();
  var NIMP = { regulation: 1, security: 1, etf_institutional: 1 };
  function newsMatch(it) {
    if (NA.m === 'all') return true;
    if (NA.m === 'imp') return !!NIMP[it.cat];
    if (NA.m !== 'watch') return false;
    var w = siteList().map(function (x) { var b = x.replace(/_IRT$/, ''); return b === 'XAUT' || b === 'PAXG' ? 'GOLD' : b; });
    return (it.coins || []).some(function (c) { return w.indexOf(c) >= 0; });
  }
  function newsText(it) { var t = it.t || {}; return t[A.LANG()] || t.en || ''; }
  function newsFire(it) {
    var msg = '📰 ' + newsText(it) + (it.source ? ' — ' + it.source : '');
    LOG.unshift({ t: Date.now(), id: 'news:' + it.id, sym: 'BTC', msg: msg }); saveAL();
    A.toast(msg, 'long'); if (A.st().sound) beep();
    if (window.Notification && Notification.permission === 'granted') {
      try { var n = new Notification('entekhab.net · ' + T('newsTitle'), { body: newsText(it), tag: 'eknews-' + it.id, icon: '/assets/icon-192.png' }); if (/^https?:\/\//.test(it.url || '')) n.onclick = function () { window.open(it.url, '_blank', 'noopener'); }; } catch (e) { }
    }
  }
  function newsPoll() {
    if (NA.m === 'off' || document.hidden) return Promise.resolve(0);
    return P.getJSON('/data/newsreel.json?v=' + Math.floor(Date.now() / 3e5)).then(function (j) {
      var items = j && Array.isArray(j.items) ? j.items : []; if (!items.length) return 0;
      var first = !NSEEN; if (first) NSEEN = {};
      var fresh = items.filter(function (it) { var nw = it && it.id && !NSEEN[it.id]; if (it && it.id) NSEEN[it.id] = 1; return nw && !first && Date.parse(it.at) > (NA.since || 0) - 3600e3 && newsMatch(it); });
      S.set('ek_pro_newsseen', Object.keys(NSEEN).slice(-300));
      fresh.slice(0, 3).forEach(newsFire);
      if (fresh.length > 3) A.toast(T('newsMany', { n: A.loc(fresh.length) }));
      return fresh.length;
    }, function () { return 0; });
  }
  P._newsPoll = newsPoll;              /* for the tests */
  setInterval(newsPoll, 300000); setTimeout(newsPoll, 5000);
  A.panels.alerts = drawAlerts;
  /* another tab of this browser changed alerts or lists: take its copy, so neither tab overwrites the other */
  A.on('storage', function (key) {
    if (key === 'ek_pro_alerts' || key === 'ek_pro_alert_log') {
      var na = S.get('ek_pro_alerts', []), nl = S.get('ek_pro_alert_log', []);
      if (Array.isArray(na)) AL = na.filter(function (a) { return a && A.SYM_RE.test(a.sym) && (a.k === 'price' || a.k === 'ind' || a.k === 'draw'); }).slice(0, MAXAL);
      if (Array.isArray(nl)) LOG = nl;
      syncIndSubs(); refreshAlertViews(); A.cells().forEach(function (c) { c.ovl.update(); });
    }
    if (key === 'ek_pro_watch' || key === 'ek_watch') {
      var nw = S.get('ek_pro_watch', null); if (nw && typeof nw === 'object' && Array.isArray(nw.lists)) { var cur = W.cur; W = nw; W.cur = cur; W.flags = W.flags && typeof W.flags === 'object' ? W.flags : {}; }
      if (curBox && curBox.isConnected) drawWatch(curBox);
    }
    if (key === 'ek_pro_newsal') { var nn = S.get('ek_pro_newsal', null); if (nn && typeof nn === 'object') NA = nn; }
  });
  /* ---- help and support: what each tool does, the keyboard, and where to ask */
  var HELP = ['chart', 'draw', 'ind', 'alert', 'news', 'rep', 'bt', 'scr', 'lay', 'data', 'toman'];
  var KEYS = [['A–Z', 'shSearch'], ['Alt + T · H · V · F · R', 'shDraw'], ['Esc', 'shEsc'], ['Delete', 'shDel'], ['Ctrl + Z · Ctrl + Y', 'shUndo'], ['Space', 'shPlay'], ['← · →', 'shStep'], ['Shift + B · Shift + S', 'shBuy']];
  function drawHelp(box) {
    box.innerHTML = '<div class="pm-ph"><b>' + esc(T('helpTab')) + '</b></div><div class="pm-help">' +
      '<h4 class="pm-h4">' + esc(T('hgTitle')) + '</h4>' + HELP.map(function (k) { return '<details class="pm-hi"><summary>' + esc(T('ht_' + k)) + '</summary><p>' + esc(T('h_' + k)) + '</p></details>'; }).join('') +
      '<h4 class="pm-h4">' + esc(T('shTitle')) + '</h4><table class="pm-tbl pm-keys">' + KEYS.map(function (k) { return '<tr><td><kbd dir="ltr">' + esc(k[0]) + '</kbd></td><td>' + esc(T(k[1])) + '</td></tr>'; }).join('') + '</table>' +
      '<h4 class="pm-h4">' + esc(T('supTitle')) + '</h4><div class="pm-sup">' +
      '<button type="button" class="pm-btn wide" data-a="ai">💬 ' + esc(T('supAi')) + '</button>' +
      '<a class="pm-btn wide" href="https://t.me/Coin_Kurd_Group" target="_blank" rel="noopener">👥 ' + esc(T('supGroup')) + '</a>' +
      '<a class="pm-btn wide" href="https://t.me/Kurdistan_Coin" target="_blank" rel="noopener">✉ ' + esc(T('supAdmin')) + '</a>' +
      '<a class="pm-btn wide" href="/class/">🎓 ' + esc(T('supClass')) + '</a></div><p class="pm-note">' + esc(T('supNote')) + '</p></div>';
    $('[data-a="ai"]', box).onclick = function () { var b = d.getElementById('ask-fab'); if (b) b.click(); else window.open('https://t.me/Coin_Kurd_Group', '_blank', 'noopener'); };
  }
  A.panels.help = drawHelp;

  A.on('ready', syncIndSubs);

  /* ================================================================ ECONOMIC CALENDAR */
  var CAL = null, calLoading = null, CALMETA = {};
  function loadCal() {
    if (CAL || calLoading) return calLoading;
    var v = '?v=' + Math.floor(Date.now() / 6e5);
    calLoading = P.getJSON('/data/ecocal.json' + v).then(function (j) { CALMETA = { at: j.updated_at, src: j.source, since: j.since }; return j.events || []; }, function () {
      /* before the first calendar run: the site's existing USD calendar */
      return P.getJSON('/data/events.json' + v).then(function (j) {
        CALMETA = { at: j.updated_at, src: j.source, partial: true };
        return (j.events || []).map(function (e) { return { t: Math.floor(Date.parse(e.date) / 1000), c: 'USD', i: e.impact === 'High' ? 'H' : e.impact === 'Medium' ? 'M' : 'L', n: e.title, tr: { fa: e.title_fa || '' }, f: e.forecast, p: e.previous, b1: e.btc_1h, b4: e.btc_4h }; });
      });
    }).then(function (ev) {
      CAL = ev.filter(function (e) { return e && isFinite(e.t) && /^[A-Z]{3}$/.test(e.c || '') && /^[HMLX]$/.test(e.i || ''); }).sort(function (a, b) { return a.t - b.t; });
      A.cells().forEach(function (c) { c.ovl.update(); }); if (calBox && calBox.isConnected) drawCal(calBox);
      return CAL;
    }).catch(function () { CAL = []; return CAL; });
    return calLoading;
  }
  P.calEvents = function () { if (!CAL) { if (A.st().ev.on) loadCal(); return null; } return CAL; };
  function evTitle(e) { var L = A.LANG(), tr = e.tr || {}; return (L !== 'en' && tr[L]) || e.n; }
  var CURS = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'NZD', 'CHF'];
  var IMPC = { H: '#ff5a4d', M: '#f7931a', L: '#facc15', X: '#9ca3af' };
  /* a small round flag per currency, drawn (no images, no emoji fonts needed) */
  P.flag = function (ctx, x, y, r, c, imp) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    var R = function (col, x0, y0, w, h0) { ctx.fillStyle = col; ctx.fillRect(x0, y0, w, h0); };
    var L = x - r, Tp = y - r, D = r * 2;
    if (c === 'USD') { for (var k = 0; k < 7; k++) R(k % 2 ? '#fff' : '#b22234', L, Tp + k * D / 7, D, D / 7 + 0.5); R('#3c3b6e', L, Tp, D * 0.5, D * 0.54); }
    else if (c === 'EUR') { R('#003399', L, Tp, D, D); ctx.fillStyle = '#ffcc00'; for (var s = 0; s < 12; s++) { var a = s / 12 * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.58, y + Math.sin(a) * r * 0.58, r * 0.1, 0, 7); ctx.fill(); } }
    else if (c === 'GBP') { R('#012169', L, Tp, D, D); ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.5; ctx.beginPath(); ctx.moveTo(L, Tp); ctx.lineTo(L + D, Tp + D); ctx.moveTo(L + D, Tp); ctx.lineTo(L, Tp + D); ctx.stroke(); R('#fff', x - r * 0.3, Tp, r * 0.6, D); R('#fff', L, y - r * 0.3, D, r * 0.6); R('#c8102e', x - r * 0.17, Tp, r * 0.34, D); R('#c8102e', L, y - r * 0.17, D, r * 0.34); }
    else if (c === 'JPY') { R('#fff', L, Tp, D, D); ctx.fillStyle = '#bc002d'; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, 7); ctx.fill(); }
    else if (c === 'CNY') { R('#de2910', L, Tp, D, D); ctx.fillStyle = '#ffde00'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.3, r * 0.28, 0, 7); ctx.fill(); }
    else if (c === 'CAD') { R('#fff', L, Tp, D, D); R('#d52b1e', L, Tp, D * 0.28, D); R('#d52b1e', L + D * 0.72, Tp, D * 0.28, D); ctx.fillStyle = '#d52b1e'; ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, 7); ctx.fill(); }
    else if (c === 'AUD' || c === 'NZD') { R('#012169', L, Tp, D, D); R('#fff', L, Tp, D * 0.5, D * 0.5); R('#c8102e', L + D * 0.2, Tp, D * 0.1, D * 0.5); R('#c8102e', L, Tp + D * 0.2, D * 0.5, D * 0.1); ctx.fillStyle = c === 'NZD' ? '#c8102e' : '#fff'; ctx.beginPath(); ctx.arc(x + r * 0.4, y + r * 0.35, r * 0.18, 0, 7); ctx.fill(); }
    else if (c === 'CHF') { R('#d52b1e', L, Tp, D, D); R('#fff', x - r * 0.14, y - r * 0.5, r * 0.28, r); R('#fff', x - r * 0.5, y - r * 0.14, r, r * 0.28); }
    else { R('#374151', L, Tp, D, D); ctx.fillStyle = '#e5e7eb'; ctx.font = '700 ' + Math.round(r * 0.75) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((c || '?').slice(0, 2), x, y + 0.5); }
    ctx.restore();
    ctx.lineWidth = 2; ctx.strokeStyle = IMPC[imp] || '#9ca3af'; ctx.beginPath(); ctx.arc(x, y, r + 0.5, 0, Math.PI * 2); ctx.stroke();
  };
  function moveTxt(v) { return v == null ? '—' : '<b class="' + (v >= 0 ? 'up' : 'dn') + '">' + (v >= 0 ? '+' : '') + (+v).toFixed(2) + '%</b>'; }
  P.evTipHtml = function (e) {
    var past = e.t * 1000 < Date.now();
    return '<b>' + esc(e.c) + ' · ' + esc(evTitle(e)) + '</b><br><span class="pm-imp i' + e.i + '">' + esc(T('imp_' + e.i)) + '</span> · ' + esc(A.fmtD(e.t)) +
      (e.f || e.p ? '<br>' + esc(T('forecast')) + ': <b>' + esc(e.f || '—') + '</b> · ' + esc(T('previous')) + ': <b>' + esc(e.p || '—') + '</b>' : '') +
      (past && (e.b1 != null || e.b4 != null) ? '<br>' + esc(T('btcAfter')) + ' 1h ' + moveTxt(e.b1) + ' · 4h ' + moveTxt(e.b4) : '') +
      (A.LANG() !== 'en' && evTitle(e) !== e.n ? '<br><small dir="ltr">' + esc(e.n) + '</small>' : '');
  };
  var calBox = null, calQ = '';
  /* ---- alerts before economic events (Faraz: «an alarm before the news, on the chart») */
  var calR = 'all', EVA = S.get('ek_pro_evalerts', null);
  if (!EVA || typeof EVA !== 'object') EVA = { all: false, min: 15, ev: {}, done: {} };
  EVA.ev = EVA.ev || {}; EVA.done = EVA.done || {}; EVA.min = [0, 5, 15, 30, 60].indexOf(EVA.min) >= 0 ? EVA.min : 15;
  function saveEVA() { var cut = Date.now() / 1000 - 7 * 86400; Object.keys(EVA.done).forEach(function (k) { if (EVA.done[k] < cut) delete EVA.done[k]; }); S.set('ek_pro_evalerts', EVA); }
  function evId(e) { return String(e.t) + e.c + String(e.n || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 24); }
  function rangeOf(k) {                                             /* in the page's time zone */
    var now = Date.now() / 1000, off = A.tzOffset ? A.tzOffset(now) : -new Date().getTimezoneOffset() * 60;
    var d0 = Math.floor((now + off) / 86400) * 86400 - off, dow = new Date((d0 + off) * 1000).getUTCDay(), w0 = d0 - ((dow + 1) % 7) * 86400;   /* Saturday → Friday: one whole trading week */
    return k === 'today' ? [d0, d0 + 86400] : k === 'tomorrow' ? [d0 + 86400, d0 + 172800] : k === 'week' ? [w0, w0 + 7 * 86400] : [w0 + 7 * 86400, w0 + 14 * 86400];
  }
  function evMenu(anchor, id, box) {
    var items = [{ head: T('evAlert') }].concat([0, 5, 15, 30, 60].map(function (m) { return { label: minText(m), on: EVA.ev[id] === m, act: function () { EVA.ev[id] = m; delete EVA.done[id + ':' + m]; saveEVA(); calList(box); askNotify(); A.toast(T('evSet')); } }; }));
    if (EVA.ev[id] != null) items.push({ label: T('remove'), icon: 'trash', act: function () { delete EVA.ev[id]; saveEVA(); calList(box); } });
    A.menu(anchor, items);
  }
  function evMinMenu(anchor, box) {
    A.menu(anchor, [0, 5, 15, 30, 60].map(function (m) { return { label: minText(m), on: EVA.min === m, act: function () { EVA.min = m; saveEVA(); var b = $('.pm-evmin', box); if (b) b.textContent = minText(m) + ' ▾'; } }; }));
  }
  function evPrime() { if (!CAL) loadCal(); }
  function minText(m) { return m ? T('evBefore', { m: A.loc(m) }) : T('evAtTime'); }
  function askNotify() { try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { } }
  function evCheck() {
    if (!CAL || (!EVA.all && !Object.keys(EVA.ev).length)) return;
    var now = Date.now() / 1000, st = A.st();
    CAL.forEach(function (e) {
      if (e.t < now - 120 || e.t > now + 3700) return;
      var id = evId(e), m = EVA.ev[id] != null ? EVA.ev[id] : EVA.all && e.i === 'H' && (!st.ev.cur.length || st.ev.cur.indexOf(e.c) >= 0) ? EVA.min : null;
      if (m == null) return;
      var key = id + ':' + m; if (EVA.done[key]) return;
      if (now >= e.t - m * 60) {
        EVA.done[key] = Math.floor(now); saveEVA();
        var msg = '⏳ ' + e.c + ' · ' + evTitle(e) + ' — ' + (e.t > now + 30 ? T('evIn', { d: durText(e.t - now) }) : T('evNow'));
        LOG.unshift({ t: Date.now(), id: 'ev-' + id, sym: e.c, msg: msg }); saveAL();
        A.toast(msg, 'long'); if (st.sound) beep();
        if (window.Notification && Notification.permission === 'granted') { try { new Notification('entekhab.net · ' + e.c, { body: msg, tag: 'ekev-' + id, icon: '/assets/icon-192.png' }); } catch (x) { } }
      }
    });
  }
  setInterval(function () { if (EVA.all || Object.keys(EVA.ev).length) { if (!CAL) loadCal(); else evCheck(); } }, 20000);
  setTimeout(function () { if (EVA.all || Object.keys(EVA.ev).length) loadCal(); }, 3000);
  P._evCheck = evCheck; P._eva = EVA;
  function drawCal(box) {
    calBox = box; var st = A.st();
    box.innerHTML = '<div class="pm-ph"><b>' + esc(T('ecoCal')) + '</b><span class="pm-grow"></span><label class="pm-swt"><input type="checkbox"' + (st.ev.on ? ' checked' : '') + '> <span>' + esc(T('onChart')) + '</span></label></div>' +
      '<div class="pm-next"></div><div class="pm-flags pm-imps">' + ['H', 'M', 'L', 'X'].map(function (k) { return '<button type="button" class="pm-chip' + (st.ev.imp.indexOf(k) >= 0 ? ' on' : '') + '" data-i="' + k + '"><i class="pm-dotc" style="background:' + IMPC[k] + '"></i>' + esc(T('imp_' + k)) + '</button>'; }).join('') + '</div>' +
      '<div class="pm-flags pm-curs">' + CURS.map(function (c) { return '<button type="button" class="pm-chip sm' + (st.ev.cur.indexOf(c) >= 0 ? ' on' : '') + '" data-c="' + c + '">' + c + '</button>'; }).join('') + '</div>' +
      '<div class="pm-flags pm-rng">' + ['all', 'today', 'tomorrow', 'week', 'next'].map(function (k) { return '<button type="button" class="pm-chip sm' + (calR === k ? ' on' : '') + '" data-r="' + k + '">' + esc(T('rng_' + k)) + '</button>'; }).join('') + '</div>' +
      '<div class="pm-evrow"><label class="pm-swt pm-evall"><input type="checkbox"' + (EVA.all ? ' checked' : '') + '> <span>' + esc(T('evAlertAll')) + '</span></label>' +
      '<button type="button" class="pm-chip sm pm-evmin">' + esc(minText(EVA.min)) + ' ▾</button></div>' +
      '<input class="pm-in pm-calq" type="search" placeholder="' + esc(T('searchEv')) + '"><div class="pm-cl"></div><p class="pm-note pm-calsrc"></p>';
    $('.pm-swt input', box).onchange = function () { st.ev.on = this.checked ? 1 : 0; A.save(); if (st.ev.on) loadCal(); A.cells().forEach(function (c) { c.ovl.update(); }); };
    $$('[data-i]', box).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-i'), i = st.ev.imp.indexOf(k); if (i >= 0) st.ev.imp.splice(i, 1); else st.ev.imp.push(k); b.classList.toggle('on'); A.save(); calList(box); A.cells().forEach(function (c) { c.ovl.update(); }); }; });
    $$('[data-c]', box).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-c'), i = st.ev.cur.indexOf(k); if (i >= 0) st.ev.cur.splice(i, 1); else st.ev.cur.push(k); b.classList.toggle('on'); A.save(); calList(box); A.cells().forEach(function (c) { c.ovl.update(); }); }; });
    var q = $('.pm-calq', box); q.value = calQ; q.oninput = function () { calQ = q.value; calList(box); };
    $$('[data-r]', box).forEach(function (b) { b.onclick = function () { calR = b.getAttribute('data-r'); $$('[data-r]', box).forEach(function (x) { x.classList.toggle('on', x === b); }); box._scrolled = false; calList(box); }; });
    $('.pm-evall input', box).onchange = function () { EVA.all = this.checked; saveEVA(); if (EVA.all) { evPrime(); askNotify(); } calList(box); A.toast(T(EVA.all ? 'evAlertOn' : 'evAlertOff')); };
    $('.pm-evmin', box).onclick = function () { evMinMenu(this, box); };
    if (!CAL) { $('.pm-cl', box).innerHTML = '<p class="pm-empty">' + esc(T('loading')) + '</p>'; loadCal(); return; }
    calList(box);
  }
  function calList(box) {
    var st = A.st(), list = $('.pm-cl', box); if (!list || !CAL) return;
    var q = calQ.trim().toLowerCase(), now = Date.now() / 1000;
    var ev = CAL.filter(function (e) { return st.ev.imp.indexOf(e.i) >= 0 && (!st.ev.cur.length || st.ev.cur.indexOf(e.c) >= 0) && (!q || (evTitle(e) + ' ' + e.n + ' ' + e.c).toLowerCase().indexOf(q) >= 0); });
    var from = now - 14 * 86400; ev = ev.filter(function (e) { return e.t >= from; });
    if (calR !== 'all') { var R = rangeOf(calR); ev = ev.filter(function (e) { return e.t >= R[0] && e.t < R[1]; }); }
    var html = '', day = null, nowDone = false;
    ev.forEach(function (e) {
      var dk = A.fmtD(e.t, 'day');
      if (dk !== day) { day = dk; html += '<div class="pm-cday">' + esc(dk) + '</div>'; }
      if (!nowDone && e.t > now) { nowDone = true; html += '<div class="pm-cnow" id="pm-cnow">' + esc(T('now')) + ' · ' + esc(A.fmtT(Math.floor(now), 'hm')) + '</div>'; }
      var past = e.t <= now;
      var eid = evId(e), auto = EVA.all && e.i === 'H' && (!st.ev.cur.length || st.ev.cur.indexOf(e.c) >= 0);
      var bell = !past ? '<i class="pm-cb' + (EVA.ev[eid] != null ? ' on' : auto ? ' auto' : '') + '" data-ev="' + eid + '" title="' + esc(T('evAlert')) + '">🔔</i>' : '';
      html += '<button type="button" class="pm-cr' + (past ? ' past' : '') + '" data-t="' + e.t + '"><span class="pm-ct">' + esc(A.fmtT(e.t, 'hm')) + '</span><span class="pm-cc"><i class="pm-imp i' + e.i + '"></i>' + esc(e.c) + '</span>' +
        '<span class="pm-cn">' + esc(evTitle(e)) + '<small>' + (e.f ? esc(T('forecast')) + ' ' + esc(e.f) + ' · ' : '') + (e.p ? esc(T('previous')) + ' ' + esc(e.p) : '') + (past && e.b1 != null ? ' · BTC 1h ' + ((e.b1 >= 0 ? '+' : '') + (+e.b1).toFixed(2)) + '%' : '') + '</small></span>' + bell + '</button>';
    });
    list.innerHTML = html || '<p class="pm-empty">' + esc(T('noEvents')) + '</p>';
    $$('.pm-cr', list).forEach(function (b) { b.onclick = function (ev2) {
      var bl = ev2.target.closest && ev2.target.closest('.pm-cb');
      if (bl) { ev2.stopPropagation(); evMenu(bl, bl.getAttribute('data-ev'), box); return; }
      var t = +b.getAttribute('data-t'); A.goDate(A.active(), t); }; });
    var nx = CAL.filter(function (e) { return e.t > now && e.i === 'H' && (!st.ev.cur.length || st.ev.cur.indexOf(e.c) >= 0); })[0], ne = $('.pm-next', box);
    if (ne) ne.innerHTML = nx ? '⏳ ' + esc(T('nextHigh')) + ': <b>' + esc(nx.c + ' · ' + evTitle(nx)) + '</b> — ' + esc(durText(nx.t - now)) : '';
    var sc = $('.pm-calsrc', box); if (sc) sc.textContent = T('calSource', { s: CALMETA.src || 'ForexFactory', t: CALMETA.at ? A.fmtD(Math.floor(Date.parse(CALMETA.at) / 1000)) : '—' }) + (CALMETA.partial ? ' ' + T('calPartial') : '');
    var cn = $('#pm-cnow', list); if (cn && !box._scrolled) { box._scrolled = true; setTimeout(function () { list.scrollTop = Math.max(0, cn.offsetTop - list.offsetTop - 60); }, 0); }
  }
  A.panels.cal = drawCal;
  A.on('openEvent', function (e) { A.setSide('cal'); setTimeout(function () { var b = calBox && calBox.querySelector('.pm-cr[data-t="' + e.t + '"]'); if (b) { b.scrollIntoView({ block: 'center' }); b.classList.add('hl'); } }, 60); });
  A.on('tz', function () { if (calBox && calBox.isConnected) calList(calBox); });
  A.on('ready', function () { if (A.st().ev.on) loadCal(); });
  setInterval(function () { if (calBox && calBox.isConnected) { var ne = $('.pm-next', calBox); if (ne && CAL) calList(calBox); } }, 30000);

  /* ================================================================ OBJECTS: drawings of the symbol, other symbols */
  var objBox = null;
  function drawObj(box) {
    objBox = box;
    var a = A.active(), sym = a.cfg.sym, D = A.DRAW(), L = D[sym] || [];
    box.innerHTML = '<div class="pm-ph"><b>' + esc(T('drawingsOf', { s: sym })) + '</b><span class="pm-grow"></span>' + (L.length ? '<button type="button" class="pm-ib" data-a="clr" title="' + esc(T('clearAll')) + '">' + ic('trash') + '</button>' : '') + '</div><div class="pm-ol"></div><h4 class="pm-h4">' + esc(T('otherSyms')) + '</h4><div class="pm-oo"></div><p class="pm-note">' + esc(T('autosaveNote')) + '</p>';
    var ol = $('.pm-ol', box);
    ol.innerHTML = L.length ? L.map(function (x) {
      var p0 = x.pts[0];
      return '<div class="pm-or' + (a.drawer.sel === x.id ? ' on' : '') + '" data-id="' + esc(x.id) + '">' + ic(x.k) + '<button type="button" class="pm-on">' + esc(T('t_' + x.k)) + '<small>' + esc(p0 && p0.p != null ? a.fmt(p0.p) : '') + ' · ' + esc(p0 ? A.fmtD(p0.t, 'date') : '') + '</small></button>' +
        '<button type="button" class="pm-ib" data-a="hd">' + ic(x.hd ? 'eyeoff' : 'eye') + '</button><button type="button" class="pm-ib" data-a="lk">' + ic(x.lk ? 'lock' : 'unlock') + '</button><button type="button" class="pm-ib" data-a="rm">' + ic('trash') + '</button></div>';
    }).join('') : '<p class="pm-empty">' + esc(T('noDrawings')) + '</p>';
    $$('.pm-or', ol).forEach(function (r) {
      var id = r.getAttribute('data-id');
      $('.pm-on', r).onclick = function () { var x = L.filter(function (z) { return z.id === id; })[0]; if (!x) return; a.drawer.select(id); A.goDate(a, x.pts[0].t); };
      $$('[data-a]', r).forEach(function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-a');
          if (k === 'rm') { A.removeDrawing(a, id); return; }
          A.mutate(sym, function (LL) { LL.forEach(function (z) { if (z.id === id) { if (k === 'hd') z.hd = !z.hd; if (k === 'lk') z.lk = !z.lk; } }); });
        };
      });
    });
    var cl = $('[data-a="clr"]', box); if (cl) cl.onclick = function () { A.confirm(T('clearAll'), T('clearQ', { s: sym }), function () { A.mutate(sym, function (LL) { LL.length = 0; }); }); };
    var others = Object.keys(D).filter(function (s) { return s !== sym && D[s] && D[s].length; });
    $('.pm-oo', box).innerHTML = others.length ? others.map(function (s) { return '<button type="button" class="pm-chip" data-s="' + s + '"><img src="' + esc(P.logo(s)) + '" alt="" width="16" height="16">' + esc(P.pair(s)) + ' · ' + A.loc(D[s].length) + '</button>'; }).join('') : '<p class="pm-empty">—</p>';
    $$('[data-s]', $('.pm-oo', box)).forEach(function (b) { b.onclick = function () { A.applySym(b.getAttribute('data-s')); }; });
  }
  A.panels.obj = drawObj;
  ['draws', 'active', 'sym', 'drawsel'].forEach(function (n) { A.on(n, function () { if (objBox && objBox.isConnected) drawObj(objBox); }); });
  /* if the workspace somehow started before this file ran, catch up: open the side panel and start what 'ready' starts */
  if (A.cells().length) { syncIndSubs(); if (A.st().ev.on) loadCal(); if (A.st().side) A.setSide(A.st().side, true); }
})();
