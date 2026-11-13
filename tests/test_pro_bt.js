/* /market/ backtesting (assets/pro/backtest.js): the practice account, the strategy tester, the optimizer grid and the
   history loader, checked against hand-worked cases. Run: node tests/test_pro_bt.js */
'use strict';
const path = require('path');
const PRO = path.join(__dirname, '..', 'assets', 'pro');
global.window = globalThis; global.document = { addEventListener() {}, createElement() { return { getContext() { return null; }, style: {} }; } };
require(path.join(PRO, 'i18n.js')); require(path.join(PRO, 'ind.js'));
const P = global.PRO;
const TF = { '1m': 60, '5m': 300, '1h': 3600, '4h': 14400, '1d': 86400, '2d': 172800 };
P.parseTF = (id) => TF[id] ? { sec: TF[id], base: id === '2d' ? '1d' : id } : null;
P.NATIVE = { '1m': 60, '5m': 300, '1h': 3600, '4h': 14400, '1d': 86400 };
P.store = { get: (k, d) => d, set() {} }; P.uid = () => Math.random().toString(36).slice(2);
P.inst = (s) => ({ quote: /_IRT$/.test(s) ? 'IRT' : 'USDT' }); P.isToman = (s) => /_IRT$/.test(s);
P.app = { T: (k, a) => P.tr('en', k, a), esc: (s) => s, h() {}, $() {}, $$() { return []; }, toast() {}, emit() {} };
require(path.join(PRO, 'backtest.js'));

let fails = 0, n = 0;
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-9 : e) * Math.max(1, Math.abs(b));
function ok(c, msg) { n++; if (!c) { fails++; console.log('FAIL', msg); } }
const bar = (t, o, h, l, c) => ({ t, o, h, l, c, v: 1 });
const acct = (cfg) => { const a = new P.Account(Object.assign({ bal: 10000, size: 100, lev: 1, fee: 0, slip: 0 }, cfg), 'BTC'); a.lastT = 0; a.px = 100; return a; };

/* 1. inside a bar: the nearer extreme first */
let a = acct(); a.open(1, 100, 0, { sl: 95, tp: 110 });
a.onBar(bar(1, 100, 111, 94, 100));                         /* |h−o| 11 > |o−l| 6: the low comes first → stop */
ok(a.trades.length === 1 && a.trades[0].why === 'sl' && near(a.trades[0].exit, 95), 'low first hits the stop');
ok(near(a.bal, 9500), 'stop result: −5% of the whole balance ' + a.bal);
a = acct(); a.open(1, 100, 0, { sl: 95, tp: 110 });
a.onBar(bar(1, 100, 112, 96, 105));                         /* low 96 first (no stop), then 112 → target */
ok(a.trades.length === 1 && a.trades[0].why === 'tp' && near(a.trades[0].exit, 110), 'then the high reaches the target');
a = acct(); a.open(1, 100, 0, { sl: 95, tp: 110 });
a.onBar(bar(1, 100, 104, 90, 92));                          /* high first (4 < 10), then the low → stop */
ok(a.trades[0].why === 'sl', 'high first, then the stop');
a = acct(); a.open(1, 100, 0, { sl: 95, tp: 110 });
a.onBar(bar(1, 100, 111, 89, 100));                         /* a tie (11 = 11): the low first, the cautious reading */
ok(a.trades[0].why === 'sl', 'a tie goes to the stop');

/* 2. a gap fills at the open */
a = acct(); a.open(1, 100, 0, { sl: 95 });
a.onBar(bar(1, 90, 92, 85, 88));
ok(a.trades[0].why === 'sl' && near(a.trades[0].exit, 90), 'gap through the stop fills at the open (90), not 95');
a = acct(); a.open(-1, 100, 0, { tp: 90 });
a.onBar(bar(1, 85, 87, 84, 86));
ok(a.trades[0].why === 'tp' && near(a.trades[0].exit, 85), 'short target gapped: fills at the better open');

