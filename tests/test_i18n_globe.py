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
  <button type="button" class="pm-hglobe">47</button>
  <button type="button" data-l="ckb" lang="ckb">کوردی</button>
  <button type="button" data-l="fa" lang="fa">فارسی</button>
  <button type="button" data-l="ar" lang="ar">العربية</button>
  <button type="button" data-l="en" lang="en">English</button>
</nav>
<div class="lsw"><button data-l="ckb">کوردی</button><button data-l="fa">فارسی</button><button data-l="en">English</button></div>
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
        os.makedirs(os.path.join(tmp, "market"), exist_ok=True)
        open(os.path.join(tmp, "market", "index.html"), "w", encoding="utf-8").write(PAGE)
        os.makedirs(os.path.join(tmp, "assets", "pro", "flags"), exist_ok=True)
        for cc in ("de", "tr", "pk", "kurdistan", "ir", "sa", "gb"):
            open(os.path.join(tmp, "assets", "pro", "flags", cc + ".svg"), "w").write(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#888"/></svg>')
        F = "/assets/pro/flags/"
        json.dump({"ready": [
            {"code": "de", "native": "Deutsch", "english": "German", "dir": "ltr", "pct": 92, "flag": F + "de.svg"},
            {"code": "tr", "native": "Türkçe", "english": "Turkish", "dir": "ltr", "pct": 88, "flag": F + "tr.svg"},
            {"code": "ur", "native": "اردو", "english": "Urdu", "dir": "rtl", "pct": 80, "flag": F + "pk.svg"},
        ], "flags": {"de": F + "de.svg", "tr": F + "tr.svg", "ur": F + "pk.svg",
                     "ckb": F + "kurdistan.svg", "fa": F + "ir.svg", "ar": F + "sa.svg", "en": F + "gb.svg"}},
            open(os.path.join(tmp, "i18n", "langs.json"), "w", encoding="utf-8"), ensure_ascii=False)
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

            ok("the globe sits in the bar, in the same place /market/ keeps it (first)",
               pg.locator("#langs .ekw-globe").count() == 1
               and pg.evaluate("document.querySelector('#langs').firstElementChild.classList.contains('ekw-globe')"))
            ok("only one globe shows: the site's own 47-pill gives way to ours",
               pg.locator("#langs .ekw-globe").count() == 1
               and not pg.locator("#langs .pm-hglobe").is_visible())
            ok("the lesson pages' own three-way switch is left alone: no globe in it, Persian still offered",
               pg.locator(".lsw .ekw-globe").count() == 0
               and pg.locator('.lsw button[data-l="fa"]').is_visible())
            ok("Kurdish and English stay in the bar",
               pg.locator('#langs button[data-l="ckb"]').is_visible()
               and pg.locator('#langs button[data-l="en"]').is_visible())
            ok("Persian and Arabic move inside the globe, but their buttons are only hidden",
               not pg.locator('#langs button[data-l="fa"]').is_visible()
               and not pg.locator('#langs button[data-l="ar"]').is_visible()
               and pg.locator('#langs button[data-l]').count() == 4)
            ok("the globe shows how many languages there are in all",
               pg.locator("#langs .ekw-globe b").inner_text() == "7", pg.locator("#langs .ekw-globe b").inner_text())
            ok("the globe turns (it has the spinning group)", pg.locator("#langs .ekw-globe svg .ekw-spin").count() == 1)

            pg.click("#langs .ekw-globe")
            pg.wait_for_selector(".ekw-panel")
            names = pg.locator(".ekw-more button .n").all_inner_texts()
            ok("the panel lists the ready languages by their own name", names == ["Deutsch", "Türkçe", "اردو"], names)
            ok("every language in the panel wears a flag",
               pg.locator(".ekw-more button .ekw-flag").count() == 3
               and pg.locator(".ekw-own button .ekw-flag").count() == 4)
            ok("Kurdish wears the flag of the Kurdistan Region",
               (pg.get_attribute('.ekw-own button[data-code="ckb"] .ekw-flag', "src") or "").endswith("/kurdistan.svg"))
            own = pg.locator(".ekw-own button .n").all_inner_texts()
            ok("the site's own languages are in the panel too, Persian and Arabic among them",
               "فارسی" in own and "العربية" in own and "English" in own, own)
            pg.fill(".ekw-search", "türk")
            vis = [n for i, n in enumerate(names) if pg.locator(".ekw-more button").nth(i).is_visible()]
            ok("the search box narrows the list", vis == ["Türkçe"], vis)
            pg.fill(".ekw-search", "")
            pg.click('.ekw-more button[data-code="de"]')
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
            pg.click("#langs .ekw-globe")
            pg.wait_for_selector(".ekw-panel")
            ok("the panel marks the language the reader is in",
               pg.locator('.ekw-more button[data-code="de"].on').count() == 1)
            pg.keyboard.press("Escape")

            # a right-to-left language turns the page around
            pg.evaluate("localStorage.setItem('ek_l','ur')")
            pg.reload(wait_until="networkidle")
            ok("a right-to-left language turns the page around",
               pg.evaluate("document.documentElement.dir") == "rtl" and pg.locator("h1").inner_text() == "لائیو مارکیٹ")

            # back to the site's own languages
            pg.click("#langs .ekw-globe")
            pg.wait_for_selector(".ekw-panel")
            pg.click(".ekw-foot button")
            pg.wait_for_load_state("networkidle")
            ok("going back to the site's own languages clears the choice",
               not pg.evaluate("localStorage.getItem('ek_l')") and pg.locator("h1").inner_text() == "Live market")

            # nothing ready yet: no globe at all
            json.dump({"ready": []}, open(os.path.join(tmp, "i18n", "langs.json"), "w"))
            pg.goto(url + "/?x=2", wait_until="networkidle")
            ok("with no language ready the globe is not shown", pg.locator("#langs .ekw-globe").count() == 0)

            # /market/ runs its own picker on the same pill: this layer must not add a second globe
            json.dump({"ready": [
                {"code": "de", "native": "Deutsch", "english": "German", "dir": "ltr", "pct": 92,
                 "flag": "/assets/pro/flags/de.svg"}]},
                open(os.path.join(tmp, "i18n", "langs.json"), "w", encoding="utf-8"), ensure_ascii=False)
            pg.goto(url + "/market/", wait_until="networkidle")
            ok("on /market/ no second globe is added",
               pg.locator("#langs .ekw-globe").count() == 0)
            ok("on /market/ the page's own 47-pill stays visible",
               pg.locator("#langs .pm-hglobe").is_visible())
            b.close()
        srv.shutdown()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nOK")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
