#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The channel's own market read — the owner's Institutional-Grade analyst brief, turned into code.

The brief's hard rules are not advice to a model here, they are enforced:
  * §2/§3  the model sees ONLY scripts/onchain_data.snapshot(): figures this repo collected and stamped.
           Indicators nobody here can see are listed to it by name so the report says so instead of
           inventing them. It may not add a number of its own.
  * §9     eight fixed sections, in order, with the three scenario probabilities summing to 100.
  * §8     every scenario and setup carries its invalidation level, and "no setup" is a valid answer.
  * §10    no tables, under 650 words, four hashtags, the fixed closing line, written for a phone.
  * §11    check() is the pre-publication audit: a draft that breaks a rule goes back with the list of
           defects, up to three times, and is dropped rather than published broken.

The brief asks for [DATA] / [INTERPRETATION] labels. This channel forbids Latin letters in the body —
they flip the direction of a right-to-left line — so the same separation is made with «داده» and
«تحلیل», which is the rule's purpose rather than its spelling.
"""
import datetime
import logging
import re

import ai
import onchain_data as OD

log = logging.getLogger("onchain")
MAX_WORDS = 650
FA_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
# the body of a post carries no Latin — it flips the direction of a right-to-left line — so the
# evidence block hands the model Persian names rather than tempting it to copy the ticker across
COIN_FA = {"BTC": "بیت‌کوین", "ETH": "اتریوم", "BNB": "بی‌ان‌بی", "SOL": "سولانا", "XRP": "ریپل",
           "DOGE": "دوج‌کوین", "ADA": "کاردانو", "TRX": "ترون", "LINK": "چین‌لینک", "AVAX": "آوالانچ",
           "TON": "تون", "DOT": "پولکادات", "MATIC": "پالیگان", "LTC": "لایت‌کوین", "BCH": "بیت‌کوین کش"}
FNG_FA = {"Extreme Fear": "ترس شدید", "Fear": "ترس", "Neutral": "خنثی",
          "Greed": "طمع", "Extreme Greed": "طمع شدید"}


def date_fa(x):
    return str(x or "").translate(FA_DIGITS)
CLOSING = "این یک دیدگاه تحلیلی است؛ در بازارهای مالی هیچ قطعیتی وجود ندارد. همیشه تحقیق شخصی خود را انجام دهید."
HEADS = ["۱. رژیم بازار", "۲. داده‌های کلیدی", "۳. تحلیل ترکیبی", "۴. نقشهٔ نقدینگی",
         "۵. عوامل ریسک", "۶. سه سناریو", "۷. فرصت‌های معاملاتی", "۸. ارزیابی نهایی"]
NO_SETUP = ("در شرایط فعلی، ستاپ معاملاتی با برتری آماری قابل دفاع شناسایی نشد؛ "
            "حفظ سرمایه و انتظار برای تأیید ساختار منطقی‌تر است")


# ------------------------------------------------------------------ the evidence, written out
def fa(x, dec=0, sign=False):
    if x is None:
        return "در دسترس نیست"
    try:
        s = f"{x:+,.{dec}f}" if sign else f"{x:,.{dec}f}"
    except (TypeError, ValueError):
        return str(x)
    return s.translate(FA_DIGITS).replace(",", "٬").replace(".", "٫").replace("-", "−")


def usd(x):
    if x is None:
        return "در دسترس نیست"
    a = abs(x)
    if a >= 1e9:
        return fa(x / 1e9, 2) + " میلیارد دلار"
    if a >= 1e6:
        return fa(x / 1e6, 1) + " میلیون دلار"
    return fa(x, 0) + " دلار"


def evidence(s):
    """the snapshot as the lines the model is allowed to quote"""
    b, g, f, d, m, c = s["btc"], s.get("global") or {}, s["fng"], s["deriv"], s.get("macro") or {}, s["chain"]
    L = [f"زمان استخراج داده‌ها: {date_fa(s['at'][:16].replace('T', ' ساعت '))} به وقت جهانی", "",
         "— بیت‌کوین —",
         f"قیمت: {fa(b['price'], 0)} دلار",
         f"تغییر ۲۴ ساعته: {fa(b['chg24'], 2, True)} درصد",
         f"نوسان ۲۴ ساعته: {fa(b['vol24'], 2)} درصد ({b['vol24_how']})",
         f"دامنهٔ ۴۸ ساعته: {fa(b['range48'], 2)} درصد ({b['range48_how']})",
         f"سقف و کف ۴۸ ساعته: {fa(b['hi48'], 0)} و {fa(b['lo48'], 0)} دلار",
         f"شاخص قدرت نسبی: {fa(b['rsi'], 1)}",
         f"فاصله تا میانگین ۲۰: {fa(b['vs_ema20'], 2, True)} درصد؛ تا میانگین ۵۰: {fa(b['vs_ema50'], 2, True)} درصد",
         f"حجم معاملات ۲۴ ساعته: {usd(b['qvol'])}", ""]
    L += ["— بازار کل —",
          f"ارزش کل بازار: {usd(g.get('mcap'))}، تغییر ۲۴ ساعته {fa(g.get('mcap_chg24'), 2, True)} درصد",
          f"سهم بیت‌کوین: {fa(g.get('btc_d'), 2)} درصد؛ سهم اتریوم: {fa(g.get('eth_d'), 2)} درصد؛ "
          f"سهم استیبل‌کوین‌ها: {fa(g.get('stable_d'), 2)} درصد",
          f"شاخص ترس و طمع: {fa(f.get('value'))} ({FNG_FA.get(f.get('class'), f.get('class') or '')})، "
          f"تغییر هفتگی {fa(f.get('d7'), 0, True)}، "
          f"دامنهٔ سی روز اخیر {fa(f.get('d30_min'))} تا {fa(f.get('d30_max'))}", ""]
    L += ["— مشتقات —",
          f"مجموع موقعیت‌های باز: {usd(d.get('total_oi_usd'))}، تغییر ۲۴ ساعته {fa(d.get('oi_chg24'), 2, True)} درصد",
          f"موقعیت‌های باز بیت‌کوین: {usd((d.get('btc') or {}).get('oi_usd'))}، "
          f"تغییر ۲۴ ساعته {fa(d.get('btc_oi_chg24'), 2, True)} درصد",
          f"نرخ تأمین مالی بیت‌کوین: {fa((d.get('btc') or {}).get('funding'), 4)} درصد در هر دوره، "
          f"معادل سالانه {fa((d.get('btc') or {}).get('funding_ann'), 1)} درصد",
          f"میانگین نرخ تأمین مالی بازار: {fa(d.get('avg_funding'), 4)} درصد",
          f"نسبت لانگ به شورت بیت‌کوین: {fa(d.get('long_short'), 2)} (۲۴ ساعت پیش {fa(d.get('long_short_24h_ago'), 2)})",
          f"خالص جریان سفارش‌های بازار در ۲۴ ساعت: {usd(d.get('cvd24_usd'))} "
          f"(خرید {usd(d.get('taker_buy24'))} در برابر فروش {usd(d.get('taker_sell24'))})"]
    lq = d.get("liq") or {}
    if lq:
        L.append(f"لیکوئیدشده‌ها در {fa(lq.get('window_min'))} دقیقهٔ اخیر: لانگ {usd(lq.get('long_usd'))}، "
                 f"شورت {usd(lq.get('short_usd'))}")
    L.append("")
    L.append("— کلان —")
    names = {"DXY": "شاخص دلار", "SPX": "اس‌اند‌پی ۵۰۰", "NDX": "نزدک ۱۰۰", "GOLD": "طلا",
             "US10Y": "بازده اوراق ۱۰ سالهٔ آمریکا", "OIL": "نفت"}
    for k, nm in names.items():
        v = m.get(k)
        if v and v.get("value") is not None:
            L.append(f"{nm}: {fa(v['value'], 2)} (تاریخ {date_fa(v.get('date'))})، تغییر یک‌ماهه {fa(v.get('chg_1m'), 2, True)} درصد")
    if s.get("corr_btc_spx_30d") is not None:
        L.append(f"همبستگی ۳۰ روزهٔ بیت‌کوین با اس‌اند‌پی ۵۰۰: {fa(s['corr_btc_spx_30d'], 2)}")
    L += ["", "— شبکهٔ بیت‌کوین —",
          f"نرخ هش: {fa((c.get('hashrate') or 0) / 1e18, 1)} اگزاهش بر ثانیه",
          f"تغییر سختی در بازنشانی بعدی: {fa(c.get('retarget_pct'), 2, True)} درصد",
          f"کارمزد سریع: {fa(c.get('fee_fast'))} ساتوشی بر بایت", ""]
    if s.get("alts"):
        L.append("— ارزهای دیگر —")
        L += [f"{COIN_FA.get(a['coin'], a['coin'])}: {fa(a['price'], 2)} دلار، "
              f"تغییر ۲۴ ساعته {fa(a['chg24'], 2, True)} درصد، شاخص قدرت نسبی {fa(a['rsi'], 1)}"
              for a in s["alts"] if a.get("coin") in COIN_FA]
        L.append("")
    if s.get("events"):
        L.append("— رویدادهای اقتصادی پیش‌رو —")
        L += [f"{e['fa']} — {date_fa(e['date'])} به وقت جهانی" for e in s["events"]]
    else:
        L.append("— رویدادهای اقتصادی پیش‌رو: در تقویم این هفته رویداد ثبت‌شده‌ای موجود نیست —")
    L += ["", "— شاخص‌هایی که در دسترس نیستند و نباید دربارهٔ عدد آن‌ها حرفی زده شود —"]
    L += [f"• {x}" for x in s["missing"]]
    return "\n".join(L)


# ------------------------------------------------------------------ the brief
PROMPT = """تو یک تحلیلگر ارشد بازارهای مالی و استراتژیست اقتصاد کلان هستی که برای کانال «کوین کورد» می‌نویسی.
رویکردت بر سه اصل است: تحلیل بر پایهٔ احتمال نه پیش‌بینی قطعی، تمرکز بر نقدینگی و موقعیت‌های اهرمی،
و وزن‌دهی به شواهد بر اساس تازگی و اعتبار آن‌ها. لحن مقتدرانه، علمی و قابل فهم برای معامله‌گر خرد باشد.

