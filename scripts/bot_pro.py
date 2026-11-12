"""
The site's live market (/market/) in the bot:

  * section "pro": what the workspace offers, the next high-impact economic event (from data/ecocal.json, else
    data/events.json) and two ways in: inside Telegram (a Web App button) or in the browser.
  * the site's alert hand-off: /market/ opens  t.me/<bot>?start=a_<COIN>_<PRICE>  (PRICE with "d" for the decimal
    point, because a start parameter may only hold [A-Za-z0-9_-]). The bot only *offers* the alert; nothing is stored
    until the user taps «add», which then goes through refbot.parse_alert like a typed /alert, with the same checks.

Read-only apart from that explicit tap. Self-test: python3 scripts/bot_pro.py
"""
import re
from datetime import datetime, timezone

from bot_i18n import pick

SITE = "https://entekhab.net"
URL = SITE + "/market/"

TXT = {
    "title": {"fa": "📈 <b>بازار زنده</b>", "ckb": "📈 <b>بازاڕی زیندوو</b>", "kmr": "📈 <b>Bazara zindî</b>", "ar": "📈 <b>السوق المباشر</b>",
              "en": "📈 <b>Live market</b>"},
    "body": {
        "fa": ("میز تحلیل کامل سایت، با دادهٔ زندهٔ بایننس:\n"
               "• تا ۱۶ نمودار هم‌زمان با همگام‌سازی\n• تایم‌فریم ثانیه‌ای (۱ تا ۳۰ ثانیه) و هر تایم‌فریم دلخواه\n"
               "• بازپخش کندل‌ها با ۹ سرعت و معاملهٔ تمرینی\n• ۲۲ اندیکاتور، فیبوناچی، گن، چنگال اندروز و پوزیشن لانگ/شورت\n"
               "• هشدار قیمت و اندیکاتور، دیده‌بان با پرچم رنگی\n• تقویم اقتصادی و پرچم رویدادها روی چارت\n"
               "• ذخیرهٔ خودکار، تمپلیت، دانلود CSV و لینک اشتراک"),
        "ckb": ("مێزی تەواوی شیکاریی ماڵپەڕ، بە داتای زیندووی بایننس:\n"
                "• تا ١٦ چارت پێکەوە بە هاوکاتکردن\n• تایمفرەیمی چرکەیی (١ تا ٣٠ چرکە) و هەر تایمفرەیمێکی دڵخواز\n"
                "• دووبارە پەخشی مۆمەکان بە ٩ خێرایی و مامەڵەی ڕاهێنان\n• ٢٢ ئیندیکاتۆر، فیبۆناچی، گان، چنگاڵی ئەندرووز و پۆزیشنی لۆنگ/شۆرت\n"
                "• ئاگادارکەرەوەی نرخ و ئیندیکاتۆر، چاودێری بە ئاڵای ڕەنگی\n• ڕۆژژمێری ئابووری و ئاڵای ڕووداوەکان لەسەر چارت\n"
                "• پاشەکەوتی خۆکار، قاڵب، داگرتنی CSV و لینکی هاوبەشکردن"),
        "kmr": ("Maseya analîzê ya temam a malperê, bi daneyên zindî yên Binance:\n"
                "• Heta 16 grafîk bi hev re\n• Demên saniyeyî (1–30 s) û her demeke xwestî\n• Dubarelîstina mûman bi 9 lezan\n"
                "• 22 nîşander, Fibonacci, Gann û pozîsyonên long/short\n• Hişyariyên biha û nîşanderan\n• Salnameya aborî li ser grafîkê\n"
                "• Tomarkirina xweber, şablon, CSV û lînka parvekirinê"),
        "ar": ("منصة التحليل الكاملة للموقع ببيانات Binance المباشرة:\n"
               "• حتى ١٦ رسمًا معًا مع المزامنة\n• أطر زمنية بالثواني (١–٣٠ ثانية) وأي إطار مخصّص\n"
               "• إعادة تشغيل الشموع بتسع سرعات مع صفقات تدريبية\n• ٢٢ مؤشرًا وفيبوناتشي وغان وشوكة أندروز ومراكز الشراء والبيع\n"
               "• تنبيهات السعر والمؤشرات وقوائم متابعة بأعلام ملوّنة\n• التقويم الاقتصادي وأعلام الأحداث على الرسم\n"
               "• حفظ تلقائي وقوالب وتنزيل CSV ورابط مشاركة"),
        "en": ("The site's full analysis desk, on live Binance data:\n"
               "• Up to 16 synced charts at once\n• Seconds timeframes (1–30 s) and any custom timeframe\n"
               "• Bar replay at nine speeds with practice trades\n• 22 indicators, Fibonacci, Gann, Andrews' pitchfork, long/short positions\n"
               "• Price and indicator alerts, watchlists with colour flags\n• The economic calendar, with event flags on the chart\n"
               "• Automatic saving, templates, CSV download and a share link"),
    },
    "next": {"fa": "⏳ رویداد مهم بعدی: <b>{c} · {n}</b> — {w}", "ckb": "⏳ ڕووداوی گرنگی داهاتوو: <b>{c} · {n}</b> — {w}",
             "kmr": "⏳ Bûyera girîng a pêş: <b>{c} · {n}</b> — {w}", "ar": "⏳ الحدث المهم التالي: <b>{c} · {n}</b> — {w}",
             "en": "⏳ Next high-impact event: <b>{c} · {n}</b> — {w}"},
    "tip": {"fa": "هشدار قیمتی که در سایت می‌سازید، با دکمهٔ ✈ به همین ربات می‌آید تا وقتی سایت بسته است هم خبرتان کند.",
            "ckb": "ئاگادارکەرەوەی نرخ کە لە ماڵپەڕ دروستی دەکەیت، بە دوگمەی ✈ دێتە ئەم بۆتە تا کاتێک ماڵپەڕ داخراوە ئاگادارت بکاتەوە.",
            "kmr": "Hişyariya bihayê ya li malperê, bi bişkoka ✈ tê vê botê da ku dema malper girtî be jî te agahdar bike.",
            "ar": "تنبيه السعر الذي تنشئه في الموقع يصل بزر ✈ إلى هذا البوت ليخبرك حتى عندما يكون الموقع مغلقًا.",
            "en": "A price alert made on the site comes to this bot with the ✈ button, so it reaches you even when the site is closed."},
    "b_tg": {"fa": "📈 باز کردن در تلگرام", "ckb": "📈 کردنەوە لە تێلێگرام", "kmr": "📈 Di Telegramê de veke", "ar": "📈 افتح داخل تيليغرام",
             "en": "📈 Open inside Telegram"},
    "b_web": {"fa": "🌐 باز کردن در مرورگر", "ckb": "🌐 کردنەوە لە وێبگەڕ", "kmr": "🌐 Di gerokê de veke", "ar": "🌐 افتح في المتصفح",
              "en": "🌐 Open in the browser"},
    "offer": {"fa": "🔔 هشدار قیمت از سایت:\n<b>{c}</b> وقتی به <b>{p}</b> برسد\n\nاین هشدار تا وقتی «افزودن» را نزنید ذخیره نمی‌شود.",
              "ckb": "🔔 ئاگادارکەرەوەی نرخ لە ماڵپەڕەوە:\n<b>{c}</b> کاتێک دەگاتە <b>{p}</b>\n\nتا «زیادکردن» دانەگریت پاشەکەوت ناکرێت.",
              "kmr": "🔔 Hişyariya bihayê ji malperê:\n<b>{c}</b> dema bigihêje <b>{p}</b>\n\nHeta tu «Lê zêde bike» nekî nayê tomarkirin.",
              "ar": "🔔 تنبيه سعر من الموقع:\n<b>{c}</b> عندما يصل إلى <b>{p}</b>\n\nلن يُحفظ التنبيه حتى تضغط «إضافة».",
              "en": "🔔 Price alert from the site:\n<b>{c}</b> when it reaches <b>{p}</b>\n\nNothing is saved until you tap “Add”."},
    "b_add": {"fa": "✅ افزودن هشدار", "ckb": "✅ زیادکردنی ئاگادارکەرەوە", "kmr": "✅ Hişyariyê lê zêde bike", "ar": "✅ إضافة التنبيه", "en": "✅ Add the alert"},
    "b_no": {"fa": "✖️ نه", "ckb": "✖️ نەخێر", "kmr": "✖️ Na", "ar": "✖️ لا", "en": "✖️ No"},
    "bad": {"fa": "این لینک هشدار درست نیست.", "ckb": "ئەم لینکی ئاگادارکەرەوەیە دروست نییە.", "kmr": "Ev lînka hişyariyê ne rast e.",
            "ar": "رابط التنبيه هذا غير صالح.", "en": "This alert link is not valid."},
}


