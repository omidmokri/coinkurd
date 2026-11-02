#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Crypto ↔ global markets: correlation of daily returns between BTC/ETH/SOL and S&P 500, Nasdaq, the US dollar,
gold (PAXG), oil and the US 10-year yield — over ~3 months and ~1 year — plus a rolling 30-day BTC↔S&P 500 series.

Sources (free, no key): FRED public CSV (fredgraph.csv) and Binance daily candles.
Optional free-market USDT→toman rate from Nobitex's public API (kept only if it answers).
Writes data/macro.json. Runs at most every 6 hours (MACRO_FORCE=1 to bypass).
"""
import csv
import io
import json
import math
import os
import time
from datetime import datetime, timezone

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "macro.json")
UA = {"User-Agent": "Mozilla/5.0 (entekhab.net macro bot; +https://entekhab.net)"}
BN = "https://data-api.binance.vision/api/v3/klines"
FRED = {"SPX": "SP500", "NDX": "NASDAQCOM", "DXY": "DTWEXBGS", "OIL": "DCOILWTICO", "US10Y": "DGS10"}
CRYPTO = {"BTC": "BTCUSDT", "ETH": "ETHUSDT", "SOL": "SOLUSDT", "GOLD": "PAXGUSDT"}
ORDER = ["BTC", "ETH", "SOL", "SPX", "NDX", "DXY", "GOLD", "OIL", "US10Y"]
NAMES = {"BTC": {"fa": "بیت‌کوین", "en": "Bitcoin"}, "ETH": {"fa": "اتریوم", "en": "Ethereum"}, "SOL": {"fa": "سولانا", "en": "Solana"},
         "SPX": {"fa": "S&P 500", "en": "S&P 500"}, "NDX": {"fa": "نزدک", "en": "Nasdaq"}, "DXY": {"fa": "شاخص دلار", "en": "US dollar"},
         "GOLD": {"fa": "طلا (PAXG)", "en": "Gold (PAXG)"}, "OIL": {"fa": "نفت WTI", "en": "WTI oil"}, "US10Y": {"fa": "بازده اوراق ۱۰ ساله", "en": "US 10y yield"}}


def fred(series):
    r = requests.get("https://fred.stlouisfed.org/graph/fredgraph.csv", params={"id": series}, headers=UA, timeout=30)
    r.raise_for_status()
    out = {}
    for row in csv.reader(io.StringIO(r.text)):
        if len(row) < 2 or not row[0][:4].isdigit():
            continue
        try:
            out[row[0][:10]] = float(row[1])
        except ValueError:                       # FRED marks holidays with "."
            continue
    if len(out) < 100:
        raise ValueError(f"only {len(out)} rows")
    return out


def binance(sym):
    r = requests.get(BN, params={"symbol": sym, "interval": "1d", "limit": 420}, headers=UA, timeout=25)
    r.raise_for_status()
    return {datetime.fromtimestamp(k[0] / 1000, timezone.utc).strftime("%Y-%m-%d"): float(k[4]) for k in r.json()}


def corr(a, b):
    n = len(a)
    if n < 15:
        return None
    ma, mb = sum(a) / n, sum(b) / n
    c = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    da = math.sqrt(sum((x - ma) ** 2 for x in a))
    db = math.sqrt(sum((y - mb) ** 2 for y in b))
    return round(c / (da * db), 3) if da and db else None


def main():
    old = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
    if old.get("updated_at") and os.environ.get("MACRO_FORCE") != "1":
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(old["updated_at"])).total_seconds() / 3600
        if age < 6:
            print(f"macro: fresh ({age:.1f}h), skip")
            return
    series, src = {}, {}
    for k, sid in FRED.items():
        try:
            series[k] = fred(sid)
            src[k] = {"ok": True, "source": f"FRED {sid}", "last": max(series[k])}
        except Exception as e:  # noqa: BLE001
            src[k] = {"ok": False, "source": f"FRED {sid}", "err": str(e)[:100]}
        time.sleep(0.4)
    for k, sym in CRYPTO.items():
        try:
            series[k] = binance(sym)
            src[k] = {"ok": True, "source": f"Binance {sym}", "last": max(series[k])}
        except Exception as e:  # noqa: BLE001
            src[k] = {"ok": False, "source": f"Binance {sym}", "err": str(e)[:100]}
    assets = [a for a in ORDER if a in series]
    if "BTC" not in series or len(assets) < 3:
        print("macro: not enough data", src)
        if old:
            old["sources"] = src
            json.dump(old, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        return
    # common dates = US trading days that every series has; returns between consecutive common dates
    dates = sorted(set.intersection(*[set(series[a]) for a in assets]))
    rets = {a: [] for a in assets}
    for d0, d1 in zip(dates, dates[1:]):
        for a in assets:
            p0, p1 = series[a][d0], series[a][d1]
            # yields can be ≤0 in theory; use differences for US10Y, log returns for prices
            rets[a].append(p1 - p0 if a == "US10Y" else math.log(p1 / p0))
    rdates = dates[1:]
    windows = {}
    for name, n in (("3m", 63), ("1y", 250)):
        m = {a: {b: corr(rets[a][-n:], rets[b][-n:]) for b in assets} for a in assets}
        windows[name] = {"n": min(n, len(rdates)), "from": rdates[-min(n, len(rdates))] if rdates else None, "matrix": m}
    rolling = []
    if "SPX" in assets:
        for i in range(30, len(rdates) + 1, 5):
            c = corr(rets["BTC"][i - 30:i], rets["SPX"][i - 30:i])
            if c is not None:
                rolling.append([rdates[i - 1], c])
    last = {a: {"date": max(series[a]), "value": series[a][max(series[a])]} for a in assets}
    chg = {}
    for a in assets:
        ds = sorted(series[a])
        if len(ds) > 22:
            chg[a] = round((series[a][ds[-1]] / series[a][ds[-22]] - 1) * 100, 2) if a != "US10Y" else round(series[a][ds[-1]] - series[a][ds[-22]], 2)
    out = {"updated_at": datetime.now(timezone.utc).isoformat(), "assets": assets, "names": NAMES, "windows": windows, "rolling_btc_spx_30d": rolling[-80:],
           "last": last, "chg_1m": chg, "sources": src,
           "method": "Pearson correlation of daily log returns on common US trading days (US10Y: daily change in yield). Gold = PAXG on Binance."}
    # optional: free-market USDT→IRT (toman) from Nobitex public stats; ignored if unreachable
    try:
        r = requests.get("https://api.nobitex.ir/market/stats", params={"srcCurrency": "usdt", "dstCurrency": "rls"}, headers=UA, timeout=15)
        st = r.json().get("stats", {}).get("usdt-rls", {})
        v = float(st.get("latest") or 0) / 10
        if v > 1000:
            out["usdt_irt"] = {"value": round(v), "source": "Nobitex", "at": out["updated_at"]}
    except Exception as e:  # noqa: BLE001
        out["usdt_irt_err"] = str(e)[:100]
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    m3 = windows["3m"]["matrix"]["BTC"]
    print(f"macro: {len(assets)} assets, {len(rdates)} common days; BTC~SPX 3m {m3.get('SPX')} · BTC~DXY {m3.get('DXY')} · toman {out.get('usdt_irt', {}).get('value')}")


if __name__ == "__main__":
    main()
