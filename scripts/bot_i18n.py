"""UI strings for the Coin_Kurd / Entekhab Telegram bot (fa · ckb · kmr · ar · en)."""

from bot_ar import AR
from bot_kmr import KMR

LANGS = ("fa", "ckb", "kmr", "ar", "en")
RTL = {"fa": True, "ckb": True, "kmr": False, "ar": True, "en": False}
LANG_NAMES = {"fa": "فارسی", "ckb": "کوردی (سۆرانی)", "kmr": "Kurdî (Kurmancî)", "ar": "العربية", "en": "English"}


def pick(d, lang):
    """choose a language from a {fa, ckb, en[, kmr, ar]} dict; Kurmanji/Arabic fall back to KMR[en]/AR[en], then English"""
    if not isinstance(d, dict):
        return d or ""
    if d.get(lang):
        return d[lang]
    if lang == "kmr":
        en = d.get("en")
        if isinstance(en, str):
            return KMR.get(en, en)
        return en or d.get("fa") or ""
    if lang == "ar":                                  # Arabic: AR[en], then English (not Persian)
        en = d.get("en")
        if isinstance(en, str):
            return AR.get(en, en)
        return en or d.get("fa") or ""
    return d.get("fa") or d.get("en") or ""

T = {
    # ---------------------------------------------------------------- menu
    "menu_title": {
        "fa": "📡 <b>انتخاب · Coin_Kurd</b>\nهمهٔ ابزارهای سایت entekhab.net داخل تلگرام. یک بخش را انتخاب کن 👇",
        "ckb": "📡 <b>ئینتیخاب · Coin_Kurd</b>\nهەموو ئامرازەکانی ماڵپەڕی entekhab.net لەناو تێلێگرام. بەشێک هەڵبژێرە 👇",
        "en": "📡 <b>Entekhab · Coin_Kurd</b>\nEvery tool from entekhab.net, inside Telegram. Pick a section 👇"},
    "b_irr": {"fa": "💵 دلار و تتر (تومان)", "ckb": "💵 دۆلار و تەتەر (تمەن)", "en": "💵 Dollar & tether (IRR)"},
    "b_indlive": {"fa": "📊 تحلیل زندهٔ اندیکاتورها", "ckb": "📊 شیکاریی زیندووی ئیندیکاتۆرەکان", "en": "📊 Live indicator analysis"},
    "b_live": {"fa": "📡 زنده (۱۵ دقیقه)", "ckb": "📡 ڕاستەوخۆ (١٥ خولەک)", "en": "📡 Live (15 min)"},
    "b_calc": {"fa": "🧮 ماشین‌حساب", "ckb": "🧮 ژمێرەر", "en": "🧮 Calculator"},
    "b_watch_on": {"fa": "🚨 هشدار جهش تتر: روشن کن", "ckb": "🚨 ئاگاداری تەتەر: هەڵیبکە", "en": "🚨 Tether spike alert: on"},
    "b_watch_off": {"fa": "🚨 هشدار جهش تتر: خاموش کن", "ckb": "🚨 ئاگاداری تەتەر: بیکوژێنەوە", "en": "🚨 Tether spike alert: off"},
    "b_predict": {"fa": "🎯 بازی پیش‌بینی", "ckb": "🎯 یاری پێشبینی", "en": "🎯 Prediction game"},
    "b_proxy": {"fa": "🛡 پروکسی اضطراری", "ckb": "🛡 پرۆکسی فریاکەوتن", "en": "🛡 Emergency proxy"},
    # ---------------------------------------------------------------- v2 sections (all five languages explicit)
    "b_token": {"fa": "🔎 بررسی توکن (CA)", "ckb": "🔎 پشکنینی تۆکن (CA)", "kmr": "🔎 Kontrola tokenê (CA)",
                "ar": "🔎 فحص رمز (CA)", "en": "🔎 Token check (CA)"},
    "b_pf": {"fa": "💼 پورتفولیو", "ckb": "💼 پۆرتفۆلیۆ", "kmr": "💼 Portfolyo", "ar": "💼 المحفظة", "en": "💼 Portfolio"},
    "b_center": {"fa": "🔔 مرکز هشدارها", "ckb": "🔔 ناوەندی ئاگادارییەکان", "kmr": "🔔 Navenda hişyariyan",
                 "ar": "🔔 مركز التنبيهات", "en": "🔔 Alert centre"},
    "b_learn": {"fa": "📚 آموزش و امنیت", "ckb": "📚 فێربوون و ئاسایش", "kmr": "📚 Perwerde û ewlehî",
                "ar": "📚 التعلم والأمان", "en": "📚 Learn & safety"},
    "b_outage": {"fa": "🆘 قطعی اینترنت", "ckb": "🆘 پچڕانی ئینتەرنێت", "kmr": "🆘 Qutbûna înternetê",
                 "ar": "🆘 انقطاع الإنترنت", "en": "🆘 Internet outage"},
    "b_outage_live": {"fa": "🆘 اینترنت ایران مختل است — راهنما", "ckb": "🆘 ئینتەرنێتی ئێران تێکچووە — ڕێنمایی",
                      "kmr": "🆘 Înterneta Îranê tevlihev e — rêber", "ar": "🆘 إنترنت إيران مضطرب — الدليل",
                      "en": "🆘 Iran internet disrupted — guide"},
    "b_follow": {"fa": "👀 دنبال کردن کیف‌ها", "ckb": "👀 شوێنکەوتنی جزدان", "kmr": "👀 Şopandina cûzdanan",
                 "ar": "👀 متابعة المحافظ", "en": "👀 Follow wallets"},
    "b_dca": {"fa": "📆 خرید پله‌ای و حجم معامله", "ckb": "📆 DCA و قەبارەی مامەڵە", "kmr": "📆 DCA û mezinahî",
              "ar": "📆 الشراء الدوري وحجم الصفقة", "en": "📆 DCA & position size"},
    "b_lite": {"fa": "📋 نسخهٔ سبک", "ckb": "📋 سووک", "kmr": "📋 Sivik", "ar": "📋 نسخة خفيفة", "en": "📋 Lite"},
    "help2": {"fa": ("<b>ابزارهای جدید</b>\n/check آدرس — بررسی توکن و تشخیص اسکم (یا فقط آدرس را بفرست)\n"
                     "/alert BTC +5% هشدار درصدی  ·  /center مرکز هشدارها (نهنگ، حجم، لانچ، سیگنال)\n"
                     "/pf پورتفولیو  ·  /wallet add آدرس  ·  /follow آدرس\n/dca خرید پله‌ای  ·  /size حجم معامله\n"
                     "/learn آموزش و قوانین  ·  /proxy پروکسی  ·  /outage حالت قطعی  ·  /lite قیمت سبک"),
              "ckb": ("<b>ئامرازە نوێیەکان</b>\n/check ناونیشان — پشکنینی تۆکن (یان تەنها ناونیشانەکە بنێرە)\n"
                      "/alert BTC +5% ئاگاداری ڕێژەیی  ·  /center ناوەندی ئاگادارییەکان\n"
                      "/pf پۆرتفۆلیۆ  ·  /wallet add ناونیشان  ·  /follow ناونیشان\n/dca کڕینی پلەیی  ·  /size قەبارەی مامەڵە\n"
                      "/learn فێربوون  ·  /proxy پرۆکسی  ·  /outage دۆخی پچڕان  ·  /lite نرخی سووک"),
              "kmr": ("<b>Amûrên nû</b>\n/check navnîşan — kontrola tokenê (an tenê navnîşanê bişîne)\n"
                      "/alert BTC +5% hişyariya ji sedî  ·  /center navenda hişyariyan\n"
                      "/pf portfolyo  ·  /wallet add navnîşan  ·  /follow navnîşan\n/dca DCA  ·  /size mezinahiya bazirganiyê\n"
                      "/learn perwerde  ·  /proxy proxy  ·  /outage rewşa qutbûnê  ·  /lite bihayên sivik"),
              "ar": ("<b>أدوات جديدة</b>\n/check العنوان — فحص الرمز وكشف الاحتيال (أو أرسل العنوان فقط)\n"
                     "/alert BTC +5% تنبيه بالنسبة  ·  /center مركز التنبيهات (حيتان، حجم، إطلاقات، إشارات)\n"
                     "/pf المحفظة  ·  /wallet add العنوان  ·  /follow العنوان\n/dca الشراء الدوري  ·  /size حجم الصفقة\n"
                     "/learn التعلم والقوانين  ·  /proxy البروكسي  ·  /outage وضع الانقطاع  ·  /lite أسعار خفيفة"),
              "en": ("<b>New tools</b>\n/check address — token check & scam warnings (or just paste the address)\n"
                     "/alert BTC +5% percent alert  ·  /center alert centre (whales, volume, launches, signals)\n"
                     "/pf portfolio  ·  /wallet add address  ·  /follow address\n/dca DCA plans  ·  /size position size\n"
                     "/learn lessons & local rules  ·  /proxy proxies  ·  /outage outage mode  ·  /lite light prices")},
    "qa_head": {"fa": "🔔 هشدار سریع برای {c} (قیمت فعلی {p}):", "ckb": "🔔 ئاگاداری خێرا بۆ {c} (ئێستا {p}):",
                "kmr": "🔔 Hişyariya bilez ji bo {c} (niha {p}):", "ar": "🔔 تنبيه سريع لـ {c} (الآن {p}):",
                "en": "🔔 Quick alert for {c} (now {p}):"},
    "qa_custom": {"fa": "✍️ عدد دلخواه", "ckb": "✍️ ژمارەی دڵخواز", "kmr": "✍️ Hejmara xwe", "ar": "✍️ رقم مخصص", "en": "✍️ Custom"},
    "alert_pct_set": {"fa": "🔔 هشدار ثبت شد: {coin} {spec} (مبنا {now})", "ckb": "🔔 ئاگاداری تۆمارکرا: {coin} {spec} (بنەما {now})",
                      "kmr": "🔔 Hişyarî hat danîn: {coin} {spec} (bingeh {now})", "ar": "🔔 تم ضبط التنبيه: {coin} {spec} (المرجع {now})",
                      "en": "🔔 Alert set: {coin} {spec} (from {now})"},
    "alert_pct_hit": {"fa": "🚨 <b>هشدار درصدی</b>\n{coin} {pct}٪ تغییر کرد ({ref} → {now})",
                      "ckb": "🚨 <b>ئاگاداری ڕێژەیی</b>\n{coin} {pct}٪ گۆڕا ({ref} ← {now})",
                      "kmr": "🚨 <b>Hişyariya ji sedî</b>\n{coin} {pct}% guherî ({ref} → {now})",
                      "ar": "🚨 <b>تنبيه النسبة المئوية</b>\n{coin} تغيّر {pct}٪ ({ref} ← {now})",
                      "en": "🚨 <b>% alert</b>\n{coin} moved {pct}% ({ref} → {now})"},
    "watch_on": {"fa": "🚨 روشن شد: اگر تتر در ۱۵ دقیقه ±۱٪ یا بیشتر تکان بخورد خبرت می‌کنم.",
                 "ckb": "🚨 هەڵکرا: ئەگەر تەتەر لە ١٥ خولەکدا ±١٪ جووڵا ئاگادارت دەکەم.",
                 "en": "🚨 On: I'll ping you if tether moves ±1% or more within 15 minutes."},
    "watch_off": {"fa": "🔕 هشدار جهش تتر خاموش شد.", "ckb": "🔕 ئاگاداری تەتەر کوژایەوە.", "en": "🔕 Tether spike alert off."},
    "watch_hit": {"fa": "🚨 <b>تتر {dir} {pct}٪ در {mins} دقیقه</b>\n{p0} ← {p1} تومان",
                  "ckb": "🚨 <b>تەتەر {dir} {pct}٪ لە {mins} خولەکدا</b>\n{p0} ← {p1} تمەن",
                  "en": "🚨 <b>Tether {dir} {pct}% in {mins} min</b>\n{p0} → {p1} toman"},
    "calc_usage": {"fa": "🧮 مثال: <code>/calc 10000000</code> (تومان → تتر) یا <code>/calc 500 usdt</code> (تتر → تومان)",
                   "ckb": "🧮 نموونە: <code>/calc 10000000</code> (تمەن → تەتەر) یان <code>/calc 500 usdt</code>",
                   "en": "🧮 Example: <code>/calc 10000000</code> (toman → USDT) or <code>/calc 500 usdt</code>"},
    "proxy_none": {"fa": "فعلاً پروکسی اضطراری ثبت نشده است.", "ckb": "هێشتا پرۆکسی تۆمار نەکراوە.", "en": "No emergency proxy posted yet."},
    "live_on": {"fa": "📡 این پیام تا ۱۵ دقیقه هر دقیقه به‌روز می‌شود.", "ckb": "📡 ئەم پەیامە تا ١٥ خولەک هەموو خولەکێک نوێ دەبێتەوە.",
                "en": "📡 This message refreshes every minute for 15 minutes."},
    "b_market": {"fa": "📊 وضعیت بازار", "ckb": "📊 دۆخی بازاڕ", "en": "📊 Market"},
    "b_brain": {"fa": "🧠 مغز بازار", "ckb": "🧠 مێشکی بازاڕ", "en": "🧠 Market Brain"},
    "b_coin": {"fa": "🪙 تحلیل کوین", "ckb": "🪙 شیکاری دراو", "en": "🪙 Coin lookup"},
    "b_opps": {"fa": "🎯 فرصت‌ها (اسکنر)", "ckb": "🎯 دەرفەتەکان (سکانەر)", "en": "🎯 Opportunities"},
    "b_movers": {"fa": "🚀 بیشترین رشد/افت", "ckb": "🚀 زۆرترین بەرزبوون/دابەزین", "en": "🚀 Gainers/Losers"},
    "b_score": {"fa": "🏅 امتیاز انتخاب", "ckb": "🏅 خاڵی ئینتیخاب", "en": "🏅 Entekhab Score"},
    "b_news": {"fa": "📰 اخبار", "ckb": "📰 هەواڵ", "en": "📰 News"},
    "b_narr": {"fa": "🔥 روایت‌های داغ", "ckb": "🔥 چیرۆکە گەرمەکان", "en": "🔥 Narratives"},
    "b_events": {"fa": "📅 تقویم اقتصادی", "ckb": "📅 ڕۆژژمێری ئابووری", "en": "📅 Econ calendar"},
    "b_council": {"fa": "🏛 شورای هوش مصنوعی", "ckb": "🏛 ئەنجومەنی AI", "en": "🏛 AI Council"},
    "b_deriv": {"fa": "⚖️ مشتقات و فاندینگ", "ckb": "⚖️ دەرهاوێشتە و فاندینگ", "en": "⚖️ Derivatives"},
    "b_lab": {"fa": "🧪 آزمایشگاه", "ckb": "🧪 تاقیگە", "en": "🧪 Lab"},
    "b_cycle": {"fa": "🌀 چرخه و ارزش‌گذاری", "ckb": "🌀 خول و نرخاندن", "en": "🌀 Cycle & value"},
    "b_chain": {"fa": "⛓ آنچین بیت‌کوین", "ckb": "⛓ ئۆنچەینی بیتکۆین", "en": "⛓ BTC on-chain"},
    "b_flows": {"fa": "💧 جریان سرمایه بخش‌ها", "ckb": "💧 ڕەوتی سەرمایەی کەرتەکان", "en": "💧 Sector flows"},
    "b_week": {"fa": "🗓 خلاصهٔ هفته", "ckb": "🗓 پوختەی هەفتە", "en": "🗓 Week wrapped"},
    "b_posts": {"fa": "📢 پست‌های کانال", "ckb": "📢 پۆستەکانی کەناڵ", "en": "📢 Channel posts"},
    "b_track": {"fa": "📈 کارنامهٔ سیگنال‌ها", "ckb": "📈 تۆماری سیگناڵەکان", "en": "📈 Track record"},
    "b_ind": {"fa": "📡 اندیکاتورها", "ckb": "📡 ئیندیکاتۆرەکان", "en": "📡 Indicators"},
    "b_alerts": {"fa": "🔔 هشدار قیمت", "ckb": "🔔 ئاگاداری نرخ", "en": "🔔 Price alerts"},
    "b_ref": {"fa": "🎁 دعوت و پاداش", "ckb": "🎁 بانگهێشت و خەڵات", "en": "🎁 Invite & earn"},
    "b_lang": {"fa": "🌐 زبان", "ckb": "🌐 زمان", "en": "🌐 Language"},
    "b_site": {"fa": "🌍 سایت entekhab.net", "ckb": "🌍 ماڵپەڕی entekhab.net", "en": "🌍 entekhab.net"},
    "b_album": {"fa": "📸 گزارش تصویری", "ckb": "📸 ڕاپۆرتی وێنەیی", "kmr": "📸 Rapora wêneyî", "ar": "📸 التقرير المصور",
                "en": "📸 Picture report"},
    "b_battle": {"fa": "⚔️ نبرد من: بازار زنده سه‌بعدی", "ckb": "⚔️ شەڕی من: بازاڕی زیندووی سێ‌ڕەهەندی", "kmr": "⚔️ Şerê min: bazara zindî ya 3D",
                 "ar": "⚔️ معركتي: السوق الحي ثلاثي الأبعاد", "en": "⚔️ My Battle: the live market in 3D"},
    "battle_text": {
        "fa": "⚔️ <b>نبرد من</b>\n\n• سفارش‌های خرید، ارتش سبز گاوها و سفارش‌های فروش، ارتش قرمز خرس‌ها هستند؛ قیمت لحظه‌ای خط مقدم است.\n• هر معامله یک شلیک واقعی است: معاملهٔ کوچک تیر تفنگ، بزرگ‌تر موشک ضدزره و گلولهٔ تانک، خیلی بزرگ آتش توپخانه و از ۵۰۰ هزار دلار به بالا توپ ناوچه و ناوشکن.\n• ربات‌های انسان‌نما و سگ‌های رباتیک: وقتی یک سفارش چند سطح اوردربوک را یکجا جارو می‌کند، تیم واکنش سریعِ همان طرف از پایگاه بیرون می‌آید و رگبار می‌زند.\n• لیکوئید شدن‌ها حمله می‌شوند: از پهپاد، توپخانه و بالگردی که از سکوی فرود پایگاه یا عرشهٔ ناو هواپیمابر بلند می‌شود تا جنگنده‌هایی که منجنیق ناو پرتابشان می‌کند، موشک کروز ناوشکن و موشک زیردریایی.\n• ماهواره هر چند دقیقه از هر دو ارتش گزارش می‌دهد: بزرگ‌ترین سنگر خرید و فروش، جریان معاملات و لیکوئیدها.\n• هیچ جزئی نمایشی نیست: رادارها و نورافکن‌ها روی هواپیما و موشک مهاجم قفل می‌کنند، پهپادها برای توپخانه هدف‌یابی می‌کنند، سنگین‌ترین حمله‌ها انبار مهمات، آشیانهٔ هواپیما یا رادار دشمن را می‌زنند و به آتش می‌کشند مگر پدافند موشک را بزند، و خودروها از گاراژ و دروازهٔ پایگاه بیرون می‌آیند بی‌آنکه از میان هیچ مانع یا خودروی دیگری رد شوند.\n• شش دوربین: آزاد، دنبال خط، تاکتیکی، ناوگان، ماهواره و دوربین سینمایی که مثل یک فیلم هالیوودی میان لحظه‌های بزرگ نبرد کات می‌زند.\n\nدادهٔ زندهٔ Binance، OKX و Bybit، بدون ثبت‌نام. این تصویرِ ساختار فعلی بازار است، نه پیش‌بینی قیمت.",
        "ckb": "⚔️ <b>شەڕی من</b>\n\n• داواکارییەکانی کڕین سوپای سەوزی گاکانن و داواکارییەکانی فرۆشتن سوپای سووری ورچەکان؛ نرخی ئێستا هێڵی پێشەوەیە.\n• هەر مامەڵەیەک تەقەیەکی ڕاستەقینەیە: مامەڵەی بچووک گوللەی تفەنگ، گەورەتر مووشەکی دژەزرێپۆش و تۆپی تانک، زۆر گەورە ئاگری تۆپخانە و لە ٥٠٠ هەزار دۆلار بەرەو سەرەوە تۆپی فرگەیت و کەشتیی جەنگی.\n• ڕۆبۆتی مرۆڤئاسا و سەگی ڕۆبۆتی: کاتێک داواکارییەک چەند ئاستی ئۆردەربووک بە یەکجار دەماڵێت، تیمی کاردانەوەی خێرای ئەو لایە لە بنکە دێتە دەرەوە و تەقە دەکات.\n• لیکویدبوونەکان دەبنە هێرش: لە درۆن، تۆپخانە و هەلیکۆپتەرێک کە لە سەکۆی نیشتنەوەی بنکە یان سەر کەشتیی فڕۆکەهەڵگرەوە هەڵدەستێت تا فڕۆکە جەنگییەکان کە کاتاپۆڵتی کەشتییەکە هەڵیاندەدات، مووشەکی کرووزی کەشتیی جەنگی و مووشەکی ژێردەریایی.\n• مانگی دەستکرد هەر چەند خولەک جارێک ڕاپۆرت لە هەردوو سوپا دەدات: گەورەترین سەنگەری کڕین و فرۆشتن، ڕەوتی مامەڵەکان و لیکویدبوونەکان.\n• هیچ شتێک تەنها بۆ نمایش نییە: ڕادار و ڕووناککەرەوەکان لەسەر فڕۆکە و مووشەکی هێرشبەر قفڵ دەبن، درۆنەکان ئامانج بۆ تۆپخانە دەدۆزنەوە، قورسترین هێرشەکان کۆگای تەقەمەنی، هەنگاری فڕۆکە یان ڕاداری دوژمن دەپێکن و ئاگری تێبەردەدەن مەگەر بەرگریی ئاسمانی مووشەکەکە بخات، و ئۆتۆمبێلەکان لە گەراج و دەروازەی بنکەوە دێنە دەرەوە بێ ئەوەی بە ناو هیچ بەربەست یان ئۆتۆمبێلێکی تردا تێپەڕن.\n• شەش کامێرا: ئازاد، دوای هێڵ، تاکتیکی، کەشتیگەل، مانگی دەستکرد و کامێرای سینەمایی کە وەک فیلمێکی هۆلیوودی لە نێوان ساتە گەورەکانی شەڕدا دەبڕێت.\n\nداتای زیندووی Binance، OKX و Bybit، بەبێ تۆمارکردن. ئەمە وێنەی پێکهاتەی ئێستای بازاڕە، نەک پێشبینیی نرخ.",
        "kmr": "⚔️ <b>Şerê min</b>\n\n• Fermanên kirînê artêşa kesk a gayan in, fermanên firotinê artêşa sor a hirçan in; bihayê niha xeta pêşîn e.\n• Her danûstandin guleyeke rastîn e: ya biçûk guleya tivingê, ya mezintir mûşeka dijî-zirxî û guleya tankê, ya pir mezin agirê topxaneyê, û ji 500 hezar dolarî û jor ve topa frigat û keştiya şer.\n• Robotên mirovşêwe û kûçikên robot: dema fermanek bi carekê çend astên bihayê di pirtûka fermanan de dixwe, tîma bertekê ya bilez a wî alî ji baregehê derdikeve û gule berdide.\n• Lîkîdasyon dibin êrîş: ji dron, topxane û helîkoptera ku ji helîpada baregehê an ji ser keştiya balafirhilgir radibe heta balafirên şer ên ku katapulta keştiyê wan diavêje, mûşeka cruise ya keştiya şer û mûşeka binavahiyê.\n• Peyk her çend deqeyan carekê ji her du artêşan rapor dide: mezintirîn çepera kirîn û firotinê, herikîna danûstandinan û lîkîdasyon.\n• Tiştek tenê ji bo nîşandanê nîne: radar û ronahiyên lêgerînê li ser balafir û mûşekên êrîşkar kilît dibin, dron ji topxaneyê re armancan dibînin, êrîşên herî giran embara cebilxaneyê, hangara balafiran an radara dijmin dikin hedef û dişewitînin heta ku parastina hewayî mûşekê nexe, û wesayît ji garaj û deriyê baregehê derdikevin bêyî ku di nav tu astengî an wesayîteke din re derbas bibin.\n• Şeş kamera: azad, li pey xetê, taktîkî, fîlo, peyk û kameraya sînemayî ya ku wek fîlmeke Hollywoodê di navbera kêliyên mezin ên şer de qut dike.\n\nDaneyên zindî yên Binance, OKX û Bybit, bê tomarkirin. Ev wêneya avahiya niha ya bazarê ye, ne pêşbîniya bihayê ye.",
        "ar": "⚔️ <b>معركتي</b>\n\n• أوامر الشراء هي جيش الثيران الأخضر وأوامر البيع هي جيش الدببة الأحمر؛ والسعر اللحظي هو خط الجبهة.\n• كل صفقة طلقة حقيقية: الصفقة الصغيرة رصاصة بندقية، والأكبر صاروخ مضاد للدروع وقذيفة دبابة، والكبيرة جدًا نيران مدفعية، ومن 500 ألف دولار فأكثر مدفع الفرقاطة والمدمّرة.\n• روبوتات بشرية الشكل وكلاب آلية: عندما يكتسح أمرٌ واحد عدة مستويات من دفتر الأوامر دفعةً واحدة، يخرج فريق الرد السريع لذلك الجانب من القاعدة ويطلق النار.\n• التصفيات تتحول إلى هجمات: من المسيّرات والمدفعية والمروحيات التي تقلع من مهبط القاعدة أو من سطح حاملة الطائرات إلى المقاتلات التي يطلقها منجنيق الحاملة، وصواريخ كروز من المدمّرة وصواريخ الغواصة.\n• القمر الصناعي يقدّم كل بضع دقائق تقريرًا عن الجيشين: أكبر موقع شراء وبيع، وتدفق الصفقات والتصفيات.\n• لا شيء للاستعراض فقط: الرادارات والكشافات تثبت على الطائرات والصواريخ المهاجمة، والمسيّرات ترصد الأهداف للمدفعية، وأعنف الضربات تصيب مستودع الذخيرة أو حظيرة الطائرات أو رادار العدو فتشعل فيه النار ما لم يُسقط الدفاع الجوي الصاروخ، والمركبات تخرج من مرأب القاعدة وبوابتها دون أن تعبر أي عائق أو مركبة أخرى.\n• ست كاميرات: حرّة، متابعة الخط، تكتيكية، الأسطول، القمر الصناعي، وكاميرا سينمائية تنتقل بين أكبر لحظات المعركة كفيلم هوليوودي.\n\nبيانات حية من Binance وOKX وBybit، بلا تسجيل. هذه صورة لبنية السوق الحالية، وليست توقعًا للسعر.",
        "en": "⚔️ <b>My Battle</b>\n\n• Buy orders are the bulls' green army and sell orders the bears' red army; the live price is the front line.\n• Every trade is a real shot: a small trade is rifle fire, a larger one an anti-tank missile or a tank round, a very large one artillery, and from $500k up the frigate's and the destroyer's guns.\n• Humanoid robots and robot dogs: when one order sweeps several levels of the book at once, that side's quick-reaction team comes out of its base and opens fire.\n• Liquidations become strikes: from drones, artillery and helicopters that lift off their base's helipad or the carrier's deck to jets shot off its catapults, a destroyer's cruise missiles and submarine-launched missiles.\n• A satellite reports on both armies every few minutes: the largest buy and sell positions, trade flow and liquidations.\n• Nothing is just for show: radars and searchlights lock onto incoming aircraft and missiles, drones spot targets for the artillery, the heaviest strikes hit the enemy's ammo dump, hangar or radar and set it ablaze unless air defence shoots the missile down, and vehicles drive out of their base's motor pool and gate without ever passing through an obstacle or another vehicle.\n• Six cameras: free, follow the line, tactical, fleet, satellite, and a cinematic camera that cuts between the battle's biggest moments like a Hollywood film.\n\nLive data from Binance, OKX and Bybit, no sign-up. It is a picture of current market structure, not a price prediction.",
    },
    "apps_text": {
        "fa": ("📲 <b>اپلیکیشن‌های انتخاب</b>\nانتخاب روی هر صفحه‌ای — رایگان، بدون تبلیغ و بدون ردیابی:\n\n"
               "🤖 <b>اندروید</b> — اپ سبک و امن، دانلود مستقیم (بدون گوگل‌پلی)\n"
               "📱 <b>آیفون و آیپد</b> — از سافاری نصب می‌شود؛ تمام‌صفحه و همیشه به‌روز\n"
               "💻 <b>ویندوز ۶۴ بیتی</b> — برنامهٔ دسکتاپ با قیمت زندهٔ بیت‌کوین روی آیکون سینی\n"
               "🧩 <b>افزونهٔ مرورگر</b> — کروم، اج، بریو، اپرا و فایرفاکس\n"
               "✈️ <b>همین ربات</b> — قیمت، هشدار و گزارش روزانه داخل تلگرام\n\n"
               "نصب هر کدام را از دکمه‌های زیر شروع کنید."),
        "ckb": ("📲 <b>ئەپەکانی ئینتیخاب</b>\nئینتیخاب لەسەر هەر شاشەیەک — بێبەرامبەر، بێ ڕیکلام و بێ شوێنکەوتن:\n\n"
                "🤖 <b>ئەندرۆید</b> — ئەپێکی سووک و سەلامەت، داگرتنی ڕاستەوخۆ (بێ گووگڵ پلەی)\n"
                "📱 <b>ئایفۆن و ئایپاد</b> — لە سافارییەوە دادەمەزرێت؛ پڕشاشە و هەمیشە نوێ\n"
                "💻 <b>ویندۆزی ٦٤ بیت</b> — بەرنامەی دێسکتۆپ بە نرخی زیندووی بیتکۆین لەسەر ئایکۆنی سینی\n"
                "🧩 <b>پێوەکراوی وێبگەڕ</b> — کرۆم، ئێج، بڕەیڤ، ئۆپێرا و فایەرفۆکس\n"
                "✈️ <b>هەر ئەم بۆتە</b> — نرخ، ئاگاداری و ڕاپۆرتی ڕۆژانە لە ناو تێلێگرامدا\n\n"
                "دامەزراندنی هەر یەکێک لە دوگمەکانی خوارەوە دەست پێبکە."),
        "kmr": ("📲 <b>Sepanên Entekhab</b>\nEntekhab li ser her ekranê — belaş, bê reklam û bê şopandin:\n\n"
                "🤖 <b>Android</b> — sepaneke sivik û ewle, daxistina rasterast (bê Google Play)\n"
                "📱 <b>iPhone û iPad</b> — ji Safariyê tê sazkirin; ekrana tijî û her dem nû\n"
                "💻 <b>Windows 64-bit</b> — bernameya sermaseyê bi bihayê zindî yê bitcoinê li ser îkona tepsiyê\n"
                "🧩 <b>Pêveka gerokê</b> — Chrome, Edge, Brave, Opera û Firefox\n"
                "✈️ <b>Ev bot</b> — biha, hişyarî û rapora rojane di nav Telegramê de\n\n"
                "Sazkirina her yekê ji bişkokên jêrîn dest pê bike."),
        "ar": ("📲 <b>تطبيقات انتخاب</b>\nانتخاب على كل شاشة — مجانًا، بلا إعلانات وبلا تتبّع:\n\n"
               "🤖 <b>أندرويد</b> — تطبيق خفيف وآمن، تنزيل مباشر (دون Google Play)\n"
               "📱 <b>آيفون وآيباد</b> — يُثبَّت من Safari؛ بملء الشاشة ومحدَّث دائمًا\n"
               "💻 <b>ويندوز 64 بت</b> — برنامج سطح مكتب مع سعر البيتكوين المباشر على أيقونة شريط المهام\n"
               "🧩 <b>إضافة المتصفح</b> — كروم وإيدج وبريف وأوبرا وفايرفوكس\n"
               "✈️ <b>هذا البوت</b> — الأسعار والتنبيهات والتقرير اليومي داخل تيليجرام\n\n"
               "ابدأ تثبيت أيٍّ منها من الأزرار أدناه."),
        "en": ("📲 <b>The Entekhab apps</b>\nEntekhab on every screen — free, no ads, no tracking:\n\n"
               "🤖 <b>Android</b> — a light, locked-down app, direct download (no Google Play)\n"
               "📱 <b>iPhone & iPad</b> — installs from Safari; full screen and always up to date\n"
               "💻 <b>Windows 64-bit</b> — a desktop app with the live bitcoin price on its tray icon\n"
               "🧩 <b>Browser extension</b> — Chrome, Edge, Brave, Opera and Firefox\n"
               "✈️ <b>This bot</b> — prices, alerts and the daily report inside Telegram\n\n"
               "Start any install from the buttons below."),
    },
    "b_app_android": {"fa": "🤖 اندروید", "ckb": "🤖 ئەندرۆید", "kmr": "🤖 Android", "ar": "🤖 أندرويد", "en": "🤖 Android"},
    "b_app_iphone": {"fa": "📱 آیفون و آیپد", "ckb": "📱 ئایفۆن و ئایپاد", "kmr": "📱 iPhone û iPad", "ar": "📱 آيفون وآيباد", "en": "📱 iPhone & iPad"},
    "b_app_windows": {"fa": "💻 ویندوز", "ckb": "💻 ویندۆز", "kmr": "💻 Windows", "ar": "💻 ويندوز", "en": "💻 Windows"},
    "b_app_ext": {"fa": "🧩 افزونهٔ مرورگر", "ckb": "🧩 پێوەکراوی وێبگەڕ", "kmr": "🧩 Pêveka gerokê", "ar": "🧩 إضافة المتصفح", "en": "🧩 Browser extension"},
    "b_app_all": {"fa": "📲 همهٔ اپلیکیشن‌ها", "ckb": "📲 هەموو ئەپەکان", "kmr": "📲 Hemû sepan", "ar": "📲 كل التطبيقات", "en": "📲 All apps"},
    "b_back": {"fa": "⬅️ منو", "ckb": "⬅️ لیست", "en": "⬅️ Menu"},
    "b_more": {"fa": "بیشتر در سایت ↗", "ckb": "زیاتر لە ماڵپەڕ ↗", "en": "More on site ↗"},
    "b_mempool": {"fa": "🔴 مم‌پول زنده: هر تراکنش روی نقشه ↗", "ckb": "🔴 مێمپووڵی زیندوو: هەموو مامەڵەکان لەسەر نەخشە ↗", "kmr": "🔴 Mempoola zindî: her danûstandin li ser nexşeyê ↗", "ar": "🔴 الميمبول مباشرة: كل معاملة على الخريطة ↗", "en": "🔴 Live mempool: every transaction on a map ↗"},
    "b_refresh": {"fa": "🔄 به‌روزرسانی", "ckb": "🔄 نوێکردنەوە", "en": "🔄 Refresh"},
    "b_sub_on": {"fa": "🔔 گزارش روزانه: روشن کن", "ckb": "🔔 ڕاپۆرتی ڕۆژانە: هەڵیبکە", "en": "🔔 Daily brief: turn on"},
    "b_sub_off": {"fa": "🔕 گزارش روزانه: خاموش کن", "ckb": "🔕 ڕاپۆرتی ڕۆژانە: بیکوژێنەوە", "en": "🔕 Daily brief: turn off"},
    # lab submenu
    "b_mc": {"fa": "🎲 مونت‌کارلو ۳۰ روزه", "ckb": "🎲 مۆنتی کارلۆ ٣٠ ڕۆژ", "en": "🎲 Monte Carlo 30d"},
    "b_mem": {"fa": "🕰 حافظهٔ تاریخی", "ckb": "🕰 بیرەوەری مێژوویی", "en": "🕰 Market memory"},
    "b_vol": {"fa": "🌡 نوسان (فشردگی)", "ckb": "🌡 لەرزین (تەسکبوون)", "en": "🌡 Volatility"},
    "b_opt": {"fa": "🧾 آپشن‌ها", "ckb": "🧾 ئۆپشنەکان", "en": "🧾 Options"},
    "b_xex": {"fa": "🏦 قیمت صرافی‌ها", "ckb": "🏦 نرخی ئاڵوگۆڕەکان", "en": "🏦 Cross-exchange"},
    "b_dev": {"fa": "👨‍💻 فعالیت توسعه", "ckb": "👨‍💻 چالاکی گەشەپێدان", "en": "👨‍💻 Dev activity"},
    "b_macro": {"fa": "🌍 همبستگی کلان", "ckb": "🌍 پەیوەندی ماکرۆ", "en": "🌍 Macro correlation"},
    "b_dna": {"fa": "🧬 DNA کوین‌ها", "ckb": "🧬 DNA ی دراوەکان", "en": "🧬 Coin DNA"},
    # ---------------------------------------------------------------- prompts / misc
    "ask_coin": {
        "fa": "نماد کوین را بفرست (مثلاً <code>BTC</code> یا <code>sol</code>) یا از دکمه‌ها انتخاب کن:",
        "ckb": "هێمای دراو بنێرە (بۆ نموونە <code>BTC</code> یان <code>sol</code>) یان لە دوگمەکان هەڵبژێرە:",
        "en": "Send a coin symbol (e.g. <code>BTC</code> or <code>sol</code>) or tap one:"},
    "unknown_coin": {"fa": "این نماد پیدا نشد: ", "ckb": "ئەم هێمایە نەدۆزرایەوە: ", "en": "Symbol not found: "},
    "no_data": {"fa": "داده فعلاً در دسترس نیست؛ چند دقیقهٔ دیگر امتحان کن.",
                "ckb": "داتا ئێستا بەردەست نییە؛ چەند خولەکی تر هەوڵ بدەرەوە.",
                "en": "Data unavailable right now; try again in a few minutes."},
    "updated": {"fa": "به‌روز", "ckb": "نوێکراوە", "en": "updated"},
    "ago_min": {"fa": "دقیقه پیش", "ckb": "خولەک لەمەوبەر", "en": "min ago"},
    "nfa": {"fa": "⚠️ آموزشی است، توصیهٔ مالی نیست.", "ckb": "⚠️ فێرکارییە، ئامۆژگاری دارایی نییە.",
            "en": "⚠️ Educational, not financial advice."},
    "lang_set": {"fa": "زبان: فارسی ✅", "ckb": "زمان: کوردی سۆرانی ✅", "kmr": "Ziman: Kurmancî ✅", "en": "Language: English ✅"},
    "choose_lang": {"fa": "زبان را انتخاب کن:", "ckb": "زمان هەڵبژێرە:", "en": "Choose language:"},
    "search_hint": {
        "fa": "🔎 برای جستجو در آرشیو کانال بنویس: <code>/search هک بایننس</code>",
        "ckb": "🔎 بۆ گەڕان لە ئەرشیڤی کەناڵ بنووسە: <code>/search ETF</code>",
        "en": "🔎 Search the channel archive: <code>/search ETF</code>"},
    "search_none": {"fa": "نتیجه‌ای پیدا نشد.", "ckb": "هیچ ئەنجامێک نەدۆزرایەوە.", "en": "No results."},
    "help": {
        "fa": ("<b>راهنما</b>\n/menu منوی اصلی\n/coin BTC تحلیل کامل یک کوین (یا فقط بنویس btc)\n"
               "/market وضعیت بازار  ·  /brain مغز بازار\n/opps فرصت‌ها  ·  /news اخبار\n"
               "/search متن — جستجو در آرشیو کانال\n/alert BTC 80000 هشدار قیمت  ·  /alerts لیست هشدارها\n"
               "/brief گزارش روزانه (روشن/خاموش)\n/invite لینک دعوت و امتیاز  ·  /top برترین‌ها\n/lang زبان"),
        "ckb": ("<b>ڕێنمایی</b>\n/menu لیستی سەرەکی\n/coin BTC شیکاری تەواوی دراوێک (یان تەنها بنووسە btc)\n"
                "/market دۆخی بازاڕ  ·  /brain مێشکی بازاڕ\n/opps دەرفەتەکان  ·  /news هەواڵ\n"
                "/search دەق — گەڕان لە ئەرشیڤی کەناڵ\n/alert BTC 80000 ئاگاداری نرخ  ·  /alerts لیستی ئاگادارییەکان\n"
                "/brief ڕاپۆرتی ڕۆژانە (هەڵکردن/کوژاندنەوە)\n/invite لینکی بانگهێشت و خاڵ  ·  /top باشترینەکان\n/lang زمان"),
        "en": ("<b>Help</b>\n/menu main menu\n/coin BTC full coin card (or just type btc)\n"
               "/market market overview  ·  /brain market brain\n/opps scanner  ·  /news headlines\n"
               "/search text — search the channel archive\n/alert BTC 80000 price alert  ·  /alerts your alerts\n"
               "/brief daily brief on/off\n/invite invite link & points  ·  /top leaderboard\n/lang language")},
    # ---------------------------------------------------------------- referral
    "join_first": {
        "fa": "برای استفاده از ربات اول عضو کانال Coin_Kurd شو، بعد «عضو شدم» را بزن 👇",
        "ckb": "بۆ بەکارهێنانی ڕۆبۆت سەرەتا ببە بە ئەندامی کەناڵی Coin_Kurd، پاشان «ئەندام بووم» دابگرە 👇",
        "en": "To use the bot, join the Coin_Kurd channel first, then tap “I joined” 👇"},
    "b_join": {"fa": "📢 عضویت در کانال Coin_Kurd", "ckb": "📢 بەشداربوون لە کەناڵی Coin_Kurd", "en": "📢 Join Coin_Kurd"},
    "b_joined": {"fa": "✅ عضو شدم", "ckb": "✅ ئەندام بووم", "en": "✅ I joined"},
    "not_joined": {"fa": "هنوز عضو کانال نشدی ❌", "ckb": "هێشتا ئەندامی کەناڵ نیت ❌", "en": "You haven't joined yet ❌"},
    "verified": {"fa": "✅ تأیید شد", "ckb": "✅ پشتڕاستکرایەوە", "en": "✅ Verified"},
    "ref_text": {
        "fa": ("🎁 <b>دعوت و پاداش</b>\nهر دوستی که با لینک تو عضو کانال شود = ۱ امتیاز.\n"
               "با <b>{goal}</b> امتیاز پاداش می‌گیری.\n\n🔗 لینک دعوت تو:\n<code>{link}</code>\n\n📊 امتیاز فعلی: <b>{p}</b>"),
        "ckb": ("🎁 <b>بانگهێشت و خەڵات</b>\nهەر هاوڕێیەک بە لینکەکەی تۆ ببێتە ئەندامی کەناڵ = ١ خاڵ.\n"
                "بە <b>{goal}</b> خاڵ خەڵات وەردەگریت.\n\n🔗 لینکی بانگهێشتی تۆ:\n<code>{link}</code>\n\n📊 خاڵی ئێستا: <b>{p}</b>"),
        "en": ("🎁 <b>Invite & earn</b>\nEvery friend who joins the channel through your link = 1 point.\n"
               "Reach <b>{goal}</b> points for a reward.\n\n🔗 Your invite link:\n<code>{link}</code>\n\n📊 Points: <b>{p}</b>")},
    "b_share": {"fa": "↗️ اشتراک‌گذاری لینک", "ckb": "↗️ هاوبەشکردنی لینک", "en": "↗️ Share link"},
    "b_top": {"fa": "🏆 برترین‌ها", "ckb": "🏆 باشترینەکان", "en": "🏆 Leaderboard"},
    "share_text": {"fa": "تحلیل روزانه کریپتو به فارسی و کوردی 📊", "ckb": "شیکاری ڕۆژانەی کریپتۆ بە کوردی و فارسی 📊",
                   "en": "Daily crypto analysis in Kurdish & Persian 📊"},
    "ref_new": {"fa": "🎉 یکی از دوستانت با لینک تو عضو شد! امتیاز: <b>{p}</b>",
                "ckb": "🎉 هاوڕێیەکت بە لینکەکەت بوو بە ئەندام! خاڵ: <b>{p}</b>",
                "en": "🎉 A friend joined through your link! Points: <b>{p}</b>"},
    "top_title": {"fa": "🏆 <b>برترین دعوت‌کننده‌ها</b>", "ckb": "🏆 <b>باشترین بانگهێشتکەران</b>", "en": "🏆 <b>Top inviters</b>"},
    "top_empty": {"fa": "هنوز کسی امتیازی نگرفته. اولین نفر باش! 🚀", "ckb": "هێشتا کەس خاڵی نییە. یەکەم کەس بە! 🚀",
                  "en": "No points yet. Be the first! 🚀"},
    "gate": {"fa": "{name} برای گفتگو در گروه اول عضو کانال شو 👇", "ckb": "{name} بۆ قسەکردن لە گرووپ سەرەتا ببە بە ئەندامی کەناڵ 👇",
             "en": "{name} please join the channel to chat here 👇"},
    # ---------------------------------------------------------------- alerts / brief
    "alert_usage": {
        "fa": ("🔔 <b>هشدار قیمت</b> — هر تعداد هشدار که بخواهی، برای هر ارزی؛ وقتی قیمت به عدد تو برسد فوراً پیام می‌گیری "
               "(حتی اگر بعداً اینترنت قطع شود، پیام در تلگرامت می‌ماند).\n\n<b>مثال‌ها:</b>\n"
               "<code>/alert BTC 80000</code> بیت‌کوین ۸۰ هزار دلار\n<code>/alert ETH 2000</code> اتریوم\n"
               "<code>/alert PEPE 0.00001</code> هر ارز بایننس\n<code>/alert تتر 280000</code> تتر به تومان\n"
               "<code>/alert دلار 270000</code> دلار تهران\n<code>/alert سکه 270000000</code> سکه امامی\n"
               "<code>/alert یورو 310000</code> · <code>/alert طلا 26000000</code>\n\n"
               "حذف: <code>/alert del 2</code> یا دکمهٔ 🗑 · لیست: /alerts\n"
               "🚨 هشدار جهش/سقوط ناگهانی تتر (±۱٪ در ۱۵ دقیقه): /watch"),
        "ckb": ("🔔 <b>ئاگاداری نرخ</b> — تا ١٠ ئاگاداری بۆ هەر دراوێک؛ کاتێک نرخ گەیشتە ژمارەکەت یەکسەر پەیام وەردەگریت.\n\n<b>نموونە:</b>\n"
                "<code>/alert BTC 80000</code>\n<code>/alert ETH 2000</code>\n<code>/alert PEPE 0.00001</code>\n"
                "<code>/alert تتر 280000</code> تەتەر بە تمەن\n<code>/alert دلار 270000</code> دۆلاری تاران\n"
                "<code>/alert سکه 270000000</code>\n\nسڕینەوە: <code>/alert del 2</code> · لیست: /alerts\n"
                "🚨 ئاگاداری بازدان/کەوتنی لەناکاوی تەتەر (±١٪ لە ١٥ خولەک): /watch"),
        "en": ("🔔 <b>Price alerts</b> — up to 10 alerts on any asset; you get a message the moment price crosses your level.\n\n<b>Examples:</b>\n"
               "<code>/alert BTC 80000</code>\n<code>/alert ETH 2000</code>\n<code>/alert PEPE 0.00001</code> any Binance coin\n"
               "<code>/alert USDT 280000</code> tether in toman\n<code>/alert USD 270000</code> Tehran dollar\n"
               "<code>/alert سکه 270000000</code> Emami gold coin\n\nDelete: <code>/alert del 2</code> · list: /alerts\n"
               "🚨 Sudden tether pump/dump alert (±1% in 15 min): /watch")},
    "alert_set": {"fa": "🔔 هشدار ثبت شد: {coin} {op} {price}  (قیمت فعلی {now})",
                  "ckb": "🔔 ئاگاداری تۆمارکرا: {coin} {op} {price}  (نرخی ئێستا {now})",
                  "en": "🔔 Alert set: {coin} {op} {price}  (now {now})"},
    "alert_hit": {"fa": "🚨 <b>هشدار قیمت</b>\n{coin} به {price} رسید (اکنون {now})",
                  "ckb": "🚨 <b>ئاگاداری نرخ</b>\n{coin} گەیشتە {price} (ئێستا {now})",
                  "en": "🚨 <b>Price alert</b>\n{coin} crossed {price} (now {now})"},
    "alert_none": {"fa": "هشدار فعالی نداری.", "ckb": "هیچ ئاگادارییەکی چالاکت نییە.", "en": "No active alerts."},
    "alert_max": {"fa": "حداکثر هشدار فعال پر شده است.", "ckb": "ژمارەی ئاگادارییە چالاکەکان پڕە.", "en": "Active alert limit reached."},
    "alert_page": {"fa": "صفحهٔ {p} از {n}", "ckb": "پەڕەی {p} لە {n}", "en": "Page {p} of {n}"},
    "alert_del": {"fa": "🗑 حذف شد.", "ckb": "🗑 سڕایەوە.", "en": "🗑 Deleted."},
    "brief_on": {"fa": "🔔 گزارش روزانهٔ بازار هر صبح برایت ارسال می‌شود.", "ckb": "🔔 ڕاپۆرتی ڕۆژانەی بازاڕ هەموو بەیانییەک بۆت دەنێردرێت.",
                 "en": "🔔 You'll get the daily market brief every morning."},
    "brief_off": {"fa": "🔕 گزارش روزانه خاموش شد.", "ckb": "🔕 ڕاپۆرتی ڕۆژانە کوژایەوە.", "en": "🔕 Daily brief turned off."},
    "brief_title": {"fa": "☀️ <b>گزارش روزانهٔ انتخاب</b>", "ckb": "☀️ <b>ڕاپۆرتی ڕۆژانەی ئینتیخاب</b>", "en": "☀️ <b>Entekhab daily brief</b>"},
}

