#!/usr/bin/env node
/* Unit tests of the liquidation-level model (assets/obs/liqmodel.js) on made-up candles whose right answer is known
   by hand. Run: node tests/test_obs_liq.js   (exit code 1 on any failure) */
'use strict';
const path = require('path');
const M = require(path.join(__dirname, '..', 'assets', 'obs', 'liqmodel.js'));

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log('FAIL', name, extra === undefined ? '' : extra); } }
function near(name, a, b, tol) { ok(name, Math.abs(a - b) <= (tol == null ? 1e-6 : tol) * Math.max(1, Math.abs(b)), `got ${a}, want ${b}`); }

const MIN = 60000;
/* n flat candles at `px`, open interest constant at `oi`; edit() changes single candles */
function flat(n, px, oi, edit) {
  const f = { t: [], h: [], l: [], c: [], v: [], oi0: [], oi1: [], ls: [], mmr: 0, maxLev: 125 };
  for (let i = 0; i < n; i++) { f.t.push(i * MIN); f.h.push(px); f.l.push(px); f.c.push(px); f.v.push(0); f.oi0.push(oi); f.oi1.push(oi); f.ls.push(NaN); }
  if (edit) edit(f);
  return f;
}
const ends = (n, from) => Array.from({ length: n - (from || 0) }, (_, k) => (k + 1 + (from || 0)) * MIN);
const G = M.makeGrid(0, 200, 200);                      /* row r covers [r, r+1), its centre is r + 0.5 */
const units = (arr, g) => { let s = 0; for (let r = 0; r < arr.length; r++) s += arr[r] / M.priceOf(g, r); return s; };
const cell = (res, col, row) => res.mat[col * res.grid.rows + row];
const T10 = { 10: 1 };

/* ---- grid */
ok('grid step', G.step === 1 && G.rows === 200);
ok('rowOf boundary', M.rowOf(G, 90) === 90 && M.rowOf(G, 89.999) === 89 && M.rowOf(G, 90.999) === 90);
near('priceOf centre', M.priceOf(G, 90), 90.5);

/* ---- 1. nothing happens: flat price, constant open interest */
[1, 2].forEach(model => {
  const r = M.run(flat(30, 100, 1000), { model, tiers: T10, grid: G, colEnds: ends(30) });
  ok(`null case model ${model}: all cells zero`, r.mat.every(x => x === 0));
  ok(`null case model ${model}: nothing cleared`, r.clearedL.every(x => x === 0) && r.clearedS.every(x => x === 0));
});

/* ---- 2. one rise of open interest: +100 contracts at 100, 10x, no maintenance margin → long at 90, short at 110 */
{
  const f = flat(30, 100, 1000, f => { f.oi1[5] = 1100; for (let i = 6; i < 30; i++) { f.oi0[i] = 1100; f.oi1[i] = 1100; } });
  const r = M.run(f, { model: 1, tiers: T10, grid: G, colEnds: ends(30) });
  ok('jump: nothing before the candle', cell(r, 4, 90) === 0 && cell(r, 4, 110) === 0);
  near('jump: long level 100 × 90.5', cell(r, 5, 90), 9050);
  near('jump: short level 100 × 110.5', cell(r, 5, 110), 11050);
  near('jump: level persists', cell(r, 29, 90), 9050);
  ok('jump: only two cells are lit', Array.from(r.mat.slice(29 * 200, 30 * 200)).filter(x => x > 0).length === 2);
  near('jump: tracked long dollars', r.trackL[10], 9050); near('jump: tracked short dollars', r.trackS[10], 11050);
  near('jump: final long profile, tier 10x', r.longT[1][90], 9050);
  ok('jump: other tiers empty', r.longT[0].every(x => x === 0) && r.longT[4].every(x => x === 0));
}

