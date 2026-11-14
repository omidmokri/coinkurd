#!/usr/bin/env python3
"""The Observatory: an archive of real liquidations, one row a day, kept by CI (/charts/liquidations/, range "all").

Gate's public contract statistics (futures/usdt/contract_stats) are the only free source of past liquidations: their
daily rows reach back to 2023-10-11 today, but nothing says how long Gate keeps them. This step copies each closed day
into data/obs/liq_archive.json and never drops a day it holds, so the page's history does not shrink when Gate's does.

Each day of each coin, the best figure Gate gives (q = its quality):
  q 2  the sum of the day's six 4-hour rows — when all six are there and none of them is a period Gate's statistics
       missed (the 4-hour rows reach back about 11 months)
  q 1  the day's own row — valued at that day's closing mark price, so it can differ from the 4-hour sum by a few per
       cent on a day the price moved
  q 0  a day Gate's statistics missed: zero taker volume on that coin's row or on BTC_USDT's (which cannot be real) —
       and the day before such a day, whose row Gate cuts short (measured 2026-11-14 on BTC_USDT over 332 days: every
       day before an empty one had a fraction of the taker volume and of the liquidations its 4-hour rows add up to,
       e.g. 2026-11-12: $0.46M against $17.2M); its figures are kept as Gate gives them and the page draws them pale
Dollars are kept in thousands. A day Gate still gives is worked out again on every run (so a better rule reaches the
whole file); a day Gate no longer gives stays as it was held.
The coins: COINS below, the ones Gate lists. Runs once a day (when yesterday is missing); OBS_LIQARCH_FORCE=1 asks.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obs_chain as C  # noqa: E402
import obs_premium as P  # noqa: E402

OUT_DIR = C.OUT_DIR
GATE = "https://api.gateio.ws/api/v4/futures/usdt"
SOURCE = "Gate public contract statistics (api.gateio.ws futures/usdt/contract_stats)"
DAY = 86400
H4 = 4 * 3600
COINS = ("BTC", "ETH", "SOL", "XRP", "DOGE", "BNB", "ADA", "LINK", "AVAX", "SUI", "LTC", "TRX", "HYPE", "PEPE", "TON")


def _f(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if v == v and abs(v) != float("inf") else None


def rows(ans, step):
    """Gate's answer → {start (s): (long $, short $, taker size)} for rows on the step's grid"""
    out = {}
    for r in ans if isinstance(ans, list) else []:
        if not isinstance(r, dict):
            continue
        try:
            t = int(r.get("time"))
        except (TypeError, ValueError):
            continue
        ll, sl = _f(r.get("long_liq_usd")), _f(r.get("short_liq_usd"))
        tk = (_f(r.get("long_taker_size")) or 0) + (_f(r.get("short_taker_size")) or 0)
        if t % step == 0 and ll is not None and sl is not None:
            out[t] = (max(0.0, ll), max(0.0, sl), tk)
    return out


def missed(ref, step):
    """BTC_USDT's rows → the periods Gate's statistics missed: zero taker volume, and the period before it (cut short)"""
    bad = set()
    for t, (_, _, tk) in ref.items():
        if not tk > 0:
            bad.update((t, t - step))
    return bad


def days(d1, h4, ref1, bad4, today):
    """one coin → {day: (long k$, short k$, q)} for every closed day Gate gives"""
    out = {}
    for t, (ll, sl, tk) in d1.items():
        if t + DAY > today:
            continue
        q4 = [h4.get(t + i * H4) for i in range(6)]
        if all(q4) and not any(t + i * H4 in bad4 for i in range(6)) and all(x[2] > 0 for x in q4):
            out[t] = (round(sum(x[0] for x in q4) / 1000), round(sum(x[1] for x in q4) / 1000), 2)
            continue
        missed_day = any(x is not None and not x[2] > 0 for x in (d1.get(t), ref1.get(t), d1.get(t + DAY), ref1.get(t + DAY)))
        out[t] = (round(ll / 1000), round(sl / 1000), 0 if missed_day else 1)
    return out


def merge(old, new):
    """the days Gate still gives, as worked out now; the days it no longer gives, as held"""
    out = dict(old)
    out.update(new)
    return out


def pack_coin(dd):
    ts = sorted(dd)
    t0, n = ts[0], (ts[-1] - ts[0]) // DAY + 1
    ll, sl, q = [], [], []
    for i in range(n):
        v = dd.get(t0 + i * DAY)
        ll.append(v[0] if v else None)
        sl.append(v[1] if v else None)
        q.append(v[2] if v else None)
    return {"t0": datetime.fromtimestamp(t0, timezone.utc).strftime("%Y-%m-%d"), "n": n, "ll": ll, "sl": sl, "q": q}


def unpack_coin(c):
    d0 = int(datetime.strptime(c["t0"], "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())
    out = {}
    for i in range(c["n"]):
        if c["ll"][i] is not None and c["sl"][i] is not None and c["q"][i] is not None:
            out[d0 + i * DAY] = (c["ll"][i], c["sl"][i], c["q"][i])
    return out


def due(doc, now):
    if not doc or not doc.get("coins") or not doc.get("checked"):
        return True
    try:
        age = (now - datetime.fromisoformat(doc["checked"])).total_seconds()
        btc = doc["coins"]["BTC"]
        last = datetime.strptime(btc["t0"], "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=btc["n"] - 1)
    except Exception:  # noqa: BLE001
        return True
    return last.date() < (now - timedelta(days=1)).date() and age >= 3600


def stats(get, coin, step):
    return get(GATE + "/contract_stats", {"contract": coin + "_USDT", "interval": {DAY: "1d", H4: "4h"}[step], "limit": 2000})


def run(get, now, out_dir=OUT_DIR, force=False, log=print):
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "liq_archive.json")
    doc = C._load(path) or {}
    if not force and not due(doc, now):
        log(f"liquidation archive: checked {doc.get('checked')}, not due yet")
        return "skip"
    today = int(now.timestamp()) // DAY * DAY
    ref1, ref4 = rows(stats(get, "BTC", DAY), DAY), rows(stats(get, "BTC", H4), H4)
    if len(ref1) < 300:
        log(f"liquidation archive: BTC_USDT gave {len(ref1)} daily rows — the previous file stays")
        return "kept"
    bad4 = missed(ref4, H4)
    held = doc.get("coins") if isinstance(doc.get("coins"), dict) else {}
    coins, note = {}, []
    for coin in COINS:
        d1 = ref1 if coin == "BTC" else rows(stats(get, coin, DAY), DAY)
        h4 = ref4 if coin == "BTC" else rows(stats(get, coin, H4), H4)
        new = days(d1, h4, ref1, bad4, today) if d1 else {}
        old = unpack_coin(held[coin]) if isinstance(held.get(coin), dict) else {}
        dd = merge(old, new)
        if not dd:
            continue
        coins[coin] = pack_coin(dd)
        note.append(f"{coin} {len(new)}/{len(dd)}")
    if "BTC" not in coins:
        log("liquidation archive: nothing for BTC — the previous file stays")
        return "kept"
    out = {"source": SOURCE, "unit": "thousands of dollars", "updated_at": now.isoformat(), "checked": now.isoformat(), "coins": coins}
    if held and {k: v for k, v in held.items()} == coins:
        doc["checked"] = now.isoformat()
        C._save(path, doc)
        log("liquidation archive: nothing new")
        return "kept"
    C._save(path, out)
    b = coins["BTC"]
    log(f"liquidation archive: {len(coins)} coins, BTC {b['n']} days from {b['t0']} (q2 {b['q'].count(2)}, q1 {b['q'].count(1)}, missed {b['q'].count(0)}); "
        + ", ".join(note))
    return "written"


def main():
    now = datetime.now(timezone.utc).replace(microsecond=0)
    run(P.http_get, now, force=os.environ.get("OBS_LIQARCH_FORCE") == "1")
    return 0


if __name__ == "__main__":
    sys.exit(main())
