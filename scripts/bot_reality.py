#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The Reality-check group inside the Telegram bot.

These six readings already exist on the site. Rather than writing them a second time in the bot's
own words — which is exactly how the platforms drifted apart in the first place — each section
reads the same data file the page reads and reuses build_reality's trilingual string table, so a
wording or a threshold can only ever be changed in one place.

Everything here is a short chat-sized summary with the page's address for the full thing; the long
tables, the chain verification and the charts stay on the web, where they belong.
"""
import logging

import build_reality as BR
import reality_common as R

log = logging.getLogger("bot_reality")
SITE = "https://entekhab.net"
LANGS = {"fa", "ckb", "en"}


# a few labels the site has only as table headers, so they need a sentence form here
T = {"recorded": {"fa": "پیش‌بینی ثبت‌شده", "ckb": "پێشبینیی تۆمارکراو", "en": "Calls recorded"},
     "accuracy": {"fa": "دقت", "ckb": "وردی", "en": "Accuracy"},
     "full": {"fa": "محاسبهٔ کامل با مبلغ و تاریخ دلخواه در صفحهٔ سایت",
              "ckb": "ژمێردنی تەواو بە بڕ و بەرواری دڵخواز لە ماڵپەڕەکەدا",
              "en": "The full calculation, with your own amount and date, is on the site"}}


def _lg(lang):
    return lang if lang in LANGS else "fa"


def _t(k, lg):
    return T[k].get(lg) or T[k]["fa"]


def _n(x, lg, d=0, **kw):
    try:
        return BR.nf(x, lg, d, **kw)
    except Exception:
        return "—"


_LAST = {}                     # the structured form of the section just built, for summary()


def _head(title, lg, url, lines, upd=None):
    """one place builds the content; this renders it for a chat and records it for every other surface"""
    rows = [x for x in lines if x]
    _LAST[url] = {"title": title, "url": url, "rows": rows, "updated": upd}
    out = [f"<b>{title}</b>", ""] + rows
    if upd:
        out += ["", BR.s("upd", lg) + ": " + BR.fdate(upd, lg, True)]
    out += [SITE + url]
    return "\n".join(out)


def _nodata(title, lg, url):
    return _head(title, lg, url, [BR.s("nodata", lg)])


def summary(lg="fa"):
    """the same six readings as structured data — what the extension and the apps render"""
    out = []
    for key, (fn, url) in SECTIONS.items():
        try:
            fn(lg)
        except Exception:                    # one bad reading must not cost the other five
            log.exception("reality summary failed for %s", key)
            continue
        d = _LAST.get(url)
        if d:
            out.append(dict(d, key=key))
    return {"lang": lg, "items": out}


# ------------------------------------------------------------------ 1. Iran friction
def sec_friction(lang):
    lg = _lg(lang)
    d = R.load("friction.json", {})
    if not d:
        return _nodata("🧱 " + BR.s("fr.title", lg), lg, "/iran-friction/")
    lvl = BR.s("lvl." + (d.get("level") or "green"), lg)
    p = d.get("prices") or {}
    lines = [f"• <b>{_n(d.get('score'), lg, 1)}</b> — {lvl}", f"  {BR.s('fr.scale', lg)}", "",
             f"• {BR.s('fr.comps', lg)}:"]
    for c in (d.get("components") or [])[:4]:
        cid = c.get("id") or ""
        nm = BR.s(cid + ".t", lg) if (cid + ".t") in BR.S else cid
        lines.append(f"  – {nm}: {_n(c.get('score'), lg, 1)}")
    if p.get("usdt"):
        lines += ["", f"• تتر {_n(p.get('usdt'), lg)} · دلار آزاد {_n(p.get('usd'), lg)}"]
    pap = d.get("paper") or {}
    if pap.get("gap_pct") is not None:
        lines.append(f"• {BR.s('fr.paper', lg)}: {_n(pap.get('gap_pct'), lg, 2, sign=True)}٪")
    return _head("🧱 " + BR.s("fr.title", lg), lg, "/iran-friction/", lines, d.get("updated_at"))


# ------------------------------------------------------------------ 2. hype half-life
def sec_hype(lang):
    lg = _lg(lang)
    d = R.load("hype.json", {})
    nar = d.get("narratives") or []
    if not nar:
        return _nodata("🔥 " + BR.s("hy.title", lg), lg, "/hype/")
    rows = []
    for n in nar[:6]:
        nm = (n.get("name") or {}).get(lg) or (n.get("name") or {}).get("fa") or n.get("id")
        now = (n.get("now") or {}).get("channel") or {}
        st = BR.s("st." + (now.get("state") or "quiet"), lg)
        rows.append(f"• {nm} — {st}")
    return _head("🔥 " + BR.s("hy.title", lg), lg, "/hype/", rows, d.get("updated_at"))


# ------------------------------------------------------------------ 3. silent exit
def sec_silent(lang):
    lg = _lg(lang)
    d = R.load("silent_exit.json", {})
    assets = d.get("assets") or {}
    if not assets:
        return _nodata("🤫 " + BR.s("se.title", lg), lg, "/silent-exit/")
    lines = []
    for coin, a in list(assets.items())[:3]:
        on = [g for g in (a.get("signals") or []) if g.get("on")]
        gate = (a.get("talk") or {}).get("gate")
        lines.append(f"• <b>{coin}</b> — {_n(len(on), lg)} / {_n(len(a.get('signals') or []), lg)}")
        lines.append("  " + BR.s("se.gate_ok" if gate is not False else "se.gate_no", lg))
        for g in (a.get("signals") or []):
            lines.append(f"  – {BR.s(g['id'] + '.t', lg)}: "
                         + ("✅" if g.get("on") else "—") + f" ({_n(g.get('pct'), lg)}٪)")
    return _head("🤫 " + BR.s("se.title", lg), lg, "/silent-exit/", lines, d.get("updated_at"))


# ------------------------------------------------------------------ 4. local correlation
def sec_corr(lang):
    lg = _lg(lang)
    d = R.load("localcorr.json", {})
    w = (d.get("windows") or {}).get("30d") or {}
    m = w.get("matrix") or {}
    if not m:
        return _nodata("🔗 " + BR.s("co.title", lg), lg, "/iran-correlation/")
    names = {"USD": "دلار", "USDT": "تتر", "BTC_T": "بیت‌کوین (تومان)", "ETH_T": "اتریوم (تومان)",
             "BTC_USD": "بیت‌کوین (دلار)", "XAU_USD": "طلای جهانی"}
    base = "BTC_T"
    lines = [f"• {BR.s('w.30d', lg)}"]
    for k, v in (m.get(base) or {}).items():
        if k == base:
            continue
        lines.append(f"  – {names.get(k, k)}: {_n(v, lg, 2, sign=True)}")
    return _head("🔗 " + BR.s("co.title", lg), lg, "/iran-correlation/", lines, d.get("to") or w.get("to"))


# ------------------------------------------------------------------ 5. signal ledger
def sec_ledger(lang):
    lg = _lg(lang)
    d = R.load("ledger.json", {})
    ents = d.get("entries") or []
    if not ents:
        return _nodata("📒 " + BR.s("lg.title", lg), lg, "/ledger/")
    res = d.get("results") or {}
    decided = [e for e in ents if (res.get(e.get("id")) or {}).get("out") in ("win", "loss")]
    wins = sum(1 for e in decided if (res.get(e.get("id")) or {}).get("out") == "win")
    lines = [f"• {_t('recorded', lg)}: {_n(d.get('n'), lg)}"]
    if len(decided) >= 5:                            # the same bar the page uses: fewer and the rate is noise
        lines.append(f"• {_t('accuracy', lg)}: {_n(wins * 100.0 / len(decided), lg, 0)}٪ "
                     f"({_n(len(decided), lg)})")
    elif decided:
        lines.append(f"• {BR.s('lg.collecting', lg) if 'lg.collecting' in BR.S else ''} ({_n(len(decided), lg)})")
    for e in ents[:4]:
        out = (res.get(e.get("id")) or {}).get("out")
        mark = {"win": "✅", "loss": "❌"}.get(out, "⏳")
        lines.append(f"{mark} {e.get('coin')} · {BR.s('call.' + (e.get('call') or 'flat'), lg)}")
    return _head("📒 " + BR.s("lg.title", lg), lg, "/ledger/", lines, d.get("updated_at"))


# ------------------------------------------------------------------ 6. toman opportunity cost
def sec_opportunity(lang):
    lg = _lg(lang)
    d = R.load("opportunity.json", {})
    days = d.get("days") or []
    tom = d.get("toman") or {}
    if not days or not tom:
        return _nodata("🧮 ماشین حساب هزینه فرصت", lg, "/opportunity/")
    def last(key):
        a = tom.get(key) or []
        for v in reversed(a):
            if v is not None:
                return v
        return None
    names = {"USD": "دلار آزاد", "GOLD18": "طلای ۱۸ عیار", "COIN": "سکهٔ امامی", "USDT": "تتر"}
    lines = [f"• {BR.fdate(days[0], lg)} → {BR.fdate(days[-1], lg)}"]
    for k, nm in names.items():
        v = last(k)
        if v:
            lines.append(f"  – {nm}: {_n(v, lg)}")
    lines += ["", _t("full", lg)]
    return _head("🧮 ماشین حساب هزینه فرصت", lg, "/opportunity/", lines, d.get("updated_at"))


# ------------------------------------------------------------------ 7. news sentiment
SEN = {"title": {"fa": "📊 شاخص احساسات اخبار", "ckb": "📊 پێوەری هەستی هەواڵ", "en": "📊 News sentiment"},
       "n24": {"fa": "بر پایهٔ {n} خبر ۲۴ ساعت گذشته", "ckb": "لەسەر بنەمای {n} هەواڵی ٢٤ کاتژمێر",
               "en": "From {n} stories in the last 24 hours"}}


def sec_sentiment(lang):
    lg = _lg(lang)
    d = R.load("sentiment.json", {})
    if d.get("now") is None:
        return _nodata(SEN["title"].get(lg) or SEN["title"]["fa"], lg, "/sentiment/")
    lines = [f"• <b>{_n(d.get('now'), lg, 1, sign=True)}</b> — {d.get('label') or ''}",
             "  " + (SEN["n24"].get(lg) or SEN["n24"]["fa"]).format(n=_n(d.get("n24"), lg)), ""]
    for coin, c in list((d.get("coins") or {}).items())[:6]:
        lines.append(f"  – {coin}: {_n(c.get('v'), lg, 1, sign=True)} ({c.get('label') or ''})")
    return _head(SEN["title"].get(lg) or SEN["title"]["fa"], lg, "/sentiment/", lines, d.get("updated_at"))


# ------------------------------------------------------------------ 8. whale radar
WH = {"title": {"fa": "🐳 رادار نهنگ‌ها", "ckb": "🐳 ڕاداری نەهەنگەکان", "en": "🐳 Whale radar"},
      "t24": {"fa": "انتقال‌های بزرگ ۲۴ ساعت گذشته", "ckb": "گواستنەوە گەورەکانی ٢٤ کاتژمێر",
              "en": "Large transfers in the last 24 hours"},
      "note": {"fa": "انتقال بزرگ لزوماً خرید یا فروش نیست", "ckb": "گواستنەوەی گەورە بە مەرج نییە کڕین یان فرۆشتن بێت",
               "en": "A large transfer is not necessarily a buy or a sell"}}


def sec_whales(lang):
    lg = _lg(lang)
    d = R.load("whales.json", {})
    tot = d.get("totals24") or {}
    if not tot:
        return _nodata(WH["title"].get(lg) or WH["title"]["fa"], lg, "/whales/")
    lines = ["• " + (WH["t24"].get(lg) or WH["t24"]["fa"])]
    for a, v in sorted(tot.items(), key=lambda kv: -(kv[1].get("usd") or 0))[:5]:
        usd = v.get("usd") or 0
        amt = f"{usd / 1e9:.2f} میلیارد" if usd >= 1e9 else f"{usd / 1e6:.0f} میلیون"
        lines.append(f"  – {a}: {_n(v.get('n'), lg)} × ≈ {amt.translate(str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')).replace('.', '٫')} دلار")
    lines += ["", "ℹ️ " + (WH["note"].get(lg) or WH["note"]["fa"])]
    return _head(WH["title"].get(lg) or WH["title"]["fa"], lg, "/whales/", lines, d.get("updated_at"))


SECTIONS = {"friction": (sec_friction, "/iran-friction/"), "hype2": (sec_hype, "/hype/"),
            "sentim": (sec_sentiment, "/sentiment/"), "whales": (sec_whales, "/whales/"),
            "silent": (sec_silent, "/silent-exit/"), "corr": (sec_corr, "/iran-correlation/"),
            "ledger": (sec_ledger, "/ledger/"), "oppcost": (sec_opportunity, "/opportunity/")}
