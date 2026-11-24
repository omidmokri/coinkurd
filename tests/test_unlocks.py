# -*- coding: utf-8 -*-
"""scripts/unlocks.py — what is kept of a project's unlock schedule, and what is shown of it.

Run: python3 tests/test_unlocks.py
"""
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import unlocks as U  # noqa: E402

FAIL = 0


def ok(cond, what):
    global FAIL
    print(("PASS " if cond else "FAIL ") + what)
    if not cond:
        FAIL += 1


NOW = 1_800_000_000


def doc(events, supply=1000.0, name="Aptos", gecko="aptos", token="coingecko:aptos"):
    return {"name": name, "gecko_id": gecko, "chainName": "Aptos",
            "supplyMetrics": {"adjustedSupply": supply, "maxSupply": supply * 2},
            "metadata": {"token": token, "events": events}}


def ev(t, n, cat="insiders", kind="cliff"):
    return {"timestamp": t, "noOfTokens": [n], "category": cat, "unlockType": kind,
            "description": "On {timestamp} {tokens[0]} will be unlocked"}


def main():
    # ---- what is read out of one project's file
    d = doc([ev(NOW - 86400, 50), ev(NOW + 86400, 10), ev(NOW + 2 * 86400, 20, "publicSale", "linear")])
    e = U.events_of(d, NOW)
    ok([x["n"] for x in e] == [10, 20], "an unlock that has already happened is not an unlock still to come")
    ok(e[0]["c"] == "insiders" and e[1]["k"] == "linear", "who the tokens were promised to, and how they arrive, are kept")
    ok(U.events_of(doc([ev(NOW + U.AHEAD + 86400, 99)]), NOW) == [], "one due years out says nothing about today and is dropped")
    ok(U.events_of(doc([ev(NOW + 3600, 0)]), NOW) == [] and U.events_of(doc([ev(NOW + 3600, -5)]), NOW) == [],
       "an event of no tokens, or of a negative number of them, is not kept")
    ok(U.events_of({"metadata": {"events": "nonsense"}}, NOW) == [] and U.events_of(None, NOW) == [],
       "a file that is not a schedule gives no events, and does not raise")
    same = U.events_of(doc([ev(NOW + 3600, 10), ev(NOW + 7200, 15), ev(NOW + 86400 * 2, 5)]), NOW)
    ok(len(same) == 2 and same[0]["n"] == 25, "two tranches of the same day to the same holders read as one unlock")
    ok(len(U.events_of(doc([ev(NOW + 86400 * i, i + 1, "c%d" % i) for i in range(1, 20)]), NOW)) == U.EVENTS,
       "only the next few are kept, however long the schedule runs")

    # ---- how much is in circulation
    ok(U.supply_of(d) == 1000, "the supply is the adjusted one where the source gives it")
    ok(U.supply_of({"supplyMetrics": {"maxSupply": 7}}) == 7 and U.supply_of({}) == 0, "…the maximum otherwise, and zero when neither is there")

    # ---- the summary that is kept on disk
    s = U.summary("aptos", d, NOW)
    ok(s["name"] == "Aptos" and s["token"] == "aptos" and s["supply"] == 1000 and len(s["ev"]) == 2,
       "a project is kept as its name, its token, its supply and its next unlocks")
    ok(U.summary("x", doc([ev(NOW - 10, 5)]), NOW) is None, "a project with nothing left to unlock is not kept at all")
    ok(len(str(s)) < 700, "…and what is kept of it is a few hundred bytes, not the two megabytes it came from")

    # ---- what the page is given
    store = {"coins": {
        "aptos": dict(s, price=5.0, at=NOW),
        "thin": {"slug": "thin", "name": "Thin", "token": "thin", "supply": 1e9, "price": 0.000001,
                 "ev": [{"t": NOW + 86400, "n": 1000, "c": "team", "k": "cliff"}], "at": NOW},
        "nostale": {"at": NOW, "miss": 1}}}
    rows = U.soon(store, 30, NOW, min_usd=10)
    ok([r["slug"] for r in rows] == ["aptos", "aptos"], "an unlock worth a thousandth of a cent is left out, and a project with no schedule brings no rows")
    ok(U.soon(store, 30, NOW) == [], "under the default, an unlock too small for any market to feel is not shown at all")
    ok(rows[0]["usd"] >= rows[1]["usd"], "the largest in dollars is first, because that is the one a market feels")
    ok(abs(rows[0]["pct"] - 2.0) < 0.001, "each carries what share of the supply it is")
    ok(U.soon({"coins": {}}, 30, NOW) == [], "an empty store gives an empty page, not an error")
    ok(all(r["t"] <= NOW + 30 * 86400 for r in U.soon(store, 30, NOW, min_usd=10)), "nothing beyond the window asked for")

    # ---- the store itself
    ok(U.load("/does/not/exist")["coins"] == {}, "a missing file reads as an empty store")
    ok(U.slug_ok("lido-dao") and not U.slug_ok("../etc/passwd") and not U.slug_ok("a" * 61) and not U.slug_ok(5),
       "a project name that could reach out of its own address is refused before it is ever asked for")

    print("\n" + ("ALL PASS" if not FAIL else f"{FAIL} FAILED"))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
