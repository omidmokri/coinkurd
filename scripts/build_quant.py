#!/usr/bin/env python3
"""Builds the three quant pages (fa / ckb / en in one page each, switched by the header language buttons):
    /regime/     probabilistic market-regime radar  (data/regime.json)
    /truth/      signal truth lab                   (data/truth.json)
    /anomalies/  daily anomaly hunter               (data/anomaly.json)
Run after build_pages.py (it uses the shared chrome / CSS) — same pattern as build_reality.py.
"""
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
import reality_common as R  # noqa: E402

e, L, nf, fdate = BP.e, R.L, BR.nf, BR.fdate
sec, table, tri, finish, write, slot, badge, pts = BR.sec, BR.table, BR.tri, BR.finish, BR.write, BR.slot, BR.badge, BR.pts

LABELS = ["bull", "bear", "sideways", "high_vol"]
RC = {"bull": "#22c55e", "bear": "#ef4444", "sideways": "#eab308", "high_vol": "#a855f7"}
LEVEL = {"bull": "green", "bear": "red", "sideways": "yellow", "high_vol": "orange"}

T = {
    "home": L("خانه", "ماڵەوە", "Home"),
    "hub": L("آزمایشگاه واقعیت", "تاقیگەی ڕاستی", "Reality lab"),
    "upd": L("به‌روزرسانی", "نوێکردنەوە", "Updated"),
    "nfa": L("توصیه مالی نیست", "ئامۆژگاریی دارایی نییە", "Not financial advice"),
    "nodata": L("داده هنوز آماده نیست؛ پس از اجرای بعدی ربات‌ها پر می‌شود.", "داتا هێشتا ئامادە نییە؛ دوای کارپێکردنی داهاتوو پڕ دەبێتەوە.",
                "No data yet — it fills in after the next scheduled run."),
    "method": L("روش و محدودیت‌ها", "ڕێباز و سنوورەکان", "Method and limits"),
    # ---- labels
    "bull": L("صعودی", "بەرزبوونەوە", "Bull"), "bear": L("نزولی", "دابەزین", "Bear"),
    "sideways": L("خنثی / رِنج", "مامناوەند / ڕەینج", "Sideways"), "high_vol": L("پرنوسانِ بی‌جهت", "هەڵاوسانی بێ ئاڕاستە", "Volatile, no trend"),
    # ---- regime
    "rg.title": L("رادار احتمالی رژیم بازار", "ڕاداری ئەگەری دۆخی بازاڕ", "Probabilistic market-regime radar"),
    "rg.desc": L("به‌جای یک برچسب قطعی، می‌گوید امروز بازار بیت‌کوین با چه احتمالی در هر رژیم است، مدل چقدر مطمئن است و احتمال تغییر رژیم چقدر است.",
                 "لە جیاتی یەک ناوی بڕاو، دەڵێت ئەمڕۆ بازاڕی بیتکۆین بە چ ئەگەرێک لە هەر دۆخێکدایە، مۆدێلەکە چەندە دڵنیایە و ئەگەری گۆڕانی دۆخ چەندە.",
                 "Instead of one hard label, it shows how likely each regime is for Bitcoin today, how sure the model is, and how likely a switch is."),
    "rg.now": L("امروز", "ئەمڕۆ", "Today"),
    "rg.conf": L("اطمینان مدل", "دڵنیایی مۆدێل", "Model confidence"),
    "rg.switch": L("احتمال تغییر رژیم تا فردا", "ئەگەری گۆڕانی دۆخ تا سبەی", "Chance of a switch by tomorrow"),
    "rg.days": L("روز در همین رژیم (تاریخچهٔ برون‌نمونه)", "ڕۆژ لەم دۆخەدا (مێژووی دەرەوەی نموونە)", "days in this regime (out-of-sample history)"),
    "rr.title": L("رژیم قاعده‌محور و قابل توضیح (با تأیید چندروزه)", "دۆخی یاسایی و ڕوونکراوە (بە پشتڕاستکردنەوەی چەند ڕۆژە)", "Explainable rule-based regime (multi-day confirmation)"),
    "rr.lead": L("پنج سنجهٔ شفاف با آستانه‌های ثابت رأی می‌دهند. برچسب منتشرشده فقط وقتی عوض می‌شود که رأی تازه {n} روز پشت‌سرهم تکرار شود؛ این جلوی پرش‌های بی‌دلیل را می‌گیرد.",
                 "پێنج پێوەری ڕوون بە سنووری جێگیر دەنگ دەدەن. ناوی بڵاوکراوە تەنها کاتێک دەگۆڕێت کە دەنگی نوێ {n} ڕۆژ لە دوای یەک دووبارە ببێتەوە.",
                 "Five transparent measures vote with fixed thresholds. The published label only changes once a new reading repeats for {n} days in a row, which stops pointless flip-flopping."),
    # ---- strategies per regime (scripts/regime_strats.py)
    "rs.title": L("کدام نوع استراتژی در هر رژیم جواب داده؟", "کام جۆرە ستراتیژی لە هەر دۆخێکدا سەرکەوتوو بووە؟", "Which kind of strategy worked in each regime?"),
    "rs.lead": L("چهار استراتژی ساده روی قیمت روزانهٔ بیت‌کوین از {a} تا {b}، جداگانه برای روزهای هر رژیمِ لایهٔ قاعده‌محور، با کارمزد رفت‌وبرگشت {c}. عدد، بازده خالص سالانه‌شده در روزهای همان رژیم است و بازه، اطمینان ۹۵٪ با بوت‌استرپ بلوکی ۱۰ روزه.",
                 "چوار ستراتیژیی سادە لەسەر نرخی ڕۆژانەی بیتکۆین لە {a} تا {b}، جیاجیا بۆ ڕۆژەکانی هەر دۆخێکی چینی یاسایی، بە کرێی چوون‌وهاتنی {c}. ژمارەکە قازانجی پوختی ساڵانەکراوە لە ڕۆژەکانی هەمان دۆخدا و ماوەکە متمانەی ٩٥٪ە بە بووتستراپی بلۆکیی ١٠ ڕۆژە.",
                 "Four plain strategies on Bitcoin's daily price from {a} to {b}, measured separately on the days of each rule-layer regime, with {c} round-trip costs. The number is the annualised net return on that regime's days; the range is a 95% interval from a 10-day block bootstrap."),
    "rs.th": L("استراتژی|بازده سالانه|بازهٔ ۹۵٪|روزهای در بازار|نتیجه|", "ستراتیژی|قازانجی ساڵانە|ماوەی ٩٥٪|ڕۆژانی ناو بازاڕ|ئەنجام|", "Strategy|Annualised|95% range|Days in market|Verdict|"),
    "rs.days": L("{n} روز در این رژیم", "{n} ڕۆژ لەم دۆخەدا", "{n} days in this regime"),
    "rs.now": L("رژیم فعلی", "دۆخی ئێستا", "current regime"),
    "rs.works": L("جواب داده", "سەرکەوتوو", "worked"), "rs.hurts": L("ضرر داده", "زیانی داوە", "hurt"), "rs.unclear": L("روشن نیست", "ڕوون نییە", "unclear"),
    "rs.lab": L("در آزمایشگاه", "لە تاقیگە", "In the lab"),
    "rs.none": L("در این رژیم هیچ استراتژی‌ای از نظر آماری روشن نیست؛ تفاوت‌ها می‌توانند تصادفی باشند.", "لەم دۆخەدا هیچ ستراتیژییەک لە ڕووی ئامارییەوە ڕوون نییە؛ جیاوازییەکان دەکرێت هەڵکەوت بن.", "No strategy is statistically clear in this regime; the differences may be luck."),
    "rs.best": L("بهترین عدد: {b} · بدترین: {w}", "باشترین ژمارە: {b} · خراپترین: {w}", "Best number: {b} · worst: {w}"),
    "rs.note": L("«جواب داده» یعنی کل بازهٔ ۹۵٪ بالای صفر است و «ضرر داده» یعنی کل آن زیر صفر. دکمهٔ آزمایشگاه همان استراتژی را با ورود فقط در این رژیم باز می‌کند تا خودتان با کارمزد، لغزش و آزمون جایگشت بسنجید. گذشته تضمین آینده نیست.",
                 "«سەرکەوتوو» واتە هەموو ماوەی ٩٥٪ لە سەرووی سفرە و «زیانی داوە» واتە هەمووی لە خوار سفر. دوگمەی تاقیگە هەمان ستراتیژی بە چوونەژوورەوە تەنها لەم دۆخەدا دەکاتەوە. ڕابردوو گەرەنتیی داهاتوو نییە.",
                 "\"Worked\" means the whole 95% range is above zero and \"hurt\" that it is all below. The lab button opens the same strategy with entries only in this regime, so you can test it yourself with fees, slippage and the permutation test. The past does not guarantee the future."),
    # ---- model selection (regime.py select_k)
    "ks.title": L("چند رژیم؟ انتخاب تعداد حالت‌های مدل", "چەند دۆخ؟ هەڵبژاردنی ژمارەی حاڵەتەکانی مۆدێل", "How many regimes? Choosing the number of model states"),
    "ks.lead": L("مدل با ۳ تا ۶ حالت پنهان آزموده شد. BIC و درست‌نمایی برون‌نمونه با هر حالت اضافه بهتر می‌شوند (دم‌های پهن قیمت با تکه‌های بیشتر بهتر جفت می‌شوند)، پس به‌تنهایی نمی‌توانند انتخاب کنند. معیار انتخاب این است که رژیم برون‌نمونه چقدر از بازده ۳۰ روز بعد را بیش از شانس توضیح می‌دهد؛ شانس با جابه‌جا کردن زمانی همان برچسب‌ها اندازه گرفته می‌شود.",
                 "مۆدێلەکە بە ٣ تا ٦ حاڵەتی شاراوە تاقیکرایەوە. BIC و ئەگەرپێدانی دەرەوەی نموونە بە هەر حاڵەتێکی زیادە باشتر دەبن، بۆیە بە تەنها ناتوانن هەڵبژێرن. پێوەری هەڵبژاردن ئەوەیە کە دۆخی دەرەوەی نموونە چەندە لە قازانجی ٣٠ ڕۆژی دواتر زیاتر لە هەڵکەوت ڕوون دەکاتەوە.",
                 "The model was tried with 3 to 6 hidden states. BIC and out-of-sample likelihood improve with every extra state (more pieces fit the fat tails better), so they cannot choose on their own. The criterion is how much of the next 30-day return the out-of-sample regime explains beyond chance; chance is measured by shifting the same labels in time."),
    "ks.th": L("حالت‌ها|BIC (کمتر بهتر)|درست‌نمایی برون‌نمونه در روز|توضیح بازده ۳۰ روزه بیش از شانس|میانهٔ ماندگاری|تغییر در سال", "حاڵەت|BIC (کەمتر باشتر)|ئەگەرپێدانی دەرەوەی نموونە بۆ ڕۆژ|ڕوونکردنەوەی قازانجی ٣٠ ڕۆژە زیاتر لە هەڵکەوت|ناوەندی مانەوە|گۆڕان لە ساڵدا", "States|BIC (lower is better)|Out-of-sample log-lik per day|30-day return explained beyond chance|Median run|Switches per year"),
    "ks.no_info": L("نتیجه: با هیچ تعداد حالتی، رژیم HMM بازده ماه بعد را بیش از شانس توضیح نمی‌دهد. پس ساده‌ترین مدلی که چهار نوع رژیم را نام می‌برد ({k} حالت) نگه داشته شد: این مدل وضعیت فعلی بازار (روند و نوسان) را توصیف می‌کند، نه آینده را.",
                    "ئەنجام: بە هیچ ژمارەیەکی حاڵەت، دۆخی HMM قازانجی مانگی داهاتوو زیاتر لە هەڵکەوت ڕوون ناکاتەوە. بۆیە سادەترین مۆدێل کە چوار جۆر دۆخ ناو دەبات ({k} حاڵەت) هێڵرایەوە: ئەم مۆدێلە بارودۆخی ئێستای بازاڕ وەسف دەکات، نەک داهاتوو.",
                    "Result: with no number of states does the HMM regime explain next month's return beyond chance. So the simplest model that names the four regime types ({k} states) is kept: it describes the market's present state (trend and volatility), not the future."),
    "ks.gain": L("نتیجه: {k} حالت انتخاب شد؛ حالت بعدی کمتر از ۵٪ اطلاعات اضافه می‌کرد.", "ئەنجام: {k} حاڵەت هەڵبژێردرا؛ حاڵەتی دواتر کەمتر لە ٥٪ زانیاریی زیاد دەکرد.", "Result: {k} states chosen; one more added under 5% information."),
    "ks.bic": L("BIC به‌تنهایی {k} حالت را انتخاب می‌کرد (در بازهٔ آزمودهٔ ۳ تا ۶).", "BIC بە تەنها {k} حاڵەتی هەڵدەبژارد (لە ماوەی تاقیکراوەی ٣ تا ٦).", "BIC alone would pick {k} states (of the 3 to 6 tried)."),
    "ks.used": L("در حال استفاده", "بەکاردێت", "in use"),
    "rr.score": L("امتیاز (−۱ تا +۱)", "خاڵ (−١ تا +١)", "Score (−1 to +1)"),
    "rr.raw": L("خوانش امروز (پیش از تأیید)", "خوێندنەوەی ئەمڕۆ (پێش پشتڕاستکردنەوە)", "Today's reading (before confirmation)"),
    "rr.pend": L("در انتظار تأیید: {to} — {d} از {n} روز", "چاوەڕێی پشتڕاستکردنەوە: {to} — {d} لە {n} ڕۆژ", "Awaiting confirmation: {to} — {d} of {n} days"),
    "rr.th": L("سنجه|مقدار امروز|آستانهٔ صعودی|آستانهٔ نزولی|رأی", "پێوەر|بەهای ئەمڕۆ|سنووری بەرزبوونەوە|سنووری دابەزین|دەنگ", "Measure|Today|Bullish above|Bearish below|Vote"),
    "rr.mayer": L("ضریب مایر (قیمت ÷ میانگین ۲۰۰ روزه)", "هۆکاری مەیەر (نرخ ÷ ناوەندی ٢٠٠ ڕۆژ)", "Mayer multiple (price ÷ 200-day SMA)"),
    "rr.slope": L("شیب میانگین ۲۰۰ روزه در ۲۰ روز (٪)", "لێژیی ناوەندی ٢٠٠ ڕۆژ لە ٢٠ ڕۆژدا (٪)", "200-day SMA slope over 20 days (%)"),
    "rr.wrsi": L("RSI هفتگی (۱۴)", "RSI هەفتانە (١٤)", "Weekly RSI (14)"),
    "rr.fng": L("شاخص ترس و طمع", "پێوەری ترس و تەماح", "Fear & Greed index"),
    "rr.fund": L("z فاندینگ نسبت به ۳۰ روز قبل", "z ی فاندینگ بەراورد بە ٣٠ ڕۆژی پێشوو", "Funding z-score vs previous 30 days"),
    "rr.vol": L("نوسان ۲۰ روزه در صدک {p} سال اخیر است؛ وقتی امتیاز قاطع نباشد و نوسان بالای صدک ۸۰ باشد، برچسب «پرنوسانِ بی‌جهت» است.",
                "هەڵاوسانی ٢٠ ڕۆژە لە سەدیکی {p}ی ساڵی ڕابردوودایە؛ کاتێک خاڵ یەکلاکەرەوە نەبێت و هەڵاوسان سەرووی سەدیکی ٨٠ بێت، ناوەکە «هەڵاوسانی بێ ئاڕاستە»یە.",
                "20-day volatility sits at the {p} percentile of the past year; when the score is not decisive and volatility is above the 80th percentile the label is 'volatile, no trend'."),
    "rr.stab": L("پایداری: تعداد تغییر رژیم در سال (از ۲۰۱۹)", "سەقامگیری: ژمارەی گۆڕانی دۆخ لە ساڵێکدا (لە ٢٠١٩ەوە)", "Stability: regime switches per year (since 2019)"),
    "rr.f_rule": L("قاعده‌محور با تأیید", "یاسایی بە پشتڕاستکردنەوە", "Rules, confirmed"),
    "rr.f_raw": L("قاعده‌محور بدون تأیید", "یاسایی بێ پشتڕاستکردنەوە", "Rules, unconfirmed"),
    "rr.f_hmm": L("مدل احتمالی (مارکوف)", "مۆدێلی ئەگەری (مارکۆڤ)", "Probabilistic model (HMM)"),
    "rr.strip": L("۱۴ ماه اخیر: ردیف بالا قاعده‌محور، ردیف پایین مدل احتمالی", "١٤ مانگی ڕابردوو: ڕیزی سەرەوە یاسایی، ڕیزی خوارەوە مۆدێلی ئەگەری",
                  "Last 14 months: top row rules, bottom row probabilistic model"),
    "rr.eval": L("بعد از هر برچسب قاعده‌محور چه شد؟ (۳۰ روز بعد، از ۲۰۱۹)", "دوای هەر ناوێکی یاسایی چی ڕوویدا؟ (٣٠ ڕۆژ دواتر، لە ٢٠١٩ەوە)",
                 "What followed each rule-based label? (next 30 days, since 2019)"),
    "rf.hmm": L("مدل احتمالی (مارکوف پنهان)", "مۆدێلی ئەگەری (مارکۆڤی شاراوە)", "Probabilistic model (hidden Markov)"),
    "rr.na": L("داده ندارد", "داتا نییە", "no data"),
    "rg.next": L("احتمال‌های فردا", "ئەگەرەکانی سبەی", "Tomorrow's probabilities"),
    "rg.hist": L("احتمال هر رژیم در ۱۴ ماه گذشته (برون‌نمونه)", "ئەگەری هەر دۆخێک لە ١٤ مانگی ڕابردوودا (دەرەوەی نموونە)",
                 "Probability of each regime over the last 14 months (out-of-sample)"),
    "rg.typ": L("میانگین ماندگاری این رژیم: {n} روز", "تێکڕای مانەوەی ئەم دۆخە: {n} ڕۆژ", "this regime usually lasts {n} days"),
    "rg.goes": L("اگر عوض شود، محتمل‌ترین مقصد: {to} ({p} برای فردا)", "ئەگەر بگۆڕێت، ئەگەریترین ئامانج: {to} ({p} بۆ سبەی)",
                 "if it changes, most likely next: {to} ({p} for tomorrow)"),
    "rg.trans": L("ماتریس انتقال: اگر امروز در این رژیم باشیم، فردا کجا هستیم؟", "ماتریکسی گواستنەوە: ئەگەر ئەمڕۆ لەم دۆخەدا بین، سبەی لە کوێین؟",
                  "Transition matrix: if today is in this regime, where is tomorrow?"),
    "rg.tr_lead": L("هر سطر جمعش ۱۰۰٪ است. قطر اصلی احتمال ماندن است؛ بقیهٔ خانه‌ها می‌گویند رژیم معمولاً به کجا می‌رود. این احتمال‌ها از کل دادهٔ تاریخی برآورد شده‌اند، نه پیش‌بینی قطعی.",
                    "کۆی هەر ڕیزێک ١٠٠٪ە. هێڵی سەرەکی ئەگەری مانەوەیە؛ خانەکانی تر دەڵێن دۆخەکە زۆرجار بەرەو کوێ دەچێت. ئەم ئەگەرانە لە هەموو داتای مێژوویی خەمڵێنراون، نەک پێشبینیی بڕاوە.",
                    "Each row sums to 100%. The diagonal is the chance of staying; the other cells show where the regime usually goes next. Estimated from all history, not a firm forecast."),
    "rg.tr_from": L("امروز ↓ / فردا →", "ئەمڕۆ ↓ / سبەی →", "today ↓ / tomorrow →"),
    "rg.states": L("هر رژیم در عمل یعنی چه؟", "هەر دۆخێک لە کرداردا واتای چییە؟", "What each regime actually looks like"),
    "rg.st_th": L("رژیم|بازده ۲۰ روزه|نوسان روزانه|ماندگاری|میانگین طول", "دۆخ|قازانجی ٢٠ ڕۆژ|هەڵاوسانی ڕۆژانە|مانەوە|درێژیی ناوەند",
                  "Regime|20-day return|Daily volatility|Stays next day|Average run"),
    "rg.eval": L("آیا رژیم اطلاعاتی دربارهٔ آینده دارد؟", "ئایا دۆخەکە زانیاری دەربارەی داهاتوو هەیە؟", "Does the regime say anything about what comes next?"),
    "rg.ev_lead": L("بازده و نوسان ۳۰ روز بعد، جداگانه برای روزهایی که مدل برون‌نمونه هر رژیم را محتمل‌ترین می‌دانست. نتیجه هر چه باشد منتشر می‌شود.",
                    "قازانج و هەڵاوسانی ٣٠ ڕۆژی دواتر، بۆ ئەو ڕۆژانەی مۆدێلی دەرەوەی نموونە هەر دۆخێکی بە ئەگەرترین زانیبوو. ئەنجام هەرچی بێت بڵاو دەکرێتەوە.",
                    "Return and volatility over the next 30 days, split by the regime the out-of-sample model rated most likely that day. Published whatever it shows."),
    "rg.ev_th": L("رژیم|روزها|میانگین ۳۰ روز بعد|میانه|درصد مثبت|نوسان سالانه", "دۆخ|ڕۆژ|ناوەندی ٣٠ ڕۆژ|ناوەڕاست|ڕێژەی ئەرێنی|هەڵاوسانی ساڵانە",
                  "Regime|Days|Mean next 30d|Median|% positive|Annualised vol"),
    "rg.all": L("همهٔ روزها", "هەموو ڕۆژەکان", "All days"),
    "rg.changes": L("آخرین تغییرهای رژیم", "دوایین گۆڕانەکانی دۆخ", "Latest regime changes"),
    "rg.ovl": L("پنجره‌های ۳۰ روزه روی هم می‌افتند؛ نمونهٔ مستقل واقعی حدود یک‌سی‌ام تعداد روزهاست.",
                "پەنجەرە ٣٠ ڕۆژییەکان یەکتر دەبڕن؛ نموونەی سەربەخۆی ڕاستەقینە نزیکەی یەک لە سییەکی ژمارەی ڕۆژەکانە.",
                "The 30-day windows overlap; the truly independent sample is roughly the day count divided by 30."),
    # ---- truth
    "tr.title": L("آزمایشگاه حقیقت سیگنال‌ها", "تاقیگەی ڕاستیی سیگناڵەکان", "Signal Truth Lab"),
    "tr.desc": L("سخت‌گیرانه‌ترین ممیزی همهٔ سیگنال‌های سایت: پس از کارمزد و لغزش، بک‌تست جدا از نتیجهٔ زنده، اصلاح آزمون‌های چندگانه، کالیبراسیون احتمال و تفکیک بر اساس رژیم بازار. نتیجه‌های منفی هم با همان برجستگی منتشر می‌شوند.",
                 "توندترین وردبینیی هەموو سیگناڵەکانی ماڵپەڕ: دوای کرێ و خلیسکان، باکتێست جیا لە ئەنجامی ڕاستەوخۆ، ڕاستکردنەوەی تاقیکردنەوە زۆرەکان، ڕێکخستنی ئەگەر و جیاکردنەوە بەپێی دۆخی بازاڕ. ئەنجامە نەرێنییەکانیش بە هەمان شێوە بڵاو دەکرێنەوە.",
                 "The strictest audit of every signal on the site: net of fees and slippage, backtest kept apart from live results, multiple-testing corrections, probability calibration and a split by market regime. Negative results get the same prominence."),
    "tr.cost": L("هزینهٔ فرض‌شده هر معامله: کارمزد {f}٪ + لغزش {s}٪ در هر طرف = {c}٪ رفت‌وبرگشت.",
                 "تێچووی گریمانەکراو بۆ هەر مامەڵەیەک: کرێ {f}٪ + خلیسکان {s}٪ لە هەر لایەک = {c}٪ چوون و گەڕانەوە.",
                 "Assumed cost per trade: {f}% fee + {s}% slippage per side = {c}% round trip."),
    "tr.verdicts": L("حکم‌ها", "بڕیارەکان", "Verdicts"),
    "tr.pat": L("الگوهای اسکنر (۲۴ ساعت، خالص)", "شێوازەکانی سکانەر (٢٤ کاتژمێر، پاک)", "Scanner patterns (24 h, net)"),
    "tr.pat_th": L("الگو|حکم|مبنا|زنده: n / روز|زنده: خالص|بک‌تست: خالص [۹۵٪]|p (BH / Holm)|هفته‌های مثبت|هم‌جهت؟",
                   "شێواز|بڕیار|بنەما|ڕاستەوخۆ: n / ڕۆژ|ڕاستەوخۆ: پاک|باکتێست: پاک [٩٥٪]|p (BH / Holm)|هەفتە ئەرێنییەکان|هاوئاڕاستە؟",
                   "Pattern|Verdict|Basis|Live n / days|Live net|Backtest net [95%]|p (BH / Holm)|Positive weeks|Agree?"),
    "tr.basis.live": L("زنده", "ڕاستەوخۆ", "live"), "tr.basis.bt": L("بک‌تست", "باکتێست", "backtest"),
    "tr.basis_note": L("تا وقتی نتیجهٔ زنده دست‌کم {d} روز مختلف نداشته باشد، حکم بر اساس بک‌تست است و منتظر تأیید زنده می‌ماند.",
                       "تا ئەنجامی ڕاستەوخۆ لانیکەم {d} ڕۆژی جیاوازی نەبێت، بڕیار لەسەر باکتێستە و چاوەڕێی پشتڕاستکردنەوەی ڕاستەوخۆ دەبێت.",
                       "Until live results cover at least {d} different days, the verdict rests on the backtest and awaits live confirmation."),
    "v.edge_strong": L("لبهٔ معنادار (Holm)", "لێواری بەهێز (Holm)", "Edge (Holm)"), "v.edge": L("لبهٔ احتمالی (FDR)", "لێواری ئەگەری (FDR)", "Edge (FDR)"),
    "v.maybe": L("مثبت ولی غیرمعنادار", "ئەرێنی بەڵام بێ‌واتا", "Positive, not significant"), "v.no_edge": L("بدون لبه", "بێ لێوار", "No edge"),
    "v.loses": L("پس از هزینه زیان‌ده", "دوای تێچوو زیانبەخش", "Loses after costs"), "v.too_few": L("نمونه کم", "نموونەی کەم", "Too few"),
    "tr.regime": L("الگوها در هر رژیم بازار (فقط زنده)", "شێوازەکان لە هەر دۆخێکی بازاڕدا (تەنها ڕاستەوخۆ)", "Patterns by market regime (live only)"),
    "tr.cal": L("کالیبراسیون: آیا احتمال‌ها راست می‌گویند؟", "ڕێکخستن: ئایا ئەگەرەکان ڕاست دەڵێن؟", "Calibration: do the probabilities tell the truth?"),
    "tr.cal_lead": L("هر یافتهٔ اسکنر با نرخ موفقیت بک‌تستِ الگو و سطح اطمینانش به یک احتمال تبدیل شد و روی نتیجه‌های زنده امتیاز گرفت (Brier؛ کمتر بهتر).",
                     "هەر دۆزینەوەیەکی سکانەر بە ڕێژەی سەرکەوتنی باکتێستی شێوازەکەی کرا بە ئەگەرێک و لەسەر ئەنجامە ڕاستەوخۆکان نمرەی وەرگرت (Brier؛ کەمتر باشترە).",
                     "Each scanner finding was turned into a probability from its pattern's backtest hit rate and confidence, then scored on live outcomes (Brier; lower is better)."),
    "tr.brier": L("Brier مدل", "Brier ی مۆدێل", "Model Brier"), "tr.brier_b": L("Brier نرخ پایه", "Brier ی ڕێژەی بنەڕەت", "Base-rate Brier"),
    "tr.skill": L("مهارت نسبت به نرخ پایه", "لێهاتوویی بەراورد بە بنەڕەت", "Skill vs base rate"),
    "tr.bins_th": L("بازهٔ احتمال پیش‌بینی|تعداد|میانگین پیش‌بینی|واقعی", "مەودای ئەگەری پێشبینی|ژمارە|ناوەندی پێشبینی|ڕاستەقینە",
                    "Predicted range|n|Mean predicted|Actual"),
    "tr.conf_th": L("اطمینان اسکنر|بک‌تست: n|بک‌تست: برد|زنده: n|زنده: برد", "دڵنیایی سکانەر|باکتێست: n|باکتێست: بردنەوە|ڕاستەوخۆ: n|ڕاستەوخۆ: بردنەوە",
                    "Scanner confidence|Backtest n|Backtest win|Live n|Live win"),
    "tr.crowd": L("پیش‌بینی جمعی کاربران: {n} دور با رأی، Brier = {b}", "پێشبینیی بەکۆمەڵی بەکارهێنەران: {n} خول بە دەنگ، Brier = {b}",
                  "Crowd predictions: {n} voted rounds, Brier = {b}"),
    "tr.council": L("شورای هوش مصنوعی: نرخ برد بر اساس سطح اطمینان اعلام‌شده", "ئەنجومەنی زیرەکیی دەستکرد: ڕێژەی بردنەوە بەپێی ئاستی دڵنیایی",
                    "AI council: win rate by stated confidence"),
    "tr.ledger": L("منابع دفتر ثبت (پس از هزینه)", "سەرچاوەکانی تۆمار (دوای تێچوو)", "Ledger sources (after costs)"),
    "tr.led_th": L("منبع|تسویه‌شده|روزها|دقت|خالص میانگین [۹۵٪]|حکم", "سەرچاوە|یەکلاکراوە|ڕۆژ|وردی|ناوەندی پاک [٩٥٪]|بڕیار",
                   "Source|Settled|Days|Accuracy|Mean net [95%]|Verdict"),
    "tr.sig": L("سیگنال‌های سرور (BTC روزانه، پس از هزینه، در برابر روز تصادفی)", "سیگناڵەکانی سێرڤەر (BTC ڕۆژانە، دوای تێچوو، بەراورد بە ڕۆژی هەڕەمەکی)",
                "Server signals (BTC daily, after costs, vs a random day)"),
    "tr.sig_th": L("سیگنال|جهت|افق|n|خالص میانگین|برد|روز تصادفی", "سیگناڵ|ئاڕاستە|ئاسۆ|n|ناوەندی پاک|بردنەوە|ڕۆژی هەڕەمەکی",
                   "Signal|Side|Horizon|n|Mean net|Win|Random day"),
    "long": L("خرید", "کڕین", "long"), "short": L("فروش", "فرۆشتن", "short"),
    "yes": L("بله", "بەڵێ", "yes"), "no": L("خیر", "نەخێر", "no"),
    # ---- anomalies
    "an.title": L("شکارچی ناهنجاری روزانه", "ڕاوکەری نائاسایی ڕۆژانە", "Daily anomaly hunter"),
    "an.desc": L("چه چیزی امروز از نظر آماری غیرعادی است: حجم، حرکت قیمت، سهم خریداران تهاجمی، اوپن‌اینترست و فاندینگ — هر ارز در برابر ۳۰ روز گذشتهٔ خودش.",
                 "چی ئەمڕۆ لە ڕووی ئامارییەوە نائاساییە: قەبارە، جووڵەی نرخ، بەشی کڕیارە هێرشبەرەکان، ئۆپن‌ئینترێست و فاندینگ — هەر دراوێک بەراورد بە ٣٠ ڕۆژی ڕابردووی خۆی.",
                 "What is statistically unusual today — volume, price move, aggressive-buyer share, open interest and funding — each coin against its own previous 30 days."),
    "an.now": L("همین الان (حجم ۲۴ ساعت اخیر)", "ئێستا (قەبارەی ٢٤ کاتژمێری ڕابردوو)", "Right now (last 24 h volume)"),
    "an.today": L("ناهنجاری‌های آخرین روز بسته‌شده", "نائاساییەکانی دوایین ڕۆژی داخراو", "Anomalies on the last closed day"),
    "an.th": L("ارز|بازده روز|z حجم|z حرکت|z خرید تهاجمی|تغییر OI|z فاندینگ|پرچم‌ها", "دراو|قازانجی ڕۆژ|z قەبارە|z جووڵە|z کڕینی هێرشبەر|گۆڕانی OI|z فاندینگ|ئاڵاکان",
               "Coin|Day return|Volume z|Move z|Taker-buy z|OI change|Funding z|Flags"),
    "an.none": L("امروز هیچ ارزی از آستانهٔ z ≥ ۳ عبور نکرد — این هم یک نتیجه است.", "ئەمڕۆ هیچ دراوێک لە سنووری z ≥ ٣ تێنەپەڕی — ئەمەش ئەنجامێکە.",
                 "No coin crossed z ≥ 3 today — that is a result too."),
    "an.bt": L("بعد از هر ناهنجاری چه شد؟ (بک‌تست حدود یک سال)", "دوای هەر نائاساییەک چی ڕوویدا؟ (باکتێستی نزیکەی ساڵێک)", "What followed each anomaly? (about one year back-tested)"),
    "an.bt_lead": L("بازده ۱، ۳ و ۷ روز بعد از هر پرچم در برابر همهٔ روزهای همان ارزها (خط پایه). «ادامه» یعنی چند درصد مواقع حرکت بعدی هم‌جهت روز پرچم بود. ناهنجاری سیگنال نیست.",
                    "قازانجی ١، ٣ و ٧ ڕۆژ دوای هەر ئاڵایەک بەراورد بە هەموو ڕۆژەکانی هەمان دراوەکان (هێڵی بنەڕەت). «بەردەوامی» واتە لە چەند لەسەدی جاران جووڵەی دواتر هاوئاڕاستەی ڕۆژی ئاڵاکە بوو. نائاسایی سیگناڵ نییە.",
                    "Return 1, 3 and 7 days after each flag versus every day of the same coins (baseline). 'Continuation' is how often the next move went the flag day's way. An anomaly is not a signal."),
    "an.bt_th": L("پرچم|افق|n|میانگین|درصد مثبت|میانگین قدرمطلق|ادامه", "ئاڵا|ئاسۆ|n|ناوەند|ڕێژەی ئەرێنی|ناوەندی ڕەها|بەردەوامی",
                  "Flag|Horizon|n|Mean|% up|Mean abs|Continuation"),
    "an.base": L("خط پایه (همهٔ روزها)", "هێڵی بنەڕەت (هەموو ڕۆژەکان)", "Baseline (all days)"),
    "f.vol": L("حجم غیرعادی", "قەبارەی نائاسایی", "Unusual volume"), "f.move": L("حرکت غیرعادی", "جووڵەی نائاسایی", "Unusual move"),
    "f.quiet": L("حجم بدون قیمت", "قەبارە بێ نرخ", "Volume without price"), "f.buy": L("خرید تهاجمی", "کڕینی هێرشبەر", "Aggressive buying"),
    "f.sell": L("فروش تهاجمی", "فرۆشتنی هێرشبەر", "Aggressive selling"), "f.oi": L("جهش اوپن‌اینترست", "بازدانی ئۆپن‌ئینترێست", "OI jump"),
    "f.fund": L("فاندینگ غیرعادی", "فاندینگی نائاسایی", "Unusual funding"),
    "an.now_th": L("ارز|حجم ۲۴ ساعت|z حجم|تغییر ۲۴ ساعت|فاندینگ الان / عادی", "دراو|قەبارەی ٢٤ کاتژمێر|z قەبارە|گۆڕانی ٢٤ کاتژمێر|فاندینگی ئێستا / ئاسایی",
                   "Coin|24h volume|Volume z|24h change|Funding now / usual"),
    "an.now_none": L("الان هیچ ارزی حجم غیرعادی ندارد.", "ئێستا هیچ دراوێک قەبارەی نائاسایی نییە.", "No coin has unusual volume right now."),
    "an.cover": L("{n} ارز بررسی شد؛ داده مشتقات برای {k} ارز از OKX.", "{n} دراو پشکنرا؛ داتای داتاشراو بۆ {k} دراو لە OKX.",
                  "{n} coins checked; derivatives data for {k} of them from OKX."),
    "days": L("{n} روز", "{n} ڕۆژ", "{n} d"),
}

