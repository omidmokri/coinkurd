"""
گزارش تصویری — the twice-daily picture report of @Coin_Kurd: ten 1080×1350 slides and one caption.

The owner's brief (12 Nov 2026): at 07:30 and 19:30 Tehran time read the site (entekhab.net — that is, the very
data/*.json files the site is built from, plus Binance, the site's own price source), check the facts, turn them
into exactly ten numbered pictures in one visual identity, write a caption that ends with exactly four hashtags,
publish one album, record its link, and say so plainly when anything fails. bot_album.py does the scheduling and
the posting; this file gathers, writes, draws and checks.

Rules kept here, slide by slide:
  • every number on a picture comes from a dataset or from Binance, and carries the time it was read (Tehran)
  • news, data, analysis and scenarios wear different labels («خبر» «داده» «تحلیل» «سناریو») so they never blur
  • support and resistance are pivots of real Binance candles, never a round number picked by eye
  • a story carried by one outlet and worded as a rumour is labelled «تأییدنشده»
  • no promise of profit; scanner findings come with the scanner's whole live record, good or bad
  • a coin is drawn with its own logo or not drawn at all (the owner's rule)
  • the evening report says what changed since the morning one, and leaves out the stories the morning one used
Preview without posting:  python scripts/album.py --render OUT_DIR [--slot m|e] [--no-ai]
"""
import hashlib
import io
import json
import logging
import math
import os
import random
import re
import sys
import time
from datetime import datetime, timedelta, timezone

import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import infocard as IC  # noqa: E402

log = logging.getLogger("album")

ROOT = IC.ROOT
W, H, M = IC.W, IC.H, IC.M
TEH = timezone(timedelta(hours=3, minutes=30))          # Iran keeps no daylight saving since 2022
FA = IC.FA_DIGITS
SITE = "https://entekhab.net/"
RAW = os.environ.get("DATA_RAW", "https://raw.githubusercontent.com/omidmokri/coinkurd/main/data/")
BINANCE = ["https://data-api.binance.vision", "https://api.binance.com", "https://api1.binance.com"]
UA = {"User-Agent": "Mozilla/5.0 (compatible; CoinKurdAlbum/1.0; +https://entekhab.net)"}
WEEKDAYS = ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه", "یکشنبه"]
EDITION = {"m": {"name": "صبحگاهی", "slot": "نوبت صبح", "other": "گزارش عصر دیروز"},
           "e": {"name": "عصرگاهی", "slot": "نوبت عصر", "other": "گزارش صبح امروز"}}
SECTIONS = ["جلد گزارش", "وضعیت کلی بازار", "اخبار مهم", "تحلیل بیت‌کوین", "آلت‌کوین‌ها",
            "جریان سرمایه و نهنگ‌ها", "اقتصاد کلان", "فرصت‌ها و ریسک‌ها", "تقویم و هشدارها", "جمع‌بندی و نقشهٔ راه"]


class AlbumError(RuntimeError):
    """the album cannot be made honestly — nothing is posted"""


# =================================================================== 1. small helpers
def teh(dt):
    return dt.astimezone(TEH)


def hm(dt):
    return teh(dt).strftime("%H:%M").translate(FA)


def jdate(dt, weekday=True):
    t = teh(dt)
    return (WEEKDAYS[t.weekday()] + " " if weekday else "") + IC.jalali(t)


def jday(dt):
    """«۲۱ آبان» — the Jalali day and month without the year"""
    return IC.jalali(teh(dt)).rsplit(" ", 1)[0]


def stamp(dt, now):
    """time of a datum: «۱۴:۲۵» today, «دیروز ۲۲:۱۰», or «۱۸ آبان» further back (Tehran)"""
    a, b = teh(dt), teh(now)
    if a.date() == b.date():
        return hm(dt)
    if (b.date() - a.date()).days == 1:
        return "دیروز " + hm(dt)
    return jday(dt)


def parse_dt(s):
    if not s:
        return None
    if isinstance(s, (int, float)):
        return datetime.fromtimestamp(s / 1000 if s > 1e11 else s, timezone.utc)
    try:
        d = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def fnum(x, dec=0):
    return IC.fa_num(x, dec)


def fprice(p):
    """price the way a trader reads it: whole dollars above 1000, cents above 1, four significant digits below"""
    if p is None:
        return "—"
    if p >= 1000:
        return fnum(p, 0)
    if p >= 100:
        return fnum(p, 1)
    if p >= 1:
        return fnum(p, 2)
    dec = min(10, max(2, 3 - int(math.floor(math.log10(p)))))
    s = f"{p:.{dec}f}".rstrip("0").rstrip(".")
    return s.replace(".", "٫").translate(FA)


