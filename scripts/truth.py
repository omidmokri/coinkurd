#!/usr/bin/env python3
"""Signal Truth Lab — one strict, public audit of every signal source on the site.

What it adds on top of the existing ledger / scanner audit:
  1. Costs: every result is shown NET of a round trip (fee + slippage on both sides).
  2. Backtest vs live: the scanner's reconstructed history (bt) and its real-time log are judged
     separately; only live results count as out-of-sample.
  3. Day-clustered bootstrap: findings on the same day move together, so days (not findings) are resampled.
  4. Multiple testing: with dozens of pattern x horizon tests, some look good by luck. Benjamini-Hochberg
     (false-discovery rate) and Holm (family-wise) corrections are applied across the whole family.
  5. Calibration: scanner findings are turned into probabilities using the BACKTEST hit rate of their
     pattern+confidence, then scored on LIVE outcomes (Brier score, skill vs the base rate, reliability bins).
     Crowd votes and council confidence are scored the same way where they exist.
  6. Regime: live results split by the HMM regime of the day (data/regime.json, out-of-sample).
  7. Stability: weekly results, and the share of weeks with a positive net mean.
  8. Negative results are published with the same prominence as positive ones.

Input:  data/scanlog.json, data/scanaudit.json, data/signals.json, data/ledger.json, data/predict.json, data/regime.json
Output: data/truth.json
"""
import math
import os
import random
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reality_common as R  # noqa: E402

FEE = 0.10          # % per side (typical spot taker fee)
SLIP = 0.05         # % per side (slippage on liquid pairs)
COST = 2 * (FEE + SLIP)   # % per round trip
HORIZONS = ("6h", "24h", "72h")
MAIN_H = "24h"
B = 2000            # bootstrap resamples
MIN_N = 30          # below this a verdict is "too few"
MIN_DAYS = 20       # and fewer distinct days than this is too few as well (days are the real sample)
FDR_Q = 0.10
ALPHA = 0.05
REG = ["bull", "bear", "sideways", "high_vol"]


# ------------------------------------------------------------------ statistics
def day_of(t):
    return str(t)[:10]


def cluster_boot(pairs, seed=7):
    """pairs: [(day, value)] -> mean, 95% CI and one-sided p for mean > 0, resampling whole days"""
    by = defaultdict(list)
    for d, v in pairs:
        by[d].append(v)
    days = list(by.values())
    sums = [sum(x) for x in days]
    cnts = [len(x) for x in days]
    n = sum(cnts)
    m = sum(sums) / n
    if len(days) < 3:
        return m, None, None, None
    rng = random.Random(seed)
    k = len(days)
    bs = []
    for _ in range(B):
        s = c = 0.0
        for _ in range(k):
            j = rng.randrange(k)
            s += sums[j]
            c += cnts[j]
        bs.append(s / c)
    bs.sort()
    lo, hi = bs[int(0.025 * B)], bs[int(0.975 * B) - 1]
    # one-sided p from the same bootstrap distribution as the CI, so the two never disagree
    p = (1 + sum(1 for x in bs if x <= 0)) / (B + 1)
    return m, lo, hi, p


def bh(ps, q=FDR_Q):
    """Benjamini-Hochberg: returns adjusted p-values (same order)"""
    idx = sorted(range(len(ps)), key=lambda i: ps[i])
    n = len(ps)
    adj = [1.0] * n
    run = 1.0
    for rank in range(n, 0, -1):
        i = idx[rank - 1]
        run = min(run, ps[i] * n / rank)
        adj[i] = min(1.0, run)
    return adj


def holm(ps):
    idx = sorted(range(len(ps)), key=lambda i: ps[i])
    n = len(ps)
    adj = [1.0] * n
    run = 0.0
    for rank, i in enumerate(idx):
        run = max(run, min(1.0, (n - rank) * ps[i]))
        adj[i] = run
    return adj


def summ(vals):
    if not vals:
        return {"n": 0}
    return {"n": len(vals), "mean": round(sum(vals) / len(vals), 3), "median": round(R.median(vals), 3),
            "win": round(100 * sum(1 for v in vals if v > 0) / len(vals), 1)}


def week_of(t):
    d = R.parse_iso(t if "T" in t else t + "T00:00:00+00:00")
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