METH = {
    "regime": L([
        "مدل: زنجیرهٔ مارکوف پنهان گاوسی با ۴ حالت، روی سه ویژگی روزانهٔ بیت‌کوین (بازده روز، لگاریتم نوسان ۱۰ روزه، بازده ۲۰ روزه) که روی بازهٔ آموزش استاندارد شده‌اند. کاملاً با پایتون ساده و بدون کتابخانهٔ آماده نوشته شده است.",
        "نام رژیم‌ها از خود داده می‌آید: حالتی با کمترین بازده ۲۰ روزه «نزولی» و با بیشترین «صعودی» است؛ از دو حالت میانی، پرنوسان‌تر «پرنوسانِ بی‌جهت» و آرام‌تر «خنثی» نام می‌گیرد.",
        "فقط کندل‌های روزانهٔ بسته‌شده؛ احتمال هر روز فقط از داده‌های همان روز و قبل از آن ساخته می‌شود (فیلتر رو به جلو، بدون نگاه به آینده).",
        "تاریخچه برون‌نمونه است: برای هر سال از ۲۰۱۹ به بعد، مدل فقط روی روزهای قبل از آن سال آموزش دیده و سپس روی آن سال اجرا شده است.",
        "احتمال‌های مدل‌های مارکوف معمولاً بیش از حد مطمئن‌اند (نزدیک ۰ یا ۱۰۰٪)؛ «احتمال تغییر» و جدول ارزیابی را جدی‌تر از عدد اطمینان بگیرید.",
        "لایهٔ قاعده‌محور هیچ پارامتری از داده یاد نمی‌گیرد: آستانه‌ها ثابت و منتشرشده‌اند، هر روز فقط از داده‌های همان روز و قبل استفاده می‌کند، و برچسب فقط پس از ۵ روز تأیید پشت‌سرهم عوض می‌شود. فاندینگ فقط برای ماه‌های اخیر موجود است.",
        "رژیم توصیف وضعیت است، نه پیش‌بینی قیمت. این صفحه توصیهٔ مالی نیست."],
        [
        "مۆدێل: زنجیرەی مارکۆڤی شاراوەی گاوسی بە ٤ دۆخ، لەسەر سێ تایبەتمەندیی ڕۆژانەی بیتکۆین (قازانجی ڕۆژ، لۆگاریتمی هەڵاوسانی ١٠ ڕۆژە، قازانجی ٢٠ ڕۆژە). تەواو بە پایتۆنی سادە نووسراوە.",
        "ناوی دۆخەکان لە خودی داتاکەوە دێت: کەمترین قازانجی ٢٠ ڕۆژە «دابەزین» و زۆرترین «بەرزبوونەوە»یە؛ لە دوو دۆخی ناوەڕاست، هەڵاوساوتر «هەڵاوسانی بێ ئاڕاستە» و ئارامتر «مامناوەند»ە.",
        "تەنها مۆمی ڕۆژانەی داخراو؛ ئەگەری هەر ڕۆژێک تەنها لە داتای ئەو ڕۆژە و پێشتر دروست دەکرێت.",
        "مێژووەکە دەرەوەی نموونەیە: بۆ هەر ساڵێک لە ٢٠١٩ بەدواوە، مۆدێل تەنها لەسەر ڕۆژەکانی پێش ئەو ساڵە ڕاهێنراوە.",
        "ئەگەرەکانی مۆدێلی مارکۆڤ زۆرجار زیادە دڵنیان؛ «ئەگەری گۆڕان» و خشتەی هەڵسەنگاندن گرنگترن.",
        "چینی یاسایی هیچ پارامەتەرێک لە داتا فێر نابێت: سنوورەکان جێگیر و بڵاوکراون، و ناوەکە تەنها دوای ٥ ڕۆژ پشتڕاستکردنەوەی لە دوای یەک دەگۆڕێت.",
        "دۆخ وەسفی بارودۆخە، نەک پێشبینیی نرخ. ئامۆژگاریی دارایی نییە."],
        [
        "Model: a 4-state Gaussian hidden Markov model on three daily Bitcoin features (day return, log 10-day volatility, 20-day return), standardised on the training window. Written in plain Python.",
        "Regime names come from the data: the state with the lowest 20-day return is bear and the highest is bull; of the two in between, the more volatile is 'volatile, no trend' and the calmer is sideways.",
        "Closed daily candles only; each day's probability uses that day and earlier only (forward filtering, no look-ahead).",
        "The history is out-of-sample: for each year from 2019 the model was trained only on the days before that year, then run through it.",
        "Hidden-Markov probabilities tend to be over-confident (near 0 or 100%); weigh the switch risk and the evaluation table more than the confidence number.",
        "The rule-based layer learns nothing from the data: thresholds are fixed and published, each day uses that day and earlier only, and the label changes only after 5 confirming days in a row. Funding exists only for recent months.",
        "A regime describes the present, it does not forecast price. Not financial advice."]),
    "truth": L([
        "نتیجهٔ هر یافته پس از کسر هزینهٔ رفت‌وبرگشت محاسبه می‌شود.",
        "بک‌تست (بازسازی‌شده) و نتیجهٔ زنده (ثبت‌شده در لحظه) جدا داوری می‌شوند؛ فقط زنده واقعاً برون‌نمونه است.",
        "یافته‌های یک روز با هم حرکت می‌کنند، پس در بوت‌استرپ کل روزها نمونه‌گیری مجدد می‌شوند (۲۰۰۰ بار). p یک‌طرفه برای «میانگین خالص > ۰» است.",
        "با ده‌ها آزمون، چند نتیجه به‌شانس خوب به نظر می‌رسند؛ اصلاح بنجامینی–هوخبرگ (نرخ کشف کاذب ۱۰٪) و هولم (۵٪) روی کل خانواده اعمال می‌شود.",
        "حکم «لبه» فقط وقتی داده می‌شود که پس از اصلاح هم معنادار بماند؛ «زیان‌ده» یعنی کل بازهٔ اطمینان ۹۵٪ زیر صفر است.",
        "میانگین مثبت بدون معناداری می‌تواند شانس یا روند کلی بازار باشد. آزمون جابه‌جایی دایره‌ای اسکنر در صفحهٔ کارنامه این اثر بازار را جدا می‌کند.",
        "این صفحه توصیهٔ مالی نیست."],
        [
        "ئەنجامی هەر دۆزینەوەیەک دوای لابردنی تێچووی چوون و گەڕانەوە حیساب دەکرێت.",
        "باکتێست و ئەنجامی ڕاستەوخۆ جیا هەڵدەسەنگێنرێن؛ تەنها ڕاستەوخۆ بەڕاستی دەرەوەی نموونەیە.",
        "دۆزینەوەکانی یەک ڕۆژ پێکەوە دەجووڵێن، بۆیە لە بووتستراپدا ڕۆژە تەواوەکان دووبارە نموونە دەکرێن (٢٠٠٠ جار).",
        "بە دەیان تاقیکردنەوە، هەندێک ئەنجام بە هەڵکەوت باش دیار دەبن؛ ڕاستکردنەوەی بنیامینی–هۆخبێرگ (١٠٪) و هۆڵم (٥٪) جێبەجێ دەکرێت.",
        "بڕیاری «لێوار» تەنها کاتێک دەدرێت کە دوای ڕاستکردنەوەش واتادار بمێنێتەوە؛ «زیانبەخش» واتە هەموو مەودای متمانەی ٩٥٪ لە خوار سفرە.",
        "ئامۆژگاریی دارایی نییە."],
        [
        "Each finding's result is taken after a full round-trip cost.",
        "Backtest (reconstructed) and live (logged in real time) results are judged separately; only live is truly out-of-sample.",
        "Findings on the same day move together, so the bootstrap resamples whole days (2,000 times). p is one-sided for 'mean net > 0'.",
        "With dozens of tests some look good by luck; Benjamini–Hochberg (10% false-discovery rate) and Holm (5%) corrections run over the whole family.",
        "'Edge' is only given when the result survives correction; 'loses' means the whole 95% interval is below zero.",
        "A positive but non-significant mean may be luck or the market's drift; the scanner's circular-shift test on the track-record page removes the market effect.",
        "Not financial advice."]),
    "anomaly": L([
        "z مقاوم: (مقدار − میانه) ÷ (۱٫۴۸۲۶ × میانهٔ انحراف مطلق) در ۳۰ روز قبلِ همان ارز؛ یک روز عجیب در پنجره، روز عجیب بعدی را پنهان نمی‌کند.",
        "حجم و قیمت از کندل روزانهٔ اسپات بایننس؛ اوپن‌اینترست و فاندینگ از قراردادهای دائمی OKX (فاندینگ به معادل ۸ ساعته تبدیل می‌شود).",
        "OKX فقط حدود یک ماه تاریخچهٔ روزانهٔ OI و فاندینگ می‌دهد؛ این دو پرچم نمایش داده می‌شوند اما بک‌تست نمی‌شوند.",
        "بخش «همین الان» حجم ۲۴ ساعت اخیر را با میانهٔ روزانهٔ ۳۰ روز مقایسه می‌کند و هر ۱۵ دقیقه به‌روز می‌شود.",
        "ناهنجاری یعنی «غیرعادی»، نه «خرید» یا «فروش». جدول بک‌تست نشان می‌دهد پس از آن به‌طور معمول چه شده است."],
        [
        "z ی بەرگە: (بەها − ناوەڕاست) ÷ (١٫٤٨٢٦ × ناوەڕاستی لادانی ڕەها) لە ٣٠ ڕۆژی پێشووی هەمان دراو.",
        "قەبارە و نرخ لە مۆمی ڕۆژانەی سپۆتی بایننس؛ ئۆپن‌ئینترێست و فاندینگ لە گرێبەستە هەمیشەییەکانی OKX.",
        "OKX تەنها نزیکەی مانگێک مێژووی ڕۆژانەی OI و فاندینگ دەدات؛ ئەم دوو ئاڵایە پیشان دەدرێن بەڵام باکتێست ناکرێن.",
        "بەشی «ئێستا» قەبارەی ٢٤ کاتژمێری ڕابردوو لەگەڵ ناوەڕاستی ٣٠ ڕۆژ بەراورد دەکات و هەر ١٥ خولەک نوێ دەبێتەوە.",
        "نائاسایی واتە «نائاسایی»، نەک «بکڕە» یان «بفرۆشە»."],
        [
        "Robust z: (value − median) ÷ (1.4826 × median absolute deviation) over the same coin's previous 30 days; one wild day in the window cannot hide the next.",
        "Volume and price from Binance spot daily candles; open interest and funding from OKX perpetual swaps (funding normalised to an 8-hour equivalent).",
        "OKX keeps only about a month of daily OI and funding history, so those two flags are shown but not back-tested.",
        "'Right now' compares the last 24 hours of volume with the 30-day daily median and refreshes every 15 minutes.",
        "An anomaly means 'unusual', not 'buy' or 'sell'. The back-test table shows what typically followed."]),
}


