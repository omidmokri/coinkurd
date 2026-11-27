/* ODM: the ladder, the sizing, every ending, the trail's floor, and the walk over candles, against figures worked by hand.
   Run: node tests/test_pro_odm.js */
'use strict';
global.window = {};
require('../assets/pro/calc.js');
require('../assets/pro/odm.js');
var P = window.PRO, O = P.odm, fail = 0, n = 0;
function ok(c, m, x) { n++; if (!c) { fail++; console.log('FAIL', m, x === undefined ? '' : JSON.stringify(x)); } }
function near(a, b, e) { return Math.abs(a - b) <= (e || 1e-6) * Math.max(1, Math.abs(b)); }
var base = { side: 'long', balance: 10000, riskPct: 1, leverage: 1, feePct: 0, slip: 0 };
function plan(x) { return O.plan(Object.assign({}, base, x)); }

/* 1. two entries, two exits, no fees: worked by hand */
var r = plan({ entries: [{ p: 100, q: 50 }, { p: 90, q: 50 }], stop: { mode: 'price', v: 80 }, exits: [{ mode: 'price', v: 110, q: 50 }, { mode: 'r', v: 2, q: 50 }] });
ok(!r.err, 'case 1 runs', r.err);
ok(near(r.avg, 95) && near(r.qty, 100 / 15) && near(r.R, 15), 'avg 95, qty 100/15, R 15', [r.avg, r.qty, r.R]);
ok(near(r.fills[0].loss, 100 / 15 * 0.5 * 20) && near(r.fills[1].loss, 100), 'risk if only the first entry fills = 66.67; both = 100', r.fills.map(f => f.loss));
ok(near(r.fills[0].avg, 100) && near(r.fills[1].avg, 95), 'average after each fill', r.fills.map(f => f.avg));
ok(near(r.exits[1].p, 125), 'exit at 2R = 95 + 2 × 15 = 125', r.exits[1].p);
ok(near(r.exits[0].profit, 50) && near(r.exits[1].profit, 100), 'exit profits 50 and 100', r.exits.map(x => x.profit));
ok(r.rows.length === 3 && near(r.rows[0].pnl, -100) && near(r.rows[1].pnl, 0) && near(r.rows[2].pnl, 150) && near(r.rows[2].r, 1.5), 'endings: −100; +50 then stop on half = 0; all exits +150 (1.5R)', r.rows);
ok(r.rest === 0 && !r.trail, 'nothing left over', r.rest);
ok(r.exits[0].inRange === false, 'an exit above every entry is not inside the entry range');

/* 2. a single entry with fees: the same size as the shared calculator */
var r2 = plan({ feePct: 0.1, entries: [{ p: 100, q: 100 }], stop: { mode: 'pct', v: 5 }, exits: [{ mode: 'pct', v: 10, q: 100 }] });
var c2 = P.calc.position({ balance: 10000, riskPct: 1, entry: 100, stop: 95, feePct: 0.1, target: 110 });
ok(near(r2.stop, 95) && near(r2.qty, c2.qty) && near(r2.exits[0].profit, c2.profit), 'one entry: same quantity and profit as the position calculator', [r2.qty, c2.qty, r2.exits[0].profit, c2.profit]);
ok(near(r2.rows[0].pnl, -100), 'stopped with fees: the loss is still exactly the risk', r2.rows[0].pnl);
ok(near(r2.be, 100 * 1.001 / 0.999), 'break-even covers both fees', r2.be);
ok(r2.liq == null && r2.liqWhy, 'leverage 1 isolated linear: the calculator gives its own reason or price', [r2.liq, r2.liqWhy]);

/* 3. slippage is in the stop-out and the size */
var r3 = plan({ slip: 1, entries: [{ p: 100, q: 100 }], stop: { mode: 'price', v: 90 }, exits: [] });
ok(near(r3.qty, 100 / 11) && near(r3.rows[0].pnl, -100), 'slippage of 1 adds to the loss per unit: qty = 100/11', r3.qty);

