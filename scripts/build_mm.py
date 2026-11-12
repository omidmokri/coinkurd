#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The market map's five static pages — /heatmap/ /bubbles/ /money-flow/ /liquidity/ /etf/ — one app (assets/mm/*),
five doors, each with its own title, description and readable text in کوردی · فارسی · العربية · English for search
engines and for visitors without JavaScript. The shared header, footer and CSP are put in by scripts/chrome.py
(these folders are in chrome.STATIC; build_pages.py refreshes them on every CI run).

Run: python3 scripts/build_mm.py && python3 scripts/chrome.py
"""
import html
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://entekhab.net"
V = "1"            # asset version (bump with any change to assets/mm/*)
LANGS = ("fa", "ckb", "ar", "en")


def e(s):
    return html.escape(str(s), quote=True)


# view key, folder, script of the first view
PAGES = [("heatmap", "heatmap", "heat.js"), ("bubbles", "bubbles", "bubbles.js"), ("flow", "money-flow", "flow.js"),
         ("liq", "liquidity", "liq.js"), ("etf", "etf", "etf.js")]

T = {
    "heatmap": {
        "title": "نقشهٔ حرارتی بازار کریپتو، زنده و سه‌بعدی | entekhab.net",
        "desc": "نقشهٔ حرارتی ۲۵۰ ارز برتر با دادهٔ زندهٔ بایننس: ۵ دقیقه تا ۱ سال، گروه‌بندی بخش‌ها، نمای سه‌بعدی شهر بازار و پنل کامل هر ارز.",
        "og": "نقشهٔ حرارتی بازار کریپتو — زنده، دوبعدی و سه‌بعدی",
        "h1": {"fa": "نقشهٔ حرارتی بازار کریپتو", "ckb": "نەخشەی گەرمیی بازاڕی کریپتۆ", "ar": "الخريطة الحرارية لسوق العملات المشفرة", "en": "Crypto market heatmap"},
        "p": {"fa": "اندازهٔ هر ارز به ارزش بازارش و رنگش به حرکتش — از ۵ دقیقه تا یک سال، دوبعدی یا سه‌بعدی، زنده از بایننس",
              "ckb": "قەبارەی هەر دراوێک بەپێی بەهای بازاڕەکەی و ڕەنگەکەی بەپێی جووڵەکەی — لە ٥ خولەکەوە تا ساڵێک، دوو یان سێ ڕەهەندی، زیندوو لە بایننسەوە",
              "ar": "حجم كل عملة بقيمتها السوقية ولونها بحركتها — من ٥ دقائق إلى سنة، ثنائي أو ثلاثي الأبعاد، مباشرة من Binance",
              "en": "Every coin sized by its market cap and coloured by its move — 5 minutes to a year, in 2D or 3D, live from Binance"},
        "about": {
            "fa": [("این نقشه چه نشان می‌دهد", ["<b>همهٔ بازار در یک نگاه:</b> تا ۲۵۰ ارز بزرگ، هر کاشی به اندازهٔ ارزش بازار (یا حجم، شدت حرکت، جریان پول یا یکسان) و به رنگ تغییر قیمتش.",
                                              "<b>۹ تایم‌فریم:</b> ۵ و ۱۵ دقیقه، ۱، ۲ و ۴ ساعت، روزانه، هفتگی، ماهانه و سالانه — با کلیدهای ۱ تا ۹ هم عوض می‌شوند.",
                                              "<b>بخش‌های بازار:</b> بیت‌کوین، پلتفرم‌های قرارداد هوشمند، دیفای، لایهٔ دوم، هوش مصنوعی، میم‌ها، دارایی‌های واقعی، توکن صرافی‌ها و…؛ با کلیک روی عنوان هر بخش، همان بخش بزرگ می‌شود.",
                                              "<b>سه‌بعدی:</b> «شهر بازار» — هر ارز یک برج روی سکوی بخش خودش، ارتفاع به اندازهٔ قدرت حرکت؛ بچرخانید، بزرگ‌نمایی کنید و روی هر برج بزنید.",
                                              "<b>پنل کامل هر ارز:</b> قیمت زنده، تغییر در ۹ تایم‌فریم، ارزش بازار و عرضه، سقف و کف تاریخی، نمودار شمعی، جریان پول خرید و فروش، دفتر سفارش، فاندینگ و اوپن اینترست، یافته‌های اسکنر انتخاب و مبدل دلار و تومان.",
                                              "<b>ابزارها:</b> جست‌وجو، فیلتر صعودی/نزولی و دیده‌بان، رنگ مناسب کوررنگی، تصویر PNG برای اشتراک، لینک اشتراک و تمام‌صفحه."]),
                   ("داده‌ها از کجا می‌آیند", ["قیمت‌ها و تغییرات کوتاه‌مدت زنده از دادهٔ عمومی بایننس؛ ارزش بازار، عرضه و تغییرات بلندمدت از CoinGecko در نسخهٔ پشتیبان سایت (هر حدود ۱۵ دقیقه). ارزی که در بایننس نیست مقادیر پشتیبان را نشان می‌دهد و عددی که منبعی نداده «—» است.",
                                               "هر ارز با لوگوی خودش نمایش داده می‌شود و برای اینترنت ضعیف «صرفه‌جویی در داده» در تنظیمات هست."])],
            "ckb": [("ئەم نەخشەیە چی پیشان دەدات", ["<b>هەموو بازاڕ بە یەک نیگا:</b> تا ٢٥٠ دراوی گەورە، هەر خانەیەک بە قەبارەی بەهای بازاڕ (یان قەبارەی مامەڵە، هێزی جووڵە، ڕەوتی پارە یان یەکسان) و بە ڕەنگی گۆڕانی نرخەکەی.",
                                                 "<b>٩ تایمفرەیم:</b> ٥ و ١٥ خولەک، ١، ٢ و ٤ کاتژمێر، ڕۆژانە، هەفتانە، مانگانە و ساڵانە.",
                                                 "<b>بەشەکانی بازاڕ:</b> بیتکۆین، پلاتفۆرمەکانی گرێبەستی زیرەک، دیفای، چینی دووەم، زیرەکیی دەستکرد، میمەکان و…؛ کرتە لەسەر ناونیشانی هەر بەشێک ئەو بەشە گەورە دەکات.",
                                                 "<b>سێ ڕەهەندی:</b> «شاری بازاڕ» — هەر دراوێک تاوەرێک لەسەر سەکۆی بەشی خۆی، بەرزی بەپێی هێزی جووڵە.",
                                                 "<b>پانێلی تەواوی هەر دراوێک:</b> نرخی زیندوو، گۆڕان لە ٩ تایمفرەیمدا، بەهای بازاڕ و خستنەڕوو، چارتی مۆمی، ڕەوتی پارە، دەفتەری داواکاری، فەندینگ و گۆڕەری دۆلار و تمەن."]),
                    ("داتاکان لە کوێوە دێن", ["نرخەکان زیندوو لە داتای گشتیی بایننسەوە؛ بەهای بازاڕ، خستنەڕوو و گۆڕانە درێژخایەنەکان لە CoinGeckoـەوە لە پاشەکەوتی ماڵپەڕدا (نزیکەی هەر ١٥ خولەک). هەر دراوێک بە لۆگۆی خۆی پیشان دەدرێت."])],
            "ar": [("ماذا تُظهر هذه الخريطة", ["<b>السوق كله بنظرة واحدة:</b> حتى ٢٥٠ عملة كبيرة، كل مربع بحجم القيمة السوقية (أو الحجم أو قوة الحركة أو تدفق الأموال أو بالتساوي) وبلون تغير السعر.",
                                             "<b>٩ أطر زمنية:</b> ٥ و١٥ دقيقة، ساعة وساعتان و٤ ساعات، يومي وأسبوعي وشهري وسنوي.",
                                             "<b>قطاعات السوق:</b> البيتكوين، منصات العقود الذكية، التمويل اللامركزي، الطبقة الثانية، الذكاء الاصطناعي، عملات الميم…؛ الضغط على عنوان القطاع يكبّره.",
                                             "<b>ثلاثي الأبعاد:</b> «مدينة السوق» — كل عملة برج على منصة قطاعها، ارتفاعه بقوة الحركة.",
                                             "<b>لوحة كاملة لكل عملة:</b> السعر المباشر، التغير في ٩ أطر، القيمة السوقية والمعروض، رسم الشموع، تدفق الأموال، دفتر الأوامر، التمويل، ومحوّل الدولار والتومان."]),
                   ("من أين تأتي البيانات", ["الأسعار مباشرة من بيانات Binance العامة؛ القيمة السوقية والمعروض والتغيرات الطويلة من CoinGecko في النسخة الاحتياطية للموقع (كل ١٥ دقيقة تقريبًا). تظهر كل عملة بشعارها."])],
            "en": [("What the map shows", ["<b>The whole market at a glance:</b> up to 250 large coins, each tile sized by market cap (or volume, size of the move, money flow, or equal) and coloured by its price change.",
                                          "<b>Nine timeframes:</b> 5 and 15 minutes, 1, 2 and 4 hours, a day, a week, a month and a year — keys 1 to 9 switch them.",
                                          "<b>Market sectors:</b> Bitcoin, smart-contract platforms, DeFi, layer 2, AI, memes, real-world assets, exchange tokens and more; click a sector’s header to zoom into it.",
                                          "<b>3D:</b> the “market city” — every coin a tower on its sector’s platform, as tall as its move; turn it, zoom it, tap a tower.",
                                          "<b>A full panel for every coin:</b> live price, change over nine timeframes, market cap and supply, all-time high and low, candles, buy/sell money flow, the order book, funding and open interest, Entekhab’s scanner findings and a dollar/toman converter.",
                                          "<b>Tools:</b> search, gainers/losers and watchlist filters, colour-blind colours, a PNG picture to share, a share link and full screen."]),
                   ("Where the data comes from", ["Prices and short-term changes come live from Binance’s public data; market caps, supply and longer changes from CoinGecko in the site’s snapshot (about every 15 minutes). A coin not on Binance shows its snapshot values, and a number no source gave is “—”.",
                                                  "Every coin is shown with its own logo, and there is a Data Saver in the settings for slow connections."])],
        },
    },
    "bubbles": {
        "title": "حباب‌های بازار کریپتو، زنده و سه‌بعدی | entekhab.net",
        "desc": "حباب‌های زندهٔ ۲۵۰ ارز برتر: اندازه به شدت حرکت، رنگ به جهت آن، در ۹ تایم‌فریم از ۵ دقیقه تا ۱ سال؛ بکشید، فیلتر کنید و هر ارز را کامل ببینید.",
        "og": "حباب‌های بازار کریپتو — زنده و سه‌بعدی",
        "h1": {"fa": "حباب‌های بازار کریپتو", "ckb": "بڵقەکانی بازاڕی کریپتۆ", "ar": "فقاعات سوق العملات المشفرة", "en": "Crypto bubbles"},
        "p": {"fa": "بازار به شکل حباب‌های زنده: اندازه = شدت حرکت، رنگ = جهت آن — بکشیدشان و روی هرکدام بزنید تا همه‌چیزش را ببینید",
              "ckb": "بازاڕ وەک بڵقی زیندوو: قەبارە = هێزی جووڵە، ڕەنگ = ئاراستەکەی — ڕایانبکێشە و دەست لە هەرکامیان بدە",
              "ar": "السوق كفقاعات حية: الحجم = قوة الحركة، واللون = اتجاهها — اسحبها واضغط على أي منها",
              "en": "The market as living bubbles: size = the move, colour = its direction — drag them, tap one for everything about it"},
        "about": {
            "fa": [("این حباب‌ها چه می‌گویند", ["<b>هر حباب یک ارز:</b> اندازه به شدت حرکت قیمت (یا ارزش بازار، حجم یا جریان پول)، رنگ سبز یا قرمز به جهت آن و هالهٔ نور به قدرتش.",
                                               "<b>۱ تا ۲۵۰:</b> رتبه‌های ۱ تا ۱۰۰، ۱۰۱ تا ۲۰۰ و بعد؛ با فیلتر صعودی‌ها، نزولی‌ها، دیده‌بان، استیبل‌کوین‌ها و بخش‌ها.",
                                               "<b>دنیای فیزیکی:</b> حباب‌ها را بکشید و پرتاب کنید؛ هر حباب کرهٔ براق نورپردازی‌شده‌ای با لوگو، نماد و درصد تغییر است.",
                                               "<b>سه‌بعدی:</b> همان حباب‌ها به شکل کره‌های براق در فضا که می‌چرخند؛ هر کره را بزنید تا پنل ارز باز شود.",
                                               "<b>پنل هر ارز:</b> قیمت زنده، تغییر در ۹ تایم‌فریم، نمودار شمعی، جریان خرید و فروش و معاملات بزرگ زنده، دفتر سفارش، فاندینگ و هشدار قیمت در ربات تلگرام."]),
                   ("داده‌ها", ["قیمت زنده از بایننس؛ ارزش بازار و تغییرات بلندمدت از CoinGecko در نسخهٔ پشتیبان سایت. توصیهٔ مالی نیست."])],
            "ckb": [("ئەم بڵقانە چی دەڵێن", ["<b>هەر بڵقێک دراوێکە:</b> قەبارە بەپێی هێزی جووڵەی نرخ (یان بەهای بازاڕ، قەبارەی مامەڵە یان ڕەوتی پارە)، ڕەنگی سەوز یان سوور بەپێی ئاراستەکەی.",
                                            "<b>١ تا ٢٥٠:</b> پلەکانی ١ تا ١٠٠، ١٠١ تا ٢٠٠ و دواتر؛ بە فلتەری بەرزبووەکان، دابەزیوەکان، لیستی چاودێری و بەشەکان.",
                                            "<b>سێ ڕەهەندی:</b> هەمان بڵقەکان وەک گۆی بریسکەدار لە بۆشاییدا."]),
                    ("داتا", ["نرخی زیندوو لە بایننسەوە؛ بەهای بازاڕ و گۆڕانە درێژخایەنەکان لە CoinGeckoـەوە. ئامۆژگاریی دارایی نییە."])],
            "ar": [("ماذا تقول هذه الفقاعات", ["<b>كل فقاعة عملة:</b> حجمها بقوة حركة السعر (أو القيمة السوقية أو الحجم أو تدفق الأموال)، ولونها الأخضر أو الأحمر باتجاهها.",
                                              "<b>من ١ إلى ٢٥٠:</b> المراتب ١–١٠٠ و١٠١–٢٠٠ وما بعدها؛ مع تصفية الرابحة والخاسرة وقائمة المتابعة والقطاعات.",
                                              "<b>ثلاثي الأبعاد:</b> الفقاعات نفسها ككرات لامعة تدور في الفضاء."]),
                   ("البيانات", ["السعر المباشر من Binance؛ القيمة السوقية والتغيرات الطويلة من CoinGecko. ليست نصيحة مالية."])],
            "en": [("What the bubbles say", ["<b>Every bubble is a coin:</b> sized by the strength of its move (or market cap, volume or money flow), green or red by its direction, with a glow that grows with the move.",
                                            "<b>1 to 250:</b> ranks 1–100, 101–200 and on; filters for gainers, losers, your watchlist, stablecoins and sectors.",
                                            "<b>A physical world:</b> drag and throw the bubbles; each is a lit, glossy sphere with its logo, symbol and change.",
                                            "<b>3D:</b> the same bubbles as glossy spheres turning in space; tap one for its panel.",
                                            "<b>Every coin’s panel:</b> live price, change over nine timeframes, candles, buy/sell flow and large trades as they happen, the order book, funding and a price alert in the Telegram bot."]),
                   ("Data", ["Live prices from Binance; market caps and longer changes from CoinGecko in the site’s snapshot. Not financial advice."])],
        },
    },
    "flow": {
        "title": "جریان پول بازار کریپتو: ورود و خروج سرمایه | entekhab.net",
        "desc": "جریان پول کریپتو در ۹ تایم‌فریم: خرید و فروش تهاجمی هر ارز و بخش، رود جریان بخش‌ها، چاپ و سوختن استیبل‌کوین، دامیننس و اهرم بازار.",
        "og": "جریان پول بازار کریپتو — ورود و خروج سرمایه در هر بخش",
        "h1": {"fa": "جریان پول بازار کریپتو", "ckb": "ڕەوتی پارەی بازاڕی کریپتۆ", "ar": "تدفق الأموال في سوق العملات المشفرة", "en": "Crypto money flow"},
        "p": {"fa": "پول به کدام سو فشار می‌آورد: خرید و فروش تهاجمی هر ارز و هر بخش، چاپ و سوزاندن استیبل‌کوین، دامیننس و اهرم",
              "ckb": "پارە بەرەو کوێ پاڵ دەنێت: کڕین و فرۆشتنی هێرشبەرانەی هەر دراو و بەشێک، ستەیبڵکۆین، باڵادەستی و لێڤەرێج",
              "ar": "إلى أين تضغط الأموال: الشراء والبيع العدواني لكل عملة وقطاع، العملات المستقرة، الهيمنة والرافعة",
              "en": "Where money is pushing: aggressive buys vs sells by coin and sector, stablecoin mint & burn, dominance and leverage"},
        "about": {
            "fa": [("در این صفحه", ["<b>جریان خالص اسپات:</b> خرید تهاجمی منهای فروش تهاجمی هر ارز در بایننس، برای ۵ دقیقه تا ۱ سال، و سهم خریداران از حجم.",
                                   "<b>رود جریان بخش‌ها:</b> کدام بخش‌ها پول جذب کردند و کدام از دست دادند — با جریان تهاجمی یا تغییر ارزش بازار.",
                                   "<b>پیشتازان ورود و خروج:</b> ده ارزی که بیشترین خرید و ده ارزی که بیشترین فروش تهاجمی را داشتند.",
                                   "<b>جریان در برابر قیمت:</b> نمودار چهارناحیه‌ای برای دیدن جذب (خرید در افت) و توزیع (فروش در رشد).",
                                   "<b>استیبل‌کوین‌ها:</b> عرضهٔ تتر، USDC و بقیه، و تغییر ۲۴ ساعته، ۷ روزه و ۳۰ روزه — نشانهٔ ورود یا خروج دلار تازه.",
                                   "<b>دامیننس و اهرم:</b> سهم بیت‌کوین، اتریوم و استیبل‌کوین‌ها در ۳۰ روز، اوپن اینترست و داغ‌ترین و سردترین فاندینگ‌ها."]),
                   ("روش و منابع", ["جریان از کندل‌های بایننس (حجم خرید تیکر) محاسبه می‌شود و هر معامله خریدار و فروشنده دارد؛ پس جریان یعنی کدام طرف تهاجمی بود. استیبل‌کوین از DefiLlama، دامیننس از CoinGecko و مشتقات از OKX. توصیهٔ مالی نیست."])],
            "ckb": [("لەم پەڕەیەدا", ["<b>ڕەوتی خاوێنی سپۆت:</b> کڕینی هێرشبەرانە کەم فرۆشتنی هێرشبەرانەی هەر دراوێک لە بایننس، بۆ ٥ خولەک تا ١ ساڵ.",
                                     "<b>ڕووباری ڕەوتی بەشەکان:</b> کام بەش پارەی ڕاکێشا و کام لەدەستی دا.",
                                     "<b>ستەیبڵکۆینەکان:</b> خستنەڕووی تەتەر، USDC و ئەوانی تر و گۆڕانی ٢٤ کاتژمێر، ٧ ڕۆژ و ٣٠ ڕۆژ.",
                                     "<b>باڵادەستی و لێڤەرێج:</b> بەشی بیتکۆین و ئیسیریۆم و ستەیبڵکۆین لە ٣٠ ڕۆژدا، ئۆپن ئینتەرێست و فەندینگ."]),
                    ("ڕێگا و سەرچاوەکان", ["ڕەوت لە مۆمەکانی بایننسەوە دەژمێردرێت؛ ستەیبڵکۆین لە DefiLlama، باڵادەستی لە CoinGecko و دەرهاتەکان لە OKX. ئامۆژگاریی دارایی نییە."])],
            "ar": [("في هذه الصفحة", ["<b>صافي التدفق الفوري:</b> الشراء العدواني ناقص البيع العدواني لكل عملة في Binance، من ٥ دقائق إلى سنة.",
                                     "<b>نهر تدفق القطاعات:</b> أي القطاعات جذبت الأموال وأيها فقدتها.",
                                     "<b>العملات المستقرة:</b> معروض تيثر وUSDC وغيرهما وتغيره خلال ٢٤ ساعة و٧ و٣٠ يومًا.",
                                     "<b>الهيمنة والرافعة:</b> حصة البيتكوين والإيثر والعملات المستقرة خلال ٣٠ يومًا، والعقود المفتوحة والتمويل."]),
                   ("المنهج والمصادر", ["يُحسب التدفق من شموع Binance؛ العملات المستقرة من DefiLlama، الهيمنة من CoinGecko والمشتقات من OKX. ليست نصيحة مالية."])],
            "en": [("On this page", ["<b>Net spot flow:</b> aggressive buying minus aggressive selling of every coin on Binance, over 5 minutes to a year, with the buyers’ share of volume.",
                                    "<b>The sector flow river:</b> which sectors drew money in and which lost it — by taker flow or by market value.",
                                    "<b>Inflow and outflow leaders:</b> the ten coins most bought and the ten most sold.",
                                    "<b>Flow against price:</b> a four-quadrant chart that shows absorption (buying into a fall) and distribution (selling into a rise).",
                                    "<b>Stablecoins:</b> the supply of USDT, USDC and the rest, and its 24-hour, 7-day and 30-day change — the sign of new dollars arriving or leaving.",
                                    "<b>Dominance and leverage:</b> Bitcoin’s, Ether’s and stablecoins’ share over 30 days, open interest and the hottest and coldest funding."]),
                   ("Method and sources", ["Flow is computed from Binance klines (taker-buy volume); every trade has a buyer and a seller, so flow tells which side was aggressive. Stablecoins from DefiLlama, dominance from CoinGecko, derivatives from OKX. Not financial advice."])],
        },
    },
    "liq": {
        "title": "نقدینگی و دفتر سفارش زندهٔ کریپتو | entekhab.net",
        "desc": "نقشهٔ حرارتی زندهٔ دفتر سفارش بایننس، عمق ±۲٪ و دیوارهای بزرگ، لیکوییدیشن‌های فیوچرز همان لحظه و جدول نقدشوندگی بزرگ‌ترین ارزها.",
        "og": "نقدینگی بازار کریپتو — دفتر سفارش زنده و لیکوییدیشن‌ها",
        "h1": {"fa": "نقدینگی بازار و دفتر سفارش", "ckb": "نەختینەیی بازاڕ و دەفتەری داواکاری", "ar": "سيولة السوق ودفاتر الأوامر", "en": "Market liquidity & order books"},
        "p": {"fa": "نقشهٔ حرارتی زندهٔ دفتر سفارش، عمق ±۲٪، لیکوییدیشن‌ها همان لحظه و نقدشوندگی بزرگ‌ترین ارزها",
              "ckb": "نەخشەی گەرمیی زیندووی دەفتەری داواکاری، قووڵایی ±٢٪، لیکویدەکان لە هەمان ساتدا و نەختینەیی گەورەترین دراوەکان",
              "ar": "خريطة حرارية حية لدفتر الأوامر، العمق ±٢٪، التصفيات لحظة حدوثها وسيولة أكبر العملات",
              "en": "A live order-book heatmap, depth within ±2 %, liquidations as they happen and the liquidity of the largest coins"},
        "about": {
            "fa": [("در این صفحه", ["<b>نقشهٔ حرارتی دفتر سفارش:</b> سفارش‌های منتظر خرید و فروش هر ثانیه در نوارهای ۰٫۰۲٪ دور قیمت؛ دیوارهای بزرگ روشن دیده می‌شوند و معاملات به شکل نقطه‌های سبز و قرمز.",
                                   "<b>عمق و دیوارها:</b> دلارهای ثبت‌شده در ±۰٫۵، ±۱ و ±۲ درصد، اسپرد، عدم‌تعادل خرید و فروش و بزرگ‌ترین دیوارها.",
                                   "<b>لیکوییدیشن‌های زنده:</b> بسته‌شدن اجباری لانگ‌ها و شورت‌ها در فیوچرز بایننس همان لحظه، با جمع و بیشترین ارزها.",
                                   "<b>جدول نقدشوندگی:</b> اسپرد، بالای دفتر، عمق ±۱٪ و ±۲٪ و گردش حجم بزرگ‌ترین ارزها."]),
                   ("روش", ["دفتر سفارش در مرورگر شما همان‌طور که بایننس توصیه کرده نگه داشته می‌شود (عکس فوری + جریان تغییرات با بررسی شمارهٔ به‌روزرسانی). اتصال‌ها فقط وقتی صفحه جلوی چشم است باز هستند. توصیهٔ مالی نیست."])],
            "ckb": [("لەم پەڕەیەدا", ["<b>نەخشەی گەرمیی دەفتەری داواکاری:</b> داواکارییە چاوەڕوانەکانی کڕین و فرۆشتن هەر چرکەیەک؛ دیوارە گەورەکان ڕووناک دەبینرێن.",
                                     "<b>قووڵایی و دیوارەکان:</b> دۆلاری تۆمارکراو لە ±٠٫٥، ±١ و ±٢٪، سپرێد و ناهاوسەنگی.",
                                     "<b>لیکویدە زیندووەکان:</b> داخستنی ناچاریی لۆنگ و شۆرت لە فیوچەرزی بایننس لە هەمان ساتدا.",
                                     "<b>خشتەی نەختینەیی:</b> سپرێد، قووڵایی و گەڕانی گەورەترین دراوەکان."]),
                    ("ڕێگا", ["دەفتەری داواکاری لە وێبگەڕەکەتدا بەو شێوەیە ڕادەگیرێت کە بایننس ڕێنمایی کردووە. ئامۆژگاریی دارایی نییە."])],
            "ar": [("في هذه الصفحة", ["<b>خريطة دفتر الأوامر الحرارية:</b> أوامر الشراء والبيع المعلّقة كل ثانية؛ الجدران الكبيرة تظهر ساطعة.",
                                     "<b>العمق والجدران:</b> الدولارات ضمن ±٠٫٥ و±١ و±٢٪، الفارق وعدم التوازن.",
                                     "<b>التصفيات المباشرة:</b> الإغلاق القسري للمراكز في عقود Binance الآجلة لحظة حدوثه.",
                                     "<b>جدول السيولة:</b> الفارق والعمق ودوران أكبر العملات."]),
                   ("المنهج", ["يُحفظ دفتر الأوامر في متصفحك بالطريقة التي توصي بها Binance. ليست نصيحة مالية."])],
            "en": [("On this page", ["<b>Order-book heatmap:</b> resting buy and sell orders every second in 0.02 % bands around the price; big walls glow, trades are the green and red dots.",
                                    "<b>Depth and walls:</b> the dollars within ±0.5, ±1 and ±2 %, the spread, the buy/sell imbalance and the biggest walls.",
                                    "<b>Live liquidations:</b> forced closes of longs and shorts on Binance futures as they happen, with totals and the coins hit hardest.",
                                    "<b>Liquidity table:</b> spread, top of book, ±1 % and ±2 % depth and turnover of the largest coins."]),
                   ("Method", ["The order book is kept in your browser the way Binance documents it (a snapshot plus the diff stream, checked by update ids). Connections are open only while the page is on screen. Not financial advice."])],
        },
    },
    "etf": {
        "title": "جریان ETF بیت‌کوین و اتریوم، روزبه‌روز | entekhab.net",
        "desc": "جریان روزانهٔ ETFهای اسپات بیت‌کوین و اتریوم آمریکا صندوق‌به‌صندوق، تجمعی و پیاپی، خزانهٔ شرکت‌های بورسی، بخش‌های پیشرو و توزیع صعود و نزول بازار.",
        "og": "جریان ETFهای بیت‌کوین و اتریوم — صندوق به صندوق",
        "h1": {"fa": "جریان ETFهای بیت‌کوین و اتریوم", "ckb": "ڕەوتی ETFی بیتکۆین و ئیسیریۆم", "ar": "تدفقات صناديق ETF للبيتكوين والإيثر", "en": "Bitcoin & Ether ETF flows"},
        "p": {"fa": "جریان ETFهای اسپات بیت‌کوین و اتریوم آمریکا صندوق‌به‌صندوق، خزانهٔ شرکت‌های بورسی، بخش‌های پیشرو و پهنای بازار",
              "ckb": "ڕەوتی ETFە سپۆتەکانی بیتکۆین و ئیسیریۆمی ئەمریکا سندووق بە سندووق، گەنجینەی کۆمپانیاکان و بەشە پێشەنگەکان",
              "ar": "تدفقات صناديق ETF الفورية للبيتكوين والإيثر صندوقًا صندوقًا، خزائن الشركات والقطاعات الأبرز",
              "en": "US spot Bitcoin and Ether ETF flows fund by fund, public-company treasuries, sector movers and the market’s breadth"},
        "about": {
            "fa": [("در این صفحه", ["<b>جریان ETFهای اسپات:</b> ورود و خروج روزانهٔ پول به هر صندوق بیت‌کوین و اتریوم آمریکا (BlackRock، Fidelity، Grayscale و…)، جمع ۵ و ۲۱ روز معاملاتی، تجمعی از آغاز و روزهای پیاپی.",
                                   "<b>نمودار روزانه:</b> ستون ورود و خروج هر روز با خط تجمعی، برای ۶۰ تا همهٔ روزها.",
                                   "<b>خزانهٔ شرکت‌ها:</b> شرکت‌های بورسی دارندهٔ بیت‌کوین و اتریوم، موجودی، ارزش زنده و سود و زیان از زمان خرید.",
                                   "<b>بخش‌های پیشرو و پهنای بازار:</b> تغییر وزنی هر بخش و توزیع صعود و نزول ۲۵۰ ارز برتر در تایم‌فریم انتخابی."]),
                   ("منابع", ["جریان ETF از جدول‌های عمومی Farside Investors (همان ارقامی که رسانه‌ها نقل می‌کنند) و خزانه‌ها از CoinGecko. روزی که هنوز گزارش نشده صفر حساب نمی‌شود. توصیهٔ مالی نیست."])],
            "ckb": [("لەم پەڕەیەدا", ["<b>ڕەوتی ETFە سپۆتەکان:</b> هاتن و ڕۆیشتنی ڕۆژانەی پارە بۆ هەر سندووقێکی بیتکۆین و ئیسیریۆمی ئەمریکا، کۆی ٥ و ٢١ ڕۆژ، کۆکراوە لە دەستپێکەوە.",
                                     "<b>گەنجینەی کۆمپانیاکان:</b> کۆمپانیا بۆرسەییەکانی خاوەن بیتکۆین و ئیسیریۆم.",
                                     "<b>بەشە پێشەنگەکان و پانیی بازاڕ:</b> گۆڕانی کێشداری هەر بەشێک و دابەشبوونی بەرزبوونەوە و دابەزین."]),
                    ("سەرچاوەکان", ["ڕەوتی ETF لە خشتە گشتییەکانی Farside Investors و گەنجینەکان لە CoinGeckoـەوە. ئامۆژگاریی دارایی نییە."])],
            "ar": [("في هذه الصفحة", ["<b>تدفقات صناديق ETF الفورية:</b> الدخول والخروج اليومي لكل صندوق بيتكوين وإيثر أمريكي، مجموع ٥ و٢١ يوم تداول، والتراكمي منذ الإطلاق.",
                                     "<b>خزائن الشركات:</b> الشركات المدرجة المالكة للبيتكوين والإيثر.",
                                     "<b>القطاعات الأبرز واتساع السوق:</b> التغير الموزون لكل قطاع وتوزيع الصعود والهبوط."]),
                   ("المصادر", ["تدفقات ETF من جداول Farside Investors العامة والخزائن من CoinGecko. ليست نصيحة مالية."])],
            "en": [("On this page", ["<b>Spot ETF flows:</b> each US Bitcoin and Ether fund’s daily inflow or outflow (BlackRock, Fidelity, Grayscale and the rest), totals over 5 and 21 trading days, cumulative since launch and the current streak.",
                                    "<b>Daily chart:</b> every day’s inflow or outflow with the cumulative line, from 60 days to all of them.",
                                    "<b>Company treasuries:</b> public companies holding Bitcoin and Ether, their holdings, live value and gain or loss since purchase.",
                                    "<b>Sector movers and breadth:</b> each sector’s weighted change and the distribution of ups and downs among the top 250 coins on the chosen timeframe."]),
                   ("Sources", ["ETF flows from Farside Investors’ public tables (the figures the press quotes) and treasuries from CoinGecko. A day not reported yet is not counted as zero. Not financial advice."])],
        },
    },
}
NAMES_LD = {"heatmap": "Entekhab crypto heatmap", "bubbles": "Entekhab crypto bubbles", "flow": "Entekhab crypto money flow",
            "liq": "Entekhab market liquidity", "etf": "Entekhab ETF flows"}


def about(view):
    out = []
    for lg in LANGS:
        secs = T[view]["about"][lg]
        body = "".join(f"<h2>{e(h)}</h2><ul>" + "".join(f"<li>{x}</li>" for x in items) + "</ul>" for h, items in secs)
        hid = "" if lg == "fa" else " hidden"
        out.append(f'  <section class="mm-about" data-lang="{lg}" lang="{lg}" dir="{"ltr" if lg == "en" else "rtl"}"{hid}>{body}</section>')
    return "\n".join(out)


def page(view, folder, script):
    t = T[view]
    url = f"{SITE}/{folder}/"
    h1 = "".join(f'<span data-lang="{lg}"{"" if lg == "fa" else " hidden"}>{e(t["h1"][lg])}</span>' for lg in LANGS)
    p = "".join(f'<span data-lang="{lg}"{"" if lg == "fa" else " hidden"}>{e(t["p"][lg])}</span>' for lg in LANGS)
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": NAMES_LD[view], "alternateName": t["h1"]["fa"], "url": url,
          "applicationCategory": "FinanceApplication", "operatingSystem": "Any (web browser)", "inLanguage": ["ckb", "fa", "ar", "en"],
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
          "publisher": {"@type": "Organization", "name": "Entekhab (entekhab.net)", "url": SITE}, "description": t["p"]["en"]}
    return f"""<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(t["title"])}</title>
