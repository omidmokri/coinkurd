#!/usr/bin/env python3
"""scripts/obs_chain.py — the on-chain data step of the Observatory — offline.

  * Coin Metrics' answer in its real shape (numbers as strings, "-status" companions, nulls before a measure begins,
    a day missing in the middle) becomes the right columns, offsets and dates; nothing is filled in;
  * numbers keep 6 significant digits, counts stay integers;
  * the summary on series with known answers (flat market, a planted high, flows that lag a day);
  * the Python summary (the bot reads it) equals OBChain.summary() of assets/obs/chainmath.js (the pages use it) on the
    same file, figure by figure;
  * main(): writes the three files, skips when fresh, keeps the previous file when the answer is broken or shorter,
    drops a measure that left the free tier instead of failing, survives an unreadable catalogue.
Run: python3 tests/test_obs_chain.py"""
import json
import math
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import obs_chain as O  # noqa: E402

FAIL, N = [], [0]


def check(name, cond, extra=""):
    N[0] += 1
    if not cond:
        FAIL.append(name)
        print("  FAIL", name, f"[{extra}]" if extra != "" else "")


def near(a, b, rel=1e-9):
    return a is not None and b is not None and abs(a - b) <= rel * max(1.0, abs(b))


def day(i, start="2015-01-01"):
    return (datetime.strptime(start, "%Y-%m-%d") + timedelta(days=i)).strftime("%Y-%m-%d")


def cm_rows(n, asset="btc", start="2015-01-01", missing=(), price_from=30, flow_from=60, flash=3):
    """Coin Metrics' /timeseries/asset-metrics rows: every value a string, null before a measure begins"""
    rows, reserve = [], 50000.0
    for i in range(n):
        if i in missing:
            continue
        p = 100 * math.exp(0.0015 * i) * (1 + 0.2 * math.sin(i / 37))
        fin, fout = 100 + 10 * math.sin(i / 5), 100 + 10 * math.cos(i / 7)
        reserve += fin - fout
        r = {"asset": asset, "time": day(i, start) + "T00:00:00.000000000Z",
             "AdrActCnt": str(1000 + i), "TxCnt": str(2000 + 2 * i), "TxTfrCnt": str(3000 + 3 * i),
             "SplyCur": f"{1e6 + 50 * i:.8f}", "IssTotNtv": "50", "FeeTotNtv": f"{1 + 0.5 * math.sin(i / 11):.8f}",
             "HashRate": f"{1e6 * (1 + i / 100):.12f}",
             "PriceUSD": None if i < price_from else f"{p:.10f}", "CapMVRVCur": None if i < price_from else f"{1.5 + 0.8 * math.sin(i / 90):.18f}",
             "FlowInExNtv": None if i < flow_from else f"{fin:.8f}", "FlowOutExNtv": None if i < flow_from else f"{fout:.8f}",
             "SplyExNtv": None if i < flow_from else f"{reserve:.8f}"}
        if i >= n - flash and i >= flow_from:
            for k in ("FlowInExNtv", "FlowOutExNtv", "SplyExNtv"):
                r[k + "-status"] = "flash"
                r[k + "-status-time"] = day(i + 1, start) + "T01:53:13.682423000Z"
        if asset == "eth":
            r.pop("HashRate")
        rows.append(r)
    return rows


NOW = datetime(2020, 6, 30, 12, 0, tzinfo=timezone.utc)

# ---------------------------------------------------------------- numbers
check("sig keeps 6 significant digits", O.sig(71280.4238) == 71280.4 and O.sig(1.3241043) == 1.3241 and O.sig(0.000123456789) == 0.000123457)
check("sig gives an integer when the value is one", O.sig(20111180.4) == 20111200 and isinstance(O.sig(20111180.4), int) and O.sig(0) == 0)
check("num parses strings, refuses junk", O.num("818651895.199") == 818652000 and O.num("676220", True) == 676220 and O.num(None) is None and O.num("") is None
      and O.num("abc") is None and O.num("nan") is None and O.num("inf") is None)
check("counts round to the nearest whole", O.num("12.6", True) == 13 and isinstance(O.num("5", True), int))

