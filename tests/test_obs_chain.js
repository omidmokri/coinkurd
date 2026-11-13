#!/usr/bin/env node
/* The Observatory's on-chain arithmetic (assets/obs/chainmath.js) on series whose answers are known in closed form.
   Run: node tests/test_obs_chain.js
   With --summary <file> it prints OBChain.summary() of a data file as JSON (tests/test_obs_chain.py compares it with the
   Python summary the bot reads). */
'use strict';
const path = require('path'), fs = require('fs');
const C = require(path.join(__dirname, '..', 'assets', 'obs', 'chainmath.js'));

const ai = process.argv.indexOf('--summary');
if (ai > 0) {
  const D = C.unpack(JSON.parse(fs.readFileSync(process.argv[ai + 1], 'utf8')));
  process.stdout.write(JSON.stringify(C.summary(D)));
  process.exit(0);
}

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log('  FAIL ' + name + (extra ? '  [' + extra + ']' : '')); } }
function near(a, b, rel) { return a != null && b != null && Math.abs(a - b) <= (rel || 1e-9) * Math.max(1, Math.abs(b)); }
function file(n, cols, t0) {
  const out = { asset: 'btc', t0: t0 || '2015-01-01', n: n, cols: {} };
  Object.keys(cols).forEach(k => { const v = cols[k]; let o = 0; while (o < v.length && v[o] == null) o++; if (o < v.length) out.cols[k] = { o: o, v: v.slice(o) }; });
  return out;
}
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));

