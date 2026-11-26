#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rare indicators — /charts/rare/<page>/ (assets/obs/rare.js draws them; scripts/rare_pages.py holds every page's text).
Measures that the big on-chain sites barely mention or do not show at all, each computed here from free, public data
and written with its chart description, so the browser only draws.

Sources (all free, no account):
  data/obs/chain_<asset>.json  Coin Metrics community data (scripts/obs_chain.py), CC BY-NC 4.0
  data/obs/stables.json        DefiLlama stablecoins (scripts/obs_stables.py)
  data/obs/age_btc.json        Bitview / Bitcoin Research Kit coin-age bands (scripts/obs_age.py)
  bitview.space/api            Bitcoin Research Kit (open source, MIT): cohort cost bases, coin-days destroyed by
                               vintage, cointime prices, address counts, supply in loss — computed from every block
  data.binance.vision          Binance's public archive: BTCUSDT perpetual funding, one file a month
  www.okx.com/api/v5           OKX public API: the funding of the days Binance's archive has not published yet
  api.github.com               weekly commit counts of each project's main repository (stats/participation)
  data-api.binance.vision      Binance's public market data mirror: weekly closes for the same coins

Every page is educational and nothing here is advice. A measure whose inputs cannot be read is not written: the last
good file stays and the reason is printed. Each source is asked at most every few hours (see EVERY).

Writes data/obs/rare/<id>.json for each page and data/obs/rare_now.json (one line a page, for the hub and the bot).
A daily column is {"o": index of its first day, "v": [...]}; day i is t0 + i days (UTC), as in chain_<asset>.json.
Self-test: python3 tests/test_obs_rare.py
"""
import io
import json
import math
import os
import sys
import time
import zipfile
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OBS = os.path.join(ROOT, "data", "obs")
OUT = os.path.join(OBS, "rare")
UA = {"User-Agent": "entekhab.net/1.0 (+https://entekhab.net)"}
BRK = "https://bitview.space/api"
BRK_DAY0 = date(2009, 1, 1)
EVERY = {"brk": 6 * 3600, "fund": 6 * 3600, "dev": 20 * 3600}
CM = "Coin Metrics community data (coinmetrics.io), CC BY-NC 4.0"
BV = "bitview.space (Bitcoin Research Kit, open source)"
NOTE = {"fa": "آموزشی است، توصیهٔ مالی نیست.", "ckb": "فێرکارییە، ئامۆژگاریی دارایی نییە.",
        "ar": "للتعلّم فقط، وليس نصيحة مالية.", "en": "Educational, not financial advice."}

# ---------------------------------------------------------------- colours of the site (assets/obs/xchain.js)
ACC, BLUE, TEAL, RED, GRN, PUR, GOLD, GREY, INK, PINK, INC = ("#ffcf6b", "#7cc8ff", "#199e70", "#ff4f9a", "#5ef2d6", "#9b7bff",
                                                               "#c98500", "#8f9ac7", "#eef1ff", "#ff6fb5", "#d95926")


def L(fa, ckb, ar, en):
    return {"fa": fa, "ckb": ckb, "ar": ar, "en": en}


PRICE = L("قیمت بیت‌کوین", "نرخی بیتکۆین", "سعر البيتكوين", "Bitcoin price")


# ---------------------------------------------------------------- small pieces
def sig(x, n=5):
    if x is None or not isinstance(x, (int, float)) or not math.isfinite(x):
        return None
    if x == 0:
        return 0
    r = float(f"{x:.{n}g}")
    return int(r) if r == int(r) and abs(r) < 1e15 else r


def pack(a, n=5):
    """a column as {"o": first index, "v": [...]} (leading and trailing empty days left out)"""
    i0 = next((i for i, v in enumerate(a) if v is not None), None)
    if i0 is None:
        return {"o": 0, "v": []}
    i1 = max(i for i, v in enumerate(a) if v is not None)
    return {"o": i0, "v": [sig(v, n) for v in a[i0:i1 + 1]]}


def unpack(col, n):
    out = [None] * n
    for i, v in enumerate(col.get("v", [])):
        if 0 <= col["o"] + i < n:
            out[col["o"] + i] = v
    return out


def iso(d):
    return d.isoformat()


def ok(v):
    return v is not None and isinstance(v, (int, float)) and math.isfinite(v)


def last(a):
    for i in range(len(a) - 1, -1, -1):
        if ok(a[i]):
            return i
    return -1


def sma(a, w, need=None):
    need = w if need is None else need
    out, s, c = [None] * len(a), 0.0, 0
    for i, v in enumerate(a):
        if ok(v):
            s += v
            c += 1
        if i >= w and ok(a[i - w]):
            s -= a[i - w]
            c -= 1
        if i >= w - 1 and c >= need:
            out[i] = s / c
    return out


def rsum(a, w):
    out, s, c = [None] * len(a), 0.0, 0
    for i, v in enumerate(a):
        if ok(v):
            s += v
            c += 1
        if i >= w and ok(a[i - w]):
            s -= a[i - w]
            c -= 1
        if i >= w - 1 and c == w:
            out[i] = s
    return out


def pct_change(a, k):
    return [None if i < k or not ok(a[i]) or not ok(a[i - k]) or a[i - k] == 0 else (a[i] / a[i - k] - 1) * 100 for i in range(len(a))]


def zscore(a, w, need=None):
    """each day against the w days up to it (mean and standard deviation of that window)"""
    need = int(w * 0.8) if need is None else need
    out = [None] * len(a)
    s = s2 = 0.0
    c = 0
    for i, v in enumerate(a):
        if ok(v):
            s += v
            s2 += v * v
            c += 1
        if i >= w and ok(a[i - w]):
            s -= a[i - w]
            s2 -= a[i - w] ** 2
            c -= 1
        if ok(v) and c >= need:
            m = s / c
            var = max(0.0, s2 / c - m * m)
            sd = math.sqrt(var)
            out[i] = (v - m) / sd if sd > 0 else 0.0
    return out


def rank_pct(a, i):
    """share of the history up to day i at or below that day's value (0 to 100)"""
    v = a[i]
    hist = [x for x in a[:i + 1] if ok(x)]
    if not ok(v) or len(hist) < 30:
        return None
    return 100.0 * sum(1 for x in hist if x <= v) / len(hist)


def align(src_t0, src, t0, n):
    """a daily list that starts at src_t0 laid on the grid t0 … t0 + n − 1"""
    off = (date.fromisoformat(src_t0) - date.fromisoformat(t0)).days if isinstance(src_t0, str) else (src_t0 - date.fromisoformat(t0)).days
    out = [None] * n
    for j, v in enumerate(src):
        i = j + off
        if 0 <= i < n:
            out[i] = v
    return out


def read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def chain(asset):
    """(t0, n, {col: list}) of data/obs/chain_<asset>.json, or None"""
    j = read(os.path.join(OBS, f"chain_{asset}.json"))
    if not j or not j.get("cols") or not j.get("n"):
        return None
    return j["t0"], j["n"], {k: unpack(c, j["n"]) for k, c in j["cols"].items()}


def write(rid, doc):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, rid + ".json")
    doc = dict(doc, id=rid)
    old = read(path)
    if old and {k: v for k, v in old.items() if k != "updated_at"} == {k: v for k, v in doc.items() if k != "updated_at"}:
        print(f"  {rid}: unchanged")
        return
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    print(f"  {rid}: written ({os.path.getsize(path) // 1024} KB)")


def now_utc():
    return datetime.now(timezone.utc)


def get(url, params=None, timeout=60, tries=3, raw=False, headers=None):
    import requests
    h = dict(UA, **(headers or {}))
    for i in range(tries):
        try:
            r = requests.get(url, params=params, timeout=timeout, headers=h)
            if r.status_code == 200:
                return r.content if raw else r.json()
            if r.status_code == 202:          # GitHub is still counting: ask again shortly
                time.sleep(4 + 4 * i)
                continue
            print("  http", r.status_code, url[:100])
            if r.status_code in (400, 401, 403, 404, 451):
                return None
        except Exception as e:  # noqa: BLE001
            print("  err", str(e)[:140])
        time.sleep(2 + 3 * i)
    return None


# ---------------------------------------------------------------- page description helpers (drawn by rare.js)
def S(k, name, color, typ="line", **kw):
    d = {"k": k, "name": name, "color": color, "type": typ}
    d.update(kw)
    return d


def P(title, series, fmt="num", log=False, weight=2, zero=False, marks=None, zones=None):
    d = {"title": title, "series": series, "fmt": fmt, "log": log, "weight": weight, "zero": zero}
    if marks:
        d["marks"] = marks
    if zones:
        d["zones"] = zones
    return d


def M(y, label, color=GREY):
    return {"y": y, "label": label, "color": color}


def tile(label, value, sub=None):
    return {"l": label, "v": value, "s": sub}


def fnum(v, dp=2, suf=""):
    return "—" if not ok(v) else f"{round(v, dp) + 0.0:,.{dp}f}{suf}"


def fusd(v):
    if not ok(v):
        return "—"
    a = abs(v)
    if a >= 1e9:
        return f"${v / 1e9:,.2f}B"
    if a >= 1e6:
        return f"${v / 1e6:,.2f}M"
    if a >= 1e3:
        return f"${v:,.0f}"
    return f"${v:,.2f}"


def fpct(v, dp=1, sign=True):
    if not ok(v):
        return "—"
    v = round(v, dp) + 0.0  # no "-0%"
    return f"{v:+.{dp}f}%" if sign else f"{v:.{dp}f}%"


def daily_doc(source, t0, cols, view, tiles, read_, extra=None):
    n = max(len(c) for c in cols.values())
    doc = {"updated_at": now_utc().isoformat(timespec="seconds"), "source": source, "t0": t0, "n": n,
           "asof": iso(date.fromisoformat(t0) + timedelta(days=max(c and last(c) for c in cols.values()))),
           "cols": {k: pack(v) for k, v in cols.items()}, "view": view, "tiles": tiles, "read": read_, "note": NOTE}
    if extra:
        doc.update(extra)
    return doc


# ================================================================ Bitview (Bitcoin Research Kit)
def brk_series(name, cache):
    """the closed days of one Bitview measure from 2009-01-01, or None; cached for the run"""
    if name in cache:
        return cache[name]
    j = get(f"{BRK}/series/{name}/day1")
    v = None
    if isinstance(j, dict) and j.get("index") == "day1" and j.get("start") == 0 and isinstance(j.get("data"), list):
        closed = (now_utc().date() - BRK_DAY0).days          # index of today: the day still running is left out
        v = [float(x) if isinstance(x, (int, float)) and math.isfinite(x) else None for x in j["data"][:closed]]
    else:
        print("  bitview: no series", name)
    cache[name] = v
    return v


def brk_first(names, cache):
    for nm in names:
        v = brk_series(nm, cache)
        if v and sum(1 for x in v if ok(x) and x > 0) > 300:
            return nm, v
    return None, None


def due(kind, path):
    old = read(path)
    if os.environ.get("OBS_RARE_FORCE") or not old:
        return True
    try:
        t = datetime.fromisoformat(old.get("looked_at") or old.get("updated_at"))
    except (TypeError, ValueError):
        return True
    return (now_utc() - t).total_seconds() >= EVERY[kind]


def mark_looked(path):
    d = read(path)
    if d:
        d["looked_at"] = now_utc().isoformat(timespec="seconds")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, separators=(",", ":"))


T0B = "2009-01-01"


