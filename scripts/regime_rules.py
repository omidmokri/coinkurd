"""Explainable, rule-based BTC regime with hysteresis — the companion of the hidden-Markov radar in regime.py.

Every day each dimension casts a vote (+1 bullish, 0 neutral, -1 bearish) from fixed, published thresholds:
    mayer   close ÷ 200-day SMA                      > 1.10 → +1   < 0.90 → -1
    slope   200-day SMA vs 20 days earlier           > +2 % → +1   < -2 % → -1
    wrsi    weekly RSI(14) (closes every 7 days)     > 55   → +1   < 45   → -1
    fng     Fear & Greed index                       > 60   → +1   < 40   → -1
    fund    funding z-score vs the previous 30 days  > +1   → +1   < -1   → -1   (only where funding history exists)
score = mean of the available votes.  raw label: score ≥ +0.34 bull, ≤ -0.34 bear, otherwise sideways —
and 'high_vol' (volatile, no trend) when 20-day realised volatility is above the 80th percentile of the past
year while the score is not decisive.

Hysteresis: the published (confirmed) label only changes after the raw label has said the same new thing for
CONFIRM days in a row. Nothing is fitted to the data, and each day uses that day and earlier only.
"""
import math

LABELS = ["bull", "bear", "sideways", "high_vol"]
CONFIRM = 5
TH = {"mayer": (1.10, 0.90), "slope": (2.0, -2.0), "wrsi": (55, 45), "fng": (60, 40), "fund": (1.0, -1.0)}


def _sma(a, p, i):
    return sum(a[i - p + 1:i + 1]) / p if i >= p - 1 else None


def _rsi(cl, p=14):
    if len(cl) <= p:
        return None
    ag = al = 0.0
    for i in range(1, len(cl)):
        d = cl[i] - cl[i - 1]
        g, lo = max(d, 0), max(-d, 0)
        if i <= p:
            ag += g
            al += lo
            if i == p:
                ag, al = ag / p, al / p
        else:
            ag, al = (ag * (p - 1) + g) / p, (al * (p - 1) + lo) / p
    return 100.0 if al == 0 else 100 - 100 / (1 + ag / al)


def _vote(key, v):
    if v is None:
        return None
    hi, lo = TH[key]
    return 1 if v > hi else -1 if v < lo else 0


def compute(dates, closes, fng=None, fund=None):
    """dates, closes: consecutive daily series. fng, fund: {date: value}. -> dict for regime.json['rule']"""
    fng, fund = fng or {}, fund or {}
    n = len(closes)
    lr = [0.0] + [math.log(closes[i] / closes[i - 1]) for i in range(1, n)]
    vol20 = [None] * n
    for i in range(20, n):
        vol20[i] = math.sqrt(sum(x * x for x in lr[i - 19:i + 1]) / 20)
    fd = sorted(fund)
    fz = {}
    for j, d in enumerate(fd):
        w = [fund[x] for x in fd[max(0, j - 30):j]]
        if len(w) >= 20:
            m = sum(w) / len(w)
            s = math.sqrt(sum((x - m) ** 2 for x in w) / len(w)) or None
            if s:
                fz[d] = (fund[d] - m) / s
    raw, conf, rows = [], [], []
    cur, streak_lab, streak = None, None, 0
    for i in range(n):
        sma200 = _sma(closes, 200, i)
        if sma200 is None or i < 220:
            raw.append(None)
            conf.append(None)
            rows.append(None)
            continue
        d = dates[i]
        sma200_20 = _sma(closes, 200, i - 20)
        dims = {
            "mayer": closes[i] / sma200,
            "slope": (sma200 / sma200_20 - 1) * 100,
            "wrsi": _rsi([closes[k] for k in range(i - 7 * 60, i + 1, 7) if k >= 0]),
            "fng": fng.get(d),
            "fund": fz.get(d),
        }
        votes = {k: _vote(k, v) for k, v in dims.items()}
        got = [v for v in votes.values() if v is not None]
        score = sum(got) / len(got) if got else 0.0
        past = [v for v in vol20[max(0, i - 365):i] if v is not None]
        vpct = (sum(1 for v in past if v < vol20[i]) / len(past)) if past and vol20[i] is not None else None
        if score >= 0.34:
            lab = "bull"
        elif score <= -0.34:
            lab = "bear"
        else:
            lab = "high_vol" if vpct is not None and vpct >= 0.80 else "sideways"
        raw.append(lab)
        # hysteresis
        if cur is None:
            cur = lab
        if lab == cur:
            streak_lab, streak = None, 0
        else:
            if lab == streak_lab:
                streak += 1
            else:
                streak_lab, streak = lab, 1
            if streak >= CONFIRM:
                cur, streak_lab, streak = lab, None, 0
        conf.append(cur)
        rows.append({"dims": dims, "votes": votes, "score": score, "vpct": vpct, "pending": (streak_lab, streak)})
    return dates, raw, conf, rows


def flips_per_year(daily):
    """label changes per year in a {date: label} history"""
    ds = sorted(daily)
    if len(ds) < 2:
        return None
    ch = sum(1 for a, b in zip(ds, ds[1:]) if daily[a] != daily[b])
    return round(ch / (len(ds) / 365.25), 1)
