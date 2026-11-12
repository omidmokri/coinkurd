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
import datetime as dt
import html
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
        if key in ("today", "podcast"):      # a market brief / the podcast, not a reality reading
            continue
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


# ------------------------------------------------------------------ the channel's real record
TR = {
    "title": {"fa": "کارنامهٔ واقعی کانال", "ckb": "کارنامەی ڕاستەقینەی کەناڵ", "en": "The channel's real record"},
    "after": {"fa": "۲۴ ساعت بعد از پست‌ها", "ckb": "٢٤ کاتژمێر دوای پۆستەکان", "en": "24h after posts"},
    "random": {"fa": "ساعت‌های تصادفی همان دوره", "ckb": "کاتژمێرە هەڕەمەکییەکانی هەمان ماوە", "en": "Random hours, same period"},
    "hit": {"fa": "درصد ۲۴ساعت‌های مثبت", "ckb": "ڕێژەی ٢٤ کاتژمێرە ئەرێنییەکان", "en": "Share of gaining 24h windows"},
    "chance": {"fa": "احتمال تصادفی بودن", "ckb": "ئەگەری هەڕەمەکی بوون", "en": "Chance it is luck"},
    "v_up": {"fa": "✅ به‌طور معناداری بهتر از ساعت‌های تصادفی.", "ckb": "✅ بە شێوەیەکی بەرچاو باشتر لە کاتژمێرە هەڕەمەکییەکان.",
             "en": "✅ Measurably better than random hours."},
    "v_dn": {"fa": "⚠️ به‌طور معناداری بدتر از ساعت‌های تصادفی.", "ckb": "⚠️ بە شێوەیەکی بەرچاو خراپتر لە کاتژمێرە هەڕەمەکییەکان.",
             "en": "⚠️ Measurably worse than random hours."},
    "v_no": {"fa": "⚖️ از نظر آماری با ساعت‌های تصادفی فرقی ندارد.", "ckb": "⚖️ لە ڕووی ئامارییەوە جیاوازییەکی نییە لەگەڵ کاتژمێرە هەڕەمەکییەکان.",
             "en": "⚖️ Statistically no different from random hours."},
    "n": {"fa": "{p} پست در {d} روز", "ckb": "{p} پۆست لە {d} ڕۆژدا", "en": "{p} posts over {d} days"},
    "note": {"fa": "پست‌ها بیشتر خبرند، نه پیشنهاد خرید و فروش؛ پیش‌بینی‌های صریح در «دفتر عملکرد سیگنال‌ها» امتیاز می‌گیرند.",
             "ckb": "زۆربەی پۆستەکان هەواڵن، نەک پێشنیاری کڕین و فرۆشتن.",
             "en": "Most posts are news, not buy or sell calls; explicit calls are scored in the Signal ledger."},
    "dir": {"fa": "جهت پست‌ها درست بود (روزها): {h}{pc} ↔ شانس {x}{pc} · احتمال تصادف {p}{pc}",
            "ckb": "ئاڕاستەی پۆستەکان ڕاست بوو (ڕۆژ): {h}{pc} ↔ بەخت {x}{pc} · ئەگەری ڕێکەوت {p}{pc}",
            "en": "Direction right (days): {h}{pc} vs chance {x}{pc} · chance of luck {p}{pc}"},
}


def _tr(k, lg, **kw):
    t = TR[k].get(lg) or TR[k]["fa"]
    return t.format(**kw) if kw else t


