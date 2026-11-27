"""
The site's live market (/market/) in the bot:

  * section "pro": what the workspace offers, the next high-impact economic event (from data/ecocal.json, else
    data/events.json) and two ways in: inside Telegram (a Web App button) or in the browser.
  * the site's alert hand-off: /market/ opens  t.me/<bot>?start=a_<COIN>_<PRICE>  (PRICE with "d" for the decimal
    point, because a start parameter may only hold [A-Za-z0-9_-]). The bot only *offers* the alert; nothing is stored
    until the user taps «add», which then goes through refbot.parse_alert like a typed /alert, with the same checks.
  * Iran's market in toman (dollar, euro, gold, coin, tether…) comes as  t_<ASSET>_<PRICE>  with one of the bot's own
    asset keys (bot_iran.ASSETS); «add» sends «pt:<ASSET>:<PRICE>», a toman alert, again through refbot.parse_alert.

Read-only apart from that explicit tap. Self-test: python3 scripts/bot_pro.py
"""
import re
from datetime import datetime, timezone

from bot_i18n import pick

SITE = "https://entekhab.net"
URL = SITE + "/market/"

TXT = {
    "title": {"fa": "📈 <b>بازار زنده</b>", "ckb": "📈 <b>بازاڕی زیندوو</b>", "kmr": "📈 <b>Bazara zindî</b>", "ar": "📈 <b>السوق المباشر</b>",
              "en": "📈 <b>Live market</b>"},
    "body": {
        "fa": ("میز تحلیل کامل سایت، با دادهٔ زندهٔ بایننس و بازار ایران:\n"
               "• همهٔ کوین‌های بایننس، و دلار، یورو، طلا، سکه و تتر به تومان؛ بیت‌کوین و هر کوین هم به تومان\n• قیمت و تاریخچه از پنج صرافی: بایننس، کوین‌بیس، بای‌بیت، اوکی‌ایکس و کراکن — انتخابی برای هر چارت\n• فارکس جهانی (EUR/USD، USD/JPY و ۳۰ جفت‌ارز) و انس طلا و نقره به دلار\n• ابزارهای محبوب با ستاره روی نوار شناور، پالت فرمان (Ctrl+K)، و ایموجی، استیکر و آیکن روی چارت\n• ۱۶ پوسته، رنگ‌آمیزی کندل با حجم/RSI/روند، ۲۱ فضای کار آماده، و مرکز ریسک (حجم پوزیشن، پلن OCO، کلی، ریسک نابودی)\n• پلن معامله روی خود چارت (با کشیدن ورود/استاپ/تارگت همهٔ عددها عوض می‌شود)، تابلوی ریسک باز با سقف ضرر روزانه، و ماتریس چند تایم‌فریم با تشخیص رژیم بازار\n• ۵۰ زبان و ارز هر کشور: همهٔ کوین‌ها به ارز شما (یورو، لیر، روپیه…) یا با نرخ خودتان برای یک تتر یا یک دلار\n"
               "• ODM، برنامه‌ی کامل معامله: ورود و خروج پله‌ای، حد ضرر ATR و متحرک، امتحان روی کندل‌های گذشته و همه‌ی سطح‌ها یکجا به همین ربات\n"
               "• تا ۱۶ نمودار هم‌زمان با همگام‌سازی نماد، تایم‌فریم و اندیکاتورها\n• تایم‌فریم ثانیه‌ای و هر تایم‌فریم دلخواه\n"
               "• ۱۷ نوع نمودار، از جمله رنکو، کاگی، نقطه و رقم و شکست خط\n• ۷۰ اندیکاتور، فیبوناچی، گن و پوزیشن لانگ/شورت\n"
               "• بازپخش کندل‌ها روی چند چارت با حساب تمرینی: سفارش لیمیت و استاپ، حد ضرر و سود، اهرم و کارمزد\n"
               "• فیوچرز فصلی بیت‌کوین و اتریوم به‌صورت چارت پیوسته با B-ADJ\n"
               "• بک‌تست ۸ استراتژی (و سیگنال‌های کردستانی روی BTC) با بهینه‌ساز، منحنی سرمایه و خروجی CSV\n"
               "• هشدار قیمت، حرکت درصدی، خط روند و کانال، اندیکاتور و اخبار؛ دیده‌بان با بخش‌بندی و پرچم رنگی\n"
               "• دیده‌بان بازار: همهٔ کوین‌ها یا بازار ایران، با مرتب‌سازی بر اساس حجم، تغییر و RSI\n"
               "• تقویم اقتصادی و اخبار روی چارت، با هشدار پیش از انتشار خبر\n• لینک و کد QR برای باز کردن همان فضای کار در دستگاه دیگر"),
        "ckb": ("مێزی تەواوی شیکاریی ماڵپەڕ، بە داتای زیندووی بایننس و بازاڕی ئێران:\n"
                "• هەموو کۆینەکانی بایننس، و دۆلار، یۆرۆ، زێڕ، سکە و تەتەر بە تمەن؛ بیتکۆین و هەر کۆینێک بە تمەنیش\n• نرخ و ڕابردوو لە پێنج ئاڵوگۆڕخانە: بایننس، کۆینبەیس، بایبیت، ئۆکەیئێکس و کراکن — هەڵبژاردە بۆ هەر چارتێک\n• فۆرێکسی جیهانی (EUR/USD، USD/JPY و ٣٠ جووت دراو) و ئۆنسی زێڕ و زیو بە دۆلار\n• ئامرازە دڵخوازەکان بە ئەستێرە لەسەر هێڵی سەرئاو، پاڵێتی فەرمان (Ctrl+K)، و ئیمۆجی، ستیکەر و ئایکۆن لەسەر چارت\n• ١٦ ڕووکار، ڕەنگکردنی مۆم بە قەبارە/RSI/ڕەوت، ٢١ شوێنی کاری ئامادە، و ناوەندی مەترسی (قەبارەی پۆزیشن، پلانی OCO، کێلی، مەترسیی لەناوچوون)\n• پلانی مامەڵە لەسەر چارت (بە ڕاکێشانی چوونەژوورەوە/ستۆپ/ئامانج هەموو ژمارەکان دەگۆڕێن)، تابلۆی مەترسیی کراوە بە سنووری زیانی ڕۆژانە، و ماتریکسی چەند تایم‌فرەیم لەگەڵ ڕژێمی بازاڕ\n• ٥٠ زمان و دراوی هەر وڵاتێک: هەموو کۆینەکان بە دراوی تۆ (یۆرۆ، لیرە، ڕووپیە…) یان بە نرخی خۆت بۆ یەک تەتەر یان یەک دۆلار\n"
                "• ODM، پلانی تەواوی مامەڵە: چوونەژوورەوە و دەرچوونی هەنگاو بە هەنگاو، حەدی زیانی ATR و جوڵاو، تاقیکردنەوە لەسەر مۆمە ڕابردووەکان و هەموو ئاستەکان پێکەوە بۆ ئەم بۆتە\n"
               "• تا ١٦ چارت پێکەوە بە هاوکاتکردنی هێما، تایمفرەیم و ئیندیکاتۆرەکان\n• تایمفرەیمی چرکەیی و هەر تایمفرەیمێکی دڵخواز\n"
                "• ١٧ جۆری چارت، لەوانە ڕێنکۆ، کاگی، خاڵ و ژمارە و شکانی هێڵ\n• ٧٠ ئیندیکاتۆر، فیبۆناچی، گان و پۆزیشنی لۆنگ/شۆرت\n"
                "• دووبارە پەخشی مۆمەکان لەسەر چەند چارت بە هەژماری ڕاهێنان: ئۆردەری لیمیت و ستۆپ، سنووری زیان و قازانج، لیڤەرێج و کرێ\n"
                "• فیوچەرزی وەرزیی بیتکۆین و ئیسیریۆم وەک چارتی بەردەوام لەگەڵ B-ADJ\n"
                "• باکتێستی ٨ ستراتیژ (و سیگناڵەکانی کوردستانی لەسەر BTC) بە باشترکەر، هێڵی سەرمایە و دەرچووی CSV\n"
                "• ئاگادارکەرەوەی نرخ، جووڵەی ڕێژەیی، هێڵی ڕەوت و کەناڵ، ئیندیکاتۆر و هەواڵ؛ چاودێری بە بەش و ئاڵای ڕەنگی\n"
                "• چاودێری بازاڕ: هەموو کۆینەکان یان بازاڕی ئێران، ڕیزکراو بەپێی قەبارە، گۆڕان و RSI\n"
                "• ڕۆژژمێری ئابووری و هەواڵ لەسەر چارت، بە ئاگادارکردنەوە پێش بڵاوبوونەوەی هەواڵ\n• بەستەر و کۆدی QR بۆ کردنەوەی هەمان شوێنی کار لە ئامێرێکی تر"),
        "kmr": ("Maseya analîzê ya temam a malperê, bi daneyên zindî yên Binance û bazara Îranê:\n"
                "• Hemû coinên Binance, û dolar, euro, zêr, zêrê Îmamî û tether bi tûmanan; Bitcoin û her coin jî bi tûmanan\n• Biha û dîrok ji pênc borsayan: Binance, Coinbase, Bybit, OKX û Kraken — ji bo her grafîkê bijartî\n• Forexa cîhanî (EUR/USD, USD/JPY û 30 cot pere) û ûnsa zêr û zîv bi dolaran\n• Amûrên bijare bi stêrkê li ser şirîta herikbar, paleta fermanan (Ctrl+K), û emojî, stîker û îkon li ser grafîkê\n• 16 tema, rengkirina mûman bi hecm/RSI/trendê, 21 qadên kar ên amade, û navenda rîskê (mezinahiya pozîsyonê, plana OCO, Kelly, rîska têkçûnê)\n• Plana bazirganiyê li ser grafîkê (bi kişandina ketin/stop/armancê hemû hejmar diguherin), tabloya rîska vekirî bi sînorê zirara rojane, û matrîsa pir-demjimêr bi rejîma bazarê\n• 50 ziman û pereyê her welatî: hemû coin bi pereyê te (euro, lîre, rûpî…) an bi bihayê te ji bo yek tether an yek dolarî\n"
                "• ODM, plana temam a bazirganiyê: ketin û derketina gav bi gav, stopa ATR û şopîner, ceribandin li ser mûmên berê û hemû ast bi hev re ji vê botê re\n"
               "• Heta 16 grafîk bi hev re, bi hevdemkirina sembol, dem û nîşanderan\n• Demên saniyeyî û her demeke xwestî\n"
                "• 17 cureyên grafîkê, di nav de Renko, Kagi, Point & Figure û Line Break\n• 70 nîşander, Fibonacci, Gann û pozîsyonên long/short\n"
                "• Dubarelîstina mûman li ser çend grafîkan bi hesabeke ceribandinê: fermanên limit û stop, stop-loss û take-profit, leverage û xerc\n"
                "• Futuresên çaryekî yên Bitcoin û Ethereum wek grafîkeke berdewam bi B-ADJ\n"
                "• Backtesta 8 stratejiyan (û nîşanên Kurdistanî li ser BTC) bi optîmîzer, xêza sermayeyê û derketina CSV\n"
                "• Hişyariyên biha, tevgera ji sedî, xeta trendê û kanalê, nîşander û nûçe; lîsteyên şopandinê bi beşan\n"
                "• Şopandina bazarê: hemû coin an bazara Îranê, li gorî qebare, guhertin û RSI rêzkirî\n"
                "• Salnameya aborî û nûçe li ser grafîkê, bi hişyariyê berî weşana nûçeyê\n• Girêdan û koda QR ji bo vekirina heman cihê karê li amûreke din"),
        "ar": ("منصة التحليل الكاملة للموقع ببيانات Binance المباشرة والسوق الإيرانية:\n"
               "• كل عملات Binance، والدولار واليورو والذهب والمسكوكات والتيثر بالتومان؛ والبيتكوين وكل عملة بالتومان أيضًا\n• الأسعار والتاريخ من خمس منصات: Binance وCoinbase وBybit وOKX وKraken — بالاختيار لكل رسم\n• الفوركس العالمي (EUR/USD وUSD/JPY و٣٠ زوجًا) وأونصة الذهب والفضة بالدولار\n• الأدوات المفضلة بنجمة على شريط عائم، لوحة الأوامر (Ctrl+K)، وإيموجي وملصقات وأيقونات على الرسم\n• ١٦ مظهرًا، تلوين الشموع بالحجم/RSI/الاتجاه، ٢١ مساحة عمل جاهزة، ومركز المخاطرة (حجم المركز، خطة OCO، كيلي، خطر الإفلاس)\n• خطة الصفقة على الرسم نفسه (بسحب الدخول/الوقف/الهدف تتغير كل الأرقام)، لوحة المخاطرة المفتوحة مع حد الخسارة اليومي، ومصفوفة الإطارات الزمنية مع نظام السوق\n• ٥٠ لغة وعملة كل بلد: كل العملات الرقمية بعملتك (اليورو، الليرة، الروبية…) أو بسعرك أنت لتيثر واحد أو دولار واحد\n"
               "• ODM، خطة الصفقة كاملة: دخول وخروج على مراحل، وقف خسارة ATR ومتحرك، اختبار على الشموع السابقة وكل المستويات دفعة واحدة إلى هذا البوت\n"
               "• حتى ١٦ رسمًا معًا مع مزامنة الرمز والإطار الزمني والمؤشرات\n• أطر زمنية بالثواني وأي إطار مخصّص\n"
               "• ١٧ نوعًا من الرسوم، منها رينكو وكاجي والنقطة والرقم وكسر الخط\n• ٧٠ مؤشرًا وفيبوناتشي وغان ومراكز الشراء والبيع\n"
               "• إعادة تشغيل الشموع على عدة رسوم بحساب تدريبي: أوامر محددة وإيقاف، وقف الخسارة وجني الربح، ورافعة ورسوم\n"
               "• العقود الآجلة الفصلية للبيتكوين والإيثريوم كرسم متصل مع B-ADJ\n"
               "• اختبار رجعي لثماني استراتيجيات (وإشارات كردستاني على BTC) مع مُحسِّن ومنحنى رأس المال وتصدير CSV\n"
               "• تنبيهات السعر والتحرك بالنسبة المئوية وخطوط الاتجاه والقنوات والمؤشرات والأخبار؛ وقوائم متابعة بأقسام وأعلام ملوّنة\n"
               "• مراقبة السوق: كل العملات أو سوق إيران، مرتبة حسب الحجم والتغير وRSI\n"
               "• التقويم الاقتصادي والأخبار على الرسم، مع تنبيه قبل صدور الخبر\n• رابط ورمز QR لفتح مساحة العمل نفسها على جهاز آخر"),
        "en": ("The site's full analysis desk, on live Binance and Iranian market data:\n"
               "• Every Binance coin, plus the dollar, euro, gold, gold coins and tether in toman; Bitcoin and any coin in toman too\n• Prices and history from five exchanges: Binance, Coinbase, Bybit, OKX and Kraken — chosen per chart\n• World forex (EUR/USD, USD/JPY and 30 pairs) and the gold and silver ounce in dollars\n• Favourite tools with a star on a floating bar, a command palette (Ctrl+K), and emojis, stickers and icons on the chart\n• 16 themes, candles coloured by volume/RSI/trend, 21 ready-made workspaces, and a risk centre (position size, OCO plan, Kelly, risk of ruin)\n• A trade plan on the chart itself (drag the entry, stop or target and every figure follows), an open-risk board with a daily loss limit, and a multi-timeframe matrix with the market regime\n• 50 languages and every country's currency: every coin in your currency (euro, lira, rupee…) or at your own rate for one tether or one dollar\n"
               "• ODM, the whole-trade planner: stepped entries and exits, ATR and trailing stops, a test on past candles, and every level to this bot at once\n"
               "• Up to 16 charts at once, with symbol, timeframe and indicator sync\n• Seconds timeframes and any custom timeframe\n"
               "• 17 chart types, including Renko, Kagi, Point & Figure and Line Break\n• 70 indicators, Fibonacci, Gann, long/short positions\n"
               "• Bar replay on several charts with a practice account: limit and stop orders, stop-loss and take-profit, leverage and fees\n"
               "• Bitcoin and Ethereum quarterly futures as one continuous chart, with B-ADJ\n"
               "• Backtests of 8 strategies (plus the Kurdistani signals on BTC) with an optimizer, the equity curve and a CSV\n"
               "• Price, % move, trend-line and channel, indicator and news alerts; watchlists with sections and colour flags\n"
               "• Market watch: every coin or Iran's market, sorted by volume, change and RSI\n"
               "• The economic calendar and news on the chart, with an alert before each release\n• A link and QR code to open the same workspace on another device"),
    },
    "next": {"fa": "⏳ رویداد مهم بعدی: <b>{c} · {n}</b> — {w}", "ckb": "⏳ ڕووداوی گرنگی داهاتوو: <b>{c} · {n}</b> — {w}",
             "kmr": "⏳ Bûyera girîng a pêş: <b>{c} · {n}</b> — {w}", "ar": "⏳ الحدث المهم التالي: <b>{c} · {n}</b> — {w}",
             "en": "⏳ Next high-impact event: <b>{c} · {n}</b> — {w}"},
    "tip": {"fa": "هشدار قیمتی که در سایت می‌سازید، با دکمهٔ ✈ به همین ربات می‌آید تا وقتی سایت بسته است هم خبرتان کند.",
            "ckb": "ئاگادارکەرەوەی نرخ کە لە ماڵپەڕ دروستی دەکەیت، بە دوگمەی ✈ دێتە ئەم بۆتە تا کاتێک ماڵپەڕ داخراوە ئاگادارت بکاتەوە.",
            "kmr": "Hişyariya bihayê ya li malperê, bi bişkoka ✈ tê vê botê da ku dema malper girtî be jî te agahdar bike.",
            "ar": "تنبيه السعر الذي تنشئه في الموقع يصل بزر ✈ إلى هذا البوت ليخبرك حتى عندما يكون الموقع مغلقًا.",
            "en": "A price alert made on the site comes to this bot with the ✈ button, so it reaches you even when the site is closed."},
    "b_tg": {"fa": "📈 باز کردن در تلگرام", "ckb": "📈 کردنەوە لە تێلێگرام", "kmr": "📈 Di Telegramê de veke", "ar": "📈 افتح داخل تيليغرام",
             "en": "📈 Open inside Telegram"},
    "b_web": {"fa": "🌐 باز کردن در مرورگر", "ckb": "🌐 کردنەوە لە وێبگەڕ", "kmr": "🌐 Di gerokê de veke", "ar": "🌐 افتح في المتصفح",
              "en": "🌐 Open in the browser"},
    "b_lang": {"fa": "🌍 ۵۰ زبان و ارز شما", "ckb": "🌍 ٥٠ زمان و دراوەکەت", "kmr": "🌍 50 ziman û pereyê te", "ar": "🌍 ٥٠ لغة وعملتك",
               "en": "🌍 50 languages and your currency"},
    "offer": {"fa": "🔔 هشدار قیمت از سایت:\n<b>{c}</b> وقتی به <b>{p}</b> برسد\n\nاین هشدار تا وقتی «افزودن» را نزنید ذخیره نمی‌شود.",
              "ckb": "🔔 ئاگادارکەرەوەی نرخ لە ماڵپەڕەوە:\n<b>{c}</b> کاتێک دەگاتە <b>{p}</b>\n\nتا «زیادکردن» دانەگریت پاشەکەوت ناکرێت.",
              "kmr": "🔔 Hişyariya bihayê ji malperê:\n<b>{c}</b> dema bigihêje <b>{p}</b>\n\nHeta tu «Lê zêde bike» nekî nayê tomarkirin.",
              "ar": "🔔 تنبيه سعر من الموقع:\n<b>{c}</b> عندما يصل إلى <b>{p}</b>\n\nلن يُحفظ التنبيه حتى تضغط «إضافة».",
              "en": "🔔 Price alert from the site:\n<b>{c}</b> when it reaches <b>{p}</b>\n\nNothing is saved until you tap “Add”."},
    "b_add": {"fa": "✅ افزودن هشدار", "ckb": "✅ زیادکردنی ئاگادارکەرەوە", "kmr": "✅ Hişyariyê lê zêde bike", "ar": "✅ إضافة التنبيه", "en": "✅ Add the alert"},
    "b_no": {"fa": "✖️ نه", "ckb": "✖️ نەخێر", "kmr": "✖️ Na", "ar": "✖️ لا", "en": "✖️ No"},
    "bad": {"fa": "این لینک هشدار درست نیست.", "ckb": "ئەم لینکی ئاگادارکەرەوەیە دروست نییە.", "kmr": "Ev lînka hişyariyê ne rast e.",
            "ar": "رابط التنبيه هذا غير صالح.", "en": "This alert link is not valid."},
}


