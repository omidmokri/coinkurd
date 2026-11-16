#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""assets/i18n.js in a real browser: the globe in the site menu, its panel of languages, and the page translated.

A small site is served from a temporary folder — one page with the site's four language buttons, the dictionaries
scripts/i18n_site.py would have written, and the real assets/i18n.js. Checks:
  * the globe appears beside the four buttons, and only when a language is ready to offer;
  * its panel lists the ready languages by their own name, and the search box narrows them;
  * picking one stores the choice, drops any Arabic choice, and the page then reads in that language;
  * <html lang> and <html dir> follow the language, and right-to-left languages turn the page around;
  * text the page's own scripts write afterwards is translated too;
  * a string with no entry stays in English, and the site's own four buttons are left alone;
  * going back to the site's own languages clears the choice.
Run: python3 tests/test_i18n_globe.py   (needs playwright, already installed)
"""
import json
import os
import shutil
import sys
import tempfile
import threading
import http.server
import functools

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAILS = []


def ok(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f" — {extra}" if extra and not cond else ""))
    if not cond:
        FAILS.append(name)


PAGE = """<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><title>Live market</title></head>
<body>
<nav id="langs">
  <button type="button" data-l="ckb" lang="ckb">کوردی</button>
  <button type="button" data-l="fa" lang="fa">فارسی</button>
  <button type="button" data-l="ar" lang="ar">العربية</button>
  <button type="button" data-l="en" lang="en">English</button>
</nav>
<h1>Live market</h1>
<p id="p1">Every Binance coin</p>
<p id="p2">2,191 transactions</p>
<p id="p3">Nothing has an entry for this sentence yet.</p>
<input id="q" placeholder="Search a coin">
<div id="later"></div>
<script src="/assets/app.js"></script>
<script src="/assets/i18n.js?v=1" defer></script>
</body></html>"""


def serve(dirpath):
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=dirpath)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright missing — skipping")
        return
    tmp = tempfile.mkdtemp()
    try:
        os.makedirs(os.path.join(tmp, "assets"), exist_ok=True)
        os.makedirs(os.path.join(tmp, "i18n", "de", "page"), exist_ok=True)
        os.makedirs(os.path.join(tmp, "i18n", "de", "js"), exist_ok=True)
        os.makedirs(os.path.join(tmp, "i18n", "ur", "page"), exist_ok=True)
        shutil.copy(os.path.join(ROOT, "assets", "i18n.js"), os.path.join(tmp, "assets", "i18n.js"))
        open(os.path.join(tmp, "assets", "app.js"), "w").write(
            "setTimeout(function(){document.getElementById('later').textContent='Every Binance coin';},30);")
        open(os.path.join(tmp, "index.html"), "w", encoding="utf-8").write(PAGE)
        json.dump({"ready": [
            {"code": "de", "native": "Deutsch", "english": "German", "dir": "ltr", "pct": 92},
            {"code": "tr", "native": "Türkçe", "english": "Turkish", "dir": "ltr", "pct": 88},
            {"code": "ur", "native": "اردو", "english": "Urdu", "dir": "rtl", "pct": 80},
        ]}, open(os.path.join(tmp, "i18n", "langs.json"), "w", encoding="utf-8"), ensure_ascii=False)
        json.dump({"Live market": "Live-Markt", "Every Binance coin": "Jede Binance-Münze"},
                  open(os.path.join(tmp, "i18n", "de", "common.json"), "w", encoding="utf-8"), ensure_ascii=False)
        json.dump({"{1} transactions": "{1} Transaktionen", "Search a coin": "Eine Münze suchen"},
                  open(os.path.join(tmp, "i18n", "de", "page", "home.json"), "w", encoding="utf-8"), ensure_ascii=False)
        json.dump({}, open(os.path.join(tmp, "i18n", "de", "js", "app.json"), "w", encoding="utf-8"))
        json.dump({"Live market": "لائیو مارکیٹ"},
                  open(os.path.join(tmp, "i18n", "ur", "common.json"), "w", encoding="utf-8"), ensure_ascii=False)
        srv, url = serve(tmp)

        with sync_playwright() as pw:
            b = pw.chromium.launch()
            pg = b.new_page()
            pg.goto(url + "/", wait_until="networkidle")

            ok("the globe sits beside the site's own four buttons",
               pg.locator("#langs .ek-gl").count() == 1 and pg.locator("#langs button[data-l]").count() == 4)
            ok("the site's own four buttons are untouched",
               pg.locator('#langs button[data-l="ckb"]').inner_text() == "کوردی"
               and pg.locator('#langs button[data-l="en"]').inner_text() == "English")
            ok("the globe turns (it has the spinning group)", pg.locator("#langs .ek-gl svg .ek-sp").count() == 1)

            pg.click("#langs .ek-gl")
            pg.wait_for_selector(".ek-gp")
            names = pg.locator(".ek-gl-list button .n").all_inner_texts()
            ok("the panel lists the ready languages by their own name", names == ["Deutsch", "Türkçe", "اردو"], names)
            pg.fill(".ek-gs", "türk")
            vis = [n for i, n in enumerate(names) if pg.locator(".ek-gl-list button").nth(i).is_visible()]
            ok("the search box narrows the list", vis == ["Türkçe"], vis)
            pg.fill(".ek-gs", "")
            pg.click('.ek-gl-list button[data-code="de"]')
            pg.wait_for_load_state("networkidle")

            ok("the choice is stored and any Arabic choice dropped",
               pg.evaluate("localStorage.getItem('ek_l')") == "de" and not pg.evaluate("localStorage.getItem('ek_ar')"))
            ok("<html lang> and <html dir> follow the language",
               pg.evaluate("document.documentElement.lang") == "de" and pg.evaluate("document.documentElement.dir") == "ltr")
            ok("the page reads in the chosen language", pg.locator("h1").inner_text() == "Live-Markt")
            ok("a string with a number in it is matched as a pattern", pg.locator("#p2").inner_text() == "2,191 Transaktionen")
            ok("an attribute is translated too", pg.get_attribute("#q", "placeholder") == "Eine Münze suchen")
            ok("a string with no entry stays in English", "Nothing has an entry" in pg.locator("#p3").inner_text())
            pg.wait_for_timeout(400)
            ok("text a script writes afterwards is translated too", pg.locator("#later").inner_text() == "Jede Binance-Münze")
            ok("the globe shows the site is in another language", "on" in (pg.get_attribute("#langs .ek-gl", "class") or ""))

            # a right-to-left language turns the page around
            pg.evaluate("localStorage.setItem('ek_l','ur')")
            pg.reload(wait_until="networkidle")
            ok("a right-to-left language turns the page around",
               pg.evaluate("document.documentElement.dir") == "rtl" and pg.locator("h1").inner_text() == "لائیو مارکیٹ")

            # back to the site's own languages
            pg.click("#langs .ek-gl")
            pg.wait_for_selector(".ek-gp")
            pg.click(".ek-gf button")
            pg.wait_for_load_state("networkidle")
            ok("going back to the site's own languages clears the choice",
               not pg.evaluate("localStorage.getItem('ek_l')") and pg.locator("h1").inner_text() == "Live market")

            # nothing ready yet: no globe at all
            json.dump({"ready": []}, open(os.path.join(tmp, "i18n", "langs.json"), "w"))
            pg.goto(url + "/?x=2", wait_until="networkidle")
            ok("with no language ready the globe is not shown", pg.locator("#langs .ek-gl").count() == 0)
            b.close()
        srv.shutdown()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nOK")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
