#!/usr/bin/env python3
"""Builds /trader/ — «مسیر تریدر»: a hub and one page per level (beginner, intermediate, pro, super-pro).

Owner's brief (2026-11-26): each level in its own words and with its own checks, all ending at the same answer: where to
enter, with what risk and to what target; then (same day) give the trader the whole position, not questions, and only
when its accuracy is high. Free for everyone. The text lives in scripts/trader_data.py and scripts/trader_more.py, the
position cards, the record and the "today" strip in scripts/trader_pos.py (data: trader/setups.json, made here by
scripts/trader_setups.py from Binance candles), the plan sheet and the ticks in assets/trader/trader.js (+ trader.css).
Every check links to the page that does that check. Run after build_pages.py.

Setups: by default this script runs the replay (network). TRADER_SETUPS=<file> uses a saved result instead (tests),
TRADER_SETUPS=off skips it (the page then says the data is not available, never a made-up position).

Output (git-ignored, rebuilt by CI): trader/index.html, trader/<level>/index.html. Test: python3 tests/test_trader.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import json  # noqa: E402
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
import chrome  # noqa: E402
import trader_data as D  # noqa: E402
import trader_more as M  # noqa: E402
import trader_pos as P  # noqa: E402
from trader_data import L  # noqa: E402

e = BP.e
VER = "2"
SITE = "https://entekhab.net"
LANGS = BR.LANGS            # fa, ckb, en (Arabic visitors get the site's own ar layer)
HEAD = (f"<link rel='stylesheet' href='/assets/trader/trader.css?v={VER}'>")
SCRIPT = f"<script src='/assets/trader/trader.js?v={VER}' defer></script>"


def nav_titles():
    """path → its menu title (L), so a link to an existing page reads exactly as the menu names it"""
    out = {}
    for c in chrome.NAV:
        for h, _ic, t, _d in c["items"]:
            out[h] = t
    return out


NAVT = nav_titles()


def path(level=None):
    return "trader/" + (f"{level}/" if level else "")


def link_label(h, lab, lg):
    if lab:
        return lab[lg]
    t = NAVT.get(h) or NAVT.get(h.split("#")[0])
    if not t:
        raise KeyError(f"trader: no label for {h}")
    return t[lg]


def arrow(lg):
    return "→" if lg == "en" else "←"


def crumbs(lg, level=None):
    hub = D.HUB["title"][lg].split(":")[0]
    tail = f" / <a href='/trader/'>{e(hub)}</a> / {e(D.LV[level]['name'][lg])}" if level else f" / {e(hub)}"
    return f"<div class='meta'><a href='/'>{e(D.HUB['home'][lg])}</a>{tail}</div>"


def pills(lg, cur=None):
    out = []
    for k in D.LEVELS:
        v = D.LV[k]
        on = " on" if k == cur else ""
        cur_attr = " aria-current='page'" if k == cur else ""
        out.append(f"<a class='tr-pill tr-{k}{on}' href='/trader/{k}/'{cur_attr}><span aria-hidden='true'>{v['icon']}</span> {e(v['name'][lg])}</a>")
    return f"<nav class='tr-pills' aria-label='{e(D.SEC['levels'][lg])}'>{''.join(out)}</nav>"


def foot(lg):
    return (f"<section class='rc-sec tr-free'><p>🌳 {e(D.HUB['free'][lg])}</p></section>"
            f"<p class='note'>{e(D.HUB['nfa'][lg])}</p>")


# ------------------------------------------------------------------ setups
def get_setups():
    """the replay's result (trader/setups.json), or None when it could not be made"""
    src = os.environ.get("TRADER_SETUPS", "")
    if src == "off":
        return None
    if src:
        return P.load_json(src)
    try:
        import trader_setups as TS
        res = TS.run()
        if not res.get("coins"):
            print("trader: setups replay returned no coins", res.get("errors"))
            return None
        os.makedirs(TS.OUT_DIR, exist_ok=True)
        with open(TS.OUT, "w", encoding="utf-8") as fh:
            json.dump(res, fh, ensure_ascii=False, separators=(",", ":"))
        print(f"trader: setups {len(res['setups'])}, fired-not-passing {len(res['watch'])}, coins {len(res['coins'])}")
        return res
    except Exception as ex:  # noqa: BLE001
        print("trader: setups replay failed:", str(ex)[:200])
        return None


S_ = {}


def setups():
    if "v" not in S_:
        S_["v"] = get_setups()
    return S_["v"]


