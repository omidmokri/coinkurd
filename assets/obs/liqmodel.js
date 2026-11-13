/* entekhab.net — the Observatory (/charts/): the liquidation-level model.

   What it is: an ESTIMATE of where leveraged futures positions would be force-closed. No exchange publishes its
   traders' liquidation prices, so every "liquidation heatmap" (CoinGlass's included) is a model. This one is
   written out in full so anybody can check it:

     For every candle of every exchange feed
       1. sweep   — long levels at or above the candle's low and short levels at or below its high were reached:
                    they are removed and counted as "cleared" in that candle;
       2. close   — when open interest fell, the same share of every remaining level is removed
                    (model 3 also retires phi × volume ÷ open interest: ordinary position turnover);
       3. open    — new positions = the rise in open interest (model 3: plus phi × volume). Each new contract has
                    one long and one short. Their entry prices are spread over the candle's range (a triangle that
                    peaks at its typical price) and, for every leverage tier L, a long is liquidated at
                    entry × (1 − 1/L + mmr) and a short at entry × (1 + 1/L − mmr). A level the candle closed
                    beyond is dropped; one inside the candle's own range gets half weight (the candle may
                    already have reached it).
                    Models 2 and 3 weigh the two sides by the share of accounts that are long (the crowd's side
                    carries the liquidation risk); model 1 keeps them equal.
     The heat of a cell is the dollar value of the positions whose estimated liquidation price is in that cell.

   Assumptions that are NOT data: the leverage tiers and their equal weights, phi, and the account-ratio weighting.
   Positions opened before the first candle of a feed are invisible. Sizes are relative, not a forecast.

   Pure functions, no DOM: the same file runs in the browser (window.OBLiq) and under Node (tests/test_obs_liq.js). */
