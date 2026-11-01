#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Entekhab Market DNA → data/dna.json   (every 3 hours; all inputs are real, free data)

8 genes per coin, each 0–100 (percentile rank inside the scanned universe unless noted):
  liquidity   — 30-day average quote volume on Binance (log)                       [Binance klines]
  volatility  — 30-day realised volatility (annualised)                             [Binance klines]
  flow        — 7-day taker-buy share of volume (aggressive buyers vs sellers)      [Binance klines]
                (exchange trade flow, NOT whale wallets — on-chain whale data has no reliable free source)
  sentiment   — headline tone of the last 7 days of news mentioning the coin (lexicon; 50 = neutral; none = no news)
  attention   — number of headlines mentioning the coin in 7 days                    [data/news.json]
  leverage    — annualised perpetual funding rate                                    [OKX via data/derivatives.json]
  developers  — commits in 30 days to the project's main repo                        [GitHub via data/lab.json]
  momentum    — 0.2·ret7 + 0.5·ret30 + 0.3·ret90                                     [Binance klines]
Plus: correlation with BTC (90d), distance from the 1000-day high,
      similar coins now (distance over shared genes), and historical twins: the 5 past days in the coin's own
      history whose 7-feature state (ret7, ret30, vol14, MA200 distance, RSI14, taker share, volume z) was closest
      to today, with what happened over the next 7/30 days.
