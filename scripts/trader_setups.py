#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Complete position setups for /trader/ — only when a fixed rule fires and that rule's own record is strong.

Owner's brief (2026-11-26): give the trader the whole position, not questions: which coin, the entry zone and its
layers, the stop, the take-profits, the probability of the move and how much the trade is worth, with a short reason;
exact, disciplined data, and only for setups of high accuracy.

How it stays honest
  * One rule set, written down here before any number was looked at and never tuned to the data: a trend-pullback
    continuation on 4h candles inside the daily trend (RULES below). No parameter is fitted, so the whole history is
    out of sample for it.
  * Its record is replayed on real Binance candles (the same public source as scripts/market.py) for the site's most
    liquid coins: every past signal is traded exactly as the page would publish it, three entry layers, one stop, three
    targets, the stop to break-even after the first target, a time exit, fees and slippage on every fill. Inside one
    candle the worst order is assumed (the stop before any target), so the figures lean pessimistic.
  * A live setup is shown only when the rule fired within its entry window (and has hit neither its stop nor its
    first target since) AND the rule's record on that side is
    strong: enough trades, the lower bound of the average result above zero, and the first target reached before
    the stop in at least QUAL["p1_lo"] of trades (Wilson lower bound); both bounds at z = 2.64, 99% after correcting
    for the six rule-and-side tests. Otherwise the page says there is none.
  * Every number on the page is either a Binance price, a calculation from those prices, or a count from the replay.

Output: trader/setups.json (built, never committed) — read by scripts/build_trader.py and by the bot.
CLI:  python3 scripts/trader_setups.py [--local] [--coins N]     --local uses data/candles (BTC, ETH; short history)
Test: python3 tests/test_trader_setups.py
"""
import json
import math
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "trader")
OUT = os.path.join(OUT_DIR, "setups.json")
H4 = 4 * 3600 * 1000

RULES = {
    "id": "pullback-4h-v1",
    "ema_fast": 20, "ema_slow": 50, "atr": 14, "rsi": 14,
    "touch_atr": 0.25,          # the last two candles came within this many ATR of the 4h EMA20
    "rsi_long": (40, 62), "rsi_short": (38, 60),
    "max_ext_atr": 3.0,         # close no further than this from the 4h EMA50 (not chasing)
    "layers": (0.0, 0.5, 1.0),  # entry layers below (long) / above (short) the signal close, in ATR
    "weights": (0.40, 0.35, 0.25),
    "swing_bars": 6, "stop_atr": 1.5, "stop_pad": 0.25,
    "targets_r": (1.0, 2.0, 3.0),
    "close_at": (0.40, 0.35, 0.25),
    "layer_bars": 6,            # unfilled layers expire after 24h, or as soon as the first target is reached
    "max_bars": 30,             # time exit after 5 days
    "cost_side": 0.15,          # % per fill: 0.10 fee + 0.05 slippage (the site's Truth Lab uses the same)
}
# Two more families, written down on 2026-11-26 after the first one's record came back slightly negative and before
# either was run. Each is traded with the same layers / stop / targets / costs machinery; only the trigger, the candle
# size and the time limits differ. Several rules and two sides mean several tests, so the bar below uses z = 2.64
# (Bonferroni for 6 tests at 5%) for both lower bounds.
FAMILIES = {
    "pullback-4h-v1": {"tf": "4h", "layer_bars": 6, "max_bars": 30, "stop_mode": "swing"},
    "breakout-1d-v1": {"tf": "1d", "layer_bars": 3, "max_bars": 20, "stop_mode": "atr2", "donchian": 20},
    "dip-4h-v1": {"tf": "4h", "layer_bars": 6, "max_bars": 30, "stop_mode": "swing", "rsi_dip": 30, "rsi_pop": 70},
}
Z = 2.64
QUAL = {"n": 60, "p1_lo": 0.40, "ev_lo": 0.0, "coin_n": 15, "z": Z}
# A fixed list of large, long-listed coins (chosen before any result): tokenised stocks and fresh listings stay out.
UNIVERSE_LIST = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "TRX", "LINK", "AVAX",
                 "SUI", "LTC", "DOT", "BCH", "TON", "NEAR", "UNI", "APT", "ATOM", "ETC"]
UNIVERSE = len(UNIVERSE_LIST)
TF_MS = {"4h": H4, "1d": 86400000}


# ------------------------------------------------------------------ indicators (pure)
def ema(v, n):
    k, out, e = 2 / (n + 1), [], None
    for x in v:
        e = x if e is None else x * k + e * (1 - k)
        out.append(e)
    return out


def atr(k, n=14):
    """Wilder's ATR; None until n true ranges exist"""
    out, a, trs = [], None, []
    for i, b in enumerate(k):
        tr = b["h"] - b["l"] if i == 0 else max(b["h"] - b["l"], abs(b["h"] - k[i - 1]["c"]), abs(b["l"] - k[i - 1]["c"]))
        trs.append(tr)
        if i + 1 < n:
            out.append(None)
        elif i + 1 == n:
            a = sum(trs) / n
            out.append(a)
        else:
            a = (a * (n - 1) + tr) / n
            out.append(a)
    return out


