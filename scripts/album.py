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


STOCK_SHORT = {"MUB", "BEB"}                      # Micron, Bloom Energy: Binance shares with two-letter tickers
GECKO = "https://api.coingecko.com/api/v3"
_GECKO = {"t": 0, "map": None}


def gecko_map():
    """Binance ticker → CoinGecko coin id, from CoinGecko's own list of Binance markets (top 300 by volume).
    It tells a ticker's real coin from a namesake (Binance's ONE is Harmony, not ONEchain; GRAM is the renamed
    TON) and marks Binance's tokenised shares (ids with «bstock»)."""
    if _GECKO["map"] is not None and time.time() - _GECKO["t"] < 6 * 3600:
        return _GECKO["map"]
    cache = "/tmp/album_gecko.json"
    if os.environ.get("ALBUM_LOCAL") or os.environ.get("ALBUM_REPLAY"):
        try:
            m = json.load(open(cache))
        except Exception:
            m = {}
        _GECKO.update(t=time.time(), map=m)
        return m
    m = {}
    for page in (1, 2, 3):
        for attempt in (0, 1):
            try:
                r = requests.get(GECKO + "/exchanges/binance/tickers", headers=UA, timeout=30,
                                 params={"page": page, "depth": "false", "order": "volume_desc"})
                if r.status_code == 429 and not attempt:
                    time.sleep(25)
                    continue
                r.raise_for_status()
                for t in r.json().get("tickers", []):
                    if t.get("target") in ("USDT", "USDC", "FDUSD") and t.get("base") not in m and t.get("coin_id"):
                        m[t["base"]] = t["coin_id"]
                break
            except Exception as ex:
                log.info("coingecko binance tickers page %s: %s", page, ex)
                break
        time.sleep(2.5)
    if m:
        try:
            json.dump(m, open(cache, "w"))
        except OSError:
            pass
    _GECKO.update(t=time.time(), map=m)
    return m


def is_crypto(sym):
    if sym in NOT_CRYPTO or sym in STOCK_SHORT:
        return False
    gid = (_GECKO["map"] or {}).get(sym, "")
    if re.search(r"bstock|tokeni[sz]ed-stock|xstock", gid):
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
        raise AlbumError(f"پاسخ بایننس برای {path} در پوشهٔ بازپخش نیست")
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
    raise AlbumError(f"بایننس پاسخ نداد ({path}): {last}")


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
        raise AlbumError("بایننس قیمت بیت‌کوین را برنگرداند")
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
        fa_t = nim(IC.clean(t.get("fa_t") or it.get("tfa") or ""))
        fa_s = nim(IC.clean(t.get("fa_s") or ""))
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


KIND_FA = {"CPI": "تورم مصرف‌کنندهٔ آمریکا (کل و هسته)", "PPI": "تورم تولیدکنندهٔ آمریکا (کل و هسته)",
           "Unemployment": "نرخ بیکاری و دستمزد آمریکا", "Non-Farm": "گزارش اشتغال آمریکا", "ISM": "شاخص مدیران خرید آمریکا"}


def fa_value(v):
    """«194K» → «۱۹۴ هزار», «0.3%» → «۰٫۳٪» — calendar figures in Persian digits"""
    v = (v or "").strip()
    if not v:
        return ""
    for suf, word in (("K", " هزار"), ("M", " میلیون"), ("B", " میلیارد"), ("T", " تریلیون")):
        if v.endswith(suf):
            v = v[:-1] + word
    v = v.replace("%", "٪").replace(".", "٫")
    return v.translate(FA)


def calendar(now):
    ev = site("events") or {}
    stats = ev.get("reaction_stats") or {}
    up, past = [], []
    for e in ev.get("events", []):
        d = parse_dt(e.get("date"))
        name = event_name(e)
        if not d or not name or e.get("impact") not in ("High", "Medium"):
            continue
        st = stats.get(e.get("kind")) or {}
        row = {"name": name, "date": d, "impact": e.get("impact"), "forecast": fa_value(e.get("forecast")),
               "previous": fa_value(e.get("previous")), "kind": e.get("kind"), "btc_4h": e.get("btc_4h"),
               "core": "Core" in (e.get("title") or ""), "avg_range": st.get("avg_range_4h"),
               "base_range": st.get("avg_base_4h"), "n": st.get("n")}
        if now <= d <= now + timedelta(hours=84):
            up.append(row)
        elif now - timedelta(hours=26) <= d < now:
            past.append(row)
    up.sort(key=lambda r: (r["date"], r["impact"] != "High", r["core"]))
    merged = []
    for r in up:                                       # CPI and core CPI at the same minute → one line
        same = next((m for m in merged if m["date"] == r["date"] and m["kind"] == r["kind"] and r["kind"] != "other"), None)
        if same:
            same["name"] = KIND_FA.get(r["kind"], same["name"])
            if r["impact"] == "High":
                same["impact"] = "High"
            continue
        merged.append(dict(r))
    return {"up": merged[:4], "past": past[-2:], "src": ev.get("source") or "تقویم اقتصادی", "at": parse_dt(ev.get("updated_at"))}


# --------------------------------------------------------------- the whole picture
def gather(now, edition, prev=None):
    """every fact the ten slides use, read once. Raises AlbumError when the core (prices) is missing."""
    f = {"now": now, "edition": edition, "prev": prev}
    gecko_map()
    tk = tickers()
    f["tk_at"] = datetime.now(timezone.utc)
    mk = site("market") or {}
    f["market_at"] = parse_dt(mk.get("updated_at"))
    g = mk.get("global") or {}
    if not g.get("mcap"):
        raise AlbumError("دادهٔ کل بازار در فایل بازار سایت نیست")
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
        if x["qv"] < 1e6 or (abs(x["price"] - 1) < 0.01 and abs(x["chg"]) < 0.3):   # thin, or a dollar token
            continue
        uni.append(dict(x, sym=s))
    f["universe"] = uni
    if len(uni) < 30:
        raise AlbumError(f"فقط {len(uni)} ارز در فهرست بازار پیدا شد")
    br = [u["chg"] for u in uni]
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
        raise AlbumError("کمتر از دو خبر تازه و غیرتکراری پیدا شد")
    shown = {x["id"] for x in f["news"]} | ({f["etf"]["id"]} if f["etf"] else set())
    f["security"] = security_news(now, skip=shown)
    reg = [x for x in pool if x["cat"] == "regulation" and x["id"] not in shown]
    f["regulation"] = reg[0] if reg else None
    return f


# =================================================================== 3. words (deterministic first; the AI may only polish)
TREND_FA = {"up": "صعودی", "down": "نزولی", "range": "خنثی (رنج)"}
FNG_FA = {"Extreme Fear": "ترس شدید", "Fear": "ترس", "Neutral": "خنثی", "Greed": "طمع", "Extreme Greed": "طمع شدید"}
ALT_FA = {"alt": "فصل آلت‌کوین‌ها", "btc": "فصل بیت‌کوین", "neutral": "خنثی"}
SECTOR_FA = {"Zero Knowledge (ZK)": "دانش صفر", "Liquid Staking Tokens": "استیکینگ نقدشونده", "NFT": "ان‌اف‌تی",
             "Gaming (GameFi)": "بازی و گیم‌فای", "Layer 2 (L2)": "لایهٔ دوم", "Lending/Borrowing Protocols": "وام‌دهی",
             "DePIN": "زیرساخت فیزیکی غیرمتمرکز", "Privacy Coins": "حریم خصوصی", "Artificial Intelligence (AI)": "هوش مصنوعی",
             "Oracle": "اوراکل", "Decentralized Exchange (DEX)": "صرافی غیرمتمرکز", "Meme": "میم‌کوین",
             "Decentralized Finance (DeFi)": "دیفای", "Exchange-based Tokens": "توکن صرافی‌ها", "Layer 1 (L1)": "لایهٔ اول",
             "Real World Assets (RWA)": "دارایی‌های واقعی توکنیزه"}
PATTERN_FA = {"breakout_up": "شکست سقف", "breakdown": "شکست کف", "ema_golden_cross": "تقاطع طلایی میانگین‌ها",
              "ema_death_cross": "تقاطع مرگ میانگین‌ها", "volume_spike": "جهش حجم", "rsi_oversold": "اشباع فروش RSI",
              "rsi_overbought": "اشباع خرید RSI", "bull_divergence": "واگرایی مثبت RSI", "bear_divergence": "واگرایی منفی RSI",
              "squeeze": "فشردگی نوسان"}
TF_FA = {"1h": "ساعتی", "4h": "۴ ساعته", "1d": "روزانه"}
FA_LETTERS = "آ-یءؤئإأةۀ\u200c"


def _word(w):
    """a whole Persian word: «حتما» must not match inside «احتمال», nor «قطعا» inside «قطعات»"""
    return rf"(?<![{FA_LETTERS}]){w}(?![{FA_LETTERS}])"


BANNED = re.compile("|".join([_word("قطعا"), _word("قطعاً"), _word("حتما"), _word("حتماً"), "تضمین", "بدون ریسک",
                              r"صد ?در ?صد", "۱۰۰ ?٪", _word("بخرید"), _word("بفروشید"), "سیگنال خرید", "سیگنال فروش",
                              "فرصت طلایی", "سود قطعی", "ضرر نمی", "پولدار", "ماه می‌رود"]))
JOINED = re.compile(r"[آ-یءؤئ]{12,}")                 # «افزایشجذابیت»: two words run together by the model
NUMWORDS = re.compile("|".join(_word(w) for w in (
    "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد",
    "هفتصد", "هشتصد", "نهصد", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده",
    "صدم", "دهم", "هزارم")))                          # a number spelled out cannot be checked against the sources
COMPOUNDS = {"سرمایه گذار": "سرمایه‌گذار", "راه اندازی": "راه‌اندازی", "رأی گیری": "رأی‌گیری", "پیش بینی": "پیش‌بینی",
             "قانون گذار": "قانون‌گذار", "تصمیم گیری": "تصمیم‌گیری", "شکل گیری": "شکل‌گیری", "بهره گیری": "بهره‌گیری",
             "به روز": "به‌روز", "به طور": "به‌طور", "بین المللی": "بین‌المللی", "نقل و انتقال": "نقل‌وانتقال",
             "دست یابی": "دست‌یابی", "بازی گردان": "بازی‌گردان", "زیر ساخت": "زیرساخت", "کم رنگ": "کم‌رنگ",
             "پر رنگ": "پررنگ", "رمز ارز": "رمزارز", "ارز های": "ارزهای"}


def nim(s):
    """the half-space (نیم‌فاصله) the owner asks for: می‌/نمی‌ prefixes, ‌ها/‌های/‌تر/‌ترین suffixes, common compounds"""
    s = re.sub(rf"(?<![{FA_LETTERS}])(ن?می) (?=[آ-ی])", "\\1\u200c", s)
    s = re.sub(r"(?<=[آ-ی]) (ها|های|هایی|هایش|هایشان|تر|ترین|ای)(?![آ-ی])", "\u200c\\1", s)
    for a, b in COMPOUNDS.items():
        s = s.replace(a, b)
    return s


def fng_fa(f):
    return FNG_FA.get(f["fng"].get("cls"), f["fng"].get("cls") or "")


def mood(f):
    v = f["fng"]["v"] or 50
    return "ترس شدید" if v <= 24 else "ترس" if v <= 44 else "تردید" if v <= 55 else "طمع" if v <= 74 else "طمع شدید"


def long_share(ls):
    return 100 * ls / (1 + ls) if ls else None


def prev_label(f):
    """«گزارش ساعت ۰۷:۳۰» / «گزارش دیروز ساعت ۱۹:۳۰» — the edition the numbers are compared with"""
    pv = f.get("prev") or {}
    t = parse_dt(pv.get("pub") or pv.get("at"))
    if not t:
        return "گزارش قبلی"
    same = teh(t).date() == teh(f["now"]).date()
    return "گزارش " + ("" if same else "دیروز ") + "ساعت " + hm(t)


def headline(f):
    b = f["btc"]
    c = b["chg"]
    p = f.get("prev_delta")
    if p and abs(p["btc"]) >= 0.5 and abs(c) < 3:          # a later edition leads with what changed since the last one
        return f"از {prev_label(f)} تاکنون بیت‌کوین {fpct(p['btc'])} {updown(p['btc'])} داشته؛ بازار در فاز {mood(f)}"
    if c <= -3:
        return f"فشار فروش؛ بیت‌کوین در ۲۴ ساعت {fpct(c)} افت کرد"
    if c >= 3:
        return f"بازگشت خریداران؛ بیت‌کوین در ۲۴ ساعت {fpct(c)} رشد کرد"
    pos = {"down": "زیر میانگین‌های کوتاه‌مدت", "up": "بالای میانگین‌های کوتاه‌مدت", "range": "در محدودهٔ نوسانی"}[b["trend_s"]]
    return f"بازار در فاز {mood(f)}؛ بیت‌کوین {pos}"


def lv(f, coin="btc"):
    return {k: fprice(v) for k, v in f[coin]["lv"].items()}


def scenarios(f):
    L = lv(f)
    return {"bull": f"اگر بیت‌کوین بالای {L['r1']} دلار تثبیت شود، مقاومت بعدی {L['r2']} دلار است.",
            "bear": f"اگر حمایت {L['s1']} دلار از دست برود، حمایت بعدی {L['s2']} دلار است."}


def main_scenario(f):
    L, t = lv(f), f["btc"]["trend_s"]
    if t == "down":
        return (f"تا وقتی بیت‌کوین زیر {L['r1']} دلار است، نوسان میان {L['s1']} و {L['r1']} با تمایل نزولی سناریوی اصلی است.",
                f"پس گرفتن {L['r1']} و تثبیت بالای آن، مسیر {L['r2']} دلار را باز می‌کند.")
    if t == "up":
        return (f"تا وقتی بیت‌کوین بالای {L['s1']} دلار است، تمایل صعودی با آزمودن دوبارهٔ {L['r1']} سناریوی اصلی است.",
                f"از دست رفتن {L['s1']}، سناریوی صعودی را باطل و {L['s2']} دلار را هدف می‌کند.")
    return (f"نوسان میان {L['s1']} و {L['r1']} دلار تا شکسته شدن یکی از این دو سطح، سناریوی اصلی است.",
            f"شکست قاطع {L['r1']} مسیر {L['r2']} و از دست رفتن {L['s1']} مسیر {L['s2']} دلار را باز می‌کند.")


def funding_word(x):
    if x is None:
        return ""
    return "منفی؛ فروشندگان اهرمی غالب‌اند" if x < 0 else "داغ؛ اهرم خرید سنگین است" if x >= 0.03 else "عادی"


def stable_read(f):
    a, b = f["stable"]["now"], f["stable"]["then"]
    if a is None or b is None:
        return None, None
    d = a - b
    if d >= 0.15:
        return d, "سهم استیبل‌کوین‌ها بالا رفته؛ بخشی از سرمایه به حالت دفاعی رفته است."
    if d <= -0.15:
        return d, "سهم استیبل‌کوین‌ها کم شده؛ نقدینگی در حال بازگشت به رمزارزهاست."
    return d, "سهم استیبل‌کوین‌ها تقریباً ثابت مانده؛ جابه‌جایی بزرگی میان نقد و رمزارز دیده نمی‌شود."