def brk_pages(cache):
    pr = brk_series("price_close", cache)
    if not pr:
        print("  bitview unreachable: its pages keep their last files")
        return
    n = len(pr)
    price = [None if not ok(x) or x <= 0 else x for x in pr]
    i_now = last(price)

    # ---- 1. vintage spending: coin-days destroyed by the year the coins were created
    try:
        y_now = (BRK_DAY0 + timedelta(days=n - 1)).year
        tot = brk_series("coindays_destroyed", cache)
        lth = brk_series("lth_coindays_destroyed", cache)
        eras = [("e1", 2009, 2012, GOLD, L("۲۰۰۹ تا ۲۰۱۲", "٢٠٠٩ تا ٢٠١٢", "2009–2012", "2009–2012")),
                ("e2", 2013, 2016, PUR, L("۲۰۱۳ تا ۲۰۱۶", "٢٠١٣ تا ٢٠١٦", "2013–2016", "2013–2016")),
                ("e3", 2017, 2020, BLUE, L("۲۰۱۷ تا ۲۰۲۰", "٢٠١٧ تا ٢٠٢٠", "2017–2020", "2017–2020")),
                ("e4", 2021, 2023, TEAL, L("۲۰۲۱ تا ۲۰۲۳", "٢٠٢١ تا ٢٠٢٣", "2021–2023", "2021–2023")),
                ("e5", 2024, y_now, RED, L("۲۰۲۴ تا امروز", "٢٠٢٤ تا ئەمڕۆ", "2024 حتى اليوم", "2024 to today"))]
        years = {}
        for y in range(2009, y_now + 1):
            v = brk_series(f"vintage_{y}_coindays_destroyed", cache)
            if v:
                years[y] = v
        if tot and len(years) >= 10:
            t30 = rsum([x if ok(x) else 0.0 for x in tot], 30)
            cols = {"price": price}
            for k, a, b, _, _ in eras:
                s = [0.0] * n
                for y in range(a, b + 1):
                    for i, x in enumerate(years.get(y, [])):
                        if ok(x):
                            s[i] += x
                r = rsum(s, 30)
                cols[k] = [None if not ok(r[i]) or not ok(t30[i]) or t30[i] <= 0 else 100 * r[i] / t30[i] for i in range(n)]
            if lth:
                l30 = rsum([x if ok(x) else 0.0 for x in lth], 30)
                cols["lth"] = [None if not ok(l30[i]) or not ok(t30[i]) or t30[i] <= 0 else 100 * l30[i] / t30[i] for i in range(n)]
            cols = {k: v[(date(2013, 1, 1) - BRK_DAY0).days:] for k, v in cols.items()}
            t0 = "2013-01-01"
            j = last(cols["e1"])
            per_year = []
            for y in sorted(years):
                v30 = sum(x for x in years[y][max(0, i_now - 29):i_now + 1] if ok(x))
                per_year.append([y, v30])
            tot30 = sum(v for _, v in per_year) or 1
            per_year = [[y, round(100 * v / tot30, 2)] for y, v in per_year]
            top = max(per_year, key=lambda r: r[1])
            old_share = sum(cols[k][j] for k in ("e1", "e2") if ok(cols[k][j]))
            view = {"panes": [
                P(L("سهم هر دوره از کوین‌روزهای سوخته (۳۰ روز)", "بەشی هەر سەردەمێک لە کۆین‌ڕۆژە سووتاوەکان (٣٠ ڕۆژ)", "حصة كل حقبة من أيام العملة المستهلكة (30 يومًا)", "Share of coin-days destroyed by vintage (30 days)"),
                  [S(k, nm, c) for k, _, _, c, nm in eras], fmt="pct", weight=3, zero=True),
                P(L("سهم دارندگان بلندمدت", "بەشی خاوەنە درێژخایەنەکان", "حصة الحائزين طويلي الأجل", "Long-term holders' share"),
                  [S("lth", L("دارندگان بلندمدت", "خاوەنە درێژخایەنەکان", "طويلو الأجل", "Long-term holders"), ACC, "area")], fmt="pct", weight=1, zero=True),
                P(PRICE, [S("price", PRICE, INK)], fmt="usd", log=True, weight=2)]}
            tiles = [tile(L("پرخرج‌ترین سال در ۳۰ روز", "زۆرترین ساڵ لە ٣٠ ڕۆژدا", "السنة الأكثر إنفاقًا في 30 يومًا", "Most-spent vintage (30 days)"), str(top[0]), fpct(top[1], 1, False)),
                     tile(L("سکه‌های پیش از ۲۰۱۷", "دراوەکانی پێش ٢٠١٧", "عملات ما قبل 2017", "Coins from before 2017"), fpct(old_share, 1, False)),
                     tile(L("سهم بلندمدت‌ها", "بەشی درێژخایەنەکان", "حصة طويلي الأجل", "Long-term share"), fpct(cols.get("lth", [None])[j], 1, False))]
            hot = ok(old_share) and old_share >= 15
            read_ = (L(f"سکه‌های قدیمی (پیش از ۲۰۱۷) {old_share:.1f}٪ کوین‌روزهای سوختهٔ این ماه را ساخته‌اند؛ بالاتر از معمول، یعنی پول‌های خیلی قدیمی در حال جابه‌جایی‌اند.",
                         f"دراوە کۆنەکان (پێش ٢٠١٧) {old_share:.1f}٪ی کۆین‌ڕۆژە سووتاوەکانی ئەم مانگەیان دروست کردووە؛ لە ئاسایی زیاترە.",
                         f"العملات القديمة (قبل 2017) شكّلت {old_share:.1f}% من أيام العملة المستهلكة هذا الشهر؛ أعلى من المعتاد.",
                         f"Old coins (before 2017) made {old_share:.1f}% of this month's coin-days destroyed: more than usual, very old money is moving.")
                     if hot else
                     L(f"بیشترِ خرجِ این ماه از سکه‌های سال {top[0]} است و سکه‌های پیش از ۲۰۱۷ فقط {old_share:.1f}٪ سهم دارند؛ پول‌های خیلی قدیمی آرام‌اند.",
                       f"زۆربەی خەرجی ئەم مانگە لە دراوەکانی ساڵی {top[0]}ـە و دراوەکانی پێش ٢٠١٧ تەنها {old_share:.1f}٪ن؛ پارە زۆر کۆنەکان ئارامن.",
                       f"معظم إنفاق هذا الشهر من عملات {top[0]}، وعملات ما قبل 2017 لا تتجاوز {old_share:.1f}%؛ الأموال القديمة جدًا هادئة.",
                       f"Most of this month's spending is {top[0]} coins; coins from before 2017 are only {old_share:.1f}%: very old money is quiet."))
            write("vintage", daily_doc(BV, t0, cols, view, tiles, read_, {"years": per_year}))
    except Exception as e:  # noqa: BLE001
        print("  vintage failed:", e)

    # ---- 2. cohort cost bases and their spread; 3. whale against small-holder cost basis
    try:
        want = {"rp": ["realized_price"], "sth": ["sth_realized_price"], "lth": ["lth_realized_price"],
                "whale": ["addrs_1k_btc_to_10k_btc_realized_price", "addrs_1k_to_10k_btc_realized_price", "amount_1k_to_10k_btc_realized_price"],
                "mid": ["addrs_10btc_to_100btc_realized_price", "addrs_10_to_100_btc_realized_price", "amount_10_to_100_btc_realized_price"],
                "shrimp": ["addrs_10m_sats_to_1btc_realized_price", "addrs_1btc_to_10btc_realized_price", "amount_1_to_10_btc_realized_price"],
                "act": ["active_price"], "vault": ["vaulted_price"]}
        got, used = {}, {}
        for k, names in want.items():
            nm, v = brk_first(names, cache)
            if v:
                got[k] = [None if not ok(x) or x <= 0 else x for x in v]
                used[k] = nm
        print("  cost bases from:", used)
        if all(k in got for k in ("rp", "sth", "lth", "whale", "shrimp")):
            i0 = (date(2012, 1, 1) - BRK_DAY0).days
            core = ("sth", "lth", "whale", "shrimp")
            spread = [None] * n
            for i in range(n):
                vs = [got[k][i] for k in core]
                if all(ok(x) for x in vs) and ok(got["rp"][i]):
                    spread[i] = 100 * (max(vs) - min(vs)) / got["rp"][i]
            cols = {"price": price, **got, "spread": spread}
            cols = {k: v[i0:] for k, v in cols.items()}
            t0 = "2012-01-01"
            j = last(cols["spread"])
            pr_ = cols["price"][j]
            under = sum(1 for k in core if ok(cols[k][j]) and pr_ < cols[k][j])
            sp_pct = rank_pct(cols["spread"], j)
            nm = {"rp": L("قیمت تحقق‌یافتهٔ کل", "نرخی بەدیهاتووی گشتی", "السعر المحقق للكل", "Realized price (all)"),
                  "sth": L("کوتاه‌مدت‌ها", "کورتخایەنەکان", "قصيرو الأجل", "Short-term holders"),
                  "lth": L("بلندمدت‌ها", "درێژخایەنەکان", "طويلو الأجل", "Long-term holders"),
                  "whale": L("نهنگ‌ها (۱۰۰۰ تا ۱۰٬۰۰۰ BTC)", "نەهەنگەکان (١٠٠٠ تا ١٠٬٠٠٠ BTC)", "الحيتان (1000–10000 BTC)", "Whales (1k–10k BTC)"),
                  "mid": L("کیف‌های ۱۰ تا ۱۰۰ BTC", "جزدانی ١٠ تا ١٠٠ BTC", "محافظ 10–100 BTC", "10–100 BTC wallets"),
                  "shrimp": L("کیف‌های کوچک", "جزدانە بچووکەکان", "المحافظ الصغيرة", "Small wallets"),
                  "act": L("قیمت فعال", "نرخی چالاک", "السعر النشط", "Active price"), "vault": L("قیمت خواب", "نرخی خەوتوو", "السعر الخامل", "Vaulted price")}
            colr = {"rp": GREY, "sth": RED, "lth": TEAL, "whale": BLUE, "mid": PUR, "shrimp": GOLD, "act": GRN, "vault": PINK}
            series = [S("price", PRICE, INK, width=2)] + [S(k, nm[k], colr[k]) for k in ("rp", "sth", "lth", "whale", "mid", "shrimp") if k in got]
            view = {"panes": [
                P(L("بهای تمام‌شدهٔ هر گروه", "تێچووی هەر گرووپێک", "متوسط كلفة كل فئة", "Each cohort's cost basis"), series, fmt="usd", log=True, weight=3),
                P(L("فاصلهٔ بالاترین و پایین‌ترین بها (٪ قیمت تحقق‌یافته)", "دووری بەرزترین و نزمترین تێچوو (٪)", "الفجوة بين أعلى وأدنى كلفة (%)", "Spread between the highest and lowest cost basis (% of realized price)"),
                  [S("spread", L("فاصله", "دووری", "الفجوة", "Spread"), ACC, "area")], fmt="pct", weight=1, zero=True)]}
            tiles = [tile(L("گروه‌های زیر آب", "گرووپە زەرەرمەندەکان", "فئات في خسارة", "Cohorts under water"), f"{under}/4"),
                     tile(L("فاصلهٔ بها", "دووری تێچوو", "فجوة الكلفة", "Cost-basis spread"), fpct(cols["spread"][j], 1, False),
                          L(f"کمتر از {100 - sp_pct:.0f}٪ تاریخ", f"لە {100 - sp_pct:.0f}٪ی مێژوو کەمتر", f"أقل من {100 - sp_pct:.0f}% من التاريخ", f"below {100 - sp_pct:.0f}% of history") if ok(sp_pct) else None),
                     tile(nm["sth"], fusd(cols["sth"][j])), tile(nm["lth"], fusd(cols["lth"][j])), tile(nm["whale"], fusd(cols["whale"][j])), tile(nm["shrimp"], fusd(cols["shrimp"][j]))]
            tight = ok(sp_pct) and sp_pct <= 20
            read_ = (L("بهای تمام‌شدهٔ گروه‌ها به هم نزدیک شده (فشرده‌ترین ۲۰٪ تاریخ). در گذشته پس از چنین فشردگی‌ای حرکت بزرگی آمده، اما جهتش را نمی‌گوید.",
                       "تێچووی گرووپەکان لە یەک نزیک بوونەتەوە (چڕترین ٢٠٪ی مێژوو). لە ڕابردوودا دوای ئەمە جووڵەیەکی گەورە هاتووە، بەڵام ئاراستەکەی ناڵێت.",
                       "تقاربت كلفة الفئات (أضيق 20% من التاريخ). سبقت هذه الحالة تاريخيًا تحركات كبيرة، لكنها لا تحدد الاتجاه.",
                       "The cohorts' cost bases have converged (tightest 20% of history). Big moves have followed such squeezes before, but it does not say which way.")
                     if tight else
                     L(f"{under} گروه از ۴ گروه اصلی زیر بهای خریدشان هستند و فاصلهٔ بهاها {cols['spread'][j]:.0f}٪ است.",
                       f"{under} گرووپ لە ٤ گرووپی سەرەکی لە خوار تێچووی کڕینیانن و دووری تێچووەکان {cols['spread'][j]:.0f}٪ـە.",
                       f"{under} من أصل 4 فئات رئيسية تحت كلفة شرائها، والفجوة بين الكلف {cols['spread'][j]:.0f}%.",
                       f"{under} of the 4 main cohorts are below their cost basis; the spread between them is {cols['spread'][j]:.0f}%."))
            write("costbasis", daily_doc(BV, t0, cols, view, tiles, read_, {"used": used}))

            # whale against small wallets
            ratio = [None if not ok(cols["whale"][i]) or not ok(cols["shrimp"][i]) else cols["whale"][i] / cols["shrimp"][i] for i in range(len(cols["price"]))]
            z = zscore(ratio, 730)
            c2 = {"price": cols["price"], "ratio": ratio, "z": z}
            j2 = last(ratio)
            view2 = {"panes": [
                P(L("بهای نهنگ‌ها ÷ بهای کیف‌های کوچک", "تێچووی نەهەنگەکان ÷ تێچووی جزدانە بچووکەکان", "كلفة الحيتان ÷ كلفة المحافظ الصغيرة", "Whales' cost basis ÷ small wallets' cost basis"),
                  [S("ratio", L("نسبت", "ڕێژە", "النسبة", "Ratio"), BLUE)], fmt="x", weight=2, marks=[M(1, L("برابر", "یەکسان", "متساوٍ", "equal"))]),
                P(L("امتیاز Z دو ساله", "نمرەی Z دوو ساڵە", "درجة Z لعامين", "Two-year z-score"), [S("z", L("Z", "Z", "Z", "Z"), ACC, "area")], fmt="num", weight=1, zero=True,
                  marks=[M(2, L("+۲", "+٢", "+2", "+2"), RED), M(-2, L("−۲", "−٢", "−2", "−2"), TEAL)]),
                P(PRICE, [S("price", PRICE, INK)], fmt="usd", log=True, weight=2)]}
            r = ratio[j2]
            tiles2 = [tile(L("نسبت امروز", "ڕێژەی ئەمڕۆ", "نسبة اليوم", "Ratio today"), fnum(r, 3) + "×"),
                      tile(L("امتیاز Z", "نمرەی Z", "درجة Z", "Z-score"), fnum(z[j2], 2)),
                      tile(nm["whale"], fusd(cols["whale"][j2])), tile(nm["shrimp"], fusd(cols["shrimp"][j2]))]
            cheaper = r < 1
            read2 = (L(f"نهنگ‌ها هر بیت‌کوین را به‌طور میانگین {100 * (1 - r):.0f}٪ ارزان‌تر از کیف‌های کوچک دارند؛ تحمل ریزششان بیشتر است.",
                       f"نەهەنگەکان بە ناوەندی هەر بیتکۆینێکیان {100 * (1 - r):.0f}٪ هەرزانتر لە جزدانە بچووکەکان هەیە.",
                       f"تمتلك الحيتان البيتكوين في المتوسط أرخص بـ{100 * (1 - r):.0f}% من المحافظ الصغيرة؛ تتحمّل الهبوط أكثر.",
                       f"Whales hold their bitcoin on average {100 * (1 - r):.0f}% cheaper than small wallets: they can sit through deeper drops.")
                     if cheaper else
                     L(f"نهنگ‌ها هر بیت‌کوین را به‌طور میانگین {100 * (r - 1):.0f}٪ گران‌تر از کیف‌های کوچک خریده‌اند؛ پول بزرگ تازه وارد شده.",
                       f"نەهەنگەکان بە ناوەندی {100 * (r - 1):.0f}٪ گرانتر لە جزدانە بچووکەکان کڕیویانە؛ پارەی گەورەی نوێ هاتووە.",
                       f"اشترت الحيتان في المتوسط أغلى بـ{100 * (r - 1):.0f}% من المحافظ الصغيرة؛ دخلت أموال كبيرة جديدة.",
                       f"Whales paid on average {100 * (r - 1):.0f}% more per bitcoin than small wallets: big money came in recently."))
            write("whalegap", daily_doc(BV, t0, c2, view2, tiles2, read2, {"used": {k: used[k] for k in ("whale", "shrimp")}}))

            # cointime corridor: active and vaulted price + liveliness
            live = brk_series("liveliness", cache)
            if "act" in got and "vault" in got and live:
                lv = [None if not ok(x) else x for x in live]
                lv30 = [None if i < 30 or not ok(lv[i]) or not ok(lv[i - 30]) else (lv[i] - lv[i - 30]) * 1000 for i in range(n)]
                c3 = {"price": price, "act": got["act"], "vault": got["vault"], "rp": got["rp"], "live": lv, "lv30": lv30}
                c3 = {k: v[i0:] for k, v in c3.items()}
                j3 = last(c3["act"])
                p3 = c3["price"][j3]
                pos = None if not ok(c3["vault"][j3]) or not ok(c3["act"][j3]) or c3["act"][j3] == c3["vault"][j3] else \
                    100 * (math.log(p3) - math.log(c3["vault"][j3])) / (math.log(c3["act"][j3]) - math.log(c3["vault"][j3]))
                view3 = {"panes": [
                    P(L("راهروی زمان‌سکه", "ڕاڕەوی کاتی دراو", "ممر زمن العملة", "Cointime corridor"),
                      [S("price", PRICE, INK, width=2), S("act", nm["act"], GRN), S("vault", nm["vault"], PINK), S("rp", nm["rp"], GREY)], fmt="usd", log=True, weight=3),
                    P(L("سرزندگی (۰ تا ۱)", "زیندوویی (٠ تا ١)", "الحيوية (0 إلى 1)", "Liveliness (0 to 1)"), [S("live", L("سرزندگی", "زیندوویی", "الحيوية", "Liveliness"), ACC)], fmt="num", weight=1),
                    P(L("تغییر ۳۰ روزهٔ سرزندگی (هزارم)", "گۆڕانی ٣٠ ڕۆژەی زیندوویی (هەزارەم)", "تغير الحيوية في 30 يومًا (بالألف)", "Liveliness, 30-day change (thousandths)"),
                      [S("lv30", L("تغییر", "گۆڕان", "التغير", "Change"), BLUE, "bars", neg=RED)], fmt="num", weight=1, zero=True)]}
                tiles3 = [tile(L("جای قیمت در راهرو", "شوێنی نرخ لە ڕاڕەوەکەدا", "موقع السعر في الممر", "Price within the corridor"), fpct(pos, 0, False),
                               L("۰٪ قیمت خواب، ۱۰۰٪ قیمت فعال", "٠٪ نرخی خەوتوو، ١٠٠٪ نرخی چالاک", "0% الخامل، 100% النشط", "0% vaulted, 100% active")),
                          tile(nm["act"], fusd(c3["act"][j3])), tile(nm["vault"], fusd(c3["vault"][j3])),
                          tile(L("سرزندگی", "زیندوویی", "الحيوية", "Liveliness"), fnum(c3["live"][j3], 3), fnum(c3["lv30"][j3], 1, "‰"))]
                waking = ok(c3["lv30"][j3]) and c3["lv30"][j3] > 0
                read3 = (L("سرزندگی در ۳۰ روز گذشته بالا رفته: سکه‌های خوابیده بیش از انباشت تازه بیدار شده‌اند (معمولاً فاز فروش دارندگان قدیمی).",
                           "زیندوویی لە ٣٠ ڕۆژی ڕابردوودا بەرز بووەتەوە: دراوە خەوتووەکان زیاتر لە کۆکردنەوەی نوێ بێدار بوونەتەوە.",
                           "ارتفعت الحيوية خلال 30 يومًا: استيقظت عملات نائمة أكثر مما تراكم حديثًا (عادةً مرحلة بيع القدامى).",
                           "Liveliness rose over 30 days: dormant coins woke faster than new ones went to sleep (usually old holders distributing).")
                         if waking else
                         L("سرزندگی در ۳۰ روز گذشته پایین آمده: سکه‌ها بیشتر می‌خوابند تا بیدار شوند (انباشت).",
                           "زیندوویی لە ٣٠ ڕۆژی ڕابردوودا دابەزیوە: دراوەکان زیاتر دەخەون تا بێدار ببنەوە (کۆکردنەوە).",
                           "انخفضت الحيوية خلال 30 يومًا: العملات تنام أكثر مما تستيقظ (تراكم).",
                           "Liveliness fell over 30 days: more coins are going to sleep than waking up (accumulation)."))
                write("cointime", daily_doc(BV, t0, c3, view3, tiles3, read3))
    except Exception as e:  # noqa: BLE001
        print("  cost bases failed:", e)

    # ---- 4. realized price by script type (the generations of bitcoin wallets)
    try:
        types = [("p2pkh", L("قدیمی (1…)", "کۆن (1…)", "قديمة (1…)", "Legacy (1…)"), GOLD), ("p2sh", L("P2SH (3…)", "P2SH (3…)", "P2SH (3…)", "P2SH (3…)"), PUR),
                 ("p2wpkh", L("سگ‌ویت بومی (bc1q…)", "سێگویتی ڕەسەن (bc1q…)", "SegWit الأصلي (bc1q…)", "Native SegWit (bc1q…)"), BLUE),
                 ("p2wsh", L("چندامضایی سگ‌ویت (bc1q… بلند)", "فرە واژۆی سێگویت", "متعدد التوقيع SegWit", "SegWit multisig / scripts"), TEAL),
                 ("p2tr", L("تپ‌روت (bc1p…)", "تاپرووت (bc1p…)", "Taproot (bc1p…)", "Taproot (bc1p…)"), RED)]
        cols = {"price": price}
        for k, _, _ in types:
            v = brk_series(f"{k}_realized_price", cache)
            if v:
                cols[k] = [None if not ok(x) or x <= 0 else x for x in v]
        if sum(1 for k, _, _ in types if k in cols) >= 4:
            i0 = (date(2013, 1, 1) - BRK_DAY0).days
            cols = {k: v[i0:] for k, v in cols.items()}
            j = last(cols["p2wpkh"])
            p_ = cols["price"][j]
            view = {"panes": [P(L("بهای تمام‌شده بر اساس نوع آدرس", "تێچوو بەپێی جۆری ناونیشان", "الكلفة حسب نوع العنوان", "Cost basis by address type"),
                                [S("price", PRICE, INK, width=2)] + [S(k, nm_, c) for k, nm_, c in types if k in cols], fmt="usd", log=True, weight=3)]}
            tiles = [tile(nm_, fusd(cols[k][j]), fpct(100 * (p_ / cols[k][j] - 1), 0)) for k, nm_, _ in types if k in cols and ok(cols[k][j])]
            hi = max(((k, cols[k][j]) for k, _, _ in types if k in cols and ok(cols[k][j])), key=lambda r: r[1])
            names = {k: nm_ for k, nm_, _ in types}
            read_ = L(f"گران‌ترین بها را «{names[hi[0]]['fa']}» دارد ({fusd(hi[1])}). نوع آدرس نسل کیف پول را نشان می‌دهد: تپ‌روت جدیدترین است.",
                      f"گرانترین تێچوو هی «{names[hi[0]]['ckb']}»ـە ({fusd(hi[1])}). جۆری ناونیشان نەوەی جزدان پیشان دەدات.",
                      f"أعلى كلفة لدى «{names[hi[0]]['ar']}» ({fusd(hi[1])}). نوع العنوان يدل على جيل المحفظة.",
                      f"The highest cost basis belongs to {names[hi[0]]['en']} ({fusd(hi[1])}). The address type tells the wallet's generation: Taproot is the newest.")
            write("scriptcost", daily_doc(BV, "2013-01-01", cols, view, tiles, read_))
    except Exception as e:  # noqa: BLE001
        print("  script types failed:", e)

    # ---- 5. each vintage's paper profit
    try:
        y_now = (BRK_DAY0 + timedelta(days=n - 1)).year
        rows, cols = [], {"price": price}
        era_c = [GOLD, PUR, BLUE, TEAL, RED, GRN, PINK, ACC]
        sel = []
        for y in range(2011, y_now + 1):
            v = brk_series(f"vintage_{y}_realized_price", cache)
            if not v or not ok(v[i_now]) or v[i_now] <= 0:
                continue
            rows.append([y, sig(v[i_now]), sig(100 * (price[i_now] / v[i_now] - 1), 4)])
            if y >= 2017:
                k = f"y{y}"
                cols[k] = [None if not ok(v[i]) or v[i] <= 0 or not ok(price[i]) else 100 * (price[i] / v[i] - 1) for i in range(n)]
                sel.append((k, y))
        if len(rows) >= 8:
            i0 = (date(2017, 1, 1) - BRK_DAY0).days
            cols = {k: v[i0:] for k, v in cols.items()}
            view = {"panes": [P(L("سود یا زیان کاغذی سکه‌های هر سال (٪)", "قازانج یان زیانی کاغەزیی دراوەکانی هەر ساڵ (٪)", "الربح أو الخسارة الورقية لعملات كل عام (%)", "Paper profit or loss of each year's coins (%)"),
                                [S(k, L(str(y), str(y), str(y), str(y)), era_c[ix % len(era_c)]) for ix, (k, y) in enumerate(sel)], fmt="pct", weight=3, zero=True,
                                marks=[M(0, L("سربه‌سر", "بێ قازانج و زیان", "التعادل", "break-even"))]),
                              P(PRICE, [S("price", PRICE, INK)], fmt="usd", log=True, weight=1)]}
            loss = [r[0] for r in rows if r[2] < 0]
            tiles = [tile(L("سال‌های در زیان", "ساڵە زیانبارەکان", "سنوات في خسارة", "Vintages at a loss"), str(len(loss)), "، ".join(str(y) for y in loss) or "—"),
                     tile(L("پرسودترین سال", "قازانجبەخشترین ساڵ", "السنة الأكثر ربحًا", "Most profitable vintage"), str(max(rows, key=lambda r: r[2])[0]), fpct(max(r[2] for r in rows), 0))]
            read_ = (L(f"خریداران سال‌های {', '.join(str(y) for y in loss)} الان زیر بهای خریدشان هستند؛ این گروه‌ها نزدیک سربه‌سر معمولاً فشار فروش می‌سازند.",
                       f"کڕیارانی ساڵەکانی {', '.join(str(y) for y in loss)} ئێستا لە خوار تێچووی کڕینیانن.",
                       f"مشترو سنوات {', '.join(str(y) for y in loss)} الآن تحت كلفة شرائهم.",
                       f"Buyers of {', '.join(str(y) for y in loss)} are now below their cost: near break-even such groups tend to sell.")
                     if loss else
                     L("همهٔ سال‌ها در سود کاغذی‌اند؛ هیچ گروه سالانه‌ای زیر بهای خریدش نیست.", "هەموو ساڵەکان لە قازانجی کاغەزیدان.",
                       "جميع السنوات في ربح ورقي.", "Every vintage is in paper profit: no yearly group is below its cost."))
            write("vintprofit", daily_doc(BV, "2017-01-01", cols, view, tiles, read_, {"table": {"head": [L("سال", "ساڵ", "السنة", "Vintage"), L("بها", "تێچوو", "الكلفة", "Cost basis"), L("سود/زیان", "قازانج/زیان", "ربح/خسارة", "Profit/loss")],
                                                                                             "rows": [[str(y), fusd(c), fpct(p, 0)] for y, c, p in rows]}}))
    except Exception as e:  # noqa: BLE001
        print("  vintage profit failed:", e)

    # ---- 6. fresh blood and returning wallets; 7. short-term holders' pain
    try:
        new = brk_series("new_address_count", cache)
        rea = brk_series("reactivated_address_count", cache)
        if new and rea:
            n30, r30 = sma(new, 30), sma(rea, 30)
            ratio = [None if not ok(n30[i]) or not ok(r30[i]) or n30[i] <= 0 else r30[i] / n30[i] for i in range(n)]
            nchg = pct_change(n30, 90)
            i0 = (date(2012, 1, 1) - BRK_DAY0).days
            cols = {k: v[i0:] for k, v in {"price": price, "new": n30, "rea": r30, "ratio": ratio, "nchg": nchg}.items()}
            j = last(cols["ratio"])
            view = {"panes": [
                P(L("آدرس‌های تازه و برگشته در روز (میانگین ۳۰ روز)", "ناونیشانە نوێ و گەڕاوەکان لە ڕۆژێکدا (ناوەندی ٣٠ ڕۆژ)", "العناوين الجديدة والعائدة يوميًا (متوسط 30 يومًا)", "New and returning addresses a day (30-day mean)"),
                  [S("new", L("آدرس تازه", "ناونیشانی نوێ", "عنوان جديد", "New"), BLUE), S("rea", L("آدرس برگشته پس از خواب", "ناونیشانی گەڕاوە", "عنوان عائد", "Returning after dormancy"), PINK)], fmt="num", log=True, weight=2),
                P(L("نسبت برگشتی‌ها به تازه‌ها", "ڕێژەی گەڕاوەکان بە نوێکان", "نسبة العائدين إلى الجدد", "Returning ÷ new"), [S("ratio", L("نسبت", "ڕێژە", "النسبة", "Ratio"), ACC)], fmt="x", weight=1),
                P(PRICE, [S("price", PRICE, INK)], fmt="usd", log=True, weight=2)]}
            tiles = [tile(L("آدرس تازه در روز", "ناونیشانی نوێ لە ڕۆژێکدا", "عناوين جديدة يوميًا", "New addresses a day"), fnum(cols["new"][j], 0), fpct(cols["nchg"][j], 0)),
                     tile(L("برگشتی در روز", "گەڕاوە لە ڕۆژێکدا", "عائدة يوميًا", "Returning a day"), fnum(cols["rea"][j], 0)),
                     tile(L("نسبت", "ڕێژە", "النسبة", "Ratio"), fnum(cols["ratio"][j], 3) + "×", L(f"بالاتر از {rank_pct(cols['ratio'], j):.0f}٪ تاریخ", f"لە {rank_pct(cols['ratio'], j):.0f}٪ی مێژوو زیاتر", f"أعلى من {rank_pct(cols['ratio'], j):.0f}% من التاريخ", f"above {rank_pct(cols['ratio'], j):.0f}% of history"))]
            grow = ok(cols["nchg"][j]) and cols["nchg"][j] > 0
            read_ = (L("آدرس‌های تازه نسبت به سه ماه پیش بیشتر شده‌اند: خون تازه وارد شبکه می‌شود.", "ناونیشانە نوێکان لە سێ مانگ پێش زیاتر بوون: خوێنی نوێ دێتە تۆڕەکە.",
                       "زادت العناوين الجديدة عن ثلاثة أشهر مضت: دماء جديدة تدخل الشبكة.", "New addresses are up from three months ago: fresh blood is entering the network.")
                     if grow else
                     L("آدرس‌های تازه نسبت به سه ماه پیش کمتر شده‌اند: ورود کاربر تازه کند شده.", "ناونیشانە نوێکان لە سێ مانگ پێش کەمتر بوون: هاتنی بەکارهێنەری نوێ خاو بووەتەوە.",
                       "قلّت العناوين الجديدة عن ثلاثة أشهر مضت: تباطأ دخول مستخدمين جدد.", "New addresses are down from three months ago: newcomers have slowed."))
            write("freshblood", daily_doc(BV, "2012-01-01", cols, view, tiles, read_))
        sl = brk_series("sth_supply_in_loss_share", cache)
        ll = brk_series("lth_supply_in_loss_share", cache)
        if sl:
            sth_rp = brk_series("sth_realized_price", cache) or [None] * n
            i0 = (date(2012, 1, 1) - BRK_DAY0).days
            cols = {"price": price, "sl": sl, "sl7": sma(sl, 7)}
            if ll:
                cols["ll"] = ll
            cols["srp"] = [None if not ok(x) or x <= 0 else x for x in sth_rp]
            cols = {k: v[i0:] for k, v in cols.items()}
            j = last(cols["sl"])
            ser = [S("sl7", L("کوتاه‌مدت‌ها (میانگین ۷ روز)", "کورتخایەنەکان (ناوەندی ٧ ڕۆژ)", "قصيرو الأجل (متوسط 7 أيام)", "Short-term holders (7-day mean)"), RED, "area")]
            if "ll" in cols:
                ser.append(S("ll", L("بلندمدت‌ها", "درێژخایەنەکان", "طويلو الأجل", "Long-term holders"), TEAL))
            view = {"panes": [
                P(L("سهم سکه‌های در زیان", "بەشی دراوە زیانبارەکان", "حصة العملات في خسارة", "Share of coins held at a loss"), ser, fmt="pct", weight=2, zero=True,
                  zones=[{"y0": 80, "y1": 100, "color": "rgba(255,79,154,.12)"}]),
                P(PRICE, [S("price", PRICE, INK, width=2), S("srp", L("بهای کوتاه‌مدت‌ها", "تێچووی کورتخایەنەکان", "كلفة قصيري الأجل", "Short-term cost basis"), RED)], fmt="usd", log=True, weight=2)]}
            v = cols["sl"][j]
            tiles = [tile(L("کوتاه‌مدت‌های در زیان", "کورتخایەنە زیانبارەکان", "قصيرو الأجل في خسارة", "Short-term coins at a loss"), fpct(v, 0, False)),
                     tile(L("بلندمدت‌های در زیان", "درێژخایەنە زیانبارەکان", "طويلو الأجل في خسارة", "Long-term coins at a loss"), fpct(cols.get("ll", [None] * (j + 1))[j], 1, False)),
                     tile(L("بهای کوتاه‌مدت‌ها", "تێچووی کورتخایەنەکان", "كلفة قصيري الأجل", "Short-term cost basis"), fusd(cols["srp"][j]))]
            read_ = (L(f"{v:.0f}٪ سکه‌های کوتاه‌مدت در زیان‌اند؛ بالای ۸۰٪ در گذشته نزدیک کف‌های محلی و تسلیم دیده شده، اما تضمینی نیست.",
                       f"{v:.0f}٪ی دراوە کورتخایەنەکان لە زیاندان؛ سەرووی ٨٠٪ لە ڕابردوودا نزیک بنە ناوچەییەکان بینراوە.",
                       f"{v:.0f}% من عملات قصيري الأجل في خسارة؛ فوق 80% ظهر تاريخيًا قرب القيعان المحلية، دون ضمان.",
                       f"{v:.0f}% of short-term coins are at a loss; above 80% has shown up near local bottoms and capitulation before, with no guarantee.")
                     if ok(v) and v >= 80 else
                     L(f"{v:.0f}٪ سکه‌های کوتاه‌مدت در زیان‌اند؛ هنوز به ناحیهٔ درد شدید (بالای ۸۰٪) نرسیده.",
                       f"{v:.0f}٪ی دراوە کورتخایەنەکان لە زیاندان؛ هێشتا نەگەیشتووەتە ناوچەی ئازاری زۆر (سەرووی ٨٠٪).",
                       f"{v:.0f}% من عملات قصيري الأجل في خسارة؛ لم تبلغ منطقة الألم الشديد (فوق 80%).",
                       f"{v:.0f}% of short-term coins are at a loss: not yet in the deep-pain zone (above 80%)."))
            write("sthpain", daily_doc(BV, "2012-01-01", cols, view, tiles, read_))
    except Exception as e:  # noqa: BLE001
        print("  addresses / pain failed:", e)

    # ---- 8. who takes profit: realized profit and loss by wallet size
    try:
        sizes = [("s1", ["addrs_10m_sats_to_1btc"], L("۰٫۱ تا ۱ BTC", "٠٫١ تا ١ BTC", "0.1–1 BTC", "0.1–1 BTC"), GOLD),
                 ("s2", ["addrs_1btc_to_10btc"], L("۱ تا ۱۰ BTC", "١ تا ١٠ BTC", "1–10 BTC", "1–10 BTC"), TEAL),
                 ("s3", ["addrs_10btc_to_100btc"], L("۱۰ تا ۱۰۰ BTC", "١٠ تا ١٠٠ BTC", "10–100 BTC", "10–100 BTC"), BLUE),
                 ("s4", ["addrs_100btc_to_1k_btc"], L("۱۰۰ تا ۱۰۰۰ BTC", "١٠٠ تا ١٠٠٠ BTC", "100–1k BTC", "100–1k BTC"), PUR),
                 ("s5", ["addrs_1k_btc_to_10k_btc"], L("۱۰۰۰ تا ۱۰٬۰۰۰ BTC", "١٠٠٠ تا ١٠٬٠٠٠ BTC", "1k–10k BTC", "1k–10k BTC"), RED)]
        cols, got = {"price": price}, []
        for k, pre, nm_, c in sizes:
            _, pf = brk_first([p + "_realized_profit" for p in pre], cache)
            _, ls = brk_first([p + "_realized_loss" for p in pre], cache)
            if pf and ls:
                net = [None if not ok(pf[i]) or not ok(ls[i]) else pf[i] - ls[i] for i in range(n)]
                cols[k] = rsum([x if ok(x) else 0.0 for x in net], 7)
                got.append((k, nm_, c))
        if len(got) >= 4:
            i0 = (date(2015, 1, 1) - BRK_DAY0).days
            cols = {k: v[i0:] for k, v in cols.items()}
            j = last(cols[got[0][0]])
            view = {"panes": [P(L("سود منهای زیان تحقق‌یافته در ۷ روز، به دلار", "قازانج کەم زیانی بەدیهاتوو لە ٧ ڕۆژدا", "الربح ناقص الخسارة المحققة في 7 أيام", "Realized profit minus loss over 7 days, in dollars"),
                                [S(k, nm_, c) for k, nm_, c in got], fmt="usd", weight=3, zero=True), P(PRICE, [S("price", PRICE, INK)], fmt="usd", log=True, weight=1)]}
            tiles = [tile(nm_, fusd(cols[k][j])) for k, nm_, _ in got]
            top = max(got, key=lambda g: abs(cols[g[0]][j] or 0))
            sign = (cols[top[0]][j] or 0) >= 0
            read_ = L(f"بزرگ‌ترین {'سودگیری' if sign else 'زیان‌فروشی'} هفته را کیف‌های {top[1]['fa']} انجام داده‌اند.",
                      f"گەورەترین {'قازانجوەرگرتن' if sign else 'فرۆشتن بە زیان'}ی هەفتە لە جزدانەکانی {top[1]['ckb']}ـەوە بووە.",
                      f"أكبر {'جني أرباح' if sign else 'بيع بخسارة'} هذا الأسبوع جاء من محافظ {top[1]['ar']}.",
                      f"The week's biggest {'profit-taking' if sign else 'selling at a loss'} came from {top[1]['en']} wallets.")
            write("sizepl", daily_doc(BV, "2015-01-01", cols, view, tiles, read_))
        else:
            print("  size cohorts: not enough series")
    except Exception as e:  # noqa: BLE001
        print("  size cohorts failed:", e)


