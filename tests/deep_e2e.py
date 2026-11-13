#!/usr/bin/env python3
"""End-to-end check of the depth layer of the inner pages (assets/deep.{css,js}, switch in scripts/chrome.py).

It needs a BUILT copy of the site (the generated pages are not in the repo):

    cp -r . /tmp/bld && cd /tmp/bld && python3 scripts/build_pages.py && python3 scripts/build_reality.py \
        && python3 scripts/build_trackrecord.py && python3 scripts/chrome.py
    python3 tests/deep_e2e.py /tmp/bld          # serves the tree itself; exit code 1 on any failure

Outside requests are blocked, so the test needs no network. Chrome: /usr/bin/google-chrome (CHROME=... to override).
"""
import asyncio
import functools
import http.server
import os
import sys
import threading

from playwright.async_api import async_playwright

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
PORT = int(os.environ.get("PORT", "8791"))
BASE = f"http://127.0.0.1:{PORT}"
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
FAILS, OK = [], [0]


def check(cond, what):
    if cond:
        OK[0] += 1
    else:
        FAILS.append(what)
        print("  FAIL", what)


def first(*cands):
    for c in cands:
        if os.path.exists(os.path.join(ROOT, c.strip("/"), "index.html")):
            return c
    return None


def a_post():
    d = os.path.join(ROOT, "p")
    ids = sorted((x for x in os.listdir(d) if x.isdigit()), key=int) if os.path.isdir(d) else []
    return f"/p/{ids[-1]}/" if ids else None


async def page_for(ctx, path, errs):
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(f"{path}: {str(e)[:200]}"))
    await pg.goto(BASE + path, wait_until="load")
    await pg.wait_for_timeout(700)
    return pg


