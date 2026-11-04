"""
Iran internet-outage readiness for the Coin_Kurd bot.

The bot itself runs on GitHub Actions (outside Iran), so an Iranian shutdown never stops it.
What breaks is the users' side and the Iranian price feeds. This module:

  1. detects an Iran-only disruption (not a global one) from two independent signals
       - IODA (Georgia Tech) active-probing + BGP series for country IR, compared with the
         previous 24 hours of the same series;
       - silence of the Iranian price channels the bot reads (they are run from inside Iran);
     with hysteresis (two checks in a row) so one bad reading never raises an alarm,
     and an admin override (/outage on|off|auto);
  2. on a change it tells the admins, records the prices at the start, and sends the
     "outage kit" (best proxies + what to do) to users who opted in — Telegram keeps
     undelivered messages, so even a user who is already cut off gets it on reconnect;
  3. when the internet returns it sends opted-in users a catch-up digest
     (how long it lasted, tether/dollar/BTC then → now, headlines they missed);
  4. adds a staleness banner to the Iranian price card and offers a compact,
     text-only price card that loads on a very slow line.
"""
import logging
import statistics
import time
from datetime import datetime, timezone

import requests

import bot_iran as IR
from bot_i18n import pick

log = logging.getLogger("refbot.outage")

IODA = "https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw/country/IR"
CHECK_EVERY = 600                  # seconds between checks
CONFIRM = 2                        # consecutive checks needed to change level
STALE_MIN = 75                     # Iranian price feeds silent this long (in Iran's waking hours) = suspicious
LEVELS = ("ok", "degraded", "blackout")
_last = [0.0]


def L(d, lang, /, **kw):
    s = pick(d, lang)
    return s.format(**kw) if kw else s


# ------------------------------------------------------------------ signals
def _ratio(values, recent=6):
    """latest real value / median of the earlier part of the window; None if not enough data"""
    pts = [(i, v) for i, v in enumerate(values) if isinstance(v, (int, float))]
    if len(pts) < 24:
        return None
    last_i, last_v = pts[-1]
    if len(values) - 1 - last_i > recent * 3:           # series stopped long ago: unknown, not "down"
        return None
    base = [v for i, v in pts if i < len(values) - recent]
    if len(base) < 12:
        return None
    med = statistics.median(base)
    return (last_v / med) if med else None


def ioda_metrics():
    """{"ping": r, "bgp": r, "telescope": r} ratios vs the previous day (1.0 = normal) or {} on failure"""
    now = int(time.time())
    try:
        r = requests.get(IODA, params={"from": now - 26 * 3600, "until": now}, timeout=25,
                         headers={"User-Agent": "CoinKurdBot/1.0 (+https://entekhab.net)"})
        r.raise_for_status()
        series = (r.json().get("data") or [[]])[0]
    except Exception as ex:  # noqa: BLE001
        log.info("IODA unavailable: %s", ex)
        return {}
    names = {"ping-slash24": "ping", "bgp": "bgp", "merit-nt": "telescope"}
    out = {}
    for x in series:
        key = names.get(x.get("datasource"))
        if key:
            v = _ratio(x.get("values") or [])
            if v is not None:
                out[key] = round(v, 3)
    return out


def feed_age_min(snap=None):
    """minutes since the newest Iranian price tick the bot can see (None if unknown)"""
    snap = snap or IR.snapshot()
    times = [snap.get("usdt_time"), snap.get("usd_time"), (snap.get("tt") or {}).get("time")]
    best = None
    for iso in times:
        try:
            dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        except Exception:
            continue
        m = (datetime.now(timezone.utc) - dt).total_seconds() / 60
        best = m if best is None else min(best, m)
    return best


def _iran_awake():
    """05:00–20:30 UTC ≈ 08:30–24:00 Tehran: price channels normally post every few minutes"""
    now = datetime.now(timezone.utc)
    return 5 * 60 <= now.hour * 60 + now.minute <= 20 * 60 + 30