TXT["offer_t"] = {
    "fa": "🔔 هشدار قیمت از سایت (بازار ایران):\n<b>{c}</b> وقتی به <b>{p}</b> برسد\n\nاین هشدار تا وقتی «افزودن» را نزنید ذخیره نمی‌شود.",
    "ckb": "🔔 ئاگادارکەرەوەی نرخ لە ماڵپەڕەوە (بازاڕی ئێران):\n<b>{c}</b> کاتێک دەگاتە <b>{p}</b>\n\nتا «زیادکردن» دانەگریت پاشەکەوت ناکرێت.",
    "kmr": "🔔 Hişyariya bihayê ji malperê (bazara Îranê):\n<b>{c}</b> dema bigihêje <b>{p}</b>\n\nHeta tu «Lê zêde bike» nekî nayê tomarkirin.",
    "ar": "🔔 تنبيه سعر من الموقع (السوق الإيرانية):\n<b>{c}</b> عندما يصل إلى <b>{p}</b>\n\nلن يُحفظ التنبيه حتى تضغط «إضافة».",
    "en": "🔔 Price alert from the site (Iran's market):\n<b>{c}</b> when it reaches <b>{p}</b>\n\nNothing is saved until you tap “Add”."}
TXT["toman"] = {"fa": "تومان", "ckb": "تمەن", "kmr": "tûman", "ar": "تومان", "en": "toman"}
# ODM (the site's whole-trade planner) sends every level of one plan at once:  o_<COIN>_<k><PRICE>-<k><PRICE>…
# k: e entry, s stop, x exit (take profit), t trailing-stop start. Each level becomes an ordinary price alert on «add».
TXT["offer_o"] = {
    "fa": "🧭 <b>سطوح ODM از سایت</b> برای <b>{c}</b>:\n{rows}\n\nبا «افزودن همه» برای هر سطح یک هشدار قیمت ساخته می‌شود؛ تا آن را نزنید چیزی ذخیره نمی‌شود.",
    "ckb": "🧭 <b>ئاستەکانی ODM لە ماڵپەڕەوە</b> بۆ <b>{c}</b>:\n{rows}\n\nبە «زیادکردنی هەموو» بۆ هەر ئاستێک ئاگادارکەرەوەیەکی نرخ دروست دەبێت؛ تا دانەگریت هیچ پاشەکەوت ناکرێت.",
    "kmr": "🧭 <b>Astên ODM ji malperê</b> ji bo <b>{c}</b>:\n{rows}\n\nBi «Hemûyan lê zêde bike» ji bo her astê hişyariyek bihayê tê çêkirin; heta tu nekî tiştek nayê tomarkirin.",
    "ar": "🧭 <b>مستويات ODM من الموقع</b> لـ <b>{c}</b>:\n{rows}\n\nبـ«إضافة الكل» يُنشأ تنبيه سعر لكل مستوى؛ لا يُحفظ شيء حتى تضغطه.",
    "en": "🧭 <b>ODM levels from the site</b> for <b>{c}</b>:\n{rows}\n\n“Add all” makes one price alert per level; nothing is saved until you tap it."}
