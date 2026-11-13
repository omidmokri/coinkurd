/* entekhab.net — the Observatory's strings in the site's four languages: کوردی (ckb) · فارسی (fa) · العربية (ar) · English (en).
   OB.tr(lang, key, {name: value}) fills {name}; a key missing in a language falls back to English. Checked by tests/test_obs_i18n.py. */
(function () {
  'use strict';
  var OB = window.OB = window.OB || {};
  var S = {};
  S.en = {
    nav: 'Sections of the Observatory', all: 'All charts', tab_liqheat: 'Liquidation heatmap', tab_liqmap: 'Liquidation map',
    err_view: 'This part did not load. Refresh the page.', ago_s: '{n} s ago', ago_m: '{n} min ago', ago_h: '{n} h ago',
    exch: 'Exchange', ex_all: 'All', range: 'Range', lookback: 'Positions opened in', width: 'Width', model: 'Model', lev: 'Leverage', palette: 'Colours', thr: 'Threshold',
    r_12h: '12 hours', r_24h: '24 hours', r_48h: '48 hours', r_3d: '3 days', r_1w: '1 week', r_2w: '2 weeks', r_1m: '1 month', r_3m: '3 months', r_6m: '6 months', r_1y: '1 year',
    m1: 'New positions', m2: 'Weighted by the crowd’s side', m3: 'The whole open interest, with turnover', model_info: 'What the three models do',
    m1_d: 'Only a rise in open interest counts as new positions, longs and shorts equal. It assumes the least and shows where fresh leverage sits.',
    m2_d: 'Model 1, with longs and shorts weighted by the share of accounts that are long on the same exchange: the side most accounts are on carries more of the liquidation risk.',
    m3_d: 'On top of the rise in open interest, 10% of each candle’s volume is taken as positions changing hands (an old one closes, a new one opens). It builds a picture of every open position and leans toward the prices that traded most recently.',
    model_note: 'No exchange publishes its traders’ liquidation prices, so every liquidation heatmap is an estimate. The leverage tiers and their equal weights are the model’s assumption, not data.',
    pal_fire: 'Fire', pal_viridis: 'Classic', pal_ice: 'Ice', pal_mono: 'Grey', real_liq: 'Real liquidations', real_strip: 'Real', profile: 'Levels now',
    more: 'More settings', refresh: 'Refresh', png: 'Save as a picture', share: 'Link to this view', full: 'Full screen', coin: 'Choose a coin', search_coin: 'Find a coin…', close: 'Close', no_coin: 'No coin found',
    err_net: 'The exchanges’ data did not arrive', err_net_d: 'Binance and Bybit did not answer from this connection. Change the connection or the VPN and try again.',
    err_list: 'This coin has no perpetual contract on the chosen exchange', retry: 'Try again', loading: 'Getting candles and open interest from the exchanges…',
    part_fail: '{ex} did not answer from this connection; the map was built from the rest.',
    cl_none: 'No cluster stands out in this range', th_price: 'Price range', th_dist: 'Distance', th_est: 'Estimate',
    cl_above: 'Largest clusters above the price (short liquidations)', cl_below: 'Largest clusters below the price (long liquidations)',
    data_t: 'What this view is built from', d_px: 'Price', d_ex: 'Exchanges', d_oi: 'Open interest', d_track: 'Estimated levels (long / short)', d_cover: 'Open interest since', d_real: 'Real liquidations drawn', d_upd: 'Updated',
    zoom_in: 'Zoom in', zoom_out: 'Zoom out', reset: 'First view',
    aria_heat: 'Liquidation heatmap of {coin} over {range}; the largest cell is {max}. The clusters are summarised in the tables under the chart.',
    prof_now: 'Now', tip_liq: 'Estimated liquidations', tip_long: 'longs', tip_short: 'shorts', tip_real: 'Real liquidations', tip_cum: 'Cumulative from the price to here',
    wheel_hint: 'Hold Ctrl and scroll to zoom (or use the + and − buttons)', copied: 'Link copied', copy_fail: 'Could not copy',
    aria_map: 'Liquidation map of {coin}: estimated dollars in every price band by leverage, and the running total from the present price',
    map_p1: 'Estimated liquidations in each price band, by leverage', map_p1s: 'Liquidations by price band and leverage', map_p2: 'Running total from the present price, each way',
    lg_long: 'Long liquidations', lg_short: 'Short liquidations', total_long: 'Longs down to {w}% below the price', total_short: 'Shorts up to {w}% above the price',
    note_heat: 'An estimate, not a forecast: brighter means more dollars of positions that the model expects to be liquidated at that price. Read sizes as relative. Not financial advice.',
    note_map: 'An estimate, not a forecast: the bars are the dollars of positions the model expects to be liquidated in that band if the price gets there. Not financial advice.'
  };
  S.fa = {
    nav: 'بخش‌های رصدخانه', all: 'همهٔ نمودارها', tab_liqheat: 'نقشهٔ حرارتی لیکوییدیشن', tab_liqmap: 'نقشهٔ لیکوییدیشن',
    err_view: 'این بخش بارگیری نشد. صفحه را تازه کنید.', ago_s: '{n} ثانیه پیش', ago_m: '{n} دقیقه پیش', ago_h: '{n} ساعت پیش',
    exch: 'صرافی', ex_all: 'همه', range: 'بازه', lookback: 'پوزیشن‌های بازشده در', width: 'پهنا', model: 'مدل', lev: 'اهرم', palette: 'رنگ', thr: 'آستانه',
    r_12h: '۱۲ ساعت', r_24h: '۲۴ ساعت', r_48h: '۴۸ ساعت', r_3d: '۳ روز', r_1w: '۱ هفته', r_2w: '۲ هفته', r_1m: '۱ ماه', r_3m: '۳ ماه', r_6m: '۶ ماه', r_1y: '۱ سال',
    m1: 'پوزیشن‌های تازه', m2: 'وزن‌دهی با سمت جمعیت', m3: 'کل اوپن اینترست، با گردش پوزیشن‌ها', model_info: 'سه مدل چه فرقی دارند؟',
    m1_d: 'فقط افزایش اوپن اینترست را پوزیشن تازه می‌گیرد و لانگ و شورت را برابر می‌شمارد. کم‌فرض‌ترین مدل است و نشان می‌دهد اهرم تازه کجا نشسته.',
    m2_d: 'همان مدل ۱ است، ولی لانگ و شورت را با سهم حساب‌های لانگ در همان صرافی وزن می‌دهد: سمتی که بیشترِ حساب‌ها در آن هستند، سهم بیشتری از ریسک لیکوییدیشن می‌گیرد.',
    m3_d: 'علاوه بر افزایش اوپن اینترست، ۱۰٪ حجم هر کندل را دست‌به‌دست شدن پوزیشن می‌گیرد (یک پوزیشن قدیمی بسته و یک پوزیشن تازه باز می‌شود). تصویری از همهٔ پوزیشن‌های باز می‌سازد و به قیمت‌هایی که تازه‌تر معامله شده‌اند وزن بیشتری می‌دهد.',
    model_note: 'هیچ صرافی‌ای قیمت لیکوییدیشن معامله‌گرانش را منتشر نمی‌کند؛ پس هر نقشهٔ حرارتی لیکوییدیشن یک برآورد است. پله‌های اهرم و وزن برابرشان فرض مدل است، نه داده.',
    pal_fire: 'آتش', pal_viridis: 'کلاسیک', pal_ice: 'یخ', pal_mono: 'خاکستری', real_liq: 'لیکوییدیشن‌های واقعی', real_strip: 'واقعی', profile: 'سطوح اکنون',
    more: 'تنظیمات بیشتر', refresh: 'تازه‌سازی', png: 'ذخیرهٔ تصویر', share: 'لینک همین نما', full: 'تمام‌صفحه', coin: 'انتخاب ارز', search_coin: 'جست‌وجوی ارز…', close: 'بستن', no_coin: 'ارزی پیدا نشد',
    err_net: 'دادهٔ صرافی‌ها نرسید', err_net_d: 'از این اتصال، Binance و Bybit پاسخ ندادند. اتصال یا فیلترشکن را عوض کنید و دوباره امتحان کنید.',
    err_list: 'این ارز در صرافی انتخاب‌شده قرارداد دائمی ندارد', retry: 'تلاش دوباره', loading: 'در حال گرفتن کندل‌ها و اوپن اینترست از صرافی‌ها…',
    part_fail: '{ex} از این اتصال پاسخ نداد؛ نقشه با بقیه ساخته شد.',
    cl_none: 'خوشهٔ برجسته‌ای در این محدوده نیست', th_price: 'محدودهٔ قیمت', th_dist: 'فاصله', th_est: 'برآورد',
    cl_above: 'بزرگ‌ترین خوشه‌های بالای قیمت (لیکوییدیشن شورت‌ها)', cl_below: 'بزرگ‌ترین خوشه‌های زیر قیمت (لیکوییدیشن لانگ‌ها)',
    data_t: 'این نما از چه ساخته شده', d_px: 'قیمت', d_ex: 'صرافی‌ها', d_oi: 'اوپن اینترست', d_track: 'سطوح برآوردشده (لانگ / شورت)', d_cover: 'اوپن اینترست از', d_real: 'لیکوییدیشن واقعیِ رسم‌شده', d_upd: 'به‌روزرسانی',
    zoom_in: 'بزرگ‌نمایی', zoom_out: 'کوچک‌نمایی', reset: 'نمای اول',
    aria_heat: 'نقشهٔ حرارتی لیکوییدیشن {coin} در {range}؛ بزرگ‌ترین خانه {max} است. خلاصهٔ خوشه‌ها در جدول‌های زیر نمودار آمده است.',
    prof_now: 'اکنون', tip_liq: 'برآورد لیکوییدیشن', tip_long: 'لانگ‌ها', tip_short: 'شورت‌ها', tip_real: 'لیکوییدیشن واقعی', tip_cum: 'تجمعی از قیمت تا اینجا',
    wheel_hint: 'برای بزرگ‌نمایی Ctrl را نگه دارید و اسکرول کنید (یا دکمه‌های + و − را بزنید)', copied: 'لینک کپی شد', copy_fail: 'کپی نشد',
    aria_map: 'نقشهٔ لیکوییدیشن {coin}: دلار برآوردشده در هر محدودهٔ قیمت به تفکیک اهرم، و جمع تجمعی از قیمت فعلی',
    map_p1: 'برآورد لیکوییدیشن در هر محدودهٔ قیمت، به تفکیک اهرم', map_p1s: 'لیکوییدیشن در هر محدودهٔ قیمت و اهرم', map_p2: 'جمع تجمعی از قیمت فعلی به هر سو',
    lg_long: 'لیکوییدیشن لانگ‌ها', lg_short: 'لیکوییدیشن شورت‌ها', total_long: 'لانگ‌ها تا {w}٪ زیر قیمت', total_short: 'شورت‌ها تا {w}٪ بالای قیمت',
    note_heat: 'برآورد است، نه پیش‌بینی: روشن‌تر یعنی دلار بیشتری از پوزیشن‌ها که به حساب مدل در آن قیمت لیکویید می‌شوند. اندازه‌ها را نسبی بخوانید. توصیهٔ مالی نیست.',
    note_map: 'برآورد است، نه پیش‌بینی: ستون‌ها دلار پوزیشن‌هایی است که به حساب مدل، اگر قیمت به آن محدوده برسد، لیکویید می‌شوند. توصیهٔ مالی نیست.'
  };
  S.ckb = {
    nav: 'بەشەکانی ڕوانگە', all: 'هەموو چارتەکان', tab_liqheat: 'نەخشەی گەرمیی لیکویدکردن', tab_liqmap: 'نەخشەی لیکویدکردن',
    err_view: 'ئەم بەشە بار نەبوو. پەڕەکە نوێ بکەرەوە.', ago_s: '{n} چرکە لەمەوبەر', ago_m: '{n} خولەک لەمەوبەر', ago_h: '{n} کاتژمێر لەمەوبەر',
    exch: 'ئاڵوگۆڕگە', ex_all: 'هەموو', range: 'ماوە', lookback: 'ئەو پۆزیشنانەی کراونەتەوە لە', width: 'پانی', model: 'مۆدێل', lev: 'لیڤەرێج', palette: 'ڕەنگ', thr: 'ئاستانە',
    r_12h: '١٢ کاتژمێر', r_24h: '٢٤ کاتژمێر', r_48h: '٤٨ کاتژمێر', r_3d: '٣ ڕۆژ', r_1w: '١ هەفتە', r_2w: '٢ هەفتە', r_1m: '١ مانگ', r_3m: '٣ مانگ', r_6m: '٦ مانگ', r_1y: '١ ساڵ',
    m1: 'پۆزیشنە نوێیەکان', m2: 'کێشدان بەپێی لای زۆرینە', m3: 'هەموو ئۆپن ئینتەرێست، لەگەڵ گەڕانی پۆزیشنەکان', model_info: 'سێ مۆدێلەکە چ جیاوازییەکیان هەیە؟',
    m1_d: 'تەنها زیادبوونی ئۆپن ئینتەرێست بە پۆزیشنی نوێ دادەنێت و لۆنگ و شۆرت یەکسان دەژمێرێت. کەمترین گریمانەی هەیە و پیشان دەدات لیڤەرێجی نوێ لە کوێ دانیشتووە.',
    m2_d: 'هەمان مۆدێلی ١ـە، بەڵام لۆنگ و شۆرت بەپێی بەشی ئەو هەژمارانەی لۆنگن لە هەمان ئاڵوگۆڕگەدا کێش دەدات: ئەو لایەی زۆربەی هەژمارەکانی تێدایە، بەشێکی زیاتری مەترسیی لیکویدکردن هەڵدەگرێت.',
    m3_d: 'جگە لە زیادبوونی ئۆپن ئینتەرێست، ١٠٪ی قەبارەی هەر مۆمێک بە دەستاودەستکردنی پۆزیشن دادەنێت (پۆزیشنێکی کۆن دادەخرێت و یەکێکی نوێ دەکرێتەوە). وێنەیەک لە هەموو پۆزیشنە کراوەکان دروست دەکات و کێشی زیاتر دەدات بەو نرخانەی تازەتر مامەڵەیان لەسەر کراوە.',
    model_note: 'هیچ ئاڵوگۆڕگەیەک نرخی لیکویدکردنی بازرگانەکانی بڵاو ناکاتەوە؛ بۆیە هەر نەخشەیەکی گەرمیی لیکویدکردن خەمڵاندنە. پلەکانی لیڤەرێج و کێشی یەکسانیان گریمانەی مۆدێلەکەن، نەک داتا.',
    pal_fire: 'ئاگر', pal_viridis: 'کلاسیک', pal_ice: 'سەهۆڵ', pal_mono: 'خۆڵەمێشی', real_liq: 'لیکویدە ڕاستەقینەکان', real_strip: 'ڕاستەقینە', profile: 'ئاستەکانی ئێستا',
    more: 'ڕێکخستنی زیاتر', refresh: 'نوێکردنەوە', png: 'پاشەکەوتی وێنە', share: 'لینکی ئەم دیمەنە', full: 'پڕبەشاشە', coin: 'هەڵبژاردنی دراو', search_coin: 'گەڕان بۆ دراو…', close: 'داخستن', no_coin: 'هیچ دراوێک نەدۆزرایەوە',
    err_net: 'داتای ئاڵوگۆڕگەکان نەگەیشت', err_net_d: 'لەم پەیوەندییەوە Binance و Bybit وەڵامیان نەدایەوە. پەیوەندییەکە یان VPNـەکە بگۆڕە و دووبارە هەوڵ بدەرەوە.',
    err_list: 'ئەم دراوە لە ئاڵوگۆڕگەی هەڵبژێردراودا گرێبەستی هەمیشەیی نییە', retry: 'دووبارە هەوڵ بدەرەوە', loading: 'وەرگرتنی مۆمەکان و ئۆپن ئینتەرێست لە ئاڵوگۆڕگەکانەوە…',
    part_fail: '{ex} لەم پەیوەندییەوە وەڵامی نەدایەوە؛ نەخشەکە بە ئەوانی تر دروست کرا.',
    cl_none: 'هیچ کۆمەڵەیەکی دیار لەم مەودایەدا نییە', th_price: 'مەودای نرخ', th_dist: 'دووری', th_est: 'خەمڵاندن',
    cl_above: 'گەورەترین کۆمەڵەکانی سەرووی نرخ (لیکویدکردنی شۆرتەکان)', cl_below: 'گەورەترین کۆمەڵەکانی خوار نرخ (لیکویدکردنی لۆنگەکان)',
    data_t: 'ئەم دیمەنە لە چی دروست کراوە', d_px: 'نرخ', d_ex: 'ئاڵوگۆڕگەکان', d_oi: 'ئۆپن ئینتەرێست', d_track: 'ئاستە خەمڵێنراوەکان (لۆنگ / شۆرت)', d_cover: 'ئۆپن ئینتەرێست لە', d_real: 'لیکویدی ڕاستەقینەی کێشراو', d_upd: 'نوێکراوەتەوە',
    zoom_in: 'گەورەکردن', zoom_out: 'بچووککردنەوە', reset: 'دیمەنی سەرەتا',
    aria_heat: 'نەخشەی گەرمیی لیکویدکردنی {coin} لە {range}؛ گەورەترین خانە {max}ـە. پوختەی کۆمەڵەکان لە خشتەکانی ژێر چارتەکەدایە.',
    prof_now: 'ئێستا', tip_liq: 'خەمڵاندنی لیکویدکردن', tip_long: 'لۆنگەکان', tip_short: 'شۆرتەکان', tip_real: 'لیکویدی ڕاستەقینە', tip_cum: 'کۆکراوە لە نرخەوە تا ئێرە',
    wheel_hint: 'بۆ گەورەکردن Ctrl بگرە و سکرۆڵ بکە (یان دوگمەکانی + و − بەکاربهێنە)', copied: 'لینک کۆپی کرا', copy_fail: 'کۆپی نەکرا',
    aria_map: 'نەخشەی لیکویدکردنی {coin}: دۆلاری خەمڵێنراو لە هەر مەودایەکی نرخدا بەپێی لیڤەرێج، و کۆی کۆکراوە لە نرخی ئێستاوە',
    map_p1: 'خەمڵاندنی لیکویدکردن لە هەر مەودایەکی نرخدا، بەپێی لیڤەرێج', map_p1s: 'لیکویدکردن بەپێی مەودای نرخ و لیڤەرێج', map_p2: 'کۆی کۆکراوە لە نرخی ئێستاوە بۆ هەر لایەک',
    lg_long: 'لیکویدکردنی لۆنگەکان', lg_short: 'لیکویدکردنی شۆرتەکان', total_long: 'لۆنگەکان تا {w}٪ خوار نرخ', total_short: 'شۆرتەکان تا {w}٪ سەرووی نرخ',
    note_heat: 'خەمڵاندنە، نەک پێشبینی: ڕووناکتر واتە دۆلاری زیاتری ئەو پۆزیشنانەی بەپێی مۆدێلەکە لەو نرخەدا لیکوید دەکرێن. قەبارەکان بە ڕێژەیی بخوێنەرەوە. ئامۆژگاریی دارایی نییە.',
    note_map: 'خەمڵاندنە، نەک پێشبینی: ستوونەکان دۆلاری ئەو پۆزیشنانەن کە بەپێی مۆدێلەکە، ئەگەر نرخ بگاتە ئەو مەودایە، لیکوید دەکرێن. ئامۆژگاریی دارایی نییە.'
  };
  S.ar = {
    nav: 'أقسام المرصد', all: 'كل الرسوم', tab_liqheat: 'الخريطة الحرارية للتصفيات', tab_liqmap: 'خريطة التصفيات',
    err_view: 'تعذّر تحميل هذا القسم. حدّث الصفحة.', ago_s: 'منذ {n} ث', ago_m: 'منذ {n} د', ago_h: 'منذ {n} س',
    exch: 'المنصة', ex_all: 'الكل', range: 'المدى', lookback: 'المراكز المفتوحة خلال', width: 'العرض', model: 'النموذج', lev: 'الرافعة', palette: 'الألوان', thr: 'العتبة',
    r_12h: '١٢ ساعة', r_24h: '٢٤ ساعة', r_48h: '٤٨ ساعة', r_3d: '٣ أيام', r_1w: 'أسبوع', r_2w: 'أسبوعان', r_1m: 'شهر', r_3m: '٣ أشهر', r_6m: '٦ أشهر', r_1y: 'سنة',
    m1: 'المراكز الجديدة', m2: 'ترجيح حسب جهة الأغلبية', m3: 'كل العقود المفتوحة مع دوران المراكز', model_info: 'ما الفرق بين النماذج الثلاثة؟',
    m1_d: 'يعدّ ارتفاع العقود المفتوحة فقط مراكز جديدة، ويساوي بين الشراء والبيع. أقل النماذج افتراضًا ويُظهر أين تتمركز الرافعة الجديدة.',
    m2_d: 'هو النموذج ١ نفسه، لكنه يرجّح الشراء والبيع بحصة الحسابات المشترية في المنصة نفسها: الجهة التي تضم أغلب الحسابات تحمل نصيبًا أكبر من خطر التصفية.',
    m3_d: 'إضافة إلى ارتفاع العقود المفتوحة، يعدّ ١٠٪ من حجم كل شمعة انتقالًا للمراكز (يُغلق مركز قديم ويُفتح آخر جديد). يرسم صورة لكل المراكز المفتوحة ويميل إلى الأسعار التي جرى تداولها حديثًا.',
    model_note: 'لا تنشر أي منصة أسعار تصفية متداوليها، لذا فكل خريطة حرارية للتصفيات تقدير. درجات الرافعة وأوزانها المتساوية افتراض من النموذج وليست بيانات.',
    pal_fire: 'نار', pal_viridis: 'كلاسيكي', pal_ice: 'جليد', pal_mono: 'رمادي', real_liq: 'التصفيات الفعلية', real_strip: 'فعلية', profile: 'المستويات الآن',
    more: 'إعدادات أكثر', refresh: 'تحديث', png: 'حفظ كصورة', share: 'رابط هذا العرض', full: 'ملء الشاشة', coin: 'اختر عملة', search_coin: 'ابحث عن عملة…', close: 'إغلاق', no_coin: 'لا توجد عملة مطابقة',
    err_net: 'لم تصل بيانات المنصات', err_net_d: 'لم تستجب Binance وBybit من هذا الاتصال. غيّر الاتصال أو الـVPN وحاول مجددًا.',
    err_list: 'لا يوجد عقد دائم لهذه العملة في المنصة المختارة', retry: 'حاول مجددًا', loading: 'جارٍ جلب الشموع والعقود المفتوحة من المنصات…',
    part_fail: 'لم تستجب {ex} من هذا الاتصال؛ بُنيت الخريطة من البقية.',
    cl_none: 'لا يوجد تجمّع بارز في هذا المدى', th_price: 'نطاق السعر', th_dist: 'المسافة', th_est: 'التقدير',
    cl_above: 'أكبر التجمّعات فوق السعر (تصفية مراكز البيع)', cl_below: 'أكبر التجمّعات تحت السعر (تصفية مراكز الشراء)',
    data_t: 'ممّ يتكوّن هذا العرض', d_px: 'السعر', d_ex: 'المنصات', d_oi: 'العقود المفتوحة', d_track: 'المستويات المقدّرة (شراء / بيع)', d_cover: 'العقود المفتوحة منذ', d_real: 'التصفيات الفعلية المرسومة', d_upd: 'آخر تحديث',
    zoom_in: 'تكبير', zoom_out: 'تصغير', reset: 'العرض الأول',
    aria_heat: 'الخريطة الحرارية لتصفيات {coin} خلال {range}؛ أكبر خانة {max}. ملخّص التجمّعات في الجداول أسفل الرسم.',
    prof_now: 'الآن', tip_liq: 'التصفيات المقدّرة', tip_long: 'مراكز الشراء', tip_short: 'مراكز البيع', tip_real: 'التصفيات الفعلية', tip_cum: 'التراكمي من السعر إلى هنا',
    wheel_hint: 'للتكبير اضغط Ctrl مع التمرير (أو استخدم زرّي + و −)', copied: 'تم نسخ الرابط', copy_fail: 'تعذّر النسخ',
    aria_map: 'خريطة تصفيات {coin}: الدولارات المقدّرة في كل نطاق سعري حسب الرافعة، والمجموع التراكمي من السعر الحالي',
    map_p1: 'التصفيات المقدّرة في كل نطاق سعري حسب الرافعة', map_p1s: 'التصفيات حسب نطاق السعر والرافعة', map_p2: 'المجموع التراكمي من السعر الحالي في كل اتجاه',
    lg_long: 'تصفية مراكز الشراء', lg_short: 'تصفية مراكز البيع', total_long: 'مراكز الشراء حتى {w}٪ تحت السعر', total_short: 'مراكز البيع حتى {w}٪ فوق السعر',
    note_heat: 'تقدير لا توقّع: الأفتح يعني دولارات أكثر من المراكز التي يتوقّع النموذج تصفيتها عند ذلك السعر. اقرأ الأحجام نسبيًّا. ليست نصيحة مالية.',
    note_map: 'تقدير لا توقّع: الأعمدة هي دولارات المراكز التي يتوقّع النموذج تصفيتها في ذلك النطاق إذا بلغه السعر. ليست نصيحة مالية.'
  };
  OB.STR = S;
  OB.tr = function (lang, k, a) {
    var s = (S[lang] && S[lang][k] != null) ? S[lang][k] : (S.en[k] != null ? S.en[k] : k);
    if (a) s = s.replace(/\{(\w+)\}/g, function (m, n) { return a[n] != null ? a[n] : m; });
    return s;
  };
})();
