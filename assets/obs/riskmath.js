/* entekhab.net — the arithmetic behind /charts/risk/. No drawing and no fetching, so it can be tested on its own
   (tests/test_riskmath.js). Everything is measured on the real daily closes the site already holds; nothing is
   modelled from an assumed distribution except where a figure says so.
   Self-test: node tests/test_riskmath.js */
(function (root) {
  'use strict';
  var R = {};

  /* daily simple returns from a price series; a gap (null) ends one pair and starts the next */
  R.returns = function (px) {
    var out = [];
    for (var i = 1; i < px.length; i++) {
      var a = px[i - 1], b = px[i];
      if (a == null || b == null || !(a > 0)) continue;
      out.push(b / a - 1);
    }
    return out;
  };

  /* returns over h days, taken from the prices themselves rather than scaled up from one day.
     Scaling a daily figure by the square root of time assumes every day is independent and alike; crypto's worst
     weeks are precisely when that is false, so the longer horizons here are measured, not extrapolated. */
  R.horizonReturns = function (px, h) {
    var out = [];
    for (var i = h; i < px.length; i++) {
      var a = px[i - h], b = px[i];
      if (a == null || b == null || !(a > 0)) continue;
      out.push(b / a - 1);
    }
    return out;
  };

  R.quantile = function (xs, p) {
    if (!xs.length) return null;
    var a = xs.slice().sort(function (x, y) { return x - y; });
    var i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo);
  };

  R.mean = function (xs) {
    if (!xs.length) return null;
    var s = 0;
    for (var i = 0; i < xs.length; i++) s += xs[i];
    return s / xs.length;
  };

  /* sample standard deviation (n-1): the series is a sample of the asset's behaviour, not the whole of it */
  R.stdev = function (xs) {
    if (xs.length < 2) return null;
    var m = R.mean(xs), s = 0;
    for (var i = 0; i < xs.length; i++) s += (xs[i] - m) * (xs[i] - m);
    return Math.sqrt(s / (xs.length - 1));
  };

  /* Value at Risk as a positive share of the position: the loss this bad or worse happens (1 - conf) of the time.
     Historical: the quantile of what actually happened. A loss, so a gain at that quantile reports 0. */
  R.varHist = function (rets, conf) {
    var q = R.quantile(rets, 1 - conf);
    return q == null ? null : Math.max(0, -q);
  };

  /* the normal-curve figure, for comparison only: it understates a fat tail, and saying so is the point of showing both */
  R.varNormal = function (rets, conf) {
    var m = R.mean(rets), s = R.stdev(rets);
    if (m == null || s == null) return null;
    return Math.max(0, -(m + R.z(conf) * s));
  };

  /* the standard normal's lower quantile, by Acklam's rational approximation (good to ~1e-9) */
  R.z = function (conf) {
    var p = 1 - conf;
    if (!(p > 0 && p < 1)) return NaN;
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00],
        b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01],
        c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00],
        d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    var pl = 0.02425, q, r;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
             ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - pl) return -R.z(1 - (1 - conf));
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  };

  /* expected shortfall: the average loss on the days that were worse than VaR -- how bad it is once it is bad */
  R.shortfall = function (rets, conf) {
    var cut = R.quantile(rets, 1 - conf);
    if (cut == null) return null;
    var tail = rets.filter(function (x) { return x <= cut; });
    var m = R.mean(tail);
    return m == null ? null : Math.max(0, -m);
  };

  /* annualised volatility from daily returns (365 trading days: crypto does not close) */
  R.vol = function (rets) {
    var s = R.stdev(rets);
    return s == null ? null : s * Math.sqrt(365);
  };

  /* the deepest fall from a peak, and where the price stands against its own high now */
  R.drawdown = function (px) {
    var peak = null, worst = 0, at = -1, peakAt = -1, bestPeakAt = -1;
    for (var i = 0; i < px.length; i++) {
      var v = px[i];
      if (v == null || !(v > 0)) continue;
      if (peak == null || v > peak) { peak = v; peakAt = i; }
      var dd = v / peak - 1;
      if (dd < worst) { worst = dd; at = i; bestPeakAt = peakAt; }
    }
    var last = null, lastPeak = null;
    for (var j = 0; j < px.length; j++) { if (px[j] != null && px[j] > 0) { last = px[j]; if (lastPeak == null || px[j] > lastPeak) lastPeak = px[j]; } }
    return { worst: worst, at: at, from: bestPeakAt, now: lastPeak ? last / lastPeak - 1 : null };
  };

  /* How large a position may be, given what the trader is willing to lose if the stop is hit.
     The loss that matters is the distance from entry to stop, not the size of the position, which is why a wide
     stop forces a small position and a tight one allows a large one. Returns null where the inputs cannot give an
     answer, rather than a number that looks like one. */
  R.size = function (account, riskPct, entry, stop) {
    if (!(account > 0) || !(riskPct > 0) || !(entry > 0) || !(stop > 0) || entry === stop) return null;
    var risk = account * riskPct / 100;
    var per = Math.abs(entry - stop);
    var units = risk / per;
    var value = units * entry;
    return {
      risk: risk, units: units, value: value,
      leverage: value / account,
      stopPct: per / entry * 100,
      side: stop < entry ? 'long' : 'short'
    };
  };

  /* a histogram of returns, for the picture of where the VaR cut falls */
  R.histogram = function (rets, bins) {
    if (!rets.length) return [];
    var lo = Math.min.apply(null, rets), hi = Math.max.apply(null, rets);
    if (!(hi > lo)) return [];
    var w = (hi - lo) / bins, out = [];
    for (var i = 0; i < bins; i++) out.push({ x0: lo + i * w, x1: lo + (i + 1) * w, n: 0 });
    for (var j = 0; j < rets.length; j++) {
      var k = Math.min(bins - 1, Math.floor((rets[j] - lo) / w));
      out[k].n++;
    }
    return out;
  };

  if (typeof module === 'object' && module.exports) module.exports = R;
  else root.OBRisk = R;
})(typeof window !== 'undefined' ? window : this);
