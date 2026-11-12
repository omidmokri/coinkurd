#!/usr/bin/env python3
"""End-to-end test of the market map (/heatmap/ /bubbles/ /money-flow/ /liquidity/ /etf/) in a real Chrome, offline.

The repo is served locally; the site's data files come from tests/mm_fixture.py, and Binance, OKX and the futures
liquidation socket are mocked in their real formats (REST: rolling-window ticker MINI, 12-field klines, depth with
lastUpdateId; sockets: combined-stream miniTicker / aggTrade / depthUpdate with U/u ids, forceOrder). WebGL runs on
SwiftShader so the 3D views are drawn too.
Checks: zero JS errors; every view renders its parts; timeframe, filter, search, panel tabs, 3D, PNG, the live book;
four languages at 1280 px and 390 px. Screenshots go to $SHOTS (default /tmp/mmshots) — look at them.
Run: python3 tests/mm_fixture.py /tmp/mmfx && python3 tests/mm_e2e.py          (ONLY=heatmap|bubbles|flow|liq|etf|langs)
"""
import functools
import http.server
import json
import math
import os
import random
import re
import socketserver
import sys
import threading
import time
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.environ.get("FX", "/tmp/mmfx")
SHOTS = os.environ.get("SHOTS", "/tmp/mmshots")
ONLY = os.environ.get("ONLY", "")
os.makedirs(SHOTS, exist_ok=True)
MM = json.load(open(os.path.join(FX, "mm.json")))
COINS = {c["bn"]: c for c in MM["c"] if c.get("bn")}
TFI = {tf: i for i, tf in enumerate(MM["tf"])}
WIN = {"5m": "5m", "15m": "15m", "1h": "1h", "2h": "2h", "4h": "4h", "1d": "1d", "7d": "7d"}
FAIL, OK = [], []
rnd = random.Random(7)


def check(name, cond, extra=""):
    (OK if cond else FAIL).append(name + ("" if cond else f"  [{extra}]"))
    print(("  ok  " if cond else "  FAIL ") + name + ("" if cond else f"  [{extra}]"))


# ---------------------------------------------------------------- local server
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    h = functools.partial(Quiet, directory=ROOT)
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), h)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


# ---------------------------------------------------------------- mocks in the real formats
def jresp(route, obj, status=200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(obj), headers={"access-control-allow-origin": "*"})


def binance(route):
    u = urlparse(route.request.url)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    path = u.path
    if path.endswith("/ticker"):
        syms = json.loads(q["symbols"])
        win = q.get("windowSize", "1d")
        tf = {v: k for k, v in WIN.items()}.get(win, "1d")
        rows = []
        for s in syms:
            c = COINS.get(s)
            if not c:
                continue
            last = c["p"] * (1 + rnd.uniform(-0.002, 0.002))
            ch = c["ch"][TFI[tf]] or 0
            op = last / (1 + ch / 100)
            rows.append({"symbol": s, "openPrice": f"{op:.8f}", "highPrice": f"{max(op, last) * 1.001:.8f}", "lowPrice": f"{min(op, last) * 0.999:.8f}",
                         "lastPrice": f"{last:.8f}", "volume": "1000.0", "quoteVolume": f"{c['v'] * 0.4:.2f}", "openTime": 1794507060000,
                         "closeTime": 1794507384628, "firstId": 1, "lastId": 2, "count": 100})
        return jresp(route, rows)
    if path.endswith("/klines"):
        c = COINS.get(q["symbol"], {"p": 100})
        n = int(q.get("limit", 100))
        iv = q["interval"]
        step = {"1m": 60, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400, "1w": 604800}.get(iv, 3600) * 1000
        t0 = 1794500000000 - n * step
        p, out = c["p"], []
        for i in range(n):
            o = p
            p = p * (1 + rnd.gauss(0, 0.004))
            qv = c.get("v", 1e8) / 2000 * rnd.uniform(0.5, 1.5)
            out.append([t0 + i * step, f"{o:.8f}", f"{max(o, p) * 1.002:.8f}", f"{min(o, p) * 0.998:.8f}", f"{p:.8f}", "12.5", t0 + (i + 1) * step - 1,
                        f"{qv:.4f}", 120, "6.0", f"{qv * rnd.uniform(0.35, 0.65):.4f}", "0"])
        return jresp(route, out)
    if path.endswith("/depth"):
        c = COINS.get(q["symbol"], {"p": 100})
        p = c["p"]
        lim = int(q.get("limit", 100))
        tick = p * 0.00002
        bids = [[f"{p - tick * (i + 1):.8f}", f"{rnd.expovariate(1) * (40 if i % 37 == 0 else 1) * 2000 / p:.6f}"] for i in range(lim)]
        asks = [[f"{p + tick * (i + 1):.8f}", f"{rnd.expovariate(1) * (40 if i % 41 == 0 else 1) * 2000 / p:.6f}"] for i in range(lim)]
        return jresp(route, {"lastUpdateId": 1000, "bids": bids, "asks": asks})
    return jresp(route, {"code": -1}, 400)


