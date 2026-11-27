/* Phase C/D validation of /market/: the position maths, the trade planner, the risk board, the timeframe matrix and the
   regime engine, against reference figures worked out by hand (each case says how), edge cases, a long/short symmetry
   property over 500 seeded random cases, and the regressions fixed in Nov 2026.   Run: node tests/test_pro_phasecd.js */
global.window = {}; require('../assets/pro/calc.js'); require('../assets/pro/plan.js'); require('../assets/pro/mtf.js');
var P = window.PRO, C = P.calc, M = P.mtfCalc, n = 0, bad = 0;
function near(a, b, tol, what) { n++; var t = tol == null ? 1e-9 : tol; if (!(Math.abs(a - b) <= t * Math.max(1, Math.abs(b)))) { bad++; console.log('FAIL', what, 'got', a, 'want', b); } }
function is(a, b, what) { n++; if (a !== b) { bad++; console.log('FAIL', what, 'got', a, 'want', b); } }
var base = { balance: 1000, riskPct: 1, entry: 100, stop: 95, feePct: 0 };
function pos(o) { return C.position(Object.assign({}, base, o)); }
function plan(o) { return P.plan(Object.assign({}, base, o)); }

/* ---------------- A. edge cases: a message, never a figure */
is(pos({ stop: 100 }).err, 'dist', 'entry equals stop');
is(pos({ stop: 105, side: 'long' }).err, 'side', 'stop on the wrong side (long)');
is(pos({ stop: 95, side: 'short' }).err, 'side', 'stop on the wrong side (short)');
is(pos({ target: 90 }).err, 'tp', 'target on the wrong side');
is(pos({ balance: 0 }).err, 'num', 'zero balance');
is(pos({ balance: -500 }).err, 'num', 'negative balance');
is(pos({ riskPct: 0 }).err, 'num', 'zero risk');
is(pos({ riskPct: 101 }).err, 'risk', 'risk above 100%');
is(pos({ leverage: 0 }).err, 'lev', 'leverage 0 is invalid (it was silently 1 before)');
is(pos({ leverage: -3 }).err, 'lev', 'negative leverage');
is(pos({ leverage: 0.5 }).err, 'lev', 'leverage under 1');
is(pos({ leverage: 501 }).err, 'lev', 'leverage above 500');
is(pos({ leverage: 500 }).err, undefined, 'leverage 500 accepted');
is(pos({ leverage: '' }).qty > 0, true, 'empty leverage = 1');
is(pos({ entry: NaN }).err, 'num', 'missing market price');
is(pos({ slip: -1 }).err, 'num', 'negative slippage');
is(pos({ contract: 'spot', stop: 105, side: 'short' }).err, 'spotShort', 'spot cannot be short');
is(plan({ targets: [{ p: 110, q: 60 }, { p: 120, q: 50 }] }).err, 'pctOver', 'partial exits above 100% are an error');