TXT["b_add_all"] = {"fa": "✅ افزودن همه ({n})", "ckb": "✅ زیادکردنی هەموو ({n})", "kmr": "✅ Hemûyan lê zêde bike ({n})", "ar": "✅ إضافة الكل ({n})",
                    "en": "✅ Add all ({n})"}
TXT["o_done"] = {"fa": "🧭 ODM {c}: {n} هشدار اضافه شد{d}.", "ckb": "🧭 ODM {c}: {n} ئاگادارکەرەوە زیادکرا{d}.", "kmr": "🧭 ODM {c}: {n} hişyarî hatin zêdekirin{d}.",
                 "ar": "🧭 ODM {c}: أُضيف {n} تنبيه{d}.", "en": "🧭 ODM {c}: {n} alerts added{d}."}
TXT["o_dup"] = {"fa": "، {n} تا از قبل بود", "ckb": "، {n} دانە پێشتر هەبوو", "kmr": ", {n} jixwe hebûn", "ar": "، {n} موجود مسبقًا", "en": ", {n} already set"}
O_KIND = {
    "e": {"fa": "ورود", "ckb": "چوونەژوورەوە", "kmr": "Ketin", "ar": "دخول", "en": "Entry"},
    "s": {"fa": "حد ضرر", "ckb": "سنووری زیان", "kmr": "Stop", "ar": "وقف الخسارة", "en": "Stop"},
    "x": {"fa": "خروج", "ckb": "دەرچوون", "kmr": "Derketin", "ar": "خروج", "en": "Exit"},
    "t": {"fa": "شروع حد ضرر متحرک", "ckb": "دەستپێکی ستۆپی جووڵاو", "kmr": "Destpêka stopa şopîner", "ar": "بدء الوقف المتحرك", "en": "Trailing stop starts"},
}
O_MAX = 8                  # levels in one link (a start parameter holds at most 64 characters anyway)
# the toman assets the site may send: the keys of bot_iran.ASSETS (refbot.parse_alert resolves them)
T_NAME = {
    "USD": {"fa": "دلار", "ckb": "دۆلار", "kmr": "Dolar", "ar": "الدولار", "en": "US dollar"},
    "EUR": {"fa": "یورو", "ckb": "یۆرۆ", "kmr": "Euro", "ar": "اليورو", "en": "Euro"},
    "GBP": {"fa": "پوند", "ckb": "پاوەند", "kmr": "Sterlîn", "ar": "الجنيه الإسترليني", "en": "British pound"},
    "AED": {"fa": "درهم امارات", "ckb": "دەرهەمی ئیمارات", "kmr": "Dîrhema Emîrtiyan", "ar": "الدرهم الإماراتي", "en": "UAE dirham"},
    "TRY": {"fa": "لیر ترکیه", "ckb": "لیرەی تورکیا", "kmr": "Lîreya Tirkiyê", "ar": "الليرة التركية", "en": "Turkish lira"},
    "GOLD_18": {"fa": "طلای ۱۸ عیار (گرم)", "ckb": "زێڕی ١٨ (گرام)", "kmr": "Zêrê 18 qirat (gram)", "ar": "ذهب عيار 18 (غرام)", "en": "18k gold (gram)"},
    "GOLD_MESGHAL": {"fa": "مثقال طلا", "ckb": "مسقاڵی زێڕ", "kmr": "Misqalê zêr", "ar": "مثقال الذهب", "en": "Gold mesghal"},
    "COIN_EMAMI": {"fa": "سکه امامی", "ckb": "زێڕی ئیمامی", "kmr": "Zêrê Îmamî", "ar": "مسكوكة إمامي", "en": "Emami gold coin"},
    "USDT": {"fa": "تتر", "ckb": "تەتەر", "kmr": "Tether", "ar": "تيثر", "en": "Tether (USDT)"},
}