def fpct(x, dec=1):
    """unsigned percentage — the sign is shown by colour, arrow or word, never by a bidi-fragile «+» or «-»"""
    return fnum(abs(x), dec) + "٪"


def fusd(x, unit=True):
    """money in Persian words: ۲٫۴۳ تریلیون دلار / ۵۸٫۶ میلیارد دلار / ۸۷۴ میلیون دلار"""
    x = abs(x)
    for lim, name in ((1e12, "تریلیون"), (1e9, "میلیارد"), (1e6, "میلیون")):
        if x >= lim:
            v = x / lim
            dec = 2 if (lim == 1e12 or v < 10) else (1 if v < 100 else 0)
            s = f"{v:.{dec}f}".rstrip("0").rstrip(".")
            return s.replace(".", "٫").translate(FA) + " " + name + (" دلار" if unit else "")
    return fnum(x, 0) + (" دلار" if unit else "")


def updown(x, up="رشد", down="افت", flat="بدون تغییر"):
    return flat if abs(x) < 0.05 else (up if x > 0 else down)


def strip_emoji(s):
    return IC.clean(s)


LATIN = re.compile(r"[A-Za-z]")
# tokenised US shares (NVDAB, MSTRB …), stablecoins, gold and wrapped coins are not part of «the crypto market»
STABLE = {"USDT", "USDC", "FDUSD", "TUSD", "USDP", "DAI", "BUSD", "USDE", "EURI", "EUR", "AEUR", "XUSD", "USD1",
          "BFUSD", "RLUSD", "RWUSD", "PYUSD", "USDS", "USDD", "U"}
NOT_CRYPTO = STABLE | {"XAUT", "PAXG", "WBTC", "WBETH", "BNSOL", "STETH", "GOLD"}
COIN_FA = {"BTC": "بیت‌کوین", "ETH": "اتریوم", "BNB": "بی‌ان‌بی", "SOL": "سولانا", "XRP": "ریپل", "DOGE": "دوج‌کوین",
           "ADA": "کاردانو", "TRX": "ترون", "LINK": "چین‌لینک", "AVAX": "آوالانچ", "TON": "تون‌کوین", "DOT": "پولکادات",
           "LTC": "لایت‌کوین", "BCH": "بیت‌کوین کش", "NEAR": "نیر", "SUI": "سویی", "APT": "اپتوس", "ARB": "آربیتروم",
           "OP": "اپتیمیزم", "PEPE": "پپه", "SHIB": "شیبا اینو", "UNI": "یونی‌سواپ", "ATOM": "کازماس", "ZEC": "زی‌کش",
           "HYPE": "هایپرلیکوئید", "ENA": "اتنا", "AAVE": "آوه", "TAO": "بیت‌تنسور", "INJ": "اینجکتیو",
           "WLD": "ورلدکوین", "XLM": "استلار", "FET": "فچ", "ONDO": "اوندو", "ICP": "اینترنت کامپیوتر",
           "HBAR": "هدرا", "FIL": "فایل‌کوین", "ETC": "اتریوم کلاسیک", "RENDER": "رندر", "SEI": "سی", "STX": "استکس",
           "LDO": "لیدو", "CRV": "کرو", "RUNE": "تورچین", "TIA": "سلستیا", "BONK": "بونک", "WIF": "داگ‌ویف‌هت",
           "POL": "پالیگان", "MATIC": "پالیگان", "DASH": "دش", "QNT": "کوانت", "TRUMP": "ترامپ", "STRK": "استارک‌نت",
           "CAKE": "پنکیک‌سواپ", "ALGO": "الگورند", "VET": "وی‌چین", "XTZ": "تزوس", "SAND": "سندباکس",
           "GALA": "گالا", "IMX": "ایمیوتبل", "JST": "جاست", "PENGU": "پاجی پنگوئنز", "FLOKI": "فلوکی",
           "PUMP": "پامپ", "WLFI": "ورلد لیبرتی", "ZRO": "لیرزیرو", "ZK": "زی‌کی‌سینک", "ORDI": "اوردی",
           "PENDLE": "پندل", "JTO": "جیتو", "PYTH": "پایت", "TWT": "تراست ولت", "GRAM": "گرام", "XMR": "مونرو"}


def is_crypto(sym):
    if sym in NOT_CRYPTO:
        return False
    return not (len(sym) >= 4 and sym.endswith("B"))       # NVDAB, MSTRB, TSLAB … (Binance-listed shares)


# =================================================================== 2. reading the site and Binance
_mem = {}


