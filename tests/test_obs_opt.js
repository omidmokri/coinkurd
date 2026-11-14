#!/usr/bin/env node
/* The Observatory's options arithmetic (assets/obs/optmath.js) on a book small enough to work out by hand.
   Run: node tests/test_obs_opt.js */
'use strict';
const path = require('path');
const O = require(path.join(__dirname, '..', 'assets', 'obs', 'optmath.js'));
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); } }
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= (tol == null ? 1e-9 : tol) * Math.max(1, Math.abs(b));

/* ---- instrument names */
{
  const a = O.parseName('BTC-27NOV26-70000-C');
  ok('name: currency, expiry code, strike, type', a && a.cur === 'BTC' && a.code === '27NOV26' && a.strike === 70000 && a.type === 'C');
  ok('name: expiry is 08:00 UTC of that day', a.ts === Date.UTC(2026, 10, 27, 8));
  const b = O.parseName('ETH-4DEC26-2050-P');
  ok('name: a one-digit day', b && b.code === '4DEC26' && b.ts === Date.UTC(2026, 11, 4, 8) && b.strike === 2050 && b.type === 'P');
  ok('name: a decimal strike written with "d"', O.parseName('XRP-27NOV26-0d55-C').strike === 0.55);
  ok('name: junk is refused', O.parseName('BTC-PERPETUAL') === null && O.parseName('BTC-27NOV26-70000-X') === null && O.parseName('BTC-27XXX26-70000-C') === null
    && O.parseName('') === null && O.parseName(null) === null && O.parseName('BTC-27NOV26-0-C') === null);
}
/* ---- max pain by hand
   calls: 90 → 10 coins, 100 → 10;  puts: 100 → 5, 110 → 20
   settle at  90: calls 0;                    puts (100−90)·5 + (110−90)·20 = 450   → 450
   settle at 100: calls (100−90)·10 = 100;    puts (110−100)·20 = 200               → 300
   settle at 110: calls 20·10 + 10·10 = 300;  puts 0                                → 300   (tie with 100: the lower strike wins) */
