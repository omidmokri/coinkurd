#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""/track-record/ — the channel's real record: what bitcoin did after the posts, against random hours.

Reads data/trackrecord.json (scripts/trackrecord.py) and renders it in Persian, Sorani and English.
Every sentence on the page is chosen by the numbers: the verdict only says "better" or "worse" when the
randomisation test says the difference is unlikely to be chance (p < 0.05); otherwise it says there is no
measurable difference. Nothing here is a stance on any post — explicit calls are scored in /ledger/.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
import reality_common as R  # noqa: E402

e = BP.e
L = R.L
ALPHA = 0.05
CODE = "https://github.com/omidmokri/coinkurd/blob/main/scripts/trackrecord.py"

S = {
    "cv_t": L("ادعا در برابر نتیجه", "بانگەشە بەرامبەر ئەنجام", "Claim versus result"),
    "cv_d": L("سه چیزی که معمولاً از یک کانال انتظار می‌رود، و آنچه دادهٔ همین آرشیو دربارهٔ هرکدام می‌گوید. «تأیید شد» فقط وقتی که احتمال تصادفی بودن کمتر از ۵٪ باشد.",
              "سێ شت کە بە زۆری لە کەناڵێک چاوەڕوان دەکرێت، و ئەوەی داتای ئەم ئەرشیفە دەربارەی هەریەکەیان دەڵێت. «پشتڕاستکرایەوە» تەنها کاتێک کە ئەگەری هەڕەمەکی بوون لە ٥٪ کەمتر بێت.",
              "Three things people usually expect from a channel, and what this archive's own data says about each. “Confirmed” only when the chance of luck is below 5%."),
    "cv_claim": L("انتظار", "چاوەڕوانی", "Expectation"),
    "cv_res": L("نتیجهٔ واقعی", "ئەنجامی ڕاستەقینە", "Real result"),
    "cv_1": L("بعد از پست، بیت‌کوین بهتر از حالت عادی حرکت می‌کند.", "دوای پۆست، بیتکۆین باشتر لە کاتی ئاسایی دەجووڵێت.", "After a post, bitcoin moves better than usual."),
    "cv_2": L("پست‌ها بیشتر از نصف وقت‌ها جهت درست را نشان می‌دهند.", "پۆستەکان زیاتر لە نیوەی کاتەکان ئاراستەی دروست پیشان دەدەن.", "Posts point the right way more often than a coin flip."),
    "cv_3": L("پست‌ها پیش از حرکت بازار می‌آیند، نه بعد از آن.", "پۆستەکان پێش جووڵەی بازاڕ دێن، نەک دوای ئەو.", "Posts come before the market moves, not after it."),
    "cv_m1": L("حرکت ۲۴ ساعته بعد از پست", "جووڵەی ٢٤ کاتژمێرە دوای پۆست", "24-hour move after a post"),
    "cv_m2": L("درصد پست‌های مثبت", "ڕێژەی پۆستە ئەرێنییەکان", "Share of positive posts"),
    "cv_m3": L("حرکت ۴ ساعت قبل از پست", "جووڵەی ٤ کاتژمێر پێش پۆست", "Move in the 4 hours before"),
    "cv_ok": L("تأیید شد", "پشتڕاستکرایەوە", "Confirmed"),
    "cv_neg": L("خلافش ثابت شد", "پێچەوانەکەی سەلمێندرا", "The opposite held"),
    "cv_no": L("با داده تأیید نشد", "بە داتا پشتڕاست نەکرایەوە", "Not confirmed by the data"),
    "sig": L("معنادار", "بەرچاو", "Significant"),
    "nsig": L("معنادار نیست", "بەرچاو نییە", "Not significant"),
    "title": L("کارنامهٔ واقعی کانال", "کارنامەی ڕاستەقینەی کەناڵ", "The channel's real track record"),
    "h1": L("بعد از پست‌های کانال، بازار واقعاً چه کرد؟", "دوای پۆستەکانی کەناڵ، بازاڕ بەڕاستی چی کرد؟",
            "After the channel posts, what did the market really do?"),
    "desc": L("هر پست کانال کنار ساعت‌های تصادفیِ همان دوره: حرکت ۲۴ ساعتهٔ بیت‌کوین، درصد مثبت‌ها، حرکت قبل از پست و نوسان — با آزمون آماری و روش قابل بازتولید.",
              "هەر پۆستێکی کەناڵ لە تەنیشت کاتژمێرە هەڕەمەکییەکانی هەمان ماوە: جووڵەی ٢٤ کاتژمێرەی بیتکۆین، ڕێژەی ئەرێنی، جووڵەی پێش پۆست و لەرزین — بە تاقیکردنەوەی ئاماری.",
              "Every channel post set against random hours of the same period: bitcoin's 24-hour move, the share of gains, the move before the post and the volatility — with a statistical test anyone can rerun."),
    "q": L("سؤالی که هر خواننده‌ای دارد: «دنبال کردن این کانال کمکی می‌کند؟» این صفحه آن را با دادهٔ خود آرشیو جواب می‌دهد، نه با ادعا.",
           "پرسیارێک کە هەموو خوێنەرێک هەیەتی: «شوێنکەوتنی ئەم کەناڵە یارمەتیدەرە؟» ئەم پەڕەیە بە داتای ئەرشیفەکە وەڵامی دەداتەوە، نەک بە بانگەشە.",
           "The question every reader has: “does following this channel help?” This page answers it with the archive's own data, not with claims."),
    "pending": L("محاسبه در جریان است؛ اولین نتیجه در به‌روزرسانی بعدی سایت (حداکثر چند دقیقه) منتشر می‌شود.",
                 "ژماردن لە جێبەجێکردندایە؛ یەکەم ئەنجام لە نوێکردنەوەی داهاتووی ماڵپەڕ بڵاو دەکرێتەوە.",
                 "The calculation is running; the first result appears with the next site update, within minutes."),
    "v_up": L("۲۴ ساعت بعد از پست‌ها، بیت‌کوین به‌طور معناداری بهتر از ساعت‌های تصادفی همان دوره حرکت کرد.",
              "٢٤ کاتژمێر دوای پۆستەکان، بیتکۆین بە شێوەیەکی بەرچاو باشتر لە کاتژمێرە هەڕەمەکییەکانی هەمان ماوە جووڵا.",
              "In the 24 hours after posts, bitcoin did measurably better than at random hours of the same period."),
    "v_dn": L("۲۴ ساعت بعد از پست‌ها، بیت‌کوین به‌طور معناداری بدتر از ساعت‌های تصادفی همان دوره حرکت کرد.",
              "٢٤ کاتژمێر دوای پۆستەکان، بیتکۆین بە شێوەیەکی بەرچاو خراپتر لە کاتژمێرە هەڕەمەکییەکانی هەمان ماوە جووڵا.",
              "In the 24 hours after posts, bitcoin did measurably worse than at random hours of the same period."),
    "v_no": L("حرکت ۲۴ ساعتهٔ بیت‌کوین بعد از پست‌ها از نظر آماری با ساعت‌های تصادفی همان دوره قابل تشخیص نیست.",
              "جووڵەی ٢٤ کاتژمێرەی بیتکۆین دوای پۆستەکان لە ڕووی ئامارییەوە لە کاتژمێرە هەڕەمەکییەکان جیا ناکرێتەوە.",
              "Bitcoin's 24-hour move after posts cannot be told apart, statistically, from random hours of the same period."),
    "after": L("بعد از پست‌ها", "دوای پۆستەکان", "After posts"),
    "random": L("ساعت‌های تصادفی", "کاتژمێرە هەڕەمەکییەکان", "Random hours"),
    "band": L("۹۵٪ نتیجه‌های تصادفی بین {a} و {b}", "٩٥٪ی ئەنجامە هەڕەمەکییەکان لە نێوان {a} و {b}", "95% of random results fall between {a} and {b}"),
    "pval": L("احتمال تصادفی بودن", "ئەگەری هەڕەمەکی بوون", "Chance it is luck"),
    "ci": L("بازهٔ اطمینان ۹۵٪ برای میانگین بعد از پست‌ها: {a} تا {b}", "مەودای متمانەی ٩٥٪ بۆ تێکڕای دوای پۆستەکان: {a} تا {b}",
            "95% confidence interval for the mean after posts: {a} to {b}"),
    "sample": L("{p} پست در {h} ساعت متفاوت و {d} روز · دورهٔ {f} تا {t}", "{p} پۆست لە {h} کاتژمێری جیاواز و {d} ڕۆژ · ماوەی {f} تا {t}",
                "{p} posts in {h} distinct hours over {d} days · {f} to {t}"),
    "m_hit": L("درصد ۲۴ساعت‌های مثبت", "ڕێژەی ٢٤ کاتژمێرە ئەرێنییەکان", "Share of 24h windows that gained"),
    "m_before": L("حرکت ۴ ساعت قبل از پست", "جووڵەی ٤ کاتژمێر پێش پۆست", "Move in the 4 hours before"),
    "m_range": L("دامنهٔ نوسان ۲۴ ساعت بعد", "مەودای لەرزینی ٢٤ کاتژمێری دواتر", "24h high-to-low range after"),
    "i_hit_up": L("پست‌ها بیشتر از شانس قبل از روزهای مثبت آمده‌اند.", "پۆستەکان زیاتر لە بەخت پێش ڕۆژە ئەرێنییەکان هاتوون.", "Posts came before gaining days more often than chance."),
    "i_hit_dn": L("پست‌ها کمتر از شانس قبل از روزهای مثبت آمده‌اند.", "پۆستەکان کەمتر لە بەخت پێش ڕۆژە ئەرێنییەکان هاتوون.", "Posts came before gaining days less often than chance."),
    "i_hit_no": L("تفاوتی با شانس دیده نمی‌شود.", "جیاوازییەک لەگەڵ بەخت نابینرێت.", "No difference from chance."),
    "i_bef_up": L("پست‌ها بیشتر بعد از یک رشد منتشر شده‌اند؛ بخشی از حرکت قبل از پست اتفاق افتاده بود.",
                  "پۆستەکان زیاتر دوای بەرزبوونەوەیەک بڵاو بوونەتەوە؛ بەشێک لە جووڵە پێش پۆست ڕوویدابوو.",
                  "Posts tended to follow a rise: part of the move had already happened."),
    "i_bef_dn": L("پست‌ها بیشتر بعد از یک افت منتشر شده‌اند.", "پۆستەکان زیاتر دوای دابەزینێک بڵاو بوونەتەوە.", "Posts tended to follow a drop."),
    "i_bef_no": L("نشانه‌ای از دنبال کردن حرکت قیمت نیست.", "نیشانەیەکی شوێنکەوتنی جووڵەی نرخ نییە.", "No sign of chasing the price."),
    "i_rng_up": L("پست‌ها در ساعت‌های پرنوسان‌تر از معمول آمده‌اند — کانال لحظه‌های پرخبر را پوشش می‌دهد.",
                  "پۆستەکان لە کاتژمێرە پڕلەرزینترەکان هاتوون — کەناڵ ساتە پڕهەواڵەکان دەگرێتەوە.",
                  "Posts came at more volatile hours than usual — the channel covers eventful moments."),
    "i_rng_dn": L("پست‌ها در ساعت‌های آرام‌تر از معمول آمده‌اند.", "پۆستەکان لە کاتژمێرە ئارامترەکان هاتوون.", "Posts came at calmer hours than usual."),
    "i_rng_no": L("نوسان بعد از پست‌ها مثل ساعت‌های عادی است.", "لەرزین دوای پۆستەکان وەک کاتژمێرە ئاساییەکانە.", "Volatility after posts is like any other hour."),
    "hist": L("توزیع حرکت ۲۴ ساعته", "دابەشبوونی جووڵەی ٢٤ کاتژمێرە", "Distribution of the 24-hour move"),
    "hist_d": L("محور افقی: حرکت ۲۴ ساعته بر حسب درصد. ارتفاع: سهم پنجره‌ها در هر بازه — نارنجی: بعد از پست‌ها، خاکستری: همهٔ ساعت‌های همان دوره.",
                "تەوەری ئاسۆیی: جووڵەی ٢٤ کاتژمێرە بە ڕێژەی سەدی. بەرزی: بەشی پەنجەرەکان — پرتەقاڵی: دوای پۆستەکان، خۆڵەمێشی: هەموو کاتژمێرەکان.",
                "Across: the 24-hour move in percent. Height: share of windows in each band — orange: after posts, grey: every hour of the same period."),
    "cats": L("به تفکیک دستهٔ پست", "بەپێی جۆری پۆست", "By kind of post"),
    "c_cat": L("دسته", "جۆر", "Kind"), "c_n": L("ساعت", "کاتژمێر", "Hours"), "c_r": L("میانگین ۲۴س", "تێکڕای ٢٤ک", "Avg 24h"),
    "c_hit": L("مثبت", "ئەرێنی", "Gained"), "c_p": L("احتمال شانس", "ئەگەری بەخت", "Chance"),
    "few": L("نمونه کم", "نموونە کەم", "too few"),
    "says": L("این عدد چه می‌گوید و چه نمی‌گوید", "ئەم ژمارەیە چی دەڵێت و چی ناڵێت", "What this number says — and what it does not"),
    "says_1": L("می‌گوید: بیت‌کوین در ۲۴ ساعتِ بعد از انتشار پست‌ها چه کرد، در مقایسه با هر ساعت دیگری از همان دوره.",
                "دەڵێت: بیتکۆین لە ٢٤ کاتژمێری دوای پۆستەکان چی کرد، بەراورد بە هەر کاتژمێرێکی تری هەمان ماوە.",
                "It says what bitcoin did in the 24 hours after posts, compared with any other hour of the same period."),
    "says_2": L("نمی‌گوید که موضع هر پست درست بود یا نه: بیشتر پست‌ها خبرند، نه پیشنهاد خرید و فروش. پیش‌بینی‌های صریح جداگانه در «دفتر عملکرد سیگنال‌ها» با قفل زمانی امتیاز می‌گیرند.",
                "نادڵێت هەڵوێستی هەر پۆستێک ڕاست بوو یان نا: زۆربەی پۆستەکان هەواڵن، نەک پێشنیاری کڕین و فرۆشتن. پێشبینییە ڕاشکاوەکان جیا لە «تۆماری ئەنجامی سیگناڵەکان» خاڵ وەردەگرن.",
                "It does not say whether each post's stance was right: most posts are news, not buy or sell calls. Explicit calls are scored separately, time-locked, in the Signal ledger."),
    "says_3": L("گذشته تضمینی برای آینده نیست. اگر روزی نتیجه بد باشد، همین‌جا همان‌طور منتشر می‌شود.",
                "ڕابردوو گەرەنتی داهاتوو نییە. ئەگەر ڕۆژێک ئەنجام خراپ بێت، هەر لێرە وەک خۆی بڵاو دەکرێتەوە.",
                "The past does not guarantee the future. If the result is ever bad, it is published here just the same."),
    "ledger": L("دفتر عملکرد سیگنال‌ها", "تۆماری ئەنجامی سیگناڵەکان", "Signal ledger"),
    "method": L("روش دقیق — قابل بازتولید", "شێوازی ورد — دووبارەکراوە", "Exact method — reproducible"),
    "m1": L("قیمت: کندل‌های ۱ ساعتهٔ BTCUSDT در Binance.", "نرخ: مۆمی ١ کاتژمێرەی BTCUSDT لە Binance.", "Prices: Binance BTCUSDT 1-hour candles."),
    "m2": L("ورود: قیمت باز شدن اولین ساعت کاملِ بعد از پست — قیمتی که خواننده واقعاً می‌توانست بگیرد. خروج: ۲۴ ساعت کامل بعد.",
            "چوونەژوورەوە: نرخی کرانەوەی یەکەم کاتژمێری تەواوی دوای پۆست. دەرچوون: ٢٤ کاتژمێری تەواو دواتر.",
            "Entry: the open of the first full hour after the post — a price a reader could really get. Exit: 24 full hours later."),
    "m3": L("چند پست در یک ساعت یک بار شمرده می‌شوند. روزهایی که چند پست دارند پنجره‌های هم‌پوشان دارند؛ برای همین آزمون «خوشه‌ای» است: هر روزِ دارای پست با یک روز تصادفی از همان دوره و همان تعداد ساعت تصادفی جایگزین می‌شود.",
            "چەند پۆست لە یەک کاتژمێردا یەک جار دەژمێردرێن. تاقیکردنەوەکە «هێشووییە»: هەر ڕۆژێکی پۆستدار بە ڕۆژێکی هەڕەمەکی و هەمان ژمارەی کاتژمێری هەڕەمەکی دەگۆڕدرێت.",
            "Several posts in one hour count once. Days with several posts have overlapping windows, so the test is clustered: each post-day is replaced by a random day of the period holding the same number of random hours."),
    "m4": L("{n} بار تکرار با بذر ثابت {s}؛ «احتمال تصادفی بودن» سهم نتیجه‌های تصادفی است که دست‌کم به همین اندازه از میانه فاصله دارند (دوطرفه). زیر ۵٪ را معنادار می‌خوانیم.",
            "{n} جار دووبارەکردنەوە بە تۆوی جێگیری {s}؛ لە خوار ٥٪ بە بەرچاو دەخوێنرێتەوە.",
            "{n} draws with the fixed seed {s}; the chance figure is the share of random results at least as far from the middle (two-sided). Below 5% counts as a real difference."),
    "m5": L("فقط پست‌های بازار با سنجش بیت‌کوین؛ کنار گذاشته شده: {o} پست با ارز دیگر (نمونهٔ کم)، {p} پست تبلیغی/تکراری، {w} پست بدون پنجرهٔ کامل.",
            "تەنها پۆستەکانی بازاڕ بە پێوانەی بیتکۆین؛ لابراو: {o} پۆست بە دراوی تر، {p} پۆستی ڕیکلام/دووبارە، {w} پۆست بێ پەنجەرەی تەواو.",
            "Market posts measured on bitcoin only; left out: {o} posts on other coins (too few), {p} promotional or repeated posts, {w} posts without a full window."),
    "code": L("کد محاسبه", "کۆدی ژماردن", "The code"), "data": L("دادهٔ خام", "داتای خاو", "Raw data"),
    "sc": L("الگوهای اسکنر — هر الگو در برابر ساعت‌های دیگر", "نەخشەکانی سکانەر — هەر نەخشەیەک بەرامبەر کاتژمێرەکانی تر", "Scanner patterns — each tested against other hours"),
    "sc_d": L("حرکت ۲۴ ساعتهٔ قیمت در جهت یافته، از ساعت کامل بعد از یافته؛ پایه: همان یافته‌ها جابه‌جا شده به ساعت‌های دیگر (آزمون جابه‌جایی دایره‌ای).",
              "جووڵەی ٢٤ کاتژمێری نرخ بە ئاراستەی دۆزینەوەکە؛ بنەما: هەمان دۆزینەوەکان گوازراونەتەوە بۆ کاتژمێرەکانی تر (تاقیکردنەوەی گواستنەوەی بازنەیی).",
              "24h move in the finding's direction from the next full hour; baseline: the same findings shifted to every other hour (circular-shift test)."),
    "sc_p": L("الگو", "نەخش", "Pattern"), "sc_n": L("تعداد", "ژمارە", "Findings"), "sc_o": L("بعد از یافته", "دوای دۆزینەوە", "After finding"),
    "sc_b": L("ساعت‌های دیگر", "کاتژمێرەکانی تر", "Other hours"), "sc_v": L("نتیجه", "ئەنجام", "Verdict"),
    "sv_better": L("بهتر از تصادف", "باشتر لە ڕێکەوت", "Better than chance"), "sv_worse": L("⚠️ در دست بازبینی (بدتر)", "⚠️ لە پێداچوونەوەدا (خراپتر)", "⚠️ Under review (worse)"),
    "sv_no_edge": L("بی‌تفاوت", "بێ جیاوازی", "No edge"), "sv_too_few": L("دادهٔ کم", "داتای کەم", "Too few"),
    "sc_all": L("همهٔ یافته‌ها", "هەموو دۆزینەوەکان", "All findings"),
    "sc_mc": L("{m} الگو آزموده شد؛ با این تعداد آزمون، به‌طور تصادفی حدود {x} نتیجهٔ «معنادار» انتظار می‌رود. با آستانهٔ سخت‌گیرانهٔ بونفرونی (p < {t}) {kk} الگو معنادار می‌ماند.",
               "{m} نەخش تاقی کرانەوە؛ بە ڕێکەوت نزیکەی {x} ئەنجامی «گرنگ» چاوەڕوان دەکرێت. بە سنووری بۆنفێرۆنی (p < {t}) {kk} نەخش دەمێنێتەوە.",
               "{m} patterns were tested; by chance alone about {x} would look \u201csignificant\u201d. At the strict Bonferroni threshold (p < {t}), {kk} remain significant."),
    "sc_nd": L("آزمون اسکنر هنوز داده ندارد.", "تاقیکردنەوەی سکانەر هێشتا داتای نییە.", "No scanner audit data yet."),
}
SCN = {"rsi_oversold": L("RSI اشباع فروش", "RSI فرۆشتنی زۆر", "RSI oversold"), "rsi_overbought": L("RSI اشباع خرید", "RSI کڕینی زۆر", "RSI overbought"),
       "ema_golden_cross": L("تقاطع طلایی EMA20/50", "یەکتربڕینی زێڕینی EMA20/50", "EMA20/50 golden cross"),
       "ema_death_cross": L("تقاطع مرگ EMA20/50", "یەکتربڕینی مردنی EMA20/50", "EMA20/50 death cross"),
       "breakout_up": L("شکست سقف ۴۸ ساعته", "شکاندنی بەرزترینی ٤٨ کاتژمێر", "48h high breakout"),
       "breakdown": L("شکست کف ۴۸ ساعته", "شکاندنی نزمترینی ٤٨ کاتژمێر", "48h low breakdown"),
       "volume_spike": L("جهش حجم معاملات", "بازدانی قەبارە", "Volume spike"),
       "bull_divergence": L("واگرایی مثبت RSI", "لادانی ئەرێنی RSI", "RSI bullish divergence"),
       "bear_divergence": L("واگرایی منفی RSI", "لادانی نەرێنی RSI", "RSI bearish divergence")}
