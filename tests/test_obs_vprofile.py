#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""obs_vprofile.py — the volume profile's arithmetic, checked against candles whose answer can be worked out by hand.
Run: python3 tests/test_obs_vprofile.py"""
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import obs_vprofile as V  # noqa: E402

FAILS = []


def ok(what, cond, got=None):
    print(("PASS " if cond else "FAIL ") + what + ("" if cond else "  -> " + repr(got)))
    if not cond:
        FAILS.append(what)


# ---------------------------------------------------------------- spreading a candle over the bins
# one candle, range 100..200, $1000 of which $600 was the aggressive buyer, over 10 bins of 10 each
buy, sell = V.spread([(0, 200.0, 100.0, 1000.0, 600.0)], 100.0, 200.0, 10)
ok("a candle's dollars are shared evenly across the bins its range covers",
   all(abs(b - 60.0) < 1e-9 for b in buy) and all(abs(s - 40.0) < 1e-9 for s in sell), (buy, sell))
ok("buying and selling add up to the candle's dollars", abs(sum(buy) + sum(sell) - 1000.0) < 1e-9, sum(buy) + sum(sell))

# a candle that does not move sits in a single bin
buy, sell = V.spread([(0, 150.0, 150.0, 500.0, 500.0)], 100.0, 200.0, 10)
ok("a candle that did not move puts its dollars in one bin", sum(1 for b in buy if b > 0) == 1 and abs(sum(buy) - 500.0) < 1e-9,
   buy)
ok("a candle with no selling records none", sum(sell) == 0, sell)

# a candle reaching past the edges is clipped, and still contributes everything inside
buy, sell = V.spread([(0, 500.0, 0.0, 800.0, 400.0)], 100.0, 200.0, 10)
ok("a candle wider than the profile is clipped to it, keeping its dollars", abs(sum(buy) + sum(sell) - 800.0) < 1e-9,
   sum(buy) + sum(sell))

# ---------------------------------------------------------------- the value area
tot = [1.0, 1.0, 1.0, 10.0, 1.0, 1.0, 1.0]        # 16 in all; 70 % is 11.2
lo, hi = V.value_area(tot, 3)
ok("the value area grows from the point of control to the heavier neighbour until it holds 70 %",
   lo <= 3 <= hi and sum(tot[lo:hi + 1]) >= sum(tot) * V.VALUE_AREA, (lo, hi, sum(tot[lo:hi + 1])))
ok("the value area is no wider than it needs to be", sum(tot[lo + 1:hi + 1]) < sum(tot) * V.VALUE_AREA or lo == 0,
   (lo, hi))
flat = [2.0] * 5
lo, hi = V.value_area(flat, 2)
ok("a flat profile still yields a value area holding 70 %", sum(flat[lo:hi + 1]) >= sum(flat) * V.VALUE_AREA, (lo, hi))
ok("an empty profile has no value area to grow", V.value_area([0.0, 0.0, 0.0], 1) == (1, 1), V.value_area([0.0] * 3, 1))

# ---------------------------------------------------------------- a whole profile
cands = [(i * 3600000, 110.0, 100.0, 100.0, 50.0) for i in range(5)]
cands.append((5 * 3600000, 105.0, 104.0, 9000.0, 9000.0))      # where the business was really done
p = V.profile(cands)
ok("a profile spans the lowest low to the highest high", p["lo"] == 100.0 and p["hi"] == 110.0, (p["lo"], p["hi"]))
ok("the point of control falls where the dollars were", p["lo"] + p["poc"] * p["step"] >= 103.9, p["poc"])
ok("the profile's dollars equal the candles' dollars", abs(p["total"] - 9500.0) < 1.0, p["total"])
ok("the value area contains the point of control", p["val"] <= p["poc"] <= p["vah"], (p["val"], p["poc"], p["vah"]))
ok("buy and sell columns are as long as the profile", len(p["buy"]) == p["n"] == len(p["sell"]) == V.BINS, p["n"])
ok("no candles means no profile", V.profile([]) is None)
ok("candles with no dollars make no profile", V.profile([(0, 110.0, 100.0, 0.0, 0.0)]) is None)

# ---------------------------------------------------------------- reading the source
def fake_rows(symbol, start_ms, limit, step_ms):
    rows = []
    for i in range(limit):
        t = start_ms + i * step_ms
        # [open time, open, high, low, close, base vol, close time, QUOTE vol, trades, taker-buy base, TAKER-BUY QUOTE, ignore]
        rows.append([t, "100", "110", "90", "105", "10", t + step_ms - 1, "1000", 50, "6", "600", "0"])
    return rows


calls = []


def fake_get(url, params):
    calls.append(params)
    if "klines" not in url:
        return None
    return fake_rows(params["symbol"], params["startTime"], V.PAGE, 3600000)


end = 1795334400
got = V.fetch(fake_get, "BTCUSDT", "1h", end - 7 * 86400, end)
ok("only candles that opened before the end are kept", all(t < end * 1000 for t, *_ in got), len(got))
ok("a week of hourly candles is 168 of them", len(got) == 168, len(got))
ok("the walk stops instead of asking forever", len(calls) <= 60, len(calls))
ok("each candle carries its high, low, dollars and buy dollars", got[0][1] == 110.0 and got[0][2] == 90.0
   and got[0][3] == 1000.0 and got[0][4] == 600.0, got[0])

# a row claiming more buying than trading is not trusted beyond the total
bad = V.fetch(lambda u, p: [[p["startTime"], "1", "2", "1", "1", "1", 0, "100", 1, "999", "1", "0"]], "X", "1h", end - 3600, end)
ok("buying is never recorded above the dollars traded", bad and bad[0][4] <= bad[0][3], bad)

# a malformed answer yields nothing rather than a broken profile
ok("a source that answers with rubbish yields no candles", V.fetch(lambda u, p: {"err": 1}, "X", "1h", end - 3600, end) == [])

# ---------------------------------------------------------------- freshness
now = datetime(2026, 11, 22, 12, 0, tzinfo=timezone.utc)
ok("with no file at all, the source is asked", V.due(None, now) is True)
ok("a file written minutes ago is left alone",
   V.due({"updated_at": (now - timedelta(minutes=20)).isoformat()}, now) is False)
ok("a file older than the gap is refreshed",
   V.due({"updated_at": (now - timedelta(hours=V.FRESH_H, minutes=1)).isoformat()}, now) is True)
ok("force overrides the gap", V.due({"updated_at": now.isoformat()}, now, force=True) is True)

# ---------------------------------------------------------------- a whole run writes a file that reads back
with tempfile.TemporaryDirectory() as tmp:
    V.OUT = os.path.join(tmp, "vprofile.json")
    msgs = []
    r = V.run(fake_get, now, force=True, log=msgs.append)
    ok("a run with a working source writes the file", r == "written" and os.path.exists(V.OUT), (r, msgs))
    import json
    doc = json.load(open(V.OUT, encoding="utf-8"))
    ok("every asset that answered is in the file", set(doc["assets"]) == {k for k, _s, _n in V.ASSETS}, list(doc["assets"]))
    ok("the order names the assets in the file", all(k in doc["assets"] for k in doc["order"]), doc["order"])
    one = doc["assets"]["btc"]["ranges"]
    ok("every range asked for is present", set(one) == {str(d) for d, _i in V.RANGES}, sorted(one))
    ok("the source is named in the file", "Binance" in doc["source"], doc["source"])

    # a source that answers nothing must not wipe the file that is already there
    r2 = V.run(lambda u, p: None, now, force=True, log=msgs.append)
    ok("a silent source leaves the old file alone", r2 == "empty" and json.load(open(V.OUT, encoding="utf-8")) == doc, r2)

print(("\n%d failure(s)" % len(FAILS)) if FAILS else "\nvolume profile: 0 failures")
raise SystemExit(1 if FAILS else 0)
