/* entekhab.net — the Observatory in deep space: /charts/sopr/ and /charts/hodl-waves/.
   Data: data/obs/age_btc.json (scripts/obs_age.py; every figure defined in assets/obs/agemath.js). Drawn on its own
   canvases: a star field behind the page, the SOPR "event horizon" chart, the HODL "galaxy" (each ring's AREA is its
   band's share of all bitcoin, newest coins at the core) and the waves through time. Motion stops when the tab is hidden,
   when a canvas is off screen, and entirely under prefers-reduced-motion. Strings live here in the site's four languages;
   every number put into markup is a number we formatted, and every string goes through OB.esc. Nothing is sent anywhere. */
(function () {
  'use strict';
  var OB = window.OB, A = window.OBAge, d = document, w = window, esc = OB.esc, $ = OB.$;
  if (!OB || !A) return;
  var RM = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var DAY = 86400000;

  /* ---------------------------------------------------------------- strings */
  var L = {
    en: {
      loading: 'Reading the blockchain…', err: 'The data did not load. Check the connection and try again.', retry: 'Try again',
      asof: 'Last closed day {d} (UTC)', checked: 'Checked today: the coins add up to Coin Metrics’ supply; SOPR and the waves agree with BGeometrics.',
      checked_s: 'Checked: the coins add up to Coin Metrics’ supply.', src: 'Computed from every block of the Bitcoin blockchain by the Bitcoin Research Kit (bitview.space, open source).',
      range: 'Range', r1y: '1 year', r2y: '2 years', r4y: '4 years', r8y: '8 years', rall: 'All', price: 'Price',
      cohort: 'Holders', c_all: 'All coins', c_sth: 'Short-term', c_lth: 'Long-term', c_adj: 'Adjusted',
      smooth: 'Smoothing', s1: 'Daily', s7: '7-day mean', s30: '30-day mean',
      horizon: 'Break-even: 1', profit: 'Spent at a profit', loss: 'Spent at a loss',
      t_day: 'SOPR · last day', t_7: '7-day mean', t_30: '30-day mean', t_sth: 'Short-term holders', t_lth: 'Long-term holders', t_adj: 'Adjusted SOPR',
      t_rank: 'Rank of the 7-day mean', t_rank_s: '{p}% of all days were at or below it',
      side_loss: 'Loss side', side_profit: 'Profit side',
      streak_loss: 'The 7-day mean has stayed below 1 for {n} days.', streak_profit: 'The 7-day mean has stayed at or above 1 for {n} days.',
      read_loss: 'On average, coins moving now are sold for less than they were bought for.',
      read_profit: 'On average, coins moving now are sold for more than they were bought for.',
      aria_sopr: 'Bitcoin’s SOPR over time under its price, with the break-even line at 1',
      aria_gauge: 'Dial of the 7-day SOPR against the break-even line',
      v_galaxy: 'Galaxy', v_waves: 'Waves through time', tm: 'Time machine', play: 'Play history', pause: 'Pause', today: 'Today',
      core: 'Newest coins at the core, the oldest on the rim; each ring’s area is its share of all bitcoin. Fast orbits are coins that move often.',
      b_d1: 'Under 1 day', b_w1: '1 day – 1 week', b_m1: '1 week – 1 month', b_m3: '1–3 months', b_m6: '3–6 months', b_y1: '6–12 months',
      b_y2: '1–2 years', b_y3: '2–3 years', b_y4: '3–4 years', b_y5: '4–5 years', b_y7: '5–7 years', b_y10: '7–10 years', b_y10p: 'Over 10 years',
      t_old: 'Unmoved for over a year', t_young: 'Moved in the last 6 months', t_lthsh: 'Long-term holders’ share', t_c30: 'Old coins · 30 days', t_c365: 'Old coins · 1 year',
      t_orank: 'Rank of the old-coin share', pts: '{v} pts', of_all: 'of all bitcoin', btc: '{v} BTC',
      read_up: 'Old coins are a larger share than a year ago: holders are holding.', read_dn: 'Old coins are a smaller share than a year ago: long-held coins are moving.',
      aria_galaxy: 'Galaxy of Bitcoin’s supply by how long ago each coin last moved', aria_waves: 'Share of Bitcoin by age band over time, under the price',
      legend: 'Age bands', hover: 'Point at a ring or a band to read it.'
    },
    fa: {
      loading: 'در حال خواندن بلاکچین…', err: 'داده بارگیری نشد. اتصال را بررسی کنید و دوباره امتحان کنید.', retry: 'دوباره',
      asof: 'آخرین روز بسته‌شده {d} (UTC)', checked: 'بررسی امروز: جمع کوین‌ها با عرضهٔ Coin Metrics می‌خواند؛ SOPR و امواج با BGeometrics هم‌خوان‌اند.',
      checked_s: 'بررسی‌شده: جمع کوین‌ها با عرضهٔ Coin Metrics می‌خواند.', src: 'محاسبه از تک‌تک بلاک‌های بلاکچین بیت‌کوین با Bitcoin Research Kit (bitview.space، متن‌باز).',
      range: 'بازه', r1y: '۱ سال', r2y: '۲ سال', r4y: '۴ سال', r8y: '۸ سال', rall: 'همه', price: 'قیمت',
      cohort: 'دارندگان', c_all: 'همهٔ کوین‌ها', c_sth: 'کوتاه‌مدت', c_lth: 'بلندمدت', c_adj: 'تعدیل‌شده',
      smooth: 'هموارسازی', s1: 'روزانه', s7: 'میانگین ۷ روزه', s30: 'میانگین ۳۰ روزه',
      horizon: 'سربه‌سر: ۱', profit: 'خرج در سود', loss: 'خرج در زیان',
      t_day: 'SOPR · آخرین روز', t_7: 'میانگین ۷ روزه', t_30: 'میانگین ۳۰ روزه', t_sth: 'دارندگان کوتاه‌مدت', t_lth: 'دارندگان بلندمدت', t_adj: 'SOPR تعدیل‌شده',
      t_rank: 'رتبهٔ میانگین ۷ روزه', t_rank_s: '{p}٪ همهٔ روزها برابر یا پایین‌تر از آن بوده‌اند',
      side_loss: 'سمت زیان', side_profit: 'سمت سود',
      streak_loss: 'میانگین ۷ روزه {n} روز است که زیر ۱ مانده است.', streak_profit: 'میانگین ۷ روزه {n} روز است که ۱ یا بالاتر مانده است.',
      read_loss: 'به‌طور میانگین، کوین‌هایی که اکنون جابه‌جا می‌شوند ارزان‌تر از قیمتی که خریده شده‌اند فروخته می‌شوند.',
      read_profit: 'به‌طور میانگین، کوین‌هایی که اکنون جابه‌جا می‌شوند گران‌تر از قیمتی که خریده شده‌اند فروخته می‌شوند.',
      aria_sopr: 'SOPR بیت‌کوین در طول زمان زیر نمودار قیمت، با خط سربه‌سر در ۱',
      aria_gauge: 'صفحهٔ SOPR هفت‌روزه نسبت به خط سربه‌سر',
      v_galaxy: 'کهکشان', v_waves: 'امواج در گذر زمان', tm: 'ماشین زمان', play: 'پخش تاریخ', pause: 'توقف', today: 'امروز',
      core: 'تازه‌ترین کوین‌ها در مرکز و قدیمی‌ترین‌ها در لبه؛ مساحت هر حلقه سهم آن از همهٔ بیت‌کوین‌هاست. مدارهای تند کوین‌هایی‌اند که زیاد جابه‌جا می‌شوند.',
      b_d1: 'کمتر از ۱ روز', b_w1: '۱ روز تا ۱ هفته', b_m1: '۱ هفته تا ۱ ماه', b_m3: '۱ تا ۳ ماه', b_m6: '۳ تا ۶ ماه', b_y1: '۶ تا ۱۲ ماه',
      b_y2: '۱ تا ۲ سال', b_y3: '۲ تا ۳ سال', b_y4: '۳ تا ۴ سال', b_y5: '۴ تا ۵ سال', b_y7: '۵ تا ۷ سال', b_y10: '۷ تا ۱۰ سال', b_y10p: 'بیش از ۱۰ سال',
      t_old: 'بیش از یک سال بی‌حرکت', t_young: 'جابه‌جاشده در ۶ ماه اخیر', t_lthsh: 'سهم دارندگان بلندمدت', t_c30: 'کوین‌های قدیمی · ۳۰ روز', t_c365: 'کوین‌های قدیمی · ۱ سال',
      t_orank: 'رتبهٔ سهم کوین‌های قدیمی', pts: '{v} واحد درصد', of_all: 'از همهٔ بیت‌کوین‌ها', btc: '{v} بیت‌کوین',
      read_up: 'سهم کوین‌های قدیمی از یک سال پیش بیشتر است: دارندگان نگه می‌دارند.', read_dn: 'سهم کوین‌های قدیمی از یک سال پیش کمتر است: کوین‌های دیرینه در حال جابه‌جایی‌اند.',
      aria_galaxy: 'کهکشان عرضهٔ بیت‌کوین بر پایهٔ اینکه هر کوین آخرین بار کی جابه‌جا شده', aria_waves: 'سهم بیت‌کوین در هر بازهٔ سنی در طول زمان، زیر نمودار قیمت',
      legend: 'بازه‌های سنی', hover: 'روی یک حلقه یا موج بروید تا عددش را ببینید.'
    },
    ckb: {
      loading: 'خوێندنەوەی بلۆکچەین…', err: 'داتاکە نەهات. پەیوەندییەکە بپشکنە و دووبارە هەوڵ بدەرەوە.', retry: 'دووبارە',
      asof: 'دوایین ڕۆژی داخراو {d} (UTC)', checked: 'پشکنینی ئەمڕۆ: کۆی دراوەکان لەگەڵ بڕی Coin Metrics دەگونجێت؛ SOPR و شەپۆلەکان لەگەڵ BGeometrics یەک دەگرنەوە.',
      checked_s: 'پشکنراو: کۆی دراوەکان لەگەڵ بڕی Coin Metrics دەگونجێت.', src: 'ژمێردراو لە هەموو بلۆکەکانی بلۆکچەینی بیتکۆین بە Bitcoin Research Kit (bitview.space، سەرچاوە-کراوە).',
      range: 'ماوە', r1y: '١ ساڵ', r2y: '٢ ساڵ', r4y: '٤ ساڵ', r8y: '٨ ساڵ', rall: 'هەموو', price: 'نرخ',
      cohort: 'هەڵگران', c_all: 'هەموو دراوەکان', c_sth: 'کورتخایەن', c_lth: 'درێژخایەن', c_adj: 'ڕێکخراو',
      smooth: 'نەرمکردن', s1: 'ڕۆژانە', s7: 'تێکڕای ٧ ڕۆژ', s30: 'تێکڕای ٣٠ ڕۆژ',
      horizon: 'سەربەسەر: ١', profit: 'خەرجکردن بە قازانج', loss: 'خەرجکردن بە زیان',
      t_day: 'SOPR · دوایین ڕۆژ', t_7: 'تێکڕای ٧ ڕۆژ', t_30: 'تێکڕای ٣٠ ڕۆژ', t_sth: 'هەڵگرانی کورتخایەن', t_lth: 'هەڵگرانی درێژخایەن', t_adj: 'SOPRی ڕێکخراو',
      t_rank: 'پلەی تێکڕای ٧ ڕۆژ', t_rank_s: '{p}٪ی هەموو ڕۆژەکان یەکسان یان کەمتر لەو بوون',
      side_loss: 'لای زیان', side_profit: 'لای قازانج',
      streak_loss: 'تێکڕای ٧ ڕۆژ {n} ڕۆژە لە خوار ١ ماوەتەوە.', streak_profit: 'تێکڕای ٧ ڕۆژ {n} ڕۆژە ١ یان سەرووتر ماوەتەوە.',
      read_loss: 'بە تێکڕا، ئەو دراوانەی ئێستا دەجوڵێن هەرزانتر لە نرخی کڕینیان دەفرۆشرێن.',
      read_profit: 'بە تێکڕا، ئەو دراوانەی ئێستا دەجوڵێن گرانتر لە نرخی کڕینیان دەفرۆشرێن.',
      aria_sopr: 'SOPRی بیتکۆین بە درێژایی کات لە ژێر نەخشەی نرخ، لەگەڵ هێڵی سەربەسەر لە ١',
      aria_gauge: 'پیشاندەری SOPRی حەوت ڕۆژە بەرامبەر هێڵی سەربەسەر',
      v_galaxy: 'گەلەستێرە', v_waves: 'شەپۆلەکان بە درێژایی کات', tm: 'ئامێری کات', play: 'لێدانی مێژوو', pause: 'ڕاگرتن', today: 'ئەمڕۆ',
      core: 'نوێترین دراوەکان لە ناوەڕاست و کۆنترینەکان لە لێوار؛ ڕووبەری هەر ئەڵقەیەک بەشی ئەوە لە هەموو بیتکۆینەکان. خولگە خێراکان ئەو دراوانەن کە زۆر دەجوڵێن.',
      b_d1: 'کەمتر لە ١ ڕۆژ', b_w1: '١ ڕۆژ تا ١ هەفتە', b_m1: '١ هەفتە تا ١ مانگ', b_m3: '١ تا ٣ مانگ', b_m6: '٣ تا ٦ مانگ', b_y1: '٦ تا ١٢ مانگ',
      b_y2: '١ تا ٢ ساڵ', b_y3: '٢ تا ٣ ساڵ', b_y4: '٣ تا ٤ ساڵ', b_y5: '٤ تا ٥ ساڵ', b_y7: '٥ تا ٧ ساڵ', b_y10: '٧ تا ١٠ ساڵ', b_y10p: 'زیاتر لە ١٠ ساڵ',
      t_old: 'زیاتر لە ساڵێک نەجوڵاو', t_young: 'جوڵاو لە ٦ مانگی ڕابردوودا', t_lthsh: 'بەشی هەڵگرانی درێژخایەن', t_c30: 'دراوە کۆنەکان · ٣٠ ڕۆژ', t_c365: 'دراوە کۆنەکان · ١ ساڵ',
      t_orank: 'پلەی بەشی دراوە کۆنەکان', pts: '{v} خاڵی لەسەدی', of_all: 'لە هەموو بیتکۆینەکان', btc: '{v} بیتکۆین',
      read_up: 'بەشی دراوە کۆنەکان لە ساڵێک لەمەوبەر زیاترە: هەڵگران ڕایدەگرن.', read_dn: 'بەشی دراوە کۆنەکان لە ساڵێک لەمەوبەر کەمترە: دراوە دێرینەکان دەجوڵێن.',
      aria_galaxy: 'گەلەستێرەی بڕی بیتکۆین بەپێی ئەوەی هەر دراوێک دوایین جار کەی جوڵاوە', aria_waves: 'بەشی بیتکۆین لە هەر ماوەیەکی تەمەندا بە درێژایی کات، لە ژێر نەخشەی نرخ',
      legend: 'ماوەکانی تەمەن', hover: 'بچۆ سەر ئەڵقەیەک یان شەپۆلێک بۆ خوێندنەوەی ژمارەکەی.'
    },
    ar: {
      loading: 'جارٍ قراءة البلوكشين…', err: 'لم تُحمَّل البيانات. تحقّق من الاتصال وحاول مجددًا.', retry: 'أعد المحاولة',
      asof: 'آخر يوم مغلق {d} (UTC)', checked: 'تحقّق اليوم: مجموع العملات يطابق معروض Coin Metrics؛ وSOPR والموجات تتفق مع BGeometrics.',
      checked_s: 'تم التحقق: مجموع العملات يطابق معروض Coin Metrics.', src: 'محسوبة من كل كتلة في بلوكشين البيتكوين بواسطة Bitcoin Research Kit (bitview.space، مفتوح المصدر).',
      range: 'المدى', r1y: 'سنة', r2y: 'سنتان', r4y: '٤ سنوات', r8y: '٨ سنوات', rall: 'الكل', price: 'السعر',
      cohort: 'الحائزون', c_all: 'كل العملات', c_sth: 'المدى القصير', c_lth: 'المدى الطويل', c_adj: 'المعدّل',
      smooth: 'التنعيم', s1: 'يومي', s7: 'متوسط ٧ أيام', s30: 'متوسط ٣٠ يومًا',
      horizon: 'التعادل: ١', profit: 'إنفاق بربح', loss: 'إنفاق بخسارة',
      t_day: 'SOPR · آخر يوم', t_7: 'متوسط ٧ أيام', t_30: 'متوسط ٣٠ يومًا', t_sth: 'حائزو المدى القصير', t_lth: 'حائزو المدى الطويل', t_adj: 'SOPR المعدّل',
      t_rank: 'ترتيب متوسط ٧ أيام', t_rank_s: '{p}٪ من كل الأيام كانت عنده أو أقل',
      side_loss: 'جهة الخسارة', side_profit: 'جهة الربح',
      streak_loss: 'بقي متوسط ٧ أيام تحت ١ منذ {n} يومًا.', streak_profit: 'بقي متوسط ٧ أيام عند ١ أو فوقه منذ {n} يومًا.',
      read_loss: 'في المتوسط، تُباع العملات المتحركة الآن بأقل مما اشتُريت به.',
      read_profit: 'في المتوسط، تُباع العملات المتحركة الآن بأكثر مما اشتُريت به.',
      aria_sopr: 'SOPR للبيتكوين عبر الزمن تحت سعره، مع خط التعادل عند ١',
      aria_gauge: 'مؤشر SOPR لسبعة أيام مقابل خط التعادل',
      v_galaxy: 'المجرّة', v_waves: 'الموجات عبر الزمن', tm: 'آلة الزمن', play: 'تشغيل التاريخ', pause: 'إيقاف', today: 'اليوم',
      core: 'أحدث العملات في المركز وأقدمها على الحافة؛ مساحة كل حلقة هي حصتها من كل البيتكوين. المدارات السريعة عملات تتحرك كثيرًا.',
      b_d1: 'أقل من يوم', b_w1: 'يوم – أسبوع', b_m1: 'أسبوع – شهر', b_m3: '١–٣ أشهر', b_m6: '٣–٦ أشهر', b_y1: '٦–١٢ شهرًا',
      b_y2: '١–٢ سنة', b_y3: '٢–٣ سنوات', b_y4: '٣–٤ سنوات', b_y5: '٤–٥ سنوات', b_y7: '٥–٧ سنوات', b_y10: '٧–١٠ سنوات', b_y10p: 'أكثر من ١٠ سنوات',
      t_old: 'لم تتحرك منذ أكثر من سنة', t_young: 'تحركت في آخر ٦ أشهر', t_lthsh: 'حصة حائزي المدى الطويل', t_c30: 'العملات القديمة · ٣٠ يومًا', t_c365: 'العملات القديمة · سنة',
      t_orank: 'ترتيب حصة العملات القديمة', pts: '{v} نقطة مئوية', of_all: 'من كل البيتكوين', btc: '{v} بيتكوين',
      read_up: 'حصة العملات القديمة أكبر مما كانت قبل سنة: الحائزون يحتفظون.', read_dn: 'حصة العملات القديمة أقل مما كانت قبل سنة: العملات المحتفظ بها طويلًا تتحرك.',
      aria_galaxy: 'مجرّة معروض البيتكوين بحسب آخر مرة تحركت فيها كل عملة', aria_waves: 'حصة البيتكوين في كل شريحة عمرية عبر الزمن، تحت السعر',
      legend: 'الشرائح العمرية', hover: 'مرّر فوق حلقة أو موجة لقراءتها.'
    }
  };
  function t(k, a) {
    var lg = OB.lang(), s = (L[lg] && L[lg][k]) || L.en[k] || k;
    if (a) s = s.replace(/\{(\w+)\}/g, function (m, n) { return a[n] != null ? a[n] : m; });
    return s;
  }
  function loc(s) { return OB.loc(String(s)); }
  function f2(v, dp) { return v == null || !isFinite(v) ? '—' : loc(v.toFixed(dp == null ? 3 : dp)); }
  function pct(v, dp) { return v == null || !isFinite(v) ? '—' : loc(v.toFixed(dp == null ? 1 : dp)) + (OB.lang() === 'en' ? '%' : '٪'); }
  function compact(v) {
    var a = Math.abs(v);
    return a >= 1e12 ? (v / 1e12).toFixed(2) + 'T' : a >= 1e9 ? (v / 1e9).toFixed(a >= 1e11 ? 0 : 1) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(a >= 1e8 ? 0 : 2) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K' : v.toFixed(0);
  }
  function sgn(v, dp) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + loc(Math.abs(v).toFixed(dp == null ? 2 : dp)); }
  function dstr(ms) { return OB.fmtDate(ms); }

  /* ---------------------------------------------------------------- palette */
  var BAND_C = ['#eaf6ff', '#b8e6ff', '#7cd4ff', '#3fb8ff', '#4a8dff', '#6f6bff', '#9b5cff', '#c650f0', '#ec4fc4', '#ff5c8f', '#ff7a5c', '#ffa24a', '#ffd166'];
  var AGE_D = [0.5, 4, 18, 60, 135, 270, 540, 900, 1260, 1640, 2190, 3100, 4500];       /* a band's middle age in days (orbit speed) */
  var PROFIT = '#5ef2d6', LOSS = '#ff4f9a', STAR = '#fff6e0', GRID = 'rgba(160,190,255,.10)', TXT = 'rgba(214,226,255,.72)';
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }

  /* ---------------------------------------------------------------- the sky behind the page (one per page) */
  var SKY = null;
  function sky() {
    if (SKY) { SKY.wake(); return SKY; }
    var cv = d.createElement('canvas'); cv.className = 'cz-sky'; cv.setAttribute('aria-hidden', 'true');
    d.body.insertBefore(cv, d.body.firstChild);
    var g = cv.getContext('2d'), stars = [], neb = null, W = 0, H = 0, dpr = 1, raf = 0, last = 0, shoot = null, scrollY = 0;
    function seed() {
      stars = [];
      var n = Math.round(Math.min(900, W * H / 2600));
      for (var i = 0; i < n; i++) {
        var z = Math.random();
        stars.push({ x: Math.random() * W, y: Math.random() * H * 1.6, z: z, r: z < .85 ? .4 + z * .7 : 1 + z * .9, ph: Math.random() * 6.28, sp: .4 + Math.random() * 1.4,
          c: Math.random() < .12 ? '#ffd9a8' : Math.random() < .2 ? '#a8c8ff' : '#ffffff' });
      }
      /* the nebulae are painted once, off screen */
      neb = d.createElement('canvas'); neb.width = Math.max(1, Math.round(W / 2)); neb.height = Math.max(1, Math.round(H / 2));
      var q = neb.getContext('2d'), clouds = [['#3a1c71', .55, .18, .2, .55], ['#0f5c8c', .5, .82, .32, .5], ['#7a1f5c', .38, .7, .78, .45], ['#14306b', .45, .25, .85, .6], ['#0b6b6b', .25, .5, .5, .35]];
      clouds.forEach(function (c) {
        var cx = c[2] * neb.width, cy = c[3] * neb.height, r = c[4] * Math.max(neb.width, neb.height);
        var gr = q.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, rgba(c[0], c[1])); gr.addColorStop(.45, rgba(c[0], c[1] * .35)); gr.addColorStop(1, rgba(c[0], 0));
        q.fillStyle = gr; q.fillRect(0, 0, neb.width, neb.height);
      });
    }
    function size() {
      dpr = Math.min(2, w.devicePixelRatio || 1); W = w.innerWidth; H = w.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); seed(); frame(performance.now(), true);
    }
    function frame(now, once) {
      if (!d.documentElement.classList.contains('cz-on')) { raf = 0; return; }   /* the page moved on to another view */
      if (!once && now - last < 33) { raf = w.requestAnimationFrame(frame); return; }
      last = now;
      var tt = now / 1000;
      g.clearRect(0, 0, W, H);
      var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#03040c'); bg.addColorStop(.6, '#060818'); bg.addColorStop(1, '#0a0620');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      if (neb) { g.globalAlpha = .95; g.drawImage(neb, 0, -scrollY * .04, W, H); g.globalAlpha = 1; }
      g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i], y = ((s.y - scrollY * (.05 + s.z * .25)) % (H * 1.6) + H * 1.6) % (H * 1.6);
        if (y > H) continue;
        var tw = RM ? .8 : .55 + .45 * Math.sin(tt * s.sp + s.ph);
        g.globalAlpha = (.25 + s.z * .75) * tw; g.fillStyle = s.c;
        g.beginPath(); g.arc(s.x, y, s.r, 0, 6.283); g.fill();
        if (s.r > 1.5) { g.globalAlpha *= .25; g.beginPath(); g.arc(s.x, y, s.r * 3.2, 0, 6.283); g.fill(); }
      }
      if (!RM) {
        if (!shoot && Math.random() < .004) shoot = { x: Math.random() * W, y: Math.random() * H * .5, vx: -(4 + Math.random() * 5), vy: 2 + Math.random() * 2, life: 1 };
        if (shoot) {
          var gr = g.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 16, shoot.y - shoot.vy * 16);
          gr.addColorStop(0, 'rgba(255,255,255,' + .9 * shoot.life + ')'); gr.addColorStop(1, 'rgba(160,200,255,0)');
          g.globalAlpha = 1; g.strokeStyle = gr; g.lineWidth = 1.4; g.beginPath(); g.moveTo(shoot.x, shoot.y); g.lineTo(shoot.x - shoot.vx * 16, shoot.y - shoot.vy * 16); g.stroke();
          shoot.x += shoot.vx; shoot.y += shoot.vy; shoot.life -= .018; if (shoot.life <= 0) shoot = null;
        }
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      if (!RM && !once && !d.hidden) raf = w.requestAnimationFrame(frame);
    }
    w.addEventListener('resize', OB.debounce(size, 150));
    w.addEventListener('scroll', function () { scrollY = w.scrollY || 0; if (RM) frame(performance.now(), true); }, { passive: true });
    d.addEventListener('visibilitychange', function () { if (!d.hidden && !RM) { w.cancelAnimationFrame(raf); raf = w.requestAnimationFrame(frame); } });
    size();
    if (!RM) raf = w.requestAnimationFrame(frame);
    SKY = { cv: cv, wake: function () { frame(performance.now(), true); if (!RM && !raf) raf = w.requestAnimationFrame(frame); } };
    return SKY;
  }

  /* ---------------------------------------------------------------- shared pieces */
  var FILE = null;
  function data(force) {
    if (force || !FILE) {
      FILE = OB.getJSON('/data/obs/age_btc.json' + (force ? '?t=' + Date.now() : ''), 45000).then(function (j) {
        if (!j || !j.cols || !j.cols.sopr || !(j.n > 0)) { var e = new Error('no file'); e.status = 404; throw e; }
        return A.unpack(j);
      });
      FILE.catch(function () { FILE = null; });
    }
    return FILE;
  }
  function canvas(cv) {
    var dpr = Math.min(2, w.devicePixelRatio || 1), r = cv.getBoundingClientRect(), W = Math.max(10, r.width), H = Math.max(10, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { g.direction = 'ltr'; } catch (e) { }                   /* numbers on a chart read left to right in every language */
    return { g: g, W: W, H: H };
  }
  function seg(id, items, cur) { return OB.ui.seg(id, items, cur, 'cz-seg'); }
  function tile(label, value, sub, tone, unit) {
    return '<div class="cz-tile' + (tone ? ' ' + tone : '') + '"><small>' + esc(label) + '</small>' + (unit && value !== '—' ? '<b class="cz-uv"><bdi class="ob-n">' + esc(value) + '</bdi><em class="cz-u">' + esc(unit) + '</em></b>' : '<b class="ob-n">' + esc(value) + '</b>') + (sub ? '<span>' + esc(sub) + '</span>' : '') + '<i aria-hidden="true"></i></div>';
  }
  var RANGES = ['1y', '2y', '4y', '8y', 'all'], RY = { '1y': 1, '2y': 2, '4y': 4, '8y': 8 };
  function window0(D, i1, range) { return range === 'all' ? 0 : Math.max(0, i1 - Math.round(RY[range] * 365.25)); }
  function timeTicks(ta, tb, W) {
    var span = (tb - ta) / DAY, out = [], y0 = new Date(ta).getUTCFullYear(), y1 = new Date(tb).getUTCFullYear();
    var stepY = span > 3650 * 1.2 ? 2 : 1, every = W < 520 ? 2 : 1;
    if (span > 500) { for (var y = y0; y <= y1 + 1; y += stepY * every) { var ms = Date.UTC(y, 0, 1); if (ms >= ta && ms <= tb) out.push([ms, loc(String(y))]); } }
    else {
      var dt = new Date(ta), m = dt.getUTCMonth() + 1, yy = dt.getUTCFullYear(), stepM = span > 300 ? 3 : span > 120 ? 2 : 1;
      if (W < 520) stepM *= 2;
      for (var k = 0; k < 40; k++) { var ms2 = Date.UTC(yy, m, 1); if (ms2 > tb) break; if (ms2 >= ta) out.push([ms2, OB.axisDay(ms2)]); m += stepM; if (m > 11) { yy += Math.floor(m / 12); m %= 12; } }
    }
    return out;
  }
  function visible(el, f) {
    if (!('IntersectionObserver' in w)) { f(true); return null; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { f(e.isIntersecting); }); }, { threshold: 0 });
    io.observe(el); return io;
  }

  /* ---------------------------------------------------------------- state */
  var DEF = { range: '4y', cohort: 'sopr', smooth: 7, hview: 'galaxy', hrange: 'all' };
  var S = (function () {
    var s = OB.store.get('ek_obs_cz', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    if (RANGES.indexOf(o.range) < 0) o.range = '4y';
    if (RANGES.indexOf(o.hrange) < 0) o.hrange = 'all';
    if (['sopr', 'ssopr', 'lsopr', 'asopr'].indexOf(o.cohort) < 0) o.cohort = 'sopr';
    if ([1, 7, 30].indexOf(o.smooth) < 0) o.smooth = 7;
    if (['galaxy', 'waves'].indexOf(o.hview) < 0) o.hview = 'galaxy';
    var q = new URLSearchParams(location.search);
    if (RANGES.indexOf(q.get('range')) >= 0) { o.range = q.get('range'); o.hrange = q.get('range'); }
    if (['sopr', 'ssopr', 'lsopr', 'asopr'].indexOf(q.get('m')) >= 0) o.cohort = q.get('m');
    if (['galaxy', 'waves'].indexOf(q.get('m')) >= 0) o.hview = q.get('m');
    return o;
  })();
  var save = OB.debounce(function () { OB.store.set('ek_obs_cz', S); }, 300);
  var V = { kind: null, el: null, D: null, seq: 0, offs: [], raf: 0, io: [] };
  function cleanup() {
    V.seq++; w.cancelAnimationFrame(V.raf); V.raf = 0;
    V.offs.forEach(function (f) { f(); }); V.offs = [];
    V.io.forEach(function (o) { if (o) o.disconnect(); }); V.io = [];
  }
  function listen(target, ev, f, opt) { target.addEventListener(ev, f, opt); V.offs.push(function () { target.removeEventListener(ev, f, opt); }); }

  /* ================================================================ SOPR */
  var COH = [['sopr', 'c_all'], ['ssopr', 'c_sth'], ['lsopr', 'c_lth'], ['asopr', 'c_adj']];
  function soprShell(el) {
    el.innerHTML = '<div class="cz-tools">' +
      '<label class="ob-lbl"><span>' + esc(t('cohort')) + '</span>' + seg('cz-coh', COH.map(function (c) { return [c[0], t(c[1])]; }), S.cohort) + '</label>' +
      '<label class="ob-lbl"><span>' + esc(t('smooth')) + '</span>' + seg('cz-sm', [[1, t('s1')], [7, t('s7')], [30, t('s30')]], S.smooth) + '</label>' +
      '<label class="ob-lbl"><span>' + esc(t('range')) + '</span>' + seg('cz-rg', RANGES.map(function (r) { return [r, t('r' + r)]; }), S.range) + '</label>' +
      OB.ui.acts(true) + '</div>' +
      '<div class="cz-hero"><div class="cz-gauge"><canvas id="cz-dial" role="img" aria-label="' + esc(t('aria_gauge')) + '"></canvas><div class="cz-dialtxt" id="cz-dialtxt"></div></div>' +
      '<div class="cz-tiles" id="cz-tiles"></div></div>' +
      '<div class="cz-chart"><canvas id="cz-cv" role="img" aria-label="' + esc(t('aria_sopr')) + '"></canvas><div class="cz-hud" id="cz-hud" hidden></div>' +
      '<div class="cz-key"><span><i style="background:' + PROFIT + '"></i>' + esc(t('profit')) + '</span><span><i style="background:' + LOSS + '"></i>' + esc(t('loss')) + '</span><span><i class="cz-hz"></i>' + esc(t('horizon')) + '</span><span><i style="background:' + STAR + '"></i>' + esc(t('price')) + '</span></div></div>' +
      '<p class="cz-note" id="cz-note"></p>';
  }
  function soprTiles(D) {
    var s = A.summary(D), tiles = $('#cz-tiles', V.el), loss = s.side === 'loss';
    tiles.innerHTML =
      tile(t('t_day'), f2(s.sopr, 4), dstr(Date.parse(s.date + 'T00:00:00Z')), s.sopr >= 1 ? 'up' : 'dn') +
      tile(t('t_7'), f2(s.sopr7, 4), s.side ? t(loss ? 'side_loss' : 'side_profit') : '', s.sopr7 >= 1 ? 'up' : 'dn') +
      tile(t('t_30'), f2(s.sopr30, 4), '', s.sopr30 >= 1 ? 'up' : 'dn') +
      tile(t('t_sth'), f2(s.ssopr, 4), '', s.ssopr >= 1 ? 'up' : 'dn') +
      tile(t('t_lth'), f2(s.lsopr, 4), '', s.lsopr >= 1 ? 'up' : 'dn') +
      tile(t('t_adj'), f2(s.asopr, 4), '', s.asopr >= 1 ? 'up' : 'dn') +
      tile(t('t_rank'), pct(s.sopr7_pct, 1), t('t_rank_s', { p: loc((s.sopr7_pct || 0).toFixed(1)) }));
    var txt = $('#cz-dialtxt', V.el);
    txt.innerHTML = '<b class="ob-n ' + (loss ? 'dn' : 'up') + '">' + esc(f2(s.sopr7, 4)) + '</b><span>' + esc(t('t_7')) + '</span>' +
      '<em class="' + (loss ? 'dn' : 'up') + '">' + esc(t(loss ? 'side_loss' : 'side_profit')) + '</em>' +
      '<p>' + esc(t(loss ? 'streak_loss' : 'streak_profit', { n: loc(s.side_days || 0) })) + ' ' + esc(t(loss ? 'read_loss' : 'read_profit')) + '</p>';
    note(D);
    V.sum = s;
  }
  function note(D) {
    var c = D.checks || {}, sup = c.supply || {}, oth = c.other || {}, ok = sup.ok && oth.sopr_ok && oth.hodl_ok;
    var n = $('#cz-note', V.el); if (!n) return;
    var i1 = A.last(D.cols.sopr);
    n.innerHTML = '<span class="cz-ok" aria-hidden="true"></span>' + esc(t('asof', { d: dstr(D.t0 + i1 * DAY) })) + ' · ' + esc(ok ? t('checked') : sup.ok ? t('checked_s') : '') + ' ' + esc(t('src'));
  }
  /* the dial: an orbit from 0.94 to 1.06 (7-day mean), the break-even line at the top, a comet where today is */
  function drawDial(phase) {
    var cv = $('#cz-dial', V.el); if (!cv || !V.sum) return;
    var c = canvas(cv), g = c.g, W = c.W, H = c.H, cx = W / 2, cy = H * .58, R = Math.min(W * .44, H * .5);
    var v = V.sum.sopr7, lo = .94, hi = 1.06, f = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    var a0 = Math.PI * .85, a1 = Math.PI * 2.15, am = (a0 + a1) / 2, a = a0 + (a1 - a0) * f;
    g.clearRect(0, 0, W, H);
    /* the orbit, loss half and profit half */
    g.lineCap = 'round';
    [[a0, am, LOSS], [am, a1, PROFIT]].forEach(function (p) {
      g.strokeStyle = rgba(p[2], .16); g.lineWidth = 14; g.beginPath(); g.arc(cx, cy, R, p[0], p[1]); g.stroke();
      g.strokeStyle = rgba(p[2], .55); g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R, p[0], p[1]); g.stroke();
    });
    for (var k = 0; k <= 12; k++) {                             /* ticks every 0.01 */
      var ta = a0 + (a1 - a0) * k / 12, big = k % 6 === 0;
      g.strokeStyle = big ? 'rgba(255,255,255,.75)' : 'rgba(200,215,255,.3)'; g.lineWidth = big ? 1.6 : 1;
      g.beginPath(); g.moveTo(cx + Math.cos(ta) * (R - 12), cy + Math.sin(ta) * (R - 12)); g.lineTo(cx + Math.cos(ta) * (R - (big ? 22 : 17)), cy + Math.sin(ta) * (R - (big ? 22 : 17))); g.stroke();
    }
    g.font = '600 11px "Space Grotesk",Vazirmatn,sans-serif'; g.fillStyle = TXT; g.textAlign = 'center'; g.textBaseline = 'middle';
    [[a0, '0.94'], [am, '1.00'], [a1, '1.06']].forEach(function (p) { g.fillText(loc(p[1]), cx + Math.cos(p[0]) * (R - 34), cy + Math.sin(p[0]) * (R - 34)); });
    /* the comet and its tail along the orbit */
    var col = v >= 1 ? PROFIT : LOSS, tail = (v >= 1 ? -1 : 1) * .5, steps = 24;
    g.globalCompositeOperation = 'lighter';
    for (var s2 = steps; s2 >= 0; s2--) {
      var aa = a + tail * s2 / steps; if (aa < a0 || aa > a1) continue;
      g.fillStyle = rgba(col, .35 * (1 - s2 / steps)); g.beginPath(); g.arc(cx + Math.cos(aa) * R, cy + Math.sin(aa) * R, 5 * (1 - s2 / steps) + 1, 0, 6.283); g.fill();
    }
    var px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R, pulse = RM ? 1 : 1 + .25 * Math.sin(phase * 2.4);
    var gl = g.createRadialGradient(px, py, 0, px, py, 22 * pulse); gl.addColorStop(0, rgba(col, .9)); gl.addColorStop(.3, rgba(col, .35)); gl.addColorStop(1, rgba(col, 0));
    g.fillStyle = gl; g.beginPath(); g.arc(px, py, 22 * pulse, 0, 6.283); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, 3.6, 0, 6.283); g.fill();
    g.globalCompositeOperation = 'source-over';
  }

  function soprSeries(D) {
    var a = D.cols[S.cohort] || D.cols.sopr;
    return S.smooth > 1 ? A.roll(a, S.smooth) : a;
  }
  function drawSopr(hoverX) {
    var cv = $('#cz-cv', V.el), D = V.D; if (!cv || !D) return;
    var c = canvas(cv), g = c.g, W = c.W, H = c.H;
    var raw = D.cols[S.cohort] || D.cols.sopr, ser = soprSeries(D), price = D.cols.price, i1 = A.last(raw), i0 = window0(D, i1, S.range);
    while (i0 < i1 && ser[i0] == null) i0++;
    var ml = 8, mr = 58, mt = 12, mb = 24, gap = 14, PW = W - ml - mr, top = { y: mt, h: (H - mt - mb - gap) * .36 }, bot = { y: mt + (H - mt - mb - gap) * .36 + gap, h: (H - mt - mb - gap) * .64 };
    var X = function (i) { return ml + (i - i0) / Math.max(1, i1 - i0) * PW; };
    g.clearRect(0, 0, W, H);
    /* scales: price log; SOPR log, around 1, from the 1st to the 99th percentile of the window */
    var pv = [], sv = [];
    for (var i = i0; i <= i1; i++) { if (price[i] > 0) pv.push(price[i]); if (ser[i] > 0) sv.push(ser[i]); }
    if (!sv.length) return;
    sv.sort(function (a, b) { return a - b; });
    var slo = Math.min(.985, sv[Math.floor(sv.length * .005)]), shi = Math.max(1.015, sv[Math.min(sv.length - 1, Math.floor(sv.length * .995))]);
    var span = Math.max(Math.log(shi), -Math.log(slo)) * 1.08; slo = Math.exp(-span); shi = Math.exp(span);
    var plo = Math.min.apply(null, pv), phi = Math.max.apply(null, pv);
    var PY = function (v) { return top.y + top.h - (Math.log(v) - Math.log(plo)) / Math.max(1e-9, Math.log(phi) - Math.log(plo)) * top.h; };
    var SY = function (v) { return bot.y + bot.h - (Math.log(v) - Math.log(slo)) / (Math.log(shi) - Math.log(slo)) * bot.h; };
    /* the grid */
    g.font = '11px "Space Grotesk",Vazirmatn,sans-serif'; g.textBaseline = 'middle';
    timeTicks(D.t0 + i0 * DAY, D.t0 + i1 * DAY, W).forEach(function (tk) {
      var x = X((tk[0] - D.t0) / DAY); g.strokeStyle = GRID; g.lineWidth = 1; g.beginPath(); g.moveTo(x, mt); g.lineTo(x, H - mb); g.stroke();
      g.fillStyle = TXT; g.textAlign = 'center'; g.fillText(tk[1], x, H - mb / 2 + 2);
    });
    g.textAlign = 'left';
    var pk = [plo, Math.sqrt(plo * phi), phi];
    pk.forEach(function (v) { var y = PY(v); g.strokeStyle = GRID; g.beginPath(); g.moveTo(ml, y); g.lineTo(ml + PW, y); g.stroke(); g.fillStyle = TXT; g.fillText(loc('$' + compact(v)), ml + PW + 6, y); });
    var sk = [slo, Math.sqrt(slo), 1, Math.sqrt(shi), shi];
    sk.forEach(function (v) { var y = SY(v); if (v !== 1) { g.strokeStyle = GRID; g.beginPath(); g.moveTo(ml, y); g.lineTo(ml + PW, y); g.stroke(); } g.fillStyle = TXT; g.fillText(loc(v.toFixed(v > .9 && v < 1.1 ? 3 : 2)), ml + PW + 6, y); });
    /* the price: starlight */
    g.save(); g.lineJoin = 'round'; g.shadowColor = 'rgba(255,240,200,.7)'; g.shadowBlur = 8;
    var pg = g.createLinearGradient(0, top.y, 0, top.y + top.h); pg.addColorStop(0, '#fff6e0'); pg.addColorStop(1, '#ffc27a');
    g.strokeStyle = pg; g.lineWidth = 1.4; g.beginPath();
    var on = false, step = Math.max(1, Math.floor((i1 - i0) / (PW * 1.5)));
    for (i = i0; i <= i1; i += step) { var p = price[i]; if (!(p > 0)) { on = false; continue; } if (!on) { g.moveTo(X(i), PY(p)); on = true; } else g.lineTo(X(i), PY(p)); }
    g.stroke(); g.restore();
    /* SOPR: plasma above the horizon, red-shift below */
    var hz = SY(1);
    function path(close) {
      g.beginPath(); var st = false, lx = 0;
      for (var k = i0; k <= i1; k += step) { var v = ser[k]; if (!(v > 0)) continue; var x = X(k), y = SY(v); if (!st) { g.moveTo(x, close ? hz : y); if (close) g.lineTo(x, y); st = true; } else g.lineTo(x, y); lx = x; }
      if (close && st) { g.lineTo(lx, hz); g.closePath(); }
      return st;
    }
    if (S.smooth > 1) {                                           /* the daily values, faint, behind the mean */
      g.strokeStyle = 'rgba(200,210,255,.16)'; g.lineWidth = 1; g.beginPath(); var st2 = false;
      for (i = i0; i <= i1; i += step) { var v2 = raw[i]; if (!(v2 > 0)) continue; var y2 = SY(Math.max(slo, Math.min(shi, v2))); if (!st2) { g.moveTo(X(i), y2); st2 = true; } else g.lineTo(X(i), y2); }
      g.stroke();
    }
    if (path(true)) {
      g.save(); g.beginPath(); g.rect(ml, bot.y, PW, hz - bot.y); g.clip(); path(true);
      var gu = g.createLinearGradient(0, bot.y, 0, hz); gu.addColorStop(0, rgba(PROFIT, .55)); gu.addColorStop(1, rgba(PROFIT, .02)); g.fillStyle = gu; g.fill(); g.restore();
      g.save(); g.beginPath(); g.rect(ml, hz, PW, bot.y + bot.h - hz); g.clip(); path(true);
      var gd = g.createLinearGradient(0, hz, 0, bot.y + bot.h); gd.addColorStop(0, rgba(LOSS, .02)); gd.addColorStop(1, rgba(LOSS, .55)); g.fillStyle = gd; g.fill(); g.restore();
    }
    var f = Math.max(0, Math.min(1, (hz - bot.y) / bot.h)), ls = g.createLinearGradient(0, bot.y, 0, bot.y + bot.h);
    ls.addColorStop(0, PROFIT); ls.addColorStop(Math.max(0, f - .001), PROFIT); ls.addColorStop(Math.min(1, f + .001), LOSS); ls.addColorStop(1, LOSS);
    g.save(); g.shadowColor = 'rgba(160,240,255,.55)'; g.shadowBlur = 10; g.strokeStyle = ls; g.lineWidth = 1.7; g.lineJoin = 'round'; path(false); g.stroke(); g.restore();
    /* the horizon */
    g.save(); g.setLineDash([5, 5]); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1; g.shadowColor = '#fff'; g.shadowBlur = 6;
    g.beginPath(); g.moveTo(ml, hz); g.lineTo(ml + PW, hz); g.stroke(); g.restore();
    /* the pointer */
    var hud = $('#cz-hud', V.el);
    if (hoverX == null || hoverX < ml || hoverX > ml + PW) { hud.hidden = true; V.hi = null; return; }
    var hi = Math.round(i0 + (hoverX - ml) / PW * (i1 - i0)); hi = Math.max(i0, Math.min(i1, hi)); V.hi = hi;
    var hx = X(hi);
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(hx, mt); g.lineTo(hx, H - mb); g.stroke();
    if (ser[hi] > 0) { var hy = SY(ser[hi]), cc = ser[hi] >= 1 ? PROFIT : LOSS; g.fillStyle = cc; g.shadowColor = cc; g.shadowBlur = 14; g.beginPath(); g.arc(hx, hy, 4, 0, 6.283); g.fill(); g.shadowBlur = 0; }
    if (price[hi] > 0) { g.fillStyle = STAR; g.beginPath(); g.arc(hx, PY(price[hi]), 3, 0, 6.283); g.fill(); }
    var lab = COH.filter(function (x) { return x[0] === S.cohort; })[0][1];
    hud.innerHTML = '<b>' + esc(dstr(D.t0 + hi * DAY)) + '</b>' +
      '<span><i style="background:' + STAR + '"></i>' + esc(t('price')) + ' <em class="ob-n">' + esc(price[hi] > 0 ? '$' + OB.fmtP(price[hi]) : '—') + '</em></span>' +
      '<span><i style="background:' + (ser[hi] >= 1 ? PROFIT : LOSS) + '"></i>' + esc(t(lab)) + (S.smooth > 1 ? ' · ' + esc(t('s' + S.smooth)) : '') + ' <em class="ob-n">' + esc(f2(ser[hi], 4)) + '</em></span>' +
      (S.smooth > 1 ? '<span><i style="background:rgba(200,210,255,.5)"></i>' + esc(t('s1')) + ' <em class="ob-n">' + esc(f2(raw[hi], 4)) + '</em></span>' : '');
    hud.hidden = false;
    var hw = hud.offsetWidth, left = hx + 14 + hw > W ? hx - 14 - hw : hx + 14;
    hud.style.left = Math.max(4, left) + 'px'; hud.style.top = (bot.y + 6) + 'px';
  }
  function soprCsv() {
    var D = V.D; if (!D) return;
    var rows = [['date', 'price_usd', 'sopr', 'sopr_short_term', 'sopr_long_term', 'sopr_adjusted']];
    for (var i = 0; i < D.n; i++) { if (D.cols.sopr[i] == null) continue; rows.push([new Date(D.t0 + i * DAY).toISOString().slice(0, 10), D.cols.price[i], D.cols.sopr[i], D.cols.ssopr[i], D.cols.lsopr[i], D.cols.asopr[i]]); }
    OB.csv('entekhab-btc-sopr.csv', rows);
  }

  /* ================================================================ HODL waves */
  function hodlShell(el) {
    el.innerHTML = '<div class="cz-tools">' +
      '<label class="ob-lbl"><span>&#8203;</span>' + seg('cz-hv', [['galaxy', t('v_galaxy')], ['waves', t('v_waves')]], S.hview) + '</label>' +
      '<label class="ob-lbl" id="cz-hrw"' + (S.hview === 'waves' ? '' : ' hidden') + '><span>' + esc(t('range')) + '</span>' + seg('cz-hr', RANGES.map(function (r) { return [r, t('r' + r)]; }), S.hrange) + '</label>' +
      OB.ui.acts(true) + '</div>' +
      '<div class="cz-tiles cz-row" id="cz-tiles"></div>' +
      '<div class="cz-gal" id="cz-gal"' + (S.hview === 'galaxy' ? '' : ' hidden') + '>' +
        '<div class="cz-galbox"><canvas id="cz-gcv" role="img" aria-label="' + esc(t('aria_galaxy')) + '"></canvas><div class="cz-hud" id="cz-ghud" hidden></div></div>' +
        '<div class="cz-side"><h3>' + esc(t('legend')) + '</h3><ol class="cz-leg" id="cz-leg"></ol><p class="cz-core">' + esc(t('core')) + '</p></div>' +
        '<div class="cz-tm"><button type="button" class="cz-play" id="cz-play" aria-pressed="false"><span aria-hidden="true">▶</span><b>' + esc(t('play')) + '</b></button>' +
          '<label class="cz-tmr"><span>' + esc(t('tm')) + '</span><input type="range" id="cz-day" min="0" max="1" step="1" value="1"></label>' +
          '<output class="cz-tmd ob-n" id="cz-tmd" for="cz-day"></output><button type="button" class="cz-today" id="cz-today">' + esc(t('today')) + '</button></div>' +
      '</div>' +
      '<div class="cz-chart cz-waves" id="cz-wv"' + (S.hview === 'waves' ? '' : ' hidden') + '><canvas id="cz-wcv" role="img" aria-label="' + esc(t('aria_waves')) + '"></canvas><div class="cz-hud" id="cz-whud" hidden></div></div>' +
      '<p class="cz-note" id="cz-note"></p>';
  }
  function hodlTiles(D) {
    var s = A.summary(D), up = (s.old1y_chg365 || 0) >= 0;
    $('#cz-tiles', V.el).innerHTML =
      tile(t('t_old'), pct(s.old1y, 2), t('of_all'), up ? 'up' : 'dn') +
      tile(t('t_young'), pct(s.young6m, 2), t('of_all')) +
      tile(t('t_lthsh'), pct(s.lth, 2), '') +
      tile(t('t_c30'), sgn(s.old1y_chg30), '', (s.old1y_chg30 || 0) >= 0 ? 'up' : 'dn', t('pts', { v: '' }).trim()) +
      tile(t('t_c365'), sgn(s.old1y_chg365), t(up ? 'read_up' : 'read_dn'), up ? 'up' : 'dn', t('pts', { v: '' }).trim()) +
      tile(t('t_orank'), pct(s.old1y_pct, 1), t('t_rank_s', { p: loc((s.old1y_pct || 0).toFixed(1)) }));
    note(D);
  }
  /* --- the galaxy */
  var G = { q: 0, cur: null, tgt: null, parts: [], hover: -1, playing: false, vis: true, last: 0, ph: 0 };
  function galBands(q) { return A.bandsAt(V.D, q); }
  function galSeed() {
    var n = RM ? 0 : (w.innerWidth < 640 ? 650 : 1300);
    G.parts = [];
    for (var i = 0; i < n; i++) G.parts.push({ u: Math.random(), th: Math.random() * 6.283, k: 0, sz: Math.random() < .08 ? 1.8 : .7 + Math.random() * .8, tw: Math.random() * 6.28 });
    galAssign();
  }
  function galAssign() {                                         /* particles per band ∝ its share */
    var b = G.tgt; if (!b) return;
    var n = G.parts.length, acc = 0, k = 0, cum = [];
    b.forEach(function (v) { acc += v; cum.push(acc); });
    for (var i = 0; i < n; i++) { var x = (i + .5) / n * acc; while (k < cum.length - 1 && x > cum[k]) k++; G.parts[i].k = k; }
  }
  function radii(b, R, r0) {                                     /* ring k spans [r[k], r[k+1]]: area ∝ share */
    var tot = b.reduce(function (s, v) { return s + v; }, 0) || 1, out = [r0], acc = 0;
    for (var k = 0; k < b.length; k++) { acc += b[k] / tot; out.push(Math.sqrt(r0 * r0 + acc * (R * R - r0 * r0))); }
    return out;
  }
  function galDraw(now) {
    var cv = $('#cz-gcv', V.el); if (!cv || !G.cur) return;
    if (!G.ctx || G.ctx.cv !== cv || G.ctx.W !== cv.getBoundingClientRect().width) { var c0 = canvas(cv); G.ctx = { cv: cv, g: c0.g, W: c0.W, H: c0.H }; }
    var g = G.ctx.g, W = G.ctx.W, H = G.ctx.H, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 10, r0 = R * .12;
    var dt = G.last ? Math.min(.1, (now - G.last) / 1000) : 0; G.last = now; G.ph += dt;
    for (var k = 0; k < 13; k++) G.cur[k] += (G.tgt[k] - G.cur[k]) * (RM ? 1 : Math.min(1, dt * 6 || 1));
    var r = radii(G.cur, R, r0);
    g.clearRect(0, 0, W, H);
    /* the halo behind the disc */
    var halo = g.createRadialGradient(cx, cy, r0, cx, cy, R * 1.05); halo.addColorStop(0, 'rgba(120,140,255,.10)'); halo.addColorStop(.7, 'rgba(150,80,255,.06)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, R * 1.05, 0, 6.283); g.fill();
    /* the rings: each a band of light between dark lanes; its area is the band's share */
    for (k = 0; k < 13; k++) {
      var hv = G.hover === k, ri = r[k] + .8, ro = r[k + 1] - .8; if (ro <= ri) continue;
      var a = hv ? .55 : G.hover >= 0 ? .07 : k >= 9 ? .3 : .22, rg = g.createRadialGradient(cx, cy, ri, cx, cy, ro);
      rg.addColorStop(0, rgba(BAND_C[k], a * .55)); rg.addColorStop(.55, rgba(BAND_C[k], a)); rg.addColorStop(1, rgba(BAND_C[k], a * .7));
      g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, ro, 0, Math.PI * 2); g.arc(cx, cy, ri, Math.PI * 2, 0, true); g.fill();
      g.strokeStyle = rgba(BAND_C[k], hv ? .95 : G.hover >= 0 ? .15 : .45); g.lineWidth = hv ? 1.6 : .7; g.beginPath(); g.arc(cx, cy, ro, 0, Math.PI * 2); g.stroke();
    }
    /* a ruler from the core to the rim, with each wide ring's share written on it */
    var ang = -Math.PI / 4, ca = Math.cos(ang), sa = Math.sin(ang);
    g.strokeStyle = 'rgba(230,236,255,.28)'; g.lineWidth = 1; g.setLineDash([2, 4]);
    g.beginPath(); g.moveTo(cx + ca * r0, cy + sa * r0); g.lineTo(cx + ca * (R + 4), cy + sa * (R + 4)); g.stroke(); g.setLineDash([]);
    g.font = '600 11px "Space Grotesk",Vazirmatn,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (k = 0; k < 13; k++) {
      var mid = (r[k] + r[k + 1]) / 2, thick = r[k + 1] - r[k];
      if (thick < 15 && G.hover !== k) continue;
      var lx = cx + ca * mid, ly = cy + sa * mid, lab = pct(G.cur[k], 1), tw = g.measureText(lab).width + 10;
      g.fillStyle = 'rgba(5,7,22,.78)'; g.beginPath(); g.roundRect ? g.roundRect(lx - tw / 2, ly - 8, tw, 16, 8) : g.rect(lx - tw / 2, ly - 8, tw, 16); g.fill();
      g.fillStyle = G.hover === k ? '#fff' : rgba(BAND_C[k], .95); g.fillText(lab, lx, ly + .5);
    }
    /* the core: a young star with four rays */
    var pulse = RM ? 1 : 1 + .06 * Math.sin(G.ph * 1.7);
    var core = g.createRadialGradient(cx, cy, 0, cx, cy, r0 * 1.9 * pulse);
    core.addColorStop(0, 'rgba(255,255,255,1)'); core.addColorStop(.25, 'rgba(225,240,255,.85)'); core.addColorStop(.6, 'rgba(140,190,255,.25)'); core.addColorStop(1, 'rgba(120,160,255,0)');
    g.fillStyle = core; g.beginPath(); g.arc(cx, cy, r0 * 1.9 * pulse, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'lighter';
    [[1, 0], [0, 1]].forEach(function (v) {
      var L2 = r0 * 2.6 * pulse, sg = g.createLinearGradient(cx - v[0] * L2, cy - v[1] * L2, cx + v[0] * L2, cy + v[1] * L2);
      sg.addColorStop(0, 'rgba(200,225,255,0)'); sg.addColorStop(.5, 'rgba(235,245,255,.75)'); sg.addColorStop(1, 'rgba(200,225,255,0)');
      g.strokeStyle = sg; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - v[0] * L2, cy - v[1] * L2); g.lineTo(cx + v[0] * L2, cy + v[1] * L2); g.stroke();
    });
    g.globalCompositeOperation = 'source-over';
    /* the stars in orbit: faster for young coins */
    g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < G.parts.length; i++) {
      var p = G.parts[i], kk = p.k, rin = r[kk], rout = r[kk + 1];
      if (rout - rin < .3) continue;
      p.th += dt * 1.1 / Math.sqrt(AGE_D[kk]);
      var rr = rin + (rout - rin) * p.u, x = cx + Math.cos(p.th) * rr, y = cy + Math.sin(p.th) * rr * .999;
      var al = (G.hover < 0 || G.hover === kk ? .85 : .18) * (.6 + .4 * Math.sin(G.ph * 2 + p.tw));
      g.fillStyle = rgba(BAND_C[kk], al); g.fillRect(x - p.sz / 2, y - p.sz / 2, p.sz, p.sz);
    }
    g.globalCompositeOperation = 'source-over';
    G.r = r; G.cx = cx; G.cy = cy;
  }
  function galLoop(now) {
    V.raf = 0;
    if (!V.el || V.kind !== 'hodl' || S.hview !== 'galaxy') return;
    if (G.playing) {
      var step = 7, i1 = A.last(V.D.cols.b_d1);
      if (now - (G.pl || 0) > 40) { G.pl = now; galSet(Math.min(i1, G.q + step), true); if (G.q >= i1) playStop(); }
    }
    galDraw(now);
    if ((!RM || G.playing) && G.vis && !d.hidden) V.raf = w.requestAnimationFrame(galLoop);
  }
  function galKick() { if (!V.raf) V.raf = w.requestAnimationFrame(galLoop); }
  function galSet(q, keepSlider) {
    var b = galBands(q); if (!b) return;
    G.q = q; G.tgt = b.slice(); if (!G.cur) G.cur = b.slice();
    galAssign();
    var inp = $('#cz-day', V.el); if (inp && !keepSlider) inp.value = q; else if (inp) inp.value = q;
    var out = $('#cz-tmd', V.el); if (out) out.textContent = dstr(V.D.t0 + q * DAY);
    legend();
    if (RM && !G.playing) { G.cur = b.slice(); galDraw(performance.now()); }
    galKick();
  }
  function legend() {
    var D = V.D, q = G.q, b = galBands(q); if (!b) return;
    var q30 = q - 30, b30 = galBands(q30), sply = D.cols.sply[q];
    $('#cz-leg', V.el).innerHTML = A.BANDS.map(function (key, k) {
      var ch = b30 ? b[k] - b30[k] : null;
      return '<li data-k="' + k + '" class="' + (G.hover === k ? 'on' : '') + '"><i style="background:' + BAND_C[k] + ';box-shadow:0 0 10px ' + BAND_C[k] + '"></i><span>' + esc(t('b_' + key)) + '</span>' +
        '<b class="ob-n">' + esc(pct(b[k], 2)) + '</b><em class="ob-n ' + (ch == null ? '' : ch >= 0 ? 'up' : 'dn') + '">' + esc(ch == null ? '' : sgn(ch)) + '</em>' +
        '<u style="width:' + Math.max(1, Math.min(100, b[k] * 3)).toFixed(1) + '%;background:' + BAND_C[k] + '"></u>' +
        (sply ? '<small class="ob-n">' + esc(t('btc', { v: loc(compact(sply * b[k] / 100)) })) + '</small>' : '') + '</li>';
    }).join('');
  }
  function galHover(e) {
    if (!G.r) return;
    var cv = $('#cz-gcv', V.el), rc = cv.getBoundingClientRect(), x = e.clientX - rc.left - G.cx, y = e.clientY - rc.top - G.cy, rr = Math.sqrt(x * x + y * y), k = -1;
    for (var i = 0; i < 13; i++) if (rr >= G.r[i] && rr < G.r[i + 1]) k = i;
    setHover(k, e.clientX - rc.left, e.clientY - rc.top);
  }
  function setHover(k, hx, hy) {
    G.hover = k;
    var hud = $('#cz-ghud', V.el), b = galBands(G.q);
    OB.$$('#cz-leg li', V.el).forEach(function (li) { li.classList.toggle('on', +li.getAttribute('data-k') === k); });
    if (k < 0 || !b) { hud.hidden = true; } else {
      var sply = V.D.cols.sply[G.q];
      hud.innerHTML = '<b><i style="background:' + BAND_C[k] + '"></i>' + esc(t('b_' + A.BANDS[k])) + '</b><span><em class="ob-n">' + esc(pct(b[k], 2)) + '</em> ' + esc(t('of_all')) + '</span>' +
        (sply ? '<span class="ob-n">' + esc(t('btc', { v: loc(OB.fmtP(Math.round(sply * b[k] / 100))) })) + '</span>' : '') + '<span>' + esc(dstr(V.D.t0 + G.q * DAY)) + '</span>';
      hud.hidden = false;
      if (hx != null) { var box = hud.parentNode.getBoundingClientRect(); hud.style.left = Math.min(box.width - hud.offsetWidth - 4, hx + 14) + 'px'; hud.style.top = Math.max(4, hy - 10) + 'px'; }
      else { hud.style.left = '8px'; hud.style.top = '8px'; }
    }
    if (RM) galDraw(performance.now()); else galKick();
  }
  function playStart() { if (G.q >= A.last(V.D.cols.b_d1)) galSet(firstBand()); G.playing = true; playBtn(); galKick(); }
  function playStop() { G.playing = false; playBtn(); }
  function playBtn() { var b = $('#cz-play', V.el); if (!b) return; b.setAttribute('aria-pressed', G.playing ? 'true' : 'false'); b.innerHTML = '<span aria-hidden="true">' + (G.playing ? '❚❚' : '▶') + '</span><b>' + esc(t(G.playing ? 'pause' : 'play')) + '</b>'; }
  function firstBand() { var a = V.D.cols.b_d1; for (var i = 0; i < a.length; i++) if (a[i] != null && i * DAY + V.D.t0 >= Date.UTC(2010, 6, 17)) return i; return 0; }

  /* --- the waves through time */
  function drawWaves(hoverX) {
    var cv = $('#cz-wcv', V.el), D = V.D; if (!cv || !D) return;
    var c = canvas(cv), g = c.g, W = c.W, H = c.H, i1 = A.last(D.cols.b_d1), i0 = Math.max(firstBand(), window0(D, i1, S.hrange));
    var ml = 8, mr = 58, mt = 12, mb = 24, PW = W - ml - mr, PH = H - mt - mb, X = function (i) { return ml + (i - i0) / Math.max(1, i1 - i0) * PW; };
    var Y = function (p) { return mt + PH - p / 100 * PH; };
    g.clearRect(0, 0, W, H);
    var step = Math.max(1, Math.floor((i1 - i0) / (PW * 1.2))), idx = [];
    for (var i = i0; i <= i1; i += step) idx.push(i);
    if (idx[idx.length - 1] !== i1) idx.push(i1);
    /* stacked from the oldest (bottom) to the newest (top) */
    var base = idx.map(function () { return 0; });
    for (var k = 12; k >= 0; k--) {
      var col = D.cols['b_' + A.BANDS[k]], topv = idx.map(function (q, j) { return base[j] + (col[q] || 0) / 100; });
      g.beginPath(); g.moveTo(X(idx[0]), Y(topv[0]));
      for (var j = 1; j < idx.length; j++) g.lineTo(X(idx[j]), Y(topv[j]));
      for (j = idx.length - 1; j >= 0; j--) g.lineTo(X(idx[j]), Y(base[j]));
      g.closePath();
      var gr = g.createLinearGradient(0, mt, 0, mt + PH); gr.addColorStop(0, rgba(BAND_C[k], .92)); gr.addColorStop(1, rgba(BAND_C[k], .62));
      g.fillStyle = gr; g.globalAlpha = V.wh >= 0 && V.wh !== k ? .35 : 1; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = 'rgba(5,6,20,.35)'; g.lineWidth = .6; g.stroke();
      base = topv;
    }
    /* soft cosmic sheen over the stack */
    var sh = g.createLinearGradient(0, mt, 0, mt + PH); sh.addColorStop(0, 'rgba(255,255,255,.10)'); sh.addColorStop(.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,30,.25)');
    g.fillStyle = sh; g.fillRect(ml, mt, PW, PH);
    /* the grid and axes */
    g.font = '11px "Space Grotesk",Vazirmatn,sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
    [0, 25, 50, 75, 100].forEach(function (p) { var y = Y(p); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.beginPath(); g.moveTo(ml, y); g.lineTo(ml + PW, y); g.stroke(); g.fillStyle = TXT; g.fillText(loc(p) + (OB.lang() === 'en' ? '%' : '٪'), ml + PW + 6, y); });
    timeTicks(D.t0 + i0 * DAY, D.t0 + i1 * DAY, W).forEach(function (tk) { var x = X((tk[0] - D.t0) / DAY); g.fillStyle = TXT; g.textAlign = 'center'; g.fillText(tk[1], x, H - mb / 2 + 2); });
    /* the price, log, over the waves */
    var pr = D.cols.price, pv = []; idx.forEach(function (q) { if (pr[q] > 0) pv.push(pr[q]); });
    if (pv.length) {
      var lo = Math.log(Math.min.apply(null, pv)), hi = Math.log(Math.max.apply(null, pv)), PYv = function (v) { return mt + PH * .04 + (1 - (Math.log(v) - lo) / Math.max(1e-9, hi - lo)) * PH * .92; };
      g.save(); g.shadowColor = '#000'; g.shadowBlur = 6; g.strokeStyle = 'rgba(5,6,20,.7)'; g.lineWidth = 3.2; g.beginPath(); var st = false;
      idx.forEach(function (q) { if (!(pr[q] > 0)) return; if (!st) { g.moveTo(X(q), PYv(pr[q])); st = true; } else g.lineTo(X(q), PYv(pr[q])); }); g.stroke();
      g.shadowColor = 'rgba(255,240,200,.9)'; g.shadowBlur = 8; g.strokeStyle = STAR; g.lineWidth = 1.4; g.stroke(); g.restore();
      V.wpy = PYv;
    }
    var hud = $('#cz-whud', V.el);
    if (hoverX == null || hoverX < ml || hoverX > ml + PW) { hud.hidden = true; return; }
    var hq = Math.round(i0 + (hoverX - ml) / PW * (i1 - i0)); hq = Math.max(i0, Math.min(i1, hq));
    var hx = X(hq); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(hx, mt); g.lineTo(hx, mt + PH); g.stroke();
    var b = A.bandsAt(D, hq);
    hud.innerHTML = '<b>' + esc(dstr(D.t0 + hq * DAY)) + (pr[hq] > 0 ? ' · <em class="ob-n">$' + esc(OB.fmtP(pr[hq])) + '</em>' : '') + '</b>' + (b ? A.BANDS.map(function (key, k) {
      return '<span><i style="background:' + BAND_C[k] + '"></i>' + esc(t('b_' + key)) + ' <em class="ob-n">' + esc(pct(b[k], 2)) + '</em></span>';
    }).join('') : '');
    hud.hidden = false;
    var hw = hud.offsetWidth; hud.style.left = Math.max(4, hx + 14 + hw > W ? hx - 14 - hw : hx + 14) + 'px'; hud.style.top = (mt + 4) + 'px';
  }
  function hodlCsv() {
    var D = V.D; if (!D) return;
    var rows = [['date', 'price_usd'].concat(A.BANDS.map(function (k) { return 'share_pct_' + k; })).concat(['btc_in_existence'])];
    for (var i = 0; i < D.n; i++) { var b = A.bandsAt(D, i); if (!b) continue; rows.push([new Date(D.t0 + i * DAY).toISOString().slice(0, 10), D.cols.price[i]].concat(b).concat([D.cols.sply[i]])); }
    OB.csv('entekhab-btc-hodl-waves.csv', rows);
  }

  /* ================================================================ mount */
  function status(html) { var v = $('.cz-body', V.el); if (v) v.innerHTML = html; }
  function load(force) {
    var seq = ++V.seq;
    var body = $('.cz-body', V.el);
    body.innerHTML = '<div class="cz-wait"><span class="cz-orbit" aria-hidden="true"><i></i></span>' + esc(t('loading')) + '</div>';
    data(force).then(function (D) {
      if (seq !== V.seq) return;
      V.D = D; render();
    }, function () {
      if (seq !== V.seq) return;
      status('<div class="cz-wait cz-err">' + esc(t('err')) + ' <button type="button" class="cz-btn" id="cz-retry">' + esc(t('retry')) + '</button></div>');
    });
  }
  function render() {
    var body = $('.cz-body', V.el), D = V.D; if (!body || !D) return;
    cleanup(); V.seq++;
    var seq = V.seq;
    if (V.kind === 'sopr') {
      soprShell(body); soprTiles(D);
      var cv = $('#cz-cv', V.el), mv = function (e) { var r = cv.getBoundingClientRect(); V.hx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left; drawSopr(V.hx); };
      listen(cv, 'mousemove', mv); listen(cv, 'touchstart', mv, { passive: true }); listen(cv, 'touchmove', mv, { passive: true });
      listen(cv, 'mouseleave', function () { V.hx = null; drawSopr(null); });
      drawSopr(null);
      var dialLoop = function (now) { V.raf = 0; if (seq !== V.seq) return; drawDial(now / 1000); if (!RM && !d.hidden && V.dvis !== false) V.raf = w.requestAnimationFrame(dialLoop); };
      V.io.push(visible($('#cz-dial', V.el), function (on) { V.dvis = on; if (on && !V.raf) V.raf = w.requestAnimationFrame(dialLoop); }));
      drawDial(0);
      if (!RM) V.raf = w.requestAnimationFrame(dialLoop);
      var rs = function () { drawSopr(V.hx); drawDial(performance.now() / 1000); }; OB.on('resize', rs); V.offs.push(function () { OB.off('resize', rs); });
    } else {
      hodlShell(body); hodlTiles(D);
      var i1 = A.last(D.cols.b_d1), inp = $('#cz-day', V.el);
      inp.min = firstBand(); inp.max = i1; inp.value = i1;
      G.cur = null; G.hover = -1; G.playing = false; G.ctx = null; G.last = 0; G.tgt = galBands(i1);
      galSeed(); galSet(i1);
      var gcv = $('#cz-gcv', V.el);
      listen(gcv, 'mousemove', galHover); listen(gcv, 'mouseleave', function () { setHover(-1); });
      listen(gcv, 'touchstart', function (e) { if (e.touches[0]) galHover(e.touches[0]); }, { passive: true });
      listen(inp, 'input', function () { if (G.playing) playStop(); galSet(+inp.value, true); });
      var leg = $('#cz-leg', V.el);
      listen(leg, 'mouseover', function (e) { var li = e.target.closest('li'); if (li) setHover(+li.getAttribute('data-k')); });
      listen(leg, 'mouseleave', function () { setHover(-1); });
      listen(leg, 'click', function (e) { var li = e.target.closest('li'); if (li) setHover(G.hover === +li.getAttribute('data-k') ? -1 : +li.getAttribute('data-k')); });
      V.io.push(visible(gcv, function (on) { G.vis = on; if (on) galKick(); }));
      var wcv = $('#cz-wcv', V.el), wm = function (e) { var r = wcv.getBoundingClientRect(); V.whx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left; drawWaves(V.whx); };
      V.wh = -1;
      listen(wcv, 'mousemove', wm); listen(wcv, 'touchstart', wm, { passive: true }); listen(wcv, 'touchmove', wm, { passive: true });
      listen(wcv, 'mouseleave', function () { V.whx = null; drawWaves(null); });
      if (S.hview === 'waves') drawWaves(null);
      var rs2 = function () { G.ctx = null; if (S.hview === 'waves') drawWaves(V.whx); else galKick(); if (RM) galDraw(performance.now()); };
      OB.on('resize', rs2); V.offs.push(function () { OB.off('resize', rs2); });
      var vis = function () { if (!d.hidden) galKick(); }; listen(d, 'visibilitychange', vis);
    }
  }
  function mount(kind, el) {
    V.kind = kind; V.el = el;
    d.documentElement.classList.add('cz-on'); d.body.classList.add('cz-on'); sky();
    var ob = d.getElementById('ob'); if (ob) ob.classList.add('cz-ob');
    el.innerHTML = '<div class="cz-body"></div>';
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      var sg = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null, v = b.getAttribute('data-v');
      if (sg === 'cz-coh' && v !== S.cohort) { S.cohort = v; OB.ui.setSeg(el, sg, v); save(); drawSopr(V.hx); }
      else if (sg === 'cz-sm' && +v !== S.smooth) { S.smooth = +v; OB.ui.setSeg(el, sg, v); save(); drawSopr(V.hx); }
      else if (sg === 'cz-rg' && v !== S.range && RANGES.indexOf(v) >= 0) { S.range = v; OB.ui.setSeg(el, sg, v); save(); drawSopr(V.hx); }
      else if (sg === 'cz-hr' && v !== S.hrange && RANGES.indexOf(v) >= 0) { S.hrange = v; OB.ui.setSeg(el, sg, v); save(); drawWaves(V.whx); }
      else if (sg === 'cz-hv' && v !== S.hview) {
        S.hview = v; OB.ui.setSeg(el, sg, v); save();
        $('#cz-gal', el).hidden = v !== 'galaxy'; $('#cz-wv', el).hidden = v !== 'waves'; $('#cz-hrw', el).hidden = v !== 'waves';
        if (v === 'waves') { playStop(); drawWaves(null); } else { G.ctx = null; galKick(); if (RM) galDraw(performance.now()); }
      }
      else if (b.id === 'cz-play') { if (G.playing) playStop(); else playStart(); }
      else if (b.id === 'cz-today') { playStop(); galSet(A.last(V.D.cols.b_d1)); }
      else if (b.id === 'ob-refresh' || b.id === 'cz-retry') { FILE = null; load(true); }
      else if (b.id === 'ob-full') { OB.fullscreen(d.getElementById('ob')); setTimeout(function () { OB.emit('resize'); }, 60); }
      else if (b.id === 'ob-png') {
        var cvs = kind === 'sopr' ? $('#cz-cv', el) : (S.hview === 'galaxy' ? $('#cz-gcv', el) : $('#cz-wcv', el)); if (!cvs) return;
        var out = d.createElement('canvas'); out.width = cvs.width; out.height = cvs.height;
        var q = out.getContext('2d'), bg = q.createLinearGradient(0, 0, 0, out.height); bg.addColorStop(0, '#03040c'); bg.addColorStop(1, '#0a0620');
        q.fillStyle = bg; q.fillRect(0, 0, out.width, out.height); q.drawImage(cvs, 0, 0);
        q.font = Math.round(out.width / 70) + 'px sans-serif'; q.fillStyle = 'rgba(255,255,255,.5)'; q.textAlign = 'right'; q.fillText('entekhab.net', out.width - 12, out.height - 12);
        var a = d.createElement('a'); a.href = out.toDataURL('image/png'); a.download = 'entekhab-' + (kind === 'sopr' ? 'sopr' : 'hodl-waves') + '.png'; d.body.appendChild(a); a.click(); a.remove();
      }
      else if (b.id === 'ob-share') OB.ui.share({ range: kind === 'sopr' ? S.range : (S.hview === 'waves' ? S.hrange : null), m: kind === 'sopr' ? S.cohort : S.hview });
      else if (b.id === 'ob-csv') { if (kind === 'sopr') soprCsv(); else hodlCsv(); }
    };
    load();
  }
  function unmount() { cleanup(); G.playing = false; V.D = null; d.documentElement.classList.remove('cz-on'); d.body.classList.remove('cz-on'); var ob = d.getElementById('ob'); if (ob) ob.classList.remove('cz-ob'); }
  ['sopr', 'hodl'].forEach(function (k) { OB.views[k] = { mount: function (el) { mount(k, el); }, unmount: unmount }; });
})();