def macro_read(f):
    out = []
    corr = (f["macro"]["corr"] or [None, None])[1]
    if corr is not None:
        if corr >= 0.4:
            out.append(f"همبستگی ۳۰ روزهٔ بیت‌کوین با اس‌اندپی ۵۰۰ {fnum(corr, 2)} است؛ ریسک بازار سهام هنوز به رمزارزها منتقل می‌شود.")
        elif corr <= 0.2:
            out.append(f"همبستگی ۳۰ روزهٔ بیت‌کوین با اس‌اندپی ۵۰۰ تنها {fnum(corr, 2)} است؛ رمزارزها بیشتر با عوامل خودشان حرکت می‌کنند.")
        else:
            out.append(f"همبستگی ۳۰ روزهٔ بیت‌کوین با اس‌اندپی ۵۰۰ {fnum(corr, 2)} است؛ پیوندی متوسط که در روزهای پرتنش قوی‌تر می‌شود.")
    dx = f["macro"]["chg"].get("DXY")
    if dx is not None:
        if dx >= 0.5:
            out.append("تقویت دلار در یک ماه اخیر معمولاً برای دارایی‌های پرریسک، از جمله رمزارزها، عامل فشار است.")
        elif dx <= -0.5:
            out.append("تضعیف دلار در یک ماه اخیر معمولاً به دارایی‌های پرریسک، از جمله رمزارزها، کمک می‌کند.")
    y = (f["macro"]["last"].get("US10Y") or {}).get("value")
    if y and y >= 4.5:
        out.append(f"بازده اوراق ۱۰ سالهٔ آمریکا در {fnum(y, 2)}٪ بالا مانده و هزینهٔ فرصت نگه‌داری دارایی‌های بی‌بهره را بالا نگه می‌دارد.")
    return out[:2]


def risks(f):
    out = []
    ls = f["deriv"].get("ls")
    p = long_share(ls)
    if p and p >= 65:
        out.append(f"جمعیت یک‌طرفه: {fnum(p)}٪ حساب‌های آتی بیت‌کوین در موقعیت خرید (لانگ) هستند؛ در افت ناگهانی خطر تسویهٔ زنجیره‌ای بیشتر است.")
    elif p and p <= 40:
        out.append(f"{fnum(100 - p)}٪ حساب‌های آتی بیت‌کوین در موقعیت فروش (شورت) هستند؛ جهش ناگهانی می‌تواند فروشندگان را به بستن اجباری بکشاند.")
    top = (f["regime"].get("top") or "")
    pr = (f["regime"].get("probs") or {}).get(top) if isinstance(f["regime"].get("probs"), dict) else None
    if top == "high_vol":
        out.append("مدل رژیم بازار سایت، بیت‌کوین را در رژیم «پرنوسان» می‌بیند" + (f" ({fnum(pr * 100)}٪)" if pr else "") + "؛ حرکت‌های تند در هر دو جهت محتمل‌تر است.")
    v = f["fng"]["v"]
    if v is not None and v <= 24:
        out.append(f"شاخص ترس و طمع روی {fnum(v)} (ترس شدید) است؛ تصمیم‌های هیجانی در چنین فضایی پرهزینه‌اند.")
    elif v is not None and v >= 75:
        out.append(f"شاخص ترس و طمع روی {fnum(v)} (طمع شدید) است؛ بازار به اصلاح‌های ناگهانی حساس‌تر می‌شود.")
    e = f["etf"]
    if e and re.search(r"outflow|bleed|withdraw|exit|pull", e["title"], re.I):
        out.append("خروج سرمایه از صندوق‌های قابل معاملهٔ بیت‌کوین ادامه دارد؛ تقاضای نهادی ضعیف مانده است.")
    for ev in f["cal"]["up"]:
        if ev["impact"] == "High" and ev["date"] - f["now"] <= timedelta(hours=36):
            out.append(f"انتشار «{ev['name']}» {stamp_future(ev['date'], f['now'])}؛ نوسان معمولاً پیرامون داده‌های مهم بیشتر می‌شود.")
            break
    return out[:4]


def stamp_future(dt, now):
    a, b = teh(dt), teh(now)
    if a.date() == b.date():
        return "امروز ساعت " + hm(dt)
    if (a.date() - b.date()).days == 1:
        return "فردا ساعت " + hm(dt)
    return WEEKDAYS[a.weekday()] + " " + jday(dt) + " ساعت " + hm(dt)


def watchlist(f):
    out = []
    L = lv(f)
    out.append(f"واکنش بیت‌کوین به سطوح {L['s1']} و {L['r1']} دلار")
    for ev in f["cal"]["up"][:1]:
        out.append(f"«{ev['name']}» — {stamp_future(ev['date'], f['now'])} به وقت تهران")
    if f["etf"]:
        out.append("گزارش روزانهٔ جریان ورود و خروج صندوق‌های بیت‌کوین")
    p = long_share(f["deriv"].get("ls"))
    if p:
        out.append(f"نسبت لانگ به شورت ({fnum(p)}٪ لانگ) و نرخ تأمین مالی قراردادهای آتی")
    out.append(f"شاخص ترس و طمع ({fnum(f['fng']['v'] or 0)}) و سهم استیبل‌کوین‌ها")
    return out[:4]


def conclusion(f):
    b = f["btc"]
    L = lv(f)
    trend = {"down": "زیر میانگین‌های کوتاه‌مدت معامله می‌شود", "up": "بالای میانگین‌های کوتاه‌مدت مانده",
             "range": "در یک محدودهٔ نوسانی حرکت می‌کند"}[b["trend_s"]]
    mc = f["global"].get("mcap_chg24") or 0
    s = (f"بازار در فاز {mood(f)} است و بیت‌کوین {trend}؛ ارزش کل بازار در ۲۴ ساعت {fpct(mc)} {updown(mc)} داشته است. "
         f"تا روشن شدن جهت، {L['s1']} و {L['r1']} دلار مهم‌ترین نقاط تصمیم‌اند.")
    return s


NEWS_TPL = {
    "etf_institutional": ("جریان صندوق‌ها و رفتار نهادها معیار مستقیم تقاضای سرمایهٔ بزرگ است.",
                          "ادامهٔ این روند می‌تواند بر جهت کوتاه‌مدت بیت‌کوین و اتریوم اثر بگذارد.",
                          "گزارش‌های روزانهٔ جریان صندوق‌ها و موضع نهادهای بزرگ"),
    "regulation": ("تصمیم‌های نظارتی دسترسی سرمایه‌گذاران و فعالیت صرافی‌ها را تغییر می‌دهد.",
                   "اثر قیمتی معمولاً پس از روشن شدن جزئیات اجرایی آشکار می‌شود.",
                   "جزئیات اجرایی و واکنش نهادهای ناظر و صرافی‌ها"),
    "security": ("رخنه‌های امنیتی اعتماد کاربران و نقدینگی پروژه‌ها را هدف می‌گیرد.",
                 "بر توکن پروژهٔ آسیب‌دیده و پلتفرم‌های مرتبط فشار می‌آورد.",
                 "گزارش رسمی پروژه دربارهٔ میزان خسارت و جبران آن"),
    "onchain": ("داده‌های زنجیره رفتار واقعی دارندگان و نهنگ‌ها را نشان می‌دهد.",
                "تغییر رفتار دارندگان بزرگ می‌تواند پیش‌درآمد نوسان باشد.",
                "ادامهٔ جابه‌جایی کیف‌پول‌های بزرگ و ذخایر صرافی‌ها"),
}
NEWS_TPL_DEFAULT = [("این تحول بر فضای کلی و انتظارات فعالان بازار اثر دارد.",
                     "اثر مستقیم آن بر قیمت هنوز روشن نیست و به واکنش بازار بستگی دارد.",
                     "خبرهای تکمیلی و واکنش بازار در ساعات آینده"),
                    ("نشان می‌دهد بازیگران بزرگ این صنعت در کدام جهت حرکت می‌کنند.",
                     "می‌تواند بر احساسات کوتاه‌مدت بازار و توکن‌های مرتبط اثر بگذارد.",
                     "واکنش توکن‌های مرتبط و موضع رسمی طرف‌های خبر"),
                    ("بخشی از روند بلندمدت پذیرش و توسعهٔ زیرساخت رمزارزهاست.",
                     "اثر آن معمولاً تدریجی است و کمتر به جهش فوری قیمت می‌انجامد.",
                     "اجرای عملی طرح و میزان استقبال کاربران")]


NEWS_KIND = [("security", re.compile(r"hack|exploit|phish|stolen|breach|scam|drain|attack|vulnerab", re.I)),
             ("etf_institutional", re.compile(r"\bETFs?\b|BlackRock|Fidelity|Grayscale|institutional|fund (inflow|outflow)", re.I)),
             ("regulation", re.compile(r"\bSEC\b|\bCFTC\b|regulat|\blaws?\b|\bbill\b|court|lawsuit|\bban\b|licen[cs]e|"
                                       r"senate|congress|\bMiCA\b|\btax", re.I)),
             ("onchain", re.compile(r"whale|on-?chain|wallet|addresses|exchange reserves?", re.I))]


def news_fallback(x, i=0):
    """the dataset's category label is sometimes wrong, so the template follows the headline's own words;
    «what» is a sentence of the site's own Persian summary that adds to the headline"""
    kind = next((k for k, rx in NEWS_KIND if rx.search(x["title"])), None)
    why, eff, watch = NEWS_TPL.get(kind) or NEWS_TPL_DEFAULT[i % len(NEWS_TPL_DEFAULT)]
    what = ""
    tw_ = set(x["fa_t"].split())
    for sent in re.split(r"(?<=[.!؟])\s+", x["fa_s"] or "")[:3]:
        sent = sent.strip()
        overlap = len(tw_ & set(sent.split())) / max(1, len(set(sent.split())))
        if 40 <= len(sent) <= 170 and overlap < 0.6 and not re.search(r"\.\.\.|…$", sent):
            what = sent
            break
    return {"what": what, "why": why, "effect": eff, "watch": watch}


# --------------------------------------------------------------- AI, held to the facts
def _canon(tok):
    t = tok.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")).replace("٬", "").replace(",", "")
    t = t.replace("٫", ".").strip(".")
    try:
        v = float(t)
    except ValueError:
        return None
    return f"{v:.4f}".rstrip("0").rstrip(".")


NUMTOK = re.compile(r"[0-9۰-۹٠-٩][0-9۰-۹٠-٩٬,٫.]*")


def numbers_in(s):
    return {c for c in (_canon(m) for m in NUMTOK.findall(s or "")) if c is not None}


def allowed_numbers(*texts):
    ok = set()
    for t in texts:
        for c in numbers_in(t):
            ok.add(c)
            v = float(c)
            if v >= 1000:                                   # «۷۳ هزار دلار» for 73,364
                for k in (math.floor(v / 1000), round(v / 1000), round(v / 1000, 1)):
                    ok.add(f"{k:.4f}".rstrip("0").rstrip("."))
            for k in (round(v), round(v, 1)):
                ok.add(f"{k:.4f}".rstrip("0").rstrip("."))
    return ok | {"24", "48", "10", "30", "12", "1", "2", "3", "4", "5", "7"}


def check_text(s, allowed, max_len, min_len=8):
    """problems that keep an AI sentence off a picture ([] = fine)"""
    p = []
    s = s or ""
    if not (min_len <= len(s) <= max_len):
        p.append(f"length {len(s)}")
    if LATIN.search(s):
        p.append("latin letters")
    if BANNED.search(s):
        p.append("promise/advice words")
    if JOINED.search(s):
        p.append("words run together: " + JOINED.search(s).group(0))
    if NUMWORDS.search(s):
        p.append("a number spelled out in words: " + NUMWORDS.search(s).group(0))
    extra = numbers_in(s) - allowed
    if extra:
        p.append("numbers not in the sources: " + ", ".join(sorted(extra)))
    try:
        IC.safe(s)
    except IC.TextError as ex:
        p.append(str(ex))
    return p


def ai_ok():
    try:
        import ai
        return ai.available()
    except Exception:
        return False


def ai_json(prompt, tokens=1600):
    import ai
    raw = ai.generate(prompt, as_json=True, temperature=0.35, max_tokens=tokens)
    if isinstance(raw, (dict, list)):                    # ai.generate already parses a JSON answer
        return raw
    raw = re.sub(r"^```\w*|```$", "", (raw or "").strip()).strip()
    return json.loads(raw)


NEWS_PROMPT = """تو دبیر خبر کانال تلگرامی «کوین کورد» هستی. برای هر خبرِ زیر، چهار جملهٔ کوتاه و دقیق به فارسی روان بنویس:
what: چه اتفاقی افتاده است (یک جمله، فقط بر پایهٔ متن خبر، حداکثر ۱۱۰ نویسه)
why: چرا برای بازار رمزارز مهم است (حداکثر ۹۰ نویسه)
effect: اثر احتمالی بر بازار، با زبان احتمال مثل «ممکن است» یا «می‌تواند» (حداکثر ۹۰ نویسه)
watch: چه چیزی را باید دنبال کرد (حداکثر ۷۰ نویسه)
قواعد سخت: هیچ حرف لاتین ننویس (نام‌ها را فارسی بنویس، مثلاً «صندوق‌های قابل معامله» به جای ETF)؛ هیچ عددی ننویس که در متن خبر نیامده؛
هیچ پیش‌بینی قطعی، تضمین یا توصیهٔ خرید و فروش ننویس؛ اعداد را فقط با رقم فارسی بنویس، هرگز با حروف؛ نیم‌فاصله‌ها را درست بگذار (می‌تواند، سرمایه‌گذاری، صندوق‌ها).
خروجی فقط JSON به این شکل: {"items":[{"id":"...","what":"...","why":"...","effect":"...","watch":"..."}]}

خبرها:
"""


def ai_news(items):
    out = {}
    if not items or not ai_ok():
        return out
    blocks = []
    for x in items:
        blocks.append(json.dumps({"id": x["id"], "title_fa": x["fa_t"], "summary_fa": x["fa_s"][:900],
                                  "title_en": x["title"], "source": src_fa(x["src"])}, ensure_ascii=False))
    try:
        data = ai_json(NEWS_PROMPT + "\n".join(blocks))
    except Exception as ex:
        log.info("AI news texts unavailable: %s", ex)
        return out
    for it in (data.get("items") or []):
        x = next((n for n in items if n["id"] == it.get("id")), None)
        if not x:
            continue
        allowed = allowed_numbers(x["fa_t"], x["fa_s"], x["title"])
        parts, bad = {}, []
        for k, lim in (("what", 125), ("why", 100), ("effect", 100), ("watch", 80)):
            s = nim(IC.clean(it.get(k) or ""))
            pr = check_text(s, allowed, lim, 12)
            if pr:
                bad.append(f"{k}: {pr[0]}")
            parts[k] = s
        if bad:
            log.info("AI news %s rejected: %s", x["id"], "; ".join(bad))
            continue
        out[x["id"]] = parts
    return out