def classify(m, age):
    """-> (level, reasons[]) from IODA ratios and the feed age.
    Silent price feeds alone can only give "degraded" and are marked in reasons as unconfirmed;
    users are alerted only when IODA confirms (see _switch)."""
    reasons = []
    ping, bgp, tel = m.get("ping"), m.get("bgp"), m.get("telescope")
    level = "ok"
    if (ping is not None and ping < 0.35) or (bgp is not None and bgp < 0.6):
        level = "blackout"
    elif (ping is not None and ping < 0.75) or (bgp is not None and bgp < 0.9) or (tel is not None and tel < 0.4):
        level = "degraded"
    if ping is not None:
        reasons.append(f"probing {ping:.0%}")
    if bgp is not None:
        reasons.append(f"BGP {bgp:.0%}")
    if tel is not None:
        reasons.append(f"telescope {tel:.0%}")
    if age is not None and _iran_awake() and age > STALE_MIN:
        reasons.append(f"IR price feeds silent {int(age)}′")
        if level == "ok":
            level = "degraded"
            reasons.append("unconfirmed")
    return level, reasons


# ------------------------------------------------------------------ state
def st(s):
    o = s.setdefault("outage", {})
    o.setdefault("level", "ok")
    o.setdefault("manual", None)
    o.setdefault("pending", [None, 0])
    o.setdefault("history", [])
    if o.get("manual") and time.time() > o.get("manual_until", 0):     # overrides expire; detection resumes
        o["manual"] = None
    return o


def level(s):
    o = st(s)
    return o["manual"] or o["level"]


def _prices():
    snap = IR.snapshot()
    out = {"usdt": snap.get("usdt"), "usd": snap.get("usd"), "t": int(time.time())}
    try:
        import bot_data as D
        lp = D.live_prices()
        out["btc"] = (lp.get("BTC") or (None,))[0]
        out["eth"] = (lp.get("ETH") or (None,))[0]
    except Exception:
        pass
    return out


def check(s, notify_admins, send_users):
    """run every CHECK_EVERY s. notify_admins(text); send_users(kind, level) — returns True if state changed"""
    if time.time() - _last[0] < CHECK_EVERY:
        return False
    _last[0] = time.time()
    o = st(s)
    m = ioda_metrics()
    try:
        age = feed_age_min()
    except Exception:
        age = None
    new, reasons = classify(m, age)
    o["metrics"], o["checked"], o["feed_age"] = m, int(time.time()), (round(age) if age is not None else None)
    if o["manual"]:
        return True
    if new == o["level"]:
        o["pending"] = [None, 0]
        if new != "ok" and "unconfirmed" not in reasons and not o.get("pushed"):
            _push(o, "kit", new, send_users)          # a feed-silence alarm that IODA now confirms
        return True
    p = o["pending"]
    p = [new, p[1] + 1] if p[0] == new else [new, 1]
    o["pending"] = p
    if p[1] < CONFIRM:
        return True
    return _switch(s, new, ", ".join(reasons) or "—", notify_admins, send_users, confirmed="unconfirmed" not in reasons)


def set_manual(s, value, notify_admins, send_users):
    """admin override: on (=blackout) | degraded | off (=ok) | auto"""
    o = st(s)
    value = {"on": "blackout"}.get(value, value)
    if value == "auto":
        o["manual"] = None
        return "auto"
    if value == "off":                                 # dismiss: back to ok now, automatic detection continues
        o["manual"] = None
        o["pending"] = [None, 0]
        _switch(s, "ok", "manual off", notify_admins, send_users)
        return "off (auto)"
    if value not in LEVELS:
        return None
    o["manual"], o["manual_until"] = value, time.time() + 12 * 3600
    _switch(s, value, "manual", notify_admins, send_users, confirmed=True)
    return value + " (12h)"


def _push(o, kind, lvl, send_users):
    try:
        send_users(kind, lvl)
        o["pushed"] = kind == "kit"
    except Exception:
        log.exception("outage user notify failed")


