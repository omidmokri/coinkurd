#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DeFi for the Observatory — /charts/defi/ : what is locked in the protocols, where it sits, and what it earns.

Sources (DefiLlama, free, no key)
  api.llama.fi/v2/historicalChainTvl   one row a day since 2017-09-27: everything locked across every chain
  api.llama.fi/v2/chains               every chain's figure now (426 of them)
  api.llama.fi/protocols               every protocol now (~9,000): its chain, category, figure and 1d/7d move
  yields.llama.fi/pools                every pool now (~15,000): what it holds and what it pays

What counts as DeFi here. DefiLlama's protocol list also carries exchanges (category "CEX") and the assets bridges
hold. An exchange's reserves are not money locked in a protocol -- Binance alone would be $108B of a $68B total and
the number would say nothing about DeFi -- so CEX is left out of every figure on this page. Bridges and liquid
staking stay: that is money in a contract. The total shown is DefiLlama's own historical series, which already
excludes exchanges, so the parts and the whole are measured the same way.

Yields. A pool is listed only with at least $1M in it, because a large rate on a small pool is noise, and the page
marks the two risks that decide whether a rate is really free: whether the pool holds stablecoins, and whether it
can suffer impermanent loss. Rates come from the source as they are; nothing is annualised or recomputed here.

Writes
  data/obs/defi.json       tvl: the daily series ({"t0","n","v"} in millions, as the other Observatory files),
                           chains / cats / protos / pools: the current picture, updated_at, source
Asks the source at most every 3 hours.   Self-test: python3 tests/test_obs_defi.py
"""
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obs_chain as C  # noqa: E402  (get, sig, UA)

OUT = os.path.join(C.OUT_DIR, "defi.json")
API, YIELDS = "https://api.llama.fi", "https://yields.llama.fi"
SOURCE = "DefiLlama (api.llama.fi, yields.llama.fi), free, no key"
EVERY = 3 * 3600
M = 1e6
SKIP_CAT = {"cex"}            # an exchange's reserves are not money locked in a protocol
POOL_MIN = 1_000_000          # a rate on a smaller pool says more about the pool than about the market
N_CHAINS, N_CATS, N_PROTOS, N_POOLS = 15, 12, 40, 40


def _fresh(path):
    try:
        with open(path, encoding="utf-8") as f:
            old = json.load(f)
        at = datetime.fromisoformat(old["updated_at"])
        return old if (datetime.now(timezone.utc) - at).total_seconds() < EVERY else None
    except Exception:  # noqa: BLE001
        return None


def history():
    """the whole daily series, as one compact column of millions of dollars"""
    rows = C.get(API + "/v2/historicalChainTvl") or []
    rows = [r for r in rows if r.get("date") and r.get("tvl") is not None]
    rows.sort(key=lambda r: r["date"])
    if not rows:
        return None
    return {"t0": int(rows[0]["date"]), "n": len(rows),
            "v": [C.sig(r["tvl"] / M) for r in rows]}


def main():
    force = os.environ.get("OBS_DEFI_FORCE")
    if not force and _fresh(OUT):
        print("defi: still fresh")
        return

    tvl = history()
    chains = C.get(API + "/v2/chains") or []
    protos = C.get(API + "/protocols") or []
    pools = ((C.get(YIELDS + "/pools") or {}).get("data")) or []
    if not (tvl and chains and protos):
        print("defi: source unavailable, nothing written")
        return

    live = [p for p in protos
            if (p.get("tvl") or 0) > 0 and str(p.get("category") or "").lower() not in SKIP_CAT]

    by_cat = {}
    for p in live:
        c = p.get("category") or "Other"
        by_cat[c] = by_cat.get(c, 0) + p["tvl"]

    top_chains = sorted([c for c in chains if (c.get("tvl") or 0) > 0],
                        key=lambda c: -c["tvl"])[:N_CHAINS]
    top_protos = sorted(live, key=lambda p: -p["tvl"])[:N_PROTOS]
    good = [p for p in pools
            if (p.get("tvlUsd") or 0) >= POOL_MIN and (p.get("apy") or 0) > 0 and not p.get("outlier")]
    top_pools = sorted(good, key=lambda p: -(p.get("apy") or 0))[:N_POOLS]

    doc = {
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": SOURCE,
        "note": "Exchange reserves (DefiLlama category CEX) are excluded; the total is DefiLlama's own series.",
        "tvl": tvl,
        "chains": [{"name": c["name"], "usd": C.sig(c["tvl"] / M)} for c in top_chains],
        "cats": [{"name": k, "usd": C.sig(v / M)}
                 for k, v in sorted(by_cat.items(), key=lambda kv: -kv[1])[:N_CATS]],
        "protos": [{"name": p["name"], "cat": p.get("category") or "", "chain": p.get("chain") or "",
                    "usd": C.sig(p["tvl"] / M), "d1": C.sig(p.get("change_1d") or 0, 3),
                    "d7": C.sig(p.get("change_7d") or 0, 3)} for p in top_protos],
        "pools": [{"sym": p.get("symbol") or "", "proj": p.get("project") or "", "chain": p.get("chain") or "",
                   "usd": C.sig(p["tvlUsd"] / M), "apy": C.sig(p["apy"], 4),
                   "base": C.sig(p.get("apyBase") or 0, 4), "rew": C.sig(p.get("apyReward") or 0, 4),
                   "stable": bool(p.get("stablecoin")), "il": (p.get("ilRisk") or "") == "yes"}
                  for p in top_pools],
        "counts": {"chains": len(chains), "protocols": len(live), "pools": len(good)},
    }
    os.makedirs(C.OUT_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"defi: {doc['counts']} | total ${tvl['v'][-1] / 1000:,.1f}B | wrote {os.path.getsize(OUT) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