/* 4. short mirrors long when fees are nil */
var s = plan({ side: 'short', entries: [{ p: 100, q: 50 }, { p: 110, q: 50 }], stop: { mode: 'price', v: 120 }, exits: [{ mode: 'price', v: 90, q: 50 }, { mode: 'r', v: 2, q: 50 }] });
ok(!s.err && near(s.avg, 105) && near(s.qty, 100 / 15) && near(s.exits[1].p, 75) && near(s.rows[2].pnl, 150), 'short: avg 105, exit at 2R = 75, all exits +150', s.err || [s.avg, s.qty, s.exits[1].p, s.rows[2].pnl]);
/* property: mirror prices around 100 (p → 200 − p) with no fees: same size and endings */
var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
var bad = 0;
for (var t = 0; t < 300; t++) {
  var e1 = 80 + rnd() * 40, e2 = e1 * (1 - rnd() * 0.1), sp = e2 * (1 - 0.01 - rnd() * 0.1), x1 = e1 * (1 + 0.01 + rnd() * 0.1), x2 = x1 * (1 + 0.01 + rnd() * 0.1), q1 = Math.round(10 + rnd() * 80), sl = rnd() * 0.5;
  var L = plan({ slip: sl, entries: [{ p: e1, q: q1 }, { p: e2, q: 100 - q1 }], stop: { mode: 'price', v: sp }, exits: [{ mode: 'price', v: x1, q: 40 }, { mode: 'price', v: x2, q: 60 }] });
  var M = function (v) { return 200 - v; };
  var S2 = plan({ side: 'short', slip: sl, entries: [{ p: M(e1), q: q1 }, { p: M(e2), q: 100 - q1 }], stop: { mode: 'price', v: M(sp) }, exits: [{ mode: 'price', v: M(x1), q: 40 }, { mode: 'price', v: M(x2), q: 60 }] });
  if (L.err || S2.err || !near(L.qty, S2.qty) || L.rows.some(function (row, i) { return !near(row.pnl, S2.rows[i].pnl); })) bad++;
}
ok(bad === 0, 'long and short mirror each other over 300 random plans', bad);

/* 5. checks that give a message, never a figure */
ok(plan({ entries: [{ p: 100, q: 60 }], stop: { mode: 'price', v: 90 } }).err === 'entryPct', 'entry shares must add to 100');
ok(plan({ entries: [{ p: 100, q: 50 }, { p: 85, q: 50 }], stop: { mode: 'price', v: 90 } }).err === 'side', 'a stop above the deepest long entry is refused');
ok(plan({ entries: [{ p: 100, q: 100 }], stop: { mode: 'price', v: 90 }, exits: [{ mode: 'price', v: 99, q: 50 }] }).err === 'tp', 'an exit below the average is refused');
ok(plan({ entries: [{ p: 100, q: 100 }], stop: { mode: 'price', v: 90 }, exits: [{ mode: 'price', v: 120, q: 50 }, { mode: 'price', v: 110, q: 50 }] }).err === 'order', 'exits must run further from the entry');
ok(plan({ entries: [{ p: 100, q: 100 }], stop: { mode: 'price', v: 90 }, exits: [{ mode: 'price', v: 110, q: 70 }, { mode: 'price', v: 120, q: 40 }] }).err === 'pctOver', 'exits above 100% are refused');
ok(plan({ side: 'short', contract: 'spot', entries: [{ p: 100, q: 100 }], stop: { mode: 'price', v: 110 } }).err === 'spotShort', 'no short on spot');
ok(plan({ entries: [{ p: 100, q: 100 }], stop: { mode: 'atr', v: 2 } }).err === 'atr', 'an ATR stop needs the ATR');
ok(plan({ entries: [], stop: { mode: 'price', v: 90 } }).err === 'noEntry', 'no entry, no plan');
ok(plan({ leverage: 0, entries: [{ p: 100, q: 100 }], stop: { mode: 'price', v: 90 } }).err === 'lev', 'leverage 0 refused');
ok(plan({ balance: -5, entries: [{ p: 100, q: 100 }], stop: { mode: 'price', v: 90 } }).err === 'num', 'negative balance refused');

