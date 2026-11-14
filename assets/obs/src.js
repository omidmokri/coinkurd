/* entekhab.net — the Observatory: public market data read in the visitor's browser (no key, no server of ours).
     Binance USDⓈ-M futures  fapi.binance.com   candles (taker volume), open-interest history (30 days only), account long/short ratio
     Bybit linear perpetuals api.bybit.com      candles, open-interest history (years), account ratio, max leverage and maintenance margin
     OKX swaps               www.okx.com        the real liquidation orders of the last hours (drawn over the model as a check)
   Everything is brought to one unit: price per coin and size in coins (contracts quoted per 1000 coins are rescaled). */
(function () {
  'use strict';
  var OB = window.OB, SRC = OB.src = {};
  var MIN = 60000, H = 3600000, D = 86400000;
  var MS = OB.IVMS = { '5m': 5 * MIN, '15m': 15 * MIN, '30m': 30 * MIN, '1h': H, '4h': 4 * H, '1d': D };
  var get = OB.getJSON;

  /* '1000PEPEUSDT' → PEPE × 1000 · 'SHIB1000USDT' → SHIB × 1000 · '1MBABYDOGEUSDT' → BABYDOGE × 1e6 · 'BTCUSDT' → BTC × 1 */
  function parseSym(sym) {
    var b = String(sym).replace(/USDT$/, ''), m;
    if ((m = /^1M([A-Z0-9]+)$/.exec(b))) return { base: m[1], mult: 1e6 };
    if ((m = /^(10{3,8})([A-Z][A-Z0-9]*)$/.exec(b))) return { base: m[2], mult: +m[1] };
    if ((m = /^([A-Z][A-Z0-9]*?)(10{3,8})$/.exec(b))) return { base: m[1], mult: +m[2] };
    return { base: b, mult: 1 };
  }
  SRC.parseSym = parseSym;
  function slices(t0, t1, step, per) {             /* [a, b] windows of at most `per` steps, oldest first */
    var out = [], a = t0;
    while (a <= t1) { var b = Math.min(t1, a + step * per - 1); out.push([a, b]); a = b + 1; }
    return out;
  }
  function flat(parts) { var out = []; parts.forEach(function (p) { if (p) for (var i = 0; i < p.length; i++) out.push(p[i]); }); return out; }
  function byT(a, b) { return a.t - b.t; }
  function by0(a, b) { return a[0] - b[0]; }
  function uniqT(rows) { rows.sort(byT); var out = [], last = null; rows.forEach(function (r) { if (r.t !== last) { out.push(r); last = r.t; } else out[out.length - 1] = r; }); return out; }
  function uniq0(rows) { rows.sort(by0); var out = [], last = null; rows.forEach(function (r) { if (r[0] !== last) { out.push(r); last = r[0]; } else out[out.length - 1] = r; }); return out; }

  /* ================================================================ Binance */
  var BN = 'https://fapi.binance.com';
  SRC.binance = {
    id: 'binance', name: 'Binance', oiDays: 30, hasTaker: true,
    klines: function (sym, iv, t0, t1) {
      var tasks = slices(t0, t1, MS[iv], 1500).map(function (s) {
        return function () {
          return get(BN + '/fapi/v1/klines?symbol=' + sym + '&interval=' + iv + '&startTime=' + s[0] + '&endTime=' + s[1] + '&limit=1500', 20000).then(function (a) {
            return a.map(function (k) { return { t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], iv: MS[iv] }; });
          });
        };
      });
      return OB.pool(tasks, 4).then(function (p) { return uniqT(flat(p)); });
    },
    /* open-interest history: only the latest 30 days exist; older start times are refused, so the caller clips t0 */
    oi: function (sym, iv, t0, t1) {
      var tasks = slices(t0, t1, MS[iv], 500).map(function (s) {
        return function () {
          return get(BN + '/futures/data/openInterestHist?symbol=' + sym + '&period=' + iv + '&startTime=' + s[0] + '&endTime=' + s[1] + '&limit=500', 20000).then(function (a) {
            return a.map(function (x) { return [+x.timestamp, +x.sumOpenInterest]; });
          });
        };
      });
      return OB.pool(tasks, 4).then(function (p) { return uniq0(flat(p)); });
    },
    oiNow: function (sym) { return get(BN + '/fapi/v1/openInterest?symbol=' + sym, 12000).then(function (x) { return [+x.time, +x.openInterest]; }); },
    ls: function (sym, iv, t0, t1) {
      var tasks = slices(t0, t1, MS[iv], 500).map(function (s) {
        return function () {
          return get(BN + '/futures/data/globalLongShortAccountRatio?symbol=' + sym + '&period=' + iv + '&startTime=' + s[0] + '&endTime=' + s[1] + '&limit=500', 20000).then(function (a) {
            return a.map(function (x) { return [+x.timestamp, +x.longAccount]; });
          });
        };
      });
      return OB.pool(tasks, 4).then(function (p) { return uniq0(flat(p)); });
    },
    list: function () {
      return get(BN + '/fapi/v1/ticker/24hr', 20000).then(function (a) {
        return a.filter(function (x) { return /^[A-Z0-9]+USDT$/.test(x.symbol) && +x.quoteVolume > 0; }).map(function (x) {
          var p = parseSym(x.symbol); return { sym: x.symbol, base: p.base, mult: p.mult, vol: +x.quoteVolume, px: +x.lastPrice / p.mult, chg: +x.priceChangePercent };
        });
      });
    }
  };

  /* ================================================================ Bybit */
  var BY = 'https://api.bybit.com';
  var BYK = { '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D' }, BYO = { '5m': '5min', '15m': '15min', '30m': '30min', '1h': '1h', '4h': '4h', '1d': '1d' };
  function byGet(url) { return get(url, 20000).then(function (j) { if (j.retCode !== 0) { var e = new Error('bybit ' + j.retCode + ' ' + j.retMsg); throw e; } return j.result; }); }
  SRC.bybit = {
    id: 'bybit', name: 'Bybit', oiDays: 3650, hasTaker: false,
    klines: function (sym, iv, t0, t1) {
      var tasks = slices(t0, t1, MS[iv], 1000).map(function (s) {
        return function () {
          return byGet(BY + '/v5/market/kline?category=linear&symbol=' + sym + '&interval=' + BYK[iv] + '&start=' + s[0] + '&end=' + s[1] + '&limit=1000').then(function (r) {
            return (r.list || []).map(function (k) { return { t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], iv: MS[iv] }; });
          });
        };
      });
      return OB.pool(tasks, 4).then(function (p) { return uniqT(flat(p)); });
    },
    oi: function (sym, iv, t0, t1) {
      var tasks = slices(t0, t1, MS[iv], 200).map(function (s) {
        return function () {
          return byGet(BY + '/v5/market/open-interest?category=linear&symbol=' + sym + '&intervalTime=' + BYO[iv] + '&startTime=' + s[0] + '&endTime=' + s[1] + '&limit=200').then(function (r) {
            return (r.list || []).map(function (x) { return [+x.timestamp, +x.openInterest]; });
          });
        };
      });
      return OB.pool(tasks, 5).then(function (p) { return uniq0(flat(p)); });
    },
    oiNow: function (sym) {
      return byGet(BY + '/v5/market/tickers?category=linear&symbol=' + sym).then(function (r) { var x = (r.list || [])[0]; if (!x) throw new Error('bybit ticker'); return [Date.now(), +x.openInterest]; });
    },
    ls: function (sym, iv, t0, t1) {
      var tasks = slices(t0, t1, MS[iv], 500).map(function (s) {
        return function () {
          return byGet(BY + '/v5/market/account-ratio?category=linear&symbol=' + sym + '&period=' + BYO[iv] + '&startTime=' + s[0] + '&endTime=' + s[1] + '&limit=500').then(function (r) {
            return (r.list || []).map(function (x) { return [+x.timestamp, +x.buyRatio]; });
          });
        };
      });
      return OB.pool(tasks, 4).then(function (p) { return uniq0(flat(p)); });
    },
    /* what the contract really allows: its maximum leverage and the maintenance margin of the lowest risk tier */
    spec: function (sym) {
      return Promise.all([
        byGet(BY + '/v5/market/instruments-info?category=linear&symbol=' + sym).then(function (r) { var x = (r.list || [])[0]; return x && x.leverageFilter ? +x.leverageFilter.maxLeverage : null; }, function () { return null; }),
        byGet(BY + '/v5/market/risk-limit?category=linear&symbol=' + sym).then(function (r) { var x = (r.list || [])[0]; return x ? +x.maintenanceMargin : null; }, function () { return null; })
      ]).then(function (a) { return { maxLev: a[0], mmr: a[1] }; });
    },
    list: function () {
      return byGet(BY + '/v5/market/tickers?category=linear').then(function (r) {
        return (r.list || []).filter(function (x) { return /^[A-Z0-9]+USDT$/.test(x.symbol) && +x.turnover24h > 0; }).map(function (x) {
          var p = parseSym(x.symbol);
          return { sym: x.symbol, base: p.base, mult: p.mult, vol: +x.turnover24h, px: +x.lastPrice / p.mult, oiUsd: +x.openInterestValue, chg: +x.price24hPcnt * 100, fr: +x.fundingRate };
        });
      });
    }
  };

  /* ================================================================ OKX — real liquidation orders (public) */
  var OKX = 'https://www.okx.com/api/v5/';
  var ctCache = {};
  SRC.okx = {
    id: 'okx', name: 'OKX',
    ctVal: function (base) {
      if (ctCache[base]) return ctCache[base];
      return (ctCache[base] = get(OKX + 'public/instruments?instType=SWAP&instId=' + base + '-USDT-SWAP', 12000).then(function (j) {
        var x = j && j.data && j.data[0]; if (!x) throw new Error('okx instrument'); return +x.ctVal;
      }).catch(function (e) { delete ctCache[base]; throw e; }));
    },
    /* newest first, page by page (100 orders a page) until `since` or `pages` is reached.
       onPage(orders of that page, oldest time so far) is called as each page arrives; returning false stops the paging. */
    liqs: function (base, since, pages, onPage) {
      var out = [], self = this;
      return self.ctVal(base).then(function (ct) {
        function page(after, left) {
          var u = OKX + 'public/liquidation-orders?instType=SWAP&uly=' + base + '-USDT&state=filled&limit=100' + (after ? '&after=' + after : '');
          return get(u, 12000).then(function (j) {
            var det = []; ((j && j.data) || []).forEach(function (b) { (b.details || []).forEach(function (x) { det.push(x); }); });
            if (!det.length) return out;
            var oldest = Infinity, part = [];
            det.forEach(function (x) {
              var t = +x.ts, px = +x.bkPx, sz = +x.sz; if (!(t && px && sz)) return;
              if (t < oldest) oldest = t;
              if (t >= since) part.push({ t: t, px: px, usd: px * sz * ct, side: x.posSide === 'short' || x.side === 'buy' ? 'short' : 'long', ex: 'okx' });
            });
            for (var i = 0; i < part.length; i++) out.push(part[i]);
            if (onPage && onPage(part, Math.max(oldest, since)) === false) return out;
            if (left > 1 && oldest > since && isFinite(oldest) && (!after || oldest < after)) return page(oldest, left - 1);
            return out;
          });
        }
        return page(null, pages || 5);
      });
    }
  };

  /* ================================================================ the coins that have a perpetual on Binance or Bybit */
  var coinsP = null, coinsOk = null;
  /* force = ask again when an exchange did not answer last time (a retry after a blocked connection) */
  /* The same ticker can be another coin, or the same coin in another unit, on another exchange. Two prices of one
     contract never differ by much, so a price more than 15 % away from the reference is taken as not the same thing
     and its numbers are left out instead of being added in. Unknown prices pass (nothing to compare). */
  OB.samePx = function (px, ref) { return !(px > 0 && ref > 0) || Math.abs(px / ref - 1) <= 0.15; };
  OB.coins = function (force) {
    if (force && coinsOk && !(coinsOk.binance && coinsOk.bybit)) coinsP = null;
    if (coinsP) return coinsP;
    coinsP = Promise.all([SRC.binance.list().catch(function () { return null; }), SRC.bybit.list().catch(function () { return null; })]).then(function (r) {
      var bn = r[0], by = r[1], m = {};
      if (!bn && !by) throw new Error('no exchange reachable');
      (bn || []).forEach(function (x) { var c = m[x.base] = m[x.base] || { base: x.base, vol: 0 }; c.bn = x.sym; c.bnMult = x.mult; c.vol += x.vol; c.px = x.px; c.chg = x.chg; });
      (by || []).forEach(function (x) {
        var c = m[x.base];
        if (c && !OB.samePx(x.px, c.px)) return;          /* the same ticker, but another coin or another unit: the two are not merged */
        c = m[x.base] = c || { base: x.base, vol: 0 }; c.by = x.sym; c.byMult = x.mult; c.vol += x.vol; c.oiUsd = x.oiUsd; if (c.px == null) { c.px = x.px; c.chg = x.chg; }
      });
      var list = Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.vol - a.vol; });
      list.ok = coinsOk = { binance: !!bn, bybit: !!by };
      return list;
    });
    coinsP.catch(function () { coinsP = null; });
    return coinsP;
  };

  /* ================================================================ one exchange's feed for the liquidation model */
  /* ranges: the window on screen, its candle size, how many candles make one column, and the warm-up before it
     (older, coarser candles that only build the levels the window opens with) */
  OB.LIQ_RANGES = [
    { k: '12h', span: 12 * H, iv: '5m', agg: 1, wiv: '1h', wdays: 30 },
    { k: '24h', span: 24 * H, iv: '5m', agg: 1, wiv: '1h', wdays: 30 },
    { k: '48h', span: 48 * H, iv: '5m', agg: 1, wiv: '1h', wdays: 30 },
    { k: '3d', span: 3 * D, iv: '15m', agg: 1, wiv: '1h', wdays: 30 },
    { k: '1w', span: 7 * D, iv: '30m', agg: 1, wiv: '4h', wdays: 90 },
    { k: '2w', span: 14 * D, iv: '1h', agg: 1, wiv: '4h', wdays: 90 },
    { k: '1m', span: 30 * D, iv: '1h', agg: 2, wiv: '4h', wdays: 120 },
    { k: '3m', span: 90 * D, iv: '4h', agg: 1, wiv: '1d', wdays: 365 },
    { k: '6m', span: 180 * D, iv: '4h', agg: 2, wiv: '1d', wdays: 540 },
    { k: '1y', span: 365 * D, iv: '1d', agg: 1, wiv: '1d', wdays: 730 }
  ];
  OB.liqRange = function (k) { for (var i = 0; i < OB.LIQ_RANGES.length; i++) if (OB.LIQ_RANGES[i].k === k) return OB.LIQ_RANGES[i]; return OB.LIQ_RANGES[1]; };

  /* value of a step series at time x: the last sample at or before x, unless it is older than `stale` */
  function stepper(rows) {
    var i = 0;
    return function (x, stale) {
      if (!rows.length) return NaN;
      if (i >= rows.length || rows[i][0] > x) i = 0;
      while (i + 1 < rows.length && rows[i + 1][0] <= x) i++;
      if (rows[i][0] > x) return NaN;
      if (stale && x - rows[i][0] > stale) return NaN;
      return rows[i][1];
    };
  }

  /* raw data of one exchange: { ex, sym, mult, bars (coarse then fine, time ascending), oi [[t, coins]], ls [[t, share]], spec } */
  function loadRaw(ex, sym, mult, R, needLs, now) {
    var S = SRC[ex], iv = MS[R.iv], wiv = MS[R.wiv];
    var winStart = Math.floor((now - R.span) / (iv * R.agg)) * (iv * R.agg);
    var fine0 = Math.floor(winStart / wiv) * wiv;                       /* the fine candles start on a coarse boundary */
    var oiMin = now - (S.oiDays - 0.2) * D;                             /* the oldest open-interest sample the exchange still has */
    var warm0 = Math.max(fine0 - R.wdays * D, Math.ceil(oiMin / wiv) * wiv);
    var fineOi0 = Math.max(fine0, Math.ceil(oiMin / iv) * iv);
    var hasWarm = warm0 < fine0;
    var jobs = [
      S.klines(sym, R.iv, Math.min(fine0, fineOi0), now),
      fineOi0 < now ? S.oi(sym, R.iv, fineOi0, now) : Promise.resolve([]),
      hasWarm ? S.klines(sym, R.wiv, warm0, fine0 - 1) : Promise.resolve([]),
      hasWarm ? S.oi(sym, R.wiv, warm0, fine0) : Promise.resolve([]),
      S.oiNow(sym).catch(function () { return null; }),
      needLs ? S.ls(sym, R.iv, fineOi0, now).catch(function () { return []; }) : Promise.resolve(null),
      needLs && hasWarm ? S.ls(sym, R.wiv, warm0, fine0).catch(function () { return []; }) : Promise.resolve(needLs ? [] : null)
    ];
    return Promise.all(jobs).then(function (r) {
      var fine = r[0].filter(function (b) { return b.t >= fine0; }), warm = r[2].filter(function (b) { return b.t < fine0; });
      if (!fine.length) throw new Error(ex + ': no candles');
      var oi = uniq0(r[3].concat(r[1]));
      if (r[4]) oi.push([Math.max(r[4][0], oi.length ? oi[oi.length - 1][0] + 1 : 0), r[4][1]]);
      return { ex: ex, sym: sym, mult: mult, R: R, bars: warm.concat(fine), oi: oi, ls: r[5] ? uniq0(r[6].concat(r[5])) : null, fine0: fine0, loaded: now };
    });
  }

  /* raw → the arrays the model reads, in coins and price per coin */
  function toFeed(raw, spec) {
    var n = raw.bars.length, m = raw.mult, at = stepper(raw.oi), lsAt = raw.ls && raw.ls.length ? stepper(raw.ls) : null;
    var f = { ex: raw.ex, t: new Array(n), o: new Array(n), h: new Array(n), l: new Array(n), c: new Array(n), v: new Array(n), oi0: new Array(n), oi1: new Array(n), ls: lsAt ? new Array(n) : null,
      mmr: spec && isFinite(spec.mmr) && spec.mmr > 0 ? spec.mmr : 0.005, maxLev: spec && isFinite(spec.maxLev) && spec.maxLev > 0 ? spec.maxLev : 100 };
    var firstOi = null;
    for (var i = 0; i < n; i++) {
      var b = raw.bars[i];
      f.t[i] = b.t; f.o[i] = b.o / m; f.h[i] = b.h / m; f.l[i] = b.l / m; f.c[i] = b.c / m; f.v[i] = b.v * m;
      var a0 = at(b.t, b.iv * 3), a1 = at(b.t + b.iv, b.iv * 3);
      f.oi0[i] = a0 * m; f.oi1[i] = a1 * m;
      if (firstOi == null && isFinite(a0) && isFinite(a1)) firstOi = b.t;
      if (lsAt) f.ls[i] = lsAt(b.t + b.iv, b.iv * 6);
    }
    f.oiFrom = firstOi;                                              /* levels can only come from candles after this time */
    f.oiLast = raw.oi.length ? raw.oi[raw.oi.length - 1][1] * m : NaN;
    f.pxLast = n ? f.c[n - 1] : NaN;
    return f;
  }

  /* candles of the window, `agg` fine candles to a column: [{t, o, h, l, c, v}] with null where the exchange has a gap */
  function columns(raw, now) {
    var R = raw.R, step = MS[R.iv] * R.agg, m = raw.mult;
    var winStart = Math.floor((now - R.span) / step) * step, n = Math.max(1, Math.ceil((now - winStart) / step));
    var cols = new Array(n), ends = new Array(n), k;
    for (k = 0; k < n; k++) { cols[k] = null; ends[k] = winStart + (k + 1) * step; }
    raw.bars.forEach(function (b) {
      if (b.t < winStart || b.iv !== MS[R.iv]) return;
      k = Math.floor((b.t - winStart) / step); if (k < 0 || k >= n) return;
      var c = cols[k];
      if (!c) cols[k] = { t: winStart + k * step, o: b.o / m, h: b.h / m, l: b.l / m, c: b.c / m, v: b.v * m };
      else { if (b.h / m > c.h) c.h = b.h / m; if (b.l / m < c.l) c.l = b.l / m; c.c = b.c / m; c.v += b.v * m; }
    });
    return { cols: cols, ends: ends, start: winStart, step: step };
  }

  /* everything the liquidation views need for one coin: raw data of each chosen exchange (the ones that answered) */
  OB.liqLoad = function (coin, R, exs, needLs) {
    var now = Date.now();
    var want = exs.filter(function (e) { return e === 'binance' ? coin.bn : coin.by; });
    if (!want.length) return Promise.reject(new Error('not listed'));
    var specP = coin.by ? SRC.bybit.spec(coin.by).catch(function () { return null; }) : Promise.resolve(null);
    return Promise.all(want.map(function (e) {
      return loadRaw(e, e === 'binance' ? coin.bn : coin.by, e === 'binance' ? coin.bnMult : coin.byMult, R, needLs, now)
        .then(function (raw) { return { ok: raw }; }, function (err) { return { err: err, ex: e }; });
    }).concat([specP])).then(function (r) {
      var spec = r.pop(), raws = r.filter(function (x) { return x.ok; }).map(function (x) { return x.ok; }), failed = r.filter(function (x) { return x.err; }).map(function (x) { return x.ex; });
      if (!raws.length) { var e = new Error('no data'); e.failed = failed; e.cause = r[0] && r[0].err; throw e; }
      return { coin: coin, R: R, raws: raws, spec: spec, failed: failed, now: now, hasLs: !!needLs };
    });
  };
  /* the last candles and the present open interest of every loaded exchange, merged into the raw data in place */
  OB.liqRefresh = function (data) {
    var now = Date.now();
    return Promise.all(data.raws.map(function (raw) {
      var S = SRC[raw.ex], iv = MS[raw.R.iv];
      return Promise.all([S.klines(raw.sym, raw.R.iv, now - 4 * iv, now), S.oiNow(raw.sym).catch(function () { return null; })]).then(function (r) {
        var by = {}; raw.bars.forEach(function (b, i) { by[b.t + ':' + b.iv] = i; });
        r[0].forEach(function (b) { var k = by[b.t + ':' + b.iv]; if (k != null) raw.bars[k] = b; else if (b.t > raw.bars[raw.bars.length - 1].t) raw.bars.push(b); });
        if (r[1]) {
          /* keep one sample per candle boundary so earlier candles keep their change, and move the live one forward */
          var last = raw.oi[raw.oi.length - 1], bt = Math.floor(now / iv) * iv;
          if (last && last[0] >= bt) raw.oi[raw.oi.length - 1] = [Math.max(now, last[0]), r[1][1]]; else raw.oi.push([now, r[1][1]]);
        }
        raw.loaded = now;
      }).catch(function () { });
    })).then(function () { data.now = now; return data; });
  };
  OB.liqFeeds = function (data) { return data.raws.map(function (raw) { return toFeed(raw, data.spec); }); };
  OB.liqColumns = function (data) { return columns(data.raws[0], data.now); };
  SRC._test = { stepper: stepper, slices: slices, toFeed: toFeed, columns: columns };

  /* ================================================================ derivatives beyond the liquidation model */
  /* The exchanges a snapshot is asked from, in a fixed order (their colours follow the exchange, never its rank).
     Funding is brought to one interval — the rate per 8 hours — because the exchanges settle every 1, 4 or 8 hours. */
  OB.EX = [
    { id: 'binance', name: 'Binance', color: '#3987e5' }, { id: 'bybit', name: 'Bybit', color: '#d95926' }, { id: 'okx', name: 'OKX', color: '#199e70' },
    { id: 'bitget', name: 'Bitget', color: '#c98500' }, { id: 'hyperliquid', name: 'Hyperliquid', color: '#d55181' }, { id: 'gate', name: 'Gate', color: '#008300' }
  ];
  OB.exById = function (id) { for (var i = 0; i < OB.EX.length; i++) if (OB.EX[i].id === id) return OB.EX[i]; return null; };
  function per8h(rate, hours) { return rate * 8 / (hours > 0 ? hours : 8); }
  SRC.per8h = per8h;
  var memo = {};
  /* one answer per key for `ms` milliseconds (the bulk lists are a few hundred kB each: never asked twice in a row) */
  function cached(key, ms, fn) {
    var c = memo[key], now = Date.now();
    if (c && now - c.t < ms) return c.p;
    var p = fn(); memo[key] = { t: now, p: p };
    p.catch(function () { if (memo[key] && memo[key].p === p) delete memo[key]; });
    return p;
  }
  SRC.cached = cached;

  /* ---- Binance: funding of every contract, funding history, top-trader and taker ratios */
  SRC.binance.fundingAll = function () {
    return cached('bn_fund', 60000, function () {
      return Promise.all([get(BN + '/fapi/v1/premiumIndex', 20000), get(BN + '/fapi/v1/fundingInfo', 20000).catch(function () { return []; })]).then(function (r) {
        var iv = {}; (r[1] || []).forEach(function (x) { iv[x.symbol] = +x.fundingIntervalHours; });
        var out = {};
        r[0].forEach(function (x) {
          if (!/^[A-Z0-9]+USDT$/.test(x.symbol) || x.lastFundingRate === '' || x.lastFundingRate == null) return;
          var p = parseSym(x.symbol), h = iv[x.symbol] || 8;
          out[p.base] = { fr: +x.lastFundingRate, h: h, fr8: per8h(+x.lastFundingRate, h), next: +x.nextFundingTime, px: +x.markPrice / p.mult };
        });
        return out;
      });
    });
  };
  SRC.binance.fundingHist = function (sym, t0, t1) {
    /* 1000 settlements a request, oldest first from startTime */
    var out = [];
    function page(from, left) {
      return get(BN + '/fapi/v1/fundingRate?symbol=' + sym + '&startTime=' + from + '&endTime=' + t1 + '&limit=1000', 20000).then(function (a) {
        a.forEach(function (x) { out.push([+x.fundingTime, +x.fundingRate]); });
        if (a.length === 1000 && left > 1) return page(+a[a.length - 1].fundingTime + 1, left - 1);
        return uniq0(out);
      });
    }
    return page(t0, 6);
  };
  function bnRatio(path, field) {
    return function (sym, iv, t0, t1) {
      var tasks = slices(t0, t1, MS[iv], 500).map(function (s) {
        return function () {
          return get(BN + '/futures/data/' + path + '?symbol=' + sym + '&period=' + iv + '&startTime=' + s[0] + '&endTime=' + s[1] + '&limit=500', 20000).then(function (a) {
            return a.map(function (x) { return field === 'taker' ? [+x.timestamp, +x.buyVol, +x.sellVol] : [+x.timestamp, +x.longAccount]; });
          });
        };
      });
      return OB.pool(tasks, 4).then(function (p) { return uniq0(flat(p)); });
    };
  }
  SRC.binance.topAcc = bnRatio('topLongShortAccountRatio');
  SRC.binance.topPos = bnRatio('topLongShortPositionRatio');
  SRC.binance.taker = bnRatio('takerlongshortRatio', 'taker');

  /* ---- Bybit */
  SRC.bybit.fundingAll = function () {
    return cached('by_fund', 60000, function () {
      return byGet(BY + '/v5/market/tickers?category=linear').then(function (r) {
        var out = {};
        (r.list || []).forEach(function (x) {
          if (!/^[A-Z0-9]+USDT$/.test(x.symbol) || x.fundingRate === '' || x.fundingRate == null) return;
          var p = parseSym(x.symbol), h = +x.fundingIntervalHour || 8;
          out[p.base] = { fr: +x.fundingRate, h: h, fr8: per8h(+x.fundingRate, h), next: +x.nextFundingTime, px: +x.lastPrice / p.mult, oi: +x.openInterest * p.mult, oiUsd: +x.openInterestValue };
        });
        return out;
      });
    });
  };
  SRC.bybit.fundingHist = function (sym, t0, t1) {
    /* 200 settlements a request, newest first, walked back by endTime */
    var out = [];
    function page(end, left) {
      return byGet(BY + '/v5/market/funding/history?category=linear&symbol=' + sym + '&startTime=' + t0 + '&endTime=' + end + '&limit=200').then(function (r) {
        var a = r.list || [], oldest = Infinity;
        a.forEach(function (x) { var t = +x.fundingRateTimestamp; out.push([t, +x.fundingRate]); if (t < oldest) oldest = t; });
        if (a.length === 200 && left > 1 && oldest > t0) return page(oldest - 1, left - 1);
        return uniq0(out);
      });
    }
    return page(t1, 12);
  };

  /* ---- OKX: every swap's funding and open interest in two requests */
  SRC.okx.swaps = function () {
    return cached('okx_swaps', 60000, function () {
      return Promise.all([get(OKX + 'public/funding-rate?instId=ANY', 20000).catch(function () { return null; }), get(OKX + 'public/open-interest?instType=SWAP', 20000).catch(function () { return null; })]).then(function (r) {
        if (!r[0] && !r[1]) throw new Error('okx');
        var out = {};
        ((r[0] && r[0].data) || []).forEach(function (x) {
          var m = /^([A-Z0-9]+)-USDT-SWAP$/.exec(x.instId); if (!m || x.fundingRate === '' || x.fundingRate == null) return;
          var h = (+x.nextFundingTime - +x.fundingTime) / H; if (!(h > 0 && h <= 24)) h = 8;
          (out[m[1]] = out[m[1]] || {}).fr = +x.fundingRate; out[m[1]].h = h; out[m[1]].fr8 = per8h(+x.fundingRate, h); out[m[1]].next = +x.fundingTime;
        });
        ((r[1] && r[1].data) || []).forEach(function (x) {
          var m = /^([A-Z0-9]+)-USDT-SWAP$/.exec(x.instId); if (!m) return;
          var o = out[m[1]] = out[m[1]] || {}; o.oi = +x.oiCcy; o.oiUsd = +x.oiUsd; o.px = o.oi > 0 ? o.oiUsd / o.oi : null;
        });
        return out;
      });
    });
  };
  SRC.okx.fundingHist = function (base, t0) {
    /* 100 settlements a request, newest first, walked back with `after` */
    var out = [];
    function page(after, left) {
      return get(OKX + 'public/funding-rate-history?instId=' + base + '-USDT-SWAP&limit=100' + (after ? '&after=' + after : ''), 15000).then(function (j) {
        var a = (j && j.data) || [], oldest = Infinity;
        a.forEach(function (x) { var t = +x.fundingTime; if (t >= t0) out.push([t, +(x.realizedRate !== '' && x.realizedRate != null ? x.realizedRate : x.fundingRate)]); if (t < oldest) oldest = t; });
        if (a.length === 100 && left > 1 && oldest > t0) return page(oldest, left - 1);
        return uniq0(out);
      });
    }
    return page(null, 14);
  };

  /* ---- Bitget, Hyperliquid, Gate: the present funding and open interest */
  SRC.bitget = { id: 'bitget', name: 'Bitget',
    /* two lists: tickers (price, open interest) and the present funding with each contract's own interval (1, 4 or 8 hours).
       Without the second list the rate has no interval, so it is left empty instead of being assumed. */
    all: function () {
      return cached('bg_all', 60000, function () {
        var BG = 'https://api.bitget.com/api/v2/mix/market/';
        return Promise.all([get(BG + 'tickers?productType=USDT-FUTURES', 20000), get(BG + 'current-fund-rate?productType=usdt-futures', 20000).catch(function () { return null; })]).then(function (r) {
          var out = {}, fr = {};
          ((r[1] && r[1].data) || []).forEach(function (x) { var h = +x.fundingRateInterval; if (x.fundingRate !== '' && x.fundingRate != null && h > 0) fr[x.symbol] = { fr: +x.fundingRate, h: h }; });
          ((r[0] && r[0].data) || []).forEach(function (x) {
            if (!/^[A-Z0-9]+USDT$/.test(x.symbol)) return;
            var p = parseSym(x.symbol), px = +x.lastPr / p.mult, oi = +x.holdingAmount * p.mult, f = fr[x.symbol];
            out[p.base] = { fr: f ? f.fr : null, h: f ? f.h : null, fr8: f ? per8h(f.fr, f.h) : null, px: px, oi: oi, oiUsd: oi * px };
          });
          return out;
        });
      });
    } };
  SRC.hyperliquid = { id: 'hyperliquid', name: 'Hyperliquid',
    all: function () {
      return cached('hl_all', 60000, function () {
        return get('https://api.hyperliquid.xyz/info', 20000, { body: { type: 'metaAndAssetCtxs' } }).then(function (j) {
          var uni = (j && j[0] && j[0].universe) || [], ctx = (j && j[1]) || [], out = {};
          uni.forEach(function (u, i) {
            var c = ctx[i]; if (!c || u.isDelisted) return;
            var m = /^k([A-Z0-9]+)$/.exec(u.name), base = m ? m[1] : u.name, mult = m ? 1000 : 1;       /* kPEPE = 1000 PEPE */
            if (!/^[A-Z0-9]+$/.test(base)) return;
            var px = +c.markPx / mult, oi = +c.openInterest * mult;
            out[base] = { fr: +c.funding, h: 1, fr8: per8h(+c.funding, 1), px: px, oi: oi, oiUsd: oi * px, maxLev: +u.maxLeverage };
          });
          return out;
        });
      });
    } };
  SRC.gate = { id: 'gate', name: 'Gate',
    /* one contract (the list of all of them is a megabyte) */
    one: function (base) {
      return cached('gate_' + base, 60000, function () {
        return get('https://api.gateio.ws/api/v4/futures/usdt/contracts/' + base + '_USDT', 15000).then(function (x) {
          if (!x || x.position_size == null) throw new Error('gate');
          var px = +x.mark_price, oi = +x.position_size * +x.quanto_multiplier, h = (+x.funding_interval || 28800) / 3600;
          return { fr: +x.funding_rate, h: h, fr8: per8h(+x.funding_rate, h), px: px, oi: oi, oiUsd: oi * px, mult: +x.quanto_multiplier };
        });
      });
    } };

  /* the present open interest and funding of one coin on every exchange that lists it: { exchange id: { oi, oiUsd, fr8, h, px } | null } */
  OB.snapshot = function (coin) {
    var base = coin.base, jobs = {
      binance: coin.bn ? Promise.all([SRC.binance.oiNow(coin.bn), SRC.binance.fundingAll().catch(function () { return {}; })]).then(function (r) {
        var f = r[1][base] || {}, oi = r[0][1] * coin.bnMult; return { oi: oi, oiUsd: f.px ? oi * f.px : null, fr8: f.fr8, h: f.h, px: f.px };
      }) : null,
      bybit: coin.by ? SRC.bybit.fundingAll().then(function (m) { return m[base] || null; }) : null,
      okx: SRC.okx.swaps().then(function (m) { return m[base] && m[base].oi != null ? m[base] : null; }),
      bitget: SRC.bitget.all().then(function (m) { return m[base] || null; }),
      hyperliquid: SRC.hyperliquid.all().then(function (m) { return m[base] || null; }),
      gate: SRC.gate.one(base)
    };
    var ids = Object.keys(jobs);
    return Promise.all(ids.map(function (id) { return jobs[id] ? jobs[id].catch(function () { return null; }) : Promise.resolve(null); })).then(function (r) {
      var out = {}; ids.forEach(function (id, i) { out[id] = r[i]; }); return out;
    });
  };
  /* funding of every coin on the five exchanges with a bulk list: { exchange id: { base: { fr8, h, … } } | null } */
  OB.fundingTable = function () {
    var jobs = { binance: SRC.binance.fundingAll(), bybit: SRC.bybit.fundingAll(), okx: SRC.okx.swaps(), bitget: SRC.bitget.all(), hyperliquid: SRC.hyperliquid.all() }, ids = Object.keys(jobs);
    return Promise.all(ids.map(function (id) { return jobs[id].catch(function () { return null; }); })).then(function (r) {
      var out = {}; ids.forEach(function (id, i) { out[id] = r[i]; }); return out;
    });
  };
  /* candles (first exchange that lists the coin) and open-interest history of Binance and Bybit for a window */
  OB.DV_RANGES = [
    { k: '24h', span: 24 * H, iv: '5m' }, { k: '3d', span: 3 * D, iv: '15m' }, { k: '1w', span: 7 * D, iv: '30m' },
    { k: '1m', span: 30 * D, iv: '1h' }, { k: '3m', span: 90 * D, iv: '4h' }, { k: '1y', span: 365 * D, iv: '1d' }
  ];
  OB.dvRange = function (k) { for (var i = 0; i < OB.DV_RANGES.length; i++) if (OB.DV_RANGES[i].k === k) return OB.DV_RANGES[i]; return OB.DV_RANGES[2]; };
  OB.candles = function (coin, R, now) {
    var iv = MS[R.iv], t0 = Math.floor((now - R.span) / iv) * iv;
    var ex = coin.bn ? 'binance' : 'bybit', sym = coin.bn || coin.by, m = coin.bn ? coin.bnMult : coin.byMult;
    function run(e, s2, m2) { return SRC[e].klines(s2, R.iv, t0, now).then(function (a) { if (!a.length) throw new Error('no candles'); return { ex: e, t0: t0, rows: a.map(function (b) { return [b.t, b.o / m2, b.h / m2, b.l / m2, b.c / m2, b.v * m2]; }) }; }); }
    return run(ex, sym, m).catch(function (e) { if (coin.bn && coin.by) return run('bybit', coin.by, coin.byMult); throw e; });
  };
  OB.oiHistory = function (coin, R, now) {
    var iv = MS[R.iv], t0 = Math.floor((now - R.span) / iv) * iv, jobs = [];
    ['binance', 'bybit'].forEach(function (e) {
      var sym = e === 'binance' ? coin.bn : coin.by, m = e === 'binance' ? coin.bnMult : coin.byMult; if (!sym) return;
      var from = Math.max(t0, Math.ceil((now - (SRC[e].oiDays - 0.2) * D) / iv) * iv);
      jobs.push(SRC[e].oi(sym, R.iv, from, now).then(function (a) { return { ex: e, rows: a.map(function (x) { return [x[0], x[1] * m]; }) }; }, function () { return { ex: e, rows: null }; }));
    });
    return Promise.all(jobs);
  };
  /* how much open interest changed in the last 24 hours on the exchanges that publish history: hourly rows, the latest
     against the one 24 hours before it → { ex: [ids], t, coin: per cent in coins, usd: per cent in dollars (coins × the
     price of each of the two moments) } or null when a row is missing */
  OB.oiChange = function (coin, now) {
    var from = Math.floor((now - 27 * H) / H) * H, jobs = [];
    ['binance', 'bybit'].forEach(function (e) {
      var sym = e === 'binance' ? coin.bn : coin.by, m = e === 'binance' ? coin.bnMult : coin.byMult; if (!sym) return;
      jobs.push(SRC[e].oi(sym, '1h', from, now).then(function (a) { return { ex: e, rows: a.map(function (x) { return [x[0], x[1] * m]; }) }; }, function () { return null; }));
    });
    return Promise.all([Promise.all(jobs), OB.candles(coin, { iv: '1h', span: 27 * H }, now).catch(function () { return null; })]).then(function (r) {
      var hs = r[0].filter(function (h) { return h && h.rows.length > 24; }), cs = r[1] && r[1].rows; if (!hs.length) return null;
      var tl = Math.min.apply(null, hs.map(function (h) { return h.rows[h.rows.length - 1][0]; })), tp = tl - 24 * H, L = 0, P = 0, ok = true;
      hs.forEach(function (h) { var a = null, b = null; h.rows.forEach(function (x) { if (x[0] === tl) a = x[1]; if (x[0] === tp) b = x[1]; }); if (a == null || b == null) ok = false; else { L += a; P += b; } });
      if (!ok || !(P > 0)) return null;
      var pl = null, pp = null; (cs || []).forEach(function (c) { if (c[0] === tl) pl = c[1]; if (c[0] === tp) pp = c[1]; });
      return { ex: hs.map(function (h) { return h.ex; }), t: tl, coin: (L / P - 1) * 100, usd: pl > 0 && pp > 0 ? (L * pl / (P * pp) - 1) * 100 : null };
    });
  };
  /* funding history of one coin on the three exchanges that publish it, as rates per 8 hours */
  OB.fundingHistory = function (coin, t0, now) {
    var base = coin.base, jobs = [];
    function norm(rows) {            /* the interval is read from the spacing of the settlements themselves */
      if (!rows || rows.length < 2) return rows || [];
      return rows.map(function (r, i) { var gap = i ? r[0] - rows[i - 1][0] : rows[1][0] - rows[0][0], h = Math.round(gap / H); if (!(h >= 1 && h <= 8)) h = 8; return [r[0], per8h(r[1], h)]; });
    }
    if (coin.bn) jobs.push(SRC.binance.fundingHist(coin.bn, t0, now).then(function (a) { return { ex: 'binance', rows: norm(a) }; }, function () { return { ex: 'binance', rows: null }; }));
    if (coin.by) jobs.push(SRC.bybit.fundingHist(coin.by, t0, now).then(function (a) { return { ex: 'bybit', rows: norm(a) }; }, function () { return { ex: 'bybit', rows: null }; }));
    jobs.push(SRC.okx.fundingHist(base, t0).then(function (a) { return { ex: 'okx', rows: norm(a) }; }, function () { return { ex: 'okx', rows: null }; }));
    return Promise.all(jobs);
  };
  /* long/short ratios of one coin: the share of accounts that are long, and the takers' buys and sells */
  OB.lsHistory = function (coin, R, now) {
    var iv = MS[R.iv], t0 = Math.floor((now - R.span) / iv) * iv, bnFrom = Math.max(t0, Math.ceil((now - 29.8 * D) / iv) * iv), jobs = [];
    function j(id, p) { jobs.push(p.then(function (a) { return { id: id, rows: a }; }, function () { return { id: id, rows: null }; })); }
    if (coin.bn) {
      j('bn_all', SRC.binance.ls(coin.bn, R.iv, bnFrom, now)); j('bn_top_acc', SRC.binance.topAcc(coin.bn, R.iv, bnFrom, now));
      j('bn_top_pos', SRC.binance.topPos(coin.bn, R.iv, bnFrom, now)); j('bn_taker', SRC.binance.taker(coin.bn, R.iv, bnFrom, now).then(function (a) { var m = coin.bnMult; return a.map(function (x) { return [x[0], x[1] * m, x[2] * m]; }); }));
    }
    if (coin.by) j('by_all', SRC.bybit.ls(coin.by, R.iv, t0, now));
    return Promise.all(jobs).then(function (r) { var o = {}; r.forEach(function (x) { o[x.id] = x.rows; }); return o; });
  };

  /* ================================================================ live: last price and liquidations as they happen */
  /* Binance when the coin is listed there (one socket, two streams), else Bybit. Calls back onPrice(px) and onLiq(event). */
  OB.liqLive = function (coin, cb) {
    var ws = null, dead = false, retry = 0, timer = null, ping = null;
    function open() {
      if (dead) return;
      try {
        if (coin.bn) {
          var s = coin.bn.toLowerCase();
          ws = new WebSocket('wss://fstream.binance.com/stream?streams=' + s + '@miniTicker/' + s + '@forceOrder');
          ws.onmessage = function (m) {
            try {
              var j = JSON.parse(m.data), x = j.data || j;
              if (x.e === '24hrMiniTicker') cb.onPrice(+x.c / coin.bnMult);
              else if (x.e === 'forceOrder' && x.o) { var o = x.o, px = +(o.ap > 0 ? o.ap : o.p), q = +(o.z > 0 ? o.z : o.q); if (px && q) cb.onLiq({ t: +o.T, px: px / coin.bnMult, usd: px * q, side: o.S === 'SELL' ? 'long' : 'short', ex: 'binance' }); }
            } catch (e) { }
          };
        } else {
          ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
          ws.onopen = function () { retry = 0; ws.send(JSON.stringify({ op: 'subscribe', args: ['tickers.' + coin.by, 'allLiquidation.' + coin.by] })); ping = setInterval(function () { try { ws.send('{"op":"ping"}'); } catch (e) { } }, 20000); };
          ws.onmessage = function (m) {
            try {
              var j = JSON.parse(m.data); if (!j.topic) return;
              if (j.topic.indexOf('tickers.') === 0 && j.data && j.data.lastPrice) cb.onPrice(+j.data.lastPrice / coin.byMult);
              else if (j.topic.indexOf('allLiquidation.') === 0) (j.data || []).forEach(function (o) { var px = +o.p, q = +o.v; if (px && q) cb.onLiq({ t: +o.T, px: px / coin.byMult, usd: px * q, side: o.S === 'Buy' ? 'long' : 'short', ex: 'bybit' }); });
            } catch (e) { }
          };
        }
        if (coin.bn) ws.onopen = function () { retry = 0; };
        ws.onclose = function () { clearInterval(ping); if (!dead) timer = setTimeout(open, Math.min(30000, 2000 * Math.pow(2, retry++))); };
        ws.onerror = function () { try { ws.close(); } catch (e) { } };
      } catch (e) { timer = setTimeout(open, 15000); }
    }
    open();
    return { close: function () { dead = true; clearTimeout(timer); clearInterval(ping); try { if (ws) ws.close(); } catch (e) { } } };
  };
})();
