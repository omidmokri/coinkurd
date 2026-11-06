#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
لایهٔ ریسک محلی ایران — Iran Local Friction Score (۰ تا ۱۰۰؛ بیشتر = اصطکاک بیشتر)

«قیمت روی کاغذ» (قیمت جهانی × دلار آزاد) چقدر با چیزی که کاربر ایرانی واقعاً می‌پردازد فاصله دارد؟

  مؤلفه                               وزن   سنجه (همه شفاف و از دادهٔ عمومی)
  C1 اختلاف نرخ تتر با دلار آزاد       ۴۰٪   |تتر ÷ دلار تهران − ۱|          ۰٪ → ۰ ،  ≥۵٪ → ۱۰۰
  C2 اصطکاک جابه‌جایی بین صرافی‌ها      ۳۰٪   اسپرد آربیتراژ تتر بین صرافی‌های ایرانی (بالاترین خرید − پایین‌ترین فروش)
                                              ۰٪ → ۰ ،  ≥۲٪ → ۱۰۰   (اگر جابه‌جایی پول آزاد بود این شکاف بسته می‌شد؛
                                              پس اسپرد پایدار = هزینه/تأخیر ضمنی برداشت و واریز)
  C3 دسترسی اینترنت ایران              ۲۰٪   IODA (پینگ فعال و BGP کشور IR نسبت به روز قبل) + سکوت فیدهای قیمت داخلی
  C4 شدت اخبار منفی محلی               ۱۰٪   تیترهای ۲۴ ساعت رسانه‌های اقتصادی ایران با واژه‌های منفی در زمینهٔ ارز/رمزارز/اینترنت

  سبز < ۳۳ ≤ زرد < ۶۰ ≤ قرمز

منابع: کانال‌های عمومی @ttprice ، @NerkhDollarIRT ، @USDTTetherp (همان فیدهای ربات)، IODA (Georgia Tech)،
       data/news.json (بخش منطقه‌ای)، Binance.
خروجی: data/friction.json  (+ تاریخچهٔ ساعتی ۶۰ روزه)
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reality_common as R  # noqa: E402

W = {"c1": 0.40, "c2": 0.30, "c3": 0.20, "c4": 0.10}
# negative events — market-movement words (crash, rally…) are deliberately NOT here: this is about access and rules, not price
NEG = re.compile(r"تحریم|مسدود|بلوکه|فیلتر|قطع(ی)?\s*(اینترنت|سرویس|ارتباط)|اختلال|محدودیت|ممنوع|توقف|تعلیق|هک|کلاهبرداری|"
                 r"ورشکست|بازداشت|دستگیر|پلمب|جریمه|جهش\s*(دلار|ارز|نرخ)|رکورد\s*(دلار|ارز)|افزایش\s*نرخ\s*(دلار|ارز)|گرانی\s*دلار")
# Iran-specific context: crypto access (weight 1.5) or the toman / FX market (weight 1.0)
LOCAL_CRYPTO = re.compile(r"نوبیتکس|والکس|رمزینکس|بیت\s*پین|اکسیر|آبان\s*تتر|صرافی(\s*های)?\s*(ایرانی|داخلی|رمز\s*ارز|ارز\s*دیجیتال)|"
                          r"کاربران\s*ایرانی|\bتتر|درگاه|شاپرک|اینترنت|فیلترینگ|فیلتر\s*شکن|\bvpn")
LOCAL_FX = re.compile(r"دلار|ارزی|نرخ\s*ارز|بازار\s*ارز|تومان|ریال|بانک\s*مرکزی|مرکز\s*مبادله")


def comp_c1(snap):
    b = snap.get("bubble_pct")
    if b is None:
        return None, None
    return round(100 * R.clamp(abs(b) / 5.0), 1), round(b, 3)


def comp_c2(snap):
    a = snap.get("arb_pct")
    if a is None:
        return None, None
    return round(100 * R.clamp(max(0.0, a) / 2.0), 1), round(a, 3)


def comp_c3(m, age, awake):
    parts = []
    if m.get("ping") is not None:
        parts.append(R.clamp((1 - m["ping"]) / 0.65))
    if m.get("bgp") is not None:
        parts.append(R.clamp((1 - m["bgp"]) / 0.40))
    stale = age is not None and awake and age > 75
    if stale:
        parts.append(0.5)
    if not parts:
        return None
    return round(100 * max(parts), 1)


def comp_c4(news, now):
    items = (news.get("regional") or {}).get("items", []) if isinstance(news.get("regional"), dict) else []
    cut = R.iso(now - R.timedelta(hours=24))
    hits = []
    for it in items:
        if (it.get("date") or "") < cut or it.get("own"):
            continue
        t = R.norm_fa(it.get("title", ""))
        if not NEG.search(t):
            continue
        w = 1.5 if LOCAL_CRYPTO.search(t) else 1.0 if LOCAL_FX.search(t) else 0
        if w:
            hits.append({"title": it.get("title", "")[:160], "url": it.get("url"), "source": it.get("source"), "w": w,
                         "date": it.get("date")})
    score = round(100 * R.clamp(sum(h["w"] for h in hits) / 8.0), 1)
    return score, sorted(hits, key=lambda h: (h["w"], h["date"] or ""), reverse=True)[:8]


