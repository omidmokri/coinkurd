/* Offline market feed for the «نبرد من» scene (tests only).
   Replaces WebSocket and the exchange REST calls with a synthetic BTCUSDT market: a local order book with a diff stream,
   a mid-price random walk, a trade tape, liquidations, and hooks (window.FAKE) to force walls, sweeps, whale trades and
   liquidation tiers on demand. Injected by tests/battle_harness.py before any page script runs. */
(() => {
  'use strict';
  let seed = 12345;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const P0 = 100000;
  const F = window.FAKE = { px: P0, upd: 5000, socks: [], bids: new Map(), asks: new Map(), auto: true, tick: 0, sent: 0 };
  const lvl = p => Math.round(p * 10) / 10;
  function seedBook() {
    F.bids.clear(); F.asks.clear();
    for (let i = 1; i <= 900; i++) {
      const pb = lvl(F.px - i * 1.0), pa = lvl(F.px + i * 1.0);
      F.bids.set(pb, +(0.05 + rnd() * 1.6).toFixed(4));
      F.asks.set(pa, +(0.05 + rnd() * 1.6).toFixed(4));
    }
  }
  seedBook();
  const snap = () => ({ lastUpdateId: F.upd, bids: [...F.bids].sort((a, b) => b[0] - a[0]).slice(0, 1000).map(([p, q]) => [String(p), String(q)]), asks: [...F.asks].sort((a, b) => a[0] - b[0]).slice(0, 1000).map(([p, q]) => [String(p), String(q)]) });
  const realFetch = window.fetch.bind(window);
  window.fetch = async (u, o) => {
    const s = String(u && u.url || u);
    const js = v => new Response(JSON.stringify(v), { status: 200, headers: { 'content-type': 'application/json' } });
    if (s.includes('/api/v3/depth')) return js(snap());
    if (s.includes('okx.com')) return js({ data: [] });
    if (/^https?:/.test(s) && !s.startsWith(location.origin)) return new Response('null', { status: 404 });
    return realFetch(u, o);
  };
  class FakeWS {
    constructor(url) { this.url = String(url); this.readyState = 0; this.binance = this.url.includes('data-stream.binance'); this.bybit = this.url.includes('bybit');
      setTimeout(() => { this.readyState = 1; F.socks.push(this); if (this.onopen) this.onopen(); }, 30); }
    send(m) { if (this.bybit) { try { const o = JSON.parse(m); if (o.op === 'subscribe') setTimeout(() => this.emit({ op: 'subscribe', success: true }), 10); } catch (e) { } } }
    close() { this.readyState = 3; F.socks = F.socks.filter(s => s !== this); }
    emit(o) { if (this.readyState === 1 && this.onmessage) this.onmessage({ data: JSON.stringify(o) }); }
  }
  FakeWS.OPEN = 1; FakeWS.CLOSED = 3; FakeWS.CONNECTING = 0;
  window.WebSocket = FakeWS;
  const bin = (stream, data) => { for (const s of F.socks) if (s.binance) s.emit({ stream: 'btcusdt@' + stream, data }); };
  const byb = data => { for (const s of F.socks) if (s.bybit) s.emit({ topic: 'allLiquidation.BTCUSDT', data }); };
  function diff(b, a) { const U = F.upd + 1; F.upd += 1; bin('depth@100ms', { e: 'depthUpdate', E: Date.now(), U, u: F.upd, b: b.map(([p, q]) => [String(p), String(q)]), a: a.map(([p, q]) => [String(p), String(q)]) }); F.sent++; }
  function ticker() { const bb = Math.max(...F.bids.keys()), ba = Math.min(...F.asks.keys()); bin('bookTicker', { b: String(bb), a: String(ba) }); }
  /* the mid moves: levels on the far side of the new mid are consumed */
  F.move = function (dp) {
    F.px = lvl(F.px + dp); const db = [], da = [];
    for (const p of [...F.bids.keys()]) if (p >= F.px) { F.bids.delete(p); db.push([p, 0]); }
    for (const p of [...F.asks.keys()]) if (p <= F.px) { F.asks.delete(p); da.push([p, 0]); }
    for (let i = 1; i <= 3; i++) { const pb = lvl(F.px - i), pa = lvl(F.px + i); if (!F.bids.has(pb)) { const q = +(0.05 + rnd()).toFixed(4); F.bids.set(pb, q); db.push([pb, q]); } if (!F.asks.has(pa)) { const q = +(0.05 + rnd()).toFixed(4); F.asks.set(pa, q); da.push([pa, q]); } }
    diff(db, da); ticker();
  };
  F.trade = function (usd, sell, p) { const px = p || F.px, q = usd / px; bin('aggTrade', { p: String(px), q: String(q), m: !!sell, T: Date.now(), E: Date.now() }); };
  /* a sweep: one taker order through n levels (same trade time) */
  F.sweep = function (n, usd, sell) { const T = Date.now(); for (let i = 0; i < n; i++) { const px = lvl(F.px + (sell ? -i : i)); bin('aggTrade', { p: String(px), q: String(usd / n / px), m: !!sell, T, E: T }); } };
  /* a resting wall: size usd at price p (bids below the mid, asks above) */
  F.wall = function (p, usd) { p = lvl(p); const side = p < F.px ? F.bids : F.asks, q = +(usd / p).toFixed(4); side.set(p, q); diff(p < F.px ? [[p, q]] : [], p < F.px ? [] : [[p, q]]); };
  F.pull = function (p) { p = lvl(p); if (F.bids.has(p)) { F.bids.delete(p); diff([[p, 0]], []); } if (F.asks.has(p)) { F.asks.delete(p); diff([], [[p, 0]]); } };
  F.liq = function (usd, side) { byb([{ p: String(F.px), v: String(usd / F.px), S: side === 'long' ? 'Buy' : 'Sell', T: Date.now() }]); };
  /* background market: small drift, steady tape, book churn; now and then a bigger print */
  setInterval(() => {
    if (!F.auto || !F.socks.length) return; F.tick++;
    if (rnd() < .35) F.move((rnd() - .5) * 6);
    const ch = []; for (let i = 0; i < 4; i++) { const sell = rnd() < .5, off = 1 + Math.floor(rnd() * 600), p = lvl(sell ? F.px + off : F.px - off), q = +(0.05 + rnd() * 2.2).toFixed(4); (sell ? F.asks : F.bids).set(p, q); ch.push([sell, p, q]); }
    diff(ch.filter(c => !c[0]).map(c => [c[1], c[2]]), ch.filter(c => c[0]).map(c => [c[1], c[2]]));
    if (rnd() < .8) F.trade(200 + rnd() * rnd() * 60000, rnd() < .5);
    if (F.tick % 6 === 0) ticker();
  }, 100);
  setInterval(() => { for (const s of F.socks) if (s.binance) s.emit({ stream: 'btcusdt@miniTicker', data: { o: String(P0), c: String(F.px) } }); }, 1000);
})();