<meta name="description" content="{e(t["desc"])}">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#f7931a">
<meta property="og:title" content="{e(t["og"])}">
<meta property="og:description" content="{e(t["desc"])}">
<meta property="og:url" content="{url}"><meta property="og:site_name" content="entekhab.net">
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><meta property="og:image" content="https://entekhab.net/assets/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://data-api.binance.vision" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;900&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/mm/mm.css?v={V}">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False, separators=(",", ":"))}</script>
</head>
<body>
<!--ek:header--><!--/ek:header-->
<main class="mm-page" id="mm-main" data-view="{view}" translate="no">
  <div class="mm-head">
    <h1>{h1}</h1>
    <p>{p}</p>
  </div>
  <div id="mm" class="mm" translate="no"><div class="mm-loading">…</div></div>
  <noscript><p class="mm-about">این صفحه با جاوااسکریپت کار می‌کند. / This page needs JavaScript.</p></noscript>
{about(view)}
</main>
<!--ek:bottom--><!--/ek:bottom-->
<!--ek:footer--><!--/ek:footer-->
<script src="/assets/mm/i18n.js?v={V}" defer></script>
<script src="/assets/mm/core.js?v={V}" defer></script>
<script src="/assets/mm/{script}?v={V}" defer></script>
<script src="/assets/ui.js" defer></script>
</body>
</html>
"""


def main():
    for view, folder, script in PAGES:
        d = os.path.join(ROOT, folder)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
            f.write(page(view, folder, script))
        t = T[view]
        assert len(t["title"]) <= 60, (view, len(t["title"]))
        assert len(t["desc"]) <= 160, (view, len(t["desc"]))
        print(f"/{folder}/ written (title {len(t['title'])}, description {len(t['desc'])} characters)")


if __name__ == "__main__":
    main()
