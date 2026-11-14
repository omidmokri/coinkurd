"""
The Observatory (/charts/…) in the bot: section "obs".

  * what the section's pages offer — the liquidation heatmap and map, real liquidations day by day, open interest,
    funding rates, the long/short ratio, CVD, basis and the Coinbase premium, options, MVRV, exchange reserves,
    stablecoins and the SSR, network and miners, the Bitcoin cycle (assets/obs/*, scripts/build_obs.py);
  * a few of the day's figures: Bitcoin's on-chain summary from data/obs/chain_now.json (scripts/obs_chain.py — the same
    arithmetic as the pages', tests/test_obs_chain.py compares them), Deribit's put/call and max pain from data/lab.json
    (scripts/lab.py), the stablecoin supply and SSR from data/obs/stables_now.json (scripts/obs_stables.py) and the
    Coinbase premium of the last closed hour from data/obs/premium.json (scripts/obs_premium.py) — the same summaries
    the pages' tiles show. A figure whose file is missing (or, for the hourly premium, older than six hours) is left
    out, never guessed;
  * the ways in: each page inside Telegram (Web App buttons) and the hub in the browser.

Read-only. The derivatives charts are computed in the reader's browser from the exchanges' public data. Nothing is
stored or sent.
Self-test: python3 scripts/bot_obs.py
"""
import html
import time
from datetime import datetime, timezone

from bot_i18n import pick

SITE = "https://entekhab.net"
HEAT = "/charts/liquidation-heatmap/"
MAP = "/charts/liquidation-map/"
LIQ = "/charts/liquidations/"
HL = "/charts/hyperliquid/"
OI = "/charts/open-interest/"
FUND = "/charts/funding-rate/"
LS = "/charts/long-short/"
CVD = "/charts/cvd/"
BASIS = "/charts/basis/"
OPT = "/charts/options/"
MVRV = "/charts/mvrv/"
FLOWS = "/charts/exchange-flows/"
STAB = "/charts/stablecoins/"
NET = "/charts/network/"
CYCLE = "/charts/bitcoin-cycle/"
HUB = "/charts/"
URL = SITE + HUB

