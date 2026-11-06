#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
آشکارساز خروج خاموش — Silent Exit Detector

«خروج خاموش» یعنی سرمایهٔ بزرگ در حال کم‌کردن موقعیت است در حالی که حرف بازار هنوز صعودی یا خنثی است.
برای BTC و ETH، هر ساعت:

  نشانه‌های «عمل» (Action) — هر کدام نسبت به تاریخچهٔ خودش سنجیده می‌شود (صدک)، نه با عدد ثابت:
    A1 ورود نهنگ‌ها به صرافی   جریان خالص ۷۲ ساعته به صرافی‌ها (Whale Alert: from unknown → #Exchange منهای خروج)
                               در ۱۵٪ بالای ۹۰ روز اخیر و مثبت
    A2 فروش تهاجمی با قیمت ثابت  عدم‌توازن خریدار/فروشندهٔ تیکر (Binance، ۷۲ ساعت) در ۱۵٪ پایین ۱۸۰ روز،
                               در حالی که قیمت ۷۲ ساعته بیش از ۲٪ نریخته (فروش به داخل قدرت)
    A3 ضعف تقاضای آمریکا        پرمیوم کوین‌بیس (BTC-USD در برابر BTCUSDT بایننس) در ۱۵٪ پایین ۹۰ روز
  «حرف» (Talk) — هنوز نزولی نیست اگر میانگین این‌ها ≥ ۰٫۴۵ باشد:
    ترس و طمع، صدک فاندینگ OKX، شاخص احساسات اخبار انتخاب، رأی اکثریت شورای هوش مصنوعی
  شرط کنار: اوپن‌اینترست ۷۲ ساعته بیش از ۸٪ سقوط نکرده باشد (بازار هنوز فعال است)

  امتیاز عمل = مجموع شدت نشانه‌ها (صدک ≤۱۵٪ → ۰٫۵ تا صدک ≤۳٪ → ۱)
  زرد ≥ ۰٫۵ · نارنجی ≥ ۱ · قرمز ≥ ۲ (فقط وقتی «حرف» هنوز نزولی نیست)

بک‌تست روزانه روی همین قواعد (با نشانه‌هایی که تاریخچه دارند) و معیار موفقیت گزارش:
  «دست‌کم ۷۰٪ هشدارهای قرمز با افت معنادار (بازده ۷ روزه بدتر از ۳٪-) همراه باشد» — در کنار نرخ پایه.
هشدارهای نارنجی/قرمز زنده در دفتر عملکرد سیگنال‌ها (ledger.py) با قفل زمانی ثبت می‌شوند.

خروجی: data/silent_exit.json (عمومی) + data/silent_exit_store.json (حافظهٔ داخلی)
"""
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reality_common as R  # noqa: E402

ASSETS = ["BTC", "ETH"]
CB = {"BTC": "BTC-USD", "ETH": "ETH-USD"}
OKX = {"BTC": "BTC-USDT-SWAP", "ETH": "ETH-USDT-SWAP"}
WA_CHANNEL = "whale_alert_io"
WA_KEEP_DAYS = 200
WA_PAGES = int(os.environ.get("SILENT_WA_PAGES", "40"))      # backfill budget per run (20 posts per page)
LEVELS = ["none", "yellow", "orange", "red"]
L = R.L

EXCH = {"binance", "binanceus", "coinbase", "coinbaseinstitutional", "coinbaseprime", "kraken", "bitfinex", "okx", "okex",
        "okcoin", "bybit", "cryptocom", "gemini", "bitstamp", "kucoin", "htx", "huobi", "gateio", "gate", "bitget", "mexc",
        "upbit", "bithumb", "robinhood", "deribit", "poloniex", "bitflyer", "bitpanda", "bitso", "coinone", "korbit", "luno",
        "bitkub", "indodax", "btcturk", "paribu", "whitebit", "bitmart", "lbank", "cexio", "bitvavo", "bitbank", "coincheck",
        "exmo", "phemex", "woox", "ascendex", "hashkey", "bullish", "bitmex", "bingx", "hitbtc", "bitrue", "xtcom", "bitkub",
        "kraken", "bitglobal", "coinsph", "bitoasis", "rain", "binancecom", "bitstampexchange", "geminitrust"}
WA_RX = re.compile(r"([\d,]+(?:\.\d+)?)\s+\$?#?([A-Za-z0-9]+)\s+\(([\d,]+(?:\.\d+)?)\s+USD\)\s+transferred\s+from\s+(.+?)\s+to\s+(.+?)\s*(?:\n|$)", re.I)


def ent(name):
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def classify_flow(frm, to):
    a, b = ent(frm) in EXCH, ent(to) in EXCH
    if b and not a:
        return "in"
    if a and not b:
        return "out"
    if a and b:
        return "x"
    return "o"


def parse_wa(text):
    m = WA_RX.search(text or "")
    if not m:
        return None
    asset = m.group(2).upper()
    usd = R.num(m.group(3))
    if asset not in ASSETS or not usd:
        return None
    return {"asset": asset, "usd": usd, "dir": classify_flow(m.group(4), m.group(5)),
            "from": m.group(4).strip()[:40], "to": m.group(5).strip()[:40]}


# ------------------------------------------------------------------ data collection
def update_whales(st, now):
    """Whale Alert public channel → labeled flows [[id, iso, asset, usd, dir]]; newest pages + bounded backfill"""
    wa = st.setdefault("wa", {"rows": [], "last_id": 0, "oldest_id": 0, "oldest_t": None, "complete": False})
    have = {r[0] for r in wa["rows"]}
    budget = WA_PAGES

    def add(page):
        n = 0
        for p in page:
            if p["id"] in have:
                continue
            have.add(p["id"])
            x = parse_wa(p["text"])
            wa["rows"].append([p["id"], R.iso(p["t"]), x["asset"] if x else "", round(x["usd"]) if x else 0, x["dir"] if x else "-"])
            n += 1
        return n

    try:
        page = R.tg_page(WA_CHANNEL)
        budget -= 1
    except Exception as ex:  # noqa: BLE001
        print("  whale alert:", ex)
        return
    add(page)
    # fill the gap between the newest page and what we already had
    if page and wa["last_id"] and page[0]["id"] > wa["last_id"] + 1:
        before = page[0]["id"]
        while budget > 0 and before > wa["last_id"] + 1:
            try:
                pg = R.tg_page(WA_CHANNEL, before=before)
            except Exception as ex:  # noqa: BLE001
                print("  whale alert gap:", ex)
                break
            budget -= 1
            if not pg:
                break
            add(pg)
            before = pg[0]["id"]
            time.sleep(0.6)
    if page:
        wa["last_id"] = max(wa["last_id"], page[-1]["id"])
    # backfill older history
    rows = sorted(wa["rows"], key=lambda r: r[0])
    cut = now - R.timedelta(days=WA_KEEP_DAYS)
    if rows and not wa.get("complete"):
        before = rows[0][0]
        while budget > 0:
            try:
                pg = R.tg_page(WA_CHANNEL, before=before)
            except Exception as ex:  # noqa: BLE001
                print("  whale alert backfill:", ex)
                break
            budget -= 1
            if not pg:
                wa["complete"] = True
                break
            add(pg)
            before = pg[0]["id"]
            if pg[0]["t"] < cut:
                wa["complete"] = True
                break
            time.sleep(0.6)
    rows = sorted((r for r in wa["rows"] if R.parse_iso(r[1]) >= cut), key=lambda r: r[0])
    wa["rows"] = rows
    if rows:
        wa["oldest_id"], wa["oldest_t"] = rows[0][0], rows[0][1]


def daily_series(st, now):
    """once a day: Binance 1d bars, Coinbase daily closes, Fear & Greed, OKX funding — cached in the store"""
    today = now.strftime("%Y-%m-%d")
    if st.get("daily_at") == today and st.get("daily") and os.environ.get("SILENT_FORCE") != "1":
        return
    daily = st.get("daily") or {}
    for c in ASSETS:
        d = daily.setdefault(c, {})
        try:
            for b in R.klines(c, "1d", limit=420):
                k = R.day(R.from_ms(b["t"]))
                d.setdefault(k, {}).update({"c": b["c"], "l": b["l"], "h": b["h"], "v": b["v"], "tb": b["tb"]})
        except Exception as ex:  # noqa: BLE001
            print(f"  binance 1d {c}:", ex)
        try:
            rows = R.http_json(f"https://api.exchange.coinbase.com/products/{CB[c]}/candles", {"granularity": 86400})
            for r in rows:
                k = R.day(R.from_ms(int(r[0]) * 1000))
                d.setdefault(k, {})["cb"] = float(r[4])
        except Exception as ex:  # noqa: BLE001
            print(f"  coinbase 1d {c}:", ex)
        try:
            fr, after = [], None
            for _ in range(4):
                p = {"instId": OKX[c], "limit": 100}
                if after:
                    p["after"] = after
                j = R.http_json("https://www.okx.com/api/v5/public/funding-rate-history", p)
                data = j.get("data") or []
                if not data:
                    break
                fr += data
                after = data[-1]["fundingTime"]
            byd = {}
            for x in fr:
                byd.setdefault(R.day(R.from_ms(int(x["fundingTime"]))), []).append(float(x.get("realizedRate") or x["fundingRate"]))
            for k, v in byd.items():
                d.setdefault(k, {})["f"] = sum(v) / len(v) * 100
        except Exception as ex:  # noqa: BLE001
            print(f"  okx funding {c}:", ex)
    try:
        j = R.http_json("https://api.alternative.me/fng/", {"limit": 420})
        for x in j.get("data", []):
            k = R.day(R.from_ms(int(x["timestamp"]) * 1000))
            for c in ASSETS:
                daily.setdefault(c, {}).setdefault(k, {})["fng"] = int(x["value"])
    except Exception as ex:  # noqa: BLE001
        print("  fear&greed:", ex)
    cut = (now - R.timedelta(days=430)).strftime("%Y-%m-%d")
    st["daily"] = {c: {k: v for k, v in sorted(d.items()) if k >= cut} for c, d in daily.items()}
    st["daily_at"] = today


def whale_daily(st):
    """{asset: {day: [in_usd, out_usd]}} from the Whale Alert rows"""
    out = {c: {} for c in ASSETS}
    for _, t, a, usd, d in st.get("wa", {}).get("rows", []):
        if a in out and d in ("in", "out"):
            x = out[a].setdefault(t[:10], [0, 0])
            x[0 if d == "in" else 1] += usd
    return out


# ------------------------------------------------------------------ signal logic (shared by live + backtest)
def strength(pct):
    """percentile (0..1, lower = more extreme) → 0 (inactive) or 0.5..1"""
    if pct is None or pct > 0.15:
        return 0.0
    return round(0.5 + 0.5 * R.clamp((0.15 - pct) / 0.12), 2)


def level_of(score, gate_ok, oi_ok=True):
    if not gate_ok or not oi_ok:
        return "none"
    return "red" if score >= 2 else "orange" if score >= 1 else "yellow" if score >= 0.5 else "none"


def talk_gate(fng=None, fund_pct=None, sentiment=None, council=None):
    parts = []
    if fng is not None:
        parts.append(R.clamp((fng - 30) / 40))
    if fund_pct is not None:
        parts.append(fund_pct)
    if sentiment is not None:
        parts.append(R.clamp((sentiment + 30) / 60))
    if council is not None:
        parts.append({"up": 1.0, "flat": 0.5, "down": 0.0}.get(council, 0.5))
    g = sum(parts) / len(parts) if parts else None
    return g, (g is not None and g >= 0.45)


def window_vals(days, d, keys, n=3):
    """sum the last n daily records ending at day index d"""
    if d - n + 1 < 0:
        return None
    rec = days[d - n + 1:d + 1]
    return {k: sum((r.get(k) or 0) for r in rec) for k in keys}


def backtest(st):
    out = {}
    wd = whale_daily(st)
    for c in ASSETS:
        series = st.get("daily", {}).get(c, {})
        keys = sorted(k for k, v in series.items() if v.get("c"))
        days = [dict(series[k], d=k) for k in keys]
        wa_first = min(wd[c]) if wd[c] else None
        cvd3, prem, net3, alerts, base = [], [], [], [], []
        for i, r in enumerate(days):
            w = window_vals(days, i, ["v", "tb"])
            cv = (2 * w["tb"] - w["v"]) / w["v"] if w and w["v"] else None
            cvd3.append(cv)
            pr = (r["cb"] / r["c"] - 1) * 100 if r.get("cb") and r.get("c") else None
            prem.append(pr)
            nf = None
            if wa_first and r["d"] >= wa_first:
                nf = sum((wd[c].get(days[j]["d"], [0, 0])[0] - wd[c].get(days[j]["d"], [0, 0])[1]) for j in range(max(0, i - 2), i + 1))
            net3.append(nf)
            if i < 60 or i + 7 >= len(days):
                continue
            chg3 = r["c"] / days[i - 3]["c"] - 1
            s2 = strength(R.pct_rank(cv, cvd3[max(0, i - 180):i])) if cv is not None and chg3 > -0.02 else 0
            s3 = strength(R.pct_rank(pr, prem[max(0, i - 90):i])) if pr is not None else 0
            hist_net = [x for x in net3[max(0, i - 90):i] if x is not None]
            s1 = 0
            if nf is not None and nf > 0 and len(hist_net) >= 30:
                s1 = strength(1 - R.pct_rank(nf, hist_net) + 1 / len(hist_net))
            fund = [days[j].get("f") for j in range(max(0, i - 90), i) if days[j].get("f") is not None]
            fp = R.pct_rank(r.get("f"), fund) if r.get("f") is not None and len(fund) >= 20 else None
            g, ok = talk_gate(fng=r.get("fng"), fund_pct=fp)
            score = s1 + s2 + s3
            lv = level_of(score, ok)
            fwd = days[i + 7]["c"] / r["c"] - 1
            dd = min(days[j]["l"] for j in range(i + 1, i + 8)) / r["c"] - 1
            base.append(fwd)
            if lv in ("orange", "red"):
                prev = alerts[-1] if alerts else None
                if prev and (R.parse_iso(r["d"] + "T00:00:00") - R.parse_iso(prev["d"] + "T00:00:00")).days < 3 and LEVELS.index(prev["lv"]) >= LEVELS.index(lv):
                    continue
                alerts.append({"d": r["d"], "lv": lv, "score": round(score, 2), "fwd": round(fwd * 100, 2), "dd": round(dd * 100, 2),
                               "sig": [k for k, s in (("A1", s1), ("A2", s2), ("A3", s3)) if s]})
        res = {"days": len(base), "from": days[60]["d"] if len(days) > 60 else None,
               "base": {"p_drop": round(100 * sum(1 for x in base if x <= -0.03) / len(base), 1) if base else None,
                        "avg7": round(100 * sum(base) / len(base), 2) if base else None},
               "whale_from": wa_first, "recent": alerts[-12:][::-1]}
        for lv in ("orange", "red"):
            a = [x for x in alerts if x["lv"] == lv]
            res[lv] = {"n": len(a), "hit": round(100 * sum(1 for x in a if x["fwd"] <= -3) / len(a), 1) if a else None,
                       "avg7": round(sum(x["fwd"] for x in a) / len(a), 2) if a else None,
                       "dd5": round(100 * sum(1 for x in a if x["dd"] <= -5) / len(a), 1) if a else None}
        out[c] = res
    return out


# ------------------------------------------------------------------ live evaluation
def live(st, now):
    sent = R.load("sentiment.json", {})
    der = R.load("derivatives.json", {})
    council = R.load("council_log.json", [])
    cm = None
    if council:
        votes = [{"bullish": "up", "bearish": "down", "neutral": "flat"}.get((v or [None])[0])
                 for v in (council[-1].get("stances") or {}).values()]
        votes = [v for v in votes if v]
        if votes:
            best = max(set(votes), key=votes.count)
            cm = best if votes.count(best) > len(votes) / 2 else "flat"
    wd = whale_daily(st)
    rows = st.get("wa", {}).get("rows", [])
    out = {}
    for c in ASSETS:
        a = {"signals": [], "talk": {}}
        try:
            bars = R.klines(c, "1h", limit=100)
        except Exception as ex:  # noqa: BLE001
            print(f"  binance 1h {c}:", ex)
            bars = []
        series = st.get("daily", {}).get(c, {})
        keys = sorted(series)
        # A2 taker imbalance over the last 72 hours vs 180 daily 3-day windows
        hist_cvd = []
        for i in range(2, len(keys)):
            w = [series[keys[j]] for j in (i - 2, i - 1, i)]
            v = sum(x.get("v") or 0 for x in w)
            tb = sum(x.get("tb") or 0 for x in w)
            if v:
                hist_cvd.append((2 * tb - v) / v)
        hist_cvd = hist_cvd[-181:-1]
        cv = chg72 = None
        if len(bars) >= 73:
            last = bars[-73:-1]                         # 72 completed hours
            v = sum(b["v"] for b in last)
            tb = sum(b["tb"] for b in last)
            cv = (2 * tb - v) / v if v else None
            chg72 = bars[-1]["c"] / last[0]["o"] - 1
            a["price"] = bars[-1]["c"]
            a["chg72"] = round(chg72 * 100, 2)
        p2 = R.pct_rank(cv, hist_cvd) if cv is not None and len(hist_cvd) >= 60 else None
        s2 = strength(p2) if (chg72 is not None and chg72 > -0.02) else 0.0
        a["signals"].append({"id": "A2", "on": s2 > 0, "s": s2, "value": None if cv is None else round(cv * 100, 2),
                             "pct": None if p2 is None else round(p2 * 100), "unit": "%"})
        # A3 Coinbase premium (mean of the last 24 hourly closes) vs 90 daily closes
        prem_now = None
        try:
            cbr = R.http_json(f"https://api.exchange.coinbase.com/products/{CB[c]}/candles", {"granularity": 3600})
            cbm = {int(r[0]) * 1000 + R.H: float(r[4]) for r in cbr}       # close time → close
            pts = [(cbm[b["t"] + R.H] / b["c"] - 1) * 100 for b in bars[-25:-1] if (b["t"] + R.H) in cbm]
            if len(pts) >= 12:
                prem_now = sum(pts) / len(pts)
        except Exception as ex:  # noqa: BLE001
            print(f"  coinbase 1h {c}:", ex)
        hist_prem = [(series[k]["cb"] / series[k]["c"] - 1) * 100 for k in keys if series[k].get("cb") and series[k].get("c")][-90:]
        p3 = R.pct_rank(prem_now, hist_prem) if prem_now is not None and len(hist_prem) >= 30 else None
        s3 = strength(p3)
        a["signals"].append({"id": "A3", "on": s3 > 0, "s": s3, "value": None if prem_now is None else round(prem_now, 3),
                             "pct": None if p3 is None else round(p3 * 100), "unit": "%"})
        # A1 whale exchange netflow, last 72h vs 90 daily 3-day sums
        cut72 = R.iso(now - R.timedelta(hours=72))
        cut24 = R.iso(now - R.timedelta(hours=24))
        inn = sum(r[3] for r in rows if r[2] == c and r[4] == "in" and r[1] >= cut72)
        outt = sum(r[3] for r in rows if r[2] == c and r[4] == "out" and r[1] >= cut72)
        in24 = sum(r[3] for r in rows if r[2] == c and r[4] == "in" and r[1] >= cut24)
        out24 = sum(r[3] for r in rows if r[2] == c and r[4] == "out" and r[1] >= cut24)
        net = inn - outt
        dk = sorted(wd[c])
        hist_net = []
        for i in range(2, len(dk) - 1):                 # complete days only
            hist_net.append(sum(wd[c][dk[j]][0] - wd[c][dk[j]][1] for j in (i - 2, i - 1, i)))
        hist_net = hist_net[-90:]
        p1 = R.pct_rank(net, hist_net) if len(hist_net) >= 30 else None
        s1 = strength(1 - p1 + 1 / len(hist_net)) if (p1 is not None and net > 0) else 0.0
        a["signals"].append({"id": "A1", "on": s1 > 0, "s": s1, "value": round(net), "pct": None if p1 is None else round(p1 * 100),
                             "unit": "$", "days": len(hist_net)})
        a["whale"] = {"in72": round(inn), "out72": round(outt), "net72": round(net), "in24": round(in24), "out24": round(out24),
                      "n72": sum(1 for r in rows if r[2] == c and r[1] >= cut72 and r[4] in ("in", "out"))}
        # talk
        fng = (R.load("market.json", {}).get("fng") or {}).get("value")
        fund = [series[k].get("f") for k in keys if series[k].get("f") is not None][-91:]
        fnow = (der.get(c) or {}).get("funding")
        fp = R.pct_rank(fnow, fund[:-1]) if fnow is not None and len(fund) >= 20 else None
        sv = ((sent.get("coins") or {}).get(c) or {}).get("v", sent.get("now"))
        g, ok = talk_gate(fng=None if fng is None else int(fng), fund_pct=fp, sentiment=sv, council=cm)
        a["talk"] = {"fng": fng, "funding": fnow, "funding_pct": None if fp is None else round(fp * 100), "sentiment": sv,
                     "council": cm, "gate": None if g is None else round(g, 2), "ok": ok}
        oi = (der.get(c) or {}).get("oi_hist") or []
        oi_chg = (oi[-1][1] / oi[-72][1] - 1) if len(oi) >= 72 and oi[-72][1] else None
        a["oi_chg72"] = None if oi_chg is None else round(oi_chg * 100, 2)
        oi_ok = oi_chg is None or oi_chg > -0.08
        a["score"] = round(s1 + s2 + s3, 2)
        a["level"] = level_of(a["score"], ok, oi_ok)
        a["available"] = sum(1 for s in a["signals"] if s["pct"] is not None)
        out[c] = a
    return out


def main():
    now = R.now()
    st = R.load("silent_exit_store.json", {})
    prev = R.load("silent_exit.json", {})
    if prev.get("updated_at") and (now - R.parse_iso(prev["updated_at"])).total_seconds() < 50 * 60 and os.environ.get("SILENT_FORCE") != "1":
        print("silent exit: not due (hourly)")
        return
    update_whales(st, now)
    daily_series(st, now)
    assets = live(st, now)
    bt = prev.get("backtest") if prev.get("backtest_at") == now.strftime("%Y-%m-%d") else None
    if not bt:
        bt = backtest(st)
    alerts = prev.get("alerts", [])
    hist = prev.get("history", [])
    for c, a in assets.items():
        hist.append([R.iso(now), c, LEVELS.index(a["level"]), a["score"]])
        if a["level"] in ("orange", "red") and a.get("price"):
            recent = [x for x in alerts if x["coin"] == c and (now - R.parse_iso(x["t"])).total_seconds() < 24 * 3600]
            if not any(LEVELS.index(x["level"]) >= LEVELS.index(a["level"]) for x in recent):
                alerts.append({"id": f"{c}-{now.strftime('%Y%m%dT%H')}", "t": R.iso(now), "coin": c, "level": a["level"],
                               "p0": a["price"], "score": a["score"], "signals": [s["id"] for s in a["signals"] if s["on"]]})
    cut = R.iso(now - R.timedelta(days=90))
    hist = [h for h in hist if h[0] >= cut]
    wa = st.get("wa", {})
    out = {"updated_at": R.iso(now), "assets": assets, "alerts": alerts[-300:], "history": hist,
           "backtest": bt, "backtest_at": now.strftime("%Y-%m-%d"),
           "whale_cover": {"from": wa.get("oldest_t"), "rows": len(wa.get("rows", [])), "complete": wa.get("complete", False)},
           "method": {"A1": "Whale Alert exchange netflow 72h, top 15% of 90d", "A2": "Binance taker imbalance 72h, bottom 15% of 180d, price 72h > -2%",
                      "A3": "Coinbase premium 24h mean, bottom 15% of 90d", "talk": "mean(F&G, funding pct, news sentiment, AI council) >= 0.45",
                      "oi": "OKX OI 72h change > -8%", "levels": "yellow >= 0.5, orange >= 1, red >= 2",
                      "hit": "7-day return <= -3%"}}
    R.save("silent_exit_store.json", st)
    R.save("silent_exit.json", out)
    print("silent exit:", {c: (a["level"], a["score"], [(s["id"], s["pct"]) for s in a["signals"]], a["talk"].get("gate")) for c, a in assets.items()},
          "| whale rows", len(wa.get("rows", [])), "from", wa.get("oldest_t"),
          "| backtest red", {c: (bt.get(c, {}).get("red") or {}) for c in ASSETS})


if __name__ == "__main__":
    main()
