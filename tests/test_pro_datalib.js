/* Data library: every entry is well formed, every address is https with no query, and each entry and category has
   text in the four hand-written languages. Run: node tests/test_pro_datalib.js */
'use strict';
global.window = {};
require('../assets/pro/i18n.js');
require('../assets/pro/datalib.js');
var P = window.PRO, S = P.STR, L = P.DATALIB, CATS = P.DATALIB_CATS, fail = 0, n = 0;
function ok(c, m) { n++; if (!c) { fail++; console.log('FAIL', m); } }
var ids = {}, urls = {};
L.forEach(function (e) {
  ok(e.length === 5, 'shape ' + e[0]);
  ok(/^[a-z0-9]+$/.test(e[0]) && !ids[e[0]], 'id unique ' + e[0]); ids[e[0]] = 1;
  ok(CATS.indexOf(e[1]) >= 0, 'cat ' + e[0]);
  ok(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[A-Za-z0-9._~\/-]*)?$/.test(e[3]), 'url shape ' + e[3]);
  ok(!urls[e[3]], 'url unique ' + e[3]); urls[e[3]] = 1;
  ok(typeof e[4] === 'string' && e[4].length, 'licence ' + e[0]);
  ['en', 'fa', 'ckb', 'ar'].forEach(function (l) { ok(typeof S[l]['dl_' + e[0]] === 'string' && S[l]['dl_' + e[0]].length > 20, l + ' text ' + e[0]); });
});
CATS.forEach(function (c) { ok(L.some(function (e) { return e[1] === c; }), 'cat used ' + c); ['en', 'fa', 'ckb', 'ar'].forEach(function (l) { ok(S[l]['dlc_' + c], l + ' cat ' + c); }); });
['dlTitle', 'dlNote', 'dlSearch', 'dlAll', 'dlLic', 'dlLicTerms', 'dlLicNone', 'dlLicVaries', 'dlLicOther', 'dlNone', 'dlChecked', 'dlTips', 'dlTip1', 'dlTip2', 'dlTip3', 'dlTip4'].forEach(function (k) {
  ['en', 'fa', 'ckb', 'ar'].forEach(function (l) { ok(S[l][k], l + ' ' + k); });
  ['fa', 'ckb', 'ar'].forEach(function (l) { ok(((S.en[k].match(/\{\w+\}/g) || []).join()) === ((S[l][k] || '').match(/\{\w+\}/g) || []).join(), l + ' placeholder ' + k); });
});
/* the two sources found paid or missing stay out */
ok(!L.some(function (e) { return /aethereal|marketdata-hub/i.test(e[3]); }), 'dropped sources stay out');
/* non-commercial sources say so in English */
['binv', 'cdd'].forEach(function (id) { ok(/non-commercial/i.test(S.en['dl_' + id]), 'NC stated ' + id); });
ok(/non-display/i.test(S.en.dl_twelve), 'Twelve Data non-display stated');
ok(/personal use/i.test(S.en.dl_yf), 'yfinance personal use stated');
ok(/caching/i.test(S.en.dl_fred), 'FRED no caching stated');
console.log('datalib: ' + n + ' checks, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