SCN = {"rsi_oversold": L("RSI اشباع فروش", "RSI فرۆشتنی زۆر", "RSI oversold"), "rsi_overbought": L("RSI اشباع خرید", "RSI کڕینی زۆر", "RSI overbought"),
       "ema_golden_cross": L("تقاطع طلایی EMA20/50", "یەکتربڕینی زێڕینی EMA20/50", "EMA20/50 golden cross"),
       "ema_death_cross": L("تقاطع مرگ EMA20/50", "یەکتربڕینی مردنی EMA20/50", "EMA20/50 death cross"),
       "breakout_up": L("شکست سقف ۴۸ ساعته", "شکاندنی بەرزترینی ٤٨ کاتژمێر", "48h high breakout"),
       "breakdown": L("شکست کف ۴۸ ساعته", "شکاندنی نزمترینی ٤٨ کاتژمێر", "48h low breakdown"),
       "volume_spike": L("جهش حجم معاملات", "بازدانی قەبارە", "Volume spike"),
       "bull_divergence": L("واگرایی مثبت RSI", "لادانی ئەرێنی RSI", "RSI bullish divergence"),
       "bear_divergence": L("واگرایی منفی RSI", "لادانی نەرێنی RSI", "RSI bearish divergence")}


def pname(k, lg):
    x = SCN.get(k)
    return (x.get(lg) or x["fa"]) if x else k.replace("_", " ")


