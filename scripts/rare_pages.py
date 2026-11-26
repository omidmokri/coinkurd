#!/usr/bin/env python3
"""The Observatory's rare indicators: /charts/rare/ (every page with its reading of today) and /charts/rare/<page>/.

The figures are computed by scripts/obs_rare.py into data/obs/rare/<id>.json and drawn by assets/obs/rare.js; this file
holds what a reader sees around them: the page titles, the lead, and the explanation under every chart (what it shows,
how it is computed, its limits and source) in Persian, Sorani, Arabic and English.

scripts/build_obs.py calls hook() once: the index page joins its PAGES (and so the tab row), each indicator page gets its
T entry, its door and its stylesheet, the hub gets a section of cards, and folders(), catalog() and main() learn the new
pages, so the sitemap, the site's header and footer and the assistant know them with nothing else to edit."""
import json
import re

LANGS = ("fa", "ckb", "ar", "en")
SITE_TAIL = " | entekhab.net"


def L(fa, ckb, ar, en):
    return {"fa": fa, "ckb": ckb, "ar": ar, "en": en}


# ---------------------------------------------------------------- digits: Persian ۰-۹, Sorani and Arabic ٠-٩ in prose;
# a digit inside a Latin token (USDT, P2SH, bc1q, 1k) stays as it is
FA_D, AR_D = "۰۱۲۳۴۵۶۷۸۹", "٠١٢٣٤٥٦٧٨٩"
_NUM = re.compile(r"(?<![A-Za-z0-9])\d+(?:[.,]\d+)*(?![A-Za-z0-9])")


def digits(s, lg):
    if lg == "en":
        return s
    m = FA_D if lg == "fa" else AR_D
    return _NUM.sub(lambda x: x.group(0).translate(str.maketrans("0123456789", m)).replace(".", "٫"), s)


def LD(fa, ckb, ar, en):
    return {lg: digits(v, lg) for lg, v in zip(LANGS, (fa, ckb, ar, en))}


HEAD = {"fa": ("این شاخص چه نشان می‌دهد", "چطور حساب می‌شود", "محدودیت‌ها و منبع"),
        "ckb": ("ئەم پێوەرە چی پیشان دەدات", "چۆن هەژمار دەکرێت", "سنوور و سەرچاوە"),
        "ar": ("ماذا يُظهر هذا المؤشر", "كيف يُحسب", "الحدود والمصدر"),
        "en": ("What it shows", "How it is computed", "Limits and source")}
EDU = L("<b>آموزشی است، توصیهٔ مالی نیست.</b> هیچ شاخصی به‌تنهایی جهت بازار را نمی‌گوید؛ این صفحه برای دیدن و فهمیدن است، نه برای خرید و فروش.",
        "<b>فێرکارییە، ئامۆژگاریی دارایی نییە.</b> هیچ پێوەرێک بە تەنیا ئاڕاستەی بازاڕ نالێت؛ ئەم پەڕەیە بۆ بینین و تێگەیشتنە، نەک بۆ کڕین و فرۆشتن.",
        "<b>للتعلّم فقط، وليس نصيحة مالية.</b> لا يحدد أي مؤشر وحده اتجاه السوق؛ هذه الصفحة للفهم لا للبيع والشراء.",
        "<b>Educational, not financial advice.</b> No indicator tells the market's direction on its own; this page is for seeing and understanding, not for trading.")
SRC = {
    "cm": L("<b>منبع:</b> دادهٔ عمومی رایگان Coin Metrics (مجوز CC BY-NC 4.0)، روزانه؛ هر بار که روز تازه‌ای بسته شود، این صفحه هم به‌روز می‌شود.",
            "<b>سەرچاوە:</b> داتای گشتیی بێبەرامبەری Coin Metrics (مۆڵەتی CC BY-NC 4.0)، ڕۆژانە؛ هەر ڕۆژێک داخرا ئەم پەڕەیەش نوێ دەبێتەوە.",
            "<b>المصدر:</b> بيانات Coin Metrics العامة المجانية (رخصة CC BY-NC 4.0)، يوميًا؛ تتحدّث الصفحة كلما أُغلق يوم جديد.",
            "<b>Source:</b> Coin Metrics' free community data (CC BY-NC 4.0 licence), daily; the page updates whenever a new day closes."),
    "bv": L("<b>منبع:</b> bitview.space، رابط عمومی و رایگان Bitcoin Research Kit (متن‌باز، محاسبه از خود بلاک‌چین)؛ هر ۶ ساعت بررسی می‌شود و فقط روزهای بسته‌شده می‌آیند.",
            "<b>سەرچاوە:</b> bitview.space، ڕووکاری گشتی و بێبەرامبەری Bitcoin Research Kit (سەرچاوەکراوە، لە خودی بلۆکچەینەوە)؛ هەر ٦ کاتژمێر جارێک دەپشکنرێت.",
            "<b>المصدر:</b> bitview.space، الواجهة العامة المجانية لـBitcoin Research Kit (مفتوحة المصدر، محسوبة من البلوكشين نفسه)؛ تُفحص كل 6 ساعات وتأتي الأيام المغلقة فقط.",
            "<b>Source:</b> bitview.space, the free public interface of the Bitcoin Research Kit (open source, computed from the blockchain itself); checked every 6 hours, closed days only."),
    "dl": L("<b>منبع:</b> دادهٔ عمومی و رایگان DefiLlama برای عرضهٔ استیبل‌کوین‌ها، و Coin Metrics برای قیمت بیت‌کوین؛ روزانه.",
            "<b>سەرچاوە:</b> داتای گشتیی بێبەرامبەری DefiLlama بۆ دابینکراوی ستەیبڵکۆینەکان، و Coin Metrics بۆ نرخی بیتکۆین؛ ڕۆژانە.",
            "<b>المصدر:</b> بيانات DefiLlama العامة المجانية لمعروض العملات المستقرة، وCoin Metrics لسعر البيتكوين؛ يوميًا.",
            "<b>Source:</b> DefiLlama's free public stablecoin supply data, and Coin Metrics for the bitcoin price; daily."),
    "age": L("<b>منبع:</b> همان باندهای سنی صفحهٔ موج‌های HODL (bitview.space، Bitcoin Research Kit)، روزانه.",
             "<b>سەرچاوە:</b> هەمان باندە تەمەنییەکانی پەڕەی شەپۆلەکانی HODL (bitview.space، Bitcoin Research Kit)، ڕۆژانە.",
             "<b>المصدر:</b> نطاقات العمر نفسها في صفحة موجات HODL (bitview.space، Bitcoin Research Kit)، يوميًا.",
             "<b>Source:</b> the same age bands as the HODL-waves page (bitview.space, Bitcoin Research Kit), daily."),
    "fund": L("<b>منبع:</b> آرشیو عمومی ماهانهٔ Binance (data.binance.vision) برای فاندینگ BTCUSDT، تاریخچهٔ عمومی OKX برای روزهای اخیر، و جریان صرافی‌ها از Coin Metrics؛ بدون کلید و ثبت‌نام.",
              "<b>سەرچاوە:</b> ئەرشیفی گشتیی مانگانەی Binance (data.binance.vision) بۆ فاندینگی BTCUSDT، مێژووی گشتیی OKX بۆ ڕۆژانی دوایی، و ڕەوتی ئاڵوگۆڕگەکان لە Coin Metrics.",
              "<b>المصدر:</b> أرشيف Binance الشهري العام (data.binance.vision) لتمويل BTCUSDT، وسجل OKX العام للأيام الأخيرة، وتدفقات المنصات من Coin Metrics؛ دون مفاتيح أو تسجيل.",
              "<b>Source:</b> Binance's public monthly archive (data.binance.vision) for BTCUSDT funding, OKX's public history for the latest days, and exchange flows from Coin Metrics; no keys, no sign-up."),
    "gh": L("<b>منبع:</b> آمار عمومی مشارکت GitHub (۵۲ هفتهٔ اخیر هر مخزن) و قیمت هفتگی از دادهٔ عمومی بازار Binance؛ روزی یک بار.",
            "<b>سەرچاوە:</b> ئاماری گشتیی بەشداریی GitHub (٥٢ هەفتەی دوایی هەر کۆگایەک) و نرخی هەفتانە لە داتای گشتیی بازاڕی Binance؛ ڕۆژی جارێک.",
            "<b>المصدر:</b> إحصاءات المشاركة العامة في GitHub (آخر 52 أسبوعًا لكل مستودع) والسعر الأسبوعي من بيانات Binance العامة؛ مرة يوميًا.",
            "<b>Source:</b> GitHub's public participation statistics (each repository's last 52 weeks) and weekly prices from Binance's public market data; once a day."),
}

GROUPS = [
    ("money", L("جریان دلار", "ڕەوتی دۆلار", "تدفق الدولار", "Dollar flow")),
    ("age", L("سن سکه‌ها و نسل‌ها", "تەمەنی دراو و نەوەکان", "أعمار العملات وأجيالها", "Coin age and generations")),
    ("cost", L("چه کسی به چه قیمتی خریده", "کێ بە چ نرخێک کڕیویەتی", "من اشترى وبأي سعر", "Who paid what")),
    ("lev", L("اهرم، سازنده‌ها و صرافی‌ها", "لیڤەرێج، دروستکەران و ئاڵوگۆڕگەکان", "الرافعة والمطوّرون والمنصات", "Leverage, builders and exchanges")),
    ("chains", L("بین شبکه‌ها و الگوها", "نێوان تۆڕەکان و نەخشەکان", "بين الشبكات والأنماط", "Across chains, and patterns")),
]

# id, folder slug, group, source, title {4}, card line {4}, SEO title (fa), SEO description (fa), keywords, lead {4},
# explanation {lang: (shows, how, limits)}
R = []


def page(id_, slug, g, src, t, d, title, desc, kw, p, ab):
    R.append({"id": id_, "slug": slug, "g": g, "src": src, "t": t, "d": d, "title": title, "desc": desc, "kw": kw, "p": p, "ab": ab})


# ================================================================ dollar flow
page("stablevel", "stablecoin-velocity", "money", "dl",
     L("سرعت چاپ استیبل‌کوین", "خێرایی چاپی ستەیبڵکۆین", "سرعة طباعة العملات المستقرة", "Stablecoin printing speed"),
     L("پول تازه با چه سرعتی و با چه شتابی وارد کریپتو می‌شود", "پارەی نوێ بە چ خێرایی و تاوێک دێتە ناو کریپتۆ", "بأي سرعة وتسارع يدخل المال الجديد إلى الكريبتو", "How fast fresh dollars enter crypto, and whether that is speeding up"),
     "سرعت و شتاب چاپ استیبل‌کوین‌ها" + SITE_TAIL,
     "سرعت ۳۰ روزهٔ رشد عرضهٔ USDT و USDC، شتابش و روزهای پیاپی چاپ خالص؛ نشانهٔ ورود یا خروج پول تازه به کریپتو، رایگان و به چهار زبان.",
     ["استیبل کوین", "تتر", "چاپ تتر", "USDT", "USDC", "stablecoin", "stablecoin supply", "سرعت استیبل کوین"],
     L("عرضهٔ دلارهای دیجیتال با چه سرعتی بزرگ یا کوچک می‌شود، و آیا این سرعت دارد تند می‌شود یا کند",
       "دابینکراوی دۆلارە دیجیتاڵەکان بە چ خێراییەک گەورە یان بچووک دەبێت، و ئایا خێراییەکە تێژتر دەبێت یان خاوتر",
       "بأي سرعة يكبر معروض الدولارات الرقمية أو يصغر، وهل تتسارع هذه السرعة أم تتباطأ",
       "How fast the supply of digital dollars grows or shrinks, and whether that pace is speeding up or slowing down"),
     {"fa": (["هر استیبل‌کوین تازه یعنی کسی دلار واقعی سپرده و توکن گرفته تا در کریپتو خرج کند. <b>سرعت ۳۰ روزه</b> می‌گوید عرضهٔ کل در یک ماه چند درصد بزرگ شده و <b>شتاب</b> می‌گوید این سرعت نسبت به ماه قبل تندتر شده یا کندتر.",
              "<b>روزهای پیاپی چاپ خالص</b> نشان می‌دهد پول تازه چند روز پشت سر هم بی‌وقفه آمده است؛ دوره‌های طولانی چاپ معمولاً با بازارهای پرقدرت هم‌زمان بوده‌اند."],
             ["سرعت = تغییر ۳۰ روزهٔ عرضهٔ کل ÷ عرضهٔ ۳۰ روز پیش. شتاب = سرعت امروز منهای سرعت ۳۰ روز پیش. خالص ۷ روزه = تغییر عرضه در یک هفته به دلار.",
              "سرعت جداگانهٔ USDT و USDC هم کشیده شده تا معلوم شود رشد از کدام سمت است."],
             ["دادهٔ رایگانی برای ورود استیبل‌کوین <b>به خود صرافی‌ها</b> وجود ندارد؛ برای همین این صفحه چاپ و سوزاندن کل را می‌سنجد، نه جریان به صرافی‌ها را. چاپ همیشه به معنای خرید فوری نیست."]),
      "ckb": (["هەر ستەیبڵکۆینێکی نوێ واتە کەسێک دۆلاری ڕاستەقینەی داناوە بۆ ئەوەی لە کریپتۆدا خەرجی بکات. <b>خێرایی ٣٠ ڕۆژە</b> دەڵێت دابینکراوی گشتی لە مانگێکدا چەند لەسەد گەورە بووە و <b>تاو</b> دەڵێت ئەم خێراییە تێژتر بووە یان خاوتر.",
               "<b>ڕۆژە یەک لە دوای یەکەکانی چاپی پوختە</b> پیشان دەدات پارەی نوێ چەند ڕۆژ بەبێ وەستان هاتووە."],
              ["خێرایی = گۆڕانی ٣٠ ڕۆژەی دابینکراوی گشتی ÷ دابینکراوی ٣٠ ڕۆژ لەمەوبەر. تاو = خێرایی ئەمڕۆ کەم خێرایی ٣٠ ڕۆژ لەمەوبەر.",
               "خێرایی USDT و USDC بە جیا کێشراوە بۆ ئەوەی دەربکەوێت گەشەکە لە کام لاوەیە."],
              ["داتای بێبەرامبەر بۆ چوونی ستەیبڵکۆین <b>بۆ ناو ئاڵوگۆڕگەکان</b> نییە؛ بۆیە ئەم پەڕەیە چاپ و سووتاندنی گشتی دەپێوێت. چاپ هەمیشە واتای کڕینی خێرا نییە."]),
      "ar": (["كل عملة مستقرة جديدة تعني أن أحدًا أودع دولارًا حقيقيًا ليستخدمه في الكريبتو. <b>سرعة 30 يومًا</b> تقول بكم في المئة كبر المعروض الكلي خلال شهر، و<b>التسارع</b> يقول هل صارت هذه السرعة أعلى أم أدنى من الشهر السابق.",
              "<b>أيام الطباعة الصافية المتتالية</b> تبيّن كم يومًا دخل المال الجديد دون انقطاع؛ تزامنت فترات الطباعة الطويلة عادةً مع أسواق قوية."],
             ["السرعة = تغير المعروض الكلي في 30 يومًا ÷ المعروض قبل 30 يومًا. التسارع = سرعة اليوم ناقص سرعة ما قبل 30 يومًا. الصافي الأسبوعي = تغير المعروض بالدولار في أسبوع.",
              "رُسمت سرعة USDT وUSDC كلٌّ على حدة ليظهر مصدر النمو."],
             ["لا توجد بيانات مجانية لتدفق العملات المستقرة <b>إلى المنصات نفسها</b>؛ لذا تقيس الصفحة الطباعة والحرق الكليين لا التدفق إلى المنصات. الطباعة لا تعني دائمًا شراءً فوريًا."]),
      "en": (["Every new stablecoin means someone deposited real dollars to use them in crypto. <b>30-day speed</b> says by what percentage total supply grew in a month; <b>acceleration</b> says whether that speed is higher or lower than a month earlier.",
              "<b>Days of net printing in a row</b> shows how long fresh money has arrived without a break; long printing runs have tended to coincide with strong markets."],
             ["Speed = the 30-day change in total supply ÷ supply 30 days earlier. Acceleration = today's speed minus the speed 30 days earlier. Weekly net = the change in supply over a week, in dollars.",
              "USDT's and USDC's own speeds are drawn too, so you can see which side the growth comes from."],
             ["There is no free data on stablecoins flowing <b>onto exchanges themselves</b>, so this page measures total printing and burning, not exchange inflows. Printing does not always mean immediate buying."])})

