#!/usr/bin/env python3
"""Pretend data sources in the real formats of DefiLlama, Coinbase and Binance, for the Observatory's CI data steps
(scripts/obs_stables.py, scripts/obs_premium.py). Used by tests/test_obs_flowdata.py (the steps themselves) and by
tests/obs4_e2e.py (the pages, fed with files those steps wrote from these sources).

DefiLlama   /stablecoincharts/all  rows {"date": "<seconds, a STRING>", "totalCirculating": {peg: n}, "totalCirculatingUSD": {peg: n}}
            /stablecoins           {"peggedAssets": [{id, name, symbol, gecko_id, pegType, circulating: {peggedUSD}, circulatingPrevDay…}]}
Coinbase    /products/<P>/candles  [[time (s), low, high, open, close, volume], …] newest first, 300 at most; a range of more than 300 is refused
Binance     /api/v3/klines         [[openTime (ms), "o", "h", "l", "c", "v", closeTime, "q", n, "tb", "tq", "0"], …] oldest first from startTime
"""
import os
import sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import obs_chain as C  # noqa: E402
import obs_premium as P  # noqa: E402

UTC = timezone.utc
D0 = datetime(2023, 1, 1, tzinfo=UTC)                         # the pretend stablecoin history begins with the row stamped 2023-01-01


def ts(d):
    return int(d.timestamp())


# ---------------------------------------------------------------- DefiLlama
TOT = lambda i: 100e9 + i * 1e8                  # noqa: E731   100 billion, + 100 million a day
USDT = lambda i: 60e9 + i * 5e7                  # noqa: E731
USDC = lambda i: 30e9 + i * 2e7                  # noqa: E731
LIST = {"peggedAssets": [
    {"id": "1", "name": "Tether", "symbol": "USDT", "gecko_id": "tether", "pegType": "peggedUSD", "circulating": {"peggedUSD": 175e9},
     "circulatingPrevDay": {"peggedUSD": 175.3e9}, "circulatingPrevWeek": {"peggedUSD": 176e9}, "circulatingPrevMonth": {"peggedUSD": 183e9}, "price": 0.999},
    {"id": "2", "name": "USD Coin", "symbol": "USDC", "gecko_id": "usd-coin", "pegType": "peggedUSD", "circulating": {"peggedUSD": 69e9},
     "circulatingPrevDay": {"peggedUSD": 69e9}, "circulatingPrevWeek": {"peggedUSD": 70e9}, "circulatingPrevMonth": {}, "price": 1},
    {"id": "9", "name": "Euro Coin", "symbol": "EURC", "gecko_id": "euro-coin", "pegType": "peggedEUR", "circulating": {"peggedEUR": 2e8}},
    {"id": "77", "name": "Imitation", "symbol": "USDT", "gecko_id": "not-tether", "pegType": "peggedUSD", "circulating": {"peggedUSD": 5e6}},
    {"id": "5", "name": "Dai", "symbol": "DAI", "gecko_id": "dai", "pegType": "peggedUSD", "circulating": {"peggedUSD": 4.6e9}, "circulatingPrevDay": {"peggedUSD": 0}},
    {"id": "8", "name": "Gone", "symbol": "GONE", "gecko_id": "gone", "pegType": "peggedUSD", "circulating": {"peggedUSD": 0}},
], "chains": []}


def n_rows(now):
    """rows stamped 2023-01-01 … the midnight that began `now`'s day"""
    return (now.replace(hour=0, minute=0, second=0, microsecond=0) - D0).days + 1


def llama_rows(f, now, extra=()):
    """rows as /stablecoincharts/all gives them: the date is a STRING of seconds, the figure sits under peggedUSD"""
    rows = [{"date": str(ts(D0 + timedelta(days=i))), "totalCirculating": {"peggedUSD": f(i) * 1.001, "peggedEUR": 5.0},
             "totalCirculatingUSD": {"peggedUSD": f(i), "peggedEUR": 7.0}} for i in range(n_rows(now))]
    return rows + list(extra)