def L(key, lang, **kw):
    s = pick(TXT[key], lang)
    return s.format(**kw) if kw else s


def _link(arg):
    """'a_BTC_72155d5' -> ('BTC', 72155.5, '72155.5') : the price kept as the exact decimal the site sent"""
    m = re.fullmatch(r"a_([A-Z0-9]{1,12})_(\d{1,12}(?:d\d{1,18})?)", str(arg or ""))
    if not m:
        return None
    ip, _, fr = m.group(2).partition("d")
    fr = fr.rstrip("0")
    txt = (ip.lstrip("0") or "0") + ("." + fr if fr else "")
    price = float(txt)
    if not (0 < price < 1e12):
        return None
    return m.group(1), price, txt


def _num(raw):
    """'72155d50' -> (72155.5, '72155.5') ; None when it is not a usable price"""
    ip, _, fr = raw.partition("d")
    fr = fr.rstrip("0")
    txt = (ip.lstrip("0") or "0") + ("." + fr if fr else "")
    price = float(txt)
    return (price, txt) if 0 < price < 1e12 else None


def _tlink(arg):
    """'t_GOLD_18_7550000' -> ('GOLD_18', 7550000.0, '7550000') : a toman price for one of the bot's assets"""
    m = re.fullmatch(r"t_([A-Z][A-Z0-9_]{1,13})_(\d{1,12}(?:d\d{1,18})?)", str(arg or ""))
    if not m or m.group(1) not in T_NAME:
        return None
    got = _num(m.group(2))
    return (m.group(1),) + got if got else None


