#!/usr/bin/env python3
"""scripts/obs_xchain.py and assets/obs/xchainmath.js — the extra on-chain measures — offline.

  * known answers on made-up series: thermocap, average / delta / top price, channel position, capital flow,
    hashprice in dollars and satoshis, Ether's burn and net issuance, the expanding percentile;
  * the temperature ranks a day only among the days before it (changing the future leaves the past alone);
  * the Nakamoto coefficient and HHI of a pool list;
  * the Python summary (the bot reads it) equals OBX.summary() (the pages use it) on every real chain file in
    data/obs/, figure by figure, and on the made-up ones;
  * main() writes both files, and does not rewrite them when nothing changed.
Run: python3 tests/test_obs_xchain.py"""
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import obs_xchain as X  # noqa: E402

FAIL, N = [], [0]


def check(name, cond, extra=""):
    N[0] += 1
    if not cond:
        FAIL.append(name)
        print("  FAIL", name, f"[{extra}]" if extra != "" else "")


def near(a, b, rel=1e-9):
    return a is not None and b is not None and abs(a - b) <= rel * max(1.0, abs(b))


def made_up(n=2000, asset="btc", price_from=10):
    """a chain file in the shape obs_chain.py writes"""
    cols = {"price": [], "mvrv": [], "sply": [], "iss": [], "fee": [], "hash": [], "adr": []}
    for i in range(n):
        p = None if i < price_from else 10 * math.exp(0.002 * i) * (1 + 0.3 * math.sin(i / 60))
        cols["price"].append(p)
        cols["mvrv"].append(None if p is None else 1.6 + 0.9 * math.sin(i / 120))
        cols["sply"].append(1e6 + 900 * i)
        cols["iss"].append(900.0)
        cols["fee"].append(10 + 5 * math.sin(i / 9))
        cols["hash"].append(1e6 * (1 + i / 300))
        cols["adr"].append(5000 + 3 * i + 400 * math.sin(i / 17))
    doc = {"asset": asset, "t0": "2010-01-01", "n": n, "cols": {k: {"o": 0, "v": v} for k, v in cols.items()}}
    o = cols["price"].index(next(x for x in cols["price"] if x is not None))
    for k in ("price", "mvrv"):
        doc["cols"][k] = {"o": o, "v": cols[k][o:]}
    return doc


def js_summary(paths):
    """OBX.summary() of each file, by node"""
    code = ("const CM=require(%r),X=require(%r),fs=require('fs');const out={};for(const p of JSON.parse(process.argv[1])){"
            "const D=CM.unpack(JSON.parse(fs.readFileSync(p,'utf8')));out[p]=X.summary(D);}"
            "process.stdout.write(JSON.stringify(out));") % (os.path.join(ROOT, "assets/obs/chainmath.js"), os.path.join(ROOT, "assets/obs/xchainmath.js"))
    r = subprocess.run(["node", "-e", code, json.dumps(paths)], capture_output=True, text=True, timeout=120)
    if r.returncode:
        print(r.stderr[:2000])
        return {}
    return json.loads(r.stdout)


def compare(name, py, js):
    keys = set(py) | set(js)
    for k in sorted(keys):
        a, b = py.get(k), js.get(k)
        if isinstance(a, dict) or isinstance(b, dict):
            compare(name + "." + k, a or {}, b or {})
        elif isinstance(a, (int, float)) and isinstance(b, (int, float)):
            check(f"{name}.{k} py = js", near(a, b, 1e-9), f"{a} vs {b}")
        else:
            check(f"{name}.{k} py = js", a == b, f"{a!r} vs {b!r}")


# ---------------------------------------------------------------- known answers
doc = made_up()
t0, n, cols = X.OC.unpack(doc)
S = X.xseries("btc", t0, n, cols)
i = n - 1
rev = sum((900 + cols["fee"][k]) * cols["price"][k] for k in range(10, n))
check("thermocap = every day's (iss + fee) × price summed", near(S["thermo"][i], rev, 1e-12), (S["thermo"][i], rev))
mc = [cols["price"][k] * cols["sply"][k] for k in range(10, n)]
avg = sum(mc) / len(mc)
check("average price = mean market value ÷ supply", near(S["avgprice"][i], avg / cols["sply"][i]))
rc = mc[-1] / cols["mvrv"][i]
check("delta price = (realized − average) ÷ supply", near(S["deltaprice"][i], (rc - avg) / cols["sply"][i]))
check("top price = 35 × average ÷ supply", near(S["topprice"][i], 35 * avg / cols["sply"][i]))
dp, tp, p = S["deltaprice"][i], S["topprice"][i], cols["price"][i]
if dp and dp > 0:
    check("channel position", near(S["chpos"][i], (math.log(p) - math.log(dp)) / (math.log(tp) - math.log(dp)) * 100))