async def run():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass
    handler = functools.partial(Quiet, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    long_page = first("/track-record/", "/reality/", "/about/")
    post = a_post()
    inner = [p for p in (long_page, post, first("/coins/btc/"), first("/tools/"), first("/dashboard/"), first("/glossary/"), first("/about/"), first("/privacy/")) if p]
    off = [p for p in ("/", first("/battle/"), first("/market/"), first("/kids/")) if p]
    async with async_playwright() as pw:
        br = await pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        async def context(width, **kw):
            gpu = kw.pop("gpu", "hw")
            ctx = await br.new_context(viewport={"width": width, "height": 844 if width < 600 else 800}, **kw)
            # headless Chrome draws in software, which the site answers with its lite mode (assets/nx.js); say which one is under test
            await ctx.add_init_script("try{localStorage.setItem('ek_gpu','%s:'+Date.now())}catch(e){}" % gpu)

            async def route(r):
                u = r.request.url
                await (r.continue_() if u.startswith(BASE) or u.startswith(("data:", "blob:")) else r.abort())
            await ctx.route("**/*", route)
            return ctx

        for width in (1280, 390):
            print(f"== width {width}")
            ctx, errs = await context(width), []
            # 1. where the layer is on, and where it must stay off
            for p in inner:
                pg = await page_for(ctx, p, errs)
                st = await pg.evaluate("({deep:document.documentElement.classList.contains('ek-deep'),css:!!document.querySelector('link[href*=\"/assets/deep.css\"]'),"
                                       "js:!!window.ekDeep,ov:document.documentElement.scrollWidth-document.documentElement.clientWidth,"
                                       "sky:getComputedStyle(document.documentElement,'::after').position,prog:!!document.getElementById('ds-prog')})")
                check(st["deep"] and st["css"] and st["js"], f"{p} @{width}: layer is on ({st})")
                check(st["sky"] == "fixed", f"{p} @{width}: the floor layer is painted")
                check(st["ov"] <= 0, f"{p} @{width}: no sideways scroll (overflow {st['ov']}px)")
                check(st["prog"], f"{p} @{width}: progress line exists")
                await pg.close()
            for p in off:
                pg = await page_for(ctx, p, errs)
                st = await pg.evaluate("({deep:document.documentElement.classList.contains('ek-deep'),css:!!document.querySelector('link[href*=\"/assets/deep.css\"]'),js:!!window.ekDeep})")
                check(not st["deep"] and not st["css"] and not st["js"], f"{p} @{width}: layer stays off ({st})")
                await pg.close()

            # 2. arriving: blocks below the fold wait, and every one of them is shown once the page has been read to the end
            if long_page:
                pg = await page_for(ctx, long_page, errs)
                waiting = await pg.evaluate("document.querySelectorAll('.ds-rv').length")
                check(waiting > 0, f"{long_page} @{width}: blocks below the first screen wait to arrive ({waiting})")
                above = await pg.evaluate("[].filter.call(document.querySelectorAll('.ds-rv'),e=>e.getBoundingClientRect().top<innerHeight*.9).length")
                check(above == 0, f"{long_page} @{width}: nothing on the first screen is hidden ({above})")
                h = await pg.evaluate("document.documentElement.scrollHeight")
                y = 0
                while y < h:
                    y += 500
                    await pg.evaluate(f"scrollTo(0,{y})")
                    await pg.wait_for_timeout(110)
                await pg.wait_for_timeout(1500)
                left = await pg.evaluate("document.querySelectorAll('.ds-rv').length")
                check(left == 0, f"{long_page} @{width}: every block has arrived at the end of the page ({left} still hidden)")
                # 3. progress: full at the bottom
                sx = await pg.evaluate("new DOMMatrix(getComputedStyle(document.querySelector('#ds-prog i')).transform).a")
                on = await pg.evaluate("document.getElementById('ds-prog').classList.contains('on')")
                check(on and sx > 0.97, f"{long_page} @{width}: progress line is full at the bottom (scaleX {sx:.3f}, on {on})")
                await pg.evaluate("scrollTo(0,0)")
                await pg.wait_for_timeout(300)
                on = await pg.evaluate("document.getElementById('ds-prog').classList.contains('on')")
                check(not on, f"{long_page} @{width}: progress line is hidden at the top")
                # 4. rail: only on wide screens; a click brings its section under the header
                await pg.wait_for_timeout(1200)
                n = await pg.evaluate("document.querySelectorAll('#ds-rail a').length")
                shown = await pg.evaluate("(function(){var r=document.getElementById('ds-rail');return !!r&&getComputedStyle(r).display!=='none'})()")
                if width >= 1100:
                    check(n >= 3 and shown, f"{long_page} @{width}: the rail lists the sections ({n})")
                    if n >= 3:
                        await pg.evaluate("document.querySelectorAll('#ds-rail a')[2].click()")
                        await pg.wait_for_timeout(1300)
                        top = await pg.evaluate("document.getElementById(document.querySelectorAll('#ds-rail a')[2].getAttribute('href').slice(1)).getBoundingClientRect().top")
                        cur = await pg.evaluate("[].findIndex.call(document.querySelectorAll('#ds-rail a'),a=>a.classList.contains('on'))")
                        check(60 < top < 220, f"{long_page} @{width}: a rail click brings the section just under the header (top {top:.0f}px)")
                        check(cur == 2, f"{long_page} @{width}: the rail marks the section being read (index {cur})")
                else:
                    check(not shown, f"{long_page} @{width}: no rail on a small screen")
                await pg.close()

            # 5. search: Ctrl+K opens it; typing lists sections and a coin page; arrows + Enter go there; plain Enter still searches the archive
            if width >= 1100 and inner:
                pg = await page_for(ctx, inner[0], errs)
                await pg.keyboard.press("Control+k")
                await pg.wait_for_timeout(400)
                check(await pg.evaluate("!!document.querySelector('#ekq.open')"), "Ctrl+K opens the site search")
                await pg.keyboard.type("dca")
                await pg.wait_for_timeout(500)
                rows = await pg.evaluate("[].map.call(document.querySelectorAll('#ekq .ds-qr li a'),a=>a.getAttribute('href'))")
                check(any(r == "/dca/" for r in rows), f"typing 'dca' lists the DCA page ({rows})")
                check(rows and rows[-1].startswith("/?q=dca"), f"the last row searches the archive ({rows[-1:]})")
                await pg.fill("#ekq input", "")
                await pg.keyboard.type("btc")
                await pg.wait_for_timeout(600)
                rows = await pg.evaluate("[].map.call(document.querySelectorAll('#ekq .ds-qr li a'),a=>a.getAttribute('href'))")
                if os.path.exists(os.path.join(ROOT, "api/v1/index.json")):
                    check("/coins/btc/" in rows, f"typing 'btc' offers the coin page ({rows})")
                await pg.fill("#ekq input", "")
                await pg.keyboard.type("واقعیت")
                await pg.wait_for_timeout(400)
                rows = await pg.evaluate("[].map.call(document.querySelectorAll('#ekq .ds-qr li a'),a=>a.getAttribute('href'))")
                check("/reality/" in rows, f"a Persian word finds its section ({rows})")
                await pg.fill("#ekq input", "<img src=x onerror=window.__x=1>")
                await pg.wait_for_timeout(300)
                check(not await pg.evaluate("!!window.__x||!!document.querySelector('#ekq .ds-qr img')"), "typed text is never treated as markup")
                await pg.fill("#ekq input", "")
                await pg.keyboard.type("dca")
                await pg.wait_for_timeout(300)
                await pg.keyboard.press("ArrowDown")
                sel = await pg.evaluate("(document.querySelector('#ekq .ds-qr li.on a')||{getAttribute(){return null}}).getAttribute('href')")
                check(sel is not None, "Arrow-down selects a row")
                async with pg.expect_navigation():
                    await pg.keyboard.press("Enter")
                check(pg.url.rstrip("/").endswith(sel.rstrip("/")), f"Enter on a selected row goes there ({pg.url} vs {sel})")
                await pg.close()
                pg = await page_for(ctx, inner[0], errs)
                await pg.keyboard.press("Control+k")
                await pg.wait_for_timeout(300)
                await pg.keyboard.type("halving")
                async with pg.expect_navigation():
                    await pg.keyboard.press("Enter")
                check("/?q=halving" in pg.url, f"Enter with no row selected still searches the archive ({pg.url})")
                await pg.close()
            check(not errs, f"no JavaScript errors @{width}: {errs[:3]}")
            await ctx.close()

        # 6. a visitor who asked for less motion: nothing waits, nothing moves
        if long_page:
            ctx, errs = await context(1280, reduced_motion="reduce"), []
            pg = await page_for(ctx, long_page, errs)
            st = await pg.evaluate("({rv:document.querySelectorAll('.ds-rv').length,an:getComputedStyle(document.body,'::before').animationName})")
            check(st["rv"] == 0 and st["an"] == "none", f"reduced motion: nothing is hidden and the sky is still ({st})")
            await ctx.close()
        # 6b. a device without a graphics chip (lite mode): the sky is there, nothing waits, nothing moves
        if long_page:
            ctx, errs = await context(1280, gpu="sw"), []
            pg = await page_for(ctx, long_page, errs)
            st = await pg.evaluate("({lite:document.documentElement.classList.contains('nx-lite'),rv:document.querySelectorAll('.ds-rv').length,"
                                   "an:getComputedStyle(document.body,'::before').animationName,fl:getComputedStyle(document.documentElement,'::after').animationName})")
            check(st["lite"] and st["rv"] == 0 and st["an"] == "none" and st["fl"] == "none", f"lite mode: nothing is hidden, nothing moves ({st})")
            await ctx.close()
        # 7. no JavaScript at all: the page is complete (the switch never runs, nothing is hidden)
        if long_page:
            ctx = await br.new_context(viewport={"width": 1280, "height": 800}, java_script_enabled=False)
            pg = await ctx.new_page()
            await pg.goto(BASE + long_page, wait_until="load")
            check(await pg.locator("h1").first.is_visible(), "without JavaScript the page still shows")
            await ctx.close()
        await br.close()
    srv.shutdown()
    print(f"deep e2e: {OK[0]} checks passed, {len(FAILS)} failed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
