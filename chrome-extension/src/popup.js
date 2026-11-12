/* Entekhab Chrome extension — popup */
'use strict';
const SITE = 'https://entekhab.net';
const $ = s => document.querySelector(s);
const T = {
  fa: { offline: 'اینترنت وصل نیست؛ چیزی هم ذخیره نشده بود.', later: 'این بخش هنوز منتشر نشده است؛ کمی بعد دوباره سر بزن.', retry: 'تلاش دوباره', loading: 'در حال دریافت…', pgMore: 'ادامه', toTop: 'برگشت به بالا', tEnc: 'دانشنامه', encSearch: 'واژه را بنویس…', encNone: 'چیزی پیدا نشد', encHint: 'جست‌وجو در ۵۰۶ واژه، به سه زبان', encLoad: 'در حال بارگذاری دانشنامه…', encFull: 'صفحهٔ واژه', tCalc: 'ماشین‌حساب', kSize: '📐 حجم پوزیشن', kRR: '⚖️ ریسک به بازده', kPnl: '💰 سود و زیان', kLiq: '💥 قیمت لیکوئید', kFee: '🧾 کارمزد', cap: 'سرمایه ($)', risk: 'ریسک ٪', entry: 'ورود', stop: 'حد ضرر', target: 'حد سود', exit: 'خروج', qty: 'مقدار (واحد)', lev: 'اهرم', feeSide: 'کارمزد هر طرف ٪', feeRT: 'کارمزد رفت و برگشت ٪', winExp: 'نرخ برد مورد انتظار ٪', mmr: 'مارجین نگهداری ٪', side: 'جهت', long: 'لانگ', short: 'شورت', amount: 'مبلغ معامله ($)', maker: 'Maker ٪', taker: 'Taker ٪', perMonth: 'معامله در ماه', oRiskAmt: 'مبلغ ریسک', oStopDist: 'فاصلهٔ حد ضرر', oQty: 'حجم (واحد)', oNotional: 'ارزش پوزیشن', oLev: 'اهرم لازم', oLoss: 'زیان روی حد ضرر', oRR: 'ریسک به بازده (با کارمزد)', oBE: 'نرخ برد سربه‌سر', oEV: 'امید ریاضی هر معامله', oVerdict: 'وضعیت با نرخ برد شما', oGross: 'سود/زیان ناخالص', oFee: 'کارمزد کل', oNet: 'سود/زیان خالص', oMargin: 'مارجین درگیر', oROE: 'بازده روی مارجین', oChg: 'تغییر قیمت', oLiq: 'قیمت تقریبی لیکوئید', oDist: 'فاصله تا لیکوئید', oWipe: 'حرکت خلافی که مارجین را می‌برد', oTT: 'ورود و خروج Taker', oMT: 'ورود Maker، خروج Taker', oMonthly: 'هزینهٔ ماهانه (Taker)', oBEmove: 'حرکت لازم برای سربه‌سر', noLev: 'بدون اهرم', posi: 'مثبت', nega: 'منفی', evenv: 'سربه‌سر', cHint: 'قیمت ورود از نرخ زندهٔ همین افزونه پر می‌شود. محاسبه‌ها تقریبی و آموزشی‌اند؛ لغزش و پلکان نرخ صرافی لحاظ نمی‌شود.', brand: 'انتخاب', tMarket: 'بازار', tReport: 'گزارش', tPosts: 'کانال', tAlerts: 'هشدار', search: 'جست‌وجوی کوین…', above: 'بالاتر از', below: 'پایین‌تر از', add: 'افزودن',
    tip: 'قیمت در راهنمای آیکون', tipNote: 'روی خود آیکون هیچ عددی نوشته نمی‌شود تا لوگو همیشه کامل دیده شود؛ قیمت با نگه‌داشتن ماوس روی آیکون دیده می‌شود.', newVer: 'نسخهٔ تازهٔ افزونه آماده است', getIt: 'دریافت', satoshi: '₿ ساتوشی', map: '🗺 نقشهٔ یادگیری', battle: '⚔️ نبرد من', apps: '📲 اپلیکیشن‌ها',
    settings: 'تنظیمات', notifyPosts: 'اعلان پست‌های تازهٔ Coin_Kurd', privacy: 'همهٔ تنظیمات فقط روی همین مرورگر ذخیره می‌شود و هیچ اطلاعاتی از شما ارسال نمی‌شود.',
    tAnalysis: 'تحلیل', tReality: 'واقعیت‌سنج', rlFull: 'صفحهٔ کامل', rlNone: 'هنوز داده‌ای نیست', anHow: 'در هشت بخش، با دادهٔ زمان‌دار و بدون عدد ساختگی', anNone: 'هنوز تحلیلی منتشر نشده است', anFull: 'متن کامل', anMissing: 'بدون دسترسی به:', enc: '📚 دانشنامه', academy: '🏛 آکادمی', lab: '🧪 شبیه‌ساز', dash: '📊 داشبورد', reality: '🎯 واقعیت‌سنج', round: '💬 میزگرد', opp: '🧮 هزینه فرصت', ledger: '📒 دفتر سیگنال‌ها', bot: '🤖 ربات', nfa: 'توصیهٔ مالی نیست', fng: 'ترس و طمع', mcap: 'ارزش کل بازار', dom: 'دامیننس BTC',
    upd: 'به‌روزرسانی', ago: 'دقیقه پیش', now: 'همین الان', off: 'خاموش', noAlerts: 'هنوز هشداری نساخته‌اید. وقتی قیمت به عدد شما برسد، اعلان می‌گیرید.', hit: 'فعال شد', loading: 'در حال بارگذاری…',
    err: 'داده در دسترس نیست؛ اتصال اینترنت را بررسی کنید.', more: 'گزارش کامل در سایت', allPosts: 'همهٔ پست‌ها', fngC: { 'Extreme Fear': 'ترس شدید', Fear: 'ترس', Neutral: 'خنثی', Greed: 'طمع', 'Extreme Greed': 'طمع شدید' } },
  ckb: { offline: 'ئینتەرنێت نییە و هیچ کۆپییەکی پاشەکەوتکراویش نییە.', later: 'ئەم بەشە هێشتا بڵاو نەکراوەتەوە؛ کەمێک دواتر سەردانی بکەرەوە.', retry: 'دووبارە هەوڵ بدە', loading: 'وەرگرتن…', pgMore: 'بەردەوام', toTop: 'گەڕانەوە بۆ سەرەوە', tEnc: 'زانستنامە', encSearch: 'وشەکە بنووسە…', encNone: 'هیچ نەدۆزرایەوە', encHint: 'گەڕان لە ٥٠٦ وشە، بە سێ زمان', encLoad: 'زانستنامە بار دەکرێت…', encFull: 'پەڕەی وشە', tCalc: 'ژمێرەر', kSize: '📐 قەبارەی پۆزیشن', kRR: '⚖️ مەترسی بۆ قازانج', kPnl: '💰 قازانج و زیان', kLiq: '💥 نرخی لیکوید', kFee: '🧾 کرێ', cap: 'سەرمایە ($)', risk: 'مەترسی ٪', entry: 'چوونەژوورەوە', stop: 'وەستاندنی زیان', target: 'ئامانج', exit: 'دەرچوون', qty: 'بڕ (یەکە)', lev: 'لیڤەرج', feeSide: 'کرێی هەر لایەک ٪', feeRT: 'کرێی چوون و هاتن ٪', winExp: 'ڕێژەی چاوەڕوانکراوی بردنەوە ٪', mmr: 'مارجینی پاراستن ٪', side: 'ئاڕاستە', long: 'لۆنگ', short: 'شۆرت', amount: 'بڕی مامەڵە ($)', maker: 'Maker ٪', taker: 'Taker ٪', perMonth: 'مامەڵە لە مانگێک', oRiskAmt: 'بڕی مەترسی', oStopDist: 'دووری وەستاندنی زیان', oQty: 'قەبارە (یەکە)', oNotional: 'بەهای پۆزیشن', oLev: 'لیڤەرجی پێویست', oLoss: 'زیان لەسەر وەستاندن', oRR: 'مەترسی بۆ قازانج (بە کرێ)', oBE: 'ڕێژەی بردنەوەی یەکسان', oEV: 'چاوەڕوانیی هەر مامەڵەیەک', oVerdict: 'دۆخ بە ڕێژەی بردنەوەی تۆ', oGross: 'قازانج/زیانی سەرەکی', oFee: 'کۆی کرێ', oNet: 'قازانج/زیانی خاوێن', oMargin: 'مارجینی بەکارهاتوو', oROE: 'گەڕانەوە لەسەر مارجین', oChg: 'گۆڕانی نرخ', oLiq: 'نرخی نزیکەیی لیکوید', oDist: 'دووری بۆ لیکوید', oWipe: 'جوڵەی پێچەوانە کە مارجین دەبات', oTT: 'چوونەژوورەوە و دەرچوونی Taker', oMT: 'Maker بۆ چوون، Taker بۆ دەرچوون', oMonthly: 'تێچووی مانگانە (Taker)', oBEmove: 'جوڵەی پێویست بۆ یەکسانی', noLev: 'بێ لیڤەرج', posi: 'ئەرێنی', nega: 'نەرێنی', evenv: 'یەکسان', cHint: 'نرخی چوونەژوورەوە لە نرخی زیندووی هەمین پێوەکراوە پڕدەکرێتەوە. ژمێرکارییەکان نزیکەیی و فێرکارین.', brand: 'ئینتیخاب', tMarket: 'بازاڕ', tReport: 'ڕاپۆرت', tPosts: 'کەناڵ', tAlerts: 'ئاگاداری', search: 'گەڕان بۆ دراو…', above: 'سەرووی', below: 'خوارووی', add: 'زیادکردن',
    tip: 'نرخ لە ڕێنمایی ئایکۆن', tipNote: 'هیچ ژمارەیەک لەسەر خودی ئایکۆنەکە نانووسرێت تا لۆگۆکە هەمیشە بە تەواوی دیار بێت؛ نرخەکە بە ڕاگرتنی ماوس لەسەر ئایکۆنەکە دەبینرێت.', newVer: 'وەشانی نوێی پێوەکراوەکە ئامادەیە', getIt: 'وەرگرتن', satoshi: '₿ ساتۆشی', map: '🗺 نەخشەی فێربوون', battle: '⚔️ شەڕی من', apps: '📲 ئەپەکان',
    settings: 'ڕێکخستنەکان', notifyPosts: 'ئاگاداری پۆستی نوێی Coin_Kurd', privacy: 'هەموو ڕێکخستنەکان تەنها لەم وێبگەڕەدا هەڵدەگیرێن و هیچ زانیارییەک نانێردرێت.',
    tAnalysis: 'شیکاری', tReality: 'ڕاستیپێو', rlFull: 'پەڕەی تەواو', rlNone: 'هێشتا داتا نییە', anHow: 'لە هەشت بەشدا، بە داتای کاتدار و بەبێ ژمارەی هەڵبەستراو', anNone: 'تا ئێستا شیکارییەک نییە', anFull: 'دەقی تەواو', anMissing: 'بێ دەستڕاگەیشتن بە:', enc: '📚 زانستنامە', academy: '🏛 ئەکادیمیا', lab: '🧪 سیمولەیتەر', dash: '📊 داشبۆرد', reality: '🎯 ڕاستیپێو', round: '💬 میزگرد', opp: '🧮 تێچووی دەرفەت', ledger: '📒 دەفتەری سیگناڵ', bot: '🤖 بۆت', nfa: 'ئامۆژگاریی دارایی نییە', fng: 'ترس و تەماع', mcap: 'بەهای گشتی بازاڕ', dom: 'باڵادەستیی BTC',
    upd: 'نوێکردنەوە', ago: 'خولەک لەمەوبەر', now: 'ئێستا', off: 'کوژاوە', noAlerts: 'هێشتا ئاگادارییەکت دروست نەکردووە.', hit: 'چالاک بوو', loading: 'بارکردن…',
    err: 'داتا بەردەست نییە؛ پەیوەندیی ئینتەرنێت بپشکنە.', more: 'ڕاپۆرتی تەواو لە ماڵپەڕ', allPosts: 'هەموو پۆستەکان', fngC: { 'Extreme Fear': 'ترسی زۆر', Fear: 'ترس', Neutral: 'بێلایەن', Greed: 'تەماع', 'Extreme Greed': 'تەماعی زۆر' } },
  ar: { offline: 'أنت غير متصل بالإنترنت، ولم يُحفظ شيء لهذا القسم.', later: 'لم يُنشر هذا القسم بعد؛ عُد بعد قليل.', retry: 'أعد المحاولة', loading: 'جارٍ التحميل…', pgMore: 'المزيد', toTop: 'العودة إلى الأعلى', tEnc: 'الموسوعة', encSearch: 'اكتب كلمة…', encNone: 'لا توجد نتائج', encHint: 'ابحث في 506 مدخلات بثلاث لغات', encLoad: 'جارٍ تحميل الموسوعة…', encFull: 'صفحة المدخل', tCalc: 'الحاسبة', kSize: '📐 حجم المركز', kRR: '⚖️ المخاطرة إلى العائد', kPnl: '💰 الربح والخسارة', kLiq: '💥 سعر التصفية', kFee: '🧾 الرسوم', cap: 'رأس المال ($)', risk: 'المخاطرة ٪', entry: 'الدخول', stop: 'وقف الخسارة', target: 'جني الأرباح', exit: 'الخروج', qty: 'الكمية (وحدات)', lev: 'الرافعة', feeSide: 'الرسوم لكل جهة ٪', feeRT: 'رسوم الدخول والخروج ٪', winExp: 'نسبة الربح المتوقعة ٪', mmr: 'هامش الصيانة ٪', side: 'الاتجاه', long: 'شراء (لونغ)', short: 'بيع (شورت)', amount: 'حجم الصفقة ($)', maker: 'Maker ٪', taker: 'Taker ٪', perMonth: 'صفقات في الشهر', oRiskAmt: 'المبلغ المعرّض للخطر', oStopDist: 'مسافة وقف الخسارة', oQty: 'الحجم (وحدات)', oNotional: 'قيمة المركز', oLev: 'الرافعة المطلوبة', oLoss: 'الخسارة عند الوقف', oRR: 'المخاطرة إلى العائد (بعد الرسوم)', oBE: 'نسبة الربح للتعادل', oEV: 'التوقّع لكل صفقة', oVerdict: 'الحكم بنسبة ربحك', oGross: 'الربح/الخسارة الإجمالي', oFee: 'إجمالي الرسوم', oNet: 'صافي الربح/الخسارة', oMargin: 'الهامش المستخدم', oROE: 'العائد على الهامش', oChg: 'تغيّر السعر', oLiq: 'سعر التصفية التقريبي', oDist: 'المسافة حتى التصفية', oWipe: 'الحركة المعاكسة التي تمحو الهامش', oTT: 'دخول وخروج Taker', oMT: 'دخول Maker وخروج Taker', oMonthly: 'التكلفة الشهرية (Taker)', oBEmove: 'الحركة اللازمة للتعادل', noLev: 'بلا رافعة', posi: 'إيجابي', nega: 'سلبي', evenv: 'تعادل', cHint: 'يُملأ سعر الدخول من السعر المباشر لهذه الإضافة. الأرقام تقريبية وتعليمية؛ لا يُحتسب الانزلاق السعري ولا شرائح الرسوم.', brand: 'انتخاب', tMarket: 'السوق', tReport: 'التقرير', tPosts: 'القناة', tAlerts: 'التنبيهات', search: 'ابحث عن عملة…', above: 'أعلى من', below: 'أدنى من', add: 'إضافة',
    tip: 'السعر في تلميح الأيقونة', tipNote: 'لا يُكتب أي رقم على الأيقونة نفسها كي يبقى الشعار ظاهرًا كاملًا دائمًا؛ يظهر السعر عند تمرير الفأرة فوق الأيقونة.', newVer: 'إصدار جديد من الإضافة جاهز', getIt: 'تنزيل', satoshi: '₿ ساتوشي', map: '🗺 خريطة التعلّم', battle: '⚔️ معركتي', apps: '📲 التطبيقات',
    settings: 'الإعدادات', notifyPosts: 'إشعار بمنشورات Coin_Kurd الجديدة', privacy: 'تبقى الإعدادات في هذا المتصفح فقط؛ لا يُرسَل أي شيء عنك إلى أي مكان.',
    tAnalysis: 'التحليل', tReality: 'فاحص الواقع', rlFull: 'الصفحة الكاملة', rlNone: 'لا توجد بيانات بعد', anHow: 'ثمانية أقسام، ببيانات مؤرّخة وبلا أرقام مختلَقة', anNone: 'لم يُنشر أي تحليل بعد', anFull: 'التقرير الكامل', anMissing: 'تعذّر الوصول إلى:', enc: '📚 الموسوعة', academy: '🏛 الأكاديمية', lab: '🧪 المحاكي', dash: '📊 لوحة المعلومات', reality: '🎯 فاحص الواقع', round: '💬 الطاولة المستديرة', opp: '🧮 تكلفة الفرصة', ledger: '📒 سجل الإشارات', bot: '🤖 البوت', nfa: 'ليست نصيحة مالية', fng: 'الخوف والطمع', mcap: 'القيمة السوقية', dom: 'هيمنة BTC',
    upd: 'آخر تحديث', ago: 'دقيقة', now: 'الآن', off: 'إيقاف', noAlerts: 'لا توجد تنبيهات بعد. يصلك إشعار عندما يبلغ السعر المستوى الذي تحدده.', hit: 'تفعّل', loading: 'جارٍ التحميل…',
    err: 'البيانات غير متاحة؛ تحقّق من اتصالك بالإنترنت.', more: 'التقرير الكامل على الموقع', allPosts: 'كل المنشورات', fngC: { 'Extreme Fear': 'خوف شديد', Fear: 'خوف', Neutral: 'محايد', Greed: 'طمع', 'Extreme Greed': 'طمع شديد' } },
  en: { offline: 'You are offline, and nothing was saved for this section.', later: 'This section has not been published yet; check back shortly.', retry: 'Try again', loading: 'Loading…', pgMore: 'More', toTop: 'Back to top', tEnc: 'Encyclopedia', encSearch: 'Type a word…', encNone: 'Nothing matched', encHint: 'Search 506 entries in three languages', encLoad: 'Loading the encyclopedia…', encFull: 'Entry page', tCalc: 'Calculator', kSize: '📐 Position size', kRR: '⚖️ Risk / reward', kPnl: '💰 Profit & loss', kLiq: '💥 Liquidation price', kFee: '🧾 Fees', cap: 'Capital ($)', risk: 'Risk %', entry: 'Entry', stop: 'Stop loss', target: 'Take profit', exit: 'Exit', qty: 'Quantity (units)', lev: 'Leverage', feeSide: 'Fee per side %', feeRT: 'Round-trip fee %', winExp: 'Expected win rate %', mmr: 'Maintenance margin %', side: 'Side', long: 'Long', short: 'Short', amount: 'Trade size ($)', maker: 'Maker %', taker: 'Taker %', perMonth: 'Trades per month', oRiskAmt: 'Amount at risk', oStopDist: 'Stop distance', oQty: 'Size (units)', oNotional: 'Position value', oLev: 'Leverage needed', oLoss: 'Loss if stopped out', oRR: 'Risk / reward (after fees)', oBE: 'Break-even win rate', oEV: 'Expectancy per trade', oVerdict: 'Verdict at your win rate', oGross: 'Gross P&L', oFee: 'Total fees', oNet: 'Net P&L', oMargin: 'Margin used', oROE: 'Return on margin', oChg: 'Price change', oLiq: 'Approx. liquidation price', oDist: 'Distance to liquidation', oWipe: 'Adverse move that wipes margin', oTT: 'Taker in and out', oMT: 'Maker in, Taker out', oMonthly: 'Monthly cost (Taker)', oBEmove: 'Move needed to break even', noLev: 'none', posi: 'positive', nega: 'negative', evenv: 'break-even', cHint: 'Entry is filled from this extension\u2019s live price. Figures are approximate and educational; slippage and tiered rates are not modelled.', brand: 'Entekhab', tMarket: 'Market', tReport: 'Report', tPosts: 'Channel', tAlerts: 'Alerts', search: 'Search coin…', above: 'above', below: 'below', add: 'Add',
    tip: 'Price in the icon tooltip', tipNote: 'Nothing is ever written on the icon itself, so the logo always stays fully visible; hover over the icon to see the price.', newVer: 'A new version of the extension is ready', getIt: 'Get it', satoshi: '₿ Satoshi', map: '🗺 Learning map', battle: '⚔️ My Battle', apps: '📲 Apps',
    settings: 'Settings', notifyPosts: 'Notify new Coin_Kurd posts', privacy: 'Settings stay in this browser only; nothing about you is sent anywhere.',
    tAnalysis: 'Analysis', tReality: 'Reality check', rlFull: 'Full page', rlNone: 'No data yet', anHow: 'Eight sections, timestamped data, no invented figures', anNone: 'No analysis published yet', anFull: 'Full report', anMissing: 'No access to:', enc: '📚 Encyclopedia', academy: '🏛 Academy', lab: '🧪 Simulator', dash: '📊 Dashboard', reality: '🎯 Reality check', round: '💬 Roundtable', opp: '🧮 Opportunity cost', ledger: '📒 Signal ledger', bot: '🤖 Bot', nfa: 'Not financial advice', fng: 'Fear & Greed', mcap: 'Total market cap', dom: 'BTC dominance',
    upd: 'Updated', ago: 'min ago', now: 'just now', off: 'Off', noAlerts: 'No alerts yet. You get a notification when the price reaches your level.', hit: 'triggered', loading: 'Loading…',
    err: 'Data unavailable; check your connection.', more: 'Full report on the site', allPosts: 'All posts', fngC: {} }
};
let S = {}, L = 'fa', REPORT = null;
const t = k => (T[L] && T[L][k]) || (L === 'ar' && T.en[k]) || T.fa[k] || k;
/* the site's feeds come in fa / ckb / en: Arabic readers get the English copy of the data, in an Arabic interface */
const LX = () => L === 'ar' ? 'en' : L;
const LOC = () => L === 'en' ? 'en-GB' : L === 'ar' ? 'ar-u-nu-latn' : 'fa-IR';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = p => p == null || !isFinite(p) ? '—' : p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 0 }) : p >= 1 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : p.toPrecision(4);
const big = n => !isFinite(n) ? '—' : n >= 1e12 ? '$' + (n / 1e12).toFixed(2) + 'T' : n >= 1e9 ? '$' + (n / 1e9).toFixed(1) + 'B' : '$' + fmt(n);
async function getJSON(u) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return r.json(); }