/* 3. orders */
a = acct(); a.order({ side: 1, type: 'limit', price: 95, t: 0 });
let ev = a.onBar(bar(1, 99, 101, 94, 97));
ok(ev.length === 1 && ev[0].kind === 'fill' && a.pos && near(a.pos.entry, 95), 'buy limit fills at its price');
a = acct({ slip: 0.1 }); a.order({ side: 1, type: 'limit', price: 95, t: 0 });
a.onBar(bar(1, 99, 101, 94, 97));
ok(near(a.pos.entry, 95), 'a limit fill has no slippage');
a = acct({ slip: 0.1 }); a.order({ side: -1, type: 'stop', price: 90, t: 0 });
a.onBar(bar(1, 88, 89, 86, 87));                            /* gap below the stop */
ok(a.pos && a.pos.side === -1 && near(a.pos.entry, 88 * (1 - 0.001)), 'sell stop gapped: the open minus slippage ' + (a.pos && a.pos.entry));
a = acct(); a.order({ side: 1, type: 'stop', price: 105, sl: 97, tp: 109, t: 0 });
a.onBar(bar(1, 100, 110, 95, 108));                         /* low first (5 < 10): 95 (no position yet), then up: fill 105, target 109 */
ok(a.trades.length === 1 && a.trades[0].why === 'tp' && near(a.trades[0].entry, 105), 'stop entry then its target in the same bar');
a = acct(); a.open(1, 100, 0); a.order({ side: 1, type: 'limit', price: 98, t: 0 });
ev = a.onBar(bar(1, 100, 101, 97, 99));
ok(ev.some((x) => x.kind === 'skip') && a.orders.length === 0, 'an order on the side already open is cancelled');
a = acct(); a.open(1, 100, 0); a.order({ side: -1, type: 'limit', price: 104, t: 0 });
a.onBar(bar(1, 100, 105, 99, 103));
ok(a.trades.length === 1 && a.trades[0].why === 'rev' && a.pos && a.pos.side === -1 && near(a.pos.entry, 104), 'an opposite fill reverses');

/* 4. fees and slippage */
a = acct({ fee: 0.1, size: 100 }); a.open(1, 100, 0, { tp: 110 });
a.onBar(bar(1, 100, 111, 99.5, 110));
ok(near(a.trades[0].pnl, 1000 - 10 - 11), 'fees both sides: +1000 − 10 − 11 = ' + a.trades[0].pnl);
ok(near(a.bal, 10979) && near(a.fees, 21), 'balance and fees');
a = acct({ slip: 0.1 }); a.open(1, 100, 0, { sl: 95 });
ok(near(a.pos.entry, 100.1), 'market entry pays slippage');
a.onBar(bar(1, 100, 100.5, 94, 95));
ok(near(a.trades[0].exit, 95 * 0.999), 'a stop exit pays slippage');

/* 5. leverage and liquidation */
a = acct({ size: 10, lev: 10 }); a.open(1, 100, 0);
ok(near(a.liqPrice(), 100 - 1000 * 0.995 / 100), 'liquidation price ' + a.liqPrice());
a.onBar(bar(1, 100, 101, 89, 95));
ok(a.trades[0].why === 'liq' && near(a.trades[0].pnl, -1000) && near(a.bal, 9000), 'liquidation takes the margin, no more');
a = acct({ size: 10, lev: 10 }); a.open(1, 100, 0, { sl: 92 });
a.onBar(bar(1, 100, 101, 89, 95));
ok(a.trades[0].why === 'sl' && near(a.trades[0].exit, 92), 'a stop above the liquidation fires first');
a = acct({ size: 50, lev: 1 }); a.open(1, 100, 0);
ok(a.liqPrice() === null, 'no liquidation for a long without leverage');
a = acct({ size: 50, lev: 1 }); a.open(-1, 100, 0);
ok(a.liqPrice() > 199 && a.liqPrice() < 200, 'a 1× short is liquidated near twice the entry');

/* 6. trailing stop */
a = acct({ trail: 5 }); a.open(1, 100, 0);
a.onBar(bar(1, 100, 120, 99, 118));                         /* best 120 → stop 114, from the next bar */
ok(a.pos && near(a.pos.sl, 114) && a.pos.trailed, 'the trailing stop follows the high');
a.onBar(bar(2, 118, 119, 113, 115));
ok(a.trades[0].why === 'trail' && near(a.trades[0].exit, 114) && near(a.trades[0].pct, 14), 'trailing exit +14%');

/* 7. equity curve, statistics */
a = acct({ size: 100 });
const B = [bar(1, 100, 101, 99, 100), bar(2, 100, 106, 99, 105), bar(3, 105, 105, 94, 95), bar(4, 95, 112, 95, 110)];
a.open(1, 100, 1); a.onBar(B[0]); a.close(100, 1, 'manual');      /* flat trade */
a.open(1, 100, 2); a.onBar(B[1]); a.close(105, 2, 'manual');      /* +5% */
a.open(-1, 105, 3); a.onBar(B[2]); a.close(95, 3, 'manual');      /* short +~9.5% */
let s = P.btStats(a, B, 86400);
ok(s.n === 3 && s.wins === 2 && s.losses === 1 && near(s.win, 200 / 3), 'win rate ' + s.win);
ok(near(s.net, a.bal - 10000) && s.pf === Infinity, 'net and an infinite profit factor without a loss');
ok(near(s.hold, 10), 'buy & hold from the first open to the last close: ' + s.hold);
ok(s.short.n === 1 && s.long.n === 2, 'long/short split');