# ------------------------------------------------------------------ 1. scanner patterns
def scanner(regime_daily):
    log = R.load("scanlog.json", {})
    items = [x for x in log.get("items", []) if x.get("r")]
    audit = (R.load("scanaudit.json", {}).get("patterns") or {})
    types = sorted({x["type"] for x in items})
    tests, rows = [], {}
    for tp in types + ["_all"]:
        sel = [x for x in items if tp == "_all" or x["type"] == tp]
        row = {"dir": (sel[0]["dir"] if tp != "_all" else "mixed"), "bt": {}, "live": {}}
        for part, flt in (("bt", lambda x: x.get("bt")), ("live", lambda x: not x.get("bt"))):
            ps = [x for x in sel if flt(x)]
            for h in HORIZONS:
                pairs = [(day_of(x["t"]), x["r"][h] - COST) for x in ps if x["r"].get(h) is not None]
                gross = [x["r"][h] for x in ps if x["r"].get(h) is not None]
                if not pairs:
                    row[part][h] = {"n": 0}
                    continue
                m, lo, hi, p = cluster_boot(pairs)
                cell = {"n": len(pairs), "days": len({d for d, _ in pairs}), "gross": round(sum(gross) / len(gross), 3),
                        "net": round(m, 3), "lo": None if lo is None else round(lo, 3), "hi": None if hi is None else round(hi, 3),
                        "p": None if p is None else round(p, 4),
                        "win_net": round(100 * sum(1 for _, v in pairs if v > 0) / len(pairs), 1)}
                row[part][h] = cell
                if tp != "_all" and p is not None and len(pairs) >= MIN_N and cell["days"] >= MIN_DAYS:
                    tests.append((tp, part, h, p))
        # weekly stability on everything (bt + live), main horizon, net
        wk = defaultdict(list)
        for x in sel:
            if x["r"].get(MAIN_H) is not None:
                wk[week_of(x["t"])].append(x["r"][MAIN_H] - COST)
        weeks = [{"w": w, "n": len(v), "net": round(sum(v) / len(v), 3)} for w, v in sorted(wk.items()) if len(v) >= 5]
        row["weeks"] = weeks
        row["weeks_pos"] = round(100 * sum(1 for w in weeks if w["net"] > 0) / len(weeks), 1) if weeks else None
        # regime split, live only
        rg = defaultdict(list)
        for x in sel:
            if not x.get("bt") and x["r"].get(MAIN_H) is not None:
                li = regime_daily.get(day_of(x["t"]))
                if li is not None:
                    rg[REG[li]].append(x["r"][MAIN_H] - COST)
        row["regime"] = {k: summ(v) for k, v in rg.items()}
        a = audit.get(tp) or {}
        row["shift"] = {"p": a.get("p"), "obs": a.get("obs"), "mid": a.get("mid"), "verdict": a.get("verdict")} if a else None
        rows[tp] = row

    # multiple-testing corrections across the whole family (pattern x part x horizon)
    if tests:
        ps = [t[3] for t in tests]
        for (tp, part, h, _), q, hh in zip(tests, bh(ps), holm(ps)):
            rows[tp][part][h]["p_bh"] = round(q, 4)
            rows[tp][part][h]["p_holm"] = round(hh, 4)

    # verdicts at the main horizon, negatives included. Live results decide once there are enough days;
    # until then the backtest decides and the page says the verdict still awaits live confirmation.
    enough = lambda c: c.get("n", 0) >= MIN_N and c.get("days", 0) >= MIN_DAYS  # noqa: E731
    for tp, row in rows.items():
        lv, bt = row["live"].get(MAIN_H, {}), row["bt"].get(MAIN_H, {})
        basis = "live" if enough(lv) else "bt" if enough(bt) else None
        c = lv if basis == "live" else bt
        if basis is None:
            v = "too_few"
        elif c.get("p_holm", 1) < ALPHA and c["net"] > 0:
            v = "edge_strong"
        elif c.get("p_bh", 1) < FDR_Q and c["net"] > 0:
            v = "edge"
        elif c.get("hi") is not None and c["hi"] < 0:
            v = "loses"
        elif c["net"] > 0:
            v = "maybe"
        else:
            v = "no_edge"
        row["verdict"], row["basis"] = v, basis
        # live agrees with the backtest? (sign of the net mean)
        row["live_agrees"] = (None if not (lv.get("n") and bt.get("n")) else (lv["net"] > 0) == (bt["net"] > 0))
        row["decay"] = (round(lv["net"] - bt["net"], 3) if lv.get("n") and bt.get("n") else None)
    return rows, len(tests), log.get("live_since"), log.get("since")


