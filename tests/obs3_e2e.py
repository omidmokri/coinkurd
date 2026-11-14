#!/usr/bin/env python3
"""End-to-end test of the Observatory's stage 3 in a real Chrome, offline:
/charts/options/ · /charts/mvrv/ · /charts/exchange-flows/ · /charts/network/ · /charts/bitcoin-cycle/ and the hub.

The repo is served locally.
  * Deribit is mocked in its real formats: get_book_summary_by_currency (every option with open_interest, volume, mark_iv,
    underlying_price, estimated_delivery_price; an expired instrument and a perpetual among them),
    get_volatility_index_data ([t, o, h, l, c] candles, 1000 a page, `continuation` for the older page) and
    get_delivery_prices (100 days a page, newest first, `offset`). The book is small enough to work out by hand:
    the second expiry's max pain is 60,000 against an index of 70,000 (see BOOK below).
  * The on-chain files are built by scripts/obs_chain.py itself from made-up Coin Metrics rows in the real shape; the figures
    the pages must show are taken from the Python summary (the one the bot reads) — the pages compute theirs in JavaScript.
Checks: zero JS errors; every tile, table and series against those known answers; every control; share links; PNG;
four languages at 1280 px and 390 px without sideways scroll; what the pages say when Deribit or the data file is missing.
Screenshots go to $SHOTS (default /tmp/obs3shots) — look at them.
Run: python3 scripts/build_obs.py && python3 tests/obs3_e2e.py        (ONLY=options|chain|cycle|langs|errors|hub)
"""
import json
import math
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tests"))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import obs_e2e as E  # noqa: E402  (the local server, the page wiring and the exchanges' mocks of stages 1 and 2)
import obs_chain as OC  # noqa: E402

SHOTS = os.environ.get("SHOTS", "/tmp/obs3shots")
ONLY = os.environ.get("ONLY", "")
os.makedirs(SHOTS, exist_ok=True)
check, near, overflow = E.check, E.near, E.overflow
H, D = 3_600_000, 86_400_000
NOW = int(time.time() * 1000)
UTC = timezone.utc
DOWN = set()             # "deribit", "book", "dvol", "delivery", "chain", "chain500"
REQ = []                 # (endpoint, query) of every Deribit request

# ---------------------------------------------------------------- Deribit: a book worked out by hand
MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def exp_at(days):
    """an expiry `days` ahead: (code like 4DEC26, timestamp 08:00 UTC)"""
    t = datetime.fromtimestamp(NOW / 1000, UTC) + timedelta(days=days)
    t = t.replace(hour=8, minute=0, second=0, microsecond=0)
    if t.timestamp() * 1000 <= NOW:
        t += timedelta(days=1)
    return f"{t.day}{MON[t.month - 1]}{t.strftime('%y')}", int(t.timestamp() * 1000)


EXP = [exp_at(1), exp_at(8), exp_at(36), exp_at(127)]
IDX = {"BTC": 70000.0, "ETH": 2000.0}
STRIKES = {"BTC": list(range(40000, 100001, 5000)), "ETH": list(range(1000, 3001, 250))}
IV0 = [60.0, 55.0, 50.0, 48.0]


