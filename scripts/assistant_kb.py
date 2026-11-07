# -*- coding: utf-8 -*-
"""What the site's support assistant knows — every feature, on every platform, in three languages.

The old index only had page titles and a dozen hand-written answers, so "how do I set an alert?" or
"is there a Chrome extension?" found nothing. This module is the knowledge: one entry per feature saying
what it does and where it lives (site page, bot section, extension tab, app), plus the how-to answers
people actually ask. build_assistant.py turns it into data/assistant.json.

The bot's own labels and descriptions (bot_menu.S) are read live, so a feature added to the bot is known
here without a second edit.
"""
BOT = "Kurd_kurdistan_bot"
ADMIN = "Kurdistan_Coin"
DISCORD = "https://discord.gg/TtT2BHmZyJ"


def L(fa, ckb, en):
    return {"fa": fa, "ckb": ckb, "en": en}


def bot_url(key=None):
    return f"https://t.me/{BOT}" + (f"?start=s_{key}" if key else "")


# site page ↔ bot section ↔ extension tab — one feature, every door it can be opened from
FEATURES = [
    ("/dashboard/", ["score", "opps", "movers"], None),
    ("/coins/", ["coin"], "market"),
    ("/compare/", ["cmp"], None),
    ("/fear-greed/", ["mkt"], "market"),
    ("/sectors/", ["flows"], None),
    ("/terminal/", ["deriv"], None),
    ("/onchain/", ["analysis", "chain"], "analysis"),
    ("/indicators/", ["ind"], None),
    ("/lab/", ["lab", "cycle"], None),
    ("/crypto-news/", ["news", "narr"], "report"),
    ("/sentiment/", ["sentim"], "reality"),
    ("/whales/", ["whales", "follow"], "reality"),
    ("/predict/", ["predict"], None),
    ("/weekly/", ["week"], None),
    ("/roundtable/", ["council", "brain"], None),
    ("/opportunity/", ["oppcost"], "reality"),
    ("/ledger/", ["ledger", "track"], "reality"),
    ("/track-record/", ["trackrec"], "reality"),
    ("/iran-friction/", ["friction"], "reality"),
    ("/hype/", ["hype2"], "reality"),
    ("/silent-exit/", ["silent"], "reality"),
    ("/iran-correlation/", ["corr"], "reality"),
    ("/tools/", ["dca"], "calc"),
    ("/safety/", ["token"], None),
    ("/me/", ["center", "pf"], "alerts"),
    ("/encyclopedia/", ["enc"], "enc"),
    ("/learn/", ["learn"], None),
    ("/#feed", ["posts"], "posts"),
]

EXT_TAB = {"market": L("بازار", "بازاڕ", "Market"), "report": L("گزارش", "ڕاپۆرت", "Report"),
           "analysis": L("تحلیل", "شیکاری", "Analysis"), "reality": L("واقعیت‌سنج", "ڕاستیپێو", "Reality check"),
           "enc": L("دانشنامه", "زانستنامە", "Encyclopedia"), "calc": L("ماشین‌حساب", "ژمێرەر", "Calculator"),
           "posts": L("کانال", "کەناڵ", "Channel"), "alerts": L("هشدار", "ئاگاداری", "Alerts")}

WHERE = {"site": L("در سایت", "لە ماڵپەڕ", "On the site"),
         "bot": L("در ربات تلگرام", "لە بۆتی تێلێگرام", "In the Telegram bot"),
         "ext": L("در افزونهٔ مرورگر، تب", "لە پێوەکراوی وێبگەڕ، تابی", "In the browser extension, tab"),
         "app": L("اپلیکیشن اندروید همین بخش‌ها را دارد.", "ئەپی ئەندرۆید هەمان بەشەکانی هەیە.",
                  "The Android app has the same sections.")}

