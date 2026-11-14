#!/usr/bin/env python3
"""The Observatory's two CI data steps, against pretend exchanges that answer in the real formats:
  scripts/obs_stables.py   DefiLlama's stablecoin charts and list + Bitcoin's market value → stables.json, stables_now.json
  scripts/obs_premium.py   Coinbase and Binance candles → premium.json, premium_d.json
Every expected figure is worked out by hand in the comments. The last block reads the written files with the page's own
arithmetic (assets/obs/flowmath.js, in Node) and checks that the lines end on the figures of the summary.
Run: python3 tests/test_obs_flowdata.py"""
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
sys.path.insert(0, os.path.join(ROOT, "tests"))
import obs_chain as C  # noqa: E402
import obs_fakes as K  # noqa: E402  (the pretend DefiLlama, Coinbase and Binance)
import obs_premium as P  # noqa: E402
import obs_stables as S  # noqa: E402

OK = FAIL = 0


def check(name, cond, extra=None):
    global OK, FAIL
    if cond:
        OK += 1
    else:
        FAIL += 1
        print("  FAIL", name, "" if extra is None else f"[{extra}]")


def near(a, b, tol=1e-9):
    return a is not None and b is not None and abs(a - b) <= tol * max(1.0, abs(b))


UTC = timezone.utc
quiet = lambda *a, **k: None  # noqa: E731

# ====================================================================== stablecoins
NOW = datetime(2026, 11, 14, 3, 30, tzinfo=UTC)             # so the last closed day is 2026-11-13
D0 = K.D0                                                     # the pretend history begins with the row stamped 2023-01-01
NROWS = K.n_rows(NOW)                                         # rows stamped 2023-01-01 … 2026-11-14
ts, TOT, USDT, USDC, LIST = K.ts, K.TOT, K.USDT, K.USDC, K.LIST


def llama_rows(f, extra=()):
    return K.llama_rows(f, NOW, extra)


def chain_doc(last_day="2026-11-13"):
    return K.chain_doc(last_day, NOW)


def llama_get(**kw):
    return K.llama_get(NOW, **kw)


