#!/usr/bin/env python3
"""Last build step (after seo_tidy.py): what a search engine needs to place a page, on every page that lacks it.

The SEO audit of 2026-11-13 (5,861 built pages) found every page with a title, a description and one visible <h1> per
language, but 4,300 indexable pages without a breadcrumb trail in their structured data (posts in four languages, the
encyclopedia, DNA and indicator pages, most single pages), 1,520 encyclopedia pages without a preview picture, about 60
pages with no structured data at all and one indexable page without a canonical address. This step closes those gaps
on the built tree — it writes nothing a page does not already say about itself:

  * BreadcrumbList — Home > (the sections above the page that really exist as pages) > the page. A post takes its
    category from its own category link. A page that already carries a BreadcrumbList is left alone.
  * og:image + twitter:card — the site's own preview picture, only where the page names none.
  * canonical — the page's own address, only on an indexable page that has none.
  * WebPage — name, description, address and language, only on a page with no structured data of its own.

Never touched: pages marked noindex, redirect stubs, 404/offline pages. Idempotent: a second run changes nothing.
Names come from the menu (scripts/chrome.py) in the page's language, else from the section page's own <title>.

Run after all builders and seo_tidy.py, before the site is uploaded:  python3 scripts/seo_struct.py [root]
Test: python3 tests/test_seo_struct.py
"""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.environ.get("SITE_URL", "https://entekhab.net").rstrip("/")
SKIP = {".git", "node_modules", "scripts", "tests", ".github", "android", "windows", "chrome-extension", "content", "data", "assets", "api", "tts",
        "tts_check", "bot", "entekhab-bot", "survey", "_episode"}
SKIP_FILES = {"404.html", "offline.html"}
SUFFIX = " | entekhab.net"
HOME = {"fa": "خانه", "ckb": "ماڵەوە", "ar": "الرئيسية", "en": "Home"}
LANG_DIRS = {"en", "ckb", "ar"}          # /en/p/<id>/ … : a language is not a section
Q = "[\"']"
T_RE = re.compile(r"<title>([^<]*)</title>")
D_RE = re.compile(rf"<meta\s+name={Q}description{Q}\s+content=(?:\"([^\"]*)\"|'([^']*)')")
C_RE = re.compile(rf"<link\s+rel={Q}canonical{Q}\s+href={Q}([^\"']+){Q}")
LANG_RE = re.compile(r"<html[^>]*\blang=[\"']?([a-zA-Z-]+)")
NOINDEX_RE = re.compile(rf"<meta\s+name={Q}robots{Q}\s+content={Q}[^\"']*noindex", re.I)
REFRESH_RE = re.compile(rf"http-equiv={Q}refresh{Q}", re.I)
LD_RE = re.compile(rf"<script\s+type={Q}application/ld\+json{Q}[^>]*>(.*?)</script>", re.S)
OGI_RE = re.compile(rf"<meta\s+property={Q}og:image{Q}")
TW_RE = re.compile(rf"<meta\s+name={Q}twitter:card{Q}")
OGT_RE = re.compile(rf"<meta\s+property={Q}og:title{Q}\s+content=(?:\"([^\"]*)\"|'([^']*)')")
CAT_RE = re.compile(rf"<a\s+class={Q}pill{Q}\s+href={Q}(/categories/[a-z0-9_-]+/){Q}>(.*?)</a>", re.S)
OG_DEFAULT = (f'<meta property="og:image" content="{SITE}/assets/og.jpg"><meta property="og:image:width" content="1200">'
              '<meta property="og:image:height" content="630">')