EDITION_PROMPT = """تو سردبیر گزارش تصویری «کوین کورد» هستی. از داده‌های زیر (و فقط همین داده‌ها) سه متن کوتاه فارسی بنویس:
headline: پیام اصلی بازار برای جلد گزارش؛ یک ادعای مشخص دربارهٔ جهت بازار و مهم‌ترین عامل آن، حداکثر ۷۰ نویسه.
  نمونهٔ خوب: «فشار فروش ادامه دارد؛ بیت‌کوین زیر میانگین‌ها و ترس در بازار». نمونهٔ بد: «وضعیت بازار در نوبت عصر».
  تاریخ، روز هفته و واژهٔ «نوبت» را در تیتر نیاور.
summary: جمع‌بندی دو جمله‌ای برای اسلاید آخر: وضعیت فعلی و آنچه جهت بعدی را روشن می‌کند، با زبان احتمال، حداکثر ۲۴۰ نویسه
lead: یک جمله برای متن همراه آلبوم تلگرام که مهم‌ترین تحول این نوبت را بگوید (نه «نگاهی به …»)، حداکثر ۱۷۰ نویسه
قواعد سخت: هیچ حرف لاتین ننویس؛ فقط عددهایی را بنویس که در داده‌ها آمده؛ تحلیل را واقعیت قطعی جلوه نده؛
هیچ سودی را تضمین نکن و توصیهٔ خرید یا فروش نکن؛ اعداد را فقط با رقم فارسی بنویس، هرگز با حروف؛ میان واژه‌ها فاصله یا نیم‌فاصلهٔ درست بگذار.
خروجی فقط JSON: {"headline":"...","summary":"...","lead":"..."}

داده‌ها:
"""


def facts_text(f):
    b, g = f["btc"], f["global"]
    L = lv(f)
    lines = [f"زمان داده‌ها: {hm(f['now'])} به وقت تهران ({'صبح' if f['edition'] == 'm' else 'عصر'})",
             f"بیت‌کوین: {fprice(b['price'])} دلار، {fpct(b['chg'])} {updown(b['chg'])} در ۲۴ ساعت؛ روند کوتاه‌مدت {TREND_FA[b['trend_s']]}، "
             f"میان‌مدت {TREND_FA[b['trend_m']]}" + (f"؛ ۳۰ روز اخیر {fpct(b['chg30'])} {updown(b['chg30'])}" if b.get("chg30") is not None else ""),
             f"حمایت‌های بیت‌کوین: {L['s1']} و {L['s2']} دلار؛ مقاومت‌ها: {L['r1']} و {L['r2']} دلار"]
    if f["eth"]:
        lines.append(f"اتریوم: {fprice(f['eth']['price'])} دلار، {fpct(f['eth']['chg'])} {updown(f['eth']['chg'])} در ۲۴ ساعت")
    lines.append(f"ارزش کل بازار: {fusd(g['mcap'])}، {fpct(g.get('mcap_chg24') or 0)} {updown(g.get('mcap_chg24') or 0)} در ۲۴ ساعت")
    lines.append(f"شاخص ترس و طمع: {fnum(f['fng']['v'] or 0)} ({fng_fa(f)})")
    br = f["breadth"]
    lines.append(f"پهنای بازار: {fnum(br['up'])}٪ ارزها صعودی و {fnum(br['down'])}٪ نزولی")
    for x in f["news"]:
        lines.append("خبر: " + x["fa_t"])
    if f["etf"]:
        lines.append("صندوق‌ها: " + f["etf"]["fa_t"])
    for ev in f["cal"]["up"][:1]:
        lines.append(f"رویداد پیش رو: {ev['name']} ({stamp_future(ev['date'], f['now'])})")
    p = f.get("prev_delta")
    if p:
        lines.append(f"از {prev_label(f)} تاکنون: بیت‌کوین {fpct(p['btc'])} {updown(p['btc'])}")
    return "\n".join(lines)


def ai_edition(f):
    if not ai_ok():
        return {}
    ft = facts_text(f)
    try:
        data = ai_json(EDITION_PROMPT + ft, 900)
    except Exception as ex:
        log.info("AI edition texts unavailable: %s", ex)
        return {}
    allowed = allowed_numbers(ft)
    out = {}
    day = IC.jalali(teh(f["now"])).split(" ")
    for k, lim, lo in (("headline", 74, 16), ("summary", 250, 60), ("lead", 180, 30)):
        s = nim(IC.clean(data.get(k) or ""))
        pr = check_text(s, allowed, lim, lo)
        if re.search(r"نوبت|نگاهی به|وضعیت بازار در|" + "|".join(WEEKDAYS), s) or (len(day) == 3 and day[1] in s):
            pr.append("a title about the report instead of the market")
        if pr:
            log.info("AI %s rejected: %s (%s)", k, pr[0], s[:80])
            continue
        out[k] = s
    return out


def write(f, use_ai=True):
    """all words of the album: deterministic texts, with AI wording where it passed every check"""
    tx = {"headline": headline(f), "summary": conclusion(f), "lead": None, "news": {}, "ai": []}
    if use_ai:
        got = ai_news(f["news"])
        tx["news"].update(got)
        if got:
            tx["ai"].append(f"news×{len(got)}")
        ed = ai_edition(f)
        for k in ("headline", "summary", "lead"):
            if ed.get(k):
                tx[k] = ed[k]
                tx["ai"].append(k)
    for i, x in enumerate(f["news"]):
        if x["id"] not in tx["news"]:
            tx["news"][x["id"]] = news_fallback(x, i)
    return tx


# =================================================================== 4. drawing — one identity for all ten pictures
FONT_FILES = {"r": "Vazirmatn-Regular.ttf", "m": "Vazirmatn-Medium.ttf", "b": "Vazirmatn-Bold.ttf", "k": "Vazirmatn-Black.ttf"}
_F = {}
INK = (242, 245, 250)
MUTED = (156, 168, 188)
DIM = (110, 122, 144)
UP = (46, 214, 140)
DOWN = (255, 94, 114)
FLAT = (178, 188, 204)
TAGC = {"داده": (45, 212, 191), "خبر": (96, 165, 250), "تحلیل": (167, 139, 250), "سناریو": (251, 191, 36),
        "هشدار": (251, 113, 133), "تأییدنشده": (251, 146, 60), "آن‌چین": (52, 211, 153)}
ED = {"m": {"prim": (245, 184, 61), "sec": (255, 122, 69), "top": (7, 9, 18), "bot": (17, 14, 28), "pal": "D"},
      "e": {"prim": (88, 170, 255), "sec": (152, 112, 255), "top": (4, 7, 19), "bot": (10, 12, 34), "pal": "F"}}
CT, CB = 318, H - 124                      # content top / bottom of every slide but the cover


def F(size, w="b"):
    key = (size, w, IC.mode())
    if key not in _F:
        p = os.path.join(ROOT, "assets", "fonts", FONT_FILES[w])
        eng = ImageFont.Layout.RAQM if IC.mode() == "raqm" else ImageFont.Layout.BASIC
        _F[key] = ImageFont.truetype(p if os.path.exists(p) else IC.FONT, size, layout_engine=eng)
    return _F[key]


class Pen:
    """ImageDraw that blends: on an RGBA canvas Pillow writes a translucent colour straight into the pixels
    (a faint grid line would come out solid white), so translucent strokes go through a layer"""

    def __init__(self, im):
        self.im = im
        self.d = ImageDraw.Draw(im)

    def __getattr__(self, name):
        fn = getattr(self.d, name)

        def call(*a, **kw):
            col = kw.get("fill") if kw.get("fill") is not None else kw.get("outline")
            if isinstance(col, tuple) and len(col) == 4 and col[3] < 255:
                lay = Image.new("RGBA", self.im.size, (0, 0, 0, 0))
                getattr(ImageDraw.Draw(lay), name)(*a, **kw)
                self.im.alpha_composite(lay)
            else:
                fn(*a, **kw)
        return call


def DR(im):
    return Pen(im)


_INK = {"max": 0, "content": 0}


def ink(y):
    """lowest point drawn so far on the current slide — checked against the footer line"""
    _INK["max"] = max(_INK["max"], y)


def T(s):
    """every word drawn passes the Persian check; a broken glyph stops the album instead of reaching the channel"""
    return IC.safe(s)


def rgba(c, a=255):
    return tuple(c[:3]) + (int(a),)


def rt(d, xr, y, s, size, w="r", fill=INK):
    s = T(s)
    IC.rtext(d, xr, y, s, F(size, w), rgba(fill))
    ink(y + size * 1.3)
    return IC.textw(F(size, w), s)


def ct(d, cx, y, s, size, w="r", fill=INK):
    IC.ctext(d, cx, y, T(s), F(size, w), rgba(fill))
    ink(y + size * 1.3)


def lt(d, xl, y, s, size, w="r", fill=INK):
    IC.ltext(d, xl, y, T(s), F(size, w), rgba(fill))
    ink(y + size * 1.3)


def tw(s, size, w="r"):
    return IC.textw(F(size, w), T(s))


def num(d, x, y, s, size, w="b", fill=INK, anchor="r"):
    """a number drawn left-to-right as written: digits, ٫ ٬ ٪ $ — no bidi reordering can move its parts"""
    f = F(size, w)
    kw = {"direction": "ltr"} if IC.mode() == "raqm" else {}
    width = f.getlength(s, **kw)
    x0 = x - width if anchor == "r" else (x - width / 2 if anchor == "c" else x)
    d.text((x0, y), s, font=f, fill=rgba(fill), **kw)
    ink(y + size * 1.3)
    return width


def numw(s, size, w="b"):
    f = F(size, w)
    return f.getlength(s, **({"direction": "ltr"} if IC.mode() == "raqm" else {}))


def para(d, xr, y, s, size, width, w="r", fill=INK, lead=1.55, max_lines=9):
    """wrapped right-aligned paragraph; returns the y below it"""
    s = T(s)
    f = F(size, w)
    lines = IC.wrap(s, f, width)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1] + " …"
    for ln in lines:
        IC.rtext(d, xr, y, ln, f, rgba(fill))
        ink(y + size * 1.3)
        y += int(size * lead)
    return y


def lines_of(s, size, width, w="r"):
    return len(IC.wrap(T(s), F(size, w), width))


def colour(v):
    return UP if v > 0.05 else DOWN if v < -0.05 else FLAT


def tri(d, cx, cy, up, s, col):
    if up:
        d.polygon([(cx - s, cy + s * 0.75), (cx + s, cy + s * 0.75), (cx, cy - s * 0.85)], fill=rgba(col))
    else:
        d.polygon([(cx - s, cy - s * 0.75), (cx + s, cy - s * 0.75), (cx, cy + s * 0.85)], fill=rgba(col))


def change(d, xr, y, v, size, w="b"):
    """▲ ۲٫۳٪ in green / ▼ ۱٫۸٪ in red, right-aligned at xr; returns the width used"""
    col = colour(v)
    width = num(d, xr, y, fpct(v), size, w, col)
    if abs(v) >= 0.05:
        tri(d, xr - width - size * 0.42, y + size * 0.66, v > 0, size * 0.27, col)
        width += size * 0.8
    return width


def dot(d, cx, cy, r, col):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgba(col))


def backdrop(ed):
    """calm financial-media ground: deep gradient, the edition's light, a faint grid — no scenery"""
    c = ED[ed]
    im = Image.new("RGBA", (W, H), rgba(c["top"]))
    d = DR(im)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=rgba(IC._mix(c["top"], c["bot"], (y / H) ** 1.2)))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse([W - 560, -420, W + 380, 430], fill=rgba(c["prim"], 64))
    g.ellipse([-460, H - 560, 420, H + 300], fill=rgba(c["sec"], 40))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(180)))
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, W + 1, 54):
        gd.line([(x, 0), (x, H)], fill=(255, 255, 255, 6))
    for y in range(0, H + 1, 54):
        gd.line([(0, y), (W, y)], fill=(255, 255, 255, 6))
    im.alpha_composite(grid)
    return im


def pill(im, box, col, alpha=235, radius=None, outline=None):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(lay).rounded_rectangle(box, radius or (box[3] - box[1]) // 2, fill=rgba(col, alpha),
                                          outline=rgba(outline, 220) if outline else None, width=2 if outline else 0)
    im.alpha_composite(lay)


def tag(im, xr, y, label, col=None):
    """small label pill («خبر» «داده» …); returns the x left of it"""
    col = col or TAGC.get(label, MUTED)
    w = tw(label, 21, "b") + 26
    pill(im, (int(xr - w), y, int(xr), y + 34), col, 46, outline=col)
    rt(DR(im), xr - 13, y + 1, label, 21, "b", col)
    return xr - w - 10


def panel(im, box, ed, accent=False):
    c = ED[ed]
    IC._glass(im, box, radius=24, tint=(255, 255, 255), alpha=16, border=c["prim"] if accent else (255, 255, 255))
    ink(box[3])


def header(im, ed, idx, title, sub, f):
    c = ED[ed]
    d = DR(im)
    IC._logo(im, M - 8, 24, 108)
    lab = f"{fnum(idx)} از {fnum(10)}"
    bw = tw(lab, 28, "b") + 46
    pill(im, (W - M - int(bw), 36, W - M, 86), c["prim"], 240)
    rt(d, W - M - 23, 39, lab, 28, "b", (12, 12, 20))
    rt(d, W - M, 100, f"گزارش تصویری {EDITION[ed]['name']} · {jdate(f['now'], False)}", 23, "m", MUTED)
    rt(d, W - M, 146, title, 54, "k", INK)
    rt(d, W - M, 226, sub, 25, "r", MUTED)
    seg = (W - 2 * M - 9 * 8) / 10
    for i in range(10):
        x1 = W - M - i * (seg + 8)
        d.rounded_rectangle([x1 - seg, 284, x1, 290], 3, fill=rgba(c["prim"]) if i < idx else (255, 255, 255, 34))
    return CT


def footer(im, ed):
    _INK["content"] = _INK["max"]
    IC._footer({"pal": ED[ed]["pal"]}, im)
    d = DR(im)
    num(d, W / 2, H - 70, "entekhab.net", 22, "m", DIM, anchor="c")


# --------------------------------------------------------------- logos
_LOGO = {}


_URLS = {}                                     # CoinGecko id → official image URL


def prefetch_logos(syms):
    """one /coins/markets call for every coin that may be drawn — the free API allows only a few calls a minute"""
    if os.environ.get("ALBUM_LOCAL") or os.environ.get("ALBUM_REPLAY"):
        return
    m = gecko_map()
    need = []
    for s_ in dict.fromkeys(syms):
        gid = m.get(s_)
        if (gid and gid not in _URLS and not os.path.exists(os.path.join(ROOT, "assets", "coin3d", s_ + ".png"))
                and not os.path.exists(os.path.join("/tmp", "album_logos", s_ + ".png"))):
            need.append(gid)
    for i in range(0, len(need), 100):
        ids = ",".join(need[i:i + 100])
        for attempt in (0, 1):
            try:
                r = requests.get(GECKO + "/coins/markets", headers=UA, timeout=30,
                                 params={"vs_currency": "usd", "ids": ids, "per_page": 250})
                if r.status_code == 429 and not attempt:
                    time.sleep(25)
                    continue
                if r.ok:
                    for c in r.json():
                        if c.get("id") and c.get("image"):
                            _URLS[c["id"]] = c["image"]
                break
            except Exception as ex:
                log.info("logo prefetch: %s", ex)
                break


