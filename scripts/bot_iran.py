"""
Iranian market data for the bot: tether (USDT) on Iranian exchanges, the free-market
dollar and other currencies/gold/coins in toman.

Sources are public Telegram channels, read through their web preview (t.me/s/<name>),
the same way scripts/fetch.py reads Coin_Kurd:
  @ttprice         every ~5 min: USDT buy/sell per Iranian exchange, free USD (Tehran, Herat,
                   remittance), EUR/GBP/AED/TRY/…, gold coins, gold, BTC/ETH in USDT
  @NerkhDollarIRT  Tehran dollar buy/sell ticks (every few minutes)
  @USDTTetherp     USDT buy/sell ticks (every few seconds-minutes)
The bot always shows each source's own post time so users see how fresh a number is.
"""
import re
import time
from datetime import datetime, timedelta, timezone

import requests
from bs4 import BeautifulSoup

from bot_i18n import pick

UA = {"User-Agent": "Mozilla/5.0 (compatible; CoinKurdBot/1.0; +https://entekhab.net)"}
TTL = 60
_cache = {}

import rtlfmt as B  # noqa: E402  (isolate helpers: see scripts/rtlfmt.py; must NOT be named bidi.py — that shadows python-bidi)

FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩٫", "01234567890123456789.")


def num(s):
    s = (s or "").translate(FA_DIGITS).replace(",", "").replace("٬", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


# ------------------------------------------------------------------ channel reader
def _fetch_channel(name):
    """-> [{"iso", "text", "id", "links"}] oldest→newest for the last ~20 posts; cached TTL s."""
    ent = _cache.get(name)
    if ent and time.time() - ent[0] < TTL:
        return ent[1]
    posts = []
    try:
        r = requests.get(f"https://t.me/s/{name}", headers=UA, timeout=20)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        for m in soup.select(".tgme_widget_message"):
            body = m.select_one(".tgme_widget_message_text")
            tm = m.select_one("time")
            if not body or not tm:
                continue
            links = [a.get("href") for a in body.find_all("a") if (a.get("href") or "").startswith("http")]
            for br in body.find_all("br"):
                br.replace_with("\n")
            photos = []
            for ph in m.select(".tgme_widget_message_photo_wrap, .tgme_widget_message_video_thumb"):
                mm = re.search(r"url\('?\"?([^'\")]+)'?\"?\)", ph.get("style", ""))
                if mm:
                    photos.append(mm.group(1))
            dp = m.get("data-post") or ""
            pid = int(dp.rsplit("/", 1)[-1]) if dp.rsplit("/", 1)[-1].isdigit() else 0
            posts.append({"iso": tm.get("datetime"), "text": body.get_text(), "id": pid, "links": links, "photos": photos})
    except Exception:
        posts = ent[1] if ent else []
    _cache[name] = (time.time(), posts)
    return posts


def read_channel(name):
    """-> list of (iso_time, text) oldest→newest"""
    return [(p["iso"], p["text"]) for p in _fetch_channel(name)]


def read_channel_full(name):
    """-> list of (iso_time, text, post_id, links, photos) oldest→newest"""
    return [(p["iso"], p["text"], p["id"], p["links"], p.get("photos", [])) for p in _fetch_channel(name)]


def _strip(line):
    return re.sub(r"[‎‏‪-‮]", "", line).strip()


# ------------------------------------------------------------------ parsers
FIAT_KEYS = {  # label in ttprice -> key
    "دلار آمریکا تهران": "USD", "دلار آمریکا هرات": "USD_HERAT", "دلار آمریکا حواله": "USD_REMIT",
    "یورو اروپا": "EUR", "پوند انگلیس": "GBP", "درهم امارات": "AED", "ریال عمان": "OMR",
    "لیر ترکیه": "TRY", "حواله لیر ترکیه": "TRY_REMIT", "دلار کانادا": "CAD", "یوان چین": "CNY",
    "روبل روسیه": "RUB", "دلار استرالیا": "AUD",
    "سکه امامی": "COIN_EMAMI", "سکه بهار": "COIN_BAHAR", "نیـم سکه": "COIN_HALF", "نیم سکه": "COIN_HALF",
    "ربـع سکه": "COIN_QUARTER", "ربع سکه": "COIN_QUARTER", "سکه گرمی": "COIN_GRAM",
    "مثقال طلا آبشده": "GOLD_MESGHAL", "۱گرم طلا۱۸عیار": "GOLD_18", "اونس جهانی طلا": "XAU", "اونس جهانی نقره": "XAG",
}


def parse_ttprice(text):
    out = {"exchanges": [], "fiat": {}, "crypto": {}}
    for raw in text.split("\n"):
        line = _strip(raw)
        if not line:
            continue
        m = re.match(r"^([\d,]+)\s*[▫️▪️]*\s*\|\s*([\d,]+)\s*[▫️▪️]*\s*\|\s*(.+)$", line)
        if m:
            name = m.group(3).strip()
            sanc = "تحریم" in name
            name = name.split("—")[0].strip()
            out["exchanges"].append({"name": name, "buy": num(m.group(1)), "sell": num(m.group(2)), "sanctioned": sanc})
            continue
        m = re.search(r"قیمت دلار آزاد\s*:\s*([\d,]+)", line)
        if m:
            out["free_usd"] = num(m.group(1))
            continue
        m = re.search(r"(بیتکوین|اتریوم|سولانا|ترون)\s*:\s*([\d,.]+)\s*تتر", line)
        if m:
            out["crypto"][{"بیتکوین": "BTC", "اتریوم": "ETH", "سولانا": "SOL", "ترون": "TRX"}[m.group(1)]] = num(m.group(2))
            continue
        m = re.search(r"اسپرد برای آربیتراژ\s*:\s*([\d,]+)", line)
        if m:
            out["spread"] = num(m.group(1))
            continue
        for label, key in sorted(FIAT_KEYS.items(), key=lambda kv: -len(kv[0])):
            if label in line:
                m = re.search(re.escape(label) + r"\s*:\s*([\d,.]+)[^\[]*(?:\[\s*([^\]]+)\])?", line)
                if m:
                    chg = None
                    if m.group(2):
                        g = m.group(2).translate(FA_DIGITS).replace("٪", "").replace("%", "").strip()
                        sign = -1 if g.endswith("-") or g.startswith("-") else 1
                        chg = num(g.strip("+-"))
                        chg = sign * chg if chg is not None else None
                    out["fiat"][key] = (num(m.group(1)), chg)
                break
    return out


def ttprice():
    """latest full price board from @ttprice, or None"""
    for t, text in reversed(read_channel("ttprice")):
        if "دلار آمریکا تهران" in text or "صرافی های ایرانی" in text:
            d = parse_ttprice(text)
            if d["exchanges"] or d["fiat"]:
                d["time"] = t
                return d
    return None


TICK_RE = {
    "NerkhDollarIRT": re.compile(r"دلار تهران[^\d]*([\d,]+)\s*(خرید|فروش)"),
    "USDTTetherp": re.compile(r"تتر\s*\[?USDT\]?\s*([\d,]+)\s*(خرید|فروش)"),
}


def ticks(channel):
    """-> {"buy": (price, iso), "sell": (price, iso), "series": [(iso, price)]} from the latest posts"""
    out, series = {}, []
    rx = TICK_RE[channel]
    for t, text in read_channel(channel):
        m = rx.search(_strip(text))
        if not m:
            continue
        p = num(m.group(1))
        side = "buy" if m.group(2) == "خرید" else "sell"
        out[side] = (p, t)
        series.append((t, p))
    out["series"] = series
    return out


# ------------------------------------------------------------------ derived numbers
def snapshot():
    """Everything the bot needs, merged. Prices in toman."""
    tt = ttprice() or {}
    nd = ticks("NerkhDollarIRT")
    ut = ticks("USDTTetherp")
    ex = [e for e in tt.get("exchanges", []) if e["buy"] and e["sell"]]
    snap = {"tt": tt, "nerkh": nd, "usdtp": ut, "exchanges": ex}
    # tether: prefer the newest tick, else mid of exchange board
    usdt_ticks = [v for k, v in ut.items() if k in ("buy", "sell") and v[0]]
    if usdt_ticks:
        snap["usdt"] = sum(p for p, _ in usdt_ticks) / len(usdt_ticks)
        snap["usdt_time"] = max(t for _, t in usdt_ticks)
    elif ex:
        snap["usdt"] = sum((e["buy"] + e["sell"]) / 2 for e in ex) / len(ex)
        snap["usdt_time"] = tt.get("time")
    usd_ticks = [v for k, v in nd.items() if k in ("buy", "sell") and v[0]]
    if usd_ticks:
        snap["usd"] = sum(p for p, _ in usd_ticks) / len(usd_ticks)
        snap["usd_time"] = max(t for _, t in usd_ticks)
    elif tt.get("fiat", {}).get("USD"):
        snap["usd"] = tt["fiat"]["USD"][0]
        snap["usd_time"] = tt.get("time")
    if ex:
        best_buy_from = min(ex, key=lambda e: e["sell"])     # cheapest place to buy USDT
        best_sell_to = max(ex, key=lambda e: e["buy"])       # best place to sell USDT
        snap["best_buy_from"], snap["best_sell_to"] = best_buy_from, best_sell_to
        snap["arb_toman"] = best_sell_to["buy"] - best_buy_from["sell"]
        snap["arb_pct"] = snap["arb_toman"] / best_buy_from["sell"] * 100
    if snap.get("usdt") and snap.get("usd"):
        snap["bubble_pct"] = (snap["usdt"] / snap["usd"] - 1) * 100
    return snap


def toman(x):
    # Isolated so the grouping commas cannot drag the figure around inside an
    # RTL line. B.n(x) is the bare number for use inside B.pair()/B.iso().
    return "—" if x is None else B.amount(x)


def ago(iso):
    try:
        dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        m = int((datetime.now(timezone.utc) - dt).total_seconds() // 60)
        return B.iso(f"{max(m, 0)}′")
    except Exception:
        return "?"


# ------------------------------------------------------------------ asset aliases for alerts
ASSETS = {
    "USDT": ["usdt", "تتر", "tether", "تەتەر"],
    "USD": ["usd", "دلار", "dollar", "دۆلار"],
    "EUR": ["eur", "یورو", "euro"],
    "GBP": ["gbp", "پوند"],
    "AED": ["aed", "درهم", "dirham"],
    "TRY": ["try", "لیر"],
    "COIN_EMAMI": ["سکه", "emami", "sekke", "coin_emami"],
    "GOLD_18": ["طلا", "gold18", "طلا۱۸"],
    "GOLD_MESGHAL": ["مثقال", "mesghal"],
}
ASSET_NAME = {
    "USDT": {"fa": "تتر", "ckb": "تەتەر", "en": "USDT"},
    "USD": {"fa": "دلار تهران", "ckb": "دۆلاری تاران", "en": "USD (Tehran)"},
    "USD_HERAT": {"fa": "دلار هرات", "ckb": "دۆلاری هەرات", "en": "USD (Herat)"},
    "USD_REMIT": {"fa": "دلار حواله", "ckb": "دۆلاری حەواڵە", "en": "USD (remittance)"},
    "EUR": {"fa": "یورو", "ckb": "یۆرۆ", "en": "EUR"},
    "GBP": {"fa": "پوند", "ckb": "پاوەند", "en": "GBP"},
    "AED": {"fa": "درهم", "ckb": "دەرهەم", "en": "AED"},
    "OMR": {"fa": "ریال عمان", "ckb": "ڕیاڵی عومان", "en": "OMR"},
    "TRY": {"fa": "لیر", "ckb": "لیرە", "en": "TRY"},
    "TRY_REMIT": {"fa": "حوالهٔ لیر", "ckb": "حەواڵەی لیرە", "en": "TRY remit"},
    "CAD": {"fa": "دلار کانادا", "ckb": "دۆلاری کەنەدا", "en": "CAD"},
    "CNY": {"fa": "یوان", "ckb": "یوان", "en": "CNY"},
    "RUB": {"fa": "روبل", "ckb": "ڕۆبڵ", "en": "RUB"},
    "AUD": {"fa": "دلار استرالیا", "ckb": "دۆلاری ئوسترالیا", "en": "AUD"},
    "COIN_EMAMI": {"fa": "سکه امامی", "ckb": "زێڕی ئیمامی", "en": "Emami coin"},
    "COIN_BAHAR": {"fa": "سکه بهار", "ckb": "زێڕی بەهار", "en": "Bahar coin"},
    "COIN_HALF": {"fa": "نیم سکه", "ckb": "نیو سکە", "en": "Half coin"},
    "COIN_QUARTER": {"fa": "ربع سکه", "ckb": "چارەک سکە", "en": "Quarter coin"},
    "COIN_GRAM": {"fa": "سکه گرمی", "ckb": "سکەی گرامی", "en": "Gram coin"},
    "GOLD_MESGHAL": {"fa": "مثقال طلا", "ckb": "مسقاڵ زێڕ", "en": "Gold mesghal"},
    "GOLD_18": {"fa": "طلای ۱۸ (گرم)", "ckb": "زێڕی ١٨ (گرام)", "en": "18k gold /g"},
    "XAU": {"fa": "اونس طلا ($)", "ckb": "ئۆنسی زێڕ ($)", "en": "Gold oz ($)"},
    "XAG": {"fa": "اونس نقره ($)", "ckb": "ئۆنسی زیو ($)", "en": "Silver oz ($)"},
}


def resolve_asset(word):
    w = (word or "").lower().strip()
    for key, aliases in ASSETS.items():
        if w == key.lower() or w in aliases:
            return key
    return None


def asset_price(key, snap=None):
    """toman price of an Iranian asset, or None"""
    snap = snap or snapshot()
    if key == "USDT":
        return snap.get("usdt")
    if key == "USD":
        return snap.get("usd")
    v = snap.get("tt", {}).get("fiat", {}).get(key)
    return v[0] if v else None


# ------------------------------------------------------------------ messages
L3 = lambda d, lang: pick(d, lang)

# ------------------------------------------------------------------ crypto
# @ttprice already carries these four in tether; parse_ttprice() fills
# snap["tt"]["crypto"]. Toman is derived, not quoted: the coin's USDT price x the
# Iranian tether rate, which is what an Iranian actually pays.
CRYPTO_ORDER = ["BTC", "ETH", "SOL", "TRX"]
CRYPTO_ICON = {"BTC": "🟠", "ETH": "🔷", "SOL": "🟣", "TRX": "🔶"}
CRYPTO_NAME = {
    "BTC": {"fa": "بیت‌کوین", "ckb": "بیتکۆین", "en": "Bitcoin"},
    "ETH": {"fa": "اتریوم", "ckb": "ئیتریۆم", "en": "Ethereum"},
    "SOL": {"fa": "سولانا", "ckb": "سۆلانا", "en": "Solana"},
    "TRX": {"fa": "ترون", "ckb": "ترۆن", "en": "Tron"},
}


def _cdec(p):
    """Decimals for a coin price: none for big ones, 4 for sub-dollar (TRX)."""
    return 0 if p >= 1000 else (2 if p >= 1 else 4)


def crypto_prices(s):
    """[(key, usdt_price)] for the coins @ttprice carries, in a fixed order."""
    cr = (s.get("tt") or {}).get("crypto") or {}
    return [(k, cr[k]) for k in CRYPTO_ORDER if cr.get(k)]


def crypto_row(k, p, lang, rate):
    """One coin line, in tether and - when the tether rate is known - in toman.

    Both figures and the separator between them sit inside ONE isolate, for the
    same reason as the buy|sell rows: a neutral separator between two LTR
    numbers in an RTL line can otherwise swap the two columns.
    """
    body = f"{B.n(p, _cdec(p))} USDT"
    if rate:
        body += f" · {B.n(p * rate, 0)}"
    return f"{CRYPTO_ICON.get(k, '•')} {L3(CRYPTO_NAME[k], lang)} ➜ <b>{B.iso(body)}</b>"


EX_LATIN = {"والکس": "Wallex", "بیت‌پین": "Bitpin", "بیت پین": "Bitpin", "رمزینکس": "Ramzinex", "تبدیل": "Tabdil",
            "نوبیتکس": "Nobitex", "موربیت": "Morbit", "افکس": "Afex", "آبان‌تتر": "AbanTether", "آبان تتر": "AbanTether",
            "تترلند": "Tetherland", "اکسیر": "Exir", "رمزارز۲۴": "Ramzarz24", "بیت۲۴": "Bit24"}


def exname(name, lang):
    """Latin exchange names for Latin-script languages"""
    return EX_LATIN.get(name, name) if lang in ("kmr", "en") else name


def card(lang, focus=None):
    s = snapshot()
    tt = s.get("tt", {})
    ex = s.get("exchanges", [])
    if not (s.get("usdt") or s.get("usd") or ex):
        return pick({"fa": "منابع قیمت دلار و تتر فعلاً در دسترس نیستند؛ چند دقیقهٔ دیگر امتحان کن.",
                "ckb": "سەرچاوەکانی نرخی دۆلار و تەتەر ئێستا بەردەست نین؛ چەند خولەکی تر هەوڵ بدەرەوە.",
                "en": "Dollar/tether sources are unavailable right now; try again shortly."}, lang)
    T = lambda fa, ckb, en, kmr=None: pick({"fa": fa, "ckb": ckb, "en": en, "kmr": kmr}, lang)
    out = [T("💵 <b>دلار و تتر — بازار ایران</b> (تومان)", "💵 <b>دۆلار و تەتەر — بازاڕی ئێران</b> (تمەن)",
             "💵 <b>Dollar &amp; tether — Iran market</b> (toman)"), ""]
    ut, nd = s.get("usdtp", {}), s.get("nerkh", {})
    if ut.get("buy") or ut.get("sell"):
        b, se = ut.get("buy", (None, None)), ut.get("sell", (None, None))
        out.append(f"🟢 <b>{T('تتر', 'تەتەر', 'USDT')}</b>: {T('خرید', 'کڕین', 'buy')} {toman(b[0])} · "
                   f"{T('فروش', 'فرۆشتن', 'sell')} {toman(se[0])}  <i>({ago(s.get('usdt_time'))})</i>")
    elif s.get("usdt"):
        out.append(f"🟢 <b>{T('تتر', 'تەتەر', 'USDT')}</b>: {toman(s['usdt'])}  <i>({ago(s.get('usdt_time'))})</i>")
    if nd.get("buy") or nd.get("sell"):
        b, se = nd.get("buy", (None, None)), nd.get("sell", (None, None))
        out.append(f"🇺🇸 <b>{T('دلار تهران', 'دۆلاری تاران', 'USD Tehran')}</b>: {T('خرید', 'کڕین', 'buy')} {toman(b[0])} · "
                   f"{T('فروش', 'فرۆشتن', 'sell')} {toman(se[0])}  <i>({ago(s.get('usd_time'))})</i>")
    elif s.get("usd"):
        out.append(f"🇺🇸 <b>{T('دلار تهران', 'دۆلاری تاران', 'USD Tehran')}</b>: {toman(s['usd'])}")
    if s.get("bubble_pct") is not None:
        bp = s["bubble_pct"]
        out.append(f"🫧 {T('حباب تتر نسبت به دلار آزاد', 'بڵقی تەتەر بەراورد بە دۆلاری ئازاد', 'Tether premium vs cash USD')}: "
                   f"<b>{B.pct(bp)}</b>")
    if ex:
        out += ["", T("🏦 <b>نرخ تتر در صرافی‌ها</b>", "🏦 <b>نرخی تەتەر لە ئاڵوگۆڕەکان</b>", "🏦 <b>USDT on Iranian exchanges</b>"),
                T("<i>خرید = صرافی از تو می‌خرد · فروش = صرافی به تو می‌فروشد</i>",
                  "<i>کڕین = ئاڵوگۆڕ لێت دەکڕێت · فرۆشتن = پێت دەفرۆشێت</i>",
                  "<i>buy = exchange buys from you · sell = exchange sells to you</i>")]
        for e in sorted(ex, key=lambda e: e["sell"]):
            flag = " ⚠️" if e["sanctioned"] else ""
            # buy | sell as a single isolated run: the separator can no
            # longer swap the two columns around inside an RTL line.
            out.append(f"• {exname(e['name'], lang)}{flag}: "
                       + B.pair(e['buy'], e['sell'], bold_b=True))
        if s.get("arb_toman") is not None:
            bb, bs = s["best_buy_from"], s["best_sell_to"]
            out.append(T(f"🔁 آربیتراژ: خرید از {exname(bb['name'], lang)} ({toman(bb['sell'])}) → فروش به {exname(bs['name'], lang)} ({toman(bs['buy'])}) = "
                         f"<b>{toman(s['arb_toman'])}</b> تومان ({B.pct(s['arb_pct'])}) قبل از کارمزد",
                         f"🔁 ئاربیتراژ: کڕین لە {exname(bb['name'], lang)} ({toman(bb['sell'])}) → فرۆشتن بە {exname(bs['name'], lang)} ({toman(bs['buy'])}) = "
                         f"<b>{toman(s['arb_toman'])}</b> تمەن ({B.pct(s['arb_pct'])}) پێش کرێ",
                         f"🔁 Arbitrage: buy at {exname(bb['name'], lang)} ({toman(bb['sell'])}) → sell at {exname(bs['name'], lang)} ({toman(bs['buy'])}) = "
                         f"<b>{toman(s['arb_toman'])}</b> ({B.pct(s['arb_pct'])}) before fees",
                         f"🔁 Arbîtraj: ji {exname(bb['name'], lang)} bikire ({toman(bb['sell'])}) → li {exname(bs['name'], lang)} bifiroşe ({toman(bs['buy'])}) = "
                         f"<b>{toman(s['arb_toman'])}</b> tomen ({B.pct(s['arb_pct'])}) berî heqê bazirganiyê"))
        if any(e["sanctioned"] for e in ex):
            out.append(T("⚠️ = تحت تحریم؛ خطر مسدود شدن کیف پول.", "⚠️ = لە ژێر سزادا؛ مەترسی بلۆککردنی جزدان.",
                         "⚠️ = under sanctions; wallet-freeze risk."))
    cr = crypto_prices(s)
    if cr:
        out += ["", T("💰 <b>کریپتو</b> (تتر · تومان)",
                      "💰 <b>کریپتۆ</b> (تەتەر · تمەن)",
                      "💰 <b>Crypto</b> (USDT · toman)")]
        for k, p in cr:
            out.append(crypto_row(k, p, lang, s.get("usdt")))
    fiat = tt.get("fiat", {})
    if fiat:
        out += ["", T("💱 <b>ارز، سکه و طلا</b>", "💱 <b>دراو، سکە و زێڕ</b>", "💱 <b>FX, coins &amp; gold</b>")]
        order = ["USD_HERAT", "USD_REMIT", "EUR", "GBP", "AED", "TRY", "CNY", "COIN_EMAMI", "COIN_HALF",
                 "COIN_QUARTER", "GOLD_18", "GOLD_MESGHAL", "XAU"]
        if focus and focus in fiat and focus not in order[:3]:
            order.insert(0, focus)
        for k in order:
            if k in fiat and fiat[k][0]:
                p, ch = fiat[k]
                chs = f" ({B.pct(ch)})" if ch else ""
                val = B.usd(p) if k in ("XAU", "XAG") else toman(p)
                out.append(f"• {L3(ASSET_NAME[k], lang)}: {val}{chs}")
    return "\n".join(out)


def calc(lang, amount, unit):
    """unit: 'toman' (how much USDT can I buy) or 'usdt' (how much toman if I sell)"""
    s = snapshot()
    ex = s.get("exchanges", [])
    T = lambda fa, ckb, en, kmr=None: pick({"fa": fa, "ckb": ckb, "en": en, "kmr": kmr}, lang)
    if not ex and not s.get("usdt"):
        return T("قیمت تتر فعلاً در دسترس نیست.", "نرخی تەتەر ئێستا بەردەست نییە.", "Tether price unavailable.")
    out = [T("🧮 <b>ماشین‌حساب تتر</b>", "🧮 <b>ژمێرەری تەتەر</b>", "🧮 <b>Tether calculator</b>"), ""]
    if unit == "toman":
        out.append(T(f"با {toman(amount)} تومان می‌توانی بخری:", f"بە {toman(amount)} تمەن دەتوانیت بکڕیت:",
                     f"With {toman(amount)} toman you can buy:", f"Bi {toman(amount)} tomenan dikarî bikirî:"))
        rows = sorted(ex, key=lambda e: e["sell"]) or [{"name": "~", "sell": s["usdt"]}]
        for e in rows[:6]:
            out.append(f"• {exname(e['name'], lang)}: <b>{B.amount(amount / e['sell'], 2)}</b> USDT")
    else:
        out.append(T(f"فروش {B.amount(amount, 2)} تتر:", f"فرۆشتنی {B.amount(amount, 2)} تەتەر:", f"Selling {B.amount(amount, 2)} USDT:", f"Firotina {B.amount(amount, 2)} tetherê:"))
        rows = sorted(ex, key=lambda e: -e["buy"]) or [{"name": "~", "buy": s["usdt"]}]
        for e in rows[:6]:
            out.append(f"• {exname(e['name'], lang)}: <b>{toman(amount * e['buy'])}</b> {T('تومان', 'تمەن', 'toman')}")
    out += ["", T("⚠️ کارمزد معامله و کارمزد شبکهٔ انتقال (TRC20/TON/BEP20…) هر صرافی جداست و در این عدد کم نشده؛ قبل از معامله در خود صرافی چک کن.",
                  "⚠️ کرێی مامەڵە و کرێی تۆڕی گواستنەوە لێرە کەم نەکراوەتەوە؛ پێش مامەڵە لە ئاڵوگۆڕەکە بیپشکنە.",
                  "⚠️ Trading and network (TRC20/TON/BEP20…) fees differ per exchange and are not deducted here.")]
    return "\n".join(out)


# ------------------------------------------------------------------ the "تبدیل ارز" topic card (group)
BOARD_ICON = {"USD_HERAT": "🇦🇫", "USD_REMIT": "🏦", "EUR": "🇪🇺", "GBP": "🇬🇧", "AED": "🇦🇪", "TRY": "🇹🇷",
              "CNY": "🇨🇳", "COIN_EMAMI": "🪙", "COIN_HALF": "🪙", "COIN_QUARTER": "🪙", "GOLD_18": "📿",
              "GOLD_MESGHAL": "⚖️", "XAU": "🌕"}


def _move(now, before):
    """🔺 / 🔻 / ▫️ against the previous card"""
    if not now or not before:
        return ""
    d = (now / before - 1) * 100
    if abs(d) < 0.05:
        return " ▫️"
    return " " + B.pct(d, arrow="🔺" if d > 0 else "🔻")


BL = {  # board labels: fa, ckb, en (kmr falls back to en)
    "title": ("💎 <b>تابلوی ارز کوین کورد</b> 💎", "💎 <b>تابلۆی دراوی کۆین کورد</b> 💎", "💎 <b>Coin Kurd FX board</b> 💎"),
    "time": ("🕰 ساعت {t} به وقت تهران · قیمت‌ها به تومان", "🕰 کاتژمێر {t}ی تاران · نرخەکان بە تمەن", "🕰 {t} Tehran time · prices in toman"),
    "usd_usdt": ("💵 <b>دلار و تتر</b>", "💵 <b>دۆلار و تەتەر</b>", "💵 <b>Dollar &amp; tether</b>"),
    "usdt": ("تتر", "تەتەر", "USDT"),
    "usd": ("دلار تهران", "دۆلاری تاران", "USD Tehran"),
    "buy": ("خرید", "کڕین", "buy"), "sell": ("فروش", "فرۆشتن", "sell"),
    "bubble": ("حباب تتر نسبت به دلار", "بڵقی تەتەر بەرامبەر دۆلار", "Tether premium vs USD"),
    "ex": ("🏦 <b>ارزان‌ترین تتر در صرافی‌ها</b>", "🏦 <b>هەرزانترین تەتەر لە ئاڵوگۆڕەکان</b>", "🏦 <b>Cheapest USDT on exchanges</b>"),
    "arb": ("🔁 سود آربیتراژ بین صرافی‌ها (قبل از کارمزد): <b>{a}</b> تومان ({p})", "🔁 قازانجی ئاربیتراژ (پێش کرێ): <b>{a}</b> تمەن ({p})",
            "🔁 Arbitrage between exchanges (before fees): <b>{a}</b> toman ({p})"),
    "crypto": ("💰 <b>کریپتو</b> (تتر · تومان)", "💰 <b>کریپتۆ</b> (تەتەر · تمەن)",
               "💰 <b>Crypto</b> (USDT · toman)"),
    "fx": ("💱 <b>ارزها</b>", "💱 <b>دراوەکان</b>", "💱 <b>Currencies</b>"),
    "gold": ("🏅 <b>سکه و طلا</b>", "🏅 <b>سکە و زێڕ</b>", "🏅 <b>Coins &amp; gold</b>"),
    "legend": ("🔺🔻 تغییر نسبت به تابلوی قبلی · 🟢🔴 تغییر روزانه", "🔺🔻 گۆڕان بەراورد بە پێشوو · 🟢🔴 گۆڕانی ڕۆژانە",
               "🔺🔻 change vs previous board · 🟢🔴 daily change"),
    "bot": ("🤖 قیمت لحظه‌ای و هشدار قیمت: @Kurd_kurdistan_bot", "🤖 نرخی ڕاستەوخۆ و ئاگاداری نرخ: @Kurd_kurdistan_bot",
            "🤖 Live prices &amp; alerts: @Kurd_kurdistan_bot"),
    "warn": ("⚠️ = صرافی تحت تحریم", "⚠️ = ئاڵوگۆڕی ژێر سزا", "⚠️ = sanctioned exchange"),
}
_BOT_PREV = {"t": 0, "vals": {}, "cur": {}}


def bl(k, lang, **kw):
    i = {"fa": 0, "ckb": 1}.get(lang, 2)
    return BL[k][i].format(**kw) if kw else BL[k][i]


def board(prev=None, lang="fa", footer=True):
    """-> (html, values) — price board (group FX topic and the bot); prev = values of the previous board"""
    prev = prev or {}
    s = snapshot()
    tt, ex = s.get("tt", {}), s.get("exchanges", [])
    if not (s.get("usdt") or s.get("usd") or ex):
        return None, prev
    vals = {}
    tehran = datetime.now(timezone.utc) + timedelta(hours=3, minutes=30)
    out = [bl("title", lang), bl("time", lang, t=B.iso(f"{tehran:%H:%M}")), "━━━━━━━━━━━━━━", bl("usd_usdt", lang)]
    ut, nd = s.get("usdtp", {}), s.get("nerkh", {})
    usdt = (ut.get("sell") or (None,))[0] or s.get("usdt")
    if usdt:
        vals["usdt"] = usdt
        buy = (ut.get("buy") or (None,))[0]
        out.append(f"🟢 <b>{bl('usdt', lang)}</b> ➜ <b>{toman(usdt)}</b>{_move(usdt, prev.get('usdt'))}"
                   + (f"\n      🛒 {bl('buy', lang)} {toman(buy)} · 💰 {bl('sell', lang)} {toman(usdt)}" if buy else ""))
    usd = (nd.get("sell") or (None,))[0] or s.get("usd")
    if usd:
        vals["usd"] = usd
        out.append(f"🇺🇸 <b>{bl('usd', lang)}</b> ➜ <b>{toman(usd)}</b>{_move(usd, prev.get('usd'))}")
    if s.get("bubble_pct") is not None:
        bp = s["bubble_pct"]
        out.append(f"🫧 {bl('bubble', lang)}: <b>{B.pct(bp)}</b> {'🔥' if abs(bp) >= 3 else '✅'}")
    if ex:
        out += ["━━━━━━━━━━━━━━", bl("ex", lang)]
        medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]
        for m, e in zip(medals, sorted(ex, key=lambda e: e["sell"])[:5]):
            out.append(f"{m} {exname(e['name'], lang)}{' ⚠️' if e['sanctioned'] else ''} ➜ <b>{toman(e['sell'])}</b>")
        if s.get("arb_toman") is not None and s["arb_toman"] > 0:
            out.append(bl("arb", lang, a=toman(s["arb_toman"]), p=B.pct(s["arb_pct"])))
        if any(e["sanctioned"] for e in sorted(ex, key=lambda e: e["sell"])[:5]):
            out.append(bl("warn", lang))
    cr = crypto_prices(s)
    if cr:
        out += ["━━━━━━━━━━━━━━", bl("crypto", lang)]
        for k, p in cr:
            vals[k] = p
            out.append(crypto_row(k, p, lang, s.get("usdt")) + _move(p, prev.get(k)))
    fiat = tt.get("fiat", {})
    groups = [(bl("fx", lang), ["USD_HERAT", "USD_REMIT", "EUR", "GBP", "AED", "TRY", "CNY"]),
              (bl("gold", lang), ["COIN_EMAMI", "COIN_HALF", "COIN_QUARTER", "GOLD_18", "GOLD_MESGHAL", "XAU"])]
    for title, keys in groups:
        rows = []
        for k in keys:
            if k in fiat and fiat[k][0]:
                p, ch = fiat[k]
                vals[k] = p
                val = B.usd(p) if k == "XAU" else toman(p)
                day = f" {'🟢' if ch > 0 else '🔴'} {B.pct(ch)}" if ch else ""
                rows.append(f"{BOARD_ICON.get(k, '•')} {L3(ASSET_NAME[k], lang)} ➜ <b>{val}</b>{day}")
        if rows:
            out += ["━━━━━━━━━━━━━━", title] + rows
    out += ["━━━━━━━━━━━━━━", bl("legend", lang)]
    if footer:
        out.append(bl("bot", lang))
    return "\n".join(out), vals


def bot_board(lang):
    """the bot's dollar card: same board; 🔺🔻 compare with the price ~30 minutes earlier"""
    now = time.time()
    text, vals = board(_BOT_PREV["vals"], lang, footer=False)
    if text and now - _BOT_PREV["t"] > 1800:
        _BOT_PREV["vals"], _BOT_PREV["t"] = _BOT_PREV["cur"] or vals, now
    if vals:
        _BOT_PREV["cur"] = vals
    return text