def rsi_series(c, n=14):
    out = [None] * len(c)
    if len(c) <= n:
        return out
    g = [max(c[i] - c[i - 1], 0) for i in range(1, len(c))]
    l_ = [max(c[i - 1] - c[i], 0) for i in range(1, len(c))]
    ag, al = sum(g[:n]) / n, sum(l_[:n]) / n
    out[n] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    for i in range(n, len(g)):
        ag, al = (ag * (n - 1) + g[i]) / n, (al * (n - 1) + l_[i]) / n
        out[i + 1] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    return out


def wilson(k, n, z=1.96):
    if n <= 0:
        return 0.0, 0.0
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return max(0.0, (c - h) / d), min(1.0, (c + h) / d)


# ------------------------------------------------------------------ the rule
def prepare(k4, k1d):
    c = [b["c"] for b in k4]
    f = {"e20": ema(c, RULES["ema_fast"]), "e50": ema(c, RULES["ema_slow"]), "atr": atr(k4, RULES["atr"]),
         "rsi": rsi_series(c, RULES["rsi"])}
    dc = [b["c"] for b in k1d]
    d20, d50 = ema(dc, RULES["ema_fast"]), ema(dc, RULES["ema_slow"])
    # the daily trend known at the close of each 4h candle: the last daily candle that had closed by then
    day_end = [b["t"] + 86400000 for b in k1d]
    f["dtrend"], j = [], -1
    for b in k4:
        close_t = b["t"] + H4
        while j + 1 < len(k1d) and day_end[j + 1] <= close_t:
            j += 1
        if j < RULES["ema_slow"]:
            f["dtrend"].append(0)
        else:
            up = dc[j] > d50[j] and d20[j] > d50[j]
            dn = dc[j] < d50[j] and d20[j] < d50[j]
            f["dtrend"].append(1 if up else -1 if dn else 0)
    return f


def prepare_1d(k1):
    c = [b["c"] for b in k1]
    return {"e20": ema(c, RULES["ema_fast"]), "e50": ema(c, RULES["ema_slow"]), "atr": atr(k1, RULES["atr"]),
            "rsi": rsi_series(c, RULES["rsi"]), "dtrend": [0] * len(k1)}


def signal_for(fam, k, f, i):
    if fam == "pullback-4h-v1":
        return signal(k, f, i)
    if i < RULES["ema_slow"] + 2 or f["atr"][i] is None or f["rsi"][i] is None or f["atr"][i] <= 0:
        return 0
    b, e20, e50, r = k[i], f["e20"][i], f["e50"][i], f["rsi"][i]
    if fam == "breakout-1d-v1":
        n = FAMILIES[fam]["donchian"]
        prev = k[i - n:i]
        if b["c"] > max(x["h"] for x in prev) and b["c"] > e50 and e20 > e50:
            return 1
        if b["c"] < min(x["l"] for x in prev) and b["c"] < e50 and e20 < e50:
            return -1
        return 0
    if fam == "dip-4h-v1":
        if f["dtrend"][i] == 1 and r < FAMILIES[fam]["rsi_dip"] and b["c"] > b["o"]:
            return 1
        if f["dtrend"][i] == -1 and r > FAMILIES[fam]["rsi_pop"] and b["c"] < b["o"]:
            return -1
    return 0


