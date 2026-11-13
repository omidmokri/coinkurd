#!/usr/bin/env python3
"""Post-build step: the site's own knowledge graph, made visible to readers and to search engines.

Two outputs, both from the BUILT tree (run after every page builder, before seo_tidy/seo_struct):

1. /search.json — the index behind the site search (Ctrl/⌘+K, assets/deep.js): coins, glossary terms (fa · ckb · en),
   academy lessons, encyclopedia entries, indicators and DNA pages, each with the address it really has. Only pages
   that exist and are indexable go in. Compact: [type, url, name, other names] per row; fetched once, when search opens.

2. "Knowledge network" blocks — a short list of links at the end of
     * a coin page   (/coins/<c>/): its DNA page, its comparisons, the glossary terms its own text uses, the lessons
                                   that talk about it, and «درک بیت‌کوین» for BTC;
     * a term page   (/glossary/<t>/): the lessons that use the term, its encyclopedia entry, the coins it names;
     * a DNA page    (/dna/<c>/): the coin's page and its comparisons.
   Every link is found in the pages themselves (a lesson is linked only when its own text contains the word), never
   invented. A page with nothing to link gets no block. The block sits between <!--ek:rel--> markers, so a second run
   replaces it instead of adding another (idempotent).

Usage: python3 scripts/build_links.py [root]            Test: python3 tests/test_build_links.py
"""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOINDEX = re.compile(r"<meta\s+name=[\"']robots[\"']\s+content=[\"'][^\"']*noindex", re.I)
TITLE = re.compile(r"<title>([^<]*)</title>")
H1 = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
MAIN = re.compile(r"<main[^>]*>(.*?)</main>", re.S)
SUFFIX = " | entekhab.net"
REL_RE = re.compile(r"<!--ek:rel-->.*?<!--/ek:rel-->", re.S)
L = lambda fa, ckb, en: {"fa": fa, "ckb": ckb, "en": en}  # noqa: E731
LBL = {
    "head": L("شبکهٔ دانش این صفحه", "تۆڕی زانیاری ئەم پەڕەیە", "Connected on this site"),
    "dna": L("DNA تحلیلی", "DNAی شیکاری", "Analytical DNA"),
    "coin": L("صفحهٔ کوین", "پەڕەی دراو", "Coin page"),
    "cmp": L("مقایسه‌ها", "بەراوردەکان", "Comparisons"),
    "terms": L("اصطلاحات این صفحه", "زاراوەکانی ئەم پەڕەیە", "Terms used here"),
    "lessons": L("درس‌های مرتبط", "وانە پەیوەندیدارەکان", "Related lessons"),
    "enc": L("در دانشنامه", "لە ئینسایکلۆپیدیا", "In the encyclopedia"),
    "coins": L("کوین‌های نام‌برده", "دراوە ناوهێنراوەکان", "Coins named"),
    "learn": L("برای فهم عمیق‌تر", "بۆ تێگەیشتنی قووڵتر", "To go deeper"),
}


def e(s):
    return html.escape(str(s), quote=True)


def tri(d, tag="span", cls="ek-i"):
    return f'<{tag} class="{cls}" data-fa="{e(d["fa"])}" data-ckb="{e(d["ckb"])}" data-en="{e(d["en"])}">{e(d["fa"])}</{tag}>'


def text(s):
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def norm(s):
    return (s or "").replace("‌", "").replace("ي", "ی").replace("ك", "ک").lower()


def clean_title(t):
    t = html.unescape(t or "").strip()
    return t[:-len(SUFFIX)].strip() if t.endswith(SUFFIX) else t


class Tree:
    def __init__(self, root):
        self.root = root

    def path(self, url):
        u = url.strip("/")
        return os.path.join(self.root, u) if u.endswith(".html") else os.path.join(self.root, u, "index.html")

    def read(self, url):
        try:
            with open(self.path(url), encoding="utf-8", errors="replace") as f:
                return f.read()
        except OSError:
            return None

    def live(self, url):
        """the page exists and is meant for search engines"""
        d = self.read(url)
        return d is not None and not NOINDEX.search(d[:d.find("</head>")] if "</head>" in d else d)

    def dirs(self, sec):
        p = os.path.join(self.root, sec)
        return sorted(x for x in os.listdir(p) if os.path.isfile(os.path.join(p, x, "index.html"))) if os.path.isdir(p) else []