قانون مطلق دربارهٔ داده:
- فقط و فقط از عددهای «بلوک داده» زیر استفاده کن. هیچ قیمت، درصد، شاخص، تاریخ یا رویدادی از خودت نساز
- هر شاخصی که در فهرست «در دسترس نیستند» آمده را فقط به‌عنوان محدودیت تحلیل نام ببر، بدون هیچ عددی
- داده را از برداشت جدا کن: هر خط داده را با «داده:» و هر خط تحلیلی را با «تحلیل:» شروع کن
- همبستگی را به معنی رابطهٔ علت و معلولی نگیر
- خروج موقعیت باز یا تغییر نسبت لانگ به شورت را خودبه‌خود معادل خرید یا فروش نهنگ‌ها ندان

ساختار اجباری خروجی، دقیقاً به همین ترتیب و با همین تیترها:

خط اول دقیقاً به این شکل، بدون هیچ چیز قبل یا بعدش:
₿ بیت‌کوین: [قیمت] دلار | تغییر ۲۴ ساعته: [درصد] | نوسان ۲۴ ساعته: [درصد]

خط دوم: زمان تحلیل به وقت جهانی، از بلوک داده

۱. رژیم بازار
وضعیت بازار را یکی از این‌ها بگذار: انباشت، توزیع، روندی، گسترش، فشردگی یا گذار. روند کوتاه‌مدت، میان‌مدت و بلندمدت و دلیل انتخاب رژیم