with tempfile.TemporaryDirectory() as tmp:
    C._save(os.path.join(tmp, "chain_btc.json"), chain_doc())
    calls = []
    extra = [{"date": str(ts(datetime(2026, 11, 14, 12, tzinfo=UTC))), "totalCirculatingUSD": {"peggedUSD": 1.0}},       # not a midnight
             {"date": str(ts(datetime(2026, 11, 15, tzinfo=UTC))), "totalCirculatingUSD": {"peggedUSD": 2.0}},           # tomorrow
             {"date": "x", "totalCirculatingUSD": {"peggedUSD": 3.0}}, {"date": str(ts(D0 - timedelta(days=5))), "totalCirculatingUSD": {"peggedUSD": -4}}, None]
    r = S.run(llama_get(total=llama_rows(TOT, extra), calls=calls), NOW, out_dir=tmp, log=quiet)
    check("stables: first run writes", r == "written")
    hist = json.load(open(os.path.join(tmp, "stables.json")))
    nowd = json.load(open(os.path.join(tmp, "stables_now.json")))
    t0, n, cols = S.unpack(hist)
    # a row stamped D+1 is the end of day D: the first day is 2022-12-31, the last 2026-11-13, one day per row
    check("stables: a row is filed under the day before its stamp", t0 == "2022-12-31" and n == NROWS, (t0, n, NROWS))
    check("stables: rows off the midnight grid, in the future or without a figure are left out", len(cols["usd"]) == NROWS and all(v is not None for v in cols["usd"]))
    last = NROWS - 1
    check("stables: millions of dollars", cols["usd"][0] == 100000 and near(cols["usd"][last], (100e9 + last * 1e8) / 1e6, 1e-6), cols["usd"][last])
    check("stables: Tether and USDC by their own ids, an imitation of the ticker ignored", cols["usdt"][0] == 60000 and cols["usdc"][0] == 30000
          and [c[1].get("stablecoin") for c in calls if "stablecoin" in c[1]] == ["1", "2"], [c[1] for c in calls])
    # Bitcoin's market value 1e12 = 1,000,000 millions on every day it has; SSR = 1e12 ÷ supply
    check("stables: Bitcoin's market value from the on-chain file", cols["cap"][0] == 1000000 and cols["cap"][last] == 1000000)
    check("stables: SSR = market value ÷ stablecoins", near(cols["ssr"][0], 10.0) and near(cols["ssr"][last], 1e12 / (100e9 + last * 1e8), 1e-5), cols["ssr"][last])
    s = nowd["summary"]
    check("stables: the last day is yesterday", s["date"] == "2026-11-13" and s["ssr_date"] == "2026-11-13")
    check("stables: total and changes over 1, 7 and 30 days", near(s["usd"], 100e9 + last * 1e8, 1e-6) and near(s["chg1"], 1e8, 1e-3) and near(s["chg7"], 7e8, 1e-3) and near(s["chg30"], 30e8, 1e-3), s)
    check("stables: the 30-day change in per cent", near(s["chg30_pct"], 30e8 / (100e9 + (last - 30) * 1e8) * 100, 1e-4))
    check("stables: the highest day is the last (the supply only grew)", s["ath_date"] == "2026-11-13" and near(s["ath"], s["usd"]))
    check("stables: shares of Tether and USDC", near(s["usdt_share"], (60e9 + last * 5e7) / (100e9 + last * 1e8) * 100, 1e-4) and near(s["usdc_share"], (30e9 + last * 2e7) / (100e9 + last * 1e8) * 100, 1e-4))
    # SSR falls every day (the supply grows, the market value stands still): today's is the lowest → rank = 1 of n days
    check("stables: SSR, its rank and the market value", near(s["ssr"], cols["ssr"][last]) and near(s["ssr_pct"], 100.0 / NROWS, 1e-9) and near(s["cap"], 1e12), s)
    top = nowd["top"]
    check("stables: the list — dollar coins with a supply, largest first", [x["s"] for x in top] == ["USDT", "USDC", "DAI", "USDT"] and nowd["top_n"] == 4, [x["s"] for x in top])
    check("stables: changes in a day, a week, a month; a missing earlier figure is no change at all", top[0]["d1"] == round(175e9 - 175.3e9) and top[0]["d7"] == -1e9 and top[0]["d30"] == -8e9
          and top[1]["d1"] == 0 and top[1]["d30"] is None and top[2]["d1"] is None and top[0]["g"] == "tether")
    # a second run inside 3 hours asks nothing
    calls.clear()
    check("stables: not asked again inside 3 hours", S.run(llama_get(calls=calls), NOW + timedelta(hours=1), out_dir=tmp, log=quiet) == "skip" and not calls)
    # after 3 hours: the same history → the big file is not rewritten, the small one is
    before = hist["updated_at"]
    r = S.run(llama_get(), NOW + timedelta(hours=3, minutes=1), out_dir=tmp, log=quiet)
    check("stables: an unchanged history is not rewritten", r == "written" and json.load(open(os.path.join(tmp, "stables.json")))["updated_at"] == before
          and json.load(open(os.path.join(tmp, "stables_now.json")))["checked"] != nowd["checked"])
    # broken answers leave the files as they are
    keep = open(os.path.join(tmp, "stables.json")).read()
    t2 = NOW + timedelta(hours=7)
    check("stables: a short answer is refused", S.run(llama_get(total=llama_rows(TOT)[:500]), t2, out_dir=tmp, force=True, log=quiet) == "kept")
    check("stables: an answer that is not a list is refused", S.run(llama_get(total={"error": "x"}), t2, out_dir=tmp, force=True, log=quiet) == "kept")
    check("stables: a total a fifth away from the file's is refused", S.run(llama_get(total=llama_rows(lambda i: TOT(i) * 1.3)), t2, out_dir=tmp, force=True, log=quiet) == "kept")
    check("stables: both coins' charts missing is refused (columns do not come and go)", S.run(llama_get(coins=False), t2, out_dir=tmp, force=True, log=quiet) == "kept")
    check("stables: … and the file is untouched", open(os.path.join(tmp, "stables.json")).read() == keep)
    # the list missing: the coins' charts are asked by the ids kept from last time, the history is written, the last list stays with its own time
    n1 = json.load(open(os.path.join(tmp, "stables_now.json")))
    calls.clear()
    r = S.run(llama_get(lst=None, total=llama_rows(lambda i: TOT(i) + 1e9), calls=calls), t2, out_dir=tmp, force=True, log=quiet)
    n2 = json.load(open(os.path.join(tmp, "stables_now.json")))
    check("stables: without the list the history is still written, by the ids kept from last time", r == "written" and n1["ids"] == {"usdt": "1", "usdc": "2"}
          and [c[1].get("stablecoin") for c in calls if "stablecoin" in c[1]] == ["1", "2"] and near(n2["summary"]["usd"], n1["summary"]["usd"] + 1e9, 1e-6))
    check("stables: … and the last list stays, with its own time", n2["top"] == top and n2["top_at"] == n1["top_at"] and n2["checked"] != n1["checked"])
    # when due
    h, nd = json.load(open(os.path.join(tmp, "stables.json"))), json.load(open(os.path.join(tmp, "stables_now.json")))
    t_chk = datetime.fromisoformat(nd["checked"])
    check("due: no files", S.due(None, None, NOW) and S.due(h, {}, NOW))
    check("due: every 3 hours when yesterday is in", not S.due(h, nd, t_chk + timedelta(hours=2, minutes=59)) and S.due(h, nd, t_chk + timedelta(hours=3)))
    nxt = datetime(2026, 11, 15, 0, 20, tzinfo=UTC)
    nd2 = dict(nd, checked=(nxt - timedelta(minutes=59)).isoformat())
    check("due: hourly while yesterday is missing", not S.due(h, nd2, nxt) and S.due(h, dict(nd, checked=(nxt - timedelta(minutes=61)).isoformat()), nxt))
    nd3 = dict(nd, summary=dict(nd["summary"], ssr_date="2026-11-12"), checked=(t_chk + timedelta(0)).isoformat())
    check("due: at once (after 10 minutes) when Bitcoin's file has a newer day than the SSR", S.due(h, nd3, t_chk + timedelta(minutes=11), "2026-11-13") and not S.due(h, nd3, t_chk + timedelta(minutes=5), "2026-11-13")
          and not S.due(h, nd, t_chk + timedelta(minutes=11), "2026-11-13"))