def signal(k4, f, i):
    """+1 long, -1 short, 0 none — on closed candle i"""
    if i < RULES["ema_slow"] + 2 or f["atr"][i] is None or f["rsi"][i] is None:
        return 0
    b, a, e20, e50, r = k4[i], f["atr"][i], f["e20"][i], f["e50"][i], f["rsi"][i]
    if a <= 0:
        return 0
    lo2, hi2 = min(b["l"], k4[i - 1]["l"]), max(b["h"], k4[i - 1]["h"])
    if f["dtrend"][i] == 1 and e20 > e50 and b["c"] > e20 and b["c"] > b["o"] \
            and lo2 <= e20 + RULES["touch_atr"] * a and RULES["rsi_long"][0] <= r <= RULES["rsi_long"][1] \
            and (b["c"] - e50) / a <= RULES["max_ext_atr"]:
        return 1
    if f["dtrend"][i] == -1 and e20 < e50 and b["c"] < e20 and b["c"] < b["o"] \
            and hi2 >= e20 - RULES["touch_atr"] * a and RULES["rsi_short"][0] <= r <= RULES["rsi_short"][1] \
            and (e50 - b["c"]) / a <= RULES["max_ext_atr"]:
        return -1
    return 0


def levels(k4, f, i, d, fam="pullback-4h-v1"):
    """the published plan for a signal on candle i"""
    b, a = k4[i], f["atr"][i]
    c = b["c"]
    lay = [c - d * x * a for x in RULES["layers"]]
    lo = k4[max(0, i - RULES["swing_bars"] + 1): i + 1]
    if FAMILIES[fam]["stop_mode"] == "atr2":
        stop = c - d * 2.0 * a
    elif d > 0:
        stop = min(min(x["l"] for x in lo), c - RULES["stop_atr"] * a) - RULES["stop_pad"] * a
    else:
        stop = max(max(x["h"] for x in lo), c + RULES["stop_atr"] * a) + RULES["stop_pad"] * a
    r1 = abs(c - stop)
    tps = [c + d * m * r1 for m in RULES["targets_r"]]
    w = RULES["weights"]
    avg = sum(p * x for p, x in zip(lay, w)) / sum(w)
    return {"d": d, "layers": lay, "weights": list(w), "stop": stop, "tps": tps, "avg_all": avg, "atr": a, "r1": r1}


def simulate(k4, i, plan, fam="pullback-4h-v1"):
    """trade the plan on the candles after i; worst order inside a candle. Returns the result in R (of the risk if
    every layer fills) and what happened"""
    d, lay, w, stop, tps = plan["d"], plan["layers"], plan["weights"], plan["stop"], plan["tps"]
    cost = RULES["cost_side"] / 100
    risk = sum(wk * abs(p - stop) for wk, p in zip(w, lay))
    if risk <= 0 or i + 1 >= len(k4):
        return None
    held, pnl, filled, hit = 0.0, 0.0, [False] * 3, 0
    cur_stop, avg = stop, None

    def fill(k, px):
        nonlocal held, pnl, avg
        q = w[k]
        avg = px if held == 0 else (avg * held + px * q) / (held + q)
        held += q
        pnl -= q * px * cost
        filled[k] = True

    def close(q, px):
        nonlocal held, pnl
        pnl += q * d * (px - avg) - q * px * cost
        held -= q

    fill(0, k4[i + 1]["o"])                      # layer 1: at the open after the signal candle
    end = min(len(k4) - 1, i + FAMILIES[fam]["max_bars"])
    out = "time"
    for j in range(i + 1, end + 1):
        b = k4[j]
        adverse, favour = (b["l"], b["h"]) if d > 0 else (b["h"], b["l"])
        if hit == 0 and j <= i + FAMILIES[fam]["layer_bars"]:
            for k in (1, 2):
                if not filled[k] and d * (lay[k] - adverse) >= 0:
                    fill(k, lay[k])
        if d * (cur_stop - adverse) >= 0:            # the stop first: the pessimistic order
            close(held, cur_stop)
            out = "stop" if hit == 0 else "be" if hit == 1 else "stop_after_tp2"
            break
        while hit < 3 and d * (favour - tps[hit]) >= 0:
            q = held * (RULES["close_at"][hit] / sum(RULES["close_at"][hit:]))
            close(q if hit < 2 else held, tps[hit])
            hit += 1
            if hit == 1:
                cur_stop = avg                         # break-even after the first target
        if hit == 3 or held <= 1e-12:
            out = "tp3"
            break
    else:
        pass
    if held > 1e-12:
        close(held, k4[end]["c"])
    return {"R": pnl / risk, "hit": hit, "out": out, "fills": sum(filled), "bars": j - i}