# ---------------------------------------------------------------- columns from the real shape
rows = cm_rows(2000, missing={700})
t0, n, cols = O.columns("btc", rows)
check("first day and length", t0 == "2015-01-01" and n == 2000, (t0, n))
check("every measure became a column", sorted(cols) == sorted(k for k, _ in O.WANT), sorted(cols))
check("nulls before a measure begins stay null", cols["price"][29] is None and cols["price"][30] is not None and cols["fin"][59] is None and cols["fin"][60] is not None)
check("a day missing in the answer stays empty in every column", all(cols[k][700] is None for k in cols) and cols["price"][699] is not None and cols["price"][701] is not None)
check("counts are integers, prices floats", cols["adr"][5] == 1005 and isinstance(cols["adr"][5], int) and cols["tfr"][10] == 3030 and isinstance(cols["price"][100], float))
check("values match the answer to 6 digits", near(cols["price"][1999], float(rows[-1]["PriceUSD"]), 1e-5) and near(cols["mvrv"][1500], 1.5 + 0.8 * math.sin(1500 / 90), 1e-5))
check("status companions are not columns", not any("status" in k for k in cols))
t0e, ne, colse = O.columns("eth", cm_rows(500, asset="eth"))
check("Ether has no hash-rate column", "hash" not in colse and "price" in colse and ne == 500)
check("no rows, nothing", O.columns("btc", []) == (None, 0, {}))
check("rows out of order are put in order", O.columns("btc", list(reversed(rows)))[2]["price"] == cols["price"])

doc = O.pack("btc", t0, n, cols, NOW)
check("a column starts at its first value", doc["cols"]["price"]["o"] == 30 and doc["cols"]["fin"]["o"] == 60 and doc["cols"]["adr"]["o"] == 0
      and len(doc["cols"]["price"]["v"]) == 1970)
check("the file names its source and licence", "Coin Metrics" in doc["source"] and "CC BY-NC" in doc["source"] and doc["asset"] == "btc" and doc["n"] == 2000)
t0b, nb, colsb = O.unpack(json.loads(json.dumps(doc)))
check("unpack(pack) gives the columns back", (t0b, nb) == (t0, n) and colsb == cols)

# ---------------------------------------------------------------- the summary on known series
def flat(n, **over):
    c = {"price": [100.0] * n, "mvrv": [2.0] * n, "sply": [1e6] * n, "iss": [50.0] * n, "fee": [5.0] * n, "fin": [10.0] * n, "fout": [7.0] * n,
         "sex": [1000.0 + 3 * i for i in range(n)], "hash": [5e8] * n, "adr": [100 + i for i in range(n)], "tx": [40] * n}
    c.update(over)
    return c


s = O.summary("2015-01-01", 1500, flat(1500))
check("flat: realized price, NUPL, values", s["rprice"] == 50 and s["nupl"] == 0.5 and s["mcap"] == 1e8 and s["rcap"] == 5e7 and s["date"] == day(1499))
check("flat: every price ratio is 1, Pi 0.5, Puell 1, drawdown 0", s["mayer"] == 1 and s["w200"] == 1 and s["y2"] == 1 and s["pi"] == 0.5 and s["puell"] == 1 and s["dd"] == 0)
check("flat: no Z-score when the market value never moved", "mvrvz" not in s)
check("flat: flows", s["net1"] == 3 and s["net7"] == 21 and s["net30"] == 90 and s["sex_chg30"] == 90 and s["sex"] == 1000 + 3 * 1499 and near(s["sex_share"], s["sex"] / 1e4))
check("flat: hash in EH/s, fee share, stock-to-flow", s["hash"] == 500 and s["hash30"] == 500 and s["hash60"] == 500 and near(s["fee_share"], 500 / 55) and near(s["s2f"], 1e6 / (50 * 365)))
n2 = 400
p2 = [100.0] * 100 + [400.0] * 100 + [100.0] * 200
s = O.summary("2015-01-01", n2, {"price": p2, "mvrv": [0.8] * n2})
check("a planted high: drawdown −75 %, NUPL below zero", s["dd"] == -75 and near(s["nupl"], -0.25) and near(s["rprice"], 125) and near(s["dd_pct"], 50))
c3 = flat(80)
for k in ("fin", "fout", "sex"):
    c3[k][-1] = None
s = O.summary("2015-01-01", 80, c3)
check("flows a day behind: their own date", s["flow_date"] == day(78) and s["date"] == day(79) and s["net7"] == 21)
check("short history: no long averages, no invented figures", "ma1400" not in s and "w200" not in s and "puell" not in s and "ma200" not in s)
check("an empty file gives an empty summary", O.summary("2015-01-01", 3, {}) == {})