def _verified_logo(sym):
    """the coin's official image, found through CoinGecko's mapping of Binance's own ticker"""
    gid = gecko_map().get(sym)
    if not gid:
        return None
    try:
        url = _URLS.get(gid)
        if not url:
            prefetch_logos([sym])
            url = _URLS.get(gid)
        if not url:
            return None
        g = requests.get(url.replace("/small/", "/large/").replace("/thumb/", "/large/"), headers=UA, timeout=25)
        return Image.open(io.BytesIO(g.content)).convert("RGBA") if g.ok else None
    except Exception as ex:
        log.info("logo of %s (%s): %s", sym, gid, ex)
        return None


def coin_logo(sym, size):
    """The coin's own logo, or None — and then the coin is not drawn (the owner's rule).
    Order: the owner's 3D art; the official image verified through CoinGecko's Binance mapping (a namesake's
    logo is never used); the owner's approved logo set. A local preview without network also takes the site's
    small logos, only to see the layout."""
    key = (sym, size)
    if key in _LOGO:
        return _LOGO[key]
    img = None
    p3d = os.path.join(ROOT, "assets", "coin3d", sym + ".png")
    cache = os.path.join("/tmp", "album_logos", sym + ".png")
    if os.path.exists(p3d):
        img = Image.open(p3d).convert("RGBA")
    elif os.path.exists(cache):
        img = Image.open(cache).convert("RGBA")
    else:
        local = bool(os.environ.get("ALBUM_LOCAL") or os.environ.get("ALBUM_REPLAY"))
        src = None if local else _verified_logo(sym)
        try:
            import coin_logos as CL
            if src is not None:
                img = CL.coin_frame(src, CL.main_colour(src))
                os.makedirs(os.path.dirname(cache), exist_ok=True)
                img.save(cache)
            elif os.path.exists(os.path.join(ROOT, "data", "coinlogo", sym + ".png")):
                img = Image.open(os.path.join(ROOT, "data", "coinlogo", sym + ".png")).convert("RGBA")
            elif local and os.path.exists(os.path.join(ROOT, "data", "logos", sym + ".png")):
                small = Image.open(os.path.join(ROOT, "data", "logos", sym + ".png")).convert("RGBA")
                img = CL.coin_frame(small, CL.main_colour(small))
                log.info("preview only: unverified logo for %s", sym)
        except Exception as ex:
            log.info("no logo for %s: %s", sym, ex)
    if img is not None:
        bb = img.getbbox()
        if bb:
            img = img.crop(bb)
        sc = size / max(img.size)
        img = img.resize((max(1, round(img.width * sc)), max(1, round(img.height * sc))), Image.LANCZOS)
    _LOGO[key] = img
    return img


def paste_logo(im, sym, cx, cy, size):
    lg = coin_logo(sym, size)
    if lg is None:
        raise AlbumError(f"نشان معتبر برای {sym} پیدا نشد")
    im.alpha_composite(lg, (int(cx - lg.width / 2), int(cy - lg.height / 2)))
    ink(cy + size / 2)


def has_logo(sym):
    return coin_logo(sym, 56) is not None


# --------------------------------------------------------------- charts
def sparkline(d, box, vals, col, width=3):
    x0, y0, x1, y1 = box
    if not vals or len(vals) < 2:
        return
    lo, hi = min(vals), max(vals)
    rng = (hi - lo) or 1
    pts = [(x0 + (x1 - x0) * i / (len(vals) - 1), y1 - (y1 - y0) * (v - lo) / rng) for i, v in enumerate(vals)]
    d.line(pts, fill=rgba(col), width=width, joint="curve")


def dashed(d, x0, x1, y, col, dash=12, gap=8, width=2):
    x = x0
    while x < x1:
        d.line([(x, y), (min(x + dash, x1), y)], fill=col, width=width)
        x += dash + gap