/* ---- 3. the price falls through the long level: it is cleared in that candle, the short level stays */
{
  const f = flat(30, 100, 1000, f => {
    f.oi1[5] = 1100; for (let i = 6; i < 30; i++) { f.oi0[i] = 1100; f.oi1[i] = 1100; }
    f.l[10] = 89; f.c[10] = 95;
  });
  const r = M.run(f, { model: 1, tiers: T10, grid: G, colEnds: ends(30) });
  near('sweep: level alive the candle before', cell(r, 9, 90), 9050);
  ok('sweep: level gone', cell(r, 10, 90) === 0 && cell(r, 29, 90) === 0);
  near('sweep: cleared long dollars in that column', r.clearedL[10], 9050);
  ok('sweep: nothing cleared elsewhere', r.clearedL.reduce((a, b) => a + b, 0) === r.clearedL[10] && r.clearedS.every(x => x === 0));
  near('sweep: short level untouched', cell(r, 29, 110), 11050);
  /* a low that stops just above the level does not clear it */
  const f2 = flat(30, 100, 1000, f => { f.oi1[5] = 1100; for (let i = 6; i < 30; i++) { f.oi0[i] = 1100; f.oi1[i] = 1100; } f.l[10] = 91.2; });
  const r2 = M.run(f2, { model: 1, tiers: T10, grid: G, colEnds: ends(30) });
  near('sweep: a low of 91.2 leaves the level at 90', cell(r2, 29, 90), 9050);
  /* a high through the short level clears it */
  const f3 = flat(30, 100, 1000, f => { f.oi1[5] = 1100; for (let i = 6; i < 30; i++) { f.oi0[i] = 1100; f.oi1[i] = 1100; } f.h[12] = 111; });
  const r3 = M.run(f3, { model: 1, tiers: T10, grid: G, colEnds: ends(30) });
  ok('sweep: a high of 111 clears the short level', cell(r3, 12, 110) === 0); near('sweep: cleared short dollars', r3.clearedS[12], 11050);
}

/* ---- 4. open interest halves: every remaining level halves */
{
  const f = flat(30, 100, 1000, f => {
    f.oi1[5] = 1100; for (let i = 6; i < 30; i++) { f.oi0[i] = 1100; f.oi1[i] = 1100; }
    f.oi1[12] = 550; for (let i = 13; i < 30; i++) { f.oi0[i] = 550; f.oi1[i] = 550; }
  });
  const r = M.run(f, { model: 1, tiers: T10, grid: G, colEnds: ends(30) });
  near('decay: long halves', cell(r, 12, 90), 4525); near('decay: short halves', cell(r, 12, 110), 5525);
  near('decay: before it', cell(r, 11, 90), 9050);
}

/* ---- 5. leverage tiers: weights, maximum leverage, maintenance margin */
{
  const mk = () => flat(10, 100, 1000, f => { f.oi1[2] = 1100; for (let i = 3; i < 10; i++) { f.oi0[i] = 1100; f.oi1[i] = 1100; } });
  let f = mk(); let r = M.run(f, { model: 1, tiers: { 10: 1, 100: 1 }, grid: G, colEnds: ends(10) });
  near('tiers: half at 10x', cell(r, 9, 90), 50 * 90.5); near('tiers: half at 100x (99)', cell(r, 9, 99), 50 * 99.5);
  near('tiers: 100x short at 101', cell(r, 9, 101), 50 * 101.5);
  f = mk(); f.maxLev = 50; r = M.run(f, { model: 1, tiers: { 10: 1, 100: 1 }, grid: G, colEnds: ends(10) });
  near('tiers: 100x not offered → all at 10x', cell(r, 9, 90), 9050); ok('tiers: nothing at 99', cell(r, 9, 99) === 0);
  ok('tiers: reported tiers', JSON.stringify(r.tiers) === '[10]');
  f = mk(); f.mmr = 0.005; r = M.run(f, { model: 1, tiers: { 50: 1 }, grid: G, colEnds: ends(10) });
  /* 50x with 0.5 % maintenance: 2 % − 0.5 % = 1.5 % → long 98.5 (row 98), short 101.5 (row 101) */
  near('mmr: 50x long at 98.5', cell(r, 9, 98), 100 * 98.5); near('mmr: 50x short at 101.5', cell(r, 9, 101), 100 * 101.5);
  ok('tierSet drops a tier the margin eats', M.tierSet({ 100: 1, 10: 1 }, 125, 0.0096).length === 1);
  near('tierSet weights sum to one', M.tierSet({ 5: 2, 10: 1, 25: 1 }, 125, 0.005).reduce((a, x) => a + x.w, 0), 1);
  ok('tierSet: empty selection', M.tierSet({}, 125, 0.005).length === 0);
  r = M.run(mk(), { model: 1, tiers: {}, grid: G, colEnds: ends(10) });
  ok('no tier chosen → empty map, no error', r.mat.every(x => x === 0));
}

