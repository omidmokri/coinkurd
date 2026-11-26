#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SOPR and HODL waves for the Observatory — /charts/sopr/ and /charts/hodl-waves/ (assets/obs/cosmos.js draws them,
assets/obs/agemath.js derives the figures; the bot reads data/obs/age_now.json).

Source: bitview.space, the free public instance of the Bitcoin Research Kit (open source, MIT,
github.com/bitcoinresearchkit). It reads every block of the Bitcoin blockchain itself and keeps, for each unspent
output, when it was created and at what price. No account and no key. Every day is checked twice before it is kept:
  1. the age bands must add up to the coins in existence that Coin Metrics reports for the same day (within 0.5 %);
  2. once a day the overlap with an independent source (BGeometrics' free tier, bitcoin-data.com, no key, last four
     years, a week behind) must agree: SOPR correlation ≥ 0.95 with a median gap under 0.01, and the HODL-wave
     shares within 1.5 percentage points (median). A file that fails either check is not written; the last good one
     stays, and the reason is printed.

Definitions (both from the blockchain, one value per UTC day; the day still running is never kept):
  SOPR            = dollars the coins spent that day were worth when spent ÷ what they were worth when created
                    (above 1: spent at a profit on average; below 1: at a loss). Also short-term holders (coins under
                    155 days), long-term holders (155 days and over) and adjusted SOPR (coins younger than an hour left out).
  HODL waves      = the share of all bitcoin, by how long ago each coin last moved, in 13 bands from under a day to
                    over ten years.

Writes  data/obs/age_btc.json   every day since 2009-01-03: SOPR columns, price, the 13 band shares (in 0.01 %)
        data/obs/age_now.json   the latest closed day's figures (the bot and the hub read it) and the last checks