def site(name, ttl=240):
    """data/<name>.json as the site serves it: the repo's main branch first, the local checkout as fallback"""
    ent = _mem.get(name)
    if ent and time.time() - ent[0] < ttl:
        return ent[1]
    data = None
    if not os.environ.get("ALBUM_LOCAL"):
        try:
            r = requests.get(RAW + name + ".json", headers=UA, timeout=40)
            if r.ok:
                data = r.json()
        except Exception as ex:
            log.info("site %s: %s", name, ex)
    if data is None:
        try:
            with open(os.path.join(ROOT, "data", name + ".json"), encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = None
    _mem[name] = (time.time(), data)
    return data


def replay_key(path, params=None):
    q = "&".join(f"{k}={v}" for k, v in sorted((params or {}).items()))
    return hashlib.sha1(f"{path}?{q}".encode()).hexdigest()[:16] + ".json"


def binance(path, params=None):
    """Binance public data. ALBUM_REPLAY=dir answers from recorded files (a sandbox without Binance access);
    ALBUM_RECORD=dir keeps a copy of every answer (the preview workflow records one for local work)."""
    rep = os.environ.get("ALBUM_REPLAY")
    if rep:
        p = os.path.join(rep, replay_key(path, params))
        if os.path.exists(p):
            return json.load(open(p))
        raise AlbumError(f"Binance {path} {params}: not in the replay folder")
    last = None
    for base in BINANCE:
        try:
            r = requests.get(base + path, params=params, headers=UA, timeout=25)
            if r.status_code == 200:
                data = r.json()
                rec = os.environ.get("ALBUM_RECORD")
                if rec:
                    os.makedirs(rec, exist_ok=True)
                    json.dump(data, open(os.path.join(rec, replay_key(path, params)), "w"))
                return data
            last = f"HTTP {r.status_code}"
        except Exception as ex:
            last = ex
    raise AlbumError(f"Binance {path}: {last}")


def tickers():
    """{SYM: {price, chg, qv, hi, lo}} for every USDT pair — the 24-hour rolling window"""
    out = {}
    for x in binance("/api/v3/ticker/24hr", {"type": "MINI"}):
        s = x.get("symbol", "")
        if not s.endswith("USDT"):
            continue
        o, c = float(x["openPrice"]), float(x["lastPrice"])
        if c <= 0:
            continue
        out[s[:-4]] = {"price": c, "chg": (c / o - 1) * 100 if o else 0.0, "qv": float(x.get("quoteVolume") or 0),
                       "hi": float(x["highPrice"]), "lo": float(x["lowPrice"])}
    if "BTC" not in out:
        raise AlbumError("Binance returned no BTC price")
    return out


def klines(sym, tf, n):
    rows = binance("/api/v3/klines", {"symbol": sym + "USDT", "interval": tf, "limit": n})
    return [{"t": int(r[0]), "o": float(r[1]), "h": float(r[2]), "l": float(r[3]), "c": float(r[4]), "v": float(r[7])}
            for r in rows]


def ema(vals, n):
    k, e, out = 2 / (n + 1), None, []
    for v in vals:
        e = v if e is None else v * k + e * (1 - k)
        out.append(e)
    return out


def rsi(vals, n=14):
    if len(vals) <= n:
        return None
    gains = [max(0.0, vals[i] - vals[i - 1]) for i in range(1, len(vals))]
    loss = [max(0.0, vals[i - 1] - vals[i]) for i in range(1, len(vals))]
    ag, al = sum(gains[:n]) / n, sum(loss[:n]) / n
    for g, lo in zip(gains[n:], loss[n:]):
        ag, al = (ag * (n - 1) + g) / n, (al * (n - 1) + lo) / n
    return 100.0 if al == 0 else 100 - 100 / (1 + ag / al)


def trend_of(closes):
    """«up» / «down» / «range» from price against EMA20 and EMA50 of the same candles"""
    e20, e50, p = ema(closes, 20)[-1], ema(closes, 50)[-1], closes[-1]
    if p > e20 > e50:
        return "up", e20, e50
    if p < e20 < e50:
        return "down", e20, e50
    return "range", e20, e50


def pivots(rows, k):
    """swing highs and lows: a bar that is the extreme of the k bars on each side"""
    hi, lo = [], []
    for i in range(k, len(rows) - k):
        win = rows[i - k:i + k + 1]
        if rows[i]["h"] >= max(r["h"] for r in win):
            hi.append(rows[i]["h"])
        if rows[i]["l"] <= min(r["l"] for r in win):
            lo.append(rows[i]["l"])
    return hi, lo


def cluster(levels, tol):
    """merge levels closer than tol (fraction) into their mean; returns (level, touches) sorted"""
    out = []
    for v in sorted(levels):
        if out and abs(v / out[-1][0] - 1) <= tol:
            n = out[-1][1]
            out[-1] = ((out[-1][0] * n + v) / (n + 1), n + 1)
        else:
            out.append((v, 1))
    return out


def levels(price, h1, d1):
    """two supports and two resistances from real candles: the nearest 1h swing (short term) and the nearest
    daily swing beyond it (mid term). Fallbacks are the 72-hour and 90-day extremes — still real prices."""
    hi1, lo1 = pivots(h1[-96:], 4)
    hid, lod = pivots(d1[-120:], 3)
    gap = 0.006
    below1 = [v for v, _ in cluster(lo1, 0.0035) if v < price * (1 - 0.0015)]
    above1 = [v for v, _ in cluster(hi1, 0.0035) if v > price * (1 + 0.0015)]
    s1 = max(below1) if below1 else min(r["l"] for r in h1[-72:])
    r1 = min(above1) if above1 else max(r["h"] for r in h1[-72:])
    belowd = [v for v, _ in cluster(lod, 0.012) if v < s1 * (1 - gap)]
    aboved = [v for v, _ in cluster(hid, 0.012) if v > r1 * (1 + gap)]
    s2 = max(belowd) if belowd else min(r["l"] for r in d1[-90:])
    r2 = min(aboved) if aboved else max(r["h"] for r in d1[-90:])
    if not (s2 < s1 < price < r1 < r2):
        lo72, hi72 = min(r["l"] for r in h1[-72:]), max(r["h"] for r in h1[-72:])
        s1, r1 = min(s1, price * 0.997, lo72), max(r1, price * 1.003, hi72)
        s2 = min(s2, s1 * (1 - gap))
        r2 = max(r2, r1 * (1 + gap))
    return {"s1": s1, "s2": s2, "r1": r1, "r2": r2}


def coin_tech(sym, price):
    h1 = klines(sym, "1h", 168)
    d1 = klines(sym, "1d", 120)
    c1, cd = [r["c"] for r in h1], [r["c"] for r in d1]
    t1, e20, e50 = trend_of(c1)
    td, d20, d50 = trend_of(cd)
    return {"h1": h1, "d1": d1, "trend_s": t1, "trend_m": td, "ema20": e20, "ema50": e50, "ema20d": d20,
            "ema50d": d50, "rsi1": rsi(c1), "rsid": rsi(cd), "chg30": (cd[-1] / cd[-31] - 1) * 100 if len(cd) > 31 else None,
            "lv": levels(price, h1, d1)}


# --------------------------------------------------------------- news
NEWS_SRC_FA = {"CoinDesk": "کوین‌دسک", "Cointelegraph": "کوین‌تلگراف", "The Block": "د بلاک", "Decrypt": "دیکریپت",
               "Bitcoin Magazine": "بیت‌کوین مگزین", "Blockworks": "بلاک‌ورکس", "CryptoSlate": "کریپتواسلیت",
               "The Defiant": "دیفاینت", "CryptoPotato": "کریپتوپوتیتو", "BeInCrypto": "بی‌این‌کریپتو",
               "crypto.news": "کریپتونیوز", "Crypto Briefing": "کریپتو بریفینگ", "U.Today": "یوتودی",
               "AMBCrypto": "ای‌ام‌بی کریپتو", "Bitcoinist": "بیت‌کوینیست", "Bitcoin.com News": "بیت‌کوین‌دات‌کام",
               "The Daily Hodl": "دیلی هادل", "CoinGape": "کوین‌گیپ", "CoinJournal": "کوین‌ژورنال",
               "NewsBTC": "نیوز بی‌تی‌سی", "Reuters": "رویترز", "Bloomberg": "بلومبرگ", "CNBC Markets": "سی‌ان‌بی‌سی",
               "CNBC Economy": "سی‌ان‌بی‌سی", "BBC Business": "بی‌بی‌سی", "MarketWatch": "مارکت‌واچ",
               "Guardian Business": "گاردین", "Al Jazeera Economy": "الجزیره", "Financial Times": "فایننشال تایمز",
               "Watcher.Guru": "واچر گورو", "DL News": "دی‌ال نیوز", "Protos": "پروتوس", "Unchained": "آنچِیند"}
ONCHAIN_SRC = {"cryptoquant_official": "کریپتوکوانت", "cryptoquant_kr": "کریپتوکوانت", "glassnode": "گلس‌نود"}
CAT_W = {"etf_institutional": 2.4, "regulation": 2.0, "security": 2.2, "onchain": 1.4, "news": 1.0, "technical": 0.3}
CLICKBAIT = re.compile(r"price prediction|prediction|\?|\bcould\b|\bmight\b|\btop \d|\bbest\b|\bvs\.?\b|will .{0,30}(hit|reach)"
                       r"|analyst says|here'?s why|what next|\bthis week\b|sponsored|press release|giveaway", re.I)
RUMOUR = re.compile(r"\breported(ly)?\b|\brumou?r|\bsources? (say|said)|\ballegedly\b|\bconsider(s|ing)?\b|\bweighs?\b"
                    r"|\bplans? to\b|\bmay\b|\bin talks\b|\bunconfirmed\b|\bspeculat", re.I)
STOP = set("the a an of to in on for and with is are as at by from after over its it this that be will has have new "
           "says said amid into than more about up down out report crypto market price bitcoin btc".split())


def src_fa(name):
    return NEWS_SRC_FA.get(name, name)


def _words(t):
    return {w for w in re.findall(r"[a-z0-9]+", (t or "").lower()) if w not in STOP and len(w) > 2}


def news_pool(now, since, used=()):
    """this edition's candidate stories: inside the window, with a Persian title and summary, no clickbait,
    near-duplicates merged (the one with more outlets wins)"""
    nj = site("news") or {}
    tr = site("news_tr", ttl=900) or {}
    out = []
    for it in nj.get("items", []):
        d = parse_dt(it.get("date"))
        if not d or d < since or d > now + timedelta(minutes=5) or it.get("id") in used:
            continue
        title = it.get("title", "")
        if CLICKBAIT.search(title):
            continue
        t = tr.get(it.get("id")) or {}
        fa_t = IC.clean(t.get("fa_t") or it.get("tfa") or "")
        fa_s = IC.clean(t.get("fa_s") or "")
        if len(fa_t) < 12 or re.search(r"(\b\w+\b)(\s+\1){1,}", fa_t):       # «آگهی آگهی» style translator slips
            continue
        srcs = it.get("sources") or [{"source": it.get("source")}]
        n_src = len({s.get("source") for s in srcs})
        score = 1.6 * min(n_src, 4) + CAT_W.get(it.get("category"), 0.8)
        score += 0.6 * bool(set(it.get("coins") or []) & {"BTC", "ETH"})
        score += 0.8 * (1 - min(1.0, (now - d).total_seconds() / max(1.0, (now - since).total_seconds())))
        score += 0.5 * bool(fa_s)
        out.append({"id": it.get("id"), "title": title, "fa_t": fa_t, "fa_s": fa_s, "src": it.get("source", ""),
                    "n_src": n_src, "date": d, "cat": it.get("category") or "news", "coins": it.get("coins") or [],
                    "url": it.get("url", ""), "score": score, "words": _words(title),
                    "unverified": n_src == 1 and bool(RUMOUR.search(title))})
    out.sort(key=lambda x: -x["score"])
    keep = []
    for x in out:                                                      # one story once
        if any(len(x["words"] & k["words"]) / max(1, len(x["words"] | k["words"])) >= 0.42 for k in keep):
            continue
        keep.append(x)
    return keep


def pick_news(pool, n=3):
    """the strongest stories, at most two of a kind"""
    out, kinds = [], {}
    for x in pool:
        if kinds.get(x["cat"], 0) >= 2:
            continue
        out.append(x)
        kinds[x["cat"]] = kinds.get(x["cat"], 0) + 1
        if len(out) == n:
            break
    return out


def world_news(now, hours=30, n=2):
    nj = site("news") or {}
    rx = re.compile(r"\bFed\b|Federal Reserve|interest rate|rate cut|rate hike|inflation|\bCPI\b|\bPPI\b|jobs report|payroll"
                    r"|Treasur|yield|dollar|\bECB\b|Bank of England|Bank of Japan|\bBOJ\b|central bank|tariff|recession"
                    r"|\bGDP\b|Powell|oil price|\bOPEC", re.I)
    out = []
    for it in ((nj.get("world") or {}).get("items") or []):
        d = parse_dt(it.get("date"))
        if not d or (now - d) > timedelta(hours=hours) or not rx.search(it.get("title", "")):
            continue
        fa = IC.clean(it.get("tfa") or "")
        if len(fa) < 12:
            continue
        w = _words(it["title"])
        if any(len(w & o["words"]) / max(1, len(w | o["words"])) >= 0.4 for o in out):
            continue
        out.append({"fa_t": fa, "src": it.get("source", ""), "date": d, "words": w, "title": it["title"]})
        if len(out) == n:
            break
    return out


def etf_story(now, hours=40):
    nj = site("news") or {}
    tr = site("news_tr", ttl=900) or {}
    rx = re.compile(r"\bETFs?\b.*\b(inflow|outflow|flows?|bleed|withdraw|net|exit|pull)|\b(inflow|outflow)s?\b.*\bETF", re.I)
    for it in nj.get("items", []):
        d = parse_dt(it.get("date"))
        if not d or (now - d) > timedelta(hours=hours) or not rx.search(it.get("title", "")):
            continue
        if CLICKBAIT.search(it.get("title", "")):
            continue
        t = tr.get(it.get("id")) or {}
        fa = IC.clean(t.get("fa_t") or it.get("tfa") or "")
        if len(fa) >= 12:
            return {"fa_t": fa, "fa_s": IC.clean(t.get("fa_s") or ""), "src": it.get("source", ""), "date": d,
                    "id": it.get("id"), "title": it.get("title", "")}
    return None


def security_news(now, hours=48, n=2, skip=()):
    nj = site("news") or {}
    out = []
    for it in nj.get("items", []):
        d = parse_dt(it.get("date"))
        if not d or (now - d) > timedelta(hours=hours) or it.get("category") != "security" or it.get("id") in skip:
            continue
        fa = IC.clean(it.get("tfa") or "")
        if len(fa) < 12 or CLICKBAIT.search(it.get("title", "")):
            continue
        w = _words(it["title"])
        if any(len(w & o["words"]) / max(1, len(w | o["words"])) >= 0.4 for o in out):
            continue
        out.append({"fa_t": fa, "src": it.get("source", ""), "date": d, "words": w, "id": it.get("id")})
        if len(out) == n:
            break
    return out


def onchain_notes(now, hours=30, n=2):
    oj = site("onchain") or {}
    out = []
    for it in oj.get("items", []):
        d = parse_dt(it.get("at"))
        if not d or (now - d) > timedelta(hours=hours):
            continue
        head = IC.clean((it.get("fa") or "").split("\n", 1)[0])
        if len(head) < 12:
            continue
        w = set(head.split())
        if any(len(w & o["w"]) / max(1, len(w | o["w"])) >= 0.5 for o in out):
            continue
        out.append({"fa_t": head, "src": ONCHAIN_SRC.get(it.get("id", "").split("/")[0], "تحلیل آن‌چین"), "date": d, "w": w})
        if len(out) == n:
            break
    return out


# --------------------------------------------------------------- calendar
EVENT_FA = {"Unemployment Claims": "درخواست‌های بیمهٔ بیکاری آمریکا", "Unemployment Rate": "نرخ بیکاری آمریکا",
            "Non-Farm Employment Change": "اشتغال غیرکشاورزی آمریکا", "Average Hourly Earnings m/m": "دستمزد ساعتی آمریکا",
            "CPI m/m": "تورم ماهانهٔ مصرف‌کننده آمریکا", "Core CPI m/m": "تورم هستهٔ مصرف‌کننده آمریکا",
            "CPI y/y": "تورم سالانهٔ مصرف‌کننده آمریکا", "PPI m/m": "تورم ماهانهٔ تولیدکننده آمریکا",
            "Core PPI m/m": "تورم هستهٔ تولیدکننده آمریکا", "Retail Sales m/m": "خرده‌فروشی ماهانهٔ آمریکا",
            "Core Retail Sales m/m": "خرده‌فروشی هستهٔ آمریکا", "Federal Funds Rate": "تصمیم نرخ بهرهٔ فدرال رزرو",
            "FOMC Statement": "بیانیهٔ فدرال رزرو", "FOMC Press Conference": "نشست خبری فدرال رزرو",
            "FOMC Meeting Minutes": "صورت‌جلسهٔ فدرال رزرو", "Advance GDP q/q": "رشد اقتصادی آمریکا (برآورد اولیه)",
            "Prelim GDP q/q": "رشد اقتصادی آمریکا", "Final GDP q/q": "رشد اقتصادی آمریکا (نهایی)",
            "Core PCE Price Index m/m": "تورم هستهٔ هزینه‌های مصرفی (PCE)", "ISM Manufacturing PMI": "شاخص مدیران خرید تولیدی",
            "ISM Services PMI": "شاخص مدیران خرید خدمات", "JOLTS Job Openings": "فرصت‌های شغلی آمریکا",
            "Prelim UoM Consumer Sentiment": "اعتماد مصرف‌کننده آمریکا", "Prelim UoM Inflation Expectations": "انتظارات تورمی آمریکا",
            "Empire State Manufacturing Index": "شاخص تولید ایالت نیویورک", "Philly Fed Manufacturing Index": "شاخص تولید فیلادلفیا",
            "ADP Non-Farm Employment Change": "اشتغال بخش خصوصی آمریکا", "Congressional Elections": "انتخابات کنگرهٔ آمریکا"}
IMPACT_FA = {"High": "اهمیت بالا", "Medium": "اهمیت متوسط", "Low": "اهمیت کم"}


def event_name(e):
    t = e.get("title", "")
    if t in EVENT_FA:
        return EVENT_FA[t]
    if re.search(r"FOMC Member|Fed Chair|Powell|speaks", t, re.I):
        return "سخنرانی مقام فدرال رزرو"
    return IC.clean(e.get("title_fa") or "") or None


def calendar(now):
    ev = site("events") or {}
    stats = ev.get("reaction_stats") or {}
    up, past = [], []
    for e in ev.get("events", []):
        d = parse_dt(e.get("date"))
        name = event_name(e)
        if not d or not name or e.get("impact") not in ("High", "Medium"):
            continue
        row = {"name": name, "date": d, "impact": e.get("impact"), "forecast": e.get("forecast") or "",
               "previous": e.get("previous") or "", "kind": e.get("kind"), "btc_4h": e.get("btc_4h"),
               "avg_range": (stats.get(e.get("kind")) or {}).get("avg_range_4h"),
               "base_range": (stats.get(e.get("kind")) or {}).get("avg_base_4h")}
        if now <= d <= now + timedelta(hours=84):
            up.append(row)
        elif now - timedelta(hours=26) <= d < now:
            past.append(row)
    up.sort(key=lambda r: (r["date"], r["impact"] != "High"))
    seen, uniq = set(), []
    for r in up:                                       # CPI and core CPI at the same minute → one line
        k = (r["date"], r["name"].split(" ")[0])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)
    return {"up": uniq[:4], "past": past[-2:], "src": ev.get("source") or "تقویم اقتصادی", "at": parse_dt(ev.get("updated_at"))}


