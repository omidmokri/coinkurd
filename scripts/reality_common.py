#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ابزارهای مشترک لایهٔ «واقعیت‌سنج» entekhab.net

  ledger.py        دفتر عملکرد سیگنال‌ها با قفل زمانی
  friction.py      شاخص اصطکاک محلی ایران
  localcorr.py     ماتریس همبستگی کریپتو با دارایی‌های ایران
  hype.py          نیمه‌عمر هیاهوی روایت‌ها
  silent_exit.py   آشکارساز خروج خاموش
  build_reality.py صفحات سایت

فقط کتابخانهٔ استاندارد + requests + beautifulsoup4 (همان requirements.txt).
"""
import hashlib
import json
import math
import os
import re
import tempfile
import time
from datetime import datetime, timedelta, timezone

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
D = os.environ.get("REALITY_DATA_DIR") or os.path.join(ROOT, "data")     # tests point this at a copy
UA = {"User-Agent": "entekhab.net reality-check (+https://entekhab.net)"}
BINANCE = ["https://data-api.binance.vision", "https://api.binance.com", "https://api1.binance.com"]
H = 3600 * 1000            # one hour in ms


# ------------------------------------------------------------------ time
def now():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat()


def parse_iso(s):
    if isinstance(s, datetime):
        dt = s
    else:
        dt = datetime.fromisoformat(str(s).strip().replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def ms(dt):
    return int(parse_iso(dt).timestamp() * 1000)


def from_ms(x):
    return datetime.fromtimestamp(x / 1000, tz=timezone.utc)


def day(dt):
    return parse_iso(dt).strftime("%Y-%m-%d")


# ------------------------------------------------------------------ files
def load(name, default):
    try:
        with open(os.path.join(D, name), encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return default


def save(name, obj, pretty=False):
    """atomic write into data/ (a crash never leaves half a file behind)"""
    path = os.path.join(D, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        if pretty:
            json.dump(obj, f, ensure_ascii=False, indent=1)
        else:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


# ------------------------------------------------------------------ http
def http_get(url, params=None, tries=3, timeout=25, headers=None):
    last = None
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=headers or UA, timeout=timeout)
            if r.status_code == 429:
                time.sleep(4 * (i + 1))
                continue
            if 400 <= r.status_code < 500:          # a client error never gets better by retrying
                raise RuntimeError(f"HTTP {r.status_code}")
            r.raise_for_status()
            return r
        except Exception as ex:  # noqa: BLE001
            last = ex
            if "HTTP 4" in str(ex):
                break
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"{url}: {last}")


def http_json(url, params=None, tries=3, timeout=25):
    return http_get(url, params, tries, timeout).json()


# ------------------------------------------------------------------ Binance (public market data, no key)
def binance(path, params):
    last = None
    for base in BINANCE:
        try:
            return http_json(base + path, params)
        except Exception as ex:  # noqa: BLE001
            last = ex
            if "HTTP 400" in str(ex):                # unknown symbol: the same on every mirror
                break
    raise RuntimeError(last)


def klines(coin, interval="1h", start=None, end=None, limit=1000):
    """[{t,o,h,l,c,v,tb}] — v = quote volume (USDT), tb = taker-buy quote volume"""
    p = {"symbol": f"{coin}USDT", "interval": interval, "limit": limit}
    if start is not None:
        p["startTime"] = int(start)
    if end is not None:
        p["endTime"] = int(end)
    rows = binance("/api/v3/klines", p)
    return [{"t": int(r[0]), "o": float(r[1]), "h": float(r[2]), "l": float(r[3]), "c": float(r[4]),
             "v": float(r[7]), "tb": float(r[10])} for r in rows]


STEP = {"1m": 60_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000, "1h": H, "2h": 2 * H, "4h": 4 * H, "6h": 6 * H,
        "8h": 8 * H, "12h": 12 * H, "1d": 24 * H}


def klines_range(coin, interval, start, end):
    """all bars whose open time is in [start, end] (paginated, ascending, de-duplicated)"""
    step, out, cur = STEP[interval], {}, int(start)
    while cur <= end:
        rows = klines(coin, interval, start=cur, end=end, limit=1000)
        if not rows:
            break
        for b in rows:
            out[b["t"]] = b
        nxt = rows[-1]["t"] + step
        if nxt <= cur or len(rows) < 1000:
            break
        cur = nxt
    return [out[k] for k in sorted(out)]


def price_at(coin, t_ms):
    """open of the 1-minute candle that contains t (Binance), or None"""
    try:
        rows = klines(coin, "1m", start=int(t_ms) // 60_000 * 60_000, limit=1)
    except Exception:  # noqa: BLE001
        return None
    return rows[0]["o"] if rows else None


# ------------------------------------------------------------------ Telegram public preview (t.me/s/<channel>)
HASHTAG = re.compile(r"#[\w‌]+")


def tg_page(channel, before=None, timeout=25):
    """one page (~20 posts) of a public channel, oldest→newest: [{"id","t","text","tags"}]"""
    from bs4 import BeautifulSoup
    url = f"https://t.me/s/{channel}"
    r = http_get(url, params={"before": before} if before else None, timeout=timeout)
    soup = BeautifulSoup(r.text, "html.parser")
    out = []
    for m in soup.select(".tgme_widget_message"):
        dp = (m.get("data-post") or "").rsplit("/", 1)[-1]
        tm = m.select_one("time")
        if not dp.isdigit() or not tm or not tm.get("datetime"):
            continue
        body = m.select_one(".tgme_widget_message_text")
        text = ""
        if body is not None:
            for br in body.find_all("br"):
                br.replace_with("\n")
            text = body.get_text()
        out.append({"id": int(dp), "t": parse_iso(tm.get("datetime")), "text": text,
                    "tags": [h[1:] for h in HASHTAG.findall(text)]})
    out.sort(key=lambda p: p["id"])
    return out


# ------------------------------------------------------------------ text
FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩٫٬", "01234567890123456789.,")


def norm_fa(t):
    """Arabic → Persian letters, ZWNJ → space, Persian digits → ASCII, lower-case Latin"""
    t = (t or "").replace("ي", "ی").replace("ك", "ک").replace("‌", " ").replace("‏", "").replace("‎", "")
    return t.translate(FA_DIGITS).lower()


def num(s):
    try:
        return float(str(s).translate(FA_DIGITS).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


# ------------------------------------------------------------------ statistics (pure python)
def mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def median(xs):
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


def pearson(xs, ys):
    pts = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    n = len(pts)
    if n < 3:
        return None
    mx = sum(p[0] for p in pts) / n
    my = sum(p[1] for p in pts) / n
    sxx = sum((p[0] - mx) ** 2 for p in pts)
    syy = sum((p[1] - my) ** 2 for p in pts)
    if sxx <= 0 or syy <= 0:
        return None
    sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
    return sxy / math.sqrt(sxx * syy)


def wilson_lb(k, n, z=1.96):
    """lower bound of the 95% Wilson interval: a fair way to rank hit-rates of different sample sizes"""
    if not n:
        return 0.0
    p = k / n
    den = 1 + z * z / n
    centre = p + z * z / (2 * n)
    adj = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return max(0.0, (centre - adj) / den)


def pct_rank(value, sample):
    """share of `sample` that is <= value, 0..1 (None if no sample)"""
    s = [x for x in sample if x is not None]
    if value is None or not s:
        return None
    return sum(1 for x in s if x <= value) / len(s)


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


# ------------------------------------------------------------------ hashing
def canon(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def sha256_hex(obj):
    data = obj if isinstance(obj, (bytes, bytearray)) else canon(obj).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def L(fa, ckb, en):
    return {"fa": fa, "ckb": ckb, "en": en}


def days_between(a, b):
    return (parse_iso(b) - parse_iso(a)).total_seconds() / 86400


def fnum(x):
    """canonical decimal string for a number (no exponent, no trailing zeros): 80510.0→'80510', 6.35e-06→'0.00000635'.
    Locked ledger fields are stored as these strings so the hash is identical in Python and in the browser."""
    from decimal import Decimal
    d = Decimal(repr(float(x)))
    s = format(d, "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s
