/* entekhab.net — the Observatory: on-chain and cycle arithmetic (pure: no DOM, no network; node tests/test_obs_chain.js).

   Input: data/obs/chain_<asset>.json (scripts/obs_chain.py, Coin Metrics community data): one value a day per column,
     price  PriceUSD   close of the UTC day, dollars          mvrv  CapMVRVCur  market value ÷ realized value
     sply   SplyCur    coins in existence                     iss   IssTotNtv   coins issued that day
     fee    FeeTotNtv  fees paid that day, coins              hash  HashRate    TH/s (Bitcoin only)
     adr    AdrActCnt  active addresses    tx  TxCnt  transactions    tfr  TxTfrCnt  transfers
     fin / fout  FlowInExNtv / FlowOutExNtv  coins sent to / withdrawn from exchanges    sex  SplyExNtv  coins held on exchanges

   Everything else is derived here, and each line below is the whole definition:
     market value   = price × sply                    realized value = market value ÷ mvrv
     realized price = price ÷ mvrv                    NUPL           = 1 − 1 ÷ mvrv
     MVRV Z-score   = (market value − realized value) ÷ standard deviation of the market value over all days so far
     Puell multiple = (iss × price) ÷ its 365-day average          miner revenue = (iss + fee) × price
     fee share      = fee ÷ (iss + fee)                             stock-to-flow = sply ÷ coins issued in the last 365 days
     net flow       = fin − fout (positive: more coins went to exchanges than left)
     Mayer multiple = price ÷ 200-day average          200-week average = 1400-day average
     Pi cycle       = 111-day average against 2 × the 350-day average       2-year multiplier = 730-day average, and 5 × it
     drawdown       = price ÷ highest close so far − 1
   An average needs every one of its days: where a day is missing the result is null, never a guess.
   summary() is mirrored line by line by scripts/obs_chain.py (the bot reads that one); the test compares the two. */
