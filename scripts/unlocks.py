# -*- coding: utf-8 -*-
"""Token unlocks — when locked tokens are due to reach the market.

A project hands tokens to its team, its early backers and its treasury on a schedule. On the day a tranche
unlocks, those tokens can be sold; a large one against a thin market is one of the few things about a coin that
is known in advance. Nothing on this site said when they fall, so this file collects them.

Source
  defillama-datasets.llama.fi/emissionsProtocolsList   the slugs DefiLlama keeps a schedule for (~300, a few KB)
  defillama-datasets.llama.fi/emissions/<slug>         one project's whole schedule — about 2 MB each
  coins.llama.fi/prices/current/coingecko:<id>         the token's price now, to turn tokens into dollars
All three are free and need no key.

Why it refreshes a few projects at a time. Each project's file is around 2 MB, and there are some three hundred
of them: asking for all of them on every run would be half a gigabyte an hour from a service that gives its data
away. An unlock schedule is written months ahead and barely moves, so each run refreshes only the few projects
whose copy here is oldest, within a byte budget. A full pass takes about a day of runs, which is far more often
than the schedules themselves change.

What is kept. Per project: its name, its token, how much is in circulation, and the events still to come —
each with the day, the number of tokens and what they were promised to. The whole of the 2 MB is read and
thrown away; what stays in data/unlocks.json is a few hundred bytes a project.

It is called at the end of scripts/obs_defi.py, which already runs on a schedule and already reads DefiLlama,
so the unlocks ride along with the DeFi figures rather than needing a clock of their own.

Self-test: python3 tests/test_unlocks.py
"""
import json
import os
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obs_chain as C  # noqa: E402  (get, sig, UA)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# data/obs/ is the folder the live workflow commits, so the file lands with the rest of the Observatory's data
OUT = os.path.join(C.OUT_DIR, "unlocks.json")
SETS = "https://defillama-datasets.llama.fi"
COINS = "https://coins.llama.fi"
SOURCE = "DefiLlama emissions (defillama-datasets.llama.fi), free, no key"

PER_RUN = 4                     # projects refreshed in one run
BUDGET = 28 * 1024 * 1024       # and no more of the source's bandwidth than this, whatever happens
STALE = 36 * 3600               # a copy older than this is due again
AHEAD = 400 * 86400             # events further off than this say nothing about today
EVENTS = 8                      # the next few of them, per project
LIST_EVERY = 12 * 3600          # how often the list of projects itself is read again
MIN_USD = 50_000                # an unlock worth less than this is noise on any market


def _now():
    return int(time.time())


def load(path=OUT):
    """what is on disk, or an empty store — a broken file is not worth failing over"""
    try:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
        if isinstance(doc, dict) and isinstance(doc.get("coins"), dict):
            doc.setdefault("slugs", [])
            doc.setdefault("slugs_at", 0)
            return doc
    except Exception:  # noqa: BLE001
        pass
    return {"updated_at": "", "source": SOURCE, "slugs": [], "slugs_at": 0, "coins": {}}


def slug_ok(s):
    return isinstance(s, str) and 0 < len(s) <= 60 and all(c.isalnum() or c in "-_." for c in s)


def events_of(doc, now=None):
    """the unlocks still to come, from one project's file: the day, the tokens and who they go to"""
    now = now or _now()
    meta = doc.get("metadata") if isinstance(doc, dict) else None
    raw = meta.get("events") if isinstance(meta, dict) else None
    out = []
    if not isinstance(raw, list):
        return out
    for e in raw:
        if not isinstance(e, dict):
            continue
        t = e.get("timestamp")
        if not isinstance(t, (int, float)) or not now < t < now + AHEAD:
            continue
        toks = e.get("noOfTokens")
        n = 0.0
        if isinstance(toks, list):
            for v in toks:
                if isinstance(v, (int, float)) and 0 <= v < 1e15:
                    n += float(v)
        if n <= 0:
            continue
        cat = e.get("category")
        kind = e.get("unlockType")
        out.append({"t": int(t), "n": C.sig(n, 6),
                    "c": cat if isinstance(cat, str) and len(cat) <= 24 else "",
                    "k": kind if kind in ("cliff", "linear") else ""})
    out.sort(key=lambda x: x["t"])
    # the same day's tranches are one unlock to a reader
    merged = []
    for e in out:
        day = e["t"] - e["t"] % 86400
        if merged and merged[-1]["day"] == day and merged[-1]["c"] == e["c"]:
            merged[-1]["n"] = C.sig(merged[-1]["n"] + e["n"], 6)
            continue
        e = dict(e, day=day)
        merged.append(e)
    for e in merged:
        e.pop("day", None)
    return merged[:EVENTS]


