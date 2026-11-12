#!/usr/bin/env python3
"""Checks assets/pro/ind.js (the /market/ indicators) against an independent Python implementation.

Each reference below is written from the published definition (TradingView's Pine reference for ta.rma, ta.rsi,
ta.dmi, ta.sar, ta.supertrend, Keltner Channels, Ichimoku), not ported from the JavaScript, except ta.sar and
ta.supertrend, whose definition *is* TradingView's reference code. Data: a seeded random walk with flat stretches
(zero ranges, unchanged closes) so the division-by-zero paths run too, plus hand-checked values.

Run: python3 tests/test_pro_ind.py           (needs node)
"""
import json
import math
import os
import random
import statistics
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAN = float("nan")


def isnum(x):
    return x is not None and not (isinstance(x, float) and math.isnan(x))


# ---------------------------------------------------------------- reference implementations
def r_sma(x, n):
    out = []
    for i in range(len(x)):
        w = x[max(0, i - n + 1):i + 1]
        out.append(sum(w) / n if i >= n - 1 and all(isnum(v) for v in w) else NAN)
    return out


def seeded(x, n, alpha):
    """recursive average; the first value is the mean of the first n defined values"""
    out, seed, prev = [], [], None
    for v in x:
        if not isnum(v):
            out.append(NAN)
            continue
        if prev is None:
            seed.append(v)
            if len(seed) == n:
                prev = sum(seed) / n
                out.append(prev)
            else:
                out.append(NAN)
        else:
            prev = alpha * v + (1 - alpha) * prev
            out.append(prev)
    return out


def r_ema(x, n):
    return seeded(x, n, 2 / (n + 1))


def r_rma(x, n):
    return seeded(x, n, 1 / n)


def r_wma(x, n):
    out = []
    for i in range(len(x)):
        if i < n - 1:
            out.append(NAN)
            continue
        w = x[i - n + 1:i + 1]
        out.append(sum(v * (k + 1) for k, v in enumerate(w)) / (n * (n + 1) / 2))
    return out


def window(x, i, n):
    return x[i - n + 1:i + 1] if i >= n - 1 else None


def r_true_range(h, l, c, first_hl=True):
    out = []
    for i in range(len(h)):
        if i == 0:
            out.append(h[0] - l[0] if first_hl else NAN)
        else:
            out.append(max(h[i] - l[i], abs(h[i] - c[i - 1]), abs(l[i] - c[i - 1])))
    return out


def r_rsi(c, n):
    up = [NAN] + [max(c[i] - c[i - 1], 0) for i in range(1, len(c))]
    dn = [NAN] + [max(c[i - 1] - c[i], 0) for i in range(1, len(c))]
    u, d = r_rma(up, n), r_rma(dn, n)
    out = []
    for a, b in zip(u, d):
        if not (isnum(a) and isnum(b)):
            out.append(NAN)
        elif b == 0:
            out.append(100.0)
        elif a == 0:
            out.append(0.0)
        else:
            out.append(100 - 100 / (1 + a / b))
    return out


def r_stoch_raw(src, h, l, n):
    out = []
    for i in range(len(src)):
        wh, wl = window(h, i, n), window(l, i, n)
        if wh is None or not all(isnum(v) for v in wh + wl) or not isnum(src[i]):
            out.append(NAN)
            continue
        hh, ll = max(wh), min(wl)
        out.append(NAN if hh == ll else 100 * (src[i] - ll) / (hh - ll))
    return out


def r_cci(h, l, c, n):
    tp = [(a + b + d) / 3 for a, b, d in zip(h, l, c)]
    out = []
    for i in range(len(tp)):
        w = window(tp, i, n)
        if w is None:
            out.append(NAN)
            continue
        m = statistics.fmean(w)
        md = statistics.fmean(abs(v - m) for v in w)
        out.append(NAN if md == 0 else (tp[i] - m) / (0.015 * md))
    return out


