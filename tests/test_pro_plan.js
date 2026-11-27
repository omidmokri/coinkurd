/* the trade planner and the open-risk board, against figures worked out by hand */
global.window = {}; require('../assets/pro/calc.js'); require('../assets/pro/plan.js'); var P = window.PRO, n = 0, bad = 0;
function near(a, b, tol, what) { n++; if (!(Math.abs(a - b) <= (tol == null ? 1e-9 : tol))) { bad++; console.log('FAIL', what, 'got', a, 'want', b); } }
function is(a, b, what) { n++; if (a !== b) { bad++; console.log('FAIL', what, 'got', a, 'want', b); } }
/* 1000 at 1% = 10; entry 100, stop 95, no fee → 2 units. 50% at 105 (+1R), 30% at 110, 20% at 120 */
var r = P.plan({ balance: 1000, riskPct: 1, leverage: 1, feePct: 0, entry: 100, stop: 95, side: 'long', targets: [{ p: 105, q: 50 }, { p: 110, q: 30 }, { p: 120, q: 20 }] });
near(r.qty, 2, null, 'qty'); near(r.targets[0].profit, 5, null, 'tp1 profit'); near(r.targets[1].profit, 6, null, 'tp2 profit'); near(r.targets[2].profit, 8, null, 'tp3 profit');
near(r.profit, 19, null, 'total'); near(r.rr, 1.9, 1e-12, 'blended R'); near(r.avgExit, 0.5 * 105 + 0.3 * 110 + 0.2 * 120, 1e-12, 'avg exit'); near(r.targets[2].r, 4, null, 'tp3 R'); is(r.scaled, false, 'not scaled');
/* shares 50 + 25 are NOT scaled any more (regression, Nov 2026): 25% has no target and stays open */
r = P.plan({ balance: 1000, riskPct: 1, feePct: 0, entry: 100, stop: 95, side: 'long', targets: [{ p: 105, q: 50 }, { p: 110, q: 25 }] });
is(r.scaled, false, 'not scaled'); near(r.unalloc, 25, 1e-9, 'unallocated share'); near(r.targets[0].share, 50, 1e-9, 'share 1'); near(r.profit, 2 * (0.5 * 5 + 0.25 * 10), 1e-9, 'profit of the allocated part'); near(r.avgExit, (0.5 * 105 + 0.25 * 110) / 0.75, 1e-9, 'avg exit of the allocated part');
/* a target on the wrong side is dropped, a short works in mirror */
r = P.plan({ balance: 2000, riskPct: 1, entry: 100, stop: 104, side: 'short', feePct: 0, targets: [{ p: 92, q: 100 }, { p: 101, q: 50 }] });
is(r.long, false, 'short'); is(r.targets.length, 1, 'wrong-side target dropped'); near(r.qty, 5, null, 'short qty'); near(r.profit, 40, null, 'short profit'); near(r.rr, 2, null, 'short R');
/* fees: profit at 110 with 0.1% a side = qty × (10 − 0.001×210) */
r = P.plan({ balance: 1000, riskPct: 1, feePct: 0.1, entry: 100, stop: 95, side: 'long', targets: [{ p: 110, q: 100 }] });
near(r.profit, 10 / 5.195 * (10 - 0.21), 1e-9, 'profit after fees');
/* funding: 0.01% per 8h on 200 notional for 24h = 200 × 0.0001 × 3 */
r = P.plan({ balance: 1000, riskPct: 1, feePct: 0, entry: 100, stop: 95, side: 'long', targets: [{ p: 110, q: 100 }], fundingPct: 0.01, hours: 24 }); near(r.funding, 0.06, 1e-12, 'funding');
is(P.plan({ balance: 1000, riskPct: 1, entry: 100, stop: 105, side: 'long' }).err, 'side', 'stop wrong side');
/* board */
var b = P.planBoard([{ sym: 'BTC', status: 'active', long: true, risk: 10, notional: 200, margin: 20 }, { sym: 'ETH', status: 'active', long: false, risk: 15, notional: 300, margin: 30 }, { sym: 'BTC', status: 'active', long: true, risk: 5, notional: 100, margin: 10 }, { sym: 'SOL', status: 'planned', long: true, risk: 99, notional: 999, margin: 99 }], 1000, 2);
is(b.n, 3, 'active plans'); near(b.planned.risk, 99, null, 'planned risk kept apart'); near(b.risk, 30, null, 'risk'); near(b.long, 300, null, 'long'); near(b.short, 300, null, 'short'); near(b.net, 0, null, 'net'); near(b.margin, 60, null, 'margin'); near(b.freeMargin, 940, null, 'free');
near(b.riskPct, 3, 1e-12, 'risk %'); near(b.limit, 20, null, 'limit'); near(b.limitUsed, 150, 1e-9, 'limit used'); is(b.over, true, 'over the limit'); is(b.topSym, 'BTC', 'top symbol'); near(b.topShare, 50, 1e-9, 'top share');
is(P.planBoard([], 1000, 3).n, 0, 'empty'); is(P.planBoard([{ sym: 'BTC', status: 'active', long: true, risk: 10, notional: 100, margin: 10 }], 1000, 3).over, false, 'under the limit');
console.log('test_pro_plan.js: ' + n + ' checks, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