def t(key, lg, **kw):
    v = T[key].get(lg) or T[key]["fa"]
    return v.format(**kw) if kw else v


def cols(key, lg):
    return t(key, lg).split("|")


def head(lg, tkey, dkey):
    return (f"<div class='meta'><a href='/'>{t('home', lg)}</a> / <a href='/reality/'>{t('hub', lg)}</a> / {e(t(tkey, lg))}</div>"
            f"<h1>{e(t(tkey, lg))}</h1><p class='rc-lead'>{e(t(dkey, lg))}</p>")


def meth(key, lg):
    items = "".join(f"<li>{e(x)}</li>" for x in (METH[key].get(lg) or METH[key]["fa"]))
    return f"<details class='rc-meth'><summary>{t('method', lg)}</summary><ul>{items}</ul></details>"


def updated(lg, iso):
    if not iso:
        return f"<p class='note'>{t('nodata', lg)}</p>"
    return f"<p class='note'>{t('upd', lg)}: {fdate(iso, lg, True)} · {t('nfa', lg)}</p>"


def pct(x, lg, d=1, sign=False):
    return f"<bdi dir='ltr'>{nf(x, lg, d, sign, True)}</bdi>"


def cls(x):
    return "up" if (x or 0) > 0 else "down" if (x or 0) < 0 else "mut"


