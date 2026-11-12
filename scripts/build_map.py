# -*- coding: utf-8 -*-
"""/map/ — the learning map.

A graph of every topic the site teaches, and inside each topic a checklist of the
things you can actually read, run or practise right now: the academy's own lessons,
the sources those lessons cite, the glossary terms, the lab tools and the learning
path. Nothing here is new teaching material — the map is a view over what exists,
so it grows by itself as the academy grows.

Every internal link is checked against the built site before the page is written;
a link that does not resolve is dropped and reported, so the map never ships a
dead row.
"""
import hashlib
import os
import re
import sys
from urllib.parse import urlsplit

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_academy as BA          # noqa: E402
import build_pages as BP            # noqa: E402
import build_reality as BR          # noqa: E402
import learn_data as LD             # noqa: E402
import map_data as MD               # noqa: E402

ROOT = BP.ROOT
SITE = BP.SITE
e = BP.e
VER = "1"
ICON = {"les": "📘", "src": "🔗", "trm": "📖", "tol": "🧪", "pat": "🎓"}
missing = []


# ------------------------------------------------------------------ helpers
def tri(fa, ckb, en, tag="span", ltr_en=True):
    """the site's own three-language markup: one element per language, two hidden"""
    en_attr = ' dir="ltr"' if ltr_en else ""
    return (f'<{tag} data-lang="fa">{fa}</{tag}><{tag} data-lang="ckb" hidden>{ckb}</{tag}>'
            f'<{tag} data-lang="en" hidden{en_attr}>{en}</{tag}>')


def t3(key):
    return MD.UI[key]


def exists(url):
    """True when an internal url resolves in the built tree (hash and query ignored)"""
    p = urlsplit(url).path
    if not p.startswith("/"):
        return True                                  # external, left to the source data
    p = p.strip("/")
    if not p:
        return True
    for cand in (os.path.join(ROOT, p, "index.html"), os.path.join(ROOT, p)):
        if os.path.exists(cand):
            return True
    missing.append(url)
    return False


def dom(url):
    h = (urlsplit(url).netloc or "").lower()
    return h[4:] if h.startswith("www.") else h


def rid(kind, key):
    return kind + ":" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:10]


def srch(*parts):
    """one normalised haystack for the client-side search, all languages at once"""
    s = " ".join(str(x or "") for x in parts)
    s = re.sub(r"[‌-‏]", "", s).replace("ي", "ی").replace("ك", "ک")
    return s.lower()


FADIG = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
CKDIG = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def num3(n):
    return str(n).translate(FADIG), str(n).translate(CKDIG), str(n)


# ------------------------------------------------------------------ rows
def row(kind, ident, url, titles, metas, external=False):
    """one checklist line: a circle to tick, the title, and where it comes from"""
    t_fa, t_ckb, t_en = titles
    m_fa, m_ckb, m_en = metas
    hay = srch(t_fa, t_ckb, t_en, m_fa, m_en)
    tgt = ' target="_blank" rel="noopener nofollow"' if external else ""
    go = tri("باز کن ↗" if external else "باز کن →", "بکەرەوە ↗" if external else "بکەرەوە →",
             "Open ↗" if external else "Open →")
    return (f'<div class="mp-r" data-s="{e(hay)}">'
            f'<input type="checkbox" data-r="{e(ident)}" aria-label="{e(t_fa)}">'
            f'<span class="mp-tx"><a class="mp-tt" href="{e(url)}"{tgt}>'
            f'{tri(e(t_fa), e(t_ckb), e(t_en), "span", ltr_en=external)}</a>'
            f'<span class="mp-ms">{ICON[kind]} {tri(e(m_fa), e(m_ckb), e(m_en))}</span></span>'
            f'<a class="mp-go" href="{e(url)}"{tgt} tabindex="-1" aria-hidden="true">{go}</a></div>')


def section(key, inner, n):
    if not inner:
        return ""
    fa, ckb, en = t3(key)
    return (f'<section class="mp-sec"><h2>{tri(e(fa), e(ckb), e(en))}'
            f'<small><b>0/{n}</b></small></h2>{inner}</section>')