A column is {"o": index of its first day, "v": [...]}; day i is t0 + i days (UTC), as in data/obs/chain_<asset>.json.
Asks the source at most every 3 hours (hourly while yesterday is missing).   Self-test: python3 tests/test_obs_age.py
"""
import json
import math
import os
import statistics
import sys
import time
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "data", "obs")
API = "https://bitview.space/api"
CHECK_API = "https://bitcoin-data.com/v1"
UA = {"User-Agent": "entekhab.net/1.0 (+https://entekhab.net)"}
SOURCE = "bitview.space (Bitcoin Research Kit, open source, computed from the Bitcoin blockchain)"
DAY0 = date(2009, 1, 1)          # index 0 of the source's day1 series (checked against BGeometrics' dated rows)
T0 = "2009-01-03"                 # the genesis block: the first day kept
EVERY = 3 * 3600

# the source's 23 age cohorts → 13 bands (the usual HODL-wave bands); together they cover every unspent coin
RAW = ["under_1h", "1h_to_1d", "1d_to_1w", "1w_to_1m", "1m_to_2m", "2m_to_3m", "3m_to_4m", "4m_to_5m", "5m_to_6m",
       "6m_to_9m", "9m_to_1y", "1y_to_18m", "18m_to_2y", "2y_to_3y", "3y_to_4y", "4y_to_5y", "5y_to_6y", "6y_to_7y",
       "7y_to_8y", "8y_to_10y", "10y_to_12y", "12y_to_15y", "over_15y"]
BANDS = [("d1", ["under_1h", "1h_to_1d"]), ("w1", ["1d_to_1w"]), ("m1", ["1w_to_1m"]), ("m3", ["1m_to_2m", "2m_to_3m"]),
         ("m6", ["3m_to_4m", "4m_to_5m", "5m_to_6m"]), ("y1", ["6m_to_9m", "9m_to_1y"]), ("y2", ["1y_to_18m", "18m_to_2y"]),
         ("y3", ["2y_to_3y"]), ("y4", ["3y_to_4y"]), ("y5", ["4y_to_5y"]), ("y7", ["5y_to_6y", "6y_to_7y"]),
         ("y10", ["7y_to_8y", "8y_to_10y"]), ("y10p", ["10y_to_12y", "12y_to_15y", "over_15y"])]
BAND_KEYS = [k for k, _ in BANDS]
# the same bands in BGeometrics' file, for the daily check
CHECK_BANDS = {"d1": "age_0d_1d", "w1": "age_1d_1w", "m1": "age_1w_1m", "m3": "age_1m_3m", "m6": "age_3m_6m", "y1": "age_6m_1y",
               "y2": "age_1y_2y", "y3": "age_2y_3y", "y4": "age_3y_4y", "y5": "age_4y_5y", "y7": "age_5y_7y", "y10": "age_7y_10y",
               "y10p": "age_10y"}
SOPR = [("sopr", "sopr_24h"), ("ssopr", "sth_sopr_24h"), ("lsopr", "lth_sopr_24h"), ("asopr", "adjusted_sopr_24h")]
EXTRA = [("price", "price_close"), ("lthsup", "lth_supply")]


def get(url, params=None, timeout=90, tries=3):
    import requests
    for i in range(tries):
        try:
            r = requests.get(url, params=params, timeout=timeout, headers=UA)
            if r.status_code == 200:
                return r.json()
            print("  http", r.status_code, url[:90], r.text[:160].replace("\n", " "))
            if r.status_code in (400, 401, 403, 404, 429):
                return None
        except Exception as e:  # noqa: BLE001
            print("  err", str(e)[:140])
        time.sleep(3 + 4 * i)
    return None


def series(name):
    """the whole day1 series of one measure, index 0 = 2009-01-01; None when it cannot be read or looks wrong"""
    j = get(API + "/series/" + name + "/day1")
    if not isinstance(j, dict) or j.get("index") != "day1" or j.get("start") != 0 or not isinstance(j.get("data"), list):
        print("  unexpected answer for", name)
        return None
    out = []
    for x in j["data"]:
        out.append(float(x) if isinstance(x, (int, float)) and math.isfinite(x) else None)
    return out


def sig(x, n=6):
    if x == 0:
        return 0
    r = float(f"{x:.{n}g}")
    return int(r) if r == int(r) and abs(r) < 1e15 else r


def iso(d):
    return d.strftime("%Y-%m-%d")


# ------------------------------------------------------------------ building the columns
def build(raw, today):
    """raw: {name: list from index 0 = 2009-01-01} → (t0, n, cols) for the closed days from T0, or raises ValueError"""
    lens = {len(v) for v in raw.values()}
    if len(lens) != 1:
        raise ValueError("the series have different lengths: %s" % sorted(lens))
    total_len = lens.pop()
    off = (date.fromisoformat(T0) - DAY0).days
    last = total_len - 1
    while last >= 0 and DAY0 + timedelta(days=last) >= today:      # the day still running is not a closed day
        last -= 1
    n = last - off + 1
    if n < 365:
        raise ValueError("too few days")
    cols = {}
    total = [None] * n
    bands = {k: [None] * n for k in BAND_KEYS}
    for i in range(n):
        k = off + i
        vals = [raw["age_%s_supply" % c][k] for c in RAW]
        if any(v is None for v in vals):
            continue
        tot = sum(vals)
        if tot <= 0:
            continue
        total[i] = tot
        by = dict(zip(RAW, vals))
        for key, parts in BANDS:
            bands[key][i] = int(round(sum(by[p] for p in parts) / tot * 10000))     # 0.01 % units
    for key in BAND_KEYS:
        cols["b_" + key] = bands[key]
    for col, name in SOPR:
        cols[col] = [None if raw[name][off + i] is None or raw[name][off + i] <= 0 else round(raw[name][off + i], 5) for i in range(n)]
    pr = raw.get("price_close")
    cols["price"] = [None if pr is None or pr[off + i] is None or pr[off + i] <= 0 else sig(pr[off + i]) for i in range(n)]
    lt = raw.get("lth_supply")
    cols["lth"] = [None if lt is None or lt[off + i] is None or not total[i] else int(round(lt[off + i] / total[i] * 10000)) for i in range(n)]
    cols["sply"] = [None if t is None else int(round(t)) for t in total]
    return T0, n, cols


# ------------------------------------------------------------------ the checks
def check_supply(t0, n, cols):
    """the bands' total against Coin Metrics' coins in existence (data/obs/chain_btc.json) for the same days"""
    try:
        with open(os.path.join(OUT_DIR, "chain_btc.json"), encoding="utf-8") as f:
            cm = json.load(f)
        c = cm["cols"]["sply"]
        cm0 = date.fromisoformat(cm["t0"])
    except Exception as e:  # noqa: BLE001
        return {"ok": None, "why": "Coin Metrics file not readable: %s" % str(e)[:80]}
    d0 = date.fromisoformat(t0)
    gaps = []
    for i in range(n):
        s = cols["sply"][i]
        if s is None:
            continue
        j = (d0 + timedelta(days=i) - cm0).days - c["o"]
        if 0 <= j < len(c["v"]) and c["v"][j]:
            gaps.append(abs(s - c["v"][j]) / c["v"][j] * 100)
    if len(gaps) < 365:
        return {"ok": None, "why": "too little overlap", "n": len(gaps)}
    recent = gaps[-365:]
    worst = max(recent)
    return {"ok": worst < 0.5, "n": len(gaps), "worst_pct_365d": round(worst, 4), "median_pct": round(statistics.median(gaps), 4)}


def check_other(t0, n, cols):
    """the overlap with BGeometrics' free tier (two requests a day out of the fifteen it allows)"""
    d0 = date.fromisoformat(t0)
    idx = lambda s: (date.fromisoformat(s) - d0).days  # noqa: E731
    out = {"vs": "bitcoin-data.com (BGeometrics free tier)"}
    sj = get(CHECK_API + "/sopr", tries=2)
    if isinstance(sj, list) and sj:
        pairs = []
        for r in sj:
            try:
                i, v = idx(r["d"]), float(r["sopr"])
            except Exception:  # noqa: BLE001
                continue
            if 0 <= i < n and cols["sopr"][i] is not None and v > 0:
                pairs.append((cols["sopr"][i], v))
        if len(pairs) >= 200:
            a, b = [p[0] for p in pairs], [p[1] for p in pairs]
            out["sopr_n"] = len(pairs)
            out["sopr_corr"] = round(statistics.correlation(a, b), 4)
            out["sopr_median_gap"] = round(statistics.median(abs(x - y) for x, y in pairs), 5)
            out["sopr_ok"] = out["sopr_corr"] >= 0.95 and out["sopr_median_gap"] < 0.01
    hj = get(CHECK_API + "/hodl-waves-supply", tries=2)
    if isinstance(hj, list) and hj:
        gaps = {k: [] for k in BAND_KEYS}
        for r in hj:
            try:
                i = idx(r["d"])
                vals = {k: float(r[CHECK_BANDS[k]]) for k in BAND_KEYS}
            except Exception:  # noqa: BLE001
                continue
            tot = sum(vals.values())
            if not (0 <= i < n) or tot <= 0 or cols["b_d1"][i] is None:
                continue
            for k in BAND_KEYS:
                gaps[k].append(abs(vals[k] / tot * 100 - cols["b_" + k][i] / 100))
        if all(len(g) >= 200 for g in gaps.values()):
            med = {k: round(statistics.median(g), 3) for k, g in gaps.items()}
            out["hodl_n"] = len(gaps["d1"])
            out["hodl_median_gap_pp"] = med
            out["hodl_ok"] = max(med.values()) < 1.5
    return out


