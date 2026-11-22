/* The home page's fourth tile carries a date, not a bare number.
   .nxw-k b forces left-to-right so thousands separators read correctly in the three number tiles. A Persian date
   begins with a day written in Arabic-Indic digits, and in a left-to-right box that day is thrown to the far end:
   "۱ آذر ۱۴۰۵، ۱۲:۴۶" was being shown as "آذر ۱۴۰۵، ۱۲:۴۶ ۱". The date tile therefore carries nxw-dt, which hands
   it back the direction of the page.
   Run: node tests/test_nx_datetile.js */
'use strict';
var fs = require('fs');
var FAILS = [];
function ok(what, cond, got) {
  console.log((cond ? 'PASS ' : 'FAIL ') + what + (cond ? '' : '  -> ' + JSON.stringify(got)));
  if (!cond) FAILS.push(what);
}

var js = fs.readFileSync(__dirname + '/../assets/nx-home.js', 'utf8');
var css = fs.readFileSync(__dirname + '/../assets/nx.css', 'utf8');

/* the line that builds the tile: the one carrying the "last update" label */
var line = js.split('\n').filter(function (l) { return l.indexOf('#sUpd') >= 0 && l.indexOf('<li>') >= 0; })[0];
ok('the date tile is still built in nx-home.js', !!line, null);
ok('the date tile is marked nxw-dt', /<b class="nxw-dt">/.test(line || ''), line);

/* the three number tiles must NOT carry it: they want the left-to-right number layout */
var numLine = js.split('\n').filter(function (l) { return l.indexOf("'#sPosts'") >= 0; })[0];
ok('the number tiles are still built alongside it', !!numLine, null);
ok('the number tiles keep the plain left-to-right layout', (numLine || '').indexOf('nxw-dt') < 0, numLine);

/* the class has to actually undo the direction, or marking it changes nothing */
var rule = css.split('\n').filter(function (l) { return l.indexOf('.nxw-dt') >= 0 && l.indexOf('{') >= 0; })[0];
ok('nxw-dt has a rule of its own in nx.css', !!rule, null);
ok('that rule gives the tile back the page direction', /direction\s*:\s*inherit/.test(rule || ''), rule);

/* and the rule must come after the one it overrides, or the cascade ignores it */
var iBase = css.indexOf('.nxw-k b{'), iFix = css.indexOf('.nxw-k b.nxw-dt');
ok('the base rule is still there for the number tiles', iBase >= 0, iBase);
ok('the override comes after the rule it overrides', iFix > iBase, { base: iBase, override: iFix });

console.log(FAILS.length ? '\n' + FAILS.length + ' failed' : '\nall passed');
process.exit(FAILS.length ? 1 : 0);
