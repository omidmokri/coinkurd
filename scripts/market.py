#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
داشبورد بازار + اسکنر فرصت‌ها (فقط با API رایگان، بدون کلید)

منابع:
  Binance public market data  https://data-api.binance.vision  (بدون محدودیت جغرافیایی گیت‌هاب)
  Fear & Greed               https://api.alternative.me/fng/
  CoinGecko global           https://api.coingecko.com/api/v3/global

خروجی: data/market.json  و  data/opps_log.json (تاریخچهٔ فرصت‌های کشف‌شده)
"""
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "market.json")
LOG = os.path.join(ROOT, "data", "opps_log.json")

BINANCE = ["https://data-api.binance.vision", "https://api.binance.com", "https://api1.binance.com"]
CORE = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "TON", "ADA", "AVAX", "LINK", "DOT", "TRX",
         "LTC", "NEAR", "SUI", "APT", "ARB", "OP", "PEPE", "SHIB", "UNI", "ATOM"]
STABLE = {"USDC", "FDUSD", "TUSD", "USDP", "DAI", "BUSD", "USDE", "EURI", "EUR", "AEUR", "PAXG", "XUSD", "USD1", "BFUSD", "RLUSD", "WBTC", "WBETH", "BNSOL"}
TOP_N = int(__import__("os").environ.get("SCAN_TOP", "150"))
UA = {"User-Agent": "entekhab.net market bot (+https://entekhab.net)"}


def get(url, params=None, tries=3):
    """درخواست با تلاش مجدد و بک‌آف (خودترمیمی در برابر خطای موقت)"""
    last = None
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=20)
            if r.status_code == 429:
                time.sleep(5 * (i + 1))
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"{url}: {last}")


def binance(path, params):
    last = None
    for base in BINANCE:
        try:
            return get(base + path, params)
        except Exception as e:  # noqa: BLE001
            last = e
    raise RuntimeError(last)


def universe():
    """کوین‌های اسکن: CORE + پرحجم‌ترین جفت‌های USDT بایننس (بدون استیبل‌کوین و توکن اهرمی)"""
    try:
        t = binance("/api/v3/ticker/24hr", {"type": "MINI"})
    except Exception as e:  # noqa: BLE001
        print(f"universe fallback: {e}")
        return list(CORE), {}
    rows = []
    for x in t:
        sym = x["symbol"]
        if not sym.endswith("USDT"):
            continue
        base = sym[:-4]
        if (base in STABLE or base.endswith(("UP", "DOWN", "BULL", "BEAR")) or float(x.get("quoteVolume", 0)) <= 0
                or not __import__("re").fullmatch(r"[A-Z0-9]{2,12}", base)):
            continue
        rows.append((base, float(x["quoteVolume"])))
    rows.sort(key=lambda r: -r[1])
    vol = dict(rows)
    out = list(CORE) + [b for b, _ in rows if b not in CORE]
    return out[:max(TOP_N, len(CORE))], vol


def klines(sym, interval="1h", limit=200, start=None):
    p = {"symbol": f"{sym}USDT", "interval": interval, "limit": limit}
    if start:
        p["startTime"] = int(start)
    rows = binance("/api/v3/klines", p)
    return [{"t": r[0], "o": float(r[1]), "h": float(r[2]), "l": float(r[3]), "c": float(r[4]),
             "v": float(r[7])} for r in rows]


# ---------------------------------------------------------------- indicators

def ema(vals, n):
    k, out, e = 2 / (n + 1), [], None
    for v in vals:
        e = v if e is None else v * k + e * (1 - k)
        out.append(e)
    return out


def rsi(closes, n=14):
    if len(closes) <= n:
        return None
    gains = [max(closes[i] - closes[i - 1], 0) for i in range(1, len(closes))]
    losses = [max(closes[i - 1] - closes[i], 0) for i in range(1, len(closes))]
    ag, al = sum(gains[:n]) / n, sum(losses[:n]) / n
    for g, l in zip(gains[n:], losses[n:]):
        ag, al = (ag * (n - 1) + g) / n, (al * (n - 1) + l) / n
    return 100.0 if al == 0 else 100 - 100 / (1 + ag / al)


def analyse(sym, k):
    c = [x["c"] for x in k]
    last = k[-1]
    e20, e50 = ema(c, 20), ema(c, 50)
    r = rsi(c)
    prev48 = k[-49:-1]
    hi48, lo48 = max(x["h"] for x in prev48), min(x["l"] for x in prev48)
    vavg = sum(x["v"] for x in k[-21:-1]) / 20
    chg24 = (c[-1] / c[-25] - 1) * 100 if len(c) > 25 else None
    trend = "up" if e20[-1] > e50[-1] and c[-1] > e20[-1] else "down" if e20[-1] < e50[-1] and c[-1] < e20[-1] else "range"
    opps = []
    t = last["t"]

    def add(kind, strength, detail):
        opps.append({"coin": sym, "type": kind, "tf": "1h", "bar": t, "strength": strength,
                     "price": c[-1], "detail": detail})

    if r is not None and r <= 30:
        add("rsi_oversold", round((30 - r) / 30 * 100), {"rsi": round(r, 1)})
    if r is not None and r >= 70:
        add("rsi_overbought", round((r - 70) / 30 * 100), {"rsi": round(r, 1)})
    for i in (-1, -2, -3):
        if e20[i - 1] <= e50[i - 1] and e20[i] > e50[i]:
            add("ema_golden_cross", 60, {"ema20": round(e20[-1], 6), "ema50": round(e50[-1], 6)})
            break
        if e20[i - 1] >= e50[i - 1] and e20[i] < e50[i]:
            add("ema_death_cross", 60, {"ema20": round(e20[-1], 6), "ema50": round(e50[-1], 6)})
            break
    if last["c"] > hi48:
        add("breakout_up", min(100, round((last["c"] / hi48 - 1) * 2000)), {"level": hi48})
    if last["c"] < lo48:
        add("breakdown", min(100, round((1 - last["c"] / lo48) * 2000)), {"level": lo48})
    if vavg and last["v"] > 2.5 * vavg:
        add("volume_spike", min(100, round(last["v"] / vavg * 20)), {"x": round(last["v"] / vavg, 1)})
    # واگرایی RSI: دو کف/سقف محلی آخر در ۴۰ کندل
    rs = [rsi(c[:i + 1]) for i in range(len(c) - 40, len(c))]
    lows, highs = [x["l"] for x in k[-40:]], [x["h"] for x in k[-40:]]
    def piv(arr, cmp):
        return [i for i in range(2, len(arr) - 2) if arr[i] != arr[i - 1] and all(cmp(arr[i], arr[j]) for j in (i - 2, i - 1, i + 1, i + 2))]
    pl, ph = piv(lows, lambda a, b: a <= b), piv(highs, lambda a, b: a >= b)
    if len(pl) >= 2 and None not in (rs[pl[-1]], rs[pl[-2]]):
        a, b = pl[-2], pl[-1]
        if len(lows) - b <= 6 and lows[b] < lows[a] and rs[b] > rs[a] + 2:
            add("bull_divergence", min(100, round((rs[b] - rs[a]) * 5)), {"rsi": round(rs[b], 1)})
    if len(ph) >= 2 and None not in (rs[ph[-1]], rs[ph[-2]]):
        a, b = ph[-2], ph[-1]
        if len(highs) - b <= 6 and highs[b] > highs[a] and rs[b] < rs[a] - 2:
            add("bear_divergence", min(100, round((rs[a] - rs[b]) * 5)), {"rsi": round(rs[b], 1)})
    # «تأیید» = دو سیگنال هم‌جهت → اطمینان بیشتر
    bull = {"rsi_oversold", "ema_golden_cross", "breakout_up", "bull_divergence"}
    bear = {"rsi_overbought", "ema_death_cross", "breakdown", "bear_divergence"}
    kinds = {o["type"] for o in opps}
    for o in opps:
        same = bull if o["type"] in bull else bear if o["type"] in bear else set()
        o["confidence"] = "high" if len(kinds & same) >= 2 or ("volume_spike" in kinds and o["type"] != "volume_spike") else "medium"
    return {
        "coin": sym, "price": c[-1], "chg24": None if chg24 is None else round(chg24, 2),
        "vol24": round(sum(x["v"] for x in k[-24:])), "rsi": None if r is None else round(r, 1),
        "ema20": e20[-1], "ema50": e50[-1], "trend": trend, "hi48": hi48, "lo48": lo48,
        "spark": [round(x, 8) for x in c[-48:]], "bar": t,
    }, opps


def main():
    now = datetime.now(timezone.utc)
    out = {"updated_at": now.isoformat(), "sources": {}, "coins": [], "opportunities": [], "errors": []}
    syms, qvol = universe()
    for sym in syms:
        try:
            a, o = analyse(sym, klines(sym, limit=150))
            a["qvol"] = round(qvol.get(sym, 0))
            out["coins"].append(a)
            out["opportunities"].extend(o)
        except Exception as e:  # noqa: BLE001
            out["errors"].append(f"{sym}: {e}")
        time.sleep(0.08)
    out["sources"]["binance"] = now.isoformat() if out["coins"] else None
    try:
        f = get("https://api.alternative.me/fng/", {"limit": 30})["data"]
        out["fng"] = {"value": int(f[0]["value"]), "class": f[0]["value_classification"],
                      "history": [[int(x["timestamp"]), int(x["value"])] for x in f][::-1]}
        out["sources"]["fng"] = now.isoformat()
    except Exception as e:  # noqa: BLE001
        out["errors"].append(f"fng: {e}")
    try:
        g = get("https://api.coingecko.com/api/v3/global")["data"]
        out["global"] = {"mcap": g["total_market_cap"]["usd"], "vol": g["total_volume"]["usd"],
                         "btc_d": round(g["market_cap_percentage"]["btc"], 2),
                         "eth_d": round(g["market_cap_percentage"]["eth"], 2),
                         "mcap_chg24": round(g.get("market_cap_change_percentage_24h_usd", 0), 2)}
        out["sources"]["coingecko"] = now.isoformat()
    except Exception as e:  # noqa: BLE001
        out["errors"].append(f"coingecko: {e}")

    # اگر همه‌چیز شکست خورد، دادهٔ قبلی را خراب نکن (فقط خطا را ثبت کن)
    if not out["coins"] and os.path.exists(OUT):
        prev = json.load(open(OUT, encoding="utf-8"))
        prev["errors"] = out["errors"]
        prev["stale"] = True
        out = prev
    out["opportunities"].sort(key=lambda o: (o.get("confidence") != "high", -o["strength"]))
    out["scanned"] = len(out["coins"])
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    # تاریخچهٔ فرصت‌ها (بدون تکرار)
    log = json.load(open(LOG, encoding="utf-8")) if os.path.exists(LOG) else []
    seen = {(x["coin"], x["type"], x["bar"]) for x in log}
    for o in out.get("opportunities", []):
        if (o["coin"], o["type"], o["bar"]) not in seen:
            log.append({**o, "detected_at": now.isoformat()})
    log = log[-400:]
    json.dump(log, open(LOG, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"coins={len(out['coins'])} opps={len(out.get('opportunities', []))} errors={out['errors']}")
    if not out["coins"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
