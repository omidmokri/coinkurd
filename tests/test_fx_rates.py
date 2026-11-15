#!/usr/bin/env python3
"""scripts/fx_rates.py against sources faked in their real formats (no network):
  * the ECB's eurofxref-hist.csv (zipped; a header ending in a comma, N/A where a currency has no rate), Frankfurter's
    time series, exchange-api's daily usd.min.json (lower-case codes, usdt among them);
  * known answers: a euro rate worked out by hand, weekends carried from Friday, the tether's dollar value applied only
    where it is known, a one-day glitch dropped while a devaluation is kept, a currency with no source left out;
  * a second run fetches only the new day, and a history file is rewritten only when a week behind.
Run: python3 tests/test_fx_rates.py"""
import datetime as dt
import io
import json
import os
import shutil
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import fx_rates as F  # noqa: E402

FAILS = []


def ok(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f" — {extra}" if extra and not cond else ""))
    if not cond:
        FAILS.append(name)


def close(a, b, rel=1e-5):
    return a is not None and b is not None and abs(a - b) <= rel * max(abs(a), abs(b))


# ------------------------------------------------------------------ fake sources
TODAY = dt.date(2026, 11, 15)          # a Sunday


def usd_per_eur(d):                     # the dollar per euro the fake ECB publishes
    return 1.10 + 0.0001 * (d - dt.date(2017, 1, 1)).days % 7


def ecb_csv(last=TODAY):
    rows = ["Date,USD,JPY,CZK,TRY,RUB,"]
    d = last
    while d >= dt.date(2016, 12, 20):
        if d.weekday() < 5:                     # business days only, newest first (as the ECB file is)
            u = usd_per_eur(d)
            jpy = 160.0 * u
            czk = 24.0 * u
            trl = 30.0 * u if d < dt.date(2026, 6, 1) else 45.0 * u        # a devaluation on 1 June 2026: kept
            if d == dt.date(2026, 3, 4):
                trl = 99.0 * u                                              # a one-day glitch: dropped
            rub = "N/A" if d >= dt.date(2022, 3, 1) else f"{80.0 * u:.4f}"  # the ECB stopped quoting the rouble
            rows.append(f"{d.isoformat()},{u:.4f},{jpy:.4f},{czk:.4f},{trl:.4f},{rub},")
        d -= dt.timedelta(1)
    return "\n".join(rows) + "\n"


def ecb_zip(last=TODAY):
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        z.writestr("eurofxref-hist.csv", ecb_csv(last))
    return b.getvalue()


MISSING_XAPI = {dt.date(2025, 1, 10)}           # a day neither host has: the day before is carried


def xapi(d):
    if d in MISSING_XAPI:
        return None
    k = (d - dt.date(2024, 3, 2)).days
    return {"date": d.isoformat(), "usd": {"usdt": 1.002 if k % 2 else 0.998, "vnd": 25000.0 + k, "eur": 0.9, "uah": 41.0,
                                          "btc": 0.00002, "xyz": 5.0}}


CALLS = []


def fake_get(url, timeout=40, tries=3):
    CALLS.append(url)
    if url == F.ECB_ZIP:
        return ecb_zip(FAKE_TODAY[0])
    for host in ("cdn.jsdelivr.net", "currency-api.pages.dev"):
        if host in url:
            ds = url.split("@")[1].split("/")[0] if "@" in url else url.split("//")[1].split(".")[0]
            d = dt.date.fromisoformat(ds)
            if d > FAKE_TODAY[0]:
                return None
            j = xapi(d)
            return json.dumps(j).encode() if j else None
    return None


FAKE_TODAY = [TODAY]