def sec_trackrec(lang):
    lg = _lg(lang)
    d = R.load("trackrecord.json", {})
    if not d.get("obs"):
        return _nodata("🧾 " + _tr("title", lg), lg, "/track-record/")
    o, t = d["obs"], d["test"]
    p = t["r24"]["p"]
    verdict = "v_no" if p >= 0.05 else ("v_up" if o["r24"] > t["r24"]["mid"] else "v_dn")
    pc = BR.PCT.get(lg, "%")
    lines = [_tr(verdict, lg), "",
             f"• {_tr('after', lg)}: <b>{_n(o['r24'], lg, 2, sign=True)}{pc}</b>",
             f"• {_tr('random', lg)}: {_n(t['r24']['mid'], lg, 2, sign=True)}{pc}",
             f"• {_tr('hit', lg)}: {_n(o['hit'], lg, 1)}{pc} ↔ {_n(t['hit']['mid'], lg, 1)}{pc}",
             f"• {_tr('chance', lg)}: {_n(100 * p, lg, 1)}{pc}",
             "", _tr("n", lg, p=_n(d.get("n_posts"), lg), d=_n(d.get("n_days"), lg)), "ℹ️ " + _tr("note", lg)]
    dr = R.load("direction.json", {})
    if dr.get("enough"):
        lines[-2:-2] = [f"• {_tr('dir', lg, h=_n(dr['hit_rate'], lg, 1), x=_n(dr['expected_rate'], lg, 1), p=_n(100 * dr['p'], lg, 1), pc=pc)}"]
    return _head("🧾 " + _tr("title", lg), lg, "/track-record/", lines, d.get("updated_at"))


# ------------------------------------------------------------------ 0. /today/ — the daily spine
TD = {"title": {"fa": "امروز در بازار", "ckb": "ئەمڕۆ لە بازاڕ", "en": "Today in the market"},
      "btc": {"fa": "بیت‌کوین ۲۴س", "ckb": "بیتکۆین ٢٤ک", "en": "Bitcoin 24h"},
      "fng": {"fa": "ترس و طمع", "ckb": "ترس و تەماح", "en": "Fear & greed"},
      "brd": {"fa": "کوین‌های مثبت / منفی", "ckb": "دراوە ئەرێنی / نەرێنی", "en": "Coins up / down"},
      "mov": {"fa": "بیشترین حرکت", "ckb": "زۆرترین جووڵە", "en": "Biggest movers"},
      "fr": {"fa": "اصطکاک ایران", "ckb": "گیروگرفتی ئێران", "en": "Iran friction"},
      "usdt": {"fa": "تتر (تومان)", "ckb": "تەتەر (تمەن)", "en": "USDT (toman)"},
      "sc": {"fa": "یافته‌های اسکنر ۲۴س", "ckb": "دۆزینەوەکانی سکانەر ٢٤ک", "en": "Scanner findings 24h"},
      "po": {"fa": "پست‌های کانال ۲۴س", "ckb": "پۆستەکانی کەناڵ ٢٤ک", "en": "Channel posts 24h"},
      "cl": {"fa": "کلاس زندهٔ امشب (دیسکورد، ۲۰:۰۰ تهران) تا", "ckb": "وانەی ڕاستەوخۆی ئەمشەو (دیسکۆرد، ٢٠:٠٠ تاران) تا",
             "en": "Tonight's live class (Discord, 20:00 Tehran) in"},
      "pd": {"fa": "روزهای گذشته ({n} روز ثبت‌شده)", "ckb": "ڕۆژانی ڕابردوو ({n} ڕۆژی تۆمارکراو)",
             "en": "Past days ({n} recorded)"},
      "hm": {"fa": "{h} ساعت {m} دقیقه", "ckb": "{h} کاتژمێر {m} خولەک", "en": "{h}h {m}min"}}


def _td(k, lg):
    return TD[k].get(lg) or TD[k]["fa"]


def count_recent(items, now, key, hours=24):
    """how many items have a timestamp `key` in (now - hours, now]; bad or missing timestamps are skipped"""
    lo, n = now - dt.timedelta(hours=hours), 0
    for x in items or []:
        try:
            t = R.parse_iso(x.get(key))
        except Exception:  # noqa: BLE001
            continue
        if t is not None and lo < t <= now:
            n += 1
    return n


def past_days(d):
    """number of recorded /today/ snapshots (keys YYYY-MM-DD); anything else counts as none"""
    if not isinstance(d, dict):
        return 0
    return sum(1 for k in d if isinstance(k, str) and len(k) == 10 and k[4] == "-" and k[7] == "-")