def r_mfi(h, l, c, v, n):
    tp = [(a + b + d) / 3 for a, b, d in zip(h, l, c)]
    out = []
    for i in range(len(tp)):
        if i < n:
            out.append(NAN)
            continue
        pos = sum(tp[j] * v[j] for j in range(i - n + 1, i + 1) if tp[j] > tp[j - 1])
        neg = sum(tp[j] * v[j] for j in range(i - n + 1, i + 1) if tp[j] < tp[j - 1])
        out.append(100 - 100 / (1 + pos / neg) if neg else (100.0 if pos else NAN))
    return out


def r_dmi(h, l, c, n, sm):
    L = len(c)
    pdm, mdm = [NAN], [NAN]
    for i in range(1, L):
        up, dn = h[i] - h[i - 1], l[i - 1] - l[i]
        pdm.append(up if (up > dn and up > 0) else 0.0)
        mdm.append(dn if (dn > up and dn > 0) else 0.0)
    trur = r_rma(r_true_range(h, l, c, first_hl=False), n)
    p, m = r_rma(pdm, n), r_rma(mdm, n)
    plus = [100 * a / t if isnum(a) and isnum(t) and t else NAN for a, t in zip(p, trur)]
    minus = [100 * a / t if isnum(a) and isnum(t) and t else NAN for a, t in zip(m, trur)]
    dx = [abs(a - b) / ((a + b) or 1) if isnum(a) and isnum(b) else NAN for a, b in zip(plus, minus)]
    adx = [100 * v if isnum(v) else NAN for v in r_rma(dx, sm)]
    return adx, plus, minus


def r_sar(h, l, c, start, inc, mx):
    """TradingView's pine_sar, transcribed"""
    out = [NAN] * len(h)
    result = maxmin = acc = None
    below = False
    for i in range(1, len(h)):
        first = False
        if i == 1:
            if c[1] > c[0]:
                below, maxmin, result = True, h[1], l[0]
            else:
                below, maxmin, result = False, l[1], h[0]
            first, acc = True, start
        result = result + acc * (maxmin - result)
        if below:
            if result > l[i]:
                first, below, result, maxmin, acc = True, False, max(h[i], maxmin), l[i], start
        else:
            if result < h[i]:
                first, below, result, maxmin, acc = True, True, min(l[i], maxmin), h[i], start
        if not first:
            if below:
                if h[i] > maxmin:
                    maxmin, acc = h[i], min(acc + inc, mx)
            else:
                if l[i] < maxmin:
                    maxmin, acc = l[i], min(acc + inc, mx)
        if below:
            result = min(result, l[i - 1], l[i - 2] if i > 1 else l[i - 1])
        else:
            result = max(result, h[i - 1], h[i - 2] if i > 1 else h[i - 1])
        out[i] = result
    return out


def r_supertrend(h, l, c, n, f):
    """TradingView's pine_supertrend, transcribed (nz() of a missing band is 0)"""
    atr = r_rma(r_true_range(h, l, c), n)
    st, dr = [NAN] * len(c), [NAN] * len(c)
    pu = pl = pst = NAN
    for i in range(len(c)):
        if not isnum(atr[i]):
            continue
        src = (h[i] + l[i]) / 2
        ub, lb = src + f * atr[i], src - f * atr[i]
        ppl = pl if isnum(pl) else 0.0
        ppu = pu if isnum(pu) else 0.0
        lb = lb if (lb > ppl or c[i - 1] < ppl) else ppl
        ub = ub if (ub < ppu or c[i - 1] > ppu) else ppu
        if i == 0 or not isnum(atr[i - 1]):
            d = 1
        elif pst == pu:
            d = -1 if c[i] > ub else 1
        else:
            d = 1 if c[i] < lb else -1
        st[i] = lb if d == -1 else ub
        dr[i] = d
        pu, pl, pst = ub, lb, st[i]
    return st, dr


def r_mid(h, l, n):
    return [(max(window(h, i, n)) + min(window(l, i, n))) / 2 if i >= n - 1 else NAN for i in range(len(h))]


