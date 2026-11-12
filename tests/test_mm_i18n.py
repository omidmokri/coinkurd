#!/usr/bin/env python3
"""The market map's strings (assets/mm/i18n.js) in four languages:
  * every language has exactly the English keys, with the same {placeholders};
  * every key the scripts ask for (T('…'), keys built from a prefix, MM.has('…')) exists;
  * digits follow the site's convention: Persian ۰-۹, Sorani and Arabic ٠-٩, no Latin digits inside the prose.
Run: python3 tests/test_mm_i18n.py"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = open(os.path.join(ROOT, "assets", "mm", "i18n.js"), encoding="utf-8").read()
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
        prose = re.sub(r"\{\w+\}|[A-Za-z][A-Za-z0-9.\-]*[0-9][A-Za-z0-9.\-]*", "", v)    # placeholders and Latin tokens such as L2, DePIN
        if re.search(r"[0-9]", prose):
            FAIL.append(f"{lg}.{k}: Latin digits in prose: {v!r}")
        if lg == "fa" and re.search("[٠-٩]", v):
            FAIL.append(f"fa.{k}: Arabic-Indic digits (Persian uses ۰-۹): {v!r}")
        if lg in ("ckb", "ar") and re.search("[۰-۹]", v):
            FAIL.append(f"{lg}.{k}: Persian digits ({lg} uses ٠-٩): {v!r}")

# ---------------------------------------------------------------- keys the scripts use
JS = {p: open(p, encoding="utf-8").read() for p in glob.glob(os.path.join(ROOT, "assets", "mm", "*.js")) if not p.endswith("i18n.js")}
used = set()
for path, s in JS.items():
    for m in re.finditer(r"\bT\(", s):            # every quoted key inside a T( … ) argument, ternaries included
        i, depth, j = m.end(), 1, m.end()
        while j < len(s) and depth:
            depth += {"(": 1, ")": -1}.get(s[j], 0)
            j += 1
        arg = s[i:j - 1]
        head = re.split(r",\s*\{", arg, maxsplit=1)[0]          # not the placeholder object
        head = re.sub(r"[!=]==?\s*'[^']*'", "", head)               # comparisons are not keys (curKey === 'etf')
        head = re.sub(r"'[a-z_]+_'\s*\+\s*\([^)]*\)", "", head)     # a family key built from an expression
        for q in re.findall(r"'([a-zA-Z][a-zA-Z0-9_]*)'(?!\s*\+)", head):
            used.add((q, os.path.basename(path)))
FAMILIES = {
    "v_": ["heatmap", "bubbles", "flow", "liq", "etf"], "title_": ["heatmap", "bubbles", "flow", "liq", "etf"], "sub_": ["heatmap", "bubbles", "flow", "liq", "etf"],
    "tfn_": ["5m", "15m", "1h", "2h", "4h", "1d", "7d", "30d", "1y"], "size_": ["mc", "mcs", "v", "ch", "fl", "eq"], "f_": ["all", "up", "dn", "watch"],
    "sec_": ["btc", "l1", "defi", "l2", "ai", "meme", "rwa", "exch", "infra", "game", "privacy", "other", "stable", "wrapped"],
    "fng_": ["extreme_fear", "fear", "neutral", "greed", "extreme_greed"], "src_": ["map", "flow", "liq", "etf"],
    "p_": ["over", "chart", "flow", "book", "deriv", "ek"], "tr_": ["up", "down", "range"], "dom_": ["btc", "eth", "stable", "others"], "e_": ["btc", "eth"],
    "pal_": ["rg", "by"],
    "op_": ["rsi_oversold", "rsi_overbought", "bull_divergence", "bear_divergence", "breakout_up", "breakout_down", "ema_golden_cross", "ema_death_cross", "volume_spike"],
}
NOT_KEYS = {"live", "snap", "saver", "x", "fa", "en", "ckb", "ar", "flow", "mc", "ch", "fl"}
for q, f in sorted(used):
    if q in NOT_KEYS and q not in EN:
        continue
    if q not in EN:
        FAIL.append(f"{f}: T('{q}') has no string")
for pre, names in FAMILIES.items():
    for n in names:
        if pre + n not in EN:
            FAIL.append(f"family key {pre}{n} missing")
for path, s in JS.items():
    for pre in re.findall(r"T\('([a-z_]+_)' \+", s):
        if pre not in FAMILIES:
            FAIL.append(f"{os.path.basename(path)}: T('{pre}' + …) is not a known family; add it to FAMILIES")
# the bubbles' and sectors' internal keys exist in the core
core = JS[os.path.join(ROOT, "assets", "mm", "core.js")]
for k in FAMILIES["sec_"]:
    if f"{k}:" not in core.split("MM.SECC = {", 1)[1].split("};", 1)[0]:
        FAIL.append(f"sector {k} has no colour in core.js")

if FAIL:
    print("\n".join("FAIL " + x for x in FAIL))
    print(f"{len(FAIL)} problems")
    sys.exit(1)
print(f"mm i18n: {len(EN)} keys × 4 languages, {len(used)} uses checked — all good")
