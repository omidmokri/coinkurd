#!/usr/bin/env python3
"""End-to-end test of the Observatory's stage 4 in a real Chrome, offline:
/charts/liquidations/ · /charts/cvd/ · /charts/basis/ · /charts/stablecoins/ and their cards on the hub.

The repo is served locally; every source is mocked in its real format, with figures small enough to work out by hand:
  Gate      contract_stats (5-minute, hourly and 4-hour rows; one hour and one 4-hour period that the statistics missed for
            every contract — all flows zero, as the real ones are), candlesticks, contracts/<name>
              each hour: longs liquidated 1,000 × (hour of the day + 1) dollars, shorts 500; takers buy 36,000 contracts, sell 12,000
              → a whole day: longs 300,000, shorts 12,000; taker delta +2.4 BTC an hour (a contract is 0.0001 BTC)
  OKX       public/liquidation-orders: an order every 37 seconds for 23 hours and again from 25 to 27 hours ago (so the edge of the
            24 hours never cuts through them), twins and one triplet sharing a millisecond, three very large orders
  Binance   spot klines: volume 100, takers' buys 60 → delta +20 a candle · futures klines: volume 500, buys 200 → delta −100
  Bybit     premium-index-price-kline: closes 0.0001 × (candle number mod 7 − 3)
  Deribit   get_book_summary_by_currency (kind=future): the perpetual 0.1 % above the index, four dated futures whose basis
            is 0.05 % a day → 18.25 % a year for all of them; the nearest expires in under two days (not annualised)
  files     premium.json, premium_d.json, stables.json and stables_now.json are written by scripts/obs_premium.py and
            scripts/obs_stables.py themselves from the pretend Coinbase, Binance and DefiLlama of tests/obs_fakes.py
Checks: zero JS errors; every tile, table and series against those answers (the liquidation buckets are re-built here in
Python, independently of flowmath.js); every control; share links; PNG; four languages at 1280 px and 390 px without
sideways scroll; what the pages say when a source is missing. Screenshots go to $SHOTS (default /tmp/obs4shots) — look at them.
Run: python3 scripts/build_obs.py && python3 tests/obs4_e2e.py        (ONLY=liq|cvd|basis|stables|langs|errors|hub)
"""
import json
import math
import os
import re
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tests"))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import obs_e2e as E  # noqa: E402  (the local server, the page wiring and the exchanges' mocks of stages 1 and 2)
import obs_fakes as K  # noqa: E402
import obs_chain as OC  # noqa: E402
import obs_premium as OP  # noqa: E402
import obs_stables as OS  # noqa: E402

SHOTS = os.environ.get("SHOTS", "/tmp/obs4shots")
ONLY = os.environ.get("ONLY", "")
os.makedirs(SHOTS, exist_ok=True)
check, near, overflow = E.check, E.near, E.overflow
MIN, H, D = 60_000, 3_600_000, 86_400_000
NOW = E.NOW
UTC = timezone.utc
DOWN = set()             # "gate", "gate4h", "okx", "spot", "spot_other", "futures", "bybit_prem", "deribit", "premium", "premium_d", "stables", "files500"
REQ = []                 # (host, path, query) of the requests the mocks of this file answered
quiet = lambda *a, **k: None  # noqa: E731

# ---------------------------------------------------------------- Gate
HOLE1 = (NOW - 30 * H) // H * H                  # an hour the statistics missed, for every contract
HOLE4 = (NOW - 120 * D) // (4 * H) * (4 * H)     # a 4-hour period they missed
GK = {"BTCUSDT": 1.0, "ETHUSDT": 0.5, "SOLUSDT": 0.1}     # how large a coin's liquidations are against Bitcoin's
GMULT = {"BTCUSDT": 0.0001}                               # coins in one contract (E.gate: 0.0001 for BTC, 1 for the others)


