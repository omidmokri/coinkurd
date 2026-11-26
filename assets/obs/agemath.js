/* entekhab.net — the Observatory: SOPR and HODL waves (pure: no DOM, no network; python3 tests/test_obs_age.py checks it).
   Reads data/obs/age_btc.json, written by scripts/obs_age.py from bitview.space (the Bitcoin Research Kit: open source,
   computed from every block of the Bitcoin blockchain), checked against Coin Metrics' supply and BGeometrics' figures.

     SOPR            = what the coins spent that day were worth when spent ÷ what they were worth when created
     short / long    = the same for coins younger than 155 days / 155 days and older; adjusted: coins under an hour left out
     HODL waves      = share of all bitcoin by how long ago each coin last moved (13 bands, in 0.01 % in the file)
     side            = whether the 7-day mean of SOPR is at or above 1 (profit) or below (loss), and for how many days

   summary() is mirrored line by line by scripts/obs_age.py (the bot reads that one); the test compares the two. */
(function (root) {
  'use strict';
  var DAY = 86400000;
  var BANDS = ['d1', 'w1', 'm1', 'm3', 'm6', 'y1', 'y2', 'y3', 'y4', 'y5', 'y7', 'y10', 'y10p'];
  var YOUNG = BANDS.slice(0, 5), OLD = BANDS.slice(6);

  function unpack(doc) {
    var n = doc.n, cols = {};
    Object.keys(doc.cols || {}).forEach(function (k) {
      var c = doc.cols[k], v = new Array(n), i;
      for (i = 0; i < n; i++) v[i] = null;
      for (i = 0; i < c.v.length && c.o + i < n; i++) v[c.o + i] = c.v[i];
      cols[k] = v;
    });
    return { t0: Date.parse(doc.t0 + 'T00:00:00Z'), t0s: doc.t0, n: n, cols: cols, bands: doc.bands || BANDS, checks: doc.checks || {}, updated: doc.updated_at };
  }
  function last(a) { var i = a ? a.length - 1 : -1; while (i >= 0 && a[i] == null) i--; return i; }
  function mean(a, i, w) {
    if (i - w + 1 < 0) return null;
    var s = 0; for (var k = i - w + 1; k <= i; k++) { if (a[k] == null) return null; s += a[k]; }
    return s / w;
  }
  function rank(a, i) {
    var cur = a[i]; if (cur == null) return null;
    var c = 0, le = 0; for (var k = 0; k <= i; k++) if (a[k] != null) { c++; if (a[k] <= cur) le++; }
    return c ? 100 * le / c : null;
  }
  function roll(a, w) { var out = new Array(a.length); for (var i = 0; i < a.length; i++) out[i] = mean(a, i, w); return out; }
  function r(x, dp) { var m = Math.pow(10, dp); return Math.round(x * m) / m; }
  function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function share(D, keys, q) { var s = 0; for (var k = 0; k < keys.length; k++) { var v = D.cols['b_' + keys[k]][q]; if (v == null) return null; s += v; } return s / 100; }

  function summary(D) {
    var s = {}, sp = D.cols.sopr || [], i = last(sp);
    if (i < 0) return s;
    s.date = iso(D.t0 + i * DAY);
    s.sopr = sp[i];
    var m7v = mean(sp, i, 7), m30 = mean(sp, i, 30);
    if (m7v != null) s.sopr7 = r(m7v, 5);
    if (m30 != null) s.sopr30 = r(m30, 5);
    var m7 = roll(sp, 7);
    if (m7[i] != null) {
      s.sopr7_pct = r(rank(m7, i), 1);
      var side = m7[i] >= 1, run = 0, k = i;
      while (k >= 0 && m7[k] != null && (m7[k] >= 1) === side) { run++; k--; }
      s.side = side ? 'profit' : 'loss'; s.side_days = run;
    }
    ['ssopr', 'lsopr', 'asopr'].forEach(function (k) { var a = D.cols[k]; if (a && a[i] != null) s[k] = a[i]; });
    if (D.cols.price && D.cols.price[i] != null) s.price = D.cols.price[i];
    var b1 = D.cols.b_d1, j = last(b1);
    if (j >= 0) {
      s.wave_date = iso(D.t0 + j * DAY);
      s.bands = {}; BANDS.forEach(function (k) { s.bands[k] = D.cols['b_' + k][j] / 100; });
      s.young6m = r(share(D, YOUNG, j), 2); s.old1y = r(share(D, OLD, j), 2);
      [[30, '30'], [365, '365']].forEach(function (p) { var q = j - p[0]; if (q >= 0 && b1[q] != null) s['old1y_chg' + p[1]] = r(share(D, OLD, j) - share(D, OLD, q), 2); });
      var olds = new Array(b1.length); for (var q = 0; q < b1.length; q++) olds[q] = b1[q] == null ? null : share(D, OLD, q);
      s.old1y_pct = r(rank(olds, j), 1);
      if (D.cols.lth && D.cols.lth[j] != null) s.lth = D.cols.lth[j] / 100;
    }
    return s;
  }

  /* a band's share on every day, in per cent (for the charts) */
  function bandSeries(D, key) { var a = D.cols['b_' + key], out = new Array(D.n); for (var i = 0; i < D.n; i++) out[i] = a[i] == null ? null : a[i] / 100; return out; }
  /* the shares of all bands on day q, in per cent, youngest first; null when the day has none */
  function bandsAt(D, q) { if (q < 0 || q >= D.n || D.cols.b_d1[q] == null) return null; return BANDS.map(function (k) { return D.cols['b_' + k][q] / 100; }); }

  var API = { BANDS: BANDS, YOUNG: YOUNG, OLD: OLD, unpack: unpack, summary: summary, roll: roll, mean: mean, rank: rank, last: last, bandSeries: bandSeries, bandsAt: bandsAt, share: share, DAY: DAY };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.OBAge = API;
})(this);