CATS = {
    "etf_institutional": L("ETF و نهادی", "ETF و دامەزراوەیی", "ETF & institutional"), "news": L("خبر بازار", "هەواڵی بازاڕ", "Market news"),
    "regulation": L("قانون‌گذاری", "یاسادانان", "Regulation"), "onchain": L("آن‌چین و داده", "ئۆنچەین و داتا", "On-chain & data"),
    "security": L("امنیت و هک", "ئاسایش و هاک", "Security & hacks"), "education": L("آموزش", "فێرکاری", "Education"),
    "technical": L("تحلیل تکنیکال", "شیکاریی تەکنیکی", "Technical analysis"), "signal": L("سیگنال", "سیگناڵ", "Signals"),
    "community": L("اطلاعیه", "ڕاگەیاندن", "Announcements"), "products": L("محصولات", "بەرهەمەکان", "Products"),
}


def s(k, lg, **kw):
    t = S[k].get(lg) or S[k]["fa"]
    return t.format(**kw) if kw else t


def pct(x, lg, d=2, sign=True):
    return f"<bdi dir='ltr'>{BR.nf(x, lg, d, sign=sign, pct=True)}</bdi>"


def pv(p, lg):
    if p is None:
        return "—"
    return f"<bdi dir='ltr'>{BR.nf(100 * p, lg, 1 if p >= 0.001 else 2, pct=True)}</bdi>"


