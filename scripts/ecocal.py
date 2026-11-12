#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The full economic calendar for /market/ (calendar panel + flags on the charts) → data/ecocal.json

Source: ForexFactory's public weekly feed (the same feed scripts/events.py reads, through events.fetch()):
every currency and every impact level, this week. The feed only ever covers the current week, so each run keeps what
it saw before: the file grows into a history (kept for 26 weeks), seeded once from data/events.json.
For past events: Bitcoin's move from the open of the event's UTC hour, 1 h and 4 h later (Binance 1 h candles,
ONE request per run). That is co-movement, never a claim of cause. No actual values: the feed has none, so none
are shown. Titles are translated by scripts/ecocal_tr.py (dictionary; untranslatable titles stay English).
Output keys are short on purpose (the file is downloaded by visitors): t unix s, c currency, i H/M/L/X, n title,
tr {fa,ckb,ar}, f forecast, p previous, b1/b4 BTC % from the event hour.
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ecocal_tr import translate  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "ecocal.json")
OLD = os.path.join(ROOT, "data", "events.json")
KEEP_DAYS = 182
IMP = {"High": "H", "Medium": "M", "Low": "L", "Holiday": "X", "Non-Economic": "L"}


def key(e):
    return f'{e["t"]}|{e["c"]}|{e["n"]}'


def to_event(x):
    try:
        d = datetime.fromisoformat(x["date"]).astimezone(timezone.utc)
    except (ValueError, KeyError, TypeError):
        return None
    c = str(x.get("country") or "").upper()[:3]
    if c == "ALL":
        c = "ALL"
    if not (len(c) == 3 and c.isalpha()):
        return None
    e = {"t": int(d.timestamp()), "c": c, "i": IMP.get(x.get("impact"), "L"), "n": str(x.get("title") or "").strip()[:120]}
    if not e["n"]:
        return None
    if x.get("forecast"):
        e["f"] = str(x["forecast"])[:24]
    if x.get("previous"):
        e["p"] = str(x["previous"])[:24]
    return e


def measure(k, t):
    """k: Binance 1 h candles [{t ms, o, c}] sorted; t: event unix s → {b1, b4} % from the open of the event's hour"""
    h0 = t // 3600 * 3600 * 1000
    idx = {b["t"]: i for i, b in enumerate(k)}
    i = idx.get(h0)
    out = {}
    if i is None:
        return out
    p0 = k[i]["o"]
    if p0 and i + 1 < len(k):           # the event hour must be closed: the next candle exists
        out["b1"] = round((k[i]["c"] / p0 - 1) * 100, 2)
    if p0 and i + 4 < len(k) and k[i + 3]["t"] == h0 + 3 * 3600_000:
        out["b4"] = round((k[i + 3]["c"] / p0 - 1) * 100, 2)
    return out


def week_of(t):
    """ForexFactory's week: Sunday 00:00 to the next Sunday 00:00, New York time"""
    from zoneinfo import ZoneInfo
    d = datetime.fromtimestamp(t, ZoneInfo("America/New_York"))
    start = (d - timedelta(days=(d.weekday() + 1) % 7)).replace(hour=0, minute=0, second=0, microsecond=0)
    return int(start.timestamp()), int((start + timedelta(days=7)).timestamp())


def merge(store, fresh):
    """the feed's week is replaced as a whole (a moved or cancelled event disappears); other weeks are kept"""
    if not fresh:
        return store
    lo, hi = week_of(min(e["t"] for e in fresh))[0], week_of(max(e["t"] for e in fresh))[1] - 1
    kept = {k: e for k, e in store.items() if not (lo <= e["t"] <= hi)}
    for e in fresh:
        old = store.get(key(e), {})
        for m in ("b1", "b4"):
            if m in old:
                e[m] = old[m]
        kept[key(e)] = e
    return kept


def seed(store):
    """first run: the USD high/medium history that scripts/events.py already measured"""
    try:
        j = json.load(open(OLD, encoding="utf-8"))
    except (OSError, ValueError):
        return store
    for x in j.get("events", []):
        e = to_event({"date": x.get("date"), "country": "USD", "impact": x.get("impact"), "title": x.get("title"),
                      "forecast": x.get("forecast"), "previous": x.get("previous")})
        if not e:
            continue
        if x.get("btc_1h") is not None:
            e["b1"] = x["btc_1h"]
        if x.get("btc_4h") is not None:
            e["b4"] = x["btc_4h"]
        store.setdefault(key(e), e)
    return store


def main(fetch=None, klines=None, now=None):
    now = now or datetime.now(timezone.utc)
    try:
        old = json.load(open(OUT, encoding="utf-8"))
        store = {key(e): e for e in old.get("events", [])}
        since = old.get("since")
    except (OSError, ValueError):
        store, since = seed({}), None
    err = None
    if fetch is None:
        from events import fetch  # noqa: E402  (ForexFactory JSON, XML fallback)
    try:
        fresh = [e for e in (to_event(x) for x in fetch()) if e]
        store = merge(store, fresh)
    except Exception as ex:  # noqa: BLE001
        err = str(ex)[:200]
        print("calendar fetch failed:", err)
    cut = int((now - timedelta(days=KEEP_DAYS)).timestamp())
    evs = sorted((e for e in store.values() if e["t"] >= cut), key=lambda e: (e["t"], e["c"], e["n"]))
    need = [e for e in evs if e["t"] < now.timestamp() - 3600 and ("b1" not in e or ("b4" not in e and e["t"] < now.timestamp() - 4 * 3600))
            and e["t"] > now.timestamp() - 40 * 86400]
    if need:
        if klines is None:
            from market import klines  # noqa: E402
        try:
            k = klines("BTC", "1h", 1000)
            for e in need:
                e.update(measure(k, e["t"]))
        except Exception as ex:  # noqa: BLE001
            print("klines:", ex)
    for e in evs:
        tr = translate(e["n"])
        if tr:
            e["tr"] = tr
        else:
            e.pop("tr", None)
    out = {"updated_at": now.isoformat(), "source": "ForexFactory weekly calendar", "error": err,
           "since": since or (datetime.fromtimestamp(evs[0]["t"], timezone.utc).isoformat() if evs else None),
           "note": "b1/b4 = Bitcoin % from the open of the event's UTC hour, 1 h and 4 h later (co-movement, not cause)",
           "events": evs}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    up = sum(1 for e in evs if e["t"] >= now.timestamp())
    print(f"ecocal: {len(evs)} events ({up} upcoming), translated {sum(1 for e in evs if 'tr' in e)}, measured {sum(1 for e in evs if 'b1' in e)}")
    return out


if __name__ == "__main__":
    main()
