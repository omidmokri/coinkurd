#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Volume profile for the Observatory — /charts/volume-profile/ (assets/obs/vprof.js draws it).

What a volume profile is: instead of asking how much was traded in each HOUR, it asks how much was traded at each
PRICE. The result shows where the market actually did its business, which is where it tends to pause or turn.

Source (public, no key — the same mirror the Coinbase-premium page already uses)
  Binance spot   data-api.binance.vision/api/v3/klines
                 a row is [open time, open, high, low, close, base volume, close time, QUOTE volume, trades,
                 TAKER-BUY base volume, taker-buy quote volume, ignore] — read from a live answer on 2026-11-22,
                 not assumed. Column 7 is the dollars traded; column 10 is the dollars the aggressive BUYER paid.
                 Sell dollars are therefore column 7 minus column 10: every trade has both sides, so this says
                 which side crossed the spread, not who was right.

How the profile is built. A candle gives no tick-by-tick prices, only its high and low, so each candle's dollars are
spread EVENLY across the price bins its range covers. That is an approximation and it is named as one on the page.
Hourly candles are used for the 7, 30 and 90-day views so each candle's range is narrow; the yearly view uses daily
candles. A candle whose high equals its low puts all its dollars in one bin.

Writes
  data/obs/vprofile.json
    assets.<key> = {sym, name, ranges: {<days>: {lo, hi, step, n, buy: [...], sell: [...], poc, vah, val, total,
                                                 price, t0, t1, candles}}}
    buy[i] and sell[i] are the dollars traded in bin i, bin i covering [lo + i*step, lo + (i+1)*step).
    poc  the bin index holding the most dollars (the "point of control")
    vah, val  the bin indices bounding the smallest band around the POC that holds 70 % of the dollars (the value area)

Nothing is estimated beyond the even spread named above: a range the source has no candles for is left out entirely.
Asks the source at most every 3 hours (OBS_VPROFILE_FORCE=1 overrides).   Self-test: python3 tests/test_obs_vprofile.py
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obs_chain as C  # noqa: E402  (get, _load, _save)

OUT_DIR = C.OUT_DIR
OUT = os.path.join(OUT_DIR, "vprofile.json")
BN = ("https://data-api.binance.vision", "https://api.binance.com")
SOURCE = "Binance spot candles (data-api.binance.vision), dollars traded by price"
# the pairs were checked against the source on 2026-11-22; every one answered
ASSETS = [("btc", "BTCUSDT", "Bitcoin"), ("eth", "ETHUSDT", "Ethereum"), ("sol", "SOLUSDT", "Solana"),
          ("xrp", "XRPUSDT", "XRP"), ("bnb", "BNBUSDT", "BNB"), ("doge", "DOGEUSDT", "Dogecoin")]
RANGES = [(7, "1h"), (30, "1h"), (90, "1h"), (365, "1d")]
BINS = 64
PAGE = 1000                     # the most candles one request returns
VALUE_AREA = 0.70               # the share of the dollars the value area holds, as the method has always defined it
FRESH_H = 3                     # ask the source at most this often


