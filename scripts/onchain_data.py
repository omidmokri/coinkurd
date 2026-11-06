#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The evidence block for the channel's market analysis.

Everything here comes from files this repo already collects and timestamps. Nothing is estimated and
nothing is filled in from memory: an indicator the project cannot see is named in `missing` so the
report can say so out loud instead of inventing it.
"""
import datetime
import io
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.environ.get("REALITY_DATA_DIR") or os.path.join(ROOT, "data")

# indicators the owner's brief asks for that no feed here provides — never guessed, always declared
UNSEEN = [
    "شاخص‌های زنجیره‌ای هولدرها: نسبت ارزش بازار به ارزش تحقق‌یافته، نسبت سود خروجی خرج‌شده، سود و زیان تحقق‌نیافتهٔ خالص و عرضهٔ هولدرهای بلندمدت",
    "خالص ورود و خروج صرافی‌ها و ذخایر صرافی",
    "جریان خالص صندوق‌های قابل معاملهٔ بیت‌کوین",
    "نقشهٔ حرارتی لیکوئیدیشن و خوشه‌های آن (مجموع لیکوئیدها در دسترس است، نقشهٔ سطوح نه)",
    "داده‌های اختیار معامله: نوسان ضمنی، نسبت اختیار خرید به فروش و چولگی",
]


def _load(name, default=None):
    try:
        return json.load(io.open(os.path.join(DATA, name), encoding="utf-8"))
    except Exception:
        return default if default is not None else {}


def _pct(a, b):
    return None if not a or not b else (a / b - 1) * 100


def snapshot():
    """every figure the report is allowed to use, each with the file it came from"""
    mk, dv, mc, ch, ev, fl = (_load("market.json"), _load("derivatives.json"), _load("macro.json"),
                              _load("chain.json"), _load("events.json"), _load("flows.json"))
    out = {"at": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
           "missing": list(UNSEEN), "stamps": {}, "gaps": []}
    for k, d in (("بازار", mk), ("مشتقات", dv), ("کلان", mc), ("زنجیره", ch), ("تقویم", ev), ("جریان", fl)):
        if d.get("updated_at"):
            out["stamps"][k] = d["updated_at"]
        else:
            out["gaps"].append(k)

    coins = {c.get("coin"): c for c in (mk.get("coins") or [])}
    b = coins.get("BTC") or {}
    spark = b.get("spark") or []
    day = spark[-24:] if len(spark) >= 24 else spark
    out["btc"] = {
        "price": b.get("price"), "chg24": b.get("chg24"), "rsi": b.get("rsi"), "trend": b.get("trend"),
        "ema20": b.get("ema20"), "ema50": b.get("ema50"), "hi48": b.get("hi48"), "lo48": b.get("lo48"),
        "qvol": b.get("qvol"),
        # the brief insists the volatility measure is named: high-low range of the last 24 hourly closes
        "vol24": (max(day) - min(day)) / b["price"] * 100 if day and b.get("price") else None,
        "vol24_how": "دامنهٔ بیشینه تا کمینهٔ ۲۴ بستهٔ ساعتی نسبت به قیمت کنونی",
        # the hourly closes ignore the wicks, so the wider 48h high-low goes alongside it rather than
        # instead of it — understating the range would be its own kind of invented number
        "range48": _pct(b.get("hi48"), b.get("lo48")),
        "range48_how": "فاصلهٔ سقف تا کف ۴۸ ساعته، شامل سایه‌ها",
        "vs_ema20": _pct(b.get("price"), b.get("ema20")), "vs_ema50": _pct(b.get("price"), b.get("ema50")),
    }
    out["alts"] = [{"coin": c.get("coin"), "price": c.get("price"), "chg24": c.get("chg24"),
                    "rsi": c.get("rsi"), "trend": c.get("trend")}
                   for c in (mk.get("coins") or [])[1:6]]
    out["global"] = mk.get("global") or {}
    f = mk.get("fng") or {}
    hist = f.get("history") or []
    out["fng"] = {"value": f.get("value"), "class": f.get("class"),
                  "d7": (f.get("value") - hist[-8][1]) if len(hist) >= 8 and isinstance(hist[-8], (list, tuple)) else None,
                  "d30_min": min((h[1] for h in hist if isinstance(h, (list, tuple))), default=None),
                  "d30_max": max((h[1] for h in hist if isinstance(h, (list, tuple))), default=None)}

    sw = {s.get("coin"): s for s in (dv.get("swaps") or [])}
    out["deriv"] = {"total_oi_usd": dv.get("total_oi_usd"), "avg_funding": dv.get("avg_funding"),
                    "btc": sw.get("BTC"), "eth": sw.get("ETH"),
                    "hot": (dv.get("funding_hot") or [])[:3], "cold": (dv.get("funding_cold") or [])[:3]}
    hist_oi = [h for h in (dv.get("history") or []) if isinstance(h, dict)]
    if len(hist_oi) >= 25:
        out["deriv"]["oi_chg24"] = _pct(hist_oi[-1].get("oi"), hist_oi[-25].get("oi"))
        out["deriv"]["btc_oi_chg24"] = _pct(hist_oi[-1].get("btc_oi"), hist_oi[-25].get("btc_oi"))
    bt = dv.get("BTC") or {}
    ls = [x for x in (bt.get("long_short") or []) if isinstance(x, (list, tuple)) and len(x) > 1]
    if ls:
        out["deriv"]["long_short"] = ls[-1][1]
        if len(ls) >= 25:
            out["deriv"]["long_short_24h_ago"] = ls[-25][1]
    tk = [x for x in (bt.get("taker") or []) if isinstance(x, (list, tuple)) and len(x) > 2]
    if len(tk) >= 24:                                   # taker buy minus taker sell = the signed flow
        day = tk[-24:]
        out["deriv"]["cvd24_usd"] = sum(x[1] for x in day) - sum(x[2] for x in day)
        out["deriv"]["taker_buy24"] = sum(x[1] for x in day)
        out["deriv"]["taker_sell24"] = sum(x[2] for x in day)
    lq = bt.get("liq") or {}
    if lq:
        out["deriv"]["liq"] = {"long_usd": lq.get("long_usd"), "short_usd": lq.get("short_usd"),
                               "long_1h": lq.get("long_usd_1h"), "short_1h": lq.get("short_usd_1h"),
                               "window_min": round(((lq.get("to") or 0) - (lq.get("from") or 0)) / 60000) or None}

    last, chg = mc.get("last") or {}, mc.get("chg_1m") or {}
    out["macro"] = {k: {"value": (last.get(k) or {}).get("value"), "date": (last.get(k) or {}).get("date"),
                        "chg_1m": chg.get(k)}
                    for k in ("DXY", "SPX", "NDX", "GOLD", "US10Y", "OIL") if k in last or k in chg}
    roll = mc.get("rolling_btc_spx_30d") or []
    out["corr_btc_spx_30d"] = roll[-1][1] if roll and isinstance(roll[-1], (list, tuple)) and len(roll[-1]) > 1 else None

    adj = ch.get("adjustment") or {}
    out["chain"] = {"hashrate": ch.get("hashrate"), "difficulty": ch.get("difficulty"),
                    "retarget_pct": adj.get("difficultyChange"), "fee_fast": (ch.get("fees") or {}).get("fastestFee"),
                    "fee_hour": (ch.get("fees") or {}).get("hourFee")}

    now = datetime.datetime.now(datetime.timezone.utc)
    soon = []
    for x in (ev.get("events") or []):
        try:
            t = datetime.datetime.fromisoformat(str(x.get("date")).replace("Z", "+00:00"))
        except Exception:
            continue
        if 0 <= (t - now).total_seconds() <= 8 * 86400:
            soon.append({"fa": x.get("title_fa") or x.get("title"), "impact": x.get("impact"),
                         "date": t.strftime("%Y-%m-%d %H:%M"), "forecast": x.get("forecast")})
    out["events"] = soon[:6]
    out["dominance"] = (fl.get("dominance") or [])[:5]
    return out


if __name__ == "__main__":
    print(json.dumps(snapshot(), ensure_ascii=False, indent=1)[:4000])
