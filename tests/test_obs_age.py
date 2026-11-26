#!/usr/bin/env python3
"""scripts/obs_age.py and assets/obs/agemath.js — SOPR and HODL waves — offline.

  * build(): the 23 cohorts fold into 13 bands that add up to 100 % on every day; the day still running is dropped;
    series of different lengths are refused;
  * the bands' total is held against Coin Metrics' supply, and a file that is off by more than 0.5 % is refused;
  * the summary: the 7-day mean, which side of 1 it is on and for how many days, the old-coin share and its change;
  * the Python summary (the bot reads it) equals OBAge.summary() (the pages use it), figure by figure, on the real
    file in data/obs/ when there is one, and on made-up data;
  * pack() / unpack() give back the same columns.
Run: python3 tests/test_obs_age.py"""
import json
import os
import random
import subprocess
import sys
import tempfile
from datetime import date, datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import obs_age as A  # noqa: E402

FAIL, N = [], [0]


def check(name, cond, extra=""):
    N[0] += 1
    if not cond:
        FAIL.append(name)
        print("  FAIL", name, f"[{extra}]" if extra != "" else "")


def made_up(n_days=1200, seed=3):
    rnd = random.Random(seed)
    raw = {}
    for c in A.RAW:
        raw["age_%s_supply" % c] = [None, None] + [rnd.uniform(1e4, 1e6) for _ in range(n_days - 2)]
    for i, (_, m) in enumerate(A.SOPR):
        raw[m] = [None] * 20 + [1 + 0.05 * ((k % 50) - 25) / 25 + 0.001 * i for k in range(n_days - 20)]
    raw["price_close"] = [None] * 10 + [100.0 + k for k in range(n_days - 10)]
    raw["lth_supply"] = [None, None] + [3e6] * (n_days - 2)
    return raw


def js_summary(doc):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(doc, f)
        path = f.name
    try:
        code = ("const A=require(%s);const d=JSON.parse(require('fs').readFileSync(%s,'utf8'));"
                "process.stdout.write(JSON.stringify(A.summary(A.unpack(d))))") % (
            json.dumps(os.path.join(ROOT, "assets", "obs", "agemath.js")), json.dumps(path))
        out = subprocess.run(["node", "-e", code], capture_output=True, text=True, timeout=60)
        return json.loads(out.stdout) if out.returncode == 0 else {"error": out.stderr[:300]}
    finally:
        os.unlink(path)


def same(a, b):
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) <= 1e-9 * max(1.0, abs(b))
    return a == b


def main():
    # 1. build on made-up data (index 0 = 2009-01-01; the last day of the answer is "today" and is dropped)
    raw = made_up()
    n_days = len(raw["sopr_24h"])
    today = date.fromordinal(A.DAY0.toordinal() + n_days - 1)
    t0, n, cols = A.build(raw, today)
    check("t0 is the genesis day", t0 == A.T0)
    check("today is dropped", n == n_days - 2 - 1, n)
    check("13 bands", sum(1 for k in cols if k.startswith("b_")) == 13)
    sums = [sum(cols["b_" + k][i] for k in A.BAND_KEYS) for i in range(n)]
    check("bands add up to 100 % (± rounding)", all(abs(s - 10000) <= 7 for s in sums), (min(sums), max(sums)))
    tot = sum(raw["age_%s_supply" % c][2 + 5] for c in A.RAW)
    check("supply is the cohorts' total", abs(cols["sply"][5] - tot) <= 1)
    y10p = sum(raw["age_%s_supply" % c][2 + 5] for c in ("10y_to_12y", "12y_to_15y", "over_15y")) / tot * 10000
    check("the ten-year band folds three cohorts", abs(cols["b_y10p"][5] - round(y10p)) <= 0)
    bad = dict(raw)
    bad["sopr_24h"] = raw["sopr_24h"][:-1]
    try:
        A.build(bad, today)
        check("different lengths are refused", False)
    except ValueError:
        check("different lengths are refused", True)

    # 2. the supply check
    doc_cm = {"t0": t0, "cols": {"sply": {"o": 0, "v": [x for x in cols["sply"]]}}}
    keep = A.OUT_DIR
    with tempfile.TemporaryDirectory() as tmp:
        A.OUT_DIR = tmp
        with open(os.path.join(tmp, "chain_btc.json"), "w") as f:
            json.dump(doc_cm, f)
        check("matching supply passes", A.check_supply(t0, n, cols).get("ok") is True)
        doc_cm["cols"]["sply"]["v"] = [x * 1.01 for x in cols["sply"]]
        with open(os.path.join(tmp, "chain_btc.json"), "w") as f:
            json.dump(doc_cm, f)
        check("supply off by 1 % fails", A.check_supply(t0, n, cols).get("ok") is False)
    A.OUT_DIR = keep

    # 3. the summary, and the same figures from the JavaScript
    s = A.summary(t0, n, cols)
    check("summary has a date", s.get("date") == date.fromordinal(date.fromisoformat(t0).toordinal() + n - 1).isoformat())
    i = n - 1
    m7 = sum(cols["sopr"][i - 6:i + 1]) / 7
    check("7-day mean", abs(s["sopr7"] - round(m7, 5)) < 1e-9, (s.get("sopr7"), m7))
    check("side follows the 7-day mean", s["side"] == ("profit" if m7 >= 1 else "loss"))
    check("old share = the last seven bands", abs(s["old1y"] - round(sum(cols["b_" + k][i] for k in A.BAND_KEYS[6:]) / 100, 2)) < 1e-9)
    doc = A.pack(t0, n, cols, datetime(2026, 1, 1, tzinfo=timezone.utc), {})
    t1, n1, c1 = A.unpack(json.loads(json.dumps(doc)))
    check("pack/unpack round trip", (t1, n1) == (t0, n) and c1 == cols)
    js = js_summary(doc)
    check("JS summary = Python summary (made-up)", same(js, s), (js, s))

    real = os.path.join(ROOT, "data", "obs", "age_btc.json")
    if os.path.exists(real):
        with open(real, encoding="utf-8") as f:
            rd = json.load(f)
        rt, rn, rc = A.unpack(rd)
        ps, js = A.summary(rt, rn, rc), js_summary(rd)
        check("JS summary = Python summary (real file)", same(js, ps), (js, ps))
        check("real file: bands add up", all(abs(sum(rc["b_" + k][q] for k in A.BAND_KEYS) - 10000) <= 7
                                             for q in range(rn) if rc["b_d1"][q] is not None))
        sp = [x for x in rc["sopr"] if x is not None]
        check("real file: SOPR within 0.3 to 3", min(sp) > 0.3 and max(sp) < 3, (min(sp), max(sp)))
        now = os.path.join(ROOT, "data", "obs", "age_now.json")
        if os.path.exists(now):
            with open(now, encoding="utf-8") as f:
                nd = json.load(f)
            check("age_now.json summary = summary of age_btc.json", same(nd.get("summary"), ps))
    print(f"{N[0] - len(FAIL)} of {N[0]} checks passed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
