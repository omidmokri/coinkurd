/* entekhab.net — the Observatory: options arithmetic (pure: no DOM, no network; node tests/test_obs_opt.js).

   Input: Deribit's public book summary of every option of a currency — one row per instrument
     instrument_name 'BTC-27NOV26-70000-C' (currency, expiry day, strike in dollars, Call or Put; expiry is 08:00 UTC),
     open_interest and volume (24 hours) in coins, mark_iv in per cent, underlying_price (the future of that expiry),
     estimated_delivery_price (the index).
   Definitions used on the page, each complete here:
     put/call ratio = puts ÷ calls (open interest, or 24-hour volume)
     notional       = open interest in coins × the index price
     max pain       = the strike S at which the options of one expiry are worth the least to their holders in total:
                      Σ calls OI × max(0, S − K) + Σ puts OI × max(0, K − S), smallest over the listed strikes
                      (the lowest strike wins a tie — the same rule as scripts/lab.py, whose figure the bot shows)
     at-the-money IV = mark IV at the underlying price, read between the two strikes around it (mean of call and put)
   Max pain is arithmetic on open interest, not a forecast of the settlement price. */
(function (root) {
  'use strict';
  var DAY = 86400000;
  var MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

  function parseName(name) {
    var m = /^([A-Z]+)-(\d{1,2})([A-Z]{3})(\d{2})-(\d+(?:d\d+)?)-([CP])$/.exec(String(name || ''));
    if (!m || MON[m[3]] == null) return null;
    var k = +m[5].replace('d', '.');                      /* Deribit writes a decimal point in a strike as "d" (0d5) */
    if (!(k > 0)) return null;
    return { cur: m[1], code: m[2] + m[3] + m[4], ts: Date.UTC(2000 + (+m[4]), MON[m[3]], +m[2], 8), strike: k, type: m[6] };
  }
  function pos(x) { return typeof x === 'number' && isFinite(x) && x > 0 ? x : 0; }

  /* total intrinsic value of one expiry's open options if it settled at S */
  function painAt(strikes, S) {
    var t = 0;
    for (var i = 0; i < strikes.length; i++) { var r = strikes[i]; t += r.c.oi * Math.max(0, S - r.k) + r.p.oi * Math.max(0, r.k - S); }
    return t;
  }
  function painCurve(strikes) { return strikes.map(function (r) { return [r.k, painAt(strikes, r.k)]; }); }
  function maxPain(strikes) {
    var best = null, bv = Infinity, any = false;
    for (var i = 0; i < strikes.length; i++) {
      if (strikes[i].c.oi > 0 || strikes[i].p.oi > 0) any = true;
      var v = painAt(strikes, strikes[i].k);
      if (v < bv) { bv = v; best = strikes[i].k; }        /* strikes are in rising order: the first minimum is the lowest strike */
    }
    return any ? best : null;
  }
  function ivOf(r) { var a = r.c.iv > 0 ? r.c.iv : null, b = r.p.iv > 0 ? r.p.iv : null; return a != null && b != null ? (a + b) / 2 : a != null ? a : b; }
  function atmIv(strikes, und) {
    var pts = [];
    strikes.forEach(function (r) { var v = ivOf(r); if (v != null) pts.push([r.k, v]); });
    if (!pts.length || !(und > 0)) return null;
    if (und <= pts[0][0]) return pts[0][1];
    if (und >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (var i = 1; i < pts.length; i++) if (und <= pts[i][0]) { var a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (und - a[0]) / (b[0] - a[0]); }
    return null;
  }
  function side() { return { oi: 0, vol: 0, iv: null, mark: null }; }
  function ratio(p, c) { return c > 0 ? p / c : null; }

  /* rows of get_book_summary_by_currency → expiries (soonest first, expired ones left out), totals and all strikes merged */
  function build(rows, now) {
    var by = {}, idx = null;
    (rows || []).forEach(function (x) {
      var n = parseName(x && x.instrument_name); if (!n || n.ts <= now) return;
      if (idx == null && pos(x.estimated_delivery_price)) idx = x.estimated_delivery_price;
      var e = by[n.code] || (by[n.code] = { code: n.code, ts: n.ts, und: null, map: {} });
      if (e.und == null && pos(x.underlying_price)) e.und = x.underlying_price;
      var r = e.map[n.strike] || (e.map[n.strike] = { k: n.strike, c: side(), p: side() }), s = n.type === 'C' ? r.c : r.p;
      s.oi += pos(x.open_interest); s.vol += pos(x.volume);
      if (pos(x.mark_iv)) s.iv = x.mark_iv;
      if (pos(x.mark_price)) s.mark = x.mark_price;
    });
    var exps = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return a.ts - b.ts; });
    var tot = { c: { oi: 0, vol: 0 }, p: { oi: 0, vol: 0 } }, all = {};
    exps.forEach(function (e) {
      e.strikes = Object.keys(e.map).map(function (k) { return e.map[k]; }).sort(function (a, b) { return a.k - b.k; });
      delete e.map;
      e.c = { oi: 0, vol: 0 }; e.p = { oi: 0, vol: 0 };
      e.strikes.forEach(function (r) {
        e.c.oi += r.c.oi; e.c.vol += r.c.vol; e.p.oi += r.p.oi; e.p.vol += r.p.vol;
        var a = all[r.k] || (all[r.k] = { k: r.k, c: side(), p: side() });
        a.c.oi += r.c.oi; a.c.vol += r.c.vol; a.p.oi += r.p.oi; a.p.vol += r.p.vol;
      });
      e.oi = e.c.oi + e.p.oi; e.pc = ratio(e.p.oi, e.c.oi); e.days = (e.ts - now) / DAY;
      e.maxPain = maxPain(e.strikes);
      if (e.und == null) e.und = idx;
      e.mpDist = e.maxPain != null && idx > 0 ? (e.maxPain / idx - 1) * 100 : null;
      e.atmIv = atmIv(e.strikes, e.und);
      e.notional = idx > 0 ? e.oi * idx : null;
      tot.c.oi += e.c.oi; tot.c.vol += e.c.vol; tot.p.oi += e.p.oi; tot.p.vol += e.p.vol;
    });
    tot.oi = tot.c.oi + tot.p.oi; tot.vol = tot.c.vol + tot.p.vol;
    tot.pcOi = ratio(tot.p.oi, tot.c.oi); tot.pcVol = ratio(tot.p.vol, tot.c.vol); tot.notional = idx > 0 ? tot.oi * idx : null;
    return { index: idx, exps: exps, tot: tot, all: Object.keys(all).map(function (k) { return all[k]; }).sort(function (a, b) { return a.k - b.k; }) };
  }
  /* the strikes between lo× and hi× the price (the far wings hold little and stretch the picture) */
  function near(strikes, und, lo, hi) { return und > 0 ? strikes.filter(function (r) { return r.k >= und * lo && r.k <= und * hi; }) : strikes.slice(); }
  /* where a price sits among the strikes, as a fractional index (for the price and max-pain markers on a bar chart) */
  function slot(strikes, px) {
    var n = strikes.length; if (!n || !(px > 0)) return null;
    if (px <= strikes[0].k) return 0; if (px >= strikes[n - 1].k) return n - 1;
    for (var i = 1; i < n; i++) if (px <= strikes[i].k) return i - 1 + (px - strikes[i - 1].k) / (strikes[i].k - strikes[i - 1].k);
    return n - 1;
  }

  var api = { DAY: DAY, parseName: parseName, build: build, maxPain: maxPain, painAt: painAt, painCurve: painCurve, atmIv: atmIv, near: near, slot: slot };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OBOpt = api;
})(typeof window !== 'undefined' ? window : this);
