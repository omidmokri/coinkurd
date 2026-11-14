#!/usr/bin/env python3
"""The Observatory: history of the futures curve (/charts/basis/, view "history"), kept by CI.

What it keeps: for Bitcoin and Ether, one value a day — the yearly basis that a dated future of exactly 30, 90 and
180 days would carry ("constant maturity"), worked out from Deribit's dated futures and the spot price.

  basis of one future on day D   = (its daily close ÷ the spot daily close − 1) × 365 ÷ days to its expiry
                                    (closes at the end of day D, 00:00 UTC of D+1; days counted from there to the
                                    expiry at 08:00 UTC; a future with less than 2 days left is not used, like the page)
  constant maturity at k days    = the straight line between the two futures whose days to expiry lie on either side
                                    of k (nothing when no future lies on one side)

Sources: Deribit's public candles (public/get_tradingview_chart_data, resolution 1D, asked as a JSON-RPC POST: Deribit
refuses the GET form of this method with HTTP 400, measured 2026-11-14, while it answers the POST) of each monthly and quarterly future —
the last Friday of each month, the name Deribit gives it (BTC-27DEC24) — and Coinbase's daily close of BTC-USD and
ETH-USD from data/obs/premium_d.json (scripts/obs_premium.py; Deribit's index is a basket of such USD prices). The
first run asks for every such future since 2019 that Deribit still answers for (its candles of expired futures reach
back to December 2019); later runs only the futures alive in the last two weeks. A future Deribit does not answer for
is left out; nothing is guessed.

Writes data/obs/curve_hist.json {source, updated_at, checked, t0 day, n, btc: {cm30, cm90, cm180, px, k}, eth: …,
summary: {btc: {day, cm30, cm90, cm180, avg365, rank, lo, lo_day, hi, hi_day, days}, eth: …}} — columns as
{o: first index, v: values} (per cent, 3 decimals; px in dollars; k = futures used that day).
Runs when yesterday is missing (once an hour at most); OBS_CURVE_FORCE=1 asks anyway.
"""
import calendar
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obs_chain as C  # noqa: E402
import obs_premium as P  # noqa: E402

OUT_DIR = C.OUT_DIR
DERIBIT = "https://www.deribit.com/api/v2/public"
SOURCE = "Deribit dated futures (public candles, www.deribit.com); spot: Coinbase daily close (api.exchange.coinbase.com)"
DAY = 86400
ASSETS = (("btc", "BTC"), ("eth", "ETH"))
CMS = (30, 90, 180)
MIN_DAYS = 2
FIRST = date(2019, 1, 1)
MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def last_fridays(d0, d1):
    """the last Friday of every month from d0's month to d1's month"""
    out, y, m = [], d0.year, d0.month
    while (y, m) <= (d1.year, d1.month):
        last = date(y, m, calendar.monthrange(y, m)[1])
        out.append(last - timedelta(days=(last.weekday() - 4) % 7))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def name(cur, d):
    return f"{cur}-{d.day}{MON[d.month - 1]}{d.year % 100:02d}"


def expiry_ts(d):
    return int(datetime(d.year, d.month, d.day, 8, tzinfo=timezone.utc).timestamp())


def closes(ans):
    """Deribit's chart answer → {day start (s): close}; anything else → {}"""
    r = (ans or {}).get("result") if isinstance(ans, dict) else None
    if not isinstance(r, dict) or r.get("status") != "ok":
        return {}
    out = {}
    for t, c in zip(r.get("ticks") or [], r.get("close") or []):
        try:
            t, c = int(t) // 1000, float(c)
        except (TypeError, ValueError):
            continue
        if t % DAY == 0 and c > 0:
            out[t] = c
    return out


