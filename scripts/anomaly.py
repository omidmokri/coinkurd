#!/usr/bin/env python3
"""Daily anomaly hunter — what is statistically unusual today in volume, price, taker flow, open interest and funding.

Every measure is compared with the SAME coin's previous 30 days using a robust z-score
    z = (x - median) / (1.4826 * MAD)
so one wild day in the window cannot hide the next one (a mean/std-dev z-score would).

Flags (last closed daily bar, Binance spot; OI and funding from OKX perpetual swaps):
    vol      volume z >= 3                      unusual turnover
    move     |return| z >= 3                    unusual price move
    quiet    volume z >= 3 and |return| z < 1    "volume without price": heavy trading, price barely moved
    buy/sell taker-buy share z >= +3 / <= -3     one side hit the market far more than usual
    oi       daily OI change z >= 3 (|.|)        positions opened or closed unusually fast
    fund     daily mean funding z >= 3 (|.|)     leverage paying far more (or less) than usual

Honesty: an anomaly is NOT a signal. Every price flag is back-tested over about a year of daily bars:
what happened in the next 1 / 3 / 7 days after the flag versus every coin-day without it (the baseline).
OKX keeps only ~1 month of daily OI / funding history per coin, so those two flags are shown but not back-tested.

Daily run (heavy, once per closed day): fetches data, writes data/anomaly.json.
Every run (light): refreshes a "now" view from data/market.json (24h volume so far) and data/derivatives.json
(current funding) against the stored per-coin baselines, no API calls.
Run: python3 scripts/anomaly.py            FORCE=1 to redo today's daily part
"""
import math
import os
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reality_common as R  # noqa: E402

MAX_COINS = 60
WIN = 30
Z = 3.0
DAYS = 400
FWD = (1, 3, 7)
STABLE = {"USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDE", "PYUSD", "USD1", "RWUSD", "XAUT", "PAXG", "BUSD", "USDD"}
OKX = "https://www.okx.com/api/v5/"
FLAGS = ("vol", "move", "quiet", "buy", "sell", "oi", "fund")


# ------------------------------------------------------------------ robust z
def rz(x, window):
    w = [v for v in window if v is not None]
    if x is None or len(w) < 15:
        return None
    med = R.median(w)
    mad = R.median([abs(v - med) for v in w])
    if mad <= 0:
        # flat window (e.g. funding stuck at the floor): fall back to mean abs deviation, then give up
        mad = sum(abs(v - med) for v in w) / len(w) / 1.2533
        if mad <= 0:
            return None
    return (x - med) / (1.4826 * mad)


def series_z(vals, i):
    return rz(vals[i], vals[max(0, i - WIN):i])


# ------------------------------------------------------------------ data
def coin_list():
    mk = R.load("market.json", {}).get("coins") or []
    out = []
    for c in mk:
        s = c.get("coin")
        if s and s not in STABLE and s not in out and s.isalnum():
            out.append(s)
    return out


def okx(path, params):
    try:
        j = R.http_json(OKX + path, params, tries=2)
        if str(j.get("code")) == "0":
            return j.get("data") or []
    except Exception as ex:  # noqa: BLE001
        print("  okx", path, params.get("ccy") or params.get("instId"), str(ex)[:80])
    return None


def okx_oi(coin):
    """{day: oi_usd} daily open interest (OKX rubik stat, about a month)"""
    rows = okx("rubik/stat/contracts/open-interest-volume", {"ccy": coin, "period": "1D"})
    out = {}
    for r in rows or []:
        try:
            out[R.day(R.from_ms(int(r[0])))] = float(r[1])
        except (TypeError, ValueError, IndexError):
            pass
    return out


def okx_funding(coin):
    """{day: mean funding % per 8h-equivalent} (OKX funding history, last 100 settlements)"""
    rows = okx("public/funding-rate-history", {"instId": f"{coin}-USDT-SWAP", "limit": "100"})
    by = defaultdict(list)
    times = []
    for r in rows or []:
        try:
            t = int(r["fundingTime"])
            by[R.day(R.from_ms(t))].append(float(r.get("realizedRate") or r["fundingRate"]) * 100)
            times.append(t)
        except (TypeError, ValueError, KeyError):
            pass
    times.sort()
    # normalise to an 8h-equivalent rate so coins on 4h / 1h intervals are comparable with 8h ones
    step_h = (R.median([b - a for a, b in zip(times, times[1:])]) / 3_600_000) if len(times) > 2 else 8
    k = 8 / step_h if step_h else 1
    return {d: sum(v) / len(v) * k for d, v in by.items()}