def gauge(im, cx, cy, r, value, ed):
    """fear & greed half-dial, red → green, needle at the value"""
    S = 3
    lay = Image.new("RGBA", (W * S // S, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    stops = [(0, (234, 57, 67)), (25, (246, 133, 59)), (50, (230, 205, 70)), (75, (147, 214, 87)), (100, (22, 199, 132))]
    for i in range(100):
        t = i
        for (a, ca), (b, cb) in zip(stops, stops[1:]):
            if a <= t <= b:
                col = IC._mix(ca, cb, (t - a) / (b - a))
                break
        a0 = 180 + 180 * i / 100
        d.arc([cx - r, cy - r, cx + r, cy + r], a0, a0 + 1.9, fill=rgba(col, 255), width=int(r * 0.2))
    ang = math.radians(180 + 180 * max(0, min(100, value)) / 100)
    tip = (cx + (r * 0.78) * math.cos(ang), cy + (r * 0.78) * math.sin(ang))
    d.line([(cx, cy), tip], fill=(255, 255, 255, 255), width=6)
    dot(d, cx, cy, 10, (255, 255, 255))
    im.alpha_composite(lay)


# =================================================================== 5. the ten slides
def s_cover(base, f, tx):
    ed = f["edition"]
    c = ED[ed]
    im = base.copy()
    d = DR(im)
    IC._logo(im, M - 8, 30, 150)
    lab = f"{fnum(1)} از {fnum(10)}"
    bw = tw(lab, 28, "b") + 46
    pill(im, (W - M - int(bw), 44, W - M, 94), c["prim"], 240)
    rt(d, W - M - 23, 47, lab, 28, "b", (12, 12, 20))
    rt(d, W - M, 112, "گزارش تصویری کوین کورد", 25, "m", MUTED)
    seg = (W - 2 * M - 9 * 8) / 10
    for i in range(10):
        x1 = W - M - i * (seg + 8)
        d.rounded_rectangle([x1 - seg, 206, x1, 212], 3, fill=rgba(c["prim"]) if i < 1 else (255, 255, 255, 34))
    IC._glow_text(im, W - M, 236, T(f"نبض {EDITION[ed]['name']}"), F(92, "k"), c["prim"])
    rt(d, W - M, 352, "بازار رمزارز", 92, "k", INK)
    rt(d, W - M, 480, f"{jdate(f['now'])} · ساعت تهیهٔ گزارش {hm(f['now'])} به وقت تهران", 27, "m", MUTED)
    # main message, tiles, change since the previous edition, contents — sized to fit above the footer
    hl = tx["headline"]
    p = f.get("prev_delta")
    for hsize, tile_h, row in ((42, 196, 46), (40, 186, 42), (38, 176, 39), (36, 168, 36)):
        n = lines_of(hl, hsize, W - 2 * M - 70, "b")
        box_h = 70 + n * int(hsize * 1.5) + 22
        total = box_h + 20 + tile_h + 18 + (46 if p else 0) + 50 + 5 * row
        if 532 + total <= CB:
            break
    y = 532
    panel(im, (M - 8, y, W - M + 8, y + box_h), ed, accent=True)
    d = DR(im)
    tag(im, W - M - 24, y + 20, "پیام اصلی بازار", c["prim"])
    para(d, W - M - 30, y + 66, hl, hsize, W - 2 * M - 70, "b", INK, lead=1.5)
    y += box_h + 20
    tiles = [("بیت‌کوین", fprice(f["btc"]["price"]) + " $", f["btc"]["chg"]),
             ("ارزش کل بازار", fusd(f["global"]["mcap"], unit=False), f["global"].get("mcap_chg24") or 0),
             ("ترس و طمع", fnum(f["fng"]["v"] or 0), None)]
    gap = 18
    tw_ = (W - 2 * M - 2 * gap) / 3
    k = tile_h / 196
    for i, (label, val, ch) in enumerate(tiles):
        x1 = W - M - i * (tw_ + gap)
        x0 = x1 - tw_
        panel(im, (x0, y, x1, y + tile_h), ed)
        d = DR(im)
        rt(d, x1 - 22, y + 16 * k, label, 25, "m", MUTED)
        if i == 0:
            num(d, x1 - 22, y + 58 * k, val, 46, "k", INK)
            change(d, x1 - 22, y + 128 * k, ch, 30)
        elif i == 1:
            v, unit = val.rsplit(" ", 1)
            wv = num(d, x1 - 22, y + 54 * k, v, 52, "k", INK)
            rt(d, x1 - 30 - wv, y + 68 * k, unit, 26, "b", MUTED)
            change(d, x1 - 22, y + 128 * k, ch, 30)
        else:
            fv = f["fng"]["v"] or 50
            col = (234, 57, 67) if fv < 25 else (246, 133, 59) if fv < 45 else (230, 205, 70) if fv <= 55 else (22, 199, 132)
            num(d, x1 - 22, y + 52 * k, val, 60, "k", col)
            rt(d, x1 - 22, y + 128 * k, fng_fa(f), 30, "b", col)
    y += tile_h + 18
    if p:
        d = DR(im)
        x = W - M - rt(d, W - M, y, f"از {prev_label(f)}:", 25, "m", MUTED) - 14
        for name, v in (("بیت‌کوین", p["btc"]), ("اتریوم", p.get("eth")), ("ارزش بازار", p.get("mcap"))):
            if v is None or x - tw(name, 25, "b") - numw(fpct(v), 25) - 40 < M:     # never past the left margin
                continue
            x -= rt(d, x, y, name, 25, "b", INK) + 10
            x -= change(d, x, y + 1, v, 25) + 24
        y += 46
    d = DR(im)
    rt(d, W - M, y + 2, "در این گزارش", 26, "b", c["prim"])
    y += 50
    colw = (W - 2 * M - 30) / 2
    for i, name in enumerate(SECTIONS[1:], 2):
        col_i, r_ = (0, i - 2) if i <= 6 else (1, i - 7)
        xr = W - M - col_i * (colw + 30)
        yy = y + r_ * row
        num(d, xr, yy + 2, fnum(i), 25, "k", c["prim"])
        rt(d, xr - 40, yy, name, 26, "r", INK)
    footer(im, ed)
    return im


def s_market(base, f, tx):
    ed = f["edition"]
    im = base.copy()
    header(im, ed, 2, "وضعیت کلی بازار", f"قیمت‌های لحظه‌ای بایننس · ساعت {hm(f['tk_at'])} تهران", f)
    mk = {c["coin"]: c for c in (site("market") or {}).get("coins", [])}
    y0 = CT
    rows = f["majors"][:8]
    rh = 64
    box = (M - 8, y0, W - M + 8, y0 + 64 + rh * len(rows) + 14)
    panel(im, box, ed)
    d = DR(im)
    tag(im, W - M - 16, y0 + 16, "داده")
    cols = {"name": W - M - 20, "price": W - M - 300, "chg": W - M - 500, "vol": W - M - 660, "spark": M + 12}
    hy = y0 + 18
    rt(d, cols["price"], hy, "قیمت (دلار)", 22, "m", DIM)
    rt(d, cols["chg"], hy, "۲۴ ساعت", 22, "m", DIM)
    rt(d, cols["vol"], hy, "حجم ۲۴ ساعته", 22, "m", DIM)
    lt(d, cols["spark"], hy, "۴۸ ساعت اخیر", 22, "m", DIM)
    y = y0 + 64
    for r in rows:
        s = r["sym"]
        d.line([(M + 8, y), (W - M - 8, y)], fill=(255, 255, 255, 18), width=1)
        paste_logo(im, s, cols["name"] - 24, y + rh / 2, 44)
        d = DR(im)
        rt(d, cols["name"] - 58, y + 4, COIN_FA.get(s, s), 27, "b", INK)
        num(d, cols["name"] - 58, y + 42, s, 16, "m", DIM)
        num(d, cols["price"], y + 13, fprice(r["price"]), 30, "b", INK)
        change(d, cols["chg"], y + 15, r["chg"], 27)
        num(d, cols["vol"], y + 17, fusd(r["qv"], unit=False).split(" ")[0], 26, "m", MUTED)
        rt(d, cols["vol"] - numw(fusd(r["qv"], unit=False).split(" ")[0], 26, "m") - 8, y + 18,
           fusd(r["qv"], unit=False).split(" ", 1)[1], 21, "r", DIM)
        sp = (mk.get(s) or {}).get("spark") or []
        if len(sp) >= 10:
            sparkline(d, (cols["spark"], y + 14, cols["spark"] + 150, y + rh - 14), sp[-48:],
                      colour((sp[-1] / sp[0] - 1) * 100) if sp[0] else FLAT, 3)
        y += rh
    # whole market
    g = f["global"]
    y = box[3] + 22
    box2 = (M - 8, y, W - M + 8, CB)
    panel(im, box2, ed)
    d = DR(im)
    tag(im, W - M - 16, y + 16, "داده")
    rt(d, W - M - 110, y + 17, "کل بازار", 26, "b", INK)
    lt(d, M + 12, y + 20, f"منبع: کوین‌گکو از طریق سایت · ساعت {hm(f['market_at'] or f['now'])}", 20, "r", DIM)
    br = f["breadth"]
    cells = [("ارزش کل بازار", fusd(g["mcap"], unit=False), g.get("mcap_chg24")),
             ("حجم معاملات ۲۴ ساعته", fusd(g.get("vol") or 0, unit=False), None),
             ("سهم بیت‌کوین", fnum(g.get("btc_d") or 0, 1) + "٪", None),
             ("سهم اتریوم", fnum(g.get("eth_d") or 0, 1) + "٪", None),
             ("سهم استیبل‌کوین‌ها", fnum(f["stable"]["now"] or g.get("stable_d") or 0, 2) + "٪", None),
             ("ارزهای صعودی / نزولی", f"{fnum(br['up'])}٪ / {fnum(br['down'])}٪", None)]
    cw, chh = (W - 2 * M) / 3, 118
    for i, (label, val, ch) in enumerate(cells):
        xr = W - M - (i % 3) * cw - 18
        yy = y + 70 + (i // 3) * chh
        rt(d, xr, yy, label, 22, "m", MUTED)
        if " " in val and not val.endswith("٪"):
            v, unit = val.split(" ", 1)
            wv = num(d, xr, yy + 34, v, 38, "k", INK)
            rt(d, xr - wv - 8, yy + 46, unit, 21, "m", MUTED)
        elif i == 5:
            a, b = val.split(" / ")
            wa = num(d, xr, yy + 34, a, 36, "k", UP)
            ws = num(d, xr - wa - 10, yy + 34, "/", 36, "k", DIM)
            num(d, xr - wa - ws - 20, yy + 34, b, 36, "k", DOWN)
        else:
            num(d, xr, yy + 34, val, 38, "k", INK)
        if ch is not None:
            change(d, xr, yy + 84, ch, 22)
    gap = f.get("btc_gap")
    if gap is not None and gap >= 1:                        # the owner's rule: a disagreement is said, not hidden
        rt(d, W - M - 18, CB - 40, f"قیمت لحظه‌ای بایننس با دادهٔ ساعت {hm(f['market_at'] or f['now'])} سایت "
           f"{fnum(gap, 1)}٪ تفاوت دارد؛ عددهای جدول بالا لحظه‌ای‌اند.", 19, "r", TAGC["هشدار"])
    footer(im, ed)
    return im


def bullet_h(items, size, width, lead=1.45, gap=10, max_lines=3, w="r"):
    f = F(size, w)
    return sum(min(max_lines, len(IC.wrap(T(x), f, width - 26))) * int(size * lead) + gap for x in items)


def bullets(d, xr, y, items, size, width, col, fill=INK, lead=1.45, gap=10, max_lines=3, w="r"):
    for x in items:
        dot(d, xr - 7, y + size * 0.78, 5, col)
        y = para(d, xr - 24, y, x, size, width - 26, w, fill, lead, max_lines) + gap
    return y


NEWS_ROWS = (("چه شد:", "what", "خبر"), ("چرا مهم است:", "why", "تحلیل"), ("اثر بر بازار:", "effect", "تحلیل"),
             ("پیگیری:", "watch", "سناریو"))


def news_block_h(x, parts, tsize, bsize, width, keys):
    h = 62 + min(2, lines_of(x["fa_t"], tsize, width - 40, "b")) * int(tsize * 1.42) + 6
    for lab, key, _ in NEWS_ROWS:
        if key in keys and parts.get(key):
            lw = tw(lab, bsize, "b")
            h += min(2, lines_of(parts[key], bsize, width - 60 - lw)) * int(bsize * 1.45)
    return h + 18


def pruned(x, parts):
    parts = dict(parts)
    tw_, ww = set(x["fa_t"].split()), set((parts.get("what") or "").split())
    if ww and len(tw_ & ww) / len(ww) >= 0.6:
        parts["what"] = ""
    return parts


def s_news(base, f, tx):
    ed = f["edition"]
    im = base.copy()
    since = f["now"] - timedelta(hours=12)
    header(im, ed, 3, "اخبار مهم", f"تازه‌ترین تحولات از {stamp(since, f['now'])} تا {hm(f['now'])} · بازنویسی تحلیلی", f)
    items = f["news"][:3]
    gap = 16
    width = W - 2 * M
    avail = CB - CT - gap * (len(items) - 1)
    for keys, tsize, bsize in ((("what", "why", "effect", "watch"), 31, 24), (("what", "why", "effect", "watch"), 29, 23),
                               (("what", "why", "effect", "watch"), 28, 22), (("why", "effect", "watch"), 31, 24),
                               (("why", "effect", "watch"), 29, 23), (("why", "effect", "watch"), 28, 22)):
        hs = [news_block_h(x, pruned(x, tx["news"][x["id"]]), tsize, bsize, width, keys) for x in items]
        if sum(hs) <= avail:
            break
    spare = max(0, (avail - sum(hs)) / len(items))
    y = CT
    for x, h in zip(items, hs):
        parts = pruned(x, tx["news"][x["id"]])           # «چه شد» that only repeats the headline is left out
        h += spare
        box = (M - 8, y, W - M + 8, y + h)
        panel(im, box, ed)
        d = DR(im)
        xr = tag(im, W - M - 16, y + 16, "خبر")
        if x["unverified"]:
            tag(im, xr, y + 16, "تأییدنشده")
        src = src_fa(x["src"]) + (f" و {fnum(x['n_src'] - 1)} رسانهٔ دیگر" if x["n_src"] > 1 else "")
        lt(d, M + 12, y + 20, f"{src} · {stamp(x['date'], f['now'])}", 21, "m", DIM)
        yy = para(d, W - M - 18, y + 62, x["fa_t"], tsize, width - 40, "b", INK, lead=1.42, max_lines=2) + 6
        for lab, key, kind in NEWS_ROWS:
            if key not in keys or not parts.get(key):
                continue
            wl = rt(d, W - M - 18, yy, lab, bsize, "b", TAGC[kind])
            yy = para(d, W - M - 28 - wl, yy, parts[key], bsize, width - 60 - wl, "r", (222, 228, 238), lead=1.45, max_lines=2)
        y += h + gap
    footer(im, ed)
    return im


TREND_COL = {"up": UP, "down": DOWN, "range": FLAT}


def chip(im, xr, y, label, col, size=24):
    w = tw(label, size, "b") + 30
    pill(im, (int(xr - w), y, int(xr), y + size + 18), col, 52, outline=col)
    rt(DR(im), xr - 15, y + 5, label, size, "b", col)
    return w


def s_btc(base, f, tx):
    ed = f["edition"]
    c = ED[ed]
    im = base.copy()
    b = f["btc"]
    L = b["lv"]
    header(im, ed, 4, "تحلیل بیت‌کوین", f"کندل‌های ساعتی و روزانهٔ بایننس · ساعت {hm(f['tk_at'])} تهران", f)
    y = CT
    paste_logo(im, "BTC", W - M - 36, y + 38, 70)
    d = DR(im)
    wp = num(d, W - M - 88, y - 4, fprice(b["price"]) + " $", 58, "k", INK)
    change(d, W - M - 88 - wp - 30, y + 14, b["chg"], 32)
    rt(d, W - M - 88, y + 72, f"کف و سقف ۲۴ ساعته: {fprice(b['lo'])} و {fprice(b['hi'])} دلار", 23, "m", MUTED)
    # chart: 72 hourly closes, EMA20/50, nearest support and resistance
    y0 = y + 114
    box = (M - 8, y0, W - M + 8, y0 + 290)
    panel(im, box, ed)
    d = DR(im)
    h1 = b["h1"]
    closes = [r["c"] for r in h1]
    e20, e50 = ema(closes, 20), ema(closes, 50)
    N = 72
    seg = h1[-N:]
    lo = min(min(r["l"] for r in seg), L["s1"])
    hi = max(max(r["h"] for r in seg), L["r1"])
    pad = (hi - lo) * 0.07
    lo, hi = lo - pad, hi + pad
    X0, X1, Y0, Y1 = M + 22, W - M - 22, y0 + 58, y0 + 262
    px = lambda i: X0 + (X1 - X0) * i / (N - 1)
    py = lambda v: Y1 - (Y1 - Y0) * (v - lo) / (hi - lo)
    pts = [(px(i), py(r["c"])) for i, r in enumerate(seg)]
    d.polygon(pts + [(X1, Y1), (X0, Y1)], fill=rgba(c["prim"], 40))
    for v, col, lab in ((L["r1"], DOWN, "مقاومت"), (L["s1"], UP, "حمایت")):
        yy = py(v)
        dashed(d, X0, X1, yy, rgba(col, 210))
        lt(d, X0 + 6, yy - 34, f"{lab} {fprice(v)}", 21, "b", col)
    d.line([(px(i), py(v)) for i, v in enumerate(e50[-N:])], fill=rgba(c["sec"], 235), width=3)
    d.line([(px(i), py(v)) for i, v in enumerate(e20[-N:])], fill=(255, 255, 255, 200), width=2)
    d.line(pts, fill=rgba(c["prim"]), width=4, joint="curve")
    dot(d, pts[-1][0], pts[-1][1], 7, c["prim"])
    xr = W - M - 20
    for lab, col in (("قیمت", c["prim"]), ("میانگین ۲۰ ساعته", (255, 255, 255)), ("میانگین ۵۰ ساعته", c["sec"])):
        d.line([(xr - 26, y0 + 32), (xr, y0 + 32)], fill=rgba(col), width=4)
        xr -= 34 + rt(d, xr - 34, y0 + 16, lab, 21, "m", MUTED) + 26
    lt(d, M + 20, y0 + 16, "۷۲ ساعت اخیر", 21, "m", DIM)
    # trend + levels
    y1 = box[3] + 14
    half = (W - 2 * M - 18) / 2
    bR = (W - M - half, y1, W - M + 8, y1 + 244)
    bL = (M - 8, y1, M + half - 8, y1 + 244)
    panel(im, bR, ed)
    panel(im, bL, ed)
    d = DR(im)
    tag(im, W - M - 16, y1 + 14, "داده")
    rt(d, W - M - 100, y1 + 14, "روند", 25, "b", INK)
    yy = y1 + 60
    for lab, key in (("کوتاه‌مدت (ساعتی)", "trend_s"), ("میان‌مدت (روزانه)", "trend_m")):
        rt(d, W - M - 18, yy + 6, lab, 23, "m", MUTED)
        chip(im, bR[0] + 24 + tw(TREND_FA[b[key]], 23, "b") + 30, yy, TREND_FA[b[key]], TREND_COL[b[key]], 23)
        d = DR(im)
        yy += 52
    rt(d, W - M - 18, yy + 4, f"RSI ساعتی {fnum(b['rsi1'] or 0)} · روزانه {fnum(b['rsid'] or 0)}", 23, "m", INK)
    yy += 44
    if b.get("chg30") is not None:
        wl = rt(d, W - M - 18, yy + 2, "۳۰ روز اخیر:", 23, "m", MUTED)
        change(d, W - M - 30 - wl, yy + 2, b["chg30"], 25)
    tag(im, bL[2] - 16, y1 + 14, "داده")
    rt(d, bL[2] - 100, y1 + 14, "سطوح کلیدی", 25, "b", INK)
    ladder = [("مقاومت ۲", L["r2"], DOWN), ("مقاومت ۱", L["r1"], DOWN), ("قیمت فعلی", b["price"], c["prim"]),
              ("حمایت ۱", L["s1"], UP), ("حمایت ۲", L["s2"], UP)]
    yy = y1 + 58
    for lab, v, col in ladder:
        dot(d, bL[2] - 26, yy + 17, 6, col)
        rt(d, bL[2] - 42, yy + 1, lab, 23, "m", INK if lab == "قیمت فعلی" else MUTED)
        num(d, bL[0] + 24 + numw(fprice(v), 25, "b"), yy + 1, fprice(v), 25, "b", col if lab != "قیمت فعلی" else INK)
        yy += 36
    # scenarios + factors
    y2 = bR[3] + 14
    panel(im, (M - 8, y2, W - M + 8, CB), ed, accent=True)
    d = DR(im)
    tag(im, W - M - 16, y2 + 14, "سناریو")
    rt(d, W - M - 112, y2 + 14, "دو سناریوی شرطی", 25, "b", INK)
    sc = scenarios(f)
    yy = y2 + 58
    for key, col in (("bull", UP), ("bear", DOWN)):
        dot(d, W - M - 24, yy + 18, 7, col)
        yy = para(d, W - M - 42, yy, sc[key], 24, W - 2 * M - 60, "m", INK, lead=1.42, max_lines=2) + 2
    p = long_share(f["deriv"].get("ls"))
    fac = []
    if f["deriv"].get("btc_funding") is not None:
        fac.append(f"نرخ تأمین مالی {fnum(f['deriv']['btc_funding'], 4)}٪ ({funding_word(f['deriv']['btc_funding']).split('؛')[0]})")
    if p:
        fac.append(f"{fnum(p)}٪ حساب‌ها لانگ")
    fac.append(f"ترس و طمع {fnum(f['fng']['v'] or 0)}")
    yy += 8
    xr = tag(im, W - M - 16, yy, "داده")
    para(d, xr - 6, yy + 2, "عوامل مؤثر: " + "، ".join(fac), 22, xr - M - 20, "r", MUTED, lead=1.4, max_lines=2)
    footer(im, ed)
    return im


def vol_x(sym):
    """last 24 hours of volume against the 24 before them (1h candles)"""
    try:
        k = klines(sym, "1h", 48)
    except AlbumError:
        return None
    a, b = sum(r["v"] for r in k[-24:]), sum(r["v"] for r in k[:-24])
    return a / b if b > 0 and len(k) >= 40 else None


def movers(f, n=4):
    uni = [u for u in f["universe"] if u["qv"] >= 5e6]
    out, skipped = {}, []
    for key, order in (("up", lambda u: -u["chg"]), ("down", lambda u: u["chg"])):
        rows = []
        for u in sorted(uni, key=order):
            if (key == "up" and u["chg"] <= 0) or (key == "down" and u["chg"] >= 0):
                break
            if not has_logo(u["sym"]):
                skipped.append(u["sym"])
                log.info("mover %s skipped: no verified logo", u["sym"])
                continue
            rows.append(dict(u, vx=vol_x(u["sym"])))
            if len(rows) == n:
                break
        out[key] = rows
    out["skipped"] = skipped
    return out


def coin_news(f, sym, hours=30):
    nj = site("news") or {}
    for it in nj.get("items", []):
        d = parse_dt(it.get("date"))
        if d and f["now"] - d <= timedelta(hours=hours) and sym in (it.get("coins") or []):
            fa = IC.clean(it.get("tfa") or "")
            if len(fa) >= 12:
                return fa, it.get("source", ""), d
    return None


def mover_line(f, r):
    nm = COIN_FA.get(r["sym"], r["sym"])
    vx = r.get("vx")
    vol = (f"، همراه با {fnum(vx, 1)} برابر شدن حجم معاملات" if vx and vx >= 1.5 else
           "، با حجمی کمتر از شبانه‌روز قبل" if vx and vx <= 0.7 else "")
    cn = coin_news(f, r["sym"])
    t = cn[0] if cn else ""
    if t and len(t) > 80:
        t = t[:78].rsplit(" ", 1)[0] + " …"
    cause = (f"خبر مرتبط: «{t}»" if cn else "خبر مشخصی در منابع سایت نیست؛ حرکت احتمالاً از جریان سفارش‌ها و اهرم است")
    return f"{nm}: {fpct(r['chg'])} {updown(r['chg'])}{vol}. {cause}"


def s_alts(base, f, tx):
    ed = f["edition"]
    im = base.copy()
    header(im, ed, 5, "آلت‌کوین‌ها", "بیشترین رشد و افت ۲۴ ساعته · ارزهای با حجم بالای ۵ میلیون دلار", f)
    mv = f.get("movers") or movers(f)
    f["movers"] = mv
    half = (W - 2 * M - 18) / 2
    y0 = CT
    rh = 86
    for side, (title, col, rows) in enumerate((("بیشترین رشد", UP, mv["up"]), ("بیشترین افت", DOWN, mv["down"]))):
        x1 = W - M + 8 - side * (half + 18)
        x0 = x1 - half - 8
        panel(im, (x0, y0, x1, y0 + 66 + rh * 4), ed)
        d = DR(im)
        tri(d, x1 - 30, y0 + 32, side == 0, 11, col)
        rt(d, x1 - 50, y0 + 12, title, 27, "b", col)
        yy = y0 + 64
        for r in rows:
            d.line([(x0 + 16, yy), (x1 - 16, yy)], fill=(255, 255, 255, 22), width=1)
            paste_logo(im, r["sym"], x1 - 44, yy + rh / 2, 52)
            d = DR(im)
            num(d, x1 - 82, yy + 10, r["sym"], 27, "b", INK)
            nm = COIN_FA.get(r["sym"])
            if nm:
                rt(d, x1 - 82, yy + 47, nm, 20, "r", MUTED)
            change(d, x0 + 26 + numw(fpct(r["chg"]), 31, "k") + 26, yy + 8, r["chg"], 31, "k")
            if r.get("vx"):
                vxs = f"×{fnum(r['vx'], 1)}"
                wv = num(d, x0 + 26 + numw(vxs, 21, "b"), yy + 52, vxs, 21, "b", TAGC["هشدار"] if r["vx"] >= 2 else MUTED)
                rt(d, x0 + 26 + wv + 64, yy + 52, "حجم", 19, "r", DIM)
            yy += rh
        if not rows:
            rt(d, x1 - 24, y0 + 90, "ارزی با این شرط پیدا نشد", 23, "r", MUTED)
    # unusual moves and their likely cause
    y1 = y0 + 66 + rh * 4 + 14
    lines = [mover_line(f, mv[k][0]) for k in ("up", "down") if mv[k]]
    br = f["breadth"]
    al = f["altseason"]
    rows = []
    if al.get("v") is not None:
        rows.append(f"شاخص فصل آلت‌کوین‌ها: {fnum(al['v'])} از ۱۰۰ ({ALT_FA.get(al.get('label'), '')}) · سنجش ۹۰ روزه")
    secs = sorted(f["sectors"], key=lambda s_: s_["chg24"])
    if len(secs) >= 2:
        best, worst = secs[-1], secs[0]
        rows.append(f"بخش‌ها در ۲۴ ساعت: قوی‌ترین «{SECTOR_FA.get(best['name'], best['short'])}» "
                    f"({fpct(best['chg24'])} {updown(best['chg24'])})، ضعیف‌ترین «{SECTOR_FA.get(worst['name'], worst['short'])}» "
                    f"({fpct(worst['chg24'])} {updown(worst['chg24'])})")
    hb2 = 66 + 62 + sum(min(2, lines_of(r, 22, W - 2 * M - 36)) * 31 + 4 for r in rows) + 10
    avail = CB - y1 - 14 - hb2 - 64
    for size in (23, 22, 21, 20):
        if bullet_h(lines, size, W - 2 * M - 40, max_lines=3, gap=8) <= avail:
            break
    hb = 64 + bullet_h(lines, size, W - 2 * M - 40, max_lines=3, gap=8) + 4
    panel(im, (M - 8, y1, W - M + 8, y1 + hb), ed)
    d = DR(im)
    tag(im, W - M - 16, y1 + 14, "تحلیل")
    rt(d, W - M - 104, y1 + 14, "حرکت‌های بزرگ و علت احتمالی", 24, "b", INK)
    bullets(d, W - M - 18, y1 + 60, lines, size, W - 2 * M - 40, TAGC["تحلیل"], (226, 232, 240), max_lines=3, gap=8)
    # breadth + sectors
    y2 = y1 + hb + 14
    panel(im, (M - 8, y2, W - M + 8, CB), ed)
    d = DR(im)
    tag(im, W - M - 16, y2 + 14, "داده")
    rt(d, W - M - 104, y2 + 14, f"پهنای بازار · {fnum(br['n'])} ارز با حجم بیش از یک میلیون دلار", 23, "b", INK)
    bx0, bx1, by = M + 18, W - M - 18, y2 + 62
    parts = [(br["up"], UP, "صعودی"), (br["flat"], FLAT, "خنثی"), (br["down"], DOWN, "نزولی")]
    x = bx1
    for v, col, lab in parts:
        wseg = (bx1 - bx0) * v / 100
        if wseg >= 1:
            d.rectangle([x - wseg, by, x, by + 18], fill=rgba(col, 225))
        x -= wseg
    x = bx1
    for v, col, lab in parts:
        wl = rt(d, x, by + 26, f"{lab} {fnum(v)}٪", 21, "b", col)
        x -= wl + 34
    yy = by + 66
    for r in rows:
        yy = para(d, W - M - 18, yy, r, 22, W - 2 * M - 36, "r", MUTED, lead=1.4, max_lines=2) + 4
    footer(im, ed)
    return im


def bar_row(im, xr, y, sym, label, count, usd, mx, col):
    paste_logo(im, sym, xr - 20, y + 19, 38)
    d = DR(im)
    rt(d, xr - 50, y + 2, label, 22, "b", INK)
    x1 = xr - 190
    span = x1 - (M + 300)
    bw = max(6, span * usd / mx) if mx else 6
    d.rounded_rectangle([x1 - bw, y + 9, x1, y + 31], 6, fill=rgba(col, 215))
    s_ = fusd(usd, unit=False)
    v, unit = s_.split(" ", 1) if " " in s_ else (s_, "")
    wv = num(d, x1 - bw - 14, y + 2, v, 24, "b", INK)
    rt(d, x1 - bw - 22 - wv, y + 6, f"{unit} · {fnum(count)} تراکنش", 19, "r", MUTED)


def s_flows(base, f, tx):
    ed = f["edition"]
    c = ED[ed]
    im = base.copy()
    header(im, ed, 6, "جریان سرمایه و نهنگ‌ها", "ارزش بازار، استیبل‌کوین‌ها، صندوق‌ها، تراکنش‌های بزرگ و بازار آتی", f)
    g = f["global"]
    y = CT
    half = (W - 2 * M - 18) / 2
    mc = g.get("mcap_chg24") or 0
    delta = g["mcap"] - g["mcap"] / (1 + mc / 100)
    dst, read = stable_read(f)
    for side in (0, 1):
        x1 = W - M + 8 - side * (half + 18)
        x0 = x1 - half - 8
        panel(im, (x0, y, x1, y + 156), ed)
        d = DR(im)
        if side == 0:
            rt(d, x1 - 22, y + 14, "تغییر ارزش کل بازار در ۲۴ ساعت", 22, "m", MUTED)
            s_ = fusd(delta, unit=False)
            v, unit = s_.split(" ", 1) if " " in s_ else (s_, "")
            wv = num(d, x1 - 22, y + 48, v, 46, "k", colour(mc))
            rt(d, x1 - 32 - wv, y + 62, unit + " دلار", 23, "b", MUTED)
            rt(d, x1 - 22, y + 112, ("کاهش" if mc < 0 else "افزایش") + f" ({fpct(mc)})", 22, "b", colour(mc))
        else:
            rt(d, x1 - 22, y + 14, "سهم استیبل‌کوین‌ها از کل بازار", 22, "m", MUTED)
            num(d, x1 - 22, y + 48, fnum(f["stable"]["now"] or 0, 2) + "٪", 46, "k", INK)
            if dst is not None:
                lab = (f"{fnum(abs(dst), 2)} واحد {'بیشتر' if dst > 0 else 'کمتر'} از ۲۴ ساعت پیش" if abs(dst) >= 0.005
                       else "بدون تغییر نسبت به ۲۴ ساعت پیش")
                rt(d, x1 - 22, y + 112, lab, 21, "m", DOWN if dst > 0.15 else UP if dst < -0.15 else MUTED)
    y += 156 + 12
    if read:
        d = DR(im)
        xr = tag(im, W - M - 8, y, "تحلیل")
        para(d, xr - 6, y + 2, read, 22, xr - M, "r", (222, 228, 238), lead=1.4, max_lines=1)
        y += 48
    # ETF
    e = f["etf"]
    if e:
        hb = 62 + min(2, lines_of(e["fa_t"], 23, W - 2 * M - 36, "m")) * 33 + 12
    else:
        hb = 104
    panel(im, (M - 8, y, W - M + 8, y + hb), ed)
    d = DR(im)
    xr = tag(im, W - M - 16, y + 14, "خبر")
    rt(d, xr - 4, y + 14, "صندوق‌های قابل معامله (ETF)", 23, "b", INK)
    if e:
        lt(d, M + 12, y + 18, f"{src_fa(e['src'])} · {stamp(e['date'], f['now'])}", 20, "m", DIM)
        para(d, W - M - 18, y + 58, e["fa_t"], 23, W - 2 * M - 36, "m", INK, lead=1.42, max_lines=2)
    else:
        para(d, W - M - 18, y + 58, "در ۴۰ ساعت گذشته خبر تازه‌ای از جریان صندوق‌ها در منابع سایت ثبت نشده است.", 22,
             W - 2 * M - 36, "r", MUTED, max_lines=1)
    y += hb + 12
    # whales
    tot = f["whales"]["tot"]
    rows = [(k, lab) for k, lab in (("BTC", "بیت‌کوین"), ("ETH", "اتریوم"), ("USDT", "تتر"), ("USDC", "یواس‌دی‌سی")) if tot.get(k)]
    hb = 62 + 46 * len(rows) + 40
    panel(im, (M - 8, y, W - M + 8, y + hb), ed)
    d = DR(im)
    xr = tag(im, W - M - 16, y + 14, "داده")
    rt(d, xr - 4, y + 14, "تراکنش‌های بزرگ ۲۴ ساعت (نهنگ‌ها)", 23, "b", INK)
    lt(d, M + 12, y + 18, "ساعت " + hm(f["whales"]["at"] or f["now"]), 20, "m", DIM)
    mx = max([tot[k]["usd"] for k, _ in rows] or [1])
    yy = y + 58
    for k, lab in rows:
        bar_row(im, W - M - 18, yy, k, lab, tot[k]["n"], tot[k]["usd"], mx,
                c["prim"] if k in ("BTC", "ETH") else (45, 212, 191))
        yy += 46
    d = DR(im)
    mn = f["whales"]["min"]
    para(d, W - M - 18, yy + 4, f"آستانه: {fnum(mn.get('BTC', 500))} بیت‌کوین، {fnum(mn.get('ETH', 1000))} اتر و "
         f"{fusd(mn.get('stable', 1e7))} استیبل‌کوین؛ جابه‌جایی داخلی صرافی‌ها هم شمرده می‌شود.", 19, W - 2 * M - 36, "r",
         DIM, lead=1.35, max_lines=1)
    y += hb + 12
    # on-chain notes + futures
    oc = f["onchain"]
    dv = f["deriv"]
    p = long_share(dv.get("ls"))
    deriv = []
    if dv.get("oi"):
        deriv.append(f"موقعیت‌های باز {fusd(dv['oi'])}")
    if dv.get("btc_funding") is not None:
        deriv.append(f"تأمین مالی بیت‌کوین {fnum(dv['btc_funding'], 4)}٪ ({funding_word(dv['btc_funding']).split('؛')[0]})")
    if p:
        deriv.append(f"{fnum(p)}٪ حساب‌ها لانگ")
    dline = "بازار آتی: " + " · ".join(deriv) if deriv else ""
    notes = [f"{o['fa_t']} — {o['src']}، {stamp(o['date'], f['now'])}" for o in oc[:2]]
    width = W - 2 * M - 36
    need_d = (lines_of(dline, 21, width - 90) * 30 + 14) if dline else 0
    while notes and 58 + sum(min(2, lines_of(n_, 22, width)) * 31 + 6 for n_ in notes) + need_d > CB - y - 8:
        notes = notes[:-1]
    panel(im, (M - 8, y, W - M + 8, CB), ed)
    d = DR(im)
    yy = y + 14
    if notes:
        xr = tag(im, W - M - 16, yy, "آن‌چین")
        rt(d, xr - 4, yy, "یادداشت‌های آن‌چین", 23, "b", INK)
        yy += 46
        for n_ in notes:
            yy = para(d, W - M - 18, yy, n_, 22, width, "r", (222, 228, 238), lead=1.4, max_lines=2) + 6
    if dline:
        xr = tag(im, W - M - 16, yy + 4, "داده")
        para(d, xr - 6, yy + 6, dline, 21, xr - M - 10, "r", MUTED, lead=1.4, max_lines=2)
    footer(im, ed)
    return im


MACRO_ROWS = [("SPX", "شاخص اس‌اندپی ۵۰۰", 1, ""), ("NDX", "شاخص نزدک", 0, ""),
              ("DXY", "شاخص دلار آمریکا (گسترده)", 2, ""), ("GOLD", "طلا (هر اونس)", 0, "$"),
              ("OIL", "نفت خام وست تگزاس", 2, "$"), ("US10Y", "بازده اوراق ۱۰ سالهٔ آمریکا", 2, "٪")]


def s_macro(base, f, tx):
    ed = f["edition"]
    im = base.copy()
    header(im, ed, 7, "اقتصاد کلان و بازارهای جهانی", "آخرین دادهٔ هر بازار همراه با تاریخ آن", f)
    mc = f["macro"]
    rows = [r for r in MACRO_ROWS if (mc["last"].get(r[0]) or {}).get("value") is not None]
    rh = 58
    y = CT
    hb = 60 + rh * len(rows) + 10
    panel(im, (M - 8, y, W - M + 8, y + hb), ed)
    d = DR(im)
    tag(im, W - M - 16, y + 14, "داده")
    cols = {"name": W - M - 18, "val": W - M - 470, "date": W - M - 660, "chg": M + 20}
    rt(d, cols["val"], y + 16, "آخرین مقدار", 21, "m", DIM)
    rt(d, cols["date"], y + 16, "تاریخ داده", 21, "m", DIM)
    lt(d, cols["chg"], y + 16, "تغییر یک‌ماهه", 21, "m", DIM)
    yy = y + 60
    for key, name, dec, unit in rows:
        last = mc["last"][key]
        d.line([(M + 8, yy), (W - M - 8, yy)], fill=(255, 255, 255, 22), width=1)
        rt(d, cols["name"], yy + 12, name, 24, "b", INK)
        val = fnum(last["value"], dec) + (" " + unit if unit == "$" else unit)
        num(d, cols["val"], yy + 12, val, 26, "b", INK)
        dd = parse_dt(last.get("date"))
        rt(d, cols["date"], yy + 14, jday(dd) if dd else "—", 22, "m", MUTED)
        ch = mc["chg"].get(key)
        if ch is not None:
            change(d, cols["chg"] + numw(fpct(ch), 24) + 30, yy + 12, ch, 24)
        yy += rh
    y += hb + 12
    corr = (mc["corr"] or [None, None])[1]
    if corr is not None:
        panel(im, (M - 8, y, W - M + 8, y + 116), ed)
        d = DR(im)
        tag(im, W - M - 16, y + 14, "داده")
        rt(d, W - M - 104, y + 14, "همبستگی ۳۰ روزهٔ بیت‌کوین و اس‌اندپی ۵۰۰", 23, "b", INK)
        num(d, M + 20 + numw(fnum(corr, 2), 32, "k"), y + 8, fnum(corr, 2), 32, "k", ED[ed]["prim"])
        bx0, bx1, by = M + 20, W - M - 20, y + 64
        d.rounded_rectangle([bx0, by, bx1, by + 10], 5, fill=(255, 255, 255, 34))
        mid = (bx0 + bx1) / 2
        xv = mid - (bx1 - bx0) / 2 * max(-1, min(1, corr))      # right = −۱, left = +۱ (read right to left)
        d.rounded_rectangle([min(mid, xv), by, max(mid, xv), by + 10], 5, fill=rgba(ED[ed]["prim"], 235))
        d.line([(mid, by - 6), (mid, by + 16)], fill=(255, 255, 255, 140), width=2)
        rt(d, bx1, by + 18, "منفی ۱", 18, "r", DIM)
        ct(d, mid, by + 18, "صفر", 18, "r", DIM)
        lt(d, bx0, by + 18, "مثبت ۱", 18, "r", DIM)
        y += 116 + 12
    reads = macro_read(f)
    width = W - 2 * M - 36
    need_r = (64 + bullet_h(reads, 22, width, max_lines=2, gap=6) + 6) if reads else 0
    world = list(f["world"])

    def world_h(ws):
        return 60 + sum(min(2, lines_of(w_["fa_t"], 22, width, "m")) * 32 + 34 for w_ in ws) + 4
    while world and world_h(world) + need_r + 12 > CB - y:
        world = world[:-1]
    if world:
        hb = world_h(world)
        panel(im, (M - 8, y, W - M + 8, y + hb), ed)
        d = DR(im)
        xr = tag(im, W - M - 16, y + 14, "خبر")
        rt(d, xr - 4, y + 14, "خبرهای اقتصاد جهانی", 23, "b", INK)
        yy = y + 58
        for w_ in world:
            yy = para(d, W - M - 18, yy, w_["fa_t"], 22, width, "m", INK, lead=1.45, max_lines=2)
            rt(d, W - M - 18, yy, f"{src_fa(w_['src'])} · {stamp(w_['date'], f['now'])}", 19, "r", DIM)
            yy += 34
        y += hb + 12
    if reads and CB - y >= need_r - 2:
        panel(im, (M - 8, y, W - M + 8, CB), ed, accent=True)
        d = DR(im)
        xr = tag(im, W - M - 16, y + 14, "تحلیل")
        rt(d, xr - 4, y + 14, "اثر بر بازار رمزارز", 23, "b", INK)
        bullets(d, W - M - 18, y + 60, reads, 22, width, TAGC["تحلیل"], (226, 232, 240), max_lines=2, gap=6)
    footer(im, ed)
    return im


def verdict(o):
    why = (o.get("why") or {}).get("fa") or ""
    m = re.search(r"در آزمایشگاه حقیقت[^.؛]*", why)
    return m.group(0).strip() if m else ""


def opp_lines(o):
    bull = o.get("dir") == "bull"
    mtf = o.get("mtf") or {}
    want = "up" if bull else "down"
    need = [(k, v) for k, v in mtf.items() if v != want]
    if need:
        conf = (f"تأیید: {'صعودی' if bull else 'نزولی'} شدن روند " + " و ".join(TF_FA.get(k, k) for k, _ in need)
                + " (اکنون " + "، ".join(TREND_FA.get(v, v) for _, v in need) + ")")
    else:
        conf = "تأیید: روندهای بالاتر هم‌جهت‌اند؛ ادامهٔ حرکت با حجم"
    vx = o.get("vol_x")
    if vx is not None:
        conf += f"؛ حجم {'هنوز زیر میانگین' if vx < 1 else 'بالای میانگین'} (×{fnum(vx, 2)})"
    inv = f"ابطال: {'زیر' if bull else 'بالای'} {fprice(o['inval'])}" + (f" · هدف فنی اسکنر: {fprice(o['target'])}" if o.get("target") else "")
    return conf, inv


def s_opps(base, f, tx):
    ed = f["edition"]
    im = base.copy()
    header(im, ed, 8, "فرصت‌ها و ریسک‌ها", "یافته‌های اسکنر سایت، هر کدام با شرط تأیید و حد ابطال", f)
    width = W - 2 * M - 36
    seen, opps = set(), []
    for o in f["opps"]:                                      # one finding per coin: two opposite ones cancel out
        if o["coin"] in seen or o["price"] < 0.001 or not has_logo(o["coin"]):     # micro-prices: unreadable zeros
            continue
        seen.add(o["coin"])
        opps.append(o)
        if len(opps) == 3:
            break
    sc = f["scan"]
    rec = ""
    if sc.get("n24"):
        good = (sc.get("win24") or 0) >= 52 and (sc.get("avg24") or 0) > 0
        rec = (f"از {jday(sc['since'])} تاکنون {fnum(sc['n24'])} یافتهٔ اسکنر پس از ۲۴ ساعت سنجیده شده: "
               f"{fnum(sc.get('win24') or 0)}٪ در جهت اعلام‌شده حرکت کرده‌اند و میانگین بازده "
               f"{fnum(abs(sc.get('avg24') or 0), 2)}٪ {'مثبت' if (sc.get('avg24') or 0) > 0 else 'منفی'} بوده است. "
               + ("این کارنامه مثبت است اما تضمینی برای آینده نیست." if good else
                  "یعنی این یافته‌ها به‌تنهایی مزیت آماری ندارند و فقط نقطهٔ شروع بررسی‌اند."))
    rs = risks(f)
    h_rec = (62 + lines_of(rec, 21, width) * 30 + 10) if rec else 0
    h_risk = lambda r: 62 + bullet_h(r, 21, width, max_lines=2, gap=6) + 6
    h_opp = 150
    while opps and len(opps) * (h_opp + 10) + h_rec + 12 + h_risk(rs[:2]) > CB - CT:
        opps = opps[:-1]
    y = CT
    for o in opps:
        panel(im, (M - 8, y, W - M + 8, y + h_opp), ed)
        paste_logo(im, o["coin"], W - M - 38, y + 42, 50)
        d = DR(im)
        num(d, W - M - 76, y + 14, o["coin"], 26, "b", INK)
        wsym = numw(o["coin"], 26, "b")
        bull = o.get("dir") == "bull"
        pat = PATTERN_FA.get(o["type"], o["type"]) + " · " + TF_FA.get(o.get("tf"), o.get("tf", ""))
        rt(d, W - M - 92 - wsym, y + 17, pat, 23, "b", UP if bull else DOWN)
        wpx = num(d, M + 14, y + 17, fprice(o["price"]), 22, "b", INK, anchor="l")
        lt(d, M + 22 + wpx, y + 17, "قیمت", 22, "m", MUTED)
        conf, inv = opp_lines(o)
        yy = para(d, W - M - 18, y + 64, conf, 21, width, "r", (222, 228, 238), lead=1.38, max_lines=2)
        rt(d, W - M - 18, yy + 2, inv, 21, "b", TAGC["سناریو"])
        vd = verdict(o)
        if vd and tw(inv, 21, "b") + tw(vd, 18) + 60 < width:
            lt(d, M + 14, yy + 5, vd.replace("در آزمایشگاه حقیقت", "آزمایشگاه حقیقت:"), 18, "r", DIM)
        y += h_opp + 10
    if not opps:
        panel(im, (M - 8, y, W - M + 8, y + 86), ed)
        rt(DR(im), W - M - 18, y + 26, "اسکنر در این ساعت الگوی معتبری روی ارزهای پرحجم ثبت نکرده است.", 23, "r", MUTED)
        y += 98
    if rec:
        panel(im, (M - 8, y, W - M + 8, y + h_rec), ed, accent=True)
        d = DR(im)
        xr = tag(im, W - M - 16, y + 14, "داده")
        rt(d, xr - 4, y + 14, "کارنامهٔ زندهٔ اسکنر، بدون گزینش", 23, "b", INK)
        para(d, W - M - 18, y + 58, rec, 21, width, "r", (222, 228, 238), lead=1.42, max_lines=4)
        y += h_rec + 12
    while rs and h_risk(rs) > CB - y:
        rs = rs[:-1]
    if rs:
        panel(im, (M - 8, y, W - M + 8, CB), ed)
        d = DR(im)
        xr = tag(im, W - M - 16, y + 14, "تحلیل")
        rt(d, xr - 4, y + 14, "ریسک‌های اصلی", 23, "b", INK)
        bullets(d, W - M - 18, y + 58, rs, 21, width, TAGC["هشدار"], (226, 232, 240), max_lines=2, gap=6)
    footer(im, ed)
    return im


def s_calendar(base, f, tx):
    ed = f["edition"]
    im = base.copy()
    header(im, ed, 9, "تقویم رویدادها و هشدارها", "زمان‌ها به وقت تهران · تقویم اقتصادی فارکس‌فکتوری از طریق سایت", f)
    cal = f["cal"]
    width = W - 2 * M - 36
    y = CT
    up = cal["up"]
    rh = 98
    hb = 60 + (len(up) * rh if up else 56) + 6
    panel(im, (M - 8, y, W - M + 8, y + hb), ed)
    d = DR(im)
    xr = tag(im, W - M - 16, y + 14, "داده")
    rt(d, xr - 4, y + 14, "رویدادهای پیش رو", 24, "b", INK)
    yy = y + 60
    if not up:
        rt(d, W - M - 18, yy + 2, "تا پایان دورهٔ تقویم این هفته رویداد مهم دیگری ثبت نشده است.", 22, "r", MUTED)
    for ev in up:
        d.line([(M + 8, yy), (W - M - 8, yy)], fill=(255, 255, 255, 22), width=1)
        hot = ev["impact"] == "High"
        when = stamp_future(ev["date"], f["now"]).replace(" ساعت ", " · ")
        wl = rt(d, W - M - 18, yy + 10, when, 23, "b", ED[ed]["prim"])
        chip(im, W - M - 36 - wl, yy + 8, IMPACT_FA[ev["impact"]], TAGC["هشدار"] if hot else MUTED, 18)
        d = DR(im)
        rt(d, W - M - 18, yy + 50, ev["name"], 24, "m", INK)
        fx = " · ".join(x for x in ((f"پیش‌بینی {ev['forecast']}" if ev["forecast"] else ""),
                                     (f"قبلی {ev['previous']}" if ev["previous"] else "")) if x)
        if fx:
            lt(d, M + 18, yy + 14, fx, 20, "m", MUTED)
        yy += rh
    y += hb + 12
    stats = [ev for ev in up if ev.get("avg_range") and ev.get("base_range") and ev.get("n")]
    if stats:
        ev = stats[0]
        txt = (f"در هفته‌های اخیر، بیت‌کوین در ۴ ساعت پس از انتشار این نوع داده به‌طور میانگین {fnum(ev['avg_range'], 1)}٪ نوسان داشته؛ "
               f"در همان ساعت‌های روزهای عادی {fnum(ev['base_range'], 1)}٪ (بر پایهٔ {fnum(ev['n'])} نمونه؛ کم است و قطعی نیست).")
        hb = 60 + lines_of(txt, 21, width) * 30 + 10
        panel(im, (M - 8, y, W - M + 8, y + hb), ed)
        d = DR(im)
        xr = tag(im, W - M - 16, y + 14, "داده")
        rt(d, xr - 4, y + 14, f"واکنش‌های گذشته به «{ev['name']}»", 23, "b", INK)
        para(d, W - M - 18, y + 58, txt, 21, width, "r", (222, 228, 238), lead=1.42, max_lines=3)
        y += hb + 12
    sec = f["security"]
    items = [f"{x['fa_t']} — {src_fa(x['src'])}، {stamp(x['date'], f['now'])}" for x in sec]
    if not items:
        items = ["در ۴۸ ساعت گذشته هک یا رخنهٔ مهمی در منابع خبری سایت ثبت نشده است."]
    items.append("پیش از اتصال کیف پول یا امضای تراکنش، نشانی سایت و قرارداد را دوباره بررسی کنید؛ "
                 "پیام‌های ناشناس «جایزه» و «ایردراپ» را باز نکنید.")
    reg = f["regulation"]
    h_reg = (56 + min(2, lines_of(reg["fa_t"], 21, width)) * 30 + 8) if reg else 0
    while len(items) > 1 and 62 + bullet_h(items, 21, width, max_lines=2, gap=6) + h_reg > CB - y:
        items = items[1:] if len(items) > 2 else items[1:]
    if 62 + bullet_h(items, 21, width, max_lines=2, gap=6) + h_reg > CB - y:
        reg, h_reg = None, 0
    panel(im, (M - 8, y, W - M + 8, CB), ed)
    d = DR(im)
    xr = tag(im, W - M - 16, y + 14, "هشدار")
    rt(d, xr - 4, y + 14, "هشدارهای امنیتی", 23, "b", INK)
    yy = bullets(d, W - M - 18, y + 58, items, 21, width, TAGC["هشدار"], (226, 232, 240), max_lines=2, gap=6)
    if reg:
        xr = tag(im, W - M - 16, yy + 4, "خبر")
        rt(d, xr - 4, yy + 4, "قانون‌گذاری", 22, "b", INK)
        lt(d, M + 12, yy + 8, f"{src_fa(reg['src'])} · {stamp(reg['date'], f['now'])}", 19, "m", DIM)
        para(d, W - M - 18, yy + 50, reg["fa_t"], 21, width, "r", (222, 228, 238), lead=1.42, max_lines=2)
    footer(im, ed)
    return im


def s_summary(base, f, tx):
    ed = f["edition"]
    c = ED[ed]
    im = base.copy()
    header(im, ed, 10, "جمع‌بندی و نقشهٔ راه", "سناریوها شرطی‌اند، نه پیش‌بینی قطعی", f)
    y = CT
    s_ = tx["summary"]
    hb = 66 + lines_of(s_, 27, W - 2 * M - 36, "m") * 41 + 10
    panel(im, (M - 8, y, W - M + 8, y + hb), ed, accent=True)
    d = DR(im)
    xr = tag(im, W - M - 16, y + 16, "تحلیل")
    rt(d, xr - 4, y + 16, "نتیجه‌گیری", 25, "b", INK)
    para(d, W - M - 18, y + 62, s_, 27, W - 2 * M - 36, "m", INK, lead=1.5, max_lines=5)
    y += hb + 12
    main, alt = main_scenario(f)
    half = (W - 2 * M - 18) / 2
    hs = 70 + max(lines_of(main, 23, half - 40), lines_of(alt, 23, half - 40)) * 34 + 6
    for side, (title, txt) in enumerate((("سناریوی اصلی", main), ("سناریوی جایگزین", alt))):
        x1 = W - M + 8 - side * (half + 18)
        x0 = x1 - half - 8
        panel(im, (x0, y, x1, y + hs), ed)
        d = DR(im)
        xr = tag(im, x1 - 16, y + 16, "سناریو")
        rt(d, xr - 4, y + 16, title, 24, "b", INK)
        para(d, x1 - 18, y + 62, txt, 23, half - 40, "r", (226, 232, 240), lead=1.45, max_lines=5)
    y += hs + 12
    # key levels
    L = f["btc"]["lv"]
    hb = 128
    panel(im, (M - 8, y, W - M + 8, y + hb), ed)
    d = DR(im)
    xr = tag(im, W - M - 16, y + 16, "داده")
    rt(d, xr - 4, y + 16, "سطوح کلیدی بیت‌کوین (دلار)", 24, "b", INK)
    cells = [("حمایت ۲", L["s2"], UP), ("حمایت ۱", L["s1"], UP), ("مقاومت ۱", L["r1"], DOWN), ("مقاومت ۲", L["r2"], DOWN)]
    cw = (W - 2 * M - 36) / 4
    for i, (lab, v, col) in enumerate(cells):
        cx = W - M - 18 - cw * i - cw / 2
        ct(d, cx, y + 60, lab, 21, "m", MUTED)
        num(d, cx, y + 86, fprice(v), 28, "k", col, anchor="c")
    y += hb + 12
    # watch list + council
    wl_ = watchlist(f)
    co = f.get("council")
    line_co = None
    if co:
        st = [a.get("stance") for a in (co.get("council") or {}).get("agents", [])]
        cnt = {k: st.count(k) for k in ("bearish", "bullish", "neutral")}
        line_co = (f"میزگرد تحلیلگران هوش مصنوعی سایت ({jday(parse_dt(co['at']))}): "
                   f"{fnum(cnt['bearish'])} نزولی، {fnum(cnt['bullish'])} صعودی، {fnum(cnt['neutral'])} خنثی")
    disc = DISCLAIMER
    avail = CB - y - 66 - 56 - (40 if line_co else 0)
    while wl_ and bullet_h(wl_, 23, W - 2 * M - 36, max_lines=2, gap=6) > avail:
        wl_ = wl_[:-1]
    hb = CB - y
    panel(im, (M - 8, y, W - M + 8, y + hb), ed)
    d = DR(im)
    rt(d, W - M - 18, y + 16, "زیر نظر داشته باشید", 25, "b", c["prim"])
    yy = bullets(d, W - M - 18, y + 62, wl_, 23, W - 2 * M - 36, c["prim"], (226, 232, 240), max_lines=2, gap=6)
    if line_co:
        xr = tag(im, W - M - 16, yy + 2, "تحلیل")
        para(d, xr - 6, yy + 4, line_co, 21, xr - M - 10, "r", MUTED, lead=1.4, max_lines=1)
        yy += 46
    d.line([(M + 10, CB - 62), (W - M - 10, CB - 62)], fill=(255, 255, 255, 26), width=1)
    tri(d, W - M - 30, CB - 34, True, 12, TAGC["هشدار"])
    para(d, W - M - 52, CB - 52, disc, 21, W - 2 * M - 70, "m", (250, 210, 210), lead=1.3, max_lines=1)
    footer(im, ed)
    return im


# =================================================================== 6. caption (Telegram) — Persian only, four hashtags
LATIN_FA = [("ETFهای", "صندوق‌های"), ("ETFها", "صندوق‌ها"), ("ETF", "صندوق"), ("BTC", "بیت‌کوین"), ("ETH", "اتریوم"),
            ("SEC", "کمیسیون بورس آمریکا"), ("CFTC", "کمیسیون معاملات آتی کالای آمریکا"), ("USDT", "تتر"),
            ("USDC", "یواس‌دی‌سی"), ("XRP", "ریپل"), ("SOL", "سولانا")]
DISCLAIMER = "این گزارش تحلیلی و آموزشی است، توصیهٔ خرید یا فروش نیست و هیچ سودی تضمین نمی‌شود."


def persian_only(s):
    """a caption line may carry no Latin letters (they flip Telegram's line direction): known terms are put in
    Persian, anything else Latin drops the line"""
    s = IC.clean(s)
    for lat, fa in LATIN_FA:
        s = re.sub(r"(?<![A-Za-z])" + lat + r"s?(?![A-Za-z])", fa, s)
    return None if LATIN.search(s) else s


def utf16(s):
    return len(s.encode("utf-16-le")) // 2


def visible(html_text):
    return re.sub(r"<[^>]+>", "", html_text).replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")


def hashtags(f):
    tags = ["#گزارش_صبحگاهی" if f["edition"] == "m" else "#گزارش_عصرگاهی", "#بیت_کوین"]
    pool = []
    if f["etf"] or abs((f["stable"]["now"] or 0) - (f["stable"]["then"] or f["stable"]["now"] or 0)) >= 0.15:
        pool.append("#جریان_سرمایه")
    mv = f.get("movers") or {}
    if any(abs(r["chg"]) >= 8 for k in ("up", "down") for r in mv.get(k, [])):
        pool.append("#آلت_کوین")
    if any(ev["impact"] == "High" and ev["date"] - f["now"] <= timedelta(hours=36) for ev in f["cal"]["up"]):
        pool.append("#اقتصاد_کلان")
    v = f["fng"]["v"] or 50
    if v <= 30 or v >= 70:
        pool.append("#ترس_و_طمع")
    if f["security"]:
        pool.append("#امنیت_رمزارز")
    pool += ["#بازار_رمزارز", "#تحلیل_بازار"]
    for t in pool:
        if t not in tags:
            tags.append(t)
        if len(tags) == 4:
            break
    return tags


def caption(f, tx, sig=""):
    """title, date and time, the market message, key points, risk warning, the invitation to swipe, the site
    address, exactly four hashtags — then the channel signature. Fits Telegram's 1024-character caption."""
    ed = f["edition"]
    b = f["btc"]
    L = lv(f)
    head = f"<b>📊 گزارش تصویری {EDITION[ed]['name']} بازار رمزارز</b>"
    when = f"🗓 {jdate(f['pub'])} · ⏰ {hm(f['pub'])} به وقت تهران"
    msg = "🧭 " + tx["headline"]
    pts = [f"💰 بیت‌کوین {fprice(b['price'])} دلار؛ {fpct(b['chg'])} {updown(b['chg'])} در ۲۴ ساعت · شاخص ترس و طمع "
           f"{fnum(f['fng']['v'] or 0)} ({fng_fa(f)})"]
    p = f.get("prev_delta")
    if p:
        pts.append(f"🔁 از {prev_label(f)} تاکنون: بیت‌کوین {fpct(p['btc'])} {updown(p['btc'])}")
    n_news = 0
    for x in f["news"]:
        t = persian_only(x["fa_t"])
        if t and n_news < 2:
            pts.append("📰 " + t)
            n_news += 1
    if f["etf"]:
        t = persian_only(f["etf"]["fa_t"])
        if t:
            pts.append("🏦 " + t)
    pts.append(f"🎯 سطوح کلیدی بیت‌کوین: حمایت {L['s1']} و مقاومت {L['r1']} دلار")
    for ev in f["cal"]["up"][:1]:
        pts.append(f"🗓 {ev['name']}: {stamp_future(ev['date'], f['now'])}")
    lead = tx.get("lead")
    tail = ["⚠️ " + DISCLAIMER,
            "👈 هر ۱۰ تصویر را ورق بزنید؛ از وضعیت کلی بازار تا نقشهٔ راه.",
            '🌐 <a href="https://entekhab.net/">سایت انتخاب؛ داده‌های زنده و ابزارهای تحلیلی</a>']
    tags = " ".join(hashtags(f))
    order = [0, 1, len(pts) - 1]                         # what is dropped last when the caption is too long

    def compose(points, with_lead):
        parts = [head, when, "", msg] + ([lead] if with_lead and lead else []) + [""] + points + [""] + tail + ["", tags]
        body = "\n".join(parts)
        return body + ("\n\n" + sig if sig else "")
    cur, with_lead = list(pts), True
    out = compose(cur, with_lead)
    while utf16(visible(out)) > 1000:
        if with_lead and lead:
            with_lead = False
        else:
            drop = next((i for i in range(len(cur) - 1, -1, -1) if pts.index(cur[i]) not in order), None)
            if drop is None:
                cur = cur[:-1]
            else:
                cur.pop(drop)
        out = compose(cur, with_lead)
    return out


def check_caption(cap, sig=""):
    p = []
    body = cap[: -len(sig)].rstrip() if sig and cap.endswith(sig) else cap
    vis = visible(cap)
    if utf16(vis) > 1024:
        p.append(f"کپشن {utf16(vis)} نویسه است؛ بیش از ۱۰۲۴")
    vb = visible(body)
    if LATIN.search(re.sub(r"https?://\S+", "", vb)):
        p.append("حروف لاتین در کپشن: " + "، ".join(sorted(set(re.findall(r"[A-Za-z]+", vb)))[:6]))
    tags = re.findall(r"#\S+", vb)
    if len(tags) != 4:
        p.append(f"{len(tags)} هشتگ به جای ۴")
    if not vb.strip().splitlines()[-1].startswith("#"):
        p.append("هشتگ‌ها خط آخر کپشن نیستند")
    if body.count("<b>") != body.count("</b>") or body.count("<a ") != body.count("</a>"):
        p.append("تگ‌های کپشن بسته نشده‌اند")
    if BANNED.search(vb.replace(DISCLAIMER, "")):
        p.append("واژهٔ تضمین یا توصیهٔ خرید و فروش در کپشن")
    for need in ("۱۰ تصویر", "entekhab.net", "توصیهٔ خرید یا فروش نیست"):
        if need not in body:
            p.append("کپشن این بخش را ندارد: " + need)
    return p


# =================================================================== 7. quality control before anything is posted
def qc(album, cap, sig=""):
    """the owner's checklist: exactly ten pictures, sound and readable, numbers from fresh sources, no repeats,
    a correct caption with exactly four hashtags. [] = ready to publish."""
    p = []
    f = album["f"]
    pics = album["pics"]
    if len(pics) != 10:
        p.append(f"{len(pics)} تصویر به جای ۱۰")
    if len({hashlib.md5(x).hexdigest() for x in pics}) != len(pics):
        p.append("دو تصویر یکسان‌اند")
    for i, b in enumerate(pics, 1):
        try:
            im = Image.open(io.BytesIO(b))
            im.verify()
            im = Image.open(io.BytesIO(b)).convert("L")
        except Exception as ex:
            p.append(f"تصویر {i} خراب است: {ex}")
            continue
        if im.size != (W, H):
            p.append(f"ابعاد تصویر {i} درست نیست: {im.size}")
        if not 60_000 < len(b) < 9_000_000:
            p.append(f"حجم تصویر {i} غیرعادی است ({len(b)} بایت)")
        hist = im.resize((108, 135)).histogram()
        lit = sum(hist[120:]) / max(1, sum(hist))
        if lit < 0.01:
            p.append(f"تصویر {i} تقریباً خالی است")
    now = f["now"]
    if not f["market_at"] or now - f["market_at"] > timedelta(hours=6):
        p.append("دادهٔ بازار سایت بیش از شش ساعت کهنه است")
    if f["btc_gap"] is not None and f["btc_gap"] > 2.5:
        p.append(f"قیمت بیت‌کوین سایت و بایننس {f['btc_gap']:.1f} درصد اختلاف دارد")
    newest = max((x["date"] for x in f["pool"]), default=None)
    if not newest or now - newest > timedelta(hours=8):
        p.append("خبر تازه‌تر از هشت ساعت پیدا نشد؛ خوراک خبر متوقف به نظر می‌رسد")
    ids = [x["id"] for x in f["news"]]
    if len(set(ids)) != len(ids):
        p.append("یک خبر دو بار آمده است")
    used = set((f.get("prev") or {}).get("news_ids") or [])
    if used & set(ids):
        p.append("خبری از نوبت قبل تکرار شده است")
    b = f["btc"]
    L = b["lv"]
    if not (L["s2"] < L["s1"] < b["price"] < L["r1"] < L["r2"]):
        p.append("ترتیب سطوح حمایت و مقاومت درست نیست")
    p += check_caption(cap, sig)
    return p


# =================================================================== 8. build
SLIDES = [s_cover, s_market, s_news, s_btc, s_alts, s_flows, s_macro, s_opps, s_calendar, s_summary]


def build(now=None, edition=None, prev=None, use_ai=True, sig="", pub=None):
    """gather → write → draw → caption → check. Returns {"pics", "f", "tx", "caption", "problems"}"""
    now = now or datetime.now(timezone.utc)
    edition = edition or ("m" if teh(now).hour < 13 else "e")
    if IC.mode() != "raqm":         # the fallback shaper mirrors brackets and drops «ٔ»: never publish with it
        raise AlbumError("موتور کامل چیدمان متن فارسی (raqm) در دسترس نیست؛ تصویرها ساخته نشد")
    f = gather(now, edition, prev)
    f["pub"] = pub or now
    pt = parse_dt((prev or {}).get("at"))
    if prev and prev.get("btc") and pt and timedelta(0) < now - pt < timedelta(hours=16):
        f["prev_delta"] = {"btc": (f["btc"]["price"] / prev["btc"] - 1) * 100,
                           "eth": (f["eth"]["price"] / prev["eth"] - 1) * 100 if prev.get("eth") and f["eth"] else None,
                           "mcap": (f["global"]["mcap"] / prev["mcap"] - 1) * 100 if prev.get("mcap") else None}
    big = sorted([u for u in f["universe"] if u["qv"] >= 5e6], key=lambda u: u["chg"])
    prefetch_logos([u["sym"] for u in big[:10] + big[-10:]] + [o["coin"] for o in f["opps"][:10]])
    f["movers"] = movers(f)
    tx = write(f, use_ai)
    base = backdrop(edition)
    pics = []
    for i, fn in enumerate(SLIDES, 1):
        _INK.update(max=0, content=0)
        im = fn(base, f, tx)
        if _INK["content"] > CB + 6:
            raise AlbumError(f"محتوای تصویر {i} به نوار پایین رسیده است")
        buf = io.BytesIO()
        im.convert("RGB").save(buf, "JPEG", quality=90, optimize=True, progressive=True, subsampling=0)
        pics.append(buf.getvalue())
    album = {"pics": pics, "f": f, "tx": tx}
    album["caption"] = caption(f, tx, sig)
    album["problems"] = qc(album, album["caption"], sig)
    return album


def snapshot(album, slot_key):
    """what the next edition needs from this one"""
    f = album["f"]
    return {"slot": slot_key, "at": f["now"].isoformat(), "pub": f["pub"].isoformat(), "btc": f["btc"]["price"],
            "eth": f["eth"]["price"] if f["eth"] else None, "mcap": f["global"]["mcap"],
            "fng": f["fng"]["v"], "news_ids": [x["id"] for x in f["news"]] + ([f["etf"]["id"]] if f["etf"] else [])}


def preview(out, slot="m", use_ai=True):
    os.makedirs(out, exist_ok=True)
    now = parse_dt(os.environ["ALBUM_NOW"]) if os.environ.get("ALBUM_NOW") else None
    t0 = time.time()
    try:
        from bot_videos import SIG
    except Exception:
        SIG = ""
    prev = json.loads(os.environ["ALBUM_PREV"]) if os.environ.get("ALBUM_PREV") else None
    a = build(now, slot, prev=prev, use_ai=use_ai, sig=SIG)
    for i, p in enumerate(a["pics"], 1):
        open(os.path.join(out, f"{i:02d}.jpg"), "wb").write(p)
    open(os.path.join(out, "caption.html"), "w").write(a["caption"])
    rep = {"seconds": round(time.time() - t0, 1), "ai": a["tx"]["ai"], "problems": a["problems"],
           "caption_utf16": utf16(visible(a["caption"])), "shaping": IC.mode(),
           "movers_skipped": a["f"]["movers"].get("skipped"), "news": [x["fa_t"] for x in a["f"]["news"]],
           "headline": a["tx"]["headline"], "summary": a["tx"]["summary"],
           "news_texts": a["tx"]["news"], "snapshot": snapshot(a, slot)}
    json.dump(rep, open(os.path.join(out, "report.json"), "w"), ensure_ascii=False, indent=1, default=str)
    print(json.dumps({k: rep[k] for k in ("seconds", "ai", "problems", "caption_utf16", "shaping", "movers_skipped")},
                     ensure_ascii=False))
    return 0


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
