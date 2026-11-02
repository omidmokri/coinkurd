#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kurdistani indicators engine — exact server-side ports of Coin_Kurd's OPEN-SOURCE TradingView scripts
(the code is public on TradingView; logic and default inputs are copied 1:1, nothing tuned):

  • Kurdistani BITCOIN POWER LAW   https://www.tradingview.com/script/umPv6JPM/
        days = (time − 2009-01-03 UTC) / 1 day ;  P = 8.31e-17 · days^5.48 ;  bands ±10 % ;
        BUY ZONE = close ≤ lower band · (1 − 18 %) ;  touch = close ≤ P · 1.07 (lowest close per year, last 8 years)
  • Kurdistani Style Cycle         https://www.tradingview.com/script/DRuCJ6Bk/
        MVRV (Coin Metrics, same feed TradingView uses: BTC_MARKETCAP / BTC_MARKETCAPREAL), NUPL = 1 − 1/MVRV,
        SOPR proxy from BINANCE:BTCUSDT daily high/low/close (STH 155, LTH 365, SMA 5),
        z-scores (365, population stdev like Pine ta.stdev), weights 0.4/0.4/0.2, Bull-Bear = PnL − SMA(PnL, 365),
        phases: Extreme Bear ≤ −1.5 < Bear ≤ 0 < Early Bull ≤ 0.5 < Bull ≤ 1.5 < Overheated
  • Kurdistani Bitcoin Spiral       https://www.tradingview.com/script/tECCygHQ/  (weekly price series for the live spiral)