/* 8. strategies: a signal at a close is filled at the next open */
const W = []; for (let i = 0; i < 600; i++) { const c = 100 + 20 * Math.sin(i / 25) + 3 * Math.sin(i / 3.3); W.push(bar(i * 3600, i ? W[i - 1].c : c, Math.max(c, i ? W[i - 1].c : c) + 0.5, Math.min(c, i ? W[i - 1].c : c) - 0.5, c)); }
const sig = P.btStrats.macross.sig(W, { fast: 9, slow: 21 });
a = P.btRun('BTC', W, 'macross', { fast: 9, slow: 21 }, { bal: 10000, size: 100, lev: 1, fee: 0, slip: 0 });
ok(a.trades.length > 5, 'EMA cross trades on a wave: ' + a.trades.length);
const idx = new Map(W.map((b, i) => [b.t, i]));
ok(a.trades.every((t) => { const i = idx.get(t.t0); return i > 0 && sig[i - 1] === t.side && near(t.entry, W[i].o); }), 'every entry is the open after its signal');
ok(a.trades.every((t, k) => k === 0 || t.t0 >= a.trades[k - 1].t1), 'one position at a time');
const al = P.btRun('BTC', W, 'macross', { fast: 9, slow: 21 }, { bal: 10000, size: 100, fee: 0, dir: 'long' });
ok(al.trades.length > 2 && al.trades.every((t) => t.side === 1), 'long only');
for (const id of Object.keys(P.btStrats)) {
  if (id === 'ek') continue;
  const r = P.btRun('BTC', W, id, P.btStrats[id].p, { bal: 10000 });
  ok(r.trades.every((t) => isFinite(t.pnl) && t.t1 >= t.t0), id + ' runs: ' + r.trades.length + ' trades');
}
const dn = P.btRun('BTC', W, 'donch', { len: 20, exit: 10 }, { bal: 10000, size: 100, fee: 0 });
ok(dn.trades.some((t) => t.why === 'sig'), 'the turtles leave on the exit channel');
/* the Kurdistani signals: acted on at the open after their daily bar closed */
const D = []; for (let i = 0; i < 40; i++) D.push(bar(1767225600 + i * 86400, 100 + i, 101 + i, 99 + i, 100.5 + i));
const sigs = [{ sym: 'BTCUSDT', tf: '1D', side: 'long', t: new Date(D[10].t * 1000).toISOString() }, { sym: 'BTCUSDT', tf: '1D', side: 'info', t: new Date(D[15].t * 1000).toISOString() }, { sym: 'BTCUSDT', tf: '1D', side: 'short', t: new Date(D[20].t * 1000).toISOString() }];
P.parseTF = ((f) => (id) => f(id === '1D' ? '1d' : id))(P.parseTF);
a = P.btRun('BTC', D, 'ek', {}, { bal: 10000, size: 100, fee: 0 }, { sigs });
ok(a.trades.length === 1 && a.trades[0].t0 === D[11].t && near(a.trades[0].entry, D[11].o) && a.trades[0].t1 === D[21].t, 'signals act one daily bar later, at the open');
ok(a.pos && a.pos.side === -1, 'the short signal reverses');
const H = []; for (let i = 0; i < 48; i++) H.push(bar(D[10].t + i * 3600, 100, 101, 99, 100));
a = P.btRun('BTC', H, 'ek', {}, { bal: 10000 }, { sigs });
ok(a.trades.length === 0 && a.pos && a.pos.t === D[11].t, 'on hourly bars too: entry at the first hour after the daily close');

/* 9. the optimizer grid */
let g = P.btGrid({ fast: { from: 5, to: 15, step: 5 }, slow: { from: 10, to: 30, step: 10 } });
ok(g.length === 7 && g.every((q) => q.fast < q.slow), 'grid keeps fast < slow: ' + g.length);
g = P.btGrid({ mult: { from: 1.5, to: 3, step: 0.5 } });
ok(g.length === 4 && g[3].mult === 3, 'float steps reach the end');
g = P.btGrid({ len: { from: 20, to: 10, step: 5 } });
ok(g.length === 1, 'a reversed range is one value');

/* 10. more history: contiguous, no repeats, the asked size */
P.history = (sym, tf, s, e) => {
  const sec = TF[tf], out = []; let t = Math.ceil(s / 1000 / sec) * sec;
  for (; t * 1000 <= e && out.length < 8000 * (TF[tf] / (P.NATIVE[P.parseTF(tf).base])); t += sec) if (t >= 3600 * 1000) out.push(bar(t, 1, 1, 1, 1));
  return Promise.resolve(out);
};
const first = 3600 * 30000;
P.btOlder('BTC', '1h', first, 20000).then((r) => {
  ok(r.length === 20000, 'older: 20000 bars, got ' + r.length);
  ok(r.every((b, i) => i === 0 || b.t - r[i - 1].t === 3600) && r[r.length - 1].t === first - 3600, 'older: contiguous and ending right before the chart');
  return P.btOlder('BTC', '1h', 3600 * 1500, 5000);
}).then((r) => {
  ok(r.length === 500 && r[0].t === 3600 * 1000, 'older stops at the first bar the market has: ' + r.length);
  console.log(n + ' checks, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
});