def rule_html(g, lg):
    rl = g.get("rule") or {}
    rn = rl.get("now") or {}
    if not rn:
        return ""
    n = rl.get("confirm_days", 5)
    lab = rn["label"]
    h = (f"<div class='rc-card'><p class='mut'>{fdate(rn['date'], lg)}</p><p><span class='rc-big' style='color:{RC[lab]}'>{e(t(lab, lg))}</span></p>"
         f"<p>{t('rr.score', lg)}: <b class='rc-num {cls(rn['score'])}'>{nf(rn['score'], lg, 2, rn['score'] != 0)}</b> · {t('rr.raw', lg)}: <b style='color:{RC[rn['raw']]}'>{e(t(rn['raw'], lg))}</b></p>")
    pe = rn.get("pending")
    if pe and pe.get("to"):
        h += f"<p class='note'>⏳ {t('rr.pend', lg, to=e(t(pe['to'], lg)), d=nf(pe['days'], lg), n=nf(pe['need'], lg))}</p>"
    h += "</div>"
    rows = []
    for d in rn.get("dims") or []:
        v, vote, th = d["v"], d["vote"], d["th"]
        dec = 3 if d["k"] == "mayer" else 1 if d["k"] in ("slope", "wrsi", "fund") else 0
        vtxt = "—" if vote is None else (f"<b class='up'>{nf(1, lg, 0, True)}</b>" if vote > 0 else f"<b class='down'>{nf(-1, lg)}</b>" if vote < 0 else f"<span class='mut'>{nf(0, lg)}</span>")
        rows.append(f"<tr><td class='wrap'>{e(t('rr.' + d['k'], lg))}</td><td>{'<span class=mut>' + t('rr.na', lg) + '</span>' if v is None else '<span class=rc-num>' + nf(v, lg, dec) + '</span>'}</td>"
                    f"<td><span class='rc-num'>{nf(th[0], lg, 2 if d['k'] == 'mayer' else 0)}</span></td><td><span class='rc-num'>{nf(th[1], lg, 2 if d['k'] == 'mayer' else 0)}</span></td><td>{vtxt}</td></tr>")
    h += table(cols("rr.th", lg), rows)
    if rn.get("vol_pct") is not None:
        h += f"<p class='note'>{t('rr.vol', lg, p=nf(100 * rn['vol_pct'], lg, 0))}</p>"
    fl = rl.get("flips") or {}
    if fl:
        h += f"<h3>{t('rr.stab', lg)}</h3><div class='rc-kpis'>" + "".join(
            f"<div class='rc-kpi'><small>{t(k, lg)}</small><b>{nf(fl.get(v), lg, 1)}</b></div>" for k, v in (("rr.f_rule", "rule"), ("rr.f_raw", "raw"), ("rr.f_hmm", "hmm"))) + "</div>"
    hist = rl.get("history") or []
    if len(hist) > 30:
        W, H = 840, 46
        bw = W / len(hist)
        rects = []
        for i, x in enumerate(hist):
            rects.append(f"<rect x='{i * bw:.2f}' y='0' width='{bw + .3:.2f}' height='20' fill='{RC[LABELS[x['l']]]}'/>")
            if x.get("h") is not None:
                rects.append(f"<rect x='{i * bw:.2f}' y='26' width='{bw + .3:.2f}' height='20' fill='{RC[LABELS[x['h']]]}'/>")
        leg = "".join(f"<span><i style='background:{RC[k]}'></i>{e(t(k, lg))}</span>" for k in RC)
        # time runs left to right in every language (like the charts); dates sit inside the picture so page direction cannot swap them
        h += (f"<h3>{t('rr.strip', lg)}</h3><div class='rc-legend'>{leg}</div><svg viewBox='0 0 {W} {H + 20}' "
              f"style='width:100%;direction:ltr;border-radius:8px' role='img'>{''.join(rects)}"
              f"<text x='90' y='{H + 16}' fill='#9a9a94' font-size='13' text-anchor='middle'>{fdate(hist[0]['d'], lg)}</text>"
              f"<text x='{W - 90}' y='{H + 16}' fill='#9a9a94' font-size='13' text-anchor='middle'>{fdate(hist[-1]['d'], lg)}</text></svg>")
    ev = rl.get("eval") or {}
    if ev:
        rows = []
        for k in list(RC) + ["all"]:
            x = ev.get(k) or {}
            name = badge(LEVEL[k], t(k, lg)) if k in RC else f"<b>{t('rg.all', lg)}</b>"
            if not x.get("n"):
                rows.append(f"<tr><td>{name}</td><td>{nf(0, lg)}</td><td colspan='4' class='mut'>—</td></tr>")
                continue
            rows.append(f"<tr><td>{name}</td><td>{nf(x['n'], lg)}</td><td class='{cls(x['fwd30_mean'])}'>{pct(x['fwd30_mean'], lg, 2, True)}</td>"
                        f"<td>{pct(x['fwd30_median'], lg, 2, True)}</td><td>{pct(x['fwd30_up'], lg, 1)}</td><td>{pct(x['fwd30_vol'], lg, 1)}</td></tr>")
        h += f"<h3>{t('rr.eval', lg)}</h3>" + table(cols("rg.ev_th", lg), rows) + f"<p class='note'>{t('rg.ovl', lg)}</p>"
    return sec(t("rr.title", lg), h, "rules", lead=e(t("rr.lead", lg, n=nf(n, lg))))