def side(obs, t):
    """'up' / 'dn' only when the test says the difference is real"""
    if not t or t.get("p") is None or t["p"] >= ALPHA:
        return "no"
    return "up" if obs > t["mid"] else "dn"


def bonf(pats, alpha=ALPHA):
    """patterns with a verdict (n >= min_n) -> (m tested, expected false positives, threshold, k surviving)"""
    tested = [v for k, v in pats.items() if k != "_all" and v.get("verdict") in ("better", "worse", "no_edge") and v.get("p") is not None]
    m = len(tested)
    if not m:
        return 0, 0.0, None, 0
    t = alpha / m
    return m, alpha * m, t, sum(1 for v in tested if v["p"] < t)


def scanner(lg):
    a = R.load("scanaudit.json", {}) or {}
    pats = a.get("patterns") or {}
    if not pats:
        return BR.sec(s("sc", lg), f"<p class='note'>{e(s('sc_nd', lg))}</p>")
    keys = sorted((k for k in pats if k != "_all"), key=lambda k: pats[k].get("p", 1)) + (["_all"] if "_all" in pats else [])
    rows = []
    for k in keys:
        v = pats[k]
        nm = s("sc_all", lg) if k == "_all" else ((SCN.get(k) or {}).get(lg) or k)
        vd = v.get("verdict", "too_few")
        cls = "ok" if vd == "better" else "bad" if vd == "worse" else ""
        rows.append(f"<tr><td>{e(nm)}</td><td class='n'>{BR.nf(v.get('n'), lg)}</td><td class='n'>{pct(v.get('obs'), lg)}</td>"
                    f"<td class='n'>{pct(v.get('mid'), lg)}</td><td class='n'>{pv(v.get('p'), lg)}</td>"
                    f"<td><span class='tr-chip {cls}'>{e(s('sv_' + vd, lg))}</span></td></tr>")
    h = BR.table([s("sc_p", lg), s("sc_n", lg), s("sc_o", lg), s("sc_b", lg), s("c_p", lg), s("sc_v", lg)], rows, "tr-tbl")
    m, x, t, kk = bonf(pats)
    if m:
        h += f"<p class='note'>{e(s('sc_mc', lg, m=BR.nf(m, lg), x=BR.nf(x, lg, 1), t=BR.nf(t, lg, 4), kk=BR.nf(kk, lg)))}</p>"
    h += f"<p class='note'><a href='/data/scanaudit.json'>{e(s('data', lg))}</a> · {BR.fdate(a.get('updated_at', ''), lg)}</p>"
    return BR.sec(s("sc", lg), h, id_="scanner", lead=e(s("sc_d", lg)))


