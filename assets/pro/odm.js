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
          if (plan.beAfter && hit >= plan.beAfter) stop = long ? Math.max(stop, plan.be) : Math.min(stop, plan.be);
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
  P.odmReady = true;
})();
