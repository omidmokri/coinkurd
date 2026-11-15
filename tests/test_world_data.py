#!/usr/bin/env python3
"""/world/ — the facts table, the CI step (scripts/world_data.py) with its sources faked in their real formats, and the
counters' arithmetic in Python and in assets/world/math.js (run by node) on the same inputs.

Known answers: Bitcoin's supply after the first 210 000 blocks is exactly 10 500 000 BTC; after 840 000 blocks (the
fourth halving) 19 687 500 BTC; the subsidy cap is 2 099 999 997 690 000 sat; a yearly total is half spent at the
middle of a (non-leap) year; a day is 1/365 of it; the debt pace is (v1 − v0) / seconds between their dates.
Run: python3 tests/test_world_data.py
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import world_data as W  # noqa: E402

FAIL = []


def check(name, cond, extra=""):
    print(("  ok   " if cond else "  FAIL ") + name + ("" if cond else f"  [{extra}]"))
    if not cond:
        FAIL.append(name)


# ---------------------------------------------------------------- the facts table
check("facts table is complete (publisher, address, year, numbers)", not W.check_facts(), W.check_facts())
broken = [dict(W.FACTS[0], src={"pub": "x", "t": "y", "url": "http://insecure", "d": "2026"}), dict(W.FACTS[1], per_year="1")]
check("the check catches a bad address and a non-number", len(W.check_facts(broken)) == 2, W.check_facts(broken))
by = {f["k"]: f for f in W.FACTS}
check("population growth = births − deaths (UN WPP 2024, 2026)", by["growth"]["per_year"] == by["births"]["per_year"] - by["deaths"]["per_year"] == 68866155)
check("energy: 600.3 EJ in MWh", abs(by["energy"]["per_year"] - 1.6675e11) < 1e7, by["energy"]["per_year"])

# ---------------------------------------------------------------- Bitcoin issuance
check("subsidy 50 / 25 / 3.125 BTC", (W.subsidy_sat(0), W.subsidy_sat(210000), W.subsidy_sat(840000)) == (5e9, 2.5e9, 312500000))
check("supply after block 209 999 = 10.5 M BTC", W.supply_sat(209999) == 10_500_000 * W.COIN)
check("supply after block 839 999 = 19.6875 M BTC", W.supply_sat(839999) == 19_687_500 * W.COIN)
check("cap = 2 099 999 997 690 000 sat", W.issued_sat(0, 64 * 210000 - 1) == 2099999997690000)
check("a day of 144 blocks in this epoch = 450 BTC", W.issued_sat(900000, 900143) == 450 * W.COIN)
check("issuance across a halving", W.issued_sat(839999, 840000) == 625000000 + 312500000)
check("empty range", W.issued_sat(10, 9) == 0)
check("next halving after 975 965 is 1 050 000", W.next_halving(975965) == 1050000 and W.next_halving(1050000) == 1260000)

# ---------------------------------------------------------------- flows and stocks
ny, nd = W.flow_values(365e6, datetime(2025, 7, 2, 12, 0))      # 2025: 365 days; 2 July 12:00 = 182.5 days in
check("flow: half a year at the middle of 2025", abs(ny - 182.5e6) < 1, ny)
check("flow: half a day at noon = 0.5 M", abs(nd - 0.5e6) < 1e-6, nd)
ny, nd = W.flow_values(366e6, datetime(2024, 1, 1, 0, 0))
check("flow: zero at the first instant of the year", ny == 0 and nd == 0)
pop = W.stock_value(by["pop"], datetime(2026, 7, 1, tzinfo=timezone.utc))
check("population at its epoch = the UN figure", pop == 8300678396)

# ---------------------------------------------------------------- the CI step, sources faked in their real formats
NOW = datetime(2026, 11, 15, 13, 30, tzinfo=timezone.utc)
DAY0 = int(datetime(2026, 11, 15, tzinfo=timezone.utc).timestamp())
YEAR0 = int(datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp())
TREAS_ROWS = [{"record_date": "2026-11-12", "tot_pub_debt_out_amt": "39000000000000.00"},
              {"record_date": "2026-08-13", "tot_pub_debt_out_amt": "38500000000000.00"},       # 91 days before
              {"record_date": "2026-08-12", "tot_pub_debt_out_amt": "38490000000000.00"},
              {"record_date": "2026-11-11", "tot_pub_debt_out_amt": "38990000000000.00"},
              {"record_date": "bad", "tot_pub_debt_out_amt": "x"}]
calls = []


def fake(up=True, tip=976010):
    def get(url, tries=3, timeout=30):
        calls.append(url)
        if not up:
            return None
        if url.endswith("/blocks/tip/height"):
            return tip
        if "/v1/mining/blocks/timestamp/" in url:
            ts = int(url.rsplit("/", 1)[1])
            if ts == DAY0:          # the closest block is 40 s BEFORE midnight -> the day starts at the next one
                return {"height": 975930, "hash": "00…", "timestamp": "2026-11-14T23:59:20.000Z"}
            if ts == YEAR0:         # the closest block is AFTER the new year -> it is the first of the year
                return {"height": 928800, "hash": "00…", "timestamp": "2026-01-01T00:03:11.000Z"}
            return {"height": 976100, "hash": "00…", "timestamp": datetime.fromtimestamp(ts + 60, timezone.utc).isoformat().replace("+00:00", "Z")}
        if url.startswith("https://api.fiscaldata.treasury.gov/"):
            return {"data": TREAS_ROWS, "meta": {"count": 5}}
        return None
    return get


MMS = {"t": "2026-11-15T13:26:09+00:00", "g": {"mcap": 2212316925175.24, "btc_d": 59.44, "mcap_chg24": -5.85},
       "c": [{"s": "ETH", "p": 2000}, {"s": "BTC", "p": 65643.0}]}
out = W.build(None, NOW, get=fake(), mm=MMS, btcinfo=None)
b = out["btc"]
check("tip from mempool.space", b["tip"] == 976010 and b["tip_t"] == int(NOW.timestamp()), b)
check("first block of the UTC day (closest block before midnight -> next one)", b["day0"] == {"d": "2026-11-15", "h": 975931}, b.get("day0"))
check("first block of the UTC year (closest block after -> itself)", b["year0"] == {"y": 2026, "h": 928800}, b.get("year0"))
check("price and market totals from mm.json", b["p"] == 65643.0 and out["crypto"]["mcap"] == 2212316925175.24 and out["crypto"]["btc_d"] == 59.44)
u = out["usdebt"]
check("debt: last official figure and its date", u["d"] == "2026-11-12" and u["v"] == 39e12, u)
check("debt: pace over the 91 days before it", u["d0"] == "2026-08-13" and abs(u["rate"] - (0.5e12 / (91 * 86400))) < 1e-6, u)
check("no errors with every source up", out["errors"] == {}, out["errors"])
n = len(calls)
out2 = W.build(out, NOW.replace(minute=45), get=fake(tip=976012), mm=MMS)
asked = calls[n:]
check("second run the same day: only the tip is asked again", len(asked) == 1 and asked[0].endswith("/tip/height"), asked)
check("…and the tip moves on", out2["btc"]["tip"] == 976012)
out3 = W.build(out2, NOW.replace(minute=50), get=fake(up=False), mm=None,
               btcinfo={"blocks": [{"height": 976011, "timestamp": 1794750000}]})
check("mempool down: an OLDER tip from btcinfo.json does not move the tip back", out3["btc"]["tip"] == 976012, out3["btc"])
check("mempool down: day/year marks and debt are kept", out3["btc"]["day0"]["h"] == 975931 and out3["usdebt"]["v"] == 39e12)
out4 = W.build(None, NOW, get=fake(up=False), mm=None, btcinfo={"blocks": [{"height": 976011, "timestamp": 1794750000}]})
check("first run, mempool down: tip from btcinfo.json, no invented marks", out4["btc"]["tip"] == 976011 and "day0" not in out4["btc"] and "usdebt" not in out4,
      out4)
check("…and the errors say so", set(out4["errors"]) >= {"day0", "year0", "usdebt"}, out4["errors"])
nxt = W.build(out, datetime(2026, 11, 16, 0, 5, tzinfo=timezone.utc), get=fake(), mm=MMS)
check("a new UTC day asks for the new day's first block", nxt["btc"]["day0"] == {"d": "2026-11-16", "h": 976100}, nxt["btc"].get("day0"))
stale = W.build(out, datetime(2026, 11, 16, 0, 5, tzinfo=timezone.utc), get=fake(up=False), mm=None)
check("…and when it cannot be asked, the old day stays labelled with its own date (the page then shows nothing for today)",
      stale["btc"]["day0"]["d"] == "2026-11-15" and "day0" in stale["errors"])
check("debt summary refuses too short a history", W.debt_summary(TREAS_ROWS[:1]) is None and W.debt_summary([]) is None)

# ---------------------------------------------------------------- the same arithmetic in assets/world/math.js
js = r"""
const M = require(process.argv[1]);
const out = {
  s209999: M.supplySat(209999), s839999: M.supplySat(839999), cap: M.CAP_SAT, day: M.issuedSat(900000, 900143),
  cross: M.issuedSat(839999, 840000), nh: M.nextHalving(975965), sub: [M.subsidySat(0), M.subsidySat(840000), M.subsidySat(1050000)],
  flow: M.flow(365e6, new Date(2025, 6, 2, 12, 0)), flow0: M.flow(366e6, new Date(2024, 0, 1)),
  pop: M.stock(8300678396, '2026-07-01T00:00:00Z', 68866155, new Date('2027-07-01T05:49:12Z')),
  debt: M.debt({d: '2026-11-12', v: 39e12, rate: 100}, new Date('2026-11-12T21:00:10Z')),
  debtBad: M.debt({d: '2026-11-12', v: 0, rate: 1}, new Date())
};
console.log(JSON.stringify(out));
"""
r = subprocess.run(["node", "-e", js, os.path.join(ROOT, "assets", "world", "math.js")], capture_output=True, text=True, env=dict(os.environ, TZ="UTC"))
check("node runs math.js", r.returncode == 0, r.stderr[:300])
if r.returncode == 0:
    j = json.loads(r.stdout)
    check("JS = Python: supplies, cap, a day, a halving crossing", (j["s209999"], j["s839999"], j["cap"], j["day"], j["cross"]) ==
          (W.supply_sat(209999), W.supply_sat(839999), W.issued_sat(0, 64 * 210000 - 1), W.issued_sat(900000, 900143), W.issued_sat(839999, 840000)), j)
    check("JS = Python: subsidies and next halving", j["sub"] == [W.subsidy_sat(0), W.subsidy_sat(840000), W.subsidy_sat(1050000)] and j["nh"] == 1050000, j)
    py = W.flow_values(365e6, datetime(2025, 7, 2, 12, 0))
    check("JS = Python: a flow at mid-year", abs(j["flow"][0] - py[0]) < 1e-3 and abs(j["flow"][1] - py[1]) < 1e-6, (j["flow"], py))
    check("JS: a flow is zero at the year's first instant", j["flow0"] == [0, 0], j["flow0"])
    pyp = W.stock_value(by["pop"], datetime(2027, 7, 1, 5, 49, 12, tzinfo=timezone.utc))
    check("JS = Python: population one mean year later (+68 866 155)", abs(j["pop"] - pyp) < 1e-3 and abs(j["pop"] - (8300678396 + 68866155)) < 1, (j["pop"], pyp))
    check("JS: debt runs on from the last figure at its pace", j["debt"] == 39e12 + 1000 and j["debtBad"] is None, j)

print(f"\ntest_world_data: {len(FAIL)} failures")
sys.exit(1 if FAIL else 0)
