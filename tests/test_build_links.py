#!/usr/bin/env python3
"""Checks of scripts/build_links.py on a small made-up site where every right answer is known.  python3 tests/test_build_links.py"""
import json
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import build_links as B  # noqa: E402

FAILS = []


def check(cond, what):
    if not cond:
        FAILS.append(what)
        print("FAIL", what)


def put(root, rel, title, main="", head="", h1=None):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    body = f"<main class=\"w\"><h1>{h1 or title}</h1>{main}</main>" if main is not None else f"<h1>{h1 or title}</h1>"
    open(p, "w", encoding="utf-8").write(f'<!doctype html><html lang="fa"><head><title>{title} | entekhab.net</title>{head}</head><body>{body}'
                                         f'<p class="ek-credit">x</p><!--ek:bottom--></body></html>')


def links(root, rel):
    d = open(os.path.join(root, rel), encoding="utf-8").read()
    m = re.search(r"<!--ek:rel-->(.*?)<!--/ek:rel-->", d, re.S)
    return (re.findall(r'<a href="([^"]+)">', m.group(1)) if m else None), d.count("<!--ek:rel-->")


def main():
    G = [{"slug": "halving", "fa": "هاوینگ", "ckb": "هاڤینگ", "en": "Halving", "alias": ["هاوینگ", "halving"]},
         {"slug": "etf", "fa": "ای‌تی‌اف", "ckb": "ئی‌تی‌ئێف", "en": "ETF", "alias": ["ETF"]},
         {"slug": "gone", "fa": "حذف‌شده", "ckb": "x", "en": "Gone", "alias": []}]
    with tempfile.TemporaryDirectory() as root:
        put(root, "coins/btc/index.html", "BTC", main="<p>هاوینگ و هاوینگ بعدی؛ ETF یک بار</p>", h1="Bitcoin · بیت‌کوین (BTC)")
        put(root, "coins/sol/index.html", "SOL", main="<p>هیچ اصطلاحی</p>", h1="Solana · سولانا (SOL)")
        put(root, "coins/aave/index.html", "AAVE", main="<p>x</p>", head='<meta name="robots" content="noindex">', h1="AAVE (AAVE)")
        put(root, "dna/btc/index.html", "DNA BTC", main=None)
        put(root, "compare/btc-vs-sol/index.html", "BTC vs SOL")
        put(root, "compare/eth-vs-bnb/index.html", "ETH vs BNB")
        put(root, "glossary/halving/index.html", "هاوینگ", main="<p>تعریف</p>")
        put(root, "glossary/etf/index.html", "ETF", main="<p>تعریف</p>")
        put(root, "academy/f1/f1-l1/index.html", "درس بیت‌کوین", main="<p>بیت‌کوین بیت‌کوین هاوینگ هاوینگ</p>")
        put(root, "academy/f1/f1-l2/index.html", "درس دیگر", main="<p>سولانا یک بار</p>")
        put(root, "academy/f1/f1-l3/index.html", "درس پنهان", main="<p>بیت‌کوین بیت‌کوین</p>", head='<meta name="robots" content="noindex">')
        put(root, "encyclopedia/t/fa/halving.html", "هاوینگ", main=None)
        put(root, "encyclopedia/t/en/halving.html", "Halving", main=None)
        put(root, "encyclopedia/t/ckb/halving.html", "هاڤینگ", main=None)
        orig = B.glossary
        B.glossary = lambda: G
        try:
            rows, ch1 = B.main(root)
            snap = {os.path.join(dp, f): open(os.path.join(dp, f), encoding="utf-8").read() for dp, _, fs in os.walk(root) for f in fs}
            _rows, ch2 = B.main(root)
        finally:
            B.glossary = orig
        check(ch2 == 0 and all(open(k, encoding="utf-8").read() == v for k, v in snap.items()), f"second run changes nothing ({ch2})")
        idx = json.load(open(os.path.join(root, "search.json"), encoding="utf-8"))["r"]
        urls = {r[1] for r in idx}
        check("/coins/btc/" in urls and "/coins/aave/" not in urls, "index: indexable coins only")
        check("/glossary/gone/" not in urls, "index: a term without its page is left out")
        check("/academy/f1/f1-l3/" not in urls and "/academy/f1/f1-l1/" in urls, "index: lessons that are not noindex")
        check(["enc", "/encyclopedia/t/fa/halving.html", "هاوینگ", "Halving هاڤینگ"] in idx, f"index: encyclopedia entry with its other names")
        check(any(r[0] == "coin" and r[2] == "BTC" and "بیت‌کوین" in r[3] for r in idx), "index: coin with its names")
        btc, n = links(root, "coins/btc/index.html")
        check(n == 1, "one block on the coin page")
        check(btc == ["/dna/btc/", "/compare/btc-vs-sol/", "/glossary/halving/", "/academy/f1/f1-l1/"],
              f"BTC links: its DNA, its comparison, the term its text uses twice (ETF once: no), the lesson that names it twice ({btc})")
        sol, _ = links(root, "coins/sol/index.html")
        check(sol == ["/compare/btc-vs-sol/"], f"SOL: no DNA page, no term, a lesson naming it once is not enough ({sol})")
        h, _ = links(root, "glossary/halving/index.html")
        check(h == ["/academy/f1/f1-l1/", "/encyclopedia/t/fa/halving.html"], f"term: lesson using it twice, its encyclopedia entry ({h})")
        etf, n = links(root, "glossary/etf/index.html")
        check(etf is None and n == 0, "a term with nothing to link gets no block")
        dna, _ = links(root, "dna/btc/index.html")
        check(dna == ["/coins/btc/", "/compare/btc-vs-sol/"], f"DNA page links back to the coin ({dna})")
        d = open(os.path.join(root, "dna/btc/index.html"), encoding="utf-8").read()
        check(d.index("<!--ek:rel-->") < d.index('<p class="ek-credit">'), "DNA block sits before the credit line")
        check('data-ckb="تۆڕی زانیاری ئەم پەڕەیە"' in d, "labels carry every language")
    print("test_build_links:", "FAILED " + str(len(FAILS)) if FAILS else "all checks passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
