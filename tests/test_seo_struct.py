#!/usr/bin/env python3
"""Checks of scripts/seo_struct.py on a small made-up site where every right answer is known.  python3 tests/test_seo_struct.py"""
import json
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import seo_struct as S  # noqa: E402

FAILS = []


def check(cond, what):
    if not cond:
        FAILS.append(what)
        print("FAIL", what)


def page(title, lang="fa", head="", body="<main><h1>x</h1></main>", desc="توضیح صفحه"):
    return (f'<!doctype html><html lang="{lang}" dir="rtl"><head><meta charset="utf-8"><title>{title} | entekhab.net</title>'
            f'<meta name="description" content="{desc}">{head}</head><body>{body}</body></html>')


def put(root, rel, doc):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(doc)


def lds(doc):
    return [json.loads(x) for x in S.LD_RE.findall(doc)]


def crumbs(doc):
    for o in lds(doc):
        if o.get("@type") == "BreadcrumbList":
            return [(i["position"], i["name"], i["item"]) for i in o["itemListElement"]]
    return None


def main():
    with tempfile.TemporaryDirectory() as root:
        canon = lambda u: f'<link rel="canonical" href="{S.SITE}{u}">'  # noqa: E731
        put(root, "index.html", page("خانه", head=canon("/")))
        put(root, "dna/index.html", page("DNA بازار — هویت تحلیلی ارزها", head=canon("/dna/")))
        put(root, "dna/btc/index.html", page("DNA بیت‌کوین", head=canon("/dna/btc/") + '<meta property="og:image" content="x.jpg">'))
        put(root, "categories/news/index.html", page("خبر بازار", head=canon("/categories/news/")))
        post_body = '<main class="w"><div class="meta"><a class="pill" href="/categories/news/">📰 خبر بازار</a><a class="pill" href="/coins/btc/">BTC</a></div><h1>t</h1></main>'
        news = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsArticle","headline":"x"}</script>'
        put(root, "p/7/index.html", page("عنوان کوتاه‌شده…", head=canon("/p/7/") + news + '<meta property="og:title" content="عنوان کامل پست &amp; بیشتر">', body=post_body))
        put(root, "en/p/7/index.html", page("A post", lang="en", head=canon("/en/p/7/") + news))
        put(root, "glossary/x/index.html", page("واژه", head=canon("/glossary/x/") + '<meta property="og:image" content="x.jpg">' +
            '<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}</script>'))
        put(root, "secret/index.html", page("پنهان", head='<meta name="robots" content="noindex">'))
        put(root, "old/index.html", page("انتقال", head='<meta http-equiv="refresh" content="0;url=/dna/">'))
        put(root, "lab/index.html", page("آزمایشگاه &lt;/script&gt;&lt;b&gt;"))
        put(root, "encyclopedia/index.html", page("دانشنامه"))
        put(root, "encyclopedia/t/ckb/fat-tails.html", page("کلکی قورس", lang="ckb", head=canon("/encyclopedia/t/ckb/fat-tails.html") +
            "<meta property='og:title' content='کلکی قورس'><script type=\"application/ld+json\">{\"@type\":\"DefinedTerm\",\"name\":\"x\"}</script>"))
        put(root, "404.html", page("نیست"))
        before = {r: open(os.path.join(root, r), encoding="utf-8").read() for r in
                  ("index.html", "glossary/x/index.html", "secret/index.html", "old/index.html", "404.html")}
        names = {"/dna/": {"fa": "DNA بازار", "ckb": "DNAی بازاڕ", "en": "Market DNA"}, "/encyclopedia/": {"fa": "دانشنامه", "ckb": "ئینسایکلۆپیدیا", "en": "Encyclopedia"}}
        orig = S.menu_names
        S.menu_names = lambda: names
        try:
            ch1, seen = S.main(root)
            snap = {dp + "/" + f: open(os.path.join(dp, f), encoding="utf-8").read() for dp, _, fs in os.walk(root) for f in fs}
            ch2, _ = S.main(root)
        finally:
            S.menu_names = orig
        rd = lambda r: open(os.path.join(root, r), encoding="utf-8").read()  # noqa: E731

        # untouched: homepage, a page that has its trail, noindex, redirect, 404
        for r, doc in before.items():
            check(rd(r) == doc, f"{r} must not be touched")
        # idempotent
        check(ch2 == 0, f"second run changes nothing (changed {ch2})")
        check(all(open(k, encoding="utf-8").read() == v for k, v in snap.items()), "second run leaves every byte as it was")
        # a nested page: Home > section (menu name, page language) > page
        c = crumbs(rd("dna/btc/index.html"))
        check(c == [(1, "خانه", S.SITE + "/"), (2, "DNA بازار", S.SITE + "/dna/"), (3, "DNA بیت‌کوین", S.SITE + "/dna/btc/")], f"dna/btc trail {c}")
        check(rd("dna/btc/index.html").count("og:image") == 1, "a page with its own picture keeps it")
        check(any(o.get("@type") == "WebPage" and o["url"] == S.SITE + "/dna/btc/" and o["inLanguage"] == "fa" and o["description"] == "توضیح صفحه"
                  for o in lds(rd("dna/btc/index.html"))), "a page with no structured data gets WebPage")
        # a section page: Home > itself, and the default picture
        c = crumbs(rd("dna/index.html"))
        check(c == [(1, "خانه", S.SITE + "/"), (2, "DNA بازار — هویت تحلیلی ارزها", S.SITE + "/dna/")], f"dna trail {c}")
        check('og:image" content="' + S.SITE + '/assets/og.jpg"' in rd("dna/index.html") and "twitter:card" in rd("dna/index.html"), "default picture added")
        # a post: category from its own link, full title from og:title, existing NewsArticle kept, no WebPage added
        d = rd("p/7/index.html")
        c = crumbs(d)
        check(c == [(1, "خانه", S.SITE + "/"), (2, "📰 خبر بازار", S.SITE + "/categories/news/"), (3, "عنوان کامل پست & بیشتر", S.SITE + "/p/7/")], f"post trail {c}")
        check(sorted(o["@type"] for o in lds(d)) == ["BreadcrumbList", "NewsArticle"], "post keeps NewsArticle and gains only the trail")
        # a translated post: the language folder is not a section
        c = crumbs(rd("en/p/7/index.html"))
        check(c == [(1, "Home", S.SITE + "/"), (2, "A post", S.SITE + "/en/p/7/")], f"en post trail {c}")
        # an encyclopedia entry: Home > Encyclopedia (in Kurdish) > entry; single-quoted attributes are read
        c = crumbs(rd("encyclopedia/t/ckb/fat-tails.html"))
        check(c == [(1, "ماڵەوە", S.SITE + "/"), (2, "ئینسایکلۆپیدیا", S.SITE + "/encyclopedia/"), (3, "کلکی قورس", S.SITE + "/encyclopedia/t/ckb/fat-tails.html")], f"encyclopedia trail {c}")
        # a page without canonical gets its own address; hostile text cannot close the script tag
        d = rd("lab/index.html")
        check(f'<link rel="canonical" href="{S.SITE}/lab/">' in d, "missing canonical added")
        check(len(re.findall(r"</script>", d)) == len(S.LD_RE.findall(d)) == 2, "a title with </script> stays inside the JSON")
        check(any(o.get("@type") == "WebPage" and o.get("name") == "آزمایشگاه" for o in lds(d)), "and markup in a title is dropped from the name")
        check(all(isinstance(o, dict) for o in lds(d)), "every block parses")
        check(ch1 == 8 and seen == 11, f"changed {ch1} of {seen} (expected 8 of 11: all but the complete, the noindex and the redirect page)")
    print("test_seo_struct:", "FAILED " + str(len(FAILS)) if FAILS else "all checks passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
