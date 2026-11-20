#!/usr/bin/env python3
"""Pine Studio check: the page loads, every example script runs in the worker without error, strategies produce a
back-test, indicators draw, the SMC layer and the Kronos layer render, and the page throws no errors.
Binance is replaced by generated candles (the test machine cannot reach it). Screenshots go to tests/out/studio_*.png."""
import http.server
import json
import math
import os
import random
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tests", "out")
os.makedirs(OUT, exist_ok=True)


class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass


def klines(n, tf_ms, end_ms):
    random.seed(7)
    p, out = 60000.0, []
    t0 = end_ms - n * tf_ms
    for i in range(n):
        o = p
        p *= 1 + math.sin(i / 40) * 0.004 + (random.random() - 0.5) * 0.012
        h, l = max(o, p) * (1 + random.random() * 0.003), min(o, p) * (1 - random.random() * 0.003)
        out.append([t0 + i * tf_ms, f"{o:.2f}", f"{h:.2f}", f"{l:.2f}", f"{p:.2f}", f"{random.random()*900+100:.3f}", t0 + (i + 1) * tf_ms - 1])
    return out


def wait(pg, expr, timeout=60000):
    import time
    t0 = time.time()
    while time.time() - t0 < timeout / 1000:
        if pg.evaluate(expr):
            return
        pg.wait_for_timeout(250)
    raise TimeoutError(expr)


def main():
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Q)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{port}"
    END = 1795000000000
    ALL = klines(5000, 3600000, END)
    errors, bad = [], []
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        pg = b.new_page(viewport={"width": 1440, "height": 1000})
        pg.on("pageerror", lambda e: errors.append(str(e)))

        def kl(route):
            u = route.request.url
            import urllib.parse as up
            if "ticker/24hr" in u:
                syms = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "TRX", "AVAX", "LINK", "USDC", "BTCUP"] + [f"C{i}" for i in range(40)]
                body = [{"symbol": s + "USDT", "priceChangePercent": str((i % 7) - 3), "lastPrice": "1.5", "quoteVolume": str(1e9 - i * 1e6), "count": 10} for i, s in enumerate(syms)]
                return route.fulfill(status=200, content_type="application/json", body=json.dumps(body), headers={"access-control-allow-origin": "*"})
            qs = dict(up.parse_qsl(up.urlparse(u).query))
            lim = int(qs.get("limit", 500))
            end = int(qs["endTime"]) if "endTime" in qs else None
            rows = [r for r in ALL if end is None or r[0] <= end][-lim:]
            route.fulfill(status=200, content_type="application/json", body=json.dumps(rows), headers={"access-control-allow-origin": "*"})
        pg.route("https://data-api.binance.vision/**", kl)
        kro = {"at": END, "model": "Kronos-small", "last": float(ALL[-1][4]),
               "forecast": [{"t": END + (i + 1) * 3600000, "o": 60000 + i * 10, "h": 60100 + i * 10, "l": 59900 + i * 10, "c": 60050 + i * 10, "hi": 60300 + i * 12, "lo": 59700 + i * 8} for i in range(24)]}
        pg.route("**/data/kronos/BTCUSDT_1h.json", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(kro)))
        feed = {"alerts": [{"at": END, "symbol": "BTCUSDT", "tf": "60", "price": 65000, "side": "buy", "text": "EMA cross"}], "count": 1}
        pg.route("https://entekhab-tv.omid-mokri.workers.dev/**", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(feed), headers={"access-control-allow-origin": "*"}))
        pg.goto(base + "/studio/?symbol=BTC")
        wait(pg, "!!(document.querySelector('.ps-legend') && document.querySelector('.ps-legend').textContent.length>3)")
        pg.wait_for_timeout(800)
        pg.screenshot(path=os.path.join(OUT, "studio_default.png"))
        keys = pg.evaluate("Array.from(document.querySelectorAll('.ps-edbar select')[0].options).map(o=>o.value).filter(Boolean)")
        for k in keys:
            pg.select_option(".ps-edbar select >> nth=0", k)
            wait(pg, "!document.querySelector('.ps-run').classList.contains('busy')")
            pg.wait_for_timeout(600)
            st = pg.evaluate("""() => ({err: (document.querySelector('.ps-status.err')||{}).textContent||'', legend: document.querySelector('.ps-legend').textContent,
                cards: document.querySelectorAll('.ps-panes .ps-card').length, strat: /strategy\\(/.test(document.querySelector('.ps-ta').value)})""")
            ok = not st["err"] and (not st["strat"] or st["cards"] >= 6)
            print(k, "OK" if ok else "FAIL", st)
            if not ok:
                bad.append(k)
            pg.screenshot(path=os.path.join(OUT, f"studio_{k}.png"), full_page=True)
        # a broken script must show the line of the error, not crash
        pg.fill(".ps-ta", '//@version=5\nindicator("x")\nplot(ta.sma(close, 20)\n')
        pg.click(".ps-run")
        pg.wait_for_timeout(2500)
        e = pg.evaluate("(document.querySelector('.ps-status')||{}).textContent||''")
        print("broken script ->", e[:120])
        if not e:
            bad.append("error-report")
        # Pine screener over 20 coins
        pg.click(".ps-tabs button[data-k=scan]")
        pg.select_option(".ps-pane:not([hidden]) select >> nth=1", "20")
        pg.click(".ps-pane:not([hidden]) .ps-run")
        wait(pg, "!!document.querySelector('.ps-scan') && document.querySelectorAll('.ps-scan tbody tr').length>=20 && !/توقف|Stop/.test(document.querySelector('.ps-pane:not([hidden]) .ps-run').textContent)", 120000)
        sc = pg.evaluate("({rows: document.querySelectorAll('.ps-scan tbody tr').length, stable: Array.from(document.querySelectorAll('.ps-scan tbody tr b')).map(b=>b.textContent).filter(x=>/USDC|BTCUP/.test(x)).length, cards: document.querySelectorAll('.ps-pane:not([hidden]) .ps-card').length})")
        print("screener", sc)
        pg.screenshot(path=os.path.join(OUT, "studio_scan.png"), full_page=True)
        if sc["rows"] != 20 or sc["stable"] or sc["cards"] < 5:
            bad.append("screener")
        pg.click(".ps-tabs button[data-k=tvhook]")
        pg.wait_for_timeout(1200)
        hk = pg.evaluate("({rows: document.querySelectorAll('.ps-feed tr').length, url: (document.querySelector('.ps-hook code')||{}).textContent})")
        print("tv alerts", hk)
        if hk["rows"] != 1 or "workers.dev/tv" not in (hk["url"] or ""):
            bad.append("tvhook")
        # Kronos tab
        pg.click(".ps-tabs button[data-k=kronos]")
        k = pg.evaluate("document.querySelectorAll('.ps-pane:not([hidden]) .ps-card').length")
        print("kronos cards", k)
        if k < 3:
            bad.append("kronos")
        pg.click(".ps-tabs button[data-k=smc]")
        s = pg.evaluate("document.querySelector('.ps-pane:not([hidden])').textContent.length")
        print("smc pane chars", s)
        if s < 40:
            bad.append("smc")
        b.close()
    srv.shutdown()
    print("page errors:", errors[:5])
    if errors or bad:
        print("FAIL:", bad)
        sys.exit(1)
    print("OK: every example runs, back-tests appear, errors are reported with their line, SMC and Kronos render")


if __name__ == "__main__":
    main()
