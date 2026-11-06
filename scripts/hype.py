#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
شاخص نیمه‌عمر هیاهو — Hype Half-Life

هر روایت بازار (هوش مصنوعی، ETF، میم‌کوین، RWA، …) چقدر زنده می‌ماند، چقدر قیمت را جابه‌جا می‌کند و کی می‌میرد؟

شدت روایت (روزانه) از دو منبع مستقل:
  کانال: تعداد پست‌های Coin_Kurd که به روایت اشاره دارند (واژه‌های فارسی + انگلیسی) — آرشیو کانال
         با بک‌فیل تدریجی از t.me/s/Coin_Kurd تا ۳۶۵ روز عقب‌تر از آرشیو سایت
  جهانی: تعداد تیترهای ۲۴ ساعت از ده‌ها منبع خبری بین‌المللی (data/narratives.json → history)
هر سری با جمع غلتان ۵ روزه هموار می‌شود.

دورهٔ هیاهو (اپیزود):
  پایه b = میانهٔ سری · آستانه = max(b + 2×MAD ، 1.8×b ، حداقل مطلق)
  شروع  = اولین روزی که شدت از آستانه بالاتر رفت
  اوج   = بیشترین شدت در همان دوره
  نیمه‌عمر = فاصلهٔ اوج تا روزی که شدت به b + (اوج − b)/2 رسید (با درون‌یابی کسری روز)
  مرگ  = روزی که شدت به b + 0.2 × (اوج − b) برگشت؛ اگر نرسیده «زنده» است
تأثیر قیمت = بازده سبد هم‌وزن کوین‌های روایت (Binance، روزانه) از شروع تا نیمه‌عمر و تا مرگ؛ مازاد نسبت به بیت‌کوین
نمرهٔ کیفیت (۰ تا ۱۰۰، ۵۰ = بی‌اثر) = 100 / (1 + e^(−(تأثیر تا مرگ ٪ ÷ طول عمر روز) / 0.5))