# ================================================================ funding against exchange flows
FUND_CACHE = os.path.join(OUT, "_fund_btc.json")


def funding_days():
    """{day: mean funding of that day (fraction per 8 h)} from Binance's monthly archive and OKX for the newest days"""
    cache = read(FUND_CACHE) or {"binance": {}, "months": [], "okx": {}}
    today = now_utc().date()
    m = date(2019, 9, 1)
    while m < today.replace(day=1):
        tag = m.strftime("%Y-%m")
        if tag not in cache["months"]:
            raw = get(f"https://data.binance.vision/data/futures/um/monthly/fundingRate/BTCUSDT/BTCUSDT-fundingRate-{tag}.zip", raw=True, timeout=60)
            if raw:
                try:
                    z = zipfile.ZipFile(io.BytesIO(raw))
                    txt = z.read(z.namelist()[0]).decode("utf-8")
                    per = {}
                    for line in txt.splitlines():
                        p = line.split(",")
                        if len(p) < 3 or not p[0].isdigit():
                            continue
                        d = datetime.fromtimestamp(int(p[0]) / 1000, timezone.utc).date().isoformat()
                        per.setdefault(d, []).append(float(p[2]))
                    for d, v in per.items():
                        cache["binance"][d] = round(sum(v) / len(v), 8)
                    cache["months"].append(tag)
                except Exception as e:  # noqa: BLE001
                    print("  funding file", tag, e)
        m = (m + timedelta(days=32)).replace(day=1)
    # the newest days (Binance publishes a month's file after it ends): OKX's public history, BTC-USDT perpetual
    j = get("https://www.okx.com/api/v5/public/funding-rate-history", params={"instId": "BTC-USDT-SWAP", "limit": "100"})
    if isinstance(j, dict) and j.get("code") == "0":
        per = {}
        for r in j.get("data", []):
            try:
                d = datetime.fromtimestamp(int(r["fundingTime"]) / 1000, timezone.utc).date()
                if d < today:
                    per.setdefault(d.isoformat(), []).append(float(r["realizedRate"] or r["fundingRate"]))
            except (KeyError, ValueError, TypeError):
                continue
        for d, v in per.items():
            cache["okx"][d] = round(sum(v) / len(v), 8)
    os.makedirs(OUT, exist_ok=True)
    with open(FUND_CACHE, "w", encoding="utf-8") as f:
        json.dump(cache, f, separators=(",", ":"))
    return cache


