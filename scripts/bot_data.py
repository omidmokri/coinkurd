"""
Data layer + message formatters for the Coin_Kurd / Entekhab bot.

Reads the same JSON files the site (entekhab.net) is built from. Each file is
re-fetched from the repo's main branch (raw.githubusercontent.com) after a TTL,
so the bot always shows what the site shows; the checked-out copy is the fallback.
Live prices come from Binance's public data API (same source as scripts/market.py).
"""
import html
import json
import os
import time
from datetime import datetime, timezone

import requests

from bot_i18n import H, OPP, WHY, h, pick, t, v

REPO_RAW = os.environ.get("DATA_RAW", "https://raw.githubusercontent.com/omidmokri/coinkurd/main/data/")
LOCAL = os.environ.get("DATA_DIR", "data")
SITE = "https://entekhab.net"
BINANCE = ["https://data-api.binance.vision", "https://api.binance.com"]

TTL = {"posts_lite": 900, "translations": 900, "dna": 900, "kind": 1800, "indicators": 3600, "live": 300,
       "wrapped": 3600, "macro": 1800, "flows": 900}
_cache = {}


def load(name):
    """Return parsed data/<name>.json, refreshed from GitHub every TTL seconds."""
    now = time.time()
    ent = _cache.get(name)
    if ent and now - ent[0] < TTL.get(name, 300):
        return ent[1]
    data = None
    try:
        r = requests.get(REPO_RAW + name + ".json", timeout=20)
        if r.ok:
            data = r.json()
    except Exception:
        data = None
    if data is None and ent:
        data = ent[1]
    if data is None:
        try:
            with open(os.path.join(LOCAL, name + ".json"), encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = None
    _cache[name] = (now, data)
    return data


# ------------------------------------------------------------------ live prices
_px = {"t": 0, "map": {}}


def live_prices():
    """{SYMBOL: (price, chg24)} for USDT pairs; cached 45s."""
    if time.time() - _px["t"] < 45 and _px["map"]:
        return _px["map"]
    for base in BINANCE:
        try:
            r = requests.get(base + "/api/v3/ticker/24hr", params={"type": "MINI"}, timeout=20)
            if not r.ok:
                continue
            m = {}
            for x in r.json():
                s = x.get("symbol", "")
                if s.endswith("USDT"):
                    o, c = float(x["openPrice"]), float(x["lastPrice"])
                    m[s[:-4]] = (c, (c / o - 1) * 100 if o else 0.0)
            if m:
                _px.update(t=time.time(), map=m)
                return m
        except Exception:
            continue
    return _px["map"]


# ------------------------------------------------------------------ formatting helpers
def e(s):
    return html.escape(str(s or ""), quote=False)


def fp(x):
    """format price"""
    if x is None:
        return "—"
    x = float(x)
    if x >= 1000:
        return f"${x:,.0f}"
    if x >= 1:
        return f"${x:,.2f}"
    if x >= 0.01:
        return f"${x:.4f}"
    return f"${x:.8f}".rstrip("0")


def fpct(x, sign=True):
    if x is None:
        return "—"
    x = float(x)
    dot = "🟢" if x > 0 else ("🔴" if x < 0 else "⚪️")
    return f"{dot} {x:+.2f}%" if sign else f"{x:.2f}%"


def fbig(x):
    if x is None:
        return "—"
    x = float(x)
    for d, s in ((1e12, "T"), (1e9, "B"), (1e6, "M"), (1e3, "K")):
        if abs(x) >= d:
            return f"${x / d:.2f}{s}"
    return f"${x:.0f}"


def age(iso, lang):
    try:
        dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        m = int((datetime.now(timezone.utc) - dt).total_seconds() // 60)
        return f"🕒 {t('updated', lang)} {max(m, 0)} {t('ago_min', lang)}"
    except Exception:
        return ""


def L(d, lang):
    """pick a language from {fa,ckb,en} dict"""
    if not isinstance(d, dict):
        return d or ""
    return pick(d, lang)


def cut(s, n=4000):
    return s if len(s) <= n else s[: n - 1] + "…"


def bar(score, width=10):
    try:
        k = max(0, min(width, round(float(score) / 100 * width)))
    except Exception:
        k = 0
    return "▰" * k + "▱" * (width - k)


# ------------------------------------------------------------------ coin universe
def coin_list():
    m = load("market") or {}
    return [c["coin"] for c in m.get("coins", [])]


def find_coin(sym):
    sym = (sym or "").upper().strip().lstrip("$#/")
    if sym.endswith("USDT"):
        sym = sym[:-4]
    m = load("market") or {}
    for c in m.get("coins", []):
        if c["coin"] == sym:
            return c
    lp = live_prices()
    if sym in lp:
        return {"coin": sym, "price": lp[sym][0], "chg24": lp[sym][1]}
    return None


# ------------------------------------------------------------------ sections
def sec_market(lang):
    m, b = load("market"), load("brain")
    if not m:
        return t("no_data", lang)
    g, f = m.get("global", {}), m.get("fng", {})
    lp = live_prices()
    lines = [f"📊 <b>{t('b_market', lang)[2:]}</b>"]
    for c in ("BTC", "ETH", "SOL", "BNB", "XRP"):
        mc = next((x for x in m["coins"] if x["coin"] == c), None)
        px, ch = lp.get(c, (mc and mc["price"], mc and mc["chg24"]))
        if px:
            lines.append(f"<b>{c}</b> {fp(px)}  {fpct(ch)}")
    lines.append("")
    lines.append(f"💰 {h('mcap', lang)}: {fbig(g.get('mcap'))} ({fpct(g.get('mcap_chg24'))})")
    lines.append(f"👑 {h('dom', lang)}: BTC {(g.get('btc_d') or 0):.1f}% · ETH {(g.get('eth_d') or 0):.1f}%")
    fng_name = pick({"fa": "ترس و طمع", "ckb": "ترس و تەماع", "en": "Fear &amp; Greed"}, lang)
    lines.append(f"😱 {fng_name}: <b>{f.get('value', '—')}</b> ({e(f.get('class', ''))})")
    al = load("altseason") or {}
    if al.get("value") is not None:
        nm = pick({"fa": "شاخص فصل آلت‌کوین", "ckb": "پێوەری وەرزی ئاڵتکۆین", "en": "Altcoin Season Index",
                   "kmr": "Indeksa demsala altcoinan", "ar": "مؤشر موسم العملات البديلة"}, lang)
        lb = pick({"alt": {"fa": "فصل آلت‌کوین", "ckb": "وەرزی ئاڵتکۆین", "en": "altcoin season", "kmr": "demsala altcoinan", "ar": "موسم العملات البديلة"},
                   "btc": {"fa": "فصل بیت‌کوین", "ckb": "وەرزی بیتکۆین", "en": "Bitcoin season", "kmr": "demsala Bitcoin", "ar": "موسم البيتكوين"},
                   "neutral": {"fa": "نه این، نه آن", "ckb": "نە ئەم نە ئەو", "en": "neither", "kmr": "ne yek ji wan", "ar": "لا هذا ولا ذاك"}}.get(al.get("label"), {}), lang)
        sub = pick({"fa": "از ۵۰ ارز برتر در ۹۰ روز بهتر از BTC", "ckb": "لە ٥٠ دراوی سەرەوە لە ٩٠ ڕۆژدا باشتر لە BTC",
                    "en": "of the top 50 beat BTC over 90 days", "kmr": "ji 50 coinên jorîn di 90 rojan de ji BTC baştir",
                    "ar": "من أفضل 50 عملة تفوقت على BTC خلال 90 يوماً"}, lang)
        lines.append(f"🌗 {nm}: <b>{al['value']}</b>/100 ({lb}) · {al.get('beat')}/{al.get('n')} {sub}")
    if b and b.get("regime"):
        r = b["regime"]
        br = r.get("breadth", {})
        lines.append(f"🧭 {h('regime', lang)}: <b>{v('regime', r.get('regime'), lang)}</b>")
        lines.append(f"📶 {h('breadth', lang)}: ⬆️{br.get('up_pct', 0)}% ⬇️{br.get('down_pct', 0)}% ↔️{br.get('range_pct', 0)}%"
                     f"  · RSI&gt;70: {br.get('rsi_gt70', 0)} · RSI&lt;30: {br.get('rsi_lt30', 0)}")
    lines += ["", age(m.get("updated_at"), lang)]
    return "\n".join(lines)


def sec_brain(lang):
    b = load("brain")
    if not b:
        return t("no_data", lang)
    rep = L(b.get("report", {}), lang) or {}
    out = [f"🧠 <b>{e(rep.get('headline', ''))}</b>", "", e(rep.get("body", ""))]
    mv = b.get("movers") or []
    if mv:
        out += ["", f"<b>{h('why', lang)}</b>"]
        for x in mv[:6]:
            why = ", ".join(L(WHY.get(w["k"], {"en": w["k"]}), lang) for w in x.get("why", [])[:2])
            out.append(f"• <b>{x['coin']}</b> {fpct(x.get('chg24'))} — {why}")
    out += ["", age(b.get("report_at") or b.get("updated_at"), lang)]
    return cut("\n".join(out))


def sec_movers(lang):
    b = load("brain") or {}
    m = load("market") or {}
    coins = m.get("coins", [])
    gain = b.get("gainers") or sorted(coins, key=lambda x: -x.get("chg24", 0))[:6]
    lose = b.get("losers") or sorted(coins, key=lambda x: x.get("chg24", 0))[:6]
    out = [f"🚀 <b>{h('gainers', lang)}</b>"]
    out += [f"{i}. <b>{x['coin']}</b> {fpct(x.get('chg24'))}" for i, x in enumerate(gain[:6], 1)]
    out += ["", f"📉 <b>{h('losers', lang)}</b>"]
    out += [f"{i}. <b>{x['coin']}</b> {fpct(x.get('chg24'))}" for i, x in enumerate(lose[:6], 1)]
    out += ["", age(b.get("updated_at") or m.get("updated_at"), lang)]
    return "\n".join(out)


def fmt_opp(o, lang):
    name = L(OPP.get(o["type"], {"en": o["type"]}), lang)
    arrow = "🟢" if o.get("dir") == "bull" else ("🔴" if o.get("dir") == "bear" else "🔹")
    conf = "⭐️" if o.get("confidence") == "high" else ""
    s = f"{arrow}{conf} <b>{o['coin']}</b> · {name} · {o.get('tf', '')} · {fp(o.get('price'))}"
    extra = []
    if o.get("target"):
        extra.append(f"{h('target', lang)} {fp(o['target'])}")
    if o.get("inval"):
        extra.append(f"{h('inval', lang)} {fp(o['inval'])}")
    if o.get("rr"):
        extra.append(f"R:R {o['rr']}")
    if o.get("mtf_align") is not None:
        extra.append(f"MTF {o['mtf_align']}/2")
    if extra:
        s += "\n   " + " · ".join(extra)
    w = o.get("why") or {}
    wl = w.get(lang) or w.get("en" if lang == "kmr" else "fa")
    if wl:
        s += "\n   💡 " + e(wl)
    return s


def sec_opps(lang, coin=None):
    m = load("market") or {}
    ops = m.get("opportunities", [])
    if coin:
        ops = [o for o in ops if o["coin"] == coin]
    ops = sorted(ops, key=lambda o: (o.get("confidence") != "high", -(o.get("mtf_align") or 0), -(o.get("rr") or 0)))
    st = (load("scanstats") or {}).get("stats", {})
    out = [f"🎯 <b>{t('b_opps', lang)[2:]}</b>"]
    # one entry per coin, as on the site: the strongest finding leads, the coin's other findings follow with a
    # same-direction / conflicting verdict (a coin often trips several detectors in the same hour)
    grp = {}
    for o in ops:
        grp.setdefault(o["coin"], []).append(o)
    lead = []
    for o in ops:
        if grp.get(o["coin"]) and grp[o["coin"]][0] is o:
            o = dict(o, also=[x for x in grp[o["coin"]][1:] if x["type"] not in (o.get("confirms") or [])])
            lead.append(o)
    for o in lead[:12]:
        out.append(fmt_opp(o, lang))
        if o["also"]:
            names = ", ".join(("▼ " if x.get("dir") == "bear" else "▲ ") + L(OPP.get(x["type"], {"en": x["type"]}), lang) for x in o["also"])
            same = all(x.get("dir") == o.get("dir") for x in o["also"])
            verdict = pick({"fa": "✅ همه هم‌جهت", "ckb": "✅ هەموو هاوئاراستەن", "en": "✅ all point the same way",
                            "kmr": "✅ hemû di heman alî de ne", "ar": "✅ جميعها في الاتجاه نفسه"} if same else
                           {"fa": "⚠️ یافته‌های متضاد؛ با احتیاط", "ckb": "⚠️ دۆزینەوەی دژبەیەک؛ بە وریاییەوە",
                            "en": "⚠️ conflicting findings; be careful", "kmr": "⚠️ encamên dijber; bi hişyarî",
                            "ar": "⚠️ نتائج متعارضة؛ بحذر"}, lang)
            also = pick({"fa": "هم‌زمان", "ckb": "هاوکات", "en": "also", "kmr": "herwiha", "ar": "أيضاً"}, lang)
            out.append(f"   ➕ {also}: {names} — {verdict}")
        s, au = st.get(o["type"]), (load("scanaudit") or {}).get("patterns", {}).get(o["type"]) or {}
        if au.get("verdict") == "worse":
            out.append("   " + pick({"fa": "⚠️ در دست بازبینی: این الگو در آزمون بدتر از ساعت‌های تصادفی بوده",
                                     "ckb": "⚠️ لە پێداچوونەوەدایە: ئەم شێوازە لە تاقیکردنەوەدا خراپتر بووە لە کاتژمێرە هەڕەمەکییەکان",
                                     "en": "⚠️ under review: this pattern tested worse than random hours"}, lang))
        if s and s.get("n72"):
            out.append(f"   📈 win72h {s.get('win72')}% · avg {(s.get('avg72') or 0):+.2f}% (n={s['n72']})")
    if len(out) == 1:
        out.append("—")
    out += ["", t("nfa", lang), age(m.get("updated_at"), lang)]
    return cut("\n".join(out))


def sec_score(lang):
    s = load("score") or {}
    cs = s.get("coins", {})
    if not cs:
        return t("no_data", lang)
    rows = sorted(cs.items(), key=lambda kv: -kv[1]["score"])
    out = [f"🏅 <b>{h('score', lang)}</b>",
           pick({"fa": "تکنیکال ۴۰٪ · احساسات ۲۵٪ · اخبار ۲۰٪ · کانال ۱۵٪",
            "ckb": "تەکنیکی ٤٠٪ · هەست ٢٥٪ · هەواڵ ٢٠٪ · کەناڵ ١٥٪",
            "en": "technical 40% · sentiment 25% · news 20% · channel 15%"}, lang), "", "⬆️"]
    for c, x in rows[:10]:
        out.append(f"<b>{c}</b> {x['score']} {bar(x['score'])} {v('label', x['label'], lang)}")
    out += ["", "⬇️"]
    for c, x in rows[-5:]:
        out.append(f"<b>{c}</b> {x['score']} {bar(x['score'])} {v('label', x['label'], lang)}")
    out += ["", age(s.get("updated_at"), lang)]
    return "\n".join(out)


def sec_news(lang, coin=None):
    n = load("news") or {}
    items = n.get("items", [])
    if coin:
        items = [x for x in items if coin in (x.get("coins") or [])]
    out = [f"📰 <b>{h('news', lang)}{(' · ' + coin) if coin else ''}</b>"]
    for x in items[:10]:
        src = len(x.get("sources") or []) or 1
        multi = f" ×{src}" if src > 1 else ""
        out.append(f"• <a href=\"{e(x['url'])}\">{e(x['title'])}</a> <i>({e(x.get('source'))}{multi})</i>")
    if len(out) == 1:
        out.append("—")
    out += ["", age(n.get("updated_at"), lang)]
    return cut("\n".join(out))


def sec_narr(lang):
    n = load("narratives") or {}
    out = [f"🔥 <b>{t('b_narr', lang)[2:]}</b>"]
    for x in sorted(n.get("narratives", []), key=lambda x: -x.get("momentum", 0))[:8]:
        fire = "🔥" * min(3, int(x.get("momentum", 0) // 1.5)) or "▫️"
        mem = " ".join(f"{m['coin']}{(m.get('chg24') or 0):+.1f}%" for m in (x.get("members") or [])[:3])
        out.append(f"{fire} <b>{e(L(x['name'], lang))}</b> — ×{(x.get('momentum') or 0):.1f} · {x.get('mentions_24h', 0)} 🗞"
                   f"\n   {mem}")
        if x.get("headlines"):
            hd = x["headlines"][0]
            out.append(f"   ↳ <a href=\"{e(hd.get('url'))}\">{e(hd.get('title'))[:90]}</a>")
    out += ["", age(n.get("updated_at"), lang)]
    return cut("\n".join(out))


def sec_events(lang):
    ev = load("events") or {}
    out = [f"📅 <b>{t('b_events', lang)[2:]}</b> (UTC)"]
    imp = {"High": "🔴", "Medium": "🟠", "Low": "🟡"}
    now = datetime.now(timezone.utc)
    for x in ev.get("events", [])[:12]:
        try:
            dt = datetime.fromisoformat(x["date"])
        except Exception:
            continue
        past = "✔️ " if dt < now else ""
        title = x.get("title_fa") if lang == "fa" and x.get("title_fa") else x.get("title")
        fc = f" · F {x['forecast']}" if x.get("forecast") else ""
        pv = f" · P {x['previous']}" if x.get("previous") else ""
        out.append(f"{past}{imp.get(x.get('impact'), '⚪️')} {dt:%a %d %b %H:%M} — <b>{e(title)}</b>{fc}{pv}")
    a = (ev.get("reaction_stats") or {}).get("_all") or {}
    if a.get("n"):
        L = {"fa": "دامنهٔ ۴h بعد از رویداد در {w} از {n} رویداد بیشتر از معمولِ همان ساعت (۱۴ روز قبل) بود: {r}% در برابر {b}%",
             "ckb": "مەودای ٤h دوای ڕووداو لە {w} لە {n} ڕووداودا زیاتر بوو لە ئاسایی هەمان کاتژمێر (١٤ ڕۆژی پێشوو): {r}% بەرامبەر {b}%",
             "en": "4h range after the event was wider than normal for that hour (prev. 14 days) in {w} of {n} events: {r}% vs {b}%"}
        line = L.get(lang, L["en"]).format(w=a["wider"], n=a["n"], r=a["avg_range_4h"], b=a["avg_base_4h"])
        line += f" · sign test p={a['p']}" if a.get("p") is not None else f" · n<{a.get('min_n', 10)}: no test yet"
        out.append("\n📏 " + e(line))
    if len(out) == 1:
        out.append("—")
    out += ["", age(ev.get("updated_at"), lang)]
    return "\n".join(out)


def sec_council(lang):
    c = load("council") or {}
    co = c.get("council", {})
    if not co:
        return t("no_data", lang)
    names = {"technical": {"fa": "تکنیکال", "ckb": "تەکنیکی", "en": "Technical"},
             "derivatives": {"fa": "مشتقات", "ckb": "دەرهاوێشتە", "en": "Derivatives"},
             "sentiment": {"fa": "احساسات", "ckb": "هەست", "en": "Sentiment"},
             "macro": {"fa": "کلان", "ckb": "ماکرۆ", "en": "Macro"},
             "history": {"fa": "تاریخ", "ckb": "مێژوو", "en": "History"}}
    loc = co.get(lang) or co.get("en" if lang == "kmr" else "fa", {})
    out = [f"🏛 <b>{t('b_council', lang)[2:]}</b>", "", e(loc.get("summary", "")), ""]
    for a in co.get("agents", []):
        ev = (a.get(lang) or a.get("en" if lang == "kmr" else "fa") or {}).get("evidence", [])
        out.append(f"{v('stance', a.get('stance'), lang)} <b>{L(names.get(a['id'], {'en': a['id']}), lang)}</b>"
                   f" ({a.get('stance')}, {'●' * int(a.get('confidence', 0))})")
        for x in ev[:2]:
            out.append(f"   – {e(x)}")
    if loc.get("disagreements"):
        out += ["", "⚔️ " + e(loc["disagreements"][0])]
    out += ["", age(c.get("at"), lang)]
    return cut("\n".join(out))


def sec_deriv(lang):
    d = load("derivatives") or {}
    if not d:
        return t("no_data", lang)
    out = [f"⚖️ <b>{t('b_deriv', lang)[2:]}</b>",
           f"{h('oi', lang)}: {fbig(d.get('total_oi_usd'))} · {h('funding', lang)} avg {(d.get('avg_funding') or 0):.4f}%", ""]
    ext = pick({"fa": "افراطی", "ckb": "زۆر توند", "en": "extreme", "kmr": "zêde", "ar": "مفرط"}, lang)
    for c in ("BTC", "ETH", "SOL"):
        x = d.get(c) or {}
        if not x:
            continue
        ls = (x.get("long_short") or [[0, None]])[-1][1]
        liq = x.get("liq", {})
        f = x.get("funding") or 0
        oh = x.get("oi_hist") or []
        ch = f" ({100 * (oh[-1][1] / oh[-25][1] - 1):+.1f}% 24h)" if len(oh) >= 25 and oh[-25][1] else ""
        out.append(f"<b>{c}</b> OI {fbig(x.get('oi_usd'))}{ch} · {h('funding', lang)} {f:.4f}%"
                   f"{' ⚠️' + ext if abs(f) >= 0.05 else ''} ({(x.get('funding_ann') or 0):+.1f}%/y) · L/S {ls}")
        # long liquidations are red (a drop flushed longs), short liquidations green, as on the site
        if liq.get("long_usd_24h") is not None and liq.get("since"):
            hrs = max(1, round((time.time() * 1000 - liq["since"]) / 3.6e6))
            span = "24h" if hrs >= 23 else f"{hrs}h"
            out.append(f"   {h('liq', lang)} {span}: 🔴L {fbig(liq.get('long_usd_24h'))} · 🟢S {fbig(liq.get('short_usd_24h'))}")
        else:
            out.append(f"   {h('liq', lang)} 1h: 🔴L {fbig(liq.get('long_usd_1h'))} · 🟢S {fbig(liq.get('short_usd_1h'))}")
    rr = (d.get("regime_read") or {}).get("BTC") or {}
    if rr.get("fa"):
        out += ["", "🧭 <b>" + pick({"fa": "در رژیم فعلی بازار", "ckb": "لە دۆخی ئێستای بازاڕدا", "en": "In the current regime"}, lang) + "</b>",
                html.escape(rr.get(lang) or rr.get("fa") if lang in ("fa", "ckb") else rr.get("en") or rr.get("fa"))]
    out += ["", "🔥 " + pick({"fa": "فاندینگ داغ", "ckb": "فاندینگی گەرم", "en": "Hot funding"}, lang)]
    out += [f"  {x['coin']} {(x.get('funding') or 0):+.4f}% ({(x.get('funding_ann') or 0):+.0f}%/y)" for x in d.get("funding_hot", [])[:5]]
    out += ["🧊 " + pick({"fa": "فاندینگ منفی", "ckb": "فاندینگی نەرێنی", "en": "Negative funding"}, lang)]
    out += [f"  {x['coin']} {(x.get('funding') or 0):+.4f}% ({(x.get('funding_ann') or 0):+.0f}%/y)" for x in d.get("funding_cold", [])[:5]]
    out += ["", "📊 entekhab.net/derivatives/", age(d.get("updated_at"), lang)]
    return "\n".join(out)


# ---------------------------------------------------------------- lab
def sec_mc(lang):
    lab = load("lab") or {}
    f = lab.get("futures") or {}
    if not f:
        return t("no_data", lang)
    cone = f.get("cone", {})
    end = {k: (vals[-1] if vals else None) for k, vals in cone.items()}
    title = pick({"fa": "شبیه‌سازی مونت‌کارلو بیت‌کوین (۳۰ روز، {n} مسیر)",
             "ckb": "شێوەکاری مۆنتی کارلۆی بیتکۆین (٣٠ ڕۆژ، {n} ڕێڕەو)",
             "en": "BTC Monte Carlo (30 days, {n} paths)"}, lang).format(n=f.get("paths"))
    p = pick({"fa": "احتمال", "ckb": "ئەگەری", "en": "P"}, lang)
    out = [f"🎲 <b>{title}</b>", f"{h('price', lang)}: {fp(f.get('price'))}", "",
           f"{p} ⬆️: <b>{f.get('p_up')}%</b>",
           f"{p} +10%: {f.get('p_up10')}% · −10%: {f.get('p_dn10')}%",
           f"{p} +20%: {f.get('p_up20')}% · −20%: {f.get('p_dn20')}%", "",
           pick({"fa": "بازهٔ قیمت روز ۳۰:", "ckb": "مەودای نرخی ڕۆژی ٣٠:", "en": "Day-30 price cone:"}, lang),
           f"P5 {fp(end.get('5'))} · P25 {fp(end.get('25'))} · <b>P50 {fp(end.get('50'))}</b> · P75 {fp(end.get('75'))} · P95 {fp(end.get('95'))}",
           f"σ {f.get('sim_vol_annual')}%/y", "", t("nfa", lang)]
    return "\n".join(out)


def sec_mem(lang):
    mem = (load("lab") or {}).get("memory") or {}
    if not mem:
        return t("no_data", lang)
    st, td = mem.get("stats", {}), mem.get("today", {})
    title = pick({"fa": "حافظهٔ بازار: {n} روز مشابه امروز از {s}",
             "ckb": "بیرەوەری بازاڕ: {n} ڕۆژی هاوشێوەی ئەمڕۆ لە {s}ەوە",
             "en": "Market memory: {n} days most like today since {s}"}, lang).format(n=st.get("n"), s=mem.get("since"))
    out = [f"🕰 <b>{title}</b>",
           f"7d {td.get('ret7')}% · 30d {td.get('ret30')}% · RSI {td.get('rsi')} · vs MA200 {td.get('vs_ma200')}%", "",
           pick({"fa": "بعد از آن روزها:", "ckb": "دوای ئەو ڕۆژانە:", "en": "What happened next:"}, lang),
           f"7d ⬆️ {st.get('up7')}/{st.get('n')} · avg {st.get('avg7')}%",
           f"30d ⬆️ {st.get('up30')}/{st.get('n')} · avg {st.get('avg30')}% · med {st.get('med30')}%",
           f"best {st.get('best30')}% · worst {st.get('worst30')}%", ""]
    for a in mem.get("analogs", [])[:6]:
        out.append(f"• {a['date']} ({fp(a['price'])}) → 7d {(a.get('f7') or 0):+.1f}% · 30d {(a.get('f30') or 0):+.1f}%")
    return "\n".join(out)


def sec_vol(lang):
    vol = (load("lab") or {}).get("vol") or {}
    st = {"tight": {"fa": "فشرده 🔒", "ckb": "تەسک 🔒", "en": "tight 🔒"},
          "normal": {"fa": "عادی", "ckb": "ئاسایی", "en": "normal"},
          "wide": {"fa": "باز 💥", "ckb": "فراوان 💥", "en": "wide 💥"}}
    out = [f"🌡 <b>{t('b_vol', lang)[2:]}</b>",
           pick({"fa": "فشردگی باند بولینگر معمولاً پیش از حرکت بزرگ است.",
            "ckb": "تەسکبوونی باندی بۆلینگەر زۆرجار پێش جووڵەی گەورەیە.",
            "en": "Tight Bollinger bands often precede big moves."}, lang), ""]
    for c, x in vol.items():
        shift = " ⚡️" if x.get("shift") else ""
        out.append(f"<b>{c}</b> {L(st.get(x.get('state'), {'en': x.get('state')}), lang)}{shift} · BW {x.get('bw_pct')}% "
                   f"(rank {x.get('bw_rank')}) · RV7 {x.get('rv7')} / RV90 {x.get('rv90')}")
    return "\n".join(out)


def sec_opt(lang):
    o = (load("lab") or {}).get("options") or {}
    if not o:
        return t("no_data", lang)
    out = [f"🧾 <b>{t('b_opt', lang)[2:]}</b> (Deribit)", ""]
    for c, x in o.items():
        mp = x.get("max_pain", {})
        dv = x.get("dvol", {})
        out += [f"<b>{c}</b> {fp(x.get('underlying'))}",
                f"   Put/Call OI {x.get('pc_oi')} · Vol {x.get('pc_vol')} · IV {x.get('iv_oi_weighted')}%",
                f"   Max pain {mp.get('expiry')}: {fp(mp.get('max_pain'))} ({(mp.get('vs_spot_pct') or 0):+.2f}%)",
                f"   DVOL {dv.get('now')} (7d {dv.get('lo7')}–{dv.get('hi7')})"]
    return "\n".join(out)


def sec_xex(lang):
    x = (load("lab") or {}).get("xex") or []
    out = [f"🏦 <b>{t('b_xex', lang)[2:]}</b>", ""]
    for r in x[:10]:
        out.append(f"<b>{r['coin']}</b> spread {(r.get('spread_pct') or 0):.3f}% · ⬆️{r['hi']} ⬇️{r['lo']}")
    return "\n".join(out) if x else t("no_data", lang)


def sec_dev(lang):
    d = (load("lab") or {}).get("dev") or []
    out = [f"👨‍💻 <b>{t('b_dev', lang)[2:]}</b> (GitHub)", ""]
    for r in sorted(d, key=lambda r: -r.get("c30", 0))[:12]:
        tr = "📈" if r.get("trend", 1) > 1.1 else ("📉" if r.get("trend", 1) < 0.9 else "➖")
        out.append(f"<b>{r['coin']}</b> {tr} {r['c7']} commits/7d · {r['c30']}/30d · {e(r.get('release', ''))}")
    return "\n".join(out) if d else t("no_data", lang)


def sec_macro(lang):
    m = load("macro") or {}
    lab = (load("lab") or {}).get("macro") or {}
    out = [f"🌍 <b>{t('b_macro', lang)[2:]}</b>", ""]
    w = (m.get("windows") or {}).get("3m", {})
    mx = w.get("matrix", {})
    row = mx.get("BTC") if isinstance(mx.get("BTC"), dict) else None
    if row:
        out.append(pick({"fa": "همبستگی ۳ ماهه با بیت‌کوین:", "ckb": "پەیوەندی ٣ مانگە لەگەڵ بیتکۆین:",
                    "en": "3-month correlation with BTC:"}, lang))
        for k, val in row.items():
            if k == "BTC" or val is None:
                continue
            nm = L(m.get("names", {}).get(k, {"en": k}), "en" if lang in ("kmr", "en") else "fa")
            out.append(f"  {e(nm)}: <b>{val:+.2f}</b>")
    if lab:
        g = lab.get("gold", {})
        out += ["", f"🥇 Gold {fp(g.get('price'))} (30d {g.get('chg30')}%) · corr30 {g.get('corr30')}",
                f"💶 EURUSD {lab.get('eurusd', {}).get('price')} · corr30 {lab.get('eurusd', {}).get('corr30')}"]
    return "\n".join(out)


def sec_dna(lang, coin=None):
    d = load("dna") or {}
    cs = d.get("coins", {})
    if not cs:
        return t("no_data", lang)
    genes = {"liquidity": "L", "volatility": "V", "flow": "F", "sentiment": "S", "attention": "A",
             "leverage": "X", "developers": "D", "momentum": "M"}
    gname = pick({"fa": "L نقدشوندگی · V نوسان · F جریان · S احساسات · A توجه · X اهرم · D توسعه · M مومنتوم",
             "ckb": "L شلەیی · V لەرزین · F ڕەوت · S هەست · A سەرنج · X لیڤەرێج · D گەشەپێدان · M خێرایی",
             "en": "L liquidity · V volatility · F flow · S sentiment · A attention · X leverage · D developers · M momentum"}, lang)
    if coin and coin in cs:
        x = cs[coin]
        ts = x.get("twin_stats", {})
        out = [f"🧬 <b>DNA {coin}</b>", f"<code>{x.get('code')}</code>", gname, "",
               f"{h('similar', lang)}: " + ", ".join(f"{c} {s}%" for c, s in x.get("similar", [])[:5])]
        if ts:
            out.append(pick({"fa": "دوقلوهای تاریخی", "ckb": "دووانە مێژووییەکان", "en": "Historical twins"}, lang) +
                       f": 7d avg {ts.get('avg7')}% ({ts.get('up7')}/{ts.get('n')} ⬆️) · 30d avg {ts.get('avg30')}% ({ts.get('up30')}/{ts.get('n')} ⬆️)")
        return "\n".join(out)
    out = [f"🧬 <b>{t('b_dna', lang)[2:]}</b>", gname, ""]
    for c, x in list(cs.items())[:15]:
        out.append(f"<b>{c}</b> <code>{x.get('code')}</code>")
    hs = d.get("headline_sentiment", {})
    if hs:
        out += ["", f"🗞 7d headline sentiment: <b>{(hs.get('score7') or 0):+.2f}</b> (n={hs.get('n7')})"]
    return "\n".join(out)


def sec_cycle(lang):
    k = load("kind") or {}
    pl, sc = k.get("power_law") or {}, k.get("style_cycle") or {}
    if not pl:
        return t("no_data", lang)
    zone = {"above_upper": {"fa": "بالای باند بالایی (گران)", "ckb": "سەروو باندی سەرەوە (گران)", "en": "above upper band (rich)"},
            "below_lower": {"fa": "زیر باند پایینی (ارزان)", "ckb": "خوار باندی خوارەوە (هەرزان)", "en": "below lower band (cheap)"},
            "fair": {"fa": "نزدیک ارزش منصفانه", "ckb": "نزیک بەهای دادپەروەرانە", "en": "near fair value"},
            "above_fair": {"fa": "بالای ارزش منصفانه", "ckb": "سەروو بەهای دادپەروەرانە", "en": "above fair"},
            "below_fair": {"fa": "زیر ارزش منصفانه", "ckb": "خوار بەهای دادپەروەرانە", "en": "below fair"}}
    out = [f"🌀 <b>{t('b_cycle', lang)[2:]}</b>", "",
           "<b>Bitcoin Power Law</b>",
           f"{h('price', lang)} {fp(pl.get('price'))} · fair {fp(pl.get('fair'))} ({(pl.get('dev_pct') or 0):+.1f}%)",
           f"band {fp(pl.get('lower'))} – {fp(pl.get('upper'))} · buy&lt; {fp(pl.get('buy_below'))}",
           f"→ {L(zone.get(pl.get('zone'), {'en': pl.get('zone')}), lang)} · R² {pl.get('r2')}"]
    if sc:
        out += ["", "<b>Kurdistani Style Cycle</b>",
                f"phase: <b>{e(sc.get('phase'))}</b> · MVRV {sc.get('mvrv')} · NUPL {sc.get('nupl')} · SOPR {sc.get('sopr')}"]
    out += ["", t("nfa", lang)]
    return "\n".join(out)


def sec_chain(lang):
    c = load("chain") or {}
    if not c:
        return t("no_data", lang)
    fe, adj = c.get("fees", {}), c.get("adjustment", {})
    blk = (c.get("blocks") or [{}])[0]
    out = [f"⛓ <b>{t('b_chain', lang)[2:]}</b>", "",
           f"🧱 height {blk.get('height')} · {blk.get('tx_count')} tx",
           f"⛏ hashrate {c.get('hashrate', 0) / 1e18:.0f} EH/s · difficulty {c.get('difficulty', 0) / 1e12:.1f} T",
           f"🎯 retarget {(adj.get('progressPercent') or 0):.0f}% · est {(adj.get('difficultyChange') or 0):+.2f}% · {adj.get('remainingBlocks')} blocks",
           f"💸 fees sat/vB: fast {fe.get('fastestFee')} · 30m {fe.get('halfHourFee')} · 1h {fe.get('hourFee')}",
           f"🌐 nodes {c.get('nodes', {}).get('total')}",
           "", age(c.get("updated_at"), lang)]
    return "\n".join(out)


def sec_flows(lang):
    f = load("flows") or {}
    sec = f.get("sectors", [])
    if not sec:
        return t("no_data", lang)
    out = [f"💧 <b>{t('b_flows', lang)[2:]}</b>", ""]
    for x in sorted(sec, key=lambda x: -abs(x.get("delta_usd", 0)))[:12]:
        arrow = "🟢" if x.get("delta_usd", 0) > 0 else "🔴"
        out.append(f"{arrow} <b>{e(x.get('short') or x.get('name'))}</b> {fbig(x.get('delta_usd'))} · {(x.get('chg24') or 0):+.1f}% · mcap {fbig(x.get('mcap'))}")
    dom = (f.get("dominance") or [{}])[-1]
    if dom:
        out += ["", f"BTC {dom.get('btc')}% · ETH {dom.get('eth')}% · stable {dom.get('stable')}% · others {dom.get('others')}%"]
    out += ["", age(f.get("updated_at"), lang)]
    return "\n".join(out)


def sec_week(lang):
    w = (load("wrapped") or {}).get("week") or {}
    if not w:
        return t("no_data", lang)
    out = [f"🗓 <b>{t('b_week', lang)[2:]}</b> {w.get('from')} → {w.get('to')}", "", f"🚀 {h('gainers', lang)}"]
    out += [f"  {x['coin']} {(x.get('chg') or 0):+.1f}%" for x in w.get("top_gainers", [])[:5]]
    if w.get("top_losers"):
        out += [f"📉 {h('losers', lang)}"] + [f"  {x['coin']} {(x.get('chg') or 0):+.1f}%" for x in w["top_losers"][:5]]
    return "\n".join(out)


def sec_track(lang):
    st = (load("scanstats") or {}).get("stats", {})
    sig = load("signals") or {}
    out = [f"📈 <b>{t('b_track', lang)[2:]}</b>",
           pick({"fa": "نتیجهٔ واقعی سیگنال‌های اسکنر (۲۴ و ۷۲ ساعت بعد):",
            "ckb": "ئەنجامی ڕاستەقینەی سیگناڵەکانی سکانەر (٢٤ و ٧٢ کاتژمێر دواتر):",
            "en": "Real outcome of scanner signals (24h / 72h later):"}, lang), ""]
    for k, s in sorted(((k, s) for k, s in st.items() if "|" not in k), key=lambda kv: -kv[1].get("n", 0)):
        out.append(f"• {L(OPP.get(k, {'en': k}), lang)}: n={s.get('n')} · 24h win {s.get('win24')}% ({(s.get('avg24') or 0):+.2f}%)"
                   f" · 72h win {s.get('win72')}% ({(s.get('avg72') or 0):+.2f}%)")
    au = (load("scanaudit") or {}).get("patterns", {})
    if au:
        out += ["", pick({"fa": "آزمون هر الگو (حرکت ۲۴ ساعته در جهت سیگنال، در برابر همان کوین‌ها در ساعت‌های دیگر):",
                          "ckb": "تاقیکردنەوەی هەر شێوازێک (جووڵەی ٢٤ کاتژمێر بە ئاراستەی سیگناڵ، بەرامبەر هەمان دراوەکان لە کاتژمێرەکانی تر):",
                          "en": "Each pattern tested (24h move in the signal's direction vs the same coins at other hours):"}, lang)]
        vt = {"better": "✅", "worse": "⚠️", "no_edge": "➖", "too_few": "…"}
        for k, a in sorted(((k, a) for k, a in au.items() if k != "_all"), key=lambda kv: kv[1]["p"]):
            out.append(f"{vt.get(a['verdict'], '')} {L(OPP.get(k, {'en': k}), lang)}: {a['obs']:+.2f}% vs {a['mid']:+.2f}% · p={a['p']:.3f} (n={a['n']})")
        out.append(pick({"fa": "⚠️ = در دست بازبینی (بدتر از تصادفی، p<0.05)", "ckb": "⚠️ = لە پێداچوونەوەدایە (خراپتر لە هەڕەمەکی، p<0.05)",
                         "en": "⚠️ = under review (worse than random, p<0.05)"}, lang))
    ss = sig.get("stats", {})
    if ss:
        out += ["", pick({"fa": "اندیکاتورهای Kurdistani:", "ckb": "ئیندیکاتۆرەکانی Kurdistani:", "en": "Kurdistani indicators:"}, lang)]
        for k, s in ss.items():
            out.append(f"• {k}: {s.get('n')} sig · win {s.get('win')}% · avg {s.get('avg')}% ({s.get('h')})")
    tr = load("trackrecord") or {}
    if tr.get("obs"):                       # tested against random hours — the raw average alone said nothing
        o, rt = tr["obs"], tr["test"]["r24"]
        out += ["", pick({"fa": "بیت‌کوین ۲۴ ساعت بعد از پست‌های کانال در برابر ساعت‌های تصادفی",
                     "ckb": "بیتکۆین ٢٤ کاتژمێر دوای پۆستەکان بەرامبەر کاتژمێرە هەڕەمەکییەکان",
                     "en": "Bitcoin 24h after channel posts vs random hours"}, lang)
                + f": {o['r24']:+.2f}% vs {rt['mid']:+.2f}% · p={rt['p']:.2f} (n={tr.get('n_posts')})",
                f"🔗 {SITE}/track-record/"]
    out += ["", f"🔗 {SITE}/status/"]
    return cut("\n".join(out))


def sec_ind(lang):
    d = load("indicators") or {}
    groups = d.get("groups", {})
    out = [f"📡 <b>{t('b_ind', lang)[2:]}</b> — TradingView", ""]
    cur = None
    for it in d.get("items", []):
        g = it.get("group")
        if g != cur:
            cur = g
            out.append(f"\n<b>{e(L(groups.get(g, {}), lang))}</b>")
        lock = "🔒" if it.get("access") == "invite-only" else "🔓"
        bt = it.get("bt") or {}
        perf = f" · PnL {bt['pnl']} · WR {bt['win']}" if bt.get("pnl") else ""
        out.append(f"{lock} <a href=\"{e(it.get('url'))}\">{e(it['name'])}</a>{perf}")
    out += _ind_live(d, lang)
    out += ["", pick({"fa": "🔒 = دعوتی؛ با «دعوت و پاداش» می‌توانی هدیه بگیری.",
                 "ckb": "🔒 = بە بانگهێشت؛ بە «بانگهێشت و خەڵات» دەتوانیت وەک دیاری وەریبگریت.",
                 "en": "🔒 = invite-only; earn one through “Invite & earn”."}, lang),
            f"🔗 {SITE}/indicators/"]
    return cut("\n".join(out))


LV_DIR = {"long": ("▲", {"fa": "صعودی", "ckb": "بەرزبوونەوە", "en": "Long"}), "short": ("▼", {"fa": "نزولی", "ckb": "دابەزین", "en": "Short"}),
          "flat": ("•", {"fa": "خنثی / صبر", "ckb": "بێلایەن / چاوەڕێ", "en": "Neutral / wait"})}


def _ind_live(d, lang, n=10):
    """live analysis block: latest OUTPUT of each indicator (the scripts' code never leaves TradingView / the private engine)"""
    lv = (load("live") or {}).get("items") or {}
    names = {it["id"]: it["name"] for it in d.get("items", [])}
    now, rows = datetime.now(timezone.utc), []
    for ind, it in lv.items():
        for s in (it.get("states") or [])[:2]:
            try:
                age = (now - datetime.fromisoformat(s["t"])).total_seconds() / 60
            except Exception:
                continue
            if age > 60 * 24 or ind not in names:
                continue
            f = s.get("f") or {}
            dv = str(f.get("dir") or f.get("side") or "").lower()
            dk = "long" if dv in ("long", "buy", "up", "bull") else "short" if dv in ("short", "sell", "down", "bear") else "flat" if dv else ""
            sym = str(s.get("tv_sym") or s.get("sym") or "").split(":")[-1]
            extra = "".join(f" · {k} {f[k]:g}" if isinstance(f.get(k), (int, float)) else "" for k in ("score", "conf"))
            dec = f" · {e(str(f['decision']))[:20]}" if isinstance(f.get("decision"), str) else ""
            arrow = f" {LV_DIR[dk][0]} {pick(LV_DIR[dk][1], lang)}" if dk else ""
            rows.append((age, f"• <b>{e(names[ind])}</b>: {e(sym)} {e(s.get('tf', ''))}{arrow}{dec}{extra} · {int(age)}′"))
    if not rows:
        return []
    rows.sort(key=lambda r: r[0])
    head = pick({"fa": "📊 <b>تحلیل زندهٔ اندیکاتورها</b> (فقط خروجی؛ کد قفل است)", "ckb": "📊 <b>شیکاریی زیندووی ئیندیکاتۆرەکان</b> (تەنها دەرچوو؛ کۆد قوفڵە)",
                 "en": "📊 <b>Live indicator analysis</b> (outputs only; code stays locked)"}, lang)
    return ["", head] + [r[1] for r in rows[:n]]


# ---------------------------------------------------------------- posts
def _post_title(p, lang):
    if lang != "fa":
        tr = (load("translations") or {}).get(str(p["id"]), {}).get("en" if lang == "kmr" else lang)
        if tr and tr.get("title"):
            return tr["title"]
    return p.get("title") or ""


def sec_posts(lang, coin=None, query=None, n=8):
    posts = load("posts_lite") or []
    if coin:
        posts = [p for p in posts if coin in (p.get("coins") or [])]
    if query:
        words = [w for w in query.lower().replace("‌", " ").split() if len(w) > 1] or [query.lower()]
        trs = load("translations") or {}
        res = []
        for p in posts:
            hay = (p.get("title") or "") + " " + " ".join(p.get("hashtags") or [])
            tr = trs.get(str(p["id"]), {})
            hay += " " + " ".join((tr.get(k) or {}).get("title", "") for k in ("ckb", "en"))
            hay = hay.lower().replace("‌", " ")
            if all(w in hay for w in words):
                res.append(p)
        posts = res
    posts = [p for p in posts if p.get("q") != "low" or query] or posts
    head = f"🔎 «{e(query)}»" if query else f"📢 <b>{h('posts', lang)}{(' · ' + coin) if coin else ''}</b>"
    out = [head]
    for p in posts[:n]:
        d = (p.get("date") or "")[:10]
        out.append(f"• <a href=\"{SITE}/p/{p['id']}/\">{e(_post_title(p, lang))[:110]}</a> <i>{d}</i>")
    if len(out) == 1:
        out.append(t("search_none", lang))
    return cut("\n".join(out))


# ---------------------------------------------------------------- coin card
def sec_coin(sym, lang):
    c = find_coin(sym)
    if not c:
        return None
    coin = c["coin"]
    lp = live_prices()
    px, ch = lp.get(coin, (c.get("price"), c.get("chg24")))
    out = [f"🪙 <b>{coin}</b>  {fp(px)}  {fpct(ch)}"]
    if c.get("rsi") is not None:
        out.append(f"{h('trend', lang)}: <b>{v('trend', c.get('trend'), lang)}</b> · RSI {c.get('rsi')} · "
                   f"EMA20 {fp(c.get('ema20'))} · EMA50 {fp(c.get('ema50'))}")
        out.append(f"{h('range48', lang)}: {fp(c.get('hi48'))} / {fp(c.get('lo48'))}")
    sc = (load("score") or {}).get("coins", {}).get(coin)
    if sc:
        comp = " · ".join(f"{k[:4]} {round(val)}" for k, val in sc.get("components", {}).items())
        out += ["", f"🏅 {h('score', lang)}: <b>{sc['score']}</b>/100 {bar(sc['score'])} {v('label', sc['label'], lang)}", f"   {comp}"]
    dn = (load("dna") or {}).get("coins", {}).get(coin)
    if dn:
        sim = ", ".join(c2 for c2, _ in dn.get("similar", [])[:3])
        out.append(f"🧬 <code>{dn.get('code')}</code> · {h('similar', lang)}: {sim}")
    vol = ((load("lab") or {}).get("vol") or {}).get(coin)
    if vol:
        out.append(f"🌡 {h('vol', lang)}: {vol.get('state')} · BW {vol.get('bw_pct')}% · RV7 {vol.get('rv7')}")
    dv = load("derivatives") or {}
    sw = next((x for x in dv.get("swaps", []) if x["coin"] == coin), None)
    if sw:
        out.append(f"⚖️ OI {fbig(sw.get('oi_usd'))} · {h('funding', lang)} {(sw.get('funding') or 0):.4f}% ({(sw.get('funding_ann') or 0):+.1f}%/y)")
    opt = ((load("lab") or {}).get("options") or {}).get(coin)
    if opt:
        mp = opt.get("max_pain", {})
        out.append(f"🧾 P/C {opt.get('pc_oi')} · IV {opt.get('iv_oi_weighted')}% · max pain {fp(mp.get('max_pain'))}")
    ops = [o for o in (load("market") or {}).get("opportunities", []) if o["coin"] == coin]
    if ops:
        out += ["", f"🎯 <b>{h('opps', lang)}</b>"] + [fmt_opp(o, lang) for o in ops[:3]]
    nw = [x for x in (load("news") or {}).get("items", []) if coin in (x.get("coins") or [])][:3]
    if nw:
        out += ["", f"📰 <b>{h('news', lang)}</b>"] + [f"• <a href=\"{e(x['url'])}\">{e(x['title'])[:100]}</a>" for x in nw]
    ps = [p for p in (load("posts_lite") or []) if coin in (p.get("coins") or [])][:3]
    if ps:
        out += ["", f"📢 <b>{h('posts', lang)}</b>"] + [
            f"• <a href=\"{SITE}/p/{p['id']}/\">{e(_post_title(p, lang))[:100]}</a>" for p in ps]
    out += ["", t("nfa", lang)]
    return cut("\n".join(out))


def coin_url(coin):
    return f"{SITE}/coins/{coin.lower()}/"


# ---------------------------------------------------------------- daily brief
def daily_brief(lang):
    b = load("brain") or {}
    m = load("market") or {}
    rep = L(b.get("report", {}), lang) or {}
    lp = live_prices()
    btc = lp.get("BTC")
    eth = lp.get("ETH")
    f = m.get("fng", {})
    out = [t("brief_title", lang), ""]
    if btc:
        out.append(f"BTC {fp(btc[0])} {fpct(btc[1])}")
    if eth:
        out.append(f"ETH {fp(eth[0])} {fpct(eth[1])}")
    out.append(f"😱 F&amp;G {f.get('value', '—')} ({e(f.get('class', ''))})")
    if b.get("regime"):
        out.append(f"🧭 {h('regime', lang)}: {v('regime', b['regime'].get('regime'), lang)}")
    if rep:
        out += ["", f"<b>{e(rep.get('headline', ''))}</b>", e(rep.get("body", ""))[:1800]]
    ev = [x for x in (load("events") or {}).get("events", []) if x.get("date", "") >= datetime.now(timezone.utc).isoformat()][:3]
    if ev:
        out += ["", "📅 " + " · ".join(f"{x['date'][11:16]} {e(x.get('title'))}" for x in ev)]
    return cut("\n".join(out))