rc30 = cols["price"][i - 30] * cols["sply"][i - 30] / cols["mvrv"][i - 30]
check("capital flow over 30 days", near(S["rflow30"][i], rc - rc30, 1e-9))
check("capital flow in per cent", near(S["rpct30"][i], (rc / rc30 - 1) * 100, 1e-9))
check("hashprice in satoshis per TH/s", near(S["hpsat"][i], (900 + cols["fee"][i]) * 1e8 / cols["hash"][i]))
check("hashprice in dollars per PH/s", near(S["hpusd"][i], (900 + cols["fee"][i]) * p / cols["hash"][i] * 1000))
check("no hashprice for another chain", all(v is None for v in X.xseries("ltc", t0, n, cols)["hpusd"]))
check("thermocap starts at the first price", S["thermo"][9] is None and S["thermo"][10] is not None)
er = X._exp_rank([3, 1, 2, None, 2, 5])
check("expanding percentile", er == [100.0, 50.0, 200 / 3, None, 75.0, 100.0], er)
check("percentile of the last day = rank()", all(near(X._exp_rank(cols["adr"])[k], X._rank(cols["adr"], k)) for k in (0, 50, 999, n - 1)))
# the temperature knows no future
doc2 = made_up()
doc2["cols"]["price"]["v"][-200:] = [x * 3 for x in doc2["cols"]["price"]["v"][-200:]]
S2 = X.xseries("btc", *X.OC.unpack(doc2))
k = n - 300
check("a day's temperature does not change with later prices", S["score"][k] is not None and near(S["score"][k], S2["score"][k], 1e-12), (S["score"][k], S2["score"][k]))
check("temperature is 0..100", all(v is None or 0 <= v <= 100 for v in S["score"]))
# Ether
ed = made_up(800, "eth")
ed["t0"] = "2022-01-01"
ed["cols"]["sply"]["v"] = [1.2e8 + 2000 * k - (1500 * k if k > 300 else 0) for k in range(800)]
et0, en, ecol = X.OC.unpack(ed)
E = X.xseries("eth", et0, en, ecol)
j = en - 1
d365 = ecol["sply"][j] - ecol["sply"][j - 365]
check("Ether: burned = issued − net issuance", near(E["burn365"][j], 900 * 365 - d365))
check("Ether: since the Merge", near(E["sincemerge"][j], ecol["sply"][j] - ecol["sply"][X._idx(et0, X.MERGE)]))
check("Ether: net issuance per year", near(E["infl365"][j], d365 / ecol["sply"][j - 365] * 100))
# pools
pl = X.pools({"total": 100, "list": [["B", 30], ["A", 25], ["C", 10]]})
check("Nakamoto coefficient", pl["nakamoto"] == 2, pl)
check("HHI", near(pl["hhi"], 900 + 625 + 100), pl["hhi"])
check("pools not listed", pl["rest"] == 35 and near(pl["rest_share"], 35))
check("bad pool data → None", X.pools(None) is None and X.pools({"total": 0, "list": []}) is None)
odd = X.pools({"total": 100, "list": [["B", 30], ["X", None], None, ["Y", "7"], [None, 5], ["Z", float("nan")], ["A" * 90, 20]]})
check("odd pool rows are dropped, not a crash", odd is not None and [r["blocks"] for r in odd["rows"]] == [30, 20, 5] and len(odd["rows"][1]["name"]) == 40)
check("odd pool totals → None", X.pools({"total": "100", "list": [["A", 1]]}) is None and X.pools({"total": 100, "list": [["A", None]]}) is None and X.pools({"total": 1, "list": "x"}) is None)
# the same rows through OBX in node: the browser keeps the same rows and does not throw on a malformed rotation file
_js = subprocess.run(["node", "-e", """
var X = require('./assets/obs/xchainmath.js');
var p = X.pools({ total: 100, list: [['B', 30], ['X', null], null, ['Y', '7'], [null, 5], ['A'.repeat(90), 20]] });
var r = [X.rotation({ t: [1, 2], assets: ['btc', 'eth', '__proto__'], rcap: { btc: [1, 2] }, mcap: { btc: [1, 2] } }),
         X.rotation({ t: [1, 2], assets: ['btc', 'eth'], rcap: { btc: [1, 2], eth: [1] }, mcap: { btc: [1, 2], eth: [1, 2] } }), X.rotation({ t: 'x' })];
var ok = X.rotation({ t: [1, 2], assets: ['btc', 'eth', 'evil'], rcap: { btc: [1, 3], eth: [1, 1], evil: [5, 5] }, mcap: { btc: [1, 1], eth: [1, 1], evil: [5, 5] } });
console.log(JSON.stringify({ blocks: p.rows.map(function (x) { return x.blocks; }), name: p.rows[1].name.length, bad: r, ok: ok.assets, sh: ok.rshare.btc }));
"""], capture_output=True, text=True, timeout=60, cwd=ROOT)
try:
    _o = json.loads(_js.stdout)