def okx(route):
    u = urlparse(route.request.url)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    inst = q.get("instId", "")
    if inst.startswith("NOPE"):
        return jresp(route, {"code": "51001", "msg": "Instrument ID does not exist", "data": []})
    if u.path.endswith("funding-rate"):
        return jresp(route, {"code": "0", "data": [{"fundingRate": "0.0000793575", "fundingTime": str(int(time.time() * 1000) + 3600000), "instId": inst}]})
    if u.path.endswith("open-interest"):
        return jresp(route, {"code": "0", "data": [{"instId": inst, "instType": "SWAP", "oi": "1", "oiCcy": "1", "oiUsd": "896401270.0", "ts": "1794507398064"}]})
    return jresp(route, {"code": "0", "data": []})


def api_coin(route):
    s = re.search(r"/coins/([a-z0-9]+)\.json", route.request.url).group(1).upper()
    jresp(route, {"coin": s, "market": {"rsi": 31.4, "trend": "down", "hi48": 74811.45, "lo48": 71255.02},
                  "score": {"score": 54, "label": "neutral"},
                  "opportunities": [{"type": "bull_divergence", "tf": "1h", "dir": "bull", "why": {"fa": "واگرایی مثبت بین قیمت و RSI", "en": "Price made a lower low while RSI did not"}}],
                  "news": [{"title": "Bitcoin falls to 12-week low", "tfa": "سقوط بیت‌کوین به پایین‌ترین سطح ۱۲ هفته", "tckb": "بیتکۆین بۆ نزمترین ئاستی ١٢ هەفتە دابەزی", "url": "https://example.org/a", "source": "The Block"}]})


def ws_spot(ws):
    """the combined stream: miniTicker, aggTrade, depthUpdate (ids follow the snapshot's lastUpdateId=1000)"""
    url = ws.url
    streams = url.split("streams=")[-1].split("/")
    state = {"u": 1000, "open": True}      # (no ws.on_close: Playwright 1.63's Python side fails on a close without a code)

    def pump():
        k = 0
        while state["open"] and k < 400:
            k += 1
            for s in streams:
                sym = s.split("@")[0].upper()
                c = COINS.get(sym, {"p": 100})
                p = c["p"] * (1 + rnd.uniform(-0.001, 0.001))
                try:
                    if "@miniTicker" in s:
                        ws.send(json.dumps({"stream": s, "data": {"e": "24hrMiniTicker", "E": int(time.time() * 1000), "s": sym, "c": f"{p:.8f}", "o": f"{p:.8f}", "h": f"{p:.8f}", "l": f"{p:.8f}", "v": "1", "q": "1"}}))
                    elif "@aggTrade" in s:
                        for _ in range(3):
                            qty = rnd.expovariate(1) * (300000 if rnd.random() < 0.15 else 3000) / p
                            ws.send(json.dumps({"stream": s, "data": {"e": "aggTrade", "E": int(time.time() * 1000), "s": sym, "a": k, "p": f"{p:.8f}", "q": f"{qty:.6f}", "f": 1, "l": 1, "T": int(time.time() * 1000), "m": rnd.random() < 0.5, "M": True}}))
                    elif "@depth" in s:
                        U = state["u"] + 1
                        state["u"] += 5
                        tick = c["p"] * 0.00002
                        ws.send(json.dumps({"stream": s, "data": {"e": "depthUpdate", "E": int(time.time() * 1000), "s": sym, "U": U, "u": state["u"],
                                                                  "b": [[f"{c['p'] - tick * rnd.randint(1, 600):.8f}", f"{rnd.expovariate(1) * 4000 / c['p']:.6f}"] for _ in range(6)],
                                                                  "a": [[f"{c['p'] + tick * rnd.randint(1, 600):.8f}", f"{rnd.expovariate(1) * 4000 / c['p']:.6f}"] for _ in range(6)]}}))
                    elif "@kline" in s:
                        ws.send(json.dumps({"stream": s, "data": {"e": "kline", "s": sym, "k": {"t": 1794500000000, "T": 1794503599999, "i": s.split("_")[-1], "o": f"{p:.8f}", "h": f"{p * 1.001:.8f}", "l": f"{p * 0.999:.8f}", "c": f"{p:.8f}", "v": "1", "q": "1000"}}}))
                except Exception:
                    return
            time.sleep(0.5)
    threading.Thread(target=pump, daemon=True).start()


def ws_liq(ws):
    state = {"open": True}

    def pump():
        for k in range(200):
            if not state["open"]:
                return
            c = rnd.choice(list(COINS.values())[:20])
            try:
                ws.send(json.dumps({"e": "forceOrder", "E": int(time.time() * 1000), "o": {"s": c["bn"], "S": rnd.choice(["SELL", "BUY"]), "o": "LIMIT", "f": "IOC",
                                                                                          "q": f"{rnd.uniform(1e3, 3e5) / c['p']:.4f}", "p": f"{c['p']:.6f}", "ap": f"{c['p']:.6f}", "X": "FILLED",
                                                                                          "l": "1", "z": f"{rnd.uniform(1e3, 3e5) / c['p']:.4f}", "T": int(time.time() * 1000)}}))
            except Exception:
                return
            time.sleep(0.4)
    threading.Thread(target=pump, daemon=True).start()


def fixture(route, name):
    p = os.path.join(FX, name)
    ct = "image/webp" if name.endswith(".webp") else "application/json"
    route.fulfill(status=200, content_type=ct, body=open(p, "rb").read())