# market-data vocab
V = {
    "regime": {"bull": {"fa": "صعودی 🟢", "ckb": "سەرەوە 🟢", "en": "bull 🟢"},
               "bear": {"fa": "نزولی 🔴", "ckb": "خوارەوە 🔴", "en": "bear 🔴"},
               "sideways": {"fa": "خنثی/رنج ⚪️", "ckb": "بێلایەن ⚪️", "en": "sideways ⚪️"}},
    "trend": {"up": {"fa": "صعودی", "ckb": "سەرەوە", "en": "up"}, "down": {"fa": "نزولی", "ckb": "خوارەوە", "en": "down"},
              "range": {"fa": "رنج", "ckb": "مەودا", "en": "range"}},
    "label": {"very_strong": {"fa": "خیلی قوی", "ckb": "زۆر بەهێز", "en": "very strong"},
              "strong": {"fa": "قوی", "ckb": "بەهێز", "en": "strong"},
              "positive": {"fa": "مثبت", "ckb": "ئەرێنی", "en": "positive"},
              "neutral": {"fa": "خنثی", "ckb": "بێلایەن", "en": "neutral"},
              "weak": {"fa": "ضعیف", "ckb": "لاواز", "en": "weak"},
              "very_weak": {"fa": "خیلی ضعیف", "ckb": "زۆر لاواز", "en": "very weak"}},
    "stance": {"bullish": "🟢", "bearish": "🔴", "neutral": "⚪️"},
    "fng": {"fa": "ترس و طمع", "ckb": "ترس و تەماع", "en": "Fear & Greed"},
}

