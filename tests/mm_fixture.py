#!/usr/bin/env python3
"""Test fixtures for the market-map pages — written to a scratch folder, never to data/.

The prices, 24 h changes, volumes and 7-day lines of the coins come from the repo's own data/market.json (Binance);
market caps, supplies, sectors and the other windows are made up deterministically so the pages can be rendered and
tested offline. These numbers are NOT shown anywhere on the site.
Usage: python3 tests/mm_fixture.py /tmp/mmfx   ->  mm.json, mm_flow.json, etf.json, logos/atlas.webp|json
"""
import json
import math
import os
import random
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "scripts"))

SUPPLY = {"BTC": 20.11e6, "ETH": 120.7e6, "XRP": 60.0e9, "BNB": 139.3e6, "SOL": 560e6, "TRX": 94.7e9, "DOGE": 150.7e9, "ADA": 36.2e9,
          "HYPE": 335e6, "LINK": 680e6, "XLM": 31e9, "BCH": 19.9e6, "AVAX": 425e6, "SUI": 3.6e9, "LTC": 76e6, "DOT": 1.6e9, "TON": 2.5e9,
          "UNI": 630e6, "NEAR": 1.25e9, "APT": 650e6, "AAVE": 15.2e6, "ICP": 540e6, "ETC": 153e6, "ATOM": 470e6, "ARB": 5.5e9, "OP": 1.8e9}
SEC = {"BTC": "btc", "ETH": "l1", "XRP": "l1", "BNB": "l1", "SOL": "l1", "TRX": "l1", "ADA": "l1", "AVAX": "l1", "SUI": "l1", "LTC": "l1", "DOT": "l1",
       "NEAR": "ai", "APT": "l1", "ICP": "l1", "ETC": "l1", "ATOM": "l1", "XLM": "l1", "BCH": "l1", "HYPE": "defi", "UNI": "defi", "AAVE": "defi",
       "LINK": "infra", "ARB": "l2", "OP": "l2", "DOGE": "meme", "SHIB": "meme", "PEPE": "meme", "BONK": "meme", "WIF": "meme", "FLOKI": "meme",
       "TRUMP": "meme", "FET": "ai", "TAO": "ai", "RENDER": "ai", "WLD": "ai", "VIRTUAL": "ai", "ONDO": "rwa", "PLUME": "rwa", "XAUT": "rwa",
       "CAKE": "defi", "CRV": "defi", "LDO": "defi", "PENDLE": "defi", "ENA": "defi", "JTO": "defi", "RAY": "defi", "MORPHO": "defi",
       "ZEC": "privacy", "DASH": "privacy", "GALA": "game", "SAND": "game", "AXS": "game", "IMX": "game", "FIL": "infra", "HNT": "infra",
       "AR": "infra", "PYTH": "infra", "STX": "l2", "POL": "l2", "ZK": "l2", "STRK": "l2", "MNT": "l2", "SEI": "l1", "INJ": "defi", "TIA": "infra"}
TFS = ["5m", "15m", "1h", "2h", "4h", "1d", "7d", "30d", "1y"]
SCALE = {"5m": 0.25, "15m": 0.45, "1h": 0.8, "2h": 1.1, "4h": 1.6, "7d": 5, "30d": 12, "1y": 45}