/* ---------------- A. reference cases */
/* qty = 10 / (5 + 0.001×195 + 0.5) = 10/5.695 ; slippage widens the loss per unit */
near(pos({ feePct: 0.1, slip: 0.5 }).qty, 10 / 5.695, 1e-12, 'qty with fee and slippage');
/* break-even long with 0.1%: 100 × 1.001/0.999 ; short: 100 × 0.999/1.001 */
near(pos({ feePct: 0.1 }).breakeven, 100 * 1.001 / 0.999, 1e-12, 'break-even long');
near(pos({ feePct: 0.1, stop: 105, side: 'short' }).breakeven, 100 * 0.999 / 1.001, 1e-12, 'break-even short');
/* notional and margin: qty 2 × 100 = 200; at 10× margin 20 */
near(pos({ leverage: 10 }).notional, 200, null, 'notional'); near(pos({ leverage: 10 }).margin, 20, null, 'margin at 10×');
/* liquidation, linear isolated, 10×, MMR 0.5%: long 100×0.9/0.995, short 100×1.1/1.005 */
var r = pos({ leverage: 10, mmrPct: 0.5, stop: 80 }); near(r.liq, 90 / 0.995, 1e-12, 'linear long liq'); is(r.liqModel, 'simplified', 'labelled simplified'); is(r.liqBeforeStop, true, 'liq before a far stop');
near(pos({ leverage: 10, mmrPct: 0.5, stop: 105, side: 'short' }).liq, 110 / 1.005, 1e-12, 'linear short liq');
/* MMR 0 gives the old figure: 100 × (1 − 1/10) */
near(pos({ leverage: 10 }).liq, 90, 1e-12, 'linear long liq, mmr 0');
/* inverse: long 100×1.005/1.1, short 100×0.995/0.9; 1× long = half the price, 1× short never */
near(pos({ contract: 'inverse', leverage: 10, mmrPct: 0.5 }).liq, 100.5 / 1.1, 1e-12, 'inverse long liq');
near(pos({ contract: 'inverse', leverage: 10, mmrPct: 0.5, stop: 105, side: 'short' }).liq, 99.5 / 0.9, 1e-12, 'inverse short liq');
near(pos({ contract: 'inverse', leverage: 1 }).liq, 50, 1e-12, 'inverse 1× long liquidates at half');
is(pos({ contract: 'inverse', leverage: 1, stop: 105, side: 'short' }).liq, null, 'inverse 1× short has none');
/* a linear 1× short is liquidated when the price doubles (margin = notional) */
near(pos({ leverage: 1, stop: 105, side: 'short' }).liq, 200, 1e-12, 'linear 1× short at 2× price');
is(pos({ leverage: 1 }).liq, null, 'linear 1× long has none'); is(pos({ leverage: 1 }).liqWhy, 'none', '… and says so');
is(pos({ leverage: 10, marginMode: 'cross' }).liq, null, 'cross margin: no single price'); is(pos({ leverage: 10, marginMode: 'cross' }).liqWhy, 'cross', '… and says why');
r = pos({ contract: 'spot', leverage: 20 }); is(r.liq, null, 'spot: no liquidation'); near(r.margin, r.notional, 1e-12, 'spot: leverage forced to 1');

/* ---------------- planner: targets, partial exits, fees, funding */
/* long 2 units; 50% at 105, 50% at 105 (identical prices): profit 2×5 = 10 */
r = plan({ targets: [{ p: 105, q: 50 }, { p: 105, q: 50 }] }); near(r.profit, 10, null, 'identical targets'); near(r.avgExit, 105, null, 'identical avg exit');
r = plan({ targets: [] }); is(r.profit, undefined, 'missing target: no profit figure'); is(r.unalloc, 100, 'missing target: all open');
/* gross 2×10 = 20, fees in and out 2×0.001×210 = 0.42 (qty with fee: 10/5.195) */
r = plan({ feePct: 0.1, targets: [{ p: 110, q: 100 }] }); var q = 10 / 5.195; near(r.gross, q * 10, 1e-12, 'gross P&L'); near(r.exitFees, q * 0.21, 1e-12, 'fees in and out'); near(r.profit, q * (10 - 0.21), 1e-12, 'net P&L'); near(r.rr, q * 9.79 / 10, 1e-12, 'R-multiple after fees');
/* fees above the profit: entry 100, stop 99, fee 1%, target 100.5: per unit 0.5 − 0.01×200.5 = −1.505 */
r = plan({ stop: 99, feePct: 1, targets: [{ p: 100.5, q: 100 }] }); is(r.profit < 0, true, 'fees can exceed the profit'); near(r.profit, r.qty * -1.505, 1e-12, 'negative net figure');
/* funding: notional 200; +0.01% per 8 h for 24 h = 3 × 0.02 = 0.06 paid by a long */
r = plan({ targets: [{ p: 110, q: 100 }], fundingPct: 0.01, hours: 24 }); near(r.funding, 0.06, 1e-12, 'long pays positive funding'); near(r.net, 20 - 0.06, 1e-12, 'net after funding');
/* the same for a short: received (regression: it was charged) */
r = plan({ stop: 105, side: 'short', targets: [{ p: 90, q: 100 }], fundingPct: 0.01, hours: 24 }); near(r.funding, -0.06, 1e-12, 'short receives positive funding'); near(r.net, 20.06, 1e-12, 'short net includes it');
r = plan({ stop: 105, side: 'short', targets: [{ p: 90, q: 100 }], fundingPct: -0.01, hours: 24 }); near(r.funding, 0.06, 1e-12, 'short pays negative funding');
r = plan({ targets: [{ p: 110, q: 100 }], fundingPct: 0.01, hours: 24, fundHrs: 1 }); near(r.funding, 200 * 0.0001 * 24, 1e-12, 'hourly funding interval');
r = plan({ targets: [{ p: 110, q: 100 }], fundingPct: 0.01, hours: 7 }); is(r.funding, 0, 'no full interval → nothing charged');
is(plan({ contract: 'spot', targets: [{ p: 110, q: 100 }], fundingPct: 0.01, hours: 24 }).funding, undefined, 'spot has no funding');
near(plan({ targets: [{ p: 110, q: 100 }], fundingPct: 0.01, hours: 24 }).netStop, -10.06, 1e-12, 'loss at the stop includes funding paid');
/* slippage reaches the planner now (regression: it was dropped) */
near(plan({ slip: 1 }).qty, 10 / 6, 1e-12, 'planner uses slippage');