def faculty_rows(f):
    """(sections html, [resource ids]) for one faculty"""
    out, ids = [], []
    fid = f["id"]

    # ---- the academy's own lessons, grouped by course
    les, nles = [], 0
    for c in f["courses"]:
        if not c["lessons"]:
            continue
        ck = f"{fid}-{c['id']}"
        les.append(f'<p class="mp-sub" id="{e(c["id"])}">'
                   + tri(e(c["title"]), e(MD.CRS_CKB.get(ck) or c["title"]), e(c["en"])) + "</p>")
        for L in c["lessons"]:
            url = f"/academy/{fid}/{L['id']}/"
            if not exists(url):
                continue
            mn = num3(L["minutes"])
            lv = num3(L["level"])
            metas = (f'{mn[0]} {t3("min")[0]} · {t3("lv")[0]} {lv[0]}',
                     f'{mn[1]} {t3("min")[1]} · {t3("lv")[1]} {lv[1]}',
                     f'{mn[2]} {t3("min")[2]} · {t3("lv")[2]} {lv[2]}')
            les.append(row("les", L["id"], url,
                           (L["title"], MD.LES_CKB.get(L["id"]) or L["title"], L["en"]), metas))
            ids.append(L["id"])
            nles += 1
    out.append(section("s_les", "".join(les), nles))

    # ---- what those lessons cite: one row per distinct source
    seen, src, nsrc = set(), [], 0
    for L in f["lessons"]:
        for s in L.get("sources") or []:
            url = BP.su(s["u"])
            if url == "#" or url in seen:
                continue
            seen.add(url)
            d = dom(url) or "—"
            src.append(row("src", rid("s", url), url, (s["t"], s["t"], s["t"]), (d, d, d), external=True))
            ids.append(rid("s", url))
            nsrc += 1
    out.append(section("s_ext", "".join(src), nsrc))

    # ---- glossary terms of the matching groups
    trm, ntrm = [], 0
    for g in MD.GLOS.get(fid, []):
        gname = LD.GROUPS.get(g) or {}
        for slug, grp, fat, _fad, kt, _kd, et, _ed, _kw in LD.GLOSSARY:
            if grp != g:
                continue
            url = f"/glossary/{slug}/"
            if not exists(url):
                continue
            trm.append(row("trm", rid("g", slug), url, (fat, kt, et),
                           (gname.get("fa", ""), gname.get("ckb", ""), gname.get("en", ""))))
            ids.append(rid("g", slug))
            ntrm += 1
    out.append(section("s_trm", "".join(trm), ntrm))

    # ---- lab tools and site pages that let you practise the same thing
    tol, ntol = [], 0
    for url, fa_, ckb_, en_ in MD.TOOLS.get(fid, []):
        if not exists(url):
            continue
        tol.append(row("tol", rid("t", url), url, (fa_, ckb_, en_),
                       ("ابزار سایت", "ئامرازی ماڵپەر", "Tool on this site")))
        ids.append(rid("t", url))
        ntol += 1
    out.append(section("s_tol", "".join(tol), ntol))

    # ---- the matching step of the short learning path (with its quiz)
    pat, npat = [], 0
    lv = MD.PATH.get(fid)
    lvd = next((x for x in LD.LEVELS if x["id"] == lv), None)
    if lvd and exists("/learn/"):
        pat.append(row("pat", rid("p", lv), f"/learn/#{lv}", (lvd["fa"], lvd["ckb"], lvd["en"]),
                       ("مسیر یادگیری + آزمون", "ڕێڕەوی فێربوون + تاقیکردنەوە", "Learning path + quiz")))
        ids.append(rid("p", lv))
        npat += 1
    out.append(section("s_pat", "".join(pat), npat))

    return "".join(x for x in out if x), ids


# ------------------------------------------------------------------ pages
def ring():
    return ('<svg class="mp-ring" id="mpSvg" viewBox="0 0 64 64" aria-hidden="true">'
            '<circle class="bg" cx="32" cy="32" r="28"></circle>'
            '<circle class="fg" id="mpRing" cx="32" cy="32" r="28" stroke-dasharray="0 176" '
            'transform="rotate(-90 32 32)"></circle>'
            '<text id="mpRtx" x="32" y="33">0%</text></svg>')


