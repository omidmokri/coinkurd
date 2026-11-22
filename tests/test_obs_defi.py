#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scripts/obs_defi.py — the DeFi page's data, without touching the network.

The field shapes below were read from the live endpoints on 2026-11-22 (api.llama.fi/v2/chains, /protocols,
/v2/historicalChainTvl and yields.llama.fi/pools); the rows are stand-ins that exercise the decisions the script
makes. Checks:
  * an exchange's reserves are left out -- Binance alone is larger than the whole DeFi total and would swamp it;
  * bridges and liquid staking stay, because that is money sitting in a contract;
  * categories add up from the protocols that remain, never from the raw list;
  * a pool below the floor, or one the source flags an outlier, is not offered as a yield;
  * a pool's two real risks -- stablecoin or not, impermanent loss or not -- survive into the file;
  * the daily series is written as millions, oldest first;
  * when a source is down nothing is written, so a good file is never replaced by a half one.
Run: python3 tests/test_obs_defi.py
"""
import json
import os
import sys
import tempfile
import unittest.mock as mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

FAILS = []


def ok(what, cond, got=None):
    print(("PASS " if cond else "FAIL ") + what + ("" if cond else f"  -> {got!r}"))
    if not cond:
        FAILS.append(what)


CHAINS = [{"name": "Ethereum", "tvl": 35_818_585_999.8}, {"name": "Base", "tvl": 4_669_982_961.2},
          {"name": "Solana", "tvl": 4_619_778_327.9}, {"name": "Dead", "tvl": 0}]
PROTOS = [
    {"name": "Binance CEX", "category": "CEX", "chain": "Multi-Chain", "tvl": 108_463_136_389.3,
     "change_1d": 1.34, "change_7d": -1.98},
    {"name": "OKX", "category": "CEX", "chain": "Multi-Chain", "tvl": 26_406_000_000.0,
     "change_1d": 1.5, "change_7d": 5.44},
    {"name": "LayerZero V2", "category": "Bridge", "chain": "Multi-Chain", "tvl": 17_683_000_000.0,
     "change_1d": -0.61, "change_7d": 5.72},
    {"name": "Lido", "category": "Liquid Staking", "chain": "Multi-Chain", "tvl": 16_273_000_000.0,
     "change_1d": 2.54, "change_7d": -7.88},
    {"name": "Aave V3", "category": "Lending", "chain": "Multi-Chain", "tvl": 15_135_000_000.0,
     "change_1d": 2.78, "change_7d": 11.45},
    {"name": "Spark", "category": "Lending", "chain": "Ethereum", "tvl": 5_000_000_000.0,
     "change_1d": 0.1, "change_7d": 0.2},
    {"name": "Closed", "category": "Lending", "chain": "Ethereum", "tvl": 0, "change_1d": 0, "change_7d": 0},
]
POOLS = {"status": "success", "data": [
    {"symbol": "STETH", "project": "lido", "chain": "Ethereum", "tvlUsd": 16_407_000_000.0, "apy": 2.59,
     "apyBase": 2.59, "apyReward": None, "stablecoin": False, "ilRisk": "no", "outlier": False},
    {"symbol": "USDC", "project": "aave-v3", "chain": "Ethereum", "tvlUsd": 900_000_000.0, "apy": 6.1,
     "apyBase": 6.1, "apyReward": None, "stablecoin": True, "ilRisk": "no", "outlier": False},
    {"symbol": "ETH-USDC", "project": "uniswap-v3", "chain": "Ethereum", "tvlUsd": 50_000_000.0, "apy": 24.0,
     "apyBase": 24.0, "apyReward": None, "stablecoin": False, "ilRisk": "yes", "outlier": False},
    {"symbol": "SCAM", "project": "x", "chain": "Ethereum", "tvlUsd": 9_000_000.0, "apy": 90000.0,
     "apyBase": 0, "apyReward": 90000.0, "stablecoin": False, "ilRisk": "yes", "outlier": True},
    {"symbol": "TINY", "project": "y", "chain": "Base", "tvlUsd": 100_000.0, "apy": 500.0,
     "apyBase": 500.0, "apyReward": None, "stablecoin": False, "ilRisk": "no", "outlier": False},
]}
HIST = [{"date": 1506470400, "tvl": 1_000_000.0}, {"date": 1636416000, "tvl": 177_500_000_000.0},
        {"date": 1763769600, "tvl": 68_020_000_000.0}]


def fake_get(url, params=None, timeout=90):
    if "historicalChainTvl" in url:
        return list(reversed(HIST))          # the script must sort; hand it back to front on purpose
    if url.endswith("/v2/chains"):
        return CHAINS
    if url.endswith("/protocols"):
        return PROTOS
    if "yields" in url:
        return POOLS
    return None


def main():
    import obs_defi as D

    tmp = tempfile.mkdtemp()
    with mock.patch.object(D.C, "get", fake_get), \
         mock.patch.object(D, "OUT", os.path.join(tmp, "defi.json")), \
         mock.patch.object(D.C, "OUT_DIR", tmp):
        D.main()
    doc = json.load(open(os.path.join(tmp, "defi.json"), encoding="utf-8"))

    names = [p["name"] for p in doc["protos"]]
    ok("an exchange's reserves are left out", "Binance CEX" not in names and "OKX" not in names, names)
    ok("a bridge and liquid staking stay", {"LayerZero V2", "Lido"} <= set(names), names)
    ok("a protocol with nothing in it is left out", "Closed" not in names)
    ok("the largest remaining protocol leads", names[0] == "LayerZero V2", names[:2])

    cats = {c["name"]: c["usd"] for c in doc["cats"]}
    ok("categories are built from what remains", "CEX" not in cats, list(cats))
    ok("a category adds its protocols up", abs(cats["Lending"] - (15_135 + 5_000)) < 1, cats.get("Lending"))

    ok("a chain with nothing in it is left out", "Dead" not in [c["name"] for c in doc["chains"]])
    ok("chains are in millions", abs(doc["chains"][0]["usd"] - 35_818.6) < 1, doc["chains"][0])

    pools = {p["sym"]: p for p in doc["pools"]}
    ok("an outlier is not offered as a yield", "SCAM" not in pools, list(pools))
    ok("a pool under the floor is not offered", "TINY" not in pools, list(pools))
    ok("the best rate leads", doc["pools"][0]["sym"] == "ETH-USDC", doc["pools"][0])
    ok("a stablecoin pool is marked", pools["USDC"]["stable"] is True and pools["USDC"]["il"] is False)
    ok("impermanent loss is marked", pools["ETH-USDC"]["il"] is True)

    t = doc["tvl"]
    ok("the series is oldest first", t["t0"] == HIST[0]["date"] and t["n"] == 3)
    ok("the series is in millions", abs(t["v"][-1] - 68_020) < 1, t["v"][-1])
    ok("it says where it came from", "DefiLlama" in doc["source"] and doc["updated_at"])

    # a source that is down must not replace a good file with a half one
    tmp2 = tempfile.mkdtemp()
    out2 = os.path.join(tmp2, "defi.json")
    with mock.patch.object(D.C, "get", lambda *a, **k: None), \
         mock.patch.object(D, "OUT", out2), mock.patch.object(D.C, "OUT_DIR", tmp2):
        D.main()
    ok("a source that is down writes nothing", not os.path.exists(out2))

    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nOK")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
