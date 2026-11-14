#!/usr/bin/env python3
"""The Observatory's strings (assets/obs/i18n.js) in four languages:
  * every language has exactly the English keys, with the same {placeholders};
  * every key the scripts ask for (T('…') and the families built from a prefix) exists, and no key is left unused;
  * digits follow the site's convention: Persian ۰-۹, Sorani and Arabic ٠-٩, no Latin digits inside the prose;
  * the pages built by scripts/build_obs.py carry all four languages for every heading, lead and section.
Run: python3 tests/test_obs_i18n.py"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = open(os.path.join(ROOT, "assets", "obs", "i18n.js"), encoding="utf-8").read()
FAIL = []


def block(lang):
    i = SRC.index(f"S.{lang} = {{")
    j = SRC.index("\n  };", i)
    return SRC[i:j]


def strings(lang):
    out = {}
    for m in re.finditer(r"(\w+): '((?:[^'\\]|\\.)*)'", block(lang)):
        if m.group(1) in out:
            FAIL.append(f"{lang}: key {m.group(1)} twice")
        out[m.group(1)] = m.group(2)
    return out


L = {lg: strings(lg) for lg in ("en", "fa", "ckb", "ar")}
EN = L["en"]
ph = lambda s: sorted(re.findall(r"\{(\w+)\}", s))
LATIN_OK = r"\{\w+\}|Binance|Bybit|OKX|Ctrl|VPN|PNG|[A-Za-z][A-Za-z0-9.\-]*[0-9][A-Za-z0-9.\-]*"
for lg in ("fa", "ckb", "ar"):
    miss = sorted(set(EN) - set(L[lg]))
    extra = sorted(set(L[lg]) - set(EN))
    if miss:
        FAIL.append(f"{lg}: missing {miss}")
    if extra:
        FAIL.append(f"{lg}: not in English {extra}")
    for k, v in L[lg].items():
        if k in EN and ph(v) != ph(EN[k]):
            FAIL.append(f"{lg}.{k}: placeholders {ph(v)} vs en {ph(EN[k])}")
        prose = re.sub(LATIN_OK, "", v)
        if re.search(r"[0-9]", prose):
            FAIL.append(f"{lg}.{k}: Latin digits in prose: {v!r}")
        if lg == "fa" and re.search("[٠-٩]", v):
            FAIL.append(f"fa.{k}: Arabic-Indic digits (Persian uses ۰-۹): {v!r}")
        if lg in ("ckb", "ar") and re.search("[۰-۹]", v):
            FAIL.append(f"{lg}.{k}: Persian digits ({lg} uses ٠-٩): {v!r}")
        if lg in ("fa", "ckb") and re.search("[يك]", v):
            FAIL.append(f"{lg}.{k}: Arabic yeh/kaf instead of ی/ک: {v!r}")
        if not v.strip():
            FAIL.append(f"{lg}.{k}: empty")

# ---------------------------------------------------------------- keys the scripts use
JS = {p: open(p, encoding="utf-8").read() for p in glob.glob(os.path.join(ROOT, "assets", "obs", "*.js")) if not p.endswith("i18n.js")}
used = set()
for path, s in JS.items():
    for m in re.finditer(r"\bT\(", s):            # every quoted key inside a T( … ) argument, ternaries included
        i, depth, j = m.end(), 1, m.end()
        while j < len(s) and depth:
            depth += {"(": 1, ")": -1}.get(s[j], 0)
            j += 1
        arg = s[i:j - 1]
        head = re.split(r",\s*\{", arg, maxsplit=1)[0]          # not the placeholder object
        head = re.sub(r"[!=<>]==?\s*'[^']*'", "", head)             # comparisons are not keys
        for q in re.findall(r"'([a-zA-Z][a-zA-Z0-9_]*)'(?!\s*\+)", head):
            used.add((q, os.path.basename(path)))
# keys built from a prefix: T('r_' + k), T('tab_' + p.k), T('pal_' + p), T('m' + i), T('m' + i + '_d')
FAMILIES = {
    "r_": ["12h", "24h", "48h", "3d", "1w", "2w", "1m", "3m", "6m", "1y"],
    "tab_": [m.group(1) for m in re.finditer(r"\{ k: '(\w+)', path:", JS[os.path.join(ROOT, "assets", "obs", "core.js")])],
    "pal_": ["fire", "viridis", "ice", "mono"],
    "m": ["1", "2", "3", "1_d", "2_d", "3_d"],
    "ls_": ["bn_all", "by_all", "bn_top_acc", "bn_top_pos"],
    # stage 3 (chain.js, opt.js): measures, ranges, NUPL bands, the pages' notes, the options views and DVOL ranges
    "cm_": ["mvrv", "z", "nupl", "caps", "reserve", "net", "inout", "adr", "tx", "hash", "rev", "puell", "s2f", "mayer", "w200", "pi", "y2", "gold", "dd"],
    "cr_": ["1y", "2y", "4y", "8y", "all"],
    "nz": ["0", "1", "2", "3", "4"],
    "note_": ["mvrv", "flows", "network", "cycle"],
    "ov_": ["strike", "expiry", "dvol"],
    "or_": ["1m", "3m", "1y", "all"],
    # stage 4 (flow.js, prem.js): the views of the basis page and the measures of the stablecoin page
    "bv_": ["cb", "perp", "curve"],
    "sm_": ["supply", "ssr", "chg", "mix"],
}
for q, f in sorted(used):
    if q not in EN:
        FAIL.append(f"{f}: T('{q}') has no string")
fam_keys = set()
for pre, tails in FAMILIES.items():
    if not tails:
        FAIL.append(f"family {pre}: nothing found")
    for t in tails:
        fam_keys.add(pre + t)
        if pre + t not in EN:
            FAIL.append(f"family key {pre + t} has no string")
unused = sorted(set(EN) - {q for q, _ in used} - fam_keys)
if unused:
    FAIL.append(f"strings nobody asks for: {unused}")

# ---------------------------------------------------------------- the static pages: four languages everywhere
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import build_obs as B  # noqa: E402

for view, folder, scripts in B.PAGES:
    t = B.T[view]
    for part in ("h1", "p", "about"):
        if sorted(t[part]) != sorted(B.LANGS):
            FAIL.append(f"build_obs {view}.{part}: languages {sorted(t[part])}")
    n = {lg: len(t["about"][lg]) for lg in B.LANGS}
    for lg in B.LANGS:
        for h, items in t["about"][lg]:
            if not h.strip() or not items:
                FAIL.append(f"build_obs {view}.about.{lg}: empty section")
    doc = open(os.path.join(ROOT, B.HUB_PATH, folder, "index.html"), encoding="utf-8").read()
    for lg in B.LANGS:
        if f'<section class="ob-about" data-lang="{lg}"' not in doc:
            FAIL.append(f"/{B.HUB_PATH}/{folder}/: no about text in {lg} (run scripts/build_obs.py)")
    for s in scripts:
        if not os.path.exists(os.path.join(ROOT, "assets", "obs", s)):
            FAIL.append(f"{view}: script {s} missing")
    if f'data-view="{view}"' not in doc or "ek:header" not in doc or "Content-Security-Policy" not in doc:
        FAIL.append(f"/{B.HUB_PATH}/{folder}/: page is not complete (view, header or CSP missing)")
hub = B.HUB
for part in ("h1", "p", "new", "soon", "soon_note"):
    if sorted(hub[part]) != sorted(B.LANGS):
        FAIL.append(f"hub.{part}: languages {sorted(hub[part])}")
for sec, cards in hub["secs"]:
    if sorted(sec) != sorted(B.LANGS):
        FAIL.append(f"hub section {sec.get('en')}: languages")
    for path, new, tt, ds in cards:
        if sorted(tt) != sorted(B.LANGS) or sorted(ds) != sorted(B.LANGS):
            FAIL.append(f"hub card {path}: languages")
        if path.startswith(f"/{B.HUB_PATH}/") and not os.path.exists(os.path.join(ROOT, path.strip("/"), "index.html")):
            FAIL.append(f"hub card {path}: page does not exist")
for x in hub["todo"]:
    if sorted(x) != sorted(B.LANGS):
        FAIL.append(f"hub todo {x.get('en')}: languages")
# the tabs of the app and the builder's pages are the same list
tabs = FAMILIES["tab_"]
if tabs != [v for v, _, _ in B.PAGES]:
    FAIL.append(f"core.js PAGES {tabs} differ from build_obs PAGES {[v for v, _, _ in B.PAGES]}")

print(f"observatory i18n: {len(EN)} keys × 4 languages, {len(used)} uses in scripts, {len(B.PAGES) + 1} pages")
for f in FAIL:
    print("  FAIL", f)
sys.exit(1 if FAIL else 0)