page("stablerot", "usdt-vs-usdc", "money", "dl",
     L("تتر در برابر USDC", "تێتەر بەرامبەر USDC", "تيثر مقابل USDC", "Tether against USDC"),
     L("دلار آسیا و بازارهای نوظهور در برابر دلار تنظیم‌شدهٔ آمریکا", "دۆلاری ئاسیا و بازاڕە نوێکان بەرامبەر دۆلاری ڕێکخراوی ئەمریکا", "دولار آسيا والأسواق الناشئة مقابل الدولار الأمريكي المنظَّم", "The offshore dollar against the regulated US one"),
     "سهم تتر در برابر USDC؛ چرخش دلار کریپتو" + SITE_TAIL,
     "سهم USDT از مجموع USDT و USDC و تغییر ۹۰ روزه‌اش: نشان می‌دهد پول تازهٔ کریپتو بیشتر از آسیا و بازارهای نوظهور می‌آید یا از آمریکا.",
     ["تتر", "USDT", "USDC", "سهم تتر", "tether dominance", "usdt vs usdc"],
     L("پول تازهٔ کریپتو بیشتر از کدام دنیا می‌آید: دلار برون‌مرزی تتر یا دلار تنظیم‌شدهٔ USDC",
       "پارەی نوێی کریپتۆ زیاتر لە کام جیهانەوە دێت: دۆلاری دەرەوەی سنووری تێتەر یان دۆلاری ڕێکخراوی USDC",
       "من أي عالم يأتي مال الكريبتو الجديد أكثر: دولار تيثر العابر للحدود أم دولار USDC المنظَّم",
       "Which world fresh crypto money comes from: Tether's offshore dollar or USDC's regulated one"),
     {"fa": (["تتر (USDT) بیشتر در صرافی‌های آسیایی، ترکیه، آمریکای لاتین و بازارهای نوظهور استفاده می‌شود؛ USDC بیشتر در آمریکا و نزد نهادهای تنظیم‌شده. <b>سهم تتر</b> از مجموع این دو، جغرافیای پول تازه را نشان می‌دهد.",
              "<b>تغییر ۹۰ روزه</b> (به واحد درصد) می‌گوید این تعادل در سه ماه اخیر به کدام سمت چرخیده است."],
             ["سهم = عرضهٔ USDT ÷ (عرضهٔ USDT + عرضهٔ USDC) × ۱۰۰. تغییر = سهم امروز منهای سهم ۹۰ روز پیش."],
             ["عرضه محل استفاده را مستقیم نمی‌گوید؛ این یک برداشت تقریبی از الگوی شناخته‌شدهٔ استفاده است. استیبل‌کوین‌های دیگر (DAI، USDe و…) در این نسبت نیستند."]),
      "ckb": (["تێتەر (USDT) زیاتر لە ئاڵوگۆڕگەکانی ئاسیا، تورکیا، ئەمریکای لاتین و بازاڕە نوێکاندا بەکار دێت؛ USDC زیاتر لە ئەمریکا و لای دامەزراوە ڕێکخراوەکان. <b>بەشی تێتەر</b> جوگرافیای پارەی نوێ پیشان دەدات.",
               "<b>گۆڕانی ٩٠ ڕۆژە</b> دەڵێت ئەم هاوسەنگییە لە سێ مانگی ڕابردوودا بەرەو کام لا سوڕاوەتەوە."],
              ["بەش = دابینکراوی USDT ÷ (USDT + USDC) × ١٠٠. گۆڕان = بەشی ئەمڕۆ کەم بەشی ٩٠ ڕۆژ لەمەوبەر."],
              ["دابینکراو شوێنی بەکارهێنان ڕاستەوخۆ ناڵێت؛ ئەمە خوێندنەوەیەکی نزیکەییە. ستەیبڵکۆینەکانی تر لەم ڕێژەیەدا نین."]),
      "ar": (["يُستخدم تيثر (USDT) أكثر في المنصات الآسيوية وتركيا وأمريكا اللاتينية والأسواق الناشئة، وUSDC أكثر في الولايات المتحدة ولدى المؤسسات المنظَّمة. <b>حصة تيثر</b> من مجموعهما تكشف جغرافيا المال الجديد.",
              "<b>تغير 90 يومًا</b> (بنقاط مئوية) يقول إلى أي جهة مال هذا التوازن خلال ثلاثة أشهر."],
             ["الحصة = معروض USDT ÷ (معروض USDT + معروض USDC) × 100. التغير = حصة اليوم ناقص الحصة قبل 90 يومًا."],
             ["المعروض لا يحدد مكان الاستخدام مباشرة؛ هذه قراءة تقريبية لنمط استخدام معروف. العملات المستقرة الأخرى (DAI وUSDe وغيرها) ليست في النسبة."]),
      "en": (["Tether (USDT) is used mostly on Asian exchanges, in Turkey, Latin America and emerging markets; USDC mostly in the US and by regulated institutions. <b>Tether's share</b> of the two shows the geography of fresh money.",
              "<b>The 90-day change</b> (in percentage points) shows which way that balance has turned over three months."],
             ["Share = USDT supply ÷ (USDT supply + USDC supply) × 100. Change = today's share minus the share 90 days earlier."],
             ["Supply does not say directly where coins are used; this is an approximate reading of a well-known usage pattern. Other stablecoins (DAI, USDe and so on) are not in the ratio."])})

page("leadlag", "stablecoin-lead", "money", "dl",
     L("استیبل‌کوین چند روز جلوتر است؟", "ستەیبڵکۆین چەند ڕۆژ لە پێشترە؟", "كم يومًا تسبق العملات المستقرة؟", "How many days do stablecoins lead?"),
     L("تأخیری که رشد استیبل‌کوین‌ها بیشترین هم‌خوانی را با بازده بیت‌کوین داشته", "ئەو دواکەوتنەی گەشەی ستەیبڵکۆین زۆرترین گونجانی لەگەڵ قازانجی بیتکۆین هەبووە", "التأخير الذي توافق فيه نمو العملات المستقرة أكثر مع عائد البيتكوين", "The delay at which stablecoin growth matched bitcoin's return best"),
     "تأخیر استیبل‌کوین نسبت به بیت‌کوین" + SITE_TAIL,
     "در هر سال گذشته، رشد استیبل‌کوین‌ها با چند روز تأخیر بیشترین هم‌بستگی را با بازده بیت‌کوین داشته؟ شاخص پیشرو یا پیرو، رایگان.",
     ["استیبل کوین", "همبستگی", "شاخص پیشرو", "lead lag", "stablecoin bitcoin correlation"],
     L("آیا پول تازه پیش از قیمت می‌آید؟ در هر یک سال، بهترین تأخیر بین رشد استیبل‌کوین‌ها و بازده بیت‌کوین",
       "ئایا پارەی نوێ پێش نرخ دێت؟ لە هەر ساڵێکدا باشترین دواکەوتن لە نێوان گەشەی ستەیبڵکۆین و قازانجی بیتکۆین",
       "هل يأتي المال الجديد قبل السعر؟ أفضل تأخير بين نمو العملات المستقرة وعائد البيتكوين في كل عام",
       "Does fresh money come before price? The best delay between stablecoin growth and bitcoin's return, year by year"),
     {"fa": (["<b>تأخیر بهینه</b>: اگر عدد ۲۰ باشد یعنی در یک سال گذشته، رشد ۳۰ روزهٔ استیبل‌کوین‌ها با بازده ۳۰ روزهٔ بیت‌کوینِ ۲۰ روز بعد بیشترین هم‌خوانی را داشته؛ یعنی پول تازه حدود ۲۰ روز جلوتر بوده.",
              "<b>هم‌بستگی</b> همان رابطه را از ۱- تا ۱ نشان می‌دهد؛ نزدیک صفر یعنی رابطه‌ای در کار نبوده."],
             ["برای هر هفته، ۳۶۵ روز قبل از آن جدا می‌شود و برای هر تأخیر ۰ تا ۹۰ روز، هم‌بستگی پیرسون بین رشد ۳۰ روزهٔ عرضهٔ استیبل‌کوین امروز و بازده ۳۰ روزهٔ بیت‌کوینِ آن تعداد روز بعد حساب می‌شود؛ بهترین تأخیر نمایش داده می‌شود."],
             ["این یک رابطهٔ گذشته است، نه قانون. هم‌بستگی علیت نیست و تأخیر بهینه از سالی به سال دیگر جابه‌جا می‌شود؛ وقتی عدد مدام عوض می‌شود یعنی رابطه ضعیف است."]),
      "ckb": (["<b>باشترین دواکەوتن</b>: ئەگەر ژمارەکە ٢٠ بێت واتە لە ساڵی ڕابردوودا گەشەی ٣٠ ڕۆژەی ستەیبڵکۆین زۆرترین گونجانی لەگەڵ قازانجی بیتکۆینی ٢٠ ڕۆژ دواتر هەبووە.",
               "<b>هاوپەیوەندی</b> هەمان پەیوەندی لە ١- تا ١ پیشان دەدات؛ نزیکی سفر واتە پەیوەندی نەبووە."],
              ["بۆ هەر هەفتەیەک، ٣٦٥ ڕۆژی پێشتر جیا دەکرێتەوە و بۆ هەر دواکەوتنێکی ٠ تا ٩٠ ڕۆژ هاوپەیوەندیی پیرسن هەژمار دەکرێت؛ باشترینیان پیشان دەدرێت."],
              ["ئەمە پەیوەندییەکی ڕابردووە نەک یاسا. هاوپەیوەندی هۆکار نییە و دواکەوتنی باشترین لە ساڵێکەوە بۆ ساڵێکی تر دەگۆڕێت."]),
      "ar": (["<b>التأخير الأمثل</b>: إن كان 20 فمعناه أن نمو العملات المستقرة في 30 يومًا توافق خلال العام الماضي أكثر ما توافق مع عائد البيتكوين في 30 يومًا بعد 20 يومًا؛ أي أن المال الجديد سبق بنحو 20 يومًا.",
              "<b>الارتباط</b> يبيّن العلاقة نفسها من -1 إلى 1؛ قربه من الصفر يعني غياب العلاقة."],
             ["لكل أسبوع تُؤخذ 365 يومًا قبله، ولكل تأخير من 0 إلى 90 يومًا يُحسب ارتباط بيرسون بين نمو معروض العملات المستقرة في 30 يومًا اليوم وعائد البيتكوين في 30 يومًا بعد ذلك التأخير؛ ويُعرض أفضل تأخير."],
             ["هذه علاقة ماضية لا قانون. الارتباط ليس سببية، والتأخير الأمثل يتنقل من سنة إلى أخرى؛ وتقلّبه الدائم علامة على ضعف العلاقة."]),
      "en": (["<b>Best lag</b>: 20 means that over the past year, 30-day stablecoin growth matched bitcoin's 30-day return 20 days later better than at any other delay: fresh money ran about 20 days ahead.",
              "<b>Correlation</b> shows the strength of that relation from -1 to 1; near zero means there was none."],
             ["For each week, the 365 days before it are taken, and for every lag from 0 to 90 days the Pearson correlation between today's 30-day stablecoin supply growth and bitcoin's 30-day return that many days later is computed; the best lag is shown."],
             ["A past relation, not a law. Correlation is not causation, and the best lag moves from year to year; a number that keeps jumping means the relation is weak."])})

# ================================================================ coin age and generations
page("vintage", "vintage-spending", "age", "bv",
     L("کدام نسل سکه‌ها خرج می‌شود", "کام نەوەی دراو خەرج دەکرێت", "أي جيل من العملات يُنفق", "Which coin vintages are spent"),
     L("کوین‌روزهای سوخته به تفکیک سالی که سکه ساخته شده", "کۆین‌ڕۆژە سووتاوەکان بەپێی ساڵی دروستبوونی دراو", "أيام العملة المستهلكة حسب سنة إنشاء العملة", "Coin-days destroyed by the year the coins were created"),
     "خرج سکه‌ها بر اساس سال ساخت؛ نهنگ‌های قدیمی" + SITE_TAIL,
     "سهم هر نسل از بیت‌کوین‌ها (۲۰۰۹ تا امروز) در کوین‌روزهای سوختهٔ ۳۰ روز اخیر: وقتی پول‌های خیلی قدیمی جابه‌جا می‌شوند معلوم می‌شود.",
     ["کوین دیز دستروید", "CDD", "نهنگ قدیمی", "سکه قدیمی", "coin days destroyed", "vintage", "old whales"],
     L("وقتی سکه‌ای بعد از سال‌ها جابه‌جا می‌شود، از کدام دوره است؟ ۲۰۰۹ تا ۲۰۱۲، ۲۰۱۷، ۲۰۲۱ یا تازه‌واردها",
       "کاتێک دراوێک دوای ساڵانێک دەجووڵێت، لە کام سەردەمەوەیە؟ ٢٠٠٩ تا ٢٠١٢، ٢٠١٧، ٢٠٢١ یان تازەهاتووەکان",
       "حين تتحرك عملة بعد سنوات، من أي حقبة هي؟ 2009–2012 أم 2017 أم 2021 أم القادمون الجدد",
       "When a coin moves after years, which era is it from? 2009–2012, 2017, 2021, or newcomers"),
     {"fa": (["هر بیت‌کوین هنگام خرج شدن «کوین‌روز» می‌سوزاند: تعداد سکه × روزهایی که دست‌نخورده مانده. این نمودار می‌گوید در ۳۰ روز اخیر چه سهمی از این کوین‌روزها را سکه‌های هر دوره سوزانده‌اند.",
              "سهم بالای <b>سکه‌های پیش از ۲۰۱۷</b> یعنی پول‌های بسیار قدیمی (معدنچیان اولیه، نهنگ‌های قدیمی) بیدار شده‌اند؛ چنین موج‌هایی معمولاً در اوج‌ها یا رویدادهای خاص دیده شده‌اند."],
             ["برای هر سال ساخت (۲۰۰۹ تا امروز) کوین‌روزهای سوختهٔ روزانهٔ همان نسل گرفته می‌شود، در پنج دوره جمع و جمع ۳۰ روزه‌اش بر کل کوین‌روزهای سوختهٔ ۳۰ روز تقسیم می‌شود. سهم دارندگان بلندمدت (بیش از ۱۵۵ روز) هم جدا کشیده شده.",
              "جدول «پرخرج‌ترین سال» سهم هر سال ساخت را در ۳۰ روز اخیر نشان می‌دهد."],
             ["جابه‌جایی همیشه فروش نیست: انتقال به کیف جدید، صندوق ETF یا امانت‌دار هم کوین‌روز می‌سوزاند. یک تراکنش بزرگ می‌تواند ماه را پررنگ کند."]),
      "ckb": (["هەر بیتکۆینێک کاتی خەرجکردن «کۆین‌ڕۆژ» دەسووتێنێت: ژمارەی دراو × ئەو ڕۆژانەی دەستی لێ نەدراوە. ئەم چارتە دەڵێت لە ٣٠ ڕۆژی ڕابردوودا دراوەکانی هەر سەردەمێک چ بەشێکیان سووتاندووە.",
               "بەشی زۆری <b>دراوەکانی پێش ٢٠١٧</b> واتە پارە زۆر کۆنەکان بێدار بوونەتەوە؛ ئەم شەپۆلانە زۆرجار لە لووتکەکاندا بینراون."],
              ["بۆ هەر ساڵێکی دروستبوون کۆین‌ڕۆژە سووتاوە ڕۆژانەکانی ئەو نەوەیە وەردەگیرێت، لە پێنج سەردەم کۆ دەکرێتەوە و کۆی ٣٠ ڕۆژەکەی دابەشی کۆی گشتی دەکرێت. بەشی خاوەنە درێژخایەنەکانیش جیا کێشراوە."],
              ["جووڵان هەمیشە فرۆشتن نییە: گواستنەوە بۆ جزدانی نوێ یان ETF یان پارێزەر هەمان کار دەکات. یەک مامەڵەی گەورە دەتوانێت مانگێک ڕەنگین بکات."]),
      "ar": (["كل بيتكوين يحرق عند إنفاقه «أيام عملة»: عدد العملات × الأيام التي بقيت فيها دون حركة. يبيّن الرسم أي حصة من هذه الأيام أحرقتها عملات كل حقبة خلال 30 يومًا.",
              "ارتفاع حصة <b>عملات ما قبل 2017</b> يعني استيقاظ أموال قديمة جدًا (المعدّنون الأوائل والحيتان القديمة)؛ ظهرت هذه الموجات عادةً قرب القمم أو أحداث خاصة."],
             ["لكل سنة إنشاء (2009 حتى اليوم) تُؤخذ أيام العملة المستهلكة اليومية لذلك الجيل، وتُجمع في خمس حقب، ويُقسم مجموعها في 30 يومًا على مجموع الأيام المستهلكة كلها. ورُسمت حصة الحائزين طويلي الأجل (أكثر من 155 يومًا) منفصلة.",
              "جدول «السنة الأكثر إنفاقًا» يعرض حصة كل سنة إنشاء في آخر 30 يومًا."],
             ["الحركة ليست بيعًا دائمًا: النقل إلى محفظة جديدة أو صندوق ETF أو أمين حفظ يحرق أيام عملة أيضًا. وصفقة كبيرة واحدة قد تلوّن شهرًا كاملًا."]),
      "en": (["Every bitcoin spent destroys coin-days: the number of coins × the days they sat untouched. The chart shows what share of the last 30 days' coin-days destroyed came from the coins of each era.",
              "A high share of <b>pre-2017 coins</b> means very old money (early miners, old whales) has woken up; such waves have tended to show near tops or special events."],
             ["For each creation year (2009 to today), that vintage's daily coin-days destroyed is taken, summed into five eras, and its 30-day total divided by the 30-day total of all coin-days destroyed. Long-term holders' share (coins older than 155 days) is drawn separately.",
              "The most-spent vintage tile gives each creation year's share of the last 30 days."],
             ["Moving is not always selling: a transfer to a new wallet, an ETF or a custodian destroys coin-days too. One big transaction can colour a whole month."])})