# ---------------------------------------------------------------- Python summary == JavaScript summary
tmp = tempfile.mkdtemp()
for label, rs in (("btc", cm_rows(2000, missing={700})), ("btc-lag", cm_rows(1700, flash=2)), ("eth", cm_rows(900, asset="eth", start="2015-08-08"))):
    asset = label.split("-")[0]
    if label == "btc-lag":
        for k in ("FlowInExNtv", "FlowOutExNtv", "SplyExNtv"):
            rs[-1][k] = None
    d = O.build(asset, rs, NOW)
    path = os.path.join(tmp, label + ".json")
    json.dump(d, open(path, "w"), separators=(",", ":"))
    js = json.loads(subprocess.run(["node", os.path.join(ROOT, "tests", "test_obs_chain.js"), "--summary", path], capture_output=True, text=True, check=True).stdout)
    py = d["summary"]
    check(f"{label}: the two summaries have the same figures", sorted(js) == sorted(py), sorted(set(js) ^ set(py)))
    bad = [k for k in py if k in js and (py[k] != js[k] if isinstance(py[k], str) else not near(js[k], py[k]))]
    check(f"{label}: every figure agrees to 9 digits ({len(py)} figures)", not bad, [(k, py[k], js.get(k)) for k in bad][:4])
    check(f"{label}: the summary is complete", all(k in py for k in ("date", "price", "mvrv", "rprice", "nupl", "mvrvz", "dd", "mayer", "sex", "net7", "adr7")), sorted(py))
check("a history without a missing day has every long average", all(k in json.load(open(os.path.join(tmp, "btc-lag.json")))["summary"] for k in ("w200", "puell", "pi", "y2", "hash", "s2f")))
check("one missing day inside the 200-week window: that average is not shown (never patched over)", "w200" not in json.load(open(os.path.join(tmp, "btc.json")))["summary"]
      and "mayer" in json.load(open(os.path.join(tmp, "btc.json")))["summary"])
check("eth: no hash figures", "hash" not in json.load(open(os.path.join(tmp, "eth.json")))["summary"])
check("lag: flows dated a day before the price", (lambda s: s["flow_date"] < s["date"])(json.load(open(os.path.join(tmp, "btc-lag.json")))["summary"]))
# a value against the definition, by hand: Puell on the last day of the first file
d = json.load(open(os.path.join(tmp, "btc.json")))
_, _, cc = O.unpack(d)
i = 1999
iu = [cc["iss"][k] * cc["price"][k] for k in range(i - 364, i + 1)]
check("Puell by its definition", near(d["summary"]["puell"], iu[-1] / (sum(iu) / 365)))
check("Mayer by its definition", near(d["summary"]["mayer"], cc["price"][i] / (sum(cc["price"][i - 199:i + 1]) / 200)))
mc = [cc["price"][k] * cc["sply"][k] for k in range(2000) if cc["price"][k] is not None]
mu = sum(mc) / len(mc)
sd = math.sqrt(sum((x - mu) ** 2 for x in mc) / len(mc))
check("MVRV Z-score by its definition (population sd of every day so far)", near(d["summary"]["mvrvz"], (mc[-1] - mc[-1] / cc["mvrv"][i]) / sd, 1e-7), d["summary"]["mvrvz"])

# ---------------------------------------------------------------- when to fetch
prev = {"updated_at": (NOW - timedelta(minutes=30)).isoformat(), "t0": "2020-01-01", "n": (NOW.date() - datetime(2020, 1, 1).date()).days}       # last row = yesterday
check("fresh file with yesterday's row: wait", not O.due(prev, NOW))
check("the same file after 3 hours: fetch again (revisions)", O.due(dict(prev, updated_at=(NOW - timedelta(hours=3, minutes=1)).isoformat()), NOW))
old = dict(prev, n=prev["n"] - 1)                                                                                                                # last row = the day before
check("yesterday's row missing: ask again after an hour, not before", not O.due(old, NOW) and O.due(dict(old, updated_at=(NOW - timedelta(minutes=61)).isoformat()), NOW))
check("no file or a broken one: fetch", O.due(None, NOW) and O.due({}, NOW) and O.due({"updated_at": "x", "t0": "2020-01-01", "n": 5}, NOW))
stale = dict(prev, updated_at=(NOW - timedelta(days=2)).isoformat())                 # the numbers last changed two days ago…
check("the time of the last look counts, not the file's own", not O.due(stale, NOW, (NOW - timedelta(minutes=10)).isoformat())
      and O.due(stale, NOW, (NOW - timedelta(hours=4)).isoformat()) and O.due(stale, NOW))

# ---------------------------------------------------------------- main() against a fake Coin Metrics
CALLS = []
STATE = {"rows": {"btc": cm_rows(1600), "eth": cm_rows(700, asset="eth")}, "catalog": "ok", "fail": set(), "no_metric": set()}


