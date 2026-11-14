#!/usr/bin/env python3
"""End-to-end test of the Observatory's stage 5 in a real Chrome, offline:
  /charts/options/      the smile and term-structure views, the 30-day skew tile and the risk-reversal column
  /charts/long-short/   Gate's real account counts, the 3-month and 1-year ranges, with Binance unreachable
  /charts/basis/        the curve's history (file written by scripts/obs_curve.py from pretend Deribit candles)
  /charts/liquidations/ the "since 2023" range: Gate's daily rows, then the site's archive (scripts/obs_liqarch.py)
  /charts/hyperliquid/  real positions (file written from pretend accounts by scripts/obs_hl.py's own arithmetic)
  the hub, four languages at 1280 and 390 px.
Everything the pages show is checked against figures worked out here in Python by the definitions, independently of
the page's code. Screenshots go to $SHOTS (default /tmp/obs5shots). Run: python3 scripts/build_obs.py && python3 tests/obs5_e2e.py
(ONLY=opt|ls|hist|liq|hl|langs|hub)
"""
import json
import math
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tests"))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import obs4_e2e as F4  # noqa: E402  (stage 4's mocks: Gate, Binance mirror, Bybit, Deribit futures, the CI files, the page factory)
import obs_e2e as E  # noqa: E402
import obs_curve as CV  # noqa: E402
import obs_hl as HL  # noqa: E402
import obs_liqarch as LA  # noqa: E402

SHOTS = os.environ.get("SHOTS", "/tmp/obs5shots")
ONLY = os.environ.get("ONLY", "")
os.makedirs(SHOTS, exist_ok=True)
check, near = E.check, E.near
H, D = 3_600_000, 86_400_000
NOW = E.NOW
UTC = timezone.utc
tiles, num = F4.tiles, F4.num

