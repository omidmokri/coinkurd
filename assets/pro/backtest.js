/* entekhab.net — /market/ backtesting.
   1. The practice account of bar replay: a balance, a position size (% of equity), leverage, fees and slippage,
      stop-loss / take-profit (fixed or trailing) and limit / stop orders. Each revealed bar is walked the way
      TradingView's broker emulator walks it (open → the nearer extreme → the other one → close), so what a bar reaches
      first is decided the same way; a gap fills at the open; a liquidation takes the margin.
   2. The strategy tester: built-in strategies (and, on BTC, the published Kurdistani signals) run on the chart's history
      or more of it; a signal at a close is filled at the next bar's open.
   3. The optimizer: every combination of a strategy's settings in chosen ranges, ranked.
   4. One report for all: net result, win rate, profit factor, drawdown, Sharpe and Sortino, streaks, long/short split,
      time in the market, buy & hold, the equity curve, every trade and a CSV of them. Trade marks go on the chart.
   Nothing here is a real order: no exchange is contacted. */
(function () {
  'use strict';
  var P = window.PRO, A = P && P.app; if (!A) return;
  var T = A.T, esc = A.esc, h = A.h, $ = A.$, $$ = A.$$, d = document;
  var KEY = 'ek_pro_bt';

  function num(v, def, lo, hi) { v = +v; return isFinite(v) && v >= lo && v <= hi ? v : def; }
  function sane(o) {
    o = o && typeof o === 'object' ? o : {};
    return { bal: num(o.bal, 10000, 1, 1e15), size: num(o.size, 10, 0.1, 100), lev: Math.round(num(o.lev, 1, 1, 125)), fee: num(o.fee, 0.1, 0, 5),
      slip: num(o.slip, 0, 0, 5), sl: num(o.sl, 0, 0, 99), tp: num(o.tp, 0, 0, 1000), trail: num(o.trail, 0, 0, 99),
      dir: o.dir === 'long' || o.dir === 'short' ? o.dir : 'both' };
  }
  var CFG = sane(P.store.get(KEY, {}));
  function saveCfg() { P.store.set(KEY, CFG); }
  function forSym(sym) { var c = Object.assign({}, CFG); if (P.isToman && P.isToman(sym) && c.bal === 10000) c.bal = 100000000; return c; }

  /* ================================================================ the account */
  function Account(cfg, sym) {
    this.cfg = sane(cfg); this.sym = sym; this.bal = this.cfg.bal; this.start = this.cfg.bal;
    this.pos = null; this.orders = []; this.trades = []; this.curve = []; this.fees = 0; this.lastT = -Infinity; this.px = null;
    this.seg = 0; this.nb = 0; this.nin = 0;
  }
  var AP = Account.prototype;
  AP.equity = function (p) { var q = this.pos; return this.bal + (q && p > 0 ? q.qty * (p - q.entry) * q.side : 0); };
  AP.liqPrice = function () {
    var q = this.pos; if (!q || (q.lev <= 1 && q.side > 0)) return null;     /* a long without leverage is never liquidated */
    var lp = q.entry - q.side * q.margin * 0.995 / q.qty;                   /* what is left of the margin at 0.5% maintenance */
    return lp > 0 ? lp : null;
  };
  /* open (or reverse into) a position at a price. o: { sl, tp } prices; maker: a limit fill, so no slippage */
  AP.open = function (side, price, t, o) {
    o = o || {};
    if (!(price > 0) || (side !== 1 && side !== -1)) return false;
    if (this.pos && this.pos.side === side) return false;
    if (this.pos) this.close(price, t, 'rev', o.maker);
    var c = this.cfg, eq = this.equity(price);
    if (!(eq > 0)) return false;
    var entry = o.maker ? price : price * (1 + side * c.slip / 100), margin = eq * c.size / 100, notional = margin * c.lev, qty = notional / entry, fee = notional * c.fee / 100;
    this.bal -= fee; this.fees += fee;
    var sl = o.sl > 0 ? +o.sl : c.sl > 0 ? entry * (1 - side * c.sl / 100) : null, tp = o.tp > 0 ? +o.tp : c.tp > 0 ? entry * (1 + side * c.tp / 100) : null;
    this.pos = { side: side, entry: entry, qty: qty, margin: margin, lev: c.lev, t: t, sl: sl, tp: tp, fee0: fee, eq0: eq, best: entry, trailed: false };
    return true;
  };
  AP.close = function (price, t, why, maker) {
    var q = this.pos; if (!q || !(price > 0)) return null;
    var liq = why === 'liq', exit = liq || maker || why === 'tp' ? price : price * (1 - q.side * this.cfg.slip / 100);
    var gross = liq ? -q.margin : q.qty * (exit - q.entry) * q.side, fee = liq ? 0 : q.qty * exit * this.cfg.fee / 100;
    this.bal += gross - fee; this.fees += fee;
    var net = gross - fee - q.fee0;
    var tr = { side: q.side, entry: q.entry, exit: exit, qty: q.qty, t0: q.t, t1: t, pnl: net, pct: net / q.margin * 100, ret: net / q.eq0 * 100, why: why || 'manual', lev: q.lev };
    this.trades.push(tr); this.pos = null;
    return tr;
  };
  AP.order = function (o) {                                                 /* { side, type: 'limit' | 'stop', price, sl, tp, t } */
    if (!(o.price > 0) || (o.side !== 1 && o.side !== -1) || (o.type !== 'limit' && o.type !== 'stop')) return false;
    this.orders.push({ id: P.uid(), side: o.side, type: o.type, price: +o.price, sl: o.sl > 0 ? +o.sl : null, tp: o.tp > 0 ? +o.tp : null, t: o.t });
    return true;
  };
  AP.cancel = function (id) { this.orders = id ? this.orders.filter(function (x) { return x.id !== id; }) : []; };
  /* the prices a move can reach: [price, kind, order, test]; test −1 fires at or below the price, +1 at or above it */
  AP.levels = function () {
    var out = [], q = this.pos;
    if (q) {
      var L = q.side > 0, lq = this.liqPrice();
      if (lq != null) out.push([lq, 'liq', null, L ? -1 : 1]);
      if (q.sl != null) out.push([q.sl, 'sl', null, L ? -1 : 1]);
      if (q.tp != null) out.push([q.tp, 'tp', null, L ? 1 : -1]);
    }
    this.orders.forEach(function (o) { out.push([o.price, 'ord', o, o.type === 'limit' ? -o.side : o.side]); });
    return out;
  };
  var RANK = { liq: 0, sl: 1, ord: 2, tp: 3 };                               /* a tie goes the cautious way */
  /* move the price from a to b; whatever is reached fires at its own price — in a gap (gap = true) at the open, b */
  AP.walk = function (bar, a, b, done, gap) {
    var cur = a;
    for (var guard = 0; guard < 64; guard++) {
      var best = null, bd = Infinity, br = 9;
      this.levels().forEach(function (v) {
        var p = v[0], dist;
        if (v[3] < 0 ? cur <= p : cur >= p) dist = 0;
        else if (v[3] < 0 ? b <= p : b >= p) dist = Math.abs(cur - p);
        else return;
        var r = RANK[v[1]];
        if (dist < bd || (dist === bd && r < br)) { bd = dist; br = r; best = v; }
      });
      if (!best) return;
      var at = gap ? b : bd === 0 ? cur : best[0];
      if (best[1] === 'ord') {
        var o = best[2], opened;
        this.orders = this.orders.filter(function (x) { return x !== o; });
        opened = this.open(o.side, at, bar.t, { sl: o.sl, tp: o.tp, maker: o.type === 'limit' });
        done.push(opened ? { kind: 'fill', o: o, price: at } : { kind: 'skip', o: o });
        if (gap && opened) return;                                          /* what opens at the open meets the bar from there */
      } else {
        var why = best[1] === 'sl' && this.pos.trailed ? 'trail' : best[1];
        done.push({ kind: 'exit', tr: this.close(best[1] === 'liq' ? best[0] : at, bar.t, why) });
      }
      if (!gap) cur = at;
    }
  };
  /* a newly revealed bar. atOpen(account, bar): what a strategy does at the open, after the gap and before the bar moves */
  AP.onBar = function (b, atOpen) {
    if (!b || !(b.t > this.lastT) || !(b.c > 0)) return [];
    this.lastT = b.t;
    var done = [], hiFirst = Math.abs(b.h - b.o) < Math.abs(b.o - b.l);
    if (this.px > 0 && this.px !== b.o) this.walk(b, this.px, b.o, done, true);
    if (atOpen) atOpen(this, b);
    var path = hiFirst ? [b.o, b.h, b.l, b.c] : [b.o, b.l, b.h, b.c];
    for (var k = 1; k < 4; k++) this.walk(b, path[k - 1], path[k], done, false);
    var q = this.pos, tr = this.cfg.trail;
    if (q && tr > 0) {                                                      /* the trailing stop follows the best price, from the next bar on */
      var ext = q.t === b.t ? b.c : q.side > 0 ? b.h : b.l;
      q.best = q.side > 0 ? Math.max(q.best, ext) : Math.min(q.best, ext);
      var ts = q.best * (1 - q.side * tr / 100);
      if (q.sl == null || (q.side > 0 ? ts > q.sl : ts < q.sl)) { q.sl = ts; q.trailed = true; }
    }
    this.nb++; if (this.pos) this.nin++;
    this.px = b.c; this.mark(b.t, b.c);
    return done;
  };
  AP.mark = function (t, p) {
    var e = this.equity(p), c = this.curve, L = c[c.length - 1];
    if (L && L.t === t) L.e = e; else c.push({ t: t, e: e });
    if (c.length > 20000) this.curve = c.filter(function (_, i) { return i % 2 === 0 || i === c.length - 1; });
  };

  /* ================================================================ statistics */
  function stats(acct, bars, sec) {
    var tr = acct.trades, n = tr.length, add = function (s, x) { return s + x; };
    var pn = tr.map(function (x) { return x.pnl; }), w = pn.filter(function (x) { return x > 0; }), l = pn.filter(function (x) { return x <= 0; });
    var gp = w.reduce(add, 0), gl = -l.reduce(add, 0);
    var C = acct.curve, peak = acct.start, dd = 0, ddp = 0;
    C.forEach(function (c) { if (c.e > peak) peak = c.e; var x = peak - c.e; if (x > dd) dd = x; if (peak > 0 && x / peak > ddp) ddp = x / peak; });
    var ws = 0, ls = 0, cw = 0, cl = 0;
    pn.forEach(function (x) { if (x > 0) { cw++; cl = 0; if (cw > ws) ws = cw; } else { cl++; cw = 0; if (cl > ls) ls = cl; } });
    /* risk ratios from the bar-by-bar equity, annualised for a market open around the clock */
    var rr = [], i; for (i = 1; i < C.length; i++) if (C[i - 1].e > 0 && C[i].t > C[i - 1].t) rr.push(C[i].e / C[i - 1].e - 1);
    var per = rr.length ? Math.max(1, (C[C.length - 1].t - C[0].t) / rr.length) : sec || 86400, ann = Math.sqrt(365 * 86400 / per);
    var m = rr.length ? rr.reduce(add, 0) / rr.length : 0;
    var sdv = rr.length > 1 ? Math.sqrt(rr.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (rr.length - 1)) : 0;
    var dsd = rr.length ? Math.sqrt(rr.reduce(function (s, x) { return s + (x < 0 ? x * x : 0); }, 0) / rr.length) : 0;
    var side = function (sg) { var a = tr.filter(function (x) { return x.side === sg; }); return { n: a.length, win: a.length ? a.filter(function (x) { return x.pnl > 0; }).length / a.length * 100 : 0, net: a.reduce(function (s, x) { return s + x.pnl; }, 0) }; };
    var endEq = acct.equity(acct.px), first = bars && bars.length ? bars[0] : null, last = bars && bars.length ? bars[bars.length - 1] : null;
    return {
      n: n, wins: w.length, losses: l.length, win: n ? w.length / n * 100 : 0,
      net: endEq - acct.start, netPct: (endEq / acct.start - 1) * 100, end: endEq, start: acct.start,
      gp: gp, gl: gl, pf: gl > 0 ? gp / gl : gp > 0 ? Infinity : 0,
      avgW: w.length ? gp / w.length : 0, avgL: l.length ? -gl / l.length : 0, avg: n ? pn.reduce(add, 0) / n : 0,
      best: n ? Math.max.apply(null, pn) : 0, worst: n ? Math.min.apply(null, pn) : 0,
      dd: dd, ddPct: ddp * 100, ws: ws, ls: ls, fees: acct.fees,
      bars: n && sec ? tr.reduce(function (s, x) { return s + (x.t1 - x.t0) / sec; }, 0) / n : 0,
      sharpe: sdv > 0 ? m / sdv * ann : 0, sortino: dsd > 0 ? m / dsd * ann : 0,
      expo: acct.nb ? acct.nin / acct.nb * 100 : 0, recov: dd > 0 ? (endEq - acct.start) / dd : null,
      long: side(1), short: side(-1),
      hold: first && last && first.o > 0 ? (last.c / first.o - 1) * 100 : null, from: first ? first.t : null, to: last ? last.t : null,
      liq: tr.filter(function (x) { return x.why === 'liq'; }).length, open: !!acct.pos
    };
  }

  /* ================================================================ the report */
  function quote(sym) { var I = P.inst ? P.inst(sym) : null; return I && I.quote === 'IRT' ? T('toman') : I && I.quote === 'USD' ? 'USD' : 'USDT'; }
  function money(v, sym) {
    var irt = P.isToman && P.isToman(sym), a = Math.abs(v);
    var s = a.toLocaleString('en-US', { maximumFractionDigits: irt ? 0 : a >= 100 ? 2 : 4, minimumFractionDigits: irt ? 0 : 2 });
    return (v < 0 ? '−' : '') + s;
  }
  function pct(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + '%'; }
  function int(v) { return Math.round(v).toLocaleString('en-US'); }                 /* figures in the report stay in one script */
  function curveCanvas(acct, w, hgt) {
    var cv = d.createElement('canvas'), dpr = window.devicePixelRatio || 1; cv.width = w * dpr; cv.height = hgt * dpr; cv.style.width = '100%'; cv.style.height = hgt + 'px'; cv.className = 'pm-eqc';
    var x = cv.getContext('2d'), C = acct.curve; if (!x) return cv; x.scale(dpr, dpr);
    if (C.length < 2) { x.fillStyle = '#9a9a94'; x.font = '12px Vazirmatn, Tahoma, sans-serif'; x.textAlign = 'center'; x.fillText(T('btNoCurve'), w / 2, hgt / 2); return cv; }
    var lo = Infinity, hi = -Infinity; C.forEach(function (c) { if (c.e < lo) lo = c.e; if (c.e > hi) hi = c.e; }); lo = Math.min(lo, acct.start); hi = Math.max(hi, acct.start);
    var pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.01 || 1; lo -= pad; hi += pad;
    var X = function (i) { return 6 + (w - 12) * i / (C.length - 1); }, Y = function (v) { return 6 + (hgt - 12) * (1 - (v - lo) / (hi - lo)); };
    x.strokeStyle = 'rgba(154,154,148,.45)'; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(6, Y(acct.start)); x.lineTo(w - 6, Y(acct.start)); x.stroke(); x.setLineDash([]);
    var peak = -Infinity; x.fillStyle = 'rgba(255,90,77,.16)'; x.beginPath();               /* drawdown: the gap under the running peak */
    C.forEach(function (c, i) { peak = Math.max(peak, c.e); if (i) x.lineTo(X(i), Y(peak)); else x.moveTo(X(i), Y(peak)); });
    for (var i = C.length - 1; i >= 0; i--) x.lineTo(X(i), Y(C[i].e)); x.closePath(); x.fill();
    x.strokeStyle = C[C.length - 1].e >= acct.start ? '#34d399' : '#ff5a4d'; x.lineWidth = 1.8; x.beginPath();
    C.forEach(function (c, i) { if (i) x.lineTo(X(i), Y(c.e)); else x.moveTo(X(i), Y(c.e)); }); x.stroke();
    return cv;
  }
  function report(cell, acct, opts) {
    opts = opts || {};
    var sym = acct.sym, s = stats(acct, opts.bars || null, cell.tfSec()), q = quote(sym);
    var card = function (k, v, cls) { return '<div class="pm-btc"><small>' + esc(T(k)) + '</small><b class="pm-num ' + (cls || '') + '">' + v + '</b></div>'; };
    var pf = s.pf === Infinity ? '∞' : s.pf.toFixed(2), ud = function (v) { return v >= 0 ? 'up' : 'dn'; };
    var head = '<div class="pm-bth"><span>' + esc(P.pair(sym)) + ' · ' + esc(A.tfLabel(cell.cfg.tf)) + (s.from ? ' · ' + esc(A.fmtT(s.from, 'date')) + ' → ' + esc(A.fmtT(s.to, 'date')) : '') + (opts.bars ? ' · ' + esc(T('btBarsN', { n: A.loc(opts.bars.length) })) : '') + '</span></div>';
    var grid = '<div class="pm-btg">' +
      card('btNet', money(s.net, sym) + ' <small>' + esc(q) + '</small>', ud(s.net)) + card('btNetPct', pct(s.netPct), ud(s.netPct)) +
      (s.hold != null ? card('btHold', pct(s.hold), ud(s.hold)) : '') +
      card('btTrades', int(s.n)) + card('btWin', s.win.toFixed(1) + '%') + card('btPF', pf, s.pf >= 1 ? 'up' : 'dn') +
      card('btDD', money(s.dd, sym) + ' <small>(' + s.ddPct.toFixed(2) + '%)</small>', 'dn') + card('btRecov', s.recov == null ? '—' : s.recov.toFixed(2), s.recov == null ? '' : ud(s.recov)) +
      card('btSharpe', s.sharpe.toFixed(2), ud(s.sharpe)) + card('btSortino', s.sortino.toFixed(2), ud(s.sortino)) +
      card('btAvg', money(s.avg, sym), ud(s.avg)) + card('btAvgW', money(s.avgW, sym), 'up') + card('btAvgL', money(s.avgL, sym), 'dn') +
      card('btBest', money(s.best, sym), 'up') + card('btWorst', money(s.worst, sym), 'dn') + card('btStreak', int(s.ws) + ' / ' + int(s.ls)) +
      card('btBars', s.bars ? s.bars.toFixed(1) : '—') + card('btExpo', s.expo.toFixed(1) + '%') + card('btFees', money(s.fees, sym)) +
      card('btLong', int(s.long.n) + ' · ' + s.long.win.toFixed(0) + '% · ' + money(s.long.net, sym), ud(s.long.net)) +
      card('btShort', int(s.short.n) + ' · ' + s.short.win.toFixed(0) + '% · ' + money(s.short.net, sym), ud(s.short.net)) +
      '</div>';
    var rows = acct.trades.slice(-300).reverse().map(function (t, k) {
      return '<tr><td>' + int(acct.trades.length - k) + '</td><td class="' + (t.side > 0 ? 'up' : 'dn') + '">' + (t.side > 0 ? '▲ ' + esc(T('long')) : '▼ ' + esc(T('short'))) + (t.lev > 1 ? ' ' + t.lev + '×' : '') + '</td><td>' + esc(A.fmtT(t.t0)) + '</td><td class="pm-num">' + cell.fmt(t.entry) +
        '</td><td>' + esc(A.fmtT(t.t1)) + '</td><td class="pm-num">' + cell.fmt(t.exit) + '</td><td class="pm-num ' + ud(t.pnl) + '">' + money(t.pnl, sym) + '</td><td class="pm-num ' + ud(t.pct) + '">' + pct(t.pct) + '</td><td>' + esc(T('why_' + t.why)) + '</td></tr>';
    }).join('');
    var c = acct.cfg;
    var f = h('<div class="pm-btr">' + head + grid + '<div class="pm-btcv"></div>' +
      (acct.trades.length ? '<div class="pm-tw"><table class="pm-tbl pm-btt" dir="ltr"><tr><th>#</th><th></th><th>' + esc(T('btIn')) + '</th><th>' + esc(T('entry')) + '</th><th>' + esc(T('btOut')) + '</th><th>' + esc(T('exit')) + '</th><th>' + esc(q) + '</th><th>%</th><th></th></tr>' + rows + '</table></div>' : '<p class="pm-note">' + esc(T('btNoTrades')) + '</p>') +
      '<p class="pm-note">' + esc(T('btNote', { b: money(acct.start, sym), q: q, s: c.size, l: c.lev, f: c.fee, p: c.slip })) + (acct.trades.length > 300 ? ' ' + esc(T('btLast300')) : '') + (s.liq ? ' ' + esc(T('btLiqN', { n: A.loc(s.liq) })) : '') + (s.open ? ' ' + esc(T('btOpenNote')) : '') + '</p>' +
      '<div class="pm-row"><button type="button" class="pm-btn" data-a="csv">' + esc(T('btCsv')) + '</button>' + (opts.reset ? '<button type="button" class="pm-btn" data-a="reset">' + esc(T('btReset')) + '</button>' : '') + (opts.back ? '<button type="button" class="pm-btn" data-a="back">' + esc(T('btBack')) + '</button>' : '') + '</div></div>');
    $('.pm-btcv', f).appendChild(curveCanvas(acct, 640, 150));
    $('[data-a="csv"]', f).onclick = function () { csv(cell, acct); };
    if (opts.reset) $('[data-a="reset"]', f).onclick = function () { A.closeModal(); opts.reset(); };
    if (opts.back) $('[data-a="back"]', f).onclick = function () { A.closeModal(); opts.back(); };
    A.modal(opts.title || T('btReport'), f, { wide: true, nofocus: true });
  }
  function csv(cell, acct) {
    var lines = ['n,side,entry_time_utc,entry,exit_time_utc,exit,qty,pnl,pnl_pct_of_margin,return_pct_of_equity,reason,leverage'];
    var iso = function (t) { return new Date(t * 1000).toISOString().replace('.000Z', 'Z'); };
    acct.trades.forEach(function (t, k) { lines.push([k + 1, t.side > 0 ? 'long' : 'short', iso(t.t0), +t.entry.toPrecision(12), iso(t.t1), +t.exit.toPrecision(12), +t.qty.toPrecision(10), +t.pnl.toFixed(8), +t.pct.toFixed(4), +t.ret.toFixed(4), t.why, t.lev].join(',')); });
    A.download('entekhab_backtest_' + acct.sym + '_' + cell.cfg.tf + '_' + new Date().toISOString().slice(0, 10) + '.csv', '﻿' + lines.join('\n') + '\n', 'text/csv');
  }
  /* trade marks on the chart (entries ▲▼, exits ● with the result), placed on the bars they happened in */
  function marksOf(acct) {
    var out = [];
    acct.trades.slice(acct.seg || 0).forEach(function (t) {
      out.push({ time: t.t0, position: t.side > 0 ? 'belowBar' : 'aboveBar', color: t.side > 0 ? '#34d399' : '#ff5a4d', shape: t.side > 0 ? 'arrowUp' : 'arrowDown', size: 1 });
      out.push({ time: t.t1, position: t.side > 0 ? 'aboveBar' : 'belowBar', color: t.pnl >= 0 ? '#34d399' : '#ff5a4d', shape: 'circle', size: 0.7, text: (t.pct >= 0 ? '+' : '') + t.pct.toFixed(1) + '%' });
    });
    if (acct.pos) out.push({ time: acct.pos.t, position: acct.pos.side > 0 ? 'belowBar' : 'aboveBar', color: '#f7931a', shape: acct.pos.side > 0 ? 'arrowUp' : 'arrowDown', size: 1.2 });
    return out;
  }
  /* entry / stop / target / liquidation / orders as lines on the price scale */
  function lines(cell, acct) {
    (cell._btL || []).forEach(function (l) { try { cell.main.removePriceLine(l); } catch (e) { } }); cell._btL = [];
    if (!acct) return;
    var add = function (p, c, t, st) { if (!(p > 0)) return; try { cell._btL.push(cell.main.createPriceLine({ price: p, color: c, lineWidth: 1, lineStyle: st || 0, axisLabelVisible: true, title: t })); } catch (e) { } };
    var q = acct.pos;
    if (q) { add(q.entry, '#f7931a', T(q.side > 0 ? 'long' : 'short')); add(q.sl, '#ff5a4d', q.trailed ? T('why_trail') : 'SL', 2); add(q.tp, '#34d399', 'TP', 2); if (q.lev > 1) add(acct.liqPrice(), '#a855f7', T('liq'), 1); }
    acct.orders.forEach(function (o) { add(o.price, o.side > 0 ? '#34d399' : '#ff5a4d', (o.side > 0 ? T('buy') : T('sell')) + ' ' + T('ot_' + o.type), 3); });
  }

  /* ================================================================ settings and the order form */
  function field(f, label, name, val) {
    var r = h('<label class="pm-field"><span></span><input class="pm-in" type="number" step="any" inputmode="decimal"></label>');
    $('span', r).textContent = label; var i = $('input', r); i.name = name; if (val != null && val !== '') i.value = val; f.appendChild(r); return i;
  }
  function settings(cell, after) {
    var sym = cell.cfg.sym, c = forSym(sym), f = h('<form class="pm-iset pm-bts"></form>');
    field(f, T('bt_bal') + ' (' + quote(sym) + ')', 'bal', c.bal);
    ['size', 'lev', 'fee', 'slip', 'sl', 'tp', 'trail'].forEach(function (k) { field(f, T('bt_' + k), k, c[k] || (k === 'size' || k === 'lev' ? c[k] : '')); });
    var dr = h('<label class="pm-field"><span></span><select class="pm-in" name="dir"></select></label>'); $('span', dr).textContent = T('bt_dir');
    ['both', 'long', 'short'].forEach(function (k) { $('select', dr).appendChild(new Option(T('dir_' + k), k)); }); $('select', dr).value = c.dir; f.appendChild(dr);
    var nt = h('<p class="pm-note"></p>'); nt.textContent = T('btSetNote'); f.appendChild(nt);
    f.appendChild(h('<div class="pm-row"><button class="pm-btn pri" type="submit">' + esc(T('apply')) + '</button></div>'));
    f.onsubmit = function (e) {
      e.preventDefault(); var o = {};
      $$('input,select', f).forEach(function (i) { o[i.name] = i.value === '' ? 0 : i.value; });
      if (P.isToman && P.isToman(sym) && +o.bal === 100000000) o.bal = 10000;    /* the toman default stays a default */
      CFG = sane(o); saveCfg(); A.closeModal(); if (after) after();
    };
    A.modal(T('btSettings'), f);
  }
  function orderForm(cell, acct, price, after) {
    var f = h('<form class="pm-iset pm-bto"><div class="pm-seg"><button type="button" data-s="1" class="on"></button><button type="button" data-s="-1"></button></div></form>');
    $('[data-s="1"]', f).textContent = T('buy'); $('[data-s="-1"]', f).textContent = T('sell');
    var side = 1;
    $$('[data-s]', f).forEach(function (b) { b.onclick = function () { side = +b.getAttribute('data-s'); $$('[data-s]', f).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    var ty = h('<label class="pm-field"><span></span><select class="pm-in" name="type"></select></label>'); $('span', ty).textContent = T('ot');
    ['market', 'limit', 'stop'].forEach(function (k) { $('select', ty).appendChild(new Option(T('ot_' + k), k)); }); f.appendChild(ty);
    var pr = field(f, T('of_price'), 'price', +(+price).toPrecision(8)), sl = field(f, T('of_sl'), 'sl'), tp = field(f, T('of_tp'), 'tp');
    var setP = function () { pr.parentNode.hidden = $('select', ty).value === 'market'; }; $('select', ty).onchange = setP; setP();
    var nt = h('<p class="pm-note"></p>'); nt.textContent = T('orderNote'); f.appendChild(nt);
    f.appendChild(h('<div class="pm-row"><button class="pm-btn pri" type="submit">' + esc(T('place')) + '</button></div>'));
    f.onsubmit = function (e) {
      e.preventDefault();
      var type = $('select', ty).value, p = type === 'market' ? price : +pr.value, s = +sl.value || null, t = +tp.value || null, R = cell.replay;
      if (!R) { A.closeModal(); return; }
      if (!(p > 0)) { A.toast(T('badValue')); return; }
      if (s && (side > 0 ? s >= p : s <= p)) { A.toast(T('badSL')); return; }
      if (t && (side > 0 ? t <= p : t >= p)) { A.toast(T('badTP')); return; }
      if (type === 'market') { if (!acct.open(side, price, nowBar(cell), { sl: s, tp: t })) { A.toast(T('sameSide')); return; } acct.mark(nowBar(cell), price); }
      else {
        if (type === 'limit' && (side > 0 ? p >= price : p <= price)) { A.toast(T('badLimit')); return; }
        if (type === 'stop' && (side > 0 ? p <= price : p >= price)) { A.toast(T('badStop')); return; }
        acct.order({ side: side, type: type, price: p, sl: s, tp: t, t: nowBar(cell) });
      }
      A.closeModal(); if (after) after();
    };
    A.modal(T('newOrder'), f);
  }
  function editStops(cell, acct, after) {
    var q = acct.pos; if (!q) return;
    var f = h('<form class="pm-iset"></form>');
    var sl = field(f, T('of_sl'), 'sl', q.sl ? +(+q.sl).toPrecision(8) : ''), tp = field(f, T('of_tp'), 'tp', q.tp ? +(+q.tp).toPrecision(8) : '');
    f.appendChild(h('<div class="pm-row"><button class="pm-btn pri" type="submit">' + esc(T('apply')) + '</button></div>'));
    f.onsubmit = function (e) {
      e.preventDefault(); var p = acct.px || q.entry, s = +sl.value || null, t = +tp.value || null;
      if (s && (q.side > 0 ? s >= p : s <= p)) { A.toast(T('badSL')); return; }
      if (t && (q.side > 0 ? t <= p : t >= p)) { A.toast(T('badTP')); return; }
      if (s !== q.sl) q.trailed = false;
      q.sl = s; q.tp = t; A.closeModal(); if (after) after();
    };
    A.modal(T('slTp'), f);
  }
  /* the replay's clock as a bar of the chart's timeframe */
  function nowBar(cell) { var R = cell.replay; return R.sub && R.k >= 0 ? P.bucket(R.sub[R.k].t, P.parseTF(cell.cfg.tf)) : cell.bars[R.i].t; }
  function nowPrice(cell) { var R = cell.replay; return R.sub && R.k >= 0 && R.part ? R.part.c : cell.bars[R.i].c; }

  /* ================================================================ strategies */
  function ok(v) { return v != null && isFinite(v); }
  function zeros(n) { return new Array(n).fill(0); }
  function ind(id, C, q) { return P.ind.compute(id, C, q); }
  function cross(a, b) {
    var o = zeros(a.length);
    for (var i = 1; i < a.length; i++) { if (!ok(a[i]) || !ok(b[i]) || !ok(a[i - 1]) || !ok(b[i - 1])) continue; if (a[i - 1] <= b[i - 1] && a[i] > b[i]) o[i] = 1; else if (a[i - 1] >= b[i - 1] && a[i] < b[i]) o[i] = -1; }
    return o;
  }
  var FLOAT = { mult: 1, start: 1, inc: 1, max: 1 };
  /* sig(bars, params, ctx) → signals at each bar's close: 1 long, −1 short; or { e: those, x: exits } (x: 1 leaves a long, −1 a short) */
  var STRATS = {
    macross: { p: { fast: 9, slow: 21 }, sig: function (C, q) { return cross(ind('ema', C, { len: q.fast }).v, ind('ema', C, { len: q.slow }).v); } },
    smacross: { p: { fast: 50, slow: 200 }, sig: function (C, q) { return cross(ind('sma', C, { len: q.fast }).v, ind('sma', C, { len: q.slow }).v); } },
    macd: { p: { fast: 12, slow: 26, sig: 9 }, sig: function (C, q) { var m = ind('macd', C, q); return cross(m.macd, m.signal); } },
    rsi: { p: { len: 14, lo: 30, hi: 70 }, sig: function (C, q) {
      var r = ind('rsi', C, { len: q.len }).v, o = zeros(C.length);
      for (var i = 1; i < C.length; i++) { if (!ok(r[i]) || !ok(r[i - 1])) continue; if (r[i - 1] < q.lo && r[i] >= q.lo) o[i] = 1; else if (r[i - 1] > q.hi && r[i] <= q.hi) o[i] = -1; }
      return o;
    } },
    bb: { p: { len: 20, mult: 2 }, sig: function (C, q) {
      var b = ind('bb', C, { len: q.len, mult: q.mult }), o = zeros(C.length);
      for (var i = 1; i < C.length; i++) {
        if (!ok(b.lo[i]) || !ok(b.lo[i - 1])) continue;
        var c = C[i].c, c0 = C[i - 1].c;
        if (c0 < b.lo[i - 1] && c >= b.lo[i]) o[i] = 1; else if (c0 > b.up[i - 1] && c <= b.up[i]) o[i] = -1;     /* back inside the bands */
      }
      return o;
    } },
    st: { p: { atr: 10, mult: 3 }, sig: function (C, q) {
      var dir = ind('st', C, { len: q.atr, mult: q.mult }).dir, o = zeros(C.length);
      if (!dir) return o;
      for (var i = 1; i < C.length; i++) if (ok(dir[i]) && ok(dir[i - 1]) && dir[i] !== dir[i - 1]) o[i] = dir[i] < 0 ? 1 : -1;   /* dir < 0: the line is under the price */
      return o;
    } },
    psar: { p: { start: 0.02, inc: 0.02, max: 0.2 }, sig: function (C, q) {
      var s = ind('psar', C, q).sar, o = zeros(C.length);
      for (var i = 1; i < C.length; i++) { if (!ok(s[i]) || !ok(s[i - 1])) continue; var a = C[i].c > s[i], b = C[i - 1].c > s[i - 1]; if (a && !b) o[i] = 1; else if (!a && b) o[i] = -1; }
      return o;
    } },
    donch: { p: { len: 20, exit: 10 }, sig: function (C, q) {                 /* the turtles: a breakout enters, a shorter channel exits */
      var H = C.map(function (b) { return b.h; }), L = C.map(function (b) { return b.l; });
      var hiE = P.ind.highest(H, q.len), loE = P.ind.lowest(L, q.len), hiX = P.ind.highest(H, q.exit), loX = P.ind.lowest(L, q.exit), e = zeros(C.length), x = zeros(C.length);
      for (var i = 1; i < C.length; i++) {
        var c = C[i].c;
        if (ok(hiE[i - 1])) { if (c > hiE[i - 1]) e[i] = 1; else if (c < loE[i - 1]) e[i] = -1; }
        if (ok(loX[i - 1]) && c < loX[i - 1]) x[i] = 1; else if (ok(hiX[i - 1]) && c > hiX[i - 1]) x[i] = -1;
      }
      return { e: e, x: x };
    } },
    ek: { p: {}, btc: true, sig: function (C, q, ctx) {                       /* the published Kurdistani signals, acted on once their daily bar has closed */
      var o = zeros(C.length), S = ctx && ctx.sigs || [];
      S.forEach(function (s) {
        if (s.side !== 'long' && s.side !== 'short') return;
        var t = Math.floor(Date.parse(s.t) / 1000), tf = P.parseTF(String(s.tf || '1d').toLowerCase()); if (!isFinite(t)) return;
        var at = t + (tf ? tf.sec : 86400), lo = 0, hi = C.length - 1, r = -1;
        while (lo <= hi) { var m = (lo + hi) >> 1; if (C[m].t >= at) { r = m; hi = m - 1; } else lo = m + 1; }
        if (r >= 1) o[r - 1] = s.side === 'long' ? 1 : -1;
      });
      return o;
    } }
  };
  /* signals at a bar's close are filled at the next bar's open; stops, targets and liquidation act inside each bar */
  function runStrategy(sym, bars, id, q, cfg, ctx) {
    var S = STRATS[id], acct = new Account(cfg, sym), r = S.sig(bars, q, ctx || {}), sig = r.e || r, ex = r.x || null, dir = acct.cfg.dir, pend = 0, pex = 0;
    var act = function (a, b) {
      if (pex && a.pos && a.pos.side === pex) a.close(b.o, b.t, 'sig');
      if (pend) {
        if (pend > 0 && dir !== 'short') a.open(1, b.o, b.t);
        else if (pend < 0 && dir !== 'long') a.open(-1, b.o, b.t);
        else if (a.pos && a.pos.side !== pend) a.close(b.o, b.t, 'sig');       /* one direction only: the other signal closes */
      }
      pend = pex = 0;
    };
    for (var i = 0; i < bars.length; i++) {
      acct.onBar(bars[i], pend || pex ? act : null);
      if (sig[i]) pend = sig[i];
      if (ex && ex[i]) pex = ex[i];
    }
    return acct;
  }
  function label(id, q) { var k = Object.keys(q || {}); return T('sg_' + id) + (k.length ? ' (' + k.map(function (x) { return q[x]; }).join(', ') + ')' : ''); }
  function baseOf(sym) { return String(sym).replace(/_IRT$/, ''); }
  var SIGS = null;
  function sigsFor(sym) {
    if (baseOf(sym) !== 'BTC') return Promise.resolve([]);
    if (!SIGS) SIGS = P.getJSON('/data/signals.json?v=' + Math.floor(Date.now() / 6e5)).then(function (j) { return (j && j.signals || []).filter(function (s) { return s.sym === 'BTCUSDT'; }); }, function () { SIGS = null; return []; });
    return SIGS;
  }

  /* ================================================================ more history than the chart holds */
  function older(sym, tfId, firstT, n) {
    var tf = P.parseTF(tfId); if (!tf || n <= 0) return Promise.resolve([]);
    var nat = (P.NATIVE && P.NATIVE[tf.base]) || tf.sec, ratio = Math.max(1, Math.round(tf.sec / nat)), out = [], end = firstT * 1000 - 1, rounds = 0;
    function step(left) {
      if (left <= 0 || end <= 0 || rounds++ > 12) return Promise.resolve(out);
      var start = Math.max(0, end - Math.min(8000, left * ratio + ratio) * nat * 1000);
      return P.history(sym, tfId, start, end).then(function (rows) {
        var lim = out.length ? out[0].t : firstT;
        rows = rows.filter(function (b) { return b.t < lim; });
        if (ratio > 1 && start > 0 && rows.length > 1) rows = rows.slice(1);    /* the oldest bucket may be cut by the window */
        if (!rows.length) return out;
        out = rows.concat(out); end = rows[0].t * 1000 - 1;
        return start <= 0 ? out : step(left - rows.length);
      });
    }
    return step(n).then(function (r) { return r.slice(Math.max(0, r.length - n)); });
  }
  function barsFor(cell, want) {
    var src = cell.replay ? cell.bars.slice(0, cell.replay.i + 1) : cell.bars.slice();
    if (!want || want <= src.length || !src.length) return Promise.resolve(src);
    var key = cell.cfg.sym + '|' + cell.cfg.tf + '|' + src[0].t + '|' + want, H = cell._btHist;
    if (H && H.key === key) return Promise.resolve(H.bars.concat(src));
    return older(cell.cfg.sym, cell.cfg.tf, src[0].t, want - src.length).then(function (add) { cell._btHist = { key: key, bars: add }; return add.concat(src); });
  }

  /* ================================================================ the optimizer */
  function grid(ranges) {                                                   /* every combination; null when there are too many */
    var keys = Object.keys(ranges), vals = keys.map(function (k) {
      var r = ranges[k], out = [];
      if (!(r.step > 0) || r.to < r.from) return [r.from];
      for (var v = r.from, n = 0; v <= r.to + r.step * 1e-9 && n < 200; v += r.step, n++) out.push(FLOAT[k] ? +v.toFixed(6) : Math.round(v));
      return out.filter(function (x, i) { return out.indexOf(x) === i; });
    });
    var combos = [{}];
    keys.forEach(function (k, j) { var nx = []; combos.forEach(function (c) { vals[j].forEach(function (v) { var o = Object.assign({}, c); o[k] = v; nx.push(o); }); }); combos = nx; });
    return combos.filter(valid);
  }
  function valid(q) { return !(q.fast && q.slow && q.fast >= q.slow) && !(q.lo != null && q.hi != null && q.lo >= q.hi) && !(q.exit && q.len && q.exit > q.len) && Object.keys(q).every(function (k) { return q[k] > 0; }); }
  var METRIC = { net: function (s) { return s.netPct; }, pf: function (s) { return s.pf === Infinity ? 1e9 : s.pf; }, sharpe: function (s) { return s.sharpe; }, win: function (s) { return s.win; }, dd: function (s) { return -s.ddPct; } };
  function optimize(sym, bars, id, combos, cfg, ctx, sec, prog) {
    return new Promise(function (res) {
      var out = [], i = 0, t0 = Date.now();
      (function chunk() {
        var until = Date.now() + 40;
        while (i < combos.length && Date.now() < until) { var a = runStrategy(sym, bars, id, combos[i], cfg, ctx); out.push({ q: combos[i], s: stats(a, bars, sec) }); i++; }
        if (prog && prog(i, combos.length) === false) return res(null);
        if (i < combos.length) setTimeout(chunk, 0); else res({ rows: out, ms: Date.now() - t0 });
      })();
    });
  }

  /* ================================================================ the tester dialog */
  var LENS = [0, 2000, 5000, 10000, 20000];
  function testerDialog(cell, preset) {
    var have = cell.replay ? cell.replay.i + 1 : cell.bars.length;
    if (have < 60) { A.toast(T('needMore')); return; }
    var sym = cell.cfg.sym, last = P.store.get('ek_pro_btst', {}) || {}, mode = (preset && preset.mode) || last.mode || 'run';
    var ids = Object.keys(STRATS).filter(function (k) { return !STRATS[k].btc || baseOf(sym) === 'BTC'; });
    var f = h('<form class="pm-iset pm-btf"><div class="pm-seg pm-btmode"><button type="button" data-m="run"></button><button type="button" data-m="opt"></button></div>' +
      '<label class="pm-field"><span></span><select class="pm-in" name="st"></select></label><div class="pm-btp"></div>' +
      '<label class="pm-field"><span></span><select class="pm-in" name="len"></select></label>' +
      '<label class="pm-field pm-btrank"><span></span><select class="pm-in" name="rank"></select></label><p class="pm-note pm-btacc"></p><p class="pm-note pm-btcnt"></p></form>');
    $('[data-m="run"]', f).textContent = T('btModeRun'); $('[data-m="opt"]', f).textContent = T('btModeOpt');
    var sel = $('[name="st"]', f), lenSel = $('[name="len"]', f), rank = $('[name="rank"]', f);
    sel.previousElementSibling.textContent = T('strategy'); lenSel.previousElementSibling.textContent = T('btHist'); rank.previousElementSibling.textContent = T('btRankBy');
    ids.forEach(function (k) { sel.appendChild(new Option(T('sg_' + k), k)); });
    if (ids.indexOf(last.id) >= 0) sel.value = last.id;
    LENS.forEach(function (n) { if (n && n <= have) return; lenSel.appendChild(new Option(n ? T('btHistN', { n: A.loc(n) }) : T('btHistChart', { n: A.loc(have) }), String(n))); });
    if (last.len && $('option[value="' + last.len + '"]', lenSel)) lenSel.value = String(last.len);
    ['net', 'pf', 'sharpe', 'win', 'dd'].forEach(function (k) { rank.appendChild(new Option(T('rk_' + k), k)); }); if (METRIC[last.rank]) rank.value = last.rank;
    var box = $('.pm-btp', f), cnt = $('.pm-btcnt', f);
    function qOf(id) { return (last.id === id && last.q) || STRATS[id].p; }
    function rOf(id, k) {
      var r = last.id === id && last.r && last.r[k], v = STRATS[id].p[k];
      if (r) return r;
      if (FLOAT[k]) return { from: +(v / 2).toPrecision(2), to: +(v * 2).toPrecision(2), step: +(v / 4).toPrecision(2) };
      var lo = Math.max(2, Math.round(v / 2)), hi = Math.max(lo + 2, Math.round(v * 2));
      if (k === 'lo') { lo = 15; hi = 40; } if (k === 'hi') { lo = 60; hi = 85; }
      return { from: lo, to: hi, step: Math.max(1, Math.round((hi - lo) / 8)) };
    }
    function params() {
      var id = sel.value, ks = Object.keys(STRATS[id].p); box.innerHTML = '';
      ks.forEach(function (k) {
        if (mode === 'run') { field(box, T('p_' + k), k, qOf(id)[k]); return; }
        var r = rOf(id, k), row = h('<div class="pm-field pm-btrng"><span></span><div><input class="pm-in" type="number" step="any" data-r="from"><input class="pm-in" type="number" step="any" data-r="to"><input class="pm-in" type="number" step="any" data-r="step"></div></div>');
        $('span', row).textContent = T('p_' + k) + ' — ' + T('btRange');
        ['from', 'to', 'step'].forEach(function (x) { var i = $('[data-r="' + x + '"]', row); i.value = r[x]; i.title = T('rg_' + x); i.placeholder = T('rg_' + x); i.setAttribute('aria-label', T('p_' + k) + ' ' + T('rg_' + x)); i.oninput = count; });
        row.setAttribute('data-k', k); box.appendChild(row);
      });
      if (!ks.length) { var p = h('<p class="pm-note"></p>'); p.textContent = T('btNoParams'); box.appendChild(p); }
      var dsc = h('<p class="pm-note"></p>'); dsc.textContent = T('sgd_' + id); box.appendChild(dsc);
      $('.pm-btrank', f).hidden = mode !== 'opt'; count();
      $$('[data-m]', f).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-m') === mode); });
      $('[type="submit"]', f).textContent = T({ opt: 'optRun', run: 'runTest' }[mode]);
    }
    function ranges() { var o = {}; $$('.pm-btrng', box).forEach(function (row) { var r = {}; ['from', 'to', 'step'].forEach(function (x) { r[x] = +$('[data-r="' + x + '"]', row).value; }); o[row.getAttribute('data-k')] = r; }); return o; }
    function cap() { var n = +lenSel.value || have; return Math.max(20, Math.min(1500, Math.floor(6e6 / Math.max(n, 1)))); }
    function count() {
      if (mode !== 'opt') { cnt.textContent = ''; return; }
      var n = grid(ranges()).length; cnt.textContent = T('optN', { n: A.loc(n), m: A.loc(cap()) }); cnt.classList.toggle('dn', n > cap() || !n);
    }
    var acc = $('.pm-btacc', f);
    acc.textContent = T('btAccLine', { b: money(forSym(sym).bal, sym), q: quote(sym), s: CFG.size, l: CFG.lev, f: CFG.fee, d: T('dir_' + CFG.dir) }) + ' ' + T('btFillLine');
    f.appendChild(h('<div class="pm-row"><button class="pm-btn pri" type="submit"></button><button class="pm-btn" type="button" data-a="set">' + esc(T('btSettings')) + '</button>' + (cell.btMarks && !cell.replay ? '<button class="pm-btn" type="button" data-a="clr">' + esc(T('clearMarks')) + '</button>' : '') + '</div>'));
    $$('[data-m]', f).forEach(function (b) { b.onclick = function () { mode = b.getAttribute('data-m'); params(); }; });
    sel.onchange = params; lenSel.onchange = count; params();
    $('[data-a="set"]', f).onclick = function () { A.closeModal(); settings(cell, function () { testerDialog(cell, { mode: mode }); }); };
    if ($('[data-a="clr"]', f)) $('[data-a="clr"]', f).onclick = function () { cell.btMarks = null; cell.marks(); A.closeModal(); };
    f.onsubmit = function (e) {
      e.preventDefault();
      var id = sel.value, want = +lenSel.value || 0, keep = { id: id, mode: mode, len: want, rank: rank.value, q: last.q, r: last.r };
      var go = $('[type="submit"]', f); go.disabled = true;
      if (mode === 'run') {
        var q = {};
        Object.keys(STRATS[id].p).forEach(function (k) { var v = +$('[name="' + k + '"]', box).value; q[k] = isFinite(v) && v > 0 ? v : STRATS[id].p[k]; });
        if (!valid(q) && Object.keys(q).length) { go.disabled = false; A.toast(T('badParams')); return; }
        keep.q = q;
      } else {
        var rg = ranges(), combos = grid(rg);
        if (!combos.length) { go.disabled = false; A.toast(T('badParams')); return; }
        if (combos.length > cap()) { go.disabled = false; A.toast(T('optMax', { n: A.loc(cap()) })); return; }
        keep.r = rg;
      }
      P.store.set('ek_pro_btst', keep); last = keep;
      cnt.classList.remove('dn'); cnt.textContent = T('loading');
      Promise.all([barsFor(cell, want), STRATS[id].btc ? sigsFor(sym) : Promise.resolve([])]).then(function (r) {
        var bars = r[0], ctx = { sigs: r[1] }, cfg = forSym(sym);
        if (bars.length < 60) { go.disabled = false; A.toast(T('needMore')); return; }
        if (STRATS[id].btc && !ctx.sigs.length) { go.disabled = false; A.toast(T('netErr')); return; }
        if (mode === 'run') { A.closeModal(); show(cell, sym, bars, id, keep.q, cfg, ctx, null); return; }
        optimize(sym, bars, id, combos, cfg, ctx, cell.tfSec(), function (i, n) { if (!f.isConnected) return false; cnt.textContent = T('optProg', { i: A.loc(i), n: A.loc(n) }); }).then(function (res) {
          if (!res) return;
          A.closeModal(); results(cell, sym, bars, id, cfg, ctx, res, keep.rank);
        });
      }, function () { go.disabled = false; cnt.textContent = ''; A.toast(T('netErr')); });
    };
    A.modal(T('tester'), f);
  }
  function show(cell, sym, bars, id, q, cfg, ctx, back) {
    var acct = runStrategy(sym, bars, id, q, cfg, ctx);
    if (!cell.replay) { cell.btMarks = marksOf(acct); cell.marks(); }
    report(cell, acct, { bars: bars, title: label(id, q), back: back });
  }
  function results(cell, sym, bars, id, cfg, ctx, res, by) {
    var M = METRIC[by] || METRIC.net, rows = res.rows.slice();
    rows.sort(function (a, b) { var ea = a.s.n >= 3, eb = b.s.n >= 3; if (ea !== eb) return ea ? -1 : 1; return M(b.s) - M(a.s); });
    var ks = Object.keys(STRATS[id].p), top = rows.slice(0, 40);
    var tb = '<table class="pm-tbl pm-btt pm-opt" dir="ltr"><tr><th>#</th>' + ks.map(function (k) { return '<th>' + esc(T('p_' + k)) + '</th>'; }).join('') +
      '<th>' + esc(T('btNetPct')) + '</th><th>' + esc(T('btTrades')) + '</th><th>' + esc(T('btWin')) + '</th><th>' + esc(T('btPF')) + '</th><th>' + esc(T('btDD')) + '</th><th>' + esc(T('btSharpe')) + '</th></tr>' +
      top.map(function (r, j) {
        var s = r.s;
        return '<tr data-j="' + j + '" tabindex="0"><td>' + (j + 1) + '</td>' + ks.map(function (k) { return '<td class="pm-num">' + r.q[k] + '</td>'; }).join('') +
          '<td class="pm-num ' + (s.netPct >= 0 ? 'up' : 'dn') + '">' + pct(s.netPct) + '</td><td class="pm-num">' + s.n + '</td><td class="pm-num">' + s.win.toFixed(1) + '%</td><td class="pm-num">' + (s.pf === Infinity ? '∞' : s.pf.toFixed(2)) +
          '</td><td class="pm-num dn">' + s.ddPct.toFixed(1) + '%</td><td class="pm-num">' + s.sharpe.toFixed(2) + '</td></tr>';
      }).join('') + '</table>';
    var pos = res.rows.filter(function (r) { return r.s.netPct > 0; }).length;
    var f = h('<div class="pm-btr"><div class="pm-bth"><b>' + esc(T('sg_' + id)) + '</b><span>' + esc(P.pair(sym)) + ' · ' + esc(A.tfLabel(cell.cfg.tf)) + ' · ' + esc(T('btBarsN', { n: A.loc(bars.length) })) + '</span></div>' +
      '<p class="pm-note">' + esc(T('optDone', { n: A.loc(res.rows.length), p: A.loc(pos), s: (res.ms / 1000).toFixed(1), r: T('rk_' + by) })) + '</p>' +
      '<div class="pm-tw">' + tb + '</div><p class="pm-note">' + esc(T('optNote')) + '</p></div>');
    $$('tr[data-j]', f).forEach(function (tr) {
      var go = function () { var r = top[+tr.getAttribute('data-j')]; A.closeModal(); show(cell, sym, bars, id, r.q, cfg, ctx, function () { results(cell, sym, bars, id, cfg, ctx, res, by); }); };
      tr.onclick = go; tr.onkeydown = function (e) { if (e.key === 'Enter') go(); };
    });
    A.modal(T('optTitle'), f, { wide: true, nofocus: true });
  }

  /* ================================================================ wiring into the replay bar and the toolbar */
  P.btStats = stats; P.btRun = runStrategy; P.Account = Account; P.btStrats = STRATS; P.btGrid = grid; P.btOlder = older;
  P.bt = {
    cfg: function () { return CFG; },
    newAccount: function (sym) { return new Account(forSym(sym), sym); },
    onBar: function (cell, b) {
      var R = cell.replay; if (!R || !R.acct) return;
      var ev = R.acct.onBar(b);
      ev.forEach(function (x) {
        if (x.kind === 'fill') A.toast('✅ ' + T('filled', { s: T(x.o.side > 0 ? 'buy' : 'sell') + ' ' + T('ot_' + x.o.type), p: cell.fmt(x.price) }));
        if (x.kind === 'skip') A.toast(T('skipped', { s: T(x.o.side > 0 ? 'buy' : 'sell') }));
        if (x.kind === 'exit' && x.tr) A.toast((x.tr.pnl >= 0 ? '🟢 ' : '🔴 ') + T('why_' + x.tr.why) + ' · ' + money(x.tr.pnl, cell.cfg.sym) + ' (' + pct(x.tr.pct) + ')');
      });
      if (ev.length) P.bt.refresh(cell); else if (R.acct.pos && R.acct.pos.trailed) lines(cell, R.acct);
    },
    refresh: function (cell) { var R = cell.replay; cell.btMarks = R && R.acct ? marksOf(R.acct) : null; cell.marks(); lines(cell, R && R.acct); },
    clear: function (cell) { lines(cell, null); cell.btMarks = null; cell.marks(); },
    market: function (cell, side) {
      var R = cell.replay; if (!R || !R.acct) return;
      var p = nowPrice(cell), t = nowBar(cell);
      if (side === 0) R.acct.close(p, t, 'manual');
      else if (!R.acct.open(side, p, t)) { A.toast(T('sameSide')); return; }
      R.acct.px = p; R.acct.mark(t, p); P.bt.refresh(cell);
    },
    order: function (cell) { var R = cell.replay; if (!R || !R.acct) return; orderForm(cell, R.acct, nowPrice(cell), function () { P.bt.refresh(cell); A.emit('replay', cell); }); },
    stops: function (cell) { var R = cell.replay; if (!R || !R.acct) return; editStops(cell, R.acct, function () { P.bt.refresh(cell); A.emit('replay', cell); }); },
    cancelAll: function (cell) { var R = cell.replay; if (!R || !R.acct) return; R.acct.cancel(null); P.bt.refresh(cell); },
    report: function (cell) {
      var R = cell.replay; if (!R || !R.acct) return;
      report(cell, R.acct, { bars: cell.bars.slice(R.start || 0, R.i + 1), title: T('btReplay'), reset: function () { var a = P.bt.newAccount(cell.cfg.sym), b = cell.bars[R.i]; a.lastT = b.t; a.px = b.c; R.acct = a; P.bt.refresh(cell); A.emit('replay', cell); } });
    },
    settings: function (cell, after) { settings(cell, after); },
    tester: testerDialog,
    money: money, pct: pct
  };
})();