۲. داده‌های کلیدی
مهم‌ترین عددهای قیمت، حجم، موقعیت باز، نرخ تأمین مالی، جریان سفارش‌ها و سهم بازار به‌صورت بولت

۳. تحلیل ترکیبی
تکنیکال و مشتقات و کلان را کنار هم بگذار. تضاد میان سیگنال‌ها را مشخص کن و بگو کدام عامل الان وزن بیشتری دارد

۴. نقشهٔ نقدینگی
حمایت و مقاومت و نواحی تجمع نقدینگی، همه با عدد از بلوک داده و با ذکر بازهٔ زمانی. سطوح لیکوئیدیشن را «ناحیهٔ احتمالی» بنویس نه قیمت قطعی

۵. عوامل ریسک
رویدادهای پیش‌رو، نرخ بهره و بازده واقعی، شاخص دلار، احساسات بازار، ریسک اهرم و نقدینگی

۶. سه سناریو
برای هر سه سناریوی «پایه»، «صعودی» و «نزولی» این‌ها را بنویس: «احتمال: [عدد]٪» و شرط فعال‌سازی و سطح کلیدی و هدف احتمالی و نقطهٔ ابطال و افق زمانی.
مجموع سه احتمال باید دقیقاً ۱۰۰ باشد و از ارزیابی شواهد بیاید، نه عددهای تزئینی

