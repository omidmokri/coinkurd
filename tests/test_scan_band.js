/* scan.js band() — where the live price sits in the 48-hour range.
   The function is private to the view, so the test lifts its source out of the file
   and evaluates that exact text: if the file changes, the test follows it.
   Run: node tests/test_scan_band.js */
'use strict';
var fs = require('fs');
var FAILS = [];
function ok(what, cond, got) {
  console.log((cond ? 'PASS ' : 'FAIL ') + what + (cond ? '' : '  -> ' + JSON.stringify(got)));
  if (!cond) FAILS.push(what);
}

var src = fs.readFileSync(__dirname + '/../assets/obs/scan.js', 'utf8');
var m = src.match(/function band\(c\) \{[\s\S]*?\n  \}/);
ok('band() found in scan.js', !!m, null);
var band = eval('(' + m[0] + ')');

ok('at the low reads 0', band({ price: 10, lo48: 10, hi48: 20 }) === 0, band({ price: 10, lo48: 10, hi48: 20 }));
ok('at the high reads 100', band({ price: 20, lo48: 10, hi48: 20 }) === 100, null);
ok('mid-range reads 50', band({ price: 15, lo48: 10, hi48: 20 }) === 50, null);
ok('a price above the high is held at 100', band({ price: 24, lo48: 10, hi48: 20 }) === 100,
   band({ price: 24, lo48: 10, hi48: 20 }));
ok('a price below the low is held at 0', band({ price: 6, lo48: 10, hi48: 20 }) === 0,
   band({ price: 6, lo48: 10, hi48: 20 }));
ok('a flat range gives nothing', band({ price: 10, lo48: 10, hi48: 10 }) === null, null);
ok('missing figures give nothing', band({ price: 10, lo48: null, hi48: 20 }) === null, null);

console.log(FAILS.length ? '\n' + FAILS.length + ' failed' : '\nall passed');
process.exit(FAILS.length ? 1 : 0);
