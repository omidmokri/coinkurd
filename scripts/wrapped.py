#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Crypto Wrapped — خلاصهٔ تصویری هفته و ماه (دادهٔ واقعی Binance + خبرها + روایت‌ها)
برای ۶۰ کوین پرحجم: بیشترین رشد/افت، پرحجم‌ترین، بیشترین نوسان، بزرگ‌ترین شمع روزانهٔ BTC، پرخبرترین کوین.
هر ۶ ساعت یک بار. خروجی: data/wrapped.json
"""
import json
import os
from collections import Counter
from datetime import datetime, timezone, timedelta

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
BN = "https://data-api.binance.vision/api/v3"
NOW = datetime.now(timezone.utc)


def load(n, d):
    try:
        return json.load(open(os.path.join(D, n), encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return d


def kl(sym, n):
    try:
        r = requests.get(f"{BN}/klines?symbol={sym}&interval=1d&limit={n + 1}", timeout=20)
        k = r.json() if r.status_code == 200 else []
    except Exception:  # noqa: BLE001
        k = []
    return [{"t": x[0], "o": float(x[1]), "h": float(x[2]), "l": float(x[3]), "c": float(x[4]), "q": float(x[7])} for x in k]


def period(days, data, news, narr):
    rows = []
    for c, k in data.items():
        k = k[-days:]
        if len(k) < days:
            continue
        o, cl = k[0]["o"], k[-1]["c"]
        rng = [(x["h"] / x["l"] - 1) * 100 for x in k]
        rows.append({"coin": c, "chg": round((cl / o - 1) * 100, 2), "qvol": round(sum(x["q"] for x in k)), "avg_range": round(sum(rng) / len(rng), 2)})
    if not rows:
        return None
    btc = data.get("BTC", [])[-days:]
    bc = None
    if btc:
        big = max(btc, key=lambda x: abs(x["c"] / x["o"] - 1))
        bc = {"open": btc[0]["o"], "close": btc[-1]["c"], "chg": round((btc[-1]["c"] / btc[0]["o"] - 1) * 100, 2),
              "high": max(x["h"] for x in btc), "low": min(x["l"] for x in btc),
              "biggest_day": {"date": datetime.fromtimestamp(big["t"] / 1000, timezone.utc).strftime("%Y-%m-%d"), "chg": round((big["c"] / big["o"] - 1) * 100, 2)},
              "green_days": sum(1 for x in btc if x["c"] >= x["o"])}
    cut = NOW - timedelta(days=days)
    nn = [n for n in news.get("items", []) if datetime.fromisoformat(n["date"]) >= cut]
    cnt = Counter(c for n in nn for c in n.get("coins", []))
    by = lambda f, rev=True: sorted(rows, key=f, reverse=rev)  # noqa: E731
    return {"days": days, "from": (NOW - timedelta(days=days)).strftime("%Y-%m-%d"), "to": NOW.strftime("%Y-%m-%d"), "n_coins": len(rows),
            "top_gainers": by(lambda r: r["chg"])[:5], "top_losers": by(lambda r: r["chg"], False)[:5],
            "most_traded": by(lambda r: r["qvol"])[:5], "wildest": by(lambda r: r["avg_range"])[:5],
            "up_count": sum(1 for r in rows if r["chg"] > 0), "btc": bc,
            "most_news": [{"coin": c, "n": n} for c, n in cnt.most_common(5)], "news_total": len(nn),
            "top_headline": nn[0] and {"title": nn[0]["title"], "url": nn[0]["url"], "source": nn[0]["source"]} if nn else None,
            "hot_narrative": max(narr.get("narratives", [{}]), key=lambda x: x.get("mentions_24h", 0), default={}).get("name")}


def save_issue(w, news, narr):
    """Weekly magazine snapshot (#94): data/weekly/<ISO-week>.json, overwritten during the week, kept forever"""
    iso = NOW.isocalendar()
    wk = f"{iso[0]}-W{iso[1]:02d}"
    os.makedirs(os.path.join(D, "weekly"), exist_ok=True)
    brain, council, events, posts, dna = load("brain.json", {}), load("council.json", {}), load("events.json", {}), load("posts.json", []), load("dna.json", {})
    cut = NOW - timedelta(days=7)
    week_posts = [{"id": p["id"], "title": p.get("title"), "date": p.get("date"), "tr": {k: (v or {}).get("title") for k, v in (p.get("tr") or {}).items()}}
                  for p in posts if p.get("date") and datetime.fromisoformat(p["date"]) >= cut][:8]
    ev = [e for e in events.get("events", []) if e.get("btc_4h") is not None and datetime.fromisoformat(e["date"]) >= cut][:6]
    coins = (dna.get("coins") or {})
    mom = sorted(((c, v["genes"].get("momentum")) for c, v in coins.items() if v["genes"].get("momentum") is not None), key=lambda x: -x[1])[:3]
    flow = sorted(((c, v["raw"].get("taker7")) for c, v in coins.items() if v["raw"].get("taker7") is not None), key=lambda x: -x[1])[:3]
    issue = {"week": wk, "from": cut.strftime("%Y-%m-%d"), "to": NOW.strftime("%Y-%m-%d"), "generated_at": NOW.isoformat(),
             "wrapped": w.get("week"), "brain": {"regime": (brain.get("regime") or {}).get("regime"), "report": brain.get("report"), "report_at": brain.get("report_at")},
             "council": (council.get("council") or {}).get("fa", {}).get("summary") and {k: (council["council"].get(k) or {}).get("summary") for k in ("fa", "ckb", "en")},
             "narratives": [{"name": x.get("name"), "mentions_24h": x.get("mentions_24h"), "perf_24h": x.get("perf_24h")} for x in (narr.get("narratives") or [])[:5]],
             "headlines": [{"title": n["title"], "url": n["url"], "source": n["source"]} for n in news.get("items", []) if datetime.fromisoformat(n["date"]) >= cut][:8],
             "events": [{"title": e.get("title"), "title_fa": e.get("title_fa"), "date": e.get("date"), "btc_1h": e.get("btc_1h"), "btc_4h": e.get("btc_4h")} for e in ev],
             "channel": week_posts, "dna_momentum": mom, "dna_flow": flow}
    json.dump(issue, open(os.path.join(D, "weekly", f"{wk}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("weekly issue saved:", wk)


def main():
    prev = load("wrapped.json", {})
    if prev.get("updated_at") and NOW - datetime.fromisoformat(prev["updated_at"]) < timedelta(hours=6) and os.environ.get("WRAPPED_FORCE") != "1":
        print("wrapped not due")
        return
    m = load("market.json", {})
    coins = sorted([c for c in m.get("coins", []) if c.get("qvol")], key=lambda c: -c["qvol"])[:60] or [{"coin": "BTC"}]
    data = {}
    for c in coins:
        k = kl(c["coin"] + "USDT", 31)
        if k:
            data[c["coin"]] = k[:-1] if len(k) > 30 else k  # بدون شمع روز جاری (ناقص)
    news, narr = load("news.json", {}), load("narratives.json", {})
    out = {"updated_at": NOW.isoformat(), "week": period(7, data, news, narr), "month": period(30, data, news, narr)}
    json.dump(out, open(os.path.join(D, "wrapped.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    try:
        save_issue(out, news, narr)
    except Exception as e:  # noqa: BLE001
        print('weekly issue failed:', e)
    w = out["week"] or {}
    print("coins:", len(data), "| week top:", [(r["coin"], r["chg"]) for r in w.get("top_gainers", [])[:3]], "| btc:", (w.get("btc") or {}).get("chg"))


if __name__ == "__main__":
    main()
