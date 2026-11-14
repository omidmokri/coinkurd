#!/usr/bin/env python3
"""The Observatory, stage 5 CI steps against pretend sources in the real formats:
scripts/obs_curve.py (Deribit candles + Coinbase closes → constant-maturity basis), scripts/obs_liqarch.py (Gate's
contract statistics → a daily archive that never shrinks) and scripts/obs_hl.py (Hyperliquid accounts → liquidation
levels of real positions). python3 tests/test_obs_more.py"""
import json
import os
import shutil
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import obs_curve as CV  # noqa: E402
import obs_hl as HL  # noqa: E402
import obs_liqarch as LA  # noqa: E402

UTC = timezone.utc
DAY = 86400
ok = bad = 0


def check(name, cond, info=""):
    global ok, bad
    if cond:
        ok += 1
    else:
        bad += 1
        print("  FAIL", name, info)


def near(a, b, tol=1e-9):
    return a is not None and b is not None and abs(a - b) <= tol


def ts(d):
    return int(datetime(d.year, d.month, d.day, tzinfo=UTC).timestamp())


# ================================================================ curve
print("[curve]")
fr = CV.last_fridays(date(2024, 11, 1), date(2026, 12, 31))
check("last Fridays: Dec 2024 → the 27th, Dec 2026 → the 25th, Mar 2027 absent", date(2024, 12, 27) in fr and date(2026, 12, 25) in fr and fr[-1] == date(2026, 12, 25), fr[-3:])
check("all are Fridays and the last of their month", all(d.weekday() == 4 and (d + timedelta(days=7)).month != d.month for d in fr))
check("Deribit's names: no leading zero in the day", CV.name("BTC", date(2026, 12, 4)) == "BTC-4DEC26" and CV.name("ETH", date(2024, 12, 27)) == "ETH-27DEC24")
check("interp: on the line between neighbours", near(CV.interp([(20, 4.0), (50, 10.0)], 30), 6.0) and near(CV.interp([(30, 5.0), (60, 9)], 30), 5.0))
check("interp: nothing without a neighbour on each side", CV.interp([(40, 4.0), (60, 6.0)], 30) is None and CV.interp([(10, 4.0)], 30) is None)

NOW = datetime(2026, 11, 14, 9, 30, tzinfo=UTC)
TODAY = ts(NOW.date())
B = {"btc": 0.10, "eth": 0.05}                      # every future carries this yearly basis, exactly