# ------------------------------------------------------------------ 2. calibration (probabilities scored live)
def calibration():
    log = R.load("scanlog.json", {})
    items = [x for x in log.get("items", []) if x.get("r") and x["r"].get(MAIN_H) is not None]
    bt = [x for x in items if x.get("bt")]
    lv = [x for x in items if not x.get("bt")]
    if not bt or not lv:
        return None
    hit = lambda x: 1 if x["r"][MAIN_H] - COST > 0 else 0  # noqa: E731
    grp = defaultdict(list)
    for x in bt:
        grp[(x["type"], x["conf"])].append(hit(x))
    base_bt = sum(hit(x) for x in bt) / len(bt)
    # shrink small groups toward the overall backtest rate (Beta prior worth 20 findings)
    prob = {k: (sum(v) + 20 * base_bt) / (len(v) + 20) for k, v in grp.items()}
    fc = [(prob.get((x["type"], x["conf"]), base_bt), hit(x)) for x in lv]
    brier = sum((p - o) ** 2 for p, o in fc) / len(fc)
    clim = sum(o for _, o in fc) / len(fc)
    brier_clim = sum((base_bt - o) ** 2 for _, o in fc) / len(fc)   # forecast = backtest base rate, also out-of-sample
    bins = []
    for lo in (0.0, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6):
        hi = {0.0: 0.3, 0.6: 1.01}.get(lo, round(lo + 0.05, 2))
        sel = [(p, o) for p, o in fc if lo <= p < hi]
        if len(sel) >= 10:
            bins.append({"lo": lo, "hi": min(hi, 1.0), "n": len(sel), "pred": round(100 * sum(p for p, _ in sel) / len(sel), 1),
                         "real": round(100 * sum(o for _, o in sel) / len(sel), 1)})
    conf = {}
    for c in ("low", "medium", "high"):
        a = [hit(x) for x in lv if x["conf"] == c]
        b = [hit(x) for x in bt if x["conf"] == c]
        if a or b:
            conf[c] = {"live_n": len(a), "live_win": round(100 * sum(a) / len(a), 1) if a else None,
                       "bt_n": len(b), "bt_win": round(100 * sum(b) / len(b), 1) if b else None}
    return {"n": len(fc), "brier": round(brier, 4), "brier_base": round(brier_clim, 4),
            "skill": round(1 - brier / brier_clim, 4) if brier_clim else None,
            "live_rate": round(100 * clim, 1), "bt_rate": round(100 * base_bt, 1), "bins": bins, "conf": conf}


def crowd_brier():
    out = []
    for r in R.load("predict.json", {}).get("rounds", []):
        t = r.get("tally") or [0, 0]
        if r.get("result") is None or not r.get("n") or sum(t) == 0:
            continue
        p_up = t[0] / sum(t)
        o = 1 if r["result"] == 0 else 0      # result is the index of the winning option; option 0 = higher
        out.append({"id": r["id"], "p_up": round(p_up, 3), "up": o, "n": r["n"], "brier": round((p_up - o) ** 2, 4)})
    if not out:
        return {"n": 0}
    return {"n": len(out), "brier": round(sum(x["brier"] for x in out) / len(out), 4), "rounds": out[-20:]}


def council_conf():
    led = R.load("ledger.json", {})
    res = led.get("results", {})
    by = defaultdict(list)
    for e in led.get("entries", []):
        if not e["src"].startswith("council.") or e["id"] not in res:
            continue
        r = res[e["id"]]
        if r.get("outcome") not in ("win", "loss"):
            continue
        try:
            c = int(str(e.get("note", "")).split("confidence")[1].split("/")[0])
        except (IndexError, ValueError):
            continue
        by[c].append(1 if r["outcome"] == "win" else 0)
    return {str(c): {"n": len(v), "win": round(100 * sum(v) / len(v), 1)} for c, v in sorted(by.items())}