خروجی: data/hype.json (+ data/hype_store.json: آرشیو فشردهٔ کانال و قیمت‌ها)
روزی یک بار اجرا می‌شود (HYPE_FORCE=1 برای اجرای فوری).
"""
import math
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reality_common as R  # noqa: E402
from narratives import NARR  # noqa: E402  (names, English keywords, member coins)

CHANNEL = "Coin_Kurd"
BACK_DAYS = int(os.environ.get("HYPE_BACK_DAYS", "365"))
PAGES = int(os.environ.get("HYPE_PAGES", "60"))
SMOOTH = 5
FA_KW = {
    "ai": r"هوش مصنوعی|\bایجنت|عامل( ?های)? هوشمند|انویدیا|اوپن ?ای ?آی|مدل( ?های)? زبانی|پردازنده( ?های)? گرافیکی|\bai\b",
    "rwa": r"توکنیزه|توکن ?سازی|توکنیزاسیون|دارایی( ?های)? (دنیای )?واقعی|اوراق خزانه(ی)? توکنی|\brwa\b",
    "depin": r"دی ?پین|زیرساخت( ?های)? فیزیکی غیرمتمرکز|فایل ?کوین|هلیوم|\bdepin\b",
    "meme": r"\bمیم ?کوین|\bمیم\b|دوج ?کوین|\bشیبا|\bپپه\b|\bبونک\b|پامپ ?فان|ترامپ ?کوین",
    "l2": r"لایه(ی|ٔ)? ?(دو|۲|2|دوم)\b|\bرول ?آپ|آربیتروم|آپتیمیزم|اپتیمیزم|پالیگان|زی ?کی ?سینک|استارک ?نت|شبکه(ی)? بیس",
    "defi": r"دیفای|امور مالی غیرمتمرکز|صرافی( ?های)? غیرمتمرکز|استخر( ?های)? نقدینگی|وام ?دهی|\bاستیکینگ|ری ?استیکینگ|یونی ?سواپ|\bآوه\b|ارزش کل قفل",
    "etf": r"ای ?تی ?اف|\betf|صندوق( ?های)? (قابل معامله|نقدی|رمزارزی|بیت ?کوین|اتریوم|سولانا|ریپل)|بلک ?راک|فیدلیتی|گری ?اسکیل|\bنهادی|مایکرو ?استراتژی",
    "stable": r"استیبل ?کوین|سیرکل|جینیس|ارز دیجیتال بانک مرکزی|\bcbdc",
    "reg": r"قانون ?گذار|کمیسیون بورس|اس ?ای ?سی|\bسنا\b|کنگره|لایحه|دادگاه|شکایت|رگولاتوری|مقررات|\bمیکا\b",
    "security": r"\bهک\b|هکر|سرقت|نفوذ|فیشینگ|آسیب ?پذیری|اکسپلویت|حمله(ی)? (سایبری|امنیتی)",
    "gaming": r"گیمینگ|متاورس|ان ?اف ?تی|\bnft|بازی( ?های)? (بلاکچینی|کریپتویی|ارز دیجیتالی)",
    "btc_eco": r"اوردینالز|\bرونز\b|لایتنینگ|هاوینگ|هالوینگ|\bماینر|ماینینگ|استخراج بیت ?کوین|نرخ هش|هش ?ریت|بابیلون",
}
RX = {nid: re.compile(f"(?:{n['kw']})|(?:{FA_KW.get(nid, '(?!x)x')})", re.I) for nid, n in NARR.items()}
MIN_ABS = {"channel": 3, "global": 12}


def match(text):
    t = R.norm_fa(text)
    return [nid for nid, rx in RX.items() if rx.search(t)]


# ------------------------------------------------------------------ channel archive (posts.json + compact backfill)
def channel_rows(st, now):
    posts = R.load("posts.json", [])
    rows = {p["id"]: [p["id"], p["date"][:10], match((p.get("text") or "") + " " + " ".join("#" + h for h in p.get("hashtags", [])))]
            for p in posts if p.get("date") and p.get("id")}
    arc = st.setdefault("archive", {"rows": [], "complete": False})
    for r in arc["rows"]:
        rows.setdefault(r[0], r)
    # backfill older posts straight from the public channel preview (only the matched narratives are kept)
    oldest_site = min(rows) if rows else None
    cut = (now - R.timedelta(days=BACK_DAYS + 140)).strftime("%Y-%m-%d")
    if oldest_site and not arc.get("complete"):
        before = min(rows)
        budget = PAGES
        while budget > 0:
            try:
                pg = R.tg_page(CHANNEL, before=before)
            except Exception as ex:  # noqa: BLE001
                print("  channel backfill:", ex)
                break
            budget -= 1
            if not pg:
                arc["complete"] = True
                break
            for p in pg:
                if p["id"] not in rows:
                    r = [p["id"], R.day(p["t"]), match(p["text"])]
                    rows[p["id"]] = r
                    arc["rows"].append(r)
            before = pg[0]["id"]
            if R.day(pg[0]["t"]) < cut:
                arc["complete"] = True
                break
            time.sleep(0.5)
    arc["rows"] = [r for r in arc["rows"] if r[1] >= cut]
    return sorted(rows.values())


def daily_counts(rows):
    days = {}
    tot = {}
    for _, d, nids in rows:
        tot[d] = tot.get(d, 0) + 1
        for n in nids:
            days.setdefault(n, {})[d] = days.setdefault(n, {}).get(d, 0) + 1
    return days, tot


def fill(series, d0, d1):
    out, d = [], R.parse_iso(d0 + "T00:00:00")
    end = R.parse_iso(d1 + "T00:00:00")
    while d <= end:
        k = d.strftime("%Y-%m-%d")
        out.append([k, series.get(k, 0)])
        d += R.timedelta(days=1)
    return out


def smooth(seq, n=SMOOTH):
    out, run = [], 0
    for i, (d, v) in enumerate(seq):
        run += v
        if i >= n:
            run -= seq[i - n][1]
        out.append([d, run])
    return out


# ------------------------------------------------------------------ episodes
def episodes(sm, kind):
    vals = [v for _, v in sm]
    if len(vals) < 21:
        return [], None
    b = R.median(vals)
    mad = R.median([abs(v - b) for v in vals]) or 0
    th = max(b + 2 * mad, 1.8 * b, MIN_ABS[kind])
    eps, i, n = [], 0, len(sm)
    while i < n:
        if sm[i][1] < th:
            i += 1
            continue
        s = i
        j = i
        while j + 1 < n and (sm[j + 1][1] >= th or any(sm[k][1] >= th for k in range(j + 1, min(n, j + 4)))):
            j += 1
        pk = max(range(s, j + 1), key=lambda k: sm[k][1])
        peak = sm[pk][1]
        half_lvl = b + (peak - b) / 2
        death_lvl = b + 0.2 * (peak - b)

        def cross(level):
            for k in range(pk, n - 1):
                if sm[k + 1][1] <= level:
                    hi, lo = sm[k][1], sm[k + 1][1]
                    frac = 1.0 if hi == lo else (hi - level) / (hi - lo)
                    return k + frac
            return None
        h = cross(half_lvl)
        dth = cross(death_lvl)
        eps.append({"start": sm[s][0], "peak": sm[pk][0], "peak_v": peak, "s": s, "pk": pk,
                    "half_x": h, "death_x": dth, "base": round(b, 2), "th": round(th, 2)})
        i = max(j + 1, int(math.ceil(dth)) + 1) if dth is not None else n
    return eps, round(th, 2)


def basket_return(prices, coins, d0, d1):
    rs = []
    for c in coins:
        p = prices.get(c, {})
        a = p.get(d0) or _near(p, d0)
        b = p.get(d1) or _near(p, d1)
        if a and b:
            rs.append(b / a - 1)
    return (sum(rs) / len(rs)) if rs else None


def _near(p, d, back=3):
    dt = R.parse_iso(d + "T00:00:00")
    for k in range(1, back + 1):
        x = p.get((dt - R.timedelta(days=k)).strftime("%Y-%m-%d"))
        if x:
            return x
    return None


def quality(impact_pct, life_d):
    if impact_pct is None or life_d is None:
        return None
    rate = impact_pct / max(1.0, life_d)
    return int(round(100 / (1 + math.exp(-rate / 0.5))))


def day_at(sm, x):
    """fractional index → date of the integer part"""
    return sm[min(len(sm) - 1, int(x))][0]


def describe(eps, sm, coins, prices, kind, today):
    out = []
    for e in eps:
        half_d = None if e["half_x"] is None else round(e["half_x"] - e["pk"], 1)
        alive = e["death_x"] is None
        death_day = None if alive else day_at(sm, math.ceil(e["death_x"]))
        half_day = None if e["half_x"] is None else day_at(sm, math.ceil(e["half_x"]))
        end_day = death_day or today
        life = R.days_between(e["start"] + "T00:00:00", end_day + "T00:00:00")
        basket = coins or ["BTC"]
        imp_half = basket_return(prices, basket, e["start"], half_day) if half_day else None
        imp_end = basket_return(prices, basket, e["start"], end_day)
        btc = basket_return(prices, ["BTC"], e["start"], end_day)
        excess = None if (imp_end is None or btc is None or basket == ["BTC"]) else imp_end - btc
        out.append({"src": kind, "start": e["start"], "peak": e["peak"], "peak_v": e["peak_v"], "half_d": half_d, "half_day": half_day,
                    "death": death_day, "alive": alive, "life_d": round(life, 1),
                    "impact_half": None if imp_half is None else round(imp_half * 100, 2),
                    "impact": None if imp_end is None else round(imp_end * 100, 2),
                    "excess": None if excess is None else round(excess * 100, 2),
                    "quality": quality(None if imp_end is None else imp_end * 100, life), "base": e["base"]})
    return out


def state_now(sm, eps_desc, th):
    if not sm or th is None:
        return "quiet", None
    v = sm[-1][1]
    last = eps_desc[-1] if eps_desc else None
    if last and last["alive"]:
        if last["half_day"]:
            return "fading", v
        if sm[-1][1] >= 0.9 * last["peak_v"]:
            return "peak", v
        return "rising" if len(sm) > 2 and sm[-1][1] >= sm[-3][1] else "cooling", v
    return ("rising", v) if v >= th else ("quiet", v)


def prices_for(st, coins, now):
    pr = st.setdefault("prices", {})
    if st.get("prices_at") == now.strftime("%Y-%m-%d") and pr and os.environ.get("HYPE_FORCE") != "1":
        return pr
    for c in sorted(coins):
        try:
            bars = R.klines(c, "1d", limit=1000)
        except Exception as ex:  # noqa: BLE001
            print(f"  price {c}: {str(ex)[:60]}")
            continue
        pr[c] = {R.day(R.from_ms(b["t"])): b["c"] for b in bars}
        time.sleep(0.1)
    st["prices_at"] = now.strftime("%Y-%m-%d")
    return pr


def main():
    now = R.now()
    today = now.strftime("%Y-%m-%d")
    prev = R.load("hype.json", {})
    if prev.get("updated_at", "")[:10] == today and os.environ.get("HYPE_FORCE") != "1":
        print("hype: already computed today")
        return
    st = R.load("hype_store.json", {})
    rows = channel_rows(st, now)
    ch_counts, ch_tot = daily_counts(rows)
    d0 = min(r[1] for r in rows) if rows else today
    narr_hist = R.load("narratives.json", {}).get("history", {})
    coins = {c for n in NARR.values() for c in n["coins"]} | {"BTC"}
    prices = prices_for(st, coins, now)
    out = []
    for nid, n in NARR.items():
        ch = smooth(fill(ch_counts.get(nid, {}), d0, today))
        gh_raw = {d: v for d, v, *_ in narr_hist.get(nid, [])}
        gl = smooth(fill(gh_raw, min(gh_raw), today)) if gh_raw else []
        e_ch, th_ch = episodes(ch, "channel")
        e_gl, th_gl = episodes(gl, "global")
        d_ch = describe(e_ch, ch, n["coins"], prices, "channel", today)
        d_gl = describe(e_gl, gl, n["coins"], prices, "global", today)
        st_ch, v_ch = state_now(ch, d_ch, th_ch)
        st_gl, v_gl = state_now(gl, d_gl, th_gl)
        halves = [e["half_d"] for e in d_ch + d_gl if e["half_d"] is not None]
        lives = [e["life_d"] for e in d_ch + d_gl if not e["alive"]]
        q = [e["quality"] for e in d_ch + d_gl if e["quality"] is not None and not e["alive"]]
        last = (d_ch + d_gl)
        last = max(last, key=lambda e: e["start"]) if last else None
        out.append({"id": nid, "name": n["name"], "coins": n["coins"],
                    "now": {"channel": {"state": st_ch, "v": v_ch, "th": th_ch}, "global": {"state": st_gl, "v": v_gl, "th": th_gl,
                                                                                             "mentions_24h": gh_raw.get(max(gh_raw)) if gh_raw else None}},
                    "episodes": sorted(d_ch + d_gl, key=lambda e: e["start"], reverse=True)[:12],
                    "median_half": None if not halves else round(R.median(halves), 1),
                    "median_life": None if not lives else round(R.median(lives), 1),
                    "quality": None if not q else int(round(sum(q) / len(q))), "last": last,
                    "series": {"channel": ch[-180:], "global": gl[-180:]}})
    board = sorted([x for x in out if x["quality"] is not None], key=lambda x: -x["quality"])
    alive = [x["id"] for x in out if x["last"] and x["last"]["alive"]]
    res = {"updated_at": R.iso(now), "narratives": out, "board": [x["id"] for x in board], "alive": alive,
           "coverage": {"channel_from": d0, "channel_posts": len(rows), "global_from": min((min(v)[0] for v in narr_hist.values() if v), default=None),
                        "archive_complete": st.get("archive", {}).get("complete", False)},
           "method": {"smooth": f"{SMOOTH}-day rolling sum", "threshold": "max(median + 2·MAD, 1.8·median, minimum)",
                      "half_life": "peak → base + (peak − base)/2", "death": "peak → base + 0.2·(peak − base)",
                      "impact": "equal-weight basket of the narrative's coins (Binance daily closes)",
                      "quality": "100 / (1 + exp(−(impact% / life days) / 0.5)); 50 = no effect"}}
    R.save("hype_store.json", st)
    R.save("hype.json", res)
    print("hype:", [(x["id"], x["now"]["channel"]["state"], x["median_half"], x["quality"], len(x["episodes"])) for x in out],
          "| channel posts", len(rows), "from", d0)


if __name__ == "__main__":
    main()