/* 6. ATR stop beyond the deepest entry */
var r6 = plan({ entries: [{ p: 100, q: 50 }, { p: 90, q: 50 }], stop: { mode: 'atr', v: 2, atr: 3 } });
ok(near(r6.stop, 84), 'ATR stop = deepest entry 90 − 2 × 3 = 84', r6.stop);

/* 7. break-even after exit 1, and the trail's floor */
var r7 = plan({ entries: [{ p: 100, q: 50 }, { p: 90, q: 50 }], stop: { mode: 'price', v: 80 }, exits: [{ mode: 'price', v: 110, q: 50 }], beAfter: 1, trail: { on: true, mode: 'pct', v: 4, act: { mode: 'r', v: 2 } } });
ok(near(r7.rows[1].pnl, 50) && r7.rows[1].be, 'after exit 1 the rest is stopped at break-even: +50', r7.rows[1]);
ok(r7.trail && near(r7.trail.act, 125) && near(r7.trail.floor, 120) && near(r7.trail.floorPnl, 100 / 15 * 0.5 * 25), 'trail starts at 2R = 125; its floor 125 − 4% = 120 pays at least 83.33 on the rest', r7.trail);
ok(r7.rows[2].k === 'trail' && near(r7.rows[2].pnl, 50 + 100 / 15 * 0.5 * 25), 'the trail ending: 50 + 83.33', r7.rows[2]);
var r7b = plan({ entries: [{ p: 100, q: 100 }], stop: { mode: 'price', v: 90 }, exits: [], trail: { on: true, mode: 'pct', v: 5, act: { mode: 'none' } } });
ok(r7b.trail && r7b.trail.floor == null && r7b.rows[1].k === 'trailStop' && near(r7b.rows[1].pnl, -100), 'a trail from the entry has no floor above the stop: worst case is the stop', r7b.rows);
ok(plan({ entries: [{ p: 100, q: 100 }], stop: { mode: 'price', v: 90 }, trail: { on: true, mode: 'pct', v: 5, act: { mode: 'price', v: 95 } } }).err === 'act', 'a trail that starts below the entry is refused');

/* 8. the ladder */
var lad = O.ladder(100, 4, 2, true, 'equal');
ok(lad.map(x => x.p).join() === '100,98,96,94' && lad.every(x => x.q === 25), 'equal ladder 100, 98, 96, 94 at 25% each', lad);
var lg = O.ladder(100, 3, 5, false, 'grow');
ok(near(lg[2].p, 110) && lg.map(x => x.q).join() === '16.67,33.33,50' && near(lg.reduce((a, x) => a + x.q, 0), 100), 'growing short ladder 100, 105, 110 at 1:2:3 adds to 100', lg);
ok(O.ladder(100, 11, 2, true) === null && O.ladder(-1, 3, 2, true) === null, 'a ladder of 11 steps or from a negative price is refused');

/* 9. ATR */
var flat = []; for (var k = 0; k < 30; k++) flat.push({ o: 100, h: 101, l: 99, c: 100 });
ok(near(O.atr(flat, 14), 2), 'ATR of bars 2 wide is 2', O.atr(flat, 14));
ok(O.atr(flat.slice(0, 10), 14) === null, 'too few bars: no ATR');

