/* Smart alerts (assets/pro/salert.js): the rule builder's script, its safety, and its answers checked against
   independent calculations on made-up bars.   node tests/test_pro_salert.js */
global.window = global; global.localStorage = { getItem: () => null, setItem: () => {} };
const R = __dirname + '/../assets/pro/';
require(R + 'ind.js'); require(R + 'script.js'); require(R + 'salert.js');
const P = global.PRO, SA = P.sa;
let n = 0, bad = 0;
function ok(c, what, x) { n++; if (!c) { bad++; console.log('FAIL', what, x === undefined ? '' : JSON.stringify(x)); } }

/* bars: a wave with a trend change, so RSI, crosses and breakouts all happen */
const B = []; let p = 100;
for (let i = 0; i < 600; i++) {
  const o = p; p = p * (1 + 0.018 * Math.sin(i / 11) + 0.004 * Math.sin(i / 3.3) + (i > 300 ? 0.0012 : -0.0006));
  B.push({ t: 1.7e9 + i * 3600, o, h: Math.max(o, p) * (1 + 0.002 + 0.002 * Math.abs(Math.sin(i))), l: Math.min(o, p) * (1 - 0.002 - 0.002 * Math.abs(Math.cos(i))), c: p, v: 1000 + 600 * Math.abs(Math.sin(i / 7)) + (i % 37 === 0 ? 4000 : 0) });
}
const C = B.map(b => b.c), fin = Number.isFinite;
const cnd = (a, op, b, not) => ({ not: !!not, a, op, b });
const one = (c, j) => ({ j: 'and', g: [{ j: j || 'and', c: Array.isArray(c) ? c : [c] }] });
const ser = (e) => P.script.cond(e).series(B);

/* 1) numbers in the script */
ok(SA.num(0.00001234) === '0.00001234' && SA.num(72155.5) === '72155.5' && SA.num(-5) === '(-5)' && SA.num(0) === '0', 'num() writes plain decimals', [SA.num(0.00001234), SA.num(72155.5), SA.num(-5)]);
ok(SA.num(NaN) === null && SA.num(Infinity) === null && SA.num(1e12) === null && SA.num('1; x') === null, 'num() refuses what is not a finite number');

/* 2) the script it writes */
let r = SA.expr(P.saPresets.dip);
ok(r.expr === '((ta.rsi(close, 14) < 30) and (close > ta.ema(close, 200))) and bar_index >= 199', 'preset "dip" → its script', r);
r = SA.expr(P.saPresets.ext);
ok(r.expr === '((close > (ta.sma(close, 20) + 2 * ta.stdev(close, 20))) or (close < (ta.sma(close, 20) - 2 * ta.stdev(close, 20)))) and bar_index >= 19', 'two groups joined with OR', r);
r = SA.expr(one(cnd({ s: 'rsi', l: 14 }, 'gt', { t: 'n', v: 70 }, true)));
ok(r.expr === '(not (ta.rsi(close, 14) > 70) and ta.rsi(close, 14) == ta.rsi(close, 14)) and bar_index >= 13', 'NOT checks its own value exists', r);
r = SA.expr({ j: 'and', g: [{ j: 'or', not: true, c: [cnd({ s: 'close' }, 'gt', { t: 's', s: 'sma', l: 50 }), cnd({ s: 'volx', l: 20 }, 'gt', { t: 'n', v: 2 })] }] });
ok(r.expr === '(not ((close > ta.sma(close, 50)) or ((volume / ta.sma(volume, 20)) > 2)) and close == close and ta.sma(close, 50) == ta.sma(close, 50) and (volume / ta.sma(volume, 20)) == (volume / ta.sma(volume, 20))) and bar_index >= 49', 'a NOT group guards every side in it', r);
for (const k of Object.keys(P.saPresets)) { const e = SA.expr(P.saPresets[k]); ok(e.expr && P.script.cond(e.expr).ok, 'preset ' + k + ' is valid Entekhab Script', e); }
for (const s of Object.keys(SA.SRC)) {
  const e = SA.expr(one(cnd({ s, l: 7 }, 'gt', { t: 'n', v: 1 })));
  ok(e.expr && P.script.cond(e.expr).ok && P.script.cond(e.expr).series(B).length === B.length, 'source ' + s + ' runs', e);
}
for (const op of Object.keys(SA.OPS)) {
  const e = SA.expr(one(cnd({ s: 'ema', l: 9 }, op, op === 'rise' || op === 'fall' ? { t: 'n', v: 3 } : { t: 's', s: 'ema', l: 21 })));
  ok(e.expr && P.script.cond(e.expr).ok, 'operator ' + op + ' runs', e);
}