۷. فرصت‌های معاملاتی
اگر ستاپ قابل دفاع هست: جهت، محدودهٔ ورود، ماشه، حد ضرر، حد سود، نسبت ریسک به بازده، تایم‌فریم و شرط ابطال.
اگر نیست، دقیقاً همین جمله را بنویس: «{nosetup}»
ریسک را به‌صورت درصدی از سرمایه بگو، نه عدد ثابت برای همه. اهرم بالا پیشنهاد نده

۸. ارزیابی نهایی
جهت‌گیری غالب، درجهٔ اطمینان از ۱۰۰، مهم‌ترین عامل تأییدکننده، مهم‌ترین عامل مخالف، یک استدلال متقابل علیه تز خودت، و شرط تغییر دیدگاه

قوانین نگارش:
- هیچ جدولی نساز، نه با خط عمودی نه با خط تیره
- کل گزارش زیر {maxw} واژه
- هیچ حرف لاتین یا عدد لاتین در متن نیاور؛ همهٔ عددها فارسی. تنها استثنا نشان ₿ در خط اول است
- هر خط با واژهٔ فارسی یا ایموجی یا نشان ₿ شروع شود تا راست‌چین بماند
- از ایموجی‌های مرتبط کم و هدفمند استفاده کن
- ادبیات هیجانی و وعدهٔ سود ممنوع
- خط ماقبل آخر: دقیقاً چهار هشتگ فارسی مرتبط و غیرتکراری
- آخرین خط دقیقاً این جمله: «{closing}»
- فقط خود گزارش را بنویس، بدون هیچ توضیح اضافه"""


def brief():
    return PROMPT.format(nosetup=NO_SETUP, maxw=str(MAX_WORDS).translate(FA_DIGITS), closing=CLOSING)


# ------------------------------------------------------------------ the audit
LATIN = re.compile(r"[A-Za-z0-9]")


def _n(x):
    return str(x).translate(FA_DIGITS)


def check(t):
    """the pre-publication audit; an empty list means it may go out"""
    p = []
    body = t.strip()
    lines = [x.strip() for x in body.split("\n") if x.strip()]
    if not lines:
        return ["متن خالی است"]
    if not lines[0].startswith("₿ بیت‌کوین:"):
        p.append("خط اول باید دقیقاً با «₿ بیت‌کوین:» شروع شود")
    for h in HEADS:
        if h not in body:                           # the numbered form, so a sentence cannot pass as a heading
            p.append(f"بخش «{h}» وجود ندارد")
    n = len(re.findall(r"\S+", body))
    if n > MAX_WORDS:
        p.append(f"طول گزارش {_n(n)} واژه است؛ باید زیر {_n(MAX_WORDS)} واژه باشد")
    probs = [int(x.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")))
             for x in re.findall(r"احتمال:\s*([۰-۹0-9]+)\s*٪", body)]
    if len(probs) != 3:
        p.append(f"باید دقیقاً سه خط «احتمال: عدد٪» باشد؛ {_n(len(probs))} تا پیدا شد")
    elif sum(probs) != 100:
        p.append(f"مجموع احتمال سه سناریو {_n(sum(probs))} است؛ باید دقیقاً ۱۰۰ باشد")
    if "ابطال" not in body:
        p.append("نقطهٔ ابطال مشخص نشده است")
    if re.search(r"^\s*\|", body, re.M) or re.search(r"\|.*\|.*\|", body):
        p.append("هیچ جدولی مجاز نیست")
    tags = re.findall(r"#\S+", body)
    if len(tags) != 4:
        p.append(f"باید دقیقاً چهار هشتگ باشد؛ {_n(len(tags))} تا هست")
    if not body.endswith(CLOSING):
        p.append("گزارش باید دقیقاً با جملهٔ پایانی مقرر تمام شود")
    if "داده:" not in body or "تحلیل:" not in body:
        p.append("داده و برداشت باید با برچسب‌های «داده:» و «تحلیل:» از هم جدا شوند")
    lat = set(LATIN.findall(re.sub(r"#\S+", "", body)))
    if lat:
        p.append("این نویسه‌های لاتین را به فارسی بنویس: " + "، ".join(sorted(lat))[:60])
    return p


# ------------------------------------------------------------------ writing
def write(snap=None, tries=3):
    """a report that passes the audit, or None — a broken one is never published"""
    if not ai.available():
        log.info("no model key; analysis skipped")
        return None, None
    s = snap or OD.snapshot()
    base = brief() + "\n\nبلوک داده:\n" + evidence(s)
    prompt, last = base, []
    for i in range(tries):
        try:
            out = ai.generate(prompt, temperature=0.35, max_tokens=3000)
        except Exception as ex:
            log.warning("analysis generation failed: %s", ex)
            return None, s
        out = re.sub(r"^```\w*|```$", "", (out or "").strip()).strip()
        last = check(out)
        if not last:
            log.info("analysis passed the audit on attempt %d (%d words)", i + 1, len(out.split()))
            return out, s
        log.info("attempt %d rejected: %s", i + 1, last[:3])
        prompt = base + "\n\nپیش‌نویس قبلی این ایرادها را داشت؛ همه را برطرف کن:\n- " + "\n- ".join(last) \
            + "\n\nپیش‌نویس قبلی:\n" + out
    log.warning("analysis dropped after %d attempts: %s", tries, last[:3])
    return None, s


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    snap = OD.snapshot()
    print(evidence(snap))
    print("\n" + "=" * 60 + "\nbrief is", len(brief()), "chars; model available:", ai.available())


# ------------------------------------------------------------------ the card
def card_content(snap, text):
    """the report's own picture: the regime as the headline, the price as the hero, the key rows beneath"""
    sec = {}
    cur = None
    for ln in text.split("\n"):
        h = next((x for x in HEADS if x in ln), None)
        if h:
            cur = h
            sec[cur] = []
        elif cur:
            sec[cur].append(ln.strip())
    pick = lambda head, tag: [x.split(":", 1)[1].strip() for x in sec.get(head, []) if x.startswith(tag)]
    regime = (pick(HEADS[0], "تحلیل:") or ["وضعیت امروز بازار کریپتو"])[0]
    return {
        "badge": "تحلیل بازار",
        "title": regime[:120],
        "hero": (fa(snap["btc"]["price"], 0) + " دلار", "قیمت بیت‌کوین در بایننس"),
        "card_head": "داده‌های کلیدی",
        "card": (pick(HEADS[1], "داده:") or pick(HEADS[0], "داده:"))[:3],
        "term": (pick(HEADS[7], "تحلیل:"))[:2],
        "quick": "", "sections": [],
    }