page("vintprofit", "vintage-profit", "age", "bv",
     L("سود و زیان هر نسل خریدار", "قازانج و زیانی هەر نەوەیەکی کڕیار", "ربح وخسارة كل جيل من المشترين", "Each vintage's paper profit"),
     L("خریداران هر سال الان چند درصد در سود یا زیان‌اند", "کڕیارانی هەر ساڵێک ئێستا چەند لەسەد لە قازانج یان زیاندان", "كم في المئة ربح أو خسارة مشتري كل عام الآن", "How far each year's buyers are in profit or loss right now"),
     "سود و زیان خریداران بیت‌کوین به تفکیک سال" + SITE_TAIL,
     "بهای تمام‌شدهٔ سکه‌هایی که در هر سال (۲۰۱۱ تا امروز) آخرین بار جابه‌جا شده‌اند و فاصلهٔ قیمت امروز از آن: کدام نسل در زیان است.",
     ["بهای تمام شده", "realized price", "سود و زیان", "vintage", "cohort"],
     L("بهای تمام‌شدهٔ هر نسل خریدار و فاصلهٔ قیمت امروز از آن؛ کدام سال‌ها زیر آب‌اند",
       "تێچووی هەر نەوەیەکی کڕیار و دووریی نرخی ئەمڕۆ لێی؛ کام ساڵ لە ژێر ئاودان",
       "كلفة كل جيل من المشترين وبُعد سعر اليوم عنها؛ أي السنوات تحت الماء",
       "Each buyer generation's cost basis and how far today's price is from it; which years are under water"),
     {"fa": (["هر خط یک «نسل» است: سکه‌هایی که آخرین بار در آن سال جابه‌جا شده‌اند (نه لزوماً خریده‌شده). عدد مثبت یعنی این گروه به‌طور میانگین در سود است و منفی یعنی زیر بهای خریدشان‌اند.",
              "نسل‌هایی که نزدیک صفر (سربه‌سر) هستند اغلب حساس‌ترین‌اند: بعضی‌ها وقتی به پول خودشان برمی‌گردند می‌فروشند."],
             ["برای هر سال، قیمت تحقق‌یافتهٔ همان نسل (میانگین قیمت آخرین جابه‌جایی سکه‌هایش) از Bitcoin Research Kit گرفته می‌شود؛ سود کاغذی = قیمت ÷ آن بها - ۱."],
             ["«آخرین جابه‌جایی» با خرید یکی نیست: انتقال میان کیف‌های خود شخص هم سکه را به نسل جدید می‌برد. سکه‌های صرافی‌ها هم داخل این حساب‌اند."]),
      "ckb": (["هەر هێڵێک «نەوەیەکە»: ئەو دراوانەی دوایین جار لەو ساڵەدا جووڵاون. ژمارەی پۆزەتیڤ واتە ئەم گرووپە بە ناوەندی لە قازانجدایە و نێگەتیڤ واتە لە خوار نرخی کڕینیانن.",
               "نەوە نزیکەکانی سفر هەستیارترینن: هەندێک کاتێک دەگەنەوە پارەی خۆیان دەفرۆشن."],
              ["بۆ هەر ساڵێک نرخی بەدیهاتووی ئەو نەوەیە لە Bitcoin Research Kit وەردەگیرێت؛ قازانجی کاغەزی = نرخ ÷ ئەو تێچووە - ١."],
              ["«دوایین جووڵە» وەک کڕین نییە: گواستنەوە لە نێوان جزدانەکانی خۆی دراوەکە دەبات بۆ نەوەیەکی نوێ."]),
      "ar": (["كل خط «جيل»: العملات التي تحرّكت آخر مرة في ذلك العام (لا بالضرورة شُريت). الرقم الموجب يعني أن الفئة في ربح في المتوسط، والسالب أنها تحت سعر شرائها.",
              "الأجيال القريبة من الصفر (التعادل) غالبًا الأكثر حساسية: يبيع بعضهم حين يستعيد ماله."],
             ["لكل سنة يُؤخذ السعر المحقق لذلك الجيل (متوسط سعر آخر حركة لعملاته) من Bitcoin Research Kit؛ الربح الورقي = السعر ÷ تلك الكلفة - 1."],
             ["«آخر حركة» ليست الشراء نفسه: النقل بين محافظ الشخص نفسه ينقل العملة إلى جيل جديد أيضًا. وعملات المنصات داخلة في الحساب."]),
      "en": (["Each line is a vintage: the coins that last moved in that year (not necessarily bought). Positive means the group is in profit on average; negative means it sits below what it paid.",
              "Vintages near zero (break-even) are often the most sensitive: some sell once they get their money back."],
             ["For each year, that vintage's realized price (the average price at which its coins last moved) is taken from the Bitcoin Research Kit; paper profit = price ÷ that cost - 1."],
             ["The last move is not the same as a purchase: a transfer between one person's own wallets also puts a coin into a new vintage. Exchanges' coins are inside the count too."])})

page("entropy", "coin-age-entropy", "age", "age",
     L("آنتروپی سن سکه‌ها", "ئەنترۆپیی تەمەنی دراو", "إنتروبيا أعمار العملات", "Coin-age entropy"),
     L("مالکیت بیت‌کوین بین نسل‌ها پخش است یا در یک گروه جمع شده", "خاوەندارێتیی بیتکۆین لە نێوان نەوەکاندا بڵاوە یان لە یەک گرووپدا کۆ بووەتەوە", "هل ملكية البيتكوين موزعة بين الأجيال أم متجمعة في فئة واحدة", "Whether bitcoin ownership is spread across generations or bunched in one"),
     "آنتروپی سن سکه‌های بیت‌کوین" + SITE_TAIL,
     "تنوع سن بیت‌کوین‌ها در یک عدد از ۰ تا ۱، از باندهای موج HODL: وقتی مالکیت بین نسل‌ها پخش یا در یک گروه جمع می‌شود.",
     ["آنتروپی", "موج HODL", "سن سکه", "entropy", "hodl waves", "coin age"],
     L("موج‌های HODL در یک عدد: سن سکه‌ها چقدر متنوع است", "شەپۆلەکانی HODL لە یەک ژمارەدا: تەمەنی دراوەکان چەند جۆراوجۆرە",
       "موجات HODL في رقم واحد: ما مدى تنوع أعمار العملات", "The HODL waves in one number: how diverse coin ages are"),
     {"fa": (["عدد ۱ یعنی سکه‌ها به‌طور مساوی در همهٔ ۱۳ گروه سنی (یک روز تا بیش از ده سال) پخش‌اند؛ هرچه کمتر، بخش بزرگ‌تری در یک گروه سنی جمع شده.",
              "افزایش آنتروپی معمولاً یعنی سکه‌ها دست‌به‌دست شده و نسل‌های تازه کنار قدیمی‌ها نشسته‌اند (اغلب پس از اوج‌ها)؛ کاهشش یعنی یک گروه سنی یک‌دست بزرگ شده (اغلب در انباشت طولانی)."],
             ["آنتروپی شانون سهم ۱۳ باند سنی موج HODL، تقسیم بر لگاریتم ۱۳ تا بین ۰ و ۱ بماند: H = -Σ p·ln(p) ÷ ln(13). تغییر ۹۰ روزه هم جدا آمده."],
             ["این یک شاخص ابداعی و تجربی است، نه استاندارد صنعت؛ معنایش را با قیمت و موج‌های HODL کنار هم بخوانید. سکه‌های گم‌شده در گروه‌های قدیمی می‌مانند و عدد را کمی بالا نگه می‌دارند."]),
      "ckb": (["ژمارە ١ واتە دراوەکان بە یەکسانی لە هەموو ١٣ گرووپی تەمەنیدا بڵاون؛ تا کەمتر بێت، بەشێکی گەورەتر لە یەک گرووپدا کۆ بووەتەوە.",
               "زیادبوونی ئەنترۆپی زۆرجار واتە دراوەکان دەستاودەست کراون؛ کەمبوونەوەی واتە گرووپێکی تەمەنی گەورە بووە (کۆکردنەوەی درێژ)."],
              ["ئەنترۆپیی شانۆن بۆ بەشی ١٣ باندی تەمەنی، دابەش بە لۆگاریتمی ١٣: H = -Σ p·ln(p) ÷ ln(13)."],
              ["ئەمە پێوەرێکی داهێنراو و تاقیکارییە نەک ستانداردی پیشەسازی. دراوە ونبووەکان لە گرووپە کۆنەکاندا دەمێننەوە."]),
      "ar": (["الرقم 1 يعني أن العملات موزعة بالتساوي على كل فئات العمر الـ13 (من يوم إلى أكثر من عشر سنوات)؛ وكلما قلّ تجمّع جزء أكبر في فئة واحدة.",
              "ارتفاع الإنتروبيا يعني عادةً أن العملات تبادلت الأيدي وجلست أجيال جديدة قرب القديمة (غالبًا بعد القمم)؛ وانخفاضها يعني أن فئة عمرية واحدة كبرت (غالبًا في تراكم طويل)."],
             ["إنتروبيا شانون لحصص نطاقات موجات HODL الـ13 مقسومة على لوغاريتم 13 لتبقى بين 0 و1: H = -Σ p·ln(p) ÷ ln(13). والتغير في 90 يومًا مرسوم منفصلًا."],
             ["مؤشر مبتكر وتجريبي وليس معيارًا في الصناعة؛ اقرأه مع السعر وموجات HODL. العملات المفقودة تبقى في الفئات القديمة وترفع الرقم قليلًا."]),
      "en": (["1 means coins are spread evenly over all 13 age bands (a day to more than ten years); the lower it is, the more of the supply is bunched in one age group.",
              "Rising entropy usually means coins changed hands and new generations sit beside old ones (often after tops); falling entropy means one age group grew uniform (often in long accumulation)."],
             ["The Shannon entropy of the 13 HODL-wave band shares, divided by ln 13 to stay between 0 and 1: H = -Σ p·ln(p) ÷ ln(13). The 90-day change is drawn separately."],
             ["An original, experimental measure, not an industry standard; read it beside the price and the HODL waves. Lost coins stay in the oldest bands and hold the number slightly up."])})

page("ageing", "ageing-speed", "age", "age",
     L("سرعت پیر شدن بیت‌کوین", "خێرایی پیربوونی بیتکۆین", "سرعة شيخوخة البيتكوين", "Bitcoin's ageing speed"),
     L("کل عرضه هر روز چند روز پیر می‌شود؛ ۱ یعنی هیچ‌کس سکهٔ قدیمی خرج نمی‌کند", "هەموو دابینکراو ڕۆژانە چەند ڕۆژ پیر دەبێت؛ ١ واتە کەس دراوی کۆن خەرج ناکات", "كم يومًا يشيخ المعروض كل يوم؛ 1 يعني أن أحدًا لا ينفق العملات القديمة", "How many days the supply ages each day; 1 means nobody spends old coins"),
     "سرعت پیر شدن بیت‌کوین؛ انباشت یا توزیع" + SITE_TAIL,
     "سن میانگین تقریبی بیت‌کوین‌ها و سرعت تغییرش در ۳۰ روز: نزدیک ۱ یعنی انباشت، پایین یا منفی یعنی سکه‌های قدیمی خرج می‌شوند.",
     ["سن سکه", "انباشت", "توزیع", "hodl", "coin age", "accumulation"],
     L("اگر هیچ‌کس سکه‌ای خرج نکند، کل عرضه روزی یک روز پیر می‌شود؛ فاصله از ۱ می‌گوید چقدر سکهٔ قدیمی دارد خرج می‌شود",
       "ئەگەر کەس دراو خەرج نەکات، هەموو دابینکراو ڕۆژی یەک ڕۆژ پیر دەبێت؛ دووری لە ١ دەڵێت چەند دراوی کۆن خەرج دەکرێت",
       "لو لم ينفق أحد شيئًا لشاخ المعروض يومًا كل يوم؛ البعد عن 1 يقول كم من العملات القديمة يُنفق",
       "If nobody spent anything, the supply would age one day per day; the distance from 1 shows how much old money is being spent"),
     {"fa": (["<b>سن میانگین</b>: به‌طور میانگین هر بیت‌کوین چند سال است که جابه‌جا نشده. <b>سرعت پیر شدن</b>: این سن در ۳۰ روز اخیر روزی چند روز بالا رفته.",
              "نزدیک ۱ یعنی تقریباً همه نگه می‌دارند (انباشت)؛ زیر ۰٫۵ یا منفی یعنی سکه‌های قدیمی به بازار برمی‌گردند (معمولاً در رالی‌ها و اوج‌ها)."],
             ["سن هر باند موج HODL با میانهٔ بازه‌اش تقریب زده می‌شود (مثلاً ۳ تا ۶ ماه ≈ ۱۳۵ روز، بیش از ۱۰ سال ≈ ۴۶۰۰ روز)، میانگین وزنی با سهم باندها گرفته می‌شود و تغییر ۳۰ روزه‌اش ÷ ۳۰ می‌شود سرعت."],
             ["سن واقعی هر سکه در دسترس نیست و این تقریب از باندهاست؛ عدد دقیق نیست ولی جهتش قابل اعتماد است. سکه‌های تازه استخراج‌شده هم کمی سن میانگین را پایین می‌کشند."]),
      "ckb": (["<b>تەمەنی ناوەندی</b>: بە ناوەندی هەر بیتکۆینێک چەند ساڵە نەجووڵاوە. <b>خێرایی پیربوون</b>: ئەم تەمەنە لە ٣٠ ڕۆژدا ڕۆژی چەند ڕۆژ زیادی کردووە.",
               "نزیکی ١ واتە نزیکەی هەموو هەڵیدەگرن (کۆکردنەوە)؛ خوار ٠٫٥ یان نێگەتیڤ واتە دراوە کۆنەکان دەگەڕێنەوە بازاڕ."],
              ["تەمەنی هەر باندێک بە ناوەڕاستی مەوداکەی نزیک دەکرێتەوە، ناوەندی کێشراو بە بەشی باندەکان وەردەگیرێت و گۆڕانی ٣٠ ڕۆژەکەی ÷ ٣٠ دەبێتە خێرایی."],
              ["تەمەنی ڕاستەقینەی هەر دراوێک بەردەست نییە و ئەمە نزیکەییە لە باندەکانەوە؛ ژمارەکە ورد نییە بەڵام ئاڕاستەکەی متمانەپێکراوە."]),
      "ar": (["<b>متوسط العمر</b>: كم سنة لم يتحرك كل بيتكوين في المتوسط. <b>سرعة الشيخوخة</b>: بكم يوم ارتفع هذا العمر يوميًا خلال 30 يومًا.",
              "قربه من 1 يعني أن الجميع تقريبًا يحتفظون (تراكم)؛ تحت 0.5 أو سالبًا يعني عودة العملات القديمة إلى السوق (عادةً في الارتفاعات والقمم)."],
             ["يُقرَّب عمر كل نطاق في موجات HODL بمنتصف مداه (مثلًا 3–6 أشهر ≈ 135 يومًا، أكثر من 10 سنوات ≈ 4600 يوم)، ويُؤخذ المتوسط الموزون بحصص النطاقات، وتغيره في 30 يومًا ÷ 30 هو السرعة."],
             ["العمر الحقيقي لكل عملة غير متاح وهذا تقريب من النطاقات؛ الرقم غير دقيق لكن اتجاهه موثوق. والعملات المعدّنة حديثًا تخفض المتوسط قليلًا."]),
      "en": (["<b>Mean age</b>: on average, how many years each bitcoin has gone without moving. <b>Ageing speed</b>: how many days that age rose per day over the last 30 days.",
              "Near 1 means almost everyone holds (accumulation); below 0.5 or negative means old coins are returning to the market (typically in rallies and tops)."],
             ["Each HODL-wave band's age is approximated by the middle of its range (3–6 months ≈ 135 days, over 10 years ≈ 4,600 days), the mean is weighted by band shares, and its 30-day change ÷ 30 is the speed."],
             ["No coin's true age is available here; this is an approximation from the bands. The number is not exact but its direction is reliable. Newly mined coins also pull the mean age slightly down."])})

page("cointime", "cointime-corridor", "age", "bv",
     L("راهروی زمان‌سکه", "ڕاڕەوی کاتی دراو", "ممر زمن العملة", "Cointime corridor"),
     L("قیمت بین «قیمت فعال» و «قیمت خواب»، و سرزندگی شبکه", "نرخ لە نێوان «نرخی چالاک» و «نرخی خەوتوو»، و زیندوویی تۆڕ", "السعر بين «السعر النشط» و«السعر الخامل»، وحيوية الشبكة", "Price between the active and vaulted prices, and the network's liveliness"),
     "راهروی زمان‌سکه: قیمت فعال، خواب و سرزندگی" + SITE_TAIL,
     "قیمت بیت‌کوین در راهروی بین قیمت فعال و قیمت خواب (اقتصاد زمان‌سکه)، به‌همراه سرزندگی و تغییر ۳۰ روزه‌اش؛ رایگان و به چهار زبان.",
     ["cointime", "active price", "vaulted price", "liveliness", "قیمت فعال", "سرزندگی"],
     L("اقتصاد زمان‌سکه: بهای سکه‌های در گردش و سکه‌های خوابیده، و اینکه شبکه دارد بیدار می‌شود یا به خواب می‌رود",
       "ئابووریی کاتی دراو: تێچووی دراوە گەڕۆکەکان و خەوتووەکان، و ئایا تۆڕەکە بێدار دەبێتەوە یان دەخەوێت",
       "اقتصاد زمن العملة: كلفة العملات المتداولة والنائمة، وهل تستيقظ الشبكة أم تنام",
       "Cointime economics: what circulating and dormant coins cost, and whether the network is waking up or going to sleep"),
     {"fa": (["<b>قیمت فعال</b> بهای سکه‌هایی است که در گردش‌اند و <b>قیمت خواب</b> بهای سکه‌هایی که خوابیده‌اند؛ قیمت معمولاً بین این دو حرکت کرده. «جای قیمت در راهرو» ۰٪ یعنی روی قیمت خواب و ۱۰۰٪ یعنی روی قیمت فعال.",
              "<b>سرزندگی</b> (۰ تا ۱) سهم کوین‌روزهای سوخته از همهٔ کوین‌روزهای ساخته‌شده است: بالا رفتنش یعنی سکه‌های قدیمی بیدار می‌شوند، پایین آمدنش یعنی شبکه به خواب می‌رود."],
             ["این سه عدد از چارچوب Cointime Economics (ARK Invest و Glassnode، ۲۰۲۳) آمده‌اند و Bitcoin Research Kit آن‌ها را از خود بلاک‌چین حساب می‌کند. جای قیمت در راهرو روی مقیاس لگاریتمی است."],
             ["راهرو حمایت و مقاومت تضمینی نیست؛ قیمت بارها بیرون از آن رفته است. این چارچوب نسبتاً جدید است و سابقهٔ آزمونش کوتاه."]),
      "ckb": (["<b>نرخی چالاک</b> تێچووی دراوە گەڕۆکەکانە و <b>نرخی خەوتوو</b> تێچووی دراوە خەوتووەکان؛ نرخ زۆرجار لە نێوان ئەم دووانەدا جووڵاوە.",
               "<b>زیندوویی</b> (٠ تا ١) بەشی کۆین‌ڕۆژە سووتاوەکانە لە هەموو کۆین‌ڕۆژە دروستکراوەکان: بەرزبوونەوەی واتە دراوە کۆنەکان بێدار دەبنەوە."],
              ["ئەم سێ ژمارەیە لە چوارچێوەی Cointime Economics (ARK Invest و Glassnode، ٢٠٢٣)ـەوە هاتوون و Bitcoin Research Kit لە بلۆکچەینەوە هەژماریان دەکات."],
              ["ڕاڕەوەکە پاڵپشت و بەرگریی گەرەنتیکراو نییە؛ نرخ چەند جار لێی دەرچووە."]),
      "ar": (["<b>السعر النشط</b> كلفة العملات المتداولة و<b>السعر الخامل</b> كلفة العملات النائمة؛ تحرّك السعر عادةً بينهما. «موقع السعر في الممر» 0% يعني عند السعر الخامل و100% عند السعر النشط.",
              "<b>الحيوية</b> (0 إلى 1) حصة أيام العملة المستهلكة من كل أيام العملة المتكوّنة: ارتفاعها يعني استيقاظ العملات القديمة، وانخفاضها أن الشبكة تنام."],
             ["هذه الأرقام من إطار Cointime Economics (ARK Invest وGlassnode، 2023)، ويحسبها Bitcoin Research Kit من البلوكشين نفسه. موقع السعر في الممر على مقياس لوغاريتمي."],
             ["الممر ليس دعمًا ومقاومة مضمونين؛ خرج السعر منه مرات. والإطار حديث نسبيًا وسجل اختباره قصير."]),
      "en": (["<b>Active price</b> is the cost of coins in circulation and <b>vaulted price</b> the cost of dormant ones; price has tended to move between the two. Position in the corridor: 0% is on the vaulted price, 100% on the active price.",
              "<b>Liveliness</b> (0 to 1) is the share of all coin-days ever created that have been destroyed: rising means old coins are waking up, falling means the network is going to sleep."],
             ["These come from the Cointime Economics framework (ARK Invest and Glassnode, 2023), computed from the blockchain itself by the Bitcoin Research Kit. The position in the corridor is on a log scale."],
             ["The corridor is no guaranteed support or resistance; price has left it many times. The framework is fairly new and its record is short."])})

