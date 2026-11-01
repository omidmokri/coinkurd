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
    for e in store.values():   # واکنش BTC بعد از رویداد
        d = datetime.fromisoformat(e["date"])
        if d < now - timedelta(hours=4, minutes=5) and "btc_4h" not in e and calls < 20 and d > now - timedelta(days=30):
            try:
                k = klines("BTC", "1h", 6, start=(d - timedelta(hours=1)).timestamp() * 1000)
                calls += 1
                base = next((b for b in k if b["t"] <= d.timestamp() * 1000 < b["t"] + 3600_000), None)
                if base:
                    i = k.index(base)
                    p0 = base["o"]
                    if len(k) > i + 1:
                        e["btc_1h"] = round((k[i]["c"] / p0 - 1) * 100, 2)
                    if len(k) > i + 4:
                        e["btc_4h"] = round((k[i + 3]["c"] / p0 - 1) * 100, 2)
                        e["btc_range_4h"] = round((max(b["h"] for b in k[i:i + 4]) / min(b["l"] for b in k[i:i + 4]) - 1) * 100, 2)
            except Exception as ex:  # noqa: BLE001
                print("klines:", ex)
    evs = sorted(store.values(), key=lambda e: e["date"])
    evs = [e for e in evs if datetime.fromisoformat(e["date"]) > now - timedelta(days=120)]
    stats = {}
    for e in evs:
        if "btc_range_4h" in e:
            s = stats.setdefault(e["kind"], [])
            s.append(e["btc_range_4h"])
    stats = {k: {"n": len(v), "avg_range_4h": round(sum(v) / len(v), 2)} for k, v in stats.items()}
    json.dump({"updated_at": now.isoformat(), "source": "ForexFactory weekly calendar", "error": err,
               "events": evs, "reaction_stats": stats}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    up = [e for e in evs if datetime.fromisoformat(e["date"]) >= now]
    print(f"events stored {len(evs)}, upcoming {len(up)}, measured {sum(1 for e in evs if 'btc_4h' in e)}")


if __name__ == "__main__":
    main()
