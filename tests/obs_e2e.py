#!/usr/bin/env python3
"""End-to-end test of the Observatory (/charts/, /charts/liquidation-heatmap/, /charts/liquidation-map/) in a real Chrome, offline.

The repo is served locally. Binance futures, Bybit and OKX are mocked in their real formats (Binance: 12-field klines,
openInterestHist rows with string numbers and the 30-day rule that refuses older start times, globalLongShortAccountRatio,
ticker/24hr; Bybit: retCode/result.list newest first, 200 open-interest rows a page, instruments-info, risk-limit;
OKX: liquidation-orders in pages of 100; sockets: Binance combined stream miniTicker + forceOrder).
Price and open interest are smooth made-up functions of time, with one planted jump of open interest five hours ago,
so the test knows where a cluster must appear and how large it must be.
Checks: zero JS errors; the data the model receives equals the mock functions; the planted cluster is where the arithmetic
says; every control works; four languages at 1280 px and 390 px without sideways scroll. Screenshots go to $SHOTS
(default /tmp/obsshots) — look at them.
Run: python3 scripts/build_obs.py && python3 tests/obs_e2e.py          (ONLY=data|heat|map|hub|langs|errors)
"""
import functools
import http.server
import json
import math
import os
import re
import socketserver
import sys
import threading
import time
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get("SHOTS", "/tmp/obsshots")
ONLY = os.environ.get("ONLY", "")
os.makedirs(SHOTS, exist_ok=True)
FAIL, OK = [], []
MIN, H, D = 60_000, 3_600_000, 86_400_000
IV = {"5m": 5 * MIN, "15m": 15 * MIN, "30m": 30 * MIN, "1h": H, "4h": 4 * H, "1d": D}
BYK = {"5": "5m", "15": "15m", "30": "30m", "60": "1h", "240": "4h", "D": "1d"}
BYO = {"5min": "5m", "15min": "15m", "30min": "30m", "1h": "1h", "4h": "4h", "1d": "1d"}
NOW = int(time.time() * 1000)
PLANT = (NOW - 5 * H) // (5 * MIN) * (5 * MIN)          # the candle in which open interest jumps
# symbol → (price base, open-interest base in contract units, planted jump in contract units)
COINS = {"BTCUSDT": (70000.0, 90000.0, 3600.0), "ETHUSDT": (2000.0, 2.2e6, 0.0), "SOLUSDT": (90.0, 9e6, 0.0), "XRPUSDT": (1.4, 3e8, 0.0),
         "1000PEPEUSDT": (0.0042, 6e9, 0.0), "DOGEUSDT": (0.11, 9e8, 0.0)}
BY_SCALE = 0.75                                          # Bybit's open interest and jump are 0.75 × Binance's
STATS = {"bn_oi_old": 0, "bn_ls": 0, "by_ls": 0, "req": []}


def check(name, cond, extra=""):
    (OK if cond else FAIL).append(name + ("" if cond else f"  [{extra}]"))
    print(("  ok  " if cond else "  FAIL ") + name + ("" if cond else f"  [{extra}]"))


def px(sym, t):
    b = COINS[sym][0]
    d = t / D
    return b * (1 + 0.10 * math.sin(2 * math.pi * d / 40) + 0.04 * math.sin(2 * math.pi * d / 3.1) + 0.012 * math.sin(2 * math.pi * d / 0.29) + 0.003 * math.sin(2 * math.pi * d / 0.031))


def oi(sym, t, scale=1.0):
    _, b, jump = COINS[sym]
    d = t / D
    return scale * (b * (1 + 0.06 * math.sin(2 * math.pi * d / 2.3) + 0.02 * math.sin(2 * math.pi * d / 0.21)) + (jump if t > PLANT else 0.0))


def candle(sym, t, iv):
    n = 6
    ps = [px(sym, min(t + iv * k / n, NOW)) for k in range(n + 1)]       # the candle still forming ends at the present price
    vol = COINS[sym][1] * 0.004 * (iv / (5 * MIN)) * (1 + 0.5 * math.sin(t / D * 9))
    return ps[0], max(ps) * 1.0002, min(ps) * 0.9998, ps[-1], vol


def lsr(t):
    return 0.5 + 0.18 * math.sin(2 * math.pi * t / D / 5)


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


def jresp(route, obj, status=200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(obj), headers={"access-control-allow-origin": "*"})