def histo(h, lg):
    """paired bars per band, server-side SVG — no script needed"""
    edges, a, b = h["edges"], h["post"], h["base"]
    labels = [f"<{BR.nf(edges[0], lg)}"] + [f"{BR.nf(edges[i], lg)}…{BR.nf(edges[i + 1], lg)}" for i in range(len(edges) - 1)] + [f"≥{BR.nf(edges[-1], lg)}"]
    n = len(a)
    top = max(max(a), max(b), 1)
    W, Hh, pad, bw = 640, 210, 24, 640 / n
    bars = []
    for i in range(n):
        x = i * bw
        for j, (v, col) in enumerate(((b[i], "#6b7280"), (a[i], "#f7931a"))):
            hh = (Hh - 2 * pad) * v / top
            bars.append(f"<rect x='{x + bw * 0.16 + j * bw * 0.34:.1f}' y='{Hh - pad - hh:.1f}' width='{bw * 0.32:.1f}' height='{hh:.1f}' rx='3' fill='{col}'><title>{labels[i]}% · {v}%</title></rect>")
        bars.append(f"<text x='{x + bw / 2:.1f}' y='{Hh - 6}' text-anchor='middle' font-size='10' fill='#8a8a84'>{labels[i]}</text>")
    zero = edges.index(0) + 1 if 0 in edges else None
    zl = f"<line x1='{zero * bw:.1f}' x2='{zero * bw:.1f}' y1='{pad - 8}' y2='{Hh - pad}' stroke='rgba(255,255,255,.25)' stroke-dasharray='3 4'/>" if zero else ""
    return f"<svg viewBox='0 0 {W} {Hh}' class='tr-svg' role='img' aria-label='{e(s('hist', lg))}' style='direction:ltr'>{zl}{''.join(bars)}</svg>"