# ------------------------------------------------------------------ the summary (mirrors OBAge.summary in assets/obs/agemath.js)
def _last(a):
    i = len(a) - 1
    while i >= 0 and a[i] is None:
        i -= 1
    return i


def _mean(a, i, w):
    if i - w + 1 < 0:
        return None
    seg = a[i - w + 1:i + 1]
    if any(x is None for x in seg):
        return None
    return sum(seg) / w


def _rank(a, i):
    cur = a[i]
    if cur is None:
        return None
    vals = [x for x in a[:i + 1] if x is not None]
    return 100.0 * sum(1 for x in vals if x <= cur) / len(vals) if vals else None


def summary(t0, n, cols):
    s = {}
    sp = cols.get("sopr") or []
    i = _last(sp)
    if i < 0:
        return s
    d0 = date.fromisoformat(t0)
    s["date"] = iso(d0 + timedelta(days=i))
    s["sopr"] = sp[i]
    for w, k in ((7, "sopr7"), (30, "sopr30")):
        m = _mean(sp, i, w)
        if m is not None:
            s[k] = round(m, 5)
    m7 = [_mean(sp, k, 7) for k in range(len(sp))]
    if m7[i] is not None:
        s["sopr7_pct"] = round(_rank(m7, i), 1)
    run = 0                                   # consecutive days of the 7-day mean on the same side of 1
    if m7[i] is not None:
        side = m7[i] >= 1
        k = i
        while k >= 0 and m7[k] is not None and (m7[k] >= 1) == side:
            run += 1
            k -= 1
        s["side"] = "profit" if side else "loss"
        s["side_days"] = run
    for k in ("ssopr", "lsopr", "asopr"):
        a = cols.get(k)
        if a and a[i] is not None:
            s[k] = a[i]
    pr = cols.get("price")
    if pr and pr[i] is not None:
        s["price"] = pr[i]
    b = {k: cols["b_" + k] for k in BAND_KEYS}
    j = _last(b["d1"])
    if j >= 0:
        s["wave_date"] = iso(d0 + timedelta(days=j))
        s["bands"] = {k: b[k][j] / 100 for k in BAND_KEYS}
        young = lambda q: sum(b[k][q] for k in ("d1", "w1", "m1", "m3", "m6")) / 100  # noqa: E731
        old = lambda q: sum(b[k][q] for k in BAND_KEYS[6:]) / 100                     # noqa: E731
        s["young6m"], s["old1y"] = round(young(j), 2), round(old(j), 2)
        for back, key in ((30, "30"), (365, "365")):
            q = j - back
            if q >= 0 and b["d1"][q] is not None:
                s["old1y_chg" + key] = round(old(j) - old(q), 2)
        oldser = [None if b["d1"][q] is None else old(q) for q in range(len(b["d1"]))]
        s["old1y_pct"] = round(_rank(oldser, j), 1)
        lt = cols.get("lth")
        if lt and lt[j] is not None:
            s["lth"] = lt[j] / 100
    return s