/* ---- 6. model 2: 70 % of accounts long → longs 1.4×, shorts 0.6× */
{
  const f = flat(10, 100, 1000, f => { f.oi1[2] = 1100; for (let i = 3; i < 10; i++) { f.oi0[i] = 1100; f.oi1[i] = 1100; } f.ls[2] = 0.7; });
  const r2 = M.run(f, { model: 2, tiers: T10, grid: G, colEnds: ends(10) });
  near('model 2: long × 1.4', cell(r2, 9, 90), 140 * 90.5); near('model 2: short × 0.6', cell(r2, 9, 110), 60 * 110.5);
  const r1 = M.run(f, { model: 1, tiers: T10, grid: G, colEnds: ends(10) });
  near('model 1 ignores the account ratio', cell(r1, 9, 90), 9050);
  f.ls[2] = NaN; const r2n = M.run(f, { model: 2, tiers: T10, grid: G, colEnds: ends(10) });
  near('model 2 without a ratio = equal sides', cell(r2n, 9, 90), 9050);
}

/* ---- 7. model 3: constant open interest 1000, volume 100 a candle, phi 0.1 → 10 open, 1 % close, every candle */
{
  const n = 60, f = flat(n, 100, 1000, f => { for (let i = 0; i < n; i++) f.v[i] = 100; });
  const r = M.run(f, { model: 3, tiers: T10, phi: 0.1, grid: G, colEnds: ends(n) });
  for (const k of [0, 9, 59]) near(`model 3: tracked longs after ${k + 1} candles`, cell(r, k, 90), 1000 * (1 - Math.pow(0.99, k + 1)) * 90.5, 1e-6);   /* cells are 32-bit */
  near('model 3: the exact dollars (64-bit track)', r.trackL[59], 1000 * (1 - Math.pow(0.99, 60)) * 90.5, 1e-12);
  const r1 = M.run(f, { model: 1, tiers: T10, grid: G, colEnds: ends(n) });
  ok('model 1 on the same data stays empty', r1.mat.every(x => x === 0));
  ok('PHI default', M.PHI === 0.1);
}

/* ---- 8. a wide candle: entries spread over its range; a level the candle closed beyond is dropped, one inside the range counts half */
{
  const f = flat(6, 100, 1000, f => { f.h[2] = 110; f.l[2] = 90; f.c[2] = 100; f.oi1[2] = 1100; for (let i = 3; i < 6; i++) { f.oi0[i] = 1100; f.oi1[i] = 1100; } });
  const r = M.run(f, { model: 1, tiers: { 100: 1 }, grid: G, colEnds: ends(6) });
  /* 20 entry samples 90.5 … 109.5, a triangle peaking at 100: weights 0.05, 0.15 … 0.95 | 0.95 … 0.05, sum 10.
     100x longs sit 1 % under their entry: entries above 101.01 are liquidated above the close (dropped: 101.5 … 109.5),
     entries 91.5 … 100.5 land between the low and the close (half), only 90.5 lands under the low (full).
       longs  = 100 × (0.05 + 0.5 × (0.15 + … + 0.95 + 0.95)) / 10 = 100 × (0.05 + 0.5 × 5.9) / 10 = 30
     and the mirror image for the shorts (99.5 … 108.5 half, 109.5 full) = 30. */
  near('spread: long contracts', units(r.longT[4], G), 30, 1e-9);
  near('spread: short contracts', units(r.shortT[4], G), 30, 1e-9);
  near('spread: the lowest long cell', r.longT[4][89], 100 * 0.05 / 10 * 89.5, 1e-9);
  ok('spread: no long level above the close, no short level below it', r.longT[4].slice(100).every(x => x === 0) && r.shortT[4].slice(0, 100).every(x => x === 0));
  ok('spread: the later flat candles clear nothing', r.clearedL.every(x => x === 0) && r.clearedS.every(x => x === 0));
  /* 10x (10 % away): longs of entries below 100 land under the low (full, weights sum 5), the rest inside the range (half, sum 5)
       → 100 × (5 + 2.5) / 10 = 75; shorts: the 90.5 entry lands at 99.55, under the close (dropped), 91.5 … 99.5 half (sum 4.95),
       100.5 … 109.5 full (sum 5) → 100 × (5 + 2.475) / 10 = 74.75 */
  const r10 = M.run(f, { model: 1, tiers: T10, grid: G, colEnds: ends(6) });
  near('spread: 10x long contracts', units(r10.longT[1], G), 75, 1e-9);
  near('spread: 10x short contracts', units(r10.shortT[1], G), 74.75, 1e-9);
  /* the boundary row: a short level at 100.495 is above a later high of exactly 100 and must survive it */
  ok('sweep by row centre: the level just above the high survives', r.shortT[4][100] > 0);
}

