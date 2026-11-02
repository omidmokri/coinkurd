"""UI strings for the Coin_Kurd / Entekhab Telegram bot (fa · ckb · en)."""

LANGS = ("fa", "ckb", "en")
RTL = {"fa": True, "ckb": True, "en": False}

T = {
    # ---------------------------------------------------------------- menu
    "menu_title": {
        "fa": "📡 <b>انتخاب · Coin_Kurd</b>\nهمهٔ ابزارهای سایت entekhab.net داخل تلگرام. یک بخش را انتخاب کن 👇",
        "ckb": "📡 <b>ئینتیخاب · Coin_Kurd</b>\nهەموو ئامرازەکانی ماڵپەڕی entekhab.net لەناو تێلێگرام. بەشێک هەڵبژێرە 👇",
        "en": "📡 <b>Entekhab · Coin_Kurd</b>\nEvery tool from entekhab.net, inside Telegram. Pick a section 👇"},
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
    "b_back": {"fa": "⬅️ منو", "ckb": "⬅️ لیست", "en": "⬅️ Menu"},
    "b_more": {"fa": "بیشتر در سایت ↗", "ckb": "زیاتر لە ماڵپەڕ ↗", "en": "More on site ↗"},
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
    "lang_set": {"fa": "زبان: فارسی ✅", "ckb": "زمان: کوردی ✅", "en": "Language: English ✅"},
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
        "fa": "مثال: <code>/alert BTC 80000</code> — وقتی قیمت به این عدد برسد خبرت می‌کنم.\nحذف: <code>/alert del 1</code>",
        "ckb": "نموونە: <code>/alert BTC 80000</code> — کاتێک نرخ گەیشتە ئەم ژمارەیە ئاگادارت دەکەم.\nسڕینەوە: <code>/alert del 1</code>",
        "en": "Example: <code>/alert BTC 80000</code> — I'll ping you when price crosses it.\nDelete: <code>/alert del 1</code>"},
    "alert_set": {"fa": "🔔 هشدار ثبت شد: {coin} {op} {price}  (قیمت فعلی {now})",
                  "ckb": "🔔 ئاگاداری تۆمارکرا: {coin} {op} {price}  (نرخی ئێستا {now})",
                  "en": "🔔 Alert set: {coin} {op} {price}  (now {now})"},
    "alert_hit": {"fa": "🚨 <b>هشدار قیمت</b>\n{coin} به {price} رسید (اکنون {now})",
                  "ckb": "🚨 <b>ئاگاداری نرخ</b>\n{coin} گەیشتە {price} (ئێستا {now})",
                  "en": "🚨 <b>Price alert</b>\n{coin} crossed {price} (now {now})"},
    "alert_none": {"fa": "هشدار فعالی نداری.", "ckb": "هیچ ئاگادارییەکی چالاکت نییە.", "en": "No active alerts."},
    "alert_max": {"fa": "حداکثر ۱۰ هشدار فعال مجاز است.", "ckb": "زۆرترین ١٠ ئاگاداری ڕێگەپێدراوە.", "en": "Max 10 active alerts."},
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
    s = T.get(key, {}).get(lang) or T.get(key, {}).get("fa") or key
    return s.format(**kw) if kw else s


def v(group, key, lang):
    d = V.get(group, {}).get(key)
    if isinstance(d, dict):
        return d.get(lang) or d.get("en") or key
    return d or key


def h(key, lang):
    return H.get(key, {}).get(lang, key)
