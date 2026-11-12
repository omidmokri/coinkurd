#!/usr/bin/env python3
"""/market/ strings: every key the code asks for exists in all four languages (ckb, fa, ar, en), none is empty,
and each translation keeps exactly the {placeholders} of the English string. Run: python3 tests/test_pro_i18n.py"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRO = os.path.join(ROOT, "assets", "pro")
LANGS = ("ckb", "fa", "ar", "en")


def strings():
    code = ("global.window=globalThis;require(process.argv[1]);require(process.argv[2]);require(process.argv[3]);"
            "process.stdout.write(JSON.stringify({S:PRO.STR,DEF:Object.keys(PRO.ind.DEF),P:[...new Set(Object.values(PRO.ind.DEF).flatMap(d=>Object.keys(d.p)))]}))")
    js = "global.document={addEventListener(){}};global.navigator={};"
    p = subprocess.run(["node", "-e", js + code, os.path.join(PRO, "i18n.js"), os.path.join(PRO, "ind.js"), os.path.join(PRO, "draw.js")],
                       capture_output=True, text=True, check=True)
    return json.loads(p.stdout)


def used_keys(defs, params):
    src = "".join(open(os.path.join(PRO, f), encoding="utf-8").read() for f in ("app.js", "panels.js", "replay.js", "draw.js"))
    keys = set()
    keys |= {k for k in re.findall(r"\bT\('([A-Za-z][A-Za-z0-9_]*)'", src) if not k.endswith('_')}            # T('key' …
    for m in re.finditer(r"\bT\(([^()]*(?:\([^()]*\)[^()]*)*)\)", src):         # T(cond ? 'a' : 'b')
        arg = m.group(1)
        if re.match(r"\s*'[A-Za-z]+_'\s*\+", arg):                                # a family prefix: listed below
            continue
        for lit in re.findall(r"'([A-Za-z][A-Za-z0-9_]*)'", arg):
            if not lit.endswith("_"):
                keys.add(lit)
    keys |= set(re.findall(r"data-t=\"([A-Za-z]+)\"", src))
    tools = set(re.findall(r"^\s+(\w+): \{ n: -?\d \}", open(os.path.join(PRO, "draw.js"), encoding="utf-8").read(), re.M))
    tools |= set(re.findall(r"(\w+): \{ n: -?\d \}", open(os.path.join(PRO, "draw.js"), encoding="utf-8").read()))
    fam = {
        "st_": "live poll snap err load rep", "u_": "s m h d w mo", "tfg_": "s m h d",
        "ty_": "candle hollow heikin bars line linemk step area baseline columns", "sync_": "sym tf cross time",
        "cat_": "all watch gold over pane ek", "ly_": "posts sigs live", "tpl_": "trend mom vola ichi scalp ek",
        "flag_": "r o y g b p", "c_": "cross up down gt lt", "ai_": "rsi ma macd bb", "imp_": "H M L X",
        "ac_": "rsi_up rsi_down rsi_gt rsi_lt ma_up ma_down macd_up macd_down bb_gt bb_lt",
    }
    for pre, rest in fam.items():
        keys |= {pre + x for x in rest.split()}
    keys |= {"in_" + d for d in defs} | {"ind_" + d for d in defs + ["posts", "sigs", "live"]} | {"p_" + p for p in params}
    keys |= {"t_" + t for t in tools} | {"t_cursor"}
    keys |= {"watchlist", "alerts", "ecoCal", "objects"}
    return keys


def main():
    data = strings()
    S, fails = data["S"], 0
    keys = used_keys(data["DEF"], data["P"])
    ph = lambda s: sorted(re.findall(r"\{(\w+)\}", s))  # noqa: E731
    for k in sorted(keys):
        for lg in LANGS:
            v = S.get(lg, {}).get(k)
            if v is None or not str(v).strip():
                print(f"MISSING {lg}.{k}")
                fails += 1
            elif ph(v) != ph(S["en"].get(k, "")):
                print(f"PLACEHOLDERS {lg}.{k}: {ph(v)} vs en {ph(S['en'].get(k, ''))}")
                fails += 1
    for lg in LANGS:
        extra = set(S[lg]) - set(S["en"])
        for k in sorted(extra):
            print(f"EXTRA {lg}.{k} (not in English: a typo?)")
            fails += 1
    unused = set(S["en"]) - keys
    print(f"{len(keys)} keys used × {len(LANGS)} languages checked; {len(unused)} defined but not referenced statically: {sorted(unused)[:12]}")
    print("OK" if not fails else f"{fails} problems")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
