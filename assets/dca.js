/* DCA vs lump sum — the same budget either bought at once on the first day, or split into equal buys on a schedule.
   Runs in the visitor's browser on Binance spot daily candles (data-api.binance.vision).

   Honesty rules:
   - both start with the same money; money not yet spent by DCA is counted as cash (0% return), so the two
     value curves and drawdowns compare like with like;
   - every buy happens at that day's OPEN and pays the fee; the result is valued at the last day's CLOSE;
   - one start date proves little, so "every start date" re-runs both for each possible start in the coin's history
     with the same length and schedule (a month counts as 30 days there) and reports how often DCA came out ahead;
   - only coins listed on Binance today exist here (survivorship), and the past is not a forecast. */
(function () {
  'use strict';
  var root = document.getElementById('dca');
  if (!root) return;
  var API = 'https://data-api.binance.vision/api/v3/klines', DAY = 86400000;
  var COINS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'TRX', 'AVAX', 'LINK', 'DOT', 'LTC', 'BCH', 'NEAR', 'ATOM', 'UNI',
    'ETC', 'XLM', 'FIL', 'APT', 'ARB', 'OP', 'SUI', 'INJ', 'AAVE', 'TON', 'PEPE', 'SHIB', 'FET', 'HBAR', 'ALGO', 'ICP', 'PAXG'];
  var S = {
    coin: ['ارز', 'دراو', 'Coin'], budget: ['کل بودجه (دلار)', 'کۆی بودجە (دۆلار)', 'Total budget (USD)'],
    from: ['از تاریخ', 'لە بەرواری', 'From'], to: ['تا تاریخ (خالی = امروز)', 'تا بەرواری (بەتاڵ = ئەمڕۆ)', 'To (empty = today)'],
    freq: ['هر چند وقت یک بار بخرم؟', 'هەر چەند جار جارێک بکڕم؟', 'How often to buy?'],
    d: ['روزانه', 'ڕۆژانە', 'daily'], w: ['هفتگی', 'هەفتانە', 'weekly'], w2: ['دو هفته یک بار', 'هەر دوو هەفتە', 'every two weeks'], m: ['ماهانه', 'مانگانە', 'monthly'],
    fee: ['کارمزد هر خرید ٪', 'کرێی هەر کڕینێک ٪', 'Fee per buy %'], run: ['مقایسه کن', 'بەراوردی بکە', 'Compare'],
    load: ['دریافت قیمت‌ها از بایننس…', 'وەرگرتنی نرخەکان لە بایننس…', 'Loading prices from Binance…'],
    err_net: ['دریافت داده ممکن نشد؛ اتصال را بررسی و دوباره امتحان کن.', 'وەرگرتنی داتا نەکرا؛ دووبارە هەوڵ بدەرەوە.', 'Could not load prices; check the connection and try again.'],
    err_few: ['بازه خیلی کوتاه است یا این ارز در آن تاریخ در بایننس نبود.', 'ماوەکە زۆر کورتە یان ئەم دراوە لەو بەروارەدا لە بایننس نەبوو.', 'The period is too short, or the coin was not on Binance then.'],
    lump: ['خرید یکجا', 'کڕینی یەکجار', 'Lump sum'], dca: ['خرید پلکانی (DCA)', 'کڕینی پلەپلە (DCA)', 'DCA'],
    fin: ['ارزش نهایی', 'بەهای کۆتایی', 'Final value'], ret: ['بازده', 'قازانج', 'Return'], mdd: ['بیشترین افت دارایی', 'زۆرترین داکەوتنی سامان', 'Max drawdown'],
    avg: ['میانگین قیمت خرید (با کارمزد)', 'ناوەندی نرخی کڕین (لەگەڵ کرێ)', 'Average buy price (fees included)'], n: ['تعداد خرید', 'ژمارەی کڕین', 'Buys'],
    each: ['مبلغ هر خرید', 'بڕی هەر کڕینێک', 'Each buy'], fees: ['کل کارمزد', 'کۆی کرێ', 'Total fees'],
    win_l: ['در این بازه خرید یکجا جلو بود', 'لەم ماوەیەدا کڕینی یەکجار پێشکەوت', 'In this period the lump sum came out ahead'],
    win_d: ['در این بازه خرید پلکانی جلو بود', 'لەم ماوەیەدا کڕینی پلەپلە پێشکەوت', 'In this period DCA came out ahead'],
    by: ['به اندازهٔ', 'بە ئەندازەی', 'by'],
    chart: ['ارزش دارایی (پول نقد خرج‌نشده هم حساب شده)', 'بەهای سامان (پارەی خەرجنەکراویش ژمێردراوە)', 'Portfolio value (unspent cash included)'],
    budgetL: ['بودجه', 'بودجە', 'budget'],
    roll: ['همهٔ تاریخ‌های شروع ممکن', 'هەموو بەروارە دەستپێکە گونجاوەکان', 'Every possible start date'],
    roll_lead: ['یک تاریخ شروع چیزی را ثابت نمی‌کند. همین طول دوره و همین برنامهٔ خرید برای هر روز شروع ممکن در تاریخچهٔ این ارز دوباره اجرا شد (در این بخش هر ماه ۳۰ روز حساب می‌شود).',
      'یەک بەرواری دەستپێک هیچ ناسەلمێنێت. هەمان درێژیی ماوە و هەمان بەرنامەی کڕین بۆ هەر ڕۆژێکی دەستپێکی گونجاو لە مێژووی ئەم دراوەدا دووبارە کرا (لێرە هەر مانگێک ٣٠ ڕۆژە).',
      'One start date proves nothing. The same length and buying schedule were re-run from every possible start day in this coin\'s history (a month counts as 30 days here).'],
    r_n: ['تعداد دوره‌های آزموده', 'ژمارەی ماوە تاقیکراوەکان', 'Periods tested'], r_win: ['DCA جلو بود در', 'DCA پێشکەوت لە', 'DCA ahead in'],
    r_med: ['میانهٔ اختلاف (DCA منهای یکجا)', 'ناوەندی جیاوازی (DCA کەم یەکجار)', 'Median difference (DCA − lump)'],
    r_dd: ['میانهٔ کاهش افت با DCA', 'ناوەندی کەمبوونەوەی داکەوتن بە DCA', 'Median drawdown saved by DCA'],
    r_few: ['تاریخچهٔ این ارز برای این آزمون کافی نیست (دست‌کم ۳۰ دورهٔ مستقل لازم است).', 'مێژووی ئەم دراوە بۆ ئەم تاقیکردنەوەیە بەس نییە.', 'Not enough history for this test (at least 30 periods needed).'],
    r_note: ['دوره‌ها روی هم افتاده‌اند (هر روز یک شروع تازه)، پس از هم مستقل نیستند؛ عدد را «چند بار در تاریخچه» بخوانید، نه احتمال آینده.',
      'ماوەکان یەکتر دەگرنەوە (هەر ڕۆژێک دەستپێکێکی نوێ)، بۆیە سەربەخۆ نین؛ ژمارەکە «چەند جار لە مێژوودا» بخوێنەوە، نەک ئەگەری داهاتوو.',
      'The periods overlap (a new start every day), so they are not independent: read the number as "how often in history", not as a chance for the future.'],
    share: ['اشتراک نتیجه در تلگرام', 'بڵاوکردنەوەی ئەنجام لە تێلێگرام', 'Share the result on Telegram'],
    img: ['🖼 ساخت تصویر نتیجه', '🖼 دروستکردنی وێنەی ئەنجام', '🖼 Make a result image'],
    img_dl: ['⬇ دانلود تصویر', '⬇ داگرتنی وێنە', '⬇ Download image'], img_sh: ['📤 اشتراک تصویر', '📤 هاوبەشکردنی وێنە', '📤 Share image'],
    link: ['🔗 کپی لینک همین مقایسه', '🔗 کۆپیی بەستەری ئەم بەراوردە', '🔗 Copy link to this comparison'],
    copied: ['لینک کپی شد ✓', 'بەستەر کۆپی کرا ✓', 'Link copied ✓'],
    c_title: ['خرید یکجا یا پلکانی؟', 'کڕینی یەکجار یان پلەپلە؟', 'Lump sum or DCA?'],
    c_set: ['بودجه {b} · {f} · کارمزد {fee}', 'بودجە {b} · {f} · کرێ {fee}', 'Budget {b} · {f} · fee {fee}'],
    c_note: ['دادهٔ واقعی بایننس · گذشته تضمین آینده نیست', 'داتای ڕاستەقینەی بایننس · ڕابردوو گەرەنتیی داهاتوو نییە', 'Real Binance data · the past does not guarantee the future'],
    c_try: ['خودت امتحان کن:', 'خۆت تاقی بکەرەوە:', 'Try it yourself:'],
    days: ['روز', 'ڕۆژ', 'days'],
    gn: ['پله‌های خرید زیر قیمت (۰ = خاموش)', 'پلەکانی کڕین لە خوار نرخ (٠ = کوژاوە)', 'Buy levels below price (0 = off)'],
    gs: ['فاصلهٔ پله‌ها ٪', 'دووریی پلەکان ٪', 'Level spacing %'],
    grid: ['گرید فقط خرید', 'گریدی تەنها کڕین', 'Buy-only grid'], g_fill: ['پله‌های پرشده', 'پلە پڕبووەکان', 'Levels filled'],
    g_cash: ['پول خرج‌نشده', 'پارەی خەرجنەکراو', 'Unspent cash'],
    g_note: ['بودجه بین پله‌ها مساوی تقسیم شد: اولی با قیمت باز شدن روز اول، بقیه هر کدام همین درصد پایین‌تر؛ پله وقتی پر می‌شود که کف روز به آن برسد (یا روز زیر آن باز شود). فروشی در کار نیست. پایین‌ترین پله:',
      'بودجە بە یەکسانی دابەشکرا: یەکەم بە نرخی کردنەوەی ڕۆژی یەکەم، هەر پلەیەکی تر ئەم ڕێژەیە نزمتر؛ پلە پڕ دەبێت کاتێک نزمیی ڕۆژ پێی بگات. فرۆشتن نییە. نزمترین پلە:',
      'The budget is split equally: the first level at the first day\'s open, each next one this much lower; a level fills when the day\'s low reaches it (or the day opens below it). Nothing is sold. Lowest level:']
  };
  function lang() { var l = (document.documentElement.getAttribute('lang') || 'fa').toLowerCase(); return l.indexOf('ckb') === 0 ? 'ckb' : l.indexOf('en') === 0 ? 'en' : 'fa'; }
  function t(k) { var v = S[k]; return v ? v[{ fa: 0, ckb: 1, en: 2 }[lang()]] : k; }
  var DIG = { fa: '۰۱۲۳۴۵۶۷۸۹', ckb: '٠١٢٣٤٥٦٧٨٩' };
  function loc(s) { var d = DIG[lang()]; s = String(s); if (!d) return s; return s.replace(/[0-9]/g, function (c) { return d[+c]; }).replace(/\./g, '٫').replace(/,/g, '٬').replace(/-/g, '−'); }
  function nf(x, dec, sign) { if (x == null || !isFinite(x)) return '—'; if (+Math.abs(x).toFixed(dec || 0) === 0) x = 0; var s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); return loc((x < 0 ? '-' : sign && x > 0 ? '+' : '') + s); }
  function pc(x, dec, sign) { return x == null || !isFinite(x) ? '—' : nf(x * 100, dec == null ? 1 : dec, sign) + (lang() === 'en' ? '%' : '٪'); }
  function usd(x) { return '$' + nf(x, x < 100 ? 2 : 0); }
  function px(x) { return '$' + nf(x, x < 1 ? 5 : x < 100 ? 3 : 2); }
  function g2j(gy, gm, gd) {
    var g = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], gy2 = gm > 2 ? gy + 1 : gy;
    var days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g[gm - 1];
    var jy = -1595 + 33 * Math.floor(days / 12053); days %= 12053; jy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30), jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
    return [jy, jm, jd];
  }
  function fdate(ms) {
    var d = new Date(ms), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, dd = d.getUTCDate();
    if (lang() === 'fa') { var j = g2j(y, m, dd); return loc(j[0] + '/' + String(j[1]).padStart(2, '0') + '/' + String(j[2]).padStart(2, '0')); }
    return loc(y + '-' + String(m).padStart(2, '0') + '-' + String(dd).padStart(2, '0'));
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ------------------------------------------------------------------ data */
  var KL = {};
  function klines(sym) {
    if (KL[sym]) return Promise.resolve(KL[sym]);
    var out = [], start = Date.parse('2017-08-01T00:00:00Z');
    function step() {
      return fetch(API + '?symbol=' + sym + 'USDT&interval=1d&limit=1000&startTime=' + start).then(function (r) {
        if (!r.ok) { var e = new Error('http'); e.status = r.status; throw e; } return r.json();
      }).then(function (rows) {
        rows.forEach(function (k) { out.push(k); });
        if (rows.length === 1000) { start = rows[rows.length - 1][0] + 1; return step(); }
      });
    }
    return step().then(function () {
      var now = Date.now(), D = { t: [], o: [], l: [], c: [] };
      out.forEach(function (k) { if (k[6] < now) { D.t.push(k[0]); D.o.push(+k[1]); D.l.push(+k[3]); D.c.push(+k[4]); } });
      KL[sym] = D; return D;
    });
  }

  /* ------------------------------------------------------------------ engine */
  // indexes of buy days between a and b (inclusive); monthly follows the calendar unless `flat30`
  function schedule(D, a, b, freq, flat30) {
    var out = [a], step = { d: 1, w: 7, w2: 14, m: 30 }[freq];
    if (freq === 'm' && !flat30) {
      var d0 = new Date(D.t[a]), k = 1, i = a;
      for (;;) {
        var tgt = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + k, d0.getUTCDate()); k++;
        while (i <= b && D.t[i] < tgt) i++;
        if (i > b) break; out.push(i);
      }
      return out;
    }
    for (var j = a + step; j <= b; j += step) out.push(j);
    return out;
  }
  function simulate(D, a, b, buys, budget, fee, wantCurve) {
    var f = 1 - fee / 100, amt = budget / buys.length;
    var lc = budget * f / D.o[a], dc = 0, cash = budget, bi = 0, pkL = 0, pkD = 0, ddL = 0, ddD = 0, curve = wantCurve ? [] : null;
    for (var i = a; i <= b; i++) {
      while (bi < buys.length && buys[bi] === i) { dc += amt * f / D.o[i]; cash -= amt; bi++; }
      var vL = lc * D.c[i], vD = cash + dc * D.c[i];
      if (vL > pkL) pkL = vL; if (vD > pkD) pkD = vD;
      ddL = Math.min(ddL, vL / pkL - 1); ddD = Math.min(ddD, vD / pkD - 1);
      if (curve) curve.push([D.t[i], vL, vD]);
    }
    return { lump: lc * D.c[b], dca: cash + dc * D.c[b], ddL: ddL, ddD: ddD, coinsL: lc, coinsD: dc, amt: amt, n: buys.length, curve: curve };
  }
  /* buy-only grid: the budget is split equally over `n` buy limits, the first at the start day's open and each next one
     `gap`% lower. A level fills at its price when the day's low reaches it, or at the open if the day opens below it.
     Daily candles can measure this honestly (a buy limit only needs the low); a grid that also sells could not be. */
  function grid(D, a, b, budget, fee, n, gap) {
    var f = 1 - fee / 100, amt = budget / n, p0 = D.o[a], lv = [], i, j, coins = 0, cash = budget, pk = 0, dd = 0, filled = 0, curve = [];
    for (j = 0; j < n; j++) lv.push(p0 * Math.pow(1 - gap / 100, j));
    var done = lv.map(function () { return false; });
    for (i = a; i <= b; i++) {
      for (j = 0; j < n; j++) {
        if (done[j]) continue;
        var fillPx = D.o[i] <= lv[j] ? D.o[i] : D.l[i] <= lv[j] ? lv[j] : null;
        if (fillPx) { coins += amt * f / fillPx; cash -= amt; done[j] = true; filled++; }
      }
      var v = cash + coins * D.c[i]; if (v > pk) pk = v; dd = Math.min(dd, v / pk - 1); curve.push(v);
    }
    return { val: cash + coins * D.c[b], dd: dd, coins: coins, filled: filled, n: n, spent: budget - cash, cash: cash, curve: curve, low: lv[n - 1] };
  }
  function rolling(D, len, freq, budget, fee) {
    var n = D.t.length, res = [];
    for (var s = 0; s + len < n; s++) {
      var r = simulate(D, s, s + len, schedule(D, s, s + len, freq, true), budget, fee, false);
      res.push([r.dca / r.lump - 1, r.ddD - r.ddL]);
    }
    return res;
  }
  function med(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  /* ------------------------------------------------------------------ UI */
  var ST = { coin: 'BTC', budget: 1000, from: '2022-01-01', to: '', freq: 'w', fee: 0.1, gn: 5, gs: 5 };
  try { var q = new URLSearchParams(location.search); ['coin', 'from', 'to', 'freq'].forEach(function (k) { if (q.get(k)) ST[k] = q.get(k); }); ['budget', 'fee', 'gn', 'gs'].forEach(function (k) { if (q.get(k) && isFinite(+q.get(k))) ST[k] = +q.get(k); }); } catch (e) { }
  if (COINS.indexOf(ST.coin) < 0) ST.coin = 'BTC'; if (!{ d: 1, w: 1, w2: 1, m: 1 }[ST.freq]) ST.freq = 'w';
  var LAST = null, BUSY = false;
  function sel(id, opts, v) { return '<select id="' + id + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
  function render() {
    root.lang = lang();
    var h = '<div class="sl-row">' +
      '<label>' + t('coin') + sel('dc-coin', COINS.map(function (c) { return [c, c]; }), ST.coin) + '</label>' +
      '<label>' + t('budget') + '<input id="dc-budget" type="number" min="10" step="any" value="' + ST.budget + '" style="width:110px"></label>' +
      '<label>' + t('from') + '<input id="dc-from" type="date" value="' + esc(ST.from) + '" min="2017-08-17"></label>' +
      '<label>' + t('to') + '<input id="dc-to" type="date" value="' + esc(ST.to) + '"></label>' +
      '<label>' + t('freq') + sel('dc-freq', [['d', t('d')], ['w', t('w')], ['w2', t('w2')], ['m', t('m')]], ST.freq) + '</label>' +
      '<label>' + t('fee') + '<input id="dc-fee" type="number" min="0" max="5" step="any" value="' + ST.fee + '" style="width:80px"></label>' +
      '<label>' + t('gn') + '<input id="dc-gn" type="number" min="0" max="30" step="1" value="' + ST.gn + '" style="width:70px"></label>' +
      '<label>' + t('gs') + '<input id="dc-gs" type="number" min="0.5" max="50" step="any" value="' + ST.gs + '" style="width:70px"></label>' +
      '<button type="button" class="sl-run" id="dc-run">' + t('run') + '</button><span class="mut" id="dc-msg"></span></div><div id="dc-out"></div>';
    root.innerHTML = h;
    root.querySelector('#dc-run').onclick = run;
    if (LAST) show(LAST);
  }
  function msg(s) { var m = root.querySelector('#dc-msg'); if (m) m.textContent = s || ''; }
  function read() {
    ST.coin = root.querySelector('#dc-coin').value; ST.budget = Math.max(10, +root.querySelector('#dc-budget').value || 1000);
    ST.from = root.querySelector('#dc-from').value || '2022-01-01'; ST.to = root.querySelector('#dc-to').value || '';
    ST.freq = root.querySelector('#dc-freq').value; ST.fee = Math.min(5, Math.max(0, +root.querySelector('#dc-fee').value || 0));
    ST.gn = Math.min(30, Math.max(0, Math.round(+root.querySelector('#dc-gn').value || 0))); ST.gs = Math.min(50, Math.max(0.5, +root.querySelector('#dc-gs').value || 5));
  }
  function run() {
    if (BUSY) return; read(); BUSY = true; msg(t('load'));
    var st = JSON.parse(JSON.stringify(ST));
    klines(st.coin).then(function (D) {
      var from = Date.parse(st.from + 'T00:00:00Z'), to = st.to ? Date.parse(st.to + 'T00:00:00Z') : Infinity, a = 0, b = D.t.length - 1;
      while (a < D.t.length && D.t[a] < from) a++;
      while (b > a && D.t[b] > to) b--;
      if (b - a < 14) { msg(t('err_few')); return; }
      var r = simulate(D, a, b, schedule(D, a, b, st.freq, false), st.budget, st.fee, true);
      var R = rolling(D, b - a, st.freq, st.budget, st.fee), G = st.gn > 0 ? grid(D, a, b, st.budget, st.fee, st.gn, st.gs) : null;
      LAST = { st: st, D: D, a: a, b: b, r: r, roll: R, g: G };
      try { history.replaceState(null, '', '?' + new URLSearchParams({ coin: st.coin, budget: st.budget, from: st.from, to: st.to, freq: st.freq, fee: st.fee, gn: st.gn, gs: st.gs }).toString()); } catch (e) { }
      msg(''); show(LAST);
    }).catch(function (e) { msg(e && e.status === 400 ? t('err_few') : t('err_net')); }).then(function () { BUSY = false; });
  }
  function kpi(l, v, cls) { return '<div class="rc-kpi"><small>' + l + '</small><b class="' + (cls || '') + '">' + v + '</b></div>'; }
  function cl(x) { return x > 0 ? 'up' : x < 0 ? 'down' : ''; }
  function show(X) {
    var out = root.querySelector('#dc-out'); if (!out) return;
    var r = X.r, st = X.st, D = X.D, B = st.budget, rL = r.lump / B - 1, rD = r.dca / B - 1, f = st.fee / 100;
    var dcaWins = r.dca > r.lump, diff = dcaWins ? r.dca / r.lump - 1 : r.lump / r.dca - 1;
    var h = '<section class="rc-sec"><h2><span dir="ltr">' + esc(st.coin) + '</span> · ' + fdate(D.t[X.a]) + ' – ' + fdate(D.t[X.b]) + ' · ' + nf(X.b - X.a + 1) + ' ' + t('days') + '</h2>';
    h += '<p class="' + (dcaWins ? 'up' : '') + '"><b>' + t(dcaWins ? 'win_d' : 'win_l') + ' ' + t('by') + ' ' + pc(diff, 1) + '.</b></p>';
    h += '<div class="dc-cols"><div><h3>' + t('lump') + '</h3><div class="rc-kpis">' + kpi(t('fin'), usd(r.lump)) + kpi(t('ret'), pc(rL, 1, true), cl(rL)) + kpi(t('mdd'), pc(r.ddL, 1), 'down') +
      kpi(t('avg'), px(B / r.coinsL)) + kpi(t('n'), nf(1)) + kpi(t('fees'), usd(B * f)) + '</div></div>';
    h += '<div><h3>' + t('dca') + '</h3><div class="rc-kpis">' + kpi(t('fin'), usd(r.dca)) + kpi(t('ret'), pc(rD, 1, true), cl(rD)) + kpi(t('mdd'), pc(r.ddD, 1), 'down') +
      kpi(t('avg'), px(B / r.coinsD)) + kpi(t('n'), nf(r.n)) + kpi(t('each'), usd(r.amt)) + '</div></div>';
    if (X.g) { var G = X.g, rG = G.val / B - 1;
      h += '<div><h3>' + t('grid') + '</h3><div class="rc-kpis">' + kpi(t('fin'), usd(G.val)) + kpi(t('ret'), pc(rG, 1, true), cl(rG)) + kpi(t('mdd'), pc(G.dd, 1), 'down') +
        kpi(t('avg'), G.coins ? px(G.spent / G.coins) : '—') + kpi(t('g_fill'), nf(G.filled) + ' / ' + nf(G.n)) + kpi(t('g_cash'), usd(G.cash)) + '</div><p class="mut">' + t('g_note') + ' ' + px(G.low) + '.</p></div>'; }
    h += '</div>';
    h += '<h3>' + t('chart') + '</h3><div class="rc-legend"><span><i style="background:#64748b"></i>' + t('lump') + '</span><span><i style="background:#f59e0b"></i>' + t('dca') + '</span>' + (X.g ? '<span><i style="background:#a855f7"></i>' + t('grid') + '</span>' : '') + '<span><i style="background:#ffffff40"></i>' + t('budgetL') + '</span></div><div id="dc-chart" class="rc-chart" style="height:300px"></div>';
    var txt = st.coin + ' · ' + fdate(D.t[X.a]) + ' – ' + fdate(D.t[X.b]) + '\n' + t('lump') + ': ' + pc(rL, 1, true) + ' · ' + t('dca') + ' (' + t(st.freq) + '): ' + pc(rD, 1, true) + '\n— entekhab.net';
    h += '<p class="dc-share"><a class="rc-btn2" target="_blank" rel="noopener" href="https://t.me/share/url?url=' + encodeURIComponent(location.href) + '&text=' + encodeURIComponent(txt) + '">📤 ' + t('share') + '</a> ' +
      '<button class="rc-btn2" type="button" id="dc-img">' + t('img') + '</button> <button class="rc-btn2" type="button" id="dc-link">' + t('link') + '</button> <span id="dc-cp" class="mut"></span></p><div id="dc-card"></div></section>';
    // every possible start date
    h += '<section class="rc-sec"><h2>' + t('roll') + '</h2><p class="rc-lead">' + t('roll_lead') + '</p>';
    var R = X.roll;
    if (R.length < 30) h += '<p class="note">' + t('r_few') + '</p>';
    else {
      var w = R.filter(function (x) { return x[0] > 0; }).length / R.length, md = med(R.map(function (x) { return x[0]; })), mdd = med(R.map(function (x) { return x[1]; }));
      h += '<div class="rc-kpis">' + kpi(t('r_n'), nf(R.length)) + kpi(t('r_win'), pc(w, 0), w >= 0.5 ? 'up' : '') + kpi(t('r_med'), pc(md, 1, true), cl(md)) + kpi(t('r_dd'), pc(mdd, 1, true), cl(mdd)) + '</div>' +
        '<p class="mut">' + t('r_note') + '</p>';
    }
    h += '</section>';
    out.innerHTML = h;
    draw(X);
    var bi = out.querySelector('#dc-img'); if (bi) bi.onclick = function () { card(X); };
    var bl = out.querySelector('#dc-link'); if (bl) bl.onclick = function () {
      var u = location.href, ok = function () { var m = out.querySelector('#dc-cp'); if (m) m.textContent = t('copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(ok, function () { prompt('', u); });
      else prompt('', u);
    };
  }
  /* the shareable result card: 1080×1350 (fits Instagram and Telegram), drawn from the same numbers as the page */
  function card(X) {
    var box = root.querySelector('#dc-card'); if (!box) return;
    var L = lang(), rtl = L !== 'en', W = 1080, H = 1350, P = 70;
    var FF = rtl ? 'Vazirmatn,Tahoma,sans-serif' : '"Space Grotesk",Vazirmatn,sans-serif', NUM = '"Space Grotesk",Vazirmatn,sans-serif';
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d');
    var r = X.r, st = X.st, D = X.D, B = st.budget;
    var rows = [[t('lump'), r.lump, '#94a3b8', r.curve.map(function (p) { return p[1]; })], [t('dca') + ' · ' + t(st.freq), r.dca, '#f59e0b', r.curve.map(function (p) { return p[2]; })]];
    if (X.g) rows.push([t('grid'), X.g.val, '#a855f7', X.g.curve]);
    var best = rows.reduce(function (a, b) { return b[1] > a[1] ? b : a; });
    function txt(s, X0, y, font, col, align, dir) { x.font = font; x.fillStyle = col; x.direction = dir || (rtl ? 'rtl' : 'ltr'); x.textAlign = align || (rtl ? 'right' : 'left'); x.fillText(s, X0, y); }
    var S0 = rtl ? W - P : P, E0 = rtl ? P : W - P;
    function go(logo) {
      var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1a1006'); g.addColorStop(.55, '#0b0c0f'); g.addColorStop(1, '#071018');
      x.fillStyle = g; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(247,147,26,.55)'; x.lineWidth = 4; x.strokeRect(24, 24, W - 48, H - 48);
      if (logo) { var lh = 96, lw = logo.width * lh / logo.height; x.drawImage(logo, rtl ? W - P - lw : P, 58, lw, lh); }
      txt('entekhab.net/dca', E0, 118, '700 30px ' + NUM, '#f7931a', rtl ? 'left' : 'right', 'ltr');
      txt(t('c_title'), S0, 232, '800 58px ' + FF, '#ffffff');
      txt(st.coin + '  ·  ' + fdate(D.t[X.a]) + ' – ' + fdate(D.t[X.b]), S0, 292, '500 32px ' + FF, '#cfcfcf');
      txt('🏆 ' + best[0], S0, 372, '800 40px ' + FF, best[2]);
      // result rows
      var y = 430, maxV = Math.max.apply(null, rows.map(function (q) { return q[1]; }).concat([B]));
      rows.forEach(function (q) {
        var ret = q[1] / B - 1;
        x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(P, y, W - 2 * P, 112);
        x.fillStyle = q[2]; x.fillRect(rtl ? W - P - 10 : P, y, 10, 112);
        txt(q[0], rtl ? W - P - 34 : P + 34, y + 48, '700 34px ' + FF, '#ffffff');
        txt(usd(q[1]), rtl ? W - P - 34 : P + 34, y + 92, '500 28px ' + NUM, '#bdbdbd');
        txt(pc(ret, 1, true), rtl ? P + 30 : W - P - 30, y + 74, '800 52px ' + NUM, ret >= 0 ? '#22c55e' : '#ef4444', rtl ? 'left' : 'right');
        var bw = (W - 2 * P - 68) * Math.max(0, q[1]) / maxV; x.fillStyle = q[2] + '55'; x.fillRect(rtl ? W - P - 34 - bw : P + 34, y + 102, bw, 5);
        y += 130;
      });
      // value chart
      var cy = y + 20, ch = 1150 - cy, all = [];
      rows.forEach(function (q) { all = all.concat(q[3]); }); all.push(B);
      var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), n = rows[0][3].length;
      if (hi - lo < 1e-9) hi = lo + 1;
      var X0 = P, Wc = W - 2 * P, Y = function (v) { return cy + ch - (v - lo) / (hi - lo) * ch; };
      x.strokeStyle = 'rgba(255,255,255,.25)'; x.setLineDash([8, 8]); x.lineWidth = 2; x.beginPath(); x.moveTo(X0, Y(B)); x.lineTo(X0 + Wc, Y(B)); x.stroke(); x.setLineDash([]);
      rows.forEach(function (q) {
        x.strokeStyle = q[2]; x.lineWidth = 4; x.beginPath();
        q[3].forEach(function (v, i) { var px_ = X0 + Wc * (n > 1 ? i / (n - 1) : 0); if (i) x.lineTo(px_, Y(v)); else x.moveTo(px_, Y(v)); }); x.stroke();
      });
      txt(t('budgetL') + ' ' + usd(B), S0, Y(B) - 12, '500 24px ' + FF, 'rgba(255,255,255,.55)');
      txt(t('c_set').replace('{b}', usd(B)).replace('{f}', t(st.freq)).replace('{fee}', pc(st.fee / 100, 2)), S0, 1215, '500 28px ' + FF, '#cfcfcf');
      txt(t('c_note'), S0, 1262, '400 24px ' + FF, '#8a8a85');
      txt(t('c_try') + ' entekhab.net/dca', S0, 1302, '700 26px ' + FF, '#f7931a');
      cv.style.cssText = 'width:100%;max-width:420px;height:auto;border-radius:12px;margin-top:10px;display:block';
      box.innerHTML = ''; box.appendChild(cv);
      var name = 'entekhab-dca-' + st.coin + '.png', p = document.createElement('p');
      var a = document.createElement('a'); a.className = 'rc-btn2'; a.download = name; a.href = cv.toDataURL('image/png'); a.textContent = t('img_dl'); p.appendChild(a);
      if (navigator.canShare && window.File && cv.toBlob) cv.toBlob(function (bl) {
        try { var f = new File([bl], name, { type: 'image/png' }); if (!navigator.canShare({ files: [f] })) return;
          var b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'rc-btn2'; b2.textContent = t('img_sh'); b2.style.marginInlineStart = '8px';
          b2.onclick = function () { navigator.share({ files: [f], text: t('c_try') + ' ' + location.href }).catch(function () { }); }; p.appendChild(b2);
        } catch (e) { }
      });
      box.appendChild(p);
    }
    var ready = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 40px Vazirmatn'), document.fonts.load('700 30px "Space Grotesk"')]).catch(function () { }) : Promise.resolve();
    ready.then(function () { var im = new Image(); im.onload = function () { go(im); }; im.onerror = function () { go(null); }; im.src = '/assets/logo-hero.webp'; });
  }
  function draw(X) {
    var el = document.getElementById('dc-chart'); if (!el || !window.LightweightCharts) return;
    var c = LightweightCharts.createChart(el, { height: 300, layout: { background: { color: 'transparent' }, textColor: '#9a9a94', fontFamily: 'Vazirmatn' },
      grid: { vertLines: { color: '#ffffff0d' }, horzLines: { color: '#ffffff0d' } }, rightPriceScale: { borderColor: '#ffffff1a' }, timeScale: { borderColor: '#ffffff1a' },
      localization: { priceFormatter: function (p) { return '$' + nf(p, 0); } } });
    var sec = function (ms) { return Math.floor(ms / 1000); }, cv = X.r.curve;
    var bud = c.addLineSeries({ color: '#ffffff40', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    var l = c.addLineSeries({ color: '#64748b', lineWidth: 2, priceLineVisible: false });
    var d = c.addLineSeries({ color: '#f59e0b', lineWidth: 2, priceLineVisible: false });
    bud.setData(cv.map(function (p) { return { time: sec(p[0]), value: X.st.budget }; }));
    l.setData(cv.map(function (p) { return { time: sec(p[0]), value: p[1] }; }));
    d.setData(cv.map(function (p) { return { time: sec(p[0]), value: p[2] }; }));
    if (X.g) { var g = c.addLineSeries({ color: '#a855f7', lineWidth: 2, priceLineVisible: false }); g.setData(cv.map(function (p, i) { return { time: sec(p[0]), value: X.g.curve[i] }; })); }
    c.timeScale().fitContent();
    new ResizeObserver(function () { c.applyOptions({ width: el.clientWidth }); }).observe(el);
  }
  render();
  new MutationObserver(function () { if (root.lang !== lang()) render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  // a shared link runs straight away
  if (location.search.indexOf('coin=') >= 0) run();
})();