def parse_link(arg):
    """'a_BTC_72155d5' -> ('BTC', 72155.5) ; 't_USD_95000' -> ('USD', 95000.0) ; anything else -> None"""
    got = _tlink(arg) if str(arg or "").startswith("t_") else _link(arg)
    return got[:2] if got else None


def price_txt(txt):
    """'72155.5' -> '$72,155.5' : exactly the price set on the site (never rounded), in dollars"""
    ip, _, fr = str(txt).partition(".")
    return "$" + f"{int(ip):,}" + ("." + fr if fr else "")


def toman_txt(txt, lang):
    """'95000' -> '95,000 تومان' : the price exactly as set on the site"""
    ip, _, fr = str(txt).partition(".")
    return f"{int(ip):,}" + ("." + fr if fr else "") + " " + L("toman", lang)


def offer(arg, lang):
    """(text, inline rows) for a deep link from the site, or None for a malformed one"""
    if str(arg or "").startswith("t_"):
        got = _tlink(arg)
        if not got:
            return None
        key, _, txt = got
        return L("offer_t", lang, c=pick(T_NAME[key], lang), p=toman_txt(txt, lang)), [[{"text": L("b_add", lang), "callback_data": f"pt:{key}:{txt}"},
                                                                                       {"text": L("b_no", lang), "callback_data": "m:alerts"}]]
    got = _link(arg)
    if not got:
        return None
    coin, _, txt = got
    return L("offer", lang, c=coin, p=price_txt(txt)), [[{"text": L("b_add", lang), "callback_data": f"pa:{coin}:{txt}"},
                                                        {"text": L("b_no", lang), "callback_data": "m:alerts"}]]


