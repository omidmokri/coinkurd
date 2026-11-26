#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The Observatory's extra on-chain measures — /charts/thermocap/, /charts/price-models/, /charts/capital-flow/,
/charts/hashprice/, /charts/eth-supply/, /charts/network-value/, /charts/onchain-score/, /charts/cycle-compass/,
/charts/capital-rotation/ and /charts/decentralization/ (assets/obs/xchain.js draws them, assets/obs/xchainmath.js
holds every definition).

No new source and no network: it reads only files the site already collects —
    data/obs/chain_<asset>.json   (scripts/obs_chain.py, Coin Metrics community data, CC BY-NC 4.0)
    data/btcinfo.json             (scripts/btcinfo.py, mempool.space: last week's mining pools)
    data/chain.json               (scripts/chain.py: reachable Bitcoin nodes)
and writes
    data/obs/xchain_now.json      the latest figures of every chain (the bot, the apps and the hub read it)
    data/obs/xchain_rot.json      weekly realized and market value of seven chains (/charts/capital-rotation/)

summary() is the same arithmetic as OBX.summary() in assets/obs/xchainmath.js — tests/test_obs_xchain.py runs both on
the same files and compares every figure. A file is rewritten only when its numbers changed.
Self-test: python3 tests/test_obs_xchain.py
"""
import bisect
import json
import math
import os
import sys
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OBS = os.path.join(ROOT, "data", "obs")
ASSETS = ("btc", "eth", "ltc", "bch", "doge", "ada", "xrp")
MERGE = "2022-09-15"
SCORE_FROM = "2012-01-01"
SCORE_KEYS = ("mvrvz", "puell", "mayer", "w200", "y2", "tmult")
BANDS = (0, 20, 40, 60, 80, 100.0001)
SOURCE = "Coin Metrics community data (coinmetrics.io), CC BY-NC 4.0 · mempool.space"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obs_chain as OC  # noqa: E402  (derived(), unpack(), the same arithmetic the other pages use)


# ---------------------------------------------------------------- small pieces (the same as chainmath.js)
def _idx(t0, iso):
    return (date.fromisoformat(iso) - date.fromisoformat(t0)).days


def _day(t0, i):
    return (date.fromisoformat(t0) + timedelta(days=i)).isoformat()


def _last(a):
    for i in range(len(a) - 1, -1, -1):
        if a[i] is not None:
            return i
    return -1


def _sma(a, w):
    n, out = len(a), [None] * len(a)
    pre, gap = [0.0] * (n + 1), [0] * (n + 1)
    for i in range(n):
        pre[i + 1] = pre[i] + (a[i] if a[i] is not None else 0.0)
        gap[i + 1] = gap[i] + (1 if a[i] is None else 0)
    for i in range(w - 1, n):
        if not gap[i + 1] - gap[i + 1 - w]:
            out[i] = (pre[i + 1] - pre[i + 1 - w]) / w
    return out


def _rsum(a, w):
    m = _sma(a, w)
    return [None if v is None else v * w for v in m]


def _rank(a, i):
    cur = a[i]
    if cur is None:
        return None
    vals = [x for x in a[: i + 1] if x is not None]
    return 100.0 * sum(1 for x in vals if x <= cur) / len(vals) if vals else None


def _exp_rank(a):
    """every day's share of the days up to it whose value is ≤ its own (OBX.expRank)"""
    out, seen = [None] * len(a), []
    for i, v in enumerate(a):
        if v is None or not math.isfinite(v):
            continue
        bisect.insort(seen, v)
        out[i] = 100.0 * bisect.bisect_right(seen, v) / len(seen)
    return out


def _median(a):
    v = sorted(x for x in a if x is not None and math.isfinite(x))
    if not v:
        return None
    m = len(v) // 2
    return v[m] if len(v) % 2 else (v[m - 1] + v[m]) / 2


def band(v):
    if v is None:
        return None
    for b in range(5):
        if v < BANDS[b + 1]:
            return b
    return 4


# ---------------------------------------------------------------- the series (OBX.xseries)
def xseries(asset, t0, n, cols):
    z = [None] * n
    price, mvrv, sply = cols.get("price") or z, cols.get("mvrv") or z, cols.get("sply") or z
    iss, fee = cols.get("iss") or z, cols.get("fee") or z
    X = {"price": price}
    X["mcap"] = [p * s if p is not None and s is not None else None for p, s in zip(price, sply)]
    X["rcap"] = [m / v if m is not None and v else None for m, v in zip(X["mcap"], mvrv)]
    X["rprice"] = [p / v if p is not None and v else None for p, v in zip(price, mvrv)]
    f0 = next((i for i, p in enumerate(price) if p is not None), -1)
    # thermocap
    tc, run = [None] * n, 0.0
    for i in range(n):
        if iss[i] is None and fee[i] is None:
            continue
        if price[i] is not None:
            run += ((iss[i] or 0) + (fee[i] or 0)) * price[i]
        if f0 >= 0 and i >= f0:
            tc[i] = run
    X["thermo"] = tc
    X["tmult"] = [X["mcap"][i] / tc[i] if tc[i] and tc[i] > 0 and X["mcap"][i] is not None else None for i in range(n)]
    X["rtc"] = [X["rcap"][i] / tc[i] if tc[i] and tc[i] > 0 and X["rcap"][i] is not None else None for i in range(n)]
    # average / delta / top
    for k in ("avgcap", "deltacap", "avgprice", "deltaprice", "topprice", "chpos"):
        X[k] = [None] * n
    acc, k = 0.0, 0
    if f0 >= 0:
        for i in range(f0, n):
            if X["mcap"][i] is None:
                break                      # a missing day ends the running mean: no guess
            acc += X["mcap"][i]
            k += 1
            avg = acc / k
            X["avgcap"][i] = avg
            if X["rcap"][i] is not None:
                X["deltacap"][i] = X["rcap"][i] - avg
            if sply[i]:
                X["avgprice"][i] = avg / sply[i]
                X["topprice"][i] = 35 * avg / sply[i]
                if X["deltacap"][i] is not None:
                    X["deltaprice"][i] = X["deltacap"][i] / sply[i]
                dp, tp, p = X["deltaprice"][i], X["topprice"][i], price[i]
                if dp is not None and dp > 0 and tp > dp and p is not None and p > 0:
                    X["chpos"][i] = (math.log(p) - math.log(dp)) / (math.log(tp) - math.log(dp)) * 100
    # capital flow
    for key in ("rflow30", "rflow90", "rpct30", "rpct90"):
        X[key] = [None] * n
    r = X["rcap"]
    for i in range(n):
        if r[i] is None:
            continue
        for w in (30, 90):
            if i >= w and r[i - w] is not None:
                X[f"rflow{w}"][i] = r[i] - r[i - w]
                if r[i - w] > 0:
                    X[f"rpct{w}"][i] = (r[i] / r[i - w] - 1) * 100
    # hashprice (Bitcoin only: hash rate is in TH/s)
    hs = (cols.get("hash") or z) if asset == "btc" else z
    X["hpusd"], X["hpsat"] = [None] * n, [None] * n
    for i in range(n):
        if hs[i] and hs[i] > 0 and iss[i] is not None and fee[i] is not None:
            X["hpsat"][i] = (iss[i] + fee[i]) * 1e8 / hs[i]
            if price[i] is not None:
                X["hpusd"][i] = (iss[i] + fee[i]) * price[i] / hs[i] * 1000
    X["hpusd30"] = _sma(X["hpusd"], 30)
    # Metcalfe
    adr30 = _sma(cols.get("adr") or z, 30)
    raw = [X["mcap"][i] / (adr30[i] * adr30[i]) if X["mcap"][i] is not None and adr30[i] else None for i in range(n)]
    med = _median(raw)
    X["nvm"] = [x / med if x is not None and med else None for x in raw]
    lr = [math.log(x) if x is not None and x > 0 else None for x in X["nvm"]]
    lp, l2 = _sma(lr, 365), _sma([None if x is None else x * x for x in lr], 365)
    X["nvmz"] = [None] * n
    for i in range(n):
        if lr[i] is not None and lp[i] is not None:
            va = l2[i] - lp[i] * lp[i]
            if va > 1e-12:
                X["nvmz"][i] = (lr[i] - lp[i]) / math.sqrt(va)
    # Ether
    for key in ("sincemerge", "infl365", "infl90", "burn365", "burn90", "iss365", "israte365"):
        X[key] = [None] * n
    if asset == "eth":
        m0, I, I90 = _idx(t0, MERGE), _rsum(iss, 365), _rsum(iss, 90)
        for i in range(n):
            if sply[i] is None:
                continue
            if 0 <= m0 <= i and sply[m0] is not None:
                X["sincemerge"][i] = sply[i] - sply[m0]
            if i >= 365 and sply[i - 365] is not None:
                d = sply[i] - sply[i - 365]
                X["infl365"][i] = d / sply[i - 365] * 100
                if I[i] is not None:
                    X["burn365"][i], X["iss365"][i], X["israte365"][i] = I[i] - d, I[i], I[i] / sply[i - 365] * 100
            if i >= 90 and sply[i - 90] is not None:
                d = sply[i] - sply[i - 90]
                X["infl90"][i] = d / sply[i - 90] * 100 * 365 / 90
                if I90[i] is not None:
                    X["burn90"][i] = I90[i] - d
    # the on-chain temperature
    der = OC.derived(cols, n)
    comp = {"mvrvz": der["mvrvz"], "puell": der["puell"], "mayer": der["mayer"], "w200": der["w200"], "y2": der["y2"], "tmult": X["tmult"]}
    X["pct"] = {k2: _exp_rank(comp[k2]) for k2 in SCORE_KEYS}
    s0 = max(0, _idx(t0, SCORE_FROM))
    cnt, tot = [None] * n, [None] * n
    full_n = 0
    for i in range(s0, n):
        v = [X["pct"][k2][i] for k2 in SCORE_KEYS if X["pct"][k2][i] is not None]
        cnt[i], tot[i] = len(v), sum(v)
        full_n = max(full_n, len(v))
    X["score_n"] = full_n
    full = next((i for i in range(s0, n) if cnt[i] == full_n), -1)
    X["score"] = [None] * n
    if full_n >= 4:
        for i in range(s0, n):
            if cnt[i] == full_n or (i < full and cnt[i] == full_n - 1):
                X["score"][i] = tot[i] / cnt[i]
    return X


def summary(asset, t0, n, cols, X=None):
    X = X or xseries(asset, t0, n, cols)
    s = {}
    i = _last(X["price"])
    if i < 0:
        return s
    s["date"], s["price"] = _day(t0, i), X["price"][i]

    def put(key, a, j):
        if a[j] is not None and math.isfinite(a[j]):
            s[key] = a[j]

    v = _last(X["rcap"])
    if v >= 0:
        s["val_date"] = _day(t0, v)
        for key in ("rprice", "rcap", "avgprice", "deltaprice", "topprice", "chpos", "rflow30", "rflow90", "rpct30", "rpct90", "rtc"):
            put(key, X[key], v)
    t = _last(X["tmult"])
    if t >= 0:
        s["thermo_date"], s["thermo"], s["tmult"], s["tmult_pct"] = _day(t0, t), X["thermo"][t], X["tmult"][t], _rank(X["tmult"], t)
    h = _last(X["hpusd"])
    if h >= 0:
        s["hp_date"], s["hpusd"], s["hpsat"], s["hpusd_pct"] = _day(t0, h), X["hpusd"][h], X["hpsat"][h], _rank(X["hpusd"], h)
        if X["hpusd30"][h] is not None:
            s["hpusd30"] = X["hpusd30"][h]
    q = _last(X["nvm"])
    if q >= 0:
        s["nvm_date"], s["nvm"], s["nvm_pct"] = _day(t0, q), X["nvm"][q], _rank(X["nvm"], q)
        if X["nvmz"][q] is not None:
            s["nvmz"] = X["nvmz"][q]
    if asset == "eth":
        e = _last(X["infl365"])
        if e >= 0:
            s["eth_date"] = _day(t0, e)
            put("sply", cols["sply"], e)
            for key in ("sincemerge", "infl365", "infl90", "burn365", "burn90", "iss365", "israte365"):
                put(key, X[key], e)
    k = _last(X["score"])
    if k >= 0:
        s["score_date"], s["score"] = _day(t0, k), X["score"][k]
        s["score_band"], s["score_n"] = band(s["score"]), X["score_n"]
        s["parts"] = {k2: X["pct"][k2][k] for k2 in SCORE_KEYS if X["pct"][k2][k] is not None}
        if k >= 30 and X["score"][k - 30] is not None:
            s["score30"] = X["score"][k - 30]
    return s


def _fin(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def pools(P):
    """last week's mining pools → Nakamoto coefficient and HHI (OBX.pools)"""
    if not isinstance(P, dict) or not isinstance(P.get("list"), list):
        return None
    tot = P.get("total")
    if not _fin(tot) or tot <= 0:
        return None
    # only [name, finite block count] rows: one odd row from the API must not stop the rest of the file
    good = [(str(r[0] if r[0] is not None else "")[:40], r[1]) for r in P["list"]
            if isinstance(r, (list, tuple)) and len(r) >= 2 and _fin(r[1]) and r[1] >= 0]
    if not good:
        return None
    rows, run, nc, hhi, listed = [], 0.0, None, 0.0, 0
    for k, (name, blocks) in enumerate(sorted(good, key=lambda r: -r[1])):
        sh = blocks / tot
        run += sh
        listed += blocks
        hhi += sh * sh * 10000
        if nc is None and run > 0.5:
            nc = k + 1
        rows.append({"name": str(name)[:40], "blocks": int(blocks), "share": sh * 100, "cum": run * 100})
    rest = tot - listed
    return {"total": tot, "rows": rows, "nakamoto": nc, "hhi": hhi, "hhi_min": hhi, "rest": rest, "rest_share": rest / tot * 100,
            "top1": rows[0]["share"], "top2": rows[0]["share"] + (rows[1]["share"] if len(rows) > 1 else 0)}


# ---------------------------------------------------------------- files
def _load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return None


def _sig(x, n=6):
    if x is None or isinstance(x, (bool, str)):
        return x
    if isinstance(x, int):
        return x
    if not math.isfinite(x):
        return None
    if x == 0:
        return 0
    r = round(x, -int(math.floor(math.log10(abs(x)))) + (n - 1))
    return int(r) if r == int(r) and abs(r) < 1e15 else r


def _compact(o):
    if isinstance(o, dict):
        return {k: _compact(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_compact(v) for v in o]
    return _sig(o) if isinstance(o, float) else o


def _save_if_changed(path, obj, keep=("updated_at",)):
    old = _load(path)
    if old is not None and {k: v for k, v in old.items() if k not in keep} == {k: v for k, v in obj.items() if k not in keep}:
        return False
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)
    return True


def rotation(files):
    """weekly (every seventh day back from the last day all chains share) realized and market value of each chain"""
    ser = {}
    for a, (t0, n, cols) in files.items():
        X = {"mcap": [], "rcap": []}
        price, mvrv, sply = cols.get("price"), cols.get("mvrv"), cols.get("sply")
        if not price or not mvrv or not sply:
            continue
        base = date.fromisoformat(t0)
        by = {}
        for i in range(n):
            if price[i] is not None and sply[i] is not None and mvrv[i]:
                mc = price[i] * sply[i]
                by[base + timedelta(days=i)] = (mc, mc / mvrv[i])
        ser[a] = by
    assets = [a for a in ASSETS if a in ser]
    if len(assets) < 2:
        return None
    end = min(max(ser[a]) for a in assets)
    days = []
    d = end
    while all(d in ser[a] for a in assets):
        days.append(d)
        d -= timedelta(days=7)
    days.reverse()
    epoch = date(1970, 1, 1)
    return {"assets": assets, "t": [(x - epoch).days * 86400000 for x in days],
            "rcap": {a: [_sig(ser[a][x][1]) for x in days] for a in assets},
            "mcap": {a: [_sig(ser[a][x][0]) for x in days] for a in assets}}


def main():
    now = datetime.now(timezone.utc).isoformat()
    files, out = {}, {"source": SOURCE}
    for a in ASSETS:
        doc = _load(os.path.join(OBS, f"chain_{a}.json"))
        if not doc or not doc.get("cols"):
            print(f"  {a}: no file")
            continue
        t0, n, cols = OC.unpack(doc)
        files[a] = (t0, n, cols)
        s = summary(a, t0, n, cols)
        out[a] = _compact(s)
        print(f"  {a}: {s.get('date')} score {s.get('score') and round(s['score'], 1)}")
    try:
        p = pools((_load(os.path.join(ROOT, "data", "btcinfo.json")) or {}).get("pools"))
    except Exception as e:  # noqa: BLE001  the pools are one tile of one page: never the reason the rest goes stale
        print("  pools skipped:", e)
        p = None
    if p:
        out["pools"] = _compact(p)
    nodes = (_load(os.path.join(ROOT, "data", "chain.json")) or {}).get("nodes") or {}
    if isinstance(nodes.get("total"), int):
        out["nodes"] = {"total": nodes["total"], "at": nodes.get("at")}
    out["updated_at"] = now
    if len(files) == 0:
        print("no chain file: nothing written")
        return 1
    print("xchain_now.json", "written" if _save_if_changed(os.path.join(OBS, "xchain_now.json"), out) else "unchanged")
    rot = rotation(files)
    if rot:
        rot = {"source": SOURCE, **rot, "updated_at": now}
        print("xchain_rot.json", "written" if _save_if_changed(os.path.join(OBS, "xchain_rot.json"), rot) else "unchanged", len(rot["t"]), "weeks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
