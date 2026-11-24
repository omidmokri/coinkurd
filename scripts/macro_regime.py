#!/usr/bin/env python3
"""Kurdistani Macro Regime (Coin_Kurd, open source, MPL-2.0) computed on daily bars from FRED's public CSVs.

A port of the published script's rule engine: growth / inflation / liquidity scores → regime
(RECESSION, STAGFLATION, EXPANSION, RECOVERY, SLOWDOWN), risk on/off, recession risk, Fed-pivot and
dollar-milkshake scores, asset outlook (XAU, BTC, DXY, SPX, TLT) and the script's chart signals.
Monthly and quarterly series are carried forward to each day; "previous" for them means the previous
release (on TradingView the same expressions depend on the chart's timeframe).

Called at the end of scripts/macro.py (which update.yml already runs); writes data/macro_regime.json.
"""
import json
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "macro_regime.json")
REGIMES = ["RECESSION", "STAGFLATION", "EXPANSION", "RECOVERY", "SLOWDOWN"]
SERIES = {"cpi": "CPIAUCSL", "rate": "FEDFUNDS", "unemp": "UNRATE", "manemp": "MANEMP", "gdp": "GDPC1", "m2": "M2SL", "y10": "DGS10", "y2": "DGS2",
          "y30": "DGS30", "vix": "VIXCLS", "oil": "DCOILWTICO", "tips": "T10YIE", "hy": "BAMLH0A0HYM2", "ig": "BAMLC0A0CM", "em": "BAMLEMCBPIOAS"}
DEFAULT = {"ecb": 1.0, "hy": 4.0, "ig": 1.2, "em": 1.0, "tips": 1.0, "y30": 1.0}       # the script's own fall-backs when a series is missing


def rsi(vals, n=14):
    out, ag, al = [None] * len(vals), 0.0, 0.0
    for i in range(1, len(vals)):
        ch = vals[i] - vals[i - 1]
        g, l = max(ch, 0.0), max(-ch, 0.0)
        if i <= n:
            ag += g / n
            al += l / n
            if i < n:
                continue
        else:
            ag, al = (ag * (n - 1) + g) / n, (al * (n - 1) + l) / n
        out[i] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    return out


def trend(cur, prev):
    return "UP" if cur > prev * 1.02 else "DN" if cur < prev * 0.98 else "FL"