(function (root) {
  'use strict';
  var DAY = 86400000;

  function unpack(doc) {
    var n = doc.n, cols = {}, t0 = Date.parse(doc.t0 + 'T00:00:00Z');
    Object.keys(doc.cols || {}).forEach(function (k) {
      var c = doc.cols[k], v = new Array(n), i;
      for (i = 0; i < n; i++) v[i] = null;
      for (i = 0; i < c.v.length && c.o + i < n; i++) v[c.o + i] = c.v[i];
      cols[k] = v;
    });
    return { asset: doc.asset, t0: t0, n: n, cols: cols, updated: doc.updated_at, source: doc.source };
  }
  function dayStr(t0, i) { return new Date(t0 + i * DAY).toISOString().slice(0, 10); }
  function last(a, upto) {
    if (!a || !a.length) return -1;
    var i = Math.min(a.length - 1, upto == null ? a.length - 1 : upto);
    while (i >= 0 && a[i] == null) i--;
    return i;
  }
  /* prefix sums that remember gaps: mean and sum of any window in O(1) */
  function prefix(a) {
    var n = a.length, s = new Float64Array(n + 1), g = new Int32Array(n + 1);
    for (var i = 0; i < n; i++) { s[i + 1] = s[i] + (a[i] == null ? 0 : a[i]); g[i + 1] = g[i] + (a[i] == null ? 1 : 0); }
    return { s: s, g: g };
  }
  function winSum(p, i, w) { return (i - w + 1 < 0 || p.g[i + 1] - p.g[i + 1 - w]) ? null : p.s[i + 1] - p.s[i + 1 - w]; }
  function sma(a, w) { var p = prefix(a), out = new Array(a.length); for (var i = 0; i < a.length; i++) { var x = winSum(p, i, w); out[i] = x == null ? null : x / w; } return out; }
  function rsum(a, w) { var p = prefix(a), out = new Array(a.length); for (var i = 0; i < a.length; i++) out[i] = winSum(p, i, w); return out; }
  function mean(a, i, w) { if (!a || i - w + 1 < 0) return null; var s = 0; for (var k = i - w + 1; k <= i; k++) { if (a[k] == null) return null; s += a[k]; } return s / w; }
  function sum(a, i, w) { var m = mean(a, i, w); return m == null ? null : m * w; }
  function map2(a, b, f) { var out = new Array(a.length); for (var i = 0; i < a.length; i++) out[i] = (a[i] == null || b[i] == null) ? null : f(a[i], b[i]); return out; }
  function map1(a, f) { var out = new Array(a.length); for (var i = 0; i < a.length; i++) out[i] = a[i] == null ? null : f(a[i]); return out; }
  /* share (per cent) of the days up to i whose value is at or below day i's */
  function rank(a, i) {
    var cur = a[i]; if (cur == null) return null;
    var n = 0, le = 0;
    for (var k = 0; k <= i; k++) if (a[k] != null) { n++; if (a[k] <= cur) le++; }
    return n ? 100 * le / n : null;
  }
  function nulls(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = null; return a; }

  /* the series the dashboard ranks today against (the same loop as obs_chain.derived) */
  function derived(cols, n) {
    var price = cols.price, mvrv = cols.mvrv, sply = cols.sply, iss = cols.iss;
    var out = { mvrvz: nulls(n), puell: nulls(n), mayer: nulls(n), w200: nulls(n), pi: nulls(n), y2: nulls(n), dd: nulls(n), nupl: nulls(n) };
    if (!price) return out;
    var issusd = nulls(n), i;
    for (i = 0; i < n; i++) if (price[i] != null && iss && iss[i] != null) issusd[i] = iss[i] * price[i];
    var P = prefix(price), I = prefix(issusd), cnt = 0, s1 = 0, s2 = 0, ath = null;
    function ma(k, w) { var x = winSum(P, k, w); return x == null ? null : x / w; }
    for (i = 0; i < n; i++) {
      var p = price[i]; if (p == null) continue;
      ath = (ath == null || p > ath) ? p : ath;
      out.dd[i] = (p / ath - 1) * 100;
      var m200 = ma(i, 200), m1400 = ma(i, 1400), m111 = ma(i, 111), m350 = ma(i, 350), m730 = ma(i, 730);
      if (m200) out.mayer[i] = p / m200;
      if (m1400) out.w200[i] = p / m1400;
      if (m111 && m350) out.pi[i] = m111 / (2 * m350);
      if (m730) out.y2[i] = p / m730;
      var ys = winSum(I, i, 365);
      if (ys != null && issusd[i] != null) { var avg = ys / 365; if (avg > 0) out.puell[i] = issusd[i] / avg; }
      if (mvrv && mvrv[i] && sply && sply[i] != null) {
        var mc = p * sply[i];
        cnt++; s1 += mc; s2 += mc * mc;
        var v = s2 / cnt - (s1 / cnt) * (s1 / cnt);
        out.nupl[i] = 1 - 1 / mvrv[i];
        if (cnt > 1 && v > 0) out.mvrvz[i] = (mc - mc / mvrv[i]) / Math.sqrt(v);
      }
    }
    return out;
  }

  /* the latest day's figures (keys absent when their inputs are) — mirrored by scripts/obs_chain.summary */
  function summary(D) {
    var c = D.cols, n = D.n, price = c.price, mvrv = c.mvrv, sply = c.sply, s = {};
    var i = last(price); if (i < 0) return s;
    var der = D._der || (D._der = derived(c, n)), p = price[i];
    s.date = dayStr(D.t0, i); s.price = p;
    if (mvrv && mvrv[i]) { s.mvrv = mvrv[i]; s.rprice = p / mvrv[i]; s.nupl = 1 - 1 / mvrv[i]; s.mvrv_pct = rank(mvrv, i); }
    if (sply && sply[i] != null) { s.mcap = p * sply[i]; if (mvrv && mvrv[i]) s.rcap = s.mcap / mvrv[i]; }
    ['mvrvz', 'puell', 'mayer', 'w200', 'pi', 'y2', 'dd'].forEach(function (k) { if (der[k][i] != null) { s[k] = der[k][i]; s[k + '_pct'] = rank(der[k], i); } });
    [[200, 'ma200'], [1400, 'ma1400'], [111, 'ma111'], [350, 'ma350'], [730, 'ma730']].forEach(function (x) { var m = mean(price, i, x[0]); if (m != null) s[x[1]] = m; });
    var iss = c.iss, fee = c.fee;
    if (iss && fee && iss[i] != null && fee[i] != null && iss[i] + fee[i] > 0) { s.fee_share = fee[i] / (iss[i] + fee[i]) * 100; s.rev_usd = (iss[i] + fee[i]) * p; }
    if (iss && sply && sply[i] != null) { var y = sum(iss, i, 365); if (y) s.s2f = sply[i] / y; }
    var fin = c.fin, fout = c.fout, sex = c.sex;
    if (fin && fout && sex) {
      var j = Math.min(last(fin), last(fout), last(sex));
      if (j >= 0) {
        var net = map2(fin, fout, function (a, b) { return a - b; });
        s.flow_date = dayStr(D.t0, j); s.sex = sex[j]; s.fin = fin[j]; s.fout = fout[j]; s.net1 = net[j];
        var n7 = sum(net, j, 7), n30 = sum(net, j, 30);
        if (n7 != null) s.net7 = n7; if (n30 != null) s.net30 = n30;
        if (j - 30 >= 0 && sex[j - 30] != null) s.sex_chg30 = sex[j] - sex[j - 30];
        if (price[j] != null) s.sex_usd = sex[j] * price[j];
        if (sply && sply[j]) s.sex_share = sex[j] / sply[j] * 100;
      }
    }
    var hs = c.hash;
    if (hs) {
      var k = last(hs);
      if (k >= 0) {
        s.hash_date = dayStr(D.t0, k); s.hash = hs[k] / 1e6;
        var h30 = mean(hs, k, 30), h60 = mean(hs, k, 60);
        if (h30 != null) s.hash30 = h30 / 1e6; if (h60 != null) s.hash60 = h60 / 1e6;
      }
    }
    [['adr', 'adr7'], ['tx', 'tx7']].forEach(function (x) { var a = c[x[0]]; if (!a) return; var q = last(a), m = q >= 0 ? mean(a, q, 7) : null; if (m != null) s[x[1]] = m; });
    return s;
  }

  /* every series the charts draw, by name (computed once per file) */
  function series(D) {
    if (D._ser) return D._ser;
    var c = D.cols, n = D.n, z = nulls(n), price = c.price || z, der = D._der || (D._der = derived(c, n));
    var S = { price: price, mvrv: c.mvrv || z, nupl: der.nupl, mvrvz: der.mvrvz, puell: der.puell, mayer: der.mayer, w200: der.w200, pi: der.pi, y2: der.y2, dd: der.dd };
    S.mcap = map2(price, c.sply || z, function (p, s) { return p * s; });
    S.rcap = map2(S.mcap, c.mvrv || z, function (m, v) { return v ? m / v : null; });
    S.rprice = map2(price, c.mvrv || z, function (p, v) { return v ? p / v : null; });
    S.issusd = map2(c.iss || z, price, function (a, p) { return a * p; });
    S.revusd = map2(map2(c.iss || z, c.fee || z, function (a, b) { return a + b; }), price, function (a, p) { return a * p; });
    S.feeshare = map2(c.fee || z, c.iss || z, function (f, s) { return f + s > 0 ? f / (f + s) * 100 : null; });
    S.s2f = map2(c.sply || z, rsum(c.iss || z, 365), function (s, y) { return y > 0 ? s / y : null; });
    S.fin = c.fin || z; S.fout = c.fout || z; S.sex = c.sex || z;
    S.net = map2(S.fin, S.fout, function (a, b) { return a - b; });
    S.net7 = rsum(S.net, 7); S.net30 = rsum(S.net, 30);
    S.fin7 = sma(S.fin, 7); S.fout7 = sma(S.fout, 7);
    S.sexusd = map2(S.sex, price, function (a, p) { return a * p; });
    S.sexshare = map2(S.sex, c.sply || z, function (a, s) { return s ? a / s * 100 : null; });
    S.hash = map1(c.hash || z, function (h) { return h / 1e6; });
    S.hash30 = sma(S.hash, 30); S.hash60 = sma(S.hash, 60);
    S.adr = c.adr || z; S.adr7 = sma(S.adr, 7); S.tx = c.tx || z; S.tx7 = sma(S.tx, 7); S.tfr = c.tfr || z; S.tfr7 = sma(S.tfr, 7);
    S.ma200 = sma(price, 200); S.ma1400 = sma(price, 1400); S.ma111 = sma(price, 111); S.ma350 = sma(price, 350); S.ma730 = sma(price, 730);
    S.ma350x2 = map1(S.ma350, function (v) { return v * 2; }); S.ma730x5 = map1(S.ma730, function (v) { return v * 5; });
    S.gold16 = map1(S.ma350, function (v) { return v * 1.6; }); S.gold3 = map1(S.ma350, function (v) { return v * 3; }); S.gold5 = map1(S.ma350, function (v) { return v * 5; });
    return (D._ser = S);
  }
  /* [[time, value], …] of a series, days without a value left out; `from` = first index wanted */
  function pairs(D, a, from) {
    var out = [];
    for (var i = Math.max(0, from || 0); i < D.n; i++) if (a[i] != null && isFinite(a[i])) out.push([D.t0 + i * DAY, a[i]]);
    return out;
  }

  /* the bands these measures are conventionally read with. They are conventions drawn from a few past cycles — not laws:
     the pages show them as tinted zones and say how much of history sat at or below today's value. */
  var ZONES = {
    mvrv: { lo: 1, hi: 3.7 }, mvrvz: { lo: 0, hi: 7 }, puell: { lo: 0.5, hi: 4 }, mayer: { lo: 0.8, hi: 2.4 }, pi: { hi: 1 }, y2: { lo: 1, hi: 5 }, w200: { lo: 1 },
    nupl: [0, 0.25, 0.5, 0.75]            /* below 0 capitulation · hope · optimism · belief · above 0.75 euphoria */
  };
  function nuplZone(v) { return v == null ? null : v < 0 ? 0 : v < 0.25 ? 1 : v < 0.5 ? 2 : v < 0.75 ? 3 : 4; }
  /* −1 below the low band, +1 above the high band, 0 between */
  function zoneOf(k, v) { var z = ZONES[k]; if (v == null || !z || Array.isArray(z)) return null; return (z.hi != null && v >= z.hi) ? 1 : (z.lo != null && v <= z.lo) ? -1 : 0; }

  var api = { DAY: DAY, unpack: unpack, dayStr: dayStr, last: last, sma: sma, rsum: rsum, mean: mean, sum: sum, rank: rank, derived: derived, summary: summary,
    series: series, pairs: pairs, ZONES: ZONES, nuplZone: nuplZone, zoneOf: zoneOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OBChain = api;
})(typeof window !== 'undefined' ? window : this);
