#!/usr/bin/env python3
"""Which kind of strategy did well, and which did badly, in each market regime — measured, not opined.

Four plain strategy families are run on BTC daily closes since 2018, the same rules the strategy lab offers:
    trend   long while the close is above its 50-day average (exit when it crosses below)
    dip     long when RSI(14) < 35, out when RSI(14) > 55 (buying pullbacks)
    short   short while the close is below its 50-day average
    hold    always long (the yardstick)
Each day is tagged with the rule-layer regime of that day (data/regime.json "rule", the label the site shows,
known at that day's close). A position decided at the close of day t earns the return to the close of t+1,
minus 0.15 % on every change of position (0.3 % a round trip, as in the Signal Truth Lab).

Per regime and family: annualised mean net return, the share of days in the market, and a 95 % interval
from a block bootstrap (10-day blocks, so streaky days are not treated as independent). A family "worked" in a
regime if the whole interval is above zero and "hurt" if it is below zero; anything else is "unclear".

Input: data/regime.json (px closes), data/lab_context.json (daily rule labels).  Output: data/regime_strats.json
Every family carries the strategy-lab settings that reproduce it with entries only in that regime (#hash link).
"""
import base64
import json
import math
import os
import random
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reality_common as R  # noqa: E402

COST = 0.0015
BLOCK, REPS, SEED = 10, 1000, 7
MIN_DAYS = 60
LABELS = ["bull", "bear", "sideways"]

FAM = {
    "trend": {"n": ("دنبال‌کردن روند (بالای میانگین ۵۰ روزه)", "شوێنکەوتنی ڕەوت (سەرووی ناوەندی ٥٠ ڕۆژە)", "Trend following (above the 50-day average)"),
              "side": "long",
              "entry": [{"a": {"k": "close"}, "op": ">", "b": {"k": "sma", "p": 50}}],
              "exit": [{"a": {"k": "close"}, "op": "xb", "b": {"k": "sma", "p": 50}}]},
    "dip": {"n": ("خرید اصلاح (RSI زیر ۳۵)", "کڕینی داکەوتن (RSI لە خوار ٣٥)", "Buying dips (RSI below 35)"),
            "side": "long",
            "entry": [{"a": {"k": "rsi", "p": 14}, "op": "<", "b": {"k": "num", "v": 35}}],
            "exit": [{"a": {"k": "rsi", "p": 14}, "op": ">", "b": {"k": "num", "v": 55}}]},
    "short": {"n": ("شورت در روند نزولی (زیر میانگین ۵۰ روزه)", "شۆرت لە ڕەوتی خوارەوەدا (خوار ناوەندی ٥٠ ڕۆژە)", "Shorting downtrends (below the 50-day average)"),
              "side": "short",
              "entry": [{"a": {"k": "close"}, "op": "<", "b": {"k": "sma", "p": 50}}],
              "exit": [{"a": {"k": "close"}, "op": "xa", "b": {"k": "sma", "p": 50}}]},
    "hold": {"n": ("نگه‌داشتن (معیار مقایسه)", "هەڵگرتن (پێوەری بەراورد)", "Buy and hold (yardstick)"), "side": "long", "entry": [], "exit": []},
}


def sma(c, p):
    out, s = [None] * len(c), 0.0
    for i, x in enumerate(c):
        s += x
        if i >= p:
            s -= c[i - p]
        if i >= p - 1:
            out[i] = s / p
    return out


def rsi(c, p=14):
    """Wilder RSI, the same recursion as assets/strategy-lab.js"""
    out, ag, al = [None] * len(c), 0.0, 0.0
    for i in range(1, len(c)):
        d = c[i] - c[i - 1]
        g, lo = max(d, 0.0), max(-d, 0.0)
        if i <= p:
            ag += g
            al += lo
            if i == p:
                ag /= p
                al /= p
                out[i] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
        else:
            ag = (ag * (p - 1) + g) / p
            al = (al * (p - 1) + lo) / p
            out[i] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    return out


def positions(c):
    """per day: {family: position at that close} (+1 long, -1 short, 0 flat)"""
    m50, r14 = sma(c, 50), rsi(c, 14)
    pos = {k: [0] * len(c) for k in FAM}
    st = {k: 0 for k in FAM}
    for i in range(len(c)):
        if m50[i] is not None:
            above = c[i] > m50[i]
            st["trend"] = 1 if above else 0
            st["short"] = -1 if not above else 0
        if r14[i] is not None:
            if st["dip"] == 0 and r14[i] < 35:
                st["dip"] = 1
            elif st["dip"] == 1 and r14[i] > 55:
                st["dip"] = 0
        st["hold"] = 1
        for k in FAM:
            pos[k][i] = st[k]
    return pos


