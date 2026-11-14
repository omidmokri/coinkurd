#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The Coinbase premium for the Observatory — /charts/basis/ (assets/obs/prem.js draws it).

Why CI reads it: Coinbase's API does not answer from every country (the owner's own connection times out on it), so the
visitor's browser cannot be relied on. GitHub's runners reach Coinbase and Binance's public market-data mirror.

Sources (public, no key)
  Coinbase Exchange   api.exchange.coinbase.com/products/<P>/candles   [time, low, high, open, close, volume], newest
                      first, at most 300 a request; BTC-USD, ETH-USD and USDT-USD, hourly and daily
  Binance spot        data-api.binance.vision/api/v3/klines            BTCUSDT and ETHUSDT, hourly and daily

Writes
  data/obs/premium.json     h: the last 90 days of hourly closes on one grid (t0, step, n; a column is {"o", "v"}):
                              usdt (Coinbase's USDT-USD), <asset>.cb (Coinbase, dollars), <asset>.bn (Binance, Tether)
                            summary.<asset>: the latest closed hour and the averages (the page's tiles and the bot)
  data/obs/premium_d.json   d: the daily closes since 2017-08-17 (Binance's first day), the same way — rewritten once a day

A candle is filed under its opening time and is kept only once it has closed. The premium itself is not stored: the
page divides the closes (assets/obs/flowmath.js: Coinbase ÷ Binance − 1, and the Tether-adjusted one), so every
figure can be checked against the two exchanges. Nothing is estimated: an hour one exchange has no candle for is null.
A close more than 10 % away from the other exchange's is taken as a broken answer and left out.
Runs once an hour (when the last closed hour is not in the file yet).   Self-test: python3 tests/test_obs_flowdata.py
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obs_chain as C  # noqa: E402  (get, _load, _save, _rank)

OUT_DIR = C.OUT_DIR
CB = "https://api.exchange.coinbase.com/products/{}/candles"
BN = ("https://data-api.binance.vision", "https://api.binance.com")
SOURCE = "Coinbase Exchange (BTC-USD, ETH-USD, USDT-USD) and Binance spot (BTCUSDT, ETHUSDT) candles"
ASSETS = {"btc": ("BTC-USD", "BTCUSDT"), "eth": ("ETH-USD", "ETHUSDT")}
USDT = "USDT-USD"
H, D = 3600, 86400
HOURS = 90 * 24
DAY0 = int(datetime(2017, 8, 17, tzinfo=timezone.utc).timestamp())          # Binance's first BTCUSDT day
CB_PAGE = 290                                                                # Coinbase refuses a range of more than 300 candles
BN_PAGE = 1000
FAR = 0.10                                                                   # two closes of one coin further apart than this: not the same thing


def _iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _f(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if v == v and abs(v) != float("inf") and v > 0 else None


def cb_parse(rows, step):
    """Coinbase's answer → {opening time (s): close}; anything that is not a candle on the grid is left out"""
    out = {}
    for r in rows if isinstance(rows, list) else []:
        if not isinstance(r, (list, tuple)) or len(r) < 5:
            continue
        try:
            t = int(r[0])
        except (TypeError, ValueError):
            continue
        c = _f(r[4])
        if t > 0 and t % step == 0 and c is not None:
            out[t] = c
    return out


def bn_parse(rows, step):
    """Binance's answer → {opening time (s): close}"""
    out = {}
    for r in rows if isinstance(rows, list) else []:
        if not isinstance(r, (list, tuple)) or len(r) < 5:
            continue
        try:
            ms = int(r[0])
        except (TypeError, ValueError):
            continue
        c = _f(r[4])
        if ms > 0 and ms % (step * 1000) == 0 and c is not None:
            out[ms // 1000] = c
    return out


def cb_fetch(get, product, step, t_from, t_to):
    """every candle of the product that opens in [t_from, t_to] → (candles, complete).
    The newest 300 come from the plain request (no range); older ones in windows walked back from there. `complete` is
    False when a window failed (the older part is asked again next time) and True when the walk reached t_from or the
    exchange answered with nothing older (the product is younger than t_from)."""
    out = cb_parse(get(CB.format(product), {"granularity": step}), step)
    if not out:
        return {}, False
    edge, complete = min(out), True
    while edge > t_from:
        a = max(t_from, edge - CB_PAGE * step)
        rows = get(CB.format(product), {"granularity": step, "start": _iso(a), "end": _iso(edge - step)})
        if not isinstance(rows, list):
            complete = False
            break
        part = {t: v for t, v in cb_parse(rows, step).items() if t < edge}
        if not part:
            break
        out.update(part)
        edge = min(min(part), a)
    return {t: v for t, v in out.items() if t_from <= t <= t_to}, complete


def bn_get(get, path, params):
    for base in BN:
        j = get(base + path, params)
        if isinstance(j, list):
            return j
    return None


def bn_fetch(get, symbol, step, t_from, t_to):
    """every candle of the symbol that opens in [t_from, t_to], walked forward 1000 at a time"""
    out, start, iv = {}, t_from, "1h" if step == H else "1d"
    for _ in range(40):
        part = bn_parse(bn_get(get, "/api/v3/klines", {"symbol": symbol, "interval": iv, "startTime": start * 1000, "limit": BN_PAGE}), step)
        part = {t: v for t, v in part.items() if t >= start}
        if not part:
            break
        out.update(part)
        nxt = max(part) + step
        if nxt > t_to or len(part) < BN_PAGE - 1:
            break
        start = nxt
    return {t: v for t, v in out.items() if t_from <= t <= t_to}


# ------------------------------------------------------------------ the grid
def col(series, t0, step, n):
    v = [series.get(t0 + i * step) for i in range(n)]
    o = next((i for i, x in enumerate(v) if x is not None), None)
    if o is None:
        return None
    last = max(i for i, x in enumerate(v) if x is not None)
    return {"o": o, "v": v[o:last + 1]}


def uncol(c, t0, step):
    """a stored column → {time: value}"""
    if not c or not isinstance(c.get("v"), list):
        return {}
    return {t0 + (c["o"] + i) * step: x for i, x in enumerate(c["v"]) if x is not None}


def stored(doc, key):
    """the file's grid → ({series name: {time: value}}: 'usdt', 'btc.cb', 'btc.bn', …, the Coinbase series whose older part is complete)"""
    g = (doc or {}).get(key) or {}
    if not g.get("t0") or not g.get("step"):
        return {}, set()
    t0, step = g["t0"] // 1000, g["step"] // 1000
    out = {"usdt": uncol(g.get("usdt"), t0, step)}
    for a in ASSETS:
        for side in ("cb", "bn"):
            out[f"{a}.{side}"] = uncol((g.get(a) or {}).get(side), t0, step)
    return out, set(g.get("full") or [])


def clean(series):
    """a Coinbase close and a Binance close of one coin more than FAR apart: both dropped (a broken answer, not a premium)"""
    for a in ASSETS:
        cb, bn = series.get(f"{a}.cb", {}), series.get(f"{a}.bn", {})
        for t in [t for t in cb if t in bn and abs(cb[t] / bn[t] - 1) > FAR]:
            del cb[t], bn[t]
    us = series.get("usdt", {})
    for t in [t for t, v in us.items() if abs(v - 1) > FAR]:
        del us[t]
    return series


def grid(series, t0, step, n, full=()):
    g = {"t0": t0 * 1000, "step": step * 1000, "n": n, "full": sorted(full)}
    c = col(series.get("usdt", {}), t0, step, n)
    if c:
        g["usdt"] = c
    for a in ASSETS:
        pair = {side: col(series.get(f"{a}.{side}", {}), t0, step, n) for side in ("cb", "bn")}
        if pair["cb"] and pair["bn"]:
            g[a] = pair
    return g


# ------------------------------------------------------------------ the summary (the page's tiles, the bot)
def premiums(series, a):
    """{time: (premium %, Tether-adjusted premium % or None)} where both closes exist"""
    cb, bn, us = series.get(f"{a}.cb", {}), series.get(f"{a}.bn", {}), series.get("usdt", {})
    out = {}
    for t, c in cb.items():
        b = bn.get(t)
        if b:
            u = us.get(t)
            out[t] = ((c / b - 1) * 100, (c / (b * u) - 1) * 100 if u else None)
    return out


def _mean(vals, need):
    vals = [v for v in vals if v is not None]
    return sum(vals) / len(vals) if len(vals) >= need else None


def summarize(hs, ds, a, t_end_h, t_end_d):
    """the latest closed hour with both closes, the averages over the hours before it, and the last day's rank"""
    p = premiums(hs, a)
    s = {}
    if p:
        t = max(p)
        s.update({"t": (t + H) * 1000, "cb": hs[f"{a}.cb"][t], "bn": hs[f"{a}.bn"][t], "now": round(p[t][0], 5)})
        if p[t][1] is not None:
            s["now_adj"] = round(p[t][1], 5)
        if hs.get("usdt", {}).get(t):
            s["usdt"] = hs["usdt"][t]
        for hours, need, key in ((24, 20, "h24"), (168, 140, "d7"), (720, 600, "d30")):
            win = [p.get(t - i * H) for i in range(hours)]
            m = _mean([x[0] if x else None for x in win], need)
            if m is not None:
                s[key] = round(m, 5)
            m = _mean([x[1] if x else None for x in win], need)
            if m is not None and key == "h24":
                s["h24_adj"] = round(m, 5)
        s["stale"] = t < t_end_h                               # the newest closed hour is not in yet
    pd = premiums(ds, a)
    if pd:
        t = max(pd)
        days = sorted(pd)
        vals = [pd[x][0] for x in days]
        s.update({"day": datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d"), "day_prem": round(pd[t][0], 5),
                  "day_pct": C._rank(vals, len(vals) - 1), "days": len(vals), "day0": datetime.fromtimestamp(days[0], timezone.utc).strftime("%Y-%m-%d")})
    return s


# ------------------------------------------------------------------ the run
def update(get, series, full, step, t0, t_end, log=print):
    """bring every series up to t_end: from 3 candles before its newest value; from t0 when it has none, or (Coinbase)
    while its older part is not complete yet. `full` (a set of Coinbase series names) is brought up to date."""
    asked = 0
    jobs = [("usdt", "cb", USDT)] + [(f"{a}.cb", "cb", ASSETS[a][0]) for a in ASSETS] + [(f"{a}.bn", "bn", ASSETS[a][1]) for a in ASSETS]
    for name, kind, sym in jobs:
        have = series.setdefault(name, {})
        newest = max(have) if have else None
        back = kind == "cb" and name not in full
        if newest is not None and newest >= t_end and not back:
            continue
        start = max(t0, newest - 3 * step) if newest is not None and not back else t0
        if kind == "cb":
            got, complete = cb_fetch(get, sym, step, start, t_end)
            if complete and got:
                full.add(name)
        else:
            got = bn_fetch(get, sym, step, start, t_end)
        asked += 1
        if got:
            have.update(got)
        else:
            log(f"  {sym} {'1h' if step == H else '1d'}: nothing came")
    return asked


def run(get, now, out_dir=OUT_DIR, force=False, log=print):
    """one pass; `get(url, params)` returns parsed JSON or None. → 'skip' | 'kept' | 'written'"""
    os.makedirs(out_dir, exist_ok=True)
    hp, dp = os.path.join(out_dir, "premium.json"), os.path.join(out_dir, "premium_d.json")
    hdoc, ddoc = C._load(hp), C._load(dp)
    ts = int(now.timestamp())
    h_end = ts // H * H - H                       # opening time of the last closed hour
    d_end = ts // D * D - D                       # … and of the last closed day
    h0 = h_end - (HOURS - 1) * H
    (hs, hfull), (ds, dfull) = stored(hdoc, "h"), stored(ddoc, "d")
    done_h = all(hs.get(k) and max(hs[k]) >= h_end for k in ("btc.cb", "btc.bn"))
    if not force and hdoc and done_h:
        log(f"premium: the hour that closed at {_iso(h_end + H)} is in the file")
        return "skip"
    hs = {k: {t: v for t, v in s.items() if t >= h0} for k, s in hs.items()}
    update(get, hs, hfull, H, h0, h_end, log)
    clean(hs)
    if not premiums(hs, "btc"):
        log("premium: no hour has both closes — the previous files stay")
        return "kept"
    done_d = all(ds.get(k) and max(ds[k]) >= d_end for k in ("btc.cb", "btc.bn"))
    if force or not done_d:
        update(get, ds, dfull, D, DAY0, d_end, log)
        clean(ds)
        dnew = {"source": SOURCE, "updated_at": now.isoformat(), "d": grid(ds, DAY0, D, (d_end - DAY0) // D + 1, dfull)}
        if dnew["d"].get("btc") and (not ddoc or dnew["d"] != ddoc.get("d")):
            C._save(dp, dnew)
    out = {"source": SOURCE, "updated_at": now.isoformat(), "h": grid(hs, h0, H, HOURS, hfull), "summary": {}}
    for a in ASSETS:
        s = summarize(hs, ds, a, h_end, d_end)
        if s:
            out["summary"][a] = s
    C._save(hp, out)
    b = out["summary"].get("btc", {})
    log(f"premium: hours to {_iso((b.get('t') or 0) // 1000)}, BTC now {b.get('now')} % (adjusted {b.get('now_adj')}), 24 h {b.get('h24')}, "
        f"7 d {b.get('d7')}, last day {b.get('day')} {b.get('day_prem')} % (rank {b.get('day_pct')}), {b.get('days')} days")
    return "written"


def http_get(url, params=None):
    """parsed JSON or None: two tries, 20 seconds each (this runs every hour: a slow exchange must not hold the sync up)"""
    import time

    import requests
    for i in range(2):
        try:
            r = requests.get(url, params=params, timeout=20, headers=C.UA)
            if r.status_code == 200:
                return r.json()
            print("  http", r.status_code, url[:80], r.text[:120].replace("\n", " "))
            if r.status_code in (400, 401, 403, 404, 451):
                return None
        except Exception as e:  # noqa: BLE001
            print("  err", str(e)[:120])
        time.sleep(2)
    return None


def main():
    now = datetime.now(timezone.utc).replace(microsecond=0)
    run(http_get, now, force=os.environ.get("OBS_PREMIUM_FORCE") == "1")
    return 0


if __name__ == "__main__":
    sys.exit(main())
