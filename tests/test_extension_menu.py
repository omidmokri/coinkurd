#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""The extension must reach every part of the site, without the user going to the site to find it.

The popup used to carry eight hand-written links while the site's menu had seventy-odd entries, so the two drifted
apart with every page added. Now the list is generated from chrome.NAV, the one place the site's own header is
built from. This test holds that promise: it regenerates the list and checks that nothing in the menu is missing
from it, that the package actually ships and loads it, and that every label exists in all three languages NAV
carries. Run: python3 tests/test_extension_menu.py"""
import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import build_extension as E  # noqa: E402
import chrome  # noqa: E402

FAILS = []


def ok(what, cond, got=None):
    print(("PASS " if cond else "FAIL ") + what + ("" if cond else "  -> " + repr(got)))
    if not cond:
        FAILS.append(what)


n_pages, n_cats = E.site_pages()
path = os.path.join(E.SRC, "pages.js")
ok("the build writes pages.js into the package source", os.path.exists(path))
raw = open(path, encoding="utf-8").read()
ok("it is a plain assignment the popup can load", raw.rstrip().endswith(";") and "window.EK_PAGES=" in raw)
doc = json.loads(raw.split("window.EK_PAGES=", 1)[1].rstrip().rstrip(";"))

# ---------------------------------------------------------------- nothing in the site's menu is missing
want = {}
for c in chrome.NAV:
    for href, _ic, title, _d in c["items"]:
        want[href] = (c["k"], title)
want[chrome.BATTLE[0]] = ("battle", chrome.BATTLE[2])
have = {it["h"]: (c["k"], it["t"]) for c in doc["cats"] for it in c["items"]}

missing = sorted(set(want) - set(have))
extra = sorted(set(have) - set(want))
ok("every page in the site's menu is in the extension", not missing, missing)
ok("the extension invents no page the site does not have", not extra, extra)
ok("the count the build reports is the count in the file", n_pages == len(have), (n_pages, len(have)))
ok("there are far more than the eight links the popup used to carry", len(have) >= 60, len(have))

wrong = [h for h in want if h in have and have[h][0] != want[h][0]]
ok("each page keeps the section the site put it in", not wrong, wrong)

bad_lang = [h for h, (_k, t) in have.items() if not all(t.get(l) for l in ("fa", "ckb", "en"))]
ok("every label is there in Persian, Sorani and English", not bad_lang, bad_lang[:5])
bad_cat = [c["k"] for c in doc["cats"] if not all(c["t"].get(l) for l in ("fa", "ckb", "en"))]
ok("every section name is there in all three languages", not bad_cat, bad_cat)

ok("addresses are site paths, not full links", all(h.startswith("/") for h in have), [h for h in have if not h.startswith("/")][:3])
ok("the site's address is carried once, not repeated on every row", doc.get("site", "").startswith("http"), doc.get("site"))

# ---------------------------------------------------------------- the package ships it and the popup loads it
html = open(os.path.join(E.SRC, "popup.html"), encoding="utf-8").read()
ok("the popup loads pages.js", 'src="pages.js"' in html)
ok("pages.js is loaded before popup.js, which reads it",
   html.index('src="pages.js"') < html.index('src="popup.js"'))
ok("the popup has a tab for it", 'data-tab="pages"' in html and 'data-pane="pages"' in html)

js = open(os.path.join(E.SRC, "popup.js"), encoding="utf-8").read()
ok("the popup renders the list when that tab is opened", "renderPages()" in js and "EK_PAGES" in js)
for lang in ("fa", "ckb", "ar", "en"):
    ok(f"the tab is named in {lang}", f"tPages:" in js and js.count("tPages:") == 4, js.count("tPages:"))
    break
ok("the tab is named in all four languages the popup speaks", js.count("tPages:") == 4, js.count("tPages:"))
ok("the search box is named in all four languages", js.count("pagesSearch:") == 4, js.count("pagesSearch:"))

# the Telegram bot has its own list of every page, built from the same menu; the two must not disagree,
# or a user would find a page in one place and not the other
import bot_pages as BOT  # noqa: E402
bot = {h for _t, items in BOT.pages() for h, _lab in items}
ok("the extension and the Telegram bot offer exactly the same pages", bot == set(have),
   {"only in the bot": sorted(bot - set(have)), "only in the extension": sorted(set(have) - bot)})

ver, name, size, fx, fx_size, _latest = E.package()
with zipfile.ZipFile(os.path.join(E.OUT, name)) as z:
    names = z.namelist()
ok("pages.js is inside the packaged extension", "pages.js" in names, [n for n in names if n.endswith(".js")])
with zipfile.ZipFile(os.path.join(E.OUT, name)) as z:
    shipped = z.read("pages.js").decode("utf-8")
ok("what ships is what the build just generated", shipped == raw)

print(f"\nextension menu: {len(have)} pages in {len(doc['cats'])} sections, version {ver}")
print(("%d failure(s)" % len(FAILS)) if FAILS else "0 failures")
raise SystemExit(1 if FAILS else 0)
