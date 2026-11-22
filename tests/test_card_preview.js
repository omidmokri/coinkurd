/* The preview line under a post's title on the home page.
   A Telegram post carries a rule of box-drawing characters under its title. The preview is the post's text with
   the title taken off the front, so that rule was what the reader saw first: a bar of ━ where the first line of
   the piece should be. The rule that builds the preview lives inline in index.html; this lifts it out and runs
   it on the real post that showed the fault.
   Run: node tests/test_card_preview.js */
'use strict';
var fs = require('fs');
var FAILS = [];
function ok(what, cond, got) {
  console.log((cond ? 'PASS ' : 'FAIL ') + what + (cond ? '' : '  -> ' + JSON.stringify(got)));
  if (!cond) FAILS.push(what);
}

var html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
var i = html.indexOf('const cut=tt&&body.startsWith(tt)');
ok('the preview rule is in index.html', i >= 0, i);
var j = html.indexOf('return rest?', i);
var code = html.slice(i, j);

/* the extracted code is run as its own function, so what is tested is exactly the text in index.html */
var run = new Function('body', 'tt', code + ' return rest;');

function preview(title, text) {
  var body = (text || '').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1').replace(/#\S+/g, '').trim();
  var tt = (title || '').replace(/…$/, '');
  return run(body, tt);
}

/* the post the owner saw, exactly as data/posts_lite.json holds it */
var TITLE = 'راز ریزش بیت‌کوین به ۵۹ هزار دلار و تله بزرگ دسامبر';
var TEXT = TITLE + '\n━━━━━━━━━━\n⚡️ در ۳ ثانیه\nخروج سنگین سرمایه نهادی و ترس از تصمیم انقباضی فدرال رزرو.';
var p = preview(TITLE, TEXT);
ok('the preview no longer opens with a bar of box characters', !/^[\s─-╿]/.test(p), p.slice(0, 40));
ok('it opens with the first real line of the post', p.indexOf('در ۳ ثانیه') === 0 || p.indexOf('⚡') === 0,
   p.slice(0, 40));
ok('the words of the post are still there', p.indexOf('خروج سنگین سرمایه نهادی') >= 0, p.slice(0, 80));
ok('the title is not repeated in the preview', p.indexOf(TITLE) < 0, p.slice(0, 60));

/* a rule in the middle becomes a separator rather than a bar across the card */
var mid = preview('T', 'T\nfirst part\n━━━━━━\nsecond part');
ok('a rule inside the text becomes a dash', mid.indexOf('—') >= 0 && !/━/.test(mid), mid);
ok('nothing around that rule is lost', mid.indexOf('first part') >= 0 && mid.indexOf('second part') >= 0, mid);

/* the ordinary case must not change */
var plain = preview('Headline', 'Headline\nA normal first sentence. And a second.');
ok('a post with no rule reads exactly as before', plain === 'A normal first sentence. And a second.', plain);
var noTitle = preview('Other', 'A body that does not repeat the title.');
ok('a body that does not start with the title is left alone',
   noTitle === 'A body that does not repeat the title.', noTitle);
ok('a post with nothing but a rule yields no preview at all', preview('T', 'T\n━━━━━━') === '',
   preview('T', 'T\n━━━━━━'));

console.log(FAILS.length ? '\n' + FAILS.length + ' failed' : '\nall passed');
process.exit(FAILS.length ? 1 : 0);