DIR = {
    "h": L("آیا جهت پست‌ها درست بود؟", "ئاڕاستەی پۆستەکان ڕاست بوو؟", "Was the posts' direction right?"),
    "lead": L("هر پست با هوش مصنوعی برچسب صعودی/نزولی/خنثی خورده و برای هر برچسب جملهٔ عینی خود پست به‌عنوان مدرک نگه داشته شده. واحد شمارش «روز» است: جهت غالب پست‌های هر روز در برابر حرکت ۲۴ ساعتهٔ بیت‌کوین.",
              "هەر پۆستێک بە زیرەکی دەستکرد نیشانەی بەرزبوونەوە/دابەزین/بێلایەن دراوە و ڕستەی خودی پۆستەکە وەک بەڵگە هەڵگیراوە. یەکەی ژماردن «ڕۆژ»ە: ئاڕاستەی زاڵی پۆستەکانی هەر ڕۆژ بەرامبەر جووڵەی ٢٤ کاتژمێرەی بیتکۆین.",
              "Each post is labelled bullish / bearish / neutral by AI, with the post's own sentence kept as evidence. The unit is the day: the dominant direction of that day's posts against bitcoin's next 24 hours."),
    "hit": L("روزهایی که جهت درست بود", "ڕۆژانێک ئاڕاستە ڕاست بوو", "Days the direction was right"),
    "exp": L("انتظار از شانس (جابه‌جایی تصادفی برچسب روزها)", "چاوەڕوانی لە بەخت (تێکەڵکردنی هەڕەمەکی)", "Expected by chance (labels shuffled across days)"),
    "always": L("اگر هر روز فقط «صعودی» گفته می‌شد", "ئەگەر هەموو ڕۆژێک تەنها «بەرزبوونەوە» بگوترایە", "If every day had simply said \"bullish\""),
    "skew": L("بیشتر روزها صعودی برچسب خورده‌اند، پس این آزمون عمدتاً روزهای صعودی را می‌سنجد؛ گزارش جداگانهٔ روزهای نزولی از {m} روز نزولی به بعد.",
              "زۆربەی ڕۆژەکان بەرزبوونەوەن، بۆیە ئەم تاقیکردنەوەیە زیاتر ڕۆژانی بەرزبوونەوە دەپێوێت؛ ڕاپۆرتی جیای ڕۆژانی دابەزین لە {m} ڕۆژی دابەزینەوە.",
              "Most days are labelled bullish, so this test mostly measures bullish days; a separate bearish-day report starts at {m} bearish days."),
    "n": L("{d} روز ({b} صعودی، {r} نزولی) · {p} پست برچسب‌خورده · {f} تا {t}", "{d} ڕۆژ ({b} بەرزبوونەوە، {r} دابەزین) · {p} پۆست · {f} تا {t}",
           "{d} days ({b} bullish, {r} bearish) · {p} labelled posts · {f} to {t}"),
    "v_no": L("جهت پست‌ها بهتر از شانس نبوده است (تفاوت معنادار نیست).", "ئاڕاستەی پۆستەکان لە بەخت باشتر نەبووە (جیاوازی واتادار نییە).",
              "The posts' direction has not been better than chance (no significant difference)."),
    "v_yes": L("جهت پست‌ها به‌طور معنادار بهتر از شانس بوده است.", "ئاڕاستەی پۆستەکان بە شێوەیەکی واتادار لە بەخت باشتر بووە.",
               "The posts' direction has been significantly better than chance."),
    "few": L("هنوز روز کافی برای داوری نیست ({d} از {m}).", "هێشتا ڕۆژی پێویست نییە ({d} لە {m}).", "Not enough days to judge yet ({d} of {m})."),
    "none": L("هنوز داده‌ای نیست.", "هێشتا داتا نییە.", "No data yet."),
    "m": L("آزمون: برچسب روزها {n} بار بین همان روزها جابه‌جا شد (seed {s})؛ p یک‌طرفه = سهم جابه‌جایی‌هایی که حداقل همین تعداد روز درست داشتند. روزهای مساوی و فقط‌خنثی کنار گذاشته شده‌اند. این توصیهٔ مالی نیست.",
           "تاقیکردنەوە: نیشانەی ڕۆژەکان {n} جار تێکەڵ کران (seed {s})؛ p ی یەکلایەنە. ڕۆژە یەکسان و بێلایەنەکان دەرهێنران. ئەمە ئامۆژگاری دارایی نییە.",
           "Test: day labels shuffled {n} times across the same days (seed {s}); one-sided p = share of shuffles with at least as many right days. Tied and neutral-only days are left out. Not financial advice."),
}


