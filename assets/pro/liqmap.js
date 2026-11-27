/* entekhab.net — /market/ Liquidity map: only what an exchange actually publishes, nothing estimated.
     1. Resting orders now: the public order books of Binance futures, Binance spot, Bybit futures and OKX spot,
        each read every 10 seconds, grouped into price steps and drawn as a profile at the chart's right edge.
     2. The book over time: each reading is kept while the page is open and drawn as a heat map behind the candles.
        Nothing before the moment you switched it on is shown, because no free source keeps old order books.
     3. Real liquidations: Binance's and Bybit's public liquidation streams, as bubbles at their time and price.
        Binance sends at most one liquidation per coin per second, so its count is a floor; Bybit sends all of them.
   Each book only covers a band around the price (its depth limit). The map shows the band every chosen book covers;
   outside it the totals would be missing orders, so they are faded and left out of the walls list. An order can be
   pulled at any moment: a wall is what was there, not a promise. Estimated "liquidation levels" are not drawn here. */
(function () {
  'use strict';
  var P = window.PRO = window.PRO || {};
  var MAXL = 5000, POLL = 10000, KEEP = 360, MAXLIQ = 400;
  var SYMOK = /^[A-Z0-9]{1,15}USDT$/;
  /* the chart's own symbol (BTC = BTC/USDT on Binance) to the exchanges' one; only plain coin/USDT charts have a book in the chart's own price */
  function exOf(sym, inst) { var i = inst ? inst(sym) : null; if (!i || i.kind !== 'usdt' || i.base === 'USDT') return null; var s = i.base + 'USDT'; return SYMOK.test(s) ? s : null; }
  function f(v) { v = +v; return isFinite(v) ? v : NaN; }
  /* [[price, qty, …], …] → [[p, q]] with both finite and positive, at most MAXL rows */
  function rows(a) {
    var o = []; if (!Array.isArray(a)) return o;
    for (var i = 0; i < a.length && o.length < MAXL; i++) { var r = a[i]; if (!Array.isArray(r)) continue; var p = f(r[0]), q = f(r[1]); if (p > 0 && q > 0) o.push([p, q]); }
    return o;
  }
  /* the venues: where each book is read and how its answer is turned into bids and asks (quantities in the coin) */
  var VEN = {
    bnf: { url: function (s) { return 'https://fapi.binance.com/fapi/v1/depth?symbol=' + s + '&limit=1000'; },
      parse: function (j) { return j && Array.isArray(j.bids) ? { b: rows(j.bids), a: rows(j.asks), ts: +j.T || +j.E || 0 } : null; } },
    bns: { url: function (s) { return 'https://data-api.binance.vision/api/v3/depth?symbol=' + s + '&limit=5000'; },
      parse: function (j) { return j && Array.isArray(j.bids) ? { b: rows(j.bids), a: rows(j.asks), ts: 0 } : null; } },
    byf: { url: function (s) { return 'https://api.bybit.com/v5/market/orderbook?category=linear&symbol=' + s + '&limit=500'; },
      parse: function (j) { var r = j && j.retCode === 0 && j.result; return r && Array.isArray(r.b) ? { b: rows(r.b), a: rows(r.a), ts: +r.ts || 0 } : null; } },
    okx: { url: function (s) { return 'https://www.okx.com/api/v5/market/books?instId=' + s.slice(0, -4) + '-USDT&sz=400'; },
      parse: function (j) { var r = j && j.code === '0' && Array.isArray(j.data) && j.data[0]; return r && Array.isArray(r.bids) ? { b: rows(r.bids), a: rows(r.asks), ts: +r.ts || 0 } : null; } }
  };
  var VK = ['bnf', 'bns', 'byf', 'okx'];
  /* a round step near frac of the price: 1, 2, 2.5 or 5 times a power of ten */
  function niceStep(mid, frac) {
    var raw = mid * frac; if (!(raw > 0)) return 0;
    var e = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / e, k = m < 1.5 ? 1 : m < 2.25 ? 2 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10;
    return +(k * e).toPrecision(6);
  }
  /* several books → one map. Bucket k holds prices in [k·step, (k+1)·step). lo / hi: the band every book covers
     (the highest of the books' lowest bids, the lowest of their highest asks) */
  function merge(books, step) {
    var m = { step: step, lo: -Infinity, hi: Infinity, bid: {}, ask: {}, by: {}, mid: NaN, n: 0 }, bb = -Infinity, ba = Infinity;
    Object.keys(books).forEach(function (v) {
      var B = books[v]; if (!B || !B.b.length || !B.a.length) return; m.n++;
      var minB = Infinity, maxA = -Infinity;
      B.b.forEach(function (r) { var k = Math.floor(r[0] / step + 1e-9); m.bid[k] = (m.bid[k] || 0) + r[1]; var key = 'b' + k; (m.by[key] = m.by[key] || {})[v] = (m.by[key][v] || 0) + r[1]; if (r[0] < minB) minB = r[0]; if (r[0] > bb) bb = r[0]; });
      B.a.forEach(function (r) { var k = Math.floor(r[0] / step + 1e-9); m.ask[k] = (m.ask[k] || 0) + r[1]; var key = 'a' + k; (m.by[key] = m.by[key] || {})[v] = (m.by[key][v] || 0) + r[1]; if (r[0] > maxA) maxA = r[0]; if (r[0] < ba) ba = r[0]; });
      if (minB > m.lo) m.lo = minB; if (maxA < m.hi) m.hi = maxA;
    });
    if (!m.n) return null;
    m.mid = (bb + ba) / 2; m.bestBid = bb; m.bestAsk = ba;
    return m;
  }
  /* a bucket counts only when the whole of it lies inside the band every book covers */
  function full(m, k) { return k * m.step >= m.lo - 1e-12 && (k + 1) * m.step <= m.hi + 1e-12; }
  /* the n biggest full buckets on each side */
  function walls(m, n) {
    function side(o, s) {
      return Object.keys(o).map(Number).filter(function (k) { return full(m, k); }).map(function (k) {
        var p = (k + 0.5) * m.step, q = o[k], by = m.by[(s === 'bid' ? 'b' : 'a') + k] || {}, top = Object.keys(by).sort(function (x, y) { return by[y] - by[x]; })[0];
        return { k: k, side: s, p: p, lo: k * m.step, hi: (k + 1) * m.step, q: q, usd: q * p, dist: 100 * (p / m.mid - 1), top: top, share: q ? by[top] / q : 0 };
      }).sort(function (a, b) { return b.q - a.q; }).slice(0, n);
    }
    return { bid: side(m.bid, 'bid'), ask: side(m.ask, 'ask') };
  }
  /* how long a bucket has held at least half of its size now, from the readings kept (newest last) */
  function heldFor(hist, side, k, q) {
    var t = null;
    for (var i = hist.length - 1; i >= 0; i--) { var o = hist[i][side]; if (!o || !((o[k] || 0) >= q / 2)) break; t = hist[i].t; }
    return t == null || !hist.length ? 0 : hist[hist.length - 1].t - t;
  }
  /* liquidation messages → { t (ms), v: venue, side: 'long' | 'short' (the position that was closed), p, q, usd } */
  function liqBinance(j) {
    var o = j && j.o; if (!o || !SYMOK.test(o.s || '')) return null;
    var p = f(o.ap) > 0 ? f(o.ap) : f(o.p), q = f(o.z) > 0 ? f(o.z) : f(o.q); if (!(p > 0 && q > 0)) return null;
    return { t: f(o.T) || Date.now(), v: 'bnf', sym: o.s, side: o.S === 'SELL' ? 'long' : 'short', p: p, q: q, usd: p * q };
  }
  function liqBybit(j) {
    if (!j || !/^allLiquidation\./.test(j.topic || '') || !Array.isArray(j.data)) return [];
    return j.data.map(function (x) {
      var p = f(x.p), q = f(x.v); if (!(p > 0 && q > 0) || !SYMOK.test(x.s || '')) return null;
      return { t: f(x.T) || Date.now(), v: 'byf', sym: x.s, side: x.S === 'Buy' ? 'long' : 'short', p: p, q: q, usd: p * q };
    }).filter(Boolean);
  }
  /* the size that maps to full colour: the 95th percentile of all bucket sizes kept, so one wall does not wash out the rest */
  function scale(hist) {
    var a = [];
    hist.forEach(function (h) { ['bid', 'ask'].forEach(function (s) { var o = h[s]; for (var k in o) a.push(o[k]); }); });
    if (!a.length) return 0; a.sort(function (x, y) { return x - y; });
    return a[Math.min(a.length - 1, Math.floor(a.length * 0.95))];
  }
  P.lq = { VEN: VEN, VK: VK, rows: rows, niceStep: niceStep, merge: merge, full: full, walls: walls, heldFor: heldFor, liqBinance: liqBinance, liqBybit: liqBybit, scale: scale, SYMOK: SYMOK, exOf: exOf };

  /* ---------------------------------------------------------------- in the page */
  if (typeof document === 'undefined') return;
  var A, T, h, $, $$, esc;
  function ready() { A = P.app; if (!A) return false; T = A.T; h = A.h; $ = A.$; $$ = A.$$; esc = A.esc; return true; }
  var S = P.store ? P.store.get('ek_pro_lq', {}) : {};
  var cfg = { ven: { bnf: true, bns: true, byf: true, okx: true }, pct: 0.05, heat: true, prof: true, liq: true };
  if (S && typeof S === 'object') {
    if (S.ven && typeof S.ven === 'object') VK.forEach(function (k) { if (typeof S.ven[k] === 'boolean') cfg.ven[k] = S.ven[k]; });
    if ([0.02, 0.05, 0.1, 0.25, 0.5].indexOf(+S.pct) >= 0) cfg.pct = +S.pct;
    ['heat', 'prof', 'liq'].forEach(function (k) { if (typeof S[k] === 'boolean') cfg[k] = S[k]; });
  }
  function saveCfg() { if (P.store) P.store.set('ek_pro_lq', cfg); }
  /* one map at a time, for one chart */
  var L = null;          /* { cell, sym, on, step, books: {v: book}, stat: {v: {ok, t, err, n}}, hist: [{t, bid, ask}], m, liq: [], ws: [], timer } */
  function getJSON(url, ms) {
    var c = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (c) c.abort(); }, ms || 9000);
    return fetch(url, c ? { signal: c.signal, cache: 'no-store' } : {}).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('http ' + r.status); return r.json(); },
      function (e) { clearTimeout(t); throw e; });
  }
  function poll() {
    if (!L || !L.on) return;
    if (document.hidden) { L.timer = setTimeout(poll, POLL); return; }
    var sym = L.ex, want = VK.filter(function (v) { return cfg.ven[v]; });
    Promise.all(want.map(function (v) {
      return getJSON(VEN[v].url(sym)).then(function (j) {
        var b = VEN[v].parse(j); if (!b || !b.b.length || !b.a.length) throw new Error('empty');
        L && (L.stat[v] = { ok: true, t: Date.now(), n: b.b.length + b.a.length, lo: b.b[b.b.length - 1][0], hi: b.a[b.a.length - 1][0] }); return [v, b];
      }, function (e) { if (L) L.stat[v] = { ok: false, t: Date.now(), err: String(e && e.message || e).slice(0, 40) }; return [v, null]; });
    })).then(function (res) {
      if (!L || L.ex !== sym || !L.on) return;
      var books = {}; res.forEach(function (r) { if (r[1]) books[r[0]] = r[1]; });
      var mid0 = L.m ? L.m.mid : NaN, any = Object.keys(books)[0];
      if (!L.step && any) { var b0 = books[any]; L.step = niceStep((b0.b[0][0] + b0.a[0][0]) / 2, cfg.pct / 100); }
      var m = L.step ? merge(books, L.step) : null;
      if (m) {
        L.m = m; L.t = Date.now();
        var keepB = {}, keepA = {};
        for (var k in m.bid) if (full(m, +k)) keepB[k] = m.bid[k];
        for (k in m.ask) if (full(m, +k)) keepA[k] = m.ask[k];
        L.hist.push({ t: L.t, bid: keepB, ask: keepA, lo: m.lo, hi: m.hi }); if (L.hist.length > KEEP) L.hist.shift();
        L.sc = scale(L.hist);
      }
      redraw(); paintPanel();
    }).then(function () { if (L && L.on && L.ex === sym) L.timer = setTimeout(poll, POLL); });
  }
  /* the liquidation streams: Binance futures (one per coin per second at most) and Bybit futures (all) */
  function openWS() {
    closeWS(); if (!L || !L.on || !cfg.liq) return;
    var sym = L.ex;
    try {
      var b = new WebSocket('wss://fstream.binance.com/ws/' + sym.toLowerCase() + '@forceOrder');
      b.onmessage = function (e) { try { var x = liqBinance(JSON.parse(e.data)); if (x && L && x.sym === L.ex) addLiq(x); } catch (er) { } };
      b.onopen = function () { if (L) L.wsOk.bnf = true; paintPanel(); }; b.onerror = function () { if (L) L.wsOk.bnf = false; paintPanel(); };
      L.ws.push(b);
    } catch (e) { }
    try {
      var y = new WebSocket('wss://stream.bybit.com/v5/public/linear'), ping = null;
      y.onopen = function () { y.send(JSON.stringify({ op: 'subscribe', args: ['allLiquidation.' + sym] })); ping = setInterval(function () { try { y.send('{"op":"ping"}'); } catch (e) { } }, 20000); if (L) L.wsOk.byf = true; paintPanel(); };
      y.onmessage = function (e) { try { liqBybit(JSON.parse(e.data)).forEach(function (x) { if (L && x.sym === L.ex) addLiq(x); }); } catch (er) { } };
      y.onclose = function () { clearInterval(ping); }; y.onerror = function () { if (L) L.wsOk.byf = false; paintPanel(); };
      L.ws.push(y);
    } catch (e) { }
  }
  function closeWS() { if (!L) return; L.ws.forEach(function (w) { try { w.close(); } catch (e) { } }); L.ws = []; L.wsOk = {}; }
  function addLiq(x) { L.liq.push(x); if (L.liq.length > MAXLIQ) L.liq.shift(); redraw(); paintPanelSoon(); }
  function start(cell) {
    stop(); if (!cell) return;
    var sym = cell.cfg.sym, ex = exOf(sym, P.inst);
    L = { cell: cell, sym: sym, ex: ex, on: !!ex, step: 0, books: {}, stat: {}, hist: [], m: null, liq: [], ws: [], wsOk: {}, timer: 0, since: Date.now() };
    if (!L.on) return;
    poll(); openWS();
  }
  function stop() { if (!L) return; clearTimeout(L.timer); closeWS(); var c = L.cell; L = null; if (c && c.ovl) c.ovl.update(); }
  function redraw() { if (L && L.cell && L.cell.ovl) L.cell.ovl.update(); }
  /* a new step size starts the record again: old readings were grouped differently */
  function restep() { if (!L) return; L.step = 0; L.hist = []; L.m = null; clearTimeout(L.timer); poll(); }

  /* ---------------------------------------------------------------- drawing on the chart */
  function rgba(c, a) { return 'rgba(' + c + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }
  var CB = '52,211,153', CA = '255,90,77';
  /* a time (ms) to x on this chart, through the bars the chart actually shows */
  function xAt(cell, ts, tms) {
    var D = cell.disp && cell.disp.length ? cell.disp : cell.bars, sec = cell.tfSec(); if (!D || !D.length || !sec) return null;
    var lg = P.t2l ? P.t2l(D, tms / 1000, sec) : D.length - 1 + (tms / 1000 - D[D.length - 1].t) / sec;
    return lg == null || !isFinite(lg) ? null : ts.logicalToCoordinate(lg);
  }
  P.lqX = function (tms) { return L && L.cell ? xAt(L.cell, L.cell.chart.timeScale(), tms) : null; };   /* for the tests */
  function paint(ctx, W, H, cell) {
    if (!L || L.cell !== cell || !L.on || L.sym !== cell.cfg.sym) return;
    var s = cell.main, ts = cell.chart.timeScale(), m = L.m, st = L.step;
    if (!m || !st) return;
    var yOf = function (p) { return s.priceToCoordinate(p); };
    /* heat map of the readings kept, at the time each was read */
    if (cfg.heat && L.hist.length && cell.bars.length) {
      var sc = L.sc || 1, xOf = function (tms) { return xAt(cell, ts, tms); };
      for (var i = 0; i < L.hist.length; i++) {
        var hh = L.hist[i], x0 = xOf(hh.t - POLL / 2), x1 = xOf(i < L.hist.length - 1 ? L.hist[i + 1].t - POLL / 2 : hh.t + POLL / 2);
        if (x0 == null || x1 == null || x1 < 0 || x0 > W) continue;
        var w = Math.max(1, x1 - x0);
        [['bid', CB], ['ask', CA]].forEach(function (z) {
          var o = hh[z[0]];
          for (var k in o) {
            var ya = yOf((+k + 1) * st), yb = yOf(+k * st); if (ya == null || yb == null || yb < 0 || ya > H) continue;
            var a = Math.min(1, o[k] / sc); if (a < 0.06) continue;
            ctx.fillStyle = rgba(z[1], 0.08 + 0.55 * a); ctx.fillRect(x0, ya, w, Math.max(1, yb - ya));
          }
        });
      }
    }
    /* the book now, as bars from the right edge; faded where not every book reaches */
    if (cfg.prof) {
      var maxQ = 0, k2;
      for (k2 in m.bid) if (full(m, +k2)) maxQ = Math.max(maxQ, m.bid[k2]);
      for (k2 in m.ask) if (full(m, +k2)) maxQ = Math.max(maxQ, m.ask[k2]);
      if (maxQ > 0) {
        var PW = Math.min(180, W * 0.22), right = W - 2;
        [['bid', CB], ['ask', CA]].forEach(function (z) {
          var o = m[z[0]];
          for (var k in o) {
            var ya = yOf((+k + 1) * st), yb = yOf(+k * st); if (ya == null || yb == null || yb < 0 || ya > H) continue;
            var ok = full(m, +k), len = Math.min(PW, PW * o[k] / maxQ);
            ctx.fillStyle = rgba(z[1], ok ? 0.55 : 0.09); ctx.fillRect(right - len, ya + 0.5, len, Math.max(1, yb - ya - 1));
          }
        });
        /* the three biggest walls on each side, with their size in dollars */
        var wl = walls(m, 3); ctx.font = '600 10.5px Vazirmatn, Tahoma, sans-serif'; ctx.textBaseline = 'middle';
        var used = [];
        wl.bid.concat(wl.ask).sort(function (a, b) { return b.usd - a.usd; }).forEach(function (x) {
          var y = yOf(x.p); if (y == null || y < 8 || y > H - 8) return;
          if (used.some(function (u) { return Math.abs(u - y) < 15; })) return; used.push(y);
          var t = '$' + usd(x.usd), tw = ctx.measureText(t).width + 8;
          ctx.fillStyle = 'rgba(12,12,14,.78)'; ctx.fillRect(right - PW - tw - 4, y - 8, tw, 16);
          ctx.fillStyle = x.side === 'bid' ? '#34d399' : '#ff8a80'; ctx.fillText(t, right - PW - tw, y + 0.5);
        });
      }
    }
    /* liquidations: a bubble at the time and price, its area by size */
    if (cfg.liq && L.liq.length && cell.bars.length) {
      var mx = 0;
      L.liq.forEach(function (x) { if (x.usd > mx) mx = x.usd; });
      L.liq.forEach(function (x) {
        var X = xAt(cell, ts, x.t), Y = yOf(x.p); if (X == null || Y == null || X < -20 || X > W + 20 || Y < -20 || Y > H + 20) return;
        var r = 3 + 13 * Math.sqrt(x.usd / (mx || 1));
        ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2);
        ctx.fillStyle = x.side === 'long' ? 'rgba(255,90,77,.38)' : 'rgba(52,211,153,.38)'; ctx.fill();
        ctx.strokeStyle = x.side === 'long' ? '#ff5a4d' : '#34d399'; ctx.lineWidth = 1; ctx.stroke();
      });
    }
  }
  (P.ovHooks = P.ovHooks || []).push(paint);
  function usd(v) { return v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v.toFixed(0); }

  /* ---------------------------------------------------------------- the panel */
  var BOX = null, pTmr = 0;
  function paintPanelSoon() { clearTimeout(pTmr); pTmr = setTimeout(paintPanel, 250); }
  function ago(ms) { var s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? T('lqSec', { n: s }) : T('lqMin', { n: Math.round(s / 60) }); }
  function paintPanel() {
    if (!BOX || !document.body.contains(BOX)) { BOX = null; return; }
    var on = $('.pm-lqon', BOX); on.checked = !!(L && L.on);
    var st = $('.pm-lqst', BOX), ws = $('.pm-lqwalls', BOX), lq = $('.pm-lqliq', BOX), src = $('.pm-lqsrc', BOX);
    ws.innerHTML = ''; lq.innerHTML = ''; src.innerHTML = '';
    if (!L) { st.textContent = T('lqOff'); return; }
    if (!L.on) { st.textContent = T('lqNoSym', { s: P.pair ? P.pair(L.sym) : L.sym }); return; }
    var m = L.m, cell = L.cell, fp = function (p) { return cell.fmt ? cell.fmt(p) : String(p); };
    /* each venue: covered or not, how far its book reaches, when it was read */
    VK.forEach(function (v) {
      if (!cfg.ven[v]) return; var x = L.stat[v], li = h('<li></li>');
      li.className = x ? (x.ok ? 'ok' : 'bad') : 'wait';
      li.textContent = T('lqV_' + v) + ': ' + (!x ? T('lqWait') : x.ok ? T('lqVOk', { lo: fp(x.lo), hi: fp(x.hi), t: ago(Date.now() - x.t) }) : T('lqVBad'));
      src.appendChild(li);
    });
    ['bnf', 'byf'].forEach(function (v) {
      if (!cfg.liq) return; var li = h('<li></li>'), ok = L.wsOk[v];
      li.className = ok ? 'ok' : ok === false ? 'bad' : 'wait'; li.textContent = T('lqL_' + v) + ': ' + T(ok ? 'lqLiveOk' : ok === false ? 'lqVBad' : 'lqWait');
      src.appendChild(li);
    });
    if (!m) { st.textContent = T('lqWait'); return; }
    st.textContent = T('lqNow', { n: m.n, lo: fp(m.lo), hi: fp(m.hi), step: fp(L.step), k: L.hist.length, since: ago(Date.now() - L.since) });
    var W = walls(m, 5), tb = h('<table class="pm-lqt"><thead><tr><th></th><th></th><th></th><th></th><th></th></tr></thead><tbody></tbody></table>'), th = $$('th', tb);
    th[0].textContent = T('lqWPrice'); th[1].textContent = T('lqWDist'); th[2].textContent = T('lqWSize'); th[3].textContent = T('lqWHeld'); th[4].textContent = T('lqWTop');
    var body = $('tbody', tb);
    var byP = function (a, b) { return b.p - a.p; };
    W.ask.slice().sort(byP).concat(W.bid.slice().sort(byP)).forEach(function (x) {
      var tr = h('<tr><td dir="ltr"></td><td dir="ltr"></td><td dir="ltr"></td><td></td><td></td></tr>'), td = $$('td', tr);
      tr.className = x.side === 'bid' ? 'up' : 'dn';
      td[0].textContent = fp(x.lo) + ' – ' + fp(x.hi); td[1].textContent = (x.dist >= 0 ? '+' : '') + x.dist.toFixed(2) + '%';
      td[2].textContent = '$' + usd(x.usd); td[3].textContent = ago(heldFor(L.hist, x.side, x.k, x.q)); td[4].textContent = T('lqV_' + x.top) + ' ' + Math.round(100 * x.share) + '%';
      body.appendChild(tr);
    });
    ws.appendChild(tb);
    /* liquidations kept: totals by side and the latest few */
    if (cfg.liq) {
      var lo = 0, sh = 0; L.liq.forEach(function (x) { if (x.side === 'long') lo += x.usd; else sh += x.usd; });
      var p1 = h('<p class="pm-odhint"></p>'); p1.textContent = T('lqLiqSum', { n: L.liq.length, l: '$' + usd(lo), s: '$' + usd(sh), since: ago(Date.now() - L.since) }); lq.appendChild(p1);
      var ul = h('<ul class="pm-lqll"></ul>');
      L.liq.slice(-6).reverse().forEach(function (x) {
        var li = h('<li></li>'); li.className = x.side === 'long' ? 'dn' : 'up';
        li.textContent = T(x.side === 'long' ? 'lqLong' : 'lqShort') + ' · $' + usd(x.usd) + ' @ ' + fp(x.p) + ' · ' + T('lqV_' + x.v) + ' · ' + (A.fmtT ? A.fmtT(Math.floor(x.t / 1000), 'hms') : new Date(x.t).toISOString().slice(11, 19));
        ul.appendChild(li);
      });
      lq.appendChild(ul);
    }
  }
  P.liqMap = function () {
    if (!ready()) return; var cell = A.active(); if (!cell) return;
    var box = h('<div class="pm-lq"><details class="pm-odwhy"><summary></summary><p></p><p></p><p></p></details>' +
      '<label class="pm-lqtg"><input type="checkbox" class="pm-lqon"> <b></b></label><p class="pm-lqst"></p>' +
      '<div class="pm-sarow"><fieldset class="pm-lqven"><legend></legend></fieldset><fieldset class="pm-lqlay"><legend></legend></fieldset>' +
      '<label class="pm-field"><span></span><select class="pm-in pm-lqstep"></select></label></div>' +
      '<section class="pm-odsec"><h4></h4><div class="pm-lqwalls"></div><p class="pm-odhint pm-lqwn"></p></section>' +
      '<section class="pm-odsec pm-lqls"><h4></h4><div class="pm-lqliq"></div></section>' +
      '<section class="pm-odsec"><h4></h4><ul class="pm-lqsrc"></ul></section></div>');
    var why = $$('.pm-odwhy p', box); $('.pm-odwhy summary', box).textContent = T('lqWhyT'); why[0].textContent = T('lqWhy1'); why[1].textContent = T('lqWhy2'); why[2].textContent = T('lqWhy3');
    $('.pm-lqtg b', box).textContent = T('lqShow');
    $('.pm-lqven legend', box).textContent = T('lqBooks'); $('.pm-lqlay legend', box).textContent = T('lqLayers');
    VK.forEach(function (v) {
      var l = h('<label class="pm-sanotl"><input type="checkbox"> <span></span></label>'), i = $('input', l); $('span', l).textContent = T('lqV_' + v); i.checked = cfg.ven[v];
      i.onchange = function () { cfg.ven[v] = i.checked; if (!VK.some(function (k) { return cfg.ven[k]; })) { cfg.ven[v] = i.checked = true; } saveCfg(); if (L) { L.stat = {}; restep(); } };
      $('.pm-lqven', box).appendChild(l);
    });
    ['heat', 'prof', 'liq'].forEach(function (k) {
      var l = h('<label class="pm-sanotl"><input type="checkbox"> <span></span></label>'), i = $('input', l); $('span', l).textContent = T('lqLay_' + k); i.checked = cfg[k];
      i.onchange = function () { cfg[k] = i.checked; saveCfg(); if (k === 'liq' && L) { if (cfg.liq) openWS(); else closeWS(); } redraw(); paintPanel(); };
      $('.pm-lqlay', box).appendChild(l);
    });
    var fl = $$('.pm-field > span', box); fl[0].textContent = T('lqStep');
    var sel = $('.pm-lqstep', box); [0.02, 0.05, 0.1, 0.25, 0.5].forEach(function (p) { var o = new Option(p + '%', String(p)); if (p === cfg.pct) o.selected = true; sel.appendChild(o); });
    sel.onchange = function () { cfg.pct = +sel.value; saveCfg(); restep(); };
    var hs = $$('.pm-odsec h4', box); hs[0].textContent = T('lqWallsT'); hs[1].textContent = T('lqLiqT'); hs[2].textContent = T('lqSrcT');
    $('.pm-lqwn', box).textContent = T('lqWallNote');
    $('.pm-lqon', box).onchange = function () { if (this.checked) start(A.active()); else stop(); paintPanel(); };
    BOX = box;
    if (!L || L.cell !== cell || L.sym !== cell.cfg.sym) start(cell);
    A.modal(T('lqTitle') + ' · ' + (P.pair ? P.pair(cell.cfg.sym) : cell.cfg.sym), box, { wide: true, nofocus: true, onclose: function () { BOX = null; } });
    paintPanel();   /* after the window is up: the panel is only painted while it is on the page */
  };
  P.liqState = function () { return L ? { on: L.on, sym: L.sym, ex: L.ex, n: L.hist.length, m: !!L.m, liq: L.liq.slice(), step: L.step, stat: L.stat, lo: L.m && L.m.lo, hi: L.m && L.m.hi, mid: L.m && L.m.mid, w: L.m ? walls(L.m, 3) : null } : null; };   /* for the tests */
  P.liqStop = stop;
  /* the map follows its chart: a new coin or timeframe on it starts again; another chart's change leaves it alone */
  function hook() {
    if (!ready()) return;
    A.on('sym', function (cell) { if (L && L.cell === cell) { if (exOf(cell.cfg.sym, P.inst)) start(cell); else stop(); paintPanel(); } });
  }
  if (P.app) hook(); else document.addEventListener('DOMContentLoaded', hook);
  P.lqReady = true;
})();