def sj(o):
    """JSON for an inline <script>: '<', '>' and '&' are escaped so no text can close the tag."""
    return json.dumps(o, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def clean(t, n=90):
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", t or ""))).strip()
    if t.endswith(SUFFIX):
        t = t[:-len(SUFFIX)].strip()
    return t if len(t) <= n else t[:n - 1].rstrip(" ،,؛;:|—-") + "…"


def menu_names():
    """{'/dna/': {'fa': …, 'ckb': …, 'en': …}} from the site menu, the single source of section names."""
    try:
        import chrome
        out = {}
        for c in chrome.NAV:
            for href, _ic, title, _d in c["items"]:
                if href.startswith("/") and "#" not in href:
                    out.setdefault(href, title)
        return out
    except Exception as ex:                      # the step must never stop a deploy
        print("seo_struct: menu names unavailable:", ex)
        return {}


class Site:
    def __init__(self, root, names=None):
        self.root = root
        self.names = menu_names() if names is None else names
        self._title = {}

    def exists(self, url_path):
        return os.path.isfile(os.path.join(self.root, url_path.strip("/"), "index.html"))

    def section_name(self, url_path, lang):
        """Name of a section page: the menu's label in the page language, else the first part of that page's own <title>."""
        n = self.names.get(url_path)
        if n:
            return n.get(lang) or n.get("en" if lang == "ar" else "fa") or next(iter(n.values()))
        if url_path not in self._title:
            t = ""
            try:
                with open(os.path.join(self.root, url_path.strip("/"), "index.html"), encoding="utf-8", errors="replace") as f:
                    m = T_RE.search(f.read(6000))
                    t = clean(m.group(1)) if m else ""
            except OSError:
                pass
            self._title[url_path] = re.split(r"\s+[—|·]\s+|:\s", t)[0].strip() if t else ""
        return self._title[url_path]

    def trail(self, url_path, lang, title, body=""):
        """[(name, absolute url)] from Home to the page itself; [] when there is nothing to say."""
        segs = [s for s in url_path.strip("/").split("/") if s]
        if not segs:
            return []
        items = [(HOME.get(lang, HOME["en"]), SITE + "/")]
        acc, parents = "", []
        for i, s in enumerate(segs[:-1]):
            acc += "/" + s
            if i == 0 and s in LANG_DIRS:
                continue
            p = acc + "/"
            if self.exists(p):
                parents.append(p)
        if not parents and body:                                    # a post: its category is its section
            m = CAT_RE.search(body)
            if m and self.exists(m.group(1)):
                nm = clean(m.group(2), 60)
                if nm:
                    items.append((nm, SITE + m.group(1)))
        for p in parents:
            nm = self.section_name(p, lang)
            if nm:
                items.append((nm, SITE + p))
        name = clean(title, 110)
        if not name:
            return []
        items.append((name, SITE + url_path))
        return items if len(items) >= 2 else []


def ld_types(doc):
    types, broken = set(), False
    for raw in LD_RE.findall(doc):
        try:
            def walk(x):
                if isinstance(x, dict):
                    t = x.get("@type")
                    if t:
                        types.update(t if isinstance(t, list) else [t])
                    for v in x.values():
                        walk(v)
                elif isinstance(x, list):
                    for v in x:
                        walk(v)
            walk(json.loads(raw))
        except ValueError:
            broken = True
    return types, broken


def enrich(doc, url_path, site):
    """The document with the missing tags added before </head>; the same string when nothing is missing."""
    he = doc.find("</head>")
    if he < 0:
        return doc
    head = doc[:he]
    if NOINDEX_RE.search(head) or REFRESH_RE.search(head):
        return doc
    tm = T_RE.search(head)
    title = html.unescape(tm.group(1)).strip() if tm else ""
    if not title:
        return doc
    lm = LANG_RE.search(doc[:600])
    lang = (lm.group(1).lower() if lm else "fa")
    lang = "ckb" if lang.startswith(("ckb", "ku")) else lang[:2]
    add = []
    cm = C_RE.search(head)
    canon = cm.group(1) if cm else SITE + url_path
    if not cm:
        add.append(f'<link rel="canonical" href="{html.escape(canon, quote=True)}">')
    if not OGI_RE.search(head):
        add.append(OG_DEFAULT + ("" if TW_RE.search(head) else '<meta name="twitter:card" content="summary_large_image">'))
    types, _broken = ld_types(doc)
    if "BreadcrumbList" not in types:
        mi = doc.find("<main", he)                               # a post names its category at the top of <main>
        om = OGT_RE.search(head)                                 # og:title is the whole title; <title> may have been shortened for the snippet
        full = html.unescape((om.group(1) or om.group(2) or "") if om else "").strip() or title
        tr = site.trail(url_path, lang, full, doc[mi:mi + 4000] if mi >= 0 else "")
        if tr:
            tr[-1] = (tr[-1][0], canon)
            ld = {"@context": "https://schema.org", "@type": "BreadcrumbList",
                  "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(tr)]}
            add.append(f'<script type="application/ld+json">{sj(ld)}</script>')
    if not types:
        dm = D_RE.search(head)
        desc = html.unescape((dm.group(1) or dm.group(2) or "") if dm else "").strip()
        ld = {"@context": "https://schema.org", "@type": "WebPage", "name": clean(title, 110), "url": canon, "inLanguage": lang,
              "isPartOf": {"@type": "WebSite", "name": "entekhab.net", "url": SITE + "/"}}
        if desc:
            ld["description"] = desc
        add.append(f'<script type="application/ld+json">{sj(ld)}</script>')
    if not add:
        return doc
    return doc[:he] + "".join(add) + doc[he:]


def url_of(root, path):
    rel = os.path.relpath(path, root).replace(os.sep, "/")
    if rel == "index.html":
        return "/"
    return "/" + (rel[:-len("index.html")] if rel.endswith("/index.html") else rel)


def main(root=ROOT):
    site = Site(root)
    seen = changed = 0
    for dp, dns, fns in os.walk(root):
        dns[:] = [x for x in dns if x not in SKIP and not x.startswith(".")]
        for fn in fns:
            if not fn.endswith(".html") or fn in SKIP_FILES:
                continue
            p = os.path.join(dp, fn)
            u = url_of(root, p)
            if u == "/":                                   # the homepage keeps its own hand-written head
                continue
            with open(p, encoding="utf-8", errors="surrogateescape") as f:
                doc = f.read()
            seen += 1
            try:
                new = enrich(doc, u, site)
            except Exception as ex:                        # one odd page must not stop the others
                print("seo_struct: skipped", u, ex)
                continue
            if new != doc:
                with open(p, "w", encoding="utf-8", errors="surrogateescape") as f:
                    f.write(new)
                changed += 1
    print(f"seo_struct: {changed} of {seen} pages completed")
    return changed, seen


if __name__ == "__main__":
    main(os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else ROOT)
