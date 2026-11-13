#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
On-chain daily series for the Observatory — /charts/mvrv/, /charts/exchange-flows/, /charts/network/ and
/charts/bitcoin-cycle/ (assets/obs/chain.js draws them, assets/obs/chainmath.js derives every other measure).

Source: Coin Metrics' community API (free, no key). Its data licence is CC BY-NC 4.0: the pages name the source and the
site carries no adverts. Only measures of the community tier are asked for (the catalogue is read first, so a measure
that leaves the free tier is dropped instead of failing the whole request).

Writes  data/obs/chain_btc.json, data/obs/chain_eth.json   every day of the asset's history, one compact column per measure
        data/obs/chain_now.json                            the latest day's figures of both (the bot and the hub read it)

A column is {"o": index of its first day, "v": [...]}; day i is t0 + i days (UTC). Numbers are kept at 6 significant
digits (counts as integers). Nothing is estimated or filled in: a day the source has no value for is null.
The summary (`summary()`) is the same arithmetic as OBChain.summary() in assets/obs/chainmath.js —
tests/test_obs_chain.py runs both on the same file and compares every figure.

Asks the source at most every 3 hours (hourly while yesterday's row is still missing); the time of the last look is
kept in chain_now.json, and a big file is rewritten only when its numbers changed — so the repository does not take a
new half-megabyte copy eight times a day.   Self-test: python3 tests/test_obs_chain.py
"""
import json
import math
import os
import sys
import time
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "data", "obs")
API = "https://community-api.coinmetrics.io/v4"
UA = {"User-Agent": "entekhab.net/1.0 (+https://entekhab.net)"}
SOURCE = "Coin Metrics community data (coinmetrics.io), CC BY-NC 4.0"
DAY = 86400
# our column → Coin Metrics' measure
WANT = [("price", "PriceUSD"), ("mvrv", "CapMVRVCur"), ("sply", "SplyCur"), ("iss", "IssTotNtv"), ("fee", "FeeTotNtv"),
        ("hash", "HashRate"), ("adr", "AdrActCnt"), ("tx", "TxCnt"), ("tfr", "TxTfrCnt"),
        ("fin", "FlowInExNtv"), ("fout", "FlowOutExNtv"), ("sex", "SplyExNtv")]
INTS = {"adr", "tx", "tfr"}
SKIP = {"eth": {"hash"}}                    # Ether's hash rate ended with the Merge (September 2022)
ASSETS = ("btc", "eth")


def get(url, params=None, timeout=90):
    import requests
    for i in range(3):
        try:
            r = requests.get(url, params=params, timeout=timeout, headers=UA)
            if r.status_code == 200:
                return r.json()
            print("  http", r.status_code, url[:90], r.text[:160].replace("\n", " "))
            if r.status_code in (400, 401, 403, 404):
                return None
        except Exception as e:  # noqa: BLE001
            print("  err", str(e)[:140])
        time.sleep(4 + 5 * i)
    return None


def community_metrics(asset):
    """the daily measures the free tier offers for this asset, or None when the catalogue cannot be read"""
    j = get(API + "/catalog-v2/asset-metrics", {"assets": asset, "page_size": 100})
    try:
        out = set()
        for m in j["data"][0]["metrics"]:
            if any(f.get("frequency") == "1d" and f.get("community") for f in m.get("frequencies", [])):
                out.add(m["metric"])
        return out or None
    except Exception:  # noqa: BLE001
        return None


def fetch(asset, metrics):
    """every daily row of the asset, oldest first"""
    rows, nxt = [], None
    params = {"assets": asset, "metrics": ",".join(metrics), "frequency": "1d", "start_time": "2009-01-01", "page_size": 10000}
    for _ in range(6):
        j = get(nxt or (API + "/timeseries/asset-metrics"), None if nxt else params)
        if not j or "data" not in j:
            return None
        rows += j["data"]
        nxt = j.get("next_page_url")
        if not nxt:
            break
    return rows


def sig(x, n=6):
    """x at n significant digits, as the shortest number that prints it (an integer when it is one)"""
    if x == 0:
        return 0
    r = float(f"{x:.{n}g}")
    return int(r) if r == int(r) and abs(r) < 1e15 else r


def num(s, integer=False):
    if s is None or s == "":
        return None
    try:
        x = float(s)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(x):
        return None
    return int(round(x)) if integer else sig(x)


def columns(asset, rows):
    """rows of the API → (first day, number of days, {column: full list with None}); days missing in the answer stay None"""
    byday = {}
    for r in rows:
        d = str(r.get("time", ""))[:10]
        if len(d) == 10:
            byday[d] = r
    if not byday:
        return None, 0, {}
    days = sorted(byday)
    d0 = datetime.strptime(days[0], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    d1 = datetime.strptime(days[-1], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    n = (d1 - d0).days + 1
    cols = {}
    for name, metric in WANT:
        if name in SKIP.get(asset, ()):
            continue
        v = [None] * n
        seen = False
        for i in range(n):
            r = byday.get((d0 + timedelta(days=i)).strftime("%Y-%m-%d"))
            if r is not None and r.get(metric) is not None:
                v[i] = num(r.get(metric), name in INTS)
                seen = seen or v[i] is not None
        if seen:
            cols[name] = v
    return days[0], n, cols


# ------------------------------------------------------------------ the summary (mirrors OBChain.summary in chainmath.js)
def _last(a, upto=None):
    """index of the last value that is not None, at or before `upto`"""
    if not a:
        return -1
    i = min(len(a) - 1, len(a) - 1 if upto is None else upto)
    while i >= 0 and a[i] is None:
        i -= 1
    return i


def _mean(a, i, n):
    """mean of the n values ending at i; None unless all n are there"""
    if a is None or i - n + 1 < 0:
        return None
    w = a[i - n + 1:i + 1]
    if any(x is None for x in w):
        return None
    return sum(w) / n


def _sum(a, i, n):
    m = _mean(a, i, n)
    return None if m is None else m * n


def _rank(series, i):
    """share (per cent) of the days up to i whose value is at or below day i's"""
    cur = series[i]
    if cur is None:
        return None
    vals = [x for x in series[:i + 1] if x is not None]
    return 100.0 * sum(1 for x in vals if x <= cur) / len(vals) if vals else None


def derived(cols, n):
    """the full series the dashboard ranks today against: mvrv z-score, Puell, Mayer, price over the 200-week,
    2-year and Pi averages, drawdown"""
    price, mvrv, sply, iss = cols.get("price"), cols.get("mvrv"), cols.get("sply"), cols.get("iss")
    out = {k: [None] * n for k in ("mvrvz", "puell", "mayer", "w200", "pi", "y2", "dd", "nupl")}
    if not price:
        return out
    # expanding population standard deviation of the market value
    cnt, s1, s2 = 0, 0.0, 0.0
    ath = None
    issusd = [None] * n
    pre = [0.0] * (n + 1)           # prefix sums of price (None counts as a gap)
    gaps = [0] * (n + 1)
    for i in range(n):
        p = price[i]
        pre[i + 1] = pre[i] + (p or 0.0)
        gaps[i + 1] = gaps[i] + (1 if p is None else 0)
        if p is not None and iss and iss[i] is not None:
            issusd[i] = iss[i] * p
    ipre = [0.0] * (n + 1)
    igap = [0] * (n + 1)
    for i in range(n):
        ipre[i + 1] = ipre[i] + (issusd[i] or 0.0)
        igap[i + 1] = igap[i] + (1 if issusd[i] is None else 0)

    def ma(i, w):
        if i - w + 1 < 0 or gaps[i + 1] - gaps[i + 1 - w]:
            return None
        return (pre[i + 1] - pre[i + 1 - w]) / w

    for i in range(n):
        p = price[i]
        if p is None:
            continue
        ath = p if ath is None or p > ath else ath
        out["dd"][i] = (p / ath - 1) * 100
        m200, m1400, m111, m350, m730 = ma(i, 200), ma(i, 1400), ma(i, 111), ma(i, 350), ma(i, 730)
        if m200:
            out["mayer"][i] = p / m200
        if m1400:
            out["w200"][i] = p / m1400
        if m111 and m350:
            out["pi"][i] = m111 / (2 * m350)
        if m730:
            out["y2"][i] = p / m730
        if i - 364 >= 0 and not (igap[i + 1] - igap[i + 1 - 365]) and issusd[i] is not None:
            avg = (ipre[i + 1] - ipre[i + 1 - 365]) / 365
            if avg > 0:
                out["puell"][i] = issusd[i] / avg
        if mvrv and mvrv[i] and sply and sply[i] is not None:
            mc = p * sply[i]
            cnt += 1
            s1 += mc
            s2 += mc * mc
            var = s2 / cnt - (s1 / cnt) ** 2
            out["nupl"][i] = 1 - 1 / mvrv[i]
            if cnt > 1 and var > 0:
                out["mvrvz"][i] = (mc - mc / mvrv[i]) / math.sqrt(var)
    return out


def summary(t0, n, cols):
    """the latest day's figures; every key is absent when its inputs are"""
    price, mvrv, sply = cols.get("price"), cols.get("mvrv"), cols.get("sply")
    s = {}
    i = _last(price)
    if i < 0:
        return s
    d0 = datetime.strptime(t0, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    day = lambda k: (d0 + timedelta(days=k)).strftime("%Y-%m-%d")  # noqa: E731
    der = derived(cols, n)
    p = price[i]
    s["date"], s["price"] = day(i), p
    if mvrv and mvrv[i]:
        s["mvrv"], s["rprice"], s["nupl"] = mvrv[i], p / mvrv[i], 1 - 1 / mvrv[i]
        s["mvrv_pct"] = _rank(mvrv, i)
    if sply and sply[i] is not None:
        s["mcap"] = p * sply[i]
        if mvrv and mvrv[i]:
            s["rcap"] = s["mcap"] / mvrv[i]
    for k in ("mvrvz", "puell", "mayer", "w200", "pi", "y2", "dd"):
        if der[k][i] is not None:
            s[k] = der[k][i]
            s[k + "_pct"] = _rank(der[k], i)
    for w, k in ((200, "ma200"), (1400, "ma1400"), (111, "ma111"), (350, "ma350"), (730, "ma730")):
        m = _mean(price, i, w)
        if m is not None:
            s[k] = m
    iss, fee = cols.get("iss"), cols.get("fee")
    if iss and fee and iss[i] is not None and fee[i] is not None and iss[i] + fee[i] > 0:
        s["fee_share"] = fee[i] / (iss[i] + fee[i]) * 100
        s["rev_usd"] = (iss[i] + fee[i]) * p
    if iss and sply and sply[i] is not None:
        y = _sum(iss, i, 365)
        if y:
            s["s2f"] = sply[i] / y
    fin, fout, sex = cols.get("fin"), cols.get("fout"), cols.get("sex")
    if fin and fout and sex:
        j = min(_last(fin), _last(fout), _last(sex))
        if j >= 0:
            net = [None if fin[k] is None or fout[k] is None else fin[k] - fout[k] for k in range(n)]
            s["flow_date"], s["sex"], s["fin"], s["fout"], s["net1"] = day(j), sex[j], fin[j], fout[j], net[j]
            for w, k in ((7, "net7"), (30, "net30")):
                v = _sum(net, j, w)
                if v is not None:
                    s[k] = v
            if j - 30 >= 0 and sex[j - 30] is not None:
                s["sex_chg30"] = sex[j] - sex[j - 30]
            if price[j] is not None:
                s["sex_usd"] = sex[j] * price[j]
            if sply and sply[j]:
                s["sex_share"] = sex[j] / sply[j] * 100
    hs = cols.get("hash")
    if hs:
        k = _last(hs)
        if k >= 0:
            s["hash_date"], s["hash"] = day(k), hs[k] / 1e6            # TH/s → EH/s
            for w, key in ((30, "hash30"), (60, "hash60")):
                m = _mean(hs, k, w)
                if m is not None:
                    s[key] = m / 1e6
    for name, key in (("adr", "adr7"), ("tx", "tx7")):
        a = cols.get(name)
        if a:
            k = _last(a)
            m = _mean(a, k, 7) if k >= 0 else None
            if m is not None:
                s[key] = m
    return s


def pack(asset, t0, n, cols, now):
    out = {"asset": asset, "source": SOURCE, "updated_at": now.isoformat(), "t0": t0, "n": n, "cols": {}}
    for name, v in cols.items():
        o = next((i for i, x in enumerate(v) if x is not None), None)
        if o is None:
            continue
        out["cols"][name] = {"o": o, "v": v[o:]}
    out["summary"] = summary(t0, n, cols)
    return out


def unpack(doc):
    """file → (t0, n, {column: full list})"""
    n = doc["n"]
    cols = {}
    for name, c in doc.get("cols", {}).items():
        v = [None] * c["o"] + list(c["v"])
        cols[name] = v + [None] * (n - len(v))
    return doc["t0"], n, cols


def build(asset, rows, now):
    t0, n, cols = columns(asset, rows)
    if not t0 or "price" not in cols:
        return None
    return pack(asset, t0, n, cols, now)


def _load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return None


def _save(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


def due(prev, now, checked=None):
    """fetch when there is no file, when yesterday's row is missing (asked hourly), or every 3 hours for revisions.
    `checked` is when the source was last asked (chain_now.json); without it the file's own time counts."""
    if not prev or not prev.get("t0") or not (checked or prev.get("updated_at")):
        return True
    try:
        age = (now - datetime.fromisoformat(checked or prev["updated_at"])).total_seconds()
        last = datetime.strptime(prev["t0"], "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=prev["n"] - 1)
    except Exception:  # noqa: BLE001
        return True
    yesterday = (now - timedelta(days=1)).date()
    if last.date() < yesterday:
        return age >= 3600
    return age >= 3 * 3600


def main():
    now = datetime.now(timezone.utc).replace(microsecond=0)
    os.makedirs(OUT_DIR, exist_ok=True)
    force = os.environ.get("OBS_CHAIN_FORCE") == "1"
    nowdoc = _load(os.path.join(OUT_DIR, "chain_now.json")) or {}
    checked = nowdoc.get("checked") if isinstance(nowdoc.get("checked"), dict) else {}
    changed = False
    for asset in ASSETS:
        path = os.path.join(OUT_DIR, f"chain_{asset}.json")
        prev = _load(path)
        if not force and not due(prev, now, checked.get(asset)):
            print(f"{asset}: asked {checked.get(asset) or prev.get('updated_at')}, not due yet")
            continue
        have = community_metrics(asset)
        metrics = [m for name, m in WANT if name not in SKIP.get(asset, ()) and (have is None or m in have)]
        dropped = [m for name, m in WANT if name not in SKIP.get(asset, ()) and m not in metrics]
        if "PriceUSD" not in metrics:
            print(f"{asset}: the price is not on offer — nothing written")
            continue
        rows = fetch(asset, metrics)
        doc = build(asset, rows, now) if rows else None
        if not doc:
            print(f"{asset}: no data — the previous file stays")
            continue
        # a shorter answer than the file we hold is a broken answer: keep the file
        if prev and (doc["n"] < prev.get("n", 0) - 2 or len(doc["cols"]) < len(prev.get("cols", {})) - 2):
            print(f"{asset}: answer smaller than the file ({doc['n']} days, {len(doc['cols'])} columns) — the previous file stays")
            continue
        if dropped:
            doc["dropped"] = dropped
        checked[asset] = now.isoformat()
        changed = True
        same = bool(prev) and prev.get("n") == doc["n"] and prev.get("t0") == doc["t0"] and prev.get("cols") == json.loads(json.dumps(doc["cols"])) \
            and prev.get("dropped") == doc.get("dropped")
        if not same:                                # the big file is rewritten only when a number in it changed
            _save(path, doc)
        nowdoc[asset] = doc["summary"]
        s = doc["summary"]
        print(f"{asset}: {doc['n']} days to {s.get('date')}, columns {sorted(doc['cols'])}, price {s.get('price')}, mvrv {s.get('mvrv')}, "
              f"reserve {s.get('sex')}, {os.path.getsize(path) // 1024} kB" + (f", dropped {dropped}" if dropped else "") + ("" if not same else ", unchanged"))
    if changed:
        nowdoc["updated_at"] = now.isoformat()
        nowdoc["source"] = SOURCE
        nowdoc["checked"] = checked
        _save(os.path.join(OUT_DIR, "chain_now.json"), nowdoc)
    return 0


if __name__ == "__main__":
    sys.exit(main())