/* ---- 9. warm-up candles before the window build the levels the window opens with */
{
  const f = flat(30, 100, 1000, f => { f.oi1[5] = 1100; for (let i = 6; i < 30; i++) { f.oi0[i] = 1100; f.oi1[i] = 1100; } });
  const r = M.run(f, { model: 1, tiers: T10, grid: G, colEnds: ends(30, 20) });     /* columns for candles 20 … 29 only */
  ok('warm-up: ten columns', r.cols === 10); near('warm-up: level present in the first column', cell(r, 0, 90), 9050);
}

/* ---- 10. unknown open interest opens and closes nothing; a level outside the grid is ignored without error */
{
  const f = flat(10, 100, NaN, f => { f.oi1[3] = 500; });
  const r = M.run(f, { model: 1, tiers: T10, grid: G, colEnds: ends(10) });
  ok('unknown OI: empty', r.mat.every(x => x === 0));
  const f2 = flat(10, 100, 1000, f => { f.oi1[2] = 1100; });
  const small = M.makeGrid(95, 105, 20);
  const r2 = M.run(f2, { model: 1, tiers: T10, grid: small, colEnds: ends(10) });
  ok('levels outside the grid are dropped', r2.mat.every(x => x === 0) && !Array.from(r2.mat).some(x => isNaN(x)));
}

/* ---- 11. several exchanges add up */
{
  const mk = add => flat(10, 100, 1000, f => { f.oi1[2] = 1000 + add; for (let i = 3; i < 10; i++) { f.oi0[i] = 1000 + add; f.oi1[i] = 1000 + add; } });
  const o = { model: 1, tiers: T10, grid: G, colEnds: ends(10) };
  const s = M.sum([M.run(mk(100), o), M.run(mk(40), o)]);
  near('sum: cells add', cell(s, 9, 90), 140 * 90.5); near('sum: profile adds', s.longT[1][90], 140 * 90.5);
  near('sum: tracked adds', s.trackS[9], 140 * 110.5); ok('sum: tiers', JSON.stringify(s.tiers) === '[10]');
}

/* ---- 12. clusters around the price */
{
  const f = flat(12, 100, 1000, f => {
    f.oi1[2] = 1100; for (let i = 3; i < 12; i++) { f.oi0[i] = 1100; f.oi1[i] = 1100; }
    f.oi1[6] = 1400; for (let i = 7; i < 12; i++) { f.oi0[i] = 1400; f.oi1[i] = 1400; }
  });
  const r = M.run(f, { model: 1, tiers: { 10: 1, 25: 1 }, grid: G, colEnds: ends(12) });
  const c = M.clusters(r, 100, 3);
  ok('clusters: two below, two above', c.below.length === 2 && c.above.length === 2);
  ok('clusters: below are long, above are short', c.below.every(x => x.side === 'long' && x.price < 100) && c.above.every(x => x.side === 'short' && x.price > 100));
  near('clusters: 10x long cluster dollars', c.below.find(x => Math.abs(x.price - 90.5) < 1e-9).usd, 200 * 90.5);
  near('clusters: distance of the 25x long', c.below.find(x => Math.abs(x.price - 96.5) < 1e-9).dist, -3.5);
}

/* ---- 13. conservation on random candles: with no sweep and no fall of open interest, contracts in = contracts kept */
{
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const n = 200, f = flat(n, 100, 1000);
  let oi = 1000, added = 0;
  for (let i = 0; i < n; i++) { const d = rnd() * 20; f.oi0[i] = oi; oi += d; f.oi1[i] = oi; added += d; f.h[i] = 100.2; f.l[i] = 99.8; f.c[i] = 99.9 + rnd() * 0.2; }
  const r = M.run(f, { model: 1, tiers: { 5: 1, 10: 3 }, grid: G, colEnds: ends(n) });
  let lu = 0, su = 0; for (let k = 0; k < 5; k++) { lu += units(r.longT[k], G); su += units(r.shortT[k], G); }
  near('conservation: long contracts', lu, added, 1e-9); near('conservation: short contracts', su, added, 1e-9);
  near('conservation: tier split 1:3', units(r.longT[0], G) / units(r.longT[1], G), 1 / 3, 1e-9);
  ok('no NaN anywhere', !Array.from(r.mat).some(x => isNaN(x)));
}

console.log(`liquidation model: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
