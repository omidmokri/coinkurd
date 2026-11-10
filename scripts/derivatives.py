#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Derivatives command room — OKX public API (free, no key) → data/derivatives.json
  - funding rate of every USDT perpetual (8h) + annualised, open interest (USD) of every swap
  - BTC/ETH/SOL: long/short account ratio, taker buy/sell volume, open-interest history (hourly)
  - recent liquidations (BTC, ETH, SOL perpetuals): long vs short notional in the last hour / 24h window returned by OKX
  - hourly history of total OI and OI-weighted funding (kept 14 days)
"""
import json
import os
import time
from datetime import datetime, timezone, timedelta

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "derivatives.json")
LIQ_OUT = os.path.join(ROOT, "data", "liq_store.json")   # [ts_ms, 0=long/1=short, usd] per coin, last 24 h
LIQ = {}
B = "https://www.okx.com/api/v5/"
NOW = datetime.now(timezone.utc)
STABLE = {"USDC", "USDT", "DAI", "FDUSD", "TUSD", "USDE", "PYUSD", "USD1"}


def get(path, params=None):
    for i in range(3):
        try:
            r = requests.get(B + path, params=params, timeout=30, headers={"User-Agent": "entekhab.net/1.0"})
            if r.status_code == 200:
                j = r.json()
                if str(j.get("code")) == "0":
                    return j.get("data")
                print("  okx code", j.get("code"), j.get("msg"), path)
                return None
            print("  http", r.status_code, path)
        except Exception as e:  # noqa: BLE001
            print("  err", str(e)[:100], path)
        time.sleep(2 + i * 3)
    return None


def f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def main():
    try:
        prev = json.load(open(OUT, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        prev = {}
    out = {"updated_at": NOW.isoformat(), "source": "OKX public API", "errors": {}}
    try:
        LIQ.update(json.load(open(LIQ_OUT, encoding="utf-8")).get("rows") or {})
    except Exception:  # noqa: BLE001
        pass

    fund = {x["instId"]: x for x in (get("public/funding-rate", {"instId": "ANY"}) or [])}
    ois = {x["instId"]: x for x in (get("public/open-interest", {"instType": "SWAP"}) or [])}
    coins = []
    for inst, o in ois.items():
        if not inst.endswith("-USDT-SWAP"):
            continue
        c = inst.split("-")[0]
        if c in STABLE:
            continue
        fr = f((fund.get(inst) or {}).get("fundingRate"))
        coins.append({"coin": c, "oi_usd": round(f(o.get("oiUsd")) or 0), "funding": None if fr is None else round(fr * 100, 4),
                      "funding_ann": None if fr is None else round(fr * 3 * 365 * 100, 1)})
    coins.sort(key=lambda x: -x["oi_usd"])
    if not coins:
        out["errors"]["swaps"] = "no data"
    top = [c for c in coins if c["funding"] is not None][:60]
    tot = sum(c["oi_usd"] for c in coins)
    wf = sum(c["oi_usd"] * c["funding"] for c in top) / (sum(c["oi_usd"] for c in top) or 1) if top else None
    out["swaps"] = coins[:80]
    out["total_oi_usd"] = round(tot)
    out["avg_funding"] = None if wf is None else round(wf, 4)
    out["funding_hot"] = sorted(top, key=lambda c: -c["funding"])[:8]
    out["funding_cold"] = sorted(top, key=lambda c: c["funding"])[:8]

    for ccy in ("BTC", "ETH", "SOL"):
        d = {}
        ls = get("rubik/stat/contracts/long-short-account-ratio", {"ccy": ccy, "period": "1H"})
        if ls:
            d["long_short"] = [[int(x[0]), f(x[1])] for x in ls[:48]][::-1]
        tv = get("rubik/stat/taker-volume", {"ccy": ccy, "instType": "CONTRACTS", "period": "1H"})
        if tv:
            d["taker"] = [[int(x[0]), f(x[1]), f(x[2])] for x in tv[:48]][::-1]   # ts, sell, buy
        oh = get("rubik/stat/contracts/open-interest-volume", {"ccy": ccy, "period": "1H"})
        if oh:
            d["oi_hist"] = [[int(x[0]), f(x[1]), f(x[2])] for x in oh[:72]][::-1]   # ts, oi usd, volume usd
        inst = (get("public/instruments", {"instType": "SWAP", "instId": f"{ccy}-USDT-SWAP"}) or [{}])[0]
        ct = f(inst.get("ctVal")) or {"BTC": 0.01, "ETH": 0.1, "SOL": 1}.get(ccy, 1)
        lq = get("public/liquidation-orders", {"instType": "SWAP", "uly": f"{ccy}-USDT", "state": "filled"})
        if lq:
            det = [x for blk in lq for x in (blk.get("details") or [])]
            rows = []
            for x in det:
                ts, px, sz = int(x.get("ts") or x.get("time") or 0), f(x.get("bkPx")), f(x.get("sz"))
                if not (ts and px and sz):
                    continue
                rows.append({"ts": ts, "side": "short" if x.get("posSide") == "short" or x.get("side") == "buy" else "long", "usd": round(px * sz * ct)})
            rows.sort(key=lambda r: -r["ts"])
            # keep every order seen in the last 24 h across runs (deduplicated), so a true 24-hour total exists
            day_ago = int((NOW - timedelta(hours=24)).timestamp() * 1000)
            st = {(r[0], r[1], r[2]) for r in (LIQ.get(ccy) or []) if r[0] >= day_ago}
            st |= {(r["ts"], 0 if r["side"] == "long" else 1, r["usd"]) for r in rows if r["ts"] >= day_ago}
            LIQ[ccy] = sorted(st)
            cover = min((r[0] for r in LIQ[ccy]), default=None)
            hr = int((NOW - timedelta(hours=1)).timestamp() * 1000)
            d["liq"] = {"n": len(rows), "from": rows[-1]["ts"] if rows else None, "to": rows[0]["ts"] if rows else None,
                        "long_usd": sum(r["usd"] for r in rows if r["side"] == "long"), "short_usd": sum(r["usd"] for r in rows if r["side"] == "short"),
                        "long_usd_1h": sum(r["usd"] for r in rows if r["side"] == "long" and r["ts"] >= hr),
                        "short_usd_1h": sum(r["usd"] for r in rows if r["side"] == "short" and r["ts"] >= hr),
                        "biggest": sorted(rows, key=lambda r: -r["usd"])[:5],
                        # 24-hour totals from the store; "since" says how far back the store really reaches
                        "long_usd_24h": sum(r[2] for r in LIQ[ccy] if r[1] == 0), "short_usd_24h": sum(r[2] for r in LIQ[ccy] if r[1] == 1),
                        "n_24h": len(LIQ[ccy]), "since": cover}
        sw = next((c for c in coins if c["coin"] == ccy), None)
        if sw:
            d.update({"oi_usd": sw["oi_usd"], "funding": sw["funding"], "funding_ann": sw["funding_ann"]})
        out[ccy] = d

    hist = prev.get("history", [])
    if coins and (not hist or NOW.timestamp() - hist[-1]["t"] >= 55 * 60):
        hist.append({"t": int(NOW.timestamp()), "oi": round(tot), "f": out["avg_funding"],
                     "btc_oi": (out.get("BTC") or {}).get("oi_usd"), "eth_oi": (out.get("ETH") or {}).get("oi_usd"),
                     "sol_oi": (out.get("SOL") or {}).get("oi_usd"),
                     "btc_f": (out.get("BTC") or {}).get("funding"), "eth_f": (out.get("ETH") or {}).get("funding"),
                     "sol_f": (out.get("SOL") or {}).get("funding")})
    cut = NOW.timestamp() - 14 * 86400
    out["history"] = [h for h in hist if h["t"] >= cut]
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump({"updated_at": NOW.isoformat(), "rows": LIQ}, open(LIQ_OUT, "w", encoding="utf-8"), separators=(",", ":"))
    b = out.get("BTC") or {}
    print("swaps:", len(coins), "| total OI $%.2fB" % (tot / 1e9), "| avg funding", out["avg_funding"], "| BTC funding", b.get("funding"),
          "| L/S", (b.get("long_short") or [[0, None]])[-1][1], "| liq", {k: (b.get("liq") or {}).get(k) for k in ("n", "long_usd", "short_usd")},
          "| history", len(out["history"]), "| errors", out["errors"])


if __name__ == "__main__":
    main()
