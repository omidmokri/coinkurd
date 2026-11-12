#!/usr/bin/env python3
"""scripts/ecocal.py on synthetic data (no network): conversion, Bitcoin move from the event hour (hand-checked),
history merge (moved events replaced, old weeks kept, measurements kept), translation, seeding, retention.
Run: python3 tests/test_ecocal.py"""
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
import ecocal  # noqa: E402

fails = 0


def check(name, cond, extra=""):
    global fails
    print(("PASS " if cond else "FAIL ") + name + (f" — {extra}" if extra and not cond else ""))
    fails += 0 if cond else 1


tmp = tempfile.mkdtemp()
ecocal.OUT = os.path.join(tmp, "ecocal.json")
ecocal.OLD = os.path.join(tmp, "events.json")
json.dump({"events": [{"date": "2026-11-02T15:00:00+00:00", "title": "ISM Manufacturing PMI", "impact": "Medium", "forecast": "54.5",
                       "previous": "54.5", "btc_1h": -0.45, "btc_4h": -1.09}]}, open(ecocal.OLD, "w"))
NOW = datetime(2026, 11, 12, 15, 0, tzinfo=timezone.utc)
H = 3600


def candles(start_h, n):
    """1 h candles: open 100+i, close 101+i (so the move of the event hour is known exactly)"""
    return [{"t": (start_h + i * H) * 1000, "o": 100.0 + i, "c": 101.0 + i} for i in range(n)]


T0 = int(datetime(2026, 11, 9, tzinfo=timezone.utc).timestamp())
K = candles(T0, 24 * 3 + 16)                   # Nov 9 00:00 … Nov 12 15:00 (the 15:00 candle is still forming at NOW)
week1 = [
    {"title": "CPI m/m", "country": "USD", "date": "2026-11-10T08:30:00-05:00", "impact": "High", "forecast": "0.3%", "previous": "0.2%"},
    {"title": "German Prelim CPI m/m", "country": "EUR", "date": "2026-11-11T08:00:00+00:00", "impact": "Medium", "forecast": "", "previous": "0.1%"},
    {"title": "Some Brand New Gauge", "country": "GBP", "date": "2026-11-11T09:00:00+00:00", "impact": "Low"},
    {"title": "G7 Meetings", "country": "All", "date": "2026-11-12T12:30:00+00:00", "impact": "Holiday"},
    {"title": "Retail Sales m/m", "country": "USD", "date": "2026-11-13T13:30:00+00:00", "impact": "High"},
]
out = ecocal.main(fetch=lambda: week1, klines=lambda *a: K, now=NOW)
ev = {e["n"]: e for e in out["events"]}
check("seeded from events.json on the first run", "ISM Manufacturing PMI" in ev and ev["ISM Manufacturing PMI"].get("b1") == -0.45)
cpi = ev.get("CPI m/m", {})
check("08:30 New York time → 13:30 UTC", cpi.get("t") == int(datetime(2026, 11, 10, 13, 30, tzinfo=timezone.utc).timestamp()), cpi)
check("impact High → H, holiday → X, 'All' kept", cpi.get("i") == "H" and ev["G7 Meetings"]["i"] == "X" and ev["G7 Meetings"]["c"] == "ALL")
# CPI at 13:30 UTC on Nov 10: hour candle index = 24 + 13 = 37 → open 137, close 138; 4 h later close = 141
check("b1 = close/open − 1 of the event hour (138/137)", cpi.get("b1") == round((138 / 137 - 1) * 100, 2), cpi)
check("b4 = close of the 4th hour / open of the event hour (141/137)", cpi.get("b4") == round((141 / 137 - 1) * 100, 2), cpi)
g7 = ev["G7 Meetings"]
# G7 at 12:30 on Nov 12: hour candle index 72 + 12 = 84 (open 184, close 185); at 15:00 its 4 h window (12–16) is not over
check("an event at 12:30 is measured at 1 h (13:00 closed) but not at 4 h yet (needs 16:00)", g7.get("b1") == round((185 / 184 - 1) * 100, 2) and "b4" not in g7, g7)
check("a future event has no Bitcoin move", "b1" not in ev["Retail Sales m/m"])
check("translated titles carry fa/ckb/ar", ev["German Prelim CPI m/m"].get("tr", {}).get("fa") == "تورم مصرف‌کننده (CPI) ماهانه آلمان (مقدماتی)")
check("an unknown title stays English only", "tr" not in ev["Some Brand New Gauge"])
check("forecast/previous kept, empty ones dropped", cpi.get("f") == "0.3%" and "f" not in ev["German Prelim CPI m/m"])

# second run: CPI moved by an hour, the brand-new gauge cancelled; last week's ISM must stay; measurements must stay
week1b = [dict(x) for x in week1 if x["title"] != "Some Brand New Gauge"]
week1b[0]["date"] = "2026-11-10T09:30:00-05:00"
out2 = ecocal.main(fetch=lambda: week1b, klines=lambda *a: K, now=NOW)
ev2 = [e for e in out2["events"]]
names = [e["n"] for e in ev2]
check("a moved event replaces the old one (no duplicate)", names.count("CPI m/m") == 1 and [e for e in ev2 if e["n"] == "CPI m/m"][0]["t"] == cpi["t"] + 3600)
check("a cancelled event inside the feed's week disappears", "Some Brand New Gauge" not in names)
check("weeks outside the feed are kept", "ISM Manufacturing PMI" in names)
check("existing measurements survive a run", [e for e in ev2 if e["n"] == "German Prelim CPI m/m"][0].get("b1") == ev["German Prelim CPI m/m"].get("b1"))

# a failed fetch keeps the file as it was and says so
out3 = ecocal.main(fetch=lambda: (_ for _ in ()).throw(RuntimeError("feed down")), klines=lambda *a: K, now=NOW)
check("a failed fetch keeps every event and records the error", len(out3["events"]) == len(ev2) and "feed down" in (out3["error"] or ""))

# retention
far = datetime(2027, 6, 1, tzinfo=timezone.utc)
out4 = ecocal.main(fetch=lambda: [], klines=lambda *a: [], now=far)
check("events older than 26 weeks are dropped", all(e["t"] >= int(far.timestamp()) - 182 * 86400 for e in out4["events"]) and not out4["events"])
print("OK" if not fails else f"{fails} failures")
sys.exit(1 if fails else 0)