# the words people use, mapped onto each other — the widget widens a question with these
SYNONYMS = [
    ["هشدار", "آلارم", "الارم", "اعلان", "نوتیفیکیشن", "alert", "alerts", "alarm", "notify", "ئاگادارکەرەوە", "ئاگاداری"],
    ["اپ", "اپلیکیشن", "اپلیکیشن", "برنامه", "موبایل", "اندروید", "apk", "app", "android", "mobile", "ئەپ", "ئەپڵیکەیشن", "مۆبایل", "ئەندرۆید"],
    ["افزونه", "اکستنشن", "افزونه‌ی", "extension", "addon", "کروم", "فایرفاکس", "chrome", "firefox", "پێوەکراو", "زیادکراو"],
    ["ربات", "بات", "bot", "بۆت", "ڕۆبۆت", "روبات"],
    ["نهنگ", "نهنگها", "whale", "whales", "نەهەنگ", "نەهەنگەکان"],
    ["زبان", "language", "زمان", "کوردی", "فارسی", "انگلیسی", "english", "kurdish"],
    ["رایگان", "مجانی", "free", "بێبەرامبەر", "هزینه", "پولی", "قیمت اشتراک"],
    ["آموزش", "یادگیری", "دوره", "کلاس", "course", "class", "learn", "فێربوون", "وانە", "خول"],
    ["دیسکورد", "discord", "دیسکۆرد"],
    ["پروکسی", "proxy", "فیلترشکن", "vpn", "پرۆکسی"],
    ["دعوت", "رفرال", "referral", "invite", "بانگهێشت", "معرفی دوستان"],
    ["ماشین حساب", "محاسبه", "calculator", "ژمێرەر", "حساب کنم"],
    ["سازنده", "موسس", "مؤسس", "بنیانگذار", "بنیان گذار", "founder", "creator", "دامەزرێنەر", "مدیر"],
    ["کتاب", "book", "کتێب"],
    ["قطعی", "اینترنت", "outage", "blackout", "قطع"],
    ["پورتفولیو", "سبد", "portfolio", "پۆرتفۆلیۆ", "دارایی"],
    ["تریدینگ ویو", "تریدینگویو", "tradingview", "اندیکاتور", "indicator", "ئیندیکاتۆر"],
    ["اسکم", "کلاهبرداری", "scam", "rug", "هانی پات", "honeypot", "فێڵ"],
    ["پرونده", "پرونده ها", "پرونده‌ها", "dossier", "dossiers", "دۆسیە", "دۆسیەی", "دۆسیەکان", "تحلیل عمیق"],
    ["شیکاری", "شیکاریی", "تحلیل", "analysis"],
]