# ------------------------------------------------------------------ daily analysis per coin
def analyse(coin, bars, oi, fund):
    """returns (today_row, history_flags) — history_flags: [(day_index, set(flags), fwd returns)]"""
    c = [b["c"] for b in bars]
    lv = [math.log(b["v"]) if b["v"] > 0 else None for b in bars]
    mv = [None] + [abs(math.log(c[i] / c[i - 1])) for i in range(1, len(c))]
    tk = [(b["tb"] / b["v"]) if b["v"] > 0 else None for b in bars]
    days = [R.day(R.from_ms(b["t"])) for b in bars]
    hist = []
    for i in range(WIN + 1, len(bars)):
        zv, zm, zt = series_z(lv, i), series_z(mv, i), series_z(tk, i)
        fl = set()
        if zv is not None and zv >= Z:
            fl.add("vol")
            if zm is not None and zm < 1:
                fl.add("quiet")
        if zm is not None and zm >= Z:
            fl.add("move")
        if zt is not None and zt >= Z:
            fl.add("buy")
        if zt is not None and zt <= -Z:
            fl.add("sell")
        fwd = {h: (c[i + h] / c[i] - 1) * 100 if i + h < len(c) else None for h in FWD}
        ret = (c[i] / c[i - 1] - 1) * 100
        hist.append((days[i], fl, fwd, ret, zv, zm, zt))
    if not hist:
        return None, []
    d, fl, _, ret, zv, zm, zt = hist[-1]
    row = {"coin": coin, "d": d, "price": c[-1], "ret": round(ret, 2), "vol_usd": round(bars[-1]["v"]),
           "z": {"vol": r2(zv), "move": r2(zm), "taker": r2(zt)}, "flags": sorted(fl)}
    # derivatives (latest day that both the series and its window cover)
    if len(oi) > 8:
        od = sorted(oi)
        ch = [None] + [(oi[od[j]] / oi[od[j - 1]] - 1) * 100 if oi[od[j - 1]] else None for j in range(1, len(od))]
        z_oi = rz(ch[-1], ch[1:-1]) if len(ch) > 16 else None
        row["oi"] = {"d": od[-1], "usd": round(oi[od[-1]]), "chg": r2(ch[-1]), "z": r2(z_oi), "n": len(od)}
        if z_oi is not None and abs(z_oi) >= Z:
            row["flags"].append("oi")
    if len(fund) > 8:
        fd = sorted(fund)
        vals = [fund[x] for x in fd]
        z_f = rz(vals[-1], vals[:-1]) if len(vals) > 16 else None
        row["fund"] = {"d": fd[-1], "rate": round(vals[-1], 4), "z": r2(z_f), "n": len(fd),
                       "base": round(R.median(vals[:-1]), 4)}
        if z_f is not None and abs(z_f) >= Z:
            row["flags"].append("fund")
    row["score"] = round(max(abs(x) for x in (zv or 0, zm or 0, zt or 0,
                                              (row.get("oi") or {}).get("z") or 0, (row.get("fund") or {}).get("z") or 0)), 2)
    # baselines for the light intraday check
    row["base"] = {"vol_med": round(math.exp(R.median([x for x in lv[-WIN - 1:-1] if x is not None]))),
                   "vol_mad": round(R.median([abs(x - R.median([y for y in lv[-WIN - 1:-1] if y is not None]))
                                              for x in lv[-WIN - 1:-1] if x is not None]), 4)}
    return row, hist


def r2(x):
    return None if x is None else round(x, 2)


# ------------------------------------------------------------------ back-test of the flags
def backtest(all_hist):
    """forward return after each flag vs every coin-day (the baseline), per horizon"""
    base = {h: [] for h in FWD}
    by = {f: {h: [] for h in FWD} for f in FLAGS[:5]}
    flagged_signed = {f: {h: [] for h in FWD} for f in FLAGS[:5]}
    for coin, hist in all_hist.items():
        for d, fl, fwd, ret, *_ in hist:
            for h in FWD:
                if fwd[h] is None:
                    continue
                base[h].append(fwd[h])
                for f in fl:
                    if f in by:
                        by[f][h].append(fwd[h])
                        # continuation: does the next move follow the flag day's direction?
                        flagged_signed[f][h].append(fwd[h] * (1 if ret >= 0 else -1))

    def st(v):
        if not v:
            return {"n": 0}
        return {"n": len(v), "mean": round(sum(v) / len(v), 3), "median": round(R.median(v), 3),
                "up": round(100 * sum(1 for x in v if x > 0) / len(v), 1), "abs": round(sum(abs(x) for x in v) / len(v), 3)}

    out = {"base": {f"{h}d": st(base[h]) for h in FWD}}
    for f in by:
        out[f] = {f"{h}d": st(by[f][h]) for h in FWD}
        for h in FWD:
            fs = flagged_signed[f][h]
            if fs:
                out[f][f"{h}d"]["cont"] = round(100 * sum(1 for x in fs if x > 0) / len(fs), 1)
    return out


