/* ODM help (assets/pro/odhelp.js): every item has its text in the site's four languages, its own icon, and the
   ask box finds the guide's answer to everyday questions in each language. Run: node tests/test_pro_odhelp.js */
global.window = global;
global.document = { addEventListener: function () { }, createElement: function () { return {}; } };
window.addEventListener = function () { };
require('../assets/pro/i18n.js');
var P = window.PRO, LANG = 'en';
P.app = { T: function (k, a) { return P.tr(LANG, k, a); }, RTL: function () { return LANG !== 'en'; } };
require('../assets/pro/odhelp.js');
var H = P.odh, n = 0, fail = 0;
function ok(name, c, info) { n++; if (!c) { fail++; console.log('FAIL ' + name + (info ? ' — ' + info : '')); } }

var L = ['en', 'fa', 'ckb', 'ar'], S = P.STR;
ok('47 items, one per section, field and result', H.KEYS.length === 47, H.KEYS.length);
var glyph = {}; H.KEYS.concat(['ask']).forEach(function (k) { var g = H.svg(k); ok('icon ' + k + ' is its own', !glyph[g], k + ' = ' + glyph[g]); glyph[g] = k; });
L.forEach(function (l) {
  H.KEYS.forEach(function (k) {
    ['t', 'w', 'y', 'e'].forEach(function (f) { var s = S[l]['odh_' + k + '_' + f]; ok(l + ' ' + k + '.' + f + ' written', typeof s === 'string' && s.length >= 2, s); });
    var e = S.en['odh_' + k + '_n'], x = S[l]['odh_' + k + '_n'];
    if (e) ok(l + ' ' + k + '.n keeps the same placeholders', (x || '').match(/\{\w+\}/g).sort().join() === e.match(/\{\w+\}/g).sort().join(), x);
  });
  H.FAQ.forEach(function (k, i) { ok(l + ' question ' + i + ' and its answer', S[l]['odhQ' + i] && S[l]['odhA' + i]); });
  ['odhAbout', 'odhWhat', 'odhWhy', 'odhEx', 'odhYours', 'odhAsk', 'odhAskPh', 'odhSend', 'odhFound', 'odhNone', 'odhTg', 'odhCopied', 'odhSee', 'odhClose', 'odhTgPre', 'odhNote', 'odLossOf'].forEach(function (k) { ok(l + ' ui ' + k, !!S[l][k]); });
});
/* every label key the planner tags points at an item that exists */
Object.keys(H.of).forEach(function (lk) { ok('label ' + lk + ' -> ' + H.of[lk], H.KEYS.indexOf(H.of[lk]) >= 0); });

/* the ask box, in each language: the right answer comes first */
var Q = {
  en: [['what is R?', 'q', 1], ['does more leverage increase my loss', 'q', 3], ['what is ATR', 'q', 5], ['how are fees counted', 'q', 6], ['can I short', 'q', 12], ['what if only some entries fill', 'q', 2]],
  fa: [['R یعنی چی؟', 'q', 1], ['اهرم بیشتر ضررم را زیاد می‌کند؟', 'q', 3], ['ATR چیه', 'q', 5], ['کارمزد چطور حساب می‌شود', 'q', 6]],
  ckb: [['R چییە؟', 'q', 1], ['ATR چییە', 'q', 5]],
  ar: [['ما هو R؟', 'q', 1], ['ما هو ATR', 'q', 5], ['كيف تُحسب الرسوم', 'q', 6]]
};
L.forEach(function (l) {
  LANG = l;
  Q[l].forEach(function (c) {
    var r = H.search(c[0], null), top = r[0];
    ok('[' + l + '] "' + c[0] + '" is answered by question ' + c[2] + ' or its item', top && (top.kind === 'q' ? top.i === c[2] : top.k === H.FAQ[c[2]]), JSON.stringify(r));
  });
  /* the current item lifts its own answers: asking "what is this" on the fee icon */
  var r2 = H.search(S[l].odh_fee_t, 'fee'); ok('[' + l + '] the item\'s own title finds it', r2.length && (r2[0].k === 'fee'), JSON.stringify(r2.slice(0, 2)));
  ok('[' + l + '] nonsense finds nothing, so the person on Telegram is offered', H.search('zzqx wwvb', null).length === 0);
  ok('[' + l + '] an empty question finds nothing', H.search('  ', 'fee').length === 0);
});
console.log('test_pro_odhelp.js: ' + n + ' checks, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
