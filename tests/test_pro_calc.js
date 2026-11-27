/* the risk centre's arithmetic, against figures worked out by hand */
global.window = {}; require('../assets/pro/calc.js'); var C = window.PRO.calc, n = 0, bad = 0;
function near(a, b, tol, what) { n++; if (!(Math.abs(a - b) <= (tol == null ? 1e-9 : tol))) { bad++; console.log('FAIL', what, 'got', a, 'want', b); } }
function is(a, b, what) { n++; if (a !== b) { bad++; console.log('FAIL', what, 'got', a, 'want', b); } }
/* position: 1000 at 1% = 10 at risk; entry 100, stop 95, no fee: 10/5 = 2 units, 200 notional */
var r = C.position({ balance: 1000, riskPct: 1, entry: 100, stop: 95, target: 115, leverage: 1, feePct: 0, slip: 0 });
is(r.long, true, 'long'); near(r.qty, 2, null, 'qty'); near(r.notional, 200, null, 'notional'); near(r.profit, 30, null, 'profit'); near(r.rr, 3, null, 'rr'); is(r.liq, null, 'no liq at 1x');
/* with 0.1% fee each way: per unit = 5 + 0.001*(100+95) = 5.195 */
r = C.position({ balance: 1000, riskPct: 1, entry: 100, stop: 95, leverage: 10, feePct: 0.1 });
near(r.perUnit, 5.195, 1e-12, 'perUnit fee'); near(r.qty, 10 / 5.195, 1e-12, 'qty fee'); near(r.margin, 10 / 5.195 * 100 / 10, 1e-9, 'margin'); near(r.liq, 90, 1e-12, 'liq 10x long'); is(r.liqBeforeStop, false, 'stop first');
near(r.breakeven, 100 * 1.001 / 0.999, 1e-12, 'breakeven long');
/* short: entry 100, stop 104 → 4 per unit, 20 at risk → 5 units; liq at 5x = 120 */
r = C.position({ balance: 2000, riskPct: 1, entry: 100, stop: 104, target: 90, leverage: 5 });
is(r.long, false, 'short'); near(r.qty, 5, null, 'short qty'); near(r.liq, 120, 1e-12, 'liq short'); near(r.rr, 2.5, null, 'short rr');
is(C.position({ balance: 1000, riskPct: 1, entry: 100, stop: 100 }).err, 'dist', 'zero distance');
is(C.position({ balance: 1000, riskPct: 1, entry: 100, stop: 95, target: 99 }).err, 'tp', 'target wrong side');
is(C.position({ balance: 1000, riskPct: 1, entry: 100, stop: 105, side: 'long' }).err, 'side', 'stop wrong side');
is(C.position({ balance: 'x', riskPct: 1, entry: 100, stop: 95 }).err, 'num', 'not a number');
r = C.position({ balance: 1000, riskPct: 1, entry: 100, stop: 95, leverage: 50 }); is(r.liqBeforeStop, true, 'liq before stop at 50x'); near(r.liq, 98, 1e-12, 'liq 50x');
/* expectancy: 40% at 2R = 0.8 − 0.6 = 0.2R; break-even 33.33%; PF = 0.8/0.6 */
r = C.expectancy({ winPct: 40, rr: 2 }); near(r.ev, 0.2, 1e-12, 'ev'); near(r.breakevenWin, 100 / 3, 1e-9, 'be win'); near(r.profitFactor, 0.8 / 0.6, 1e-12, 'pf');
is(C.expectancy({ winPct: 140, rr: 2 }).err, 'num', 'p > 100');
/* kelly: p .6, b 1 → .2; p .4, b 2 → .1; p .3, b 1 → no edge */
near(C.kelly({ winPct: 60, rr: 1 }).full, 20, 1e-9, 'kelly 60/1'); near(C.kelly({ winPct: 40, rr: 2 }).half, 5, 1e-9, 'half kelly'); r = C.kelly({ winPct: 30, rr: 1 }); is(r.edge, false, 'no edge'); near(r.full, 0, null, 'kelly floor');
/* compound: 1000 at 10% for 2 = 1210; with +100 each period: 1000*1.21 + 100*(0.21/0.1) = 1420 */
near(C.compound({ start: 1000, ratePct: 10, periods: 2 }).final, 1210, 1e-9, 'compound'); r = C.compound({ start: 1000, ratePct: 10, periods: 2, add: 100 }); near(r.final, 1420, 1e-9, 'compound + add'); near(r.curve[2], 1420, 1e-9, 'curve end = formula'); near(r.paidIn, 1200, null, 'paid in');
near(C.compound({ start: 500, ratePct: 0, periods: 4, add: 50 }).final, 700, null, 'zero rate');
/* drawdown: 50% needs 100%; 20% needs 25%; ten 2% losses leave 0.98^10 */
near(C.drawdown({ ddPct: 50 }).recover, 100, 1e-9, 'dd 50'); near(C.drawdown({ ddPct: 20 }).recover, 25, 1e-9, 'dd 20'); near(C.drawdown({ ddPct: 10, riskPct: 2, losses: 10 }).afterStreak, (1 - Math.pow(0.98, 10)) * 100, 1e-9, 'streak');
is(C.drawdown({ ddPct: 100 }).err, 'num', 'dd 100');
/* ruin: certain cases, and the same inputs give the same answer */
near(C.ruin({ winPct: 100, rr: 1, riskPct: 2, ddPct: 30, trades: 100 }).prob, 0, null, 'never loses'); near(C.ruin({ winPct: 0, rr: 1, riskPct: 10, ddPct: 30, trades: 100 }).prob, 100, null, 'always loses');
is(C.ruin({ winPct: 45, rr: 2, riskPct: 2, ddPct: 30, trades: 200 }).prob, C.ruin({ winPct: 45, rr: 2, riskPct: 2, ddPct: 30, trades: 200 }).prob, 'deterministic');
r = C.ruin({ winPct: 50, rr: 1, riskPct: 5, ddPct: 20, trades: 300 }); var r2 = C.ruin({ winPct: 50, rr: 1, riskPct: 1, ddPct: 20, trades: 300 }); n++; if (!(r.prob > r2.prob)) { bad++; console.log('FAIL bigger risk must ruin more often', r.prob, r2.prob); }
/* oco: entry 100, stop 95 (R = 5); 50% at 105 (+1R), 30% at 110 (+2R), 20% at 120 (+4R) */
var t = [{ price: 105, pct: 50 }, { price: 110, pct: 30 }, { price: 120, pct: 20 }];
r = C.oco({ entry: 100, stop: 95, risk: 10, targets: t }); near(r.rows[0].r, -1, null, 'oco stop'); near(r.rows[1].r, 0.5 - 0.5, 1e-12, 'tp1 then stop'); near(r.rows[2].r, 0.5 + 0.6 - 0.2, 1e-12, 'tp2 then stop'); near(r.rows[3].r, 0.5 + 0.6 + 0.8, 1e-12, 'all targets'); near(r.rows[3].money, 19, 1e-9, 'money');
r = C.oco({ entry: 100, stop: 95, risk: 10, breakeven: true, targets: t }); near(r.rows[1].r, 0.5, 1e-12, 'tp1 then break-even'); near(r.rows[2].r, 1.1, 1e-12, 'tp2 then break-even');
r = C.oco({ entry: 100, stop: 104, targets: [{ price: 92, pct: 100 }] }); is(r.long, false, 'oco short'); near(r.rows[1].r, 2, 1e-12, 'short target');
is(C.oco({ entry: 100, stop: 95, targets: [{ price: 105, pct: 60 }, { price: 110, pct: 30 }] }).err, 'pct', 'shares must be 100');
is(C.oco({ entry: 100, stop: 95, targets: [{ price: 110, pct: 50 }, { price: 105, pct: 50 }] }).err, 'order', 'targets in order');
is(C.oco({ entry: 100, stop: 95, targets: [{ price: 99, pct: 100 }] }).err, 'tp', 'target wrong side');
console.log('test_pro_calc.js: ' + n + ' checks, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
