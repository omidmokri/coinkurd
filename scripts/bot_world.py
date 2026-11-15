"""
/world/ («جهان زنده») in the bot: section "world".

  * what the page offers, and a snapshot from the same facts and file it reads: the world's population now, births and
    deaths so far today (Tehran's day), fossil CO2 today, and from Bitcoin's chain the coins issued, mined today (UTC)
    and the blocks left to the next halving (scripts/world_data.py FACTS, data/world.json);
  * the way in: the page inside Telegram (Web App) with its post studio, and in the browser.

Read-only: nothing is stored or sent. A missing file only drops its own lines; numbers are never made up.
Self-test: python3 scripts/bot_world.py
"""
from datetime import datetime, timedelta, timezone

import world_data as WD
from bot_i18n import pick

SITE = "https://entekhab.net"
URL = SITE + "/world/"
TEHRAN = timezone(timedelta(hours=3, minutes=30))
DIG = {"fa": "۰۱۲۳۴۵۶۷۸۹", "ckb": "٠١٢٣٤٥٦٧٨٩", "ar": "٠١٢٣٤٥٦٧٨٩"}

TXT = {
    "title": {"fa": "🌍 <b>جهان زنده</b>", "ckb": "🌍 <b>جیهانی زیندوو</b>", "kmr": "🌍 <b>Cîhana zindî</b>", "ar": "🌍 <b>العالم مباشرةً</b>",
              "en": "🌍 <b>The world, live</b>"},
    "body": {
        "fa": ("شمارنده‌های زندهٔ جهان، هر عدد با منبعش: جمعیت، تولد و مرگ، اقتصاد، بدهی آمریکا، انرژی، نفت، CO₂، سلامت و اینترنت — "
               "و بیت‌کوین از روی زنجیرهٔ واقعی.\n✨ «ساخت پست»: از هر عدد تصویر مربع، استوری یا افقی با متن و هشتگ آماده به چهار زبان."),
        "ckb": ("ژمێرەرە زیندووەکانی جیهان، هەر ژمارەیەک لەگەڵ سەرچاوەکەی: دانیشتووان، لەدایکبوون و مردن، ئابووری، قەرزی ئەمریکا، وزە، نەوت، CO₂، "
                "تەندروستی و ئینتەرنێت — و بیتکۆین لەسەر زنجیرەی ڕاستەقینە.\n✨ «دروستکردنی پۆست»: لە هەر ژمارەیەک وێنە و دەقی ئامادە بە چوار زمان."),
        "kmr": ("Hejmarvanên zindî yên cîhanê, her hejmar bi çavkaniya xwe: nifûs, zayîn û mirin, aborî, enerjî, petrol, CO₂, tenduristî û Bitcoin.\n"
                "✨ «Post çêke»: ji her hejmarê wêne û nivîsek amade bi çar zimanan."),
        "ar": ("عدادات العالم المباشرة، كل رقم بمصدره: السكان والمواليد والوفيات والاقتصاد والدين الأمريكي والطاقة والنفط وCO₂ والصحة والإنترنت — "
               "والبيتكوين من سلسلته الحقيقية.\n✨ «صنع منشور»: من أي رقم صورة ونصًا جاهزًا بأربع لغات."),
        "en": ("Live counters of the world, every number with its source: population, births and deaths, the economy, US debt, energy, oil, CO₂, "
               "health and the Internet — and Bitcoin from its real chain.\n✨ «Make a post»: any number as a ready image and caption in four languages."),
    },
    "now": {"fa": "📊 <b>همین حالا</b>", "ckb": "📊 <b>هەر ئێستا</b>", "kmr": "📊 <b>Niha</b>", "ar": "📊 <b>الآن</b>", "en": "📊 <b>Right now</b>"},
    "pop": {"fa": "👥 جمعیت جهان: {v}", "ckb": "👥 دانیشتووانی جیهان: {v}", "kmr": "👥 Nifûsa cîhanê: {v}", "ar": "👥 سكان العالم: {v}", "en": "👥 World population: {v}"},
    "bd": {"fa": "👶 تولد امروز {b} · 🕯 مرگ امروز {d}", "ckb": "👶 لەدایکبوونی ئەمڕۆ {b} · 🕯 مردنی ئەمڕۆ {d}", "kmr": "👶 Zayîn îro {b} · 🕯 Mirin îro {d}",
           "ar": "👶 مواليد اليوم {b} · 🕯 وفيات اليوم {d}", "en": "👶 Births today {b} · 🕯 Deaths today {d}"},
    "co2": {"fa": "🏭 CO₂ فسیلی امروز: {v} تن", "ckb": "🏭 CO₂ی ئەمڕۆ: {v} تەن", "kmr": "🏭 CO₂ îro: {v} t", "ar": "🏭 CO₂ اليوم: {v} طن", "en": "🏭 Fossil CO₂ today: {v} t"},
    "btc": {"fa": "₿ ساخته‌شده تا حالا: {s} · امروز (UTC): {t}", "ckb": "₿ دروستکراو تا ئێستا: {s} · ئەمڕۆ (UTC): {t}", "kmr": "₿ Heta niha: {s} · Îro (UTC): {t}",
            "ar": "₿ المُصدَر حتى الآن: {s} · اليوم (UTC): {t}", "en": "₿ Issued so far: {s} · Today (UTC): {t}"},
    "halv": {"fa": "✂️ تا هاوینگ بعدی: {n} بلاک", "ckb": "✂️ تا هاڵڤینگی داهاتوو: {n} بلۆک", "kmr": "✂️ Heta halvingê: {n} blok",
             "ar": "✂️ حتى التنصيف القادم: {n} كتلة", "en": "✂️ To the next halving: {n} blocks"},
    "tz": {"fa": "«امروز» به وقت تهران؛ ارقام سالانهٔ سازمان ملل و پروژهٔ جهانی کربن، یکنواخت پخش‌شده.",
           "ckb": "«ئەمڕۆ» بە کاتی تاران؛ ژمارە ساڵانەکانی نەتەوە یەکگرتووەکان و پرۆژەی جیهانیی کاربۆن، بە یەکسانی دابەشکراو.",
           "kmr": "«Îro» li gorî dema Tehranê; hejmarên salane yên NY û Global Carbon Project, wekhev belavkirî.",
           "ar": "«اليوم» بتوقيت طهران؛ الأرقام السنوية للأمم المتحدة ومشروع الكربون العالمي موزعة بالتساوي.",
           "en": "“Today” in Tehran time; the UN's and the Global Carbon Project's yearly figures, spread evenly."},
    "b_app": {"fa": "🌍 جهان زنده و ساخت پست", "ckb": "🌍 جیهانی زیندوو و پۆست", "kmr": "🌍 Cîhana zindî û post", "ar": "🌍 العالم مباشرةً والمنشورات",
              "en": "🌍 The world, live & posts"},
    "b_web": {"fa": "🌐 باز کردن در مرورگر", "ckb": "🌐 کردنەوە لە وێبگەڕ", "kmr": "🌐 Di gerokê de veke", "ar": "🌐 افتح في المتصفح", "en": "🌐 Open in the browser"},
}


