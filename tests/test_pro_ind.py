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


# ---------------------------------------------------------------- the second batch (TradingView built-ins)
def d_(a, b):
    return a / b if isnum(a) and isnum(b) and b != 0 else NAN


def zip2(x, y, f):
    return [f(a, b) if isnum(a) and isnum(b) else NAN for a, b in zip(x, y)]


def r_sum(x, n):
    out = []
    for i in range(len(x)):
        w = window(x, i, n)
        out.append(sum(w) if w is not None and all(isnum(v) for v in w) else NAN)
    return out


def lag(x, k):
    return [NAN] * k + x[:len(x) - k] if k else x[:]


def r_hma(x, n):
    a, b = r_wma(x, max(1, n // 2)), r_wma(x, n)
    return r_wma(zip2(a, b, lambda p, q: 2 * p - q), max(1, int(math.isqrt(n))))


def r_alma(x, n, off, sig):
    m, s = off * (n - 1), n / sig
    w = [math.exp(-((i - m) ** 2) / (2 * s * s)) for i in range(n)]
    out = []
    for j in range(len(x)):
        win = window(x, j, n)
        out.append(sum(v * wt for v, wt in zip(win, w)) / sum(w) if win is not None and all(isnum(v) for v in win) else NAN)
    return out


def r_lsma(x, n):
    out = []
    xs = list(range(n))
    mx = sum(xs) / n
    for j in range(len(x)):
        win = window(x, j, n)
        if win is None or not all(isnum(v) for v in win):
            out.append(NAN)
            continue
        my = sum(win) / n
        sxx = sum((a - mx) ** 2 for a in xs)
        slope = sum((a - mx) * (b - my) for a, b in zip(xs, win)) / sxx if sxx else 0.0
        out.append(my - slope * mx + slope * (n - 1))
    return out


def r_mcginley(x, n):
    e, out, prev = r_ema(x, n), [], NAN
    for i, v in enumerate(x):
        if not isnum(prev):
            prev = e[i] if isnum(e[i]) else NAN
        elif isnum(v) and prev != 0:
            prev = prev + (v - prev) / (n * (v / prev) ** 4)
        out.append(prev)
    return out


def r_fractals(h, l, n):
    up, dn = [NAN] * len(h), [NAN] * len(h)
    for k in range(n, len(h) - n):
        side = [k - j for j in range(1, n + 1)] + [k + j for j in range(1, n + 1)]
        if all(h[k] > h[j] for j in side):
            up[k] = h[k]
        if all(l[k] < l[j] for j in side):
            dn[k] = l[k]
    return up, dn


def r_pivots(t, h, l, c):
    import datetime
    gaps = sorted(t[i] - t[i - 1] for i in range(1, min(len(t), 60)))
    sec = gaps[len(gaps) // 2]
    per = ("D" if sec <= 900 else "W") if sec < 86400 else ("M" if sec < 7 * 86400 else "Y")

    def key(x):
        d = datetime.datetime.fromtimestamp(x, datetime.timezone.utc)
        if per == "D":
            return d.date()
        if per == "W":
            return (d.date() - datetime.timedelta(days=d.weekday()))      # the Monday of that week
        return (d.year, d.month) if per == "M" else d.year
    keys = [key(x) for x in t]
    out = {k: [NAN] * len(t) for k in ("p", "r1", "r2", "r3", "s1", "s2", "s3")}
    groups = {}
    for i, k in enumerate(keys):
        groups.setdefault(k, []).append(i)
    order = list(dict.fromkeys(keys))
    for a, b in zip(order, order[1:]):
        idx = groups[a]
        H, L, C = max(h[i] for i in idx), min(l[i] for i in idx), c[idx[-1]]
        P = (H + L + C) / 3
        lv = {"p": P, "r1": 2 * P - L, "s1": 2 * P - H, "r2": P + (H - L), "s2": P - (H - L), "r3": H + 2 * (P - L), "s3": L - 2 * (H - P)}
        for i in groups[b]:
            for k2, v in lv.items():
                out[k2][i] = v
    return out


def r_zigzag(h, l, dev):
    f, n = dev / 100, len(h)
    out = [NAN] * n
    if n < 2:
        return out
    piv, d, ext, ei = [], 0, NAN, 0
    hi, hii, lo, loi = h[0], 0, l[0], 0
    for i in range(1, n):
        if d == 0:
            if h[i] > hi:
                hi, hii = h[i], i
            if l[i] < lo:
                lo, loi = l[i], i
            if hi >= lo * (1 + f):
                if loi <= hii:
                    piv.append((loi, lo)); d, ext, ei = 1, hi, hii
                else:
                    piv.append((hii, hi)); d, ext, ei = -1, lo, loi
            continue
        if d == 1:
            if h[i] >= ext:
                ext, ei = h[i], i
            elif l[i] <= ext * (1 - f):
                piv.append((ei, ext)); d, ext, ei = -1, l[i], i
        else:
            if l[i] <= ext:
                ext, ei = l[i], i
            elif h[i] >= ext * (1 + f):
                piv.append((ei, ext)); d, ext, ei = 1, h[i], i
    if d:
        piv.append((ei, ext))
    for (a, va), (b, vb) in zip(piv, piv[1:]):
        for j in range(a, b + 1):
            out[j] = va + (vb - va) * (j - a) / (b - a) if b != a else vb
    return out


def r_swma(x):
    return [x[i - 3] / 6 + x[i - 2] * 2 / 6 + x[i - 1] * 2 / 6 + x[i] / 6 if i >= 3 and all(isnum(v) for v in x[i - 3:i + 1]) else NAN for i in range(len(x))]


def r_fisher(h, l, n):
    m = [(a + b) / 2 for a, b in zip(h, l)]
    val, f1, pv, pf = [], [], NAN, NAN
    for i in range(len(h)):
        v = NAN
        if i >= n - 1:
            hh, ll = max(window(m, i, n)), min(window(m, i, n))
            if hh != ll:
                v = 0.66 * ((m[i] - ll) / (hh - ll) - 0.5) + 0.67 * (pv if isnum(pv) else 0)
                v = 0.999 if v > 0.99 else (-0.999 if v < -0.99 else v)
        f = 0.5 * math.log((1 + v) / (1 - v)) + 0.5 * (pf if isnum(pf) else 0) if isnum(v) else NAN
        val.append(v); f1.append(f)
        pv, pf = v, f
    return f1, [NAN] + f1[:-1]


def r_streak(c):
    out, ud = [], 0
    for i in range(len(c)):
        if i > 0 and c[i] == c[i - 1]:
            ud = 0
        elif i > 0 and c[i] > c[i - 1]:
            ud = 1 if ud <= 0 else ud + 1
        else:
            ud = -1 if ud >= 0 else ud - 1
        out.append(ud)
    return out


def r_prank(x, n):
    out = []
    for i in range(len(x)):
        if i < n or not isnum(x[i]) or not all(isnum(v) for v in x[i - n:i]):
            out.append(NAN)
            continue
        out.append(100 * sum(1 for v in x[i - n:i] if v <= x[i]) / n)
    return out


def r_roc(c, n):
    return [100 * (c[i] - c[i - n]) / c[i - n] if i >= n and c[i - n] else NAN for i in range(len(c))]


def r_aroon(h, l, n):
    up, dn = [NAN] * len(h), [NAN] * len(h)
    for i in range(n, len(h)):
        wh, wl = h[i - n:i + 1], l[i - n:i + 1]
        hb = max(k for k in range(n + 1) if wh[k] == max(wh)) - n          # the most recent extreme
        lb = max(k for k in range(n + 1) if wl[k] == min(wl)) - n
        up[i], dn[i] = 100 * (hb + n) / n, 100 * (lb + n) / n
    return up, dn


def reference2(bars):
    t = [b["t"] for b in bars]
    o = [b["o"] for b in bars]
    h = [b["h"] for b in bars]
    l = [b["l"] for b in bars]
    c = [b["c"] for b in bars]
    v = [b["v"] for b in bars]
    m = [(a + b) / 2 for a, b in zip(h, l)]
    trr = r_true_range(h, l, c)
    R = {}
    R["hma"] = {"v": r_hma(c, 9)}
    e1 = r_ema(c, 9); e2 = r_ema(e1, 9); e3 = r_ema(e2, 9)
    R["dema"] = {"v": zip2(e1, e2, lambda a, b: 2 * a - b)}
    R["tema"] = {"v": [3 * (a - b) + d if isnum(a) and isnum(b) and isnum(d) else NAN for a, b, d in zip(e1, e2, e3)]}
    R["vwma"] = {"v": zip2(r_sma([a * b for a, b in zip(c, v)], 20), r_sma(v, 20), d_)}
    R["smma"] = {"v": r_rma(c, 7)}
    R["alma"] = {"v": r_alma(c, 9, 0.85, 6)}
    R["lsma"] = {"v": r_lsma(c, 25)}
    R["mgd"] = {"v": r_mcginley(c, 14)}
    R["macross"] = {"fast": r_sma(c, 9), "slow": r_sma(c, 21)}
    R["ribbon"] = {"m1": r_sma(c, 20), "m2": r_sma(c, 50), "m3": r_sma(c, 100), "m4": r_sma(c, 200)}
    mid = r_sma(c, 20)
    R["env"] = {"mid": mid, "up": [x * 1.1 if isnum(x) else NAN for x in mid], "lo": [x * 0.9 if isnum(x) else NAN for x in mid]}
    R["alli"] = {"jaw": r_rma(m, 13), "teeth": r_rma(m, 8), "lips": r_rma(m, 5)}
    fu, fd = r_fractals(h, l, 2)
    R["fract"] = {"up": fu, "dn": fd}
    R["piv"] = r_pivots(t, h, l, c)
    R["zz"] = {"v": r_zigzag(h, l, 5)}
    ao = zip2(r_sma(m, 5), r_sma(m, 34), lambda a, b: a - b)
    R["ao"] = {"v": ao}
    R["ac"] = {"v": zip2(ao, r_sma(ao, 5), lambda a, b: a - b)}
    R["mom"] = {"v": zip2(c, lag(c, 10), lambda a, b: a - b)}
    t3 = r_ema(r_ema(r_ema([math.log(x) for x in c], 18), 18), 18)
    R["trix"] = {"v": zip2(t3, lag(t3, 1), lambda a, b: 10000 * (a - b))}
    bp = [NAN] + [c[i] - min(l[i], c[i - 1]) for i in range(1, len(c))]
    tr2 = [NAN] + [max(h[i], c[i - 1]) - min(l[i], c[i - 1]) for i in range(1, len(c))]
    A, B, C = (zip2(r_sum(bp, n), r_sum(tr2, n), d_) for n in (7, 14, 28))
    R["uo"] = {"v": [100 * (4 * a + 2 * b + d) / 7 if isnum(a) and isnum(b) and isnum(d) else NAN for a, b, d in zip(A, B, C)]}
    pf, ps = r_ema(c, 12), r_ema(c, 26)
    pp = zip2(pf, ps, lambda a, b: 100 * (a - b) / b if b else NAN)
    sg = r_ema(pp, 9)
    R["ppo"] = {"ppo": pp, "signal": sg, "hist": zip2(pp, sg, lambda a, b: a - b)}
    pc = [NAN] + [c[i] - c[i - 1] for i in range(1, len(c))]
    ts = zip2(r_ema(r_ema(pc, 25), 13), r_ema(r_ema([abs(x) if isnum(x) else NAN for x in pc], 25), 13), lambda a, b: 100 * a / b if b else NAN)
    R["tsi"] = {"tsi": ts, "signal": r_ema(ts, 13)}
    up = [NAN] + [max(x, 0) for x in pc[1:]]
    dn = [NAN] + [max(-x, 0) for x in pc[1:]]
    R["cmo"] = {"v": zip2(r_sum(up, 9), r_sum(dn, 9), lambda a, b: 100 * (a - b) / (a + b) if a + b else NAN)}
    r1, r2, r3 = r_rsi(c, 3), r_rsi(r_streak(c), 2), r_prank(r_roc(c, 1), 100)
    R["crsi"] = {"v": [(a + b + d) / 3 if isnum(a) and isnum(b) and isnum(d) else NAN for a, b, d in zip(r1, r2, r3)]}
    f1, f2 = r_fisher(h, l, 9)
    R["fisher"] = {"fish": f1, "trig": f2}
    rv = zip2(r_sum(r_swma([a - b for a, b in zip(c, o)]), 10), r_sum(r_swma([a - b for a, b in zip(h, l)]), 10), d_)
    R["rvgi"] = {"rvi": rv, "sig": r_swma(rv)}
    ks = [r_sma(r_roc(c, a), b) for a, b in ((10, 10), (15, 10), (20, 10), (30, 15))]
    kst = [w + 2 * x + 3 * y + 4 * z if all(isnum(q) for q in (w, x, y, z)) else NAN for w, x, y, z in zip(*ks)]
    R["kst"] = {"kst": kst, "signal": r_sma(kst, 9)}
    R["copp"] = {"v": r_wma(zip2(r_roc(c, 14), r_roc(c, 11), lambda a, b: a + b), 10)}
    R["dpo"] = {"v": zip2(c, lag(r_sma(c, 21), 21 // 2 + 1), lambda a, b: a - b)}
    au, ad = r_aroon(h, l, 14)
    R["aroon"] = {"up": au, "dn": ad}
    va = [NAN] + [abs(h[i] - l[i - 1]) for i in range(1, len(h))]
    vb = [NAN] + [abs(l[i] - h[i - 1]) for i in range(1, len(h))]
    st = r_sum(trr, 14)
    R["vortex"] = {"vip": zip2(r_sum(va, 14), st, d_), "vim": zip2(r_sum(vb, 14), st, d_)}
    s14 = r_sum(trr, 14)
    R["chop"] = {"v": [100 * math.log10(s14[i] / (max(window(h, i, 14)) - min(window(l, i, 14)))) / math.log10(14)
                       if i >= 13 and isnum(s14[i]) and max(window(h, i, 14)) > min(window(l, i, 14)) else NAN for i in range(len(c))]}
    sp = [a - b for a, b in zip(h, l)]
    me1 = r_ema(sp, 9); me2 = r_ema(me1, 9)
    R["mass"] = {"v": r_sum(zip2(me1, me2, d_), 10)}
    be = r_ema(c, 13)
    R["bbpow"] = {"v": [h[i] + l[i] - 2 * be[i] if isnum(be[i]) else NAN for i in range(len(c))]}
    R["bop"] = {"v": [(c[i] - o[i]) / (h[i] - l[i]) if h[i] != l[i] else NAN for i in range(len(c))]}
    sd20 = [statistics.pstdev(window(c, i, 20)) if i >= 19 else NAN for i in range(len(c))]
    bu = [a + 2 * s if isnum(a) else NAN for a, s in zip(mid, sd20)]
    bl = [a - 2 * s if isnum(a) else NAN for a, s in zip(mid, sd20)]
    R["bbp"] = {"v": [d_(c[i] - bl[i], bu[i] - bl[i]) if isnum(bl[i]) else NAN for i in range(len(c))]}
    R["bbw"] = {"v": [100 * (bu[i] - bl[i]) / mid[i] if isnum(mid[i]) and mid[i] else NAN for i in range(len(c))]}
    R["sd"] = {"v": sd20}
    lr = [NAN] + [math.log(c[i] / c[i - 1]) for i in range(1, len(c))]
    gaps = sorted(t[i] - t[i - 1] for i in range(1, min(len(t), 60)))
    per = 1 if gaps[len(gaps) // 2] <= 86400 else 7
    R["hv"] = {"v": [100 * statistics.pstdev(window(lr, i, 10)) * math.sqrt(365 / per) if i >= 10 else NAN for i in range(len(c))]}
    sdv = [statistics.pstdev(window(c, i, 10)) if i >= 9 else NAN for i in range(len(c))]
    ru = [NAN] + [(0 if c[i] - c[i - 1] <= 0 else sdv[i]) if isnum(sdv[i]) else NAN for i in range(1, len(c))]
    rd = [NAN] + [(0 if c[i] - c[i - 1] > 0 else sdv[i]) if isnum(sdv[i]) else NAN for i in range(1, len(c))]
    R["rvi"] = {"v": zip2(r_ema(ru, 14), r_ema(rd, 14), lambda a, b: 100 * a / (a + b) if a + b else NAN)}
    R["adr"] = {"v": r_sma(sp, 14)}
    adv = [0.0 if (c[i] == h[i] and c[i] == l[i]) or h[i] == l[i] else (2 * c[i] - l[i] - h[i]) / (h[i] - l[i]) * v[i] for i in range(len(c))]
    R["cmf"] = {"v": zip2(r_sum(adv, 20), r_sum(v, 20), d_)}
    adl, acc = [], 0.0
    for x in adv:
        acc += x
        adl.append(acc)
    R["adl"] = {"v": adl}
    R["chosc"] = {"v": zip2(r_ema(adl, 3), r_ema(adl, 10), lambda a, b: a - b)}
    R["efi"] = {"v": r_ema([NAN] + [(c[i] - c[i - 1]) * v[i] for i in range(1, len(c))], 13)}
    R["eom"] = {"v": r_sma([NAN] + [10000 * (m[i] - m[i - 1]) * (h[i] - l[i]) / v[i] if v[i] else NAN for i in range(1, len(c))], 14)}
    pvt, acc = [], 0.0
    for i in range(len(c)):
        if i and c[i - 1]:
            acc += (c[i] - c[i - 1]) / c[i - 1] * v[i]
        pvt.append(acc)
    R["pvt"] = {"v": pvt}
    R["vo"] = {"v": zip2(r_ema(v, 5), r_ema(v, 10), lambda a, b: 100 * (a - b) / b if b else NAN)}
    return R


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
        ref.update(reference2(bars))
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

    # pivots by period: 15-minute bars → daily levels, daily bars → monthly levels
    for step, name in ((900, "daily pivots on 15m"), (86400, "monthly pivots on 1D")):
        bs = make_bars(11, 400)
        for k, x in enumerate(bs):
            x["t"] = 1_700_000_000 - 1_700_000_000 % 86400 + k * step
        js2, want = run_js(bs)["piv"], r_pivots([x["t"] for x in bs], [x["h"] for x in bs], [x["l"] for x in bs], [x["c"] for x in bs])
        for key in want:
            checks += len(want[key])
            bad = [i for i, (a2, b2) in enumerate(zip(want[key], js2[key])) if not close(a2, b2)]
            if bad:
                print(f"FAIL {name} {key}: {len(bad)} differ, first at {bad[0]}")
                fails += 1
        if sum(1 for x in want["p"] if isnum(x)) < 100:
            print(f"FAIL {name}: too few defined levels")
            fails += 1

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