# ---------------------------------------------------------------- data
def make_bars(seed, n=420):
    rnd = random.Random(seed)
    bars, p, t = [], 100.0, 1_700_000_000 - 1_700_000_000 % 3600
    for i in range(n):
        if 120 <= i < 140:                 # a dead stretch: no trades, every price equal
            o = h = l = c = p
            v = 0.0
        else:
            o = p
            c = max(0.01, p * (1 + rnd.gauss(0, 0.012)))
            h = max(o, c) * (1 + abs(rnd.gauss(0, 0.004)))
            l = min(o, c) * (1 - abs(rnd.gauss(0, 0.004)))
            v = round(rnd.uniform(5, 500), 3)
        bars.append({"t": t + i * 3600, "o": o, "h": h, "l": l, "c": c, "v": v})
        p = c
    return bars


def reference(bars):
    t = [b["t"] for b in bars]
    h = [b["h"] for b in bars]
    l = [b["l"] for b in bars]
    c = [b["c"] for b in bars]
    v = [b["v"] for b in bars]
    R = {}
    R["sma"] = {"v": r_sma(c, 20)}
    R["ema"] = {"v": r_ema(c, 50)}
    R["wma"] = {"v": r_wma(c, 20)}
    mid = r_sma(c, 20)
    sd = [statistics.pstdev(window(c, i, 20)) if i >= 19 else NAN for i in range(len(c))]
    R["bb"] = {"mid": mid, "up": [m + 2 * s for m, s in zip(mid, sd)], "lo": [m - 2 * s for m, s in zip(mid, sd)]}
    up = [max(window(h, i, 20)) if i >= 19 else NAN for i in range(len(c))]
    lo = [min(window(l, i, 20)) if i >= 19 else NAN for i in range(len(c))]
    R["dc"] = {"up": up, "lo": lo, "mid": [(a + b) / 2 for a, b in zip(up, lo)]}
    km, ka = r_ema(c, 20), r_rma(r_true_range(h, l, c), 10)
    R["kc"] = {"mid": km, "up": [a + 2 * b for a, b in zip(km, ka)], "lo": [a - 2 * b for a, b in zip(km, ka)]}
    conv, base = r_mid(h, l, 9), r_mid(h, l, 26)
    R["ichi"] = {"conv": conv, "base": base, "spanA": [(a + b) / 2 for a, b in zip(conv, base)], "spanB": r_mid(h, l, 52), "lag": c[:]}
    R["psar"] = {"sar": r_sar(h, l, c, 0.02, 0.02, 0.2)}
    st, dr = r_supertrend(h, l, c, 10, 3)
    R["st"] = {"up": [s if d == -1 else NAN for s, d in zip(st, dr)], "dn": [s if d == 1 else NAN for s, d in zip(st, dr)], "dir": dr}
    pv = vv = 0.0
    day, vw = None, []
    for i in range(len(c)):
        d = t[i] // 86400
        if d != day:
            day, pv, vv = d, 0.0, 0.0
        pv += (h[i] + l[i] + c[i]) / 3 * v[i]
        vv += v[i]
        vw.append(pv / vv if vv else NAN)
    R["vwap"] = {"v": vw}
    R["vol"] = {"vol": v, "ma": r_sma(v, 20)}
    R["rsi"] = {"v": r_rsi(c, 14)}
    f, s = r_ema(c, 12), r_ema(c, 26)
    m = [a - b if isnum(a) and isnum(b) else NAN for a, b in zip(f, s)]
    sg = r_ema(m, 9)
    R["macd"] = {"macd": m, "signal": sg, "hist": [a - b if isnum(a) and isnum(b) else NAN for a, b in zip(m, sg)]}
    k = r_sma(r_stoch_raw(c, h, l, 14), 3)
    R["stoch"] = {"k": k, "d": r_sma(k, 3)}
    rs = r_rsi(c, 14)
    k2 = r_sma(r_stoch_raw(rs, rs, rs, 14), 3)
    R["srsi"] = {"k": k2, "d": r_sma(k2, 3)}
    R["atr"] = {"v": r_rma(r_true_range(h, l, c), 14)}
    a, p_, mi = r_dmi(h, l, c, 14, 14)
    R["adx"] = {"adx": a, "pdi": p_, "mdi": mi}
    R["cci"] = {"v": r_cci(h, l, c, 20)}
    R["mfi"] = {"v": r_mfi(h, l, c, v, 14)}
    wr = []
    for i in range(len(c)):
        if i < 13:
            wr.append(NAN)
            continue
        hh, ll = max(h[i - 13:i + 1]), min(l[i - 13:i + 1])
        wr.append(NAN if hh == ll else 100 * (c[i] - hh) / (hh - ll))
    R["willr"] = {"v": wr}
    ob, acc = [], 0.0
    for i in range(len(c)):
        if i:
            acc += v[i] if c[i] > c[i - 1] else (-v[i] if c[i] < c[i - 1] else 0)
        ob.append(acc)
    R["obv"] = {"v": ob}
    R["roc"] = {"v": [100 * (c[i] - c[i - 9]) / c[i - 9] if i >= 9 else NAN for i in range(len(c))]}
    return R