HEAD = f'<link rel="stylesheet" href="/assets/map.css?v={VER}">'
FOOT = f'<script src="/assets/map.js?v={VER}" defer></script>'


def topic_page(f, prev_f, next_f):
    fid = f["id"]
    inner, ids = faculty_rows(f)
    ckb = MD.FAC_CKB.get(fid) or f["title"]
    sm = MD.FAC_SUM.get(fid) or (f["summary"], f["summary"])
    n = num3(len(ids))
    soon = ("" if f["lessons"] else
            f'<p class="mp-mini">⏳ {tri(*[e(x) for x in t3("soon")])}</p>')
    nav = '<nav class="mp-nav">'
    if prev_f:
        nav += (f'<a href="/map/{prev_f["id"]}/">← '
                + tri(e(prev_f["title"]), e(MD.FAC_CKB.get(prev_f["id"]) or prev_f["title"]), e(prev_f["en"]))
                + "</a>")
    nav += f'<a href="/map/">{tri(*[e(x) for x in t3("back")])}</a>'
    if next_f:
        nav += (f'<a href="/map/{next_f["id"]}/">'
                + tri(e(next_f["title"]), e(MD.FAC_CKB.get(next_f["id"]) or next_f["title"]), e(next_f["en"]))
                + " →</a>")
    nav += "</nav>"

    home = tri("خانه", "ماڵەوە", "Home")
    body = (f'<div class="meta"><a href="/">{home}</a> / <a href="/map/">'
            + tri(e(t3("t")[0]), e(t3("t")[1]), e(t3("t")[2])) + "</a> / "
            + tri(e(f["title"]), e(ckb), e(f["en"])) + "</div>"
            f'{BP.LSW}<div class="mp-top">{ring()}<div><h1>{f["icon"]} '
            + tri(e(f["title"]), e(ckb), e(f["en"]), "span") + "</h1>"
            f'<p class="mp-mini"><b id="mpCnt">0 / {len(ids)}</b> '
            + tri(e(t3("res")[0]) + " " + e(t3("done")[0]), e(t3("res")[1]) + " " + e(t3("done")[1]),
                  e(t3("res")[2]) + " " + e(t3("done")[2])) + "</p></div></div>"
            f'<p class="mp-lead">{tri(e(f["summary"]), e(sm[0]), e(sm[1]))}</p>{soon}'
            f'<div class="mp-bar"><input class="mp-q" id="mpFq" type="search" '
            f'placeholder="{e(t3("search")[0])}" autocomplete="off" '
            f'data-ph-fa="{e(t3("search")[0])}" data-ph-ckb="{e(t3("search")[1])}" '
            f'data-ph-en="{e(t3("search")[2])}">'
            f'<button class="mp-tg" id="mpReset" type="button">{tri(*[e(x) for x in t3("reset")])}</button></div>'
            f'<div id="mpList">{inner}</div>{nav}'
            f'<p class="note"><a href="/academy/{fid}/">🎓 '
            + tri(e(t3("fac")[0]), e(t3("fac")[1]), e(t3("fac")[2]))
            + f'</a> · {tri(*[e(x) for x in t3("note")])}</p>')

    title = f"{f['title']} — نقشهٔ یادگیری entekhab"
    desc = f["summary"][:155]
    return BP.page(f"map/{fid}/", title, desc, body,
                   HEAD + FOOT + f"<style>{BP.LEARN_CSS}</style>"
                   f"<script>document.addEventListener('DOMContentLoaded',function(){{{BP.LANG_JS}}})</script>"), ids