def L(key, lang, **kw):
    s = pick(TXT[key], lang)
    return s.format(**kw) if kw else s


def _link(arg):
    """'a_BTC_72155d5' -> ('BTC', 72155.5, '72155.5') : the price kept as the exact decimal the site sent"""
    m = re.fullmatch(r"a_([A-Z0-9]{2,12})_(\d{1,12}(?:d\d{1,18})?)", str(arg or ""))
    if not m:
        return None
    ip, _, fr = m.group(2).partition("d")
    fr = fr.rstrip("0")
    txt = (ip.lstrip("0") or "0") + ("." + fr if fr else "")
    price = float(txt)
    if not (0 < price < 1e12):
        return None
    return m.group(1), price, txt


def parse_link(arg):
    """'a_BTC_72155d5' -> ('BTC', 72155.5) ; anything else -> None"""
    got = _link(arg)
    return got[:2] if got else None


def price_txt(txt):
    """'72155.5' -> '$72,155.5' : exactly the price set on the site (never rounded), in dollars"""
    ip, _, fr = str(txt).partition(".")
    return "$" + f"{int(ip):,}" + ("." + fr if fr else "")


def offer(arg, lang):
    """(text, inline rows) for a deep link from the site, or None for a malformed one"""
    got = _link(arg)
    if not got:
        return None
    coin, _, txt = got
    return L("offer", lang, c=coin, p=price_txt(txt)), [[{"text": L("b_add", lang), "callback_data": f"pa:{coin}:{txt}"},
                                                        {"text": L("b_no", lang), "callback_data": "m:alerts"}]]


