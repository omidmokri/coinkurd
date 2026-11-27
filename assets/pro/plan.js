/* entekhab.net — /market/ trade planner and the open-risk board.
   The planner belongs to the chart's own long/short position tool: select one and a card appears beside it with
   the whole plan — size from the money at risk, notional, margin, fees, break-even, up to three targets with the
   share closed at each, the average exit and the result in R and in money. Drag the entry, the stop or the target on
   the chart and every figure follows at once (the card re-reads the drawing each frame while it is open).
   Targets 2 and 3 are kept as multiples of the risk (R), so they move with the entry and the stop.
   A plan can be saved; saved plans marked "open" add up on the board: total risk, long and short exposure, margin
   in use, and how much of a daily loss limit that risk would take. Crossing the limit only WARNS — nothing here can
   place, change or close an order, and no exchange is ever contacted. Everything is kept in this browser.
   The arithmetic is P.plan (pure, tested by tests/test_pro_plan.js) on top of P.calc.position. */
(function () {
  'use strict';
  var P = window.PRO = window.PRO || {};

  /* a full plan from the three prices of a position drawing and the account settings.
     targets: [{ p: price, q: share % }], shares are scaled to 100 if they do not add up (and said so: `scaled`). */
  P.plan = function (o) {
    var C = P.calc, base = C.position({ balance: o.balance, riskPct: o.riskPct, entry: o.entry, stop: o.stop, leverage: o.leverage, feePct: o.feePct, slip: o.slip, side: o.side });
    if (base.err) return base;
    var e = +o.entry, s = +o.stop, fee = (+o.feePct || 0) / 100, long = base.long, R = Math.abs(e - s);
    var tg = (o.targets || []).filter(function (t) { return t && isFinite(+t.p) && +t.q > 0 && (long ? +t.p > e : +t.p < e); }).map(function (t) { return { p: +t.p, q: +t.q }; });
    var tot = tg.reduce(function (a, t) { return a + t.q; }, 0), scaled = tg.length > 0 && Math.abs(tot - 100) > 0.01;
    var out = { long: long, qty: base.qty, notional: base.notional, margin: base.margin, marginOk: base.marginOk, risk: base.risk, fees: base.fees, breakeven: base.breakeven, liq: base.liq, liqBeforeStop: base.liqBeforeStop, R: R, scaled: scaled, targets: [] };
    var profit = 0, wsum = 0;
    tg.forEach(function (t) {
      var share = t.q / tot, q = base.qty * share, gain = q * (Math.abs(t.p - e) - fee * (e + t.p));
      profit += gain; wsum += share * t.p; out.targets.push({ p: t.p, share: share * 100, r: Math.abs(t.p - e) / R, profit: gain });
    });
    if (tg.length) { out.avgExit = wsum; out.profit = profit; out.rr = profit / base.risk; }
    /* funding: a rate per 8 hours on the notional for the hours the position is expected to stay open (a cost for the
       side that pays; entered by the visitor, not fetched) */
    var fr = +o.fundingPct, hrs = +o.hours; if (isFinite(fr) && isFinite(hrs) && hrs > 0 && fr !== 0) out.funding = base.notional * fr / 100 * hrs / 8;
    return out;
  };
  /* what a set of open plans adds up to */
  P.planBoard = function (plans, balance, dayLimitPct) {
    var b = { n: 0, risk: 0, long: 0, short: 0, margin: 0, bySym: {} };
    (plans || []).forEach(function (p) {
      if (!p || !p.open || !(p.risk > 0)) return; b.n++; b.risk += p.risk; b.margin += p.margin || 0;
      if (p.long) b.long += p.notional || 0; else b.short += p.notional || 0;
      b.bySym[p.sym] = (b.bySym[p.sym] || 0) + p.risk;
    });
    b.net = b.long - b.short; b.gross = b.long + b.short;
    if (balance > 0) { b.riskPct = b.risk / balance * 100; b.freeMargin = balance - b.margin; b.grossX = b.gross / balance; }
    if (balance > 0 && dayLimitPct > 0) { b.limit = balance * dayLimitPct / 100; b.limitUsed = b.risk / b.limit * 100; b.over = b.risk > b.limit; }
    var top = Object.keys(b.bySym).sort(function (x, y) { return b.bySym[y] - b.bySym[x]; })[0];
    if (top && b.risk > 0) { b.topSym = top; b.topShare = b.bySym[top] / b.risk * 100; }
    return b;
  };

  var A = P.app; if (!A) return;
  var T = A.T, esc = A.esc, h = A.h, $ = A.$, $$ = A.$$, S = P.store;
  function num(v) { v = parseFloat(String(v).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 1632; }).replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - 1776; }).replace(/[,٬\s]/g, '')); return isFinite(v) ? v : NaN; }
  function f(v, dg) { return isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: dg == null ? 2 : dg }) : '—'; }
  function px(v) { return isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: v >= 100 ? 2 : v >= 1 ? 4 : 8 }) : '—'; }
  var ACC = S.get('ek_pro_acct', null); if (!ACC || typeof ACC !== 'object' || Array.isArray(ACC)) ACC = {};
  ['balance', 'riskPct', 'leverage', 'feePct', 'dayLimit', 'fundingPct', 'hours'].forEach(function (k) { if (!isFinite(ACC[k])) delete ACC[k]; });
  function acc(k, d) { return isFinite(ACC[k]) ? +ACC[k] : d; }
  function saveAcc() { S.set('ek_pro_acct', ACC); }
  function plans() { var L = S.get('ek_pro_plans', []); return Array.isArray(L) ? L.filter(function (p) { return p && typeof p === 'object' && A.SYM_RE.test(p.sym || '') && isFinite(p.entry) && isFinite(p.stop); }).slice(0, 200) : []; }

  var card = null, raf = 0, shown = null, sig = '';
  function close() { if (card) card.remove(); card = null; shown = null; sig = ''; cancelAnimationFrame(raf); }
  function inputs(d) {
    var s = d.s || {}, e = d.pts[0].p, R = Math.abs(e - d.pts[2].p), dir = d.k === 'long' ? 1 : -1, tg = [{ p: d.pts[1].p, q: isFinite(s.q1) ? +s.q1 : 100 }];
    if (+s.r2 > 0) tg.push({ p: e + dir * s.r2 * R, q: isFinite(s.q2) ? +s.q2 : 0 }); if (+s.r3 > 0) tg.push({ p: e + dir * s.r3 * R, q: isFinite(s.q3) ? +s.q3 : 0 });
    return { balance: acc('balance', 1000), riskPct: acc('riskPct', 1), leverage: acc('leverage', 1), feePct: acc('feePct', 0.1), entry: e, stop: d.pts[2].p, side: d.k, targets: tg, fundingPct: acc('fundingPct', 0), hours: acc('hours', 0) };
  }
  function paint(cell, d) {
    if (!card) return; var r = P.plan(inputs(d)), o = $('.pm-plo', card); o.innerHTML = '';
    function row(a, b, cls) { var x = h('<div class="pm-plr' + (cls ? ' ' + cls : '') + '"><small></small><b class="pm-num" dir="ltr"></b></div>'); $('small', x).textContent = a; $('b', x).textContent = b; o.appendChild(x); }
    if (r.err) { var w = h('<div class="pm-cw2"></div>'); w.textContent = T('rcE_' + r.err); o.appendChild(w); return; }
    row(T('rcEntry'), px(d.pts[0].p)); row(T('rcStop'), px(d.pts[2].p), 'dn'); row(T('rcQty'), f(r.qty, 6)); row(T('rcNotional'), f(r.notional)); row(T('rcMargin'), f(r.margin));
    row(T('rcMaxLoss'), '−' + f(r.risk), 'dn'); row(T('rcBE'), px(r.breakeven));
    r.targets.forEach(function (t, i) { row('TP' + (i + 1) + ' · ' + f(t.share, 0) + '%', px(t.p) + '   ' + f(t.r, 2) + 'R   +' + f(t.profit), 'up'); });
    if (r.profit != null) { row(T('plAvgExit'), px(r.avgExit)); row(T('plTotal'), '+' + f(r.profit) + '   ' + f(r.rr, 2) + 'R', 'up'); }
    if (r.funding != null) row(T('plFunding'), (r.funding > 0 ? '−' : '+') + f(Math.abs(r.funding), 4));
    if (r.liq != null) row(T('rcLiq'), px(r.liq), r.liqBeforeStop ? 'dn' : '');
    var warn = !r.marginOk ? T('rcW_margin') : r.liqBeforeStop ? T('rcW_liq') : r.scaled ? T('plScaled') : '';
    if (warn) { var wn = h('<div class="pm-cw2"></div>'); wn.textContent = warn; o.appendChild(wn); }
  }
  function open(cell, d) {
    close(); if (!d || (d.k !== 'long' && d.k !== 'short')) return;
    var root = $('#pro'); if (!root) return;
    card = h('<div class="pm-plan" dir="' + (A.RTL() ? 'rtl' : 'ltr') + '"><div class="pm-plh"><b></b><button type="button" class="pm-ib" data-x aria-label="' + esc(T('close')) + '">' + A.ic('x') + '</button></div><div class="pm-plg"></div><div class="pm-plo"></div><div class="pm-row"><button type="button" class="pm-btn pri" data-save></button><button type="button" class="pm-btn" data-board></button></div><p class="pm-enote"></p></div>');
    $('b', card).textContent = T('plTitle') + ' · ' + T(d.k === 'long' ? 'rcLong' : 'rcShort2'); $('[data-save]', card).textContent = T('plSave'); $('[data-board]', card).textContent = T('plBoard'); $('p', card).textContent = T('plNote');
    var g = $('.pm-plg', card), s = d.s || {};
    function fld(lbl, val, set) { var w = h('<label class="pm-cf"><span></span><input class="pm-in" inputmode="decimal" dir="ltr" autocomplete="off"></label>'), i = $('input', w); $('span', w).textContent = T(lbl); i.value = val == null ? '' : val; i.oninput = function () { set(i.value.trim() === '' ? NaN : num(i.value)); sig = ''; }; g.appendChild(w); }
    function accF(k, lbl, def) { fld(lbl, acc(k, def), function (v) { if (isFinite(v)) ACC[k] = v; else delete ACC[k]; saveAcc(); }); }
    function drwF(k, lbl, def) { fld(lbl, isFinite(s[k]) ? s[k] : def, function (v) { A.mutate(cell.cfg.sym, function (L) { L.forEach(function (x) { if (x.id === d.id) { x.s = x.s || {}; if (isFinite(v) && v >= 0 && v <= 100) x.s[k] = v; else delete x.s[k]; } }); }); }); }
    accF('balance', 'rcBal', 1000); accF('riskPct', 'rcRisk', 1); accF('leverage', 'rcLev', 1); accF('feePct', 'rcFee', 0.1);
    drwF('q1', 'plShare1', 100); drwF('r2', 'plR2', ''); drwF('q2', 'plShare2', ''); drwF('r3', 'plR3', ''); drwF('q3', 'plShare3', '');
    accF('fundingPct', 'plFundRate', 0); accF('hours', 'plHours', 0);
    $('[data-x]', card).onclick = close;
    $('[data-board]', card).onclick = function () { P.riskBoard(); };
    $('[data-save]', card).onclick = function () {
      var nd = cell.drawer.find(d.id) || d, r = P.plan(inputs(nd)); if (r.err) { A.toast(T('rcE_' + r.err)); return; }
      var L = plans(); L.unshift({ id: P.uid(), at: Date.now(), sym: cell.cfg.sym, tf: cell.cfg.tf, long: r.long, entry: nd.pts[0].p, stop: nd.pts[2].p, targets: r.targets.map(function (t) { return { p: t.p, share: t.share }; }), qty: r.qty, notional: r.notional, margin: r.margin, risk: r.risk, rr: r.rr || 0, open: 1 });
      S.set('ek_pro_plans', L.slice(0, 200)); A.toast(T('plSaved'));
      var b = P.planBoard(L, acc('balance', 1000), acc('dayLimit', 0)); if (b.over) A.toast(T('plOver', { p: f(b.limitUsed, 0) }), 'warn');
    };
    root.appendChild(card); shown = { cell: cell, id: d.id };
    (function loop() {
      if (!card || !shown) return; var nd = cell.drawer.find(d.id);
      if (!nd) { close(); return; }
      var sg = nd.pts[0].p + '|' + nd.pts[1].p + '|' + nd.pts[2].p + '|' + JSON.stringify(nd.s || {}) + '|' + JSON.stringify(ACC);
      if (sg !== sig) { sig = sg; paint(cell, nd); }
      raf = requestAnimationFrame(loop);
    })();
  }
  A.on('drawsel', function (cell, dd) { if (dd && (dd.k === 'long' || dd.k === 'short')) open(cell, dd); else close(); });
  A.on('drawadd', function (sym, dd) { var c = A.active(); if (c && dd && (dd.k === 'long' || dd.k === 'short') && c.cfg.sym === sym) setTimeout(function () { if (c.drawer.find(dd.id) && !card) c.drawer.select(dd.id); }, 120); });

  /* ---- the board: every saved plan, and what the open ones add up to */
  P.riskBoard = function () {
    var box = h('<div class="pm-calc"><div class="pm-cg"></div><div class="pm-co"></div><div class="pm-tw"><table class="pm-tbl"><thead><tr></tr></thead><tbody></tbody></table></div><p class="pm-enote"></p></div>');
    $('p', box).textContent = T('plBoardNote');
    var g = $('.pm-cg', box), o = $('.pm-co', box), tb = $('tbody', box);
    ['plOpen', 'symbol', 'rcSide', 'rcEntry', 'rcStop', 'rcQty', 'rcNotional', 'rcMaxLoss', 'rcRR', ''].forEach(function (k) { var th = h('<th></th>'); th.textContent = k ? T(k) : ''; $('thead tr', box).appendChild(th); });
    function fld(k, lbl, def) { var w = h('<label class="pm-cf"><span></span><input class="pm-in" inputmode="decimal" dir="ltr"></label>'), i = $('input', w); $('span', w).textContent = T(lbl); i.value = acc(k, def); i.oninput = function () { var v = num(i.value); if (isFinite(v)) ACC[k] = v; else delete ACC[k]; saveAcc(); draw(); }; g.appendChild(w); }
    fld('balance', 'rcBal', 1000); fld('dayLimit', 'plDayLimit', 3);
    function draw() {
      var L = plans(), b = P.planBoard(L, acc('balance', 1000), acc('dayLimit', 3)); o.innerHTML = ''; tb.innerHTML = '';
      function cardR(a, v, cls) { var x = h('<div class="pm-cor' + (cls ? ' ' + cls : '') + '"><small></small><b class="pm-num" dir="ltr"></b></div>'); $('small', x).textContent = a; $('b', x).textContent = v; o.appendChild(x); }
      cardR(T('plOpenN'), String(b.n)); cardR(T('plOpenRisk'), f(b.risk) + (b.riskPct != null ? '  (' + f(b.riskPct, 2) + '%)' : ''), b.over ? 'dn' : '');
      cardR(T('plLongX'), f(b.long), 'up'); cardR(T('plShortX'), f(b.short), 'dn'); cardR(T('plNetX'), f(b.net)); cardR(T('rcMargin'), f(b.margin)); if (b.freeMargin != null) cardR(T('plFree'), f(b.freeMargin), b.freeMargin < 0 ? 'dn' : '');
      if (b.limitUsed != null) cardR(T('plLimitUsed'), f(b.limitUsed, 0) + '%', b.over ? 'dn' : b.limitUsed >= 75 ? '' : 'up');
      if (b.topSym) cardR(T('plTop'), b.topSym + '  ' + f(b.topShare, 0) + '%', b.topShare >= 60 && b.n > 1 ? 'dn' : '');
      if (b.over || (b.limitUsed != null && b.limitUsed >= 75)) { var w = h('<div class="pm-cw2"></div>'); w.textContent = T(b.over ? 'plKill' : 'plNear', { p: f(b.limitUsed, 0) }); o.appendChild(w); }
      if (!L.length) { var tr0 = h('<tr><td colspan="10" class="pm-enote"></td></tr>'); $('td', tr0).textContent = T('plNone'); tb.appendChild(tr0); }
      L.forEach(function (p) {
        var tr = h('<tr><td><input type="checkbox"></td><td></td><td></td><td class="pm-num" dir="ltr"></td><td class="pm-num" dir="ltr"></td><td class="pm-num" dir="ltr"></td><td class="pm-num" dir="ltr"></td><td class="pm-num" dir="ltr"></td><td class="pm-num" dir="ltr"></td><td><button type="button" class="pm-ib" aria-label="' + esc(T('remove')) + '">' + A.ic('trash') + '</button></td></tr>'), td = $$('td', tr);
        var cb = $('input', tr); cb.checked = !!p.open; cb.onchange = function () { var M = plans(); M.forEach(function (x) { if (x.id === p.id) x.open = cb.checked ? 1 : 0; }); S.set('ek_pro_plans', M); draw(); };
        td[1].textContent = P.pair ? P.pair(p.sym) : p.sym; td[2].textContent = T(p.long ? 'rcLong' : 'rcShort2'); td[3].textContent = px(p.entry); td[4].textContent = px(p.stop); td[5].textContent = f(p.qty, 6); td[6].textContent = f(p.notional); td[7].textContent = f(p.risk); td[8].textContent = p.rr ? f(p.rr, 2) + 'R' : '—';
        $('button', tr).onclick = function () { S.set('ek_pro_plans', plans().filter(function (x) { return x.id !== p.id; })); draw(); };
        tb.appendChild(tr);
      });
    }
    draw(); A.modal(T('plBoardT'), box, { wide: true, nofocus: true });
  };
})();