def coins(T):
    out = {}
    for c in T.dirs("coins"):
        d = T.read(f"/coins/{c}/")
        if not d or NOINDEX.search(d[:d.find("</head>")]):
            continue
        m = H1.search(d)
        h = text(m.group(1)) if m else c.upper()
        mm = re.match(r"(.*?)\s*·\s*(.*?)\s*\(([A-Z0-9]+)\)\s*$", h)
        en, fa, sym = (mm.group(1), mm.group(2), mm.group(3)) if mm else (h, "", c.upper())
        out[c] = {"sym": sym, "en": en, "fa": fa, "h1": h}
    return out


def lessons(T):
    out = []
    base = os.path.join(T.root, "academy")
    facs = sorted(x for x in os.listdir(base) if os.path.isdir(os.path.join(base, x))) if os.path.isdir(base) else []
    for f in facs:
        for l in T.dirs(f"academy/{f}"):
            u = f"/academy/{f}/{l}/"
            d = T.read(u)
            if not d or NOINDEX.search(d[:d.find("</head>")]):
                continue
            m = TITLE.search(d)
            mm = MAIN.search(d)
            out.append({"url": u, "name": clean_title(m.group(1)) if m else l, "txt": norm(text(mm.group(1) if mm else d))})
    return out


def encyclopedia(T):
    """{english name (lower) -> (fa url, fa name, en name, ckb name)}"""
    out, base = {}, os.path.join(T.root, "encyclopedia", "t")
    if not os.path.isdir(os.path.join(base, "fa")):
        return out
    for fn in sorted(os.listdir(os.path.join(base, "fa"))):
        if not fn.endswith(".html"):
            continue
        names = {}
        for lg in ("fa", "en", "ckb"):
            d = T.read(f"/encyclopedia/t/{lg}/{fn}")
            m = H1.search(d or "")
            names[lg] = text(m.group(1)) if m else ""
        if names["fa"]:
            out[norm(names["en"] or fn[:-5])] = (f"/encyclopedia/t/fa/{fn}", names["fa"], names["en"], names["ckb"])
    return out


def glossary():
    try:
        import learn_data
        return [{"slug": g[0], "fa": g[2], "ckb": g[4], "en": g[6], "alias": list(g[8])} for g in learn_data.GLOSSARY]
    except Exception as ex:          # the step must never stop a deploy
        print("build_links: glossary unavailable:", ex)
        return []


def chips(items):
    return "".join(f'<a href="{e(u)}">{e(n)}</a>' for u, n in items)


def block(groups):
    """groups: [(label dict, [(url, name)])] -> the block (empty string when there is nothing to show)"""
    groups = [(lb, it) for lb, it in groups if it]
    if not groups:
        return ""
    body = "".join(f'<div class="ek-rel-g">{tri(lb, "h3")}<p class="ek-rel-c">{chips(it)}</p></div>' for lb, it in groups)
    css = ("<style>.ek-rel{margin:40px 0 8px;padding:18px 18px 8px;border:1px solid rgba(255,255,255,.1);border-radius:16px;"
           "background:rgba(255,255,255,.025)}.ek-rel>h2{margin:0 0 12px;font-size:1.05rem;color:#f7931a}"
           ".ek-rel-g{margin:0 0 12px}.ek-rel-g h3{margin:0 0 6px;font-size:.82rem;font-weight:600;color:#9a9a94}"
           ".ek-rel-c{display:flex;flex-wrap:wrap;gap:6px;margin:0}.ek-rel-c a{display:inline-block;border:1px solid rgba(255,255,255,.12);"
           "border-radius:99px;padding:3px 12px;font-size:.84rem;color:#f4f4f2;text-decoration:none;transition:border-color .2s,background-color .2s}"
           ".ek-rel-c a:hover{border-color:rgba(247,147,26,.55);background:rgba(247,147,26,.08)}</style>")
    return f'<!--ek:rel-->{css}<section class="ek-rel" aria-label="related">{tri(LBL["head"], "h2")}{body}</section><!--/ek:rel-->'


def put(T, url, blk, before=("</main>",)):
    d = T.read(url)
    if d is None:
        return False
    new = REL_RE.sub("", d)
    if blk:
        for anchor in before:
            i = new.rfind(anchor)
            if i >= 0:
                new = new[:i] + blk + new[i:]
                break
    if new != d:
        with open(T.path(url), "w", encoding="utf-8") as f:
            f.write(new)
        return True
    return False


def count(txt, words):
    return sum(txt.count(w) for w in {norm(x) for x in words if x and len(norm(x)) >= 3})


