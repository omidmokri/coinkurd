#!/usr/bin/env python3
"""Last build step: keep every page's search snippet inside what Google shows.

<title> over 60 characters and <meta name="description"> over 160 are shortened with the same rules page() uses
(build_pages.seo_title / seo_desc: decoration removed, cut at a word boundary, "…"). Pages made by page() already
comply; this catches the hand-made pages and the builders with their own templates (kids, indicators, terminal …).
og:title / og:description are left whole for link previews. Idempotent: a compliant page is not touched.

Run after all builders, before the site is uploaded: python3 scripts/seo_tidy.py
"""
import html
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_pages import seo_desc, seo_title  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {".git", "node_modules", "scripts", "tests", ".github", "android"}
T_RE = re.compile(r"<title>([^<]*)</title>")
D_RE = re.compile(r'(<meta name="description" content=")([^"]*)(")')
SUFFIX = " | entekhab.net"


def tidy(doc):
    head_end = doc.find("</head>")
    if head_end < 0:
        return doc
    head, rest = doc[:head_end], doc[head_end:]
    m = T_RE.search(head)
    if m and len(html.unescape(m.group(1))) > 60:
        t = html.unescape(m.group(1))
        t = t[:-len(SUFFIX)] if t.endswith(SUFFIX) else t
        head = head[:m.start()] + "<title>" + html.escape(seo_title(t), quote=False) + "</title>" + head[m.end():]
    d = D_RE.search(head)
    if d and len(html.unescape(d.group(2))) > 160:
        head = head[:d.start()] + d.group(1) + html.escape(seo_desc(html.unescape(d.group(2)))) + d.group(3) + head[d.end():]
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