def L(key, lang, **kw):
    s = pick(TXT[key], lang)
    return s.format(**kw) if kw else s


def loc(s, lang):
    m = DIG.get(lang)
    s = str(s)
    return "".join(m[int(c)] if c.isdigit() else ("٬" if c == "," else "٫" if c == "." else c) for c in s) if m else s


def n(v, lang, dec=0):
    return loc(f"{v:,.{dec}f}", lang)


def lines(lang, load, now=None):
    now = now or datetime.now(timezone.utc)
    facts = {f["k"]: f for f in WD.FACTS}
    teh = now.astimezone(TEHRAN).replace(tzinfo=None)
    out = [L("pop", lang, v=n(WD.stock_value(facts["pop"], now), lang))]
    out.append(L("bd", lang, b=n(WD.flow_values(facts["births"]["per_year"], teh)[1], lang), d=n(WD.flow_values(facts["deaths"]["per_year"], teh)[1], lang)))
    out.append(L("co2", lang, v=n(WD.flow_values(facts["co2"]["per_year"], teh)[1] / 1e6, lang, 1) + (" M" if lang in ("en", "kmr") else
                                 {"fa": " میلیون", "ckb": " ملیۆن", "ar": " مليون"}[lang])))
    w = load("world") if load else None
    b = w.get("btc") if isinstance(w, dict) and isinstance(w.get("btc"), dict) else {}
    tip = b.get("tip")
    if isinstance(tip, int) and tip > 0:
        d0 = b.get("day0") if isinstance(b.get("day0"), dict) else {}
        today = "—"
        if d0.get("d") == now.date().isoformat() and isinstance(d0.get("h"), int) and tip >= d0["h"]:
            today = n(WD.issued_sat(d0["h"], tip) / WD.COIN, lang, 3) + " BTC"
        out.append(L("btc", lang, s=n(WD.supply_sat(tip) / WD.COIN, lang, 2), t=today))
        out.append(L("halv", lang, n=n(WD.next_halving(tip) - tip, lang)))
    return out