def build(raw, days_out=1300):
    """raw: {name: {date: value}} → the published json"""
    P = {k: sorted(v.items()) for k, v in raw.items()}

    def releases(name):                       # [(date, value, previous, value a year earlier, the release before that year-ago one)]
        return P.get(name, [])

    # per-release derived monthly/quarterly values
    cpi = releases("cpi")
    cpi_yoy = [(d, (v - cpi[i - 12][1]) / cpi[i - 12][1] * 100) for i, (d, v) in enumerate(cpi) if i >= 12]
    m2 = releases("m2")
    m2_yoy = [(d, (v - m2[i - 12][1]) / m2[i - 12][1] * 100) for i, (d, v) in enumerate(m2) if i >= 12]
    gdp = releases("gdp")
    gdp_yoy = [(d, (v - gdp[i - 4][1]) / gdp[i - 4][1] * 100) for i, (d, v) in enumerate(gdp) if i >= 4]
    man = releases("manemp")
    r = rsi([v for _, v in man])
    pmi = [(man[i][0], r[i] * 0.5 + 25) for i in range(len(man)) if r[i] is not None]
    derived = {"cpi_yoy": cpi_yoy, "m2_yoy": m2_yoy, "gdp_yoy": gdp_yoy, "pmi": pmi, "unemp": releases("unemp"), "gdp": gdp, "m2": m2}
    daily = {k: P.get(k, []) for k in ("rate", "ecb", "y10", "y2", "y30", "vix", "oil", "tips", "hy", "ig", "em")}

    def at(seq, d, back=0):                   # the last value on or before d (back=1: the one before it)
        lo, hi = 0, len(seq)
        while lo < hi:
            m = (lo + hi) // 2
            if seq[m][0] <= d:
                lo = m + 1
            else:
                hi = m
        i = lo - 1 - back
        return seq[i][1] if i >= 0 else None

    end = date.today()
    days = [(end - timedelta(days=k)).isoformat() for k in range(days_out + 30, -1, -1)]
    rows, sigs, prev, hist = [], [], {}, []
    for d in days:
        v = {k: at(s, d) for k, s in derived.items()}
        v.update({k: at(s, d) for k, s in daily.items()})
        for k, dv in DEFAULT.items():
            if v.get(k) is None:
                v[k] = dv
        need = ("cpi_yoy", "m2_yoy", "gdp_yoy", "pmi", "unemp", "rate", "y10", "y2", "vix", "oil")
        if any(v.get(k) is None for k in need):
            continue
        cpi_p, un_p, pmi_p, gdp_p = at(cpi_yoy, d, 1), at(derived["unemp"], d, 1), at(pmi, d, 1), at(gdp_yoy, d, 1)
        if None in (cpi_p, un_p, pmi_p, gdp_p):
            continue
        i_cpi, i_rate, i_un, i_pmi, i_gdp, i_m2 = v["cpi_yoy"], v["rate"], v["unemp"], v["pmi"], v["gdp_yoy"], v["m2_yoy"]
        real_rate, yc, yc30, spread = i_rate - i_cpi, v["y10"] - v["y2"], v["y30"] - v["y2"], i_rate - v["ecb"]
        credit = v["hy"] - v["ig"]
        vix_score = -20 if v["vix"] > 30 else 15 if v["vix"] < 15 else 0
        hist.append({"oil": v["oil"], "yc": yc})
        oil5 = hist[-6]["oil"] if len(hist) > 5 else v["oil"]
        oil_chg = (v["oil"] - oil5) / oil5 * 100 if oil5 else 0.0
        yc20 = hist[-21]["yc"] if len(hist) > 20 else yc
        pivot = min((20 if yc > yc20 else 0) + (20 if i_rate > 4 else 0) + (20 if i_un > 4.5 else 0) + (20 if i_cpi < 3 else 0) + (20 if i_gdp < 1 else 0), 99)
        milk = min((25 if spread > 2 else 15 if spread > 1 else 0) + (20 if v["em"] > 400 else 10 if v["em"] > 300 else 0) + (15 if credit > 5 else 8 if credit > 3.5 else 0)
                   + (20 if v["vix"] > 25 else 10 if v["vix"] > 20 else 0) + (20 if real_rate > 1.5 else 0), 99)
        cpi_t, un_t, pmi_t, gdp_t = trend(i_cpi, cpi_p), trend(i_un, un_p), trend(i_pmi, pmi_p), trend(i_gdp, gdp_p)
        growth = (2 if i_gdp > 2.5 else 1 if i_gdp > 1 else -2 if i_gdp < 0 else 0) + (2 if i_pmi > 52 else 1 if i_pmi > 50 else -2 if i_pmi < 48 else 0) \
            + (1 if i_un < 4 else -2 if i_un > 5.5 else 0) + (1 if gdp_t == "UP" else -1 if gdp_t == "DN" else 0)
        infl = (3 if i_cpi > 3.5 else 1 if i_cpi > 2.5 else -2 if i_cpi < 2.0 else 0) + (1 if cpi_t == "UP" else -1 if cpi_t == "DN" else 0)
        liq = (2 if i_m2 > 4 else 1 if i_m2 > 1 else -2 if i_m2 < -1 else 0) + (2 if i_rate < 2 else -1 if i_rate > 5 else 0) + (-2 if yc < -0.5 else 1 if yc > 0.5 else 0) + vix_score / 10
        is_exp, is_stag, is_rec, is_recov = growth >= 4 and infl < 3, infl >= 3 and growth <= 1, growth <= -3, growth >= 2 and infl < 1
        regime = 0 if is_rec else 1 if is_stag else 2 if is_exp else 3 if is_recov else 4
        rec = min((25 if yc < -0.5 else 12 if yc < 0 else 0) + (20 if i_un > un_p * 1.05 else 0) + (20 if i_pmi < 48 else 10 if i_pmi < 50 else 0)
                  + (25 if i_gdp < 0 else 10 if i_gdp < 1 else 0) + (10 if real_rate > 2.5 else 0) + (10 if credit > 5 else 0), 99)
        risk = (2 if growth > 3 else -2 if growth < 0 else 0) + (2 if liq > 2 else -2 if liq < -1 else 0) + (1 if rec < 25 else -2 if rec > 50 else 0) \
            + (1 if yc > 0.3 else -1 if yc < -0.3 else 0) + (-1 if credit > 5 else 0)
        risk_on, risk_off = risk >= 2, risk <= -2
        health = 50 + growth * 5 + (5 if infl < 2 else -10 if infl > 3 else 0) + (8 if liq > 1 else -8 if liq < -1 else 0) + (10 if rec < 20 else -15 if rec > 60 else 0) + (5 if yc > 0 else -5)
        health = max(5, min(95, health))
        wr, wi = (2.0 if is_rec else 1.5 if is_exp else 1.0), (2.0 if is_stag else 1.5 if is_exp else 1.0)
        wl, wg = (2.5 if is_rec else 2.0 if is_recov else 1.0), (1.5 if is_exp else 2.0 if is_rec else 1.0)
        clamp = lambda x: int(max(5, min(95, round(x))))      # noqa: E731
        xau = clamp(50 + (20 if real_rate < -0.5 else -20 if real_rate > 2.0 else -real_rate * 5) * wr + (10 if i_cpi > 3.5 else -8 if i_cpi < 2.0 else 0) * wi
                    + (15 if is_rec else 12 if is_stag else -8 if is_exp else 0) + (8 if liq > 2 else -5 if liq < -1 else 0) * wl
                    + (4 if cpi_t == "UP" else -4 if cpi_t == "DN" else 0) + (8 if v["tips"] > 2.5 else 0) + (-5 if milk > 60 else 0))
        btc = clamp(50 + (18 if liq > 2 else -18 if liq < -1 else liq * 5) * wl + (10 if real_rate < 0 else -12 if real_rate > 2 else 0) * wr + (12 if risk_on else -12 if risk_off else 0)
                    + (8 if growth > 3 else -8 if growth < 0 else 0) * wg + (-5 if spread > 1 else 5 if spread < 0 else 0) + vix_score + (10 if pivot > 60 else 0))
        dxy = clamp(50 + (20 if spread > 1.5 else -15 if spread < 0 else spread * 8) + (12 if real_rate > 2.0 else -12 if real_rate < -0.5 else real_rate * 4)
                    + (8 if growth > 3 else -8 if growth < -2 else 0) + (10 if risk_off else -5 if risk_on else 0) + (5 if liq < -1 else -5 if liq > 2 else 0) + (12 if milk > 60 else 0))
        spx = clamp(50 + (18 if growth > 3 else -18 if growth < 0 else growth * 4) * wg + (12 if liq > 2 else -12 if liq < -1 else 0) * wl + (8 if real_rate < 0 else -10 if real_rate > 3 else 0)
                    + (-20 if is_rec else -10 if is_stag else 10 if is_exp else 0) + (5 if yc > 0.5 else -8 if yc < -0.5 else 0) + (-8 if credit > 5 else 5 if credit < 2.5 else 0))
        tlt = clamp(50 + (25 if is_rec else -10 if is_exp else 0) + (20 if pivot > 60 else 10 if pivot > 40 else 0) + (15 if real_rate > 2 else -10 if real_rate < 0 else 0)
                    + (-5 if yc30 > 1 else 10 if yc30 < 0 else 0))
        cur = {"gold": xau >= 65 and real_rate < 0, "btc": btc >= 60 and risk_on, "flight": dxy > 65 and (risk_off or is_rec), "ycinv": yc < -0.5, "pivot": pivot > 70,
               "regime": regime, "oilup": oil_chg > 5, "oildn": oil_chg < -5}
        if prev:
            for k, code in (("gold", "XAU+"), ("btc", "BTC+"), ("flight", "CASH"), ("ycinv", "YC INV"), ("pivot", "PIVOT?"), ("oilup", "OIL+"), ("oildn", "OIL-")):
                if cur[k] and not prev[k]:
                    sigs.append([d, code])
            if cur["regime"] != prev["regime"]:
                sigs.append([d, "R:" + REGIMES[regime]])
        prev = cur
        rows.append([d, regime, 1 if risk_on else -1 if risk_off else 0, 1 if yc < 0 else 0])
        now = {"date": d, "regime": REGIMES[regime], "risk": "RISK ON" if risk_on else "RISK OFF" if risk_off else "NEUTRAL", "cpi": round(i_cpi, 2), "cpi_trend": cpi_t,
               "real_rate": round(real_rate, 2), "fed_rate": round(i_rate, 2), "ecb_rate": round(v["ecb"], 2), "spread": round(spread, 2), "vix": round(v["vix"], 1),
               "unemp": round(i_un, 2), "unemp_trend": un_t, "pmi": round(i_pmi, 1), "gdp": round(i_gdp, 2), "yc": round(yc, 2), "yc30": round(yc30, 2), "tips": round(v["tips"], 2),
               "rec_risk": round(rec), "health": int(round(health)), "pivot": int(pivot), "milkshake": int(milk), "credit": round(credit, 2), "oil_chg": round(oil_chg, 1),
               "scores": {"XAU": xau, "BTC": btc, "DXY": dxy, "SPX": spx, "TLT": tlt}}
    if not rows:
        return None
    cut = days[-days_out]
    return {"updated": date.today().isoformat(), "regimes": REGIMES, "rows": [r_ for r_ in rows if r_[0] >= cut], "signals": [s for s in sigs if s[0] >= cut][-300:], "now": now,
            "source": "FRED public CSV · rule engine of the open-source script “Kurdistani Macro Regime” (Coin_Kurd, MPL-2.0), daily bars",
            "note": "Rule-based estimate, not a forecast and not investment advice."}


def main(fred=None):
    if fred is None:
        from macro import fred
    raw = {}
    for name, sid in SERIES.items():
        try:
            raw[name] = fred(sid)
        except Exception as e:  # noqa: BLE001
            print("macro_regime: no", sid, str(e)[:60])
    for sid in ("ECBMAINRES", "ECBMRRFR"):                       # the script's id first; FRED's current id for the ECB main refinancing rate second
        try:
            raw["ecb"] = fred(sid)
            break
        except Exception:  # noqa: BLE001
            continue
    out = build(raw)
    if not out:
        print("macro_regime: not enough data, file left as it was")
        return
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("macro regime:", out["now"]["regime"], out["now"]["risk"], "rows", len(out["rows"]), "signals", len(out["signals"]))


if __name__ == "__main__":
    main()
