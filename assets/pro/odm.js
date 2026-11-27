/* entekhab.net — /market/ ODM: one plan for the whole life of a trade. Where OCO links one entry to one stop and fixed
   targets, an ODM plan has
     entries  a ladder of up to 10 limit prices, each buying (or selling) a share of the position — DCA in or scale in;
     stop     a price, a percent beyond the deepest entry, or k × ATR beyond it (the market's own range, no fixed figure);
     exits    up to 8 steps, each closing a share at a price, at a percent from the average entry, or at a multiple of R;
     trail    what is left after the steps rides a trailing stop (a percent or k × ATR), from the start or once a price is reached;
     guard    the stop may move to break-even once a chosen exit has filled.
   It is sized from the money at risk: if every entry fills and the stop is hit, the loss (fees and slippage included) is
   the risk the visitor set — never more. Every way the plan can end is listed with what it pays.
   P.odmSim walks the plan over closed candles of the chart, one bar at a time, with no look-ahead; when one bar touches
   two levels and the candle cannot say which came first, the worse one is taken and the bar is marked.
   Nothing here places an order. Pure maths in P.odm (tested by tests/test_pro_odm.js); the dialog is below. */
(function () {
  'use strict';
  var P = window.PRO = window.PRO || {};
  var O = P.odm = {};
  var EPS = 1e-9;
  function sum(a, f) { var s = 0; for (var i = 0; i < a.length; i++) s += f ? f(a[i], i) : a[i]; return s; }

  /* a ladder from the first price: n steps, each step% further from it (lower for a long, higher for a short);
     shares equal, or growing 1:2:3… (more bought further away), rounded to 0.01% with the last step taking the rest */
  O.ladder = function (first, n, stepPct, long, mode) {
    first = +first; n = Math.round(+n); stepPct = +stepPct;
    if (!(first > 0) || !(n >= 1 && n <= 10) || !(stepPct >= 0 && stepPct < 50)) return null;
    var w = [], i; for (i = 0; i < n; i++) w.push(mode === 'grow' ? i + 1 : 1);
    var W = sum(w), out = [], acc = 0;
    for (i = 0; i < n; i++) {
      var q = i === n - 1 ? Math.round((100 - acc) * 100) / 100 : Math.round(w[i] / W * 10000) / 100; acc += q;
      out.push({ p: first * (1 + (long ? -1 : 1) * stepPct / 100 * i), q: q });
    }
    return out;
  };

  /* Wilder's ATR over the last n bars of B (closed bars only are passed in) */
  O.atr = function (B, n) {
    n = n || 14; if (!B || B.length < n + 1) return null;
    var a = 0, i, tr;
    for (i = 1; i <= n; i++) { tr = Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c)); a += tr; }
    a /= n;
    for (i = n + 1; i < B.length; i++) { tr = Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c)); a = (a * (n - 1) + tr) / n; }
    return a;
  };

  /* the plan. o = { side, balance, riskPct, leverage, feePct, slip, contract, marginMode, mmrPct, fundingPct, hours, fundHrs,
       entries: [{p, q}], stop: {mode: 'price'|'pct'|'atr', v, atr}, exits: [{mode: 'price'|'pct'|'r', v, q}],
       trail: {on, mode: 'pct'|'atr', v, atr, act: {mode: 'none'|'price'|'pct'|'r', v}}, beAfter: 0 | exit number } */
  O.plan = function (o) {
    var long = o.side !== 'short', dir = long ? 1 : -1, bal = +o.balance, rp = +o.riskPct, fee = (+o.feePct || 0) / 100, slip = +o.slip || 0;
    var lev = o.leverage === '' || o.leverage == null ? 1 : +o.leverage, ct = o.contract === 'spot' || o.contract === 'inverse' ? o.contract : 'linear';
    if (!(bal > 0) || !(rp > 0)) return { err: 'num' };
    if (rp > 100) return { err: 'risk' };
    if (o.contract === 'inverse') return { err: 'inverse' };     /* coin-margined P&L is in the coin: not modelled here */
    if (ct === 'spot') { if (!long) return { err: 'spotShort' }; lev = 1; }
    if (!(lev >= 1) || lev > 500) return { err: 'lev' };
    if (!(slip >= 0) || !(fee >= 0 && fee < 0.05)) return { err: 'num' };
    /* entries */
    var E = (o.entries || []).filter(function (x) { return x && x.p !== '' && x.p != null; }).map(function (x) { return { p: +x.p, q: +x.q }; });
    if (!E.length) return { err: 'noEntry' };
    if (E.length > 10) return { err: 'many' };
    for (var i = 0; i < E.length; i++) if (!(E[i].p > 0) || !(E[i].q > 0)) return { err: 'num' };
    var qe = sum(E, function (x) { return x.q; }); if (Math.abs(qe - 100) > 0.01) return { err: 'entryPct' };
    E.forEach(function (x) { x.w = x.q / qe; });
    var avg = sum(E, function (x) { return x.w * x.p; }), deep = long ? Math.min.apply(null, E.map(function (x) { return x.p; })) : Math.max.apply(null, E.map(function (x) { return x.p; }));
    /* stop: beyond the deepest entry */
    var st = o.stop || {}, sp;
    if (st.mode === 'pct') { if (!(+st.v > 0 && +st.v < 100)) return { err: 'stop' }; sp = deep * (1 - dir * st.v / 100); }
    else if (st.mode === 'atr') { if (!(+st.v > 0) || !(+st.atr > 0)) return { err: 'atr' }; sp = deep - dir * st.v * st.atr; }
    else sp = +st.v;
    if (!(sp > 0)) return { err: 'stop' };
    if (long ? sp >= deep : sp <= deep) return { err: 'side' };
    /* size from the risk: a full fill stopped out loses exactly the risk */
    var risk = bal * rp / 100, perW = sum(E, function (x) { return x.w * (Math.abs(x.p - sp) + fee * (x.p + sp) + slip); });
    var qty = risk / perW, R = Math.abs(avg - sp);
    var fills = [], cq = 0, cw = 0, cl = 0;
    E.forEach(function (x, k) {
      cw += x.w; cq += x.w * x.p; cl += x.w * (Math.abs(x.p - sp) + fee * (x.p + sp) + slip);
      fills.push({ n: k + 1, p: x.p, q: x.q, qty: qty * x.w, filled: cw * 100, avg: cq / cw, loss: qty * cl });
    });
    /* exits */
    var X = (o.exits || []).filter(function (x) { return x && x.v !== '' && x.v != null && +x.q > 0; }).map(function (x) { return { mode: x.mode, v: +x.v, q: +x.q }; });
    if (X.length > 8) return { err: 'many' };
    var out = [], qx = 0, prev = avg;
    for (i = 0; i < X.length; i++) {
      var x = X[i], p = x.mode === 'pct' ? avg * (1 + dir * x.v / 100) : x.mode === 'r' ? avg + dir * x.v * R : x.v;
      if (!(p > 0) || !(x.q > 0)) return { err: 'num' };
      if (long ? p <= avg : p >= avg) return { err: 'tp', at: i + 1 };
      if (i && (long ? p <= prev : p >= prev)) return { err: 'order', at: i + 1 };
      prev = p; qx += x.q;
      var gain = dir * (p - avg) - fee * (avg + p);
      out.push({ n: i + 1, p: p, q: x.q, qty: qty * x.q / 100, profit: qty * x.q / 100 * gain, r: qty * x.q / 100 * gain / risk, inRange: long ? p <= Math.max.apply(null, E.map(function (e) { return e.p; })) : p >= Math.min.apply(null, E.map(function (e) { return e.p; })) });
    }
    if (qx > 100 + 0.01) return { err: 'pctOver' };
    var rest = Math.max(0, 100 - qx);
    /* break-even: the price where the rest closes for nothing after fees */
    var be = long ? avg * (1 + fee) / (1 - fee) : avg * (1 - fee) / (1 + fee);
    var beAfter = Math.round(+o.beAfter || 0); if (!(beAfter >= 0 && beAfter <= out.length)) beAfter = 0;
    /* the trail on the rest */
    var tr = o.trail || {}, T = null;
    if (tr.on && rest > 0) {
      var d0 = tr.mode === 'atr' ? +tr.v * +tr.atr : null;
      if (tr.mode === 'atr' ? !(d0 > 0) : !(+tr.v > 0 && +tr.v < 50)) return { err: 'trail' };
      var ac = tr.act || {}, ap = ac.mode === 'price' ? +ac.v : ac.mode === 'pct' ? avg * (1 + dir * ac.v / 100) : ac.mode === 'r' ? avg + dir * ac.v * R : null;
      if (ap != null && (!(ap > 0) || (long ? ap <= avg : ap >= avg))) return { err: 'act' };
      var dist = function (ref) { return tr.mode === 'atr' ? d0 : ref * tr.v / 100; };
      /* the least the trail can close at: the stop if it starts from the entry; act − distance once activated */
      var floor = ap != null ? ap - dir * dist(ap) : null;
      if (floor != null && (long ? floor < sp : floor > sp)) floor = sp;
      T = { q: rest, qty: qty * rest / 100, mode: tr.mode, v: +tr.v, dist: tr.mode === 'atr' ? d0 : null, act: ap, floor: floor };
      if (floor != null) { var g2 = dir * (floor - avg) - fee * (avg + floor); T.floorPnl = T.qty * g2; T.floorR = T.floorPnl / risk; }
    }
    /* every way it ends, with all entries filled: the stop first; each exit then the stop (or break-even) on what is left;
       all exits, then the trail at its floor (or the stop, if it has none), or the rest left open if there is no trail */
    function closeRest(qPct, at) { var g = dir * (at - avg) - fee * (avg + at) - (at === sp ? slip : 0); return qty * qPct / 100 * g; }
    var rows = [{ k: 'stop', pnl: -risk, r: -1 }], banked = 0, left = 100;
    out.forEach(function (x, j) {
      banked += x.profit; left -= x.q;
      var guard = beAfter && j + 1 >= beAfter, at = guard ? be : sp, rp2 = banked + (left > EPS ? closeRest(left, at) : 0);
      rows.push({ k: 'exit', n: x.n, be: guard && left > EPS, pnl: rp2, r: rp2 / risk });
    });
    if (rest > EPS && (out.length || T)) {
      if (T && T.floor != null) rows.push({ k: 'trail', pnl: banked + T.floorPnl, r: (banked + T.floorPnl) / risk });
      else if (T) { var ws = banked + closeRest(rest, sp); rows.push({ k: 'trailStop', pnl: ws, r: ws / risk }); }
      else rows.push({ k: 'open', pnl: banked, r: banked / risk, open: rest });
    }
    var notional = qty * avg, margin = notional / lev;
    var res = { long: long, risk: risk, qty: qty, avg: avg, deep: deep, stop: sp, R: R, notional: notional, margin: margin, marginOk: margin <= bal,
      fills: fills, exits: out, rest: rest, trail: T, be: be, beAfter: beAfter, rows: rows,
      best: out.length ? sum(out, function (x) { return x.profit; }) : null };
    /* the liquidation of the full position, from the shared calculator — a simplified estimate, as there */
    if (P.calc && P.calc.position) {
      var lq = P.calc.position({ balance: bal, riskPct: rp, entry: avg, stop: sp, leverage: lev, feePct: o.feePct, slip: slip, contract: ct, marginMode: o.marginMode, mmrPct: o.mmrPct, side: long ? 'long' : 'short' });
      if (!lq.err) { res.liq = lq.liq; res.liqWhy = lq.liqWhy; res.liqBeforeStop = lq.liqBeforeStop; }
    }
    var fr = +o.fundingPct, hrs = +o.hours, iv = +o.fundHrs > 0 ? +o.fundHrs : 8;
    if (ct !== 'spot' && isFinite(fr) && fr !== 0 && hrs > 0) res.funding = dir * notional * fr / 100 * Math.floor(hrs / iv);
    return res;
  };

  /* the result if the whole position (every entry filled) closes at price `at`, fees on both sides, no slippage */
  O.pnlAt = function (plan, at, feePct) {
    at = +at; if (!plan || plan.err || !(at > 0)) return null;
    var fee = (+feePct || 0) / 100, g = (plan.long ? 1 : -1) * (at - plan.avg) - fee * (plan.avg + at), v = plan.qty * g;
    return { pnl: v, r: v / plan.risk, pct: (plan.long ? 1 : -1) * (at - plan.avg) / plan.avg * 100 };
  };

  /* the plan over closed candles B from bar `from` on. Orders: entries are limits (filled at the level, or at the open
     when the bar opens through it, which is better); the stop and the trail are stops (filled at the level or at a worse
     open, less the slippage); exits are limits. The trail moves on each CLOSED bar's extreme, so a bar never uses its own
     high to protect its own low. When a bar reaches both a protective level and an exit/entry, the protective level is
     taken first and the bar is counted as ambiguous. ATR for the trail is the one at the start (no look-ahead). */
  O.sim = function (plan, o, B, from) {
    if (!plan || plan.err || !B || !B.length) return { err: 'noPlan' };
    from = Math.max(1, Math.min(B.length - 1, Math.round(from)));
    var long = plan.long, dir = long ? 1 : -1, fee = (+o.feePct || 0) / 100, slip = +o.slip || 0;
    var pend = plan.fills.map(function (f) { return { p: f.p, qty: f.qty }; }), exits = plan.exits.map(function (x) { return { p: x.p, qty: x.qty, n: x.n }; });
    var pos = 0, cost = 0, pnl = 0, stop = plan.stop, trailOn = false, best = null, amb = 0, ev = [], done = null, hit = 0;
    var T = plan.trail, tqty = T ? T.qty : 0, tq = 0;
    function avgP() { return pos > EPS ? cost / pos : plan.avg; }
    function close(q, at, why, t) { var a = avgP(), g = dir * (at - a) - fee * (a + at); pnl += q * g; cost -= a * q; pos -= q; if (pos < EPS) { pos = 0; cost = 0; } ev.push({ t: t, k: why, p: at, q: q }); }
    for (var i = from; i < B.length && !done; i++) {
      var b = B[i], hi = b.h, lo = b.l, op = b.o, touchedProt = false;
      /* protective level first (stop, break-even or trail) */
      if (pos > EPS) {
        var lvl = stop;
        if (long ? lo <= lvl : hi >= lvl) {
          var fillAt = long ? Math.min(op, lvl) - slip : Math.max(op, lvl) + slip;
          var others = pend.length || exits.some(function (x) { return long ? hi >= x.p : lo <= x.p; });
          if (others) amb++;
          close(pos, fillAt, trailOn ? 'trail' : stop === plan.stop ? 'stop' : 'be', b.t); touchedProt = true;
          done = trailOn ? 'trail' : stop === plan.stop ? 'stop' : 'be';
          break;
        }
      }
      /* entries */
      for (var k = 0; k < pend.length; k++) {
        var e = pend[k];
        if (long ? lo <= e.p : hi >= e.p) {
          var at = long ? Math.min(op, e.p) : Math.max(op, e.p); pos += e.qty; cost += e.qty * at; ev.push({ t: b.t, k: 'entry', p: at, q: e.qty }); pend.splice(k, 1); k--;
          /* a stop reached in the same bar as a fill: the bar cannot say which came first — take the stop */
          if (long ? lo <= stop : hi >= stop) { amb++; close(pos, long ? Math.min(stop, op) - slip : Math.max(stop, op) + slip, 'stop', b.t); done = 'stop'; break; }
        }
      }
      if (done) break;
      if (pos < EPS) continue;
      /* exits */
      for (var j = 0; j < exits.length; j++) {
        var x = exits[j];
        if (long ? hi >= x.p : lo <= x.p) {
          var q = Math.min(x.qty, pos); if (q > EPS) close(q, long ? Math.max(op, x.p) : Math.min(op, x.p), 'exit' + x.n, b.t);
          hit = x.n; exits.splice(j, 1); j--;
          /* break-even of what is actually held: a partly filled ladder has its own average, not the full plan's */
          if (plan.beAfter && hit >= plan.beAfter && pos > EPS) { var a0 = avgP(), be0 = long ? a0 * (1 + fee) / (1 - fee) : a0 * (1 - fee) / (1 + fee); stop = long ? Math.max(stop, be0) : Math.min(stop, be0); }
        }
      }
      if (pos < EPS && !pend.length) { done = 'exits'; break; }
      /* the trail, from this closed bar on */
      if (T && pos > EPS && !exits.length) {
        var ref = long ? hi : lo;
        if (!trailOn && (T.act == null || (long ? hi >= T.act : lo <= T.act))) trailOn = true;
        if (trailOn) { best = best == null ? ref : long ? Math.max(best, ref) : Math.min(best, ref); var d = T.mode === 'atr' ? T.dist : best * T.v / 100, lv = best - dir * d; stop = long ? Math.max(stop, lv) : Math.min(stop, lv); }
      }
    }
    var last = B[B.length - 1], open = pos > EPS ? dir * (last.c - avgP()) * pos - fee * (avgP() + last.c) * pos : 0;
    return { events: ev, pnl: pnl, r: pnl / plan.risk, open: pos > EPS ? { qty: pos, avg: avgP(), mark: last.c, pnl: open } : null, filled: plan.fills.length - pend.length,
      end: done || (pos > EPS ? 'open' : pend.length === plan.fills.length ? 'none' : 'flat'), ambiguous: amb, stop: stop, bars: Math.min(B.length, i + 1) - from };
  };

  /* ================================================================ the dialog */
  var A = P.app; if (!A) return;
  var T = A.T, esc = A.esc, h = A.h, $ = A.$, $$ = A.$$, S = P.store;
  function num(v) { if (v == null) return ''; v = String(v).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 1632; }).replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - 1776; }).replace(/[,٬\s]/g, ''); if (v === '') return ''; v = parseFloat(v); return isFinite(v) ? v : NaN; }
  function f(v, dg) { return isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: dg == null ? 2 : dg }) : '—'; }
  function px(v) { return isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: v >= 100 ? 2 : v >= 1 ? 4 : 8 }) : '—'; }
  function sg(v, dg) { return isFinite(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v), dg) : '—'; }
  function plain(v) { return isFinite(v) ? String(+v.toPrecision(10)) : ''; }
  function rnd(v) { return isFinite(v) && v > 0 ? plain(+v.toFixed(P.prec ? P.prec(v) : 8)) : ''; }
  var KEY = 'ek_pro_odm';
  function fresh(last) {
    var p0 = last > 0 ? last : NaN, L = p0 > 0 ? O.ladder(p0, 3, 1, true, 'equal') : null;
    return { side: 'long', contract: 'linear', balance: '1000', riskPct: '1', leverage: '1', feePct: '0.1', slip: '0', marginMode: 'isolated', mmrPct: '0.5',
      gen: { first: rnd(p0), n: '3', step: '1', split: 'equal' },
      entries: L ? L.map(function (x) { return { p: rnd(x.p), q: String(x.q) }; }) : [{ p: '', q: '100' }],
      stop: { mode: 'atr', v: '2', len: '14' },
      exits: [{ mode: 'r', v: '1', q: '30' }, { mode: 'r', v: '2', q: '30' }, { mode: 'r', v: '3', q: '20' }],
      trail: { on: true, mode: 'atr', v: '2', act: 'none', av: '' }, beAfter: '1', fundingPct: '', fundHrs: '8', hours: '', at: '', back: '150' };
  }
  /* the chart's closed bars: the forming bar never feeds the ATR or the test */
  function closed(cell) {
    var B = cell && cell.bars || [], t = P.parseTF ? P.parseTF(cell.cfg.tf) : null;
    if (!t || !P.mtfCalc) return B.slice(0, -1);
    return P.mtfCalc.closedOnly(B, t.sec, Date.now() / 1000, false);
  }
  /* the inputs of P.odm.plan from the form's text */
  function inputs(st, atr) {
    return { side: st.side, contract: st.contract, balance: num(st.balance), riskPct: num(st.riskPct), leverage: num(st.leverage), feePct: num(st.feePct) || 0, slip: num(st.slip) || 0,
      marginMode: st.marginMode, mmrPct: num(st.mmrPct), fundingPct: num(st.fundingPct), fundHrs: num(st.fundHrs), hours: num(st.hours),
      entries: st.entries.map(function (e) { return { p: num(e.p), q: num(e.q) }; }),
      stop: { mode: st.stop.mode, v: num(st.stop.v), atr: atr },
      exits: st.exits.map(function (x) { return { mode: x.mode, v: num(x.v), q: num(x.q) }; }),
      trail: { on: !!st.trail.on, mode: st.trail.mode, v: num(st.trail.v), atr: atr, act: { mode: st.trail.act, v: num(st.trail.av) } },
      beAfter: num(st.beAfter) || 0 };
  }
  P.odmInputs = inputs; P.odmFresh = fresh;
  /* ---- the plan on the chart: its levels as price lines you can drag. Dragging an entry, the stop or a target writes that
     price into the plan, the plan is worked out again at once, every other line follows (an average, targets set in R, the
     break-even) and a small panel on the chart shows the new risk, average, R and result. A tap on "+ Entry", "+ Target" or
     "Stop" in that panel, then a tap on the chart, puts that level at the price tapped. Nothing here places an order. */
  var LN = null;
  var LCOL = { e: '#f7931a', avg: '#f7931a', sl: '#ff5a4d', x: '#34d399', tr: '#a78bfa', be: '#9a9a94', liq: '#a855f7' };
  /* the entries and exits the plan uses, as indexes into the form's rows (empty rows are skipped by the plan too) */
  function usedE(st) { var o = []; st.entries.forEach(function (e, i) { if (e && e.p !== '' && e.p != null) o.push(i); }); return o; }
  function usedX(st) { var o = []; st.exits.forEach(function (x, i) { if (x && x.v !== '' && x.v != null && +num(x.q) > 0) o.push(i); }); return o; }
  function levels(st, r) {
    var L = [];
    usedE(st).forEach(function (i, k) { L.push({ k: 'e' + i, p: num(st.entries[i].p), c: LCOL.e, t: 'E' + (k + 1), st: 2, drag: 'e', i: i }); });
    if (r && !r.err) {
      if (r.fills.length > 1) L.push({ k: 'avg', p: r.avg, c: LCOL.avg, t: T('odLAvg'), st: 0 });
      L.push({ k: 'sl', p: r.stop, c: LCOL.sl, t: 'SL', st: 0, drag: 's', w: 2 });
      var xi = usedX(st); r.exits.forEach(function (x, k) { L.push({ k: 'x' + xi[k], p: x.p, c: LCOL.x, t: 'TP' + x.n + ' ' + f(x.q, 0) + '%', st: 2, drag: 'x', i: xi[k] }); });
      if (r.trail && r.trail.act != null) L.push({ k: 'tr', p: r.trail.act, c: LCOL.tr, t: T('odLTrail'), st: 1 });
      if (r.beAfter) L.push({ k: 'be', p: r.be, c: LCOL.be, t: 'BE', st: 1 });
      if (r.liq != null) L.push({ k: 'liq', p: r.liq, c: LCOL.liq, t: T('odLLiq'), st: 3 });
    } else {
      /* the plan refuses these numbers: the levels typed as prices stay on the chart, so they can be dragged back */
      if (st.stop.mode === 'price' && num(st.stop.v) > 0) L.push({ k: 'sl', p: num(st.stop.v), c: LCOL.sl, t: 'SL', st: 0, drag: 's', w: 2 });
      usedX(st).forEach(function (i, k) { var x = st.exits[i]; if (x.mode === 'price') L.push({ k: 'x' + i, p: num(x.v), c: LCOL.x, t: 'TP' + (k + 1) + ' ' + f(num(x.q), 0) + '%', st: 2, drag: 'x', i: i }); });
    }
    return L.filter(function (l) { return l.p > 0 && isFinite(l.p); });
  }

  /* the plan as a position on the candles, like a long/short position tool: from the chosen candle to the right edge, green from the
     average entry to the last target, red from the average entry to the stop; every level named with its share, its % from the
     average entry and its money; a round handle on the entry line moves the start candle */
  function zoneX(Z, ts) {
    var c = Z.cell, D = c.disp && c.disp.length ? c.disp : c.bars, sec = c.tfSec ? c.tfSec() : 0; if (!D || !D.length || !sec || !P.t2l) return null;
    if (!(+Z.st.anchor > 0)) {
      var vr = null; try { vr = ts.getVisibleLogicalRange(); } catch (e) { }
      var lg = vr ? Math.round(vr.to - (vr.to - vr.from) * 0.3) : D.length - 30; lg = Math.max(0, Math.min(D.length - 1, lg)); Z.st.anchor = D[lg].t;
    }
    var l = P.t2l(D, +Z.st.anchor, sec); if (l == null || !isFinite(l)) return null;
    var x = null; try { x = ts.logicalToCoordinate(Math.round(l)); } catch (e) { } return x;
  }
  /* the box's right edge: a candle of its own (closed, as on TradingView), or the right edge of the chart when it is extended */
  function zoneEnd(Z, ts, W) {
    if (Z.st.zExt) return W;
    var c = Z.cell, D = c.disp && c.disp.length ? c.disp : c.bars, sec = c.tfSec ? c.tfSec() : 0; if (!D || !D.length || !sec || !P.t2l || !P.l2t) return W;
    var la = P.t2l(D, +Z.st.anchor, sec); if (la == null || !isFinite(la)) return W;
    if (!(+Z.st.zEnd > +Z.st.anchor)) {
      var vr = null; try { vr = ts.getVisibleLogicalRange(); } catch (e) { }
      var span = vr ? Math.max(12, Math.round((vr.to - vr.from) * 0.2)) : 20; Z.st.zEnd = P.l2t(D, Math.round(la) + span, sec);
    }
    var l = P.t2l(D, +Z.st.zEnd, sec); if (l == null || !isFinite(l)) return W;
    var x = null; try { x = ts.logicalToCoordinate(Math.round(l)); } catch (e) { } return x == null ? W : x;
  }
  var LRI = '⁦', PDI = '⁩';
  function zonePaint(ctx, W, H, cell) {
    var Z = LN; if (!Z || Z.cell !== cell) return; Z.box = null;
    if (Z.main !== cell.main) { if (!Z.resync) Z.resync = setTimeout(function () { Z.resync = null; if (LN === Z) syncLines(Z); }, 0); return; }   /* the chart type changed: the lines go on the new series first */
    if (Z.noZone || !Z.plan || Z.plan.err) { if (Z.lay) { Z.lay.innerHTML = ''; Z.layHtml = ''; } if (Z.noZone) return; }
    var r = Z.plan; if (!r || r.err || !r.exits) return;
    var m = cell.main, ts = cell.chart.timeScale(), yv = function (p) { var y = null; try { y = m.priceToCoordinate(p); } catch (e) { } return y; };
    var ya = yv(r.avg), ys = yv(r.stop), ex = r.exits, yt = ex.length ? yv(ex[ex.length - 1].p) : null; if (ya == null || ys == null) return;
    var xa = zoneX(Z, ts); if (xa == null) xa = W * 0.7;
    var xe = zoneEnd(Z, ts, W), ext = !!Z.st.zExt;
    var x0 = Math.max(0, Math.min(W - 24, xa)), x1 = ext ? W : Math.max(x0 + 24, Math.min(W, xe)), w = x1 - x0, rtl = A.RTL(), dir = r.long ? 1 : -1;
    var light = !!(cell.el && cell.el.closest && cell.el.closest('.pm-light'));
    var G = light ? 'rgba(16,150,100,' : 'rgba(52,211,153,', Rd = light ? 'rgba(220,60,50,' : 'rgba(255,90,77,';
    function band(y1, y2, c) { var t = Math.min(y1, y2), b = Math.max(y1, y2); ctx.fillStyle = c + '0.14)'; ctx.fillRect(x0, t, w, b - t); ctx.fillStyle = c + '0.55)'; ctx.fillRect(x0, t, 1.5, b - t); }
    ctx.save();
    if (yt != null) band(ya, yt, G);
    band(ya, ys, Rd);
    /* each target and the stop: a thin line across the box */
    ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
    ex.forEach(function (x) { var y = yv(x.p); if (y == null) return; ctx.strokeStyle = G + '0.8)'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); });
    ctx.setLineDash([]); ctx.strokeStyle = Rd + '0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, ys); ctx.lineTo(x1, ys); ctx.stroke();
    ctx.strokeStyle = light ? 'rgba(40,40,40,.85)' : 'rgba(236,236,230,.85)'; ctx.beginPath(); ctx.moveTo(x0, ya); ctx.lineTo(x1, ya); ctx.stroke();
    if (Z.sel) {   /* selected: a thin frame round the whole position */
      var ft = Math.min(ya, ys, yt != null ? yt : ya), fb = Math.max(ya, ys, yt != null ? yt : ya);
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(247,147,26,.9)'; ctx.strokeRect(x0 + 0.5, ft + 0.5, Math.max(1, w - 1), Math.max(1, fb - ft - 1)); ctx.setLineDash([]);
    }
    ctx.restore();
    /* the labels, kept apart: the entry and the stop always, then the last target, then the others. They are page elements
       over the chart (not paint under the candles), so they stay readable and keep their words in the reading order */
    var pct = function (p) { return dir * (p / r.avg - 1) * 100; }, used = [], tags = [], html = '';
    var tz = 'class="pm-odzp ', es = A.esc;
    tags.push({ y: ya, t: T(r.long ? 'odZLong' : 'odZShort') + ' · ' + T('odTopAvg') + ' ' + LRI + px(r.avg) + PDI, c: 'e', pr: 0 });
    tags.push({ y: ys, t: 'SL · ' + LRI + sg(pct(r.stop), 2) + '% · −' + f(r.risk) + PDI, c: 's', pr: 1 });
    ex.forEach(function (x, k) { var y = yv(x.p); if (y == null) return; tags.push({ y: y, t: 'TP' + x.n + ' · ' + LRI + f(x.q, 0) + '% · ' + sg(pct(x.p), 2) + '% · ' + sg(x.profit) + PDI, c: 'x', pr: k === ex.length - 1 ? 2 : 3 }); });
    ctx.save(); ctx.font = '600 11px Vazirmatn, Tahoma, sans-serif';
    tags.slice().sort(function (a, b) { return a.pr - b.pr; }).forEach(function (g) {
      if (g.y < 9 || g.y > H - 9) return; if (used.some(function (u) { return Math.abs(u - g.y) < 19; })) return; used.push(g.y);
      var tw = ctx.measureText(g.t).width + 14, lx = Math.max(2, Math.min(x0 + 10, W - tw - 2));
      html += '<span ' + tz + g.c + '" dir="' + (rtl ? 'rtl' : 'ltr') + '" style="left:' + Math.round(lx) + 'px;top:' + Math.round(g.y) + 'px">' + es(g.t) + '</span>';
    });
    /* in the middle of each zone, the whole plan in one line when there is room, kept on the chart and off the level labels */
    ctx.font = '700 12px Vazirmatn, Tahoma, sans-serif';
    function mid(txt, y, c) {
      if (y < 12 || y > H - 12 || used.some(function (u) { return Math.abs(u - y) < 18; })) return;
      var tw = ctx.measureText(txt).width + 18, cx = Math.max(tw / 2 + 4, Math.min(W - tw / 2 - 4, x0 + w / 2));
      html += '<span class="pm-odzm ' + c + '" dir="' + (rtl ? 'rtl' : 'ltr') + '" style="left:' + Math.round(cx) + 'px;top:' + Math.round(y) + 'px">' + es(txt) + '</span>';
    }
    if (yt != null && r.best != null) { var g0 = Math.max(Math.min(ya, yt), 0), g1 = Math.min(Math.max(ya, yt), H); if (g1 - g0 >= 46) mid(T('odZRew') + ' ' + LRI + sg(pct(ex[ex.length - 1].p), 2) + '% · ' + sg(r.best) + ' · R:R 1:' + f(r.best / r.risk, 2) + PDI, (g0 + g1) / 2, 'x'); }
    var s0 = Math.max(Math.min(ya, ys), 0), s1 = Math.min(Math.max(ya, ys), H); if (s1 - s0 >= 46) mid(T('odZRisk') + ' ' + LRI + sg(pct(r.stop), 2) + '% · −' + f(r.risk) + PDI, (s0 + s1) / 2, 's');
    ctx.restore();
    /* the handle that moves the start candle */
    if (ya >= 0 && ya <= H) {
      html += '<span class="pm-odzh' + (Z.sel ? ' sel' : '') + (Z.drag && Z.drag.kind === 'anc' ? ' on' : '') + '" style="left:' + Math.round(x0) + 'px;top:' + Math.round(ya) + 'px"></span>';
      /* and the one that moves the right edge (none while the box runs to the edge of the chart) */
      if (!ext && x1 < W - 2) html += '<span class="pm-odzh pm-odze' + (Z.sel ? ' sel' : '') + (Z.drag && Z.drag.kind === 'end' ? ' on' : '') + '" style="left:' + Math.round(x1) + 'px;top:' + Math.round(ya) + 'px"></span>';
    }
    var lay = Z.lay; if (!lay || !lay.isConnected) { lay = Z.lay = document.createElement('div'); lay.className = 'pm-odz'; lay.setAttribute('aria-hidden', 'true'); cell.box.appendChild(lay); }
    if (Z.layHtml !== html) { lay.innerHTML = html; Z.layHtml = html; }
    var all = [ya, ys].concat(yt != null ? [yt] : []);
    Z.box = { x0: x0, x1: x1, ext: ext, end: !ext && x1 < W - 2, top: Math.max(0, Math.min.apply(null, all)), bot: Math.min(H, Math.max.apply(null, all)), ya: ya, long: r.long, H: H };
  }
  (P.ovHooks = P.ovHooks || []).push(zonePaint);
  function repaint(Z) { try { if (Z.cell.ovl) Z.cell.ovl.update(); } catch (e) { } }
  function hideLines() {
    if (!LN) return; var c = LN.cell, Z = LN; LN = null; Z.box = null; if (Z.lay) Z.lay.remove(); Z.lay = null; repaint(Z);
    Object.keys(Z.map).forEach(function (k) { try { c.main.removePriceLine(Z.map[k]); } catch (e) { } });
    Z.off(); if (Z.hud) Z.hud.remove(); unlock(Z); if (c.el) c.el.classList.remove('pm-odpick');
  }
  /* a line held: the chart must not pan under it. Let go: the chart gets back its own settings from the page (not a copy taken when
     the line was grabbed, which could itself be a locked chart and would then stay locked) */
  function lock(Z) { if (Z.locked) return; Z.locked = 1; try { Z.cell.chart.applyOptions({ handleScroll: false, handleScale: false }); } catch (e) { } }
  function unlock(Z) { if (!Z.locked) return; Z.locked = null; if (P.chartFree) P.chartFree(Z.cell.chart); else try { Z.cell.chart.applyOptions({ handleScroll: true, handleScale: true }); } catch (e) { } }
  /* draw (or move) every line of the plan; a line whose level is gone is removed */
  function syncLines(Z) {
    if (Z.main !== Z.cell.main) { Z.map = {}; Z.main = Z.cell.main; }   /* a new series (another chart type): its lines are drawn again */
    var L = levels(Z.st, Z.plan), seen = {};
    L.forEach(function (l) {
      seen[l.k] = 1; var o = { price: l.p, color: l.c, lineWidth: l.w || (Z.drag && Z.drag.k === l.k ? 3 : 1), lineStyle: l.st, axisLabelVisible: true, title: l.t + (l.drag ? ' ↕' : '') };
      if (Z.drag && Z.drag.k === l.k) o.lineWidth = 3;
      var ex = Z.map[l.k];
      if (ex) { try { ex.applyOptions(o); } catch (e) { } } else { try { Z.map[l.k] = Z.cell.main.createPriceLine(o); } catch (e) { } }
    });
    Object.keys(Z.map).forEach(function (k) { if (!seen[k]) { try { Z.cell.main.removePriceLine(Z.map[k]); } catch (e) { } delete Z.map[k]; } });
    Z.L = L; hud(Z); if (!Z.drag) placeHud(Z); repaint(Z);
  }
  /* the panel sits low on the chart, or under the legend when a line it would cover is there (a line under it could not be grabbed) */
  function placeHud(Z) {
    var b = Z.hud; if (!b || !Z.cell.el.isConnected) return;
    var c = Z.cell, cr = c.el.getBoundingClientRect(), br = c.box.getBoundingClientRect(), hh = b.offsetHeight; if (!hh) return;
    var leg = $('.pm-leg', c.el), lb = leg ? Math.max(8, leg.getBoundingClientRect().bottom - cr.top + 6) : 8;
    var bot = parseFloat(getComputedStyle(b).getPropertyValue('--odb')) || (innerWidth < 600 ? 30 : 34);
    var bands = { low: [cr.bottom - bot - hh - br.top, cr.bottom - bot - br.top], top: [cr.top + lb - br.top, cr.top + lb + hh - br.top] };
    function hits(r) { var n = 0; Z.L.forEach(function (l) { if (!l.drag) return; var y = null; try { y = c.main.priceToCoordinate(l.p); } catch (e) { } if (y != null && y >= r[0] - 10 && y <= r[1] + 10) n++; }); return n; }
    var lo = hits(bands.low), tp = hits(bands.top), up = lo > 0 && tp < lo;
    b.classList.toggle('top', up); b.style.top = up ? lb + 'px' : ''; b.style.bottom = up ? 'auto' : '';
  }
  function recalc(Z) { Z.plan = O.plan(inputs(Z.st, Z.atr)); return Z.plan; }
  /* the small panel on the chart */
  function hud(Z) {
    var b = Z.hud; if (!b) return;
    var r = Z.plan, top = $('.pm-odhs', b), msg = $('.pm-odhm', b); top.innerHTML = '';
    function part(lbl, val, cls) { var sp = document.createElement('span'); if (cls) sp.className = cls; sp.appendChild(document.createTextNode(lbl + ' ')); var bd = document.createElement('bdi'); bd.dir = 'ltr'; bd.className = 'pm-num'; bd.textContent = val; sp.appendChild(bd); top.appendChild(sp); }
    if (!r || r.err) { msg.textContent = r ? T('odE_' + r.err, { n: r.at || '' }) : ''; msg.className = 'pm-odhm dn'; }
    else {
      part(T('odTopRisk'), '−' + f(r.risk), 'dn'); part(T('odTopAvg'), px(r.avg)); part('SL', px(r.stop)); part('R', px(Math.abs(r.avg - r.stop)));
      if (r.best != null) part(T('odTopBest'), sg(r.best) + ' (' + f(r.best / r.risk, 2) + 'R)', 'up');
      part(T('rcQty'), f(r.qty, 6));
      msg.className = 'pm-odhm';
      if (Z.drag) { var dl = Z.L.filter(function (l) { return l.k === Z.drag.k; })[0]; msg.textContent = dl ? T('odDragAt', { l: dl.t, p: px(dl.p), d: f((dl.p / Z.last - 1) * 100, 2) }) : ''; }
      else msg.textContent = Z.pick ? T('odPick_' + Z.pick) : T(Z.sel || !Z.touch ? 'odDragHint' : 'odSelHint');
    }
    $$('[data-pk]', b).forEach(function (x) { x.classList.toggle('on', Z.pick === x.getAttribute('data-pk')); x.setAttribute('aria-pressed', String(Z.pick === x.getAttribute('data-pk'))); });
    $('[data-pk="x"]', b).disabled = Z.st.exits.length >= 8; $('[data-pk="e"]', b).disabled = Z.st.entries.length >= 10;
    $('[data-a="undo"]', b).disabled = !Z.hist.length;
    var eb = $('[data-a="ext"]', b); if (eb) { var on = !!Z.st.zExt; eb.classList.toggle('on', on); eb.setAttribute('aria-pressed', String(on)); eb.title = T(on ? 'odExtOff' : 'odExt'); eb.setAttribute('aria-label', eb.title); }
  }
  /* the box to the right edge of the chart, or back to its own right edge */
  function toggleExt(Z) { remember(Z); Z.st.zExt = !Z.st.zExt; saveSt(Z.st); hud(Z); repaint(Z); A.toast(T(Z.st.zExt ? 'odExtOn' : 'odExtClosed')); }
  function saveSt(st) { try { S.set(KEY, st); } catch (e) { } }
  /* undo: the plan as it was before each drag or tap on the chart */
  function remember(Z, snap) { Z.hist.push(snap || JSON.stringify(Z.st)); if (Z.hist.length > 40) Z.hist.shift(); }
  function restore(Z, snap) { var o = JSON.parse(snap); Object.keys(o).forEach(function (k) { Z.st[k] = o[k]; }); recalc(Z); saveSt(Z.st); syncLines(Z); }
  function undo(Z) { if (!Z.hist.length) return; restore(Z, Z.hist.pop()); A.toast(T('odUndone')); }
  /* a price from the chart, rounded the way the planner rounds what it writes */
  function priceAt(Z, y) { var p = null; try { p = Z.cell.main.coordinateToPrice(y); } catch (e) { } return p > 0 ? +rnd(p) : null; }
  /* equal shares that add up to exactly 100 */
  function equal(n) { var a = [], b = Math.floor(10000 / n) / 100, s = 0; for (var i = 0; i < n; i++) { var v = i === n - 1 ? +(100 - s).toFixed(2) : b; s += v; a.push(String(v)); } return a; }
  function setLevel(Z, kind, i, p) {
    var st = Z.st, v = plain(p);
    if (kind === 'e') st.entries[i].p = v;
    else if (kind === 's') { st.stop.mode = 'price'; st.stop.v = v; }
    else if (kind === 'x') { st.exits[i].mode = 'price'; st.exits[i].v = v; }
  }
  /* a tap on the chart while picking: a new entry, a new target, or the stop, at that price */
  function pickAt(Z, p) {
    var st = Z.st, k = Z.pick; remember(Z);
    if (k === 'e') { st.entries.push({ p: plain(p), q: '' }); var eq = equal(st.entries.length); st.entries.forEach(function (e, i) { e.q = eq[i]; }); }
    else if (k === 's') { st.stop.mode = 'price'; st.stop.v = plain(p); }
    else if (k === 'x') {
      /* each target's price as the plan worked it out (a target in R or % has no price of its own), so the new one can go in its place */
      var eff = new Map(), xi = usedX(st); if (Z.plan && !Z.plan.err) xi.forEach(function (ix, j) { if (Z.plan.exits[j]) eff.set(st.exits[ix], Z.plan.exits[j].p); });
      var used = 0; st.exits.forEach(function (x) { var q = num(x.q); if (q > 0) used += q; });
      st.exits.push({ mode: 'price', v: plain(p), q: used < 100 ? String(+(100 - used).toFixed(2)) : '' });
      if (used >= 100) { var ex = equal(st.exits.length); st.exits.forEach(function (x, i) { x.q = ex[i]; }); }
      /* targets stay in order from the entry outwards, as the plan needs */
      var dir = st.side === 'short' ? -1 : 1;
      var nw = st.exits[st.exits.length - 1]; eff.set(nw, num(nw.v));
      var pv = function (x) { return eff.has(x) ? eff.get(x) : x.mode === 'price' ? num(x.v) : NaN; };
      var empty = st.exits.filter(function (x) { return !isFinite(pv(x)); }), full = st.exits.filter(function (x) { return isFinite(pv(x)); });
      full.sort(function (a, b) { return dir * (pv(a) - pv(b)); }); st.exits = full.concat(empty);
    }
    Z.pick = null; if (Z.cell.el) Z.cell.el.classList.remove('pm-odpick');
    recalc(Z); saveSt(st); syncLines(Z);
  }
  function showLines(cell, r, st, atr) {
    hideLines(); if (!cell || !cell.main || !r || r.err) return 0;
    st = st || S.get(KEY, null); if (!st || !st.entries) return 0;
    var B = cell.bars || [], Z = { cell: cell, sym: cell.cfg.sym, st: st, atr: atr, plan: r, map: {}, L: [], last: B.length ? B[B.length - 1].c : r.avg, drag: null, pick: null, hist: [], sel: false, touch: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) };
    /* the panel: the plan's figures, and three buttons that put a level where you tap next */
    var hb = h('<div class="pm-odhud" role="group"><div class="pm-odhs pm-num" dir="ltr"></div><div class="pm-odhm"></div><div class="pm-odhb">' +
      '<button type="button" class="pm-btn sm" data-pk="e"></button><button type="button" class="pm-btn sm" data-pk="s"></button><button type="button" class="pm-btn sm" data-pk="x"></button>' +
      '<button type="button" class="pm-ib" data-a="ext"></button><button type="button" class="pm-ib" data-a="undo"></button><button type="button" class="pm-btn sm pri" data-a="open"></button><button type="button" class="pm-ib pm-odrm" data-a="hide"></button></div></div>');
    hb.dir = A.RTL() ? 'rtl' : 'ltr'; hb.setAttribute('aria-label', T('odTitle'));
    $('[data-pk="e"]', hb).textContent = '+ ' + T('odHudE'); $('[data-pk="s"]', hb).textContent = T('odHudS'); $('[data-pk="x"]', hb).textContent = '+ ' + T('odHudX');
    $('[data-a="open"]', hb).textContent = T('odHudOpen'); var xb = $('[data-a="hide"]', hb); xb.innerHTML = A.ic('trash'); xb.setAttribute('aria-label', T('odRemove')); xb.title = T('odRemove');
    var eb = $('[data-a="ext"]', hb); eb.innerHTML = A.ic('extr') || '⇥'; eb.onclick = function (e) { e.stopPropagation(); toggleExt(Z); };
    $$('[data-pk]', hb).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var k = b.getAttribute('data-pk'); Z.pick = Z.pick === k ? null : k; cell.el.classList.toggle('pm-odpick', !!Z.pick); hud(Z); }; });
    var ub = $('[data-a="undo"]', hb); ub.innerHTML = A.ic('undo') || '↶'; ub.setAttribute('aria-label', T('odHudUndo')); ub.title = T('odHudUndo');
    ub.onclick = function (e) { e.stopPropagation(); undo(Z); };
    $('[data-a="open"]', hb).onclick = function (e) { e.stopPropagation(); if (P.odmDialog) P.odmDialog(); };
    xb.onclick = function (e) { e.stopPropagation(); clearOdm(cell, true); };
    ['pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach(function (n) { hb.addEventListener(n, function (e) { e.stopPropagation(); }, { passive: true }); });
    cell.el.appendChild(hb); Z.hud = hb;
    /* the pointer on the chart: grab the line under it (a finger gets a wider band), or drop a picked level */
    var box = cell.box;
    function loc(e) { var t = e.touches && e.touches[0] || e.changedTouches && e.changedTouches[0] || e, rc = box.getBoundingClientRect(); return { x: t.clientX - rc.left, y: t.clientY - rc.top, w: rc.width, h: rc.height }; }
    function near(q, touch) {
      var best = null, bd = touch ? 12 : 5;
      Z.L.forEach(function (l) { if (!l.drag) return; var y = null; try { y = cell.main.priceToCoordinate(l.p); } catch (e) { } if (y == null) return; var d = Math.abs(y - q.y); if (d <= bd) { bd = d; best = l; } });
      return best;
    }
    function eat(e) { e.stopPropagation(); if (e.cancelable) e.preventDefault(); }
    function onHandle(q, touch) {
      var b = Z.box, d = touch ? 18 : 9; if (!b || Math.abs(q.y - b.ya) > d) return null;
      if (b.end && Math.abs(q.x - b.x1) <= d) return 'end';
      return Math.abs(q.x - b.x0) <= d ? 'anc' : null;
    }
    /* a tap inside the box or on one of its lines selects the position; anywhere else lets it go. Nothing is ever removed by a tap */
    function inside(q, touch) { var b = Z.box, m = 4; return !!(b && q.x >= b.x0 - m && q.x <= b.x1 + m && q.y >= b.top - m && q.y <= b.bot + m) || !!onHandle(q, touch) || !!near(q, touch); }
    function select(on) { on = !!on; if (Z.sel === on) return; Z.sel = on; cell.el.classList.toggle('pm-odsel', on); if (on && cell.drawer) try { cell.drawer.select(null); } catch (e) { } hud(Z); repaint(Z); }
    var downEv = function (e) {
      if (!LN || LN !== Z) return;
      /* the panel's own buttons stay buttons; anywhere else on it, a line just under it can still be grabbed */
      if (e.target.closest && (e.target.closest('.pm-odhud button') || e.target.closest('.pm-leg,.pm-selbar,.pm-menu,.pm-macro'))) return;
      if (e.target.closest && e.target.closest('.pm-odhud') && Z.pick) return;
      if (e.button != null && e.button !== 0) return;
      var q = loc(e); if (q.x < 0 || q.y < 0 || q.x > q.w || q.y > q.h) return;
      if (Z.pick) { var p = priceAt(Z, q.y); if (p) { eat(e); pickAt(Z, p); } return; }
      var touch = !!(e.pointerType && e.pointerType !== 'mouse'); if (touch !== !!Z.touch) { Z.touch = touch; hud(Z); }
      /* with a finger the position is tapped first, so a swipe anywhere moves the chart; with a mouse a line or a circle is grabbed
         straight away, and everywhere else the chart pans and zooms as usual */
      var can = !touch || Z.sel, hd = can ? onHandle(q, touch) : null;
      if (hd) { eat(e); lock(Z); select(true); Z.drag = { k: hd, kind: hd, x0: q.x, moved: false, touch: touch, id: e.pointerId, snap: JSON.stringify(Z.st) }; cell.el.classList.add('pm-oddrag'); repaint(Z); return; }
      var l = can ? near(q, touch) : null;
      if (!l) { if (!(e.target.closest && e.target.closest('.pm-odhud'))) Z.tap = { x: q.x, y: q.y, id: e.pointerId, t: Date.now(), touch: touch }; return; }
      eat(e); lock(Z); select(true); Z.drag = { k: l.k, kind: l.drag, i: l.i, y0: q.y, moved: false, touch: touch, id: e.pointerId, snap: JSON.stringify(Z.st) };
      cell.el.classList.add('pm-oddrag'); syncLines(Z);
    };
    var moveEv = function (e) {
      if (!LN || LN !== Z) return;
      var q = loc(e);
      if (!Z.drag) {
        if (e.buttons || e.pointerType !== 'mouse') return;
        var l = q.x >= 0 && q.y >= 0 && q.x <= q.w && q.y <= q.h ? near(q, false) : null;
        box.style.cursor = Z.pick ? 'crosshair' : onHandle(q, false) ? 'ew-resize' : l ? 'ns-resize' : ''; return;
      }
      var slop = Z.drag.touch ? 6 : 3;
      if (Z.drag.kind === 'anc' || Z.drag.kind === 'end') {
        eat(e); if (!Z.drag.moved && Math.abs(q.x - Z.drag.x0) <= slop) return; Z.drag.moved = true;
        var D = cell.disp && cell.disp.length ? cell.disp : cell.bars, sec = cell.tfSec ? cell.tfSec() : 0, lg = null; try { lg = cell.chart.timeScale().coordinateToLogical(Math.max(0, q.x)); } catch (e3) { }
        if (lg != null && D.length && P.l2t && P.t2l && sec) {
          lg = Math.round(lg);
          var lA = Math.round(P.t2l(D, +Z.st.anchor, sec)), lE = +Z.st.zEnd > 0 ? Math.round(P.t2l(D, +Z.st.zEnd, sec)) : null;
          /* the round handle on the entry line moves the whole box to another candle, keeping its width; the right one resizes it */
          if (Z.drag.kind === 'anc') { lg = Math.max(0, Math.min(D.length - 1, lg)); Z.st.anchor = D[lg].t; if (lE != null) Z.st.zEnd = P.l2t(D, lE + (lg - lA), sec); }
          else { lg = Math.max(lA + 1, lg); Z.st.zEnd = P.l2t(D, lg, sec); }
        }
        repaint(Z); return;
      }
      eat(e); if (!Z.drag.moved && Math.abs(q.y - Z.drag.y0) <= slop) return;   /* a click on a line leaves it where it is */
      var p = priceAt(Z, q.y); if (!p) return;
      Z.drag.moved = true;
      setLevel(Z, Z.drag.kind, Z.drag.i, p); recalc(Z);
      /* the dragged line follows the pointer even while the plan refuses the level (the panel says why) */
      if (Z.plan.err) { var m = Z.map[Z.drag.k]; if (m) try { m.applyOptions({ price: p }); } catch (e2) { } Z.L.forEach(function (x) { if (x.k === Z.drag.k) x.p = p; }); hud(Z); }
      else syncLines(Z);
    };
    var upEv = function (e) {
      if (!LN || LN !== Z) return;
      if (!Z.drag) {
        var tp = Z.tap; Z.tap = null;
        if (tp && e.type === 'pointerup' && (tp.id == null || e.pointerId == null || tp.id === e.pointerId)) {
          var q = loc(e); if (Math.abs(q.x - tp.x) <= 6 && Math.abs(q.y - tp.y) <= 6 && Date.now() - tp.t < 700) select(inside(q, tp.touch));
        }
        if (Z.locked) unlock(Z);
        return;
      }
      eat(e); var moved = Z.drag.moved, snap = Z.drag.snap; Z.drag = null; unlock(Z); cell.el.classList.remove('pm-oddrag'); box.style.cursor = '';
      if (moved && Z.plan && Z.plan.err) {
        /* a level the plan can't take: it goes back where it was, and the reason is said once */
        var why = T('odE_' + Z.plan.err, { n: Z.plan.at || '' }); restore(Z, snap); A.toast(T('odRevert') + ' ' + why); return;
      }
      if (moved) { remember(Z, snap); saveSt(Z.st); }
      syncLines(Z);
    };
    var blurEv = function () { if (!LN || LN !== Z) return; Z.tap = null; if (Z.drag) { var sn = Z.drag.snap; Z.drag = null; cell.el.classList.remove('pm-oddrag'); box.style.cursor = ''; restore(Z, sn); } unlock(Z); };
    var keyEv = function (e) {
      if (!LN || LN !== Z) return;
      var tg = e.target, typing = tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName || ''));
      /* Delete with the position selected removes it, with Undo, like a drawing; nothing else removes it but its own buttons */
      if ((e.key === 'Delete' || e.key === 'Backspace') && Z.sel && !Z.drag && !typing) { e.stopPropagation(); e.preventDefault(); clearOdm(cell, true); return; }
      if (e.key !== 'Escape') return;
      /* Escape while a line is held puts it back where it was; Escape while picking stops picking; otherwise it lets the position go */
      if (Z.drag) { var sn = Z.drag.snap; Z.drag = null; unlock(Z); cell.el.classList.remove('pm-oddrag'); box.style.cursor = ''; restore(Z, sn); e.stopPropagation(); e.preventDefault(); }
      else if (Z.pick) { Z.pick = null; cell.el.classList.remove('pm-odpick'); hud(Z); e.stopPropagation(); }
      else if (Z.sel) { select(false); e.stopPropagation(); }
    };
    box.addEventListener('pointerdown', downEv, true); hb.addEventListener('pointerdown', downEv, true); window.addEventListener('pointermove', moveEv, true);
    window.addEventListener('pointerup', upEv, true); window.addEventListener('pointercancel', upEv, true); document.addEventListener('keydown', keyEv, true); window.addEventListener('blur', blurEv);
    /* lightweight-charts also listens to mouse and touch events: while a line is held they must not pan the chart */
    var swallow = function (e) { if (Z.drag) eat(e); };
    ['mousedown', 'mousemove', 'touchstart', 'touchmove'].forEach(function (n) { box.addEventListener(n, swallow, { capture: true, passive: false }); });
    Z.off = function () {
      box.removeEventListener('pointerdown', downEv, true); hb.removeEventListener('pointerdown', downEv, true); window.removeEventListener('pointermove', moveEv, true);
      window.removeEventListener('pointerup', upEv, true); window.removeEventListener('pointercancel', upEv, true); document.removeEventListener('keydown', keyEv, true); window.removeEventListener('blur', blurEv);
      cell.el.classList.remove('pm-odsel');
      ['mousedown', 'mousemove', 'touchstart', 'touchmove'].forEach(function (n) { box.removeEventListener(n, swallow, { capture: true, passive: false }); });
      box.style.cursor = ''; cell.el.classList.remove('pm-oddrag');
    };
    Z.select = select; LN = Z; syncLines(Z); return Z.L.length;
  }
  A.on('sym', function (cell) { if (LN && LN.cell === cell) hideLines(); });
  /* another timeframe, or new history: the chart stays free to pan and zoom, a line half-dragged goes back, and the lines and the
     box are drawn again on the candles now shown (the box keeps its times, so it sits on the same moment in any timeframe) */
  function refresh(cell, tf) {
    var Z = LN; if (!Z || Z.cell !== cell) return; Z.tap = null;
    if (tf && Z.drag) { var sn = Z.drag.snap; Z.drag = null; cell.el.classList.remove('pm-oddrag'); restore(Z, sn); }
    if (!Z.drag) unlock(Z);
    syncLines(Z);
  }
  A.on('tf', function (cell) { refresh(cell, true); });
  A.on('data', function (cell) { refresh(cell, false); });
  ['grid', 'lang'].forEach(function (n) { A.on(n, function () {
    if (LN && !LN.cell.el.isConnected) { LN.off(); LN = null; return; }
    /* a new language: the panel is built again in it, with the same plan and its undo steps */
    if (n === 'lang' && LN && !LN.plan.err) { var Z = LN, hs = Z.hist; showLines(Z.cell, Z.plan, Z.st, Z.atr); if (LN) { LN.hist = hs; hud(LN); } }
  }); });
  P.odmExt = function (cell) { return LN && (!cell || LN.cell === cell) ? !!LN.st.zExt : null; };
  P.odmToggleExt = function () { if (LN) toggleExt(LN); };
  P.odmSelect = function (on) { if (LN && LN.select) LN.select(on); return LN ? !!LN.sel : null; };
  P.odmHide = hideLines; P.odmLinesShown = function (cell) { return LN && (!cell || LN.cell === cell) ? LN.L.length : 0; };
  /* take the plan's lines off the chart, and with alerts true also the alerts ODM added for this coin; one Undo puts both back */
  function clearOdm(cell, alerts) {
    var Z = LN && (!cell || LN.cell === cell) ? LN : null, sym = Z ? Z.sym : cell ? cell.cfg.sym : null, n = Z ? Z.L.length : 0, gone = [];
    if (!Z && LN && cell && LN.sym === cell.cfg.sym) { Z = LN; n = Z.L.length; }
    if (Z) hideLines();
    if (alerts && sym && P.delAlerts) gone = P.delAlerts(function (a) { return P.isOdmAlert(a, sym); });
    if (!n && !gone.length) return 0;
    var msg = n && gone.length ? T('odClearedBoth', { n: n, m: gone.length }) : n ? T('odHidden') : T('odClearedAl', { m: gone.length });
    A.toast(msg, '', { label: T('undo'), act: function () {
      if (Z && Z.cell.el.isConnected && Z.cell.cfg.sym === Z.sym) showLines(Z.cell, Z.plan, Z.st, Z.atr);
      if (gone.length && P.putAlerts) P.putAlerts(gone);
    } });
    return n + gone.length;
  }
  P.odmClear = clearOdm;
  /* for the page's Reset: the plan's lines as they are now, and a way to show them again */
  P.odmSnap = function () { var Z = LN; return Z ? function () { if (Z.cell.el.isConnected && Z.cell.cfg.sym === Z.sym) showLines(Z.cell, Z.plan, Z.st, Z.atr); } : null; };
  /* the level of the plan under a point of the chart, for the right-click menu */
  P.odmHit = function (cell, y) {
    if (!LN || LN.cell !== cell) return null; var best = null, bd = 6;
    LN.L.forEach(function (l) { var yy = null; try { yy = cell.main.priceToCoordinate(l.p); } catch (e) { } if (yy == null) return; var d = Math.abs(yy - y); if (d <= bd) { bd = d; best = l; } });
    return best ? { k: best.k, t: best.t, p: best.p } : null;
  };
  /* a point inside the position's box, for the right-click menu (after lines and alert lines) */
  P.odmZoneHit = function (cell, x, y) { var b = LN && LN.cell === cell ? LN.box : null; if (!b || x < b.x0 || x > b.x1 || y < b.top || y > b.bot) return null; return { t: T(b.long ? 'odZLong' : 'odZShort'), p: LN.plan.avg }; };
  P._odmZoneVis = function (v) { if (LN) { LN.noZone = !v; repaint(LN); } };   /* for the browser checks: the chart with and without the box */
  P.odmZone = function () { return LN && LN.box ? { x0: LN.box.x0, x1: LN.box.x1, top: LN.box.top, bot: LN.box.bot, ya: LN.box.ya, H: LN.box.H, anchor: LN.st.anchor, zEnd: LN.st.zEnd, ext: !!LN.st.zExt, end: LN.box.end, sel: !!LN.sel, locked: !!LN.locked, tags: LN.lay ? [].map.call(LN.lay.querySelectorAll('.pm-odzp,.pm-odzm'), function (e) { return e.textContent; }) : [] } : null; };
  /* for the browser checks: the panel's plan and the y of a level on the chart */
  P.odmLive = function () { return LN ? { plan: LN.plan, st: LN.st, levels: LN.L.map(function (l) { var y = null; try { y = LN.cell.main.priceToCoordinate(l.p); } catch (e) { } return { k: l.k, p: l.p, y: y, drag: !!l.drag }; }), pick: LN.pick } : null; };

  P.odmDialog = function () {
    var cell = A.active(); if (!cell) return;
    var sym = cell.cfg.sym, B = closed(cell), last = cell.bars.length ? cell.bars[cell.bars.length - 1].c : NaN;
    var st = S.get(KEY, null); if (!st || typeof st !== 'object' || st.v !== 1 || st.sym !== sym) { var keep = st && st.v === 1 ? st : null; st = fresh(last); if (keep) ['side', 'contract', 'balance', 'riskPct', 'leverage', 'feePct', 'slip', 'marginMode', 'mmrPct'].forEach(function (k) { if (typeof keep[k] === 'string') st[k] = keep[k]; }); }
    st.v = 1; st.sym = sym;
    function save() { try { S.set(KEY, st); } catch (e) { } }
    var atr = null, plan = null;
    function calcAtr() { var n = Math.round(num(st.stop.len)); if (!(n >= 2 && n <= 200)) n = 14; atr = O.atr(B, n); return n; }

    var box = h('<div class="pm-odm">' +
      '<details class="pm-odwhy"><summary></summary><div></div></details>' +
      '<div class="pm-odtop pm-num" dir="ltr" aria-live="polite"></div>' +
      '<div class="pm-odcols"><div class="pm-odin"></div><div class="pm-odout" aria-live="polite"></div></div>' +
      '<div class="pm-row pm-odact"></div><div class="pm-odx"></div><p class="pm-enote"></p></div>');
    $('.pm-odwhy summary', box).textContent = T('odWhyT');
    ['odWhy1', 'odWhy2', 'odWhy3', 'odWhy4', 'odWhy5'].forEach(function (k) { var pp = document.createElement('p'); pp.textContent = T(k); $('.pm-odwhy div', box).appendChild(pp); });
    $('.pm-enote', box).textContent = T('odNote');
    var IN = $('.pm-odin', box), OUT = $('.pm-odout', box), X = $('.pm-odx', box), ACT = $('.pm-odact', box), TOP = $('.pm-odtop', box);

    /* the help icon of a label key (odhelp.js), when that file has loaded */
    function tag(el, k) { return P.odh && P.odh.tag ? P.odh.tag(el, k) : null; }
    /* ---- small builders: every field writes its text into st and recalculates; rows re-render only when added or removed */
    function sec(title, hint) { var s2 = h('<section class="pm-odsec" data-ods="' + title + '"><h4></h4></section>'); $('h4', s2).textContent = T(title); tag($('h4', s2), title); if (hint) { var p2 = h('<p class="pm-odhint"></p>'); p2.textContent = T(hint); s2.appendChild(p2); } IN.appendChild(s2); return s2; }
    function inp(obj, k, lbl, cls) {
      var w = h('<label class="pm-cf' + (cls ? ' ' + cls : '') + '"><span></span><input class="pm-in" inputmode="decimal" dir="ltr" autocomplete="off" maxlength="24"></label>'), i = $('input', w);
      $('span', w).textContent = lbl ? T(lbl) : ''; if (!lbl) $('span', w).remove(); else tag($('span', w), lbl); i.value = obj[k] == null ? '' : obj[k];
      if (lbl) i.setAttribute('aria-label', T(lbl));
      i.oninput = function () { obj[k] = i.value.slice(0, 24); save(); run(); }; return w;
    }
    function sel(obj, k, lbl, opts, pre, after) {
      var w = h('<label class="pm-cf"><span></span><select class="pm-in"></select></label>'), sl = $('select', w); $('span', w).textContent = lbl ? T(lbl) : ''; if (!lbl) $('span', w).remove(); else tag($('span', w), lbl);
      opts.forEach(function (x) { var op = document.createElement('option'); op.value = x; op.textContent = T((pre || 'odO_') + x); sl.appendChild(op); });
      sl.value = opts.indexOf(obj[k]) >= 0 ? obj[k] : opts[0]; obj[k] = sl.value; if (lbl) sl.setAttribute('aria-label', T(lbl));
      sl.onchange = function () { obj[k] = sl.value; save(); if (after) after(); run(); }; return w;
    }
    function grid(parent, items) { var g = h('<div class="pm-cg"></div>'); items.forEach(function (x) { g.appendChild(x); }); parent.appendChild(g); return g; }

    /* 1. the account */
    var s1 = sec('odAcc');
    grid(s1, [sel(st, 'side', 'rcSide', ['long', 'short']), sel(st, 'contract', 'rcCt', ['linear', 'spot'], 'rcO_'), inp(st, 'balance', 'rcBal'), inp(st, 'riskPct', 'rcRisk'), inp(st, 'leverage', 'rcLev'), inp(st, 'feePct', 'rcFee'),
      inp(st, 'slip', 'rcSlip'), sel(st, 'marginMode', 'rcMode', ['isolated', 'cross'], 'rcO_'), inp(st, 'mmrPct', 'rcMmr')]);

    /* 2. the entries: a ladder builder and the rows themselves */
    var s2 = sec('odEnt', 'odEntHint'), gen = grid(s2, [inp(st.gen, 'first', 'odGFirst'), inp(st.gen, 'n', 'odGN'), inp(st.gen, 'step', 'odGStep'), sel(st.gen, 'split', 'odGSplit', ['equal', 'grow'])]);
    var gb = h('<button type="button" class="pm-btn sm"></button>'); gb.textContent = T('odGBuild'); gen.appendChild(gb);
    var ER = h('<div class="pm-odrows"></div>'), es = h('<div class="pm-odsum pm-num"></div>'), ea = h('<button type="button" class="pm-btn sm"></button>'); ea.textContent = '+ ' + T('odAddE');
    s2.appendChild(ER); s2.appendChild(ea); s2.appendChild(es);
    gb.onclick = function () {
      var L = O.ladder(num(st.gen.first), num(st.gen.n), num(st.gen.step), st.side !== 'short', st.gen.split);
      if (!L) { A.toast(T('odE_gen')); return; }
      st.entries = L.map(function (x) { return { p: rnd(x.p), q: String(x.q) }; }); save(); rowsE(); run();
    };
    function rowsE() {
      ER.innerHTML = '';
      st.entries.forEach(function (e, i) {
        var r = h('<div class="pm-odrow"><span class="pm-odn"></span></div>'); $('.pm-odn', r).textContent = 'E' + (i + 1);
        r.appendChild(inp(e, 'p', null)); $$('input', r)[0].placeholder = T('odPrice'); $$('input', r)[0].setAttribute('aria-label', T('odPrice') + ' E' + (i + 1));
        r.appendChild(inp(e, 'q', null)); $$('input', r)[1].placeholder = '%'; $$('input', r)[1].setAttribute('aria-label', T('odShare') + ' E' + (i + 1));
        var x = h('<button type="button" class="pm-ib" aria-label="' + esc(T('remove')) + '">' + A.ic('x') + '</button>'); x.disabled = st.entries.length < 2;
        x.onclick = function () { st.entries.splice(i, 1); save(); rowsE(); run(); }; r.appendChild(x); ER.appendChild(r);
      });
      ea.disabled = st.entries.length >= 10;
    }
    ea.onclick = function () { st.entries.push({ p: '', q: '' }); save(); rowsE(); run(); };

    /* 3. the stop */
    var s3 = sec('odStop', 'odStopHint'), atrNote = h('<p class="pm-odhint pm-num" dir="auto"></p>');
    grid(s3, [sel(st.stop, 'mode', 'odSMode', ['atr', 'pct', 'price']), inp(st.stop, 'v', 'odSVal'), inp(st.stop, 'len', 'odAtrLen')]); s3.appendChild(atrNote);

    /* 4. the exits */
    var s4 = sec('odExit', 'odExitHint'), XR = h('<div class="pm-odrows"></div>'), xs = h('<div class="pm-odsum pm-num"></div>'), xb = h('<div class="pm-row"></div>');
    var xa = h('<button type="button" class="pm-btn sm"></button>'); xa.textContent = '+ ' + T('odAddX'); xb.appendChild(xa);
    [['odP_r', [['r', '1', '30'], ['r', '2', '30'], ['r', '3', '20']]], ['odP_pct', [['pct', '5', '25'], ['pct', '10', '25'], ['pct', '20', '25']]], ['odP_one', [['r', '2', '100']]]].forEach(function (pr) {
      var b = h('<button type="button" class="pm-btn sm"></button>'); b.textContent = T(pr[0]);
      b.onclick = function () { st.exits = pr[1].map(function (x) { return { mode: x[0], v: x[1], q: x[2] }; }); save(); rowsX(); run(); }; xb.appendChild(b);
    });
    s4.appendChild(XR); s4.appendChild(xb); s4.appendChild(xs);
    function rowsX() {
      XR.innerHTML = '';
      st.exits.forEach(function (x, i) {
        var r = h('<div class="pm-odrow pm-odrx"><span class="pm-odn"></span></div>'); $('.pm-odn', r).textContent = 'TP' + (i + 1);
        r.appendChild(sel(x, 'mode', null, ['price', 'pct', 'r'], 'odX_')); $('select', r).setAttribute('aria-label', T('odXMode') + ' TP' + (i + 1));
        r.appendChild(inp(x, 'v', null)); $$('input', r)[0].placeholder = T('odXVal'); $$('input', r)[0].setAttribute('aria-label', T('odXVal') + ' TP' + (i + 1));
        r.appendChild(inp(x, 'q', null)); $$('input', r)[1].placeholder = '%'; $$('input', r)[1].setAttribute('aria-label', T('odShare') + ' TP' + (i + 1));
        var b = h('<button type="button" class="pm-ib" aria-label="' + esc(T('remove')) + '">' + A.ic('x') + '</button>'); b.onclick = function () { st.exits.splice(i, 1); save(); rowsX(); beOpts(); run(); }; r.appendChild(b);
        XR.appendChild(r);
      });
      xa.disabled = st.exits.length >= 8;
    }
    xa.onclick = function () { st.exits.push({ mode: 'r', v: '', q: '' }); save(); rowsX(); beOpts(); run(); };

    /* 5. what is left: the trailing stop, and break-even */
    var s5 = sec('odTrail', 'odTrailHint'), tg = h('<label class="pm-odtg"><input type="checkbox"> <span></span></label>');
    $('span', tg).textContent = T('odTOn'); $('input', tg).checked = !!st.trail.on; $('input', tg).onchange = function () { st.trail.on = $('input', tg).checked; save(); run(); }; s5.appendChild(tg);
    var beW = h('<label class="pm-cf"><span></span><select class="pm-in"></select></label>'), beS = $('select', beW); $('span', beW).textContent = T('odBE'); tag($('span', beW), 'odBE');
    function beOpts() { beS.innerHTML = ''; var o0 = new Option(T('odBENo'), '0'); beS.appendChild(o0); st.exits.forEach(function (x, i) { beS.appendChild(new Option(T('odBEAfter', { n: i + 1 }), String(i + 1))); }); beS.value = +st.beAfter <= st.exits.length ? String(+st.beAfter || 0) : '0'; st.beAfter = beS.value; }
    beS.onchange = function () { st.beAfter = beS.value; save(); run(); };
    grid(s5, [sel(st.trail, 'mode', 'odTMode', ['atr', 'pct']), inp(st.trail, 'v', 'odTVal'), sel(st.trail, 'act', 'odTAct', ['none', 'price', 'pct', 'r'], 'odA_'), inp(st.trail, 'av', 'odTActV'), beW]);

    /* 6. funding and the result at any price */
    var s6 = h('<details class="pm-odsec pm-odmore"><summary></summary></details>'); $('summary', s6).textContent = T('odMore'); tag($('summary', s6), 'odMore'); IN.appendChild(s6);
    grid(s6, [inp(st, 'fundingPct', 'plFundRate'), inp(st, 'fundHrs', 'plFundIv'), inp(st, 'hours', 'plHours'), inp(st, 'at', 'odAt')]);

    /* ---- the results */
    function card(o, a, v, cls, tip, key) { var x = h('<div class="pm-cor' + (cls ? ' ' + cls : '') + '"><small></small><b class="pm-num" dir="ltr"></b></div>'); $('small', x).textContent = a; if (key) tag($('small', x), key); $('b', x).textContent = v; if (tip) x.title = tip; o.appendChild(x); }
    function table(head, rows) {
      var w = h('<div class="pm-tw"><table class="pm-tbl pm-odt"><thead><tr></tr></thead><tbody></tbody></table></div>');
      head.forEach(function (k) { var th = document.createElement('th'); if (Array.isArray(k)) { th.textContent = k[0]; if (k[1]) th.title = k[1]; if (k[2]) tag(th, k[2]); } else th.textContent = k; $('tr', w).appendChild(th); });
      rows.forEach(function (r) { var tr = document.createElement('tr'); r.forEach(function (c, j) { var td = document.createElement('td'); if (c && c.nodeType) td.appendChild(c); else if (c && typeof c === 'object') { td.textContent = c.t; if (c.c) td.className = c.c; } else td.textContent = c; if (j) { td.className = (td.className ? td.className + ' ' : '') + 'pm-num'; td.dir = 'ltr'; } tr.appendChild(td); }); $('tbody', w).appendChild(tr); });
      return w;
    }
    function warn(o, txt) { var wn = h('<div class="pm-cw2"></div>'); wn.textContent = txt; o.appendChild(wn); }
    function h4(o, k) { var x = document.createElement('h4'); x.className = 'pm-odh'; x.textContent = T(k); tag(x, k); o.appendChild(x); }
    function run() {
      var n = calcAtr();
      atrNote.textContent = atr > 0 ? T('odAtrIs', { n: n, tf: A.tfLabel ? A.tfLabel(cell.cfg.tf) : cell.cfg.tf, v: px(atr), b: B.length }) : T('odAtrNone', { n: n });
      var se = 0; st.entries.forEach(function (e) { var q = num(e.q); if (isFinite(q)) se += q; }); es.textContent = T('odSumE', { p: f(se, 2) }); es.classList.toggle('dn', Math.abs(se - 100) > 0.01);
      var sx = 0; st.exits.forEach(function (e) { var q = num(e.q); if (isFinite(q)) sx += q; }); xs.textContent = T('odSumX', { p: f(sx, 2), r: f(Math.max(0, 100 - sx), 2) }); xs.classList.toggle('dn', sx > 100.01);
      plan = O.plan(inputs(st, atr)); OUT.innerHTML = ''; X.innerHTML = '';
      $$('button[data-need]', ACT).forEach(function (b) { b.disabled = !!plan.err; });
      if (plan.err && P.odh) P.odh.ctx = null;
      if (plan.err) { warn(OUT, T('odE_' + plan.err, { n: plan.at || '' })); TOP.textContent = T('odE_' + plan.err, { n: plan.at || '' }); TOP.className = 'pm-odtop dn'; TOP.dir = 'auto'; return; }
      /* one line that stays in view on a phone, where the results sit below the form */
      TOP.className = 'pm-odtop'; TOP.dir = A.RTL() ? 'rtl' : 'ltr'; TOP.innerHTML = '';
      /* each figure is isolated in its own left-to-right run, so a right-to-left label never reorders it */
      function tpart(lbl, val, cls) { var sp = document.createElement('span'); if (cls) sp.className = cls; sp.appendChild(document.createTextNode(lbl + ' ')); var b = document.createElement('bdi'); b.dir = 'ltr'; b.className = 'pm-num'; b.textContent = val; sp.appendChild(b); TOP.appendChild(sp); }
      tpart(T('odTopRisk'), '−' + f(plan.risk), 'dn'); tpart(T('odTopAvg'), px(plan.avg)); tpart('SL', px(plan.stop));
      if (plan.best != null) tpart(T('odTopBest'), sg(plan.best) + ' (' + f(plan.best / plan.risk, 2) + 'R)', 'up');
      var r = plan, o = h('<div class="pm-co"></div>'); OUT.appendChild(o);
      if (P.odh) P.odh.ctx = { bal: f(num(st.balance)), rp: f(num(st.riskPct), 2), risk: f(r.risk), qty: f(r.qty, 6), avg: px(r.avg), sl: px(r.stop), R: px(Math.abs(r.avg - r.stop)), n: String(r.fills.length),
        atr: atr > 0 ? px(atr) : '', atrn: String(n), lev: f(num(st.leverage), 2), margin: f(r.margin), notional: f(r.notional), be: px(r.be) };
      card(o, T('rcSide'), T(r.long ? 'rcLong' : 'rcShort2'), '', '', 'rcSide');
      card(o, T('rcQty'), f(r.qty, 6), '', '', 'rcQty'); card(o, T('odAvg'), px(r.avg), '', '', 'odAvg'); card(o, T('odStopAt'), px(r.stop), 'dn', '', 'odStopAt');
      card(o, T('rcMaxLoss'), '−' + f(r.risk), 'dn', T('odTipRisk'), 'rcMaxLoss'); card(o, T('odBest'), r.best != null ? sg(r.best) + '  (' + f(r.best / r.risk, 2) + 'R)' : '—', r.best > 0 ? 'up' : '', '', 'odBest');
      card(o, T('rcNotional'), f(r.notional), '', '', 'rcNotional'); card(o, T('rcMargin'), f(r.margin), '', '', 'rcMargin'); card(o, T('rcBE'), px(r.be), '', '', 'rcBE');
      if (r.liq != null) card(o, T('rcLiqS'), px(r.liq), '', T('rcLiqNote'), 'rcLiqS'); else if (r.liqWhy) card(o, T('rcLiqS'), T('rcLiq_' + r.liqWhy), '', '', 'rcLiqS');
      if (r.funding != null) card(o, T('odFund'), sg(-r.funding), r.funding > 0 ? 'dn' : 'up', '', 'odFund');
      if (!r.marginOk) warn(o, T('rcW_margin')); else if (r.liqBeforeStop) warn(o, T('rcW_liq')); else if (r.liq != null) warn(o, T('rcLiqNote'));
      var inr = r.exits.filter(function (x) { return x.inRange; }).map(function (x) { return 'TP' + x.n; }); if (inr.length) warn(o, T('odW_inRange', { l: inr.join(', ') }));
      var at = num(st.at); if (at > 0) { var z = O.pnlAt(r, at, num(st.feePct)); if (z) card(o, T('odAtRes', { p: px(at) }), sg(z.pnl) + '  ' + sg(z.r, 2) + 'R  ' + sg(z.pct, 2) + '%', z.pnl > 0 ? 'up' : z.pnl < 0 ? 'dn' : ''); }
      h4(OUT, 'odHFills');
      OUT.appendChild(table([T('odStep'), T('odPrice'), [T('odAvgS'), T('odAvgAfter'), 'odAvgS'], [T('odLossS'), T('odLossIf'), 'odLossS']], r.fills.map(function (x) {
        var pc = h('<div class="pm-odpc2"><b></b><small></small></div>'); $('b', pc).textContent = px(x.p); $('small', pc).textContent = f(x.q, 2) + '% · ' + f(x.qty, 6);
        /* the loss if the stop is hit once this step has filled: the money, and how much of the plan's full risk that is */
        var sh = r.risk > 0 ? Math.max(0, Math.min(1, x.loss / r.risk)) : 0, lc = h('<div class="pm-odl"><b class="dn"></b><span class="pm-odlb" aria-hidden="true"><i></i></span><small></small></div>');
        $('b', lc).textContent = '−' + f(x.loss); $('i', lc).style.width = (sh * 100).toFixed(1) + '%'; $('small', lc).textContent = f(sh * 100, 0) + '%';
        $('.pm-odlb', lc).dir = A.RTL() ? 'rtl' : 'ltr'; lc.title = T('odLossOf', { p: f(sh * 100, 0), r: f(r.risk) });
        return ['E' + x.n, pc, px(x.avg), lc];
      })));
      var fn = h('<p class="pm-odhint pm-odfn"></p>'); fn.textContent = T('odFillNote'); OUT.appendChild(fn);
      if (r.exits.length) { h4(OUT, 'odHExits'); OUT.appendChild(table([T('odStep'), T('odPrice'), T('odShare'), T('odProfit'), 'R'], r.exits.map(function (x) { return ['TP' + x.n, px(x.p), f(x.q, 2) + '%', { t: sg(x.profit), c: x.profit > 0 ? 'up' : 'dn' }, f(x.r, 2)]; }))); }
      if (r.rest > 0) {
        var tl = r.trail ? T('odRestTrail', { p: f(r.rest, 2), d: r.trail.mode === 'atr' ? f(+st.trail.v, 2) + '×ATR = ' + px(r.trail.dist) : f(r.trail.v, 2) + '%', a: r.trail.act != null ? px(r.trail.act) : T('odFromStart') }) : T('odRestOpen', { p: f(r.rest, 2) });
        var pr = h('<p class="pm-odhint"></p>'); pr.textContent = tl; OUT.appendChild(pr);
      }
      h4(OUT, 'odHEnds');
      OUT.appendChild(table([T('odHow'), T('odPnl'), 'R'], r.rows.map(function (x) {
        var lb = x.k === 'stop' ? T('odEStop') : x.k === 'exit' ? T(x.be ? 'odEExitBE' : 'odEExit', { n: x.n }) : x.k === 'trail' ? T('odETrail') : x.k === 'trailStop' ? T('odETrailStop') : T('odEOpen', { p: f(x.open, 2) });
        return [lb, { t: sg(x.pnl), c: x.pnl > 0 ? 'up' : x.pnl < 0 ? 'dn' : '' }, sg(x.r, 2)];
      })));
      var fm = h('<code class="pm-cfm" dir="ltr"></code>'); fm.textContent = 'qty = risk ÷ Σ wᵢ × ( |entryᵢ − stop| + fee × (entryᵢ + stop) + slippage )   ·   avg = Σ wᵢ × entryᵢ   ·   R = |avg − stop|'; OUT.appendChild(fm);
    }

    /* ---- actions */
    function act(k, fn, need, pri) { var b = h('<button type="button" class="pm-btn' + (pri ? ' pri' : '') + '"></button>'); b.textContent = T(k); b.onclick = fn; if (need) b.setAttribute('data-need', ''); ACT.appendChild(b); return b; }
    act('odShow', function () { save(); var n = showLines(cell, plan, st, atr); A.closeModal(); A.toast(T('odShown', { n: n })); }, 1, 1);
    /* "Remove from chart" takes everything ODM put there: its lines and the alerts (with their 🔔 lines) made from the plan */
    var nal = P.odmAlertCount ? P.odmAlertCount(sym) : 0;
    var hb = act('odHide', function () { var Z = LN; clearOdm(Z ? Z.cell : cell, true); hb.hidden = true; }); hb.hidden = !LN && !nal;
    act('odTest', function () { test(); }, 1);
    act('odSave', function () {
      var r = plan; if (!r || r.err) return;
      var np = { id: P.uid(), at: Date.now(), sym: sym, tf: cell.cfg.tf, long: r.long, entry: r.avg, stop: r.stop, targets: r.exits.map(function (x) { return { p: x.p, share: x.q }; }),
        qty: r.qty, notional: r.notional, margin: r.margin, risk: r.risk, rr: r.best != null ? r.best / r.risk : 0, status: 'planned', ex: '', kind: 'odm', entries: r.fills.map(function (x) { return { p: x.p, q: x.q }; }) };
      var res = P.planAdd ? P.planAdd(np) : 'bad'; A.toast(T(res === 'ok' ? 'plSaved' : res === 'dup' ? 'plDup' : 'odE_num'));
    }, 1);
    act('odAlerts', function () { alerts(); }, 1);
    act('plBoardT', function () { if (P.riskBoard) P.riskBoard(); });

    /* walk the plan over this chart's closed bars, from N bars back */
    function test() {
      X.innerHTML = ''; var r = plan; if (!r || r.err) return;
      var w = h('<section class="pm-odsec"><h4></h4><div class="pm-cg"></div><div class="pm-odres"></div></section>'); $('h4', w).textContent = T('odTestT'); tag($('h4', w), 'odTestT'); X.appendChild(w);
      var bk = inp(st, 'back', 'odBack'); $('.pm-cg', w).appendChild(bk); var go = h('<button type="button" class="pm-btn sm pri"></button>'); go.textContent = T('odRun'); $('.pm-cg', w).appendChild(go);
      var res = $('.pm-odres', w);
      function walk() {
        res.innerHTML = ''; var k = Math.round(num(st.back)); if (!(k >= 2)) k = 150; k = Math.min(k, B.length - 1);
        if (B.length < 3) { warn(res, T('odNoBars')); return; }
        var sm = O.sim(r, inputs(st, atr), B, B.length - k); if (sm.err) { warn(res, T('odE_num')); return; }
        var o = h('<div class="pm-co"></div>'); res.appendChild(o);
        card(o, T('odEnd'), T('odEnd_' + sm.end), sm.end === 'stop' ? 'dn' : sm.end === 'exits' || sm.end === 'trail' ? 'up' : '');
        card(o, T('odFilled'), sm.filled + ' / ' + r.fills.length); card(o, T('odPnl'), sg(sm.pnl) + '  (' + sg(sm.r, 2) + 'R)', sm.pnl > 0 ? 'up' : sm.pnl < 0 ? 'dn' : '');
        if (sm.open) card(o, T('odOpenNow'), sg(sm.open.pnl) + ' @ ' + px(sm.open.mark), sm.open.pnl > 0 ? 'up' : sm.open.pnl < 0 ? 'dn' : '');
        card(o, T('odBars'), f(sm.bars, 0)); card(o, T('odAmb'), f(sm.ambiguous, 0), sm.ambiguous ? 'dn' : '', T('odAmbTip'));
        if (sm.events.length) res.appendChild(table([T('odWhen'), T('odWhat'), T('odPrice'), T('rcQty')], sm.events.map(function (e) {
          var d = new Date(e.t * 1000), kk = /^exit/.test(e.k) ? 'TP' + e.k.slice(4) : T('odEv_' + e.k);
          return [d.toLocaleString(A.LANG ? A.LANG() : undefined, { dateStyle: 'short', timeStyle: 'short' }), kk, px(e.p), f(e.q, 6)];
        })));
        var nt = h('<p class="pm-odhint"></p>'); nt.textContent = T('odTestNote'); res.appendChild(nt);
      }
      go.onclick = walk; walk(); w.scrollIntoView({ block: 'nearest' });
    }
    /* one alert per level: entries, the stop, each exit and the trail's start; each can also go to the Telegram bot */
    function alerts() {
      X.innerHTML = ''; var r = plan; if (!r || r.err) return;
      var dn = r.long ? 'down' : 'up', up = r.long ? 'up' : 'down', L = [];
      r.fills.forEach(function (x) { L.push({ k: 'E' + x.n, p: x.p, c: dn, bk: 'e' }); });
      L.push({ k: 'SL', p: r.stop, c: dn, bk: 's' });
      r.exits.forEach(function (x) { L.push({ k: 'TP' + x.n, p: x.p, c: up, bk: 'x' }); });
      if (r.trail && r.trail.act != null) L.push({ k: T('odLTrail'), p: r.trail.act, c: up, bk: 't' });
      var w = h('<section class="pm-odsec"><h4></h4><div class="pm-odal"></div><div class="pm-row"><button type="button" class="pm-btn pri sm"></button><a class="pm-btn sm pm-odbot" target="_blank" rel="noopener noreferrer" hidden></a></div><p class="pm-odhint pm-odbotn" hidden></p><p class="pm-odhint"></p></section>');
      $('h4', w).textContent = T('odAlT'); $('button.pri', w).textContent = T('odAlAdd'); $('p:last-child', w).textContent = T('odAlNote');
      var box2 = $('.pm-odal', w), ab = $('.pm-odbot', w), abn = $('.pm-odbotn', w);
      /* all ticked levels to the Telegram bot in one link (dollar coins only); the bot lists them and adds them on one tap */
      function botAll() {
        var got = P.botOdmLink ? P.botOdmLink(sym, L.filter(function (lv) { return lv.cb.checked; }).map(function (lv) { return { k: lv.bk, v: rnd(lv.p) }; })) : null;
        ab.hidden = !got; abn.hidden = !got || got.n === got.total;
        if (!got) return;
        ab.href = got.url; ab.textContent = '✈ ' + T('odAlBot', { n: got.n });
        abn.textContent = T('odAlBotCut', { n: got.n, m: got.total });
      }
      L.forEach(function (lv) {
        var r2 = h('<div class="pm-odalr"><label><input type="checkbox" checked> <b></b> <span class="pm-num" dir="ltr"></span></label></div>');
        $('b', r2).textContent = lv.k; $('span', r2).textContent = px(lv.p); lv.cb = $('input', r2); lv.cb.onchange = botAll;
        var link = P.botLink ? P.botLink(sym, +lv.p.toPrecision(10)) : null;
        if (link) { var a = h('<a class="pm-ib" target="_blank" rel="noopener noreferrer">✈</a>'); a.href = link; a.title = a.ariaLabel = T('tgAlso'); r2.appendChild(a); }
        box2.appendChild(r2);
      });
      botAll();
      $('button.pri', w).onclick = function () {
        var n = 0, d = 0;
        L.forEach(function (lv) { if (!lv.cb.checked) return; var res = P.addPriceAlert ? P.addPriceAlert(sym, +lv.p.toPrecision(10), lv.c, 'ODM ' + lv.k) : null; if (res === 'dup') d++; else if (res) n++; });
        A.toast(T('odAlDone', { n: n, d: d }));
        if (n && window.Notification && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) { } }
      };
      X.appendChild(w); w.scrollIntoView({ block: 'nearest' });
    }

    rowsE(); rowsX(); beOpts(); run(); save();
    A.modal(T('odTitle') + ' · ' + (P.pair ? P.pair(sym) : sym), box, { wide: true, nofocus: true });
    if (P.odTour && P.odTour.mount) P.odTour.mount(box);
  };
  P.odmReady = true;
})();
