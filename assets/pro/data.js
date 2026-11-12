/* entekhab.net — /market/ data layer.
   Where every number comes from, in this order (the chart says which one it is using):
     1. Binance public market data — REST klines for history, ONE shared WebSocket for everything live      -> "live"
     2. OKX public REST, asked again every 10 seconds (no seconds timeframes there)                          -> "polled"
     3. the site's own snapshot data/candles/<SYM>_<tf>.json (BTC, ETH; CI every 15 min)                    -> "snapshot"
   Nothing is ever invented: when all three fail the chart says so and stays empty.
   Timeframes Binance does not have (5s, 10s, 7m, 45m, 3h, 2d …) are built here from the largest native interval that
   divides them; intraday buckets start at 00:00 UTC each day, the way TradingView aligns custom intraday intervals. */
(function () {
  'use strict';
  var P = window.PRO = window.PRO || {};
  var API = 'https://data-api.binance.vision/api/v3/', WSU = 'wss://data-stream.binance.vision/stream', OKX = 'https://www.okx.com/api/v5/market/';
  var NATIVE = { '1s': 1, '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '8h': 28800,
    '12h': 43200, '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000 };
  var BASES = ['1d', '12h', '8h', '6h', '4h', '2h', '1h', '30m', '15m', '5m', '3m', '1m', '1s'];
  var OKXBAR = { '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H', '2h': '2H', '4h': '4H', '6h': '6Hutc', '12h': '12Hutc',
    '1d': '1Dutc', '3d': '3Dutc', '1w': '1Wutc', '1M': '1Mutc' };
  var LIMIT = { s: 59, m: 720, h: 24, d: 7, w: 1, M: 1 };
  var MAXBARS = 20000, MAXBASE = 60000;
  /* localStorage as JSON; quietly does nothing where storage is blocked */
  P.store = { get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } } };

  /* ---------------------------------------------------------------- timeframes */
  function parseTF(id) {
    var m = /^(\d{1,3})(s|m|h|d|w|M)$/.exec(String(id || '')); if (!m) return null;
    var n = +m[1], u = m[2]; if (n < 1 || n > LIMIT[u]) return null;
    var sec = n * { s: 1, m: 60, h: 3600, d: 86400, w: 604800, M: 2592000 }[u];
    if (NATIVE[id] === sec) return { id: id, n: n, u: u, sec: sec, base: id, ratio: 1 };
    if (u === 'w' || u === 'M') return null;
    for (var i = 0; i < BASES.length; i++) {
      var b = BASES[i]; if (NATIVE[b] <= sec && sec % NATIVE[b] === 0) return { id: id, n: n, u: u, sec: sec, base: b, ratio: sec / NATIVE[b] };
    }
    return null;
  }
  function bucket(t, tf) {
    if (tf.ratio === 1) return t;
    if (tf.sec < 86400) { var d0 = t - ((t % 86400) + 86400) % 86400; return d0 + Math.floor((t - d0) / tf.sec) * tf.sec; }
    return t - ((t % tf.sec) + tf.sec) % tf.sec;
  }
  /* aggregate sorted base bars into timeframe bars */
  function aggregate(base, tf) {
    if (tf.ratio === 1) return base.slice();
    var out = [], cur = null;
    for (var i = 0; i < base.length; i++) {
      var b = base[i], k = bucket(b.t, tf);
      if (!cur || cur.t !== k) { cur = { t: k, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }; out.push(cur); }
      else { if (b.h > cur.h) cur.h = b.h; if (b.l < cur.l) cur.l = b.l; cur.c = b.c; cur.v += b.v; }
    }
    return out;
  }

  /* ---------------------------------------------------------------- net */
  function getJSON(url, ms) {
    var c = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (c) c.abort(); }, ms || 9000);
    return fetch(url, c ? { signal: c.signal } : {}).then(function (r) { clearTimeout(t); if (!r.ok) { var e = new Error('http ' + r.status); e.status = r.status; throw e; } return r.json(); },
      function (e) { clearTimeout(t); throw e; });
  }
  function rowB(k) { return { t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }; }
  function klines(sym, iv, limit, start, end) {
    var u = API + 'klines?symbol=' + sym + 'USDT&interval=' + iv + '&limit=' + (limit || 1000) + (start ? '&startTime=' + start : '') + (end ? '&endTime=' + end : '');
    return getJSON(u).then(function (a) { if (!Array.isArray(a)) throw new Error('bad'); return a.map(rowB); });
  }
  function okxCandles(sym, bar, limit, after) {
    return getJSON(OKX + (after ? 'history-candles' : 'candles') + '?instId=' + sym + '-USDT&bar=' + bar + '&limit=' + (limit || 300) + (after ? '&after=' + after : '')).then(function (j) {
      if (!j || !j.data) throw new Error('empty');
      return j.data.map(function (k) { return { t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }; }).reverse();
    });
  }
  function merge(into, rows) {          /* sorted, unique by t; later rows win */
    if (!rows.length) return into;
    var m = {}; into.forEach(function (b) { m[b.t] = b; }); rows.forEach(function (b) { if (b && b.c > 0) m[b.t] = b; });
    return Object.keys(m).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return m[k]; });
  }

  /* ---------------------------------------------------------------- one WebSocket for the whole page */
  var W = { ws: null, want: {}, live: {}, h: {}, timer: null, retry: 0, id: 1, on: [], up: false };
  function wsFlush() {
    clearTimeout(W.timer);
    W.timer = setTimeout(function () {
      if (P.saver || !('WebSocket' in window)) return;
      var keys = Object.keys(W.want);
      if (!W.ws) { if (keys.length) wsOpen(); return; }
      if (W.ws.readyState !== 1) return;
      var add = keys.filter(function (k) { return !W.live[k]; }), del = Object.keys(W.live).filter(function (k) { return !W.want[k]; });
      for (var i = 0; i < add.length; i += 100) { W.ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: add.slice(i, i + 100), id: W.id++ })); }
      for (i = 0; i < del.length; i += 100) { W.ws.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: del.slice(i, i + 100), id: W.id++ })); }
      add.forEach(function (k) { W.live[k] = 1; }); del.forEach(function (k) { delete W.live[k]; });
      if (!keys.length) { try { W.ws.close(); } catch (e) { } }
    }, 60);
  }
  function wsOpen() {
    var ws; try { ws = new WebSocket(WSU); } catch (e) { return; }
    W.ws = ws; W.live = {};
    ws.onopen = function () { W.retry = 0; W.up = true; wsFlush(); W.on.forEach(function (f) { try { f('open'); } catch (e) { } }); };
    ws.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || !m.stream) return;
      var hs = W.h[m.stream]; if (hs) hs.slice().forEach(function (f) { try { f(m.data); } catch (e) { if (window.console) console.error(e); } });
    };
    ws.onclose = function () {
      if (W.ws !== ws) return;
      W.ws = null; W.live = {}; var was = W.up; W.up = false;
      if (was) W.on.forEach(function (f) { try { f('close'); } catch (e) { } });
      if (!Object.keys(W.want).length || P.saver) return;
      var d = Math.min(30000, 1000 * Math.pow(2, W.retry++));
      setTimeout(function () { if (!W.ws && Object.keys(W.want).length) wsOpen(); }, d);
    };
  }
  function wsSub(stream, fn) { (W.h[stream] = W.h[stream] || []).push(fn); W.want[stream] = (W.want[stream] || 0) + 1; wsFlush(); }
  function wsUnsub(stream, fn) {
    var a = W.h[stream]; if (a) { var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); if (!a.length) delete W.h[stream]; }
    if (W.want[stream] && --W.want[stream] <= 0) delete W.want[stream];
    wsFlush();
  }
  P.wsState = function () { return W.up; };
  P.onWs = function (f) { W.on.push(f); };

  /* ---------------------------------------------------------------- a feed: one symbol + timeframe, shared by every chart that shows it */
  var feeds = {};
  function Feed(sym, tf) {
    this.key = sym + '|' + tf.id; this.sym = sym; this.tf = tf; this.base = []; this.bars = [];
    this.state = 'load'; this.src = null; this.at = null; this.err = null; this.full = false; this.busy = false;
    this.subs = []; this.refs = 0; this.poller = null; this.dead = false;
    var self = this;
    this.lastWs = 0;
    this.onK = function (d) {
      var k = d && d.k; if (!k) return;
      self.lastWs = Date.now();
      if (self.poller && self.src === 'binance') { clearInterval(self.poller); self.poller = null; }
      self.tick({ t: Math.floor(k.t / 1000), o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v }, !!k.x);
    };
  }
  Feed.prototype.tell = function (what, x) { var s = this; this.subs.slice().forEach(function (f) { try { f(what, s, x); } catch (e) { if (window.console) console.error(e); } }); };
  Feed.prototype.rebuild = function () {
    if (this.base.length > MAXBASE) this.base = this.base.slice(-MAXBASE);
    var bars = aggregate(this.base, this.tf);
    /* the oldest bucket is incomplete when history starts inside it: drop it rather than show a short bar */
    if (this.tf.ratio > 1 && bars.length && this.base.length && this.base[0].t !== bars[0].t && !this.full) bars.shift();
    this.bars = bars;
  };
  Feed.prototype.tick = function (b, closed) {
    if (this.dead || !(b.c > 0)) return;
    var B = this.base, n = B.length, last = n ? B[n - 1] : null;
    if (last && b.t < last.t) return;
    if (last && last.t === b.t) B[n - 1] = b; else B.push(b);
    var tf = this.tf, k = bucket(b.t, tf), bars = this.bars, lb = bars[bars.length - 1], nb;
    if (tf.ratio === 1) nb = { t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v };
    else {
      nb = null;
      for (var i = B.length - 1; i >= 0 && B[i].t >= k; i--) {
        var x = B[i];
        if (!nb) nb = { t: k, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v };
        else { nb.o = x.o; if (x.h > nb.h) nb.h = x.h; if (x.l < nb.l) nb.l = x.l; nb.v += x.v; }
      }
    }
    var isNew = !lb || nb.t > lb.t;
    if (lb && lb.t === nb.t) bars[bars.length - 1] = nb; else if (isNew) bars.push(nb);
    if (this.state !== 'live' && this.src === 'binance' && W.up) { this.state = 'live'; this.tell('state'); }
    this.at = Date.now();
    this.tell('tick', { bar: nb, isNew: isNew, closed: closed && nb.t + tf.sec <= b.t + (NATIVE[tf.base] || 1) });
  };
  Feed.prototype.stream = function () {
    if (this.dead || this.streaming) return;
    if (P.saver || !('WebSocket' in window)) return this.poll('binance');
    this.streaming = this.sym.toLowerCase() + 'usdt@kline_' + this.tf.base;
    this.streamAt = Date.now();
    wsSub(this.streaming, this.onK);
    if (this.src === 'binance') { this.state = W.up ? 'live' : 'wait'; this.tell('state'); }
  };
  Feed.prototype.unstream = function () { if (this.streaming) { wsUnsub(this.streaming, this.onK); this.streaming = null; } };
  Feed.prototype.poll = function (src) {
    var self = this; clearInterval(this.poller);
    var tf = this.tf, every = P.saver ? 30000 : 10000;
    this.state = 'poll'; this.tell('state');
    function once() {
      if (self.dead || document.hidden) return;
      var p = src === 'okx' ? okxCandles(self.sym, OKXBAR[self.obase], 3) : klines(self.sym, tf.base, Math.min(1000, tf.ratio + 2));
      p.then(function (rows) { rows.forEach(function (r) { self.tick(r, false); }); self.at = Date.now(); }, function () { });
    }
    this.poller = setInterval(once, every);
  };
  Feed.prototype.start = function () {
    var self = this, tf = this.tf;
    this.state = 'load'; this.tell('state');
    var bm = NATIVE[tf.base] * 1000, pages = tf.ratio === 1 ? 1 : Math.min(6, Math.ceil(600 * tf.ratio / 1000));
    var end = Math.floor(Date.now() / bm) * bm + bm, reqs = [];
    if (pages === 1) reqs.push(klines(this.sym, tf.base, 1000));
    else for (var k = 0; k < pages; k++) reqs.push(klines(this.sym, tf.base, 1000, end - (k + 1) * 1000 * bm, end - k * 1000 * bm - 1));
    return Promise.all(reqs).then(function (rs) {
      var all = []; rs.forEach(function (r) { all = all.concat(r); });
      if (!all.length) throw new Error('empty');
      self.base = merge([], all); self.src = 'binance'; self.err = null; self.at = Date.now();
      self.rebuild(); self.tell('reset'); self.stream();
    }).catch(function (e) {
      self.binanceErr = e;
      return self.fromOkx().catch(function () { return self.fromSite(); }).catch(function () {
        self.state = 'error'; self.err = 'nodata'; self.tell('state');
        clearTimeout(self.retryT); self.retryT = setTimeout(function () { if (!self.dead && self.refs) self.start(); }, 30000);
      });
    });
  };
  Feed.prototype.fromOkx = function () {
    var self = this, tf = this.tf;
    if (tf.sec < 60) return Promise.reject(new Error('no seconds on okx'));
    var ob = null; for (var b in OKXBAR) if (NATIVE[b] <= tf.sec && tf.sec % NATIVE[b] === 0 && (!ob || NATIVE[b] > NATIVE[ob])) ob = b;
    if (!ob) return Promise.reject(new Error('no okx bar'));
    this.obase = ob;
    var otf = { id: tf.id, sec: tf.sec, base: ob, ratio: tf.sec / NATIVE[ob], u: tf.u, n: tf.n };
    return okxCandles(this.sym, OKXBAR[ob], 300).then(function (rows) {
      if (!rows.length) throw new Error('empty');
      self.tf = otf; self.base = rows; self.src = 'okx'; self.rebuild(); self.tell('reset'); self.poll('okx');
    });
  };
  Feed.prototype.fromSite = function () {
    var self = this;
    return getJSON('/data/candles/' + this.sym + '_' + this.tf.id + '.json?v=' + Math.floor(Date.now() / 3e5)).then(function (j) {
      var a = j && j.s && j.s[self.sym] && j.s[self.sym][self.tf.id]; if (!a || !a.length) throw new Error('none');
      self.base = a.map(function (r) { return { t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] }; });
      self.src = 'site'; self.state = 'snap'; self.at = j.t ? Date.parse(j.t) : null; self.full = true; self.rebuild(); self.tell('reset'); self.tell('state');
    });
  };
  /* older history when the user scrolls back */
  Feed.prototype.more = function () {
    var self = this, tf = this.tf;
    if (this.busy || this.full || this.src !== 'binance' || !this.base.length || this.base.length >= MAXBASE || this.bars.length >= MAXBARS) return Promise.resolve(false);
    this.busy = true;
    var bm = NATIVE[tf.base] * 1000, first = this.base[0].t * 1000, pages = tf.ratio === 1 ? 1 : Math.min(3, Math.ceil(300 * tf.ratio / 1000)), reqs = [];
    for (var k = 0; k < pages; k++) reqs.push(klines(this.sym, tf.base, 1000, tf.ratio === 1 ? null : first - (k + 1) * 1000 * bm, first - k * 1000 * bm - 1));
    return Promise.all(reqs).then(function (rs) {
      var all = []; rs.forEach(function (r) { all = all.concat(r); });
      self.busy = false;
      if (!all.length) { self.full = true; return false; }
      var before = self.bars.length;
      self.base = merge(self.base, all);
      if ((tf.ratio === 1 && all.length < 999) || all.length < 10) self.full = true;
      self.rebuild(); self.tell('more', self.bars.length - before);
      return true;
    }, function () { self.busy = false; return false; });
  };
  /* after a dropped connection or a hidden tab: fetch what was missed */
  Feed.prototype.catchup = function () {
    var self = this, tf = this.tf;
    if (this.src !== 'binance' || !this.base.length || this.dead) return;
    var bm = NATIVE[tf.base] * 1000, from = this.base[this.base.length - 1].t * 1000, gap = Math.ceil((Date.now() - from) / bm) + 1;
    if (gap > 1000 * 3) return this.start();
    var pages = Math.ceil(gap / 1000), reqs = [];
    for (var k = 0; k < pages; k++) reqs.push(klines(this.sym, tf.base, 1000, from + k * 1000 * bm));
    Promise.all(reqs).then(function (rs) {
      var all = []; rs.forEach(function (r) { all = all.concat(r); });
      self.base = merge(self.base, all); self.rebuild(); self.tell('reset');
    }, function () { });
  };
  Feed.prototype.stop = function () {
    this.dead = true; this.unstream(); clearInterval(this.poller); clearTimeout(this.retryT); delete feeds[this.key];
  };

  setInterval(function () {
    var now = Date.now();
    Object.keys(feeds).forEach(function (k) {
      var F = feeds[k]; if (F.dead || F.src !== 'binance' || !F.streaming || F.poller || document.hidden) return;
      var quiet = F.tf.sec < 60 ? 20000 : 60000;
      if (now - Math.max(F.lastWs, F.streamAt || 0) > quiet) F.poll('binance');
    });
  }, 5000);

  /* subscribe(sym, tf, fn) -> unsubscribe function. fn(what, feed, x): what = reset | tick | more | state */
  P.feed = function (sym, tfId, fn) {
    var tf = parseTF(tfId); if (!tf) return null;
    var key = sym + '|' + tf.id, F = feeds[key];
    if (!F) { F = feeds[key] = new Feed(sym, tf); F.start(); }
    clearTimeout(F.killT);
    F.subs.push(fn); F.refs++;
    if (F.bars.length) setTimeout(function () { if (F.subs.indexOf(fn) >= 0) fn('reset', F); }, 0);
    return { feed: F, off: function () {
      var i = F.subs.indexOf(fn); if (i < 0) return;
      F.subs.splice(i, 1);
      if (--F.refs <= 0) F.killT = setTimeout(function () { if (F.refs <= 0) F.stop(); }, 20000);
    } };
  };
  P.feeds = feeds;

  /* ---------------------------------------------------------------- 24 h tickers for the watchlist and alerts */
  var TK = { d: {}, subs: [], fns: {}, poller: null, want: {} };
  function tkTell(sym) { TK.subs.slice().forEach(function (f) { try { f(sym, TK.d[sym]); } catch (e) { } }); }
  function tkPut(sym, o) {
    var c = +o.c, op = +o.o;
    if (!(c > 0)) return;
    var prev = TK.d[sym];
    TK.d[sym] = { c: c, o: op, h: +o.h, l: +o.l, q: +o.q, chg: op > 0 ? (c / op - 1) * 100 : null, at: Date.now(), prev: prev ? prev.c : null, src: o.src || 'binance' };
    tkTell(sym);
  }
  function tkRest(syms) {
    if (!syms.length) return Promise.resolve();
    var u = API + 'ticker/24hr?type=MINI&symbols=' + encodeURIComponent(JSON.stringify(syms.map(function (s) { return s + 'USDT'; })));
    return getJSON(u).then(function (a) {
      (a || []).forEach(function (x) { tkPut(x.symbol.replace(/USDT$/, ''), { c: x.lastPrice, o: x.openPrice, h: x.highPrice, l: x.lowPrice, q: x.quoteVolume }); });
    }, function () {
      return getJSON('/data/market.json?v=' + Math.floor(Date.now() / 3e5)).then(function (m) {
        (m.coins || []).forEach(function (x) { if (TK.want[x.coin] && x.price) tkPut(x.coin, { c: x.price, o: x.price / (1 + (x.chg24 || 0) / 100), h: x.price, l: x.price, q: x.qvol || 0, src: 'site' }); });
      });
    });
  }
  P.tickers = {
    d: TK.d,
    on: function (f) { TK.subs.push(f); return function () { var i = TK.subs.indexOf(f); if (i >= 0) TK.subs.splice(i, 1); }; },
    /* the set of symbols to keep live; replaces the previous set */
    watch: function (syms) {
      var next = {}; syms.forEach(function (s) { next[s] = 1; });
      var add = syms.filter(function (s) { return !TK.want[s]; });
      Object.keys(TK.want).forEach(function (s) { if (!next[s]) { wsUnsub(s.toLowerCase() + 'usdt@miniTicker', TK.fns[s]); delete TK.fns[s]; } });
      TK.want = next;
      add.forEach(function (s) {
        TK.fns[s] = function (d) { tkPut(s, d); };
        if (!P.saver) wsSub(s.toLowerCase() + 'usdt@miniTicker', TK.fns[s]);
      });
      if (add.length) tkRest(add.slice(0, 100));
      clearInterval(TK.poller);
      TK.poller = setInterval(function () { if (!document.hidden && (P.saver || !W.up)) tkRest(Object.keys(TK.want).slice(0, 100)); }, P.saver ? 60000 : 15000);
    }
  };

  /* ---------------------------------------------------------------- the symbol universe: every coin with its own logo that Binance lists against USDT */
  P.universe = function () {
    if (P._uni) return P._uni;
    var ls = P.store, cached = ls.get('ek_pro_px', null);
    var avail = (cached && cached.t > Date.now() - 864e5 && cached.s) ? Promise.resolve(cached.s) :
      getJSON(API + 'ticker/price', 15000).then(function (a) {
        var s = a.filter(function (x) { return /USDT$/.test(x.symbol); }).map(function (x) { return x.symbol.slice(0, -4); });
        ls.set('ek_pro_px', { t: Date.now(), s: s }); return s;
      });
    P._uni = Promise.all([P.logos().then(function (L) { return L ? Array.from(L) : []; }), avail.catch(function () { return null; }),
      getJSON('/data/market.json?v=' + Math.floor(Date.now() / 3e5)).catch(function () { return null; })]).then(function (r) {
      var logos = r[0] || [], av = r[1], mk = r[2], rank = {};
      ((mk && mk.coins) || []).forEach(function (c, i) { rank[c.coin] = i; });
      var set = av ? new Set(av) : new Set(Object.keys(rank));
      var list = logos.filter(function (c) { return set.has(c); });
      list.sort(function (a, b) { return (rank[a] == null ? 999 : rank[a]) - (rank[b] == null ? 999 : rank[b]) || (a < b ? -1 : 1); });
      return list;
    });
    return P._uni;
  };

  /* the coins the site has its own logo for: a coin is never shown without it (site rule). null when unknown */
  P.logos = function () {
    if (!P._logos) P._logos = getJSON('/data/logos/index.json', 15000).then(function (a) { var L = Array.isArray(a) && a.length ? new Set(a) : null; P._logoSet = L; return L; }, function () { return null; });
    return P._logos;
  };

  /* ---------------------------------------------------------------- data saver and the hidden tab */
  var nc = navigator.connection || {};
  P.saverAuto = !!(nc.saveData || /(^|-)2g$/.test(nc.effectiveType || ''));
  P.setSaver = function (on) {
    P.saver = !!on;
    Object.keys(feeds).forEach(function (k) { var F = feeds[k]; if (F.src === 'binance') { F.unstream(); clearInterval(F.poller); F.stream(); } });
    if (on && W.ws) { try { W.ws.close(); } catch (e) { } }
    wsFlush();
    P.tickers.watch(Object.keys(TK.want));
  };
  var hiddenAt = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 60000) Object.keys(feeds).forEach(function (k) { feeds[k].catchup(); });
    hiddenAt = 0;
  });
  P.onWs(function (what) { if (what === 'open') Object.keys(feeds).forEach(function (k) { if (feeds[k].src === 'binance') feeds[k].catchup(); }); });

  /* ---------------------------------------------------------------- replay data: a window of history around a past moment */
  P.history = function (sym, tfId, startMs, endMs) {
    var tf = parseTF(tfId); if (!tf) return Promise.reject(new Error('tf'));
    var bm = NATIVE[tf.base] * 1000, need = Math.ceil((endMs - startMs) / bm), pages = Math.min(8, Math.max(1, Math.ceil(need / 1000))), reqs = [];
    for (var k = 0; k < pages; k++) reqs.push(klines(sym, tf.base, 1000, startMs + k * 1000 * bm, Math.min(endMs, startMs + (k + 1) * 1000 * bm - 1)));
    return Promise.all(reqs).then(function (rs) {
      var all = []; rs.forEach(function (r) { all = all.concat(r); });
      return aggregate(merge([], all), tf);
    });
  };

  P.parseTF = parseTF; P.aggregate = aggregate; P.bucket = bucket; P.NATIVE = NATIVE; P.getJSON = getJSON;
  /* price precision from the size of the price (Binance sends 8 decimals whatever the tick) */
  P.prec = function (p) { p = Math.abs(p); if (!(p > 0)) return 2; if (p >= 100) return 2; if (p >= 10) return 3; if (p >= 1) return 4; return Math.min(10, Math.ceil(-Math.log10(p)) + 3); };
  P.fmt = function (p, d) { if (p == null || !isFinite(p)) return '—'; d = d == null ? P.prec(p) : d; return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  P.fmtV = function (v) { if (v == null || !isFinite(v)) return '—'; var a = Math.abs(v); return a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v.toFixed(a >= 10 ? 0 : 2); };
})();
