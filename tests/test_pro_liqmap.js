/* Liquidity map (assets/pro/liqmap.js): parsing each exchange's real answer format, grouping by price step, the band
   every book covers, walls, how long a wall held, and the liquidation feeds — against answers worked out by hand.
   node tests/test_pro_liqmap.js */
global.window = global; global.localStorage = { getItem: () => null, setItem: () => {} };
require(__dirname + '/../assets/pro/liqmap.js');
const Q = global.PRO.lq;
let n = 0, bad = 0;
function ok(c, what, x) { n++; if (!c) { bad++; console.log('FAIL', what, x === undefined ? '' : JSON.stringify(x)); } }
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9) * Math.max(1, Math.abs(b));

/* 1) the four answer formats, as the exchanges send them */
const bnf = Q.VEN.bnf.parse({ lastUpdateId: 1, E: 1700000000123, T: 1700000000100, bids: [['100.0', '2'], ['99.5', '1']], asks: [['100.5', '3'], ['101', '4']] });
ok(bnf && bnf.b.length === 2 && bnf.a[1][0] === 101 && bnf.a[1][1] === 4 && bnf.ts === 1700000000100, 'Binance futures depth', bnf);
const bns = Q.VEN.bns.parse({ lastUpdateId: 1, bids: [['100.0', '2']], asks: [['100.5', '3']] });
ok(bns && bns.b[0][0] === 100 && bns.ts === 0, 'Binance spot depth', bns);
const byf = Q.VEN.byf.parse({ retCode: 0, retMsg: 'OK', result: { s: 'BTCUSDT', b: [['100', '1.5']], a: [['100.5', '0.5']], ts: 1700000000200, u: 1 } });
ok(byf && byf.b[0][1] === 1.5 && byf.ts === 1700000000200, 'Bybit orderbook', byf);
const okx = Q.VEN.okx.parse({ code: '0', msg: '', data: [{ asks: [['100.5', '0.7', '0', '3']], bids: [['100', '0.9', '0', '2']], ts: '1700000000300' }] });
ok(okx && okx.a[0][1] === 0.7 && okx.ts === 1700000000300, 'OKX books (price, size, 0, orders)', okx);
ok(Q.VEN.byf.parse({ retCode: 10001, result: {} }) === null && Q.VEN.okx.parse({ code: '51001', data: [] }) === null && Q.VEN.bnf.parse({ code: -1121, msg: 'Invalid symbol.' }) === null, 'error answers give no book');
ok(Q.rows([['1', '2'], ['x', '1'], ['-1', '3'], ['2', '0'], ['3', 'NaN'], 'junk', ['4', '5']]).join('|') === '1,2|4,5', 'rows drop anything not a positive finite price and size');
ok(Q.VEN.okx.url('BTCUSDT').endsWith('instId=BTC-USDT&sz=400') && Q.VEN.bnf.url('ETHUSDT').includes('symbol=ETHUSDT&limit=1000') && Q.VEN.bns.url('ETHUSDT').includes('limit=5000') && Q.VEN.byf.url('SOLUSDT').includes('category=linear&symbol=SOLUSDT&limit=500'), 'each venue is asked for its deepest free book');
ok(Q.SYMOK.test('BTCUSDT') && !Q.SYMOK.test('BTC') && !Q.SYMOK.test('IR_USD') && !Q.SYMOK.test('btcusdt') && !Q.SYMOK.test('BTCUSDT/../x'), 'only coin/USDT symbols are asked for');

/* 2) price steps */
ok(Q.niceStep(100000, 0.0005) === 50 && Q.niceStep(3000, 0.0005) === 2 && Q.niceStep(0.000012, 0.001) === 1e-8 && Q.niceStep(25, 0.001) === 0.025 && Q.niceStep(0, 0.001) === 0, 'step = 1, 2, 2.5 or 5 × 10ⁿ near the share asked', [Q.niceStep(3000, 0.0005), Q.niceStep(0.000012, 0.001), Q.niceStep(25, 0.001)]);

/* 3) two books joined, worked by hand. Step 1.
   A: bids 100.2×2, 99.7×1, 98.1×5   asks 100.6×3, 101.4×1, 103.9×2
   B: bids 100.0×1, 99.2×4           asks 100.8×1, 102.5×6
   band: highest lowest bid = max(98.1, 99.2) = 99.2; lowest highest ask = min(103.9, 102.5) = 102.5 */