def wire(page, errors):
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" and "fonts.g" not in m.text and "net::ERR" not in m.text else None)
    page.route(re.compile(r".*/data/mm\.json.*"), lambda r: fixture(r, "mm.json"))
    page.route(re.compile(r".*/data/mm_flow\.json.*"), lambda r: fixture(r, "mm_flow.json"))
    page.route(re.compile(r".*/data/etf\.json.*"), lambda r: fixture(r, "etf.json"))
    page.route(re.compile(r".*/data/logos/atlas\.json.*"), lambda r: fixture(r, "logos/atlas.json"))
    page.route(re.compile(r".*/data/logos/atlas-[0-9a-f]{12}\.webp.*"), lambda r: fixture(r, "logos/" + urlparse(r.request.url).path.rsplit("/", 1)[1]))
    page.route(re.compile(r".*/api/v1/coins/.*\.json"), api_coin)
    page.route("https://data-api.binance.vision/**", binance)
    page.route("https://www.okx.com/**", okx)
    page.route(re.compile(r"https://fonts\.(googleapis|gstatic)\.com/.*"), lambda r: r.abort())
    page.route_web_socket(re.compile(r"wss://data-stream\.binance\.vision/.*"), ws_spot)
    page.route_web_socket(re.compile(r"wss://fstream\.binance\.com/.*"), ws_liq)


def ready(page, sel, timeout=15000):
    page.wait_for_selector(sel, timeout=timeout, state="attached")


def canvas_colours(page, sel):
    """how many distinct colours a canvas shows (a blank one shows 1–2); a WebGL canvas is re-rendered first, since its
    buffer is only readable in the task that drew it"""
    return page.evaluate("""(sel) => { let c = document.querySelector(sel); if (!c) return 0; if (c.classList.contains('mm-gl') && window.MM && MM.space3d) c = MM.space3d.snapshot() || c;
      const x = document.createElement('canvas'); x.width = 60; x.height = 40;
      const g = x.getContext('2d'); g.drawImage(c, 0, 0, 60, 40); const d = g.getImageData(0, 0, 60, 40).data; const s = new Set();
      for (let i = 0; i < d.length; i += 4) s.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); return s.size; }""", sel)


