#!/usr/bin/env python3
"""scripts/build_market_l10n.py on a copy of market/index.html with a fake translation cache:
  de: everything translated · iw: everything (a right-to-left language) · jp: the workspace strings only, no page text.
Checks every page /market/<code>/ for the 43 languages: <html lang/dir/data-pro-lang>, its own title, description,
canonical, heading and about text, hreflang links to the ready languages only, noindex until the page text is in,
the string pack (only current translations, valid JS), no Arabic layer, the shared header in English; the forwards at
/market/fa|ckb|ar|en/; hreflang on /market/ itself; the sitemap; and that a second run changes nothing.
Run: python3 tests/test_market_l10n.py"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import build_market_l10n as B  # noqa: E402
import pro_l10n as L  # noqa: E402
import pro_langs  # noqa: E402

FAILS = []


def ok(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f" — {extra}" if extra and not cond else ""))
    if not cond:
        FAILS.append(name)


def fake_cache(d, src):
    def tr(code, k, v):
        if k.startswith("about.") or k.startswith("seo."):
            # keep the tags, change the words
            return re.sub(r">([^<]+)<", lambda m: ">" + "«" + code + "» " + m.group(1) + "<", "<x>" + v + "</x>")[3:-4] if "<" in v else "«" + code + "» " + v
        return "«" + code + "» " + v
    os.makedirs(d, exist_ok=True)
    for code, which in (("de", "all"), ("iw", "all"), ("jp", "ui")):
        s = {}
        for k, v in src.items():
            if which == "ui" and (k.startswith("seo.") or k.startswith("about.")):
                continue
            s[k] = [L.h(v), tr(code, k, v)]
        s["stale"] = ["0000000000", "an old one"]                      # a key whose English changed: never used
        json.dump({"lang": code, "s": s}, open(os.path.join(d, code + ".json"), "w", encoding="utf-8"), ensure_ascii=False)


def main():
    tmp = tempfile.mkdtemp()
    try:
        os.makedirs(os.path.join(tmp, "market"))
        tpl = open(os.path.join(ROOT, "market", "index.html"), encoding="utf-8").read()
        # as CI has it by then: the Arabic layer injected (scripts/i18n_ar.py), then removed again by the builder
        tpl = tpl.replace("<head>", '<head><script id="ek-ar-h">try{}catch(e){}</script><style id="ek-ar-s">html.ek-ar-wait body{opacity:0!important}</style>', 1)
        tpl = tpl.replace("</body>", '<script src="/assets/ar.js?v=3" defer></script></body>', 1)
        open(os.path.join(tmp, "market", "index.html"), "w", encoding="utf-8").write(tpl)
        open(os.path.join(tmp, "sitemap.xml"), "w", encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://entekhab.net/market/</loc></url></urlset>')
        src = L.sources(tpl)
        cache = os.path.join(tmp, "cache")
        fake_cache(cache, src)
        r = B.build(tmp, cache_dir=cache)
        ok("a page for each of the 43 languages", r["pages"] == 43 and all(os.path.exists(os.path.join(tmp, "market", c, "index.html")) for c in pro_langs.NEW))
        ok("ready for search engines: de and iw (page text in), not jp", sorted(r["ready"]) == ["de", "iw"], r["ready"])
        de = open(os.path.join(tmp, "market", "de", "index.html"), encoding="utf-8").read()
        iw = open(os.path.join(tmp, "market", "iw", "index.html"), encoding="utf-8").read()
        jp = open(os.path.join(tmp, "market", "jp", "index.html"), encoding="utf-8").read()
        es = open(os.path.join(tmp, "market", "es", "index.html"), encoding="utf-8").read()
        ok("<html> says the language, its direction and the workspace language", '<html lang="de" dir="ltr" data-pro-lang="de" data-noar="1">' in de and '<html lang="he" dir="rtl" data-pro-lang="iw" data-noar="1">' in iw)
        ok("its own title, description and canonical address", "<title>«de» Live market: multi-chart, replay and price alerts | entekhab.net</title>" in de
           and '<meta name="description" content="«de» Live crypto charts' in de and '<link rel="canonical" href="https://entekhab.net/market/de/">' in de)
        ok("og:url and the structured data name the page and its language", '<meta property="og:url" content="https://entekhab.net/market/de/">' in de and '"inLanguage": "de"' in de and '"BreadcrumbList"' in de)
        ok("hreflang: /market/ (x-default, fa) and the ready languages only", 'hreflang="x-default" href="https://entekhab.net/market/"' in de and 'hreflang="de" href="https://entekhab.net/market/de/"' in de
           and 'hreflang="he" href="https://entekhab.net/market/iw/"' in de and 'hreflang="ja"' not in de)
        ok("a language without its page text works but says noindex", '<meta name="robots" content="noindex,follow">' in jp and "noindex" not in de)
        ok("…and its page text is the English, not someone else's", "<title>Live market: multi-chart, replay and price alerts | entekhab.net</title>" in es)
        ok("the heading in the language, the Persian one hidden", '<span data-lang="de">«de» Live market</span>' in de and '<span data-lang="fa" hidden>' in de)
        ok("the about section in the language (tags kept), the Persian one hidden", '<section class="pm-about" data-lang="de" lang="de" dir="ltr">' in de and "<b>«de» 17 chart types:</b>" in de and '<section class="pm-about" data-lang="fa" hidden>' in de)
        ok("no Arabic layer on these pages", 'id="ek-ar-h"' not in de and "/assets/ar.js" not in de)
        ok("no redirect script (that one is for /market/ itself)", 'id="pm-lang-go"' not in de)
        ok("the shared header in English from the first paint", ">Live market<" in de or ">Market<" in de, re.findall(r'class="ek-i[^"]*"[^>]*>([^<]*)<', de)[:6])
        ok("the header's labels too", 'aria-label="Search" title="Search"' in de and 'aria-label="جستجو"' not in de)
        m = re.search(r'<script src="(/assets/pro/l10n/de\.js\?v=[0-9a-f]{8})" defer></script>', de)
        ok("the page loads its string pack right after i18n.js (cache-busted by content)", bool(m) and de.index("/assets/pro/i18n.js") < de.index("/assets/pro/l10n/de.js") < de.index("/assets/pro/app.js"))
        pack = open(os.path.join(tmp, "assets", "pro", "l10n", "de.js"), encoding="utf-8").read()
        node = subprocess.run(["node", "-e", "global.window=globalThis;require(process.argv[1]);require(process.argv[2]);const S=PRO.STR.de;"
                               "process.stdout.write(JSON.stringify({n:Object.keys(S).length,ind:PRO.tr('de','indicators'),miss:PRO.tr('de','nope-key'),stale:S.stale||null,en:PRO.tr('en','indicators')}))",
                               os.path.join(ROOT, "assets", "pro", "i18n.js"), os.path.join(tmp, "assets", "pro", "l10n", "de.js")], capture_output=True, text=True)
        j = json.loads(node.stdout or "{}")
        ok("the pack is valid JS that adds the language to P.STR (and leaves English alone)", j.get("ind") == "«de» Indicators" and j.get("en") == "Indicators", node.stderr[-300:] or j)
        ok("the pack holds the workspace strings only, never a stale one", j.get("stale") is None and j.get("n") == len(L.ui_strings()), j.get("n"))
        jpack = open(os.path.join(tmp, "assets", "pro", "l10n", "jp.js"), encoding="utf-8").read()
        ok("jp's pack has its strings even though its page text is missing", "«jp» Indicators" in jpack)
        ok("an untranslated language still gets an (empty) pack", os.path.exists(os.path.join(tmp, "assets", "pro", "l10n", "es.js")))
        for c in ("fa", "ckb", "ar", "en"):
            st = open(os.path.join(tmp, "market", c, "index.html"), encoding="utf-8").read()
            if not ('url=/market/?lang=' + c in st and 'location.replace("/market/?lang=' + c + '"' in st and "noindex" in st and 'rel="canonical" href="https://entekhab.net/market/"' in st):
                ok(f"/market/{c}/ forwards to /market/ in {c}", False, st[:300])
                break
        else:
            ok("/market/fa|ckb|ar|en/ forward to /market/ in that language (noindex, canonical /market/)", True)
        mk = open(os.path.join(tmp, "market", "index.html"), encoding="utf-8").read()
        ok("/market/ itself links its ready languages", 'hreflang="de" href="https://entekhab.net/market/de/"' in mk and mk.count("<!--pm:alt-->") == 1)
        sm = open(os.path.join(tmp, "sitemap.xml"), encoding="utf-8").read()
        ok("the sitemap lists the ready languages only", "https://entekhab.net/market/de/" in sm and "https://entekhab.net/market/iw/" in sm and "/market/jp/" not in sm)
        snap = {p: open(p, encoding="utf-8").read() for p in [os.path.join(tmp, "market", "de", "index.html"), os.path.join(tmp, "market", "index.html"), os.path.join(tmp, "sitemap.xml")]}
        B.build(tmp, cache_dir=cache)
        ok("a second run changes nothing", all(open(p, encoding="utf-8").read() == t for p, t in snap.items()))
        # the language's own script: the builder never mixes another page's text in
        ok("the right-to-left page keeps Hebrew metadata", "«iw»" in iw and 'dir="rtl"' in iw.split("<head>")[0] + iw[:200])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nOK")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
