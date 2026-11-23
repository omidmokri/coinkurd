#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""/swap/ — the rules that keep the swap page safe, pinned so a later edit cannot loosen them unnoticed.

Run: python3 tests/test_swap.py
"""
import base64
import copy
import hashlib
import html as H
import json
import os
import re
import shutil
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import build_swap as B  # noqa: E402

FAILS = []
LIFI = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE"


def ok(cond, msg):
    print(("  ok  " if cond else "FAIL  ") + msg)
    if not cond:
        FAILS.append(msg)


def bad(fn, why):
    try:
        fn()
    except B.ConfigError:
        ok(True, "refused: " + why)
    except Exception as ex:  # noqa: BLE001
        ok(False, f"refused the wrong way ({ex.__class__.__name__}): {why}")
    else:
        ok(False, "should be refused: " + why)


GOOD = {"enabled": True, "integrator": "entekhab", "fee": 0.005, "slippage": 0.005}


def scripts_of(doc):
    """every <script> a browser would run (a data block such as ld+json is not code)"""
    out = []
    for m in re.finditer(r"<script\b([^>]*)>", doc, re.I):
        t = re.search(r'type="([^"]*)"', m.group(1))
        if t and t.group(1) not in ("text/javascript", "module"):
            continue
        out.append(m.group(1))
    return out


def main():
    # ---------------------------------------------------------------- the address checksum
    ok(B.keccak256(b"").hex() == "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470", "keccak256('') is the known value")
    ok(B.keccak256(b"abc").hex() == "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45", "keccak256('abc') is the known value")
    for a in (LIFI, "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
              "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB", "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb"):
        ok(B.eip55(a.lower()) == a, "EIP-55 vector " + a[:10])

    # ---------------------------------------------------------------- the settings
    ok(B.check({"enabled": False}) == {"enabled": False}, "switched off: nothing but 'off' survives")
    ok(B.check({"enabled": False, "integrator": "x", "fee": 0.02})["enabled"] is False, "switched off, the fee is not carried over")
    c = B.check(copy.deepcopy(GOOD))
    ok(c == {"enabled": True, "integrator": "entekhab", "fee": 0.005, "slippage": 0.005}, "a good config passes whole")
    for why, mut in [
        ("an unknown setting (apiUrl)", lambda d: d.update(apiUrl="https://evil.example/")),
        ("an API key (it would be public in the page)", lambda d: d.update(apiKey="x")),
        ("enabled as a string", lambda d: d.update(enabled="true")),
        ("a fee above 3%", lambda d: d.update(fee=0.031)),
        ("a negative fee", lambda d: d.update(fee=-0.01)),
        ("a fee given as text", lambda d: d.update(fee="0.005")),
        ("a fee given as true", lambda d: d.update(fee=True)),
        ("a fee with no integrator registered", lambda d: d.update(integrator="")),
        ("an integrator name with a space", lambda d: d.update(integrator="coin kurd")),
        ("an integrator name with markup", lambda d: d.update(integrator='x"><script>')),
        ("slippage of zero", lambda d: d.update(slippage=0)),
        ("slippage above 5%", lambda d: d.update(slippage=0.06)),
    ]:
        d = copy.deepcopy(GOOD)
        mut(d)
        bad(lambda dd=d: B.check(dd), why)
    bad(lambda: B.check([]), "settings that are not an object")
    ok(B.check({"enabled": True, "integrator": "", "fee": 0, "slippage": 0.005})["fee"] == 0, "no integrator and no fee is allowed (swaps work, the site earns nothing)")
    ok(B.check({**GOOD, "fee": 0.03})["fee"] == 0.03, "3% itself is allowed")

    # ---------------------------------------------------------------- the chains and tokens
    data = B.chains()
    ok(len(data["chains"]) >= 1 and all(str(x["id"]) in data["tokens"] for x in data["chains"]), "every chain has a token list")
    ok(all(x["contract"] == B.eip55(x["contract"]) for x in data["chains"]), "every chain pins a checksummed contract address")
    ok({c["id"]: c["contract"] for c in data["chains"]}.get(56) == LIFI and {c["id"]: c["contract"] for c in data["chains"]}.get(1) == LIFI,
       "BNB Smart Chain and Ethereum pin LI.FI's main contract")
    ok(len({c["id"] for c in data["chains"]}) == len(data["chains"]), "no chain is listed twice")
    ok(len(data["chains"]) >= 30, f"the page offers plenty of networks ({len(data['chains'])})")
    ok(all(c["rpc"].startswith("https://") and c["explorer"].startswith("https://") for c in data["chains"]),
       "every chain's node and explorer are https")
    n = sum(len(v) for v in data["tokens"].values())
    ok(n >= 150, f"the short list has enough tokens ({n})")
    ok(all(len({t["symbol"].lower() for t in v}) == len(v) for v in data["tokens"].values()), "no symbol appears twice on one chain")
    ok(all(len({t["address"].lower() for t in v}) == len(v) for v in data["tokens"].values()), "no address appears twice on one chain")
    ok(all(t["address"] == B.eip55(t["address"]) for v in data["tokens"].values() for t in v if t["address"] != B.ZERO),
       "every token address carries a correct EIP-55 checksum")
    ok(not any("logo" in t for v in data["tokens"].values() for t in v), "no token picture is kept, so no other host is ever asked for one")

    def with_chains(mut):
        raw = json.load(open(B.CHAINS, encoding="utf-8"))
        mut(raw)
        tmp = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
        json.dump(raw, tmp)
        tmp.close()
        try:
            return B.chains(tmp.name)
        finally:
            os.unlink(tmp.name)

    for why, mut in [
        ("a token address with one wrong character", lambda r: r["tokens"]["56"][1].update(
            address=r["tokens"]["56"][1]["address"][:-1] + ("d" if r["tokens"]["56"][1]["address"][-1] != "d" else "e"))),
        ("a lower-case address (nothing would catch a typo)", lambda r: r["tokens"]["56"][1].update(address=r["tokens"]["56"][1]["address"].lower())),
        ("a token listed twice", lambda r: r["tokens"]["56"].append(dict(r["tokens"]["56"][1]))),
        ("a token with impossible decimals", lambda r: r["tokens"]["56"][1].update(decimals=99)),
        ("a token with no symbol", lambda r: r["tokens"]["56"][1].update(symbol="")),
        ("a chain with no pinned contract", lambda r: r["chains"][0].pop("contract")),
        ("a pinned contract that is not checksummed", lambda r: r["chains"][0].update(contract=LIFI.lower())),
        ("an explorer served over plain http", lambda r: r["chains"][0].update(explorer="http://bscscan.com/")),
        ("a node address served over plain http", lambda r: r["chains"][0].update(rpc="http://evil.example/")),
        ("the same chain id twice", lambda r: r["chains"].append(dict(r["chains"][0]))),
        ("tokens for a chain that is not listed", lambda r: r["tokens"].update({"123456789": r["tokens"]["56"]})),
        ("a chain with no tokens at all", lambda r: r["tokens"].update({"56": []})),
    ]:
        bad(lambda m=mut: with_chains(m), why)

    # ---------------------------------------------------------------- the committed page
    live = B.load()
    committed = open(B.OUT, encoding="utf-8").read()
    ok(committed == B.page(live, data), "swap/index.html is exactly what the builder makes from the committed settings")
    raw_cfg = json.load(open(B.CONFIG, encoding="utf-8"))
    blob = json.dumps(raw_cfg).lower()
    ok(not any(w in blob for w in ("private", "mnemonic", "seed", "secret", "password", "apikey")), "the settings file holds no secret-looking field")

    for name, cfg in (("off", {"enabled": False}), ("on", B.check(copy.deepcopy(GOOD)))):
        doc = B.page(cfg, data)
        csp = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]*)">', doc)
        ok(bool(csp) and doc.index(csp.group(0)) < doc.index("<link") and doc.index(csp.group(0)) < doc.index("<script"),
           f"[{name}] the policy comes before anything is loaded")
        pol = dict((p.strip().split(" ", 1) + [""])[:2] for p in csp.group(1).split(";") if p.strip())
        ok(pol.get("default-src") == "'none'", f"[{name}] default-src 'none'")
        ok(pol.get("script-src") == "'self'" and pol.get("style-src") == "'self'", f"[{name}] scripts and styles from this site only, nothing inline")
        ok(pol.get("connect-src") == "https://li.quest", f"[{name}] the one connection allowed is the price service")
        ok(pol.get("img-src") == "'self'", f"[{name}] pictures come from this site only (no token logos from elsewhere)")
        ok(pol.get("frame-src") == "'none'", f"[{name}] no frames at all")
        ok(pol.get("object-src") == "'none'" and pol.get("base-uri") == "'none'" and pol.get("form-action") == "'none'",
           f"[{name}] no plug-ins, no <base>, no form may be submitted")
        ok(pol.get("require-trusted-types-for") == "'script'", f"[{name}] Trusted Types: building markup from text would throw")
        ok("unsafe" not in csp.group(1) and "*" not in csp.group(1) and "data:" not in csp.group(1) and "blob:" not in csp.group(1),
           f"[{name}] no unsafe-*, wildcard, data: or blob: anywhere in the policy")

        sc = scripts_of(doc)
        ok(len(sc) == 1 and 'src="/assets/swap/swap.js"' in sc[0], f"[{name}] exactly one script: assets/swap/swap.js")
        for rel in ("assets/swap/swap.js", "assets/swap/swap.css"):
            h = "sha384-" + base64.b64encode(hashlib.sha384(open(os.path.join(ROOT, rel), "rb").read()).digest()).decode()
            ok(f'/{rel}" integrity="{h}"' in doc, f"[{name}] {rel} is pinned by its SHA-384")
        ok(not re.search(r"\son[a-z]+\s*=", doc) and "javascript:" not in doc.lower() and "<style" not in doc and " style=" not in doc,
           f"[{name}] no inline handler, javascript: link or inline style")
        hosts = set(re.findall(r'(?:src|href)="(https?://[^/"]+)', doc))
        ok(hosts <= {"https://entekhab.net", "https://li.fi"}, f"[{name}] no other host is referenced ({sorted(hosts)})")
        ok("<iframe" not in doc, f"[{name}] no frame is embedded")
        ok(re.search(r"<html[^>]*\sdata-noar", doc[:800]) is not None, f"[{name}] marked data-noar, so the translation layers add no script")
        ok(all("noopener noreferrer" in a for a in re.findall(r"<a\b[^>]*target=\"_blank\"[^>]*>", doc)), f"[{name}] outside links open with noopener noreferrer")
        ok('name="referrer" content="no-referrer"' in doc, f"[{name}] no referrer leaves the page")
        ok(("noindex" in doc) == (name == "off"), f"[{name}] kept out of search only while switched off")

        box = re.search(r'<div id="sw-app" class="sw-app" data-c="([^"]*)" data-d="([^"]*)">', doc)
        ok(bool(box), f"[{name}] the tool's box carries its settings and its data")
        ok(json.loads(H.unescape(box.group(1))) == cfg, f"[{name}] the page carries exactly the checked settings")
        ok(json.loads(H.unescape(box.group(2))) == data, f"[{name}] …and exactly the checked chains and tokens")
        for el in ("sw-from-chain", "sw-to-chain", "sw-from-token", "sw-to-token", "sw-amount", "sw-action",
                   "sw-quote", "sw-receive", "sw-min", "sw-route", "sw-gas", "sw-fee", "sw-time", "sw-status",
                   "sw-msg", "sw-balance", "sw-max", "sw-flip", "sw-slip", "sw-account", "sw-tokenwarn",
                   "sw-from-custom", "sw-to-custom"):
            ok(f'id="{el}"' in doc, f"[{name}] the page has {el}")
        warn = doc[doc.index("sw-warn"):]
        ok("عبارت بازیابی" in warn and "recovery phrase" in warn, f"[{name}] the warning never to type a recovery phrase is on the page")

    on_doc = B.page(B.check(copy.deepcopy(GOOD)), data)
    ok("۰٫۵٪" in on_doc, "the site's fee is printed on the page as it is (۰٫۵٪)")
    ok("کارمزدی نمی‌گیرد" in B.page(B.check({"enabled": True, "integrator": "", "fee": 0, "slippage": 0.005}), data),
       "switched on with no fee: the page says so")
    off_doc = B.page({"enabled": False}, data)
    ok("کارمزد انتخاب" not in off_doc and "کارمزدی نمی‌گیرد" not in off_doc, "switched off: no fee is promised either way")

    # ---------------------------------------------------------------- the deploy passes must leave it alone
    import i18n_ar, i18n_site, seo_tidy, seo_struct, chrome  # noqa: E401
    ok("swap" not in chrome.STATIC, "the site header/footer injection does not touch /swap/")
    for name, cfg in (("off", {"enabled": False}), ("on", B.check(copy.deepcopy(GOOD)))):
        tmp = tempfile.mkdtemp()
        try:
            p = os.path.join(tmp, "index.html")
            open(p, "w", encoding="utf-8").write(B.page(cfg, data))
            i18n_ar.inject(p)
            i18n_site.inject(p)
            doc = seo_tidy.tidy(open(p, encoding="utf-8").read())
            try:
                doc = seo_struct.enrich(doc, "/swap/", seo_struct.Site(ROOT))
            except Exception as ex:  # noqa: BLE001
                ok(False, f"[{name}] seo_struct failed: {ex}")
            sc = scripts_of(doc)
            ok(len(sc) == 1 and 'src="/assets/swap/swap.js"' in sc[0], f"[{name}] after the deploy passes there is still exactly one script")
            ok("<style" not in doc and "ek-tr" not in doc and "ek-ar" not in doc and "chrome.js" not in doc,
               f"[{name}] after the deploy passes: no inline style, no translation layer, no site script")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    # ---------------------------------------------------------------- the menu
    listed = any(i[0] == "/swap/" for c in chrome.NAV for i in c["items"])
    ok(listed == bool(live.get("enabled")), "the site menu lists /swap/ exactly when swaps are on")

    # ---------------------------------------------------------------- the stylesheet
    css = open(os.path.join(ROOT, "assets", "swap", "swap.css"), encoding="utf-8").read()
    ok(not re.findall(r"url\(['\"]?https?://", css), "the stylesheet loads nothing from another host")
    ok("@import" not in css, "the stylesheet imports nothing")

    print("\n" + ("ALL PASS" if not FAILS else f"{len(FAILS)} FAILED"))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
