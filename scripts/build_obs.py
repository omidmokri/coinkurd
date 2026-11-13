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
V = "4"            # asset version (bump with any change to assets/obs/*)
LANGS = ("fa", "ckb", "ar", "en")
HUB_PATH = "charts"


def e(s):
    return html.escape(str(s), quote=True)


# view key, folder under /charts/, scripts after i18n.js and core.js
PAGES = [
    ("liqheat", "liquidation-heatmap", ["src.js", "liqmodel.js", "liq.js"]),
    ("liqmap", "liquidation-map", ["src.js", "liqmodel.js", "liq.js"]),
    ("oi", "open-interest", ["src.js", "ts.js", "deriv.js"]),
    ("funding", "funding-rate", ["src.js", "ts.js", "deriv.js"]),
    ("ls", "long-short", ["src.js", "ts.js", "deriv.js"]),
    ("options", "options", ["optmath.js", "ts.js", "opt.js"]),
    ("mvrv", "mvrv", ["chainmath.js", "ts.js", "chain.js"]),
    ("flows", "exchange-flows", ["chainmath.js", "ts.js", "chain.js"]),
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
                       "نرخ هش، پوئل و موجودی به جریان فقط برای بیت‌کوین نشان داده می‌شوند (اتریوم از سپتامبر ۲۰۲۲ استخراج ندارد). نوارها قراردادند، نه سیگنال. توصیهٔ مالی نیست."]),
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
                        "ڕێژەی هاش، پوێڵ و کۆگا بۆ ڕەوت تەنها بۆ بیتکۆینن. هێڵەکان ڕێککەوتنن، نەک سیگناڵ. ئامۆژگاریی دارایی نییە."]),
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
                       "معدل التجزئة وبويل والمخزون إلى التدفق للبيتكوين فقط. الحدود عرف لا إشارة. ليست نصيحة مالية."]),
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
                       "Hash rate, Puell and stock-to-flow are shown for Bitcoin only (Ether has had no mining since September 2022). The bands are conventions, not signals. Not financial advice."]),
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