/* very small and very large prices, small balance, floating point */
r = pos({ entry: 0.0000121, stop: 0.0000119 }); near(r.qty, 10 / 0.0000002, 1e-9, 'tiny prices'); near(r.qty * 0.0000002, 10, 1e-9, 'tiny prices: risk is exact');
r = pos({ entry: 1000000, stop: 990000 }); near(r.qty, 0.001, 1e-12, 'large prices');
r = pos({ balance: 1, riskPct: 1 }); near(r.risk, 0.01, 1e-12, 'one-dollar account');
r = plan({ entry: 0.3, stop: 0.1, targets: [{ p: 0.7, q: 30 }, { p: 0.9, q: 70 }] }); near(r.avgExit, 0.3 * 0.7 + 0.7 * 0.9, 1e-12, 'float avg exit'); is(r.unalloc, 0, 'float shares 30 + 70 = 100 exactly');

/* ---------------- property: long and short mirror each other (500 seeded cases) */
var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
var asym = 0;
for (var k = 0; k < 500; k++) {
  var e = Math.pow(10, rnd() * 8 - 4), d = e * (0.001 + rnd() * 0.3), t = d * (0.5 + rnd() * 5), bal = 10 + rnd() * 1e6, rp = 0.1 + rnd() * 5, lev = 1 + Math.floor(rnd() * 100);
  var L = P.plan({ balance: bal, riskPct: rp, entry: e, stop: e - d, side: 'long', leverage: lev, targets: [{ p: e + t, q: 100 }] });
  var S2 = P.plan({ balance: bal, riskPct: rp, entry: e, stop: e + d, side: 'short', leverage: lev, targets: [{ p: e - t, q: 100 }] });
  if (L.err || S2.err || Math.abs(L.qty - S2.qty) > 1e-9 * L.qty || Math.abs(L.profit - S2.profit) > 1e-9 * Math.abs(L.profit) || Math.abs(L.rr - S2.rr) > 1e-9) asym++;
}
is(asym, 0, 'long/short symmetry over 500 random cases (no fees)');