Also: market-wide headline sentiment by day (for the sentiment thermometer).
"""
import json
import math
import os
import re
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
OUT = os.path.join(D, "dna.json")
BN = "https://data-api.binance.vision/api/v3"
NOW = datetime.now(timezone.utc)
STABLE = {"USDC", "FDUSD", "TUSD", "DAI", "USDE", "USDP", "EUR", "EURI", "AEUR", "PAXG", "XAUT", "USD1", "BFUSD", "RLUSD", "PYUSD", "U"}
GENES = ["liquidity", "volatility", "flow", "sentiment", "attention", "leverage", "developers", "momentum"]
LET = {"liquidity": "L", "volatility": "V", "flow": "F", "sentiment": "S", "attention": "A", "leverage": "X", "developers": "D", "momentum": "M"}
POS = r"surge|soar|rall(y|ies)|gain|jump|bull|record|all-time high|\bath\b|approv|adopt|launch|partner|upgrade|inflow|accumulat|rebound|breakout|climb|rise[sn]?|rising|boost|win|positive|optimis|buy(s|ing)?\b|milestone|expand|integrat|recover|green"
NEG = r"plunge|crash|drop|fall|fell|slump|bear|hack|exploit|lawsuit|\bsue|ban\b|banned|fraud|outflow|sell-?off|liquidat|decline|loss|warn|risk|probe|investigat|delist|scam|dump|tumble|slide|fear|crackdown|halt|freeze|negative|concern|attack|breach|stolen|default|bankrupt|red\b"


def load(n, d):
    try:
        return json.load(open(os.path.join(D, n), encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return d


def tone(title):
    t = title.lower()
    p, n = len(re.findall(POS, t)), len(re.findall(NEG, t))
    return 0 if p == n else (1 if p > n else -1)


def klines(sym, limit=1000):
    for i in range(3):
        try:
            r = requests.get(f"{BN}/klines", params={"symbol": sym, "interval": "1d", "limit": limit}, timeout=25)
            if r.status_code == 200:
                k = r.json()
                return [{"t": x[0], "o": float(x[1]), "h": float(x[2]), "l": float(x[3]), "c": float(x[4]), "v": float(x[5]),
                         "q": float(x[7]), "tbq": float(x[10])} for x in k]
            if r.status_code in (400, 404):
                return []
        except Exception as e:  # noqa: BLE001
            print("  err", sym, str(e)[:80])
        time.sleep(2 + i * 3)
    return []


def sd(x):
    if len(x) < 2:
        return 0.0
    m = sum(x) / len(x)
    return math.sqrt(sum((a - m) ** 2 for a in x) / (len(x) - 1))


def corr(a, b):
    n = min(len(a), len(b))
    if n < 20:
        return None
    a, b = a[-n:], b[-n:]
    ma, mb = sum(a) / n, sum(b) / n
    c = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    da, db = math.sqrt(sum((x - ma) ** 2 for x in a)), math.sqrt(sum((y - mb) ** 2 for y in b))
    return round(c / (da * db), 2) if da and db else None


def prank(vals):
    """percentile rank 0..100 for non-None values (ties share the average rank)"""
    items = sorted((v, k) for k, v in vals.items() if v is not None)
    n, out, i = len(items), {}, 0
    while i < n:
        j = i
        while j + 1 < n and items[j + 1][0] == items[i][0]:
            j += 1
        r = (i + j) / 2
        for kk in range(i, j + 1):
            out[items[kk][1]] = round(100 * r / (n - 1)) if n > 1 else 50
        i = j + 1
    return out


def ema(arr, n):
    k, e, out = 2 / (n + 1), arr[0], []
    for x in arr:
        e = x * k + e * (1 - k)
        out.append(e)
    return out


def state(k, i):
    """7-feature state of day i (needs i >= 200)"""
    cl = [x["c"] for x in k[: i + 1]]
    r = [cl[j] / cl[j - 1] - 1 for j in range(len(cl) - 30, len(cl))]
    up, dn = [max(x, 0) for x in r[-14:]], [max(-x, 0) for x in r[-14:]]
    rsi = 100 - 100 / (1 + sum(up) / (sum(dn) or 1e-9))
    q7 = sum(x["q"] for x in k[i - 6: i + 1]) or 1e-9
    tb = sum(x["tbq"] for x in k[i - 6: i + 1]) / q7
    v7, v90 = sum(x["q"] for x in k[i - 6: i + 1]) / 7, sum(x["q"] for x in k[i - 89: i + 1]) / 90 or 1e-9
    return [cl[-1] / cl[-8] - 1, cl[-1] / cl[-31] - 1, sd(r[-14:]), cl[-1] / (sum(cl[-200:]) / 200) - 1, rsi / 100, tb, v7 / v90 - 1]


def twins(k):
    n = len(k)
    if n < 260:
        return None, None
    S = {i: state(k, i) for i in range(200, n)}
    dims = 7
    mu = [sum(S[i][d] for i in S) / len(S) for d in range(dims)]
    sg = [sd([S[i][d] for i in S]) or 1 for d in range(dims)]
    z = {i: [(S[i][d] - mu[d]) / sg[d] for d in range(dims)] for i in S}
    cur = z[n - 1]
    cand = sorted((math.sqrt(sum((a - b) ** 2 for a, b in zip(z[i], cur)) / dims), i) for i in S if i <= n - 31)
    picked = []
    for dist, i in cand:
        if all(abs(i - j) > 20 for _, j in picked):
            picked.append((dist, i))
        if len(picked) == 5:
            break
    rows = []
    for dist, i in picked:
        c0 = k[i]["c"]
        rows.append({"date": datetime.fromtimestamp(k[i]["t"] / 1000, timezone.utc).strftime("%Y-%m-%d"), "dist": round(dist, 2),
                     "price": c0, "f7": round((k[i + 7]["c"] / c0 - 1) * 100, 2), "f30": round((k[i + 30]["c"] / c0 - 1) * 100, 2),
                     "dd30": round((min(x["l"] for x in k[i + 1: i + 31]) / c0 - 1) * 100, 2),
                     "path": [round(k[i + j]["c"] / c0 * 100, 2) for j in range(31)]})
    f30 = [r["f30"] for r in rows]
    stats = {"n": len(rows), "up30": sum(1 for x in f30 if x > 0), "avg30": round(sum(f30) / len(f30), 2) if f30 else None,
             "up7": sum(1 for r in rows if r["f7"] > 0), "avg7": round(sum(r["f7"] for r in rows) / len(rows), 2) if rows else None}
    return rows, stats


def main():
    prev = load("dna.json", {})
    if prev.get("updated_at") and NOW - datetime.fromisoformat(prev["updated_at"]) < timedelta(hours=3) and os.environ.get("DNA_FORCE") != "1":
        print("dna not due; last", prev["updated_at"])
        return
    m = load("market.json", {})
    uni = [c["coin"] for c in sorted(m.get("coins", []), key=lambda c: -(c.get("qvol") or 0)) if c["coin"] not in STABLE][:40]
    for must in ("ETH", "BTC"):
        if must not in uni:
            uni.insert(0, must)
    K = {}
    for c in uni:
        k = klines(c + "USDT")
        if len(k) >= 100:
            K[c] = k[:-1]          # drop today's unfinished candle
        time.sleep(0.15)
    print("klines:", len(K), "/", len(uni))
    if "BTC" not in K:
        print("no BTC history; abort")
        return
    news = load("news.json", {}).get("items", [])
    cut7 = NOW - timedelta(days=7)
    n7 = [x for x in news if datetime.fromisoformat(x["date"]) >= cut7]
    mention, tones = defaultdict(int), defaultdict(list)
    for x in n7:
        tn = tone(x["title"])
        for c in x.get("coins", []):
            mention[c] += 1
            tones[c].append(tn)
    der = {s["coin"]: s for s in load("derivatives.json", {}).get("swaps", [])}
    dev = {d["coin"]: d for d in load("lab.json", {}).get("dev", [])}
    btc_r = [K["BTC"][j]["c"] / K["BTC"][j - 1]["c"] - 1 for j in range(1, len(K["BTC"]))]
    raw = {}
    for c, k in K.items():
        cl = [x["c"] for x in k]
        r = [cl[j] / cl[j - 1] - 1 for j in range(1, len(cl))]
        q30 = sum(x["q"] for x in k[-30:]) / min(30, len(k))
        tb7 = sum(x["tbq"] for x in k[-7:]) / (sum(x["q"] for x in k[-7:]) or 1e-9)
        ret = lambda d: (cl[-1] / cl[-1 - d] - 1) * 100 if len(cl) > d else None  # noqa: E731
        mom = None if ret(90) is None else 0.2 * ret(7) + 0.5 * ret(30) + 0.3 * ret(90)
        tn = tones.get(c, [])
        raw[c] = {"qvol30": round(q30), "vol30": round(sd(r[-30:]) * math.sqrt(365) * 100, 1), "taker7": round(tb7 * 100, 1),
                  "sent": None if not tn else round(sum(tn) / len(tn), 2), "news7": mention.get(c, 0),
                  "funding_ann": (der.get(c) or {}).get("funding_ann"), "commits30": (dev.get(c) or {}).get("c30"),
                  "ret7": None if ret(7) is None else round(ret(7), 2), "ret30": None if ret(30) is None else round(ret(30), 2),
                  "ret90": None if ret(90) is None else round(ret(90), 2), "mom": mom,
                  "corr_btc": None if c == "BTC" else corr(r[-90:], btc_r[-90:]),
                  "from_high": round((cl[-1] / max(x["h"] for x in k) - 1) * 100, 1), "days": len(k), "price": cl[-1]}
    rk = {
        "liquidity": prank({c: math.log10(v["qvol30"] + 1) for c, v in raw.items()}),
        "volatility": prank({c: v["vol30"] for c, v in raw.items()}),
        "flow": prank({c: v["taker7"] for c, v in raw.items()}),
        "attention": prank({c: v["news7"] for c, v in raw.items()}),
        "leverage": prank({c: v["funding_ann"] for c, v in raw.items()}),
        "developers": prank({c: v["commits30"] for c, v in raw.items()}),
        "momentum": prank({c: v["mom"] for c, v in raw.items()}),
    }
    coins = {}
    for c, v in raw.items():
        g = {gname: rk[gname].get(c) for gname in rk}
        g["sentiment"] = None if v["sent"] is None else int(round(50 + 50 * v["sent"]))
        coins[c] = {"genes": {k_: g.get(k_) for k_ in GENES}, "raw": {k_: v[k_] for k_ in v if k_ != "mom"}}
    for c in coins:
        gi, sims = coins[c]["genes"], []
        for o in coins:
            if o == c:
                continue
            go = coins[o]["genes"]
            shared = [gn for gn in GENES if gi[gn] is not None and go[gn] is not None]
            if len(shared) < 5:
                continue
            d = math.sqrt(sum((gi[gn] - go[gn]) ** 2 for gn in shared) / len(shared)) / 100
            sims.append([o, round((1 - d) * 100)])
        coins[c]["similar"] = sorted(sims, key=lambda x: -x[1])[:5]
        tw, st = twins(K[c])
        coins[c]["twins"], coins[c]["twin_stats"] = tw, st
        coins[c]["code"] = "·".join(f"{LET[gn]}{'--' if coins[c]['genes'][gn] is None else coins[c]['genes'][gn]}" for gn in GENES)
    by_day = defaultdict(list)
    for x in news:
        by_day[x["date"][:10]].append(tone(x["title"]))
    days = sorted(by_day)[-7:]
    sent = {"days": [{"day": d_, "n": len(by_day[d_]), "pos": sum(1 for t in by_day[d_] if t > 0), "neg": sum(1 for t in by_day[d_] if t < 0),
                      "score": round(sum(by_day[d_]) / len(by_day[d_]), 3)} for d_ in days]}
    tn7 = [tone(x["title"]) for x in n7]
    sent["score7"] = round(sum(tn7) / len(tn7), 3) if tn7 else None
    sent["n7"] = len(tn7)
    sent["top_pos"] = [{"title": x["title"], "url": x["url"], "source": x["source"]} for x in n7 if tone(x["title"]) > 0][:4]
    sent["top_neg"] = [{"title": x["title"], "url": x["url"], "source": x["source"]} for x in n7 if tone(x["title"]) < 0][:4]
    out = {"updated_at": NOW.isoformat(), "genes": GENES, "universe": len(coins), "coins": coins, "headline_sentiment": sent,
           "method": "percentile ranks inside the scanned universe; similarity = 1 − RMS gene distance; twins = nearest past states (z-scored, 7 features)"}
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    b = coins.get("BTC", {})
    print("coins:", len(coins), "| BTC code:", b.get("code"), "| similar:", b.get("similar"), "| twins:", b.get("twin_stats"),
          "| sentiment7:", sent.get("score7"), sent.get("n7"))


if __name__ == "__main__":
    main()