def fundflow_page():
    ch = chain("btc")
    if not ch:
        return
    t0c, nc, cc = ch
    cache = funding_days()
    if len(cache["binance"]) < 300:
        print("  funding: too few days")
        return
    t0 = "2019-09-10"
    i0 = (date.fromisoformat(t0) - date.fromisoformat(t0c)).days
    n = nc - i0
    fund, src = [None] * n, [None] * n
    for i in range(n):
        d = (date.fromisoformat(t0) + timedelta(days=i)).isoformat()
        if d in cache["binance"]:
            fund[i], src[i] = cache["binance"][d], 0
        elif d in cache["okx"]:
            fund[i], src[i] = cache["okx"][d], 1
    ann = [None if not ok(x) else x * 3 * 365 * 100 for x in fund]
    f7 = sma(ann, 7, 5)
    netd = [None if not ok(a) or not ok(b) else a - b for a, b in zip(cc["fin"][i0:], cc["fout"][i0:])]
    net7 = rsum(netd, 7)
    zf = zscore(f7, 365)
    zs = zscore([None if not ok(x) else -x for x in net7], 365)        # outflows = coins leaving exchanges = spot demand
    div = [None if not ok(a) or not ok(b) else a - b for a, b in zip(zf, zs)]
    price = cc["price"][i0:]
    cols = {"price": price, "f7": f7, "net7": net7, "div": div}
    j = min(last(div), last(f7))
    okx_from = next((i for i in range(n) if src[i] == 1 and all(s != 0 for s in src[i:] if s is not None)), None)
    vl = [{"x": (date.fromisoformat(t0) + timedelta(days=okx_from)).isoformat(), "label": L("از این‌جا OKX", "لێرەوە OKX", "من هنا OKX", "OKX from here")}] if okx_from else []
    view = {"panes": [
        P(L("امتیاز واگرایی: اهرم منهای تقاضای اسپات", "نمرەی لێکجیابوونەوە: لیڤەرێج کەم داواکاریی سپۆت", "درجة التباعد: الرافعة ناقص طلب السوق الفوري", "Divergence: leverage minus spot demand"),
          [S("div", L("واگرایی", "لێکجیابوونەوە", "التباعد", "Divergence"), ACC, "area")], fmt="num", weight=2, zero=True,
          marks=[M(2, L("اهرم داغ، اسپات سرد", "لیڤەرێجی گەرم، سپۆتی سارد", "رافعة ساخنة وسوق فوري بارد", "hot leverage, cold spot"), RED), M(-2, L("انباشت آرام", "کۆکردنەوەی بێدەنگ", "تراكم هادئ", "quiet accumulation"), TEAL)]),
        P(L("فاندینگ سالانه (میانگین ۷ روز)", "فاندینگی ساڵانە (ناوەندی ٧ ڕۆژ)", "التمويل السنوي (متوسط 7 أيام)", "Funding, annualized (7-day mean)"),
          [S("f7", L("فاندینگ BTCUSDT", "فاندینگی BTCUSDT", "تمويل BTCUSDT", "BTCUSDT funding"), PUR)], fmt="pct", weight=1, zero=True),
        P(L("خالص ورود به صرافی‌ها در ۷ روز (BTC)", "پوختەی چوونە ناو ئاڵوگۆڕگەکان لە ٧ ڕۆژدا (BTC)", "صافي التدفق إلى المنصات في 7 أيام (BTC)", "Net flow into exchanges over 7 days (BTC)"),
          [S("net7", L("ورود منهای خروج", "هاتن کەم چوون", "الداخل ناقص الخارج", "In minus out"), RED, "bars", neg=TEAL)], fmt="num", weight=1, zero=True),
        P(PRICE, [S("price", PRICE, INK)], fmt="usd", log=True, weight=2)], "vlines": vl}
    dv = div[j]
    tiles = [tile(L("امتیاز واگرایی", "نمرەی لێکجیابوونەوە", "درجة التباعد", "Divergence score"), fnum(dv, 2)),
             tile(L("فاندینگ سالانه", "فاندینگی ساڵانە", "التمويل السنوي", "Funding, annualized"), fpct(f7[j], 1)),
             tile(L("خالص صرافی‌ها ۷ روز", "پوختەی ئاڵوگۆڕگەکان ٧ ڕۆژ", "صافي المنصات 7 أيام", "Exchange net, 7 days"), fnum(net7[j], 0, " BTC"))]
    if ok(dv) and dv >= 1.5:
        read_ = L("اهرم‌ها داغ‌اند در حالی که سکه به صرافی‌ها می‌رود: رشد شکننده، بیشتر روی فیوچرز تا خرید واقعی.",
                  "لیڤەرێجەکان گەرمن لە کاتێکدا دراو دەچێتە ئاڵوگۆڕگەکان: بەرزبوونەوەیەکی ناسک.",
                  "الرافعة ساخنة بينما تتجه العملات إلى المنصات: صعود هش يعتمد على العقود أكثر من الشراء الفعلي.",
                  "Leverage is hot while coins move onto exchanges: a fragile rise, carried by futures more than real buying.")
    elif ok(dv) and dv <= -1.5:
        read_ = L("فاندینگ سرد است ولی سکه از صرافی‌ها بیرون می‌رود: انباشت آرام زیر سطح بازار.",
                  "فاندینگ ساردە بەڵام دراو لە ئاڵوگۆڕگەکان دەردەچێت: کۆکردنەوەی بێدەنگ.",
                  "التمويل بارد لكن العملات تخرج من المنصات: تراكم هادئ تحت السطح.",
                  "Funding is cold yet coins leave exchanges: quiet accumulation under the surface.")
    else:
        read_ = L("فیوچرز و اسپات هم‌جهت‌اند؛ واگرایی معناداری دیده نمی‌شود.", "فیوچەرز و سپۆت هاوئاراستەن؛ لێکجیابوونەوەیەکی بەرچاو نییە.",
                  "العقود والسوق الفوري متوافقان؛ لا تباعد يُذكر.", "Futures and spot agree: no meaningful divergence.")
    write("fundflow", daily_doc("Binance public archive (data.binance.vision) · OKX public API · " + CM, t0, cols, view, tiles, read_))


