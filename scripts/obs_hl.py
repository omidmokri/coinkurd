#!/usr/bin/env python3
"""The Observatory: liquidation levels of real positions on Hyperliquid (/charts/hyperliquid/), read by CI.

Hyperliquid publishes every account's open positions with the price at which each would be liquidated
(info → clearinghouseState → assetPositions[].position.liquidationPx). There is no list of all positions, so this
step reads accounts one by one: Hyperliquid's own leaderboard file lists the accounts (about 48,000), and the step asks
for as many of them as fit in its time (about ten a second, Hyperliquid's limit for one address), the largest by
account value and the most active by last month's volume taken in turn. What it read is said in the file and on the
page — the share of Hyperliquid's open interest those accounts hold, long and short — and nothing is added for the
accounts it did not read.

Writes data/obs/hl_liq.json:
  {source, updated_at, accounts: {read, listed, with_positions}, coins: {BTC: {mark, oi (coins), long, short (coins
   read), n_long, n_short, n_free (positions with no liquidation price: enough margin that no price liquidates them),
   pos: [[liquidation price, dollars, side 1 long | -1 short], …], top: [[side, dollars, entry, liquidation price or
   null, leverage], …]}, …}}
for the coins with the largest open interest. Every hour; OBS_HL_FORCE=1 asks anyway.
"""
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obs_chain as C  # noqa: E402

OUT_DIR = C.OUT_DIR
INFO = "https://api.hyperliquid.xyz/info"
BOARD = "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard"
SOURCE = "Hyperliquid public API (api.hyperliquid.xyz info: clearinghouseState, metaAndAssetCtxs; stats-data leaderboard)"
N_COINS = 15
N_TOP = 12
MIN_READ = 100
BUDGET = float(os.environ.get("OBS_HL_BUDGET", "200"))
RATE = 9.0