def live_state(k, i, plan):
    """what has happened since signal candle i, up to the last closed candle: still open (no stop, no first target,
    entry window not over), how many candles ago, which layers filled and the real fill of layer 1"""
    d, lay, stop, tp1 = plan["d"], plan["layers"], plan["stop"], plan["tps"][0]
    age = len(k) - 1 - i
    filled, l1 = 0, None
    if age == 0:
        return {"open": True, "age": 0, "filled": 0, "l1": None}
    l1 = k[i + 1]["o"]
    filled = 1
    for j in range(i + 1, len(k)):
        b = k[j]
        adverse, favour = (b["l"], b["h"]) if d > 0 else (b["h"], b["l"])
        for x in (1, 2):
            if filled == x and d * (lay[x] - adverse) >= 0:
                filled = x + 1
        if d * (stop - adverse) >= 0 or d * (favour - tp1) >= 0:
            return {"open": False, "age": age, "filled": filled, "l1": l1}
    return {"open": True, "age": age, "filled": filled, "l1": l1}


def backtest(k4, f, fam="pullback-4h-v1"):
    """every past signal, one trade at a time per coin"""
    trades, i, last = [], RULES["ema_slow"] + 2, len(k4) - 1
    while i < last:
        d = signal_for(fam, k4, f, i)
        if d:
            plan = levels(k4, f, i, d, fam)
            res = simulate(k4, i, plan, fam)
            if res and i + res["bars"] <= last:          # only finished trades count
                res["d"] = d
                res["t"] = k4[i]["t"]
                trades.append(res)
                i += max(1, res["bars"])
                continue
        i += 1
    return trades


