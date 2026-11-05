#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kurdistani Market Analyzer PRO — پورت دقیق سمت سرور از اسکریپت تریدینگ‌ویوی Coin_Kurd
(منطق و ورودی‌های پیش‌فرض ۱:۱ کپی شده‌اند؛ هیچ پارامتری تیون نشده است).

  اسکریپت اصلی:  Kurdistani Market Analyzer PRO  ·  @Coin_Kurd  ·  Pine v6
  ورودی‌های پیش‌فرض که اینجا هم به کار می‌روند:
      From year = 2000 · To year = 2100 · Market filter = All · Rolling window = All-Time
      Probability threshold = 5.0 % · Annual risk-free rate = 0 % · Bull/Bear SMA = 200

ساختار محاسبه، دقیقاً مثل پاین، یک ماشین حالت روی کندل‌های روزانه است:
  • فصلی/ماهانه  بازده = (close آخرین کندل دوره − open اولین کندل دوره) / open × ۱۰۰
                 MFE و MAE از سقف و کف کل دوره، Max DD از افت close نسبت به بیشینهٔ close دوره،
                 و برچسب Bull/Bear از وضعیت close نسبت به SMA در «اولین» کندل دوره.
  • هفتهٔ سال / سالانه   فقط بازده دوره.
  • روز هفته / روز ماه   بازده تک‌کندلی (close − open) / open × ۱۰۰.
دورهٔ جاری و ناتمام، مثل پاین، در جدول خام دیده می‌شود ولی وارد هیچ آماری نمی‌شود.

هیچ‌جای این فایل از دادهٔ آینده استفاده نمی‌کند: هر عدد فقط از کندل‌های بسته‌شدهٔ گذشته می‌آید.

اجرا:  python scripts/seasonality.py            (خروجی: data/seasonality.json)
       python scripts/seasonality.py --selftest (آزمون موتور با دادهٔ ساختگی، بدون شبکه)