H = {  # section headers / field labels
    "price": {"fa": "قیمت", "ckb": "نرخ", "en": "Price"},
    "chg24": {"fa": "تغییر ۲۴س", "ckb": "گۆڕانی ٢٤ک", "en": "24h"},
    "trend": {"fa": "روند", "ckb": "ڕەوت", "en": "Trend"},
    "range48": {"fa": "سقف/کف ۴۸ساعت", "ckb": "بەرزترین/نزمترین ٤٨ک", "en": "48h hi/lo"},
    "score": {"fa": "امتیاز انتخاب", "ckb": "خاڵی ئینتیخاب", "en": "Entekhab score"},
    "regime": {"fa": "رژیم بازار", "ckb": "ڕژێمی بازاڕ", "en": "Regime"},
    "breadth": {"fa": "پهنای بازار", "ckb": "پانی بازاڕ", "en": "Breadth"},
    "mcap": {"fa": "ارزش کل بازار", "ckb": "کۆی سەرمایەی بازاڕ", "en": "Total mcap"},
    "dom": {"fa": "دامیننس", "ckb": "دۆمینانس", "en": "Dominance"},
    "gainers": {"fa": "بیشترین رشد", "ckb": "زۆرترین بەرزبوون", "en": "Top gainers"},
    "losers": {"fa": "بیشترین افت", "ckb": "زۆرترین دابەزین", "en": "Top losers"},
    "why": {"fa": "چرا تکان خورد؟", "ckb": "بۆچی جووڵا؟", "en": "Why it moved"},
    "funding": {"fa": "فاندینگ", "ckb": "فاندینگ", "en": "Funding"},
    "oi": {"fa": "اوپن اینترست", "ckb": "ئۆپن ئینترێست", "en": "Open interest"},
    "liq": {"fa": "لیکوئیدیشن", "ckb": "لیکویدەیشن", "en": "Liquidations"},
    "posts": {"fa": "آخرین پست‌های کانال", "ckb": "دوایین پۆستەکانی کەناڵ", "en": "Latest channel posts"},
    "news": {"fa": "اخبار", "ckb": "هەواڵ", "en": "News"},
    "opps": {"fa": "سیگنال‌های اسکنر", "ckb": "سیگناڵەکانی سکانەر", "en": "Scanner signals"},
    "dna": {"fa": "DNA", "ckb": "DNA", "en": "DNA"},
    "similar": {"fa": "مشابه", "ckb": "هاوشێوە", "en": "Similar"},
    "vol": {"fa": "نوسان", "ckb": "لەرزین", "en": "Volatility"},
    "target": {"fa": "هدف", "ckb": "ئامانج", "en": "target"},
    "inval": {"fa": "ابطال", "ckb": "هەڵوەشانەوە", "en": "invalid"},
}

