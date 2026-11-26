#!/usr/bin/env python3
"""Builds /trader/ — «مسیر تریدر»: a hub and one page per level (beginner, intermediate, pro, super-pro).

Owner's brief (2026-11-26): each level in its own words and with its own checks, all ending at the same answer: where to
enter, with what risk and to what target. Free for everyone. The text lives in scripts/trader_data.py, the plan sheet,
the ticks, the quiz and the "today" strip in assets/trader/trader.js (+ trader.css). The pages are shells over the
site's existing tools: every check links to the page that does that check. Run after build_pages.py.

Output (git-ignored, rebuilt by CI): trader/index.html, trader/<level>/index.html. Test: python3 tests/test_trader.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
import chrome  # noqa: E402
import trader_data as D  # noqa: E402

e = BP.e
VER = "1"
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


# ------------------------------------------------------------------ hub
def hub_block(lg):
    cards = []
    for k in D.LEVELS:
        v = D.LV[k]
        cards.append(f"<a class='rc-card tr-lvl tr-{k}' href='/trader/{k}/' data-name='{e(v['name'][lg])}'>"
                     f"<span class='tr-ic' aria-hidden='true'>{v['icon']}</span><h3>{e(v['name'][lg])}</h3>"
                     f"<p class='tr-who'>{e(v['who'][lg])}</p><p>{e(v['card'][lg])}</p>"
                     f"<span class='tr-go'>{e(D.HUB['open'][lg])} {arrow(lg)}</span></a>")
    qs = []
    for i, (q, ans) in enumerate(D.QUIZ):
        opts = "".join(f"<label><input type='radio' name='q{i}-{lg}' value='{j}'> {e(a[lg])}</label>" for j, a in enumerate(ans))
        qs.append(f"<fieldset class='tr-q'><legend>{i + 1}. {e(q[lg])}</legend>{opts}</fieldset>")
    quiz = (f"<section class='rc-sec tr-quiz' data-cut='{','.join(map(str, D.QUIZ_CUT))}'><h2>{e(D.HUB['quiz'][lg])}</h2>"
            f"<p class='note'>{e(D.HUB['quiz_p'][lg])}</p>{''.join(qs)}"
            f"<button type='button' class='tr-qgo'>{e(D.QUIZ_TXT['go'][lg])}</button>"
            f"<div class='tr-qres' aria-live='polite' data-res='{e(D.QUIZ_TXT['res'][lg])}' data-need='{e(D.QUIZ_TXT['need'][lg])}'></div></section>")
    return (crumbs(lg) + f"<h1>{e(D.HUB['title'][lg])}</h1><p class='rc-lead'>{e(D.HUB['lead'][lg])}</p>"
            f"<section class='rc-sec'><h2>{e(D.HUB['pick'][lg])}</h2><div class='rc-grid tr-cards'>{''.join(cards)}</div></section>"
            f"<section class='rc-sec'><h2>{e(D.HUB['same'][lg])}</h2><p class='rc-lead'>{e(D.HUB['same_p'][lg])}</p></section>"
            + quiz + f"<h2 class='tr-today-h'>{e(D.HUB['today'][lg])}</h2>")


def hub():
    body = BR.tri(hub_block) + "<div id='tr-today' class='tr-today'><p class='mut'>…</p></div>" + BR.tri(foot) + f"<script>{BR.LANG_JS}</script>" + SCRIPT
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
                f"<h2 class='tr-today-h'>{e(D.HUB['today'][lg])}</h2>")
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
        return (f"<section class='rc-sec'><h2>{e(D.SEC['mistakes'][lg])}</h2><ul class='tr-mis'>{mis}</ul></section>"
                f"<section class='rc-sec'><h2>{e(D.SEC['words'][lg])}</h2><dl class='tr-words'>{words}</dl></section>"
                f"<section class='rc-sec'><h2>{e(D.SEC['next'][lg])}</h2><p class='rc-lead'>{e(v['next'][lg])}</p><p>{nl}</p></section>"
                f"<section class='rc-sec'><h2>{e(D.SEC['levels'][lg])}</h2>{pills(lg, k)}<p><a href='/trader/'>{e(D.HUB['title'][lg])}</a></p></section>"
                + foot(lg))
    return b


def level(k):
    v = D.LV[k]
    plan = (f"<div id='tr-plan' class='tr-plan rc-card' data-level='{k}' data-fields='{' '.join(v['plan'])}'>"
            "<p class='mut'>…</p><noscript>JavaScript</noscript></div>")
    body = (f"<div data-tr-level='{k}' hidden></div>" + BR.tri(level_top(k)) + "<div id='tr-today' class='tr-today'><p class='mut'>…</p></div>"
            + BR.tri(level_checks(k)) + plan + BR.tri(level_rest(k)) + f"<script>{BR.LANG_JS}</script>" + SCRIPT)
    url = f"{SITE}/{path(k)}"
    title_fa = f"{v['name']['fa']}: کجا وارد شوم، با چه ریسکی، تا کجا؟ — مسیر تریدر"
    desc_fa = f"{v['who']['fa']} {v['card']['fa']}"
    ld = {"@context": "https://schema.org", "@type": "LearningResource", "name": f"{v['name']['en']} — {D.HUB['title']['en']}",
          "description": v["card"]["en"], "url": url, "educationalLevel": v["name"]["en"], "inLanguage": list(LANGS),
          "isAccessibleForFree": True, "learningResourceType": "Checklist and calculator",
          "isPartOf": {"@type": "CollectionPage", "url": f"{SITE}/{path()}"}}
    extra = f"<style>{BR.RCSS}</style>{HEAD}<script type='application/ld+json'>{BP.sj(ld)}</script>"
    return BP.page(path(k), title_fa, desc_fa, body, extra)


def main():
    urls = [hub()] + [level(k) for k in D.LEVELS]
    BR.add_to_sitemap(urls)
    print("trader:", len(urls), "pages")
    return urls


if __name__ == "__main__":
    main()
