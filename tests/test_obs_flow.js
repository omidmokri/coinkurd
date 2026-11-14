#!/usr/bin/env node
/* The Observatory's arithmetic for liquidations by day, CVD, basis, the Coinbase premium and stablecoins
   (assets/obs/flowmath.js), on figures small enough to work out by hand.
   Run: node tests/test_obs_flow.js */
'use strict';
const path = require('path');
const F = require(path.join(__dirname, '..', 'assets', 'obs', 'flowmath.js'));
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); } }
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= (tol || 1e-9) * Math.max(1, Math.abs(b));
const H = 3600000, DAY = 86400000, T0 = Date.UTC(2026, 10, 10);            /* a UTC midnight */
/* a Gate row as the API gives it (time in seconds, sizes in contracts) */
const G = (t, ll, sl, buy, sell, px, oi) => ({ time: t / 1000, long_liq_usd: ll, short_liq_usd: sl, long_taker_size: buy, short_taker_size: sell, mark_price: px, open_interest_usd: oi, lsr_taker: 1 });

/* ---- Gate rows */
{
  const rows = F.gateRows([G(T0 + H, 10, 5, 3000, 1000, 70000, 4e9), G(T0, 1, 2, 100, 300, 69000, 3.9e9), null, { time: null }, G(T0 + H, 20, 6, 4000, 1000, 70500, 4.1e9),
    { time: (T0 + 2 * H) / 1000, long_liq_usd: -5, short_liq_usd: 'x', long_taker_size: '50', short_taker_size: null, mark_price: 0 }], 0.0001);
  ok('gate: oldest first, one row per time (the later one stays)', rows.length === 3 && rows[0].t === T0 && rows[1].t === T0 + H && rows[1].ll === 20 && rows[1].px === 70500);
  ok('gate: open interest is brought to one side', rows[0].oi === 1.95e9 && rows[1].oi === 2.05e9);
  ok('gate: taker sizes in coins (contracts × the contract size)', near(rows[0].buy, 0.01) && near(rows[0].sell, 0.03) && near(rows[1].buy, 0.4));
  ok('gate: junk counts as nothing, never as a negative or a NaN', rows[2].ll === 0 && rows[2].sl === 0 && near(rows[2].buy, 0.005) && rows[2].sell === 0 && rows[2].px === null && rows[2].oi === null);
  ok('gate: no rows', F.gateRows(null, 1).length === 0 && F.gateRows({ label: 'x' }, 1).length === 0);
  ok('gate: a contract size of nothing is taken as one', F.gateRows([G(T0, 0, 0, 7, 2, 1, 1)], 0)[0].buy === 7);
}
/* ---- missing periods: an hour with no taker volume on the reference contract, and the hour before it */
{
  const ref = F.gateRows([0, 1, 2, 3, 4, 5].map(h => G(T0 + h * H, 0, 0, h === 3 ? 0 : 100, h === 3 ? 0 : 90, 70000, 1)), 1);
  const bad = F.gaps(ref, H, T0 + 5.5 * H);
  ok('gaps: the empty hour and the one before it', Object.keys(bad).length === 2 && bad[T0 + 3 * H] === 1 && bad[T0 + 2 * H] === 1);
  const run = F.gateRows([G(T0, 0, 0, 5, 5, 1, 1), G(T0 + H, 0, 0, 0, 0, 1, 1)], 1);
  ok('gaps: the running hour proves nothing', Object.keys(F.gaps(run, H, T0 + H + 60000)).length === 0);
  ok('gaps: the same hour once it has closed', Object.keys(F.gaps(run, H, T0 + 2 * H)).length === 2);
  ok('gaps: nothing to read', Object.keys(F.gaps(null, H, T0)).length === 0);
}
/* ---- buckets
   hours 0..7 of one day: longs 1,2,3,4,5,6,7,8 dollars; shorts 10 each; buys 2 coins, sells 1 coin each hour; price 100 + hour */