HUB = {
    "title": "رصدخانه بازار: نمودار مشتقات و آنچین کریپتو | entekhab.net",
    "desc": "رصدخانهٔ بازار انتخاب: نقشهٔ حرارتی لیکوییدیشن، اوپن اینترست، فاندینگ، آپشن‌ها، MVRV، ذخایر صرافی‌ها و چرخهٔ بیت‌کوین؛ رایگان، بدون ثبت‌نام، به چهار زبان.",
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
             {"fa": "سهم حساب‌های لانگ، معامله‌گران برتر و خالص حجم تهاجمی", "ckb": "بەشی هەژمارە لۆنگەکان، بازرگانە سەرەکییەکان و سافیی قەبارەی هێرشبەرانە",
              "ar": "حصة الحسابات المشترية، كبار المتداولين وصافي الحجم العدواني", "en": "Share of accounts long, top traders and net taker volume"}),
            ("/charts/options/", True,
             {"fa": "آپشن‌های بیت‌کوین و اتریوم", "ckb": "ئۆپشنەکانی بیتکۆین و ئیسیریۆم", "ar": "خيارات البيتكوين والإيثر", "en": "Bitcoin and Ether options"},
             {"fa": "اوپن اینترست به تفکیک قیمت اعمال و سررسید، مکس پین، نسبت فروش به خرید و DVOL", "ckb": "ئۆپن ئینتەرێست بەپێی نرخی جێبەجێکردن و بەسەرچوون، ماکس پەین، ڕێژەی پوت بۆ کۆڵ و DVOL",
              "ar": "العقود المفتوحة حسب سعر التنفيذ والاستحقاق، أقصى ألم، نسبة البيع إلى الشراء وDVOL", "en": "Open interest by strike and expiry, max pain, put/call ratio and DVOL"}),
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
    "todo": [
        {"fa": "تاریخچهٔ لیکوییدیشن‌های واقعی، روز به روز", "ckb": "مێژووی لیکویدە ڕاستەقینەکان، ڕۆژ بە ڕۆژ", "ar": "تاريخ التصفيات الفعلية يومًا بيوم", "en": "History of real liquidations, day by day"},
        {"fa": "بیسیس فیوچرز و پریمیوم Coinbase", "ckb": "بەیسیسی فیوچەرز و پریمیۆمی Coinbase", "ar": "أساس العقود الآجلة وعلاوة Coinbase", "en": "Futures basis and the Coinbase premium"},
        {"fa": "خالص خرید و فروش تهاجمی (CVD) اسپات و فیوچرز", "ckb": "سافیی کڕین و فرۆشتنی هێرشبەرانە (CVD)ی سپۆت و فیوچەرز", "ar": "صافي الشراء والبيع العدواني (CVD) للفوري والآجل", "en": "Net taker buying (CVD), spot and futures"},
        {"fa": "عرضهٔ استیبل‌کوین‌ها در برابر ارزش بیت‌کوین (SSR)", "ckb": "خستنەڕووی ستەیبڵکۆینەکان بەرامبەر بەهای بیتکۆین (SSR)", "ar": "معروض العملات المستقرة أمام قيمة البيتكوين (SSR)", "en": "Stablecoin supply against Bitcoin's value (SSR)"},
    ],
    # what the three sites sell and no free, redistributable source publishes — named here instead of being faked
    "paid": {"fa": "با دادهٔ رایگان شدنی نیست", "ckb": "بە داتای بێبەرامبەر ناکرێت", "ar": "غير ممكن ببيانات مجانية", "en": "Not possible with free data"},
    "paid_note": {"fa": "این شاخص‌ها به پردازش تک‌تک خروجی‌های زنجیره و برچسب‌گذاری آدرس‌ها نیاز دارند و هیچ منبع رایگانی که اجازهٔ بازنشر بدهد منتشرشان نمی‌کند. به‌جای عدد ساختگی، نامشان را این‌جا نوشته‌ایم.",
                  "ckb": "ئەم پێوەرانە پێویستیان بە پرۆسێسکردنی هەموو دەرچووەکانی زنجیرە و ناسینەوەی ناونیشانەکانە و هیچ سەرچاوەیەکی بێبەرامبەر کە ڕێگە بە بڵاوکردنەوە بدات بڵاویان ناکاتەوە. لە جیاتی ژمارەی دروستکراو، ناوەکانیانمان لێرە نووسیوە.",
                  "ar": "تحتاج هذه المقاييس إلى معالجة كل مخرجات السلسلة ووسم العناوين، ولا ينشرها أي مصدر مجاني يسمح بإعادة النشر. كتبنا أسماءها هنا بدل أرقام مختلقة.",
                  "en": "These measures need every output of the chain processed and addresses labelled, and no free source that allows republishing provides them. Their names are written here instead of made-up numbers."},
    "paid_items": [
        {"fa": "SOPR و سود و زیان تحقق‌یافته", "ckb": "SOPR و قازانج و زیانی بەدیهاتوو", "ar": "SOPR والأرباح والخسائر المحقّقة", "en": "SOPR and realized profit and loss"},
        {"fa": "عرضهٔ هولدرهای بلندمدت و کوتاه‌مدت، موج‌های HODL", "ckb": "خستنەڕووی هەڵگرانی درێژخایەن و کورتخایەن، شەپۆلەکانی HODL", "ar": "معروض الحائزين طويلي وقصيري الأجل وموجات HODL", "en": "Long- and short-term holder supply, HODL waves"},
        {"fa": "روزهای نابودشدهٔ کوین (CDD) و خوابیدگی", "ckb": "ڕۆژە لەناوچووەکانی دراو (CDD) و خەوتوویی", "ar": "أيام العملة المُتلَفة (CDD) والسكون", "en": "Coin days destroyed (CDD) and dormancy"},
        {"fa": "ذخیره و جریان هر صرافی جداگانه، و جریان ماینرها", "ckb": "یەدەگ و ڕەوتی هەر ئاڵوگۆڕگەیەک بە جیا، و ڕەوتی ماینەرەکان", "ar": "احتياطي كل منصة وتدفقها على حدة، وتدفقات المعدّنين", "en": "Each exchange's own reserve and flows, and miner flows"},
    ],
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
        body += f'<h2 class="ob-hsec">{e(HUB["soon"][lg])}<small>{e(HUB["soon_note"][lg])}</small></h2><div class="ob-hub">'
        body += "".join(f'<div class="ob-hc soon"><b>{e(x[lg])}</b></div>' for x in HUB["todo"]) + "</div>"
        body += f'<h2 class="ob-hsec">{e(HUB["paid"][lg])}</h2><p class="ob-hnote">{e(HUB["paid_note"][lg])}</p><div class="ob-hub">'
        body += "".join(f'<div class="ob-hc soon"><b>{e(x[lg])}</b></div>' for x in HUB["paid_items"]) + "</div>"
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