def block_ci(x, rng):
    n = len(x)
    if n < MIN_DAYS:
        return None, None
    nb = max(1, n // BLOCK)
    means = []
    for _ in range(REPS):
        s, m = 0.0, 0
        for _ in range(nb):
            j = rng.randrange(0, n - BLOCK + 1) if n > BLOCK else 0
            seg = x[j:j + BLOCK]
            s += sum(seg)
            m += len(seg)
        means.append(s / m)
    means.sort()
    return means[int(0.025 * REPS)], means[int(0.975 * REPS) - 1]


def lab_link(fam, label):
    f = FAM[fam]
    st = {"coin": "BTC", "tf": "1d", "from": "2018-03-01", "side": f["side"], "entryMode": "all", "exitMode": "any",
          "sl": 0, "tp": 0, "hold": 0, "fee": 0.1, "slip": 0.05,
          "entry": f["entry"] + [{"a": {"k": "rule"}, "op": "is", "b": {"k": "reg", "v": label}}], "exit": f["exit"]}
    return "/strategy-lab/#" + base64.b64encode(json.dumps(st, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).decode("ascii")


def main():
    rg = R.load("regime.json", {})
    lc = R.load("lab_context.json", {})
    px = rg.get("px") or {}
    if not px.get("c") or not lc.get("rule"):
        print("regime_strats: missing px or rule labels")
        return
    d0 = datetime.strptime(px["from"], "%Y-%m-%d")
    dates = [(d0 + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(len(px["c"]))]
    c = px["c"]
    l0 = datetime.strptime(lc["from"], "%Y-%m-%d")
    labs = lc.get("labels") or ["bull", "bear", "sideways", "high_vol"]
    rule = {}
    for i, v in enumerate(lc["rule"]):
        if v is not None:
            rule[(l0 + timedelta(days=i)).strftime("%Y-%m-%d")] = labs[v]
    pos = positions(c)
    rows = {lb: {k: [] for k in FAM} for lb in LABELS}
    first = last = None
    for i in range(1, len(c) - 1):
        lb = rule.get(dates[i])
        if lb not in rows:
            continue
        r = c[i + 1] / c[i] - 1
        for k in FAM:
            p, pp = pos[k][i], pos[k][i - 1]
            rows[lb][k].append(p * r - COST * abs(p - pp))
        first = first or dates[i]
        last = dates[i]
    rng = random.Random(SEED)
    by = {}
    for lb in LABELS:
        fams = {}
        for k in FAM:
            x = rows[lb][k]
            if not x:
                continue
            lo, hi = block_ci(x, rng)
            inm = sum(1 for i in range(1, len(c) - 1) if rule.get(dates[i]) == lb and pos[k][i] != 0)
            fams[k] = {"ann": round(100 * 365 * sum(x) / len(x), 1),
                       "lo": None if lo is None else round(100 * 365 * lo, 1), "hi": None if hi is None else round(100 * 365 * hi, 1),
                       "in_mkt": round(100 * inm / len(x), 0),
                       "verdict": "unclear" if lo is None else "works" if lo > 0 else "hurts" if hi < 0 else "unclear",
                       "lab": None if k == "hold" else lab_link(k, lb)}
        n = len(rows[lb]["hold"])
        ranked = sorted((k for k in fams if k != "hold"), key=lambda k: -fams[k]["ann"])
        by[lb] = {"days": n, "fam": fams, "best": ranked[0] if ranked else None, "worst": ranked[-1] if ranked else None}
    out = {"updated_at": R.iso(datetime.now(timezone.utc)), "coin": "BTC", "basis": "rule", "cost_round_trip_pct": 2 * 100 * COST,
           "from": first, "to": last, "block": BLOCK, "reps": REPS, "min_days": MIN_DAYS,
           "families": {k: {"n": list(v["n"]), "side": v["side"]} for k, v in FAM.items()},
           "now": (rg.get("rule") or {}).get("now", {}).get("label"), "by": by}
    R.save("regime_strats.json", out)
    for lb in LABELS:
        b = by[lb]
        print(f"regime_strats {lb}: {b['days']} days | " + " | ".join(f"{k} {v['ann']:+.0f}% [{v['lo']},{v['hi']}] {v['verdict']}"
                                                                 for k, v in b["fam"].items()))


if __name__ == "__main__":
    main()
