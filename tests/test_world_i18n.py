"""/world/ strings: the four languages (fa, ckb, ar, en) have the same keys and the same {placeholders}; every card,
section and unit the page asks for exists.      Run: python3 tests/test_world_i18n.py"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
r = subprocess.run(["node", "-e", "process.stdout.write(JSON.stringify(require(process.argv[1])))", os.path.join(ROOT, "assets/world/i18n.js")],
                   capture_output=True, text=True)
I = json.loads(r.stdout)
bad = []
keys = set(I["en"])
for lg in ("fa", "ckb", "ar"):
    if set(I[lg]) != keys:
        bad.append((lg, "keys", sorted(keys ^ set(I[lg]))))
    for k in keys & set(I[lg]):
        if sorted(re.findall(r"\{(\w+)\}", I[lg][k])) != sorted(re.findall(r"\{(\w+)\}", I["en"][k])):
            bad.append((lg, k, "placeholders"))
src = open(os.path.join(ROOT, "assets/world/world.js"), encoding="utf-8").read()
cards = re.findall(r"\{ id: '(\w+)', cat: '(\w+)'", src)
for cid, cat in cards:
    for need in ("k_" + cid, "sec_" + cat, "secd_" + cat, "tag_" + cat):
        if need not in keys:
            bad.append(("card", cid, need))
for u in ("people", "t", "ha", "bbl", "mwh", "usd", "btc"):
    if "u_" + u not in keys:
        bad.append(("unit", u))
if len(I["fa"]["tags"].split()) != 4:
    bad.append(("tags", "four general hashtags"))
print("\n".join(map(str, bad)) or f"{len(keys)} keys × 4 languages, {len(cards)} cards: ok")
sys.exit(1 if bad else 0)