def g_hour(sym, t):
    """one hour of one contract: (longs liquidated $, shorts liquidated $, takers' buys and sells in contracts)"""
    k = GK.get(sym, 0.05)
    return 1000.0 * ((t // H) % 24 + 1) * k, 500.0 * k, 36000, 12000


def g_row(sym, t, step):
    """a row of contract_stats as the API gives it; flows are zero in a period the statistics missed"""
    if step == H:
        ll, sl, buy, sell = g_hour(sym, t)
        hole = t == HOLE1
    elif step == 5 * MIN:
        a = g_hour(sym, t // H * H)
        ll, sl, buy, sell = a[0] / 12, a[1] / 12, a[2] // 12, a[3] // 12
        hole = False
    else:
        parts = [g_hour(sym, t + i * H) for i in range(step // H)]
        ll, sl, buy, sell = (sum(p[i] for p in parts) for i in range(4))
        hole = t == HOLE4
    if hole:
        ll = sl = 0.0
        buy = sell = 0
    px = E.px_coin(sym, min(t + step, NOW))
    mult = GMULT.get(sym, 1)
    oi2 = 2 * (4e9 + 1e6 * ((t // H) % 100)) * GK.get(sym, 0.05)              # the statistics count both sides
    return {"time": t // 1000, "lsr_taker": (buy / sell) if sell else 0, "lsr_account": 2.1, "long_liq_size": round(ll / px / mult), "short_liq_size": round(sl / px / mult),
            "long_liq_amount": ll / px, "short_liq_amount": sl / px, "long_liq_usd": ll, "short_liq_usd": sl, "long_liq_usd_new": ll, "short_liq_usd_new": sl,
            "open_interest": round(oi2 / px / mult), "open_interest_usd": oi2, "mark_price": px, "top_lsr_size": 0.8, "top_lsr_account": 0.5,
            "long_taker_size": buy, "short_taker_size": sell, "long_users": 20000, "short_users": 9000, "last_funding_rate": "0.0001"}


def gate(route):
    u = urlparse(route.request.url)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    ep = u.path.rsplit("/", 1)[-1]
    REQ.append(("gate", ep, q))
    if "gate" in DOWN or (ep == "contract_stats" and q.get("interval") == "4h" and "gate4h" in DOWN):
        return route.abort()
    if ep in ("contract_stats", "candlesticks"):
        sym = E.SYM_OF.get(q.get("contract", "").replace("_USDT", ""))
        if not sym or sym in E.GATE_MISSING:
            return route.abort()                                  # the real API answers 400 without CORS headers: the page sees a failed request
        step, lim = E.IV[q["interval"]], int(q.get("limit", 30))
        last = NOW // step * step
        ts = [last - i * step for i in range(lim - 1, -1, -1)]
        if ep == "contract_stats":
            return E.jresp(route, [g_row(sym, t, step) for t in ts])
        out = []
        for t in ts:
            o, h, l, c, v = E.candle(sym, t, step)
            m = E.MULT.get(sym, 1)
            out.append({"t": t // 1000, "o": f"{o / m:.10g}", "h": f"{h / m:.10g}", "l": f"{l / m:.10g}", "c": f"{c / m:.10g}", "v": int(v), "sum": f"{v * c:.4f}"})
        return E.jresp(route, out)
    return E.gate(route)


# ---------------------------------------------------------------- OKX: the liquidation orders of the last day
def okx_orders():
    out, k, t = [], 0, NOW - 60_000
    while t > NOW - 27 * H:
        age = NOW - t
        if not (23 * H < age < 25 * H):
            out.append({"ts": t, "side": "short" if k % 3 == 0 else "long", "sz": 10 + (k % 7)})
            if k % 50 == 0:
                out.append({"ts": t, "side": "long", "sz": 3})                          # a twin in the same millisecond
            if k == 123:
                out.append({"ts": t, "side": "short", "sz": 4})
                out.append({"ts": t, "side": "short", "sz": 5})                         # a triplet
        k += 1
        t -= 37_000
    out.append({"ts": NOW - 3 * H - 1234, "side": "short", "sz": 5000})                 # 5,000 contracts × 0.01 BTC × 70,000 = 3.5 million dollars
    out.append({"ts": NOW - 9 * H - 777, "side": "long", "sz": 4000})                   # 2.8 million
    out.append({"ts": NOW - 26 * H, "side": "long", "sz": 9000})                        # older than a day: never counted
    out.sort(key=lambda o: -o["ts"])
    return out


ORDERS = okx_orders()
OKX_PX = 70000.0


def okx(route):
    u = urlparse(route.request.url)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    if not u.path.endswith("/public/liquidation-orders"):
        return E.okx(route)
    REQ.append(("okx", "liquidation-orders", q))
    if "okx" in DOWN:
        return route.abort()
    if q.get("uly") != "BTC-USDT":
        return E.jresp(route, {"code": "0", "msg": "", "data": []})
    after = int(q.get("after") or NOW + 1)
    det = [{"bkLoss": "0", "bkPx": f"{OKX_PX:.1f}", "ccy": "", "posSide": o["side"], "side": "buy" if o["side"] == "short" else "sell", "sz": f"{o['sz']:.2f}", "time": o["ts"], "ts": str(o["ts"])}
           for o in ORDERS if o["ts"] < after][:100]
    E.jresp(route, {"code": "0", "msg": "", "data": [{"details": det, "instFamily": "BTC-USDT", "instId": "BTC-USDT-SWAP", "instType": "SWAP", "totalLoss": "0", "uly": "BTC-USDT"}] if det else []})


def okx_expected(frm):
    rows = [o for o in ORDERS if o["ts"] >= frm]
    usd = lambda o: OKX_PX * o["sz"] * 0.01  # noqa: E731
    return {"n": len(rows), "long": sum(usd(o) for o in rows if o["side"] == "long"), "short": sum(usd(o) for o in rows if o["side"] == "short"),
            "top": sorted(rows, key=lambda o: (-usd(o), -o["ts"]))[:15]}


# ---------------------------------------------------------------- Binance: candles with the takers' share
SPOT_V, SPOT_TB, FUT_V, FUT_TB = 100.0, 60.0, 500.0, 200.0


def klines(route, v, tb, fut):
    u = urlparse(route.request.url)
    q = {k: v0[0] for k, v0 in parse_qs(u.query).items()}
    REQ.append(("futures" if fut else "spot", "klines", q))
    if ("futures" if fut else "spot") in DOWN:
        return route.abort()
    sym = q.get("symbol", "")
    if sym not in E.COINS or (not fut and sym.startswith("1000")):
        if fut:
            return E.jresp(route, {"code": -1121, "msg": "Invalid symbol."}, 400)
        # the public mirror refuses an unknown symbol WITHOUT CORS headers (measured 2026-11-14): the page sees a failed request, not a 400
        return route.fulfill(status=400, content_type="application/json", body='{"code":-1121,"msg":"Invalid symbol."}')
    iv = E.IV[q["interval"]]
    t = -(-int(q["startTime"]) // iv) * iv if "startTime" in q else NOW // iv * iv - (int(q.get("limit", 500)) - 1) * iv      # without a start: the newest candles
    out = []
    k = 3.0 if (not fut and "spot_other" in DOWN) else 1.0                         # another coin trading under this ticker on the spot market
    while t <= NOW and len(out) < int(q.get("limit", 500)):
        o, h, l, c, _ = (x * k for x in E.candle(sym, t, iv))
        out.append([t, f"{o:.8f}", f"{h:.8f}", f"{l:.8f}", f"{c:.8f}", f"{v:.5f}", t + iv - 1, f"{v * c:.8f}", 1000, f"{tb:.5f}", f"{tb * c:.8f}", "0"])
        t += iv
    E.jresp(route, out)


def binance_f(route):
    u = urlparse(route.request.url)
    if u.path == "/fapi/v1/klines" and "endTime" not in parse_qs(u.query):         # the CVD page asks from a start time on; the older pages ask for a window
        return klines(route, FUT_V, FUT_TB, True)
    return E.binance(route)


# ---------------------------------------------------------------- Bybit: the premium index
def prem_at(t, step):
    return 0.0001 * ((t // step) % 7 - 3)


def bybit(route):
    u = urlparse(route.request.url)
    if not u.path.endswith("/premium-index-price-kline"):
        return E.bybit(route)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    REQ.append(("bybit", "premium", q))
    if "bybit_prem" in DOWN:
        return route.abort()
    step = E.IV[E.BYK[q["interval"]]]
    ts = E.grid(int(q["start"]), int(q["end"]), step, int(q.get("limit", 200)))
    rows = [[str(t), f"{prem_at(t - step, step):.8f}", f"{prem_at(t, step) + 0.00001:.8f}", f"{prem_at(t, step) - 0.00001:.8f}", f"{prem_at(t, step):.8f}"] for t in ts[::-1]]
    E.jresp(route, {"retCode": 0, "retMsg": "OK", "result": {"symbol": q["symbol"], "category": "linear", "list": rows}, "retExtInfo": {}, "time": NOW})


# ---------------------------------------------------------------- Deribit: the futures
MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
IDX = {"BTC": 70000.0, "ETH": 2000.0}
_b = datetime.fromtimestamp(NOW / 1000, UTC).replace(hour=8, minute=0, second=0, microsecond=0)
if _b.timestamp() * 1000 <= NOW + 5 * MIN:
    _b += timedelta(days=1)
FUT = [(_b + timedelta(days=k), oi) for k, oi in ((0, 1e6), (9, 5e6), (39, 9e7), (99, 4e7))]        # (expiry, open interest in dollars)
BAS_DAY = 0.0005                                                                                # basis: 0.05 % for every day to expiry → 18.25 % a year


def fname(cur, dt):
    return f"{cur}-{dt.day}{MON[dt.month - 1]}{dt.strftime('%y')}"


def deribit(route):
    u = urlparse(route.request.url)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    ep = u.path.rsplit("/", 1)[-1]
    REQ.append(("deribit", ep, q))
    if "deribit" in DOWN or ep != "get_book_summary_by_currency" or q.get("kind") != "future":
        return route.abort()
    cur, idx = q["currency"], IDX[q["currency"]]
    row = lambda name, mark, oi, vol: {"high": mark, "low": mark, "last": mark, "instrument_name": name, "bid_price": mark - 1, "ask_price": mark + 1, "open_interest": oi,  # noqa: E731
                                       "mark_price": mark, "creation_timestamp": NOW, "estimated_delivery_price": idx, "price_change": 0.1, "volume": 10, "base_currency": cur,
                                       "quote_currency": "USD", "volume_usd": vol, "volume_notional": vol, "mid_price": mark}
    rows = [row(f"{cur}-PERPETUAL", idx * 1.001, 7e8, 2.5e9)]
    for dt, oi in FUT:
        days = (dt.timestamp() - time.time()) * 1000 / D                                          # from the moment of the request, as the page counts them
        rows.append(row(fname(cur, dt), idx * (1 + BAS_DAY * days), oi, oi / 10))
    past = _b - timedelta(days=2)
    rows.append(row(fname(cur, past), idx * 0.9, 9e9, 1))                                         # expired: must not be counted
    rows.append(row(fname(cur, FUT[1][0]) + "-70000-C", 0.05, 9e9, 1))                            # an option: not a future
    rows.insert(2, {"instrument_name": fname(cur, FUT[3][0] + timedelta(days=91)), "mark_price": None, "estimated_delivery_price": idx, "open_interest": 5})   # no price: left out
    E.jresp(route, {"jsonrpc": "2.0", "result": rows, "usIn": 1, "usOut": 2, "usDiff": 1, "testnet": False})


# ---------------------------------------------------------------- the files CI writes, from the pretend sources
STAMP = datetime.fromtimestamp(NOW / 1000, UTC).replace(microsecond=0)
YDAY = (STAMP - timedelta(days=1)).strftime("%Y-%m-%d")
TMP = tempfile.mkdtemp(prefix="obs4_")
OC._save(os.path.join(TMP, "chain_btc.json"), K.chain_doc(YDAY, STAMP))
assert OS.run(K.llama_get(STAMP), STAMP, out_dir=TMP, log=quiet) == "written"
assert OP.run(K.Exchanges(NOW // 1000), STAMP, out_dir=TMP, log=quiet) == "written"
FILES = {n: json.load(open(os.path.join(TMP, n + ".json"), encoding="utf-8")) for n in ("premium", "premium_d", "stables", "stables_now")}
PSUM, SSUM = FILES["premium"]["summary"], FILES["stables_now"]["summary"]


def files(route):
    name = re.search(r"/data/obs/(\w+)\.json", route.request.url).group(1)
    REQ.append(("file", name, {}))
    if "files500" in DOWN:
        return route.abort()
    if name in DOWN or (name == "stables_now" and "stables" in DOWN):
        return route.fulfill(status=404, content_type="text/html", body="<h1>404</h1>")
    route.fulfill(status=200, content_type="application/json", body=json.dumps(FILES[name], separators=(",", ":")))


def new_page(br, w, h, lang, mobile=False, block=()):
    """like obs_e2e.new_page, without the site's service worker (it would fetch /data/…json itself, past the mock), and with this stage's sources"""
    ctx = br.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile, accept_downloads=True, service_workers="block")
    ctx.grant_permissions(["clipboard-read", "clipboard-write"])
    page = ctx.new_page()
    errors = []
    page.add_init_script(E.lang_init(lang))
    E.wire(page, errors, block)
    if "gate" not in block:
        page.route("https://api.gateio.ws/**", gate)
    if "okx" not in block:
        page.route("https://www.okx.com/**", okx)
    if "binance" not in block:
        page.route("https://fapi.binance.com/**", binance_f)
    if "bybit" not in block:
        page.route("https://api.bybit.com/**", bybit)
    page.route("https://data-api.binance.vision/**", lambda r: klines(r, SPOT_V, SPOT_TB, False))
    page.route("https://www.deribit.com/**", deribit)
    page.route(re.compile(r".*/data/obs/(premium|premium_d|stables|stables_now)\.json.*"), files)
    return ctx, page, errors


def wait_fl(page, okx_too=False, timeout=40000):
    page.wait_for_function("() => window.OB && OB._fl && OB._fl.V.data && !OB._fl.V.loading", timeout=timeout)
    if okx_too:
        page.wait_for_function("() => OB._fl.V.okx && OB._fl.V.okx.state !== 'load'", timeout=timeout)
    page.wait_for_timeout(300)


def wait_pr(page, timeout=40000):
    page.wait_for_function("() => window.OB && OB._pr && OB._pr.V.data && !OB._pr.V.loading", timeout=timeout)
    page.wait_for_timeout(300)


def tiles(page):
    return page.evaluate("() => [...document.querySelectorAll('#ob-tiles .ob-tile')].map(t => ({l: t.querySelector('small').textContent, v: t.querySelector('b').textContent, s: (t.querySelector(':scope > span') || {}).textContent || ''}))")


def num(txt):
    """'$4.48B' → 4.48e9 · '-14.3%' → -14.3 · '+3360 BTC' → 3360 · '—' → None"""
    m = re.search(r"([-+]?)\$?([\d,]*\.?\d+)([KMBT]?)(?![A-Za-z])", txt.replace("⁦", "").replace("⁩", ""))
    if not m:
        return None
    v = float(m.group(2).replace(",", "")) * {"": 1, "K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}[m.group(3)]
    return -v if m.group(1) == "-" else v


def nums(txt):
    return [num(x) for x in re.split(r"·", txt)]


def clicks(page, sel, val):
    page.click(f"{sel} button[data-v='{val}']")
    page.wait_for_timeout(250)


def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name + ".png"))


def panes(page, mod):
    """every pane of the chart on screen: title and, per series, name, type, number of points, first and last point"""
    return page.evaluate("""(mod) => OB[mod].V.ts.P.map(p => ({ title: p.title, series: p.series.map(s => ({ name: s.name, type: s.type, n: s.data.length, first: s.data[0], last: s.data[s.data.length - 1],
      dim: s.dim ? Object.keys(s.dim).map(Number).sort((a, b) => a - b) : null })) }))""", mod)


# ---------------------------------------------------------------- the liquidation buckets, re-built here by the definitions
def liq_expected(sym, span, step, page_now):
    """what the page must show, from the mock's own hourly and 4-hour figures and the definitions at the head of flowmath.js:
       {buckets: [(t, longs, shorts, incomplete, '1h' | '4h')], 24h: (longs, shorts, hours)}"""
    hours = min(2000, math.ceil(span / H) + 30)
    last_h = NOW // H * H
    h1 = {last_h - i * H: g_row(sym, last_h - i * H, H) for i in range(hours)}
    bad1 = {HOLE1, HOLE1 - H} if HOLE1 in h1 else set()
    deep = span / H + 24 > 2000
    n4 = min(2000, math.ceil(span / (4 * H)) + 12)
    last4 = NOW // (4 * H) * (4 * H)
    h4 = {last4 - i * 4 * H: g_row(sym, last4 - i * 4 * H, 4 * H) for i in range(n4)} if deep else {}
    bad4 = {HOLE4, HOLE4 - 4 * H} if HOLE4 in h4 else set()
    frm = (page_now - span) // step * step + step
    live = lambda b: b + step > page_now  # noqa: E731

    def groups(rows):
        g = {}
        for t in rows:
            if t >= frm:
                g.setdefault(t // step * step, []).append(t)
        return g

    A, want = groups(h1), step // H
    cut = min([b for b in A if len(A[b]) == want or live(b)], default=float("inf"))
    out = []
    if deep and step >= 4 * H:
        B, want4, started = groups(h4), step // (4 * H), False
        for b in sorted(B):
            if b >= cut or (not started and len(B[b]) < want4):
                continue
            started = True
            out.append((b, sum(h4[t]["long_liq_usd"] for t in B[b]), sum(h4[t]["short_liq_usd"] for t in B[b]), any(t in bad4 for t in B[b]) or (len(B[b]) < want4 and not live(b)), "4h"))
    for b in sorted(A):
        if b >= cut:
            out.append((b, sum(h1[t]["long_liq_usd"] for t in A[b]), sum(h1[t]["short_liq_usd"] for t in A[b]), any(t in bad1 for t in A[b]) or (len(A[b]) < want and not live(b)), "1h"))
    h0 = page_now // H * H
    win = [t for t in h1 if h0 - 23 * H <= t <= page_now]
    return {"buckets": out, "24h": (sum(h1[t]["long_liq_usd"] for t in win), sum(h1[t]["short_liq_usd"] for t in win), len(win))}


def run():
    srv, port = E.serve()
    base = f"http://127.0.0.1:{port}"
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path="/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None, args=["--no-sandbox"])

        # ============================================================ liquidations by day
        if not ONLY or ONLY == "liq":
            print("[liquidations]")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            REQ.clear()
            page.goto(base + "/charts/liquidations/")
            wait_fl(page, okx_too=True)
            st = page.evaluate("() => { const V = OB._fl.V, D0 = V.data; return { now: D0.now, range: D0.R.k, step: D0.R.step, deep: D0.deep, has4: !!D0.h4, okx: { state: V.okx.state, now: V.okx.now, from: V.okx.from, n: V.okx.list.length, lost: V.okx.lost, cut: V.okx.cut }, bk: V.bk.map(x => [x.t, x.ll, x.sl, x.bad, x.src, !!x.live]) }; }")
            check("opens on Bitcoin, three months of daily bars, with the older days asked from the 4-hour rows", st["range"] == "3m" and st["step"] == D and st["deep"] and st["has4"], {k: st[k] for k in ("range", "step", "deep")})
            X = liq_expected("BTCUSDT", 90 * D, D, st["now"])
            got = [(b[0], round(b[1], 3), round(b[2], 3), b[3], b[4]) for b in st["bk"]]
            exp = [(b[0], round(b[1], 3), round(b[2], 3), b[3], b[4]) for b in X["buckets"]]
            check("every bar equals the buckets re-built here from the mock (time, longs, shorts, incomplete, hourly or 4-hour rows)", got == exp, [(g, e) for g, e in zip(got, exp) if g != e][:3] or (len(got), len(exp)))
            check("90 daily bars, today last and still running", len(st["bk"]) == 90 and st["bk"][-1][5] and not st["bk"][-2][5], len(st["bk"]))
            n4 = sum(1 for b in st["bk"] if b[4] == "4h")
            check("the days before the hourly rows begin come from the 4-hour rows (2000 hours = 83 days)", 5 <= n4 <= 8 and all(b[4] == "4h" for b in st["bk"][:n4]) and all(b[4] == "1h" for b in st["bk"][n4:]), n4)
            whole = [b for b in st["bk"] if not b[3] and not b[5]]
            check("a whole day: longs 300,000 and shorts 12,000 dollars, from either kind of row", all(near(b[1], 300000, 1e-9) and near(b[2], 12000, 1e-9) for b in whole) and len(whole) >= 86, len(whole))
            hole_day = HOLE1 // D * D
            inc = [b for b in st["bk"] if b[3]]
            hd = [b for b in st["bk"] if b[0] == hole_day][0]
            check("the hour the statistics missed makes its day incomplete, and the day's figure lacks exactly that hour", hd[3] and near(hd[1], 300000 - 1000 * ((HOLE1 // H) % 24 + 1), 1e-9) and near(hd[2], 11500, 1e-9), hd)
            check("…so does the hour before it (cut short at the source): one or two incomplete days", 1 <= len(inc) <= 2 and all(b[0] in (hole_day, (HOLE1 - H) // D * D) for b in inc), inc)
            t = tiles(page)
            check("five tiles", len(t) == 5, [x["l"] for x in t])
            L24, S24, n24 = X["24h"]
            check("tile 1: the last 24 hours on Gate — the 23 closed hours and the running one", "Gate" in t[0]["l"] and near(num(t[0]["v"]), L24 + S24, 0.006) and near(nums(t[0]["s"])[0], L24, 0.006) and near(nums(t[0]["s"])[1], S24, 0.006), (t[0], L24, S24, n24))
            if st["now"] // H == NOW // H:
                check("…which is every hour of the day once: 300,000 + 12,000", near(L24, 300000, 1e-9) and near(S24, 12000, 1e-9) and n24 == 24, (L24, S24, n24))
            TL, TS = sum(b[1] for b in X["buckets"]), sum(b[2] for b in X["buckets"])
            check("tile 2: the whole range", near(num(t[1]["v"]), TL + TS, 0.006) and near(nums(t[1]["s"])[0], TL, 0.006) and near(nums(t[1]["s"])[1], TS, 0.006), (t[1], TL, TS))
            check("tile 3: the longs’ share, and the shorts’ beside it", near(num(t[2]["v"]), TL / (TL + TS) * 100, 0, 0.06) and near(num(t[2]["s"]), TS / (TL + TS) * 100, 0, 0.06), t[2])
            check("tile 4: the largest day", "day" in t[3]["l"].lower() and near(num(t[3]["v"]), 312000, 0.006), t[3])
            XO = okx_expected(st["okx"]["from"])
            check("OKX: every order of the last 24 hours was read, none twice (twins and a triplet share a millisecond)", st["okx"]["state"] == "ok" and st["okx"]["n"] == XO["n"] and not st["okx"]["lost"] and not st["okx"]["cut"], (st["okx"], XO["n"]))
            check("tile 5: OKX’s 24 hours, labelled a floor — total, longs, shorts and the number of orders", "OKX" in t[4]["l"] and "at least" in t[4]["l"] and "floor" in page.inner_text("#ob-okx") and near(num(t[4]["v"]), XO["long"] + XO["short"], 0.006) and near(nums(t[4]["s"])[0], XO["long"], 0.006)
                  and near(nums(t[4]["s"])[1], XO["short"], 0.006) and near(nums(t[4]["s"])[2], XO["n"], 1e-9), (t[4], XO["long"], XO["short"], XO["n"]))
            okx_req = [r for r in REQ if r[0] == "okx"]
            check("OKX was asked in pages of 100, with the cursor one millisecond past the edge", 25 <= len(okx_req) <= 60 and all(r[2].get("limit") == "100" and r[2].get("state") == "filled" for r in okx_req), len(okx_req))
            ot = page.evaluate("() => [...document.querySelectorAll('#ob-otbl tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()))")
            check("the table of OKX’s largest orders: 15 rows, 3.5 million short first, then 2.8 million long; the order older than a day is not there",
                  len(ot) == 15 and "Short" in ot[0][1] and near(num(ot[0][3]), 3.5e6, 0.006) and "Long" in ot[1][1] and near(num(ot[1][3]), 2.8e6, 0.006) and "$70,000" in ot[0][2] and not any(near(num(r[3]), 6.3e6, 0.01) for r in ot), ot[:3])
            pn = panes(page, "_fl")
            check("three panes: price candles, liquidations, open interest", len(pn) == 3 and pn[0]["series"][0]["type"] == "candle" and pn[0]["series"][0]["n"] == 90 and [s["type"] for s in pn[1]["series"]] == ["bars", "bars"] and pn[2]["series"][0]["type"] == "step", [(x["title"], [s["type"] for s in x["series"]]) for x in pn])
            check("shorts are drawn upward and longs downward", pn[1]["series"][0]["last"][1] > 0 and pn[1]["series"][1]["last"][1] < 0 and near(pn[1]["series"][1]["first"][1], -300000, 1e-9), pn[1]["series"])
            check("incomplete bars are drawn pale on both series", pn[1]["series"][0]["dim"] == sorted(b[0] for b in inc) and pn[1]["series"][1]["dim"] == pn[1]["series"][0]["dim"], pn[1]["series"][0]["dim"])
            oi_last = page.evaluate("() => { const b = OB._fl.V.bk; return b[b.length - 2].oi; }")
            check("open interest is one side: half of what Gate’s statistics count", near(oi_last, 4e9 + 1e6 * (((st["now"] // D * D - H) // H) % 100), 1e-9), oi_last)
            rows = page.evaluate("() => [...document.querySelectorAll('#ob-ltbl tbody tr')].map(tr => ({ c: [...tr.children].map(td => td.textContent.trim()), inc: tr.classList.contains('ob-inc') }))")
            check("the table: the last 14 bars, newest first, today marked as running", len(rows) == 14 and "so far" in rows[0]["c"][0] and near(num(rows[1]["c"][1]), st["bk"][-2][1], 0.006) and near(num(rows[1]["c"][3]), st["bk"][-2][1] + st["bk"][-2][2], 0.006), rows[:2])
            check("…with the incomplete day named", any(r["inc"] and "incomplete" in r["c"][0] for r in rows) == any(b[3] for b in st["bk"][-14:]), [r["c"][0] for r in rows if r["inc"]])
            note = page.inner_text("#ob-note")
            check("the note counts the incomplete bars and names where the 4-hour rows begin", str(len(inc)) + " of the 90 bars are incomplete" in note and "four-hour figures" in note and "not the whole market" in note, note[-260:])
            check("the chart is drawn", E.colours(page) > 12, E.colours(page))
            shot(page, "liq_en_3m")
            # the read-out says what a pale bar is
            box = page.locator(".ob-cv").bounding_box()
            hx = page.evaluate("(t) => { const ts = OB._fl.V.ts; return ts._X(t + 43200000); }", inc[0][0])
            page.mouse.move(box["x"] + hx, box["y"] + box["height"] * 0.5)
            page.wait_for_timeout(250)
            tip = page.inner_text(".ob-tip") if page.locator(".ob-tip").is_visible() else ""
            check("the read-out of a pale bar says its hours are missing at the source", "missing at the source" in tip and "Shorts liquidated" in tip and "Longs liquidated" in tip, tip)
            page.mouse.move(box["x"] + 5, box["y"] + 5)
            # ranges
            n_before = len([r for r in REQ if r[0] == "okx"])
            clicks(page, "#ob-r", "24h")
            wait_fl(page)
            s2 = page.evaluate("() => { const V = OB._fl.V; return { now: V.data.now, bk: V.bk.map(x => [x.t, x.ll, x.sl, x.bad, x.src]), deep: V.data.deep }; }")
            X2 = liq_expected("BTCUSDT", 24 * H, H, s2["now"])
            t2 = tiles(page)
            check("24 hours: hourly bars from the hourly rows alone", [(b[0], b[1], b[2]) for b in s2["bk"]] == [(b[0], b[1], b[2]) for b in X2["buckets"]] and 23 <= len(s2["bk"]) <= 24 and not s2["deep"], len(s2["bk"]))
            check("…and the range’s total is the 24-hour tile", near(num(t2[1]["v"]), num(t2[0]["v"]), 1e-9) and "Largest bar" in t2[3]["l"], (t2[0]["v"], t2[1]["v"], t2[3]["l"]))
            check("a change of range does not read OKX’s day again", len([r for r in REQ if r[0] == "okx"]) == n_before and near(num(t2[4]["v"]), XO["long"] + XO["short"], 0.006), (n_before, len([r for r in REQ if r[0] == "okx"])))
            clicks(page, "#ob-r", "1w")
            wait_fl(page)
            s3 = page.evaluate("() => { const V = OB._fl.V; return { now: V.data.now, bk: V.bk.map(x => [x.t, x.ll, x.sl, x.bad, x.src]) }; }")
            X3 = liq_expected("BTCUSDT", 7 * D, 4 * H, s3["now"])
            check("1 week: 4-hour bars summed from the hourly rows; the missed hour and the one before it mark their bars", [tuple(b) for b in s3["bk"]] == [tuple(b) for b in X3["buckets"]] and len(s3["bk"]) == 42 and 1 <= sum(1 for b in s3["bk"] if b[3]) <= 2,
                  [(g, e) for g, e in zip(s3["bk"], X3["buckets"]) if tuple(g) != tuple(e)][:2])
            clicks(page, "#ob-r", "1y")
            wait_fl(page)
            s4 = page.evaluate("() => { const V = OB._fl.V; return { now: V.data.now, bk: V.bk.map(x => [x.t, x.ll, x.sl, x.bad, x.src]) }; }")
            X4 = liq_expected("BTCUSDT", 365 * D, D, s4["now"])
            check("1 year: as far back as Gate’s 4-hour rows go (2000 of them: about 333 days)", [tuple(b) for b in s4["bk"]] == [tuple(b) for b in X4["buckets"]] and 330 <= len(s4["bk"]) <= 334, (len(s4["bk"]), len(X4["buckets"])))
            hole4_day = HOLE4 // D * D
            inc4 = sorted(b[0] for b in s4["bk"] if b[3] and b[4] == "4h")
            check("a 4-hour period the statistics missed marks its day (and the day of the period before it)", hole4_day in inc4 and len(inc4) <= 2 and all(x in (hole4_day, (HOLE4 - 4 * H) // D * D) for x in inc4), inc4)
            shot(page, "liq_en_1y")
            # share link, picture
            page.click("#ob-share")
            page.wait_for_timeout(200)
            link = page.evaluate("() => navigator.clipboard.readText()")
            check("the link carries the coin and the range", "coin=BTC" in link and "range=1y" in link, link)
            with page.expect_download() as dl:
                page.click("#ob-png")
            check("the picture is saved", dl.value.suggested_filename == "entekhab-liqhist-BTC.png", dl.value.suggested_filename)
            check("no JS errors (liquidations)", not errors, errors[:3])
            ctx.close()
            # another coin: its own figures, the missed hours read from Bitcoin's rows
            ctx, page, errors = new_page(br, 1280, 900, "en")
            REQ.clear()
            page.goto(base + "/charts/liquidations/?coin=ETH&range=1m")
            wait_fl(page, okx_too=True)
            s5 = page.evaluate("() => { const V = OB._fl.V; return { coin: V.data.base, range: V.data.R.k, now: V.data.now, checked: V.data.h1.checked, bk: V.bk.map(x => [x.t, x.ll, x.sl, x.bad, x.src]), okx: V.okx.state, n: V.okx.list ? V.okx.list.length : -1 }; }")
            X5 = liq_expected("ETHUSDT", 30 * D, D, s5["now"])
            gs = [r for r in REQ if r[0] == "gate" and r[1] == "contract_stats"]
            check("a shared link opens its coin and range", s5["coin"] == "ETH" and s5["range"] == "1m" and len(s5["bk"]) == 30, (s5["coin"], s5["range"], len(s5["bk"])))
            check("Ether’s bars are Ether’s figures (half of Bitcoin’s in the mock)", [tuple(b) for b in s5["bk"]] == [tuple(b) for b in X5["buckets"]] and near(s5["bk"][3][1], 150000, 1e-9), s5["bk"][3])
            check("the missed hour is found from Bitcoin’s rows of the same request", s5["checked"] and sorted({r[2]["contract"] for r in gs}) == ["BTC_USDT", "ETH_USDT"] and any(b[3] for b in s5["bk"]), [r[2] for r in gs])
            t5 = tiles(page)
            check("OKX has no such orders in the mock: the tile shows zero and the table is hidden", s5["okx"] == "ok" and s5["n"] == 0 and num(t5[4]["v"]) == 0 and page.locator("#ob-okx").is_hidden(), t5[4])
            check("no JS errors (liquidations, ETH)", not errors, errors[:3])
            ctx.close()

        # ============================================================ CVD
        if not ONLY or ONLY == "cvd":
            print("[cvd]")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            REQ.clear()
            page.goto(base + "/charts/cvd/")
            wait_fl(page)
            d = page.evaluate("() => { const D0 = OB._fl.V.data; return { range: D0.R.k, iv: D0.R.iv, from: D0.from, now: D0.now, spot: D0.spot.length, fut: D0.fut.rows.length, ex: D0.fut.ex, s0: D0.spot[0].t, unit: OB._fl.S.cv_u }; }")
            n = (min(d["now"], NOW) // H * H - d["from"]) // H + 1
            check("opens on Bitcoin, one week of hourly candles, in coins, futures from Binance", d["range"] == "1w" and d["iv"] == "1h" and d["ex"] == "binance" and d["unit"] == "coin" and d["s0"] == d["from"] and d["spot"] == n and d["fut"] == n and 167 <= n <= 168, d)
            t = tiles(page)
            check("tile 1: spot — takers bought 60 of every 100, so +20 a candle", "Spot" in t[0]["l"] and near(num(t[0]["v"]), 20 * n, 1e-9) and t[0]["v"].startswith("+") and "BTC" in t[0]["v"] and "Binance" in t[0]["s"], t[0])
            check("tile 2: futures — takers bought 200 of every 500, so −100 a candle", "Futures" in t[1]["l"] and near(num(t[1]["v"]), -100 * n, 0.006) and "Binance" in t[1]["s"], t[1])
            c0 = E.candle("BTCUSDT", d["from"], H)[0]
            c1 = E.candle("BTCUSDT", d["from"] + (n - 1) * H, H)[3]
            check("tile 3: the price change over the same candles", near(num(t[2]["v"]), (c1 / c0 - 1) * 100, 0, 0.006) and near(num(t[2]["s"]), c1, 0.001), (t[2], (c1 / c0 - 1) * 100))
            pn = panes(page, "_fl")
            check("three panes: candles, spot CVD, futures CVD", len(pn) == 3 and pn[0]["series"][0]["type"] == "candle" and pn[0]["series"][0]["n"] == n and "Spot CVD (BTC)" in pn[1]["title"] and "Binance" in pn[2]["title"], [x["title"] for x in pn])
            check("the spot line: one point a candle, drawn at the candle’s middle, running from +20 to 20 × n", pn[1]["series"][0]["n"] == n and pn[1]["series"][0]["first"] == [d["from"] + H // 2, 20] and near(pn[1]["series"][0]["last"][1], 20 * n, 1e-9), pn[1]["series"][0])
            check("the futures line runs from −100 to −100 × n", pn[2]["series"][0]["first"] == [d["from"] + H // 2, -100] and near(pn[2]["series"][0]["last"][1], -100 * n, 1e-9), pn[2]["series"][0])
            check("the note says what a taker is and that each line is one exchange", "taker" in page.inner_text("#ob-note").lower() and "one exchange" in page.inner_text("#ob-note"), page.inner_text("#ob-note")[:120])
            shot(page, "cvd_en_1w")
            # dollars
            clicks(page, "#ob-u", "usd")
            t = tiles(page)
            du = sum(20 * E.candle("BTCUSDT", d["from"] + i * H, H)[3] for i in range(n))
            pn = panes(page, "_fl")
            check("in dollars: each candle’s delta at that candle’s own price", near(num(t[0]["v"]), du, 0.006) and near(pn[1]["series"][0]["last"][1], du, 1e-6) and near(pn[2]["series"][0]["last"][1], -5 * du, 1e-6) and "($)" in pn[1]["title"], (t[0], du))
            clicks(page, "#ob-u", "coin")
            # 24 hours of 5-minute candles
            clicks(page, "#ob-r", "24h")
            wait_fl(page)
            d2 = page.evaluate("() => { const D0 = OB._fl.V.data; return { iv: D0.R.iv, from: D0.from, now: D0.now, spot: D0.spot.length }; }")
            n2 = (min(d2["now"], NOW) // (5 * MIN) * (5 * MIN) - d2["from"]) // (5 * MIN) + 1
            check("24 hours: 5-minute candles", d2["iv"] == "5m" and d2["spot"] == n2 and 285 <= n2 <= 288 and near(num(tiles(page)[0]["v"]), 20 * n2, 1e-9), (d2, n2))
            clicks(page, "#ob-r", "1y")
            wait_fl(page)
            d3 = page.evaluate("() => { const D0 = OB._fl.V.data, P = OB._fl.V.ts.P; return { iv: D0.R.iv, n: D0.spot.length, first: P[1].series[0].data[0], daily: OB._fl.V.ts.daily }; }")
            check("1 year: daily candles, the line’s points on the day itself", d3["iv"] == "1d" and 364 <= d3["n"] <= 365 and d3["first"][0] % D == 0 and d3["daily"], d3)
            page.click("#ob-share")
            page.wait_for_timeout(200)
            link = page.evaluate("() => navigator.clipboard.readText()")
            check("the link carries coin, range and unit", "coin=BTC" in link and "range=1y" in link and "unit=coin" in link, link)
            with page.expect_download() as dl:
                page.click("#ob-png")
            check("the picture is saved", dl.value.suggested_filename == "entekhab-cvd-BTC.png", dl.value.suggested_filename)
            check("no JS errors (cvd)", not errors, errors[:3])
            ctx.close()
            # Binance's futures unreachable: the futures line is Gate's
            ctx, page, errors = new_page(br, 1280, 900, "en", block=("binance",))
            REQ.clear()
            page.goto(base + "/charts/cvd/?range=1w&unit=coin")
            wait_fl(page)
            g = page.evaluate("() => { const D0 = OB._fl.V.data, P = OB._fl.V.ts.P; return { ex: D0.fut.ex, bad: D0.fut.bad, n: D0.fut.rows.length, from: D0.from, now: D0.now, spot: D0.spot.length, last: P[2].series[0].data[P[2].series[0].data.length - 1], title: P[2].title }; }")
            ng = (NOW // H * H - g["from"]) // H + 1
            t = tiles(page)
            note = page.inner_text("#ob-note")
            check("Binance’s futures blocked: the futures line comes from Gate’s hourly rows and is named so", g["ex"] == "gate" and "Gate" in g["title"] and "Gate" in t[1]["s"] and g["n"] == ng, (g["ex"], g["title"], g["n"], ng))
            check("Gate: +2.4 BTC an hour (36,000 − 12,000 contracts of 0.0001 BTC), nothing in the hour the statistics missed", near(g["last"][1], 2.4 * (ng - 1), 1e-9) and near(num(t[1]["v"]), 2.4 * (ng - 1), 0.006), (g["last"], t[1]))
            check("…and the note says so: Binance did not answer, two candles are incomplete", g["bad"] == 2 and "Binance’s futures did not answer" in note and "2 candles of Gate’s line are incomplete" in note, note[-230:])
            check("spot still comes from Binance’s public mirror", g["spot"] == ng and near(num(t[0]["v"]), 20 * ng, 1e-9), t[0])
            gq = [r[2] for r in REQ if r[0] == "gate" and r[1] == "contract_stats"]
            check("Gate was asked for hourly rows of Bitcoin once (its own rows tell the missed hours)", len(gq) == 1 and gq[0]["interval"] == "1h" and gq[0]["contract"] == "BTC_USDT", gq)
            shot(page, "cvd_en_gate")
            clicks(page, "#ob-r", "24h")
            wait_fl(page)
            g2 = page.evaluate("() => { const D0 = OB._fl.V.data; return { n: D0.fut.rows.length, from: D0.from, d: D0.fut.rows[5].d, bad: D0.fut.bad }; }")
            gq = [r[2] for r in REQ if r[0] == "gate" and r[1] == "contract_stats"]
            check("24 hours on Gate: 5-minute rows, +0.2 BTC a candle", gq[-1]["interval"] == "5m" and near(g2["d"], 0.2, 1e-9) and g2["bad"] == 0 and 285 <= g2["n"] <= 288, (gq[-1], g2))
            clicks(page, "#ob-r", "1y")
            wait_fl(page)
            g3 = page.evaluate("() => { const D0 = OB._fl.V.data, P = OB._fl.V.ts.P; return { n: D0.fut.rows.length, t0: D0.fut.rows[0].t, from: D0.from, spot0: P[1].series[0].data[0], fut0: P[2].series[0].data[0], view: OB._fl.V.ts.v.x0 }; }")
            note = page.inner_text("#ob-note")
            check("1 year on Gate: its hourly rows reach back 83 days, so both lines begin there and the note says so", 81 <= g3["n"] <= 84 and g3["t0"] > g3["from"] and g3["spot0"][0] == g3["t0"] and g3["fut0"][0] == g3["t0"] and near(g3["spot0"][1], 20, 1e-9)
                  and "Gate’s figures begin" in note, (g3, note[-120:]))
            check("no JS errors (cvd, Gate)", not errors, errors[:3])
            ctx.close()

        # ============================================================ basis and premium
        if not ONLY or ONLY == "basis":
            print("[basis]")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            REQ.clear()
            page.goto(base + "/charts/basis/")
            wait_pr(page)
            s = PSUM["btc"]
            v = page.evaluate("() => ({ asset: OB._pr.S.asset, view: OB._pr.S.bview, range: OB._pr.S.cb_r, daily: OB._pr.V.ts.daily })")
            check("opens on Bitcoin’s Coinbase premium, one month of hours", v == {"asset": "btc", "view": "cb", "range": "1m", "daily": False}, v)
            check("only the hourly file is read for an hourly range", [r[1] for r in REQ if r[0] == "file"] == ["premium"], [r[1] for r in REQ if r[0] == "file"])
            t = tiles(page)
            check("five tiles", len(t) == 5, [x["l"] for x in t])
            check("tile 1: the last closed hour: Coinbase 50,050 over Binance 50,000 = +0.100 %; Tether-adjusted about zero", t[0]["v"] == "+0.100%" and near(num(t[0]["v"]), s["now"], 0, 0.0006) and near(num(t[0]["s"]), s["now_adj"], 0, 0.0006), (t[0], s["now"], s["now_adj"]))
            check("tile 2: the 24-hour average: one hour at +0.1 %, 23 at zero", near(num(t[1]["v"]), 0.1 / 24, 0, 0.0006) and near(num(t[1]["v"]), s["h24"], 0, 0.0006), (t[1], s["h24"]))
            check("tile 3: the 7-day average, the 30-day one beside it", near(num(t[2]["v"]), s["d7"], 0, 0.0006) and near(num(t[2]["s"].split("days")[-1]), s["d30"], 0, 0.0006), (t[2], s["d7"], s["d30"]))
            check("tile 4: the last daily close and its rank among all days", near(num(t[3]["v"]), s["day_prem"], 0, 0.0006) and near(num(t[3]["s"]), s["day_pct"], 0, 0.6), (t[3], s["day_prem"], s["day_pct"]))
            check("tile 5: Tether on Coinbase, and its distance from a dollar", t[4]["v"] == "$1.0010" and near(num(t[4]["s"]), 0.1, 0, 0.006), t[4])
            pn = panes(page, "_pr")
            g = FILES["premium"]["h"]
            end_close = g["t0"] + g["n"] * g["step"]
            check("three panes: Coinbase’s price, the premium (plain and Tether-adjusted), Tether’s price", len(pn) == 3 and len(pn[1]["series"]) == 2 and pn[0]["series"][0]["n"] == 2160 and pn[2]["series"][0]["n"] == 2160, [(x["title"], [q["n"] for q in x["series"]]) for x in pn])
            check("the premium line ends on the summary’s figure, at the hour’s closing time", pn[1]["series"][0]["last"][0] == end_close == s["t"] and near(pn[1]["series"][0]["last"][1], s["now"], 1e-4) and near(pn[1]["series"][1]["last"][1], s["now_adj"], 1e-3, 1e-6), (pn[1]["series"][0]["last"], end_close, s["t"]))
            check("the price pane is Coinbase’s close", pn[0]["series"][0]["last"] == [end_close, 50050], pn[0]["series"][0]["last"])
            vw = page.evaluate("() => { const v = OB._pr.V.ts.v; return [v.x0, v.x1]; }")
            check("one month on screen", near(vw[1] - vw[0], 30 * D * 1.02, 0.02), (vw[1] - vw[0]) / D)
            check("the note gives the definition and the last closed hour", "Coinbase ÷ Binance − 1" in page.inner_text("#ob-note") and "Last hour closed" in page.inner_text("#ob-note"), page.inner_text("#ob-note")[-160:])
            shot(page, "basis_en_cb")
            # a daily range reads the daily file
            clicks(page, "#ob-r", "all")
            wait_pr(page)
            pn = panes(page, "_pr")
            dd = FILES["premium_d"]["d"]
            check("“all”: the daily file is read then, from Binance’s first day", "premium_d" in [r[1] for r in REQ if r[0] == "file"] and page.evaluate("() => OB._pr.V.ts.daily") and pn[1]["series"][0]["n"] == dd["n"] and pn[1]["series"][0]["first"][0] == dd["t0"], (pn[1]["series"][0]["n"], dd["n"]))
            check("the daily line ends on yesterday’s close", pn[1]["series"][0]["last"][0] == dd["t0"] + (dd["n"] - 1) * D and near(pn[1]["series"][0]["last"][1], s["day_prem"], 1e-4, 1e-9), pn[1]["series"][0]["last"])
            check("Tether’s daily line begins when Coinbase listed it", pn[1]["series"][1]["first"][0] == K.START["USDT-USD"] * 1000 and pn[2]["series"][0]["first"][0] == K.START["USDT-USD"] * 1000, pn[1]["series"][1]["first"])
            clicks(page, "#ob-r", "1w")
            wait_pr(page)
            vw = page.evaluate("() => { const v = OB._pr.V.ts.v; return [v.x0, v.x1]; }")
            check("back to a week of hours", not page.evaluate("() => OB._pr.V.ts.daily") and near(vw[1] - vw[0], 7 * D * 1.02, 0.03), (vw[1] - vw[0]) / D)
            # Ether
            clicks(page, "#ob-as", "eth")
            page.wait_for_timeout(300)
            t = tiles(page)
            check("Ether: −0.100 % in every hour", t[0]["v"] == "-0.100%" and near(num(t[1]["v"]), -0.1, 0, 0.0006) and "ETH" in panes(page, "_pr")[0]["title"], t[0])
            clicks(page, "#ob-as", "btc")
            # the perpetual's premium (Bybit)
            clicks(page, "#ob-v", "perp")
            wait_pr(page)
            pd = page.evaluate("() => { const D0 = OB._pr.V.data; return { view: D0.view, range: D0.R.k, iv: D0.R.iv, t0: D0.t0, n: D0.prem.length, last: D0.prem[D0.prem.length - 1], candles: D0.candles ? D0.candles.length : 0 }; }")
            step = 30 * MIN
            ts = E.grid(pd["t0"], NOW, step, 1000)
            vals = [prem_at(x, step) * 100 for x in ts]
            t = tiles(page)
            check("the perpetual’s premium: Bybit’s index, one week of 30-minute candles", pd["view"] == "perp" and pd["range"] == "1w" and pd["iv"] == "30m" and pd["n"] == len(ts) and pd["candles"] >= len(ts) - 1, pd)
            check("tile 1: the last close, in per cent", near(num(t[0]["v"]), vals[-1], 0, 6e-5) and near(pd["last"][1], vals[-1], 1e-6, 1e-9), (t[0], vals[-1]))
            pos = sum(1 for x in vals if x > 0) / len(vals) * 100
            check("tile 2: the average over the range and the share of time above zero", near(num(t[1]["v"]), sum(vals) / len(vals), 0, 6e-5) and near(num(t[1]["s"]), pos, 0, 0.6), (t[1], sum(vals) / len(vals), pos))
            check("tiles 3 and 4: the highest (+0.03 %) and the lowest (−0.03 %)", near(num(t[2]["v"]), 0.03, 0, 6e-5) and near(num(t[3]["v"]), -0.03, 0, 6e-5), (t[2], t[3]))
            pn = panes(page, "_pr")
            check("two panes: Bybit’s candles and the premium line, drawn at each candle’s middle", len(pn) == 2 and pn[0]["series"][0]["type"] == "candle" and pn[1]["series"][0]["n"] == len(ts) and pn[1]["series"][0]["first"][0] == ts[0] + step // 2 and "Bybit" in pn[1]["title"], [x["title"] for x in pn])
            check("the range control is the perpetual’s own", page.locator("#ob-r button").count() == 6, page.locator("#ob-r button").count())
            shot(page, "basis_en_perp")
            clicks(page, "#ob-r", "1y")
            wait_pr(page)
            pd2 = page.evaluate("() => { const D0 = OB._pr.V.data; return { iv: D0.R.iv, n: D0.prem.length, daily: OB._pr.V.ts.daily }; }")
            check("one year: daily closes", pd2["iv"] == "1d" and 364 <= pd2["n"] <= 366 and pd2["daily"], pd2)
            # the futures curve (Deribit)
            clicks(page, "#ob-v", "curve")
            wait_pr(page)
            cu = page.evaluate("() => { const c = OB._pr.V.data.curve; return { index: c.index, perp: c.perp, exps: c.exps.map(x => [x.name, x.days, x.mark, x.basis, x.ann, x.oi]), oi: c.oi, now: OB._pr.V.data.now }; }")
            days = [(dt.timestamp() * 1000 - cu["now"]) / D for dt, _ in FUT]
            check("the curve: four dated futures in expiry order; the expired one, the option and the one without a price left out", [x[0] for x in cu["exps"]] == [fname("BTC", dt) for dt, _ in FUT] and all(near(x[1], dy, 1e-6, 1e-4) for x, dy in zip(cu["exps"], days)), [x[0] for x in cu["exps"]])
            t = tiles(page)
            check("tile 1: the index", "$70,000" in t[0]["v"] and "Deribit" in t[0]["s"], t[0])
            check("tile 2: the perpetual 0.1 % above the index (+70 dollars)", t[1]["v"] == "+0.100%" and near(num(t[1]["s"]), 70, 0.01), t[1])
            check("tile 3: the yearly basis of the dated future with the most open interest: 0.05 % a day × 365 = 18.25 %", fname("BTC", FUT[2][0]).split("-")[1] in t[2]["l"] and t[2]["v"] == "+18.25%" and near(nums(t[2]["s"])[0], BAS_DAY * 100 * days[2], 0, 0.02), t[2])
            check("tile 4: open interest of the dated futures", near(num(t[3]["v"]), 1.36e8, 0.006) and near(num(t[3]["s"]), 4, 1e-9), t[3])
            pn = panes(page, "_pr")
            check("two panes over the expiry dates: the price from today’s index out to the last expiry, and the yearly basis of the three that are two days away or more",
                  len(pn) == 2 and pn[0]["series"][0]["n"] == 5 and pn[0]["series"][0]["first"] == [cu["now"], 70000] and pn[0]["series"][0]["last"][0] == int(FUT[3][0].timestamp() * 1000) and pn[1]["series"][0]["n"] == 3
                  and all(near(pt, 18.25, 1e-4) for pt in [pn[1]["series"][0]["first"][1], pn[1]["series"][0]["last"][1]]), [(x["title"], x["series"][0]["n"], x["series"][0]["first"], x["series"][0]["last"]) for x in pn])
            rows = page.evaluate("() => [...document.querySelectorAll('#ob-ctbl tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()))")
            check("the table: the perpetual and the four futures", len(rows) == 5 and rows[0][0] == "BTC-PERPETUAL" and rows[0][6] == "—" and rows[0][5] == "+0.100%", rows[0])
            check("the nearest expiry is not annualised (under two days); the others read +18.25 %", rows[1][6] == "—" and all(r[6] == "+18.25%" for r in rows[2:]) and near(num(rows[3][7]), 9e7, 0.006) and near(num(rows[3][8]), 9e6, 0.006), [r[6] for r in rows])
            check("no range control on the curve", page.locator("#ob-r").count() == 0 and "ob-off" in page.get_attribute("#ob-gear", "class"), page.get_attribute("#ob-gear", "class"))
            shot(page, "basis_en_curve")
            clicks(page, "#ob-as", "eth")
            wait_pr(page)
            check("Ether’s curve", "$2,000" in tiles(page)[0]["v"] and page.evaluate("() => document.querySelector('#ob-ctbl tbody tr td').textContent") == "ETH-PERPETUAL", tiles(page)[0])
            page.click("#ob-share")
            page.wait_for_timeout(200)
            link = page.evaluate("() => navigator.clipboard.readText()")
            check("the link carries asset and view", "asset=eth" in link and "view=curve" in link and "range" not in link, link)
            with page.expect_download() as dl:
                page.click("#ob-png")
            check("the picture is saved", dl.value.suggested_filename == "entekhab-basis-curve-ETH.png", dl.value.suggested_filename)
            check("no JS errors (basis)", not errors, errors[:3])
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/basis/?asset=eth&view=perp&range=3d")
            wait_pr(page)
            o = page.evaluate("() => ({ a: OB._pr.S.asset, v: OB._pr.S.bview, r: OB._pr.V.data.R.k })")
            check("a shared link opens its asset, view and range", o == {"a": "eth", "v": "perp", "r": "3d"}, o)
            check("no JS errors (basis link)", not errors, errors[:3])
            ctx.close()

        # ============================================================ stablecoins
        if not ONLY or ONLY == "stables":
            print("[stablecoins]")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            REQ.clear()
            page.goto(base + "/charts/stablecoins/")
            wait_pr(page)
            s = SSUM
            hist = FILES["stables"]
            check("both files are read", sorted(r[1] for r in REQ if r[0] == "file") == ["stables", "stables_now"], [r[1] for r in REQ if r[0] == "file"])
            t = tiles(page)
            check("four tiles", len(t) == 4, [x["l"] for x in t])
            check("tile 1: the supply at the end of yesterday", near(num(t[0]["v"]), s["usd"], 0.006) and s["date"] == YDAY, (t[0], s["usd"]))
            check("tile 2: the 30-day change: 100 million a day → +3 billion, with its per cent and the 7-day change", near(num(t[1]["v"]), 3e9, 0.006) and t[1]["v"].startswith("+") and near(nums(t[1]["s"])[0], s["chg30_pct"], 0, 0.006) and near(num(t[1]["s"].split("days")[-1]), 7e8, 0.006), t[1])
            check("tile 3: SSR = Bitcoin’s 1,000 billion ÷ the supply, with its rank (the lowest day so far)", near(num(t[2]["v"]), 1e12 / s["usd"], 0, 0.006) and near(num(t[2]["s"]), s["ssr_pct"], 0, 0.06), (t[2], s["ssr"], s["ssr_pct"]))
            check("tile 4: Tether’s share, USDC’s beside it", near(num(t[3]["v"]), s["usdt_share"], 0, 0.06) and near(num(t[3]["s"]), s["usdc_share"], 0, 0.06), t[3])
            pn = panes(page, "_pr")
            last_t = int(datetime.strptime(YDAY, "%Y-%m-%d").replace(tzinfo=UTC).timestamp() * 1000)
            check("supply: Bitcoin’s market value above, the supply below, one point a day to yesterday", len(pn) == 2 and pn[1]["series"][0]["type"] == "area" and pn[1]["series"][0]["n"] == hist["n"] and pn[1]["series"][0]["last"][0] == last_t
                  and near(pn[1]["series"][0]["last"][1], s["usd"], 1e-9) and near(pn[0]["series"][0]["last"][1], 1e12, 1e-9), [(x["title"], x["series"][0]["n"], x["series"][0]["last"]) for x in pn])
            rows = page.evaluate("() => [...document.querySelectorAll('#ob-stbl tbody tr')].map(tr => ({ c: [...tr.children].map(td => td.textContent.trim()), img: tr.querySelector('img') ? tr.querySelector('img').getAttribute('src') : null }))")
            check("the table: Tether, USDC and Dai, each with its own logo; the imitation of Tether’s ticker and the euro coin are not named", [r["c"][0].split()[0] for r in rows] == ["USDT", "USDC", "DAI"] and [r["img"] for r in rows] == ["/data/logos/USDT.png", "/data/logos/USDC.png", "/data/logos/DAI.png"], rows)
            check("…with what is in circulation and the change in a day, a week and a month; a missing figure is a dash", near(num(rows[0]["c"][1]), 175e9, 0.006) and near(num(rows[0]["c"][2]), -3e8, 0.006) and near(num(rows[0]["c"][3]), -1e9, 0.006)
                  and near(num(rows[0]["c"][4]), -8e9, 0.006) and rows[1]["c"][4] == "—" and rows[2]["c"][2] == "—", [r["c"] for r in rows])
            shot(page, "stables_en_supply")
            clicks(page, "#ob-m", "ssr")
            pn = panes(page, "_pr")
            check("SSR: both sides of the ratio above, the ratio below, ending on the summary’s figure", len(pn) == 2 and len(pn[0]["series"]) == 2 and near(pn[1]["series"][0]["last"][1], s["ssr"], 1e-9) and near(pn[1]["series"][0]["first"][1], 10.0, 1e-6), [(x["title"], len(x["series"])) for x in pn])
            shot(page, "stables_en_ssr")
            clicks(page, "#ob-m", "chg")
            pn = panes(page, "_pr")
            check("30-day change: bars that begin 30 days into the history and end on the summary’s figure", pn[1]["series"][0]["type"] == "bars" and pn[1]["series"][0]["n"] == hist["n"] - 30 and near(pn[1]["series"][0]["last"][1], s["chg30"], 1e-6), pn[1]["series"][0])
            clicks(page, "#ob-m", "mix")
            pn = panes(page, "_pr")
            rest = s["usd"] - s["usdt"] - s["usdc"]
            check("by coin: Tether, USDC and all the others; Tether’s share below", [q["name"] for q in pn[0]["series"]][:2] == ["USDT", "USDC"] and near(pn[0]["series"][0]["last"][1], s["usdt"], 1e-9) and near(pn[0]["series"][2]["last"][1], rest, 1e-6)
                  and near(pn[1]["series"][0]["last"][1], s["usdt_share"], 1e-9), [(q["name"], q["last"]) for q in pn[0]["series"]])
            shot(page, "stables_en_mix")
            vw0 = page.evaluate("() => { const v = OB._pr.V.ts.v; return v.x1 - v.x0; }")
            clicks(page, "#ob-r", "1y")
            vw1 = page.evaluate("() => { const v = OB._pr.V.ts.v; return v.x1 - v.x0; }")
            check("ranges: the history holds under four years, one year shows a year", near(vw1, 365.25 * D * 1.02, 0.02) and vw0 > vw1 * 3, (vw0 / D, vw1 / D))
            clicks(page, "#ob-sc", "lin")
            check("the scale switch", page.evaluate("() => OB._pr.V.ts.P[0].log") is False and page.evaluate("() => OB._pr.S.log") is False)
            clicks(page, "#ob-sc", "log")
            page.click("#ob-share")
            page.wait_for_timeout(200)
            link = page.evaluate("() => navigator.clipboard.readText()")
            check("the link carries the measure and the range", "m=mix" in link and "range=1y" in link, link)
            with page.expect_download() as dl:
                page.click("#ob-png")
            check("the picture is saved", dl.value.suggested_filename == "entekhab-stablecoins-mix.png", dl.value.suggested_filename)
            check("no JS errors (stablecoins)", not errors, errors[:3])
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/stablecoins/?m=ssr&range=2y")
            wait_pr(page)
            o = page.evaluate("() => ({ m: OB._pr.S.st_m, r: OB._pr.S.st_r, on: document.querySelector('#ob-m button.on').getAttribute('data-v') })")
            check("a shared link opens its measure and range", o == {"m": "ssr", "r": "2y", "on": "ssr"}, o)
            sub = tiles(page)[2]["s"]
            check("the SSR tile names no day while it is the supply’s own day", s["ssr_date"] == s["date"] and not re.search(r"20\d\d", sub), sub)
            check("no JS errors (stablecoins link)", not errors, errors[:3])
            ctx.close()
            # Bitcoin's file a day behind the supply (Coin Metrics publishes a day some hours after DefiLlama): the tile says which day the SSR is of
            before = datetime.strptime(YDAY, "%Y-%m-%d") - timedelta(days=1)
            keep = dict(SSUM)
            SSUM["ssr_date"] = before.strftime("%Y-%m-%d")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/stablecoins/")
            wait_pr(page)
            sub = tiles(page)[2]["s"]
            SSUM.clear()
            SSUM.update(keep)
            check("…and names it when Bitcoin’s value is a day behind", str(before.year) in sub and re.search(r"\b%d\b" % before.day, sub) is not None and near(num(sub), s["ssr_pct"], 0, 0.06), sub)
            check("no JS errors (stablecoins, SSR a day behind)", not errors, errors[:3])
            ctx.close()

        # ============================================================ four languages, two widths
        if not ONLY or ONLY == "langs":
            print("[languages]")
            pages = [("liquidations", "/charts/liquidations/?range=1m", "_fl"), ("cvd", "/charts/cvd/", "_fl"), ("basis", "/charts/basis/", "_pr"), ("curve", "/charts/basis/?view=curve", "_pr"), ("stablecoins", "/charts/stablecoins/", "_pr")]
            h1 = {"liquidations": "liqhist", "cvd": "cvd", "basis": "basis", "curve": "basis", "stablecoins": "stables"}
            import build_obs as B
            for lang in ("fa", "ckb", "ar", "en"):
                for w, hh, mobile in ((1280, 900, False), (390, 844, True)):
                    ctx, page, errors = new_page(br, w, hh, lang, mobile)
                    for name, path, mod in pages:
                        page.goto(base + path)
                        (wait_fl if mod == "_fl" else wait_pr)(page)
                        if name == "liquidations":
                            page.wait_for_function("() => OB._fl.V.okx && OB._fl.V.okx.state !== 'load'", timeout=40000)
                        tag = f"{lang} {w}px {name}"
                        check(f"{tag}: no sideways scroll", overflow(page) <= 1, overflow(page))
                        check(f"{tag}: fourteen tabs, this one marked", page.locator(".ob-tab").count() == 14 and page.locator(".ob-tab.on").count() == 1)
                        head = page.evaluate("() => { const e = [...document.querySelectorAll('.ob-head h1 [data-lang]')].find(x => !x.hidden); return e ? e.textContent : ''; }")
                        check(f"{tag}: the heading in its language", head == B.T[h1[name]]["h1"][lang], head)
                        tl = tiles(page)
                        check(f"{tag}: tiles filled", len(tl) >= 3 and all(x["v"].strip() not in ("", "…") for x in tl), [x["v"] for x in tl])
                        check(f"{tag}: the chart is drawn", E.colours(page) > 8, E.colours(page))
                        dirn = page.evaluate("() => document.getElementById('ob').getAttribute('dir')")
                        check(f"{tag}: direction", dirn == ("ltr" if lang == "en" else "rtl"), dirn)
                        about = page.evaluate("() => { const e = [...document.querySelectorAll('.ob-about')].find(x => !x.hidden); return e ? e.getAttribute('data-lang') + ':' + e.querySelectorAll('li').length : ''; }")
                        check(f"{tag}: the text under the chart in its language", about.split(":")[0] == lang and int(about.split(":")[1]) >= 11, about)
                        if mobile and name in ("basis", "stablecoins"):
                            page.click("#ob-gear")
                            page.wait_for_timeout(200)
                            check(f"{tag}: the settings open under the tools on a phone", page.locator("#ob-more").is_visible() and overflow(page) <= 1)
                            page.click("#ob-gear")
                        if name in ("liquidations", "stablecoins", "curve"):
                            check(f"{tag}: the table is there", page.locator("#ob-tbl table tbody tr").count() >= 3, page.locator("#ob-tbl table tbody tr").count())
                        shot(page, f"{name}_{lang}_{w}")
                    check(f"{lang} {w}px: no JS errors", not errors, errors[:3])
                    ctx.close()

        # ============================================================ when a source is missing
        if not ONLY or ONLY == "errors":
            print("[missing sources]")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            DOWN.add("gate")
            page.goto(base + "/charts/liquidations/")
            page.wait_for_selector("#ob-status.err", timeout=40000)
            msg = page.inner_text("#ob-status")
            check("Gate unreachable: the page says so and offers to try again", "Gate" in msg and "BTC" in msg and page.locator("#ob-retry").count() == 1, msg)
            DOWN.discard("gate")
            page.click("#ob-retry")
            wait_fl(page, okx_too=True)
            check("…and trying again loads it", len(tiles(page)) == 5 and page.locator("#ob-status").is_hidden())
            DOWN.add("okx")
            page.click("#ob-refresh")
            wait_fl(page, okx_too=True)
            t = tiles(page)
            check("OKX unreachable: Gate’s bars stand, OKX’s tile says it did not answer", num(t[0]["v"]) > 0 and t[4]["v"] == "—" and "OKX" in t[4]["s"] and page.locator("#ob-okx").is_hidden(), t[4])
            DOWN.discard("okx")
            DOWN.add("gate4h")
            page.goto(base + "/charts/liquidations/?range=1y")
            wait_fl(page, okx_too=True)
            e1 = page.evaluate("() => ({ n: OB._fl.V.bk.length, src: [...new Set(OB._fl.V.bk.map(x => x.src))], note: document.getElementById('ob-note').textContent })")
            check("the 4-hour rows missing: the year shows the 83 days the hourly rows hold and says so", 81 <= e1["n"] <= 84 and e1["src"] == ["1h"] and "older figures did not arrive" in e1["note"], (e1["n"], e1["note"][-120:]))
            DOWN.discard("gate4h")
            page.goto(base + "/charts/liquidations/?coin=XRP")
            page.wait_for_selector("#ob-status.err", timeout=40000)
            check("a coin Gate does not list: said plainly, with the coin’s name", "XRP" in page.inner_text("#ob-status"), page.inner_text("#ob-status"))
            check("no JS errors (liquidations, missing sources)", not errors, errors[:3])
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "en")
            REQ.clear()
            page.goto(base + "/charts/cvd/?coin=PEPE&range=1w")
            wait_fl(page)
            t = tiles(page)
            note = page.inner_text("#ob-note")
            probe = [r for r in REQ if r[0] == "spot" and r[2].get("symbol") == "BTCUSDT"]
            nf = page.evaluate("() => OB._fl.V.data.fut.rows.length")
            check("a coin with no spot market on Binance (the mirror refuses it without CORS headers): one question about Bitcoin tells that from a dead connection, and the note says there is no such market",
                  t[0]["v"] == "—" and len(probe) == 1 and "no spot market against Tether" in note and "could not be read" not in note, (t[0], note[-130:], probe))
            check("…its futures line stands, in single coins (1000PEPE × 1000)", "Binance" in t[1]["s"] and near(num(t[1]["v"]), -100 * 1000 * nf, 0.006) and "PEPE" in t[1]["v"] and "1000PEPE" not in t[1]["v"], t[1])
            DOWN.add("spot_other")
            page.goto(base + "/charts/cvd/?coin=ETH&range=1w")
            wait_fl(page)
            t = tiles(page)
            note = page.inner_text("#ob-note")
            check("spot candles at three times the coin’s price are another coin’s: they are not drawn", t[0]["v"] == "—" and "no spot market against Tether" in note and num(t[1]["v"]) is not None and len(panes(page, "_fl")) == 2, (t[0], note[-130:]))
            DOWN.discard("spot_other")
            check("no JS errors (cvd, no spot market)", not errors, errors[:3])
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "en")
            DOWN.add("spot")
            page.goto(base + "/charts/cvd/?coin=BTC&range=1w")
            wait_fl(page)
            t = tiles(page)
            note = page.inner_text("#ob-note")
            check("no spot candles: futures alone, their own candles above, and the note says so", t[0]["v"] == "—" and near(num(t[1]["v"]), -100 * page.evaluate("() => OB._fl.V.data.fut.rows.length"), 0.006) and len(panes(page, "_fl")) == 2 and "spot figures could not be read this time" in note and "no spot market" not in note, (t, note[-100:]))
            DOWN.add("futures")
            DOWN.add("gate")
            page.click("#ob-refresh")
            page.wait_for_selector("#ob-status.err", timeout=40000)
            check("nothing reachable: the page says so and offers to try again", "Neither Binance nor Gate" in page.inner_text("#ob-status") and page.locator("#ob-retry").count() == 1, page.inner_text("#ob-status"))
            DOWN.discard("spot")
            DOWN.discard("gate")
            page.click("#ob-retry")
            wait_fl(page)
            t = tiles(page)
            check("Binance’s futures candles failing though its list answers: Gate’s line instead", "Gate" in t[1]["s"] and num(t[0]["v"]) > 0 and "Binance’s futures did not answer" in page.inner_text("#ob-note"), t[1])
            DOWN.add("gate")
            clicks(page, "#ob-r", "3d")                                # another range: Gate's rows of the week are kept for 45 seconds and would still answer
            wait_fl(page)
            t = tiles(page)
            check("no futures at all: spot alone, and the note says so", num(t[0]["v"]) > 0 and t[1]["v"] == "—" and "only the spot line is shown" in page.inner_text("#ob-note") and len(panes(page, "_fl")) == 2, t[1])
            DOWN.clear()
            check("no JS errors (cvd, missing sources)", not errors, errors[:3])
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "en")
            DOWN.add("premium")
            page.goto(base + "/charts/basis/")
            page.wait_for_selector("#ob-status.err", timeout=40000)
            check("the premium file not written yet: “the data is not here yet”", "not here yet" in page.inner_text("#ob-status") and "several times a day" in page.inner_text("#ob-status"), page.inner_text("#ob-status"))
            DOWN.discard("premium")
            page.click("#ob-retry")
            wait_pr(page)
            check("…then it loads", len(tiles(page)) == 5)
            DOWN.add("premium_d")
            clicks(page, "#ob-r", "1y")
            page.wait_for_selector("#ob-status.err", timeout=40000)
            check("the daily file missing: the daily range says so; the hourly one still works", "not here yet" in page.inner_text("#ob-status"), page.inner_text("#ob-status"))
            clicks(page, "#ob-r", "1m")
            wait_pr(page)
            check("…back on an hourly range the chart is there", page.locator("#ob-status").is_hidden() and len(panes(page, "_pr")) == 3)
            DOWN.discard("premium_d")
            DOWN.add("bybit_prem")
            clicks(page, "#ob-v", "perp")
            page.wait_for_selector("#ob-status.err", timeout=40000)
            check("Bybit unreachable: said by name", "Bybit" in page.inner_text("#ob-status"), page.inner_text("#ob-status"))
            DOWN.discard("bybit_prem")
            DOWN.add("deribit")
            clicks(page, "#ob-v", "curve")
            page.wait_for_selector("#ob-status.err", timeout=40000)
            check("Deribit unreachable: said by name", "Deribit" in page.inner_text("#ob-status"), page.inner_text("#ob-status"))
            DOWN.discard("deribit")
            page.click("#ob-retry")
            wait_pr(page)
            check("…and trying again draws the curve", page.locator("#ob-ctbl tbody tr").count() == 5)
            check("no JS errors (basis, missing sources)", not errors, errors[:3])
            ctx.close()
            ctx, page, errors = new_page(br, 1280, 900, "fa")
            DOWN.add("stables")
            page.goto(base + "/charts/stablecoins/")
            page.wait_for_selector("#ob-status.err", timeout=40000)
            check("the stablecoin file not written yet, in Persian", "داده هنوز نرسیده است" in page.inner_text("#ob-status"), page.inner_text("#ob-status"))
            DOWN.discard("stables")
            DOWN.add("files500")
            page.click("#ob-retry")
            page.wait_for_timeout(1500)
            page.wait_for_selector("#ob-status.err", timeout=40000)
            check("the file unreadable: “the data did not load”", "داده بار نشد" in page.inner_text("#ob-status"), page.inner_text("#ob-status"))
            DOWN.clear()
            page.click("#ob-retry")
            wait_pr(page)
            t = tiles(page)
            check("…then it loads, digits localised in the tiles’ words only", len(t) == 4 and "$" in t[0]["v"] and re.search("[۰-۹]", t[2]["s"]) is not None, t)
            check("no JS errors (stablecoins, missing sources)", not errors, errors[:3])
            ctx.close()

        # ============================================================ the hub
        if not ONLY or ONLY == "hub":
            print("[hub]")
            ctx, page, errors = new_page(br, 1280, 900, "en")
            page.goto(base + "/charts/")
            page.wait_for_timeout(500)
            cards = page.evaluate("() => { const s = [...document.querySelectorAll('#ob-main section')].find(x => !x.hidden); return { hrefs: [...s.querySelectorAll('a.ob-hc')].map(a => a.getAttribute('href')), soon: [...s.querySelectorAll('.ob-hc.soon b')].map(b => b.textContent), lang: s.getAttribute('data-lang') }; }")
            check("the four new charts have their cards", all(x in cards["hrefs"] for x in ("/charts/liquidations/", "/charts/cvd/", "/charts/basis/", "/charts/stablecoins/")) and cards["lang"] == "en", cards["hrefs"])
            check("they are no longer “in the works”; what is, is named", not any("day by day" in x or "CVD" in x or "SSR" in x or "Coinbase" in x for x in cards["soon"]) and len(cards["soon"]) == 3, cards["soon"])
            for path in ("/charts/liquidations/", "/charts/cvd/", "/charts/basis/", "/charts/stablecoins/"):
                check(f"{path} exists as a built page", os.path.exists(os.path.join(ROOT, path.strip("/"), "index.html")))
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
