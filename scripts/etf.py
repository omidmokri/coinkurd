#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ETFs and institutions for /etf/ — data/etf.json

  * US spot Bitcoin and Ether ETFs: the daily net flow of every fund in US$ millions, from Farside Investors' public
    tables (https://farside.co.uk/bitcoin-etf-flow-all-data/ and /ethereum-etf-flow-all-data/), the figures SoSoValue and
    the press quote. A day whose funds have not reported yet ("-" everywhere) is not a day of zero flow and is left out.
  * Public companies holding BTC and ETH: CoinGecko /companies/public_treasury/{bitcoin,ethereum} (keyless).

Farside publishes once a day after the US close, so the tables are read at most once an hour; treasuries every 6 hours.
When a source fails, the previous figures stay and the page shows when they were read. Nothing is estimated.
Run: python3 scripts/etf.py          tests: python3 tests/test_etf.py
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "etf.json")
FARSIDE = {"btc": "https://farside.co.uk/bitcoin-etf-flow-all-data/", "eth": "https://farside.co.uk/ethereum-etf-flow-all-data/"}
CG = "https://api.coingecko.com/api/v3/companies/public_treasury/"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 entekhab.net",
      "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8", "Accept-Language": "en-GB,en;q=0.9"}
# sponsor and listing of each fund (as SoSoValue lists them, checked 2026-11-12); a fund missing here shows its ticker only
FUNDS = {
    "IBIT": ("BlackRock", "NASDAQ"), "FBTC": ("Fidelity", "CBOE"), "BITB": ("Bitwise", "NYSE"), "ARKB": ("ARK & 21Shares", "CBOE"),
    "BTCO": ("Invesco Galaxy", "CBOE"), "EZBC": ("Franklin Templeton", "CBOE"), "BRRR": ("CoinShares Valkyrie", "NASDAQ"),
    "HODL": ("VanEck", "CBOE"), "BTCW": ("WisdomTree", "CBOE"), "MSBT": ("Morgan Stanley", "NYSE"), "GBTC": ("Grayscale", "NYSE"),
    "BTC": ("Grayscale Mini", "NYSE"), "DEFI": ("Hashdex", "NYSE"),
    "ETHA": ("BlackRock", "NASDAQ"), "ETHB": ("BlackRock (staked)", "NASDAQ"), "FETH": ("Fidelity", "CBOE"), "ETHW": ("Bitwise", "NYSE"),
    "TETH": ("21Shares", "CBOE"), "ETHV": ("VanEck", "CBOE"), "QETH": ("Invesco Galaxy", "CBOE"), "EZET": ("Franklin Templeton", "CBOE"),
    "MSSE": ("Morgan Stanley", "NYSE"), "ETHE": ("Grayscale", "NYSE"), "ETH": ("Grayscale Mini", "NYSE"),
}
MON = {m: i for i, m in enumerate(("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"), 1)}
DAY_RE = re.compile(r"^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$")
KEEP_DAYS = 400


def cell_num(t):
    """'(403.0)' -> -403.0 · '1,234.5' -> 1234.5 · '0.0' -> 0.0 · '-' / '' -> None"""
    t = re.sub(r"\s+", "", t or "").replace(",", "").replace("−", "-")
    if t in ("", "-", "–", "—", "n/a", "N/A"):
        return None
    neg = t.startswith("(") and t.endswith(")")
    if neg:
        t = t[1:-1]
    try:
        v = float(t)
    except ValueError:
        return None
    return -v if neg else v


def parse_farside(html):
    """the flow table of a Farside page -> (funds, [(iso day, total, [per fund])]) in date order"""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    tab = soup.select_one("table.etf")
    if tab is None:
        raise ValueError("no table.etf on the page")
    rows = [[c.get_text(" ", strip=True) for c in tr.find_all(["th", "td"])] for tr in tab.find_all("tr")]
    head = next((r for r in rows if len(r) > 3 and r[-1].strip().lower() == "total"), None)
    if not head:
        raise ValueError("no header row")
    funds = [re.sub(r"\s+", "", x) for x in head[1:-1]]
    if not funds or not all(re.fullmatch(r"[A-Z0-9]{2,6}", f) for f in funds):
        raise ValueError(f"unexpected fund columns {funds[:5]}")
    days = []
    for r in rows:
        if len(r) != len(head):
            continue
        m = DAY_RE.match(r[0].strip())
        if not m or m.group(2) not in MON:
            continue
        vals = [cell_num(x) for x in r[1:-1]]
        if all(v is None for v in vals):
            continue            # the funds have not reported this day yet
        iso = f"{int(m.group(3)):04d}-{MON[m.group(2)]:02d}-{int(m.group(1)):02d}"
        tot = cell_num(r[-1])
        if tot is None:
            tot = round(sum(v for v in vals if v is not None), 1)
        days.append((iso, round(tot, 1), [None if v is None else round(v, 1) for v in vals]))
    days.sort(key=lambda d: d[0])
    if len(days) < 5:
        raise ValueError(f"only {len(days)} dated rows")
    return funds, days


