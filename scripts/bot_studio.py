"""
Coin_Kurd studio — branded daily formats for the main channel (@Coin_Kurd), built from real data only.

Daily line-up (Iran time ≈ UTC+3:30), roughly 40% news · 30% own analysis · 15% education · 10% viral · 5% interactive:
  08:00  ☀️ بولتن ۶۰ ثانیه‌ای            five things that moved the market (news)
  10:00  📚 هر روز یک مفهوم ترید          rotating curriculum (education)
  13:00  🟠 رادار کوین کورد | بیت‌کوین    price → volume → open interest → funding → long/short → takers → liquidations
                                         → dominance → fear & greed → whales (on-chain feed) → verdict (analysis)
  16:00  🔢 عدد روز                       one striking number from today's data (viral)
  17:30  🗳 نظرسنجی سناریوی ۲۴ ساعت       poll built from the live price (interactive)
  21:00  🌙 امروز چه چیزی تغییر کرد؟      morning vs evening snapshot + the day's news (news)
  22:00  🟣 رادار کوین کورد | اتریوم      same chain for Ethereum (analysis)
Every post gets its own Coin_Kurd image card (bot_reel.frame), the house rules and the exact channel signature.
"""
import html
import io
import logging
import os
import re
import threading
import time
from datetime import datetime, timezone

import ai
import bot_data as D
import bot_feeds as F
import bot_reel as R
from bot_videos import SIG, SIG_LEN

log = logging.getLogger("studio")

SLOTS = [  # (utc hour, utc minute, kind)
    (4, 30, "morning"), (6, 30, "lesson"), (9, 30, "radar_btc"), (12, 30, "number"),
    (14, 0, "poll"), (17, 30, "night"), (18, 30, "radar_eth"),
]
WINDOW = 4 * 3600          # a missed slot is still posted within this many seconds
GAP = 240                  # seconds between two studio posts

RULES = """تو سردبیر کانال تلگرامی «کوین کورد» هستی؛ یک برند رسانه‌ای حرفه‌ای کریپتو به زبان پارسی، نه یک کانال خبری معمولی

قانون‌های قطعی:
- فقط از داده‌ها و متن‌هایی که پایین داده شده استفاده کن؛ هیچ عدد، نام یا رویدادی از خودت نساز. اگر داده‌ای نیست درباره‌اش چیزی نگو
- هر پست باید یک دلیل روشن برای فرستادن به یک نفر دیگر داشته باشد: یک نکتهٔ کاربردی، عدد مهم یا هشدار مشخص
- لحن: حرفه‌ای، دقیق، کوتاه، جذاب؛ بدون اغراق و بدون توصیهٔ مستقیم خرید یا فروش
- هیچ کلمهٔ انگلیسی یا حروف لاتین ننویس (به‌جای اصطلاحات انگلیسی معادل پارسی بنویس: موقعیت‌های باز، نرخ تأمین مالی، نسبت خرید به فروش، لیکوییدیشن)
- هیچ لینک، نام منبع یا نام رسانه ننویس
- هر خط با یک کلمهٔ پارسی یا ایموجی شروع شود؛ آخر خط‌ها نقطه نگذار
- اعداد را دقیقاً همان‌طور که در داده‌ها آمده بنویس؛ اعداد اعشاری کوچک (مثل نرخ تأمین مالی ۰٫۰۱۰۰ یا نسبت ۲٫۴۸) را هرگز گرد نکن و واحد را روشن بگو
- هر سطح قیمتی که می‌گویی باید یکی از عددهای داده‌ها باشد (قیمت، سقف یا کف ۴۸ ساعت)؛ از الگوی گذشته یا سطحی که در داده نیست حرف نزن
- در پایان دقیقاً چهار هشتگ پارسی در یک خط
- کل متن حداکثر {limit} کاراکتر
- فقط متن پست را بنویس، بدون توضیح اضافه
"""