def supply_of(doc):
    """how many tokens exist in all, as the source states it"""
    sm = doc.get("supplyMetrics") if isinstance(doc, dict) else None
    if not isinstance(sm, dict):
        return 0
    for k in ("adjustedSupply", "maxSupply"):
        v = sm.get(k)
        if isinstance(v, (int, float)) and 0 < v < 1e15:
            return C.sig(float(v), 6)
    return 0


def price_of(gecko):
    """the token's price now, from DefiLlama's own price service"""
    if not isinstance(gecko, str) or not gecko or not slug_ok(gecko):
        return 0
    j = C.get(f"{COINS}/prices/current/coingecko:{gecko}", timeout=30)
    try:
        v = j["coins"][f"coingecko:{gecko}"]["price"]
        return C.sig(float(v), 6) if 0 < float(v) < 1e9 else 0
    except Exception:  # noqa: BLE001
        return 0


def summary(slug, doc, now=None):
    """one project, as a few hundred bytes: what it is, what is in circulation, and what is still to unlock"""
    ev = events_of(doc, now)
    if not ev:
        return None
    name = doc.get("name")
    gecko = doc.get("gecko_id")
    sym = ""
    tok = (doc.get("metadata") or {}).get("token") if isinstance(doc.get("metadata"), dict) else ""
    if isinstance(tok, str) and ":" in tok:
        sym = tok.split(":", 1)[1][:24]
    return {
        "slug": slug,
        "name": (name if isinstance(name, str) else slug)[:40],
        "gecko": gecko if isinstance(gecko, str) and slug_ok(gecko) else "",
        "token": sym,
        "chain": (doc.get("chainName") if isinstance(doc.get("chainName"), str) else "")[:24],
        "supply": supply_of(doc),
        "ev": ev,
    }


def refresh(doc=None, per_run=PER_RUN, budget=BUDGET, now=None):
    """read the list when it is old, then the few projects whose copy here is the oldest"""
    now = now or _now()
    store = doc if doc is not None else load()
    if now - int(store.get("slugs_at") or 0) > LIST_EVERY or not store["slugs"]:
        lst = C.get(f"{SETS}/emissionsProtocolsList", timeout=60)
        if isinstance(lst, list):
            store["slugs"] = sorted({s for s in lst if slug_ok(s)})
            store["slugs_at"] = now
    seen = store["coins"]
    order = sorted(store["slugs"], key=lambda s: (seen.get(s, {}).get("at", 0), s))
    spent, done, dropped = 0, 0, 0
    for slug in order:
        if done >= per_run or spent >= budget:
            break
        old = seen.get(slug) or {}
        if now - int(old.get("at") or 0) < STALE and old.get("at"):
            break                                   # the oldest copy is still fresh: nothing to do this run
        j = C.get(f"{SETS}/emissions/{slug}", timeout=90)
        done += 1
        if j is None:
            seen[slug] = {"at": now, "miss": 1}
            continue
        spent += len(json.dumps(j))
        s = summary(slug, j, now)
        if not s:
            seen[slug] = {"at": now, "miss": 1}      # nothing left to unlock, or no schedule at all
            dropped += 1
            continue
        s["price"] = price_of(s["gecko"]) if s["gecko"] else 0
        s["at"] = now
        seen[slug] = s
    store["updated_at"] = datetime.now(timezone.utc).isoformat()
    store["source"] = SOURCE
    return store, {"read": done, "bytes": spent, "empty": dropped,
                   "known": sum(1 for v in seen.values() if v.get("ev"))}


def soon(store, days=120, now=None, min_usd=MIN_USD):
    """every unlock due in the next so many days, largest in dollars first"""
    now = now or _now()
    out = []
    for slug, c in (store.get("coins") or {}).items():
        if not isinstance(c, dict) or not c.get("ev"):
            continue
        price = c.get("price") or 0
        for e in c["ev"]:
            t = e.get("t") or 0
            if not now <= t <= now + days * 86400:
                continue
            usd = (e.get("n") or 0) * price
            if price and usd < min_usd:
                continue
            out.append({"slug": slug, "name": c.get("name") or slug, "token": c.get("token") or "",
                        "chain": c.get("chain") or "", "t": int(t), "n": e.get("n") or 0,
                        "c": e.get("c") or "", "k": e.get("k") or "",
                        "usd": C.sig(usd, 5) if usd else 0,
                        "pct": C.sig((e.get("n") or 0) / c["supply"] * 100, 3) if c.get("supply") else 0})
    out.sort(key=lambda x: (-(x["usd"] or 0), x["t"]))
    return out


def main(argv=None):
    store, stats = refresh()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, separators=(",", ":"))
    n = len(soon(store, 30))
    print(f"unlocks: read {stats['read']} ({stats['bytes'] / 1e6:.1f} MB), {stats['known']} projects with a schedule, "
          f"{n} unlocks in the next 30 days | wrote {os.path.getsize(OUT) / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