def parse_callback(data):
    """'pa:BTC:72155.5' -> ('BTC', '72155.5') for refbot.parse_alert; None when it does not look right"""
    m = re.fullmatch(r"pa:([A-Z0-9]{1,12}):(\d{1,12}(?:\.\d{1,18})?)", str(data or ""))
    if not m or not (0 < float(m.group(2)) < 1e12):
        return None
    return m.group(1), m.group(2)


def parse_tcallback(data):
    """'pt:GOLD_18:7550000' -> ('GOLD_18', '7550000') for refbot.parse_alert (a toman alert); None otherwise"""
    m = re.fullmatch(r"pt:([A-Z][A-Z0-9_]{1,13}):(\d{1,12}(?:\.\d{1,18})?)", str(data or ""))
    if not m or m.group(1) not in T_NAME or not (0 < float(m.group(2)) < 1e12):
        return None
    return m.group(1), m.group(2)


def parse_olink(arg):
    """'o_BTC_e67000-s59180d5-x70000' -> ('BTC', [('e', 67000.0, '67000'), ('s', 59180.5, '59180.5'), ('x', 70000.0, '70000')]) ;
    None for anything malformed (an unknown kind, a bad price, no level, too many, or a level sent twice)"""
    m = re.fullmatch(r"o_([A-Z0-9]{1,12})_([estx]\d{1,12}(?:d\d{1,18})?(?:-[estx]\d{1,12}(?:d\d{1,18})?){0,%d})" % (O_MAX - 1), str(arg or ""))
    if not m or len(str(arg)) > 63:       # 63, so the «add all» button's "po:" + link stays within Telegram's 64 bytes
        return None
    out, seen = [], set()
    for part in m.group(2).split("-"):
        got = _num(part[1:])
        if not got or (part[0], got[1]) in seen:
            return None
        seen.add((part[0], got[1]))
        out.append((part[0], got[0], got[1]))
    return m.group(1), out


