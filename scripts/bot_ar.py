"""
Arabic UI strings, keyed by the English string (same idea as bot_kmr.KMR).
bot_i18n.pick() uses this table whenever a {fa, ckb, en} dict has no explicit "ar".
Strings that are missing here fall back to English (better than Persian for most Arabic readers).
AI-written market reports exist only in fa/ckb/en and therefore show in English.
"""

AR = {
    # ------------------------------------------------------------ menu & buttons
    "📡 <b>Entekhab · Coin_Kurd</b>\nEvery tool from entekhab.net, inside Telegram. Pick a section 👇":
        "📡 <b>انتخاب · Coin_Kurd</b>\nكل أدوات موقع entekhab.net داخل تيليغرام. اختر قسماً 👇",
    "💵 Dollar & tether (IRR)": "💵 الدولار والتيثر (بالتومان)",
    "📡 Live (15 min)": "📡 مباشر (15 دقيقة)",
    "🧮 Calculator": "🧮 الحاسبة",
    "🚨 Tether spike alert: on": "🚨 تنبيه قفزة التيثر: تشغيل",
    "🚨 Tether spike alert: off": "🚨 تنبيه قفزة التيثر: إيقاف",
    "🎯 Prediction game": "🎯 لعبة التوقع",
    "🛡 Emergency proxy": "🛡 بروكسي الطوارئ",
    "🚨 On: I'll ping you if tether moves ±1% or more within 15 minutes.":
        "🚨 تم التشغيل: سأنبهك إذا تحرك التيثر ±1٪ أو أكثر خلال 15 دقيقة.",
    "🔕 Tether spike alert off.": "🔕 تم إيقاف تنبيه قفزة التيثر.",
    "🚨 <b>Tether {dir} {pct}% in {mins} min</b>\n{p0} → {p1} toman":
        "🚨 <b>التيثر {dir} {pct}٪ خلال {mins} دقيقة</b>\n{p0} ← {p1} تومان",
    "🧮 Example: <code>/calc 10000000</code> (toman → USDT) or <code>/calc 500 usdt</code>":
        "🧮 مثال: <code>/calc 10000000</code> (تومان ← تيثر) أو <code>/calc 500 usdt</code>",
    "No emergency proxy posted yet.": "لم يُنشر بروكسي طوارئ بعد.",
    "📡 This message refreshes every minute for 15 minutes.": "📡 تتحدث هذه الرسالة كل دقيقة لمدة 15 دقيقة.",
    "📊 Market": "📊 السوق",
    "🧠 Market Brain": "🧠 عقل السوق",
    "🪙 Coin lookup": "🪙 تحليل عملة",
    "🎯 Opportunities": "🎯 الفرص (الماسح)",
    "🚀 Gainers/Losers": "🚀 الأكثر ارتفاعاً/انخفاضاً",
    "🏅 Entekhab Score": "🏅 تقييم انتخاب",
    "📰 News": "📰 الأخبار",
    "🔥 Narratives": "🔥 الروايات الساخنة",
    "📅 Econ calendar": "📅 التقويم الاقتصادي",
    "🏛 AI Council": "🏛 مجلس الذكاء الاصطناعي",
    "⚖️ Derivatives": "⚖️ المشتقات والتمويل",
    "🧪 Lab": "🧪 المختبر",
    "🌀 Cycle & value": "🌀 الدورة والقيمة",
    "⛓ BTC on-chain": "⛓ بيانات البيتكوين على السلسلة",
    "💧 Sector flows": "💧 تدفقات القطاعات",
    "🗓 Week wrapped": "🗓 ملخص الأسبوع",
    "📢 Channel posts": "📢 منشورات القناة",
    "📈 Track record": "📈 سجل الأداء",
    "📡 Indicators": "📡 المؤشرات",
    "🔔 Price alerts": "🔔 تنبيهات السعر",
    "🎁 Invite & earn": "🎁 ادعُ واربح",
    "🌐 Language": "🌐 اللغة",
    "🌍 entekhab.net": "🌍 entekhab.net",
    "⬅️ Menu": "⬅️ القائمة",
    "More on site ↗": "المزيد في الموقع ↗",
    "🔄 Refresh": "🔄 تحديث",
    "🔔 Daily brief: turn on": "🔔 الملخص اليومي: تشغيل",
    "🔕 Daily brief: turn off": "🔕 الملخص اليومي: إيقاف",
    "🎲 Monte Carlo 30d": "🎲 مونت كارلو 30 يوماً",
    "🕰 Market memory": "🕰 ذاكرة السوق",
    "🌡 Volatility": "🌡 التقلب",
    "🧾 Options": "🧾 الخيارات",
    "🏦 Cross-exchange": "🏦 مقارنة المنصات",
    "👨‍💻 Dev activity": "👨‍💻 نشاط المطورين",
    "🌍 Macro correlation": "🌍 الارتباط الكلي",
    "🧬 Coin DNA": "🧬 الحمض النووي للعملة",
    "Send a coin symbol (e.g. <code>BTC</code> or <code>sol</code>) or tap one:":
        "أرسل رمز عملة (مثل <code>BTC</code> أو <code>sol</code>) أو اختر واحدة:",
    "Symbol not found: ": "لم يُعثر على الرمز: ",
    "Data unavailable right now; try again in a few minutes.": "البيانات غير متاحة الآن؛ حاول بعد دقائق.",
    "updated": "تحديث",
    "min ago": "دقيقة مضت",
    "⚠️ Educational, not financial advice.": "⚠️ محتوى تعليمي وليس نصيحة مالية.",
    "Language: English ✅": "اللغة: العربية ✅",
    "Choose language:": "اختر اللغة:",
    "🔎 Search the channel archive: <code>/search ETF</code>": "🔎 البحث في أرشيف القناة: <code>/search ETF</code>",
    "No results.": "لا توجد نتائج.",
    "<b>Help</b>\n/menu main menu\n/coin BTC full coin card (or just type btc)\n/market market overview  ·  /brain market brain\n/opps scanner  ·  /news headlines\n/search text — search the channel archive\n/alert BTC 80000 price alert  ·  /alerts your alerts\n/brief daily brief on/off\n/invite invite link & points  ·  /top leaderboard\n/lang language":
        ("<b>المساعدة</b>\n/menu القائمة الرئيسية\n/coin BTC بطاقة العملة (أو اكتب btc فقط)\n"
         "/market السوق  ·  /brain عقل السوق\n/opps الفرص  ·  /news الأخبار\n"
         "/search نص — البحث في أرشيف القناة\n/alert BTC 80000 تنبيه سعر  ·  /alerts تنبيهاتك\n"
         "/brief الملخص اليومي\n/invite رابط الدعوة والنقاط  ·  /top المتصدرون\n/lang اللغة"),
    "To use the bot, join the Coin_Kurd channel first, then tap “I joined” 👇":
        "لاستخدام البوت، انضم أولاً إلى قناة Coin_Kurd ثم اضغط «انضممت» 👇",
    "📢 Join Coin_Kurd": "📢 الانضمام إلى Coin_Kurd",
    "✅ I joined": "✅ انضممت",
    "You haven't joined yet ❌": "لم تنضم بعد ❌",
    "✅ Verified": "✅ تم التحقق",
    "🎁 <b>Invite & earn</b>\nEvery friend who joins the channel through your link = 1 point.\nReach <b>{goal}</b> points for a reward.\n\n🔗 Your invite link:\n<code>{link}</code>\n\n📊 Points: <b>{p}</b>":
        ("🎁 <b>ادعُ واربح</b>\nكل صديق ينضم إلى القناة عبر رابطك = نقطة واحدة.\n"
         "اجمع <b>{goal}</b> نقاط لتحصل على مكافأة.\n\n🔗 رابط دعوتك:\n<code>{link}</code>\n\n📊 النقاط: <b>{p}</b>"),
    "↗️ Share link": "↗️ مشاركة الرابط",
    "🏆 Leaderboard": "🏆 المتصدرون",
    "Daily crypto analysis in Kurdish & Persian 📊": "تحليل يومي للعملات الرقمية بالكردية والفارسية 📊",
    "🎉 A friend joined through your link! Points: <b>{p}</b>": "🎉 انضم صديق عبر رابطك! النقاط: <b>{p}</b>",
    "🏆 <b>Top inviters</b>": "🏆 <b>أفضل الداعين</b>",
    "No points yet. Be the first! 🚀": "لا توجد نقاط بعد. كن الأول! 🚀",
    "{name} please join the channel to chat here 👇": "{name} يرجى الانضمام إلى القناة للدردشة هنا 👇",
    "🔔 <b>Price alerts</b> — up to 10 alerts on any asset; you get a message the moment price crosses your level.\n\n<b>Examples:</b>\n<code>/alert BTC 80000</code>\n<code>/alert ETH 2000</code>\n<code>/alert PEPE 0.00001</code> any Binance coin\n<code>/alert USDT 280000</code> tether in toman\n<code>/alert USD 270000</code> Tehran dollar\n<code>/alert سکه 270000000</code> Emami gold coin\n\nDelete: <code>/alert del 2</code> · list: /alerts\n🚨 Sudden tether pump/dump alert (±1% in 15 min): /watch":
        ("🔔 <b>تنبيهات السعر</b> — حتى 10 تنبيهات لأي أصل؛ تصلك رسالة فور وصول السعر إلى مستواك.\n\n"
         "<b>أمثلة:</b>\n<code>/alert BTC 80000</code>\n<code>/alert ETH 2000</code>\n"
         "<code>/alert PEPE 0.00001</code> أي عملة في بينانس\n<code>/alert BTC +5%</code> تنبيه بالنسبة المئوية\n"
         "<code>/alert USDT 280000</code> التيثر بالتومان\n\nحذف: <code>/alert del 2</code> · القائمة: /alerts\n"
         "🚨 تنبيه القفزة المفاجئة للتيثر (±1٪ خلال 15 دقيقة): /watch"),
    "🔔 Alert set: {coin} {op} {price}  (now {now})": "🔔 تم ضبط التنبيه: {coin} {op} {price}  (الآن {now})",
    "🚨 <b>Price alert</b>\n{coin} crossed {price} (now {now})": "🚨 <b>تنبيه سعر</b>\n{coin} وصل إلى {price} (الآن {now})",
    "No active alerts.": "لا توجد تنبيهات نشطة.",
    "Max 10 active alerts.": "الحد الأقصى 10 تنبيهات نشطة.",
    "🗑 Deleted.": "🗑 تم الحذف.",
    "🔔 You'll get the daily market brief every morning.": "🔔 سيصلك ملخص السوق اليومي كل صباح.",
    "🔕 Daily brief turned off.": "🔕 تم إيقاف الملخص اليومي.",
    "☀️ <b>Entekhab daily brief</b>": "☀️ <b>ملخص انتخاب اليومي</b>",
    # ------------------------------------------------------------ values & labels
    "bull 🟢": "صاعد 🟢", "bear 🔴": "هابط 🔴", "sideways ⚪️": "عرضي ⚪️",
    "up": "صاعد", "down": "هابط", "range": "عرضي",
    "very strong": "قوي جداً", "strong": "قوي", "positive": "إيجابي", "neutral": "محايد",
    "weak": "ضعيف", "very weak": "ضعيف جداً",
    "Fear & Greed": "الخوف والطمع", "Fear &amp; Greed": "الخوف والطمع",
    "Price": "السعر", "24h": "24 ساعة", "Trend": "الاتجاه", "48h hi/lo": "أعلى/أدنى 48 ساعة",
    "Entekhab score": "تقييم انتخاب", "Regime": "حالة السوق", "Breadth": "اتساع السوق",
    "Total mcap": "القيمة السوقية الكلية", "Dominance": "الهيمنة", "Top gainers": "الأكثر ارتفاعاً",
    "Top losers": "الأكثر انخفاضاً", "Why it moved": "سبب الحركة", "Funding": "التمويل",
    "Open interest": "العقود المفتوحة", "Liquidations": "التصفيات", "Latest channel posts": "آخر منشورات القناة",
    "News": "الأخبار", "Scanner signals": "إشارات الماسح", "DNA": "الحمض النووي", "Similar": "مشابه",
    "Volatility": "التقلب", "target": "الهدف", "invalid": "الإبطال",
    "idiosyncratic move": "حركة خاصة بالعملة", "position in 48h range": "الموقع ضمن نطاق 48 ساعة",
    "no news": "لا أخبار", "news": "أخبار", "unusual volume": "حجم غير عادي", "BTC beta": "بيتا البيتكوين",
    "sector move": "حركة القطاع", "breakout": "اختراق", "breakdown": "كسر للأسفل",
    "EMA golden cross": "التقاطع الذهبي EMA", "EMA death cross": "تقاطع الموت EMA", "volume spike": "قفزة الحجم",
    "RSI oversold": "RSI تشبع بيعي", "RSI overbought": "RSI تشبع شرائي", "bullish divergence": "تباعد إيجابي",
    "bearish divergence": "تباعد سلبي", "squeeze": "انضغاط",
    "technical 40% · sentiment 25% · news 20% · channel 15%": "فني 40٪ · المزاج 25٪ · الأخبار 20٪ · القناة 15٪",
    "Technical": "فني", "Derivatives": "المشتقات", "Sentiment": "المزاج", "Macro": "الاقتصاد الكلي",
    "History": "التاريخ", "Hot funding": "تمويل مرتفع", "Negative funding": "تمويل سلبي",
    "BTC Monte Carlo (30 days, {n} paths)": "مونت كارلو للبيتكوين (30 يوماً، {n} مسار)",
    "Day-30 price cone:": "مخروط السعر لليوم 30:",
    "Market memory: {n} days most like today since {s}": "ذاكرة السوق: {n} أيام تشبه اليوم منذ {s}",
    "What happened next:": "ماذا حدث بعدها:",
    "tight 🔒": "ضيق 🔒", "normal": "طبيعي", "wide 💥": "واسع 💥",
    "Tight Bollinger bands often precede big moves.": "نطاقات بولينجر الضيقة تسبق غالباً حركات كبيرة.",
    "3-month correlation with BTC:": "الارتباط مع البيتكوين لثلاثة أشهر:",
    "Historical twins": "التوائم التاريخية",
    "above upper band (rich)": "فوق النطاق العلوي (مرتفع)", "below lower band (cheap)": "تحت النطاق السفلي (رخيص)",
    "near fair value": "قرب القيمة العادلة", "above fair": "فوق العادلة", "below fair": "تحت العادلة",
    "Real outcome of scanner signals (24h / 72h later):": "النتيجة الفعلية لإشارات الماسح (بعد 24/72 ساعة):",
    "Kurdistani indicators:": "مؤشرات كردستانية:",
    "Market 24h after channel posts": "السوق بعد 24 ساعة من منشورات القناة",
    "🔒 = invite-only; earn one through “Invite & earn”.": "🔒 = بالدعوة فقط؛ احصل عليها عبر «ادعُ واربح».",
    # ------------------------------------------------------------ Iran board
    "USDT": "تيثر", "USD (Tehran)": "دولار طهران", "USD (Herat)": "دولار هرات", "USD (remittance)": "دولار الحوالة",
    "EUR": "يورو", "GBP": "جنيه إسترليني", "AED": "درهم", "OMR": "ريال عماني", "TRY": "ليرة تركية",
    "TRY remit": "حوالة ليرة", "CAD": "دولار كندي", "CNY": "يوان", "RUB": "روبل", "AUD": "دولار أسترالي",
    "Emami coin": "سكة إمامي", "Bahar coin": "سكة بهار", "Half coin": "نصف سكة", "Quarter coin": "ربع سكة",
    "Gram coin": "سكة غرامية", "Gold mesghal": "مثقال ذهب", "18k gold /g": "ذهب عيار 18 /غرام",
    "Gold oz ($)": "أونصة الذهب ($)", "Silver oz ($)": "أونصة الفضة ($)",
    "Bitcoin": "بيتكوين", "Ethereum": "إيثريوم", "Solana": "سولانا", "Tron": "ترون",
    "Dollar/tether sources are unavailable right now; try again shortly.":
        "مصادر سعر الدولار والتيثر غير متاحة الآن؛ حاول بعد قليل.",
    # ------------------------------------------------------------ proxy (old module)
    "🛡 <b>Emergency Telegram proxies</b>": "🛡 <b>بروكسيات تيليغرام للطوارئ</b>",
    "⭐️ <b>Coin_Kurd's own proxy</b>": "⭐️ <b>البروكسي الخاص بـ Coin_Kurd</b>",
    "🌐 <b>Public proxies</b> — tap a button to connect Telegram:": "🌐 <b>بروكسيات عامة</b> — اضغط زراً لاتصال تيليغرام:",
    "✅ = online a few minutes ago (checked from outside Iran; it may still be filtered inside Iran)":
        "✅ = كان يعمل قبل دقائق (فُحص من خارج إيران؛ قد يكون محجوباً داخلها)",
    "⚠️ Public proxies are run by strangers: they see your IP, though Telegram messages stay encrypted. Prefer the dedicated proxy for important accounts.":
        "⚠️ البروكسيات العامة يديرها غرباء: يرون عنوان IP الخاص بك، لكن رسائل تيليغرام تبقى مشفرة. للحسابات المهمة استخدم البروكسي الخاص.",
    "No working proxy found right now; try again in a few minutes.": "لا يوجد بروكسي يعمل الآن؛ حاول بعد دقائق.",
}