def _switch(s, new, why, notify_admins, send_users, confirmed=True):
    o = st(s)
    old = o["level"]
    if new == old:
        return False
    o["level"], o["pending"] = new, [None, 0]
    now = int(time.time())
    o["history"] = (o["history"] + [{"t": now, "from": old, "to": new, "why": why}])[-30:]
    if old == "ok":
        o["since"] = now
        o["snap0"] = _prices()
    if new == "ok":                                   # the digest needs these, so store them first
        o["last_outage"] = {"since": o.get("since"), "until": now, "snap0": o.get("snap0")}
        o.pop("since", None)
    try:
        notify_admins(f"🛰 Iran internet: <b>{old} → {new}</b>\n{why}")
    except Exception:
        log.exception("admin notify failed")
    # users hear about it only when the outage is confirmed by IODA (or set by an admin), and get a
    # digest only if they got the kit — a quiet evening on the price channels never pings everyone
    if old == "ok" and confirmed:
        _push(o, "kit", new, send_users)
    elif new == "ok" and o.get("pushed"):
        _push(o, "digest", old, send_users)
        o["pushed"] = False
    return True


# ------------------------------------------------------------------ texts
T = {
    "title": {"fa": "🆘 <b>حالت قطعی اینترنت ایران</b>", "ckb": "🆘 <b>دۆخی پچڕانی ئینتەرنێتی ئێران</b>",
              "kmr": "🆘 <b>Rewşa qutbûna înternetê ya Îranê</b>", "ar": "🆘 <b>وضع انقطاع الإنترنت في إيران</b>",
              "en": "🆘 <b>Iran internet-outage mode</b>"},
    "lvl_ok": {"fa": "🟢 فعلاً اختلال سراسری در اینترنت ایران دیده نمی‌شود.",
               "ckb": "🟢 ئێستا پچڕانی گشتی لە ئینتەرنێتی ئێران نابینرێت.",
               "kmr": "🟢 Niha di înterneta Îranê de qutbûneke giştî nayê dîtin.",
               "ar": "🟢 لا يُلاحظ حالياً انقطاع عام في إنترنت إيران.",
               "en": "🟢 No nationwide disruption of Iran's internet is visible right now."},
    "lvl_degraded": {"fa": "🟠 <b>اختلال جدی در اینترنت ایران</b> (از {since})",
                     "ckb": "🟠 <b>تێکچوونی جددی لە ئینتەرنێتی ئێران</b> (لە {since})",
                     "kmr": "🟠 <b>Tevliheviyeke cidî di înterneta Îranê de</b> (ji {since})",
                     "ar": "🟠 <b>اضطراب كبير في إنترنت إيران</b> (منذ {since})",
                     "en": "🟠 <b>Serious disruption of Iran's internet</b> (since {since})"},
    "lvl_blackout": {"fa": "🔴 <b>قطعی اینترنت بین‌الملل ایران</b> (از {since})",
                     "ckb": "🔴 <b>پچڕانی ئینتەرنێتی نێودەوڵەتی ئێران</b> (لە {since})",
                     "kmr": "🔴 <b>Înterneta navneteweyî ya Îranê qut e</b> (ji {since})",
                     "ar": "🔴 <b>انقطاع الإنترنت الدولي في إيران</b> (منذ {since})",
                     "en": "🔴 <b>Iran's international internet is cut</b> (since {since})"},
    "source": {"fa": "منبع: پایش IODA + سکوت کانال‌های قیمت داخل ایران",
               "ckb": "سەرچاوە: چاودێری IODA + بێدەنگی کەناڵەکانی نرخی ناو ئێران",
               "kmr": "Çavkanî: şopandina IODA + bêdengiya kanalên bihayê yên li Îranê",
               "ar": "المصدر: رصد IODA + توقف قنوات الأسعار داخل إيران",
               "en": "Source: IODA monitoring + silence of in-Iran price channels"},
    "kit": {
        "fa": ("🧰 <b>کیت آمادگی برای قطعی</b>\n"
               "1️⃣ همین حالا چند پروکسی از دکمهٔ 🛡 را در تلگرام ذخیره کن (تنظیمات ← داده و ذخیره‌سازی ← پروکسی). تلگرام پینگ هر کدام را نشان می‌دهد.\n"
               "2️⃣ پروکسی‌های <b>fake-TLS</b> (رمز با ee شروع می‌شود) روی پورت ۴۴۳ معمولاً دیرتر بسته می‌شوند.\n"
               "3️⃣ قبل از قطعی یک ابزار ضدسانسور معتبر را <b>فقط از منبع رسمی</b> نصب کن (مثل Psiphon از psiphon.ca یا Tor Browser با Snowflake از torproject.org). وسط قطعی نصب سخت است.\n"
               "4️⃣ وای‌فای و اینترنت موبایل را جدا امتحان کن؛ هر اپراتور رفتار متفاوتی دارد. پروتکل‌های UDP معمولاً اول بسته می‌شوند.\n"
               "5️⃣ هشدارهای قیمت تو در صف تلگرام می‌مانند و بعد از وصل شدن می‌رسند؛ زمان هر پیام را نگاه کن.\n"
               "6️⃣ در قطعی، قیمت‌های داخل ایران دیر به‌روز می‌شوند و صرافی‌ها ممکن است برداشت را محدود کنند؛ با عجله معامله نکن.\n"
               "🔐 رمز صرافی، کد ۲ مرحله‌ای یا عبارت بازیابی کیف پول را هرگز در اپ، سایت یا ربات ناشناس وارد نکن. کانفیگ‌های VPN ناشناس می‌توانند ترافیک تو را ببینند."),
        "ckb": ("🧰 <b>کیتی ئامادەیی بۆ پچڕان</b>\n"
                "1️⃣ هەر ئێستا چەند پرۆکسییەک لە دوگمەی 🛡 لە تێلێگرام پاشەکەوت بکە (ڕێکخستن ← داتا ← پرۆکسی).\n"
                "2️⃣ پرۆکسیی <b>fake-TLS</b> (نهێنی بە ee دەست پێدەکات) لەسەر پۆرتی 443 درەنگتر دادەخرێت.\n"
                "3️⃣ پێش پچڕان ئامرازێکی دژە-سانسۆر <b>تەنها لە سەرچاوەی فەرمی</b> دابمەزرێنە (Psiphon لە psiphon.ca یان Tor Browser لەگەڵ Snowflake لە torproject.org).\n"
                "4️⃣ وای‌فای و ئینتەرنێتی مۆبایل جیا تاقی بکەرەوە؛ هەر کۆمپانیایەک جیاوازە. UDP زووتر دادەخرێت.\n"
                "5️⃣ ئاگادارییەکانی نرخ لە ڕیزی تێلێگرام دەمێننەوە و دوای پەیوەندی دەگەن؛ کاتی هەر پەیامێک ببینە.\n"
                "6️⃣ لە کاتی پچڕاندا نرخەکانی ناو ئێران درەنگ نوێ دەبنەوە؛ بە پەلە مامەڵە مەکە.\n"
                "🔐 هەرگیز وشەی نهێنی ئاڵوگۆڕخانە یان ڕستەی گەڕاندنەوەی جزدان لە ئەپ یان بۆتی نەناسراو مەنووسە."),
        "kmr": ("🧰 <b>Kîta amadebûnê ji bo qutbûnê</b>\n"
                "1️⃣ Niha çend proxy ji bişkoka 🛡 di Telegramê de tomar bike (Settings → Data and Storage → Proxy).\n"
                "2️⃣ Proxyên <b>fake-TLS</b> (secret bi ee dest pê dike) li ser porta 443 dereng têne girtin.\n"
                "3️⃣ Berî qutbûnê amûreke dij-sansûrê <b>tenê ji çavkaniya fermî</b> saz bike (Psiphon ji psiphon.ca an Tor Browser bi Snowflake ji torproject.org).\n"
                "4️⃣ Wi-Fi û înterneta mobîl cuda biceribîne; her operator cuda ye. UDP pêşî tê girtin.\n"
                "5️⃣ Hişyariyên bihayê di rêza Telegramê de dimînin û piştî girêdanê digihîjin; dema her peyamê binêre.\n"
                "6️⃣ Di qutbûnê de bihayên hundirê Îranê dereng nû dibin; bi lez bazirganiyê neke.\n"
                "🔐 Tu carî şîfreya borsayê an hevoka vegerandina cûzdanê di app an botên nenas de nenivîse."),
        "ar": ("🧰 <b>حقيبة الاستعداد للانقطاع</b>\n"
               "1️⃣ احفظ الآن عدة بروكسيات من زر 🛡 في تيليغرام (الإعدادات ← البيانات والتخزين ← البروكسي).\n"
               "2️⃣ بروكسيات <b>fake-TLS</b> (السر يبدأ بـ ee) على المنفذ 443 تُحجب عادةً متأخرة.\n"
               "3️⃣ ثبّت قبل الانقطاع أداة موثوقة لتجاوز الحجب <b>من مصدرها الرسمي فقط</b> (Psiphon من psiphon.ca أو متصفح Tor مع Snowflake من torproject.org).\n"
               "4️⃣ جرّب الواي فاي وإنترنت الجوال كلاً على حدة؛ كل مشغل يختلف. بروتوكولات UDP تُحجب أولاً.\n"
               "5️⃣ تبقى تنبيهات الأسعار في طابور تيليغرام وتصلك بعد الاتصال؛ انتبه لوقت كل رسالة.\n"
               "6️⃣ أثناء الانقطاع تتأخر أسعار السوق الإيرانية وقد تقيّد المنصات السحب؛ لا تتداول بعجلة.\n"
               "🔐 لا تُدخل أبداً كلمة مرور المنصة أو عبارة استرداد المحفظة في تطبيق أو بوت مجهول."),
        "en": ("🧰 <b>Outage readiness kit</b>\n"
               "1️⃣ Save several proxies from the 🛡 button in Telegram now (Settings → Data and Storage → Proxy). Telegram shows each one's ping.\n"
               "2️⃣ <b>Fake-TLS</b> proxies (secret starts with ee) on port 443 usually survive longest.\n"
               "3️⃣ Before an outage, install a reputable circumvention tool <b>from its official source only</b> (e.g. Psiphon from psiphon.ca, or Tor Browser with Snowflake from torproject.org). Installing during a blackout is hard.\n"
               "4️⃣ Try Wi-Fi and mobile data separately; each operator behaves differently. UDP-based tools are usually blocked first.\n"
               "5️⃣ Your price alerts wait in Telegram's queue and arrive after you reconnect — check each message's time.\n"
               "6️⃣ During an outage Iranian prices update late and exchanges may limit withdrawals; don't trade in a rush.\n"
               "🔐 Never type an exchange password, 2FA code or wallet recovery phrase into an unknown app, site or bot. Unknown VPN configs can see your traffic."),
    },
    "stale": {"fa": "⚠️ منابع قیمت داخل ایران <b>{m} دقیقه</b> است به‌روز نشده‌اند (احتمال اختلال اینترنت). آخرین قیمت معتبر نمایش داده می‌شود.",
              "ckb": "⚠️ سەرچاوەکانی نرخی ناو ئێران <b>{m} خولەکە</b> نوێ نەبوونەتەوە (ئەگەری پچڕانی ئینتەرنێت). دوایین نرخ پیشان دەدرێت.",
              "kmr": "⚠️ Çavkaniyên bihayê yên Îranê <b>{m} deqe</b> ne nû bûne (dibe ku înternet qut be). Bihayê dawî tê nîşandan.",
              "ar": "⚠️ مصادر الأسعار داخل إيران لم تتحدث منذ <b>{m} دقيقة</b> (احتمال انقطاع الإنترنت). يُعرض آخر سعر معروف.",
              "en": "⚠️ In-Iran price sources haven't updated for <b>{m} min</b> (possible internet disruption). Showing the last known prices."},
    "sub_on": {"fa": "🔔 خبرم کن (قطعی/وصل شدن): روشن کن", "ckb": "🔔 ئاگادارم بکە (پچڕان/گەڕانەوە): هەڵیبکە",
               "kmr": "🔔 Min agahdar bike (qutbûn/vegerîn): veke", "ar": "🔔 نبّهني (الانقطاع/العودة): تشغيل",
               "en": "🔔 Notify me (outage/restore): turn on"},
    "sub_off": {"fa": "🔕 خبرم کن (قطعی/وصل شدن): خاموش کن", "ckb": "🔕 ئاگادارم بکە: بیکوژێنەوە",
                "kmr": "🔕 Min agahdar bike: bigire", "ar": "🔕 نبّهني: إيقاف", "en": "🔕 Notify me: turn off"},
    "sub_note": {"fa": "اگر روشن باشد، با شروع قطعی بهترین پروکسی‌ها و کیت آمادگی، و بعد از وصل شدن خلاصهٔ اتفاقات برایت ارسال می‌شود.",
                 "ckb": "ئەگەر هەڵکرابێت، لە دەستپێکی پچڕاندا باشترین پرۆکسییەکان و کیتەکە، و دوای گەڕانەوە پوختەی ڕووداوەکانت بۆ دێت.",
                 "kmr": "Heke vekirî be, di destpêka qutbûnê de proxyên herî baş û kît, û piştî vegerê kurteya bûyeran ji te re tê.",
                 "ar": "عند التشغيل، تصلك أفضل البروكسيات وحقيبة الاستعداد عند بدء الانقطاع، وملخص ما فاتك بعد عودة الإنترنت.",
                 "en": "When on, you get the best proxies + the kit when an outage starts, and a catch-up digest when it ends."},
    "b_compact": {"fa": "📋 قیمت‌ها (نسخهٔ سبک)", "ckb": "📋 نرخەکان (سووک)", "kmr": "📋 Biha (sivik)",
                  "ar": "📋 الأسعار (نسخة خفيفة)", "en": "📋 Prices (lite)"},
    "b_kit": {"fa": "🧰 کیت آمادگی", "ckb": "🧰 کیتی ئامادەیی", "kmr": "🧰 Kîta amadebûnê", "ar": "🧰 حقيبة الاستعداد",
              "en": "🧰 Readiness kit"},
    "kit_push": {"fa": "🆘 <b>اینترنت ایران دچار اختلال شده است.</b>\nاین پیام را نگه دار و پروکسی‌ها را همین حالا ذخیره کن 👇",
                 "ckb": "🆘 <b>ئینتەرنێتی ئێران تێکچووە.</b>\nئەم پەیامە بهێڵەرەوە و پرۆکسییەکان هەر ئێستا پاشەکەوت بکە 👇",
                 "kmr": "🆘 <b>Înterneta Îranê tevlihev bûye.</b>\nVê peyamê biparêze û proxyan niha tomar bike 👇",
                 "ar": "🆘 <b>إنترنت إيران يعاني من اضطراب.</b>\nاحتفظ بهذه الرسالة واحفظ البروكسيات الآن 👇",
                 "en": "🆘 <b>Iran's internet is disrupted.</b>\nKeep this message and save the proxies now 👇"},
    "digest_title": {"fa": "📦 <b>خوش برگشتی! خلاصهٔ دوران قطعی</b> ({h} ساعت)",
                     "ckb": "📦 <b>بەخێربێیتەوە! پوختەی ماوەی پچڕان</b> ({h} کاتژمێر)",
                     "kmr": "📦 <b>Bi xêr hatî! Kurteya dema qutbûnê</b> ({h} saet)",
                     "ar": "📦 <b>أهلاً بعودتك! ملخص فترة الانقطاع</b> ({h} ساعة)",
                     "en": "📦 <b>Welcome back! What you missed during the outage</b> ({h} h)"},
    "digest_news": {"fa": "📰 تیترهای مهم این مدت:", "ckb": "📰 هەواڵە گرنگەکانی ئەم ماوەیە:", "kmr": "📰 Sernivîsên girîng:",
                    "ar": "📰 أهم العناوين خلال هذه الفترة:", "en": "📰 Key headlines meanwhile:"},
    "lite_title": {"fa": "📋 <b>قیمت‌ها — نسخهٔ سبک</b>", "ckb": "📋 <b>نرخەکان — سووک</b>", "kmr": "📋 <b>Biha — sivik</b>",
                   "ar": "📋 <b>الأسعار — نسخة خفيفة</b>", "en": "📋 <b>Prices — lite</b>"},
    "usdt": {"fa": "تتر", "ckb": "تەتەر", "kmr": "Tether", "ar": "تيثر", "en": "USDT"},
    "usd": {"fa": "دلار", "ckb": "دۆلار", "kmr": "Dolar", "ar": "دولار", "en": "USD"},
    "toman": {"fa": "تومان", "ckb": "تمەن", "kmr": "tomen", "ar": "تومان", "en": "toman"},
}


