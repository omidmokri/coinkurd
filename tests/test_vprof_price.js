/* vprof.js — the price axis must read differently on every band.
   64 bands all labelled "$1.8K" is not a price axis, which is what a compressed formatter produced.
   The rule is lifted out of the file and evaluated, so the test follows the code.
   Run: node tests/test_vprof_price.js */
'use strict';
var fs = require('fs');
var FAILS = [];
function ok(what, cond, got) {
  console.log((cond ? 'PASS ' : 'FAIL ') + what + (cond ? '' : '  -> ' + JSON.stringify(got)));
  if (!cond) FAILS.push(what);
}

var src = fs.readFileSync(__dirname + '/../assets/obs/vprof.js', 'utf8');
var m = src.match(/function dp\(step\) \{[\s\S]*?\n  \}/);
ok('the decimal rule is in vprof.js', !!m, null);
var dp = eval('(' + m[0] + ')');

/* every band of a 64-band profile must print a label of its own */
function labels(lo, hi, n) {
  var step = (hi - lo) / n, d = dp(step), out = {};
  for (var i = 0; i < n; i++) out[(lo + (i + 0.5) * step).toFixed(d)] = 1;
  return Object.keys(out).length;
}
[['Bitcoin', 55130, 82060.88], ['Ether', 1700, 1900], ['XRP', 1.8, 2.4], ['Dogecoin', 0.14, 0.2],
 ['a coin worth very little', 0.0000081, 0.0000113], ['a narrow day', 60000, 60400]].forEach(function (c) {
  ok(c[0] + ': all 64 bands get their own label', labels(c[1], c[2], 64) === 64, labels(c[1], c[2], 64));
});

ok('a step of nothing still yields a sane number of decimals', dp(0) >= 0 && dp(0) <= 8, dp(0));
ok('decimals never run away on a tiny step', dp(1e-30) <= 8, dp(1e-30));
ok('a wide step needs no decimals', dp(500) === 0, dp(500));

console.log(FAILS.length ? '\n' + FAILS.length + ' failed' : '\nall passed');
process.exit(FAILS.length ? 1 : 0);