# Bitcoin's file one day behind: SSR ends a day earlier, the supply does not
with tempfile.TemporaryDirectory() as tmp:
    C._save(os.path.join(tmp, "chain_btc.json"), chain_doc("2026-11-12"))
    S.run(llama_get(), NOW, out_dir=tmp, log=quiet)
    s = json.load(open(os.path.join(tmp, "stables_now.json")))["summary"]
    check("stables: SSR only where both sides exist", s["date"] == "2026-11-13" and s["ssr_date"] == "2026-11-12")
with tempfile.TemporaryDirectory() as tmp:                    # no Bitcoin file at all
    S.run(llama_get(), NOW, out_dir=tmp, log=quiet)
    h = json.load(open(os.path.join(tmp, "stables.json")))
    s = json.load(open(os.path.join(tmp, "stables_now.json")))["summary"]
    check("stables: without Bitcoin's file there is a supply and no SSR", "ssr" not in h["cols"] and "cap" not in h["cols"] and "ssr" not in s and "usd" in s)

# ====================================================================== the Coinbase premium
PNOW = datetime(2026, 11, 14, 3, 40, tzinfo=UTC)
PT = int(PNOW.timestamp())
H_END = PT // 3600 * 3600 - 3600                              # 02:00 — the last closed hour opens here
D_END = PT // 86400 * 86400 - 86400                           # 2026-11-13
START, Exchanges = K.START, K.Exchanges                       # the closes are described at the class (tests/obs_fakes.py)

