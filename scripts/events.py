#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
تقویم رویدادها + سنجش واکنش بازار (News Impact)

منبع: تقویم اقتصادی هفتگی ForexFactory (فید عمومی JSON/XML، بدون کلید)
  - فقط رویدادهای دلار آمریکا با اهمیت High/Medium (CPI، FOMC، NFP، PPI، GDP، سخنرانی فدرال رزرو...)
  - زمان باقی‌مانده تا رویداد
  - بعد از انتشار: حرکت BTC در ۱ و ۴ ساعت بعد از رویداد (کندل‌های Binance) — هم‌زمانی، نه علیت
  - تاریخچهٔ رویدادهای گذشته نگه داشته می‌شود تا «واکنش معمول بازار» به هر نوع رویداد سنجیده شود
خروجی: data/events.json
"""
import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta
from xml.etree import ElementTree as ET

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from market import klines  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "events.json")
UA = {"User-Agent": "Mozilla/5.0 (entekhab.net calendar bot)"}
SOURCES = ["https://nfs.faireconomy.media/ff_calendar_thisweek.json",
           "https://nfs.faireconomy.media/ff_calendar_thisweek.xml"]
FA = {"CPI": "تورم مصرف‌کننده (CPI)", "Core CPI": "تورم هسته (Core CPI)", "PPI": "تورم تولیدکننده (PPI)",
      "Non-Farm": "اشتغال غیرکشاورزی (NFP)", "Unemployment": "نرخ بیکاری", "FOMC": "جلسهٔ فدرال رزرو (FOMC)",
      "Federal Funds Rate": "نرخ بهرهٔ فدرال رزرو", "GDP": "تولید ناخالص داخلی (GDP)", "Retail Sales": "خرده‌فروشی",
      "PCE": "شاخص PCE", "Jobless Claims": "درخواست بیمهٔ بیکاری", "ISM": "شاخص ISM", "Powell": "سخنرانی پاول",
      "JOLTS": "فرصت‌های شغلی (JOLTS)", "Consumer Sentiment": "اعتماد مصرف‌کننده"}


def kind(title):
    for k in FA:
        if k.lower() in title.lower():
            return k
    return "other"


def fetch():
    last = None
    for u in SOURCES:
        try:
            r = requests.get(u, headers=UA, timeout=20)
            r.raise_for_status()
            if u.endswith(".json"):
                rows = r.json()
                return [{"title": x["title"], "country": x["country"], "impact": x["impact"], "date": x["date"],
                         "forecast": x.get("forecast") or "", "previous": x.get("previous") or ""} for x in rows]
            root = ET.fromstring(r.content)
            rows = []
            for e in root.findall(".//event"):
                g = lambda t: (e.findtext(t) or "").strip()  # noqa: E731
                if not g("time") or ":" not in g("time"):
                    continue
                dt = datetime.strptime(f'{g("date")} {g("time")}', "%m-%d-%Y %I:%M%p").replace(tzinfo=timezone.utc)
                rows.append({"title": g("title"), "country": g("country"), "impact": g("impact"), "date": dt.isoformat(),
                             "forecast": g("forecast"), "previous": g("previous")})
            return rows
        except Exception as e:  # noqa: BLE001
            last = e
    raise RuntimeError(last)


BASE_DAYS = 14
MIN_TEST = 10


def _rng(c):
    return (max(b["h"] for b in c) / min(b["l"] for b in c) - 1) * 100


def measure(k, t0):
    """k: 1h candles (sorted). t0: event time in ms. Returns btc_1h/btc_4h/btc_range_4h for the event hour and
    base_range_4h = mean 4h range of the same clock window on each of the previous BASE_DAYS days."""
    idx = {b["t"]: i for i, b in enumerate(k)}
    h0 = int(t0 // 3600_000 * 3600_000)
    out = {}
    i = idx.get(h0)
    if i is None:
        return out
    p0 = k[i]["o"]
    if len(k) > i + 1:
        out["btc_1h"] = round((k[i]["c"] / p0 - 1) * 100, 2)
    if len(k) > i + 4:
        out["btc_4h"] = round((k[i + 3]["c"] / p0 - 1) * 100, 2)
        out["btc_range_4h"] = round(_rng(k[i:i + 4]), 2)
    base = []
    for j in range(1, BASE_DAYS + 1):
        b = idx.get(h0 - j * 86400_000)
        if b is not None and b + 4 <= len(k) and k[b + 3]["t"] == k[b]["t"] + 3 * 3600_000:
            base.append(_rng(k[b:b + 4]))
    if len(base) >= BASE_DAYS // 2:
        out["base_range_4h"] = round(sum(base) / len(base), 2)
    return out


def sign_p(k, n):
    """Exact two-sided binomial (sign) test, H0 p=0.5."""
    from math import comb
    if n == 0:
        return None
    tail = sum(comb(n, i) for i in range(0, min(k, n - k) + 1)) / 2 ** n
    return round(min(1.0, 2 * tail), 4)


def reaction_stats(evs):
    stats, pairs = {}, []
    for e in evs:
        if "btc_range_4h" in e:
            s = stats.setdefault(e["kind"], {"r": [], "b": []})
            s["r"].append(e["btc_range_4h"])
            if "base_range_4h" in e:
                s["b"].append(e["base_range_4h"])
                pairs.append((e["btc_range_4h"], e["base_range_4h"]))
    out = {}
    for k, v in stats.items():
        o = {"n": len(v["r"]), "avg_range_4h": round(sum(v["r"]) / len(v["r"]), 2)}
        if v["b"]:
            o["avg_base_4h"] = round(sum(v["b"]) / len(v["b"]), 2)
            o["n_base"] = len(v["b"])
        out[k] = o
    n = len([p for p in pairs if p[0] != p[1]])
    up = sum(1 for r, b in pairs if r > b)
    out["_all"] = {"n": len(pairs), "wider": up, "min_n": MIN_TEST, "base_days": BASE_DAYS,
                   "avg_range_4h": round(sum(r for r, _ in pairs) / len(pairs), 2) if pairs else None,
                   "avg_base_4h": round(sum(b for _, b in pairs) / len(pairs), 2) if pairs else None,
                   "p": sign_p(up, n) if len(pairs) >= MIN_TEST else None,
                   "test": "two-sided exact sign test: event 4h range vs the mean range of the same UTC window on the previous 14 days"}
    return out


def main():
    old = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {"events": []}
    store = {f'{e["date"]}|{e["title"]}': e for e in old.get("events", [])}
    err = None
    try:
        for x in fetch():
            if x["country"] != "USD" or x["impact"] not in ("High", "Medium"):
                continue
            try:
                d = datetime.fromisoformat(x["date"]).astimezone(timezone.utc)
            except ValueError:
                continue
            key = f'{d.isoformat()}|{x["title"]}'
            e = store.get(key, {})
            e.update({"title": x["title"], "title_fa": FA.get(kind(x["title"]), ""), "kind": kind(x["title"]),
                      "impact": x["impact"], "date": d.isoformat(), "forecast": x["forecast"], "previous": x["previous"]})
            store[key] = e
    except Exception as ex:  # noqa: BLE001
        err = str(ex)[:200]
        print("calendar fetch failed:", err)
    now = datetime.now(timezone.utc)
    calls = 0
    for e in store.values():   # واکنش BTC بعد از رویداد + دامنهٔ «عادی» همان ساعت در ۱۴ روز قبل (خط پایه)
        d = datetime.fromisoformat(e["date"])
        need = "btc_4h" not in e or "base_range_4h" not in e
        if d < now - timedelta(hours=4, minutes=5) and need and calls < 20 and d > now - timedelta(days=30):
            try:
                k = klines("BTC", "1h", BASE_DAYS * 24 + 6, start=(d - timedelta(days=BASE_DAYS, hours=1)).timestamp() * 1000)
                calls += 1
                e.update(measure(k, d.timestamp() * 1000))
            except Exception as ex:  # noqa: BLE001
                print("klines:", ex)
    evs = sorted(store.values(), key=lambda e: e["date"])
    evs = [e for e in evs if datetime.fromisoformat(e["date"]) > now - timedelta(days=120)]
    stats = reaction_stats(evs)
    json.dump({"updated_at": now.isoformat(), "source": "ForexFactory weekly calendar", "error": err,
               "events": evs, "reaction_stats": stats}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    up = [e for e in evs if datetime.fromisoformat(e["date"]) >= now]
    print(f"events stored {len(evs)}, upcoming {len(up)}, measured {sum(1 for e in evs if 'btc_4h' in e)}")


if __name__ == "__main__":
    main()