def summarise(trades):
    n = len(trades)
    if not n:
        return {"n": 0}
    rs = [t["R"] for t in trades]
    m = sum(rs) / n
    sd = math.sqrt(sum((x - m) ** 2 for x in rs) / max(1, n - 1))
    k1 = sum(1 for t in trades if t["hit"] >= 1)
    k2 = sum(1 for t in trades if t["hit"] >= 2)
    k3 = sum(1 for t in trades if t["hit"] >= 3)
    ks = sum(1 for t in trades if t["out"] == "stop")
    lo1, hi1 = wilson(k1, n, Z)
    return {"n": n, "ev": round(m, 3), "ev_lo": round(m - Z * sd / math.sqrt(n), 3), "ev_hi": round(m + Z * sd / math.sqrt(n), 3),
            "p1": round(k1 / n, 3), "p1_lo": round(lo1, 3), "p1_hi": round(hi1, 3), "p2": round(k2 / n, 3), "p3": round(k3 / n, 3),
            "p_stop": round(ks / n, 3), "win": round(sum(1 for x in rs if x > 0) / n, 3),
            "bars_med": sorted(t["bars"] for t in trades)[n // 2],
            "from": min(t["t"] for t in trades), "to": max(t["t"] for t in trades)}


def qualifies(s):
    return bool(s and s.get("n", 0) >= QUAL["n"] and s["ev_lo"] > QUAL["ev_lo"] and s["p1_lo"] >= QUAL["p1_lo"])


def safe_leverage(plan, mm=0.005):
    """the highest whole leverage whose isolated liquidation stays one ATR beyond the stop, from the all-layers entry"""
    e, s, a, d = plan["avg_all"], plan["stop"], plan["atr"], plan["d"]
    lim = s - d * a
    x = 1 - lim * (1 - mm) / e if d > 0 else lim * (1 + mm) / e - 1
    if x <= 0:
        return 20
    return int(max(1, min(20, math.floor(1 / x))))


# ------------------------------------------------------------------ data
def jload(name, d=None):
    try:
        return json.load(open(os.path.join(ROOT, "data", name), encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return d


def universe(mk, n):
    out = []
    for c in sorted(mk.get("coins", []), key=lambda x: -(x.get("vol24") or 0)):
        s = c.get("coin")
        if s and c.get("price") and not any(s == x or s.endswith(x) for x in STABLE) and s not in out:
            out.append(s)
        if len(out) >= n:
            break
    for s in ("ETH", "BTC"):
        if s in out:
            out.remove(s)
        out.insert(0, s)
    return out[:n]


def fetch(sym):
    import market as M  # noqa: E402  (the site's Binance client: data-api.binance.vision first)
    def back(tf, ms, pages):
        k = M.klines(sym, tf, 1000)
        for _ in range(pages - 1):
            if not k:
                break
            older = [x for x in (M.klines(sym, tf, 1000, start=k[0]["t"] - 1000 * ms) or []) if x["t"] < k[0]["t"]]
            if not older:
                break
            k = older + k
        return k
    return back("4h", H4, 3), back("1d", 86400000, 2)      # about 16 months of 4h candles, 5 years of daily


def local(sym):
    def conv(rows):
        return [{"t": int(r[0]) * (1000 if r[0] < 1e12 else 1), "o": r[1], "h": r[2], "l": r[3], "c": r[4], "v": r[5]} for r in rows]
    a = jload(f"candles/{sym}_4h.json", {}) or {}
    b = jload(f"candles/{sym}_1d.json", {}) or {}
    return conv(a.get("s", {}).get(sym, {}).get("4h", [])), conv(b.get("s", {}).get(sym, {}).get("1d", []))


def closed(k, ms, now_ms):
    return [x for x in k if x["t"] + ms <= now_ms]


def context(sym, d, mk, deriv, regime, opps):
    """facts from the site's own data files that stand beside a setup (shown, never used to pick it)"""
    ctx = {}
    coin = next((c for c in mk.get("coins", []) if c.get("coin") == sym), None)
    if coin:
        ctx["chg24"] = coin.get("chg24")
        ctx["vol24"] = coin.get("vol24")
    sw = next((x for x in (deriv or {}).get("swaps", []) if x.get("coin") == sym), None)
    if sw and sw.get("funding") is not None:
        ctx["funding"] = sw["funding"]
    if regime and regime.get("now", {}).get("top"):
        ctx["regime"] = regime["now"]["top"]
        ctx["regime_p"] = regime["now"].get("confidence")
    fng = (mk.get("fng") or {}).get("value")
    if fng is not None:
        ctx["fng"] = fng
    ag = [o for o in opps if o.get("coin") == sym]
    if ag:
        ctx["scanner"] = sum(1 for o in ag if (o.get("dir") == "bull") == (d > 0))
        ctx["scanner_against"] = sum(1 for o in ag if (o.get("dir") == "bull") != (d > 0))
    return ctx


def rnd(x, ref):
    p = abs(ref or x or 1)
    dg = 2 if p >= 100 else 3 if p >= 10 else 4 if p >= 1 else 6 if p >= 0.01 else 8
    return round(x, dg)


def run(use_local=False, n=UNIVERSE):
    now = datetime.now(timezone.utc)
    now_ms = int(now.timestamp() * 1000)
    mk = jload("market.json", {}) or {}
    coins = ["BTC", "ETH"] if use_local else UNIVERSE_LIST[:n]
    data, errors = {}, {}

    def one(s_):
        try:
            k4, k1 = local(s_) if use_local else fetch(s_)
            return s_, closed(k4, H4, now_ms), closed(k1, 86400000, now_ms), None
        except Exception as e:  # noqa: BLE001
            return s_, [], [], str(e)[:120]

    with ThreadPoolExecutor(max_workers=1 if use_local else 6) as ex:
        for s_, k4, k1, err in ex.map(one, coins):
            if err or len(k4) < 120 or len(k1) < 60:
                errors[s_] = err or "short history"
                continue
            data[s_] = (k4, k1)

    side = {1: "long", -1: "short"}
    fams = {}
    deriv, regime = jload("derivatives.json", {}), jload("regime.json", {})
    opps = mk.get("opportunities") or []
    for fam, cfg in FAMILIES.items():
        trades, per_coin, live = [], {}, []
        for s_, (k4, k1) in data.items():
            k = k4 if cfg["tf"] == "4h" else k1
            f = prepare(k4, k1) if cfg["tf"] == "4h" else prepare_1d(k1)
            tr = backtest(k, f, fam)
            for t in tr:
                t["coin"] = s_
            trades += tr
            per_coin[s_] = {"long": summarise([t for t in tr if t["d"] > 0]), "short": summarise([t for t in tr if t["d"] < 0])}
            # the newest signal of the last `layer_bars` candles whose entry window is still open and that has hit
            # neither its stop nor its first target since: what someone opening the page now can still act on
            for i in range(len(k) - 1, max(RULES["ema_slow"] + 2, len(k) - 1 - cfg["layer_bars"]), -1):
                d = signal_for(fam, k, f, i)
                if d:
                    st_ = live_state(k, i, levels(k, f, i, d, fam))
                    if st_["open"]:
                        live.append((s_, d, k, f, i, st_))
                    break
        stats = {"long": summarise([t for t in trades if t["d"] > 0]), "short": summarise([t for t in trades if t["d"] < 0])}
        fams[fam] = {"tf": cfg["tf"], "stats": stats, "qualified": {k_: qualifies(v) for k_, v in stats.items()},
                     "per_coin": per_coin, "live": live}

    setups, watch = [], []
    for fam, F in fams.items():
        cfg, ms = FAMILIES[fam], TF_MS[FAMILIES[fam]["tf"]]
        for s_, d, k, f, i, st_ in F["live"]:
            plan = levels(k, f, i, d, fam)
            st = F["stats"][side[d]]
            cs = F["per_coin"][s_][side[d]]
            b = k[i]
            item = {
                "family": fam, "coin": s_, "side": side[d], "tf": cfg["tf"], "bar": b["t"], "price": rnd(b["c"], b["c"]),
                "atr": rnd(plan["atr"], b["c"]), "atr_pct": round(plan["atr"] / b["c"] * 100, 2),
                "layers": [{"px": rnd(p_, b["c"]), "w": w} for p_, w in zip(plan["layers"], plan["weights"])],
                "avg": rnd(plan["avg_all"], b["c"]), "stop": rnd(plan["stop"], b["c"]),
                "tps": [rnd(p_, b["c"]) for p_ in plan["tps"]],
                "close_at": list(RULES["close_at"]),
                "stop_pct": round(abs(b["c"] - plan["stop"]) / b["c"] * 100, 2),
                "tp_pct": [round(abs(p_ - b["c"]) / b["c"] * 100, 2) for p_ in plan["tps"]],
                "rr_avg": [round(abs(p_ - plan["avg_all"]) / abs(plan["avg_all"] - plan["stop"]), 2) for p_ in plan["tps"]],
                "lev_max": safe_leverage(plan),
                "valid_until": b["t"] + ms + cfg["layer_bars"] * ms,
                "exit_by": b["t"] + ms + cfg["max_bars"] * ms,
                "why": {"dtrend": f["dtrend"][i] or d, "e20": rnd(f["e20"][i], b["c"]), "e50": rnd(f["e50"][i], b["c"]),
                        "rsi": round(f["rsi"][i], 1), "ext_atr": round(abs(b["c"] - f["e50"][i]) / plan["atr"], 2)},
                "ctx": context(s_, d, mk, deriv, regime, opps),
                "stats": st,
                "coin_stats": cs if cs.get("n", 0) >= QUAL["coin_n"] else None,
                "age": st_["age"], "filled": st_["filled"], "l1_fill": rnd(st_["l1"], b["c"]) if st_["l1"] else None,
                "last": rnd(k[-1]["c"], b["c"]), "last_t": k[-1]["t"] + ms,
            }
            (setups if F["qualified"][side[d]] else watch).append(item)
        F.pop("live")
    order = {c: n_ for n_, c in enumerate(UNIVERSE_LIST)}
    setups.sort(key=lambda x: (-(x["stats"].get("ev") or 0), order.get(x["coin"], 99)))
    watch.sort(key=lambda x: order.get(x["coin"], 99))
    last = [k4[-1]["t"] for k4, _ in data.values()]
    return {
        "updated_at": now.isoformat(timespec="seconds"), "rules": RULES, "families": FAMILIES, "qual": QUAL,
        "source": "local" if use_local else "Binance public market data",
        "coins": list(data.keys()), "errors": errors, "fams": fams,
        "setups": setups, "watch": watch, "last_bar": max(last) if last else None,
    }


def main():
    use_local = "--local" in sys.argv
    n = UNIVERSE
    if "--coins" in sys.argv:
        n = int(sys.argv[sys.argv.index("--coins") + 1])
    t0 = time.time()
    res = run(use_local, n)
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(res, fh, ensure_ascii=False, separators=(",", ":"))
    parts = []
    for fam, F in res["fams"].items():
        for sd in ("long", "short"):
            st = F["stats"][sd]
            parts.append(f"{fam}/{sd} n={st.get('n')} ev={st.get('ev')} [{st.get('ev_lo')}] p1={st.get('p1')} [{st.get('p1_lo')}] q={F['qualified'][sd]}")
    print(f"trader setups: {len(res['coins'])} coins, {len(res['errors'])} errors; " + "; ".join(parts) +
          f"; setups={len(res['setups'])} watch={len(res['watch'])} ({time.time() - t0:.1f}s)")


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()
