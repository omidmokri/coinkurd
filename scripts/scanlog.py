#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scanner track record (public backtest of the opportunity scanner)
  • every new scanner finding is logged once (the same coin + pattern again within 12 h counts as the same finding)
    with the price at the moment it was published
  • its result is measured later on real Binance 1h candles: +6h, +24h, +72h (signed by the finding's direction),
    max favourable / adverse move in 72h, and whether its invalidation level or hypothetical target was hit first
  • per-pattern statistics (count, % positive, average) — the "historical performance of the same pattern" shown next to
    every live finding on the homepage
Output: data/scanlog.json
"""
import json
import os
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
OUT = os.path.join(D, "scanlog.json")
NOW = datetime.now(timezone.utc)
BN = "https://data-api.binance.vision/api/v3/klines"
H = [("6h", 6), ("24h", 24), ("72h", 72)]
KEEP_DAYS = 60
MAX_COINS_PER_RUN = 70


def load(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return d


def klines(sym, start_ms):
    out, st = [], start_ms
    for _ in range(3):
        try:
            r = requests.get(BN, params={"symbol": sym + "USDT", "interval": "1h", "startTime": st, "limit": 1000}, timeout=20)
            k = r.json() if r.status_code == 200 else []
        except Exception:  # noqa: BLE001
            k = []
        if not k:
            break
        out += [(x[0], float(x[2]), float(x[3]), float(x[4])) for x in k]
        if len(k) < 1000:
            break
        st = k[-1][0] + 1
    return out


# ------------------------------------------------------------------ one-time backtest (replay of the scanner rules on past candles)
def _ema(v, n):
    k, e, out = 2 / (n + 1), None, []
    for x in v:
        e = x if e is None else x * k + e * (1 - k)
        out.append(e)
    return out


def _rsi_series(c, n=14):
    out = [None] * len(c)
    if len(c) <= n:
        return out
    g = [max(c[i] - c[i - 1], 0) for i in range(1, len(c))]
    lo = [max(c[i - 1] - c[i], 0) for i in range(1, len(c))]
    ag, al = sum(g[:n]) / n, sum(lo[:n]) / n
    out[n] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    for i in range(n, len(g)):
        ag, al = (ag * (n - 1) + g[i]) / n, (al * (n - 1) + lo[i]) / n
        out[i + 1] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    return out


def backfill(coins):
    """Same rules as scripts/market.py (1h candles, RSI 14, EMA 20/50, 48h range, volume ×2.5, RSI divergences),
    evaluated bar by bar on the last ~40 days; outcomes from the same candles. Marked bt=True on the site."""
    BULL = {"rsi_oversold", "ema_golden_cross", "breakout_up", "bull_divergence"}
    BEAR = {"rsi_overbought", "ema_death_cross", "breakdown", "bear_divergence"}
    out = []
    for c in coins:
        try:
            r = requests.get(BN, params={"symbol": c + "USDT", "interval": "1h", "limit": 1000}, timeout=20)
            k = r.json() if r.status_code == 200 else []
        except Exception:  # noqa: BLE001
            k = []
        if len(k) < 300:
            continue
        o, h, lo, cl, v = ([float(x[i]) for x in k] for i in (1, 2, 3, 4, 5))
        t = [x[0] for x in k]
        e20, e50, rs = _ema(cl, 20), _ema(cl, 50), _rsi_series(cl)
        last = {}
        for i in range(150, len(k) - 73):
            hi48, lo48 = max(h[i - 48:i]), min(lo[i - 48:i])
            vavg = sum(v[i - 20:i]) / 20
            f = []
            if rs[i] is not None and rs[i] <= 30:
                f.append("rsi_oversold")
            if rs[i] is not None and rs[i] >= 70:
                f.append("rsi_overbought")
            for j in (i, i - 1, i - 2):
                if e20[j - 1] <= e50[j - 1] and e20[j] > e50[j]:
                    f.append("ema_golden_cross")
                    break
                if e20[j - 1] >= e50[j - 1] and e20[j] < e50[j]:
                    f.append("ema_death_cross")
                    break
            if cl[i] > hi48:
                f.append("breakout_up")
            if cl[i] < lo48:
                f.append("breakdown")
            if vavg and v[i] > 2.5 * vavg:
                f.append("volume_spike")
            w_lo, w_hi, w_rs = lo[i - 39:i + 1], h[i - 39:i + 1], rs[i - 39:i + 1]
            piv = lambda a, cmp: [x for x in range(2, len(a) - 2) if a[x] != a[x - 1] and all(cmp(a[x], a[y]) for y in (x - 2, x - 1, x + 1, x + 2))]  # noqa: E731
            pl, ph = piv(w_lo, lambda a, b: a <= b), piv(w_hi, lambda a, b: a >= b)
            if len(pl) >= 2 and None not in (w_rs[pl[-1]], w_rs[pl[-2]]) and len(w_lo) - pl[-1] <= 6 and w_lo[pl[-1]] < w_lo[pl[-2]] and w_rs[pl[-1]] > w_rs[pl[-2]] + 2:
                f.append("bull_divergence")
            if len(ph) >= 2 and None not in (w_rs[ph[-1]], w_rs[ph[-2]]) and len(w_hi) - ph[-1] <= 6 and w_hi[ph[-1]] > w_hi[ph[-2]] and w_rs[ph[-1]] < w_rs[ph[-2]] - 2:
                f.append("bear_divergence")
            kinds = set(f)
            for ty in f:
                if ty in last and i - last[ty] < 12:
                    continue                                   # same pattern within 12 h = same finding
                last[ty] = i
                same = BULL if ty in BULL else BEAR if ty in BEAR else set()
                conf = "high" if len(kinds & same) >= 2 or ("volume_spike" in kinds and ty != "volume_spike") else "medium"
                d = "bull" if ty in BULL else "bear" if ty in BEAR else ("bull" if cl[i] >= o[i] else "bear")
                sg, p0 = (-1 if d == "bear" else 1), cl[i]
                rr = {name: round(sg * (cl[i + hh] / p0 - 1) * 100, 2) for name, hh in H}
                win_h, win_l = max(h[i + 1:i + 73]), min(lo[i + 1:i + 73])
                out.append({"id": f"{c}-{ty}-bt{t[i]}", "coin": c, "type": ty, "dir": d, "conf": conf, "bt": True,
                            "t": datetime.fromtimestamp((t[i] + 3600000) / 1000, timezone.utc).isoformat(), "price": p0, "r": rr, "done": True,
                            "mfe": round(((win_h / p0 - 1) if sg > 0 else (1 - win_l / p0)) * 100, 2),
                            "mae": round(((win_l / p0 - 1) if sg > 0 else (1 - win_h / p0)) * 100, 2)})
        time.sleep(0.05)
    return out


def main():
    m = load(os.path.join(D, "market.json"), {})
    log = load(OUT, {"items": []})
    items = [x for x in log.get("items", []) if x.get("bt") or NOW - datetime.fromisoformat(x["t"]) <= timedelta(days=KEEP_DAYS)]
    if not log.get("backfilled") and m.get("coins"):
        top = [c["coin"] for c in sorted(m["coins"], key=lambda c: -(c.get("qvol") or 0))[:40]]
        bt = backfill(top)
        items += bt
        log["backfilled"] = {"at": NOW.isoformat(), "coins": len(top), "findings": len(bt)}
        print("backfill:", log["backfilled"])
    t_scan = m.get("updated_at") or NOW.isoformat()
    recent = defaultdict(lambda: None)
    for x in items:
        k = (x["coin"], x["type"])
        if not recent[k] or x["t"] > recent[k]:
            recent[k] = x["t"]
    added = 0
    if not m.get("stale"):
        for o in m.get("opportunities", []):
            k = (o["coin"], o["type"])
            if recent[k] and datetime.fromisoformat(t_scan) - datetime.fromisoformat(recent[k]) < timedelta(hours=12):
                continue
            items.append({"id": f"{o['coin']}-{o['type']}-{o.get('bar')}", "coin": o["coin"], "type": o["type"], "dir": o.get("dir"),
                          "conf": o.get("confidence"), "str": o.get("strength"), "t": t_scan, "price": o["price"],
                          "inval": o.get("inval"), "target": o.get("target"), "rr": o.get("rr")})
            recent[k] = t_scan
            added += 1
    # outcomes
    pend = defaultdict(list)
    for x in items:
        if x.get("done"):
            continue
        if NOW - datetime.fromisoformat(x["t"]) >= timedelta(hours=6):
            pend[x["coin"]].append(x)
    coins = sorted(pend, key=lambda c: min(x["t"] for x in pend[c]))[:MAX_COINS_PER_RUN]
    calc = 0
    for c in coins:
        start = int(min(datetime.fromisoformat(x["t"]) for x in pend[c]).timestamp() * 1000) - 3600000
        ks = klines(c, start)
        time.sleep(0.05)
        if not ks:
            continue
        for x in pend[c]:
            t0 = datetime.fromisoformat(x["t"])
            t0ms = int(t0.timestamp() * 1000)
            after = [q for q in ks if q[0] >= t0ms - 3600000]          # from the candle the finding was published in
            if not after:
                continue
            sg = -1 if x.get("dir") == "bear" else 1
            p0 = x["price"]
            r = x.get("r") or {}
            for name, h in H:
                if name in r or NOW < t0 + timedelta(hours=h):
                    continue
                tgt_ms = int((t0 + timedelta(hours=h)).timestamp() * 1000)
                q = next((q for q in after if q[0] >= tgt_ms - 3600000), None)
                if q:
                    r[name] = round(sg * (q[3] / p0 - 1) * 100, 2)
            x["r"] = r
            win = [q for q in after if q[0] < t0ms + 72 * 3600000]
            if win:
                hi, lo = max(q[1] for q in win), min(q[2] for q in win)
                x["mfe"] = round(((hi / p0 - 1) if sg > 0 else (1 - lo / p0)) * 100, 2)
                x["mae"] = round(((lo / p0 - 1) if sg > 0 else (1 - hi / p0)) * 100, 2)
                if x.get("inval") and x.get("target"):
                    hit = None
                    for q in win:
                        bad = q[2] <= x["inval"] if sg > 0 else q[1] >= x["inval"]
                        good = q[1] >= x["target"] if sg > 0 else q[2] <= x["target"]
                        if bad or good:
                            hit = "inval" if bad else "target"          # same candle → count the invalidation (conservative)
                            break
                    x["hit"] = hit
            if len(r) == len(H):
                x["done"] = True
            calc += 1
    # statistics per pattern and per pattern × confidence
    st = defaultdict(lambda: {"n": 0, "w24": 0, "s24": 0.0, "n24": 0, "w72": 0, "s72": 0.0, "n72": 0, "tg": 0, "iv": 0})
    for x in items:
        src = "bt" if x.get("bt") else "live"
        for key in (x["type"], f"{x['type']}|{x.get('conf')}", "_all", f"_{src}", f"{x['type']}|{src}"):
            a = st[key]
            a["n"] += 1
            r = x.get("r") or {}
            if "24h" in r:
                a["n24"] += 1
                a["w24"] += r["24h"] > 0
                a["s24"] += r["24h"]
            if "72h" in r:
                a["n72"] += 1
                a["w72"] += r["72h"] > 0
                a["s72"] += r["72h"]
            a["tg"] += x.get("hit") == "target"
            a["iv"] += x.get("hit") == "inval"
    stats = {}
    for k, a in st.items():
        stats[k] = {"n": a["n"], "n24": a["n24"], "win24": round(a["w24"] * 100 / a["n24"]) if a["n24"] else None,
                    "avg24": round(a["s24"] / a["n24"], 2) if a["n24"] else None, "n72": a["n72"],
                    "win72": round(a["w72"] * 100 / a["n72"]) if a["n72"] else None, "avg72": round(a["s72"] / a["n72"], 2) if a["n72"] else None,
                    "target_first": a["tg"], "inval_first": a["iv"]}
    items.sort(key=lambda x: x["t"], reverse=True)
    first = min((x["t"] for x in items), default=None)
    live = [x for x in items if not x.get("bt")]
    json.dump({"updated_at": NOW.isoformat(), "since": first, "live_since": min((x["t"] for x in live), default=None), "backfilled": log.get("backfilled"),
               "items": live[:3000] + [x for x in items if x.get("bt")][:4000], "stats": stats}, open(OUT, "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    json.dump({"updated_at": NOW.isoformat(), "since": first, "live_since": min((x["t"] for x in live), default=None), "backfilled": log.get("backfilled"),
               "stats": stats, "recent": [{k: x.get(k) for k in ("coin", "type", "dir", "conf", "t", "price", "r", "hit", "mfe", "mae")} for x in live[:60]]},
              open(os.path.join(D, "scanstats.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"scanlog: +{added} new, {len(items)} logged since {first}, outcomes updated {calc} ({len(coins)} coins) | all: {stats.get('_all')}")


if __name__ == "__main__":
    main()
