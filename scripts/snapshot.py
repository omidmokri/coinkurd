#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Market Replay — ذخیرهٔ عکس فوری (snapshot) از وضعیت بازار، ۴ بار در روز (بازه‌های ۶ ساعته UTC)

هر snapshot: رژیم بازار، پهنای بازار، گزارش هوش مصنوعی، ترس و طمع، بازار کل، قیمت و RSI کوین‌های اصلی،
یافته‌های اسکنر، روایت‌های داغ، تیترها، امتیاز Entekhab و آخرین پست‌های کانال.
بعداً صفحهٔ /replay/ هر لحظهٔ گذشته را نشان می‌دهد و «بعداً چه شد» را از snapshotهای بعدی حساب می‌کند.
خروجی: data/history/<YYYY-MM-DD>T<HH>.json  +  data/history/index.json
"""
import json
import os
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
H = os.path.join(D, "history")
MAJORS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "TON", "ADA"]


def load(n, d):
    try:
        return json.load(open(os.path.join(D, n), encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return d


def main():
    os.makedirs(H, exist_ok=True)
    now = datetime.now(timezone.utc)
    slot = f"{now:%Y-%m-%d}T{now.hour // 6 * 6:02d}"
    m, b, sc = load("market.json", {}), load("brain.json", {}), load("score.json", {})
    nr, nw, ps = load("narratives.json", {}), load("news.json", {}), load("posts.json", [])
    if not m.get("coins"):
        print("no market data; skip")
        return
    mk = {c["coin"]: c for c in m["coins"]}
    snap = {
        "slot": slot, "taken_at": now.isoformat(),
        "regime": b.get("regime"), "report": b.get("report"), "report_at": b.get("report_at"),
        "gainers": b.get("gainers"), "losers": b.get("losers"),
        "fng": (m.get("fng") or {}).get("value"), "fng_class": (m.get("fng") or {}).get("class"), "global": m.get("global"),
        "prices": {c: {k: mk[c].get(k) for k in ("price", "chg24", "rsi", "trend")} for c in MAJORS if c in mk},
        "opportunities": [o for o in m.get("opportunities", []) if o.get("confidence") == "high"][:15],
        "narratives": [{"id": x["id"], "name": x["name"], "mentions_24h": x["mentions_24h"], "perf_24h": x["perf_24h"]}
                       for x in nr.get("narratives", [])[:6]],
        "headlines": [{"title": i["title"], "url": i["url"], "source": i["source"]} for i in nw.get("items", [])[:10]],
        "score_top": sorted(((k, v["score"]) for k, v in sc.get("coins", {}).items() if k in MAJORS), key=lambda kv: -kv[1]),
        "channel": [{"id": p["id"], "title": p["title"], "date": p.get("date")} for p in ps[:5]],
    }
    json.dump(snap, open(os.path.join(H, f"{slot}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    idx_p = os.path.join(H, "index.json")
    idx = json.load(open(idx_p)) if os.path.exists(idx_p) else {"slots": []}
    slots = {s["slot"]: s for s in idx["slots"]}
    slots[slot] = {"slot": slot, "btc": snap["prices"].get("BTC", {}).get("price"), "regime": (snap["regime"] or {}).get("regime"),
                   "fng": snap["fng"]}
    idx["slots"] = sorted(slots.values(), key=lambda s: s["slot"])[-2000:]
    idx["updated_at"] = now.isoformat()
    json.dump(idx, open(idx_p, "w"), separators=(",", ":"))
    print("snapshot", slot, "total", len(idx["slots"]))


if __name__ == "__main__":
    main()