def pack(t0, n, cols, now, checks):
    doc = {"asset": "btc", "source": SOURCE, "updated_at": now.isoformat(), "t0": t0, "n": n,
           "bands": BAND_KEYS, "checks": checks, "cols": {}}
    for name, v in cols.items():
        o = next((i for i, x in enumerate(v) if x is not None), None)
        if o is None:
            continue
        doc["cols"][name] = {"o": o, "v": v[o:]}
    return doc


def unpack(doc):
    n = doc["n"]
    cols = {}
    for name, c in doc.get("cols", {}).items():
        v = [None] * c["o"] + list(c["v"])
        cols[name] = v + [None] * (n - len(v))
    return doc["t0"], n, cols


def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return None


def write(path, doc):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


def main():
    now = datetime.now(timezone.utc)
    today = now.date()
    os.makedirs(OUT_DIR, exist_ok=True)
    big, small = os.path.join(OUT_DIR, "age_btc.json"), os.path.join(OUT_DIR, "age_now.json")
    prev = load(small) or {}
    have = (prev.get("summary") or {}).get("date")
    looked = prev.get("looked_at")
    if looked and os.environ.get("OBS_AGE_FORCE") != "1":
        age = (now - datetime.fromisoformat(looked)).total_seconds()
        yesterday = iso(today - timedelta(days=1))
        if age < EVERY and (have == yesterday or age < 3600):
            print("age: looked %d min ago, nothing to do" % (age // 60))
            return 0
    raw = {}
    for name in [m for _, m in SOPR] + [m for _, m in EXTRA] + ["age_%s_supply" % c for c in RAW]:
        v = series(name)
        if v is None and name not in ("price_close", "lth_supply"):
            print("age: could not read", name, "- the last good file stays")
            return 0
        if v is not None:
            raw[name] = v
        time.sleep(0.3)
    try:
        t0, n, cols = build(raw, today)
    except ValueError as e:
        print("age: the answer does not hold together (%s) - the last good file stays" % e)
        return 0
    sup = check_supply(t0, n, cols)
    if sup.get("ok") is False:
        print("age: the bands do not add up to the coins in existence:", sup, "- the last good file stays")
        return 0
    checks = {"supply": sup}
    other = prev.get("checks", {}).get("other") or {}
    if other.get("at") != iso(today):                        # once a day: two of BGeometrics' fifteen daily requests
        fresh = check_other(t0, n, cols)
        fresh["at"] = iso(today)
        if fresh.get("sopr_ok") is False or fresh.get("hodl_ok") is False:
            print("age: an independent source disagrees:", json.dumps(fresh)[:600], "- the last good file stays")
            return 0
        if "sopr_ok" in fresh or "hodl_ok" in fresh:
            other = fresh
        else:
            other = dict(other, last_try=iso(today), note="the second source could not be read today")
    checks["other"] = other
    doc = pack(t0, n, cols, now, checks)
    summ = summary(t0, n, cols)
    old = load(big)
    if not old or old.get("cols") != doc["cols"] or old.get("checks") != doc["checks"]:
        write(big, doc)
        print("age: wrote %s, %d days, last %s" % (os.path.relpath(big, ROOT), n, summ.get("date")))
    else:
        print("age: numbers unchanged")
    write(small, {"source": SOURCE, "looked_at": now.isoformat(), "summary": summ, "checks": checks})
    return 0


if __name__ == "__main__":
    sys.exit(main())
