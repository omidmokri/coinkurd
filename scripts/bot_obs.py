"""
The Observatory (/charts/…) in the bot: section "obs".

  * what the section's pages offer — the liquidation heatmap and the liquidation map (assets/obs/*, built by
    scripts/build_obs.py);
  * the ways in: each page inside Telegram (Web App buttons) and the heatmap in the browser.

Read-only and without numbers of its own: the charts are computed in the reader's browser from the exchanges' public
data, so there is no file here to quote from and nothing is made up. Nothing is stored or sent.
Self-test: python3 scripts/bot_obs.py
"""
from bot_i18n import pick

SITE = "https://entekhab.net"
HEAT = "/charts/liquidation-heatmap/"
MAP = "/charts/liquidation-map/"
HUB = "/charts/"
URL = SITE + HEAT

TXT = {
    "title": {"fa": "🔭 <b>رصدخانهٔ بازار</b>", "ckb": "🔭 <b>ڕوانگەی بازاڕ</b>", "kmr": "🔭 <b>Çavdêrxaneya bazarê</b>", "ar": "🔭 <b>مرصد السوق</b>",
              "en": "🔭 <b>Market Observatory</b>"},
    "body": {
        "fa": ("نمودارهای مشتقات به سبک سایت‌های تخصصی، از دادهٔ عمومی صرافی‌ها و با روشِ نوشته‌شده:\n"
               "• 🔥 نقشهٔ حرارتی لیکوییدیشن: برآورد اینکه پوزیشن‌های اهرمی در چه قیمت‌هایی لیکویید می‌شوند — هر ارز، ۱۲ ساعت تا ۱ سال، سه مدل، اهرم ۵ تا ۱۰۰\n"
               "• 📊 نقشهٔ لیکوییدیشن: سطوح همین حالا به تفکیک اهرم، و جمع تجمعی از قیمت\n"
               "دادهٔ زنده از Binance و Bybit مستقیم در خود صفحه خوانده می‌شود؛ لیکوییدیشن‌های واقعی هم زیر نمودار می‌آیند."),
        "ckb": ("چارتەکانی دەرهاتەکان بە شێوازی ماڵپەڕە پسپۆڕەکان، لە داتای گشتیی ئاڵوگۆڕگەکانەوە و بە ڕێگای نووسراو:\n"
                "• 🔥 نەخشەی گەرمیی لیکویدکردن: خەمڵاندنی ئەوەی پۆزیشنە لیڤەرێجدارەکان لە چ نرخێکدا لیکوید دەکرێن — هەر دراوێک، ١٢ کاتژمێر تا ١ ساڵ، سێ مۆدێل، لیڤەرێجی ٥ تا ١٠٠\n"
                "• 📊 نەخشەی لیکویدکردن: ئاستەکانی ئێستا بەپێی لیڤەرێج، و کۆی کۆکراوە لە نرخەوە\n"
                "داتای زیندوو لە Binance و Bybitـەوە ڕاستەوخۆ لە پەڕەکەدا دەخوێنرێتەوە؛ لیکویدە ڕاستەقینەکانیش لە ژێر چارتەکەدا دێن."),
        "kmr": ("Grafîkên derivatîvan bi şêwaza malperên pispor, ji daneyên giştî yên borsayan û bi rêbaza nivîsandî:\n"
                "• 🔥 Nexşeya germiyê ya tasfiyeyê: texmîna ku pozîsyonên bi leverage di kîjan bihayan de tên tasfiyekirin — her coin, 12 saet heta 1 sal, sê model, leverage 5 heta 100\n"
                "• 📊 Nexşeya tasfiyeyê: astên niha li gorî leverage, û koma li ser hev ji bihayê\n"
                "Daneyên zindî ji Binance û Bybit rasterast di rûpelê de tên xwendin; tasfiyeyên rastîn jî li binê grafîkê tên."),
        "ar": ("رسوم المشتقات على طريقة المواقع المتخصصة، من بيانات المنصات العامة وبمنهج مكتوب:\n"
               "• 🔥 الخريطة الحرارية للتصفيات: تقدير الأسعار التي تُصفّى عندها المراكز ذات الرافعة — أي عملة، من ١٢ ساعة إلى سنة، ثلاثة نماذج، رافعة من ٥ إلى ١٠٠\n"
               "• 📊 خريطة التصفيات: المستويات الحالية حسب الرافعة، والمجموع التراكمي من السعر\n"
               "البيانات المباشرة من Binance وBybit تُقرأ في الصفحة نفسها، والتصفيات الفعلية تظهر أسفل الرسم."),
        "en": ("Derivatives charts in the manner of the specialist sites, from the exchanges' public data and with the method written down:\n"
               "• 🔥 Liquidation heatmap: an estimate of the prices at which leveraged positions get liquidated — any coin, 12 hours to a year, three models, leverage 5x to 100x\n"
               "• 📊 Liquidation map: the levels standing now by leverage, and the running total from the price\n"
               "Live data from Binance and Bybit is read right in the page; real liquidations are drawn under the chart."),
    },
    "nfa": {"fa": "برآورد است، نه پیش‌بینی و نه توصیهٔ مالی.", "ckb": "خەمڵاندنە، نەک پێشبینی و نەک ئامۆژگاریی دارایی.",
            "kmr": "Texmîn e; ne pêşbînî ye û ne şîreta darayî ye.", "ar": "تقدير، لا توقّع ولا نصيحة مالية.",
            "en": "An estimate — not a forecast and not financial advice."},
    "b_heat": {"fa": "🔥 نقشهٔ حرارتی لیکوییدیشن", "ckb": "🔥 نەخشەی گەرمیی لیکویدکردن", "kmr": "🔥 Nexşeya germiyê ya tasfiyeyê",
               "ar": "🔥 الخريطة الحرارية للتصفيات", "en": "🔥 Liquidation heatmap"},
    "b_map": {"fa": "📊 نقشهٔ لیکوییدیشن", "ckb": "📊 نەخشەی لیکویدکردن", "kmr": "📊 Nexşeya tasfiyeyê", "ar": "📊 خريطة التصفيات",
              "en": "📊 Liquidation map"},
    "b_all": {"fa": "🔭 همهٔ نمودارها", "ckb": "🔭 هەموو چارتەکان", "kmr": "🔭 Hemû grafîk", "ar": "🔭 كل الرسوم", "en": "🔭 All charts"},
    "b_web": {"fa": "🌐 باز کردن در مرورگر", "ckb": "🌐 کردنەوە لە وێبگەڕ", "kmr": "🌐 Di gerokê de veke", "ar": "🌐 افتح في المتصفح",
              "en": "🌐 Open in the browser"},
}