def spot(doc, key):
    """premium_d.json → {day start (s): Coinbase close}"""
    d = (doc or {}).get("d") or {}
    if not d.get("t0") or not d.get("step"):
        return {}
    return P.uncol((d.get(key) or {}).get("cb"), d["t0"] // 1000, d["step"] // 1000)


def interp(pts, k):
    """pts: [(days, yearly basis)] → the value at k days on the straight line between the neighbours on either side"""
    lo = hi = None
    for x, y in sorted(pts):
        if x <= k:
            lo = (x, y)
        elif hi is None:
            hi = (x, y)
    if lo is None or hi is None:
        return lo[1] if lo is not None and lo[0] == k else None
    if lo[0] == k:
        return lo[1]
    return lo[1] + (hi[1] - lo[1]) * (k - lo[0]) / (hi[0] - lo[0])


def day_points(futs, px, day):
    """the yearly basis of every future on one day (day = its start, s): [(days to expiry, basis %)]"""
    s = px.get(day)
    if not s:
        return []
    end, pts = day + DAY, []
    for exp, cl in futs.items():
        f = cl.get(day)
        days = (exp - end) / DAY
        if f and days >= MIN_DAYS:
            pts.append((days, (f / s - 1) * 100 * 365 / days))
    return pts


def build(futs, px, now):
    """{expiry (s): {day: close}}, {day: spot} → {day: {cm30, cm90, cm180, px, k}} for every closed day with a point"""
    today = int(now.timestamp()) // DAY * DAY
    days = sorted({t for cl in futs.values() for t in cl if t < today})
    out = {}
    for t in days:
        pts = day_points(futs, px, t)
        if not pts:
            continue
        row = {f"cm{k}": interp(pts, k) for k in CMS}
        if all(v is None for v in row.values()):
            continue
        row = {k: (round(v, 3) if v is not None else None) for k, v in row.items()}
        row.update(px=C.sig(px[t]), k=len(pts))
        out[t] = row
    return out


def load_rows(doc, key):
    """the file → {day start (s): row}"""
    if not doc or not doc.get("t0") or not isinstance(doc.get(key), dict):
        return {}
    d0 = int(datetime.strptime(doc["t0"], "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())
    cols = {c: v for c, v in doc[key].items() if isinstance(v, dict)}
    out = {}
    for c, col in cols.items():
        for i, x in enumerate(col.get("v") or []):
            if x is None:
                continue
            out.setdefault(d0 + (col["o"] + i) * DAY, {})[c] = x
    return out


def pack(rows_by_asset, now, prev_summary=None):
    days = sorted({t for rows in rows_by_asset.values() for t in rows})
    doc = {"source": SOURCE, "updated_at": now.isoformat(), "checked": now.isoformat()}
    if not days:
        doc.update(t0=None, n=0, summary=prev_summary or {})
        return doc
    t0, n = days[0], (days[-1] - days[0]) // DAY + 1
    doc.update(t0=datetime.fromtimestamp(t0, timezone.utc).strftime("%Y-%m-%d"), n=n)
    summ = {}
    for key, rows in rows_by_asset.items():
        cols = {}
        for c in [f"cm{k}" for k in CMS] + ["px", "k"]:
            v = [rows.get(t0 + i * DAY, {}).get(c) for i in range(n)]
            o = next((i for i, x in enumerate(v) if x is not None), None)
            if o is not None:
                last = max(i for i, x in enumerate(v) if x is not None)
                cols[c] = {"o": o, "v": v[o:last + 1]}
        doc[key] = cols
        summ[key] = summary(rows)
    doc["summary"] = summ
    return doc


def summary(rows):
    """the latest day and where its 90-day basis stands in the history"""
    have = sorted(t for t, r in rows.items() if r.get("cm90") is not None)
    if not have:
        return {}
    t = have[-1]
    r, vals = rows[t], [rows[x]["cm90"] for x in have]
    yr = [rows[x]["cm90"] for x in have if x > t - 365 * DAY]
    lo_t = min(have, key=lambda x: rows[x]["cm90"])
    hi_t = max(have, key=lambda x: rows[x]["cm90"])
    fmt = lambda x: datetime.fromtimestamp(x, timezone.utc).strftime("%Y-%m-%d")   # noqa: E731
    return {"day": fmt(t), "cm30": r.get("cm30"), "cm90": r["cm90"], "cm180": r.get("cm180"),
            "avg365": round(sum(yr) / len(yr), 3), "rank": round(100 * sum(1 for v in vals if v <= r["cm90"]) / len(vals), 1),
            "lo": rows[lo_t]["cm90"], "lo_day": fmt(lo_t), "hi": rows[hi_t]["cm90"], "hi_day": fmt(hi_t), "days": len(have)}


def due(doc, now):
    if not doc or not doc.get("t0") or not doc.get("checked"):
        return True
    try:
        age = (now - datetime.fromisoformat(doc["checked"])).total_seconds()
        last = datetime.strptime(doc["t0"], "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=doc["n"] - 1)
    except Exception:  # noqa: BLE001
        return True
    return last.date() < (now - timedelta(days=1)).date() and age >= 3600


def run(get, now, out_dir=OUT_DIR, force=False, log=print, pause=0.06):
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "curve_hist.json")
    doc = C._load(path)
    if not force and not due(doc, now):
        log(f"curve: checked {doc.get('checked')}, not due yet")
        return "skip"
    prem = C._load(os.path.join(out_dir, "premium_d.json"))
    full = not (doc and doc.get("t0"))
    today = now.date()
    start = FIRST if full else today - timedelta(days=16)
    rows_by_asset, asked, answered = {}, 0, 0
    for key, cur in ASSETS:
        px = spot(prem, key)
        if not px:
            log(f"curve: no Coinbase closes for {cur} in premium_d.json")
        futs = {}
        for d in last_fridays(start, today + timedelta(days=430)):
            exp = expiry_ts(d)
            if exp < int(datetime.combine(start, datetime.min.time(), timezone.utc).timestamp()):
                continue
            t1 = min(exp, int(now.timestamp()))
            t0 = max(exp - 400 * DAY, int(datetime.combine(start, datetime.min.time(), timezone.utc).timestamp()) - DAY)
            if t0 >= t1:
                continue
            asked += 1
            cl = closes(get(DERIBIT + "/get_tradingview_chart_data",
                            {"instrument_name": name(cur, d), "resolution": "1D", "start_timestamp": t0 * 1000, "end_timestamp": t1 * 1000}))
            if cl:
                answered += 1
                futs[exp] = cl
            if pause:
                time.sleep(pause)
        new = build(futs, px, now)
        rows = load_rows(doc, key)
        rows.update(new)                       # a day worked out again replaces the stored one; days not asked about stay
        rows_by_asset[key] = rows
    if not answered:
        log(f"curve: Deribit answered none of {asked} futures — the previous file stays")
        if doc:
            doc["checked"] = now.isoformat()
            C._save(path, doc)
        return "kept"
    new_doc = pack(rows_by_asset, now)
    if not new_doc.get("n"):
        log("curve: no day could be worked out (spot closes missing?) — the previous file stays")
        return "kept"
    C._save(path, new_doc)
    s = new_doc["summary"].get("btc", {})
    log(f"curve: {answered}/{asked} futures answered, {new_doc['n']} days from {new_doc['t0']}; BTC {s.get('day')} "
        f"30d {s.get('cm30')} 90d {s.get('cm90')} 180d {s.get('cm180')} % a year (rank {s.get('rank')})")
    return "written"


def rpc(url, params):
    """the method named at the end of `url`, asked as Deribit's JSON-RPC POST → the answer, or None"""
    import requests
    body = {"jsonrpc": "2.0", "id": 1, "method": "public/" + url.rsplit("/", 1)[-1], "params": params}
    for i in range(2):
        try:
            r = requests.post(DERIBIT.rsplit("/public", 1)[0], json=body, timeout=20, headers=C.UA)
            if r.status_code == 200:
                return r.json()
            print("  http", r.status_code, params.get("instrument_name"), r.text[:300].replace("\n", " "))
            if r.status_code in (400, 404):
                return None
        except Exception as e:  # noqa: BLE001
            print("  err", str(e)[:120])
        time.sleep(2)
    return None


def main():
    now = datetime.now(timezone.utc).replace(microsecond=0)
    run(rpc, now, force=os.environ.get("OBS_CURVE_FORCE") == "1")
    return 0


if __name__ == "__main__":
    sys.exit(main())