/* ---- unpack: offsets, trailing gaps, dates */
{
  const D = C.unpack({ asset: 'btc', t0: '2020-02-27', n: 6, cols: { price: { o: 2, v: [10, 11, null, 13] }, sex: { o: 4, v: [7] } } });
  ok('unpack keeps the length', D.cols.price.length === 6 && D.cols.sex.length === 6);
  ok('unpack puts values at their day', JSON.stringify(D.cols.price) === '[null,null,10,11,null,13]' && JSON.stringify(D.cols.sex) === '[null,null,null,null,7,null]');
  ok('day 0 is t0 at 00:00 UTC', D.t0 === Date.UTC(2020, 1, 27) && C.dayStr(D.t0, 0) === '2020-02-27');
  ok('dates cross a leap day', C.dayStr(D.t0, 2) === '2020-02-29' && C.dayStr(D.t0, 3) === '2020-03-01');
  ok('last() skips trailing gaps', C.last(D.cols.sex) === 4 && C.last(D.cols.price) === 5 && C.last(D.cols.price, 4) === 3 && C.last([null, null]) === -1);
  ok('pairs() leaves gaps out', JSON.stringify(C.pairs(D, D.cols.price, 0)) === JSON.stringify([[D.t0 + 2 * C.DAY, 10], [D.t0 + 3 * C.DAY, 11], [D.t0 + 5 * C.DAY, 13]]));
  ok('pairs() from an index', C.pairs(D, D.cols.price, 4).length === 1);
}
/* ---- moving averages and sums */
{
  const a = [1, 2, 3, 4, 5, null, 7, 8, 9];
  ok('sma(3)', JSON.stringify(C.sma(a, 3)) === JSON.stringify([null, null, 2, 3, 4, null, null, null, 8]));
  ok('rsum(2)', JSON.stringify(C.rsum(a, 2)) === JSON.stringify([null, 3, 5, 7, 9, null, null, 15, 17]));
  ok('mean() needs every day', C.mean(a, 4, 3) === 4 && C.mean(a, 6, 2) === null && C.mean(a, 1, 3) === null);
  ok('sum()', C.sum(a, 8, 3) === 24 && C.sum(a, 7, 3) === null);
  ok('rank: share of days at or below today', C.rank([1, 2, 3, 2], 3) === 75 && C.rank([5, 1, null, 3], 3) === 100 * 2 / 3 && C.rank([4, null], 1) === null);
  ok('rank of the highest day is 100, of the lowest 1/n', C.rank([1, 2, 3], 2) === 100 && near(C.rank([3, 2, 1], 2), 100 / 3));
}
/* ---- a flat market: every ratio is 1 and nothing is divided by zero */
{
  const n = 1500;
  const D = C.unpack(file(n, { price: range(n, () => 100), mvrv: range(n, () => 2), sply: range(n, () => 1e6), iss: range(n, () => 50), fee: range(n, () => 5),
    fin: range(n, () => 10), fout: range(n, () => 7), sex: range(n, i => 1000 + 3 * i), hash: range(n, () => 5e8), adr: range(n, i => 100 + i), tx: range(n, () => 40) }));
  const s = C.summary(D), S = C.series(D);
  ok('flat: date and price', s.date === C.dayStr(D.t0, n - 1) && s.price === 100);
  ok('flat: realized price = price ÷ mvrv', s.rprice === 50 && s.nupl === 0.5 && s.mcap === 1e8 && s.rcap === 5e7);
  ok('flat: Mayer, 200-week, 2-year = 1', s.mayer === 1 && s.w200 === 1 && s.y2 === 1 && s.ma200 === 100 && s.ma1400 === 100);
  ok('flat: Pi ratio = 0.5 (111-day average ÷ twice the 350-day one)', s.pi === 0.5);
  ok('flat: Puell = 1', s.puell === 1);
  ok('flat: drawdown 0', s.dd === 0);
  ok('flat: no Z-score when the market value never moved', s.mvrvz === undefined && S.mvrvz.every(x => x === null));
  ok('flat: fee share and miner revenue', near(s.fee_share, 100 * 5 / 55) && s.rev_usd === 5500);
  ok('flat: stock-to-flow = supply ÷ a year of issuance', near(s.s2f, 1e6 / (50 * 365)));
  ok('flat: net flow 1, 7, 30 days', s.net1 === 3 && s.net7 === 21 && s.net30 === 90 && s.fin === 10 && s.fout === 7);
  ok('flat: reserve, its 30-day change, dollars and share', s.sex === 1000 + 3 * (n - 1) && s.sex_chg30 === 90 && s.sex_usd === s.sex * 100 && near(s.sex_share, s.sex / 1e6 * 100));
  ok('flat: hash rate in EH/s with its two averages', s.hash === 500 && s.hash30 === 500 && s.hash60 === 500);
  ok('flat: 7-day averages', near(s.adr7, 100 + (n - 1) - 3) && s.tx7 === 40);
  ok('flat: ranks', s.mvrv_pct === 100 && s.mayer_pct === 100 && s.dd_pct === 100);
  ok('series: first Mayer on day 200, first 200-week ratio on day 1400', S.mayer[198] === null && S.mayer[199] === 1 && S.w200[1398] === null && S.w200[1399] === 1);
  ok('series: Puell needs 365 days', S.puell[363] === null && S.puell[364] === 1);
  ok('series: net flow sums', S.net7[5] === null && S.net7[6] === 21 && S.net30[29] === 90);
}
/* ---- a straight line: closed forms.  price = a + b·i  →  the w-day average is price − b(w−1)/2 */
{
  const n = 1600, a = 1000, b = 2, P = i => a + b * i, i = n - 1;
  const D = C.unpack(file(n, { price: range(n, P), mvrv: range(n, () => 2), sply: range(n, () => 1), iss: range(n, () => 10) }));
  const s = C.summary(D), S = C.series(D), p = P(i);
  ok('line: 200-day average', near(s.ma200, p - b * 99.5) && near(s.mayer, p / (p - b * 99.5)));
  ok('line: 200-week (1400-day) average', near(s.ma1400, p - b * 699.5) && near(s.w200, p / (p - b * 699.5)));
  ok('line: Pi ratio', near(s.pi, (p - b * 55) / (2 * (p - b * 174.5))));
  ok('line: 2-year ratio', near(s.y2, p / (p - b * 364.5)));
  ok('line: Puell = price ÷ its 365-day average when issuance is constant', near(s.puell, p / (p - b * 182)));
  ok('line: a rising line is always at its high', s.dd === 0 && S.dd.every(x => x === 0));
  /* Z: market value = price (supply 1), mvrv 2 → (mc − mc/2) ÷ population sd of mc[0..i];  sd of a line = b·sqrt(((i+1)² − 1)/12) */
  ok('line: MVRV Z-score', near(s.mvrvz, 0.5 * p / (b * Math.sqrt(((i + 1) * (i + 1) - 1) / 12)), 1e-9), s.mvrvz);
  ok('line: Z on day 1 (two days: sd = b/2)', near(S.mvrvz[1], 0.5 * P(1) / (b / 2)));
  ok('line: no Z on the first day', S.mvrvz[0] === null);
  ok('line: Mayer rank — the ratio falls as the line climbs, so today is the lowest', near(s.mayer_pct, 100 / (n - 199)));
  ok('series: realized price and value', S.rprice[i] === p / 2 && S.rcap[i] === p / 2 && S.mcap[i] === p);
  ok('series: Pi lines', near(S.ma350x2[i], 2 * (p - b * 174.5)) && near(S.ma111[i], p - b * 55) && near(S.ma730x5[i], 5 * (p - b * 364.5)));
  ok('series: golden-ratio lines are the 350-day average × 1.6, 3, 5', near(S.gold16[i], 1.6 * S.ma350[i]) && near(S.gold3[i], 3 * S.ma350[i]) && near(S.gold5[i], 5 * S.ma350[i]));
}
/* ---- drawdown and a gap */
{
  const n = 400, price = range(n, i => i < 100 ? 100 : i < 200 ? 400 : 100);
  price[300] = null;
  const D = C.unpack(file(n, { price: price, mvrv: range(n, () => 0.8) }));
  const s = C.summary(D), S = C.series(D);
  ok('drawdown: −75 % under the high', s.dd === -75 && S.dd[150] === 0 && S.dd[99] === 0);
  ok('drawdown rank: lowest value shares the bottom with every later day', near(s.dd_pct, 100 * 199 / 399));
  ok('gap: the missing day has no figures', S.dd[300] === null && S.mayer[300] === null);
  ok('gap: an average that spans the gap is not computed', S.mayer[301] === null && S.mayer[399] === null && S.mayer[299] !== null);
  ok('gap: no 200-day average at the end either (the gap is inside the window)', s.mayer === undefined && s.ma200 === undefined);
  ok('below 1: NUPL is negative, realized price above the price', near(s.nupl, 1 - 1 / 0.8) && near(s.rprice, 125));
}
/* ---- flows lag behind the price by a day; hash rate missing (Ether) */
{
  const n = 60, fin = range(n, i => 100 + i), fout = range(n, i => 90);
  fin[n - 1] = null; fout[n - 1] = null;
  const D = C.unpack(file(n, { price: range(n, () => 10), mvrv: range(n, () => 1), sply: range(n, () => 1000), fin: fin, fout: fout, sex: range(n, i => i < n - 1 ? 500 : null) }));
  const s = C.summary(D);
  ok('flows: the figures are the last day that has them, and say so', s.flow_date === C.dayStr(D.t0, n - 2) && s.date === C.dayStr(D.t0, n - 1) && s.net1 === 100 + (n - 2) - 90);
  ok('flows: 7-day sum ends on that day', s.net7 === [0, 1, 2, 3, 4, 5, 6].reduce((t, k) => t + (100 + (n - 2 - k) - 90), 0));
  ok('no hash column: no hash figures', s.hash === undefined && s.hash30 === undefined);
  ok('reserve unchanged over 30 days', s.sex_chg30 === 0 && s.sex_share === 50);
  ok('mvrv 1: NUPL 0', s.nupl === 0 && s.rprice === 10);
}
/* ---- an empty file */
{
  const D = C.unpack({ asset: 'btc', t0: '2020-01-01', n: 3, cols: {} });
  ok('nothing in, nothing out', Object.keys(C.summary(D)).length === 0 && C.series(D).mayer.every(x => x === null));
}
/* ---- zones */
{
  ok('zones: MVRV', C.zoneOf('mvrv', 0.9) === -1 && C.zoneOf('mvrv', 1) === -1 && C.zoneOf('mvrv', 2) === 0 && C.zoneOf('mvrv', 3.7) === 1 && C.zoneOf('mvrv', null) === null);
  ok('zones: Mayer, Puell, Z', C.zoneOf('mayer', 2.5) === 1 && C.zoneOf('mayer', 0.7) === -1 && C.zoneOf('puell', 0.4) === -1 && C.zoneOf('puell', 4.2) === 1 && C.zoneOf('mvrvz', -0.1) === -1 && C.zoneOf('mvrvz', 7.5) === 1);
  ok('zones: Pi has only an upper line', C.zoneOf('pi', 0.2) === 0 && C.zoneOf('pi', 1.01) === 1);
  ok('NUPL bands', [-0.2, 0.1, 0.3, 0.6, 0.8].map(C.nuplZone).join('') === '01234' && C.nuplZone(null) === null && C.nuplZone(0) === 1 && C.nuplZone(0.75) === 4);
}
console.log('on-chain arithmetic: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
