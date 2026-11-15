#!/usr/bin/env python3
"""
Daily reference rates for /market/: what one tether is worth in every currency the page can show prices in.

The page works a coin out in a currency the way it works it out in toman (assets/pro/fx.js, markets.js): the Binance
candle in USDT × this rate at the middle of the bar. Iran's toman is not here (the page reads tgju's free-market tether
rate itself); the US dollar is not here (USDT pairs are shown as they are).

Sources, one per currency so a series never jumps between providers:
  ecb   the European Central Bank's euro reference rates (eurofxref-hist.zip, every business day since 1999; the
        Frankfurter API, which republishes them, when the ECB file cannot be fetched) — for the ~30 currencies the ECB
        quotes and the euro itself. A currency per dollar = (currency per euro) / (dollars per euro). Weekends and
        holidays keep the last business day's rate (at most 5 days).
  xapi  the open exchange-api dataset (github.com/fawazahmed0/exchange-api, CC0; one file a day since 2 March 2024,
        jsDelivr, then its Cloudflare mirror) — for every other currency. A day it lacks keeps the day before (at most
        3 days).
Then × dollars per tether that day (exchange-api's usdt rate; 1 before March 2024, when it is not known), because the
Binance prices are in tether, not dollars. A one-day spike (more than 30 % away from both neighbours, which agree within
10 %) is dropped as a glitch; a lasting jump (a devaluation) is real and kept.

Files (data/fx/):
  <CUR>.json    {"c": "EUR", "src": "ecb", "from": "2017-01-02", "to": "2026-11-08", "v": [0.9581, …]}: one value a day
                from `from`, units of the currency per 1 USDT. Rewritten when a week behind (git keeps every version).
  latest.json   {"at": …, "usdt": 0.9988 (dollars per tether), "from": "2026-11-01", "to": "2026-11-14",
                 "r": {"EUR": ["ecb", v_from … v_to]}}: the last 14 days of every currency, rewritten each day — the page
                 adds these to the history file, and the currency menu shows the last one.
  state.json    which exchange-api days are already in, so a run fetches only new ones.

Never invented: a currency with no rate from its source has no file; a day with no value is null in the file and the
page leaves those bars out.

Run (update.yml, continue-on-error): python3 scripts/fx_rates.py          Test: python3 tests/test_fx_rates.py
"""
import concurrent.futures as cf
import csv
import datetime as dt
import io
import json
import os
import sys
import time
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "fx")
CLDR = os.path.join(ROOT, "scripts", "pro_cldr.json")
START = dt.date(2017, 1, 1)           # Binance's history starts in August 2017
XAPI_START = dt.date(2024, 3, 2)      # the first day exchange-api publishes on npm
WINDOW = 14                           # days of every currency in latest.json
STALE = 7                             # a currency file is rewritten when this many days behind
ECB_ZIP = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip"
FRANK = "https://api.frankfurter.dev/v1/{a}..{b}?base=USD"
XAPI = ["https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{d}/v1/currencies/usd.min.json",
        "https://{d}.currency-api.pages.dev/v1/currencies/usd.min.json"]
UA = {"User-Agent": "entekhab.net fx_rates (+https://entekhab.net)"}


def day(s):
    return dt.date.fromisoformat(s)


def days(a, b):
    """a … b inclusive"""
    n = (b - a).days
    return [a + dt.timedelta(i) for i in range(n + 1)]


def currencies():
    """every currency a country uses today (CLDR via scripts/pro_cldr.json), the euro included; not the dollar, not the rial"""
    with open(CLDR, encoding="utf-8") as f:
        c = json.load(f)["cc_cur"]
    return sorted(set(c.values()) - {"USD", "IRR", "BGN"})


# ------------------------------------------------------------------------------------------------ fetching
def http_get(url, timeout=40, tries=3):
    import requests
    last = None
    for i in range(tries):
        try:
            r = requests.get(url, headers=UA, timeout=timeout)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.content
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 * (i + 1))
    raise last


def ecb_series(get=http_get):
    """{CUR: {date: currency per 1 USD}} from the ECB file (or Frankfurter); also EUR"""
    try:
        raw = get(ECB_ZIP, timeout=60)
        if not raw:
            raise RuntimeError("no ECB file")
        z = zipfile.ZipFile(io.BytesIO(raw))
        name = [n for n in z.namelist() if n.lower().endswith(".csv")][0]
        return ecb_parse(z.read(name).decode("utf-8-sig"))
    except Exception as e:  # noqa: BLE001
        print(f"fx: ECB file failed ({e}); trying Frankfurter")
    raw = get(FRANK.format(a=START.isoformat(), b=dt.date.today().isoformat()), timeout=90)
    return frank_parse(json.loads(raw))