def chain_doc(last_day, stamp):
    """Bitcoin's file as obs_chain writes it: price 50,000 and supply 20 million on every day → a market value of 1e12"""
    d0 = datetime(2022, 12, 1, tzinfo=UTC)
    n = (datetime.strptime(last_day, "%Y-%m-%d").replace(tzinfo=UTC) - d0).days + 1
    return C.pack("btc", "2022-12-01", n, {"price": [50000.0] * n, "sply": [20e6] * n}, stamp)


def llama_get(now, total=None, coins=True, lst=LIST, calls=None):
    def get(url, params):
        if calls is not None:
            calls.append((url, dict(params or {})))
        if url.endswith("/stablecoincharts/all"):
            cid = (params or {}).get("stablecoin")
            if cid is None:
                return total if total is not None else llama_rows(TOT, now)
            if not coins:
                return None
            return llama_rows(USDT, now) if cid == "1" else llama_rows(USDC, now) if cid == "2" else None
        if url.endswith("/stablecoins"):
            return lst
        return None
    return get


# ---------------------------------------------------------------- Coinbase and Binance
START = {"BTC-USD": 0, "ETH-USD": 0, "USDT-USD": int(datetime(2021, 5, 4, tzinfo=UTC).timestamp()), "BTCUSDT": P.DAY0, "ETHUSDT": P.DAY0}


class Exchanges:
    """Closes that make the premium easy to work out (h_end = the opening time of the last closed hour):
         Binance BTC 50,000 always · Coinbase BTC 50,050 in the last closed hour (+0.1 %), 50,000 in every hour before it;
           its daily close is 50,025 (+0.05 %) on even days and 50,000 on odd ones
         Binance ETH 2,000 · Coinbase ETH 1,998 (−0.1 %) always
         Tether on Coinbase 1.001 in the last closed hour, 1 before it (and on every day)"""

    def __init__(self, now, fail_window=None, broken=None, spike=None):
        self.now, self.calls, self.fail_window, self.broken = now, [], fail_window, broken or {}
        self.h_end = now // 3600 * 3600 - 3600 if spike is None else spike      # the hour of the +0.1 % close (and of Tether at 1.001)

    def price(self, sym, t, step):
        if sym == "BTCUSDT":
            return 50000.0
        if sym == "ETHUSDT":
            return 2000.0
        if sym == "ETH-USD":
            return 1998.0
        if sym == "USDT-USD":
            return 1.001 if (step == 3600 and t == self.h_end) else 1.0
        if step == 3600:
            return 50050.0 if t == self.h_end else 50000.0
        return 50025.0 if (t // 86400) % 2 == 0 else 50000.0

    def __call__(self, url, params):
        self.calls.append((url, dict(params or {})))
        if "coinbase" in url:
            prod, step = url.split("/products/")[1].split("/")[0], int(params["granularity"])
            cur = self.now // step * step                       # the candle still running is in the answer too
            if "start" in params:
                a = int(datetime.strptime(params["start"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC).timestamp())
                b = int(datetime.strptime(params["end"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC).timestamp())
                if (b - a) // step + 1 > 300:
                    return None                                  # HTTP 400 at the real exchange
                if self.fail_window is not None and self.fail_window(prod, step, a, b):
                    return None
            else:
                b = cur
                a = b - 299 * step
            ts_ = [t for t in range(b // step * step, a - 1, -step) if START[prod] <= t <= cur]
            return [[t, 1, 2, 3, self.broken.get((prod, step, t), self.price(prod, t, step)), 9.5] for t in ts_]
        if "/api/v3/klines" in url:
            if url.startswith("https://api.binance.com"):
                return None                                      # the main host does not answer from the runner
            sym, step = params["symbol"], 3600 if params["interval"] == "1h" else 86400
            cur, t = self.now // step * step, max(START[sym], -(-int(params["startTime"]) // 1000 // step) * step)
            out = []
            while t <= cur and len(out) < int(params["limit"]):
                c = self.broken.get((sym, step, t), self.price(sym, t, step))
                out.append([t * 1000, "1.0", "2.0", "0.5", f"{c:.8f}", "10.0", (t + step) * 1000 - 1, "100.0", 5, "4.0", "40.0", "0"])
                t += step
            return out
        return None