FORMATS = {
    "morning": """قالب «☀️ بولتن ۶۰ ثانیه‌ای کوین کورد»:
خط اول: ☀️ بولتن ۶۰ ثانیه‌ای کوین کورد
بعد «۳ چیزی که امروز بازار را تکان داد» با سه خط شماره‌دار (هر خط حداکثر ۲۰ کلمه)
بعد «📌 این عدد را به خاطر بسپار:» و یک عدد مهم از داده‌ها با یک جملهٔ توضیح
بعد «👀 بازار الان چه چیزی را نمی‌بیند؟» در یک جمله بر پایهٔ داده‌ها""",
    "lesson": """قالب «📚 هر روز یک مفهوم ترید» دربارهٔ مفهوم: {topic}
خط اول: 📚 هر روز یک مفهوم ترید | {topic}
«تعریف ساده» در ۲ جمله، «چرا مهم است» در ۲ خط، «یک مثال» با عددهای فرضی که صریحاً بگویی فرضی است،
«اشتباه رایج» در یک خط، «نکتهٔ کوین کورد» در یک جمله
این پست آموزشی است و برای این بخش می‌توانی از دانش عمومی خودت استفاده کنی ولی دربارهٔ قیمت فعلی بازار چیزی نگو""",
    "radar": """قالب امضای کوین کورد «{head}»:
خط اول: {head}
خط دوم دقیقاً: قیمت ← حجم ← موقعیت‌های باز ← نرخ تأمین مالی ← نسبت خریدار و فروشنده ← لیکوییدیشن ← نقدینگی ← نتیجه
بعد برای هر حلقه یک خط کوتاه با عدد واقعی از داده‌ها و معنی آن (فقط حلقه‌هایی که داده دارند)
بعد «🧭 نتیجه:» در دو جمله: بازار واقعاً چه می‌گوید و یک سطح یا عدد کلیدی برای زیر نظر گرفتن
بعد «⚠️ ریسک:» در یک جمله""",
    "number": """قالب «🔢 عدد روز کوین کورد»:
خط اول: 🔢 عدد روز کوین کورد
خط دوم: فقط همان عدد بزرگ و واحدش
بعد در ۳ خط: این عدد چیست، چرا امروز مهم است، با چه چیزی مقایسه شود (فقط از داده‌ها)
بعد یک جمله با شروع «📌 قبل از اینکه همه درباره‌اش صحبت کنند:»
مهم‌ترین و غیرمنتظره‌ترین عدد داده‌ها را انتخاب کن""",
    "night": """قالب «🌙 امروز چه چیزی تغییر کرد؟»:
خط اول: 🌙 بولتن شبانه کوین کورد | امروز چه چیزی تغییر کرد؟
مقایسهٔ عکس فوری صبح با الان در ۳ تا ۴ خط با عدد (قیمت، موقعیت‌های باز، شاخص ترس و طمع، سلطهٔ بیت‌کوین)
بعد «📰 مهم‌ترین خبرهای امروز» در ۳ خط کوتاه
بعد «🔭 فردا چه چیزی را زیر نظر بگیریم؟» در یک تا دو خط (از تقویم رویدادها اگر هست)""",
}

LESSONS = [
    "ساختار بازار", "نقدینگی و حد ضررهای جمع‌شده", "جریان سفارش‌ها", "مدیریت سرمایه و اندازهٔ پوزیشن",
    "نسبت ریسک به ریوارد", "روان‌شناسی ترس از جاماندن", "تشخیص روند", "سقف و کف بالاتر و پایین‌تر",
    "حمایت و مقاومت", "شکست جعلی", "موقعیت‌های باز در بازار آتی", "نرخ تأمین مالی", "لیکوییدیشن و اهرم",
    "سلطهٔ بیت‌کوین", "شاخص ترس و طمع", "داده‌های آنچین و ذخیرهٔ صرافی‌ها", "رفتار نهنگ‌ها",
    "صندوق‌های قابل معامله در بورس", "چرخهٔ چهارساله و هاوینگ", "حجم معاملات و تأیید حرکت",
    "شاخص قدرت نسبی", "میانگین متحرک", "واگرایی", "تایم‌فریم‌ها و هم‌راستایی آنها", "ژورنال معاملاتی",
    "اشتباهات رایج تریدرها", "نشانه‌های اسکم و پروژه‌های مشکوک", "آزادسازی توکن‌ها", "استیبل‌کوین‌ها و نقدینگی",
    "تقویم اقتصاد کلان و نشست فدرال رزرو", "انتقال سرمایه بین آلت‌کوین‌ها", "حد ضرر متحرک",
]


