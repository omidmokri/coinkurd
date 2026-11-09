#!/usr/bin/env python3
"""Daily market context for the in-browser strategy lab (/strategy-lab/): series a rule can test that the
browser cannot fetch itself (the site's CSP only lets it reach Binance spot data).

    fng      Fear & Greed index, daily, full history (alternative.me)
    hmm      BTC regime from the hidden-Markov radar, out-of-sample history (data/regime.json) — label index
    rule     BTC regime from the rule-based layer with hysteresis (data/regime.json "rule") — label index
    fund     mean OKX perpetual funding per day, % per 8 h, BTC and ETH (data/silent_exit_store.json; ~1 year)

Output: data/lab_context.json  {"from": first date, "fng": [...], "hmm": [...], "rule": [...], "fund": {"BTC": [...]}}
Every series is a list aligned to consecutive days from "from"; a day without data is null.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reality_common as R  # noqa: E402

START = "2018-02-01"


def days(a, b):
    d0 = datetime.strptime(a, "%Y-%m-%d")
    n = (datetime.strptime(b, "%Y-%m-%d") - d0).days
    return [(d0 + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(n + 1)]


def main():
    prev = R.load("lab_context.json", {})
    fng = {}
    try:
        j = R.http_json("https://api.alternative.me/fng/", {"limit": 0, "format": "json"})
        for x in j.get("data") or []:
            fng[R.day(R.from_ms(int(x["timestamp"]) * 1000))] = int(x["value"])
    except Exception as ex:  # noqa: BLE001
        print("lab_context: fng failed:", ex)
        if prev.get("fng"):                     # keep yesterday's copy rather than lose the series
            for d, v in zip(days(prev["from"], prev["to"]), prev["fng"]):
                if v is not None:
                    fng[d] = v
    reg = R.load("regime.json", {})
    hmm = reg.get("daily") or {}
    rule = ((reg.get("rule") or {}).get("daily")) or {}
    st = (R.load("silent_exit_store.json", {}).get("daily")) or {}
    fund = {c: {d: v["f"] for d, v in st.get(c, {}).items() if v.get("f") is not None} for c in ("BTC", "ETH")}
    end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ds = days(START, end)
    out = {"version": 1, "updated_at": R.iso(datetime.now(timezone.utc)), "from": START, "to": end,
           "labels": ["bull", "bear", "sideways", "high_vol"],
           "fng": [fng.get(d) for d in ds], "hmm": [hmm.get(d) for d in ds], "rule": [rule.get(d) for d in ds],
           "fund": {c: [None if fund[c].get(d) is None else round(fund[c][d], 5) for d in ds] for c in fund}}
    R.save("lab_context.json", out)
    cnt = lambda a: sum(1 for x in a if x is not None)  # noqa: E731
    print(f"lab_context: {len(ds)} days; fng {cnt(out['fng'])}, hmm {cnt(out['hmm'])}, rule {cnt(out['rule'])}, "
          f"fund BTC {cnt(out['fund']['BTC'])} ETH {cnt(out['fund']['ETH'])}")


if __name__ == "__main__":
    main()