/* 3) nothing from storage or the form can get into the script but known names and checked numbers */
r = SA.expr(one(cnd({ s: 'close); alert(1' }, 'gt', { t: 'n', v: 1 })));
ok(r.expr === '(close > 1)', 'an unknown source becomes close', r);
r = SA.expr(one(cnd({ s: 'rsi', l: '14) or (1' }, 'evil', { t: 'n', v: 50 })));
ok(r.expr === '(ta.rsi(close, 14) > 50) and bar_index >= 13', 'a bad length and an unknown operator fall back to safe values', r);
r = SA.expr(one(cnd({ s: 'close' }, 'gt', { t: 'n', v: '1 or 1' })));
ok(r.err === 'saE_num' && r.gi === 0 && r.ci === 0, 'text in a number is refused and points at the row', r);
r = SA.expr(one(cnd({ s: 'close' }, 'gt', { t: 's', s: '__proto__' })));
ok(r.err === 'saE_num', 'an unknown right-hand source is not taken', r);
r = SA.expr(one(cnd({ s: 'rsi', l: 99999 }, 'rise', { t: 'n', v: 999 })));
ok(r.expr === '(ta.rising(ta.rsi(close, 14), 3)) and bar_index >= 13', 'lengths and bar counts are kept in range', r);
ok(SA.expr({ g: [] }).err === 'saE_empty' && SA.expr({ g: [{ c: [] }] }).err === 'saE_emptyG', 'an empty rule or group is refused');
const big = { j: 'and', g: [0, 1, 2, 3].map(() => ({ j: 'and', not: true, c: [0, 1, 2, 3, 4, 5].map(() => cnd({ s: 'macdh' }, 'gt', { t: 's', s: 'macds' }, true)) })) };
ok(SA.expr(big).err === 'saE_long', 'a rule over 600 characters is refused (the alert checker takes 600)', SA.expr(big).n);
ok(SA.clean({ g: new Array(9).fill({ c: new Array(9).fill({}) }) }).g.length === 4 && SA.clean({ g: [{ c: new Array(9).fill({}) }] }).g[0].c.length === 6, 'at most 4 groups of 6 conditions');

/* 4) its answers against independent calculations */
const rsi = P.ind.compute('rsi', B, { len: 14 }).v;
let e = SA.evaluate(one(cnd({ s: 'rsi', l: 14 }, 'lt', { t: 'n', v: 35 })), B);
let want = []; for (let i = 1; i < B.length; i++) if (fin(rsi[i]) && rsi[i] < 35 && !(fin(rsi[i - 1]) && rsi[i - 1] < 35)) want.push(B[i].t);
ok(JSON.stringify(e.fires) === JSON.stringify(want) && want.length > 2, 'RSI < 35: fires on the same bars as the chart\'s own RSI', { got: e.fires.length, want: want.length });
ok(e.now === (rsi[B.length - 1] < 35) && Math.abs(e.conds[0][0].vals[0] - rsi[B.length - 1]) < 1e-9, 'its value now matches the chart\'s RSI', e.conds[0][0]);

const ef = P.ind.compute('ema', B, { len: 9 }).v, es = P.ind.compute('ema', B, { len: 21 }).v;
e = SA.evaluate(one(cnd({ s: 'ema', l: 9 }, 'xup', { t: 's', s: 'ema', l: 21 })), B);
want = []; for (let i = 1; i < B.length; i++) if (ef[i - 1] <= es[i - 1] && ef[i] > es[i]) want.push(B[i].t);
ok(JSON.stringify(e.fires) === JSON.stringify(want) && want.length > 3, 'EMA 9 crosses above EMA 21: same bars as the chart\'s EMAs', { got: e.fires.length, want: want.length });

e = SA.evaluate(one(cnd({ s: 'close' }, 'gt', { t: 's', s: 'hh', l: 20 })), B);
want = []; let prev = false;
for (let i = 0; i < B.length; i++) { const cur = i >= 20 && C[i] > Math.max(...B.slice(i - 20, i).map(b => b.h)); if (i && cur && !prev) want.push(B[i].t); prev = cur; }
ok(JSON.stringify(e.fires) === JSON.stringify(want) && want.length > 1, 'close above the previous 20-bar high: same bars as a plain loop', { got: e.fires.length, want: want.length });