"""
import argparse
import csv
import io
import json
import math
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")

# ---------------------------------------------------------------- ورودی‌های پیش‌فرض اندیکاتور
DEFAULTS = {
    "from_year": 2000,
    "to_year": 2100,
    "market_filter": 0,      # 0 = All · 1 = Bull only · 2 = Bear only
    "rolling_window": 0,     # 0 = All-Time · 1 = 5y · 2 = 10y · 3 = 20y
    "prob_threshold": 5.0,
    "rf_annual": 0.0,
    "bull_ma_len": 200,
}

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MONTHS_FA = ["ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"]
MONTHS_CKB = ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەمووز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"]
# شناسهٔ روز هفته در پاین: ۱ = یکشنبه … ۷ = شنبه
DAY_IDS = [2, 3, 4, 5, 6, 7, 1]
DAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAYS_FA = ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه", "یکشنبه"]
DAYS_CKB = ["دووشەممە", "سێشەممە", "چوارشەممە", "پێنجشەممە", "هەینی", "شەممە", "یەکشەممە"]
SSI_EN = ["Strong Bear", "Bear", "Neutral", "Bull", "Strong Bull"]
SSI_FA = ["نزول قوی", "نزول", "خنثی", "صعود", "صعود قوی"]
SSI_CKB = ["داشکانی بەهێز", "داشکان", "بێلایەن", "هەڵکشان", "هەڵکشانی بەهێز"]


# ================================================================ توابع آماری (پورت ۱:۱)
def _median(xs):
    """f_median — میانهٔ دستی، همان پیاده‌سازی پاین."""
    n = len(xs)
    if n == 0:
        return None
    s = sorted(xs)
    mid = n // 2
    return s[mid] if n % 2 == 1 else (s[mid - 1] + s[mid]) / 2


def _stdev(xs, avg):
    """انحراف معیار نمونه‌ای با مخرج n−1، همان فرمول پاین."""
    n = len(xs)
    if n <= 1:
        return None
    sq = sum((x - avg) ** 2 for x in xs)
    return math.sqrt(sq / (n - 1))


def bucket_stats(vals, buckets, bid):
    """f_bucketStats → (avg, median, win%, best, worst, stdev, n)"""
    tmp = [v for v, b in zip(vals, buckets) if b == bid]
    n = len(tmp)
    if n == 0:
        return (None, None, None, None, None, None, 0)
    avg = sum(tmp) / n
    win = sum(1 for v in tmp if v >= 0) * 1.0 / n * 100
    return (avg, _median(tmp), win, max(tmp), min(tmp), _stdev(tmp, avg), n)


def bucket_stats_ext(vals, buckets, mfe, mae, dd, bid, ann_factor, rf):
    """f_bucketStatsExt → avg, stdev, n, win%, profit factor, expectancy, avgMFE, avgMAE, worstDD, Sharpe"""
    idx = [i for i, b in enumerate(buckets) if b == bid]
    tv = [vals[i] for i in idx]
    n = len(tv)
    if n == 0:
        return dict(avg=None, sd=None, n=0, win=None, pf=None, exp=None, mfe=None, mae=None, dd=None, sharpe=None)
    avg = sum(tv) / n
    sd = _stdev(tv, avg)
    win_c = sum(1 for v in tv if v >= 0)
    sum_win = sum(v for v in tv if v >= 0)
    sum_loss = sum(-v for v in tv if v < 0)
    win = win_c * 1.0 / n * 100
    loss_c = n - win_c
    avg_win = sum_win / win_c if win_c > 0 else None
    avg_loss = sum_loss / loss_c if loss_c > 0 else None
    pf = (sum_win / sum_loss) if sum_loss > 0 else (999.0 if sum_win > 0 else None)
    # nz() در پاین مقدار na را صفر می‌کند
    exp = win / 100 * (avg_win or 0.0) - (1 - win / 100) * (avg_loss or 0.0)
    sharpe = None
    if n > 1 and sd and sd > 0:
        sharpe = (avg - rf / ann_factor) / sd * math.sqrt(ann_factor)
    return dict(avg=avg, sd=sd, n=n, win=win, pf=pf, exp=exp,
                mfe=sum(mfe[i] for i in idx) / n, mae=sum(mae[i] for i in idx) / n,
                dd=min(dd[i] for i in idx), sharpe=sharpe)


def composite_score(avg, win, pf, worst_dd):
    """f_compositeScore — بازده ۳۰ + نرخ برد ۲۵ + فاکتور سود ۲۵ + افت ۲۰، سقف ۱۰۰"""
    if avg is None or win is None:
        return None
    ret_comp = min(max((avg + 20) / 40, 0), 1) * 30
    win_comp = win / 100 * 25
    pf_capped = 0.0 if pf is None else min(pf, 3.0)
    pf_comp = pf_capped / 3 * 25
    dd_comp = 0.0 if worst_dd is None else (1 - min(abs(worst_dd), 30) / 30) * 20
    return min(max(ret_comp + win_comp + pf_comp + dd_comp, 0), 100)


def ssi_tier(score):
    """f_ssiTier — ۰ یعنی بدون داده، ۱ نزول قوی تا ۵ صعود قوی"""
    if score is None:
        return 0
    return 5 if score >= 80 else 4 if score >= 60 else 3 if score >= 40 else 2 if score >= 20 else 1


def confidence_stars(n, sd, avg):
    """f_confidenceStars — نصف امتیاز از تعداد نمونه، نصف از ثبات (انحراف معیار نسبت به میانگین)"""
    if n <= 0:
        return 0
    n_score = min(n / 15.0, 1.0)
    cv = 1.0 if (sd is None or avg is None or avg == 0) else min(abs(sd / avg), 3.0) / 3.0
    total = n_score * 0.5 + (1.0 - cv) * 0.5
    return max(int(round(total * 5)), 1)


def vol_rating(sd):
    """f_volRating"""
    if sd is None:
        return None
    return "Low" if sd < 5 else "Medium" if sd < 10 else "High"


def bucket_prob(vals, buckets, bid, thresh):
    """f_bucketProb → (P(≥ +thresh), P(≤ −thresh))"""
    tmp = [v for v, b in zip(vals, buckets) if b == bid]
    n = len(tmp)
    if n == 0:
        return (None, None)
    return (sum(1 for v in tmp if v >= thresh) * 1.0 / n * 100,
            sum(1 for v in tmp if v <= -thresh) * 1.0 / n * 100)


def best_worst(vals, buckets, ids):
    """f_bestWorst — بهترین و بدترین باکت بر اساس میانگین بازده"""
    best = worst = None
    for bid in ids:
        avg, _, win, _, _, _, n = bucket_stats(vals, buckets, bid)
        if n == 0:
            continue
        if best is None or avg > best[1]:
            best = (bid, avg, win)
        if worst is None or avg < worst[1]:
            worst = (bid, avg, win)
    return (best or (None, None, None), worst or (None, None, None))


def best_holding_period(month_avg):
    """f_bestHoldingPeriod — بهترین پنجرهٔ نگهداری چرخشی بین ماه‌ها، با ترکیب مرکب"""
    best = (-1, -1, None)
    for start in range(12):
        cum = 1.0
        valid = True
        for ln in range(1, 13):
            v = month_avg[(start + ln - 1) % 12]
            if v is None:
                valid = False
            if valid:
                cum *= (1 + v / 100)
                ret = (cum - 1) * 100
                if best[2] is None or ret > best[2]:
                    best = (start, ln, ret)
    return best


# ================================================================ ماشین حالت کندل‌به‌کندل
def _pine_dow(d):
    """dayofweek پاین: ۱ = یکشنبه … ۷ = شنبه"""
    return (d.isoweekday() % 7) + 1


def walk(bars, bull_ma_len):
    """یک گذر روی کندل‌های روزانه؛ همان ترتیب و همان نقاط ثبت که پاین دارد.

    bars: فهرست مرتب‌شدهٔ (date, open, high, low, close)
    """
    q = dict(open=None, year=None, num=None, high=None, low=None, peak=None, dd=None, bars=0, bull=None)
    m = dict(open=None, year=None, num=None, high=None, low=None, peak=None, dd=None, bars=0, bull=None)
    w = dict(open=None, year=None, num=None, bull=None)
    y = dict(open=None, year=None)
    out = dict(q=[], m=[], w=[], y=[], wd=[], dom=[], q_cells={}, m_cells={})

    closes = []
    prev_close = None
    for d, o, hi, lo, c in bars:
        closes.append(c)
        sma = sum(closes[-bull_ma_len:]) / bull_ma_len if len(closes) >= bull_ma_len else None
        bull_now = 1 if (sma is not None and c > sma) else 0
        yr = d.year
        qn = (d.month + 2) // 3
        mn = d.month
        wn = d.isocalendar()[1]

        # ---- فصلی
        if q["num"] is None or qn != q["num"] or yr != q["year"]:
            if q["open"] is not None and prev_close is not None:
                out["q"].append(dict(
                    val=(prev_close - q["open"]) / q["open"] * 100, bucket=q["num"], year=q["year"],
                    mfe=(q["high"] - q["open"]) / q["open"] * 100,
                    mae=(q["low"] - q["open"]) / q["open"] * 100,
                    dd=q["dd"], bars=q["bars"], bull=q["bull"]))
            q.update(open=o, year=yr, num=qn, high=hi, low=lo, peak=c, dd=0.0, bars=0, bull=bull_now)
        q["high"] = max(q["high"], hi)
        q["low"] = min(q["low"], lo)
        q["peak"] = max(q["peak"], c)
        q["dd"] = min(q["dd"], (c - q["peak"]) / q["peak"] * 100)
        q["bars"] += 1
        out["q_cells"][f'{q["year"]}-{q["num"]}'] = (c - q["open"]) / q["open"] * 100

        # ---- ماهانه
        if m["num"] is None or mn != m["num"] or yr != m["year"]:
            if m["open"] is not None and prev_close is not None:
                out["m"].append(dict(
                    val=(prev_close - m["open"]) / m["open"] * 100, bucket=m["num"], year=m["year"],
                    mfe=(m["high"] - m["open"]) / m["open"] * 100,
                    mae=(m["low"] - m["open"]) / m["open"] * 100,
                    dd=m["dd"], bars=m["bars"], bull=m["bull"]))
            m.update(open=o, year=yr, num=mn, high=hi, low=lo, peak=c, dd=0.0, bars=0, bull=bull_now)
        m["high"] = max(m["high"], hi)
        m["low"] = min(m["low"], lo)
        m["peak"] = max(m["peak"], c)
        m["dd"] = min(m["dd"], (c - m["peak"]) / m["peak"] * 100)
        m["bars"] += 1
        out["m_cells"][f'{m["year"]}-{m["num"]}'] = (c - m["open"]) / m["open"] * 100

        # ---- هفتهٔ سال
        if w["num"] is None or wn != w["num"] or yr != w["year"]:
            if w["open"] is not None and prev_close is not None:
                out["w"].append(dict(val=(prev_close - w["open"]) / w["open"] * 100,
                                     bucket=w["num"], year=w["year"], bull=w["bull"]))
            w.update(open=o, year=yr, num=wn, bull=bull_now)

        # ---- سالانه
        if y["year"] is None or yr != y["year"]:
            if y["open"] is not None and prev_close is not None:
                out["y"].append(dict(val=(prev_close - y["open"]) / y["open"] * 100, year=y["year"]))
            y.update(open=o, year=yr)

        # ---- روز هفته و روز ماه (بازده تک‌کندلی)
        day_ret = (c - o) / o * 100
        out["wd"].append(dict(val=day_ret, bucket=_pine_dow(d), year=yr, bull=bull_now))
        out["dom"].append(dict(val=day_ret, bucket=d.day, year=yr, bull=bull_now))

        prev_close = c
    out["last_year"] = bars[-1][0].year if bars else None
    return out


# ================================================================ فیلترها
def _match_market(bull, mf):
    return True if mf == 0 else (bull == 1 if mf == 1 else bull == 0)


def _filter(rows, s_year, e_year, mf):
    keep = [r for r in rows if s_year <= r["year"] <= e_year and _match_market(r.get("bull", 0), mf)]
    return [r["val"] for r in keep], [r["bucket"] for r in keep], keep


def roll_start_year(idx, cur_year):
    """f_rollStartYear"""
    return {1: cur_year - 4, 2: cur_year - 9, 3: cur_year - 19}.get(idx, 1900)


def window_stats(vals, years, cur_year, window_years):
    """f_windowStats — میانگین و نرخ برد در یک پنجرهٔ چندساله"""
    s_year = 1900 if window_years <= 0 else cur_year - window_years + 1
    tmp = [v for v, yy in zip(vals, years) if yy >= s_year]
    n = len(tmp)
    if n == 0:
        return (None, None, 0)
    return (sum(tmp) / n, sum(1 for v in tmp if v >= 0) * 1.0 / n * 100, n)


# ================================================================ ساخت جدول‌ها (پورت توابع f_draw*)
def analyze(bars, **kw):
    """همهٔ جدول‌های اندیکاتور را برای یک سری کندل روزانه حساب می‌کند."""
    o = dict(DEFAULTS)
    o.update({k: v for k, v in kw.items() if v is not None})
    mf, rw = o["market_filter"], o["rolling_window"]
    ml = walk(bars, o["bull_ma_len"])
    cur_year = ml["last_year"]
    eff_start = max(o["from_year"], roll_start_year(rw, cur_year))
    end = o["to_year"]

    def grid(cells, n_buckets):
        years = sorted({int(k.split("-")[0]) for k in cells}, reverse=True)
        years = [y for y in years if eff_start <= y <= end]
        rows = [{"year": y, "v": [cells.get(f"{y}-{b}") for b in range(1, n_buckets + 1)]} for y in years]
        s_min = years[-1] if years else eff_start
        s_max = years[0] if years else end
        return rows, s_min, s_max

    def period_block(rows_src, cells, n_buckets, ann_factor):
        rows, s_min, s_max = grid(cells, n_buckets)
        vals, buckets, keep = _filter(rows_src, s_min, s_max, mf)
        mfe = [r["mfe"] for r in keep]
        mae = [r["mae"] for r in keep]
        dd = [r["dd"] for r in keep]
        cols = []
        for b in range(1, n_buckets + 1):
            avg, med, win, best, worst, sd, n = bucket_stats(vals, buckets, b)
            x = bucket_stats_ext(vals, buckets, mfe, mae, dd, b, ann_factor, o["rf_annual"])
            sc = composite_score(x["avg"], x["win"], x["pf"], x["dd"])
            tier = ssi_tier(sc)
            cols.append(dict(
                bucket=b, avg=avg, median=med, win=win, best=best, worst=worst, sd=sd, n=n,
                mfe=x["mfe"], mae=x["mae"], dd=x["dd"], pf=x["pf"], exp=x["exp"], sharpe=x["sharpe"],
                vol=vol_rating(x["sd"]), score=sc, ssi=tier,
                ssi_en=(SSI_EN[tier - 1] if tier else None), ssi_fa=(SSI_FA[tier - 1] if tier else None),
                ssi_ckb=(SSI_CKB[tier - 1] if tier else None),
                stars=confidence_stars(x["n"], x["sd"], x["avg"])))
        return dict(rows=rows, cols=cols, range=[s_min, s_max])

    quarterly = period_block(ml["q"], ml["q_cells"], 4, 4.0)
    monthly = period_block(ml["m"], ml["m_cells"], 12, 12.0)

    def simple_block(rows_src, ids, names=None):
        vals, buckets, _ = _filter(rows_src, eff_start, end, mf)
        out = []
        for i, b in enumerate(ids):
            avg, med, win, best, worst, sd, n = bucket_stats(vals, buckets, b)
            row = dict(bucket=b, avg=avg, median=med, win=win, best=best, worst=worst, sd=sd, n=n)
            if names:
                row.update(en=names[0][i], fa=names[1][i], ckb=names[2][i])
            out.append(row)
        return out

    weekday = simple_block(ml["wd"], DAY_IDS, (DAYS_EN, DAYS_FA, DAYS_CKB))
    dom = simple_block(ml["dom"], list(range(1, 32)))
    woy = simple_block(ml["w"], list(range(1, 54)))

    # ---- داشبورد خلاصه
    yv = [r["val"] for r in ml["y"] if eff_start <= r["year"] <= end]
    n_y = len(yv)
    avg_y = sum(yv) / n_y if n_y else None
    sd_y = _stdev(yv, avg_y) if n_y > 1 else None
    ann_sharpe = ((avg_y - o["rf_annual"]) / sd_y) if (n_y > 1 and sd_y and sd_y > 0) else None

    qv, qb, _ = _filter(ml["q"], eff_start, end, mf)
    mv, mb, _ = _filter(ml["m"], eff_start, end, mf)
    (bq, bq_avg, bq_win), (wq, wq_avg, wq_win) = best_worst(qv, qb, [1, 2, 3, 4])
    (bm, bm_avg, bm_win), (wm, wm_avg, wm_win) = best_worst(mv, mb, list(range(1, 13)))
    month_avg = [bucket_stats(mv, mb, mm)[0] if bucket_stats(mv, mb, mm)[6] > 0 else None for mm in range(1, 13)]
    bh_start, bh_len, bh_ret = best_holding_period(month_avg)

    wdv, wdb, _ = _filter(ml["wd"], eff_start, end, mf)
    (bwd, bwd_avg, bwd_win), (wwd, wwd_avg, wwd_win) = best_worst(wdv, wdb, DAY_IDS)

    rq_vals = [r["val"] for r in ml["q"] if _match_market(r["bull"], mf)]
    rq_years = [r["year"] for r in ml["q"] if _match_market(r["bull"], mf)]
    rolling = []
    for wlen in (5, 10, 20, 0):
        a, wp, n = window_stats(rq_vals, rq_years, cur_year, wlen)
        rolling.append(dict(window=wlen, avg=a, win=wp, n=n))

    def dayname(bid, lst):
        return lst[DAY_IDS.index(bid)] if bid in DAY_IDS else None

    years_seen = [r["year"] for r in ml["y"] if eff_start <= r["year"] <= end]
    summary = dict(
        best_year=max(yv) if yv else None, worst_year=min(yv) if yv else None,
        avg_year=avg_y, median_year=_median(yv) if yv else None, annual_sharpe=ann_sharpe,
        best_quarter=bq, best_quarter_avg=bq_avg, best_quarter_win=bq_win,
        worst_quarter=wq, worst_quarter_avg=wq_avg, worst_quarter_win=wq_win,
        best_month=bm, best_month_avg=bm_avg, best_month_win=bm_win,
        worst_month=wm, worst_month_avg=wm_avg, worst_month_win=wm_win,
        best_hold_start=(bh_start + 1) if bh_start >= 0 else None,
        best_hold_len=bh_len if bh_len > 0 else None, best_hold_return=bh_ret,
        best_weekday=bwd, best_weekday_en=dayname(bwd, DAYS_EN), best_weekday_fa=dayname(bwd, DAYS_FA),
        best_weekday_ckb=dayname(bwd, DAYS_CKB), best_weekday_avg=bwd_avg, best_weekday_win=bwd_win,
        worst_weekday=wwd, worst_weekday_en=dayname(wwd, DAYS_EN), worst_weekday_fa=dayname(wwd, DAYS_FA),
        worst_weekday_ckb=dayname(wwd, DAYS_CKB), worst_weekday_avg=wwd_avg, worst_weekday_win=wwd_win,
        years_counted=n_y, rolling=rolling,
        year_range=[min(years_seen), max(years_seen)] if years_seen else None)

    th = o["prob_threshold"]
    prob = dict(
        quarters=[dict(bucket=b, n=bucket_stats(qv, qb, b)[6], win=bucket_stats(qv, qb, b)[2],
                       p_above=bucket_prob(qv, qb, b, th)[0], p_below=bucket_prob(qv, qb, b, th)[1])
                  for b in range(1, 5)],
        months=[dict(bucket=b, n=bucket_stats(mv, mb, b)[6], win=bucket_stats(mv, mb, b)[2],
                     p_above=bucket_prob(mv, mb, b, th)[0], p_below=bucket_prob(mv, mb, b, th)[1])
                for b in range(1, 13)],
        threshold=th)

    return dict(inputs=o, effective_from_year=eff_start, bars=len(bars),
                first_bar=bars[0][0].isoformat() if bars else None,
                last_bar=bars[-1][0].isoformat() if bars else None,
                quarterly=quarterly, monthly=monthly, weekday=weekday,
                day_of_month=dom, week_of_year=woy, summary=summary, probability=prob,
                yearly=[dict(year=r["year"], val=r["val"]) for r in ml["y"]])


# ================================================================ لایهٔ داده
BN = "https://data-api.binance.vision/api/v3/klines"
STOOQ = "https://stooq.com/q/d/l/?s={s}&i=d"

ASSETS = [
    {"id": "BTC", "src": "binance", "sym": ["BTCUSDT"], "tv": "BINANCE:BTCUSDT",
     "fa": "بیت‌کوین", "ckb": "بیتکۆین", "en": "Bitcoin"},
    {"id": "ETH", "src": "binance", "sym": ["ETHUSDT"], "tv": "BINANCE:ETHUSDT",
     "fa": "اتریوم", "ckb": "ئیسیریۆم", "en": "Ethereum"},
    {"id": "SOL", "src": "binance", "sym": ["SOLUSDT"], "tv": "BINANCE:SOLUSDT",
     "fa": "سولانا", "ckb": "سۆلانا", "en": "Solana"},
    {"id": "BNB", "src": "binance", "sym": ["BNBUSDT"], "tv": "BINANCE:BNBUSDT",
     "fa": "بی‌ان‌بی", "ckb": "بی‌ئێن‌بی", "en": "BNB"},
    {"id": "XRP", "src": "binance", "sym": ["XRPUSDT"], "tv": "BINANCE:XRPUSDT",
     "fa": "ریپل", "ckb": "ڕیپڵ", "en": "XRP"},
    # نمادهای Stooq به‌صورت فهرست نامزد می‌آیند: اولین نمادی که دادهٔ کافی بدهد انتخاب و در خروجی ثبت می‌شود.
    {"id": "GOLD", "src": "stooq", "sym": ["xauusd", "gc.f"], "tv": "TVC:GOLD",
     "fa": "طلا", "ckb": "زێڕ", "en": "Gold"},
    {"id": "SPX", "src": "stooq", "sym": ["^spx"], "tv": "SP:SPX",
     "fa": "اس‌اند‌پی ۵۰۰", "ckb": "ئێس ئەند پی ٥٠٠", "en": "S&P 500"},
    {"id": "NDX", "src": "stooq", "sym": ["^ndx", "^ndq"], "tv": "NASDAQ:NDX",
     "fa": "نزدک ۱۰۰", "ckb": "نازداک ١٠٠", "en": "Nasdaq 100"},
    {"id": "DXY", "src": "stooq", "sym": ["^dxy", "usdidx", "dx.f"], "tv": "TVC:DXY",
     "fa": "شاخص دلار", "ckb": "پێوەری دۆلار", "en": "US dollar index"},
    {"id": "OIL", "src": "stooq", "sym": ["cl.f", "wti.f"], "tv": "TVC:USOIL",
     "fa": "نفت WTI", "ckb": "نەوتی WTI", "en": "WTI oil"},
]


def _get(url, **kw):
    import requests
    r = requests.get(url, timeout=40, headers={"User-Agent": "entekhab.net seasonality"}, **kw)
    r.raise_for_status()
    return r


def binance_daily(sym):
    """کندل‌های روزانهٔ کامل از بایننس، صفحه‌به‌صفحه از ابتدای تاریخچهٔ نماد."""
    out, start = [], 0
    while True:
        p = {"symbol": sym, "interval": "1d", "limit": 1000}
        if start:
            p["startTime"] = start
        rows = _get(BN, params=p).json()
        if not rows:
            break
        for k in rows:
            d = datetime.fromtimestamp(k[0] / 1000, timezone.utc).date()
            out.append((d, float(k[1]), float(k[2]), float(k[3]), float(k[4])))
        if len(rows) < 1000:
            break
        start = rows[-1][0] + 86_400_000
        time.sleep(0.2)
    # آخرین کندل ناتمام امروز را دور می‌ریزیم تا هیچ دادهٔ نیمه‌کاره وارد آمار نشود
    today = datetime.now(timezone.utc).date()
    return [b for b in out if b[0] < today]


def stooq_daily(sym):
    """CSV روزانهٔ Stooq: Date,Open,High,Low,Close,Volume"""
    txt = _get(STOOQ.format(s=sym)).text
    rows = []
    for r in csv.DictReader(io.StringIO(txt)):
        try:
            rows.append((date.fromisoformat(r["Date"]), float(r["Open"]), float(r["High"]),
                         float(r["Low"]), float(r["Close"])))
        except (KeyError, ValueError, TypeError):
            continue
    today = datetime.now(timezone.utc).date()
    return [b for b in rows if b[0] < today]


def load_bars(asset):
    """اولین نماد نامزد که دادهٔ کافی بدهد؛ در غیر این صورت None و دلیلش."""
    fn = binance_daily if asset["src"] == "binance" else stooq_daily
    errs = []
    for sym in asset["sym"]:
        try:
            bars = fn(sym)
        except Exception as ex:                                   # noqa: BLE001
            errs.append(f"{sym}: {type(ex).__name__}")
            continue
        if len(bars) >= 400:
            return sorted(bars), sym, None
        errs.append(f"{sym}: only {len(bars)} bars")
    return None, None, " · ".join(errs)


# ================================================================ آزمون موتور (بدون شبکه)
def selftest():
    """موتور را با دادهٔ ساختگی می‌سنجد: بازده ماهانه، میانه، امتیاز و ستاره‌های اطمینان."""
    import random
    random.seed(7)
    bars, price = [], 100.0
    d = date(2015, 1, 1)
    while d < date(2025, 1, 1):
        o = price
        c = o * (1 + random.uniform(-0.03, 0.035))
        bars.append((d, o, max(o, c) * 1.004, min(o, c) * 0.996, c))
        price = c
        d += timedelta(days=1)

    # مرجع مستقل: بازده هر ماه = (close آخرین روز − open اولین روز) / open
    ref = {}
    for b in bars:
        k = (b[0].year, b[0].month)
        if k not in ref:
            ref[k] = [b[1], b[4]]
        ref[k][1] = b[4]
    ref = {k: (v[1] - v[0]) / v[0] * 100 for k, v in ref.items()}

    res = analyze(bars, from_year=1900)
    got = {(r["year"], r["bucket"]): r["val"] for r in walk(bars, 200)["m"]}
    # آخرین ماه هنوز باز است و طبق پاین وارد آمار نمی‌شود
    ref.pop(max(ref), None)
    bad = [k for k in ref if abs(ref[k] - got.get(k, 1e9)) > 1e-9]
    assert not bad, f"monthly returns differ on {bad[:3]}"
    assert len(got) == len(ref), f"month count {len(got)} vs {len(ref)}"

    assert _median([3.0, 1.0, 2.0]) == 2.0
    assert _median([4.0, 1.0, 3.0, 2.0]) == 2.5
    # امتیاز ترکیبی با اعداد دستی: 0.5*30 + 0.6*25 + (2/3)*25 + (1-10/30)*20
    want = 15.0 + 15.0 + 100 / 6 + 40 / 3
    assert abs(composite_score(0.0, 60.0, 2.0, -10.0) - want) < 1e-9
    assert ssi_tier(80) == 5 and ssi_tier(79.9) == 4 and ssi_tier(0) == 1 and ssi_tier(None) == 0
    assert confidence_stars(0, 1, 1) == 0 and confidence_stars(30, 0.0, 5.0) == 5
    assert vol_rating(4.9) == "Low" and vol_rating(9.9) == "Medium" and vol_rating(10) == "High"
    assert _pine_dow(date(2026, 11, 1)) == 1 and _pine_dow(date(2026, 11, 2)) == 2   # یکشنبه، دوشنبه

    s = res["summary"]
    assert s["years_counted"] == 9, s["years_counted"]            # ۲۰۱۵ تا ۲۰۲۳ (۲۰۲۴ ناتمام است)
    assert len(res["monthly"]["cols"]) == 12 and len(res["quarterly"]["cols"]) == 4
    assert all(c["n"] > 0 for c in res["monthly"]["cols"])
    assert 1 <= s["best_hold_start"] <= 12 and 1 <= s["best_hold_len"] <= 12
    tot = sum(c["n"] for c in res["probability"]["months"])
    assert tot == len(got), f"probability table covers {tot} of {len(got)} months"
    print(f"selftest OK · {len(bars)} bars · {len(got)} months · {s['years_counted']} years · "
          f"best month {MONTHS[s['best_month'] - 1]} {s['best_month_avg']:+.2f}%")


# ================================================================ اجرا
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--only", help="فقط این شناسه‌ها، با کاما")
    a = ap.parse_args()
    if a.selftest:
        selftest()
        return
    want = set(a.only.split(",")) if a.only else None
    out, skipped = {}, []
    for asset in ASSETS:
        if want and asset["id"] not in want:
            continue
        bars, sym, err = load_bars(asset)
        if not bars:
            skipped.append(f'{asset["id"]} ({err})')
            continue
        res = analyze(bars)
        res["asset"] = {k: asset[k] for k in ("id", "tv", "fa", "ckb", "en")}
        res["asset"]["symbol"] = sym
        res["asset"]["source"] = asset["src"]
        out[asset["id"]] = res
        s = res["summary"]
        print(f'{asset["id"]:5} {sym:9} {res["bars"]:>6} bars {res["first_bar"]}→{res["last_bar"]} '
              f'· best month {MONTHS[s["best_month"] - 1] if s["best_month"] else "–"}')
    now = datetime.now(timezone.utc)
    doc = {"made": now.isoformat(timespec="seconds"),
           "source": "Kurdistani Market Analyzer PRO (@Coin_Kurd) — server-side port",
           "note": "آمار توصیف گذشته است، نه پیش‌بینی آینده. هر عدد با تعداد نمونهٔ خودش خوانده شود.",
           "week_rule": "ISO-8601",
           "inputs": DEFAULTS, "current_month": now.month, "current_quarter": (now.month + 2) // 3,
           "skipped": skipped, "assets": out}
    os.makedirs(D, exist_ok=True)
    with open(os.path.join(D, "seasonality.json"), "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"seasonality: {len(out)} assets" + (f" · skipped {len(skipped)}: {'; '.join(skipped)}" if skipped else ""))


if __name__ == "__main__":
    main()
