# -*- coding: utf-8 -*-
"""The «positions now» part of /trader/: complete position cards, the honest empty state, the record behind the bar,
and the "today's market" strip, all rendered at build time from trader/setups.json (scripts/trader_setups.py) and the
site's own data files. No number here is typed by hand: every figure is a Binance price, a calculation from those
prices, a count from the replay, or a value from data/*.json.

Owner's brief (2026-11-26): give the trader the whole position (coin, entry zone and its layers, stop, take-profits,
the chance of the move, how much the trade is worth, short reasons), only for setups of high accuracy; show nothing
when none passes. Educational, not financial advice.
"""
import json
import os
from datetime import datetime, timezone

from trader_data import L

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def e(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&#39;"))


# ------------------------------------------------------------------ words
T = {
    "sec": L("پوزیشن کامل، فقط وقتی کارنامه پشتش است", "پۆزیشنی تەواو، تەنها کاتێک تۆمار پشتی دەگرێت",
             "Complete positions, only when the record backs them"),
    "sec_p": L("سایت هر ۱۵ دقیقه ۲۰ ارز بزرگ را با سه قاعدهٔ ثابت بررسی می‌کند. پوزیشن فقط وقتی اینجا می‌آید که قاعده همین حالا فعال شده باشد و کارنامهٔ خود همان قاعده روی کندل‌های واقعی قوی باشد. هر عدد از قیمت‌های بایننس یا از همان کارنامه می‌آید.",
               "ماڵپەڕ هەر ١٥ خولەک ٢٠ دراوی گەورە بە سێ یاسای جێگیر دەپشکنێت. پۆزیشن تەنها کاتێک لێرە دێت کە یاساکە هەر ئێستا چالاک بووبێت و تۆماری هەمان یاسا لەسەر مۆمە ڕاستەقینەکان بەهێز بێت. هەر ژمارەیەک لە نرخەکانی بایننس یان لە هەمان تۆمارەوە دێت.",
               "Every 15 minutes the site checks 20 large coins with three fixed rules. A position appears here only when a rule has fired now and that rule's own record on real candles is strong. Every number comes from Binance prices or from that record."),
    "none_h": L("الان هیچ پوزیشنی از حد اطمینان بالا رد نمی‌شود.", "ئێستا هیچ پۆزیشنێک لە ئاستی دڵنیایی بەرز تێناپەڕێت.",
                "No position passes the high-confidence bar right now."),
    "none_p": L("شرط نمایش: دست‌کم ۶۰ معاملهٔ گذشته روی کندل‌های واقعی، رسیدن به تارگت اول پیش از حد ضرر دست‌کم در ۴۰ درصد آنها، و میانگین نتیجهٔ مثبت بعد از کارمزد و لغزش؛ هر دو با اطمینان ۹۹ درصد و با اصلاح برای آزمودن چند قاعده. وقتی قاعده‌ای این شرط را پاس کند و فعال شود، پوزیشنش با همهٔ جزئیات خودبه‌خود همین‌جا می‌آید.",
                "مەرجی پیشاندان: لانیکەم ٦٠ مامەڵەی ڕابردوو لەسەر مۆمە ڕاستەقینەکان، گەیشتن بە ئامانجی یەکەم پێش سنووری زیان لانیکەم لە ٤٠ لە سەدیاندا، و تێکڕای ئەنجامی ئەرێنی دوای کرێ و خلیسکان؛ هەردووکیان بە دڵنیایی ٩٩ لە سەد و بە ڕاستکردنەوە بۆ تاقیکردنەوەی چەند یاسا. کاتێک یاسایەک ئەم مەرجە تێدەپەڕێنێت و چالاک دەبێت، پۆزیشنەکەی بە هەموو وردەکارییەکانەوە خۆکارانە لێرە دێت.",
                "The bar: at least 60 past trades on real candles, the first target reached before the stop in at least 40% of them, and a positive average result after fees and slippage, both at 99% confidence corrected for testing several rules. When a rule passes this bar and fires, its position appears here by itself, in full."),
    "none_why": L("چرا شرط را پایین نمی‌آوریم: پوزیشنی که دقیق به نظر می‌رسد ولی کارنامهٔ ثابت‌شده ندارد، فقط حدسی است که عدد رویش گذاشته‌اند.",
                  "بۆچی مەرجەکە دانابەزێنین: پۆزیشنێک کە ورد دەردەکەوێت بەڵام تۆماری سەلمێنراوی نییە، تەنها گومانێکە کە ژمارەی لەسەر دانراوە.",
                  "Why we don't lower the bar: a position that looks precise but has no proven record is a guess with numbers on it."),
    "fired": L("همین حالا فعال شده‌اند ولی کارنامه‌شان کافی نیست:", "هەر ئێستا چالاک بوون بەڵام تۆمارەکەیان بەس نییە:",
               "Fired now, but their record isn't strong enough:"),
    "fired_l": L("تارگت اول پیش از حد ضرر {p1} · میانگین {ev}", "ئامانجی یەکەم پێش سنووری زیان {p1} · تێکڕا {ev}",
                 "first target before the stop {p1} · average {ev}"),
    "checked": L("آخرین بررسی", "دوایین پشکنین", "Last check"),
    "coins": L("ارز", "دراو", "coins"),
    "nodata": L("دادهٔ این بخش در این ساخت در دسترس نبود؛ در بررسی بعدی دوباره پر می‌شود. چیزی حدس زده نمی‌شود.",
                "داتای ئەم بەشە لەم دروستکردنەدا بەردەست نەبوو؛ لە پشکنینی داهاتوودا دووبارە پڕ دەبێتەوە. هیچ شتێک گومان ناکرێت.",
                "This section's data wasn't available in this build; it fills again on the next check. Nothing is guessed."),
    "stale": L("این بررسی {h} ساعت پیش انجام شده؛ عددها را قدیمی بدان.", "ئەم پشکنینە {h} کاتژمێر لەمەوبەر کراوە؛ ژمارەکان بە کۆن دابنێ.",
               "This check ran {h} hours ago; treat the numbers as old."),
    "expired": L("پنجرهٔ ورود این پوزیشن تمام شده؛ دیگر وارد نشو.", "پەنجەرەی چوونەژوورەوەی ئەم پۆزیشنە تەواو بووە؛ چیتر مەچۆ ژوورەوە.",
                 "This position's entry window has closed; don't enter it any more."),
    "long": L("لانگ (خرید)", "لۆنگ (کڕین)", "Long (buy)"),
    "short": L("شورت (فروش)", "شۆرت (فرۆشتن)", "Short (sell)"),
    "pass": L("از حد اطمینان رد شده", "لە ئاستی دڵنیایی تێپەڕیوە", "Passes the bar"),
    "signal": L("سیگنال: کندل {tf} که {t} بسته شد، روی {px}.", "سیگناڵ: مۆمی {tf} کە {t} داخرا، لەسەر {px}.",
                "Signal: the {tf} candle that closed {t}, at {px}."),
    "age": L("از سیگنال {n} کندل گذشته و از آن زمان نه حد ضرر خورده و نه تارگت اول. آخرین قیمت {px} ({t}).",
             "لە سیگناڵەوە {n} مۆم تێپەڕیوە و لەو کاتەوە نە سنووری زیان کەوتووە و نە ئامانجی یەکەم. دوایین نرخ {px} ({t}).",
             "Candles since the signal: {n}. Neither the stop nor the first target has been hit since. Last price {px} ({t})."),
    "fresh": L("همین کندل آخر؛ لایهٔ اول در باز شدن کندل بعدی است.", "هەر دوایین مۆم؛ چینی یەکەم لە کرانەوەی مۆمی دواترە.",
               "The latest candle; layer 1 is the next candle's open."),
    "zone": L("ناحیهٔ ورود در سه لایه", "ناوچەی چوونەژوورەوە بە سێ چین", "Entry zone, in three layers"),
    "l1": L("لایهٔ ۱ · {w} از حجم", "چینی ١ · {w} لە قەبارە", "Layer 1 · {w} of the size"),
    "l2": L("لایهٔ ۲ · {w}", "چینی ٢ · {w}", "Layer 2 · {w}"),
    "l3": L("لایهٔ ۳ · {w}", "چینی ٣ · {w}", "Layer 3 · {w}"),
    "l1_how": L("باز شدن کندل بعد از سیگنال", "کرانەوەی مۆمی دوای سیگناڵ", "the open after the signal candle"),
    "l1_done": L("پر شد روی {px}", "پڕ بوو لەسەر {px}", "filled at {px}"),
    "l2_how": L("نیم ATR بهتر", "نیو ATR باشتر", "half an ATR better"),
    "l3_how": L("یک ATR بهتر", "یەک ATR باشتر", "one ATR better"),
    "lf": L("پر شده", "پڕ بووە", "filled"),
    "avg": L("میانگین ورود اگر هر سه پر شوند", "تێکڕای چوونەژوورەوە ئەگەر هەر سێکیان پڕ ببن", "Average entry if all three fill"),
    "stop": L("حد ضرر", "سنووری زیان", "Stop-loss"),
    "stop_how": L("{p} از لایهٔ ۱", "{p} لە چینی ١", "{p} from layer 1"),
    "tp": L("تارگت {i} · بستن {w}", "ئامانجی {i} · داخستنی {w}", "Target {i} · close {w}"),
    "tp_how": L("{p} · {r} از میانگین", "{p} · {r} لە تێکڕا", "{p} · {r} from the average"),
    "be": L("بعد از تارگت ۱، حد ضرر به میانگین ورود می‌آید؛ لایه‌های پرنشده لغو می‌شوند.",
            "دوای ئامانجی ١، سنووری زیان دێتە سەر تێکڕای چوونەژوورەوە؛ چینە پڕنەبووەکان هەڵدەوەشێنەوە.",
            "After target 1 the stop moves to the average entry and unfilled layers are cancelled."),
    "prob": L("احتمال هر مسیر، از کارنامهٔ همین قاعده", "ئەگەری هەر ڕێڕەوێک، لە تۆماری هەمان یاسا", "The chance of each path, from this rule's record"),
    "p1": L("تارگت ۱ پیش از حد ضرر", "ئامانجی ١ پێش سنووری زیان", "Target 1 before the stop"),
    "p2": L("تا تارگت ۲", "تا ئامانجی ٢", "On to target 2"),
    "p3": L("تا تارگت ۳", "تا ئامانجی ٣", "On to target 3"),
    "ps": L("اول حد ضرر", "یەکەم سنووری زیان", "Stop first"),
    "range": L("بازه", "مەودا", "range"),
    "rest": L("بقیه با محدودیت زمانی بسته شدند.", "ئەوانی تر بە سنووری کات داخران.", "The rest closed at the time limit."),
    "worth": L("ارزش معامله", "بەهای مامەڵە", "What the trade is worth"),
    "ev": L("میانگین نتیجهٔ هر معامله بعد از کارمزد و لغزش: {ev} (بازهٔ محتاطانه {lo} تا {hi})، از {n} معامله، {f} تا {t}.",
            "تێکڕای ئەنجامی هەر مامەڵەیەک دوای کرێ و خلیسکان: {ev} (مەودای وریا {lo} تا {hi})، لە {n} مامەڵە، {f} تا {t}.",
            "Average result per trade after fees and slippage: {ev} (cautious range {lo} to {hi}), over {n} trades, {f} to {t}."),
    "ev_cap": L("یعنی با ۱ درصد سرمایه در ریسک، معاملهٔ میانگین گذشته {c} از کل سرمایه را برگرداند.",
                "واتە بە ١ لە سەدی سەرمایە لە مەترسیدا، مامەڵەی تێکڕای ڕابردوو {c} لە کۆی سەرمایەی گەڕاندەوە.",
                "So with 1% of capital at risk, the average past trade returned {c} of total capital."),
    "hold": L("نگه‌داری معمول: {n} کندل. هرچه تا {t} باز مانده، بسته می‌شود.", "هێشتنەوەی ئاسایی: {n} مۆم. هەرچی تا {t} کراوە مابێت، دادەخرێت.",
              "Typical hold: {n} candles. Whatever is still open by {t} is closed."),
    "until": L("لایه‌های ۲ و ۳ اگر تا {t} پر نشوند لغو می‌شوند.", "چینی ٢ و ٣ ئەگەر تا {t} پڕ نەبن هەڵدەوەشێنەوە.",
               "Layers 2 and 3 are cancelled if not filled by {t}."),
    "coin_rec": L("فقط روی {c}: {n} معامله، تارگت ۱ پیش از حد ضرر {p1}، میانگین {ev}.", "تەنها لەسەر {c}: {n} مامەڵە، ئامانجی ١ پێش سنووری زیان {p1}، تێکڕا {ev}.",
                  "On {c} alone: {n} trades, target 1 before the stop {p1}, average {ev}."),
    "lev": L("بیشترین اهرم امن: {x} برابر (لیکوییدیشن دست‌کم یک ATR آن سوی حد ضرر، از میانگین ورود). کمتر بهتر است.",
             "زۆرترین لێڤەرێجی سەلامەت: {x} هێندە (لیکویدکردن لانیکەم یەک ATR لەو دیوی سنووری زیان، لە تێکڕای چوونەژوورەوە). کەمتر باشترە.",
             "Highest safe leverage: {x}x (liquidation at least one ATR beyond the stop, from the average entry). Less is better."),
    "spot": L("بدون اهرم (اسپات).", "بێ لێڤەرێج (سپۆت).", "No leverage (spot)."),
    "why": L("چرا این پوزیشن", "بۆچی ئەم پۆزیشنە", "Why this position"),
    "ctx": L("در کنارش (فقط برای دیدن، در انتخاب پوزیشن به کار نرفته)", "لە تەنیشتیدا (تەنها بۆ بینین، لە هەڵبژاردنی پۆزیشندا بەکار نەهاتووە)",
             "Alongside it (shown only, not used to pick the position)"),
    "d_up": L("روند روزانه صعودی است.", "ئاراستەی ڕۆژانە بەرەو سەرەوەیە.", "The daily trend is up."),
    "d_dn": L("روند روزانه نزولی است.", "ئاراستەی ڕۆژانە بەرەو خوارەوەیە.", "The daily trend is down."),
    "bo_up": L("بستهٔ روزانه بالای بلندترین قیمت ۲۰ روز قبل است.", "داخستنی ڕۆژانە لە سەرووی بەرزترین نرخی ٢٠ ڕۆژی پێشووە.",
               "The daily close is above the highest high of the previous 20 days."),
    "bo_dn": L("بستهٔ روزانه زیر پایین‌ترین قیمت ۲۰ روز قبل است.", "داخستنی ڕۆژانە لە خوار نزمترین نرخی ٢٠ ڕۆژی پێشووە.",
               "The daily close is below the lowest low of the previous 20 days."),
    "emas": L("بسته {px}؛ میانگین ۲۰ کندلی {a} و ۵۰ کندلی {b}.", "داخستن {px}؛ تێکڕای ٢٠ مۆمی {a} و ٥٠ مۆمی {b}.",
              "Close {px}; 20-candle average {a}, 50-candle average {b}."),
    "rsi_mid": L("RSI {r}: میانه، نه داغ و نه خسته.", "RSI {r}: ناوەند، نە گەرم و نە ماندوو.", "RSI {r}: mid-range, neither stretched nor exhausted."),
    "rsi_os": L("RSI {r}: اشباع فروش.", "RSI {r}: تێربوونی فرۆشتن.", "RSI {r}: oversold."),
    "rsi_ob": L("RSI {r}: اشباع خرید.", "RSI {r}: تێربوونی کڕین.", "RSI {r}: overbought."),
    "rsi": L("RSI {r}.", "RSI {r}.", "RSI {r}."),
    "ext": L("فاصله از میانگین ۵۰ کندلی: {x} ATR (دنبال قیمت ندویده).", "مەودا لە تێکڕای ٥٠ مۆمی: {x} ATR (بەدوای نرخدا ڕانەکراوە).",
             "Distance from the 50-candle average: {x} ATR (not chasing)."),
    "c_chg": L("تغییر ۲۴ ساعته {x}", "گۆڕانی ٢٤ کاتژمێر {x}", "24h change {x}"),
    "c_fund": L("فاندینگ {x} در هر ۸ ساعت", "فەندینگ {x} لە هەر ٨ کاتژمێرێک", "funding {x} per 8h"),
    "c_reg": L("رژیم بیت‌کوین: {x}", "دۆخی بیتکۆین: {x}", "Bitcoin regime: {x}"),
    "c_fng": L("ترس و طمع {x}", "ترس و تەماح {x}", "Fear & Greed {x}"),
    "c_scan": L("اسکنر سایت: {a} یافته هم‌جهت، {b} خلاف", "سکانەری ماڵپەڕ: {a} دۆزینەوەی هاوئاراستە، {b} پێچەوانە",
                "site scanner: {a} findings agree, {b} against"),
    "load": L("بریز در برگهٔ برنامهٔ من", "بیخە ناو پەڕەی پلانەکەم", "Put this in my plan sheet"),
    "loaded": L("در برگهٔ برنامه گذاشته شد ↓", "خرایە ناو پەڕەی پلان ↓", "Added to the plan sheet ↓"),
    "beg_short": L("در سطح مبتدی پوزیشن شورت و اهرم عمداً نشان داده نمی‌شوند.", "لە ئاستی سەرەتاییدا پۆزیشنی شۆرت و لێڤەرێج بە ئەنقەست پیشان نادرێن.",
                   "At the beginner level, short positions and leverage are left out on purpose."),
    "beg_words": L("به زبان ساده: اگر قیمت به حد ضرر برسد می‌فروشی و ضرر کوچکی را که از قبل حساب کرده‌ای می‌پذیری؛ در هر تارگت بخشی را می‌فروشی.",
                   "بە زمانی سادە: ئەگەر نرخ گەیشتە سنووری زیان دەفرۆشیت و ئەو زیانە بچووکەی پێشتر ژماردووتە قبووڵ دەکەیت؛ لە هەر ئامانجێکدا بەشێک دەفرۆشیت.",
                   "In plain words: if price reaches the stop you sell and accept the small loss you counted in advance; at each target you sell a part."),
    "nfa": L("آموزشی است، نه توصیهٔ مالی. کارنامهٔ گذشته آینده را تضمین نمی‌کند.", "فێرکارییە، نەک ئامۆژگاریی دارایی. تۆماری ڕابردوو داهاتوو گەرەنتی ناکات.",
             "Educational, not financial advice. A past record does not guarantee the future."),
    # record
    "rec": L("کارنامهٔ پشت این شرط", "تۆماری پشت ئەم مەرجە", "The record behind the bar"),
    "rec_p": L("هر سیگنال گذشتهٔ هر قاعده دقیقاً همان‌طور معامله شده که این صفحه منتشرش می‌کرد: سه لایهٔ ورود، یک حد ضرر، سه تارگت، حد ضرر سر به سر بعد از تارگت اول، محدودیت زمانی، ۰٫۱۵ درصد هزینه برای هر پر شدن، و داخل هر کندل بدترین ترتیب. داده: کندل‌های عمومی بایننس.",
               "هەر سیگناڵێکی ڕابردووی هەر یاسایەک ڕێک بەو شێوەیە مامەڵەی پێکراوە کە ئەم پەڕەیە بڵاوی دەکردەوە: سێ چینی چوونەژوورەوە، یەک سنووری زیان، سێ ئامانج، سنووری زیان لە خاڵی چوونەژوورەوە دوای ئامانجی یەکەم، سنووری کات، ٠٫١٥ لە سەد تێچوو بۆ هەر پڕبوونێک، و لە ناو هەر مۆمێکدا خراپترین ڕیزبەندی. داتا: مۆمە گشتییەکانی بایننس.",
               "Every past signal of each rule traded exactly as this page would have published it: three entry layers, one stop, three targets, the stop to break-even after the first target, a time limit, 0.15% cost per fill, and the worst order inside each candle. Data: Binance public candles."),
    "h_rule": L("قاعده", "یاسا", "Rule"), "h_n": L("معامله", "مامەڵە", "Trades"),
    "h_p1": L("تارگت ۱ پیش از حد ضرر", "ئامانجی ١ پێش سنووری زیان", "Target 1 before stop"),
    "h_ps": L("اول حد ضرر", "یەکەم سنووری زیان", "Stop first"),
    "h_ev": L("میانگین بعد از هزینه", "تێکڕا دوای تێچوو", "Average after costs"),
    "h_ok": L("رد می‌شود؟", "تێدەپەڕێت؟", "Passes?"),
    "to": L("تا", "تا", "to"),
    "yes": L("بله", "بەڵێ", "Yes"), "no": L("نه", "نەخێر", "No"),
    "rec_n": L("R یعنی اندازهٔ ضرر اگر حد ضرر بخورد. +۰٫۱R یعنی به‌طور میانگین یک‌دهم همان مقدار سود.",
               "R واتە قەبارەی زیان ئەگەر سنووری زیان بکەوێت. +٠٫١R واتە بە تێکڕا یەک لە دەی هەمان بڕ قازانج.",
               "R is the size of the loss if the stop is hit. +0.1R means, on average, a tenth of that amount in profit."),
    "rules": L("سه قاعده، پیش از دیدن هر نتیجه نوشته شده و هرگز با داده تنظیم نشده", "سێ یاسا، پێش بینینی هەر ئەنجامێک نووسراون و هەرگیز بە داتا ڕێک نەخراون",
               "Three rules, written down before any result was seen and never tuned to the data"),
    "common": L("برای هر سه: لایهٔ ۱ با ۴۰ درصد حجم در باز شدن کندل بعد، لایهٔ ۲ با ۳۵ درصد نیم ATR بهتر، لایهٔ ۳ با ۲۵ درصد یک ATR بهتر. تارگت‌ها ۱، ۲ و ۳ برابر فاصلهٔ حد ضرر، با بستن ۴۰، ۳۵ و ۲۵ درصد. بعد از تارگت ۱ حد ضرر به میانگین ورود می‌آید.",
                "بۆ هەر سێکیان: چینی ١ بە ٤٠ لە سەدی قەبارە لە کرانەوەی مۆمی دواتر، چینی ٢ بە ٣٥ لە سەد نیو ATR باشتر، چینی ٣ بە ٢٥ لە سەد یەک ATR باشتر. ئامانجەکان ١، ٢ و ٣ هێندەی مەودای سنووری زیان، بە داخستنی ٤٠، ٣٥ و ٢٥ لە سەد. دوای ئامانجی ١ سنووری زیان دێتە سەر تێکڕای چوونەژوورەوە.",
                "For all three: layer 1 with 40% of the size at the next candle's open, layer 2 with 35% half an ATR better, layer 3 with 25% one ATR better. Targets at 1, 2 and 3 times the stop distance, closing 40%, 35% and 25%. After target 1 the stop moves to the average entry."),
    # today
    "today": L("بازار امروز، از دادهٔ خود سایت", "بازاڕی ئەمڕۆ، لە داتای ماڵپەڕ خۆی", "Today's market, from the site's own data"),
    "k_reg": L("رژیم بیت‌کوین", "دۆخی بیتکۆین", "Bitcoin regime"),
    "k_fng": L("ترس و طمع", "ترس و تەماح", "Fear & Greed"),
    "k_fund": L("فاندینگ بیت‌کوین، هر ۸ ساعت", "فەندینگی بیتکۆین، هەر ٨ کاتژمێر", "Bitcoin funding, per 8h"),
    "k_chg": L("بیت‌کوین در ۲۴ ساعت", "بیتکۆین لە ٢٤ کاتژمێردا", "Bitcoin, 24h"),
    "conf": L("اطمینان", "دڵنیایی", "confidence"),
    "t_note": L("توصیف امروز است، نه پیش‌بینی.", "وەسفی ئەمڕۆیە، نەک پێشبینی.", "A description of today, not a forecast."),
    "for_lv": L("برای این سطح امروز:", "بۆ ئەم ئاستە ئەمڕۆ:", "For this level today:"),
    "fund_hot": L("داغ", "گەرم", "hot"), "fund_neg": L("منفی", "نەرێنی", "negative"), "fund_ok": L("عادی", "ئاسایی", "normal"),
}
REG = {"bull": L("صعودی", "بەرزبوونەوە", "Bull"), "bear": L("نزولی", "دابەزین", "Bear"),
       "sideways": L("خنثی / رِنج", "مامناوەند / ڕەینج", "Sideways"), "high_vol": L("پرنوسانِ بی‌جهت", "هەڵاوسانی بێ ئاڕاستە", "Volatile, no trend")}
FNG = {"Extreme Fear": L("ترس شدید", "ترسی زۆر", "Extreme fear"), "Fear": L("ترس", "ترس", "Fear"), "Neutral": L("خنثی", "مامناوەند", "Neutral"),
       "Greed": L("طمع", "تەماح", "Greed"), "Extreme Greed": L("طمع شدید", "تەماحی زۆر", "Extreme greed")}
TF = {"4h": L("۴ساعته", "٤ کاتژمێری", "4h"), "1d": L("روزانه", "ڕۆژانە", "daily")}
FAM = {
    "pullback-4h-v1": {
        "name": L("برگشت در روند، ۴ساعته", "گەڕانەوە لە ناو ئاراستەدا، ٤ کاتژمێری", "Pullback in the trend, 4h"),
        "how": L("روند روزانه یک‌طرفه است (قیمت و میانگین ۲۰روزه هر دو یک سوی میانگین ۵۰روزه). در ۴ساعته قیمت تا نزدیک میانگین ۲۰کندلی برگشته و دوباره در جهت روند بسته شده، RSI در میانه است و قیمت بیش از ۳ ATR از میانگین ۵۰کندلی دور نیست. حد ضرر آن سوی سقف یا کف شش کندل آخر و دست‌کم ۱٫۵ ATR دورتر. لایه‌ها ۲۴ ساعت اعتبار دارند و خروج زمانی بعد از ۵ روز است.",
                 "ئاراستەی ڕۆژانە یەکلایەنەیە (نرخ و تێکڕای ٢٠ ڕۆژە هەردووکیان لە یەک دیوی تێکڕای ٥٠ ڕۆژەن). لە ٤ کاتژمێریدا نرخ گەڕاوەتەوە نزیک تێکڕای ٢٠ مۆمی و دووبارە بە ئاراستەی ئاراستەکە داخراوە، RSI لە ناوەنددایە و نرخ زیاتر لە ٣ ATR لە تێکڕای ٥٠ مۆمی دوور نییە. سنووری زیان لەو دیوی بەرزی یان نزمیی شەش مۆمی کۆتایی و لانیکەم ١٫٥ ATR دوورتر. چینەکان ٢٤ کاتژمێر کاریگەرن و دەرچوونی کاتی دوای ٥ ڕۆژە.",
                 "The daily trend points one way (price and the 20-day average on the same side of the 50-day). On 4h, price has pulled back near the 20-candle average and closed again in the trend's direction, RSI is mid-range, and price is no more than 3 ATR from the 50-candle average. Stop beyond the last six candles' extreme and at least 1.5 ATR away. Layers stay valid 24 hours; time exit after 5 days."),
    },
    "breakout-1d-v1": {
        "name": L("شکست سقف یا کف ۲۰ روزه، روزانه", "شکاندنی بەرزی یان نزمیی ٢٠ ڕۆژە، ڕۆژانە", "20-day breakout, daily"),
        "how": L("بستهٔ روزانه بالای بلندترین قیمت ۲۰ روز قبل، با قیمت و میانگین ۲۰روزه بالای میانگین ۵۰روزه (برای شورت برعکس). حد ضرر ۲ ATR از بسته. لایه‌ها ۳ روز اعتبار دارند و خروج زمانی بعد از ۲۰ روز است.",
                 "داخستنی ڕۆژانە لە سەرووی بەرزترین نرخی ٢٠ ڕۆژی پێشوو، بە نرخ و تێکڕای ٢٠ ڕۆژە لە سەرووی تێکڕای ٥٠ ڕۆژە (بۆ شۆرت پێچەوانە). سنووری زیان ٢ ATR لە داخستن. چینەکان ٣ ڕۆژ کاریگەرن و دەرچوونی کاتی دوای ٢٠ ڕۆژە.",
                 "A daily close above the highest high of the previous 20 days, with price and the 20-day average above the 50-day (the mirror for a short). Stop 2 ATR from the close. Layers stay valid 3 days; time exit after 20 days."),
    },
    "dip-4h-v1": {
        "name": L("اشباع فروش در روند، ۴ساعته", "تێربوونی فرۆشتن لە ناو ئاراستەدا، ٤ کاتژمێری", "Oversold dip in the trend, 4h"),
        "how": L("روند روزانه صعودی است، RSI ۴ساعته زیر ۳۰ است و کندل سبز بسته شده (برای شورت: روند نزولی، RSI بالای ۷۰ و کندل قرمز). حد ضرر مثل قاعدهٔ برگشت در روند.",
                 "ئاراستەی ڕۆژانە بەرەو سەرەوەیە، RSIی ٤ کاتژمێری لە خوار ٣٠ە و مۆم بە سەوزی داخراوە (بۆ شۆرت: ئاراستەی خوارەوە، RSI لە سەرووی ٧٠ و مۆمی سوور). سنووری زیان وەک یاسای گەڕانەوە لە ناو ئاراستەدا.",
                 "The daily trend is up, 4h RSI is below 30 and the candle closed green (for a short: trend down, RSI above 70, a red candle). Stop as in the pullback rule."),
    },
}
FAM_ORDER = ["pullback-4h-v1", "breakout-1d-v1", "dip-4h-v1"]


# ------------------------------------------------------------------ numbers
def n_(s):
    return f"<span class='rc-num' dir='ltr'>{e(s)}</span>"


def px(x):
    if x is None:
        return "—"
    a = abs(x)
    dg = 2 if a >= 100 else 3 if a >= 10 else 4 if a >= 1 else 6 if a >= 0.01 else 8
    return n_(f"{x:,.{dg}f}")


def pc(x, dg=0, sign=False):
    if x is None:
        return "—"
    s = f"{x * 100:+.{dg}f}%" if sign else f"{x * 100:.{dg}f}%"
    return n_(s.replace("-", "−"))


def pct_raw(x, dg=1, sign=True):
    if x is None:
        return "—"
    return n_((f"{x:+.{dg}f}%" if sign else f"{x:.{dg}f}%").replace("-", "−"))


def rr(x, dg=2, sign=True):
    if x is None:
        return "—"
    return n_((f"{x:+.{dg}f}R" if sign else f"{x:.{dg}f}R").replace("-", "−"))


def ts(ms, date_only=False):
    if not ms:
        return "—"
    d = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return n_(d.strftime("%Y-%m-%d") if date_only else d.strftime("%Y-%m-%d %H:%M") + " UTC")


def iso_ms(s):
    try:
        return int(datetime.fromisoformat(str(s).replace("Z", "+00:00")).timestamp() * 1000)
    except Exception:  # noqa: BLE001
        return None


def f(tpl, **kw):
    """fill an escaped template with already-built HTML pieces"""
    out = e(tpl)
    for k, v in kw.items():
        out = out.replace("{" + k + "}", v)
    return out


# ------------------------------------------------------------------ data
def load_json(p, d=None):
    try:
        with open(p, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:  # noqa: BLE001
        return d


def jdata(name):
    return load_json(os.path.join(ROOT, "data", name), {}) or {}


# ------------------------------------------------------------------ one position card
def card(s, lg, level="pro", load=False):
    d = 1 if s["side"] == "long" else -1
    st, fam = s.get("stats") or {}, FAM.get(s["family"], {})
    beginner = level == "beginner"
    lay = s.get("layers") or []
    rows = []
    hows = [T["l1_how"][lg], T["l2_how"][lg], T["l3_how"][lg]]
    filled = int(s.get("filled") or 0)
    for i_, (lk, L_) in enumerate(zip(("l1", "l2", "l3"), lay)):
        how = e(hows[i_])
        if i_ == 0 and s.get("l1_fill"):
            how = f(T["l1_done"][lg], px=px(s["l1_fill"]))
        elif i_ > 0 and filled > i_:
            how += " · " + e(T["lf"][lg])
        rows.append(f"<tr><th>{f(T[lk][lg], w=pc(L_['w']))}</th><td>{px(L_['px'])}</td><td class='mut'>{how}</td></tr>")
    rows.append(f"<tr class='tr-avg'><th>{e(T['avg'][lg])}</th><td>{px(s.get('avg'))}</td><td></td></tr>")
    rows.append(f"<tr class='tr-sl'><th>{e(T['stop'][lg])}</th><td>{px(s.get('stop'))}</td>"
                f"<td class='mut'>{f(T['stop_how'][lg], p=pct_raw(-d * (s.get('stop_pct') or 0)))}</td></tr>")
    for i_, (tp, w, tpp, r_) in enumerate(zip(s.get("tps") or [], s.get("close_at") or [], s.get("tp_pct") or [], s.get("rr_avg") or [])):
        rows.append(f"<tr class='tr-tp'><th>{f(T['tp'][lg], i=n_(str(i_ + 1)), w=pc(w))}</th><td>{px(tp)}</td>"
                    f"<td class='mut'>{f(T['tp_how'][lg], p=pct_raw(tpp * d), r=rr(r_, sign=False))}</td></tr>")
    table = (f"<table class='tr-lvt'><caption>{e(T['zone'][lg])}</caption><tbody>{''.join(rows)}</tbody></table>"
             f"<p class='note'>{e(T['be'][lg])}</p>")

    def bar(k, v, lo=None, hi=None, cls=""):
        if v is None:
            return ""
        w = max(0, min(100, round(v * 100)))
        rg = f" <small class='mut'>{e(T['range'][lg])} {pc(lo)}–{pc(hi)}</small>" if lo is not None and hi is not None else ""
        return (f"<div class='tr-pb {cls}'><span class='tr-pbl'>{e(T[k][lg])}</span>"
                f"<span class='tr-pbt' role='img' aria-label='{w}%'><i style='width:{w}%'></i></span>"
                f"<b>{pc(v)}</b>{rg}</div>")
    probs = (f"<h4>{e(T['prob'][lg])}</h4>" + bar("p1", st.get("p1"), st.get("p1_lo"), st.get("p1_hi"), "tr-good")
             + bar("p2", st.get("p2")) + bar("p3", st.get("p3")) + bar("ps", st.get("p_stop"), cls="tr-bad")
             + f"<p class='note'>{e(T['rest'][lg])}</p>")
    worth = (f"<h4>{e(T['worth'][lg])}</h4><p>" + f(T["ev"][lg], ev=rr(st.get("ev")), lo=rr(st.get("ev_lo")), hi=rr(st.get("ev_hi")),
                                                     n=n_(f"{st.get('n', 0):,}"), f=ts(st.get("from"), True), t=ts(st.get("to"), True)) + "</p>"
             + (f"<p>{f(T['ev_cap'][lg], c=pct_raw(st.get('ev'), 2))}</p>" if st.get("ev") is not None else ""))
    cs = s.get("coin_stats")
    if cs and not beginner:
        worth += f"<p class='mut'>{f(T['coin_rec'][lg], c=e(s['coin']), n=n_(str(cs['n'])), p1=pc(cs.get('p1')), ev=rr(cs.get('ev')))}</p>"
    worth += f"<p>{f(T['until'][lg], t=ts(s.get('valid_until')))} {f(T['hold'][lg], n=n_(str(st.get('bars_med', '—'))), t=ts(s.get('exit_by')))}</p>"
    worth += f"<p>{e(T['spot'][lg]) if level in ('beginner', 'intermediate') else f(T['lev'][lg], x=n_(str(s.get('lev_max'))))}</p>"
    w_ = s.get("why") or {}
    why = []
    if s["family"] == "breakout-1d-v1":
        why.append(e(T["bo_up" if d > 0 else "bo_dn"][lg]))
    else:
        why.append(e(T["d_up" if (w_.get("dtrend") or d) > 0 else "d_dn"][lg]))
    why.append(f(T["emas"][lg], px=px(s.get("price")), a=px(w_.get("e20")), b=px(w_.get("e50"))))
    r_ = w_.get("rsi")
    if r_ is not None:
        key = "rsi_mid" if s["family"] == "pullback-4h-v1" else ("rsi_os" if r_ < 30 else "rsi_ob" if r_ > 70 else "rsi")
        why.append(f(T[key][lg], r=n_(f"{r_:.1f}")))
    if w_.get("ext_atr") is not None and s["family"] == "pullback-4h-v1":
        why.append(f(T["ext"][lg], x=n_(f"{w_['ext_atr']:.2f}")))
    c = s.get("ctx") or {}
    ctx = []
    if c.get("chg24") is not None:
        ctx.append(f(T["c_chg"][lg], x=pct_raw(c["chg24"])))
    if c.get("funding") is not None and not beginner:
        ctx.append(f(T["c_fund"][lg], x=n_(f"{c['funding']:+.4f}%".replace("-", "−"))))
    if c.get("regime") in REG:
        ctx.append(f(T["c_reg"][lg], x=e(REG[c["regime"]][lg])))
    if c.get("fng") is not None:
        ctx.append(f(T["c_fng"][lg], x=n_(str(c["fng"]))))
    if c.get("scanner") is not None and not beginner:
        ctx.append(f(T["c_scan"][lg], a=n_(str(c["scanner"])), b=n_(str(c.get("scanner_against", 0)))))
    reasons = (f"<h4>{e(T['why'][lg])}</h4><ul class='tr-why'>" + "".join(f"<li>{x}</li>" for x in why) + "</ul>"
               + (f"<p class='mut'><small>{e(T['ctx'][lg])}: " + " · ".join(ctx) + "</small></p>" if ctx else ""))
    age = s.get("age") or 0
    when = (f(T["age"][lg], n=n_(str(age)), px=px(s.get("last")), t=ts(s.get("last_t"))) if age else e(T["fresh"][lg]))
    tf = e(TF.get(s["tf"], L(s["tf"], s["tf"], s["tf"]))[lg])
    head = (f"<div class='tr-ph'><b class='tr-coin'>{e(s['coin'])}</b><span class='tr-side tr-{e(s['side'])}'>{e(T[s['side']][lg])}</span>"
            f"<span class='tr-pass'>✓ {e(T['pass'][lg])}</span></div>"
            f"<p class='tr-rule'>{e(fam.get('name', L(s['family'], s['family'], s['family']))[lg])}</p>"
            f"<p class='mut'>{f(T['signal'][lg], tf=tf, t=ts(s['bar'] + (86400000 if s['tf'] == '1d' else 4 * 3600000)), px=px(s.get('price')))} {when}</p>")
    btn = ""
    if load:
        plan = {"side": s["side"], "entry": str(s.get("avg")), "stop": str(s.get("stop")), "tp1": str((s.get("tps") or [""])[0])}
        if level != "beginner":
            plan.update({"tp2": str((s.get("tps") or ["", ""])[1]), "share": "40"})
        if level in ("pro", "expert"):
            plan["lev"] = str(min(3, s.get("lev_max") or 1))
            if st.get("p1") is not None:
                plan["win"] = str(round(st["p1"] * 100))
        btn = (f"<p><button type='button' class='rc-btn2 tr-load' data-plan='{e(json.dumps(plan))}' data-done='{e(T['loaded'][lg])}'>"
               f"{e(T['load'][lg])}</button></p>")
    simple = f"<p class='note'>{e(T['beg_words'][lg])}</p>" if beginner else ""
    return (f"<article class='rc-card tr-pos tr-{e(s['side'])}' data-valid='{int(s.get('valid_until') or 0)}'>"
            + head + f"<p class='tr-expired' hidden>{e(T['expired'][lg])}</p>" + table + simple
            + f"<div class='tr-pg'><div>{probs}</div><div>{worth}</div></div>" + reasons + btn
            + f"<p class='note'>{e(T['nfa'][lg])}</p></article>")


# ------------------------------------------------------------------ the section
def positions(S, lg, level="pro", load=False):
    """S is the parsed trader/setups.json or None"""
    head = f"<h2>{e(T['sec'][lg])}</h2><p class='rc-lead'>{e(T['sec_p'][lg])}</p>"
    if not S or not S.get("coins"):
        return f"<section class='rc-sec tr-now'>{head}<div class='rc-card tr-none'><p>{e(T['nodata'][lg])}</p></div></section>"
    upd = iso_ms(S.get("updated_at"))
    stamp = (f"<p class='mut tr-upd' data-upd='{upd or 0}' data-stale='{e(T['stale'][lg])}'>{e(T['checked'][lg])}: "
             f"{ts(upd)} · {n_(str(len(S.get('coins') or [])))} {e(T['coins'][lg])}</p>")
    items = list(S.get("setups") or [])
    note = ""
    if level == "beginner":
        if any(x["side"] != "long" for x in items):
            note = f"<p class='note'>{e(T['beg_short'][lg])}</p>"
        items = [x for x in items if x["side"] == "long"]
    if items:
        body = "".join(card(x, lg, level, load) for x in items) + note
    else:
        fired = S.get("watch") or []
        fl = ""
        if fired:
            li = []
            for w in fired[:8]:
                st = w.get("stats") or {}
                nm = FAM.get(w["family"], {}).get("name", L(w["family"], w["family"], w["family"]))[lg]
                li.append(f"<li><b>{e(w['coin'])}</b> {e(T[w['side']][lg])} · {e(nm)}: "
                          f"{f(T['fired_l'][lg], p1=pc(st.get('p1')), ev=rr(st.get('ev')))}</li>")
            fl = f"<p>{e(T['fired'][lg])}</p><ul class='tr-fired'>{''.join(li)}</ul>"
        body = (f"<div class='rc-card tr-none'><p class='tr-none-h'>{e(T['none_h'][lg])}</p><p>{e(T['none_p'][lg])}</p>"
                f"{fl}<p class='mut'>{e(T['none_why'][lg])}</p></div>" + note)
    return f"<section class='rc-sec tr-now' id='tr-now-{lg}'>{head}{stamp}{body}</section>"


def record(S, lg):
    if not S or not S.get("fams"):
        return ""
    rows = []
    for fam in FAM_ORDER:
        F = (S.get("fams") or {}).get(fam)
        if not F:
            continue
        for sd in ("long", "short"):
            st = (F.get("stats") or {}).get(sd) or {}
            if not st.get("n"):
                continue
            ok = (F.get("qualified") or {}).get(sd)
            rows.append(f"<tr><th>{e(FAM[fam]['name'][lg])} · {e(T[sd][lg])}</th><td>{n_(format(st['n'], ','))}</td>"
                        f"<td>{pc(st.get('p1'))} <small class='mut'>{pc(st.get('p1_lo'))}–{pc(st.get('p1_hi'))}</small></td>"
                        f"<td>{pc(st.get('p_stop'))}</td>"
                        f"<td>{rr(st.get('ev'))} <small class='mut'>{rr(st.get('ev_lo'))} {e(T['to'][lg])} {rr(st.get('ev_hi'))}</small></td>"
                        f"<td class='{'tr-y' if ok else 'tr-n'}'>{e(T['yes' if ok else 'no'][lg])}</td></tr>")
    if not rows:
        return ""
    hd = "".join(f"<th scope='col'>{e(T[k][lg])}</th>" for k in ("h_rule", "h_n", "h_p1", "h_ps", "h_ev", "h_ok"))
    rules = "".join(f"<li><b>{e(FAM[k]['name'][lg])}</b>: {e(FAM[k]['how'][lg])}</li>" for k in FAM_ORDER)
    return (f"<section class='rc-sec tr-rec'><h2>{e(T['rec'][lg])}</h2><p class='note'>{e(T['rec_p'][lg])}</p>"
            f"<div class='tr-tw'><table class='tr-rt'><thead><tr>{hd}</tr></thead><tbody>{''.join(rows)}</tbody></table></div>"
            f"<p class='note'>{e(T['rec_n'][lg])}</p>"
            f"<details class='tr-rules'><summary>{e(T['rules'][lg])}</summary><ul>{rules}</ul><p>{e(T['common'][lg])}</p></details></section>")


# ------------------------------------------------------------------ today
def today_data():
    r, m, dv = jdata("regime.json"), jdata("market.json"), jdata("derivatives.json")
    out = {}
    now = (r or {}).get("now") or {}
    if now.get("top") in REG:
        out["reg"], out["conf"] = now["top"], now.get("confidence")
    fg = (m or {}).get("fng") or {}
    if isinstance(fg.get("value"), (int, float)):
        out["fng"], out["fng_c"] = fg["value"], fg.get("class")
    b = (dv or {}).get("BTC") or {}
    if isinstance(b.get("funding"), (int, float)):
        out["fund"] = b["funding"]
    btc = next((c for c in (m or {}).get("coins", []) if c.get("coin") == "BTC"), None)
    if btc and isinstance(btc.get("chg24"), (int, float)):
        out["chg"] = btc["chg24"]
    ups = [iso_ms(x.get("updated_at")) for x in (r, m, dv) if x and x.get("updated_at")]
    ups = [u for u in ups if u]
    out["upd"] = min(ups) if ups else None
    return out


def today_keys(D):
    """which notes of trader_more.TODAY fit today"""
    ks = []
    if D.get("fng") is not None:
        ks.append("fear" if D["fng"] <= 24 else "greed" if D["fng"] >= 76 else "neutral")
    if D.get("reg"):
        ks.append(D["reg"])
    if D.get("fund") is not None:
        if D["fund"] >= 0.03:
            ks.append("funding_hot")
        elif D["fund"] < 0:
            ks.append("funding_neg")
    return ks


def today(lg, level=None, notes=None):
    D = today_data()
    k = []
    if D.get("reg"):
        k.append(f"<div class='tr-kpi'><small>{e(T['k_reg'][lg])}</small><b class='rg-{e(D['reg'])}'>{e(REG[D['reg']][lg])}</b>"
                 f"<em>{e(T['conf'][lg])} {pc(D.get('conf'))}</em></div>")
    if D.get("fng") is not None:
        k.append(f"<div class='tr-kpi'><small>{e(T['k_fng'][lg])}</small><b>{n_(str(D['fng']))} / 100</b>"
                 f"<em>{e(FNG[D['fng_c']][lg]) if D.get('fng_c') in FNG else ''}</em></div>")
    if D.get("fund") is not None:
        fk = "fund_hot" if D["fund"] >= 0.03 else "fund_neg" if D["fund"] < 0 else "fund_ok"
        k.append(f"<div class='tr-kpi'><small>{e(T['k_fund'][lg])}</small><b>{n_(format(D['fund'], '+.4f').replace('-', '−') + '%')}</b>"
                 f"<em>{e(T[fk][lg])}</em></div>")
    if D.get("chg") is not None:
        k.append(f"<div class='tr-kpi'><small>{e(T['k_chg'][lg])}</small><b>{pct_raw(D['chg'])}</b><em></em></div>")
    if not k:
        return f"<h2 class='tr-today-h'>{e(T['today'][lg])}</h2><div class='tr-today'><p class='note'>{e(T['nodata'][lg])}</p></div>"
    lv = ""
    if level and notes:
        got = [notes[x][level][lg] for x in today_keys(D) if x in notes and level in notes[x]]
        if got:
            lv = f"<div class='tr-lvnote'><b>{e(T['for_lv'][lg])}</b><ul>" + "".join(f"<li>{e(x)}</li>" for x in got) + "</ul></div>"
    return (f"<h2 class='tr-today-h'>{e(T['today'][lg])}</h2><div class='tr-today'><div class='tr-kpis'>{''.join(k)}</div>{lv}"
            f"<p class='note'>{e(T['t_note'][lg])} · {e(T['checked'][lg])}: {ts(D.get('upd'))}</p></div>")
