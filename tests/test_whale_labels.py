#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""The whale radar's address labels: data/whale_labels.json and the three places a reader meets it.

The radar used to print raw addresses, which tell a reader nothing. Checks:
  * the committed table is present, well formed, and carries both chains;
  * a lookup is case-insensitive for Ethereum and case-sensitive for Bitcoin, which is how the two chains work;
  * a name that embeds an address fragment ("FalconX: 0x115...101") has been tidied;
  * an unknown address comes back empty rather than guessed;
  * the site renders a known address as a name and an unknown one as the address;
  * the Telegram alert does the same, and marks a sanctioned address.
Run: python3 tests/test_whale_labels.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

FAILS = []


def ok(what, cond, got=None):
    print(("PASS " if cond else "FAIL ") + what + ("" if cond else f"  -> {got!r}"))
    if not cond:
        FAILS.append(what)


def main():
    import whale_labels as W

    path = os.path.join(ROOT, "data", "whale_labels.json")
    ok("the table is committed to the repository", os.path.exists(path))
    doc = json.load(open(path, encoding="utf-8"))
    ok("it says where it came from and when", bool(doc.get("sources")) and bool(doc.get("generated_at")))
    t = doc.get("a") or {}
    ok("it holds both chains", doc["counts"]["ethereum"] > 1000 and doc["counts"]["bitcoin"] > 100, doc.get("counts"))
    ok("every entry is a (name, category) pair",
       all(isinstance(v, list) and len(v) == 2 and v[0] for v in t.values()))

    evm = [a for a in t if a.startswith("0x")]
    ok("Ethereum addresses are stored folded to lower case", all(a == a.lower() for a in evm))
    a = evm[0]
    ok("an Ethereum lookup ignores case", W.look(a.upper())[0] == W.look(a)[0] == t[a][0])

    btc = [x for x in t if not x.startswith("0x")]
    b = btc[0]
    ok("a Bitcoin address keeps its case", W.look(b)[0] == t[b][0])
    ok("a Bitcoin address is not matched case-folded", W.look(b.lower())[0] is None or b.lower() in t)

    ok("no name still carries an address fragment",
       not [v[0] for v in t.values() if re.search(r"0x[0-9a-f]{3,}\s*\.{2,}", v[0], re.I)])
    ok("an unknown address is not guessed at",
       W.look("0x" + "ab" * 20) == (None, None) and W.look("") == (None, None))

    import build_pages as B
    known = next(x for x in t if t[x][1] == "cex")
    ok("the site shows a known address by name", t[known][0] in B._party(known))
    ok("the site shows an unknown address as the address", "0xabab" in B._party("0x" + "ab" * 20))
    ok("the full address stays available on hover", known in B._party(known))

    import bot_watch
    ok("a Telegram alert uses the name",
       bot_watch._party({"from_name": "Binance 8", "from_kind": "cex"}, "from") == "Binance 8")
    ok("a Telegram alert marks a sanctioned address",
       "⛔" in bot_watch._party({"to_name": "OFAC SDN", "to_kind": "sanctioned"}, "to"))
    ok("a Telegram alert falls back to the short address",
       bot_watch._party({"to": "0x" + "cd" * 20}, "to").startswith("0xcdcd"))

    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nOK")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