TXT = {
    "title": {"fa": "🔭 <b>رصدخانهٔ بازار</b>", "ckb": "🔭 <b>ڕوانگەی بازاڕ</b>", "kmr": "🔭 <b>Çavdêrxaneya bazarê</b>", "ar": "🔭 <b>مرصد السوق</b>",
              "en": "🔭 <b>Market Observatory</b>"},
    "body": {
        "fa": ("نمودارهای مشتقات و آنچین به سبک سایت‌های تخصصی، از دادهٔ عمومی و با روشِ نوشته‌شده:\n"
               "• 🔥 نقشهٔ حرارتی لیکوییدیشن: برآورد اینکه پوزیشن‌های اهرمی در چه قیمت‌هایی لیکویید می‌شوند — هر ارز، ۱۲ ساعت تا ۱ سال، سه مدل، اهرم ۵ تا ۱۰۰\n"
               "• 📊 نقشهٔ لیکوییدیشن: سطوح همین حالا به تفکیک اهرم، و جمع تجمعی از قیمت\n"
               "• 💥 لیکوییدیشن‌های واقعی: دلار لانگ‌ها و شورت‌هایی که واقعاً لیکویید شدند، ساعت به ساعت و روز به روز از ۲۰۲۳ (Gate)، با سفارش‌های ۲۴ ساعت اخیر OKX\n"
               "• 🎯 لیکوییدیشن واقعی Hyperliquid: قیمت لیکوییدیشن پوزیشن‌های باز واقعی، از خود حساب‌ها نه از مدل\n"
               "• 📈 اوپن اینترست: جمع و سهم شش صرافی و تاریخچه تا ۱ سال\n"
               "• 💸 نرخ فاندینگ: پنج صرافی کنار هم بر پایهٔ ۸ ساعت، جدول ۴۰ ارز و تاریخچه\n"
               "• ⚖️ لانگ/شورت: سهم حساب‌های لانگ، معامله‌گران برتر و خالص حجم تهاجمی\n"
               "• 🧮 CVD: خالص تجمعی خرید و فروش تهاجمی در اسپات و فیوچرز، زیر نمودار قیمت\n"
               "• ↔️ بیسیس و پریمیوم: پریمیوم Coinbase از ۲۰۱۷، پریمیوم قرارداد دائمی و منحنی سررسیدهای فیوچرز\n"
               "• 🎯 آپشن‌ها: اوپن اینترست به تفکیک قیمت اعمال و سررسید، مکس پین، نسبت فروش به خرید و DVOL\n"
               "• 🔗 MVRV، قیمت تحقق‌یافته و NUPL: بازار نسبت به قیمت خرید دارندگان کجاست\n"
               "• 🏦 ذخایر و جریان صرافی‌ها: موجودی، ورودی، خروجی و جریان خالص روزانه\n"
               "• 💵 استیبل‌کوین‌ها و SSR: عرضهٔ استیبل‌کوین‌های دلاری، سهم USDT و USDC، و نسبت ارزش بیت‌کوین به آن\n"
               "• ⛏ شبکه و ماینرها: آدرس‌های فعال، تراکنش‌ها، نرخ هش، درآمد ماینرها و ضریب پوئل\n"
               "• 🔄 چرخهٔ بیت‌کوین: ضریب مایر، میانگین ۲۰۰ هفته، پای سایکل و جایگاه امروز در تاریخ\n"
               "دادهٔ مشتقات زنده از Binance، Bybit، OKX، Bitget، Hyperliquid، Gate و Deribit در خود صفحه خوانده می‌شود؛ دادهٔ آنچین روزانه از Coin Metrics، عرضهٔ استیبل‌کوین‌ها از DefiLlama و پریمیوم از کندل‌های Coinbase و Binance است."),
        "ckb": ("چارتەکانی دەرهاتەکان و ئانچین بە شێوازی ماڵپەڕە پسپۆڕەکان، لە داتای گشتییەوە و بە ڕێگای نووسراو:\n"
                "• 🔥 نەخشەی گەرمیی لیکویدکردن: خەمڵاندنی ئەوەی پۆزیشنە لیڤەرێجدارەکان لە چ نرخێکدا لیکوید دەکرێن — هەر دراوێک، ١٢ کاتژمێر تا ١ ساڵ، سێ مۆدێل، لیڤەرێجی ٥ تا ١٠٠\n"
                "• 📊 نەخشەی لیکویدکردن: ئاستەکانی ئێستا بەپێی لیڤەرێج، و کۆی کۆکراوە لە نرخەوە\n"
                "• 💥 لیکویدە ڕاستەقینەکان: دۆلاری ئەو لۆنگ و شۆرتانەی بە ڕاستی لیکوید کراون، کاتژمێر بە کاتژمێر و ڕۆژ بە ڕۆژ لە ٢٠٢٣ـەوە (Gate)، لەگەڵ داواکارییەکانی ٢٤ کاتژمێری ڕابردووی OKX\n"
                "• 🎯 لیکویدی ڕاستەقینەی Hyperliquid: نرخی لیکویدکردنی پۆزیشنە کراوە ڕاستەقینەکان، لە خودی هەژمارەکانەوە نەک مۆدێل\n"
                "• 📈 ئۆپن ئینتەرێست: کۆ و بەشی شەش ئاڵوگۆڕگە و مێژوو تا ١ ساڵ\n"
                "• 💸 نرخی فەندینگ: پێنج ئاڵوگۆڕگە لە تەنیشت یەک لەسەر بنەمای ٨ کاتژمێر، خشتەی ٤٠ دراو و مێژوو\n"
                "• ⚖️ لۆنگ/شۆرت: بەشی هەژمارە لۆنگەکان، بازرگانە سەرەکییەکان و سافیی قەبارەی هێرشبەرانە\n"
                "• 🧮 CVD: سافیی کۆکراوەی کڕین و فرۆشتنی هێرشبەرانە لە سپۆت و فیوچەرز، لە ژێر چارتی نرخدا\n"
                "• ↔️ بەیسیس و پریمیۆم: پریمیۆمی Coinbase لە ٢٠١٧ـەوە، پریمیۆمی گرێبەستی هەمیشەیی و چەماوەی بەسەرچوونەکانی فیوچەرز\n"
                "• 🎯 ئۆپشنەکان: ئۆپن ئینتەرێست بەپێی نرخی جێبەجێکردن و بەسەرچوون، ماکس پەین، ڕێژەی پوت بۆ کۆڵ و DVOL\n"
               "• 🔗 MVRV، نرخی بەدیهاتوو و NUPL: بازاڕ بە بەراورد لەگەڵ نرخی کڕینی خاوەنەکان لە کوێدایە\n"
               "• 🏦 یەدەگ و ڕەوتی ئاڵوگۆڕگەکان: یەدەگ، هاتن، ڕۆیشتن و ڕەوتی سافیی ڕۆژانە\n"
               "• 💵 ستەیبڵکۆینەکان و SSR: خستنەڕووی ستەیبڵکۆینە دۆلارییەکان، بەشی USDT و USDC، و ڕێژەی بەهای بیتکۆین بۆ ئەوان\n"
               "• ⛏ تۆڕ و ماینەرەکان: ناونیشانە چالاکەکان، مامەڵەکان، ڕێژەی هاش، داهاتی ماینەرەکان و چەندجارەی پوێڵ\n"
               "• 🔄 خولی بیتکۆین: چەندجارەی مایەر، تێکڕای ٢٠٠ هەفتە، خولی پای و شوێنی ئەمڕۆ لە مێژوودا\n"
               "داتای زیندووی دەرهاتەکان لە Binance، Bybit، OKX، Bitget، Hyperliquid، Gate و Deribitـەوە لە پەڕەکەدا دەخوێنرێتەوە؛ داتای ئانچینی ڕۆژانە لە Coin Metrics، خستنەڕووی ستەیبڵکۆینەکان لە DefiLlama و پریمیۆم لە مۆمەکانی Coinbase و Binanceـەوەیە."),
        "kmr": ("Grafîkên derivatîvan û on-chain bi şêwaza malperên pispor, ji daneyên giştî û bi rêbaza nivîsandî:\n"
                "• 🔥 Nexşeya germiyê ya tasfiyeyê: texmîna ku pozîsyonên bi leverage di kîjan bihayan de tên tasfiyekirin — her coin, 12 saet heta 1 sal, sê model, leverage 5 heta 100\n"
                "• 📊 Nexşeya tasfiyeyê: astên niha li gorî leverage, û koma li ser hev ji bihayê\n"
                "• 💥 Tasfiyeyên rastîn: dolarên long û shortên ku bi rastî hatine tasfiyekirin, saet bi saet û roj bi roj ji 2023an ve (Gate), bi fermanên 24 saetên dawî yên OKX\n"
                "• 🎯 Tasfiyeya rastîn a Hyperliquid: bihayên tasfiyeyê yên pozîsyonên vekirî yên rastîn, ji hesaban bi xwe, ne ji modelê\n"
                "• 📈 Open interest: kom û para şeş borsayan û dîrok heta 1 salê\n"
                "• 💸 Rêjeya fundingê: pênc borsa li kêleka hev li ser bingeha 8 saetan, tabloya 40 coinan û dîrok\n"
                "• ⚖️ Long/short: para hesabên long, bazirganên sereke û qebareya netî ya takeran\n"
                "• 🧮 CVD: koma netî ya kirîn û firotina takeran di spot û futures de, li bin grafîka bihayê\n"
                "• ↔️ Basis û premium: premiuma Coinbase ji 2017an ve, premiuma peymana herdemî û xêza dawîbûnên futures\n"
                "• 🎯 Opsiyon: open interest li gorî bihayê strike û dawîbûnê, max pain, rêjeya put/call û DVOL\n"
               "• 🔗 MVRV, bihayê pêkhatî û NUPL: bazar li gorî bihayê kirîna xwediyan li ku ye\n"
               "• 🏦 Rezerv û herikîna borsayan: rezerv, ketin, derketin û herikîna netî ya rojane\n"
               "• 💵 Stablecoin û SSR: arza stablecoinên dolarî, para USDT û USDC, û rêjeya nirxê Bitcoinê li hember wê\n"
               "• ⛏ Tor û madenkar: navnîşanên çalak, danûstandin, rêjeya hash, dahata madenkaran û pirjimara Puell\n"
               "• 🔄 Çerxa Bitcoinê: pirjimara Mayer, navgîniya 200 hefteyan, Pi cycle û cihê îro di dîrokê de\n"
               "Daneyên zindî yên derivatîvan ji Binance, Bybit, OKX, Bitget, Hyperliquid, Gate û Deribit di rûpelê de tên xwendin; daneyên on-chain ên rojane ji Coin Metrics, arza stablecoinan ji DefiLlama û premium ji mûmên Coinbase û Binance ne."),
        "ar": ("رسوم المشتقات والبيانات على السلسلة على طريقة المواقع المتخصصة، من بيانات عامة وبمنهج مكتوب:\n"
               "• 🔥 الخريطة الحرارية للتصفيات: تقدير الأسعار التي تُصفّى عندها المراكز ذات الرافعة — أي عملة، من ١٢ ساعة إلى سنة، ثلاثة نماذج، رافعة من ٥ إلى ١٠٠\n"
               "• 📊 خريطة التصفيات: المستويات الحالية حسب الرافعة، والمجموع التراكمي من السعر\n"
               "• 💥 التصفيات الفعلية: دولارات مراكز الشراء والبيع التي صُفّيت فعلًا، ساعةً بساعة ويومًا بيوم منذ ٢٠٢٣ (Gate)، مع أوامر آخر ٢٤ ساعة في OKX\n"
               "• 🎯 تصفيات Hyperliquid الفعلية: أسعار تصفية المراكز المفتوحة الحقيقية، من الحسابات نفسها لا من نموذج\n"
               "• 📈 العقود المفتوحة: مجموع ست منصات وحصصها وتاريخ حتى سنة\n"
               "• 💸 معدلات التمويل: خمس منصات جنبًا إلى جنب على أساس ٨ ساعات، جدول ٤٠ عملة وتاريخ\n"
               "• ⚖️ الشراء/البيع: حصة الحسابات المشترية، كبار المتداولين وصافي الحجم العدواني\n"
               "• 🧮 CVD: صافي الشراء والبيع العدواني التراكمي في السوق الفوري والآجل، تحت رسم السعر\n"
               "• ↔️ الأساس والعلاوة: علاوة Coinbase منذ ٢٠١٧، علاوة العقد الدائم ومنحنى استحقاقات العقود الآجلة\n"
               "• 🎯 الخيارات: العقود المفتوحة حسب سعر التنفيذ والاستحقاق، أقصى ألم، نسبة البيع إلى الشراء وDVOL\n"
               "• 🔗 MVRV والسعر المحقّق وNUPL: أين السوق من سعر شراء الحائزين\n"
               "• 🏦 احتياطيات المنصات وتدفقاتها: الاحتياطي والداخل والخارج وصافي التدفق اليومي\n"
               "• 💵 العملات المستقرة وSSR: معروض العملات المستقرة الدولارية، حصة USDT وUSDC، ونسبة قيمة البيتكوين إليه\n"
               "• ⛏ الشبكة والمعدّنون: العناوين النشطة والمعاملات ومعدل التجزئة وإيرادات المعدّنين ومضاعف بويل\n"
               "• 🔄 دورة البيتكوين: مضاعف ماير، متوسط ٢٠٠ أسبوع، دورة باي وموضع اليوم في التاريخ\n"
               "بيانات المشتقات المباشرة من Binance وBybit وOKX وBitget وHyperliquid وGate وDeribit تُقرأ في الصفحة نفسها؛ وبيانات السلسلة اليومية من Coin Metrics، ومعروض العملات المستقرة من DefiLlama، والعلاوة من شموع Coinbase وBinance."),
        "en": ("Derivatives and on-chain charts in the manner of the specialist sites, from public data and with the method written down:\n"
               "• 🔥 Liquidation heatmap: an estimate of the prices at which leveraged positions get liquidated — any coin, 12 hours to a year, three models, leverage 5x to 100x\n"
               "• 📊 Liquidation map: the levels standing now by leverage, and the running total from the price\n"
               "• 💥 Real liquidations: the dollars of longs and shorts that were really liquidated, hour by hour and day by day since 2023 (Gate), with OKX's orders of the last 24 hours\n"
               "• 🎯 Hyperliquid liquidation levels: the liquidation prices of real open positions, from the accounts themselves, not a model\n"
               "• 📈 Open interest: the total and shares of six exchanges, with history up to a year\n"
               "• 💸 Funding rates: five exchanges side by side on an 8-hour basis, a table of 40 coins, and history\n"
               "• ⚖️ Long/short: the share of accounts long, top traders and net taker volume\n"
               "• 🧮 CVD: the running net of taker buying and selling on spot and in futures, under the price\n"
               "• ↔️ Basis and premium: the Coinbase premium since 2017, the perpetual's premium and the curve of futures expiries\n"
               "• 🎯 Options: open interest by strike and expiry, max pain, the put/call ratio and DVOL\n"
               "• 🔗 MVRV, realized price and NUPL: where the market stands against holders' cost\n"
               "• 🏦 Exchange reserves and flows: what exchanges hold, daily inflow, outflow and net flow\n"
               "• 💵 Stablecoins and SSR: the supply of dollar stablecoins, the shares of USDT and USDC, and Bitcoin's value against it\n"
               "• ⛏ Network and miners: active addresses, transactions, hash rate, miner revenue and the Puell multiple\n"
               "• 🔄 Bitcoin cycle: the Mayer multiple, the 200-week average, the Pi cycle and where today stands in history\n"
               "Live derivatives data from Binance, Bybit, OKX, Bitget, Hyperliquid, Gate and Deribit is read right in the page; the daily on-chain data is Coin Metrics', the stablecoin supply DefiLlama's, and the premium comes from Coinbase's and Binance's candles."),
    },
    "nfa": {"fa": "نقشه‌های لیکوییدیشن برآوردند؛ هیچ‌کدام پیش‌بینی یا توصیهٔ مالی نیست.", "ckb": "نەخشەکانی لیکویدکردن خەمڵاندنن؛ هیچیان پێشبینی یان ئامۆژگاریی دارایی نییە.",
            "kmr": "Nexşeyên tasfiyeyê texmîn in; tu yek ne pêşbînî ye û ne şîreta darayî ye.", "ar": "خرائط التصفيات تقدير؛ ولا شيء منها توقّع أو نصيحة مالية.",
            "en": "The liquidation maps are estimates; none of this is a forecast or financial advice."},
    "b_heat": {"fa": "🔥 نقشهٔ حرارتی لیکوییدیشن", "ckb": "🔥 نەخشەی گەرمیی لیکویدکردن", "kmr": "🔥 Nexşeya germiyê ya tasfiyeyê",
               "ar": "🔥 الخريطة الحرارية للتصفيات", "en": "🔥 Liquidation heatmap"},
    "b_map": {"fa": "📊 نقشهٔ لیکوییدیشن", "ckb": "📊 نەخشەی لیکویدکردن", "kmr": "📊 Nexşeya tasfiyeyê", "ar": "📊 خريطة التصفيات",
              "en": "📊 Liquidation map"},
    "b_hl": {"fa": "🎯 لیکوییدیشن واقعی Hyperliquid", "ckb": "🎯 لیکویدی ڕاستەقینەی Hyperliquid", "kmr": "🎯 Tasfiyeya rastîn a Hyperliquid", "ar": "🎯 تصفيات Hyperliquid الفعلية", "en": "🎯 Hyperliquid liquidation levels"},
    "b_liq": {"fa": "💥 لیکوییدیشن‌های واقعی", "ckb": "💥 لیکویدە ڕاستەقینەکان", "kmr": "💥 Tasfiyeyên rastîn", "ar": "💥 التصفيات الفعلية", "en": "💥 Real liquidations"},
    "b_oi": {"fa": "📈 اوپن اینترست", "ckb": "📈 ئۆپن ئینتەرێست", "kmr": "📈 Open interest", "ar": "📈 العقود المفتوحة", "en": "📈 Open interest"},
    "b_fund": {"fa": "💸 نرخ فاندینگ", "ckb": "💸 نرخی فەندینگ", "kmr": "💸 Rêjeya fundingê", "ar": "💸 معدلات التمويل", "en": "💸 Funding rates"},
    "b_ls": {"fa": "⚖️ لانگ/شورت", "ckb": "⚖️ لۆنگ/شۆرت", "kmr": "⚖️ Long/short", "ar": "⚖️ الشراء/البيع", "en": "⚖️ Long/short"},
    "b_cvd": {"fa": "🧮 CVD", "ckb": "🧮 CVD", "kmr": "🧮 CVD", "ar": "🧮 CVD", "en": "🧮 CVD"},
    "b_basis": {"fa": "↔️ بیسیس و پریمیوم", "ckb": "↔️ بەیسیس و پریمیۆم", "kmr": "↔️ Basis û premium", "ar": "↔️ الأساس والعلاوة", "en": "↔️ Basis & premium"},
    "b_opt": {"fa": "🎯 آپشن‌ها", "ckb": "🎯 ئۆپشنەکان", "kmr": "🎯 Opsiyon", "ar": "🎯 الخيارات", "en": "🎯 Options"},
    "b_mvrv": {"fa": "🔗 MVRV و NUPL", "ckb": "🔗 MVRV و NUPL", "kmr": "🔗 MVRV û NUPL", "ar": "🔗 MVRV وNUPL", "en": "🔗 MVRV & NUPL"},
    "b_flows": {"fa": "🏦 ذخایر صرافی‌ها", "ckb": "🏦 یەدەگی ئاڵوگۆڕگەکان", "kmr": "🏦 Rezerva borsayan", "ar": "🏦 احتياطيات المنصات", "en": "🏦 Exchange reserves"},
    "b_stab": {"fa": "💵 استیبل‌کوین‌ها و SSR", "ckb": "💵 ستەیبڵکۆینەکان و SSR", "kmr": "💵 Stablecoin û SSR", "ar": "💵 العملات المستقرة وSSR", "en": "💵 Stablecoins & SSR"},
    "b_net": {"fa": "⛏ شبکه و ماینرها", "ckb": "⛏ تۆڕ و ماینەرەکان", "kmr": "⛏ Tor û madenkar", "ar": "⛏ الشبكة والمعدّنون", "en": "⛏ Network & miners"},
    "b_cycle": {"fa": "🔄 چرخهٔ بیت‌کوین", "ckb": "🔄 خولی بیتکۆین", "kmr": "🔄 Çerxa Bitcoinê", "ar": "🔄 دورة البيتكوين", "en": "🔄 Bitcoin cycle"},
    # the day's figures (numbers stay in Latin digits, like every price in the bot)
    "now": {"fa": "📌 <b>بیت‌کوین در {d}</b>", "ckb": "📌 <b>بیتکۆین لە {d}</b>", "kmr": "📌 <b>Bitcoin di {d} de</b>", "ar": "📌 <b>البيتكوين في {d}</b>", "en": "📌 <b>Bitcoin on {d}</b>"},
    "l_mvrv": {"fa": "• MVRV {m} · NUPL {n} · قیمت تحقق‌یافته {r}", "ckb": "• MVRV {m} · NUPL {n} · نرخی بەدیهاتوو {r}", "kmr": "• MVRV {m} · NUPL {n} · bihayê pêkhatî {r}",
               "ar": "• MVRV {m} · NUPL {n} · السعر المحقّق {r}", "en": "• MVRV {m} · NUPL {n} · realized price {r}"},
    "l_flow": {"fa": "• ذخیرهٔ صرافی‌ها {s} · جریان خالص هفت روز {n}", "ckb": "• یەدەگی ئاڵوگۆڕگەکان {s} · ڕەوتی سافیی حەوت ڕۆژ {n}", "kmr": "• Rezerva borsayan {s} · herikîna netî ya heft rojan {n}",
               "ar": "• احتياطي المنصات {s} · صافي تدفق سبعة أيام {n}", "en": "• Exchange reserve {s} · seven-day net flow {n}"},
    "l_cycle": {"fa": "• ضریب مایر {m} · پوئل {p} · افت از سقف {d}", "ckb": "• چەندجارەی مایەر {m} · پوێڵ {p} · دابەزین لە لووتکە {d}", "kmr": "• Pirjimara Mayer {m} · Puell {p} · daketin ji lûtkeyê {d}",
                "ar": "• مضاعف ماير {m} · بويل {p} · التراجع عن القمة {d}", "en": "• Mayer multiple {m} · Puell {p} · drawdown {d}"},
    "l_opt": {"fa": "• آپشن‌ها (Deribit): نسبت فروش به خرید {pc} · مکس پین {mp} برای {e}", "ckb": "• ئۆپشنەکان (Deribit): ڕێژەی پوت بۆ کۆڵ {pc} · ماکس پەین {mp} بۆ {e}",
              "kmr": "• Opsiyon (Deribit): rêjeya put/call {pc} · max pain {mp} ji bo {e}", "ar": "• الخيارات (Deribit): نسبة البيع إلى الشراء {pc} · أقصى ألم {mp} لاستحقاق {e}",
              "en": "• Options (Deribit): put/call {pc} · max pain {mp} for {e}"},
    "l_stab": {"fa": "• استیبل‌کوین‌های دلاری (DefiLlama، {d}): {u}", "ckb": "• ستەیبڵکۆینە دۆلارییەکان (DefiLlama، {d}): {u}", "kmr": "• Stablecoinên dolarî (DefiLlama, {d}): {u}",
               "ar": "• العملات المستقرة الدولارية (DefiLlama، {d}): {u}", "en": "• Dollar stablecoins (DefiLlama, {d}): {u}"},
    "l_stab30": {"fa": " · تغییر ۳۰ روزه {c}", "ckb": " · گۆڕانی ٣٠ ڕۆژ {c}", "kmr": " · guherîna 30 rojan {c}", "ar": " · التغيّر في ٣٠ يومًا {c}", "en": " · 30-day change {c}"},
    "l_prem": {"fa": "• پریمیوم Coinbase (ساعت بسته‌شده در {t}): {p}", "ckb": "• پریمیۆمی Coinbase (کاتژمێری داخراو لە {t}): {p}", "kmr": "• Premiuma Coinbase (saeta girtî di {t} de): {p}",
               "ar": "• علاوة Coinbase (الساعة المغلقة في {t}): {p}", "en": "• Coinbase premium (hour closed at {t}): {p}"},
    "l_prem24": {"fa": " · میانگین ۲۴ ساعته {h}", "ckb": " · تێکڕای ٢٤ کاتژمێر {h}", "kmr": " · navgîniya 24 saetan {h}", "ar": " · متوسط ٢٤ ساعة {h}", "en": " · 24-hour average {h}"},
    "src": {"fa": "آنچین: Coin Metrics، آخرین روز بسته‌شده به وقت UTC.", "ckb": "ئانچین: Coin Metrics، دوایین ڕۆژی داخراو بە کاتی UTC.", "kmr": "On-chain: Coin Metrics, roja dawî ya girtî bi dema UTC.",
            "ar": "السلسلة: Coin Metrics، آخر يوم مغلق بتوقيت UTC.", "en": "On-chain: Coin Metrics, the last closed UTC day."},
    "b_all": {"fa": "🔭 همهٔ نمودارها", "ckb": "🔭 هەموو چارتەکان", "kmr": "🔭 Hemû grafîk", "ar": "🔭 كل الرسوم", "en": "🔭 All charts"},
    "b_web": {"fa": "🌐 باز کردن در مرورگر", "ckb": "🌐 کردنەوە لە وێبگەڕ", "kmr": "🌐 Di gerokê de veke", "ar": "🌐 افتح في المتصفح",
              "en": "🌐 Open in the browser"},
}