def section(lang, load=None):
    parts = [L("title", lang), L("body", lang)]
    try:
        parts.append("\n".join([L("now", lang)] + lines(lang, load)))
        parts.append("<i>" + L("tz", lang) + "</i>")
    except Exception:  # noqa: BLE001  (a broken file never breaks the section)
        pass
    return "\n\n".join(parts)


def open_rows(lang):
    return [[{"text": L("b_app", lang), "web_app": {"url": URL}}], [{"text": L("b_web", lang), "url": URL}]]


if __name__ == "__main__":
    bad = 0
    now = datetime(2026, 11, 15, 10, 0, tzinfo=timezone.utc)
    W = {"btc": {"tip": 976012, "day0": {"d": "2026-11-15", "h": 975931}}}
    for lang in ("fa", "ckb", "kmr", "ar", "en"):
        ls = lines(lang, lambda k: W if k == "world" else None, now)
        txt = "\n".join(ls)
        if len(ls) != 5:
            print("FAIL", lang, "lines", ls)
            bad += 1
        if lang in ("fa", "ckb", "ar") and any(c in "0123456789" for c in txt):
            print("FAIL", lang, "Latin digits", txt)
            bad += 1
        want_btc = n((976012 - 975931 + 1) * 3.125, lang, 3)
        if want_btc not in txt or n(1050000 - 976012, lang) not in txt:
            print("FAIL", lang, "bitcoin figures", txt)
            bad += 1
        bare = lines(lang, lambda k: None, now)
        if len(bare) != 3:
            print("FAIL", lang, "no file must mean no Bitcoin lines", bare)
            bad += 1
        stale = lines(lang, lambda k: {"btc": {"tip": 976012, "day0": {"d": "2026-11-14", "h": 975800}}}, now)
        if "—" not in stale[3]:
            print("FAIL", lang, "yesterday's mark must not count as today", stale)
            bad += 1
        s = section(lang, lambda k: {"btc": "x"})
        if L("title", lang) not in s or len(s) > 4096:
            print("FAIL", lang, "odd file", s[:80])
            bad += 1
        rows = open_rows(lang)
        if rows[0][0]["web_app"]["url"] != URL or rows[1][0]["url"] != URL or any(len(b["text"]) > 40 for r in rows for b in r):
            print("FAIL", lang, "buttons")
            bad += 1
    # population at the UN epoch, births at Tehran noon of a 365-day year = half a day
    p = lines("en", None, datetime(2026, 7, 1, tzinfo=timezone.utc))[0]
    if "8,300,678,396" not in p:
        print("FAIL population at the epoch", p)
        bad += 1
    print(f"bot_world self-test: {bad} failures")
    raise SystemExit(1 if bad else 0)