def spot_px(key, t):
    return (50000.0 if key == "btc" else 2000.0) * (1 + 0.001 * ((t // DAY) % 7))


def premium_d():
    t0 = ts(date(2018, 6, 1))
    n = (TODAY - t0) // DAY
    cols = {}
    for key in ("btc", "eth"):
        cols[key] = {"cb": {"o": 0, "v": [spot_px(key, t0 + i * DAY) for i in range(n)]}, "bn": {"o": 0, "v": [1.0] * n}}
    return {"d": dict(t0=t0 * 1000, step=DAY * 1000, n=n, **cols)}


class Deribit:
    def __init__(self, first=date(2020, 1, 1), dead=False):
        self.calls, self.first, self.dead = [], first, dead

    def __call__(self, url, params):
        self.calls.append(dict(params))
        if self.dead:
            return None
        nm = params["instrument_name"]
        cur, rest = nm.split("-", 1)
        d = datetime.strptime(rest, "%d%b%y").date()
        if d < self.first:
            return None                                     # Deribit answers 400: no such instrument
        exp = CV.expiry_ts(d)
        key = cur.lower()
        t0, t1 = params["start_timestamp"] // 1000, params["end_timestamp"] // 1000
        ticks, close = [], []
        t = (t0 + DAY - 1) // DAY * DAY
        listed = exp - 380 * DAY
        while t <= t1:
            if t >= listed:
                days = (exp - (t + DAY)) / DAY
                close.append(spot_px(key, t) * (1 + B[key] * days / 365))
                ticks.append(t * 1000)
            t += DAY
        return {"result": {"status": "ok" if ticks else "no_data", "ticks": ticks, "close": close}}


tmp = tempfile.mkdtemp()
try:
    json.dump(premium_d(), open(os.path.join(tmp, "premium_d.json"), "w"))
    der = Deribit()
    logs = []
    r = CV.run(der, NOW, out_dir=tmp, log=logs.append, pause=0)
    doc = json.load(open(os.path.join(tmp, "curve_hist.json")))
    check("first run: written, from the first day two futures bracket a maturity (futures from 2020-01)", r == "written" and "2019-02-01" <= doc["t0"] <= "2019-12-31", (r, doc.get("t0"), logs[-1:]))
    rows = CV.load_rows(doc, "btc")
    last = max(rows)
    check("the last day is yesterday (a closed day)", last == TODAY - DAY, datetime.fromtimestamp(last, UTC))
    vals = [v for t, rw in rows.items() for k, v in rw.items() if k.startswith("cm") and v is not None]
    check("every constant-maturity value equals the basis every future carries (10 % a year)", vals and all(abs(v - 10.0) < 0.0011 for v in vals), (min(vals), max(vals)))
    erows = CV.load_rows(doc, "eth")
    check("Ether: 5 % a year", all(abs(v - 5.0) < 0.0011 for rw in erows.values() for k, v in rw.items() if k.startswith("cm") and v is not None))
    check("px is the Coinbase close of that day", near(rows[last]["px"], spot_px("btc", last), 0.5))
    s = doc["summary"]["btc"]
    check("summary: day, 90 days, average, rank", s["day"] == datetime.fromtimestamp(last, UTC).strftime("%Y-%m-%d") and near(s["cm90"], 10.0, 0.0011) and near(s["avg365"], 10.0, 0.0011) and s["days"] > 1500, s)
    k_ok = all(rw.get("k", 0) >= 2 for rw in rows.values())
    check("each day used at least two futures", k_ok)
    n_full = len(der.calls)
    # not due again the same day
    r2 = CV.run(der, NOW + timedelta(hours=2), out_dir=tmp, log=logs.append, pause=0)
    check("not due again before tomorrow", r2 == "skip" and len(der.calls) == n_full)
    # next day: only recent futures are asked, the history stays
    der2 = Deribit()
    TODAY += DAY                                     # Coinbase's close of the new day is in premium_d.json by then
    json.dump(premium_d(), open(os.path.join(tmp, "premium_d.json"), "w"))
    r3 = CV.run(der2, NOW + timedelta(days=1), out_dir=tmp, log=logs.append, pause=0)
    doc3 = json.load(open(os.path.join(tmp, "curve_hist.json")))
    check("next day: a few futures asked, a day added, the history kept", r3 == "written" and len(der2.calls) < 40 and doc3["n"] == doc["n"] + 1 and doc3["t0"] == doc["t0"], (r3, len(der2.calls), doc3["n"], doc["n"]))
    # Deribit silent: the file stays
    r4 = CV.run(Deribit(dead=True), NOW + timedelta(days=2), out_dir=tmp, log=logs.append, pause=0)
    doc4 = json.load(open(os.path.join(tmp, "curve_hist.json")))
    check("Deribit silent: kept, history unchanged", r4 == "kept" and doc4["n"] == doc3["n"] and doc4.get("btc") == doc3.get("btc"))
    # days near expiry: a future with < 2 days is not used
    futs = {CV.expiry_ts(date(2026, 11, 27)): {TODAY - DAY: 1.0}}
    check("a future 1.4 days from expiry is left out", CV.day_points(futs, {TODAY - DAY: 1.0}, TODAY - DAY) == [] if (CV.expiry_ts(date(2026, 11, 27)) - TODAY) / DAY < 2 else True)
finally:
    shutil.rmtree(tmp)

# ================================================================ liquidation archive
print("[liquidation archive]")
D0 = date(2023, 10, 11)
NOWL = datetime(2026, 11, 14, 9, tzinfo=UTC)
TODL = ts(NOWL.date())
HOLE_DAY = ts(date(2025, 6, 21))                     # Gate's statistics missed this day (zero taker on BTC's row), before the 4-hour rows begin
HOLE_4H = ts(date(2026, 3, 6)) + 8 * 3600            # and this 4-hour period


def liq(coin, t, step):
    k = {"BTC": 1.0, "ETH": 0.6}.get(coin, 0.1)
    return 1000.0 * k * step / 3600, 400.0 * k * step / 3600


class Gate:
    def __init__(self, first4=date(2025, 12, 16), first1=D0, coins=("BTC", "ETH", "SOL")):
        self.calls, self.first4, self.first1, self.coins = [], first4, first1, coins

    def __call__(self, url, params):
        self.calls.append(dict(params))
        coin = params["contract"].split("_")[0]
        if coin not in self.coins:
            return None
        step = DAY if params["interval"] == "1d" else 4 * 3600
        t = ts(self.first1 if step == DAY else self.first4)
        out = []
        while t <= int(NOWL.timestamp()):
            ll, sl = liq(coin, t, step)
            tk = 0 if (t == HOLE_DAY and step == DAY) or (t == HOLE_4H and step != DAY) else 10.0
            if step == DAY:
                ll *= 1.02                                 # the day's own row is valued at the day's close: a little off the 4-hour sum
            out.append({"time": t, "long_liq_usd": ll, "short_liq_usd": sl, "long_taker_size": tk, "short_taker_size": tk})
            t += step
        return out[-2000:]


tmp = tempfile.mkdtemp()
try:
    g = Gate()
    r = LA.run(g, NOWL, out_dir=tmp, log=print)
    doc = json.load(open(os.path.join(tmp, "liq_archive.json")))
    b = LA.unpack_coin(doc["coins"]["BTC"])
    check("written; BTC from 2023-10-11 to yesterday", r == "written" and doc["coins"]["BTC"]["t0"] == "2023-10-11" and max(b) == TODL - DAY, (r, doc["coins"]["BTC"]["t0"]))
    check("a coin Gate does not list is left out", set(doc["coins"]) == {"BTC", "ETH", "SOL"}, list(doc["coins"]))
    t_q2 = ts(date(2026, 6, 1))
    want = liq("BTC", 0, 4 * 3600)
    check("a day the 4-hour rows cover: their sum (q 2), in thousands", b[t_q2] == (round(6 * want[0] / 1000), round(6 * want[1] / 1000), 2), b[t_q2])
    t_q1 = ts(date(2024, 6, 1))
    w1 = liq("BTC", 0, DAY)
    check("an older day: the day's own row (q 1)", b[t_q1] == (round(w1[0] * 1.02 / 1000), round(w1[1] / 1000), 1), b[t_q1])
    check("a day Gate missed: q 0, kept as given — and the day before it (cut short)", b[HOLE_DAY][2] == 0 and LA.unpack_coin(doc["coins"]["ETH"])[HOLE_DAY][2] == 0 and b[HOLE_DAY - DAY][2] == 0 and b[HOLE_DAY + DAY][2] == 1, (b[HOLE_DAY - DAY], b[HOLE_DAY + DAY]))
    h4day = ts(date(2026, 3, 6))
    check("a day with a missed 4-hour period falls back to its own row (q 1)", b[h4day][2] == 1 and b[h4day - DAY][2] == 2, (b[h4day], b[h4day - DAY]))
    check("today (not closed) is not kept", TODL not in b)
    # Gate forgets the oldest months: the archive keeps them
    g2 = Gate(first1=date(2024, 6, 1))
    r2 = LA.run(g2, NOWL + timedelta(days=1), out_dir=tmp, log=print)
    b2 = LA.unpack_coin(json.load(open(os.path.join(tmp, "liq_archive.json")))["coins"]["BTC"])
    check("Gate's history shrank: the archive did not", r2 == "written" and min(b2) == ts(D0) and max(b2) == TODL, (r2, datetime.fromtimestamp(min(b2), UTC)))
    check("a day Gate still gives is worked out again; one it no longer gives stays", LA.merge({1: (5, 5, 1), 2: (7, 7, 2)}, {1: (9, 9, 0)}) == {1: (9, 9, 0), 2: (7, 7, 2)})
    r3 = LA.run(g2, NOWL + timedelta(days=1, hours=2), out_dir=tmp, log=print)
    check("not due twice a day", r3 == "skip")
    r4 = LA.run(Gate(coins=()), NOWL + timedelta(days=3), out_dir=tmp, log=print)
    check("Gate silent: the file stays", r4 == "kept" and min(LA.unpack_coin(json.load(open(os.path.join(tmp, "liq_archive.json")))["coins"]["BTC"])) == ts(D0))
finally:
    shutil.rmtree(tmp)

# ================================================================ Hyperliquid
print("[hyperliquid]")


def lb(n):
    return {"leaderboardRows": [{"ethAddress": f"0x{i:040x}", "accountValue": str(1e7 / (i + 1)),
                                 "windowPerformances": [["month", {"vlm": str((i * 7919) % 1000 * 1e6)}]]} for i in range(n)]}


addrs, listed = HL.order(lb(50))
check("order: each account once, the largest first, the most active second", listed == 50 and len(addrs) == len(set(addrs)) and addrs[0] == "0x" + "0" * 40 and len(addrs) == 50, addrs[:3])
META = [{"universe": [{"name": "BTC"}, {"name": "ETH"}, {"name": "OLD", "isDelisted": True}]},
        [{"markPx": "60000", "openInterest": "1000"}, {"markPx": "2000", "openInterest": "50000"}, {"markPx": "1", "openInterest": "5"}]]
mkt = HL.market(META)
check("market: mark and open interest, delisted left out", mkt == {"BTC": (60000.0, 1000.0), "ETH": (2000.0, 50000.0)}, mkt)


def state(i):
    """account i: a BTC long of 1 BTC liquidated at 50,000 − i, every third one a short of 2 BTC at 70,000 + i; ETH without a liquidation price"""
    pos = []
    if i % 3:
        pos.append({"position": {"coin": "BTC", "szi": "1.0", "entryPx": "59000", "liquidationPx": str(50000 - i), "leverage": {"value": 5}}})
    else:
        pos.append({"position": {"coin": "BTC", "szi": "-2.0", "entryPx": "61000", "liquidationPx": str(70000 + i), "leverage": {"value": 10}}})
    pos.append({"position": {"coin": "ETH", "szi": "-3", "entryPx": "2100", "liquidationPx": None, "leverage": {"value": 2}}})
    return {"assetPositions": pos, "marginSummary": {"accountValue": "1"}}


states = {f"a{i}": state(i) for i in range(30)}
co = HL.aggregate(states, mkt)
bt = co["BTC"]
n_s = len([i for i in range(30) if i % 3 == 0])
check("aggregate: longs and shorts read, counted", bt["long"] == 30 - n_s and bt["short"] == 2 * n_s and bt["n_long"] == 30 - n_s and bt["n_short"] == n_s, bt)
check("positions with liquidation prices, rising, in dollars at the mark", len(bt["pos"]) == 30 and bt["pos"] == sorted(bt["pos"]) and bt["pos"][0] == [50000 - 29, 60000, 1] and bt["pos"][-1] == [70027, 120000, -1], bt["pos"][:2] + bt["pos"][-1:])
check("no liquidation price: counted apart", co["ETH"]["n_free"] == 30 and co["ETH"]["pos"] == [])
check("top positions: largest first, with entry, liquidation price and leverage", bt["top"][0][:2] == [-1, 120000] and bt["top"][0][4] == 10 and len(bt["top"]) == HL.N_TOP)
check("coins ranked by open interest in dollars", list(co) == ["ETH", "BTC"], list(co))


class Post:
    def __init__(self, n429=0):
        self.n, self.n429 = 0, n429

    def __call__(self, body):
        self.n += 1
        if body["type"] == "metaAndAssetCtxs":
            return 200, META
        if self.n429 > 0:
            self.n429 -= 1
            return 429, None
        i = int(body["user"][2:], 16)
        return 200, state(i)


p = Post(n429=3)
got, asked = HL.read_states(p, [f"0x{i:040x}" for i in range(40)], budget=30, rate=200)
check("read_states: a 429 is asked again; every account read", len(got) == 40 and asked == 40, (len(got), asked))
t = [0.0]
got2, asked2 = HL.read_states(Post(), [f"0x{i:040x}" for i in range(400)], budget=1, rate=1000, workers=1, clock=lambda: t.__setitem__(0, t[0] + 0.01) or t[0])
check("read_states: stops when the time is up", 50 <= asked2 < 400 and len(got2) == asked2, asked2)
tmp = tempfile.mkdtemp()
try:
    r = HL.run(lambda url: lb(300), Post(), NOW, out_dir=tmp, log=print, budget=30, rate=500)
    doc = json.load(open(os.path.join(tmp, "hl_liq.json")))
    check("run: written with the counts of what was read", r == "written" and doc["accounts"]["read"] == 300 and doc["accounts"]["listed"] == 300 and doc["coins"]["BTC"]["oi"] == 1000, doc["accounts"])
    check("run: not due within the hour", HL.run(lambda url: lb(300), Post(), NOW + timedelta(minutes=20), out_dir=tmp, log=print) == "skip")
    r2 = HL.run(lambda url: None, Post(), NOW + timedelta(hours=2), out_dir=tmp, log=print)
    check("no leaderboard: the previous file stays", r2 == "kept" and json.load(open(os.path.join(tmp, "hl_liq.json")))["updated_at"] == doc["updated_at"])
    r3 = HL.run(lambda url: lb(50), Post(), NOW + timedelta(hours=3), out_dir=tmp, log=print, budget=30, rate=500)
    check("fewer than 100 accounts answered: the previous file stays", r3 == "kept")
finally:
    shutil.rmtree(tmp)

print(f"observatory stage 5 data: {ok} passed, {bad} failed")
sys.exit(1 if bad else 0)