def L(key, lang, **kw):
    s = pick(TXT[key], lang)
    return s.format(**kw) if kw else s


def ltr(s, lang):
    """a figure inside Persian, Sorani or Arabic text stays left-to-right (or its sign jumps to the other side)"""
    return "\u202a" + s + "\u202c" if lang in ("fa", "ckb", "ar") else s


def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and abs(x) != float("inf")


def _qty(v, signed=False):
    a = abs(v)
    t = f"{a / 1e6:.2f}M" if a >= 1e6 else f"{a / 1e3:.1f}K" if a >= 1e4 else f"{a:,.0f}"
    return ("+" if v > 0 else "-" if v < 0 else "") + t if signed else ("-" if v < 0 else "") + t


def _usd(v, signed=False):
    """dollars the way the pages write them (OB.fmtUsd in assets/obs/core.js): $312.45B, $700.0M, $12.34M"""
    a = abs(v)
    t = (f"{a / 1e12:.2f}T" if a >= 1e12 else f"{a / 1e9:.2f}B" if a >= 1e9 else f"{a / 1e6:.1f}M" if a >= 1e8 else f"{a / 1e6:.2f}M" if a >= 1e6
         else f"{a / 1e3:.0f}K" if a >= 1e5 else f"{a / 1e3:.1f}K" if a >= 1e3 else f"{a:.0f}")
    return ("+" if signed and v > 0 else "-" if v < 0 else "") + "$" + t