# section titles added with the positions (2026-11-26)
SEC2 = {
    "manage": L("وقتی در معامله‌ای", "کاتێک لە مامەڵەدایت", "While you're in the trade"),
    "after": L("بعد از بسته شدن معامله", "دوای داخرانی مامەڵە", "After the trade closes"),
    "faq": L("پرسش‌های این سطح", "پرسیارەکانی ئەم ئاستە", "Questions at this level"),
    "example": L("یک نمونهٔ ساختگی برای تمرین", "نموونەیەکی دروستکراو بۆ ڕاهێنان", "A made-up example to practise on"),
    "try": L("این نمونه را در برگهٔ برنامه امتحان کن", "ئەم نموونەیە لە پەڕەی پلاندا تاقی بکەرەوە", "Try this example in the plan sheet"),
    "tried": L("در برگهٔ برنامه گذاشته شد ↓", "خرایە ناو پەڕەی پلان ↓", "Added to the plan sheet ↓"),
}


# ------------------------------------------------------------------ hub
def hub_block(lg):
    cards = []
    for k in D.LEVELS:
        v = D.LV[k]
        cards.append(f"<a class='rc-card tr-lvl tr-{k}' href='/trader/{k}/' data-name='{e(v['name'][lg])}'>"
                     f"<span class='tr-ic' aria-hidden='true'>{v['icon']}</span><h3>{e(v['name'][lg])}</h3>"
                     f"<p class='tr-who'>{e(v['who'][lg])}</p><p>{e(v['card'][lg])}</p>"
                     f"<span class='tr-go'>{e(D.HUB['open'][lg])} {arrow(lg)}</span></a>")
    S = setups()
    return (crumbs(lg) + f"<h1>{e(D.HUB['title'][lg])}</h1><p class='rc-lead'>{e(D.HUB['lead'][lg])}</p>"
            + P.positions(S, lg, "pro", load=False) + P.today(lg)
            + f"<section class='rc-sec'><h2>{e(D.HUB['pick'][lg])}</h2><div class='rc-grid tr-cards'>{''.join(cards)}</div></section>"
            f"<section class='rc-sec'><h2>{e(D.HUB['same'][lg])}</h2><p class='rc-lead'>{e(D.HUB['same_p'][lg])}</p></section>"
            + P.record(S, lg) + foot(lg))


def hub():
    body = BR.tri(hub_block) + f"<script>{BR.LANG_JS}</script>" + SCRIPT
    url = f"{SITE}/{path()}"
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": D.HUB["title"]["en"], "description": D.HUB["desc"]["en"],
          "url": url, "inLanguage": list(LANGS), "isAccessibleForFree": True,
          "hasPart": [{"@type": "LearningResource", "name": D.LV[k]["name"]["en"], "url": f"{SITE}/{path(k)}",
                       "educationalLevel": D.LV[k]["name"]["en"], "isAccessibleForFree": True} for k in D.LEVELS]}
    extra = f"<style>{BR.RCSS}</style>{HEAD}<script type='application/ld+json'>{BP.sj(ld)}</script>"
    return BP.page(path(), D.HUB["title"]["fa"], D.HUB["desc"]["fa"], body, extra)


# ------------------------------------------------------------------ one level
def level_top(k):
    v = D.LV[k]

    def b(lg):
        return (crumbs(lg, k) + pills(lg, k) + f"<h1><span aria-hidden='true'>{v['icon']}</span> {e(v['name'][lg])}</h1>"
                f"<p class='tr-who'><b>{e(D.SEC['who'][lg])}</b> {e(v['who'][lg])}</p><p class='rc-lead'>{e(v['intro'][lg])}</p>"
                + P.positions(setups(), lg, k, load=True) + P.today(lg, k, M.TODAY))
    return b


def level_checks(k):
    v = D.LV[k]

    def b(lg):
        items = []
        for i, (tt, why, links) in enumerate(v["checks"]):
            ln = " · ".join(f"<a href='{e(h)}'>{e(link_label(h, lab, lg))}</a>" for h, lab in links) if links else \
                f"<a href='#tr-plan'>{e(D.SEC['plan'][lg])} ↓</a>"
            cid = f"tr-c{i}-{lg}"
            items.append(f"<li class='tr-ck'><input type='checkbox' class='tr-chk' id='{cid}' data-k='c{i}'>"
                         f"<div><label for='{cid}'><b>{e(tt[lg])}</b></label><p>{e(why[lg])}</p><p class='tr-lk'>{ln}</p></div></li>")
        return (f"<section class='rc-sec'><h2>{e(D.SEC['checks'][lg])}</h2><p class='note'>{e(D.SEC['checks_p'][lg])}</p>"
                f"<ol class='tr-cks'>{''.join(items)}</ol></section>"
                f"<h2 id='tr-plan-h-{lg}'>{e(D.SEC['plan'][lg])}</h2><p class='note'>{e(D.SEC['plan_p'][lg])}</p>")
    return b


