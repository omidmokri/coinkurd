#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Channel track record — what bitcoin did after the channel's posts, against what it did after any hour.

The question every reader has — "does following this channel help?" — answered from the archive itself.

For every archived market post (posts whose measured coin is BTC: almost all of them; promos and repeats out):
  entry  = the open of the first full hour after the post — what a reader could really have bought at
  r24    = bitcoin's move over the next 24 full hours
  before = bitcoin's move over the 4 hours before that entry (did the post come after the move?)
  range  = the high-to-low range of those 24 hours (did the post come at an eventful time?)
The same numbers are computed for EVERY hour of the same window: "the post had appeared at a random hour".

Posts in the same hour count once. Posts on the same day share most of their 24-hour window, so the test is a
matched-cluster randomisation: every post-day is replaced by a random day of the window holding the same
number of random hours, B times, and we report where the real result falls among those random results.
No stance labels are used: a post is treated as an event, not as a call. Explicit calls are scored in /ledger/.

Writes data/trackrecord.json. Needs Binance (CI); with no market access it leaves the old file alone.
"""
import json
import math
import os
import random
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS = os.path.join(ROOT, "data", "posts.json")
IMPACT = os.path.join(ROOT, "data", "impact.json")
OUT = os.path.join(ROOT, "data", "trackrecord.json")
H = 3600_000
B = int(os.environ.get("TR_DRAWS", "10000"))
SEED = 20031222          # the day Entekhab was registered — any fixed seed makes the result reproducible
MIN_CAT = 20             # fewer unique hours than this and a category is shown as "too few to say"


def load(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return d


def fetch_btc(t_from, t_to, fetch=None):
    """BTC 1h bars from t_from to t_to (ms), paging Binance 1000 at a time"""
    if fetch is None:
        from market import klines as fetch
    out, start = [], t_from
    for _ in range(12):
        part = fetch("BTC", "1h", 1000, start=start)
        if not part:
            break
        out.extend(part)
        if part[-1]["t"] >= t_to or len(part) < 1000:
            break
        start = part[-1]["t"] + H
        time.sleep(0.15)
    seen, bars = set(), []
    for b in sorted(out, key=lambda x: x["t"]):
        if b["t"] not in seen:
            seen.add(b["t"])
            bars.append(b)
    return bars


def series(bars):
    """per-hour measures for every hour that has 4 hours before it and 24 after it"""
    idx = {b["t"]: i for i, b in enumerate(bars)}
    o = [b["o"] for b in bars]
    hi = [b["h"] for b in bars]
    lo = [b["l"] for b in bars]
    c = [b["c"] for b in bars]
    m = {}
    for i in range(4, len(bars) - 23):
        if bars[i + 23]["t"] - bars[i]["t"] != 23 * H or bars[i]["t"] - bars[i - 4]["t"] != 4 * H:
            continue            # a gap in the exchange's history: skip rather than stretch a window
        m[i] = (
            (c[i + 23] / o[i] - 1) * 100,                                  # r24
            (o[i] / o[i - 4] - 1) * 100,                                   # before
            (max(hi[i:i + 24]) / min(lo[i:i + 24]) - 1) * 100,            # range
        )
    return idx, m


def day_of(t):
    return datetime.fromtimestamp(t / 1000, timezone.utc).strftime("%Y-%m-%d")


def mean(xs):
    return sum(xs) / len(xs) if xs else None


def stats(vals):
    """vals: list of (r24, before, range)"""
    if not vals:
        return None
    r = [v[0] for v in vals]
    return {"r24": mean(r), "hit": 100 * sum(1 for x in r if x > 0) / len(r),
            "before": mean([v[1] for v in vals]), "range": mean([v[2] for v in vals])}


def randomise(groups, by_day, m, draws, rng):
    """groups: {day: k unique hours}. Each draw swaps every post-day for a random day with k random hours."""
    days = [d for d, hs in by_day.items() if hs]
    sims = {"r24": [], "hit": [], "before": [], "range": []}
    ks = list(groups.values())
    for _ in range(draws):
        picked = []
        for k in ks:
            hs = by_day[rng.choice(days)]
            picked.extend(rng.sample(hs, k) if len(hs) >= k else [rng.choice(hs) for _ in range(k)])
        st = stats([m[i] for i in picked])
        for key in sims:
            sims[key].append(st[key])
    return sims


def judge(obs, sim):
    """two-sided p against the randomised distribution, the observed value's percentile and the 95% band"""
    sim = sorted(sim)
    n = len(sim)
    centre = sum(sim) / n
    far = sum(1 for x in sim if abs(x - centre) >= abs(obs - centre) - 1e-12)
    below = sum(1 for x in sim if x < obs)
    return {"p": round((far + 1) / (n + 1), 4), "pct": round(100 * below / n, 1),
            "lo": round(sim[int(0.025 * (n - 1))], 4), "hi": round(sim[int(0.975 * (n - 1))], 4),
            "mid": round(centre, 4)}


def bootstrap_ci(by_postday, m, draws, rng):
    """95% interval for the mean 24h move after posts, resampling whole post-days"""
    days = list(by_postday)
    res = []
    for _ in range(draws):
        pick = []
        for _ in days:
            pick.extend(by_postday[rng.choice(days)])
        res.append(mean([m[i][0] for i in pick]))
    res.sort()
    return [round(res[int(0.025 * (draws - 1))], 4), round(res[int(0.975 * (draws - 1))], 4)]