def _pct(v, dp=3):
    return ("+" if v > 0 else "-" if v < 0 else "") + f"{abs(v):.{dp}f}%"


_DATE = "0123456789-"
PREM_MAX_AGE = 6 * 3600           # the premium is an hourly figure: one older than this is not "the last closed hour" any more


def _is_date(x):
    return isinstance(x, str) and len(x) == 10 and all(c in _DATE for c in x)


def summary(lang, load, now=None):
    """the day's figures; each line needs its own numbers and is left out (never guessed) when they are missing"""
    obj = lambda x: x if isinstance(x, dict) else {}       # noqa: E731
    b = obj(obj(load("obs/chain_now")).get("btc"))
    f = lambda x: ltr(x, lang)                             # noqa: E731
    chain = []
    if _num(b.get("mvrv")) and _num(b.get("nupl")) and _num(b.get("rprice")):
        chain.append(L("l_mvrv", lang, m=f(f"{b['mvrv']:.2f}"), n=f(f"{b['nupl']:.2f}"), r=f(f"${b['rprice']:,.0f}")))
    if _num(b.get("sex")) and _num(b.get("net7")):
        chain.append(L("l_flow", lang, s=f(_qty(b["sex"]) + " BTC"), n=f(_qty(b["net7"], True) + " BTC")))
    if _num(b.get("mayer")) and _num(b.get("puell")) and _num(b.get("dd")):
        chain.append(L("l_cycle", lang, m=f(f"{b['mayer']:.2f}"), p=f(f"{b['puell']:.2f}"), d=f(f"{b['dd']:.1f}%")))
    head = [L("now", lang, d=f(html.escape(str(b["date"]))))] if chain and isinstance(b.get("date"), str) else []
    if chain and not head:
        return ""
    out = list(chain)
    o = obj(obj(obj(load("lab")).get("options")).get("BTC"))
    mp = obj(o.get("max_pain"))
    if _num(o.get("pc_oi")) and _num(mp.get("max_pain")) and isinstance(mp.get("expiry"), str):
        out.append(L("l_opt", lang, pc=f(f"{o['pc_oi']:.2f}"), mp=f(f"${mp['max_pain']:,.0f}"), e=f(html.escape(mp["expiry"]))))
    # dollar stablecoins and the SSR: the summary scripts/obs_stables.py writes (the same figures as the page's tiles)
    st = obj(obj(load("obs/stables_now")).get("summary"))
    if _num(st.get("usd")) and st["usd"] > 0 and _is_date(st.get("date")):
        line = L("l_stab", lang, d=f(st["date"]), u=f(_usd(st["usd"])))
        if _num(st.get("chg30")):
            line += L("l_stab30", lang, c=f(_usd(st["chg30"], True)))
        if _num(st.get("ssr")) and st["ssr"] > 0:
            line += " · SSR " + f(f"{st['ssr']:.2f}")
            if _is_date(st.get("ssr_date")) and st["ssr_date"] != st["date"]:       # Bitcoin's value is a day behind the supply: say which day
                line += " (" + f(st["ssr_date"]) + ")"
        out.append(line)
    # the Coinbase premium of the last closed hour (scripts/obs_premium.py); the hour is named, and an old one is left out
    pm = obj(obj(obj(load("obs/premium")).get("summary")).get("btc"))
    t = pm.get("t")
    now = time.time() if now is None else now
    if _num(pm.get("now")) and _num(t) and 0 <= now - t / 1000 <= PREM_MAX_AGE:
        line = L("l_prem", lang, t=f(datetime.fromtimestamp(t / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M") + " UTC"), p=f(_pct(pm["now"])))
        if _num(pm.get("h24")):
            line += L("l_prem24", lang, h=f(_pct(pm["h24"])))
        out.append(line)
    if not out:
        return ""
    return "\n".join(head + out + (["<i>" + L("src", lang) + "</i>"] if head else []))


def section(lang, load=None):
    """text of the section; `load` is bot_data.load (injected so the self-test runs without the data folder)"""
    parts = [L("title", lang), L("body", lang)]
    if load:
        try:
            s = summary(lang, load)
            if s:
                parts.append(s)
        except Exception:      # a missing or broken data file never breaks the section
            pass
    parts.append("<i>" + L("nfa", lang) + "</i>")
    return "\n\n".join(parts)


PAGES = (HEAT, MAP, LIQ, HL, OI, FUND, LS, CVD, BASIS, OPT, MVRV, FLOWS, STAB, NET, CYCLE, HUB)          # the Web App buttons, in the order of the site's tabs


def open_rows(lang):
    """the pages inside Telegram (Web App), and the hub in the browser; put above the standard navigation"""
    def w(k, path):
        return {"text": L("b_" + k, lang), "web_app": {"url": SITE + path}}
    return [[w("heat", HEAT), w("map", MAP)], [w("liq", LIQ), w("hl", HL)], [w("oi", OI), w("fund", FUND)], [w("ls", LS), w("cvd", CVD)], [w("basis", BASIS), w("opt", OPT)],
            [w("mvrv", MVRV), w("flows", FLOWS)], [w("stab", STAB), w("net", NET)], [w("cycle", CYCLE), w("all", HUB)], [{"text": L("b_web", lang), "url": URL}]]


N_ROWS = 9                                      # rows open_rows() puts above the navigation


if __name__ == "__main__":
    import os
    import re
    bad = 0
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for lang in ("fa", "ckb", "kmr", "ar", "en"):
        txt = section(lang)
        if L("title", lang) not in txt or len(txt) > 4096 or "None" in txt:
            print("FAIL", lang, "text")
            bad += 1
        for k, d in TXT.items():
            if not d.get(lang):
                print("FAIL", lang, "missing string", k)
                bad += 1
        prose = re.sub(r"Binance|Bybit|<[^>]+>|[A-Za-z]+", "", txt)                 # the static text (no data file here): no Latin digits in it
        if lang in ("fa", "ckb", "ar") and re.search(r"[0-9]", prose):
            print("FAIL", lang, "Latin digits in the prose")
            bad += 1
        if lang == "fa" and re.search("[٠-٩]", txt) or lang in ("ckb", "ar") and re.search("[۰-۹]", txt):
            print("FAIL", lang, "digits of another language")
            bad += 1
        rows = open_rows(lang)
        urls = [b.get("web_app", {}).get("url") or b.get("url") for r in rows for b in r]
        if urls != [SITE + p for p in PAGES + (HUB,)] or len(rows) != N_ROWS:
            print("FAIL", lang, "buttons", urls)
            bad += 1
        if any(len(b["text"]) > 40 for r in rows for b in r):
            print("FAIL", lang, "button text too long")
            bad += 1
    for p in PAGES:                                 # every page a button opens exists in the repo
        if not os.path.exists(os.path.join(root, p.strip("/"), "index.html")):
            print("FAIL page missing", p)
            bad += 1
    # the day's figures: every line from its own numbers, nothing when a file is missing or odd
    now = {"btc": {"date": "2026-11-12", "mvrv": 1.324104, "nupl": 0.24478, "rprice": 53832.9, "sex": 2723131, "net7": -12345.6, "mayer": 0.8123, "puell": 0.912, "dd": -43.21}}
    lab = {"options": {"BTC": {"pc_oi": 0.77, "max_pain": {"expiry": "2026-11-14", "max_pain": 72000.0}}}}
    for lang in ("fa", "ckb", "kmr", "ar", "en"):
        full = summary(lang, lambda n: {"obs/chain_now": now, "lab": lab}.get(n))
        want = ("2026-11-12", "1.32", "0.24", "$53,833", "2.72M BTC", "-12.3K BTC", "0.81", "0.91", "-43.2%", "0.77", "$72,000", "2026-11-14", "Coin Metrics", "Deribit")
        if not all(x in full for x in want) or len(full.split("\n")) != 6:
            print("FAIL", lang, "summary", full)
            bad += 1
        if summary(lang, lambda n: None) != "" or summary(lang, lambda n: "junk") != "" or summary(lang, lambda n: {"btc": {"mvrv": "x"}}) != "":
            print("FAIL", lang, "summary without data must be empty")
            bad += 1
        part = summary(lang, lambda n: {"obs/chain_now": {"btc": {"date": "2026-11-12", "mvrv": 1.3, "nupl": 0.2, "rprice": 5e4}}}.get(n))
        if len(part.split("\n")) != 3 or "$50,000" not in part:
            print("FAIL", lang, "summary with one line", part)
            bad += 1
        only_opt = summary(lang, lambda n: {"lab": lab}.get(n))
        if len(only_opt.split("\n")) != 1 or "$72,000" not in only_opt:
            print("FAIL", lang, "options line alone", only_opt)
            bad += 1
        txt = section(lang, lambda n: {"obs/chain_now": now, "lab": lab}.get(n))
        if len(txt) > 4096 or full not in txt:
            print("FAIL", lang, "section with figures", len(txt))
            bad += 1
        # stablecoins (scripts/obs_stables.py) and the Coinbase premium (scripts/obs_premium.py), as those files have them
        t_close = 1794625200                                    # 2026-11-14 03:00 UTC, the close of the last hour in the file
        stab = {"summary": {"date": "2026-11-13", "usd": 312.456e9, "chg30": -2.1e9, "chg30_pct": -0.67, "ssr": 6.4321, "ssr_date": "2026-11-12"}}
        prem = {"summary": {"btc": {"t": t_close * 1000, "now": -0.01234, "h24": 0.0312, "stale": False}, "eth": {"t": t_close * 1000, "now": 9.0}}}
        files = {"obs/chain_now": now, "lab": lab, "obs/stables_now": stab, "obs/premium": prem}
        both = summary(lang, files.get, now=t_close + 1800)
        want = ("DefiLlama", "2026-11-13", "$312.46B", "-$2.10B", "SSR", "6.43", "Coinbase", "2026-11-14 03:00 UTC", "-0.012%", "+0.031%")
        ssr_day = " (" + ltr("2026-11-12", lang) + ")"                               # the SSR's own day, because it differs from the supply's
        same = summary(lang, {"obs/stables_now": {"summary": dict(stab["summary"], ssr_date="2026-11-13")}}.get, now=t_close)
        if not all(x in both for x in want) or len(both.split("\n")) != 8 or not both.startswith(full.rsplit("\n", 1)[0]) or "9.0" in both or ssr_day not in both or "(" in same.split("SSR")[1]:
            print("FAIL", lang, "stablecoin and premium lines", both)
            bad += 1
        old = summary(lang, files.get, now=t_close + PREM_MAX_AGE + 60)             # an hour that closed more than six hours ago is not shown
        ahead = summary(lang, files.get, now=t_close - 60)                          # … nor one stamped in the future
        if "Coinbase" in old or "Coinbase" in ahead or "DefiLlama" not in old or len(old.split("\n")) != 7:
            print("FAIL", lang, "an old premium must be left out", old)
            bad += 1
        bare = summary(lang, {"obs/stables_now": {"summary": {"date": "2026-11-13", "usd": 99.5e6}}, "obs/premium": {"summary": {"btc": {"t": t_close * 1000, "now": 0.0}}}}.get,
                       now=t_close)
        if len(bare.split("\n")) != 2 or "$99.50M" not in bare or "0.000%" not in bare or "SSR" in bare or "+0.000" in bare or "📌" in bare:
            print("FAIL", lang, "lines with only their own figures", bare)
            bad += 1
        junk = [{"summary": {"date": "2026-11-13", "usd": "312"}}, {"summary": {"date": 20261113, "usd": 3e11}}, {"summary": {"date": "<b>2026</b>", "usd": 3e11}},
                {"summary": {"date": "2026-11-13", "usd": float("nan")}}, {"summary": {"date": "2026-11-13", "usd": 0}}, {"summary": []}, [], "x",
                {"summary": {"btc": {"t": "now", "now": 0.1}}}, {"summary": {"btc": {"t": t_close * 1000, "now": None}}}, {"summary": {"btc": {"now": 0.1}}}]
        if any(summary(lang, {"obs/stables_now": j, "obs/premium": j}.get, now=t_close) != "" for j in junk):
            print("FAIL", lang, "odd stablecoin or premium files must give nothing")
            bad += 1
        txt = section(lang, files.get)                                              # the real clock: the premium line is out, the rest is in
        txt2 = "\n\n".join([L("title", lang), L("body", lang), both, "<i>" + L("nfa", lang) + "</i>"])
        if len(txt2) > 3900 or "DefiLlama" not in txt or "$312.46B" not in txt:
            print("FAIL", lang, "section with every figure", len(txt2))
            bad += 1
    for v, w in ((312.456e9, "$312.46B"), (1.2345e12, "$1.23T"), (7e8, "$700.0M"), (12.345e6, "$12.35M"), (250e3, "$250K"), (2500.0, "$2.5K"), (12.0, "$12"), (-2.1e9, "-$2.10B")):
        if _usd(v) != w:
            print("FAIL _usd", v, _usd(v), w)
            bad += 1
    if _usd(7e8, True) != "+$700.0M" or _usd(-7e8, True) != "-$700.0M" or _usd(0, True) != "$0" or _pct(0.0) != "0.000%" or _pct(-0.01234) != "-0.012%" or _pct(1.5, 2) != "+1.50%":
        print("FAIL signed formats")
        bad += 1
    print(f"bot_obs self-test: {bad} failures")
    raise SystemExit(1 if bad else 0)
