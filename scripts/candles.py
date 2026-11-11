#!/usr/bin/env python3
"""Snapshot behind the v3 ("Nexus") chart and header ticker, for visitors whose network cannot reach an exchange.

  data/candles/<SYM>_<tf>.json   BTC and ETH on 15m / 1h / 4h / 1d / 1w, 150 candles each: {"t": iso, "s": {SYM: {tf: [[time, o, h, l, c, vol], …]}}}
  data/ticker.json               a few bytes: BTC and ETH price with 24h change, total market cap, Fear & Greed, block height

Prices come from Binance public market data (the same source as scripts/market.py); nothing is estimated.
The browser asks the exchange first and only falls back to these files, which it labels as delayed."""
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import market as M  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "candles")
SYMS = {"BTC": 1, "ETH": 2}          # symbol -> decimals kept
TFS = ["15m", "1h", "4h", "1d", "1w"]


def jload(name):
    try:
        return json.load(open(os.path.join(ROOT, "data", name), encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}


def main():
    os.makedirs(OUT, exist_ok=True)
    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
    ok = 0
    for sym, dec in SYMS.items():
        for tf in TFS:
            try:
                rows = M.binance("/api/v3/klines", {"symbol": f"{sym}USDT", "interval": tf, "limit": 150})
                data = [[int(r[0]) // 1000, round(float(r[1]), dec), round(float(r[2]), dec), round(float(r[3]), dec), round(float(r[4]), dec),
                         round(float(r[5]), 2)] for r in rows]
                if len(data) < 20:
                    raise RuntimeError("too few candles")
                json.dump({"t": now, "s": {sym: {tf: data}}}, open(os.path.join(OUT, f"{sym}_{tf}.json"), "w", encoding="utf-8"), separators=(",", ":"))
                ok += 1
            except Exception as e:  # noqa: BLE001
                print(f"candles: {sym} {tf}: {e}")          # the previous file stays; its own time says how old it is
    mk, ch = jload("market.json"), jload("chain.json")
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
    print(f"candles: {ok}/{len(SYMS) * len(TFS)} files, ticker: {'ok' if tick['c'] else 'skipped'}")


if __name__ == "__main__":
    main()