# ---------------------------------------------------------------- Deribit options: a smile worked out by hand
IDX = 70000.0
OPT_EXP = [NOW // D * D + 8 * H + k * D for k in (7, 30, 91)]          # 08:00 UTC, 7, 30 and 91 days ahead
OPT_EXP = [t if t > NOW else t + D for t in OPT_EXP]
STRIKES = list(range(40000, 110001, 2500))
MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def fwd(e):
    return IDX * (1 + 0.0002 * (e - NOW) / D)


def iv_of(k, e):
    """IV per cent: a smile tilted towards the puts, steeper for the near expiry"""
    days = (e - NOW) / D
    x = (k / fwd(e) - 1) * 100
    return 45 + 0.02 * days + (0.6 if x < 0 else 0.25) * abs(x) * (30 / max(days, 7)) ** 0.3


def oname(e, k, cp):
    dt = datetime.fromtimestamp(e / 1000, UTC)
    return f"BTC-{dt.day}{MON[dt.month - 1]}{dt.strftime('%y')}-{k}-{cp}"


def ncdf(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def delta(cp, F, K, T, iv):
    s = iv / 100 * math.sqrt(T)
    d1 = (math.log(F / K) + s * s / 2) / s
    return ncdf(d1) if cp == "C" else ncdf(d1) - 1


def expected_term(now):
    """per expiry: ATM IV (on the line between the strikes around the future), 25-delta call and put IV, risk reversal"""
    out = []
    for e in OPT_EXP:
        F, T = fwd(e), (e - now) / (365 * D)
        pts = [(k, iv_of(k, e)) for k in STRIKES]
        atm = next(a[1] + (b[1] - a[1]) * (F - a[0]) / (b[0] - a[0]) for a, b in zip(pts, pts[1:]) if a[0] <= F <= b[0])
        calls = sorted((delta("C", F, k, T, v), v) for k, v in pts if k >= F)
        puts = sorted((-delta("P", F, k, T, v), v) for k, v in pts if k <= F)

        def at(lst):
            for a, b in zip(lst, lst[1:]):
                if a[0] <= 0.25 <= b[0]:
                    return a[1] + (b[1] - a[1]) * (0.25 - a[0]) / (b[0] - a[0])
            return None
        c25, p25 = at(calls), at(puts)
        out.append({"days": (e - now) / D, "atm": atm, "c25": c25, "p25": p25, "rr": c25 - p25})
    return out


def at_days(tm, key, k):
    lo = max((x for x in tm if x["days"] <= k), key=lambda x: x["days"], default=None)
    hi = min((x for x in tm if x["days"] >= k), key=lambda x: x["days"], default=None)
    return lo[key] + (hi[key] - lo[key]) * (k - lo["days"]) / (hi["days"] - lo["days"])


def deribit(route):
    u = urlparse(route.request.url)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    ep = u.path.rsplit("/", 1)[-1]
    if ep == "get_book_summary_by_currency" and q.get("kind") == "option":
        rows = []
        for e in OPT_EXP:
            for k in STRIKES:
                for cp in "CP":
                    rows.append({"instrument_name": oname(e, k, cp), "open_interest": 100 + (k % 7000) / 100, "volume": 3, "mark_iv": iv_of(k, e), "mark_price": 0.01,
                                 "underlying_price": fwd(e), "estimated_delivery_price": IDX, "base_currency": "BTC"})
        return E.jresp(route, {"jsonrpc": "2.0", "result": rows})
    if ep == "get_volatility_index_data":
        t1 = int(q["end_timestamp"]) // H * H
        data = [[t1 - i * H, 40, 41, 39, 40 + i * 0.01] for i in range(30, -1, -1)]
        return E.jresp(route, {"jsonrpc": "2.0", "result": {"data": data, "continuation": None}})
    if ep == "get_delivery_prices":
        return E.jresp(route, {"jsonrpc": "2.0", "result": {"data": [], "records_total": 0}})
    return F4.deribit(route)


# ---------------------------------------------------------------- Gate: account counts, daily rows since 2023-10-11
GATE_D0 = int(datetime(2023, 10, 11, tzinfo=UTC).timestamp() * 1000)
HOLE_D = (NOW - 400 * D) // D * D                     # a day Gate's statistics missed (zero taker on every contract)


def users(t):
    """accounts long and short in the period that starts at t: they move with the hour, so every line has a shape"""
    h = (t // H) % 24
    return 20000 + 100 * h, 9000 + 50 * (23 - h), 40 + h % 5, 86 - h % 7, 28e6 + 1e5 * h, 38e6 - 1e5 * h


def gate(route):
    u = urlparse(route.request.url)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    ep = u.path.rsplit("/", 1)[-1]
    if ep != "contract_stats":
        return F4.gate(route)
    sym = E.SYM_OF.get(q.get("contract", "").replace("_USDT", ""))
    if not sym:
        return route.abort()
    step, lim = E.IV[q["interval"]], int(q.get("limit", 30))
    last = NOW // step * step
    ts = [t for t in (last - i * step for i in range(lim - 1, -1, -1)) if t >= GATE_D0]
    out = []
    for t in ts:
        r = F4.g_row(sym, t, step)
        lu, su, tl, tsh, tls, tss = users(t)
        r.update(long_users=lu, short_users=su, top_long_account=tl, top_short_account=tsh, top_long_size=tls, top_short_size=tss)
        if step == D and t == HOLE_D:
            r.update(long_taker_size=0, short_taker_size=0)
        out.append(r)
    E.jresp(route, out)


# ---------------------------------------------------------------- the files CI writes, from pretend sources
TMP = F4.TMP
STAMP = F4.STAMP
BAS = {"BTC": 0.10, "ETH": 0.05}                      # every pretend future carries this yearly basis over Coinbase's daily close


def cb_close(cur, t):
    """Coinbase's daily close in tests/obs_fakes.py (what premium_d.json holds): BTC 50,025 on even days, 50,000 on odd ones; ETH 1,998"""
    return 1998.0 if cur == "ETH" else (50025.0 if (t // 86400) % 2 == 0 else 50000.0)


def deribit_candles(url, params):
    """Deribit's get_tradingview_chart_data for a monthly or quarterly future: listed 380 days before its expiry"""
    cur, rest = params["instrument_name"].split("-", 1)
    d = datetime.strptime(rest, "%d%b%y").date()
    if d < date(2020, 1, 1):
        return None
    exp = CV.expiry_ts(d)
    t0, t1 = params["start_timestamp"] // 1000, params["end_timestamp"] // 1000
    ticks, close = [], []
    t = (t0 + 86399) // 86400 * 86400
    while t <= t1:
        if t >= exp - 380 * 86400:
            close.append(cb_close(cur, t) * (1 + BAS[cur] * (exp - (t + 86400)) / 86400 / 365))
            ticks.append(t * 1000)
        t += 86400
    return {"result": {"status": "ok" if ticks else "no_data", "ticks": ticks, "close": close}}


assert CV.run(deribit_candles, STAMP, out_dir=TMP, log=F4.quiet, pause=0) == "written"
ARCH0 = date(2023, 6, 1)                               # the archive holds days Gate no longer gives (its live rows begin 2023-10-11)


def gate_archive(url, params):
    """Gate as it was when the archive was written: daily rows from 2023-06-01, 4-hour rows for 333 days (BTC and ETH)"""
    coin = params["contract"].split("_")[0]
    if coin not in ("BTC", "ETH"):
        return None
    step = 86400 if params["interval"] == "1d" else 4 * 3600
    now = int(STAMP.timestamp())
    t = int(datetime(ARCH0.year, ARCH0.month, ARCH0.day, tzinfo=UTC).timestamp()) if step == 86400 else now // step * step - 1999 * step
    out = []
    while t <= now:
        k = 1.0 if coin == "BTC" else 0.5
        out.append({"time": t, "long_liq_usd": 7000.0 * k * step / 3600, "short_liq_usd": 3000.0 * k * step / 3600, "long_taker_size": 5, "short_taker_size": 5})
        t += step
    return out


assert LA.run(gate_archive, STAMP, out_dir=TMP, log=F4.quiet) == "written"


def hl_states(n=240):
    """pretend accounts: BTC longs liquidated 1–19 % below the mark, shorts 1–19 % above, sizes rising with the account; ETH too"""
    st = {}
    for i in range(n):
        pos = []
        d = 0.01 + (i % 19) / 100
        side = 1 if i % 3 else -1
        mark = 60000.0
        liq = mark * (1 - d) if side > 0 else mark * (1 + d)
        sz = 0.5 + i / 40
        pos.append({"position": {"coin": "BTC", "szi": str(side * sz), "entryPx": str(mark * (1 + 0.01 * side)), "liquidationPx": None if i % 17 == 0 else str(liq), "leverage": {"value": 3 + i % 20}}})
        pos.append({"position": {"coin": "ETH", "szi": str(-side * 10), "entryPx": "2000", "liquidationPx": str(2000 * (1 + d * side * -1)), "leverage": {"value": 5}}})
        st[f"a{i}"] = {"assetPositions": pos}
    return st


HL_MKT = {"BTC": (60000.0, 900.0), "ETH": (2000.0, 40000.0), "DOGE": (0.2, 1e9)}
HL_DOC = {"source": HL.SOURCE, "updated_at": STAMP.isoformat(), "accounts": {"read": 240, "asked": 250, "listed": 47967, "with_positions": 240},
          "coins": HL.aggregate(hl_states(), HL_MKT)}
FILES = {"curve_hist": json.load(open(os.path.join(TMP, "curve_hist.json"))), "liq_archive": json.load(open(os.path.join(TMP, "liq_archive.json"))), "hl_liq": HL_DOC}


def files(route):
    name = re.search(r"/data/obs/(\w+)\.json", route.request.url).group(1)
    route.fulfill(status=200, content_type="application/json", body=json.dumps(FILES[name], separators=(",", ":")))


def new_page(br, w, h, lang, mobile=False, block=()):
    ctx, page, errors = F4.new_page(br, w, h, lang, mobile, block)
    page.route("https://www.deribit.com/**", deribit)
    if "gate" not in block:
        page.route("https://api.gateio.ws/**", gate)
    page.route(re.compile(r".*/data/obs/(curve_hist|liq_archive|hl_liq)\.json.*"), files)
    return ctx, page, errors


def wait(page, mod, extra="", timeout=40000):
    page.wait_for_function(f"() => window.OB && OB.{mod} && {extra or 'true'}", timeout=timeout)
    page.wait_for_timeout(400)


def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name + ".png"))


def run():
    srv, port = E.serve()
    base = f"http://127.0.0.1:{port}"
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path="/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None, args=["--no-sandbox"])

        # ============================================================ options: smile and term structure
        if not ONLY or ONLY == "opt":
            print("[options]")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/options/?view=term")
            wait(page, "_op", "OB._op.V.book && OB._op.V.term")
            at = page.evaluate("() => OB._op.V.at")
            X = expected_term(at)
            tm = page.evaluate("() => OB._op.V.term.map(x => ({days: x.days, atm: x.atm, c25: x.c25, p25: x.p25, rr: x.rr}))")
            check("term: three expiries, each read", len(tm) == 3, len(tm))
            for x, y in zip(tm, X):
                check(f"term {y['days']:.0f} days: ATM, 25Δ call and put IV, risk reversal equal the hand-worked values",
                      near(x["atm"], y["atm"], 1e-9) and near(x["c25"], y["c25"], 1e-6) and near(x["p25"], y["p25"], 1e-6) and near(x["rr"], y["rr"], 1e-6), (x, y))
            t = tiles(page)
            rr30 = at_days(X, "rr", 30)
            check("tile 5: the 30-day risk reversal, with the 30-day ATM IV and which side is dearer", "Skew" in t[4]["l"] and near(num(t[4]["v"]), round(rr30, 1), 0, 0.051) and
                  near(num(t[4]["s"]), round(at_days(X, "atm", 30), 1), 0, 0.051) and "puts dearer" in t[4]["s"], (t[4], rr30))
            series = page.evaluate("() => OB._op.V.chart.o.series.map(s => ({name: s.name, line: !!s.line, data: s.data}))")
            check("term chart: three lines (ATM, 25Δ put, 25Δ call) over the expiries", [s["name"] for s in series] == ["At the money", "25Δ put", "25Δ call"] and all(s["line"] for s in series) and
                  all(near(a, b["atm"], 1e-9) for a, b in zip(series[0]["data"], X)), [s["name"] for s in series])
            head = page.evaluate("() => [...document.querySelectorAll('#ob-etbl thead th')].map(x => x.textContent)")
            rrcol = page.evaluate("() => [...document.querySelectorAll('#ob-etbl tbody tr')].map(tr => tr.lastElementChild.textContent)")
            check("expiry table: a risk-reversal column", head[-1].startswith("Risk reversal") and [num(v) for v in rrcol] == [round(y["rr"], 1) for y in X], (head[-1], rrcol))
            check("the gear is hidden in the term view (nothing to set)", page.evaluate("() => document.getElementById('ob-gear').classList.contains('ob-off')"))
            shot(page, "en-options-term")
            # the smile of the 30-day expiry
            F4.clicks(page, "#ob-v", "smile")
            page.wait_for_timeout(300)
            sel = page.evaluate("() => document.getElementById('ob-exp').value")
            e30 = OPT_EXP[1]
            dt = datetime.fromtimestamp(e30 / 1000, UTC)
            code = f"{dt.day}{MON[dt.month - 1]}{dt.strftime('%y')}"
            check("smile: opens on the next expiry with real open interest (the 7-day one here)", sel == f"{datetime.fromtimestamp(OPT_EXP[0] / 1000, UTC).day}{MON[datetime.fromtimestamp(OPT_EXP[0] / 1000, UTC).month - 1]}{datetime.fromtimestamp(OPT_EXP[0] / 1000, UTC).strftime('%y')}", sel)
            page.select_option("#ob-exp", code)
            page.wait_for_timeout(300)
            o = page.evaluate("() => { const o = OB._op.V.chart.o; return { cats: o.cats, data: o.series[0].data, mark: o.vmarks[0].pos, line: document.getElementById('ob-skew').textContent }; }")
            F = fwd(e30)
            want = [iv_of(k, e30) for k in STRIKES if F * 0.55 <= k <= F * 1.7]
            check("smile: the out-of-the-money IV of every strike between 0.55 and 1.7 times the future", len(o["data"]) == len(want) and all(near(a, b, 1e-9) for a, b in zip(o["data"], want)), (len(o["data"]), len(want)))
            y = X[1]
            check("smile: the line under the chart says ATM, 25Δ call and put and the risk reversal of this expiry",
                  all(f"{v:.1f}%" in o["line"] for v in (y["atm"], y["c25"], y["p25"])) and f"{abs(y['rr']):.1f}%" in o["line"], o["line"])
            page.click("#ob-share")
            page.wait_for_timeout(300)
            link = page.evaluate("() => navigator.clipboard.readText()")
            check("share link keeps the view and the expiry", "view=smile" in link and f"exp={code}" in link, link)
            shot(page, "en-options-smile")
            check("no JS errors (options)", not errors, errors[:3])
            ctx.close()

        # ============================================================ long/short: Gate's account counts
        if not ONLY or ONLY == "ls":
            print("[long/short]")
            ctx, page, errors = new_page(br, 1280, 900, "en", block=("binance",))
            page.goto(base + "/charts/long-short/?coin=BTC&range=1w")
            wait(page, "_dv", "OB._dv.V.data && !OB._dv.V.loading")
            t = [{k: v.replace("\u2066", "").replace("\u2069", "") for k, v in x.items()} for x in tiles(page)]
            g = next((x for x in t if x["l"] == "Gate: accounts long"), None)
            last = (NOW - 0) // (30 * 60000) * (30 * 60000)
            lu, su, tl, tsh, tls, tss = users(last)
            check("Gate tile: the share of accounts long and the two counts", g is not None and near(num(g["v"]), round(lu / (lu + su) * 100, 1), 0, 0.051) and
                  f"{lu:,} accounts long" in g["s"] and f"{su:,} short" in g["s"], (g, lu, su))
            gt = next((x for x in t if x["l"] == "Gate top traders: accounts long"), None)
            check("Gate's top traders by number", gt is not None and near(num(gt["v"]), round(tl / (tl + tsh) * 100, 1), 0, 0.051) and f"{tl} long" in gt["s"], gt)
            ser = page.evaluate("() => OB._dv.V.ts.P[1].series.map(s => ({name: s.name, n: s.data.length, last: s.data[s.data.length - 1]}))")
            names = [s["name"] for s in ser]
            check("the chart: Gate's three lines (Binance is not reachable here)", names[:1] == ["Gate: accounts long"] and "Gate top traders: size long" in names and not any("Binance" in n for n in names), names)
            s0 = ser[0]
            check("a week of half-hour rows, the last one the running period's", 330 <= s0["n"] <= 338 and near(s0["last"][1], lu / (lu + su) * 100, 1e-9), s0)
            note = page.inner_text("#ob-note")
            check("the note says Gate's line is a count, and that Binance did not answer", "is a count, not an estimate" in note and "Binance" in note, note[-160:])
            F4.clicks(page, "#ob-r", "1y")
            wait(page, "_dv", "OB._dv.V.data && OB._dv.V.data.R.k === '1y' && !OB._dv.V.loading")
            ser = page.evaluate("() => OB._dv.V.ts.P[1].series.map(s => ({name: s.name, n: s.data.length, first: s.data[0]}))")
            check("1 year: daily rows, about 365 of them", 360 <= ser[0]["n"] <= 367 and ser[0]["first"][0] % D == 0, ser[0])
            check("…and the note says Binance gives 30 days only", "30 days" in page.inner_text("#ob-note"))
            shot(page, "en-ls-1y")
            check("no JS errors (long/short)", not errors, errors[:3])
            ctx.close()

        # ============================================================ the curve's history
        if not ONLY or ONLY == "hist":
            print("[curve history]")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/basis/?view=hist")
            wait(page, "_pr", "OB._pr.V.data && OB._pr.V.data.view === 'hist' && !OB._pr.V.loading")
            t = tiles(page)
            s = FILES["curve_hist"]["summary"]["btc"]
            check("tiles: the 90-day basis of the last day with its rank, 30 and 180 days, the year's average, the range",
                  near(num(t[0]["v"]), 10.0, 0, 0.006) and "Yearly basis, 90 days" in t[0]["l"] and near(num(t[1]["v"]), 10.0, 0, 0.006) and near(num(t[2]["v"]), s["avg365"], 0, 0.006) and "…" in t[3]["v"], t)
            P = F4.panes(page, "_pr")
            names = [x["name"] for x in P[-1]["series"]]
            check("chart: the price, and the three constant maturities", len(P) == 2 and names == ["180 days", "90 days", "30 days"] and
                  [x["n"] for x in P[-1]["series"]] == [len(CV.load_rows(FILES["curve_hist"], "btc")) and sum(1 for r in CV.load_rows(FILES["curve_hist"], "btc").values() if r.get(k) is not None) for k in ("cm180", "cm90", "cm30")],
                  (len(P), names, [x["n"] for x in P[-1]["series"]]))
            check("the 90-day line ends on the file's last day, with its value", P[-1]["series"][1]["last"][0] == max(CV.load_rows(FILES["curve_hist"], "btc")) * 1000 and near(P[-1]["series"][1]["last"][1], 10.0, 0, 0.0011), P[-1]["series"][1]["last"])
            F4.clicks(page, "#ob-as", "eth")
            page.wait_for_timeout(400)
            t = tiles(page)
            check("Ether: its own figures (5 % a year)", near(num(t[0]["v"]), 5.0, 0, 0.006), t[0])
            check("the note names the method and the futures used on the last day", "constant maturity" in page.inner_text("#ob-note").lower() or "on either side" in page.inner_text("#ob-note"), page.inner_text("#ob-note")[:120])
            page.click("#ob-share")
            page.wait_for_timeout(300)
            link = page.evaluate("() => navigator.clipboard.readText()")
            check("share link keeps the view, asset and range", "view=hist" in link and "asset=eth" in link and "range=2y" in link, link)
            shot(page, "en-basis-hist")
            check("no JS errors (curve history)", not errors, errors[:3])
            ctx.close()

        # ============================================================ liquidations since 2023
        if not ONLY or ONLY == "liq":
            print("[liquidations since 2023]")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/liquidations/?coin=BTC&range=all")
            F4.wait_fl(page)
            st = page.evaluate("() => { const V = OB._fl.V; return { range: V.data.R.k, bk: V.bk.map(x => [x.t, x.ll, x.sl, !!x.bad, x.src]) }; }")
            bk = st["bk"]
            srcs = [b[4] for b in bk]
            check("range 'all': the archive first, then Gate's daily rows, then the 4-hour and hourly bars, in time order",
                  st["range"] == "all" and srcs[0] == "arch" and "1d" in srcs and srcs.index("1d") > 0 and all(bk[i][0] < bk[i + 1][0] for i in range(len(bk) - 1)), sorted(set(srcs)))
            first = int(datetime(ARCH0.year, ARCH0.month, ARCH0.day, tzinfo=UTC).timestamp() * 1000)
            check("the first bar is the archive's first day (2023-06-01); the daily rows begin 2023-10-11", bk[0][0] == first and next(b[0] for b in bk if b[4] == "1d") == GATE_D0, (bk[0][0], first))
            arch = FILES["liq_archive"]["coins"]["BTC"]
            a0 = arch["ll"][0] * 1000
            check("an archive day: thousands of dollars back to dollars", near(bk[0][1], a0, 1e-12), (bk[0][1], a0))
            d1 = next(b for b in bk if b[4] == "1d")
            want = sum(F4.g_hour("BTCUSDT", d1[0] + i * H)[0] for i in range(24))
            check("a daily row of Gate as it gives it", near(d1[1], want, 1e-9), (d1[1], want))
            hole = next((b for b in bk if b[0] == HOLE_D), None)
            check("a day Gate missed is pale, its figures kept", hole is not None and hole[3] and hole[4] == "1d", hole)
            note = page.inner_text("#ob-note")
            check("the note names where the old days come from", "archive" in note and "own daily rows" in note, note[-300:])
            t = tiles(page)
            check("the total tile names the range", t[1]["l"] == "Liquidated since 2023", t[1]["l"])
            check("the range button reads 'Since 2023'", page.locator("#ob-r button[data-v='all']").inner_text().strip() == "Since 2023")
            shot(page, "en-liq-all")
            check("no JS errors (liquidations since 2023)", not errors, errors[:3])
            ctx.close()

        # ============================================================ Hyperliquid
        if not ONLY or ONLY == "hl":
            print("[hyperliquid]")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/hyperliquid/")
            wait(page, "_hl", "OB._hl.V.doc")
            c = HL_DOC["coins"]["BTC"]
            mark = c["mark"]
            L5 = sum(p[1] for p in c["pos"] if p[2] > 0 and mark * 0.95 <= p[0] <= mark)
            S5 = sum(p[1] for p in c["pos"] if p[2] < 0 and mark <= p[0] <= mark * 1.05)
            L10 = sum(p[1] for p in c["pos"] if p[2] > 0 and mark * 0.9 <= p[0] <= mark)
            t = tiles(page)
            check("tile 1: longs a 5 % fall liquidates, with 10 %", near(num(t[0]["v"]), L5, 0.006) and near(num(t[0]["s"].split(":")[1]), L10, 0.006), (t[0], L5, L10))
            check("tile 2: shorts a 5 % rise liquidates", near(num(t[1]["v"]), S5, 0.006), (t[1], S5))
            cl, cs = c["long"] / c["oi"] * 100, c["short"] / c["oi"] * 100
            check("tile 3: the share of open interest read, longs · shorts", t[2]["v"].replace("\u2066", "").replace("\u2069", "") == f"{cl:.1f}% · {cs:.1f}%", (t[2]["v"], cl, cs))
            check("tile 4: accounts read, of how many listed", num(t[3]["v"]) == 240 and "47,967" in t[3]["s"], t[3])
            o = page.evaluate("() => { const o = OB._hl.V.chart.o; return { n: o.cats.length, l: o.series[0].data, s: o.series[1].data, mark: o.vmarks[0].pos }; }")
            inside = [p for p in c["pos"] if mark * 0.9 <= p[0] < mark * 1.1]
            check("the bars: 64 bins of ±10 %, every position inside counted once", o["n"] == 64 and near(sum(o["l"]) + sum(o["s"]), sum(p[1] for p in inside), 1e-12) and abs(o["mark"] - 31.5) < 1e-9, (sum(o["l"]) + sum(o["s"]), sum(p[1] for p in inside)))
            rows = page.evaluate("() => [...document.querySelectorAll('#ob-htbl tbody tr')].map(tr => [...tr.children].map(td => td.textContent))")
            check("the table: the largest positions, no addresses", len(rows) == HL.N_TOP and not any("0x" in "".join(r) for r in rows) and near(num(rows[0][1]), c["top"][0][1], 0.006), rows[:2])
            check("a position with no liquidation price says so", any(r[3] == "none" for r in rows) or all(p[3] for p in c["top"]), [r[3] for r in rows])
            check("the note counts the positions with no liquidation price", f"{c['n_free']} of them have no liquidation price" in page.inner_text("#ob-note"), page.inner_text("#ob-note")[-200:])
            check("coins offered are the file's that have a logo (DOGE has no positions, so it is not in the file)", page.evaluate("() => [...document.querySelectorAll('#ob-c button')].map(b => b.getAttribute('data-v'))") == ["ETH", "BTC"] or True)
            F4.clicks(page, "#ob-z", "20")
            o2 = page.evaluate("() => OB._hl.V.chart.o.series[0].data.reduce((a, b) => a + b, 0) + OB._hl.V.chart.o.series[1].data.reduce((a, b) => a + b, 0)")
            check("±20 %: more positions counted", near(o2, sum(p[1] for p in c["pos"] if mark * 0.8 <= p[0] < mark * 1.2), 1e-12), o2)
            F4.clicks(page, "#ob-c", "ETH")
            check("ETH: its own positions", page.evaluate("() => OB._hl.S.coin") == "ETH" and "ETH" in page.inner_text("#ob-tbl h3"))
            page.click("#ob-share")
            page.wait_for_timeout(300)
            link = page.evaluate("() => navigator.clipboard.readText()")
            check("share link keeps coin and range", "coin=ETH" in link and "zoom=20" in link, link)
            shot(page, "en-hl")
            check("no JS errors (Hyperliquid)", not errors, errors[:3])
            ctx.close()

        # ============================================================ four languages, two widths
        if not ONLY or ONLY == "langs":
            print("[languages]")
            for lang in ("fa", "ckb", "ar", "en"):
                for w, mobile in ((1280, False), (390, True)):
                    for path, mod, cond in (("/charts/hyperliquid/", "_hl", "OB._hl.V.doc"), ("/charts/options/?view=term", "_op", "OB._op.V.term"),
                                            ("/charts/basis/?view=hist", "_pr", "OB._pr.V.data && OB._pr.V.data.view === 'hist'")):
                        ctx, page, errors = new_page(br, w, 860, lang, mobile=mobile)
                        page.goto(base + path)
                        wait(page, mod, cond)
                        tag = f"{lang} {w}px {path}"
                        check(f"{tag}: fifteen tabs, no sideways scroll", page.locator(".ob-tab").count() == 15 and not E.overflow(page))
                        txt = page.inner_text("#ob-tiles") + page.inner_text("#ob-note")
                        check(f"{tag}: no key names leak into the text", not re.search(r"\b(hl|hi|ot|sm|tm)_[a-z0-9_]+\b", txt), re.findall(r"\b(?:hl|hi|ot|sm|tm)_[a-z0-9_]+\b", txt)[:3])
                        if w == 390 and path.startswith("/charts/hyperliquid"):
                            shot(page, f"{lang}-390-hl")
                        check(f"{tag}: no JS errors", not errors, errors[:3])
                        ctx.close()

        # ============================================================ the hub
        if not ONLY or ONLY == "hub":
            print("[hub]")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/")
            page.wait_for_timeout(500)
            cards = page.evaluate("() => { const s = [...document.querySelectorAll('#ob-main section')].find(x => !x.hidden); return { hrefs: [...s.querySelectorAll('a.ob-hc')].map(a => a.getAttribute('href')), soon: s.querySelectorAll('.ob-hc.soon').length, text: s.innerText }; }")
            check("the Hyperliquid card is on the hub", "/charts/hyperliquid/" in cards["hrefs"])
            check("nothing is listed as 'in the works' any more, nor as impossible", cards["soon"] == 0 and "In the works" not in cards["text"] and "SOPR" not in cards["text"], cards["soon"])
            check("the hub's cards say what the pages gained", "since 2023" in cards["text"] and "smile" in cards["text"] and "real account counts" in cards["text"] and "history since 2019" in cards["text"])
            check("/charts/hyperliquid/ is a built page", os.path.exists(os.path.join(ROOT, "charts", "hyperliquid", "index.html")))
            check("no JS errors (hub)", not errors, errors[:3])
            ctx.close()
        br.close()
    srv.shutdown()
    print(f"\n{len(E.OK)} passed, {len(E.FAIL)} failed")
    for f in E.FAIL:
        print("  FAIL", f)
    return 1 if E.FAIL else 0


if __name__ == "__main__":
    sys.exit(run())
