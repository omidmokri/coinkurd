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
    ("/market/", ["pro"], None),
    ("/heatmap/", ["mmap"], None),
    ("/bubbles/", ["mmap"], None),
    ("/money-flow/", ["mmap", "flows"], None),
    ("/liquidity/", ["mmap"], None),
    ("/etf/", ["mmap"], None),
    ("/charts/", ["obs"], None),
    ("/charts/liquidation-heatmap/", ["obs", "deriv"], None),
    ("/charts/liquidation-map/", ["obs", "deriv"], None),
    ("/charts/open-interest/", ["obs", "deriv"], None),
    ("/charts/funding-rate/", ["obs", "deriv"], None),
    ("/charts/long-short/", ["obs", "deriv"], None),
    ("/calendar/", ["events"], None),
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
    ("/today/", ["today", "brain"], None),
    ("/class/", ["class"], None),
    ("/weekly/", ["week"], None),
    ("/roundtable/", ["council", "brain"], None),
    ("/opportunity/", ["oppcost"], "reality"),
    ("/ledger/", ["ledger", "track"], "reality"),
    ("/track-record/", ["trackrec"], "reality"),
    ("/truth/", ["truth"], "reality"),
    ("/strategy-lab/", ["stratlab"], "analysis"),
    ("/regime/", ["regime"], "reality"),
    ("/anomalies/", ["anomaly"], "reality"),
    ("/iran-friction/", ["friction"], "reality"),
    ("/hype/", ["hype2"], "reality"),
    ("/silent-exit/", ["silent"], "reality"),
    ("/iran-correlation/", ["corr"], "reality"),
    ("/tools/", ["dca", "tools"], "calc"),
    ("/safety/", ["token"], None),
    ("/me/", ["center", "pf"], "alerts"),
    ("/encyclopedia/", ["enc"], "enc"),
    ("/bitcoin/", ["learn"], None),
    ("/map/", ["learn"], None),
    ("/kids/", ["learn"], None),
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
     L("بله، برای کروم و فایرفاکس. با یک کلیک قیمت زنده، گزارش روز، تحلیل آنچین، واقعیت‌سنج، دانشنامه، ماشین‌حساب، پست‌های کانال و هشدار قیمت را می‌بینید. قیمت کوین دلخواه با نگه‌داشتن ماوس روی آیکون دیده می‌شود و هیچ عددی روی لوگو نمی‌نشیند. به کوردی، فارسی، عربی و انگلیسی است. فایل نصب و راهنمای قدم‌به‌قدم در صفحهٔ افزونه است.",
       "بەڵێ، بۆ کرۆم و فایەرفۆکس. بە یەک کلیک نرخی زیندوو، ڕاپۆرتی ڕۆژ، شیکاریی ئانچین، ڕاستیپێو، زانستنامە، ژمێرەر، پۆستەکانی کەناڵ و ئاگاداریی نرخ دەبینیت. نرخ بە ڕاگرتنی ماوس لەسەر ئایکۆن دەردەکەوێت و هیچ شتێک لەسەر لۆگۆ نانیشێت. فایلی دامەزراندن و ڕێنمایی لە پەڕەی پێوەکراوەکەدایە.",
       "Yes, for Chrome and Firefox. One click shows live prices, the daily report, the on-chain analysis, the reality check, the encyclopedia, a calculator, channel posts and price alerts. Hover over the icon to see your coin's price — nothing is ever drawn over the logo. It speaks Kurdish, Persian, Arabic and English. The install file and step-by-step guide are on the extension page."),
     "/extension/"),
    (["اپلیکیشن", "اپ اندروید", "برنامه موبایل", "دانلود اپ", "apk", "android app", "ئەپی ئەندرۆید", "نصب روی گوشی",
      "آیفون", "ایفون", "iphone", "ios", "آیپد", "ویندوز", "windows", "دسکتاپ", "کامپیوتر", "ئایفۆن", "ویندۆز"],
     L("اپلیکیشن دارید؟ (اندروید، آیفون، ویندوز)", "ئەپتان هەیە؟ (ئەندرۆید، ئایفۆن، ویندۆز)", "Is there an app? (Android, iPhone, Windows)"),
     L("بله، برای همه: اندروید (فایل APK مستقیم، بدون گوگل‌پلی)، آیفون و آیپد (از سافاری با «Add to Home Screen» نصب می‌شود؛ تمام‌صفحه و همیشه به‌روز)، ویندوز ۱۰ و ۱۱ ۶۴ بیتی (برنامهٔ دسکتاپ با قیمت زندهٔ بیت‌کوین روی آیکون سینی)، و افزونهٔ کروم و فایرفاکس. همه رایگان و بدون تبلیغ‌اند و راهنمای قدم‌به‌قدم هر کدام در صفحهٔ اپلیکیشن‌ها است.",
       "بەڵێ، بۆ هەموو: ئەندرۆید (فایلی APK ڕاستەوخۆ، بێ گووگڵ پلەی)، ئایفۆن و ئایپاد (لە سافارییەوە بە «Add to Home Screen» دادەمەزرێت؛ پڕشاشە و هەمیشە نوێ)، ویندۆزی ١٠ و ١١ی ٦٤ بیت (بەرنامەی دێسکتۆپ بە نرخی زیندووی بیتکۆین لەسەر ئایکۆنی سینی)، و پێوەکراوی کرۆم و فایەرفۆکس. هەمووی بێبەرامبەر و بێ ڕیکلامە و ڕێنمایی هەر یەکێک لە پەڕەی ئەپەکاندایە.",
       "Yes, for all of them: Android (a direct APK, no Google Play), iPhone and iPad (installed from Safari with “Add to Home Screen”; full screen and always up to date), Windows 10 and 11 64-bit (a desktop app with the live bitcoin price on its tray icon), and the Chrome and Firefox extension. All free and ad-free; each has a step-by-step guide on the apps page."),
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
       "ئومێد دەباغچی مکری، ماستەر لە ئەندازیاریی کۆمپیوتەر لە زانکۆی کوردستان و نووسەری کتێبی «ڕێنمایی شیکاریی تەکنیکی بۆ تێگەیشتن لە بازاڕی دراوە دیجیتاڵییەکان». چیرۆکی تەواو لە پەڕەی «دەربارە»دایە.",
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
    (["نبرد من", "نبرد کن", "میدان نبرد", "نبرد", "battle", "battlefield", "my battle", "fight", "شەڕی من", "شەڕ بکە", "مەیدانی شەڕ"],
     L("«نبرد من» چیست؟", "«شەڕی من» چییە؟", "What is My Battle?"),
     L("بازار زندهٔ بیت‌کوین به شکل یک جبههٔ کامل سه‌بعدی در خشکی، دریا، هوا و فضا: سفارش‌های خرید ارتش گاوها و سفارش‌های فروش ارتش خرس‌ها هستند، هر معامله یک شلیک واقعی است، سفارشی که چند سطح اوردربوک را یکجا جارو کند ربات‌ها و سگ‌های رباتیک را به میدان می‌فرستد، لیکوئید شدن‌ها حملهٔ پهپاد، جنگنده‌های ناو هواپیمابر، موشک و زیردریایی می‌شوند و ماهواره از هر دو ارتش گزارش اطلاعاتی می‌دهد؛ با دادهٔ زندهٔ Binance، OKX و Bybit و بدون ثبت‌نام.",
       "بازاڕی زیندووی بیتکۆین وەک بەرەیەکی تەواوی سێ‌ڕەهەندی لە وشکانی، دەریا، ئاسمان و بۆشایی: داواکارییەکانی کڕین سوپای گاکانن و داواکارییەکانی فرۆشتن سوپای ورچەکان، هەر مامەڵەیەک تەقەیەکی ڕاستەقینەیە، داواکارییەک کە چەند ئاستی ئۆردەربووک بە یەکجار بماڵێت ڕۆبۆت و سەگە ڕۆبۆتییەکان دەنێرێتە مەیدان، فڕۆکە جەنگییەکان لە کەشتیی فڕۆکەهەڵگرەوە هەڵدەستن و مانگی دەستکرد ڕاپۆرتی هەواڵگری لە هەردوو سوپا دەدات؛ بە داتای زیندووی Binance، OKX و Bybit.",
       "The live bitcoin market as a complete 3D front on land, at sea, in the air and from orbit: buy orders are the bulls' army and sell orders the bears', every trade is a real shot, an order that sweeps several levels of the book at once sends the robots and robot dogs out, liquidations become drone, carrier-jet, missile and submarine strikes, and a satellite reports on both armies — live data from Binance, OKX and Bybit, no sign-up."),
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
    (["مولتی چارت", "مولتی‌چارت", "چند چارت", "چند نمودار", "بازپخش نمودار", "بازپخش کندل", "بار ریپلی", "تایم فریم ثانیه",
      "تایم‌فریم ثانیه‌ای", "تقویم اقتصادی", "بازار زنده", "multi chart", "multichart", "bar replay", "chart replay",
      "seconds timeframe", "economic calendar", "live market", "چەند چارت", "دووبارە پەخشی چارت", "دووبارە پەخشی مۆم",
      "تایمفرەیمی چرکەیی", "ڕۆژژمێری ئابووری", "بازاڕی زیندوو", "رنکو", "renko", "کاگی", "kagi", "فراز", "faraz"],
     L("مولتی‌چارت، بازپخش نمودار و تقویم اقتصادی دارید؟", "چەند چارت، دووبارە پەخشی چارت و ڕۆژژمێری ئابووریتان هەیە؟",
       "Do you have multi-chart, bar replay and an economic calendar?"),
     L("بله، در صفحهٔ «بازار زنده»: تا ۱۶ نمودار هم‌زمان با همگام‌سازی نماد، تایم‌فریم، خط‌نشانگر و اندیکاتورها؛ تایم‌فریم ثانیه‌ای "
       "و هر تایم‌فریم دلخواه؛ ۱۷ نوع نمودار از جمله رنکو، کاگی، نقطه و رقم و شکست خط؛ بازپخش کندل‌ها و معاملهٔ تمرینی؛ ۷۰ اندیکاتور و "
       "ابزارهای فیبوناچی، گن و چنگال اندروز؛ دیده‌بان با بخش‌بندی و پرچم رنگی؛ هشدار قیمت و اندیکاتور؛ و تقویم اقتصادی با هشدار پیش "
       "از انتشار خبر. همهٔ کوین‌های بایننس و بازار ایران به تومان (دلار، یورو، طلا، سکه، تتر و بیت‌کوین تومانی) هم آنجاست. همه‌چیز "
       "خودکار در مرورگر شما ذخیره می‌شود. در ربات هم بخش «بازار زنده» آن را داخل تلگرام باز می‌کند.",
       "بەڵێ، لە پەڕەی «بازاڕی زیندوو»: تا ١٦ چارت پێکەوە بە هاوکاتکردنی دراو، تایمفرەیم، هێڵی نیشاندەر و ئیندیکاتۆرەکان؛ تایمفرەیمی "
       "چرکەیی و هەر تایمفرەیمێکی دڵخواز؛ ١٧ جۆری چارت لەوانە ڕێنکۆ، کاگی، خاڵ و ژمارە و شکانی هێڵ؛ دووبارە پەخشی مۆمەکان و مامەڵەی "
       "ڕاهێنان؛ ٧٠ ئیندیکاتۆر و ئامرازەکانی فیبۆناچی، گان و چنگاڵی ئەندرووز؛ لیستی چاودێری بە بەش و ئاڵای ڕەنگی؛ ئاگادارکەرەوەی نرخ و "
       "ئیندیکاتۆر؛ و ڕۆژژمێری ئابووری بە ئاگادارکردنەوە پێش بڵاوبوونەوەی هەواڵ. هەموو کۆینەکانی بایننس و بازاڕی ئێران بە تمەنیش "
       "(دۆلار، یۆرۆ، زێڕ، سکە، تەتەر و بیتکۆین بە تمەن) لەوێیە. لە بۆتیشدا بەشی «بازاڕی زیندوو» لە ناو تێلێگرام دەیکاتەوە.",
       "Yes — on the Live market page: up to 16 charts at once with synced symbol, timeframe, crosshair and indicators; seconds "
       "timeframes and any custom timeframe; 17 chart types including Renko, Kagi, Point & Figure and Line Break; bar replay with practice "
       "trades; 70 indicators plus Fibonacci, Gann and Andrews' pitchfork tools; watchlists with sections and colour flags; price and "
       "indicator alerts; and the economic calendar with an alert before each release. Every Binance coin and Iran's market in toman "
       "(dollar, euro, gold, coins, tether and bitcoin in toman) are there too. Everything is saved in your browser. In the Telegram bot, "
       "“Live market” opens it inside Telegram."),
     "/market/"),
    (["بک تست", "بک‌تست", "بکتست", "backtest", "back test", "تستر استراتژی", "strategy tester", "بهینه سازی", "بهینه‌سازی", "optimizer",
      "حساب تمرینی", "practice account", "دیده بان بازار", "دیده‌بان بازار", "market watch", "screener", "اسکرینر", "هشدار خبر",
      "هشدار اخبار", "news alert", "اخبار روی چارت", "news on chart", "هشدار خط روند", "trendline alert", "کد qr", "qr code",
      "انتقال به گوشی", "باکتێست", "باشترکردن", "چاودێری بازاڕ", "ئاگادارکەرەوەی هەواڵ", "هەواڵ لەسەر چارت",
      "فیوچرز", "فیوچرز فصلی", "b-adj", "badj", "futures", "quarterly futures", "فیوچەرز"],
     L("بک‌تست، بهینه‌سازی استراتژی و دیده‌بان بازار دارید؟", "باکتێست، باشترکردنی ستراتیژ و چاودێری بازاڕتان هەیە؟",
       "Do you have backtesting, strategy optimization and a market watch?"),
     L("بله، در «بازار زنده»: دکمهٔ «بک‌تست» ۸ استراتژی (و روی BTC سیگنال‌های کردستانی) را روی تاریخچهٔ چارت تا ۲۰٬۰۰۰ کندل می‌آزماید؛ "
       "بهینه‌ساز همهٔ تنظیمات یک بازه را امتحان و رتبه‌بندی می‌کند و هر گزارش سود خالص، درصد برد، فاکتور سود، بیشترین افت، شارپ، "
       "منحنی سرمایه و فایل CSV معامله‌ها را دارد. در بازپخش، حساب تمرینی با سفارش لیمیت و استاپ، حد ضرر و سود، حد ضرر متحرک، اهرم و "
       "کارمزد کار می‌کند. «دیده‌بان بازار» همهٔ کوین‌های بایننس یا بازار ایران را با حجم، تغییر، دامنهٔ ۲۴ساعته و RSI مرتب و فیلتر "
       "می‌کند. هشدار هم برای حرکت درصدی، خط روند و کانال، اندیکاتور و اخبار هست؛ اخبار هر ارز روی چارت دیده می‌شود و با لینک یا کد QR "
       "همان فضای کار در گوشی باز می‌شود. فیوچرز فصلی بیت‌کوین و اتریوم (بای‌بیت) هم به‌صورت یک چارت پیوسته با دکمهٔ B-ADJ "
       "(تعدیل تاریخچه در هر جابه‌جایی قرارداد) هست. همه شبیه‌سازی است و به هیچ صرافی وصل نمی‌شود.",
       "بەڵێ، لە «بازاڕی زیندوو»: دوگمەی «باکتێست» ٨ ستراتیژ (و لەسەر BTC سیگناڵەکانی کوردستانی) لەسەر مێژووی چارت تا ٢٠٬٠٠٠ مۆم "
       "تاقی دەکاتەوە؛ باشترکەر هەموو ڕێکخستنەکانی مەودایەک دەپشکنێت و ڕیزیان دەکات و هەر ڕاپۆرتێک قازانجی پوخت، ڕێژەی بردنەوە، "
       "فاکتەری قازانج، گەورەترین دابەزین، شارپ، هێڵی سەرمایە و فایلی CSVی مامەڵەکانی تێدایە. لە دووبارە پەخشدا هەژماری ڕاهێنان بە "
       "ئۆردەری لیمیت و ستۆپ، سنووری زیان و قازانج، لیڤەرێج و کرێ کار دەکات. «چاودێری بازاڕ» هەموو کۆینەکانی بایننس یان بازاڕی ئێران "
       "بەپێی قەبارە، گۆڕان و RSI ڕیز و پاڵاوتن دەکات. ئاگادارکەرەوە بۆ جووڵەی ڕێژەیی، هێڵی ڕەوت و کەناڵ، ئیندیکاتۆر و هەواڵیش هەیە. "
       "فیوچەرزی وەرزیی بیتکۆین و ئیسیریۆم (بایبیت) وەک یەک چارتی بەردەوام لەگەڵ دوگمەی B-ADJ هەیە. "
       "هەموو شتێک هاوشێوەکردنە و بە هیچ ئاڵوگۆڕخانەیەک پەیوەندی ناکات.",
       "Yes — on the Live market page: the Backtest button tests 8 strategies (plus the Kurdistani signals on BTC) on up to 20,000 bars of "
       "the chart's history; the optimizer tries every setting in a range and ranks them, and each report has the net result, win rate, "
       "profit factor, max drawdown, Sharpe, the equity curve and a CSV of the trades. In bar replay, a practice account works with limit "
       "and stop orders, stop-loss and take-profit, a trailing stop, leverage and fees. Market watch sorts and filters every Binance coin or "
       "Iran's market by volume, change, 24h range and RSI. Alerts also cover % moves, trend lines and channels, indicators and news; a "
       "coin's news shows on the chart, and a link or QR code opens the same workspace on your phone. Bitcoin and Ethereum quarterly "
       "futures (Bybit) run as one continuous chart with a B-ADJ button that back-adjusts each roll. It is all simulation — no exchange "
       "is contacted."),
     "/market/"),
]