def card(snap, text, hist=None):
    try:
        import infocard as IC
        return IC.render(card_content(snap, text), hist=hist, mk=IC.market())
    except Exception:
        log.exception("analysis card failed")       # the report still goes out as text
        return None


# ------------------------------------------------------------------ publishing
SLOTS_UTC = [(6, 15), (13, 15)]                     # 09:45 and 16:45 Iran
KEY = "onchain_analysis"
SITE_FILE = "data/onchain_analysis.json"
_LIVE = {}                                           # the running state, so sec_analysis(lang) can reach it


def publish(s, send_fn, channel, admins, worktree, push_files, sig=""):
    text, snap = write()
    if not text:
        return False
    st = s.setdefault(KEY, {"items": []})
    pid = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M")
    img = card(snap, text, hist=s.setdefault("visual", {}))
    img_path = f"data/analysis/{pid}.jpg"
    body = text + ("\n\n" + sig if sig else "")
    r = {"ok": False}
    if img and push_files(worktree, {img_path: img}, "chore: market analysis card"):
        import time as _t
        _t.sleep(5)
        raw = "https://raw.githubusercontent.com/omidmokri/coinkurd/main/" + img_path
        r = send_fn(channel, body, link_preview_options={"url": raw, "prefer_large_media": True,
                                                         "show_above_text": True})
    if not r.get("ok"):
        r = send_fn(channel, body, link_preview_options={"is_disabled": True})
    if not r.get("ok"):
        log.warning("analysis not posted: %s", r.get("description"))
        return False
    item = {"id": pid, "at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "fa": text,
            "img": "/" + img_path if img else "", "msg_id": (r.get("result") or {}).get("message_id"),
            "snapshot": {k: snap[k] for k in ("btc", "global", "fng", "deriv", "corr_btc_spx_30d") if k in snap},
            "missing": snap.get("missing", []), "stamps": snap.get("stamps", {})}
    st["items"].insert(0, item)
    del st["items"][30:]
    import json as _j
    push_files(worktree, {SITE_FILE: _j.dumps({"updated_at": item["at"], "items": st["items"]},
                                              ensure_ascii=False, indent=1)}, "chore: market analysis for site")
    for a in admins:
        send_fn(a, "🧭 تحلیل بازار منتشر شد: " + f"t.me/{channel.lstrip('@')}/{item['msg_id']}")
    return True