def main(out):
    os.makedirs(out, exist_ok=True)
    rnd = random.Random(42)
    m = json.load(open(os.path.join(ROOT, "data", "market.json")))
    logos = set(json.load(open(os.path.join(ROOT, "data", "logos", "index.json"))))
    coins = []
    for x in m["coins"]:
        s = x["coin"]
        if s not in logos or not x.get("price"):
            continue
        p = x["price"]
        sup = SUPPLY.get(s) or math.exp(rnd.uniform(math.log(3e8), math.log(8e9))) / p
        mc = p * sup
        ch1d = x.get("chg24") or 0.0
        ch = []
        for tf in TFS:
            if tf == "1d":
                ch.append(round(ch1d, 2))
            else:
                ch.append(round(ch1d * {"5m": 0.03, "15m": 0.08, "1h": 0.2, "2h": 0.35, "4h": 0.55}.get(tf, 1.2) + rnd.gauss(0, SCALE[tf]), 2))
        sp = x.get("spark") or []
        lo, hi = (min(sp), max(sp)) if sp else (p, p)
        pts = [int(round((v - lo) / ((hi - lo) or 1) * 99)) for v in sp[::max(1, len(sp) // 42)]][:42] if sp else None
        coins.append({"s": s, "n": s.title() if s not in ("BTC", "ETH") else {"BTC": "Bitcoin", "ETH": "Ethereum"}[s], "id": s.lower(), "r": 0,
                      "sec": SEC.get(s, rnd.choice(["other", "defi", "l1", "ai", "meme", "infra", "game"])), "p": p, "mc": round(mc), "fd": round(mc * 1.08),
                      "v": round(x.get("vol24") or mc / 40), "cs": round(sup), "ts": round(sup * 1.05), "ms": round(sup * 1.2) if s != "ETH" else None,
                      "ath": round(p * rnd.uniform(1.2, 6), 6), "athd": "2025-10-06", "atl": round(p / rnd.uniform(5, 200), 8), "atld": "2022-06-18",
                      "bn": s + "USDT", "ch": ch, "sp": [round(lo, 6), round(hi, 6), pts] if pts else None, "ek": 1, "pg": 1, "dn": 1 if s in ("BTC", "ETH", "SOL") else None})
    for st, name, sup in (("USDT", "Tether", 175.6e9), ("USDC", "USD Coin", 69.5e9)):
        if st in logos:
            coins.append({"s": st, "n": name, "id": st.lower(), "r": 0, "sec": "stable", "p": 1.0, "mc": round(sup), "fd": round(sup), "v": round(sup / 4), "cs": round(sup),
                          "ts": round(sup), "ms": None, "ath": 1.3, "athd": "2018-07-24", "atl": 0.57, "atld": "2015-03-02", "bn": None, "ch": [0, 0, 0, 0, 0.01, 0.02, 0, 0.01, 0.03], "sp": None})
    coins.sort(key=lambda c: -c["mc"])
    for i, c in enumerate(coins):
        c["r"] = i + 1
    mm = {"v": 1, "t": "2026-11-12T18:00:00+00:00", "tf": TFS, "src": {}, "errors": {}, "g": m.get("global"),
          "fng": {"v": 28, "k": "Fear"}, "n": len(coins), "c": coins}
    json.dump(mm, open(os.path.join(out, "mm.json"), "w"), separators=(",", ":"))
    flows = {}
    for c in coins:
        if c["sec"] == "stable":
            continue
        f = {}
        for i, tf in enumerate(TFS):
            qv = c["v"] * {"5m": 1 / 288, "15m": 1 / 96, "1h": 1 / 24, "2h": 1 / 12, "4h": 1 / 6, "1d": 1, "7d": 7, "30d": 30, "1y": 365}[tf] * 0.4
            bs = 0.5 + MATH_CLAMP(c["ch"][i] / 60 + rnd.gauss(0, 0.03), -0.2, 0.2)
            f[tf] = [round(qv * (2 * bs - 1)), round(qv)]
        f["bk"] = [round(rnd.uniform(0.1, 8), 2), round(rnd.uniform(5e3, 2e6)), round(rnd.uniform(5e3, 2e6))]
        if c["r"] <= 40:
            b1 = c["mc"] / rnd.uniform(800, 4000)
            f["dp"] = {"b1": round(b1), "a1": round(b1 * rnd.uniform(0.7, 1.3)), "b2": round(b1 * 1.8), "a2": round(b1 * 1.9), "rng": 3.0 if c["r"] > 2 else 0.6, "t": 1794500000}
        flows[c["s"]] = f
    hist = [[1794441600 - 86400 * (364 - i), round(2.5e11 + i * 1.1e8 + rnd.gauss(0, 4e8))] for i in range(365)]
    st = {"tot": 289503379559, "d1": -82787124, "d7": -2070780778, "d30": -14217000000, "n": 152, "hist": hist,
          "top": [{"s": "USDT", "n": "Tether", "c": 175655097676, "d1": -82787124, "d7": -2070780778, "d30": -8316866229, "ch": ["Tron", "Ethereum", "BSC", "Solana"]},
                  {"s": "USDC", "n": "USD Coin", "c": 69500000000, "d1": 500000000, "d7": -500000000, "d30": 1500000000, "ch": ["Ethereum", "Solana"]},
                  {"s": "USDe", "n": "Ethena USDe", "c": 9800000000, "d1": -12000000, "d7": -340000000, "d30": -1900000000, "ch": ["Ethereum"]}]}
    json.dump({"v": 1, "t": "2026-11-12T18:00:00+00:00", "tf": TFS, "src": {}, "f": flows, "st": st}, open(os.path.join(out, "mm_flow.json"), "w"), separators=(",", ":"))
    # ETF table in the summarised shape scripts/etf.py writes
    import etf as E
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import test_etf as TE
    days = []
    for i in range(300):
        d = 1736553600 + 86400 * i
        import datetime
        dt = datetime.datetime.fromtimestamp(d, datetime.timezone.utc)
        if dt.weekday() >= 5:
            continue
        vals = [round(rnd.gauss(30, 160), 1), round(rnd.gauss(10, 60), 1), round(rnd.gauss(-8, 30), 1), round(rnd.gauss(2, 8), 1)]
        days.append((dt.strftime("%Y-%m-%d"), round(sum(vals), 1), vals))
    btc = E.summarise(["IBIT", "FBTC", "GBTC", "BTC"], days)
    eth = E.summarise(["ETHA", "FETH", "ETHE", "ETH"], [(d, round(t / 4, 1), [round(v / 4, 1) for v in vals]) for d, t, vals in days])
    tre = {"t": 1794500000, "btc": {"total": 1301532.2, "value": 9.35e10, "dom": 6.2, "n": 181, "top": [
        {"n": "Strategy", "s": "MSTR.US", "c": "US", "h": 850363, "e": 64164427909, "v": 61129743027, "p": 4.049},
        {"n": "Metaplanet", "s": "3350.T", "c": "JP", "h": 44000, "e": 3896249023, "v": 3163012376, "p": 0.21}]},
        "eth": {"total": 5100000, "value": 1.03e10, "dom": 4.2, "n": 70, "top": [{"n": "BitMine", "s": "BMNR.US", "c": "US", "h": 3500000, "e": 1.2e10, "v": 7.1e9, "p": 2.9}]}}
    json.dump({"v": 1, "t": "2026-11-12T18:00:00+00:00", "src": {"farside_btc": "2026-11-12T17:00:00+00:00", "farside_eth": "2026-11-12T17:00:00+00:00"},
               "errors": {}, "btc": btc, "eth": eth, "tre": tre,
               "bt": dict(E.parse_bt(TE.bt_page(110)), t="2026-11-13T09:00:00+00:00"), "world": dict(E.parse_8mc(TE.mc8_page(), n=12), t="2026-11-13T09:00:00+00:00")}, open(os.path.join(out, "etf.json"), "w"), separators=(",", ":"))
    # the logo sheet, built the way CI builds it, from a copy of the logo folder
    import mm_data as M
    L = os.path.join(out, "logos")
    if os.path.isdir(L):
        shutil.rmtree(L)
    shutil.copytree(os.path.join(ROOT, "data", "logos"), L)
    M.LOGOS = L
    meta, _ = M.build_atlas([c["s"] for c in coins])
    print(f"fixtures in {out}: {len(coins)} coins, atlas {meta['n']} logos ({os.path.getsize(os.path.join(L, meta['img'])) // 1024} kB)")


def MATH_CLAMP(x, a, b):
    return a if x < a else b if x > b else x


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/mmfx")
