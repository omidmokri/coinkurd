/* the matrix's indicators and the regime rules, on series whose answer is known */
global.window = {}; require('../assets/pro/mtf.js'); require('../assets/pro/ind.js'); var P = window.PRO, M = P.mtfCalc, n = 0, bad = 0;
function near(a, b, tol, what) { n++; if (!(Math.abs(a - b) <= tol)) { bad++; console.log('FAIL', what, 'got', a, 'want', b); } }
function is(a, b, what) { n++; if (a !== b) { bad++; console.log('FAIL', what, 'got', a, 'want', b); } }
function series(fn, N, vol) { var B = [], p = fn(0); for (var i = 0; i < N; i++) { var o = p, c = fn(i + 1); B.push({ t: i * 3600, o: o, h: Math.max(o, c) * 1.002, l: Math.min(o, c) * 0.998, c: c, v: vol ? vol(i) : 100 }); p = c; } return B; }
/* EMA of a constant is the constant; of 1..n with n=3 the classic hand values */
near(M.ema([5, 5, 5, 5, 5], 3)[4], 5, 1e-12, 'ema const'); var e = M.ema([1, 2, 3, 4, 5], 3); is(e[1], null, 'ema warm-up'); near(e[2], 2, 1e-12, 'ema seed'); near(e[3], 3, 1e-12, 'ema step'); near(e[4], 4, 1e-12, 'ema step 2');
/* RSI: only gains → 100, only losses → 0, flat → 50 */
near(M.rsi(Array.from({ length: 40 }, function (_, i) { return 100 + i; }), 14)[39], 100, 1e-9, 'rsi up'); near(M.rsi(Array.from({ length: 40 }, function (_, i) { return 100 - i; }), 14)[39], 0, 1e-9, 'rsi down'); near(M.rsi(Array.from({ length: 40 }, function () { return 7; }), 14)[39], 50, 1e-9, 'rsi flat');
/* against the site's own indicator library on a wavy series (two independent implementations must agree) */
var W = series(function (i) { return 100 + 10 * Math.sin(i / 7) + i * 0.05; }, 400), I = P.ind || P.I, cW = W.map(function (b) { return b.c; });
if (I && I.rsi) { var ref = I.rsi(cW, 14); near(M.rsi(cW, 14)[399], ref[399], 1e-6, 'rsi = ind.js'); }
if (I && I.ema) { near(M.ema(cW, 50)[399], I.ema(cW, 50)[399], 1e-6, 'ema = ind.js'); }
/* ATR of bars with a constant true range is that range */
var flat = []; for (var i = 0; i < 40; i++) flat.push({ h: 11, l: 9, c: 10, v: 1 }); near(M.atr(flat, 14)[39], 2, 1e-12, 'atr const');
/* ADX: a steady climb is a strong trend, a flat zig-zag is not */
var up = series(function (i) { return 100 * Math.pow(1.004, i); }, 400), dn = series(function (i) { return 100 * Math.pow(0.996, i); }, 400), zig = series(function (i) { return 100 + (i % 2 ? 0.4 : -0.4); }, 400);
n++; if (!(M.adx(up, 14)[399] > 40)) { bad++; console.log('FAIL adx trend', M.adx(up, 14)[399]); } n++; if (!(M.adx(zig, 14)[399] < 20)) { bad++; console.log('FAIL adx chop', M.adx(zig, 14)[399]); }
/* regime */
is(M.regime(up).trend, 'bull', 'bull'); is(M.regime(dn).trend, 'bear', 'bear'); is(M.regime(zig).trend, 'range', 'range'); is(M.regime(up).agree, 4, 'all four rules agree in a clean uptrend'); n++; if (!(M.regime(up).held > 100)) { bad++; console.log('FAIL held', M.regime(up).held); }
is(M.regime(up.slice(0, 30)).err, 'short', 'too few bars');
/* a long quiet stretch then nothing: the band is squeezed; a quiet stretch then big bars: expansion and high volatility */
var sq = series(function (i) { return 100 + 8 * Math.exp(-i / 70) * Math.sin(i / 5); }, 400);   /* swings that die away */ is(M.regime(sq).band, 'squeeze', 'squeeze');
var ex = series(function (i) { return i < 380 ? 100 + 0.2 * Math.sin(i / 5) : 100 + (i - 380) * 1.5 * (i % 2 ? 1 : 0.6); }, 400); is(M.regime(ex).band, 'expansion', 'expansion'); is(M.regime(ex).vol, 'high', 'high volatility');
/* sell-off: three hard down bars, the last on triple volume */
var so = series(function (i) { return i <= 396 ? 100 + 0.3 * Math.sin(i / 4) : 100 - (i - 396) * 4; }, 400, function (i) { return i >= 399 ? 300 : 100; }); is(M.regime(so).selloff, true, 'sell-off'); is(M.regime(up).selloff, false, 'no sell-off in a calm climb');
/* structure and the row */
var st = series(function (i) { return 100 + i * 0.3 + 6 * Math.sin(i / 6); }, 300); is(M.structure(st).k, 'up', 'HH/HL'); var st2 = series(function (i) { return 300 - i * 0.3 + 6 * Math.sin(i / 6); }, 300); is(M.structure(st2).k, 'down', 'LH/LL');
var r = M.row(up); is(r.trend, 'up', 'row trend'); is(r.lean, 'up', 'row lean'); n++; if (!(r.rsi > 70)) { bad++; console.log('FAIL row rsi', r.rsi); } var acc = series(function (i) { return 300 - 0.002 * i * i; }, 300); is(M.row(acc).lean, 'down', 'row lean down (an accelerating fall)');
/* a fall that slows in absolute terms has a rising histogram: one vote against, so the row is not called down */
is(M.row(dn).lean, 'flat', 'a slowing fall is not a clean down'); is(M.row(up.slice(0, 20)).err, 'short', 'row short');
near(M.pct([1, 2, 3, 4], 3), 75, 1e-12, 'percentile');
console.log('test_pro_mtf.js: ' + n + ' checks, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
