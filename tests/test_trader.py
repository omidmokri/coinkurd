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
import trader_more as M  # noqa: E402
import trader_pos as P  # noqa: E402

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


walk(D.HUB, "HUB"), walk(D.LV, "LV"), walk(D.SEC, "SEC")
walk(M.MANAGE, "MANAGE"), walk(M.AFTER, "AFTER"), walk(M.FAQ, "FAQ"), walk(M.TODAY, "TODAY")
walk({k: v["story"] for k, v in M.EXAMPLE.items()}, "EXAMPLE")
walk(P.T, "POS"), walk(P.FAM, "FAM"), walk(P.REG, "REG"), walk(P.FNG, "FNG"), walk(P.TF, "TF")
for k in D.LEVELS:
    for part in ("MANAGE", "AFTER", "FAQ", "EXAMPLE"):
        if k not in getattr(M, part):
            bad.append(f"{part}: no {k}")
for key, v in M.TODAY.items():
    if set(v) != set(D.LEVELS):
        bad.append(f"TODAY.{key}: levels")
import trader_setups as TS  # noqa: E402
if set(P.FAM) != set(TS.FAMILIES):
    bad.append("every rule family needs its words in trader_pos.FAM")
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

# build and look at the output (a saved replay result: no network in tests)
FIX = os.path.join(ROOT, "tests", "fixtures")


def build(src):
    env = dict(os.environ, TRADER_SETUPS=src)
    return subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_trader.py")], cwd=ROOT, capture_output=True, text=True, env=env)


def page(k=None):
    return open(os.path.join(ROOT, "trader", *([k] if k else []), "index.html"), encoding="utf-8").read()


# 1) a made-up qualified long and short: full cards, beginner sees the long only, pro sees leverage
r = build(os.path.join(FIX, "trader_setups_qual.json"))
if r.returncode:
    bad.append("build (qual) failed: " + r.stderr[-400:])
else:
    h = page()
    if h.count("<article class='rc-card tr-pos") != 6:
        bad.append(f"hub: expected 2 cards × 3 languages, got {h.count('<article class=' + chr(39) + 'rc-card tr-pos')}")
    for need in ("98.875", "94.00", "106.00", "118.00", "tr-pb", "tr-rt"):
        if need not in h:
            bad.append(f"hub card: no {need}")
    b = page("beginner")
    if b.count("<article class='rc-card tr-pos tr-long'") != 3 or "tr-pos tr-short" in b:
        bad.append("beginner: long cards only")
    if P.e(P.T["beg_short"]["fa"]) not in b:
        bad.append("beginner: no note on leaving shorts out")
    if "class='rc-btn2 tr-load'" not in b:
        bad.append("beginner: no load button")
    pr = page("pro")
    if "9x" not in pr.replace("<span class='rc-num' dir='ltr'>", "").replace("</span>", ""):
        bad.append("pro: no safe leverage")
# 2) nothing passes: the honest empty state, the fired rule named, no card, no plan of it
r = build(os.path.join(FIX, "trader_setups_none.json"))
if r.returncode:
    bad.append("build (none) failed: " + r.stderr[-400:])
else:
    for k in [None] + D.LEVELS:
        h = page(k)
        if "<article class='rc-card tr-pos" in h:
            bad.append(f"{k or 'hub'}: a card although nothing passes")
        if P.e(P.T["none_h"]["fa"]) not in h or P.e(P.T["none_h"]["en"]) not in h:
            bad.append(f"{k or 'hub'}: no empty-state line")
        if "1.2964" in h:
            bad.append(f"{k or 'hub'}: the plan of a non-passing setup leaked")
# 3) no data at all: say so, never a number
r = build("off")
if r.returncode:
    bad.append("build (off) failed: " + r.stderr[-400:])
elif P.e(P.T["nodata"]["en"]) not in page():
    bad.append("off: no 'not available' line")
# last: the fixture with nothing passing, which is also the honest default look; then the general checks
r = build(os.path.join(FIX, "trader_setups_none.json"))
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
    if ">…<" in h:
        bad.append(f"{k or 'hub'}: an empty placeholder is left")

for b in bad:
    print("FAIL", b)
print(f"trader: {len(bad)} problems")
sys.exit(1 if bad else 0)
