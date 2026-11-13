#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ETFs and institutions for /etf/ — data/etf.json

  * US spot Bitcoin and Ether ETFs: the daily net flow of every fund in US$ millions, from Farside Investors' public
    tables (https://farside.co.uk/bitcoin-etf-flow-all-data/ and /ethereum-etf-flow-all-data/), the figures SoSoValue and
    the press quote. A day whose funds have not reported yet ("-" everywhere) is not a day of zero flow and is left out.
  * Public companies holding BTC and ETH: CoinGecko /companies/public_treasury/{bitcoin,ethereum} (keyless).
  * Bitcoin treasuries, as Bitcoin Treasuries (https://bitcointreasuries.net/) publishes them: the top 100 public
    companies (holding, value, market cap, share of 21 M) and the totals per holder type (public and private companies,
    governments, ETFs and exchanges, DeFi). Preferred over CoinGecko for BTC: it is updated sooner after each purchase.
  * The world's largest assets (companies, ETFs, metals, crypto) with Bitcoin's place among them, from 8marketcap
    (https://8marketcap.com/): its top rows, read at most once an hour.

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
BT_URL = "https://bitcointreasuries.net/"
MC8_URL = "https://8marketcap.com/"
BT_CATS = {"Public Companies": "pub", "Private Companies": "priv", "Government Entities": "gov", "ETFs and Exchanges": "etf", "DeFi and Other": "defi"}
MC8_KIND = {"badge-company": "co", "badge-etf": "etf", "badge-metal": "metal", "badge-crypto": "crypto"}


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


def _num(t):
    t = re.sub(r"[^0-9.\-]", "", (t or "").replace("\u2212", "-"))
    try:
        return float(t) if t not in ("", "-", ".") else None
    except ValueError:
        return None


def _flag(t):
    """🇺🇸 -> US (two regional-indicator letters); anything else -> """""
    cs = [ord(c) - 0x1F1E6 for c in (t or "").strip() if 0x1F1E6 <= ord(c) <= 0x1F1FF]
    return "".join(chr(65 + c) for c in cs[:2]) if len(cs) >= 2 else ""


def parse_bt(html):
    """Bitcoin Treasuries home page -> {"cats": {...}, "top": [...]}; raises when the ranking table is not there"""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    table = None
    for t in soup.find_all("table"):
        head = [th.get_text(" ", strip=True) for th in t.select("thead th")]
        if "Market Cap" in head and "In USD" in head:
            table = t
    if table is None:
        raise ValueError("ranking table not found")
    top = []
    for tr in table.select("tbody tr"):
        td = tr.find_all("td")
        if len(td) < 5:
            continue
        a = td[2].find("a")
        tk = td[2].find(attrs={"data-ticker": True})
        name = (a.get_text(" ", strip=True) if a else td[2].get_text(" ", strip=True))[:60]
        h = _num(td[3].get_text())
        if not name or h is None or h <= 0:
            continue
        p21 = _num(td[-1].get_text()) if td[-1].get_text().strip().endswith("%") else None
        top.append({"r": len(top) + 1, "n": name, "s": (tk.get_text(strip=True) if tk else "")[:16], "c": _flag(td[1].get_text()),
                    "h": h, "v": (_num(td[4].get_text()) or 0) * 1e6 or None,
                    "mc": (_num(td[5].get_text()) * 1e6) if len(td) > 5 and _num(td[5].get_text()) else None, "p": p21})
        if len(top) >= 100:
            break
    if len(top) < 20:
        raise ValueError(f"only {len(top)} companies read")
    text = re.sub(r"\s+", " ", soup.get_text(" "))
    cats = {}
    for label, k in BT_CATS.items():
        m = re.search(re.escape(label) + r" ₿ ?([\d,]+)", text)
        if m:
            cats[k] = float(m.group(1).replace(",", ""))
    return {"cats": cats, "top": top, "n": len(top)}


def parse_8mc(html, n=40):
    """8marketcap home page -> the top `n` assets, plus Bitcoin's row wherever it is; raises when the table is not there"""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    t = soup.find("table")
    if t is None:
        raise ValueError("table not found")
    rows, btc = [], None
    for tr in t.select("tbody tr"):
        td = tr.find_all("td")
        if len(td) < 7:
            continue
        nm = tr.select_one(".company-name")
        b = tr.select_one(".badge")
        mc = _num(td[4].get("data-sort"))
        r = _num(td[1].get_text())
        if not nm or not b or not mc or not r:
            continue
        kind = next((v for k, v in MC8_KIND.items() if k in (b.get("class") or [])), "co")
        d1, d7 = _num(td[6].get("data-sort")), _num(td[7].get("data-sort")) if len(td) > 7 else None
        row = {"r": int(r), "n": nm.get_text(" ", strip=True)[:50], "s": b.get_text(strip=True)[:14], "k": kind, "mc": mc,
               "p": _num(td[5].get("data-sort")), "d1": d1 / 100 if d1 is not None else None, "d7": d7 / 100 if d7 is not None else None}
        if len(rows) < n:
            rows.append(row)
        if row["s"] == "BTC" and kind == "crypto":
            btc = row
        if len(rows) >= n and btc:
            break
    if len(rows) < 10:
        raise ValueError(f"only {len(rows)} rows read")
    return {"top": rows, "btc": btc}


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
    for key, url, parse, every in (("bt", BT_URL, parse_bt, 2 * 3600), ("world", MC8_URL, parse_8mc, 3600)):
        last = (old.get("src") or {}).get(f"{key}_try", 0)
        if key in old and now - last < every:
            continue
        out["src"][f"{key}_try"] = int(now)
        try:
            out[key] = dict(parse(fetch_html(url)), t=datetime.fromtimestamp(now, timezone.utc).isoformat())
            errors.pop(key, None)
            print(f"{key}: {len(out[key]['top'])} rows")
        except Exception as e:  # noqa: BLE001
            errors[key] = str(e)[:200]
            print(f"{key}: {e} — the previous figures stay")
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