def hist(vals, edges):
    cnt = [0] * (len(edges) + 1)
    for v in vals:
        k = 0
        while k < len(edges) and v >= edges[k]:
            k += 1
        cnt[k] += 1
    tot = len(vals) or 1
    return [round(100 * x / tot, 2) for x in cnt]


def analyse(bars, posts, impact, draws=B, seed=SEED):
    """the whole study on given bars — kept free of I/O so it can be tested on synthetic data"""
    idx, m = series(bars)
    cat = {p["id"]: p.get("category") or "news" for p in posts}
    low = {p["id"] for p in posts if p.get("q") == "low"}
    entries, per_cat, excluded = {}, {}, {"other_coin": 0, "promo": 0, "no_window": 0}
    for k, v in impact.items():
        if not isinstance(v, dict) or not v.get("t0"):
            continue
        pid = int(k)
        if v.get("coin") != "BTC":
            excluded["other_coin"] += 1
            continue
        if pid in low:
            excluded["promo"] += 1
            continue
        t0 = int(v["t0"])
        et = -(-t0 // H) * H                      # the first full hour after the post (or the post's own hour if exact)
        i = idx.get(et)
        if i is None or i not in m:
            excluded["no_window"] += 1
            continue
        entries.setdefault(i, set()).add(pid)
        per_cat.setdefault(cat.get(pid, "news"), set()).add(i)
    if len(entries) < 20:
        return None
    hours = sorted(entries)
    by_postday = {}
    for i in hours:
        by_postday.setdefault(day_of(bars[i]["t"]), []).append(i)
    by_day = {}
    for i in m:
        by_day.setdefault(day_of(bars[i]["t"]), []).append(i)
    rng = random.Random(seed)
    obs = stats([m[i] for i in hours])
    base = stats(list(m.values()))
    sims = randomise({d: len(v) for d, v in by_postday.items()}, by_day, m, draws, rng)
    test = {key: judge(obs[key], sims[key]) for key in obs}
    ci = bootstrap_ci(by_postday, m, max(2000, draws // 2), rng)
    cats = []
    for c, hs in sorted(per_cat.items(), key=lambda kv: -len(kv[1])):
        hs = sorted(hs)
        st = stats([m[i] for i in hs])
        row = {"id": c, "n": len(hs), "r24": round(st["r24"], 4), "hit": round(st["hit"], 2), "small": len(hs) < MIN_CAT}
        if not row["small"]:
            g = {}
            for i in hs:
                g.setdefault(day_of(bars[i]["t"]), []).append(i)
            cs = randomise({d: len(v) for d, v in g.items()}, by_day, m, max(2000, draws // 4), rng)
            row["p"] = judge(st["r24"], cs["r24"])["p"]
        cats.append(row)
    edges = [-4, -3, -2, -1, 0, 1, 2, 3, 4]
    rnd = lambda d: {k: (round(x, 4) if isinstance(x, float) else x) for k, x in d.items()}  # noqa: E731
    return {
        "window": {"from": day_of(min(bars[i]["t"] for i in m)),
                   "to": day_of(max(bars[i]["t"] for i in m)), "hours": len(m), "days": len(by_day)},
        "n_posts": sum(len(v) for v in entries.values()), "n_hours": len(hours), "n_days": len(by_postday),
        "obs": rnd(obs), "base": rnd(base), "test": test, "ci_r24": ci, "cats": cats,
        "hist": {"edges": edges, "post": hist([m[i][0] for i in hours], edges), "base": hist([x[0] for x in m.values()], edges)},
        "excluded": excluded,
        "method": {"draws": draws, "seed": seed, "coin": "BTC", "bars": "Binance BTCUSDT 1h",
                   "entry": "open of the first full hour after the post", "hold_h": 24, "before_h": 4},
    }


def main():
    posts = load(POSTS, [])
    impact = load(IMPACT, {})
    t0s = [int(v["t0"]) for v in impact.values() if isinstance(v, dict) and v.get("t0") and v.get("coin") == "BTC"]
    if not t0s:
        print("trackrecord: no measured posts yet")
        return
    t_from = (min(t0s) // H) * H - 6 * H
    t_to = (max(t0s) // H) * H + 26 * H
    try:
        bars = fetch_btc(t_from, t_to)
    except Exception as ex:  # noqa: BLE001
        print(f"trackrecord: no market data ({ex}); keeping the previous file")
        return
    res = analyse(bars, posts, impact)
    if not res:
        print("trackrecord: too few measured posts with a full window")
        return
    res["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    json.dump(res, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    t = res["test"]
    print(f"trackrecord: {res['n_posts']} posts in {res['n_hours']} hours over {res['n_days']} days · "
          f"24h after posts {res['obs']['r24']:+.3f}% vs random hours {t['r24']['mid']:+.3f}% (p={t['r24']['p']}) · "
          f"hit {res['obs']['hit']:.1f}% vs {t['hit']['mid']:.1f}% (p={t['hit']['p']})")


if __name__ == "__main__":
    main()
