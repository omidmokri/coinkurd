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

  /* ================================================================ WATCHLIST */
  var W = S.get('ek_pro_watch', null);
  function siteList() { var a = S.get('ek_watch', []); return Array.isArray(a) ? a.filter(function (x) { return A.SYM_RE.test(x); }) : []; }
  function setSiteList(a) { S.set('ek_watch', a.slice(0, 60)); }
  if (!W || typeof W !== 'object' || !Array.isArray(W.lists)) W = { lists: [], cur: 'site', flags: {}, sort: null, ff: null };
  if (!siteList().length) setSiteList(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'XAUT']);
  W.flags = W.flags && typeof W.flags === 'object' ? W.flags : {};
  function saveW() { S.set('ek_pro_watch', W); }
  var FLAGS = { r: '#ff5a4d', o: '#f7931a', y: '#facc15', g: '#34d399', b: '#38bdf8', p: '#a78bfa' };
  var TOP = [];
  P.getJSON('/data/market.json?v=' + Math.floor(Date.now() / 3e5)).then(function (m) { TOP = (m.coins || []).map(function (c) { return c.coin; }); P.universe().then(function (u) { var set = new Set(u); TOP = TOP.filter(function (c) { return set.has(c); }).slice(0, 30); if (W.cur === 'top' && curBox) drawWatch(curBox); }); }, function () { });
  function listSyms() {
    var a = W.cur === 'site' ? siteList() : W.cur === 'top' ? TOP : ((W.lists[W.cur | 0] || {}).s || []);
    return P._logoSet ? a.filter(function (s) { return P._logoSet.has(s); }) : a;      /* never a coin without its logo */
  }
  function editable() { return W.cur !== 'top'; }
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
    var lists = [{ k: 'site', n: '⭐ ' + T('myList') }, { k: 'top', n: '🔥 ' + T('topVol') }].concat(W.lists.map(function (l, i) { return { k: String(i), n: l.n }; }));
    box.innerHTML = '<div class="pm-ph"><select class="pm-sel" aria-label="' + esc(T('lists')) + '">' + lists.map(function (l) { return '<option value="' + l.k + '"' + (String(W.cur) === l.k ? ' selected' : '') + '>' + esc(l.n) + '</option>'; }).join('') + '</select>' +
      '<button type="button" class="pm-ib" data-a="add" title="' + esc(T('addSym')) + '">' + ic('plus') + '</button><button type="button" class="pm-ib" data-a="more" title="' + esc(T('more')) + '">' + ic('menu') + '</button></div>' +
      '<div class="pm-flags"><button type="button" class="pm-fl' + (!W.ff ? ' on' : '') + '" data-f="">' + esc(T('all')) + '</button>' + Object.keys(FLAGS).map(function (f) { return '<button type="button" class="pm-fl' + (W.ff === f ? ' on' : '') + '" data-f="' + f + '" style="--c:' + FLAGS[f] + '" aria-label="' + f + '"><i></i></button>'; }).join('') + '</div>' +
      '<div class="pm-wh"><span data-k="s">' + esc(T('symbolCol')) + '</span><span data-k="c">' + esc(T('last')) + '</span><span data-k="p">' + esc(T('chg')) + '</span></div><div class="pm-wl" role="list"></div><div class="pm-wsum"></div>';
    $('select', box).onchange = function () { W.cur = this.value; saveW(); drawWatch(box); };
    $('[data-a="add"]', box).onclick = function () { if (!editable()) { toastTop(); return; } pickSym(function (s) { addTo(s); drawWatch(box); }); };
    $('[data-a="more"]', box).onclick = function (e) { listMenu(e.currentTarget, box); };
    $$('[data-f]', box).forEach(function (b) { b.onclick = function () { W.ff = b.getAttribute('data-f') || null; saveW(); drawWatch(box); }; });
    $$('.pm-wh [data-k]', box).forEach(function (s) { s.onclick = function () { var k = s.getAttribute('data-k'); W.sort = W.sort && W.sort.k === k ? (W.sort.d > 0 ? { k: k, d: -1 } : null) : { k: k, d: 1 }; saveW(); rows(box); }; });
    rows(box);
  }
  function toastTop() { A.toast(T('topFixed')); }
  function rows(box) {
    var syms = listSyms(), wl = $('.pm-wl', box); if (!wl) return;
    if (W.ff) syms = syms.filter(function (s) { return W.flags[s] === W.ff; });
    if (W.sort) { var k = W.sort.k, dd = W.sort.d; syms = syms.slice().sort(function (a, b) { var x = P.tickers.d[a], y = P.tickers.d[b]; var va = k === 's' ? a : x ? (k === 'c' ? x.c : x.chg) : null, vb = k === 's' ? b : y ? (k === 'c' ? y.c : y.chg) : null; if (va == null) return 1; if (vb == null) return -1; return (va > vb ? 1 : va < vb ? -1 : 0) * dd; }); }
    want('watch', listSyms());
    var act = A.active() && A.active().cfg.sym;
    wl.innerHTML = syms.length ? syms.map(function (s) {
      var f = W.flags[s];
      return '<div class="pm-wr' + (s === act ? ' on' : '') + '" role="listitem" data-s="' + s + '"><button type="button" class="pm-wf" style="--c:' + (f ? FLAGS[f] : 'transparent') + '" aria-label="' + esc(T('flag')) + '"></button>' +
        '<button type="button" class="pm-wn"><img src="/data/logos/' + s + '.png" alt="" width="20" height="20" loading="lazy"><b>' + s + '</b></button><span class="pm-num pm-wc">—</span><span class="pm-num pm-wp">—</span>' +
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
    summary(box);
  }
  function paintRow(r, s, flash) {
    var t = P.tickers.d[s]; if (!t) return;
    var c = $('.pm-wc', r), p = $('.pm-wp', r);
    c.textContent = P.fmt(t.c); p.textContent = (t.chg >= 0 ? '+' : '') + (t.chg == null ? '—' : t.chg.toFixed(2) + '%'); p.className = 'pm-num pm-wp ' + (t.chg >= 0 ? 'up' : 'dn');
    if (flash && t.prev != null && t.prev !== t.c) { c.classList.remove('fu', 'fd'); void c.offsetWidth; c.classList.add(t.c > t.prev ? 'fu' : 'fd'); }
    r.title = t.src === 'site' ? T('fromSnapshot') : '';
  }
  function summary(box) {
    var e = $('.pm-wsum', box), a = A.active(); if (!e || !a) return;
    var s = a.cfg.sym, t = P.tickers.d[s];
    if (!t) { e.innerHTML = ''; want('sum', [s]); return; }
    var pos = t.h > t.l ? (t.c - t.l) / (t.h - t.l) * 100 : 50;
    e.innerHTML = '<div class="pm-sumh"><img src="/data/logos/' + s + '.png" alt="" width="22" height="22"><b>' + s + '/USDT</b><span class="pm-num ' + (t.chg >= 0 ? 'up' : 'dn') + '">' + P.fmt(t.c) + '</span></div>' +
      '<div class="pm-range"><span class="pm-num">' + P.fmt(t.l) + '</span><i><b style="inset-inline-start:' + pos.toFixed(1) + '%"></b></i><span class="pm-num">' + P.fmt(t.h) + '</span></div>' +
      '<div class="pm-sumf"><span>' + esc(T('vol24')) + ' <b class="pm-num">$' + P.fmtV(t.q) + '</b></span><span>' + esc(T('chg24')) + ' <b class="pm-num ' + (t.chg >= 0 ? 'up' : 'dn') + '">' + (t.chg >= 0 ? '+' : '') + (t.chg || 0).toFixed(2) + '%</b></span></div>';
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
  function rowMenu(anchor, s, box) {
    var items = [{ label: T('openChart'), act: function () { A.applySym(s); } }, { label: T('newAlert'), icon: 'bell', act: function () { A.applySym(s); P.alertDialog(A.active()); } }];
    if (editable()) items.push({ label: T('remove'), icon: 'trash', act: function () { removeFrom(s); rows(box); } });
    var others = [{ k: 'site', n: T('myList') }].concat(W.lists.map(function (l, i) { return { k: String(i), n: l.n }; })).filter(function (l) { return l.k !== String(W.cur); });
    if (others.length) { items.push({ head: T('copyTo') }); others.forEach(function (l) { items.push({ label: l.n, act: function () { var cur = W.cur; W.cur = l.k; addTo(s); W.cur = cur; saveW(); A.toast(T('added', { n: s })); } }); }); }
    A.menu(anchor, items);
  }
  function listMenu(anchor, box) {
    var items = [{ label: T('newList'), icon: 'plus', act: function () { A.ask(T('newList'), '', function (n) { if (!n) return; W.lists.push({ n: n.slice(0, 30), s: [] }); W.cur = String(W.lists.length - 1); saveW(); drawWatch(box); }, T('listName')); } }];
    if (W.cur !== 'site' && W.cur !== 'top') {
      var L = W.lists[W.cur | 0];
      items.push({ label: T('renameList'), act: function () { A.ask(T('renameList'), L.n, function (n) { if (n) { L.n = n.slice(0, 30); saveW(); drawWatch(box); } }); } },
        { label: T('deleteList'), icon: 'trash', act: function () { A.confirm(T('deleteList'), T('deleteListQ', { n: L.n }), function () { W.lists.splice(W.cur | 0, 1); W.cur = 'site'; saveW(); drawWatch(box); }); } });
    }
    items.push({ sep: true }, { label: T('sendBot'), icon: 'share', act: function () {
      var s = listSyms().filter(function (x) { return /^[A-Z0-9]{2,10}$/.test(x); }), arg = 'w_', n = 0;
      for (var i = 0; i < s.length; i++) { if ((arg + s[i]).length + (n ? 1 : 0) > 64) break; arg += (n ? '-' : '') + s[i]; n++; }
      window.open('https://t.me/' + BOT + '?start=' + arg, '_blank', 'noopener');
    } });
    A.menu(anchor, items);
  }
  function pickSym(cb) {
    var box = h('<div class="pm-ss"><input class="pm-in" type="search" autocomplete="off"><div class="pm-ssl"></div></div>'), inp = $('input', box), list = $('.pm-ssl', box), U = [];
    inp.placeholder = T('searchSym');
    function draw() {
      var q = inp.value.trim().toUpperCase(), r = U.filter(function (x) { return !q || x.indexOf(q) >= 0; }).slice(0, 60);
      list.innerHTML = r.map(function (x) { return '<button type="button" class="pm-ssi" data-s="' + x + '"><img src="/data/logos/' + x + '.png" alt="" width="22" height="22" loading="lazy"><b>' + x + '</b><small>/USDT</small></button>'; }).join('') || '<p class="pm-empty">' + esc(U.length ? T('noMatch') : T('loading')) + '</p>';
      $$('[data-s]', list).forEach(function (b) { b.onclick = function () { A.closeModal(); cb(b.getAttribute('data-s')); }; });
    }
    inp.oninput = draw; A.modal(T('addSym'), box); P.universe().then(function (u) { U = u; draw(); }); draw();
  }
  A.panels.watch = drawWatch;
  A.on('active', function () { if (curBox && curBox.isConnected) rows(curBox); });
  A.on('sym', function () { if (curBox && curBox.isConnected) rows(curBox); });

  /* ================================================================ ALERTS */
  var AL = S.get('ek_pro_alerts', []); if (!Array.isArray(AL)) AL = [];
  var LOG = S.get('ek_pro_alert_log', []); if (!Array.isArray(LOG)) LOG = [];
  AL = AL.filter(function (a) { return a && A.SYM_RE.test(a.sym) && (a.k === 'price' || a.k === 'ind'); }).slice(0, 60);
  function saveAL() { S.set('ek_pro_alerts', AL); S.set('ek_pro_alert_log', LOG.slice(0, 100)); refreshAlertViews(); }
  P.logos().then(function (L) {                        /* never a coin without its logo: alerts and lists follow the logo index */
    if (!L) return;
    var n = AL.length; AL = AL.filter(function (a) { return L.has(a.sym); }); if (AL.length !== n) { saveAL(); syncIndSubs(); }
    if (curBox && curBox.isConnected) drawWatch(curBox);
  });
  var lastPx = {};
  P.alertLines = function (sym) { return AL.filter(function (a) { return a.on && a.k === 'price' && a.sym === sym; }).map(function (a) { return { v: a.v }; }); };
  function condText(a) {
    if (a.k === 'price') return T('c_' + a.c) + ' ' + P.fmt(a.v);
    var x = a.ind, nm = T('ai_' + x.id) + (x.len ? ' (' + x.len + ')' : '');
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
    var p = t.c, q = lastPx[sym]; lastPx[sym] = p;
    AL.forEach(function (a) {
      if (!a.on || a.k !== 'price' || a.sym !== sym) return;
      var prev = a.px != null ? a.px : q; a.px = p;
      if (prev == null) return;
      var v = a.v, hit = a.c === 'cross' ? ((prev < v && p >= v) || (prev > v && p <= v)) : a.c === 'up' ? (prev < v && p >= v) : a.c === 'down' ? (prev > v && p <= v) : a.c === 'gt' ? p > v : a.c === 'lt' ? p < v : false;
      if (!hit) return;
      if (a.mode === 'every' && a.last && Date.now() - a.last < 60000) return;
      fire(a, sym + ' ' + T('c_' + a.c) + ' ' + P.fmt(v) + ' — ' + T('nowAt') + ' ' + P.fmt(p) + (a.msg ? ' · ' + a.msg : ''));
    });
  }
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
    want('alerts', AL.filter(function (a) { return a.on && a.k === 'price'; }).map(function (a) { return a.sym; }));
  }
  function indSeries(a, bars) {
    var x = a.ind, I = P.ind;
    if (x.id === 'rsi') return { v: I.compute('rsi', bars, { len: x.len }).v };
    if (x.id === 'ma') { var m = I.compute(x.ma === 'sma' ? 'sma' : 'ema', bars, { len: x.len }).v; return { v: bars.map(function (b) { return b.c; }), ref: m }; }
    if (x.id === 'macd') { var r = I.compute('macd', bars, {}); return { v: r.macd, ref: r.signal }; }
    if (x.id === 'bb') { var bb = I.compute('bb', bars, { len: x.len || 20, mult: 2 }); return { v: bars.map(function (b) { return b.c; }), up: bb.up, lo: bb.lo }; }
    return null;
  }
  function evalInd(a, bars) {
    var n = bars.length; if (n < 3) return false;
    var s = indSeries(a, bars); if (!s) return false;
    var i = n - 1, j = n - 2, v1 = s.v[i], v0 = s.v[j], ok = P.ind.ok;
    if (!ok(v1) || !ok(v0)) return false;
    if (a.ind.id === 'rsi') { var L = a.v; return a.c === 'up' ? v0 < L && v1 >= L : a.c === 'down' ? v0 > L && v1 <= L : a.c === 'gt' ? v1 > L : v1 < L; }
    if (a.ind.id === 'bb') return a.c === 'gt' ? ok(s.up[i]) && v1 > s.up[i] : ok(s.lo[i]) && v1 < s.lo[i];
    var r1 = s.ref[i], r0 = s.ref[j]; if (!ok(r1) || !ok(r0)) return false;
    return a.c === 'up' ? v0 < r0 && v1 >= r1 : v0 > r0 && v1 <= r1;
  }
  function checkInd(sym, tf, bars) {
    AL.forEach(function (a) {
      if (!a.on || a.k !== 'ind' || a.sym !== sym || a.tf !== tf) return;
      var lastT = bars[bars.length - 1].t; if (a.bar === lastT) return;
      if (evalInd(a, bars)) { a.bar = lastT; fire(a, sym + ' · ' + condText(a) + (a.msg ? ' · ' + a.msg : '')); }
    });
  }
  P.alertEval = evalInd;              /* exposed for the tests */
  function addAlert(a) { AL.unshift(a); if (AL.length > 60) AL.length = 60; saveAL(); syncIndSubs(); A.cells().forEach(function (c) { c.ovl.update(); }); }
  P.alertDialog = function (cell, preset) {
    preset = preset || {};
    var sym = cell.cfg.sym, last = cell.bars.length ? cell.bars[cell.bars.length - 1].c : (P.tickers.d[sym] || {}).c, kind = preset.kind || 'price';
    var f = h('<form class="pm-af">' +
      '<div class="pm-afsym"><img src="/data/logos/' + sym + '.png" alt="" width="22" height="22"><b>' + sym + '/USDT</b>' + (last ? '<span class="pm-num">' + P.fmt(last) + '</span>' : '') + '</div>' +
      '<div class="pm-seg" role="tablist"><button type="button" data-k="price"></button><button type="button" data-k="ind"></button></div>' +
      '<div class="pm-afp"><label class="pm-field"><span data-t="cond"></span><select class="pm-in" name="c"></select></label><label class="pm-field"><span data-t="value"></span><input class="pm-in" name="v" type="number" step="any" inputmode="decimal" required></label></div>' +
      '<div class="pm-afi" hidden><label class="pm-field"><span data-t="indicator"></span><select class="pm-in" name="ind"></select></label><label class="pm-field pm-len"><span data-t="length"></span><input class="pm-in" name="len" type="number" min="2" max="400" value="14"></label>' +
      '<label class="pm-field pm-mat"><span data-t="maType"></span><select class="pm-in" name="ma"><option value="ema">EMA</option><option value="sma">SMA</option></select></label>' +
      '<label class="pm-field"><span data-t="cond"></span><select class="pm-in" name="ic"></select></label><label class="pm-field pm-lvl"><span data-t="level"></span><input class="pm-in" name="lv" type="number" step="any" value="70"></label>' +
      '<label class="pm-field"><span data-t="tf"></span><select class="pm-in" name="tf"></select></label></div>' +
      '<label class="pm-field"><span data-t="trigger"></span><select class="pm-in" name="mode"><option value="once"></option><option value="every"></option></select></label>' +
      '<label class="pm-field"><span data-t="message"></span><input class="pm-in" name="msg" maxlength="80"></label>' +
      '<div class="pm-checks"><label><input type="checkbox" name="nt" checked> <span data-t="notif"></span></label><label class="pm-tgl"><input type="checkbox" name="tg"> <span data-t="tgAlso"></span></label></div>' +
      '<p class="pm-note" data-t="alertNote"></p><div class="pm-row"><button class="pm-btn pri" type="submit" data-t="create"></button></div></form>');
    $$('[data-t]', f).forEach(function (e) { e.textContent = T(e.getAttribute('data-t')); });
    $('[data-k="price"]', f).textContent = T('priceAlert'); $('[data-k="ind"]', f).textContent = T('indAlert');
    var C = $('[name=c]', f); ['cross', 'up', 'down', 'gt', 'lt'].forEach(function (c) { C.appendChild(new Option(T('c_' + c), c)); });
    var V = $('[name=v]', f); V.value = preset.price != null ? +(+preset.price).toPrecision(8) : last ? +last.toPrecision(8) : '';
    var IN = $('[name=ind]', f); ['rsi', 'ma', 'macd', 'bb'].forEach(function (x) { IN.appendChild(new Option(T('ai_' + x), x)); });
    var TF = $('[name=tf]', f); A.st().fav.concat([cell.cfg.tf]).filter(function (x, i, a) { return a.indexOf(x) === i && P.parseTF(x).sec >= 60; }).forEach(function (x) { TF.appendChild(new Option(A.tfLabel(x), x)); }); TF.value = P.parseTF(cell.cfg.tf).sec >= 60 ? cell.cfg.tf : '1h';
    var M = $('[name=mode]', f); M.options[0].textContent = T('once'); M.options[1].textContent = T('every');
    function indUI() {
      var id = IN.value, ic2 = $('[name=ic]', f); ic2.innerHTML = '';
      (id === 'bb' ? ['gt', 'lt'] : id === 'rsi' ? ['up', 'down', 'gt', 'lt'] : ['up', 'down']).forEach(function (c) { ic2.appendChild(new Option(T('ac_' + id + '_' + c, { v: '…' }), c)); });
      $('.pm-len', f).hidden = id === 'macd'; $('.pm-mat', f).hidden = id !== 'ma'; $('.pm-lvl', f).hidden = id !== 'rsi';
      $('[name=len]', f).value = id === 'rsi' ? 14 : id === 'bb' ? 20 : 50;
    }
    IN.onchange = indUI; indUI();
    function setKind(k) { kind = k; $$('.pm-seg button', f).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-k') === k); }); $('.pm-afp', f).hidden = k !== 'price'; $('.pm-afi', f).hidden = k !== 'ind'; V.required = k === 'price'; $('.pm-tgl', f).hidden = k !== 'price'; }
    $$('.pm-seg button', f).forEach(function (b) { b.onclick = function () { setKind(b.getAttribute('data-k')); }; }); setKind(kind);
    f.onsubmit = function (e) {
      e.preventDefault();
      var a = { id: P.uid(), sym: sym, k: kind, mode: M.value, on: true, at: Date.now(), msg: $('[name=msg]', f).value.trim().slice(0, 80) };
      if (kind === 'price') {
        a.c = C.value; a.v = +V.value; if (!(a.v > 0)) { A.toast(T('badValue')); return; }
        a.px = last || null;
      } else {
        var id = IN.value, len = Math.max(2, Math.min(400, Math.round(+$('[name=len]', f).value || 14)));
        a.ind = { id: id }; if (id !== 'macd') a.ind.len = len; if (id === 'ma') a.ind.ma = $('[name=ma]', f).value;
        a.c = $('[name=ic]', f).value; a.tf = TF.value; if (id === 'rsi') { a.v = +$('[name=lv]', f).value; if (!(a.v >= 0 && a.v <= 100)) { A.toast(T('badValue')); return; } }
        if (AL.filter(function (z) { return z.on && z.k === 'ind'; }).length >= 12) { A.toast(T('maxIndAlerts')); return; }
      }
      var wantNt = $('[name=nt]', f).checked, tg = kind === 'price' && $('[name=tg]', f).checked;
      A.closeModal(); addAlert(a); A.toast(T('alertSet', { c: sym + ' · ' + condText(a) }));
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
  function sendToBot(a) {
    var v = plainNum(a.v);
    if (!/^[A-Z0-9]{2,12}$/.test(a.sym) || !/^\d{1,12}(\.\d{1,18})?$/.test(v)) { A.toast(T('badValue')); return; }
    window.open('https://t.me/' + BOT + '?start=a_' + a.sym + '_' + v.replace('.', 'd'), '_blank', 'noopener');
  }
  var alertBox = null;
  function drawAlerts(box) {
    alertBox = box;
    var perm = window.Notification ? Notification.permission : 'na';
    box.innerHTML = '<div class="pm-ph"><b>' + esc(T('alerts')) + '</b><span class="pm-grow"></span><button type="button" class="pm-btn pri sm" data-a="new">' + ic('plus') + ' ' + esc(T('newAlert')) + '</button></div>' +
      (perm === 'default' ? '<button type="button" class="pm-btn wide" data-a="perm">🔔 ' + esc(T('allowNotif')) + '</button>' : perm === 'denied' ? '<p class="pm-note">' + esc(T('notifDenied')) + '</p>' : '') +
      '<div class="pm-al"></div><h4 class="pm-h4">' + esc(T('alertLog')) + '</h4><div class="pm-alog"></div><p class="pm-note">' + esc(T('alertsHow')) + '</p>';
    $('[data-a="new"]', box).onclick = function () { P.alertDialog(A.active()); };
    var pb = $('[data-a="perm"]', box); if (pb) pb.onclick = function () { Notification.requestPermission().then(function () { drawAlerts(box); }); };
    var al = $('.pm-al', box);
    al.innerHTML = AL.length ? AL.map(function (a) {
      return '<div class="pm-ar' + (a.on ? '' : ' off') + '" data-id="' + esc(a.id) + '"><img src="/data/logos/' + esc(a.sym) + '.png" alt="" width="20" height="20"><div class="pm-arb"><b>' + esc(a.sym) + '</b> <span>' + esc(condText(a)) + '</span><small>' +
        esc(T(a.mode === 'every' ? 'every' : 'once')) + (a.n ? ' · ' + esc(T('fired', { n: A.loc(a.n) })) : '') + (a.msg ? ' · ' + esc(a.msg) : '') + '</small></div>' +
        (a.k === 'price' ? '<button type="button" class="pm-ib" data-a="tg" title="' + esc(T('tgAlso')) + '">✈</button>' : '') +
        '<button type="button" class="pm-ib" data-a="tog" title="' + esc(T(a.on ? 'pause' : 'resume')) + '">' + ic(a.on ? 'pause' : 'play') + '</button><button type="button" class="pm-ib" data-a="del" title="' + esc(T('remove')) + '">' + ic('trash') + '</button></div>';
    }).join('') : '<p class="pm-empty">' + esc(T('noAlerts')) + '</p>';
    $$('.pm-ar', al).forEach(function (r) {
      var a = AL.filter(function (z) { return z.id === r.getAttribute('data-id'); })[0]; if (!a) return;
      $$('button', r).forEach(function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-a');
          if (k === 'del') AL = AL.filter(function (z) { return z !== a; });
          if (k === 'tog') { a.on = !a.on; if (a.on && a.k === 'price') a.px = (P.tickers.d[a.sym] || {}).c || null; }
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
  A.panels.alerts = drawAlerts;
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
  function drawCal(box) {
    calBox = box; var st = A.st();
    box.innerHTML = '<div class="pm-ph"><b>' + esc(T('ecoCal')) + '</b><span class="pm-grow"></span><label class="pm-swt"><input type="checkbox"' + (st.ev.on ? ' checked' : '') + '> <span>' + esc(T('onChart')) + '</span></label></div>' +
      '<div class="pm-next"></div><div class="pm-flags pm-imps">' + ['H', 'M', 'L', 'X'].map(function (k) { return '<button type="button" class="pm-chip' + (st.ev.imp.indexOf(k) >= 0 ? ' on' : '') + '" data-i="' + k + '"><i class="pm-dotc" style="background:' + IMPC[k] + '"></i>' + esc(T('imp_' + k)) + '</button>'; }).join('') + '</div>' +
      '<div class="pm-flags pm-curs">' + CURS.map(function (c) { return '<button type="button" class="pm-chip sm' + (st.ev.cur.indexOf(c) >= 0 ? ' on' : '') + '" data-c="' + c + '">' + c + '</button>'; }).join('') + '</div>' +
      '<input class="pm-in pm-calq" type="search" placeholder="' + esc(T('searchEv')) + '"><div class="pm-cl"></div><p class="pm-note pm-calsrc"></p>';
    $('.pm-swt input', box).onchange = function () { st.ev.on = this.checked ? 1 : 0; A.save(); if (st.ev.on) loadCal(); A.cells().forEach(function (c) { c.ovl.update(); }); };
    $$('[data-i]', box).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-i'), i = st.ev.imp.indexOf(k); if (i >= 0) st.ev.imp.splice(i, 1); else st.ev.imp.push(k); b.classList.toggle('on'); A.save(); calList(box); A.cells().forEach(function (c) { c.ovl.update(); }); }; });
    $$('[data-c]', box).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-c'), i = st.ev.cur.indexOf(k); if (i >= 0) st.ev.cur.splice(i, 1); else st.ev.cur.push(k); b.classList.toggle('on'); A.save(); calList(box); A.cells().forEach(function (c) { c.ovl.update(); }); }; });
    var q = $('.pm-calq', box); q.value = calQ; q.oninput = function () { calQ = q.value; calList(box); };
    if (!CAL) { $('.pm-cl', box).innerHTML = '<p class="pm-empty">' + esc(T('loading')) + '</p>'; loadCal(); return; }
    calList(box);
  }
  function calList(box) {
    var st = A.st(), list = $('.pm-cl', box); if (!list || !CAL) return;
    var q = calQ.trim().toLowerCase(), now = Date.now() / 1000;
    var ev = CAL.filter(function (e) { return st.ev.imp.indexOf(e.i) >= 0 && (!st.ev.cur.length || st.ev.cur.indexOf(e.c) >= 0) && (!q || (evTitle(e) + ' ' + e.n + ' ' + e.c).toLowerCase().indexOf(q) >= 0); });
    var from = now - 14 * 86400; ev = ev.filter(function (e) { return e.t >= from; });
    var html = '', day = null, nowDone = false;
    ev.forEach(function (e) {
      var dk = A.fmtD(e.t, 'day');
      if (dk !== day) { day = dk; html += '<div class="pm-cday">' + esc(dk) + '</div>'; }
      if (!nowDone && e.t > now) { nowDone = true; html += '<div class="pm-cnow" id="pm-cnow">' + esc(T('now')) + ' · ' + esc(A.fmtT(Math.floor(now), 'hm')) + '</div>'; }
      var past = e.t <= now;
      html += '<button type="button" class="pm-cr' + (past ? ' past' : '') + '" data-t="' + e.t + '"><span class="pm-ct">' + esc(A.fmtT(e.t, 'hm')) + '</span><span class="pm-cc"><i class="pm-imp i' + e.i + '"></i>' + esc(e.c) + '</span>' +
        '<span class="pm-cn">' + esc(evTitle(e)) + '<small>' + (e.f ? esc(T('forecast')) + ' ' + esc(e.f) + ' · ' : '') + (e.p ? esc(T('previous')) + ' ' + esc(e.p) : '') + (past && e.b1 != null ? ' · BTC 1h ' + ((e.b1 >= 0 ? '+' : '') + (+e.b1).toFixed(2)) + '%' : '') + '</small></span></button>';
    });
    list.innerHTML = html || '<p class="pm-empty">' + esc(T('noEvents')) + '</p>';
    $$('.pm-cr', list).forEach(function (b) { b.onclick = function () { var t = +b.getAttribute('data-t'); A.goDate(A.active(), t); }; });
    var nx = CAL.filter(function (e) { return e.t > now && e.i === 'H' && (!st.ev.cur.length || st.ev.cur.indexOf(e.c) >= 0); })[0], ne = $('.pm-next', box);
    if (ne) ne.innerHTML = nx ? '⏳ ' + esc(T('nextHigh')) + ': <b>' + esc(nx.c + ' · ' + evTitle(nx)) + '</b> — ' + esc(P.dur(nx.t - now)) : '';
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
    $('.pm-oo', box).innerHTML = others.length ? others.map(function (s) { return '<button type="button" class="pm-chip" data-s="' + s + '"><img src="/data/logos/' + s + '.png" alt="" width="16" height="16">' + s + ' · ' + A.loc(D[s].length) + '</button>'; }).join('') : '<p class="pm-empty">—</p>';
    $$('[data-s]', $('.pm-oo', box)).forEach(function (b) { b.onclick = function () { A.applySym(b.getAttribute('data-s')); }; });
  }
  A.panels.obj = drawObj;
  ['draws', 'active', 'sym', 'drawsel'].forEach(function (n) { A.on(n, function () { if (objBox && objBox.isConnected) drawObj(objBox); }); });
})();
