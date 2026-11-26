/* entekhab.net — the Observatory: the on-chain measures the other pages do not draw (pure: no DOM, no network;
   python3 tests/test_obs_xchain.py checks it). Built ONLY from files the site already collects — no new source, no key, nothing extra
   to download for a visitor beyond the file the page shows:
     data/obs/chain_<asset>.json   Coin Metrics community data (scripts/obs_chain.py; columns in assets/obs/chainmath.js)
     data/btcinfo.json             mining pools of the last week (scripts/btcinfo.py, mempool.space)
     data/chain.json               reachable Bitcoin nodes (scripts/chain.py)
     data/obs/xchain_rot.json      weekly realized and market value of seven chains (scripts/obs_xchain.py)

   Every definition, one line each (an average or a window needs all of its days, else null — never a guess):
     miner revenue (USD)   = (iss + fee) × price           thermocap = running sum of miner revenue since the first block
                                                            (coins mined before the first price, July 2010, count at $0)
     thermocap multiple    = market value ÷ thermocap       realized/thermo = realized value ÷ thermocap
     average cap           = mean of the market value over every day since the first price
     delta cap             = realized value − average cap   top cap = 35 × average cap
     delta / top / average price = the cap ÷ coins in existence
     channel position (%)  = (ln price − ln delta price) ÷ (ln top price − ln delta price) × 100
     capital flow          = realized value today − realized value N days ago (dollars that changed hands at a higher
                             or lower price than they last moved at); also as a per cent of the older value
     hashprice             = miner revenue ÷ hash rate: dollars per PH/s per day, and satoshis per TH/s per day
     NVM (Metcalfe)        = market value ÷ (30-day mean of active addresses)², divided by its median over all history
     NVM Z (365 days)      = (ln NVM − its 365-day mean) ÷ its 365-day standard deviation
     ETH: net issuance over N days = supply today − supply N days ago; burned = coins issued in those days − net issuance
          (the supply is stored at six significant digits, ±1,000 ETH, so only 90- and 365-day windows are shown)
     on-chain temperature  = mean of the expanding percentiles of MVRV Z, Puell, Mayer, 200-week multiple, 2-year
                             multiplier and thermocap multiple (each ranks a day only among the days before it, so no
                             day knows its future); a day is scored only when all the chain's inputs are there
     Nakamoto coefficient  = fewest pools whose blocks add up to more than half; HHI = Σ share² × 10,000
   summary() is mirrored line by line by scripts/obs_xchain.py (the bot reads that one); the test compares the two. */