def summarise(funds, days):
    """the page's figures from the daily table: per-fund cumulative and windows, totals, streak"""
    cum = {f: 0.0 for f in funds}
    for _, _, vals in days:
        for f, v in zip(funds, vals):
            if v is not None:
                cum[f] += v
    tot_cum = round(sum(d[1] for d in days), 1)

    def win(n):
        w = days[-n:]
        per = {f: round(sum((v or 0) for _, _, vals in w for g, v in zip(funds, vals) if g == f), 1) for f in funds}
        return round(sum(d[1] for d in w), 1), per
    t7, p7 = win(5)        # a trading week
    t30, p30 = win(21)     # a trading month
    streak, sign = 0, 0
    for _, t, _ in reversed(days):
        s = 1 if t > 0 else -1 if t < 0 else 0
        if s == 0:
            break
        if sign == 0:
            sign = s
        if s != sign:
            break
        streak += 1
    last = days[-1]
    return {
        "funds": funds,
        "info": {f: list(FUNDS[f]) for f in funds if f in FUNDS},
        "days": [[d, t, v] for d, t, v in days[-KEEP_DAYS:]],
        "first": days[0][0], "n_days": len(days),
        "last": {"d": last[0], "t": last[1], "by": dict(zip(funds, last[2]))},
        "w5": {"t": t7, "by": p7}, "w21": {"t": t30, "by": p30},
        "cum": {f: round(v, 1) for f, v in cum.items()}, "cum_total": tot_cum,
        "streak": sign * streak,
    }


def treasury(j):
    comp = sorted((j.get("companies") or []), key=lambda c: -(c.get("total_holdings") or 0))
    return {"total": j.get("total_holdings"), "value": j.get("total_value_usd"), "dom": j.get("market_cap_dominance"), "n": len(comp),
            "top": [{"n": str(c.get("name") or "")[:60], "s": str(c.get("symbol") or "")[:16], "c": str(c.get("country") or "")[:3],
                     "h": c.get("total_holdings"), "e": c.get("total_entry_value_usd"), "v": c.get("total_current_value_usd"),
                     "p": c.get("percentage_of_total_supply")} for c in comp[:30]]}


def main(fetch_html=None, fetch_json=None, now=None):
    import requests
    now = now or time.time()
    old = {}
    try:
        old = json.load(open(OUT, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        pass
    out = dict(old)
    out.setdefault("src", {})
    errors = dict(old.get("errors") or {})        # a source skipped this run keeps its last error
    s = requests.Session()
    s.headers.update(UA)
    fetch_html = fetch_html or (lambda u: s.get(u, timeout=40).text)
    fetch_json = fetch_json or (lambda u: s.get(u, timeout=40).json())
    for k, url in FARSIDE.items():
        last = (old.get("src") or {}).get(f"farside_{k}_try", 0)
        if k in old and now - last < 3600:
            continue
        out["src"][f"farside_{k}_try"] = int(now)
        try:
            funds, days = parse_farside(fetch_html(url))
            out[k] = summarise(funds, days)
            out["src"][f"farside_{k}"] = datetime.fromtimestamp(now, timezone.utc).isoformat()
            errors.pop(f"farside_{k}", None)
            print(f"{k}: {len(funds)} funds, {len(days)} days, last {days[-1][0]} {days[-1][1]:+} m")
        except Exception as e:  # noqa: BLE001
            errors[f"farside_{k}"] = str(e)[:200]
            print(f"{k}: {e} — the previous figures stay")
    tre = out.get("tre") or {}
    if now - (tre.get("t") or 0) > 6 * 3600:
        new = {"t": int(now)}
        for k, cg in (("btc", "bitcoin"), ("eth", "ethereum")):
            try:
                new[k] = treasury(fetch_json(CG + cg))
                errors.pop(f"treasury_{k}", None)
                time.sleep(1.5)
            except Exception as e:  # noqa: BLE001
                errors[f"treasury_{k}"] = str(e)[:200]
                if tre.get(k):
                    new[k] = tre[k]
        if new.get("btc") or new.get("eth"):
            out["tre"] = new
    out["errors"] = errors
    out["t"] = datetime.fromtimestamp(now, timezone.utc).isoformat()
    out["v"] = 1
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    print(f"wrote {OUT} ({os.path.getsize(OUT) // 1024} kB) errors={errors}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
