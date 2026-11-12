/* entekhab.net — /market/ indicator maths. Pure functions over arrays; NaN where a value is not defined yet.
   Definitions follow TradingView's built-ins so the numbers match what traders see there:
   RMA (Wilder) and EMA are seeded with the SMA of their first `n` values; stdev is the population one (ta.stdev);
   RSI/ATR/ADX use RMA; Keltner uses an EMA of the true range; Ichimoku leads are drawn 25 bars ahead (26 − 1).
   Checked against an independent Python implementation in tests/test_pro_ind.py. */
(function (root) {
  'use strict';
  var N = NaN;
  function arr(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = N; return a; }
  function ok(x) { return x === x && x != null && isFinite(x); }

  function sma(x, n) {
    var o = arr(x.length), s = 0, c = 0;
    for (var i = 0; i < x.length; i++) {
      var v = x[i];
      if (!ok(v)) { s = 0; c = 0; continue; }
      s += v; c++;
      if (c > n) { s -= x[i - n]; c = n; }
      if (c === n) o[i] = s / n;
    }
    return o;
  }
  /* exponential averages seeded with the SMA of the first n defined values */
  function expAvg(x, n, alpha) {
    var o = arr(x.length), s = 0, c = 0, prev = N;
    for (var i = 0; i < x.length; i++) {
      var v = x[i];
      if (!ok(v)) { if (ok(prev)) o[i] = N; continue; }
      if (!ok(prev)) {
        s += v; c++;
        if (c === n) { prev = s / n; o[i] = prev; }
      } else { prev = alpha * v + (1 - alpha) * prev; o[i] = prev; }
    }
    return o;
  }
  function ema(x, n) { return expAvg(x, n, 2 / (n + 1)); }
  function rma(x, n) { return expAvg(x, n, 1 / n); }
  function wma(x, n) {
    var o = arr(x.length), d = n * (n + 1) / 2;
    for (var i = n - 1; i < x.length; i++) {
      var s = 0, good = true;
      for (var k = 0; k < n; k++) { var v = x[i - k]; if (!ok(v)) { good = false; break; } s += v * (n - k); }
      if (good) o[i] = s / d;
    }
    return o;
  }
  function stdev(x, n) {
    var o = arr(x.length), m = sma(x, n);
    for (var i = n - 1; i < x.length; i++) {
      if (!ok(m[i])) continue;
      var s = 0; for (var k = 0; k < n; k++) { var dv = x[i - k] - m[i]; s += dv * dv; }
      o[i] = Math.sqrt(s / n);
    }
    return o;
  }
  function highest(x, n) {
    var o = arr(x.length);
    for (var i = n - 1; i < x.length; i++) { var m = -Infinity; for (var k = 0; k < n; k++) if (x[i - k] > m) m = x[i - k]; o[i] = m; }
    return o;
  }
  function lowest(x, n) {
    var o = arr(x.length);
    for (var i = n - 1; i < x.length; i++) { var m = Infinity; for (var k = 0; k < n; k++) if (x[i - k] < m) m = x[i - k]; o[i] = m; }
    return o;
  }
  function tr(h, l, c) {
    var o = arr(h.length);
    for (var i = 0; i < h.length; i++) o[i] = i === 0 ? h[i] - l[i] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
    return o;
  }
  function atr(h, l, c, n) { return rma(tr(h, l, c), n); }
  function change(x) { var o = arr(x.length); for (var i = 1; i < x.length; i++) o[i] = x[i] - x[i - 1]; return o; }

  function rsi(c, n) {
    var ch = change(c), up = arr(c.length), dn = arr(c.length);
    for (var i = 1; i < c.length; i++) { up[i] = Math.max(ch[i], 0); dn[i] = Math.max(-ch[i], 0); }
    var ru = rma(up, n), rd = rma(dn, n), o = arr(c.length);
    for (i = 0; i < c.length; i++) if (ok(ru[i]) && ok(rd[i])) o[i] = rd[i] === 0 ? 100 : ru[i] === 0 ? 0 : 100 - 100 / (1 + ru[i] / rd[i]);
    return o;
  }
  function macd(c, f, s, sig) {
    var a = ema(c, f), b = ema(c, s), m = arr(c.length);
    for (var i = 0; i < c.length; i++) if (ok(a[i]) && ok(b[i])) m[i] = a[i] - b[i];
    var sg = ema(m, sig), hs = arr(c.length);
    for (i = 0; i < c.length; i++) if (ok(m[i]) && ok(sg[i])) hs[i] = m[i] - sg[i];
    return { macd: m, signal: sg, hist: hs };
  }
  function bb(c, n, k) {
    var m = sma(c, n), d = stdev(c, n), up = arr(c.length), lo = arr(c.length);
    for (var i = 0; i < c.length; i++) if (ok(m[i])) { up[i] = m[i] + k * d[i]; lo[i] = m[i] - k * d[i]; }
    return { mid: m, up: up, lo: lo };
  }
  function stochRaw(src, h, l, n) {
    var hh = highest(h, n), ll = lowest(l, n), o = arr(src.length);
    for (var i = 0; i < src.length; i++) if (ok(hh[i]) && ok(ll[i]) && ok(src[i]) && hh[i] !== ll[i]) o[i] = 100 * (src[i] - ll[i]) / (hh[i] - ll[i]);
    return o;
  }
  /* highest/lowest that skip leading NaNs (for stoch of RSI) */
  function stochSeries(x, n) {
    var o = arr(x.length);
    for (var i = n - 1; i < x.length; i++) {
      var hi = -Infinity, lo = Infinity, good = true;
      for (var k = 0; k < n; k++) { var v = x[i - k]; if (!ok(v)) { good = false; break; } if (v > hi) hi = v; if (v < lo) lo = v; }
      if (good && hi !== lo) o[i] = 100 * (x[i] - lo) / (hi - lo);
    }
    return o;
  }
  function stoch(h, l, c, n, sk, sd) {
    var k = sma(stochRaw(c, h, l, n), sk);
    return { k: k, d: sma(k, sd) };
  }
  function stochRsi(c, rn, sn, sk, sd) {
    var r = rsi(c, rn), k = sma(stochSeries(r, sn), sk);
    return { k: k, d: sma(k, sd) };
  }
  function cci(h, l, c, n) {
    var tp = arr(c.length); for (var i = 0; i < c.length; i++) tp[i] = (h[i] + l[i] + c[i]) / 3;
    var o = arr(c.length);
    for (i = n - 1; i < c.length; i++) {
      var m = 0, k; for (k = 0; k < n; k++) m += tp[i - k]; m /= n;     /* the window's own mean: no running-sum drift */
      var md = 0; for (k = 0; k < n; k++) md += Math.abs(tp[i - k] - m); md /= n;
      if (md > 1e-12 * Math.max(1, Math.abs(m))) o[i] = (tp[i] - m) / (0.015 * md);
    }
    return o;
  }
  function mfi(h, l, c, v, n) {
    var tp = arr(c.length), o = arr(c.length);
    for (var i = 0; i < c.length; i++) tp[i] = (h[i] + l[i] + c[i]) / 3;
    for (i = n; i < c.length; i++) {
      var pos = 0, neg = 0;
      for (var k = 0; k < n; k++) { var j = i - k, mf = tp[j] * v[j]; if (tp[j] > tp[j - 1]) pos += mf; else if (tp[j] < tp[j - 1]) neg += mf; }
      if (neg !== 0) o[i] = 100 - 100 / (1 + pos / neg); else if (pos !== 0) o[i] = 100;
    }
    return o;
  }
  function willr(h, l, c, n) {
    var hh = highest(h, n), ll = lowest(l, n), o = arr(c.length);
    for (var i = 0; i < c.length; i++) if (ok(hh[i]) && hh[i] !== ll[i]) o[i] = 100 * (c[i] - hh[i]) / (hh[i] - ll[i]);
    return o;
  }
  function obv(c, v) {
    var o = arr(c.length), s = 0;
    for (var i = 0; i < c.length; i++) { if (i > 0) s += c[i] > c[i - 1] ? v[i] : c[i] < c[i - 1] ? -v[i] : 0; o[i] = s; }
    return o;
  }
  function roc(c, n) { var o = arr(c.length); for (var i = n; i < c.length; i++) if (c[i - n]) o[i] = 100 * (c[i] - c[i - n]) / c[i - n]; return o; }
  function adx(h, l, c, n, sm) {
    var len = c.length, pdm = arr(len), mdm = arr(len);
    for (var i = 1; i < len; i++) {
      var up = h[i] - h[i - 1], dn = l[i - 1] - l[i];
      pdm[i] = up > dn && up > 0 ? up : 0; mdm[i] = dn > up && dn > 0 ? dn : 0;
    }
    var t = tr(h, l, c); t[0] = N;                      /* first bar has no previous close: start with bar 1 like ta.dmi */
    var tru = rma(t, n), pr = rma(pdm, n), mr = rma(mdm, n), pdi = arr(len), mdi = arr(len), dx = arr(len);
    for (i = 0; i < len; i++) if (ok(tru[i]) && ok(pr[i]) && ok(mr[i]) && tru[i] !== 0) {
      pdi[i] = 100 * pr[i] / tru[i]; mdi[i] = 100 * mr[i] / tru[i];
      var s = pdi[i] + mdi[i]; dx[i] = Math.abs(pdi[i] - mdi[i]) / (s === 0 ? 1 : s);
    }
    var a = rma(dx, sm || n); for (i = 0; i < len; i++) if (ok(a[i])) a[i] *= 100;
    return { adx: a, pdi: pdi, mdi: mdi };
  }
  /* ta.sar — a line-by-line port of TradingView's reference implementation (pine_sar in the Pine manual) */
  function psar(h, l, c, start, inc, max) {
    var len = h.length, o = arr(len), dir = arr(len), res = N, mm = N, acc = N, below = false;
    for (var i = 1; i < len; i++) {
      var first = false;
      if (i === 1) {
        if (c[1] > c[0]) { below = true; mm = h[1]; res = l[0]; } else { below = false; mm = l[1]; res = h[0]; }
        first = true; acc = start;
      }
      res = res + acc * (mm - res);
      if (below) { if (res > l[i]) { first = true; below = false; res = Math.max(h[i], mm); mm = l[i]; acc = start; } }
      else if (res < h[i]) { first = true; below = true; res = Math.min(l[i], mm); mm = h[i]; acc = start; }
      if (!first) {
        if (below) { if (h[i] > mm) { mm = h[i]; acc = Math.min(acc + inc, max); } }
        else if (l[i] < mm) { mm = l[i]; acc = Math.min(acc + inc, max); }
      }
      if (below) { res = Math.min(res, l[i - 1]); if (i > 1) res = Math.min(res, l[i - 2]); }
      else { res = Math.max(res, h[i - 1]); if (i > 1) res = Math.max(res, h[i - 2]); }
      o[i] = res; dir[i] = below ? 1 : -1;
    }
    return { sar: o, dir: dir };
  }
  /* ta.supertrend(factor, atrPeriod): dir −1 = up-trend (line under price), +1 = down-trend */
  function supertrend(h, l, c, n, f) {
    var len = c.length, a = atr(h, l, c, n), st = arr(len), dir = arr(len), pu = N, pl = N, pst = N;
    for (var i = 0; i < len; i++) {
      if (!ok(a[i])) continue;
      var src = (h[i] + l[i]) / 2, ub = src + f * a[i], lb = src - f * a[i];
      if (ok(pl)) lb = (lb > pl || c[i - 1] < pl) ? lb : pl;
      if (ok(pu)) ub = (ub < pu || c[i - 1] > pu) ? ub : pu;
      var d;
      if (!ok(a[i - 1])) d = 1;
      else if (pst === pu) d = c[i] > ub ? -1 : 1;
      else d = c[i] < lb ? 1 : -1;
      st[i] = d === -1 ? lb : ub; dir[i] = d;
      pu = ub; pl = lb; pst = st[i];
    }
    return { line: st, dir: dir };
  }
  function donchian(h, l, n) {
    var up = highest(h, n), lo = lowest(l, n), mid = arr(h.length);
    for (var i = 0; i < h.length; i++) if (ok(up[i])) mid[i] = (up[i] + lo[i]) / 2;
    return { up: up, lo: lo, mid: mid };
  }
  /* TradingView's Keltner Channels defaults: EMA basis, bands = basis ± mult × ATR(atrLen) */
  function keltner(h, l, c, n, mult, atrLen) {
    var m = ema(c, n), r = atr(h, l, c, atrLen), up = arr(c.length), lo = arr(c.length);
    for (var i = 0; i < c.length; i++) if (ok(m[i]) && ok(r[i])) { up[i] = m[i] + mult * r[i]; lo[i] = m[i] - mult * r[i]; }
    return { mid: m, up: up, lo: lo };
  }
  function midHL(h, l, n) { var a = highest(h, n), b = lowest(l, n), o = arr(h.length); for (var i = 0; i < h.length; i++) if (ok(a[i])) o[i] = (a[i] + b[i]) / 2; return o; }
  /* values at index i belong to bar i; leads must be drawn `disp − 1` bars to the right, lag `disp − 1` to the left */
  function ichimoku(h, l, c, cv, bs, sb) {
    var conv = midHL(h, l, cv), base = midHL(h, l, bs), a = arr(c.length);
    for (var i = 0; i < c.length; i++) if (ok(conv[i]) && ok(base[i])) a[i] = (conv[i] + base[i]) / 2;
    return { conv: conv, base: base, spanA: a, spanB: midHL(h, l, sb), lag: c.slice() };
  }
  /* session VWAP, the session = the UTC day (crypto trades 24/7; TradingView's default anchor) */
  function vwap(t, h, l, c, v) {
    var o = arr(c.length), pv = 0, vv = 0, day = null;
    for (var i = 0; i < c.length; i++) {
      var d = Math.floor(t[i] / 86400); if (d !== day) { day = d; pv = 0; vv = 0; }
      pv += (h[i] + l[i] + c[i]) / 3 * v[i]; vv += v[i]; o[i] = vv ? pv / vv : N;
    }
    return o;
  }
  function heikin(bars) {
    var o = [], po = N, pc = N;
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i], c = (b.o + b.h + b.l + b.c) / 4, op = i === 0 ? (b.o + b.c) / 2 : (po + pc) / 2;
      o.push({ t: b.t, o: op, h: Math.max(b.h, op, c), l: Math.min(b.l, op, c), c: c, v: b.v });
      po = op; pc = c;
    }
    return o;
  }

  var M = { sma: sma, ema: ema, rma: rma, wma: wma, stdev: stdev, highest: highest, lowest: lowest, tr: tr, atr: atr, rsi: rsi, macd: macd, bb: bb,
    stoch: stoch, stochRsi: stochRsi, cci: cci, mfi: mfi, willr: willr, obv: obv, roc: roc, adx: adx, psar: psar, supertrend: supertrend,
    donchian: donchian, keltner: keltner, ichimoku: ichimoku, vwap: vwap, heikin: heikin };

  /* ---- indicator catalogue: what each one draws. `pane: true` = own pane below the price.
     plots: [key, kind, colour] ; kind: line | hist | dots | step ; levels: dashed guide lines; band: [upper key, lower key] filled */
  var DEF = {
    vol: { pane: 'vol', p: { ma: 20 }, plots: [['vol', 'hist', ''], ['ma', 'line', '#8ab4f8']] },
    sma: { p: { len: 20 }, plots: [['v', 'line', '#f7931a']] },
    ema: { p: { len: 50 }, plots: [['v', 'line', '#38bdf8']] },
    wma: { p: { len: 20 }, plots: [['v', 'line', '#c084fc']] },
    bb: { p: { len: 20, mult: 2 }, plots: [['up', 'line', '#60a5fa'], ['mid', 'line', '#f59e0b'], ['lo', 'line', '#60a5fa']], band: ['up', 'lo', 'rgba(96,165,250,.08)'] },
    dc: { p: { len: 20 }, plots: [['up', 'line', '#22d3ee'], ['mid', 'line', '#fb923c'], ['lo', 'line', '#22d3ee']], band: ['up', 'lo', 'rgba(34,211,238,.06)'] },
    kc: { p: { len: 20, mult: 2, atr: 10 }, plots: [['up', 'line', '#a78bfa'], ['mid', 'line', '#f472b6'], ['lo', 'line', '#a78bfa']], band: ['up', 'lo', 'rgba(167,139,250,.07)'] },
    ichi: { p: { conv: 9, base: 26, span: 52, disp: 26 }, plots: [['conv', 'line', '#38bdf8'], ['base', 'line', '#f43f5e'], ['lag', 'line', '#a3e635'], ['spanA', 'line', '#34d399'], ['spanB', 'line', '#ff5a4d']], cloud: true },
    psar: { p: { start: 0.02, inc: 0.02, max: 0.2 }, plots: [['sar', 'dots', '#fbbf24']] },
    st: { p: { len: 10, mult: 3 }, plots: [['up', 'line', '#34d399'], ['dn', 'line', '#ff5a4d']] },
    vwap: { p: {}, plots: [['v', 'line', '#e879f9']] },
    rsi: { pane: true, p: { len: 14 }, plots: [['v', 'line', '#c084fc']], levels: [70, 50, 30], range: [0, 100] },
    macd: { pane: true, p: { fast: 12, slow: 26, sig: 9 }, plots: [['hist', 'hist', ''], ['macd', 'line', '#38bdf8'], ['signal', 'line', '#fb923c']], levels: [0] },
    stoch: { pane: true, p: { len: 14, k: 3, d: 3 }, plots: [['k', 'line', '#38bdf8'], ['d', 'line', '#fb923c']], levels: [80, 50, 20], range: [0, 100] },
    srsi: { pane: true, p: { rsi: 14, len: 14, k: 3, d: 3 }, plots: [['k', 'line', '#38bdf8'], ['d', 'line', '#fb923c']], levels: [80, 50, 20], range: [0, 100] },
    atr: { pane: true, p: { len: 14 }, plots: [['v', 'line', '#f87171']] },
    adx: { pane: true, p: { len: 14, smooth: 14 }, plots: [['adx', 'line', '#f43f5e'], ['pdi', 'line', '#34d399'], ['mdi', 'line', '#ff8a65']], levels: [25] },
    cci: { pane: true, p: { len: 20 }, plots: [['v', 'line', '#22d3ee']], levels: [100, 0, -100] },
    mfi: { pane: true, p: { len: 14 }, plots: [['v', 'line', '#a3e635']], levels: [80, 50, 20], range: [0, 100] },
    willr: { pane: true, p: { len: 14 }, plots: [['v', 'line', '#e879f9']], levels: [-20, -50, -80], range: [-100, 0] },
    obv: { pane: true, p: {}, plots: [['v', 'line', '#60a5fa']] },
    roc: { pane: true, p: { len: 9 }, plots: [['v', 'line', '#fbbf24']], levels: [0] }
  };
  var ORDER_OVER = ['sma', 'ema', 'wma', 'bb', 'dc', 'kc', 'ichi', 'psar', 'st', 'vwap'];
  var ORDER_PANE = ['vol', 'rsi', 'macd', 'stoch', 'srsi', 'atr', 'adx', 'cci', 'mfi', 'willr', 'obv', 'roc'];

  function cols(bars) {
    var n = bars.length, t = new Array(n), o = new Array(n), h = new Array(n), l = new Array(n), c = new Array(n), v = new Array(n);
    for (var i = 0; i < n; i++) { var b = bars[i]; t[i] = b.t; o[i] = b.o; h[i] = b.h; l[i] = b.l; c[i] = b.c; v[i] = b.v || 0; }
    return { t: t, o: o, h: h, l: l, c: c, v: v };
  }
  function int(x, d, lo, hi) { x = Math.round(+x); return isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; }
  function num(x, d, lo, hi) { x = +x; return isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; }
  /* clean user parameters (they come from storage and from shared links) */
  function params(id, p) {
    var d = DEF[id] && DEF[id].p, o = {}; if (!d) return o; p = p || {};
    for (var k in d) {
      var dv = d[k];
      o[k] = (dv % 1 !== 0) ? num(p[k], dv, 0.0001, 100) : (k === 'mult' ? num(p[k], dv, 0.1, 20) : int(p[k], dv, k === 'disp' ? 1 : 1, 500));
    }
    return o;
  }
  /* compute → { key: array } aligned with bars */
  function compute(id, bars, p) {
    var C = cols(bars), q = params(id, p), r;
    switch (id) {
      case 'vol': return { vol: C.v, ma: sma(C.v, q.ma) };
      case 'sma': return { v: sma(C.c, q.len) };
      case 'ema': return { v: ema(C.c, q.len) };
      case 'wma': return { v: wma(C.c, q.len) };
      case 'bb': return bb(C.c, q.len, q.mult);
      case 'dc': return donchian(C.h, C.l, q.len);
      case 'kc': return keltner(C.h, C.l, C.c, q.len, q.mult, q.atr);
      case 'ichi': return ichimoku(C.h, C.l, C.c, q.conv, q.base, q.span);
      case 'psar': return { sar: psar(C.h, C.l, C.c, q.start, q.inc, q.max).sar };
      case 'st': {
        r = supertrend(C.h, C.l, C.c, q.len, q.mult);
        var up = arr(C.c.length), dn = arr(C.c.length);
        for (var i = 0; i < C.c.length; i++) if (ok(r.line[i])) { if (r.dir[i] < 0) up[i] = r.line[i]; else dn[i] = r.line[i]; }
        return { up: up, dn: dn, dir: r.dir };
      }
      case 'vwap': return { v: vwap(C.t, C.h, C.l, C.c, C.v) };
      case 'rsi': return { v: rsi(C.c, q.len) };
      case 'macd': return macd(C.c, q.fast, q.slow, q.sig);
      case 'stoch': return stoch(C.h, C.l, C.c, q.len, q.k, q.d);
      case 'srsi': return stochRsi(C.c, q.rsi, q.len, q.k, q.d);
      case 'atr': return { v: atr(C.h, C.l, C.c, q.len) };
      case 'adx': return adx(C.h, C.l, C.c, q.len, q.smooth);
      case 'cci': return { v: cci(C.h, C.l, C.c, q.len) };
      case 'mfi': return { v: mfi(C.h, C.l, C.c, C.v, q.len) };
      case 'willr': return { v: willr(C.h, C.l, C.c, q.len) };
      case 'obv': return { v: obv(C.c, C.v) };
      case 'roc': return { v: roc(C.c, q.len) };
    }
    return {};
  }
  M.DEF = DEF; M.ORDER_OVER = ORDER_OVER; M.ORDER_PANE = ORDER_PANE; M.compute = compute; M.params = params; M.cols = cols; M.ok = ok;
  root.PRO = root.PRO || {}; root.PRO.ind = M;
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);