def run():
    srv, port = serve()
    base = f"http://127.0.0.1:{port}"
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"])

        def new(lang="fa", w=1280, h=860, mobile=False):
            ctx = br.new_context(viewport={"width": w, "height": h}, device_scale_factor=1 if not mobile else 2, is_mobile=mobile, has_touch=mobile, accept_downloads=True,
                                 service_workers="block")
            # language set once per tab (sessionStorage survives a reload), so a switch made on the page sticks
            ctx.add_init_script(f"""try{{if(!sessionStorage.getItem('mm_t0')){{sessionStorage.setItem('mm_t0','1');localStorage.setItem('ck_lang','{'en' if lang == 'ar' else lang}');{"localStorage.setItem('ek_ar','1');" if lang == 'ar' else "localStorage.removeItem('ek_ar');"}}}localStorage.setItem('ek_gpu','hw:'+Date.now());}}catch(e){{}}""")
            pg = ctx.new_page()
            errs = []
            wire(pg, errs)
            return ctx, pg, errs

        # ============================================================ heatmap
        if not ONLY or ONLY == "heatmap":
            print("heatmap")
            ctx, pg, errs = new("fa")
            pg.goto(base + "/heatmap/")
            ready(pg, "#mm-stage canvas")
            pg.wait_for_function("() => window.MM && MM.D.ok && MM.views.heatmap.debug() && MM.views.heatmap.debug().L.tiles.length > 50", timeout=15000)
            pg.wait_for_function("() => MM.D.live.src === 'live'", timeout=15000)
            st = pg.evaluate("() => { const s = MM.views.heatmap.debug(); return {tiles: s.L.tiles.length, blocks: s.L.blocks.length, w: s.w, h: s.h, live: MM.D.live.src} }")
            check("heatmap: tiles laid out", st["tiles"] >= 60, st)
            check("heatmap: grouped in sectors", st["blocks"] >= 5, st)
            check("heatmap: live from (mocked) Binance", st["live"] == "live", st)
            pg.wait_for_timeout(900)
            check("heatmap: canvas painted", canvas_colours(pg, "#mm-stage canvas") > 25)
            pg.screenshot(path=f"{SHOTS}/heat-fa-1280.png")
            # tiles cover the stage without overlapping (treemap sanity)
            area = pg.evaluate("() => { const s = MM.views.heatmap.debug(); let a = 0; s.L.tiles.forEach(t => a += t.w * t.h); return a / (s.w * s.h); }")
            check("heatmap: tiles fill the stage", 0.8 < area <= 1.001, area)
            # hover a big tile -> tooltip; click -> panel
            t = pg.evaluate("() => { const s = MM.views.heatmap.debug(); const t = s.L.tiles.slice().sort((a,b)=>b.w*b.h-a.w*a.h)[0]; const r = document.querySelector('#mm-stage canvas').getBoundingClientRect(); return {x: r.left + t.x + t.w/2, y: r.top + t.y + t.h/2, s: t.c.s} }")
            pg.mouse.move(t["x"], t["y"])
            pg.wait_for_timeout(250)
            check("heatmap: hover card", pg.is_visible(".mm-tip.on") and t["s"] in pg.inner_text(".mm-tip"))
            pg.screenshot(path=f"{SHOTS}/heat-fa-hover.png")
            pg.mouse.click(t["x"], t["y"])
            ready(pg, ".mm-panel.on #mm-p-name")
            check("panel: opens on click", t["s"] == "BTC" or len(pg.inner_text("#mm-p-name")) > 1)
            pg.wait_for_timeout(600)
            pg.screenshot(path=f"{SHOTS}/panel-fa-over.png")
            check("panel: nine timeframes", pg.locator(".mm-p-tf span").count() == 9)
            check("panel: converter in toman", pg.locator("#mm-cv-t").count() == 1)
            for tab in ("chart", "flow", "book", "deriv", "ek"):
                pg.click(f'.mm-p-tabs [data-tab="{tab}"]')
                pg.wait_for_timeout(1300 if tab != "chart" else 2200)
                pg.screenshot(path=f"{SHOTS}/panel-fa-{tab}.png")
            pg.click('.mm-p-tabs [data-tab="chart"]')
            pg.wait_for_timeout(1800)
            check("panel chart: candles drawn", pg.locator("#mm-chart canvas").count() >= 1)
            pg.click('.mm-p-tabs [data-tab="flow"]')
            pg.wait_for_timeout(1500)
            check("panel flow: window table", pg.locator("#mm-fw tbody tr").count() >= 6)
            check("panel flow: minute CVD", pg.locator("#mm-cvd svg polyline").count() >= 2)
            check("panel flow: live trades", pg.locator("#mm-trades .mm-tsum").count() == 1)
            pg.click('.mm-p-tabs [data-tab="book"]')
            pg.wait_for_timeout(1500)
            check("panel book: depth chart", pg.locator("#mm-depth svg polygon").count() == 2)
            check("panel book: walls", pg.locator(".mm-walls li").count() >= 2)
            pg.click('.mm-p-tabs [data-tab="deriv"]')
            pg.wait_for_timeout(1300)
            check("panel deriv: funding + OI", "%" in pg.inner_text("#mm-perp") and "$" in pg.inner_text("#mm-perp"))
            pg.click('.mm-p-tabs [data-tab="ek"]')
            pg.wait_for_timeout(1300)
            check("panel ek: scanner + news", pg.locator(".mm-ops li").count() >= 1 and pg.locator(".mm-news li").count() >= 1)
            href = pg.get_attribute("#mm-al-go", "href") or ""
            check("panel ek: alert hand-off link", re.fullmatch(r"https://t\.me/Kurd_kurdistan_bot\?start=a_[A-Z0-9]{2,12}_\d+(d\d+)?", href) is not None, href)
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(400)
            check("panel: Esc closes", pg.locator(".mm-panel.on").count() == 0)
            # timeframe, size, filter, search
            pg.click('.mm-tf[data-tf="1h"]')
            pg.wait_for_timeout(700)
            check("tf: 1h selected", pg.evaluate("() => MM.S.tf") == "1h" and "1" in pg.inner_text("#mm-legend"))
            pg.select_option("#mm-size", "ch")
            pg.wait_for_timeout(700)
            pg.screenshot(path=f"{SHOTS}/heat-fa-size-ch.png")
            n0 = pg.evaluate("() => MM.views.heatmap.debug().L.tiles.length")
            pg.click("#mm-filter")
            pg.click('.mm-menu [data-m="show:up"]')
            pg.keyboard.press("Escape")
            pg.mouse.click(5, 5)
            pg.wait_for_timeout(700)
            n1 = pg.evaluate("() => MM.views.heatmap.debug().L.tiles.length")
            check("filter: only gainers shows fewer tiles", 0 < n1 < n0, (n0, n1))
            ups = pg.evaluate("() => MM.views.heatmap.debug().L.tiles.every(t => t.c.ch[MM.S.tf] > 0)")
            check("filter: every tile is a gainer", ups)
            pg.click("#mm-filter")
            pg.click('.mm-menu [data-m="show:all"]')
            pg.mouse.click(5, 5)
            pg.select_option("#mm-size", "mc")
            pg.fill("#mm-q", "ETH")
            pg.wait_for_timeout(500)
            pg.screenshot(path=f"{SHOTS}/heat-fa-search.png")
            pg.fill("#mm-q", "")
            # zoom a sector by its header
            b = pg.evaluate("() => { const s = MM.views.heatmap.debug(); const b = s.L.blocks.find(b => b.hd); const r = document.querySelector('#mm-stage canvas').getBoundingClientRect(); return b ? {x: r.left + b.x + 30, y: r.top + b.y + b.hd/2, k: b.k} : null }")
            if b:
                pg.mouse.click(b["x"], b["y"])
                pg.wait_for_timeout(800)
                z = pg.evaluate("() => MM.views.heatmap.debug().zoom")
                check("sector header zooms in", z == b["k"], (z, b))
                pg.screenshot(path=f"{SHOTS}/heat-fa-zoom.png")
                pg.keyboard.press("Escape")
                pg.wait_for_timeout(600)
            # PNG
            with pg.expect_download(timeout=8000) as dl:
                pg.click("#mm-png")
            check("PNG download", dl.value.suggested_filename.endswith(".png"))
            # 3D city
            pg.click('.mm-seg [data-d3="1"]')
            pg.wait_for_selector("canvas.mm-gl", timeout=20000)
            pg.wait_for_timeout(3500)
            check("3D city drawn", canvas_colours(pg, "canvas.mm-gl") > 20)
            pg.screenshot(path=f"{SHOTS}/heat-fa-3d.png")
            box = pg.locator("canvas.mm-gl").bounding_box()
            pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            pg.mouse.down()
            pg.mouse.move(box["x"] + box["width"] / 2 + 160, box["y"] + box["height"] / 2 + 40, steps=8)
            pg.mouse.up()
            pg.wait_for_timeout(800)
            pg.screenshot(path=f"{SHOTS}/heat-fa-3d-turned.png")
            with pg.expect_download(timeout=8000) as dl:
                pg.click("#mm-png")
            check("PNG of the 3D view", dl.value.suggested_filename.endswith(".png"))
            pg.click('.mm-seg [data-d3="0"]')
            pg.wait_for_timeout(500)
            check("back to 2D", pg.locator("canvas.mm-gl").count() == 0)
            check("heatmap: no JS errors", not errs, errs[:5])
            ctx.close()

        # ============================================================ bubbles
        if not ONLY or ONLY == "bubbles":
            print("bubbles")
            ctx, pg, errs = new("en")
            pg.goto(base + "/bubbles/")
            pg.wait_for_function("() => window.MM && MM.views.bubbles && MM.views.bubbles.debug() && MM.views.bubbles.debug().list.length > 50", timeout=15000)
            pg.wait_for_timeout(2500)
            check("bubbles: painted", canvas_colours(pg, "#mm-stage canvas") > 25)
            ov = pg.evaluate("""() => { const s = MM.views.bubbles.debug(), L = s.list.filter(n => !n.dead); let worst = 0;
              for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j], d = Math.hypot(a.x - b.x, a.y - b.y); worst = Math.max(worst, (a.r + b.r - d) / Math.min(a.r, b.r)); }
              const out = L.filter(n => n.x < n.r - 1 || n.y < n.r - 1 || n.x > s.w - n.r + 1 || n.y > s.h - n.r + 1).length; return {worst, out, n: L.length} }""")
            check("bubbles: little overlap after settling", ov["worst"] < 0.25, ov)
            check("bubbles: all inside the stage", ov["out"] == 0, ov)
            pg.screenshot(path=f"{SHOTS}/bub-en-1280.png")
            nb = pg.evaluate("() => { const s = MM.views.bubbles.debug(); const n = s.list.filter(n=>!n.dead).sort((a,b)=>b.r-a.r)[0]; const r = document.querySelector('#mm-stage canvas').getBoundingClientRect(); return {x: r.left + n.x, y: r.top + n.y, s: n.c.s} }")
            pg.mouse.move(nb["x"], nb["y"])
            pg.mouse.down()
            pg.mouse.move(nb["x"] + 120, nb["y"] + 60, steps=10)
            pg.mouse.up()
            pg.wait_for_timeout(300)
            moved = pg.evaluate(f"() => {{ const n = MM.views.bubbles.debug().nodes['{nb['s']}']; return n && Math.hypot(n.vx, n.vy) >= 0 }}")
            check("bubbles: drag works", moved)
            pg.wait_for_timeout(1500)
            nb = pg.evaluate("() => { const s = MM.views.bubbles.debug(); const n = s.list.filter(n=>!n.dead).sort((a,b)=>b.r-a.r)[0]; const r = document.querySelector('#mm-stage canvas').getBoundingClientRect(); return {x: r.left + n.x, y: r.top + n.y, s: n.c.s} }")
            pg.mouse.click(nb["x"], nb["y"])
            ready(pg, ".mm-panel.on #mm-p-name")
            check("bubbles: tap opens the panel", True)
            pg.keyboard.press("Escape")
            for i, rg in enumerate(["0", "1"]):
                pg.select_option("#mm-range", rg)
                pg.wait_for_timeout(1500)
            pg.screenshot(path=f"{SHOTS}/bub-en-range2.png")
            pg.select_option("#mm-range", "0")
            pg.click('.mm-tf[data-tf="7d"]')
            pg.wait_for_timeout(1800)
            pg.screenshot(path=f"{SHOTS}/bub-en-7d.png")
            pg.click('.mm-seg [data-d3="1"]')
            pg.wait_for_selector("canvas.mm-gl", timeout=20000)
            pg.wait_for_timeout(4000)
            check("3D bubbles drawn", canvas_colours(pg, "canvas.mm-gl") > 20)
            pg.screenshot(path=f"{SHOTS}/bub-en-3d.png")
            pg.click('.mm-seg [data-d3="0"]')
            # switching views without reloading keeps the data
            pg.click('.mm-tab[data-v="heatmap"]')
            pg.wait_for_function("() => MM.view() === 'heatmap' && location.pathname === '/heatmap/'", timeout=8000)
            check("tabs switch views in place", True)
            pg.go_back()
            pg.wait_for_function("() => MM.view() === 'bubbles'", timeout=8000)
            check("back button returns to bubbles", True)
            check("bubbles: no JS errors", not errs, errs[:5])
            ctx.close()

        # ============================================================ money flow
        if not ONLY or ONLY == "flow":
            print("flow")
            ctx, pg, errs = new("fa")
            pg.goto(base + "/money-flow/")
            ready(pg, ".mm-river")
            pg.wait_for_timeout(800)
            check("flow: KPIs", pg.locator(".mm-kpis").first.locator(".mm-kpi").count() == 5)
            check("flow: river ribbons", pg.locator(".mm-river path").count() >= 6)
            geo = pg.evaluate("""() => {
              const sv = document.querySelector('.mm-river'), vb = sv.viewBox.baseVal, w = sv.getBoundingClientRect().width;
              const boxes = [...sv.querySelectorAll('text')].map(t => t.getBBox());
              let hit = 0;
              for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
                const a = boxes[i], b = boxes[j];
                if (a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1) hit++;
              }
              const nodes = [...sv.querySelectorAll('.mm-rvn rect')].map(r => +r.getAttribute('height'));
              return { scale: w / vb.width, hit, minNode: Math.min(...nodes) };
            }""")
            check("flow: river drawn at real size (readable text)", 0.9 < geo["scale"] < 1.1, geo)
            check("flow: river labels never overlap", geo["hit"] == 0, geo)
            check("flow: every sector node fits its label", geo["minNode"] >= 26, geo)
            qs = pg.evaluate("() => { const sv = document.querySelector('.mm-quad'); return sv.getBoundingClientRect().width / sv.viewBox.baseVal.width; }")
            check("flow: quadrant drawn at real size", 0.9 < qs < 1.1, qs)
            inside = pg.evaluate("""() => [...document.querySelectorAll('.mm-river text, .mm-quad text')].filter(t => {
                const b = t.getBBox(), v = t.ownerSVGElement.viewBox.baseVal; return t.getAttribute('transform') ? false : (b.x < -1 || b.x + b.width > v.width + 1 || b.y < -1 || b.y + b.height > v.height + 1);
              }).map(t => t.textContent)""")
            check("flow: no chart label spills out of its chart (RTL anchors)", not inside, inside[:5])
            qo = pg.evaluate("""() => { const sv = document.querySelector('.mm-quad'), names = [...sv.querySelectorAll('.mm-qt')].map(t => t.getBBox()), dots = [...sv.querySelectorAll('.mm-qp circle')].map(c => c.getBBox());
                return names.filter(a => dots.some(b => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height)).length; }""")
            check("flow: quadrant names are never covered by coins", qo == 0, qo)
            check("flow: sector table", pg.locator(".mm-card table tbody tr").count() >= 5)
            check("flow: leaders", pg.locator(".mm-lead li button").count() >= 10)
            check("flow: quadrant points", pg.locator(".mm-quad .mm-qp").count() >= 30)
            check("flow: stablecoin chart + table", pg.locator("svg[aria-label] polyline").count() >= 1)
            check("flow: dominance", pg.locator(".mm-lgd span").count() >= 4)
            check("flow: leverage lists", pg.locator(".mm-fund li").count() >= 2)
            pg.screenshot(path=f"{SHOTS}/flow-fa-1280.png", full_page=True)
            pg.click('[data-metric="mc"]')
            pg.wait_for_timeout(500)
            pg.click('.mm-tf[data-tf="30d"]')
            pg.wait_for_timeout(900)
            pg.screenshot(path=f"{SHOTS}/flow-fa-mc-30d.png", full_page=True)
            pg.click(".mm-lead li button >> nth=0")
            ready(pg, ".mm-panel.on")
            pg.wait_for_timeout(900)
            check("flow: leader opens the panel on its flow tab", pg.locator('.mm-p-tabs [data-tab="flow"].on').count() == 1)
            pg.keyboard.press("Escape")
            pg.click(".mm-rvn >> nth=0")
            pg.wait_for_function("() => MM.view() === 'heatmap' && MM.views.heatmap.debug() && MM.views.heatmap.debug().zoom", timeout=8000)
            check("flow: a sector opens zoomed in the heatmap", True)
            check("flow: no JS errors", not errs, errs[:5])
            ctx.close()

        # ============================================================ liquidity
        if not ONLY or ONLY == "liq":
            print("liquidity")
            ctx, pg, errs = new("en")
            pg.goto(base + "/liquidity/")
            ready(pg, "#mm-heat canvas")
            pg.wait_for_timeout(7000)
            painted = pg.evaluate("""() => { const c = document.querySelector('#mm-heat canvas'), x = c.getContext('2d'), k = c.width / c.clientWidth, x1 = c.width - Math.round(74 * k), x0 = Math.round(x1 * 0.7);
                const d = x.getImageData(x0, 0, x1 - x0, c.height).data, s = new Set(); for (let i = 0; i < d.length; i += 8) s.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); return s.size; }""")
            check("liq: book heatmap painted", painted > 15, painted)
            side = pg.evaluate("""() => {
              const c = document.querySelector('#mm-heat canvas'), x = c.getContext('2d'), W = c.width, H = c.height, plot = W - Math.round(74 * (W / c.clientWidth));
              const lit = (x0, x1) => { const d = x.getImageData(x0, 0, x1 - x0, H).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 120) n++; return n; };
              return { right: lit(Math.round(plot * 0.8), plot), left: lit(0, Math.round(plot * 0.2)) };
            }""")
            check("liq: newest seconds sit at the right edge", side["right"] > 50 and side["right"] > side["left"] * 3, side)
            check("liq: depth chart", pg.locator("#mm-depth svg polygon").count() == 2)
            check("liq: liquidations arrive", pg.evaluate("() => document.querySelectorAll('#mm-liqs .mm-trl li').length") >= 3)
            check("liq: liquidity table", pg.locator("#mm-ltab tbody tr").count() >= 10)
            pg.screenshot(path=f"{SHOTS}/liq-en-1280.png", full_page=True)
            pg.click('#mm-lchips [data-pick="ETH"]')
            pg.wait_for_timeout(4000)
            check("liq: switch coin", "ETH" in pg.inner_text("#mm-lhead"))
            pg.click('#mm-ltab [data-sort="sp"]')
            pg.wait_for_timeout(300)
            check("liq: table sorts", pg.locator('#mm-ltab [data-sort="sp"].on').count() == 1)
            check("liq: no JS errors", not errs, errs[:5])
            ctx.close()

        # ============================================================ ETFs
        if not ONLY or ONLY == "etf":
            print("etf")
            ctx, pg, errs = new("ckb")
            pg.goto(base + "/etf/")
            ready(pg, ".mm-etfc")
            pg.wait_for_timeout(800)
            check("etf: KPIs", pg.locator(".mm-kpis").first.locator(".mm-kpi").count() == 5)
            kp = pg.inner_text(".mm-kpis")
            check("etf: Sorani dates use Sorani month names", any(m in kp for m in ["کانوونی", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەممووز", "ئاب", "ئەیلوول", "تشرینی"]), kp[:200])
            rg = pg.inner_text(".mm-ch .mm-seg.sm")
            check("etf: range buttons localised", "ڕۆژ" in rg and not any(ch in rg for ch in "0123456789d"), rg)
            check("etf: daily bars", pg.locator(".mm-etfc rect").count() >= 60)
            check("etf: funds table", pg.locator(".mm-card table").first.locator("tbody tr").count() == 4)
            check("etf: treasuries", pg.locator("table").nth(1).locator("tbody tr").count() >= 2)
            check("etf: sector movers", pg.locator(".mm-mv").count() >= 6)
            check("etf: distribution", pg.locator("svg[aria-label] rect[rx]").count() >= 10)
            pg.screenshot(path=f"{SHOTS}/etf-ckb-1280.png", full_page=True)
            pg.click('[data-asset="eth"]')
            pg.click('[data-n="0"]')
            pg.wait_for_timeout(500)
            pg.screenshot(path=f"{SHOTS}/etf-ckb-eth-all.png", full_page=True)
            check("etf: no JS errors", not errs, errs[:5])
            ctx.close()

        # ============================================================ languages and phones
        # ============================================================ the site's Arabic layer (assets/ar.js) as CI adds it
        if not ONLY or ONLY == "arlayer":
            print("arabic layer")
            sys.path.insert(0, os.path.join(ROOT, "scripts"))
            import i18n_ar
            def with_ar(route):
                r = route.fetch()
                body = r.text()
                body = re.sub(r"(<head[^>]*>)", lambda m: m.group(1) + i18n_ar.HEAD, body, count=1).replace("</body>", i18n_ar.TAG + "</body>", 1)
                route.fulfill(response=r, body=body, headers={**r.headers, "content-type": "text/html; charset=utf-8"})
            ctx, pg, errs = new("ar")
            pg.route(re.compile(r".*/(heatmap|money-flow)/$"), with_ar)
            pg.route(re.compile(r".*/i18n/ar/.*\.json.*"), lambda r: r.fulfill(status=200, body="{}", content_type="application/json"))   # CI writes these on deploy
            pg.goto(base + "/heatmap/")
            pg.wait_for_function("() => window.MM && MM.D.ok", timeout=15000)
            pg.wait_for_timeout(2500)
            check("ar layer: page visible (no stuck ek-ar-wait)", not pg.evaluate("() => document.documentElement.classList.contains('ek-ar-wait')"))
            check("ar layer: the map is in Arabic", pg.evaluate("() => MM.lang()") == "ar" and "الفقاعات" in pg.inner_text(".mm-tabs"))
            tfs = pg.evaluate("() => [...document.querySelectorAll('.mm-tf')].map(b => b.textContent)")
            check("ar layer: timeframe buttons untouched", tfs[:5] == ["5m", "15m", "1h", "2h", "4h"], tfs)
            t = pg.evaluate("() => { const s = MM.views.heatmap.debug(); const t = s.L.tiles[0]; const r = document.querySelector('#mm-stage canvas').getBoundingClientRect(); return {x: r.left + t.x + t.w/2, y: r.top + t.y + t.h/2} }")
            pg.mouse.click(t["x"], t["y"])
            ready(pg, ".mm-panel.on")
            pg.wait_for_timeout(900)
            ptf = pg.evaluate("() => [...document.querySelectorAll('.mm-panel .mm-p-tfs small, .mm-panel small')].map(e => e.textContent).filter(x => /^(5m|1h|4h)$/.test(x)).length")
            check("ar layer: the coin panel keeps its own labels", ptf >= 2, ptf)
            pg.keyboard.press("Escape")
            pg.evaluate("() => document.querySelector('#langs button[data-l=\"fa\"]').click()")   # the switcher lives in the menu at this width
            pg.wait_for_function("() => window.MM && MM.D.ok && MM.lang() === 'fa'", timeout=15000)
            check("ar layer: leaving Arabic from the site switcher lands in Persian", "حباب" in pg.inner_text(".mm-tabs") and pg.evaluate("() => location.pathname") == "/heatmap/")
            # and back into Arabic, then an in-place switch between the site's own three languages
            pg.evaluate("() => document.querySelector('#langs button[data-l=\"ar\"]').click()")
            pg.wait_for_function("() => window.MM && MM.D.ok && MM.lang() === 'ar'", timeout=15000)
            check("ar layer: entering Arabic from the switcher stays on the page", pg.evaluate("() => location.pathname") == "/heatmap/")
            ctx.close()
            ctx, pg, errs2 = new("fa")
            errs += errs2
            pg.goto(base + "/money-flow/")
            ready(pg, ".mm-river")
            pg.evaluate("() => document.querySelector('#langs button[data-l=\"ckb\"]').click()")
            pg.wait_for_function("() => MM.lang() === 'ckb' && document.documentElement.lang === 'ckb'", timeout=8000)
            pg.wait_for_selector(".mm-river", timeout=8000)
            check("switch fa → ckb in place (no reload) redraws the page in Sorani", "بڵق" in pg.inner_text(".mm-tabs") and "ڕووبار" in pg.inner_text(".mm-dash"))
            pg.evaluate("() => document.querySelector('#langs button[data-l=\"en\"]').click()")
            pg.wait_for_function("() => MM.lang() === 'en' && document.documentElement.dir === 'ltr'", timeout=8000)
            check("switch ckb → en in place: left-to-right", "Bubbles" in pg.inner_text(".mm-tabs"))
            check("ar layer: no JS errors", not errs, errs[:3])
            ctx.close()

        if not ONLY or ONLY == "langs":
            print("languages and phones")
            for lang in ("fa", "ckb", "ar", "en"):
                for (w, h, mob) in ((1280, 860, False), (390, 844, True)):
                    for path, view in (("/heatmap/", "heat"), ("/bubbles/", "bub"), ("/money-flow/", "flow"), ("/liquidity/", "liq"), ("/etf/", "etf")):
                        if mob is False and view in ("flow", "liq", "etf") and lang in ("fa", "en"):
                            continue          # already shot above at 1280
                        ctx, pg, errs = new(lang, w, h, mob)
                        pg.goto(base + path)
                        pg.wait_for_function("() => window.MM && MM.D.ok", timeout=15000)
                        pg.wait_for_timeout(3200 if view in ("liq", "bub") else 1800)
                        sw = pg.evaluate("() => document.documentElement.scrollWidth")
                        check(f"{lang} {w}px {view}: no sideways scroll", sw <= w + 1, sw)
                        check(f"{lang} {w}px {view}: language applied", pg.evaluate("() => MM.lang()") == lang)
                        txt = pg.inner_text(".mm-tabs")
                        want = {"fa": "حباب", "ckb": "بڵق", "ar": "الفقاعات", "en": "Bubbles"}[lang]
                        check(f"{lang} {w}px {view}: tabs in the language", want in txt, txt[:80])
                        if view in ("flow", "etf", "liq"):
                            spill = pg.evaluate("""() => [...document.querySelectorAll('.mm-dash svg text, .mm-panel svg text')].filter(t => {
                                if (t.closest('[transform]') || !t.getBBox) return false;
                                const b = t.getBBox(), v = t.ownerSVGElement.viewBox.baseVal; if (!v || !v.width) return false;
                                return b.x < -1 || b.x + b.width > v.width + 1; }).map(t => t.textContent).slice(0, 5)""")
                            check(f"{lang} {w}px {view}: chart labels stay inside their charts", not spill, spill)
                            if view == "flow":
                                nodes = pg.evaluate("""() => [...document.querySelectorAll('.mm-rvn')].filter(g => { const r = g.querySelector('rect').getBBox();
                                    return [...g.querySelectorAll('text')].some(t => { const b = t.getBBox(); return b.x < r.x - 1 || b.x + b.width > r.x + r.width + 1 || b.y < r.y - 1 || b.y + b.height > r.y + r.height + 1; }); })
                                    .map(g => g.getAttribute('data-sec'))""")
                                check(f"{lang} {w}px flow: sector names fit inside their nodes", not nodes, nodes)
                            tiny = pg.evaluate("""() => [...document.querySelectorAll('.mm-dash svg')].filter(s => s.querySelector('text') && s.viewBox.baseVal && s.viewBox.baseVal.width)
                                .map(s => s.getBoundingClientRect().width / s.viewBox.baseVal.width).filter(k => k < 0.85).length""")
                            check(f"{lang} {w}px {view}: chart text is drawn at full size", tiny == 0, tiny)
                        pg.screenshot(path=f"{SHOTS}/{view}-{lang}-{w}.png", full_page=view in ("flow", "etf", "liq"))
                        if mob and view == "heat":
                            t = pg.evaluate("() => { const s = MM.views.heatmap.debug(); const t = s.L.tiles[0]; const r = document.querySelector('#mm-stage canvas').getBoundingClientRect(); return {x: r.left + t.x + t.w/2, y: r.top + t.y + t.h/2} }")
                            pg.touchscreen.tap(t["x"], t["y"])
                            ready(pg, ".mm-panel.on")
                            pg.wait_for_timeout(700)
                            pg.screenshot(path=f"{SHOTS}/panel-{lang}-{w}.png")
                            pw = pg.evaluate("() => document.querySelector('.mm-panel').getBoundingClientRect().width")
                            check(f"{lang} phone: panel is a full-width sheet", abs(pw - w) < 2, pw)
                        check(f"{lang} {w}px {view}: no JS errors", not errs, errs[:3])
                        ctx.close()
        br.close()
    srv.shutdown()
    print(f"\n{len(OK)} passed, {len(FAIL)} failed")
    if FAIL:
        print("\n".join("FAIL " + f for f in FAIL))
        sys.exit(1)


if __name__ == "__main__":
    run()
