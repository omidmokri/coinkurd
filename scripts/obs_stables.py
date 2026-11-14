#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stablecoin supply and SSR for the Observatory — /charts/stablecoins/ (assets/obs/prem.js draws it).

Sources
  DefiLlama (stablecoins.llama.fi, free, no key)
    /stablecoincharts/all                  one row a day since 2017-11-29: every pegged asset in circulation, by peg
    /stablecoincharts/all?stablecoin=ID    the same for one coin (Tether, USDC)
    /stablecoins?includePrices=true        every coin now, with its figure a day, a week and a month ago
  data/obs/chain_btc.json (scripts/obs_chain.py — Coin Metrics community data): Bitcoin's price and supply by day

Writes
  data/obs/stables.json       t0, n and one compact column per series ({"o": first index, "v": [...]}), in millions of dollars:
                                usd   dollar-pegged stablecoins in circulation, at their market price
                                usdt, usdc   the two largest, the same way
                                cap   Bitcoin's market value          ssr   cap ÷ usd
                              rewritten only when a number in it changed (a few times a day at most: see Dates)
  data/obs/stables_now.json   the latest closed day's figures (`summary`: the page's tiles and the bot read it), DefiLlama's
                              list of the largest dollar coins now (`top`), its ids of Tether and USDC, and when it was last asked