page("freshblood", "fresh-blood", "age", "bv",
     L("خون تازه و برگشتی‌ها", "خوێنی نوێ و گەڕاوەکان", "الدم الجديد والعائدون", "Fresh blood and returning wallets"),
     L("آدرس‌های کاملاً تازه در برابر آدرس‌هایی که پس از مدت‌ها برگشته‌اند", "ناونیشانە تەواو نوێکان بەرامبەر ئەوانەی دوای ماوەیەکی درێژ گەڕاونەتەوە", "العناوين الجديدة تمامًا مقابل العائدة بعد غياب طويل", "Brand-new addresses against addresses back after a long sleep"),
     "آدرس‌های تازه و برگشتی بیت‌کوین" + SITE_TAIL,
     "تعداد روزانهٔ آدرس‌های تازهٔ بیت‌کوین و آدرس‌های خوابیده‌ای که دوباره فعال شده‌اند، و نسبتشان: کاربر جدید می‌آید یا قدیمی‌ها برمی‌گردند؟",
     ["آدرس جدید", "کاربر جدید", "new addresses", "reactivated addresses", "adoption"],
     L("شبکه کاربر تازه جذب می‌کند یا فقط قدیمی‌ها برمی‌گردند؟", "تۆڕەکە بەکارهێنەری نوێ ڕادەکێشێت یان تەنها کۆنەکان دەگەڕێنەوە؟",
       "هل تجذب الشبكة مستخدمين جددًا أم يعود القدامى فقط؟", "Is the network drawing new users, or only bringing old ones back?"),
     {"fa": (["<b>آدرس تازه</b>: آدرسی که اولین بار بیت‌کوین گرفته. <b>آدرس برگشتی</b>: آدرسی که مدت‌ها بی‌حرکت بوده و دوباره فعال شده. هر دو با میانگین ۳۰ روزه کشیده شده‌اند.",
              "نسبت بالای برگشتی‌ها به تازه‌ها یعنی بیشتر جنب‌وجوش از قدیمی‌هاست؛ رشد آدرس‌های تازه نسبت به سه ماه پیش، نشانهٔ ورود خون تازه است."],
             ["دو شمارش روزانه از Bitcoin Research Kit، میانگین ۳۰ روزه، نسبت برگشتی ÷ تازه، و تغییر ۹۰ روزهٔ آدرس‌های تازه."],
             ["آدرس همان آدم نیست: یک نفر می‌تواند ده‌ها آدرس بسازد و صرافی‌ها برای هر برداشت آدرس تازه می‌سازند. موج‌های توکن‌سازی روی بیت‌کوین (اینسکریپشن‌ها) هم آدرس تازهٔ زیادی می‌سازند."]),
      "ckb": (["<b>ناونیشانی نوێ</b>: ناونیشانێک بۆ یەکەم جار بیتکۆینی وەرگرتووە. <b>ناونیشانی گەڕاوە</b>: ناونیشانێک ماوەیەکی زۆر بێ جووڵە بووە و دیسان چالاک بووەتەوە.",
               "ڕێژەی زۆری گەڕاوەکان بە نوێکان واتە زۆربەی چالاکی لە کۆنەکانەوەیە؛ گەشەی ناونیشانە نوێکان نیشانەی خوێنی نوێیە."],
              ["دوو ژماردنی ڕۆژانە لە Bitcoin Research Kit، ناوەندی ٣٠ ڕۆژ، ڕێژەی گەڕاوە ÷ نوێ، و گۆڕانی ٩٠ ڕۆژەی نوێکان."],
              ["ناونیشان هەمان مرۆڤ نییە: کەسێک دەتوانێت دەیان ناونیشان دروست بکات و ئاڵوگۆڕگەکان بۆ هەر کێشانەوەیەک ناونیشانی نوێ دروست دەکەن."]),
      "ar": (["<b>العنوان الجديد</b>: عنوان يتلقى بيتكوين لأول مرة. <b>العنوان العائد</b>: عنوان بقي ساكنًا طويلًا ثم نشط من جديد. كلاهما بمتوسط 30 يومًا.",
              "ارتفاع نسبة العائدين إلى الجدد يعني أن معظم النشاط من القدامى؛ ونمو العناوين الجديدة مقارنة بثلاثة أشهر علامة على دم جديد."],
             ["عدّان يوميان من Bitcoin Research Kit، بمتوسط 30 يومًا، ونسبة العائد ÷ الجديد، وتغير العناوين الجديدة في 90 يومًا."],
             ["العنوان ليس شخصًا: قد يصنع شخص عشرات العناوين، والمنصات تصنع عنوانًا لكل سحب. وموجات إصدار الرموز على البيتكوين (النقوش) تصنع عناوين جديدة كثيرة."]),
      "en": (["<b>New address</b>: one receiving bitcoin for the first time. <b>Returning address</b>: one that sat still for a long time and became active again. Both are drawn as 30-day means.",
              "A high returning ÷ new ratio means most activity comes from old hands; new addresses growing against three months ago is a sign of fresh blood."],
             ["Two daily counts from the Bitcoin Research Kit, 30-day means, the returning ÷ new ratio, and the 90-day change in new addresses."],
             ["An address is not a person: one person can make dozens, and exchanges create a fresh address for every withdrawal. Token waves on bitcoin (inscriptions) also create many new addresses."])})

# ================================================================ who paid what
page("costbasis", "cohort-cost-basis", "cost", "bv",
     L("بهای خرید گروه‌ها و همگرایی‌شان", "تێچووی گرووپەکان و لێکنزیکبوونەوەیان", "كلفة الفئات وتقاربها", "Cohort cost bases and their convergence"),
     L("کوتاه‌مدت‌ها، بلندمدت‌ها، نهنگ‌ها و کیف‌های کوچک هر بیت‌کوین را چند خریده‌اند", "کورتخایەن، درێژخایەن، نەهەنگ و جزدانە بچووکەکان هەر بیتکۆینێکیان بە چەند کڕیوە", "بكم اشترى قصيرو الأجل وطويلوه والحيتان والمحافظ الصغيرة", "What short- and long-term holders, whales and small wallets paid per bitcoin"),
     "بهای تمام‌شدهٔ گروه‌های بیت‌کوین و همگرایی" + SITE_TAIL,
     "قیمت تحقق‌یافتهٔ کوتاه‌مدت‌ها، بلندمدت‌ها، نهنگ‌ها و کیف‌های کوچک و فاصلهٔ بالاترین و پایین‌ترین؛ وقتی بهای همه به هم نزدیک می‌شود.",
     ["realized price", "بهای تمام شده", "STH", "LTH", "نهنگ", "cost basis", "cohort"],
     L("هر گروه از دارندگان بیت‌کوین را به‌طور میانگین چند خریده، و این بهاها به هم نزدیک می‌شوند یا دور",
       "هەر گرووپێک لە خاوەنانی بیتکۆین بە ناوەندی بە چەندی کڕیوە، و ئەم تێچووانە لێک نزیک دەبنەوە یان دوور",
       "بكم اشترت كل فئة من حائزي البيتكوين في المتوسط، وهل تتقارب هذه الكلف أم تتباعد",
       "What each group of bitcoin holders paid on average, and whether those costs are converging or drifting apart"),
     {"fa": (["هر خط بهای تمام‌شدهٔ یک گروه است: <b>کوتاه‌مدت‌ها</b> (سکه‌های جوان‌تر از ۱۵۵ روز)، <b>بلندمدت‌ها</b>، <b>نهنگ‌ها</b> و <b>کیف‌های کوچک</b> (بر اساس اندازهٔ دارایی). وقتی قیمت زیر خط گروهی می‌رود، آن گروه به‌طور میانگین در زیان است.",
              "<b>فاصلهٔ بها</b>: فاصلهٔ بالاترین و پایین‌ترین بهای این چهار گروه، به درصد قیمت تحقق‌یافتهٔ کل. فشرده شدنش یعنی همه تقریباً به یک قیمت رسیده‌اند؛ در گذشته پس از چنین فشردگی‌هایی حرکت بزرگی آمده، بدون اینکه جهتش را بگوید."],
             ["بهای هر گروه، قیمت تحقق‌یافتهٔ آن گروه از Bitcoin Research Kit است (ارزش هر سکه به قیمت آخرین جابه‌جایی‌اش ÷ تعداد سکه‌ها). فاصله = (بیشترین - کمترین) ÷ قیمت تحقق‌یافتهٔ کل × ۱۰۰."],
             ["بهای تمام‌شدهٔ <b>معدنچیان</b> به‌صورت رایگان و دقیق در دسترس نیست، برای همین در این صفحه نیامده. گروه‌بندی اندازه بر پایهٔ خروجی‌های تراکنش است و یک شخص ممکن است در چند گروه باشد."]),
      "ckb": (["هەر هێڵێک تێچووی گرووپێکە: <b>کورتخایەنەکان</b> (دراوی گەنجتر لە ١٥٥ ڕۆژ)، <b>درێژخایەنەکان</b>، <b>نەهەنگەکان</b> و <b>جزدانە بچووکەکان</b>. کاتێک نرخ دەچێتە خوار هێڵی گرووپێک، ئەو گرووپە لە زیاندایە.",
               "<b>دووری تێچوو</b>: دووری بەرزترین و نزمترین تێچووی ئەم چوار گرووپە. چڕبوونەوەی واتە هەموو نزیکەی گەیشتوونەتە یەک نرخ؛ لە ڕابردوودا دوای ئەمە جووڵەیەکی گەورە هاتووە."],
              ["تێچووی هەر گرووپێک نرخی بەدیهاتووی ئەو گرووپەیە لە Bitcoin Research Kit. دووری = (زۆرترین - کەمترین) ÷ نرخی بەدیهاتووی گشتی × ١٠٠."],
              ["تێچووی <b>کانکاران</b> بە بێبەرامبەری و وردی بەردەست نییە، بۆیە لێرە نییە. یەک کەس دەکرێت لە چەند گرووپدا بێت."]),
      "ar": (["كل خط كلفة فئة: <b>قصيرو الأجل</b> (عملات أحدث من 155 يومًا)، و<b>طويلو الأجل</b>، و<b>الحيتان</b>، و<b>المحافظ الصغيرة</b> (حسب حجم الحيازة). حين ينزل السعر تحت خط فئة تكون في خسارة في المتوسط.",
              "<b>فجوة الكلفة</b>: المسافة بين أعلى وأدنى كلفة للفئات الأربع، بنسبة من السعر المحقق للكل. انضغاطها يعني أن الجميع وصلوا تقريبًا إلى سعر واحد؛ سبقت هذه الحالة تاريخيًا تحركات كبيرة دون أن تحدد اتجاهها."],
             ["كلفة كل فئة هي سعرها المحقق من Bitcoin Research Kit (قيمة كل عملة بسعر آخر حركة ÷ عدد العملات). الفجوة = (الأعلى - الأدنى) ÷ السعر المحقق للكل × 100."],
             ["كلفة <b>المعدّنين</b> غير متاحة مجانًا وبدقة، لذا ليست في الصفحة. وتصنيف الحجم مبني على مخرجات المعاملات، فقد يكون شخص واحد في عدة فئات."]),
      "en": (["Each line is a group's cost basis: <b>short-term holders</b> (coins younger than 155 days), <b>long-term holders</b>, <b>whales</b> and <b>small wallets</b> (by holding size). When price drops below a group's line, that group is at a loss on average.",
              "<b>Cost-basis spread</b>: the distance between the highest and lowest of the four, as a percentage of the overall realized price. When it squeezes, everyone has roughly the same cost; big moves have followed such squeezes, without saying which way."],
             ["Each group's cost is its realized price from the Bitcoin Research Kit (every coin valued at its last-moved price ÷ the number of coins). Spread = (highest - lowest) ÷ overall realized price × 100."],
             ["<b>Miners'</b> cost basis is not available accurately for free, so it is left out. Size groups are built from transaction outputs, so one person can sit in several groups."])})

page("whalegap", "whale-gap", "cost", "bv",
     L("فاصلهٔ بهای نهنگ‌ها و کوچک‌ها", "دووریی تێچووی نەهەنگ و بچووکەکان", "فجوة كلفة الحيتان والصغار", "Whales' cost against small wallets'"),
     L("نهنگ‌ها ارزان‌تر خریده‌اند یا گران‌تر از کیف‌های کوچک", "نەهەنگەکان هەرزانتر کڕیویانە یان گرانتر لە جزدانە بچووکەکان", "هل اشترت الحيتان أرخص أم أغلى من المحافظ الصغيرة", "Whether whales bought cheaper or dearer than small wallets"),
     "فاصلهٔ بهای خرید نهنگ‌ها و کیف‌های کوچک" + SITE_TAIL,
     "نسبت بهای تمام‌شدهٔ نهنگ‌های بیت‌کوین به کیف‌های کوچک و امتیاز Z دو ساله‌اش: چه کسی ارزان‌تر خریده و تحمل ریزشش بیشتر است.",
     ["نهنگ", "whale", "cost basis", "realized price", "کیف کوچک"],
     L("وقتی نهنگ‌ها خیلی ارزان‌تر از کوچک‌ها خریده باشند، در ریزش آرام‌ترند؛ وقتی گران‌تر، پول بزرگ تازه وارد شده",
       "کاتێک نەهەنگەکان زۆر هەرزانتر لە بچووکەکان کڕیبێتیان، لە دابەزیندا ئارامترن؛ کاتێک گرانتر، پارەی گەورەی نوێ هاتووە",
       "حين تشتري الحيتان أرخص بكثير من الصغار تكون أهدأ في الهبوط؛ وحين تشتري أغلى يكون مال كبير جديد قد دخل",
       "When whales paid far less than small wallets they sit calmer through drops; when they paid more, big new money has arrived"),
     {"fa": (["<b>نسبت</b> = بهای نهنگ‌ها ÷ بهای کیف‌های کوچک. زیر ۱ یعنی نهنگ‌ها هر بیت‌کوین را ارزان‌تر دارند؛ بالای ۱ یعنی پول بزرگ تازه با قیمت بالاتر وارد شده (مثل صندوق‌ها و شرکت‌ها).",
              "<b>امتیاز Z</b> می‌گوید این نسبت نسبت به دو سال اخیر چقدر غیرعادی است؛ بالای ۲ یا زیر ۲- کم پیش می‌آید."],
             ["دو قیمت تحقق‌یافته از Bitcoin Research Kit (گروه بزرگ‌ترین دارندگان و گروه کوچک‌ها)، نسبتشان، و Z = (نسبت - میانگین ۷۳۰ روزه) ÷ انحراف معیار ۷۳۰ روزه."],
             ["«نهنگ» اینجا یعنی خروجی‌ها یا آدرس‌های بزرگ؛ کیف سرد صرافی‌ها و صندوق‌های ETF هم در همین گروه‌اند و همیشه یک آدم نیستند."]),
      "ckb": (["<b>ڕێژە</b> = تێچووی نەهەنگەکان ÷ تێچووی جزدانە بچووکەکان. خوار ١ واتە نەهەنگەکان هەرزانتریان هەیە؛ سەرووی ١ واتە پارەی گەورەی نوێ بە نرخی بەرزتر هاتووە.",
               "<b>نمرەی Z</b> دەڵێت ئەم ڕێژەیە بە بەراورد بە دوو ساڵی ڕابردوو چەند نائاساییە."],
              ["دوو نرخی بەدیهاتوو لە Bitcoin Research Kit، ڕێژەکەیان، و Z = (ڕێژە - ناوەندی ٧٣٠ ڕۆژ) ÷ لادانی ستانداردی ٧٣٠ ڕۆژ."],
              ["«نەهەنگ» لێرە واتە ناونیشان یان دەرچووە گەورەکان؛ جزدانی ساردی ئاڵوگۆڕگەکان و ETFـەکانیش لەم گرووپەدان."]),
      "ar": (["<b>النسبة</b> = كلفة الحيتان ÷ كلفة المحافظ الصغيرة. تحت 1 يعني أن الحيتان تملك البيتكوين أرخص؛ فوق 1 يعني دخول مال كبير جديد بسعر أعلى (كالصناديق والشركات).",
              "<b>درجة Z</b> تقول كم هذه النسبة غير مألوفة مقارنة بالعامين الماضيين؛ فوق 2 أو تحت -2 نادر."],
             ["سعران محققان من Bitcoin Research Kit (فئة أكبر الحائزين وفئة الصغار)، ونسبتهما، وZ = (النسبة - متوسط 730 يومًا) ÷ الانحراف المعياري لـ730 يومًا."],
             ["«الحوت» هنا مخرجات أو عناوين كبيرة؛ المحافظ الباردة للمنصات وصناديق ETF داخلة في الفئة، وليست دائمًا شخصًا واحدًا."]),
      "en": (["<b>Ratio</b> = whales' cost basis ÷ small wallets' cost basis. Below 1, whales hold their bitcoin cheaper; above 1, big new money has come in at higher prices (funds, companies).",
              "<b>Z-score</b> says how unusual the ratio is against the past two years; above 2 or below -2 is rare."],
             ["Two realized prices from the Bitcoin Research Kit (the largest holders' group and the small one), their ratio, and Z = (ratio - its 730-day mean) ÷ its 730-day standard deviation."],
             ["A whale here means large outputs or addresses; exchanges' cold wallets and ETF custodians sit in that group too, and are not always one person."])})