# ================================================================== /regime/
def strats_html(lg):
    d = R.load("regime_strats.json", {})
    by = d.get("by") or {}
    if not by:
        return ""
    fams = d.get("families") or {}
    cur = d.get("now")
    cost = nf(d.get("cost_round_trip_pct") or 0.3, lg, 1, pct=True)
    out = ""
    for lb in ("bull", "bear", "sideways"):
        b = by.get(lb)
        if not b or not b.get("fam"):
            continue
        rows = []
        for k in ("trend", "dip", "short", "hold"):
            x = b["fam"].get(k)
            if not x:
                continue
            vt = x["verdict"]
            tag = badge({"works": "green", "hurts": "red"}.get(vt, "none"), t("rs." + vt, lg))
            z = lambda v: 0 if abs(v) < 0.5 else v  # noqa: E731  (no "−0%")
            rng_ = "—" if x["lo"] is None else f"{pct(z(x['lo']), lg, 0, z(x['lo']) != 0)} … {pct(z(x['hi']), lg, 0, z(x['hi']) != 0)}"
            btn = f"<a class='rc-btn2' href='{e(x['lab'])}'>🧪 {t('rs.lab', lg)}</a>" if x.get("lab") else ""
            name = (fams.get(k) or {}).get("n") or [k, k, k]
            rows.append(f"<tr><td>{e(name[{'fa': 0, 'ckb': 1, 'en': 2}[lg]])}</td><td class='{cls(z(x['ann']))}'>{pct(z(x['ann']), lg, 0, z(x['ann']) != 0)}</td>"
                        f"<td>{rng_}</td><td>{pct(x['in_mkt'], lg, 0)}</td><td>{tag}</td><td>{btn}</td></tr>")
        clear = [k for k, x in b["fam"].items() if k != "hold" and x["verdict"] != "unclear"]
        nm = lambda k: e(((fams.get(k) or {}).get("n") or [k, k, k])[{"fa": 0, "ckb": 1, "en": 2}[lg]])  # noqa: E731
        foot = (f"<p class='note'>{t('rs.none', lg)}</p>" if not clear else
                f"<p class='note'>{t('rs.best', lg, b=nm(b['best']), w=nm(b['worst']))}</p>")
        now_tag = f" <span class='rc-pill'>📍 {t('rs.now', lg)}</span>" if lb == cur else ""
        out += (f"<div class='rc-card' style='border-inline-start:4px solid {RC[lb]}'><h3>{badge(LEVEL[lb], t(lb, lg))}{now_tag} "
                f"<small class='mut'>{t('rs.days', lg, n=nf(b['days'], lg))}</small></h3>"
                f"{table(cols('rs.th', lg), rows)}{foot}</div>")
    lead = e(t("rs.lead", lg, a=fdate(d.get("from"), lg), b=fdate(d.get("to"), lg), c=cost))
    return sec(t("rs.title", lg), out + f"<p class='note'>{t('rs.note', lg)}</p>", id_="strategies", lead=lead)


def select_html(g, lg):
    sel = g.get("select") or {}
    rows_ = sel.get("rows") or []
    if not rows_:
        return ""
    k_now = (g.get("model") or {}).get("K")
    rows = []
    for r in rows_:
        mark = f" {badge('green', t('ks.used', lg))}" if r["k"] == k_now else ""
        rows.append(f"<tr><td><b>{nf(r['k'], lg)}</b>{mark}</td><td>{nf(r['bic'], lg, 0)}</td><td>{nf(r['oos_ll_day'], lg, 3)}</td>"
                    f"<td class='{cls(r['info'])}'>{pct(100 * r['info'], lg, 1, True)}</td><td>{t('days', lg, n=nf(r['median_run'], lg))}</td>"
                    f"<td>{nf(r['flips_year'], lg, 1)}</td></tr>")
    res = t("ks.no_info", lg, k=nf(sel.get("chosen"), lg)) if sel.get("rule") == "no_info" else t("ks.gain", lg, k=nf(sel.get("chosen"), lg))
    foot = f"<p><b>{e(res)}</b></p><p class='note'>{t('ks.bic', lg, k=nf(sel.get('bic_best'), lg))}</p>"
    return sec(t("ks.title", lg), table(cols("ks.th", lg), rows) + foot, id_="states", lead=e(t("ks.lead", lg)))