def level_rest(k):
    v = D.LV[k]
    i = D.LEVELS.index(k)

    def b(lg):
        mis = "".join(f"<li>{e(x[lg])}</li>" for x in v["mistakes"])
        words = "".join(f"<div><dt>{e(a[lg])}</dt><dd>{e(d[lg])}</dd></div>" for a, d in v["words"])
        nxt = D.LEVELS[i + 1] if i + 1 < len(D.LEVELS) else None
        nl = f" <a class='tr-pill tr-{nxt}' href='/trader/{nxt}/'>{D.LV[nxt]['icon']} {e(D.LV[nxt]['name'][lg])} {arrow(lg)}</a>" if nxt else ""
        man = "".join(f"<li><b>{e(t[lg])}</b><p>{e(x[lg])}</p></li>" for t, x in M.MANAGE.get(k, []))
        aft = "".join(f"<li><b>{e(t[lg])}</b><p>{e(x[lg])}</p></li>" for t, x in M.AFTER.get(k, []))
        faq = "".join(f"<details class='tr-faq'><summary>{e(q[lg])}</summary><p>{e(a[lg])}</p></details>" for q, a in M.FAQ.get(k, []))
        ex = M.EXAMPLE.get(k)
        exh = ""
        if ex:
            exh = (f"<section class='rc-sec'><h2>{e(SEC2['example'][lg])}</h2><p>{e(ex['story'][lg])}</p>"
                   f"<p><button type='button' class='rc-btn2 tr-load' data-plan='{e(json.dumps(ex['inputs']))}' data-done='{e(SEC2['tried'][lg])}'>"
                   f"{e(SEC2['try'][lg])}</button></p></section>")
        return ((f"<section class='rc-sec'><h2>{e(SEC2['manage'][lg])}</h2><ul class='tr-man'>{man}</ul></section>" if man else "")
                + (f"<section class='rc-sec'><h2>{e(SEC2['after'][lg])}</h2><ul class='tr-man'>{aft}</ul></section>" if aft else "")
                + exh + (f"<section class='rc-sec'><h2>{e(SEC2['faq'][lg])}</h2>{faq}</section>" if faq else "")
                + f"<section class='rc-sec'><h2>{e(D.SEC['mistakes'][lg])}</h2><ul class='tr-mis'>{mis}</ul></section>"
                f"<section class='rc-sec'><h2>{e(D.SEC['words'][lg])}</h2><dl class='tr-words'>{words}</dl></section>"
                f"<section class='rc-sec'><h2>{e(D.SEC['next'][lg])}</h2><p class='rc-lead'>{e(v['next'][lg])}</p><p>{nl}</p></section>"
                f"<section class='rc-sec'><h2>{e(D.SEC['levels'][lg])}</h2>{pills(lg, k)}<p><a href='/trader/'>{e(D.HUB['title'][lg])}</a></p></section>"
                + foot(lg))
    return b


def level(k):
    v = D.LV[k]
    plan = (f"<div id='tr-plan' class='tr-plan rc-card' data-level='{k}' data-fields='{' '.join(v['plan'])}'>"
            "<noscript><p class='note'>JavaScript</p></noscript></div>")
    body = (f"<div data-tr-level='{k}' hidden></div>" + BR.tri(level_top(k))
            + BR.tri(level_checks(k)) + plan + BR.tri(level_rest(k)) + f"<script>{BR.LANG_JS}</script>" + SCRIPT)
    url = f"{SITE}/{path(k)}"
    title_fa = f"{v['name']['fa']}: کجا وارد شوم، با چه ریسکی، تا کجا؟ — مسیر تریدر"
    desc_fa = f"{v['who']['fa']} {v['card']['fa']}"
    ld = {"@context": "https://schema.org", "@type": "LearningResource", "name": f"{v['name']['en']} — {D.HUB['title']['en']}",
          "description": v["card"]["en"], "url": url, "educationalLevel": v["name"]["en"], "inLanguage": list(LANGS),
          "isAccessibleForFree": True, "learningResourceType": "Checklist and calculator",
          "isPartOf": {"@type": "CollectionPage", "url": f"{SITE}/{path()}"}}
    extra = f"<style>{BR.RCSS}</style>{HEAD}<script type='application/ld+json'>{BP.sj(ld)}</script>"
    if M.FAQ.get(k):
        fq = {"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": "fa",
              "mainEntity": [{"@type": "Question", "name": q["fa"], "acceptedAnswer": {"@type": "Answer", "text": a["fa"]}} for q, a in M.FAQ[k]]}
        extra += f"<script type='application/ld+json'>{BP.sj(fq)}</script>"
    return BP.page(path(k), title_fa, desc_fa, body, extra)


def main():
    urls = [hub()] + [level(k) for k in D.LEVELS]
    BR.add_to_sitemap(urls)
    print("trader:", len(urls), "pages")
    return urls


if __name__ == "__main__":
    main()