const bb = P.ind.compute('bb', B, { len: 20, mult: 2 }), su = ser('(ta.sma(close, 20) + 2 * ta.stdev(close, 20))');
let maxd = 0; for (let i = 30; i < B.length; i++) maxd = Math.max(maxd, Math.abs(su[i] - bb.up[i]) / bb.up[i]);
ok(maxd < 1e-9, 'Bollinger upper matches the chart\'s Bollinger bands', maxd);

/* 5) AND / OR / NOT truth tables bar by bar */
const A1 = cnd({ s: 'rsi', l: 14 }, 'gt', { t: 'n', v: 50 }), B1 = cnd({ s: 'close' }, 'gt', { t: 's', s: 'sma', l: 50 });
const sa = ser('ta.rsi(close, 14) > 50'), sb = ser('close > ta.sma(close, 50)');
const ready = (i) => fin(rsi[i]) && fin(P.ind.compute('sma', B, { len: 50 }).v[i]);
const truth = (sp) => P.script.cond(SA.expr(sp).expr).series(B);
let t1 = truth(one([A1, B1], 'and')), t2 = truth(one([A1, B1], 'or')), t3 = truth(one([A1, Object.assign({}, B1, { not: true })], 'and'));
let t4 = truth({ j: 'and', g: [{ j: 'or', not: true, c: [A1, B1] }] });
let mism = 0;
for (let i = 0; i < B.length; i++) {
  const a = sa[i] > 0, b = sb[i] > 0;
  if ((t1[i] > 0) !== (a && b)) mism++;
  if ((t2[i] > 0) !== ((a || b) && i >= 49)) mism++;
  if ((t3[i] > 0) !== (a && !b && ready(i))) mism++;
  if ((t4[i] > 0) !== (!(a || b) && ready(i))) mism++;
}
ok(mism === 0, 'AND, OR, NOT on a condition and NOT on a group agree with a plain truth table on all ' + B.length + ' bars', mism);
const notOnly = truth(one(cnd({ s: 'sma', l: 200 }, 'gt', { t: 'n', v: 1e9 }, true)));
ok(notOnly.slice(0, 199).every(v => !(v > 0)) && notOnly.slice(199).every(v => v > 0), 'a NOT is false while its indicator warms up, then true', [notOnly[198], notOnly[199]]);
e = SA.evaluate(one(cnd({ s: 'sma', l: 200 }, 'gt', { t: 'n', v: 1 })), B.slice(0, 100));
/* the script engine shortens a length longer than the history; the rule must still stay false there */
{ const sh = P.script.cond(SA.expr(one(cnd({ s: 'sma', l: 200 }, 'gt', { t: 'n', v: 1 }))).expr).series(B.slice(0, 100));
  ok(sh.every(v => !(v > 0)), 'SMA 200 on 100 bars is never true (no shortened average)', sh.slice(-2));
  const mid = SA.evaluate(one(cnd({ s: 'close' }, 'gt', { t: 's', s: 'ema', l: 200 })), B.slice(0, 199)), ful = SA.evaluate(one(cnd({ s: 'close' }, 'gt', { t: 's', s: 'ema', l: 200 })), B.slice(0, 200));
  ok(mid.conds[0][0].ready === false && ful.bars === 200 && ful.conds[0][0].ready === fin(P.ind.compute('ema', B.slice(0, 200), { len: 200 }).v[199]), 'ready only once there are enough bars', [mid.conds[0][0], ful.conds[0][0]]); }
ok(e.conds[0][0].ready === false && e.now === false && e.fires.length === 0, 'too few bars: shown as not ready, never fires', e.conds[0][0]);

/* 6) the live alert sees exactly what the builder shows */
const sp = P.saPresets.calm, ex = SA.expr(sp).expr, cc = P.script.cond(ex), full = cc.series(B);
let agree = 0; for (let k = 50; k <= B.length; k += 37) { const tt = cc.test(B.slice(0, k)); if (tt[1] === (full[k - 1] > 0 ? 1 : 0) && tt[0] === (full[k - 2] > 0 ? 1 : 0)) agree++; else console.log('at', k, tt, full[k - 2], full[k - 1]); }
ok(agree === Math.floor((B.length - 50) / 37) + 1, 'the alert checker\'s last two values match the builder\'s series at every cut', agree);
e = SA.evaluate(sp, B);
ok(e.bars === B.length && e.truePct >= 0 && e.truePct <= 100 && Array.isArray(e.fires) && e.conds.length === 2, 'evaluate reports bars, share of true bars, fires and every condition', { bars: e.bars, pct: e.truePct });

console.log(`test_pro_salert.js: ${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