def build_regime():
    g = R.load("regime.json", {})
    now = g.get("now") or {}
    hist = g.get("history") or []

    def b(lg):
        h = head(lg, "rg.title", "rg.desc")
        if not now:
            return h + updated(lg, None)
        top = now["top"]
        probs = now.get("probs") or {}
        bars = "".join(
            f"<div style='margin:7px 0'><div style='display:flex;justify-content:space-between'><span>{e(t(k, lg))}</span>"
            f"<b class='rc-num'>{nf(100 * probs.get(k, 0), lg, 1, pct=True)}</b></div>"
            f"<div class='rc-bar'><i style='width:{100 * probs.get(k, 0):.1f}%;background:{RC[k]}'></i></div></div>" for k in RC)
        h += (f"<div class='rc-card'><p class='mut'>{t('rg.now', lg)} · {fdate(now['date'], lg)} · BTC <span class='rc-num'>{BR.money(now.get('price'), lg)}</span></p>"
              f"<p><span class='rc-big' style='color:{RC[top]}'>{e(t(top, lg))}</span></p>{bars}</div>")
        h += (f"<div class='rc-kpis'><div class='rc-kpi'><small>{t('rg.conf', lg)}</small><b>{pct(100 * now['confidence'], lg, 1)}</b></div>"
              f"<div class='rc-kpi'><small>{t('rg.switch', lg)}</small><b>{pct(100 * now['switch_risk'], lg, 1)}</b></div>"
              f"<div class='rc-kpi'><small>{t('rg.days', lg)}</small><b>{nf(now.get('days_in'), lg)}</b></div></div>")
        nx = now.get("next") or {}
        h += rule_html(g, lg)
        h += strats_html(lg)
        h += sec(t("rg.next", lg), " ".join(f"<span class='rc-pill'><b style='color:{RC[k]}'>{e(t(k, lg))}</b> {pct(100 * nx.get(k, 0), lg, 1)}</span>" for k in RC))
        if len(hist) > 20:
            leg = "".join(f"<span><i style='background:{RC[k]}'></i>{e(t(k, lg))}</span>" for k in RC)
            h += sec(t("rg.hist", lg), f"<div class='rc-legend'>{leg}</div>" + slot("rg-hist"))
        st = g.get("states") or {}
        if st:
            rows = [f"<tr><td>{badge(LEVEL[k], t(k, lg))}{' ×' + nf(st[k]['states'], lg) if st[k].get('states', 1) > 1 else ''}</td><td>{pct(st[k]['mom20_pct'], lg, 1, True)}</td><td>{pct(st[k]['vol10_pct'], lg, 2)}</td>"
                    f"<td>{pct(100 * st[k]['stay'], lg, 1)}</td><td>{t('days', lg, n=nf(st[k]['mean_days'], lg, 1))}</td></tr>" for k in RC if k in st]
            h += sec(t("rg.states", lg), table(cols("rg.st_th", lg), rows))
        tr = g.get("trans") or {}
        if tr:
            ks = [k for k in RC if k in tr]
            head_row = [e(t("rg.tr_from", lg))] + [badge(LEVEL[k], t(k, lg)) for k in ks]
            rows = [f"<tr><td>{badge(LEVEL[a], t(a, lg))}</td>" + "".join(
                        f"<td style='background:rgba(247,147,26,{min(0.55, tr[a].get(b, 0) * 0.6):.2f})'>"
                        f"{'<b>' if a == b else ''}{pct(100 * tr[a].get(b, 0), lg, 1)}{'</b>' if a == b else ''}</td>" for b in ks) + "</tr>" for a in ks]
            h += sec(t("rg.trans", lg), table(head_row, rows), lead=e(t("rg.tr_lead", lg)))
        ev = g.get("eval") or {}
        if ev:
            rows = []
            for k in list(RC) + ["all"]:
                x = ev.get(k) or {}
                name = badge(LEVEL[k], t(k, lg)) if k in RC else f"<b>{t('rg.all', lg)}</b>"
                if not x.get("n"):
                    rows.append(f"<tr><td>{name}</td><td>{nf(0, lg)}</td><td colspan='4' class='mut'>—</td></tr>")
                    continue
                rows.append(f"<tr><td>{name}</td><td>{nf(x['n'], lg)}</td><td class='{cls(x['fwd30_mean'])}'>{pct(x['fwd30_mean'], lg, 2, True)}</td>"
                            f"<td>{pct(x['fwd30_median'], lg, 2, True)}</td><td>{pct(x['fwd30_up'], lg, 1)}</td><td>{pct(x['fwd30_vol'], lg, 1)}</td></tr>")
            h += sec(t("rg.eval", lg), table(cols("rg.ev_th", lg), rows) + f"<p class='note'>{t('rg.ovl', lg)}</p>", lead=e(t("rg.ev_lead", lg)))
        ch = g.get("changes") or []
        if ch:
            lis = "".join(f"<li>{fdate(c['d'], lg)}: {e(t(c['from'], lg))} ← {e(t(c['to'], lg))}</li>" if lg != "en"
                          else f"<li>{fdate(c['d'], lg)}: {e(t(c['from'], lg))} → {e(t(c['to'], lg))}</li>" for c in reversed(ch[-10:]))
            h += sec(t("rg.changes", lg), f"<ul class='txt'>{lis}</ul>")
        h += select_html(g, lg)
        return h + meth("regime", lg) + updated(lg, g.get("updated_at"))

    pool = js = ""
    if len(hist) > 20:
        pool = "<div id='rg-hist' class='rc-chart' style='height:260px'></div>"
        ser = []
        for i, k in enumerate(RC):
            ser.append(f"{{data:{pts([(x['d'], round(100 * x['p'][i], 1)) for x in hist])},color:'{RC[k]}',w:2}}")
        js = f"rcMulti('rg-hist',[{','.join(ser)}],{{h:260,dec:0}});"
    return [write_page("regime/", "rg.title", "rg.desc", finish(pool, tri(b), js))]


# ================================================================== /truth/
def build_truth():
    tr = R.load("truth.json", {})
    pats = ((tr.get("scanner") or {}).get("patterns")) or {}
    cost = tr.get("cost") or {}
    rules = tr.get("rules") or {}
    vlevel = {"edge_strong": "green", "edge": "green", "maybe": "yellow", "no_edge": "none", "loses": "red", "too_few": "none"}

    def ci(c, lg):
        if not c or not c.get("n"):
            return "—"
        rng = f" <small class='mut'>[{nf(c.get('lo'), lg, 2, True)} … {nf(c.get('hi'), lg, 2, True)}]</small>" if c.get("lo") is not None else ""
        return f"<span class='{cls(c['net'])}'>{pct(c['net'], lg, 2, True)}</span>{rng}"

    def b(lg):
        h = head(lg, "tr.title", "tr.desc")
        if not pats:
            return h + updated(lg, None)
        h += f"<p class='note'>{t('tr.cost', lg, f=nf(cost.get('fee_side'), lg, 2), s=nf(cost.get('slip_side'), lg, 2), c=nf(cost.get('round_trip'), lg, 2))}</p>"
        sm = tr.get("summary") or {}
        order = ("edge_strong", "edge", "maybe", "no_edge", "loses", "too_few")
        h += "<div class='rc-kpis'>" + "".join(
            f"<div class='rc-kpi'><small>{t('v.' + v, lg)}</small><b>{nf(sm.get(v, 0), lg)}</b></div>" for v in order if sm.get(v)) + "</div>"
        rows = []
        keys = sorted((k for k in pats if k != "_all"), key=lambda k: -((pats[k]["live"].get(rules.get("main_h", "24h")) or {}).get("net") or -99))
        mh = rules.get("main_h", "24h")
        for k in keys + ["_all"]:
            r = pats[k]
            lv, bt = r["live"].get(mh) or {}, r["bt"].get(mh) or {}
            c = lv if r.get("basis") == "live" else bt
            pv = "—"
            if c.get("p_bh") is not None:
                pv = f"<span class='rc-num'>{nf(c['p_bh'], lg, 3)} / {nf(c['p_holm'], lg, 3)}</span>"
            elif c.get("p") is not None:
                pv = f"<span class='rc-num mut'>{nf(c['p'], lg, 3)}</span>"
            agree = "—" if r.get("live_agrees") is None else (t("yes", lg) if r["live_agrees"] else f"<span class='down'>{t('no', lg)}</span>")
            name = f"<b>{e(pname(k, lg))}</b>" if k != "_all" else f"<b>{t('rg.all', lg)}</b>"
            rows.append(f"<tr><td>{name}</td><td>{badge(vlevel[r['verdict']], t('v.' + r['verdict'], lg))}</td>"
                        f"<td>{t('tr.basis.' + r['basis'], lg) if r.get('basis') else '—'}</td>"
                        f"<td>{nf(lv.get('n'), lg)} / {nf(lv.get('days'), lg)}</td><td>{ci(lv, lg)}</td><td>{ci(bt, lg)}</td><td>{pv}</td>"
                        f"<td>{pct(r.get('weeks_pos'), lg, 0) if r.get('weeks_pos') is not None else '—'} <small class='mut'>({nf(len(r.get('weeks') or []), lg)})</small></td>"
                        f"<td>{agree}</td></tr>")
        h += sec(t("tr.pat", lg), table(cols("tr.pat_th", lg), rows) + f"<p class='note'>{t('tr.basis_note', lg, d=nf(20, lg))}</p>", "patterns")
        # regime split
        rg_rows = []
        for k in keys:
            rg = pats[k].get("regime") or {}
            if not rg:
                continue
            cells = []
            for lb in ("bull", "bear", "sideways", "high_vol"):
                x = rg.get(lb) or {}
                cells.append(f"<td>{'—' if not x.get('n') else f'''<span class='{cls(x['mean'])}'>{pct(x['mean'], lg, 2, True)}</span> <small class='mut'>n {nf(x['n'], lg)}</small>'''}</td>")
            rg_rows.append(f"<tr><td><b>{e(pname(k, lg))}</b></td>{''.join(cells)}</tr>")
        if rg_rows:
            hdr = [t("tr.pat_th", lg).split("|")[0]] + [t(x, lg) for x in ("bull", "bear", "sideways", "high_vol")]
            h += sec(t("tr.regime", lg), table(hdr, rg_rows) + f"<p class='note'><a href='/regime/'>{t('rg.title', lg)}</a></p>", "regime")
        # calibration
        cal = tr.get("calibration") or {}
        sc = cal.get("scanner") or {}
        if sc:
            c_html = (f"<div class='rc-kpis'><div class='rc-kpi'><small>{t('tr.brier', lg)}</small><b>{nf(sc['brier'], lg, 4)}</b></div>"
                      f"<div class='rc-kpi'><small>{t('tr.brier_b', lg)}</small><b>{nf(sc['brier_base'], lg, 4)}</b></div>"
                      f"<div class='rc-kpi'><small>{t('tr.skill', lg)}</small><b class='{cls(sc.get('skill'))}'>{pct(100 * (sc.get('skill') or 0), lg, 1, True)}</b></div>"
                      f"<div class='rc-kpi'><small>n</small><b>{nf(sc['n'], lg)}</b></div></div>")
            brow = [f"<tr><td>{pct(100 * x['lo'], lg, 0)} – {pct(100 * x['hi'], lg, 0)}</td><td>{nf(x['n'], lg)}</td><td>{pct(x['pred'], lg, 1)}</td>"
                    f"<td><b>{pct(x['real'], lg, 1)}</b></td></tr>" for x in sc.get("bins") or []]
            c_html += table(cols("tr.bins_th", lg), brow)
            crow = [f"<tr><td>{e(c)}</td><td>{nf(v.get('bt_n'), lg)}</td><td>{pct(v.get('bt_win'), lg, 1)}</td><td>{nf(v.get('live_n'), lg)}</td>"
                    f"<td>{pct(v.get('live_win'), lg, 1)}</td></tr>" for c, v in (sc.get("conf") or {}).items()]
            c_html += table(cols("tr.conf_th", lg), crow)
            cr = cal.get("crowd") or {}
            if cr.get("n"):
                c_html += f"<p class='note'>{t('tr.crowd', lg, n=nf(cr['n'], lg), b=nf(cr['brier'], lg, 3))} · {t('v.too_few', lg) if cr['n'] < 30 else ''}</p>"
            co = cal.get("council") or {}
            if co:
                c_html += f"<h3>{t('tr.council', lg)}</h3><p>" + " ".join(
                    f"<span class='rc-pill'>{nf(int(k), lg)}/{nf(5, lg)}: {pct(v['win'], lg, 0)} <small>(n {nf(v['n'], lg)})</small></span>" for k, v in co.items()) + "</p>"
            h += sec(t("tr.cal", lg), c_html, "calibration", lead=e(t("tr.cal_lead", lg)))
        # ledger
        led = tr.get("ledger") or {}
        if led:
            rows = [f"<tr><td>{e(BR.src_name(R.load('ledger.json', {}), k, lg))}</td><td>{nf(v['n'], lg)}</td><td>{nf(v.get('days'), lg)}</td><td>{pct(v['acc'], lg, 1)}</td>"
                    f"<td>{ci(v, lg)}</td><td>{badge(vlevel.get(v['verdict'], 'none'), t('v.' + v['verdict'], lg))}</td></tr>"
                    for k, v in sorted(led.items(), key=lambda kv: -kv[1]["n"])]
            h += sec(t("tr.ledger", lg), table(cols("tr.led_th", lg), rows) + "<p class='note'><a href='/ledger/'>/ledger/</a></p>", "ledger")
        sg = tr.get("signals") or {}
        if sg:
            rows = []
            for v in sg.values():
                for hz, c in v["res"].items():
                    rows.append(f"<tr><td>{e(v['ind'])}</td><td>{t(v['side'], lg)}</td><td>{e(hz)}</td><td>{nf(c['n'], lg)}</td>"
                                f"<td class='{cls(c['mean'])}'>{pct(c['mean'], lg, 2, True)}</td><td>{pct(c['win'], lg, 0)}</td>"
                                f"<td>{pct(c['base'], lg, 2, True) if c.get('base') is not None else '—'}</td></tr>")
            h += sec(t("tr.sig", lg), table(cols("tr.sig_th", lg), rows), "signals")
        h += f"<p class='note'>JSON: <a href='/data/truth.json'>truth.json</a> · <a href='/track-record/'>/track-record/</a></p>"
        return h + meth("truth", lg) + updated(lg, tr.get("updated_at"))

    return [write_page("truth/", "tr.title", "tr.desc", finish("", tri(b)))]