# ================================================================ developer activity against price
DEV = [("ETH", "ethereum/go-ethereum"), ("SOL", "anza-xyz/agave"), ("ADA", "IntersectMBO/cardano-node"), ("DOT", "paritytech/polkadot-sdk"),
       ("AVAX", "ava-labs/avalanchego"), ("NEAR", "near/nearcore"), ("ATOM", "cosmos/cosmos-sdk"), ("LINK", "smartcontractkit/chainlink"),
       ("APT", "aptos-labs/aptos-core"), ("SUI", "MystenLabs/sui"), ("ARB", "OffchainLabs/nitro"), ("OP", "ethereum-optimism/optimism"),
       ("TON", "ton-blockchain/ton"), ("TRX", "tronprotocol/java-tron"), ("XRP", "XRPLF/rippled"), ("LTC", "litecoin-project/litecoin"),
       ("BTC", "bitcoin/bitcoin"), ("DOGE", "dogecoin/dogecoin"), ("XLM", "stellar/stellar-core"), ("ALGO", "algorand/go-algorand"),
       ("FIL", "filecoin-project/lotus"), ("ICP", "dfinity/ic"), ("INJ", "InjectiveLabs/injective-chain-releases"), ("SEI", "sei-protocol/sei-chain"),
       ("TIA", "celestiaorg/celestia-app"), ("HBAR", "hiero-ledger/hiero-consensus-node"), ("UNI", "Uniswap/v4-core"), ("AAVE", "aave-dao/aave-v3-origin")]


def dev_page():
    tok = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    hdr = {"Accept": "application/vnd.github+json"}
    if tok:
        hdr["Authorization"] = "Bearer " + tok
    today = now_utc().date()
    variants, rows = [], []
    for sym, repo in DEV:
        j = get(f"https://api.github.com/repos/{repo}/stats/participation", headers=hdr, tries=5)
        if not isinstance(j, dict) or not isinstance(j.get("all"), list) or len(j["all"]) != 52:
            print("  dev: no stats for", repo)
            continue
        com = [int(x) for x in j["all"]]
        kl = get("https://data-api.binance.vision/api/v3/klines", params={"symbol": sym + "USDT", "interval": "1w", "limit": "53"})
        closes = {}
        if isinstance(kl, list):
            for k in kl:
                try:
                    d = datetime.fromtimestamp(int(k[6]) / 1000, timezone.utc).date()      # the week's close
                    closes[d] = float(k[4])
                except (ValueError, TypeError, IndexError):
                    continue
        # GitHub's 52 weeks end with the week still running; week i ends today − 7·(51 − i) days
        ends = [today - timedelta(days=7 * (51 - i)) for i in range(52)]
        px = []
        for e in ends:
            best = min(closes, key=lambda d: abs((d - e).days)) if closes else None
            px.append(closes[best] if best and abs((best - e).days) <= 4 else None)
        c12, p12 = sum(com[-13:-1]), sum(com[-25:-13])          # the 12 closed weeks against the 12 before them
        dchg = None if p12 == 0 else 100 * (c12 / p12 - 1)
        pchg = None if not ok(px[-1]) or not ok(px[-13]) else 100 * (px[-1] / px[-13] - 1)
        rows.append({"sym": sym, "repo": repo, "c12": c12, "dchg": sig(dchg, 4), "pchg": sig(pchg, 4)})
        variants.append({"key": sym, "label": L(sym, sym, sym, sym), "t0": ends[0].isoformat(), "step": 7,
                         "cols": {"com": pack(com), "px": pack(px)}})
        time.sleep(0.5)
    if len(rows) < 10:
        print("  dev: too few projects")
        return
    both = [r for r in rows if ok(r["dchg"]) and ok(r["pchg"])]
    for r in both:
        r["gap"] = sig(r["dchg"] - r["pchg"], 4)
    both.sort(key=lambda r: -r["gap"])
    view = {"panes": [P(L("کامیت‌های هفتگی مخزن اصلی", "کۆمیتە هەفتانەکانی کۆگای سەرەکی", "الالتزامات الأسبوعية للمستودع الرئيسي", "Weekly commits to the main repository"),
                        [S("com", L("کامیت", "کۆمیت", "التزامات", "Commits"), BLUE, "bars")], fmt="num", weight=2, zero=True),
                      P(L("قیمت هفتگی (USDT)", "نرخی هەفتانە (USDT)", "السعر الأسبوعي (USDT)", "Weekly price (USDT)"), [S("px", L("قیمت", "نرخ", "السعر", "Price"), ACC)], fmt="usd", log=True, weight=2)],
            "variants": True}
    lead = both[0] if both else None
    tiles = [tile(L("پروژه‌های بررسی‌شده", "پرۆژە پشکنراوەکان", "المشاريع المفحوصة", "Projects checked"), str(len(rows))),
             tile(L("بیشترین فاصلهٔ توسعه از قیمت", "زۆرترین دووری گەشەپێدان لە نرخ", "أكبر فجوة بين التطوير والسعر", "Widest dev-over-price gap"),
                  lead["sym"] if lead else "—", fpct(lead["gap"], 0) if lead else None),
             tile(L("کامیت‌های ۱۲ هفته، همه", "کۆمیتی ١٢ هەفتە، هەموو", "التزامات 12 أسبوعًا للجميع", "Commits, 12 weeks, all"), fnum(sum(r["c12"] for r in rows), 0))]
    up = [r["sym"] for r in both if r["dchg"] > 0 and r["pchg"] < 0][:5]
    read_ = (L(f"توسعه بالا رفته ولی قیمت پایین آمده در: {', '.join(up)}. کار فنی بیشتر یعنی ارزش بیشتر نیست، ولی چنین واگرایی‌ای کمتر دیده می‌شود.",
               f"گەشەپێدان بەرز بووەتەوە بەڵام نرخ دابەزیوە لە: {', '.join(up)}.",
               f"ارتفع التطوير وانخفض السعر في: {', '.join(up)}. العمل التقني الأكثر لا يعني قيمة أكثر، لكن هذا التباعد نادر.",
               f"Development rose while price fell in: {', '.join(up)}. More code is not more value, but such a split is worth a look.")
             if up else
             L("در هیچ پروژه‌ای توسعهٔ رو به رشد همراه قیمت نزولی دیده نشد.", "لە هیچ پرۆژەیەکدا گەشەپێدانی زیادبوو لەگەڵ نرخی دابەزیو نەبینرا.",
               "لا يوجد مشروع ارتفع تطويره وانخفض سعره.", "No project shows rising development alongside a falling price."))
    table = {"head": [L("ارز", "دراو", "العملة", "Coin"), L("تغییر توسعه ۱۲ هفته", "گۆڕانی گەشەپێدان ١٢ هەفتە", "تغير التطوير 12 أسبوعًا", "Dev change, 12 wk"),
                      L("تغییر قیمت ۱۲ هفته", "گۆڕانی نرخ ١٢ هەفتە", "تغير السعر 12 أسبوعًا", "Price change, 12 wk"), L("فاصله", "دووری", "الفجوة", "Gap")],
             "rows": [[r["sym"], fpct(r["dchg"], 0), fpct(r["pchg"], 0), fpct(r["gap"], 0)] for r in both]}
    doc = {"updated_at": now_utc().isoformat(timespec="seconds"), "source": "GitHub API (stats/participation) · Binance public market data",
           "asof": today.isoformat(), "variants": variants, "view": view, "tiles": tiles, "read": read_, "table": table, "note": NOTE,
           "repos": {r["sym"]: r["repo"] for r in rows}}
    write("devpulse", doc)