def _hhmm(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d %H:%M UTC") if ts else "?"


def status_line(s, lang):
    o = st(s)
    lv = level(s)
    if lv == "ok":
        return L(T["lvl_ok"], lang)
    return L(T["lvl_" + lv], lang, since=_hhmm(o.get("since")))


def banner(s, lang, snap=None):
    """one-line warning for the Iranian price card, or ''"""
    lines = []
    if level(s) != "ok":
        lines.append(status_line(s, lang))
    try:
        age = feed_age_min(snap)
    except Exception:
        age = None
    if age is not None and age > 45 and _iran_awake():
        lines.append(L(T["stale"], lang, m=int(age)))
    return "\n".join(lines)


def compact(lang, D):
    """a few short lines that load on a 2G line; every figure carries its age"""
    snap = IR.snapshot()
    out = [L(T["lite_title"], lang)]
    for k in ("usdt", "usd"):
        v, iso = snap.get(k), snap.get(k + "_time")
        if v:
            out.append(f"{L(T[k], lang)}: {IR.toman(v)} {L(T['toman'], lang)} · {IR.ago(iso)}")
    lp = D.live_prices()
    for c in ("BTC", "ETH", "SOL", "TRX"):
        if lp.get(c):
            p, ch = lp[c]
            out.append(f"{c}: {D.fp(p)} ({ch:+.1f}%)")
    age = feed_age_min(snap)
    if age is not None and age > 45:
        out.append(L(T["stale"], lang, m=int(age)))
    return "\n".join(out)


def section(s, lang):
    o = st(s)
    out = [L(T["title"], lang), "", status_line(s, lang)]
    m = o.get("metrics") or {}
    if m:
        parts = [f"{k} {v:.0%}" for k, v in m.items()]
        out.append("📶 " + " · ".join(parts) + f"  ({L(T['source'], lang)})")
    out += ["", L(T["kit"], lang), "", "ℹ️ " + L(T["sub_note"], lang)]
    return "\n".join(out)


def digest(s, lang, D, last=None):
    """catch-up message after an outage"""
    o = st(s)
    last = last or o.get("last_outage") or {}
    t0, t1 = last.get("since") or 0, last.get("until") or int(time.time())
    hrs = max(1, round((t1 - t0) / 3600)) if t0 else "?"
    out = [L(T["digest_title"], lang, h=hrs), ""]
    a, b = last.get("snap0") or {}, _prices()
    rows = [("usdt", L(T["usdt"], lang), IR.toman), ("usd", L(T["usd"], lang), IR.toman), ("btc", "BTC", D.fp), ("eth", "ETH", D.fp)]
    for k, name, f in rows:
        if a.get(k) and b.get(k):
            pct = (b[k] / a[k] - 1) * 100
            out.append(f"{'🟢' if pct >= 0 else '🔴'} {name}: {f(a[k])} → {f(b[k])} ({pct:+.1f}%)")
    heads = []
    try:
        news = D.load("news") or {}
        items = ((news.get("regional") or {}).get("items") or []) + (news.get("items") or [])
        for it in items:
            try:
                ts = datetime.fromisoformat(str(it.get("date")).replace("Z", "+00:00")).timestamp()
            except Exception:
                continue
            if ts >= t0:
                heads.append(it)
        heads = heads[:6]
    except Exception:
        heads = []
    if heads:
        out += ["", L(T["digest_news"], lang)]
        out += [f"• <a href=\"{D.e(h.get('url', ''))}\">{D.e(h.get('title', ''))[:120]}</a>" for h in heads]
    return "\n".join(out)