# --------------------------------------------------------------- the whole picture
def gather(now, edition, prev=None):
    """every fact the ten slides use, read once. Raises AlbumError when the core (prices) is missing."""
    f = {"now": now, "edition": edition, "prev": prev}
    tk = tickers()
    f["tk_at"] = datetime.now(timezone.utc)
    mk = site("market") or {}
    f["market_at"] = parse_dt(mk.get("updated_at"))
    g = mk.get("global") or {}
    if not g.get("mcap"):
        raise AlbumError("site market.json has no global market figures")
    f["global"] = g
    fng = mk.get("fng") or {}
    hist = fng.get("history") or []
    f["fng"] = {"v": fng.get("value"), "cls": fng.get("class"),
                "yday": hist[-2][1] if len(hist) >= 2 else None, "week": hist[-8][1] if len(hist) >= 8 else None}
    # majors, live
    majors = []
    for s in ("BTC", "ETH", "BNB", "SOL", "XRP", "DOGE", "ADA", "TRX"):
        x = tk.get(s)
        if x:
            majors.append(dict(x, sym=s))
    f["majors"] = majors
    btc, eth = tk["BTC"], tk.get("ETH")
    # cross-check: the site's own BTC price against Binance live
    site_btc = next((c.get("price") for c in mk.get("coins", []) if c.get("coin") == "BTC"), None)
    f["site_btc"] = site_btc
    f["btc_gap"] = abs(site_btc / btc["price"] - 1) * 100 if site_btc else None
    # technicals from real candles
    f["btc"] = dict(btc, **coin_tech("BTC", btc["price"]))
    f["eth"] = dict(eth, **coin_tech("ETH", eth["price"])) if eth else None
    # the crypto universe = the site's scanned coins that are really crypto, with live numbers
    uni = []
    for c in mk.get("coins", []):
        s = c.get("coin")
        if not s or not is_crypto(s) or s in ("BTC",) or s not in tk:
            continue
        x = tk[s]
        if x["qv"] < 3e6:
            continue
        uni.append(dict(x, sym=s))
    f["universe"] = uni
    if len(uni) < 30:
        raise AlbumError(f"only {len(uni)} coins in the crypto universe")
    br = [u["chg"] for u in uni if u["qv"] >= 5e6]
    f["breadth"] = {"n": len(br), "up": sum(1 for v in br if v > 1) * 100 / max(1, len(br)),
                    "down": sum(1 for v in br if v < -1) * 100 / max(1, len(br))}
    f["breadth"]["flat"] = 100 - f["breadth"]["up"] - f["breadth"]["down"]
    al = site("altseason") or {}
    f["altseason"] = {"v": al.get("value"), "label": al.get("label"), "date": al.get("date")}
    # derivatives, whales, flows
    dv = site("derivatives") or {}
    rr = (dv.get("regime_read") or {}).get("BTC") or {}
    f["deriv"] = {"oi": dv.get("total_oi_usd"), "funding": dv.get("avg_funding"), "btc_funding": rr.get("funding"),
                  "oi24": rr.get("oi_24h"), "ls": rr.get("ls"), "at": parse_dt(dv.get("updated_at"))}
    wh = site("whales") or {}
    f["whales"] = {"tot": wh.get("totals24") or {}, "hourly": wh.get("hourly") or [], "min": wh.get("min") or {},
                   "at": parse_dt(wh.get("updated_at"))}
    fl = site("flows") or {}
    dom = fl.get("dominance") or []
    st_now, st_then = None, None
    if dom:
        st_now = dom[-1]
        target = dom[-1]["t"] - 86400
        st_then = min(dom, key=lambda r: abs(r["t"] - target))
        if abs(st_then["t"] - target) > 4 * 3600:
            st_then = None
    f["stable"] = {"now": (st_now or {}).get("stable") or g.get("stable_d"), "then": (st_then or {}).get("stable")}
    f["sectors"] = [s for s in fl.get("sectors", []) if not s.get("suspect") and s.get("short") != "Stablecoins"
                    and (s.get("mcap") or 0) >= 1e9]
    f["etf"] = etf_story(now)
    f["onchain"] = onchain_notes(now)
    # macro
    mc = site("macro") or {}
    f["macro"] = {"last": mc.get("last") or {}, "chg": mc.get("chg_1m") or {}, "names": mc.get("names") or {},
                  "corr": (mc.get("rolling_btc_spx_30d") or [[None, None]])[-1], "src": mc.get("sources") or {}}
    f["world"] = world_news(now)
    f["cal"] = calendar(now)
    # scanner and its honest record
    opps = []
    for o in mk.get("opportunities", []):
        if not is_crypto(o.get("coin", "")) or o.get("coin") not in tk or tk[o["coin"]]["qv"] < 5e6:
            continue
        if o.get("inval") is None or o.get("price") is None:
            continue
        opps.append(o)
    rank = {"high": 0, "medium": 1, "low": 2}
    opps.sort(key=lambda o: (rank.get(o.get("confidence"), 3), -(tk[o["coin"]]["qv"])))
    f["opps"] = opps
    ss = site("scanstats") or {}
    f["scan"] = dict((ss.get("stats") or {}).get("_live") or {}, since=parse_dt(ss.get("live_since")))
    f["regime"] = (site("regime") or {}).get("now") or {}
    cj = site("council") or {}
    f["council"] = cj if cj and parse_dt(cj.get("at")) and now - parse_dt(cj["at"]) < timedelta(hours=30) else None
    # news: since the previous edition, never a story the previous edition used
    since = now - timedelta(hours=12, minutes=30)
    used = set((prev or {}).get("news_ids") or [])
    pool = news_pool(now, since, used)
    if len(pool) < 3:
        pool = news_pool(now, now - timedelta(hours=24), used)
    f["pool"] = pool
    f["news"] = pick_news(pool, 3)
    if len(f["news"]) < 2:
        raise AlbumError("fewer than two fresh, distinct stories")
    shown = {x["id"] for x in f["news"]} | ({f["etf"]["id"]} if f["etf"] else set())
    f["security"] = security_news(now, skip=shown)
    reg = [x for x in pool if x["cat"] == "regulation" and x["id"] not in shown]
    f["regulation"] = reg[0] if reg else None
    return f


# =================================================================== CLI
def record_only():
    """keep Binance's answers for every coin the album may show (used by the preview workflow)"""
    tk = tickers()
    mk = site("market") or {}
    syms = ["BTC", "ETH"] + [c["coin"] for c in mk.get("coins", []) if c.get("coin") in tk and is_crypto(c["coin"])]
    for s in ("BTC", "ETH"):
        klines(s, "1h", 168)
        klines(s, "1d", 120)
    for s in dict.fromkeys(syms):
        try:
            klines(s, "1h", 48)
        except AlbumError as ex:
            log.info("%s", ex)
    print("recorded", len(syms), "coins")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    args = sys.argv[1:]
    if "--record-only" in args:
        record_only()
        sys.exit(0)
    if "--render" in args:
        out = args[args.index("--render") + 1]
        slot = args[args.index("--slot") + 1] if "--slot" in args else "m"
        sys.exit(preview(out, slot, use_ai="--no-ai" not in args))
