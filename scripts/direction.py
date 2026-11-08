"""Directional study: were the channel's bullish/bearish posts right about bitcoin's next 24 hours?

Inputs (real, committed by CI): data/stance.json (AI stance labels, each backed by a verbatim quote) and
data/impact.json (bitcoin's move 24 h after each post).  Output: data/direction.json.

Unit = the UTC day (posts on one day overlap the same 24-hour window, so post-level counts would overstate n).
A day's stance = sign(#bullish - #bearish) among its BTC-labelled posts with a complete 24 h window; ties and
neutral-only days are left out.  A day's outcome = mean r24h of its directional posts.  Hit = sign match.

Baseline: shuffle the day stances across the same days (keeps how often the channel is bullish and the
outcome distribution), 20 000 draws, fixed seed; p = share of draws with at least as many hits (one-sided,
add-one).  Expected hits under the null are also reported.  Below MIN_DAYS directional days: no verdict.
"""
import json
import os
import random
from datetime import datetime, timezone

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DRAWS, SEED, MIN_DAYS = 20000, 20261108, 30


def load(p, d):
    try:
        with open(os.path.join(ROOT, "data", p), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return d


def days(labels, impact):
    by = {}
    posts = {"bullish": 0, "bearish": 0, "neutral": 0}
    for pid, lab in labels.items():
        im = impact.get(pid) or {}
        if (lab.get("coin") or "BTC") != "BTC" or im.get("coin", "BTC") != "BTC" or im.get("r24h") is None:
            continue
        st = lab.get("stance")
        if st not in posts:
            continue
        posts[st] += 1
        if st == "neutral":
            continue
        d = (lab.get("date") or "")[:10]
        if not d:
            continue
        by.setdefault(d, []).append((1 if st == "bullish" else -1, float(im["r24h"])))
    out = []
    for d in sorted(by):
        net = sum(s for s, _ in by[d])
        if net == 0:
            continue
        sg = 1 if net > 0 else -1
        r = sum(x for _, x in by[d]) / len(by[d])
        out.append({"day": d, "stance": sg, "r24": round(r, 3), "n": len(by[d])})
    return out, posts


def hits(st, rs):
    return sum(1 for s, r in zip(st, rs) if s * r > 0)


def analyse(labels, impact, draws=DRAWS, seed=SEED):
    ds, posts = days(labels, impact)
    res = {"posts": posts, "n_days": len(ds), "days": ds, "min_days": MIN_DAYS,
           "method": {"draws": draws, "seed": seed, "unit": "utc_day"}}
    if not ds:
        return res
    st, rs = [d["stance"] for d in ds], [d["r24"] for d in ds]
    h = hits(st, rs)
    up = sum(1 for r in rs if r > 0) / len(rs)
    bull = sum(1 for s in st if s > 0)
    exp = bull * up + (len(st) - bull) * (sum(1 for r in rs if r < 0) / len(rs))
    rng = random.Random(seed)
    sh, ge = st[:], 0
    for _ in range(draws):
        rng.shuffle(sh)
        if hits(sh, rs) >= h:
            ge += 1
    res.update({"hits": h, "hit_rate": round(100 * h / len(ds), 1), "expected_rate": round(100 * exp / len(ds), 1),
                "up_rate": round(100 * up, 1), "bull_days": bull, "bear_days": len(st) - bull,
                "p": round((ge + 1) / (draws + 1), 4), "enough": len(ds) >= MIN_DAYS,
                "window": {"from": ds[0]["day"], "to": ds[-1]["day"]}})
    return res


def main():
    s = load("stance.json", {})
    res = analyse(s.get("labels") or {}, load("impact.json", {}))
    res["model"] = s.get("model")
    res["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with open(os.path.join(ROOT, "data", "direction.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print("direction:", res.get("n_days"), "days, hit", res.get("hit_rate"), "vs", res.get("expected_rate"), "p", res.get("p"))


if __name__ == "__main__":
    main()
