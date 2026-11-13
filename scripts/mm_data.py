#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The market map — data for /heatmap/, /bubbles/, /money-flow/ and /liquidity/ (one snapshot, every 15 minutes).

    data/mm.json        the coin universe: price, market cap, FDV, volume, supply, ATH/ATL, sector, 7-day sparkline and the
                        change over 5m · 15m · 1h · 2h · 4h · 1d · 7d · 30d · 1y  (≈ 80 kB; the heatmap and bubbles read only this)
    data/mm_flow.json   spot money flow per coin and window (aggressive buys minus aggressive sells, USDT), order-book
                        spread and depth, stablecoin supply (mint / burn) — read by the money-flow and liquidity pages
    data/mm_cache.json  slow-changing inputs kept between runs (sector membership, stablecoin history, depth readings)
    data/logos/         every coin on the map gets its own logo (the site's rule) + one WebP atlas for the canvases

Sources, all free and keyless; nothing is estimated — a value a source did not give is null and the page says "no data":
  * CoinGecko /coins/markets (top 250 by market cap): price, market cap, FDV, 24h volume, supply, ATH/ATL, 1h/24h/7d/30d/1y
    change, 7-day sparkline, logo URL.  /coins/markets?category=…: which coins belong to each sector (a few per run, cached).
  * Binance public market data (data-api.binance.vision), for coins that trade against USDT there:
      5m × 48 klines  -> change and money flow over 5m, 15m, 1h, 2h, 4h
      1h × 168        -> 1 day and 7 days of money flow (and the 1-day change)
      1d × 30, 1w × 52 -> 30 days and ~1 year of money flow
    A kline carries the quote volume bought by takers (field 10) next to the total quote volume (field 7), so
    net flow = buys − sells = 2 × taker-buy − total. The newest kline is still open; it is included (data up to now).
    bookTicker -> spread and top-of-book size; depth (limit 1000) for a rotating slice of the top coins -> ±1 % / ±2 % depth.
  * DefiLlama stablecoins: circulating supply of every USD stablecoin now, a day, a week and a month ago + daily history.
Run: python3 scripts/mm_data.py            (self-test on fixtures in the real formats: python3 tests/test_mm_data.py)
"""
import hashlib
import io
import json
import math
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "mm.json")
OUT_FLOW = os.path.join(DATA, "mm_flow.json")
CACHE = os.path.join(DATA, "mm_cache.json")
LOGOS = os.path.join(DATA, "logos")
ART3D = os.path.join(ROOT, "assets", "coin3d")
ART_GLOSSY = os.path.join(DATA, "coinlogo")

CG = "https://api.coingecko.com/api/v3"
BN = ["https://data-api.binance.vision/api/v3", "https://api.binance.com/api/v3"]
LLAMA = "https://stablecoins.llama.fi"
UA = {"User-Agent": "entekhab.net market map (+https://entekhab.net)", "Accept": "application/json"}

TFS = ["5m", "15m", "1h", "2h", "4h", "1d", "7d", "30d", "1y"]
TOP = 250
# a coin's primary sector: the first group (in this order) whose CoinGecko categories contain it. BTC is its own block.
SECTORS = [
    ("stable", ["stablecoins"]),
    # not "bridged-tokens": CoinGecko lists native coins there too when a bridged copy exists (SPX6900 sat in it);
    # bridged copies are still caught by their names (WRAPPED_NAME)
    ("wrapped", ["wrapped-tokens", "liquid-staking-tokens", "liquid-restaking-tokens"]),
    ("meme", ["meme-token"]),
    ("ai", ["artificial-intelligence"]),
    ("rwa", ["real-world-assets-rwa"]),
    ("privacy", ["privacy-coins"]),
    ("defi", ["decentralized-finance-defi"]),
    ("l2", ["layer-2"]),
    ("l1", ["layer-1"]),
    ("game", ["gaming"]),
    ("infra", ["depin", "oracle"]),
    ("exch", ["exchange-based-tokens"]),
]
CATS = [c for _, cs in SECTORS for c in cs]
# names that make a token a claim on another coin (counted twice if shown next to it); hidden by default on the pages
WRAPPED_NAME = re.compile(r"\b(wrapped|bridged|staked|restaked|liquid staking)\b", re.I)
CAT_PER_RUN = 2              # sector lists refreshed per run once the cache is full (about every 2 hours each)
CAT_COLD = 6                 # at most this many per run while the cache is still filling (keeps a run short)
CAT_GAP = 7.0                # seconds between CoinGecko calls (keyless rate limit)
DEPTH_PER_RUN = 15           # coins whose order book is read per run (rotates through DEPTH_TOP)
DEPTH_TOP = 60
SPARK_N = 42                 # 7-day sparkline points (every 4 hours)
MIN_COINS = 20               # fewer coins than this from CoinGecko = a broken answer; the previous snapshot stays


def now_utc():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------------------------- network (injectable)
class Net:
    """HTTP with retries. Tests replace .get with a fixture lookup."""

    def __init__(self):
        import requests
        self.s = requests.Session()
        self.s.headers.update(UA)
        self.calls = 0

    def get(self, url, params=None, timeout=30):
        last = None
        for i in range(3):
            try:
                self.calls += 1
                r = self.s.get(url, params=params, timeout=timeout)
                if r.status_code == 429:
                    wait = 20 * (i + 1)
                    print(f"  429 {url} — waiting {wait}s")
                    time.sleep(wait)
                    continue
                if r.status_code in (400, 404):
                    raise RuntimeError(f"http {r.status_code}")
                r.raise_for_status()
                return r.json()
            except RuntimeError:
                raise
            except Exception as e:  # noqa: BLE001
                last = e
                time.sleep(2 * (i + 1))
        raise RuntimeError(f"{url}: {last}")

    def raw(self, url, timeout=30):
        r = self.s.get(url, timeout=timeout)
        r.raise_for_status()
        return r.content


def bn_get(net, path, params=None):
    last = None
    for base in BN:
        try:
            return net.get(base + path, params)
        except Exception as e:  # noqa: BLE001
            last = e
    raise RuntimeError(last)


# ---------------------------------------------------------------------------------------------- small helpers
def sig(x, n=6):
    """round to n significant digits (prices span 1e-8 … 1e5)"""
    if x is None or not isinstance(x, (int, float)) or not math.isfinite(x):
        return None
    if x == 0:
        return 0
    d = n - int(math.floor(math.log10(abs(x)))) - 1
    v = round(x, d)
    return int(v) if d <= 0 else v


def pct(a, b):
    """percent change from b to a, 2 decimals"""
    if not a or not b or b <= 0 or a <= 0:
        return None
    return round((a / b - 1) * 100, 2)


def num(x):
    try:
        v = float(x)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def iday(s):
    """'2025-10-06T10:57:42.000Z' -> '2025-10-06'"""
    return s[:10] if isinstance(s, str) and re.match(r"\d{4}-\d\d-\d\d", s) else None


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return default


def dump(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


# ---------------------------------------------------------------------------------------------- sectors
def refresh_categories(net, cache, gap=CAT_GAP, limit=CAT_PER_RUN, sleep=time.sleep):
    """fetch the coin lists of the stalest sector categories; returns how many were refreshed"""
    cats = cache.setdefault("cats", {})
    missing = [c for c in CATS if c not in cats]
    order = missing + sorted([c for c in CATS if c in cats], key=lambda c: cats[c].get("t", 0))
    todo = order[:max(limit, min(len(missing), CAT_COLD))]
    done = 0
    for i, c in enumerate(todo):
        if i:
            sleep(gap)
        try:
            rows = net.get(f"{CG}/coins/markets", {"vs_currency": "usd", "category": c, "order": "market_cap_desc",
                                                   "per_page": 250, "page": 1})
            if isinstance(rows, list):
                cats[c] = {"t": int(time.time()), "ids": [r["id"] for r in rows if isinstance(r, dict) and r.get("id")]}
                done += 1
        except Exception as e:  # noqa: BLE001
            print(f"  category {c}: {e}")
    return done


def sector_of(cid, sym, name, cats):
    if sym == "BTC" and cid == "bitcoin":
        return "btc"
    member = {c for c, v in cats.items() if cid in set(v.get("ids", []))}
    for key, cs in SECTORS:
        if member.intersection(cs):
            return key
    if WRAPPED_NAME.search(name or ""):
        return "wrapped"
    return "other"


# ---------------------------------------------------------------------------------------------- klines → change & flow
def kl_parse(rows):
    """Binance klines -> list of (open, close, quoteVol, takerBuyQuote)"""
    out = []
    for r in rows or []:
        try:
            out.append((float(r[1]), float(r[4]), float(r[7]), float(r[10])))
        except (IndexError, TypeError, ValueError):
            return []
    return out


def window(bars, n):
    """(change %, net flow USDT, quote volume USDT) over the last n bars; None when there are fewer than n bars"""
    if len(bars) < n or n <= 0:
        return None, None, None
    w = bars[-n:]
    qv = sum(b[2] for b in w)
    tb = sum(b[3] for b in w)
    return pct(w[-1][1], w[0][0]), round(2 * tb - qv), round(qv)


def coin_klines(net, bn):
    """the four kline requests for one Binance symbol -> {tf: (chg, flow, qv)}"""
    res = {}
    k5 = kl_parse(bn_get(net, "/klines", {"symbol": bn, "interval": "5m", "limit": 48}))
    for tf, n in (("5m", 1), ("15m", 3), ("1h", 12), ("2h", 24), ("4h", 48)):
        res[tf] = window(k5, n)
    k1h = kl_parse(bn_get(net, "/klines", {"symbol": bn, "interval": "1h", "limit": 168}))
    res["1d"] = window(k1h, 24)
    c7, f7, q7 = window(k1h, 168)
    res["7d"] = (None, f7, q7)           # the 7-day change comes from CoinGecko (rolling); 168 hourly bars give the flow
    k1d = kl_parse(bn_get(net, "/klines", {"symbol": bn, "interval": "1d", "limit": 30}))
    _, f30, q30 = window(k1d, 30)
    res["30d"] = (None, f30, q30)
    k1w = kl_parse(bn_get(net, "/klines", {"symbol": bn, "interval": "1w", "limit": 52}))
    _, f1y, q1y = window(k1w, 52)
    res["1y"] = (None, f1y, q1y)
    res["_last"] = k5[-1][1] if k5 else None
    return res


# ---------------------------------------------------------------------------------------------- order book
def depth_bands(book, mid):
    """USDT resting within ±1 % and ±2 % of mid; 'rng' = how far (%) the returned book reaches on the thinner side"""
    if not mid or mid <= 0:
        return None
    bids = [(float(p), float(q)) for p, q in book.get("bids", [])]
    asks = [(float(p), float(q)) for p, q in book.get("asks", [])]
    if not bids or not asks:
        return None
    out = {}
    for k, f in (("1", 0.01), ("2", 0.02)):
        out["b" + k] = round(sum(p * q for p, q in bids if p >= mid * (1 - f)))
        out["a" + k] = round(sum(p * q for p, q in asks if p <= mid * (1 + f)))
    reach = min((mid - bids[-1][0]) / mid, (asks[-1][0] - mid) / mid) * 100
    out["rng"] = round(reach, 2)
    return out


# ---------------------------------------------------------------------------------------------- sparkline
def spark(prices, n=SPARK_N):
    """168 hourly prices -> [min, max, [n ints 0..99]] (compact; the page only draws the shape)"""
    p = [x for x in (prices or []) if isinstance(x, (int, float)) and x > 0]
    if len(p) < 8:
        return None
    step = len(p) / n
    pts = [p[min(len(p) - 1, int(i * step))] for i in range(n - 1)] + [p[-1]]
    lo, hi = min(pts), max(pts)
    if hi <= lo:
        return [sig(lo, 5), sig(hi, 5), [50] * len(pts)]
    return [sig(lo, 5), sig(hi, 5), [int(round((x - lo) / (hi - lo) * 99)) for x in pts]]


# ---------------------------------------------------------------------------------------------- logos
# pictures that are not a coin's logo: CoinGecko's "missing image" icon (2Z) and a flat black JPEG once saved for 1INCH
KNOWN_BAD = {"62eb8420854f", "a0b96fe7a509"}


def logo_ok(path):
    """a real logo: readable, at least 16 px, not a known placeholder, not empty, not a filled square of one colour
    (one-colour glyphs on a transparent background, like Uniswap's pink unicorn, are real logos)"""
    try:
        from PIL import Image
        with open(path, "rb") as f:
            b = f.read()
        if hashlib.sha1(b).hexdigest()[:12] in KNOWN_BAD or len(b) < 200:
            return False
        im = Image.open(io.BytesIO(b))
        if min(im.size) < 16:
            return False
        raw = im.convert("RGBA").resize((24, 24)).tobytes()          # (Image.getdata is deprecated in Pillow)
        px = [tuple(raw[i:i + 4]) for i in range(0, len(raw), 4) if raw[i + 3] > 40]
        if len(px) < 40:                       # (nearly) empty
            return False
        cols = {(p[0] // 32, p[1] // 32, p[2] // 32) for p in px}
        return not (len(px) > 0.9 * 24 * 24 and len(cols) == 1)      # a filled square of one colour is not a logo
    except Exception:  # noqa: BLE001
        return False


def logo_have():
    """symbols whose data/logos/<SYM>.png is a real logo"""
    if not os.path.isdir(LOGOS):
        return set()
    return {f[:-4] for f in os.listdir(LOGOS) if f.endswith(".png") and logo_ok(os.path.join(LOGOS, f))}


def fetch_logos(net, coins, have):
    """download the CoinGecko logo (small, as scripts/logos.py does) of every universe coin that has no real one yet;
    a placeholder saved earlier is replaced, a placeholder offered now is refused"""
    got = 0
    for c in coins:
        s, url = c["s"], c.get("img") or ""
        if s in have or not url or "missing" in url:
            continue
        try:
            b = net.raw(url.replace("/large/", "/small/"), timeout=20)
            p = os.path.join(LOGOS, f"{s}.png")
            tmp = p + ".new"
            with open(tmp, "wb") as f:
                f.write(b)
            if logo_ok(tmp):
                os.replace(tmp, p)
                have.add(s)
                got += 1
            else:
                os.remove(tmp)
                print(f"  logo {s}: not a real logo, refused")
        except Exception as e:  # noqa: BLE001
            print(f"  logo {s}: {e}")
    if got:
        idx = sorted(f[:-4] for f in os.listdir(LOGOS) if f.endswith(".png"))
        json.dump(idx, open(os.path.join(LOGOS, "index.json"), "w"), separators=(",", ":"))
    return got


def logo_source(sym):
    """the best picture of a coin for the atlas: the owner's 3D artwork, then the glossy 3D coin, then the flat logo"""
    for d in (ART3D, ART_GLOSSY, LOGOS):
        p = os.path.join(d, f"{sym}.png")
        if os.path.exists(p) and (d != LOGOS or logo_ok(p)):
            return p
    return None


def build_atlas(syms, cell=48, cols=20, quality=80):
    """one WebP sheet of the logos (cell × cell, transparent) + its index; rewritten only when a picture changed.
    48 px is the largest a logo is drawn on the map; coins left out of the sheet load their own file when shown."""
    from PIL import Image
    syms = sorted(set(s for s in syms if logo_source(s)))
    h = hashlib.sha1()
    for s in syms:
        h.update(s.encode())
        with open(logo_source(s), "rb") as f:
            h.update(hashlib.sha1(f.read()).digest())
    sig_ = h.hexdigest()[:16] + f"-{cell}-{quality}"
    meta_p = os.path.join(LOGOS, "atlas.json")
    old = load_json(meta_p, {})
    if old.get("sig") == sig_ and old.get("img") and os.path.exists(os.path.join(LOGOS, old["img"])):
        return old, False
    rows = max(1, math.ceil(len(syms) / cols))
    sheet = Image.new("RGBA", (cols * cell, rows * cell), (0, 0, 0, 0))
    idx = {}
    for i, s in enumerate(syms):
        try:
            im = Image.open(logo_source(s)).convert("RGBA")
            bb = im.getbbox()
            if bb:
                im = im.crop(bb)
            pad = 1
            sc = (cell - 2 * pad) / max(im.size)
            im = im.resize((max(1, round(im.size[0] * sc)), max(1, round(im.size[1] * sc))), Image.LANCZOS)
            x, y = (i % cols) * cell, (i // cols) * cell
            sheet.alpha_composite(im, (x + (cell - im.size[0]) // 2, y + (cell - im.size[1]) // 2))
            idx[s] = i
        except Exception as e:  # noqa: BLE001
            print(f"  atlas {s}: {e}")
    buf = io.BytesIO()
    sheet.save(buf, "WEBP", quality=quality, method=6)
    # the file name carries its content hash: the site's service worker keeps pictures by path (cache-first, ignoring
    # ?v=), so a sheet under a fixed name would stay stale in returning visitors' browsers, logos in the wrong tiles
    name = "atlas-" + hashlib.sha1(buf.getvalue()).hexdigest()[:12] + ".webp"
    with open(os.path.join(LOGOS, name), "wb") as f:
        f.write(buf.getvalue())
    meta = {"sig": sig_, "img": name, "cell": cell, "cols": cols, "n": len(idx), "i": idx, "kb": len(buf.getvalue()) // 1024}
    dump(meta_p, meta)
    # keep this sheet and the one before it (a page may still hold the previous index for a moment); older ones go
    for f in os.listdir(LOGOS):
        if re.fullmatch(r"atlas-[0-9a-f]{12}\.webp", f) and f not in (name, old.get("img")):
            os.remove(os.path.join(LOGOS, f))
    return meta, True


# ---------------------------------------------------------------------------------------------- stablecoins
def stables(net, cache):
    """USD stablecoins: total and top 12 now / −1d / −7d / −30d; daily total history (refreshed every 6 h)"""
    j = net.get(f"{LLAMA}/stablecoins", {"includePrices": "false"})
    rows = []
    tot = {"c": 0.0, "d": 0.0, "w": 0.0, "m": 0.0}
    for a in j.get("peggedAssets", []):
        if a.get("pegType") != "peggedUSD":
            continue
        c = num((a.get("circulating") or {}).get("peggedUSD"))
        if not c or c <= 0:
            continue
        d = num((a.get("circulatingPrevDay") or {}).get("peggedUSD"))
        w = num((a.get("circulatingPrevWeek") or {}).get("peggedUSD"))
        m = num((a.get("circulatingPrevMonth") or {}).get("peggedUSD"))
        tot["c"] += c
        tot["d"] += d or 0
        tot["w"] += w or 0
        tot["m"] += m or 0
        rows.append({"s": str(a.get("symbol") or "")[:12], "n": str(a.get("name") or "")[:40], "c": round(c),
                     "d1": round(c - d) if d else None, "d7": round(c - w) if w else None, "d30": round(c - m) if m else None,
                     "ch": [str(x)[:20] for x in (a.get("chains") or [])[:4]]})
    rows.sort(key=lambda r: -r["c"])
    out = {"tot": round(tot["c"]), "d1": round(tot["c"] - tot["d"]), "d7": round(tot["c"] - tot["w"]),
           "d30": round(tot["c"] - tot["m"]), "top": rows[:12], "n": len(rows)}
    h = cache.get("st_hist") or {}
    if not h.get("t") or time.time() - h["t"] > 6 * 3600:
        try:
            arr = net.get(f"{LLAMA}/stablecoincharts/all", timeout=60)
            pts = []
            for r in arr[-400:]:
                v = num(((r.get("totalCirculatingUSD") or r.get("totalCirculating") or {}) or {}).get("peggedUSD"))
                d = int(r.get("date") or 0)
                if v and d:
                    pts.append([d, round(v)])
            if len(pts) > 30:
                h = {"t": int(time.time()), "pts": pts[-370:]}
                cache["st_hist"] = h
        except Exception as e:  # noqa: BLE001
            print(f"  stablecoin history: {e}")
    out["hist"] = h.get("pts") or []
    return out


# ---------------------------------------------------------------------------------------------- the run
def build(net, cache, logos_dir_ok=True, sleep=time.sleep, workers=6):
    t0 = time.time()
    errors = {}
    src = {}
    # 1. sector lists (a few per run)
    try:
        n = refresh_categories(net, cache, sleep=sleep)
        print(f"categories refreshed: {n}")
    except Exception as e:  # noqa: BLE001
        errors["categories"] = str(e)[:200]
    cats = cache.get("cats", {})
    # 2. the universe
    sleep(CAT_GAP if cats else 0)
    mk = net.get(f"{CG}/coins/markets", {"vs_currency": "usd", "order": "market_cap_desc", "per_page": TOP, "page": 1,
                                         "sparkline": "true", "price_change_percentage": "1h,24h,7d,30d,1y"})
    if not isinstance(mk, list) or len(mk) < MIN_COINS:
        raise RuntimeError("coingecko markets: empty")
    src["coingecko"] = now_utc().isoformat()
    coins, seen = [], set()
    for x in mk:
        s = str(x.get("symbol") or "").upper()
        if not re.fullmatch(r"[A-Z0-9]{1,12}", s) or s in seen or not x.get("market_cap"):
            continue
        seen.add(s)
        cid = x.get("id")
        c = {
            "s": s, "n": str(x.get("name") or s)[:48], "id": cid, "r": x.get("market_cap_rank"),
            "sec": sector_of(cid, s, x.get("name"), cats),
            "p": sig(num(x.get("current_price"))), "mc": round(num(x.get("market_cap")) or 0),
            "fd": round(num(x.get("fully_diluted_valuation")) or 0) or None, "v": round(num(x.get("total_volume")) or 0),
            "cs": sig(num(x.get("circulating_supply")), 8), "ts": sig(num(x.get("total_supply")), 8), "ms": sig(num(x.get("max_supply")), 8),
            "ath": sig(num(x.get("ath"))), "athd": iday(x.get("ath_date")), "atl": sig(num(x.get("atl"))), "atld": iday(x.get("atl_date")),
            "ch": {
                "1h": num(x.get("price_change_percentage_1h_in_currency")),
                "1d": num(x.get("price_change_percentage_24h_in_currency")),
                "7d": num(x.get("price_change_percentage_7d_in_currency")),
                "30d": num(x.get("price_change_percentage_30d_in_currency")),
                "1y": num(x.get("price_change_percentage_1y_in_currency")),
            },
            "sp": spark((x.get("sparkline_in_7d") or {}).get("price")),
            "img": x.get("image"),
        }
        for k, v in list(c["ch"].items()):
            c["ch"][k] = round(v, 2) if v is not None else None
        coins.append(c)
    # 3. Binance: which coins trade against USDT, their klines (change + money flow), book ticker
    flows = {}
    try:
        tp = bn_get(net, "/ticker/price")
        last = {r["symbol"]: num(r["price"]) for r in tp if isinstance(r, dict)}
        src["binance"] = now_utc().isoformat()
        for c in coins:
            bn = c["s"] + "USDT"
            lp = last.get(bn)
            if lp and c["p"] and 0.85 < lp / c["p"] < 1.15 and c["sec"] != "stable" and c["s"] not in ("USDT",):
                c["bn"] = bn
            elif lp and c["p"] and c["sec"] != "stable":
                print(f"  {bn}: Binance {lp} vs CoinGecko {c['p']} — not the same coin, left out")
        todo = [c for c in coins if c.get("bn") and c["sec"] != "wrapped"]

        def job(c):
            try:
                return c["s"], coin_klines(net, c["bn"])
            except Exception as e:  # noqa: BLE001
                return c["s"], {"_err": str(e)[:120]}
        with ThreadPoolExecutor(max_workers=workers) as ex:
            res = dict(ex.map(job, todo))
        bad = 0
        for c in coins:
            r = res.get(c["s"])
            if not r or r.get("_err"):
                bad += 1 if r else 0
                continue
            f = {}
            for tf in TFS:
                ch, fl, qv = r.get(tf) or (None, None, None)
                if ch is not None and tf in ("5m", "15m", "1h", "2h", "4h", "1d"):
                    c["ch"][tf] = ch          # Binance, the same market the pages update live from
                if fl is not None:
                    f[tf] = [fl, qv]
            if r.get("_last"):
                c["bp"] = sig(r["_last"])
            flows[c["s"]] = f
        if bad:
            errors["klines"] = f"{bad} coins failed"
        # spread and top-of-book
        try:
            bt = bn_get(net, "/ticker/bookTicker")
            book = {r["symbol"]: r for r in bt if isinstance(r, dict)}
            for c in coins:
                b = book.get(c.get("bn") or "")
                if not b:
                    continue
                bp, ap, bq, aq = num(b.get("bidPrice")), num(b.get("askPrice")), num(b.get("bidQty")), num(b.get("askQty"))
                if bp and ap and ap >= bp > 0:
                    mid = (bp + ap) / 2
                    flows.setdefault(c["s"], {})["bk"] = [round((ap - bp) / mid * 1e4, 2), round(bp * (bq or 0)), round(ap * (aq or 0))]
        except Exception as e:  # noqa: BLE001
            errors["bookTicker"] = str(e)[:200]
        # ±1 % / ±2 % depth for a rotating slice of the largest coins
        dc = cache.setdefault("depth", {})
        cand = [c for c in coins if c.get("bn") and c["sec"] not in ("stable", "wrapped")][:DEPTH_TOP]
        cand.sort(key=lambda c: dc.get(c["s"], {}).get("t", 0))
        for c in cand[:DEPTH_PER_RUN]:
            try:
                ob = bn_get(net, "/depth", {"symbol": c["bn"], "limit": 1000})
                bb = float(ob["bids"][0][0])
                aa = float(ob["asks"][0][0])
                d = depth_bands(ob, (bb + aa) / 2)
                if d:
                    d["t"] = int(time.time())
                    dc[c["s"]] = d
            except Exception as e:  # noqa: BLE001
                errors.setdefault("depth", str(e)[:120])
        keep = {c["s"] for c in cand}
        for s in list(dc):
            if s not in keep:
                del dc[s]
        for s, d in dc.items():
            flows.setdefault(s, {})["dp"] = d
    except Exception as e:  # noqa: BLE001
        errors["binance"] = str(e)[:200]
    # 4. logos: every coin shown must have its own; coins still without one are left off the map
    have = logo_have()
    if logos_dir_ok:
        try:
            os.makedirs(LOGOS, exist_ok=True)
            n = fetch_logos(net, coins, have)
            if n:
                print(f"new logos: {n}")
        except Exception as e:  # noqa: BLE001
            errors["logos"] = str(e)[:200]
    on_map = {c["s"] for c in coins if logo_source(c["s"])}
    try:
        atlas, changed = build_atlas([c["s"] for c in coins if c["s"] in on_map and c["sec"] != "wrapped"])
        print(f"atlas: {atlas.get('n')} logos, {atlas.get('kb')} kB{' (rebuilt)' if changed else ''}")
    except Exception as e:  # noqa: BLE001
        errors["atlas"] = str(e)[:200]
    # 5. Entekhab's own pages for a coin (the panel links to them)
    market = load_json(os.path.join(DATA, "market.json"), {})
    mk_coins = {c.get("coin") for c in market.get("coins", [])}
    dna = set((load_json(os.path.join(DATA, "dna.json"), {}).get("coins") or {}).keys())
    posts = load_json(os.path.join(DATA, "posts.json"), None) or load_json(os.path.join(DATA, "posts_lite.json"), [])
    post_coins = set()
    for p in (posts if isinstance(posts, list) else posts.get("posts", []) if isinstance(posts, dict) else []):
        for c in (p.get("coins") or []) if isinstance(p, dict) else []:
            post_coins.add(c)
    # 6. stablecoins
    st = None
    try:
        st = stables(net, cache)
        src["defillama"] = now_utc().isoformat()
    except Exception as e:  # noqa: BLE001
        errors["stablecoins"] = str(e)[:200]
    # 7. write
    out_c = []
    for c in coins:
        if c["s"] not in on_map:
            continue
        c.pop("img", None)
        if c["s"] in mk_coins:
            c["ek"] = 1
        if c["s"] in mk_coins or c["s"] in post_coins:
            c["pg"] = 1
        if c["s"] in dna:
            c["dn"] = 1
        c["ch"] = [c["ch"].get(tf) for tf in TFS]
        out_c.append(c)
    g = market.get("global") or {}
    fng = market.get("fng") or {}
    meta_cats = {c: v.get("t") for c, v in cats.items()}
    ts = now_utc().isoformat()
    mm = {"v": 1, "t": ts, "tf": TFS, "src": src, "errors": errors,
          "g": {k: g.get(k) for k in ("mcap", "vol", "btc_d", "eth_d", "stable_d", "mcap_chg24")},
          "fng": {"v": fng.get("value"), "k": fng.get("class")} if fng.get("value") is not None else None,
          "cats_t": meta_cats, "n": len(out_c), "c": out_c}
    fl = {"v": 1, "t": ts, "tf": TFS, "src": src, "f": {s: v for s, v in flows.items() if s in on_map}, "st": st}
    print(f"mm: {len(out_c)} coins on the map ({len(coins) - len(out_c)} without a logo), "
          f"{sum(1 for c in out_c if c.get('bn'))} on Binance, flows {len(fl['f'])}, {time.time() - t0:.0f}s, errors {errors}")
    return mm, fl


def main():
    cache = load_json(CACHE, {})
    net = Net()
    try:
        mm, fl = build(net, cache)
    except Exception as e:  # noqa: BLE001
        print(f"mm_data failed: {e} — the previous snapshot stays")
        dump(CACHE, cache)
        return 1
    dump(OUT, mm)
    dump(OUT_FLOW, fl)
    dump(CACHE, cache)
    print(f"wrote {OUT} ({os.path.getsize(OUT) // 1024} kB), {OUT_FLOW} ({os.path.getsize(OUT_FLOW) // 1024} kB), {net.calls} requests")
    return 0


if __name__ == "__main__":
    sys.exit(main())
