#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Daily history of the non-crypto markets, kept on our own site: gold, silver, the main US indices, the dollar index,
the main currency pairs and a few large stocks. Writes data/markets/<ID>.json and data/markets/index.json, which the
/market page and the monthly analyzer read instead of calling outside services from the visitor's browser.

Every source here is free and needs no key, and each was tested from GitHub's runners on 2026-11-27
(see /mnt/project-files/market-plan/probe-gha-2026-11-27.txt in the project files):
  - Yahoo Finance chart API: futures, indices, stocks, FX. Unofficial, and Yahoo's terms don't cover automated use,
    so it is never the only source where a second one exists.
  - FRED (St. Louis Fed) public CSV: S&P 500, Nasdaq 100, Dow Jones, close only.
  - ECB reference rates (via Frankfurter, and the ECB's own SDMX API): EUR/USD, GBP/USD, USD/JPY, close only.
  - OKX and Binance public candles: tokenised gold (XAUT, PAXG), close to spot gold.
  - Dukascopy datafeed: spot silver, hourly candles turned into days.

Rules that keep the data honest:
  - one file holds one source: series from different sources are never stitched together. When the first source
    fails, the next one in the list is used for the whole series, and the file says which source it is.
  - every bar is checked (finite, positive, high/low around open/close, dates rising); a bad bar is dropped and counted.
  - each run also reads the last close from the other sources and stores how far apart they are, so a source that
    drifts shows up.
  - nothing works: the old file stays, marked stale with its age; no file at all: marked unavailable. Never invented.

Runs at most every 6 hours (MARKETS_FORCE=1 to bypass). Never fails the workflow: errors are written into the files.
"""
import csv
import io
import json
import lzma
import os
import struct
import sys
import time
from datetime import datetime, timedelta, timezone

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "markets")
UA = {"User-Agent": "Mozilla/5.0 (compatible; entekhab.net market data; +https://entekhab.net)"}
EVERY = 6 * 3600
NOW = datetime.now(timezone.utc)


def N(fa, ckb, ar, en):
    return {"fa": fa, "ckb": ckb, "ar": ar, "en": en}


# id: name, unit, group, decimals, sources in order of preference: (kind, symbol, label)
INSTR = {
    "GOLD": (N("طلا (انس)", "زێڕ (ئۆنس)", "الذهب (أونصة)", "Gold (ounce)"), "USD/oz", "metal", 2,
             [("yahoo", "GC=F", "COMEX gold futures · Yahoo Finance"),
              ("okx", "XAUT-USDT", "Tether Gold (XAUT) · OKX"),
              ("binance", "PAXGUSDT", "Pax Gold (PAXG) · Binance")]),
    "SILVER": (N("نقره (انس)", "زیو (ئۆنس)", "الفضة (أونصة)", "Silver (ounce)"), "USD/oz", "metal", 3,
               [("yahoo", "SI=F", "COMEX silver futures · Yahoo Finance"),
                ("dukascopy", "XAGUSD", "Spot silver · Dukascopy")]),
    "SPX": (N("اس‌اند‌پی ۵۰۰", "ئێس ئەند پی ٥٠٠", "إس آند بي 500", "S&P 500"), "pts", "index", 2,
            [("yahoo", "^GSPC", "S&P 500 · Yahoo Finance"), ("fred", "SP500", "S&P 500 · FRED (close only)")]),
    "NDX": (N("نزدک ۱۰۰", "نازداک ١٠٠", "ناسداك 100", "Nasdaq 100"), "pts", "index", 2,
            [("yahoo", "^NDX", "Nasdaq 100 · Yahoo Finance"), ("fred", "NASDAQ100", "Nasdaq 100 · FRED (close only)")]),
    "DJI": (N("داوجونز", "داو جۆنز", "داو جونز", "Dow Jones"), "pts", "index", 2,
            [("yahoo", "^DJI", "Dow Jones · Yahoo Finance"), ("fred", "DJIA", "Dow Jones · FRED (close only)")]),
    "DXY": (N("شاخص دلار", "پێوەری دۆلار", "مؤشر الدولار", "US dollar index"), "pts", "index", 3,
            [("yahoo", "DX-Y.NYB", "US dollar index (ICE) · Yahoo Finance")]),
    "EURUSD": (N("یورو / دلار", "یۆرۆ / دۆلار", "اليورو / الدولار", "EUR/USD"), "USD", "fx", 4,
               [("frankfurter", "EUR:USD", "ECB reference rate · Frankfurter (close only)"),
                ("ecb", "EUR:USD", "ECB reference rate · ECB (close only)"),
                ("yahoo", "EURUSD=X", "EUR/USD · Yahoo Finance")]),
    "GBPUSD": (N("پوند / دلار", "پاوەند / دۆلار", "الجنيه / الدولار", "GBP/USD"), "USD", "fx", 4,
               [("frankfurter", "GBP:USD", "ECB reference rate · Frankfurter (close only)"),
                ("ecb", "GBP:USD", "ECB reference rate · ECB (close only)"),
                ("yahoo", "GBPUSD=X", "GBP/USD · Yahoo Finance")]),
    "USDJPY": (N("دلار / ین", "دۆلار / یەن", "الدولار / الين", "USD/JPY"), "JPY", "fx", 3,
               [("frankfurter", "USD:JPY", "ECB reference rate · Frankfurter (close only)"),
                ("ecb", "USD:JPY", "ECB reference rate · ECB (close only)"),
                ("yahoo", "JPY=X", "USD/JPY · Yahoo Finance")]),
}
# large US stocks: Yahoo is the only free source without a key that answers from GitHub, so they carry one source
for _s, _n in [("AAPL", "Apple"), ("MSFT", "Microsoft"), ("NVDA", "Nvidia"), ("AMZN", "Amazon"), ("GOOGL", "Alphabet"),
               ("META", "Meta"), ("TSLA", "Tesla")]:
    INSTR[_s] = (N(_n, _n, _n, _n), "USD", "stock", 2, [("yahoo", _s, _n + " · Yahoo Finance")])


# ------------------------------------------------------------------ sources: each returns [[t, o, h, l, c, v], ...]
def get(url, **kw):
    for i in range(3):                                     # a slow answer once is common; three tries, then give up
        try:
            r = requests.get(url, headers=UA, timeout=45, **kw)
            if r.status_code in (429, 500, 502, 503, 504) and i < 2:
                time.sleep(3 * (i + 1))
                continue
            r.raise_for_status()
            return r
        except requests.RequestException:
            if i == 2:
                raise
            time.sleep(3 * (i + 1))


def day(d):
    return int(datetime(d.year, d.month, d.day, tzinfo=timezone.utc).timestamp())


def ymd(s):
    return day(datetime.strptime(s[:10], "%Y-%m-%d"))


def yahoo(sym):
    url = "https://query1.finance.yahoo.com/v8/finance/chart/" + requests.utils.quote(sym, safe="")
    # range=max comes back monthly; an explicit start and end gives daily bars
    j = get(url, params={"period1": 0, "period2": int(time.time()) + 86400, "interval": "1d", "includePrePost": "false",
                         "events": ""}).json()
    res = (j.get("chart") or {}).get("result") or []
    if not res:
        raise ValueError("no result: %s" % ((j.get("chart") or {}).get("error") or "")[:120])
    r = res[0]
    ts, q = r.get("timestamp") or [], ((r.get("indicators") or {}).get("quote") or [{}])[0]
    off = int((r.get("meta") or {}).get("gmtoffset") or 0)
    out = []
    for i, t in enumerate(ts):
        try:
            o, h, l, c, v = q["open"][i], q["high"][i], q["low"][i], q["close"][i], q["volume"][i]
        except (KeyError, IndexError):
            continue
        if None in (o, h, l, c):
            continue
        # Yahoo stamps a daily bar at the exchange's open; the trading day is the local date
        out.append([day(datetime.fromtimestamp(t + off, timezone.utc)), o, h, l, c, v or 0])
    return out


def fred(series):
    r = get("https://fred.stlouisfed.org/graph/fredgraph.csv", params={"id": series})
    out = []
    for row in csv.reader(io.StringIO(r.text)):
        if len(row) < 2 or not row[0][:4].isdigit():
            continue
        try:
            c = float(row[1])
        except ValueError:                                  # FRED marks holidays with "."
            continue
        out.append([ymd(row[0]), c, c, c, c, 0])
    return out


def okx(inst):
    out, after = {}, ""
    for _ in range(40):                                     # 100 days a page, newest first; ~11 years at most
        p = {"instId": inst, "bar": "1Dutc", "limit": 100}
        if after:
            p["after"] = after
        d = get("https://www.okx.com/api/v5/market/history-candles", params=p).json().get("data") or []
        if not d:
            break
        for k in d:
            if len(k) > 8 and k[8] != "1":                  # the day still open is left out
                continue
            out[int(k[0]) // 1000] = [int(k[0]) // 1000, float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[5])]
        after = d[-1][0]
        time.sleep(0.15)
    return [out[k] for k in sorted(out)]


def binance(sym):
    out, start = {}, 0
    for _ in range(20):
        d = get("https://data-api.binance.vision/api/v3/klines",
                params={"symbol": sym, "interval": "1d", "limit": 1000, "startTime": start}).json()
        if not d:
            break
        for k in d:
            if k[6] / 1000 > time.time():                   # still open
                continue
            out[k[0] // 1000] = [k[0] // 1000, float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[5])]
        if len(d) < 1000:
            break
        start = d[-1][0] + 86400000
    return [out[k] for k in sorted(out)]


def ecb_pair(pair, rows):
    """rows: {date: {ccy: units per 1 EUR}} -> the pair as a close-only series"""
    a, b = pair.split(":")
    out = []
    for d in sorted(rows):
        r = dict(rows[d], EUR=1.0)
        if a in r and b in r and r[a] > 0:
            c = r[b] / r[a]
            out.append([ymd(d), c, c, c, c, 0])
    return out


_ECB = {}


def frankfurter(pair):
    if "fr" not in _ECB:
        j = get("https://api.frankfurter.app/1999-01-04..", params={"from": "EUR", "to": "USD,GBP,JPY"}).json()
        _ECB["fr"] = j.get("rates") or {}
    return ecb_pair(pair, _ECB["fr"])


def ecb(pair):
    if "ecb" not in _ECB:
        rows = {}
        for ccy in ("USD", "GBP", "JPY"):
            t = get("https://data-api.ecb.europa.eu/service/data/EXR/D.%s.EUR.SP00.A" % ccy,
                    params={"format": "csvdata", "startPeriod": "1999-01-01"}).text
            rd = csv.DictReader(io.StringIO(t))
            for r in rd:
                try:
                    rows.setdefault(r["TIME_PERIOD"], {})[ccy] = float(r["OBS_VALUE"])
                except (KeyError, ValueError):
                    continue
        _ECB["ecb"] = rows
    return ecb_pair(pair, _ECB["ecb"])


DUKA_POINT = {"XAGUSD": 1000.0, "XAUUSD": 1000.0}


def dukascopy(sym, months=36):
    """hourly candles, one file a month (months count from 0 in the address), added up into UTC days"""
    pt, days = DUKA_POINT[sym], {}
    y, m = NOW.year, NOW.month - 1
    fails = 0
    for _ in range(months):
        url = "https://datafeed.dukascopy.com/datafeed/%s/%d/%02d/BID_candles_hour_1.bi5" % (sym, y, m)
        try:
            raw = get(url).content
            data = lzma.decompress(raw, format=lzma.FORMAT_ALONE) if raw else b""
        except Exception:
            fails += 1
            if fails > 3:
                break
            data = b""
        base = int(datetime(y, m + 1, 1, tzinfo=timezone.utc).timestamp())
        for i in range(0, len(data) - 23, 24):
            t, o, c, l, h, v = struct.unpack(">5if", data[i:i + 24])
            if v <= 0:                                       # hours with no trades repeat the last price
                continue
            ts = base + t
            d = ts - ts % 86400
            o, c, l, h = o / pt, c / pt, l / pt, h / pt
            if d not in days:
                days[d] = [d, o, h, l, c, v]
            else:
                x = days[d]
                x[2], x[3], x[4], x[5] = max(x[2], h), min(x[3], l), c, x[5] + v
        m -= 1
        if m < 0:
            m, y = 11, y - 1
        time.sleep(0.2)
    today = day(NOW)
    return [days[k] for k in sorted(days) if k < today]


FETCH = {"yahoo": yahoo, "fred": fred, "okx": okx, "binance": binance, "frankfurter": frankfurter, "ecb": ecb,
         "dukascopy": dukascopy}


# ------------------------------------------------------------------ checks
def clean(rows, dec):
    """keep only bars that make sense; returns (bars, dropped)"""
    out, bad, last = [], 0, -1
    for r in sorted(rows, key=lambda x: x[0]):
        t, o, h, l, c, v = r
        ok = all(isinstance(x, (int, float)) and x == x and abs(x) != float("inf") for x in (o, h, l, c, v))
        if not ok or min(o, h, l, c) <= 0 or h < max(o, c) * (1 - 1e-9) or l > min(o, c) * (1 + 1e-9) or t <= last:
            bad += 1
            continue
        k = 10 ** dec
        out.append([int(t), round(o * k) / k, round(h * k) / k, round(l * k) / k, round(c * k) / k, round(v)])
        last = t
    return out, bad


def is_daily(bars):
    if len(bars) < 30:
        return False
    gaps = sorted(b[0] - a[0] for a, b in zip(bars[-200:], bars[-199:]))
    return gaps[len(gaps) // 2] <= 4 * 86400


def fresh(bars, days=7):
    return bool(bars) and NOW.timestamp() - bars[-1][0] <= days * 86400


# ------------------------------------------------------------------ main
def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def run_one(key, spec, old):
    name, unit, group, dec, srcs = spec
    tried, got = [], None
    for kind, sym, label in srcs:
        try:
            today = day(NOW)                                  # finished days only: today's bar is still moving
            bars, bad = clean([r for r in FETCH[kind](sym) if r[0] < today], dec)
            if not is_daily(bars):
                raise ValueError("not daily bars (%d rows)" % len(bars))
            if not fresh(bars):
                raise ValueError("last bar %s is too old" % datetime.fromtimestamp(bars[-1][0], timezone.utc).date())
            tried.append({"src": kind, "ok": True, "rows": len(bars), "dropped": bad, "last": [bars[-1][0], bars[-1][4]]})
            if got is None:                                   # the first that works is used; the rest only for the cross-check
                got = (kind, sym, label, bars, bad)
        except Exception as e:
            tried.append({"src": kind, "ok": False, "err": str(e)[:160]})
    o = {"id": key, "name": name, "unit": unit, "group": group, "tf": "1d", "checked_at": NOW.isoformat(timespec="seconds"),
         "tried": tried}
    if got:
        kind, sym, label, bars, bad = got
        o.update({"status": "ok", "src": {"id": kind, "sym": sym, "label": label}, "last_ok": o["checked_at"],
                  "close_only": all(b[1] == b[2] == b[3] == b[4] for b in bars[-20:]), "bars": bars})
        # how far the other sources' last close sits from this one, on the same day where they share one
        main = {b[0]: b[4] for b in bars[-10:]}
        cross = []
        for x in tried:
            if x["ok"] and x["src"] != kind and x.get("last"):
                t, c = x["last"]
                ref = main.get(t)
                cross.append({"src": x["src"], "t": t, "close": c,
                              "diff_pct": round((c / ref - 1) * 100, 3) if ref else None})
        o["cross"] = cross
    elif old and old.get("bars"):
        o.update({"status": "stale", "src": old.get("src"), "last_ok": old.get("last_ok"), "bars": old["bars"],
                  "close_only": old.get("close_only", False)})
    else:
        o.update({"status": "unavailable", "src": None, "last_ok": None, "bars": []})
    if o["status"] == "ok" and not fresh(o["bars"], 5):
        o["status"] = "stale"
    return o


def main():
    os.makedirs(OUT, exist_ok=True)
    idx_path = os.path.join(OUT, "index.json")
    idx_old = load(idx_path) or {}
    force = os.environ.get("MARKETS_FORCE") == "1"
    only = [x for x in os.environ.get("MARKETS_ONLY", "").split(",") if x]
    if not force and not only and idx_old.get("updated_at"):
        try:
            age = NOW.timestamp() - datetime.fromisoformat(idx_old["updated_at"]).timestamp()
            if age < EVERY:
                print("markets: updated %d min ago, skipped" % (age // 60))
                return 0
        except ValueError:
            pass
    items = {x["id"]: x for x in idx_old.get("items", []) if isinstance(x, dict) and "id" in x}
    for key, spec in INSTR.items():
        if only and key not in only:
            continue
        path = os.path.join(OUT, key + ".json")
        o = run_one(key, spec, load(path))
        with open(path, "w", encoding="utf-8") as f:
            json.dump(o, f, ensure_ascii=False, separators=(",", ":"))
        b = o["bars"]
        items[key] = {"id": key, "name": o["name"], "unit": o["unit"], "group": o["group"], "status": o["status"],
                      "src": (o.get("src") or {}).get("label"), "n": len(b), "from": b[0][0] if b else None,
                      "last": [b[-1][0], b[-1][4]] if b else None, "prev": b[-2][4] if len(b) > 1 else None, "close_only": o.get("close_only", False),
                      "sources": len(spec[4]), "working": sum(1 for x in o["tried"] if x["ok"])}
        print("markets: %-7s %-11s %-12s rows=%-6d last=%s  tried=%s" % (
            key, o["status"], (o.get("src") or {}).get("id"), len(b),
            datetime.fromtimestamp(b[-1][0], timezone.utc).date().isoformat() + " " + str(b[-1][4]) if b else "-",
            ",".join("%s:%s" % (x["src"], "ok" if x["ok"] else "fail(" + x.get("err", "")[:60] + ")") for x in o["tried"])))
    idx = {"updated_at": NOW.isoformat(timespec="seconds"), "tf": "1d",
           "note": "One source per file; never stitched. status: ok, stale (old file kept), unavailable.",
           "items": [items[k] for k in INSTR if k in items]}
    with open(idx_path, "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, indent=0, separators=(",", ":"))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:                                   # never break the data workflow
        print("markets: failed: %s" % e)
        sys.exit(0)
