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
    vo: { pane: true, p: { short: 5, long: 10 }, plots: [['v', 'line', '#a78bfa']], levels: [0] },
    /* the community's most-liked TradingView scripts, written here from each author's published method (credited in the list) */
    sqz: { pane: true, p: { len: 20, mult: 2, kcm: 1.5 }, plots: [['v', 'hist', ''], ['on', 'dots', '#ff5a4d'], ['off', 'dots', '#6b7280']], levels: [0], fmt: 'price' },
    wt: { pane: true, p: { n1: 10, n2: 21 }, plots: [['wt1', 'line', '#34d399'], ['wt2', 'line', '#ff5a4d']], levels: [60, 53, 0, -53, -60] },
    halft: { p: { amp: 2, chdev: 2 }, plots: [['up', 'line', '#2962ff'], ['dn', 'line', '#ff5a4d']] },
    ce: { p: { len: 22, mult: 3 }, plots: [['long', 'line', '#34d399'], ['short', 'line', '#ff5a4d']] },
    ut: { p: { key: 1, atr: 10 }, plots: [['up', 'line', '#34d399'], ['dn', 'line', '#ff5a4d']] },
    ssl: { p: { len: 10 }, plots: [['up', 'line', '#34d399'], ['dn', 'line', '#ff5a4d']] },
    alpha: { p: { coeff: 1, len: 14 }, plots: [['at', 'line', '#2962ff'], ['lag', 'line', '#ff5a4d']], band: ['at', 'lag', 'rgba(41,98,255,.08)'] },
    qqe: { pane: true, p: { rsi: 6, sf: 5, qqe: 3 }, plots: [['v', 'hist', ''], ['tl', 'line', '#e5e7eb']], levels: [0] },
    nwe: { p: { bw: 8, mult: 3 }, plots: [['up', 'line', '#ff5a4d'], ['mid', 'line', 'rgba(156,163,175,.6)'], ['lo', 'line', '#34d399']], band: ['up', 'lo', 'rgba(156,163,175,.05)'] },
    vixfix: { pane: true, p: { pd: 22, bbl: 20, mult: 2, lb: 50, ph: 0.85 }, plots: [['v', 'hist', ''], ['ub', 'line', '#60a5fa'], ['rh', 'line', '#f59e0b']] },
    rf: { p: { per: 100, mult: 3 }, plots: [['up', 'line', '#34d399'], ['dn', 'line', '#ff5a4d'], ['hi', 'line', 'rgba(52,211,153,.35)'], ['lo', 'line', 'rgba(255,90,77,.35)']] },
    hull: { p: { len: 55 }, plots: [['up', 'line', '#34d399'], ['dn', 'line', '#ff5a4d']] },
    zlsma: { p: { len: 32 }, plots: [['v', 'line', '#facc15']] },
    tdi: { pane: true, p: { rsi: 13, band: 34, fast: 2, slow: 7 }, plots: [['fast', 'line', '#34d399'], ['slow', 'line', '#ff5a4d'], ['up', 'line', '#60a5fa'], ['mid', 'line', '#facc15'], ['lo', 'line', '#60a5fa']], levels: [68, 50, 32], range: [0, 100] },
    stc: { pane: true, p: { len: 10, fast: 23, slow: 50 }, plots: [['v', 'line', '#e879f9']], levels: [75, 25], range: [0, 100] },
    kdj: { pane: true, p: { len: 9, k: 3, d: 3 }, plots: [['k', 'line', '#38bdf8'], ['d', 'line', '#fb923c'], ['j', 'line', '#e879f9']], levels: [80, 20] },
    smi: { pane: true, p: { len: 10, k: 3, d: 3 }, plots: [['smi', 'line', '#38bdf8'], ['sig', 'line', '#fb923c']], levels: [40, 0, -40] },
    vwapb: { p: { mult: 2 }, plots: [['up2', 'line', 'rgba(255,90,77,.7)'], ['up', 'line', 'rgba(255,90,77,.45)'], ['v', 'line', '#e879f9'], ['lo', 'line', 'rgba(52,211,153,.45)'], ['lo2', 'line', 'rgba(52,211,153,.7)']], band: ['up2', 'lo2', 'rgba(232,121,249,.04)'] },
    emacloud: { p: { fast: 8, slow: 21, fast2: 34, slow2: 50 }, plots: [['a', 'line', '#34d399'], ['b', 'line', '#34d399'], ['c', 'line', '#60a5fa'], ['d', 'line', '#60a5fa']], band: ['a', 'b', 'rgba(52,211,153,.14)'] },
    gmma: { p: {}, plots: [3, 5, 8, 10, 12, 15].map(function (n) { return ['s' + n, 'line', 'rgba(56,189,248,.8)']; }).concat([30, 35, 40, 45, 50, 60].map(function (n) { return ['l' + n, 'line', 'rgba(255,90,77,.8)']; })) },
    srlux: { p: { left: 15, right: 15 }, breaks: true, plots: [['res', 'line', '#ff5a4d'], ['sup', 'line', '#34d399']] },
    atrts: { p: { len: 14, mult: 3 }, plots: [['up', 'line', '#34d399'], ['dn', 'line', '#ff5a4d']] },
    /* profiles (painted by the drawing layer) and candlestick patterns (markers on the bars) */
    /* order flow from the taker-buy volume of each candle (Binance); an estimate from the candle's shape where that is missing */
    vdelta: { pane: true, p: {}, plots: [['v', 'hist', '']], levels: [0], fmt: 'vol' },
    cvd: { pane: true, p: {}, plots: [['v', 'line', '#38bdf8']], fmt: 'vol' },
    fpbar: { p: {}, plots: [], foot: 1 },
    /* market structure (painted by the drawing layer) */
    ms: { p: { len: 5 }, plots: [], smc: 'ms' }, fvg: { p: {}, plots: [], smc: 'fvg' }, ob: { p: { len: 5 }, plots: [], smc: 'ob' }, eqhl: { p: { len: 5 }, plots: [], smc: 'eq' },
    tpo: { p: { rows: 24 }, plots: [], prof: 'tpo' },
    vpvr: { p: { rows: 40 }, plots: [], prof: 'vis' },
    vpsess: { p: { rows: 20 }, plots: [], prof: 'sess' },
    cp_all: { p: {}, plots: [], marks: 1 }, cp_engulf: { p: {}, plots: [], marks: 1 }, cp_hammer: { p: {}, plots: [], marks: 1 }, cp_star: { p: {}, plots: [], marks: 1 },
    cp_doji: { p: {}, plots: [], marks: 1 }, cp_mstar: { p: {}, plots: [], marks: 1 }, cp_soldiers: { p: {}, plots: [], marks: 1 }, cp_harami: { p: {}, plots: [], marks: 1 },
    cp_pierce: { p: {}, plots: [], marks: 1 }, cp_maru: { p: {}, plots: [], marks: 1 }, cp_tweezer: { p: {}, plots: [], marks: 1 }, cp_inside: { p: {}, plots: [], marks: 1 },
    /* Coin_Kurd's own open-source script (TradingView umPv6JPM): fair value = 8.31e-17 · days-since-genesis^5.48, ±10 %, buy zone 18 % under the lower band */
    kpl: { p: {}, plots: [['up', 'line', '#ffff00'], ['fair', 'line', '#ff0000'], ['lo', 'line', '#00ff00'], ['buy', 'line', 'rgba(0,255,0,.45)']], band: ['up', 'lo', 'rgba(255,255,0,.07)'] },
    /* Kurdistani Style Cycle (DRuCJ6Bk): the series is computed once a day on the server exactly as the script does (MVRV from Coin Metrics); here it is laid on the bars */
    ksc: { pane: true, p: {}, plots: [['v', 'hist', ''], ['pz', 'line', 'rgba(201,209,217,.7)']], levels: [1.5, 0, -1.5], ext: 'kind' },
    /* Kurdistani Bitcoin Spiral (tECCygHQ): drawn in its own pane by the app */
    kspiral: { pane: true, p: {}, plots: [['z', 'line', 'rgba(0,0,0,0)']], range: [-1, 1], spiral: 1, ext: 'kind' },
    /* Kurdistani Macro Regime (IUgkPeGI): regime background, signals and a dashboard from data/macro_regime.json */
    kmacro: { p: {}, plots: [], ext: 'macro', macro: 1 }
  };
  DEF.atr.fmt = 'price'; DEF.macd.fmt = 'price'; DEF.obv.fmt = 'vol';
  var ORDER_OVER = ['sma', 'ema', 'wma', 'hma', 'dema', 'tema', 'vwma', 'smma', 'alma', 'lsma', 'mgd', 'macross', 'ribbon', 'bb', 'env', 'dc', 'kc', 'ichi', 'alli', 'psar', 'st', 'vwap', 'piv', 'fract', 'zz'];
  var ORDER_COM = ['sqz', 'wt', 'halft', 'ut', 'ce', 'ssl', 'alpha', 'qqe', 'nwe', 'vixfix', 'rf', 'hull', 'zlsma', 'tdi', 'stc', 'kdj', 'smi', 'vwapb', 'emacloud', 'gmma', 'srlux', 'atrts'];
  var ORDER_PROF = ['vpvr', 'vpsess', 'tpo', 'fpbar', 'vdelta', 'cvd'];
  var ORDER_SMC = ['ms', 'fvg', 'ob', 'eqhl'];
  var ORDER_PAT = ['cp_all', 'cp_engulf', 'cp_hammer', 'cp_star', 'cp_doji', 'cp_mstar', 'cp_soldiers', 'cp_harami', 'cp_pierce', 'cp_maru', 'cp_tweezer', 'cp_inside'];
  var ORDER_CK = ['ksc', 'kpl', 'kspiral', 'kmacro'];
  var EXT = {}, USER = {};                                   /* USER: the visitor's own scripts (script.js), id → function (bars, params) */
  var _unused_ext;                                             /* server-made data the app loads for the indicators that need it */
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
  var BND = { mult: [0.1, 20, 1], pct: [0.1, 100, 1], dev: [0.1, 100, 1], div: [1, 1e9, 1], offset: [0, 1, 1], sigma: [0.1, 50, 1], jawOff: [0, 100], teethOff: [0, 100], lipsOff: [0, 100], rank: [2, 500],
    kcm: [0.1, 10, 1], chdev: [0.1, 10, 1], key: [0.1, 10, 1], coeff: [0.1, 10, 1], qqe: [0.1, 10, 1], bw: [1, 50, 1], ph: [0.5, 1, 1], amp: [1, 100], per: [2, 500], rows: [6, 120], left: [2, 60], right: [1, 60] };
  function params(id, p) {
    var d = DEF[id] && DEF[id].p, o = {}; if (!d) return o; p = p || {};
    if (DEF[id].free) { for (var fk in d) o[fk] = num(p[fk], d[fk], -1e12, 1e12); return o; }
    for (var k in d) {
      var dv = d[k], b = BND[k];
      o[k] = b ? (b[2] ? num(p[k], dv, b[0], b[1]) : int(p[k], dv, b[0], b[1])) : (dv % 1 !== 0) ? num(p[k], dv, 0.0001, 100) : int(p[k], dv, 1, 500);
    }
    return o;
  }
  function aoOf(C) { var m = hl2(C.h, C.l); return map2(sma(m, 5), sma(m, 34), function (a, b) { return a - b; }); }

  /* ---- community scripts */
  function trail(dir, a, b) { var up = arr(dir.length), dn = arr(dir.length); for (var i = 0; i < dir.length; i++) { if (!ok(a[i])) continue; if (dir[i] > 0) up[i] = a[i]; else dn[i] = b ? b[i] : a[i]; } return { up: up, dn: dn }; }
  function comm(id, C, q) {
    var n = C.c.length, i;
    switch (id) {
      case 'sqz': {                                         /* Squeeze Momentum [LazyBear] */
        var b = bb(C.c, q.len, q.mult), ma = sma(C.c, q.len), rg = sma(trueRange(C.h, C.l, C.c), q.len), hh = highest(C.h, q.len), ll = lowest(C.l, q.len);
        var src = arr(n), on = arr(n), off = arr(n);
        for (i = 0; i < n; i++) {
          if (ok(hh[i]) && ok(ma[i])) src[i] = C.c[i] - ((hh[i] + ll[i]) / 2 + ma[i]) / 2;
          if (ok(b.up[i]) && ok(rg[i])) { var sq = b.lo[i] > ma[i] - rg[i] * q.kcm && b.up[i] < ma[i] + rg[i] * q.kcm; if (sq) on[i] = 0; else off[i] = 0; }
        }
        return { v: linreg(src, q.len, 0), on: on, off: off };
      }
      case 'wt': {                                          /* WaveTrend Oscillator [LazyBear] */
        var ap = arr(n); for (i = 0; i < n; i++) ap[i] = (C.h[i] + C.l[i] + C.c[i]) / 3;
        var esa = ema(ap, q.n1), dd = ema(map2(ap, esa, function (a, e) { return Math.abs(a - e); }), q.n1);
        var ci = arr(n); for (i = 0; i < n; i++) if (ok(esa[i]) && ok(dd[i]) && dd[i]) ci[i] = (ap[i] - esa[i]) / (0.015 * dd[i]);
        var w1 = ema(ci, q.n2); return { wt1: w1, wt2: sma(w1, 4) };
      }
      case 'halft': {                                       /* HalfTrend [everget], MPL-2.0 */
        var a2 = atr(C.h, C.l, C.c, 100), hp = highest(C.h, q.amp), lp = lowest(C.l, q.amp), hm = sma(C.h, q.amp), lm = sma(C.l, q.amp);
        var trend = 0, next = 0, maxL = C.l[0], minH = C.h[0], up = arr(n), dn = arr(n), U = N, D = N, pT = N;
        for (i = 1; i < n; i++) {
          if (!ok(hp[i]) || !ok(hm[i])) continue;
          if (next === 1) { maxL = Math.max(lp[i], maxL); if (hm[i] < maxL && C.c[i] < C.l[i - 1]) { trend = 1; next = 0; minH = hp[i]; } }
          else { minH = Math.min(hp[i], minH); if (lm[i] > minH && C.c[i] > C.h[i - 1]) { trend = 0; next = 1; maxL = lp[i]; } }
          var nu = N, nd = N;
          if (trend === 0) { if (ok(pT) && pT !== 0) nu = ok(D) ? D : D; else nu = ok(U) ? Math.max(maxL, U) : maxL; }
          else { if (pT !== 1) nd = ok(U) ? U : U; else nd = ok(D) ? Math.min(minH, D) : minH; }
          if (trend === 0) { U = nu; up[i] = U; } else { D = nd; dn[i] = D; }
          pT = trend;
        }
        return { up: up, dn: dn };
      }
      case 'ce': {                                          /* Chandelier Exit [everget], MPL-2.0 */
        var at = atr(C.h, C.l, C.c, q.len), hc = highest(C.c, q.len), lc = lowest(C.c, q.len), L = N, S = N, dir = 1, dirs = arr(n), ls = arr(n), ss = arr(n);
        for (i = 0; i < n; i++) {
          if (!ok(at[i]) || !ok(hc[i])) continue;
          var l0 = hc[i] - q.mult * at[i], s0 = lc[i] + q.mult * at[i], lp2 = ok(L) ? L : l0, sp2 = ok(S) ? S : s0;
          L = i && C.c[i - 1] > lp2 ? Math.max(l0, lp2) : l0; S = i && C.c[i - 1] < sp2 ? Math.min(s0, sp2) : s0;
          dir = C.c[i] > sp2 ? 1 : C.c[i] < lp2 ? -1 : dir; dirs[i] = dir; ls[i] = L; ss[i] = S;
        }
        var o = trail(dirs, ls, ss); return { long: o.up, short: o.dn };
      }
      case 'ut': {                                          /* UT Bot Alerts [QuantNomad] */
        var at2 = atr(C.h, C.l, C.c, q.atr), ts = N, tsa = arr(n), d2 = arr(n);
        for (i = 0; i < n; i++) {
          if (!ok(at2[i])) continue; var x = C.c[i], loss = q.key * at2[i], px = i ? C.c[i - 1] : x;
          if (!ok(ts)) ts = x - loss;
          else if (x > ts && px > ts) ts = Math.max(ts, x - loss); else if (x < ts && px < ts) ts = Math.min(ts, x + loss); else ts = x > ts ? x - loss : x + loss;
          tsa[i] = ts; d2[i] = x > ts ? 1 : -1;
        }
        var o2 = trail(d2, tsa); return { up: o2.up, dn: o2.dn };
      }
      case 'ssl': {                                         /* SSL Channel [ErwinBeckers] */
        var sh = sma(C.h, q.len), sl = sma(C.l, q.len), hl = 0, u = arr(n), d3 = arr(n);
        for (i = 0; i < n; i++) { if (!ok(sh[i])) continue; hl = C.c[i] > sh[i] ? 1 : C.c[i] < sl[i] ? -1 : hl; u[i] = hl < 0 ? sl[i] : sh[i]; d3[i] = hl < 0 ? sh[i] : sl[i]; }
        return { up: u, dn: d3 };
      }
      case 'alpha': {                                       /* AlphaTrend [KivancOzbilgic], MPL-2.0 */
        var at3 = sma(trueRange(C.h, C.l, C.c), q.len), hasV = C.v.some(function (v) { return v > 0; }), osc = hasV ? mfi(C.h, C.l, C.c, C.v, q.len) : rsi(C.c, q.len), A = N, out = arr(n);
        for (i = 0; i < n; i++) {
          if (!ok(at3[i]) || !ok(osc[i])) continue; var upT = C.l[i] - at3[i] * q.coeff, dnT = C.h[i] + at3[i] * q.coeff;
          A = osc[i] >= 50 ? (ok(A) && upT < A ? A : upT) : (ok(A) && dnT > A ? A : dnT); out[i] = A;
        }
        return { at: out, lag: back(out, 2) };
      }
      case 'qqe': {                                         /* QQE (the core of QQE MOD [Mihkel00]) */
        var R = rsi(C.c, q.rsi), RM = ema(R, q.sf), wl = q.rsi * 2 - 1, ar = arr(n);
        for (i = 1; i < n; i++) if (ok(RM[i]) && ok(RM[i - 1])) ar[i] = Math.abs(RM[i - 1] - RM[i]);
        var dar = ema(ema(ar, wl), wl), lb = N, sb = N, tr2 = 1, tl = arr(n), hv = arr(n);
        for (i = 1; i < n; i++) {
          if (!ok(RM[i]) || !ok(dar[i])) continue; var dv2 = dar[i] * q.qqe, nl = RM[i] - dv2, ns = RM[i] + dv2, plb = lb, psb = sb;
          lb = ok(plb) && RM[i - 1] > plb && RM[i] > plb ? Math.max(plb, nl) : nl;
          sb = ok(psb) && RM[i - 1] < psb && RM[i] < psb ? Math.min(psb, ns) : ns;
          if (ok(psb) && RM[i - 1] <= psb && RM[i] > psb) tr2 = 1; else if (ok(plb) && RM[i - 1] >= plb && RM[i] < plb) tr2 = -1;
          tl[i] = (tr2 === 1 ? lb : sb) - 50; hv[i] = RM[i] - 50;
        }
        return { v: hv, tl: tl };
      }
      case 'nwe': {                                         /* Nadaraya-Watson Envelope [LuxAlgo], CC BY-NC-SA 4.0 — the non-repainting (end-point) form */
        var W = Math.min(499, n - 1), wt = []; for (var k = 0; k <= W; k++) wt.push(Math.exp(-(k * k) / (2 * q.bw * q.bw)));
        var mid = arr(n), err = arr(n);
        for (i = 0; i < n; i++) { var sw = 0, sv = 0; for (k = 0; k <= W && k <= i; k++) { sv += C.c[i - k] * wt[k]; sw += wt[k]; } mid[i] = sv / sw; err[i] = Math.abs(C.c[i] - mid[i]); }
        var mae = sma(err, Math.max(2, W)), up2 = arr(n), lo2 = arr(n);
        for (i = 0; i < n; i++) if (ok(mae[i])) { up2[i] = mid[i] + mae[i] * q.mult; lo2[i] = mid[i] - mae[i] * q.mult; }
        return { up: up2, mid: mid, lo: lo2 };
      }
      case 'vixfix': {                                      /* CM Williams Vix Fix [ChrisMoody] */
        var hc2 = highest(C.c, q.pd), wv = arr(n); for (i = 0; i < n; i++) if (ok(hc2[i]) && hc2[i]) wv[i] = (hc2[i] - C.l[i]) / hc2[i] * 100;
        var md = sma(wv, q.bbl), sd2 = stdev(wv, q.bbl), hw = highest(wv, q.lb), ub = arr(n), rh = arr(n);
        for (i = 0; i < n; i++) { if (ok(md[i]) && ok(sd2[i])) ub[i] = md[i] + q.mult * sd2[i]; if (ok(hw[i])) rh[i] = hw[i] * q.ph; }
        return { v: wv, ub: ub, rh: rh };
      }
      case 'rf': {                                          /* Range Filter [DonovanWall] */
        var ad = arr(n); for (i = 1; i < n; i++) ad[i] = Math.abs(C.c[i] - C.c[i - 1]);
        var sr = ema(ema(ad, q.per), q.per * 2 - 1), F = N, dir4 = 0, ua = arr(n), da = arr(n), hi4 = arr(n), lo4 = arr(n);
        for (i = 0; i < n; i++) {
          if (!ok(sr[i])) continue; var r4 = sr[i] * q.mult, x4 = C.c[i], pf = ok(F) ? F : x4;
          F = x4 > pf ? (x4 - r4 < pf ? pf : x4 - r4) : (x4 + r4 > pf ? pf : x4 + r4);
          dir4 = F > pf ? 1 : F < pf ? -1 : dir4; if (dir4 >= 0) ua[i] = F; else da[i] = F; hi4[i] = F + r4; lo4[i] = F - r4;
        }
        return { up: ua, dn: da, hi: hi4, lo: lo4 };
      }
      case 'hull': { var hv2 = hma(C.c, q.len), d6 = arr(n); for (i = 2; i < n; i++) if (ok(hv2[i]) && ok(hv2[i - 2])) d6[i] = hv2[i] > hv2[i - 2] ? 1 : -1; var o6 = trail(d6, hv2); return { up: o6.up, dn: o6.dn }; }   /* Hull Suite [InSilico] */
      case 'zlsma': { var l1 = linreg(C.c, q.len, 0), l2 = linreg(l1, q.len, 0); return { v: map2(l1, l2, function (a, b) { return a + (a - b); }) }; }   /* ZLSMA [veryfid] */
      case 'tdi': { var rr = rsi(C.c, q.rsi), mb = sma(rr, q.band), sdv = stdev(rr, q.band); return { fast: sma(rr, q.fast), slow: sma(rr, q.slow), mid: mb, up: map2(mb, sdv, function (a, b) { return a + 1.6185 * b; }), lo: map2(mb, sdv, function (a, b) { return a - 1.6185 * b; }) }; }   /* Traders Dynamic Index */
      case 'stc': {                                         /* Schaff Trend Cycle */
        var m7 = map2(ema(C.c, q.fast), ema(C.c, q.slow), function (a, b) { return a - b; }), f1 = N, pf2 = N, out7 = arr(n), k1 = arr(n), lo7 = lowest(m7, q.len), hi7 = highest(m7, q.len);
        for (i = 0; i < n; i++) { if (!ok(lo7[i])) continue; var rg7 = hi7[i] - lo7[i], st7 = rg7 > 0 ? (m7[i] - lo7[i]) / rg7 * 100 : (ok(f1) ? f1 : 0); f1 = ok(f1) ? f1 + 0.5 * (st7 - f1) : st7; k1[i] = f1; }
        var lo8 = lowest(k1, q.len), hi8 = highest(k1, q.len);
        for (i = 0; i < n; i++) { if (!ok(lo8[i])) continue; var rg8 = hi8[i] - lo8[i], st8 = rg8 > 0 ? (k1[i] - lo8[i]) / rg8 * 100 : (ok(pf2) ? pf2 : 0); pf2 = ok(pf2) ? pf2 + 0.5 * (st8 - pf2) : st8; out7[i] = pf2; }
        return { v: out7 };
      }
      case 'kdj': { var hh9 = highest(C.h, q.len), ll9 = lowest(C.l, q.len), rsv = arr(n); for (i = 0; i < n; i++) if (ok(hh9[i]) && hh9[i] > ll9[i]) rsv[i] = (C.c[i] - ll9[i]) / (hh9[i] - ll9[i]) * 100; var K = rma(rsv, q.k), Dd = rma(K, q.d); return { k: K, d: Dd, j: map2(K, Dd, function (a, b) { return 3 * a - 2 * b; }) }; }
      case 'smi': {                                         /* Stochastic Momentum Index */
        var hh0 = highest(C.h, q.len), ll0 = lowest(C.l, q.len), rel = arr(n), rng0 = arr(n); for (i = 0; i < n; i++) if (ok(hh0[i])) { rel[i] = C.c[i] - (hh0[i] + ll0[i]) / 2; rng0[i] = hh0[i] - ll0[i]; }
        var a0 = ema(ema(rel, q.k), q.k), b0 = ema(ema(rng0, q.k), q.k), sm = map2(a0, b0, function (x, y) { return y ? 200 * x / y : N; }); return { smi: sm, sig: ema(sm, q.d) };
      }
      case 'vwapb': {                                       /* VWAP with standard-deviation bands (daily anchor) */
        var vw = arr(n), u1 = arr(n), u2b = arr(n), d1 = arr(n), d2b = arr(n), pv = 0, vv = 0, p2 = 0, day = -1;
        for (i = 0; i < n; i++) { var dy = Math.floor(C.t[i] / 86400); if (dy !== day) { day = dy; pv = 0; vv = 0; p2 = 0; } var tp = (C.h[i] + C.l[i] + C.c[i]) / 3, v0 = C.v[i] || 1e-9; pv += tp * v0; vv += v0; p2 += tp * tp * v0; var w0 = pv / vv, sg = Math.sqrt(Math.max(0, p2 / vv - w0 * w0)); vw[i] = w0; u1[i] = w0 + sg; d1[i] = w0 - sg; u2b[i] = w0 + q.mult * sg; d2b[i] = w0 - q.mult * sg; }
        return { v: vw, up: u1, lo: d1, up2: u2b, lo2: d2b };
      }
      case 'emacloud': return { a: ema(C.c, q.fast), b: ema(C.c, q.slow), c: ema(C.c, q.fast2), d: ema(C.c, q.slow2) };   /* EMA clouds [Ripster47] */
      case 'gmma': { var g = {}; [3, 5, 8, 10, 12, 15].forEach(function (k2) { g['s' + k2] = ema(C.c, k2); }); [30, 35, 40, 45, 50, 60].forEach(function (k2) { g['l' + k2] = ema(C.c, k2); }); return g; }
      case 'srlux': {                                       /* Support and Resistance Levels with Breaks [LuxAlgo], CC BY-NC-SA 4.0 */
        var res = arr(n), sup = arr(n), R0 = N, S0 = N;
        for (i = 0; i < n; i++) {
          var c0 = i - q.right;
          if (c0 - q.left >= 0) { var isH = true, isL = true; for (var j = c0 - q.left; j <= i; j++) { if (C.h[j] > C.h[c0]) isH = false; if (C.l[j] < C.l[c0]) isL = false; } if (isH) R0 = C.h[c0]; if (isL) S0 = C.l[c0]; }
          res[i] = R0; sup[i] = S0;
        }
        return { res: res, sup: sup };
      }
      case 'atrts': {                                       /* ATR trailing stops */
        var at9 = atr(C.h, C.l, C.c, q.len), T9 = N, dr = 1, ta = arr(n), da9 = arr(n);
        for (i = 0; i < n; i++) { if (!ok(at9[i])) continue; var ls9 = q.mult * at9[i]; if (!ok(T9)) T9 = C.c[i] - ls9; else if (dr > 0) { if (C.c[i] < T9) { dr = -1; T9 = C.c[i] + ls9; } else T9 = Math.max(T9, C.c[i] - ls9); } else { if (C.c[i] > T9) { dr = 1; T9 = C.c[i] - ls9; } else T9 = Math.min(T9, C.c[i] + ls9); } ta[i] = T9; da9[i] = dr; }
        var o9 = trail(da9, ta); return { up: o9.up, dn: o9.dn };
      }
      case 'vdelta': case 'cvd': {
        var dl = arr(n), acc = 0, B = C.bars || [];
        for (i = 0; i < n; i++) { var bb2 = B[i], d0 = bb2 && bb2.tb != null ? 2 * bb2.tb - C.v[i] : (C.h[i] > C.l[i] ? C.v[i] * (C.c[i] - C.o[i]) / (C.h[i] - C.l[i]) : 0); if (id === 'cvd') { acc += d0; dl[i] = acc; } else dl[i] = d0; }
        return { v: dl };
      }
      case 'kspiral': { var zz = arr(n); for (i = 0; i < n; i++) zz[i] = 0; return { z: zz }; }
      case 'ksc': {
        var S = EXT.kind && EXT.kind.style_cycle && EXT.kind.style_cycle.series, vv = arr(n), pz = arr(n), ph = arr(n); if (!S || !S.length) return { v: vv, pz: pz, ph: ph };
        if (!EXT._ksc) {                                   /* day → [bull-bear, phase, z-score of log price over 365 days] */
          var mp = {}, lg = S.map(function (r) { return Math.log(r[3]); }), mz = sma(lg, 365), sz = stdev(lg, 365);
          S.forEach(function (r, k) { mp[Math.floor(Date.parse(r[0] + 'T00:00:00Z') / 86400000)] = [r[1], r[2], ok(mz[k]) && sz[k] ? (lg[k] - mz[k]) / sz[k] : N]; });
          EXT._ksc = { m: mp, last: Math.floor(Date.parse(S[S.length - 1][0] + 'T00:00:00Z') / 86400000) };
        }
        for (i = 0; i < n; i++) { var dk = Math.floor(C.t[i] / 86400), rw = EXT._ksc.m[dk] || (dk > EXT._ksc.last && dk - EXT._ksc.last <= 3 ? EXT._ksc.m[EXT._ksc.last] : null); if (rw) { vv[i] = rw[0]; ph[i] = rw[1]; pz[i] = rw[2]; } }
        return { v: vv, pz: pz, ph: ph };
      }
      case 'kpl': {                                         /* Kurdistani Bitcoin Power Law [Coin_Kurd], open source */
        var G = Date.UTC(2009, 0, 3) / 1000, f = arr(n), u5 = arr(n), l5 = arr(n), b5 = arr(n);
        for (i = 0; i < n; i++) { var dd5 = (C.t[i] - G) / 86400; if (dd5 <= 0) continue; var fv = 8.31e-17 * Math.pow(dd5, 5.48); f[i] = fv; u5[i] = fv * 1.1; l5[i] = fv * 0.9; b5[i] = fv * 0.9 * 0.82; }
        return { fair: f, up: u5, lo: l5, buy: b5 };
      }
    }
    return null;
  }
  /* market structure from confirmed swing points (a pivot needs `len` bars on each side):
     ms  → breaks of the last swing: BOS continues the trend, CHoCH is the first break against it
     fvg → three-bar fair value gaps, each ending at the bar that fills it
     ob  → the last opposite candle before the move that broke structure, ending when price closes through it
     eq  → equal highs / lows: two swings within 0.1 ATR of each other */
  function structure(bars, len, what) {
    var n = bars.length, out = [], i, L = Math.max(2, Math.min(50, len | 0 || 5));
    if (what === 'fvg') {
      for (i = 2; i < n; i++) {
        var a = bars[i - 2], c = bars[i], up = c.l > a.h, dn = c.h < a.l; if (!up && !dn) continue;
        var top = up ? c.l : a.l, bot = up ? a.h : c.h, end = n - 1, filled = false;
        for (var j = i + 1; j < n; j++) if (up ? bars[j].l <= bot : bars[j].h >= top) { end = j; filled = true; break; }
        out.push({ k: 'box', i0: i - 1, i1: end, top: top, bot: bot, d: up ? 1 : -1, open: !filled });
      }
      return out.slice(-200);
    }
    var hs = [], ls = [], at = (function () { var C = cols(bars); return atr(C.h, C.l, C.c, 14); })();
    for (i = L; i < n - L; i++) {
      var isH = true, isL = true;
      for (var k = i - L; k <= i + L; k++) { if (k === i) continue; if (k < i ? bars[k].h >= bars[i].h : bars[k].h > bars[i].h) isH = false; if (k < i ? bars[k].l <= bars[i].l : bars[k].l < bars[i].l) isL = false; if (!isH && !isL) break; }
      if (isH) hs.push(i); if (isL) ls.push(i);
    }
    if (what === 'eq') {
      [[hs, 'h', -1], [ls, 'l', 1]].forEach(function (S) { for (var q = 1; q < S[0].length; q++) { var i0 = S[0][q - 1], i1 = S[0][q], tol = (ok(at[i1]) ? at[i1] : 0) * 0.1; if (Math.abs(bars[i0][S[1]] - bars[i1][S[1]]) <= tol) out.push({ k: 'line', i0: i0, i1: i1, p: (bars[i0][S[1]] + bars[i1][S[1]]) / 2, t: S[1] === 'h' ? 'EQH' : 'EQL', d: S[2] }); } });
      return out.slice(-120);
    }
    var hp = 0, lp = 0, lastH = -1, lastL = -1, usedH = -1, usedL = -1, trend = 0;
    for (i = L * 2; i < n; i++) {
      while (hp < hs.length && hs[hp] + L <= i) { lastH = hs[hp]; hp++; }
      while (lp < ls.length && ls[lp] + L <= i) { lastL = ls[lp]; lp++; }
      var cl = bars[i].c, brk = 0, from = -1;
      if (lastH >= 0 && lastH !== usedH && cl > bars[lastH].h) { brk = 1; from = lastH; usedH = lastH; }
      else if (lastL >= 0 && lastL !== usedL && cl < bars[lastL].l) { brk = -1; from = lastL; usedL = lastL; }
      if (!brk) continue;
      var kind = trend === brk || trend === 0 ? 'BOS' : 'CHoCH'; trend = brk;
      if (what === 'ms') out.push({ k: 'line', i0: from, i1: i, p: brk > 0 ? bars[from].h : bars[from].l, t: kind, d: brk });
      else {                                               /* order block: the last candle against the move, between the swing and the break */
        var obi = -1; for (var z = i - 1; z >= Math.max(0, from - L); z--) if (brk > 0 ? bars[z].c < bars[z].o : bars[z].c > bars[z].o) { obi = z; break; }
        if (obi < 0) continue; var tp = bars[obi].h, bt = bars[obi].l, e2 = n - 1, alive = true;
        for (var y = i + 1; y < n; y++) if (brk > 0 ? bars[y].c < bt : bars[y].c > tp) { e2 = y; alive = false; break; }
        out.push({ k: 'box', i0: obi, i1: e2, top: tp, bot: bt, d: brk, open: alive, t: 'OB' });
      }
    }
    return out.slice(-150);
  }
  /* candlestick patterns → [{ i, d: 1 bullish | −1 bearish | 0 neutral, c: short code }] */
  function candles(bars, which) {
    var out = [], n = bars.length, want = function (k) { return which === 'cp_all' || which === 'cp_' + k; }, avg = 0;
    function body(b) { return Math.abs(b.c - b.o); } function up(b) { return b.c > b.o; } function dn(b) { return b.c < b.o; }
    for (var i = 0; i < n; i++) {
      var b = bars[i], a = bars[i - 1], z = bars[i - 2], rg = b.h - b.l, bd = body(b), top = b.h - Math.max(b.o, b.c), bot = Math.min(b.o, b.c) - b.l;
      avg = i ? avg + (bd - avg) / Math.min(i + 1, 14) : bd;
      if (i < 15 || rg <= 0) continue;
      var trendUp = bars[i - 1].c > bars[i - 6].c, trendDn = bars[i - 1].c < bars[i - 6].c, hit = null;
      if (want('mstar') && z && dn(z) && body(z) > avg && body(a) < body(z) * 0.4 && up(b) && b.c > (z.o + z.c) / 2 && Math.max(a.o, a.c) < z.c) hit = [1, 'MS'];
      else if (want('mstar') && z && up(z) && body(z) > avg && body(a) < body(z) * 0.4 && dn(b) && b.c < (z.o + z.c) / 2 && Math.min(a.o, a.c) > z.c) hit = [-1, 'ES'];
      else if (want('soldiers') && z && up(z) && up(a) && up(b) && a.c > z.c && b.c > a.c && a.o > z.o && b.o > a.o && body(z) > avg * 0.8 && body(a) > avg * 0.8 && bd > avg * 0.8) hit = [1, '3W'];
      else if (want('soldiers') && z && dn(z) && dn(a) && dn(b) && a.c < z.c && b.c < a.c && a.o < z.o && b.o < a.o && body(z) > avg * 0.8 && body(a) > avg * 0.8 && bd > avg * 0.8) hit = [-1, '3B'];
      else if (want('engulf') && a && dn(a) && up(b) && b.c >= a.o && b.o <= a.c && bd > body(a) && trendDn) hit = [1, 'BE'];
      else if (want('engulf') && a && up(a) && dn(b) && b.o >= a.c && b.c <= a.o && bd > body(a) && trendUp) hit = [-1, 'SE'];
      else if (want('pierce') && a && dn(a) && up(b) && body(a) > avg && b.o < a.l && b.c > (a.o + a.c) / 2 && b.c < a.o) hit = [1, 'PL'];
      else if (want('pierce') && a && up(a) && dn(b) && body(a) > avg && b.o > a.h && b.c < (a.o + a.c) / 2 && b.c > a.o) hit = [-1, 'DC'];
      else if (want('harami') && a && dn(a) && up(b) && body(a) > avg && b.c < a.o && b.o > a.c && bd < body(a) * 0.6) hit = [1, 'H+'];
      else if (want('harami') && a && up(a) && dn(b) && body(a) > avg && b.o < a.c && b.c > a.o && bd < body(a) * 0.6) hit = [-1, 'H-'];
      else if (want('tweezer') && a && trendDn && dn(a) && up(b) && Math.abs(a.l - b.l) <= rg * 0.03) hit = [1, 'TB'];
      else if (want('tweezer') && a && trendUp && up(a) && dn(b) && Math.abs(a.h - b.h) <= rg * 0.03) hit = [-1, 'TT'];
      else if (want('hammer') && bot >= bd * 2 && top <= bd * 0.4 && bd > rg * 0.05 && trendDn) hit = [1, 'H'];
      else if (want('hammer') && bot >= bd * 2 && top <= bd * 0.4 && bd > rg * 0.05 && trendUp) hit = [-1, 'HM'];
      else if (want('star') && top >= bd * 2 && bot <= bd * 0.4 && bd > rg * 0.05 && trendUp) hit = [-1, 'SS'];
      else if (want('star') && top >= bd * 2 && bot <= bd * 0.4 && bd > rg * 0.05 && trendDn) hit = [1, 'IH'];
      else if (want('maru') && bd >= rg * 0.95 && bd > avg * 1.3) hit = [up(b) ? 1 : -1, 'M'];
      else if (want('doji') && bd <= rg * 0.05) hit = [0, 'D'];
      else if (want('inside') && a && b.h < a.h && b.l > a.l && which !== 'cp_all') hit = [0, 'IB'];
      if (hit) out.push({ i: i, d: hit[0], c: hit[1] });
    }
    return out;
  }
  /* compute → { key: array } aligned with bars */
  function compute(id, bars, p) {
    var C = cols(bars), q = params(id, p), r;
    if (USER[id]) return USER[id](bars, q) || {};
    if (id === 'vdelta' || id === 'cvd') { C.bars = bars; return comm(id, C, q) || {}; }
    if (ORDER_COM.indexOf(id) >= 0 || ORDER_CK.indexOf(id) >= 0) return comm(id, C, q) || {};
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
  M.DEF = DEF; M.ORDER_OVER = ORDER_OVER; M.ORDER_PANE = ORDER_PANE; M.ORDER_COM = ORDER_COM; M.EXT = EXT; M.USER = USER; M.ORDER_PROF = ORDER_PROF; M.ORDER_PAT = ORDER_PAT; M.candles = candles; M.structure = structure; M.ORDER_SMC = ORDER_SMC; M.ORDER_CK = ORDER_CK; M.compute = compute; M.params = params; M.cols = cols; M.ok = ok;
  root.PRO = root.PRO || {}; root.PRO.ind = M;
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);
