/* /derivatives/ — leverage pressure for BTC, ETH and SOL, from /data/derivatives.json (OKX public API, every ~15 min).
   Four cards per coin (funding, open interest, liquidations, long/short), each with a plain-language reading,
   small 7-day / 72-hour charts, market-wide extremes and a "send to roundtable" link. Nothing is guessed:
   a value the data does not have is shown as "—", and windows are stated as they really are. */
(function () {
  'use strict';
  var root = document.getElementById('dv');
  if (!root) return;
  var COINS = ['BTC', 'ETH', 'SOL'], EXT = 0.05, HIGH = 0.02;   // funding %/8h: ≥0.05 extreme, ≥0.02 high (0.01 is the usual base rate)
  var S = {
    load: ['دریافت داده…', 'وەرگرتنی داتا…', 'Loading…'], nodata: ['دادهٔ مشتقات فعلاً در دسترس نیست.', 'داتای دەرهاتەکان ئێستا بەردەست نییە.', 'Derivatives data is not available right now.'],
    fund: ['نرخ فاندینگ', 'ڕێژەی فەندینگ', 'Funding rate'], per8: ['در هر ۸ ساعت', 'لە هەر ٨ کاتژمێرێکدا', 'per 8 hours'], apr: ['سالانه', 'ساڵانە', 'a year'],
    avg7: ['میانگین ۷ روز', 'تێکڕای ٧ ڕۆژ', '7-day average'],
    f_ext: ['افراطی', 'زۆر توند', 'extreme'], f_high: ['بالا', 'بەرز', 'high'], f_norm: ['عادی', 'ئاسایی', 'normal'], f_neg: ['منفی', 'نەرێنی', 'negative'],
    f_pos_x: ['فاندینگ مثبت یعنی لانگ‌ها به شورت‌ها کارمزد می‌دهند: تقاضای خرید اهرمی بیشتر است. هرچه بالاتر، شلوغ‌تر شدن طرف خرید و خطر تصفیهٔ زنجیره‌ای لانگ‌ها بیشتر.',
      'فەندینگی ئەرێنی واتە لۆنگەکان کرێ دەدەن بە شۆرتەکان: داواکاریی کڕینی بە لیڤەرێج زیاترە. هەتا بەرزتر، قەرەباڵغیی لای کڕین و مەترسیی لیکویدی زنجیرەیی زیاتر.',
      'Positive funding means longs pay shorts: leveraged buying demand is larger. The higher it is, the more crowded the long side and the bigger the risk of a cascade of long liquidations.'],
    f_neg_x: ['فاندینگ منفی یعنی شورت‌ها به لانگ‌ها کارمزد می‌دهند: فروش اهرمی شلوغ‌تر است و یک جهش قیمت می‌تواند شورت‌ها را مجبور به بستن کند.',
      'فەندینگی نەرێنی واتە شۆرتەکان کرێ دەدەن بە لۆنگەکان: فرۆشتنی بە لیڤەرێج قەرەباڵغترە و بەرزبوونەوەیەک دەتوانێت شۆرتەکان ناچار بە داخستن بکات.',
      'Negative funding means shorts pay longs: leveraged selling is more crowded, and a price jump can force shorts to close.'],
    oi: ['اوپن اینترست', 'ئۆپن ئینتەرێست', 'Open interest'], oi_sw: ['قرارداد دائمی USDT', 'گرێبەستی هەمیشەیی USDT', 'USDT perpetual'],
    ch24: ['تغییر ۲۴ ساعت (همهٔ قراردادهای OKX)', 'گۆڕانی ٢٤ کاتژمێر (هەموو گرێبەستەکانی OKX)', '24-hour change (all OKX contracts)'],
    vs7: ['نسبت به میانگین ۷ روز', 'بەراورد بە تێکڕای ٧ ڕۆژ', 'vs 7-day average'],
    oi_x: ['اوپن اینترست مجموع قراردادهای باز است. افزایش آن همراه با افزایش قیمت یعنی پول تازهٔ اهرمی وارد شده؛ افزایش همراه با افت قیمت یعنی شورت‌های تازه. کاهش تند معمولاً یعنی بستن یا تصفیهٔ پوزیشن‌ها.',
      'ئۆپن ئینتەرێست کۆی گرێبەستە کراوەکانە. زیادبوونی لەگەڵ بەرزبوونی نرخ واتە پارەی نوێی لیڤەرێج هاتووە؛ لەگەڵ دابەزینی نرخ واتە شۆرتی نوێ. کەمبوونی خێرا زۆرجار واتە داخستن یان لیکویدکردنی پۆزیشنەکان.',
      'Open interest is the total of open contracts. Rising with price means fresh leveraged money; rising while price falls means new shorts. A sharp drop usually means positions being closed or liquidated.'],
    liq: ['لیکوییدیشن (تصفیهٔ اجباری)', 'لیکویدکردن', 'Liquidations'], long: ['لانگ', 'لۆنگ', 'longs'], short: ['شورت', 'شۆرت', 'shorts'],
    l24: ['۲۴ ساعت گذشته', '٢٤ کاتژمێری ڕابردوو', 'last 24 hours'], lh: ['ساعت گذشته', 'کاتژمێری ڕابردوو', 'hours back'],
    lpart: ['هنوز ۲۴ ساعت کامل ثبت نشده', 'هێشتا ٢٤ کاتژمێری تەواو تۆمار نەکراوە', 'a full 24 hours not recorded yet'],
    liq_x: ['وقتی وثیقهٔ یک پوزیشن اهرمی تمام می‌شود، صرافی آن را به‌زور می‌بندد. لیکوییدیشن بزرگ لانگ یعنی ریزش، معامله‌گران خوش‌بین را بیرون انداخته؛ بزرگ شورت یعنی جهش، بدبین‌ها را.',
      'کاتێک بارمتەی پۆزیشنێکی لیڤەرێج تەواو دەبێت، ئاڵوگۆڕخانە بە زۆر دایدەخات. لیکویدی گەورەی لۆنگ واتە دابەزین گەشبینەکانی دەرکرد؛ گەورەی شۆرت واتە بەرزبوونەوە ڕەشبینەکانی.',
      'When a leveraged position runs out of margin the exchange closes it by force. Large long liquidations mean a drop flushed out the optimists; large short liquidations mean a jump flushed out the pessimists.'],
    ls: ['نسبت لانگ به شورت (حساب‌ها)', 'ڕێژەی لۆنگ بۆ شۆرت (هەژمارەکان)', 'Long/short ratio (accounts)'],
    ls_x: ['این نسبت تعداد حساب‌هایی است که لانگ‌اند به حساب‌هایی که شورت‌اند، نه حجم پول. نسبت خیلی بالا یعنی جمعیت خرده‌معامله‌گر یک‌طرفه شده؛ این خودش شاهد جهت نیست.',
      'ئەم ڕێژەیە ژمارەی هەژمارە لۆنگەکانە بەرامبەر شۆرتەکان، نەک قەبارەی پارە. ڕێژەی زۆر بەرز واتە بازرگانە بچووکەکان یەکلایەنە بوون؛ ئەمە خۆی بەڵگەی ئاراستە نییە.',
      'This counts accounts that are long versus short, not money. A very high ratio means the retail crowd is one-sided; that by itself is not evidence of direction.'],
    longs: ['حساب‌های لانگ', 'هەژمارە لۆنگەکان', 'accounts long'],
    c_oi: ['اوپن اینترست، ۷۲ ساعت', 'ئۆپن ئینتەرێست، ٧٢ کاتژمێر', 'Open interest, 72 hours'], c_ls: ['نسبت لانگ/شورت، ۴۸ ساعت', 'ڕێژەی لۆنگ/شۆرت، ٤٨ کاتژمێر', 'Long/short ratio, 48 hours'],
    c_f: ['فاندینگ ساعتی ثبت‌شده، ۷ روز', 'فەندینگی تۆمارکراو، ٧ ڕۆژ', 'Recorded funding, 7 days'],
    mkt: ['کل بازار قراردادهای دائمی', 'هەموو بازاڕی گرێبەستە هەمیشەییەکان', 'The whole perpetual market'], tot: ['کل اوپن اینترست', 'کۆی ئۆپن ئینتەرێست', 'Total open interest'],
    wf: ['فاندینگ وزنی (بر اساس OI)', 'فەندینگی کێشدار', 'OI-weighted funding'], hot: ['گرم‌ترین فاندینگ', 'گەرمترین فەندینگ', 'Hottest funding'],
    cold: ['سردترین فاندینگ', 'ساردترین فەندینگ', 'Coldest funding'],
    rt: ['ارسال به میزگرد', 'ناردن بۆ میزگرد', 'Send to the roundtable'], rtQ: ['با این وضعیت اهرم، ریسک کدام طرف بیشتر است؟', 'بەم دۆخی لیڤەرێجە، مەترسیی کام لا زیاترە؟', 'With leverage like this, which side carries more risk?'],
    rtO: ['لانگ‌ها / شورت‌ها / هیچ‌کدام', 'لۆنگەکان / شۆرتەکان / هیچیان', 'Longs / shorts / neither'],
    src: ['منبع: API عمومی OKX، هر حدود ۱۵ دقیقه', 'سەرچاوە: API گشتیی OKX، نزیکەی هەر ١٥ خولەک', 'Source: OKX public API, about every 15 minutes'],
    upd: ['به‌روزرسانی', 'نوێکردنەوە', 'updated'], ago: ['پیش', 'لەمەوبەر', 'ago'], min: ['دقیقه', 'خولەک', 'min'], hr: ['ساعت', 'کاتژمێر', 'h'],
    rg_t: ['🧭 در رژیم فعلی بازار یعنی چه؟', '🧭 لە دۆخی ئێستای بازاڕدا واتای چییە؟', '🧭 What it means in the current regime'],
    rg_more: ['رادار رژیم ←', 'ڕاداری دۆخ ←', 'Regime radar →'],
    stale: ['⚠️ این داده بیش از ۳ ساعت است تازه نشده.', '⚠️ ئەم داتایە زیاتر لە ٣ کاتژمێرە نوێ نەکراوەتەوە.', '⚠️ This data has not been refreshed for over 3 hours.'],
    nfa: ['این صفحه وضعیت را توصیف می‌کند، پیش‌بینی نمی‌کند و توصیهٔ مالی نیست.', 'ئەم پەڕەیە دۆخەکە وەسف دەکات، پێشبینی ناکات و ئامۆژگاریی دارایی نییە.', 'This page describes the state of the market; it is not a forecast and not financial advice.']
  };
  function lang() { var l = (document.documentElement.getAttribute('lang') || 'fa').toLowerCase(); return l.indexOf('ckb') === 0 ? 'ckb' : l.indexOf('en') === 0 ? 'en' : 'fa'; }
  function t(k) { var v = S[k]; return v ? v[{ fa: 0, ckb: 1, en: 2 }[lang()]] : k; }
  var DIG = { fa: '۰۱۲۳۴۵۶۷۸۹', ckb: '٠١٢٣٤٥٦٧٨٩' };
  function loc(s) { var d = DIG[lang()]; s = String(s); if (!d) return s; return s.replace(/[0-9]/g, function (c) { return d[+c]; }).replace(/\./g, '٫').replace(/,/g, '٬').replace(/-/g, '−'); }
  function nf(x, dec, sign) { if (x == null || !isFinite(x)) return '—'; if (+Math.abs(x).toFixed(dec || 0) === 0) x = 0; var s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); return loc((x < 0 ? '-' : sign && x > 0 ? '+' : '') + s); }
  function pct(x, dec, sign) { return x == null || !isFinite(x) ? '—' : nf(x, dec == null ? 1 : dec, sign) + (lang() === 'en' ? '%' : '٪'); }
  function usd(v) { if (v == null || !isFinite(v)) return '—'; var a = Math.abs(v); return (v < 0 ? '-' : '') + '$' + (a >= 1e9 ? nf(a / 1e9, 2) + 'B' : a >= 1e6 ? nf(a / 1e6, 1) + 'M' : a >= 1e3 ? nf(a / 1e3, 0) + 'K' : nf(a, 0)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ago(iso) { var m = Math.max(0, (Date.now() - Date.parse(iso)) / 6e4); return m < 90 ? nf(m) + ' ' + t('min') + ' ' + t('ago') : nf(m / 60) + ' ' + t('hr') + ' ' + t('ago'); }
  // a "7-day average" only when the hourly history really reaches back about a week for this field; per-coin funding
  // and SOL OI started being recorded on 2026-11-10, so for a while there is less than that and nothing is shown
  function mean7(hist, key) {
    var have = hist.filter(function (r) { return r[key] != null && isFinite(r[key]); });
    if (!have.length || Date.now() / 1000 - have[0].t < 6.5 * 86400) return null;
    return mean(have.map(function (r) { return r[key]; }));
  }
  function mean(a) { a = a.filter(function (x) { return x != null && isFinite(x); }); return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
  function spark(vals, W, H, col, fill) {
    vals = vals.filter(function (v) { return v != null && isFinite(v); }); if (vals.length < 2) return '';
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), r = mx - mn || 1;
    var pts = vals.map(function (v, i) { return (i / (vals.length - 1) * W).toFixed(1) + ',' + (H - 3 - (v - mn) / r * (H - 6)).toFixed(1); });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dv-sp" preserveAspectRatio="none">' + (fill ? '<polygon points="0,' + H + ' ' + pts.join(' ') + ' ' + W + ',' + H + '" fill="' + fill + '"/>' : '') +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + col + '" stroke-width="1.6"/></svg>';
  }

  var D = null, CUR = 'BTC';
  try { var h = (location.hash || '').slice(1).toUpperCase(); if (COINS.indexOf(h) >= 0) CUR = h; } catch (e) { }
  function card(title, big, sub, extra, expl, cls) {
    return '<div class="dv-c"><small>' + title + '</small><b class="' + (cls || '') + '">' + big + '</b>' + (sub ? '<em>' + sub + '</em>' : '') + (extra || '') + '<p>' + expl + '</p></div>';
  }
  function render() {
    root.lang = lang();
    if (!D) { root.innerHTML = '<p class="mut">' + t('load') + '</p>'; return; }
    if (!D.swaps) { root.innerHTML = '<p class="note">' + t('nodata') + '</p>'; return; }
    var x = D[CUR] || {}, k = CUR.toLowerCase(), hist = (D.history || []).filter(function (r) { return r.t >= Date.now() / 1000 - 7 * 86400; });
    var h = '<div class="dv-tabs" role="tablist">' + COINS.map(function (c) { return '<button type="button" role="tab" aria-selected="' + (c === CUR) + '" data-c="' + c + '" class="' + (c === CUR ? 'on' : '') + '">' + c + '</button>'; }).join('') + '</div>';
    if ((Date.now() - Date.parse(D.updated_at)) / 36e5 > 3) h += '<p class="note">' + t('stale') + '</p>';
    var rr = (D.regime_read || {})[CUR];
    if (rr && rr[lang()]) h += '<div class="dv-rg dv-rg-' + esc(rr.regime) + '"><h3>' + t('rg_t') + '</h3><p>' + esc(rr[lang()]) + '</p><a href="/regime/">' + t('rg_more') + '</a></div>';
    // funding
    var f = x.funding, lab = f == null ? '' : f < 0 ? 'f_neg' : f >= EXT ? 'f_ext' : f >= HIGH ? 'f_high' : 'f_norm', f7 = mean7(hist, k + '_f');
    var fcls = f == null ? '' : f >= EXT ? 'down' : f < 0 ? 'up' : '';
    h += '<div class="dv-grid">' + card(t('fund'), pct(f, 4, true) + (lab ? ' <span class="dv-tag ' + lab + '">' + t(lab) + '</span>' : ''),
      t('per8') + ' · ' + pct(x.funding_ann, 1, true) + ' ' + t('apr') + (f7 != null ? ' · ' + t('avg7') + ' ' + pct(f7, 4, true) : ''),
      spark(hist.map(function (r) { return r[k + '_f']; }), 300, 46, '#f59e0b'), t(f != null && f < 0 ? 'f_neg_x' : 'f_pos_x'), fcls);
    // open interest
    var oh = x.oi_hist || [], ch = null, chAbs = null;
    if (oh.length >= 25) { var a = oh[oh.length - 25][1], b = oh[oh.length - 1][1]; if (a) { ch = (b / a - 1) * 100; chAbs = b - a; } }
    var o7 = mean7(hist, k + '_oi'), vs = o7 && x.oi_usd ? (x.oi_usd / o7 - 1) * 100 : null;
    h += card(t('oi'), usd(x.oi_usd), t('oi_sw'),
      '<div class="dv-row"><span>' + t('ch24') + '</span><b class="' + (ch == null ? '' : ch >= 0 ? 'up' : 'down') + '">' + (ch == null ? '—' : (ch >= 0 ? '▲ ' : '▼ ') + pct(ch, 1, true) + ' (' + (chAbs >= 0 ? '+' : '') + usd(chAbs) + ')') + '</b></div>' +
      (vs != null ? '<div class="dv-row"><span>' + t('vs7') + '</span><b>' + pct(vs, 1, true) + '</b></div>' : ''), t('oi_x'));
    // liquidations
    var lq = x.liq || {}, L24 = lq.long_usd_24h, S24 = lq.short_usd_24h, has24 = L24 != null;
    var lv = has24 ? L24 : lq.long_usd, sv = has24 ? S24 : lq.short_usd, tot = (lv || 0) + (sv || 0);
    var full = has24 && lq.since && (Date.now() - lq.since) >= 23 * 36e5;
    var from = has24 ? lq.since : lq.from, hrs = from ? (Date.now() - from) / 36e5 : null;
    var win = full ? t('l24') : hrs != null ? nf(Math.max(1, Math.round(hrs))) + ' ' + t('lh') + ' (' + t('lpart') + ')' : '';
    h += card(t('liq'), usd(tot), win,
      tot ? '<div class="dv-bar"><i class="dv-l" style="width:' + (100 * (lv || 0) / tot).toFixed(1) + '%"></i><i class="dv-s" style="width:' + (100 * (sv || 0) / tot).toFixed(1) + '%"></i></div><div class="dv-row"><span>🔴 ' + t('long') + ' ' + usd(lv) + '</span><span>🟢 ' + t('short') + ' ' + usd(sv) + '</span></div>' : '',
      t('liq_x'));
    // long/short accounts
    var lsA = x.long_short || [], r = lsA.length ? lsA[lsA.length - 1][1] : null, lp = r != null ? 100 * r / (1 + r) : null;
    h += card(t('ls'), r == null ? '—' : nf(r, 2), lp == null ? '' : pct(lp, 0) + ' ' + t('longs'),
      lp == null ? '' : '<div class="dv-bar"><i class="dv-g" style="width:' + lp.toFixed(1) + '%"></i><i class="dv-r" style="width:' + (100 - lp).toFixed(1) + '%"></i></div>', t('ls_x')) + '</div>';
    // charts
    h += '<div class="dv-charts">' + (oh.length ? '<div><h3>' + t('c_oi') + '</h3>' + spark(oh.map(function (z) { return z[1]; }), 400, 90, '#f7931a', 'rgba(247,147,26,.12)') + '</div>' : '') +
      (lsA.length ? '<div><h3>' + t('c_ls') + '</h3>' + spark(lsA.map(function (z) { return z[1]; }), 400, 90, '#38bdf8') + '</div>' : '') + '</div>';
    // whole market
    var row = function (c) { return '<li><b dir="ltr">' + esc(c.coin) + '</b> ' + pct(c.funding, 4, true) + ' <span class="mut">(' + pct(c.funding_ann, 0, true) + ' ' + t('apr') + ' · OI ' + usd(c.oi_usd) + ')</span></li>'; };
    h += '<section class="rc-sec"><h2>' + t('mkt') + '</h2><div class="rc-kpis"><div class="rc-kpi"><small>' + t('tot') + '</small><b>' + usd(D.total_oi_usd) + '</b></div><div class="rc-kpi"><small>' + t('wf') + '</small><b>' + pct(D.avg_funding, 4, true) + '</b></div></div>' +
      '<div class="dv-two"><div><h3>🔥 ' + t('hot') + '</h3><ul>' + (D.funding_hot || []).slice(0, 6).map(row).join('') + '</ul></div><div><h3>🧊 ' + t('cold') + '</h3><ul>' + (D.funding_cold || []).slice(0, 6).map(row).join('') + '</ul></div></div></section>';
    // roundtable + source
    var ctx = CUR + ' funding ' + (f == null ? '—' : f + '%/8h') + ' · OI ' + usd(x.oi_usd) + (ch != null ? ' (' + (ch >= 0 ? '+' : '') + ch.toFixed(1) + '% 24h)' : '') + ' · L/S ' + (r == null ? '—' : r) + ' · liq L ' + usd(lv) + ' / S ' + usd(sv);
    h += '<p><a class="rc-btn2" href="/roundtable/#ask=' + encodeURIComponent(JSON.stringify([CUR + ' — ' + t('rtQ'), t('rtO'), ctx])) + '">🪑 ' + t('rt') + '</a></p>';
    h += '<p class="mut">' + t('src') + ' · ' + t('upd') + ' ' + ago(D.updated_at) + '. ' + t('nfa') + '</p>';
    root.innerHTML = h;
    root.querySelectorAll('[data-c]').forEach(function (b) { b.onclick = function () { CUR = b.getAttribute('data-c'); try { history.replaceState(null, '', '#' + CUR.toLowerCase()); } catch (e) { } render(); }; });
  }
  function load() {
    fetch('/data/derivatives.json?v=' + Math.floor(Date.now() / 3e5)).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { D = j || {}; render(); }).catch(function () { D = {}; render(); });
  }
  render(); load(); setInterval(load, 5 * 60 * 1000);
  new MutationObserver(function () { if (root.lang !== lang()) render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
