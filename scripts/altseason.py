#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Altcoin Season Index → data/altseason.json

The common definition (blockchaincenter.net): of the top 50 coins by market cap — stablecoins, wrapped, staked
and gold tokens left out — what share did better than Bitcoin over the last 90 days?
  ≥ 75  altcoin season   ·   ≤ 25  Bitcoin season   ·   in between  neither

  * market caps: CoinGecko /coins/markets (top 150, so 50 remain after the exclusions)
  * prices: Binance spot daily closes (data-api.binance.vision), closed bars only; a coin without a USDT pair
    or without 91 closed days is skipped and the next one by market cap takes its place
  * history: the same index for each of the last 90 days, computed with TODAY's top 50 (said on the page:
    coins that dropped out of the top 50 are not in the past values)

Run: python3 scripts/altseason.py
"""
import json
import os
import time
from datetime import datetime, timezone

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "altseason.json")
UA = {"User-Agent": "entekhab.net altseason (+https://entekhab.net)"}
WINDOW, TOP, HIST = 90, 50, 90
# not "altcoins" in the index's sense: dollar/euro coins, wrapped or staked copies of other coins, gold tokens
EXCLUDE = {
    "BTC", "USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDP", "BUSD", "USDE", "USDS", "SUSDS", "SUSDE", "PYUSD", "USD1", "USDTB",
    "RLUSD", "BFUSD", "USDD", "GUSD", "FRAX", "LUSD", "EURC", "EURI", "AEUR", "USDX", "USDF", "USDG", "USDO", "BUIDL", "USYC",
    "OUSG", "USTB", "BSC-USD", "SYRUPUSDC", "SYRUPUSDT", "USDAI", "USR", "DEUSD", "CRVUSD", "GHO", "PAXG", "XAUT", "KAU",
    "WBTC", "CBBTC", "TBTC", "LBTC", "SOLVBTC", "BTCB", "WETH", "STETH", "WSTETH", "WEETH", "EETH", "RETH", "METH", "CBETH",
    "WBETH", "RSETH", "EZETH", "OSETH", "SWETH", "ETHX", "BNSOL", "JITOSOL", "MSOL", "JUPSOL", "BBSOL", "STSOL", "WBNB",
    "SAVAX", "STHYPE", "KHYPE", "WHYPE", "CLBTC", "FBTC", "PUMPBTC", "SOLVBTC.BBN", "BTC.B", "WTRX", "STX.B",
}


def get(url, params=None, tries=3):
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=25)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 400:            # Binance: no such symbol — not worth retrying
                return None
            print("  http", r.status_code, url.split("?")[0][-40:], (params or {}).get("symbol", ""))
        except Exception as e:  # noqa: BLE001
            print("  err", str(e)[:90])
        time.sleep(2 + 3 * i)
    return None


def ranked_symbols():
    """CoinGecko market-cap order, upper-case symbols, exclusions removed, duplicates dropped"""
    rows = get("https://api.coingecko.com/api/v3/coins/markets",
               {"vs_currency": "usd", "order": "market_cap_desc", "per_page": 150, "page": 1}) or []
    out, seen = [], set()
    for r in rows:
        s = (r.get("symbol") or "").upper()
        if not s or s in EXCLUDE or s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def daily_closes(sym, today_ms):
    """{day_ms: close} for closed daily bars, newest WINDOW + HIST + 2 days"""
    k = get("https://data-api.binance.vision/api/v3/klines",
            {"symbol": f"{sym}USDT", "interval": "1d", "limit": WINDOW + HIST + 2})
    if not k:
        return None
    return {int(b[0]): float(b[4]) for b in k if int(b[0]) < today_ms}


def index_on(day, btc, coins):
    """share (0-100) of coins whose 90-day return beat BTC's, at `day` (ms); None if BTC lacks the window"""
    past = day - WINDOW * 86400000
    if day not in btc or past not in btc:
        return None, []
    rb = btc[day] / btc[past] - 1
    rows = []
    for c, px in coins.items():
        if day in px and past in px and px[past] > 0:
            r = px[day] / px[past] - 1
            rows.append((c, r, r > rb))
    if not rows:
        return None, []
    return round(100 * sum(1 for x in rows if x[2]) / len(rows)), rows


def label(v):
    return "alt" if v >= 75 else "btc" if v <= 25 else "neutral"


def compute(btc, coins, today_ms):
    """pure part: btc = {day: close}, coins = {sym: {day: close}} (already the chosen 50) -> result dict"""
    last = max(d for d in btc if d < today_ms)
    v, rows = index_on(last, btc, coins)
    if v is None:
        return None
    hist = []
    for i in range(HIST - 1, -1, -1):
        d = last - i * 86400000
        hv, _ = index_on(d, btc, coins)
        if hv is not None:
            hist.append([datetime.fromtimestamp(d / 1000, timezone.utc).strftime("%Y-%m-%d"), hv])
    rb = btc[last] / btc[last - WINDOW * 86400000] - 1
    return {
        "date": datetime.fromtimestamp(last / 1000, timezone.utc).strftime("%Y-%m-%d"),
        "value": v, "label": label(v), "n": len(rows), "window_days": WINDOW, "btc_r90": round(100 * rb, 2),
        "beat": sum(1 for x in rows if x[2]),
        "coins": [{"coin": c, "r90": round(100 * r, 2), "beat": b} for c, r, b in sorted(rows, key=lambda x: -x[1])],
        "history": hist,
    }


def main():
    now = datetime.now(timezone.utc)
    try:                                  # daily closes only change once a day: refresh at most every 6 hours
        old = json.load(open(OUT, encoding="utf-8"))
        if os.environ.get("FORCE") != "1" and (now - datetime.fromisoformat(old["updated_at"])).total_seconds() < 6 * 3600:
            print("altseason: fresh (<6 h), skipped")
            return
    except Exception:  # noqa: BLE001
        pass
    today_ms = int(datetime(now.year, now.month, now.day, tzinfo=timezone.utc).timestamp() * 1000)
    btc = daily_closes("BTC", today_ms)
    if not btc or len(btc) < WINDOW + 2:
        print("altseason: no BTC history; keeping the previous file")
        return
    coins, skipped = {}, []
    for s in ranked_symbols():
        if len(coins) >= TOP:
            break
        px = daily_closes(s, today_ms)
        if not px or len(px) < WINDOW + 1:
            skipped.append(s)
            continue
        coins[s] = px
        time.sleep(0.15)
    if len(coins) < 30:
        print(f"altseason: only {len(coins)} coins with history; keeping the previous file")
        return
    res = compute(btc, coins, today_ms)
    if not res:
        print("altseason: could not compute; keeping the previous file")
        return
    res = {"updated_at": now.isoformat(), "source": "CoinGecko market caps · Binance daily closes", **res,
           "skipped": skipped[:40]}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, separators=(",", ":"))
    print(f"altseason: {res['value']} ({res['label']}) · {res['beat']}/{res['n']} beat BTC over {WINDOW}d "
          f"(BTC {res['btc_r90']:+.1f}%) · history {len(res['history'])} days · skipped {len(skipped)}")


if __name__ == "__main__":
    main()