# ------------------------------------------------------------------ data
TREND = {"up": "صعودی", "down": "نزولی", "flat": "خنثی", "side": "خنثی"}
FNG = {"Extreme Fear": "ترس شدید", "Fear": "ترس", "Neutral": "خنثی", "Greed": "طمع", "Extreme Greed": "طمع شدید"}
def fmt(x, d=0):
    try:
        return f"{x:,.{d}f}"
    except Exception:
        return "?"


def snapshot():
    m = D.load("market") or {}
    dv = D.load("derivatives") or {}
    fl = D.load("flows") or {}
    coins = {c.get("coin"): c for c in m.get("coins", [])}
    g = m.get("global") or {}
    dom = (fl.get("dominance") or [{}])[-1]
    return {"btc": coins.get("BTC") or {}, "eth": coins.get("ETH") or {}, "g": g, "fng": m.get("fng") or {},
            "dv": dv, "dom": dom, "top": sorted([c for c in m.get("coins", []) if c.get("chg24") is not None],
                                               key=lambda c: -abs(c["chg24"]))[:5]}


def coin_lines(sym, sn):
    c = sn["btc" if sym == "BTC" else "eth"]
    dv = sn["dv"].get(sym) or {}
    out = [f"قیمت {sym}: {fmt(c.get('price'), 2)} دلار، تغییر ۲۴ ساعت {fmt(c.get('chg24'), 2)} درصد",
           f"حجم ۲۴ ساعت اسپات (صرافی مرجع): {fmt(c.get('vol24'))} دلار",
           f"شاخص قدرت نسبی: {fmt(c.get('rsi'), 1)}، روند: {TREND.get(c.get('trend'), 'نامشخص')}، سقف ۴۸ ساعت {fmt(c.get('hi48'))}، کف ۴۸ ساعت {fmt(c.get('lo48'))}"]
    oi = dv.get("oi_hist") or []
    if len(oi) >= 25:
        ch = (oi[-1][1] / oi[-25][1] - 1) * 100
        out.append(f"موقعیت‌های باز آتی (صرافی مرجع): {fmt(oi[-1][1] / 1e9, 2)} میلیارد دلار، تغییر ۲۴ ساعت {ch:+.2f} درصد")
    if dv.get("funding") is not None:
        out.append(f"نرخ تأمین مالی: {dv['funding']:.4f} درصد در هر دوره (سالانه حدود {fmt(dv.get('funding_ann'), 1)} درصد)")
    ls = dv.get("long_short") or []
    if ls:
        out.append(f"نسبت حساب‌های خرید به فروش: {ls[-1][1]} (۲۴ ساعت پیش {ls[-25][1] if len(ls) >= 25 else ls[0][1]})")
    tk = dv.get("taker") or []
    if len(tk) >= 24:
        b, s_ = sum(x[1] for x in tk[-24:]), sum(x[2] for x in tk[-24:])
        out.append(f"معاملات تهاجمی ۲۴ ساعت: خرید {fmt(b / 1e6)} میلیون دلار، فروش {fmt(s_ / 1e6)} میلیون دلار")
    lq = dv.get("liq") or {}
    if lq:
        out.append(f"لیکوییدیشن اخیر (حدود یک ساعت نمونه): خریداران {fmt(lq.get('long_usd'))} دلار، فروشندگان {fmt(lq.get('short_usd'))} دلار")
    return out


def market_lines(sn):
    g, d, f = sn["g"], sn["dom"], sn["fng"]
    out = [f"ارزش کل بازار: {fmt((g.get('mcap') or 0) / 1e12, 2)} تریلیون دلار، تغییر ۲۴ ساعت {fmt(g.get('mcap_chg24'), 2)} درصد",
           f"سلطهٔ بیت‌کوین {d.get('btc', g.get('btc_d'))} درصد، اتریوم {d.get('eth', g.get('eth_d'))} درصد، استیبل‌کوین‌ها {d.get('stable', g.get('stable_d'))} درصد",
           f"شاخص ترس و طمع: {f.get('value')} ({FNG.get(f.get('class'), '')})"]
    if sn["dv"].get("total_oi_usd"):
        out.append(f"کل موقعیت‌های باز آتی بازار: {fmt(sn['dv']['total_oi_usd'] / 1e9, 2)} میلیارد دلار، میانگین نرخ تأمین مالی {sn['dv'].get('avg_funding')} درصد")
    return out


