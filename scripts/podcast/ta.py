"""Technical levels computed from the site's own candle snapshots (data/candles/*.json).
Pure functions; no network. Every number returned is derived from the candles, nothing typed by hand."""
import json, os

def load(root, sym, tf):
    d = json.load(open(os.path.join(root, "data", "candles", f"{sym}_{tf}.json")))
    rows = d["s"][sym][tf]
    return d["t"], [dict(t=r[0], o=r[1], h=r[2], l=r[3], c=r[4], v=r[5]) for r in rows]

def ema(vals, n):
    k = 2 / (n + 1); out = []; e = None
    for v in vals:
        e = v if e is None else v * k + e * (1 - k); out.append(e)
    return out

def sma(vals, n):
    return [None if i + 1 < n else sum(vals[i + 1 - n:i + 1]) / n for i in range(len(vals))]

def rsi(closes, n=14):
    gains, losses = [], []
    for a, b in zip(closes[:-1], closes[1:]):
        ch = b - a; gains.append(max(ch, 0)); losses.append(max(-ch, 0))
    if len(gains) < n: return None
    ag = sum(gains[:n]) / n; al = sum(losses[:n]) / n
    for g, l in zip(gains[n:], losses[n:]):
        ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + l) / n
    return 100.0 if al == 0 else 100 - 100 / (1 + ag / al)

def atr(rows, n=14):
    trs = []
    for p, r in zip(rows[:-1], rows[1:]):
        trs.append(max(r["h"] - r["l"], abs(r["h"] - p["c"]), abs(r["l"] - p["c"])))
    a = sum(trs[:n]) / n
    for t in trs[n:]: a = (a * (n - 1) + t) / n
    return a

def pivots(rows, k=3):
    """Fractal swing points: a high (low) higher (lower) than k bars on each side."""
    hs, ls = [], []
    for i in range(k, len(rows) - k):
        win = rows[i - k:i + k + 1]
        if rows[i]["h"] == max(r["h"] for r in win): hs.append((rows[i]["t"], rows[i]["h"]))
        if rows[i]["l"] == min(r["l"] for r in win): ls.append((rows[i]["t"], rows[i]["l"]))
    return hs, ls

def cluster(levels, tol):
    """Merge levels closer than tol (fraction); keep the mean, count the touches."""
    out = []
    for lv in sorted(levels):
        if out and abs(lv - out[-1][0]) / out[-1][0] <= tol:
            n = out[-1][1] + 1; out[-1] = ((out[-1][0] * out[-1][1] + lv) / n, n)
        else:
            out.append((lv, 1))
    return out

def levels(root, sym, price):
    t1d, d1 = load(root, sym, "1d"); t4h, h4 = load(root, sym, "4h")
    c1 = [r["c"] for r in d1]; c4 = [r["c"] for r in h4]
    hs1, ls1 = pivots(d1[-60:], 3); hs4, ls4 = pivots(h4[-180:], 4)
    piv = [p for _, p in hs1 + ls1 + hs4 + ls4]
    cl = cluster(piv, 0.006)
    sup = sorted([(lv, n) for lv, n in cl if lv < price * 0.997], key=lambda x: -x[0])[:3]
    res = sorted([(lv, n) for lv, n in cl if lv > price * 1.003], key=lambda x: x[0])[:3]
    last7 = d1[-7:]; last30 = d1[-30:]
    out = dict(
        sym=sym, candles_at=t1d, price=price,
        d1=dict(rsi14=rsi(c1), ema20=ema(c1, 20)[-1], ema50=ema(c1, 50)[-1], sma50=sma(c1, 50)[-1], sma100=sma(c1, 100)[-1],
                atr14=atr(d1), atr_pct=atr(d1) / price * 100, n=len(d1), last_close=c1[-1], last_t=d1[-1]["t"]),
        h4=dict(rsi14=rsi(c4), ema20=ema(c4, 20)[-1], ema50=ema(c4, 50)[-1], ema200=ema(c4, 200)[-1] if len(c4) >= 200 else None, n=len(h4)),
        hi7=max(r["h"] for r in last7), lo7=min(r["l"] for r in last7),
        hi30=max(r["h"] for r in last30), lo30=min(r["l"] for r in last30),
        chg7=(c1[-1] / d1[-8]["c"] - 1) * 100, chg30=(c1[-1] / d1[-31]["c"] - 1) * 100,
        supports=[dict(level=lv, touches=n) for lv, n in sup], resistances=[dict(level=lv, touches=n) for lv, n in res],
    )
    return out

if __name__ == "__main__":
    import sys
    root = sys.argv[1]
    tk = json.load(open(os.path.join(root, "data", "ticker.json")))
    for s in ("BTC", "ETH"):
        print(json.dumps(levels(root, s, tk["c"][s]["p"]), indent=1, default=str))
