#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bitcoin network snapshot (real data, free public APIs) → data/chain.json
  - mempool.space: latest 15 blocks (height, tx count, size, pool, fees), recommended fees, hashrate, difficulty adjustment
  - bitnodes.io:   reachable Bitcoin nodes, aggregated into 2°×2° cells (only cells, never IPs) + country counts (every 6h)
Used by the cinematic hero (tunnel of real blocks, globe drawn by real nodes) as a cache/fallback for the live calls.
"""
import json
import os
import time
from collections import Counter
from datetime import datetime, timezone, timedelta

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "chain.json")
MP = "https://mempool.space/api"
NOW = datetime.now(timezone.utc)
UA = {"User-Agent": "entekhab.net/1.0 (+https://entekhab.net)"}


def get(url, timeout=40):
    for i in range(3):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            if r.status_code == 200:
                return r.json()
            print("  http", r.status_code, url[:90])
            if r.status_code in (403, 404):
                return None
        except Exception as e:  # noqa: BLE001
            print("  err", str(e)[:120], url[:90])
        time.sleep(3 + i * 5)
    return None


def main():
    try:
        prev = json.load(open(OUT, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        prev = {}
    out = dict(prev)
    out["errors"] = {}

    bl = get(MP + "/v1/blocks")
    if bl:
        out["blocks"] = [{
            "id": b["id"], "height": b["height"], "timestamp": b["timestamp"], "tx_count": b["tx_count"], "size": b["size"],
            "extras": {"pool": {"name": ((b.get("extras") or {}).get("pool") or {}).get("name")},
                       "totalFees": (b.get("extras") or {}).get("totalFees"), "medianFee": (b.get("extras") or {}).get("medianFee")}}
            for b in bl[:15]]
    else:
        out["errors"]["blocks"] = "mempool.space unavailable"
    fe = get(MP + "/v1/fees/recommended")
    if fe:
        out["fees"] = fe
    hr = get(MP + "/v1/mining/hashrate/3d")
    if hr:
        out["hashrate"] = hr.get("currentHashrate")
        out["difficulty"] = hr.get("currentDifficulty")
    da = get(MP + "/v1/difficulty-adjustment")
    if da:
        out["adjustment"] = {k: da.get(k) for k in ("progressPercent", "difficultyChange", "remainingBlocks", "estimatedRetargetDate")}

    last = (prev.get("nodes") or {}).get("at")
    if not last or NOW - datetime.fromisoformat(last) >= timedelta(hours=6):
        sn = get("https://bitnodes.io/api/v1/snapshots/latest/", timeout=120)
        if sn and isinstance(sn.get("nodes"), dict):
            cells, countries, located = Counter(), Counter(), 0
            for v in sn["nodes"].values():
                try:
                    cc, lat, lon = v[7], v[8], v[9]
                except (IndexError, TypeError):
                    continue
                if cc:
                    countries[cc] += 1
                if lat is None or lon is None or (lat == 0 and lon == 0):
                    continue          # Tor / unknown location
                located += 1
                cells[(int(round(lat / 2.0) * 2), int(round(lon / 2.0) * 2))] += 1
            out["nodes"] = {
                "at": NOW.isoformat(), "snapshot": sn.get("timestamp"), "height": sn.get("latest_height"),
                "total": sn.get("total_nodes") or len(sn["nodes"]), "located": located, "countries": len(countries),
                "top_countries": countries.most_common(12),
                "cells": [[la, lo, n] for (la, lo), n in cells.most_common()],
            }
            print("nodes:", out["nodes"]["total"], "located:", located, "cells:", len(cells), "countries:", len(countries))
        else:
            out["errors"]["nodes"] = "bitnodes.io unavailable"
    out["updated_at"] = NOW.isoformat()
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    b0 = (out.get("blocks") or [{}])[0]
    print("tip:", b0.get("height"), "tx:", b0.get("tx_count"), "| fee:", (out.get("fees") or {}).get("halfHourFee"),
          "| hashrate:", out.get("hashrate"), "| nodes:", (out.get("nodes") or {}).get("total"), "| errors:", out["errors"])


if __name__ == "__main__":
    main()