const S = (k, c, p) => ({ k: k, c: { oi: c, vol: 0, iv: null }, p: { oi: p, vol: 0, iv: null } });
{
  const st = [S(90, 10, 0), S(100, 10, 5), S(110, 0, 20)];
  ok('pain at each strike', O.painAt(st, 90) === 450 && O.painAt(st, 100) === 300 && O.painAt(st, 110) === 300, [O.painAt(st, 90), O.painAt(st, 100), O.painAt(st, 110)]);
  ok('max pain: the smallest total, the lower strike on a tie', O.maxPain(st) === 100);
  ok('pain curve', JSON.stringify(O.painCurve(st)) === '[[90,450],[100,300],[110,300]]');
  ok('max pain: only calls → the lowest strike (every call worthless)', O.maxPain([S(90, 5, 0), S(100, 5, 0)]) === 90);
  ok('max pain: only puts → the highest strike', O.maxPain([S(90, 0, 5), S(100, 0, 5)]) === 100);
  ok('max pain: no open interest → none', O.maxPain([S(90, 0, 0), S(100, 0, 0)]) === null && O.maxPain([]) === null);
}
/* ---- at-the-money IV */
{
  const iv = (k, c, p) => ({ k: k, c: { oi: 1, vol: 0, iv: c }, p: { oi: 1, vol: 0, iv: p } });
  const st = [iv(100, 50, 52), iv(110, 60, 60), iv(120, null, 70)];
  ok('ATM IV between two strikes: straight line between their means', near(O.atmIv(st, 104), 51 + (60 - 51) * 0.4));
  ok('ATM IV on a strike', near(O.atmIv(st, 110), 60));
  ok('ATM IV with one side only', near(O.atmIv(st, 115), 65));
  ok('ATM IV outside the strikes: the nearest end', O.atmIv(st, 50) === 51 && O.atmIv(st, 500) === 70);
  ok('ATM IV: no IV or no price → none', O.atmIv([iv(100, null, null)], 100) === null && O.atmIv(st, 0) === null && O.atmIv([], 100) === null);
}
/* ---- a whole book */
const NOW = Date.UTC(2026, 10, 13, 21);
const row = (name, oi, vol, iv, und) => ({ instrument_name: name, open_interest: oi, volume: vol, mark_iv: iv, mark_price: 0.01, underlying_price: und, estimated_delivery_price: 100 });
{
  const rows = [
    row('BTC-20NOV26-90-C', 10, 1, 40, 101), row('BTC-20NOV26-100-C', 10, 2, 50, 101), row('BTC-20NOV26-100-P', 5, 3, 52, 101), row('BTC-20NOV26-110-P', 20, 4, 60, 101),
    row('BTC-25DEC26-100-C', 30, 0, 45, 103), row('BTC-25DEC26-100-P', 6, 0, 45, 103), row('BTC-25DEC26-120-C', 4, 0, 55, 103),
    row('BTC-13NOV26-100-C', 99, 9, 30, 100),            /* expired at 08:00 today: left out */
    row('BTC-14NOV26-100-C', 0, 0, 0, 100.2),            /* listed, nothing open */
    { instrument_name: 'BTC-PERPETUAL', open_interest: 1e6 }, null,
    row('BTC-20NOV26-110-C', null, undefined, null, 101)  /* nulls count as nothing */
  ];
  const B = O.build(rows, NOW);
  ok('book: expiries in date order, the expired one left out', B.exps.map(e => e.code).join(',') === '14NOV26,20NOV26,25DEC26', B.exps.map(e => e.code));
  ok('book: the index price', B.index === 100);
  const e = B.exps[1];
  ok('expiry: calls, puts, total, put/call', e.c.oi === 20 && e.p.oi === 25 && e.oi === 45 && near(e.pc, 1.25) && e.c.vol === 3 && e.p.vol === 7);
  ok('expiry: strikes in order with both sides', e.strikes.map(r => r.k).join(',') === '90,100,110' && e.strikes[1].c.oi === 10 && e.strikes[1].p.oi === 5 && e.strikes[2].c.oi === 0);
  ok('expiry: max pain and its distance from the index', e.maxPain === 100 && e.mpDist === 0);
  ok('expiry: days left', near(e.days, (Date.UTC(2026, 10, 20, 8) - NOW) / 864e5));
  ok('expiry: its own underlying, ATM IV read at it', e.und === 101 && near(e.atmIv, 51 + (60 - 51) * 0.1), e.atmIv);
  ok('expiry: notional = coins × index', e.notional === 4500);
  ok('expiry with nothing open: no max pain, no ratio', B.exps[0].maxPain === null && B.exps[0].pc === null && B.exps[0].oi === 0 && B.exps[0].atmIv === null);
  ok('expiry 3: max pain where calls are worthless and puts cheap', B.exps[2].maxPain === 100 && near(B.exps[2].pc, 6 / 34));
  ok('totals', B.tot.c.oi === 54 && B.tot.p.oi === 31 && B.tot.oi === 85 && near(B.tot.pcOi, 31 / 54) && near(B.tot.pcVol, 7 / 3) && B.tot.notional === 8500 && B.tot.vol === 10);
  ok('all strikes merged over expiries', B.all.map(r => r.k + ':' + r.c.oi + '/' + r.p.oi).join(' ') === '90:10/0 100:40/11 110:0/20 120:4/0', B.all.map(r => r.k + ':' + r.c.oi + '/' + r.p.oi));
  ok('the sum over strikes equals the totals', B.all.reduce((t, r) => t + r.c.oi + r.p.oi, 0) === B.tot.oi);
  ok('strikes near the price', O.near(B.all, 100, 0.95, 1.15).map(r => r.k).join(',') === '100,110' && O.near(B.all, 0, 0.5, 2).length === 4);
  ok('a price between strikes sits at a fraction of the way', near(O.slot(B.all, 104), 1.4) && O.slot(B.all, 80) === 0 && O.slot(B.all, 130) === 3 && O.slot([], 100) === null && O.slot(B.all, 0) === null);
  const E = O.build([], NOW);
  ok('an empty book', E.exps.length === 0 && E.tot.oi === 0 && E.tot.pcOi === null && E.index === null && E.tot.notional === null);
  ok('no index price: no notional, the rest stands', (b => b.tot.notional === null && b.exps[0].notional === null && b.exps[0].maxPain === 100 && b.exps[0].mpDist === null)
    (O.build([{ instrument_name: 'BTC-20NOV26-100-C', open_interest: 5, volume: 0, mark_iv: 50 }], NOW)));
}
{
  /* skew and term structure, against the definitions written out by hand */
  ok('ncdf: known values', near(O.ncdf(0), 0.5, 1e-7) && near(O.ncdf(1.96), 0.9750021, 2e-7) && near(O.ncdf(-1), 0.1586553, 2e-7));
  const T = 30 / 365, F = 100, iv = 50, s = 0.5 * Math.sqrt(T), d1 = (Math.log(F / 110) + s * s / 2) / s;
  ok('delta: call N(d1), put N(d1) − 1', near(O.delta('C', F, 110, T, iv), O.ncdf(d1), 1e-12) && near(O.delta('P', F, 110, T, iv), O.ncdf(d1) - 1, 1e-12) && O.delta('C', F, 110, 0, iv) === null);
  ok('delta: an at-the-money call is a little over 0.5', O.delta('C', 100, 100, T, 50) > 0.5 && O.delta('C', 100, 100, T, 50) < 0.54);
  /* a smile made so that IV = 50 + 0.2 × |K − 100| on calls and 50 + 0.4 × |K − 100| on puts */
  const NOW2 = Date.UTC(2026, 10, 14, 8), exp = NOW2 + 30 * 864e5, rows = [];
  for (let k = 60; k <= 140; k += 5) {
    rows.push({ instrument_name: 'BTC-14DEC26-' + k + '-C', open_interest: 1, volume: 0, mark_iv: 50 + 0.2 * Math.abs(k - 100), underlying_price: 100, estimated_delivery_price: 100 });
    rows.push({ instrument_name: 'BTC-14DEC26-' + k + '-P', open_interest: 1, volume: 0, mark_iv: 50 + 0.4 * Math.abs(k - 100), underlying_price: 100, estimated_delivery_price: 100 });
  }
  const B2 = O.build(rows, NOW2), e2 = B2.exps[0];
  ok('the expiry is 30 days away', near(e2.days, 30, 1e-9) && e2.ts === exp);
  const sm = O.smile(e2, NOW2);
  ok('smile: out-of-the-money side — calls above the future, puts below', sm.length === 17 && sm[0].side === 'P' && sm[0].otm === 66 && sm[16].side === 'C' && sm[16].otm === 58 && sm[8].side === 'C');
  /* by hand: find the two call strikes whose deltas lie around 0.25 and read the line between them */
  const cs = sm.filter(x => x.k >= 100).map(x => [x.dc, x.c]).sort((a, b) => a[0] - b[0]);
  let want = null; for (let i = 1; i < cs.length; i++) if (cs[i - 1][0] <= 0.25 && 0.25 <= cs[i][0]) want = cs[i - 1][1] + (cs[i][1] - cs[i - 1][1]) * (0.25 - cs[i - 1][0]) / (cs[i][0] - cs[i - 1][0]);
  const c25 = O.ivAtDelta(sm, 100, 'C', 0.25), p25 = O.ivAtDelta(sm, 100, 'P', 0.25);
  ok('25-delta call IV on the line between its strikes', want != null && near(c25, want, 1e-12), [c25, want]);
  ok('25-delta put IV above the call (puts dearer in this smile)', p25 > c25 && p25 > 50 && c25 > 50, [p25, c25]);
  const tm = O.term(B2, NOW2);
  ok('term: risk reversal = call − put, butterfly = mean − ATM', tm.length === 1 && near(tm[0].rr, c25 - p25, 1e-12) && near(tm[0].fly, (c25 + p25) / 2 - e2.atmIv, 1e-12) && near(tm[0].atm, 50, 1e-12));
  ok('term: an expiry less than a day away is not read', O.term(B2, exp - 0.5 * 864e5).length === 0);
  const pts = [{ days: 10, atm: 40, rr: -2 }, { days: 40, atm: 55, rr: -4 }, { days: 100, atm: 60, rr: null }];
  ok('30-day value on the line between expiries', near(O.atDays(pts, 'atm', 30), 50, 1e-12) && near(O.atDays(pts, 'rr', 30), -2 - 2 * 20 / 30, 1e-12));
  ok('…nothing outside them, and missing values skipped', O.atDays(pts, 'atm', 5) === null && O.atDays(pts, 'rr', 60) === null && near(O.atDays(pts, 'atm', 40), 55, 1e-12));
}
console.log('options arithmetic: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