(function (root) {
  'use strict';
  var CM = (typeof module !== 'undefined' && module.exports) ? require('./chainmath.js') : root.OBChain;
  var DAY = 86400000;
  var MERGE = '2022-09-15', SCORE_FROM = '2012-01-01';
  var SCORE_KEYS = ['mvrvz', 'puell', 'mayer', 'w200', 'y2', 'tmult'];

  function nulls(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = null; return a; }
  function idxOf(D, iso) { return Math.round((Date.parse(iso + 'T00:00:00Z') - D.t0) / DAY); }
  function first(a) { for (var i = 0; i < a.length; i++) if (a[i] != null) return i; return -1; }

  /* expanding percentile of every day: share of the days up to and including it whose value is ≤ its own —
     the same figure as OBChain.rank(a, i), for all i at once (a Fenwick tree over the sorted values: n log n) */
  function expRank(a) {
    var n = a.length, out = nulls(n), vals = [], i;
    for (i = 0; i < n; i++) if (a[i] != null && isFinite(a[i])) vals.push(a[i]);
    if (!vals.length) return out;
    vals.sort(function (x, y) { return x - y; });
    var u = [vals[0]]; for (i = 1; i < vals.length; i++) if (vals[i] !== u[u.length - 1]) u.push(vals[i]);
    var bit = new Int32Array(u.length + 1), cnt = 0;
    function pos(v) { var lo = 0, hi = u.length - 1; while (lo < hi) { var m = (lo + hi) >> 1; if (u[m] < v) lo = m + 1; else hi = m; } return lo + 1; }
    for (i = 0; i < n; i++) {
      var v = a[i]; if (v == null || !isFinite(v)) continue;
      var p = pos(v), q;
      for (q = p; q <= u.length; q += q & -q) bit[q]++;
      cnt++;
      var le = 0; for (q = p; q > 0; q -= q & -q) le += bit[q];
      out[i] = 100 * le / cnt;
    }
    return out;
  }
  function median(a) {
    var v = a.filter(function (x) { return x != null && isFinite(x); }).sort(function (x, y) { return x - y; });
    if (!v.length) return null;
    var m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  /* every series this module draws for one chain file (computed once, kept on D) */
  function xseries(D) {
    if (D._xser) return D._xser;
    var c = D.cols, n = D.n, z = nulls(n), S0 = CM.series(D), price = S0.price, i;
    var X = { price: price, rprice: S0.rprice, mcap: S0.mcap, rcap: S0.rcap };
    /* thermocap: miner revenue summed from the first block; a day without a price adds nothing */
    var rev = nulls(n), tc = nulls(n), run = 0, iss = c.iss || z, fee = c.fee || z, f0 = first(price);
    for (i = 0; i < n; i++) {
      if (iss[i] == null && fee[i] == null) continue;   /* a day the source has nothing for keeps no thermocap */
      if (price[i] != null) { rev[i] = ((iss[i] || 0) + (fee[i] || 0)) * price[i]; run += rev[i]; }
      if (i >= f0 && f0 >= 0) tc[i] = run;
    }
    X.rev = rev; X.thermo = tc;
    X.tmult = nulls(n); X.rtc = nulls(n);
    for (i = 0; i < n; i++) if (tc[i] > 0) { if (X.mcap[i] != null) X.tmult[i] = X.mcap[i] / tc[i]; if (X.rcap[i] != null) X.rtc[i] = X.rcap[i] / tc[i]; }
    /* average, delta and top cap */
    var sply = c.sply || z, acc = 0, k = 0;
    X.avgcap = nulls(n); X.deltacap = nulls(n); X.topcap = nulls(n);
    X.avgprice = nulls(n); X.deltaprice = nulls(n); X.topprice = nulls(n); X.chpos = nulls(n);
    for (i = Math.max(0, f0); i < n && f0 >= 0; i++) {
      if (X.mcap[i] == null) { acc = null; }
      if (acc == null) continue;                       /* a missing day breaks the running mean for good: no guess */
      acc += X.mcap[i]; k++;
      var avg = acc / k; X.avgcap[i] = avg; X.topcap[i] = 35 * avg;
      if (X.rcap[i] != null) X.deltacap[i] = X.rcap[i] - avg;
      if (sply[i]) {
        X.avgprice[i] = avg / sply[i]; X.topprice[i] = 35 * avg / sply[i];
        if (X.deltacap[i] != null) X.deltaprice[i] = X.deltacap[i] / sply[i];
        var dp = X.deltaprice[i], tp = X.topprice[i], p = price[i];
        if (dp > 0 && tp > dp && p > 0) X.chpos[i] = (Math.log(p) - Math.log(dp)) / (Math.log(tp) - Math.log(dp)) * 100;
      }
    }
    /* capital flow through the realized value */
    X.rflow30 = nulls(n); X.rflow90 = nulls(n); X.rpct30 = nulls(n); X.rpct90 = nulls(n);
    for (i = 0; i < n; i++) {
      if (X.rcap[i] == null) continue;
      if (i >= 30 && X.rcap[i - 30] != null) { X.rflow30[i] = X.rcap[i] - X.rcap[i - 30]; if (X.rcap[i - 30] > 0) X.rpct30[i] = (X.rcap[i] / X.rcap[i - 30] - 1) * 100; }
      if (i >= 90 && X.rcap[i - 90] != null) { X.rflow90[i] = X.rcap[i] - X.rcap[i - 90]; if (X.rcap[i - 90] > 0) X.rpct90[i] = (X.rcap[i] / X.rcap[i - 90] - 1) * 100; }
    }
    /* hashprice (hash rate in Coin Metrics is TH/s) */
    var hs = D.asset === 'btc' ? (c.hash || z) : z;   /* other chains' hash rate is in other units and other algorithms */
    X.hpusd = nulls(n); X.hpsat = nulls(n);
    for (i = 0; i < n; i++) if (hs[i] > 0 && iss[i] != null && fee[i] != null) {
      X.hpsat[i] = (iss[i] + fee[i]) * 1e8 / hs[i];
      if (price[i] != null) X.hpusd[i] = (iss[i] + fee[i]) * price[i] / hs[i] * 1000;
    }
    X.hpusd30 = CM.sma(X.hpusd, 30); X.hpsat30 = CM.sma(X.hpsat, 30);
    /* Metcalfe: NVM against its median over all history */
    var adr30 = CM.sma(c.adr || z, 30), raw = nulls(n);
    for (i = 0; i < n; i++) if (X.mcap[i] != null && adr30[i] > 0) raw[i] = X.mcap[i] / (adr30[i] * adr30[i]);
    var med = median(raw), lr = nulls(n);
    X.adr30 = adr30; X.nvm = nulls(n); X.nvmz = nulls(n);
    for (i = 0; i < n; i++) if (raw[i] != null && med) { X.nvm[i] = raw[i] / med; lr[i] = Math.log(X.nvm[i]); }
    /* how far today's ratio sits from its own past year, in standard deviations: active addresses drift for reasons of
       their own (batching, address reuse, layer two), so the level is compared with the recent past, not with 2013 */
    var LP = CM.sma(lr, 365), L2 = CM.sma(lr.map(function (x) { return x == null ? null : x * x; }), 365);
    for (i = 0; i < n; i++) if (lr[i] != null && LP[i] != null) { var va = L2[i] - LP[i] * LP[i]; if (va > 1e-12) X.nvmz[i] = (lr[i] - LP[i]) / Math.sqrt(va); }
    /* Ether: net issuance and burn over 90 and 365 days */
    X.sincemerge = nulls(n); X.infl365 = nulls(n); X.infl90 = nulls(n); X.burn365 = nulls(n); X.burn90 = nulls(n); X.iss365 = nulls(n); X.israte365 = nulls(n);
    if (D.asset === 'eth') {
      var m0 = idxOf(D, MERGE), I = CM.rsum(iss, 365), I90 = CM.rsum(iss, 90);
      for (i = 0; i < n; i++) {
        if (sply[i] == null) continue;
        if (m0 >= 0 && i >= m0 && sply[m0] != null) X.sincemerge[i] = sply[i] - sply[m0];
        if (i >= 365 && sply[i - 365] != null) {
          var d365 = sply[i] - sply[i - 365]; X.infl365[i] = d365 / sply[i - 365] * 100;
          if (I[i] != null) { X.burn365[i] = I[i] - d365; X.iss365[i] = I[i]; X.israte365[i] = I[i] / sply[i - 365] * 100; }
        }
        if (i >= 90 && sply[i - 90] != null) {
          var d90 = sply[i] - sply[i - 90]; X.infl90[i] = d90 / sply[i - 90] * 100 * 365 / 90;
          if (I90[i] != null) X.burn90[i] = I90[i] - d90;
        }
      }
    }
    /* the on-chain temperature (Bitcoin: every input exists from 2012) */
    var der = D._der || (D._der = CM.derived(c, n)), comp = { mvrvz: der.mvrvz, puell: der.puell, mayer: der.mayer, w200: der.w200, y2: der.y2, tmult: X.tmult };
    X.pct = {};
    SCORE_KEYS.forEach(function (key) { X.pct[key] = expRank(comp[key]); });
    /* a day counts only when every measure this chain has is there: a last day that lacks one (Coin Metrics publishes
       the market-to-realized ratio a day after the price) would otherwise be scored on fewer inputs than its history */
    X.score = nulls(n); X.scoreN = 0;
    var s0 = Math.max(0, idxOf(D, SCORE_FROM)), cntA = nulls(n), sumA = nulls(n);
    for (i = s0; i < n; i++) {
      var sum = 0, m = 0;
      SCORE_KEYS.forEach(function (key) { var v = X.pct[key][i]; if (v != null) { sum += v; m++; } });
      cntA[i] = m; sumA[i] = sum; if (m > X.scoreN) X.scoreN = m;
    }
    /* until the first day that has them all (the 200-week multiple needs 1,400 days of prices, so May 2014 for Bitcoin),
       a day missing one input is scored on the rest; from that day on, all of them */
    var full = -1; for (i = s0; i < n; i++) if (cntA[i] === X.scoreN) { full = i; break; }
    if (X.scoreN >= 4) for (i = s0; i < n; i++) if (cntA[i] === X.scoreN || (i < full && cntA[i] === X.scoreN - 1)) X.score[i] = sumA[i] / cntA[i];
    return (D._xser = X);
  }

  /* the five bands of the temperature, and what followed each in the past: the median change of the price over the next
     365 days, the share of those days that ended higher, and how many days it rests on */
  var BANDS = [0, 20, 40, 60, 80, 100.0001];
  function band(v) { if (v == null) return null; for (var b = 0; b < 5; b++) if (v < BANDS[b + 1]) return b; return 4; }
  function backtest(D, ahead) {
    var X = xseries(D), p = X.price, n = D.n, h = ahead || 365, out = [];
    for (var b = 0; b < 5; b++) out.push({ band: b, n: 0, up: 0, rets: [] });
    for (var i = 0; i + h < n; i++) {
      var s = X.score[i]; if (s == null || p[i] == null || p[i + h] == null) continue;
      var o = out[band(s)], r = (p[i + h] / p[i] - 1) * 100;
      o.n++; o.rets.push(r); if (r > 0) o.up++;
    }
    return out.map(function (o) { return { band: o.band, n: o.n, up: o.n ? o.up / o.n * 100 : null, median: median(o.rets) }; });
  }

  /* the latest day's figures — mirrored by scripts/obs_xchain.summary */
  function summary(D) {
    var X = xseries(D), s = {}, i = CM.last(X.price);
    if (i < 0) return s;
    s.date = CM.dayStr(D.t0, i); s.price = X.price[i];
    function put(key, a, j) { j = j == null ? i : j; if (a[j] != null && isFinite(a[j])) s[key] = a[j]; }
    var v = CM.last(X.rcap);                          /* the realized value comes a day after the price: its own day */
    if (v >= 0) {
      s.val_date = CM.dayStr(D.t0, v);
      put('rprice', X.rprice, v); put('rcap', X.rcap, v); put('avgprice', X.avgprice, v); put('deltaprice', X.deltaprice, v); put('topprice', X.topprice, v); put('chpos', X.chpos, v);
      put('rflow30', X.rflow30, v); put('rflow90', X.rflow90, v); put('rpct30', X.rpct30, v); put('rpct90', X.rpct90, v); put('rtc', X.rtc, v);
    }
    var t = CM.last(X.tmult);
    if (t >= 0) { s.thermo_date = CM.dayStr(D.t0, t); s.thermo = X.thermo[t]; s.tmult = X.tmult[t]; s.tmult_pct = CM.rank(X.tmult, t); }
    var h = CM.last(X.hpusd);
    if (h >= 0) { s.hp_date = CM.dayStr(D.t0, h); s.hpusd = X.hpusd[h]; s.hpsat = X.hpsat[h]; s.hpusd_pct = CM.rank(X.hpusd, h); if (X.hpusd30[h] != null) s.hpusd30 = X.hpusd30[h]; }
    var q = CM.last(X.nvm);
    if (q >= 0) { s.nvm_date = CM.dayStr(D.t0, q); s.nvm = X.nvm[q]; s.nvm_pct = CM.rank(X.nvm, q); if (X.nvmz[q] != null) s.nvmz = X.nvmz[q]; }
    if (D.asset === 'eth') {
      var e = CM.last(X.infl365);
      if (e >= 0) {
        s.eth_date = CM.dayStr(D.t0, e);
        put('sply', D.cols.sply, e); put('sincemerge', X.sincemerge, e); put('infl365', X.infl365, e); put('infl90', X.infl90, e);
        put('burn365', X.burn365, e); put('burn90', X.burn90, e); put('iss365', X.iss365, e); put('israte365', X.israte365, e);
      }
    }
    var k = CM.last(X.score);
    if (k >= 0) {
      s.score_date = CM.dayStr(D.t0, k); s.score = X.score[k]; s.score_band = band(s.score); s.score_n = X.scoreN; s.parts = {};
      SCORE_KEYS.forEach(function (key) { if (X.pct[key][k] != null) s.parts[key] = X.pct[key][k]; });
      if (k >= 30 && X.score[k - 30] != null) s.score30 = X.score[k - 30];
    }
    return s;
  }

  /* mining pools of the last week (data/btcinfo.json → pools: {total, list: [[name, blocks], …]} — the largest ones) */
  function pools(P) {
    if (!P || typeof P.total !== 'number' || !(P.total > 0) || !isFinite(P.total) || !Array.isArray(P.list)) return null;
    /* only rows that are [name, a finite block count]; names are cut to 40 characters like scripts/obs_xchain.py */
    var list = P.list.filter(function (r) { return Array.isArray(r) && typeof r[1] === 'number' && isFinite(r[1]) && r[1] >= 0; })
      .map(function (r) { return [String(r[0] == null ? '' : r[0]).slice(0, 40), r[1]]; });
    if (!list.length) return null;
    list.sort(function (a, b) { return b[1] - a[1]; });
    var tot = P.total, run = 0, nc = null, hhi = 0, listed = 0;
    var rows = list.map(function (r, k) {
      var sh = r[1] / tot; run += sh; listed += r[1]; hhi += sh * sh * 10000;
      if (nc == null && run > 0.5) nc = k + 1;
      return { name: r[0], blocks: r[1], share: sh * 100, cum: run * 100 };
    });
    var rest = tot - listed;
    return { total: tot, rows: rows, nakamoto: nc, hhi: hhi, rest: rest, rest_share: rest / tot * 100, top1: rows[0].share, top2: rows.length > 1 ? rows[0].share + rows[1].share : rows[0].share,
      /* the pools not listed add at least nothing and at most (rest share)² to the HHI: it is shown as "at least" */
      hhi_min: hhi };
  }

  /* weekly realized and market value of several chains (data/obs/xchain_rot.json) → shares in per cent */
  var ROT_ASSETS = ['btc', 'eth', 'ltc', 'bch', 'doge', 'ada', 'xrp'];
  function rotation(R) {
    if (!R || !Array.isArray(R.t) || !Array.isArray(R.assets) || !R.rcap || !R.mcap) return null;
    var n = R.t.length, A = ROT_ASSETS.filter(function (a) {           /* only known chains, each with a full column */
      return R.assets.indexOf(a) >= 0 && Array.isArray(R.rcap[a]) && Array.isArray(R.mcap[a]) && R.rcap[a].length === n && R.mcap[a].length === n;
    });
    if (A.length < 2) return null;
    var out = { t: R.t, assets: A, rshare: {}, mshare: {} };
    A.forEach(function (a) { out.rshare[a] = nulls(n); out.mshare[a] = nulls(n); });
    for (var i = 0; i < n; i++) {
      var rt = 0, mt = 0, ok = true;
      A.forEach(function (a) { var r = R.rcap[a][i], m = R.mcap[a][i]; if (r == null || m == null) ok = false; else { rt += r; mt += m; } });
      if (!ok || !rt || !mt) continue;               /* a week some chain lacks is left out rather than shared among the rest */
      A.forEach(function (a) { out.rshare[a][i] = R.rcap[a][i] / rt * 100; out.mshare[a][i] = R.mcap[a][i] / mt * 100; });
    }
    return out;
  }

  var api = { MERGE: MERGE, SCORE_KEYS: SCORE_KEYS, BANDS: BANDS, band: band, expRank: expRank, median: median, xseries: xseries,
    backtest: backtest, summary: summary, pools: pools, rotation: rotation };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OBX = api;
})(typeof window !== 'undefined' ? window : this);