def feed_titles(s, kind, n=10, hours=24):
    items = F.feed_state(s)["items"].get(kind, [])
    cut = time.time() - hours * 3600
    out = []
    for it in items:
        try:
            ts = datetime.fromisoformat(it.get("at") or it.get("made")).timestamp()
        except Exception:
            ts = time.time()
        if ts >= cut and it.get("fa"):
            out.append(it["fa"][:500])
    return out[:n]


def events_lines():
    ev = (D.load("events") or {}).get("events") or []
    now = datetime.now(timezone.utc)
    out = []
    for e in ev:
        try:
            t = datetime.fromisoformat(e["date"])
        except Exception:
            continue
        if 0 <= (t - now).total_seconds() <= 36 * 3600 and e.get("impact") in ("High", "Medium"):
            out.append(f"{e.get('title_fa') or e.get('title')} — {t.strftime('%H:%M')} به وقت جهانی، پیش‌بینی {e.get('forecast')}، قبلی {e.get('previous')}")
    return out[:5]


# ------------------------------------------------------------------ writing
def write(kind, data, limit, **fmt_kw):
    if not ai.available():
        return None
    form = FORMATS["radar" if kind.startswith("radar") else kind].format(**fmt_kw)
    prompt = RULES.format(limit=limit) + "\n" + form + "\n\nداده‌ها:\n" + data
    last = None
    for _ in range(3):
        try:
            out = F.tidy(ai.generate(prompt, temperature=0.4, max_tokens=1400))
        except Exception as ex:
            log.warning("ai failed: %s", ex)
            return None
        pr = F.problems(out, limit)
        if not pr:
            return out
        last = out
        prompt = (RULES.format(limit=limit) + "\n" + form + "\n\nداده‌ها:\n" + data
                  + "\n\nپاسخ قبلی این مشکل‌ها را داشت؛ دوباره و درست بنویس:\n- " + "\n- ".join(pr) + "\n\nپاسخ قبلی:\n" + out)
    log.info("studio %s dropped: %s", kind, F.problems(last or "", limit)[:2])
    return None


def card(text, series=None, label=""):
    """PNG bytes: Coin_Kurd card with the post's title and its first lines"""
    lines = [R.EMOJI.sub("", x).strip() for x in text.split("\n")]
    lines = [x for x in lines if x and not x.startswith("#")]
    if not lines:
        return None
    im = R.frame(lines[0], lines[1:4] if not series else lines[1:3], 1, 1, series, label)
    im = im.crop((0, 0, R.W, R.H))
    buf = io.BytesIO()
    im.convert("RGB").save(buf, "JPEG", quality=88)
    return buf.getvalue()