with tempfile.TemporaryDirectory() as tmp:
    ex = Exchanges(PT)
    r = P.run(ex, PNOW, out_dir=tmp, log=quiet)
    check("premium: first run writes", r == "written")
    doc = json.load(open(os.path.join(tmp, "premium.json")))
    dd = json.load(open(os.path.join(tmp, "premium_d.json")))
    g = doc["h"]
    check("premium: an hourly grid of 90 days ending with the last closed hour", g["step"] == 3600000 and g["n"] == 2160 and g["t0"] == (H_END - 2159 * 3600) * 1000)
    cb, bn, us = g["btc"]["cb"], g["btc"]["bn"], g["usdt"]
    check("premium: every hour of the window, the running hour left out", cb["o"] == 0 and len(cb["v"]) == 2160 and len(bn["v"]) == 2160 and cb["v"][-1] == 50050.0 and bn["v"][-1] == 50000.0 and us["v"][-1] == 1.001)
    check("premium: the older hours came in windows of at most 300 candles and none was refused", sorted(g["full"]) == ["btc.cb", "eth.cb", "usdt"])
    s = doc["summary"]["btc"]
    # last hour: 50,050 ÷ 50,000 − 1 = +0.1 %;  adjusted: 50,050 ÷ (50,000 × 1.001) − 1 = −0.0000999 % ≈ 0
    check("premium: now = Coinbase ÷ Binance − 1", near(s["now"], 0.1, 1e-6) and s["t"] == (H_END + 3600) * 1000 and s["cb"] == 50050.0 and s["bn"] == 50000.0 and s["usdt"] == 1.001, s)
    check("premium: Tether-adjusted", near(s["now_adj"], (50050 / (50000 * 1.001) - 1) * 100, 1e-4), s.get("now_adj"))
    # 24 hours: one hour at +0.1 %, 23 at 0 → 0.1 ÷ 24;  7 days: 0.1 ÷ 168;  30 days: 0.1 ÷ 720
    check("premium: averages over 24 hours, 7 days and 30 days", near(s["h24"], 0.1 / 24, 1e-3) and near(s["d7"], 0.1 / 168, 1e-2) and near(s["d30"], 0.1 / 720, 5e-2), (s["h24"], s["d7"], s["d30"]))
    check("premium: the adjusted 24-hour average", near(s["h24_adj"], (50050 / (50000 * 1.001) - 1) * 100 / 24, 1e-2), s.get("h24_adj"))
    check("premium: not stale", s["stale"] is False)
    e = doc["summary"]["eth"]
    check("premium: Ether, steady at −0.1 %", near(e["now"], -0.1, 1e-6) and near(e["h24"], -0.1, 1e-6) and near(e["d30"], -0.1, 1e-6))
    d = dd["d"]
    ndays = (D_END - P.DAY0) // 86400 + 1
    check("premium: a daily grid from Binance's first day to yesterday", d["t0"] == P.DAY0 * 1000 and d["step"] == 86400000 and d["n"] == ndays and len(d["btc"]["bn"]["v"]) == ndays and len(d["btc"]["cb"]["v"]) == ndays)
    check("premium: Tether's daily closes begin when Coinbase listed it", d["usdt"]["o"] == (START["USDT-USD"] - P.DAY0) // 86400 and sorted(d["full"]) == ["btc.cb", "eth.cb", "usdt"])
    even = (D_END // 86400) % 2 == 0
    # daily premium is +0.05 % on even days and 0 on odd ones: the last day's rank is 100 % on an even day, the share of odd days otherwise
    odd_days = sum(1 for i in range(ndays) if ((P.DAY0 + i * 86400) // 86400) % 2 == 1)
    check("premium: the last day and its rank among all days", s["day"] == "2026-11-13" and near(s["day_prem"], 0.05 if even else 0.0, 1e-6)
          and near(s["day_pct"], 100.0 if even else odd_days / ndays * 100, 1e-9) and s["days"] == ndays and s["day0"] == "2017-08-17", (s["day_prem"], s["day_pct"]))
    n_first = len(ex.calls)
    check("premium: the walk asked a reasonable number of times", 40 <= n_first <= 110, n_first)
    # the same hour again: nothing asked
    ex.calls.clear()
    check("premium: nothing is asked while the last closed hour is in the file", P.run(ex, PNOW + timedelta(minutes=10), out_dir=tmp, log=quiet) == "skip" and not ex.calls)
    # the next hour: one plain request per Coinbase product and one per Binance symbol, no windows, the daily file untouched
    ex2 = Exchanges(PT + 3600, spike=H_END)
    keep_d = open(os.path.join(tmp, "premium_d.json")).read()
    r = P.run(ex2, PNOW + timedelta(hours=1), out_dir=tmp, log=quiet)
    doc2 = json.load(open(os.path.join(tmp, "premium.json")))
    check("premium: an hour later 5 small requests bring the new hour", r == "written" and len(ex2.calls) == 5 and not any("start" in c[1] for c in ex2.calls), [(c[0][-28:], c[1]) for c in ex2.calls])
    check("premium: the window moved by one hour", doc2["h"]["t0"] == g["t0"] + 3600000 and len(doc2["h"]["btc"]["cb"]["v"]) == 2160 and doc2["h"]["btc"]["cb"]["v"][-2] == 50050.0 and doc2["h"]["btc"]["cb"]["v"][-1] == 50000.0)
    check("premium: the daily file is rewritten only when a day closes", open(os.path.join(tmp, "premium_d.json")).read() == keep_d)
    s2 = doc2["summary"]["btc"]
    check("premium: the new hour is flat, the 24-hour average still holds the +0.1 % hour", near(s2["now"], 0.0, 1e-9) and near(s2["h24"], 0.1 / 24, 1e-3))

# a window that fails: the older part is asked again next time, and the file says it is not complete
with tempfile.TemporaryDirectory() as tmp:
    ex = Exchanges(PT, fail_window=lambda prod, step, a, b: prod == "BTC-USD" and step == 3600 and a < H_END - 1000 * 3600)
    P.run(ex, PNOW, out_dir=tmp, log=quiet)
    doc = json.load(open(os.path.join(tmp, "premium.json")))
    got = len(doc["h"]["btc"]["cb"]["v"])
    check("premium: a failed window leaves the older hours out and the series marked incomplete", "btc.cb" not in doc["h"]["full"] and 800 < got < 1200 and doc["h"]["btc"]["cb"]["o"] > 900, (got, doc["h"]["btc"]["cb"]["o"]))
    check("premium: the summary still stands on the hours that are there", near(doc["summary"]["btc"]["now"], 0.1, 1e-6) and "d30" in doc["summary"]["btc"])
    ex2 = Exchanges(PT + 3600, spike=H_END)
    P.run(ex2, PNOW + timedelta(hours=1), out_dir=tmp, log=quiet)
    doc2 = json.load(open(os.path.join(tmp, "premium.json")))
    check("premium: the next run walks back again and completes it", "btc.cb" in doc2["h"]["full"] and len(doc2["h"]["btc"]["cb"]["v"]) == 2160 and doc2["h"]["btc"]["cb"]["o"] == 0)

# a close far from the other exchange's is a broken answer, not a premium; the newest hour missing on Coinbase → stale
with tempfile.TemporaryDirectory() as tmp:
    ex = Exchanges(PT, broken={("BTC-USD", 3600, H_END - 3600): 5005.0, ("USDT-USD", 3600, H_END - 7200): 0.5})
    P.run(ex, PNOW, out_dir=tmp, log=quiet)
    g = json.load(open(os.path.join(tmp, "premium.json")))["h"]
    check("premium: a close a tenth away from the other exchange is left out on both sides", g["btc"]["cb"]["v"][-2] is None and g["btc"]["bn"]["v"][-2] is None and g["btc"]["cb"]["v"][-1] == 50050.0)
    check("premium: a Tether price far from a dollar is left out", g["usdt"]["v"][-3] is None and g["usdt"]["v"][-2] == 1.0)

    class Late(Exchanges):                                       # Coinbase has not published the hour that just closed
        def __call__(self, url, params):
            rows = super().__call__(url, params)
            if "coinbase" in url and isinstance(rows, list):
                rows = [r for r in rows if r[0] < H_END]
            return rows
with tempfile.TemporaryDirectory() as tmp:
    late = Late(PT)
    r = P.run(late, PNOW, out_dir=tmp, log=quiet)
    s = json.load(open(os.path.join(tmp, "premium.json")))["summary"]["btc"]
    check("premium: an hour Coinbase has not published yet → the hour before it, marked stale, and asked again", r == "written" and s["stale"] is True and s["t"] == H_END * 1000 and near(s["now"], 0.0, 1e-9))
    late.calls.clear()
    check("premium: … the next run asks again", P.run(late, PNOW + timedelta(minutes=15), out_dir=tmp, log=quiet) == "written" and len(late.calls) >= 3)
with tempfile.TemporaryDirectory() as tmp:
    check("premium: no exchange answers → nothing written", P.run(lambda u, p: None, PNOW, out_dir=tmp, log=quiet) == "kept" and not os.path.exists(os.path.join(tmp, "premium.json")))

# parsers on junk
check("parse: Coinbase rows off the grid or without a price are left out", P.cb_parse([[3600, 1, 2, 3, 4.5, 6], [3601, 1, 2, 3, 4, 5], [7200, 1, 2, 3, "x", 5], [0, 1, 2, 3, 4, 5], "junk", [10800, 1, 2, 3, 0, 5], None], 3600) == {3600: 4.5}
      and P.cb_parse({"message": "NotFound"}, 3600) == {} and P.cb_parse(None, 3600) == {})
check("parse: Binance rows", P.bn_parse([[3600000, "1", "2", "0.5", "4.50000000", "9"], [3600001, "1", "2", "0.5", "4", "9"], ["x"], None], 3600) == {3600: 4.5} and P.bn_parse({"code": -1121}, 3600) == {})
check("col: leading and trailing gaps are not stored", P.col({7200: 1.0, 14400: 3.0}, 3600, 3600, 6) == {"o": 1, "v": [1.0, None, 3.0]} and P.col({}, 0, 3600, 5) is None)

# ====================================================================== the page's arithmetic on the written files
with tempfile.TemporaryDirectory() as tmp:
    C._save(os.path.join(tmp, "chain_btc.json"), chain_doc())
    S.run(llama_get(), NOW, out_dir=tmp, log=quiet)
    P.run(Exchanges(PT), PNOW, out_dir=tmp, log=quiet)
    js = r"""
const F = require(process.argv[1]), fs = require('fs'), dir = process.argv[2];
const p = JSON.parse(fs.readFileSync(dir + '/premium.json')), pd = JSON.parse(fs.readFileSync(dir + '/premium_d.json'));
const st = JSON.parse(fs.readFileSync(dir + '/stables.json'));
const out = {};
for (const a of ['btc', 'eth']) {
  const g = p.h, pr = F.premium(F.col(g[a].cb, g.n), F.col(g[a].bn, g.n), F.col(g.usdt, g.n)), i = F.last(pr.raw);
  const d = pd.d, dr = F.premium(F.col(d[a].cb, d.n), F.col(d[a].bn, d.n), F.col(d.usdt, d.n)), j = F.last(dr.raw);
  out[a] = { now: pr.raw[i], adj: pr.adj[i], t: g.t0 + (i + 1) * g.step, h24: F.meanLast(pr.raw, i, 24, 20), d7: F.meanLast(pr.raw, i, 168, 140), d30: F.meanLast(pr.raw, i, 720, 600),
    day: dr.raw[j], dayT: d.t0 + j * d.step, rank: F.rank(dr.raw, j) };
}
const usd = F.col(st.cols.usd, st.n), ssr = F.col(st.cols.ssr, st.n), cap = F.col(st.cols.cap, st.n), i = F.last(usd), k = F.last(ssr);
out.st = { day: F.dayMs(st.t0) + i * 86400000, usd: usd[i] * 1e6, chg30: F.diff(usd, 30)[i] * 1e6, ssr: ssr[k], ratio: F.ratio(cap, usd, 1)[k], rank: F.rank(ssr, k),
  share: F.ratio(F.col(st.cols.usdt, st.n), usd, 100)[i] };
console.log(JSON.stringify(out));
"""
    res = subprocess.run(["node", "-e", js, os.path.join(ROOT, "assets", "obs", "flowmath.js"), tmp], capture_output=True, text=True)
    check("node ran the page's arithmetic", res.returncode == 0, res.stderr[:300])
    if res.returncode == 0:
        J = json.loads(res.stdout)
        sm = json.load(open(os.path.join(tmp, "premium.json")))["summary"]
        for a in ("btc", "eth"):
            x, y = J[a], sm[a]
            check(f"page = summary ({a}): now, adjusted, its time", near(x["now"], y["now"], 1e-4) and near(x["adj"], y["now_adj"], 1e-3) and x["t"] == y["t"], (x, y))
            check(f"page = summary ({a}): averages", near(x["h24"], y["h24"], 1e-3) and near(x["d7"], y["d7"], 1e-2) and near(x["d30"], y["d30"], 1e-1), (x["h24"], y["h24"], x["d30"], y["d30"]))
            check(f"page = summary ({a}): the last day and its rank", near(x["day"], y["day_prem"], 1e-4) and near(x["rank"], y["day_pct"], 1e-9)
                  and datetime.fromtimestamp(x["dayT"] / 1000, UTC).strftime("%Y-%m-%d") == y["day"])
        ss = json.load(open(os.path.join(tmp, "stables_now.json")))["summary"]
        x = J["st"]
        check("page = summary (stablecoins): day, total, 30-day change", datetime.fromtimestamp(x["day"] / 1000, UTC).strftime("%Y-%m-%d") == ss["date"] and near(x["usd"], ss["usd"]) and near(x["chg30"], ss["chg30"], 1e-6))
        check("page = summary (stablecoins): SSR, its rank, Tether's share", near(x["ssr"], ss["ssr"]) and near(x["ratio"], ss["ssr"], 1e-5) and near(x["rank"], ss["ssr_pct"], 1e-9) and near(x["share"], ss["usdt_share"], 1e-9))

print(f"observatory flow data: {OK} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
