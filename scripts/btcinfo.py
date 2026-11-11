#!/usr/bin/env python3
"""Bitcoin "right now" for the /satoshi/ page → data/btcinfo.json (real data, free public APIs, every 15 minutes).

  mempool.space   latest 12 blocks (size, weight, reward, fees, fee range, pool), the mempool and its next projected blocks,
                  recommended fees, difficulty adjustment, the last 144 blocks (reward, fees, transactions), mining pools of the
                  last week, one year of hashrate, Lightning network totals, USD price
  blockchair.com  (when it answers) chain size, 24h transfer volume, largest transaction, addresses with a balance

The browser asks mempool.space itself for what moves (blocks, mempool, fees) and falls back to this file, which carries its time.
A source that fails leaves its previous values in place; nothing is estimated here."""
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chain as C  # noqa: E402  (same polite getter)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "btcinfo.json")
MP = C.MP


def num(v):
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def main():
    try:
        out = json.load(open(OUT, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        out = {}
    err = {}
    bl = C.get(MP + "/v1/blocks")
    if bl:
        rows = []
        for b in bl[:12]:
            x = b.get("extras") or {}
            fr = x.get("feeRange") or []
            rows.append({"id": b["id"], "height": b["height"], "timestamp": b["timestamp"], "tx_count": b["tx_count"], "size": b["size"],
                         "weight": b.get("weight"), "reward": x.get("reward"), "totalFees": x.get("totalFees"), "medianFee": x.get("medianFee"),
                         "feeRange": [fr[0], fr[-1]] if fr else None, "avgFeeRate": x.get("avgFeeRate"), "pool": (x.get("pool") or {}).get("name")})
        out["blocks"] = rows
        u = (bl[0].get("extras") or {}).get("utxoSetSize")
        if u:
            out["utxo"] = u
    else:
        err["blocks"] = 1
    mp = C.get(MP + "/mempool")
    if mp:
        out["mempool"] = {k: mp.get(k) for k in ("count", "vsize", "total_fee")}
    else:
        err["mempool"] = 1
    mb = C.get(MP + "/v1/fees/mempool-blocks")
    if mb:
        out["next"] = [{"nTx": m.get("nTx"), "vsize": m.get("blockVSize"), "totalFees": m.get("totalFees"), "medianFee": m.get("medianFee"),
                        "feeRange": [m["feeRange"][0], m["feeRange"][-1]] if m.get("feeRange") else None} for m in mb[:4]]
        out["nextN"] = len(mb)
    fe = C.get(MP + "/v1/fees/recommended")
    if fe:
        out["fees"] = fe
    da = C.get(MP + "/v1/difficulty-adjustment")
    if da:
        out["adj"] = {k: da.get(k) for k in ("progressPercent", "difficultyChange", "remainingBlocks", "estimatedRetargetDate", "timeAvg", "previousRetarget", "nextRetargetHeight")}
    rs = C.get(MP + "/v1/mining/reward-stats/144")
    if rs:
        day = {"blocks": 144, "reward": num(rs.get("totalReward")), "fee": num(rs.get("totalFee")), "tx": num(rs.get("totalTx")), "start": rs.get("startBlock"), "end": rs.get("endBlock")}
        try:   # how long those 144 blocks really took
            h0 = C.requests.get(f"{MP}/block-height/{rs['startBlock']}", timeout=30, headers=C.UA).text.strip()
            b0 = C.get(f"{MP}/block/{h0}") if len(h0) == 64 else None
            if b0 and out.get("blocks"):
                day["span"] = out["blocks"][0]["timestamp"] - b0["timestamp"]
        except Exception as e:  # noqa: BLE001
            print("  span:", str(e)[:100])
        out["day"] = day
    pl = C.get(MP + "/v1/mining/pools/1w")
    if pl and pl.get("pools"):
        out["pools"] = {"total": pl.get("blockCount"), "list": [[p.get("name"), p.get("blockCount")] for p in pl["pools"][:8]]}
    hr = C.get(MP + "/v1/mining/hashrate/1y")
    if hr and hr.get("hashrates"):
        hs = hr["hashrates"]
        step = max(1, len(hs) // 60)
        out["hr"] = [[h["timestamp"], round(h["avgHashrate"] / 1e18, 1)] for h in hs[::step]]
        out["hashrate"] = hr.get("currentHashrate")
        out["difficulty"] = hr.get("currentDifficulty")
        out["diff"] = [[d.get("time"), d.get("height"), d.get("difficulty"), d.get("adjustment")] for d in (hr.get("difficulty") or [])[-8:]]
    ln = C.get(MP + "/v1/lightning/statistics/latest")
    la = (ln or {}).get("latest") or {}
    if la.get("channel_count"):
        out["ln"] = {"channels": la.get("channel_count"), "nodes": la.get("node_count"), "capacity": la.get("total_capacity"), "at": la.get("added")}
    pr = C.get(MP + "/v1/prices")
    if pr and pr.get("USD"):
        out["price"] = pr["USD"]
    bc = C.get("https://api.blockchair.com/bitcoin/stats", timeout=30)
    d = (bc or {}).get("data") or {}
    if d.get("blocks"):
        lt = d.get("largest_transaction_24h") or {}
        out["bc"] = {"size": d.get("blockchain_size"), "tx_total": d.get("transactions"), "tx_24h": d.get("transactions_24h"), "vol_24h": d.get("volume_24h"),
                     "largest_usd": lt.get("value_usd"), "largest_hash": lt.get("hash"), "holders": d.get("hodling_addresses"), "nodes": d.get("nodes"),
                     "med_fee_usd": d.get("median_transaction_fee_usd_24h"), "avg_fee_usd": d.get("average_transaction_fee_usd_24h"),
                     "dominance": d.get("market_dominance_percentage"), "at": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()}
    else:
        err["blockchair"] = 1          # the previous "bc" block, if any, stays with its own time
    out["t"] = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
    out["errors"] = err
    if out.get("blocks"):
        json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("btcinfo: tip", (out.get("blocks") or [{}])[0].get("height"), "| mempool", (out.get("mempool") or {}).get("count"), "| pools", len((out.get("pools") or {}).get("list") or []),
          "| blockchair", "ok" if "bc" in out and not err.get("blockchair") else "—", "| errors", err)


if __name__ == "__main__":
    main()
