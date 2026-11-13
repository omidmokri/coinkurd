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
  OB.coins = function (force) {
    if (force && coinsOk && !(coinsOk.binance && coinsOk.bybit)) coinsP = null;
    if (coinsP) return coinsP;
    coinsP = Promise.all([SRC.binance.list().catch(function () { return null; }), SRC.bybit.list().catch(function () { return null; })]).then(function (r) {
      var bn = r[0], by = r[1], m = {};
      if (!bn && !by) throw new Error('no exchange reachable');
      (bn || []).forEach(function (x) { var c = m[x.base] = m[x.base] || { base: x.base, vol: 0 }; c.bn = x.sym; c.bnMult = x.mult; c.vol += x.vol; c.px = x.px; c.chg = x.chg; });
      (by || []).forEach(function (x) { var c = m[x.base] = m[x.base] || { base: x.base, vol: 0 }; c.by = x.sym; c.byMult = x.mult; c.vol += x.vol; c.oiUsd = x.oiUsd; if (c.px == null) { c.px = x.px; c.chg = x.chg; } });
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