def parse_callback(data):
    """'pa:BTC:72155.5' -> ('BTC', '72155.5') for refbot.parse_alert; None when it does not look right"""
    m = re.fullmatch(r"pa:([A-Z0-9]{2,12}):(\d{1,12}(?:\.\d{1,18})?)", str(data or ""))
    if not m or not (0 < float(m.group(2)) < 1e12):
        return None
    return m.group(1), m.group(2)


def _next_event(load):
    now = datetime.now(timezone.utc).timestamp()
    ev = (load("ecocal") or {}).get("events") or []
    hi = [e for e in ev if e.get("i") == "H" and e.get("t", 0) > now]
    if hi:
        return min(hi, key=lambda e: e["t"])
    for e in sorted((load("events") or {}).get("events") or [], key=lambda e: e.get("date", "")):
        try:
            t = datetime.fromisoformat(e["date"]).timestamp()
        except (KeyError, ValueError):
            continue
        if t > now and e.get("impact") == "High":
            return {"t": t, "c": "USD", "n": e.get("title", ""), "tr": {"fa": e.get("title_fa") or ""}}
    return None


def _wait(sec):
    h, m = int(sec // 3600), int(sec % 3600 // 60)
    return f"{h // 24}d {h % 24}h" if h >= 48 else f"{h}h {m}m" if h else f"{m}m"


def section(lang, load=None):
    """text of the section; `load` is bot_data.load (injected so the self-test runs without the data folder)"""
    parts = [L("title", lang), L("body", lang)]
    if load:
        try:
            e = _next_event(load)
            if e:
                name = (e.get("tr") or {}).get(lang) or e.get("n", "")
                parts.append(L("next", lang, c=e.get("c", ""), n=name, w=_wait(e["t"] - datetime.now(timezone.utc).timestamp())))
        except Exception:      # a missing or broken data file never breaks the section
            pass
    parts.append("<i>" + L("tip", lang) + "</i>")
    return "\n\n".join(parts)


def open_rows(lang):
    """the two ways in, put above the standard navigation"""
    return [[{"text": L("b_tg", lang), "web_app": {"url": URL}}], [{"text": L("b_web", lang), "url": URL}]]


if __name__ == "__main__":
    bad = 0
    for arg, want in [("a_BTC_72155d5", ("BTC", 72155.5)), ("a_PEPE_0d0000121", ("PEPE", 0.0000121)), ("a_ETH_2000", ("ETH", 2000.0)),
                      ("a_btc_100", None), ("a_BTC_", None), ("a_BTC_1d2d3", None), ("a_BTC_0", None), ("w_BTC-ETH", None),
                      ("a_BTC_100;DROP", None), ("a_" + "A" * 13 + "_1", None)]:
        got = parse_link(arg)
        if got != want:
            print("FAIL parse", arg, got, want)
            bad += 1
    for lang in ("fa", "ckb", "kmr", "ar", "en"):
        o = offer("a_SOL_143d25", lang)
        if not o or "143.25" not in o[0] or o[1][0][0]["callback_data"] != "pa:SOL:143.25" or len(o[1][0][0]["callback_data"]) > 64:
            print("FAIL offer", lang, o)
            bad += 1
        if parse_callback(o[1][0][0]["callback_data"]) != ("SOL", "143.25"):
            print("FAIL callback", lang)
            bad += 1
        txt = section(lang, load=lambda n: {"events": [{"t": datetime.now(timezone.utc).timestamp() + 7200, "c": "USD", "i": "H", "n": "CPI m/m",
                                                        "tr": {"fa": "تورم ماهانه"}}]} if n == "ecocal" else {})
        if "CPI" not in txt and "تورم" not in txt:
            print("FAIL section", lang)
            bad += 1
    if parse_callback("pa:BTC:0.00001") != ("BTC", "0.00001") or parse_callback("pa:BTC:x") is not None or parse_callback("pa:BTC:1e-05") is not None:
        print("FAIL small-price callback")
        bad += 1
    small = offer("a_PEPE_0d0000121", "en")
    if parse_callback(small[1][0][0]["callback_data"]) is None:
        print("FAIL tiny price round trip", small[1])
        bad += 1
    for arg, cb, shown in [("a_BTTC_0d0000006", "pa:BTTC:0.0000006", "$0.0000006"), ("a_BTC_072155d50", "pa:BTC:72155.5", "$72,155.5"),
                           ("a_X1_0d000000001234567891", "pa:X1:0.000000001234567891", "$0.000000001234567891"),
                           ("a_ABCDEFGHIJKL_999999999999d123456789012345678", "pa:ABCDEFGHIJKL:999999999999.123456789012345678",
                            "$999,999,999,999.123456789012345678")]:
        o = offer(arg, "en")
        if not o or o[1][0][0]["callback_data"] != cb or shown not in o[0] or len(cb.encode()) > 64 or not parse_callback(cb):
            print("FAIL exact price", arg, o)
            bad += 1
    for arg in ("a_BTC_0d0", "a_BTC_00", "a_BTC_1d0000000000000000001", "a_BTC_1000000000000"):
        if parse_link(arg) is not None:
            print("FAIL should reject", arg, parse_link(arg))
            bad += 1
    print(f"bot_pro self-test: {bad} failures")
    raise SystemExit(1 if bad else 0)