def ecb_parse(text):
    """eurofxref-hist.csv: Date,USD,JPY,…, (a trailing comma), values per 1 EUR, N/A where none"""
    rows = list(csv.reader(io.StringIO(text)))
    head = [h.strip() for h in rows[0]]
    out = {}
    for r in rows[1:]:
        if not r or not r[0].strip():
            continue
        try:
            d = day(r[0].strip())
        except ValueError:
            continue
        if d < START:
            continue
        vals = {head[i]: r[i].strip() for i in range(1, min(len(head), len(r))) if head[i]}
        try:
            usd = float(vals.get("USD", ""))
        except ValueError:
            continue
        if not usd > 0:
            continue
        out.setdefault("EUR", {})[d] = 1.0 / usd
        for cur, v in vals.items():
            if cur == "USD":
                continue
            try:
                x = float(v)
            except ValueError:
                continue
            if x > 0:
                out.setdefault(cur, {})[d] = x / usd
    return out


def frank_parse(j):
    """Frankfurter's time series with base USD: {"rates": {"2017-01-02": {"EUR": 0.95, …}}}"""
    out = {}
    for ds, rates in (j.get("rates") or {}).items():
        d = day(ds)
        for cur, v in rates.items():
            if isinstance(v, (int, float)) and v > 0:
                out.setdefault(cur, {})[d] = float(v)
    return out


def xapi_day(d, get=http_get):
    """{"date": …, "usd": {"eur": 0.9, "usdt": 1.0012, …}} for one day, None when neither host has it"""
    for u in XAPI:
        try:
            raw = get(u.format(d=d.isoformat()), timeout=30, tries=2)
        except Exception:  # noqa: BLE001
            raw = None
        if raw:
            try:
                j = json.loads(raw)
                if isinstance(j.get("usd"), dict) and j["usd"]:
                    return j["usd"]
            except ValueError:
                pass
    return None


# ------------------------------------------------------------------------------------------------ series
def fill(series, a, b, hold):
    """{date: v} -> [v per day a..b], a day without a value keeps the previous one for at most `hold` days"""
    out, last, age = [], None, 0
    for d in days(a, b):
        v = series.get(d)
        if v is not None:
            last, age = v, 0
            out.append(v)
        elif last is not None and age < hold:
            age += 1
            out.append(last)
        else:
            out.append(None)
    return out


def despike(vals):
    """drop one-day glitches: a value >30 % away from both neighbours while they agree within 10 %"""
    v = list(vals)
    for i in range(1, len(v) - 1):
        a, x, b = v[i - 1], v[i], v[i + 1]
        if a and x and b and abs(a / b - 1) < 0.10 and abs(x / a - 1) > 0.30 and abs(x / b - 1) > 0.30:
            v[i] = None
    return v


def sig(x):
    """six significant digits: plenty for a rate, and the files stay small"""
    if x is None:
        return None
    return float(f"{x:.6g}")


