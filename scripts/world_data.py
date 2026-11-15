#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
/world/ — «جهان زنده»: the facts behind the live counters, and the few figures that are fetched again and again.

Two outputs:

  assets/world/facts.json   FACTS below: every counter's yearly total (or level and yearly change), the year it
                            describes, the publisher, the publication and its address. Written by scripts/build_world.py
                            (static: it changes only when a publisher releases a new figure and this table is edited).
  data/world.json           written in CI (update.yml, after mm_data.py and btcinfo.py):
                              btc     the chain tip (mempool.space, or btcinfo.json), the first block of the UTC day and of
                                      the UTC year (mempool.space, asked once per day / year), the price and market value
                                      (data/mm.json), the whole crypto market's value (data/mm.json)
                              usdebt  the US Treasury's "Debt to the Penny" (fiscaldata.treasury.gov, no key): the last
                                      official figure, its date, and the average change per second over the ~91 days before
                                      it — the page runs on from the last figure at that pace and says so.

How a counter moves (the page and the bot do the same arithmetic; tests/test_world_data.py checks both):
  flow    a yearly total (births, CO2, military spending …). "This year" = total × elapsed share of the visitor's calendar
          year; "today" = total ÷ days in that year × elapsed share of the visitor's day. That is the publisher's yearly
          figure spread evenly — the page says so beside every counter ("at the 2025 pace").
  stock   a level at a date plus a yearly change (world population: UN mid-year figure ± births − deaths).
  Bitcoin is not modelled: issued coins come from the block subsidy schedule and the real block height.

Nothing here is invented: a figure without a publisher is not in the table, and a live figure that cannot be fetched
keeps its previous value with its own date (the page shows the date), or stays out.