# ------------------------------------------------------------------ 3. ledger sources and server signals, net of costs
def ledger_net():
    led = R.load("ledger.json", {})
    res = led.get("results", {})
    by = defaultdict(list)
    for e in led.get("entries", []):
        r = res.get(e["id"])
        if r and r.get("edge") is not None:
            by[e["src"]].append((day_of(e["t0"]), r["edge"] - COST, r.get("outcome")))
    out = {}
    for src, v in by.items():
        m, lo, hi, p = cluster_boot([(d, x) for d, x, _ in v])
        nd = len({d for d, *_ in v})
        out[src] = {"n": len(v), "days": nd, "net": round(m, 3), "lo": None if lo is None else round(lo, 3), "hi": None if hi is None else round(hi, 3),
                    "p": None if p is None else round(p, 4), "acc": round(100 * sum(1 for *_, o in v if o == "win") / len(v), 1),
                    "verdict": "too_few" if len(v) < MIN_N or nd < MIN_DAYS else ("loses" if hi is not None and hi < 0 else "no_edge" if (p or 1) > ALPHA else "edge")}
    return out


def btc_baseline(t_from, h_days):
    """average BTC return over every h-day window starting in the same period: what a random day would have given"""
    rp = R.load("regime.json", {}).get("px") or {}
    if rp.get("c"):
        d0 = datetime.strptime(rp["from"], "%Y-%m-%d")
        px = {(d0 + timedelta(days=i)).strftime("%Y-%m-%d"): c for i, c in enumerate(rp["c"])}
    else:
        px = (R.load("hype_store.json", {}).get("prices") or {}).get("BTC") or {}
    ds = sorted(d for d in px if d >= t_from[:10])
    if not ds or ds[0] > t_from[:10]:
        return None          # no price history for the whole period: no baseline rather than a misleading one
    rs = [px[ds[i + h_days]] / px[ds[i]] - 1 for i in range(len(ds) - h_days)]
    return round(100 * sum(rs) / len(rs), 3) if rs else None


def server_signals():
    sg = R.load("signals.json", {}).get("signals", [])
    out = {}
    t_from = min((x["t"] for x in sg), default="")
    for ind in sorted({x["ind"] for x in sg}):
        for side in ("long", "short"):
            sel = [x for x in sg if x["ind"] == ind and x["side"] == side]
            if not sel:
                continue
            cell = {}
            for h in ("7d", "30d", "90d"):
                vals = [(1 if side == "long" else -1) * x["out"]["r"][h] - COST for x in sel if (x.get("out") or {}).get("r", {}).get(h) is not None]
                if vals:
                    cell[h] = summ(vals)
                    base = btc_baseline(t_from, int(h[:-1]))
                    if base is not None:
                        # a random-day trade in the same direction, same costs
                        cell[h]["base"] = round((base if side == "long" else -base) - COST, 3)
            out[f"{ind}|{side}"] = {"ind": ind, "side": side, "n": len(sel), "res": cell}
    return out


# ------------------------------------------------------------------ main
def main():
    reg = R.load("regime.json", {})
    daily = reg.get("daily") or {}
    pats, n_tests, live_since, since = scanner(daily)
    out = {
        "version": 1, "updated_at": R.iso(datetime.now(timezone.utc)),
        "cost": {"fee_side": FEE, "slip_side": SLIP, "round_trip": COST},
        "rules": {"main_h": MAIN_H, "boot": B, "min_n": MIN_N, "fdr_q": FDR_Q, "alpha": ALPHA, "tests": n_tests},
        "scanner": {"since": since, "live_since": live_since, "patterns": pats},
        "calibration": {"scanner": calibration(), "crowd": crowd_brier(), "council": council_conf()},
        "ledger": ledger_net(),
        "signals": server_signals(),
        "regime_now": (reg.get("now") or {}).get("top"),
    }
    vs = defaultdict(int)
    for k, r in pats.items():
        if k != "_all":
            vs[r["verdict"]] += 1
    out["summary"] = dict(vs)
    R.save("truth.json", out)
    cal = out["calibration"]["scanner"] or {}
    print(f"truth: {len(pats) - 1} patterns, {n_tests} tests, verdicts {dict(vs)}, "
          f"brier {cal.get('brier')} vs base {cal.get('brier_base')} (skill {cal.get('skill')})")


if __name__ == "__main__":
    main()