def read(path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    txt = json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"
    old = None
    try:
        with open(path, encoding="utf-8") as f:
            old = f.read()
    except OSError:
        pass
    if old != txt:
        with open(path, "w", encoding="utf-8") as f:
            f.write(txt)
        return True
    return False


# ------------------------------------------------------------------------------------------------ the run
def run(out=OUT, get=http_get, today=None, budget=300, threads=12, log=print):
    today = today or dt.datetime.now(dt.timezone.utc).date()
    t0 = time.time()
    want = currencies()
    state = read(os.path.join(out, "state.json"), {}) or {}
    xst = state.get("xapi") or {}
    have = set(xst.get("days") or [])                       # exchange-api days already folded in (ISO dates)
    raw = read(os.path.join(out, "raw_xapi.json"), {}) or {}   # {CUR: {date: per-USD}} of the days not yet in the files

    # 1. exchange-api: every day not in yet (first run: back to March 2024), newest first, within the time budget
    todo = [d for d in days(XAPI_START, today) if d.isoformat() not in have][::-1]
    got = 0
    with cf.ThreadPoolExecutor(threads) as ex:
        for i in range(0, len(todo), threads * 4):
            if time.time() - t0 > budget:
                log(f"fx: time budget reached; {len(todo) - i} exchange-api days left for the next run")
                break
            chunk = todo[i:i + threads * 4]
            for d, usd in zip(chunk, ex.map(lambda x: xapi_day(x, get), chunk)):
                if not usd:
                    continue
                ds = d.isoformat()
                for k, v in usd.items():
                    K = k.upper()
                    if (K in want or K == "USDT") and isinstance(v, (int, float)) and v > 0:
                        raw.setdefault(K, {})[ds] = float(v)
                have.add(ds)
                got += 1
    log(f"fx: exchange-api days fetched: {got} (in total {len(have)})")

    # 2. the ECB, once a day (its file has the whole history)
    ecb = {}
    try:
        ecb = ecb_series(get)
        log(f"fx: ECB/Frankfurter currencies: {len(ecb)}")
    except Exception as e:  # noqa: BLE001
        log(f"fx: ECB and Frankfurter both failed ({e}); ECB currencies keep their files")

    # 3. one series per currency: past files + new days
    usdt_raw = {day(k): 1.0 / v for k, v in (raw.get("USDT") or {}).items() if v > 0}      # dollars per tether
    old_usdt = read(os.path.join(out, "USDT.json"))
    usdt = {}
    if old_usdt and old_usdt.get("v"):
        a = day(old_usdt["from"])
        for i, v in enumerate(old_usdt["v"]):
            if v:
                usdt[a + dt.timedelta(i)] = v
    usdt.update(usdt_raw)
    recent_end = today
    win_from = today - dt.timedelta(WINDOW - 1)
    latest = {"at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(), "from": win_from.isoformat(),
              "to": recent_end.isoformat(), "r": {}}
    usdt_series = fill(usdt, min(usdt) if usdt else XAPI_START, recent_end, 3) if usdt else []
    usdt_from = min(usdt) if usdt else XAPI_START
    if usdt:
        last = [x for x in usdt_series if x]
        latest["usdt"] = sig(last[-1]) if last else 1.0
        write(os.path.join(out, "USDT.json"), {"c": "USDT", "src": "xapi", "unit": "USD per 1 USDT", "from": usdt_from.isoformat(),
                                               "to": recent_end.isoformat(), "v": [sig(x) for x in usdt_series]})
    else:
        latest["usdt"] = 1.0

    def usd_per_usdt(d):
        if not usdt_series or d < usdt_from:
            return 1.0
        i = (d - usdt_from).days
        return usdt_series[i] if 0 <= i < len(usdt_series) and usdt_series[i] else 1.0

    def window(first, vals):
        wi = (win_from - first).days
        return [vals[i] if 0 <= i < len(vals) else None for i in range(wi, wi + WINDOW)]

    written = 0
    for cur in want:
        path = os.path.join(out, cur + ".json")
        old = read(path)
        if not ecb and old and old.get("src") == "ecb" and old.get("v"):
            # the ECB could not be read this run: its currencies keep their files (never switched to another source
            # on a bad day), and latest.json takes their last days from them
            latest["r"][cur] = ["ecb"] + window(day(old["from"]), old["v"])
            continue
        if cur in ecb and any(d >= today - dt.timedelta(30) for d in ecb[cur]):
            src, per_usd, a, hold = "ecb", ecb[cur], START, 5
        else:
            src, hold = "xapi", 3
            per_usd = {}
            if old and old.get("src") == "xapi" and old.get("v"):            # what the file has, back to per-dollar values
                a0 = day(old["from"])
                for i, v in enumerate(old["v"]):
                    d = a0 + dt.timedelta(i)
                    if v:
                        per_usd[d] = v / usd_per_usdt(d)
            per_usd.update({day(k): v for k, v in (raw.get(cur) or {}).items()})
            if not per_usd:
                continue
            a = min(per_usd)
        if not per_usd:
            continue
        first = max(a, min(per_usd))
        vals = despike(fill(per_usd, first, recent_end, hold))
        per_usdt = [sig(v * usd_per_usdt(first + dt.timedelta(i))) if v else None for i, v in enumerate(vals)]
        while per_usdt and per_usdt[-1] is None:                            # nothing known for the last days: not "today"
            per_usdt.pop()
        if not per_usdt:
            continue
        to = first + dt.timedelta(len(per_usdt) - 1)
        latest["r"][cur] = [src] + window(first, per_usdt)
        behind = (to - day(old["to"])).days if old and old.get("to") else 10 ** 6
        if not old or old.get("src") != src or behind >= STALE or not old.get("v"):
            if write(path, {"c": cur, "src": src, "from": first.isoformat(), "to": to.isoformat(), "v": per_usdt}):
                written += 1
    write(os.path.join(out, "latest.json"), latest)
    # the raw days are in the currency files now (or in latest.json's window, until their file is next rewritten);
    # keep only what a file has not taken yet
    keep = {}
    for cur, m in raw.items():
        f = read(os.path.join(out, cur + ".json")) if cur != "USDT" else None
        cut = f["to"] if f and f.get("src") == "xapi" else None
        k = {d: v for d, v in m.items() if cut is None or d > cut}
        if k and cur != "USDT":
            keep[cur] = k
    write(os.path.join(out, "raw_xapi.json"), keep)
    state["xapi"] = {"days": sorted(have)}
    write(os.path.join(out, "state.json"), state)
    log(f"fx: {len(latest['r'])} currencies in latest.json, {written} history files rewritten, "
        f"tether = {latest.get('usdt')} USD, {time.time() - t0:.0f} s")
    return latest


if __name__ == "__main__":
    run()