Run (CI): python3 scripts/world_data.py           self-test: python3 tests/test_world_data.py
"""
import json
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "world.json")
FACTS_OUT = os.path.join(ROOT, "assets", "world", "facts.json")
MP = "https://mempool.space/api"
TREAS = ("https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny"
         "?fields=record_date,tot_pub_debt_out_amt&sort=-record_date&page%5Bsize%5D=140")
UA = {"User-Agent": "entekhab.net/1.0 (+https://entekhab.net/world/)"}
DEBT_EVERY = 6 * 3600            # the Treasury publishes once per business day
DEBT_SPAN_DAYS = 91              # the pace = average change over about three months before the last figure

# ---------------------------------------------------------------------------------------------------------------- facts
# k: key · cat: section · kind: flow (per_year) | stock (base at epoch, per_year change) · unit: what the number counts
# year: the period the figure describes · basis: "proj" = the publisher's projection/forecast for that year,
# "obs" = measured/estimated for that year (the page then says "at the <year> pace") · src: publisher, title, url, date
FACTS = [
    # ---- population (UN DESA, World Population Prospects 2024, medium variant; next revision July 2027)
    {"k": "pop", "cat": "pop", "kind": "stock", "unit": "people", "base": 8300678396, "epoch": "2026-07-01T00:00:00Z",
     "per_year": 132503469 - 63637314, "year": 2026, "basis": "proj",
     "src": {"pub": "UN DESA", "t": "World Population Prospects 2024 (medium variant): 1 July 2026, births − deaths in 2026",
             "url": "https://population.un.org/wpp/", "d": "2024-07-11"}},
    {"k": "births", "cat": "pop", "kind": "flow", "unit": "people", "per_year": 132503469, "year": 2026, "basis": "proj",
     "src": {"pub": "UN DESA", "t": "World Population Prospects 2024 (medium variant), births in 2026",
             "url": "https://population.un.org/wpp/", "d": "2024-07-11"}},
    {"k": "deaths", "cat": "pop", "kind": "flow", "unit": "people", "per_year": 63637314, "year": 2026, "basis": "proj",
     "src": {"pub": "UN DESA", "t": "World Population Prospects 2024 (medium variant), deaths in 2026",
             "url": "https://population.un.org/wpp/", "d": "2024-07-11"}},
    {"k": "growth", "cat": "pop", "kind": "flow", "unit": "people", "per_year": 132503469 - 63637314, "year": 2026, "basis": "proj",
     "src": {"pub": "UN DESA", "t": "World Population Prospects 2024: births − deaths in 2026 (world migration nets to zero)",
             "url": "https://population.un.org/wpp/", "d": "2024-07-11"}},
    # ---- economy
    {"k": "gdp", "cat": "eco", "kind": "flow", "unit": "usd", "per_year": 128003.78e9, "year": 2026, "basis": "proj",
     "src": {"pub": "IMF", "t": "World Economic Outlook, October 2026 — world GDP in current US dollars, 2026",
             "url": "https://www.imf.org/en/Publications/WEO", "d": "2026-10-13"}},
    {"k": "military", "cat": "eco", "kind": "flow", "unit": "usd", "per_year": 2887e9, "year": 2025, "basis": "obs",
     "src": {"pub": "SIPRI", "t": "Trends in World Military Expenditure, 2025 — world total $2887 billion",
             "url": "https://www.sipri.org/databases/milex", "d": "2026-04-27"}},
    {"k": "gold", "cat": "eco", "kind": "flow", "unit": "t", "per_year": 3671.6, "year": 2025, "basis": "obs",
     "src": {"pub": "World Gold Council", "t": "Gold Demand Trends, full year 2025 — mine production 3,671.6 t",
             "url": "https://www.gold.org/goldhub/research/gold-demand-trends", "d": "2026-01-29"}},
    # ---- energy and environment
    {"k": "energy", "cat": "env", "kind": "flow", "unit": "mwh", "per_year": 600.3e18 / 3.6e9, "year": 2025, "basis": "obs",
     "src": {"pub": "Energy Institute", "t": "Statistical Review of World Energy 2026 — total energy supply 600.3 EJ in 2025 (1 MWh = 3.6 GJ)",
             "url": "https://www.energyinst.org/statistical-review", "d": "2026-06-30"}},
    {"k": "oil", "cat": "env", "kind": "flow", "unit": "bbl", "per_year": 100.7e6 * 365, "year": 2026, "basis": "proj",
     "src": {"pub": "IEA", "t": "Oil Market Report, September 2026 — world oil supply 100.7 mb/d on average in 2026",
             "url": "https://www.iea.org/reports/oil-market-report-september-2026", "d": "2026-09-11"}},
    {"k": "co2", "cat": "env", "kind": "flow", "unit": "t", "per_year": 38.2e9, "year": 2026, "basis": "proj",
     "src": {"pub": "Global Carbon Project", "t": "Global Carbon Budget 2026 — fossil CO2 projected at 38.2 billion tonnes in 2026",
             "url": "https://globalcarbonbudget.org/", "d": "2026-11-10"}},
    {"k": "forest", "cat": "env", "kind": "flow", "unit": "ha", "per_year": 4.3e6, "year": 2025, "basis": "obs",
     "src": {"pub": "WRI · University of Maryland", "t": "Global Forest Watch — tropical primary forest loss 4.3 million ha in 2025",
             "url": "https://www.globalforestwatch.org/", "d": "2026-04-29"}},
    {"k": "trees", "cat": "env", "kind": "flow", "unit": "ha", "per_year": 25.5e6, "year": 2025, "basis": "obs",
     "src": {"pub": "WRI · University of Maryland", "t": "Global Forest Watch — global tree cover loss 25.5 million ha in 2025",
             "url": "https://www.globalforestwatch.org/", "d": "2026-04-29"}},
    # ---- health (deaths per year; the latest year each publisher has estimated)
    {"k": "under5", "cat": "health", "kind": "flow", "unit": "people", "per_year": 4.9e6, "year": 2024, "basis": "obs",
     "src": {"pub": "UN IGME (UNICEF, WHO, World Bank, UN DESA)", "t": "Levels and Trends in Child Mortality — 4.9 million under-five deaths in 2024",
             "url": "https://childmortality.org/", "d": "2026-03-18"}},
    {"k": "tobacco", "cat": "health", "kind": "flow", "unit": "people", "per_year": 7e6, "year": 2025, "basis": "obs", "atleast": True,
     "src": {"pub": "WHO", "t": "Tobacco fact sheet — tobacco kills more than 7 million people each year",
             "url": "https://www.who.int/news-room/fact-sheets/detail/tobacco", "d": "2025-06-25"}},
    {"k": "tb", "cat": "health", "kind": "flow", "unit": "people", "per_year": 1.23e6, "year": 2024, "basis": "obs",
     "src": {"pub": "WHO", "t": "Global Tuberculosis Report 2025 — 1.23 million deaths in 2024",
             "url": "https://www.who.int/teams/global-programme-on-tuberculosis-and-lung-health/tb-reports", "d": "2025-11-12"}},
    {"k": "road", "cat": "health", "kind": "flow", "unit": "people", "per_year": 1.19e6, "year": 2021, "basis": "obs",
     "src": {"pub": "WHO", "t": "Global status report on road safety 2023 — 1.19 million deaths a year",
             "url": "https://www.who.int/publications/i/item/9789240086517", "d": "2023-12-13"}},
    {"k": "malaria", "cat": "health", "kind": "flow", "unit": "people", "per_year": 610000, "year": 2024, "basis": "obs",
     "src": {"pub": "WHO", "t": "World malaria report 2025 — 610 000 deaths in 2024",
             "url": "https://www.who.int/teams/global-malaria-programme/reports/world-malaria-report-2025", "d": "2025-12-04"}},
    {"k": "aids", "cat": "health", "kind": "flow", "unit": "people", "per_year": 570000, "year": 2025, "basis": "obs",
     "src": {"pub": "UNAIDS", "t": "Global HIV & AIDS statistics 2026 — 570 000 AIDS-related deaths in 2025",
             "url": "https://www.unaids.org/en/resources/fact-sheet", "d": "2026-07-27"}},
    # ---- society
    {"k": "online", "cat": "soc", "kind": "flow", "unit": "people", "per_year": 240e6, "year": 2025, "basis": "obs", "atleast": True,
     "src": {"pub": "ITU", "t": "Facts and Figures 2025 — the online population grew by more than 240 million in 2025, to about 6 billion",
             "url": "https://www.itu.int/itu-d/reports/statistics/facts-figures-2025/", "d": "2025-11-17"}},
    {"k": "netusers", "cat": "soc", "kind": "static", "unit": "people", "value": 6.0e9, "year": 2025, "basis": "obs",
     "src": {"pub": "ITU", "t": "Facts and Figures 2025 — about 6 billion people (74 %) used the Internet in 2025",
             "url": "https://www.itu.int/itu-d/reports/statistics/facts-figures-2025/", "d": "2025-11-17"}},
]
CATS = ["btc", "pop", "eco", "env", "health", "soc"]


def facts_doc():
    return {"v": 1, "cats": CATS, "facts": FACTS}


def check_facts(facts=None):
    """the table's own sanity: every fact has a publisher, an address and a year; numbers are numbers"""
    bad = []
    keys = set()
    for f in facts or FACTS:
        k = f.get("k")
        if not k or k in keys:
            bad.append(("key", k))
        keys.add(k)
        s = f.get("src") or {}
        if not (s.get("pub") and s.get("t") and str(s.get("url", "")).startswith("https://") and s.get("d")):
            bad.append(("source", k))
        if f.get("cat") not in CATS or f.get("kind") not in ("flow", "stock", "static") or not isinstance(f.get("year"), int):
            bad.append(("shape", k))
        v = f.get("value") if f.get("kind") == "static" else f.get("per_year")
        if not isinstance(v, (int, float)) or v <= 0:
            bad.append(("value", k))
        if f.get("kind") == "stock" and not (isinstance(f.get("base"), (int, float)) and f.get("epoch")):
            bad.append(("stock", k))
    return bad