def grid(t0, t1, iv, limit):
    """interval starts inside [t0, t1], at most `limit`, the newest ones (as both exchanges do)"""
    a = -(-t0 // iv) * iv
    ts = list(range(a, min(t1, NOW) + 1, iv))
    return ts[-limit:]


def binance(route):
    u = urlparse(route.request.url)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    STATS["req"].append(u.path)
    sym = q.get("symbol", "")
    if u.path == "/fapi/v1/ticker/24hr":
        return jresp(route, [{"symbol": s, "lastPrice": f"{px(s, NOW):.8f}", "quoteVolume": f"{(len(COINS) - i) * 4e9:.2f}", "priceChangePercent": "-1.25"} for i, s in enumerate(COINS)])
    if sym not in COINS:
        return jresp(route, {"code": -1121, "msg": "Invalid symbol."}, 400)
    if u.path == "/fapi/v1/klines":
        iv = IV[q["interval"]]
        out = []
        for t in grid(int(q["startTime"]), int(q["endTime"]), iv, int(q.get("limit", 500))):
            o, h, l, c, v = candle(sym, t, iv)
            out.append([t, f"{o:.8f}", f"{h:.8f}", f"{l:.8f}", f"{c:.8f}", f"{v:.3f}", t + iv - 1, f"{v * c:.2f}", 1000, f"{v * 0.5:.3f}", f"{v * c * 0.5:.2f}", "0"])
        return jresp(route, out)
    if u.path == "/futures/data/openInterestHist":
        if int(q["startTime"]) < NOW - 30 * D:                        # the real API refuses anything older than 30 days
            STATS["bn_oi_old"] += 1
            return jresp(route, {"code": -1130, "msg": "parameter 'startTime' is invalid."}, 400)
        iv = IV[q["period"]]
        return jresp(route, [{"symbol": sym, "sumOpenInterest": f"{oi(sym, t):.8f}", "sumOpenInterestValue": f"{oi(sym, t) * px(sym, t):.8f}", "timestamp": t}
                             for t in grid(int(q["startTime"]), int(q["endTime"]), iv, int(q.get("limit", 30)))])
    if u.path == "/fapi/v1/openInterest":
        return jresp(route, {"symbol": sym, "openInterest": f"{oi(sym, NOW):.3f}", "time": NOW})
    if u.path == "/futures/data/globalLongShortAccountRatio":
        STATS["bn_ls"] += 1
        iv = IV[q["period"]]
        return jresp(route, [{"symbol": sym, "longShortRatio": "1.0", "longAccount": f"{lsr(t):.4f}", "shortAccount": f"{1 - lsr(t):.4f}", "timestamp": t}
                             for t in grid(int(q["startTime"]), int(q["endTime"]), iv, int(q.get("limit", 30)))])
    return jresp(route, {"code": -1, "msg": "not mocked"}, 404)


def by_sym(s):
    return "1000PEPEUSDT" if s == "1000PEPEUSDT" else s


def bybit(route):
    u = urlparse(route.request.url)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    STATS["req"].append(u.path)
    sym = q.get("symbol", "")

    def ok(result):
        return jresp(route, {"retCode": 0, "retMsg": "OK", "result": result, "time": NOW})
    if u.path == "/v5/market/tickers":
        rows = [{"symbol": s, "lastPrice": f"{px(s, NOW):.8f}", "price24hPcnt": "-0.0125", "turnover24h": f"{(len(COINS) - i) * 2e9:.2f}", "openInterest": f"{oi(s, NOW, BY_SCALE):.3f}",
                 "openInterestValue": f"{oi(s, NOW, BY_SCALE) * px(s, NOW):.2f}", "fundingRate": "0.0001"} for i, s in enumerate(COINS)]
        rows.append({"symbol": "BTCPERP", "lastPrice": "70000", "price24hPcnt": "0", "turnover24h": "1", "openInterest": "1", "openInterestValue": "1", "fundingRate": "0"})   # not a USDT contract: must be ignored
        return ok({"category": "linear", "list": [r for r in rows if not sym or r["symbol"] == sym]})
    if sym not in COINS:
        return jresp(route, {"retCode": 10001, "retMsg": "symbol invalid", "result": {}})
    if u.path == "/v5/market/kline":
        iv = IV[BYK[q["interval"]]]
        out = []
        for t in grid(int(q["start"]), int(q["end"]), iv, int(q.get("limit", 200))):
            o, h, l, c, v = candle(sym, t, iv)
            out.append([str(t), f"{o:.8f}", f"{h:.8f}", f"{l:.8f}", f"{c:.8f}", f"{v * BY_SCALE:.3f}", f"{v * BY_SCALE * c:.2f}"])
        return ok({"category": "linear", "symbol": sym, "list": out[::-1]})
    if u.path == "/v5/market/open-interest":
        iv = IV[BYO[q["intervalTime"]]]
        ts = grid(int(q["startTime"]), int(q["endTime"]), iv, min(200, int(q.get("limit", 50))))
        return ok({"category": "linear", "symbol": sym, "list": [{"openInterest": f"{oi(sym, t, BY_SCALE):.8f}", "timestamp": str(t)} for t in ts[::-1]], "nextPageCursor": ""})
    if u.path == "/v5/market/account-ratio":
        STATS["by_ls"] += 1
        iv = IV[BYO[q["period"]]]
        ts = grid(int(q["startTime"]), int(q["endTime"]), iv, min(500, int(q.get("limit", 50))))
        return ok({"list": [{"symbol": sym, "buyRatio": f"{lsr(t):.4f}", "sellRatio": f"{1 - lsr(t):.4f}", "timestamp": str(t)} for t in ts[::-1]]})
    if u.path == "/v5/market/instruments-info":
        return ok({"category": "linear", "list": [{"symbol": sym, "leverageFilter": {"minLeverage": "1", "maxLeverage": "50.00" if sym == "1000PEPEUSDT" else "150.00", "leverageStep": "0.01"}}]})
    if u.path == "/v5/market/risk-limit":
        return ok({"category": "linear", "list": [{"id": 1, "symbol": sym, "riskLimitValue": "300000", "maintenanceMargin": "0.01" if sym == "1000PEPEUSDT" else "0.0033", "initialMargin": "0.0066", "isLowestRisk": 1, "maxLeverage": "150.00"}]})
    return jresp(route, {"retCode": 404, "retMsg": "not mocked", "result": {}})


def okx(route):
    u = urlparse(route.request.url)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    STATS["req"].append(u.path)
    if u.path.endswith("/public/instruments"):
        return jresp(route, {"code": "0", "data": [{"instId": q.get("instId"), "ctVal": "0.01", "ctValCcy": "BTC"}]})
    if u.path.endswith("/public/liquidation-orders"):
        after = int(q.get("after") or NOW)
        det = []
        for k in range(100):
            t = after - (k + 1) * 4 * MIN
            if t < NOW - 30 * H:
                break
            side = "long" if k % 3 else "short"
            p = px("BTCUSDT", t) * (0.998 if side == "long" else 1.002)
            det.append({"bkLoss": "0", "bkPx": f"{p:.1f}", "ccy": "", "posSide": side, "side": "sell" if side == "long" else "buy", "sz": f"{50 + 37 * (k % 11):.2f}", "time": t, "ts": str(t)})
        return jresp(route, {"code": "0", "data": [{"details": det, "instFamily": "BTC-USDT", "instId": "BTC-USDT-SWAP", "instType": "SWAP", "uly": "BTC-USDT"}] if det else []})
    return jresp(route, {"code": "0", "data": []})


def ws_binance(ws):
    def pump():
        for k in range(60):
            try:
                s = ws.url.split("streams=")[-1].split("/")[0].split("@")[0].upper()
                p = px(s, NOW) if s in COINS else 100.0
                ws.send(json.dumps({"stream": s.lower() + "@miniTicker", "data": {"e": "24hrMiniTicker", "E": NOW, "s": s, "c": f"{p * (1 + 0.0003 * math.sin(k)):.8f}", "o": "1", "h": "1", "l": "1", "v": "1", "q": "1"}}))
                if k % 5 == 0:
                    ws.send(json.dumps({"stream": s.lower() + "@forceOrder", "data": {"e": "forceOrder", "E": NOW, "o": {"s": s, "S": "SELL" if k % 2 else "BUY", "o": "LIMIT", "f": "IOC", "q": "2.500", "p": f"{p:.2f}", "ap": f"{p:.2f}", "X": "FILLED", "l": "2.5", "z": "2.500", "T": int(time.time() * 1000)}}}))
            except BaseException:
                return
            time.sleep(0.5)
    threading.Thread(target=pump, daemon=True).start()


def wire(page, errors, block=()):
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" and "fonts.g" not in m.text and "net::ERR" not in m.text and "Failed to load resource" not in m.text else None)
    page.route("https://fapi.binance.com/**", (lambda r: r.abort()) if "binance" in block else binance)
    page.route("https://api.bybit.com/**", (lambda r: r.abort()) if "bybit" in block else bybit)
    page.route("https://www.okx.com/**", (lambda r: r.abort()) if "okx" in block else okx)
    page.route("https://data-api.binance.vision/**", lambda r: r.abort())
    page.route(re.compile(r"https://fonts\.(googleapis|gstatic)\.com/.*"), lambda r: r.abort())
    page.route(re.compile(r".*/api/v1/.*"), lambda r: r.fulfill(status=404, body="{}"))
    page.route_web_socket(re.compile(r"wss://fstream\.binance\.com/.*"), ws_binance)
    page.route_web_socket(re.compile(r"wss://(stream\.bybit\.com|data-stream\.binance\.vision|ws\.okx\.com|mempool\.space)/.*"), lambda ws: None)


def lang_init(lang):
    if lang == "ar":
        return "try{localStorage.setItem('ek_ar','1');localStorage.setItem('ck_lang','en')}catch(e){}"
    return f"try{{localStorage.removeItem('ek_ar');localStorage.setItem('ck_lang','{lang}')}}catch(e){{}}"


def wait_res(page, timeout=30000):
    page.wait_for_function("() => window.OB && OB._liq && OB._liq.V.res && !OB._liq.V.loading", timeout=timeout)
    page.wait_for_timeout(350)


def colours(page, sel=".ob-cv"):
    return page.evaluate("""(sel) => { const c = document.querySelector(sel); if (!c) return 0; const x = document.createElement('canvas'); x.width = 120; x.height = 80;
      const g = x.getContext('2d'); g.drawImage(c, 0, 0, 120, 80); const d = g.getImageData(0, 0, 120, 80).data; const s = new Set();
      for (let i = 0; i < d.length; i += 4) s.add((d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3)); return s.size; }""", sel)


def overflow(page):
    return page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")


def new_page(br, w, h, lang, mobile=False, block=()):
    ctx = br.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile, accept_downloads=True)
    ctx.grant_permissions(["clipboard-read", "clipboard-write"])
    page = ctx.new_page()
    errors = []
    page.add_init_script(lang_init(lang))
    wire(page, errors, block)
    return ctx, page, errors


