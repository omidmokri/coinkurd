/* /leaderboard/ — paper-trading leaderboard from /data/leaderboard.json (written by the bot, scripts/bot_paper.py).
   Every trade in it was priced by the bot from Binance at the moment of the tap, so nobody can edit a result.
   Only people who opted in with a nickname and have at least 10 closed trades are listed. */
(function () {
  'use strict';
  var root = document.getElementById('lb');
  if (!root) return;
  var BOT = 'https://t.me/Kurd_kurdistan_bot?start=s_paper';
  var S = {
    load: ['دریافت جدول…', 'وەرگرتنی خشتە…', 'Loading…'],
    w: { d7: ['۷ روز', '٧ ڕۆژ', '7 days'], d30: ['۳۰ روز', '٣٠ ڕۆژ', '30 days'], d90: ['۹۰ روز', '٩٠ ڕۆژ', '90 days'], all: ['از ابتدا', 'لە سەرەتاوە', 'All time'] },
    th: ['رتبه|نام|بازده|سود/زیان|بیشترین افت|معامله|برد|سورتینو|از',
      'پلە|ناو|قازانج|قازانج/زیان|زۆرترین داکەوتن|مامەڵە|بردنەوە|سۆرتینۆ|لە',
      'Rank|Name|Return|P/L|Max drawdown|Trades|Win|Sortino|Since'],
    empty: ['هنوز کسی با رضایت خودش و دست‌کم {n} معاملهٔ بسته‌شده در این بازه نیست.', 'هێشتا کەس بە ڕەزامەندیی خۆی و لانیکەم {n} مامەڵەی داخراو لەم ماوەیەدا نییە.',
      'Nobody has opted in with at least {n} closed trades in this window yet.'],
    waiting: ['{n} نفر در راه‌اند (کمتر از {k} معاملهٔ بسته‌شده).', '{n} کەس لە ڕێگادان (کەمتر لە {k} مامەڵەی داخراو).', '{n} more on their way (fewer than {k} closed trades).'],
    join: ['شروع معاملهٔ آزمایشی در ربات', 'دەستپێکردنی مامەڵەی تاقیکاری لە بۆت', 'Start paper trading in the bot'],
    rules: ['قواعد: هر حساب با ۱۰٬۰۰۰ دلار مجازی شروع می‌کند · قیمت ورود و خروج را خود ربات همان لحظه از بایننس می‌گیرد · بدون اهرم · کارمزد ۰٫۱٪ هر طرف · حداکثر ۵ پوزیشن باز · فقط معامله‌های بسته‌شده حساب می‌شوند · رتبه فقط با رضایت خود کاربر و از ۱۰ معاملهٔ بسته‌شده · هر کس می‌تواند حسابش را کامل پاک کند.',
      'یاساکان: هەر هەژمارێک بە ١٠٬٠٠٠ دۆلاری مەجازی دەست پێدەکات · نرخی چوونە و دەرچوون بۆتەکە خۆی هەمان ساتە لە بایننس وەردەگرێت · بێ لیڤەرێج · کرێ ٠٫١٪ هەر لایەک · زۆرترین ٥ پۆزیشن · تەنها مامەڵە داخراوەکان دەژمێردرێن · پلە تەنها بە ڕەزامەندی و لە ١٠ مامەڵەی داخراو · هەرکەس دەتوانێت هەژمارەکەی بسڕێتەوە.',
      'Rules: every account starts with $10,000 of virtual money · the bot itself takes entry and exit prices from Binance at that moment · no leverage · 0.1% fee each side · at most 5 open positions · only closed trades count · ranked only with the user\'s consent and from 10 closed trades · anyone can delete their account.'],
    why: ['چرا ثبت در ربات؟ معامله‌هایی که فقط در مرورگر ثبت شوند قابل دستکاری‌اند؛ این‌جا قیمت و زمان را ربات ثبت می‌کند و کاربر نمی‌تواند آن‌ها را عوض کند.',
      'بۆچی لە بۆت؟ مامەڵەیەک کە تەنها لە وێبگەڕ تۆمار بکرێت دەستکاری دەکرێت؛ لێرە نرخ و کات بۆتەکە تۆماری دەکات.',
      'Why the bot? Trades kept only in a browser can be edited; here the bot records price and time, and the user cannot change them.'],
    upd: ['به‌روزرسانی', 'نوێکردنەوە', 'updated'], nfa: ['معاملهٔ آزمایشی است، نه پول واقعی؛ رتبهٔ بالا در گذشته تضمین آینده نیست.', 'مامەڵەی تاقیکارییە، نەک پارەی ڕاستەقینە.', 'Paper trading, not real money; a high rank in the past is no promise for the future.'],
    nodata: ['جدول هنوز ساخته نشده؛ اولین نسخه چند دقیقه بعد از اولین معامله‌ها منتشر می‌شود.', 'خشتەکە هێشتا دروست نەکراوە.', 'The table has not been published yet; the first version appears a few minutes after the first trades.']
  };
  function lang() { var l = (document.documentElement.getAttribute('lang') || 'fa').toLowerCase(); return l.indexOf('ckb') === 0 ? 'ckb' : l.indexOf('en') === 0 ? 'en' : 'fa'; }
  function t(v) { return (typeof v === 'string' ? S[v] : v)[{ fa: 0, ckb: 1, en: 2 }[lang()]]; }
  var DIG = { fa: '۰۱۲۳۴۵۶۷۸۹', ckb: '٠١٢٣٤٥٦٧٨٩' };
  function loc(s) { var d = DIG[lang()]; s = String(s); if (!d) return s; return s.replace(/[0-9]/g, function (c) { return d[+c]; }).replace(/\./g, '٫').replace(/,/g, '٬').replace(/-/g, '−'); }
  function nf(x, dec, sign) { if (x == null || !isFinite(x)) return '—'; var s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); return loc((x < 0 ? '-' : sign && x > 0 ? '+' : '') + s); }
  function pc(x, dec, sign) { return x == null ? '—' : nf(x * 100, dec == null ? 1 : dec, sign) + (lang() === 'en' ? '%' : '٪'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var D = null, W = 'd30';
  function render() {
    root.lang = lang();
    if (D === null) { root.innerHTML = '<p class="mut">' + t('load') + '</p>'; return; }
    var h = '<p><a class="sl-run" style="display:inline-block;text-decoration:none" href="' + BOT + '" target="_blank" rel="noopener">📒 ' + t('join') + '</a></p>';
    if (!D.rows) { root.innerHTML = h + '<p class="note">' + t('nodata') + '</p><p class="mut">' + t('rules') + '</p><p class="mut">' + t('why') + '</p>'; return; }
    h += '<div class="lb-tabs" role="tablist">' + ['d7', 'd30', 'd90', 'all'].map(function (w) { return '<button type="button" data-w="' + w + '" class="' + (w === W ? 'on' : '') + '">' + t(S.w[w]) + '</button>'; }).join('') + '</div>';
    var rows = D.rows[W] || [];
    if (!rows.length) h += '<p class="note">' + t('empty').replace('{n}', nf(D.min_trades)) + '</p>';
    else {
      var th = t('th').split('|');
      h += '<div class="rc-tbl"><table><thead><tr>' + th.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) {
        var md = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : nf(r.rank);
        return '<tr><td>' + md + '</td><td><b>' + esc(r.nick) + '</b></td><td class="' + (r.ret >= 0 ? 'up' : 'down') + '">' + pc(r.ret, 2, true) + '</td><td>' + (r.pnl < 0 ? loc('-') : '') + '$' + nf(Math.abs(r.pnl), 0) +
          '</td><td class="down">' + pc(r.mdd, 1) + '</td><td>' + nf(r.n) + '</td><td>' + pc(r.win, 0) + '</td><td>' + (r.sortino == null ? '—' : nf(r.sortino, 2)) + '</td><td>' + esc(r.since) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    }
    if (D.waiting) h += '<p class="mut">' + t('waiting').replace('{n}', nf(D.waiting)).replace('{k}', nf(D.min_trades)) + '</p>';
    h += '<p class="mut">' + t('rules') + '</p><p class="mut">' + t('why') + '</p><p class="mut">' + t('upd') + ': ' + esc((D.updated_at || '').slice(0, 16).replace('T', ' ')) + ' UTC · ' + t('nfa') + '</p>';
    root.innerHTML = h;
    root.querySelectorAll('[data-w]').forEach(function (b) { b.onclick = function () { W = b.getAttribute('data-w'); render(); }; });
  }
  fetch('/data/leaderboard.json?v=' + Math.floor(Date.now() / 3e5)).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) { D = j || {}; render(); }).catch(function () { D = {}; render(); });
  render();
  new MutationObserver(function () { if (root.lang !== lang()) render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
