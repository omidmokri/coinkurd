/* OB.csv — the download behind the data button. Checked without a browser by giving core.js the few globals it
   touches, then reading back what the blob was built from.
   Run: node tests/test_csv.js */
'use strict';
var FAILS = [];
function ok(what, cond, got) {
  console.log((cond ? 'PASS ' : 'FAIL ') + what + (cond ? '' : '  -> ' + JSON.stringify(got)));
  if (!cond) FAILS.push(what);
}

/* the smallest stand-ins core.js needs to define OB.csv */
var written = null;
global.Blob = function (parts) { written = parts.join(''); };
global.URL = { createObjectURL: function () { return 'blob:x'; }, revokeObjectURL: function () {} };
var el = { href: '', download: '', click: function () {}, remove: function () {}, style: {}, setAttribute: function () {} };
global.document = { createElement: function () { return el; }, body: { appendChild: function () {} },
  documentElement: { lang: 'en', dir: 'ltr', setAttribute: function () {}, classList: { toggle: function () {} } },
  addEventListener: function () {}, querySelector: function () { return null; }, querySelectorAll: function () { return []; } };
global.window = global;
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
Object.defineProperty(global, 'navigator', { value: { language: 'en', userAgent: 'node' }, configurable: true });
global.location = { search: '', pathname: '/', origin: 'https://entekhab.net' };
global.setTimeout = function () {};
try { require('../assets/obs/core.js'); } catch (e) { /* core does more than we need; OB.csv is what matters */ }

var OB = global.OB;
if (!OB || typeof OB.csv !== 'function') {
  console.log('FAIL OB.csv was not defined  -> ' + (OB ? Object.keys(OB).length + ' keys' : 'no OB'));
  process.exit(1);
}

OB.csv('x.csv', [['a', 'b'], [1, 2]]);
ok('rows are comma separated and lines CRLF-ended', written.indexOf('a,b\r\n1,2') > 0, written);
ok('the file starts with a byte-order mark, or Excel shows mojibake', written.charCodeAt(0) === 0xFEFF);

OB.csv('x.csv', [['h'], ['a,b'], ['say "hi"'], ['two\nlines']]);
ok('a comma forces quotes', written.indexOf('"a,b"') > 0, written);
ok('a quote is doubled inside quotes', written.indexOf('"say ""hi"""') > 0, written);
ok('a newline inside a cell is quoted, not left to split the row', written.indexOf('"two\nlines"') > 0, written);

OB.csv('x.csv', [['h'], ['=1+1'], ['+SUM(A1)'], ['@cmd'], ['-1+1'], ['plain']]);
ok('a cell a spreadsheet would run as a formula is defanged',
   /'=1\+1/.test(written) && /'\+SUM/.test(written) && /'@cmd/.test(written) && /'-1\+1/.test(written), written);
ok('ordinary text is left alone', /(^|,|\n)plain/.test(written), written);

/* Half the figures exported here are negative -- a 24-hour change, a day's return. Quoting those would turn every
   numeric column into text, which is worse than the thing being guarded against. */
OB.csv('x.csv', [['h'], [-9], [-0.0371], ['-9'], [-1.2e-5]]);
ok('a negative number stays a number', !/'/.test(written), written);
ok('and keeps its value', /-9/.test(written) && /-0\.0371/.test(written), written);

OB.csv('x.csv', [['a', 'b'], [null, undefined], [0, false]]);
ok('an absent value is an empty cell, not the word null', /\r\n,\r\n/.test(written), written);
ok('zero and false are values, not absences', /0,false/.test(written), written);

ok('it reports how many data rows went out', OB.csv('x.csv', [['h'], [1], [2], [3]]) === 3);

console.log(FAILS.length ? '\n' + FAILS.length + ' failure(s)' : '\nOK');
process.exit(FAILS.length ? 1 : 0);