function spark(a, up) {
  if (!a || a.length < 2) return '';
  const mn = Math.min(...a), mx = Math.max(...a), w = 60, h = 20;
  const pts = a.map((v, i) => `${(i / (a.length - 1) * w).toFixed(1)},${(h - 2 - (v - mn) / ((mx - mn) || 1) * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="${up ? '#22c55e' : '#ef4444'}" stroke-width="1.4" points="${pts}"/></svg>`;
}
function coins() {
  const m = (S.market && S.market.coins) || [], lv = S.live || {};
  return m.map(c => ({ ...c, price: (lv[c.coin] && lv[c.coin].price) || c.price, chg24: lv[c.coin] && lv[c.coin].chg24 != null ? lv[c.coin].chg24 : c.chg24 }));
}

/* Chrome stops a popup at 600px. The header may wrap to a second line (that is how the logo stays uncovered with
   wide fonts), and the new-version line may show: whatever they take, the open pane gives back. */
function fitHeight() {
  const b = document.body; if (!b) return;
  b.style.setProperty('--pane', '300px');
  const over = document.documentElement.scrollHeight - 596;
  if (over > 0) b.style.setProperty('--pane', Math.max(170, 300 - over) + 'px');
}

function applyLang() {
  document.documentElement.lang = L; document.documentElement.dir = L === 'en' ? 'ltr' : 'rtl';
  document.title = t('brand') === 'Entekhab' ? 'Entekhab' : t('brand') + ' — Entekhab';
  document.querySelectorAll('[data-t]').forEach(e => { e.textContent = t(e.dataset.t); });
  document.querySelectorAll('[data-tp]').forEach(e => { e.placeholder = t(e.dataset.tp); });
  document.querySelectorAll('.lang button').forEach(b => b.classList.toggle('on', b.dataset.l === L));
  render();
  fitHeight();
}

function render() {
  const m = S.market;
  if ($('#cKind')) cRender();
  // KPIs
  if (m) {
    const f = m.fng || {}, g = m.global || {};
    $('#kpis').innerHTML = [
      [t('fng'), `${f.value ?? '—'} <small style="display:inline">${esc((t('fngC') || {})[f.class] || f.class || '')}</small>`],
      [t('mcap'), big(g.mcap) + (g.mcap_chg24 != null ? ` <small style="display:inline" class="${g.mcap_chg24 >= 0 ? 'up' : 'dn'}">${g.mcap_chg24 >= 0 ? '+' : ''}${(+g.mcap_chg24).toFixed(1)}%</small>` : '')],
      [t('dom'), g.btc_d != null ? g.btc_d.toFixed(1) + '%' : '—']
    ].map(([a, b]) => `<div class="kpi"><small>${a}</small><b>${b}</b></div>`).join('');
  } else $('#kpis').innerHTML = `<p class="empty">${t(S.err ? 'err' : 'loading')}</p>`;
  // market list
  const q = ($('#q').value || '').trim().toUpperCase();
  const list = coins().filter(c => !q || c.coin.includes(q));
  $('#list').innerHTML = list.length ? list.map(c => {
    const up = (c.chg24 || 0) >= 0;
    return `<a class="it" href="${SITE}/coins/${encodeURIComponent(c.coin.toLowerCase())}/" target="_blank" rel="noopener"><span class="c">${esc(c.coin)}</span>${spark(c.spark, up)}<span class="p">$${fmt(c.price)}</span>` +
      `<span class="ch ${up ? 'up' : 'dn'}">${c.chg24 == null ? '—' : (up ? '+' : '') + (+c.chg24).toFixed(2) + '%'}</span></a>`;
  }).join('') : `<p class="empty">${t(m ? 'search' : (S.err ? 'err' : 'loading'))}</p>`;
  // updated
  const at = S.checkedAt || S.marketAt, mins = at ? Math.round((Date.now() - at) / 60000) : null;
  $('#upd').textContent = at ? `${t('upd')}: ${mins < 1 ? t('now') : L === 'ar' ? 'منذ ' + mins + ' ' + t('ago') : mins + ' ' + t('ago')}` : '';
  // posts
  const ps = S.posts || [];
  $('#posts').innerHTML = ps.length ? ps.slice(0, 15).map(p => { const tt = (p.tt || {})[L]; return `<a class="post" href="${esc(tt && L !== 'fa' ? SITE + '/' + L + '/p/' + p.id + '/' : (p.page || SITE + '/p/' + p.id + '/'))}" target="_blank" rel="noopener"${tt && L === 'en' ? ' dir="ltr"' : ''}>${esc(tt || p.title)}<small>${esc(new Date(p.date).toLocaleString(LOC(), { dateStyle: 'medium', timeStyle: 'short' }))}${p.coins && p.coins.length ? ' · ' + esc(p.coins.join(' ')) : ''}</small></a>`; }).join('') +
    `<p class="note"><a href="https://t.me/Coin_Kurd" target="_blank" rel="noopener">${t('allPosts')} ←</a></p>` : `<p class="empty">${t('loading')}</p>`;
  // report
  if (REPORT) {
    const r = REPORT[LX()] || REPORT.fa || {};
    $('#report').innerHTML = `<h3>${esc(r.headline || '')}</h3><p>${esc(r.body || '')}</p><p class="note"><a href="${SITE}/dashboard/" target="_blank" rel="noopener">${t('more')}</a></p>`;
    $('#report').dir = LX() === 'en' ? 'ltr' : 'rtl';
  }
  // alerts + settings
  const cs = coins().map(c => c.coin), sel = $('#aCoin'), cur = sel.value;
  sel.innerHTML = cs.filter(c => !['USDT', 'USDC'].includes(c)).map(c => `<option>${esc(c)}</option>`).join(''); if (cur) sel.value = cur;
  const b = $('#tip');
  b.innerHTML = `<option value="OFF">${t('off')}</option>` + cs.filter(c => !['USDT', 'USDC', 'GOLD'].includes(c)).map(c => `<option>${esc(c)}</option>`).join('');
  b.value = S.tip || S.badge || 'BTC';
  $('#notifyPosts').checked = !!S.notifyPosts;
  const al = S.alerts || [];
  $('#alerts').innerHTML = al.length ? al.map(a => `<div class="al${a.hit ? ' hit' : ''}"><span><b>${esc(a.coin)}</b> ${a.op === '>' ? t('above') : t('below')} <b dir="ltr">$${esc(a.price)}</b>${a.hit ? ' — ✅ ' + t('hit') : ''}</span><button data-del="${esc(a.id)}" aria-label="delete">✕</button></div>`).join('')
    : `<p class="empty">${t('noAlerts')}</p>`;
}
const renderReality = d => {
  const box = $('#reality');
  if (!box) return;
  box.dir = LX() === 'en' ? 'ltr' : 'rtl';
  const pack = d && (d[LX()] || d.fa);
  const items = pack && pack.items;
  if (!items || !items.length) { box.innerHTML = `<p class="empty">${t('rlNone')}</p>`; return; }
  box.innerHTML = items.map(it => {
    const rows = (it.rows || []).map(r => `<li>${r.replace(/<(?!\/?b>)/g, '&lt;')}</li>`).join('');
    return `<div class="rl"><h4>${esc(it.title)}</h4><ul class="an">${rows}</ul>`
      + `<p class="note"><a href="${SITE}${esc(it.url)}" target="_blank" rel="noopener">${t('rlFull')}</a></p></div>`;
  }).join('');
};
let ENCI = null, ENCloading = false;
const encNorm = x => (x || '').trim().toLowerCase()
  .replace(/[\u064A]/g, '\u06CC').replace(/[\u0643]/g, '\u06A9').replace(/[\u0629\u06C0]/g, '\u0647')
  .replace(/[\u0623\u0625\u0622]/g, '\u0627').replace(/[\u0624]/g, '\u0648').replace(/[\u0626]/g, '\u06CC')
  .replace(/[\u064B-\u0652\u0670\u200c\u200e\u200f]/g, '');
const renderEnc = () => {
  const box = $('#enc'); if (!box) return;
  box.dir = LX() === 'en' ? 'ltr' : 'rtl';
  if (ENCloading) { box.innerHTML = `<p class="empty">${t('encLoad')}</p>`; return; }
  if (!ENCI) { box.innerHTML = `<p class="empty">${t('err')}</p>`; return; }
  const q = encNorm(($('#encq') || {}).value);
  if (q.length < 2) { box.innerHTML = `<p class="empty">${t('encHint')}</p>`; return; }
  const sp = q.replace(/\s+/g, '');            // a half-space and a space are the same word here
  const exact = [], pref = [], part = [];
  for (const it of ENCI) {
    if (it.k.includes(q) || it.k.some(k => k.replace(/\s+/g, '') === sp)) exact.push(it);
    else if (it.k.some(k => k.startsWith(q))) pref.push(it);
    else if (it.k.some(k => k.includes(q)) || encNorm(it.d[LX()] || it.d.fa || '').includes(q)) part.push(it);
  }
  const hits = exact.concat(pref, part).slice(0, 8);
  if (!hits.length) { box.innerHTML = `<p class="empty">${t('encNone')}</p>`; return; }
  box.innerHTML = hits.map(it => `<div class="rl"><h4>${esc(it.t[LX()] || it.t.fa)}</h4>`
    + `<p>${esc(it.d[LX()] || it.d.fa || '')}</p>`
    + `<p class="note"><a href="${SITE}/encyclopedia/t/${LX()}/${encodeURIComponent(it.i)}.html" target="_blank" rel="noopener">${t('encFull')}</a></p></div>`).join('');
};
const encLoad = () => {                       // 165 KB over the wire — fetched the first time the tab is opened, then kept
  if (ENCI || ENCloading) return;
  ENCloading = true; renderEnc();
  getJSON(`${SITE}/api/v1/encyclopedia.json`).then(d => {
    ENCI = (d && d.terms) || null; ENCloading = false; renderEnc();
  }).catch(() => { ENCloading = false; renderEnc(); });
};
const renderAnalysis = d => {
  const box = $('#analysis');
  if (!box) return;
  box.dir = 'rtl';
  if (!d || !d.headline) { box.innerHTML = `<p class="empty">${t('anNone')}</p>`; return; }
  const li = a => (a || []).map(x => `<li>${esc(x)}</li>`).join('');
  box.innerHTML = `<h3>${esc(d.headline)}</h3>`
    + (d.regime && d.regime.length ? `<ul class="an">${li(d.regime)}</ul>` : '')
    + (d.scenarios && d.scenarios.length ? `<ul class="an sc">${li(d.scenarios)}</ul>` : '')
    + (d.verdict && d.verdict.length ? `<ul class="an">${li(d.verdict)}</ul>` : '')
    + (d.missing && d.missing.length ? `<p class="note">${esc(t('anMissing'))} ${esc(d.missing.join('، '))}</p>` : '')
    + `<p class="note">${esc(t('anHow'))}</p>`
    + `<p class="note"><a href="${esc(d.url || SITE + '/onchain/')}" target="_blank" rel="noopener">${t('anFull')}</a></p>`;
};

/* ------------------------------------------------------------------ calculator
   همان فرمول‌های /academy/lab/ ، با این تفاوت که قیمت ورود از نرخ زندهٔ افزونه پر می‌شود. */
const CALCS = {
  size: { t: 'kSize', f: [['zCap', 'cap', 1000], ['zRisk', 'risk', 1], ['zEn', 'entry', 100, 1], ['zSl', 'stop', 95, 2]] },
  rr: { t: 'kRR', f: [['rEn', 'entry', 100, 1], ['rSl', 'stop', 95, 2], ['rTp', 'target', 112, 2], ['rFee', 'feeRT', 0.2], ['rWin', 'winExp', 40]] },
  pnl: { t: 'kPnl', f: [['pSide', 'side', 'long'], ['pEn', 'entry', 100, 1], ['pEx', 'exit', 108, 2], ['pQty', 'qty', 10], ['pLev', 'lev', 1], ['pFee', 'feeSide', 0.1]] },
  liq: { t: 'kLiq', f: [['lSide', 'side', 'long'], ['lEn', 'entry', 100, 1], ['lLev', 'lev', 10], ['lMm', 'mmr', 0.5]] },
  fee: { t: 'kFee', f: [['fAmt', 'amount', 1000], ['fMk', 'maker', 0.1], ['fTk', 'taker', 0.1], ['fN', 'perMonth', 20]] }
};
let cSaveT = 0, cSig = '';
const cNum = id => { const el = $('#' + id); return el ? parseFloat(el.value) : NaN; };
const usd = v => (v < 0 ? '-$' : '$') + fmt(Math.abs(v));
const pc = (v, d = 2) => !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(d) + '%';
const cls = v => !isFinite(v) || v === 0 ? '' : v > 0 ? 'up' : 'dn';

function cFields() {
  const k = CALCS[(S.calcKind || 'size')] || CALCS.size, saved = S.calcVals || {};
  $('#cForm').innerHTML = k.f.map(([id, lbl, dv]) => {
    const v = saved[id] != null ? saved[id] : dv;
    if (id.endsWith('Side')) return `<label>${esc(t('side'))}<select id="${id}"><option value="long"${v === 'short' ? '' : ' selected'}>${esc(t('long'))}</option><option value="short"${v === 'short' ? ' selected' : ''}>${esc(t('short'))}</option></select></label>`;
    return `<label>${esc(t(lbl))}<input id="${id}" type="number" step="any" value="${esc(v)}"></label>`;
  }).join('');
  $('#cForm').querySelectorAll('input,select').forEach(el => { el.oninput = cRun; el.onchange = cRun; });
}
function cPrice() {                       // نرخ زندهٔ کوین انتخاب‌شده، برای پر کردن فیلد ورود
  const c = coins().find(x => x.coin === (S.calcCoin || 'BTC'));
  return c && isFinite(c.price) ? c.price : null;
}
function cUseLive() {
  const px = cPrice(); if (px == null) return;
  const k = CALCS[(S.calcKind || 'size')] || CALCS.size;
  const ent = k.f.find(f => f[3] === 1);                       // فیلد ورود
  const el = ent && $('#' + ent[0]); if (!el) return;
  const old = parseFloat(el.value), ratio = old > 0 ? px / old : null;
  el.value = px;
  // بقیهٔ فیلدهای قیمتی با همان نسبت جابه‌جا می‌شوند تا فاصلهٔ درصدی حد ضرر و هدف دست‌نخورده بماند
  if (ratio) k.f.filter(f => f[3] === 2).forEach(f => {
    const e2 = $('#' + f[0]), v = e2 && parseFloat(e2.value);
    if (e2 && isFinite(v)) e2.value = parseFloat((v * ratio).toPrecision(8));
  });
  cRun();
}
function cOut(rows) {
  $('#cOut').innerHTML = rows.map(([lbl, val, c, key]) => `<div class="r${key ? ' k' : ''}"><span>${esc(lbl)}</span><b class="${c || ''}">${esc(val)}</b></div>`).join('');
}
function cRun() {
  const kind = S.calcKind || 'size', vals = {};
  (CALCS[kind] || CALCS.size).f.forEach(([id]) => { const el = $('#' + id); if (el) vals[id] = el.value; });
  S.calcVals = Object.assign({}, S.calcVals, vals);
  clearTimeout(cSaveT);
  cSaveT = setTimeout(() => chrome.storage.local.set({ calcVals: S.calcVals, calcKind: kind, calcCoin: S.calcCoin || 'BTC' }), 400);
  if (kind === 'size') {
    const cap = cNum('zCap'), r = cNum('zRisk'), en = cNum('zEn'), sl = cNum('zSl'), d = Math.abs(en - sl), q = cap * r / 100 / d;
    cOut([[t('oQty'), isFinite(q) ? fmt(q) : '—', '', 1], [t('oRiskAmt'), usd(cap * r / 100)], [t('oStopDist'), pc(d / en * 100)],
      [t('oNotional'), usd(q * en)], [t('oLev'), q * en > cap ? (q * en / cap).toFixed(2) + '×' : t('noLev'), q * en > cap ? 'dn' : ''],
      [t('oLoss'), usd(-q * d), 'dn']]);
  } else if (kind === 'rr') {
    const en = cNum('rEn'), sl = cNum('rSl'), tp = cNum('rTp'), fee = (cNum('rFee') || 0) / 100 * en, w = cNum('rWin') / 100;
    const risk = Math.abs(en - sl) + fee, rew = Math.abs(tp - en) - fee, rr = rew / risk, be = 1 / (1 + rr), ev = w * rew - (1 - w) * risk;
    cOut([[t('oRR'), isFinite(rr) ? '1 : ' + rr.toFixed(2) : '—', '', 1], [t('oBE'), pc(be * 100, 1).replace('+', '')],
      [t('oEV'), (ev / risk).toFixed(2) + 'R', cls(ev)],
      [t('oVerdict'), w > be ? t('posi') : w < be ? t('nega') : t('evenv'), cls(w - be)]]);
  } else if (kind === 'pnl') {
    const d = $('#pSide').value === 'long' ? 1 : -1, en = cNum('pEn'), ex = cNum('pEx'), q = cNum('pQty');
    const lev = Math.max(1, cNum('pLev') || 1), fr = (cNum('pFee') || 0) / 100;
    const g = (ex - en) * q * d, fee = (en + ex) * q * fr, n = g - fee, m = en * q / lev;
    cOut([[t('oNet'), usd(n), cls(n), 1], [t('oGross'), usd(g), cls(g)], [t('oFee'), usd(-fee), 'dn'],
      [t('oMargin'), usd(m)], [t('oROE'), pc(n / m * 100), cls(n)], [t('oChg'), pc((ex / en - 1) * 100), cls((ex - en) * d)]]);
  } else if (kind === 'liq') {
    const isL = $('#lSide').value === 'long', en = cNum('lEn'), lev = Math.max(1, cNum('lLev')), mm = (cNum('lMm') || 0) / 100;
    const liq = isL ? en * (1 - 1 / lev + mm) : en * (1 + 1 / lev - mm);
    cOut([[t('oLiq'), fmt(liq), 'dn', 1], [t('oDist'), pc(Math.abs(liq / en - 1) * 100).replace('+', '')],
      [t('oWipe'), '≈ ' + (100 / lev).toFixed(2) + '%']]);
  } else {
    const a = cNum('fAmt'), mk = cNum('fMk') / 100, tk = cNum('fTk') / 100, n = cNum('fN');
    cOut([[t('oTT'), usd(a * tk * 2), '', 1], [t('oMT'), usd(a * (mk + tk))],
      [t('oMonthly'), usd(a * tk * 2 * n), 'dn'], [t('oBEmove'), pc(tk * 2 * 100, 3)]]);
  }
}
function cRender() {
  const kind = S.calcKind || 'size', cur = S.calcCoin || 'BTC', sig = kind + '|' + L;
  const cs = coins().slice(0, 40);
  if (sig !== cSig) {
    $('#cKind').innerHTML = Object.keys(CALCS).map(k => `<option value="${k}"${k === kind ? ' selected' : ''}>${esc(t(CALCS[k].t))}</option>`).join('');
    $('#cHint').textContent = t('cHint');
  }
  const want = cs.length ? cs.map(c => c.coin).join(',') : '—';
  if ($('#cCoin').dataset.list !== want) {
    $('#cCoin').dataset.list = want;
    $('#cCoin').innerHTML = cs.length ? cs.map(c => `<option value="${esc(c.coin)}"${c.coin === cur ? ' selected' : ''}>${esc(c.coin)}</option>`).join('') : '<option>—</option>';
  }
  if (sig !== cSig) { cSig = sig; cFields(); cRun(); }
}

async function load() {
  S = await chrome.storage.local.get(null);
  const nl = (navigator.language || '').toLowerCase();
  L = S.lang || (/^(ckb|ku)/.test(nl) ? 'ckb' : nl.startsWith('ar') ? 'ar' : nl.startsWith('en') ? 'en' : 'fa');
  applyLang();
  if (!S.market || Date.now() - (S.checkedAt || 0) > 4 * 60000) refresh();
  if (!S.posts || Date.now() - (S.postsAt || 0) > 10 * 60000) getJSON(`${SITE}/api/v1/posts_latest.json?t=${Date.now()}`).then(async d => {
    const posts = (d.posts || []).slice(0, 20); await chrome.storage.local.set({ posts, postsAt: Date.now(), lastPostId: Math.max(S.lastPostId || 0, posts[0] ? posts[0].id : 0) });
    S.posts = posts; render();
  }).catch(() => { });
  feed('report'); feed('analysis'); feed('reality');
  checkUpdate();
}

/* An installed copy does not update itself (it is not from a store), so the popup says when a newer one is
   published at /extension/latest.json — a line under the header, in the normal flow, never over the logo. */
const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
async function checkUpdate() {
  try {
    let v = S.latest;
    if (!v || Date.now() - (S.latestAt || 0) > 6 * 3600e3) {
      const d = await getJSON(`${SITE}/extension/latest.json?t=${Date.now()}`);
      v = d && d.version; if (v) chrome.storage.local.set({ latest: v, latestAt: Date.now() });
    }
    const nv = $('#nv'); if (!nv) return;
    nv.hidden = !(v && newer(v, chrome.runtime.getManifest().version));
    document.body.classList.toggle('has-nv', !nv.hidden);
    fitHeight();
  } catch (e) { }
}

/* One place that fetches a published feed, shows the last good copy while it waits, and says
   plainly what went wrong — the browser being offline and the file not being published yet are
   different things, and telling the user to check a working connection is just wrong. */
const FEED = {
  report: { pane: '#report', draw: d => { REPORT = d.report; render(); } },
  analysis: { pane: '#analysis', draw: d => renderAnalysis(d) },
  reality: { pane: '#reality', draw: d => renderReality(d) }
};
function feedFail(name, offline) {
  const box = $(FEED[name].pane); if (!box) return;
  box.innerHTML = `<p class="empty">${offline ? t('offline') : t('later')}</p>`
    + `<p><button class="retry" data-feed="${name}" type="button">${t('retry')}</button></p>`;
}
async function feed(name, force) {
  const f = FEED[name], box = $(f.pane); if (!f) return;
  const ck = 'feed_' + name;
  if (!force && S[ck]) { try { f.draw(S[ck]); } catch (e) { /* a stale shape must not blank the pane */ } }
  else if (box && !box.innerHTML) box.innerHTML = `<p class="empty">${t('loading')}</p>`;
  try {
    const d = await getJSON(`${SITE}/api/v1/${name}.json?t=${Date.now()}`);
    f.draw(d);
    S[ck] = d; chrome.storage.local.set({ [ck]: d });
  } catch (e) {
    if (S[ck]) return;                               // the cached copy is already on screen
    feedFail(name, !navigator.onLine);
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.retry');
  if (b) feed(b.dataset.feed, true);
});
function refresh() {
  const b = $('#refresh'); b.classList.add('spin');
  chrome.runtime.sendMessage({ type: 'refresh' }, async () => {
    b.classList.remove('spin'); S = await chrome.storage.local.get(null); S.err = !S.market; render();
  });
}

document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('main section').forEach(s => s.classList.toggle('on', s.dataset.pane === b.dataset.tab));
  if (b.dataset.tab === 'enc') encLoad();
});
const encIn = $('#encq'); if (encIn) encIn.oninput = renderEnc;