def direction(lg):
    d = R.load("direction.json", {})
    if not d.get("n_days"):
        return BR.sec(s2("h", lg), f"<p class='note'>{e(s2('none', lg))}</p>", lead=e(s2("lead", lg)))
    if not d.get("enough"):
        v = s2("few", lg, d=BR.nf(d["n_days"], lg), m=BR.nf(d.get("min_days"), lg))
    else:
        v = s2("v_yes" if d["p"] < ALPHA and d["hit_rate"] > d["expected_rate"] else "v_no", lg)
    w = d.get("window") or {}
    ps = d.get("posts") or {}
    h = (f"<p class='tr-verdict'>{e(v)}</p><div class='tr-grid'>"
         f"<div class='tr-card'><h3>{e(s2('hit', lg))}</h3><div class='tr-row'><span class='v'>{pct(d['hit_rate'], lg, 1, False)}</span>"
         f"<span class='vs'>{e(s2('exp', lg))}: {pct(d['expected_rate'], lg, 1, False)}</span></div>"
         f"<div><span class='tr-chip'>{e(s('pval', lg))}: {pv(d['p'], lg)}</span></div></div>"
         + (f"<div class='tr-card'><h3>{e(s2('always', lg))}</h3><div class='tr-row'><span class='v'>{pct(d['up_rate'], lg, 1, False)}</span></div></div>" if d.get("up_rate") is not None else "")
         + "</div>"
         + (f"<p class='note'>{e(s2('skew', lg, m=BR.nf(30, lg)))}</p>" if d.get("bear_days", 0) < 30 else "")
         + f""
         f"<p class='note'>{e(s2('n', lg, d=BR.nf(d['n_days'], lg), b=BR.nf(d['bull_days'], lg), r=BR.nf(d['bear_days'], lg), p=BR.nf(sum(ps.values()), lg), f=BR.fdate(w.get('from'), lg), t=BR.fdate(w.get('to'), lg)))}</p>"
         f"<p class='note'>{e(s2('m', lg, n=BR.nf(d['method']['draws'], lg), s=d['method']['seed']))} "
         f"<a href='/data/direction.json'>{e(s('data', lg))}</a> · <a href='/data/stance.json'>stance.json</a></p>")
    return BR.sec(s2("h", lg), h, lead=e(s2("lead", lg)))


def s2(k, lg, **kw):
    t = DIR[k][lg]
    return t.format(**kw) if kw else t


