#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Official numbers and market odds for the economic calendar (/calendar/, the bot's pre/post event messages).

  * actual values of the main US releases, straight from the agency that publishes them — the BLS public API
    (v1, no key: CPI, core CPI, PPI, core PPI, payrolls, unemployment, hourly earnings) and the Federal Reserve's
    own FOMC statement (target range). ForexFactory's feed has forecast and previous only; its "previous" is
    the last reported actual, which is how the series below were checked (CPI 0.6% Sept, PPI 1.3%, core PPI 0.7%).
  * the odds of each FOMC outcome from Kalshi's public market data (a regulated US prediction market). CME's
    FedWatch numbers are CME's data and are not used; the page says which source it shows.

Everything here is pure or takes a `get(url, **kw)` function, so the logic is tested offline: python3 econ_src.py
"""
import json
import re
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

UA = {"User-Agent": "entekhab.net economic calendar (+https://entekhab.net/calendar/)"}
BLS = "https://api.bls.gov/publicAPI/v1/timeseries/data/"
FED_RSS = "https://www.federalreserve.gov/feeds/press_monetary.xml"
KALSHI = "https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=KXFEDDECISION&status=open&with_nested_markets=true"

# ForexFactory title -> (BLS series, how the headline number is made, +1 if "higher than forecast" is hawkish)
#   mm: % change on the month (seasonally adjusted series)   yy: % change on the year (unadjusted, as BLS reports it)
#   dk: change on the month in thousands ("65K")              lv: the level itself ("4.2%")
SPECS = {
    "CPI m/m": ("CUSR0000SA0", "mm", 1),
    "Core CPI m/m": ("CUSR0000SA0L1E", "mm", 1),
    "CPI y/y": ("CUUR0000SA0", "yy", 1),
    "Core CPI y/y": ("CUUR0000SA0L1E", "yy", 1),
    "PPI m/m": ("WPSFD4", "mm", 1),
    "Core PPI m/m": ("WPSFD49104", "mm", 1),
    "Non-Farm Employment Change": ("CES0000000001", "dk", 1),
    "Unemployment Rate": ("LNS14000000", "lv", -1),
    "Average Hourly Earnings m/m": ("CES0500000003", "mm", 1),
}
FED_TITLES = ("Federal Funds Rate", "FOMC Statement")
# which way "higher than forecast" points: +1 hawkish (tougher Fed, usually pressure on bitcoin), -1 dovish
DIRECTION = {"Retail Sales m/m": 1, "Core Retail Sales m/m": 1, "Advance GDP q/q": 1, "Prelim GDP q/q": 1,
             "Final GDP q/q": 1, "ISM Manufacturing PMI": 1, "ISM Services PMI": 1, "Unemployment Claims": -1,
             "Core PCE Price Index m/m": 1, "JOLTS Job Openings": 1, "ADP Non-Farm Employment Change": 1}
for _k, _v in SPECS.items():
    DIRECTION[_k] = _v[2]
for _k in FED_TITLES:
    DIRECTION[_k] = 1


def is_alert_event(e):
    """the events that go to the group and the bot: every red US release, FOMC included"""
    return e.get("c") == "USD" and e.get("i") == "H" and not re.search(r"Election|Holiday|Tentative", e.get("n") or "")


def ref_month(t):
    """the month a US release reports on: the calendar month before the release (CPI, PPI, jobs)"""
    d = datetime.fromtimestamp(t, timezone.utc)
    return (d.year - 1, 12) if d.month == 1 else (d.year, d.month - 1)


def _r1(x):
    return Decimal(repr(round(x, 6))).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def bls_parse(js):
    """BLS API answer -> {series: {(year, month): value}} (months only, missing '-' values dropped)"""
    out = {}
    for s in ((js or {}).get("Results") or {}).get("series") or []:
        vals = {}
        for x in s.get("data") or []:
            p = x.get("period") or ""
            if not re.fullmatch(r"M(0[1-9]|1[0-2])", p):
                continue
            try:
                vals[(int(x["year"]), int(p[1:]))] = float(x["value"])
            except (ValueError, KeyError, TypeError):
                continue
        out[s.get("seriesID")] = vals
    return out


def _prev(ym, n=1):
    y, m = ym
    m -= n
    while m <= 0:
        m += 12
        y -= 1
    return (y, m)


def actual_from(title, t, series):
    """official headline number for one release, formatted like the calendar ("0.3%", "65K"), or None if BLS has
    not published the reference month yet"""
    spec = SPECS.get(title)
    if not spec:
        return None
    sid, how, _ = spec
    v = (series or {}).get(sid) or {}
    ym = ref_month(t)
    if ym not in v:
        return None
    if how == "mm":
        p = v.get(_prev(ym))
        return None if not p else f"{_r1((v[ym] / p - 1) * 100)}%"
    if how == "yy":
        p = v.get(_prev(ym, 12))
        return None if not p else f"{_r1((v[ym] / p - 1) * 100)}%"
    if how == "dk":
        p = v.get(_prev(ym))
        return None if p is None else f"{int(round(v[ym] - p))}K"
    if how == "lv":
        return f"{_r1(v[ym])}%"
    return None


def bls_fetch(get, sids):
    """one request for up to 25 series (the v1 API without a key allows 25 requests a day per address)"""
    sids = sorted(set(sids))[:25]
    if not sids:
        return {}
    r = get(BLS, method="POST", json={"seriesid": sids})
    if (r or {}).get("status") != "REQUEST_SUCCEEDED":
        raise RuntimeError("BLS: " + "; ".join((r or {}).get("message") or ["no answer"]))
    return bls_parse(r)


# ------------------------------------------------------------------ the Fed
def _frac(s):
    """'3-3/4' -> 3.75, '4' -> 4, '1/4' -> 0.25"""
    s = s.strip().replace("\u2011", "-").replace("\u2010", "-")
    m = re.fullmatch(r"(?:(\d+)-)?(\d+)/(\d+)|(\d+)", s)
    if not m:
        raise ValueError(s)
    if m.group(4):
        return float(m.group(4))
    return int(m.group(1) or 0) + int(m.group(2)) / int(m.group(3))


def fed_statement(text):
    """FOMC statement text -> {lo, hi, move: raise|lower|maintain, bp, dissent} or None"""
    t = re.sub(r"\s+", " ", text or "")
    m = re.search(r"decided to (raise|lower|maintain|increase|reduce|cut)\b[^.]*?target range for the federal funds rate"
                  r"[^.]*?(?:at|to) ([\d\-/]+) to ([\d\-/]+) percent", t)
    if not m:
        return None
    move = {"increase": "raise", "reduce": "lower", "cut": "lower"}.get(m.group(1), m.group(1))
    lo, hi = _frac(m.group(2)), _frac(m.group(3))
    bp = None
    b = re.search(r"by (\d+(?:/\d+)?|\d+-\d+/\d+) percentage point", t)
    if b and move != "maintain":
        try:
            bp = round(_frac(b.group(1)) * 100)
        except Exception:
            bp = None
    v = re.search(r"by a (\d+)\s*[–-]\s*(\d+) vote", t)
    return {"lo": lo, "hi": hi, "move": move, "bp": bp, "vote": [int(v.group(1)), int(v.group(2))] if v else None}


def fed_rss(xml):
    """press_monetary.xml -> [(pubDate unix, url)] of FOMC statements, newest first"""
    out = []
    for it in re.findall(r"<item>(.*?)</item>", xml or "", re.S):
        title = re.search(r"<title>(.*?)</title>", it, re.S)
        link = re.search(r"<link>\s*(?:<!\[CDATA\[)?\s*(\S+?)\s*(?:\]\]>)?\s*</link>", it, re.S)
        pub = re.search(r"<pubDate>\s*(?:<!\[CDATA\[)?\s*(.*?)\s*(?:\]\]>)?\s*</pubDate>", it, re.S)
        if not (title and link and pub) or "FOMC statement" not in title.group(1):
            continue
        try:
            d = datetime.strptime(pub.group(1).strip(), "%a, %d %b %Y %H:%M:%S %Z").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        out.append((int(d.timestamp()), link.group(1).strip()))
    return sorted(out, reverse=True)


def html_text(html):
    h = re.sub(r"(?is)<(script|style).*?</\1>", " ", html or "")
    h = re.sub(r"<[^>]+>", " ", h)
    return re.sub(r"\s+", " ", h.replace("&nbsp;", " ").replace("&#39;", "'").replace("&amp;", "&"))


# ------------------------------------------------------------------ Kalshi odds
OUT_ORDER = ["C26", "C25", "H0", "H25", "H26"]       # cut >25, cut 25, hold, hike 25, hike >25 (basis points)
OUT_BP = {"C26": -50, "C25": -25, "H0": 0, "H25": 25, "H26": 50}


def _key(cs):
    if not isinstance(cs, dict) or len(cs) != 1:
        return None
    (side, v), = cs.items()
    v = str(v).strip()
    if side == "Cut":
        return {"25": "C25", ">25": "C26"}.get(v)
    if side == "Hike":
        return {"0": "H0", "25": "H25", ">25": "H26"}.get(v)
    return None


def _price(m):
    def f(k):
        try:
            return float(m.get(k) or 0)
        except (TypeError, ValueError):
            return 0.0
    b, a, last = f("yes_bid_dollars"), f("yes_ask_dollars"), f("last_price_dollars")
    if a > 0 and a - b <= 0.10:
        return (a + b) / 2
    return last or b


def kalshi_parse(js):
    """Kalshi events -> [{date (unix), title, p {C26..H26: %}, vol}] sorted by date; probabilities sum to 100"""
    out = []
    for ev in (js or {}).get("events") or []:
        try:
            date = int(datetime.fromisoformat(str(ev["strike_date"]).replace("Z", "+00:00")).timestamp())
        except (KeyError, ValueError):
            continue
        p, vol = {}, 0.0
        for m in ev.get("markets") or []:
            k = _key(m.get("custom_strike"))
            if k:
                p[k] = _price(m)
                try:
                    vol += float(m.get("volume_fp") or 0)
                except (TypeError, ValueError):
                    pass
        tot = sum(p.values())
        if len(p) < 3 or tot <= 0:
            continue
        p = {k: round(p.get(k, 0) / tot * 100, 1) for k in OUT_ORDER}
        out.append({"date": date, "ticker": ev.get("event_ticker"), "p": p, "vol": round(vol)})
    return sorted(out, key=lambda x: x["date"])


def expected_bp(p):
    return round(sum(OUT_BP[k] * v / 100 for k, v in p.items()), 1)


# ------------------------------------------------------------------ reading the result
def num(s):
    """'0.3%' -> 0.3, '65K' -> 65, '-12.5K' -> -12.5, '7.15M' -> 7.15, None if not a number"""
    if s is None:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", str(s).replace(",", ""))
    return float(m.group(0)) if m else None


def surprise(title, actual, forecast):
    """+1: hawkish surprise (usually stronger dollar, pressure on bitcoin), -1: dovish, 0: in line, None: unknown"""
    a, f = num(actual), num(forecast)
    d = DIRECTION.get(title)
    if a is None or f is None or d is None:
        return None
    if abs(a - f) < 1e-9:
        return 0
    return d if a > f else -d


def _selftest():
    sample = {"status": "REQUEST_SUCCEEDED", "Results": {"series": [
        {"seriesID": "CUSR0000SA0", "data": [{"year": "2026", "period": "M10", "value": "337.476"},
                                             {"year": "2026", "period": "M09", "value": "336.298"},
                                             {"year": "2026", "period": "M08", "value": "334.131"}]},
        {"seriesID": "WPSFD4", "data": [{"year": "2026", "period": "M09", "value": "159.780"},
                                        {"year": "2026", "period": "M08", "value": "157.662"}]},
        {"seriesID": "WPSFD49104", "data": [{"year": "2026", "period": "M09", "value": "156.172"},
                                            {"year": "2026", "period": "M08", "value": "155.115"}]},
        {"seriesID": "CES0000000001", "data": [{"year": "2026", "period": "M10", "value": "159293"},
                                               {"year": "2026", "period": "M09", "value": "159128"}]},
        {"seriesID": "LNS14000000", "data": [{"year": "2026", "period": "M10", "value": "4.1"}]},
        {"seriesID": "CUUR0000SA0", "data": [{"year": "2026", "period": "M10", "value": "337.511"},
                                             {"year": "2025", "period": "M10", "value": "-"}]}]}}
    s = bls_parse(sample)
    t_nov10 = int(datetime(2026, 11, 10, 13, 30, tzinfo=timezone.utc).timestamp())
    t_oct15 = int(datetime(2026, 10, 15, 12, 30, tzinfo=timezone.utc).timestamp())
    t_nov6 = int(datetime(2026, 11, 6, 13, 30, tzinfo=timezone.utc).timestamp())
    t_dec = int(datetime(2026, 12, 11, 13, 30, tzinfo=timezone.utc).timestamp())
    checks = [
        (actual_from("CPI m/m", t_nov10, s), "0.4%"),          # 337.476/336.298 = +0.350%
        (actual_from("CPI m/m", t_oct15, s), "0.6%"),          # Sept: ForexFactory's "previous" for the Nov release was 0.6%
        (actual_from("PPI m/m", t_oct15, s), "1.3%"),          # Sept PPI: FF previous 1.3%
        (actual_from("Core PPI m/m", t_oct15, s), "0.7%"),     # Sept core PPI: FF previous 0.7%
        (actual_from("Non-Farm Employment Change", t_nov6, s), "165K"),
        (actual_from("Unemployment Rate", t_nov6, s), "4.1%"),
        (actual_from("CPI y/y", t_nov10, s), None),            # Oct 2025 was never published (shutdown)
        (actual_from("CPI m/m", t_dec, s), None),              # not out yet
        (actual_from("Retail Sales m/m", t_nov10, s), None),
        (ref_month(int(datetime(2027, 1, 9, tzinfo=timezone.utc).timestamp())), (2026, 12)),
        (surprise("CPI m/m", "0.4%", "0.3%"), 1), (surprise("Unemployment Rate", "4.1%", "4.2%"), 1),
        (surprise("Non-Farm Employment Change", "40K", "65K"), -1), (surprise("CPI m/m", "0.3%", "0.3%"), 0),
        (surprise("Retail Sales m/m", "0.9%", "0.3%"), 1), (surprise("Unemployment Claims", "230K", "200K"), -1), (num("-12.5K"), -12.5),
    ]
    st = ("The Federal Open Market Committee approved the following statement for release by a 10 – 2 vote: The Committee "
          "decided to maintain the target range for the federal funds rate at 3-3/4 to 4 percent, in support of")
    checks.append((fed_statement(st), {"lo": 3.75, "hi": 4.0, "move": "maintain", "bp": None, "vote": [10, 2]}))
    st2 = "the Committee decided to raise the target range for the federal funds rate by 1/4 percentage point to 4 to 4-1/4 percent."
    checks.append((fed_statement(st2), {"lo": 4.0, "hi": 4.25, "move": "raise", "bp": 25, "vote": None}))
    rss = ("<rss><channel><item><title>Federal Reserve issues FOMC statement</title><link><![CDATA[ https://www.federalreserve.gov/x.htm ]]>"
           "</link><pubDate><![CDATA[ Wed, 28 Oct 2026 18:00:00 GMT ]]></pubDate></item><item><title>Minutes</title>"
           "<link>https://y</link><pubDate>Wed, 7 Oct 2026 18:00:00 GMT</pubDate></item></channel></rss>")
    checks.append((fed_rss(rss), [(1793210400, "https://www.federalreserve.gov/x.htm")]))
    k = {"events": [{"event_ticker": "KXFEDDECISION-26DEC", "strike_date": "2026-12-09T19:00:00Z", "markets": [
        {"custom_strike": {"Cut": ">25"}, "yes_bid_dollars": "0.0000", "yes_ask_dollars": "0.0100", "last_price_dollars": "0.0100"},
        {"custom_strike": {"Cut": "25"}, "yes_bid_dollars": "0.0000", "yes_ask_dollars": "0.0100", "last_price_dollars": "0.0100"},
        {"custom_strike": {"Hike": "0"}, "yes_bid_dollars": "0.0300", "yes_ask_dollars": "0.0400", "last_price_dollars": "0.0400"},
        {"custom_strike": {"Hike": "25"}, "yes_bid_dollars": "0.8800", "yes_ask_dollars": "0.8900", "last_price_dollars": "0.8900"},
        {"custom_strike": {"Hike": ">25"}, "yes_bid_dollars": "0.1000", "yes_ask_dollars": "0.1100", "last_price_dollars": "0.1000"}]}]}
    kp = kalshi_parse(k)
    checks.append((round(sum(kp[0]["p"].values())), 100))
    checks.append((max(kp[0]["p"], key=kp[0]["p"].get), "H25"))
    checks.append((kp[0]["date"], 1796842800))
    bad = [(i, got, want) for i, (got, want) in enumerate(checks) if got != want]
    for i, got, want in bad:
        print("FAIL", i, got, "!=", want)
    print(f"econ_src self-test: {len(checks) - len(bad)}/{len(checks)} ok")
    return not bad


if __name__ == "__main__":
    import sys
    sys.exit(0 if _selftest() else 1)