def hub_page(F, per):
    nodes, links, find = [], [], []
    clusters = {k: v[1] for k, v in MD.CLUSTERS.items()}
    for f in F:
        fid = f["id"]
        ckb = MD.FAC_CKB.get(fid) or f["title"]
        ids = per.get(fid, [])
        short = MD.FAC_SHORT.get(fid) or (f["title"], ckb, f["en"])
        nodes.append({"id": fid, "k": "f", "g": MD.CLUSTER.get(fid, "base"),
                      "t": list(short), "u": f"/map/{fid}/",
                      "live": bool(f["lessons"]), "rs": ids})
        find.append({"t": [f["title"], ckb, f["en"]], "u": f"/map/{fid}/",
                     "w": list(t3("fac"))})
        for c in f["courses"]:
            if not c["lessons"]:
                continue
            ck = f"{fid}-{c['id']}"
            cckb = MD.CRS_CKB.get(ck) or c["title"]
            nodes.append({"id": ck, "k": "c", "g": MD.CLUSTER.get(fid, "base"),
                          "t": [c["title"], cckb, c["en"]], "u": f"/map/{fid}/#{c['id']}",
                          "live": True, "rs": [L["id"] for L in c["lessons"]]})
            links.append([fid, ck, 86])
            for L in c["lessons"]:
                lckb = MD.LES_CKB.get(L["id"]) or L["title"]
                find.append({"t": [L["title"], lckb, L["en"]], "u": f"/academy/{fid}/{L['id']}/",
                             "w": [f["title"], ckb, f["en"]]})
    for slug, grp, fat, _fd, kt, _kd, et, _ed, _kw in LD.GLOSSARY:
        g = LD.GROUPS.get(grp) or {}
        find.append({"t": [fat, kt, et], "u": f"/glossary/{slug}/",
                     "w": [g.get("fa", ""), g.get("ckb", ""), g.get("en", "")]})
    # a ring of faculty-to-faculty edges so the clusters do not fly apart
    chain = [("f1", "f2"), ("f2", "f3"), ("f3", "f4"), ("f4", "f5"), ("f5", "f6"), ("f6", "f13"),
             ("f6", "f9"), ("f9", "f10"), ("f3", "f7"), ("f2", "f8"), ("f8", "f7"), ("f2", "f11"),
             ("f7", "f12"), ("f9", "f12"), ("f10", "f5"), ("f11", "f3"), ("f13", "f9")]
    have = {n["id"] for n in nodes}
    links += [[a, b, 230] for a, b in chain if a in have and b in have]

    cards = []
    for f in F:
        fid = f["id"]
        ids = per.get(fid, [])
        ckb = MD.FAC_CKB.get(fid) or f["title"]
        cl = MD.CLUSTERS.get(MD.CLUSTER.get(fid, "base"))
        n = num3(len(ids))
        cards.append(
            f'<a class="mp-card{"" if f["lessons"] else " soon"}" href="/map/{fid}/" '
            f'data-rs="{e(" ".join(ids))}" style="--c:{cl[1]}">'
            + ("" if f["lessons"] else '<span class="mp-soon">'
               + tri("در راه", "لە ڕێگادا", "soon") + "</span>")
            + f'<span class="mp-ic">{f["icon"]}</span>'
            + f"<h3>{tri(e(f['title']), e(ckb), e(f['en']))}</h3>"
            + "<p>" + tri(f'{n[0]} {e(t3("res")[0])} · {e(cl[0][0])}',
                          f'{n[1]} {e(t3("res")[1])} · {e(cl[0][1])}',
                          f'{n[2]} {e(t3("res")[2])} · {e(cl[0][2])}') + "</p>"
            + '<span class="mp-pb"><i></i></span></a>')

    legend = "".join(f'<span><i style="background:{v[1]}"></i>'
                     + tri(e(v[0][0]), e(v[0][1]), e(v[0][2])) + "</span>"
                     for v in MD.CLUSTERS.values())
    payload = {"nodes": nodes, "links": links, "find": find, "clusters": clusters,
               "nores": t3("nores")[0]}
    total = num3(sum(len(v) for v in per.values()))
    ntop = num3(len(nodes))

    body = (f'<div class="mp-hero"><h1>{tri(*[e(x) for x in t3("h1")])}</h1>{BP.LSW}'
            f'<p class="mp-lead">{tri(*[e(x) for x in t3("lead")])}</p>'
            f'<input class="mp-q" id="mpQ" type="search" placeholder="{e(t3("search")[0])}" '
            f'data-ph-fa="{e(t3("search")[0])}" data-ph-ckb="{e(t3("search")[1])}" '
            f'data-ph-en="{e(t3("search")[2])}" '
            f'autocomplete="off" aria-label="{e(t3("h1")[0])}"></div>'
            f'<div class="mp-res" id="mpRes" hidden></div>'
            f'<div class="mp-bar">'
            f'<span class="mp-hint">' + tri(f'{ntop[0]} {e(t3("topics")[0])}', f'{ntop[1]} {e(t3("topics")[1])}',
                                              f'{ntop[2]} {e(t3("topics")[2])}') + "</span>"
            f'<span class="mp-hint">' + tri(f'{total[0]} {e(t3("res")[0])}', f'{total[1]} {e(t3("res")[1])}',
                                            f'{total[2]} {e(t3("res")[2])}') + "</span></div>"
            f'<div class="mp-wrap" id="mpWrap"><canvas id="mpCv" role="img" '
            f'aria-label="{e(t3("t")[0])}"></canvas><div class="mp-legend">{legend}</div></div>'
            f'<h2 class="mp-h2">{tri(*[e(x) for x in t3("all")])}</h2>'
            f'<div class="mp-grid" id="mpGrid">{"".join(cards)}</div>'
            f'<p class="note">{tri(*[e(x) for x in t3("note")])}</p>'
            f'<script type="application/json" id="mpData">{BP.sj(payload)}</script>')

    ld = {"@context": "https://schema.org", "@type": "Course", "name": t3("t")[0],
          "description": t3("hubnote")[0], "url": f"{SITE}/map/",
          "inLanguage": ["fa", "ckb", "en"], "isAccessibleForFree": True,
          "provider": {"@type": "Organization", "name": "entekhab.net", "url": SITE},
          "hasPart": [{"@type": "Course", "name": f["title"], "url": f"{SITE}/map/{f['id']}/",
                       "description": f["summary"][:200],
                       "provider": {"@type": "Organization", "name": "entekhab.net"}} for f in F]}
    return BP.page("map/", "نقشهٔ یادگیری کریپتو — هر چیزی که باید بلد باشید، روی یک نقشه",
                   t3("hubnote")[0], body,
                   HEAD + FOOT + f"<style>{BP.LEARN_CSS}</style>"
                   f'<script type="application/ld+json">{BP.sj(ld)}</script>'
                   f"<script>document.addEventListener('DOMContentLoaded',function(){{{BP.LANG_JS}}})</script>")