# ------------------------------------------------------------------ jobs
def job(kind, s, st, send_fn, channel, poll_fn):
    sn = snapshot()
    limit = 1024 - SIG_LEN - 2
    series, label = None, ""
    if kind == "poll":
        p = sn["btc"].get("price")
        if not p:
            return False
        up, dn = round(p * 1.02, -2), round(p * 0.98, -2)
        r = poll_fn(channel, "🗳 نظرسنجی کوین کورد | بیت‌کوین ۲۴ ساعت دیگر کجاست؟ (قیمت الان "
                    f"{fmt(p)} دلار)", [f"🚀 بالای {fmt(up)} دلار", f"↔️ بین {fmt(dn)} و {fmt(up)} دلار",
                                        f"📉 زیر {fmt(dn)} دلار"])
        st["poll_ref"] = {"price": p, "at": time.time()}
        return r.get("ok")
    if kind == "morning":
        st["morning_snap"] = market_lines(sn) + coin_lines("BTC", sn)[:1]
        data = "\n".join(market_lines(sn) + coin_lines("BTC", sn)[:3] + ["", "خبرهای ۲۴ ساعت گذشته:"]
                         + feed_titles(s, "news", 12) + ["", "آنچین:"] + feed_titles(s, "onchain", 5))
        text = write(kind, data, limit)
    elif kind == "lesson":
        topic = LESSONS[st.get("lesson_i", 0) % len(LESSONS)]
        text = write(kind, "—", limit, topic=topic)
        if text:
            st["lesson_i"] = st.get("lesson_i", 0) + 1
    elif kind.startswith("radar"):
        sym = "BTC" if kind == "radar_btc" else "ETH"
        name = "بیت‌کوین" if sym == "BTC" else "اتریوم"
        head = ("🟠" if sym == "BTC" else "🟣") + f" رادار کوین کورد | {name}"
        poll = st.get("poll_ref") or {}
        extra = []
        if sym == "BTC" and poll and time.time() - poll.get("at", 0) < 30 * 3600:
            extra = [f"قیمت مرجع نظرسنجی دیروز کانال: {fmt(poll['price'])} دلار"]
        data = "\n".join(coin_lines(sym, sn) + market_lines(sn)[:3] + extra
                         + ["", "رفتار نهنگ‌ها و داده‌های آنچین امروز:"] + feed_titles(s, "onchain", 4))
        text = write(kind, data, limit, head=head)
        series, label = sn["btc" if sym == "BTC" else "eth"].get("spark"), f"{name} ۴۸ ساعت"
    elif kind == "number":
        data = "\n".join(market_lines(sn) + coin_lines("BTC", sn) + coin_lines("ETH", sn) + feed_titles(s, "onchain", 4))
        text = write(kind, data, limit)
    elif kind == "night":
        data = "\n".join(["عکس فوری صبح:"] + (st.get("morning_snap") or ["(ندارد)"]) + ["", "الان:"]
                         + market_lines(sn) + coin_lines("BTC", sn)[:1] + ["", "خبرهای امروز:"]
                         + feed_titles(s, "news", 10, 16) + ["", "تقویم ۳۶ ساعت آینده:"] + (events_lines() or ["(رویداد مهمی نیست)"]))
        text = write(kind, data, limit)
    else:
        return False
    if not text:
        return False
    cap = html.escape(text, quote=False) + "\n\n" + SIG
    r = send_fn(channel, cap, photo=card(text, series, label))
    if r.get("ok"):
        st.setdefault("log", []).insert(0, {"kind": kind, "at": datetime.now(timezone.utc).isoformat(), "fa": text})
        del st["log"][60:]
    return r.get("ok")


def tick(s, send_fn, channel, poll_fn):
    st = s.setdefault("studio", {})
    st.setdefault("done", {})
    now = datetime.now(timezone.utc)
    if time.time() - st.get("last", 0) < GAP:
        return False
    day = now.strftime("%Y-%m-%d")
    if not st.get("started"):                         # first start: open with the flagship radar
        st["started"] = day
        st["last"] = time.time()
        ok = job("radar_btc", s, st, send_fn, channel, poll_fn)
        st["done"][f"{day}:radar_btc"] = "ok" if ok else "fail"
        log.info("studio first radar -> %s", ok)
        return True
    for h, m, kind in SLOTS:
        slot = now.replace(hour=h, minute=m, second=0, microsecond=0)
        key = f"{day}:{kind}"
        age = (now - slot).total_seconds()
        if st["done"].get(key) or age < 0 or age > WINDOW:
            continue
        st["last"] = time.time()
        ok = job(kind, s, st, send_fn, channel, poll_fn)
        st["done"][key] = "ok" if ok else "fail"
        for k in list(st["done"]):
            if k[:10] < day:
                del st["done"][k]
        log.info("studio %s -> %s", kind, ok)
        return True
    return False


def start(s, send_fn, channel, poll_fn):
    def loop():
        time.sleep(90)
        while True:
            try:
                if tick(s, send_fn, channel, poll_fn):
                    F.DIRTY.set()
            except Exception:
                log.exception("studio error")
            time.sleep(60)

    th = threading.Thread(target=loop, name="studio", daemon=True)
    th.start()
    return th