def main(root=ROOT):
    T = Tree(root)
    C, LS, G, ENC = coins(T), lessons(T), glossary(), encyclopedia(T)
    cmp_pages = [p for p in T.dirs("compare") if T.live(f"/compare/{p}/")]
    dna = {c for c in T.dirs("dna") if T.live(f"/dna/{c}/")}
    inds = []
    for i in T.dirs("indicators"):
        if T.live(f"/indicators/{i}/"):
            m = TITLE.search(T.read(f"/indicators/{i}/") or "")
            inds.append((i, clean_title(m.group(1)) if m else i))
    gl_live = [g for g in G if T.live(f"/glossary/{g['slug']}/")]

    # ---------------------------------------------------------------- 1. search index
    rows = []
    for c, v in C.items():
        rows.append(["coin", f"/coins/{c}/", v["sym"], " ".join(x for x in (v["en"], v["fa"]) if x)])
    for g in gl_live:
        rows.append(["term", f"/glossary/{g['slug']}/", g["fa"], " ".join([g["en"], g["ckb"]] + g["alias"])])
    for l in LS:
        rows.append(["lesson", l["url"], l["name"], ""])
    for _k, (u, fa, en, ckb) in sorted(ENC.items()):
        rows.append(["enc", u, fa, " ".join(x for x in (en, ckb) if x)])
    for i, t in inds:
        rows.append(["ind", f"/indicators/{i}/", t, ""])
    for c in sorted(dna):
        rows.append(["dna", f"/dna/{c}/", "DNA " + c.upper(), (C.get(c) or {}).get("fa", "")])
    with open(os.path.join(root, "search.json"), "w", encoding="utf-8") as f:
        json.dump({"v": 1, "r": rows}, f, ensure_ascii=False, separators=(",", ":"))

    # ---------------------------------------------------------------- 2. knowledge-network blocks
    changed = 0
    for c, v in C.items():
        d = REL_RE.sub("", T.read(f"/coins/{c}/") or "")            # the page's own words, not an earlier block of ours
        mm = MAIN.search(d)
        txt = norm(text(mm.group(1) if mm else ""))
        own = [("/dna/%s/" % c, "DNA " + v["sym"])] if c in dna else []
        cmps = [(f"/compare/{p}/", p.replace("-vs-", " / ").upper()) for p in cmp_pages if c in p.split("-vs-")][:6]
        terms = sorted(((count(txt, [g["fa"]] + g["alias"]), g) for g in gl_live), key=lambda x: -x[0])
        terms = [(f"/glossary/{g['slug']}/", g["fa"]) for n, g in terms if n >= 2][:8]
        names = [v["fa"], v["sym"] if len(v["sym"]) >= 3 else "", v["en"] if len(v["en"]) >= 4 else ""]
        ls = sorted(((count(l["txt"], names), l) for l in LS), key=lambda x: -x[0])
        ls = [(l["url"], l["name"]) for n, l in ls if n >= 2][:5]
        deeper = [("/bitcoin/", "درک بیت‌کوین")] if c == "btc" and T.live("/bitcoin/") else []
        blk = block([(LBL["dna"], own), (LBL["cmp"], cmps), (LBL["terms"], terms), (LBL["lessons"], ls), (LBL["learn"], deeper)])
        changed += put(T, f"/coins/{c}/", blk)
    sym_re = {c: re.compile(r"(?<![A-Za-z0-9])" + re.escape(v["sym"]) + r"(?![A-Za-z0-9])") for c, v in C.items() if len(v["sym"]) >= 3}
    for g in gl_live:
        words = [g["fa"]] + g["alias"]
        ls = sorted(((count(l["txt"], words), l) for l in LS), key=lambda x: -x[0])
        ls = [(l["url"], l["name"]) for n, l in ls if n >= 2][:5]     # a passing mention is not a lesson about it
        en = ENC.get(norm(g["en"]))
        enc = [(en[0], en[1])] if en else []
        defs = " ".join([g["fa"], g["en"]])
        named = [(f"/coins/{c}/", C[c]["sym"]) for c, r in sym_re.items() if r.search(defs)][:6]
        blk = block([(LBL["lessons"], ls), (LBL["enc"], enc), (LBL["coins"], named)])
        changed += put(T, f"/glossary/{g['slug']}/", blk)
    for c in sorted(dna):
        own = [(f"/coins/{c}/", C[c]["h1"])] if c in C else []
        cmps = [(f"/compare/{p}/", p.replace("-vs-", " / ").upper()) for p in cmp_pages if c in p.split("-vs-")][:6]
        changed += put(T, f"/dna/{c}/", block([(LBL["coin"], own), (LBL["cmp"], cmps)]), before=('<p class="ek-credit">', "<!--ek:bottom-->"))
    print(f"build_links: search.json {len(rows)} rows · {changed} pages linked")
    return rows, changed


if __name__ == "__main__":
    main(os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else ROOT)