def _f(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if v == v and abs(v) != float("inf") else None


def bn_get(get, params):
    for base in BN:
        j = get(base + "/api/v3/klines", params)
        if isinstance(j, list):
            return j
    return None


def fetch(get, symbol, interval, t_from, t_to):
    """every closed candle of the symbol opening in [t_from, t_to), walked forward a page at a time.
    Returns [(open_ms, high, low, quote_volume, taker_buy_quote)]; a row missing any of those is dropped."""
    out, start, seen = [], t_from * 1000, set()
    for _ in range(60):
        rows = bn_get(get, {"symbol": symbol, "interval": interval, "startTime": start, "limit": PAGE})
        if not rows:
            break
        got = 0
        for r in rows:
            if not isinstance(r, list) or len(r) < 11:
                continue
            t = r[0]
            if not isinstance(t, int) or t in seen or t >= t_to * 1000:
                continue
            hi, lo, q, b = _f(r[2]), _f(r[3]), _f(r[7]), _f(r[10])
            if hi is None or lo is None or q is None or b is None or hi < lo or lo <= 0 or q < 0:
                continue
            seen.add(t)
            out.append((t, hi, lo, q, min(b, q)))       # a buy share above the total would be a broken row
            got += 1
        nxt = max(r[0] for r in rows if isinstance(r, list) and isinstance(r[0], int)) + 1
        if got == 0 or nxt <= start or len(rows) < PAGE or nxt >= t_to * 1000:
            break
        start = nxt
    out.sort()
    return out


def spread(cands, lo, hi, n):
    """each candle's dollars spread evenly over the bins its high-low range covers"""
    step = (hi - lo) / n
    buy, sell = [0.0] * n, [0.0] * n
    for _t, c_hi, c_lo, q, b in cands:
        s = q - b
        a = max(lo, c_lo)
        z = min(hi, c_hi)
        if z < a:
            continue
        i0 = min(n - 1, max(0, int((a - lo) / step)))
        i1 = min(n - 1, max(0, int((z - lo) / step)))
        if i1 < i0:
            i1 = i0
        share = 1.0 / (i1 - i0 + 1)
        for i in range(i0, i1 + 1):
            buy[i] += b * share
            sell[i] += s * share
    return buy, sell


def value_area(tot, poc):
    """the smallest band of bins around the POC holding VALUE_AREA of the dollars, grown to the heavier neighbour.
    This is the method as it is normally defined, and it is deterministic: on a tie the lower side is taken."""
    total = sum(tot)
    if total <= 0:
        return poc, poc
    lo = hi = poc
    held = tot[poc]
    while held < total * VALUE_AREA and (lo > 0 or hi < len(tot) - 1):
        down = tot[lo - 1] if lo > 0 else -1.0
        up = tot[hi + 1] if hi < len(tot) - 1 else -1.0
        if up > down:
            hi += 1
            held += tot[hi]
        else:
            lo -= 1
            held += tot[lo]
    return lo, hi


def profile(cands):
    """one range's profile, or None when the source gave nothing usable"""
    if not cands:
        return None
    lo = min(c[2] for c in cands)
    hi = max(c[1] for c in cands)
    if not (hi > lo):
        hi = lo * 1.0001 if lo > 0 else lo + 1.0
    buy, sell = spread(cands, lo, hi, BINS)
    tot = [buy[i] + sell[i] for i in range(BINS)]
    if sum(tot) <= 0:
        return None
    poc = max(range(BINS), key=lambda i: tot[i])
    val, vah = value_area(tot, poc)
    last = max(cands)
    return {"lo": round(lo, 10), "hi": round(hi, 10), "step": (hi - lo) / BINS, "n": BINS,
            "buy": [round(v, 2) for v in buy], "sell": [round(v, 2) for v in sell],
            "poc": poc, "vah": vah, "val": val, "total": round(sum(tot), 2),
            "t0": int(min(c[0] for c in cands) // 1000), "t1": int(last[0] // 1000),
            "candles": len(cands)}


def due(prev, now, force=False):
    if force or not prev or not prev.get("updated_at"):
        return True
    try:
        then = datetime.fromisoformat(prev["updated_at"])
    except (ValueError, TypeError):
        return True
    return (now - then).total_seconds() >= FRESH_H * 3600


def run(get, now, force=False, log=print):
    prev = C._load(OUT)
    if not due(prev, now, force):
        log("volume profile: still fresh, nothing asked")
        return "fresh"
    end = int(now.timestamp())
    assets, filled = {}, 0
    for key, sym, name in ASSETS:
        ranges = {}
        for days, interval in RANGES:
            cands = fetch(get, sym, interval, end - days * 86400, end)
            p = profile(cands)
            if p:
                ranges[str(days)] = p
                filled += 1
        if ranges:
            newest = ranges[min(ranges, key=lambda k: int(k))]
            assets[key] = {"sym": sym, "name": name, "ranges": ranges,
                           "price": round((newest["lo"] + newest["hi"]) / 2, 10)}
    if not assets:
        log("volume profile: the source gave nothing; the old file stays")
        return "empty"
    doc = {"source": SOURCE, "updated_at": now.isoformat(), "bins": BINS, "value_area": VALUE_AREA,
           "assets": assets, "order": [k for k, _s, _n in ASSETS if k in assets]}
    os.makedirs(OUT_DIR, exist_ok=True)
    C._save(OUT, doc)
    log(f"volume profile: {len(assets)} assets, {filled} profiles, "
        + ", ".join(f"{k} {len(v['ranges'])}r" for k, v in assets.items()))
    return "written"


def main():
    now = datetime.now(timezone.utc).replace(microsecond=0)
    run(lambda url, params: C.get(url, params), now, force=os.environ.get("OBS_VPROFILE_FORCE") == "1")
    return 0


if __name__ == "__main__":
    sys.exit(main())