# ================================================================ pages from files the site already has (no network)
def local_pages():
    st = read(os.path.join(OBS, "stables.json"))
    ch = chain("btc")
    # ---- stablecoin printing speed and its acceleration; USDT against USDC; lead and lag against bitcoin
    if st and ch:
        t0, n = st["t0"], st["n"]
        tot, usdt, usdc = (unpack(st["cols"][k], n) for k in ("usd", "usdt", "usdc"))
        price = align(ch[0], ch[2]["price"], t0, n)
        net = [None if i == 0 or not ok(tot[i]) or not ok(tot[i - 1]) else (tot[i] - tot[i - 1]) for i in range(n)]
        net7 = sma(net, 7, 6)
        g30 = pct_change(tot, 30)
        acc = [None if i < 30 or not ok(g30[i]) or not ok(g30[i - 30]) else g30[i] - g30[i - 30] for i in range(n)]
        g30t, g30c = pct_change(usdt, 30), pct_change(usdc, 30)
        cols = {"price": price, "net7": net7, "g30": g30, "acc": acc, "g30t": g30t, "g30c": g30c}
        j = last(g30)
        streak = 0
        for i in range(j, -1, -1):
            if ok(net7[i]) and net7[i] > 0:
                streak += 1
            else:
                break
        view = {"panes": [
            P(L("دلارهای تازه در روز (میلیون دلار، میانگین ۷ روز)", "دۆلاری نوێ لە ڕۆژێکدا (ملیۆن دۆلار، ناوەندی ٧ ڕۆژ)", "دولارات جديدة يوميًا (مليون، متوسط 7 أيام)", "New stablecoin dollars a day ($M, 7-day mean)"),
              [S("net7", L("چاپ خالص", "چاپی پوختە", "الإصدار الصافي", "Net printing"), TEAL, "bars", neg=RED)], fmt="num", weight=2, zero=True),
            P(L("سرعت (رشد ۳۰ روزه) و شتاب", "خێرایی (گەشەی ٣٠ ڕۆژ) و تاودان", "السرعة (نمو 30 يومًا) والتسارع", "Speed (30-day growth) and acceleration"),
              [S("g30", L("سرعت", "خێرایی", "السرعة", "Speed"), BLUE), S("acc", L("شتاب", "تاودان", "التسارع", "Acceleration"), ACC), S("g30t", L("USDT", "USDT", "USDT", "USDT"), GRN, hide=True), S("g30c", L("USDC", "USDC", "USDC", "USDC"), PUR, hide=True)],
              fmt="pct", weight=2, zero=True),
            P(PRICE, [S("price", PRICE, INK)], fmt="usd", log=True, weight=2)]}
        tiles = [tile(L("سرعت ۳۰ روزه", "خێرایی ٣٠ ڕۆژە", "السرعة في 30 يومًا", "30-day speed"), fpct(g30[j], 2)),
                 tile(L("شتاب", "تاودان", "التسارع", "Acceleration"), fpct(acc[j], 2)),
                 tile(L("روزهای پیاپی چاپ", "ڕۆژە یەک لە دوای یەکەکانی چاپ", "أيام متتالية من الإصدار", "Days of net printing in a row"), str(streak)),
                 tile(L("کل استیبل‌کوین‌ها", "کۆی ستەیبڵکۆینەکان", "إجمالي العملات المستقرة", "All stablecoins"), fusd((tot[j] or 0) * 1e6))]
        a = acc[j]
        read_ = (L("دلارهای تازه هم زیاد می‌شوند و هم سرعتشان بالا می‌رود: سوخت خرید در حال پر شدن است.", "دۆلاری نوێ هەم زیاد دەبێت هەم خێراتر دەبێت: سووتەمەنیی کڕین پڕ دەبێتەوە.",
                     "الدولارات الجديدة تزداد وتتسارع: وقود الشراء يمتلئ.", "New dollars are growing and speeding up: buying fuel is filling up.")
                 if ok(a) and a > 0 and ok(g30[j]) and g30[j] > 0 else
                 L("چاپ دلار تازه کند شده یا منفی است: ورود پول تازه به کریپتو ضعیف‌تر شده.", "چاپی دۆلاری نوێ خاو بووەتەوە یان نەرێنییە: هاتنی پارەی نوێ لاوازتر بووە.",
                   "تباطأ إصدار الدولارات الجديدة أو صار سلبيًا: ضعف دخول المال الجديد.", "Stablecoin printing has slowed or turned negative: fresh money is entering crypto more weakly."))
        write("stablevel", daily_doc("DefiLlama stablecoins (stablecoins.llama.fi) · " + CM, t0, cols, view, tiles, read_))

        share = [None if not ok(usdt[i]) or not ok(usdc[i]) or usdt[i] + usdc[i] <= 0 else 100 * usdt[i] / (usdt[i] + usdc[i]) for i in range(n)]
        sch = [None if i < 90 or not ok(share[i]) or not ok(share[i - 90]) else share[i] - share[i - 90] for i in range(n)]
        cols = {"price": price, "share": share, "sch": sch}
        j = last(share)
        view = {"panes": [
            P(L("سهم تتر از تتر + USDC", "بەشی تێتەر لە تێتەر + USDC", "حصة USDT من USDT + USDC", "USDT's share of USDT + USDC"), [S("share", L("سهم USDT", "بەشی USDT", "حصة USDT", "USDT share"), GRN)], fmt="pct", weight=2),
            P(L("تغییر سهم در ۹۰ روز (واحد درصد)", "گۆڕانی بەش لە ٩٠ ڕۆژدا", "تغير الحصة في 90 يومًا (نقطة)", "Share change over 90 days (points)"),
              [S("sch", L("تغییر", "گۆڕان", "التغير", "Change"), GRN, "bars", neg=PUR)], fmt="num", weight=1, zero=True),
            P(PRICE, [S("price", PRICE, INK)], fmt="usd", log=True, weight=2)]}
        tiles = [tile(L("سهم USDT", "بەشی USDT", "حصة USDT", "USDT share"), fpct(share[j], 1, False)),
                 tile(L("تغییر ۹۰ روزه", "گۆڕانی ٩٠ ڕۆژ", "تغير 90 يومًا", "90-day change"), fnum(sch[j], 1, " pp"))]
        read_ = (L("سهم USDT بالا می‌رود: دلار «برون‌مرزی» (بیشتر آسیا و بازارهای نوظهور) جلوتر از دلار تنظیم‌شدهٔ آمریکایی رشد می‌کند.",
                   "بەشی USDT بەرز دەبێتەوە: دۆلاری «دەرەوەی سنوور» لە دۆلاری ڕێکخراوی ئەمریکی خێراتر گەشە دەکات.",
                   "ترتفع حصة USDT: الدولار «الخارجي» (آسيا والأسواق الناشئة غالبًا) ينمو أسرع من الدولار الأمريكي المنظم.",
                   "USDT's share is rising: the offshore dollar (mostly Asia and emerging markets) is growing faster than the regulated US one.")
                 if ok(sch[j]) and sch[j] > 0 else
                 L("سهم USDC بالا می‌رود: پول تنظیم‌شده و نهادی آمریکایی جلوتر است.", "بەشی USDC بەرز دەبێتەوە: پارەی ڕێکخراو و دامەزراوەیی ئەمریکی پێشترە.",
                   "ترتفع حصة USDC: المال الأمريكي المنظم والمؤسسي في المقدمة.", "USDC's share is rising: regulated, institutional US money is leading."))
        write("stablerot", daily_doc("DefiLlama stablecoins (stablecoins.llama.fi) · " + CM, t0, cols, view, tiles, read_))

        # lead and lag: which lag of stablecoin growth matched bitcoin's 30-day return best over the past year
        r30 = pct_change(price, 30)
        best_lag, best_r = [None] * n, [None] * n
        lags = list(range(0, 91, 5))
        for i in range(400, n, 7):
            top = None
            for lg in lags:
                xs, ys = [], []
                for k in range(i - 364, i + 1):
                    if k - lg >= 0 and ok(g30[k - lg]) and ok(r30[k]):
                        xs.append(g30[k - lg])
                        ys.append(r30[k])
                if len(xs) < 250:
                    continue
                mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
                sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
                sy = math.sqrt(sum((y - my) ** 2 for y in ys))
                if sx == 0 or sy == 0:
                    continue
                r = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (sx * sy)
                if top is None or r > top[1]:
                    top = (lg, r)
            if top:
                for k in range(i, min(n, i + 7)):
                    best_lag[k], best_r[k] = top[0], top[1]
        cols = {"price": price, "lag": best_lag, "r": best_r}
        j = last(best_lag)
        if j > 0:
            view = {"panes": [
                P(L("بهترین تأخیر (روز): رشد استیبل‌کوین چند روز جلوتر از بیت‌کوین بوده", "باشترین دواکەوتن (ڕۆژ)", "أفضل تأخير (أيام)", "Best lag (days): how far stablecoin growth led bitcoin"),
                  [S("lag", L("تأخیر", "دواکەوتن", "التأخير", "Lag"), BLUE, "step")], fmt="num", weight=2, zero=True),
                P(L("همبستگی در آن تأخیر (یک سال اخیر)", "پەیوەندی لەو دواکەوتنەدا", "الارتباط عند ذلك التأخير", "Correlation at that lag (past year)"),
                  [S("r", L("همبستگی", "پەیوەندی", "الارتباط", "Correlation"), ACC, "area")], fmt="num", weight=1, zero=True, marks=[M(0.5, L("قوی", "بەهێز", "قوي", "strong"))]),
                P(PRICE, [S("price", PRICE, INK)], fmt="usd", log=True, weight=2)]}
            tiles = [tile(L("بهترین تأخیر امروز", "باشترین دواکەوتنی ئەمڕۆ", "أفضل تأخير اليوم", "Best lag today"), fnum(best_lag[j], 0, L(" روز", " ڕۆژ", " يوم", " days")["en"])),
                     tile(L("همبستگی", "پەیوەندی", "الارتباط", "Correlation"), fnum(best_r[j], 2))]
            strong = ok(best_r[j]) and best_r[j] >= 0.5
            read_ = (L(f"در یک سال اخیر، رشد استیبل‌کوین‌ها با تأخیر حدود {best_lag[j]} روز بیشترین هم‌حرکتی را با بازده بیت‌کوین داشته (همبستگی {best_r[j]:.2f}). رابطهٔ گذشته است، نه قانون.",
                       f"لە ساڵی ڕابردوودا گەشەی ستەیبڵکۆین بە دواکەوتنی نزیکەی {best_lag[j]} ڕۆژ زۆرترین هاوجووڵەی لەگەڵ بیتکۆین هەبووە ({best_r[j]:.2f}).",
                       f"خلال العام الماضي توافق نمو العملات المستقرة مع عائد البيتكوين بأفضل شكل بتأخير نحو {best_lag[j]} يومًا (ارتباط {best_r[j]:.2f}). علاقة ماضية وليست قانونًا.",
                       f"Over the past year stablecoin growth matched bitcoin's return best about {best_lag[j]} days ahead (correlation {best_r[j]:.2f}). A past relation, not a law.")
                     if strong else
                     L(f"در یک سال اخیر رابطهٔ رشد استیبل‌کوین و بازده بیت‌کوین ضعیف بوده (بهترین همبستگی {best_r[j]:.2f})؛ فعلاً به آن تکیه نکنید.",
                       f"لە ساڵی ڕابردوودا پەیوەندییەکە لاواز بووە ({best_r[j]:.2f}).",
                       f"كانت العلاقة ضعيفة خلال العام الماضي (أفضل ارتباط {best_r[j]:.2f})؛ لا تعتمد عليها الآن.",
                       f"Over the past year the link has been weak (best correlation {best_r[j]:.2f}): do not lean on it now."))
            write("leadlag", daily_doc("DefiLlama stablecoins (stablecoins.llama.fi) · " + CM, t0, cols, view, tiles, read_))

    # ---- coin-age entropy and the speed at which bitcoin is ageing (from the HODL-wave bands)
    ag = read(os.path.join(OBS, "age_btc.json"))
    if ag:
        t0, n = ag["t0"], ag["n"]
        keys = ag["bands"]
        mids = {"d1": 0.5, "w1": 4, "m1": 18.5, "m3": 60, "m6": 135, "y1": 274, "y2": 548, "y3": 913, "y4": 1278, "y5": 1644, "y7": 2192, "y10": 3105, "y10p": 4600}
        B = {k: unpack(ag["cols"]["b_" + k], n) for k in keys}
        price = unpack(ag["cols"]["price"], n)
        ent, mage = [None] * n, [None] * n
        for i in range(n):
            ps = [B[k][i] for k in keys]
            if any(not ok(p) for p in ps) or sum(ps) <= 0:
                continue
            tot = sum(ps)
            ent[i] = -sum((p / tot) * math.log(p / tot) for p in ps if p > 0) / math.log(len(keys))
            mage[i] = sum((B[k][i] / tot) * mids[k] for k in keys)
        speed = [None if i < 30 or not ok(mage[i]) or not ok(mage[i - 30]) else (mage[i] - mage[i - 30]) / 30 for i in range(n)]
        i0 = (date(2012, 1, 1) - date.fromisoformat(t0)).days
        cols = {k: v[i0:] for k, v in {"price": price, "ent": ent, "e90": [None if i < 90 or not ok(ent[i]) or not ok(ent[i - 90]) else (ent[i] - ent[i - 90]) for i in range(n)]}.items()}
        j = last(cols["ent"])
        view = {"panes": [P(L("آنتروپی سن سکه‌ها (۰ تا ۱)", "ئەنترۆپیی تەمەنی دراوەکان (٠ تا ١)", "إنتروبيا أعمار العملات (0 إلى 1)", "Coin-age entropy (0 to 1)"), [S("ent", L("آنتروپی", "ئەنترۆپی", "الإنتروبيا", "Entropy"), PUR)], fmt="num", weight=2),
                          P(L("تغییر ۹۰ روزه", "گۆڕانی ٩٠ ڕۆژ", "تغير 90 يومًا", "90-day change"), [S("e90", L("تغییر", "گۆڕان", "التغير", "Change"), PUR, "bars", neg=ACC)], fmt="num", weight=1, zero=True),
                          P(PRICE, [S("price", PRICE, INK)], fmt="usd", log=True, weight=2)]}
        tiles = [tile(L("آنتروپی امروز", "ئەنترۆپیی ئەمڕۆ", "الإنتروبيا اليوم", "Entropy today"), fnum(cols["ent"][j], 3), L(f"بالاتر از {rank_pct(cols['ent'], j):.0f}٪ تاریخ", f"لە {rank_pct(cols['ent'], j):.0f}٪ی مێژوو زیاتر", f"أعلى من {rank_pct(cols['ent'], j):.0f}% من التاريخ", f"above {rank_pct(cols['ent'], j):.0f}% of history")),
                 tile(L("تغییر ۹۰ روزه", "گۆڕانی ٩٠ ڕۆژ", "تغير 90 يومًا", "90-day change"), (("+" if ok(cols["e90"][j]) and cols["e90"][j] > 0 else "") + fnum(cols["e90"][j], 3)))]
        up = ok(cols["e90"][j]) and cols["e90"][j] > 0
        read_ = (L("سن سکه‌ها متنوع‌تر شده: مالکیت بین نسل‌های مختلف پخش‌تر است (معمولاً پس از دست‌به‌دست شدن در اوج‌ها).", "تەمەنی دراوەکان جۆراوجۆرتر بووە: خاوەندارێتی لە نێوان نەوەکاندا بڵاوترە.",
                     "صارت أعمار العملات أكثر تنوعًا: الملكية موزعة أكثر بين الأجيال (عادةً بعد تبادل الأيدي في القمم).", "Coin ages became more diverse: ownership is spread across more generations (often after coins change hands near tops).")
                 if up else
                 L("سن سکه‌ها یک‌دست‌تر شده: بخش بزرگی از سکه‌ها در یک گروه سنی جمع شده‌اند (معمولاً در فاز انباشت).", "تەمەنی دراوەکان یەکدەستتر بووە: بەشێکی گەورە لە یەک گرووپی تەمەندا کۆ بوونەتەوە.",
                   "صارت أعمار العملات أكثر تجانسًا: تجمّع جزء كبير في فئة عمرية واحدة (غالبًا في التراكم).", "Coin ages became more uniform: much of the supply sits in one age group (often during accumulation)."))
        write("entropy", daily_doc(ag["source"], "2012-01-01", cols, view, tiles, read_))

        cols = {k: v[i0:] for k, v in {"price": price, "mage": [None if not ok(x) else x / 365.25 for x in mage], "speed": speed}.items()}
        j = last(cols["speed"])
        view = {"panes": [P(L("سن میانگین تقریبی سکه‌ها (سال)", "تەمەنی ناوەندیی نزیکەیی دراوەکان (ساڵ)", "متوسط العمر التقريبي (سنوات)", "Approximate mean coin age (years)"), [S("mage", L("سن میانگین", "تەمەنی ناوەندی", "متوسط العمر", "Mean age"), BLUE)], fmt="num", weight=2),
                          P(L("سرعت پیر شدن (روز در هر روز، ۳۰ روزه)", "خێرایی پیربوون (ڕۆژ لە هەر ڕۆژێکدا)", "سرعة الشيخوخة (يوم لكل يوم)", "Ageing speed (days per day, 30-day)"), [S("speed", L("سرعت", "خێرایی", "السرعة", "Speed"), ACC, "area")], fmt="num", weight=1, zero=True,
                            marks=[M(1, L("۱: هیچ سکه‌ای جابه‌جا نشده", "١: هیچ دراوێک نەجووڵاوە", "1: لا حركة", "1: nothing moved"), TEAL)]),
                          P(PRICE, [S("price", PRICE, INK)], fmt="usd", log=True, weight=2)]}
        sp = cols["speed"][j]
        tiles = [tile(L("سن میانگین", "تەمەنی ناوەندی", "متوسط العمر", "Mean age"), fnum(cols["mage"][j], 2, L(" سال", " ساڵ", " سنة", " yr")["en"])),
                 tile(L("سرعت پیر شدن", "خێرایی پیربوون", "سرعة الشيخوخة", "Ageing speed"), fnum(sp, 2))]
        read_ = (L(f"کل سکه‌ها روزی {sp:.2f} روز پیر می‌شوند؛ نزدیک ۱ یعنی تقریباً کسی سکهٔ قدیمی خرج نمی‌کند (انباشت).", f"دراوەکان ڕۆژانە {sp:.2f} ڕۆژ پیر دەبن؛ نزیکی ١ واتە کۆکردنەوە.",
                     f"تشيخ العملات {sp:.2f} يومًا كل يوم؛ قرب 1 يعني أن أحدًا لا ينفق العملات القديمة (تراكم).", f"The supply ages {sp:.2f} days each day: near 1 means almost nobody is spending old coins (accumulation).")
                 if ok(sp) and sp >= 0.5 else
                 L(f"کل سکه‌ها روزی فقط {sp:.2f} روز پیر می‌شوند (یا جوان می‌شوند): سکه‌های قدیمی دارند خرج می‌شوند.", f"دراوەکان ڕۆژانە تەنها {sp:.2f} ڕۆژ پیر دەبن: دراوە کۆنەکان خەرج دەکرێن.",
                   f"تشيخ العملات {sp:.2f} يومًا فقط كل يوم (أو تصغر): العملات القديمة تُنفق.", f"The supply ages only {sp:.2f} days a day (or gets younger): old coins are being spent."))
        write("ageing", daily_doc(ag["source"], "2012-01-01", cols, view, tiles, read_))

    # ---- chains: breadth, ETH against BTC, address elasticity, weekend rhythm, the exchange drain and issuance absorption
    allc = {a: chain(a) for a in ("btc", "eth", "ltc", "bch", "doge", "ada", "xrp")}
    allc = {a: c for a, c in allc.items() if c}
    if "btc" in allc and len(allc) >= 5:
        t0 = "2018-01-01"
        n = (date.fromisoformat(allc["btc"][0]) + timedelta(days=allc["btc"][1] - 1) - date.fromisoformat(t0)).days + 1
        above1, above200, cnt = [0] * n, [0] * n, [0] * n
        for a, (ta, na, ca) in allc.items():
            mv = align(ta, ca["mvrv"], t0, n)
            pr = align(ta, ca["price"], t0, n)
            m200 = align(ta, sma(ca["price"], 200, 180), t0, n)
            for i in range(n):
                if ok(mv[i]) and ok(pr[i]) and ok(m200[i]):
                    cnt[i] += 1
                    above1[i] += 1 if mv[i] > 1 else 0
                    above200[i] += 1 if pr[i] > m200[i] else 0
        b1 = [None if cnt[i] < 5 else 100 * above1[i] / cnt[i] for i in range(n)]
        b2 = [None if cnt[i] < 5 else 100 * above200[i] / cnt[i] for i in range(n)]
        btcp = align(allc["btc"][0], allc["btc"][2]["price"], t0, n)
        cols = {"price": btcp, "b1": sma(b1, 7, 5), "b2": sma(b2, 7, 5)}
        j = last(cols["b1"])
        view = {"panes": [P(L("سهم شبکه‌های در سود و بالای میانگین ۲۰۰ روزه (۷ شبکه)", "بەشی تۆڕە قازانجدارەکان و سەرووی ناوەندی ٢٠٠ ڕۆژ", "حصة الشبكات الرابحة وفوق متوسط 200 يوم", "Share of chains in profit and above their 200-day mean (7 chains)"),
                            [S("b1", L("MVRV بالای ۱", "MVRV سەرووی ١", "MVRV فوق 1", "MVRV above 1"), TEAL), S("b2", L("قیمت بالای میانگین ۲۰۰ روزه", "نرخ سەرووی ناوەندی ٢٠٠ ڕۆژ", "السعر فوق متوسط 200 يوم", "Price above 200-day mean"), BLUE)],
                            fmt="pct", weight=2, zero=True, marks=[M(50, L("نیمه", "نیوە", "النصف", "half"))]),
                          P(PRICE, [S("price", PRICE, INK)], fmt="usd", log=True, weight=2)]}
        tiles = [tile(L("در سود (MVRV>۱)", "لە قازانجدا (MVRV>١)", "في ربح (MVRV>1)", "In profit (MVRV>1)"), fpct(cols["b1"][j], 0, False)),
                 tile(L("بالای میانگین ۲۰۰", "سەرووی ناوەندی ٢٠٠", "فوق متوسط 200", "Above 200-day mean"), fpct(cols["b2"][j], 0, False)),
                 tile(L("شبکه‌ها", "تۆڕەکان", "الشبكات", "Chains"), " · ".join(a.upper() for a in allc))]
        wide = ok(cols["b1"][j]) and cols["b1"][j] >= 50
        read_ = (L("بیشتر شبکه‌های بزرگ در سودند: بازار گسترده است، نه فقط بیت‌کوین.", "زۆربەی تۆڕە گەورەکان لە قازانجدان: بازاڕەکە فراوانە.",
                     "معظم الشبكات الكبرى في ربح: السوق واسع وليس البيتكوين وحده.", "Most large chains are in profit: the market is broad, not bitcoin alone.")
                 if wide else
                 L("بیشتر شبکه‌های بزرگ زیر بهای تمام‌شدهٔ دارندگانشان‌اند: بازار باریک و ضعیف است.", "زۆربەی تۆڕە گەورەکان لە خوار تێچووی خاوەنەکانیانن: بازاڕ تەسک و لاوازە.",
                   "معظم الشبكات الكبرى تحت كلفة حائزيها: السوق ضيق وضعيف.", "Most large chains sit below their holders' cost: the market is narrow and weak."))
        write("breadth", daily_doc(CM, t0, cols, view, tiles, read_))

    if "btc" in allc and "eth" in allc:
        t0 = "2016-01-01"
        tb, nb, cb = allc["btc"]
        n = (date.fromisoformat(tb) + timedelta(days=nb - 1) - date.fromisoformat(t0)).days + 1
        mb, me = align(tb, cb["mvrv"], t0, n), align(allc["eth"][0], allc["eth"][2]["mvrv"], t0, n)
        spread = [None if not ok(a) or not ok(b) else b - a for a, b in zip(mb, me)]
        z = zscore(spread, 730)
        ratio = [None if not ok(a) or not ok(b) or b == 0 else a / b for a, b in zip(align(allc["eth"][0], allc["eth"][2]["price"], t0, n), align(tb, cb["price"], t0, n))]
        cols = {"spread": spread, "z": z, "ethbtc": ratio}
        j = last(spread)
        view = {"panes": [P(L("MVRV اتریوم منهای MVRV بیت‌کوین", "MVRVی ئیتریۆم کەم MVRVی بیتکۆین", "MVRV الإيثيريوم ناقص MVRV البيتكوين", "Ethereum's MVRV minus bitcoin's"), [S("spread", L("اختلاف", "جیاوازی", "الفرق", "Spread"), PUR, "area")], fmt="num", weight=2, zero=True),
                          P(L("امتیاز Z دو ساله", "نمرەی Z دوو ساڵە", "درجة Z لعامين", "Two-year z-score"), [S("z", L("Z", "Z", "Z", "Z"), ACC)], fmt="num", weight=1, zero=True, marks=[M(2, L("+۲", "+٢", "+2", "+2"), RED), M(-2, L("−۲", "−٢", "−2", "−2"), TEAL)]),
                          P(L("نسبت ETH/BTC", "ڕێژەی ETH/BTC", "نسبة ETH/BTC", "ETH/BTC"), [S("ethbtc", L("ETH/BTC", "ETH/BTC", "ETH/BTC", "ETH/BTC"), BLUE)], fmt="num", log=True, weight=2)]}
        tiles = [tile(L("اختلاف MVRV", "جیاوازیی MVRV", "فرق MVRV", "MVRV spread"), fnum(spread[j], 3)), tile(L("امتیاز Z", "نمرەی Z", "درجة Z", "Z-score"), fnum(z[j], 2)), tile(L("ETH/BTC", "ETH/BTC", "ETH/BTC", "ETH/BTC"), fnum(ratio[j], 5))]
        zz = z[j]
        read_ = (L("دارندگان اتریوم نسبت به معمول دو سال اخیر خیلی کم‌سودتر از دارندگان بیت‌کوین‌اند: اتریوم نسبتاً «ارزان» است، اما ارزان می‌تواند ارزان‌تر شود.", "خاوەنانی ئیتریۆم بە بەراورد زۆر کەم‌قازانجترن: ئیتریۆم بە ڕێژەیی «هەرزان»ـە.",
                     "حائزو الإيثيريوم أقل ربحًا بكثير من حائزي البيتكوين مقارنة بالعامين الماضيين: الإيثيريوم «رخيص» نسبيًا، وقد يرخص أكثر.", "Ether holders are far less in profit than bitcoin holders compared with the past two years: ether is relatively cheap, and cheap can get cheaper.")
                 if ok(zz) and zz <= -1.5 else
                 L("دارندگان اتریوم نسبت به معمول دو سال اخیر خیلی پرسودتر از دارندگان بیت‌کوین‌اند: اتریوم نسبتاً «گران» شده.", "خاوەنانی ئیتریۆم زۆر قازانجدارترن: ئیتریۆم بە ڕێژەیی «گران»ـە.",
                   "حائزو الإيثيريوم أكثر ربحًا بكثير: الإيثيريوم «غالٍ» نسبيًا.", "Ether holders are far more in profit than bitcoin holders: ether has become relatively expensive.")
                 if ok(zz) and zz >= 1.5 else
                 L("سود کاغذی دارندگان اتریوم و بیت‌کوین در محدودهٔ عادی نسبت به هم است.", "قازانجی کاغەزیی هەردووکیان لە مەودای ئاساییدایە.",
                   "الربح الورقي لحائزي الاثنين ضمن النطاق المعتاد.", "Ether and bitcoin holders' paper profits are within their usual range of each other."))
        write("ethbtc", daily_doc(CM, t0, cols, view, tiles, read_))

    if "btc" in allc:
        tb, nb, cb = allc["btc"]
        # elasticity: within each 365-day window, the slope of ln(price) on ln(30-day mean active addresses)
        a30 = sma(cb["adr"], 30)
        lp = [None if not ok(x) or x <= 0 else math.log(x) for x in cb["price"]]
        la = [None if not ok(x) or x <= 0 else math.log(x) for x in a30]
        el, r2 = [None] * nb, [None] * nb
        for i in range(nb):
            if i < 400 or i % 7 and i != nb - 1:
                continue
            xs = [la[k] for k in range(i - 364, i + 1) if ok(la[k]) and ok(lp[k])]
            ys = [lp[k] for k in range(i - 364, i + 1) if ok(la[k]) and ok(lp[k])]
            if len(xs) < 300:
                continue
            mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
            sxx = sum((x - mx) ** 2 for x in xs)
            syy = sum((y - my) ** 2 for y in ys)
            if sxx <= 0 or syy <= 0:
                continue
            sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
            b = sxy / sxx
            for k in range(i, min(nb, i + 7)):
                el[k], r2[k] = b, sxy * sxy / (sxx * syy)
        i0 = (date(2012, 1, 1) - date.fromisoformat(tb)).days
        cols = {k: v[i0:] for k, v in {"price": cb["price"], "el": el, "r2": r2, "a30": a30}.items()}
        j = last(cols["el"])
        view = {"panes": [P(L("کشش قیمت به کاربران فعال (یک سال)", "نەرمیی نرخ بەرامبەر بەکارهێنەرانی چالاک (ساڵێک)", "مرونة السعر تجاه المستخدمين النشطين (عام)", "Price elasticity to active users (one year)"), [S("el", L("کشش", "نەرمی", "المرونة", "Elasticity"), ACC, "step")], fmt="num", weight=2, zero=True,
                            marks=[M(2, L("۲: قانون متکالف", "٢: یاسای مێتکاڵف", "2: قانون ميتكالف", "2: Metcalfe"), GREY)]),
                          P(L("R² (چقدر رابطه محکم بوده)", "R² (پەیوەندییەکە چەند توند بووە)", "R² (قوة العلاقة)", "R² (how tight the relation was)"), [S("r2", L("R²", "R²", "R²", "R²"), PUR)], fmt="num", weight=1, zero=True),
                          P(L("آدرس‌های فعال (۳۰ روزه)", "ناونیشانە چالاکەکان (٣٠ ڕۆژ)", "العناوين النشطة (30 يومًا)", "Active addresses (30-day mean)"), [S("a30", L("آدرس فعال", "ناونیشانی چالاک", "عنوان نشط", "Active"), BLUE)], fmt="num", log=True, weight=1),
                          P(PRICE, [S("price", PRICE, INK)], fmt="usd", log=True, weight=2)]}
        e_ = cols["el"][j]
        tiles = [tile(L("کشش امروز", "نەرمیی ئەمڕۆ", "المرونة اليوم", "Elasticity today"), fnum(e_, 2)), tile(L("R²", "R²", "R²", "R²"), fnum(cols["r2"][j], 2))]
        read_ = (L(f"در یک سال اخیر هر ۱٪ تغییر کاربران فعال با حدود {e_:.1f}٪ تغییر قیمت همراه بوده. منفی یعنی قیمت برخلاف کاربران حرکت کرده: رشد قیمت از جای دیگری (ETF، اهرم) آمده.",
                   f"لە ساڵی ڕابردوودا هەر ١٪ گۆڕانی بەکارهێنەران لەگەڵ نزیکەی {e_:.1f}٪ گۆڕانی نرخ بووە.",
                   f"خلال العام الماضي رافق كل تغير 1% في المستخدمين النشطين تغيرًا نحو {e_:.1f}% في السعر. السالب يعني أن السعر تحرّك عكس المستخدمين.",
                   f"Over the past year each 1% change in active users came with about {e_:.1f}% in price. Negative means price moved against users: the move came from elsewhere (ETFs, leverage)."))
        write("elastic", daily_doc(CM, "2012-01-01", cols, view, tiles, read_))

    vari = []
    for a in ("btc", "eth"):
        if a not in allc:
            continue
        ta, na, ca = allc[a]
        d0 = date.fromisoformat(ta)
        weeks, ws = [], []
        i = 0
        while i < na and (d0 + timedelta(days=i)).weekday() != 0:
            i += 1
        while i + 6 < na:
            v = ca["tx"][i:i + 7]
            if all(ok(x) for x in v):
                wd = sum(v[:5]) / 5
                we = sum(v[5:]) / 2
                weeks.append((d0 + timedelta(days=i)).isoformat())
                ws.append(we / wd if wd > 0 else None)
            else:
                weeks.append((d0 + timedelta(days=i)).isoformat())
                ws.append(None)
            i += 7
        s8 = sma(ws, 8, 6)
        k0 = next((k for k, w in enumerate(weeks) if w >= "2014-01-01"), 0)
        vari.append({"key": a.upper(), "label": L(a.upper(), a.upper(), a.upper(), a.upper()), "t0": weeks[k0], "step": 7,
                     "cols": {"ws": pack(ws[k0:]), "s8": pack(s8[k0:])}, "now": sig(s8[last(s8)], 4)})
    if vari:
        view = {"panes": [P(L("تراکنش‌های آخر هفته ÷ روزهای کاری", "مامەڵەکانی کۆتایی هەفتە ÷ ڕۆژانی کار", "معاملات عطلة الأسبوع ÷ أيام العمل", "Weekend transactions ÷ weekday transactions"),
                            [S("ws", L("هر هفته", "هەر هەفتە", "كل أسبوع", "Each week"), GREY, "bars"), S("s8", L("میانگین ۸ هفته", "ناوەندی ٨ هەفتە", "متوسط 8 أسابيع", "8-week mean"), ACC)], fmt="x", weight=3, marks=[M(1, L("برابر", "یەکسان", "متساوٍ", "equal"))])], "variants": True}
        bt = vari[0]["now"]
        tiles = [tile(L(f"{v['key']} امروز", f"{v['key']} ئەمڕۆ", f"{v['key']} اليوم", f"{v['key']} now"), fnum(v["now"], 3) + "×") for v in vari]
        g = 100 * abs(1 - bt)
        if bt < 0.98:
            read_ = L(f"در بیت‌کوین آخر هفته‌ها حدود {g:.0f}٪ تراکنش کمتری از روزهای کاری دارند: سهم کسب‌وکارها و نهادها پررنگ است.",
                      f"لە بیتکۆیندا کۆتایی هەفتە نزیکەی {g:.0f}٪ مامەڵەی کەمترە لە ڕۆژانی کار: بەشی کۆمپانیا و دامەزراوەکان دیارە.",
                      f"في البيتكوين، معاملات عطلة الأسبوع أقل بنحو {g:.0f}% من أيام العمل: حصة الشركات والمؤسسات بارزة.",
                      f"On bitcoin, weekends carry about {g:.0f}% fewer transactions than weekdays: businesses and institutions weigh heavily.")
        elif bt > 1.02:
            read_ = L(f"در بیت‌کوین آخر هفته‌ها حدود {g:.0f}٪ تراکنش بیشتری از روزهای کاری دارند: شبکه را بیشتر کاربران فردی و فعالیت‌های خودکار (مثل توکن‌ها و اینسکریپشن‌ها) پر می‌کنند تا کسب‌وکارها.",
                      f"لە بیتکۆیندا کۆتایی هەفتە نزیکەی {g:.0f}٪ مامەڵەی زیاترە: تۆڕەکە زیاتر بە بەکارهێنەری تاکەکەسی و چالاکیی خۆکار پڕ دەبێت.",
                      f"في البيتكوين، معاملات عطلة الأسبوع أكثر بنحو {g:.0f}% من أيام العمل: الأفراد والنشاط الآلي (كالرموز والنقوش) يملؤون الشبكة أكثر من الشركات.",
                      f"On bitcoin, weekends carry about {g:.0f}% more transactions than weekdays: individuals and automated activity (tokens, inscriptions) fill the network more than businesses do.")
        else:
            read_ = L("در بیت‌کوین آخر هفته و روزهای کاری تقریباً هم‌اندازه‌اند: ریتم هفتگی کسب‌وکارها دیده نمی‌شود.", "لە بیتکۆیندا کۆتایی هەفتە و ڕۆژانی کار نزیکەی یەکسانن.",
                      "في البيتكوين تتساوى عطلة الأسبوع وأيام العمل تقريبًا: لا يظهر إيقاع الشركات الأسبوعي.", "On bitcoin, weekends and weekdays are about even: no business week rhythm shows.")
        write("weekend", {"updated_at": now_utc().isoformat(timespec="seconds"), "source": CM, "asof": allc["btc"][0], "variants": vari, "view": view, "tiles": tiles, "read": read_, "note": NOTE})

    vari, tl = [], []
    for a in ("btc", "eth"):
        if a not in allc or "sex" not in allc[a][2]:
            continue
        ta, na, ca = allc[a]
        net = [None if not ok(x) or not ok(y) else x - y for x, y in zip(ca["fin"], ca["fout"])]
        n30 = rsum(net, 30)
        days = [None if not ok(n30[i]) or not ok(ca["sex"][i]) or n30[i] >= 0 else ca["sex"][i] / (-n30[i] / 30) for i in range(na)]
        share = [None if not ok(ca["sex"][i]) or not ok(ca["sply"][i]) or ca["sply"][i] <= 0 else 100 * ca["sex"][i] / ca["sply"][i] for i in range(na)]
        iss30 = rsum(ca["iss"], 30) if "iss" in ca else [None] * na
        absorb = [None if not ok(n30[i]) or not ok(iss30[i]) or iss30[i] <= 0 else -n30[i] / iss30[i] for i in range(na)]
        k0 = max(0, (date(2014, 1, 1) - date.fromisoformat(ta)).days)
        cols = {"days": pack([None if not ok(x) else min(x / 365.25, 50) for x in days[k0:]]), "share": pack(share[k0:]), "n30": pack(n30[k0:]), "absorb": pack(absorb[k0:])}
        j = last(share)
        vari.append({"key": a.upper(), "label": L(a.upper(), a.upper(), a.upper(), a.upper()), "t0": (date.fromisoformat(ta) + timedelta(days=k0)).isoformat(), "step": 1, "cols": cols})
        tl.append((a.upper(), days[j], share[j], n30[j], absorb[j]))
    if vari:
        view = {"panes": [P(L("سال تا خالی شدن صرافی‌ها با سرعت خروج ۳۰ روز اخیر", "ساڵ تا بەتاڵبوونی ئاڵوگۆڕگەکان", "سنوات حتى تفرغ المنصات بوتيرة 30 يومًا", "Years until exchanges run dry at the last 30 days' outflow"),
                            [S("days", L("سال (سقف ۵۰)", "ساڵ (سنووری ٥٠)", "سنوات (حد 50)", "Years (capped at 50)"), RED, "area")], fmt="num", weight=2, zero=True),
                          P(L("سهم عرضه روی صرافی‌ها", "بەشی دابینکراو لە ئاڵوگۆڕگەکان", "حصة المعروض على المنصات", "Share of supply on exchanges"), [S("share", L("سهم", "بەش", "الحصة", "Share"), BLUE)], fmt="pct", weight=1),
                          P(L("خروج خالص ÷ سکهٔ تازه استخراج‌شده (۳۰ روز)", "دەرچوونی پوختە ÷ دراوی نوێ (٣٠ ڕۆژ)", "صافي الخروج ÷ الإصدار الجديد (30 يومًا)", "Net outflow ÷ newly issued coins (30 days)"),
                            [S("absorb", L("جذب عرضهٔ تازه", "هەڵمژینی دابینکراوی نوێ", "امتصاص الإصدار", "Issuance absorbed"), TEAL, "bars", neg=RED)], fmt="x", weight=1, zero=True, marks=[M(1, L("۱: همهٔ سکهٔ تازه", "١: هەموو دراوی نوێ", "1: كل الإصدار", "1: all new coins"))]),
                          P(L("خالص ورود ۳۰ روزه", "پوختەی هاتن ٣٠ ڕۆژ", "صافي الدخول 30 يومًا", "Net inflow, 30 days"), [S("n30", L("ورود منهای خروج", "هاتن کەم چوون", "الداخل ناقص الخارج", "In minus out"), RED, "bars", neg=TEAL)], fmt="num", weight=1, zero=True)],
                "variants": True}
        tiles = []
        for sym, dd, sh, nn, ab in tl:
            tiles.append(tile(L(f"{sym}: تا خالی شدن", f"{sym}: تا بەتاڵبوون", f"{sym}: حتى النفاد", f"{sym}: until dry"), "∞" if not ok(dd) else fnum(dd / 365.25, 1, " y"), fpct(sh, 1, False)))
            tiles.append(tile(L(f"{sym}: جذب عرضهٔ تازه", f"{sym}: هەڵمژینی نوێ", f"{sym}: امتصاص الإصدار", f"{sym}: issuance absorbed"), fnum(ab, 2) + "×"))
        sym, dd, sh, nn, ab = tl[0]
        read_ = (L(f"با سرعت خروج ۳۰ روز اخیر، ذخیرهٔ {sym} صرافی‌ها در حدود {dd / 365.25:.1f} سال تمام می‌شود و خروج‌ها {ab:.1f} برابر سکهٔ تازه استخراج‌شده است. یک برون‌یابی ساده است، نه پیش‌بینی.",
                   f"بە خێرایی دەرچوونی ٣٠ ڕۆژی ڕابردوو، {sym}ی ئاڵوگۆڕگەکان لە نزیکەی {dd / 365.25:.1f} ساڵدا تەواو دەبێت.",
                   f"بوتيرة خروج آخر 30 يومًا تنفد احتياطيات {sym} في المنصات خلال نحو {dd / 365.25:.1f} سنة، والخروج يعادل {ab:.1f} ضعف الإصدار الجديد. استقراء بسيط لا تنبؤ.",
                   f"At the last 30 days' pace, exchanges' {sym} would run out in about {dd / 365.25:.1f} years, and outflows equal {ab:.1f}× the newly issued coins. A simple extrapolation, not a forecast.")
                 if ok(dd) else
                 L(f"در ۳۰ روز اخیر {sym} بیشتری وارد صرافی‌ها شده تا خارج؛ ساعت خالی شدن متوقف است.", f"لە ٣٠ ڕۆژی ڕابردوودا {sym}ی زیاتر چووەتە ناو ئاڵوگۆڕگەکان؛ کاتژمێرەکە وەستاوە.",
                   f"دخل إلى المنصات {sym} أكثر مما خرج في 30 يومًا؛ ساعة النفاد متوقفة.", f"More {sym} went onto exchanges than left them over 30 days: the drain clock is stopped."))
        write("drain", {"updated_at": now_utc().isoformat(timespec="seconds"), "source": CM, "asof": allc["btc"][0], "variants": vari, "view": view, "tiles": tiles, "read": read_, "note": NOTE})

    # ---- history's closest twin: the past 180-day bitcoin paths most like the last 180 days
    if "btc" in allc:
        tb, nb, cb = allc["btc"]
        lp = [None if not ok(x) or x <= 0 else math.log(x) for x in cb["price"]]
        W, F = 180, 120
        end = last(lp)
        cur = lp[end - W + 1:end + 1]
        if all(ok(x) for x in cur):
            def norm(a):
                m = sum(a) / len(a)
                s = math.sqrt(sum((x - m) ** 2 for x in a) / len(a)) or 1
                return [(x - m) / s for x in a]
            cz = norm(cur)
            cand = []
            for s0 in range(0, end - W - F - 365, 3):
                seg = lp[s0:s0 + W]
                if not all(ok(x) for x in seg) or not all(ok(x) for x in lp[s0 + W:s0 + W + F]):
                    continue
                sz = norm(seg)
                r = sum(a * b for a, b in zip(cz, sz)) / W
                cand.append((r, s0))
            cand.sort(reverse=True)
            picks = []
            for r, s0 in cand:
                if all(abs(s0 - p) > 365 for _, p in picks):
                    picks.append((r, s0))
                if len(picks) == 3:
                    break
            base = cur[-1]
            twins, table_rows = [], []
            colors = [BLUE, PUR, TEAL]
            for ix, (r, s0) in enumerate(picks):
                path = lp[s0:s0 + W + F]
                # scaled to today's level and to today's volatility, so the shape is compared, not the size
                sd_c = math.sqrt(sum((cur[k] - cur[k - 1]) ** 2 for k in range(1, W)) / (W - 1))
                sd_p = math.sqrt(sum((path[k] - path[k - 1]) ** 2 for k in range(1, W)) / (W - 1)) or 1
                sc = sd_c / sd_p
                pts = [sig(math.exp(base + (path[k] - path[W - 1]) * sc)) for k in range(W + F)]
                d = (date.fromisoformat(tb) + timedelta(days=s0)).isoformat()
                after = 100 * (math.exp((path[W + F - 1] - path[W - 1]) * sc) - 1)
                after_raw = 100 * (math.exp(path[W + F - 1] - path[W - 1]) - 1)
                twins.append({"k": f"t{ix}", "from": d, "r": round(r, 3), "after": sig(after, 4), "raw": sig(after_raw, 4)})
                table_rows.append([d, fnum(r, 2), fpct(after_raw, 0), fpct(after, 0)])
            xs = list(range(-W + 1, F + 1))
            cols = {"x": xs, "now": [sig(math.exp(v)) for v in cur] + [None] * F}
            series = [S("now", L("۱۸۰ روز اخیر", "١٨٠ ڕۆژی ڕابردوو", "آخر 180 يومًا", "Last 180 days"), INK, width=2.5)]
            pts_all = {}
            for ix, (r, s0) in enumerate(picks):
                path = lp[s0:s0 + W + F]
                sd_c = math.sqrt(sum((cur[k] - cur[k - 1]) ** 2 for k in range(1, W)) / (W - 1))
                sd_p = math.sqrt(sum((path[k] - path[k - 1]) ** 2 for k in range(1, W)) / (W - 1)) or 1
                sc = sd_c / sd_p
                pts_all[f"t{ix}"] = [sig(math.exp(base + (path[k] - path[W - 1]) * sc)) for k in range(W + F)]
                d = twins[ix]["from"]
                series.append(S(f"t{ix}", L(f"همزاد {ix + 1}: از {d}", f"هاوشێوە {ix + 1}: لە {d}", f"التوأم {ix + 1}: من {d}", f"Twin {ix + 1}: from {d}"), colors[ix]))
            view = {"xmode": "num", "panes": [P(L("مسیر امروز و نزدیک‌ترین همزادهای تاریخی (هم‌مقیاس با امروز)", "ڕێڕەوی ئەمڕۆ و نزیکترین هاوشێوە مێژووییەکان", "مسار اليوم وأقرب توائمه التاريخية", "Today's path and its closest historical twins (scaled to today)"),
                                                series, fmt="usd", log=True, weight=3)], "vlines": [{"x": 0, "label": L("امروز", "ئەمڕۆ", "اليوم", "today")}]}
            avg = sum(t["after"] for t in twins) / len(twins) if twins else None
            tiles = [tile(L(f"همزاد {i + 1}", f"هاوشێوە {i + 1}", f"التوأم {i + 1}", f"Twin {i + 1}"), t["from"], L(f"شباهت {t['r']:.2f}", f"لێکچوون {t['r']:.2f}", f"تشابه {t['r']:.2f}", f"similarity {t['r']:.2f}")) for i, t in enumerate(twins)]
            ups = sum(1 for t in twins if t["after"] > 0)
            read_ = L(f"در {ups} همزاد از {len(twins)} همزاد، ۱۲۰ روز بعد قیمت بالاتر بود (میانگین {avg:+.0f}٪ هم‌مقیاس‌شده). شباهت شکل، آینده را تضمین نمی‌کند؛ این ابزار برای دیدن الگوهای گذشته است.",
                      f"لە {ups} هاوشێوە لە {len(twins)}، ١٢٠ ڕۆژ دواتر نرخ بەرزتر بوو (ناوەندی {avg:+.0f}٪). لێکچوونی شێوە داهاتوو گەرەنتی ناکات.",
                      f"في {ups} من {len(twins)} توائم كان السعر أعلى بعد 120 يومًا (متوسط {avg:+.0f}% بعد المعايرة). تشابه الشكل لا يضمن المستقبل.",
                      f"In {ups} of {len(twins)} twins the price was higher 120 days later (mean {avg:+.0f}%, scaled). A similar shape does not promise the future: this is for seeing past patterns.")
            cols.update(pts_all)
            doc = {"updated_at": now_utc().isoformat(timespec="seconds"), "source": CM, "asof": (date.fromisoformat(tb) + timedelta(days=end)).isoformat(),
                   "xcols": cols, "view": view, "tiles": tiles, "read": read_, "note": NOTE, "twins": twins,
                   "table": {"head": [L("آغاز همزاد", "دەستپێکی هاوشێوە", "بداية التوأم", "Twin starts"), L("شباهت", "لێکچوون", "التشابه", "Similarity"),
                                      L("۱۲۰ روز بعد (واقعی)", "١٢٠ ڕۆژ دواتر (ڕاستەقینە)", "بعد 120 يومًا (فعلي)", "120 days later (actual)"), L("هم‌مقیاس با امروز", "بە پێوەری ئەمڕۆ", "بمقياس اليوم", "Scaled to today")],
                             "rows": table_rows}}
            write("twin", doc)