def L(key, lang):
    return pick(TXT[key], lang)


def section(lang, load=None):
    """text of the section (`load` is accepted like the other sections' and not used: this section quotes no data file)"""
    return "\n\n".join([L("title", lang), L("body", lang), "<i>" + L("nfa", lang) + "</i>"])


def open_rows(lang):
    """the pages inside Telegram (Web App), and the heatmap in the browser; put above the standard navigation"""
    def w(k, path):
        return {"text": L("b_" + k, lang), "web_app": {"url": SITE + path}}
    return [[w("heat", HEAT)], [w("map", MAP), w("all", HUB)], [{"text": L("b_web", lang), "url": URL}]]


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
        prose = re.sub(r"Binance|Bybit|<[^>]+>|[A-Za-z]+", "", txt)
        if lang in ("fa", "ckb", "ar") and re.search(r"[0-9]", prose):
            print("FAIL", lang, "Latin digits in the prose")
            bad += 1
        if lang == "fa" and re.search("[٠-٩]", txt) or lang in ("ckb", "ar") and re.search("[۰-۹]", txt):
            print("FAIL", lang, "digits of another language")
            bad += 1
        rows = open_rows(lang)
        urls = [b.get("web_app", {}).get("url") or b.get("url") for r in rows for b in r]
        if urls != [SITE + p for p in (HEAT, MAP, HUB, HEAT)]:
            print("FAIL", lang, "buttons", urls)
            bad += 1
        if any(len(b["text"]) > 40 for r in rows for b in r):
            print("FAIL", lang, "button text too long")
            bad += 1
    for p in (HEAT, MAP, HUB):                      # every page a button opens exists in the repo
        if not os.path.exists(os.path.join(root, p.strip("/"), "index.html")):
            print("FAIL page missing", p)
            bad += 1
    print(f"bot_obs self-test: {bad} failures")
    raise SystemExit(1 if bad else 0)
