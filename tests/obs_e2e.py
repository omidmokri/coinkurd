#!/usr/bin/env python3
"""End-to-end test of the Observatory (/charts/ and its pages: liquidation heatmap and map, open interest, funding rates,
long/short ratio) in a real Chrome, offline.

The repo is served locally. Binance futures, Bybit and OKX are mocked in their real formats (Binance: 12-field klines,
openInterestHist rows with string numbers and the 30-day rule that refuses older start times, globalLongShortAccountRatio,
ticker/24hr; Bybit: retCode/result.list newest first, 200 open-interest rows a page, instruments-info, risk-limit;
OKX: liquidation-orders in pages of 100; sockets: Binance combined stream miniTicker + forceOrder).
Price and open interest are smooth made-up functions of time, with one planted jump of open interest five hours ago,
so the test knows where a cluster must appear and how large it must be.
Checks: zero JS errors; the data the model receives equals the mock functions; the planted cluster is where the arithmetic
says; every control works; four languages at 1280 px and 390 px without sideways scroll. Screenshots go to $SHOTS
(default /tmp/obsshots) — look at them.
The derivatives pages are checked the same way: every exchange's present open interest and funding is a known multiple
or offset, each in the exchange's own unit and settlement interval (contracts of 1000 coins, hourly and 4-hourly funding),
so the test knows the totals, shares and 8-hour rates the pages must show.
Run: python3 scripts/build_obs.py && python3 tests/obs_e2e.py          (ONLY=data|heat|map|oi|funding|ls|hub|langs|errors)
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
STATS = {"bn_oi_old": 0, "bn_old": 0, "bn_ls": 0, "by_ls": 0, "req": []}
# ---- the derivatives pages
EXS = {"binance": 1.0, "bybit": BY_SCALE, "okx": 0.5, "bitget": 0.4, "hyperliquid": 0.3, "gate": 0.2}    # present open interest as a multiple of Binance's
MULT = {"1000PEPEUSDT": 1000}                           # contracts quoted per 1000 coins on Binance and Bybit
FR_BASE = {"binance": 0.0001, "bybit": 0.00012, "okx": 0.00008, "bitget": 0.00015, "hyperliquid": -0.0002, "gate": 0.00005}    # present funding per 8 hours
FR_COIN = {"BTCUSDT": 0.0, "ETHUSDT": 0.00002, "SOLUSDT": -0.00035, "XRPUSDT": 0.0005, "1000PEPEUSDT": -0.00005, "DOGEUSDT": 0.0001}
FR_H = {("binance", "SOLUSDT"): 4, ("bybit", "SOLUSDT"): 4, ("bitget", "SOLUSDT"): 4}        # settlement every 4 hours instead of 8 (Hyperliquid: always 1)
GATE_MISSING = {"XRPUSDT"}                              # a coin Gate does not list
ODD = {("gate", "DOGEUSDT"): 1.6, ("hyperliquid", "DOGEUSDT"): 3.0}       # "DOGE" there is something else: its price is this many times the real one
DOWN = set()                                            # single endpoints switched off by a test ("bitget_iv")


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


def base_of(sym):
    return sym[:-4].replace("1000", "")


SYM_OF = {base_of(s): s for s in COINS}


def fr_hours(ex, sym):
    return 1 if ex == "hyperliquid" else FR_H.get((ex, sym), 8)


def fr8_now(ex, sym):
    return FR_BASE[ex] + FR_COIN[sym]


def fr8_at(ex, sym, t):
    return fr8_now(ex, sym) * (1 + 0.5 * math.sin(2 * math.pi * t / D / 5)) + 0.00003 * math.sin(2 * math.pi * t / D / 1.7)


def fr_native(ex, sym, fr8):
    """the rate as the exchange quotes it: per its own settlement interval"""
    return fr8 * fr_hours(ex, sym) / 8


def settlements(ex, sym, t0, t1):
    step = fr_hours(ex, sym) * H
    return list(range(-(-t0 // step) * step, min(t1, NOW) + 1, step))


def coins_now(sym, ex):
    return oi(sym, NOW) * MULT.get(sym, 1) * EXS[ex]


def px_coin(sym, t):
    return px(sym, t) / MULT.get(sym, 1)


def taker(sym, t, iv):
    v = candle(sym, t, iv)[4]
    buy = v * (0.5 + 0.1 * math.sin(t / D * 7))
    return buy, v - buy


def next_settle():
    return (NOW // (8 * H) + 1) * 8 * H


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
        return jresp(route, [{"symbol": s, "lastPrice": f"{px(s, NOW):.8f}", "quoteVolume": f"{(len(COINS) - i) * 4e9:.2f}", "priceChangePercent": "-1.25"} for i, s in enumerate(COINS)]
                     + [{"symbol": "ODDUSDT", "lastPrice": "1.00000000", "quoteVolume": "1000.00", "priceChangePercent": "0"}])       # on Bybit the same ticker costs 30: another coin
    if u.path == "/fapi/v1/premiumIndex":
        rows = [{"symbol": x, "markPrice": f"{px(x, NOW):.8f}", "indexPrice": f"{px(x, NOW):.8f}", "estimatedSettlePrice": "0", "lastFundingRate": f"{fr_native('binance', x, fr8_now('binance', x)):.10f}",
                 "interestRate": "0.00010000", "nextFundingTime": next_settle(), "time": NOW} for x in COINS]
        rows.append({"symbol": "BTCUSDC", "markPrice": "70000", "lastFundingRate": "0.00990000", "nextFundingTime": next_settle(), "time": NOW})      # not a USDT contract
        rows.append({"symbol": "BTCUSDT_270326", "markPrice": "70500", "lastFundingRate": "", "nextFundingTime": 0, "time": NOW})                    # a dated future has no funding
        return jresp(route, rows)
    if u.path == "/fapi/v1/fundingInfo":                               # only the contracts whose interval is not the default 8 hours
        return jresp(route, [{"symbol": x, "adjustedFundingRateCap": "0.02", "adjustedFundingRateFloor": "-0.02", "fundingIntervalHours": h, "disclaimer": False} for (ex, x), h in FR_H.items() if ex == "binance"])
    if sym not in COINS:
        return jresp(route, {"code": -1121, "msg": "Invalid symbol."}, 400)
    if u.path == "/fapi/v1/fundingRate":                               # oldest first from startTime; the real times carry a few milliseconds of jitter
        ts = settlements("binance", sym, int(q["startTime"]), int(q["endTime"]))[:int(q.get("limit", 100))]
        return jresp(route, [{"symbol": sym, "fundingTime": t + (t // H) % 7, "fundingRate": f"{fr_native('binance', sym, fr8_at('binance', sym, t)):.10f}", "markPrice": f"{px(sym, t):.8f}"} for t in ts])
    if u.path.startswith("/futures/data/") and u.path != "/futures/data/openInterestHist" and int(q["startTime"]) < NOW - 30 * D:
        STATS["bn_old"] += 1                                           # these lists, too, hold 30 days only
        return jresp(route, {"code": -1130, "msg": "parameter 'startTime' is invalid."}, 400)
    if u.path in ("/futures/data/topLongShortAccountRatio", "/futures/data/topLongShortPositionRatio"):
        iv, off = IV[q["period"]], 0.08 if "Account" in u.path else -0.05
        return jresp(route, [{"symbol": sym, "longShortRatio": "1.0", "longAccount": f"{lsr(t) + off:.4f}", "shortAccount": f"{1 - lsr(t) - off:.4f}", "timestamp": t}
                             for t in grid(int(q["startTime"]), int(q["endTime"]), iv, int(q.get("limit", 30)))])
    if u.path == "/futures/data/takerlongshortRatio":
        iv, out = IV[q["period"]], []
        for t in grid(int(q["startTime"]), int(q["endTime"]), iv, int(q.get("limit", 30))):
            b, sl = taker(sym, t, iv)
            out.append({"buySellRatio": f"{b / sl:.4f}", "buyVol": f"{b:.4f}", "sellVol": f"{sl:.4f}", "timestamp": t})
        return jresp(route, out)
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
                 "openInterestValue": f"{oi(s, NOW, BY_SCALE) * px(s, NOW):.2f}", "fundingRate": f"{fr_native('bybit', s, fr8_now('bybit', s)):.10f}",
                 "fundingIntervalHour": str(fr_hours("bybit", s)), "nextFundingTime": str(next_settle())} for i, s in enumerate(COINS)]
        rows.append({"symbol": "BTCPERP", "lastPrice": "70000", "price24hPcnt": "0", "turnover24h": "1", "openInterest": "1", "openInterestValue": "1", "fundingRate": "0"})   # not a USDT contract: must be ignored
        rows.append({"symbol": "ODDUSDT", "lastPrice": "30.0", "price24hPcnt": "0", "turnover24h": "1000", "openInterest": "1", "openInterestValue": "30", "fundingRate": "0.0001", "fundingIntervalHour": "8", "nextFundingTime": str(next_settle())})
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
        return ok({"list": [{"symbol": sym, "buyRatio": f"{lsr(t) - 0.03:.4f}", "sellRatio": f"{1 - lsr(t) + 0.03:.4f}", "timestamp": str(t)} for t in ts[::-1]]})
    if u.path == "/v5/market/funding/history":                         # newest first, 200 a page
        ts = settlements("bybit", sym, int(q["startTime"]), int(q["endTime"]))[-min(200, int(q.get("limit", 200))):]
        return ok({"category": "linear", "list": [{"symbol": sym, "fundingRate": f"{fr_native('bybit', sym, fr8_at('bybit', sym, t)):.10f}", "fundingRateTimestamp": str(t)} for t in ts[::-1]]})
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
    if u.path.endswith("/public/funding-rate"):                        # instId=ANY: every swap, the coin-margined ones too
        nxt = next_settle()
        data = [{"instId": f"{base_of(x)}-USDT-SWAP", "instType": "SWAP", "fundingRate": f"{fr8_now('okx', x):.10f}", "fundingTime": str(nxt), "nextFundingTime": str(nxt + 8 * H), "method": "current_period"} for x in COINS]
        data.append({"instId": "BTC-USD-SWAP", "instType": "SWAP", "fundingRate": "0.0099", "fundingTime": str(nxt), "nextFundingTime": str(nxt + 8 * H)})
        return jresp(route, {"code": "0", "data": data})
    if u.path.endswith("/public/open-interest"):
        data = [{"instId": f"{base_of(x)}-USDT-SWAP", "instType": "SWAP", "oi": f"{coins_now(x, 'okx') * 100:.2f}", "oiCcy": f"{coins_now(x, 'okx'):.6f}", "oiUsd": f"{coins_now(x, 'okx') * px_coin(x, NOW):.4f}", "ts": str(NOW)} for x in COINS]
        data.append({"instId": "BTC-USD-SWAP", "instType": "SWAP", "oi": "1", "oiCcy": "99999999", "oiUsd": "9000000000000", "ts": str(NOW)})
        return jresp(route, {"code": "0", "data": data})
    if u.path.endswith("/public/funding-rate-history"):                # newest first, 100 a page, about three months kept
        sym = SYM_OF.get(q.get("instId", "").split("-")[0])
        if not sym:
            return jresp(route, {"code": "51001", "msg": "Instrument ID does not exist", "data": []})
        after = int(q.get("after") or NOW + 1)
        ts = [t for t in settlements("okx", sym, NOW - 92 * D, NOW) if t < after][-100:]
        return jresp(route, {"code": "0", "data": [{"instId": q["instId"], "instType": "SWAP", "fundingRate": f"{fr8_at('okx', sym, t):.10f}", "realizedRate": f"{fr8_at('okx', sym, t):.10f}", "fundingTime": str(t), "method": "current_period"} for t in ts[::-1]]})
    return jresp(route, {"code": "0", "data": []})


def bitget(route):
    u = urlparse(route.request.url)
    STATS["req"].append(u.path)

    def bsym(x):
        return "PEPEUSDT" if x == "1000PEPEUSDT" else x                # Bitget quotes PEPE per coin
    if u.path.endswith("/tickers"):
        rows = [{"symbol": bsym(x), "lastPr": f"{px_coin(x, NOW):.12f}", "markPrice": f"{px_coin(x, NOW):.12f}", "fundingRate": f"{fr_native('bitget', x, fr8_now('bitget', x)):.10f}",
                 "holdingAmount": f"{coins_now(x, 'bitget'):.4f}", "usdtVolume": "1"} for x in COINS]
        rows.append({"symbol": "BTCPERP", "lastPr": "70000", "fundingRate": "0.0099", "holdingAmount": "1", "usdtVolume": "1"})
        return jresp(route, {"code": "00000", "msg": "success", "data": rows})
    if u.path.endswith("/current-fund-rate"):
        if "bitget_iv" in DOWN:
            return route.abort()
        return jresp(route, {"code": "00000", "msg": "success", "data": [{"symbol": bsym(x), "fundingRate": f"{fr_native('bitget', x, fr8_now('bitget', x)):.10f}", "fundingRateInterval": str(fr_hours("bitget", x)),
                                                                           "nextUpdate": str(next_settle()), "minFundingRate": "-0.003", "maxFundingRate": "0.003"} for x in COINS]})
    return jresp(route, {"code": "40404", "msg": "not mocked"}, 404)


def hyperliquid(route):
    STATS["req"].append("/info")
    if route.request.method == "OPTIONS":
        return route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type"})
    if (route.request.post_data_json or {}).get("type") != "metaAndAssetCtxs":
        return jresp(route, {"error": "not mocked"}, 422)
    uni, ctx = [], []
    for x in COINS:
        k = x in MULT                                                  # kPEPE: one unit is 1000 coins
        uni.append({"name": ("k" if k else "") + base_of(x), "szDecimals": 2, "maxLeverage": 40})
        ctx.append({"funding": f"{fr_native('hyperliquid', x, fr8_now('hyperliquid', x)):.12f}", "openInterest": f"{coins_now(x, 'hyperliquid') / (1000 if k else 1):.4f}", "markPx": f"{px(x, NOW) * ODD.get(('hyperliquid', x), 1):.10f}",
                    "oraclePx": f"{px(x, NOW):.10f}", "dayNtlVlm": "1"})
    uni.append({"name": "OLDCOIN", "szDecimals": 0, "maxLeverage": 3, "isDelisted": True})
    ctx.append({"funding": "0.5", "openInterest": "5", "markPx": "1"})
    return jresp(route, [{"universe": uni}, ctx])


def gate(route):
    u = urlparse(route.request.url)
    STATS["req"].append(u.path)
    name = u.path.rsplit("/", 1)[-1]
    sym = SYM_OF.get(name.replace("_USDT", ""))
    if not sym or sym in GATE_MISSING:
        return jresp(route, {"label": "CONTRACT_NOT_FOUND", "message": "contract not found"}, 400)
    qm = 10_000_000 if sym in MULT else 0.0001 if sym == "BTCUSDT" else 1                   # coins in one contract
    return jresp(route, {"name": name, "mark_price": f"{px_coin(sym, NOW) * ODD.get(('gate', sym), 1):.12f}", "funding_rate": f"{fr8_now('gate', sym):.10f}", "funding_interval": 28800,
                         "position_size": round(coins_now(sym, "gate") / qm), "quanto_multiplier": str(qm)})


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
    page.route("https://api.bitget.com/**", (lambda r: r.abort()) if "bitget" in block else bitget)
    page.route("https://api.hyperliquid.xyz/**", (lambda r: r.abort()) if "hyperliquid" in block else hyperliquid)
    page.route("https://api.gateio.ws/**", (lambda r: r.abort()) if "gate" in block else gate)
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


def wait_dv(page, timeout=30000):
    page.wait_for_function("() => window.OB && OB._dv && OB._dv.V.data && !OB._dv.V.loading", timeout=timeout)
    page.wait_for_timeout(300)


def pnum(txt):
    """'+0.0125%' → 0.0125 · '-3.1%' → -3.1 · '—' → None"""
    m = re.search(r"[-+]?\d+(?:\.\d+)?", txt.replace(",", ""))
    return float(m.group(0)) if m else None


def near(a, b, rel=1e-6, ab=0.0):
    return a is not None and b is not None and abs(a - b) <= max(ab, rel * abs(b))


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
            # 10x with 0.33 % maintenance margin: long at entry × (1 − 0.1 + 0.0033), short at entry × (1 + 0.1 − 0.0033).
            # The made-up background also leaves levels there, so the model is run twice in the page — on the feeds as loaded
            # and on the same feeds with the jump taken out — and the difference must be the planted contracts (a few per
            # cent less: open interest fell a little since, and falling open interest shrinks every level).
            o, h, l, c, v = candle("BTCUSDT", PLANT, 5 * MIN)
            tp = (h + l + c) / 3
            exp_units = (3600 + 3600 * BY_SCALE) * 0.25
            r = page.evaluate("""([pl, ps, plant, jump, byScale]) => { const V = OB._liq.V, g = V.res.grid, M = window.OBLiq, ends = V.cols.ends, tiers = { 10: 1, 25: 1, 50: 1, 100: 1 };
              const around = (arr, p) => { const r0 = M.rowOf(g, p); let u = 0; for (let r = r0 - 3; r <= r0 + 3; r++) if (r >= 0 && r < g.rows) u += arr[r] / M.priceOf(g, r); return u; };
              const run = feeds => M.sum(feeds.map(f => M.run(f, { model: 1, tiers, grid: g, colEnds: ends })));
              const without = V.feeds.map(f => { const j = f.ex === 'bybit' ? jump * byScale : jump, x = Object.assign({}, f, { oi0: f.oi0.slice(), oi1: f.oi1.slice() });
                for (let i = 0; i < f.t.length; i++) { if (f.t[i] > plant) x.oi0[i] -= j; if (f.t[i] >= plant) x.oi1[i] -= j; } return x; });
              const A = run(V.feeds), B = run(without);
              return { long10: around(A.longT[1], pl) - around(B.longT[1], pl), short10: around(A.shortT[1], ps) - around(B.shortT[1], ps), bgLong: around(B.longT[1], pl), tiers: V.res.tiers,
                same: Math.abs(around(A.longT[1], pl) - around(V.res.longT[1], pl)) < 1e-6 }; }""",
                              [tp * (1 - 0.1 + 0.0033), tp * (1 + 0.1 - 0.0033), PLANT, 3600, BY_SCALE])
            check("re-running the model in the page reproduces what is on screen", r["same"])
            check("the planted jump's 10x long cluster holds the planted contracts", 0.85 * exp_units < r["long10"] < 1.03 * exp_units, (r["long10"], exp_units, r["bgLong"]))
            check("the planted jump's 10x short cluster holds the planted contracts", 0.85 * exp_units < r["short10"] < 1.03 * exp_units, (r["short10"], exp_units))
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
            check("the palette changes the picture (fire is far redder than ice)", c_fire[0] / c_fire[1] > 3 * c_ice[0] / c_ice[1] and c_ice[1] > c_ice[0], (c_fire, c_ice))
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
            page.wait_for_selector("#ob-map svg rect[fill='#ff7a66'], #ob-map svg rect[fill='#3fd9a0']")
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

        # ------------------------------------------------------------ open interest by exchange
        if not ONLY or ONLY == "oi":
            print("open interest")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/open-interest/")
            wait_dv(page)
            SNAP = """() => { const V = OB._dv.V, D0 = V.data, P = V.ts.P;
              return { coin: V.coin.base, snap: D0.snap, chg: D0.chg, range: D0.R.k, iv: D0.R.iv,
                panes: P.map(p => ({ title: p.title, series: p.series.map(s => ({ name: s.name, type: s.type, hide: !!s.hide, n: s.data.length, first: s.data.length ? s.data[0][0] : null, last: s.data.length ? s.data[s.data.length - 1][0] : null, mid: s.data[Math.floor(s.data.length / 2)] })) })),
                rows: [...document.querySelectorAll('#ob-table tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())), foot: [...document.querySelectorAll('#ob-table tfoot td')].map(td => td.textContent.trim()),
                tiles: [...document.querySelectorAll('#ob-tiles .ob-tile')].map(t => [t.querySelector('small').textContent, t.querySelector('b').textContent, (t.querySelector('span') || {}).textContent || '']),
                note: document.getElementById('ob-note').textContent, missing: (document.getElementById('ob-miss') || {}).textContent || '', odd: (document.getElementById('ob-odd') || {}).textContent || '' }; }"""
            d = page.evaluate(SNAP)
            order = ["binance", "bybit", "okx", "bitget", "hyperliquid", "gate"]
            names = ["Binance", "Bybit", "OKX", "Bitget", "Hyperliquid", "Gate"]
            check("open interest opens on BTC, one week of 30-minute points", d["coin"] == "BTC" and d["range"] == "1w" and d["iv"] == "30m", (d["coin"], d["range"], d["iv"]))
            bad = [e for e in order if not (d["snap"].get(e) and near(d["snap"][e]["oi"], coins_now("BTCUSDT", e), 1e-4) and near(d["snap"][e]["oiUsd"], coins_now("BTCUSDT", e) * px("BTCUSDT", NOW), 1e-4))]
            check("each exchange's open interest is its own figure, in coins and in dollars", not bad, (bad, d["snap"]))
            check("the table lists the six exchanges from the largest down", [r[0] for r in d["rows"]] == names, [r[0] for r in d["rows"]])
            tot_c = sum(coins_now("BTCUSDT", e) for e in order)
            fmt = page.evaluate("([u, c]) => [OB.fmtUsd(u), OB.compact(c)]", [tot_c * px("BTCUSDT", NOW), tot_c])
            check("the total is the sum of the six (footer and tile)", d["foot"][1] == fmt[0] and d["foot"][3] == fmt[1] and d["tiles"][0][1] == fmt[0] and fmt[1] + " BTC" in d["tiles"][0][2] and "6" in d["tiles"][0][0], (d["foot"], d["tiles"][0], fmt))
            shares = [pnum(r[2]) for r in d["rows"]]
            check("shares add up to 100 % and Binance's is 1 ÷ 3.15", abs(sum(shares) - 100) < 0.35 and abs(shares[0] - 100 / 3.15) < 0.06, shares)
            check("each row carries the exchange's funding per 8 hours", all(near(pnum(r[4]), fr8_now(e, "BTCUSDT") * 100, 0, 6e-5) for r, e in zip(d["rows"], order)), [r[4] for r in d["rows"]])
            tl = NOW // H * H
            e_coin = (oi("BTCUSDT", tl) / oi("BTCUSDT", tl - 24 * H) - 1) * 100
            e_usd = (oi("BTCUSDT", tl) * px("BTCUSDT", tl) / (oi("BTCUSDT", tl - 24 * H) * px("BTCUSDT", tl - 24 * H)) - 1) * 100
            check("the 24-hour change is the hourly history's latest row against the one a day before", d["chg"] and d["chg"]["ex"] == ["binance", "bybit"] and d["chg"]["t"] == tl and near(d["chg"]["coin"], e_coin, 1e-6) and near(d["chg"]["usd"], e_usd, 1e-6), (d["chg"], e_coin, e_usd))
            check("…and the tile shows the dollar change", near(pnum(d["tiles"][1][1]), e_usd, 0, 0.051) and "Binance + Bybit" in d["tiles"][1][2] and "dollars" in d["tiles"][1][0], d["tiles"][1])
            pn = d["panes"]
            check("two panes: candles above, open interest below", len(pn) == 2 and pn[0]["series"][0]["type"] == "candle" and [x["name"] for x in pn[1]["series"]] == ["Sum of 2 exchanges", "Binance", "Bybit"], [[x["name"] for x in q["series"]] for q in pn])
            t, v = pn[1]["series"][1]["mid"]
            check("a point of Binance's line is its open interest × the price of that moment", near(v, oi("BTCUSDT", t) * px("BTCUSDT", t), 1e-6), (t, v))
            t, v = pn[1]["series"][0]["mid"]
            check("the sum line is Binance + Bybit at the same moment", near(v, (1 + BY_SCALE) * oi("BTCUSDT", t) * px("BTCUSDT", t), 1e-6), (t, v))
            check("one week is on the chart", all(abs((NOW - x["first"]) / D - 7) < 0.05 for x in pn[1]["series"]) and all(NOW - x["last"] < 31 * MIN for x in pn[1]["series"]), [(NOW - x["first"]) / D for x in pn[1]["series"]])
            check("the chart is painted", colours(page, "#ob-ts .ob-cv") > 12, colours(page, "#ob-ts .ob-cv"))
            check("no sideways scroll at 1280 (open interest)", overflow(page) <= 0, overflow(page))
            page.locator("#ob-main").screenshot(path=os.path.join(SHOTS, "oi_en_1280.png"))

            # read-out, legend switches, unit, range
            box = page.locator("#ob-ts .ob-cv").bounding_box()
            page.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.3)
            page.wait_for_timeout(200)
            tip = page.locator("#ob-ts .ob-tip")
            tt = tip.inner_text() if tip.is_visible() else ""
            check("hover reads every series at that moment", all(x in tt for x in ("Price", "Sum of 2 exchanges", "Binance", "Bybit")) and tt.count("$") >= 3, tt)
            page.screenshot(path=os.path.join(SHOTS, "oi_en_hover.png"))
            page.mouse.move(5, 5)
            page.locator(".ob-lk", has_text="Bybit").click()
            hid = page.evaluate("() => [OB._dv.V.ts.P[1].series[2].hide, document.querySelectorAll('.ob-lk.off').length]")
            check("a click in the legend hides that line", hid == [True, 1], hid)
            page.locator(".ob-lk", has_text="Bybit").click()
            page.locator("#ob-u button[data-v='coin']").click()
            page.wait_for_timeout(250)
            d2 = page.evaluate(SNAP)
            t, v = d2["panes"][1]["series"][1]["mid"]
            check("in coins the line is the open interest itself", near(v, oi("BTCUSDT", t), 1e-6) and "BTC" in d2["panes"][1]["title"], (t, v, d2["panes"][1]["title"]))
            check("…and the change tile turns to coins", near(pnum(d2["tiles"][1][1]), e_coin, 0, 0.051) and "coins" in d2["tiles"][1][0], d2["tiles"][1])
            page.locator("#ob-u button[data-v='usd']").click()
            page.locator("#ob-r button[data-v='3m']").click()
            wait_dv(page, 45000)
            d3 = page.evaluate(SNAP)
            sr = d3["panes"][1]["series"]
            check("3 months: Binance gives its 30 days, Bybit the whole range, the sum starts with Binance", d3["iv"] == "4h" and 29 < (NOW - sr[1]["first"]) / D < 30 and 89.7 < (NOW - sr[2]["first"]) / D <= 90.2 and sr[0]["first"] == sr[1]["first"], [(NOW - x["first"]) / D for x in sr])
            check("…the note says why", "30 days" in d3["note"], d3["note"][-120:])
            check("…and nothing older than 30 days was asked of Binance", STATS["bn_oi_old"] == 0, STATS["bn_oi_old"])
            page.locator("#ob-main").screenshot(path=os.path.join(SHOTS, "oi_en_3m.png"))

            # a contract quoted per 1000 coins on some exchanges and per coin on others
            page.locator("#ob-coin").click()
            page.wait_for_selector("#ob-pick .ob-pi")
            page.locator("#ob-pq").fill("pepe")
            page.wait_for_timeout(250)
            page.locator("#ob-pick .ob-pi").first.click()
            wait_dv(page, 45000)
            dp = page.evaluate(SNAP)
            bad = [e for e in order if not (dp["snap"].get(e) and near(dp["snap"][e]["oi"], coins_now("1000PEPEUSDT", e), 1e-4) and near(dp["snap"][e]["oiUsd"], coins_now("1000PEPEUSDT", e) * px_coin("1000PEPEUSDT", NOW), 1e-4))]
            check("PEPE: every exchange is brought to single coins, whatever unit it quotes", dp["coin"] == "PEPE" and not bad, (bad, dp["snap"]))
            fmt = page.evaluate("([u]) => OB.fmtUsd(u)", [sum(coins_now("1000PEPEUSDT", e) for e in order) * px_coin("1000PEPEUSDT", NOW)])
            check("PEPE: the total is right", dp["foot"][1] == fmt, (dp["foot"], fmt))
            check("the coin button shows PEPE with its logo", page.locator("#ob-coin-s").inner_text() == "PEPE" and page.locator("#ob-coin-l img").count() == 1)

            # an exchange that does not list the coin is named, not guessed
            page.goto(base + "/charts/open-interest/?coin=XRP&range=24h")
            wait_dv(page)
            dx = page.evaluate(SNAP)
            fmt = page.evaluate("([u]) => OB.fmtUsd(u)", [sum(coins_now("XRPUSDT", e) for e in order[:5]) * px("XRPUSDT", NOW)])
            check("a shared link opens its coin and range", dx["coin"] == "XRP" and dx["range"] == "24h" and dx["iv"] == "5m", (dx["coin"], dx["range"]))
            check("XRP: Gate does not list it — five rows, Gate named under the table, total of five", len(dx["rows"]) == 5 and "Gate" in dx["missing"] and dx["foot"][1] == fmt and "5" in dx["tiles"][0][0], (dx["rows"], dx["missing"], dx["foot"], fmt))
            # the same name, another coin: Hyperliquid's and Gate's "DOGE" cost 3× and 1.6× the others' — left out and named
            page.goto(base + "/charts/open-interest/?coin=DOGE&range=24h")
            wait_dv(page)
            dd = page.evaluate(SNAP)
            fmt = page.evaluate("([u]) => OB.fmtUsd(u)", [sum(coins_now("DOGEUSDT", e) for e in order[:4]) * px("DOGEUSDT", NOW)])
            check("DOGE: two exchanges whose price is far from the rest are left out of the total and named", [r[0] for r in dd["rows"]] == names[:4] and "Hyperliquid" in dd["odd"] and "Gate" in dd["odd"] and dd["missing"] == "" and dd["foot"][1] == fmt and "4" in dd["tiles"][0][0],
                  ([r[0] for r in dd["rows"]], dd["odd"], dd["missing"], dd["foot"], fmt))
            oddc = page.evaluate("async () => { const l = await OB.coins(); const c = l.find(x => x.base === 'ODD'); return c ? { bn: c.bn || null, by: c.by || null, px: c.px } : null; }")
            check("a ticker that is another coin on Bybit (30× the price) is not merged with Binance's", bool(oddc) and oddc["bn"] == "ODDUSDT" and oddc["by"] is None and abs(oddc["px"] - 1) < 1e-9, oddc)
            page.goto(base + "/charts/open-interest/?coin=XRP&range=24h")
            wait_dv(page)
            with page.expect_download(timeout=10000) as dl:
                page.locator("#ob-png").click()
            check("the PNG is saved (open interest)", dl.value.suggested_filename == "entekhab-oi-XRP.png" and os.path.getsize(dl.value.path()) > 15000, (dl.value.suggested_filename, os.path.getsize(dl.value.path())))
            os.replace(dl.value.path(), os.path.join(SHOTS, "export_oi.png"))
            page.locator("#ob-share").click()
            page.wait_for_timeout(300)
            clip = page.evaluate("() => navigator.clipboard.readText()")
            check("the link carries the coin and the range", "coin=XRP" in clip and "range=24h" in clip and "/charts/open-interest/" in clip, clip)
            check("no JS errors (open interest)", not errors, errors[:3])
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "fa")
            page.goto(base + "/charts/open-interest/?coin=XRP&range=24h")
            wait_dv(page)
            check("Persian: the page's own tab and right-to-left", page.evaluate("() => document.documentElement.lang + document.documentElement.dir") == "fartl" and page.locator(".ob-tab.on").inner_text().strip() == "اوپن اینترست")
            page.locator("#ob-main").screenshot(path=os.path.join(SHOTS, "oi_fa_1280.png"))
            page.locator("#langs button[data-l=en]").click()
            wait_dv(page)
            check("switching to English rebuilds the page in place, keeping the coin", page.evaluate("() => document.documentElement.lang + document.documentElement.dir") == "enltr" and page.locator(".ob-tab.on").inner_text().strip() == "Open interest" and page.evaluate("() => OB._dv.V.coin.base") == "XRP"
                  and page.locator("#ob-tiles .ob-tile small").first.inner_text().startswith("Open interest"))
            check("no JS errors (open interest, language switch)", not errors, errors[:3])
            ctx.close()

        # ------------------------------------------------------------ funding rates
        if not ONLY or ONLY == "funding":
            print("funding")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/funding-rate/")
            wait_dv(page)
            FSNAP = """() => { const V = OB._dv.V, D0 = V.data, P = V.ts.P, tab = D0.table, g = (e, c) => tab[e] && tab[e][c] ? { fr: tab[e][c].fr, h: tab[e][c].h, fr8: tab[e][c].fr8, oi: tab[e][c].oi } : null;
              return { coin: V.coin.base, range: D0.R.k, cell: { bn_btc: g('binance', 'BTC'), bn_sol: g('binance', 'SOL'), by_sol: g('bybit', 'SOL'), hl_btc: g('hyperliquid', 'BTC'), bg_sol: g('bitget', 'SOL'), bg_btc: g('bitget', 'BTC'), ok_btc: g('okx', 'BTC') },
                okx_n: tab.okx ? Object.keys(tab.okx).length : -1, bn_n: tab.binance ? Object.keys(tab.binance).length : -1, hl: tab.hyperliquid ? Object.keys(tab.hyperliquid) : null, title: P[1].title,
                series: P[1].series.map(s => ({ name: s.name, type: s.type, n: s.data.length, first: s.data.length ? s.data[0][0] : null, last: s.data.length ? s.data[s.data.length - 1][0] : null, mid: s.data[Math.floor(s.data.length / 2)], gap: s.data.length > 1 ? s.data[1][0] - s.data[0][0] : null })),
                tiles: [...document.querySelectorAll('#ob-tiles .ob-tile')].map(t => [t.querySelector('small').textContent, t.querySelector('b').textContent, (t.querySelector('span') || {}).textContent || '']),
                head: [...document.querySelectorAll('#ob-table thead th')].map(th => th.textContent.trim()), rows: [...document.querySelectorAll('#ob-table tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())),
                bg: [...document.querySelectorAll('#ob-table tbody tr')].map(tr => [...tr.children].map(td => td.getAttribute('style') || '')), logos: document.querySelectorAll('#ob-table tbody td:first-child img').length,
                on: [...document.querySelectorAll('#ob-table tbody tr.on')].map(tr => tr.getAttribute('data-c')), warn: (document.querySelector('#ob-table .ob-warn') || {}).textContent || '' }; }"""
            d = page.evaluate(FSNAP)
            five = ["binance", "bybit", "okx", "bitget", "hyperliquid"]
            mean_btc = sum(fr8_now(e, "BTCUSDT") for e in five) / 5
            check("funding opens on BTC, one month", d["coin"] == "BTC" and d["range"] == "1m", (d["coin"], d["range"]))
            c = d["cell"]
            check("a 4-hour contract on Binance is brought to 8 hours (× 2)", c["bn_sol"]["h"] == 4 and near(c["bn_sol"]["fr"], fr8_now("binance", "SOLUSDT") / 2, 1e-6) and near(c["bn_sol"]["fr8"], fr8_now("binance", "SOLUSDT"), 1e-6), c["bn_sol"])
            check("…and on Bybit and Bitget, each from the exchange's own interval", c["by_sol"]["h"] == 4 and near(c["by_sol"]["fr8"], fr8_now("bybit", "SOLUSDT"), 1e-6) and c["bg_sol"]["h"] == 4 and near(c["bg_sol"]["fr8"], fr8_now("bitget", "SOLUSDT"), 1e-6), (c["by_sol"], c["bg_sol"]))
            check("Hyperliquid's hourly rate is brought to 8 hours (× 8)", c["hl_btc"]["h"] == 1 and near(c["hl_btc"]["fr"], fr8_now("hyperliquid", "BTCUSDT") / 8, 1e-6) and near(c["hl_btc"]["fr8"], fr8_now("hyperliquid", "BTCUSDT"), 1e-6), c["hl_btc"])
            check("an 8-hour rate is left as it is", c["bn_btc"]["h"] == 8 and near(c["bn_btc"]["fr8"], 0.0001, 1e-9) and near(c["ok_btc"]["fr8"], 0.00008, 1e-9), (c["bn_btc"], c["ok_btc"]))
            check("contracts that are not USDT perpetuals are left out (USDC, dated, coin-margined, delisted)", d["bn_n"] == 6 and d["okx_n"] == 6 and "OLDCOIN" not in d["hl"] and "PEPE" in d["hl"] and "kPEPE" not in d["hl"], (d["bn_n"], d["okx_n"], d["hl"]))
            t = d["tiles"]
            check("tiles: the average of five, the same per year, the highest and the lowest with their exchange", "5" in t[0][0] and near(pnum(t[0][1]), mean_btc * 100, 0, 6e-5) and near(pnum(t[1][1]), mean_btc * 3 * 365 * 100, 0, 0.06)
                  and near(pnum(t[2][1]), 0.015, 0, 6e-5) and t[2][2] == "Bitget" and near(pnum(t[3][1]), -0.02, 0, 6e-5) and t[3][2] == "Hyperliquid", t)
            sr = d["series"]
            check("history: three step lines — Binance, Bybit, OKX", [x["name"] for x in sr] == ["Binance", "Bybit", "OKX"] and all(x["type"] == "step" for x in sr), sr)
            check("…a month of 8-hour settlements each", all(88 <= x["n"] <= 91 and abs(x["gap"] - 8 * H) < 10 and 29.6 < (NOW - x["first"]) / D <= 30.01 for x in sr), [(x["n"], x["gap"], (NOW - x["first"]) / D) for x in sr])
            for x, e in zip(sr, ("binance", "bybit", "okx")):
                tt, v = x["mid"]
                check(f"…a point of {x['name']}'s line is its settled rate, in per cent", near(v, fr8_at(e, "BTCUSDT", tt - tt % H) * 100, 1e-5), (tt, v))
            check("the table: six coins by volume, five exchanges, average and spread", d["head"] == ["Coin", "Binance", "Bybit", "OKX", "Bitget", "Hyperliquid", "Average", "Spread"] and [r[0] for r in d["rows"]] == ["BTC", "ETH", "SOL", "XRP", "PEPE", "DOGE"], (d["head"], [r[0] for r in d["rows"]]))
            check("every coin in the table has its logo", d["logos"] == 6, d["logos"])
            r0 = d["rows"][0]
            check("BTC's row: each exchange's rate, their average and the spread", all(near(pnum(r0[i + 1]), fr8_now(e, "BTCUSDT") * 100, 0, 6e-5) for i, e in enumerate(five)) and near(pnum(r0[6]), mean_btc * 100, 0, 6e-5) and near(pnum(r0[7]), 0.035, 0, 6e-5) and not r0[7].startswith("+"), r0)
            r2 = d["rows"][2]
            check("SOL's row shows 8-hour rates, not the 4-hour ones the exchanges quote", near(pnum(r2[1]), fr8_now("binance", "SOLUSDT") * 100, 0, 6e-5) and near(pnum(r2[2]), fr8_now("bybit", "SOLUSDT") * 100, 0, 6e-5) and near(pnum(r2[4]), fr8_now("bitget", "SOLUSDT") * 100, 0, 6e-5), r2)
            r5 = d["rows"][5]
            mean4 = sum(fr8_now(e, "DOGEUSDT") for e in five[:4]) / 4
            check("DOGE's row: Hyperliquid's namesake at 3× the price is not counted as DOGE", r5[0] == "DOGE" and r5[5] == "—" and near(pnum(r5[6]), mean4 * 100, 0, 6e-5) and near(pnum(r5[4]), fr8_now("bitget", "DOGEUSDT") * 100, 0, 6e-5), r5)
            check("colour: blue where shorts pay, orange where longs pay", "57,135,229" in d["bg"][0][5] and "247,147,26" in d["bg"][0][4] and "57,135,229" in d["bg"][2][1], (d["bg"][0], d["bg"][2][1]))
            check("the chosen coin's row is marked", d["on"] == ["BTC"], d["on"])
            check("no sideways scroll at 1280 (funding)", overflow(page) <= 0, overflow(page))
            page.locator("#ob-main").screenshot(path=os.path.join(SHOTS, "funding_en_1280.png"))

            # sorting, the unit, a coin from the table
            page.locator(".ob-ths[data-sort=avg]").click()
            page.wait_for_timeout(150)
            o1 = page.evaluate("() => [...document.querySelectorAll('#ob-table tbody tr')].map(tr => tr.getAttribute('data-c'))")
            check("sorting by the average puts the dearest first", o1 == ["XRP", "DOGE", "ETH", "BTC", "PEPE", "SOL"] and page.locator(".ob-ths.on").inner_text() == "Average", o1)
            page.locator(".ob-ths[data-sort=vol]").click()
            page.locator("#ob-u button[data-v='apr']").click()
            page.wait_for_timeout(250)
            da = page.evaluate(FSNAP)
            tt, v = da["series"][0]["mid"]
            check("per year: the table, the line and the pane's title are × 3 × 365", near(pnum(da["rows"][0][1]), 0.0001 * 1095 * 100, 0, 0.06) and near(v, fr8_at("binance", "BTCUSDT", tt - tt % H) * 1095 * 100, 1e-5) and "per year" in da["title"], (da["rows"][0], v, da["title"]))
            page.locator("#ob-u button[data-v='8h']").click()
            page.locator(".ob-rowc[data-c='SOL']").click()
            wait_dv(page)
            ds = page.evaluate(FSNAP)
            sr = ds["series"]
            check("a click on SOL loads its history; its row is marked", ds["coin"] == "SOL" and ds["on"] == ["SOL"] and page.locator("#ob-coin-s").inner_text() == "SOL", (ds["coin"], ds["on"]))
            check("SOL settles every 4 hours on Binance and Bybit, every 8 on OKX", abs(sr[0]["gap"] - 4 * H) < 10 and abs(sr[1]["gap"] - 4 * H) < 10 and abs(sr[2]["gap"] - 8 * H) < 10 and 178 <= sr[0]["n"] <= 181, [(x["gap"], x["n"]) for x in sr])
            for x, e in zip(sr[:2], ("binance", "bybit")):
                tt, v = x["mid"]
                check(f"…and {x['name']}'s 4-hour settlements are drawn as 8-hour rates", near(v, fr8_at(e, "SOLUSDT", tt - tt % H) * 100, 1e-5), (tt, v, fr8_at(e, "SOLUSDT", tt - tt % H) * 100))
            page.locator("#ob-r button[data-v='1y']").click()
            wait_dv(page, 90000)
            dy = page.evaluate(FSNAP)
            sr = dy["series"]
            check("1 year: Binance and Bybit reach back a year page by page, OKX its three months", 364 < (NOW - sr[0]["first"]) / D <= 365.01 and 364 < (NOW - sr[1]["first"]) / D <= 365.01 and 91 < (NOW - sr[2]["first"]) / D <= 92.01 and 2185 <= sr[0]["n"] <= 2191 and sr[0]["n"] == sr[1]["n"],
                  [((NOW - x["first"]) / D, x["n"]) for x in sr])
            box = page.locator("#ob-ts .ob-cv").bounding_box()
            page.mouse.move(box["x"] + box["width"] * 0.4, box["y"] + box["height"] * 0.7)
            page.wait_for_timeout(200)
            tip = page.locator("#ob-ts .ob-tip")
            tt = tip.inner_text() if tip.is_visible() else ""
            check("hover seven months back reads the two exchanges that reach there, not OKX", "Binance" in tt and "Bybit" in tt and "OKX" not in tt and tt.count("%") == 2, tt)
            page.mouse.move(box["x"] + box["width"] * 0.85, box["y"] + box["height"] * 0.7)
            page.wait_for_timeout(200)
            tt = tip.inner_text() if tip.is_visible() else ""
            check("hover in the last three months reads the three rates", all(x in tt for x in ("Binance", "Bybit", "OKX")) and tt.count("%") == 3, tt)
            page.locator("#ob-main").screenshot(path=os.path.join(SHOTS, "funding_en_sol_1y.png"))
            with page.expect_download(timeout=10000) as dl:
                page.locator("#ob-png").click()
            check("the PNG is saved (funding)", dl.value.suggested_filename == "entekhab-funding-SOL.png" and os.path.getsize(dl.value.path()) > 15000, (dl.value.suggested_filename, os.path.getsize(dl.value.path())))
            os.replace(dl.value.path(), os.path.join(SHOTS, "export_funding.png"))
            check("no JS errors (funding)", not errors, errors[:3])
            ctx.close()

            # Bitget's list of intervals does not answer: its rate is left empty, never assumed to be 8-hourly
            DOWN.add("bitget_iv")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/funding-rate/")
            wait_dv(page)
            db = page.evaluate(FSNAP)
            DOWN.discard("bitget_iv")
            check("without Bitget's intervals its rate is empty (open interest still read), and the average is of four", db["cell"]["bg_btc"]["fr8"] is None and db["cell"]["bg_btc"]["oi"] > 0 and db["rows"][0][4] == "—" and "4" in db["tiles"][0][0]
                  and near(pnum(db["tiles"][0][1]), sum(fr8_now(e, "BTCUSDT") for e in five if e != "bitget") / 4 * 100, 0, 6e-5), (db["cell"]["bg_btc"], db["rows"][0], db["tiles"][0]))
            check("…without JS errors", not errors, errors[:3])
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "en", block=("hyperliquid",))
            page.goto(base + "/charts/funding-rate/")
            wait_dv(page)
            dh = page.evaluate(FSNAP)
            check("an exchange that does not answer is named under the table and its column is empty", "Hyperliquid" in dh["warn"] and len(dh["rows"]) == 6 and all(r[5] == "—" for r in dh["rows"]) and "4" in dh["tiles"][0][0], (dh["warn"], dh["rows"][0]))
            check("…without JS errors (one exchange down)", not errors, errors[:3])
            ctx.close()

        # ------------------------------------------------------------ long/short ratio
        if not ONLY or ONLY == "ls":
            print("long/short")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/long-short/")
            wait_dv(page)
            LSNAP = """() => { const V = OB._dv.V, D0 = V.data, P = V.ts.P, m = a => a && a.length ? { n: a.length, first: a[0][0], last: a[a.length - 1], mid: a[Math.floor(a.length / 2)] } : null;
              return { coin: V.coin.base, range: D0.R.k, iv: D0.R.iv, ls: { bn_all: m(D0.ls.bn_all), by_all: m(D0.ls.by_all), bn_top_acc: m(D0.ls.bn_top_acc), bn_top_pos: m(D0.ls.bn_top_pos), bn_taker: m(D0.ls.bn_taker) },
                panes: P.map(p => ({ title: p.title, marks: (p.marks || []).map(k => k.y), series: p.series.map(s => ({ name: s.name, type: s.type, color: s.color, n: s.data.length, mid: s.data[Math.floor(s.data.length / 2)] })) })),
                tiles: [...document.querySelectorAll('#ob-tiles .ob-tile')].map(t => [t.querySelector('small').textContent, t.querySelector('b').textContent, (t.querySelector('span') || {}).textContent || '']) }; }"""
            d = page.evaluate(LSNAP)
            check("long/short opens on BTC, one week of 30-minute points", d["coin"] == "BTC" and d["range"] == "1w" and d["iv"] == "30m", (d["coin"], d["range"]))
            L = d["ls"]
            offs = {"bn_all": 0.0, "by_all": -0.03, "bn_top_acc": 0.08, "bn_top_pos": -0.05}
            for k, off in offs.items():
                t, v = L[k]["mid"]
                check(f"{k}: the share of accounts long is the exchange's own figure", near(v, lsr(t) + off, 0, 6e-5) and 330 <= L[k]["n"] <= 337, (t, v, L[k]["n"]))
            t, b, sl = L["bn_taker"]["mid"]
            eb, es = taker("BTCUSDT", t, 30 * MIN)
            check("takers' buys and sells are Binance's, in coins", near(b, eb, 1e-6) and near(sl, es, 1e-6), (t, b, sl, eb, es))
            pn = d["panes"]
            check("three panes: price, the four shares with the 50 % line, net taker volume as bars", len(pn) == 3 and pn[0]["series"][0]["type"] == "candle" and len(pn[1]["series"]) == 4 and pn[1]["marks"] == [50] and pn[2]["series"][0]["type"] == "bars", [(x["title"], len(x["series"])) for x in pn])
            t, v = pn[1]["series"][0]["mid"]
            check("the lines are in per cent", near(v, lsr(t) * 100, 0, 0.006), (t, v))
            t, v = pn[2]["series"][0]["mid"]
            eb, es = taker("BTCUSDT", t, 30 * MIN)
            check("a bar is buys minus sells of its interval", near(v, eb - es, 1e-5, 1e-3), (t, v, eb - es))
            check("the four lines have four different colours", len({x["color"] for x in pn[1]["series"]}) == 4, [x["color"] for x in pn[1]["series"]])
            tl = L["bn_all"]["last"][0]
            tls = d["tiles"]
            check("tiles: the latest share of each group, with the short share beside it", len(tls) == 4 and near(pnum(tls[0][1]), lsr(tl) * 100, 0, 0.06) and near(pnum(tls[2][1]), (lsr(tl) + 0.08) * 100, 0, 0.06) and near(pnum(tls[0][2]), 100 - lsr(tl) * 100, 0, 0.06), tls)
            check("the chart is painted (long/short)", colours(page, "#ob-ts .ob-cv") > 12, colours(page, "#ob-ts .ob-cv"))
            check("no sideways scroll at 1280 (long/short)", overflow(page) <= 0, overflow(page))
            box = page.locator("#ob-ts .ob-cv").bounding_box()
            page.mouse.move(box["x"] + box["width"] * 0.45, box["y"] + box["height"] * 0.55)
            page.wait_for_timeout(200)
            tip = page.locator("#ob-ts .ob-tip")
            tt = tip.inner_text() if tip.is_visible() else ""
            check("hover reads the price, the four shares and the taker bar", tt.count("%") >= 4 and "Net taker volume" in tt and "Price" in tt, tt)
            page.locator("#ob-main").screenshot(path=os.path.join(SHOTS, "ls_en_1280.png"))
            page.locator("#ob-r button[data-v='1m']").click()
            wait_dv(page, 45000)
            dm = page.evaluate(LSNAP)
            check("1 month: Binance's lists stay inside their 30 days, Bybit covers the month", dm["iv"] == "1h" and 29 < (NOW - dm["ls"]["bn_all"]["first"]) / D < 30 and 29 < (NOW - dm["ls"]["bn_taker"]["first"]) / D < 30 and 29.9 < (NOW - dm["ls"]["by_all"]["first"]) / D <= 30.05,
                  [(NOW - dm["ls"][k]["first"]) / D for k in ("bn_all", "bn_taker", "by_all")])
            check("…nothing older than 30 days was asked of Binance's ratio lists", STATS["bn_old"] == 0, STATS["bn_old"])
            check("no JS errors (long/short)", not errors, errors[:3])
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/long-short/?coin=PEPE&range=24h")
            wait_dv(page)
            dp = page.evaluate(LSNAP)
            t, b, sl = dp["ls"]["bn_taker"]["mid"]
            eb, es = taker("1000PEPEUSDT", t, 5 * MIN)
            check("PEPE: taker volumes of the 1000-coin contract are shown in coins", dp["coin"] == "PEPE" and dp["iv"] == "5m" and near(b, eb * 1000, 1e-6) and near(sl, es * 1000, 1e-6), (b, eb * 1000))
            check("no JS errors (long/short, PEPE)", not errors, errors[:3])
            ctx.close()

        # ------------------------------------------------------------ the hub
        if not ONLY or ONLY == "hub":
            print("hub")
            ctx, page, errors = new_page(br, 1280, 900, "fa")
            page.goto(base + "/charts/")
            page.wait_for_selector(".ob-hub")
            check("hub: Persian section visible, the others hidden", page.locator("section[data-lang=fa]").is_visible() and not page.locator("section[data-lang=en]").is_visible())
            links = page.evaluate("() => [...document.querySelectorAll('section[data-lang=fa] a.ob-hc')].map(a => a.getAttribute('href'))")
            check("hub: links to every chart of the section", all(x in links for x in ("/charts/liquidation-heatmap/", "/charts/liquidation-map/", "/charts/open-interest/", "/charts/funding-rate/", "/charts/long-short/")), links)
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
                    for view, path in (("heat", "/charts/liquidation-heatmap/"), ("map", "/charts/liquidation-map/"), ("oi", "/charts/open-interest/"), ("funding", "/charts/funding-rate/"), ("ls", "/charts/long-short/")):
                        ctx, page, errors = new_page(br, w, h, lang, mobile=mob)
                        page.goto(base + path)
                        (wait_res if view in ("heat", "map") else wait_dv)(page)
                        tag = f"{view} {lang} {w}"
                        want = {"ckb": ("ckb", "rtl"), "fa": ("fa", "rtl"), "ar": ("en", "rtl"), "en": ("en", "ltr")}[lang]
                        got = page.evaluate("() => [document.documentElement.lang, document.getElementById('ob').getAttribute('dir')]")
                        check(f"{tag}: language and direction", tuple(got) == want, got)
                        check(f"{tag}: no sideways scroll", overflow(page) <= 0, overflow(page))
                        txt = page.locator("#ob").inner_text()
                        raw = re.findall(r"\b(?:tab|r|err|cl|d|m[123]|note|map|lg|total|th|fr|ls|tbl|aria|oi|mark|taker|part|ex|u|p|t|s)_[a-z0-9_]+\b", txt)
                        check(f"{tag}: no missing string keys on screen", not raw, raw[:3])
                        vis = page.evaluate("() => [...document.querySelectorAll('#ob-main [data-lang]')].filter(e => !e.hidden).map(e => e.getAttribute('data-lang'))")
                        check(f"{tag}: only this language's text is shown", set(vis) == {lang}, set(vis))
                        if view == "heat":
                            check(f"{tag}: canvas painted", colours(page) > 25, colours(page))
                            inside = page.evaluate("() => { const s = document.getElementById('ob-stage').getBoundingClientRect(), c = document.querySelector('.ob-cv').getBoundingClientRect(); return c.width <= s.width + 1 && c.height <= s.height + 1 && c.width > 250; }")
                            check(f"{tag}: the canvas fits its stage", inside)
                        elif view == "map":
                            check(f"{tag}: bars drawn", page.locator("#ob-map svg rect").count() > 30)
                        else:
                            check(f"{tag}: chart painted", colours(page, "#ob-ts .ob-cv") > 12, colours(page, "#ob-ts .ob-cv"))
                            inside = page.evaluate("() => { const s = document.querySelector('.ob-ts-w').getBoundingClientRect(), c = document.querySelector('#ob-ts .ob-cv').getBoundingClientRect(); return c.width <= s.width + 1 && c.height <= s.height + 1 && c.width > 250 && c.height > 300; }")
                            check(f"{tag}: the canvas fits its stage", inside)
                            want_tiles = {"oi": 3, "funding": 4, "ls": 4}[view]
                            check(f"{tag}: tiles filled", page.locator("#ob-tiles .ob-tile").count() == want_tiles and "—" not in page.locator("#ob-tiles").inner_text(), page.locator("#ob-tiles").inner_text()[:120])
                            if view != "ls":
                                check(f"{tag}: table filled", page.locator("#ob-table tbody tr").count() >= 5)
                            tabs = page.evaluate("() => { const n = document.querySelector('.ob-tabs'), a = n.querySelector('.ob-tab.on').getBoundingClientRect(), b = n.getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1; }")
                            check(f"{tag}: the active tab is in view", tabs)
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
            everything = ("binance", "bybit", "okx", "bitget", "hyperliquid", "gate")
            for view, path in (("oi", "/charts/open-interest/"), ("funding", "/charts/funding-rate/"), ("ls", "/charts/long-short/")):
                ctx, page, errors = new_page(br, 1280, 900, "fa", block=everything)
                page.goto(base + path)
                page.wait_for_selector("#ob-retry", timeout=30000)
                box = page.locator(".ob-status.err").bounding_box()
                check(f"{view}: nothing reachable → a plain message with a retry button, in a box with room for it", page.locator(".ob-status.err").is_visible() and box["height"] > 200, box)
                if view == "oi":
                    page.screenshot(path=os.path.join(SHOTS, "oi_fa_error.png"))
                for host, fn in (("https://fapi.binance.com/**", binance), ("https://api.bybit.com/**", bybit), ("https://www.okx.com/**", okx), ("https://api.bitget.com/**", bitget), ("https://api.hyperliquid.xyz/**", hyperliquid), ("https://api.gateio.ws/**", gate)):
                    page.unroute(host)
                    page.route(host, fn)
                page.locator("#ob-retry").click()
                wait_dv(page)
                check(f"{view}: retry loads once the exchanges answer", not page.locator(".ob-status.err").is_visible() and colours(page, "#ob-ts .ob-cv") > 12)
                ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "en", block=("binance",))
            page.goto(base + "/charts/open-interest/")
            wait_dv(page)
            e2 = page.evaluate("() => { const V = OB._dv.V; return { rows: [...document.querySelectorAll('#ob-table tbody tr')].map(tr => tr.children[0].textContent.trim()), missing: (document.getElementById('ob-miss') || {}).textContent || '', lines: V.ts.P[1].series.map(s => s.name), candles: V.data.candles.ex, chg: V.data.chg && V.data.chg.ex }; }")
            check("Binance unreachable: open interest is built from the five others and says so", "Binance" not in e2["rows"] and len(e2["rows"]) == 5 and "Binance" in e2["missing"] and e2["lines"] == ["Bybit"] and e2["candles"] == "bybit" and e2["chg"] == ["bybit"], e2)
            check("…without JS errors (open interest, Binance down)", not errors, errors[:3])
            ctx.close()
        br.close()
    srv.shutdown()
    print(f"\nobservatory e2e: {len(OK)} passed, {len(FAIL)} failed; screenshots in {SHOTS}")
    for f in FAIL:
        print("  FAILED:", f)
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(run())
