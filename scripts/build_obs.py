#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The Observatory — /charts/ and its pages (derivatives and on-chain charts in the manner of CoinGlass, Glassnode and
CryptoQuant, from public data). One app (assets/obs/*), one static page per chart, each with its own title,
description and readable text in کوردی · فارسی · العربية · English for search engines and for visitors without
JavaScript. The shared header, footer and CSP are put in by scripts/chrome.py (these folders are in chrome.STATIC).

Run: python3 scripts/build_obs.py        (it puts the site's header, footer and CSP in by itself)
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://entekhab.net"
V = "9"            # asset version (bump with any change to assets/obs/*)
LANGS = ("fa", "ckb", "ar", "en")
HUB_PATH = "charts"


def e(s):
    return html.escape(str(s), quote=True)


# view key, folder under /charts/, scripts after i18n.js and core.js
PAGES = [
    ("liqheat", "liquidation-heatmap", ["src.js", "liqmodel.js", "liq.js"]),
    ("liqmap", "liquidation-map", ["src.js", "liqmodel.js", "liq.js"]),
    ("liqhist", "liquidations", ["src.js", "flowmath.js", "ts.js", "flow.js"]),
    ("hl", "hyperliquid", ["flowmath.js", "ts.js", "optmath.js", "opt.js", "hl.js"]),
    ("oi", "open-interest", ["src.js", "ts.js", "deriv.js"]),
    ("funding", "funding-rate", ["src.js", "ts.js", "deriv.js"]),
    ("ls", "long-short", ["src.js", "ts.js", "deriv.js"]),
    ("cvd", "cvd", ["src.js", "flowmath.js", "ts.js", "flow.js"]),
    ("basis", "basis", ["src.js", "flowmath.js", "ts.js", "prem.js"]),
    ("options", "options", ["optmath.js", "ts.js", "opt.js"]),
    ("mvrv", "mvrv", ["chainmath.js", "ts.js", "chain.js"]),
    ("flows", "exchange-flows", ["chainmath.js", "ts.js", "chain.js"]),
    ("stables", "stablecoins", ["flowmath.js", "ts.js", "prem.js"]),
    ("network", "network", ["chainmath.js", "ts.js", "chain.js"]),
    ("cycle", "bitcoin-cycle", ["chainmath.js", "ts.js", "chain.js"]),
]

T = {
    "liqheat": {
        "title": "نقشه حرارتی لیکوییدیشن بیت‌کوین و ارزها، زنده | entekhab.net",
        "desc": "نقشهٔ حرارتی لیکوییدیشن بیت‌کوین، اتریوم و صدها ارز با دادهٔ زندهٔ Binance و Bybit: ۱۲ ساعت تا ۱ سال، سه مدل شفاف، اهرم ۵ تا ۱۰۰ و لیکوییدیشن‌های واقعی.",
        "og": "نقشهٔ حرارتی لیکوییدیشن — زنده، با مدل شفاف",
        "ld": "Entekhab liquidation heatmap",
        "kw": ["لیکوییدیشن", "لیکویید", "نقشه حرارتی لیکوییدیشن", "liquidation", "liquidation heatmap", "heatmap", "لیکویدکردن", "coinglass", "کوین گلس"],
        "h1": {"fa": "نقشهٔ حرارتی لیکوییدیشن", "ckb": "نەخشەی گەرمیی لیکویدکردن", "ar": "الخريطة الحرارية للتصفيات", "en": "Liquidation heatmap"},
        "p": {"fa": "برآورد اینکه پوزیشن‌های اهرمی فیوچرز در چه قیمت‌هایی لیکویید می‌شوند — زنده از Binance و Bybit، با مدلی که روشش کامل نوشته شده",
              "ckb": "خەمڵاندنی ئەوەی پۆزیشنە لیڤەرێجدارەکانی فیوچەرز لە چ نرخێکدا لیکوید دەکرێن — زیندوو لە Binance و Bybitـەوە، بە مۆدێلێک کە ڕێگاکەی بە تەواوی نووسراوە",
              "ar": "تقدير الأسعار التي تُصفّى عندها مراكز العقود الآجلة ذات الرافعة — مباشرة من Binance وBybit، بنموذج مكتوبة طريقته كاملة",
              "en": "An estimate of the prices at which leveraged futures positions get liquidated — live from Binance and Bybit, with a model whose method is written out in full"},
        "about": {
            "fa": [("این نقشه چه نشان می‌دهد", [
                "<b>افقی زمان، عمودی قیمت:</b> هر خانه یک محدودهٔ قیمت در یک لحظه است و رنگش می‌گوید به حساب مدل چند دلار پوزیشن اهرمی در آن قیمت لیکویید می‌شود. روشن‌تر یعنی بیشتر.",
                "<b>زیر قیمت لانگ‌ها، بالای قیمت شورت‌ها:</b> اگر قیمت پایین بیاید لانگ‌ها و اگر بالا برود شورت‌ها به‌اجبار بسته می‌شوند. نواری که کندل‌ها به آن می‌رسند همان‌جا تمام می‌شود، چون آن پوزیشن‌ها لیکویید شده‌اند.",
                "<b>۱۰ بازه برای هر ارز:</b> از ۱۲ ساعت تا ۱ سال، برای هر ارزی که در Binance یا Bybit قرارداد دائمی دارد؛ تجمیعی یا هر صرافی جدا.",
                "<b>سه مدل و پنج پلهٔ اهرم:</b> اهرم‌های ۵، ۱۰، ۲۵، ۵۰ و ۱۰۰ برابر را جدا روشن و خاموش کنید و ببینید هر مدل چه تصویری می‌دهد.",
                "<b>لیکوییدیشن‌های واقعی زیر همان نقشه:</b> نوار پایین نمودار سفارش‌های لیکوییدیشنِ واقعی را نشان می‌دهد — شورت‌ها رو به بالا (سبز) و لانگ‌ها رو به پایین (قرمز)؛ OKX برای ساعت‌های گذشته و Binance یا Bybit زنده، تا وقتی صفحه باز است. با آن می‌بینید مدل کجا درست گفته و کجا نه.",
                "<b>سطوح اکنون و خوشه‌ها:</b> ستون کنار نمودار سطوحی است که همین حالا پابرجاست؛ جدول‌های زیر نمودار بزرگ‌ترین خوشه‌های بالا و پایین قیمت را با فاصله و برآورد دلاری می‌دهند.",
                "<b>ابزارها:</b> چهار پالت رنگ، آستانه برای پنهان کردن سطوح ضعیف، بزرگ‌نمایی و جابه‌جایی، تصویر PNG، لینک همین نما و تمام‌صفحه."]),
                   ("مدل چطور حساب می‌کند", [
                       "هیچ صرافی‌ای قیمت لیکوییدیشن معامله‌گرانش را منتشر نمی‌کند؛ پس این نقشه، مثل همهٔ نقشه‌های مشابه، برآورد است. فرقش این است که روشش پنهان نیست.",
                       "<b>ورودی:</b> کندل‌ها و تاریخچهٔ اوپن اینترست هر صرافی. بالا رفتن اوپن اینترست در یک کندل یعنی قرارداد تازه باز شده، و هر قرارداد یک لانگ و یک شورت دارد.",
                       "<b>قیمت لیکوییدیشن:</b> با اهرم L، لانگ در «ورود × (۱ − ۱/L + مارجین نگهداری)» و شورت در «ورود × (۱ + ۱/L − مارجین نگهداری)» بسته می‌شود. بیشترین اهرم و مارجین نگهداری هر قرارداد، هر جا در دسترس باشد، از مشخصات عمومی Bybit خوانده می‌شود.",
                       "<b>پاک شدن سطوح:</b> وقتی کف یا سقف کندلی به سطحی می‌رسد آن سطح حذف می‌شود؛ وقتی اوپن اینترست پایین می‌آید، همهٔ سطوح به همان نسبت کم می‌شوند.",
                       "<b>مدل ۱</b> فقط پوزیشن‌های تازه را می‌شمارد. <b>مدل ۲</b> لانگ و شورت را با سهم حساب‌های لانگ در همان صرافی وزن می‌دهد. <b>مدل ۳</b> ۱۰٪ حجم هر کندل را هم دست‌به‌دست شدن پوزیشن می‌گیرد تا تصویر کل اوپن اینترست را بسازد.",
                       "<b>گرم‌کردن:</b> پیش از بازهٔ روی صفحه، بسته به بازه از ۳۰ روز تا دو سال دادهٔ قدیمی‌تر پردازش می‌شود تا سطوحی که از قبل مانده‌اند هم دیده شوند."]),
                   ("محدودیت‌ها", [
                       "پله‌های اهرم و وزن برابرشان فرض است، نه داده؛ کسی نمی‌داند معامله‌گران واقعاً با چه اهرمی وارد شده‌اند.",
                       "پوزیشن‌هایی که پیش از شروع داده باز شده‌اند دیده نمی‌شوند. Binance فقط ۳۰ روز تاریخچهٔ اوپن اینترست می‌دهد؛ بازه‌های بلندتر بر دادهٔ Bybit تکیه دارند.",
                       "اندازه‌ها را نسبی بخوانید: نقشه می‌گوید لیکوییدیشن‌ها کجا شروع می‌شوند، نه اینکه قیمت به آن‌جا می‌رسد یا آن‌جا می‌ایستد.",
                       "فقط Binance و Bybit در مدل هستند. توصیهٔ مالی نیست."]),
                   ("منابع", ["دادهٔ عمومی Binance (کندل، اوپن اینترست، نسبت حساب‌ها)، Bybit (کندل، اوپن اینترست، مشخصات قرارداد) و OKX (سفارش‌های لیکوییدیشن). همه مستقیم در مرورگر شما خوانده می‌شوند و چیزی از شما جایی فرستاده نمی‌شود."])],
            "ckb": [("ئەم نەخشەیە چی پیشان دەدات", [
                "<b>ئاسۆیی کات، ستوونی نرخ:</b> هەر خانەیەک مەودایەکی نرخە لە ساتێکدا و ڕەنگەکەی دەڵێت بەپێی مۆدێلەکە چەند دۆلار پۆزیشنی لیڤەرێجدار لەو نرخەدا لیکوید دەکرێت. ڕووناکتر واتە زیاتر.",
                "<b>خوار نرخ لۆنگەکان، سەرووی نرخ شۆرتەکان:</b> ئەگەر نرخ دابەزێت لۆنگەکان و ئەگەر بەرز ببێتەوە شۆرتەکان بە ناچاری دادەخرێن. ئەو هێڵەی مۆمەکان دەیگەنێ لەوێدا کۆتایی دێت، چونکە ئەو پۆزیشنانە لیکوید کراون.",
                "<b>١٠ ماوە بۆ هەر دراوێک:</b> لە ١٢ کاتژمێرەوە تا ١ ساڵ، بۆ هەر دراوێک کە لە Binance یان Bybit گرێبەستی هەمیشەیی هەیە.",
                "<b>سێ مۆدێل و پێنج پلەی لیڤەرێج:</b> ٥، ١٠، ٢٥، ٥٠ و ١٠٠ جار بە جیا هەڵبکە و بکوژێنەوە.",
                "<b>لیکویدە ڕاستەقینەکان لە ژێر هەمان نەخشە:</b> هێڵی خوارەوەی چارتەکە داواکارییە ڕاستەقینەکانی لیکویدکردن پیشان دەدات — شۆرتەکان بەرەو سەرەوە (سەوز) و لۆنگەکان بەرەو خوارەوە (سوور)؛ OKX بۆ کاتژمێرەکانی ڕابردوو و Binance یان Bybit بە زیندوویی.",
                "<b>ئاستەکانی ئێستا و کۆمەڵەکان:</b> ستوونی تەنیشت چارتەکە ئەو ئاستانەن کە ئێستا ماون؛ خشتەکانی ژێر چارتەکە گەورەترین کۆمەڵەکانی سەروو و خوار نرخ پیشان دەدەن."]),
                    ("مۆدێلەکە چۆن دەژمێرێت", [
                        "هیچ ئاڵوگۆڕگەیەک نرخی لیکویدکردنی بازرگانەکانی بڵاو ناکاتەوە؛ بۆیە ئەم نەخشەیە، وەک هەموو نەخشە هاوشێوەکان، خەمڵاندنە. جیاوازییەکەی ئەوەیە ڕێگاکەی شاراوە نییە.",
                        "<b>داتا:</b> مۆمەکان و مێژووی ئۆپن ئینتەرێستی هەر ئاڵوگۆڕگەیەک. زیادبوونی ئۆپن ئینتەرێست واتە گرێبەستی نوێ کراوەتەوە، و هەر گرێبەستێک لۆنگێک و شۆرتێکی هەیە.",
                        "<b>نرخی لیکویدکردن:</b> بە لیڤەرێجی L، لۆنگ لە «چوونەژوور × (١ − ١/L + مارجینی پاراستن)» و شۆرت لە «چوونەژوور × (١ + ١/L − مارجینی پاراستن)» دادەخرێت.",
                        "<b>سڕینەوەی ئاستەکان:</b> کاتێک نزمترین یان بەرزترین نرخی مۆمێک دەگاتە ئاستێک، ئەو ئاستە لادەبرێت؛ کاتێک ئۆپن ئینتەرێست دادەبەزێت، هەموو ئاستەکان بە هەمان ڕێژە کەم دەبنەوە.",
                        "<b>مۆدێلی ١</b> تەنها پۆزیشنە نوێیەکان دەژمێرێت. <b>مۆدێلی ٢</b> لۆنگ و شۆرت بەپێی بەشی هەژمارە لۆنگەکان کێش دەدات. <b>مۆدێلی ٣</b> ١٠٪ی قەبارەی هەر مۆمێکیش بە دەستاودەستکردنی پۆزیشن دادەنێت."]),
                    ("سنوورەکان", [
                        "پلەکانی لیڤەرێج و کێشی یەکسانیان گریمانەن، نەک داتا.",
                        "ئەو پۆزیشنانەی پێش دەستپێکی داتا کراونەتەوە نابینرێن. Binance تەنها ٣٠ ڕۆژ مێژووی ئۆپن ئینتەرێست دەدات.",
                        "قەبارەکان بە ڕێژەیی بخوێنەرەوە. تەنها Binance و Bybit لە مۆدێلەکەدان. ئامۆژگاریی دارایی نییە."]),
                    ("سەرچاوەکان", ["داتای گشتیی Binance، Bybit و OKX، ڕاستەوخۆ لە وێبگەڕەکەتدا دەخوێنرێتەوە."])],
            "ar": [("ماذا تُظهر هذه الخريطة", [
                "<b>أفقيًّا الزمن وعموديًّا السعر:</b> كل خانة نطاق سعري في لحظة، ولونها يقول كم دولارًا من المراكز ذات الرافعة يتوقّع النموذج تصفيتها عند ذلك السعر. الأفتح يعني أكثر.",
                "<b>تحت السعر مراكز الشراء وفوقه مراكز البيع:</b> إذا هبط السعر أُغلقت مراكز الشراء قسرًا، وإذا صعد أُغلقت مراكز البيع. الشريط الذي تبلغه الشموع ينتهي هناك لأن تلك المراكز صُفّيت.",
                "<b>١٠ مديات لكل عملة:</b> من ١٢ ساعة إلى سنة، لكل عملة لها عقد دائم في Binance أو Bybit.",
                "<b>ثلاثة نماذج وخمس درجات للرافعة:</b> فعّل أو عطّل ٥ و١٠ و٢٥ و٥٠ و١٠٠ كلًّا على حدة.",
                "<b>التصفيات الفعلية تحت الخريطة نفسها:</b> الشريط أسفل الرسم يعرض أوامر التصفية الحقيقية — مراكز البيع إلى الأعلى (أخضر) ومراكز الشراء إلى الأسفل (أحمر)؛ OKX للساعات الماضية وBinance أو Bybit مباشرة.",
                "<b>المستويات الآن والتجمّعات:</b> العمود بجانب الرسم هو المستويات القائمة الآن؛ والجداول أسفله تعرض أكبر التجمّعات فوق السعر وتحته."]),
                   ("كيف يحسب النموذج", [
                       "لا تنشر أي منصة أسعار تصفية متداوليها، فهذه الخريطة — كسائر الخرائط المشابهة — تقدير. الفرق أن طريقتها ليست مخفية.",
                       "<b>المدخلات:</b> الشموع وتاريخ العقود المفتوحة لكل منصة. ارتفاع العقود المفتوحة يعني فتح عقود جديدة، ولكل عقد مركز شراء ومركز بيع.",
                       "<b>سعر التصفية:</b> برافعة L يُغلق مركز الشراء عند «الدخول × (١ − ١/L + هامش الصيانة)» ومركز البيع عند «الدخول × (١ + ١/L − هامش الصيانة)».",
                       "<b>زوال المستويات:</b> حين يبلغ قاع شمعة أو قمتها مستوًى يُحذف؛ وحين تنخفض العقود المفتوحة تتقلّص كل المستويات بالنسبة نفسها.",
                       "<b>النموذج ١</b> يعدّ المراكز الجديدة فقط. <b>النموذج ٢</b> يرجّح الجهتين بحصة الحسابات المشترية. <b>النموذج ٣</b> يعدّ ١٠٪ من حجم كل شمعة انتقالًا للمراكز."]),
                   ("الحدود", [
                       "درجات الرافعة وأوزانها المتساوية افتراض لا بيانات.",
                       "المراكز المفتوحة قبل بداية البيانات لا تظهر. Binance تتيح ٣٠ يومًا فقط من تاريخ العقود المفتوحة.",
                       "اقرأ الأحجام نسبيًّا. النموذج يشمل Binance وBybit فقط. ليست نصيحة مالية."]),
                   ("المصادر", ["بيانات Binance وBybit وOKX العامة، تُقرأ مباشرة في متصفحك."])],
            "en": [("What the map shows", [
                "<b>Time across, price up:</b> every cell is a price band at a moment, and its colour says how many dollars of leveraged positions the model expects to be liquidated at that price. Brighter means more.",
                "<b>Longs below the price, shorts above it:</b> if the price falls, longs are force-closed; if it rises, shorts are. A band the candles reach ends there, because those positions were liquidated.",
                "<b>Ten ranges for every coin:</b> 12 hours to a year, for any coin with a perpetual contract on Binance or Bybit; both together or each exchange alone.",
                "<b>Three models and five leverage tiers:</b> switch 5x, 10x, 25x, 50x and 100x on and off one by one and see what each model draws.",
                "<b>Real liquidations under the same map:</b> the strip below the chart shows real liquidation orders — shorts upward (green), longs downward (red); OKX for the past hours, Binance or Bybit live while the page is open. It shows where the model was right and where it was not.",
                "<b>Levels now and clusters:</b> the column beside the chart is the levels standing right now; the tables under it give the largest clusters above and below the price, with distance and estimated dollars.",
                "<b>Tools:</b> four colour scales, a threshold that hides weak levels, zoom and pan, a PNG picture, a link to this view and full screen."]),
                   ("How the model works", [
                       "No exchange publishes its traders’ liquidation prices, so this map — like every such map — is an estimate. The difference is that its method is not hidden.",
                       "<b>Inputs:</b> each exchange’s candles and open-interest history. A rise in open interest within a candle means new contracts were opened, and every contract has one long and one short.",
                       "<b>Liquidation price:</b> at leverage L a long is closed at “entry × (1 − 1/L + maintenance margin)” and a short at “entry × (1 + 1/L − maintenance margin)”. Each contract’s maximum leverage and maintenance margin are read from Bybit’s public specifications where available.",
                       "<b>Levels disappear:</b> when a candle’s low or high reaches a level it is removed; when open interest falls, every level shrinks by the same share.",
                       "<b>Model 1</b> counts new positions only. <b>Model 2</b> weighs longs and shorts by the share of accounts that are long on the same exchange. <b>Model 3</b> also takes 10% of each candle’s volume as positions changing hands, to picture the whole open interest.",
                       "<b>Warm-up:</b> before the range on screen, between 30 days and two years of older data (depending on the range) is processed so that levels left from earlier are there too."]),
                   ("Limits", [
                       "The leverage tiers and their equal weights are an assumption, not data; nobody knows what leverage traders really used.",
                       "Positions opened before the data begins are invisible. Binance gives only 30 days of open-interest history; longer ranges rest on Bybit’s data.",
                       "Read sizes as relative: the map says where liquidations would begin, not that the price will get there or stop there.",
                       "Only Binance and Bybit are in the model. Not financial advice."]),
                   ("Sources", ["Public data of Binance (candles, open interest, account ratio), Bybit (candles, open interest, contract specifications) and OKX (liquidation orders), read directly in your browser; nothing about you is sent anywhere."])],
        },
    },
    "liqmap": {
        "title": "نقشه لیکوییدیشن بیت‌کوین به تفکیک اهرم، زنده | entekhab.net",
        "desc": "نقشهٔ لیکوییدیشن: برآورد دلاری لیکوییدیشن لانگ و شورت در هر محدودهٔ قیمت به تفکیک اهرم ۵ تا ۱۰۰ برابر و جمع تجمعی از قیمت فعلی، زنده از Binance و Bybit.",
        "og": "نقشهٔ لیکوییدیشن — سطوح فعلی به تفکیک اهرم",
        "ld": "Entekhab liquidation map",
        "kw": ["نقشه لیکوییدیشن", "liquidation map", "اهرم", "leverage", "لیڤەرێج", "سطوح لیکوییدیشن"],
        "h1": {"fa": "نقشهٔ لیکوییدیشن", "ckb": "نەخشەی لیکویدکردن", "ar": "خريطة التصفيات", "en": "Liquidation map"},
        "p": {"fa": "سطوحی که همین حالا پابرجاست: برآورد دلاری لیکوییدیشن لانگ‌ها و شورت‌ها در هر محدودهٔ قیمت، به تفکیک اهرم، و جمع تجمعی از قیمت فعلی",
              "ckb": "ئەو ئاستانەی ئێستا ماون: خەمڵاندنی دۆلاریی لیکویدکردنی لۆنگ و شۆرت لە هەر مەودایەکی نرخدا، بەپێی لیڤەرێج، و کۆی کۆکراوە لە نرخی ئێستاوە",
              "ar": "المستويات القائمة الآن: تقدير بالدولار لتصفية مراكز الشراء والبيع في كل نطاق سعري حسب الرافعة، والمجموع التراكمي من السعر الحالي",
              "en": "The levels standing right now: estimated dollars of long and short liquidations in every price band, by leverage, and the running total from the present price"},
        "about": {
            "fa": [("این نمودار چه نشان می‌دهد", [
                "<b>ستون‌ها:</b> برآورد دلاری پوزیشن‌هایی که اگر قیمت به آن محدوده برسد لیکویید می‌شوند — سمت چپِ قیمت لانگ‌ها (قرمز)، سمت راست شورت‌ها (سبز). هر چه رنگ روشن‌تر، اهرم بالاتر.",
                "<b>جمع تجمعی:</b> نمودار پایین می‌گوید اگر قیمت از همین‌جا تا آن نقطه برود، در مجموع چند دلار لیکویید می‌شود؛ برای سنجیدن اینکه کدام سو سنگین‌تر است.",
                "<b>پوزیشن‌های بازشده در:</b> فقط پوزیشن‌هایی که در ۲۴ ساعت، ۳ روز، ۱ هفته یا ۱ ماه گذشته باز شده‌اند شمرده می‌شوند.",
                "<b>پهنا:</b> از ۵ تا ۲۰ درصد در هر سوی قیمت. با بردن نشانگر روی هر ستون، سهم هر اهرم و جمع تجمعی تا آن‌جا را می‌بینید."]),
                   ("روش و محدودیت‌ها", [
                       "این همان مدل نقشهٔ حرارتی لیکوییدیشن است، در لحظهٔ اکنون: افزایش اوپن اینترست = پوزیشن تازه، با پنج پلهٔ اهرم؛ سطوحی که قیمت به آن‌ها رسیده حذف و با افت اوپن اینترست کوچک می‌شوند.",
                       "پله‌های اهرم و وزن برابرشان فرض است، نه داده. اندازه‌ها را نسبی بخوانید؛ این نمودار نمی‌گوید قیمت به کدام سو می‌رود. توصیهٔ مالی نیست.",
                       "منابع: دادهٔ عمومی Binance و Bybit که مستقیم در مرورگر شما خوانده می‌شود."])],
            "ckb": [("ئەم چارتە چی پیشان دەدات", [
                "<b>ستوونەکان:</b> خەمڵاندنی دۆلاریی ئەو پۆزیشنانەی کە ئەگەر نرخ بگاتە ئەو مەودایە لیکوید دەکرێن — لای چەپی نرخ لۆنگەکان (سوور)، لای ڕاست شۆرتەکان (سەوز). ڕەنگی ڕووناکتر واتە لیڤەرێجی بەرزتر.",
                "<b>کۆی کۆکراوە:</b> چارتی خوارەوە دەڵێت ئەگەر نرخ لێرەوە تا ئەو خاڵە بڕوات، بە گشتی چەند دۆلار لیکوید دەکرێت.",
                "<b>پۆزیشنە کراوەکان لە:</b> تەنها ئەو پۆزیشنانە دەژمێردرێن کە لە ٢٤ کاتژمێر، ٣ ڕۆژ، ١ هەفتە یان ١ مانگی ڕابردوودا کراونەتەوە.",
                "<b>پانی:</b> لە ٥ تا ٢٠ لەسەد لە هەر لایەکی نرخ."]),
                    ("ڕێگا و سنوورەکان", [
                        "هەمان مۆدێلی نەخشەی گەرمیی لیکویدکردنە، لە ساتی ئێستادا. پلەکانی لیڤەرێج و کێشی یەکسانیان گریمانەن، نەک داتا. ئامۆژگاریی دارایی نییە.",
                        "سەرچاوەکان: داتای گشتیی Binance و Bybit."])],
            "ar": [("ماذا يُظهر هذا الرسم", [
                "<b>الأعمدة:</b> تقدير بالدولار للمراكز التي تُصفّى إذا بلغ السعر ذلك النطاق — يسار السعر مراكز الشراء (أحمر) ويمينه مراكز البيع (أخضر). اللون الأفتح يعني رافعة أعلى.",
                "<b>المجموع التراكمي:</b> الرسم السفلي يقول كم دولارًا يُصفّى إجمالًا إذا تحرّك السعر من هنا إلى تلك النقطة.",
                "<b>المراكز المفتوحة خلال:</b> تُحتسب فقط المراكز التي فُتحت في آخر ٢٤ ساعة أو ٣ أيام أو أسبوع أو شهر.",
                "<b>العرض:</b> من ٥ إلى ٢٠٪ في كل جهة من السعر."]),
                   ("المنهج والحدود", [
                       "هو نموذج الخريطة الحرارية للتصفيات نفسه، في اللحظة الحالية. درجات الرافعة وأوزانها المتساوية افتراض لا بيانات. ليست نصيحة مالية.",
                       "المصادر: بيانات Binance وBybit العامة."])],
            "en": [("What the chart shows", [
                "<b>The bars:</b> estimated dollars of positions that would be liquidated if the price reached that band — longs left of the price (red), shorts right of it (green). A lighter shade is higher leverage.",
                "<b>The running total:</b> the lower chart says how many dollars in all would be liquidated if the price moved from here to that point — a way to see which side is heavier.",
                "<b>Positions opened in:</b> only positions opened in the last 24 hours, 3 days, week or month are counted.",
                "<b>Width:</b> 5 to 20 per cent on each side of the price. Point at a bar for each leverage tier’s share and the running total up to there."]),
                   ("Method and limits", [
                       "This is the liquidation heatmap’s model at the present moment: a rise in open interest = new positions, in five leverage tiers; levels the price has reached are removed, and they shrink when open interest falls.",
                       "The leverage tiers and their equal weights are an assumption, not data. Read sizes as relative; the chart does not say which way the price will go. Not financial advice.",
                       "Sources: public data of Binance and Bybit, read directly in your browser."])],
        },
    },
    "oi": {
        "title": "اوپن اینترست بیت‌کوین و ارزها به تفکیک صرافی | entekhab.net",
        "desc": "اوپن اینترست فیوچرز بیت‌کوین، اتریوم و صدها ارز: جمع و سهم Binance، Bybit، OKX، Bitget، Hyperliquid و Gate، با تاریخچه تا ۱ سال زیر نمودار قیمت. زنده و رایگان.",
        "og": "اوپن اینترست صرافی‌ها — جمع، سهم و تاریخچه",
        "ld": "Entekhab open interest by exchange",
        "kw": ["اوپن اینترست", "اپن اینترست", "open interest", "oi", "ئۆپن ئینتەرێست", "قراردادهای باز", "العقود المفتوحة"],
        "h1": {"fa": "اوپن اینترست صرافی‌ها", "ckb": "ئۆپن ئینتەرێستی ئاڵوگۆڕگەکان", "ar": "العقود المفتوحة عبر المنصات", "en": "Open interest by exchange"},
        "p": {"fa": "ارزش قراردادهای باز فیوچرز هر ارز در شش صرافی، سهم هر کدام و تغییرش در زمان، زیر نمودار قیمت",
              "ckb": "بەهای گرێبەستە کراوەکانی فیوچەرزی هەر دراوێک لە شەش ئاڵوگۆڕگە، بەشی هەر یەکێکیان و گۆڕانی بە درێژایی کات، لە ژێر چارتی نرخدا",
              "ar": "قيمة العقود الآجلة المفتوحة لكل عملة في ست منصات، وحصة كل منها وتغيّرها عبر الزمن، تحت رسم السعر",
              "en": "The value of open futures contracts of any coin on six exchanges, each one’s share and how it changed over time, under the price"},
        "about": {
            "fa": [("این صفحه چه نشان می‌دهد", [
                "<b>اوپن اینترست چیست:</b> شمار قراردادهای فیوچرزی که باز مانده‌اند و هنوز بسته نشده‌اند. هر قرارداد یک لانگ و یک شورت دارد؛ پس اوپن اینترست می‌گوید چقدر پول درگیر بازار است، نه اینکه کدام سو سنگین‌تر است.",
                "<b>کاشی‌های بالا:</b> جمع اوپن اینترست صرافی‌هایی که پاسخ داده‌اند، تغییر ۲۴ ساعته (از تاریخچهٔ ساعتی Binance و Bybit) و قیمت.",
                "<b>نمودار:</b> قیمت در بالا و اوپن اینترست در پایین، روی یک محور زمان؛ یک خط برای هر صرافی و سطحی برای جمعشان. با زدن روی نام هر خط آن را پنهان یا پیدا کنید. بازه از ۲۴ ساعت تا ۱ سال، به دلار یا به تعداد ارز.",
                "<b>جدول:</b> عدد همین لحظهٔ هر صرافی، سهمش از جمع و نرخ فاندینگش.",
                "<b>چطور بخوانیم:</b> قیمت و اوپن اینترست هر دو رو به بالا یعنی پول تازه پشت حرکت است؛ قیمت بالا می‌رود و اوپن اینترست پایین می‌آید یعنی شورت‌ها در حال بستن‌اند؛ افت تند اوپن اینترست معمولاً یعنی لیکوییدیشن پشت‌سرهم."]),
                   ("روش و محدودیت‌ها", [
                       "فقط قراردادهای دائمی با مارجین استیبل‌کوین شمرده می‌شوند: قراردادهای USDT در Binance، Bybit، OKX، Bitget و Gate، و قراردادهای Hyperliquid (با USDC). قراردادهای با مارجینِ خودِ ارز، قراردادهای USDC صرافی‌های دیگر، قراردادهای سررسیددار، CME و صرافی‌های دیگر در این جمع نیستند؛ پس این عدد از رقم «کل بازار» در سایت‌هایی که همه را می‌شمارند کوچک‌تر است.",
                       "تاریخچه را فقط Binance (۳۰ روز) و Bybit (چند سال) منتشر می‌کنند؛ خط جمع از جایی شروع می‌شود که هر دو داده دارند. مقدار دلاری هر نقطه = تعداد ارز × قیمت همان لحظه.",
                       "اگر صرافی‌ای پاسخ ندهد یا آن ارز را نداشته باشد، نامش زیر جدول می‌آید و در جمع حساب نمی‌شود. هیچ عددی ساخته نمی‌شود.",
                       "منابع: دادهٔ عمومی همین شش صرافی که مستقیم در مرورگر شما خوانده می‌شود. توصیهٔ مالی نیست."])],
            "ckb": [("ئەم پەڕەیە چی پیشان دەدات", [
                "<b>ئۆپن ئینتەرێست چییە:</b> ژمارەی ئەو گرێبەستانەی فیوچەرز کە کراوەن و هێشتا دانەخراون. هەر گرێبەستێک لۆنگێک و شۆرتێکی هەیە؛ بۆیە ئۆپن ئینتەرێست دەڵێت چەند پارە لە بازاڕدایە، نەک کام لا قورسترە.",
                "<b>کاشییەکانی سەرەوە:</b> کۆی ئۆپن ئینتەرێستی ئەو ئاڵوگۆڕگانەی وەڵامیان داوەتەوە، گۆڕانی ٢٤ کاتژمێر (لە مێژووی کاتژمێریی Binance و Bybitـەوە) و نرخ.",
                "<b>چارت:</b> نرخ لە سەرەوە و ئۆپن ئینتەرێست لە خوارەوە، لەسەر یەک تەوەری کات؛ هێڵێک بۆ هەر ئاڵوگۆڕگەیەک و ڕووبەرێک بۆ کۆیان. بە کرتە لە ناوی هەر هێڵێک بیشارەوە یان پیشانی بدە. ماوە لە ٢٤ کاتژمێرەوە تا ١ ساڵ، بە دۆلار یان بە ژمارەی دراو.",
                "<b>خشتە:</b> ژمارەی ئێستای هەر ئاڵوگۆڕگەیەک، بەشی لە کۆ و نرخی فەندینگی.",
                "<b>چۆن بیخوێنینەوە:</b> نرخ و ئۆپن ئینتەرێست هەردووکیان بەرەو سەرەوە واتە پارەی نوێ لە پشت جووڵەکەیە؛ نرخ بەرز دەبێتەوە و ئۆپن ئینتەرێست دادەبەزێت واتە شۆرتەکان دادەخرێن؛ دابەزینی توندی ئۆپن ئینتەرێست زۆرجار واتە لیکویدکردنی یەک لە دوای یەک."]),
                    ("ڕێگا و سنوورەکان", [
                        "تەنها گرێبەستە هەمیشەییەکان بە مارجینی ستەیبڵکۆین دەژمێردرێن: گرێبەستەکانی USDT لە Binance، Bybit، OKX، Bitget و Gate، و گرێبەستەکانی Hyperliquid (بە USDC). گرێبەستەکانی مارجینی خودی دراوەکە، گرێبەستەکانی USDCی ئاڵوگۆڕگەکانی تر، گرێبەستە بەروارییەکان، CME و ئاڵوگۆڕگەکانی تر لەم کۆیەدا نین؛ بۆیە ئەم ژمارەیە لە ژمارەی «هەموو بازاڕ»ی ئەو ماڵپەڕانەی هەمووی دەژمێرن بچووکترە.",
                        "مێژوو تەنها Binance (٣٠ ڕۆژ) و Bybit (چەند ساڵ) بڵاوی دەکەنەوە؛ هێڵی کۆ لەو شوێنەوە دەست پێدەکات کە هەردووکیان داتایان هەیە. بەهای دۆلاریی هەر خاڵێک = ژمارەی دراو × نرخی هەمان سات.",
                        "ئەگەر ئاڵوگۆڕگەیەک وەڵام نەداتەوە یان ئەو دراوەی نەبێت، ناوەکەی لە ژێر خشتەکە دێت و لە کۆدا ناژمێردرێت. هیچ ژمارەیەک دروست ناکرێت.",
                        "سەرچاوەکان: داتای گشتیی ئەم شەش ئاڵوگۆڕگەیە، ڕاستەوخۆ لە وێبگەڕەکەتدا دەخوێنرێتەوە. ئامۆژگاریی دارایی نییە."])],
            "ar": [("ماذا تُظهر هذه الصفحة", [
                "<b>ما العقود المفتوحة:</b> عدد العقود الآجلة التي ما زالت قائمة ولم تُغلق. لكل عقد مركز شراء ومركز بيع، فالعقود المفتوحة تقول كم من المال منخرط في السوق لا أيّ الجهتين أثقل.",
                "<b>البطاقات العليا:</b> مجموع العقود المفتوحة في المنصات التي استجابت، وتغيّر ٢٤ ساعة (من التاريخ الساعي لـBinance وBybit)، والسعر.",
                "<b>الرسم:</b> السعر في الأعلى والعقود المفتوحة في الأسفل على محور زمني واحد؛ خط لكل منصة ومساحة لمجموعها. اضغط اسم أي خط لإخفائه أو إظهاره. المدى من ٢٤ ساعة إلى سنة، بالدولار أو بعدد العملات.",
                "<b>الجدول:</b> رقم كل منصة الآن وحصتها من المجموع ومعدل تمويلها.",
                "<b>كيف تُقرأ:</b> صعود السعر والعقود المفتوحة معًا يعني أموالًا جديدة خلف الحركة؛ صعود السعر مع هبوط العقود المفتوحة يعني إغلاق مراكز البيع؛ والهبوط الحاد للعقود المفتوحة يعني غالبًا تصفيات متتالية."]),
                   ("المنهج والحدود", [
                       "تُحتسب فقط العقود الدائمة بهامش العملات المستقرة: عقود USDT في Binance وBybit وOKX وBitget وGate، وعقود Hyperliquid (بـUSDC). العقود بهامش العملة نفسها وعقود USDC في المنصات الأخرى والعقود ذات الاستحقاق وCME والمنصات الأخرى ليست في هذا المجموع، فهو أصغر من رقم «السوق كله» في المواقع التي تعدّها جميعًا.",
                       "لا ينشر التاريخ سوى Binance (٣٠ يومًا) وBybit (سنوات)؛ ويبدأ خط المجموع حيث توجد بيانات الاثنتين. القيمة بالدولار لكل نقطة = عدد العملات × سعر اللحظة نفسها.",
                       "إذا لم تستجب منصة أو لم تدرج العملة يظهر اسمها تحت الجدول ولا تدخل في المجموع. لا يُختلق أي رقم.",
                       "المصادر: البيانات العامة لهذه المنصات الست، تُقرأ مباشرة في متصفحك. ليست نصيحة مالية."])],
            "en": [("What this page shows", [
                "<b>What open interest is:</b> the number of futures contracts that are open and not yet closed. Every contract has one long and one short, so open interest says how much money is engaged in the market — not which side is heavier.",
                "<b>The tiles:</b> the total open interest of the exchanges that answered, the change in 24 hours (from the hourly history of Binance and Bybit), and the price.",
                "<b>The chart:</b> price above, open interest below, on one time axis; a line per exchange and an area for their sum. Click a name to hide or show its line. Ranges from 24 hours to a year, in dollars or in coins.",
                "<b>The table:</b> each exchange’s figure right now, its share of the total and its funding rate.",
                "<b>How to read it:</b> price and open interest both rising means new money is behind the move; price rising while open interest falls means shorts are closing; a sharp fall in open interest usually means a run of liquidations."]),
                   ("Method and limits", [
                       "Only stablecoin-margined perpetual contracts are counted: the USDT contracts of Binance, Bybit, OKX, Bitget and Gate, and Hyperliquid’s (in USDC). Coin-margined contracts, the other exchanges’ USDC contracts, dated futures, CME and other exchanges are not in this total, so it is smaller than the “whole market” figure of sites that count them all.",
                       "History is published only by Binance (30 days) and Bybit (years); the sum line starts where both have data. The dollar value of each point = coins × the price at that moment.",
                       "If an exchange does not answer or does not list the coin, its name is shown under the table and it is left out of the total. No number is made up.",
                       "Sources: the public data of these six exchanges, read directly in your browser. Not financial advice."])],
        },
    },
    "funding": {
        "title": "نرخ فاندینگ بیت‌کوین و ارزها در پنج صرافی | entekhab.net",
        "desc": "نرخ فاندینگ بیت‌کوین و صدها ارز در Binance، Bybit، OKX، Bitget و Hyperliquid: جدول مقایسه، تاریخچه تا ۱ سال، در ۸ ساعت یا سالانه. زنده و رایگان.",
        "og": "نرخ فاندینگ صرافی‌ها — مقایسه و تاریخچه",
        "ld": "Entekhab funding rates by exchange",
        "kw": ["فاندینگ", "نرخ فاندینگ", "فاندینگ ریت", "funding", "funding rate", "فەندینگ", "التمويل"],
        "h1": {"fa": "نرخ فاندینگ صرافی‌ها", "ckb": "نرخی فەندینگی ئاڵوگۆڕگەکان", "ar": "معدلات التمويل عبر المنصات", "en": "Funding rates by exchange"},
        "p": {"fa": "نرخ فاندینگ هر ارز در پنج صرافی کنار هم، همه بر پایهٔ ۸ ساعت، با تاریخچه زیر نمودار قیمت",
              "ckb": "نرخی فەندینگی هەر دراوێک لە پێنج ئاڵوگۆڕگە لە تەنیشت یەک، هەموویان لەسەر بنەمای ٨ کاتژمێر، لەگەڵ مێژوو لە ژێر چارتی نرخدا",
              "ar": "معدل تمويل كل عملة في خمس منصات جنبًا إلى جنب، كلها على أساس ٨ ساعات، مع التاريخ تحت رسم السعر",
              "en": "The funding rate of any coin on five exchanges side by side, all on an 8-hour basis, with its history under the price"},
        "about": {
            "fa": [("این صفحه چه نشان می‌دهد", [
                "<b>فاندینگ چیست:</b> پرداخت دوره‌ای میان لانگ‌ها و شورت‌ها تا قیمت قرارداد دائمی نزدیک قیمت نقدی بماند. مثبت یعنی لانگ‌ها می‌پردازند (بازار بیشتر به لانگ میل دارد)، منفی یعنی شورت‌ها می‌پردازند.",
                "<b>کاشی‌ها:</b> میانگین نرخ فعلی ارز در صرافی‌ها، همان به‌صورت سالانه، و بیشترین و کمترین با نام صرافی.",
                "<b>نمودار:</b> قیمت در بالا و نرخ‌های تسویه‌شدهٔ Binance، Bybit و OKX در پایین؛ از ۱ هفته تا ۱ سال.",
                "<b>جدول:</b> پرمعامله‌ترین ارزها در پنج صرافی؛ آبی یعنی شورت‌ها می‌پردازند و نارنجی یعنی لانگ‌ها. روی عنوان هر ستون بزنید تا مرتب شود و روی نام ارز تا تاریخچه‌اش بیاید. ستون «اختلاف» فاصلهٔ بیشترین و کمترین نرخ میان صرافی‌هاست."]),
                   ("روش و محدودیت‌ها", [
                       "صرافی‌ها هر ۱، ۴ یا ۸ ساعت تسویه می‌کنند (Hyperliquid هر ساعت). برای مقایسه، همه به نرخ ۸ ساعته برده می‌شوند: نرخ × ۸ ÷ فاصلهٔ تسویه به ساعت. «سالانه» = نرخ ۸ ساعته × ۳ × ۳۶۵، بدون سود مرکب و با این فرض که نرخ همین بماند.",
                       "نرخ‌های جدول و کاشی‌ها نرخِ تسویهٔ بعدی‌اند و تا لحظهٔ تسویه تغییر می‌کنند؛ نمودار نرخ‌های تسویه‌شده را نشان می‌دهد.",
                       "OKX حدود سه ماه تاریخچه می‌دهد؛ در بازه‌های بلندتر خطش کوتاه‌تر است. Bitget و Hyperliquid فقط در جدول هستند.",
                       "فاندینگ بالا به‌تنهایی نشانهٔ برگشت قیمت نیست؛ فقط می‌گوید نگه داشتن کدام سو گران‌تر است. توصیهٔ مالی نیست."])],
            "ckb": [("ئەم پەڕەیە چی پیشان دەدات", [
                "<b>فەندینگ چییە:</b> پارەدانێکی خولییە لە نێوان لۆنگەکان و شۆرتەکان بۆ ئەوەی نرخی گرێبەستی هەمیشەیی نزیک نرخی نەختینە بمێنێتەوە. پۆزەتیڤ واتە لۆنگەکان پارە دەدەن، نێگەتیڤ واتە شۆرتەکان.",
                "<b>کاشییەکان:</b> تێکڕای نرخی ئێستای دراوەکە لە ئاڵوگۆڕگەکان، هەمان بە ساڵانە، و بەرزترین و نزمترین لەگەڵ ناوی ئاڵوگۆڕگە.",
                "<b>چارت:</b> نرخ لە سەرەوە و نرخە یەکلاکراوەکانی Binance، Bybit و OKX لە خوارەوە؛ لە ١ هەفتەوە تا ١ ساڵ.",
                "<b>خشتە:</b> زۆرترین دراوە مامەڵەکراوەکان لە پێنج ئاڵوگۆڕگە؛ شین واتە شۆرتەکان پارە دەدەن و پرتەقاڵی واتە لۆنگەکان. کرتە لە ناونیشانی ستوون بکە بۆ ڕیزکردن و لە ناوی دراو بۆ مێژووەکەی. ستوونی «جیاوازی» مەودای نێوان بەرزترین و نزمترین نرخە لە نێوان ئاڵوگۆڕگەکاندا."]),
                    ("ڕێگا و سنوورەکان", [
                        "ئاڵوگۆڕگەکان هەر ١، ٤ یان ٨ کاتژمێر جارێک یەکلایی دەکەنەوە (Hyperliquid هەر کاتژمێرێک). بۆ بەراورد هەموویان دەبرێنە سەر نرخی ٨ کاتژمێری: نرخ × ٨ ÷ ماوەی یەکلاکردنەوە بە کاتژمێر. «ساڵانە» = نرخی ٨ کاتژمێری × ٣ × ٣٦٥، بێ سوودی ئاوێتە و بەو گریمانەیەی نرخەکە وەک خۆی بمێنێتەوە.",
                        "نرخەکانی خشتە و کاشییەکان نرخی یەکلاکردنەوەی داهاتوون و تا ساتی یەکلاکردنەوە دەگۆڕێن؛ چارتەکە نرخە یەکلاکراوەکان پیشان دەدات.",
                        "OKX نزیکەی سێ مانگ مێژوو دەدات. Bitget و Hyperliquid تەنها لە خشتەکەدان.",
                        "فەندینگی بەرز بە تەنها نیشانەی گەڕانەوەی نرخ نییە؛ تەنها دەڵێت ڕاگرتنی کام لا گرانترە. ئامۆژگاریی دارایی نییە."])],
            "ar": [("ماذا تُظهر هذه الصفحة", [
                "<b>ما التمويل:</b> دفعة دورية بين مراكز الشراء ومراكز البيع ليبقى سعر العقد الدائم قريبًا من السعر الفوري. الموجب يعني أن مراكز الشراء تدفع، والسالب يعني أن مراكز البيع تدفع.",
                "<b>البطاقات:</b> متوسط المعدل الحالي للعملة في المنصات، ونفسه سنويًّا، والأعلى والأدنى مع اسم المنصة.",
                "<b>الرسم:</b> السعر في الأعلى والمعدلات المسوّاة في Binance وBybit وOKX في الأسفل؛ من أسبوع إلى سنة.",
                "<b>الجدول:</b> أكثر العملات تداولًا في خمس منصات؛ الأزرق يعني أن مراكز البيع تدفع والبرتقالي أن مراكز الشراء تدفع. اضغط عنوان العمود للترتيب واسم العملة لعرض تاريخها. عمود «الفارق» هو المسافة بين أعلى معدل وأدناه بين المنصات."]),
                   ("المنهج والحدود", [
                       "تسوّي المنصات كل ساعة أو ٤ أو ٨ ساعات (Hyperliquid كل ساعة). للمقارنة تُحوَّل كلها إلى معدل ٨ ساعات: المعدل × ٨ ÷ فترة التسوية بالساعات. «سنويًّا» = معدل ٨ ساعات × ٣ × ٣٦٥، دون فائدة مركبة وبافتراض بقاء المعدل كما هو.",
                       "معدلات الجدول والبطاقات هي معدلات التسوية القادمة وتتغير حتى لحظة التسوية؛ أما الرسم فيعرض المعدلات المسوّاة.",
                       "تتيح OKX نحو ثلاثة أشهر من التاريخ. Bitget وHyperliquid في الجدول فقط.",
                       "التمويل المرتفع وحده ليس إشارة إلى انعكاس السعر؛ إنه يقول فقط أي الجهتين أغلى كلفةً. ليست نصيحة مالية."])],
            "en": [("What this page shows", [
                "<b>What funding is:</b> a periodic payment between longs and shorts that keeps a perpetual contract’s price near the spot price. Positive means longs pay (the market leans long); negative means shorts pay.",
                "<b>The tiles:</b> the coin’s average present rate across the exchanges, the same per year, and the highest and lowest with the exchange’s name.",
                "<b>The chart:</b> price above, and the settled rates of Binance, Bybit and OKX below; one week to a year.",
                "<b>The table:</b> the most traded coins on five exchanges; blue means shorts pay, orange means longs pay. Click a column heading to sort, a coin to see its history. “Spread” is the distance between the highest and the lowest rate among the exchanges."]),
                   ("Method and limits", [
                       "Exchanges settle every 1, 4 or 8 hours (Hyperliquid every hour). To compare them, every rate is brought to 8 hours: rate × 8 ÷ the settlement interval in hours. “Per year” = the 8-hour rate × 3 × 365, without compounding and assuming the rate stays as it is.",
                       "The rates in the table and the tiles are those of the coming settlement and change until it happens; the chart shows settled rates.",
                       "OKX gives about three months of history, so its line is shorter on longer ranges. Bitget and Hyperliquid are in the table only.",
                       "A high funding rate alone is not a sign that the price will turn; it only says which side is dearer to hold. Not financial advice."])],
        },
    },
    "ls": {
        "title": "نسبت لانگ به شورت بیت‌کوین و ارزها، زنده | entekhab.net",
        "desc": "نسبت لانگ به شورت بیت‌کوین و ارزها: سهم حساب‌های لانگ در Binance و Bybit، معامله‌گران برتر و خالص خرید و فروش تهاجمی زیر نمودار قیمت. زنده و رایگان.",
        "og": "نسبت لانگ به شورت — حساب‌ها، معامله‌گران برتر، حجم تهاجمی",
        "ld": "Entekhab long/short ratio",
        "kw": ["لانگ شورت", "نسبت لانگ به شورت", "long short", "long/short ratio", "لۆنگ", "شۆرت", "معامله‌گران برتر", "top traders", "taker"],
        "h1": {"fa": "نسبت لانگ به شورت", "ckb": "ڕێژەی لۆنگ بۆ شۆرت", "ar": "نسبة الشراء إلى البيع", "en": "Long/short ratio"},
        "p": {"fa": "چند درصد حساب‌ها لانگ‌اند — همهٔ حساب‌ها و معامله‌گران برتر — و خریداران یا فروشندگان تهاجمی کدام بیشترند",
              "ckb": "چەند لەسەدی هەژمارەکان لۆنگن — هەموو هەژمارەکان و بازرگانە سەرەکییەکان — و کڕیاران یان فرۆشیارانی هێرشبەر کامیان زیاترن",
              "ar": "كم بالمئة من الحسابات مشترية — كل الحسابات وكبار المتداولين — وأيّ الطرفين أكثر: المشترون أم البائعون العدوانيون",
              "en": "What share of accounts is long — all accounts and the top traders — and whether aggressive buyers or sellers lead"},
        "about": {
            "fa": [("این صفحه چه نشان می‌دهد", [
                "<b>سهم حساب‌های لانگ:</b> از حساب‌هایی که پوزیشن باز دارند، چند درصد لانگ‌اند؛ ۵۰٪ یعنی نیم‌به‌نیم. خط‌ها: همهٔ حساب‌های Binance، همهٔ حساب‌های Bybit، و معامله‌گران برتر Binance (۲۰٪ حساب‌ها با بیشترین مارجین) یک‌بار به شمار حساب و یک‌بار به اندازهٔ پوزیشن.",
                "<b>خالص حجم تهاجمی:</b> حجم خریدهایی که با سفارش بازار انجام شده منهای فروش‌های بازار در هر بازه، از Binance. سبز یعنی خریداران عجول‌تر بوده‌اند و قرمز یعنی فروشندگان.",
                "<b>بازه:</b> از ۲۴ ساعت تا ۱ ماه، برای هر ارزی که در Binance یا Bybit قرارداد دائمی دارد."]),
                   ("چطور بخوانیم، و محدودیت‌ها", [
                       "این سهمِ «حساب‌ها»ست، نه پول: هر قرارداد یک لانگ و یک شورت دارد و ارزش دو سو همیشه برابر است. وقتی ۷۰٪ حساب‌ها لانگ‌اند، یعنی لانگ‌های کوچکِ پرشمار روبه‌روی شورت‌های بزرگِ کم‌شمار ایستاده‌اند.",
                       "فاصلهٔ میان خط همهٔ حساب‌ها و خط معامله‌گران برتر گویاتر از هر کدام به‌تنهایی است.",
                       "Binance فقط ۳۰ روز از این داده‌ها را منتشر می‌کند و تعریف «معامله‌گر برتر» هم از خود Binance است. توصیهٔ مالی نیست."])],
            "ckb": [("ئەم پەڕەیە چی پیشان دەدات", [
                "<b>بەشی هەژمارە لۆنگەکان:</b> لەو هەژمارانەی پۆزیشنی کراوەیان هەیە، چەند لەسەدیان لۆنگن؛ ٥٠٪ واتە نیوە بە نیوە. هێڵەکان: هەموو هەژمارەکانی Binance، هەموو هەژمارەکانی Bybit، و بازرگانە سەرەکییەکانی Binance (٢٠٪ی هەژمارەکان بە زۆرترین مارجین) جارێک بەپێی ژمارەی هەژمار و جارێک بەپێی قەبارەی پۆزیشن.",
                "<b>سافیی قەبارەی هێرشبەرانە:</b> قەبارەی ئەو کڕینانەی بە داواکاریی بازاڕ کراون کەم فرۆشتنەکانی بازاڕ لە هەر ماوەیەکدا، لە Binanceـەوە. سەوز واتە کڕیاران پەلەیان زیاتر بووە و سوور واتە فرۆشیاران.",
                "<b>ماوە:</b> لە ٢٤ کاتژمێرەوە تا ١ مانگ، بۆ هەر دراوێک کە لە Binance یان Bybit گرێبەستی هەمیشەیی هەیە."]),
                    ("چۆن بیخوێنینەوە، و سنوورەکان", [
                        "ئەمە بەشی «هەژمارەکان»ە، نەک پارە: هەر گرێبەستێک لۆنگێک و شۆرتێکی هەیە و بەهای هەردوو لا هەمیشە یەکسانە. کاتێک ٧٠٪ی هەژمارەکان لۆنگن، واتە لۆنگی بچووکی زۆر بەرامبەر شۆرتی گەورەی کەم وەستاون.",
                        "مەودای نێوان هێڵی هەموو هەژمارەکان و هێڵی بازرگانە سەرەکییەکان لە هەر یەکێکیان بە تەنها زیاتر دەدوێت.",
                        "Binance تەنها ٣٠ ڕۆژ لەم داتایانە بڵاو دەکاتەوە و پێناسەی «بازرگانی سەرەکی»یش هی Binance خۆیەتی. ئامۆژگاریی دارایی نییە."])],
            "ar": [("ماذا تُظهر هذه الصفحة", [
                "<b>حصة الحسابات المشترية:</b> من الحسابات التي لها مراكز مفتوحة، كم بالمئة منها مشترٍ؛ ٥٠٪ تعني مناصفة. الخطوط: كل حسابات Binance، كل حسابات Bybit، وكبار متداولي Binance (أعلى ٢٠٪ من الحسابات هامشًا) مرة بعدد الحسابات ومرة بحجم المراكز.",
                "<b>صافي الحجم العدواني:</b> حجم المشتريات المنفَّذة بأوامر السوق ناقص مبيعات السوق في كل فترة، من Binance. الأخضر يعني أن المشترين كانوا أكثر استعجالًا والأحمر أن البائعين كذلك.",
                "<b>المدى:</b> من ٢٤ ساعة إلى شهر، لكل عملة لها عقد دائم في Binance أو Bybit."]),
                   ("كيف تُقرأ، والحدود", [
                       "هذه حصة «الحسابات» لا الأموال: لكل عقد مركز شراء ومركز بيع وقيمة الجهتين متساوية دائمًا. حين تكون ٧٠٪ من الحسابات مشترية فمعناه أن مراكز شراء صغيرة كثيرة تقابل مراكز بيع كبيرة قليلة.",
                       "المسافة بين خط كل الحسابات وخط كبار المتداولين أبلغ من أي منهما وحده.",
                       "تنشر Binance ٣٠ يومًا فقط من هذه البيانات، وتعريف «كبار المتداولين» هو تعريف Binance نفسها. ليست نصيحة مالية."])],
            "en": [("What this page shows", [
                "<b>Share of accounts long:</b> of the accounts holding a position, what per cent is long; 50% is half and half. The lines: all Binance accounts, all Bybit accounts, and Binance’s top traders (the 20% of accounts with the largest margin) counted once by accounts and once by position size.",
                "<b>Net taker volume:</b> the volume bought with market orders minus the volume sold with market orders in each interval, from Binance. Green means buyers were the more eager, red means sellers.",
                "<b>Range:</b> 24 hours to a month, for any coin with a perpetual contract on Binance or Bybit."]),
                   ("How to read it, and its limits", [
                       "This is a share of ACCOUNTS, not of money: every contract has a long and a short, and the two sides are always equal in value. When 70% of accounts are long, many small longs are facing a few large shorts.",
                       "The gap between the all-accounts line and the top-traders line says more than either alone.",
                       "Binance publishes only 30 days of this data, and “top trader” is Binance’s own definition. Not financial advice."])],
        },
    },
}

# ---------------------------------------------------------------- the hub: /charts/
# ---------------------------------------------------------------- stage 3: options, on-chain, the Bitcoin cycle
T.update({
    "options": {
        "title": "آپشن بیت‌کوین و اتریوم: مکس پین و نوسان ضمنی | entekhab.net",
        "desc": "آپشن‌های بیت‌کوین و اتریوم در Deribit: اوپن اینترست به تفکیک قیمت اعمال و سررسید، مکس پین، نسبت پوت به کال، نوسان ضمنی و شاخص DVOL. زنده و رایگان.",
        "og": "آپشن‌های بیت‌کوین و اتریوم — مکس پین، اوپن اینترست و DVOL",
        "ld": "Entekhab Bitcoin and Ether options",
        "kw": ["آپشن", "اختیار معامله", "مکس پین", "max pain", "options", "put call", "dvol", "نوسان ضمنی", "implied volatility", "ئۆپشن", "الخيارات", "deribit"],
        "h1": {"fa": "آپشن‌های بیت‌کوین و اتریوم", "ckb": "ئۆپشنەکانی بیتکۆین و ئیسیریۆم", "ar": "خيارات البيتكوين والإيثر", "en": "Bitcoin and Ether options"},
        "p": {"fa": "اوپن اینترست آپشن‌ها به تفکیک قیمت اعمال و سررسید، مکس پین، نسبت فروش به خرید و نوسان ضمنی — زنده از Deribit",
              "ckb": "ئۆپن ئینتەرێستی ئۆپشنەکان بەپێی نرخی جێبەجێکردن و بەسەرچوون، ماکس پەین، ڕێژەی پوت بۆ کۆڵ و هەڵاوسانی ناوەکی — زیندوو لە Deribitـەوە",
              "ar": "العقود المفتوحة للخيارات حسب سعر التنفيذ والاستحقاق، أقصى ألم، نسبة البيع إلى الشراء والتقلب الضمني — مباشرة من Deribit",
              "en": "Options open interest by strike and expiry, max pain, the put/call ratio and implied volatility — live from Deribit"},
        "about": {
            "fa": [("این صفحه چه نشان می‌دهد", [
                "<b>آپشن چیست:</b> قراردادی که به خریدارش حق می‌دهد — نه تعهد — که تا سررسید، دارایی را به قیمتی مشخص (قیمت اعمال) بخرد (اختیار خرید یا کال) یا بفروشد (اختیار فروش یا پوت).",
                "<b>بر پایهٔ قیمت اعمال:</b> برای هر قیمت اعمال، ستون سبز اوپن اینترست اختیارهای خرید و ستون قرمز اختیارهای فروش است؛ برای همهٔ سررسیدها با هم یا یک سررسید. خط سفید قیمت شاخص و خط نارنجی مکس پین همان سررسید است.",
                "<b>بر پایهٔ سررسید:</b> اوپن اینترست هر سررسید، و در جدول زیر نمودار: روزهای مانده، نسبت فروش به خرید، ارزش اسمی، مکس پین و نوسان ضمنی در قیمت فعلی. با زدن روی هر سررسید، قیمت‌های اعمالش باز می‌شود.",
                "<b>نوسان ضمنی:</b> شاخص DVOL — برآورد بازار آپشن از نوسان سالانهٔ ۳۰ روز آینده — زیر قیمت شاخص، از ۱ ماه تا همهٔ تاریخچه.",
                "<b>کاشی‌ها:</b> کل اوپن اینترست آپشن‌ها به دلار، نسبت فروش به خرید، DVOL و مکس پین نزدیک‌ترین سررسید پرحجم."]),
                   ("روش و محدودیت‌ها", [
                       "<b>مکس پین</b> قیمتی است که اگر سررسید در آن تسویه شود، مجموع ارزش همهٔ آپشن‌های آن سررسید برای دارندگانشان کمترین است: برای هر قیمت اعمال، «اوپن اینترست خرید × فاصلهٔ قیمت بالاتر از آن» به‌علاوهٔ «اوپن اینترست فروش × فاصلهٔ قیمت پایین‌تر از آن». این حسابی روی اوپن اینترست است، نه پیش‌بینی قیمت تسویه.",
                       "<b>نسبت فروش به خرید</b> = اوپن اینترست (یا حجم ۲۴ ساعت) اختیارهای فروش ÷ اختیارهای خرید. اختیار فروش هم برای شرط بستن روی افت خریده می‌شود و هم برای بیمه کردن دارایی؛ پس این نسبت به‌تنهایی جهت بازار را نمی‌گوید.",
                       "<b>ارزش اسمی</b> = اوپن اینترست به تعداد کوین × قیمت شاخص. هر قرارداد آپشن در Deribit برابر یک کوین است.",
                       "فقط Deribit شمرده می‌شود که بیشتر بازار آپشن کریپتو را در اختیار دارد؛ CME و آپشن‌های صرافی‌های دیگر در این ارقام نیستند. توصیهٔ مالی نیست."]),
                   ("منابع", ["دادهٔ عمومی Deribit (دفتر آپشن‌ها، شاخص DVOL و قیمت تحویل روزانه) که مستقیم در مرورگر شما خوانده و هر دو دقیقه تازه می‌شود."])],
            "ckb": [("ئەم پەڕەیە چی پیشان دەدات", [
                "<b>ئۆپشن چییە:</b> گرێبەستێکە ماف دەداتە کڕیارەکەی — نەک ئەرک — کە تا بەسەرچوون، دراوەکە بە نرخێکی دیاریکراو (نرخی جێبەجێکردن) بکڕێت (کۆڵ) یان بفرۆشێت (پوت).",
                "<b>بەپێی نرخی جێبەجێکردن:</b> بۆ هەر نرخێک، ستوونی سەوز ئۆپن ئینتەرێستی کۆڵەکان و ستوونی سوور هی پوتەکانە؛ بۆ هەموو بەسەرچوونەکان پێکەوە یان یەک بەسەرچوون. هێڵی سپی نرخی ئیندێکس و هێڵی پرتەقاڵی ماکس پەینی ئەو بەسەرچوونەیە.",
                "<b>بەپێی بەسەرچوون:</b> ئۆپن ئینتەرێستی هەر بەسەرچوونێک، و لە خشتەی ژێر چارتەکە: ڕۆژی ماوە، ڕێژەی پوت بۆ کۆڵ، بەهای ناوی، ماکس پەین و هەڵاوسانی ناوەکی لە نرخی ئێستادا.",
                "<b>هەڵاوسانی ناوەکی:</b> پێوەری DVOL — خەمڵاندنی بازاڕی ئۆپشن بۆ هەڵاوسانی ساڵانەی ٣٠ ڕۆژی داهاتوو — لە ژێر نرخی ئیندێکسدا."]),
                    ("ڕێگا و سنوورەکان", [
                        "<b>ماکس پەین</b> ئەو نرخەیە کە ئەگەر بەسەرچوونەکە تێیدا یەکلا ببێتەوە، کۆی بەهای هەموو ئۆپشنەکانی ئەو بەسەرچوونە بۆ خاوەنەکانیان کەمترینە. ئەمە ژمێرکارییە لەسەر ئۆپن ئینتەرێست، نەک پێشبینی.",
                        "<b>ڕێژەی پوت بۆ کۆڵ</b> = ئۆپن ئینتەرێستی (یان قەبارەی ٢٤ کاتژمێری) پوتەکان ÷ کۆڵەکان. پوت هەم بۆ گرەوکردن لەسەر دابەزین دەکڕدرێت و هەم بۆ بیمەکردنی دارایی؛ بۆیە بە تەنها ئاراستەی بازاڕ ناڵێت.",
                        "تەنها Deribit دەژمێردرێت کە زۆربەی بازاڕی ئۆپشنی کریپتۆی لە دەستدایە؛ CME و ئاڵوگۆڕگەکانی تر لەم ژمارانەدا نین. ئامۆژگاریی دارایی نییە."]),
                    ("سەرچاوەکان", ["داتای گشتیی Deribit، ڕاستەوخۆ لە وێبگەڕەکەتدا دەخوێنرێتەوە و هەر دوو خولەک نوێ دەبێتەوە."])],
            "ar": [("ماذا تُظهر هذه الصفحة", [
                "<b>ما الخيار:</b> عقد يمنح مشتريه الحق — لا الالتزام — في شراء الأصل (خيار شراء) أو بيعه (خيار بيع) بسعر محدّد (سعر التنفيذ) حتى الاستحقاق.",
                "<b>حسب سعر التنفيذ:</b> لكل سعر تنفيذ عمود أخضر للعقود المفتوحة لخيارات الشراء وعمود أحمر لخيارات البيع؛ لكل الاستحقاقات معًا أو لاستحقاق واحد. الخط الأبيض سعر المؤشر والبرتقالي أقصى ألم لذلك الاستحقاق.",
                "<b>حسب الاستحقاق:</b> العقود المفتوحة لكل استحقاق، وفي الجدول تحت الرسم: الأيام الباقية، نسبة البيع إلى الشراء، القيمة الاسمية، أقصى ألم والتقلب الضمني عند السعر الحالي.",
                "<b>التقلب الضمني:</b> مؤشر DVOL — تقدير سوق الخيارات للتقلب السنوي خلال ٣٠ يومًا قادمة — تحت سعر المؤشر."]),
                   ("المنهج والحدود", [
                       "<b>أقصى ألم</b> هو السعر الذي لو سُوّي الاستحقاق عنده لكانت قيمة كل خياراته مجتمعةً لحامليها هي الأدنى. هذا حساب على العقود المفتوحة وليس توقّعًا.",
                       "<b>نسبة البيع إلى الشراء</b> = العقود المفتوحة (أو حجم ٢٤ ساعة) لخيارات البيع ÷ خيارات الشراء. يُشترى خيار البيع للمراهنة على الهبوط وللتحوّط معًا، فلا تدلّ النسبة وحدها على اتجاه السوق.",
                       "تُحتسب Deribit وحدها، وهي تستحوذ على معظم سوق خيارات العملات المشفرة؛ CME والمنصات الأخرى خارج هذه الأرقام. ليست نصيحة مالية."]),
                   ("المصادر", ["بيانات Deribit العامة، تُقرأ مباشرة في متصفحك وتُحدَّث كل دقيقتين."])],
            "en": [("What this page shows", [
                "<b>What an option is:</b> a contract that gives its buyer the right — not the duty — to buy the asset (a call) or sell it (a put) at a set price (the strike) until the expiry.",
                "<b>By strike:</b> for every strike, the green bar is the open interest of calls and the red bar of puts; for all expiries together or one of them. The white line is the index price and the orange line that expiry’s max pain.",
                "<b>By expiry:</b> each expiry’s open interest, and in the table under the chart: days left, put/call ratio, notional, max pain and implied volatility at the present price. Click an expiry to open its strikes.",
                "<b>Implied volatility:</b> DVOL — the options market’s estimate of annualised volatility over the next 30 days — under the index price, from a month to all of its history.",
                "<b>The tiles:</b> total options open interest in dollars, the put/call ratio, DVOL and the max pain of the nearest large expiry."]),
                   ("Method and limits", [
                       "<b>Max pain</b> is the price at which, if the expiry settled there, all of that expiry’s options together would be worth the least to their holders: for every strike, “call open interest × how far the price is above it” plus “put open interest × how far the price is below it”. It is arithmetic on open interest, not a forecast of the settlement price.",
                       "<b>The put/call ratio</b> = open interest (or 24-hour volume) of puts ÷ calls. Puts are bought to bet on a fall and also to insure holdings, so the ratio alone does not give the market’s direction.",
                       "<b>Notional</b> = open interest in coins × the index price. One Deribit option contract is one coin.",
                       "Only Deribit is counted. It holds most of the crypto options market; CME and other exchanges’ options are not in these figures. Not financial advice."]),
                   ("Sources", ["Deribit’s public data (the options book, the DVOL index and the daily delivery price), read directly in your browser and refreshed every two minutes."])],
        },
    },
    "mvrv": {
        "title": "MVRV بیت‌کوین، قیمت تحقق‌یافته و NUPL | entekhab.net",
        "desc": "نمودار MVRV، MVRV Z-Score، قیمت تحقق‌یافته و NUPL بیت‌کوین و اتریوم از ۲۰۱۰ تا امروز، با نوارهای سقف و کف گذشته و جایگاه امروز در تاریخ. رایگان، به چهار زبان.",
        "og": "MVRV، قیمت تحقق‌یافته و NUPL — بیت‌کوین و اتریوم",
        "ld": "Entekhab MVRV, realized price and NUPL",
        "kw": ["mvrv", "nupl", "realized price", "قیمت تحقق یافته", "ام وی آر وی", "z-score", "آنچین", "on-chain", "ئانچین", "glassnode", "گلس نود"],
        "h1": {"fa": "MVRV، قیمت تحقق‌یافته و NUPL", "ckb": "MVRV، نرخی بەدیهاتوو و NUPL", "ar": "MVRV والسعر المحقّق وNUPL", "en": "MVRV, realized price and NUPL"},
        "p": {"fa": "بازار نسبت به قیمتی که دارندگان واقعاً پرداخته‌اند کجاست: MVRV، MVRV Z-Score، قیمت تحقق‌یافته و NUPL بیت‌کوین و اتریوم، هر روز از سال ۲۰۱۰",
              "ckb": "بازاڕ بە بەراورد لەگەڵ ئەو نرخەی خاوەنەکان بەڕاستی داویانە لە کوێدایە: MVRV، MVRV Z-Score، نرخی بەدیهاتوو و NUPLی بیتکۆین و ئیسیریۆم، هەموو ڕۆژێک لە ٢٠١٠ـەوە",
              "ar": "أين السوق من السعر الذي دفعه الحائزون فعلًا: MVRV وMVRV Z-Score والسعر المحقّق وNUPL للبيتكوين والإيثر، يومًا بيوم منذ ٢٠١٠",
              "en": "Where the market stands against what holders actually paid: MVRV, MVRV Z-Score, realized price and NUPL of Bitcoin and Ether, every day since 2010"},
        "about": {
            "fa": [("این شاخص‌ها چه می‌گویند", [
                "<b>ارزش تحقق‌یافته:</b> هر کوین به قیمت روزی حساب می‌شود که آخرین بار روی زنجیره جابه‌جا شده، نه به قیمت امروز. جمع این‌ها تقریباً همان پولی است که دارندگان برای کوین‌هایشان پرداخته‌اند.",
                "<b>قیمت تحقق‌یافته</b> = ارزش تحقق‌یافته ÷ تعداد کوین‌ها: میانگین قیمت تمام‌شدهٔ بازار. قیمت زیر آن یعنی دارندهٔ میانگین در زیان است.",
                "<b>MVRV</b> = ارزش بازار ÷ ارزش تحقق‌یافته. عدد ۲ یعنی بازار به‌طور میانگین دو برابر قیمت خریدش می‌ارزد.",
                "<b>NUPL</b> = ۱ − ۱ ÷ MVRV: سود یا زیان تحقق‌نیافتهٔ کل بازار به نسبت ارزش بازار. نوارهای رنگی‌اش نام‌گذاری رایج این شاخص است، از «تسلیم» زیر صفر تا «سرخوشی» بالای ۰٫۷۵.",
                "<b>MVRV Z-Score</b> = (ارزش بازار − ارزش تحقق‌یافته) ÷ انحراف معیار ارزش بازار در همهٔ روزهای تا آن روز."]),
                   ("چطور بخوانیم", [
                       "سقف‌های چرخه‌های گذشتهٔ بیت‌کوین با MVRV بالای حدود ۳٫۷ و کف‌ها با MVRV زیر ۱ همراه بوده‌اند؛ نوارهای قرمز و سبز همین‌ها را نشان می‌دهند.",
                       "این نوارها قراردادند، نه قانون: فقط چند چرخه پشتشان است و اوج هر چرخه از قبلی پایین‌تر بوده. برای همین کنار هر عدد نوشته‌ایم که در چه سهمی از همهٔ روزهای تاریخ، مقدار برابر یا کمتر از امروز بوده است.",
                       "آخرین نقطه آخرین روز بسته‌شده به وقت UTC است، نه لحظهٔ اکنون. توصیهٔ مالی نیست."]),
                   ("منابع", ["دادهٔ همگانی Coin Metrics (مجوز CC BY-NC): قیمت، عرضه و MVRV روزانه. بقیهٔ شاخص‌ها با فرمول‌های بالا در خود صفحه از همین سه عدد حساب می‌شوند."])],
            "ckb": [("ئەم پێوەرانە چی دەڵێن", [
                "<b>بەهای بەدیهاتوو:</b> هەر دراوێک بە نرخی ئەو ڕۆژە دەژمێردرێت کە دواجار لەسەر زنجیرە جووڵاوە، نەک بە نرخی ئەمڕۆ. کۆی ئەمانە نزیکەی ئەو پارەیەیە کە خاوەنەکان بۆ دراوەکانیان داویانە.",
                "<b>نرخی بەدیهاتوو</b> = بەهای بەدیهاتوو ÷ ژمارەی دراوەکان: تێکڕای نرخی کڕینی بازاڕ. نرخ لە خواری بێت واتە خاوەنی مامناوەند لە زیاندایە.",
                "<b>MVRV</b> = بەهای بازاڕ ÷ بەهای بەدیهاتوو. ٢ واتە بازاڕ بە تێکڕا دوو هێندەی نرخی کڕینی دەکات.",
                "<b>NUPL</b> = ١ − ١ ÷ MVRV: قازانج یان زیانی بەدینەهاتووی هەموو بازاڕ بە ڕێژەی بەهای بازاڕ؛ لە «تەسلیمبوون» لە خوار سفرەوە تا «سەرخۆشی» لە سەرووی ٠٫٧٥.",
                "<b>MVRV Z-Score</b> = (بەهای بازاڕ − بەهای بەدیهاتوو) ÷ لادانی پێوانەیی بەهای بازاڕ لە هەموو ڕۆژەکانی تا ئەو ڕۆژە."]),
                    ("چۆن بیخوێنینەوە", [
                        "لووتکەکانی خولەکانی ڕابردووی بیتکۆین لەگەڵ MVRVی سەرووی نزیکەی ٣٫٧ و بنەکان لەگەڵ MVRVی خوار ١ بوون؛ هێڵە سوور و سەوزەکان ئەمانە پیشان دەدەن.",
                        "ئەم هێڵانە ڕێککەوتنن، نەک یاسا: تەنها چەند خولێکیان لە پشتە. بۆیە لە تەنیشت هەر ژمارەیەک نووسیومانە لە چ بەشێکی هەموو ڕۆژەکانی مێژوودا بەهاکە یەکسان یان کەمتر لە ئەمڕۆ بووە.",
                        "دوایین خاڵ دوایین ڕۆژی داخراوە بە کاتی UTC، نەک ئەم ساتە. ئامۆژگاریی دارایی نییە."]),
                    ("سەرچاوەکان", ["داتای گشتیی Coin Metrics (مۆڵەتی CC BY-NC): نرخ، خستنەڕوو و MVRVی ڕۆژانە. پێوەرەکانی تر بە فۆرمووڵەکانی سەرەوە لە خودی پەڕەکەدا دەژمێردرێن."])],
            "ar": [("ماذا تقول هذه المقاييس", [
                "<b>القيمة المحقّقة:</b> تُحسب كل عملة بسعر اليوم الذي تحرّكت فيه آخر مرة على السلسلة لا بسعر اليوم. مجموعها يقارب المال الذي دفعه الحائزون مقابل عملاتهم.",
                "<b>السعر المحقّق</b> = القيمة المحقّقة ÷ عدد العملات: متوسط تكلفة السوق. السعر تحته يعني أن الحائز المتوسط خاسر.",
                "<b>MVRV</b> = القيمة السوقية ÷ القيمة المحقّقة. الرقم ٢ يعني أن السوق يساوي في المتوسط ضعف سعر شرائه.",
                "<b>NUPL</b> = ١ − ١ ÷ MVRV: الربح أو الخسارة غير المحقّقة للسوق كله نسبةً إلى القيمة السوقية؛ من «الاستسلام» تحت الصفر إلى «النشوة» فوق ٠٫٧٥.",
                "<b>MVRV Z-Score</b> = (القيمة السوقية − القيمة المحقّقة) ÷ الانحراف المعياري للقيمة السوقية في كل الأيام حتى ذلك اليوم."]),
                   ("كيف تُقرأ", [
                       "قمم دورات البيتكوين السابقة رافقها MVRV فوق نحو ٣٫٧ وقيعانها MVRV تحت ١؛ الشريطان الأحمر والأخضر يبيّنان ذلك.",
                       "هذه الحدود عرف لا قانون: وراءها دورات قليلة فقط. لذلك كتبنا بجانب كل رقم في أي حصة من كل أيام التاريخ كانت القيمة مساوية لقيمة اليوم أو أقل.",
                       "آخر نقطة هي آخر يوم مغلق بتوقيت UTC لا اللحظة الحالية. ليست نصيحة مالية."]),
                   ("المصادر", ["بيانات Coin Metrics المجتمعية (رخصة CC BY-NC): السعر والمعروض وMVRV يوميًّا. بقية المقاييس تُحسب في الصفحة نفسها بالمعادلات أعلاه."])],
            "en": [("What these measures say", [
                "<b>Realized value:</b> every coin is counted at the price of the day it last moved on the chain, not at today’s price. The total is roughly what holders paid for their coins.",
                "<b>Realized price</b> = realized value ÷ the number of coins: the market’s average cost. A price below it means the average holder is at a loss.",
                "<b>MVRV</b> = market value ÷ realized value. A reading of 2 means the market is worth, on average, twice what it was bought for.",
                "<b>NUPL</b> = 1 − 1 ÷ MVRV: the whole market’s unrealized profit or loss as a share of the market value. Its coloured bands are the usual names for this measure, from “capitulation” below zero to “euphoria” above 0.75.",
                "<b>MVRV Z-Score</b> = (market value − realized value) ÷ the standard deviation of the market value over every day up to that day."]),
                   ("How to read them", [
                       "Bitcoin’s past cycle tops came with MVRV above about 3.7 and its bottoms with MVRV below 1; the red and green bands mark those.",
                       "The bands are conventions, not laws: only a few cycles stand behind them, and each cycle’s peak was lower than the one before. That is why every figure comes with the share of all days in history whose value was at or below today’s.",
                       "The last point is the last closed UTC day, not this moment. Not financial advice."]),
                   ("Sources", ["Coin Metrics community data (CC BY-NC licence): daily price, supply and MVRV. Every other measure is computed in the page from those three with the formulas above."])],
        },
    },
    "flows": {
        "title": "ذخایر و جریان بیت‌کوین صرافی‌ها، روزانه | entekhab.net",
        "desc": "موجودی بیت‌کوین و اتریوم صرافی‌ها، ورودی، خروجی و جریان خالص روزانه از ۲۰۱۱ تا امروز، با جمع ۷ و ۳۰ روزه و سهم از کل عرضه، زیر نمودار قیمت. رایگان.",
        "og": "ذخایر و جریان صرافی‌ها — بیت‌کوین و اتریوم",
        "ld": "Entekhab exchange reserves and flows",
        "kw": ["ذخایر صرافی", "exchange reserve", "netflow", "جریان صرافی", "inflow", "outflow", "ورودی صرافی", "cryptoquant", "کریپتوکوانت", "یەدەگی ئاڵوگۆڕگە", "احتياطي المنصات"],
        "h1": {"fa": "ذخایر و جریان صرافی‌ها", "ckb": "یەدەگ و ڕەوتی ئاڵوگۆڕگەکان", "ar": "احتياطيات المنصات وتدفقاتها", "en": "Exchange reserves and flows"},
        "p": {"fa": "چند بیت‌کوین و اتریوم روی صرافی‌هاست و هر روز چقدر وارد و خارج می‌شود — موجودی، ورودی، خروجی و جریان خالص، زیر نمودار قیمت",
              "ckb": "چەند بیتکۆین و ئیسیریۆم لەسەر ئاڵوگۆڕگەکانە و هەر ڕۆژێک چەند دێت و دەڕوات — یەدەگ، هاتن، ڕۆیشتن و ڕەوتی سافی، لە ژێر چارتی نرخدا",
              "ar": "كم بيتكوين وإيثر لدى المنصات وكم يدخل ويخرج كل يوم — الاحتياطي والداخل والخارج وصافي التدفق، تحت رسم السعر",
              "en": "How much Bitcoin and Ether sits on exchanges and how much arrives and leaves each day — reserve, inflow, outflow and net flow, under the price"},
        "about": {
            "fa": [("این صفحه چه نشان می‌دهد", [
                "<b>ذخیرهٔ صرافی‌ها:</b> تعداد کوین‌هایی که در کیف‌پول‌های شناخته‌شدهٔ صرافی‌ها نگه‌داری می‌شود، و سهمش از کل عرضه.",
                "<b>جریان خالص:</b> ورودی منهای خروجی هر روز. ستون نارنجی یعنی کوین بیشتری به صرافی‌ها رفته تا بیرون آمده؛ ستون سبزآبی یعنی برعکس. خط پایین جمع ۳۰ روزه است.",
                "<b>ورودی و خروجی:</b> میانگین ۷ روزهٔ کوین‌هایی که به صرافی‌ها واریز و از آن‌ها برداشت شده.",
                "<b>جدول:</b> ارقام ۱۴ روز اخیر."]),
                   ("چطور بخوانیم", [
                       "کوینی که به صرافی می‌رود می‌تواند فروخته شود و کوینی که بیرون می‌آید معمولاً برای نگه‌داری می‌رود؛ برای همین کاهش پیوستهٔ ذخیره را نشانهٔ انباشت می‌دانند. اما واریز هنوز فروش نیست: می‌تواند وثیقهٔ معامله، جابه‌جایی داخلی یا واریز یک صندوق باشد.",
                       "یک روز به‌تنهایی معنای زیادی ندارد؛ جمع ۷ و ۳۰ روزه را ببینید."]),
                   ("روش و محدودیت‌ها", [
                       "ارقام مربوط به صرافی‌هایی است که Coin Metrics آدرس‌هایشان را شناسایی کرده است؛ همهٔ صرافی‌ها و کیف‌پول‌ها را نمی‌پوشاند و با ارقام سایت‌هایی که فهرست دیگری دارند برابر نیست.",
                       "روزهای آخر موقتی‌اند و ممکن است با شناسایی آدرس‌های تازه اصلاح شوند. تفکیک صرافی‌به‌صرافی در دادهٔ رایگان نیست.",
                       "ذخیره با شناسایی آدرس‌های تازهٔ صرافی‌ها هم جابه‌جا می‌شود؛ پس تغییر ذخیره در یک بازه لزوماً با جمع جریان‌های خالص همان بازه برابر نیست.",
                       "منبع: دادهٔ همگانی Coin Metrics (مجوز CC BY-NC)، روزی یک مقدار به وقت UTC. توصیهٔ مالی نیست."])],
            "ckb": [("ئەم پەڕەیە چی پیشان دەدات", [
                "<b>یەدەگی ئاڵوگۆڕگەکان:</b> ژمارەی ئەو دراوانەی لە جزدانە ناسراوەکانی ئاڵوگۆڕگەکاندا هەڵگیراون، و بەشی لە کۆی خستنەڕوو.",
                "<b>ڕەوتی سافی:</b> هاتن کەم ڕۆیشتنی هەر ڕۆژێک. ستوونی پرتەقاڵی واتە دراوی زیاتر چووەتە ئاڵوگۆڕگەکان لەوەی دەرچووە؛ ستوونی سەوزی شین واتە پێچەوانە. هێڵی خوارەوە کۆی ٣٠ ڕۆژە.",
                "<b>هاتن و ڕۆیشتن:</b> تێکڕای ٧ ڕۆژەی ئەو دراوانەی نێردراونەتە ئاڵوگۆڕگەکان و لێیان دەرهێنراون.",
                "<b>خشتە:</b> ژمارەکانی ١٤ ڕۆژی ڕابردوو."]),
                    ("چۆن بیخوێنینەوە", [
                        "دراوێک کە دەچێتە ئاڵوگۆڕگە دەکرێت بفرۆشرێت و ئەوەی دەردەچێت زۆرجار بۆ هەڵگرتن دەڕوات؛ بۆیە کەمبوونەوەی بەردەوامی یەدەگ بە نیشانەی کۆکردنەوە دادەنرێت. بەڵام ناردن هێشتا فرۆشتن نییە.",
                        "ڕۆژێک بە تەنها واتایەکی زۆری نییە؛ سەیری کۆی ٧ و ٣٠ ڕۆژ بکە."]),
                    ("ڕێگا و سنوورەکان", [
                        "ژمارەکان هی ئەو ئاڵوگۆڕگانەن کە Coin Metrics ناونیشانەکانیانی ناسیوە؛ هەموو ئاڵوگۆڕگە و جزدانەکان ناگرێتەوە.",
                        "ڕۆژە نوێیەکان کاتین و لەوانەیە ڕاست بکرێنەوە. جیاکردنەوەی ئاڵوگۆڕگە بە ئاڵوگۆڕگە لە داتای بێبەرامبەردا نییە.",
                        "یەدەگ بە ناسینەوەی ناونیشانی نوێی ئاڵوگۆڕگەکانیش دەگۆڕێت؛ بۆیە گۆڕانی یەدەگ لە ماوەیەکدا مەرج نییە لەگەڵ کۆی ڕەوتە سافییەکانی هەمان ماوە یەکسان بێت.",
                        "سەرچاوە: داتای گشتیی Coin Metrics (مۆڵەتی CC BY-NC)، ڕۆژی یەک بەها بە کاتی UTC. ئامۆژگاریی دارایی نییە."])],
            "ar": [("ماذا تُظهر هذه الصفحة", [
                "<b>احتياطي المنصات:</b> عدد العملات المحفوظة في محافظ المنصات المعروفة، وحصته من المعروض.",
                "<b>صافي التدفق:</b> الداخل ناقص الخارج كل يوم. العمود البرتقالي يعني أن ما دخل المنصات أكثر مما خرج؛ والعمود الأخضر المزرقّ عكس ذلك. الخط السفلي مجموع ٣٠ يومًا.",
                "<b>الداخل والخارج:</b> متوسط ٧ أيام للعملات المودَعة في المنصات والمسحوبة منها.",
                "<b>الجدول:</b> أرقام آخر ١٤ يومًا."]),
                   ("كيف تُقرأ", [
                       "العملة التي تدخل منصة قد تُباع والتي تخرج تذهب غالبًا للحفظ؛ لذلك يُعدّ الانخفاض المتواصل للاحتياطي علامة تجميع. لكن الإيداع ليس بيعًا بعد.",
                       "اليوم الواحد لا يعني كثيرًا؛ انظر مجموع ٧ و٣٠ يومًا."]),
                   ("المنهج والحدود", [
                       "الأرقام للمنصات التي تعرّفت Coin Metrics على عناوينها؛ لا تغطّي كل المنصات والمحافظ.",
                       "الأيام الأحدث مؤقتة وقد تُعدَّل. التفصيل منصةً منصةً غير متاح في البيانات المجانية.",
                       "يتغيّر الاحتياطي أيضًا حين تُعرَّف عناوين جديدة للمنصات؛ فلا يلزم أن يساوي تغيّره في مدة ما مجموع صافي التدفقات في المدة نفسها.",
                       "المصدر: بيانات Coin Metrics المجتمعية (رخصة CC BY-NC)، قيمة في اليوم بتوقيت UTC. ليست نصيحة مالية."])],
            "en": [("What this page shows", [
                "<b>Exchange reserve:</b> the number of coins held in the known wallets of exchanges, and its share of the supply.",
                "<b>Net flow:</b> each day’s inflow minus outflow. An orange bar means more coins went to exchanges than left; a teal bar the opposite. The lower line is the 30-day sum.",
                "<b>Inflow and outflow:</b> the 7-day average of coins deposited to and withdrawn from exchanges.",
                "<b>The table:</b> the figures of the last 14 days."]),
                   ("How to read it", [
                       "A coin sent to an exchange can be sold, and one withdrawn usually goes into storage; that is why a steady fall in the reserve is read as accumulation. But a deposit is not yet a sale: it can be trading collateral, an internal move or a fund’s deposit.",
                       "A single day means little; look at the 7-day and 30-day sums."]),
                   ("Method and limits", [
                       "The figures cover the exchanges whose addresses Coin Metrics has identified; not every exchange or wallet, so they differ from sites that use another list.",
                       "The newest days are provisional and may be revised as new addresses are identified. A breakdown per exchange is not in the free data.",
                       "The reserve also moves when new exchange addresses are identified, so its change over a period need not equal the sum of that period’s net flows.",
                       "Source: Coin Metrics community data (CC BY-NC licence), one value a day, UTC. Not financial advice."])],
        },
    },
    "network": {
        "title": "آدرس‌های فعال، نرخ هش و درآمد ماینرها | entekhab.net",
        "desc": "فعالیت شبکهٔ بیت‌کوین و اتریوم: آدرس‌های فعال، تراکنش‌ها، نرخ هش و هش ریبون، درآمد ماینرها، سهم کارمزد، ضریب پوئل و نسبت موجودی به جریان، از آغاز تا امروز.",
        "og": "شبکه و ماینرها — آدرس فعال، نرخ هش، پوئل",
        "ld": "Entekhab network activity and miners",
        "kw": ["آدرس فعال", "active addresses", "نرخ هش", "hash rate", "هش ریت", "puell", "پوئل", "ماینر", "miner revenue", "stock to flow", "ڕێژەی هاش", "معدل التجزئة"],
        "h1": {"fa": "فعالیت شبکه و ماینرها", "ckb": "چالاکیی تۆڕ و ماینەرەکان", "ar": "نشاط الشبكة والمعدّنون", "en": "Network activity and miners"},
        "p": {"fa": "شبکه چقدر استفاده می‌شود و ماینرها چه می‌گیرند: آدرس‌های فعال، تراکنش‌ها، نرخ هش، درآمد ماینرها، ضریب پوئل و نسبت موجودی به جریان",
              "ckb": "تۆڕەکە چەند بەکاردێت و ماینەرەکان چی وەردەگرن: ناونیشانە چالاکەکان، مامەڵەکان، ڕێژەی هاش، داهاتی ماینەرەکان، چەندجارەی پوێڵ و ڕێژەی کۆگا بۆ ڕەوت",
              "ar": "كم تُستعمل الشبكة وماذا يكسب المعدّنون: العناوين النشطة والمعاملات ومعدل التجزئة وإيرادات المعدّنين ومضاعف بويل ونسبة المخزون إلى التدفق",
              "en": "How much the network is used and what miners earn: active addresses, transactions, hash rate, miner revenue, the Puell multiple and stock-to-flow"},
        "about": {
            "fa": [("شاخص‌های این صفحه", [
                "<b>آدرس‌های فعال:</b> شمار آدرس‌هایی که در یک روز فرستنده یا گیرنده بوده‌اند؛ خط خاکستری روزانه و خط نارنجی میانگین ۷ روزه.",
                "<b>تراکنش‌ها:</b> تراکنش‌ها و انتقال‌های هر روز (هر تراکنش می‌تواند چند انتقال داشته باشد).",
                "<b>نرخ هش:</b> توان پردازشی شبکهٔ بیت‌کوین به اگزاهش بر ثانیه، با میانگین ۳۰ و ۶۰ روزه. وقتی میانگین ۳۰ روزه زیر ۶۰ روزه می‌رود، یعنی بخشی از ماینرها دستگاه خاموش کرده‌اند («هش ریبون»).",
                "<b>درآمد ماینرها:</b> کوین‌های تازه به‌علاوهٔ کارمزدها، به دلار در روز، و سهم کارمزد از آن.",
                "<b>ضریب پوئل:</b> ارزش دلاری کوین‌های تازهٔ یک روز ÷ میانگین ۳۶۵ روزهٔ همان. زیر ۰٫۵ در کف‌ها و بالای ۴ در سقف‌های گذشته دیده شده است.",
                "<b>موجودی به جریان:</b> کل کوین‌های موجود ÷ کوین‌های صادرشده در ۳۶۵ روز اخیر. فقط خودِ نسبت نشان داده می‌شود، نه مدل قیمتی که بر پایهٔ آن ساخته‌اند."]),
                   ("محدودیت‌ها", [
                       "آدرس فعال به معنی یک کاربر نیست: یک نفر می‌تواند چند آدرس داشته باشد و یک صرافی با چند آدرس به هزاران نفر خدمت می‌دهد.",
                       "نرخ هش مستقیم اندازه‌گیری نمی‌شود؛ از سرعت پیدا شدن بلاک‌ها و سختی شبکه برآورد می‌شود و عدد روزانه‌اش پرنوسان است.",
                       "نرخ هش، درآمد ماینرها، پوئل و موجودی به جریان فقط برای بیت‌کوین نشان داده می‌شوند: اتریوم از سپتامبر ۲۰۲۲ استخراج ندارد و بیشتر کارمزدش سوزانده می‌شود. نوارها قراردادند، نه سیگنال. توصیهٔ مالی نیست."]),
                   ("منابع", ["دادهٔ همگانی Coin Metrics (مجوز CC BY-NC)، روزی یک مقدار به وقت UTC."])],
            "ckb": [("پێوەرەکانی ئەم پەڕەیە", [
                "<b>ناونیشانە چالاکەکان:</b> ژمارەی ئەو ناونیشانانەی لە ڕۆژێکدا نێرەر یان وەرگر بوون؛ هێڵی خۆڵەمێشی ڕۆژانە و هێڵی پرتەقاڵی تێکڕای ٧ ڕۆژە.",
                "<b>مامەڵەکان:</b> مامەڵە و گواستنەوەکانی هەر ڕۆژێک.",
                "<b>ڕێژەی هاش:</b> توانای ژمێرکاریی تۆڕی بیتکۆین بە ئێگزاهاش لە چرکەیەکدا، لەگەڵ تێکڕای ٣٠ و ٦٠ ڕۆژە. کاتێک تێکڕای ٣٠ ڕۆژە دەچێتە خوار ٦٠ ڕۆژە، واتە بەشێک لە ماینەرەکان ئامێریان کوژاندووەتەوە.",
                "<b>داهاتی ماینەرەکان:</b> دراوە نوێیەکان لەگەڵ کرێکان، بە دۆلار لە ڕۆژێکدا، و بەشی کرێ لێی.",
                "<b>چەندجارەی پوێڵ:</b> بەهای دۆلاریی دراوە نوێیەکانی ڕۆژێک ÷ تێکڕای ٣٦٥ ڕۆژەی. لە خوار ٠٫٥ لە بنەکان و لە سەرووی ٤ لە لووتکەکانی ڕابردوودا بینراوە.",
                "<b>کۆگا بۆ ڕەوت:</b> کۆی دراوە هەبووەکان ÷ ئەو دراوانەی لە ٣٦٥ ڕۆژی ڕابردوودا دەرچوون. تەنها ڕێژەکە پیشان دەدرێت، نەک مۆدێلی نرخ."]),
                    ("سنوورەکان", [
                        "ناونیشانی چالاک واتای بەکارهێنەرێک نییە: کەسێک دەتوانێت چەند ناونیشانی هەبێت.",
                        "ڕێژەی هاش ڕاستەوخۆ ناپێورێت؛ لە خێرایی دۆزینەوەی بلۆکەکانەوە دەخەمڵێندرێت.",
                        "ڕێژەی هاش، داهاتی ماینەرەکان، پوێڵ و کۆگا بۆ ڕەوت تەنها بۆ بیتکۆینن: ئیسیریۆم لە ئەیلوولی ٢٠٢٢ـەوە ماینینگی نییە و زۆربەی کرێکانی دەسووتێنرێت. هێڵەکان ڕێککەوتنن، نەک سیگناڵ. ئامۆژگاریی دارایی نییە."]),
                    ("سەرچاوەکان", ["داتای گشتیی Coin Metrics (مۆڵەتی CC BY-NC)، ڕۆژی یەک بەها بە کاتی UTC."])],
            "ar": [("مقاييس هذه الصفحة", [
                "<b>العناوين النشطة:</b> عدد العناوين التي أرسلت أو استلمت في اليوم؛ الخط الرمادي يومي والبرتقالي متوسط ٧ أيام.",
                "<b>المعاملات:</b> معاملات كل يوم وتحويلاته.",
                "<b>معدل التجزئة:</b> القدرة الحسابية لشبكة البيتكوين بالإكساهاش في الثانية، مع متوسطي ٣٠ و٦٠ يومًا. حين يهبط متوسط ٣٠ يومًا تحت متوسط ٦٠ يومًا فقد أطفأ بعض المعدّنين أجهزتهم.",
                "<b>إيرادات المعدّنين:</b> العملات الجديدة مع الرسوم، بالدولار في اليوم، وحصة الرسوم منها.",
                "<b>مضاعف بويل:</b> القيمة الدولارية لإصدار اليوم ÷ متوسطها خلال ٣٦٥ يومًا. ظهر تحت ٠٫٥ عند القيعان وفوق ٤ عند القمم السابقة.",
                "<b>المخزون إلى التدفق:</b> كل العملات الموجودة ÷ ما صدر في آخر ٣٦٥ يومًا. تُعرض النسبة وحدها لا نموذج السعر."]),
                   ("الحدود", [
                       "العنوان النشط ليس مستخدمًا: قد يملك الشخص عناوين كثيرة.",
                       "معدل التجزئة لا يُقاس مباشرة؛ يُقدَّر من سرعة العثور على الكتل.",
                       "معدل التجزئة وإيرادات المعدّنين وبويل والمخزون إلى التدفق للبيتكوين فقط: الإيثر بلا تعدين منذ سبتمبر ٢٠٢٢ ويُحرق معظم رسومه. الحدود عرف لا إشارة. ليست نصيحة مالية."]),
                   ("المصادر", ["بيانات Coin Metrics المجتمعية (رخصة CC BY-NC)، قيمة في اليوم بتوقيت UTC."])],
            "en": [("The measures on this page", [
                "<b>Active addresses:</b> the number of addresses that sent or received on a day; the grey line is daily, the orange one the 7-day average.",
                "<b>Transactions:</b> each day’s transactions and transfers (one transaction can carry several transfers).",
                "<b>Hash rate:</b> the Bitcoin network’s computing power in exahashes per second, with its 30-day and 60-day averages. When the 30-day average falls below the 60-day one, some miners have switched machines off (the “hash ribbon”).",
                "<b>Miner revenue:</b> new coins plus fees, in dollars a day, and the fees’ share of it.",
                "<b>Puell multiple:</b> the dollar value of a day’s new coins ÷ its 365-day average. It has been below 0.5 at past bottoms and above 4 at past tops.",
                "<b>Stock-to-flow:</b> all coins in existence ÷ the coins issued in the last 365 days. Only the ratio is shown, not the price model built on it."]),
                   ("Limits", [
                       "An active address is not a user: one person can hold many, and an exchange serves thousands with a few.",
                       "Hash rate is not measured directly; it is estimated from how fast blocks are found and from the difficulty, and its daily figure is noisy.",
                       "Hash rate, miner revenue, Puell and stock-to-flow are shown for Bitcoin only: Ether has had no mining since September 2022 and burns most of its fees. The bands are conventions, not signals. Not financial advice."]),
                   ("Sources", ["Coin Metrics community data (CC BY-NC licence), one value a day, UTC."])],
        },
    },
    "cycle": {
        "title": "شاخص‌های چرخه بیت‌کوین: مایر و پای سایکل | entekhab.net",
        "desc": "شاخص‌های چرخهٔ بیت‌کوین روی یک صفحه: ضریب مایر، میانگین ۲۰۰ هفته، پای سایکل، ضریب ۲ ساله، نسبت طلایی و افت از سقف، با جدول جایگاه امروز در کل تاریخ.",
        "og": "شاخص‌های چرخهٔ بیت‌کوین — مایر، پای سایکل، میانگین ۲۰۰ هفته",
        "ld": "Entekhab Bitcoin cycle indicators",
        "kw": ["چرخه بیت کوین", "bitcoin cycle", "mayer multiple", "ضریب مایر", "pi cycle", "پای سایکل", "200 week", "میانگین ۲۰۰ هفته", "2 year ma", "golden ratio", "خولی بیتکۆین", "دورة البيتكوين"],
        "h1": {"fa": "شاخص‌های چرخهٔ بیت‌کوین", "ckb": "پێوەرەکانی خولی بیتکۆین", "ar": "مؤشرات دورة البيتكوين", "en": "Bitcoin cycle indicators"},
        "p": {"fa": "قیمت بیت‌کوین در برابر میانگین‌های بلندمدتش: ضریب مایر، میانگین ۲۰۰ هفته، پای سایکل، ضریب ۲ ساله، نسبت طلایی و افت از سقف — با جایگاه امروز در کل تاریخ",
              "ckb": "نرخی بیتکۆین بەرامبەر تێکڕا درێژخایەنەکانی: چەندجارەی مایەر، تێکڕای ٢٠٠ هەفتە، خولی پای، چەندجارەی ٢ ساڵە، ڕێژەی زێڕین و دابەزین لە لووتکە — لەگەڵ شوێنی ئەمڕۆ لە هەموو مێژوودا",
              "ar": "سعر البيتكوين أمام متوسطاته الطويلة: مضاعف ماير، متوسط ٢٠٠ أسبوع، دورة باي، مضاعف السنتين، النسبة الذهبية والتراجع عن القمة — مع موضع اليوم في التاريخ كله",
              "en": "Bitcoin’s price against its long averages: the Mayer multiple, the 200-week average, the Pi cycle, the 2-year multiplier, the golden ratio and the drawdown — with where today stands in all of history"},
        "about": {
            "fa": [("شاخص‌های این صفحه", [
                "<b>ضریب مایر:</b> قیمت ÷ میانگین ۲۰۰ روزه. بالای ۲٫۴ در اوج‌های گذشته و زیر ۰٫۸ در کف‌ها دیده شده است.",
                "<b>میانگین ۲۰۰ هفته:</b> میانگین ۱۴۰۰ روزهٔ قیمت؛ در چرخه‌های گذشته قیمت کمتر زیر آن مانده است.",
                "<b>پای سایکل:</b> میانگین ۱۱۱ روزه در برابر دو برابرِ میانگین ۳۵۰ روزه. در اوج‌های ۲۰۱۳، ۲۰۱۷ و آوریل ۲۰۲۱ خط اول از دومی بالا زد؛ نسبتشان زیر نمودار است.",
                "<b>ضریب ۲ ساله:</b> میانگین ۷۳۰ روزه (سبز) و پنج برابر آن (قرمز)؛ قیمت زیر خط سبز یا بالای خط قرمز، دو سرِ چرخه‌های گذشته بوده است.",
                "<b>نسبت طلایی:</b> میانگین ۳۵۰ روزه و ضریب‌های ۱٫۶، ۳ و ۵ آن.",
                "<b>افت از سقف:</b> فاصلهٔ قیمت از بالاترین قیمت پایانی تا آن روز."]),
                   ("جدول «شاخص‌های چرخه»", [
                       "برای هر شاخص: مقدار امروز، نوارهای قراردادی، اینکه امروز کجای آن نوارهاست، و اینکه در چه سهمی از همهٔ روزها مقدار برابر یا کمتر از امروز بوده. MVRV، MVRV Z-Score، NUPL و پوئل هم از صفحه‌های دیگر رصدخانه در همین جدول آمده‌اند.",
                       "این جدول رأی نمی‌دهد و جمع‌بندی «خرید» یا «فروش» ندارد: بیشتر این شاخص‌ها از یک قیمت ساخته شده‌اند و مستقل از هم نیستند."]),
                   ("محدودیت‌ها", [
                       "هر یک از این خط‌ها فقط سه یا چهار سقف و کف را در گذشته نشان داده است؛ این تعداد برای هیچ نتیجه‌گیری آماری کافی نیست، و اوج هر چرخه نسبت به میانگین‌ها از قبلی کوتاه‌تر بوده.",
                       "قیمت‌ها قیمت پایانی روز به وقت UTC هستند و آخرین نقطه آخرین روز بسته‌شده است. توصیهٔ مالی نیست.",
                       "منبع: قیمت روزانهٔ Coin Metrics (مجوز CC BY-NC) از ژوئیهٔ ۲۰۱۰."])],
            "ckb": [("پێوەرەکانی ئەم پەڕەیە", [
                "<b>چەندجارەی مایەر:</b> نرخ ÷ تێکڕای ٢٠٠ ڕۆژە. لە سەرووی ٢٫٤ لە لووتکەکانی ڕابردوو و لە خوار ٠٫٨ لە بنەکاندا بینراوە.",
                "<b>تێکڕای ٢٠٠ هەفتە:</b> تێکڕای ١٤٠٠ ڕۆژەی نرخ؛ لە خولەکانی ڕابردوودا نرخ کەمتر لە خواری ماوەتەوە.",
                "<b>خولی پای:</b> تێکڕای ١١١ ڕۆژە بەرامبەر دوو هێندەی تێکڕای ٣٥٠ ڕۆژە. لە لووتکەکانی ٢٠١٣، ٢٠١٧ و نیسانی ٢٠٢١دا هێڵی یەکەم لە دووەم تێپەڕی.",
                "<b>چەندجارەی ٢ ساڵە:</b> تێکڕای ٧٣٠ ڕۆژە (سەوز) و پێنج هێندەی (سوور).",
                "<b>ڕێژەی زێڕین:</b> تێکڕای ٣٥٠ ڕۆژە و ١٫٦، ٣ و ٥ هێندەی.",
                "<b>دابەزین لە لووتکە:</b> مەودای نرخ لە بەرزترین نرخی داخستن تا ئەو ڕۆژە."]),
                    ("خشتەی «پێوەرەکانی خول»", [
                        "بۆ هەر پێوەرێک: بەهای ئەمڕۆ، هێڵە ڕێککەوتووەکان، شوێنی ئەمڕۆ لەو هێڵانەدا، و ئەوەی لە چ بەشێکی هەموو ڕۆژەکاندا بەهاکە یەکسان یان کەمتر لە ئەمڕۆ بووە.",
                        "ئەم خشتەیە دەنگ نادات و کۆتاییەکی «بکڕە» یان «بفرۆشە»ی نییە: زۆربەی ئەم پێوەرانە لە یەک نرخەوە دروست کراون و سەربەخۆ نین."]),
                    ("سنوورەکان", [
                        "هەر یەک لەم هێڵانە لە ڕابردوودا تەنها سێ یان چوار لووتکە و بنی نیشان داوە؛ ئەمە بۆ هیچ دەرئەنجامێکی ئاماری بەس نییە.",
                        "نرخەکان نرخی داخستنی ڕۆژن بە کاتی UTC. ئامۆژگاریی دارایی نییە.",
                        "سەرچاوە: نرخی ڕۆژانەی Coin Metrics (مۆڵەتی CC BY-NC) لە تەممووزی ٢٠١٠ـەوە."])],
            "ar": [("مقاييس هذه الصفحة", [
                "<b>مضاعف ماير:</b> السعر ÷ متوسط ٢٠٠ يوم. ظهر فوق ٢٫٤ عند القمم السابقة وتحت ٠٫٨ عند القيعان.",
                "<b>متوسط ٢٠٠ أسبوع:</b> متوسط ١٤٠٠ يوم للسعر؛ قلّما بقي السعر تحته في الدورات السابقة.",
                "<b>دورة باي:</b> متوسط ١١١ يومًا مقابل ضعف متوسط ٣٥٠ يومًا. عند قمم ٢٠١٣ و٢٠١٧ وأبريل ٢٠٢١ تجاوز الخط الأول الثاني.",
                "<b>مضاعف السنتين:</b> متوسط ٧٣٠ يومًا (أخضر) وخمسة أضعافه (أحمر).",
                "<b>النسبة الذهبية:</b> متوسط ٣٥٠ يومًا ومضاعفاته ١٫٦ و٣ و٥.",
                "<b>التراجع عن القمة:</b> بُعد السعر عن أعلى إغلاق حتى ذلك اليوم."]),
                   ("جدول «مقاييس الدورة»", [
                       "لكل مقياس: قيمة اليوم، الحدود المتعارفة، موضع اليوم منها، وفي أي حصة من كل الأيام كانت القيمة مساوية لقيمة اليوم أو أقل.",
                       "هذا الجدول لا يصوّت ولا يخلص إلى «اشترِ» أو «بِع»: معظم هذه المقاييس مبنيّ على سعر واحد وليست مستقلة."]),
                   ("الحدود", [
                       "كل خط من هذه لم يحدّد في الماضي سوى ثلاث قمم وقيعان أو أربع؛ وهذا لا يكفي لأي استنتاج إحصائي.",
                       "الأسعار إغلاق اليوم بتوقيت UTC. ليست نصيحة مالية.",
                       "المصدر: السعر اليومي من Coin Metrics (رخصة CC BY-NC) منذ يوليو ٢٠١٠."])],
            "en": [("The measures on this page", [
                "<b>Mayer multiple:</b> price ÷ the 200-day average. It was above 2.4 at past peaks and below 0.8 at bottoms.",
                "<b>200-week average:</b> the 1,400-day average of the price; in past cycles the price seldom stayed below it.",
                "<b>Pi cycle:</b> the 111-day average against twice the 350-day average. At the peaks of 2013, 2017 and April 2021 the first crossed above the second; their ratio is under the chart.",
                "<b>2-year multiplier:</b> the 730-day average (green) and five times it (red); the price under the green line or over the red one marked the two ends of past cycles.",
                "<b>Golden ratio:</b> the 350-day average and 1.6, 3 and 5 times it.",
                "<b>Drawdown:</b> how far the price is under its highest close so far."]),
                   ("The “cycle measures” table", [
                       "For every measure: today’s value, the conventional bands, where today is against them, and the share of all days whose value was at or below today’s. MVRV, MVRV Z-Score, NUPL and Puell from the Observatory’s other pages are in the same table.",
                       "The table does not vote and has no “buy” or “sell” verdict: most of these measures are built from the same price and are not independent."]),
                   ("Limits", [
                       "Each of these lines marked only three or four tops and bottoms in the past; that is too few for any statistical conclusion, and each cycle’s peak was lower against the averages than the one before.",
                       "Prices are the daily close in UTC, and the last point is the last closed day. Not financial advice.",
                       "Source: Coin Metrics’ daily price (CC BY-NC licence) since July 2010."])],
        },
    },
})


T.update({
    "liqhist": {
        "title": "لیکوییدیشن‌های واقعی بیت‌کوین، روز به روز | entekhab.net",
        "desc": "دلار لانگ‌ها و شورت‌های لیکوییدشدهٔ بیت‌کوین و صدها ارز، ساعت به ساعت و روز به روز تا ۱۱ ماه، از آمار عمومی Gate، با سفارش‌های ۲۴ ساعت اخیر OKX. رایگان.",
        "og": "لیکوییدیشن‌های واقعی، روز به روز",
        "ld": "Entekhab liquidations by day",
        "kw": ["لیکوییدیشن", "تاریخچه لیکوییدیشن", "liquidation history", "total liquidations", "liquidations chart", "لیکویید شدن", "rekt", "لیکویدکردن", "التصفيات", "coinglass", "کوین گلس"],
        "h1": {"fa": "لیکوییدیشن‌های واقعی، روز به روز", "ckb": "لیکویدە ڕاستەقینەکان، ڕۆژ بە ڕۆژ", "ar": "التصفيات الفعلية يومًا بيوم", "en": "Real liquidations, day by day"},
        "p": {"fa": "چند دلار پوزیشن لانگ و شورت واقعاً لیکویید شده است — ساعت به ساعت و روز به روز، از آمار عمومی Gate و سفارش‌های ۲۴ ساعت اخیر OKX",
              "ckb": "چەند دۆلار پۆزیشنی لۆنگ و شۆرت بە ڕاستی لیکوید کراوە — کاتژمێر بە کاتژمێر و ڕۆژ بە ڕۆژ، لە ئاماری گشتیی Gate و داواکارییەکانی ٢٤ کاتژمێری ڕابردووی OKX",
              "ar": "كم دولارًا من مراكز الشراء والبيع صُفّي فعلًا — ساعةً بساعة ويومًا بيوم، من إحصاءات Gate العامة وأوامر آخر ٢٤ ساعة في OKX",
              "en": "How many dollars of long and short positions were really liquidated — hour by hour and day by day, from Gate’s public statistics and OKX’s orders of the last 24 hours"},
        "about": {
            "fa": [("این صفحه چه نشان می‌دهد", [
                "<b>ستون‌های لیکوییدیشن:</b> در هر ستون، دلار پوزیشن‌هایی که صرافی به‌اجبار بسته است — شورت‌ها رو به بالا (سبز) و لانگ‌ها رو به پایین (قرمز)، زیر نمودار قیمت همان صرافی.",
                "<b>شش بازه:</b> ۲۴ ساعت و ۳ روز با ستون‌های ساعتی، ۱ هفته با ستون‌های ۴ ساعته، و ۱ ماه، ۳ ماه و ۱ سال با ستون‌های روزانه؛ برای هر ارزی که در Gate قرارداد دائمی تتری دارد.",
                "<b>کاشی‌ها:</b> جمع ۲۴ ساعت اخیر در Gate و در OKX، جمع کل بازه، سهم لانگ‌ها و بزرگ‌ترین روز.",
                "<b>اوپن اینترست:</b> خط پایین نمودار اوپن اینترست همان قرارداد در Gate است؛ با آن می‌بینید هر موج لیکوییدیشن چقدر از پوزیشن‌های باز را پاک کرده است.",
                "<b>سفارش‌های واقعی OKX:</b> جدول پایین صفحه بزرگ‌ترین سفارش‌های لیکوییدیشن ۲۴ ساعت گذشته را با زمان، سمت، قیمت و ارزش نشان می‌دهد."]),
                   ("چطور بخوانیم", [
                       "لانگ‌ها وقتی لیکویید می‌شوند که قیمت پایین می‌آید و شورت‌ها وقتی بالا می‌رود. یک ستون بلند یعنی اهرم زیادی یک‌جا پاک شده است؛ بعد از چنین روزهایی بازار اغلب سبک‌تر است، اما این قاعده نیست.",
                       "اندازه‌ها را نسبت به روزهای دیگرِ همین نمودار بخوانید، نه به‌عنوان رقم کل بازار.",
                       "این صفحه دادهٔ واقعی است؛ برآورد سطوحی که هنوز لیکویید نشده‌اند در «نقشهٔ حرارتی لیکوییدیشن» و «نقشهٔ لیکوییدیشن» است."]),
                   ("روش و محدودیت‌ها", [
                       "<b>فقط Gate و OKX:</b> Binance و Bybit لیکوییدیشن‌ها را فقط در همان لحظه منتشر می‌کنند و تاریخچه‌ای نمی‌دهند؛ پس این ارقام همهٔ بازار نیست و با سایت‌هایی که دادهٔ پولی دارند برابر نیست.",
                       "<b>ساعت‌های گم‌شده:</b> آمار Gate گاهی برای همهٔ قراردادها با هم قطع می‌شود. آن ساعت و ساعت پیش از آن ناقص می‌ماند؛ این ستون‌ها کم‌رنگ کشیده و شمرده می‌شوند و هیچ‌وقت با حدس پر نمی‌شوند.",
                       "<b>ستون‌های قدیمی‌تر:</b> ارقام ساعتی Gate حدود ۸۳ روز عقب می‌رود؛ روزهای پیش از آن از ارقام ۴ ساعتهٔ خود Gate ساخته می‌شوند (تا حدود ۱۱ ماه). ارقام روزانهٔ Gate به کار نمی‌رود، چون روزهای کاملی در آن خالی است.",
                       "<b>ارزش دلاری:</b> Gate مقدار کوینِ لیکوییدشده در هر دوره را می‌دهد و آن را با قیمت مارک پایان همان دوره به دلار تبدیل می‌کند؛ پس هر ستون به دلارِ لحظهٔ لیکوییدیشن نزدیک است، نه دقیقاً برابر آن، و ستون‌های ساخته‌شده از ارقام ۴ ساعته با ساعتی‌ها کسری از یک درصد فرق دارند.",
                       "<b>۲۴ ساعت:</b> ۲۳ ساعتِ بسته‌شده به‌اضافهٔ ساعت جاری. OKX فقط سفارش‌های ۲۴ ساعت اخیر را نگه می‌دارد و فهرستش در شلوغ‌ترین ثانیه‌ها بخشی از سفارش‌ها را نمی‌دهد؛ پس جمع OKX «دست‌کم» است.",
                       "زمان‌ها به وقت UTC است. توصیهٔ مالی نیست."]),
                   ("منابع", ["آمار عمومی قراردادهای Gate (لیکوییدیشن، اوپن اینترست، کندل) و سفارش‌های لیکوییدیشن عمومی OKX. همه مستقیم در مرورگر شما خوانده می‌شوند و چیزی از شما جایی فرستاده نمی‌شود."])],
            "ckb": [("ئەم پەڕەیە چی پیشان دەدات", [
                "<b>ستوونەکانی لیکویدکردن:</b> لە هەر ستوونێکدا، دۆلاری ئەو پۆزیشنانەی ئاڵوگۆڕگەکە بە ناچاری دایخستوون — شۆرتەکان بەرەو سەرەوە (سەوز) و لۆنگەکان بەرەو خوارەوە (سوور)، لە ژێر چارتی نرخی هەمان ئاڵوگۆڕگە.",
                "<b>شەش ماوە:</b> ٢٤ کاتژمێر و ٣ ڕۆژ بە ستوونی کاتژمێری، ١ هەفتە بە ستوونی ٤ کاتژمێری، و ١ مانگ، ٣ مانگ و ١ ساڵ بە ستوونی ڕۆژانە؛ بۆ هەر دراوێک کە لە Gate گرێبەستی هەمیشەیی تەتەری هەیە.",
                "<b>خانەکان:</b> کۆی ٢٤ کاتژمێری ڕابردوو لە Gate و لە OKX، کۆی هەموو ماوەکە، بەشی لۆنگەکان و گەورەترین ڕۆژ.",
                "<b>ئۆپن ئینتەرێست:</b> هێڵی خوارەوەی چارتەکە ئۆپن ئینتەرێستی هەمان گرێبەستە لە Gate؛ پێی دەبینیت هەر شەپۆلێکی لیکویدکردن چەندی لە پۆزیشنە کراوەکان سڕیوەتەوە.",
                "<b>داواکارییە ڕاستەقینەکانی OKX:</b> خشتەی خوارەوەی پەڕەکە گەورەترین داواکارییەکانی لیکویدکردنی ٢٤ کاتژمێری ڕابردوو بە کات، لایەن، نرخ و بەهاوە پیشان دەدات."]),
                    ("چۆن بیخوێنینەوە", [
                        "لۆنگەکان کاتێک لیکوید دەکرێن کە نرخ دادەبەزێت و شۆرتەکان کاتێک بەرز دەبێتەوە. ستوونێکی بەرز واتە لیڤەرێجێکی زۆر بە یەکجار سڕاوەتەوە؛ دوای ڕۆژی وا بازاڕ زۆرجار سووکترە، بەڵام ئەمە یاسا نییە.",
                        "قەبارەکان بە بەراورد لەگەڵ ڕۆژەکانی تری هەمان چارت بخوێنەرەوە، نەک وەک ژمارەی هەموو بازاڕ.",
                        "ئەم پەڕەیە داتای ڕاستەقینەیە؛ خەمڵاندنی ئەو ئاستانەی هێشتا لیکوید نەکراون لە «نەخشەی گەرمیی لیکویدکردن» و «نەخشەی لیکویدکردن»دایە."]),
                    ("ڕێگا و سنوورەکان", [
                        "<b>تەنها Gate و OKX:</b> Binance و Bybit لیکویدەکان تەنها لە هەمان ساتدا بڵاو دەکەنەوە و مێژوو نادەن؛ بۆیە ئەم ژمارانە هەموو بازاڕ نین و لەگەڵ ئەو ماڵپەڕانەی داتای پارەدارییان هەیە یەکسان نین.",
                        "<b>کاتژمێرە ونبووەکان:</b> ئاماری Gate جاروبار بۆ هەموو گرێبەستەکان پێکەوە دەپچڕێت. ئەو کاتژمێرە و کاتژمێری پێش ئەو ناتەواو دەمێننەوە؛ ئەم ستوونانە بە کاڵی دەکێشرێن و دەژمێردرێن و هەرگیز بە خەمڵاندن پڕ ناکرێنەوە.",
                        "<b>ستوونە کۆنترەکان:</b> ژمارە کاتژمێرییەکانی Gate نزیکەی ٨٣ ڕۆژ دەگەڕێنەوە دواوە؛ ڕۆژەکانی پێش ئەوە لە ژمارە ٤ کاتژمێرییەکانی خودی Gate دروست دەکرێن (تا نزیکەی ١١ مانگ). ژمارە ڕۆژانەکانی Gate بەکار ناهێنرێن، چونکە ڕۆژی تەواو تێیدا بەتاڵە.",
                       "<b>بەهای دۆلاری:</b> Gate بڕی کۆینی لیکویدکراو لە هەر ماوەیەکدا دەدات و بە نرخی مارکی کۆتایی هەمان ماوە دەیکاتە دۆلار؛ بۆیە هەر ستوونێک نزیکە لە دۆلاری ساتی لیکویدکردن، نەک ڕێک یەکسان، و ئەو ستوونانەی لە ژمارە ٤ کاتژمێرییەکان دروست دەکرێن بە کەمتر لە یەک لە سەد لە کاتژمێرییەکان جیاوازن.",
                        "<b>٢٤ کاتژمێر:</b> ٢٣ کاتژمێری داخراو لەگەڵ کاتژمێری ئێستا. OKX تەنها داواکارییەکانی ٢٤ کاتژمێری ڕابردوو هەڵدەگرێت و لیستەکەی لە قەرەباڵغترین چرکەکاندا بەشێک لە داواکارییەکان نادات؛ بۆیە کۆی OKX «لانی کەم»ـە.",
                        "کاتەکان بە UTCـن. ئامۆژگاریی دارایی نییە."]),
                    ("سەرچاوەکان", ["ئاماری گشتیی گرێبەستەکانی Gate و داواکارییە گشتییەکانی لیکویدکردنی OKX، ڕاستەوخۆ لە وێبگەڕەکەتدا دەخوێنرێنەوە."])],
            "ar": [("ماذا تُظهر هذه الصفحة", [
                "<b>أعمدة التصفية:</b> في كل عمود دولارات المراكز التي أغلقتها المنصة قسرًا — مراكز البيع إلى الأعلى (أخضر) ومراكز الشراء إلى الأسفل (أحمر)، تحت رسم سعر المنصة نفسها.",
                "<b>ستة مديات:</b> ٢٤ ساعة و٣ أيام بأعمدة ساعية، أسبوع بأعمدة كل ٤ ساعات، وشهر و٣ أشهر وسنة بأعمدة يومية؛ لكل عملة لها عقد دائم بالتيثر في Gate.",
                "<b>الخانات:</b> مجموع آخر ٢٤ ساعة في Gate وفي OKX، مجموع المدى كله، حصة مراكز الشراء وأكبر يوم.",
                "<b>العقود المفتوحة:</b> الخط السفلي هو العقود المفتوحة للعقد نفسه في Gate؛ به ترى كم محت كل موجة تصفية من المراكز المفتوحة.",
                "<b>أوامر OKX الحقيقية:</b> الجدول أسفل الصفحة يعرض أكبر أوامر التصفية في آخر ٢٤ ساعة مع الوقت والجهة والسعر والقيمة."]),
                   ("كيف تُقرأ", [
                       "تُصفّى مراكز الشراء حين يهبط السعر ومراكز البيع حين يصعد. العمود الطويل يعني أن رافعة كبيرة مُحيت دفعة واحدة؛ بعد أيام كهذه يكون السوق أخفّ غالبًا، لكنها ليست قاعدة.",
                       "اقرأ الأحجام قياسًا بالأيام الأخرى في الرسم نفسه، لا على أنها رقم السوق كلها.",
                       "هذه الصفحة بيانات فعلية؛ تقدير المستويات التي لم تُصفَّ بعد في «الخريطة الحرارية للتصفيات» و«خريطة التصفيات»."]),
                   ("المنهج والحدود", [
                       "<b>Gate وOKX فقط:</b> Binance وBybit تنشران التصفيات لحظة حدوثها فقط ولا تعطيان تاريخًا؛ فهذه الأرقام ليست السوق كلها ولا تطابق المواقع ذات البيانات المدفوعة.",
                       "<b>الساعات المفقودة:</b> تنقطع إحصاءات Gate أحيانًا لكل العقود معًا. تبقى تلك الساعة والساعة التي قبلها ناقصتين؛ تُرسم هذه الأعمدة باهتة وتُعدّ ولا تُملأ بالتخمين أبدًا.",
                       "<b>الأعمدة الأقدم:</b> أرقام Gate الساعية تعود نحو ٨٣ يومًا؛ والأيام قبلها تُبنى من أرقام Gate نفسها لكل ٤ ساعات (حتى نحو ١١ شهرًا). لا تُستعمل أرقام Gate اليومية لأن فيها أيامًا كاملة فارغة.",
                       "<b>القيمة بالدولار:</b> تعطي Gate كمية العملات المصفّاة في كل فترة وتقوّمها بسعر العلامة عند نهاية تلك الفترة؛ فكل عمود قريب من دولارات لحظة التصفية لا مطابق لها تمامًا، والأعمدة المبنية من أرقام ٤ ساعات تختلف عن الساعية بأقل من واحد في المئة.",
                       "<b>٢٤ ساعة:</b> ٢٣ ساعة مغلقة مع الساعة الجارية. وOKX تحتفظ بأوامر آخر ٢٤ ساعة فقط، وقائمتها لا تعيد كل الأوامر في أكثر الثواني ازدحامًا؛ فمجموع OKX حدّ أدنى.",
                       "الأوقات بتوقيت UTC. ليست نصيحة مالية."]),
                   ("المصادر", ["إحصاءات عقود Gate العامة وأوامر التصفية العامة في OKX، تُقرأ مباشرة في متصفحك."])],
            "en": [("What this page shows", [
                "<b>Liquidation bars:</b> in every bar, the dollars of positions the exchange force-closed — shorts upward (green), longs downward (red), under the same exchange’s price.",
                "<b>Six ranges:</b> 24 hours and 3 days in hourly bars, 1 week in 4-hour bars, and 1 month, 3 months and 1 year in daily bars; for any coin with a USDT perpetual on Gate.",
                "<b>Tiles:</b> the last 24 hours on Gate and on OKX, the total of the range, the longs’ share and the largest day.",
                "<b>Open interest:</b> the lower line is the same contract’s open interest on Gate; it shows how much of the open positions each wave of liquidations wiped out.",
                "<b>OKX’s real orders:</b> the table at the bottom lists the largest liquidation orders of the last 24 hours with their time, side, price and value."]),
                   ("How to read it", [
                       "Longs are liquidated when the price falls, shorts when it rises. A tall bar means a lot of leverage was cleared at once; the market is often lighter after such days, but that is not a rule.",
                       "Read sizes against the other days of the same chart, not as the figure of the whole market.",
                       "This page is real data; the estimate of levels that have not been liquidated yet is on the liquidation heatmap and the liquidation map."]),
                   ("Method and limits", [
                       "<b>Gate and OKX only:</b> Binance and Bybit publish liquidations only as they happen and give no history, so these figures are not the whole market and do not equal sites that buy their data.",
                       "<b>Missing hours:</b> Gate’s statistics stop now and then for every contract at once. That hour and the hour before it stay incomplete; such bars are drawn pale and counted, and never filled in by guessing.",
                       "<b>Older bars:</b> Gate’s hourly figures go back about 83 days; days before that are built from Gate’s own 4-hour figures (to about 11 months). Gate’s daily figures are not used, because whole days are empty in them.",
                       "<b>How dollars are counted:</b> Gate reports the coins liquidated in each period and values them at that period’s closing mark price; so a bar is close to, but not exactly, the dollars at the moment of each liquidation, and bars built from 4-hour figures differ from hourly ones by a fraction of one per cent.",
                       "<b>24 hours:</b> the 23 closed hours and the running one. OKX keeps only the last 24 hours of orders, and its list leaves some out in the busiest seconds, so OKX’s sum is a floor.",
                       "Times are UTC. Not financial advice."]),
                   ("Sources", ["Gate’s public contract statistics (liquidations, open interest, candles) and OKX’s public liquidation orders, read directly in your browser; nothing about you is sent anywhere."])],
        },
    },
    "cvd": {
        "title": "CVD بیت‌کوین: خرید تهاجمی اسپات و فیوچرز | entekhab.net",
        "desc": "CVD بیت‌کوین و صدها ارز: خالص تجمعی خرید و فروش تهاجمی در اسپات Binance در برابر فیوچرز، از ۲۴ ساعت تا ۱ سال، به تعداد کوین یا دلار، زیر نمودار قیمت. رایگان.",
        "og": "CVD — اسپات در برابر فیوچرز",
        "ld": "Entekhab CVD: spot against futures",
        "kw": ["CVD", "cumulative volume delta", "خرید تهاجمی", "taker buy", "دلتا حجم", "spot CVD", "futures CVD", "volume delta", "کڕینی هێرشبەرانە", "الشراء العدواني", "سی وی دی"],
        "h1": {"fa": "CVD: خالص خرید تهاجمی، اسپات در برابر فیوچرز", "ckb": "CVD: سافیی کڕینی هێرشبەرانە، سپۆت بەرامبەر فیوچەرز", "ar": "CVD: صافي الشراء العدواني، الفوري مقابل الآجل", "en": "CVD: net taker buying, spot against futures"},
        "p": {"fa": "خریداران تهاجمی جلوترند یا فروشندگان — جمع تجمعی خرید منهای فروش تیکرها در بازار اسپات و در فیوچرز، کنار هم و زیر نمودار قیمت",
              "ckb": "کڕیارە هێرشبەرەکان لە پێشن یان فرۆشیارەکان — کۆی کۆکراوەی کڕین کەم فرۆشتنی تەیکەرەکان لە بازاڕی سپۆت و لە فیوچەرز، لە تەنیشت یەک و لە ژێر چارتی نرخدا",
              "ar": "هل المشترون المبادرون في المقدمة أم البائعون — المجموع التراكمي لشراء المبادرين ناقص بيعهم في السوق الفوري وفي الآجل، جنبًا إلى جنب تحت رسم السعر",
              "en": "Whether aggressive buyers or sellers are ahead — the running total of takers’ buys minus their sells on the spot market and in futures, side by side under the price"},
        "about": {
            "fa": [("این صفحه چه نشان می‌دهد", [
                "<b>CVD اسپات:</b> در هر کندل، خرید تیکرها منهای فروششان در بازار اسپات Binance، که روی هم جمع می‌شود.",
                "<b>CVD فیوچرز:</b> همان حساب برای قرارداد دائمی؛ از Binance، و اگر از اتصال شما در دسترس نباشد از Gate — نام صرافی روی نمودار نوشته می‌شود.",
                "<b>شش بازه و دو واحد:</b> از ۲۴ ساعت (کندل ۵ دقیقه) تا ۱ سال (کندل روزانه)، به تعداد کوین یا به دلار.",
                "<b>کاشی‌ها:</b> خالص خرید تهاجمی اسپات و فیوچرز در کل بازه، و تغییر قیمت در همان بازه."]),
                   ("چطور بخوانیم", [
                       "تیکر کسی است که برای معاملهٔ فوری، قیمت طرف مقابل را می‌پذیرد؛ پس CVD می‌گوید کدام سمت عجله داشته است.",
                       "قیمت بالا می‌رود و CVD اسپات هم بالا می‌رود: خرید واقعی پشت حرکت است. قیمت بالا می‌رود ولی فقط CVD فیوچرز بالا می‌رود: حرکت بیشتر با اهرم ساخته شده و شکننده‌تر است.",
                       "واگرایی (قیمت سقف تازه می‌زند ولی CVD نه) یعنی خریداران تهاجمی کم شده‌اند؛ نشانه است، نه حکم."]),
                   ("روش و محدودیت‌ها", [
                       "<b>فرمول:</b> هر کندل Binance حجم کل و حجم خرید تیکرها را می‌دهد؛ دلتا = ۲ × خرید تیکر − حجم کل. Gate هر دو سمت را جدا می‌دهد.",
                       "<b>نقطهٔ صفر:</b> جمع از لبهٔ چپ نمودار از صفر شروع می‌شود؛ پس عدد آن به بازه بستگی دارد و فقط جهت و چرخش‌هایش معنا دارد.",
                       "<b>یک صرافی، نه کل بازار:</b> اسپات فقط Binance است و فیوچرز یک صرافی. سفارش‌های پنهان و معاملات خارج از صرافی دیده نمی‌شوند.",
                       "وقتی فیوچرز از Gate باشد، ارقام ساعتی‌اش حدود ۸۳ روز عقب می‌رود و هر دو خط از همان‌جا شروع می‌شوند. توصیهٔ مالی نیست."]),
                   ("منابع", ["کندل‌های عمومی Binance (اسپات و فیوچرز) و آمار عمومی قراردادهای Gate، مستقیم در مرورگر شما."])],
            "ckb": [("ئەم پەڕەیە چی پیشان دەدات", [
                "<b>CVDی سپۆت:</b> لە هەر مۆمێکدا، کڕینی تەیکەرەکان کەم فرۆشتنیان لە بازاڕی سپۆتی Binance، کە لەسەر یەک کۆ دەکرێتەوە.",
                "<b>CVDی فیوچەرز:</b> هەمان ژمێرکاری بۆ گرێبەستی هەمیشەیی؛ لە Binance، و ئەگەر لە پەیوەندییەکەتەوە بەردەست نەبێت لە Gate — ناوی ئاڵوگۆڕگەکە لەسەر چارتەکە دەنووسرێت.",
                "<b>شەش ماوە و دوو یەکە:</b> لە ٢٤ کاتژمێر (مۆمی ٥ خولەک) تا ١ ساڵ (مۆمی ڕۆژانە)، بە ژمارەی دراو یان بە دۆلار.",
                "<b>خانەکان:</b> سافیی کڕینی هێرشبەرانەی سپۆت و فیوچەرز لە هەموو ماوەکەدا، و گۆڕانی نرخ لە هەمان ماوەدا."]),
                    ("چۆن بیخوێنینەوە", [
                        "تەیکەر ئەو کەسەیە کە بۆ مامەڵەی دەستبەجێ نرخی لایەنی بەرامبەر قبووڵ دەکات؛ بۆیە CVD دەڵێت کام لا پەلەی بووە.",
                        "نرخ بەرز دەبێتەوە و CVDی سپۆتیش بەرز دەبێتەوە: کڕینی ڕاستەقینە لە پشت جووڵەکەوەیە. نرخ بەرز دەبێتەوە بەڵام تەنها CVDی فیوچەرز بەرز دەبێتەوە: جووڵەکە زیاتر بە لیڤەرێج دروست بووە و ناسکترە.",
                        "لێکترازان (نرخ لوتکەی نوێ دەدات بەڵام CVD نا) واتە کڕیارە هێرشبەرەکان کەم بوونەتەوە؛ نیشانەیە، نەک بڕیار."]),
                    ("ڕێگا و سنوورەکان", [
                        "<b>فۆرمول:</b> هەر مۆمێکی Binance قەبارەی گشتی و قەبارەی کڕینی تەیکەرەکان دەدات؛ دێڵتا = ٢ × کڕینی تەیکەر − قەبارەی گشتی. Gate هەردوو لا بە جیا دەدات.",
                        "<b>خاڵی سفر:</b> کۆکە لە لێواری چەپی چارتەکەوە لە سفرەوە دەست پێدەکات؛ بۆیە ژمارەکەی بە ماوەکەوە بەندە و تەنها ئاراستە و وەرچەرخانەکانی واتایان هەیە.",
                        "<b>یەک ئاڵوگۆڕگە، نەک هەموو بازاڕ:</b> سپۆت تەنها Binanceـە و فیوچەرز یەک ئاڵوگۆڕگە. داواکارییە شاراوەکان و مامەڵەکانی دەرەوەی ئاڵوگۆڕگە نابینرێن.",
                        "کاتێک فیوچەرز لە Gateـەوە بێت، ژمارە کاتژمێرییەکانی نزیکەی ٨٣ ڕۆژ دەگەڕێنەوە دواوە و هەردوو هێڵ لەوێوە دەست پێدەکەن. ئامۆژگاریی دارایی نییە."]),
                    ("سەرچاوەکان", ["مۆمە گشتییەکانی Binance (سپۆت و فیوچەرز) و ئاماری گشتیی گرێبەستەکانی Gate، ڕاستەوخۆ لە وێبگەڕەکەتدا."])],
            "ar": [("ماذا تُظهر هذه الصفحة", [
                "<b>CVD الفوري:</b> في كل شمعة، شراء المبادرين ناقص بيعهم في سوق Binance الفوري، مجموعًا بعضه على بعض.",
                "<b>CVD الآجل:</b> الحساب نفسه للعقد الدائم؛ من Binance، وإن لم تكن متاحة من اتصالك فمن Gate — واسم المنصة مكتوب على الرسم.",
                "<b>ستة مديات ووحدتان:</b> من ٢٤ ساعة (شمعة ٥ دقائق) إلى سنة (شمعة يومية)، بعدد العملات أو بالدولار.",
                "<b>الخانات:</b> صافي الشراء العدواني في الفوري والآجل عن المدى كله، وتغيّر السعر في المدى نفسه."]),
                   ("كيف تُقرأ", [
                       "المبادر هو من يقبل سعر الطرف الآخر لينفّذ فورًا؛ فـCVD يقول أي الجهتين كانت مستعجلة.",
                       "السعر يصعد وCVD الفوري يصعد: شراء حقيقي خلف الحركة. السعر يصعد وCVD الآجل وحده يصعد: الحركة مبنية على الرافعة أكثر وهي أهشّ.",
                       "التباعد (السعر يسجّل قمة جديدة وCVD لا) يعني أن المشترين المبادرين قلّوا؛ إشارة لا حكم."]),
                   ("المنهج والحدود", [
                       "<b>المعادلة:</b> كل شمعة في Binance تعطي الحجم الكلي وحجم شراء المبادرين؛ الدلتا = ٢ × شراء المبادرين − الحجم الكلي. وGate تعطي الجهتين منفصلتين.",
                       "<b>نقطة الصفر:</b> يبدأ المجموع من الصفر عند الحافة اليسرى؛ فرقمه يتبع المدى، والمعنى في اتجاهه وانعطافاته فقط.",
                       "<b>منصة واحدة لا السوق كلها:</b> الفوري من Binance وحدها والآجل من منصة واحدة. الأوامر المخفية والصفقات خارج المنصات لا تظهر.",
                       "حين يكون الآجل من Gate تعود أرقامه الساعية نحو ٨٣ يومًا ويبدأ الخطان من هناك. ليست نصيحة مالية."]),
                   ("المصادر", ["شموع Binance العامة (الفوري والآجل) وإحصاءات عقود Gate العامة، مباشرة في متصفحك."])],
            "en": [("What this page shows", [
                "<b>Spot CVD:</b> in every candle, the takers’ buys minus their sells on Binance’s spot market, added up.",
                "<b>Futures CVD:</b> the same for the perpetual; from Binance, or from Gate when Binance’s futures cannot be reached from your connection — the exchange is named on the chart.",
                "<b>Six ranges and two units:</b> 24 hours (5-minute candles) to 1 year (daily candles), in coins or in dollars.",
                "<b>Tiles:</b> net taker buying on spot and in futures over the whole range, and the price change over the same range."]),
                   ("How to read it", [
                       "A taker is whoever accepts the other side’s price to trade at once, so CVD says which side was in a hurry.",
                       "The price rises and spot CVD rises with it: real buying is behind the move. The price rises and only futures CVD rises: the move is built more on leverage and is more fragile.",
                       "A divergence (the price makes a new high and CVD does not) means aggressive buyers have thinned out; a hint, not a verdict."]),
                   ("Method and limits", [
                       "<b>Formula:</b> a Binance candle gives the whole volume and the takers’ buys; delta = 2 × taker buys − volume. Gate gives the two sides apart.",
                       "<b>The zero point:</b> the total starts at zero at the left edge, so its number depends on the range, and only its direction and its turns carry meaning.",
                       "<b>One exchange, not the whole market:</b> spot is Binance alone and futures one exchange. Hidden orders and trades away from exchanges are not seen.",
                       "When futures come from Gate, its hourly figures go back about 83 days and both lines start there. Not financial advice."]),
                   ("Sources", ["Binance’s public candles (spot and futures) and Gate’s public contract statistics, read directly in your browser."])],
        },
    },
    "basis": {
        "title": "پریمیوم Coinbase و بیسیس فیوچرز بیت‌کوین | entekhab.net",
        "desc": "پریمیوم Coinbase بیت‌کوین و اتریوم از ۲۰۱۷ با تعدیل تتر، شاخص پریمیوم قرارداد دائمی و منحنی فیوچرز Deribit با بیسیس سالانهٔ هر سررسید. رایگان و بدون ثبت‌نام.",
        "og": "پریمیوم Coinbase و بیسیس فیوچرز",
        "ld": "Entekhab Coinbase premium and futures basis",
        "kw": ["پریمیوم کوین‌بیس", "coinbase premium", "coinbase premium index", "بیسیس", "basis", "futures basis", "contango", "کانتانگو", "backwardation", "term structure", "علاوة كوينبيس", "پریمیۆمی کۆینبەیس", "cryptoquant", "کریپتوکوانت"],
        "h1": {"fa": "پریمیوم Coinbase و بیسیس فیوچرز", "ckb": "پریمیۆمی Coinbase و بەیسیسی فیوچەرز", "ar": "علاوة Coinbase وأساس العقود الآجلة", "en": "Coinbase premium and futures basis"},
        "p": {"fa": "قیمت در آمریکا بالاتر است یا در بقیهٔ دنیا، و فیوچرز چقدر از بازار نقدی فاصله دارد — پریمیوم Coinbase، پریمیوم قرارداد دائمی و منحنی سررسیدها",
              "ckb": "نرخ لە ئەمریکا بەرزترە یان لە شوێنەکانی تری جیهان، و فیوچەرز چەند لە بازاڕی سپۆت دوورە — پریمیۆمی Coinbase، پریمیۆمی گرێبەستی هەمیشەیی و چەماوەی بەسەرچوونەکان",
              "ar": "هل السعر أعلى في أمريكا أم في بقية العالم، وكم تبتعد العقود الآجلة عن السوق الفوري — علاوة Coinbase وعلاوة العقد الدائم ومنحنى الاستحقاقات",
              "en": "Whether the price is higher in America or elsewhere, and how far futures stand from spot — the Coinbase premium, the perpetual’s premium and the curve of expiries"},
        "about": {
            "fa": [("سه نما", [
                "<b>پریمیوم Coinbase:</b> فاصلهٔ قیمت بیت‌کوین و اتریوم در Coinbase (به دلار) از قیمت Binance (به تتر)، ساعت به ساعت برای ۹۰ روز و روز به روز از ۲۰۱۷؛ با خط «تعدیل تتر» و قیمت خود تتر در Coinbase.",
                "<b>پریمیوم قرارداد دائمی:</b> شاخص پریمیوم Bybit — فاصلهٔ دفتر سفارش قرارداد دائمی از شاخص اسپات — از ۲۴ ساعت تا ۱ سال، زیر نمودار قیمت.",
                "<b>منحنی فیوچرز:</b> قیمت همهٔ فیوچرزهای سررسیددار Deribit روی محور تاریخ سررسید، بیسیس هر کدام و معادل سالانه‌اش، با جدول کامل."]),
                   ("چطور بخوانیم", [
                       "<b>پریمیوم Coinbase مثبت</b> یعنی در Coinbase گران‌تر می‌خرند؛ آن را فشار خرید خریداران آمریکایی و نهادها می‌خوانند. منفیِ پایدار یعنی فروش از همان سمت.",
                       "<b>تعدیل تتر:</b> اگر تتر کمی زیر یک دلار باشد، قیمت تتری بالاتر دیده می‌شود و پریمیوم ساده منفی می‌شود بی‌آن‌که کسی در آمریکا فروخته باشد. خط آبی این اثر را برمی‌دارد.",
                       "<b>بیسیس:</b> فیوچرزِ بالاتر از شاخص (کانتانگو) حالت عادی بازار صعودی است و بیسیس سالانهٔ بالا یعنی تقاضای زیاد برای اهرم. فیوچرزِ پایین‌تر از شاخص (بکواردیشن) کم پیش می‌آید."]),
                   ("روش و محدودیت‌ها", [
                       "<b>پریمیوم Coinbase</b> = قیمت بسته‌شدن Coinbase ÷ قیمت بسته‌شدن Binance − ۱، روی کندل‌های بسته‌شدهٔ هم‌زمان؛ همان تعریفی که CryptoQuant به کار می‌برد. «تعدیل تتر»: قیمت Binance اول با قیمت تتر در Coinbase به دلار برگردانده می‌شود.",
                       "Coinbase از همهٔ کشورها پاسخ نمی‌دهد؛ برای همین این داده را خود سایت ساعتی یک بار می‌خواند و ذخیره می‌کند. آخرین ساعت روی صفحه نوشته شده است.",
                       "<b>بیسیس سالانه</b> = بیسیس × ۳۶۵ ÷ روزهای مانده، ساده و بدون مرکب؛ برای سررسید نزدیک‌تر از دو روز حساب نمی‌شود، چون چند دلار فاصله عدد سالانهٔ بزرگی می‌سازد.",
                       "منحنی فقط Deribit است و فیوچرزهای CME را ندارد؛ شاخص پریمیوم فقط Bybit است. توصیهٔ مالی نیست."]),
                   ("منابع", ["کندل‌های عمومی Coinbase و Binance (خوانده‌شده توسط سایت)، شاخص پریمیوم عمومی Bybit و فیوچرزهای عمومی Deribit (خوانده‌شده در مرورگر شما)."])],
            "ckb": [("سێ دیمەن", [
                "<b>پریمیۆمی Coinbase:</b> جیاوازیی نرخی بیتکۆین و ئیسیریۆم لە Coinbase (بە دۆلار) لەگەڵ نرخی Binance (بە تەتەر)، کاتژمێر بە کاتژمێر بۆ ٩٠ ڕۆژ و ڕۆژ بە ڕۆژ لە ٢٠١٧ـەوە؛ لەگەڵ هێڵی «ڕێکخستنی تەتەر» و نرخی خودی تەتەر لە Coinbase.",
                "<b>پریمیۆمی گرێبەستی هەمیشەیی:</b> پێوەری پریمیۆمی Bybit — دووریی دەفتەری داواکاریی گرێبەستی هەمیشەیی لە ئیندێکسی سپۆت — لە ٢٤ کاتژمێر تا ١ ساڵ، لە ژێر چارتی نرخدا.",
                "<b>چەماوەی فیوچەرز:</b> نرخی هەموو فیوچەرزە بەسەرچوودارەکانی Deribit لەسەر تەوەری بەرواری بەسەرچوون، بەیسیسی هەر یەکێک و هاوتای ساڵانەکەی، لەگەڵ خشتەی تەواو."]),
                    ("چۆن بیخوێنینەوە", [
                        "<b>پریمیۆمی ئەرێنیی Coinbase</b> واتە لە Coinbase گرانتر دەکڕن؛ بە فشاری کڕینی کڕیارە ئەمریکییەکان و دامەزراوەکان دەخوێنرێتەوە. نەرێنیی بەردەوام واتە فرۆشتن لە هەمان لاوە.",
                        "<b>ڕێکخستنی تەتەر:</b> ئەگەر تەتەر کەمێک لە خوار یەک دۆلارەوە بێت، نرخی تەتەری بەرزتر دەبینرێت و پریمیۆمی سادە نەرێنی دەبێت بێ ئەوەی کەس لە ئەمریکا فرۆشتبێتی. هێڵی شین ئەم کاریگەرییە لادەبات.",
                        "<b>بەیسیس:</b> فیوچەرزی سەرووی ئیندێکس (کۆنتانگۆ) دۆخی ئاسایی بازاڕی بەرزبووەوەیە و بەیسیسی ساڵانەی بەرز واتە داواکاریی زۆر بۆ لیڤەرێج. فیوچەرزی خوار ئیندێکس (باکواردەیشن) کەم ڕوودەدات."]),
                    ("ڕێگا و سنوورەکان", [
                        "<b>پریمیۆمی Coinbase</b> = نرخی داخستنی Coinbase ÷ نرخی داخستنی Binance − ١، لەسەر مۆمە داخراوە هاوکاتەکان؛ هەمان پێناسەی CryptoQuant. «ڕێکخستنی تەتەر»: نرخی Binance سەرەتا بە نرخی تەتەر لە Coinbase دەکرێتە دۆلار.",
                        "Coinbase لە هەموو وڵاتێکەوە وەڵام ناداتەوە؛ بۆیە ئەم داتایە خودی ماڵپەڕەکە کاتژمێری جارێک دەیخوێنێتەوە و هەڵیدەگرێت. دوایین کاتژمێر لەسەر پەڕەکە نووسراوە.",
                        "<b>بەیسیسی ساڵانە</b> = بەیسیس × ٣٦٥ ÷ ڕۆژە ماوەکان، سادە و بێ لێکدراو؛ بۆ بەسەرچوونی نزیکتر لە دوو ڕۆژ ناژمێردرێت، چونکە چەند دۆلارێک جیاوازی ژمارەیەکی ساڵانەی گەورە دروست دەکات.",
                        "چەماوەکە تەنها Deribitـە و فیوچەرزەکانی CMEی تێدا نییە؛ پێوەری پریمیۆم تەنها Bybitـە. ئامۆژگاریی دارایی نییە."]),
                    ("سەرچاوەکان", ["مۆمە گشتییەکانی Coinbase و Binance (ماڵپەڕەکە دەیانخوێنێتەوە)، پێوەری پریمیۆمی گشتیی Bybit و فیوچەرزە گشتییەکانی Deribit (لە وێبگەڕەکەتدا دەخوێنرێنەوە)."])],
            "ar": [("ثلاثة عروض", [
                "<b>علاوة Coinbase:</b> فارق سعر البيتكوين والإيثر في Coinbase (بالدولار) عن سعر Binance (بالتيثر)، ساعةً بساعة لـ٩٠ يومًا ويومًا بيوم منذ ٢٠١٧؛ مع خط «تعديل التيثر» وسعر التيثر نفسه في Coinbase.",
                "<b>علاوة العقد الدائم:</b> مؤشر العلاوة في Bybit — بُعد دفتر أوامر العقد الدائم عن مؤشر السعر الفوري — من ٢٤ ساعة إلى سنة، تحت رسم السعر.",
                "<b>منحنى العقود الآجلة:</b> سعر كل عقد آجل ذي استحقاق في Deribit على محور تاريخ الاستحقاق، وأساس كلٍّ منها ومعادله السنوي، مع جدول كامل."]),
                   ("كيف تُقرأ", [
                       "<b>علاوة Coinbase الموجبة</b> تعني أنهم يشترون بأغلى في Coinbase؛ تُقرأ ضغطَ شراء من المشترين الأمريكيين والمؤسسات. والسالبة المستمرة تعني بيعًا من الجهة نفسها.",
                       "<b>تعديل التيثر:</b> إذا كان التيثر دون الدولار قليلًا بدا السعر بالتيثر أعلى فصارت العلاوة البسيطة سالبة دون أن يبيع أحد في أمريكا. الخط الأزرق يزيل هذا الأثر.",
                       "<b>الأساس:</b> العقد الآجل فوق المؤشر (كونتانغو) هو الحال المعتاد في سوق صاعدة، والأساس السنوي المرتفع يعني طلبًا كبيرًا على الرافعة. والعقد تحت المؤشر (باكوارديشن) نادر."]),
                   ("المنهج والحدود", [
                       "<b>علاوة Coinbase</b> = سعر إغلاق Coinbase ÷ سعر إغلاق Binance − ١، على الشموع المغلقة المتزامنة؛ وهو تعريف CryptoQuant نفسه. «تعديل التيثر»: يُحوَّل سعر Binance أولًا إلى دولار بسعر التيثر في Coinbase.",
                       "لا تستجيب Coinbase من كل البلدان؛ لذلك يقرأ الموقع هذه البيانات مرة كل ساعة ويحفظها. وآخر ساعة مكتوبة على الصفحة.",
                       "<b>الأساس السنوي</b> = الأساس × ٣٦٥ ÷ الأيام الباقية، بسيط غير مركّب؛ ولا يُحسب لاستحقاق أقرب من يومين، لأن فارق بضعة دولارات يصنع رقمًا سنويًّا كبيرًا.",
                       "المنحنى من Deribit فقط ولا يشمل عقود CME؛ ومؤشر العلاوة من Bybit فقط. ليست نصيحة مالية."]),
                   ("المصادر", ["شموع Coinbase وBinance العامة (يقرؤها الموقع)، ومؤشر علاوة Bybit العام وعقود Deribit الآجلة العامة (تُقرأ في متصفحك)."])],
            "en": [("Three views", [
                "<b>Coinbase premium:</b> how far the price of Bitcoin and Ether on Coinbase (in dollars) stands from Binance’s (in Tether), hour by hour for 90 days and day by day since 2017; with the “Tether-adjusted” line and Tether’s own price on Coinbase.",
                "<b>Perpetual premium:</b> Bybit’s premium index — how far the perpetual’s order book stands from the spot index — from 24 hours to a year, under the price.",
                "<b>Futures curve:</b> the price of every dated future on Deribit along its expiry date, each one’s basis and its yearly equivalent, with the full table."]),
                   ("How to read it", [
                       "<b>A positive Coinbase premium</b> means buyers pay more on Coinbase; it is read as buying pressure from American buyers and institutions. A lasting negative one means selling from the same side.",
                       "<b>Tether-adjusted:</b> when Tether is a little under a dollar, the price in Tether looks higher and the plain premium turns negative without anyone in America selling. The blue line removes that effect.",
                       "<b>Basis:</b> a future above the index (contango) is the normal state of a rising market, and a high yearly basis means strong demand for leverage. A future below the index (backwardation) is rare."]),
                   ("Method and limits", [
                       "<b>Coinbase premium</b> = Coinbase’s close ÷ Binance’s close − 1, on closed candles of the same time; the definition CryptoQuant uses. “Tether-adjusted”: Binance’s price is first turned into dollars with Tether’s price on Coinbase.",
                       "Coinbase does not answer from every country, so the site itself reads this data once an hour and keeps it. The last hour is written on the page.",
                       "<b>Basis per year</b> = basis × 365 ÷ days left, simple and not compounded; not worked out for an expiry nearer than two days, because a gap of a few dollars would make a large yearly figure.",
                       "The curve is Deribit only and has no CME futures; the premium index is Bybit only. Not financial advice."]),
                   ("Sources", ["Public candles of Coinbase and Binance (read by the site), Bybit’s public premium index and Deribit’s public futures (read in your browser)."])],
        },
    },
    "stables": {
        "title": "عرضه استیبل‌کوین‌ها و نسبت SSR بیت‌کوین | entekhab.net",
        "desc": "عرضهٔ کل استیبل‌کوین‌های دلاری از ۲۰۱۷، تغییر ۳۰ روزه، سهم تتر و USDC، و نسبت SSR (ارزش بازار بیت‌کوین به استیبل‌کوین‌ها) با جایگاه امروز در تاریخ. رایگان.",
        "og": "استیبل‌کوین‌ها و SSR",
        "ld": "Entekhab stablecoin supply and SSR",
        "kw": ["استیبل کوین", "stablecoin supply", "SSR", "stablecoin supply ratio", "عرضه تتر", "USDT", "USDC", "تتر", "ستەیبڵکۆین", "العملات المستقرة", "cryptoquant", "glassnode", "گلس نود"],
        "h1": {"fa": "استیبل‌کوین‌ها و نسبت SSR", "ckb": "ستەیبڵکۆینەکان و ڕێژەی SSR", "ar": "العملات المستقرة ونسبة SSR", "en": "Stablecoins and the SSR"},
        "p": {"fa": "چقدر دلار آماده داخل بازار کریپتو هست و بیت‌کوین در برابر آن کجاست — عرضهٔ استیبل‌کوین‌ها، تغییرش و نسبت SSR",
              "ckb": "چەند دۆلاری ئامادە لەناو بازاڕی کریپتۆدایە و بیتکۆین بەرامبەر بەوە لە کوێدایە — خستنەڕووی ستەیبڵکۆینەکان، گۆڕانەکەی و ڕێژەی SSR",
              "ar": "كم دولارًا جاهزًا داخل سوق العملات المشفرة وأين البيتكوين منه — معروض العملات المستقرة وتغيّره ونسبة SSR",
              "en": "How many ready dollars sit inside the crypto market, and where Bitcoin stands against them — the supply of stablecoins, its change, and the SSR"},
        "about": {
            "fa": [("این صفحه چه نشان می‌دهد", [
                "<b>عرضه:</b> ارزش دلاری همهٔ استیبل‌کوین‌های دلاریِ در گردش، روز به روز از ۲۰۱۷، زیر ارزش بازار بیت‌کوین.",
                "<b>SSR:</b> ارزش بازار بیت‌کوین تقسیم بر عرضهٔ استیبل‌کوین‌ها، و اینکه چند درصد روزهای تاریخ در همین سطح یا پایین‌تر بوده‌اند.",
                "<b>تغییر ۳۰ روزه:</b> عرضه در هر روز منهای عرضهٔ ۳۰ روز پیش؛ ستون سبز یعنی دلار تازه ساخته شده و ستون قرمز یعنی بازخرید شده است.",
                "<b>به تفکیک کوین:</b> تتر، USDC و بقیه، و سهم تتر از کل.",
                "<b>جدول:</b> شناخته‌شده‌ترین استیبل‌کوین‌ها با مقدار در گردش و تغییر یک‌روزه، هفتگی و ماهانه."]),
                   ("چطور بخوانیم", [
                       "استیبل‌کوین پولی است که از پیش وارد بازار شده و منتظر خرید است. عرضهٔ رو به رشد معمولاً با بازار صعودی همراه بوده و کاهشِ پیوسته با خروج پول.",
                       "SSR پایین یعنی نسبت به ارزش بیت‌کوین، دلار آمادهٔ زیادی هست؛ SSR بالا یعنی بیت‌کوین نسبت به آن دلارها گران‌تر است. هیچ‌کدام زمان‌بندی نمی‌دهد.",
                       "بخش بزرگی از استیبل‌کوین‌ها در دیفای، پرداخت و نگه‌داری دلار به کار می‌رود و هرگز خرج خرید بیت‌کوین نمی‌شود."]),
                   ("روش و محدودیت‌ها", [
                       "عرضه: مجموع استیبل‌کوین‌های وابسته به دلار در فهرست DefiLlama، به ارزش بازارشان. استیبل‌کوین‌های یورو و ارزهای دیگر شمرده نمی‌شوند.",
                       "هر ردیف DefiLlama نیمه‌شب UTC برداشته می‌شود؛ پس رقم هر روز، عرضه در پایان همان روز است و آخرین روز نمودار دیروز است.",
                       "SSR هر روز: ارزش بازار بیت‌کوین در پایان روز (قیمت × عرضه، از Coin Metrics) تقسیم بر عرضهٔ استیبل‌کوین‌ها در پایان همان روز. فهرست استیبل‌کوین‌ها با فهرست سایت‌های دیگر یکی نیست، پس عدد SSR هم با آن‌ها برابر نیست.",
                       "جدول از فهرست لحظه‌ای DefiLlama است و فقط کوین‌های شناخته‌شده را نام می‌برد. توصیهٔ مالی نیست."]),
                   ("منابع", ["DefiLlama (استیبل‌کوین‌ها) و دادهٔ همگانی Coin Metrics (ارزش بازار بیت‌کوین، مجوز CC BY-NC)، روزی یک مقدار به وقت UTC."])],
            "ckb": [("ئەم پەڕەیە چی پیشان دەدات", [
                "<b>خستنەڕوو:</b> بەهای دۆلاریی هەموو ستەیبڵکۆینە دۆلارییەکانی ناو سووڕان، ڕۆژ بە ڕۆژ لە ٢٠١٧ـەوە، لە ژێر بەهای بازاڕی بیتکۆیندا.",
                "<b>SSR:</b> بەهای بازاڕی بیتکۆین دابەش بەسەر خستنەڕووی ستەیبڵکۆینەکاندا، و ئەوەی چەند لەسەدی ڕۆژەکانی مێژوو لەم ئاستەدا یان خوارتر بوون.",
                "<b>گۆڕانی ٣٠ ڕۆژە:</b> خستنەڕووی هەر ڕۆژێک کەم خستنەڕووی ٣٠ ڕۆژ پێشتر؛ ستوونی سەوز واتە دۆلاری نوێ دروست کراوە و ستوونی سوور واتە کڕاوەتەوە.",
                "<b>بەپێی دراو:</b> تەتەر، USDC و ئەوانی تر، و بەشی تەتەر لە کۆ.",
                "<b>خشتە:</b> ناسراوترین ستەیبڵکۆینەکان بە بڕی ناو سووڕان و گۆڕانی ڕۆژانە، هەفتانە و مانگانە."]),
                    ("چۆن بیخوێنینەوە", [
                        "ستەیبڵکۆین پارەیەکە کە پێشتر هاتووەتە ناو بازاڕ و چاوەڕێی کڕینە. خستنەڕووی ڕوو لە زیادبوون زۆرجار لەگەڵ بازاڕی بەرزبووەوە بووە و کەمبوونەوەی بەردەوام لەگەڵ ڕۆیشتنی پارە.",
                        "SSRـی نزم واتە بە بەراورد لەگەڵ بەهای بیتکۆین دۆلاری ئامادەی زۆر هەیە؛ SSRـی بەرز واتە بیتکۆین بە بەراورد لەگەڵ ئەو دۆلارانە گرانترە. هیچیان کات دیاری ناکات.",
                        "بەشێکی گەورەی ستەیبڵکۆینەکان لە دیفای، پارەدان و هەڵگرتنی دۆلاردا بەکار دێت و هەرگیز بۆ کڕینی بیتکۆین خەرج ناکرێت."]),
                    ("ڕێگا و سنوورەکان", [
                        "خستنەڕوو: کۆی ئەو ستەیبڵکۆینانەی بە دۆلارەوە بەستراون لە لیستی DefiLlama، بە بەهای بازاڕیان. ستەیبڵکۆینەکانی یۆرۆ و دراوەکانی تر ناژمێردرێن.",
                        "هەر ڕیزێکی DefiLlama لە نیوەشەوی UTC وەردەگیرێت؛ بۆیە ژمارەی هەر ڕۆژێک خستنەڕووە لە کۆتایی هەمان ڕۆژدا و دوایین ڕۆژی چارتەکە دوێنێیە.",
                        "SSRـی هەر ڕۆژێک: بەهای بازاڕی بیتکۆین لە کۆتایی ڕۆژدا (نرخ × خستنەڕوو، لە Coin Metrics) دابەش بەسەر خستنەڕووی ستەیبڵکۆینەکان لە کۆتایی هەمان ڕۆژدا. لیستی ستەیبڵکۆینەکان لەگەڵ لیستی ماڵپەڕەکانی تر یەک نییە، بۆیە ژمارەی SSRـیش لەگەڵیان یەکسان نییە.",
                        "خشتەکە لە لیستی ئێستای DefiLlamaـیە و تەنها دراوە ناسراوەکان ناو دەبات. ئامۆژگاریی دارایی نییە."]),
                    ("سەرچاوەکان", ["DefiLlama (ستەیبڵکۆینەکان) و داتای گشتیی Coin Metrics (بەهای بازاڕی بیتکۆین، مۆڵەتی CC BY-NC)، ڕۆژی یەک بەها بە کاتی UTC."])],
            "ar": [("ماذا تُظهر هذه الصفحة", [
                "<b>المعروض:</b> القيمة بالدولار لكل العملات المستقرة الدولارية المتداولة، يومًا بيوم منذ ٢٠١٧، تحت القيمة السوقية للبيتكوين.",
                "<b>SSR:</b> القيمة السوقية للبيتكوين مقسومة على معروض العملات المستقرة، وكم بالمئة من أيام التاريخ كانت عند هذا المستوى أو دونه.",
                "<b>تغيّر ٣٠ يومًا:</b> معروض كل يوم ناقص معروض ما قبل ٣٠ يومًا؛ العمود الأخضر دولارات جديدة أُصدرت والأحمر دولارات استُردّت.",
                "<b>حسب العملة:</b> التيثر وUSDC والبقية، وحصة التيثر من المجموع.",
                "<b>الجدول:</b> أشهر العملات المستقرة مع المتداول منها وتغيّره في يوم وأسبوع وشهر."]),
                   ("كيف تُقرأ", [
                       "العملة المستقرة مال دخل السوق من قبل وينتظر الشراء. المعروض المتزايد رافق الأسواق الصاعدة غالبًا، والانكماش المتواصل رافق خروج المال.",
                       "SSR منخفض يعني دولارات جاهزة كثيرة قياسًا بقيمة البيتكوين؛ والمرتفع يعني أن البيتكوين أغلى قياسًا بتلك الدولارات. لا يحدد أيٌّ منهما توقيتًا.",
                       "جزء كبير من العملات المستقرة يُستعمل في التمويل اللامركزي والمدفوعات وحفظ الدولار، ولا يُنفق أبدًا على شراء البيتكوين."]),
                   ("المنهج والحدود", [
                       "المعروض: مجموع العملات المستقرة المربوطة بالدولار في قائمة DefiLlama بقيمتها السوقية. لا تُحسب عملات اليورو والعملات الأخرى.",
                       "كل صف في DefiLlama يؤخذ عند منتصف الليل بتوقيت UTC؛ فرقم كل يوم هو المعروض في نهاية ذلك اليوم، وآخر يوم في الرسم هو أمس.",
                       "SSR كل يوم: القيمة السوقية للبيتكوين في نهاية اليوم (السعر × المعروض، من Coin Metrics) مقسومة على معروض العملات المستقرة في نهاية اليوم نفسه. قائمة العملات المستقرة تختلف عن قوائم المواقع الأخرى، فرقم SSR لا يطابقها.",
                       "الجدول من قائمة DefiLlama الحالية ويسمّي العملات المعروفة فقط. ليست نصيحة مالية."]),
                   ("المصادر", ["DefiLlama (العملات المستقرة) وبيانات Coin Metrics المجتمعية (القيمة السوقية للبيتكوين، رخصة CC BY-NC)، قيمة في اليوم بتوقيت UTC."])],
            "en": [("What this page shows", [
                "<b>Supply:</b> the dollar value of every dollar stablecoin in circulation, day by day since 2017, under Bitcoin’s market value.",
                "<b>SSR:</b> Bitcoin’s market value divided by the supply of stablecoins, and what share of all days stood at or below today’s level.",
                "<b>30-day change:</b> each day’s supply minus the supply 30 days before; a green bar is new dollars issued, a red one dollars redeemed.",
                "<b>By coin:</b> Tether, USDC and all the others, and Tether’s share of the total.",
                "<b>The table:</b> the best-known stablecoins with what is in circulation and its change in a day, a week and a month."]),
                   ("How to read it", [
                       "A stablecoin is money that has already entered the market and waits to buy. A growing supply has usually come with rising markets, a steady fall with money leaving.",
                       "A low SSR means many ready dollars against Bitcoin’s value; a high one means Bitcoin is dearer against those dollars. Neither gives timing.",
                       "A large part of stablecoins is used in DeFi, payments and simply holding dollars, and is never spent on Bitcoin."]),
                   ("Method and limits", [
                       "Supply: the sum of the dollar-pegged stablecoins in DefiLlama’s list, at their market value. Euro and other-currency stablecoins are not counted.",
                       "Each of DefiLlama’s rows is taken at midnight UTC, so a day’s figure is the supply at the end of that day and the last day of the chart is yesterday.",
                       "Each day’s SSR: Bitcoin’s market value at the end of the day (price × supply, from Coin Metrics) over the stablecoins at the end of the same day. The list of stablecoins differs from other sites’ lists, so the SSR number does not equal theirs.",
                       "The table is DefiLlama’s list as it stands now and names only the well-known coins. Not financial advice."]),
                   ("Sources", ["DefiLlama (stablecoins) and Coin Metrics community data (Bitcoin’s market value, CC BY-NC licence), one value a day, UTC."])],
        },
    },
})


# ---------------------------------------------------------------- stage 5: the Hyperliquid page, and what the other pages gained
T.update({
    "hl": {
        "title": "نقشه لیکوییدیشن واقعی Hyperliquid | entekhab.net",
        "desc": "قیمت لیکوییدیشن پوزیشن‌های واقعی Hyperliquid برای بیت‌کوین، اتریوم و ارزهای بزرگ: چند دلار با ۵٪ یا ۱۰٪ حرکت لیکویید می‌شود. داده، نه مدل. رایگان.",
        "og": "لیکوییدیشن واقعی Hyperliquid",
        "ld": "Entekhab Hyperliquid liquidation levels",
        "kw": ["hyperliquid liquidation map", "نقشه لیکوییدیشن هایپرلیکوئید", "hyperliquid", "هایپرلیکوئید", "liquidation levels", "سطوح لیکوییدیشن",
               "لیکویدکردن", "التصفيات", "coinglass", "hyperdash"],
        "h1": {"fa": "نقشهٔ لیکوییدیشن واقعی Hyperliquid", "ckb": "نەخشەی لیکویدکردنی ڕاستەقینەی Hyperliquid", "ar": "خريطة التصفيات الفعلية في Hyperliquid", "en": "Hyperliquid: real liquidation levels"},
        "p": {"fa": "پوزیشن‌های باز واقعی Hyperliquid در چه قیمتی لیکویید می‌شوند — از خود حساب‌ها، نه از مدل",
              "ckb": "پۆزیشنە کراوە ڕاستەقینەکانی Hyperliquid لە چ نرخێکدا لیکوید دەبن — لە خودی هەژمارەکانەوە، نەک لە مۆدێلەوە",
              "ar": "عند أي سعر تُصفّى المراكز المفتوحة الحقيقية في Hyperliquid — من الحسابات نفسها، لا من نموذج",
              "en": "At what prices the real open positions on Hyperliquid would be liquidated — from the accounts themselves, not from a model"},
        "about": {
            "fa": [("این صفحه چه نشان می‌دهد", [
                       "<b>ستون‌ها:</b> دلار پوزیشن‌هایی که در هر بازهٔ قیمت لیکویید می‌شوند — لانگ‌ها قرمز (زیر قیمت)، شورت‌ها سبز (بالای قیمت).",
                       "<b>کاشی‌ها:</b> چند دلار لانگ با ۵٪ (و ۱۰٪) ریزش و چند دلار شورت با ۵٪ (و ۱۰٪) رشد لیکویید می‌شود، چه سهمی از اوپن اینترست خوانده شده و چند حساب.",
                       "<b>جدول:</b> بزرگ‌ترین پوزیشن‌های خوانده‌شده با قیمت ورود، قیمت لیکوییدیشن، فاصله و اهرم — بی‌نشانی حساب."]),
                   ("چطور بخوانیم", [
                       "ستون بلند نزدیک قیمت یعنی حرکتی کوچک می‌تواند لیکوییدیشن زنجیره‌ای راه بیندازد؛ این جای قیمت را پیش‌بینی نمی‌کند.",
                       "نقشه‌های لیکوییدیشن دیگر (همین سایت و سایت‌های دیگر) مدل‌اند؛ این یکی پوزیشن واقعی است، ولی فقط از Hyperliquid و فقط از حساب‌های خوانده‌شده."]),
                   ("روش و محدودیت‌ها", [
                       "Hyperliquid پوزیشن‌های هر حساب را با قیمت لیکوییدیشنش منتشر می‌کند ولی فهرست همهٔ پوزیشن‌ها را نه؛ سایت تقریباً هر ساعت هر تعداد حساب را که در چند دقیقه جا شود می‌خواند — به نوبت بزرگ‌ترین‌ها و پرمعامله‌ترین‌ها از فهرست خود Hyperliquid.",
                       "پس ستون‌ها بخشی از بازارند؛ کاشی «خوانده‌شده» می‌گوید این حساب‌ها چه سهمی از لانگ‌ها و شورت‌های باز Hyperliquid را دارند. چیزی برای حساب‌های خوانده‌نشده اضافه نمی‌شود.",
                       "قیمت لیکوییدیشن پوزیشن کراس با سود و زیان پوزیشن‌های دیگر همان حساب جابه‌جا می‌شود؛ پوزیشن بدون قیمت لیکوییدیشن (مارجین کافی) روی نمودار نیست و شمرده می‌شود. توصیهٔ مالی نیست."]),
                   ("منابع", ["API عمومی Hyperliquid (وضعیت هر حساب، بازار و فهرست حساب‌ها)، با CI سایت خوانده می‌شود؛ چیزی از شما جایی فرستاده نمی‌شود."])],
            "ckb": [("ئەم پەڕەیە چی پیشان دەدات", [
                        "<b>ستوونەکان:</b> دۆلاری ئەو پۆزیشنانەی لە هەر ماوەیەکی نرخدا لیکوید دەبن — لۆنگەکان سوور (خوار نرخ)، شۆرتەکان سەوز (سەرووی نرخ).",
                        "<b>خانەکان:</b> چەند دۆلار لۆنگ بە ٥٪ (و ١٠٪) دابەزین و چەند دۆلار شۆرت بە ٥٪ (و ١٠٪) بەرزبوونەوە لیکوید دەبێت، چ بەشێکی ئۆپن ئینتەرێست خوێنراوە و چەند هەژمار.",
                        "<b>خشتە:</b> گەورەترین پۆزیشنە خوێنراوەکان بە نرخی چوونەژوورەوە، نرخی لیکویدکردن، دووری و لیڤەرێج — بێ ناونیشانی هەژمار."]),
                    ("چۆن بیخوێنینەوە", [
                        "ستوونێکی بەرز نزیک نرخ واتە جووڵەیەکی بچووک دەتوانێت لیکویدکردنی زنجیرەیی دەست پێ بکات؛ ئەمە شوێنی نرخ پێشبینی ناکات.",
                        "نەخشەکانی تری لیکویدکردن (ئەم ماڵپەڕە و ماڵپەڕەکانی تر) مۆدێلن؛ ئەمە پۆزیشنی ڕاستەقینەیە، بەڵام تەنها لە Hyperliquid و تەنها لە هەژمارە خوێنراوەکان."]),
                    ("ڕێگا و سنوورەکان", [
                        "Hyperliquid پۆزیشنەکانی هەر هەژمارێک لەگەڵ نرخی لیکویدکردنیان بڵاو دەکاتەوە بەڵام لیستی هەموو پۆزیشنەکان نا؛ ماڵپەڕەکە نزیکەی هەموو کاتژمێرێک هەر ئەوەندە هەژمار دەخوێنێتەوە کە لە چەند خولەکێکدا جێ دەبێتەوە — بە نۆرە گەورەترین و چالاکترینەکان لە لیستی خودی Hyperliquid.",
                        "بۆیە ستوونەکان بەشێکی بازاڕن؛ خانەی «خوێنراوە» دەڵێت ئەم هەژمارانە چ بەشێکی لۆنگ و شۆرتە کراوەکانی Hyperliquidیان هەیە. هیچ شتێک بۆ هەژمارە نەخوێنراوەکان زیاد ناکرێت.",
                        "نرخی لیکویدکردنی پۆزیشنی کرۆس لەگەڵ قازانج و زیانی پۆزیشنەکانی تری هەمان هەژمار دەجووڵێت؛ پۆزیشنی بێ نرخی لیکویدکردن (مارجینی بەس) لەسەر چارت نییە و دەژمێردرێت. ئامۆژگاریی دارایی نییە."]),
                    ("سەرچاوەکان", ["APIی گشتیی Hyperliquid (دۆخی هەر هەژمارێک، بازاڕ و لیستی هەژمارەکان)، بە CIی ماڵپەڕەکە دەخوێنرێتەوە."])],
            "ar": [("ماذا تعرض هذه الصفحة", [
                       "<b>الأعمدة:</b> دولارات المراكز التي تُصفّى في كل نطاق سعري — الشراء بالأحمر (تحت السعر) والبيع بالأخضر (فوقه).",
                       "<b>الخانات:</b> كم دولارًا من مراكز الشراء يُصفّى بهبوط ٥٪ (و١٠٪) وكم من البيع بارتفاع ٥٪ (و١٠٪)، وأي حصة من العقود المفتوحة قُرئت، وكم حسابًا.",
                       "<b>الجدول:</b> أكبر المراكز المقروءة مع سعر الدخول وسعر التصفية والمسافة والرافعة — دون عنوان الحساب."]),
                   ("كيف تقرأها", [
                       "عمود مرتفع قرب السعر يعني أن حركة صغيرة قد تطلق تصفيات متتالية؛ وهذا لا يتنبأ بمكان السعر.",
                       "خرائط التصفية الأخرى (في هذا الموقع وغيره) نماذج؛ أما هذه فمراكز حقيقية، لكن من Hyperliquid وحدها ومن الحسابات المقروءة وحدها."]),
                   ("المنهج والحدود", [
                       "تنشر Hyperliquid مراكز كل حساب مع سعر تصفيتها لكنها لا تنشر قائمة بكل المراكز؛ يقرأ الموقع نحو مرة في الساعة ما يتسع له بضع دقائق من الحسابات — الأكبر والأنشط بالتناوب من قائمة Hyperliquid نفسها.",
                       "فالأعمدة جزء من السوق؛ وخانة «المقروء» تقول أي حصة من مراكز الشراء والبيع المفتوحة في Hyperliquid تملكها هذه الحسابات. لا يُضاف شيء عن الحسابات غير المقروءة.",
                       "يتحرك سعر تصفية المركز ذي الهامش المتقاطع مع أرباح وخسائر مراكز الحساب الأخرى؛ والمركز بلا سعر تصفية (هامش كافٍ) ليس على الرسم ويُعدّ. ليست نصيحة مالية."]),
                   ("المصادر", ["واجهة Hyperliquid العامة (حالة كل حساب والسوق وقائمة الحسابات)، يقرؤها CI الموقع."])],
            "en": [("What this page shows", [
                       "<b>Bars:</b> the dollars of positions that would be liquidated in each price band — longs in red (below the price), shorts in green (above it).",
                       "<b>Tiles:</b> how many dollars of longs a 5% (and 10%) fall would liquidate, how many of shorts a 5% (and 10%) rise, what share of the open interest was read, and how many accounts.",
                       "<b>The table:</b> the largest positions read, with entry, liquidation price, distance and leverage — no account addresses."]),
                   ("How to read it", [
                       "A tall bar near the price means a small move could set off a chain of liquidations; it does not forecast where the price goes.",
                       "Other liquidation maps (this site’s and other sites’) are models; this one is real positions, but from Hyperliquid alone and from the accounts read alone."]),
                   ("Method and limits", [
                       "Hyperliquid publishes each account’s positions with their liquidation prices but no list of all positions; about once an hour the site reads as many accounts as fit in a few minutes — the largest and the most active in turn, from Hyperliquid’s own list.",
                       "So the bars are part of the market; the “Read” tile says what share of Hyperliquid’s open longs and shorts these accounts hold. Nothing is added for the accounts not read.",
                       "A cross-margin position’s liquidation price moves with the profit and loss of the account’s other positions; a position with no liquidation price (enough margin) is not on the chart and is counted. Not financial advice."]),
                   ("Sources", ["Hyperliquid’s public API (each account’s state, the market, the list of accounts), read by the site’s CI."])],
        },
    },
})

# what the existing pages gained in stage 5: bullets added to their "what this page shows" (0) and "method" (2) sections
STAGE5_ABOUT = {
    "options": {
        "fa": {0: ["<b>لبخند و ساختار زمانی:</b> نوسان ضمنی هر استرایک یک سررسید، و IV در پول، کال و پوت ۲۵ دلتا در همهٔ سررسیدها، با ریسک ریورسال و باترفلای؛ کاشی پنجم چولگی ۳۰ روزه است."],
               2: ["دلتا از فرمول بلک با IV علامت‌گذاری‌شدهٔ خود هر آپشن و فیوچرز همان سررسید است؛ IV در دلتای ۲۵ روی خط میان دو استرایک دو طرف خوانده می‌شود و مقدار ۳۰ روزه روی خط میان دو سررسید دو طرف ۳۰ روز."]},
        "ckb": {0: ["<b>زەردەخەنە و پێکهاتەی کات:</b> هەڵاوسانی ناوەکیی هەر ستراکێکی یەک بەسەرچوون، و IVی ناو پارە، کۆڵ و پوتی ٢٥ دێڵتا لە هەموو بەسەرچوونەکاندا، لەگەڵ ڕیسک ڕیڤێرساڵ و پەپوولە؛ خانەی پێنجەم لاریی ٣٠ ڕۆژەیە."],
                2: ["دێڵتا لە فۆرمولی بلاکە بە IVی نیشانەکراوی هەر ئۆپشنێک و فیوچەرزی هەمان بەسەرچوون؛ IV لە دێڵتای ٢٥ لەسەر هێڵی نێوان دوو ستراکی دوو لا دەخوێنرێتەوە و بەهای ٣٠ ڕۆژە لەسەر هێڵی نێوان دوو بەسەرچوونی دوو لای ٣٠ ڕۆژ."]},
        "ar": {0: ["<b>الابتسامة والهيكل الزمني:</b> التقلب الضمني لكل سعر تنفيذ في استحقاق واحد، وIV عند السعر وشراء وبيع ٢٥ دلتا في كل الاستحقاقات مع انعكاس المخاطرة والفراشة؛ والخانة الخامسة انحراف ٣٠ يومًا."],
               2: ["الدلتا من صيغة بلاك بـIV العلامة لكل خيار والعقد الآجل لاستحقاقه؛ وتُقرأ IV عند دلتا ٢٥ على الخط بين السعرين المحيطين، وقيمة ٣٠ يومًا على الخط بين الاستحقاقين المحيطين."]},
        "en": {0: ["<b>Smile and term structure:</b> the implied volatility of every strike of one expiry, and the at-the-money, 25-delta call and put IV of every expiry with the risk reversal and butterfly; the fifth tile is the 30-day skew."],
               2: ["Delta is Black’s, from each option’s own mark IV and the future of its expiry; the 25-delta IV is read on the line between the two strikes around it, the 30-day value on the line between the two expiries around 30 days."]},
    },
    "ls": {
        "fa": {0: ["<b>شمار واقعی حساب‌ها در Gate:</b> Gate تعداد حساب‌های لانگ و شورت را منتشر می‌کند؛ سهم لانگ‌ها، و همین برای تریدرهای برترش (به تعداد و به حجم)، تا ۱ سال."]},
        "ckb": {0: ["<b>ژمارەی ڕاستەقینەی هەژمارەکان لە Gate:</b> Gate ژمارەی هەژمارە لۆنگ و شۆرتەکان بڵاو دەکاتەوە؛ بەشی لۆنگەکان، و هەمان شت بۆ باشترین بازرگانەکانی (بە ژمارە و بە قەبارە)، تا ١ ساڵ."]},
        "ar": {0: ["<b>عدد الحسابات الحقيقي في Gate:</b> تنشر Gate عدد الحسابات الشارية والبائعة؛ حصة الشراء، وكذلك لكبار متداوليها (بالعدد وبالحجم)، حتى سنة."]},
        "en": {0: ["<b>Gate’s real account counts:</b> Gate publishes how many accounts are long and short; the share long, and the same for its top traders (by number and by size), up to a year."]},
    },
    "basis": {
        "fa": {0: ["<b>تاریخچهٔ منحنی:</b> بیسیس سالانهٔ فیوچرزهای Deribit با سررسید ثابت ۳۰، ۹۰ و ۱۸۰ روز، روز به روز از ۲۰۱۹، با جایگاه امروز در تاریخ."],
               2: ["تاریخچهٔ منحنی: هر روز، بسته‌شدن روزانهٔ هر فیوچرز ماهانه و فصلی Deribit با بسته‌شدن روزانهٔ Coinbase مقایسه می‌شود؛ مقدار ۳۰، ۹۰ و ۱۸۰ روزه روی خط میان دو فیوچرز دو طرف است."]},
        "ckb": {0: ["<b>مێژووی چەماوە:</b> بەیسیسی ساڵانەی فیوچەرزەکانی Deribit بە بەسەرچوونی جێگیری ٣٠، ٩٠ و ١٨٠ ڕۆژ، ڕۆژ بە ڕۆژ لە ٢٠١٩ـەوە، لەگەڵ شوێنی ئەمڕۆ لە مێژوودا."],
                2: ["مێژووی چەماوە: هەموو ڕۆژێک داخستنی ڕۆژانەی هەر فیوچەرزێکی مانگانە و وەرزیی Deribit لەگەڵ داخستنی ڕۆژانەی Coinbase بەراورد دەکرێت؛ بەهای ٣٠، ٩٠ و ١٨٠ ڕۆژە لەسەر هێڵی نێوان دوو فیوچەرزی دوو لایە."]},
        "ar": {0: ["<b>تاريخ المنحنى:</b> الأساس السنوي لعقود Deribit الآجلة باستحقاق ثابت ٣٠ و٩٠ و١٨٠ يومًا، يومًا بيوم منذ ٢٠١٩، مع موضع اليوم في التاريخ."],
               2: ["تاريخ المنحنى: يُقارن كل يوم الإغلاق اليومي لكل عقد آجل شهري وفصلي في Deribit بإغلاق Coinbase اليومي؛ وقيم ٣٠ و٩٠ و١٨٠ يومًا على الخط بين العقدين على الجانبين."]},
        "en": {0: ["<b>Curve history:</b> the yearly basis of Deribit’s futures at a constant 30, 90 and 180 days, day by day since 2019, with where today stands in that history."],
               2: ["Curve history: each day, the daily close of every monthly and quarterly Deribit future is set against Coinbase’s daily close; the 30-, 90- and 180-day values lie on the line between the two futures on either side."]},
    },
    "liqhist": {
        "fa": {0: ["<b>از ۲۰۲۳:</b> بازهٔ «از ۲۰۲۳» روزهای قدیمی‌تر را از ارقام روزانهٔ Gate (از ۱۱ اکتبر ۲۰۲۳) می‌آورد؛ سایت هر روز بسته‌شده را در آرشیو خودش نگه می‌دارد تا تاریخچه کوتاه نشود."]},
        "ckb": {0: ["<b>لە ٢٠٢٣ـەوە:</b> ماوەی «لە ٢٠٢٣ـەوە» ڕۆژە کۆنترەکان لە ژمارە ڕۆژانەکانی Gate (لە ١١ی ئۆکتۆبەری ٢٠٢٣ـەوە) دەهێنێت؛ ماڵپەڕەکە هەموو ڕۆژێکی داخراو لە ئەرشیفی خۆیدا هەڵدەگرێت تا مێژوو کورت نەبێتەوە."]},
        "ar": {0: ["<b>منذ ٢٠٢٣:</b> يأتي مدى «منذ ٢٠٢٣» بالأيام الأقدم من صفوف Gate اليومية (منذ ١١ أكتوبر ٢٠٢٣)؛ ويحفظ الموقع كل يوم مغلق في أرشيفه كي لا يقصر التاريخ."]},
        "en": {0: ["<b>Since 2023:</b> the “Since 2023” range brings older days from Gate’s daily figures (from 11 October 2023); the site keeps every closed day in its own archive so the history does not shrink."]},
    },
}
for _k, _langs in STAGE5_ABOUT.items():
    for _lg, _secs in _langs.items():
        for _i, _items in _secs.items():
            T[_k]["about"][_lg][_i][1].extend(_items)


HUB = {
    "title": "رصدخانه بازار: نمودار مشتقات و آنچین کریپتو | entekhab.net",
    "desc": "رصدخانهٔ بازار انتخاب: لیکوییدیشن، اوپن اینترست، فاندینگ، CVD، پریمیوم Coinbase، آپشن‌ها، MVRV، استیبل‌کوین‌ها و چرخهٔ بیت‌کوین؛ رایگان و به چهار زبان.",
    "og": "رصدخانهٔ بازار — نمودارهای مشتقات و آنچین",
    "h1": {"fa": "رصدخانهٔ بازار", "ckb": "ڕوانگەی بازاڕ", "ar": "مرصد السوق", "en": "Market Observatory"},
    "p": {"fa": "نمودارهای مشتقات و آنچین در یک جا — از دادهٔ عمومی، با روش نوشته‌شده، رایگان و بدون ثبت‌نام",
          "ckb": "چارتەکانی دەرهاتەکان و ئانچین لە یەک شوێندا — لە داتای گشتییەوە، بە ڕێگای نووسراو، بێبەرامبەر و بێ خۆتۆمارکردن",
          "ar": "رسوم المشتقات والبيانات على السلسلة في مكان واحد — من بيانات عامة، بمنهج مكتوب، مجانًا ودون تسجيل",
          "en": "Derivatives and on-chain charts in one place — from public data, with the method written down, free and without sign-up"},
    "new": {"fa": "تازه", "ckb": "نوێ", "ar": "جديد", "en": "New"},
    "soon": {"fa": "در دست ساخت", "ckb": "لە دروستکردندایە", "ar": "قيد الإنشاء", "en": "In the works"},
    "soon_note": {"fa": "این‌ها هنوز ساخته نشده‌اند و به‌ترتیب اضافه می‌شوند", "ckb": "ئەمانە هێشتا دروست نەکراون و بە نۆرە زیاد دەکرێن",
                  "ar": "لم تُنشأ بعد وتُضاف تباعًا", "en": "Not built yet; they are being added one by one"},
    # (section title, [(path or None, new?, title, description)])
    "secs": [
        ({"fa": "لیکوییدیشن‌ها", "ckb": "لیکویدەکان", "ar": "التصفيات", "en": "Liquidations"}, [
            ("/charts/liquidation-heatmap/", True,
             {"fa": "نقشهٔ حرارتی لیکوییدیشن", "ckb": "نەخشەی گەرمیی لیکویدکردن", "ar": "الخريطة الحرارية للتصفيات", "en": "Liquidation heatmap"},
             {"fa": "برآورد سطوح لیکوییدیشن روی زمان و قیمت، ۱۲ ساعت تا ۱ سال، سه مدل", "ckb": "خەمڵاندنی ئاستەکانی لیکویدکردن لەسەر کات و نرخ، ١٢ کاتژمێر تا ١ ساڵ، سێ مۆدێل",
              "ar": "تقدير مستويات التصفية على الزمن والسعر، من ١٢ ساعة إلى سنة، بثلاثة نماذج", "en": "Estimated liquidation levels over time and price, 12 hours to a year, three models"}),
            ("/charts/liquidation-map/", True,
             {"fa": "نقشهٔ لیکوییدیشن", "ckb": "نەخشەی لیکویدکردن", "ar": "خريطة التصفيات", "en": "Liquidation map"},
             {"fa": "سطوح فعلی به تفکیک اهرم و جمع تجمعی از قیمت", "ckb": "ئاستەکانی ئێستا بەپێی لیڤەرێج و کۆی کۆکراوە لە نرخەوە",
              "ar": "المستويات الحالية حسب الرافعة والمجموع التراكمي من السعر", "en": "Present levels by leverage and the running total from the price"}),
            ("/charts/liquidations/", True,
             {"fa": "لیکوییدیشن‌های واقعی، روز به روز", "ckb": "لیکویدە ڕاستەقینەکان، ڕۆژ بە ڕۆژ", "ar": "التصفيات الفعلية يومًا بيوم", "en": "Real liquidations, day by day"},
             {"fa": "دلار لانگ‌ها و شورت‌های لیکوییدشده در هر ساعت و روز از ۲۰۲۳، از Gate و OKX", "ckb": "دۆلاری لۆنگ و شۆرتە لیکویدکراوەکان لە هەر کاتژمێر و ڕۆژێکدا لە ٢٠٢٣ـەوە، لە Gate و OKX",
              "ar": "دولارات مراكز الشراء والبيع المُصفّاة كل ساعة ويوم منذ ٢٠٢٣، من Gate وOKX", "en": "Dollars of longs and shorts liquidated every hour and day since 2023, from Gate and OKX"}),
            ("/charts/hyperliquid/", True,
             {"fa": "لیکوییدیشن واقعی Hyperliquid", "ckb": "لیکویدی ڕاستەقینەی Hyperliquid", "ar": "تصفيات Hyperliquid الفعلية", "en": "Hyperliquid: real liquidation levels"},
             {"fa": "قیمت لیکوییدیشن پوزیشن‌های باز واقعی، از خود حساب‌ها نه از مدل", "ckb": "نرخی لیکویدکردنی پۆزیشنە کراوە ڕاستەقینەکان، لە خودی هەژمارەکانەوە نەک مۆدێل",
              "ar": "أسعار تصفية المراكز المفتوحة الحقيقية، من الحسابات نفسها لا من نموذج", "en": "Liquidation prices of real open positions, from the accounts themselves, not a model"}),
            ("/liquidity/", False,
             {"fa": "لیکوییدیشن‌های زنده و دفتر سفارش", "ckb": "لیکویدە زیندووەکان و دەفتەری داواکاری", "ar": "التصفيات المباشرة ودفتر الأوامر", "en": "Live liquidations & order book"},
             {"fa": "لیکوییدیشن‌های همان لحظه، نقشهٔ حرارتی دفتر سفارش و عمق بازار", "ckb": "لیکویدەکان لە هەمان ساتدا، نەخشەی گەرمیی دەفتەری داواکاری و قووڵایی",
              "ar": "التصفيات لحظة حدوثها، الخريطة الحرارية لدفتر الأوامر وعمق السوق", "en": "Liquidations as they happen, the order-book heatmap and market depth"}),
        ]),
        ({"fa": "فیوچرز و مشتقات", "ckb": "فیوچەرز و دەرهاتەکان", "ar": "العقود الآجلة والمشتقات", "en": "Futures & derivatives"}, [
            ("/charts/open-interest/", True,
             {"fa": "اوپن اینترست صرافی‌ها", "ckb": "ئۆپن ئینتەرێستی ئاڵوگۆڕگەکان", "ar": "العقود المفتوحة عبر المنصات", "en": "Open interest by exchange"},
             {"fa": "جمع و سهم شش صرافی و تاریخچه تا ۱ سال، زیر نمودار قیمت", "ckb": "کۆ و بەشی شەش ئاڵوگۆڕگە و مێژوو تا ١ ساڵ، لە ژێر چارتی نرخدا",
              "ar": "مجموع ست منصات وحصصها وتاريخ حتى سنة، تحت رسم السعر", "en": "The total and shares of six exchanges, with history up to a year, under the price"}),
            ("/charts/funding-rate/", True,
             {"fa": "نرخ فاندینگ صرافی‌ها", "ckb": "نرخی فەندینگی ئاڵوگۆڕگەکان", "ar": "معدلات التمويل عبر المنصات", "en": "Funding rates by exchange"},
             {"fa": "پنج صرافی کنار هم بر پایهٔ ۸ ساعت، جدول ۴۰ ارز و تاریخچه", "ckb": "پێنج ئاڵوگۆڕگە لە تەنیشت یەک لەسەر بنەمای ٨ کاتژمێر، خشتەی ٤٠ دراو و مێژوو",
              "ar": "خمس منصات جنبًا إلى جنب على أساس ٨ ساعات، جدول ٤٠ عملة وتاريخ", "en": "Five exchanges side by side on an 8-hour basis, a table of 40 coins, and history"}),
            ("/charts/long-short/", True,
             {"fa": "نسبت لانگ به شورت", "ckb": "ڕێژەی لۆنگ بۆ شۆرت", "ar": "نسبة الشراء إلى البيع", "en": "Long/short ratio"},
             {"fa": "سهم حساب‌های لانگ با شمار واقعی حساب‌ها در Gate، معامله‌گران برتر و خالص حجم تهاجمی", "ckb": "بەشی هەژمارە لۆنگەکان بە ژمارەی ڕاستەقینەی هەژمارەکان لە Gate، بازرگانە سەرەکییەکان و سافیی قەبارەی هێرشبەرانە",
              "ar": "حصة الحسابات المشترية بعدد الحسابات الحقيقي في Gate، كبار المتداولين وصافي الحجم العدواني", "en": "Share of accounts long, with Gate’s real account counts, top traders and net taker volume"}),
            ("/charts/cvd/", True,
             {"fa": "CVD اسپات و فیوچرز", "ckb": "CVDی سپۆت و فیوچەرز", "ar": "CVD للفوري والآجل", "en": "CVD, spot and futures"},
             {"fa": "خالص تجمعی خرید و فروش تهاجمی، اسپات در برابر فیوچرز، ۲۴ ساعت تا ۱ سال", "ckb": "سافیی کۆکراوەی کڕین و فرۆشتنی هێرشبەرانە، سپۆت بەرامبەر فیوچەرز، ٢٤ کاتژمێر تا ١ ساڵ",
              "ar": "صافي الشراء والبيع العدواني التراكمي، الفوري مقابل الآجل، من ٢٤ ساعة إلى سنة", "en": "Cumulative net taker buying, spot against futures, 24 hours to a year"}),
            ("/charts/basis/", True,
             {"fa": "پریمیوم Coinbase و بیسیس فیوچرز", "ckb": "پریمیۆمی Coinbase و بەیسیسی فیوچەرز", "ar": "علاوة Coinbase وأساس العقود الآجلة", "en": "Coinbase premium and futures basis"},
             {"fa": "پریمیوم Coinbase از ۲۰۱۷، پریمیوم قرارداد دائمی، منحنی سررسیدها و تاریخچهٔ بیسیس از ۲۰۱۹", "ckb": "پریمیۆمی Coinbase لە ٢٠١٧ـەوە، پریمیۆمی گرێبەستی هەمیشەیی، چەماوەی بەسەرچوونەکان و مێژووی بەیسیس لە ٢٠١٩ـەوە",
              "ar": "علاوة Coinbase منذ ٢٠١٧، علاوة العقد الدائم، منحنى الاستحقاقات وتاريخ الأساس منذ ٢٠١٩", "en": "The Coinbase premium since 2017, the perpetual’s premium, the curve of expiries and its history since 2019"}),
            ("/charts/options/", True,
             {"fa": "آپشن‌های بیت‌کوین و اتریوم", "ckb": "ئۆپشنەکانی بیتکۆین و ئیسیریۆم", "ar": "خيارات البيتكوين والإيثر", "en": "Bitcoin and Ether options"},
             {"fa": "اوپن اینترست به تفکیک استرایک و سررسید، مکس پین، لبخند و چولگی نوسان، ساختار زمانی و DVOL", "ckb": "ئۆپن ئینتەرێست بەپێی ستراک و بەسەرچوون، ماکس پەین، زەردەخەنە و لاریی هەڵاوسان، پێکهاتەی کات و DVOL",
              "ar": "العقود المفتوحة حسب سعر التنفيذ والاستحقاق، أقصى ألم، ابتسامة التقلب وانحرافه، الهيكل الزمني وDVOL", "en": "Open interest by strike and expiry, max pain, the volatility smile and skew, term structure and DVOL"}),
            ("/derivatives/", False,
             {"fa": "داشبورد مشتقات", "ckb": "داشبۆردی دەرهاتەکان", "ar": "لوحة المشتقات", "en": "Derivatives dashboard"},
             {"fa": "فاندینگ، اوپن اینترست، لیکوییدیشن ۲۴ ساعته و لانگ/شورت", "ckb": "فەندینگ، ئۆپن ئینتەرێست، لیکویدی ٢٤ کاتژمێر و لۆنگ/شۆرت",
              "ar": "التمويل، العقود المفتوحة، تصفيات ٢٤ ساعة ونسبة الشراء/البيع", "en": "Funding, open interest, 24-hour liquidations, long/short"}),
            ("/terminal/", False,
             {"fa": "ترمینال", "ckb": "تێرمیناڵ", "ar": "الطرفية", "en": "Terminal"},
             {"fa": "نقشهٔ حرارتی فاندینگ ۴۰ قرارداد و جریان خرید و فروش", "ckb": "نەخشەی گەرمیی فەندینگی ٤٠ گرێبەست و ڕەوتی کڕین و فرۆشتن",
              "ar": "خريطة تمويل ٤٠ عقدًا وتدفق الشراء والبيع", "en": "Funding heatmap of 40 contracts and taker flow"}),
            ("/anomalies/", False,
             {"fa": "شکارچی ناهنجاری", "ckb": "ڕاوکەری نائاسایی", "ar": "صائد الشذوذ", "en": "Anomaly hunter"},
             {"fa": "حجم، قیمت، اوپن اینترست و فاندینگ غیرعادی امروز", "ckb": "قەبارە، نرخ، ئۆپن ئینتەرێست و فەندینگی نائاسایی ئەمڕۆ",
              "ar": "حجم وسعر وعقود مفتوحة وتمويل غير اعتيادية اليوم", "en": "Today's unusual volume, price, open interest and funding"}),
        ]),
        ({"fa": "جریان پول و نهادها", "ckb": "ڕەوتی پارە و دامەزراوەکان", "ar": "تدفق الأموال والمؤسسات", "en": "Money flow & institutions"}, [
            ("/charts/stablecoins/", True,
             {"fa": "استیبل‌کوین‌ها و نسبت SSR", "ckb": "ستەیبڵکۆینەکان و ڕێژەی SSR", "ar": "العملات المستقرة ونسبة SSR", "en": "Stablecoins and the SSR"},
             {"fa": "عرضهٔ استیبل‌کوین‌ها از ۲۰۱۷، تغییر ۳۰ روزه و ارزش بیت‌کوین در برابر آن", "ckb": "خستنەڕووی ستەیبڵکۆینەکان لە ٢٠١٧ـەوە، گۆڕانی ٣٠ ڕۆژە و بەهای بیتکۆین بەرامبەری",
              "ar": "معروض العملات المستقرة منذ ٢٠١٧، تغيّر ٣٠ يومًا وقيمة البيتكوين مقابله", "en": "Stablecoin supply since 2017, its 30-day change and Bitcoin’s value against it"}),
            ("/money-flow/", False,
             {"fa": "جریان پول بازار", "ckb": "ڕەوتی پارەی بازاڕ", "ar": "تدفق الأموال", "en": "Money flow"},
             {"fa": "خرید و فروش تهاجمی هر ارز و بخش، استیبل‌کوین‌ها و دامیننس", "ckb": "کڕین و فرۆشتنی هێرشبەرانە، ستەیبڵکۆینەکان و باڵادەستی",
              "ar": "الشراء والبيع العدواني، العملات المستقرة والهيمنة", "en": "Aggressive buys and sells, stablecoins and dominance"}),
            ("/etf/", False,
             {"fa": "ETF و نهادها", "ckb": "ETF و دامەزراوەکان", "ar": "الصناديق والمؤسسات", "en": "ETFs & institutions"},
             {"fa": "جریان روزانهٔ ETFهای بیت‌کوین و اتریوم و خزانهٔ شرکت‌ها", "ckb": "ڕەوتی ڕۆژانەی ETFی بیتکۆین و ئیسیریۆم و گەنجینەی کۆمپانیاکان",
              "ar": "التدفق اليومي لصناديق البيتكوين والإيثر وخزائن الشركات", "en": "Daily Bitcoin and Ether ETF flows and company treasuries"}),
        ]),
        ({"fa": "آنچین", "ckb": "ئانچین", "ar": "على السلسلة", "en": "On-chain"}, [
            ("/charts/mvrv/", True,
             {"fa": "MVRV، قیمت تحقق‌یافته و NUPL", "ckb": "MVRV، نرخی بەدیهاتوو و NUPL", "ar": "MVRV والسعر المحقّق وNUPL", "en": "MVRV, realized price and NUPL"},
             {"fa": "بازار نسبت به قیمت خرید دارندگان کجاست؛ بیت‌کوین و اتریوم از ۲۰۱۰", "ckb": "بازاڕ بە بەراورد لەگەڵ نرخی کڕینی خاوەنەکان لە کوێدایە؛ بیتکۆین و ئیسیریۆم لە ٢٠١٠ـەوە",
              "ar": "أين السوق من سعر شراء الحائزين؛ البيتكوين والإيثر منذ ٢٠١٠", "en": "Where the market stands against holders' cost; Bitcoin and Ether since 2010"}),
            ("/charts/exchange-flows/", True,
             {"fa": "ذخایر و جریان صرافی‌ها", "ckb": "یەدەگ و ڕەوتی ئاڵوگۆڕگەکان", "ar": "احتياطيات المنصات وتدفقاتها", "en": "Exchange reserves and flows"},
             {"fa": "موجودی صرافی‌ها، ورودی، خروجی و جریان خالص روزانه", "ckb": "یەدەگی ئاڵوگۆڕگەکان، هاتن، ڕۆیشتن و ڕەوتی سافیی ڕۆژانە",
              "ar": "احتياطي المنصات والداخل والخارج وصافي التدفق اليومي", "en": "What exchanges hold, daily inflow, outflow and net flow"}),
            ("/charts/network/", True,
             {"fa": "فعالیت شبکه و ماینرها", "ckb": "چالاکیی تۆڕ و ماینەرەکان", "ar": "نشاط الشبكة والمعدّنون", "en": "Network activity and miners"},
             {"fa": "آدرس‌های فعال، تراکنش‌ها، نرخ هش، درآمد ماینرها و ضریب پوئل", "ckb": "ناونیشانە چالاکەکان، مامەڵەکان، ڕێژەی هاش، داهاتی ماینەرەکان و چەندجارەی پوێڵ",
              "ar": "العناوين النشطة والمعاملات ومعدل التجزئة وإيرادات المعدّنين ومضاعف بويل", "en": "Active addresses, transactions, hash rate, miner revenue and the Puell multiple"}),
            ("/onchain/", False,
             {"fa": "تحلیل آنچین", "ckb": "شیکاریی ئانچین", "ar": "تحليل السلسلة", "en": "On-chain analysis"},
             {"fa": "تحلیل بازار انتخاب و خلاصهٔ تحلیل‌های آنچین", "ckb": "شیکاریی بازاڕی ئەنتخاب و پوختەی شیکارییە ئانچینەکان",
              "ar": "تحليل السوق وملخّص تحليلات السلسلة", "en": "Entekhab's market analysis and on-chain digests"}),
            ("/whales/", False,
             {"fa": "رادار نهنگ‌ها", "ckb": "ڕاداری نەهەنگەکان", "ar": "رادار الحيتان", "en": "Whale radar"},
             {"fa": "انتقال‌های بزرگ روی زنجیره", "ckb": "گواستنەوە گەورەکان لەسەر زنجیرە", "ar": "التحويلات الكبيرة على السلسلة", "en": "Large on-chain transfers"}),
            ("/satoshi/", False,
             {"fa": "شبکهٔ زندهٔ بیت‌کوین", "ckb": "تۆڕی زیندووی بیتکۆین", "ar": "شبكة البيتكوين المباشرة", "en": "The live Bitcoin network"},
             {"fa": "ممپول، بلاک‌ها، کارمزد و جست‌وجوی هر تراکنش", "ckb": "مێمپووڵ، بلۆکەکان، کرێ و گەڕان بۆ هەر مامەڵەیەک",
              "ar": "الميمبول والكتل والرسوم والبحث عن أي معاملة", "en": "Mempool, blocks, fees and any transaction looked up"}),
        ]),
        ({"fa": "چرخهٔ بازار", "ckb": "خولی بازاڕ", "ar": "دورة السوق", "en": "Market cycle"}, [
            ("/charts/bitcoin-cycle/", True,
             {"fa": "شاخص‌های چرخهٔ بیت‌کوین", "ckb": "پێوەرەکانی خولی بیتکۆین", "ar": "مؤشرات دورة البيتكوين", "en": "Bitcoin cycle indicators"},
             {"fa": "ضریب مایر، میانگین ۲۰۰ هفته، پای سایکل، ضریب ۲ ساله و جایگاه امروز در تاریخ", "ckb": "چەندجارەی مایەر، تێکڕای ٢٠٠ هەفتە، خولی پای، چەندجارەی ٢ ساڵە و شوێنی ئەمڕۆ لە مێژوودا",
              "ar": "مضاعف ماير، متوسط ٢٠٠ أسبوع، دورة باي، مضاعف السنتين وموضع اليوم في التاريخ", "en": "Mayer multiple, 200-week average, Pi cycle, 2-year multiplier and where today stands in history"}),
            ("/regime/", False,
             {"fa": "رادار رژیم بازار", "ckb": "ڕاداری دۆخی بازاڕ", "ar": "رادار نظام السوق", "en": "Market-regime radar"},
             {"fa": "احتمال صعودی، نزولی، خنثی یا پرنوسان بودن بازار", "ckb": "ئەگەری بەرزبوونەوە، دابەزین، مامناوەند یان هەڵاوسان",
              "ar": "احتمال أن يكون السوق صاعدًا أو هابطًا أو عرضيًّا أو متقلبًا", "en": "How likely bull, bear, sideways or high volatility is"}),
            ("/fear-greed/", False,
             {"fa": "شاخص ترس و طمع", "ckb": "پێوەری ترس و تەماح", "ar": "مؤشر الخوف والطمع", "en": "Fear & Greed index"},
             {"fa": "احساسات امروز بازار و تاریخچهٔ آن", "ckb": "هەستی ئەمڕۆی بازاڕ و مێژووەکەی", "ar": "مزاج السوق اليوم وتاريخه", "en": "Today's market mood and its history"}),
        ]),
    ],
    "todo": [],                                   # nothing of the three sites' free features is left unbuilt; the section is drawn only when this holds something
}


def rtl_list(text, lg):
    """A list of Latin names in a right-to-left sentence ("Binance، Bybit، OKX"): a right-to-left mark after each comma keeps
    the names in the order they are read, instead of one left-to-right run that reverses them."""
    return text if lg == "en" else re.sub(r"([A-Za-z0-9)])، (?=[A-Za-z(])", "\\1،\u200f ", text)


def spans(dct, tag="span"):
    return "".join(f'<{tag} data-lang="{lg}"{"" if lg == "fa" else " hidden"}>{e(rtl_list(dct[lg], lg))}</{tag}>' for lg in LANGS)


def about(view):
    out = []
    for lg in LANGS:
        secs = T[view]["about"][lg]
        body = "".join(f"<h2>{e(h)}</h2><ul>" + "".join(f"<li>{rtl_list(x, lg)}</li>" for x in items) + "</ul>" for h, items in secs)
        hid = "" if lg == "fa" else " hidden"
        out.append(f'  <section class="ob-about" data-lang="{lg}" lang="{lg}" dir="{"ltr" if lg == "en" else "rtl"}"{hid}>{body}</section>')
    return "\n".join(out)


def head(title, desc, og, url, ld):
    return f"""<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#f7931a">
<meta property="og:title" content="{e(og)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}"><meta property="og:site_name" content="entekhab.net">
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><meta property="og:image" content="https://entekhab.net/assets/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;900&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/obs/obs.css?v={V}">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False, separators=(",", ":"))}</script>
</head>
"""


def page(view, folder, scripts):
    t = T[view]
    url = f"{SITE}/{HUB_PATH}/{folder}/"
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": t["ld"], "alternateName": t["h1"]["fa"], "url": url,
          "applicationCategory": "FinanceApplication", "operatingSystem": "Any (web browser)", "inLanguage": ["ckb", "fa", "ar", "en"],
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
          "publisher": {"@type": "Organization", "name": "Entekhab (entekhab.net)", "url": SITE}, "description": t["p"]["en"]}
    tags = "".join(f'<script src="/assets/obs/{s}?v={V}" defer></script>\n' for s in ["i18n.js", "core.js"] + scripts)
    return head(t["title"], t["desc"], t["og"], url, ld) + f"""<body>
<!--ek:header--><!--/ek:header-->
<main class="ob-page" id="ob-main" data-view="{view}" translate="no">
  <nav class="ob-crumb"><a href="/{HUB_PATH}/">{spans(HUB["h1"])}</a></nav>
  <div class="ob-head">
    <h1>{spans(t["h1"])}</h1>
    <p>{spans(t["p"])}</p>
  </div>
  <div id="ob" class="ob" translate="no"><div class="ob-wait">…</div></div>
  <noscript><p class="ob-about">این صفحه با جاوااسکریپت کار می‌کند. / This page needs JavaScript.</p></noscript>
{about(view)}
</main>
<!--ek:bottom--><!--/ek:bottom-->
<!--ek:footer--><!--/ek:footer-->
{tags}<script src="/assets/ui.js" defer></script>
</body>
</html>
"""


def hub():
    url = f"{SITE}/{HUB_PATH}/"
    items = []
    out = []
    for lg in LANGS:
        hid = "" if lg == "fa" else " hidden"
        body = ""
        for sec, cards in HUB["secs"]:
            body += f'<h2 class="ob-hsec">{e(sec[lg])}</h2><div class="ob-hub">'
            for path, new, tt, ds in cards:
                badge = f'<em>{e(HUB["new"][lg])}</em>' if new else ""
                body += f'<a class="ob-hc" href="{path}">{badge}<b>{e(tt[lg])}</b><small>{e(ds[lg])}</small></a>'
            body += "</div>"
        if HUB["todo"]:
            body += f'<h2 class="ob-hsec">{e(HUB["soon"][lg])}<small>{e(HUB["soon_note"][lg])}</small></h2><div class="ob-hub">'
            body += "".join(f'<div class="ob-hc soon"><b>{e(x[lg])}</b></div>' for x in HUB["todo"]) + "</div>"
        out.append(f'  <section data-lang="{lg}" lang="{lg}" dir="{"ltr" if lg == "en" else "rtl"}"{hid}>{body}</section>')
    for sec, cards in HUB["secs"]:
        for path, new, tt, ds in cards:
            items.append({"@type": "ListItem", "position": len(items) + 1, "name": tt["en"], "url": SITE + path})
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "Entekhab Market Observatory", "alternateName": HUB["h1"]["fa"], "url": url,
          "inLanguage": ["ckb", "fa", "ar", "en"], "description": HUB["p"]["en"],
          "mainEntity": {"@type": "ItemList", "itemListElement": items}}
    return head(HUB["title"], HUB["desc"], HUB["og"], url, ld) + f"""<body>
<!--ek:header--><!--/ek:header-->
<main class="ob-page" id="ob-main" data-view="hub" translate="no">
  <div class="ob-head">
    <h1>{spans(HUB["h1"])}</h1>
    <p>{spans(HUB["p"])}</p>
  </div>
{chr(10).join(out)}
</main>
<!--ek:bottom--><!--/ek:bottom-->
<!--ek:footer--><!--/ek:footer-->
<script src="/assets/obs/i18n.js?v={V}" defer></script>
<script src="/assets/obs/core.js?v={V}" defer></script>
<script src="/assets/ui.js" defer></script>
</body>
</html>
"""


def write(rel, doc):
    """the page with the site's header, footer and CSP already in it (scripts/chrome.py refreshes them on every CI run)"""
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import chrome
    d = os.path.join(ROOT, rel)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
        f.write(chrome.inject_doc(doc))


def folders():
    """every folder this script writes, for chrome.STATIC and the sitemap"""
    return [HUB_PATH] + [f"{HUB_PATH}/{folder}" for _, folder, _ in PAGES]


def catalog():
    """every chart page for the site's assistant: (address, {language: title}, {language: lead}, search keywords)"""
    return [(f"/{HUB_PATH}/{folder}/", T[view]["h1"], T[view]["p"], T[view].get("kw", [])) for view, folder, _ in PAGES]


def main():
    for view, folder, scripts in PAGES:
        t = T[view]
        assert len(t["title"]) <= 60, (view, "title", len(t["title"]))
        assert len(t["desc"]) <= 160, (view, "description", len(t["desc"]))
        for lg in LANGS:
            assert t["h1"].get(lg) and t["p"].get(lg) and t["about"].get(lg), (view, lg)
        write(f"{HUB_PATH}/{folder}", page(view, folder, scripts))
        print(f"/{HUB_PATH}/{folder}/ written (title {len(t['title'])}, description {len(t['desc'])} characters)")
    assert len(HUB["title"]) <= 60, ("hub title", len(HUB["title"]))
    assert len(HUB["desc"]) <= 160, ("hub description", len(HUB["desc"]))
    write(HUB_PATH, hub())
    print(f"/{HUB_PATH}/ written (title {len(HUB['title'])}, description {len(HUB['desc'])} characters)")


if __name__ == "__main__":
    main()
