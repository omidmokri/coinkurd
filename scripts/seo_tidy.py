#!/usr/bin/env python3
"""Last build step: keep every page's search snippet inside what Google shows.

<title> over 60 characters and <meta name="description"> over 160 (JavaScript length, as audit tools count) are shortened with the same rules page() uses
(build_pages.seo_title / seo_desc: decoration removed, cut at a word boundary, "…"). Pages made by page() already
comply; this catches the hand-made pages and the builders with their own templates (kids, indicators, terminal …).
A description under 70 characters, or a missing one, gets the page title and a site line in the page language.
og:title / og:description are left whole for link previews. Idempotent: a compliant page is not touched.

Run after all builders, before the site is uploaded: python3 scripts/seo_tidy.py
"""
import html
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_pages import jlen, seo_desc, seo_title  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {".git", "node_modules", "scripts", "tests", ".github", "android", "chrome-extension"}
T_RE = re.compile(r"<title>([^<]*)</title>")
D_RE = re.compile(r'(<meta name="description" content=")([^"]*)(")')
SUFFIX = " | entekhab.net"
LANG_RE = re.compile(r'<html[^>]*\blang="([a-z]+)')
D_MIN = 70          # audit tools flag descriptions under 70 characters
TAIL = {
    "fa": "تحلیل، اخبار روز و ابزارهای رایگان بازار رمزارز، طلا و ارز در انتخاب (entekhab.net)",
    "ckb": "شیکاری، هەواڵی ڕۆژ و ئامرازە بێبەرامبەرەکانی بازاڕی دراوی دیجیتاڵ، زێڕ و دراو لە entekhab.net",
    "en": "Daily crypto, gold and currency market analysis, news and free tools on entekhab.net",
}


def fill(desc, title, lang):
    """A description under D_MIN grows with the page title and a site line in the page's language."""
    tail = TAIL.get(lang, TAIL["fa"])
    title = title[:-len(SUFFIX)] if title.endswith(SUFFIX) else title
    d = (desc or "").strip(" —")
    if title and title not in d and jlen(d) + jlen(title) < D_MIN:
        d = (title + " — " + d).strip(" —")
    if jlen(d) < D_MIN and tail not in d:
        d = (d + " — " + tail).strip(" —")
    return seo_desc(d, 158)


def tidy(doc):
    head_end = doc.find("</head>")
    if head_end < 0:
        return doc
    head, rest = doc[:head_end], doc[head_end:]
    lm = LANG_RE.search(doc[:400])
    lang = lm.group(1) if lm else "fa"
    m = T_RE.search(head)
    title = html.unescape(m.group(1)) if m else ""
    if m and jlen(title) > 60:
        t = title[:-len(SUFFIX)] if title.endswith(SUFFIX) else title
        title = seo_title(t)
        head = head[:m.start()] + "<title>" + html.escape(title, quote=False) + "</title>" + head[m.end():]
    d = D_RE.search(head)
    if d:
        cur = html.unescape(d.group(2))
        new = seo_desc(cur) if jlen(cur) > 160 else fill(cur, title, lang) if jlen(cur) < D_MIN else cur
        if new != cur:
            head = head[:d.start()] + d.group(1) + html.escape(new) + d.group(3) + head[d.end():]
    elif m and 'name="robots" content="noindex' not in head:
        m = T_RE.search(head)
        tag = '<meta name="description" content="' + html.escape(fill("", title, lang)) + '">'
        head = head[:m.end()] + tag + head[m.end():]
    return head + rest


def main():
    changed = seen = 0
    for dp, dns, fns in os.walk(ROOT):
        dns[:] = [x for x in dns if x not in SKIP]
        for fn in fns:
            if not fn.endswith(".html"):
                continue
            p = os.path.join(dp, fn)
            with open(p, encoding="utf-8", errors="surrogateescape") as f:
                doc = f.read()
            seen += 1
            new = tidy(doc)
            if new != doc:
                with open(p, "w", encoding="utf-8", errors="surrogateescape") as f:
                    f.write(new)
                changed += 1
    print(f"seo_tidy: {changed} of {seen} pages shortened")


if __name__ == "__main__":
    main()