CSS = """
.cv{display:grid;gap:10px}
.cv-row{display:grid;grid-template-columns:1fr 34px 1.15fr;align-items:stretch;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--card)}
.cv-c,.cv-r{padding:14px 16px}.cv-c small,.cv-r small{display:block;color:var(--mute);font-size:.74rem;margin-bottom:4px}
.cv-c p{margin:0;font-weight:700;line-height:1.7}
.cv-c{background:rgba(255,255,255,.02)}
.cv-x{position:relative}.cv-x::before{content:"";position:absolute;top:12px;bottom:12px;left:50%;width:1px;background:var(--line)}
.cv-x::after{content:"⟷";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--mute);background:var(--card);padding:4px 0;font-size:.9rem}
.cv-n{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.cv-n b{font-size:1.5rem;font-family:'Space Grotesk',monospace}.cv-n span{color:var(--mute);font-size:.8rem}
.cv-v{display:inline-block;margin-top:6px;padding:2px 10px;border-radius:99px;font-size:.78rem;font-weight:700}
.cv-row.ok{border-color:rgba(34,197,94,.45)}.cv-row.ok .cv-v{background:rgba(34,197,94,.15);color:#4ade80}
.cv-row.neg{border-color:rgba(239,68,68,.45)}.cv-row.neg .cv-v{background:rgba(239,68,68,.14);color:#f87171}
.cv-row.no .cv-v{background:rgba(255,255,255,.07);color:#cfcfc8}.cv-row.no .cv-r{background:repeating-linear-gradient(135deg,transparent 0 9px,rgba(255,255,255,.018) 9px 18px)}
@media(max-width:700px){.cv-row{grid-template-columns:1fr}.cv-x{height:22px}.cv-x::before{top:50%;bottom:auto;left:16px;right:16px;width:auto;height:1px}}
.tr-card{position:relative}.tr-sig{position:absolute;top:12px;inset-inline-end:12px;font-size:.68rem;font-weight:700;padding:1px 8px;border-radius:99px}
.tr-card.sig{border-color:rgba(247,147,26,.5);box-shadow:0 0 0 1px rgba(247,147,26,.15),0 18px 40px -26px rgba(247,147,26,.6)}
.tr-card.sig .tr-sig{background:rgba(247,147,26,.16);color:#ffb347}
.tr-card.ns{border-style:dashed}.tr-card.ns .tr-sig{background:rgba(255,255,255,.06);color:var(--mute)}.tr-card.ns .v{opacity:.8}
.tr-hero{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px 22px;margin:16px 0}
.tr-hero.up{border-color:rgba(34,197,94,.5);background:linear-gradient(180deg,rgba(34,197,94,.07),transparent 70%),var(--card)}
.tr-hero.dn{border-color:rgba(239,68,68,.45);background:linear-gradient(180deg,rgba(239,68,68,.06),transparent 70%),var(--card)}
.tr-verdict{font-size:1.12rem;font-weight:700;line-height:1.9;margin:0 0 14px}
.tr-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tr-two>div{background:rgba(255,255,255,.035);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.tr-two small{display:block;color:var(--mute);font-size:.8rem;margin-bottom:4px}
.tr-big{font-family:'Space Grotesk',Vazirmatn,monospace;font-size:1.9rem;font-weight:800;font-variant-numeric:tabular-nums}
.tr-chip{display:inline-block;border-radius:99px;padding:3px 11px;font-size:.8rem;font-weight:700;background:rgba(255,255,255,.06);color:var(--ink)}
.tr-chip.ok{background:rgba(34,197,94,.14);color:#4ade80}.tr-chip.bad{background:rgba(239,68,68,.13);color:#f87171}
.tr-meta{color:var(--mute);font-size:.84rem;margin:12px 0 0;line-height:1.9}
.tr-grid{display:grid;grid-template-columns:1fr;gap:12px;margin:14px 0}
@media(min-width:720px){.tr-grid{grid-template-columns:repeat(3,1fr)}}
.tr-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:7px}
.tr-card h3{margin:0;font-size:.9rem;color:var(--mute);font-weight:600}
.tr-row{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.tr-row .v{font-family:'Space Grotesk',monospace;font-size:1.25rem;font-weight:800}
.tr-row .vs{color:var(--mute);font-size:.82rem}
.tr-card p{margin:auto 0 0;padding-top:9px;border-top:1px solid var(--line);font-size:.84rem;line-height:1.8}
.tr-svg{width:100%;height:auto;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:8px}
.tr-says{background:rgba(247,147,26,.06);border:1px solid rgba(247,147,26,.22);border-inline-start:3px solid var(--acc);border-radius:14px;padding:12px 16px;margin:16px 0}
.tr-says li{line-height:1.95;margin:4px 0}
.tr-tbl td.n,.tr-tbl th.n{text-align:center}
"""


def claims(d, lg):
    """the three usual expectations, each set against the archive's own number, its random baseline and its p-value"""
    o, t = d["obs"], d["test"]
    rows = ""
    for i, (key, m, dg, sg) in enumerate((("r24", "cv_m1", 2, True), ("hit", "cv_m2", 1, False), ("before", "cv_m3", 2, True)), 1):
        if key not in o or key not in t:
            continue
        sd = side(o[key], t[key])
        if key == "before":
            # the claim is that posts are not late: it holds unless the move *before* posts is significant either way
            st = "neg" if sd != "no" else "ok"
        else:
            st = "no" if sd == "no" else "ok" if sd == "up" else "neg"
        verdict = {"ok": "cv_ok", "neg": "cv_neg", "no": "cv_no"}[st]
        rows += (f"<div class='cv-row {st}'><div class='cv-c'><small>{e(s('cv_claim', lg))}</small><p>{e(s('cv_' + str(i), lg))}</p></div>"
                 f"<div class='cv-x' aria-hidden='true'></div>"
                 f"<div class='cv-r'><small>{e(s('cv_res', lg))} · {e(s(m, lg))}</small>"
                 f"<div class='cv-n'><b>{pct(o[key], lg, dg, sg)}</b><span>{e(s('random', lg))}: {pct(t[key]['mid'], lg, dg, sg)}</span></div>"
                 f"<span class='cv-v'>{e(s(verdict, lg))}</span> <span class='tr-chip'>{e(s('pval', lg))}: {pv(t[key]['p'], lg)}</span></div></div>")
    return BR.sec(s("cv_t", lg), f"<div class='cv'>{rows}</div>", lead=e(s("cv_d", lg))) if rows else ""


