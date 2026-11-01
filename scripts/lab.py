#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Entekhab Lab — همه با دادهٔ واقعی و API رایگان:
 memory   : حافظهٔ بازار — روزهای مشابه در تاریخچهٔ روزانهٔ BTC (از ۲۰۱۷) و اینکه بعدش چه شد
 futures  : آینده‌های موازی — شبیه‌سازی مونت‌کارلو (bootstrap بازده‌های واقعی ۳۶۵ روز اخیر)، مخروط احتمال ۳۰ روزه
 vol      : فشردگی نوسان (Bollinger bandwidth percentile، ATR) و هشدار تغییر رژیم
 xex      : اختلاف قیمت بین صرافی‌ها (Binance / Coinbase / Kraken / OKX)
 options  : آپشن Deribit — Put/Call، IV، DVOL، Max Pain نزدیک‌ترین سررسید
 dev      : فعالیت توسعه‌دهندگان در GitHub (کامیت ۷/۳۰ روز، آخرین ریلیز)
 macro    : همبستگی BTC با طلا (PAXG) و یورو/دلار (EURUSDT به عنوان معکوس دلار)
هر بخش مستقل است؛ شکست یکی بقیه را خراب نمی‌کند. خروجی: data/lab.json
"""
import json
import os
import random
import re
import time
from datetime import datetime, timezone, timedelta

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
BN = "https://data-api.binance.vision/api/v3"
S = requests.Session()
S.headers["User-Agent"] = "entekhab.net/1.0 (+https://entekhab.net)"
NOW = datetime.now(timezone.utc)


def get(url, **kw):
    for i in range(3):
        try:
            r = S.get(url, timeout=25, **kw)
            if r.status_code == 200:
                return r.json()
            print("  http", r.status_code, url[:90])
            if r.status_code in (403, 404, 451):
                return None
        except Exception as e:  # noqa: BLE001
            print("  err", e, url[:90])
        time.sleep(2 + i * 3)
    return None


def klines(sym, interval="1d", start=None, limit=1000):
    out, st = [], start
    while True:
        u = f"{BN}/klines?symbol={sym}&interval={interval}&limit={limit}" + (f"&startTime={st}" if st else "")
        k = get(u)
        if not k:
            break
        out += k
        if not start or len(k) < limit:
            break
        st = k[-1][0] + 1
    return [{"t": x[0], "o": float(x[1]), "h": float(x[2]), "l": float(x[3]), "c": float(x[4]), "v": float(x[5])} for x in out]


def rets(cl):
    return [cl[i] / cl[i - 1] - 1 for i in range(1, len(cl))]


def sd(x):
    if len(x) < 2:
        return 0.0
    m = sum(x) / len(x)
    return (sum((a - m) ** 2 for a in x) / (len(x) - 1)) ** 0.5


def corr(a, b):
    n = min(len(a), len(b))
    a, b = a[-n:], b[-n:]
    if n < 5:
        return None
    ma, mb = sum(a) / n, sum(b) / n
    cv = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    da, db = sum((x - ma) ** 2 for x in a) ** .5, sum((y - mb) ** 2 for y in b) ** .5
    return round(cv / (da * db), 2) if da and db else None


def day(t):
    return datetime.fromtimestamp(t / 1000, timezone.utc).strftime("%Y-%m-%d")


def pct(a, b):
    return round((b / a - 1) * 100, 2)


# ---------------------------------------------------------------- memory
def features(k, i):
    """ویژگی‌های روز i: بازده ۷ و ۳۰ روزه، نوسان ۱۴ روزه، فاصله از MA200، RSI14"""
    cl = [x["c"] for x in k[: i + 1]]
    r = rets(cl[-31:])
    up = [max(x, 0) for x in r[-14:]]
    dn = [max(-x, 0) for x in r[-14:]]
    rsi = 100 - 100 / (1 + (sum(up) / (sum(dn) or 1e-9)))
    ma200 = sum(cl[-200:]) / 200
    return [cl[-1] / cl[-8] - 1, cl[-1] / cl[-31] - 1, sd(r[-14:]), cl[-1] / ma200 - 1, rsi / 100]


def memory(btc):
    if len(btc) < 400:
        return None
    n = len(btc)
    F = {i: features(btc, i) for i in range(200, n)}
    dims = len(F[n - 1])
    mu = [sum(F[i][d] for i in F) / len(F) for d in range(dims)]
    sg = [sd([F[i][d] for i in F]) or 1 for d in range(dims)]
    z = {i: [(F[i][d] - mu[d]) / sg[d] for d in range(dims)] for i in F}
    cur = z[n - 1]
    cand = sorted((sum((a - b) ** 2 for a, b in zip(z[i], cur)) ** .5, i) for i in F if i <= n - 31)
    picked = []
    for dist, i in cand:
        if all(abs(i - j) > 20 for _, j in picked):  # روزهای مستقل (نه یک دورهٔ تکراری)
            picked.append((dist, i))
        if len(picked) == 10:
            break
    rows = []
    for dist, i in picked:
        c = btc[i]["c"]
        rows.append({"date": day(btc[i]["t"]), "price": round(c, 2), "dist": round(dist, 2),
                     "f7": pct(c, btc[i + 7]["c"]), "f30": pct(c, btc[i + 30]["c"]),
                     "dd30": pct(c, min(x["l"] for x in btc[i + 1:i + 31])),
                     "path": [round(btc[i + j]["c"] / c * 100, 2) for j in range(0, 31)]})
    f7, f30 = [r["f7"] for r in rows], [r["f30"] for r in rows]
    srt = sorted(f30)
    return {"today": {"date": day(btc[-1]["t"]), "ret7": round(F[n - 1][0] * 100, 2), "ret30": round(F[n - 1][1] * 100, 2),
                      "vol14": round(F[n - 1][2] * 100, 2), "vs_ma200": round(F[n - 1][3] * 100, 2), "rsi": round(F[n - 1][4] * 100, 1)},
            "analogs": rows, "history_days": n, "since": day(btc[0]["t"]),
            "stats": {"n": len(rows), "up7": sum(1 for x in f7 if x > 0), "up30": sum(1 for x in f30 if x > 0),
                      "avg7": round(sum(f7) / len(f7), 2), "avg30": round(sum(f30) / len(f30), 2),
                      "med30": srt[len(srt) // 2], "best30": max(f30), "worst30": min(f30)}}


# ---------------------------------------------------------------- futures (Monte Carlo)
def futures(btc, days=30, paths=3000):
    cl = [x["c"] for x in btc[-366:]]
    r = rets(cl)
    if len(r) < 200:
        return None
    rnd = random.Random(int(NOW.timestamp()) // 86400)  # در یک روز نتیجهٔ ثابت
    p0 = cl[-1]
    sims = []
    for _ in range(paths):
        p, path, i = p0, [], rnd.randrange(len(r))
        for _d in range(days):
            # block bootstrap (بلوک‌های ۵ روزه) تا خوشه‌بندی نوسان حفظ شود
            if _d % 5 == 0:
                i = rnd.randrange(len(r) - 5)
            p *= 1 + r[i + _d % 5]
            path.append(p)
        sims.append(path)
    qs = [5, 25, 50, 75, 95]
    cone = {str(q): [] for q in qs}
    for d in range(days):
        col = sorted(s[d] for s in sims)
        for q in qs:
            cone[str(q)].append(round(col[min(len(col) - 1, int(q / 100 * len(col)))], 2))
    end = sorted(s[-1] for s in sims)

    def prob(f):
        return round(sum(1 for x in end if f(x)) * 100 / len(end), 1)
    return {"price": p0, "days": days, "paths": paths, "cone": cone, "sample_days": len(r),
            "p_up": prob(lambda x: x > p0), "p_up10": prob(lambda x: x > p0 * 1.1), "p_dn10": prob(lambda x: x < p0 * .9),
            "p_up20": prob(lambda x: x > p0 * 1.2), "p_dn20": prob(lambda x: x < p0 * .8),
            "sim_vol_annual": round(sd(r) * (365 ** .5) * 100, 1)}


# ---------------------------------------------------------------- volatility
VOL_COINS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "TON"]


def vol_one(k):
    cl = [x["c"] for x in k]
    if len(cl) < 120:
        return None
    bws = []
    for i in range(20, len(cl) + 1):
        w = cl[i - 20:i]
        m = sum(w) / 20
        bws.append(4 * sd(w) / m)
    bw = bws[-1]
    rank = round(sum(1 for x in bws[-365:] if x <= bw) * 100 / len(bws[-365:]))
    tr = [max(k[i]["h"] - k[i]["l"], abs(k[i]["h"] - k[i - 1]["c"]), abs(k[i]["l"] - k[i - 1]["c"])) for i in range(1, len(k))]
    atr14, atr100 = sum(tr[-14:]) / 14, sum(tr[-100:]) / 100
    r = rets(cl)
    rv7, rv90 = sd(r[-7:]) * 365 ** .5 * 100, sd(r[-90:]) * 365 ** .5 * 100
    state = "squeeze" if rank <= 10 else "tight" if rank <= 25 else "expanded" if rank >= 85 else "normal"
    shift = None
    if rv7 > rv90 * 1.6:
        shift = "vol_spike"
    elif rv7 < rv90 * 0.5:
        shift = "vol_drought"
    return {"bw_pct": round(bw * 100, 2), "bw_rank": rank, "atr_ratio": round(atr14 / atr100, 2),
            "rv7": round(rv7, 1), "rv90": round(rv90, 1), "state": state, "shift": shift, "price": cl[-1]}


# ---------------------------------------------------------------- cross-exchange
XEX = {"BTC": ("BTC-USD", "XBTUSD", "BTC-USDT"), "ETH": ("ETH-USD", "ETHUSD", "ETH-USDT"),
       "SOL": ("SOL-USD", "SOLUSD", "SOL-USDT"), "XRP": ("XRP-USD", "XRPUSD", "XRP-USDT"), "DOGE": ("DOGE-USD", "XDGUSD", "DOGE-USDT")}


def xex():
    out = []
    for c, (cb, kr, ok) in XEX.items():
        px = {}
        j = get(f"{BN}/ticker/price?symbol={c}USDT")
        if j:
            px["Binance"] = float(j["price"])
        j = get(f"https://api.exchange.coinbase.com/products/{cb}/ticker")
        if j and j.get("price"):
            px["Coinbase"] = float(j["price"])
        j = get(f"https://api.kraken.com/0/public/Ticker?pair={kr}")
        if j and j.get("result"):
            px["Kraken"] = float(list(j["result"].values())[0]["c"][0])
        j = get(f"https://www.okx.com/api/v5/market/ticker?instId={ok}")
        if j and j.get("data"):
            px["OKX"] = float(j["data"][0]["last"])
        if len(px) >= 2:
            hi, lo = max(px, key=px.get), min(px, key=px.get)
            out.append({"coin": c, "prices": px, "spread_pct": round((px[hi] / px[lo] - 1) * 100, 3), "hi": hi, "lo": lo})
    return out


# ---------------------------------------------------------------- options (Deribit)
def options_one(cur):
    j = get(f"https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency={cur}&kind=option")
    if not j or not j.get("result"):
        return None
    res = j["result"]
    poi = coi = pv = cv = 0.0
    by_exp, ivs = {}, []
    und = None
    for x in res:
        m = re.match(r"\w+-(\d{1,2}[A-Z]{3}\d{2})-(\d+)-([CP])", x["instrument_name"])
        if not m:
            continue
        exp, k, t = m.group(1), float(m.group(2)), m.group(3)
        oi, vol = x.get("open_interest") or 0, x.get("volume") or 0
        und = und or x.get("underlying_price")
        if t == "P":
            poi += oi; pv += vol  # noqa: E702
        else:
            coi += oi; cv += vol  # noqa: E702
        by_exp.setdefault(exp, []).append((k, t, oi))
        if x.get("mark_iv") and oi:
            ivs.append((x["mark_iv"], oi))
    exps = sorted(by_exp, key=lambda e: datetime.strptime(e, "%d%b%y"))
    exps = [e for e in exps if datetime.strptime(e, "%d%b%y").replace(tzinfo=timezone.utc) + timedelta(hours=8) > NOW]
    mp = None
    if exps:
        # نزدیک‌ترین سررسیدی که OI معنادار دارد
        e = next((e for e in exps if sum(o for _, _, o in by_exp[e]) > 500 * (1 if cur == "BTC" else 10)), exps[0])
        rows = by_exp[e]
        strikes = sorted({k for k, _, _ in rows})

        def pain(s):
            return sum(oi * max(0, s - k) if t == "C" else oi * max(0, k - s) for k, t, oi in rows)
        best = min(strikes, key=pain)
        mp = {"expiry": datetime.strptime(e, "%d%b%y").strftime("%Y-%m-%d"), "max_pain": best,
              "oi": round(sum(o for _, _, o in rows)), "vs_spot_pct": pct(und, best) if und else None}
    dvol = None
    end = int(NOW.timestamp() * 1000)
    j = get(f"https://www.deribit.com/api/v2/public/get_volatility_index_data?currency={cur}&start_timestamp={end - 8 * 86400000}&end_timestamp={end}&resolution=3600")
    if j and j.get("result", {}).get("data"):
        d = j["result"]["data"]
        dvol = {"now": round(d[-1][4], 1), "d7_ago": round(d[0][4], 1), "hi7": round(max(x[2] for x in d), 1), "lo7": round(min(x[3] for x in d), 1)}
    return {"underlying": und, "pc_oi": round(poi / coi, 2) if coi else None, "pc_vol": round(pv / cv, 2) if cv else None,
            "oi_calls": round(coi), "oi_puts": round(poi), "iv_oi_weighted": round(sum(a * b for a, b in ivs) / sum(b for _, b in ivs), 1) if ivs else None,
            "max_pain": mp, "dvol": dvol}


# ---------------------------------------------------------------- dev activity (GitHub)
REPOS = [("BTC", "bitcoin/bitcoin"), ("ETH", "ethereum/go-ethereum"), ("SOL", "anza-xyz/agave"), ("ADA", "IntersectMBO/cardano-node"),
         ("DOT", "paritytech/polkadot-sdk"), ("AVAX", "ava-labs/avalanchego"), ("NEAR", "near/nearcore"), ("LINK", "smartcontractkit/chainlink"),
         ("XRP", "XRPLF/rippled"), ("TON", "ton-blockchain/ton"), ("ATOM", "cosmos/cosmos-sdk"), ("SUI", "MystenLabs/sui"),
         ("APT", "aptos-labs/aptos-core"), ("ARB", "OffchainLabs/nitro"), ("OP", "ethereum-optimism/optimism")]


def gh(path, params=None):
    h = {"Accept": "application/vnd.github+json"}
    if os.environ.get("GITHUB_TOKEN"):
        h["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
    try:
        r = S.get("https://api.github.com" + path, params=params, headers=h, timeout=25)
        return r.json() if r.status_code == 200 else None
    except Exception:  # noqa: BLE001
        return None


def count_commits(repo, since):
    n = 0
    for page in range(1, 6):
        j = gh(f"/repos/{repo}/commits", {"since": since.isoformat(), "per_page": 100, "page": page})
        if j is None:
            return None
        n += len(j)
        if len(j) < 100:
            break
    return n


def dev(prev):
    old = {x["repo"]: x for x in (prev or [])}
    out = []
    for coin, repo in REPOS:
        c7, c30 = count_commits(repo, NOW - timedelta(days=7)), count_commits(repo, NOW - timedelta(days=30))
        if c30 is None:
            if repo in old:
                out.append(old[repo])
            continue
        rel = gh(f"/repos/{repo}/releases", {"per_page": 1})
        info = gh(f"/repos/{repo}")
        out.append({"coin": coin, "repo": repo, "c7": c7, "c30": c30, "trend": round(c7 * 30 / 7 / c30, 2) if c30 else None,
                    "release": rel[0]["tag_name"] if rel else None, "release_at": rel[0]["published_at"] if rel else None,
                    "stars": (info or {}).get("stargazers_count"), "pushed_at": (info or {}).get("pushed_at")})
    return sorted(out, key=lambda x: -(x["c30"] or 0))


# ---------------------------------------------------------------- macro
def macro(btc):
    o = {}
    bc = {day(x["t"]): x["c"] for x in btc}
    for sym, name in (("PAXGUSDT", "gold"), ("EURUSDT", "eurusd")):
        k = klines(sym, limit=200)
        if not k:
            continue
        dd = [d for d in (day(x["t"]) for x in k) if d in bc]
        kc = {day(x["t"]): x["c"] for x in k}
        a, b = rets([bc[d] for d in dd]), rets([kc[d] for d in dd])
        o[name] = {"price": k[-1]["c"], "chg30": pct(k[-31]["c"], k[-1]["c"]) if len(k) > 31 else None,
                   "corr30": corr(a[-30:], b[-30:]), "corr90": corr(a[-90:], b[-90:]),
                   "roll": [corr(a[i - 30:i], b[i - 30:i]) for i in range(30, len(a) + 1, 5)]}
    if btc:
        o["btc_chg30"] = pct(btc[-31]["c"], btc[-1]["c"])
    return o


def main():
    prev = {}
    try:
        prev = json.load(open(os.path.join(D, "lab.json"), encoding="utf-8"))
    except Exception:  # noqa: BLE001
        pass
    out = dict(prev)
    out["errors"] = {}
    btc = klines("BTCUSDT", start=int(datetime(2017, 8, 17, tzinfo=timezone.utc).timestamp() * 1000))
    print("btc daily candles:", len(btc))

    def run(name, f):
        t = time.time()
        try:
            v = f()
            if v:
                out[name] = v
                out.setdefault("at", {})[name] = NOW.isoformat()
            print(f"{name}: ok ({time.time() - t:.1f}s)")
        except Exception as e:  # noqa: BLE001
            out["errors"][name] = str(e)[:200]
            print(f"{name}: FAILED {e}")

    run("memory", lambda: memory(btc))
    run("futures", lambda: futures(btc))
    run("vol", lambda: {c: v for c in VOL_COINS for v in [vol_one(btc[-400:] if c == "BTC" else klines(c + "USDT", limit=400))] if v})
    run("xex", xex)
    run("options", lambda: {c: v for c in ("BTC", "ETH") for v in [options_one(c)] if v})
    # GitHub: هر ۶ ساعت کافی است
    last = (prev.get("at") or {}).get("dev")
    if not last or NOW - datetime.fromisoformat(last) >= timedelta(hours=6) or not prev.get("dev"):
        run("dev", lambda: dev(prev.get("dev")))
    run("macro", lambda: macro(btc))
    out["updated_at"] = NOW.isoformat()
    json.dump(out, open(os.path.join(D, "lab.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    m, f = out.get("memory") or {}, out.get("futures") or {}
    print("memory stats:", m.get("stats"), "| futures p_up:", f.get("p_up"), "| xex:", [(x["coin"], x["spread_pct"]) for x in out.get("xex", [])])
    print("options:", {k: (v.get("pc_oi"), (v.get("max_pain") or {}).get("max_pain"), (v.get("dvol") or {}).get("now")) for k, v in (out.get("options") or {}).items()})
    print("vol:", {k: v["state"] for k, v in (out.get("vol") or {}).items()}, "| dev:", len(out.get("dev") or []), "| macro:", {k: (v.get("corr30") if isinstance(v, dict) else v) for k, v in (out.get("macro") or {}).items()})
    print("errors:", out["errors"])


if __name__ == "__main__":
    main()