/* the small up/down nudge: shown only while the open pane actually has somewhere to go */
const pg = $('#pg');
function pane() { return document.querySelector('main section.on'); }
function pgSync() {
  const p = pane(); if (!pg || !p) return;
  const more = p.scrollHeight - p.clientHeight - p.scrollTop;
  if (p.scrollHeight <= p.clientHeight + 8) { pg.hidden = true; return; }
  pg.hidden = false;
  pg.classList.toggle('up', more < 8);
  pg.title = more < 8 ? t('toTop') : t('pgMore');
}
if (pg) pg.onclick = () => {
  const p = pane(); if (!p) return;
  const more = p.scrollHeight - p.clientHeight - p.scrollTop;
  p.scrollTo({ top: more < 8 ? 0 : p.scrollTop + p.clientHeight * 0.85, behavior: 'smooth' });
  setTimeout(pgSync, 400);
};
document.querySelectorAll('main section').forEach(sec => sec.addEventListener('scroll', pgSync, { passive: true }));
new MutationObserver(pgSync).observe(document.querySelector('main'), { childList: true, subtree: true });
setTimeout(pgSync, 150);
document.querySelectorAll('.lang button').forEach(b => b.onclick = async () => { L = b.dataset.l; await chrome.storage.local.set({ lang: L }); applyLang(); });
$('#refresh').onclick = refresh;
$('#cKind').onchange = async e => { S.calcKind = e.target.value; await chrome.storage.local.set({ calcKind: S.calcKind }); cRender(); };
$('#cCoin').onchange = async e => { S.calcCoin = e.target.value; await chrome.storage.local.set({ calcCoin: S.calcCoin }); cUseLive(); };
$('#q').oninput = render;
$('#tip').onchange = async e => { S.tip = e.target.value; await chrome.storage.local.set({ tip: S.tip }); };
$('#notifyPosts').onchange = async e => {
  S.notifyPosts = e.target.checked;
  if (S.notifyPosts && chrome.notifications && chrome.notifications.getPermissionLevel) chrome.notifications.getPermissionLevel(() => { });
  await chrome.storage.local.set({ notifyPosts: S.notifyPosts });
};
$('#af').onsubmit = async e => {
  e.preventDefault();
  const px = parseFloat($('#aPx').value); if (!(px > 0)) return;
  const a = { id: Date.now().toString(36), coin: $('#aCoin').value, op: $('#aOp').value, price: px, at: Date.now() };
  S.alerts = (S.alerts || []).concat(a).slice(-30); await chrome.storage.local.set({ alerts: S.alerts }); $('#aPx').value = ''; render();
};
$('#alerts').onclick = async e => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  S.alerts = (S.alerts || []).filter(a => a.id !== b.dataset.del); await chrome.storage.local.set({ alerts: S.alerts }); render();
};
chrome.storage.onChanged.addListener(async (ch, area) => { if (area === 'local' && (ch.market || ch.live || ch.alerts)) { S = await chrome.storage.local.get(null); render(); } });
load();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHeight);
addEventListener('resize', fitHeight);