(function (root) {
  'use strict';
  var TIERS = [5, 10, 25, 50, 100];
  var PHI = 0.1;          /* model 3: the share of traded volume taken as positions changing hands */

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function fin(x) { return typeof x === 'number' && isFinite(x); }

  /* grid: { pmin, step, rows } — row r covers [pmin + r·step, pmin + (r+1)·step) */
  function makeGrid(lo, hi, rows) {
    rows = Math.max(8, rows | 0);
    if (!(hi > lo)) { hi = lo * 1.01 + 1e-9; }
    return { pmin: lo, step: (hi - lo) / rows, rows: rows };
  }
  function rowOf(g, p) { return Math.floor((p - g.pmin) / g.step); }
  function priceOf(g, r) { return g.pmin + (r + 0.5) * g.step; }

  /* the tiers a feed can really use, with weights that sum to 1 */
  function tierSet(sel, maxLev, mmr) {
    var out = [], sum = 0, i, L, w, dist;
    for (i = 0; i < TIERS.length; i++) {
      L = TIERS[i]; w = sel && fin(sel[L]) ? sel[L] : 0;
      if (!(w > 0)) continue;
      if (fin(maxLev) && L > maxLev + 1e-9) continue;        /* the contract does not offer this leverage */
      dist = 1 / L - mmr;
      if (!(dist > 0.0005)) continue;                         /* maintenance margin eats the whole distance */
      out.push({ k: i, lev: L, w: w, dist: dist }); sum += w;
    }
    for (i = 0; i < out.length; i++) out[i].w /= sum;
    return out;
  }

  /* feed: { t, h, l, c, v, oi0, oi1, ls (optional), mmr, maxLev } — arrays of equal length, time ascending.
       oi0 / oi1: open interest at the start / end of the candle in base units (NaN when unknown — then nothing opens or closes)
       ls: share of accounts that are long, 0..1 (NaN → 0.5)
     opts: { model: 1|2|3, tiers: {5:w,…}, phi, grid, colEnds: [ms…] ascending }
     A column k holds the state after every candle that starts before colEnds[k]. Candles before colEnds[0] − (one
     column) are warm-up: they build the levels the window opens with. */
  function run(feed, opts) {
    var g = opts.grid, rows = g.rows, ends = opts.colEnds, cols = ends.length, model = opts.model || 1;
    var phi = fin(opts.phi) ? opts.phi : PHI;
    var ts = tierSet(opts.tiers, feed.maxLev, fin(feed.mmr) ? feed.mmr : 0.005), nt = ts.length;
    var NT = TIERS.length;
    var L = [], S = [], k, r, i;
    for (k = 0; k < NT; k++) { L.push(new Float64Array(rows)); S.push(new Float64Array(rows)); }
    var mat = new Float32Array(cols * rows);
    var clearedL = new Float64Array(cols), clearedS = new Float64Array(cols);
    var trackL = new Float64Array(cols), trackS = new Float64Array(cols);
    var hiL = -1, loS = rows;        /* highest row holding long levels, lowest row holding short levels */
    var col = 0, accL = 0, accS = 0;
    var n = feed.t.length;

    function snapshot(c) {
      var base = c * rows, sl = 0, ss = 0, rr, kk, a, b, p;
      for (rr = 0; rr < rows; rr++) {
        a = 0; b = 0;
        for (kk = 0; kk < NT; kk++) { a += L[kk][rr]; b += S[kk][rr]; }
        if (a || b) { p = priceOf(g, rr); mat[base + rr] = (a + b) * p; sl += a * p; ss += b * p; }
      }
      clearedL[c] = accL; clearedS[c] = accS; trackL[c] = sl; trackS[c] = ss; accL = 0; accS = 0;
    }

    for (i = 0; i < n; i++) {
      while (col < cols && feed.t[i] >= ends[col]) { snapshot(col); col++; }
      if (col >= cols) break;
      var hi = feed.h[i], lo = feed.l[i], cl = feed.c[i];
      if (!(fin(hi) && fin(lo) && fin(cl))) continue;

      /* 1. sweep */
      /* a row is reached when the candle's extreme passes the row's centre (unbiased to half a row) */
      var rLo = Math.max(0, Math.ceil((lo - g.pmin) / g.step - 0.5)), rHi = Math.min(rows - 1, Math.floor((hi - g.pmin) / g.step - 0.5));
      if (hiL >= rLo) {
        for (k = 0; k < NT; k++) for (r = rLo; r <= hiL; r++) if (L[k][r]) { accL += L[k][r] * priceOf(g, r); L[k][r] = 0; }
        hiL = rLo - 1;
      }
      if (loS <= rHi) {
        for (k = 0; k < NT; k++) for (r = loS; r <= rHi; r++) if (S[k][r]) { accS += S[k][r] * priceOf(g, r); S[k][r] = 0; }
        loS = rHi + 1;
      }

      /* 2. close */
      var a0 = feed.oi0[i], a1 = feed.oi1[i], d = fin(a0) && fin(a1) ? a1 - a0 : 0;
      var opens = d > 0 ? d : 0, closeFrac = d < 0 && a0 > 0 ? -d / a0 : 0;
      if (model === 3 && fin(feed.v[i]) && a0 > 0) { var turn = phi * feed.v[i]; opens += turn; closeFrac += turn / a0; }
      if (closeFrac > 0) {
        var keep = clamp(1 - closeFrac, 0, 1);
        for (k = 0; k < NT; k++) {
          var Lk = L[k], Sk = S[k];
          for (r = 0; r <= hiL; r++) Lk[r] *= keep;
          for (r = loS; r < rows; r++) Sk[r] *= keep;
        }
      }

      /* 3. open */
      if (opens > 0 && nt) {
        var wl = 1, ws = 1;
        if (model >= 2 && feed.ls && fin(feed.ls[i])) { var q = clamp(feed.ls[i], 0.05, 0.95); wl = 2 * q; ws = 2 * (1 - q); }
        /* entry prices: a triangle over [lo, hi] peaking at the typical price, sampled once per grid row (at most 24) */
        var tp = (hi + lo + cl) / 3, span = hi - lo;
        var m = clamp(Math.ceil(span / g.step), 1, 24), wsum = 0, pts = [], j;
        for (j = 0; j < m; j++) {
          var p = m === 1 ? tp : lo + span * (j + 0.5) / m;
          var w = m === 1 ? 1 : (p <= tp ? (tp > lo ? (p - lo) / (tp - lo) : 1) : (hi > tp ? (hi - p) / (hi - tp) : 1));
          w = Math.max(w, 0.02); pts.push(p, w); wsum += w;
        }
        for (j = 0; j < m; j++) {
          var ep = pts[2 * j], share = opens * pts[2 * j + 1] / wsum;
          for (k = 0; k < nt; k++) {
            var T = ts[k], pL = ep * (1 - T.dist), pS = ep * (1 + T.dist);
            var aL = share * T.w * wl, aS = share * T.w * ws;
            /* a level the candle closed beyond is dead; one inside the candle's range may already have been reached */
            if (pL > cl) aL = 0; else if (pL >= lo) aL *= 0.5;
            if (pS < cl) aS = 0; else if (pS <= hi) aS *= 0.5;
            r = rowOf(g, pL);
            if (aL > 0 && r >= 0 && r < rows) { L[T.k][r] += aL; if (r > hiL) hiL = r; }
            r = rowOf(g, pS);
            if (aS > 0 && r >= 0 && r < rows) { S[T.k][r] += aS; if (r < loS) loS = r; }
          }
        }
      }
    }
    while (col < cols) { snapshot(col); col++; }

    /* the levels standing after the last candle, per tier, in dollars */
    var longT = [], shortT = [];
    for (k = 0; k < NT; k++) {
      var lt = new Float64Array(rows), st = new Float64Array(rows);
      for (r = 0; r < rows; r++) { var pr = priceOf(g, r); lt[r] = L[k][r] * pr; st[r] = S[k][r] * pr; }
      longT.push(lt); shortT.push(st);
    }
    return { grid: g, cols: cols, mat: mat, clearedL: clearedL, clearedS: clearedS, trackL: trackL, trackS: trackS,
      longT: longT, shortT: shortT, tiers: ts.map(function (x) { return x.lev; }) };
  }

  /* add several feeds' results (same grid, same columns) */
  function sum(list) {
    if (!list.length) return null;
    var a = list[0], rows = a.grid.rows, cols = a.cols, NT = TIERS.length, i, k, j, x;
    var o = { grid: a.grid, cols: cols, mat: new Float32Array(cols * rows), clearedL: new Float64Array(cols), clearedS: new Float64Array(cols),
      trackL: new Float64Array(cols), trackS: new Float64Array(cols), longT: [], shortT: [], tiers: [] };
    for (k = 0; k < NT; k++) { o.longT.push(new Float64Array(rows)); o.shortT.push(new Float64Array(rows)); }
    var seen = {};
    for (i = 0; i < list.length; i++) {
      x = list[i];
      for (j = 0; j < o.mat.length; j++) o.mat[j] += x.mat[j];
      for (j = 0; j < cols; j++) { o.clearedL[j] += x.clearedL[j]; o.clearedS[j] += x.clearedS[j]; o.trackL[j] += x.trackL[j]; o.trackS[j] += x.trackS[j]; }
      for (k = 0; k < NT; k++) for (j = 0; j < rows; j++) { o.longT[k][j] += x.longT[k][j]; o.shortT[k][j] += x.shortT[k][j]; }
      x.tiers.forEach(function (t) { seen[t] = 1; });
    }
    o.tiers = TIERS.filter(function (t) { return seen[t]; });
    return o;
  }

  /* the largest clusters above and below a price in the final state.
     A cluster is a peak of the (lightly smoothed) profile and the rows around it down to half the peak's height —
     so a broad band of levels gives several clusters at its crests, not one cluster as wide as the band. */
  function clusters(res, price, n) {
    var g = res.grid, rows = g.rows, NT = TIERS.length, tot = new Float64Array(rows), sm = new Float64Array(rows), r, k, mx = 0;
    for (r = 0; r < rows; r++) { var s = 0; for (k = 0; k < NT; k++) s += res.longT[k][r] + res.shortT[k][r]; tot[r] = s; }
    for (r = 0; r < rows; r++) { sm[r] = (tot[r] * 2 + (r > 0 ? tot[r - 1] : 0) + (r < rows - 1 ? tot[r + 1] : 0)) / 4; if (sm[r] > mx) mx = sm[r]; }
    var peaks = [];
    for (r = 0; r < rows; r++) {
      if (!(sm[r] > mx * 0.12)) continue;
      var top = true;
      for (k = Math.max(0, r - 3); k <= Math.min(rows - 1, r + 3); k++) if (sm[k] > sm[r] || (sm[k] === sm[r] && k < r)) { top = false; break; }
      if (top) peaks.push(r);
    }
    peaks.sort(function (a, b) { return sm[b] - sm[a]; });
    var taken = new Uint8Array(rows), out = [];
    peaks.forEach(function (pr) {
      if (taken[pr]) return;
      var half = sm[pr] * 0.5, a = pr, b = pr;
      while (a > 0 && !taken[a - 1] && sm[a - 1] >= half && sm[a - 1] <= sm[a] * 1.0001) a--;
      while (b < rows - 1 && !taken[b + 1] && sm[b + 1] >= half && sm[b + 1] <= sm[b] * 1.0001) b++;
      var usd = 0; for (var i = a; i <= b; i++) { usd += tot[i]; taken[i] = 1; }
      var c = { r0: a, r1: b, usd: usd, peak: tot[pr], peakRow: pr };
      c.price = priceOf(g, pr); c.lo = g.pmin + a * g.step; c.hi = g.pmin + (b + 1) * g.step;
      c.side = c.price < price ? 'long' : 'short'; c.dist = (c.price / price - 1) * 100;
      out.push(c);
    });
    var above = out.filter(function (c) { return c.side === 'short'; }).sort(function (a, b) { return b.usd - a.usd; }).slice(0, n || 3);
    var below = out.filter(function (c) { return c.side === 'long'; }).sort(function (a, b) { return b.usd - a.usd; }).slice(0, n || 3);
    return { above: above, below: below, max: mx };
  }

  var api = { TIERS: TIERS, PHI: PHI, makeGrid: makeGrid, rowOf: rowOf, priceOf: priceOf, tierSet: tierSet, run: run, sum: sum, clusters: clusters };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OBLiq = api;
})(typeof window !== 'undefined' ? window : this);
