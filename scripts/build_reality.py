#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
صفحات لایهٔ «واقعیت‌سنج» entekhab.net (سه‌زبانه: فارسی / کوردی سورانی / English)

  /reality/           هاب واقعیت‌سنج
  /ledger/            دفتر عملکرد سیگنال‌ها با قفل زمانی (+ بررسی زنجیرهٔ هش در مرورگر)
  /iran-friction/     شاخص اصطکاک محلی ایران
  /hype/              نیمه‌عمر هیاهوی روایت‌ها
  /silent-exit/       آشکارساز خروج خاموش
  /iran-correlation/  ماتریس همبستگی کریپتو با دارایی‌های ایران
  + بخش «سیگنال‌های قفل‌شدهٔ اخیر» در صفحهٔ هر کوین (/coins/<c>/)

بعد از build_pages.py اجرا می‌شود؛ خطای یک صفحه مانع بقیه نمی‌شود؛ آدرس‌ها به sitemap.xml اضافه می‌شوند.
همهٔ متن‌ها در جدول S (سه زبان) هستند. نمودارها با lightweight-charts خودِ سایت کشیده می‌شوند.
"""
import os
import re
import sys
import traceback
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402  (page(), CSS, chrome, helpers)
import reality_common as R  # noqa: E402

e = BP.e
L = R.L
LANGS = ("fa", "ckb", "en")
DIG = {"fa": str.maketrans("0123456789.,-", "۰۱۲۳۴۵۶۷۸۹٫٬−"), "ckb": str.maketrans("0123456789.,-", "٠١٢٣٤٥٦٧٨٩٫٬−"), "en": None}
PCT = {"fa": "٪", "ckb": "٪", "en": "%"}
JM = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"]
CKB_M = ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەممووز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"]
EN_M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
TEHRAN = timedelta(hours=3, minutes=30)
COLORS = {"green": "#22c55e", "yellow": "#eab308", "orange": "#f97316", "red": "#ef4444", "none": "#94a3b8"}

# ------------------------------------------------------------------ strings (fa / ckb / en)
S = {
    "home": L("خانه", "ماڵەوە", "Home"),
    "hub": L("واقعیت‌سنج", "ڕاستی‌پێو", "Reality Check"),
    "upd": L("به‌روزرسانی", "نوێکردنەوە", "Updated"),
    "nfa": L("آموزشی است، توصیهٔ مالی نیست.", "فێرکارییە، ئامۆژگاریی دارایی نییە.", "Educational, not financial advice."),
    "nodata": L("هنوز داده‌ای جمع نشده؛ اولین اجرای خودکار به‌زودی انجام می‌شود.", "هێشتا داتا کۆ نەکراوەتەوە؛ یەکەم جێبەجێکردنی ئۆتۆماتیکی بەم زووانە دەبێت.",
                "No data yet — the first automatic run is coming up."),
    "method": L("روش محاسبه (شفاف و قابل‌بازتولید)", "شێوازی ژماردن (ڕوون و دووبارەکراوە)", "Method (transparent and reproducible)"),
    "all": L("همه", "هەموو", "All"), "source": L("منبع", "سەرچاوە", "source"), "coin": L("کوین", "دراو", "coin"),
    "days": L("روز", "ڕۆژ", "days"), "toman": L("تومان", "تمەن", "toman"), "price": L("قیمت", "نرخ", "price"),
    "min_ago": L("{n} دقیقه پیش", "{n} خولەک لەمەوبەر", "{n} min ago"), "h_ago": L("{n} ساعت پیش", "{n} کاتژمێر لەمەوبەر", "{n} h ago"),
    "d_ago": L("{n} روز پیش", "{n} ڕۆژ لەمەوبەر", "{n} days ago"),
    "hours": L("{n} ساعت", "{n} کاتژمێر", "{n}h"), "ndays": L("{n} روز", "{n} ڕۆژ", "{n}d"),
    # ---- ledger
    "lg.title": L("دفتر عملکرد سیگنال‌ها با قفل زمانی", "تۆماری ئەنجامی سیگناڵەکان بە قوفڵی کات", "Time-locked Signal Performance Ledger"),
    "lg.desc": L("هر پیش‌بینی در لحظهٔ انتشار با قیمت مبنا، جهت و بازه قفل می‌شود و نتیجه‌اش خودکار و غیرقابل‌تغییر ثبت می‌شود؛ دقت واقعی تحلیل‌گران هوش مصنوعی، اسکنر، اندیکاتورها، خرد جمعی و کانال.",
                 "هەر پێشبینییەک لە ساتی بڵاوبوونەوەدا بە نرخی بنەڕەت، ئاراستە و ماوە قوفڵ دەکرێت و ئەنجامەکەی بە شێوەی ئۆتۆماتیکی و نەگۆڕ تۆمار دەکرێت.",
                 "Every call is locked at publication with its reference price, direction and horizon, and its result is recorded automatically and immutably: the real accuracy of AI analysts, the scanner, indicators, the crowd and the channel."),
    "lg.ok": L("زنجیرهٔ هش سالم است ✓ — {n} ردیف بررسی شد", "زنجیرەی هاش ساغە ✓ — {n} ڕیز پشکنرا", "Hash chain intact ✓ — {n} rows checked"),
    "lg.bad": L("هشدار: زنجیره در ردیف {n} شکسته است ✗", "ئاگاداری: زنجیرەکە لە ڕیزی {n} شکاوە ✗", "Warning: the chain is broken at row {n} ✗"),
    "lg.head": L("سرِ زنجیره", "سەری زنجیرە", "Chain head"),
    "lg.ots": L("مهر زمانی بیت‌کوین (OpenTimestamps)", "مۆری کاتی بیتکۆین (OpenTimestamps)", "Bitcoin timestamp (OpenTimestamps)"),
    "lg.ots_btc": L("ثبت در بلاک بیت‌کوین {n}", "تۆمار لە بلۆکی بیتکۆین {n}", "anchored in Bitcoin block {n}"),
    "lg.ots_wait": L("در صف تأیید بلاک (چند ساعت)", "لە چاوەڕوانی بلۆکدایە (چەند کاتژمێرێک)", "awaiting a Bitcoin block (a few hours)"),
    "lg.ots_fail": L("ارسال به سرور مهر زمانی ناموفق بود؛ فردا دوباره", "ناردن سەرنەکەوت؛ سبەی دووبارە", "submission failed; retried tomorrow"),
    "lg.verify": L("بررسی زنجیره در مرورگر خودت", "زنجیرەکە لە وێبگەڕەکەی خۆتدا بپشکنە", "Verify the chain in your browser"),
    "lg.board": L("جدول دقت منابع", "خشتەی وردیی سەرچاوەکان", "Accuracy leaderboard"),
    "lg.board_lead": L("رتبه با حد پایین بازهٔ اطمینان ۹۵٪ ویلسون — منبعی که با نمونهٔ کم «۱۰۰٪» دارد بالاتر از منبعِ پرنمونه و دقیق نمی‌نشیند.",
                       "پلە بەپێی سنووری خوارەوەی ویلسنی ٩٥٪ — سەرچاوەیەک بە نموونەی کەم و «١٠٠٪» لە سەرچاوەیەکی پڕنموونە و ورد بەرزتر دانانرێت.",
                       "Ranked by the Wilson 95% lower bound — a source with a tiny sample and “100%” can't outrank a large, accurate one."),
    "lg.th": L("#|منبع|تعیین‌تکلیف‌شده|دقت|حد پایین ویلسون|دقت ۲۰ اخیر|میانگین حرکت در جهت پیش‌بینی|باز",
               "#|سەرچاوە|یەکلابووەوە|وردی|سنووری خوارەوەی ویلسن|وردیی ٢٠ی دوایی|ناوەندی جووڵە لە ئاراستەی پێشبینی|کراوە",
               "#|Source|Decided|Accuracy|Wilson low|Last 20|Avg move in called direction|Open"),
    "lg.collecting": L("در حال جمع‌آوری (کمتر از ۵ پیش‌بینی تعیین‌تکلیف‌شده)", "لە کۆکردنەوەدایە (کەمتر لە ٥ پێشبینیی یەکلابووەوە)", "Collecting (fewer than 5 decided calls)"),
    "lg.profiles": L("پروفایل منابع و دقت در طول زمان", "پرۆفایلی سەرچاوەکان و وردی بە درێژایی کات", "Source profiles and accuracy over time"),
    "lg.rwn": L("درست / نادرست / بی‌نتیجه", "ڕاست / هەڵە / بێ ئەنجام", "Right / wrong / none"),
    "lg.recent": L("آخرین سیگنال‌های قفل‌شده", "دوایین سیگناڵە قوفڵکراوەکان", "Latest locked calls"),
    "lg.th2": L("ردیف|منبع|کوین|پیش‌بینی|قیمت مبنا|زمان انتشار|نتیجه|مرجع / هش", "ڕیز|سەرچاوە|دراو|پێشبینی|نرخی بنەڕەت|کاتی بڵاوبوونەوە|ئەنجام|سەرچاوە / هاش",
                "#|Source|Coin|Call|Reference price|Published|Result|Ref / hash"),
    "lg.open": L("باز · {n} مانده", "کراوە · {n} ماوە", "open · {n} left"),
    "lg.target": L("هدف", "ئامانج", "target"), "lg.stop": L("حد ضرر", "سنووری زیان", "stop"),
    "lg.json": L("همهٔ ردیف‌ها با هش", "هەموو ڕیزەکان بە هاشەوە", "every row with its hash"),
    "lg.how": L("پیش‌بینی خودتان را حساب‌پذیر کنید", "پێشبینییەکانت لێپرسراو بکە", "Make your own calls accountable"),
    "lg.how1": L("مدیر کانال کوین کورد کافی است هر جای پست این خط را بنویسد؛ ربات حداکثر ظرف ۱۵ دقیقه آن را با قیمت لحظهٔ انتشار قفل می‌کند (ویرایش بعدی پست، ردیف قفل‌شده را تغییر نمی‌دهد):",
                 "بەڕێوەبەری کەناڵی کۆین کورد تەنها پێویستە ئەم دێڕە لە پۆستەکەدا بنووسێت؛ لە ماوەی ١٥ خولەکدا بە نرخی ساتی بڵاوبوونەوە قوفڵ دەکرێت:",
                 "The Coin_Kurd admin only needs to put this line anywhere in a post; within 15 minutes it is locked at the publication price (editing the post later never changes the locked row):"),
    "lg.how2": L("جهت: صعودی/لانگ/خرید — نزولی/شورت/فروش — خنثی/رنج · بازه: ساعت/روز/هفته (پیش‌فرض ۷ روز) · هدف و حد ضرر اختیاری‌اند · نماد کوین با حروف بزرگ لاتین.",
                 "ئاراستە: صعودی/لانگ — نزولی/شورت — خنثی/رنج · ماوە: ساعت/روز/هفته (بنەڕەت ٧ ڕۆژ) · ئامانج و سنووری زیان ئارەزوومەندانەن.",
                 "Direction: صعودی/long · نزولی/short · خنثی/range — horizon: ساعت (hours) / روز (days) / هفته (weeks), default 7 days — target and stop are optional; tickers in capital Latin letters."),
    "lg.recent_coin": L("🔒 سیگنال‌های قفل‌شدهٔ اخیر {c}", "🔒 دوایین سیگناڵە قوفڵکراوەکانی {c}", "🔒 Latest locked calls for {c}"),
    "lg.all_coin": L("همهٔ پیش‌بینی‌های {c} در دفتر عملکرد سیگنال‌ها ←", "هەموو پێشبینییەکانی {c} لە تۆمارەکەدا ←", "All {c} calls in the signal ledger →"),
    "call.up": L("صعودی ▲", "بەرزبوونەوە ▲", "Up ▲"), "call.down": L("نزولی ▼", "دابەزین ▼", "Down ▼"), "call.flat": L("خنثی ◆", "بێلایەن ◆", "Flat ◆"),
    "out.win": L("درست ✓", "ڕاست ✓", "Right ✓"), "out.loss": L("نادرست ✗", "هەڵە ✗", "Wrong ✗"),
    "out.flat": L("بی‌نتیجه (درون باند خنثی)", "بێ ئەنجام (لە ناو باندی بێلایەن)", "No decision (inside the neutral band)"),
    "exit.target": L("هدف لمس شد", "ئامانج گەیشت", "target hit"), "exit.stop": L("حد ضرر لمس شد", "سنووری زیان گەیشت", "stop hit"),
    "exit.horizon": L("پایان بازه", "کۆتایی ماوە", "end of horizon"),
    # ---- friction
    "fr.title": L("شاخص اصطکاک محلی ایران", "پێوەری لێکخشانی ناوخۆیی ئێران", "Iran Local Friction Score"),
    "fr.desc": L("قیمت روی کاغذ چقدر با واقعیت کاربر ایرانی فاصله دارد؟ ترکیب شفاف اختلاف نرخ تتر، اسپرد بین صرافی‌ها، دسترسی اینترنت و اخبار منفی محلی، هر ۱۵ دقیقه.",
                 "نرخی سەر کاغەز چەندە لە ڕاستیی بەکارهێنەری ئێرانی دوورە؟ تێکەڵەیەکی ڕوونی جیاوازیی تەتەر، سپرێدی ئاڵوگۆڕەکان، ئینتەرنێت و هەواڵی نەرێنی، هەر ١٥ خولەک.",
                 "How far is the “paper price” from what an Iranian user really faces? A transparent blend of the tether gap, cross-exchange spread, internet access and local negative news, every 15 minutes."),
    "lvl.green": L("سبز — اصطکاک کم", "سەوز — لێکخشانی کەم", "Green — low friction"),
    "lvl.yellow": L("زرد — اصطکاک متوسط", "زەرد — لێکخشانی مامناوەند", "Yellow — moderate friction"),
    "lvl.red": L("قرمز — اصطکاک بالا", "سوور — لێکخشانی زۆر", "Red — high friction"),
    "fr.scale": L("هرچه بالاتر، فاصلهٔ قیمت جهانی با واقعیت کاربر ایرانی بیشتر · سبز زیر ۳۳ · زرد تا ۶۰ · قرمز از ۶۰",
                  "هەرچەند بەرزتر، مەودای نرخی جیهانی لە ڕاستیی بەکارهێنەری ئێرانی زیاتر · سەوز ژێر ٣٣ · زەرد تا ٦٠ · سوور لە ٦٠",
                  "Higher = wider gap between the global price and the Iranian user's reality · green < 33 · yellow < 60 · red ≥ 60"),
    "fr.comps": L("چهار مؤلفهٔ شاخص", "چوار پێکهاتەی پێوەر", "The four components"),
    "fr.missing": L("مؤلفه‌های بدون داده در این لحظه کنار گذاشته شدند و وزن بقیه بازتوزیع شد.", "پێکهاتە بێداتاکان لابران و کێشی ئەوانی تر دابەشکرایەوە.",
                    "Components without data right now were left out and the other weights re-normalised."),
    "fr.headlines": L("{n} تیتر", "{n} سەردێڕ", "{n} headlines"),
    "c1.t": L("اختلاف نرخ تتر با دلار آزاد", "جیاوازیی نرخی تەتەر لەگەڵ دۆلاری ئازاد", "Tether vs free-market dollar gap"),
    "c1.d": L("تتر بازار ایران ÷ دلار تهران − ۱ (۰٪ ← ۰ امتیاز، ۵٪ و بیشتر ← ۱۰۰)", "تەتەری بازاڕی ئێران ÷ دۆلاری تاران − ١ (٥٪ و زیاتر ← ١٠٠)",
              "Iranian USDT ÷ Tehran USD − 1 (0% → 0, ≥5% → 100)"),
    "c2.t": L("اصطکاک جابه‌جایی بین صرافی‌ها", "لێکخشانی گواستنەوە لە نێوان ئاڵوگۆڕەکان", "Transfer friction between exchanges"),
    "c2.d": L("اسپرد آربیتراژ تتر بین صرافی‌های ایرانی — اگر برداشت و واریز آزاد و سریع بود این شکاف بسته می‌شد (۲٪ و بیشتر ← ۱۰۰)",
              "سپرێدی ئاربیتراژی تەتەر لە نێوان ئاڵوگۆڕە ئێرانییەکان — ئەگەر کێشان و دانان ئازاد بوایە ئەم بۆشاییە دادەخرا (٢٪ و زیاتر ← ١٠٠)",
              "USDT arbitrage spread across Iranian exchanges — with free, fast withdrawals it would close (≥2% → 100)"),
    "c3.t": L("دسترسی اینترنت ایران", "دەستگەیشتنی ئینتەرنێتی ئێران", "Iran internet access"),
    "c3.d": L("IODA (پینگ فعال و BGP کشور IR نسبت به روز قبل) + سکوت فیدهای قیمت داخلی", "IODA (پینگ و BGPی IR بە بەراورد لەگەڵ ڕۆژی پێشوو) + بێدەنگیی فیدە ناوخۆییەکان",
              "IODA (active probing and BGP for IR vs the previous day) + silence of domestic price feeds"),
    "c4.t": L("شدت اخبار منفی محلی", "توندیی هەواڵە نەرێنییە ناوخۆییەکان", "Local negative news"),
    "c4.d": L("تیترهای ۲۴ ساعت رسانه‌های اقتصادی ایران دربارهٔ تحریم، مسدودی، فیلتر، اختلال، جهش دلار و…", "سەردێڕەکانی ٢٤ کاتژمێری میدیا ئابوورییەکانی ئێران (سزا، بلۆک، فیلتەر، پچڕان…)",
              "24h headlines of Iranian business media about sanctions, blocking, filtering, outages, FX jumps…"),
    "fr.paper": L("قیمت روی کاغذ در برابر واقعیت", "نرخی سەر کاغەز بەرامبەر ڕاستی", "Paper price vs reality"),
    "fr.k": L("بیت‌کوین «روی کاغذ» (قیمت جهانی × دلار آزاد)|بیت‌کوین در ایران (با تتر بازار داخلی)|فاصله|هزینهٔ ۱٬۰۰۰ دلار کریپتو با تتر|همان مبلغ با دلار آزاد",
              "بیتکۆین «لەسەر کاغەز» (نرخی جیهانی × دۆلاری ئازاد)|بیتکۆین لە ئێران (بە تەتەری ناوخۆ)|مەودا|تێچووی ١٬٠٠٠ دۆلار کریپتۆ بە تەتەر|هەمان بڕ بە دۆلاری ئازاد",
              "Bitcoin “on paper” (global price × free dollar)|Bitcoin in Iran (domestic tether)|Gap|Cost of $1,000 of crypto via tether|Same amount via the free dollar"),
    "fr.time": L("در طول زمان", "بە درێژایی کات", "Over time"),
    "fr.gap_h": L("تاریخچهٔ اختلاف نرخ تتر با دلار آزاد (روزانه، ۱۵:۳۰ تهران)", "مێژووی جیاوازیی تەتەر و دۆلاری ئازاد (ڕۆژانە، ١٥:٣٠ی تاران)",
                  "History of the tether–dollar gap (daily, 15:30 Tehran)"),
    "fr.score_h": L("تاریخچهٔ شاخص (ساعتی)", "مێژووی پێوەر (کاتژمێری)", "Score history (hourly)"),
    "fr.board": L("تابلوی تتر صرافی‌های ایرانی (تومان)", "تابلۆی تەتەری ئاڵوگۆڕە ئێرانییەکان (تمەن)", "Iranian exchanges' USDT board (toman)"),
    "fr.th": L("صرافی|خرید|فروش|اختلاف خرید و فروش|برچسب", "ئاڵوگۆڕ|کڕین|فرۆشتن|جیاوازی|نیشانە", "Exchange|Buy|Sell|Spread|Flag"),
    "fr.sanc": L("⚠️ تحت تحریم", "⚠️ ژێر سزا", "⚠️ sanctioned"),
    "fr.sanc_note": L("برچسب «تحت تحریم» طبق منبع قیمت (@ttprice) است؛ در استفاده از این صرافی‌ها احتیاط کنید. زمان تابلو:",
                      "نیشانەی «ژێر سزا» بەپێی سەرچاوەی نرخە (@ttprice)؛ ئاگادار بە. کاتی تابلۆ:",
                      "The “sanctioned” flag comes from the price source (@ttprice); be careful with those exchanges. Board time:"),
    "fr.news": L("تیترهای منفی محلی ۲۴ ساعت اخیر", "سەردێڕە نەرێنییە ناوخۆییەکانی ٢٤ کاتژمێری ڕابردوو", "Local negative headlines, last 24h"),
    # ---- hype
    "hy.title": L("نیمه‌عمر هیاهو: روایت‌های بازار چقدر زنده می‌مانند؟", "نیوەتەمەنی هایپ: چیرۆکەکانی بازاڕ چەند دەژین؟", "Hype Half-Life: how long do market narratives live?"),
    "hy.desc": L("عمر واقعی روایت‌های بازار کریپتو (هوش مصنوعی، ETF، میم‌کوین، RWA و…) و اثر واقعی‌شان روی قیمت: شروع، اوج، نیمه‌عمر، مرگ و نمرهٔ کیفیت.",
                 "تەمەنی ڕاستەقینەی چیرۆکەکانی بازاڕی کریپتۆ و کاریگەرییان لەسەر نرخ: دەستپێک، لووتکە، نیوەتەمەن، مردن و نمرەی کوالیتی.",
                 "The real lifespan of crypto narratives (AI, ETFs, memecoins, RWA…) and their real price impact: start, peak, half-life, death and a quality score."),
    "hy.example": L("نمونه — آخرین دورهٔ ثبت‌شده", "نموونە — دوایین خولی تۆمارکراو", "Example — latest recorded episode"),
    "hy.ex_line": L("روایت «{name}» ← نیمه‌عمر {half} روز | تأثیر قیمت {imp} | نمرهٔ کیفیت {q}/۱۰۰",
                    "چیرۆکی «{name}» ← نیوەتەمەن {half} ڕۆژ | کاریگەریی نرخ {imp} | نمرەی کوالیتی {q}/١٠٠",
                    "Narrative “{name}” → half-life {half} days | price impact {imp} | quality {q}/100"),
    "hy.table": L("جدول روایت‌ها", "خشتەی چیرۆکەکان", "Narrative table"),
    "hy.th": L("روایت|وضعیت امروز|میانهٔ نیمه‌عمر (روز)|میانهٔ طول عمر (روز)|کیفیت ۰–۱۰۰|تأثیر آخرین دوره|شروع آخرین دوره",
               "چیرۆک|دۆخی ئەمڕۆ|ناوەندی نیوەتەمەن (ڕۆژ)|ناوەندی تەمەن (ڕۆژ)|کوالیتی ٠–١٠٠|کاریگەریی دوایین خول|دەستپێکی دوایین خول",
               "Narrative|State today|Median half-life (days)|Median life (days)|Quality 0–100|Last episode impact|Last episode start"),
    "hy.qnote": L("کیفیت ۵۰ یعنی بی‌اثر روی قیمت؛ بالاتر = تأثیر مثبت به‌ازای هر روز عمر، پایین‌تر = هیاهوی تهی یا منفی.",
                  "کوالیتی ٥٠ واتە بێکاریگەر؛ بەرزتر = کاریگەریی ئەرێنی بۆ هەر ڕۆژێک، نزمتر = هایپی بەتاڵ یان نەرێنی.",
                  "Quality 50 = no price effect; higher = positive impact per day of life, lower = empty or negative hype."),
    "hy.global24": L("تیترهای جهانی ۲۴ساعت: {n}", "سەردێڕی جیهانی ٢٤ک: {n}", "global headlines 24h: {n}"),
    "hy.cards": L("کارنامهٔ هر روایت", "کارنامەی هەر چیرۆکێک", "Each narrative's record"),
    "hy.alive": L("زنده", "زیندوو", "alive"), "hy.ended": L("پایان‌یافته", "کۆتاییهاتوو", "ended"),
    "hy.src_ch": L("کانال", "کەناڵ", "channel"), "hy.src_gl": L("اخبار جهانی", "هەواڵی جیهانی", "global news"),
    "hy.ep": L("{start} ← اوج {peak} · نیمه‌عمر {half} · عمر {life} روز · تأثیر {imp}{exc} · کیفیت {q}",
               "{start} ← لووتکە {peak} · نیوەتەمەن {half} · تەمەن {life} ڕۆژ · کاریگەری {imp}{exc} · کوالیتی {q}",
               "{start} → peak {peak} · half-life {half} · life {life} d · impact {imp}{exc} · quality {q}"),
    "hy.market": L("کل بازار (BTC)", "هەموو بازاڕ (BTC)", "whole market (BTC)"),
    "hy.leg_ch": L("پست‌های کانال (جمع ۵ روزه)", "پۆستەکانی کەناڵ (کۆی ٥ ڕۆژ)", "channel posts (5-day sum)"),
    "hy.leg_gl": L("تیترهای جهانی ÷ ۱۰", "سەردێڕی جیهانی ÷ ١٠", "global headlines ÷ 10"),
    "hy.none": L("هنوز دورهٔ هیاهوی مشخصی ثبت نشده", "هێشتا خولێکی دیار تۆمار نەکراوە", "No clear hype episode recorded yet"),
    "hy.cov": L("پوشش داده: کانال از {ch} ({n} پست) · اخبار جهانی از {gl}", "داتای بەردەست: کەناڵ لە {ch} ({n} پۆست) · هەواڵی جیهانی لە {gl}",
                "Data coverage: channel since {ch} ({n} posts) · global news since {gl}"),
    "st.rising": L("در حال اوج‌گیری", "لە بەرزبوونەوەدا", "Rising"), "st.peak": L("در اوج", "لە لووتکەدا", "At peak"),
    "st.cooling": L("رو به سرد شدن", "بەرەو ساردبوونەوە", "Cooling"), "st.fading": L("پس از نیمه‌عمر", "دوای نیوەتەمەن", "Past half-life"),
    "st.quiet": L("آرام", "ئارام", "Quiet"),
    # ---- silent exit
    "se.title": L("آشکارساز خروج خاموش", "دۆزەرەوەی چوونەدەرەوەی بێدەنگ", "Silent Exit Detector"),
    "se.desc": L("وقتی پول بزرگ بی‌صدا می‌فروشد ولی حرف بازار هنوز صعودی یا خنثی است: تناقض «حرف» و «عمل» نهنگ‌ها برای بیت‌کوین و اتریوم، با بک‌تست و کارنامهٔ زنده.",
                 "کاتێک پارەی گەورە بە بێدەنگی دەفرۆشێت بەڵام قسەی بازاڕ هێشتا ئەرێنی یان بێلایەنە: ناکۆکیی «قسە» و «کردار» بۆ بیتکۆین و ئیتریۆم.",
                 "When big money quietly sells while the market's talk is still bullish or neutral: the say-vs-do contradiction for BTC and ETH, with a backtest and a live record."),
    "sl.none": L("بدون هشدار", "بێ ئاگاداری", "No alert"), "sl.yellow": L("زرد", "زەرد", "Yellow"), "sl.orange": L("نارنجی", "پرتەقاڵی", "Orange"),
    "sl.red": L("قرمز", "سوور", "Red"),
    "A1.t": L("ورود نهنگ‌ها به صرافی‌ها", "هاتنی نەهەنگەکان بۆ ئاڵوگۆڕەکان", "Whales moving coins onto exchanges"),
    "A1.d": L("جریان خالص ۷۲ ساعتهٔ انتقال‌های بزرگ به صرافی‌ها (Whale Alert) در ۱۵٪ بالای ۹۰ روز اخیر", "ڕەوتی پاکی ٧٢ کاتژمێری گواستنەوە گەورەکان بۆ ئاڵوگۆڕەکان لە ١٥٪ی سەرەوەی ٩٠ ڕۆژ",
              "72h net flow of large transfers onto exchanges (Whale Alert) in the top 15% of 90 days"),
    "A2.t": L("فروش تهاجمی در حالی که قیمت ثابت مانده", "فرۆشتنی هێرشبەرانە لە کاتێکدا نرخ وەستاوە", "Aggressive selling while price holds"),
    "A2.d": L("عدم‌توازن خریدار/فروشندهٔ تیکر Binance در ۷۲ ساعت در ۱۵٪ پایین ۱۸۰ روز، بدون ریزش بیش از ۲٪",
              "ناهاوسەنگیی کڕیار/فرۆشیاری Binance لە ٧٢ کاتژمێردا لە ١٥٪ی خوارەوە، بێ دابەزینی زیاتر لە ٢٪",
              "Binance taker buy/sell imbalance over 72h in the bottom 15% of 180 days, with price not down > 2%"),
    "A3.t": L("ضعف تقاضای آمریکا (پرمیوم کوین‌بیس)", "لاوازیی داواکاریی ئەمریکا (پرێمیۆمی کۆینبەیس)", "Weak US demand (Coinbase premium)"),
    "A3.d": L("اختلاف قیمت کوین‌بیس با بایننس (میانگین ۲۴ ساعت) در ۱۵٪ پایین ۹۰ روز", "جیاوازیی نرخی کۆینبەیس و بایننس لە ١٥٪ی خوارەوەی ٩٠ ڕۆژ",
              "Coinbase vs Binance price gap (24h mean) in the bottom 15% of 90 days"),
    "se.pct": L("صدک {n}", "سەدیی {n}", "percentile {n}"),
    "se.nohist": L("تاریخچهٔ کافی هنوز نیست", "مێژووی پێویست هێشتا نییە", "not enough history yet"),
    "se.talk": L("«حرف» بازار: ترس و طمع {fng} · صدک فاندینگ {fp} · احساسات اخبار {sent} · شورای هوش مصنوعی {cm}",
                 "«قسە»ی بازاڕ: ترس و تەماح {fng} · سەدیی فاندینگ {fp} · هەستی هەواڵ {sent} · ئەنجومەنی AI {cm}",
                 "The market's talk: Fear & Greed {fng} · funding pct {fp} · news sentiment {sent} · AI council {cm}"),
    "se.gate_ok": L("هنوز نزولی نیست — شرط خروج «خاموش» برقرار است", "هێشتا نەرێنی نییە — مەرجی «بێدەنگ» هەیە", "Not bearish yet — the “silent” condition holds"),
    "se.gate_no": L("حرف بازار خودش نزولی است؛ خروج دیگر «خاموش» نیست", "قسەی بازاڕ خۆی نەرێنییە؛ چیتر «بێدەنگ» نییە", "The talk is already bearish; an exit wouldn't be “silent”"),
    "se.whale": L("انتقال‌های بزرگ ۷۲ ساعت: به صرافی ${i}M · از صرافی ${o}M · اوپن‌اینترست {oi}",
                  "گواستنەوە گەورەکانی ٧٢ کاتژمێر: بۆ ئاڵوگۆڕ ${i}M · لە ئاڵوگۆڕ ${o}M · OI {oi}",
                  "Large transfers, 72h: to exchanges ${i}M · from exchanges ${o}M · open interest {oi}"),
    "se.score": L("امتیاز عمل: {s} (زرد ≥۰٫۵ · نارنجی ≥۱ · قرمز ≥۲) · قیمت ${p} ({ch} در ۷۲ ساعت)", "خاڵی کردار: {s} (زەرد ≥٠٫٥ · پرتەقاڵی ≥١ · سوور ≥٢) · نرخ ${p} ({ch} لە ٧٢ک)",
                  "Action score: {s} (yellow ≥0.5 · orange ≥1 · red ≥2) · price ${p} ({ch} over 72h)"),
    "se.now": L("وضعیت همین حالا", "دۆخی ئێستا", "Right now"),
    "se.bt": L("بک‌تست روزانه", "باکتێستی ڕۆژانە", "Daily backtest"),
    "se.bt_th": L("دارایی|سطح|تعداد هشدار|افت معنادار در ۷ روز|نرخ پایه (همهٔ روزها)|میانگین بازده ۷ روزه|افت ≥۵٪ در مسیر",
                  "دارایی|ئاست|ژمارەی ئاگاداری|دابەزینی بەرچاو لە ٧ ڕۆژدا|ڕێژەی بنەڕەت|ناوەندی قازانجی ٧ ڕۆژە|دابەزینی ≥٥٪",
                  "Asset|Level|Alerts|Significant drop within 7d|Base rate (all days)|Avg 7-day return|Drawdown ≥5% on the way"),
    "se.bt_note": L("«افت معنادار» = بازده ۷ روزه بدتر از ۳٪-. معیار موفقیت: دست‌کم ۷۰٪ هشدارهای قرمز. بک‌تست فقط نشانه‌هایی را دارد که تاریخچه دارند (فاندینگ و ترس و طمع به‌جای «حرف»)؛ نسخهٔ زنده اخبار و شورای هوش مصنوعی را هم دارد.",
                    "«دابەزینی بەرچاو» = قازانجی ٧ ڕۆژە خراپتر لە −٣٪. پێوەری سەرکەوتن: لانیکەم ٧٠٪ی ئاگادارییە سوورەکان. باکتێست تەنها ئەو نیشانانەی هەیە کە مێژوویان هەیە.",
                    "“Significant drop” = 7-day return worse than −3%. Success criterion: at least 70% of red alerts. The backtest only uses signals that have history (funding and Fear & Greed as the “talk”); the live version adds news and the AI council."),
    "se.live": L("هشدارهای زنده", "ئاگادارییە زیندووەکان", "Live alerts"),
    "se.locked": L("در دفتر قفل شد", "لە تۆمار قوفڵ کرا", "locked in the ledger"),
    "se.hist": L("امتیاز عمل در طول زمان", "خاڵی کردار بە درێژایی کات", "Action score over time"),
    "cm.up": L("صعودی", "ئەرێنی", "bullish"), "cm.down": L("نزولی", "نەرێنی", "bearish"), "cm.flat": L("خنثی", "بێلایەن", "neutral"),
    # ---- correlation
    "co.title": L("ماتریس همبستگی محلی: کریپتو در برابر اقتصاد ایران", "ماتریکسی پەیوەندیی ناوخۆیی: کریپتۆ بەرامبەر ئابووریی ئێران", "Local Correlation Matrix: crypto vs Iran's economy"),
    "co.desc": L("آیا کریپتو برای کاربر ایرانی پناهگاه بوده یا فقط با دلار هم‌حرکت شده؟ همبستگی روزانهٔ بیت‌کوین تومانی، دلار آزاد، تتر، طلای ۱۸ عیار و سکه در بازه‌های ۷ روز تا ۱ سال.",
                 "ئایا کریپتۆ بۆ بەکارهێنەری ئێرانی پەناگە بووە یان تەنها لەگەڵ دۆلار جووڵاوە؟ پەیوەندیی ڕۆژانەی بیتکۆینی تمەنی، دۆلاری ئازاد، تەتەر، زێڕ و سکە.",
                 "Has crypto been a safe haven for Iranians or has it simply moved with the dollar? Daily correlations of toman bitcoin, the free dollar, tether, 18k gold and coins over 7 days to 1 year."),
    "co.src": L("نوسان بیت‌کوین تومانی از کجا می‌آید؟", "لەرزینی بیتکۆینی تمەنی لە کوێوە دێت؟", "Where do toman-bitcoin swings come from?"),
    "co.src_line": L("سهم خود بیت‌کوین: {b} · سهم تومان/تتر: {t}", "بەشی خودی بیتکۆین: {b} · بەشی تمەن/تەتەر: {t}", "Bitcoin itself: {b} · toman/tether: {t}"),
    "co.vol": L("نوسان سالانه: بیت‌کوین تومانی {b} · تتر {t}", "لەرزینی ساڵانە: بیتکۆینی تمەنی {b} · تەتەر {t}", "Annualised volatility: toman BTC {b} · tether {t}"),
    "co.haven": L("آزمون پناهگاه", "تاقیکردنەوەی پەناگە", "Safe-haven test"),
    "co.haven_lead": L("در {n} روزی که دلار آزاد ≥۱٪ جهش کرد (میانگین {avg}):", "لە {n} ڕۆژدا کە دۆلاری ئازاد ≥١٪ بەرز بووەوە (ناوەند {avg}):",
                       "On the {n} days the free dollar jumped ≥1% (avg {avg}):"),
    "co.haven_row": L("{a}: میانگین {avg} · جلوتر از دلار در {beat} روزها", "{a}: ناوەند {avg} · پێشتر لە دۆلار لە {beat}ی ڕۆژەکان", "{a}: avg {avg} · beat the dollar on {beat} of days"),
    "co.matrix": L("ماتریس همبستگی بازده روزانه", "ماتریکسی پەیوەندیی قازانجی ڕۆژانە", "Correlation matrix of daily returns"),
    "co.mat_note": L("+۱ = کاملاً هم‌جهت · ۰ = بی‌ارتباط · −۱ = کاملاً خلاف هم. با نگه‌داشتن نشانگر روی هر خانه، تعداد بازده‌های مشترک دیده می‌شود.",
                     "+١ = تەواو هاوئاراستە · ٠ = بێپەیوەندی · −١ = تەواو پێچەوانە. ژمارەی قازانجە هاوبەشەکان بە ڕاگرتنی نیشاندەر دەردەکەوێت.",
                     "+1 = moving together · 0 = unrelated · −1 = opposite. Hover a cell for the number of shared returns."),
    "co.n": L("{n} بازده روزانهٔ مشترک", "{n} قازانجی ڕۆژانەی هاوبەش", "{n} shared daily returns"),
    "co.co": L("هم‌حرکتی (۱۰۰ = اولین روز مشترک)", "هاوجووڵە (١٠٠ = یەکەم ڕۆژی هاوبەش)", "Co-movement (100 = first shared day)"),
    "co.roll": L("همبستگی غلتان ۳۰ روزه با دلار آزاد", "پەیوەندیی خولاوەی ٣٠ ڕۆژە لەگەڵ دۆلاری ئازاد", "Rolling 30-day correlation with the free dollar"),
    "co.last": L("آخرین قیمت‌ها و تغییرات", "دوایین نرخەکان و گۆڕانکارییەکان", "Latest prices and changes"),
    "co.th": L("دارایی|آخرین (تومان/دلار)|۷ روز|۳۰ روز|۹۰ روز|۱ سال|دادهٔ موجود از", "دارایی|دوایین|٧ ڕۆژ|٣٠ ڕۆژ|٩٠ ڕۆژ|١ ساڵ|داتا لە",
               "Asset|Last (toman/$)|7d|30d|90d|1y|Data since"),
    "w.7d": L("۷ روز", "٧ ڕۆژ", "7d"), "w.30d": L("۳۰ روز", "٣٠ ڕۆژ", "30d"), "w.90d": L("۹۰ روز", "٩٠ ڕۆژ", "90d"),
    "w.180d": L("۶ ماه", "٦ مانگ", "6m"), "w.365d": L("۱ سال", "١ ساڵ", "1y"),
    # ---- hub
    "hb.title": L("واقعیت‌سنج انتخاب", "ڕاستی‌پێوی Entekhab", "Entekhab Reality Check"),
    "hb.desc": L("پنج ابزار که فاصلهٔ «حرف» و «واقعیت» بازار را با دادهٔ عمومی و قابل‌بازبینی می‌سنجند: دفتر سیگنال‌های قفل‌شده، اصطکاک ایران، نیمه‌عمر هیاهو، خروج خاموش و همبستگی محلی.",
                 "پێنج ئامراز کە مەودای «قسە» و «ڕاستی»ی بازاڕ بە داتای گشتی و پشکنراو دەپێون: تۆماری سیگناڵی قوفڵکراو، لێکخشانی ئێران، نیوەتەمەنی هایپ، چوونەدەرەوەی بێدەنگ و پەیوەندیی ناوخۆیی.",
                 "Five tools that measure the gap between what the market says and what it does, with public and re-checkable data: a time-locked signal ledger, Iran friction, hype half-life, silent exits and local correlations."),
    "hb.why": L("چرا «واقعیت‌سنج»؟", "بۆچی «ڕاستی‌پێو»؟", "Why a reality check?"),
    "hb.why_t": L("فضای فارسی کریپتو پر از سیگنال بی‌کارنامه، قیمت‌های «روی کاغذ» و روایت‌های پرسروصداست. این پنج ابزار با هم یک لایهٔ حساب‌پذیری می‌سازند: سیگنال‌ها را حساب‌پذیر می‌کنند، اصطکاک واقعی ایران را نشان می‌دهند، عمر روایت‌ها را اندازه می‌گیرند، خروج بی‌صدای سرمایه را آشکار می‌کنند و جایگاه کریپتو را در اقتصاد واقعی ایران مشخص می‌کنند. همهٔ ورودی‌ها عمومی‌اند و فایل JSON هر ابزار برای بازبینی منتشر می‌شود.",
                  "پێنج ئامرازەکە پێکەوە چینێکی لێپرسینەوە دروست دەکەن: سیگناڵەکان لێپرسراو دەکەن، لێکخشانی ڕاستەقینەی ئێران پیشان دەدەن، تەمەنی چیرۆکەکان دەپێون، چوونەدەرەوەی بێدەنگی سەرمایە ئاشکرا دەکەن و شوێنی کریپتۆ لە ئابووریی ئێراندا دیاری دەکەن. هەموو داتاکان گشتین.",
                  "Persian-language crypto is full of signals without a track record, “paper” prices and loud narratives. Together these five tools form an accountability layer: they make signals accountable, show Iran's real friction, time narratives, expose silent exits and place crypto within Iran's real economy. All inputs are public and every tool's JSON is published for review."),
    "hb.locked": L("پیش‌بینی قفل‌شده", "پێشبینیی قوفڵکراو", "locked calls"),
    "hb.best": L("دقیق‌ترین منبع", "وردترین سەرچاوە", "Most accurate"),
    "hb.l_t": L("دفتر عملکرد سیگنال‌ها", "تۆماری ئەنجامی سیگناڵەکان", "Signal ledger"),
    "hb.l_d": L("هر پیش‌بینی با قفل زمانی و هش؛ دقت واقعی هر منبع", "هەر پێشبینییەک بە قوفڵی کات و هاش؛ وردیی ڕاستەقینە", "Every call time-locked and hashed; each source's real accuracy"),
    "hb.f_t": L("اصطکاک محلی ایران", "لێکخشانی ناوخۆیی ئێران", "Iran friction"),
    "hb.f_d": L("فاصلهٔ قیمت روی کاغذ با واقعیت کاربر ایرانی", "مەودای نرخی سەر کاغەز لە ڕاستیی بەکارهێنەری ئێرانی", "Paper price vs the Iranian user's reality"),
    "hb.h_t": L("نیمه‌عمر هیاهو", "نیوەتەمەنی هایپ", "Hype half-life"),
    "hb.h_d": L("روایت‌ها کی متولد می‌شوند، کی می‌میرند و چه اثری دارند", "چیرۆکەکان کەی لەدایک دەبن، کەی دەمرن و چ کاریگەرییەکیان هەیە", "When narratives are born, when they die, what they move"),
    "hb.h_none": L("روایت زنده‌ای نیست", "چیرۆکی زیندوو نییە", "No live narrative"),
    "hb.s_t": L("خروج خاموش", "چوونەدەرەوەی بێدەنگ", "Silent exit"),
    "hb.s_d": L("تناقض حرف و عمل نهنگ‌ها", "ناکۆکیی قسە و کرداری نەهەنگەکان", "When whales' actions contradict the talk"),
    "hb.c_t": L("همبستگی محلی", "پەیوەندیی ناوخۆیی", "Local correlation"),
    "hb.c_d": L("کریپتو در برابر دلار، تتر، طلا و سکه", "کریپتۆ بەرامبەر دۆلار، تەتەر، زێڕ و سکە", "Crypto vs dollar, tether, gold and coins"),
    "hb.c_k": L("همبستگی ۹۰ روزهٔ بیت‌کوین تومانی و دلار آزاد", "پەیوەندیی ٩٠ ڕۆژەی بیتکۆینی تمەنی و دۆلاری ئازاد", "90-day correlation, toman BTC vs free USD"),
}

METH = {
    "ledger": L(
        ["هر ردیف شامل منبع، کوین، جهت، بازه، قیمت مبنا، زمان انتشار و زمان قفل است؛ هش SHA-256 همین فیلدها به‌اضافهٔ هش ردیف قبلی ذخیره می‌شود. تغییر یا حذف هر ردیف، همهٔ هش‌های بعدی را باطل می‌کند.",
         "هر روز «سرِ زنجیره» با OpenTimestamps روی بلاک‌چین بیت‌کوین مهر زمان می‌خورد؛ با فایل‌های ‎.txt و ‎.ots و ابزار ots هر کس می‌تواند ثابت کند دفتر از آن روز تغییر نکرده است.",
         "قیمت پایان = قیمت باز شدن اولین کندل ساعتی Binance پس از پایان بازه. باند خنثی = ۰٫۱٪ × جذر ساعت‌های بازه (۷۲ ساعت ≈ ۰٫۸۵٪).",
         "صعودی/نزولی: «درست» اگر حرکت در جهت پیش‌بینی از باند بیشتر باشد، «نادرست» اگر خلافش، وگرنه «بی‌نتیجه» (در دقت حساب نمی‌شود). خنثی: درست اگر قدرمطلق حرکت ≤ ۳ برابر باند.",
         "اگر هدف/حد ضرر داده شده باشد، هر کدام زودتر لمس شود ملاک است؛ لمس هر دو در یک کندل = نادرست (محافظه‌کارانه). کندل ناقص لحظهٔ انتشار برای لمس حساب نمی‌شود.",
         "فقط پیش‌بینی‌هایی وارد دفتر می‌شوند که منبعشان هم‌زمان ثبتشان کرده (شورای هوش مصنوعی، لاگ زندهٔ اسکنر، بازی پیش‌بینی، پست کانال)؛ بک‌تست‌ها هرگز وارد دفتر نمی‌شوند.",
         "شورای هوش مصنوعی: بازهٔ ۷۲ ساعت · اسکنر: یافته‌های پراطمینان روی ۲۲ کوین اصلی، ۷۲ ساعت · خروج خاموش: ۷ روز · بازی پیش‌بینی: قاعدهٔ خود بازی (بالاتر/پایین‌تر بدون باند)."],
        ["هەر ڕیزێک سەرچاوە، دراو، ئاراستە، ماوە، نرخی بنەڕەت و کاتی بڵاوبوونەوە و قوفڵ لەخۆ دەگرێت؛ هاشی SHA-256ی ئەم خانانە لەگەڵ هاشی ڕیزی پێشوو هەڵدەگیرێت.",
         "هەموو ڕۆژێک «سەری زنجیرە» بە OpenTimestamps لەسەر بلۆکچەینی بیتکۆین مۆری کاتی لێدەدرێت.",
         "نرخی کۆتایی = نرخی کرانەوەی یەکەم مۆمی کاتژمێریی Binance دوای کۆتایی ماوە. باندی بێلایەن = ٠٫١٪ × ڕەگی کاتژمێرەکانی ماوە.",
         "بەرزبوونەوە/دابەزین: «ڕاست» ئەگەر جووڵە لە ئاراستەی پێشبینی لە باند زیاتر بێت، «هەڵە» ئەگەر پێچەوانە بێت، دەنا «بێ ئەنجام».",
         "ئەگەر ئامانج/سنووری زیان دیاری کرابێت، هەرکامیان زووتر بگات ئەوە پێوەرە؛ هەردووکیان لە یەک مۆمدا = هەڵە.",
         "تەنها ئەو پێشبینیانە تۆمار دەکرێن کە سەرچاوەکەیان لە هەمان کاتدا تۆماری کردوون؛ باکتێست هەرگیز ناچێتە ناو تۆمارەکە."],
        ["Each row holds source, coin, direction, horizon, reference price, publication time and lock time; the SHA-256 of those fields plus the previous row's hash is stored. Editing or deleting any row invalidates every later hash.",
         "Every day the chain head is timestamped on the Bitcoin blockchain with OpenTimestamps; with the .txt and .ots files and the ots tool anyone can prove the ledger hasn't changed since that day.",
         "End price = open of the first Binance 1-hour candle after the horizon. Neutral band = 0.1% × √(horizon hours) (72h ≈ 0.85%).",
         "Up/down: right if the move in the called direction exceeds the band, wrong if against it, otherwise no decision (excluded from accuracy). Flat: right if |move| ≤ 3 × band.",
         "With a target/stop, whichever is touched first decides; both in one candle counts as wrong (conservative). The partial candle of publication is ignored for touches.",
         "Only calls their source recorded in real time are admitted (AI council, live scanner log, prediction game, channel posts); backtests never enter the ledger.",
         "AI council: 72h horizon · scanner: high-confidence findings on 22 core coins, 72h · silent exit: 7 days · prediction game: the game's own rule (above/below, no band)."]),
    "friction": L(
        ["شاخص = ۰٫۴ × اختلاف تتر + ۰٫۳ × اصطکاک جابه‌جایی + ۰٫۲ × دسترسی + ۰٫۱ × اخبار منفی؛ هر مؤلفه ۰ تا ۱۰۰.",
         "قیمت‌ها از کانال‌های عمومی ‎@ttprice ، ‎@NerkhDollarIRT و ‎@USDTTetherp (همان فیدهای ربات کوین کورد) خوانده می‌شوند.",
         "«تأخیر برداشت» به‌صورت عمومی قابل‌اندازه‌گیری نیست؛ به‌جایش اسپرد آربیتراژ بین صرافی‌ها به‌کار می‌رود که هزینهٔ ضمنی جابه‌جایی پول بین آن‌هاست.",
         "دسترسی: نسبت سیگنال‌های IODA (Georgia Tech) به میانهٔ روز قبل؛ اگر فیدهای داخلی در ساعات بیداری ایران بیش از ۷۵ دقیقه ساکت باشند نیمی از امتیاز این مؤلفه داده می‌شود.",
         "اخبار: فقط تیترهایی که هم واژهٔ منفی (تحریم، مسدودی، فیلتر، اختلال، جهش دلار…) و هم نشانهٔ ایرانی (صرافی داخلی، تتر، اینترنت، دلار، بانک مرکزی…) دارند؛ واژه‌های حرکت قیمت (سقوط، ریزش) عمداً حساب نمی‌شوند.",
         "تاریخچهٔ روزانهٔ اختلاف تتر از آرشیو کامل دو کانال تیک قیمت بازسازی شده است (نمونه‌برداری ساعت ۱۵:۳۰ تهران)."],
        ["پێوەر = ٠٫٤ × جیاوازیی تەتەر + ٠٫٣ × لێکخشانی گواستنەوە + ٠٫٢ × دەستگەیشتن + ٠٫١ × هەواڵی نەرێنی.",
         "نرخەکان لە کەناڵە گشتییەکانی @ttprice، @NerkhDollarIRT و @USDTTetherp دەخوێنرێنەوە.",
         "«دواکەوتنی کێشانەوە» بە گشتی ناپێورێت؛ لە جیاتی ئەوە سپرێدی ئاربیتراژ بەکاردێت کە تێچووی شاراوەی گواستنەوەیە.",
         "دەستگەیشتن: سیگناڵەکانی IODA بە بەراورد لەگەڵ ڕۆژی پێشوو + بێدەنگیی فیدە ناوخۆییەکان."],
        ["Score = 0.4 × tether gap + 0.3 × transfer friction + 0.2 × access + 0.1 × negative news; each component is 0–100.",
         "Prices come from the public channels @ttprice, @NerkhDollarIRT and @USDTTetherp (the same feeds as the Coin_Kurd bot).",
         "Withdrawal delays can't be measured publicly; the cross-exchange arbitrage spread is used instead — it is the market's implied cost of moving money between them.",
         "Access: IODA (Georgia Tech) signals vs the previous day's median; if domestic feeds are silent > 75 min during Iranian waking hours half of this component is scored.",
         "News: only headlines with both a negative word (sanctions, blocking, filtering, outage, FX jump…) and an Iranian marker (domestic exchange, tether, internet, dollar, central bank…); price-move words are deliberately ignored.",
         "The daily tether-gap history is rebuilt from the full archive of two tick channels (sampled at 15:30 Tehran)."]),
    "hype": L(
        ["شدت روزانهٔ هر روایت = تعداد پست‌های کانال Coin_Kurd (واژه‌های فارسی و انگلیسی) و تعداد تیترهای ۲۴ ساعت ده‌ها منبع خبری جهانی؛ هر سری با جمع ۵ روزه هموار می‌شود.",
         "آستانهٔ تکرار = بیشینهٔ (میانه + ۲×MAD ، ۱٫۸×میانه ، حداقل مطلق). شروع = عبور از آستانه؛ اوج = بیشترین شدت؛ نیمه‌عمر = اوج تا رسیدن شدت به نیمهٔ راه اوج و پایه؛ مرگ = بازگشت به ۲۰٪ بالای پایه.",
         "تأثیر قیمت = بازده سبد هم‌وزن کوین‌های همان روایت (قیمت روزانهٔ Binance) از شروع تا نیمه‌عمر و تا مرگ؛ مازاد نسبت به بیت‌کوین هم نشان داده می‌شود.",
         "کیفیت = 100 ÷ (1 + e^(−(تأثیر٪ ÷ روزهای عمر) ÷ 0.5)) — ۵۰ یعنی بی‌اثر. روایت‌های قانون‌گذاری و امنیت سبد کوین ندارند و با کل بازار (BTC) سنجیده می‌شوند.",
         "آرشیو کانال با بک‌فیل خودکار تا یک سال عقب‌تر گسترش می‌یابد؛ سری اخبار جهانی از آبان ۱۴۰۵ روزبه‌روز بلندتر می‌شود."],
        ["توندیی ڕۆژانەی هەر چیرۆکێک = ژمارەی پۆستەکانی کەناڵی Coin_Kurd و سەردێڕەکانی هەواڵی جیهانی؛ بە کۆی ٥ ڕۆژە نەرم دەکرێت.",
         "دەستپێک = تێپەڕینی سنوور؛ لووتکە = زۆرترین توندی؛ نیوەتەمەن = لووتکە تا نیوەی ڕێگای لووتکە و بنەڕەت؛ مردن = گەڕانەوە بۆ ٢٠٪ سەرووی بنەڕەت.",
         "کاریگەریی نرخ = قازانجی سەبەتەی یەکسانی دراوەکانی چیرۆکەکە (Binance).",
         "کوالیتی = 100 ÷ (1 + e^(−(کاریگەری٪ ÷ ڕۆژەکانی تەمەن) ÷ 0.5)) — ٥٠ واتە بێکاریگەر."],
        ["Daily intensity of each narrative = Coin_Kurd channel posts mentioning it (Persian and English keywords) and 24h headline counts from dozens of global outlets; each series is smoothed with a 5-day sum.",
         "Threshold = max(median + 2·MAD, 1.8·median, a floor). Start = crossing it; peak = maximum; half-life = peak → halfway back to the baseline; death = back within 20% of the baseline.",
         "Price impact = equal-weight basket of the narrative's coins (Binance daily) from start to half-life and to death; the excess over BTC is shown too.",
         "Quality = 100 / (1 + e^(−(impact% / life days) / 0.5)) — 50 means no effect. Regulation and security have no basket and are measured on the whole market (BTC).",
         "The channel archive is back-filled automatically up to a year; the global-news series grows every day since November 2026."]),
    "silent": L(
        ["هر نشانه با تاریخچهٔ خودش سنجیده می‌شود (صدک)، نه با عدد ثابت؛ شدت هر نشانهٔ فعال از ۰٫۵ (صدک ۱۵٪) تا ۱ (صدک ۳٪ یا شدیدتر) است و جمعشان «امتیاز عمل» است.",
         "ورود به صرافی از کانال عمومی Whale Alert خوانده می‌شود: «from unknown wallet to #Exchange» ورود است و عکسش خروج؛ جابه‌جایی صرافی‌به‌صرافی و بازارسازها حساب نمی‌شوند.",
         "«حرف» هنوز نزولی نیست اگر میانگین (ترس و طمع، صدک فاندینگ OKX، شاخص احساسات اخبار انتخاب، رأی اکثریت شورای هوش مصنوعی) ≥ ۰٫۴۵ باشد؛ اوپن‌اینترست ۷۲ ساعته هم نباید بیش از ۸٪ سقوط کرده باشد.",
         "هشدارهای نارنجی و قرمز زنده به‌صورت پیش‌بینی نزولی ۷ روزه در «دفتر عملکرد سیگنال‌ها» قفل می‌شوند تا کارنامهٔ خود این ابزار هم حساب‌پذیر باشد."],
        ["هەر نیشانەیەک لەگەڵ مێژووی خۆی دەپێورێت (سەدی)، نەک ژمارەیەکی جێگیر.",
         "هاتن بۆ ئاڵوگۆڕ لە کەناڵی گشتیی Whale Alert دەخوێنرێتەوە.",
         "«قسە» هێشتا نەرێنی نییە ئەگەر ناوەندی (ترس و تەماح، فاندینگ، هەستی هەواڵ، ئەنجومەنی AI) ≥ ٠٫٤٥ بێت.",
         "ئاگادارییە پرتەقاڵی و سوورەکان وەک پێشبینیی دابەزینی ٧ ڕۆژە لە تۆمارەکەدا قوفڵ دەکرێن."],
        ["Every signal is judged against its own history (percentile), not a fixed number; an active signal weighs 0.5 (15th pct) to 1 (3rd pct or more extreme); their sum is the action score.",
         "Exchange inflows come from the public Whale Alert channel: “from unknown wallet to #Exchange” is an inflow and the reverse an outflow; exchange-to-exchange and market-maker moves are ignored.",
         "The talk is not bearish yet if the mean of (Fear & Greed, OKX funding percentile, Entekhab news sentiment, AI council majority) ≥ 0.45; open interest must not have fallen more than 8% in 72h.",
         "Live orange and red alerts are locked in the Signal Ledger as 7-day bearish calls, so this tool's own record is accountable too."]),
    "corr": L(
        ["ضریب همبستگی پیرسون روی بازده لگاریتمی روزانه؛ هر جفت فقط روزهایی را می‌شمارد که هر دو داده دارند (فاصلهٔ تا ۴ روز، مثل تعطیلات، مجاز است).",
         "دلار آزاد و تتر از آرشیو کامل کانال‌های عمومی تیک قیمت (‎@NerkhDollarIRT و ‎@USDTTetherp)، نمونه‌برداری ساعت ۱۵:۳۰ تهران؛ روزهای بدون معامله (جمعه‌ها و تعطیلات) خالی می‌مانند.",
         "طلای ۱۸ عیار و سکه امامی از تابلوی ‎@ttprice؛ این کانال پست‌های قدیمی را پاک می‌کند، پس سری آن‌ها از امروز به بعد بلند می‌شود و پس از چند هفته وارد ماتریس می‌شوند.",
         "بیت‌کوین تومانی = قیمت BTCUSDT بایننس (ساعت ۱۲:۰۰ UTC) × تتر بازار ایران؛ برای همین بخشی از هم‌حرکتی آن با دلار ذاتی است — کارت «از کجا می‌آید؟» این دو سهم را جدا می‌کند.",
         "مسکن و بورس عمداً حذف شده‌اند: منبع روزانهٔ قابل‌اتکا و در دسترس از سرورهای ما ندارند."],
        ["هاوکۆلکەی پیرسن لەسەر قازانجی لۆگاریتمیی ڕۆژانە.",
         "دۆلاری ئازاد و تەتەر لە ئەرشیفی تەواوی کەناڵەکانی نرخ (@NerkhDollarIRT و @USDTTetherp)، کاتژمێر ١٥:٣٠ی تاران.",
         "زێڕ و سکە لە @ttprice؛ زنجیرەکەیان لە ئەمڕۆوە درێژ دەبێتەوە.",
         "بیتکۆینی تمەنی = BTCUSDT × تەتەری ئێران.", "خانوو و بۆرس لابراون: سەرچاوەی ڕۆژانەی متمانەپێکراویان نییە."],
        ["Pearson correlation of daily log returns; each pair only uses days both assets have (gaps up to 4 days, e.g. holidays, are allowed).",
         "The free dollar and tether come from the full archive of public tick channels (@NerkhDollarIRT, @USDTTetherp), sampled at 15:30 Tehran; days without trading (Fridays, holidays) stay empty.",
         "18k gold and the Emami coin come from the @ttprice board, which deletes old posts — their series grows from today and joins the matrix after a few weeks.",
         "Toman bitcoin = Binance BTCUSDT (12:00 UTC) × Iranian tether, so part of its co-movement with the dollar is built in — the “where do swings come from?” card separates the two shares.",
         "Housing and the Tehran stock exchange are deliberately left out: no reliable daily source reachable from our servers."]),
}


def s(key, lg, **kw):
    t = S[key].get(lg) or S[key]["fa"]
    return t.format(**kw) if kw else t


def cols(key, lg):
    return s(key, lg).split("|")


# ------------------------------------------------------------------ formatting
def nf(x, lg, d=0, sign=False, pct=False):
    if x is None:
        return "—"
    try:
        x = float(x)
    except (TypeError, ValueError):
        return "—"
    t = f"{x:+,.{d}f}" if sign else f"{x:,.{d}f}"
    if DIG[lg]:
        t = t.translate(DIG[lg])
    return t + (PCT[lg] if pct else "")


def money(x, lg):
    if x is None:
        return "—"
    x = float(x)
    if x >= 1000:
        return nf(x, lg, 0)
    if x >= 1:
        return nf(x, lg, 2)
    t = f"{x:.8f}".rstrip("0").rstrip(".")
    return t.translate(DIG[lg]) if DIG[lg] else t


def g2j(gy, gm, gd):
    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    gy2 = gy + 1 if gm > 2 else gy
    days = 355666 + 365 * gy + (gy2 + 3) // 4 - (gy2 + 99) // 100 + (gy2 + 399) // 400 + gd + g_d_m[gm - 1]
    jy = -1595 + 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        return jy, 1 + days // 31, 1 + days % 31
    return jy, 7 + (days - 186) // 30, 1 + (days - 186) % 30


def fdate(iso, lg, time_=False):
    """fa: Jalali + Tehran time · ckb: Gregorian + Tehran time · en: Gregorian + UTC"""
    if not iso:
        return "—"
    raw = str(iso)
    try:
        dt = R.parse_iso(raw if "T" in raw else raw + "T00:00:00+00:00")
    except Exception:  # noqa: BLE001
        return e(raw)
    loc = dt + TEHRAN if (lg != "en" and "T" in raw) else dt
    if lg == "fa":
        jy, jm, jd = g2j(loc.year, loc.month, loc.day)
        t = f"{jd} {JM[jm - 1]} {jy}"
    elif lg == "ckb":
        t = f"{loc.day} {CKB_M[loc.month - 1]} {loc.year}"
    else:
        t = f"{loc.day} {EN_M[loc.month - 1]} {loc.year}"
    if time_ and "T" in raw:
        t += f" {loc:%H:%M}" + (" UTC" if lg == "en" else "")
    return t.translate(DIG[lg]) if DIG[lg] else t


def hours_txt(h, lg):
    h = float(h)
    if h >= 48 and abs(h / 24 - round(h / 24)) < 1e-6:
        return s("ndays", lg, n=nf(round(h / 24), lg))
    return s("hours", lg, n=nf(h, lg, 0 if h == int(h) else 1))


def badge(level, label):
    return f"<span class='rc-badge' style='--c:{COLORS.get(level, '#94a3b8')}'>{e(label)}</span>"


def slot(cid):
    return f"<div class='rc-slot' data-c='{cid}'></div>"


def table(head, rows, cls=""):
    th = "".join(f"<th>{x}</th>" for x in head)
    return f"<div class='rc-tbl'><table class='{cls}'><tr>{th}</tr>{''.join(rows)}</table></div>"


def sec(title, inner, id_="", lead=""):
    idattr = f" id='{id_}'" if id_ else ""
    ld = f"<p class='rc-lead'>{lead}</p>" if lead else ""
    return f"<section class='rc-sec'{idattr}><h2>{title}</h2>{ld}{inner}</section>"


def meth(key, lg):
    items = "".join(f"<li>{e(x)}</li>" for x in (METH[key].get(lg) or METH[key]["fa"]))
    return f"<details class='rc-meth'><summary>{s('method', lg)}</summary><ul>{items}</ul></details>"


def crumbs(lg, title):
    return f"<div class='meta'><a href='/'>{s('home', lg)}</a> / <a href='/reality/'>{s('hub', lg)}</a> / {e(title)}</div>"


def head(lg, tkey, dkey):
    return crumbs(lg, s(tkey, lg)) + f"<h1>{e(s(tkey, lg))}</h1><p class='rc-lead'>{e(s(dkey, lg))}</p>"


def updated(lg, iso):
    if not iso:
        return f"<p class='note'>{s('nodata', lg)}</p>"
    return f"<p class='note'>{s('upd', lg)}: {fdate(iso, lg, True)} · {s('nfa', lg)}</p>"


def tri(build):
    """three language blocks; only one is visible at a time (switched by the page script)"""
    out = []
    for lg in LANGS:
        try:
            html = build(lg)
        except Exception:  # noqa: BLE001
            traceback.print_exc()
            html = "<p class='note'>—</p>"
        hidden = "" if lg == "fa" else " hidden"
        dirn = "ltr" if lg == "en" else "rtl"
        out.append(f"<div data-rl='{lg}' lang='{lg}' dir='{dirn}'{hidden}>{html}</div>")
    return "".join(out)


# ------------------------------------------------------------------ CSS + JS
RCSS = """
.rc-lead{color:#d7d7d0;margin:6px 0 14px;font-size:.98rem}.rc-sec{margin:28px 0}.rc-sec h2{margin:0 0 10px}.rc-sec h3{font-size:.98rem;margin:14px 0 6px}
.rc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:12px}
.rc-card{background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border:1px solid var(--line);border-radius:16px;padding:14px 16px;min-width:0}
.rc-card h3{margin:0 0 6px;font-size:1.02rem}.rc-card p{margin:4px 0;color:#d6d6d0;font-size:.9rem;line-height:1.85}
a.rc-card{display:block;color:var(--ink);transition:border-color .15s,transform .15s}a.rc-card:hover{border-color:var(--acc);transform:translateY(-2px);text-decoration:none}
.rc-big{font-family:'Space Grotesk',Vazirmatn,monospace;font-size:2rem;font-weight:800;line-height:1.2;direction:ltr;unicode-bidi:isolate;display:inline-block}
.rc-badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:.78rem;font-weight:800;background:color-mix(in srgb,var(--c) 18%,transparent);color:var(--c);border:1px solid color-mix(in srgb,var(--c) 45%,transparent);vertical-align:middle}
.rc-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,150px),1fr));gap:8px;margin:10px 0}
.rc-kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px}.rc-kpi small{display:block;color:var(--mute);font-size:.75rem}
.rc-kpi b{font-family:'Space Grotesk',Vazirmatn,monospace;font-size:1.1rem}
.rc-tbl{overflow-x:auto;border:1px solid var(--line);border-radius:12px;margin:10px 0}.rc-tbl table{min-width:560px}.rc-tbl td,.rc-tbl th{white-space:nowrap}
.rc-tbl td.wrap{white-space:normal;min-width:170px}.rc-tbl tr[hidden]{display:none}
.rc-num{font-family:'Space Grotesk',Vazirmatn,monospace;direction:ltr;unicode-bidi:isolate;display:inline-block}
.up{color:#22c55e}.down{color:#ef4444}.mut{color:var(--mute)}
.rc-chart{width:100%;height:260px}.rc-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.8rem;color:var(--mute);margin:6px 0}
.rc-legend i{display:inline-block;width:12px;height:3px;border-radius:2px;margin-inline-end:5px;vertical-align:middle}
.rc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.rc-tabs button{background:none;border:1px solid var(--line);color:var(--mute);border-radius:99px;padding:5px 12px;font:inherit;font-size:.82rem;cursor:pointer}
.rc-tabs button.on{background:var(--acc);border-color:var(--acc);color:#000;font-weight:800}
.rc-heat{border-collapse:separate;border-spacing:3px;min-width:640px}.rc-heat th{font-size:.72rem;color:var(--mute);font-weight:600;padding:4px;white-space:normal;max-width:96px;text-align:center}
.rc-heat td{border-radius:8px;text-align:center;font-family:'Space Grotesk',monospace;font-size:.82rem;padding:8px 4px;border:0}
.rc-meth{margin:16px 0}.rc-meth ul{margin:8px 0 0;padding-inline-start:20px}.rc-meth li{margin:6px 0;line-height:1.9;color:#d6d6d0;font-size:.9rem}
.rc-bar{height:8px;border-radius:5px;background:#ffffff14;overflow:hidden;margin-top:6px}.rc-bar i{display:block;height:100%;border-radius:5px}
.rc-gauge{position:relative;height:14px;border-radius:8px;margin:14px 0 6px;background:linear-gradient(90deg,#22c55e 0 33%,#eab308 33% 60%,#ef4444 60%)}
.rc-gauge span{position:absolute;top:-6px;width:8px;height:26px;border-radius:4px;background:#fff;box-shadow:0 0 0 2px #000}
.rc-sig{display:flex;gap:10px;align-items:flex-start;border-top:1px solid var(--line);padding:9px 0}.rc-sig:first-of-type{border-top:0}
.rc-dot{flex:none;width:12px;height:12px;border-radius:50%;margin-top:7px;background:#3a3a36}.rc-dot.on{background:#f97316;box-shadow:0 0 10px #f97316}
.rc-pill{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:1px 9px;font-size:.75rem;color:var(--mute);margin:2px}
.rc-hash{font-family:'Space Grotesk',monospace;font-size:.72rem;word-break:break-all;color:#cfcfc8;direction:ltr;unicode-bidi:isolate}
.rc-ok{color:#4ade80}.rc-bad{color:#f87171}
.rc-btn2{display:inline-flex;gap:6px;align-items:center;background:none;color:var(--ink);border:1px solid var(--line);border-radius:99px;padding:6px 13px;font:inherit;cursor:pointer;font-size:.85rem}
.rc-btn2:hover{border-color:var(--acc)}
.rc-flt{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.rc-flt select{background:#000;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font:inherit;font-size:.85rem}
.rc-code{background:#000;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:.95rem;direction:rtl;unicode-bidi:plaintext}
@media(max-width:640px){.rc-big{font-size:1.6rem}.rc-chart{height:220px}}
"""

LANG_JS = r"""(function(){var K='ck_lang',L;try{L=localStorage.getItem(K)}catch(e){}if(['fa','ckb','en'].indexOf(L)<0)L='fa';window.I18N=1;
function ap(l){L=l;try{localStorage.setItem(K,l)}catch(e){}var de=document.documentElement;de.lang=l;de.dir=l==='en'?'ltr':'rtl';
document.querySelectorAll('[data-rl]').forEach(function(x){x.hidden=x.getAttribute('data-rl')!==l});
document.querySelectorAll('.ek-i').forEach(function(x){var v=x.getAttribute('data-'+l);if(v!=null&&x.textContent!==v)x.textContent=v});
document.querySelectorAll('#langs button,.ek-lang button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-l')===l)});
var blk=document.querySelector('[data-rl="'+l+'"]');if(blk)blk.querySelectorAll('.rc-slot[data-c]').forEach(function(s){var c=document.getElementById(s.getAttribute('data-c'));if(c&&c.parentNode!==s)s.appendChild(c)});
window.dispatchEvent(new CustomEvent('ek-lang',{detail:l}))}
window.EKL=function(){return L};
document.addEventListener('click',function(ev){var b=ev.target.closest&&ev.target.closest('#langs button[data-l],.ek-lang button[data-l]');if(b){ev.preventDefault();ev.stopPropagation();ap(b.getAttribute('data-l'))}},true);
ap(L)})();"""

MULTI_JS = r"""function rcMulti(id,series,opt){var el=document.getElementById(id);if(!el||!window.LightweightCharts)return;opt=opt||{};
var c=LightweightCharts.createChart(el,{height:opt.h||260,layout:{background:{color:'transparent'},textColor:'#9a9a94',fontFamily:'Vazirmatn'},
grid:{vertLines:{color:'rgba(255,255,255,.05)'},horzLines:{color:'rgba(255,255,255,.05)'}},rightPriceScale:{borderVisible:false},
timeScale:{borderVisible:false,timeVisible:!!opt.time},handleScroll:false,handleScale:false,localization:{priceFormatter:function(v){return v.toFixed(opt.dec==null?2:opt.dec)}}});
series.forEach(function(s){if(!s.data||!s.data.length)return;var x=c.addLineSeries({color:s.color,lineWidth:s.w||2,priceLineVisible:false,lastValueVisible:false});
x.setData(s.data);if(s.zero)x.createPriceLine({price:0,color:'rgba(255,255,255,.35)',lineWidth:1,lineStyle:2});
(s.lines||[]).forEach(function(p){x.createPriceLine({price:p.v,color:p.c||'rgba(255,255,255,.3)',lineWidth:1,lineStyle:2,title:p.t||''})})});
c.timeScale().fitContent();new ResizeObserver(function(){if(el.clientWidth)c.applyOptions({width:el.clientWidth})}).observe(el)}"""


def finish(pool, body, charts_js=""):
    """pool: chart containers (moved into the visible language block); body: the three language blocks"""
    out = (f"<div hidden id='rc-pool'>{pool}</div>" if pool else "") + body + f"<script>{LANG_JS}</script>"
    if charts_js:
        out += BP.LWC + f"<script>{MULTI_JS}\ndocument.addEventListener('DOMContentLoaded',function(){{{charts_js}}});</script>"
    return out


def write(path, title, desc, body, ld=None):
    extra = f"<style>{RCSS}</style>"
    if ld:
        extra += f"<script type='application/ld+json'>{BP.sj(ld)}</script>"
    return BP.page(path, title, desc, body, extra)


def pts(rows, key="time"):
    return BP.sj([{key: d, "value": v} for d, v in rows])


# ================================================================== 1. ledger
def src_name(led, src, lg):
    meta = (led.get("sources") or {}).get(src) or {}
    return (meta.get("name") or {}).get(lg) or (meta.get("name") or {}).get("fa") or src


def chart_id(src):
    return "lc-" + re.sub(r"[^a-z0-9]", "-", src.lower())


def ledger_row(x, led, res, live, lg):
    r = res.get(x["id"])
    if r:
        cls = "up" if r["outcome"] == "win" else "down" if r["outcome"] == "loss" else "mut"
        ex = s("exit." + (r.get("exit") or "horizon"), lg)
        status = f"<span class='{cls}'><b>{e(s('out.' + r['outcome'], lg))}</b></span><br><small class='mut'>{nf(r['r'], lg, 2, True, True)} · {e(ex)}</small>"
    else:
        end = R.parse_iso(x["t0"]) + timedelta(hours=float(x["h"]))
        left = max(0, int((end - R.now()).total_seconds() // 3600))
        lv = live.get(x["id"])
        status = f"<span class='mut'>{s('lg.open', lg, n=hours_txt(left, lg))}</span>"
        if lv is not None:
            good = lv * (1 if x["call"] == "up" else -1) > 0
            status += f"<br><small class='{'up' if good else 'down'}'>{nf(lv, lg, 2, True, True)}</small>"
    lv_txt = " · ".join(t for t in (
        f"{s('lg.target', lg)} {money(x['target'], lg)}" if x.get("target") else "",
        f"{s('lg.stop', lg)} {money(x['stop'], lg)}" if x.get("stop") else "") if t)
    note = f"<br><small class='mut'>{e(x['note'])}</small>" if x.get("note") else ""
    ref = BP.su(x.get("ref"))
    ref_a = f"<a href='{e(ref)}'>↗</a> " if ref != "#" else ""
    lvs = f"<br><small class='mut'>{lv_txt}</small>" if lv_txt else ""
    return (f"<tr data-s='{e(x['src'])}' data-c='{e(x['coin'])}'><td>{nf(x['seq'], lg)}</td><td class='wrap'>{e(src_name(led, x['src'], lg))}{note}</td>"
            f"<td><b>{e(x['coin'])}</b></td><td>{e(s('call.' + x['call'], lg))}<br><small class='mut'>{hours_txt(x['h'], lg)}</small></td>"
            f"<td><span class='rc-num'>{money(x['p0'], lg)}</span>{lvs}</td><td>{fdate(x['t0'], lg, True)}</td><td>{status}</td>"
            f"<td>{ref_a}<span class='rc-hash' title='{e(x['hash'])}'>{e(x['hash'][:8])}…</span></td></tr>")


def build_ledger():
    led = R.load("ledger.json", {})
    entries, res, live = led.get("entries", []), led.get("results", {}), led.get("live", {})
    st, board, integ, anchors = led.get("stats", {}), led.get("board", []), led.get("integrity", {}), led.get("anchors", [])
    srcs = sorted({x["src"] for x in entries})
    coins = sorted({x["coin"] for x in entries})

    def b(lg):
        h = head(lg, "lg.title", "lg.desc")
        if entries:
            ok = integ.get("ok")
            stt = s("lg.ok", lg, n=nf(integ.get("checked"), lg)) if ok else s("lg.bad", lg, n=nf(integ.get("bad_seq"), lg))
            a_html = ""
            last = anchors[-1] if anchors else None
            if last:
                if last.get("status") == "bitcoin":
                    a_st = s("lg.ots_btc", lg, n=nf(last.get("block"), lg))
                elif last.get("status") == "pending":
                    a_st = s("lg.ots_wait", lg)
                else:
                    a_st = s("lg.ots_fail", lg)
                links = f"<a href='{e(last['file'])}'>.txt</a>"
                if last.get("ots"):
                    links += f" · <a href='{e(last['ots'])}' download>.ots</a>"
                a_html = f"<p><b>{s('lg.ots', lg)}</b>: {fdate(last['date'], lg)} — {e(a_st)} · {links}</p>"
            h += (f"<div class='rc-card'><p class='{'rc-ok' if ok else 'rc-bad'}'><b>{e(stt)}</b></p>"
                  f"<p>{s('lg.head', lg)}: <span class='rc-hash'>{e(led.get('head') or '')}</span></p>{a_html}"
                  f"<p><button class='rc-btn2 rc-verify' type='button'>🔍 {s('lg.verify', lg)}</button> <span class='rc-vout'></span></p></div>")
        th = cols("lg.th", lg)
        rows = []
        for i, src in enumerate(board, 1):
            x = st[src]
            edge_cls = "up" if (x.get("edge") or 0) > 0 else "down"
            rows.append(f"<tr><td>{nf(i, lg)}</td><td class='wrap'><a href='#src-{e(src)}'>{e(src_name(led, src, lg))}</a></td>"
                        f"<td>{nf(x['win'] + x['loss'], lg)}</td><td><b>{nf(x['acc'], lg, 1, pct=True)}</b></td><td>{nf(x['wlb'], lg, 1, pct=True)}</td>"
                        f"<td>{nf(x.get('acc20'), lg, 1, pct=True)}</td><td class='{edge_cls}'>{nf(x.get('edge'), lg, 2, True, True)}</td><td>{nf(x['open'], lg)}</td></tr>")
        inner = table(th, rows) if rows else ""
        coll = [x for x in st if x not in board]
        if coll:
            items = "، ".join(f"<a href='#src-{e(x)}'>{e(src_name(led, x, lg))}</a> ({nf(st[x]['n'], lg)})" for x in coll)
            inner += f"<p class='note'>{s('lg.collecting', lg)}: {items}</p>"
        h += sec(s("lg.board", lg), inner or f"<p class='note'>{s('nodata', lg)}</p>", "board", s("lg.board_lead", lg))
        prof = []
        for src in sorted(st, key=lambda k: -st[k]["n"]):
            x = st[src]
            desc = ((led.get("sources") or {}).get(src) or {}).get("desc") or {}
            pills = " ".join(f"<span class='rc-pill'>{e(c)} {nf(n, lg)}</span>" for c, n in (x.get("coins") or {}).items())
            chart = slot(chart_id(src)) if len(x.get("curve") or []) >= 2 else ""
            prof.append(f"<div class='rc-card' id='src-{e(src)}'><h3>{e(src_name(led, src, lg))}</h3><p class='mut'>{e(desc.get(lg) or desc.get('fa') or '')}</p>"
                        f"<div class='rc-kpis'><div class='rc-kpi'><small>{th[3]}</small><b>{nf(x['acc'], lg, 1, pct=True)}</b></div>"
                        f"<div class='rc-kpi'><small>{s('lg.rwn', lg)}</small><b>{nf(x['win'], lg)} / {nf(x['loss'], lg)} / {nf(x['flat'], lg)}</b></div>"
                        f"<div class='rc-kpi'><small>{th[7]}</small><b>{nf(x['open'], lg)}</b></div></div>{chart}<p>{pills}</p></div>")
        h += sec(s("lg.profiles", lg), f"<div class='rc-grid'>{''.join(prof)}</div>" if prof else f"<p class='note'>{s('nodata', lg)}</p>", "profiles")
        o_src = "".join(f"<option value='{e(x)}'>{e(src_name(led, x, lg))}</option>" for x in srcs)
        o_coin = "".join(f"<option value='{e(x)}'>{e(x)}</option>" for x in coins)
        flt = (f"<div class='rc-flt'><select class='rc-fs'><option value=''>{s('all', lg)} — {s('source', lg)}</option>{o_src}</select>"
               f"<select class='rc-fc'><option value=''>{s('all', lg)} — {s('coin', lg)}</option>{o_coin}</select></div>")
        trs = [ledger_row(x, led, res, live, lg) for x in reversed(entries[-300:])]
        recent = flt + table(cols("lg.th2", lg), trs, "rc-sigs") if trs else f"<p class='note'>{s('nodata', lg)}</p>"
        recent += f"<p class='note'><a href='/data/ledger.json'>ledger.json</a> — {s('lg.json', lg)}</p>"
        h += sec(s("lg.recent", lg), recent, "recent")
        h += sec(s("lg.how", lg), f"<p>{e(s('lg.how1', lg))}</p><p class='rc-code'>#قفل BTC صعودی ۷ روز هدف ۸۵۰۰۰ حد ضرر ۷۲۰۰۰</p><p class='note'>{e(s('lg.how2', lg))}</p>", "how")
        h += meth("ledger", lg) + updated(lg, led.get("updated_at"))
        return h

    curves = {chart_id(src): [{"time": d, "value": a} for d, a, _ in x["curve"]] for src, x in st.items() if len(x.get("curve") or []) >= 2}
    pool = "".join(f"<div id='{cid}' class='rc-chart' style='height:160px'></div>" for cid in curves)
    js = "".join(f"rcMulti('{cid}',[{{data:{BP.sj(rows)},color:'#f7931a',lines:[{{v:50,t:'50%'}}]}}],{{h:160,dec:0}});" for cid, rows in curves.items())
    js += r"""
function canon(o){return '{'+Object.keys(o).sort().map(function(k){return JSON.stringify(k)+':'+JSON.stringify(o[k])}).join(',')+'}'}
async function sha(t){var b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')}
document.addEventListener('click',async function(ev){var b=ev.target.closest&&ev.target.closest('.rc-verify');if(!b)return;var out=b.parentNode.querySelector('.rc-vout'),l=(window.EKL&&EKL())||'fa';
var T={fa:['در حال بررسی…','✓ همهٔ ',' ردیف دوباره هش شد؛ زنجیره سالم است و سرِ زنجیره: ','✗ ناهماهنگی در ردیف '],ckb:['پشکنین…','✓ هەموو ',' ڕیز دووبارە هاش کران؛ زنجیرەکە ساغە و سەری زنجیرە: ','✗ ناتەبایی لە ڕیزی '],en:['Checking…','✓ All ',' rows re-hashed; the chain is intact. Head: ','✗ Mismatch at row ']}[l];
out.className='rc-vout';out.textContent=T[0];try{var r=await fetch('/data/ledger.json',{cache:'no-store'});var j=await r.json(),prev='0'.repeat(64),es=j.entries||[];
for(var i=0;i<es.length;i++){var x=Object.assign({},es[i]),h=x.hash;delete x.hash;if(x.prev!==prev||await sha(canon(x))!==h){out.textContent=T[3]+(i+1);out.className='rc-vout rc-bad';return}prev=h}
out.textContent=T[1]+es.length+T[2]+prev.slice(0,16)+'…';out.className='rc-vout rc-ok'}catch(err){out.textContent='✗ '+err;out.className='rc-vout rc-bad'}});
document.querySelectorAll('[data-rl]').forEach(function(blk){var fs=blk.querySelector('.rc-fs'),fc=blk.querySelector('.rc-fc');if(!fs||!fc)return;
function ap(){blk.querySelectorAll('tr[data-s]').forEach(function(tr){tr.hidden=(fs.value&&tr.getAttribute('data-s')!==fs.value)||(fc.value&&tr.getAttribute('data-c')!==fc.value)})}
fs.onchange=ap;fc.onchange=ap;if(location.hash.indexOf('#coin=')===0){fc.value=decodeURIComponent(location.hash.slice(6));ap()}});"""
    ld = {"@context": "https://schema.org", "@type": "Dataset", "name": "Entekhab time-locked signal ledger", "url": f"{BP.SITE}/ledger/",
          "description": S["lg.desc"]["en"], "creator": {"@type": "Organization", "name": "entekhab.net"},
          "distribution": [{"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": f"{BP.SITE}/data/ledger.json"}]}
    return [write("ledger/", s("lg.title", "fa"), s("lg.desc", "fa"), finish(pool, tri(b), js), ld)]


# ================================================================== 2. friction
def build_friction():
    f = R.load("friction.json", {})
    ser = R.load("iran_daily.json", {}).get("series", {})
    score, lvl = f.get("score"), f.get("level")
    comps = {c["id"]: c for c in f.get("components", [])}
    pr, paper = f.get("prices") or {}, f.get("paper") or {}
    usd, usdt = ser.get("USD", {}), ser.get("USDT", {})
    gap_hist = [(d, round((usdt[d] / usd[d] - 1) * 100, 3)) for d in sorted(usd) if d in usdt and usd[d]][-400:]
    s_hist = [(int(R.parse_iso(x[0]).timestamp()), x[1]) for x in f.get("history", []) if x[1] is not None]

    def comp_card(cid, lg):
        c = comps.get(cid) or {}
        v, sc = c.get("value"), c.get("score")
        if cid in ("c1", "c2"):
            vt = nf(v, lg, 2, cid == "c1", True)
        elif cid == "c3":
            v = v or {}
            vt = "—"
            if v.get("ping") is not None or v.get("bgp") is not None:
                ping = None if v.get("ping") is None else v["ping"] * 100
                bgp = None if v.get("bgp") is None else v["bgp"] * 100
                vt = f"ping {nf(ping, lg, 0, pct=True)} · BGP {nf(bgp, lg, 0, pct=True)}"
        else:
            vt = s("fr.headlines", lg, n=nf(v, lg)) if v is not None else "—"
        col = "#22c55e" if (sc or 0) < 33 else "#eab308" if (sc or 0) < 60 else "#ef4444"
        w = nf((c.get("w") or 0) * 100, lg, 0, pct=True)
        return (f"<div class='rc-card'><h3>{e(s(cid + '.t', lg))} <span class='mut'>· {w}</span></h3>"
                f"<p><span class='rc-big' style='font-size:1.4rem;color:{col}'>{nf(sc, lg, 0)}</span> <span class='mut'>/ {nf(100, lg)}</span> · <b class='rc-num'>{vt}</b></p>"
                f"<div class='rc-bar'><i style='width:{(sc or 0):.0f}%;background:{col}'></i></div><p class='mut' style='font-size:.82rem'>{e(s(cid + '.d', lg))}</p></div>")

    def b(lg):
        h = head(lg, "fr.title", "fr.desc")
        if score is None:
            return h + updated(lg, None)
        h += (f"<div class='rc-card'><div style='display:flex;gap:14px;align-items:center;flex-wrap:wrap'><span class='rc-big' style='color:{COLORS[lvl]}'>{nf(score, lg, 0)}</span>"
              f"<span>/ {nf(100, lg)}</span>{badge(lvl, s('lvl.' + lvl, lg))}</div>"
              f"<div class='rc-gauge' dir='ltr'><span style='left:calc({score:.0f}% - 4px)'></span></div><p class='note'>{s('fr.scale', lg)}</p></div>")
        miss = any((comps.get(c) or {}).get("score") is None for c in ("c1", "c2", "c3", "c4"))
        h += sec(s("fr.comps", lg), "<div class='rc-grid'>" + "".join(comp_card(c, lg) for c in ("c1", "c2", "c3", "c4")) + "</div>"
                 + (f"<p class='note'>{s('fr.missing', lg)}</p>" if miss else ""), "components")
        if paper.get("btc_paper"):
            k = cols("fr.k", lg)
            c1000 = paper.get("cost_1000") or {}
            gap = paper.get("gap_pct")
            tm = s("toman", lg)
            h += sec(s("fr.paper", lg),
                     f"<div class='rc-kpis'><div class='rc-kpi'><small>{k[0]}</small><b>{nf(paper['btc_paper'], lg)}</b> <small>{tm}</small></div>"
                     f"<div class='rc-kpi'><small>{k[1]}</small><b>{nf(paper.get('btc_iran'), lg)}</b> <small>{tm}</small></div>"
                     f"<div class='rc-kpi'><small>{k[2]}</small><b class='{'down' if (gap or 0) > 0 else 'up'}'>{nf(gap, lg, 2, True, True)}</b></div>"
                     f"<div class='rc-kpi'><small>{k[3]}</small><b>{nf(c1000.get('via_usdt'), lg)}</b> <small>{tm}</small></div>"
                     f"<div class='rc-kpi'><small>{k[4]}</small><b>{nf(c1000.get('via_usd'), lg)}</b> <small>{tm}</small></div></div>", "paper")
        ch = ""
        if len(gap_hist) >= 5:
            ch += f"<h3>{s('fr.gap_h', lg)}</h3>" + slot("fr-gap")
        if len(s_hist) >= 3:
            ch += f"<h3>{s('fr.score_h', lg)}</h3>" + slot("fr-score")
        if ch:
            h += sec(s("fr.time", lg), ch, "history")
        ex = f.get("exchanges", [])
        if ex:
            rows = []
            for x in ex:
                name = x["latin"] if lg == "en" else x["name"]
                flag = s("fr.sanc", lg) if x.get("sanctioned") else ""
                rows.append(f"<tr><td>{e(name)}</td><td class='rc-num'>{nf(x['buy'], lg)}</td><td class='rc-num'>{nf(x['sell'], lg)}</td>"
                            f"<td>{nf(x.get('spread_pct'), lg, 2, pct=True)}</td><td>{flag}</td></tr>")
            h += sec(s("fr.board", lg), table(cols("fr.th", lg), rows) + f"<p class='note'>{s('fr.sanc_note', lg)} {fdate(pr.get('board_time'), lg, True)}</p>", "board")
        news = f.get("news", [])
        if news:
            lis = "".join(f"<li><a href='{e(BP.su(x.get('url')))}' rel='noopener noreferrer' target='_blank' lang='fa' dir='rtl'>{e(x['title'])}</a> "
                          f"<small class='mut'>— {e(x.get('source') or '')}</small></li>" for x in news)
            h += sec(s("fr.news", lg), f"<ul class='txt'>{lis}</ul>", "news")
        return h + meth("friction", lg) + updated(lg, f.get("updated_at"))

    pool, js = "", ""
    if len(gap_hist) >= 5:
        pool += "<div id='fr-gap' class='rc-chart' style='height:240px'></div>"
        js += f"rcMulti('fr-gap',[{{data:{pts(gap_hist)},color:'#f7931a',zero:true}}],{{h:240,dec:2}});"
    if len(s_hist) >= 3:
        pool += "<div id='fr-score' class='rc-chart' style='height:220px'></div>"
        js += f"rcMulti('fr-score',[{{data:{pts(s_hist)},color:'#eab308',lines:[{{v:33,c:'#22c55e'}},{{v:60,c:'#ef4444'}}]}}],{{h:220,dec:0,time:true}});"
    return [write("iran-friction/", s("fr.title", "fa"), s("fr.desc", "fa"), finish(pool, tri(b), js))]


# ================================================================== 3. hype
HST = {"rising": "orange", "peak": "red", "cooling": "yellow", "fading": "yellow", "quiet": "none"}


def episode_li(ep, lg):
    alive = badge("orange" if ep["alive"] else "none", s("hy.alive" if ep["alive"] else "hy.ended", lg))
    src = s("hy.src_ch" if ep["src"] == "channel" else "hy.src_gl", lg)
    cls = "up" if (ep.get("impact") or 0) >= 0 else "down"
    exc = f" ({nf(ep['excess'], lg, 1, True, True)} vs BTC)" if ep.get("excess") is not None else ""
    line = s("hy.ep", lg, start=fdate(ep["start"], lg), peak=fdate(ep["peak"], lg), half=nf(ep.get("half_d"), lg, 1), life=nf(ep.get("life_d"), lg, 1),
             imp=f"<span class='{cls}'>{nf(ep.get('impact'), lg, 1, True, True)}</span>", exc=exc, q=f"<b>{nf(ep.get('quality'), lg)}</b>")
    return f"<li>{alive} <small class='mut'>{src}</small> · {line}</li>"


def build_hype():
    hy = R.load("hype.json", {})
    nar = hy.get("narratives", [])
    cov = hy.get("coverage") or {}

    def b(lg):
        h = head(lg, "hy.title", "hy.desc")
        if not nar:
            return h + updated(lg, None)
        ex = next((x for x in sorted(nar, key=lambda x: (x.get("last") or {}).get("start") or "", reverse=True)
                   if x.get("last") and x["last"].get("half_d") is not None and x["last"].get("impact") is not None), None)
        if ex:
            l_ = ex["last"]
            cls = "up" if l_["impact"] >= 0 else "down"
            line = s("hy.ex_line", lg, name=e(ex["name"].get(lg) or ex["name"]["fa"]), half=f"<b>{nf(l_['half_d'], lg, 1)}</b>",
                     imp=f"<b class='{cls}'>{nf(l_['impact'], lg, 1, True, True)}</b>", q=f"<b>{nf(l_.get('quality'), lg)}</b>")
            h += f"<div class='rc-card'><p class='mut'>{s('hy.example', lg)}</p><p style='font-size:1.05rem'>{line}</p></div>"
        rows = []
        for x in sorted(nar, key=lambda x: (x.get("quality") is None, -(x.get("quality") or 0))):
            stt = x["now"]["channel"]["state"]
            g24 = x["now"]["global"].get("mentions_24h")
            gtxt = f"<br><small class='mut'>{s('hy.global24', lg, n=nf(g24, lg))}</small>" if g24 is not None else ""
            q = x.get("quality")
            qc = "#22c55e" if (q or 0) >= 60 else "#ef4444" if (q is not None and q < 40) else "#eab308"
            last = x.get("last") or {}
            icls = "up" if (last.get("impact") or 0) >= 0 else "down"
            rows.append(f"<tr><td class='wrap'><a href='#n-{e(x['id'])}'><b>{e(x['name'].get(lg) or x['name']['fa'])}</b></a></td>"
                        f"<td>{badge(HST.get(stt, 'none'), s('st.' + stt, lg))}{gtxt}</td><td>{nf(x.get('median_half'), lg, 1)}</td><td>{nf(x.get('median_life'), lg, 1)}</td>"
                        f"<td><b style='color:{qc}'>{nf(q, lg)}</b></td><td class='{icls}'>{nf(last.get('impact'), lg, 1, True, True)}</td><td>{fdate(last.get('start'), lg)}</td></tr>")
        h += sec(s("hy.table", lg), table(cols("hy.th", lg), rows) + f"<p class='note'>{s('hy.qnote', lg)}</p>", "table")
        cards = []
        for x in nar:
            eps = x.get("episodes") or []
            stt = x["now"]["channel"]["state"]
            pills = " ".join(f"<span class='rc-pill'>{e(c)}</span>" for c in x.get("coins", [])[:8]) or f"<span class='rc-pill'>{s('hy.market', lg)}</span>"
            chart = ""
            if (x.get("series") or {}).get("channel"):
                chart = (slot(f"hy-{x['id']}") + f"<div class='rc-legend'><span><i style='background:#f7931a'></i>{s('hy.leg_ch', lg)}</span>"
                         f"<span><i style='background:#60a5fa'></i>{s('hy.leg_gl', lg)}</span></div>")
            lis = "".join(episode_li(ep, lg) for ep in eps[:6])
            body = f"<ul class='txt' style='font-size:.85rem'>{lis}</ul>" if lis else f"<p class='note'>{s('hy.none', lg)}</p>"
            cards.append(f"<div class='rc-card' id='n-{e(x['id'])}'><h3>{e(x['name'].get(lg) or x['name']['fa'])} {badge(HST.get(stt, 'none'), s('st.' + stt, lg))}</h3>"
                         f"<p>{pills}</p>{chart}{body}</div>")
        h += sec(s("hy.cards", lg), f"<div class='rc-grid'>{''.join(cards)}</div>", "cards")
        h += f"<p class='note'>{s('hy.cov', lg, ch=fdate(cov.get('channel_from'), lg), n=nf(cov.get('channel_posts'), lg), gl=fdate(cov.get('global_from'), lg))}</p>"
        return h + meth("hype", lg) + updated(lg, hy.get("updated_at"))

    pool, js = "", ""
    for x in nar:
        ch = (x.get("series") or {}).get("channel") or []
        if not ch:
            continue
        gl = [(d, round(v / 10, 1)) for d, v in (x.get("series") or {}).get("global") or []]
        cid = f"hy-{x['id']}"
        pool += f"<div id='{cid}' class='rc-chart' style='height:150px'></div>"
        js += f"rcMulti('{cid}',[{{data:{pts(ch)},color:'#f7931a'}},{{data:{pts(gl)},color:'#60a5fa'}}],{{h:150,dec:0}});"
    return [write("hype/", s("hy.title", "fa"), s("hy.desc", "fa"), finish(pool, tri(b), js))]


# ================================================================== 4. silent exit
def signal_html(sg, lg):
    if sg["id"] == "A1":
        val = f"${nf((sg.get('value') or 0) / 1e6, lg, 0, True)}M"
    else:
        val = nf(sg.get("value"), lg, 3 if sg["id"] == "A3" else 2, True, True)
    pct = (" · " + s("se.pct", lg, n=nf(sg["pct"], lg))) if sg.get("pct") is not None else f" · <span class='mut'>{s('se.nohist', lg)}</span>"
    on = " on" if sg.get("on") else ""
    return (f"<div class='rc-sig'><span class='rc-dot{on}'></span><div><b>{e(s(sg['id'] + '.t', lg))}</b><br>"
            f"<small class='mut'>{e(s(sg['id'] + '.d', lg))}</small><br><span class='rc-num'>{val}</span>{pct}</div></div>")


def build_silent():
    se = R.load("silent_exit.json", {})
    assets, bt = se.get("assets") or {}, se.get("backtest") or {}

    def asset_card(c, a, lg):
        lv = a.get("level", "none")
        sigs = "".join(signal_html(sg, lg) for sg in sorted(a.get("signals", []), key=lambda x: x["id"]))
        t = a.get("talk") or {}
        cm = s("cm." + t["council"], lg) if t.get("council") in ("up", "down", "flat") else "—"
        talk = s("se.talk", lg, fng=nf(t.get("fng"), lg), fp=nf(t.get("funding_pct"), lg), sent=nf(t.get("sentiment"), lg, 0, True), cm=cm)
        gate = (f"<p class='{'rc-ok' if t.get('ok') else 'mut'}'>{s('se.gate_ok' if t.get('ok') else 'se.gate_no', lg)} ({nf(t.get('gate'), lg, 2)})</p>")
        w = a.get("whale") or {}
        whale = s("se.whale", lg, i=nf((w.get("in72") or 0) / 1e6, lg), o=nf((w.get("out72") or 0) / 1e6, lg), oi=nf(a.get("oi_chg72"), lg, 1, True, True))
        score = s("se.score", lg, s=f"<b class='rc-num'>{nf(a.get('score'), lg, 2)}</b>", p=money(a.get("price"), "en"), ch=nf(a.get("chg72"), lg, 1, True, True))
        return (f"<div class='rc-card'><h3>{c} {badge(lv, s('sl.' + lv, lg))}</h3><p>{score}</p>{sigs}<p>{talk}</p>{gate}"
                f"<p class='mut' style='font-size:.85rem'>{whale}</p></div>")

    def b(lg):
        h = head(lg, "se.title", "se.desc")
        if not assets:
            return h + updated(lg, None)
        h += sec(s("se.now", lg), "<div class='rc-grid'>" + "".join(asset_card(c, assets[c], lg) for c in ("BTC", "ETH") if c in assets) + "</div>", "now")
        rows = []
        for c in ("BTC", "ETH"):
            x = bt.get(c) or {}
            for lvl in ("red", "orange"):
                y = x.get(lvl) or {}
                rows.append(f"<tr><td>{c}</td><td>{badge(lvl, s('sl.' + lvl, lg))}</td><td>{nf(y.get('n'), lg)}</td><td><b>{nf(y.get('hit'), lg, 0, pct=True)}</b></td>"
                            f"<td>{nf((x.get('base') or {}).get('p_drop'), lg, 0, pct=True)}</td><td>{nf(y.get('avg7'), lg, 2, True, True)}</td>"
                            f"<td>{nf(y.get('dd5'), lg, 0, pct=True)}</td></tr>")
        recent = []
        for c in ("BTC", "ETH"):
            for r in ((bt.get(c) or {}).get("recent") or [])[:6]:
                cls = "up" if r["fwd"] >= 0 else "down"
                recent.append(f"<li>{c} · {fdate(r['d'], lg)} · {badge(r['lv'], s('sl.' + r['lv'], lg))} · {' '.join(r.get('sig', []))} → "
                              f"<span class='{cls}'>{nf(r['fwd'], lg, 1, True, True)}</span></li>")
        frm = (bt.get("BTC") or {}).get("from")
        note = s("se.bt_note", lg) + (f" · {fdate(frm, lg)} →" if frm else "")
        inner = table(cols("se.bt_th", lg), rows) + f"<p class='note'>{note}</p>"
        if recent:
            inner += f"<ul class='txt' style='font-size:.85rem'>{''.join(recent)}</ul>"
        h += sec(s("se.bt", lg), inner, "backtest")
        alerts = list(reversed(se.get("alerts", [])))[:20]
        if alerts:
            lis = "".join(f"<li>{fdate(x['t'], lg, True)} · <b>{e(x['coin'])}</b> {badge(x['level'], s('sl.' + x['level'], lg))} · ${money(x['p0'], 'en')} · "
                          f"{' '.join(x.get('signals', []))} · <a href='/ledger/#coin={e(x['coin'])}'>{s('se.locked', lg)}</a></li>" for x in alerts)
            h += sec(s("se.live", lg), f"<ul class='txt'>{lis}</ul>", "alerts")
        if se.get("history"):
            h += sec(s("se.hist", lg), slot("se-hist") + "<div class='rc-legend'><span><i style='background:#f7931a'></i>BTC</span><span><i style='background:#818cf8'></i>ETH</span></div>", "history")
        return h + meth("silent", lg) + updated(lg, se.get("updated_at"))

    pool, js = "", ""
    hist = se.get("history", [])
    if hist:
        ser = {c: [(int(R.parse_iso(t).timestamp()), sc) for t, cc, _, sc in hist if cc == c] for c in ("BTC", "ETH")}
        pool = "<div id='se-hist' class='rc-chart' style='height:220px'></div>"
        js = (f"rcMulti('se-hist',[{{data:{pts(ser['BTC'])},color:'#f7931a',lines:[{{v:1,c:'#f97316'}},{{v:2,c:'#ef4444'}}]}},"
              f"{{data:{pts(ser['ETH'])},color:'#818cf8'}}],{{h:220,dec:1,time:true}});")
    return [write("silent-exit/", s("se.title", "fa"), s("se.desc", "fa"), finish(pool, tri(b), js))]


# ================================================================== 5. local correlation
WINS = ["7d", "30d", "90d", "180d", "365d"]
CC = {"USD": "#22c55e", "USDT": "#14b8a6", "BTC_T": "#f7931a", "ETH_T": "#818cf8", "BTC_USD": "#fbbf24", "GOLD18": "#eab308", "COIN": "#a3a3a3", "XAU_USD": "#c084fc"}


def heat(r):
    if r is None:
        return "background:#ffffff08;color:#6b6b66"
    a = min(1.0, abs(r))
    rgb = "34,197,94" if r >= 0 else "239,68,68"
    return f"background:rgba({rgb},{0.12 + 0.6 * a:.2f});color:{'#fff' if a > .45 else '#e5e5e0'}"


def build_corr():
    c = R.load("localcorr.json", {})
    names, present, wins = c.get("names") or {}, c.get("present") or [], c.get("windows") or {}

    def nm(a, lg):
        return (names.get(a) or {}).get(lg) or a

    def matrix_html(w, lg):
        m, n = wins[w]["matrix"], wins[w]["n"]
        hd = "".join(f"<th>{e(nm(a, lg))}</th>" for a in present)
        trs = ""
        for a in present:
            tds = ""
            for b_ in present:
                if a == b_:
                    tds += f"<td style='{heat(None)}'>—</td>"
                    continue
                r = (m.get(a) or {}).get(b_)
                tip = s("co.n", lg, n=nf((n.get(a) or {}).get(b_), lg))
                tds += f"<td style='{heat(r)}' title='{e(tip)}'>{nf(r, lg, 2)}</td>"
            trs += f"<tr><th>{e(nm(a, lg))}</th>{tds}</tr>"
        hidden = "" if w == "90d" else " hidden"
        return (f"<div class='rc-mat' data-w='{w}'{hidden}><div class='rc-tbl'><table class='rc-heat'><tr><th></th>{hd}</tr>{trs}</table></div>"
                f"<p class='note'>{fdate(wins[w]['from'], lg)} → {fdate(wins[w]['to'], lg)}</p></div>")

    def b(lg):
        h = head(lg, "co.title", "co.desc")
        if len(present) < 2:
            return h + updated(lg, None)
        cards = []
        dc = (c.get("decomp") or {}).get("90d") or (c.get("decomp") or {}).get("30d")
        if dc:
            cards.append(f"<div class='rc-card'><h3>{s('co.src', lg)}</h3><p>{s('co.src_line', lg, b='<b>' + nf(dc['btc'], lg, 0, pct=True) + '</b>', t='<b>' + nf(dc['toman'], lg, 0, pct=True) + '</b>')}</p>"
                         f"<div class='rc-bar' dir='ltr'><i style='width:{max(0, min(100, dc['btc'])):.0f}%;background:#f7931a'></i></div>"
                         f"<p class='mut'>{s('co.vol', lg, b=nf(dc['vol_btc_t'], lg, 0, pct=True), t=nf(dc['vol_usdt'], lg, 0, pct=True))}</p></div>")
        hv = c.get("haven") or {}
        if hv.get("n"):
            lis = "".join("<li>" + s("co.haven_row", lg, a=e(nm(a, lg)), avg=f"<b class='{'up' if v['avg'] >= 0 else 'down'}'>{nf(v['avg'], lg, 2, True, True)}</b>",
                                     beat=nf(v["beat_usd"], lg, 0, pct=True)) + "</li>" for a, v in (hv.get("assets") or {}).items())
            cards.append(f"<div class='rc-card'><h3>{s('co.haven', lg)}</h3><p>{s('co.haven_lead', lg, n=nf(hv['n'], lg), avg=nf(hv.get('usd_avg'), lg, 2, True, True))}</p>"
                         f"<ul class='txt' style='font-size:.88rem'>{lis}</ul></div>")
        if cards:
            h += f"<div class='rc-grid'>{''.join(cards)}</div>"
        tabs = "".join(f"<button type='button' data-w='{w}' class='{'on' if w == '90d' else ''}'>{s('w.' + w, lg)}</button>" for w in WINS if w in wins)
        mats = "".join(matrix_html(w, lg) for w in WINS if w in wins)
        h += sec(s("co.matrix", lg), f"<div class='rc-tabs'>{tabs}</div>{mats}<p class='note'>{s('co.mat_note', lg)}</p>", "matrix")
        norm = c.get("norm") or {}
        if norm:
            leg = "".join(f"<span><i style='background:{CC.get(a, '#999')}'></i>{e(nm(a, lg))}</span>" for a in norm)
            h += sec(s("co.co", lg), slot("co-norm") + f"<div class='rc-legend'>{leg}</div>", "co")
        rl = {a: v for a, v in (c.get("rolling") or {}).items() if len(v) >= 3}
        if rl:
            leg = "".join(f"<span><i style='background:{CC.get(a, '#999')}'></i>{e(nm(a, lg))} ~ {e(nm('USD', lg))}</span>" for a in rl)
            h += sec(s("co.roll", lg), slot("co-roll") + f"<div class='rc-legend'>{leg}</div>", "rolling")
        rows = []
        for a in present:
            lv = (c.get("last") or {}).get(a) or {}
            ch = (c.get("changes") or {}).get(a) or {}
            cv = (c.get("coverage") or {}).get(a) or {}
            unit = "$" if a.endswith("_USD") else ""
            chg = "".join(f"<td class='{'up' if (ch.get(k) or 0) >= 0 else 'down'}'>{nf(ch.get(k), lg, 1, True, True)}</td>" for k in ("7d", "30d", "90d", "1y"))
            rows.append(f"<tr><td>{e(nm(a, lg))}</td><td class='rc-num'>{unit}{money(lv.get('v'), lg)}</td>{chg}<td class='mut'>{fdate(cv.get('from'), lg)} ({nf(cv.get('n'), lg)})</td></tr>")
        h += sec(s("co.last", lg), table(cols("co.th", lg), rows), "changes")
        return h + meth("corr", lg) + updated(lg, c.get("updated_at"))

    pool, js = "", ""
    norm = c.get("norm") or {}
    if norm:
        pool += "<div id='co-norm' class='rc-chart' style='height:280px'></div>"
        js += "rcMulti('co-norm',[" + ",".join(f"{{data:{pts(v)},color:'{CC.get(a, '#999')}'}}" for a, v in norm.items()) + "],{h:280,dec:0});"
    rl = {a: v for a, v in (c.get("rolling") or {}).items() if len(v) >= 3}
    if rl:
        pool += "<div id='co-roll' class='rc-chart' style='height:240px'></div>"
        js += "rcMulti('co-roll',[" + ",".join(f"{{data:{pts(v)},color:'{CC.get(a, '#999')}'{',zero:true' if i == 0 else ''}}}" for i, (a, v) in enumerate(rl.items())) + "],{h:240,dec:2});"
    js += ("document.querySelectorAll('[data-rl]').forEach(function(blk){blk.querySelectorAll('.rc-tabs button').forEach(function(b){b.onclick=function(){"
           "var w=b.getAttribute('data-w');blk.querySelectorAll('.rc-tabs button').forEach(function(x){x.classList.toggle('on',x===b)});"
           "blk.querySelectorAll('.rc-mat').forEach(function(m){m.hidden=m.getAttribute('data-w')!==w})}})});")
    return [write("iran-correlation/", s("co.title", "fa"), s("co.desc", "fa"), finish(pool, tri(b), js))]


# ================================================================== hub
def build_hub():
    led, fr, hy, se, lc = (R.load(n, {}) for n in ("ledger.json", "friction.json", "hype.json", "silent_exit.json", "localcorr.json"))

    def b(lg):
        h = f"<div class='meta'><a href='/'>{s('home', lg)}</a> / {e(s('hub', lg))}</div><h1>{e(s('hb.title', lg))}</h1><p class='rc-lead'>{e(s('hb.desc', lg))}</p>"
        cards = []
        bd = led.get("board") or []
        top = (led.get("stats") or {}).get(bd[0]) if bd else None
        kv = f"<span class='rc-big'>{nf(led.get('n'), lg)}</span> <span class='mut'>{s('hb.locked', lg)}</span>"
        if top:
            kv += f"<p>{s('hb.best', lg)}: <b>{e(src_name(led, bd[0], lg))}</b> {nf(top['acc'], lg, 0, pct=True)}</p>"
        cards.append(("/ledger/", "hb.l_t", "hb.l_d", kv))
        sc, lvl = fr.get("score"), fr.get("level")
        kv = (f"<span class='rc-big' style='color:{COLORS.get(lvl, '#999')}'>{nf(sc, lg)}</span> / {nf(100, lg)} {badge(lvl, s('lvl.' + lvl, lg))}"
              if sc is not None and lvl else f"<span class='mut'>{s('nodata', lg)}</span>")
        cards.append(("/iran-friction/", "hb.f_t", "hb.f_d", kv))
        alive = [x for x in hy.get("narratives", []) if x["id"] in (hy.get("alive") or [])]
        kv = " ".join(f"<span class='rc-pill'>{e(x['name'].get(lg) or x['name']['fa'])}</span>" for x in alive[:4]) or f"<span class='mut'>{s('hb.h_none', lg)}</span>"
        cards.append(("/hype/", "hb.h_t", "hb.h_d", kv))
        aa = se.get("assets") or {}
        kv = " ".join(f"<b>{c}</b> {badge(aa[c]['level'], s('sl.' + aa[c]['level'], lg))}" for c in ("BTC", "ETH") if c in aa) or f"<span class='mut'>{s('nodata', lg)}</span>"
        cards.append(("/silent-exit/", "hb.s_t", "hb.s_d", kv))
        r = (((lc.get("windows") or {}).get("90d") or {}).get("matrix") or {}).get("BTC_T", {}).get("USD")
        kv = (f"<span class='mut'>{s('hb.c_k', lg)}</span><br><span class='rc-big'>{nf(r, lg, 2)}</span>" if r is not None else f"<span class='mut'>{s('nodata', lg)}</span>")
        cards.append(("/iran-correlation/", "hb.c_t", "hb.c_d", kv))
        h += "<div class='rc-grid'>" + "".join(f"<a class='rc-card' href='{u}'><h3>{e(s(t, lg))}</h3><p class='mut'>{e(s(d, lg))}</p><div>{k}</div></a>" for u, t, d, k in cards) + "</div>"
        h += sec(s("hb.why", lg), f"<p>{e(s('hb.why_t', lg))}</p>")
        h += (f"<p class='note'>JSON: <a href='/data/ledger.json'>ledger</a> · <a href='/data/friction.json'>friction</a> · <a href='/data/hype.json'>hype</a> · "
              f"<a href='/data/silent_exit.json'>silent_exit</a> · <a href='/data/localcorr.json'>localcorr</a> · {s('nfa', lg)}</p>")
        return h

    return [write("reality/", s("hb.title", "fa"), s("hb.desc", "fa"), finish("", tri(b)))]


# ================================================================== coin pages: recent locked calls
def inject_coins():
    led = R.load("ledger.json", {})
    entries, res = led.get("entries", []), led.get("results", {})
    by = {}
    for x in entries:
        by.setdefault(x["coin"], []).append(x)
    n = 0
    for coin, es in by.items():
        p = os.path.join(R.ROOT, "coins", coin.lower(), "index.html")
        if not os.path.exists(p):
            continue
        doc = open(p, encoding="utf-8").read()
        doc = re.sub(r"<!--rc:ledger-->.*?<!--/rc:ledger-->", "", doc, flags=re.S)
        if "</main>" not in doc:
            continue
        lis = ""
        for x in reversed(es[-6:]):
            r = res.get(x["id"])
            if r:
                cls = "up" if r["outcome"] == "win" else "down" if r["outcome"] == "loss" else ""
                st = f"<b class='{cls}'>{e(s('out.' + r['outcome'], 'fa'))}</b> ({nf(r['r'], 'fa', 2, True, True)})"
            else:
                st = "باز"
            lis += (f"<li>{e(src_name(led, x['src'], 'fa'))} · {e(s('call.' + x['call'], 'fa'))} · {hours_txt(x['h'], 'fa')} · "
                    f"قیمت مبنا <span class='rc-num' dir='ltr'>{money(x['p0'], 'en')}</span> · {fdate(x['t0'], 'fa', True)} ← {st}</li>")
        block = (f"<!--rc:ledger--><h2>{e(s('lg.recent_coin', 'fa', c=coin))}</h2><ul class='list'>{lis}</ul>"
                 f"<p class='note'><a href='/ledger/#coin={e(coin)}'>{e(s('lg.all_coin', 'fa', c=coin))}</a></p><!--/rc:ledger-->")
        open(p, "w", encoding="utf-8").write(doc.replace("</main>", block + "</main>", 1))
        n += 1
    return n


def add_to_sitemap(urls):
    sm = os.path.join(R.ROOT, "sitemap.xml")
    if not os.path.exists(sm) or not urls:
        return
    txt = open(sm, encoding="utf-8").read()
    add = "".join(f"<url><loc>{e(u)}</loc></url>" for u in urls if f"<loc>{e(u)}</loc>" not in txt)
    if add:
        open(sm, "w", encoding="utf-8").write(txt.replace("</urlset>", add + "</urlset>"))


def main():
    urls = []
    for fn in (build_hub, build_ledger, build_friction, build_hype, build_silent, build_corr):
        try:
            urls += fn()
        except Exception:  # noqa: BLE001
            traceback.print_exc()
            print(f"reality page failed: {fn.__name__}")
    try:
        print("coin pages with a ledger block:", inject_coins())
    except Exception:  # noqa: BLE001
        traceback.print_exc()
    add_to_sitemap(urls)
    print("reality pages:", urls)


if __name__ == "__main__":
    main()
