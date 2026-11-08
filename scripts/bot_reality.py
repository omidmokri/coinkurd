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
        if key == "today":                   # a market brief, not a reality reading
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


SECTIONS = {"today": (sec_today, "/today/"), "class": (sec_class, "/class/"), "trackrec": (sec_trackrec, "/track-record/"), "friction": (sec_friction, "/iran-friction/"), "hype2": (sec_hype, "/hype/"),
            "sentim": (sec_sentiment, "/sentiment/"), "whales": (sec_whales, "/whales/"),
            "silent": (sec_silent, "/silent-exit/"), "corr": (sec_corr, "/iran-correlation/"),
            "ledger": (sec_ledger, "/ledger/"), "oppcost": (sec_opportunity, "/opportunity/")}
