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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://entekhab.net"
V = "2"            # asset version (bump with any change to assets/obs/*)
LANGS = ("fa", "ckb", "ar", "en")
HUB_PATH = "charts"


def e(s):
    return html.escape(str(s), quote=True)


# view key, folder under /charts/, scripts after i18n.js and core.js
PAGES = [
    ("liqheat", "liquidation-heatmap", ["src.js", "liqmodel.js", "liq.js"]),
    ("liqmap", "liquidation-map", ["src.js", "liqmodel.js", "liq.js"]),
]

T = {
    "liqheat": {
        "title": "نقشه حرارتی لیکوییدیشن بیت‌کوین و ارزها، زنده | entekhab.net",
        "desc": "نقشهٔ حرارتی لیکوییدیشن بیت‌کوین، اتریوم و صدها ارز با دادهٔ زندهٔ Binance و Bybit: ۱۲ ساعت تا ۱ سال، سه مدل شفاف، اهرم ۵ تا ۱۰۰ و لیکوییدیشن‌های واقعی.",
        "og": "نقشهٔ حرارتی لیکوییدیشن — زنده، با مدل شفاف",
        "ld": "Entekhab liquidation heatmap",
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
}

# ---------------------------------------------------------------- the hub: /charts/
HUB = {
    "title": "رصدخانه بازار: نمودار مشتقات و آنچین کریپتو | entekhab.net",
    "desc": "رصدخانهٔ بازار انتخاب: نقشهٔ حرارتی و نقشهٔ لیکوییدیشن، مشتقات، جریان پول، ETF و داده‌های آنچین بیت‌کوین، رایگان و بدون ثبت‌نام، به چهار زبان.",
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
    ],
    "todo": [
        {"fa": "اوپن اینترست تجمیعی صرافی‌ها", "ckb": "ئۆپن ئینتەرێستی کۆکراوەی ئاڵوگۆڕگەکان", "ar": "العقود المفتوحة المجمّعة عبر المنصات", "en": "Open interest across exchanges"},
        {"fa": "نرخ فاندینگ صرافی‌ها", "ckb": "نرخی فەندینگی ئاڵوگۆڕگەکان", "ar": "معدلات التمويل عبر المنصات", "en": "Funding rates across exchanges"},
        {"fa": "نسبت لانگ به شورت", "ckb": "ڕێژەی لۆنگ بۆ شۆرت", "ar": "نسبة الشراء إلى البيع", "en": "Long/short ratios"},
        {"fa": "آپشن‌ها: اوپن اینترست، مکس پین و نوسان ضمنی", "ckb": "ئۆپشنەکان: ئۆپن ئینتەرێست، ماکس پەین و هەڵاوسانی ناوەکی", "ar": "الخيارات: العقود المفتوحة وأقصى ألم والتقلب الضمني", "en": "Options: open interest, max pain, implied volatility"},
        {"fa": "MVRV، قیمت تحقق‌یافته و NUPL", "ckb": "MVRV، نرخی بەدیهاتوو و NUPL", "ar": "MVRV والسعر المحقّق وNUPL", "en": "MVRV, realized price, NUPL"},
        {"fa": "ذخایر و جریان صرافی‌ها", "ckb": "یەدەگ و ڕەوتی ئاڵوگۆڕگەکان", "ar": "احتياطيات المنصات وتدفقاتها", "en": "Exchange reserves and flows"},
        {"fa": "شاخص‌های چرخهٔ بیت‌کوین", "ckb": "پێوەرەکانی خولی بیتکۆین", "ar": "مؤشرات دورة البيتكوين", "en": "Bitcoin cycle indicators"},
    ],
}


def spans(dct, tag="span"):
    return "".join(f'<{tag} data-lang="{lg}"{"" if lg == "fa" else " hidden"}>{e(dct[lg])}</{tag}>' for lg in LANGS)


def about(view):
    out = []
    for lg in LANGS:
        secs = T[view]["about"][lg]
        body = "".join(f"<h2>{e(h)}</h2><ul>" + "".join(f"<li>{x}</li>" for x in items) + "</ul>" for h, items in secs)
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