page("scriptcost", "wallet-generations", "cost", "bv",
     L("نسل کیف‌پول‌ها", "نەوەی جزدانەکان", "أجيال المحافظ", "Wallet generations"),
     L("بهای خرید بر اساس نوع آدرس: قدیمی، سگ‌ویت، تپ‌روت", "تێچوو بەپێی جۆری ناونیشان: کۆن، سێگویت، تاپرووت", "الكلفة حسب نوع العنوان: قديم، SegWit، Taproot", "Cost basis by address type: legacy, SegWit, Taproot"),
     "بهای تمام‌شده بر اساس نوع آدرس بیت‌کوین" + SITE_TAIL,
     "قیمت تحقق‌یافتهٔ آدرس‌های قدیمی (1…)، P2SH (3…)، سگ‌ویت (bc1q…) و تپ‌روت (bc1p…): کیف‌های قدیمی ارزان‌تر خریده‌اند یا نسل جدید؟",
     ["تپروت", "taproot", "segwit", "سگویت", "نوع آدرس", "realized price"],
     L("نوع آدرس نسل کیف‌پول را لو می‌دهد؛ هر نسل بیت‌کوینش را به‌طور میانگین چند خریده",
       "جۆری ناونیشان نەوەی جزدان ئاشکرا دەکات؛ هەر نەوەیەک بیتکۆینەکەی بە ناوەندی بە چەند کڕیوە",
       "نوع العنوان يكشف جيل المحفظة؛ بكم اشترى كل جيل بيتكوينه في المتوسط",
       "The address type gives away the wallet's generation; what each generation paid on average"),
     {"fa": (["آدرس‌های <b>1…</b> قدیمی‌ترین نوع‌اند (کیف‌های اولیه و بسیاری از نهنگ‌های قدیمی)، <b>3…</b> بیشتر صرافی‌ها و چندامضایی‌ها، <b>bc1q…</b> سگ‌ویت (از ۲۰۱۷) و <b>bc1p…</b> تپ‌روت (از ۲۰۲۱) جدیدترین.",
              "زیر هر کاشی فاصلهٔ قیمت امروز از بهای آن نسل آمده: مثبت یعنی در سود."],
             ["قیمت تحقق‌یافتهٔ هر نوع اسکریپت از Bitcoin Research Kit: ارزش سکه‌های آن نوع به قیمت آخرین جابه‌جایی ÷ تعدادشان."],
             ["نوع آدرس با سن صاحبش یکی نیست؛ خیلی‌ها کیف قدیمی را به نوع جدید منتقل کرده‌اند. تپ‌روت بخش بزرگی از توکن‌ها و اینسکریپشن‌ها را هم دارد."]),
      "ckb": (["ناونیشانەکانی <b>1…</b> کۆنترین جۆرن، <b>3…</b> زیاتر ئاڵوگۆڕگە و فرە واژۆکان، <b>bc1q…</b> سێگویت (لە ٢٠١٧ـەوە) و <b>bc1p…</b> تاپرووت (لە ٢٠٢١ـەوە) نوێترین.",
               "لە خوار هەر کاشییەک دووریی نرخی ئەمڕۆ لە تێچووی ئەو نەوەیە هاتووە."],
              ["نرخی بەدیهاتووی هەر جۆرە سکریپتێک لە Bitcoin Research Kit."],
              ["جۆری ناونیشان هەمان تەمەنی خاوەنەکەی نییە؛ زۆر کەس جزدانی کۆنیان گواستووەتەوە بۆ جۆری نوێ."]),
      "ar": (["عناوين <b>1…</b> أقدم الأنواع (المحافظ الأولى وكثير من الحيتان القديمة)، و<b>3…</b> غالبًا المنصات ومتعددة التوقيع، و<b>bc1q…</b> SegWit (منذ 2017)، و<b>bc1p…</b> Taproot (منذ 2021) الأحدث.",
              "تحت كل بطاقة بُعد سعر اليوم عن كلفة ذلك الجيل: الموجب ربح."],
             ["السعر المحقق لكل نوع سكربت من Bitcoin Research Kit: قيمة عملات ذلك النوع بسعر آخر حركة ÷ عددها."],
             ["نوع العنوان ليس عمر صاحبه؛ نقل كثيرون محافظهم القديمة إلى أنواع جديدة. وTaproot يحمل جزءًا كبيرًا من الرموز والنقوش أيضًا."]),
      "en": (["<b>1…</b> addresses are the oldest type (early wallets and many old whales), <b>3…</b> mostly exchanges and multisig, <b>bc1q…</b> SegWit (from 2017) and <b>bc1p…</b> Taproot (from 2021) the newest.",
              "Under each tile is today's price against that generation's cost: positive means in profit."],
             ["Each script type's realized price from the Bitcoin Research Kit: the value of that type's coins at their last-moved price ÷ their number."],
             ["Address type is not the owner's age; many people have moved old wallets to newer types. Taproot also carries a large share of tokens and inscriptions."])})

page("sthpain", "short-term-pain", "cost", "bv",
     L("درد تازه‌واردها", "ئازاری تازەهاتووەکان", "ألم القادمين الجدد", "Newcomers' pain"),
     L("چه سهمی از سکه‌های کوتاه‌مدت و بلندمدت زیر بهای خریدشان‌اند", "چ بەشێک لە دراوە کورتخایەن و درێژخایەنەکان لە خوار تێچووی کڕینیانن", "أي حصة من عملات قصيري وطويلي الأجل تحت كلفة شرائها", "What share of short- and long-term coins sit below their cost"),
     "سهم سکه‌های کوتاه‌مدت بیت‌کوین در زیان" + SITE_TAIL,
     "درصد سکه‌های دارندگان کوتاه‌مدت و بلندمدت بیت‌کوین که در زیان‌اند و بهای کوتاه‌مدت‌ها؛ بالای ۸۰٪ در گذشته نزدیک تسلیم و کف دیده شده.",
     ["تسلیم", "capitulation", "STH", "supply in loss", "در زیان"],
     L("وقتی بیشتر خریداران تازه در زیان‌اند، فشار فروش از سر ترس بالاست؛ این صفحه آن درد را اندازه می‌گیرد",
       "کاتێک زۆربەی کڕیارە نوێکان لە زیاندان، فشاری فرۆشتن لە ترسەوە بەرزە؛ ئەم پەڕەیە ئەو ئازارە دەپێوێت",
       "حين يكون معظم المشترين الجدد في خسارة يرتفع ضغط البيع بدافع الخوف؛ هذه الصفحة تقيس ذلك الألم",
       "When most recent buyers are at a loss, fear-driven selling runs high; this page measures that pain"),
     {"fa": (["خط قرمز: درصد سکه‌های <b>کوتاه‌مدت</b> (جوان‌تر از ۱۵۵ روز) که قیمت امروز زیر بهای خریدشان است. خط سبز: همین برای <b>بلندمدت‌ها</b>.",
              "ناحیهٔ ۸۰ تا ۱۰۰٪ کوتاه‌مدت‌ها در گذشته نزدیک کف‌های محلی و تسلیم دیده شده؛ زیر ۲۰٪ یعنی تقریباً همهٔ تازه‌واردها در سودند."],
             ["سهم عرضهٔ در زیان هر گروه از Bitcoin Research Kit (سکه‌هایی که آخرین بار گران‌تر از قیمت امروز جابه‌جا شده‌اند)، با میانگین ۷ روزه برای کوتاه‌مدت‌ها؛ بهای کوتاه‌مدت‌ها روی نمودار قیمت آمده."],
             ["عدد بالا نقطهٔ ورود تضمینی نیست؛ در بازار نزولی طولانی می‌تواند ماه‌ها بالا بماند."]),
      "ckb": (["هێڵی سوور: لەسەدی دراوە <b>کورتخایەنەکان</b> (گەنجتر لە ١٥٥ ڕۆژ) کە نرخی ئەمڕۆ لە خوار تێچووی کڕینیانە. هێڵی سەوز: هەمان شت بۆ <b>درێژخایەنەکان</b>.",
               "ناوچەی ٨٠ تا ١٠٠٪ لە ڕابردوودا نزیکی بنە ناوخۆییەکان و خۆبەدەستەوەدان بینراوە."],
              ["بەشی دابینکراوی زیانباری هەر گرووپێک لە Bitcoin Research Kit، بە ناوەندی ٧ ڕۆژ بۆ کورتخایەنەکان."],
              ["ژمارەی بەرز خاڵی چوونەژوورەی گەرەنتیکراو نییە؛ لە بازاڕی دابەزینی درێژدا دەکرێت مانگەها بەرز بمێنێتەوە."]),
      "ar": (["الخط الأحمر: نسبة عملات <b>قصيري الأجل</b> (أحدث من 155 يومًا) التي يقع سعر اليوم تحت كلفة شرائها. الخط الأخضر: الشيء نفسه لـ<b>طويلي الأجل</b>.",
              "منطقة 80–100% لقصيري الأجل ظهرت تاريخيًا قرب القيعان المحلية والاستسلام؛ وتحت 20% يعني أن معظم القادمين الجدد في ربح."],
             ["حصة المعروض الخاسر لكل فئة من Bitcoin Research Kit (العملات التي تحركت آخر مرة بسعر أعلى من اليوم)، بمتوسط 7 أيام لقصيري الأجل؛ وكلفة قصيري الأجل على رسم السعر."],
             ["الرقم المرتفع ليس نقطة دخول مضمونة؛ في الهبوط الطويل قد يبقى مرتفعًا أشهرًا."]),
      "en": (["Red line: the share of <b>short-term</b> coins (younger than 155 days) whose cost is above today's price. Green line: the same for <b>long-term</b> coins.",
              "The 80–100% zone for short-term holders has shown up near local bottoms and capitulation; below 20% means nearly all newcomers are in profit."],
             ["Each group's supply-in-loss share from the Bitcoin Research Kit (coins that last moved at a higher price than today), with a 7-day mean for short-term holders; their cost basis is drawn on the price pane."],
             ["A high reading is no guaranteed entry point; in a long bear market it can stay high for months."])})

page("sizepl", "who-takes-profit", "cost", "bv",
     L("چه کسی سود برمی‌دارد", "کێ قازانج وەردەگرێت", "من يجني الأرباح", "Who takes profit"),
     L("سود و زیان تحقق‌یافتهٔ ۷ روزه به تفکیک اندازهٔ کیف", "قازانج و زیانی بەدیهاتووی ٧ ڕۆژ بەپێی قەبارەی جزدان", "الربح والخسارة المحققان في 7 أيام حسب حجم المحفظة", "Seven-day realized profit and loss by wallet size"),
     "سود و زیان تحقق‌یافته به تفکیک اندازهٔ کیف" + SITE_TAIL,
     "سود منهای زیان تحقق‌یافتهٔ ۷ روزهٔ بیت‌کوین برای کیف‌های کوچک تا نهنگ‌ها: الان کدام گروه سود نقد می‌کند و کدام با زیان می‌فروشد.",
     ["سود تحقق یافته", "realized profit", "نهنگ", "whale", "profit taking"],
     L("وقتی بیت‌کوین خرج می‌شود، فروشنده سود یا زیانش را نقد می‌کند؛ اینجا معلوم است این کار را بیشتر کدام اندازه از کیف‌ها انجام می‌دهد",
       "کاتێک بیتکۆین خەرج دەکرێت، فرۆشیار قازانج یان زیانەکەی نەختینە دەکات؛ لێرە دەردەکەوێت کام قەبارەی جزدان زیاتر ئەمە دەکات",
       "حين يُنفق البيتكوين يحقق البائع ربحه أو خسارته؛ هنا يظهر أي حجم من المحافظ يفعل ذلك أكثر",
       "When bitcoin is spent, the seller locks in a profit or a loss; here you see which wallet sizes are doing it"),
     {"fa": (["هر میله سود منهای زیان تحقق‌یافتهٔ یک گروه اندازه در ۷ روز است، به دلار. مثبت یعنی این گروه با سود فروخته؛ منفی یعنی با زیان (تسلیم).",
              "وقتی نهنگ‌ها سود سنگین برمی‌دارند و کوچک‌ها با زیان می‌فروشند، پول از دست ضعیف به دست قوی می‌رود یا برعکس."],
             ["سود و زیان تحقق‌یافتهٔ روزانهٔ هر گروه از Bitcoin Research Kit (تفاوت قیمت خرج شدن با قیمت آخرین جابه‌جایی، ضرب در تعداد)، جمع ۷ روزه، سود منهای زیان."],
             ["گروه‌ها بر اساس موجودی آدرس‌اند و صرافی‌ها هم داخلشان‌اند؛ انتقال داخلی صرافی‌ها می‌تواند عدد را پرنوسان کند."]),
      "ckb": (["هەر ستوونێک قازانج کەم زیانی بەدیهاتووی گرووپێکی قەبارەیە لە ٧ ڕۆژدا، بە دۆلار. پۆزەتیڤ واتە بە قازانج فرۆشتوویەتی؛ نێگەتیڤ واتە بە زیان.",
               "کاتێک نەهەنگەکان قازانجی قورس وەردەگرن و بچووکەکان بە زیان دەفرۆشن، پارە لە دەستی لاوازەوە دەچێتە دەستی بەهێز یان بە پێچەوانەوە."],
              ["قازانج و زیانی بەدیهاتووی ڕۆژانەی هەر گرووپێک لە Bitcoin Research Kit، کۆی ٧ ڕۆژ، قازانج کەم زیان."],
              ["گرووپەکان بەپێی باڵانسی ناونیشانن و ئاڵوگۆڕگەکانیش تێیاندان."]),
      "ar": (["كل عمود هو الربح ناقص الخسارة المحققين لفئة حجم خلال 7 أيام بالدولار. الموجب يعني أن الفئة باعت بربح، والسالب بخسارة (استسلام).",
              "حين تجني الحيتان أرباحًا كبيرة ويبيع الصغار بخسارة، ينتقل المال من يد إلى أخرى."],
             ["الربح والخسارة المحققان يوميًا لكل فئة من Bitcoin Research Kit (فرق سعر الإنفاق عن سعر آخر حركة مضروبًا في الكمية)، مجموع 7 أيام، الربح ناقص الخسارة."],
             ["الفئات حسب رصيد العنوان والمنصات داخلة فيها؛ والتحويلات الداخلية للمنصات قد تجعل الرقم متقلبًا."]),
      "en": (["Each bar is a size group's realized profit minus realized loss over 7 days, in dollars. Positive means the group sold at a profit; negative at a loss (capitulation).",
              "When whales take heavy profits while small wallets sell at a loss, money is changing hands between strong and weak holders."],
             ["Each group's daily realized profit and loss from the Bitcoin Research Kit (the spent price against the last-moved price, times the amount), summed over 7 days, profit minus loss."],
             ["Groups go by address balance and exchanges sit inside them; exchanges' internal transfers can make the numbers jumpy."])})

