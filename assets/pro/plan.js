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
    var C = P.calc, base = C.position({ balance: o.balance, riskPct: o.riskPct, entry: o.entry, stop: o.stop, leverage: o.leverage, feePct: o.feePct, slip: o.slip, side: o.side, contract: o.contract, marginMode: o.marginMode, mmrPct: o.mmrPct });
    if (base.err) return base;
    var e = +o.entry, s = +o.stop, fee = (+o.feePct || 0) / 100, long = base.long, R = Math.abs(e - s);
    var tg = (o.targets || []).filter(function (t) { return t && isFinite(+t.p) && +t.p > 0 && +t.q > 0 && (long ? +t.p > e : +t.p < e); }).map(function (t) { return { p: +t.p, q: +t.q }; });
    /* partial exits: the shares are percent of the position. Above 100% is an error; below 100% the rest has no target
       and is reported as still open (it is NOT scaled up — that would change the plan the visitor made) */
    var tot = tg.reduce(function (a, t) { return a + t.q; }, 0);
    if (tot > 100.000001) return { err: 'pctOver' };
    var out = { long: long, qty: base.qty, notional: base.notional, margin: base.margin, marginOk: base.marginOk, risk: base.risk, fees: base.fees, breakeven: base.breakeven,
      liq: base.liq, liqWhy: base.liqWhy, liqModel: base.liqModel, liqBeforeStop: base.liqBeforeStop, contract: base.contract, marginMode: base.marginMode, R: R, scaled: false, unalloc: tg.length ? 100 - tot : 100, targets: [] };
    var profit = 0, gross = 0, wsum = 0, feeT = 0;
    tg.forEach(function (t) {
      var share = t.q / 100, q = base.qty * share, g = q * Math.abs(t.p - e), fe = q * fee * (e + t.p);
      profit += g - fe; gross += g; feeT += fe; wsum += share * t.p; out.targets.push({ p: t.p, share: t.q, r: Math.abs(t.p - e) / R, profit: g - fe, gross: g });
    });
    if (out.unalloc < 1e-9) out.unalloc = 0;
    if (tg.length) { out.avgExit = wsum / (tot / 100); out.profit = profit; out.gross = gross; out.exitFees = feeT;   /* entry + exit fees of the shares that have a target */ out.rr = profit / base.risk; }
    /* funding: a rate per interval (8 h unless set) on the notional for the hours the position is expected to stay open.
       A positive rate is paid by longs and received by shorts; a negative rate the other way round.
       out.funding > 0 = paid by this position. Entered by the visitor, not fetched. */
    var fr = +o.fundingPct, hrs = +o.hours, iv = +o.fundHrs > 0 ? +o.fundHrs : 8;
    if (base.contract !== 'spot' && isFinite(fr) && isFinite(hrs) && hrs > 0 && fr !== 0) out.funding = base.notional * fr / 100 * Math.floor(hrs / iv) * (long ? 1 : -1);
    if (out.profit != null) out.net = out.profit - (out.funding || 0);
    out.netStop = -(base.risk + (out.funding || 0));
    return out;
  };
  /* the status of a saved plan: 'planned' (only designed), 'active' (the visitor says it is open, or on paper), 'closed'.
     Plans saved before statuses existed were all ticked "open" by default, so they come back as planned. */
  P.planStatus = function (p) { return p && (p.status === 'active' || p.status === 'closed' || p.status === 'planned') ? p.status : 'planned'; };
  /* what a set of saved plans adds up to. Planned and active risk are kept apart; closed plans add only their realised
     result, and only to the day they were closed on (dayStart..dayStart+24h, the visitor's own clock).
     The daily limit is a share of the equity at the start of that day:
       left = limit − today's realised loss − active risk at the stops        over = left < 0 */
  P.planBoard = function (plans, balance, dayLimitPct, opt) {
    opt = opt || {}; var ds = isFinite(opt.dayStart) ? +opt.dayStart : -Infinity, de = ds + 864e5;
    var b = { n: 0, risk: 0, long: 0, short: 0, margin: 0, bySym: {}, planned: { n: 0, risk: 0, margin: 0 }, closed: { n: 0, pnlToday: 0, nToday: 0 } };
    (plans || []).forEach(function (p) {
      if (!p) return; var st = P.planStatus(p);
      if (st === 'closed') { b.closed.n++; var pl = +p.pnl; if (isFinite(pl) && +p.closedAt >= ds && +p.closedAt < de) { b.closed.pnlToday += pl; b.closed.nToday++; } return; }
      if (!(p.risk > 0)) return;
      if (st === 'planned') { b.planned.n++; b.planned.risk += p.risk; b.planned.margin += p.margin || 0; return; }
      b.n++; b.risk += p.risk; b.margin += p.margin || 0;
      if (p.long) b.long += p.notional || 0; else b.short += p.notional || 0;
      b.bySym[p.sym] = (b.bySym[p.sym] || 0) + p.risk;
    });
    b.net = b.long - b.short; b.gross = b.long + b.short; b.lossToday = Math.max(0, -b.closed.pnlToday);
    if (balance > 0) { b.riskPct = b.risk / balance * 100; b.plannedPct = b.planned.risk / balance * 100; b.freeMargin = balance - b.margin; b.grossX = b.gross / balance; }
    if (balance > 0 && dayLimitPct > 0) { b.limit = balance * dayLimitPct / 100; b.left = b.limit - b.lossToday - b.risk; b.limitUsed = (b.lossToday + b.risk) / b.limit * 100; b.over = b.left < -1e-9; }
    var top = Object.keys(b.bySym).sort(function (x, y) { return b.bySym[y] - b.bySym[x]; })[0];
    if (top && b.risk > 0) { b.topSym = top; b.topShare = b.bySym[top] / b.risk * 100; }
    return b;
  };
  /* the same plan saved twice is one plan */
  P.planKey = function (p) { return [p.sym, p.long ? 1 : 0, +(+p.entry).toPrecision(10), +(+p.stop).toPrecision(10), +(+p.qty).toPrecision(8), p.ex || ''].join('|'); };
  /* plans read back from storage or an imported file: only well-formed ones, numbers checked */
  P.planClean = function (L, symRe) {
    if (!Array.isArray(L)) return [];
    return L.filter(function (p) { return p && typeof p === 'object' && (!symRe || symRe.test(p.sym || '')) && isFinite(p.entry) && isFinite(p.stop) && isFinite(p.risk) && p.risk >= 0; }).slice(0, 200).map(function (p) {
      var q = { id: String(p.id || '').slice(0, 40) || String(Math.random()).slice(2, 12), at: +p.at || 0, sym: String(p.sym), tf: String(p.tf || '').slice(0, 8), long: !!p.long, entry: +p.entry, stop: +p.stop,
        targets: Array.isArray(p.targets) ? p.targets.slice(0, 3).filter(function (t) { return t && isFinite(t.p) && isFinite(t.share); }).map(function (t) { return { p: +t.p, share: +t.share }; }) : [],
        qty: +p.qty || 0, notional: +p.notional || 0, margin: +p.margin || 0, risk: +p.risk, rr: +p.rr || 0, status: P.planStatus(p),
        ex: /^[A-Za-z0-9 .-]{0,16}$/.test(p.ex || '') ? (p.ex || '') : '' };
      if (q.status === 'closed') { q.closedAt = +p.closedAt || 0; if (isFinite(p.pnl)) q.pnl = +p.pnl; }
      return q;
    });
  };

  var A = P.app; if (!A) return;
  var T = A.T, esc = A.esc, h = A.h, $ = A.$, $$ = A.$$, S = P.store;
  function num(v) { v = parseFloat(String(v).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 1632; }).replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - 1776; }).replace(/[,٬\s]/g, '')); return isFinite(v) ? v : NaN; }
  function f(v, dg) { return isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: dg == null ? 2 : dg }) : '—'; }
  function sg(v, dg) { return !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v), dg); }   /* signed: never "+-" */
  function px(v) { return isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: v >= 100 ? 2 : v >= 1 ? 4 : 8 }) : '—'; }
  var ACC = S.get('ek_pro_acct', null); if (!ACC || typeof ACC !== 'object' || Array.isArray(ACC)) ACC = {};
  ['balance', 'riskPct', 'leverage', 'feePct', 'slip', 'mmrPct', 'dayLimit', 'fundingPct', 'hours', 'fundHrs'].forEach(function (k) { if (!isFinite(ACC[k])) delete ACC[k]; });
  if (['linear', 'inverse', 'spot'].indexOf(ACC.contract) < 0) delete ACC.contract; if (['isolated', 'cross'].indexOf(ACC.marginMode) < 0) delete ACC.marginMode;
  function acc(k, d) { return isFinite(ACC[k]) ? +ACC[k] : d; }
  function saveAcc() { S.set('ek_pro_acct', ACC); }
  function plans() { return P.planClean(S.get('ek_pro_plans', []), A.SYM_RE); }
  function savePlans(L) { S.set('ek_pro_plans', L.slice(0, 200)); }
  function dayStart() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function tz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } }

  var card = null, raf = 0, shown = null, sig = '';
  function close() { if (card) card.remove(); card = null; shown = null; sig = ''; cancelAnimationFrame(raf); }
  function inputs(d) {
    var s = d.s || {}, e = d.pts[0].p, R = Math.abs(e - d.pts[2].p), dir = d.k === 'long' ? 1 : -1, tg = [{ p: d.pts[1].p, q: isFinite(s.q1) ? +s.q1 : 100 }];
    if (+s.r2 > 0) tg.push({ p: e + dir * s.r2 * R, q: isFinite(s.q2) ? +s.q2 : 0 }); if (+s.r3 > 0) tg.push({ p: e + dir * s.r3 * R, q: isFinite(s.q3) ? +s.q3 : 0 });
    return { balance: acc('balance', 1000), riskPct: acc('riskPct', 1), leverage: acc('leverage', 1), feePct: acc('feePct', 0.1), slip: acc('slip', 0), contract: ACC.contract || 'linear', marginMode: ACC.marginMode || 'isolated', mmrPct: acc('mmrPct', 0.5),
      entry: e, stop: d.pts[2].p, side: d.k, targets: tg, fundingPct: acc('fundingPct', 0), hours: acc('hours', 0), fundHrs: acc('fundHrs', 8) };
  }
  P.planInputs = inputs;
  function paint(cell, d) {
    if (!card) return; var r = P.plan(inputs(d)), o = $('.pm-plo', card); o.innerHTML = '';
    var full = card.classList.contains('pm-plx');
    function row(a, b, cls, tip) { var x = h('<div class="pm-plr' + (cls ? ' ' + cls : '') + '"><small></small><b class="pm-num" dir="ltr"></b></div>'); $('small', x).textContent = a; $('b', x).textContent = b; if (tip) x.title = tip; o.appendChild(x); }
    if (r.err) { var w = h('<div class="pm-cw2"></div>'); w.textContent = T('rcE_' + r.err); o.appendChild(w); return; }
    row(T('rcEntry'), px(d.pts[0].p)); row(T('rcStop'), px(d.pts[2].p), 'dn'); row(T('rcQty'), f(r.qty, 8)); row(T('rcNotional'), f(r.notional)); row(T('rcMargin'), f(r.margin));
    row(T('rcMaxLoss'), sg(r.netStop), 'dn', T('plTipLoss')); row(T('rcBE'), px(r.breakeven));
    r.targets.forEach(function (t, i) { row('TP' + (i + 1) + ' · ' + f(t.share, 1) + '%', px(t.p) + '   ' + f(t.r, 2) + 'R   ' + sg(t.profit), t.profit >= 0 ? 'up' : 'dn'); });
    if (r.profit != null) {
      row(T('plAvgExit'), px(r.avgExit));
      if (full) { row(T('plGross'), sg(r.gross)); row(T('plFees'), sg(-r.exitFees, 4), 'dn'); }
      row(T('plTotal'), sg(r.profit) + '   ' + f(r.rr, 2) + 'R', r.profit >= 0 ? 'up' : 'dn');
    }
    if (r.unalloc > 0 && r.targets.length) row(T('plUnalloc'), f(r.unalloc, 1) + '%');
    if (r.funding != null) { row(T('plFunding'), sg(-r.funding, 4), r.funding > 0 ? 'dn' : 'up', T('plTipFund')); if (r.net != null) row(T('plNet'), sg(r.net), r.net >= 0 ? 'up' : 'dn'); }
    if (r.liq != null) row(T('rcLiqS'), px(r.liq), r.liqBeforeStop ? 'dn' : '', T('rcLiqNote')); else if (r.liqWhy) row(T('rcLiqS'), T('rcLiq_' + r.liqWhy));
    if (full) { var fm = h('<code class="pm-cfm" dir="ltr"></code>'); fm.textContent = 'qty = balance × risk% ÷ (|entry − stop| + fee × (entry + stop) + slippage) · TP profit = qty × share × (|TP − entry| − fee × (entry + TP)) · funding = notional × rate × ⌊hours ÷ interval⌋'; o.appendChild(fm); }
    var warn = !r.marginOk ? T('rcW_margin') : r.liqBeforeStop ? T('rcW_liq') : r.profit != null && r.profit <= 0 ? T('plW_fees') : '';
    if (warn) { var wn = h('<div class="pm-cw2"></div>'); wn.textContent = warn; o.appendChild(wn); }
  }
  function open(cell, d) {
    close(); if (!d || (d.k !== 'long' && d.k !== 'short')) return;
    var root = $('#pro'); if (!root) return;
    card = h('<div class="pm-plan" dir="' + (A.RTL() ? 'rtl' : 'ltr') + '"><div class="pm-plh"><b></b><button type="button" class="pm-ib" data-m aria-label=""></button><button type="button" class="pm-ib" data-x aria-label="' + esc(T('close')) + '">' + A.ic('x') + '</button></div><div class="pm-plg"></div><div class="pm-plo"></div><div class="pm-row"><button type="button" class="pm-btn pri" data-save></button><button type="button" class="pm-btn" data-board></button></div><p class="pm-enote"></p></div>');
    $('b', card).textContent = T('plTitle') + ' · ' + T(d.k === 'long' ? 'rcLong' : 'rcShort2'); $('[data-save]', card).textContent = T('plSave'); $('[data-board]', card).textContent = T('plBoard'); $('p', card).textContent = T('plNote');
    var mb = $('[data-m]', card); function mlab() { var x = card.classList.contains('pm-plx'); mb.textContent = x ? '−' : '+'; mb.title = mb.ariaLabel = T(x ? 'plCompact' : 'plExpand'); }
    if (ACC.planFull) card.classList.add('pm-plx'); mlab(); mb.onclick = function () { card.classList.toggle('pm-plx'); ACC.planFull = card.classList.contains('pm-plx') ? 1 : 0; saveAcc(); mlab(); sig = ''; };
    var g = $('.pm-plg', card), s = d.s || {};
    function fld(lbl, val, set, more) { var w = h('<label class="pm-cf' + (more ? ' pm-plmore' : '') + '"><span></span><input class="pm-in" inputmode="decimal" dir="ltr" autocomplete="off"></label>'), i = $('input', w); $('span', w).textContent = T(lbl); i.value = val == null ? '' : val; i.oninput = function () { set(i.value.trim() === '' ? NaN : num(i.value)); sig = ''; }; g.appendChild(w); }
    function accF(k, lbl, def, more) { fld(lbl, acc(k, def), function (v) { if (isFinite(v)) ACC[k] = v; else delete ACC[k]; saveAcc(); }, more); }
    function accS(k, lbl, opts) { var w = h('<label class="pm-cf pm-plmore"><span></span><select class="pm-in"></select></label>'), sel = $('select', w); $('span', w).textContent = T(lbl); opts.forEach(function (x) { var op = document.createElement('option'); op.value = x; op.textContent = T('rcO_' + x); sel.appendChild(op); }); sel.value = ACC[k] || opts[0]; sel.onchange = function () { ACC[k] = sel.value; saveAcc(); sig = ''; }; g.appendChild(w); }
    function drwF(k, lbl, def) { fld(lbl, isFinite(s[k]) ? s[k] : def, function (v) { A.mutate(cell.cfg.sym, function (L) { L.forEach(function (x) { if (x.id === d.id) { x.s = x.s || {}; if (isFinite(v) && v >= 0 && v <= (k.charAt(0) === 'q' ? 100 : 1000)) x.s[k] = v; else delete x.s[k]; } }); }); }); }
    accF('balance', 'rcBal', 1000); accF('riskPct', 'rcRisk', 1); accF('leverage', 'rcLev', 1); accF('feePct', 'rcFee', 0.1);
    drwF('q1', 'plShare1', 100); drwF('r2', 'plR2', ''); drwF('q2', 'plShare2', ''); drwF('r3', 'plR3', ''); drwF('q3', 'plShare3', '');
    accF('slip', 'rcSlip', 0, 1); accS('contract', 'rcCt', ['linear', 'inverse', 'spot']); accS('marginMode', 'rcMode', ['isolated', 'cross']); accF('mmrPct', 'rcMmr', 0.5, 1);
    accF('fundingPct', 'plFundRate', 0, 1); accF('fundHrs', 'plFundIv', 8, 1); accF('hours', 'plHours', 0, 1);
    $('[data-x]', card).onclick = close;
    $('[data-board]', card).onclick = function () { P.riskBoard(); };
    $('[data-save]', card).onclick = function () {
      var nd = cell.drawer.find(d.id) || d, r = P.plan(inputs(nd)); if (r.err) { A.toast(T('rcE_' + r.err)); return; }
      var np = { id: P.uid(), at: Date.now(), sym: cell.cfg.sym, tf: cell.cfg.tf, long: r.long, entry: nd.pts[0].p, stop: nd.pts[2].p, targets: r.targets.map(function (t) { return { p: t.p, share: t.share }; }), qty: r.qty, notional: r.notional, margin: r.margin, risk: r.risk, rr: r.rr || 0, status: 'planned', ex: '' };
      var L = plans(), k = P.planKey(np), dup = L.filter(function (x) { return P.planKey(x) === k && x.status !== 'closed'; })[0];
      if (dup) { A.toast(T('plDup')); return; }
      L.unshift(np); savePlans(L); A.toast(T('plSaved'));
    };
    root.appendChild(card); shown = { cell: cell, id: d.id };
    (function loop() {
      if (!card || !shown) return; var nd = cell.drawer.find(d.id);
      if (!nd) { close(); return; }
      var sgn = nd.pts[0].p + '|' + nd.pts[1].p + '|' + nd.pts[2].p + '|' + JSON.stringify(nd.s || {}) + '|' + JSON.stringify(ACC);
      if (sgn !== sig) { sig = sgn; paint(cell, nd); }
      raf = requestAnimationFrame(loop);
    })();
  }
  A.on('drawsel', function (cell, dd) { if (dd && (dd.k === 'long' || dd.k === 'short')) open(cell, dd); else close(); });
  A.on('drawadd', function (sym, dd) { var c = A.active(); if (c && dd && (dd.k === 'long' || dd.k === 'short') && c.cfg.sym === sym) setTimeout(function () { if (c.drawer.find(dd.id) && !card) c.drawer.select(dd.id); }, 120); });

  /* ---- the board: every saved plan; planned, active and closed kept apart */
  P.riskBoard = function () {
    var box = h('<div class="pm-calc"><div class="pm-cg"></div><div class="pm-co"></div><div class="pm-row pm-plio"></div><div class="pm-tw"><table class="pm-tbl"><thead><tr></tr></thead><tbody></tbody></table></div><p class="pm-enote"></p></div>');
    $('p', box).textContent = T('plBoardNote2', { tz: tz() || '—' });
    var g = $('.pm-cg', box), o = $('.pm-co', box), tb = $('tbody', box), io = $('.pm-plio', box), lastDel = null;
    ['plStatus', 'symbol', 'plEx', 'rcSide', 'rcEntry', 'rcStop', 'rcQty', 'rcNotional', 'rcMaxLoss', 'plPnl', ''].forEach(function (k) { var th = h('<th></th>'); th.textContent = k ? T(k) : ''; $('thead tr', box).appendChild(th); });
    function fld(k, lbl, def) { var w = h('<label class="pm-cf"><span></span><input class="pm-in" inputmode="decimal" dir="ltr"></label>'), i = $('input', w); $('span', w).textContent = T(lbl); i.value = acc(k, def); i.oninput = function () { var v = num(i.value); if (isFinite(v)) ACC[k] = v; else delete ACC[k]; saveAcc(); draw(); }; g.appendChild(w); }
    fld('balance', 'plDayEq', 1000); fld('dayLimit', 'plDayLimit', 3);
    function btn(lbl, fn) { var b = h('<button type="button" class="pm-btn"></button>'); b.textContent = T(lbl); b.onclick = fn; io.appendChild(b); return b; }
    btn('plExport', function () { var blob = new Blob([JSON.stringify({ kind: 'entekhab-plans', v: 2, plans: plans() }, null, 1)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'entekhab-plans.json'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); });
    btn('plImport', function () { var i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json'; i.onchange = function () { var fl = i.files && i.files[0]; if (!fl || fl.size > 512000) { A.toast(T('plImpBad')); return; } fl.text().then(function (t) { var j; try { j = JSON.parse(t); } catch (e) { j = null; } var L = P.planClean(j && j.plans, A.SYM_RE); if (!L.length) { A.toast(T('plImpBad')); return; } var M = plans(), keys = {}; M.forEach(function (x) { keys[x.id] = 1; }); var add = L.filter(function (x) { return !keys[x.id]; }); savePlans(add.concat(M)); A.toast(T('plImpOk', { n: add.length })); draw(); }); }; i.click(); });
    var ub = btn('undo', function () { if (!lastDel) return; var M = plans(); M.splice(Math.min(lastDel.i, M.length), 0, lastDel.p); savePlans(M); lastDel = null; draw(); });
    function draw() {
      var L = plans(), b = P.planBoard(L, acc('balance', 1000), acc('dayLimit', 3), { dayStart: dayStart() }); o.innerHTML = ''; tb.innerHTML = ''; ub.disabled = !lastDel;
      function cardR(a, v, cls, tip) { var x = h('<div class="pm-cor' + (cls ? ' ' + cls : '') + '"><small></small><b class="pm-num" dir="ltr"></b></div>'); $('small', x).textContent = a; $('b', x).textContent = v; if (tip) x.title = tip; o.appendChild(x); }
      cardR(T('plPlannedR'), f(b.planned.risk) + (b.plannedPct != null ? '  (' + f(b.plannedPct, 2) + '%) · ' + b.planned.n : ''), '', T('plTipPlanned'));
      cardR(T('plActiveR'), f(b.risk) + (b.riskPct != null ? '  (' + f(b.riskPct, 2) + '%) · ' + b.n : ''), b.over ? 'dn' : '', T('plTipActive'));
      cardR(T('plClosedToday'), sg(b.closed.pnlToday) + ' · ' + b.closed.nToday, b.closed.pnlToday < 0 ? 'dn' : b.closed.pnlToday > 0 ? 'up' : '');
      cardR(T('plLongX'), f(b.long), 'up'); cardR(T('plShortX'), f(b.short), 'dn'); cardR(T('plNetX'), sg(b.net)); cardR(T('plGrossX'), f(b.gross));
      cardR(T('rcMargin'), f(b.margin)); if (b.freeMargin != null) cardR(T('plFree'), f(b.freeMargin), b.freeMargin < 0 ? 'dn' : '');
      if (b.limit != null) cardR(T('plLeft'), sg(b.left), b.over ? 'dn' : b.limitUsed >= 75 ? '' : 'up', T('plTipLeft'));
      if (b.topSym) cardR(T('plTop'), b.topSym + '  ' + f(b.topShare, 0) + '%', b.topShare >= 60 && b.n > 1 ? 'dn' : '');
      if (b.over || (b.limitUsed != null && b.limitUsed >= 75)) { var w = h('<div class="pm-cw2"></div>'); w.textContent = T(b.over ? 'plKill' : 'plNear', { p: f(b.limitUsed, 0) }); o.appendChild(w); }
      if (!L.length) { var tr0 = h('<tr><td colspan="11" class="pm-enote"></td></tr>'); $('td', tr0).textContent = T('plNone'); tb.appendChild(tr0); }
      L.forEach(function (p, idx) {
        var tr = h('<tr><td><select class="pm-in"><option value="planned"></option><option value="active"></option><option value="closed"></option></select></td><td></td><td><select class="pm-in"></select></td><td></td><td class="pm-num" dir="ltr"></td><td class="pm-num" dir="ltr"></td><td class="pm-num" dir="ltr"></td><td class="pm-num" dir="ltr"></td><td class="pm-num" dir="ltr"></td><td><input class="pm-in" inputmode="decimal" dir="ltr" size="7"></td><td><button type="button" class="pm-ib" aria-label="' + esc(T('remove')) + '">' + A.ic('trash') + '</button></td></tr>'), td = $$('td', tr);
        var st = $('select', td[0]); $$('option', st).forEach(function (op) { op.textContent = T('plS_' + op.value); }); st.value = p.status;
        function upd(fn) { var M = plans(); M.forEach(function (x) { if (x.id === p.id) fn(x); }); savePlans(M); draw(); }
        st.onchange = function () { upd(function (x) { x.status = st.value; if (st.value === 'closed') x.closedAt = Date.now(); else { delete x.closedAt; delete x.pnl; } }); };
        var ex = $('select', td[2]); ['', 'Binance', 'OKX', 'Bybit', 'Kraken', 'Coinbase', 'Bitget', 'KuCoin', 'Other'].forEach(function (x) { var op = document.createElement('option'); op.value = x; op.textContent = x || '—'; ex.appendChild(op); }); ex.value = p.ex || ''; ex.onchange = function () { upd(function (x) { x.ex = ex.value; }); };
        td[1].textContent = P.pair ? P.pair(p.sym) : p.sym; td[3].textContent = T(p.long ? 'rcLong' : 'rcShort2'); td[4].textContent = px(p.entry); td[5].textContent = px(p.stop); td[6].textContent = f(p.qty, 8); td[7].textContent = f(p.notional); td[8].textContent = f(p.risk);
        var pn = $('input', td[9]); if (p.status === 'closed') { pn.value = isFinite(p.pnl) ? p.pnl : ''; pn.placeholder = T('plPnlPh'); pn.onchange = function () { var v = num(pn.value); upd(function (x) { if (isFinite(v)) x.pnl = v; else delete x.pnl; }); }; } else { pn.disabled = true; pn.placeholder = '—'; }
        $('button', tr).onclick = function () { var M = plans(); lastDel = { i: idx, p: p }; savePlans(M.filter(function (x) { return x.id !== p.id; })); draw(); };
        tb.appendChild(tr);
      });
    }
    draw(); A.modal(T('plBoardT'), box, { wide: true, nofocus: true });
  };
})();