def build():
    d = R.load("trackrecord.json", {})

    def b(lg):
        h = BR.crumbs(lg, s("title", lg)) + f"<h1>{e(s('h1', lg))}</h1><p class='rc-lead'>{e(s('q', lg))}</p>"
        if not d.get("obs"):
            return h + f"<p class='note'>{e(s('pending', lg))}</p>"
        o, t, base = d["obs"], d["test"], d["base"]
        sd = side(o["r24"], t["r24"])
        lo, hi = t["r24"]["lo"], t["r24"]["hi"]
        h += (f"<div class='tr-hero {sd}'><p class='tr-verdict'>{e(s('v_' + sd, lg))}</p><div class='tr-two'>"
              f"<div><small>{e(s('after', lg))}</small><span class='tr-big'>{pct(o['r24'], lg)}</span></div>"
              f"<div><small>{e(s('random', lg))}</small><span class='tr-big'>{pct(t['r24']['mid'], lg)}</span></div></div>"
              f"<p class='tr-meta'>{s('band', lg, a=pct(lo, lg), b=pct(hi, lg))} · {e(s('pval', lg))}: "
              f"<span class='tr-chip {'ok' if sd == 'up' else 'bad' if sd == 'dn' else ''}'>{pv(t['r24']['p'], lg)}</span><br>"
              f"{s('ci', lg, a=pct(d['ci_r24'][0], lg), b=pct(d['ci_r24'][1], lg))}<br>"
              f"{e(s('sample', lg, p=BR.nf(d['n_posts'], lg), h=BR.nf(d['n_hours'], lg), d=BR.nf(d['n_days'], lg), f=BR.fdate(d['window']['from'], lg), t=BR.fdate(d['window']['to'], lg)))}</p></div>")
        cards = []
        for key, nm, d2, sg in (("hit", "m_hit", 1, False), ("before", "m_before", 2, True), ("range", "m_range", 2, False)):
            sd2 = side(o[key], t[key])
            ik = {"hit": "i_hit_", "before": "i_bef_", "range": "i_rng_"}[key] + sd2
            sig = t[key].get("p") is not None and t[key]["p"] < ALPHA
            cards.append(f"<div class='tr-card {'sig' if sig else 'ns'}'><span class='tr-sig'>{e(s('sig' if sig else 'nsig', lg))}</span><h3>{e(s(nm, lg))}</h3><div class='tr-row'><span class='v'>{pct(o[key], lg, d2, sg)}</span>"
                         f"<span class='vs'>{e(s('random', lg))}: {pct(t[key]['mid'], lg, d2, sg)}</span></div>"
                         f"<div><span class='tr-chip'>{e(s('pval', lg))}: {pv(t[key]['p'], lg)}</span></div><p>{e(s(ik, lg))}</p></div>")
        h += claims(d, lg)
        h += "<div class='tr-grid'>" + "".join(cards) + "</div>"
        h += BR.sec(s("hist", lg), histo(d["hist"], lg), lead=e(s("hist_d", lg)))
        rows = []
        for c in d.get("cats", []):
            nm = (CATS.get(c["id"]) or {}).get(lg) or c["id"]
            p = f"<span class='mut'>{e(s('few', lg))}</span>" if c.get("small") else pv(c.get("p"), lg)
            rows.append(f"<tr><td>{e(nm)}</td><td class='n'>{BR.nf(c['n'], lg)}</td><td class='n'>{pct(c['r24'], lg)}</td>"
                        f"<td class='n'>{pct(c['hit'], lg, 0, False)}</td><td class='n'>{p}</td></tr>")
        h += BR.sec(s("cats", lg), BR.table([s("c_cat", lg), s("c_n", lg), s("c_r", lg), s("c_hit", lg), s("c_p", lg)], rows, "tr-tbl"))
        h += direction(lg)
        h += scanner(lg)
        h += (f"<div class='tr-says'><b>{e(s('says', lg))}</b><ul><li>{e(s('says_1', lg))}</li>"
              f"<li>{e(s('says_2', lg))} <a href='/ledger/'>{e(s('ledger', lg))} ←</a></li><li>{e(s('says_3', lg))}</li></ul></div>")
        m, x = d.get("method", {}), d.get("excluded", {})
        items = [s("m1", lg), s("m2", lg), s("m3", lg), s("m4", lg, n=BR.nf(m.get("draws"), lg), s=m.get("seed")),
                 s("m5", lg, o=BR.nf(x.get("other_coin", 0), lg), p=BR.nf(x.get("promo", 0), lg), w=BR.nf(x.get("no_window", 0), lg))]
        h += (f"<details class='rc-meth'><summary>{e(s('method', lg))}</summary><ul>" + "".join(f"<li>{e(i)}</li>" for i in items) +
              f"</ul><p class='note'><a href='{CODE}' rel='noopener' target='_blank'>{e(s('code', lg))} ↗</a> · "
              f"<a href='/data/trackrecord.json'>{e(s('data', lg))}</a></p></details>")
        h += BR.updated(lg, d.get("updated_at"))
        return h

    body = BR.finish("", BR.tri(b))
    extra = f"<style>{BR.RCSS}{CSS}</style>"
    ld = {"@context": "https://schema.org", "@type": "Dataset", "name": S["title"]["en"],
          "description": S["desc"]["en"], "url": f"{BP.SITE}/track-record/",
          "creator": {"@type": "Organization", "name": "Coin Kurd", "url": f"{BP.SITE}/about/"},
          "license": "https://creativecommons.org/licenses/by/4.0/",
          "distribution": [{"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": f"{BP.SITE}/data/trackrecord.json"}],
          "temporalCoverage": f"{(d.get('window') or {}).get('from', '')}/{(d.get('window') or {}).get('to', '')}",
          "isAccessibleForFree": True}
    return BP.page("track-record/", s("title", "fa") + " — " + s("h1", "fa"), s("desc", "fa"), body,
                   extra + f"<script type='application/ld+json'>{BP.sj(ld)}</script>")


def main():
    url = build()
    BR.add_to_sitemap([url])
    print("track record page:", url)


if __name__ == "__main__":
    main()
