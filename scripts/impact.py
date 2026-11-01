#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
کارنامهٔ واقعی پست‌ها و سیگنال‌ها (داده از Binance، رایگان)

برای هر پستی که دربارهٔ یک کوین است، قیمت لحظهٔ انتشار و حرکت قیمت بعد از
۱، ۴ و ۲۴ ساعت + بیشترین حرکت مثبت/منفی (MFE/MAE) ثبت می‌شود.
اگر پست یک سیگنال ساختاریافته باشد (جهت + ورود + حد ضرر/هدف)، برخورد به
هدف یا حد ضرر هم بررسی می‌شود.

خروجی: data/impact.json   { "<post id>": {...} }
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from market import klines  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS = os.path.join(ROOT, "data", "posts.json")
OUT = os.path.join(ROOT, "data", "impact.json")
TRADABLE = {"BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "TON", "ADA", "AVAX", "LINK", "DOT", "TRX", "LTC",
            "NEAR", "SUI", "APT", "ARB", "OP", "PEPE", "SHIB", "UNI", "ATOM", "HYPE"}
MAX_CALLS = int(os.environ.get("IMPACT_MAX_CALLS", "120"))
DAYS = int(os.environ.get("IMPACT_DAYS", "90"))

FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩٫٬", "01234567890123456789.,")
NUM = r"(\d[\d,]*(?:\.\d+)?)"


def num(s):
    try:
        return float(s.replace(",", ""))
    except ValueError:
        return None


def parse_signal(text):
    """سیگنال ساختاریافته: جهت + ورود + (حد ضرر یا هدف). در غیر این صورت None"""
    t = text.translate(FA_DIGITS)
    side = "long" if re.search(r"لانگ|\blong\b|خرید|buy", t, re.I) else \
        "short" if re.search(r"شورت|\bshort\b|فروش|sell", t, re.I) else None
    entry = re.search(r"(?:ورود|نقطه ورود|entry|خرید در)\s*[:：]?\s*" + NUM, t, re.I)
    sl = re.search(r"(?:حد\s*ضرر|استاپ|stop\s*loss|\bsl\b)\s*[:：]?\s*" + NUM, t, re.I)
    tps = re.findall(r"(?:حد\s*سود|تارگت|هدف|take\s*profit|\btp)\s*(?:\d\s*[:：)\-]\s*)?[:：]?\s*" + NUM, t, re.I)
    if not (side and entry and (sl or tps)):
        return None
    return {"side": side, "entry": num(entry.group(1)), "sl": num(sl.group(1)) if sl else None,
            "tps": [x for x in (num(v) for v in tps) if x]}


def evaluate(post, coin, bars):
    t0 = datetime.fromisoformat(post["date"]).timestamp() * 1000
    bars = [b for b in bars if b["t"] + 3600_000 > t0]
    if not bars:
        return None
    p0 = bars[0]["o"]
    res = {"coin": coin, "p0": p0, "t0": int(t0)}
    for h in (1, 4, 24):
        if len(bars) > h:
            res[f"r{h}h"] = round((bars[h]["c"] / p0 - 1) * 100, 3)
    win = bars[:25]
    res["mfe"] = round((max(b["h"] for b in win) / p0 - 1) * 100, 3)
    res["mae"] = round((min(b["l"] for b in win) / p0 - 1) * 100, 3)
    res["complete"] = len(bars) >= 25
    sig = parse_signal(post["text"])
    if sig:
        out = "open"
        for b in bars:
            hit_sl = sig["sl"] and ((sig["side"] == "long" and b["l"] <= sig["sl"]) or (sig["side"] == "short" and b["h"] >= sig["sl"]))
            hit_tp = sig["tps"] and ((sig["side"] == "long" and b["h"] >= sig["tps"][0]) or (sig["side"] == "short" and b["l"] <= sig["tps"][0]))
            if hit_sl and hit_tp:
                out = "ambiguous"
                break
            if hit_sl:
                out = "stop"
                break
            if hit_tp:
                out = "tp1"
                break
        sig["result"] = out
        res["signal"] = sig
    return res


def main():
    posts = json.load(open(POSTS, encoding="utf-8"))
    data = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
    cutoff = datetime.now(timezone.utc) - timedelta(days=DAYS)
    calls = 0
    for p in posts:
        if calls >= MAX_CALLS:
            break
        if not p.get("date"):
            continue
        d = datetime.fromisoformat(p["date"])
        if d < cutoff:
            continue
        coins = [c for c in p.get("coins", []) if c in TRADABLE]
        if not coins:
            continue
        key = str(p["id"])
        if data.get(key, {}).get("complete") and not (data[key].get("signal", {}).get("result") == "open"):
            continue
        coin = coins[0]
        try:
            bars = klines(coin, "1h", 200, start=d.timestamp() * 1000 - 3600_000)
            calls += 1
            r = evaluate(p, coin, bars)
            if r:
                data[key] = r
        except Exception as e:  # noqa: BLE001
            print(f"{key} {coin}: {e}", file=sys.stderr)
        time.sleep(0.12)
    json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    sigs = [v for v in data.values() if v.get("signal")]
    print(f"impact records={len(data)} api_calls={calls} signals={len(sigs)}")


if __name__ == "__main__":
    main()