def run():
    srv, port = serve()
    base = f"http://127.0.0.1:{port}"
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])

        # ------------------------------------------------------------ what the model is fed
        if not ONLY or ONLY == "data":
            print("data")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/liquidation-heatmap/")
            wait_res(page)
            d = page.evaluate("""() => { const V = OB._liq.V, f = V.feeds, c = V.cols; const pick = (x, i) => ({ t: x.t[i], o: x.o[i], h: x.h[i], l: x.l[i], c: x.c[i], v: x.v[i], oi0: x.oi0[i], oi1: x.oi1[i] });
              const n = f[0].t.length, i5 = f[0].t.findIndex(t => t >= V.cols.start) + 30, iw = 100;
              return { ex: f.map(x => x.ex), n: f.map(x => x.t.length), cols: c.cols.length, start: c.start, step: c.step, lastEnd: c.ends[c.ends.length - 1],
                fine: pick(f[0], i5), warm: pick(f[0], iw), fine1: pick(f[1], i5), dt_warm: f[0].t[iw + 1] - f[0].t[iw], dt_fine: f[0].t[i5 + 1] - f[0].t[i5],
                first: f.map(x => x.t[0]), mmr: f.map(x => x.mmr), maxLev: f.map(x => x.maxLev), oiFrom: f.map(x => x.oiFrom), col30: c.cols[30], nanOi: f.map(x => x.oi0.filter(v => !isFinite(v)).length),
                sorted: f.map(x => x.t.every((t, i) => !i || t > x.t[i - 1])), px: V.px, max: V.chart.max }; }""")
            check("both exchanges loaded", d["ex"] == ["binance", "bybit"], d["ex"])
            check("24 h of 5-minute columns", d["cols"] in (288, 289) and d["step"] == 5 * MIN, (d["cols"], d["step"]))
            check("the window starts on a column boundary and ends after now", d["start"] % (5 * MIN) == 0 and d["lastEnd"] > NOW - MIN, (d["start"], d["lastEnd"]))
            check("warm-up candles are hourly, window candles 5-minute", d["dt_warm"] == H and d["dt_fine"] == 5 * MIN, (d["dt_warm"], d["dt_fine"]))
            check("candles are in time order without repeats", all(d["sorted"]))
            f = d["fine"]
            o, h, l, c, v = candle("BTCUSDT", f["t"], 5 * MIN)
            check("a 5-minute candle is the mock's candle", abs(f["o"] - o) < 1e-3 and abs(f["h"] - h) < 1e-3 and abs(f["l"] - l) < 1e-3 and abs(f["c"] - c) < 1e-3 and abs(f["v"] - v) < 1e-2, f)
            check("its open interest is the mock's at its start and its end", abs(f["oi0"] - oi("BTCUSDT", f["t"])) < 1e-3 and abs(f["oi1"] - oi("BTCUSDT", f["t"] + 5 * MIN)) < 1e-3, (f["oi0"], oi("BTCUSDT", f["t"])))
            wf = d["warm"]
            check("an hourly warm-up candle has hourly open interest", abs(wf["oi0"] - oi("BTCUSDT", wf["t"])) < 1e-3 and abs(wf["oi1"] - oi("BTCUSDT", wf["t"] + H)) < 1e-3, wf)
            f1 = d["fine1"]
            check("Bybit's open interest is its own (0.75 ×)", abs(f1["oi0"] - oi("BTCUSDT", f1["t"], BY_SCALE)) < 1e-3, f1)
            check("Binance warm-up stays inside its 30 days; Bybit's reaches 30 days too", NOW - d["first"][0] < 30 * D and NOW - d["first"][0] > 28 * D and NOW - d["first"][1] > 29 * D, [(NOW - x) / D for x in d["first"]])
            check("no open-interest request older than 30 days went to Binance", STATS["bn_oi_old"] == 0, STATS["bn_oi_old"])
            check("maintenance margin and maximum leverage come from Bybit's specification", d["mmr"] == [0.0033, 0.0033] and d["maxLev"] == [150, 150], (d["mmr"], d["maxLev"]))
            check("no gaps in open interest", d["nanOi"] == [0, 0], d["nanOi"])
            c30 = d["col30"]
            o, h, l, c, v = candle("BTCUSDT", d["start"] + 30 * 5 * MIN, 5 * MIN)
            check("column 30 is the candle of its time", abs(c30["o"] - o) < 1e-3 and abs(c30["c"] - c) < 1e-3 and c30["t"] == d["start"] + 30 * 5 * MIN, c30)
            check("model 1 asked for no account ratio", STATS["bn_ls"] == 0 and STATS["by_ls"] == 0, (STATS["bn_ls"], STATS["by_ls"]))

            # the planted jump: 3600 contracts on Binance + 2700 on Bybit in one candle, four tiers of 25 % each.
            # 10x with 0.33 % maintenance margin: long at entry × (1 − 0.1 + 0.0033), short at entry × (1 + 0.1 − 0.0033)
            o, h, l, c, v = candle("BTCUSDT", PLANT, 5 * MIN)
            tp = (h + l + c) / 3
            exp_units = (3600 + 3600 * BY_SCALE) * 0.25
            r = page.evaluate("""([pl, ps]) => { const V = OB._liq.V, res = V.res, g = res.grid, M = window.OBLiq;
              const around = (arr, p) => { const r0 = M.rowOf(g, p); let s = 0, u = 0; for (let r = r0 - 3; r <= r0 + 3; r++) if (r >= 0 && r < g.rows) { s += arr[r]; u += arr[r] / M.priceOf(g, r); } return { usd: s, units: u }; };
              return { long10: around(res.longT[1], pl), short10: around(res.shortT[1], ps), step: g.step, rows: g.rows, tiers: res.tiers }; }""",
                              [tp * (1 - 0.1 + 0.0033), tp * (1 + 0.1 - 0.0033)])
            check("the planted jump's 10x long cluster holds the planted contracts", 0.97 * exp_units < r["long10"]["units"] < 1.25 * exp_units, (r["long10"], exp_units))
            check("the planted jump's 10x short cluster holds the planted contracts", 0.97 * exp_units < r["short10"]["units"] < 1.25 * exp_units, (r["short10"], exp_units))
            check("the four default tiers were used", r["tiers"] == [10, 25, 50, 100], r["tiers"])
            check("the heatmap has a positive maximum", d["max"] > 1e6, d["max"])

            # a contract quoted per 1000 coins is brought to one coin: price ÷ 1000, size × 1000
            pe = page.evaluate("""async () => { const list = await OB.coins(); const c = list.find(x => x.base === 'PEPE'); const data = await OB.liqLoad(c, OB.liqRange('12h'), ['binance', 'bybit'], false);
              const f = OB.liqFeeds(data)[0], i = f.t.length - 20; return { coin: c, t: f.t[i], c: f.c[i], oi0: f.oi0[i], v: f.v[i], maxLev: f.maxLev, mmr: f.mmr, listed: list.map(x => x.base) }; }""")
            o, h, l, c, v = candle("1000PEPEUSDT", pe["t"], 5 * MIN)
            check("1000PEPE is listed as PEPE with multiplier 1000", pe["coin"]["bn"] == "1000PEPEUSDT" and pe["coin"]["bnMult"] == 1000 and "1000PEPE" not in pe["listed"], pe["coin"])
            check("its price is per coin and its sizes are in coins", abs(pe["c"] / (c / 1000) - 1) < 1e-5 and abs(pe["oi0"] / (oi("1000PEPEUSDT", pe["t"]) * 1000) - 1) < 1e-9 and abs(pe["v"] / (v * 1000) - 1) < 1e-6, pe)
            check("its 50x cap and 1 % margin come from the specification", pe["maxLev"] == 50 and pe["mmr"] == 0.01, (pe["maxLev"], pe["mmr"]))
            check("a non-USDT contract is not listed", "BTCPERP" not in pe["listed"] and "BTCPERP".replace("PERP", "") in pe["listed"])
            check("no JS errors (data)", not errors, errors[:3])
            ctx.close()

        # ------------------------------------------------------------ the heatmap page
        if not ONLY or ONLY == "heat":
            print("heatmap")
            ctx, page, errors = new_page(br, 1280, 900, "fa")
            page.goto(base + "/charts/liquidation-heatmap/")
            wait_res(page)
            check("page is Persian and right-to-left", page.evaluate("() => document.documentElement.lang + document.documentElement.dir") == "fartl")
            check("the canvas is painted", colours(page) > 25, colours(page))
            check("no sideways scroll at 1280", overflow(page) <= 0, overflow(page))
            check("three cards are filled", page.locator("#ob-cards .ob-card").count() == 3 and page.locator("#ob-cards table tbody tr").count() >= 2)
            check("the coin button shows BTC with its logo", page.locator("#ob-coin-s").inner_text() == "BTC" and page.locator("#ob-coin-l img").count() == 1)
            page.screenshot(path=os.path.join(SHOTS, "heat_fa_1280.png"), full_page=False)
            page.locator("#ob-main").screenshot(path=os.path.join(SHOTS, "heat_fa_1280_main.png"))

            # hover → read-out
            box = page.locator(".ob-cv").bounding_box()
            page.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.45)
            page.wait_for_timeout(200)
            tip = page.locator("#ob-stage .ob-tip")
            check("hover shows the read-out", tip.is_visible() and "O " in tip.inner_text() and len(tip.inner_text()) > 20, tip.inner_text() if tip.count() else "")
            page.screenshot(path=os.path.join(SHOTS, "heat_fa_hover.png"))

            # zoom: buttons, Ctrl + wheel, double-click
            v0 = page.evaluate("() => Object.assign({}, OB._liq.V.chart.v)")
            page.locator(".ob-zoom button[data-z=in]").click()
            page.wait_for_timeout(120)
            v1 = page.evaluate("() => Object.assign({}, OB._liq.V.chart.v)")
            check("the + button zooms in", (v1["x1"] - v1["x0"]) < (v0["x1"] - v0["x0"]) * 0.8, (v0, v1))
            page.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.5)
            page.mouse.wheel(0, -300)
            page.wait_for_timeout(120)
            v2 = page.evaluate("() => Object.assign({}, OB._liq.V.chart.v)")
            check("a plain wheel leaves the chart alone (the page scrolls)", abs((v2["x1"] - v2["x0"]) - (v1["x1"] - v1["x0"])) < 1e-9)
            page.evaluate("() => window.scrollTo(0, 0)")
            page.keyboard.down("Control")
            page.mouse.wheel(0, -300)
            page.keyboard.up("Control")
            page.wait_for_timeout(120)
            v3 = page.evaluate("() => Object.assign({}, OB._liq.V.chart.v)")
            check("Ctrl + wheel zooms", (v3["x1"] - v3["x0"]) < (v2["x1"] - v2["x0"]) * 0.95, (v2, v3))
            page.mouse.move(box["x"] + box["width"] * 0.4, box["y"] + box["height"] * 0.5)
            page.mouse.down()
            page.mouse.move(box["x"] + box["width"] * 0.55, box["y"] + box["height"] * 0.5, steps=4)
            page.mouse.up()
            v4 = page.evaluate("() => Object.assign({}, OB._liq.V.chart.v)")
            check("dragging pans back in time", v4["x0"] < v3["x0"] - 1, (v3["x0"], v4["x0"]))
            page.locator(".ob-zoom button[data-z=reset]").click()
            v5 = page.evaluate("() => Object.assign({}, OB._liq.V.chart.v)")
            check("reset restores the first view", abs(v5["x0"] - v0["x0"]) < 1e-9 and abs(v5["x1"] - v0["x1"]) < 1e-9)

            # controls
            page.locator("#ob-range button[data-v='12h']").click()
            wait_res(page)
            check("12 h → 144 columns", page.evaluate("() => OB._liq.V.cols.cols.length") in (144, 145))
            before = page.evaluate("() => OB._liq.V.chart.max")
            page.locator("#ob-lev button[data-v='100']").click()
            page.wait_for_timeout(200)
            after = page.evaluate("() => ({ max: OB._liq.V.chart.max, tiers: OB._liq.V.res.tiers })")
            check("switching 100x off recomputes with three tiers", after["tiers"] == [10, 25, 50] and after["max"] != before, after)
            page.locator("#ob-lev button[data-v='100']").click()
            page.locator("#ob-model button[data-v='2']").click()
            wait_res(page)
            m2 = page.evaluate("() => ({ ls: OB._liq.V.feeds.map(f => !!f.ls && f.ls.filter(isFinite).length), hasLs: OB._liq.V.data.hasLs })")
            check("model 2 loads the account ratio of both exchanges", m2["hasLs"] and all(x and x > 100 for x in m2["ls"]) and STATS["bn_ls"] > 0 and STATS["by_ls"] > 0, (m2, STATS["bn_ls"], STATS["by_ls"]))
            page.locator("#ob-model button[data-v='3']").click()
            page.wait_for_timeout(300)
            t3 = page.evaluate("() => { const V = OB._liq.V, n = V.cols.cols.length; return { track: V.res.trackL[n - 1] + V.res.trackS[n - 1], oi: V.feeds.reduce((s, f) => s + f.oiLast * f.pxLast, 0) }; }")
            check("model 3 tracks a large share of the open interest", 0.5 * t3["oi"] < t3["track"] < 2.2 * t3["oi"], t3)
            page.locator("#ob-model button[data-v='1']").click()
            page.wait_for_timeout(200)
            c_fire = page.evaluate("() => { const c = OB._liq.V.chart.img.getContext('2d').getImageData(0, 0, OB._liq.V.chart.img.width, OB._liq.V.chart.img.height).data; let r = 0, b = 0; for (let i = 0; i < c.length; i += 4) { r += c[i]; b += c[i + 2]; } return [r, b]; }")
            page.locator("#ob-pal button[data-v='ice']").click()
            page.wait_for_timeout(150)
            c_ice = page.evaluate("() => { const c = OB._liq.V.chart.img.getContext('2d').getImageData(0, 0, OB._liq.V.chart.img.width, OB._liq.V.chart.img.height).data; let r = 0, b = 0; for (let i = 0; i < c.length; i += 4) { r += c[i]; b += c[i + 2]; } return [r, b]; }")
            check("the palette changes the picture (fire is red, ice is blue)", c_fire[0] > c_fire[1] and c_ice[1] > c_ice[0], (c_fire, c_ice))
            page.locator("#ob-pal button[data-v='fire']").click()
            lit0 = page.evaluate("() => { const c = OB._liq.V.chart.img.getContext('2d').getImageData(0, 0, OB._liq.V.chart.img.width, OB._liq.V.chart.img.height).data; let n = 0; for (let i = 3; i < c.length; i += 4) if (c[i]) n++; return n; }")
            page.locator("#ob-thr").fill("40")
            page.wait_for_timeout(150)
            lit1 = page.evaluate("() => { const c = OB._liq.V.chart.img.getContext('2d').getImageData(0, 0, OB._liq.V.chart.img.width, OB._liq.V.chart.img.height).data; let n = 0; for (let i = 3; i < c.length; i += 4) if (c[i]) n++; return n; }")
            check("a higher threshold hides the weak cells", 0 < lit1 < lit0 * 0.7, (lit0, lit1))
            page.locator("#ob-thr").fill("3")

            # exchange: Bybit alone
            page.locator("#ob-ex button[data-v='bybit']").click()
            wait_res(page)
            check("Bybit alone", page.evaluate("() => OB._liq.V.feeds.map(f => f.ex)") == ["bybit"])
            page.locator("#ob-ex button[data-v='all']").click()
            wait_res(page)

            # the real liquidation orders (OKX pages) are drawn, live ones arrive from the socket
            page.wait_for_timeout(1500)
            lq = page.evaluate("() => ({ n: OB._liq.V.liqs.length, ex: [...new Set(OB._liq.V.liqs.map(x => x.ex))].sort(), agg: (OB._liq.V.chart.agg || []).filter(Boolean).length })")
            check("real liquidations from OKX and the live socket are on the chart", lq["n"] > 50 and "okx" in lq["ex"] and "binance" in lq["ex"] and lq["agg"] > 10, lq)

            # coin picker
            page.locator("#ob-coin").click()
            page.wait_for_selector("#ob-pick .ob-pi")
            names = page.locator("#ob-pick .ob-pi b").all_inner_texts()
            check("the picker lists the coins by volume, PEPE without its multiplier", names[:2] == ["BTC", "ETH"] and "PEPE" in names and "1000PEPE" not in names, names)
            page.locator("#ob-pq").fill("eth")
            page.wait_for_timeout(250)
            check("search narrows the list", page.locator("#ob-pick .ob-pi b").all_inner_texts() == ["ETH"])
            page.screenshot(path=os.path.join(SHOTS, "heat_fa_picker.png"))
            page.locator("#ob-pick .ob-pi").first.click()
            wait_res(page)
            check("ETH is loaded", page.evaluate("() => OB._liq.V.coin.base") == "ETH" and abs(page.evaluate("() => OB._liq.V.px") / px("ETHUSDT", NOW) - 1) < 0.01)
            page.locator("#ob-minfo").click()
            check("the model note opens", page.locator("#ob-mi").is_visible() and page.locator("#ob-mi p").count() == 4)
            page.locator("#ob-mi button").click()

            # picture and link
            with page.expect_download(timeout=10000) as dl:
                page.locator("#ob-png").click()
            path = dl.value.path()
            check("the PNG is saved", dl.value.suggested_filename.endswith(".png") and os.path.getsize(path) > 20000, (dl.value.suggested_filename, os.path.getsize(path)))
            os.replace(path, os.path.join(SHOTS, "export_heat.png"))
            page.locator("#ob-share").click()
            page.wait_for_timeout(300)
            clip = page.evaluate("() => navigator.clipboard.readText()")
            check("the link carries the view", "coin=ETH" in clip and "range=12h" in clip and "model=1" in clip, clip)
            page.locator("#ob-full").click()
            page.wait_for_timeout(300)
            check("full screen fills the window", page.evaluate("() => { const r = document.getElementById('ob').getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 1; }"))
            page.screenshot(path=os.path.join(SHOTS, "heat_fa_full.png"))
            page.locator("#ob-full").click()

            # a shared link opens that view; language switch keeps it
            page.goto(base + "/charts/liquidation-heatmap/?coin=SOL&range=3d&ex=bybit&model=1")
            wait_res(page)
            st = page.evaluate("() => ({ coin: OB._liq.V.coin.base, cols: OB._liq.V.cols.cols.length, step: OB._liq.V.cols.step, ex: OB._liq.V.feeds.map(f => f.ex) })")
            check("a shared link opens its coin, range and exchange", st["coin"] == "SOL" and st["step"] == 15 * MIN and st["cols"] in (288, 289) and st["ex"] == ["bybit"], st)
            page.locator("#langs button[data-l=en]").click()
            wait_res(page)
            check("switching to English rebuilds the view in place", page.evaluate("() => document.documentElement.lang + document.documentElement.dir") == "enltr" and page.locator(".ob-tab.on").inner_text().strip() == "Liquidation heatmap" and page.evaluate("() => OB._liq.V.coin.base") == "SOL")
            check("no JS errors (heatmap)", not errors, errors[:3])
            ctx.close()

            # long ranges: a year rests on Bybit, Binance joins for its 30 days
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/liquidation-heatmap/?coin=BTC&range=1y&ex=all&model=1")
            wait_res(page, 60000)
            y = page.evaluate("() => { const V = OB._liq.V; return { cols: V.cols.cols.length, step: V.cols.step, from: V.feeds.map(f => f.oiFrom), n: V.feeds.map(f => f.t.length), max: V.chart.max, gaps: V.cols.cols.filter(c => !c).length }; }")
            check("1 year: daily columns, no gaps", y["cols"] in (365, 366) and y["step"] == D and y["gaps"] == 0, y)
            check("1 year: Binance contributes its 30 days, Bybit two years of warm-up", 28 * D < NOW - y["from"][0] < 30.5 * D and NOW - y["from"][1] > 700 * D, [(NOW - x) / D for x in y["from"]])
            check("still nothing older than 30 days asked of Binance", STATS["bn_oi_old"] == 0, STATS["bn_oi_old"])
            page.locator("#ob-main").screenshot(path=os.path.join(SHOTS, "heat_en_1y.png"))
            for rk, cols, step in (("1m", 360, 2 * H), ("6m", 540, 8 * H), ("1w", 336, 30 * MIN)):
                page.locator(f"#ob-range button[data-v='{rk}']").click()
                wait_res(page, 60000)
                z = page.evaluate("() => ({ cols: OB._liq.V.cols.cols.length, step: OB._liq.V.cols.step, gaps: OB._liq.V.cols.cols.filter(c => !c).length, max: OB._liq.V.chart.max })")
                check(f"{rk}: {cols} columns of {step // MIN} minutes, no gaps", z["cols"] in (cols, cols + 1) and z["step"] == step and z["gaps"] == 0 and z["max"] > 0, z)
            check("no JS errors (long ranges)", not errors, errors[:3])
            ctx.close()

        # ------------------------------------------------------------ the map page
        if not ONLY or ONLY == "map":
            print("map")
            ctx, page, errors = new_page(br, 1280, 900, "fa")
            page.goto(base + "/charts/liquidation-map/")
            wait_res(page)
            page.wait_for_selector("#ob-map svg rect[fill='#ff6a55'], #ob-map svg rect[fill='#34d399']")
            m = page.evaluate("""() => { const V = OB._liq.V, svg = document.querySelector('#ob-map svg'); return { rects: svg.querySelectorAll('rect').length, lines: svg.querySelectorAll('polyline').length,
              kpi: [...document.querySelectorAll('.ob-kpis b')].map(b => b.textContent), grid: [V.res.grid.pmin / V.px, (V.res.grid.pmin + V.res.grid.rows * V.res.grid.step) / V.px], tab: document.querySelector('.ob-tab.on').textContent.trim() }; }""")
            check("the map draws its bars and both running totals", m["rects"] > 40 and m["lines"] == 2, m)
            check("the map covers ±10 % of the price", abs(m["grid"][0] - 0.89) < 0.002 and abs(m["grid"][1] - 1.11) < 0.002, m["grid"])
            check("both totals are dollars", all(x.strip().startswith("$") for x in m["kpi"]), m["kpi"])
            check("the map's tab is the active one", m["tab"] == "نقشهٔ لیکوییدیشن", m["tab"])
            # the running totals equal the sum of the levels in the window
            s = page.evaluate("""() => { const V = OB._liq.V, res = V.res, g = res.grid, px = V.px, M = window.OBLiq; let l = 0, sh = 0;
              for (let r = 0; r < g.rows; r++) { const p = M.priceOf(g, r); if (p < px * 0.9 || p >= px * 1.1) continue; for (let k = 0; k < 5; k++) { l += res.longT[k][r]; sh += res.shortT[k][r]; } }
              return { l, sh, kpi: [...document.querySelectorAll('.ob-kpis b')].map(b => b.textContent.trim()) }; }""")
            def money(x):
                x = x.replace("$", "")
                return float(x[:-1]) * {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}[x[-1]] if x[-1] in "KMBT" else float(x)
            check("the long total is the sum of the long levels within 10 %", abs(money(s["kpi"][0]) / s["l"] - 1) < 0.02, (s["kpi"][0], s["l"]))
            check("the short total is the sum of the short levels within 10 %", abs(money(s["kpi"][1]) / s["sh"] - 1) < 0.02, (s["kpi"][1], s["sh"]))
            box = page.locator("#ob-map svg").bounding_box()
            page.mouse.move(box["x"] + box["width"] * 0.3, box["y"] + box["height"] * 0.4)
            page.wait_for_timeout(200)
            check("hover reads a price band", page.locator("#ob-map .ob-tip").is_visible() and "–" in page.locator("#ob-map .ob-tip").inner_text())
            page.locator("#ob-main").screenshot(path=os.path.join(SHOTS, "map_fa_1280.png"))
            page.locator("#ob-mw button[data-v='20']").click()
            page.wait_for_timeout(300)
            check("±20 % widens the grid", abs(page.evaluate("() => OB._liq.V.res.grid.pmin / OB._liq.V.px") - 0.79) < 0.002)
            page.locator("#ob-lb button[data-v='24h']").click()
            wait_res(page)
            a24 = page.evaluate("() => { const V = OB._liq.V, n = V.cols.cols.length; return V.res.trackL[n - 1] + V.res.trackS[n - 1]; }")
            page.locator("#ob-lb button[data-v='30d']").click()
            wait_res(page, 45000)
            a30 = page.evaluate("() => { const V = OB._liq.V, n = V.cols.cols.length; return V.res.trackL[n - 1] + V.res.trackS[n - 1]; }")
            check("a longer look-back counts more positions", a30 > a24 > 0, (a24, a30))
            with page.expect_download(timeout=10000) as dl:
                page.locator("#ob-png").click()
            check("the map's PNG is saved", os.path.getsize(dl.value.path()) > 8000)
            os.replace(dl.value.path(), os.path.join(SHOTS, "export_map.png"))
            check("no JS errors (map)", not errors, errors[:3])
            ctx.close()

        # ------------------------------------------------------------ the hub
        if not ONLY or ONLY == "hub":
            print("hub")
            ctx, page, errors = new_page(br, 1280, 900, "fa")
            page.goto(base + "/charts/")
            page.wait_for_selector(".ob-hub")
            check("hub: Persian section visible, the others hidden", page.locator("section[data-lang=fa]").is_visible() and not page.locator("section[data-lang=en]").is_visible())
            links = page.evaluate("() => [...document.querySelectorAll('section[data-lang=fa] a.ob-hc')].map(a => a.getAttribute('href'))")
            check("hub: links to both new charts", "/charts/liquidation-heatmap/" in links and "/charts/liquidation-map/" in links, links)
            missing = [l for l in links if l.startswith("/charts/") and not os.path.exists(os.path.join(ROOT, l.strip("/"), "index.html"))]
            check("hub: every /charts/ link exists", not missing, missing)
            page.locator("#ob-main").screenshot(path=os.path.join(SHOTS, "hub_fa_1280.png"))
            page.locator("#langs button[data-l=ckb]").click()
            page.wait_for_timeout(300)
            check("hub: Kurdish on click", page.locator("section[data-lang=ckb]").is_visible() and not page.locator("section[data-lang=fa]").is_visible() and page.evaluate("() => document.documentElement.lang") == "ckb")
            check("hub: no sideways scroll", overflow(page) <= 0)
            check("no JS errors (hub)", not errors, errors[:3])
            ctx.close()
            ctx, page, errors = new_page(br, 390, 844, "en", mobile=True)
            page.goto(base + "/charts/")
            page.wait_for_selector("section[data-lang=en] .ob-hub")
            check("hub on a phone: English, no sideways scroll", page.locator("section[data-lang=en]").is_visible() and overflow(page) <= 0, overflow(page))
            page.screenshot(path=os.path.join(SHOTS, "hub_en_390.png"))
            ctx.close()

        # ------------------------------------------------------------ four languages, desktop and phone
        if not ONLY or ONLY == "langs":
            print("languages")
            for lang in ("ckb", "fa", "ar", "en"):
                for w, h, mob in ((1280, 900, False), (390, 844, True)):
                    for view, path in (("heat", "/charts/liquidation-heatmap/"), ("map", "/charts/liquidation-map/")):
                        ctx, page, errors = new_page(br, w, h, lang, mobile=mob)
                        page.goto(base + path)
                        wait_res(page)
                        tag = f"{view} {lang} {w}"
                        want = {"ckb": ("ckb", "rtl"), "fa": ("fa", "rtl"), "ar": ("en", "rtl"), "en": ("en", "ltr")}[lang]
                        got = page.evaluate("() => [document.documentElement.lang, document.getElementById('ob').getAttribute('dir')]")
                        check(f"{tag}: language and direction", tuple(got) == want, got)
                        check(f"{tag}: no sideways scroll", overflow(page) <= 0, overflow(page))
                        txt = page.locator("#ob").inner_text()
                        check(f"{tag}: no missing string keys on screen", not re.search(r"\b(tab_|r_\d|err_|cl_|d_[a-z]+|m[123]_d|note_|map_p|lg_|total_)\w*", txt), re.findall(r"\b(?:tab_|r_\d|err_|cl_|d_[a-z]+|note_|map_p|lg_|total_)\w*", txt)[:3])
                        vis = page.evaluate("() => [...document.querySelectorAll('#ob-main [data-lang]')].filter(e => !e.hidden).map(e => e.getAttribute('data-lang'))")
                        check(f"{tag}: only this language's text is shown", set(vis) == {lang}, set(vis))
                        if view == "heat":
                            check(f"{tag}: canvas painted", colours(page) > 25, colours(page))
                            inside = page.evaluate("() => { const s = document.getElementById('ob-stage').getBoundingClientRect(), c = document.querySelector('.ob-cv').getBoundingClientRect(); return c.width <= s.width + 1 && c.height <= s.height + 1 && c.width > 250; }")
                            check(f"{tag}: the canvas fits its stage", inside)
                        else:
                            check(f"{tag}: bars drawn", page.locator("#ob-map svg rect").count() > 30)
                        page.locator("#ob-main").screenshot(path=os.path.join(SHOTS, f"{view}_{lang}_{w}.png"))
                        check(f"{tag}: no JS errors", not errors, errors[:3])
                        ctx.close()
            # a phone: tap shows the read-out, a horizontal swipe pans
            ctx, page, errors = new_page(br, 390, 844, "fa", mobile=True)
            page.goto(base + "/charts/liquidation-heatmap/")
            wait_res(page)
            top = page.locator(".ob-cv").bounding_box()["y"]
            check("phone: the chart starts within the first screen and a half", top < 844 * 0.62, top)
            v = page.evaluate("() => { const c = OB._liq.V.chart, G = c.geom(); return G.heatW / (c.v.x1 - c.v.x0); }")
            check("phone: candles open at a readable width", v >= 1.55, v)
            check("phone: the range is a select, the extra settings are folded", page.locator("#ob-range-s").is_visible() and not page.locator("#ob-range").is_visible() and not page.locator("#ob-lev").is_visible())
            page.locator("#ob-gear").click()
            check("phone: the gear unfolds leverage, colours and threshold", page.locator("#ob-lev").is_visible() and page.locator("#ob-thr").is_visible() and page.locator("#ob-pal").is_visible())
            check("phone: unfolded, still no sideways scroll", overflow(page) <= 0, overflow(page))
            page.screenshot(path=os.path.join(SHOTS, "heat_fa_390_gear.png"))
            page.locator("#ob-gear").click()
            page.locator(".ob-cv").scroll_into_view_if_needed()
            box = page.locator(".ob-cv").bounding_box()
            page.touchscreen.tap(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.35)
            page.wait_for_timeout(250)
            check("phone: a tap shows the read-out", page.locator("#ob-stage .ob-tip").is_visible())
            page.evaluate("() => window.scrollTo(0, 0)")
            page.locator("#ob-range-s").select_option("48h")
            wait_res(page)
            check("phone: 48 h from the select", page.evaluate("() => OB._liq.V.cols.cols.length") in (576, 577))
            page.screenshot(path=os.path.join(SHOTS, "heat_fa_390_full.png"), full_page=True)
            check("phone: no JS errors", not errors, errors[:3])
            ctx.close()

        # ------------------------------------------------------------ when exchanges do not answer
        if not ONLY or ONLY == "errors":
            print("errors")
            ctx, page, errors = new_page(br, 1280, 900, "fa", block=("binance",))
            page.goto(base + "/charts/liquidation-heatmap/")
            wait_res(page)
            e1 = page.evaluate("() => ({ ex: OB._liq.V.feeds.map(f => f.ex), failed: OB._liq.V.data.failed, warn: (document.querySelector('.ob-warn') || {}).textContent || '' })")
            check("Binance unreachable: the map is built from Bybit and says so", e1["ex"] == ["bybit"] and e1["failed"] == ["binance"] and "Binance" in e1["warn"], e1)
            check("…without JS errors", not errors, errors[:3])
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "fa", block=("binance", "bybit", "okx"))
            page.goto(base + "/charts/liquidation-heatmap/")
            page.wait_for_selector("#ob-retry", timeout=30000)
            check("nothing reachable: a plain message and a retry button, no blank chart", page.locator(".ob-status.err").is_visible() and "Binance" in page.locator(".ob-status.err").inner_text())
            page.screenshot(path=os.path.join(SHOTS, "heat_fa_error.png"))
            page.unroute("https://fapi.binance.com/**")
            page.unroute("https://api.bybit.com/**")
            page.route("https://fapi.binance.com/**", binance)
            page.route("https://api.bybit.com/**", bybit)
            page.locator("#ob-retry").click()
            wait_res(page)
            check("retry loads once the exchanges answer", page.evaluate("() => OB._liq.V.feeds.length") == 2 and not page.locator(".ob-status.err").is_visible())
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "en", block=("okx",))
            page.goto(base + "/charts/liquidation-heatmap/")
            wait_res(page)
            page.wait_for_timeout(600)
            check("OKX unreachable: the map still draws", colours(page) > 25 and not errors, errors[:3])
            ctx.close()
        br.close()
    srv.shutdown()
    print(f"\nobservatory e2e: {len(OK)} passed, {len(FAIL)} failed; screenshots in {SHOTS}")
    for f in FAIL:
        print("  FAILED:", f)
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(run())