WHY = {  # brain.movers[].why keys
    "idiosyncratic": {"fa": "حرکت مستقل از بازار", "ckb": "جووڵەی سەربەخۆ لە بازاڕ", "en": "idiosyncratic move"},
    "range48": {"fa": "جایگاه در دامنهٔ ۴۸س", "ckb": "شوێن لە مەودای ٤٨ک", "en": "position in 48h range"},
    "no_news": {"fa": "بدون خبر", "ckb": "بێ هەواڵ", "en": "no news"},
    "news": {"fa": "خبر", "ckb": "هەواڵ", "en": "news"},
    "volume": {"fa": "حجم غیرعادی", "ckb": "قەبارەی نائاسایی", "en": "unusual volume"},
    "btc_beta": {"fa": "همراه بیت‌کوین", "ckb": "لەگەڵ بیتکۆین", "en": "BTC beta"},
    "sector": {"fa": "حرکت بخش", "ckb": "جووڵەی کەرت", "en": "sector move"},
}

OPP = {  # scanner pattern names
    "breakout_up": {"fa": "شکست سقف", "ckb": "شکاندنی بەرزی", "en": "breakout"},
    "breakdown": {"fa": "شکست کف", "ckb": "شکاندنی نزمی", "en": "breakdown"},
    "ema_golden_cross": {"fa": "تقاطع طلایی EMA", "ckb": "خاچی زێڕینی EMA", "en": "EMA golden cross"},
    "ema_death_cross": {"fa": "تقاطع مرگ EMA", "ckb": "خاچی مەرگی EMA", "en": "EMA death cross"},
    "volume_spike": {"fa": "جهش حجم", "ckb": "بازدانی قەبارە", "en": "volume spike"},
    "rsi_oversold": {"fa": "RSI اشباع فروش", "ckb": "RSI زۆر فرۆشراو", "en": "RSI oversold"},
    "rsi_overbought": {"fa": "RSI اشباع خرید", "ckb": "RSI زۆر کڕدراو", "en": "RSI overbought"},
    "bull_divergence": {"fa": "واگرایی مثبت", "ckb": "جیاوازی ئەرێنی", "en": "bullish divergence"},
    "bear_divergence": {"fa": "واگرایی منفی", "ckb": "جیاوازی نەرێنی", "en": "bearish divergence"},
    "squeeze": {"fa": "فشردگی", "ckb": "تەسکبوون", "en": "squeeze"},
}


def t(key, lang, **kw):
    s = pick(T.get(key, {}), lang) or key
    return s.format(**kw) if kw else s


def v(group, key, lang):
    d = V.get(group, {}).get(key)
    if isinstance(d, dict):
        return pick(d, lang) or key
    return d or key


def h(key, lang):
    return pick(H.get(key, {}), lang) or key