# ================================================================ leverage, builders, exchanges
page("fundflow", "funding-vs-flows", "lev", "fund",
     L("فاندینگ در برابر جریان صرافی‌ها", "فاندینگ بەرامبەر ڕەوتی ئاڵوگۆڕگەکان", "التمويل مقابل تدفقات المنصات", "Funding against exchange flows"),
     L("اهرم داغ است ولی بیت‌کوین واقعی از صرافی‌ها بیرون می‌رود؟", "لیڤەرێج گەرمە بەڵام بیتکۆینی ڕاستەقینە لە ئاڵوگۆڕگەکان دەردەچێت؟", "هل الرافعة ساخنة بينما يخرج البيتكوين الحقيقي من المنصات؟", "Is leverage hot while real bitcoin leaves exchanges?"),
     "واگرایی فاندینگ و جریان صرافی‌های بیت‌کوین" + SITE_TAIL,
     "امتیاز واگرایی بین فاندینگ سالانهٔ BTCUSDT و خالص ورود بیت‌کوین به صرافی‌ها: اهرم داغ و اسپات سرد، یا انباشت آرام؛ داده از ۲۰۱۹.",
     ["فاندینگ", "funding rate", "exchange flow", "جریان صرافی", "اهرم", "leverage", "divergence"],
     L("وقتی معامله‌گران اهرمی هزینهٔ زیادی برای لانگ می‌دهند ولی کسی بیت‌کوین واقعی نمی‌خرد، یا برعکس",
       "کاتێک بازرگانە لیڤەرێجدارەکان پارەیەکی زۆر بۆ لۆنگ دەدەن بەڵام کەس بیتکۆینی ڕاستەقینە ناکڕێت، یان بە پێچەوانەوە",
       "حين يدفع متداولو الرافعة كثيرًا للشراء بينما لا يشتري أحد بيتكوينًا حقيقيًا، أو العكس",
       "When leveraged traders pay a lot to stay long while nobody buys real bitcoin, or the other way round"),
     {"fa": (["<b>فاندینگ</b> هزینه‌ای است که لانگ‌ها به شورت‌ها می‌دهند؛ بالا یعنی اهرم خرید داغ است. <b>خالص صرافی‌ها</b>: ورود منهای خروج بیت‌کوین در ۷ روز؛ خروج (منفی) معمولاً یعنی تقاضای واقعی و نگهداری.",
              "<b>امتیاز واگرایی</b> این دو را کنار هم می‌گذارد: بالای ۲ یعنی اهرم غیرعادی داغ ولی بیت‌کوین واقعی به صرافی‌ها می‌رود (رالی شکننده)؛ زیر ۲- یعنی فاندینگ سرد ولی بیت‌کوین بی‌سروصدا خارج می‌شود (انباشت آرام)."],
             ["فاندینگ ۸ ساعتهٔ BTCUSDT جمع روزانه، × ۳۶۵ و میانگین ۷ روزه. امتیاز = Z یک‌ساله فاندینگ منهای Z یک‌ساله خروج خالص ۷ روزه (یعنی منفیِ خالص ورود)."],
             ["فقط یک بازار (BTCUSDT) و فقط جریان صرافی‌هایی که Coin Metrics می‌شناسد؛ فاندینگ روزهای اخیر از OKX است (روی نمودار علامت دارد) و ممکن است کمی با Binance فرق داشته باشد."]),
      "ckb": (["<b>فاندینگ</b> ئەو تێچووەیە لۆنگەکان دەیدەن بە شۆرتەکان؛ بەرز واتە لیڤەرێجی کڕین گەرمە. <b>پوختەی ئاڵوگۆڕگەکان</b>: هاتن کەم چوونی بیتکۆین لە ٧ ڕۆژدا.",
               "<b>نمرەی لێکجیابوونەوە</b>: سەرووی ٢ واتە لیڤەرێج گەرمە بەڵام بیتکۆین دەچێتە ئاڵوگۆڕگەکان؛ خوار ٢- واتە فاندینگ ساردە بەڵام بیتکۆین بێدەنگ دەردەچێت."],
              ["فاندینگی ٨ کاتژمێری BTCUSDT کۆی ڕۆژانە × ٣٦٥ و ناوەندی ٧ ڕۆژ. نمرە = Zی ساڵانەی فاندینگ کەم Zی ساڵانەی دەرچوونی پوختەی ٧ ڕۆژ."],
              ["تەنها یەک بازاڕ (BTCUSDT)؛ فاندینگی ڕۆژانی دوایی لە OKXـەوەیە و دەکرێت کەمێک جیاواز بێت."]),
      "ar": (["<b>التمويل</b> ما يدفعه المشترون بالرافعة للبائعين؛ ارتفاعه يعني رافعة شراء ساخنة. <b>صافي المنصات</b>: الداخل ناقص الخارج من البيتكوين في 7 أيام؛ الخروج (سالب) يعني غالبًا طلبًا حقيقيًا واحتفاظًا.",
              "<b>درجة التباعد</b> تضعهما جنبًا إلى جنب: فوق 2 رافعة ساخنة على غير العادة بينما يذهب البيتكوين الحقيقي إلى المنصات (صعود هش)؛ تحت -2 تمويل بارد بينما يخرج البيتكوين بهدوء (تراكم هادئ)."],
             ["تمويل BTCUSDT كل 8 ساعات مجموعًا يوميًا × 365 بمتوسط 7 أيام. الدرجة = Z السنوي للتمويل ناقص Z السنوي لصافي الخروج في 7 أيام (أي سالب صافي الدخول)."],
             ["سوق واحدة فقط (BTCUSDT) وتدفقات المنصات التي يعرفها Coin Metrics فقط؛ تمويل الأيام الأخيرة من OKX (معلَّم على الرسم) وقد يختلف قليلًا عن Binance."]),
      "en": (["<b>Funding</b> is what longs pay shorts; high means leveraged buying is hot. <b>Exchange net</b>: bitcoin flowing in minus out over 7 days; outflows (negative) usually mean real demand and holding.",
              "<b>Divergence score</b> puts the two side by side: above 2, leverage is unusually hot while real bitcoin moves onto exchanges (a fragile rally); below -2, funding is cold while bitcoin quietly leaves (quiet accumulation)."],
             ["BTCUSDT 8-hour funding summed per day, × 365, 7-day mean. Score = funding's one-year z-score minus the one-year z-score of 7-day net outflow (that is, minus net inflow)."],
             ["One market only (BTCUSDT), and only the exchanges Coin Metrics tracks; the latest days' funding comes from OKX (marked on the chart) and can differ slightly from Binance's."])})

page("devpulse", "dev-pulse", "lev", "gh",
     L("نبض توسعه در برابر قیمت", "لێدانی گەشەپێدان بەرامبەر نرخ", "نبض التطوير مقابل السعر", "Developer pulse against price"),
     L("کامیت‌های گیت‌هاب ۲۸ پروژه کنار قیمتشان؛ جایی که کار بالا رفته و قیمت پایین", "کۆمیتەکانی GitHubی ٢٨ پرۆژە لە تەنیشت نرخیان", "التزامات GitHub لـ28 مشروعًا بجانب أسعارها", "GitHub commits of 28 projects beside their price"),
     "فعالیت گیت‌هاب ارزها در برابر قیمت" + SITE_TAIL,
     "کامیت‌های هفتگی مخزن اصلی ۲۸ ارز دیجیتال در برابر قیمتشان؛ تغییر ۱۲ هفته‌ای توسعه و قیمت و فاصلهٔ این دو، رایگان و به چهار زبان.",
     ["گیت هاب", "github", "developer activity", "فعالیت توسعه", "کامیت", "altcoin"],
     L("پروژه‌ای که سازنده‌هایش بیشتر کار می‌کنند ولی قیمتش پایین آمده، یا برعکس: پروژه‌ای که قیمتش رفته ولی کسی رویش کار نمی‌کند",
       "پرۆژەیەک دروستکەرەکانی زیاتر کار دەکەن بەڵام نرخەکەی دابەزیوە، یان بە پێچەوانەوە",
       "مشروع يعمل مطوّروه أكثر بينما انخفض سعره، أو العكس: مشروع ارتفع سعره ولا يعمل عليه أحد",
       "A project whose builders work harder while its price fell, or the reverse: one whose price ran while nobody works on it"),
     {"fa": (["برای هر پروژه: کامیت‌های هفتگی مخزن اصلی‌اش در ۵۲ هفتهٔ اخیر و قیمت هفتگی. جدول، تغییر ۱۲ هفتهٔ اخیر توسعه را در برابر تغییر ۱۲ هفته‌ای قیمت می‌گذارد و <b>فاصله</b> = تغییر توسعه منهای تغییر قیمت.",
              "فاصلهٔ مثبت بزرگ یعنی کار فنی جلوتر از قیمت است؛ منفی بزرگ یعنی قیمت جلوتر از کار."],
             ["از آمار عمومی مشارکت GitHub (stats/participation) برای هر مخزن؛ ۱۲ هفتهٔ بسته‌شدهٔ اخیر با ۱۲ هفتهٔ قبلش مقایسه می‌شود. قیمت‌ها بستهٔ هفتگی USDT در Binance‌اند."],
             ["کامیت معیار ناقصی است: یک کامیت می‌تواند یک خط یا هزار خط باشد و بعضی پروژه‌ها در چند مخزن کار می‌کنند؛ فقط مخزن اصلی شمرده شده. توسعهٔ بیشتر یعنی ارزش بیشتر نیست."]),
      "ckb": (["بۆ هەر پرۆژەیەک: کۆمیتە هەفتانەکانی کۆگای سەرەکی لە ٥٢ هەفتەی دواییدا و نرخی هەفتانە. خشتەکە گۆڕانی ١٢ هەفتەی گەشەپێدان بەرامبەر گۆڕانی نرخ دادەنێت و <b>دووری</b> = گۆڕانی گەشەپێدان کەم گۆڕانی نرخ.",
               "دووریی پۆزەتیڤی گەورە واتە کاری تەکنیکی لە پێش نرخەوەیە."],
              ["لە ئاماری گشتیی بەشداریی GitHub؛ ١٢ هەفتەی داخراوی دوایی بەراورد دەکرێت بە ١٢ هەفتەی پێشتر. نرخەکان داخستنی هەفتانەی USDTن لە Binance."],
              ["کۆمیت پێوەرێکی ناتەواوە؛ تەنها کۆگای سەرەکی ژمێردراوە. گەشەپێدانی زیاتر واتای بەهای زیاتر نییە."]),
      "ar": (["لكل مشروع: الالتزامات الأسبوعية لمستودعه الرئيسي في آخر 52 أسبوعًا والسعر الأسبوعي. يضع الجدول تغير التطوير في 12 أسبوعًا مقابل تغير السعر، و<b>الفجوة</b> = تغير التطوير ناقص تغير السعر.",
              "الفجوة الموجبة الكبيرة تعني أن العمل التقني يسبق السعر؛ والسالبة الكبيرة أن السعر يسبق العمل."],
             ["من إحصاءات المشاركة العامة في GitHub (stats/participation) لكل مستودع؛ تُقارن آخر 12 أسبوعًا مغلقة بالـ12 قبلها. الأسعار إغلاقات أسبوعية بـUSDT في Binance."],
             ["الالتزام مقياس ناقص: قد يكون سطرًا أو ألف سطر، وبعض المشاريع تعمل في عدة مستودعات؛ عُدّ المستودع الرئيسي فقط. والتطوير الأكثر لا يعني قيمة أكثر."]),
      "en": (["For each project: weekly commits to its main repository over the last 52 weeks, and its weekly price. The table sets the last 12 weeks' change in development against the 12-week change in price; <b>gap</b> = development change minus price change.",
              "A large positive gap means the technical work is ahead of the price; a large negative one, the price is ahead of the work."],
             ["From GitHub's public participation statistics (stats/participation) for each repository; the last 12 closed weeks are compared with the 12 before them. Prices are weekly USDT closes on Binance."],
             ["Commits are a crude measure: one can be a line or a thousand, and some projects work across many repositories; only the main one is counted. More development is not more value."])})

page("drain", "exchange-drain", "lev", "cm",
     L("ساعت خالی شدن صرافی‌ها", "کاتژمێری بەتاڵبوونی ئاڵوگۆڕگەکان", "ساعة نفاد المنصات", "The exchange drain clock"),
     L("با سرعت فعلی خروج، چند سال تا خالی شدن صرافی‌ها مانده؛ و خروج چند برابر سکهٔ تازه است", "بە خێرایی ئێستای دەرچوون، چەند ساڵ ماوە تا بەتاڵبوونی ئاڵوگۆڕگەکان", "كم سنة حتى تفرغ المنصات بوتيرة الخروج الحالية، وكم ضعف الإصدار الجديد يخرج", "Years until exchanges run dry at today's outflow, and outflow against new issuance"),
     "ساعت خالی شدن صرافی‌ها از بیت‌کوین و اتریوم" + SITE_TAIL,
     "با سرعت خروج ۳۰ روز اخیر، ذخیرهٔ بیت‌کوین و اتریوم صرافی‌ها چند سال دیگر تمام می‌شود؟ و خروج چند برابر سکهٔ تازه استخراج‌شده است.",
     ["ذخیره صرافی", "exchange reserve", "supply shock", "خروج از صرافی", "issuance"],
     L("دو پرسش ساده: اگر خروج از صرافی‌ها با همین سرعت ادامه یابد کی تمام می‌شوند، و آیا بازار همهٔ سکهٔ تازه را می‌بلعد",
       "دوو پرسیاری سادە: ئەگەر دەرچوون بەم خێراییە بەردەوام بێت کەی تەواو دەبن، و ئایا بازاڕ هەموو دراوی نوێ هەڵدەمژێت",
       "سؤالان بسيطان: متى تفرغ المنصات لو استمر الخروج بهذه السرعة، وهل يبتلع السوق كل الإصدار الجديد",
       "Two simple questions: when would exchanges run dry if outflows kept this pace, and is the market swallowing all new supply"),
     {"fa": (["<b>تا خالی شدن</b>: موجودی امروز صرافی‌ها ÷ خروج خالص روزانهٔ ۳۰ روز اخیر، به سال (سقف ۵۰ سال). اگر ورود بیشتر از خروج باشد، ساعت می‌ایستد.",
              "<b>جذب عرضهٔ تازه</b>: خروج خالص ۳۰ روزه ÷ سکه‌های تازه استخراج‌شده در همان ۳۰ روز. بالای ۱ یعنی بازار بیش از همهٔ عرضهٔ تازه را از صرافی‌ها بیرون می‌کشد."],
             ["موجودی صرافی‌ها، ورود و خروج و صدور روزانه از Coin Metrics، برای بیت‌کوین و اتریوم؛ سهم عرضه روی صرافی‌ها هم کشیده شده."],
             ["یک برون‌یابی ساده است، نه پیش‌بینی: صرافی‌ها هرگز واقعاً خالی نمی‌شوند. جابه‌جایی کیف‌های صرافی یا خروج به امانت‌دار ETF می‌تواند عدد را جابه‌جا کند و Coin Metrics همهٔ صرافی‌ها را نمی‌شناسد. سوزاندن کارمزد اتریوم در صدور خالص لحاظ نشده."]),
      "ckb": (["<b>تا بەتاڵبوون</b>: باڵانسی ئەمڕۆی ئاڵوگۆڕگەکان ÷ دەرچوونی پوختەی ڕۆژانەی ٣٠ ڕۆژی ڕابردوو، بە ساڵ (سنووری ٥٠ ساڵ). ئەگەر هاتن زیاتر بێت، کاتژمێرەکە دەوەستێت.",
               "<b>هەڵمژینی دابینکراوی نوێ</b>: دەرچوونی پوختەی ٣٠ ڕۆژ ÷ دراوە نوێکانی هەمان ٣٠ ڕۆژ. سەرووی ١ واتە بازاڕ زیاتر لە هەموو دابینکراوی نوێ دەردەکێشێت."],
              ["باڵانس، هاتن و چوون و دەرکردنی ڕۆژانە لە Coin Metrics، بۆ بیتکۆین و ئیتریۆم."],
              ["دەرهێنانێکی سادەیە نەک پێشبینی: ئاڵوگۆڕگەکان هەرگیز بەڕاستی بەتاڵ نابن."]),
      "ar": (["<b>حتى النفاد</b>: رصيد المنصات اليوم ÷ صافي الخروج اليومي في آخر 30 يومًا، بالسنوات (حد 50 سنة). إن زاد الدخول على الخروج تتوقف الساعة.",
              "<b>امتصاص الإصدار</b>: صافي الخروج في 30 يومًا ÷ العملات المعدّنة حديثًا في الأيام نفسها. فوق 1 يعني أن السوق يسحب من المنصات أكثر من كل الإصدار الجديد."],
             ["الرصيد والدخول والخروج والإصدار اليومي من Coin Metrics للبيتكوين والإيثيريوم؛ وحصة المعروض على المنصات مرسومة أيضًا."],
             ["استقراء بسيط لا تنبؤ: المنصات لا تفرغ فعلًا أبدًا. نقل محافظ المنصات أو الخروج إلى أمين حفظ ETF قد يحرّك الرقم، وCoin Metrics لا يعرف كل المنصات. وحرق رسوم الإيثيريوم غير محسوب في الإصدار."]),
      "en": (["<b>Until dry</b>: exchanges' balance today ÷ the last 30 days' average daily net outflow, in years (capped at 50). If more flows in than out, the clock stops.",
              "<b>Issuance absorbed</b>: 30-day net outflow ÷ coins newly issued over the same 30 days. Above 1, the market pulls more off exchanges than all the new supply."],
             ["Exchange balances, inflows, outflows and daily issuance from Coin Metrics, for bitcoin and ether; the share of supply held on exchanges is drawn too."],
             ["A simple extrapolation, not a forecast: exchanges never really run dry. Exchange wallet reshuffles or moves to ETF custodians can shift the number, and Coin Metrics does not know every exchange. Ether's fee burn is not netted out of issuance."])})