except Exception:
    _o = {}
check("OBX drops odd pool rows like the script", _o.get("blocks") == [30, 20, 5] and _o.get("name") == 40, _js.stderr[-300:])
check("OBX.rotation: malformed files give null, unknown chains are ignored", _o.get("bad") == [None, None, None] and _o.get("ok") == ["btc", "eth"] and _o.get("sh") == [50, 75])

# ---------------------------------------------------------------- Python = JavaScript
tmp = tempfile.mkdtemp()
try:
    paths = []
    for nm, d in (("made_btc", doc), ("made_eth", ed)):
        p = os.path.join(tmp, nm + ".json")
        json.dump(d, open(p, "w"))
        paths.append(p)
    real = sorted(os.path.join(ROOT, "data", "obs", f) for f in os.listdir(os.path.join(ROOT, "data", "obs")) if f.startswith("chain_") and f != "chain_now.json")
    js = js_summary(paths + real)
    check("node ran", len(js) == len(paths) + len(real), len(js))
    for p in paths + real:
        d = json.load(open(p))
        a = d.get("asset") or ("eth" if "eth" in p else "btc")
        compare(os.path.basename(p), X.summary(a, *X.OC.unpack(d)), js.get(p, {}))
    # main(): write, then nothing to rewrite
    root2 = os.path.join(tmp, "site")
    os.makedirs(os.path.join(root2, "data", "obs"))
    for p in real:
        shutil.copy(p, os.path.join(root2, "data", "obs"))
    for f in ("btcinfo.json", "chain.json"):
        if os.path.exists(os.path.join(ROOT, "data", f)):
            shutil.copy(os.path.join(ROOT, "data", f), os.path.join(root2, "data"))
    old_root, old_obs = X.ROOT, X.OBS
    X.ROOT, X.OBS = root2, os.path.join(root2, "data", "obs")
    try:
        check("main() ok", X.main() == 0)
        now = json.load(open(os.path.join(X.OBS, "xchain_now.json")))
        check("now file has bitcoin's temperature", 0 <= now["btc"]["score"] <= 100)
        check("now file has pools", now.get("pools", {}).get("nakamoto") is not None)
        rot = json.load(open(os.path.join(X.OBS, "xchain_rot.json")))
        check("rotation: one row per week, every chain", all(len(rot["rcap"][a]) == len(rot["t"]) for a in rot["assets"]) and len(rot["t"]) > 50)
        check("rotation weeks 7 days apart", all(b - a == 7 * 86400000 for a, b in zip(rot["t"], rot["t"][1:])))
        m1 = os.path.getmtime(os.path.join(X.OBS, "xchain_rot.json"))
        X.main()
        check("unchanged numbers are not rewritten", os.path.getmtime(os.path.join(X.OBS, "xchain_rot.json")) == m1)
    finally:
        X.ROOT, X.OBS = old_root, old_obs
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"{N[0] - len(FAIL)}/{N[0]} passed")
sys.exit(1 if FAIL else 0)