Every state change becomes a "server" signal in data/signals.json (with real follow-up returns),
so the site can show these indicators' signals without any TradingView alert.
Output: data/kind.json  (+ merges events into data/signals.json)
"""
import json
import math
import os
import time
from datetime import datetime, timezone, timedelta

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
OUT = os.path.join(D, "kind.json")
SIG = os.path.join(D, "signals.json")
NOW = datetime.now(timezone.utc)
CM = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics"
BN = "https://data-api.binance.vision/api/v3/klines"
UA = {"User-Agent": "entekhab.net/1.0 (+https://entekhab.net)"}
GENESIS = datetime(2009, 1, 3, tzinfo=timezone.utc)
DAY_MS = 86400000


def get(url, params=None, timeout=60):
    for i in range(3):
        try:
            r = requests.get(url, params=params, timeout=timeout, headers=UA)
            if r.status_code == 200:
                return r.json()
            print("  http", r.status_code, url[:80], r.text[:160])
        except Exception as e:  # noqa: BLE001
            print("  err", str(e)[:140])
        time.sleep(3 + 4 * i)
    return None


# ------------------------------------------------------------------ data
def coinmetrics(start="2010-07-18"):
    """daily PriceUSD + CapMVRVCur (Coin Metrics community API, free) → {date: (price, mvrv)}"""
    out, nxt = {}, None
    params = {"assets": "btc", "metrics": "PriceUSD,CapMVRVCur", "frequency": "1d", "start_time": start, "page_size": 10000}
    for _ in range(4):
        j = get(nxt or CM, None if nxt else params)
        if not j:
            break
        for r in j.get("data", []):
            d = r["time"][:10]
            p = float(r["PriceUSD"]) if r.get("PriceUSD") else None
            m = float(r["CapMVRVCur"]) if r.get("CapMVRVCur") else None
            out[d] = (p, m)
        nxt = j.get("next_page_url")
        if not nxt:
            break
    return out


def binance_daily(start):
    """BINANCE:BTCUSDT daily klines from `start` (datetime) → {date: (high, low, close)}"""
    out, st = {}, int(start.timestamp() * 1000)
    for _ in range(8):
        k = get(BN, {"symbol": "BTCUSDT", "interval": "1d", "startTime": st, "limit": 1000})
        if not k:
            break
        for x in k:
            d = datetime.fromtimestamp(x[0] / 1000, timezone.utc).strftime("%Y-%m-%d")
            out[d] = (float(x[2]), float(x[3]), float(x[4]))
        if len(k) < 1000:
            break
        st = k[-1][0] + DAY_MS
    return out


# ------------------------------------------------------------------ Pine helpers (same semantics as ta.*)
def sma(a, n):
    out, q = [None] * len(a), []
    for i, v in enumerate(a):
        q.append(v)
        if len(q) > n:
            q.pop(0)
        if len(q) == n and all(x is not None for x in q):
            out[i] = sum(q) / n
    return out


def stdev(a, n):
    """Pine ta.stdev (biased = population standard deviation)"""
    out = [None] * len(a)
    for i in range(n - 1, len(a)):
        w = a[i - n + 1:i + 1]
        if any(x is None for x in w):
            continue
        m = sum(w) / n
        out[i] = math.sqrt(sum((x - m) ** 2 for x in w) / n)
    return out


def zscore(a, n):
    m, s = sma(a, n), stdev(a, n)
    return [None if (v is None or m[i] is None or s[i] in (None, 0)) else (v - m[i]) / s[i] for i, v in enumerate(a)]


def highest(a, n):
    return [max(a[i - n + 1:i + 1]) if i >= n - 1 else None for i in range(len(a))]


def lowest(a, n):
    return [min(a[i - n + 1:i + 1]) if i >= n - 1 else None for i in range(len(a))]


def r(x, n=4):
    return None if x is None else round(x, n)


# ------------------------------------------------------------------ Power Law (umPv6JPM)
def power_law_at(dt):
    days = (dt - GENESIS).total_seconds() / 86400.0
    return 8.31e-17 * days ** 5.48


PL_ZONES = ["buy_zone", "below_lower", "lower_fair", "fair_upper", "above_upper"]


def pl_zone(p, pl):
    lo, up = pl * 0.9, pl * 1.1
    if p <= lo * (1 - 0.18):
        return "buy_zone"
    if p < lo:
        return "below_lower"
    if p < pl:
        return "lower_fair"
    if p <= up:
        return "fair_upper"
    return "above_upper"


def confirmed_changes(days, states, prices, extra=None, n=3, since="2018-01-01"):
    """a new state counts only after n consecutive daily closes in it; the event is dated on the n-th close (actionable)"""
    ev, cur, run, cand = [], None, 0, None
    for i, (d, st) in enumerate(zip(days, states)):
        if st is None:
            continue
        if cur is None:
            cur = st
            continue
        if st == cur:
            cand, run = None, 0
            continue
        if st == cand:
            run += 1
        else:
            cand, run = st, 1
        if run >= n:
            if d >= since:
                ev.append({"t": d, "from": cur, "to": st, "price": round(prices[i], 2), **({k: v[i] for k, v in extra.items()} if extra else {})})
            cur, cand, run = st, None, 0
    return ev


def power_law(cm, today_price):
    dates = sorted(d for d, (p, _) in cm.items() if p)
    touches = {}
    series, zones, prices, fairs = [], [], [], []
    for d in dates:
        p = cm[d][0]
        dt = datetime.fromisoformat(d).replace(tzinfo=timezone.utc)
        pl = power_law_at(dt)
        if p <= pl * 1.07 and p > 10:                       # isPriceNearPowerLaw (confirmed daily bar)
            y = d[:4]
            touches[y] = min(touches.get(y, p), p)
        zones.append(pl_zone(p, pl))
        prices.append(p)
        fairs.append(round(pl, 2))
        if dt.weekday() == 6 or d == dates[-1]:            # weekly sample (Sundays) + last day
            series.append([d, round(p, 2), round(pl, 2)])
    events = confirmed_changes(dates, zones, prices, {"fair": fairs})
    now_pl = power_law_at(NOW.replace(hour=0, minute=0, second=0, microsecond=0))
    price = today_price or cm[dates[-1]][0]
    ty = sorted(touches.items())[-8:]
    return {
        "formula": "P(t) = 8.31e-17 · t^5.48  (t = days since 2009-01-03)", "r2": 0.9976,
        "fair": round(now_pl, 2), "upper": round(now_pl * 1.1, 2), "lower": round(now_pl * 0.9, 2),
        "buy_below": round(now_pl * 0.9 * 0.82, 2), "price": round(price, 2), "dev_pct": round((price / now_pl - 1) * 100, 2),
        "zone": pl_zone(price, now_pl), "touches": [[y, round(v, 2)] for y, v in ty],
        "targets": {"2026": 61000, "2030": 188000, "2035": 582000},
        "future": {str(y): round(power_law_at(datetime(y, 7, 1, tzinfo=timezone.utc))) for y in (2027, 2028, 2030, 2035)},
        "series": series, "events": events[-60:],
        # values shown on the publication chart (Jul 2026) to verify this port against TradingView
        "check": {d: round(power_law_at(datetime.fromisoformat(d).replace(tzinfo=timezone.utc)), 2) for d in ("2026-07-18", "2026-07-19", "2026-07-20")},
    }


# ------------------------------------------------------------------ Style Cycle (DRuCJ6Bk)
PHASES = ["Extreme Bear", "Bear", "Early Bull", "Bull", "Overheated Bull"]


def phase_of(bb):
    if bb is None:
        return None
    if bb > 1.5:
        return "Overheated Bull"
    if bb > 0.5:
        return "Bull"
    if bb > 0:
        return "Early Bull"
    if bb > -1.5:
        return "Bear"
    return "Extreme Bear"


def style_cycle(cm, bn):
    days = sorted(d for d in bn if d in cm and cm[d][1])
    if len(days) < 1200:
        return None
    hi = [bn[d][0] for d in days]
    lo = [bn[d][1] for d in days]
    cl = [bn[d][2] for d in days]
    mvrv = [cm[d][1] for d in days]
    nupl = [1 - 1 / m if m else None for m in mvrv]
    sh, sl, lh, ll = highest(hi, 155), lowest(lo, 155), highest(hi, 365), lowest(lo, 365)
    raw = []
    for i in range(len(days)):
        if None in (sh[i], sl[i], lh[i], ll[i]):
            raw.append(None)
            continue
        sp = 0.5 if sh[i] == sl[i] else (cl[i] - sl[i]) / (sh[i] - sl[i])
        lp = 0.5 if lh[i] == ll[i] else (cl[i] - ll[i]) / (lh[i] - ll[i])
        raw.append(sp - lp)
    sopr = sma(raw, 5)
    mz, nz_, sz = zscore(mvrv, 365), zscore(nupl, 365), zscore(sopr, 365)
    pnl = []
    for i in range(len(days)):
        parts = [(z, w) for z, w in ((mz[i], 0.4), (nz_[i], 0.4), (sz[i], 0.2)) if z is not None]
        wsum = sum(w for _, w in parts)
        pnl.append(sum(z * w for z, w in parts) / wsum if wsum and wsum / 1.0 >= 0.5 else None)
    pnl_ma = sma(pnl, 365)
    bb = [None if (p is None or pnl_ma[i] is None) else p - pnl_ma[i] for i, p in enumerate(pnl)]
    lp = [math.log(c) for c in cl]
    pz = zscore(lp, 365)
    rows = []
    for i, d in enumerate(days):
        if bb[i] is not None:
            rows.append([d, r(bb[i], 3), PHASES.index(phase_of(bb[i])), round(cl[i], 2)])
    events = confirmed_changes(days, [phase_of(x) for x in bb], cl, {"bb": [r(x, 3) for x in bb]}, since="2023-01-01")
    i = len(days) - 1
    while i > 0 and bb[i] is None:
        i -= 1
    ref = {}
    for d in ("2026-08-10", "2026-08-11", "2026-08-12"):
        if d in days:
            k = days.index(d)
            ref[d] = {"bull_bear": r(bb[k], 3), "pnl": r(pnl[k], 3), "nupl": r(nupl[k], 3), "sopr": r(sopr[k], 3), "price_z": r(pz[k], 3),
                      "price": cl[k], "phase": phase_of(bb[k])}
    return {
        "date": days[i], "phase": phase_of(bb[i]), "bull_bear": r(bb[i], 3), "pnl": r(pnl[i], 3), "mvrv": r(mvrv[i], 3),
        "nupl": r(nupl[i], 3), "sopr": r(sopr[i], 3), "price_z": r(pz[i], 3), "price": cl[i],
        "series": rows[-1100:], "events": events[-80:], "check": ref,
        "sources": "MVRV: Coin Metrics community (CapMVRVCur) · price/high/low: Binance BTCUSDT 1D",
    }


# ------------------------------------------------------------------ signals merge

def pl_side(fr, to):
    if to == "buy_zone":
        return "long"                                   # the script's own alertcondition: "Bitcoin BUY ZONE"
    if to == "above_upper":
        return "short"                                  # stretched above the +10 % band
    return "info"


def sc_side(fr, to):
    a, b = PHASES.index(fr), PHASES.index(to)
    if to == "Extreme Bear":
        return "long"                                   # guide: accumulation / long-term entries
    if to == "Early Bull" and a < b:
        return "long"                                   # guide: confirmed trend change after a bear phase
    if to == "Overheated Bull":
        return "short"                                  # guide: take profits / reduce exposure
    if to == "Bear" and a > b:
        return "short"                                  # leaving the bull phases
    return "info"                                       # e.g. Early Bull → Bull = keep holding


def merge_signals(pl, sc):
    try:
        sig = json.load(open(SIG, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        sig = {"signals": []}
    old = {s["id"]: s for s in sig.get("signals", []) if s.get("src") == "server"}
    keep = [s for s in sig.get("signals", []) if s.get("src") != "server"]
    new = []
    for ev in (pl or {}).get("events", []):
        new.append({"id": f"pl-{ev['t']}", "ind": "kurdistani-power-law", "src": "server", "sym": "BTCUSDT", "tf": "1D",
                    "t": ev["t"] + "T00:00:00+00:00", "side": pl_side(ev["from"], ev["to"]), "kind": "state",
                    "price": ev["price"], "state": ev["to"], "prev": ev["from"], "ref": ev.get("fair")})
    for ev in (sc or {}).get("events", []):
        new.append({"id": f"sc-{ev['t']}", "ind": "kurdistani-style-cycle", "src": "server", "sym": "BTCUSDT", "tf": "1D",
                    "t": ev["t"] + "T00:00:00+00:00", "side": sc_side(ev["from"], ev["to"]), "kind": "state",
                    "price": ev["price"], "state": ev["to"], "prev": ev["from"], "ref": ev.get("bb")})
    for x in new:                                       # keep outcomes already computed by signals.py
        if x["id"] in old and old[x["id"]].get("out"):
            x["out"] = old[x["id"]]["out"]
    sig["signals"] = sorted(keep + new, key=lambda s: s["t"], reverse=True)
    sig["updated_at"] = NOW.isoformat()
    json.dump(sig, open(SIG, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    return len(new)


def main():
    prev = {}
    try:
        prev = json.load(open(OUT, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        pass
    if prev.get("updated_at") and NOW - datetime.fromisoformat(prev["updated_at"]) < timedelta(hours=3) and os.environ.get("KIND_FORCE") != "1":
        print("kind not due")
        return
    cm = coinmetrics()
    print("coinmetrics days:", len(cm), "last:", max(cm) if cm else None)
    bn = binance_daily(datetime(2021, 1, 1, tzinfo=timezone.utc))
    print("binance days:", len(bn), "last:", max(bn) if bn else None)
    if not cm:
        print("no Coin Metrics data; keep previous")
        return
    last_close = bn[max(bn)][2] if bn else None
    out = dict(prev)
    out["updated_at"] = NOW.isoformat()
    out["power_law"] = power_law(cm, last_close)
    sc = style_cycle(cm, bn) if bn else None
    if sc:
        out["style_cycle"] = sc
    wk = []
    for d in sorted(cm):
        p = cm[d][0]
        if p and (datetime.fromisoformat(d).weekday() == 6 or d == max(cm)):
            wk.append([d, round(p, 2)])
    if bn:
        wk.append([max(bn), round(last_close, 2)])
    out["spiral"] = {"weekly": wk, "ath": max(wk, key=lambda x: x[1]) if wk else None,
                     "halvings": ["2012-11-28", "2016-07-09", "2020-05-11", "2024-04-20", "2028-04-15"]}
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    n = merge_signals(out.get("power_law"), out.get("style_cycle"))
    pl = out["power_law"]
    print("power law: fair", pl["fair"], "price", pl["price"], "dev", pl["dev_pct"], pl["zone"], "| check", pl["check"])
    if sc:
        print("style cycle:", sc["date"], sc["phase"], "bb", sc["bull_bear"], "nupl", sc["nupl"], "| check", sc["check"])
    print("server signals:", n)


if __name__ == "__main__":
    main()