FAQ = [
    (["افزونه", "اکستنشن", "افزونه کروم", "افزونه فایرفاکس", "extension", "chrome extension", "firefox", "پێوەکراو"],
     L("افزونهٔ مرورگر دارید؟", "پێوەکراوی وێبگەڕتان هەیە؟", "Is there a browser extension?"),
     L("بله، برای کروم و فایرفاکس. با یک کلیک قیمت زنده، گزارش روز، تحلیل آنچین، واقعیت‌سنج، دانشنامه، ماشین‌حساب، پست‌های کانال و هشدار قیمت را می‌بینید. نشانک قیمت بیت‌کوین روی آیکون است و از تنظیمات تب «هشدار» خاموش می‌شود. فایل نصب و راهنمای قدم‌به‌قدم در صفحهٔ افزونه است.",
       "بەڵێ، بۆ کرۆم و فایەرفۆکس. بە یەک کلیک نرخی زیندوو، ڕاپۆرتی ڕۆژ، شیکاریی ئانچین، ڕاستیپێو، زانستنامە، ژمێرەر، پۆستەکانی کەناڵ و ئاگاداریی نرخ دەبینیت. فایلی دامەزراندن و ڕێنمایی لە پەڕەی پێوەکراوەکەدایە.",
       "Yes, for Chrome and Firefox. One click shows live prices, the daily report, the on-chain analysis, the reality check, the encyclopedia, a calculator, channel posts and price alerts. The bitcoin price badge on the icon can be switched off in the Alerts tab. The install file and step-by-step guide are on the extension page."),
     "/extension/"),
    (["اپلیکیشن", "اپ اندروید", "برنامه موبایل", "دانلود اپ", "apk", "android app", "ئەپی ئەندرۆید", "نصب روی گوشی"],
     L("اپلیکیشن اندروید دارید؟", "ئەپی ئەندرۆیدتان هەیە؟", "Is there an Android app?"),
     L("بله. فایل APK را مستقیم از صفحهٔ اپلیکیشن دانلود و نصب کنید؛ از گوگل‌پلی لازم نیست. اگر نمی‌خواهید چیزی نصب کنید، نسخهٔ وب (PWA) را هم می‌توانید از منوی مرورگر به صفحهٔ اصلی گوشی اضافه کنید. همهٔ بخش‌های سایت در اپ هست.",
       "بەڵێ. فایلی APK ڕاستەوخۆ لە پەڕەی ئەپەکە دابگرە و دایبمەزرێنە. یان وەشانی وێب (PWA) لە مێنیووی وێبگەڕەوە زیاد بکە بۆ شاشەی سەرەکی.",
       "Yes. Download the APK directly from the app page and install it — no Google Play needed. If you would rather not install anything, add the web version (PWA) to your home screen from the browser menu. Every section of the site is in the app."),
     "/app/"),
    (["ربات تلگرام", "ربات شما", "بات تلگرام", "telegram bot", "بۆتی تێلێگرام", "Kurd_kurdistan_bot"],
     L("ربات تلگرام شما چه کار می‌کند؟", "بۆتی تێلێگرامەکەتان چی دەکات؟", "What does your Telegram bot do?"),
     L("ربات @Kurd_kurdistan_bot همهٔ امکانات سایت را داخل تلگرام می‌آورد: بررسی توکن با آدرس قرارداد، پورتفولیو و کیف‌پول‌های فقط‌خواندنی، مرکز هشدارها (قیمت، لانچ جدید، نهنگ‌ها، حجم غیرعادی)، تحلیل بازار و آنچین، مقایسهٔ دو ارز، واقعیت‌سنج، رادار نهنگ‌ها، دانشنامه، پروکسی اضطراری، راهنمای قطعی اینترنت، بازی پیش‌بینی و دعوت دوستان. به پنج زبان: فارسی، کوردی سورانی، کرمانجی، عربی و انگلیسی. برای استفاده عضو کانال Coin_Kurd باشید.",
       "بۆتی @Kurd_kurdistan_bot هەموو تایبەتمەندییەکانی ماڵپەڕ دەهێنێتە ناو تێلێگرام: پشکنینی تۆکن، پۆرتفۆلیۆ، ناوەندی ئاگاداری، شیکاریی بازاڕ و ئانچین، بەراوردی دوو دراو، ڕاستیپێو، ڕاداری نەهەنگ، زانستنامە، پرۆکسی فریاکەوتن، یاریی پێشبینی و بانگهێشتی هاوڕێ. بە پێنج زمان.",
       "@Kurd_kurdistan_bot brings the whole site into Telegram: token checks by contract address, a portfolio with read-only wallets, an alert centre (price, new launches, whales, unusual volume), market and on-chain analysis, two-coin comparison, the reality check, the whale radar, the encyclopedia, emergency proxies, an internet-outage guide, the prediction game and referrals — in five languages. You need to be a member of the Coin_Kurd channel."),
     bot_url()),
    (["هشدار قیمت", "هشدار بگذارم", "آلارم قیمت", "alert", "price alert", "set alert", "ئاگاداریی نرخ", "ئاگادارکەرەوە"],
     L("چطور هشدار قیمت بگذارم؟", "چۆن ئاگاداریی نرخ دابنێم؟", "How do I set a price alert?"),
     L("سه راه دارید: ۱) در سایت، «فضای من» ← هشدارها؛ شرط‌ها را ترکیب کنید (قیمت، تغییر ۲۴ ساعته، RSI) و تا وقتی صفحه باز است اعلان می‌گیرید. ۲) در ربات تلگرام، «مرکز هشدارها»؛ حتی وقتی آفلاین هستید پیام می‌گیرید و تعداد هشدارها نامحدود است. ۳) در افزونهٔ مرورگر، تب «هشدار»؛ اعلان روی دسکتاپ می‌آید.",
       "سێ ڕێگا: ١) ماڵپەڕ ← «بۆشاییی من» ← ئاگادارییەکان. ٢) بۆتی تێلێگرام ← «ناوەندی ئاگاداری»؛ تەنانەت کاتێک ئۆفلاینیت پەیام وەردەگریت و ژمارەیان بێسنوورە. ٣) پێوەکراوی وێبگەڕ ← تابی «ئاگاداری».",
       "Three ways: 1) on the site, My space → Alerts — combine conditions (price, 24h change, RSI); you are notified while the page is open. 2) In the Telegram bot, the Alert centre — messages arrive even when you are offline, and alerts are unlimited. 3) In the browser extension, the Alerts tab — desktop notifications."),
     "/me/"),
    (["زبان", "تغییر زبان", "کوردی", "انگلیسی", "language", "change language", "kurdish", "زمان", "گۆڕینی زمان"],
     L("زبان سایت را چطور عوض کنم؟", "چۆن زمانی ماڵپەڕ بگۆڕم؟", "How do I change the language?"),
     L("دکمه‌های «فا / کو / EN» بالای هر صفحه زبان را بین فارسی، کوردی سورانی و انگلیسی عوض می‌کنند و انتخاب‌تان ذخیره می‌شود. در ربات تلگرام از منوی «بیشتر ← تغییر زبان» پنج زبان دارید.",
       "دوگمەکانی «فا / کو / EN» لە سەرەوەی هەر پەڕەیەک زمان دەگۆڕن و هەڵبژاردنەکەت هەڵدەگیرێت. لە بۆتدا لە «زیاتر ← گۆڕینی زمان» پێنج زمان هەیە.",
       "The “فا / کو / EN” buttons at the top of every page switch between Persian, Sorani Kurdish and English, and your choice is remembered. In the Telegram bot, More → Language offers five languages."),
     "/"),
    (["دیسکورد", "کلاس شبانه", "کلاس زنده", "آموزش زنده", "discord", "live class", "دیسکۆرد", "پۆلی شەوانە"],
     L("کلاس زنده دارید؟", "پۆلی زیندووتان هەیە؟", "Do you hold live classes?"),
     L("بله، هر شب از ساعت ۸ به وقت تهران در دیسکورد کوین کورد: آموزش بازار، تحلیل زنده و پاسخ به موضوع‌هایی که خودتان درخواست می‌کنید. رایگان است.",
       "بەڵێ، هەموو شەوێک لە کاتژمێر ٨ی شەو بە کاتی تاران لە دیسکۆردی کۆین کورد: فێرکردنی بازاڕ، شیکاریی زیندوو و وەڵامی داواکارییەکانتان. بێبەرامبەرە.",
       "Yes — every night from 8 pm Tehran time on the Coin Kurd Discord: market lessons, live analysis and answers to the topics you request. It is free."),
     DISCORD),
    (["سازنده", "موسس", "بنیانگذار", "چه کسی", "کی ساخته", "founder", "who made", "who is behind", "دامەزرێنەر", "امید مکری", "کتاب"],
     L("چه کسی پشت انتخاب است؟", "کێ لە پشت ئینتیخابەوەیە؟", "Who is behind Entekhab?"),
     L("امید دباغچی مکری، کارشناس ارشد مهندسی کامپیوتر (هوش مصنوعی و رباتیک) از دانشگاه کردستان و نویسندهٔ کتاب «راهنمای تحلیل تکنیکال برای درک بازار رمزارزها» با همکاری دکتر فردین اخلاقیان طاب. نشانی entekhab.net از دی ۱۳۸۲ ثبت شده و کانال Coin_Kurd از بهمن ۱۳۹۸ فعال است؛ داستان کامل در صفحهٔ «درباره انتخاب» است.",
       "ئومێد دەباغچی موکری، ماستەر لە ئەندازیاریی کۆمپیوتەر لە زانکۆی کوردستان و نووسەری کتێبی «ڕێنمایی شیکاریی تەکنیکی بۆ تێگەیشتن لە بازاڕی دراوە دیجیتاڵییەکان». چیرۆکی تەواو لە پەڕەی «دەربارە»دایە.",
       "Omid Dabbaghchi Mokri — MSc in Computer Engineering (AI and Robotics) from the University of Kurdistan and author of “A Guide to Technical Analysis for Understanding Cryptocurrency Markets”, co-written with Dr Fardin Akhlaghian Tab. entekhab.net was registered in December 2003 and the Coin_Kurd channel has run since January 2020; the full story is on the About page."),
     "/about/"),
    (["آیدی تریدینگ ویو", "اندیکاتور خصوصی", "دسترسی اندیکاتور", "invite only", "tradingview access", "ابزار تیم", "روژ کردستان"],
     L("دسترسی اندیکاتورهای TradingView را چطور بگیرم؟", "چۆن دەستگەیشتن بە ئیندیکاتۆرەکانی TradingView وەربگرم؟", "How do I get access to your TradingView indicators?"),
     L(f"رایگان است و همراه آموزش فعال می‌شود: آیدی TradingView خود را در تلگرام برای @{ADMIN} بفرستید. دو ابزار از مجموعه سال‌هاست برای کسی فعال نمی‌شود تا سرمایهٔ کاربران ایرانی به تیم‌های خارجی منتقل نشود. سیگنال‌های اندیکاتورها در صفحهٔ «اندیکاتورهای اختصاصی» هم هست.",
       f"بێبەرامبەرە و لەگەڵ فێرکردن چالاک دەکرێت: ئایدیی TradingViewەکەت لە تێلێگرام بۆ @{ADMIN} بنێرە.",
       f"It is free and comes with the lessons: send your TradingView username to @{ADMIN} on Telegram. Two tools in the set are not enabled for anyone, so that Iranian users' capital is not sent to foreign teams. The indicators' signals are also on the Signature indicators page."),
     f"https://t.me/{ADMIN}"),
    (["پروکسی", "فیلتر", "اینترنت قطع", "قطعی اینترنت", "proxy", "internet outage", "پرۆکسی", "vpn"],
     L("اینترنت قطع یا فیلتر است؛ چه کنم؟", "ئینتەرنێت پچڕاوە؛ چی بکەم؟", "The internet is down or filtered — what can I do?"),
     L("در ربات تلگرام، «پروکسی اضطراری» پروکسی‌های تلگرام را به ترتیب گزارش کاربران داخل ایران می‌دهد و «راهنمای قطعی اینترنت» وضعیت اینترنت، کیت آمادگی و قیمت‌های سبک را نشان می‌دهد. افزونهٔ مرورگر آخرین دادهٔ دریافتی را هم نگه می‌دارد.",
       "لە بۆتدا «پرۆکسی فریاکەوتن» و «ڕێنمایی پچڕانی ئینتەرنێت» هەن.",
       "In the Telegram bot, Emergency proxy lists Telegram proxies ranked by reports from users inside Iran, and the Internet-outage guide shows connectivity, a preparedness kit and lightweight prices. The browser extension also keeps the last data it received."),
     bot_url("proxy")),
    (["دعوت دوستان", "رفرال", "لینک دعوت", "جایزه", "referral", "invite friends", "بانگهێشت"],
     L("دعوت از دوستان چه جایزه‌ای دارد؟", "بانگهێشتی هاوڕێ چ خەڵاتێکی هەیە؟", "Do I get anything for inviting friends?"),
     L("در ربات تلگرام، بخش «دعوت دوستان و پاداش» لینک اختصاصی شما را می‌دهد؛ هر عضو تازه‌ای که با آن بیاید برایتان امتیاز ثبت می‌شود.",
       "لە بۆتدا بەشی «بانگهێشتی هاوڕێ» بەستەری تایبەتی خۆت دەدات و هەر ئەندامێکی نوێ خاڵت بۆ تۆمار دەکات.",
       "In the Telegram bot, Invite friends & rewards gives you a personal link; every new member who joins through it earns you points."),
     bot_url("ref")),
    (["میدان نبرد", "نبرد", "battle", "battlefield", "مەیدانی شەڕ"],
     L("میدان نبرد چیست؟", "مەیدانی شەڕ چییە؟", "What is the Battlefield?"),
     L("بازار زندهٔ بیت‌کوین به شکل یک میدان نبرد سه‌بعدی: سفارش‌های خرید سپاه گاوها، سفارش‌های فروش سپاه خرس‌ها، هر معامله یک شلیک و هر لیکوئید شدن یک حمله؛ با دادهٔ زندهٔ Binance، OKX و Bybit و بدون ثبت‌نام.",
       "بازاڕی زیندووی بیتکۆین وەک مەیدانێکی شەڕی سێ‌ڕەهەندی، بە داتای زیندووی Binance، OKX و Bybit.",
       "The live bitcoin market as a 3D battlefield: buy orders are the bulls' army, sell orders the bears', every trade a shot and every liquidation an air strike — live data from Binance, OKX and Bybit, no sign-up."),
     "/battle/"),
    (["رایگان", "هزینه", "اشتراک", "پولی", "subscription", "free", "cost", "pricing", "بێبەرامبەر"],
     L("استفاده رایگان است؟", "بەکارهێنان بێبەرامبەرە؟", "Is it free?"),
     L("بله، همه‌چیز رایگان و بدون ثبت‌نام است: سایت، ربات، اپلیکیشن، افزونه، کلاس شبانهٔ دیسکورد و دسترسی اندیکاتورها. هیچ دوره و هیچ سیگنال پولی‌ای نمی‌فروشیم.",
       "بەڵێ، هەموو شتێک بێبەرامبەر و بێ تۆمارکردنە: ماڵپەڕ، بۆت، ئەپ، پێوەکراو و پۆلی شەوانە.",
       "Yes — everything is free and needs no sign-up: the site, the bot, the app, the extension, the nightly Discord class and indicator access. We sell no courses and no paid signals."),
     "/about/"),
    (["تماس", "پشتیبانی", "ادمین", "ارتباط", "contact", "support", "admin", "help", "human", "پەیوەندی"],
     L("چطور با شما تماس بگیرم؟", "چۆن پەیوەندیت پێوە بکەم؟", "How do I contact you?"),
     L(f"دکمهٔ «گفتگو با پشتیبان» در همین پنجره گفتگوی تلگرام با @{ADMIN} را باز می‌کند و پرسش‌تان را هم کپی می‌کند. گروه گفت‌وگو t.me/Coin_Kurd_Group و کلاس شبانهٔ دیسکورد هم هست.",
       f"دوگمەی «گفتوگۆ لەگەڵ پشتگیری» تێلێگرام لەگەڵ @{ADMIN} دەکاتەوە.",
       f"The “talk to a human” button in this window opens a Telegram chat with @{ADMIN} and copies your question. There is also the discussion group t.me/Coin_Kurd_Group and the nightly Discord class."),
     f"https://t.me/{ADMIN}"),
    (["کانال تلگرام", "گروه", "اینستاگرام", "یوتیوب", "شبکه اجتماعی", "telegram channel", "instagram", "youtube", "کەناڵ"],
     L("کانال‌ها و شبکه‌های اجتماعی شما کجاست؟", "کەناڵ و تۆڕە کۆمەڵایەتییەکانتان؟", "Where are your channels and social accounts?"),
     L("کانال t.me/Coin_Kurd، گروه t.me/Coin_Kurd_Group، ربات @Kurd_kurdistan_bot، اینستاگرام instagram.com/coin_kurd، ایکس x.com/omid_mokri، یوتیوب و دیسکورد کوین کورد. آرشیو کامل پست‌های کانال با دسته‌بندی در خود سایت هم هست.",
       "کەناڵ t.me/Coin_Kurd، گرووپ t.me/Coin_Kurd_Group، بۆت @Kurd_kurdistan_bot، ئینستاگرام، X، یوتیوب و دیسکۆرد.",
       "Channel t.me/Coin_Kurd, group t.me/Coin_Kurd_Group, bot @Kurd_kurdistan_bot, instagram.com/coin_kurd, x.com/omid_mokri, YouTube and the Coin Kurd Discord. The full categorised archive of the channel is on the site too."),
     "/#feed"),
    (["به روز", "هر چند وقت", "آپدیت", "update", "how often", "fresh", "نوێ", "سلامت", "سلامت داده", "وضعیت سایت",
      "خرابی", "کار نمی کند", "status", "health", "is the site down", "ساغی", "دۆخی ماڵپەڕ"],
     L("داده‌ها هر چند وقت به‌روز می‌شوند؟", "داتا هەر چەند جار نوێ دەبێتەوە؟", "How often is the data updated?"),
     L("قیمت‌ها در صفحه‌ها زنده‌اند؛ آرشیو کانال و بیشتر داده‌ها هر ۱۵ دقیقه به‌روز می‌شوند و تازگی هر منبع در صفحهٔ «شفافیت و وضعیت» نشان داده می‌شود.",
       "نرخەکان زیندوون؛ ئەرشیڤ و زۆربەی داتا هەر ١٥ خولەک نوێ دەبنەوە.",
       "Prices on the pages are live; the channel archive and most data refresh every 15 minutes, and each source's freshness is shown on the Status page."),
     "/status/"),
]