/* ---------------- D. risk board */
var day = Date.UTC(2026, 10, 27), b;
var pl = [
  { sym: 'BTCUSDT', status: 'active', long: true, risk: 10, notional: 500, margin: 50, ex: 'Binance' },
  { sym: 'BTCUSDT', status: 'active', long: false, risk: 6, notional: 300, margin: 30, ex: 'OKX' },
  { sym: 'ETHUSDT', status: 'planned', long: true, risk: 20, notional: 400, margin: 40 },
  { sym: 'SOLUSDT', status: 'closed', long: true, risk: 8, notional: 100, margin: 10, closedAt: day + 3600e3, pnl: -12 },
  { sym: 'SOLUSDT', status: 'closed', long: true, risk: 8, notional: 100, margin: 10, closedAt: day - 3600e3, pnl: -50 }
];
b = P.planBoard(pl, 1000, 3, { dayStart: day });
near(b.risk, 16, null, 'active risk: both BTC plans on two exchanges'); is(b.n, 2, 'active count'); near(b.planned.risk, 20, null, 'planned risk kept apart'); is(b.planned.n, 1, 'planned count');
near(b.long, 500, null, 'long exposure'); near(b.short, 300, null, 'short exposure'); near(b.net, 200, null, 'net exposure'); near(b.gross, 800, null, 'gross exposure');
near(b.margin, 80, null, 'margin used (active only)'); near(b.freeMargin, 920, null, 'free margin');
near(b.closed.pnlToday, -12, null, 'only today’s closed result counts'); near(b.lossToday, 12, null, 'today’s realised loss');
near(b.limit, 30, null, 'daily limit = 3% of the day’s starting equity'); near(b.left, 30 - 12 - 16, null, 'allowance left'); is(b.over, false, 'not over yet');
pl.push({ sym: 'ETHUSDT', status: 'active', long: true, risk: 5, notional: 100, margin: 10 }); b = P.planBoard(pl, 1000, 3, { dayStart: day }); is(b.over, true, 'a further active plan crosses the limit');
pl.pop(); pl.shift(); b = P.planBoard(pl, 1000, 3, { dayStart: day }); near(b.risk, 6, null, 'deleting a plan lowers the risk');
b = P.planBoard(pl, 1000, 3, { dayStart: day + 864e5 }); near(b.lossToday, 0, null, 'the daily loss resets the next day');
is(P.planStatus({ open: 1 }), 'planned', 'old plans ticked "open" by default come back as planned');
is(P.planKey({ sym: 'BTCUSDT', long: true, entry: 100, stop: 95, qty: 2 }) === P.planKey({ sym: 'BTCUSDT', long: true, entry: 100.0000000000001, stop: 95, qty: 2 }), true, 'duplicate plan detected');
is(P.planKey({ sym: 'BTCUSDT', long: true, entry: 100, stop: 95, qty: 2, ex: 'OKX' }) === P.planKey({ sym: 'BTCUSDT', long: true, entry: 100, stop: 95, qty: 2, ex: 'Binance' }), false, 'same plan on another exchange is not a duplicate');
var cl = P.planClean([{ sym: 'BTCUSDT', entry: 1, stop: 2, risk: 1 }, { sym: '<x>', entry: 1, stop: 2, risk: 1 }, { sym: 'ETHUSDT', entry: 'a', stop: 2, risk: 1 }, null, 5], /^[A-Z0-9]{2,20}$/);
is(cl.length, 1, 'import keeps only well-formed plans'); is(cl[0].status, 'planned', 'imported status cleaned');
is(P.planClean([{ sym: 'BTCUSDT', entry: 1, stop: 2, risk: 1, ex: '<img onerror=1>' }])[0].ex, '', 'exchange name sanitised');

/* ---------------- E. matrix: closed candles only, states */
var BB = [{ t: 0 }, { t: 60 }, { t: 120 }];
is(M.closedOnly(BB, 60, 170, false).length, 2, 'the forming candle is dropped');
is(M.closedOnly(BB, 60, 180, false).length, 3, 'a candle closed exactly now is kept');
is(M.closedOnly(BB, 60, 180, true).length, 2, 'a built timeframe drops its partial first candle');
function row(o) { return Object.assign({ bars: 300, trend: 'up', struct: { k: 'up' }, lean: 'up', hist: 1 }, o); }
is(M.state(row({})), 'confirmed', 'state confirmed');
is(M.state(row({ struct: { k: 'mixed' } })), 'developing', 'state developing');
is(M.state(row({ trend: 'mixed', struct: { k: 'mixed' }, lean: 'flat', hist: 0 })), 'neutral', 'state neutral');
is(M.state(row({ struct: { k: 'down' } })), 'conflicting', 'state conflicting (trend vs structure)');
is(M.state(row({ hist: -1 })), 'conflicting', 'state conflicting (trend vs MACD)');
is(M.state(row({ bars: 150 })), 'insufficient', 'state insufficient');
is(M.state({ err: 'short' }), 'insufficient', 'no data = insufficient');