def run_js(bars):
    code = ("const I=require(process.argv[1]);const bars=JSON.parse(require('fs').readFileSync(0,'utf8'));const o={};"
            "for(const id of [...I.ORDER_OVER,...I.ORDER_PANE]){const r=I.compute(id,bars,{});o[id]={};"
            "for(const k in r)o[id][k]=Array.from(r[k],x=>(x===x&&x!=null&&isFinite(x))?x:null)}"
            "o.heikin=I.heikin(bars);process.stdout.write(JSON.stringify(o))")
    p = subprocess.run(["node", "-e", code, os.path.join(ROOT, "assets", "pro", "ind.js")], input=json.dumps(bars),
                       capture_output=True, text=True, check=True)
    return json.loads(p.stdout)


def close(a, b):
    if not isnum(a) and (b is None):
        return True
    if b is None or not isnum(a):
        return False
    return abs(a - b) <= 1e-9 * max(1.0, abs(a))


def main():
    fails = 0
    checks = 0
    for seed in (1, 7, 2026):
        bars = make_bars(seed)
        js, ref = run_js(bars), reference(bars)
        for ind, plots in ref.items():
            for key, want in plots.items():
                got = js[ind].get(key)
                if got is None:
                    print(f"FAIL seed {seed} {ind}.{key}: missing in JS")
                    fails += 1
                    continue
                bad = [i for i, (a, b) in enumerate(zip(want, got)) if not close(a, b)]
                checks += len(want)
                if bad or len(want) != len(got):
                    i = bad[0] if bad else -1
                    print(f"FAIL seed {seed} {ind}.{key}: {len(bad)} values differ, first at {i}: ref {want[i]} js {got[i]}")
                    fails += 1
        # Heikin-Ashi: close = ohlc4, open = average of the previous HA open/close
        ha = js["heikin"]
        for i in range(1, len(bars)):
            b = bars[i]
            exp_c = (b["o"] + b["h"] + b["l"] + b["c"]) / 4
            exp_o = (ha[i - 1]["o"] + ha[i - 1]["c"]) / 2
            if not (close(exp_c, ha[i]["c"]) and close(exp_o, ha[i]["o"]) and ha[i]["h"] >= max(exp_o, exp_c) and ha[i]["l"] <= min(exp_o, exp_c)):
                print("FAIL heikin at", i)
                fails += 1
                break

    # hand-checked values
    flat = [{"t": i * 60, "o": x, "h": x, "l": x, "c": x, "v": 1} for i, x in enumerate([1, 2, 3, 4, 5, 6])]
    js = run_js(flat)
    hand = [("SMA(20) of 1..6 is not defined yet", js["sma"]["v"][5] is None),
            ("RSI of a rising series is 100", run_js([{"t": i, "o": i + 1, "h": i + 1, "l": i + 1, "c": i + 1, "v": 1} for i in range(30)])["rsi"]["v"][29] == 100),
            ("OBV adds volume on up closes", js["obv"]["v"][5] == 5),
            ("ROC(9) needs 10 bars", js["roc"]["v"][5] is None)]
    w = run_js([{"t": i, "o": x, "h": x, "l": x, "c": x, "v": 1} for i, x in enumerate([1, 2, 3, 4] * 6)])
    hand.append(("WMA(20) by hand", close(sum((k + 1) * x for k, x in enumerate(([1, 2, 3, 4] * 6)[-20:])) / 210, w["wma"]["v"][23])))
    for name, good in hand:
        checks += 1
        if not good:
            print("FAIL", name)
            fails += 1
    print(f"{checks} values checked, {fails} failures")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