def class_wait(now):
    """minutes until the next 20:00 Tehran (16:30 UTC) class"""
    t = now.replace(hour=16, minute=30, second=0, microsecond=0)
    if t <= now:
        t += dt.timedelta(days=1)
    return int((t - now).total_seconds() // 60)


def sec_today(lang, now=None):
    lg = _lg(lang)
    now = now or dt.datetime.now(dt.timezone.utc)
    brain, fr = R.load("brain.json", {}) or {}, R.load("friction.json", {}) or {}
    rg, rf = brain.get("regime") or {}, brain.get("report_facts") or {}
    pc = BR.PCT.get(lg, "%")
    lines = []
    if rg:
        lines.append(f"• {_td('btc', lg)}: <b>{_n(rg.get('btc_chg24'), lg, 2, sign=True)}{pc}</b>")
        if rf.get("fng") is not None:
            lines.append(f"• {_td('fng', lg)}: {_n(rf.get('fng'), lg)}")
        br = rg.get("breadth") or {}
        if br.get("n"):
            lines.append(f"• {_td('brd', lg)}: {_n(br.get('up_pct'), lg)}{pc} / {_n(br.get('down_pct'), lg)}{pc}")
        mv = (brain.get("movers") or [])[:4]
        if mv:
            lines.append(f"• {_td('mov', lg)}: " + " · ".join(
                f"{m.get('coin', '')} {_n(m.get('chg24'), lg, 1, sign=True)}{pc}" for m in mv))
    if fr.get("score") is not None:
        lines.append(f"• {_td('fr', lg)}: {_n(fr.get('score'), lg, 1)} — {BR.s('lvl.' + (fr.get('level') or 'green'), lg)}")
        u = (fr.get("prices") or {}).get("usdt")
        if u:
            lines.append(f"• {_td('usdt', lg)}: {_n(u / 10, lg)}")
    if not lines:
        lines.append(BR.s("nodata", lg))
    scan = (R.load("scanlog.json", {}) or {}).get("items") or []
    posts = R.load("posts.json", []) or []
    w = class_wait(now)
    lines += ["", f"• {_td('sc', lg)}: {_n(count_recent(scan, now, 't'), lg)}",
              f"• {_td('po', lg)}: {_n(count_recent(posts, now, 'date'), lg)}",
              "", "🎓 " + _td("cl", lg) + " " + _td("hm", lg).format(h=_n(w // 60, lg), m=_n(w % 60, lg))]
    nd = past_days(R.load("today_days.json", {}))
    if nd >= 2:                          # one recorded day is just today: link the archive once there is a past
        lines += ["📅 " + _td("pd", lg).format(n=_n(nd, lg)) + ": " + SITE + "/today/days/"]
    return _head("☀️ " + _td("title", lg), lg, "/today/", lines, brain.get("updated_at"))


CL = {"title": {"fa": "کلاس شبانهٔ کوین کورد", "ckb": "وانەی شەوانەی کۆین کورد", "en": "The nightly Coin Kurd class"},
      "when": {"fa": "هر شب (به‌جز تعطیلات) ساعت ۲۰:۰۰ به وقت تهران در دیسکورد", "ckb": "هەموو شەوێک (جگە لە پشووەکان) کاتژمێر ٢٠:٠٠ بە کاتی تاران لە دیسکۆرد",
               "en": "Every night (except holidays) at 20:00 Tehran time on Discord"},
      "join": {"fa": "ورود", "ckb": "چوونەژوورەوە", "en": "Join"},
      "men": {"fa": "پست‌های ارجاع‌دهنده به کلاس", "ckb": "پۆستە ئاماژەدەرەکان بە وانە", "en": "Posts referring to the class"}}


def sec_class(lang, now=None):
    import class_facts as CF
    lg = _lg(lang)
    now = now or dt.datetime.now(dt.timezone.utc)
    f = CF.facts(R.load("posts.json", []) or [])
    w = class_wait(now)
    lines = ["• " + (CL["when"].get(lg) or CL["when"]["fa"]),
             "🎓 " + _td("cl", lg) + " " + _td("hm", lg).format(h=_n(w // 60, lg), m=_n(w % 60, lg))]
    if f["invite"]:
        lines.append(f"• {CL['join'].get(lg) or CL['join']['fa']}: {f['invite']}")
    else:
        lines.append(BR.s("nodata", lg))
    lines.append(f"• {CL['men'].get(lg) or CL['men']['fa']}: {_n(len(f['mentions']), lg)}")
    return _head("🎓 " + (CL["title"].get(lg) or CL["title"]["fa"]), lg, "/class/", lines, (f["source"] or {}).get("date"))


PC = {"title": {"fa": "پادکست روزانه بازار کریپتو", "ckb": "پۆدکاستی ڕۆژانەی بازاڕی کریپتۆ", "en": "Daily crypto podcast"},
      "when": {"fa": "هر روز ۱۹:۰۰ تهران در کانال، به فارسی، کوردی، انگلیسی و عربی", "ckb": "هەموو ڕۆژێک ١٩:٠٠ی تاران لە کەناڵ، بە فارسی، کوردی، ئینگلیزی و عەرەبی",
               "en": "Every day 19:00 Tehran on the channel, in Persian, Kurdish, English and Arabic"},
      "last": {"fa": "تازه‌ترین قسمت", "ckb": "نوێترین ئەڵقە", "en": "Latest episode"}}


def sec_podcast(lang, now=None):
    """the latest episode of the daily podcast (data/podcast/index.json, written by podcast.yml): title + link only"""
    lg = _lg(lang)
    eps = (R.load("podcast/index.json", {}) or {}).get("episodes") or []
    lines = ["• " + PC["when"][lg]]
    if eps:
        x = eps[0]
        t = x["titles"].get(lang) or x["titles"].get(lg) or x["titles"].get("fa") or next(iter(x["titles"].values()))
        lines.append(f"🎧 {PC['last'][lg]} ({_n(x['n'], lg)}): {html.escape(t)}")
        lines.append(f"{SITE}/podcast/{x['date']}/#{lang if lang in x['langs'] else 'fa'}")
    else:
        lines.append(BR.s("nodata", lg))
    return _head("🎙 " + PC["title"][lg], lg, "/podcast/", lines, eps[0]["date"] if eps else None)


# /tools/ calculators — a link list only (the bot has no calculators); ids are the cards' anchors on /tools/
TOOLS = [
    ("risk", {"fa": "حجم پوزیشن با کارمزد", "ckb": "قەبارەی پۆزیشن بە کرێ", "en": "Position size incl. fees"}),
    ("ladder", {"fa": "پله‌های حد سود (TP1-3)", "ckb": "پلەکانی قازانج (TP1-3)", "en": "Take-profit ladder (TP1-3)"}),
    ("average", {"fa": "میانگین قیمت خرید پله‌ای", "ckb": "تێکڕای نرخی کڕینی پلە بە پلە", "en": "Average entry of scaled buys"}),
    ("funding", {"fa": "هزینهٔ فاندینگ فیوچرز", "ckb": "تێچووی فاندینگی فیوچەرز", "en": "Futures funding cost"}),
    ("pnl", {"fa": "سود و ضرر فیوچرز (ROE)", "ckb": "قازانج و زیانی فیوچەرز (ROE)", "en": "Futures PnL & ROE"}),
    ("breakeven", {"fa": "درصد برد لازم برای سربه‌سر", "ckb": "ڕێژەی بردنەوەی پێویست بۆ یەکسانبوون", "en": "Break-even win rate"}),
    ("noise", {"fa": "حد ضرر در برابر نوسان عادی", "ckb": "ستۆپ بەرامبەر جووڵەی ئاسایی", "en": "Stop vs normal volatility"}),
    ("mcap", {"fa": "واقعیت‌سنجی قیمت هدف (مارکت‌کپ)", "ckb": "پشکنینی ڕاستیی نرخی ئامانج", "en": "Target-price reality check (market cap)"}),
    ("slip", {"fa": "لغزش سفارش مارکت (عمق دفتر)", "ckb": "خزانی فەرمانی مارکێت (قووڵیی دەفتەر)", "en": "Market-order slippage (book depth)"}),
    ("peg", {"fa": "پایداری استیبل‌کوین‌ها (پگ)", "ckb": "جێگیریی ستەیبڵکۆینەکان (پێگ)", "en": "Stablecoin peg check"}),
    ("liq", {"fa": "قیمت لیکویید شدن فیوچرز", "ckb": "نرخی لیکویدبوونی فیوچەرز", "en": "Futures liquidation price"}),
    ("recovery", {"fa": "سود لازم برای جبران ضرر", "ckb": "قازانجی پێویست بۆ قەرەبووی زیان", "en": "Gain needed to recover a loss"}),
    ("streaks", {"fa": "شبیه‌ساز زنجیرهٔ ضرر و افت سرمایه", "ckb": "هاوشێوەکەری زنجیرەی زیان و دابەزین", "en": "Losing-streak & drawdown simulator"}),
    ("compare", {"fa": "مقایسهٔ بازده کوین‌ها", "ckb": "بەراوردی گەڕانەوەی دراوەکان", "en": "Compare coin returns"}),
    ("whatif", {"fa": "اگر آن روز خریده بودم", "ckb": "ئەگەر ئەو ڕۆژە کڕیبام", "en": "What if I had bought"}),
    ("sessions", {"fa": "ساعت بازارهای جهانی و فاندینگ", "ckb": "کاتژمێری بازاڕە جیهانییەکان و فاندینگ", "en": "World market hours & funding"}),
    ("addr", {"fa": "بررسی آدرس و شبکه قبل از ارسال", "ckb": "پشکنینی ناونیشان و تۆڕ پێش ناردن", "en": "Check address & network before sending"}),
    ("fx", {"fa": "تبدیل ارز", "ckb": "گۆڕینی دراو", "en": "Currency converter"}),
]
DCA_T = {"fa": "شبیه‌ساز DCA در برابر خرید یکجا (قیمت واقعی، همهٔ تاریخ‌های شروع)",
         "ckb": "هاوشێوەکەری DCA بەرامبەر کڕینی یەکجار (نرخی ڕاستەقینە، هەموو بەروارەکانی دەستپێک)",
         "en": "DCA vs lump sum simulator (real prices, every start date)"}
TOOLS_T = {"fa": "ماشین‌حساب‌های معامله‌گر", "ckb": "ژمێرەرەکانی بازرگان", "en": "Trader calculators"}
TOOLS_N = {"fa": "محاسبه روی سایت و در مرورگر خودتان انجام می‌شود؛ توصیهٔ مالی نیست.",
           "ckb": "ژماردن لە ماڵپەڕ و لە وێبگەڕی خۆت دەکرێت؛ ئامۆژگاری دارایی نییە.",
           "en": "Runs on the site, in your own browser; not financial advice."}


def sec_tools(lang):
    lg = lang if lang in ("fa", "ckb", "en") else ("en" if _lg(lang) == "en" else "fa")
    lines = [f"• {t.get(lg) or t['fa']}: {SITE}/tools/#{k}" for k, t in TOOLS]
    lines.append(f"• {DCA_T[lg]}: {SITE}/dca/")
    lines += ["", TOOLS_N[lg]]
    return _head("🧮 " + TOOLS_T[lg], lg, "/tools/", lines)


# ------------------------------------------------------------------ quant: regime radar, truth lab, anomalies
def _q(k, lg, **kw):
    import build_quant as BQ
    return BQ.t(k, lg, **kw)


def sec_regime(lang):
    lg = _lg(lang)
    d = R.load("regime.json", {})
    now = d.get("now") or {}
    if not now:
        return _nodata("🧭 " + _q("rg.title", lg), lg, "/regime/")
    pr = now.get("probs") or {}
    rn = ((d.get("rule") or {}).get("now")) or {}
    lines = []
    if rn.get("label"):
        lines += [f"📐 <b>{_q('rr.title', lg)}</b>", f"• <b>{_q(rn['label'], lg)}</b> — {_q('rr.score', lg)} {_n(rn.get('score'), lg, 2, sign=bool(rn.get('score')))}"]
        pe = rn.get("pending") or {}
        if pe.get("to"):
            lines.append("• ⏳ " + _q("rr.pend", lg, to=_q(pe["to"], lg), d=_n(pe["days"], lg), n=_n(pe["need"], lg)))
        lines += [f"  {_q('rr.' + x['k'], lg)}: {'—' if x['v'] is None else _n(x['v'], lg, 3 if x['k'] == 'mayer' else 1)}"
                  f" ({'+1' if x['vote'] == 1 else '−1' if x['vote'] == -1 else '0' if x['vote'] == 0 else '—'})" for x in rn.get("dims") or []]
        rs = (R.load("regime_strats.json", {}).get("by") or {}).get(rn["label"]) or {}
        if rs.get("fam"):
            fams = R.load("regime_strats.json", {}).get("families") or {}
            ix = {"fa": 0, "ckb": 1, "en": 2}.get(lg, 2)
            ic = {"works": "✅", "hurts": "❌", "unclear": "⚪️"}
            lines += ["", f"🧪 <b>{_q('rs.title', lg)}</b> ({_q(rn['label'], lg)}{'، ' if lg in ('fa', 'ckb') else ', '}{_q('rs.days', lg, n=_n(rs.get('days'), lg))})"]
            for k in ("trend", "dip", "short", "hold"):
                x = rs["fam"].get(k)
                if x:
                    a = 0 if abs(x["ann"]) < 0.5 else x["ann"]
                    lines.append(f"{ic.get(x['verdict'], '⚪️')} {((fams.get(k) or {}).get('n') or [k] * 3)[ix]}: "
                                 f"{_n(a, lg, 0, sign=a != 0, pct=True)}{ {'fa': ' سالانه', 'ckb': ' ساڵانە'}.get(lg, '/yr')} — {_q('rs.' + x['verdict'], lg)}")
            lines.append("🔗 entekhab.net/regime/#strategies")
            lines.append("")
        lines += ["", f"🎲 <b>{_q('rf.hmm', lg)}</b>"]
    lines += [f"• <b>{_q(now['top'], lg)}</b> — {_q('rg.conf', lg)} {_n(100 * now['confidence'], lg, 1, pct=True)}",
             f"• {_q('rg.switch', lg)}: {_n(100 * now['switch_risk'], lg, 1, pct=True)}",
             f"• {_n(now.get('days_in'), lg)} {_q('rg.days', lg)}"]
    st = (d.get("states") or {}).get(now["top"]) or {}
    if st.get("mean_days"):
        lines.append("• " + _q("rg.typ", lg, n=_n(st["mean_days"], lg, 1)))
    row = (d.get("trans") or {}).get(now["top"]) or {}
    oth = sorted(((k, v) for k, v in row.items() if k != now["top"]), key=lambda kv: -kv[1])
    if oth:
        lines.append("• " + _q("rg.goes", lg, to=_q(oth[0][0], lg), p=_n(100 * oth[0][1], lg, 1, pct=True)))
    lines.append("")
    for k in ("bull", "bear", "sideways", "high_vol"):
        lines.append(f"  {_q(k, lg)}: {_n(100 * pr.get(k, 0), lg, 1, pct=True)}")
    sel = d.get("select") or {}
    if sel.get("rule") == "no_info":
        lines += ["", "🔢 " + {"fa": f"مدل {_n(sel.get('chosen'), lg)} حالته؛ با هیچ تعداد حالتی، رژیم HMM بازده ماه بعد را بیش از شانس توضیح نمی‌دهد (توصیف حال است، نه پیش‌بینی).",
                                "ckb": f"مۆدێلەکە {_n(sel.get('chosen'), lg)} حاڵەتییە؛ بە هیچ ژمارەیەکی حاڵەت دۆخی HMM قازانجی مانگی داهاتوو زیاتر لە هەڵکەوت ڕوون ناکاتەوە (وەسفی ئێستایە، نەک پێشبینی).",
                                "en": f"The model uses {sel.get('chosen')} states; with no number of states does the HMM regime explain next month's return beyond chance (it describes the present, not the future)."}.get(lg, "")]
    elif sel.get("chosen"):
        lines += ["", "🔢 " + _q("ks.gain", lg, k=_n(sel.get("chosen"), lg))]
    return _head("🧭 " + _q("rg.title", lg), lg, "/regime/", lines, d.get("updated_at"))


def sec_truth(lang):
    lg = _lg(lang)
    d = R.load("truth.json", {})
    pats = ((d.get("scanner") or {}).get("patterns")) or {}
    if not pats:
        return _nodata("⚖️ " + _q("tr.title", lg), lg, "/truth/")
    import build_quant as BQ
    c = d.get("cost") or {}
    lines = [_q("tr.cost", lg, f=_n(c.get("fee_side"), lg, 2), s=_n(c.get("slip_side"), lg, 2), c=_n(c.get("round_trip"), lg, 2)), ""]
    mark = {"edge_strong": "✅", "edge": "✅", "maybe": "🟡", "no_edge": "⚪️", "loses": "❌", "too_few": "⏳"}
    mh = (d.get("rules") or {}).get("main_h", "24h")
    for k, r in sorted(((k, r) for k, r in pats.items() if k != "_all"),
                       key=lambda kv: -((kv[1]["bt"].get(mh) or {}).get("net") or -99)):
        cell = (r["live"] if r.get("basis") == "live" else r["bt"]).get(mh) or {}
        lines.append(f"{mark.get(r['verdict'], '•')} {BQ.pname(k, lg)}: {_q('v.' + r['verdict'], lg)} "
                     f"({_n(cell.get('net'), lg, 2, sign=True, pct=True)})")
    cal = (d.get("calibration") or {}).get("scanner") or {}
    if cal:
        lines += ["", f"• Brier {_n(cal.get('brier'), lg, 3)} / {_n(cal.get('brier_base'), lg, 3)} · "
                      f"{_q('tr.skill', lg)} {_n(100 * (cal.get('skill') or 0), lg, 1, sign=True, pct=True)}"]
    return _head("⚖️ " + _q("tr.title", lg), lg, "/truth/", lines, d.get("updated_at"))


def sec_anomaly(lang):
    lg = _lg(lang)
    d = R.load("anomaly.json", {})
    today = d.get("today") or []
    if not today:
        return _nodata("🔎 " + _q("an.title", lg), lg, "/anomalies/")
    fl = [r for r in today if r.get("flags")]
    lines = [f"• {_q('an.today', lg)} · {BR.fdate(d.get('day'), lg)}"]
    if fl:
        for r in fl[:8]:
            lines.append(f"  <b>{r['coin']}</b> ({_n(r.get('ret'), lg, 2, sign=True, pct=True)}): "
                         + (", " if lg == "en" else "، ").join(_q('f.' + f, lg) for f in r["flags"]))
    else:
        lines.append("  " + _q("an.none", lg))
    hot = (d.get("now") or {}).get("hot") or []
    if hot:
        lines += ["", f"• {_q('an.now', lg)}: " + " · ".join(f"{x['coin']} z {_n(x.get('vol_z'), lg, 1)}" for x in hot[:6])]
    return _head("🔎 " + _q("an.title", lg), lg, "/anomalies/", lines, d.get("updated_at"))



def sec_stratlab(lang):
    lg = _lg(lang)
    import build_strategy_lab as SL
    lines = [SL.T["desc"][lg], "", SL.T["local"][lg], "",
             {"fa": "نمونه‌های آماده: خرید اصلاح در روند صعودی · تقاطع طلایی ۵۰/۲۰۰ · شکست سقف ۲۰ روزه با حجم · خرید در ترس شدید · روند فقط در رژیم صعودی · شورت اشباع خرید ۴ ساعته",
              "ckb": "نموونە ئامادەکان: کڕینی داکەوتن لە ڕەوتی بەرزدا · یەکتربڕینی زێڕین ٥٠/٢٠٠ · شکاندنی لوتکەی ٢٠ ڕۆژە · کڕین لە ترسی زۆردا",
              "en": "Ready-made examples: buy the dip in an uptrend · golden cross 50/200 · 20-day breakout with volume · buy extreme fear · trend only in a bull regime · 4h overbought short"}[lg]]
    return _head("🧪 " + SL.T["title"][lg], lg, "/strategy-lab/", lines, None)

SECTIONS = {"tools": (sec_tools, "/tools/"), "today": (sec_today, "/today/"), "podcast": (sec_podcast, "/podcast/"), "class": (sec_class, "/class/"), "trackrec": (sec_trackrec, "/track-record/"), "friction": (sec_friction, "/iran-friction/"), "hype2": (sec_hype, "/hype/"),
            "sentim": (sec_sentiment, "/sentiment/"), "whales": (sec_whales, "/whales/"),
            "silent": (sec_silent, "/silent-exit/"), "corr": (sec_corr, "/iran-correlation/"),
            "ledger": (sec_ledger, "/ledger/"), "oppcost": (sec_opportunity, "/opportunity/"),
            "truth": (sec_truth, "/truth/"), "stratlab": (sec_stratlab, "/strategy-lab/"), "regime": (sec_regime, "/regime/"), "anomaly": (sec_anomaly, "/anomalies/")}