def main():
    # parsing
    eb = F.ecb_parse(ecb_csv())
    d0 = dt.date(2026, 11, 13)           # a Friday
    ok("ECB file: a currency per dollar = per euro / dollars per euro", close(eb["JPY"][d0], 160.0) and close(eb["EUR"][d0], 1 / usd_per_eur(d0)),
       (eb["JPY"][d0], eb["EUR"][d0]))
    ok("ECB file: N/A is no value (the rouble after March 2022)", dt.date(2022, 3, 1) not in eb.get("RUB", {}) and dt.date(2022, 2, 25) in eb["RUB"])
    ok("ECB file: nothing before 2017", min(eb["EUR"]) >= F.START)
    fr = F.frank_parse({"amount": 1.0, "base": "USD", "start_date": "2017-01-02", "rates": {"2017-01-02": {"EUR": 0.95, "JPY": 117.1}, "2017-01-03": {"EUR": 0.96}}})
    ok("Frankfurter: rates are already per dollar", fr["EUR"][dt.date(2017, 1, 3)] == 0.96 and fr["JPY"][dt.date(2017, 1, 2)] == 117.1)
    f = F.fill({dt.date(2026, 1, 2): 1.0, dt.date(2026, 1, 9): 2.0}, dt.date(2026, 1, 1), dt.date(2026, 1, 10), 5)
    ok("fill: no value before the first, held 5 days, then empty until the next", f == [None, 1, 1, 1, 1, 1, 1, None, 2, 2], f)
    ok("despike: a one-day glitch goes, a lasting jump stays", F.despike([10, 10, 20, 10, 10]) == [10, 10, None, 10, 10] and F.despike([10, 10, 20, 20, 20]) == [10, 10, 20, 20, 20])

    # a full first run
    out = tempfile.mkdtemp()
    try:
        logs = []
        latest = F.run(out=out, get=fake_get, today=TODAY, budget=600, threads=8, log=logs.append)
        eur = json.load(open(os.path.join(out, "EUR.json")))
        ok("EUR comes from the ECB, from 2017", eur["src"] == "ecb" and eur["from"] == "2017-01-02", (eur["src"], eur["from"]))
        # 2026-11-13 (Friday): EUR per USD = 1/usd_per_eur; USDT that day: k odd -> usdt 1.002 per dollar -> USD per USDT = 1/1.002
        k = (d0 - dt.date(2024, 3, 2)).days
        want = (1 / usd_per_eur(d0)) * (1 / (1.002 if k % 2 else 0.998))
        i = (d0 - dt.date(2017, 1, 2)).days
        ok("hand-checked: EUR per USDT on 13 Nov 2026 = (1 / dollars per euro) × dollars per tether", close(eur["v"][i], want), (eur["v"][i], want))
        sat = eur["v"][i + 1]
        ok("Saturday keeps Friday's ECB rate (× that day's tether)", close(sat, (1 / usd_per_eur(d0)) * (1 / (1.002 if (k + 1) % 2 else 0.998))), sat)
        i17 = (dt.date(2018, 6, 1) - dt.date(2017, 1, 2)).days
        ok("before March 2024 the tether counts as one dollar", close(eur["v"][i17], 1 / usd_per_eur(dt.date(2018, 6, 1))))
        tr = json.load(open(os.path.join(out, "TRY.json")))
        it = (dt.date(2026, 3, 4) - dt.date(2017, 1, 2)).days
        ok("a one-day glitch (TRY ×3.3 for a day) is left out", tr["v"][it] is None and tr["v"][it - 1] and tr["v"][it + 1], tr["v"][it - 1:it + 2])
        ib, ia = (dt.date(2026, 5, 29) - dt.date(2017, 1, 2)).days, (dt.date(2026, 6, 2) - dt.date(2017, 1, 2)).days
        ok("a devaluation (TRY 30 → 45 per euro-dollar) is kept", tr["v"][ia] / tr["v"][ib] > 1.4, (tr["v"][ib], tr["v"][ia]))
        vnd = json.load(open(os.path.join(out, "VND.json")))
        ok("VND (not at the ECB) comes from exchange-api, from 2 March 2024", vnd["src"] == "xapi" and vnd["from"] == "2024-03-02", (vnd["src"], vnd["from"]))
        j = (dt.date(2025, 1, 10) - dt.date(2024, 3, 2)).days
        ok("a day exchange-api lacks keeps the day before (its rate and its tether)", vnd["v"][j] == vnd["v"][j - 1] and close(vnd["v"][j - 1], (25000.0 + j - 1) / (1.002 if (j - 1) % 2 else 0.998)),
           vnd["v"][j - 1:j + 2])
        ok("the rouble: the ECB stopped in 2022 and the fake exchange-api has none, so no file (never an old rate as today's)",
           not os.path.exists(os.path.join(out, "RUB.json")) and "RUB" not in json.load(open(os.path.join(out, "latest.json")))["r"])
        ok("a currency nobody quotes (XYZ is not a country's currency) gets no file", not os.path.exists(os.path.join(out, "XYZ.json")))
        ok("no file for USD (USDT pairs as they are) or the rial (the page uses tgju's toman)", not os.path.exists(os.path.join(out, "USD.json")) and not os.path.exists(os.path.join(out, "IRR.json")))
        L = json.load(open(os.path.join(out, "latest.json")))
        ok("latest.json: 14 days of every currency with its source", L["from"] == "2026-11-02" and L["to"] == "2026-11-15" and len(L["r"]["EUR"]) == 15 and L["r"]["EUR"][0] == "ecb" and L["r"]["VND"][0] == "xapi",
           (L["from"], L["to"], len(L["r"]["EUR"])))
        ok("latest.json: today's EUR is Friday's ECB rate × today's tether", close(L["r"]["EUR"][-1], (1 / usd_per_eur(d0)) * (1 / (1.002 if (k + 2) % 2 else 0.998))), L["r"]["EUR"][-1])
        ok("latest.json: dollars per tether today", close(L["usdt"], 1 / (1.002 if (k + 2) % 2 else 0.998)), L["usdt"])
        n_x = sum(1 for c in CALLS if "jsdelivr" in c)

        # the next day: one new exchange-api day; EUR's file is not rewritten (a day behind is not a week)
        CALLS.clear()
        FAKE_TODAY[0] = TODAY + dt.timedelta(1)
        mt = os.path.getmtime(os.path.join(out, "EUR.json"))
        F.run(out=out, get=fake_get, today=TODAY + dt.timedelta(1), budget=600, threads=8, log=logs.append)
        new_days = [c for c in CALLS if "jsdelivr" in c]
        ok("a second run fetches only the new day (+ the one missing day again)", len(new_days) <= 3 and n_x > 900, (len(new_days), n_x))
        ok("a history file one day behind is not rewritten", os.path.getmtime(os.path.join(out, "EUR.json")) == mt)
        L2 = json.load(open(os.path.join(out, "latest.json")))
        ok("…but latest.json has the new day", L2["to"] == "2026-11-16" and L2["r"]["VND"][-1] is not None)
        # a week later the files are rewritten and still continuous
        for n in range(2, 9):
            FAKE_TODAY[0] = TODAY + dt.timedelta(n)
            F.run(out=out, get=fake_get, today=TODAY + dt.timedelta(n), budget=600, threads=8, log=logs.append)
        v2 = json.load(open(os.path.join(out, "VND.json")))
        jn = (dt.date.fromisoformat(v2["to"]) - dt.date(2024, 3, 2)).days
        ok("a week on: VND's file is rewritten up to date, values unchanged where they were", v2["to"] >= "2026-11-22" and close(v2["v"][100], vnd["v"][100], 1e-5),
           (v2["to"], v2["v"][100], vnd["v"][100]))
        ok("…and the new days are right (25000 + day number) × tether", close(v2["v"][jn], (25000.0 + jn) / (1.002 if jn % 2 else 0.998), 1e-5), v2["v"][jn])
        raw = json.load(open(os.path.join(out, "raw_xapi.json")))
        ok("raw days already in a file are not kept twice", all(d > v2["to"] for d in raw.get("VND", {})), list(raw.get("VND", {}))[:3])
        # a day the ECB (and Frankfurter) cannot be reached: EUR keeps its ECB file, never switched to another source
        eur_before = open(os.path.join(out, "EUR.json")).read()

        def no_ecb(url, timeout=40, tries=3):
            if url == F.ECB_ZIP or "frankfurter" in url:
                raise OSError("unreachable")
            return fake_get(url, timeout, tries)
        FAKE_TODAY[0] = TODAY + dt.timedelta(30)
        F.run(out=out, get=no_ecb, today=TODAY + dt.timedelta(30), budget=600, threads=8, log=logs.append)
        L3 = json.load(open(os.path.join(out, "latest.json")))
        ok("ECB unreachable: the euro keeps its ECB history file and latest.json still has it (from the file)",
           open(os.path.join(out, "EUR.json")).read() == eur_before and L3["r"]["EUR"][0] == "ecb", L3["r"].get("EUR", [None])[:3])
    finally:
        shutil.rmtree(out, ignore_errors=True)
    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nOK")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