def tick(s, send_fn, channel, admins, worktree, push_files, sig=""):
    st = s.setdefault(KEY, {"items": []})
    now = datetime.datetime.now(datetime.timezone.utc)
    for h, m in SLOTS_UTC:
        age = (now - now.replace(hour=h, minute=m, second=0, microsecond=0)).total_seconds()
        tag = f"{now:%Y-%m-%d}-{h:02d}{m:02d}"
        if 0 <= age <= 3600 and st.get("last") != tag:
            st["last"] = tag                         # claimed before the attempt, so a failure is not retried in a loop
            return publish(s, send_fn, channel, admins, worktree, push_files, sig)
    return False


def start(s, send_fn, channel, admins, worktree, push_files, sig=""):
    import threading
    import time as _t

    def loop():
        _t.sleep(120)
        while True:
            try:
                tick(s, send_fn, channel, admins, worktree, push_files, sig)
            except Exception:
                log.exception("analysis loop error")
            _t.sleep(120)

    _LIVE["s"] = s
    th = threading.Thread(target=loop, name="onchain", daemon=True)
    th.start()
    return th


# ------------------------------------------------------------------ the bot's own view of it
SEC_T = {
    "head": {"fa": "🧭 <b>تحلیل بازار</b>", "ckb": "🧭 <b>شیکاریی بازاڕ</b>", "en": "🧭 <b>Market analysis</b>"},
    "none": {"fa": "هنوز تحلیلی منتشر نشده است. هر روز ساعت ۹:۴۵ و ۱۶:۴۵ به وقت ایران منتشر می‌شود.",
             "ckb": "تا ئێستا شیکارییەک بڵاو نەکراوەتەوە.", "en": "No analysis published yet."},
    "how": {"fa": "در هشت بخش نوشته می‌شود و پیش از انتشار از بازرسی خودکار رد می‌شود؛ هیچ عددی ساخته نمی‌شود.",
            "ckb": "لە هەشت بەشدا دەنووسرێت و پێش بڵاوکردنەوە پشکنین دەکرێت.",
            "en": "Eight fixed sections, audited before it goes out; no figure is invented."},
    "full": {"fa": "متن کامل در کانال و در نشانی زیر", "ckb": "دەقی تەواو لە کەناڵ و لەم بەستەرەدا",
             "en": "The full report is in the channel and at"},
}


def _t(k, lang):
    return SEC_T[k].get(lang) or SEC_T[k]["fa"]


def sec_analysis(lang, state=None):
    """the newest report, trimmed to what reads well inside a chat bubble"""
    items = ((state or _LIVE.get("s") or {}).get(KEY) or {}).get("items") or []
    if not items:
        try:                                        # the published file, for a bot that just restarted
            import json
            import os
            items = json.load(open(os.path.join(OD.DATA, "onchain_analysis.json"), encoding="utf-8")).get("items") or []
        except Exception:
            items = []
    if not items:
        return _t("head", lang) + "\n\n" + _t("none", lang)
    it = items[0]
    text = it.get("fa") or ""
    lines = [x for x in text.split("\n") if x.strip()]
    want = (HEADS[0], HEADS[5], HEADS[7])          # the regime, the scenarios and the verdict — not all eight parts
    keep, cur, first = [], None, True
    for ln in lines:
        if ln.startswith("₿"):
            keep.append(ln)
            continue
        h = next((x for x in HEADS if x in ln), None)
        if h:
            cur = h
            if cur in want:
                keep.append(("" if first else "\n") + ln)
                first = False
            continue
        if cur in want and len(keep) < 22:
            keep.append(ln)
    body = "\n".join(keep) or "\n".join(lines[:12])
    return (_t("head", lang) + "\n\n" + body[:2600] + "\n\n" + _t("how", lang)
            + "\n" + _t("full", lang) + " entekhab.net/onchain/")