# ================================================================ summary for the hub and the bot
def summary():
    out = {}
    for f in sorted(os.listdir(OUT)) if os.path.isdir(OUT) else []:
        if not f.endswith(".json") or f.startswith("_"):
            continue
        j = read(os.path.join(OUT, f))
        if j and j.get("read"):
            out[f[:-5]] = {"asof": j.get("asof"), "read": j["read"]}
    path = os.path.join(OBS, "rare_now.json")
    doc = {"pages": out}
    old = read(path)
    if old and old.get("pages") == out:
        return
    doc["updated_at"] = now_utc().isoformat(timespec="seconds")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))


def main():
    only = set(filter(None, (os.environ.get("OBS_RARE_ONLY") or "").split(",")))
    steps = [("local", local_pages, None)]
    if due("brk", os.path.join(OUT, "costbasis.json")):
        steps.append(("brk", lambda: brk_pages({}), os.path.join(OUT, "costbasis.json")))
    if due("fund", os.path.join(OUT, "fundflow.json")):
        steps.append(("fund", fundflow_page, os.path.join(OUT, "fundflow.json")))
    if due("dev", os.path.join(OUT, "devpulse.json")):
        steps.append(("dev", dev_page, os.path.join(OUT, "devpulse.json")))
    for name, f, path in steps:
        if only and name not in only:
            continue
        print("rare:", name)
        try:
            f()
            if path:
                mark_looked(path)
        except Exception as e:  # noqa: BLE001
            print("  failed:", name, e)
    summary()


if __name__ == "__main__":
    main()