# ------------------------------------------------------------------ light "now" view (no API calls)
def now_view(prev):
    mk = {c["coin"]: c for c in (R.load("market.json", {}).get("coins") or [])}
    dv = {x["coin"]: x for x in (R.load("derivatives.json", {}).get("swaps") or [])}
    out = []
    for row in prev.get("today", []):
        c = row["coin"]
        b = row.get("base") or {}
        item = {"coin": c}
        v24 = (mk.get(c) or {}).get("vol24")
        if v24 and b.get("vol_med") and b.get("vol_mad"):
            item["vol24"] = round(v24)
            item["vol_z"] = r2((math.log(v24) - math.log(b["vol_med"])) / (1.4826 * b["vol_mad"]))
        fd = (row.get("fund") or {})
        f_now = (dv.get(c) or {}).get("funding")
        if f_now is not None and fd.get("base") is not None:
            item["fund_now"] = f_now
            item["fund_base"] = fd["base"]
        item["chg24"] = (mk.get(c) or {}).get("chg24")
        out.append(item)
    hot = [x for x in out if (x.get("vol_z") or 0) >= Z]
    return {"at": R.iso(datetime.now(timezone.utc)), "hot": sorted(hot, key=lambda x: -x["vol_z"])[:12], "n": len(out)}


# ------------------------------------------------------------------ main
def main():
    prev = R.load("anomaly.json", {})
    now = datetime.now(timezone.utc)
    today0 = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    last_closed = R.day(R.from_ms(R.ms(today0) - 86_400_000))
    if prev.get("day") == last_closed and not os.environ.get("FORCE"):
        prev["now"] = now_view(prev)
        R.save("anomaly.json", prev)
        print(f"anomaly: {last_closed} done; now view refreshed ({len(prev['now']['hot'])} hot)")
        return

    t0 = time.time()
    today, all_hist, errors, okx_ok = [], {}, {}, 0
    start = R.ms(today0) - DAYS * 86_400_000
    for coin in coin_list():
        if len(today) >= MAX_COINS:
            break
        try:
            bars = [b for b in R.klines(coin, "1d", start=start, limit=1000) if b["t"] < R.ms(today0)]
        except Exception as ex:  # noqa: BLE001
            errors[coin] = str(ex)[:80]
            continue
        if len(bars) < 120:
            continue
        oi, fund = okx_oi(coin), okx_funding(coin)
        okx_ok += bool(oi or fund)
        time.sleep(0.45)                          # OKX: about 5 requests / 2 s on the stats endpoint
        row, hist = analyse(coin, bars, oi, fund)
        if row:
            today.append(row)
            all_hist[coin] = hist
    if not today:
        print("anomaly: no data", errors)
        return
    bt = backtest(all_hist)
    days_cov = sorted({d for h in all_hist.values() for d, *_ in h})
    out = {
        "version": 1, "updated_at": R.iso(now), "day": last_closed, "window": WIN, "z": Z,
        "coins": len(today), "okx_coins": okx_ok, "errors": errors,
        "today": sorted(today, key=lambda r: -r["score"]),
        "counts": {f: sum(1 for r in today if f in r["flags"]) for f in FLAGS},
        "backtest": bt, "bt_from": days_cov[0] if days_cov else None, "bt_to": days_cov[-1] if days_cov else None,
        "log": (prev.get("log") or [])[-60:],
    }
    out["log"] = [x for x in out["log"] if x.get("d") != last_closed] + [
        {"d": last_closed, "flags": {r["coin"]: r["flags"] for r in today if r["flags"]}}]
    out["log"] = out["log"][-60:]
    out["now"] = now_view(out)
    R.save("anomaly.json", out)
    print(f"anomaly: {last_closed} {len(today)} coins (okx {okx_ok}) in {time.time() - t0:.0f}s, "
          f"flags {out['counts']}, top {[(r['coin'], r['score']) for r in out['today'][:5]]}")


if __name__ == "__main__":
    main()