# ------------------------------------------------------------------------------------------------------------ counters
def year_len_s(y):
    return (datetime(y + 1, 1, 1) - datetime(y, 1, 1)).total_seconds()


def flow_values(per_year, now_local):
    """(this year, today) for a yearly total, at a naive local datetime (the visitor's clock on the page; Tehran in the bot)"""
    y0 = datetime(now_local.year, 1, 1)
    d0 = datetime(now_local.year, now_local.month, now_local.day)
    yl = year_len_s(now_local.year)
    return per_year * (now_local - y0).total_seconds() / yl, per_year / (yl / 86400.0) * (now_local - d0).total_seconds() / 86400.0


def stock_value(f, now_utc):
    ep = datetime.fromisoformat(f["epoch"].replace("Z", "+00:00"))
    return f["base"] + f["per_year"] * (now_utc - ep).total_seconds() / (365.2425 * 86400)


# ------------------------------------------------------------------------------------------------------------- bitcoin
HALVING = 210000
COIN = 100_000_000


def subsidy_sat(h):
    """block subsidy of height h in satoshis (consensus: 50 BTC halved every 210 000 blocks, a right shift)"""
    e = h // HALVING
    return 0 if e >= 64 else (50 * COIN) >> e


def issued_sat(a, b):
    """satoshis created by the subsidy in blocks a..b inclusive (0 when b < a)"""
    if b < a:
        return 0
    tot = 0
    h = a
    while h <= b:
        end = min(b, (h // HALVING + 1) * HALVING - 1)
        tot += (end - h + 1) * subsidy_sat(h)
        h = end + 1
    return tot


def supply_sat(tip):
    """all coins created up to and including block `tip` (the genesis reward included, as every supply figure counts it)"""
    return issued_sat(0, tip)


def next_halving(tip):
    return (tip // HALVING + 1) * HALVING


# ------------------------------------------------------------------------------------------------------------- fetching
def _get(url, tries=3, timeout=30):
    import requests
    for i in range(tries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            if r.status_code == 200:
                return r.json()
            print("  http", r.status_code, url[:100])
            if r.status_code in (400, 403, 404):
                return None
        except Exception as ex:  # noqa: BLE001
            print("  err", str(ex)[:120], url[:100])
        time.sleep(2 + 4 * i)
    return None


def first_block_at(ts, get=_get):
    """height of the first block whose timestamp is at or after `ts` (unix seconds), from mempool.space's
    /v1/mining/blocks/timestamp/:ts (the block closest to that moment). None when it does not answer sensibly."""
    r = get(f"{MP}/v1/mining/blocks/timestamp/{int(ts)}")
    if not isinstance(r, dict) or not isinstance(r.get("height"), int):
        return None
    try:
        bt = datetime.fromisoformat(str(r.get("timestamp")).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None
    return r["height"] + (1 if bt < ts else 0)


def debt_summary(rows, span_days=DEBT_SPAN_DAYS):
    """rows: Treasury 'data' list (record_date, tot_pub_debt_out_amt as strings), any order.
    -> {d, v, d0, v0, rate} (rate = dollars per second between the figure ~span_days earlier and the last one) or None"""
    pts = []
    for r in rows or []:
        try:
            pts.append((date.fromisoformat(str(r["record_date"])), float(str(r["tot_pub_debt_out_amt"]).replace(",", ""))))
        except (KeyError, TypeError, ValueError):
            continue
    pts = sorted({d: v for d, v in pts if v > 1e12}.items())
    if len(pts) < 2:
        return None
    d1, v1 = pts[-1]
    target = d1 - timedelta(days=span_days)
    older = [p for p in pts if p[0] <= target]
    d0, v0 = older[-1] if older else pts[0]
    if (d1 - d0).days < 20:
        return None
    return {"d": d1.isoformat(), "v": v1, "d0": d0.isoformat(), "v0": v0, "rate": (v1 - v0) / ((d1 - d0).days * 86400.0)}


def _load(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:  # noqa: BLE001
        return None


def build(prev, now, get=_get, mm=None, btcinfo=None):
    """the new data/world.json from the previous one, the clock and the sources (injected for the tests)"""
    out = dict(prev) if isinstance(prev, dict) else {}
    err = {}
    # ---- chain tip: mempool.space; else the site's own btcinfo.json (written minutes earlier in the same run)
    btc = dict(out.get("btc") or {})
    tip = get(f"{MP}/blocks/tip/height", tries=2)
    tip_t = None
    if isinstance(tip, int) and tip > 0:
        tip_t = int(now.timestamp())
    else:
        bl = (btcinfo or {}).get("blocks") if isinstance(btcinfo, dict) else None
        if isinstance(bl, list) and bl and isinstance(bl[0], dict) and isinstance(bl[0].get("height"), int):
            tip, tip_t = bl[0]["height"], int(bl[0].get("timestamp") or 0) or None
        else:
            tip = None
            err["tip"] = "no source"
    if tip and (not btc.get("tip") or tip >= btc["tip"]):
        btc["tip"], btc["tip_t"] = tip, tip_t
    # ---- first block of the UTC day and of the UTC year (each asked once, then kept)
    day = now.date().isoformat()
    if (btc.get("day0") or {}).get("d") != day:
        h = first_block_at(datetime(now.year, now.month, now.day, tzinfo=timezone.utc).timestamp(), get)
        if h:
            btc["day0"] = {"d": day, "h": h}
        else:
            err["day0"] = "no answer"
    if (btc.get("year0") or {}).get("y") != now.year:
        h = first_block_at(datetime(now.year, 1, 1, tzinfo=timezone.utc).timestamp(), get)
        if h:
            btc["year0"] = {"y": now.year, "h": h}
        else:
            err["year0"] = "no answer"
    # ---- price and market values from the market-map snapshot of the same run
    if isinstance(mm, dict):
        b = next((c for c in (mm.get("c") or []) if isinstance(c, dict) and c.get("s") == "BTC"), None)
        if b and isinstance(b.get("p"), (int, float)) and b["p"] > 0:
            btc["p"], btc["p_t"] = b["p"], mm.get("t")
        g = mm.get("g") if isinstance(mm.get("g"), dict) else {}
        if isinstance(g.get("mcap"), (int, float)) and g["mcap"] > 0:
            out["crypto"] = {"mcap": g["mcap"], "btc_d": g.get("btc_d"), "chg24": g.get("mcap_chg24"), "t": mm.get("t")}
    out["btc"] = btc
    # ---- US national debt (every 6 hours at most)
    deb = out.get("usdebt") or {}
    if now.timestamp() - float(deb.get("asked", 0) or 0) >= DEBT_EVERY:
        r = get(TREAS)
        s = debt_summary((r or {}).get("data") if isinstance(r, dict) else None)
        if s:
            s["asked"] = int(now.timestamp())
            out["usdebt"] = s
        else:
            err["usdebt"] = "no answer"
    out["t"] = now.replace(microsecond=0).isoformat()
    out["errors"] = err
    return out


def main():
    now = datetime.now(timezone.utc)
    prev = _load(OUT)
    out = build(prev, now, mm=_load(os.path.join(ROOT, "data", "mm.json")), btcinfo=_load(os.path.join(ROOT, "data", "btcinfo.json")))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    print("world.json:", json.dumps({k: out.get(k) for k in ("btc", "usdebt", "errors")}, ensure_ascii=False)[:400])


def write_facts():
    bad = check_facts()
    if bad:
        raise SystemExit(f"facts table: {bad}")
    os.makedirs(os.path.dirname(FACTS_OUT), exist_ok=True)
    with open(FACTS_OUT, "w", encoding="utf-8") as fh:
        json.dump(facts_doc(), fh, ensure_ascii=False, separators=(",", ":"))
    return FACTS_OUT


if __name__ == "__main__":
    if "--facts" in sys.argv:
        print("written", write_facts())
    else:
        main()
