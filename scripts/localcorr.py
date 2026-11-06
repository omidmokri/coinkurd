#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ماتریس همبستگی محلی — کریپتو در برابر اقتصاد ایران

آیا بیت‌کوین برای کاربر ایرانی «پناهگاه» بوده یا فقط با دلار هم‌حرکت شده؟
ضریب همبستگی پیرسون بازده لگاریتمی روزانه در بازه‌های ۷ روز تا ۱ سال، بین:
  دلار آزاد تهران · تتر بازار ایران · بیت‌کوین و اتریوم به تومان · طلای ۱۸ عیار · سکه امامی ·
  بیت‌کوین به دلار (جهانی) · انس طلا (PAXG)

دادهٔ روزانه (ساعت ۱۲:۰۰ UTC = ۱۵:۳۰ تهران):
  دلار و تتر: آرشیو کامل کانال‌های عمومی تیک قیمت (@NerkhDollarIRT ، @USDTTetherp) — برای هر روز با تخمین
    شمارهٔ پست از روی زمان، نزدیک‌ترین تیک همان روز خوانده می‌شود؛ بک‌فیل تدریجی تا ۴۰۰ روز (هر اجرا سقف درخواست دارد)
  طلای ۱۸ و سکه: تابلوی @ttprice (این کانال پست‌های قدیمی را پاک می‌کند، پس از امروز به بعد جمع می‌شود)
  بیت‌کوین/اتریوم/طلای جهانی: کندل ۱۲ ساعتهٔ Binance (قیمت باز شدن ساعت ۱۲:۰۰ UTC)
  بیت‌کوین تومانی = BTCUSDT × تتر ایران
مسکن و بورس: منبع روزانهٔ قابل‌اتکا و در دسترس ندارند؛ عمداً حذف شده‌اند (در صفحه ذکر می‌شود).