const hrs = n => F.gateRows(Array.from({ length: n }, (_, h) => G(T0 + h * H, h + 1, 10, 2, 1, 100 + h, 1000 + h)), 1);
{
  const b = F.roll(hrs(8), H, 4 * H, null, T0, T0 + 8 * H);
  ok('roll: two 4-hour buckets', b.length === 2 && b[0].t === T0 && b[1].t === T0 + 4 * H);
  ok('roll: sums', b[0].ll === 10 && b[1].ll === 26 && b[0].sl === 40 && b[0].buy === 8 && b[0].sell === 4 && b[0].d === 4);
  ok('roll: the delta in dollars uses each hour’s own price', near(b[0].du, 100 + 101 + 102 + 103) && near(b[1].du, 104 + 105 + 106 + 107));
  ok('roll: the last price and open interest of the bucket (one side: half of what the statistics count)', b[0].px === 103 && b[1].px === 107 && b[0].oi === 1003 / 2);
  ok('roll: complete buckets', b.every(x => x.n === 4 && x.want === 4 && !x.bad && !x.live));
  const c = F.roll(hrs(7), H, 4 * H, null, T0, T0 + 6.5 * H);
  ok('roll: the running bucket is live and not “incomplete” for its missing hours', c[1].live && c[1].n === 3 && !c[1].bad);
  const d = F.roll(hrs(8).filter(r => r.t !== T0 + 5 * H), H, 4 * H, null, T0, T0 + 9 * H);
  ok('roll: a closed bucket with an hour the source has no row for is incomplete', !d[0].bad && d[1].bad && d[1].n === 3 && d[1].ll === 5 + 7 + 8);
  const bad = {}; bad[T0 + 2 * H] = 1;
  const e = F.roll(hrs(8), H, 4 * H, bad, T0, T0 + 9 * H);
  ok('roll: a marked hour makes its bucket incomplete', e[0].bad && !e[1].bad);
  const f = F.roll(hrs(8), H, 4 * H, null, T0 + 4 * H, T0 + 9 * H);
  ok('roll: nothing before the start', f.length === 1 && f[0].t === T0 + 4 * H);
  ok('roll: one row a bucket', F.roll(hrs(3), H, H, null, T0, T0 + 9 * H).every(x => x.want === 1 && x.n === 1) && F.roll([], H, H, null, T0, T0).length === 0);
}
/* ---- a liquidation chart: older days from 4-hour rows, newer days from hourly rows
   4-hour rows: day −3 from 08:00 (cut short by the history), days −2 and −1 whole; hourly rows from day −1 10:00 on, day 0 whole, day +1 running */
{
  const h4 = [], h1 = [];
  for (let t = T0 - 3 * DAY + 8 * H; t < T0 + DAY; t += 4 * H) h4.push(G(t, 100, 50, 9, 9, 500, 1));
  for (let t = T0 - DAY + 10 * H; t <= T0 + DAY + 2 * H; t += H) h1.push(G(t, 1, 2, 9, 9, 600, 1));
  const now = T0 + DAY + 2.5 * H;
  const s = F.liqSeries(F.gateRows(h1, 1), F.gateRows(h4, 1), DAY, T0 - 3 * DAY, now, null, null);
  ok('series: days in order, the day the history cuts short is left out', s.map(x => (x.t - T0) / DAY).join(',') === '-2,-1,0,1', s.map(x => (x.t - T0) / DAY));
  ok('series: older days from the 4-hour rows, in full', s[0].src === '4h' && s[0].ll === 600 && s[0].sl === 300 && s[1].src === '4h' && s[1].ll === 600 && !s[0].bad && !s[1].bad);
  ok('series: the first day whose hours all exist comes from the hourly rows', s[2].src === '1h' && s[2].ll === 24 && s[2].sl === 48 && s[2].n === 24);
  ok('series: the running day', s[3].src === '1h' && s[3].live && s[3].ll === 3 && !s[3].bad);
  const hourly = F.liqSeries(F.gateRows(h1, 1), F.gateRows(h4, 1), H, T0, now, null, null);
  ok('series: hourly bars use hourly rows only', hourly.length === 27 && hourly.every(x => x.src === '1h') && hourly[0].t === T0);
  const b4 = {}; b4[T0 - 2 * DAY + 4 * H] = 1;
  const s2 = F.liqSeries(F.gateRows(h1, 1), F.gateRows(h4, 1), DAY, T0 - 3 * DAY, now, null, b4);
  ok('series: a marked 4-hour period makes its day incomplete', s2[0].bad && !s2[1].bad && !s2[2].bad);
  const only1 = F.liqSeries(F.gateRows(h1, 1), null, DAY, T0 - 3 * DAY, now, null, null);
  ok('series: without 4-hour rows the cut day is not shown at all', only1.map(x => (x.t - T0) / DAY).join(',') === '0,1');
  ok('series: nothing loaded', F.liqSeries([], [], DAY, T0, now, null, null).length === 0);
  const tot = F.liqTotals(s);
  ok('totals: longs, shorts, the longs’ share', tot.long === 600 + 600 + 24 + 3 && tot.short === 300 + 300 + 48 + 6 && near(tot.longShare, tot.long / (tot.long + tot.short) * 100) && tot.n === 4 && tot.bad === 0);
  ok('totals: the largest bucket (the first of equals)', tot.max.t === T0 - 2 * DAY);
  const none = F.liqTotals([]);
  ok('totals: nothing', none.total === 0 && none.longShare === null && none.max === null);
  ok('totals: incomplete buckets are counted', F.liqTotals(s2).bad === 1);
}
/* ---- the last 24 hours: the 23 closed hours before the running one, and the running one */
{
  const now = T0 + DAY + 10.5 * H;                              /* 10:30 */
  const rows = F.gateRows(Array.from({ length: 40 }, (_, i) => G(T0 + (i + 1) * H, 1, 100, 5, 5, 1, 1)), 1);       /* 01:00 … next day 16:00 */
  const x = F.last24(rows, now, null);
  ok('24h: from 11:00 of the day before to the running hour', x.from === T0 + 11 * H && x.hours === 24 && x.long === 24 && x.short === 2400 && x.bad === 0);
  const y = F.last24(rows.filter(r => r.t !== T0 + DAY + 10 * H && r.t !== T0 + 20 * H), now, null);
  ok('24h: the running hour may have no row yet; a closed hour without a row is missing', y.hours === 22 && y.bad === 1);
  const b = {}; b[T0 + 12 * H] = 1; b[T0 + 2 * H] = 1;
  ok('24h: marked hours inside the window are counted', F.last24(rows, now, b).bad === 1);
  ok('24h: no rows in the window', F.last24(rows, T0 + 30 * DAY, null) === null && F.last24([], now, null) === null);
}
/* ---- OKX paging: after = edge + 1, the orders already taken at the edge skipped */
{
  const P = ts => ts.map((t, i) => ({ t: t, id: t + ':' + i }));
  /* 3 orders at time 50; pages of 4 */
  const a = F.okxStep(P([90, 80, 50, 50]), null, 0, 4);
  ok('okx: the first page', a.rows.length === 4 && a.edge === 50 && a.skip === 2 && a.more && !a.strict && !a.lost);
  ok('okx: what to ask with', F.okxAfter(null, 1000) === 1000 && F.okxAfter({}, 1000) === 1000 && F.okxAfter(a, 1000) === 51 && F.okxAfter({ edge: 50, strict: true }, 1000) === 50);
  const b = F.okxStep(P([50, 50, 50, 40]), a, 0, 4);              /* asked with after = 51: all three orders of time 50 again, then an older one */
  ok('okx: the two orders already taken are skipped, the third of that millisecond is kept', b.rows.length === 2 && b.rows[0].id === '50:2' && b.rows[1].t === 40 && b.edge === 40 && b.skip === 1 && b.more);
  const c = F.okxStep(P([40, 30]), b, 0, 4);
  ok('okx: a short page ends the walk', c.rows.length === 1 && c.rows[0].t === 30 && !c.more && c.edge === 30);
  const d = F.okxStep(P([90, 80, 70, 60]), null, 75, 4);
  ok('okx: nothing older than the floor is taken, and the walk stops below it', d.rows.map(r => r.t).join(',') === '90,80' && !d.more);
  const e = F.okxStep(P([50, 50, 50, 50]), { edge: 50, skip: 4 }, 0, 4);
  ok('okx: a full page with nothing new: step past that millisecond and say so', e.strict && e.lost && e.more && e.rows.length === 0 && e.edge === 50);
  const e2 = F.okxStep(P([40, 30]), e, 0, 4);
  ok('okx: after stepping past, the walk goes on as before', e2.rows.length === 2 && e2.edge === 30 && e2.skip === 1 && !e2.strict && !e2.more);
  const f = F.okxStep(P([50, 50, 50, 50]), { edge: 50, skip: 2 }, 0, 4);
  ok('okx: more of the same millisecond', f.rows.length === 2 && f.edge === 50 && f.skip === 4 && f.more && !f.strict);
  ok('okx: an empty page', (g => g.rows.length === 0 && !g.more && !g.strict && g.edge === 77)(F.okxStep([], { edge: 77, skip: 1 }, 0, 4)));
  /* whole walks, 3 orders a page, against a pretend exchange that answers "older than `after`, newest first" */
  function walk(times, floor) {
    const all = times.map((t, i) => ({ t: t, id: i }));
    let st = null, got = [], guard = 0, more = true, lost = false, asks = 0;
    while (more && guard++ < 40) {
      const after = F.okxAfter(st, 1e9), page = all.filter(o => o.t < after).slice(0, 3);
      st = F.okxStep(page, st, floor, 3); got = got.concat(st.rows); more = st.more; lost = lost || st.lost; asks++;
    }
    return { ids: got.map(o => o.id).join(','), lost: lost, asks: asks };
  }
  const w1 = walk([100, 99, 99, 98, 97, 97, 96], 0);
  ok('okx: a walk in pages returns every order once', w1.ids === '0,1,2,3,4,5,6' && !w1.lost, w1);
  const w2 = walk([100, 99, 99, 99, 98], 0);
  ok('okx: a page-full of one millisecond is passed, nothing taken twice', w2.ids === '0,1,2,3,4' && w2.lost, w2);
  const w3 = walk([100, 99, 99, 99, 99, 98], 0);
  ok('okx: more than a page in one millisecond loses the rest of it, and the walk says so', w3.ids === '0,1,2,3,5' && w3.lost, w3);
  const w4 = walk([100, 99, 98, 97, 96, 95, 94], 97);
  ok('okx: a walk down to a floor', w4.ids === '0,1,2,3' && w4.asks === 2, w4);
  const s = F.orders([{ t: 10, usd: 5, side: 'long' }, { t: 20, usd: 50, side: 'short' }, { t: 30, usd: 7, side: 'long' }, { t: 5, usd: 999, side: 'long' }, { t: 40, usd: 0, side: 'long' }, null], 10, 2);
  ok('orders: totals by side since a time', s.long === 12 && s.short === 50 && s.total === 62 && s.n === 3);
  ok('orders: the largest first', s.top.length === 2 && s.top[0].usd === 50 && s.top[1].usd === 7);
}
/* ---- taker delta from a Binance candle (a real spot row of 2026-11-14 02:00 UTC) */
{
  const k = [1794621600000, '68290.01000000', '68322.01000000', '66915.00000000', '67682.01000000', '2392.63328000', 1794625199999, '161341387.43452840', 385381, '979.77137000', '66072242.67316330', '0'];
  const r = F.klineRows([k, null, [1, 2], ['x']], 1);
  ok('kline: one row, junk dropped', r.length === 1 && r[0].t === 1794621600000 && r[0].c === 67682.01 && r[0].o === 68290.01);
  ok('kline: delta = 2 × taker buys − volume', near(r[0].d, 2 * 979.77137 - 2392.63328) && near(r[0].d, -433.09054));
  ok('kline: the same in dollars', near(r[0].du, 2 * 66072242.6731633 - 161341387.4345284));
  const m = F.klineRows([[1000, '0.02', '0.03', '0.01', '0.02', '10', 1999, '0.2', 5, '6', '0.12', '0']], 1000);
  ok('kline: a contract per 1000 coins → price per coin, sizes in coins', near(m[0].c, 0.00002) && m[0].v === 10000 && m[0].d === 2000 && near(m[0].du, 0.04));
  ok('kline: later row of the same time wins', F.klineRows([[5, 1, 1, 1, 1, 10, 0, 10, 1, 5, 5, 0], [5, 1, 1, 1, 2, 10, 0, 10, 1, 7, 7, 0]], 1).length === 1 && F.klineRows([[5, 1, 1, 1, 1, 10, 0, 10, 1, 5, 5, 0], [5, 1, 1, 1, 2, 10, 0, 10, 1, 7, 7, 0]], 1)[0].d === 4);
  const rows = [{ t: 0, d: 5 }, { t: 10, d: -2 }, { t: 20, d: null }, { t: 30, d: 4 }];
  const c = F.cvd(rows, 'd', 10, 5);
  ok('cvd: the running sum from the start of the range, a missing delta skipped', JSON.stringify(c.line) === '[[15,-2],[35,2]]' && c.total === 2 && c.n === 2);
  ok('cvd: nothing', F.cvd([], 'd', 0, 0).total === null && F.cvd(null, 'd', 0, 0).line.length === 0);
  const g = F.roll(F.gateRows([G(T0, 0, 0, 30000, 10000, 100, 1), G(T0 + H, 0, 0, 10000, 20000, 200, 1)], 0.0001), H, H, null, T0, T0 + 3 * H);
  ok('cvd: Gate’s two sides give the same kind of delta', near(g[0].d, 2) && near(g[1].d, -1) && near(g[0].du, 200) && near(g[1].du, -200) && near(F.cvd(g, 'd', T0, 0).total, 1));
}
/* ---- the futures curve */
{
  const NOW = Date.UTC(2026, 10, 14, 8);
  const a = F.parseFuture('BTC-27NOV26');
  ok('future: name → expiry at 08:00 UTC', a && a.cur === 'BTC' && a.code === '27NOV26' && a.ts === Date.UTC(2026, 10, 27, 8) && !a.perp);
  ok('future: a one-digit day', F.parseFuture('ETH-4DEC26').ts === Date.UTC(2026, 11, 4, 8));
  ok('future: the perpetual', F.parseFuture('BTC-PERPETUAL').perp === true && F.parseFuture('BTC-PERPETUAL').cur === 'BTC');
  ok('future: anything else is refused', F.parseFuture('BTC-27NOV26-70000-C') === null && F.parseFuture('ETH_USDC-14NOV26') === null && F.parseFuture('BTC-31FEB26') === null
    && F.parseFuture('BTC-27XXX26') === null && F.parseFuture('') === null && F.parseFuture(null) === null && F.parseFuture('BTC-0NOV26') === null);
  const R = (name, mark, idx, oi, vol) => ({ instrument_name: name, mark_price: mark, estimated_delivery_price: idx, open_interest: oi, volume_usd: vol });
  const c = F.curve([R('BTC-25DEC26', 101, 100, 500, 50), R('BTC-PERPETUAL', 100.1, 100, 9000, 900), R('BTC-15NOV26', 100.02, 100, 30, 3), R('BTC-14NOV26', 100, 100, 10, 1),
    R('BTC-13NOV26', 99, 100, 1, 1), R('BTC-27NOV26', 99.5, 100, 200, 20), R('BTC-26MAR27', null, 100, 5, 5), R('BTC-25JUN27', 104, 0, 5, 5), null, R('BTC-27NOV26-70000-C', 1, 100, 1, 1)], NOW);
  ok('curve: the index', c.index === 100);
  ok('curve: the perpetual apart', c.perp && near(c.perp.basis, 0.1, 1e-6) && c.perp.oi === 9000 && near(c.perp.usd, 0.1, 1e-6));
  ok('curve: dated futures by expiry; the expired one, the one expiring now and rows without a price left out', c.exps.map(x => x.code).join(',') === '15NOV26,27NOV26,25DEC26', c.exps.map(x => x.code));
  ok('curve: days to expiry', near(c.exps[0].days, 1) && near(c.exps[1].days, 13) && near(c.exps[2].days, 41));
  ok('curve: basis in per cent and in dollars', near(c.exps[2].basis, 1, 1e-9) && near(c.exps[2].usd, 1) && near(c.exps[1].basis, -0.5, 1e-9));
  ok('curve: per year = basis × 365 ÷ days', near(c.exps[2].ann, 365 / 41, 1e-9) && near(c.exps[1].ann, -0.5 * 365 / 13, 1e-9));
  ok('curve: an expiry nearer than two days is not annualised', c.exps[0].ann === null && near(c.exps[0].basis, 0.02, 1e-6));
  ok('curve: open interest of the dated futures', c.oi === 730);
  const none = F.curve([], NOW);
  ok('curve: nothing', none.index === null && none.perp === null && none.exps.length === 0 && none.oi === 0 && F.curve(null, NOW).exps.length === 0);
}
/* ---- columns of the files CI writes, the premium, ranks */
{
  ok('col: a column unpacked to its place', JSON.stringify(F.col({ o: 2, v: [5, null, 7] }, 6)) === '[null,null,5,null,7,null]');
  ok('col: longer than the grid is cut, nothing is nothing', JSON.stringify(F.col({ o: 1, v: [1, 2, 3] }, 3)) === '[null,1,2]' && JSON.stringify(F.col(null, 2)) === '[null,null]');
  const p = F.premium([101, 100, null, 99, 50], [100, 100, 100, 100, 0], [1.01, 1, 1, 0.99, 1]);
  ok('premium: Coinbase over Binance, per cent', near(p.raw[0], 1) && p.raw[1] === 0 && p.raw[2] === null && near(p.raw[3], -1) && p.raw[4] === null);
  ok('premium: Tether-adjusted', near(p.adj[0], 0, 1e-9) && p.adj[1] === 0 && p.adj[2] === null && near(p.adj[3], (99 / 99 - 1) * 100, 1e-9));
  const q = F.premium([101], [100], [null]);
  ok('premium: without Tether’s price only the plain one', near(q.raw[0], 1) && q.adj[0] === null && F.premium([101], [100], null).adj[0] === null);
  ok('pairs: a grid to points, the missing skipped', JSON.stringify(F.pairs(1000, 10, [1, null, 3, 4], 1)) === '[[1020,3],[1030,4]]');
  ok('diff: a[i] − a[i − n]', JSON.stringify(F.diff([1, 4, null, 10, 11], 2)) === '[null,null,null,6,null]');
  ok('ratio', JSON.stringify(F.ratio([10, null, 6, 5], [5, 2, 0, 2], 1)) === '[2,null,null,2.5]');
  ok('last: the last value that is there', F.last([1, null, 3, null]) === 2 && F.last([null]) === -1 && F.last([]) === -1 && F.last(null) === -1);
  ok('rank: share of the days so far at or below today', F.rank([1, 2, 3, 2], 3) === 75 && F.rank([5], 0) === 100 && F.rank([3, null, 1], 2) === 50 && F.rank([1, null], 1) === null && F.rank([], -1) === null);
  ok('meanLast: the mean of what is there, when enough is there', F.meanLast([1, 2, null, 4], 3, 3, 2) === 3 && F.meanLast([1, 2, null, 4], 3, 3, 3) === null && F.meanLast([2, 4], 1, 2) === 3 && F.meanLast([2, 4], 1, 5, 2) === 3);
  ok('dayMs', F.dayMs('2026-11-14') === Date.UTC(2026, 10, 14));
}
{
  /* stage 5: Gate's daily rows, the archive, and Hyperliquid's positions */
  const NOW5 = Date.UTC(2026, 10, 14, 9), D = 864e5, d0 = Date.UTC(2026, 10, 10);
  const rows = [0, 1, 2, 3, 4].map(i => ({ t: d0 + i * D, ll: 10 * (i + 1), sl: 5, buy: i === 1 ? 0 : 3, sell: i === 1 ? 0 : 3, px: 100 + i, oi: 7 }));
  const ref = [0, 1, 2, 3, 4].map(i => ({ t: d0 + i * D, buy: i === 2 ? 0 : 1, sell: i === 2 ? 0 : 1 }));
  const db = F.dayBars(rows, ref, NOW5);
  ok('dayBars: closed days only (the 14th is running)', db.length === 4 && db[3].t === d0 + 3 * D, db.length);
  ok('dayBars: a day with no taker volume on its own row or on BTC\'s is missed, and the day before it is cut short', db[0].bad && db[1].bad && db[2].bad && !db[3].bad && db[1].ll === 20 && db[0].src === '1d', db.map(x => x.bad));
  const ar = F.archBars({ t0: '2026-11-01', n: 4, ll: [1, 2, null, 4], sl: [1, 1, 1, 1], q: [2, 0, 1, 1] });
  ok('archBars: thousands → dollars, q 0 pale, a gap left out', ar.length === 3 && ar[0].ll === 1000 && ar[1].bad && !ar[2].bad && ar[2].t === Date.UTC(2026, 10, 4) && ar[0].src === 'arch');
  const bk = [{ t: d0 + 2 * D, ll: 1, sl: 1, src: '4h' }];
  const all = F.older(bk, [db, ar]);
  ok('older: bars before the first, the first list wins a day, in time order', all.map(x => x.src).join(',') === 'arch,arch,arch,1d,1d,4h' && all[3].t === d0 && all[all.length - 1] === bk[0], all.map(x => x.src + new Date(x.t).getUTCDate()));
  ok('older: a day held by both lists comes from the first', F.older([], [[{ t: 5, src: 'a' }], [{ t: 5, src: 'b' }, { t: 3, src: 'b' }]]).map(x => x.src).join('') === 'ba');
  const pos = [[95, 100, 1], [99.9, 50, 1], [90, 10, 1], [105, 70, -1], [100.5, 30, -1], [130, 999, -1], [70, 999, 1], [96, 0, 1]];
  const bins = F.hlBins(pos, 100, 0.1, 20);
  ok('hlBins: 20 bins of 1 between 90 and 110', bins.length === 20 && near(bins[0].lo, 90) && near(bins[19].hi, 110) && near(bins[10].mid, 100.5));
  ok('hlBins: each position in its bin, outside ones left out', bins[5].long === 100 && bins[9].long === 50 && bins[0].long === 10 && bins[15].short === 70 && bins[10].short === 30 &&
    bins.reduce((a, b) => a + b.long + b.short, 0) === 260 && bins[5].nl === 1);
  const nr = F.hlNear(pos, 100, 5);
  ok('hlNear: a 5 % move liquidates longs from 95 up to the price and shorts up to 105', nr.long === 150 && nr.short === 100 && nr.nl === 3 && nr.ns === 2, nr);
}

console.log('flow arithmetic: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