# ================================================================== /anomalies/
def build_anomalies():
    an = R.load("anomaly.json", {})
    today = an.get("today") or []

    def flags_html(fl, lg):
        return " ".join(f"<span class='rc-pill'>{e(t('f.' + f, lg))}</span>" for f in fl) or "<span class='mut'>—</span>"

    def zc(z, lg="en"):
        if z is None:
            return "<span class='mut'>—</span>"
        st = " style='color:#f97316;font-weight:800'" if abs(z) >= an.get("z", 3) else ""
        return f"<span class='rc-num'{st}>{nf(z, lg, 1, True)}</span>"

    def b(lg):
        h = head(lg, "an.title", "an.desc")
        if not today:
            return h + updated(lg, None)
        cnt = an.get("counts") or {}
        h += "<div class='rc-kpis'>" + "".join(
            f"<div class='rc-kpi'><small>{t('f.' + f, lg)}</small><b>{nf(cnt.get(f, 0), lg)}</b></div>" for f in ("vol", "move", "quiet", "buy", "sell", "oi", "fund")) + "</div>"
        nw = (an.get("now") or {})
        if nw.get("hot"):
            rows = [f"<tr><td><a href='/coins/{e(x['coin'].lower())}/'><b>{e(x['coin'])}</b></a></td><td class='rc-num'>${BR.money(x.get('vol24'), lg)}</td>"
                    f"<td>{zc(x.get('vol_z'), lg)}</td><td class='{cls(x.get('chg24'))}'>{pct(x.get('chg24'), lg, 2, True)}</td>"
                    f"<td class='rc-num'>{nf(x.get('fund_now'), lg, 4) if x.get('fund_now') is not None else '—'} / {nf(x.get('fund_base'), lg, 4) if x.get('fund_base') is not None else '—'}</td></tr>"
                    for x in nw["hot"]]
            inner = table(cols("an.now_th", lg), rows)
        else:
            inner = f"<p class='mut'>{t('an.now_none', lg)}</p>"
        h += sec(t("an.now", lg), inner + (f"<p class='note'>{t('upd', lg)}: {fdate(nw.get('at'), lg, True)}</p>" if nw.get("at") else ""), "now")
        flagged = [r for r in today if r["flags"]]
        rows = []
        for r in (flagged or today[:10]):
            oi = r.get("oi") or {}
            fd = r.get("fund") or {}
            rows.append(f"<tr><td><a href='/coins/{e(r['coin'].lower())}/'><b>{e(r['coin'])}</b></a></td><td class='{cls(r['ret'])}'>{pct(r['ret'], lg, 2, True)}</td>"
                        f"<td>{zc(r['z'].get('vol'), lg)}</td><td>{zc(r['z'].get('move'), lg)}</td><td>{zc(r['z'].get('taker'), lg)}</td>"
                        f"<td>{pct(oi.get('chg'), lg, 1, True) if oi.get('chg') is not None else '—'} {zc(oi.get('z'), lg) if oi else ''}</td>"
                        f"<td>{zc(fd.get('z'), lg)}</td><td>{flags_html(r['flags'], lg)}</td></tr>")
        note = "" if flagged else f"<p class='note'>{t('an.none', lg)}</p>"
        h += sec(f"{t('an.today', lg)} · {fdate(an.get('day'), lg)}", note + table(cols("an.th", lg), rows)
                 + f"<p class='note'>{t('an.cover', lg, n=nf(an.get('coins'), lg), k=nf(an.get('okx_coins'), lg))}</p>", "today")
        btd = an.get("backtest") or {}
        if btd.get("base"):
            rows = []
            for f in ["base", "vol", "move", "quiet", "buy", "sell"]:
                x = btd.get(f) or {}
                name = f"<b>{t('an.base', lg)}</b>" if f == "base" else f"<b>{t('f.' + f, lg)}</b>"
                for hz in ("1d", "3d", "7d"):
                    c = x.get(hz) or {}
                    if not c.get("n"):
                        continue
                    rows.append(f"<tr><td>{name if hz == '1d' else ''}</td><td>{e(hz)}</td><td>{nf(c['n'], lg)}</td>"
                                f"<td class='{cls(c['mean'])}'>{pct(c['mean'], lg, 2, True)}</td><td>{pct(c['up'], lg, 1)}</td><td>{pct(c['abs'], lg, 2)}</td>"
                                f"<td>{pct(c['cont'], lg, 1) if c.get('cont') is not None else '—'}</td></tr>")
            span = f"{fdate(an.get('bt_from'), lg)} – {fdate(an.get('bt_to'), lg)}"
            h += sec(t("an.bt", lg), table(cols("an.bt_th", lg), rows) + f"<p class='note'>{span}</p>", "backtest", lead=e(t("an.bt_lead", lg)))
        h += "<p class='note'>JSON: <a href='/data/anomaly.json'>anomaly.json</a></p>"
        return h + meth("anomaly", lg) + updated(lg, an.get("updated_at"))

    return [write_page("anomalies/", "an.title", "an.desc", finish("", tri(b)))]


def write_page(path, tkey, dkey, body):
    ld = {"@context": "https://schema.org", "@type": "Dataset", "name": t(tkey, "en"), "description": t(dkey, "en"),
          "url": f"https://entekhab.net/{path}", "inLanguage": ["fa", "ckb", "en"], "isAccessibleForFree": True}
    return write(path, t(tkey, "fa"), t(dkey, "fa"), body, ld)


def main():
    urls = []
    for fn in (build_regime, build_truth, build_anomalies):
        try:
            urls += fn()
        except Exception:  # noqa: BLE001
            traceback.print_exc()
            print(f"quant page failed: {fn.__name__}")
    BR.add_to_sitemap(urls)
    print("quant pages:", urls)


if __name__ == "__main__":
    main()
