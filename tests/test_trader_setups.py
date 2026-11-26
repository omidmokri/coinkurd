#!/usr/bin/env python3
"""scripts/trader_setups.py on made-up candles: the replay trades a plan exactly as published (layers, worst order
inside a candle, break-even after the first target, costs), the bar is applied as written, live setups stop being
live once their stop or first target is hit. Run: python3 tests/test_trader_setups.py"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import trader_setups as TS  # noqa: E402

bad = []


def ok(c, msg):
    if not c:
        bad.append(msg)


def bar(t, o, h, l_, c):
    return {"t": t * TS.H4, "o": o, "h": h, "l": l_, "c": c, "v": 1}


# Wilson: known values
lo, hi = TS.wilson(50, 100, 1.96)
ok(abs(lo - 0.4038) < 1e-3 and abs(hi - 0.5962) < 1e-3, f"wilson 50/100: {lo} {hi}")
ok(TS.wilson(0, 0) == (0.0, 0.0) or TS.wilson(0, 0)[0] == 0, "wilson n=0")

# a long plan: entry 100, layers 100 / 99 / 98, stop 95, targets 105 / 110 / 115
plan = {"d": 1, "layers": [100.0, 99.0, 98.0], "weights": [0.4, 0.35, 0.25], "stop": 95.0, "tps": [105.0, 110.0, 115.0],
        "avg_all": 99.15, "atr": 2.0, "r1": 5.0}
cost = TS.RULES["cost_side"] / 100

# 1) the bar after the signal touches both the stop and the first target: the stop counts (pessimistic)
k = [bar(0, 100, 100, 100, 100), bar(1, 100, 106, 94, 100)]
r = TS.simulate(k, 0, plan)
ok(r and r["out"] == "stop" and r["hit"] == 0 and r["R"] < -0.99, f"worst order: {r}")

# 2) only layer 1 fills, then all three targets in one candle: R is the published arithmetic
k = [bar(0, 100, 100, 100, 100), bar(1, 100, 101, 99.5, 100.5), bar(2, 100.5, 116, 100.2, 115)]
r = TS.simulate(k, 0, plan)
risk = sum(w * abs(p - 95) for w, p in zip(plan["weights"], plan["layers"]))
q = 0.4
pnl = -q * 100 * cost
for share, tp in zip((0.4, 0.35, 0.25), (105, 110, 115)):
    pnl += q * share * (tp - 100) - q * share * tp * cost
ok(r and r["out"] == "tp3" and abs(r["R"] - pnl / risk) < 1e-9, f"three targets: {r} vs {pnl / risk}")

# 3) target 1, then back to the entry: the rest leaves at break-even (minus costs), never at the old stop
k = [bar(0, 100, 100, 100, 100), bar(1, 100, 105.5, 99.6, 105), bar(2, 105, 105.2, 99.0, 99.5)]
r = TS.simulate(k, 0, plan)
ok(r and r["out"] == "be" and r["hit"] == 1 and r["R"] > 0, f"break-even after TP1: {r}")

# 4) live_state: open while nothing is hit, closed once the stop or the first target is
k = [bar(0, 100, 100, 100, 100), bar(1, 100.2, 101, 98.8, 100)]
s = TS.live_state(k, 0, plan)
ok(s["open"] and s["age"] == 1 and s["filled"] == 2 and s["l1"] == 100.2, f"live open: {s}")
ok(TS.live_state(k + [bar(2, 100, 100.5, 94.9, 96)], 0, plan)["open"] is False, "live: stop hit")
ok(TS.live_state(k + [bar(2, 100, 105.1, 99.9, 104)], 0, plan)["open"] is False, "live: target 1 hit")
ok(TS.live_state(k[:1], 0, plan) == {"open": True, "age": 0, "filled": 0, "l1": None}, "live: fresh")

# 5) the bar, as written
good = {"n": 60, "ev_lo": 0.01, "p1_lo": 0.40}
ok(TS.qualifies(good), "bar: passes")
ok(not TS.qualifies(dict(good, n=59)), "bar: too few")
ok(not TS.qualifies(dict(good, ev_lo=0.0)), "bar: ev lower bound must be above zero")
ok(not TS.qualifies(dict(good, p1_lo=0.399)), "bar: p1 lower bound")
ok(not TS.qualifies({"n": 0}), "bar: empty")

# 6) safe leverage keeps the liquidation one ATR beyond the stop
lev = TS.safe_leverage(plan)
liq = plan["avg_all"] * (1 - 1 / lev) / (1 - 0.005)
ok(liq <= plan["stop"] - plan["atr"] + 1e-9, f"leverage {lev}: liquidation {liq}")
liq2 = plan["avg_all"] * (1 - 1 / (lev + 1)) / (1 - 0.005)
ok(lev == 20 or liq2 > plan["stop"] - plan["atr"], f"leverage {lev} is the highest such")

# 7) a whole replay on a made-up trending series: runs, finished trades only, summary keys present
k4, t, p = [], 0, 100.0
import math  # noqa: E402
for i in range(1500):
    o = p
    p = 100 + 0.05 * i + 2 * math.sin(i / 6)
    k4.append({"t": i * TS.H4, "o": o, "h": max(o, p) + 0.3, "l": min(o, p) - 0.3, "c": p, "v": 1})
k1 = []
for j in range(0, len(k4) - 5, 6):
    g = k4[j:j + 6]
    k1.append({"t": g[0]["t"], "o": g[0]["o"], "h": max(x["h"] for x in g), "l": min(x["l"] for x in g), "c": g[-1]["c"], "v": 1})
f = TS.prepare(k4, k1)
tr = TS.backtest(k4, f)
ok(len(tr) > 5, f"replay found {len(tr)} trades")
ok(all(x["t"] + x["bars"] * TS.H4 <= k4[-1]["t"] for x in tr), "only finished trades")
sm = TS.summarise(tr)
for key in ("n", "ev", "ev_lo", "ev_hi", "p1", "p1_lo", "p1_hi", "p2", "p3", "p_stop", "bars_med"):
    ok(key in sm, f"summary: {key}")
ok(sm["p1"] >= sm["p2"] >= sm["p3"], "targets are reached in order")

for b in bad:
    print("FAIL", b)
print(f"trader setups: {len(bad)} problems")
sys.exit(1 if bad else 0)