# ================================================================ across chains, and patterns
page("breadth", "chain-breadth", "chains", "cm",
     L("پهنای بازار بین شبکه‌ها", "پانیی بازاڕ لە نێوان تۆڕەکاندا", "اتساع السوق بين الشبكات", "Market breadth across chains"),
     L("چند شبکهٔ بزرگ از ۷ شبکه در سود و بالای میانگین ۲۰۰ روزه‌اند", "چەند تۆڕی گەورە لە ٧ تۆڕ لە قازانجدان", "كم شبكة كبرى من 7 في ربح وفوق متوسط 200 يوم", "How many of 7 large chains are in profit and above their 200-day mean"),
     "پهنای بازار کریپتو: چند شبکه در سود است" + SITE_TAIL,
     "درصد ۷ شبکهٔ بزرگ (BTC، ETH، LTC، BCH، DOGE، ADA، XRP) که MVRV بالای ۱ دارند و قیمتشان بالای میانگین ۲۰۰ روزه است؛ بازار پهن یا باریک.",
     ["پهنای بازار", "market breadth", "MVRV", "میانگین ۲۰۰ روزه", "altcoins"],
     L("رالی فقط بیت‌کوین است یا همه با هم بالا می‌روند؟ مثل پهنای بازار سهام، برای کریپتو",
       "ئایا بەرزبوونەوەکە تەنها بیتکۆینە یان هەموو پێکەوە بەرز دەبنەوە؟",
       "هل الصعود للبيتكوين وحده أم يصعد الجميع معًا؟ اتساع السوق على طريقة الأسهم، للكريبتو",
       "Is it a bitcoin-only rally or is everything rising together? Stock-market breadth, for crypto"),
     {"fa": (["<b>در سود</b>: درصد شبکه‌هایی که MVRV آن‌ها بالای ۱ است، یعنی ارزش بازارشان بیشتر از بهای تمام‌شدهٔ دارندگانشان است. <b>بالای میانگین ۲۰۰</b>: درصد شبکه‌هایی که قیمتشان بالای میانگین ۲۰۰ روزهٔ خودش است.",
              "بالای ۵۰٪ یعنی بازار گسترده است؛ وقتی فقط بیت‌کوین در سود است، رالی باریک و شکننده‌تر است."],
             ["هر روز برای ۷ شبکه از دادهٔ Coin Metrics شمرده و با میانگین ۷ روزه صاف می‌شود؛ روزی که دست‌کم ۵ شبکه داده نداشته باشند کنار گذاشته می‌شود."],
             ["۷ شبکه کل بازار نیستند (توکن‌های روی اتریوم و سولانا در Coin Metrics رایگان نیستند). وزن همه برابر است، بزرگ و کوچک."]),
      "ckb": (["<b>لە قازانجدا</b>: لەسەدی ئەو تۆڕانەی MVRVیان سەرووی ١ـە. <b>سەرووی ناوەندی ٢٠٠</b>: لەسەدی ئەو تۆڕانەی نرخیان سەرووی ناوەندی ٢٠٠ ڕۆژەی خۆیەتی.",
               "سەرووی ٥٠٪ واتە بازاڕەکە فراوانە؛ کاتێک تەنها بیتکۆین لە قازانجدایە، بەرزبوونەوەکە تەسکە."],
              ["هەر ڕۆژێک بۆ ٧ تۆڕ لە داتای Coin Metrics دەژمێردرێت و بە ناوەندی ٧ ڕۆژ ساف دەکرێت."],
              ["٧ تۆڕ هەموو بازاڕ نین؛ کێشی هەموویان یەکسانە."]),
      "ar": (["<b>في ربح</b>: نسبة الشبكات التي MVRV لديها فوق 1، أي أن قيمتها السوقية أعلى من كلفة حائزيها. <b>فوق متوسط 200</b>: نسبة الشبكات التي سعرها فوق متوسطه لـ200 يوم.",
              "فوق 50% يعني سوقًا واسعًا؛ وحين يربح البيتكوين وحده يكون الصعود ضيقًا وأكثر هشاشة."],
             ["يُعدّ كل يوم لسبع شبكات من بيانات Coin Metrics ويُنعَّم بمتوسط 7 أيام؛ ويُترك اليوم الذي تغيب فيه بيانات أقل من 5 شبكات."],
             ["سبع شبكات ليست السوق كله (الرموز على إيثيريوم وسولانا ليست مجانية في Coin Metrics). ووزن الجميع متساوٍ."]),
      "en": (["<b>In profit</b>: the share of chains whose MVRV is above 1, meaning their market value exceeds what holders paid. <b>Above 200-day mean</b>: the share whose price is above its own 200-day average.",
              "Above 50% means a broad market; when only bitcoin is in profit, the rally is narrow and more fragile."],
             ["Counted every day for 7 chains from Coin Metrics data and smoothed with a 7-day mean; a day with fewer than 5 chains reporting is left out."],
             ["Seven chains are not the whole market (tokens on Ethereum and Solana are not in Coin Metrics' free data). Every chain weighs the same, big or small."])})

page("ethbtc", "eth-btc-profit-gap", "chains", "cm",
     L("شکاف سود اتریوم و بیت‌کوین", "بۆشایی قازانجی ئیتریۆم و بیتکۆین", "فجوة ربح الإيثيريوم والبيتكوين", "Ether against bitcoin: the profit gap"),
     L("دارندگان کدام پرسودترند، و این فاصله چقدر غیرعادی است", "خاوەنانی کامیان قازانجدارترن، و ئەم دوورییە چەند نائاساییە", "أي الحائزين أكثر ربحًا، وكم هذه الفجوة غير مألوفة", "Whose holders are further in profit, and how unusual the gap is"),
     "شکاف MVRV اتریوم و بیت‌کوین" + SITE_TAIL,
     "MVRV اتریوم منهای MVRV بیت‌کوین و امتیاز Z دو ساله‌اش، کنار نسبت ETH/BTC: وقتی دارندگان اتریوم نسبتاً کم‌سود یا پرسودند.",
     ["ETH/BTC", "اتریوم", "MVRV", "ethereum", "rotation"],
     L("به جای قیمت، سود کاغذی دارندگان را مقایسه می‌کند: اتریوم نسبت به بیت‌کوین «ارزان» است یا «گران»",
       "لە جیاتی نرخ، قازانجی کاغەزیی خاوەنان بەراورد دەکات: ئیتریۆم بە بەراورد بە بیتکۆین «هەرزان»ـە یان «گران»",
       "بدل السعر يقارن الربح الورقي للحائزين: هل الإيثيريوم «رخيص» أم «غالٍ» مقارنة بالبيتكوين",
       "Instead of price, it compares holders' paper profit: is ether cheap or expensive against bitcoin"),
     {"fa": (["<b>MVRV</b> = ارزش بازار ÷ ارزش تحقق‌یافته؛ نشان می‌دهد دارندگان به‌طور میانگین چند برابر بهای خریدشان دارند. <b>اختلاف</b> = MVRV اتریوم منهای بیت‌کوین.",
              "<b>امتیاز Z دو ساله</b> زیر ۱٫۵- یعنی دارندگان اتریوم نسبت به معمول خیلی کم‌سودترند (اتریوم نسبتاً ارزان)؛ بالای ۱٫۵ یعنی نسبتاً گران."],
             ["MVRV هر دو از Coin Metrics؛ Z = (اختلاف - میانگین ۷۳۰ روزه) ÷ انحراف معیار ۷۳۰ روزه. نسبت ETH/BTC روی مقیاس لگاریتمی."],
             ["ارزان می‌تواند ارزان‌تر شود؛ تغییرات ساختاری (استیکینگ، سوزاندن، ETFها) معنای MVRV اتریوم را عوض کرده‌اند."]),
      "ckb": (["<b>MVRV</b> = بەهای بازاڕ ÷ بەهای بەدیهاتوو. <b>جیاوازی</b> = MVRVی ئیتریۆم کەم بیتکۆین.",
               "<b>نمرەی Zی دوو ساڵە</b> خوار ١٫٥- واتە خاوەنانی ئیتریۆم زۆر کەم‌قازانجترن (ئیتریۆم بە ڕێژەیی هەرزانە)؛ سەرووی ١٫٥ واتە گران."],
              ["MVRVی هەردووکیان لە Coin Metrics؛ Z = (جیاوازی - ناوەندی ٧٣٠ ڕۆژ) ÷ لادانی ستانداردی ٧٣٠ ڕۆژ."],
              ["هەرزان دەتوانێت هەرزانتر بێت؛ گۆڕانکارییە پێکهاتەییەکان واتای MVRVی ئیتریۆمیان گۆڕیوە."]),
      "ar": (["<b>MVRV</b> = القيمة السوقية ÷ القيمة المحققة؛ يبيّن كم ضعفًا من كلفة الشراء يملك الحائزون في المتوسط. <b>الفرق</b> = MVRV الإيثيريوم ناقص البيتكوين.",
              "<b>درجة Z لعامين</b> تحت -1.5 تعني أن حائزي الإيثيريوم أقل ربحًا بكثير من المعتاد (الإيثيريوم رخيص نسبيًا)؛ وفوق 1.5 غالٍ نسبيًا."],
             ["MVRV للاثنين من Coin Metrics؛ Z = (الفرق - متوسط 730 يومًا) ÷ الانحراف المعياري لـ730 يومًا. ونسبة ETH/BTC على مقياس لوغاريتمي."],
             ["الرخيص قد يرخص أكثر؛ والتغيرات البنيوية (التخزين والحرق وصناديق ETF) غيّرت معنى MVRV الإيثيريوم."]),
      "en": (["<b>MVRV</b> = market value ÷ realized value: how many times their cost holders hold on average. <b>Spread</b> = ether's MVRV minus bitcoin's.",
              "A <b>two-year z-score</b> below -1.5 means ether holders are far less in profit than usual (ether relatively cheap); above 1.5, relatively expensive."],
             ["Both MVRVs from Coin Metrics; Z = (spread - its 730-day mean) ÷ its 730-day standard deviation. ETH/BTC on a log scale."],
             ["Cheap can get cheaper; structural changes (staking, the burn, ETFs) have shifted what ether's MVRV means."])})

page("elastic", "user-elasticity", "chains", "cm",
     L("کشش قیمت به کاربران", "نەرمیی نرخ بەرامبەر بەکارهێنەران", "مرونة السعر تجاه المستخدمين", "Price elasticity to users"),
     L("هر ۱٪ رشد کاربران فعال با چند درصد قیمت همراه بوده؛ آزمون زندهٔ قانون متکالف", "هەر ١٪ گەشەی بەکارهێنەرانی چالاک لەگەڵ چەند لەسەد نرخ بووە", "كل 1% نمو في المستخدمين النشطين رافقه كم في المئة من السعر", "How much price each 1% of active users came with: a live test of Metcalfe's law"),
     "کشش قیمت بیت‌کوین به کاربران فعال؛ متکالف" + SITE_TAIL,
     "شیب یک‌سالهٔ لگاریتم قیمت بیت‌کوین روی لگاریتم آدرس‌های فعال، به‌همراه R²: قیمت از کاربران جلو افتاده یا پشت سرشان مانده؟",
     ["قانون متکالف", "metcalfe", "آدرس فعال", "active addresses", "elasticity"],
     L("قانون متکالف می‌گوید ارزش شبکه با مجذور کاربران رشد می‌کند (کشش ۲)؛ این صفحه کشش واقعی هر سال را اندازه می‌گیرد",
       "یاسای مێتکاڵف دەڵێت بەهای تۆڕ بە دووجای بەکارهێنەران گەشە دەکات (نەرمیی ٢)؛ ئەم پەڕەیە نەرمیی ڕاستەقینەی هەر ساڵێک دەپێوێت",
       "يقول قانون ميتكالف إن قيمة الشبكة تنمو بمربع المستخدمين (مرونة 2)؛ هذه الصفحة تقيس المرونة الفعلية كل عام",
       "Metcalfe's law says a network's value grows with the square of its users (elasticity 2); this page measures the actual elasticity, year by year"),
     {"fa": (["<b>کشش</b>: در یک سال اخیر، هر ۱٪ تغییر در آدرس‌های فعال با چند درصد تغییر قیمت همراه بوده. ۲ یعنی دقیقاً مثل قانون متکالف؛ خیلی بالاتر یعنی قیمت از کاربران جلو افتاده؛ منفی یعنی قیمت برخلاف کاربران حرکت کرده و رشدش از جای دیگری (ETF، اهرم، خزانه‌داری شرکت‌ها) آمده.",
              "<b>R²</b> می‌گوید این رابطه چقدر محکم بوده؛ زیر ۰٫۲ یعنی کاربران چیز زیادی از قیمت را توضیح نمی‌دهند."],
             ["هر هفته، رگرسیون خطی لگاریتم قیمت روی لگاریتم میانگین ۳۰ روزهٔ آدرس‌های فعال در ۳۶۵ روز قبل؛ شیب = کشش. داده از Coin Metrics."],
             ["آدرس فعال آدم نیست و با تغییر عادت‌ها (لایه دوم، صرافی‌ها، اینسکریپشن‌ها) جابه‌جا می‌شود. هم‌حرکتی علیت نیست."]),
      "ckb": (["<b>نەرمی</b>: لە ساڵی ڕابردوودا هەر ١٪ گۆڕان لە ناونیشانە چالاکەکان لەگەڵ چەند لەسەد گۆڕانی نرخ بووە. ٢ واتە ڕێک وەک یاسای مێتکاڵف؛ نێگەتیڤ واتە نرخ بە پێچەوانەی بەکارهێنەران جووڵاوە.",
               "<b>R²</b> دەڵێت ئەم پەیوەندییە چەند توند بووە."],
              ["هەر هەفتەیەک، پاشەکشەی هێڵی لۆگاریتمی نرخ لەسەر لۆگاریتمی ناوەندی ٣٠ ڕۆژەی ناونیشانە چالاکەکان لە ٣٦٥ ڕۆژی پێشتردا."],
              ["ناونیشانی چالاک مرۆڤ نییە. هاوجووڵە هۆکار نییە."]),
      "ar": (["<b>المرونة</b>: خلال العام الماضي رافق كل تغير 1% في العناوين النشطة كم في المئة من تغير السعر. 2 يعني تمامًا كقانون ميتكالف؛ أعلى بكثير يعني أن السعر سبق المستخدمين؛ والسالب أن السعر تحرك عكسهم وجاء نموه من مكان آخر (صناديق ETF والرافعة وخزائن الشركات).",
              "<b>R²</b> يقول كم كانت العلاقة متينة؛ تحت 0.2 يعني أن المستخدمين لا يفسرون كثيرًا من السعر."],
             ["كل أسبوع انحدار خطي للوغاريتم السعر على لوغاريتم متوسط 30 يومًا للعناوين النشطة خلال 365 يومًا؛ الميل = المرونة. البيانات من Coin Metrics."],
             ["العنوان النشط ليس شخصًا ويتغير مع العادات (الطبقة الثانية والمنصات والنقوش). والتحرك المشترك ليس سببية."]),
      "en": (["<b>Elasticity</b>: over the past year, how many percent price moved for each 1% change in active addresses. 2 is Metcalfe's law exactly; far above means price ran ahead of users; negative means price moved against users and its growth came from elsewhere (ETFs, leverage, corporate treasuries).",
              "<b>R²</b> says how tight that relation was; below 0.2, users explain little of the price."],
             ["Every week, a linear regression of log price on the log of the 30-day mean of active addresses over the previous 365 days; the slope is the elasticity. Data from Coin Metrics."],
             ["An active address is not a person, and it shifts with habits (layer two, exchanges, inscriptions). Moving together is not causation."])})

page("weekend", "weekend-rhythm", "chains", "cm",
     L("ریتم آخر هفته", "ڕیتمی کۆتایی هەفتە", "إيقاع عطلة الأسبوع", "The weekend rhythm"),
     L("تراکنش‌های شنبه و یکشنبه در برابر روزهای کاری؛ سهم کسب‌وکارها و کاربران عادی", "مامەڵەکانی شەممە و یەکشەممە بەرامبەر ڕۆژانی کار", "معاملات السبت والأحد مقابل أيام العمل", "Saturday and Sunday transactions against weekdays: business against everyday users"),
     "ریتم آخر هفتهٔ تراکنش‌های بیت‌کوین و اتریوم" + SITE_TAIL,
     "نسبت میانگین تراکنش روزهای آخر هفته به روزهای کاری در بیت‌کوین و اتریوم از ۲۰۱۴: شبکه بیشتر ابزار کسب‌وکار است یا مردم عادی؟",
     ["تراکنش", "آخر هفته", "weekend", "transactions", "adoption"],
     L("کسب‌وکارها و نهادها آخر هفته تعطیل‌اند، مردم عادی نه؛ این نسبت ترکیب کاربران شبکه را لو می‌دهد",
       "کۆمپانیا و دامەزراوەکان کۆتایی هەفتە داخراون، خەڵکی ئاسایی نا؛ ئەم ڕێژەیە پێکهاتەی بەکارهێنەران ئاشکرا دەکات",
       "الشركات والمؤسسات تعطل في عطلة الأسبوع والناس العاديون لا؛ هذه النسبة تكشف تركيبة مستخدمي الشبكة",
       "Businesses and institutions rest at weekends, ordinary people do not; this ratio gives away who uses the network"),
     {"fa": (["هر میله یک هفته است: میانگین تراکنش شنبه و یکشنبه ÷ میانگین دوشنبه تا جمعه. زیر ۱ یعنی آخر هفته خلوت‌تر است و سهم کسب‌وکارها و نهادها پررنگ؛ نزدیک یا بالای ۱ یعنی کاربران فردی، یا فعالیت خودکاری مثل توکن‌سازی، شبکه را پر می‌کنند.",
              "خط زرد میانگین ۸ هفته است تا روند پیدا باشد."],
             ["تعداد تراکنش روزانه از Coin Metrics، هفته‌های دوشنبه تا یکشنبه به وقت جهانی (UTC)، از ۲۰۱۴."],
             ["روزهای کاری در همهٔ کشورها یکی نیست (مثلاً جمعه در بخشی از خاورمیانه) و UTC برای همه نیمه‌شب نیست. موج اینسکریپشن‌ها از ۲۰۲۳ تعداد تراکنش بیت‌کوین را جابه‌جا کرده."]),
      "ckb": (["هەر ستوونێک هەفتەیەکە: ناوەندی مامەڵەی شەممە و یەکشەممە ÷ ناوەندی دووشەممە تا هەینی. خوار ١ واتە کۆتایی هەفتە بێدەنگترە و بەشی کۆمپانیاکان دیارە؛ نزیک یان سەرووی ١ واتە بەکارهێنەری تاکەکەسی یان چالاکیی خۆکار تۆڕەکە پڕ دەکەن.",
               "هێڵی زەرد ناوەندی ٨ هەفتەیە."],
              ["ژمارەی مامەڵەی ڕۆژانە لە Coin Metrics، هەفتەی دووشەممە تا یەکشەممە بە کاتی جیهانی (UTC)، لە ٢٠١٤ـەوە."],
              ["ڕۆژانی کار لە هەموو وڵاتان یەک نییە. شەپۆلی ئینسکریپشنەکان لە ٢٠٢٣ـەوە ژمارەی مامەڵەکانی گۆڕیوە."]),
      "ar": (["كل عمود أسبوع: متوسط معاملات السبت والأحد ÷ متوسط الاثنين إلى الجمعة. تحت 1 يعني عطلة أهدأ وحصة بارزة للشركات والمؤسسات؛ قرب 1 أو فوقه يعني أن الأفراد أو نشاطًا آليًا كإصدار الرموز يملأ الشبكة.",
              "الخط الأصفر متوسط 8 أسابيع ليظهر الاتجاه."],
             ["عدد المعاملات اليومية من Coin Metrics، أسابيع من الاثنين إلى الأحد بالتوقيت العالمي (UTC)، منذ 2014."],
             ["أيام العمل ليست واحدة في كل البلدان (الجمعة في جزء من الشرق الأوسط مثلًا)، ومنتصف ليل UTC ليس منتصف ليل الجميع. وموجة النقوش منذ 2023 غيّرت عدد معاملات البيتكوين."]),
      "en": (["Each bar is a week: the average of Saturday's and Sunday's transactions ÷ the Monday-to-Friday average. Below 1, weekends are quieter and businesses and institutions weigh heavily; near or above 1, individuals or automated activity such as token minting fill the network.",
              "The yellow line is an 8-week mean, to show the trend."],
             ["Daily transaction counts from Coin Metrics, weeks from Monday to Sunday in universal time (UTC), from 2014."],
             ["Working days differ by country (Friday in parts of the Middle East, for instance) and UTC midnight is not everyone's. The inscription wave since 2023 has shifted bitcoin's transaction counts."])})

