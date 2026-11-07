# -*- coding: utf-8 -*-
"""Checks the built /kids/ pages (run after scripts/build_kids.py):   python3 scripts/kids_check.py

Every page of the course must exist and be well formed; the three languages of a page must have the same
shape (same number of sections, list items, tick boxes, tables and links); no markdown may leak into the
text; every internal link must land on a page or an anchor that exists; JSON-LD and the progress data
must parse.  Exit code 1 if anything is wrong.
"""
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_kids as K  # noqa: E402

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Walk(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.errors, self.ids, self.hrefs, self.text = [], [], [], [], []
        self.in_main = False
        self.lang_count = {"fa": 0, "ckb": 0, "en": 0}
        self.ld, self._ld = [], None
        self.data = None
        self._data = False
        self.h1 = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "main":
            self.in_main = True
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "a" and "href" in a:
            self.hrefs.append(a["href"])
        if self.in_main and a.get("data-lang") in self.lang_count:
            self.lang_count[a["data-lang"]] += 1
        if tag == "h1" and "data-lang" not in a:
            self.h1 += 1
        if tag == "script":
            if a.get("type") == "application/ld+json":
                self._ld = []
            if a.get("id") == "b4jData":
                self._data = True
                self.data = []
        if tag not in VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if tag == "script":
            if self._ld is not None:
                self.ld.append("".join(self._ld))
                self._ld = None
            self._data = False
        if tag == "main":
            self.in_main = False
        if not self.stack or self.stack[-1] != tag:
            if self.in_main or tag == "main":
                self.errors.append(f"unbalanced </{tag}> (open: {self.stack[-3:]})")
            if tag in self.stack:
                while self.stack and self.stack.pop() != tag:
                    pass
            return
        self.stack.pop()

    def handle_data(self, d):
        if self._ld is not None:
            self._ld.append(d)
        elif self._data:
            self.data.append(d)
        elif self.in_main:
            self.text.append(d)


class Shape(HTMLParser):
    """Counts, inside every language copy of an article, what the three languages must share: sections and
    glossary terms, list items, tick boxes, tables, links and headings. Standard library only, so it also runs in CI."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []        # (tag, class, copy-or-None) of the elements that are open
        self.active = []       # language copies that are open: [lang, [sections, li, ticks, tables, links, headings]]
        self.counts = {}       # lang -> tuple, filled when a copy closes

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class") or ""
        parent = self.stack[-1] if self.stack else None
        copy = None
        if tag == "div" and "data-lang" in a and parent and parent[0] == "article" and "b4j" in parent[1]:
            copy = [a["data-lang"], [0, 0, 0, 0, 0, 0]]
        for _lang, c in self.active:                      # descendants only: the copy itself is not counted
            if (tag == "section" and "b4j-s" in cls) or (tag == "article" and "b4j-term" in cls):
                c[0] += 1
            if tag == "li":
                c[1] += 1
            if tag == "input" and "b4j-ck" in cls:
                c[2] += 1
            if tag == "table":
                c[3] += 1
            if tag == "a":
                c[4] += 1
            if tag in ("h2", "h3", "h4"):
                c[5] += 1
        if tag in VOID:
            return
        self.stack.append((tag, cls, copy))
        if copy is not None:
            self.active.append(copy)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                closed = self.stack[i:]
                del self.stack[i:]
                for _t, _c, copy in closed:
                    if copy is not None:
                        self.active = [x for x in self.active if x is not copy]
                        self.counts[copy[0]] = tuple(copy[1])
                break


def page_path(url):
    p = url.split("#")[0].split("?")[0]
    if p.endswith("/"):
        return os.path.join(ROOT, p.strip("/"), "index.html")
    return os.path.join(ROOT, p.strip("/"))


def main():
    M = K.catalog()
    expect = ["kids/index.html"]
    for m in M:
        expect.append(m["url"].strip("/") + "/index.html")
        expect += [a["url"].strip("/") + "/index.html" for a in m["acts"]]
    expect += [f"kids/{x}/index.html" for x in ("foreword", "how-to-use", "parents", "faq", "glossary", "about")]
    expect += [f"{x}/index.html" for x in K.OLD_URLS]
    bad = 0
    ids_by_page = {}
    info = {}
    for rel in expect:
        path = os.path.join(ROOT, rel)
        errs = []
        if not os.path.exists(path):
            print(f"ERR  {rel}: missing")
            bad += 1
            continue
        html = open(path, encoding="utf-8").read()
        w = Walk()
        w.feed(html)
        errs += w.errors[:3]
        dup = {i for i in w.ids if w.ids.count(i) > 1}
        if dup:
            errs.append(f"duplicate ids: {sorted(dup)[:5]}")
        ids_by_page[rel] = set(w.ids)
        if not rel.startswith("kids/") or rel in [f"{x}/index.html" for x in K.OLD_URLS]:
            pass
        elif len({*w.lang_count.values()}) != 1:
            errs.append(f"language copies differ: {w.lang_count}")
        if "<title>" not in html or not re.search(r"<title>[^<]{8,}</title>", html):
            errs.append("missing or short <title>")
        m = re.search(r'<meta name="description" content="([^"]*)"', html)
        if not m or len(m.group(1)) < 20:
            errs.append("missing or short meta description")
        for j in w.ld:
            try:
                json.loads(j)
            except Exception as ex:
                errs.append(f"JSON-LD does not parse: {ex}")
        if w.data is not None:
            try:
                json.loads("".join(w.data))
            except Exception as ex:
                errs.append(f"b4jData does not parse: {ex}")
        txt = " ".join(w.text)
        for pat, name in ((r"\*\*", "** (unrendered bold)"), (r"\]\(https?:", "unrendered markdown link"),
                          (r"(?<![\w_])_[^_\s][^_]*[^_\s]_(?![\w_])", "unrendered _italic_"),
                          (r"\x00", "NUL"), (r"\bNone\b|\bundefined\b|\{[a-z_]+\}", "template leftovers")):
            mm = re.search(pat, txt)
            if mm:
                errs.append(f"{name}: …{txt[max(0, mm.start() - 30):mm.end() + 30]}…")
        if rel.startswith("kids/") and "/index.html" in rel and rel.count("/") >= 3 and rel.split("/")[1] in {m_["dir"] for m_ in M}:
            if "lexicon/en/#" in html:
                errs.append("a glossary link still points to the official lexicon")
            if "CC BY-SA 4.0" not in html or "My First Bitcoin" not in html:
                errs.append("attribution missing")
        info[rel] = (w, html)
        if errs:
            bad += 1
            print(f"ERR  {rel}")
            for x in errs:
                print("      ", x)
    # links: every internal link into the course (and its assets) must land on an existing page and anchor
    for rel, (w, html) in info.items():
        for h in w.hrefs:
            if not (h.startswith("/kids/") or h.startswith("/assets/kids")):
                continue
            tgt = page_path(h)
            if not os.path.exists(tgt):
                print(f"ERR  {rel}: link to a missing page {h}")
                bad += 1
                continue
            if "#" in h and h.startswith("/kids/"):
                frag = h.split("#", 1)[1]
                trel = os.path.relpath(tgt, ROOT)
                ids = ids_by_page.get(trel)
                if ids is not None and not (frag in ids or all(f"{lg}-{frag}" in ids for lg in K.LANGS)):
                    print(f"ERR  {rel}: anchor {h} not found")
                    bad += 1
    # the three languages of each page must have the same shape
    for rel, (w, html) in info.items():
        if not rel.startswith("kids/") or rel in [f"{x}/index.html" for x in K.OLD_URLS]:
            continue
        sh = Shape()
        sh.feed(html)
        sh.close()
        counts = sh.counts
        if not counts and rel == "kids/index.html":
            continue                      # the hub: inline spans, covered by the data-lang count above
        if sorted(counts) != ["ckb", "en", "fa"]:
            print(f"ERR  {rel}: expected three language copies, found {sorted(counts)}")
            bad += 1
        elif len(set(counts.values())) != 1:
            print(f"ERR  {rel}: the languages differ in (sections, list items, tick boxes, tables, links, headings): {counts}")
            bad += 1
    print(f"-- {len(expect)} pages checked, {bad} problems")
    sys.exit(1 if bad else 0)


main()