Dates. DefiLlama stamps a row with the UTC midnight at which it was taken, so a row is the supply at the END of the day
before its stamp; it is filed under that day. The last day of the file is therefore yesterday, like the on-chain files,
and each day's SSR is Bitcoin's market value at the end of that day over the stablecoins at the end of the same day.
(Measured 2026-11-14: the row stamped that day was there at 03:19 UTC. At 04:39 its coin amounts were unchanged to the
cent and its dollar value had moved by 0.002 %: the amounts are a snapshot, valued at the coins' latest prices until
DefiLlama closes the row — older rows are whole numbers and stay. Tether's figure in it equalled the live list's to
the cent. So the newest day of the file can move in its sixth digit during the following day.)
Nothing is estimated or filled in: a day without a figure is null, and SSR exists only where both sides do.
Asks the source at most every 3 hours (hourly while yesterday is still missing, and at once when Bitcoin's file has a
newer day than the SSR).   Self-test: python3 tests/test_obs_flowdata.py
"""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obs_chain as C  # noqa: E402  (get, sig, _load, _save, unpack)

OUT_DIR = C.OUT_DIR
LLAMA = "https://stablecoins.llama.fi"
SOURCE = "DefiLlama stablecoins (stablecoins.llama.fi); Bitcoin's market value: Coin Metrics community data (coinmetrics.io), CC BY-NC 4.0"
DAY = 86400
M = 1e6
COINS = (("usdt", "USDT", "tether"), ("usdc", "USDC", "usd-coin"))      # our column, DefiLlama's symbol and CoinGecko id
TOP = 40
MIN_DAYS = 1000                      # the history has thousands of days: a shorter answer is a broken answer


def _day(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d")


def _date(s):
    return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)


def _f(x):
    """a finite number or None"""
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if v == v and abs(v) != float("inf") else None


def daily(rows, now):
    """DefiLlama's chart rows → {day: dollars of dollar-pegged coins at the end of that UTC day}.
    A row stamped with midnight of day D+1 is the end of day D. Rows that are not on a midnight, in the future, or
    without a positive figure are left out."""
    out = {}
    limit = int(now.timestamp())
    for r in rows or []:
        if not isinstance(r, dict):
            continue
        try:
            ts = int(r.get("date"))
        except (TypeError, ValueError):
            continue
        if ts % DAY or ts > limit:
            continue
        v = _f((r.get("totalCirculatingUSD") or {}).get("peggedUSD"))
        if v is None or v <= 0:
            continue
        out[_day(ts - DAY)] = v
    return out


def btc_cap(doc):
    """data/obs/chain_btc.json → {day: Bitcoin's market value in dollars}"""
    if not doc or not doc.get("t0"):
        return {}
    t0, n, cols = C.unpack(doc)
    price, sply = cols.get("price"), cols.get("sply")
    if not price or not sply:
        return {}
    d0 = _date(t0)
    return {(d0 + timedelta(days=i)).strftime("%Y-%m-%d"): price[i] * sply[i] for i in range(n) if price[i] is not None and sply[i] is not None}


def build(total, coins, cap, now):
    """→ (t0, n, {column: full list in millions of dollars (ssr: a ratio)}) or None when the total is not a history"""
    usd = daily(total, now)
    if len(usd) < MIN_DAYS:
        return None
    days = sorted(usd)
    d0 = _date(days[0])
    n = (_date(days[-1]) - d0).days + 1
    grid = [(d0 + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(n)]
    cols = {"usd": [C.sig(usd[d] / M) if d in usd else None for d in grid]}
    for key, rows in (coins or {}).items():
        series = daily(rows, now)
        v = [C.sig(series[d] / M) if d in series else None for d in grid]
        if any(x is not None for x in v):
            cols[key] = v
    capv = [C.sig(cap[d] / M) if d in cap else None for d in grid]
    if any(x is not None for x in capv):
        cols["cap"] = capv
        cols["ssr"] = [C.sig(capv[i] / cols["usd"][i]) if capv[i] is not None and cols["usd"][i] else None for i in range(n)]
    return days[0], n, cols


def summary(t0, n, cols):
    """the latest closed day, from the columns as they are stored (so the page's lines end on the same figures)"""
    usd = cols.get("usd")
    i = C._last(usd)
    s = {}
    if i < 0:
        return s
    d0 = _date(t0)
    day = lambda k: (d0 + timedelta(days=k)).strftime("%Y-%m-%d")  # noqa: E731
    s["date"], s["usd"] = day(i), usd[i] * M
    for w, k in ((1, "chg1"), (7, "chg7"), (30, "chg30")):
        if i - w >= 0 and usd[i - w] is not None:
            s[k] = (usd[i] - usd[i - w]) * M
            if w == 30 and usd[i - w] > 0:
                s["chg30_pct"] = (usd[i] / usd[i - w] - 1) * 100
    top = max(range(i + 1), key=lambda k: usd[k] if usd[k] is not None else -1)
    s["ath"], s["ath_date"] = usd[top] * M, day(top)
    for key, _, _ in COINS:
        c = cols.get(key)
        if c and c[i] is not None and usd[i] > 0:
            s[key] = c[i] * M
            s[key + "_share"] = c[i] / usd[i] * 100
    ssr, cap = cols.get("ssr"), cols.get("cap")
    j = C._last(ssr)
    if j >= 0:
        s["ssr"], s["ssr_date"], s["ssr_pct"], s["cap"] = ssr[j], day(j), C._rank(ssr, j), cap[j] * M
    return s


def top_list(j, k=TOP):
    """DefiLlama's list → (the k largest dollar-pegged coins now with their change in a day, a week and a month, how many there are)"""
    rows = []
    for a in (j or {}).get("peggedAssets") or []:
        if not isinstance(a, dict) or a.get("pegType") != "peggedUSD":
            continue
        c = _f((a.get("circulating") or {}).get("peggedUSD"))
        if not c or c <= 0:
            continue

        def chg(key):
            v = _f((a.get(key) or {}).get("peggedUSD"))
            return round(c - v) if v and v > 0 else None

        rows.append({"s": str(a.get("symbol") or "")[:12], "n": str(a.get("name") or "")[:40], "g": str(a.get("gecko_id") or "")[:40],
                     "c": round(c), "d1": chg("circulatingPrevDay"), "d7": chg("circulatingPrevWeek"), "d30": chg("circulatingPrevMonth")})
    rows.sort(key=lambda r: -r["c"])
    return rows[:k], len(rows)


def coin_ids(j):
    """our column → DefiLlama's id of that coin (symbol and CoinGecko id must both match)"""
    out = {}
    for a in (j or {}).get("peggedAssets") or []:
        if not isinstance(a, dict):
            continue
        for key, sym, gecko in COINS:
            if a.get("symbol") == sym and a.get("gecko_id") == gecko and a.get("id") is not None:
                out[key] = str(a["id"])
    return out


def pack(t0, n, cols, now):
    out = {"source": SOURCE, "updated_at": now.isoformat(), "t0": t0, "n": n, "cols": {}}
    for name, v in cols.items():
        o = next((i for i, x in enumerate(v) if x is not None), None)
        if o is not None:
            out["cols"][name] = {"o": o, "v": v[o:]}
    return out


def unpack(doc):
    n = doc["n"]
    cols = {}
    for name, c in (doc.get("cols") or {}).items():
        v = [None] * c["o"] + list(c["v"])
        cols[name] = (v + [None] * (n - len(v)))[:n]
    return doc["t0"], n, cols


def due(hist, nowdoc, now, cap_last=None):
    """ask when there is no file; hourly while yesterday is missing; when Bitcoin's file has a newer day than the SSR;
    otherwise every 3 hours"""
    if not hist or not hist.get("t0") or not nowdoc or not nowdoc.get("checked"):
        return True
    try:
        age = (now - datetime.fromisoformat(nowdoc["checked"])).total_seconds()
        last = _date(hist["t0"]) + timedelta(days=hist["n"] - 1)
    except Exception:  # noqa: BLE001
        return True
    ssr_date = (nowdoc.get("summary") or {}).get("ssr_date")
    if cap_last and ssr_date and ssr_date < min(cap_last, last.strftime("%Y-%m-%d")) and age >= 600:
        return True
    if last.date() < (now - timedelta(days=1)).date():
        return age >= 3600
    return age >= 3 * 3600


def run(get, now, out_dir=OUT_DIR, force=False, log=print):
    """one pass; `get(url, params)` returns parsed JSON or None. → what was done: 'skip' | 'kept' | 'written'"""
    os.makedirs(out_dir, exist_ok=True)
    hp, npth = os.path.join(out_dir, "stables.json"), os.path.join(out_dir, "stables_now.json")
    hist, nowdoc = C._load(hp), C._load(npth) or {}
    chain = C._load(os.path.join(out_dir, "chain_btc.json"))
    cap = btc_cap(chain)
    cap_last = max(cap) if cap else None
    if not force and not due(hist, nowdoc, now, cap_last):
        log(f"stablecoins: asked {nowdoc.get('checked')}, not due yet")
        return "skip"
    total = get(LLAMA + "/stablecoincharts/all", None)
    lst = get(LLAMA + "/stablecoins", {"includePrices": "true"})
    coins = {}
    ids = coin_ids(lst) or (nowdoc.get("ids") if isinstance(nowdoc.get("ids"), dict) else None) or {}      # the list did not come: the ids it gave last time
    for key, cid in ids.items():
        rows = get(LLAMA + "/stablecoincharts/all", {"stablecoin": cid})
        if isinstance(rows, list) and rows:
            coins[key] = rows
    built = build(total if isinstance(total, list) else None, coins, cap, now)
    if not built:
        log("stablecoins: no history in the answer — the previous files stay")
        return "kept"
    t0, n, cols = built
    doc = pack(t0, n, cols, now)
    if hist:
        # a shorter answer, a history that begins elsewhere or a total far from yesterday's is a broken answer: keep the file
        _, pn, pcols = unpack(hist)
        pi, ci = C._last(pcols.get("usd")), C._last(cols["usd"])
        jump = abs(cols["usd"][ci] / pcols["usd"][pi] - 1) if pi >= 0 and ci >= 0 and pcols["usd"][pi] else 0
        if n < pn - 2 or t0 != hist.get("t0") or jump > 0.2 or len(doc["cols"]) < len(hist.get("cols", {})) - 1:
            log(f"stablecoins: answer does not fit the file ({n} days from {t0}, change {jump:.0%}, columns {sorted(doc['cols'])}) — the previous files stay")
            return "kept"
    same = bool(hist) and hist.get("n") == n and hist.get("t0") == t0 and hist.get("cols") == doc["cols"]
    if not same:
        C._save(hp, doc)
    top, count = top_list(lst)
    new = {"source": SOURCE, "updated_at": now.isoformat(), "checked": now.isoformat(), "summary": summary(t0, n, cols), "ids": ids}
    if top:
        new.update({"top": top, "top_n": count, "top_at": now.isoformat()})
    elif nowdoc.get("top"):                                   # the list did not come this time: the last one stays, with its own time
        new.update({k: nowdoc[k] for k in ("top", "top_n", "top_at") if k in nowdoc})
    C._save(npth, new)
    s = new["summary"]
    log(f"stablecoins: {n} days to {s.get('date')}, total ${s.get('usd', 0) / 1e9:.2f}B, 30 days {s.get('chg30', 0) / 1e9:+.2f}B, "
        f"SSR {s.get('ssr')} ({s.get('ssr_date')}), columns {sorted(doc['cols'])}, {len(top)} coins listed" + (", history unchanged" if same else ""))
    return "written"


def main():
    now = datetime.now(timezone.utc).replace(microsecond=0)
    run(lambda url, params: C.get(url, params), now, force=os.environ.get("OBS_STABLES_FORCE") == "1")
    return 0


if __name__ == "__main__":
    sys.exit(main())