def _f(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if v == v and abs(v) != float("inf") else None


def order(board):
    """the leaderboard → addresses, the largest account and the most active one in turn, each once"""
    rows = [r for r in (board or {}).get("leaderboardRows") or [] if isinstance(r, dict) and isinstance(r.get("ethAddress"), str)]

    def vol(r):
        for w in r.get("windowPerformances") or []:
            if isinstance(w, list) and len(w) == 2 and w[0] == "month":
                return _f((w[1] or {}).get("vlm")) or 0
        return 0
    by_val = [r["ethAddress"] for r in sorted(rows, key=lambda r: -(_f(r.get("accountValue")) or 0)) if (_f(r.get("accountValue")) or 0) >= 1000]
    by_vol = [r["ethAddress"] for r in sorted(rows, key=lambda r: -vol(r)) if vol(r) > 0]
    out, seen = [], set()
    for pair in zip(by_val, by_vol):
        for a in pair:
            if a not in seen:
                seen.add(a)
                out.append(a)
    for a in by_val[len(by_vol):] + by_vol[len(by_val):]:
        if a not in seen:
            seen.add(a)
            out.append(a)
    return out, len(rows)


def market(meta):
    """metaAndAssetCtxs → {coin: (mark, open interest in coins)}"""
    try:
        uni, ctx = meta[0]["universe"], meta[1]
    except Exception:  # noqa: BLE001
        return {}
    out = {}
    for u, c in zip(uni, ctx):
        if not isinstance(u, dict) or not isinstance(c, dict) or u.get("isDelisted"):
            continue
        mk, oi = _f(c.get("markPx")), _f(c.get("openInterest"))
        if mk and oi:
            out[u.get("name")] = (mk, oi)
    return out


def aggregate(states, mkt, n_coins=N_COINS, n_top=N_TOP):
    """{address: clearinghouseState} → the file's coins"""
    acc = {}
    for st in states.values():
        for ap in (st or {}).get("assetPositions") or []:
            p = (ap or {}).get("position") or {}
            coin, sz = p.get("coin"), _f(p.get("szi"))
            if coin not in mkt or not sz:
                continue
            mk = mkt[coin][0]
            usd = abs(sz) * mk
            liq = _f(p.get("liquidationPx"))
            lev = _f((p.get("leverage") or {}).get("value"))
            a = acc.setdefault(coin, {"long": 0.0, "short": 0.0, "n_long": 0, "n_short": 0, "n_free": 0, "pos": [], "all": []})
            side = 1 if sz > 0 else -1
            a["long" if side > 0 else "short"] += abs(sz)
            a["n_long" if side > 0 else "n_short"] += 1
            if liq and liq > 0:
                a["pos"].append([C.sig(liq), round(usd), side])
            else:
                a["n_free"] += 1
            a["all"].append([side, round(usd), C.sig(_f(p.get("entryPx")) or 0), C.sig(liq) if liq and liq > 0 else None, lev])
    ranked = sorted((c for c in acc if c in mkt), key=lambda c: -mkt[c][0] * mkt[c][1])[:n_coins]
    out = {}
    for c in ranked:
        a = acc[c]
        a["pos"].sort(key=lambda x: x[0])
        top = sorted(a.pop("all"), key=lambda x: -x[1])[:n_top]
        out[c] = {"mark": C.sig(mkt[c][0]), "oi": C.sig(mkt[c][1]), "long": C.sig(a["long"]), "short": C.sig(a["short"]),
                  "n_long": a["n_long"], "n_short": a["n_short"], "n_free": a["n_free"], "pos": a["pos"], "top": top}
    return out


class Limiter:
    def __init__(self, rate):
        self.gap, self.next, self.lock = 1.0 / rate, time.monotonic(), threading.Lock()

    def wait(self):
        with self.lock:
            now = time.monotonic()
            t = max(now, self.next)
            self.next = t + self.gap
        if t > now:
            time.sleep(t - now)

    def slow(self, s):
        with self.lock:
            self.next = max(self.next, time.monotonic() + s)


def read_states(post, addrs, budget=BUDGET, rate=RATE, workers=8, clock=time.monotonic):
    """ask for each address until the time is up → ({address: state}, number asked)"""
    lim, end, out, asked = Limiter(rate), clock() + budget, {}, [0]
    lock = threading.Lock()
    it = iter(addrs)

    def worker():
        while True:
            with lock:
                if clock() >= end:
                    return
                a = next(it, None)
                if a is None:
                    return
                asked[0] += 1
            for _ in range(4):
                lim.wait()
                st, j = post({"type": "clearinghouseState", "user": a})
                if st == 429:
                    lim.slow(5)
                    continue
                if st == 200 and isinstance(j, dict):
                    with lock:
                        out[a] = j
                break
    with ThreadPoolExecutor(workers) as ex:
        for _ in range(workers):
            ex.submit(worker)
    return out, asked[0]


def due(doc, now):
    if not doc or not doc.get("updated_at"):
        return True
    try:
        return (now - datetime.fromisoformat(doc["updated_at"])).total_seconds() >= 55 * 60
    except Exception:  # noqa: BLE001
        return True


def run(get, post, now, out_dir=OUT_DIR, force=False, log=print, budget=BUDGET, rate=RATE):
    """get(url) → JSON or None; post(body) → (status, JSON or None)"""
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "hl_liq.json")
    doc = C._load(path)
    if not force and not due(doc, now):
        log(f"hyperliquid: written {doc.get('updated_at')}, not due yet")
        return "skip"
    st, meta = post({"type": "metaAndAssetCtxs"})
    mkt = market(meta) if st == 200 else {}
    board = get(BOARD)
    addrs, listed = order(board)
    if not mkt or not addrs:
        log(f"hyperliquid: market {len(mkt)} coins, leaderboard {listed} accounts — the previous file stays")
        return "kept"
    t0 = time.monotonic()
    states, asked = read_states(post, addrs, budget=budget, rate=rate)
    if len(states) < MIN_READ:
        log(f"hyperliquid: only {len(states)} of {asked} accounts answered — the previous file stays")
        return "kept"
    coins = aggregate(states, mkt)
    with_pos = sum(1 for s in states.values() if (s or {}).get("assetPositions"))
    out = {"source": SOURCE, "updated_at": now.isoformat(), "accounts": {"read": len(states), "asked": asked, "listed": listed, "with_positions": with_pos}, "coins": coins}
    C._save(path, out)
    b = coins.get("BTC") or {}
    cov = (f"BTC longs {b['long'] / b['oi'] * 100:.1f}% shorts {b['short'] / b['oi'] * 100:.1f}% of open interest" if b.get("oi") else "no BTC")
    log(f"hyperliquid: {len(states)}/{asked} accounts read of {listed} in {time.monotonic() - t0:.0f}s, {with_pos} with positions; {len(coins)} coins; {cov}")
    return "written"


def main():
    import requests
    s = requests.Session()
    s.headers.update(C.UA)

    def get(url):
        try:
            r = s.get(url, timeout=90)
            return r.json() if r.status_code == 200 else None
        except Exception as e:  # noqa: BLE001
            print("  err", str(e)[:120])
            return None

    def post(body):
        try:
            r = s.post(INFO, json=body, timeout=20)
            return r.status_code, (r.json() if r.status_code == 200 else None)
        except Exception as e:  # noqa: BLE001
            return 0, str(e)[:80]
    now = datetime.now(timezone.utc).replace(microsecond=0)
    run(get, post, now, force=os.environ.get("OBS_HL_FORCE") == "1")
    return 0


if __name__ == "__main__":
    sys.exit(main())
