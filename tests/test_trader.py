#!/usr/bin/env python3
"""/trader/ — «مسیر تریدر»: every text in three languages, every link to a page the site has, the pages build.
Run: python3 tests/test_trader.py   (the plan arithmetic is tests/test_trader.js)"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import chrome  # noqa: E402
import trader_data as D  # noqa: E402

bad = []


def walk(o, where):
    if isinstance(o, dict) and set(o) == {"fa", "ckb", "en"}:
        for lg, v in o.items():
            if not isinstance(v, str) or not v.strip():
                bad.append(f"{where}: empty {lg}")
            elif re.search(r"<|>|javascript:", v):
                bad.append(f"{where}: markup in {lg}")
        if re.search(r"[A-Za-z]{4,}", o["fa"] + o["ckb"]) and not re.search(r"CVD|ATR|VaR|DNA|Invalidation|entekhab|FOMC|R:R|Kelly", o["fa"] + o["ckb"]):
            bad.append(f"{where}: latin words in fa/ckb: {o['fa'][:40]}")
        return
    if isinstance(o, dict):
        for k, v in o.items():
            walk(v, f"{where}.{k}")
    elif isinstance(o, (list, tuple)):
        for i, v in enumerate(o):
            walk(v, f"{where}[{i}]")


walk(D.HUB, "HUB"), walk(D.QUIZ, "QUIZ"), walk(D.QUIZ_TXT, "QUIZ_TXT"), walk(D.LV, "LV"), walk(D.SEC, "SEC")

# quiz: five questions of four answers, cuts cover 0..15 in four bands
if len(D.QUIZ) != 5 or any(len(a) != 4 for _, a in D.QUIZ) or not (0 < D.QUIZ_CUT[0] < D.QUIZ_CUT[1] < D.QUIZ_CUT[2] < 15):
    bad.append("quiz shape")
if list(D.LV) != D.LEVELS:
    bad.append("levels order")

# links: a menu page, an Observatory chart, or an anchor that exists on its page
nav = {h for c in chrome.NAV for h, *_ in c["items"]}
import build_obs  # noqa: E402
nav |= {f"/{f}/" for f in build_obs.folders()}
for k, v in D.LV.items():
    if not v["plan"] or v["plan"][0] != "base":
        bad.append(f"{k}: plan must start with base")
    for i, (_t, _w, links) in enumerate(v["checks"]):
        for h, _lab in links:
            base, _, frag = h.partition("#")
            if base not in nav:
                bad.append(f"{k} check {i}: {h} is not a page of the site")
            if frag:
                f = os.path.join(ROOT, base.strip("/"), "index.html")
                if not os.path.exists(f) or f'id="{frag}"' not in open(f, encoding="utf-8").read():
                    bad.append(f"{k} check {i}: anchor {h} not found")
if "/trader/" not in nav:
    bad.append("/trader/ is not in the menu")

# build and look at the output
r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_trader.py")], cwd=ROOT, capture_output=True, text=True)
if r.returncode:
    bad.append("build failed: " + r.stderr[-400:])
for k in [None] + D.LEVELS:
    f = os.path.join(ROOT, "trader", *( [k] if k else []), "index.html")
    if not os.path.exists(f):
        bad.append(f"missing {f}")
        continue
    h = open(f, encoding="utf-8").read()
    for need in ("/assets/trader/trader.js", "/assets/trader/trader.css", "data-rl='ckb'", "data-rl='en'", "application/ld+json"):
        if need not in h:
            bad.append(f"{k or 'hub'}: no {need}")
    if k and f"data-fields='{' '.join(D.LV[k]['plan'])}'" not in h:
        bad.append(f"{k}: plan fields")
    if k and h.count("class='tr-chk'") != 3 * len(D.LV[k]["checks"]):
        bad.append(f"{k}: checkboxes")
    if re.search(r"<script>(?![\s\S]*?ck_lang)[^<]*</script>", h.split("</main>")[0].split("<main")[-1]):
        bad.append(f"{k or 'hub'}: unexpected inline script in main")
    if not k and h.count("class='tr-q'") != 15:
        bad.append("hub: quiz fieldsets")

for b in bad:
    print("FAIL", b)
print(f"trader: {len(bad)} problems")
sys.exit(1 if bad else 0)
