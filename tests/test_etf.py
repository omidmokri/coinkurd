#!/usr/bin/env python3
"""Tests for scripts/etf.py on pages built like Farside's real tables (read 2026-11-12: <table class="etf">, a <thead> row
"Date | IBIT | … | Total" — the Ether page leaves the first header cell empty —, an empty first <tbody> row, negative flows in
brackets, "-" for a fund with no report, today's not-yet-reported row of dashes, and a closing "Total" row) and CoinGecko's
public-treasury JSON. Expected numbers are worked out by hand.  Run: python3 tests/test_etf.py
"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "scripts"))
import etf as E  # noqa: E402

FAIL = []


def check(name, got, want):
    if got != want:
        FAIL.append(f"{name}: got {got!r}, want {want!r}")


def page(first_head, funds, rows):
    th = "".join(f"<th>{x}</th>" for x in [first_head] + funds + ["Total"])
    body = "<tr></tr>" + "".join("<tr>" + "".join(f"<td><span class='tabletext'>{c}</span></td>" for c in r) + "</tr>" for r in rows)
    return (f"<html><body><table class='etf'><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>"
            "<table class='tfooter'><tr><td>How can we assist you?</td></tr></table></body></html>")


BTC_FUNDS = ["IBIT", "FBTC", "GBTC", "BTC"]
BTC_ROWS = [
    ["11 Jan 2024", "111.7", "227.0", "(95.1)", "-", "243.6"],
    ["12 Jan 2024", "386.0", "195.3", "(484.1)", "-", "97.2"],
    ["06 Nov 2026", "(403.0)", "42.8", "(11.1)", "0.0", "(371.3)"],
    ["09 Nov 2026", "(213.2)", "0.0", "0.0", "0.0", "(213.2)"],
    ["10 Nov 2026", "(78.2)", "(36.8)", "0.0", "0.0", "(115.0)"],
    ["11 Nov 2026", "(269.7)", "0.0", "(39.1)", "0.0", "(308.8)"],
    ["12 Nov 2026", "-", "-", "-", "-", "0.0"],                      # not reported yet: not a zero day
    ["Total", "64,540", "10,238", "(28,149)", "2,879", "48,508"],
]


def main():
    check("brackets", E.cell_num("(403.0)"), -403.0)
    check("thousands", E.cell_num("1,234.5"), 1234.5)
    check("dash", E.cell_num("-"), None)
    check("zero", E.cell_num("0.0"), 0.0)
    check("junk", E.cell_num("n/a"), None)
    funds, days = E.parse_farside(page("Date", BTC_FUNDS, BTC_ROWS))
    check("funds", funds, BTC_FUNDS)
    check("dated rows only, pending day left out", [d[0] for d in days],
          ["2024-01-11", "2024-01-12", "2026-11-06", "2026-11-09", "2026-11-10", "2026-11-11"])
    check("row values", days[-1], ("2026-11-11", -308.8, [-269.7, 0.0, -39.1, 0.0]))
    check("missing fund stays None", days[0][2][3], None)
    s = E.summarise(funds, days)
    check("cumulative per fund", s["cum"], {"IBIT": round(111.7 + 386 - 403 - 213.2 - 78.2 - 269.7, 1), "FBTC": round(227 + 195.3 + 42.8 - 36.8, 1),
                                            "GBTC": round(-95.1 - 484.1 - 11.1 - 39.1, 1), "BTC": 0.0})
    check("cumulative total", s["cum_total"], round(243.6 + 97.2 - 371.3 - 213.2 - 115.0 - 308.8, 1))
    check("last day", (s["last"]["d"], s["last"]["t"], s["last"]["by"]["IBIT"]), ("2026-11-11", -308.8, -269.7))
    check("5-day window", s["w5"]["t"], round(97.2 - 371.3 - 213.2 - 115.0 - 308.8, 1))
    check("5-day IBIT", s["w5"]["by"]["IBIT"], round(386 - 403 - 213.2 - 78.2 - 269.7, 1))
    check("streak (4 days out)", s["streak"], -4)
    check("issuer", s["info"]["IBIT"], ["BlackRock", "NASDAQ"])
    # the Ether page: first header cell empty
    f2, d2 = E.parse_farside(page("", ["ETHA", "ETHE"], [["23 Jul 2024", "266.5", "(484.1)", "(217.6)"], ["24 Jul 2024", "(2.0)", "(326.9)", "(328.9)"],
                                                          ["25 Jul 2024", "71.3", "(346.2)", "(274.9)"], ["26 Jul 2024", "87.2", "(356.3)", "(269.1)"],
                                                          ["29 Jul 2024", "58.2", "(210.0)", "(151.8)"], ["Total", "1", "2", "3"]]))
    check("eth funds", f2, ["ETHA", "ETHE"])
    check("eth streak", E.summarise(f2, d2)["streak"], -5)
    # broken pages fail loudly (the previous figures then stay)
    for name, html in (("no table", "<html>Just a moment...</html>"), ("few rows", page("Date", BTC_FUNDS, BTC_ROWS[:2]))):
        try:
            E.parse_farside(html)
            FAIL.append(f"{name}: no error")
        except ValueError:
            pass
    # the whole run, with a failing Ether page and a stale previous file
    tmp = tempfile.mkdtemp()
    E.OUT = os.path.join(tmp, "etf.json")
    json.dump({"eth": {"funds": ["OLD"]}, "src": {"farside_eth_try": 0}}, open(E.OUT, "w"))
    tre = {"total_holdings": 1301532.2, "total_value_usd": 93562784490.8, "market_cap_dominance": 6.2,
           "companies": [{"name": "Metaplanet", "symbol": "3350.T", "country": "JP", "total_holdings": 44000, "total_entry_value_usd": 3.9e9,
                          "total_current_value_usd": 3.16e9, "percentage_of_total_supply": 0.21},
                         {"name": "Strategy", "symbol": "MSTR.US", "country": "US", "total_holdings": 850363, "total_entry_value_usd": 6.4e10,
                          "total_current_value_usd": 6.1e10, "percentage_of_total_supply": 4.049}]}

    def fh(url):
        if "ethereum" in url:
            return "<html><title>Just a moment...</title></html>"
        return page("Date", BTC_FUNDS, BTC_ROWS)
    E.time.sleep = lambda s: None
    E.main(fetch_html=fh, fetch_json=lambda u: tre, now=1794500000)
    o = json.load(open(E.OUT))
    check("btc written", o["btc"]["last"]["d"], "2026-11-11")
    check("eth kept on failure", o["eth"]["funds"], ["OLD"])
    check("error recorded", "farside_eth" in o["errors"], True)
    check("treasury sorted", [c["n"] for c in o["tre"]["btc"]["top"]], ["Strategy", "Metaplanet"])
    check("treasury total", o["tre"]["btc"]["total"], 1301532.2)
    # within the hour nothing is fetched again
    calls = []
    E.main(fetch_html=lambda u: calls.append(u) or page("Date", BTC_FUNDS, BTC_ROWS), fetch_json=lambda u: calls.append(u) or tre, now=1794500000 + 600)
    check("hourly limit", calls, [])
    check("a skipped source keeps its error", "farside_eth" in json.load(open(E.OUT))["errors"], True)
    if FAIL:
        print("\n".join("FAIL " + f for f in FAIL))
        sys.exit(1)
    print("etf: all checks passed")


if __name__ == "__main__":
    main()
