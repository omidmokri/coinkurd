#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
امتیاز Entekhab (Entekhab Score) — شفاف و قابل‌بازبینی، بدون هوش مصنوعی

برای هر کوین یک عدد ۰ تا ۱۰۰ از چهار جزء (هر جزء ۰..۱۰۰، ۵۰ = خنثی):

  تکنیکال      ۴۰٪  روند EMA20/50، موقعیت قیمت نسبت به EMA20، RSI، تغییر ۲۴h، جایگاه در دامنهٔ ۴۸h، یافته‌های اسکنر
  احساسات      ۲۵٪  شاخص ترس و طمع کل بازار (برای همهٔ کوین‌ها یکسان)
  اخبار        ۲۰٪  تعداد خبرهای ۴۸ ساعت اخیر (توجه رسانه‌ای) + خبرهای امنیتی منفی
  کانال        ۱۵٪  میانگین حرکت قیمت ۲۴h بعد از پست‌های Coin_Kurd دربارهٔ این کوین (کارنامه)

اگر جزئی داده نداشته باشد وزنش بین بقیه پخش می‌شود و این در خروجی ثبت می‌شود.
این عدد توصیف وضعیت فعلی است، نه پیش‌بینی یا توصیهٔ معاملاتی. تاریخچهٔ روزانه
ذخیره می‌شود تا بعداً بتوان آن را با بازده واقعی کالیبره کرد.

خروجی: data/score.json
"""
import json
import os
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
W = {"technical": 0.40, "sentiment": 0.25, "news": 0.20, "channel": 0.15}


def load(n, dflt):
    try:
        return json.load(open(os.path.join(D, n), encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return dflt


def clamp(x):
    return max(0.0, min(100.0, x))


def technical(c, opps):
    s = 50.0
    s += 12 if c["trend"] == "up" else -12 if c["trend"] == "down" else 0
    s += 8 if c["price"] > c["ema20"] else -8
    r = c.get("rsi") or 50
    s += (r - 50) * 0.4 if 30 < r < 70 else (-6 if r >= 70 else 6)  # اشباع = احتمال برگشت
    ch = c.get("chg24") or 0
    s += max(-10, min(10, ch * 1.5))
    rng = (c["hi48"] - c["lo48"]) or 1
    s += ((c["price"] - c["lo48"]) / rng - 0.5) * 10
    for o in opps:
        sign = 1 if o["type"] in ("rsi_oversold", "ema_golden_cross", "breakout_up", "bull_divergence") else \
            -1 if o["type"] in ("rsi_overbought", "ema_death_cross", "breakdown", "bear_divergence") else 0
        s += sign * (6 if o.get("confidence") == "high" else 3)
    return clamp(s)


def channel_component(tr):
    """Channel part of the Score from the tested record (data/trackrecord.json): neutral 50 unless the
    post-vs-random-hours test is significant (p < 0.05); then 50 + 8 x (post avg - random-hour avg), clamped."""
    t = ((tr or {}).get("test") or {}).get("r24") or {}
    o, b = ((tr or {}).get("obs") or {}).get("r24"), ((tr or {}).get("base") or {}).get("r24")
    if t.get("p") is None or o is None or b is None or t["p"] >= 0.05:
        return 50.0
    return round(clamp(50 + (o - b) * 8), 1)


def main():
    m, news, imp = load("market.json", {}), load("news.json", {}), load("impact.json", {})
    prev = load("score.json", {})
    chan = channel_component(load("trackrecord.json", {}))
    now = datetime.now(timezone.utc)
    fng = (m.get("fng") or {}).get("value")
    cut = now - timedelta(hours=48)
    items = [i for i in news.get("items", []) if datetime.fromisoformat(i["date"]) >= cut]
    ncount, nneg = {}, {}
    for i in items:
        for c in i.get("coins", []):
            ncount[c] = ncount.get(c, 0) + len(i.get("sources", [1]))
            if i.get("category") == "security":
                nneg[c] = nneg.get(c, 0) + 1
    mx = max(ncount.values(), default=0)
    by = {}
    for r in imp.values():
        if r.get("r24h") is not None:
            by.setdefault(r["coin"], []).append(r["r24h"])
    opps = {}
    for o in m.get("opportunities", []):
        opps.setdefault(o["coin"], []).append(o)
    out = {}
    for c in m.get("coins", []):
        sym = c["coin"]
        comp = {"technical": round(technical(c, opps.get(sym, [])), 1)}
        if fng is not None:
            comp["sentiment"] = float(fng)
        if mx:
            att = 50 + 30 * (ncount.get(sym, 0) / mx) ** 0.5 if ncount.get(sym) else 45
            comp["news"] = round(clamp(att - 15 * nneg.get(sym, 0)), 1)
        a = by.get(sym, [])
        if len(a) >= 3:
            comp["channel"] = chan
        wsum = sum(W[k] for k in comp)
        score = sum(comp[k] * W[k] for k in comp) / wsum
        label = "strong" if score >= 65 else "positive" if score >= 55 else "neutral" if score > 45 else "weak" if score > 35 else "very_weak"
        out[sym] = {"score": round(score), "label": label, "components": comp,
                    "weights": {k: round(W[k] / wsum, 3) for k in comp},
                    "inputs": {"news_48h": ncount.get(sym, 0), "channel_posts": len(a), "fng": fng}}
    hist = prev.get("history", {})
    day = now.strftime("%Y-%m-%d")
    for sym, v in out.items():
        h = hist.setdefault(sym, [])
        if h and h[-1][0] == day:
            h[-1] = [day, v["score"], m["coins"][[x["coin"] for x in m["coins"]].index(sym)]["price"]]
        else:
            h.append([day, v["score"], next(x["price"] for x in m["coins"] if x["coin"] == sym)])
        hist[sym] = h[-120:]
    json.dump({"updated_at": now.isoformat(), "method": W, "coins": out, "history": hist},
              open(os.path.join(D, "score.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    top = sorted(out.items(), key=lambda kv: -kv[1]["score"])[:5]
    print("scored", len(out), "top:", [(k, v["score"]) for k, v in top])


if __name__ == "__main__":
    main()