page("twin", "history-twin", "chains", "cm",
     L("همزاد تاریخی", "هاوشێوەی مێژوویی", "التوأم التاريخي", "History's twin"),
     L("سه مسیر ۱۸۰ روزهٔ گذشته که بیشترین شباهت را به امروز دارند، و آنچه بعدشان آمد", "سێ ڕێڕەوی ١٨٠ ڕۆژەی ڕابردوو کە زۆرترین لێکچوونیان لەگەڵ ئەمڕۆ هەیە", "ثلاثة مسارات من 180 يومًا تشبه اليوم أكثر، وما جاء بعدها", "The three past 180-day paths most like today, and what followed them"),
     "همزاد تاریخی بیت‌کوین؛ شبیه‌ترین گذشته" + SITE_TAIL,
     "سه دورهٔ ۱۸۰ روزهٔ تاریخ بیت‌کوین که شکل قیمتشان بیشترین شباهت را به ۱۸۰ روز اخیر دارد، هم‌مقیاس با امروز، با ۱۲۰ روز بعدشان.",
     ["الگوی تاریخی", "fractal", "فرکتال", "bitcoin history", "pattern"],
     L("شکل ۱۸۰ روز اخیر بیت‌کوین در گذشته کجا تکرار شده؟ سه شبیه‌ترین دوره، با ۱۲۰ روزی که بعدشان آمد",
       "شێوەی ١٨٠ ڕۆژی دوایی بیتکۆین لە ڕابردوودا لە کوێ دووبارە بووەتەوە؟",
       "أين تكرر شكل آخر 180 يومًا من البيتكوين في الماضي؟ أشبه ثلاث فترات مع الأيام الـ120 التي تلتها",
       "Where has the shape of bitcoin's last 180 days appeared before? The three closest periods, with the 120 days that came after"),
     {"fa": (["خط سفید ۱۸۰ روز اخیر است؛ سه خط رنگی شبیه‌ترین دوره‌های گذشته‌اند که هم‌مقیاس با امروز شده‌اند (هم‌سطح با قیمت امروز و با نوسان امروز) و ۱۲۰ روز بعدشان هم آمده.",
              "جدول، تاریخ شروع هر همزاد، میزان شباهت (۰ تا ۱)، و تغییر واقعی و هم‌مقیاس‌شدهٔ قیمت در ۱۲۰ روز بعد را می‌دهد."],
             ["لگاریتم قیمت روزانه از Coin Metrics؛ هر پنجرهٔ ۱۸۰ روزهٔ گذشته (با گام ۳ روز) استاندارد می‌شود و هم‌بستگی‌اش با ۱۸۰ روز اخیر حساب می‌شود؛ سه بهترین که دست‌کم یک سال با هم فاصله دارند انتخاب می‌شوند."],
             ["<b>شباهت شکل آینده را تضمین نمی‌کند</b>؛ همزادها اغلب نتیجه‌های متضاد دارند و این خودش درس است. این ابزار برای دیدن الگوهای گذشته است، نه پیش‌بینی."]),
      "ckb": (["هێڵی سپی ١٨٠ ڕۆژی دواییە؛ سێ هێڵە ڕەنگاوڕەنگەکە لێکچووترین سەردەمەکانی ڕابردوون کە بە پێوەری ئەمڕۆ کراون و ١٢٠ ڕۆژی دواتریشیان هاتووە.",
               "خشتەکە بەرواری دەستپێک، ڕێژەی لێکچوون و گۆڕانی نرخی ١٢٠ ڕۆژ دواتر دەدات."],
              ["لۆگاریتمی نرخی ڕۆژانە لە Coin Metrics؛ هەر پەنجەرەیەکی ١٨٠ ڕۆژە ستاندارد دەکرێت و هاوپەیوەندییەکەی لەگەڵ ١٨٠ ڕۆژی دوایی هەژمار دەکرێت؛ سێ باشترین کە لانیکەم ساڵێک لێک دوورن هەڵدەبژێردرێن."],
              ["<b>لێکچوونی شێوە داهاتوو گەرەنتی ناکات</b>؛ ئەم ئامرازە بۆ بینینی نەخشەکانی ڕابردووە نەک پێشبینی."]),
      "ar": (["الخط الأبيض آخر 180 يومًا؛ والخطوط الملونة الثلاثة أشبه فترات الماضي بعد معايرتها على اليوم (بمستوى سعر اليوم وتقلبه)، ومعها الأيام الـ120 التي تلتها.",
              "يعطي الجدول تاريخ بداية كل توأم ودرجة التشابه (0 إلى 1) والتغير الفعلي والمعاير للسعر بعد 120 يومًا."],
             ["لوغاريتم السعر اليومي من Coin Metrics؛ كل نافذة من 180 يومًا في الماضي (بخطوة 3 أيام) تُعيَّر ويُحسب ارتباطها بآخر 180 يومًا؛ وتُختار أفضل ثلاث تفصل بينها سنة على الأقل."],
             ["<b>تشابه الشكل لا يضمن المستقبل</b>؛ كثيرًا ما تنتهي التوائم بنتائج متعاكسة وهذا بحد ذاته درس. الأداة لرؤية أنماط الماضي لا للتنبؤ."]),
      "en": (["The white line is the last 180 days; the three coloured lines are the most similar past periods, scaled to today (to today's price level and today's volatility), with the 120 days that followed them.",
              "The table gives each twin's start date, its similarity (0 to 1), and the actual and scaled price change over the next 120 days."],
             ["Log daily price from Coin Metrics; every past 180-day window (in 3-day steps) is standardized and correlated with the last 180 days; the best three at least a year apart are kept."],
             ["<b>A similar shape does not promise the future</b>; twins often end in opposite ways, which is the lesson in itself. This is for seeing past patterns, not for forecasting."])})

ORDER = [g for g, _ in GROUPS]
R.sort(key=lambda r: ORDER.index(r["g"]))


# ================================================================ what build_obs.py takes from here
def folder(r):
    return f"rare/{r['slug']}"


def path(r):
    return f"/charts/{folder(r)}/"


def t_entry(r):
    ab = {}
    for lg in LANGS:
        shows, how, lim = r["ab"][lg]
        h = HEAD[lg]
        ab[lg] = [(h[0], [digits(x, lg) for x in shows]), (h[1], [digits(x, lg) for x in how]),
                  (h[2], [digits(x, lg) for x in lim] + [digits(SRC[r["src"]][lg], lg), EDU[lg]])]
    return {"title": r["title"], "desc": r["desc"], "og": r["t"]["fa"] + " — شاخص کمیاب رصدخانه",
            "ld": "Entekhab rare indicator: " + r["t"]["en"], "kw": r["kw"],
            "h1": {lg: digits(r["t"][lg], lg) for lg in LANGS}, "p": {lg: digits(r["p"][lg], lg) for lg in LANGS}, "about": ab}


INDEX_T = {
    "title": "شاخص‌های کمیاب آنچین کریپتو، رایگان | entekhab.net",
    "desc": "۲۲ شاخص آنچین و بازار که کمتر جایی پیدا می‌شوند: سرعت چاپ استیبل‌کوین، نسل سکه‌ها، بهای نهنگ‌ها، واگرایی فاندینگ، نبض توسعه و همزاد تاریخی.",
    "og": "شاخص‌های کمیاب — رصدخانهٔ بازار",
    "ld": "Entekhab rare on-chain indicators",
    "kw": ["شاخص آنچین", "اندیکاتور آنچین", "on-chain indicators", "rare indicators", "شاخص کمیاب"],
    "h1": L("شاخص‌های کمیاب", "پێوەرە دەگمەنەکان", "المؤشرات النادرة", "Rare indicators"),
    "p": LD("22 شاخص که کمتر جایی دیده‌اید، هر کدام با خوانش امروزش؛ از دادهٔ عمومی و رایگان، با روش نوشته‌شده",
            "22 پێوەر کە کەمتر لە شوێنێک بینیوتانە، هەر یەکە بە خوێندنەوەی ئەمڕۆی؛ لە داتای گشتی و بێبەرامبەرەوە",
            "22 مؤشرًا قلّما رأيتها في مكان آخر، كل منها بقراءة اليوم؛ من بيانات عامة مجانية وبمنهج مكتوب",
            "22 indicators you rarely see anywhere else, each with today's reading; from free public data, with the method written down"),
    "about": {
        "fa": [("این بخش چیست", ["هر کارت یک شاخص است و خط پایینش «خوانش امروز» همان شاخص است که با هر به‌روزرسانی داده عوض می‌شود. روی کارت بزنید تا نمودار کامل، روش محاسبه و محدودیت‌هایش را ببینید.",
                                   "بیشتر این شاخص‌ها ترکیب تازه‌ای از داده‌های عمومی‌اند (Coin Metrics، Bitcoin Research Kit، DefiLlama، Binance، OKX و GitHub) و چند تایشان ابداعی و تجربی‌اند؛ هر صفحه این را صادقانه نوشته."]),
               ("محدودیت‌ها", ["دو ایده عمداً کنار گذاشته شد چون دادهٔ رایگان و دقیقش نیست: ورود استیبل‌کوین به خود صرافی‌ها و بهای تمام‌شدهٔ معدنچیان.", digits(EDU["fa"], "fa")])],
        "ckb": [("ئەم بەشە چییە", ["هەر کارتێک پێوەرێکە و هێڵی خوارەوەی «خوێندنەوەی ئەمڕۆ»ـیەتی کە لەگەڵ هەر نوێکردنەوەیەک دەگۆڕێت. کرتە بکە بۆ بینینی چارتی تەواو، ڕێگای هەژمار و سنوورەکانی.",
                                     "زۆربەی ئەم پێوەرانە تێکەڵەیەکی نوێن لە داتای گشتی و چەندانێکیان داهێنراو و تاقیکارین؛ هەر پەڕەیەک ئەمەی بە ڕاستگۆیی نووسیوە."]),
                ("سنوورەکان", ["دوو بیرۆکە بە ئەنقەست لابراون چونکە داتای بێبەرامبەر و وردیان نییە: چوونی ستەیبڵکۆین بۆ ناو ئاڵوگۆڕگەکان و تێچووی کانکاران.", EDU["ckb"]])],
        "ar": [("ما هذا القسم", ["كل بطاقة مؤشر، وسطرها الأخير «قراءة اليوم» التي تتغير مع كل تحديث للبيانات. اضغط على البطاقة لترى الرسم الكامل وطريقة الحساب والحدود.",
                                   "معظم هذه المؤشرات تركيبات جديدة من بيانات عامة (Coin Metrics وBitcoin Research Kit وDefiLlama وBinance وOKX وGitHub)، وبعضها مبتكر وتجريبي؛ وكل صفحة تقول ذلك بصدق."]),
               ("الحدود", ["تُركت فكرتان عمدًا لعدم وجود بيانات مجانية دقيقة لهما: تدفق العملات المستقرة إلى المنصات نفسها، وكلفة المعدّنين.", EDU["ar"]])],
        "en": [("What this is", ["Each card is one indicator, and its bottom line is that indicator's reading of today, which changes with every data update. Tap a card for the full chart, the method and the limits.",
                                   "Most are new combinations of public data (Coin Metrics, the Bitcoin Research Kit, DefiLlama, Binance, OKX and GitHub), and a few are original and experimental; each page says so honestly."]),
               ("Limits", ["Two ideas were left out on purpose because there is no accurate free data for them: stablecoin inflows to exchanges themselves, and miners' cost basis.", EDU["en"]])],
    },
}
INDEX_T["about"]["ckb"] = [(h, [digits(x, "ckb") for x in xs]) for h, xs in INDEX_T["about"]["ckb"]]
INDEX_T["about"]["ar"] = [(h, [digits(x, "ar") for x in xs]) for h, xs in INDEX_T["about"]["ar"]]
INDEX_T["about"]["fa"] = [(h, [digits(x, "fa") for x in xs]) for h, xs in INDEX_T["about"]["fa"]]


def list_json():
    """the list of pages for assets/obs/rare.js, written into each page (not executed: a JSON data block)"""
    doc = {"groups": [{"k": k, "t": t} for k, t in GROUPS],
           "pages": [{"id": r["id"], "path": path(r), "g": r["g"], "t": r["t"], "d": r["d"]} for r in R]}
    s = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    return s.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def with_list(doc):
    tag = f'<script type="application/json" id="rr-list">{list_json()}</script>\n'
    return doc.replace("</main>", tag + "</main>", 1)


HUB_SEC = (L("شاخص‌های کمیاب", "پێوەرە دەگمەنەکان", "المؤشرات النادرة", "Rare indicators"),
           [("/charts/rare/", True, L("همهٔ شاخص‌های کمیاب، با خوانش امروز", "هەموو پێوەرە دەگمەنەکان، بە خوێندنەوەی ئەمڕۆ", "كل المؤشرات النادرة بقراءة اليوم", "All rare indicators, with today's reading"),
             LD("22 شاخص که کمتر جایی پیدا می‌شوند، در یک صفحه", "22 پێوەر کە کەمتر لە شوێنێک دەدۆزرێنەوە، لە یەک پەڕەدا", "22 مؤشرًا نادرًا في صفحة واحدة", "22 indicators you rarely find elsewhere, on one page"))]
           + [(path(r), True, {lg: digits(r["t"][lg], lg) for lg in LANGS}, {lg: digits(r["d"][lg], lg) for lg in LANGS}) for r in R])

DOOR_NAME = ("ایستگاه دوردست", "وێستگەی دوور", "المحطة البعيدة", "The far station")
SCRIPTS = ["ts.js", "rare.js"]


def hook(B):
    """called once by scripts/build_obs.py with its globals"""
    B["PAGES"].append(("rare", "rare", SCRIPTS))
    B["T"]["rare"] = INDEX_T
    B["DOOR"]["rare"] = ("iris", "#ffcf6b", DOOR_NAME)
    B["CSS"]["rare"] = ["rare.css"]
    for r in R:
        v = "r_" + r["id"]
        B["T"][v] = t_entry(r)
        B["DOOR"][v] = ("iris", "#ffcf6b", DOOR_NAME)
        B["CSS"][v] = ["rare.css"]
    B["HUB"]["secs"].append(HUB_SEC)
    folders0, catalog0, main0, write0 = B["folders"], B["catalog"], B["main"], B["write"]
    hub_path = B["HUB_PATH"]

    def folders():
        return folders0() + [f"{hub_path}/{folder(r)}" for r in R]

    def catalog():
        return catalog0() + [(path(r), B["T"]["r_" + r["id"]]["h1"], B["T"]["r_" + r["id"]]["p"], r["kw"]) for r in R]

    def write(rel, doc):
        # every rare page and the rare index carry the list of rare pages for rare.js
        if rel == f"{hub_path}/rare" or rel.startswith(f"{hub_path}/rare/"):
            doc = with_list(doc)
        write0(rel, doc)

    def main():
        main0()
        for r in R:
            v = "r_" + r["id"]
            t = B["T"][v]
            assert len(t["title"]) <= 60, (v, "title", len(t["title"]))
            assert len(t["desc"]) <= 160, (v, "description", len(t["desc"]))
            for lg in LANGS:
                assert t["h1"].get(lg) and t["p"].get(lg) and t["about"].get(lg), (v, lg)
            write(f"{hub_path}/{folder(r)}", B["page"](v, folder(r), SCRIPTS))
            print(f"/{hub_path}/{folder(r)}/ written (title {len(t['title'])}, description {len(t['desc'])} characters)")

    B["folders"], B["catalog"], B["main"], B["write"] = folders, catalog, main, write
