/* entekhab.net — /market/ risk centre: the calculators a trade is planned with, and an OCO planner.
   Everything here is arithmetic done in the visitor's browser on the numbers they type. Nothing is sent anywhere, no
   exchange is contacted and NO ORDER IS EVER PLACED: the OCO tab is a plan — what each outcome of a bracket would pay —
   not an order ticket. Each tab shows its formula under the result, so a number can be checked by hand.
   The maths lives in P.calc (pure functions, tested by tests/test_pro_calc.js); the dialog below only reads inputs,
   calls them and prints. Inputs are validated: a stop on the wrong side of the entry, a zero distance, a probability
   outside 0–100 or a non-number gives a message, never a figure. */
(function () {
  'use strict';
  var P = window.PRO = window.PRO || {};
  var C = P.calc = {};

  /* position size from the money at risk.
     perUnit = |entry − stop| + fee·(entry + stop) + slip        what one unit loses when the stop is hit
     qty     = (balance · risk%) / perUnit */
  C.position = function (o) {
    var bal = +o.balance, rp = +o.riskPct, e = +o.entry, s = +o.stop, tp = o.target === '' || o.target == null ? NaN : +o.target, lev = +o.leverage || 1, fee = (+o.feePct || 0) / 100, slip = +o.slip || 0;
    if (!(bal > 0) || !(rp > 0) || !(e > 0) || !(s > 0)) return { err: 'num' };
    if (rp > 100) return { err: 'risk' };
    if (e === s) return { err: 'dist' };
    var long = o.side ? o.side === 'long' : s < e;
    if (long ? s >= e : s <= e) return { err: 'side' };
    if (isFinite(tp) && (long ? tp <= e : tp >= e)) return { err: 'tp' };
    if (!(lev >= 1)) return { err: 'lev' };
    var risk = bal * rp / 100, per = Math.abs(e - s) + fee * (e + s) + slip, qty = risk / per, notional = qty * e, margin = notional / lev;
    var r = { long: long, risk: risk, perUnit: per, qty: qty, notional: notional, margin: margin, marginOk: margin <= bal, fees: qty * fee * (e + s),
      breakeven: long ? e * (1 + fee) / (1 - fee) : e * (1 - fee) / (1 + fee),
      /* isolated margin, maintenance margin ignored: the real liquidation price is a little closer than this */
      liq: lev > 1 ? (long ? e * (1 - 1 / lev) : e * (1 + 1 / lev)) : null };
    if (r.liq != null) r.liqBeforeStop = long ? r.liq >= s : r.liq <= s;
    if (isFinite(tp)) { var gain = Math.abs(tp - e) - fee * (e + tp); r.profit = qty * gain; r.rr = gain / per; }
    return r;
  };

  /* what a win rate and a reward:risk are worth.  EV = p·RR − (1 − p)   in units of the risk (R) */
  C.expectancy = function (o) {
    var p = +o.winPct / 100, rr = +o.rr;
    if (!(p >= 0 && p <= 1) || !(rr > 0)) return { err: 'num' };
    return { ev: p * rr - (1 - p), breakevenWin: 100 / (1 + rr), profitFactor: p === 1 ? Infinity : p * rr / (1 - p) };
  };

  /* Kelly fraction for a bet that wins RR with probability p:  f* = p − (1 − p)/RR.  Never above 100%, never below 0. */
  C.kelly = function (o) {
    var p = +o.winPct / 100, rr = +o.rr;
    if (!(p >= 0 && p <= 1) || !(rr > 0)) return { err: 'num' };
    var f = p - (1 - p) / rr; return { full: Math.max(0, f) * 100, half: Math.max(0, f) * 50, quarter: Math.max(0, f) * 25, edge: f > 0 };
  };

  /* compound growth with a contribution at the end of each period:
     B(n) = P·(1+r)^n + c·((1+r)^n − 1)/r        (r = 0: P + c·n) */
  C.compound = function (o) {
    var Pv = +o.start, r = +o.ratePct / 100, n = Math.floor(+o.periods), c = +o.add || 0;
    if (!(Pv >= 0) || !isFinite(r) || r <= -1 || !(n >= 1) || n > 1200 || !isFinite(c)) return { err: 'num' };
    var curve = [Pv], b = Pv; for (var i = 0; i < n; i++) { b = b * (1 + r) + c; curve.push(b); }
    var g = Math.pow(1 + r, n), fin = r === 0 ? Pv + c * n : Pv * g + c * (g - 1) / r;
    return { final: fin, paidIn: Pv + c * n, gain: fin - Pv - c * n, curve: curve };
  };

  /* a loss of d% needs a gain of d/(1 − d) to get back; n losses in a row of r% each leave (1 − r)^n */
  C.drawdown = function (o) {
    var d = +o.ddPct / 100, r = +o.riskPct / 100, n = Math.floor(+o.losses || 0);
    if (!(d >= 0 && d < 1)) return { err: 'num' };
    var out = { recover: d / (1 - d) * 100 };
    if (r > 0 && r < 1 && n >= 1 && n <= 1000) { out.afterStreak = (1 - Math.pow(1 - r, n)) * 100; out.streakRecover = (1 / Math.pow(1 - r, n) - 1) * 100; }
    return out;
  };

  /* the chance of a drawdown of D% within N trades, risking a fixed share of the equity each time.
     A simulation, not a formula: `paths` random sequences from a seeded generator (so the same inputs always give the
     same answer). A win adds risk·RR, a loss takes risk; a path is "ruined" once it stands D% under its own peak. */
  C.ruin = function (o) {
    var p = +o.winPct / 100, rr = +o.rr, r = +o.riskPct / 100, D = +o.ddPct / 100, N = Math.floor(+o.trades), paths = Math.floor(+o.paths || 4000);
    if (!(p >= 0 && p <= 1) || !(rr > 0) || !(r > 0 && r < 1) || !(D > 0 && D < 1) || !(N >= 1) || N > 5000 || !(paths >= 100) || paths > 20000) return { err: 'num' };
    var seed = 0x2F6E2B1 >>> 0; function rnd() { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; }
    var hit = 0, sumEnd = 0, ends = [];
    for (var k = 0; k < paths; k++) {
      var eq = 1, peak = 1, dead = false;
      for (var i = 0; i < N; i++) { eq *= rnd() < p ? 1 + r * rr : 1 - r; if (eq > peak) peak = eq; else if (eq <= peak * (1 - D)) { dead = true; break; } }
      if (dead) hit++; sumEnd += eq; ends.push(eq);
    }
    ends.sort(function (a, b) { return a - b; });
    return { prob: hit / paths * 100, median: (ends[Math.floor(paths / 2)] - 1) * 100, paths: paths };
  };

  /* a bracket (entry, one stop, up to three targets that each close a share of the position) and what every way it can
     end pays, in R (multiples of the money at risk). After a target the rest of the position is still protected by the
     stop — at its first price, or at the entry when "stop to break-even after TP1" is on. This is a PLAN: the linked
     orders are followed on paper (a filled target cancels that share of the stop, the stop cancels what is left). */
  C.oco = function (o) {
    var e = +o.entry, s = +o.stop, risk = +o.risk || 0, be = !!o.breakeven, tg = (o.targets || []).filter(function (t) { return t && t.price !== '' && t.price != null; }).map(function (t) { return { p: +t.price, q: +t.pct }; });
    if (!(e > 0) || !(s > 0) || e === s) return { err: 'num' };
    var long = s < e, R = Math.abs(e - s);
    if (!tg.length || tg.length > 3) return { err: 'tg' };
    for (var i = 0; i < tg.length; i++) { if (!(tg[i].p > 0) || !(tg[i].q > 0) || (long ? tg[i].p <= e : tg[i].p >= e)) return { err: 'tp' }; if (i && (long ? tg[i].p <= tg[i - 1].p : tg[i].p >= tg[i - 1].p)) return { err: 'order' }; }
    var tot = tg.reduce(function (a, t) { return a + t.q; }, 0); if (Math.abs(tot - 100) > 0.01) return { err: 'pct' };
    var rows = [], banked = 0, left = 1;
    rows.push({ hit: 0, r: -1 });                                        /* stopped before any target */
    for (i = 0; i < tg.length; i++) {
      banked += tg[i].q / 100 * Math.abs(tg[i].p - e) / R; left -= tg[i].q / 100;
      if (i < tg.length - 1) rows.push({ hit: i + 1, r: banked + left * (be ? 0 : -1) });   /* this target, then the stop on the rest */
      else rows.push({ hit: i + 1, r: banked, all: true });
    }
    rows.forEach(function (x) { x.money = x.r * risk; });
    return { long: long, R: R, rows: rows, best: banked };
  };

  /* ================================================================ the dialog */
  var A = P.app; if (!A) return;
  var T = A.T, esc = A.esc, h = A.h, $ = A.$, $$ = A.$$, S = P.store;
  function num(v) { v = parseFloat(String(v).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 1632; }).replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - 1776; }).replace(/[,٬\s]/g, '')); return isFinite(v) ? v : NaN; }
  function f(v, dg) { return isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: dg == null ? 2 : dg }) : v === Infinity ? '∞' : '—'; }
  function px(v) { return isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: v >= 100 ? 2 : v >= 1 ? 4 : 8 }) : '—'; }
  var MEM = S.get('ek_pro_calc', {}); if (!MEM || typeof MEM !== 'object' || Array.isArray(MEM)) MEM = {};
  function keep(k, v) { if (typeof v === 'string' && v.length <= 24) { MEM[k] = v; S.set('ek_pro_calc', MEM); } }

  var TABS = ['pos', 'oco', 'ev', 'kelly', 'comp', 'dd', 'ruin'];
  P.riskCentre = function (tab) {
    tab = TABS.indexOf(tab) >= 0 ? tab : (TABS.indexOf(MEM._tab) >= 0 ? MEM._tab : 'pos');
    var box = h('<div class="pm-calc"><div class="pm-dtabs" role="tablist"></div><div class="pm-calcb"></div><p class="pm-enote"></p></div>'), tb = $('.pm-dtabs', box), body = $('.pm-calcb', box);
    $('p', box).textContent = T('rcNote');
    var a = A.active(), last = a && a.bars.length ? a.bars[a.bars.length - 1].c : NaN;
    function field(k, lbl, def, opt) {
      var w = h('<label class="pm-cf"><span></span><input class="pm-in" inputmode="decimal" dir="ltr" autocomplete="off"></label>'), i = $('input', w); $('span', w).textContent = T(lbl);
      i.value = MEM[k] != null ? MEM[k] : (def == null ? '' : def); if (opt) i.placeholder = T('rcOpt'); i._k = k; return w;
    }
    function out(rows, formula, warn) {
      var o = h('<div class="pm-co"></div>');
      rows.forEach(function (r) { var d = h('<div class="pm-cor' + (r[2] ? ' ' + r[2] : '') + '"><small></small><b class="pm-num" dir="ltr"></b></div>'); $('small', d).textContent = r[0]; $('b', d).textContent = r[1]; o.appendChild(d); });
      if (warn) { var wn = h('<div class="pm-cw2"></div>'); wn.textContent = warn; o.appendChild(wn); }
      if (formula) { var fm = h('<code class="pm-cfm" dir="ltr"></code>'); fm.textContent = formula; o.appendChild(fm); }
      return o;
    }
    function err(k) { var e = h('<div class="pm-cw2"></div>'); e.textContent = T('rcE_' + k); return e; }
    function form(fields, run) {
      var g = h('<div class="pm-cg"></div>'), res = h('<div class="pm-cres"></div>');
      fields.forEach(function (x) { g.appendChild(x); });
      function go() { var v = {}; $$('input,select', g).forEach(function (i) { if (i._k) { v[i._k.split('.')[1]] = i.tagName === 'SELECT' ? i.value : (i.value.trim() === '' ? '' : num(i.value)); keep(i._k, i.value); } }); res.innerHTML = ''; res.appendChild(run(v)); }
      g.addEventListener('input', go); g.addEventListener('change', go);
      body.innerHTML = ''; body.appendChild(g); body.appendChild(res); go();
    }
    var PAGES = {
      pos: function () {
        form([field('pos.balance', 'rcBal', 1000), field('pos.riskPct', 'rcRisk', 1), field('pos.entry', 'rcEntry', isFinite(last) ? px(last).replace(/,/g, '') : ''), field('pos.stop', 'rcStop', ''), field('pos.target', 'rcTarget', '', 1),
          field('pos.leverage', 'rcLev', 1), field('pos.feePct', 'rcFee', 0.1), field('pos.slip', 'rcSlip', 0)], function (v) {
          var r = C.position(v); if (r.err) return err(r.err);
          var rows = [[T('rcSide'), T(r.long ? 'rcLong' : 'rcShort2')], [T('rcQty'), f(r.qty, 6)], [T('rcNotional'), f(r.notional)], [T('rcMargin'), f(r.margin)], [T('rcMaxLoss'), f(r.risk), 'dn'], [T('rcFees'), f(r.fees, 4)], [T('rcBE'), px(r.breakeven)]];
          if (r.profit != null) rows.push([T('rcProfit'), f(r.profit), 'up'], [T('rcRR'), '1 : ' + f(r.rr, 2)]);
          if (r.liq != null) rows.push([T('rcLiq'), px(r.liq)]);
          return out(rows, 'qty = balance × risk% ÷ ( |entry − stop| + fee × (entry + stop) + slippage )', !r.marginOk ? T('rcW_margin') : r.liqBeforeStop ? T('rcW_liq') : '');
        });
      },
      oco: function () {
        var be = h('<label class="pm-cf"><span></span><select class="pm-in"><option value="0"></option><option value="1"></option></select></label>'); $('span', be).textContent = T('rcBEafter'); $$('option', be)[0].textContent = T('rcNo'); $$('option', be)[1].textContent = T('rcYes');
        var bs = $('select', be); bs._k = 'oco.be'; bs.value = MEM['oco.be'] === '1' ? '1' : '0';
        form([field('oco.entry', 'rcEntry', isFinite(last) ? px(last).replace(/,/g, '') : ''), field('oco.stop', 'rcStop', ''), field('oco.risk', 'rcRiskMoney', 10),
          field('oco.p1', 'rcTp1', ''), field('oco.q1', 'rcShare', 50), field('oco.p2', 'rcTp2', '', 1), field('oco.q2', 'rcShare', 30, 1), field('oco.p3', 'rcTp3', '', 1), field('oco.q3', 'rcShare', 20, 1), be], function (v) {
          var tg = [{ price: v.p1, pct: v.q1 }, { price: v.p2, pct: v.q2 }, { price: v.p3, pct: v.q3 }];
          var r = C.oco({ entry: v.entry, stop: v.stop, risk: v.risk, breakeven: v.be === '1', targets: tg }); if (r.err) return err('oco_' + r.err);
          var rows = r.rows.map(function (x) { return [x.hit === 0 ? T('rcO_stop') : x.all ? T('rcO_all') : T('rcO_then', { n: x.hit }), (x.r >= 0 ? '+' : '') + f(x.r, 2) + ' R   ' + (x.money >= 0 ? '+' : '') + f(x.money), x.r > 0 ? 'up' : x.r < 0 ? 'dn' : '']; });
          return out(rows, 'R = |entry − stop| · result = Σ share × (target − entry)/R  −  share left × 1R (0R at break-even)', T('rcOcoPlan'));
        });
      },
      ev: function () {
        form([field('ev.winPct', 'rcWin', 45), field('ev.rr', 'rcRRin', 2)], function (v) {
          var r = C.expectancy(v); if (r.err) return err(r.err);
          return out([[T('rcEV'), (r.ev >= 0 ? '+' : '') + f(r.ev, 3) + ' R', r.ev > 0 ? 'up' : 'dn'], [T('rcBEwin'), f(r.breakevenWin, 1) + '%'], [T('rcPF'), f(r.profitFactor, 2)]], 'EV = p × RR − (1 − p)      break-even win rate = 1 ÷ (1 + RR)      PF = p × RR ÷ (1 − p)');
        });
      },
      kelly: function () {
        form([field('ke.winPct', 'rcWin', 45), field('ke.rr', 'rcRRin', 2)], function (v) {
          var r = C.kelly(v); if (r.err) return err(r.err);
          return out([[T('rcKfull'), f(r.full, 2) + '%'], [T('rcKhalf'), f(r.half, 2) + '%', 'up'], [T('rcKq'), f(r.quarter, 2) + '%', 'up']], 'f* = p − (1 − p) ÷ RR', r.edge ? T('rcW_kelly') : T('rcW_noedge'));
        });
      },
      comp: function () {
        form([field('co.start', 'rcStart', 1000), field('co.ratePct', 'rcRate', 5), field('co.periods', 'rcPeriods', 12), field('co.add', 'rcAdd', 0)], function (v) {
          var r = C.compound(v); if (r.err) return err(r.err);
          var o = out([[T('rcFinal'), f(r.final)], [T('rcPaid'), f(r.paidIn)], [T('rcGain'), f(r.gain), r.gain >= 0 ? 'up' : 'dn']], 'B(n) = P(1 + r)ⁿ + c × ((1 + r)ⁿ − 1) ÷ r');
          var mx = Math.max.apply(null, r.curve), mn = Math.min.apply(null, r.curve), W = 300, H = 70, n = r.curve.length - 1;
          var pts = r.curve.map(function (y, i) { return (i / n * W).toFixed(1) + ',' + (H - 4 - (mx > mn ? (y - mn) / (mx - mn) : 0.5) * (H - 8)).toFixed(1); }).join(' ');
          o.insertBefore(h('<svg class="pm-cspark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>'), o.lastChild);
          return o;
        });
      },
      dd: function () {
        form([field('dd.ddPct', 'rcDD', 20), field('dd.riskPct', 'rcRisk', 1, 1), field('dd.losses', 'rcLosses', 10, 1)], function (v) {
          var r = C.drawdown(v); if (r.err) return err(r.err);
          var rows = [[T('rcRecover'), '+' + f(r.recover, 2) + '%', 'dn']]; if (r.afterStreak != null) rows.push([T('rcStreak'), '−' + f(r.afterStreak, 2) + '%', 'dn'], [T('rcStreakRec'), '+' + f(r.streakRecover, 2) + '%']);
          return out(rows, 'gain needed = d ÷ (1 − d)      after n losses of r: 1 − (1 − r)ⁿ');
        });
      },
      ruin: function () {
        form([field('ru.winPct', 'rcWin', 45), field('ru.rr', 'rcRRin', 2), field('ru.riskPct', 'rcRisk', 2), field('ru.ddPct', 'rcDDlimit', 30), field('ru.trades', 'rcTrades', 200)], function (v) {
          var r = C.ruin(v); if (r.err) return err(r.err);
          return out([[T('rcRuinP'), f(r.prob, 1) + '%', r.prob > 20 ? 'dn' : ''], [T('rcMedian'), (r.median >= 0 ? '+' : '') + f(r.median, 1) + '%', r.median >= 0 ? 'up' : 'dn']], '', T('rcSim', { n: f(r.paths, 0) }));
        });
      }
    };
    TABS.forEach(function (t) {
      var b = h('<button type="button" role="tab" class="pm-dtab' + (t === tab ? ' on' : '') + '"></button>'); b.textContent = T('rcT_' + t);
      b.onclick = function () { tab = t; MEM._tab = t; S.set('ek_pro_calc', MEM); $$('.pm-dtab', tb).forEach(function (x) { x.classList.toggle('on', x === b); }); PAGES[t](); };
      tb.appendChild(b);
    });
    PAGES[tab]();
    A.modal(T('rcTitle'), box, { wide: true, nofocus: true });
  };
})();