خروجی: data/localcorr.json (عمومی) + data/iran_daily.json (سری‌های روزانه و حافظهٔ بک‌فیل)
"""
import math
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reality_common as R  # noqa: E402

SAMPLE_H = 12
TEHRAN = R.timedelta(hours=3, minutes=30)
BACK_DAYS = int(os.environ.get("LOCALCORR_DAYS", "400"))
BUDGET = int(os.environ.get("LOCALCORR_PAGES", "60"))
NEAR_MIN = 90                        # accept a tick within ±90 min of the sampling time, same Tehran day
CH = {
    "USD": ("NerkhDollarIRT", re.compile(r"دلار\s*تهران[^\d]{0,15}([\d,]{5,})\s*(خرید|فروش|معامله)")),
    "USDT": ("USDTTetherp", re.compile(r"تتر\s*\[?\s*usdt\s*\]?[^\d]{0,6}([\d,]{5,})\s*(خرید|فروش|معامله)", re.I)),
}
ASSETS = ["USD", "USDT", "BTC_T", "ETH_T", "GOLD18", "COIN", "BTC_USD", "XAU_USD"]
L = R.L
NAMES = {
    "USD": L("دلار آزاد تهران", "دۆلاری ئازادی تاران", "Free-market USD (Tehran)"),
    "USDT": L("تتر (بازار ایران)", "تەتەر (بازاڕی ئێران)", "Tether (Iran market)"),
    "BTC_T": L("بیت‌کوین به تومان", "بیتکۆین بە تمەن", "Bitcoin in toman"),
    "ETH_T": L("اتریوم به تومان", "ئیتریۆم بە تمەن", "Ether in toman"),
    "GOLD18": L("طلای ۱۸ عیار (گرم)", "زێڕی ١٨ (گرام)", "18k gold (gram)"),
    "COIN": L("سکه امامی", "زێڕی ئیمامی", "Emami gold coin"),
    "BTC_USD": L("بیت‌کوین به دلار (جهانی)", "بیتکۆین بە دۆلار (جیهانی)", "Bitcoin in USD (global)"),
    "XAU_USD": L("انس طلا (جهانی)", "ئۆنسی زێڕ (جیهانی)", "Gold ounce (global)"),
}
WINDOWS = [7, 30, 90, 180, 365]
BOUNDS = (10_000, 50_000_000)        # plausible toman range for USD / USDT ticks


def tehran_day(dt):
    return (dt + TEHRAN).strftime("%Y-%m-%d")


def sample_time(d):
    return R.parse_iso(f"{d}T{SAMPLE_H:02d}:00:00+00:00")


# ------------------------------------------------------------------ archive sampler
class Sampler:
    def __init__(self, key, st, budget):
        self.key = key
        self.channel, self.rx = CH[key]
        self.cs = st.setdefault("ch", {}).setdefault(self.channel, {"anchors": [], "tried": {}})
        self.budget = budget
        self.calls = 0

    def anchors(self):
        return sorted({a[0]: a for a in self.cs["anchors"]}.values())

    def add_anchor(self, p):
        self.cs["anchors"].append([p["id"], R.ms(p["t"])])

    def trim(self):
        a = self.anchors()
        if len(a) > 600:                                  # keep an even spread
            step = len(a) / 600
            a = [a[int(i * step)] for i in range(600)] + [a[-1]]
        self.cs["anchors"] = a

    def estimate(self, t_ms):
        a = self.anchors()
        if len(a) < 2:
            return None
        for (i1, t1), (i2, t2) in zip(a, a[1:]):
            if t1 <= t_ms <= t2 and t2 > t1:
                return int(i1 + (i2 - i1) * (t_ms - t1) / (t2 - t1))
        # extrapolate with the rate of the nearest anchors that are at least 6 hours apart
        if t_ms < a[0][1]:
            base = a[0]
            far = next((x for x in a[1:] if x[1] - base[1] >= 6 * R.H), a[-1])
        else:
            base = a[-1]
            far = next((x for x in reversed(a[:-1]) if base[1] - x[1] >= 6 * R.H), a[0])
        if far[1] == base[1]:
            return None
        rate = (far[0] - base[0]) / (far[1] - base[1])
        return int(base[0] + rate * (t_ms - base[1]))

    def page(self, before=None):
        if self.calls >= self.budget:
            raise StopIteration
        self.calls += 1
        pg = R.tg_page(self.channel, before=before)
        for p in pg[:1] + pg[-1:]:
            self.add_anchor(p)
        time.sleep(0.4)
        return pg

    def price(self, p):
        m = self.rx.search(R.norm_fa(p["text"]))
        if not m:
            return None
        v = R.num(m.group(1))
        return v if v and BOUNDS[0] <= v <= BOUNDS[1] else None

    def sample(self, d):
        """-> (value, iso) | "none" (no ticks that day) | None (not resolved this run)"""
        T = sample_time(d)
        t_ms = R.ms(T)
        est = self.estimate(t_ms)
        if est is None:
            pg = self.page()
            est = self.estimate(t_ms)
            if est is None:
                return None
        for _ in range(4):
            pg = self.page(before=max(2, est + 10))
            if not pg:
                return "none" if est < (self.anchors()[0][0] if self.anchors() else 0) + 50 else None
            day_posts = [(p, self.price(p)) for p in pg if tehran_day(p["t"]) == d]
            day_posts = [(p, v) for p, v in day_posts if v]
            if day_posts:
                before = [x for x in day_posts if x[0]["t"] <= T]
                after = [x for x in day_posts if x[0]["t"] > T]
                best = before[-1] if before else after[0]
                gap = abs((best[0]["t"] - T).total_seconds()) / 60
                covers = pg[0]["t"] <= T <= pg[-1]["t"]
                if gap <= NEAR_MIN or covers:
                    return round(best[1]), R.iso(best[0]["t"])
            elif pg[0]["t"] <= T <= pg[-1]["t"]:
                # the page spans the sampling time and holds no tick of that day before/after → quiet day
                if tehran_day(pg[0]["t"]) < d < tehran_day(pg[-1]["t"]) or not any(tehran_day(p["t"]) == d for p in pg):
                    return "none"
            est = self.estimate(t_ms)
            if est is None:
                return None
        return None


def backfill(st, now):
    series = st.setdefault("series", {})
    today = now.strftime("%Y-%m-%d")
    days = []
    start = 0 if now.hour >= SAMPLE_H + 1 else 1           # today's sample once 13:00 UTC has passed
    for k in range(start, BACK_DAYS):
        days.append((now - R.timedelta(days=k)).strftime("%Y-%m-%d"))
    for key in ("USD", "USDT"):
        s = Sampler(key, st, BUDGET // 2)
        ser = series.setdefault(key, {})
        tried = s.cs["tried"]
        done = 0
        try:
            for d in days:
                if d in ser or tried.get(d) == "none":
                    continue
                if tried.get(d, "").startswith("fail") and int(tried[d][4:] or 0) >= 3:
                    continue
                res = s.sample(d)
                if res == "none":
                    tried[d] = "none"
                elif res:
                    ser[d] = res[0]
                    tried.pop(d, None)
                    done += 1
                else:
                    n = int(tried.get(d, "fail0")[4:] or 0) + 1 if str(tried.get(d, "")).startswith("fail") else 1
                    tried[d] = f"fail{n}"
        except StopIteration:
            pass
        except Exception as ex:  # noqa: BLE001
            print(f"  {key} sampler: {ex}")
        s.trim()
        cut = (now - R.timedelta(days=BACK_DAYS + 5)).strftime("%Y-%m-%d")
        s.cs["tried"] = {k: v for k, v in tried.items() if k >= cut}
        print(f"  {key}: +{done} days ({s.calls} pages) — have {len(ser)} days, oldest {min(ser) if ser else None}")
    _ = today


def forward_board(st, now):
    """gold & coin (and a USD/USDT fallback) from the @ttprice board once the daily sampling time has passed"""
    if now < sample_time(now.strftime("%Y-%m-%d")):
        return
    d = now.strftime("%Y-%m-%d")
    ser = st.setdefault("series", {})
    if d in ser.get("GOLD18", {}) and d in ser.get("COIN", {}):
        return
    try:
        import bot_iran as IR
        board = IR.ttprice()
    except Exception as ex:  # noqa: BLE001
        print("  ttprice:", ex)
        return
    if not board or not board.get("time"):
        return
    bt = R.parse_iso(board["time"])
    if tehran_day(bt) != tehran_day(now) or abs((now - bt).total_seconds()) > 6 * 3600:
        return
    fiat = board.get("fiat") or {}
    for key, src in (("GOLD18", "GOLD_18"), ("COIN", "COIN_EMAMI")):
        v = (fiat.get(src) or [None])[0]
        if v:
            ser.setdefault(key, {})[d] = round(v)
    usd = (fiat.get("USD") or [None])[0] or board.get("free_usd")
    if usd and d not in ser.get("USD", {}):
        ser.setdefault("USD", {})[d] = round(usd)
    ex = [e for e in board.get("exchanges", []) if e.get("buy") and e.get("sell")]
    if ex and d not in ser.get("USDT", {}):
        ser.setdefault("USDT", {})[d] = round(sum((e["buy"] + e["sell"]) / 2 for e in ex) / len(ex))


def global_prices(st, now):
    ser = st.setdefault("series", {})
    if st.get("global_at") == now.strftime("%Y-%m-%d %H") and os.environ.get("LOCALCORR_FORCE") != "1":
        return
    for key, coin in (("BTC_USD", "BTC"), ("ETH_USD", "ETH"), ("XAU_USD", "PAXG")):
        try:
            bars = R.klines(coin, "12h", limit=1000)
        except Exception as ex:  # noqa: BLE001
            print(f"  binance {coin}:", ex)
            continue
        s = ser.setdefault(key, {})
        for b in bars:
            dt = R.from_ms(b["t"])
            if dt.hour == SAMPLE_H:
                s[dt.strftime("%Y-%m-%d")] = b["o"]
    st["global_at"] = now.strftime("%Y-%m-%d %H")


def derived(series):
    out = {k: dict(v) for k, v in series.items() if k in ASSETS or k == "ETH_USD"}
    usdt = series.get("USDT", {})
    for key, src in (("BTC_T", "BTC_USD"), ("ETH_T", "ETH_USD")):
        out[key] = {d: round(v * usdt[d]) for d, v in series.get(src, {}).items() if d in usdt}
    out.pop("ETH_USD", None)
    return out


# ------------------------------------------------------------------ statistics
def returns(a, b, sa, sb, d_from):
    """aligned log returns of two series over their common dates ≥ d_from (gaps up to 4 days allowed)"""
    common = sorted(d for d in sa if d in sb and d >= d_from)
    ra, rb = [], []
    for d1, d2 in zip(common, common[1:]):
        if R.days_between(d1 + "T00:00:00", d2 + "T00:00:00") > 4:
            continue
        if sa[d1] > 0 and sa[d2] > 0 and sb[d1] > 0 and sb[d2] > 0:
            ra.append(math.log(sa[d2] / sa[d1]))
            rb.append(math.log(sb[d2] / sb[d1]))
    return ra, rb


def var(xs):
    if len(xs) < 2:
        return None
    m = sum(xs) / len(xs)
    return sum((x - m) ** 2 for x in xs) / (len(xs) - 1)


def cov(xs, ys):
    if len(xs) < 2:
        return None
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (len(xs) - 1)


def analyse(S, now):
    today = now.strftime("%Y-%m-%d")
    present = [a for a in ASSETS if len(S.get(a, {})) >= 3]
    out = {"windows": {}, "rolling": {}, "changes": {}, "last": {}, "coverage": {}, "decomp": {}, "haven": {}}
    for w in WINDOWS:
        d_from = (now - R.timedelta(days=w)).strftime("%Y-%m-%d")
        m, n = {}, {}
        for a in present:
            m[a], n[a] = {}, {}
            for b in present:
                if a == b:
                    m[a][b], n[a][b] = 1.0, None
                    continue
                ra, rb = returns(a, b, S[a], S[b], d_from)
                r = R.pearson(ra, rb) if len(ra) >= 4 else None
                m[a][b] = None if r is None else round(r, 2)
                n[a][b] = len(ra)
        out["windows"][f"{w}d"] = {"from": d_from, "to": today, "matrix": m, "n": n}
    # rolling 30-day correlation with the free dollar
    usd = S.get("USD", {})
    for a in ("BTC_T", "BTC_USD", "GOLD18", "COIN", "XAU_USD"):
        if a not in present or "USD" not in present:
            continue
        pts = []
        dates = sorted(d for d in usd if d in S[a])
        for d in dates[-365:]:
            d0 = (R.parse_iso(d + "T00:00:00") - R.timedelta(days=30)).strftime("%Y-%m-%d")
            ra, rb = returns(a, "USD", {k: v for k, v in S[a].items() if k <= d}, {k: v for k, v in usd.items() if k <= d}, d0)
            if len(ra) >= 12:
                r = R.pearson(ra, rb)
                if r is not None:
                    pts.append([d, round(r, 3)])
        out["rolling"][a] = pts
    # changes & last values
    for a in present:
        s = S[a]
        ds = sorted(s)
        last = ds[-1]
        out["last"][a] = {"d": last, "v": s[last]}
        out["coverage"][a] = {"from": ds[0], "n": len(ds)}
        ch = {}
        for k, days in (("7d", 7), ("30d", 30), ("90d", 90), ("1y", 365)):
            ref = (R.parse_iso(last + "T00:00:00") - R.timedelta(days=days)).strftime("%Y-%m-%d")
            prior = [d for d in ds if d <= ref]
            if prior and (R.days_between(prior[-1] + "T00:00:00", ref + "T00:00:00") <= 4):
                ch[k] = round((s[last] / s[prior[-1]] - 1) * 100, 2)
        out["changes"][a] = ch
    # how much of the toman-bitcoin swing came from the dollar/tether and how much from bitcoin itself
    if all(a in present for a in ("BTC_T", "USDT", "BTC_USD")):
        for w in (30, 90, 365):
            d_from = (now - R.timedelta(days=w)).strftime("%Y-%m-%d")
            common = {d for d in S["BTC_USD"] if d in S["USDT"] and d >= d_from}
            sb = {d: S["BTC_USD"][d] for d in common}
            su = {d: S["USDT"][d] for d in common}
            rb, ru = returns("BTC_USD", "USDT", sb, su, d_from)
            if len(rb) >= 10:
                vb, vu, c = var(rb), var(ru), cov(rb, ru)
                tot = vb + vu + 2 * c
                if tot > 0:
                    out["decomp"][f"{w}d"] = {"btc": round(100 * (vb + c) / tot, 1), "toman": round(100 * (vu + c) / tot, 1), "n": len(rb),
                                              "vol_btc_t": round(math.sqrt(tot * 365) * 100, 1), "vol_usdt": round(math.sqrt(vu * 365) * 100, 1)}
    # haven test: what did each asset do on the days the free dollar jumped (toman lost value fast)?
    if "USD" in present:
        d_from = (now - R.timedelta(days=365)).strftime("%Y-%m-%d")
        jumps = {}
        uds = sorted(d for d in usd if d >= d_from)
        for d1, d2 in zip(uds, uds[1:]):
            if R.days_between(d1 + "T00:00:00", d2 + "T00:00:00") <= 4 and usd[d2] / usd[d1] - 1 >= 0.01:
                jumps[d2] = (d1, usd[d2] / usd[d1] - 1)
        res = {"n": len(jumps), "usd_avg": round(100 * sum(v[1] for v in jumps.values()) / len(jumps), 2) if jumps else None, "assets": {}}
        for a in present:
            if a == "USD" or a.endswith("_USD"):      # compare toman holdings only (a dollar asset vs the toman would mix units)
                continue
            rs = [S[a][d2] / S[a][d1] - 1 for d2, (d1, _) in jumps.items() if d1 in S[a] and d2 in S[a]]
            beat = [S[a][d2] / S[a][d1] - 1 >= j for d2, (d1, j) in jumps.items() if d1 in S[a] and d2 in S[a]]
            if rs:
                res["assets"][a] = {"n": len(rs), "avg": round(100 * sum(rs) / len(rs), 2), "beat_usd": round(100 * sum(beat) / len(beat))}
        res["top"] = [{"d": d, "usd": round(j * 100, 2), "btc_t": None if not (d1 in S.get("BTC_T", {}) and d in S.get("BTC_T", {}))
                       else round((S["BTC_T"][d] / S["BTC_T"][d1] - 1) * 100, 2)}
                      for d, (d1, j) in sorted(jumps.items(), key=lambda kv: -kv[1][1])[:8]]
        out["haven"] = res
    # normalised co-movement (last 365 days, 100 = first common day)
    base_keys = [a for a in ("USD", "USDT", "BTC_T", "BTC_USD", "GOLD18", "COIN", "XAU_USD") if a in present]
    d_from = (now - R.timedelta(days=365)).strftime("%Y-%m-%d")
    norm = {}
    for a in base_keys:
        ds = sorted(d for d in S[a] if d >= d_from)
        if len(ds) >= 3:
            b0 = S[a][ds[0]]
            norm[a] = [[d, round(S[a][d] / b0 * 100, 2)] for d in ds]
    out["norm"] = norm
    out["present"] = present
    return out


def main():
    now = R.now()
    st = R.load("iran_daily.json", {})
    try:
        backfill(st, now)
    except Exception as ex:  # noqa: BLE001
        print("  backfill failed:", ex)
    try:
        forward_board(st, now)
    except Exception as ex:  # noqa: BLE001
        print("  board failed:", ex)
    try:
        global_prices(st, now)
    except Exception as ex:  # noqa: BLE001
        print("  global failed:", ex)
    st["updated_at"] = R.iso(now)
    R.save("iran_daily.json", st)
    S = derived(st.get("series", {}))
    res = analyse(S, now)
    res.update({"updated_at": R.iso(now), "names": NAMES, "assets": ASSETS, "sample": f"{SAMPLE_H:02d}:00 UTC",
                "excluded": {"housing": "no reliable daily source", "tse": "no reliable daily source reachable from our servers"},
                "sources": {"USD": "t.me/NerkhDollarIRT", "USDT": "t.me/USDTTetherp", "GOLD18": "t.me/ttprice", "COIN": "t.me/ttprice",
                            "BTC_USD": "Binance BTCUSDT 12h", "XAU_USD": "Binance PAXGUSDT 12h", "BTC_T": "BTCUSDT × Iranian tether"}})
    R.save("localcorr.json", res)
    w = res["windows"].get("90d", {}).get("matrix", {})
    print("localcorr:", {a: c for a, c in res["coverage"].items()}, "| 90d BTC_T~USD", (w.get("BTC_T") or {}).get("USD"),
          "| decomp", res.get("decomp"), "| haven n", (res.get("haven") or {}).get("n"))


if __name__ == "__main__":
    main()