def offer_o(arg, lang):
    """(text, inline rows) for an ODM link: every level listed, one «add all» button; None for a malformed link"""
    got = parse_olink(arg)
    if not got:
        return None
    coin, lv = got
    rows = "\n".join(f"• {pick(O_KIND[k], lang)}: <b>{price_txt(txt)}</b>" for k, _, txt in lv)
    return L("offer_o", lang, c=coin, rows=rows), [[{"text": L("b_add_all", lang, n=len(lv)), "callback_data": "po:" + arg[2:]},
                                                    {"text": L("b_no", lang), "callback_data": "m:alerts"}]]


def parse_ocallback(data):
    """'po:BTC_e67000-x70000' -> ('BTC', ['67000', '70000']) : the prices for refbot.parse_alert; None otherwise"""
    got = parse_olink("o_" + str(data or "")[3:]) if str(data or "").startswith("po:") else None
    return (got[0], [txt for _, _, txt in got[1]]) if got else None


def _next_event(load):
    now = datetime.now(timezone.utc).timestamp()
    ev = (load("ecocal") or {}).get("events") or []
    hi = [e for e in ev if e.get("i") == "H" and e.get("t", 0) > now]
    if hi:
        return min(hi, key=lambda e: e["t"])
    for e in sorted((load("events") or {}).get("events") or [], key=lambda e: e.get("date", "")):
        try:
            t = datetime.fromisoformat(e["date"]).timestamp()
        except (KeyError, ValueError):
            continue
        if t > now and e.get("impact") == "High":
            return {"t": t, "c": "USD", "n": e.get("title", ""), "tr": {"fa": e.get("title_fa") or ""}}
    return None