/* ---------------- F. regime engine on synthetic markets */
function mk(N, fn, vol) { var out = [], p = 100; for (var i = 0; i < N; i++) { var c = fn(i, p); out.push({ t: i * 3600, o: p, h: Math.max(p, c) * 1.002, l: Math.min(p, c) * 0.998, c: c, v: vol ? vol(i) : 100 }); p = c; } return out; }
var w = function (i) { return Math.sin(i * 1.7) * 0.15; };
var bull = mk(400, function (i) { return 100 * Math.exp(i * 0.004) + w(i); }), bear = mk(400, function (i) { return 100 * Math.exp(-i * 0.004) + w(i); });
var rs = 3; function rr() { rs = (rs * 16807) % 2147483647; return rs / 2147483647; }
var range = mk(400, function (i, p) { return p + (100 - p) * 0.3 + (rr() - 0.5) * 0.8; });   /* mean-reverting noise around 100 */
is(M.regime(bull).trend, 'bull', 'bull trend'); is(M.regime(bear).trend, 'bear', 'bear trend'); is(M.regime(range).trend, 'range', 'range');
/* a crash: three bars down 8% on 5× volume */
var crash = mk(300, function (i, p) { return i >= 297 ? p * 0.92 : 100 + w(i); }, function (i) { return i >= 297 ? 500 : 100; });
is(M.regime(crash).selloff, true, 'sudden crash detected'); is(M.regime(crash).surge, false, '… not as a rally');
var pop = mk(300, function (i, p) { return i >= 297 ? p * 1.08 : 100 + w(i); }, function (i) { return i >= 297 ? 500 : 100; });
is(M.regime(pop).surge, true, 'sudden breakout detected (new)'); is(M.regime(pop).selloff, false, '… not as a sell-off');
var quiet = mk(300, function (i) { return 100 + (i > 280 ? Math.sin(i) * 0.01 : Math.sin(i / 3) * 2); });
is(M.regime(quiet).band, 'squeeze', 'compression (Bollinger squeeze)'); is(M.regime(quiet).vol, 'low', 'low volatility');
var wild = mk(300, function (i) { return 100 + (i > 285 ? Math.sin(i) * 6 : Math.sin(i / 3) * 0.3); });
is(M.regime(wild).vol, 'high', 'high volatility'); is(M.regime(wild).band, 'expansion', 'expansion');
/* fewer than 100 values for a percentile: no volatility or band label is forced (regression: a missing value read as "low") */
var shortB = mk(80, function (i) { return 100 + w(i); }); is(M.regime(shortB).vol, 'na', 'short history: no volatility label'); is(M.regime(shortB).band, 'na', 'short history: no band label'); is(M.regime(shortB).partial, true, 'short history: EMA 200 missing is flagged');
is(M.regime(mk(40, function () { return 100; })).err, 'short', 'missing data: no regime');
/* thresholds are configurable */
is(M.regime(range, null, { adx: 0 }).trend !== 'range', true, 'ADX threshold 0: never range'); is(M.regime(bull, null, { adx: M.regime(bull).adx + 1 }).trend, 'range', 'ADX threshold above the reading: range');
/* no look-ahead: the label of bar i is the same whether or not later bars exist */
var sFull = M.regimeSeries(bull), sCut = M.regimeSeries(bull.slice(0, 250)), la = 0; for (k = 0; k < 250; k++) if (sFull[k] !== sCut[k]) la++;
is(la, 0, 'regime history has no look-ahead');

console.log('test_pro_phasecd.js: ' + n + ' checks, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
