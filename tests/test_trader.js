// node tests/test_trader.js — the /trader/ plan sheet (assets/trader/trader.js), against figures worked out by hand.
'use strict';
const T = require('../assets/trader/trader.js');
let fail = 0;
const near = (a, b, tol, m) => { if (!(Math.abs(a - b) <= (tol || 1e-9) * Math.max(1, Math.abs(b)))) { fail++; console.log('FAIL', m, a, '!=', b); } };
const is = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };

// 1. spot long, no costs: risk 1% of 1000 = 10; stop 3000 away -> 1/300 coin; R = 6000/3000 = 2; break-even 33.33%
let r = T.plan({cap: 1000, risk: 1, entry: 60000, stop: 57000, tp1: 66000, fee: 0});
is(r.ok, 'basic ok'); near(r.qty, 10 / 3000, 1e-12, 'qty'); near(r.R, 2, 1e-12, 'R'); near(r.be, 100 / 3, 1e-12, 'be');
near(r.loss, 10, 1e-12, 'loss'); near(r.gain, 20, 1e-12, 'gain'); near(r.stopDist, 5, 1e-12, 'stopDist'); near(r.dd10, (1 - Math.pow(.99, 10)) * 100, 1e-12, 'dd10');
is(r.liq === null, 'no liquidation at 1x');
// 2. fees 0.1% per side: loss/unit = 3000 + 60 + 57 = 3117, gain/unit = 6000 - 60 - 66 = 5874
r = T.plan({cap: 1000, risk: 1, entry: 60000, stop: 57000, tp1: 66000, fee: 0.1});
near(r.qty, 10 / 3117, 1e-12, 'qty fee'); near(r.R, 5874 / 3117, 1e-12, 'R fee'); near(r.costs, 10 / 3117 * 117, 1e-9, 'costs fee');
// 3. short with two targets, half at each, no costs: entry 100, stop 110, tp 90 / 80 -> gain/unit 15, loss/unit 10
r = T.plan({cap: 500, risk: 2, entry: 100, stop: 110, tp1: 90, tp2: 80, share: 50, side: 'short', fee: 0});
near(r.qty, 1, 1e-12, 'short qty'); near(r.R, 1.5, 1e-12, 'short R'); near(r.rrChart, 1.5, 1e-12, 'short chart RR');
// 4. slippage and funding on a long: entry 100, stop 90, slip 1% -> exec 89.1; funding 0.01%/8h for 24h -> 0.03 per unit
r = T.plan({cap: 10000, risk: 1, entry: 100, stop: 90, tp1: 120, fee: 0, slip: 1, funding: 0.01, hours: 24});
near(r.loss / r.qty, 10.9 + 0.03, 1e-12, 'loss per unit with slip+funding'); near(r.gain / r.qty, 20 - 0.03, 1e-12, 'gain per unit with funding');
// a short receives positive funding: it lowers the loss
r = T.plan({cap: 10000, risk: 1, entry: 100, stop: 110, tp1: 80, side: 'short', fee: 0, funding: 0.01, hours: 24});
near(r.loss / r.qty, 10 - 0.03, 1e-12, 'short funding received');
// 5. liquidation, same model as /tools/#liq: long 10x mm 0.5% -> 100*(0.9)/(0.995)
r = T.plan({cap: 1000, risk: 1, entry: 100, stop: 95, tp1: 110, fee: 0, lev: 10, mm: 0.5});
near(r.liq, 90 / 0.995, 1e-12, 'liq long'); is(r.liqOk === true, 'stop before liq');
r = T.plan({cap: 1000, risk: 1, entry: 100, stop: 80, tp1: 140, fee: 0, lev: 10, mm: 0.5});
is(r.liqOk === false, 'stop beyond liq flagged');
r = T.plan({cap: 1000, risk: 1, entry: 100, stop: 104, tp1: 90, side: 'short', fee: 0, lev: 20, mm: 0.5});
near(r.liq, 100 * 1.05 / 1.005, 1e-12, 'liq short'); is(r.liqOk === true, 'short stop (104) before liq (104.48)');
r = T.plan({cap: 1000, risk: 1, entry: 100, stop: 105, tp1: 90, side: 'short', fee: 0, lev: 20, mm: 0.5});
is(r.liqOk === false, 'short stop (105) beyond liq (104.48) flagged');
// 6. capped by capital at 1x: risk 10% with a 1% stop wants 10x the capital
r = T.plan({cap: 1000, risk: 10, entry: 100, stop: 99, tp1: 103, fee: 0});
is(r.capped, 'capped'); near(r.qty, 10, 1e-12, 'capped qty'); near(r.riskPct, 1, 1e-12, 'capped real risk');
// 7. expectancy and Kelly: p 0.5, R 2 -> EV 0.5R, Kelly 25%, quarter 6.25%, suggested = min(1, 6.25, 6-0) = 1
r = T.plan({cap: 1000, risk: 1, entry: 100, stop: 90, tp1: 120, fee: 0, win: 50, kf: 0.25, heat: 0, maxheat: 6});
near(r.ev, 0.5, 1e-12, 'ev'); near(r.kelly, 25, 1e-12, 'kelly'); near(r.kellyF, 6.25, 1e-12, 'kellyF'); near(r.sugg, 1, 1e-12, 'sugg');
r = T.plan({cap: 1000, risk: 3, entry: 100, stop: 90, tp1: 120, fee: 0, win: 30, kf: 0.25, heat: 5, maxheat: 6});
near(r.kelly, (0.3 - 0.7 / 2) * 100, 1e-12, 'negative kelly'); near(r.sugg, 0, 1e-12, 'no edge -> 0'); is(r.heatOk === false, 'heat over cap');
// 8. errors
const err = (x, k) => { const q = T.plan(x); is(!q.ok && q.err === k, 'err ' + k + ' got ' + JSON.stringify(q).slice(0, 60)); };
err({cap: 0, risk: 1, entry: 1, stop: 1, tp1: 1}, 'eCap');
err({cap: 1, risk: 0, entry: 1, stop: 1, tp1: 1}, 'eRisk');
err({cap: 1, risk: 1, entry: 100, stop: 0, tp1: 110}, 'eNeed');
err({cap: 1, risk: 1, entry: 100, stop: 101, tp1: 110}, 'eStopL');
err({cap: 1, risk: 1, entry: 100, stop: 99, tp1: 110, side: 'short'}, 'eStopS');
err({cap: 1, risk: 1, entry: 100, stop: 99, tp1: 90}, 'eTpL');
err({cap: 1, risk: 1, entry: 100, stop: 99, tp1: 110, tp2: 105}, 'eTp2');
err({cap: 1, risk: 1, entry: 100, stop: 99, tp1: 110, lev: 500}, 'eLev');
err({cap: 1, risk: 1, entry: 100, stop: 99, tp1: 110, fee: 9}, 'eCost');
err({cap: 1, risk: 1, entry: 'abc', stop: 99, tp1: 110}, 'eNeed');
// 9. digits typed in Persian / Arabic / with separators
near(T.num('۶۰٬۰۰۰'), 60000, 0, 'persian digits'); near(T.num('٥٫٥'), 5.5, 0, 'arabic decimal'); is(isNaN(T.num('1e400')), 'overflow -> NaN');
is(isNaN(T.num('<img>')), 'junk -> NaN');
console.log(fail ? fail + ' FAILED' : 'trader plan: all checks passed');
process.exit(fail ? 1 : 0);