def data_file(F, per):
    """data/map.json — the same topic list the bot and the app read, so they never drift"""
    out = {"topics": [], "total": sum(len(v) for v in per.values())}
    for f in F:
        fid = f["id"]
        out["topics"].append({
            "id": fid, "icon": f["icon"], "n": len(per.get(fid, [])),
            "lessons": len(f["lessons"]), "live": bool(f["lessons"]),
            "url": f"/map/{fid}/",
            "t": {"fa": f["title"], "ckb": MD.FAC_CKB.get(fid) or f["title"], "en": f["en"]},
        })
    path = os.path.join(ROOT, "data", "map.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w", encoding="utf-8").write(BP.sj(out))
    return out["total"]


def build():
    F = BA.ordered()
    per, urls = {}, []
    for i, f in enumerate(F):
        url, ids = topic_page(f, F[i - 1] if i else None, F[i + 1] if i + 1 < len(F) else None)
        per[f["id"]] = ids
        urls.append(url)
    urls.append(hub_page(F, per))
    data_file(F, per)
    BR.add_to_sitemap(urls)
    if missing:
        uniq = sorted(set(missing))
        print(f"map: {len(uniq)} internal link(s) dropped because they do not resolve: {', '.join(uniq[:12])}")
    print(f"map pages: {len(urls)} · topics {len(F)} · resources {sum(len(v) for v in per.values())}")
    return urls


if __name__ == "__main__":
    build()
