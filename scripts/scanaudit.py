#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Scanner audit — does each scanner pattern do better than the same coins at any other hour?

data/scanlog.json holds every scanner finding (live + 40-day backfill). Its raw "win %" says nothing on its own: in a
falling market every bearish signal "wins". So for every pattern we compare the signed 24h move after its findings
with the signed 24h move of the SAME coins, in the SAME direction, at other hours of the window.

  entry = the open of the first full hour at or after the finding; exit = the open 24 hours later; sign = +1 bull, −1 bear
  observed = mean signed move over the pattern's findings
  baseline = every finding shifted together by k hours (circular, k = 24 … W−24, ALL shifts — an exact test).
             Shifting all findings by one common offset keeps their clustering (many coins firing in the same hour),
             so the market-wide co-movement that makes findings dependent is kept in the baseline too.
  p        = two-sided: share of shifts whose mean is at least as far from the shifts' median as the observed mean.

Verdict (only by p < 0.05 and n ≥ MIN_N): "better", "worse" (shown as "under review" — kept visible, not hidden),
"no_edge", "too_few". Writes data/scanaudit.json. Needs Binance (CI); with no market access it leaves the old file alone.
"""
import json
import os
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, "data", "scanlog.json")
OUT = os.path.join(ROOT, "data", "scanaudit.json")
H = 3600_000
HOLD = 24
MIN_N = 30
ALPHA = 0.05


def load(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return d


def ms(iso):
    return int(datetime.fromisoformat(iso).timestamp() * 1000)


def audit(findings, bars, t0, t1):
    """findings: [{coin,type,dir,t_ms}]; bars: {coin: {hour_ms: open}}; grid [t0, t1) in whole hours.
    Returns {type: {...}} plus "_all"."""
    W = (t1 - t0) // H
    if W < 3 * HOLD:
        return {}
    ret = {}                                           # coin -> list of 24h moves on the grid (None if missing)
    for c, op in bars.items():
        r = []
        for i in range(W):
            a, b = op.get(t0 + i * H), op.get(t0 + (i + HOLD) * H)
            r.append(b / a - 1 if a and b else None)
        ret[c] = r
    groups = defaultdict(list)
    for f in findings:
        if f["coin"] not in ret:
            continue
        i = -(-(f["t_ms"] - t0) // H)                  # first full hour at or after the finding
        if not 0 <= i < W or ret[f["coin"]][i] is None:
            continue
        s = -1 if f.get("dir") == "bear" else 1
        groups[f["type"]].append((f["coin"], i, s))
        groups["_all"].append((f["coin"], i, s))
    out = {}
    for ty, g in groups.items():
        obs = sum(s * ret[c][i] for c, i, s in g) / len(g) * 100
        win = sum(s * ret[c][i] > 0 for c, i, s in g) / len(g) * 100
        means = []
        for k in range(HOLD, W - HOLD + 1):
            v = [s * ret[c][(i + k) % W] for c, i, s in g if ret[c][(i + k) % W] is not None]
            if v:
                means.append(sum(v) / len(v) * 100)
        if not means:
            continue
        ms_ = sorted(means)
        mid = ms_[len(ms_) // 2]
        p = sum(abs(m - mid) >= abs(obs - mid) - 1e-12 for m in means) / len(means)
        lo, hi = ms_[int(0.025 * (len(ms_) - 1))], ms_[int(0.975 * (len(ms_) - 1))]
        if len(g) < MIN_N:
            verdict = "too_few"
        elif p < ALPHA:
            verdict = "better" if obs > mid else "worse"
        else:
            verdict = "no_edge"
        out[ty] = {"n": len(g), "obs": round(obs, 2), "win": round(win, 1), "mid": round(mid, 2), "lo": round(lo, 2),
                   "hi": round(hi, 2), "p": round(p, 4), "shifts": len(means), "verdict": verdict}
    return out


def fetch_bars(coin, t0, t1, fetch=None):
    if fetch is None:
        from market import klines as fetch
    op, start = {}, t0
    for _ in range(4):
        part = fetch(coin, "1h", 1000, start=start)
        if not part:
            break
        for b in part:
            op[b["t"]] = b["o"]
        if part[-1]["t"] >= t1 or len(part) < 1000:
            break
        start = part[-1]["t"] + H
    return op


def main():
    log = load(LOG, {})
    items = log.get("items", [])
    if not items:
        print("scanaudit: no scanlog")
        return
    fs = [{"coin": x["coin"], "type": x["type"], "dir": x.get("dir"), "t_ms": ms(x["t"])} for x in items if x.get("t")]
    now = int(time.time() * 1000)
    t0 = (min(f["t_ms"] for f in fs) // H) * H
    t1 = (now // H) * H - HOLD * H                       # last hour whose 24h exit already exists
    bars, failed = {}, 0
    for c in sorted({f["coin"] for f in fs}):
        try:
            op = fetch_bars(c, t0, now)
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"scanaudit {c}: {e}")
            op = {}
        if op:
            bars[c] = op
        time.sleep(0.05)
    if not bars:
        print("scanaudit: no market data — keeping the old file")
        return
    res = audit(fs, bars, t0, t1)
    json.dump({"updated_at": datetime.now(timezone.utc).isoformat(),
               "window": [datetime.fromtimestamp(t0 / 1000, timezone.utc).isoformat(),
                          datetime.fromtimestamp(t1 / 1000, timezone.utc).isoformat()],
               "hold_h": HOLD, "alpha": ALPHA, "min_n": MIN_N, "coins": len(bars), "coins_failed": failed,
               "method": "signed 24h move after findings vs the same coins/directions shifted together by every k hours (exact circular-shift test)",
               "patterns": res}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("scanaudit:", {k: (v["n"], v["obs"], v["mid"], v["p"], v["verdict"]) for k, v in res.items()})


if __name__ == "__main__":
    main()
