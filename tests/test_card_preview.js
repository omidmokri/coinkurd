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


/* ---------------------------------------------------------------- the post sheet
   What the owner saw: the picture filled a phone screen and was cropped top and bottom, so the text under it
   was out of sight and part of the infographic was simply gone; and the post's own picture address was printed
   underneath as a long unreadable line. Both rules are lifted out of index.html and checked here. */

var sheetCss = (html.match(/\.sheet img\{[^}]*\}/) || [''])[0];
ok('the sheet picture has a rule of its own', !!sheetCss, sheetCss);
ok('it is never cropped: these are text infographics, not photographs',
   /object-fit:contain/.test(sheetCss) && !/cover/.test(sheetCss), sheetCss);
/* an earlier version capped the height to keep the picture compact. The owner asked for the opposite: these
   are infographics and the words on them are the point, so the picture is shown big enough to read. */
ok('no fixed pixel height is left on it', !/max-height:440px/.test(sheetCss), sheetCss);

var ni = html.indexOf('const noImgUrl=');
ok('the picture-address rule is in index.html', ni >= 0, ni);
var noImgUrl = eval('(' + html.slice(html.indexOf('=', ni) + 1, html.indexOf('trim();', ni) + 7).replace(/;$/, '') + ')');

var REAL = 'خروج سنگین سرمایه نهادی.\nhttps://raw.githubusercontent.com/omidmokri/coinkurd/main/data/deepimg/202611221731-v2.jpg';
ok('the post\'s own picture address is taken out of the text', noImgUrl(REAL).indexOf('http') < 0, noImgUrl(REAL));
ok('and the words of the post are untouched', noImgUrl(REAL).indexOf('خروج سنگین سرمایه نهادی.') === 0, noImgUrl(REAL));
ok('a link to an article is kept, because a reader may want to follow it',
   noImgUrl('خبر: https://example.com/news/123').indexOf('https://example.com/news/123') > 0,
   noImgUrl('خبر: https://example.com/news/123'));
ok('a picture address with a query on the end goes too',
   noImgUrl('a https://x.com/p.png?v=2 b').indexOf('http') < 0, noImgUrl('a https://x.com/p.png?v=2 b'));
ok('text with no address at all is returned as it was',
   noImgUrl('یک متن ساده.') === 'یک متن ساده.', noImgUrl('یک متن ساده.'));
ok('nothing in, nothing out', noImgUrl('') === '' && noImgUrl(null) === '');


/* the sheet's own body: the title must not appear twice, and no bar of box characters before the first line */
var ei = html.indexOf('const noEcho=');
ok('the sheet-body rule is in index.html', ei >= 0, ei);
var noEcho = eval('(' + html.slice(html.indexOf('=', ei) + 1, html.indexOf('};', ei) + 2).replace(/;$/, '') + ')');

var T2 = 'راز ریزش بیت\u200cکوین به ۵۹ هزار دلار و تله بزرگ دسامبر';
var BODY = T2 + '\n━━━━━━━━━━\n⚡️ در ۳ ثانیه\nخروج سنگین سرمایه نهادی.';
var b = noEcho(BODY, T2);
ok('the sheet body does not repeat the title', b.indexOf(T2) < 0, b.slice(0, 50));
ok('and does not open with a bar of box characters', !/^[\s\u2500-\u257F]/.test(b), b.slice(0, 30));
ok('it opens with the first real line of the post', b.indexOf('در ۳ ثانیه') >= 0 && b.indexOf('در ۳ ثانیه') < 4,
   b.slice(0, 30));
ok('the body of the post is kept whole', b.indexOf('خروج سنگین سرمایه نهادی.') > 0, b);

var mid = noEcho('T\nfirst\n━━━━━━\nsecond', 'T');
ok('a rule further down the post is left where it is, as a section break', /━/.test(mid), mid);
ok('a body that does not repeat its title is untouched',
   noEcho('Just the body.', 'Other title') === 'Just the body.', noEcho('Just the body.', 'Other title'));
ok('nothing in, nothing out', noEcho('', 'T') === '' && noEcho(null, null) === '');
ok('the sheet runs both cleanups on the text, not one',
   /linkify\(noEcho\(noImgUrl\(/.test(html), (html.match(/class="txt"[^<]{0,80}/) || [''])[0]);


/* ---------------------------------------------------------------- the full text of a post
   The page starts with short records whose text is cut at about 240 characters and ends in an ellipsis, then
   fetches the full ones. The merge put the short record LAST, so the cut text was written back over the full
   text and every post opened as a stub. Order matters, and that is all this checks. */
var mi = html.indexOf('S.posts=a.map(');
ok('the merge of the full posts is in index.html', mi >= 0, mi);
var merges = html.match(/S\.posts=a\.map\([^;]*;/g) || [];
ok('both places that merge are written the same way', merges.length === 2 && merges[0] === merges[1], merges);
ok('the full record wins over the short one',
   merges.every(function (m) { return /Object\.assign\(\{\},m\.get\(x\.id\)\|\|\{\},x\)/.test(m); }), merges);
ok('the short record is no longer applied last',
   !merges.some(function (m) { return /Object\.assign\(\{\},x,m\.get/.test(m); }), merges);

/* the order, run on records shaped like the real ones */
var short = { id: 1, text: 'a short text that ends in an ellipsis…', seen: true };
var fullR = { id: 1, text: 'the whole piece, very much longer than the short one' };
var merged = Object.assign({}, short, fullR);
ok('the whole piece survives the merge', merged.text === fullR.text, merged.text);
ok('state the page added while open is not lost', merged.seen === true, merged);

/* the picture: big enough that the words on it can be read */
ok('the picture is shown at the full width of the sheet, not shrunk to a thumbnail',
   /\.sheet img\{width:100%;height:auto/.test(html), sheetCss);
ok('and still never cropped', /\.sheet img\{[^}]*object-fit:contain/.test(html), sheetCss);
ok('no height cap is left to cut it short', !/\.sheet img\{[^}]*max-height:(?!none)/.test(html), sheetCss);

/* a link card that only shows the picture's own address is not drawn at all */
ok('an image address is recognised', /const isImgUrl=/.test(html));
var ii = html.indexOf('const isImgUrl=');
var isImgUrl = eval('(' + html.slice(html.indexOf('=', ii) + 1, html.indexOf(';', ii)) + ')');
ok('a picture link is spotted', isImgUrl('https://raw.githubusercontent.com/o/c/main/data/deepimg/x-v2.jpg'));
ok('an article link is not', !isImgUrl('https://example.com/news/123'));
ok('the link card is skipped for a picture', /p\.link&&p\.link\.url&&!isImgUrl\(p\.link\.url\)/.test(html));

console.log(FAILS.length ? '\n' + FAILS.length + ' failed' : '\nall passed');
process.exit(FAILS.length ? 1 : 0);
