#!/usr/bin/env python3
"""Snapshot behind the v3 ("Nexus") chart and header ticker, for visitors whose network cannot reach an exchange.

  data/candles/<SYM>_<tf>.json   the top coins on 15m / 1h / 4h / 1d / 1w, 150 candles each: {"t": iso, "s": {SYM: {tf: [[time, o, h, l, c, vol], …]}}}
                                 BTC and ETH are committed, so a run that cannot reach Binance still leaves the
                                 header ticker and the two main charts working; the rest ship with the site only.
  data/ticker.json               a few bytes: BTC and ETH price with 24h change, total market cap, Fear & Greed, block height

Prices come from Binance public market data (the same source as scripts/market.py); nothing is estimated.
The browser asks the exchange first and only falls back to these files, which it labels as delayed."""
import datetime
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import market as M  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "candles")
CORE = {"BTC": 1, "ETH": 2}          # symbol -> decimals kept; always first, and committed
TFS = ["15m", "1h", "4h", "1d", "1w"]
TOP = 20                             # how many of the site's coins get a snapshot, in market.json order
STABLE = re.compile(r"USD|^(DAI|EUR|TUSD|FDUSD|PYUSD|XAUT|PAXG)$")


def decimals(price):
    """enough digits to show the price, no more: the file is read over a slow connection"""
    p = abs(price or 0)
    return 1 if p >= 1000 else 2 if p >= 100 else 4 if p >= 1 else 8


def symbols(mk):
    """BTC and ETH, then the most important coins the site already tracks (no stablecoins, nothing priced in nothing)"""
    out = dict(CORE)
    for c in mk.get("coins", []):
        if len(out) >= TOP:
            break
        s, px = c.get("coin"), c.get("price")
        if not s or s in out or not px or STABLE.search(s):
            continue
        out[s] = decimals(px)
    return out


def jload(name):
    try:
        return json.load(open(os.path.join(ROOT, "data", name), encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}


def main():
    os.makedirs(OUT, exist_ok=True)
    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
    mk, ch = jload("market.json"), jload("chain.json")
    syms = symbols(mk)
    ok = miss = 0                     # miss: failures in a row, to stop early instead of waiting out 100 timeouts
    for sym, dec in syms.items():
        for tf in TFS:
            if miss >= 5:             # Binance is plainly not reachable from this runner; keep the files we have
                break
            try:
                rows = M.binance("/api/v3/klines", {"symbol": f"{sym}USDT", "interval": tf, "limit": 150})
                data = [[int(r[0]) // 1000, round(float(r[1]), dec), round(float(r[2]), dec), round(float(r[3]), dec), round(float(r[4]), dec),
                         round(float(r[5]), 2)] for r in rows]
                if len(data) < 20:
                    raise RuntimeError("too few candles")
                json.dump({"t": now, "s": {sym: {tf: data}}}, open(os.path.join(OUT, f"{sym}_{tf}.json"), "w", encoding="utf-8"), separators=(",", ":"))
                ok += 1
                miss = 0
            except Exception as e:  # noqa: BLE001
                miss += 1
                print(f"candles: {sym} {tf}: {e}")          # the previous file stays; its own time says how old it is
    coins = {c.get("coin"): c for c in mk.get("coins", [])}
    tick = {"t": mk.get("updated_at") or now, "c": {}}
    for s in ("BTC", "ETH"):
        c = coins.get(s)
        if c and c.get("price"):
            tick["c"][s] = {"p": c["price"], "ch": c.get("chg24")}
    g = mk.get("global") or {}
    if g.get("mcap"):
        tick["g"] = {"mcap": round(g["mcap"]), "vol": round(g.get("vol") or 0), "btc_d": g.get("btc_d"), "mcap_chg24": g.get("mcap_chg24")}
    f = mk.get("fng") or {}
    if f.get("value") is not None:
        tick["fng"] = {"v": f["value"], "k": f.get("class")}
    b = (ch.get("blocks") or [{}])[0]
    if b.get("height"):
        tick["h"] = {"n": b["height"], "ts": b.get("timestamp")}
    if tick["c"]:
        json.dump(tick, open(os.path.join(ROOT, "data", "ticker.json"), "w", encoding="utf-8"), separators=(",", ":"))
    if miss >= 5:
        print(f"candles: stopped early after {miss} failures in a row (Binance unreachable); existing files kept")
    print(f"candles: {ok}/{len(syms) * len(TFS)} files, ticker: {'ok' if tick['c'] else 'skipped'}")


if __name__ == "__main__":
    main()