const A = { b: [[100.2, 2], [99.7, 1], [98.1, 5]], a: [[100.6, 3], [101.4, 1], [103.9, 2]] };
const B = { b: [[100.0, 1], [99.2, 4]], a: [[100.8, 1], [102.5, 6]] };
const m = Q.merge({ x: A, y: B }, 1);
ok(m.n === 2 && m.lo === 99.2 && m.hi === 102.5 && near(m.mid, (100.2 + 100.6) / 2), 'band every book covers, and the mid', [m.lo, m.hi, m.mid]);
ok(m.bid[100] === 3 && m.bid[99] === 5 && m.bid[98] === 5 && m.ask[100] === 4 && m.ask[101] === 1 && m.ask[102] === 6 && m.ask[103] === 2, 'sizes per step add across books', [m.bid, m.ask]);
ok(m.by.b99.x === 1 && m.by.b99.y === 4 && m.by.a100.x === 3 && m.by.a100.y === 1, 'each step remembers which book it came from', m.by);
/* full buckets: [k, k+1] inside [99.2, 102.5] → 100 and 101 only (99 starts below 99.2, 102 ends above 102.5) */
ok(!Q.full(m, 99) && Q.full(m, 100) && Q.full(m, 101) && !Q.full(m, 102) && !Q.full(m, 98), 'only steps wholly inside the band count', [99, 100, 101, 102].map(k => Q.full(m, k)));
const w = Q.walls(m, 5);
ok(w.bid.length === 1 && w.bid[0].k === 100 && w.bid[0].q === 3 && w.ask.length === 2 && w.ask[0].k === 100 && w.ask[0].q === 4 && w.ask[1].k === 101, 'walls leave out the steps not every book reaches', w);
ok(w.ask[0].top === 'x' && near(w.ask[0].share, 0.75) && near(w.ask[0].usd, 4 * 100.5) && near(w.ask[0].dist, 100 * (100.5 / 100.4 - 1)), 'a wall: mostly on which book, its dollars and its distance from the mid', w.ask[0]);
ok(Q.merge({ x: { b: [], a: [] } }, 1) === null && Q.merge({}, 1) === null, 'no books, no map');
/* a single book: the band is its own reach */
const m1 = Q.merge({ x: A }, 1);
ok(m1.lo === 98.1 && m1.hi === 103.9 && Q.full(m1, 99) && !Q.full(m1, 98) && !Q.full(m1, 103), 'one book: its own reach', [m1.lo, m1.hi]);
/* floating steps: 0.1 with prices like 0.3 must not slip into the step below */
const m2 = Q.merge({ x: { b: [[0.3, 1], [0.2, 1]], a: [[0.7, 1], [0.8, 1]] } }, 0.1);
ok(m2.bid[3] === 1 && m2.bid[2] === 1 && m2.ask[7] === 1 && m2.ask[8] === 1, 'a price on a step edge goes into that step, not the one below', [m2.bid, m2.ask]);

/* 4) how long a wall held: half of its size or more, counted back from the newest reading */
const hist = [{ t: 0, bid: { 5: 10 } }, { t: 10000, bid: { 5: 1 } }, { t: 20000, bid: { 5: 6 } }, { t: 30000, bid: { 5: 8 } }, { t: 40000, bid: { 5: 10 } }];
ok(Q.heldFor(hist, 'bid', 5, 10) === 20000, 'held since the last time it fell under half (20 s)', Q.heldFor(hist, 'bid', 5, 10));
ok(Q.heldFor(hist, 'bid', 6, 10) === 0 && Q.heldFor([], 'bid', 5, 10) === 0, 'never seen, or nothing kept: 0');

/* 5) liquidation feeds */
const lb = Q.liqBinance({ e: 'forceOrder', E: 1, o: { s: 'BTCUSDT', S: 'SELL', o: 'LIMIT', f: 'IOC', q: '0.014', p: '9910', ap: '9910.5', X: 'FILLED', l: '0.014', z: '0.014', T: 1568014460893 } });
ok(lb && lb.side === 'long' && lb.p === 9910.5 && lb.q === 0.014 && near(lb.usd, 9910.5 * 0.014) && lb.t === 1568014460893 && lb.v === 'bnf', 'Binance: a SELL liquidation order closes a long, at its average price and filled size', lb);
ok(Q.liqBinance({ o: { s: 'BTCUSDT', S: 'BUY', q: '2', p: '100', ap: '0', z: '0', T: 5 } }).side === 'short' && Q.liqBinance({ o: { s: 'BTCUSDT', S: 'BUY', q: '2', p: '100', ap: '0', z: '0', T: 5 } }).p === 100, 'Binance: a BUY closes a short; with no fill yet, its order price and size');
ok(Q.liqBinance({ o: { s: 'BTC', S: 'SELL', q: '1', p: '1' } }) === null && Q.liqBinance({}) === null && Q.liqBinance({ o: { s: 'BTCUSDT', q: 'x', p: '1' } }) === null, 'Binance: junk is refused');
const ly = Q.liqBybit({ topic: 'allLiquidation.ROSEUSDT', type: 'snapshot', ts: 1739502303204, data: [{ T: 1739502302929, s: 'ROSEUSDT', S: 'Sell', v: '20000', p: '0.04499' }, { T: 1739502302930, s: 'ROSEUSDT', S: 'Buy', v: '10', p: '0.045' }, { T: 1, s: 'ROSEUSDT', S: 'Buy', v: '-1', p: '1' }] });
ok(ly.length === 2 && ly[0].side === 'short' && ly[1].side === 'long' && near(ly[0].usd, 20000 * 0.04499) && ly[0].v === 'byf', 'Bybit: Buy means a long was liquidated (its docs), Sell a short', ly);
ok(Q.liqBybit({ op: 'pong' }).length === 0 && Q.liqBybit({ topic: 'orderbook.1.BTCUSDT', data: [] }).length === 0, 'Bybit: other messages give nothing');

/* 6) colour scale: the 95th percentile, so one huge wall does not wash out the rest */
const sh = [{ bid: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 }, ask: { 11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 1000 } }];
ok(Q.scale(sh) === 1000, 'with 20 sizes the 95th percentile is the 20th (index 19)', Q.scale(sh));
const sh2 = [{ bid: {}, ask: {} }]; for (let i = 1; i <= 100; i++) sh2[0].bid[i] = i; sh2[0].bid[101] = 1e6;
ok(Q.scale(sh2) === 96, 'with 101 sizes the colour scale stops at 96, not the outlier', Q.scale(sh2));
ok(Q.scale([]) === 0, 'nothing kept: 0');

console.log('test_pro_liqmap.js: ' + n + ' checks, ' + bad + ' failed');
process.exitCode = bad ? 1 : 0;
