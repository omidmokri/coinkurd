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

  /* rolling sums keep a count of exact zeros: a window of zeros (no volume, a flat stretch) gives exactly 0,
     not the floating-point residue of adding and subtracting, which would turn a 0/0 into a random number */
  function sma(x, n) {
    var o = arr(x.length), s = 0, c = 0, z = 0;
    for (var i = 0; i < x.length; i++) {
      var v = x[i];
      if (!ok(v)) { s = 0; c = 0; z = 0; continue; }
      s += v; c++; if (v === 0) z++;
      if (c > n) { var u = x[i - n]; s -= u; if (u === 0) z--; c = n; }
      if (c === n) o[i] = z === n ? 0 : s / n;
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
  function stdev(x, n) {                            /* ta.stdev: deviations within rounding noise count as 0, as in TradingView */
    var o = arr(x.length), m = sma(x, n);
    for (var i = n - 1; i < x.length; i++) {
      if (!ok(m[i])) continue;
      var s = 0, eps = 1e-10 * Math.max(1, Math.abs(m[i]));
      for (var k = 0; k < n; k++) { var dv = x[i - k] - m[i]; if (Math.abs(dv) > eps) s += dv * dv; }
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

  /* ---- more of TradingView's built-ins, each from its published Pine definition (see tests/test_pro_ind.py) */
  function dv(a, b) { return ok(a) && ok(b) && b !== 0 ? a / b : N; }
  function map2(x, y, f) { var o = arr(x.length); for (var i = 0; i < x.length; i++) if (ok(x[i]) && ok(y[i])) o[i] = f(x[i], y[i]); return o; }
  function sum(x, n) {                               /* math.sum: NaN until n defined values in a row */
    var o = arr(x.length), s = 0, c = 0, z = 0;
    for (var i = 0; i < x.length; i++) {
      var v = x[i]; if (!ok(v)) { s = 0; c = 0; z = 0; continue; }
      s += v; c++; if (v === 0) z++;
      if (c > n) { var u = x[i - n]; s -= u; if (u === 0) z--; c = n; }
      if (c === n) o[i] = z === n ? 0 : s;
    }
    return o;
  }
  function back(x, k) { var o = arr(x.length); for (var i = k; i < x.length; i++) o[i] = x[i - k]; return o; }      /* x[k] */
  function hl2(h, l) { return map2(h, l, function (a, b) { return (a + b) / 2; }); }
  function barSec(t) { var d = []; for (var i = 1; i < Math.min(t.length, 60); i++) d.push(t[i] - t[i - 1]); d.sort(function (a, b) { return a - b; }); return d.length ? d[d.length >> 1] : 60; }
  /* moving averages */
  function hma(x, n) { var a = wma(x, Math.max(1, Math.floor(n / 2))), b = wma(x, n); return wma(map2(a, b, function (p, q) { return 2 * p - q; }), Math.max(1, Math.floor(Math.sqrt(n)))); }
  function dema(x, n) { var e1 = ema(x, n), e2 = ema(e1, n); return map2(e1, e2, function (a, b) { return 2 * a - b; }); }
  function tema(x, n) { var e1 = ema(x, n), e2 = ema(e1, n), e3 = ema(e2, n), o = arr(x.length); for (var i = 0; i < x.length; i++) if (ok(e1[i]) && ok(e2[i]) && ok(e3[i])) o[i] = 3 * (e1[i] - e2[i]) + e3[i]; return o; }
  function vwma(c, v, n) { return map2(sma(map2(c, v, function (a, b) { return a * b; }), n), sma(v, n), function (a, b) { return b !== 0 ? a / b : N; }); }
  function alma(x, n, off, sig) {
    var o = arr(x.length), m = off * (n - 1), s = n / sig, w = [], norm = 0, i, j;
    for (i = 0; i < n; i++) { var wt = Math.exp(-((i - m) * (i - m)) / (2 * s * s)); w.push(wt); norm += wt; }
    for (j = n - 1; j < x.length; j++) {
      var sm = 0, good = true;
      for (i = 0; i < n; i++) { var v = x[j - (n - 1 - i)]; if (!ok(v)) { good = false; break; } sm += v * w[i]; }
      if (good) o[j] = sm / norm;
    }
    return o;
  }
  function linreg(x, n, off) {                       /* least squares over the last n values, x = 0 (oldest) … n − 1 */
    var o = arr(x.length), sx = n * (n - 1) / 2, sxx = (n - 1) * n * (2 * n - 1) / 6, den = n * sxx - sx * sx;
    for (var j = n - 1; j < x.length; j++) {
      var sy = 0, sxy = 0, good = true;
      for (var i = 0; i < n; i++) { var v = x[j - (n - 1) + i]; if (!ok(v)) { good = false; break; } sy += v; sxy += i * v; }
      if (!good) continue;
      var sl = den ? (n * sxy - sx * sy) / den : 0, ic = (sy - sl * sx) / n;
      o[j] = ic + sl * (n - 1 - (off || 0));
    }
    return o;
  }
  function mcginley(x, n) {
    var o = arr(x.length), e = ema(x, n), prev = N;
    for (var i = 0; i < x.length; i++) {
      if (!ok(prev)) { if (ok(e[i])) prev = e[i]; o[i] = prev; continue; }
      var v = x[i]; if (ok(v) && prev !== 0) prev = prev + (v - prev) / (n * Math.pow(v / prev, 4));
      o[i] = prev;
    }
    return o;
  }
  /* Williams fractals, classic: the high (low) is above (below) the n bars on each side */
  function fractals(h, l, n) {
    var L = h.length, up = arr(L), dn = arr(L);
    for (var k = n; k < L - n; k++) {
      var u = true, d = true;
      for (var j = 1; j <= n; j++) { if (!(h[k] > h[k - j] && h[k] > h[k + j])) u = false; if (!(l[k] < l[k - j] && l[k] < l[k + j])) d = false; }
      if (u) up[k] = h[k]; if (d) dn[k] = l[k];
    }
    return { up: up, dn: dn };
  }
  /* Pivot points standard (traditional), auto period as on TradingView: ≤15m → day, intraday → week, daily → month, longer → year.
     Each period shows the levels of the one before (the chart hides the connector between two periods: DEF.piv.breaks). */
  function pivots(t, h, l, c) {
    var L = t.length, K = ['p', 'r1', 'r2', 'r3', 's1', 's2', 's3'], o = {}, i;
    K.forEach(function (k) { o[k] = arr(L); });
    if (L < 2) return o;
    var sec = barSec(t), per = sec < 86400 ? (sec <= 900 ? 'D' : 'W') : sec < 7 * 86400 ? 'M' : 'Y';
    function key(tt) { var d = new Date(tt * 1000); return per === 'D' ? Math.floor(tt / 86400) : per === 'W' ? Math.floor((Math.floor(tt / 86400) + 3) / 7) : per === 'M' ? d.getUTCFullYear() * 12 + d.getUTCMonth() : d.getUTCFullYear(); }
    var cur = null, H = -Infinity, Lo = Infinity, C = N, lv = null;
    for (i = 0; i < L; i++) {
      var kk = key(t[i]);
      if (kk !== cur) {
        if (cur !== null && ok(C)) { var P = (H + Lo + C) / 3; lv = { p: P, r1: 2 * P - Lo, s1: 2 * P - H, r2: P + (H - Lo), s2: P - (H - Lo), r3: H + 2 * (P - Lo), s3: Lo - 2 * (H - P) }; }
        cur = kk; H = -Infinity; Lo = Infinity; C = N;
      }
      if (h[i] > H) H = h[i]; if (l[i] < Lo) Lo = l[i]; C = c[i];
      if (lv) for (var k = 0; k < K.length; k++) o[K[k]][i] = lv[K[k]];
    }
    return o;
  }
  /* ZigZag by percentage: a turn is confirmed once price moves dev % against the last extreme; the last leg is still forming */
  function zigzag(h, l, dev) {
    var L = h.length, o = arr(L), f = dev / 100, piv = [], dir = 0, ext = N, extI = 0, hi = h[0], hiI = 0, lo = l[0], loI = 0, i;
    if (L < 2) return o;
    for (i = 1; i < L; i++) {
      if (dir === 0) {
        if (h[i] > hi) { hi = h[i]; hiI = i; } if (l[i] < lo) { lo = l[i]; loI = i; }
        if (hi >= lo * (1 + f)) { if (loI <= hiI) { piv.push([loI, lo]); dir = 1; ext = hi; extI = hiI; } else { piv.push([hiI, hi]); dir = -1; ext = lo; extI = loI; } }
        continue;
      }
      if (dir === 1) { if (h[i] >= ext) { ext = h[i]; extI = i; } else if (l[i] <= ext * (1 - f)) { piv.push([extI, ext]); dir = -1; ext = l[i]; extI = i; } }
      else { if (l[i] <= ext) { ext = l[i]; extI = i; } else if (h[i] >= ext * (1 + f)) { piv.push([extI, ext]); dir = 1; ext = h[i]; extI = i; } }
    }
    if (dir !== 0) piv.push([extI, ext]);
    for (var k = 1; k < piv.length; k++) { var a = piv[k - 1], b = piv[k], w = b[0] - a[0]; for (var j = a[0]; j <= b[0]; j++) o[j] = w ? a[1] + (b[1] - a[1]) * (j - a[0]) / w : b[1]; }
    return o;
  }
  /* oscillators */
  function trueRange(h, l, c) { return tr(h, l, c); }
  function uo(h, l, c, a, b, d) {
    var L = c.length, bp = arr(L), r = arr(L);
    for (var i = 1; i < L; i++) { var lo = Math.min(l[i], c[i - 1]), hi = Math.max(h[i], c[i - 1]); bp[i] = c[i] - lo; r[i] = hi - lo; }
    var A = map2(sum(bp, a), sum(r, a), dv), B = map2(sum(bp, b), sum(r, b), dv), C = map2(sum(bp, d), sum(r, d), dv), o = arr(L);
    for (i = 0; i < L; i++) if (ok(A[i]) && ok(B[i]) && ok(C[i])) o[i] = 100 * (4 * A[i] + 2 * B[i] + C[i]) / 7;
    return o;
  }
  function adLine(h, l, c, v) { var o = arr(c.length), s = 0; for (var i = 0; i < c.length; i++) { s += (c[i] === h[i] && c[i] === l[i]) || h[i] === l[i] ? 0 : ((2 * c[i] - l[i] - h[i]) / (h[i] - l[i])) * v[i]; o[i] = s; } return o; }
  function cmf(h, l, c, v, n) {
    var ad = arr(c.length); for (var i = 0; i < c.length; i++) ad[i] = (c[i] === h[i] && c[i] === l[i]) || h[i] === l[i] ? 0 : ((2 * c[i] - l[i] - h[i]) / (h[i] - l[i])) * v[i];
    return map2(sum(ad, n), sum(v, n), dv);
  }
  function aroon(h, l, n) {
    var L = h.length, up = arr(L), dn = arr(L);
    for (var i = n; i < L; i++) {
      var hb = 0, lb = 0, hv = h[i], lv = l[i];
      for (var k = 1; k <= n; k++) { if (h[i - k] > hv) { hv = h[i - k]; hb = -k; } if (l[i - k] < lv) { lv = l[i - k]; lb = -k; } }
      up[i] = 100 * (hb + n) / n; dn[i] = 100 * (lb + n) / n;
    }
    return { up: up, dn: dn };
  }
  function vortex(h, l, c, n) {
    var L = h.length, a = arr(L), b = arr(L); for (var i = 1; i < L; i++) { a[i] = Math.abs(h[i] - l[i - 1]); b[i] = Math.abs(l[i] - h[i - 1]); }
    var st = sum(tr(h, l, c), n); return { vip: map2(sum(a, n), st, dv), vim: map2(sum(b, n), st, dv) };
  }
  function chop(h, l, c, n) {
    var s = sum(tr(h, l, c), n), hh = highest(h, n), ll = lowest(l, n), o = arr(c.length);
    for (var i = 0; i < c.length; i++) if (ok(s[i]) && hh[i] > ll[i]) o[i] = 100 * Math.log10(s[i] / (hh[i] - ll[i])) / Math.log10(n);
    return o;
  }
  function cmo(c, n) {
    var L = c.length, a = arr(L), b = arr(L); for (var i = 1; i < L; i++) { var m = c[i] - c[i - 1]; a[i] = m >= 0 ? m : 0; b[i] = m >= 0 ? 0 : -m; }
    return map2(sum(a, n), sum(b, n), function (p, q) { return p + q !== 0 ? 100 * (p - q) / (p + q) : N; });
  }
  function tsi(c, lg, sh) {
    var L = c.length, pc = arr(L), ap = arr(L); for (var i = 1; i < L; i++) { pc[i] = c[i] - c[i - 1]; ap[i] = Math.abs(pc[i]); }
    return map2(ema(ema(pc, lg), sh), ema(ema(ap, lg), sh), function (a, b) { return b !== 0 ? 100 * a / b : N; });
  }
  function swma(x) { var o = arr(x.length); for (var i = 3; i < x.length; i++) o[i] = x[i - 3] / 6 + x[i - 2] * 2 / 6 + x[i - 1] * 2 / 6 + x[i] / 6; return o; }
  function fisher(h, l, n) {
    var m = hl2(h, l), hh = highest(m, n), ll = lowest(m, n), L = h.length, val = arr(L), f1 = arr(L), f2 = arr(L), pv = N, pf = N;
    for (var i = 0; i < L; i++) {
      var v = N;
      if (i >= n - 1 && hh[i] !== ll[i]) { v = 0.66 * ((m[i] - ll[i]) / (hh[i] - ll[i]) - 0.5) + 0.67 * (ok(pv) ? pv : 0); v = v > 0.99 ? 0.999 : v < -0.99 ? -0.999 : v; }
      val[i] = v;
      f1[i] = ok(v) ? 0.5 * Math.log((1 + v) / (1 - v)) + 0.5 * (ok(pf) ? pf : 0) : N;
      f2[i] = i ? f1[i - 1] : N;
      pv = v; pf = f1[i];
    }
    return { fish: f1, trig: f2 };
  }
  function prank(x, n) {                             /* ta.percentrank: share of the previous n values ≤ the current one */
    var o = arr(x.length);
    for (var i = n; i < x.length; i++) {
      if (!ok(x[i])) continue; var c = 0, good = true;
      for (var k = 1; k <= n; k++) { var v = x[i - k]; if (!ok(v)) { good = false; break; } if (v <= x[i]) c++; }
      if (good) o[i] = 100 * c / n;
    }
    return o;
  }
  function streak(c) {                               /* Connors' up/down streak, Pine's updown() */
    var o = arr(c.length), ud = 0;
    for (var i = 0; i < c.length; i++) {
      var eq = i > 0 && c[i] === c[i - 1], gr = i > 0 && c[i] > c[i - 1];
      ud = eq ? 0 : gr ? (ud <= 0 ? 1 : ud + 1) : (ud >= 0 ? -1 : ud - 1); o[i] = ud;
    }
    return o;
  }
  function rvix(c, n, m) {                           /* Relative Volatility Index */
    var sd = stdev(c, n), L = c.length, up = arr(L), dn = arr(L);
    for (var i = 1; i < L; i++) if (ok(sd[i])) { var ch = c[i] - c[i - 1]; up[i] = ch <= 0 ? 0 : sd[i]; dn[i] = ch > 0 ? 0 : sd[i]; }
    return map2(ema(up, m), ema(dn, m), function (a, b) { return a + b !== 0 ? 100 * a / (a + b) : N; });
  }

  /* ---- price-only chart types (TradingView / Faraz): the bars are rebuilt from closes, time only orders them.
     Each output item keeps the time of the bar that formed it; several items formed in one bar get +1 s each
     (the time axis of the chart is by index, so they sit side by side). */
  function nice(x) { if (!(x > 0)) return 0; var e = Math.pow(10, Math.floor(Math.log10(x))), m = x / e; return +((m < 1.5 ? 1 : m < 2.25 ? 2 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10) * e).toPrecision(12); }
  /* the automatic box: ATR(14) of the last bars, rounded to a readable step */
  function autoBox(bars, n) {
    n = n || 14; var L = bars.length; if (L < 2) return 0;
    var from = Math.max(1, L - 300), h = [], l = [], c = [];
    for (var i = from - 1; i < L; i++) { h.push(bars[i].h); l.push(bars[i].l); c.push(bars[i].c); }
    var a = atr(h, l, c, Math.min(n, h.length - 1)), v = a[a.length - 1];
    return nice(v > 0 ? v : Math.abs(bars[L - 1].c) * 0.005);
  }
  function stamp(out, t) { var p = out.length ? out[out.length - 1].t : -Infinity; return t > p ? t : p + 1; }
  /* Renko (traditional, close): a new brick per full box; a reversal needs two boxes */
  function renko(bars, box) {
    var out = []; if (!bars.length || !(box > 0)) return out;
    var base = Math.floor(bars[0].c / box) * box, top = null, bot = null, up = null, vol = 0;
    function add(o, c, t) { out.push({ t: stamp(out, t), o: o, c: c, h: Math.max(o, c), l: Math.min(o, c), v: vol }); vol = 0; }
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i], c = b.c; vol += b.v || 0;
      if (up === null) {
        if (c >= base + box) { up = true; bot = base; top = base; while (c >= top + box) { add(top, top + box, b.t); top += box; } bot = top - box; }
        else if (c <= base - box) { up = false; top = base; bot = base; while (c <= bot - box) { add(bot, bot - box, b.t); bot -= box; } top = bot + box; }
        continue;
      }
      if (up) {
        if (c >= top + box) { while (c >= top + box) { add(top, top + box, b.t); top += box; } bot = top - box; }
        else if (c <= bot - box) { up = false; top = bot; while (c <= bot - box) { add(bot, bot - box, b.t); bot -= box; } top = bot + box; }
      } else {
        if (c <= bot - box) { while (c <= bot - box) { add(bot, bot - box, b.t); bot -= box; } top = bot + box; }
        else if (c >= top + box) { up = true; bot = top; while (c >= top + box) { add(top, top + box, b.t); top += box; } bot = top - box; }
      }
    }
    return out;
  }
  /* Line break (n lines, close): a new line when the close passes the last line; a reversal must pass the last n lines */
  function lbreak(bars, n) {
    n = Math.max(1, n | 0 || 3); var out = [], vol = 0;
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i], c = b.c; vol += b.v || 0;
      if (!out.length) { if (c !== b.o) { out.push({ t: b.t, o: b.o, c: c, h: Math.max(b.o, c), l: Math.min(b.o, c), v: vol }); vol = 0; } continue; }
      var L = out[out.length - 1], up = L.c > L.o, o = null;
      if (up ? c > L.c : c < L.c) o = L.c;
      else {
        var k = Math.max(0, out.length - n), hi = -Infinity, lo = Infinity;
        for (var j = k; j < out.length; j++) { hi = Math.max(hi, out[j].h); lo = Math.min(lo, out[j].l); }
        if (up && c < lo) o = L.o; else if (!up && c > hi) o = L.o;
      }
      if (o !== null) { out.push({ t: stamp(out, b.t), o: o, c: c, h: Math.max(o, c), l: Math.min(o, c), v: vol }); vol = 0; }
    }
    return out;
  }
  /* Kagi (reversal amount, close): a line per swing; thick (yang) above the last shoulder, thin (yin) below the last waist.
     Each item: o → c is the vertical line; y0/y1 = thick at its start/end; sw = the level where it changed. */
  function kagi(bars, rev) {
    var out = []; if (!bars.length || !(rev > 0)) return out;
    var start = bars[0].c, cur = null, up = null, yang = false, shoulder = null, waist = null, vol = 0;
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i], c = b.c; vol += b.v || 0;
      if (up === null) {
        if (Math.abs(c - start) >= rev) { up = c > start; yang = up; cur = { t: b.t, o: start, c: c, y0: yang, y1: yang, sw: null, v: vol }; out.push(cur); vol = 0; }
        continue;
      }
      if (up ? c > cur.c : c < cur.c) { cur.c = c; cur.v += vol; vol = 0; }
      else if (up ? cur.c - c >= rev : c - cur.c >= rev) {
        if (up) shoulder = cur.c; else waist = cur.c;
        up = !up; cur = { t: stamp(out, b.t), o: cur.c, c: c, y0: yang, y1: yang, sw: null, v: vol }; out.push(cur); vol = 0;
      } else continue;
      /* thickness along the current line */
      cur.y1 = cur.y0; cur.sw = null;
      if (up && !cur.y0 && shoulder !== null && cur.c > shoulder) { cur.y1 = true; cur.sw = shoulder; }
      if (!up && cur.y0 && waist !== null && cur.c < waist) { cur.y1 = false; cur.sw = waist; }
      yang = cur.y1;
    }
    out.forEach(function (x) { x.h = Math.max(x.o, x.c); x.l = Math.min(x.o, x.c); });
    return out;
  }
  /* Point & figure (box, reversal in boxes, close): X columns rise, O columns fall */
  function pnf(bars, box, rev) {
    var out = []; if (!bars.length || !(box > 0)) return out;
    rev = Math.max(1, rev | 0 || 3);
    var eps = box * 1e-9, k0 = Math.round(bars[0].c / box), col = null, vol = 0;
    function fin(x) { x.h = x.hi * box; x.l = x.lo * box; x.o = x.x ? x.l : x.h; x.c = x.x ? x.h : x.l; x.bs = box; }
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i], c = b.c, up = Math.floor((c + eps) / box), dn = Math.ceil((c - eps) / box); vol += b.v || 0;
      if (!col) {
        if (up >= k0 + 1) col = { t: b.t, x: true, lo: k0, hi: up, v: vol };
        else if (dn <= k0 - 1) col = { t: b.t, x: false, lo: dn, hi: k0, v: vol };
        if (col) { fin(col); out.push(col); vol = 0; }
        continue;
      }
      if (col.x) {
        if (up > col.hi) { col.hi = up; col.v += vol; vol = 0; fin(col); }
        else if (dn <= col.hi - rev) { col = { t: stamp(out, b.t), x: false, hi: col.hi - 1, lo: dn, v: vol }; vol = 0; fin(col); out.push(col); }
      } else {
        if (dn < col.lo) { col.lo = dn; col.v += vol; vol = 0; fin(col); }
        else if (up >= col.lo + rev) { col = { t: stamp(out, b.t), x: true, lo: col.lo + 1, hi: up, v: vol }; vol = 0; fin(col); out.push(col); }
      }
    }
    return out;
  }

  var M = { sma: sma, ema: ema, rma: rma, wma: wma, stdev: stdev, highest: highest, lowest: lowest, tr: tr, atr: atr, rsi: rsi, macd: macd, bb: bb,
    stoch: stoch, stochRsi: stochRsi, cci: cci, mfi: mfi, willr: willr, obv: obv, roc: roc, adx: adx, psar: psar, supertrend: supertrend,
    donchian: donchian, keltner: keltner, ichimoku: ichimoku, vwap: vwap, heikin: heikin,
    nice: nice, autoBox: autoBox, renko: renko, lbreak: lbreak, kagi: kagi, pnf: pnf };

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
    roc: { pane: true, p: { len: 9 }, plots: [['v', 'line', '#fbbf24']], levels: [0] },
    /* moving averages and overlays */
    hma: { p: { len: 9 }, plots: [['v', 'line', '#f472b6']] },
    dema: { p: { len: 9 }, plots: [['v', 'line', '#2dd4bf']] },
    tema: { p: { len: 9 }, plots: [['v', 'line', '#a3e635']] },
    vwma: { p: { len: 20 }, plots: [['v', 'line', '#fb7185']] },
    smma: { p: { len: 7 }, plots: [['v', 'line', '#fbbf24']] },
    alma: { p: { len: 9, offset: 0.85, sigma: 6 }, plots: [['v', 'line', '#60a5fa']] },
    lsma: { p: { len: 25 }, plots: [['v', 'line', '#e879f9']] },
    mgd: { p: { len: 14 }, plots: [['v', 'line', '#38bdf8']] },
    macross: { p: { fast: 9, slow: 21 }, plots: [['fast', 'line', '#34d399'], ['slow', 'line', '#ff5a4d']] },
    ribbon: { p: { l1: 20, l2: 50, l3: 100, l4: 200 }, plots: [['m1', 'line', '#fde047'], ['m2', 'line', '#fb923c'], ['m3', 'line', '#f43f5e'], ['m4', 'line', '#a855f7']] },
    env: { p: { len: 20, pct: 10 }, plots: [['up', 'line', '#94a3b8'], ['mid', 'line', '#f59e0b'], ['lo', 'line', '#94a3b8']], band: ['up', 'lo', 'rgba(148,163,184,.06)'] },
    alli: { p: { jaw: 13, teeth: 8, lips: 5, jawOff: 8, teethOff: 5, lipsOff: 3 }, plots: [['jaw', 'line', '#3b82f6'], ['teeth', 'line', '#ef4444'], ['lips', 'line', '#22c55e']], shift: { jaw: 'jawOff', teeth: 'teethOff', lips: 'lipsOff' } },
    fract: { p: { n: 2 }, plots: [['up', 'dots', '#34d399'], ['dn', 'dots', '#ff5a4d']] },
    piv: { p: {}, breaks: true, plots: [['r3', 'line', 'rgba(255,90,77,.5)'], ['r2', 'line', 'rgba(255,90,77,.7)'], ['r1', 'line', '#ff5a4d'], ['p', 'line', '#f59e0b'], ['s1', 'line', '#34d399'], ['s2', 'line', 'rgba(52,211,153,.7)'], ['s3', 'line', 'rgba(52,211,153,.5)']] },
    zz: { p: { dev: 5 }, plots: [['v', 'line', '#fbbf24']] },
    /* oscillators, volume and volatility (own pane) */
    ao: { pane: true, p: {}, plots: [['v', 'hist', '']], levels: [0], fmt: 'price' },
    ac: { pane: true, p: {}, plots: [['v', 'hist', '']], levels: [0], fmt: 'price' },
    mom: { pane: true, p: { len: 10 }, plots: [['v', 'line', '#38bdf8']], levels: [0], fmt: 'price' },
    trix: { pane: true, p: { len: 18 }, plots: [['v', 'line', '#f87171']], levels: [0] },
    uo: { pane: true, p: { fast: 7, mid: 14, slow: 28 }, plots: [['v', 'line', '#c084fc']], levels: [70, 50, 30], range: [0, 100] },
    ppo: { pane: true, p: { fast: 12, slow: 26, sig: 9 }, plots: [['hist', 'hist', ''], ['ppo', 'line', '#38bdf8'], ['signal', 'line', '#fb923c']], levels: [0] },
    tsi: { pane: true, p: { long: 25, short: 13, sig: 13 }, plots: [['tsi', 'line', '#2962ff'], ['signal', 'line', '#e91e63']], levels: [0] },
    cmo: { pane: true, p: { len: 9 }, plots: [['v', 'line', '#38bdf8']], levels: [50, 0, -50], range: [-100, 100] },
    crsi: { pane: true, p: { rsi: 3, streak: 2, rank: 100 }, plots: [['v', 'line', '#2962ff']], levels: [70, 50, 30], range: [0, 100] },
    fisher: { pane: true, p: { len: 9 }, plots: [['fish', 'line', '#2563eb'], ['trig', 'line', '#f97316']], levels: [1.5, 0.75, 0, -0.75, -1.5] },
    rvgi: { pane: true, p: { len: 10 }, plots: [['rvi', 'line', '#22c55e'], ['sig', 'line', '#ef4444']], levels: [0] },
    kst: { pane: true, p: {}, plots: [['kst', 'line', '#22c55e'], ['signal', 'line', '#ef4444']], levels: [0] },
    copp: { pane: true, p: { wma: 10, long: 14, short: 11 }, plots: [['v', 'line', '#38bdf8']], levels: [0] },
    dpo: { pane: true, p: { len: 21 }, plots: [['v', 'line', '#22c55e']], levels: [0], fmt: 'price' },
    aroon: { pane: true, p: { len: 14 }, plots: [['up', 'line', '#fb923c'], ['dn', 'line', '#3b82f6']], levels: [70, 30], range: [0, 100] },
    vortex: { pane: true, p: { len: 14 }, plots: [['vip', 'line', '#3b82f6'], ['vim', 'line', '#ec4899']], levels: [1] },
    chop: { pane: true, p: { len: 14 }, plots: [['v', 'line', '#2563eb']], levels: [61.8, 38.2], range: [0, 100] },
    mass: { pane: true, p: { len: 10 }, plots: [['v', 'line', '#f472b6']], levels: [27, 26.5] },
    bbpow: { pane: true, p: { len: 13 }, plots: [['v', 'hist', '']], levels: [0], fmt: 'price' },
    bop: { pane: true, p: {}, plots: [['v', 'hist', '']], levels: [0] },
    bbp: { pane: true, p: { len: 20, mult: 2 }, plots: [['v', 'line', '#14b8a6']], levels: [1, 0.5, 0] },
    bbw: { pane: true, p: { len: 20, mult: 2 }, plots: [['v', 'line', '#60a5fa']] },
    sd: { pane: true, p: { len: 20 }, plots: [['v', 'line', '#60a5fa']], fmt: 'price' },
    hv: { pane: true, p: { len: 10 }, plots: [['v', 'line', '#38bdf8']] },
    rvi: { pane: true, p: { len: 10, ema: 14 }, plots: [['v', 'line', '#7e57c2']], levels: [80, 50, 20], range: [0, 100] },
    adr: { pane: true, p: { len: 14 }, plots: [['v', 'line', '#f59e0b']], fmt: 'price' },
    cmf: { pane: true, p: { len: 20 }, plots: [['v', 'line', '#34d399']], levels: [0] },
    adl: { pane: true, p: {}, plots: [['v', 'line', '#60a5fa']], fmt: 'vol' },
    chosc: { pane: true, p: { fast: 3, slow: 10 }, plots: [['v', 'line', '#f472b6']], levels: [0], fmt: 'vol' },
    efi: { pane: true, p: { len: 13 }, plots: [['v', 'line', '#fb7185']], levels: [0], fmt: 'vol' },
    eom: { pane: true, p: { len: 14, div: 10000 }, plots: [['v', 'line', '#2dd4bf']], levels: [0] },
    pvt: { pane: true, p: {}, plots: [['v', 'line', '#3b82f6']], fmt: 'vol' },
    vo: { pane: true, p: { short: 5, long: 10 }, plots: [['v', 'line', '#a78bfa']], levels: [0] }
  };
  DEF.atr.fmt = 'price'; DEF.macd.fmt = 'price'; DEF.obv.fmt = 'vol';
  var ORDER_OVER = ['sma', 'ema', 'wma', 'hma', 'dema', 'tema', 'vwma', 'smma', 'alma', 'lsma', 'mgd', 'macross', 'ribbon', 'bb', 'env', 'dc', 'kc', 'ichi', 'alli', 'psar', 'st', 'vwap', 'piv', 'fract', 'zz'];
  var ORDER_PANE = ['vol', 'rsi', 'macd', 'stoch', 'srsi', 'cci', 'willr', 'mfi', 'mom', 'roc', 'ao', 'ac', 'uo', 'ppo', 'tsi', 'trix', 'cmo', 'crsi', 'fisher', 'rvgi', 'kst', 'copp', 'dpo',
    'adx', 'aroon', 'vortex', 'chop', 'mass', 'bbpow', 'bop', 'atr', 'adr', 'bbp', 'bbw', 'sd', 'hv', 'rvi', 'obv', 'adl', 'chosc', 'cmf', 'efi', 'eom', 'pvt', 'vo'];

  function cols(bars) {
    var n = bars.length, t = new Array(n), o = new Array(n), h = new Array(n), l = new Array(n), c = new Array(n), v = new Array(n);
    for (var i = 0; i < n; i++) { var b = bars[i]; t[i] = b.t; o[i] = b.o; h[i] = b.h; l[i] = b.l; c[i] = b.c; v[i] = b.v || 0; }
    return { t: t, o: o, h: h, l: l, c: c, v: v };
  }
  function int(x, d, lo, hi) { x = Math.round(+x); return isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; }
  function num(x, d, lo, hi) { x = +x; return isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; }
  /* clean user parameters (they come from storage and from shared links) */
  var BND = { mult: [0.1, 20, 1], pct: [0.1, 100, 1], dev: [0.1, 100, 1], div: [1, 1e9, 1], offset: [0, 1, 1], sigma: [0.1, 50, 1], jawOff: [0, 100], teethOff: [0, 100], lipsOff: [0, 100], rank: [2, 500] };
  function params(id, p) {
    var d = DEF[id] && DEF[id].p, o = {}; if (!d) return o; p = p || {};
    for (var k in d) {
      var dv = d[k], b = BND[k];
      o[k] = b ? (b[2] ? num(p[k], dv, b[0], b[1]) : int(p[k], dv, b[0], b[1])) : (dv % 1 !== 0) ? num(p[k], dv, 0.0001, 100) : int(p[k], dv, 1, 500);
    }
    return o;
  }
  function aoOf(C) { var m = hl2(C.h, C.l); return map2(sma(m, 5), sma(m, 34), function (a, b) { return a - b; }); }
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
      case 'hma': return { v: hma(C.c, q.len) };
      case 'dema': return { v: dema(C.c, q.len) };
      case 'tema': return { v: tema(C.c, q.len) };
      case 'vwma': return { v: vwma(C.c, C.v, q.len) };
      case 'smma': return { v: rma(C.c, q.len) };
      case 'alma': return { v: alma(C.c, q.len, q.offset, q.sigma) };
      case 'lsma': return { v: linreg(C.c, q.len, 0) };
      case 'mgd': return { v: mcginley(C.c, q.len) };
      case 'macross': return { fast: sma(C.c, q.fast), slow: sma(C.c, q.slow) };
      case 'ribbon': return { m1: sma(C.c, q.l1), m2: sma(C.c, q.l2), m3: sma(C.c, q.l3), m4: sma(C.c, q.l4) };
      case 'env': { var em = sma(C.c, q.len); return { mid: em, up: em.map(function (x) { return x * (1 + q.pct / 100); }), lo: em.map(function (x) { return x * (1 - q.pct / 100); }) }; }
      case 'alli': { var m2 = hl2(C.h, C.l); return { jaw: rma(m2, q.jaw), teeth: rma(m2, q.teeth), lips: rma(m2, q.lips) }; }
      case 'fract': return fractals(C.h, C.l, q.n);
      case 'piv': return pivots(C.t, C.h, C.l, C.c);
      case 'zz': return { v: zigzag(C.h, C.l, q.dev) };
      case 'ao': return { v: aoOf(C) };
      case 'ac': { var a0 = aoOf(C), as = sma(a0, 5); return { v: map2(a0, as, function (a, b) { return a - b; }) }; }
      case 'mom': return { v: map2(C.c, back(C.c, q.len), function (a, b) { return a - b; }) };
      case 'trix': { var t3 = ema(ema(ema(C.c.map(Math.log), q.len), q.len), q.len); return { v: map2(t3, back(t3, 1), function (a, b) { return 10000 * (a - b); }) }; }
      case 'uo': return { v: uo(C.h, C.l, C.c, q.fast, q.mid, q.slow) };
      case 'ppo': {
        var pf = ema(C.c, q.fast), ps = ema(C.c, q.slow), pp = map2(pf, ps, function (a, b) { return b !== 0 ? 100 * (a - b) / b : N; }), sg = ema(pp, q.sig);
        return { ppo: pp, signal: sg, hist: map2(pp, sg, function (a, b) { return a - b; }) };
      }
      case 'tsi': { var ts = tsi(C.c, q.long, q.short); return { tsi: ts, signal: ema(ts, q.sig) }; }
      case 'cmo': return { v: cmo(C.c, q.len) };
      case 'crsi': {
        var r1 = rsi(C.c, q.rsi), r2 = rsi(streak(C.c), q.streak), r3 = prank(roc(C.c, 1), q.rank), cr = arr(C.c.length);
        for (var ci = 0; ci < cr.length; ci++) if (ok(r1[ci]) && ok(r2[ci]) && ok(r3[ci])) cr[ci] = (r1[ci] + r2[ci] + r3[ci]) / 3;
        return { v: cr };
      }
      case 'fisher': return fisher(C.h, C.l, q.len);
      case 'rvgi': {
        var co = swma(map2(C.c, C.o, function (a, b) { return a - b; })), hl = swma(map2(C.h, C.l, function (a, b) { return a - b; })), rv = map2(sum(co, q.len), sum(hl, q.len), dv);
        return { rvi: rv, sig: swma(rv) };
      }
      case 'kst': {
        var sr = function (a, b) { return sma(roc(C.c, a), b); }, k1 = sr(10, 10), k2 = sr(15, 10), k3 = sr(20, 10), k4 = sr(30, 15), ks = arr(C.c.length);
        for (var ki = 0; ki < ks.length; ki++) if (ok(k1[ki]) && ok(k2[ki]) && ok(k3[ki]) && ok(k4[ki])) ks[ki] = k1[ki] + 2 * k2[ki] + 3 * k3[ki] + 4 * k4[ki];
        return { kst: ks, signal: sma(ks, 9) };
      }
      case 'copp': return { v: wma(map2(roc(C.c, q.long), roc(C.c, q.short), function (a, b) { return a + b; }), q.wma) };
      case 'dpo': return { v: map2(C.c, back(sma(C.c, q.len), Math.floor(q.len / 2) + 1), function (a, b) { return a - b; }) };
      case 'aroon': return aroon(C.h, C.l, q.len);
      case 'vortex': return vortex(C.h, C.l, C.c, q.len);
      case 'chop': return { v: chop(C.h, C.l, C.c, q.len) };
      case 'mass': { var sp = map2(C.h, C.l, function (a, b) { return a - b; }), e1 = ema(sp, 9), e2 = ema(e1, 9); return { v: sum(map2(e1, e2, function (a, b) { return b !== 0 ? a / b : N; }), q.len) }; }
      case 'bbpow': { var be = ema(C.c, q.len), bo = arr(C.c.length); for (var bi = 0; bi < bo.length; bi++) if (ok(be[bi])) bo[bi] = C.h[bi] + C.l[bi] - 2 * be[bi]; return { v: bo }; }
      case 'bop': return { v: C.c.map(function (x, i) { return C.h[i] !== C.l[i] ? (x - C.o[i]) / (C.h[i] - C.l[i]) : N; }) };
      case 'bbp': { var b1 = bb(C.c, q.len, q.mult); return { v: C.c.map(function (x, i) { return dv(x - b1.lo[i], b1.up[i] - b1.lo[i]); }) }; }
      case 'bbw': { var b2 = bb(C.c, q.len, q.mult); return { v: b2.mid.map(function (m, i) { return ok(m) && m !== 0 ? 100 * (b2.up[i] - b2.lo[i]) / m : N; }) }; }
      case 'sd': return { v: stdev(C.c, q.len) };
      case 'hv': {
        var lr = arr(C.c.length); for (var hi2 = 1; hi2 < lr.length; hi2++) if (C.c[hi2 - 1] > 0 && C.c[hi2] > 0) lr[hi2] = Math.log(C.c[hi2] / C.c[hi2 - 1]);
        var per = barSec(C.t) <= 86400 ? 1 : 7, hs = stdev(lr, q.len);
        return { v: hs.map(function (x) { return ok(x) ? 100 * x * Math.sqrt(365 / per) : N; }) };
      }
      case 'rvi': return { v: rvix(C.c, q.len, q.ema) };
      case 'adr': return { v: sma(map2(C.h, C.l, function (a, b) { return a - b; }), q.len) };
      case 'cmf': return { v: cmf(C.h, C.l, C.c, C.v, q.len) };
      case 'adl': return { v: adLine(C.h, C.l, C.c, C.v) };
      case 'chosc': { var ad2 = adLine(C.h, C.l, C.c, C.v); return { v: map2(ema(ad2, q.fast), ema(ad2, q.slow), function (a, b) { return a - b; }) }; }
      case 'efi': { var fi = arr(C.c.length); for (var fi2 = 1; fi2 < fi.length; fi2++) fi[fi2] = (C.c[fi2] - C.c[fi2 - 1]) * C.v[fi2]; return { v: ema(fi, q.len) }; }
      case 'eom': {
        var m3 = hl2(C.h, C.l), eo = arr(C.c.length);
        for (var ei = 1; ei < eo.length; ei++) if (C.v[ei] !== 0) eo[ei] = q.div * (m3[ei] - m3[ei - 1]) * (C.h[ei] - C.l[ei]) / C.v[ei];
        return { v: sma(eo, q.len) };
      }
      case 'pvt': { var pv = arr(C.c.length), acc = 0; for (var pi2 = 0; pi2 < pv.length; pi2++) { if (pi2 && C.c[pi2 - 1]) acc += (C.c[pi2] - C.c[pi2 - 1]) / C.c[pi2 - 1] * C.v[pi2]; pv[pi2] = acc; } return { v: pv }; }
      case 'vo': return { v: map2(ema(C.v, q.short), ema(C.v, q.long), function (a, b) { return b !== 0 ? 100 * (a - b) / b : N; }) };
    }
    return {};
  }
  M.DEF = DEF; M.ORDER_OVER = ORDER_OVER; M.ORDER_PANE = ORDER_PANE; M.compute = compute; M.params = params; M.cols = cols; M.ok = ok;
  root.PRO = root.PRO || {}; root.PRO.ind = M;
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);