def _wait(sec):
    h, m = int(sec // 3600), int(sec % 3600 // 60)
    return f"{h // 24}d {h % 24}h" if h >= 48 else f"{h}h {m}m" if h else f"{m}m"


def section(lang, load=None):
    """text of the section; `load` is bot_data.load (injected so the self-test runs without the data folder)"""
    parts = [L("title", lang), L("body", lang)]
    if load:
        try:
            e = _next_event(load)
            if e:
                name = (e.get("tr") or {}).get(lang) or e.get("n", "")
                parts.append(L("next", lang, c=e.get("c", ""), n=name, w=_wait(e["t"] - datetime.now(timezone.utc).timestamp())))
        except Exception:      # a missing or broken data file never breaks the section
            pass
    parts.append("<i>" + L("tip", lang) + "</i>")
    return "\n\n".join(parts)


def open_rows(lang):
    """the ways in, put above the standard navigation: inside Telegram, in the browser, and the language menu (the
    workspace in 47 languages, prices in the visitor's own currency: /market/#lang opens that menu)"""
    return [[{"text": L("b_tg", lang), "web_app": {"url": URL}}], [{"text": L("b_web", lang), "url": URL}],
            [{"text": L("b_lang", lang), "web_app": {"url": URL + "#lang"}}]]


if __name__ == "__main__":
    bad = 0
    for arg, want in [("a_BTC_72155d5", ("BTC", 72155.5)), ("a_PEPE_0d0000121", ("PEPE", 0.0000121)), ("a_ETH_2000", ("ETH", 2000.0)),
                      ("a_S_0d55", ("S", 0.55)), ("a_W_0d0812", ("W", 0.0812)), ("a__1", None),
                      ("a_btc_100", None), ("a_BTC_", None), ("a_BTC_1d2d3", None), ("a_BTC_0", None), ("w_BTC-ETH", None),
                      ("a_BTC_100;DROP", None), ("a_" + "A" * 13 + "_1", None)]:
        got = parse_link(arg)
        if got != want:
            print("FAIL parse", arg, got, want)
            bad += 1
    for lang in ("fa", "ckb", "kmr", "ar", "en"):
        o = offer("a_SOL_143d25", lang)
        if not o or "143.25" not in o[0] or o[1][0][0]["callback_data"] != "pa:SOL:143.25" or len(o[1][0][0]["callback_data"]) > 64:
            print("FAIL offer", lang, o)
            bad += 1
        if parse_callback(o[1][0][0]["callback_data"]) != ("SOL", "143.25"):
            print("FAIL callback", lang)
            bad += 1
        txt = section(lang, load=lambda n: {"events": [{"t": datetime.now(timezone.utc).timestamp() + 7200, "c": "USD", "i": "H", "n": "CPI m/m",
                                                        "tr": {"fa": "تورم ماهانه"}}]} if n == "ecocal" else {})
        if "CPI" not in txt and "تورم" not in txt:
            print("FAIL section", lang)
            bad += 1
    if parse_callback("pa:BTC:0.00001") != ("BTC", "0.00001") or parse_callback("pa:BTC:x") is not None or parse_callback("pa:BTC:1e-05") is not None:
        print("FAIL small-price callback")
        bad += 1
    small = offer("a_PEPE_0d0000121", "en")
    if parse_callback(small[1][0][0]["callback_data"]) is None:
        print("FAIL tiny price round trip", small[1])
        bad += 1
    for arg, cb, shown in [("a_BTTC_0d0000006", "pa:BTTC:0.0000006", "$0.0000006"), ("a_BTC_072155d50", "pa:BTC:72155.5", "$72,155.5"),
                           ("a_X1_0d000000001234567891", "pa:X1:0.000000001234567891", "$0.000000001234567891"),
                           ("a_ABCDEFGHIJKL_999999999999d123456789012345678", "pa:ABCDEFGHIJKL:999999999999.123456789012345678",
                            "$999,999,999,999.123456789012345678")]:
        o = offer(arg, "en")
        if not o or o[1][0][0]["callback_data"] != cb or shown not in o[0] or len(cb.encode()) > 64 or not parse_callback(cb):
            print("FAIL exact price", arg, o)
            bad += 1
    for arg in ("a_BTC_0d0", "a_BTC_00", "a_BTC_1d0000000000000000001", "a_BTC_1000000000000"):
        if parse_link(arg) is not None:
            print("FAIL should reject", arg, parse_link(arg))
            bad += 1
    # toman assets (Iran's market on the site)
    for arg, want in [("t_USD_95000", ("USD", 95000.0)), ("t_GOLD_18_7550000", ("GOLD_18", 7550000.0)), ("t_GOLD_MESGHAL_32700000", ("GOLD_MESGHAL", 32700000.0)),
                      ("t_COIN_EMAMI_88000000", ("COIN_EMAMI", 88000000.0)), ("t_USDT_101500d5", ("USDT", 101500.5)),
                      ("t_BTC_100", None), ("t_usd_100", None), ("t_USD_", None), ("t_USD_0", None), ("t_GOLD_18_1d2d3", None), ("t_XAU_2000", None)]:
        got = parse_link(arg)
        if got != want:
            print("FAIL toman parse", arg, got, want)
            bad += 1
    for lang in ("fa", "ckb", "kmr", "ar", "en"):
        o = offer("t_GOLD_18_7550000", lang)
        cbd = o[1][0][0]["callback_data"] if o else ""
        if not o or "7,550,000" not in o[0] or L("toman", lang) not in o[0] or cbd != "pt:GOLD_18:7550000" or len(cbd.encode()) > 64:
            print("FAIL toman offer", lang, o)
            bad += 1
        if parse_tcallback(cbd) != ("GOLD_18", "7550000"):
            print("FAIL toman callback", lang)
            bad += 1
        if "70" not in section(lang) and "٧٠" not in section(lang) and "۷۰" not in section(lang):
            print("FAIL section text", lang)
            bad += 1
    longest = "t_GOLD_MESGHAL_999999999999d123456789012345678"
    if len(longest) > 64 or not offer(longest, "fa") or len(offer(longest, "fa")[1][0][0]["callback_data"].encode()) > 64:
        print("FAIL toman limits", len(longest))
        bad += 1
    if parse_tcallback("pt:BTC:100") is not None or parse_tcallback("pa:USD:100") is not None or parse_tcallback("pt:USD:1e5") is not None:
        print("FAIL toman callback rejects")
        bad += 1
    # ODM: all levels of one plan in one link
    for arg, want in [("o_BTC_e67000-e66000d5-s59180d5-x70000-t71000", ("BTC", [("e", 67000.0, "67000"), ("e", 66000.5, "66000.5"),
                                                                              ("s", 59180.5, "59180.5"), ("x", 70000.0, "70000"), ("t", 71000.0, "71000")])),
                      ("o_PEPE_s0d0000101", ("PEPE", [("s", 0.0000101, "0.0000101")])),
                      ("o_BTC_", None), ("o_BTC_67000", None), ("o_BTC_q67000", None), ("o_btc_e1", None), ("o_BTC_e0", None),
                      ("o_BTC_e1-e1", None), ("o_BTC_e1--x2", None), ("o_BTC_e1-x2;DROP", None), ("o_BTC_e1d2d3", None),
                      ("o_BTC_" + "-".join("x%d" % i for i in range(1, 10)), None), ("o_ABCDEFGHIJKL_" + "-".join("x99999999d%d" % i for i in range(1, 6)), None)]:
        got = parse_olink(arg)
        if got != want:
            print("FAIL odm parse", arg, got, want)
            bad += 1
    for lang in ("fa", "ckb", "kmr", "ar", "en"):
        arg = "o_SOL_e143d25-e140-s131d5-x150-x160d75-t155"
        o = offer_o(arg, lang)
        cbd = o[1][0][0]["callback_data"] if o else ""
        if not o or "143.25" not in o[0] or "$160.75" not in o[0] or pick(O_KIND["s"], lang) not in o[0] or len(cbd.encode()) > 64:
            print("FAIL odm offer", lang, o)
            bad += 1
        if parse_ocallback(cbd) != ("SOL", ["143.25", "140", "131.5", "150", "160.75", "155"]):
            print("FAIL odm callback", lang, parse_ocallback(cbd))
            bad += 1
    for n in range(2, 9):              # the longest link the bot accepts still makes a button within 64 bytes
        cand = "o_ABCDEFGH_" + "-".join("x%dd5" % (1000000 + i) for i in range(n))
        o = offer_o(cand, "en")
        if o and len(o[1][0][0]["callback_data"].encode()) > 64:
            print("FAIL odm button too long", cand)
            bad += 1
        if len(cand) <= 63 and not o:
            print("FAIL odm should accept", cand)
            bad += 1
    if parse_ocallback("pa:BTC:1") is not None or parse_ocallback("po:BTC_e1-e1") is not None or parse_ocallback(None) is not None:
        print("FAIL odm callback rejects")
        bad += 1
    print(f"bot_pro self-test: {bad} failures")
    raise SystemExit(1 if bad else 0)