def fake_get(url, params=None, timeout=90):
    CALLS.append((url, dict(params or {})))
    asset = (params or {}).get("assets")
    if "catalog-v2" in url:
        if STATE["catalog"] != "ok":
            return None
        ms = [m for _, m in O.WANT if m not in STATE["no_metric"]] + ["ReferenceRate"]
        return {"data": [{"asset": asset, "metrics": [{"metric": m, "frequencies": [{"frequency": "1d", "community": True}]} for m in ms]
                          + [{"metric": "CapRealUSD", "frequencies": [{"frequency": "1d", "community": False}]}]}]}
    if asset in STATE["fail"]:
        return None
    want = params["metrics"].split(",")
    if STATE["catalog"] != "ok" and any(m in STATE["no_metric"] for m in want):
        return None                                         # the API refuses the whole request when one measure is not allowed
    return {"data": [{k: v for k, v in r.items() if k in ("asset", "time") or k.split("-")[0] in want} for r in STATE["rows"][asset]]}


O.get = fake_get
O.OUT_DIR = os.path.join(tmp, "out")
os.environ.pop("OBS_CHAIN_FORCE", None)
O.main()
f = lambda name: json.load(open(os.path.join(O.OUT_DIR, name)))  # noqa: E731
check("first run writes the three files", all(os.path.exists(os.path.join(O.OUT_DIR, x)) for x in ("chain_btc.json", "chain_eth.json", "chain_now.json")))
check("the small file carries both summaries", f("chain_now.json")["btc"] == f("chain_btc.json")["summary"] and f("chain_now.json")["eth"]["date"] == day(699) and "source" in f("chain_now.json"))
check("only free-tier measures are asked for, and the catalogue is read first", "catalog-v2" in CALLS[0][0] and "CapRealUSD" not in CALLS[1][1]["metrics"] and "ReferenceRate" not in CALLS[1][1]["metrics"]
      and CALLS[1][1]["frequency"] == "1d" and CALLS[1][1]["page_size"] == 10000)
check("Ether is not asked for a hash rate", "HashRate" not in [c for c in CALLS if c[1].get("assets") == "eth" and "timeseries" in c[0]][0][1]["metrics"])
n_calls = len(CALLS)
before = open(os.path.join(O.OUT_DIR, "chain_btc.json")).read()
O.main()
check("a second run right after asks nothing", len(CALLS) == n_calls)
check("the small file remembers when each asset was last asked", sorted(f("chain_now.json")["checked"]) == ["btc", "eth"])
os.environ["OBS_CHAIN_FORCE"] = "1"
mt = os.path.getmtime(os.path.join(O.OUT_DIR, "chain_btc.json"))
t_now = f("chain_now.json")["updated_at"]
import time as _t
_t.sleep(1.1)
O.main()
check("the same numbers again: the big file is not rewritten, the small one notes the look",
      os.path.getmtime(os.path.join(O.OUT_DIR, "chain_btc.json")) == mt and open(os.path.join(O.OUT_DIR, "chain_btc.json")).read() == before
      and f("chain_now.json")["checked"]["btc"] != t_now)
STATE["fail"] = {"btc"}
O.main()
check("an unreachable source leaves the file as it was", open(os.path.join(O.OUT_DIR, "chain_btc.json")).read() == before)
STATE["fail"] = set()
STATE["rows"]["btc"] = cm_rows(900)
O.main()
check("a shorter answer than the file is refused", f("chain_btc.json")["n"] == 1600)
STATE["rows"]["btc"] = cm_rows(1601)
O.main()
check("a new day is added", f("chain_btc.json")["n"] == 1601 and f("chain_now.json")["btc"]["date"] == day(1600))
STATE["no_metric"] = {"SplyExNtv"}
O.main()
d = f("chain_btc.json")
check("a measure that left the free tier is dropped and named, the rest is written", d.get("dropped") == ["SplyExNtv"] and "sex" not in d["cols"] and "price" in d["cols"] and "sex" not in d["summary"])
STATE["no_metric"] = set()
STATE["catalog"] = "down"
STATE["rows"]["btc"] = cm_rows(1602)
O.main()
check("an unreadable catalogue: everything is asked for as before", f("chain_btc.json")["n"] == 1602 and "sex" in f("chain_btc.json")["cols"])
size = os.path.getsize(os.path.join(O.OUT_DIR, "chain_btc.json"))
check("the file stays compact (under 90 bytes a day: about half a megabyte for Bitcoin before compression)", size / 1602 < 90, size / 1602)

print(f"obs_chain: {N[0] - len(FAIL)} passed, {len(FAIL)} failed")
sys.exit(1 if FAIL else 0)