def level(total):
    return "green" if total < 33 else "yellow" if total < 60 else "red"


def main():
    now = R.now()
    import bot_iran as IR          # same Iranian feeds as the Telegram bot (public channels via t.me/s)
    import bot_outage as OUT       # IODA readiness check used by the bot
    prev = R.load("friction.json", {})
    snap = {}
    try:
        snap = IR.snapshot() or {}
    except Exception as ex:  # noqa: BLE001
        print("  iran snapshot failed:", ex)
    try:
        ioda = OUT.ioda_metrics() or {}
    except Exception as ex:  # noqa: BLE001
        print("  ioda failed:", ex)
        ioda = {}
    try:
        age = OUT.feed_age_min(snap) if snap else None
        awake = OUT._iran_awake()
    except Exception:  # noqa: BLE001
        age, awake = None, False

    c1, bubble = comp_c1(snap)
    c2, arb = comp_c2(snap)
    c3 = comp_c3(ioda, age, awake)
    c4, news_hits = comp_c4(R.load("news.json", {}), now)
    comps = {"c1": c1, "c2": c2, "c3": c3, "c4": c4}
    have = {k: v for k, v in comps.items() if v is not None}
    total = None
    if have:   # missing components are left out and the weights of the rest are re-normalised (shown on the page)
        total = round(sum(W[k] * v for k, v in have.items()) / sum(W[k] for k in have), 1)

    # «on paper» vs «in Iran»: BTC priced with the free dollar vs BTC priced with Iranian tether
    tt = snap.get("tt") or {}
    btc_usdt = (tt.get("crypto") or {}).get("BTC")
    gl = None
    try:
        gl = R.klines("BTC", "1m", limit=1)[0]["c"]
    except Exception as ex:  # noqa: BLE001
        print("  binance btc:", ex)
    paper = {}
    if snap.get("usd") and gl:
        paper["btc_paper"] = round(gl * snap["usd"])
    if snap.get("usdt") and (btc_usdt or gl):
        paper["btc_iran"] = round((btc_usdt or gl) * snap["usdt"])
    if paper.get("btc_paper") and paper.get("btc_iran"):
        paper["gap_pct"] = round((paper["btc_iran"] / paper["btc_paper"] - 1) * 100, 3)
    if snap.get("usdt") and snap.get("usd"):
        paper["cost_1000"] = {"via_usdt": round(1000 * snap["usdt"]), "via_usd": round(1000 * snap["usd"])}

    ex = [{"name": e["name"], "latin": IR.EX_LATIN.get(e["name"], e["name"]), "buy": e["buy"], "sell": e["sell"],
           "sanctioned": bool(e.get("sanctioned")), "spread_pct": round((e["sell"] / e["buy"] - 1) * 100, 3) if e.get("buy") else None}
          for e in snap.get("exchanges", [])]
    hist = prev.get("history", [])
    if total is not None and (not hist or (now - R.parse_iso(hist[-1][0])).total_seconds() >= 55 * 60):
        hist.append([R.iso(now), total, c1, c2, c3, c4, bubble, arb])
    cut = R.iso(now - R.timedelta(days=60))
    hist = [h for h in hist if h[0] >= cut]
    out = {"updated_at": R.iso(now), "score": total, "level": None if total is None else level(total),
           "components": [
               {"id": "c1", "w": W["c1"], "score": c1, "value": bubble, "unit": "%"},
               {"id": "c2", "w": W["c2"], "score": c2, "value": arb, "unit": "%"},
               {"id": "c3", "w": W["c3"], "score": c3, "value": {"ping": ioda.get("ping"), "bgp": ioda.get("bgp"),
                                                                  "feed_age_min": None if age is None else round(age)}, "unit": ""},
               {"id": "c4", "w": W["c4"], "score": c4, "value": len(news_hits), "unit": "n"}],
           "prices": {"usdt": None if not snap.get("usdt") else round(snap["usdt"]), "usd": None if not snap.get("usd") else round(snap["usd"]),
                      "usdt_time": snap.get("usdt_time"), "usd_time": snap.get("usd_time"), "board_time": tt.get("time"),
                      "best_buy": (snap.get("best_buy_from") or {}).get("name"), "best_sell": (snap.get("best_sell_to") or {}).get("name"),
                      "gold18": ((tt.get("fiat") or {}).get("GOLD_18") or [None])[0], "coin": ((tt.get("fiat") or {}).get("COIN_EMAMI") or [None])[0]},
           "paper": paper, "exchanges": ex, "news": news_hits, "history": hist,
           "sources": {"prices": "t.me/ttprice · t.me/NerkhDollarIRT · t.me/USDTTetherp", "access": "IODA (Georgia Tech) country IR",
                       "news": "regional feeds of data/news.json"}}
    R.save("friction.json", out)
    print(f"friction: {total} ({out['level']}) c1={c1} (bubble {bubble}%) c2={c2} (arb {arb}%) c3={c3} {ioda} age={age} "
          f"c4={c4} ({len(news_hits)} headlines) paper={paper}")


if __name__ == "__main__":
    main()