def book_oi(cur):
    """{(expiry index, strike, 'C'|'P'): coins}.  BTC:
       E1  calls 65,000: 100 · puts 75,000: 100                 → 200 coins (under the 500 that make an expiry "the next one"),
                                                                   pain is flat from 65,000 to 75,000 → max pain 65,000 (lowest of the tie)
       E2  calls 60,000: 400, 70,000: 300 · puts 70,000: 100, 80,000: 300
             settle 60,000: puts 10,000·100 + 20,000·300 = 7.0 M
             settle 65,000: calls 5,000·400 = 2.0 M, puts 5,000·100 + 15,000·300 = 5.0 M → 7.0 M
             settle 70,000: calls 10,000·400 = 4.0 M, puts 10,000·300 = 3.0 M → 7.0 M
             settle 55,000: puts 15,000·100 + 25,000·300 = 9.0 M;  settle 75,000: 9.0 M        → max pain 60,000 (lowest of the tie)
       E3  calls from 70,000 up: 50, 100, … · puts from 70,000 down: 40, 80, …       E4  twice E3, plus far wings 20,000 P and 150,000 C
       Ether: the same shape at 1/35 of the strikes' scale and ten times the coins."""
    k = 1 if cur == "BTC" else 10
    s = (lambda x: x) if cur == "BTC" else (lambda x: x / 35)
    o = {(0, s(65000), "C"): 100 * k, (0, s(75000), "P"): 100 * k,
         (1, s(60000), "C"): 400 * k, (1, s(70000), "C"): 300 * k, (1, s(70000), "P"): 100 * k, (1, s(80000), "P"): 300 * k}
    for e, m in ((2, 1), (3, 2)):
        for K in range(70000, 100001, 5000):
            o[(e, s(K), "C")] = 50 * ((K - 65000) // 5000) * m * k
        for K in range(40000, 70001, 5000):
            o[(e, s(K), "P")] = 40 * ((75000 - K) // 5000) * m * k
    o[(3, s(20000), "P")] = 500 * k
    o[(3, s(150000), "C")] = 600 * k
    return o


def strike_name(K):
    return str(int(K)) if float(K).is_integer() else str(K).replace(".", "d")


def und_of(cur, e):
    return IDX[cur] * (1 + 0.001 * (EXP[e][1] - NOW) / D)


def book_rows(cur):
    oi = book_oi(cur)
    ks = {e: sorted({K for (ee, K, _) in oi if ee == e} | set(STRIKES[cur] if cur == "BTC" else [x / 35 for x in STRIKES["BTC"]])) for e in range(4)}
    rows = []
    for e, (code, ts) in enumerate(EXP):
        for K in ks[e]:
            for t in "CP":
                v = oi.get((e, K, t), 0)
                rows.append({"high": None, "low": None, "last": None, "instrument_name": f"{cur}-{code}-{strike_name(K)}-{t}", "bid_price": 0.01, "ask_price": 0.012,
                             "open_interest": v, "mark_price": 0.011, "interest_rate": 0, "creation_timestamp": NOW, "estimated_delivery_price": IDX[cur], "price_change": None,
                             "volume": v / (10 if t == "C" else 5), "mark_iv": round(IV0[e] + 0.0004 * abs(K - IDX[cur]) * (1 if cur == "BTC" else 35), 6),
                             "underlying_price": und_of(cur, e), "underlying_index": f"{cur}-{code}", "base_currency": cur, "quote_currency": cur, "volume_usd": 0, "mid_price": 0.011})
    past = datetime.fromtimestamp(NOW / 1000, UTC) - timedelta(days=1)
    rows.append({"instrument_name": f"{cur}-{past.day}{MON[past.month - 1]}{past.strftime('%y')}-{strike_name(STRIKES[cur][3])}-C", "open_interest": 9999, "volume": 99, "mark_iv": 30,
                 "underlying_price": IDX[cur], "estimated_delivery_price": IDX[cur]})          # expired: must not be counted
    rows.append({"instrument_name": f"{cur}-PERPETUAL", "open_interest": 1e9, "volume": 1e9})
    return rows


def pain(st, S):
    return sum(c * max(0, S - K) + p * max(0, K - S) for K, c, p in st)


def expected_book(cur):
    """totals, per-expiry figures and max pain from the table above, by the definitions (independent of optmath.js)"""
    oi = book_oi(cur)
    out = {"exps": []}
    allk = sorted(set(STRIKES[cur] if cur == "BTC" else [x / 35 for x in STRIKES["BTC"]]))
    for e in range(4):
        ks = sorted({K for (ee, K, _) in oi if ee == e} | set(allk))
        st = [(K, oi.get((e, K, "C"), 0), oi.get((e, K, "P"), 0)) for K in ks]
        c, p = sum(x[1] for x in st), sum(x[2] for x in st)
        best = min(ks, key=lambda S: (pain(st, S), S))
        und = und_of(cur, e)
        out["exps"].append({"code": EXP[e][0], "c": c, "p": p, "pc": p / c, "mp": best, "st": st, "und": und,
                            "iv": IV0[e] + 0.0004 * abs(und - IDX[cur]) * (1 if cur == "BTC" else 35)})
    out["c"] = sum(x["c"] for x in out["exps"])
    out["p"] = sum(x["p"] for x in out["exps"])
    return out


def dvol_close(cur, t):
    return (50 if cur == "BTC" else 62) + 8 * math.sin(t / (9 * D))


def deribit(route):
    u = urlparse(route.request.url)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    ep = u.path.rsplit("/", 1)[-1]
    REQ.append((ep, q))
    if "deribit" in DOWN or (ep == "get_book_summary_by_currency" and "book" in DOWN) or (ep == "get_volatility_index_data" and "dvol" in DOWN) \
            or (ep == "get_delivery_prices" and "delivery" in DOWN):
        return route.abort()
    ok = lambda res: E.jresp(route, {"jsonrpc": "2.0", "result": res, "usIn": 1, "usOut": 2, "usDiff": 1, "testnet": False})  # noqa: E731
    if ep == "get_book_summary_by_currency":
        return ok(book_rows(q["currency"]))
    if ep == "get_volatility_index_data":
        step = {"3600": H, "43200": 12 * H, "1D": D}[q["resolution"]]
        t0, t1 = int(q["start_timestamp"]), int(q["end_timestamp"])
        last = t1 // step * step
        first = max(-(-t0 // step) * step, last - 999 * step)
        data = []
        t = first
        while t <= last:
            c, o = dvol_close(q["currency"], t), dvol_close(q["currency"], t - step)
            data.append([t, round(o, 2), round(max(o, c) + 0.5, 2), round(min(o, c) - 0.5, 2), round(c, 2)])
            t += step
        return ok({"data": data, "continuation": (first - step) if first - step >= t0 else None})
    if ep == "get_delivery_prices":
        cur = q["index_name"].split("_")[0].upper()
        off, cnt = int(q.get("offset", 0)), int(q.get("count", 10))
        day0 = datetime.fromtimestamp(NOW / 1000, UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        data = []
        for i in range(off, min(off + min(cnt, 100), 2600)):
            dt = day0 - timedelta(days=i)
            data.append({"date": dt.strftime("%Y-%m-%d"), "delivery_price": round(IDX[cur] * (1 + 0.1 * math.sin(i / 40)), 2)})
        return ok({"data": data, "records_total": 2600})
    if ep == "get_index_price":
        return ok({"index_price": IDX["BTC"], "estimated_delivery_price": IDX["BTC"]})
    return route.fulfill(status=400, body="{}")


# ---------------------------------------------------------------- the on-chain files (made-up Coin Metrics rows → scripts/obs_chain.py)
def cm_rows(asset, n, start):
    d0 = datetime.strptime(start, "%Y-%m-%d")
    rows, reserve = [], 2_000_000.0 if asset == "btc" else 20_000_000.0
    for i in range(n):
        ph = i / 230.0
        p = (0.08 if asset == "btc" else 0.9) * math.exp(0.0023 * i) * (1 + 0.45 * math.sin(ph)) * (1 + 0.03 * math.sin(i / 7.0))
        fin = 20000 + 6000 * math.sin(i / 19.0)
        fout = 20500 + 6000 * math.cos(i / 23.0)
        reserve += fin - fout
        flow = i >= 280
        r = {"asset": asset, "time": (d0 + timedelta(days=i)).strftime("%Y-%m-%d") + "T00:00:00.000000000Z",
             "PriceUSD": f"{p:.10f}", "CapMVRVCur": f"{1.6 + 1.2 * math.sin(ph + 0.3):.12f}", "SplyCur": f"{3.4e6 + 3000 * i - 0.2 * i * i / 10:.6f}",
             "IssTotNtv": f"{7200 * 0.5 ** (i // 1460):.6f}", "FeeTotNtv": f"{30 + 25 * math.sin(i / 50.0):.6f}", "HashRate": f"{0.5 * math.exp(0.0035 * i) * (1 + 0.1 * math.sin(i / 9.0)):.9f}",
             "AdrActCnt": str(int(20000 + 110 * i + 30000 * math.sin(i / 40.0) ** 2)), "TxCnt": str(int(5000 + 70 * i)), "TxTfrCnt": str(int(9000 + 130 * i)),
             "FlowInExNtv": f"{fin:.6f}" if flow else None, "FlowOutExNtv": f"{fout:.6f}" if flow else None, "SplyExNtv": f"{reserve:.6f}" if flow else None}
        if asset == "eth":
            r.pop("HashRate")
        if i >= n - 3:
            r["FlowInExNtv-status"] = "flash"
        rows.append(r)
    return rows


LAST = (datetime.fromtimestamp(NOW / 1000, UTC) - timedelta(days=1)).strftime("%Y-%m-%d")
N_BTC = (datetime.strptime(LAST, "%Y-%m-%d") - datetime(2010, 7, 18)).days + 1
N_ETH = (datetime.strptime(LAST, "%Y-%m-%d") - datetime(2015, 8, 8)).days + 1
STAMP = datetime.fromtimestamp(NOW / 1000, UTC).replace(microsecond=0)
FILES = {"btc": OC.build("btc", cm_rows("btc", N_BTC, "2010-07-18"), STAMP), "eth": OC.build("eth", cm_rows("eth", N_ETH, "2015-08-08"), STAMP)}
SUM = {a: FILES[a]["summary"] for a in FILES}
COLS = {a: OC.unpack(FILES[a])[2] for a in FILES}


def chain(route):
    a = "btc" if "chain_btc" in route.request.url else "eth"
    if "chain" in DOWN:
        return route.fulfill(status=404, content_type="text/html", body="<h1>404</h1>")
    if "chain500" in DOWN:
        return route.abort()
    route.fulfill(status=200, content_type="application/json", body=json.dumps(FILES[a], separators=(",", ":")))


def new_page(br, w, h, lang, mobile=False):
    """like obs_e2e.new_page, without the site's service worker: it would fetch /data/…json itself, past the mock"""
    ctx = br.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile, accept_downloads=True, service_workers="block")
    ctx.grant_permissions(["clipboard-read", "clipboard-write"])
    page = ctx.new_page()
    errors = []
    page.add_init_script(E.lang_init(lang))
    E.wire(page, errors)
    page.route("https://www.deribit.com/**", deribit)
    page.route(re.compile(r".*/data/obs/chain_(btc|eth)\.json.*"), chain)
    return ctx, page, errors


def wait_op(page, timeout=30000):
    page.wait_for_function("() => window.OB && OB._op && OB._op.V.book && !OB._op.V.loading", timeout=timeout)
    page.wait_for_timeout(300)


def wait_ch(page, timeout=30000):
    page.wait_for_function("() => window.OB && OB._ch && OB._ch.V.D && !OB._ch.V.loading", timeout=timeout)
    page.wait_for_timeout(300)


R2 = 0.0051            # a figure shown with two decimals stands up to half a hundredth from the exact one, whatever its size (the made-up series moves on a day every day)


def tiles(page):
    return page.evaluate("() => [...document.querySelectorAll('#ob-tiles .ob-tile')].map(t => ({l: t.querySelector('small').textContent, v: t.querySelector('b').textContent, s: (t.querySelector('span') || {}).textContent || ''}))")


def num(txt):
    """'$4.48B' → 4.48e9 · '-14.3%' → -14.3 · '2.72M BTC' → 2.72e6 · '—' → None"""
    m = re.search(r"([-+]?)\$?([\d,]*\.?\d+)([KMBT]?)(?![A-Za-z])", txt.replace("\u2066", "").replace("\u2069", ""))
    if not m:
        return None
    v = float(m.group(2).replace(",", "")) * {"": 1, "K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}[m.group(3)]
    return -v if m.group(1) == "-" else v


def clicks(page, sel, val):
    page.click(f"{sel} button[data-v='{val}']")
    page.wait_for_timeout(250)


def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name + ".png"))


def run():
    srv, port = E.serve()
    base = f"http://127.0.0.1:{port}"
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path="/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None, args=["--no-sandbox"])

        # ============================================================ options
        if not ONLY or ONLY == "options":
            print("[options]")
            X = expected_book("BTC")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/options/")
            wait_op(page)
            t = tiles(page)
            tot = X["c"] + X["p"]
            check("four tiles", len(t) == 4, t)
            check("tile 1: total open interest in dollars = coins × index", near(num(t[0]["v"]), tot * 70000, 0.006), (t[0], tot * 70000))
            check("tile 1: coins, calls and puts", all(near(a, b, 0.006) for a, b in zip([num(x) for x in t[0]["s"].split("·")], [tot, X["c"], X["p"]])), t[0]["s"])
            check("tile 2: put/call by open interest; by volume it is twice that (mock: put volume = OI/5, call volume = OI/10)",
                  near(num(t[1]["v"]), X["p"] / X["c"], 0.01) and near(num(t[1]["s"].split(":")[-1]), 2 * X["p"] / X["c"], 0.01), t[1])
            dv_now = round(dvol_close("BTC", NOW // H * H), 2)
            check("tile 3: DVOL = the last hourly close", near(num(t[2]["v"]), dv_now, 0.003), (t[2], dv_now))
            check("tile 4: max pain of the first expiry above 500 coins (the second): 60,000, 14.3 % under the index", "$60,000" in t[3]["v"] and near(num(t[3]["s"]), -14.2857, 0.01), t[3])
            st = page.evaluate("() => { const o = OB._op.V.chart.o; return {cats: o.cats, c: o.series[0].data, p: o.series[1].data, marks: o.vmarks.map(m => [m.pos, m.label]), stacked: o.stacked}; }")
            # all expiries, near the price: strikes 0.6–1.5 × 70,000 that hold anything
            agg = {}
            for x in X["exps"]:
                for K, c, pp in x["st"]:
                    a = agg.setdefault(K, [0, 0])
                    a[0] += c
                    a[1] += pp
            nearks = [K for K in sorted(agg) if 42000 <= K <= 105000 and sum(agg[K]) > 0]
            check("strike view: strikes near the price that hold open interest", st["cats"] == [f"{K // 1000}K" for K in nearks], st["cats"])
            check("strike view: calls and puts per strike, summed over expiries", st["c"] == [agg[K][0] for K in nearks] and st["p"] == [agg[K][1] for K in nearks], (st["c"], st["p"]))
            check("strike view: the index price sits on its strike", near(st["marks"][0][0], nearks.index(70000)) and "$70,000" in st["marks"][0][1] and len(st["marks"]) == 1, st["marks"])
            check("the chart has colours", E.colours(page) > 6, E.colours(page))
            shot(page, "options-strike-en-1280")
            clicks(page, "#ob-w", "all")
            st2 = page.evaluate("() => OB._op.V.chart.o.cats")
            check("all strikes: the far wings appear", st2[0] == "20K" and st2[-1] == "150K" and len(st2) == len([K for K in agg if sum(agg[K]) > 0]), st2)
            clicks(page, "#ob-w", "near")
            clicks(page, "#ob-u", "usd")
            usd = page.evaluate("() => OB._op.V.chart.o.series[0].data")
            check("unit dollars: every bar × the index", all(near(a, b * 70000) for a, b in zip(usd, [agg[K][0] for K in nearks])), usd[:3])
            clicks(page, "#ob-u", "coin")
            # one expiry
            page.select_option("#ob-exp", EXP[1][0])
            page.wait_for_timeout(250)
            one = page.evaluate("() => { const o = OB._op.V.chart.o; return {cats: o.cats, c: o.series[0].data, p: o.series[1].data, marks: o.vmarks.map(m => [m.pos, m.label])}; }")
            check("one expiry: its own strikes", one["cats"] == ["60K", "70K", "80K"] and one["c"] == [400, 300, 0] and one["p"] == [0, 100, 300], one)
            check("one expiry: max pain marked at 60,000", len(one["marks"]) == 2 and "$60,000" in one["marks"][1][1] and near(one["marks"][1][0], 0), one["marks"])
            shot(page, "options-strike-one-en-1280")
            # tooltip
            box = page.locator("#ob-ts canvas").bounding_box()
            page.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.5)
            page.wait_for_timeout(200)
            tip = page.inner_text("#ob-ts .ob-tip")
            check("pointing at a strike reads out its calls, puts and ratio", "$70,000" in tip and "300" in tip and "100" in tip and "0.33" in tip, tip)
            # table
            rows = page.evaluate("() => [...document.querySelectorAll('#ob-etbl tbody tr')].map(r => [...r.cells].map(c => c.textContent))")
            check("table: one row per expiry", len(rows) == 4, len(rows))
            ok_rows = True
            for r, x in zip(rows, X["exps"]):
                ok_rows &= near(num(r[2]), x["c"], 0.006) and near(num(r[3]), x["p"], 0.006) and near(num(r[4]), x["pc"], 0.012) and f"${x['mp']:,.0f}" in r[6] and near(num(r[7]), x["iv"], 0.003)
            check("table: calls, puts, put/call, max pain and ATM IV of every expiry", ok_rows, rows)
            check("table: first expiry's max pain is the lowest strike of its tie (65,000), second's is 60,000", "$65,000" in rows[0][6] and "$60,000" in rows[1][6], [r[6] for r in rows])
            check("table: notional = coins × index", near(num(rows[1][5]), 1100 * 70000, 0.006), rows[1][5])
            check("table: the chosen expiry is marked", page.evaluate("() => document.querySelector('#ob-etbl tr.on td').textContent").strip() != "")
            # expiry view
            clicks(page, "#ob-v", "expiry")
            ex = page.evaluate("() => { const o = OB._op.V.chart.o; return {n: o.cats.length, c: o.series[0].data, p: o.series[1].data, stacked: o.stacked}; }")
            check("expiry view: stacked calls and puts of the four expiries", ex["stacked"] and ex["n"] == 4 and ex["c"] == [x["c"] for x in X["exps"]] and ex["p"] == [x["p"] for x in X["exps"]], ex)
            shot(page, "options-expiry-en-1280")
            page.click(f"#ob-etbl button[data-exp='{EXP[2][0]}']")
            page.wait_for_timeout(300)
            check("a click on an expiry opens its strikes", page.evaluate("() => OB._op.S.view + ':' + OB._op.S.exp") == "strike:" + EXP[2][0])
            # DVOL
            n0 = len(REQ)
            clicks(page, "#ob-v", "dvol")
            page.wait_for_function("() => OB._op.V.kind === 'ts' && OB._op.V.chart.P.length === 2", timeout=20000)
            dv = page.evaluate("() => { const P = OB._op.V.chart.P; return {n: P[1].series[0].data.length, last: P[1].series[0].data.slice(-1)[0], px: P[0].series[0].data.length, type: P[1].series[0].type}; }")
            check("DVOL view (3 months): 12-hour candles under the daily index price", dv["type"] == "candle" and 180 <= dv["n"] <= 184 and 90 <= dv["px"] <= 92, dv)
            check("DVOL: the last candle is the mock's", near(dv["last"][4], round(dvol_close("BTC", dv["last"][0]), 2)), dv["last"])
            r3 = [r for r in REQ[n0:] if r[0] == "get_volatility_index_data"]
            check("DVOL: one request at 43200 for 3 months", len(r3) == 1 and r3[0][1]["resolution"] == "43200", r3)
            shot(page, "options-dvol-en-1280")
            n0 = len(REQ)
            clicks(page, "#ob-r", "all")
            page.wait_for_function("() => OB._op.V.chart.P.length === 2 && OB._op.V.chart.P[1].series[0].data.length > 1500", timeout=30000)
            dv = page.evaluate("() => { const a = OB._op.V.chart.P[1].series[0].data; let dup = 0, ord = true; for (let i = 1; i < a.length; i++) { if (a[i][0] === a[i-1][0]) dup++; if (a[i][0] < a[i-1][0]) ord = false; } return {n: a.length, dup, ord, first: a[0][0], px: OB._op.V.chart.P[0].series[0].data.length}; }")
            days_all = (NOW - int(datetime(2021, 3, 24, tzinfo=UTC).timestamp() * 1000)) // D
            check("DVOL all: every daily candle since March 2021, paged back, in order, none twice", abs(dv["n"] - days_all) <= 2 and dv["dup"] == 0 and dv["ord"], (dv, days_all))
            pages = [r for r in REQ[n0:] if r[0] == "get_volatility_index_data"]
            check("DVOL all: paged with the continuation Deribit returns", len(pages) == math.ceil(days_all / 1000) and all(r[1]["resolution"] == "1D" for r in pages), len(pages))
            check("DVOL all: delivery prices 100 a page", abs(dv["px"] - days_all) <= 2 and all(r[1]["count"] == "100" for r in REQ[n0:] if r[0] == "get_delivery_prices"), dv["px"])
            # share link and PNG
            page.click("#ob-share")
            page.wait_for_timeout(300)
            link = page.evaluate("() => navigator.clipboard.readText()")
            check("share link carries coin, view and range", "coin=BTC" in link and "view=dvol" in link and "range=all" in link, link)
            with page.expect_download() as dl:
                page.click("#ob-png")
            check("PNG download", dl.value.suggested_filename == "entekhab-options-BTC-dvol.png", dl.value.suggested_filename)
            # Ether
            clicks(page, "#ob-v", "strike")
            clicks(page, "#ob-as", "ETH")
            wait_op(page)
            XE = expected_book("ETH")
            te = tiles(page)
            check("Ether: its own book and index", near(num(te[0]["v"]), (XE["c"] + XE["p"]) * 2000, 0.006) and near(num(te[2]["v"]), round(dvol_close("ETH", NOW // H * H), 2), 0.003), te)
            check("Ether: decimal strikes are read (1714.29 → 1.71K)", page.evaluate("() => OB._op.V.book.exps[1].maxPain") == 60000 / 35)
            check("zero JS errors (options)", not errors, errors[:3])
            ctx.close()
            # a link opens the view it names
            ctx, page, errors = new_page(br, 1280, 900, "fa")
            page.goto(base + f"/charts/options/?coin=ETH&view=expiry")
            wait_op(page)
            check("a shared link opens that coin and view", page.evaluate("() => OB._op.S.cur + ':' + OB._op.S.view + ':' + OB._op.V.chart.o.stacked") == "ETH:expiry:true")
            shot(page, "options-expiry-fa-1280")
            check("zero JS errors (options link)", not errors, errors[:3])
            ctx.close()

        # ============================================================ on-chain pages
        if not ONLY or ONLY == "chain":
            print("[chain]")
            S = SUM["btc"]
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/mvrv/")
            wait_ch(page)
            t = tiles(page)
            check("mvrv: tiles show MVRV, realized price, NUPL and Z of the last day (the Python summary's figures)",
                  near(num(t[0]["v"]), S["mvrv"], 0.004, R2) and near(num(t[1]["v"]), S["rprice"], 0.002) and near(num(t[2]["v"]), S["nupl"], 0.02, R2) and near(num(t[3]["v"]), S["mvrvz"], 0.01, R2), (t, S["mvrv"], S["rprice"], S["nupl"], S["mvrvz"]))
            check("mvrv: the rank beside MVRV", near(num(t[0]["s"]), S["mvrv_pct"], 0.02, 0.6), (t[0]["s"], S["mvrv_pct"]))
            check("mvrv: price against the realized price", near(num(t[1]["s"]), (S["price"] / S["rprice"] - 1) * 100, 0.02, 0.06), t[1]["s"])
            P = page.evaluate("() => OB._ch.V.ts.P.map(p => ({log: !!p.log, zones: (p.zones || []).length, marks: (p.marks || []).length, s: p.series.map(s => [s.type, s.data.length, s.data[s.data.length - 1][1]])}))")
            n_px = sum(1 for x in COLS["btc"]["price"] if x is not None)
            check("mvrv: price pane (log) with the realized price, MVRV pane with its two bands", len(P) == 2 and P[0]["log"] and len(P[0]["s"]) == 2 and P[1]["zones"] == 2 and P[1]["marks"] == 2, P)
            check("mvrv: every day of the file is drawn", P[0]["s"][0][1] == n_px and P[1]["s"][0][1] == n_px, (P[0]["s"][0][1], n_px))
            check("mvrv: last points = the last day's price, realized price and MVRV", near(P[0]["s"][0][2], S["price"]) and near(P[0]["s"][1][2], S["rprice"]) and near(P[1]["s"][0][2], S["mvrv"]), P)
            v = page.evaluate("() => { const t = OB._ch.V.ts; return [t.v.x0, t.v.x1, t.t1]; }")
            check("range 4 years: the window ends on the last day and spans four years", near(v[2] - v[0], 4 * 365.25 * D, 0.001), (v[2] - v[0]) / D)
            check("the note names the source, the licence and the last day", "Coin Metrics" in page.inner_text("#ob-note") and "CC BY-NC" in page.inner_text("#ob-note"))
            shot(page, "mvrv-en-1280")
            for m, k, panes in (("z", "mvrvz", 2), ("nupl", "nupl", 2), ("caps", None, 1)):
                clicks(page, "#ob-m", m)
                P = page.evaluate("() => OB._ch.V.ts.P.map(p => ({zones: (p.zones || []).length, s: p.series.map(s => [s.data.length, s.data[s.data.length - 1][1]])}))")
                okv = True if k is None else near(P[1]["s"][0][1], S[k])
                check(f"mvrv page, measure {m}: {panes} pane(s), last value right", len(P) == panes and okv, P)
                if m == "nupl":
                    check("NUPL: five named bands", P[1]["zones"] == 5)
                    shot(page, "nupl-en-1280")
                if m == "caps":
                    check("market and realized value: last points", near(P[0]["s"][0][1], S["mcap"]) and near(P[0]["s"][1][1], S["rcap"]), P)
            clicks(page, "#ob-r", "all")
            v = page.evaluate("() => { const t = OB._ch.V.ts; return [t.v.x0, t.t0]; }")
            check("range all: from the first day", v[0] == v[1], v)
            clicks(page, "#ob-sc", "lin")
            check("linear scale", page.evaluate("() => OB._ch.V.ts.P[0].log") is False)
            clicks(page, "#ob-sc", "log")
            clicks(page, "#ob-r", "1y")
            page.click("#ob-share")
            page.wait_for_timeout(300)
            link = page.evaluate("() => navigator.clipboard.readText()")
            check("share link carries asset, measure and range", "asset=btc" in link and "m=caps" in link and "range=1y" in link, link)
            with page.expect_download() as dl:
                page.click("#ob-png")
            check("PNG download", dl.value.suggested_filename == "entekhab-caps-BTC.png", dl.value.suggested_filename)
            clicks(page, "#ob-as", "eth")
            wait_ch(page)
            te = tiles(page)
            check("Ether: its own file", near(num(te[0]["v"]), SUM["eth"]["mvrv"], 0.004, R2) and near(num(te[1]["v"]), SUM["eth"]["rprice"], 0.002), (te, SUM["eth"]["mvrv"], SUM["eth"]["rprice"]))
            check("zero JS errors (mvrv)", not errors, errors[:3])
            ctx.close()

            # ---- exchange flows
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/exchange-flows/")
            wait_ch(page)
            t = tiles(page)
            check("flows: reserve, its 30-day change, last day's and 7 days' net flow",
                  near(num(t[0]["v"]), S["sex"], 0.006) and near(num(t[1]["v"]), S["sex_chg30"], 0.02, 600) and near(num(t[2]["v"]), S["net1"], 0.02, 60) and near(num(t[3]["v"]), S["net7"], 0.02, 600), (t, S["sex"], S["sex_chg30"], S["net1"], S["net7"]))
            check("flows: reserve in dollars and as a share of the supply", near(num(t[0]["s"].split("·")[0]), S["sex_usd"], 0.01) and near(num(t[0]["s"].split("·")[1]), S["sex_share"], 0.01, 0.06), t[0]["s"])
            check("flows: which way the last day went", ("to exchanges" in t[2]["s"]) == (S["net1"] >= 0), t[2]["s"])
            P = page.evaluate("() => OB._ch.V.ts.P.map(p => p.series.map(s => [s.type, s.data.length, s.data[s.data.length - 1][1]]))")
            n_fl = sum(1 for x in COLS["btc"]["sex"] if x is not None)
            check("flows (reserve): price, reserve as an area, share of supply", len(P) == 3 and P[1][0][0] == "area" and P[1][0][1] == n_fl and near(P[1][0][2], S["sex"]) and near(P[2][0][2], S["sex_share"]), P)
            rows = page.evaluate("() => [...document.querySelectorAll('#ob-ftbl tbody tr')].map(r => [...r.cells].map(c => c.textContent))")
            check("flows table: the last 14 days, newest first, with that day's figures", len(rows) == 14 and near(num(rows[0][1]), S["fin"], 0.006) and near(num(rows[0][2]), S["fout"], 0.006)
                  and near(num(rows[0][4]), S["sex"], 0.0001), rows[:1])
            shot(page, "flows-en-1280")
            clicks(page, "#ob-m", "net")
            P = page.evaluate("() => OB._ch.V.ts.P.map(p => p.series.map(s => [s.type, s.data.length, s.data[s.data.length - 1][1], s.neg || '']))")
            check("net flow: daily bars (two colours) and the 30-day sum", P[1][0][0] == "bars" and P[1][0][3] and near(P[1][0][2], S["net1"]) and near(P[2][0][2], S["net30"]), P[1:])
            shot(page, "netflow-en-1280")
            clicks(page, "#ob-m", "inout")
            P = page.evaluate("() => OB._ch.V.ts.P.map(p => p.series.map(s => s.data.length))")
            check("inflow and outflow: two lines of 7-day averages", len(P) == 2 and len(P[1]) == 2 and P[1][0] == n_fl - 6, P)
            check("zero JS errors (flows)", not errors, errors[:3])
            ctx.close()

            # ---- network
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/network/")
            wait_ch(page)
            t = tiles(page)
            check("network: five tiles for Bitcoin", len(t) == 5, t)
            check("network: active addresses, transactions, hash rate, miner revenue, Puell",
                  near(num(t[0]["v"]), S["adr7"], 0.006) and near(num(t[1]["v"]), S["tx7"], 0.006) and near(num(t[2]["v"]), S["hash"], 0.002) and near(num(t[3]["v"]), S["rev_usd"], 0.01) and near(num(t[4]["v"]), S["puell"], 0.01, R2),
                  (t, S["adr7"], S["tx7"], S["hash"], S["rev_usd"], S["puell"]))
            check("network: the ribbon line says which average is on top", ("above" in t[2]["s"]) == (S["hash30"] >= S["hash60"]), t[2]["s"])
            ms = page.evaluate("() => [...document.querySelectorAll('#ob-m button')].map(b => b.dataset.v)")
            check("network: six measures for Bitcoin", ms == ["adr", "tx", "hash", "rev", "puell", "s2f"], ms)
            for m in ms:
                clicks(page, "#ob-m", m)
                P = page.evaluate("() => OB._ch.V.ts.P.map(p => p.series.map(s => [s.data.length, s.data[s.data.length - 1][1]]))")
                last = P[1][1][1] if m == "adr" else P[1][0][1]                    # active addresses: the second line is the 7-day average
                want = {"adr": S["adr7"], "tx": S["tx7"], "hash": S["hash"], "rev": S["rev_usd"], "puell": S["puell"], "s2f": S["s2f"]}[m]
                check(f"network, measure {m}: drawn to the last day", near(last, want, 1e-6), (last, want))
                if m in ("hash", "puell"):
                    shot(page, f"{m}-en-1280")
            clicks(page, "#ob-as", "eth")
            wait_ch(page)
            ms = page.evaluate("() => [...document.querySelectorAll('#ob-m button')].map(b => b.dataset.v)")
            check("network, Ether: no hash rate, miner revenue, Puell or stock-to-flow on offer; the page falls back to the first measure", ms == ["adr", "tx"] and page.evaluate("() => OB._ch.S.m_network") == "adr", ms)
            check("network, Ether: two tiles (addresses, transactions) — nothing about miners", len(tiles(page)) == 2, tiles(page))
            check("zero JS errors (network)", not errors, errors[:3])
            ctx.close()

        # ============================================================ the cycle page
        if not ONLY or ONLY == "cycle":
            print("[cycle]")
            S = SUM["btc"]
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/bitcoin-cycle/")
            wait_ch(page)
            t = tiles(page)
            check("cycle: price, Mayer, 200-week ratio, drawdown", near(num(t[0]["v"]), S["price"], 0.002) and near(num(t[1]["v"]), S["mayer"], 0.01, R2) and near(num(t[2]["v"]), S["w200"], 0.01, R2) and near(num(t[3]["v"]), S["dd"], 0.02, 0.06), (t, S["mayer"], S["w200"], S["dd"]))
            check("cycle: no asset switch (Bitcoin only)", page.locator("#ob-as").count() == 0)
            rows = page.evaluate("() => [...document.querySelectorAll('#ob-ctbl tbody tr')].map(r => [...r.cells].map(c => c.textContent))")
            names = [r[0] for r in rows]
            check("cycle table: nine measures", len(rows) == 9, names)
            want = [("mayer", 1), ("w200", 1), ("pi", 1), ("y2", 1), ("mvrv", 1), ("mvrvz", 1), ("puell", 1)]
            ok = all(near(num(r[1]), S[k], 0.012, 0.006) and near(num(r[4]), S[k + "_pct"], 0.02, 0.6) for r, (k, _) in zip(rows, want))
            check("cycle table: every value and rank equals the Python summary", ok, [(r[1], r[4]) for r in rows[:7]])
            import importlib
            zone = lambda k, v: {"mayer": (0.8, 2.4), "w200": (1, None), "pi": (None, 1), "y2": (1, 5), "mvrv": (1, 3.7), "mvrvz": (0, 7), "puell": (0.5, 4)}[k]  # noqa: E731
            st_ok = True
            for r, (k, _) in zip(rows, want):
                lo, hi = zone(k, S[k])
                state = "above" if hi is not None and S[k] >= hi else "below" if lo is not None and S[k] <= lo else "between"
                st_ok &= state in r[3]
            check("cycle table: where each measure stands against its bands", st_ok, [r[3] for r in rows[:7]])
            check("cycle table: NUPL with its band's name and the drawdown", near(num(rows[7][1]), S["nupl"], 0.03, 0.006) and rows[7][3].strip() != "" and near(num(rows[8][1]), S["dd"], 0.02, 0.06), rows[7:])
            shot(page, "cycle-mayer-en-1280")
            for m, n_series in (("w200", 2), ("pi", 3), ("y2", 3), ("gold", 5), ("dd", 1)):
                clicks(page, "#ob-m", m)
                P = page.evaluate("() => OB._ch.V.ts.P.map(p => ({n: p.series.length, last: p.series.map(s => s.data[s.data.length - 1][1]), max: p.max}))")
                check(f"cycle, measure {m}: {n_series} line(s) on the price pane", P[0]["n"] == n_series, P)
                if m == "pi":
                    check("Pi cycle: 111-day average and twice the 350-day one, and their ratio below", near(P[0]["last"][1], S["ma111"]) and near(P[0]["last"][2], 2 * S["ma350"]) and near(P[1]["last"][0], S["pi"]), P)
                    shot(page, "cycle-pi-en-1280")
                if m == "y2":
                    check("2-year lines: the average and five times it", near(P[0]["last"][1], S["ma730"]) and near(P[0]["last"][2], 5 * S["ma730"]), P)
                if m == "gold":
                    check("golden ratio: 350-day average × 1, 1.6, 3, 5", all(near(P[0]["last"][i + 1], S["ma350"] * f) for i, f in enumerate((1, 1.6, 3, 5))), P)
                if m == "dd":
                    check("drawdown: an area that never rises above zero", near(P[1]["last"][0], S["dd"]) and P[1]["max"] == 0, P)
                    shot(page, "cycle-dd-en-1280")
            check("zero JS errors (cycle)", not errors, errors[:3])
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "fa")
            page.goto(base + "/charts/mvrv/?asset=eth&m=nupl&range=2y")
            wait_ch(page)
            check("a shared link opens that asset, measure and range", page.evaluate("() => OB._ch.S.asset + ':' + OB._ch.S.m_mvrv + ':' + OB._ch.S.range") == "eth:nupl:2y")
            check("zero JS errors (link)", not errors, errors[:3])
            ctx.close()

        # ============================================================ four languages, two widths
        if not ONLY or ONLY == "langs":
            print("[langs]")
            for lang in ("fa", "ckb", "ar", "en"):
                for w, h, mob in ((1280, 900, False), (390, 800, True)):
                    ctx, page, errors = new_page(br, w, h, lang, mob)
                    for path, wait in (("/charts/options/", wait_op), ("/charts/mvrv/", wait_ch), ("/charts/exchange-flows/", wait_ch), ("/charts/network/", wait_ch), ("/charts/bitcoin-cycle/", wait_ch)):
                        page.goto(base + path)
                        wait(page)
                        name = path.strip("/").split("/")[-1]
                        check(f"{lang} {w}px {name}: no sideways scroll", overflow(page) <= 1, overflow(page))
                        check(f"{lang} {w}px {name}: fourteen tabs, this one marked", page.locator(".ob-tab").count() == 14 and page.locator(".ob-tab.on").count() == 1)
                        vis = page.evaluate("() => [...document.querySelectorAll('#ob-main h1 [data-lang]')].filter(e => !e.hidden).map(e => e.getAttribute('data-lang'))")
                        check(f"{lang} {w}px {name}: the heading is in {lang}", vis == [lang], vis)
                        txt = page.inner_text("#ob-view")
                        if lang != "en":
                            lat = re.findall(r"\b(?:Measure|Range|Scale|Asset|View|Expiry|Strikes|Unit|Calls|Puts|Loading|Source)\b", txt)
                            check(f"{lang} {w}px {name}: no English label left", not lat, lat[:4])
                        check(f"{lang} {w}px {name}: the chart is drawn", E.colours(page) > 5, E.colours(page))
                        if mob:
                            check(f"{lang} {w}px {name}: tiles two a row, inside the screen", page.evaluate("() => [...document.querySelectorAll('.ob-tile')].every(t => t.getBoundingClientRect().right <= innerWidth + 1)"))
                        shot(page, f"{name}-{lang}-{w}")
                    if mob:
                        # the measure picker on a phone is a select; the settings open with the gear
                        page.goto(base + "/charts/bitcoin-cycle/")
                        wait_ch(page)
                        check(f"{lang} phone: measure is a select, the segments are hidden", page.locator("#ob-msel").is_visible() and not page.locator("#ob-m").is_visible())
                        page.select_option("#ob-msel", "pi")
                        page.wait_for_timeout(250)
                        check(f"{lang} phone: choosing a measure redraws", page.evaluate("() => OB._ch.S.m_cycle + ':' + OB._ch.V.ts.P[0].series.length") == "pi:3")
                        check(f"{lang} phone: range is behind the gear", not page.locator("#ob-r").is_visible())
                        page.click("#ob-gear")
                        page.wait_for_timeout(200)
                        check(f"{lang} phone: the gear opens range and scale", page.locator("#ob-r").is_visible() and page.locator("#ob-sc").is_visible() and overflow(page) <= 1)
                        shot(page, f"cycle-gear-{lang}-390")
                    check(f"{lang} {w}px: zero JS errors", not errors, errors[:3])
                    ctx.close()

        # ============================================================ when the data is missing
        if not ONLY or ONLY == "errors":
            print("[errors]")
            ctx, page, errors = new_page(br, 1280, 900, "fa")
            DOWN.add("chain")
            page.goto(base + "/charts/mvrv/")
            page.wait_for_selector("#ob-status.err", timeout=20000)
            msg = page.inner_text("#ob-status")
            check("no data file yet (404): the page says so and offers to try again", "هنوز" in msg and page.locator("#ob-retry").count() == 1, msg)
            check("no figures are shown without data", page.locator("#ob-tiles .ob-tile").count() == 0)
            shot(page, "mvrv-nofile-fa")
            DOWN.discard("chain")
            page.click("#ob-retry")
            wait_ch(page)
            check("try again loads the file", page.locator("#ob-tiles .ob-tile").count() == 4 and page.evaluate("() => document.querySelector('#ob-status').hidden"))
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "en")
            DOWN.add("chain500")
            page.goto(base + "/charts/network/")
            page.wait_for_selector("#ob-status.err", timeout=20000)
            check("the file cannot be read (network): its own message", "did not load" in page.inner_text("#ob-status"), page.inner_text("#ob-status"))
            DOWN.discard("chain500")
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "en")
            DOWN.add("deribit")
            page.goto(base + "/charts/options/")
            page.wait_for_selector("#ob-status.err", timeout=20000)
            check("Deribit unreachable: the page names it and offers to try again", "Deribit" in page.inner_text("#ob-status") and page.locator("#ob-retry").count() == 1, page.inner_text("#ob-status"))
            check("no tiles without a book", page.locator("#ob-tiles .ob-tile").count() == 0)
            shot(page, "options-down-en")
            DOWN.discard("deribit")
            page.click("#ob-retry")
            wait_op(page)
            check("try again loads the book", page.locator("#ob-tiles .ob-tile").count() == 4)
            # DVOL alone fails: the book stays, the tile says nothing instead of a stale or made-up number
            DOWN.add("dvol")
            page.reload()
            wait_op(page)
            t = tiles(page)
            check("DVOL missing: its tile is empty, the rest stands", t[2]["v"] == "—" and "$" in t[0]["v"], t)
            clicks(page, "#ob-v", "dvol")
            page.wait_for_selector("#ob-status.err", timeout=20000)
            check("DVOL view without DVOL: an error, not an empty chart", page.locator("#ob-retry").count() == 1)
            DOWN.discard("dvol")
            # the delivery prices alone fail: DVOL is drawn without the price pane
            DOWN.add("delivery")
            page.click("#ob-retry")
            page.wait_for_function("() => OB._op.V.kind === 'ts' && OB._op.V.chart.P.length === 1", timeout=20000)
            check("index prices missing: DVOL alone is drawn", page.evaluate("() => OB._op.V.chart.P[0].series[0].type") == "candle")
            DOWN.discard("delivery")
            ctx.close()

        # ============================================================ the hub
        if not ONLY or ONLY == "hub":
            print("[hub]")
            ctx, page, errors = new_page(br, 1280, 900, "fa")
            page.goto(base + "/charts/")
            page.wait_for_timeout(600)
            links = page.evaluate("() => [...document.querySelectorAll('section:not([hidden]) a.ob-hc')].map(a => a.getAttribute('href'))")
            for pth in ("/charts/options/", "/charts/mvrv/", "/charts/exchange-flows/", "/charts/network/", "/charts/bitcoin-cycle/"):
                check(f"hub links {pth}", pth in links and os.path.exists(os.path.join(ROOT, pth.strip('/'), "index.html")))
            soon = page.evaluate("() => [...document.querySelectorAll('section:not([hidden]) .ob-hc.soon')].length")
            check("hub: three items in the works, none of them a link, and no list of what free data cannot give (the owner had it removed)", soon == 3 and "SOPR" not in page.inner_text("main") and page.locator("section:not([hidden]) a.ob-hc.soon").count() == 0, soon)
            check("hub: no sideways scroll", overflow(page) <= 1)
            shot(page, "hub-fa-1280")
            check("zero JS errors (hub)", not errors, errors[:3])
            ctx.close()
        br.close()
    srv.shutdown()
    print(f"\nobservatory stage 3: {len(E.OK)} passed, {len(E.FAIL)} failed   (screenshots in {SHOTS})")
    for f in E.FAIL:
        print("  FAIL", f)
    return 1 if E.FAIL else 0


if __name__ == "__main__":
    sys.exit(run())