/* 10. the walk over candles */
function B(rows) { return [{ t: 0, o: 100, h: 100, l: 100, c: 100 }].concat(rows.map(function (x, i) { return { t: i + 1, o: x[0], h: x[1], l: x[2], c: x[3] }; })); }
var pA = plan({ entries: [{ p: 100, q: 50 }, { p: 90, q: 50 }], stop: { mode: 'price', v: 80 }, exits: [{ mode: 'price', v: 110, q: 50 }, { mode: 'price', v: 125, q: 50 }] });
var sA = O.sim(pA, base, B([[101, 102, 99, 100], [100, 111, 99.5, 110], [110, 126, 109, 125]]), 1);
ok(sA.filled === 1 && near(sA.pnl, 100 / 15 * 0.5 * 10) && sA.end === 'flat' && !sA.open, 'one entry fills, exit 1 closes it: +33.33 and the second entry still waits', sA);
var sB = O.sim(pA, base, B([[101, 102, 99, 100], [78, 79, 70, 72]]), 1);
ok(sB.end === 'stop' && near(sB.events[1].p, 78) && near(sB.pnl, 100 / 15 * 0.5 * (78 - 100)), 'a gap through the stop fills at the open (78), not at 80', sB.events);
var sC = O.sim(pA, base, B([[101, 102, 99, 100], [100, 111, 79, 100]]), 1);
ok(sC.end === 'stop' && sC.ambiguous === 1, 'one bar reaching the stop and an exit: the stop is taken and the bar is marked', sC);
var pD = plan({ entries: [{ p: 100, q: 100 }], stop: { mode: 'price', v: 90 }, exits: [], trail: { on: true, mode: 'pct', v: 10, act: { mode: 'none' } } });
var sD = O.sim(pD, base, B([[100, 101, 99.5, 100.5], [100, 120, 95, 118], [115, 116, 107, 108]]), 1);
ok(sD.end === 'trail' && near(sD.events[1].p, 108) && near(sD.pnl, 80), 'the trail moves on closed bars only: 120 − 10% = 108 the bar after, +80', sD.events);
var sE = O.sim(pA, Object.assign({}, base, { slip: 0.5 }), B([[101, 102, 99, 100], [100, 100.5, 79, 85]]), 1);
ok(near(sE.events[sE.events.length - 1].p, 79.5), 'a stop fills less the slippage', sE.events);
var pF = plan({ entries: [{ p: 100, q: 100 }], stop: { mode: 'price', v: 90 }, exits: [{ mode: 'price', v: 110, q: 50 }, { mode: 'price', v: 130, q: 50 }], beAfter: 1 });
var sF = O.sim(pF, base, B([[100, 101, 99, 100], [105, 111, 104, 110], [108, 109, 99, 99.5]]), 1);
ok(sF.end === 'be' && near(sF.pnl, 5 * 10), 'after exit 1 the stop sits at break-even: the rest closes at 100 for nothing', sF);
var sG = O.sim(pA, base, B([[105, 106, 101, 104]]), 1);
ok(sG.end === 'none' && sG.filled === 0 && sG.pnl === 0, 'no entry reached: nothing happened');
ok(O.sim({ err: 'x' }, base, [], 0).err === 'noPlan', 'no plan, no walk');

/* inverse contracts are refused rather than mis-sized; the result at a price */
ok(plan({ contract: 'inverse', entries: [{ p: 100, q: 100 }], stop: { mode: 'price', v: 90 } }).err === 'inverse', 'inverse contract: refused, not mis-sized');
var pz = O.pnlAt(r, 110, 0);
ok(near(pz.pnl, 100 / 15 * 15) && near(pz.r, 1) && near(pz.pct, 15 / 95 * 100), 'whole position closed at 110: +100, 1R, +15.79%', pz);
var pz2 = O.pnlAt(r2, 95, 0.1);
ok(near(pz2.pnl, -r2.qty * (5 + 0.001 * 195)), 'closed at the stop price with fees, no slippage', pz2);
ok(O.pnlAt(r, -1) === null && O.pnlAt({ err: 'x' }, 100) === null, 'no result for a bad price or a bad plan');

/* break-even after a partly filled ladder uses the average actually held, not the full plan's */
var pH = plan({ entries: [{ p: 100, q: 50 }, { p: 90, q: 50 }], stop: { mode: 'price', v: 80 }, exits: [{ mode: 'price', v: 110, q: 25 }, { mode: 'price', v: 130, q: 75 }], beAfter: 1 });
var sH = O.sim(pH, base, B([[101, 102, 100.5, 101], [101, 101, 99.5, 100.5], [105, 111, 104, 110], [108, 109, 99, 99.5]]), 1);
ok(sH.end === 'be' && near(sH.events[sH.events.length - 1].p, 100) && near(sH.pnl, 100 / 15 * 0.25 * 10), 'half filled at 100, exit 1 at 110, then break-even at 100 (the held average), not 95', sH);
console.log('test_pro_odm.js: ' + n + ' checks, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
