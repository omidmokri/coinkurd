#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""/swap/ — the rules that keep the swap page safe, pinned so a later edit cannot loosen them unnoticed.

Run: python3 tests/test_swap.py
"""
import base64
import copy
import hashlib
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


def ok(cond, msg):
    print(("  ok  " if cond else "FAIL  ") + msg)
    if not cond:
        FAILS.append(msg)


def bad(raw, why):
    try:
        B.check(raw)
    except B.ConfigError:
        ok(True, "refused: " + why)
    else:
        ok(False, "should be refused: " + why)


KEY = "0a1b2c3d-1111-4222-8333-444455556666"
WC = "0123456789abcdef0123456789abcdef"
ADDR = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"
GOOD = {"enabled": True, "apiKey": KEY, "walletConnectProjectId": WC,
        "affiliate": {"ref": "Ab12Cd", "percent": 0.5, "wallets": {"BSC": ADDR, "ETH": ADDR}}}


def scripts_of(doc):
    """every <script> that a browser would run (data blocks such as ld+json are not code)"""
    out = []
    for m in re.finditer(r"<script\b([^>]*)>", doc, re.I):
        t = re.search(r'type="([^"]*)"', m.group(1))
        if t and t.group(1) not in ("text/javascript", "module"):
            continue
        out.append(m.group(1))
    return out


def main():
    # ---- Keccak-256 / EIP-55
    ok(B.keccak256(b"").hex() == "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470", "keccak256('') is the known value")
    ok(B.keccak256(b"abc").hex() == "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45", "keccak256('abc') is the known value")
    for a in (ADDR, "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359", "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB", "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb"):
        ok(B.eip55(a.lower()) == a, "EIP-55 vector " + a[:10])

    # ---- the settings
    ok(B.check({"enabled": False, "apiKey": "", "walletConnectProjectId": "", "affiliate": {"ref": "", "percent": 0, "wallets": {}}}) == {"enabled": False}, "switched off: nothing but 'off' survives")
    c = B.check(copy.deepcopy(GOOD))
    ok(c["affiliate"] == {"ref": "Ab12Cd", "percent": 0.5, "wallets": {"BSC": ADDR, "ETH": ADDR}}, "a good config passes whole")
    for name, mut in [
        ("an unknown key (apiUrl)", lambda d: d.update(apiUrl="https://evil.example/")),
        ("a custom RPC", lambda d: d.update(signers={"customEthereumRPC": "https://evil.example/"})),
        ("enabled as a string", lambda d: d.update(enabled="true")),
        ("an empty api key", lambda d: d.update(apiKey="")),
        ("Rango's documentation key", lambda d: d.update(apiKey="c6381a79-2817-4602-83bf-6a641a409e32")),
        ("the documentation WalletConnect id", lambda d: d.update(walletConnectProjectId="e24844c5deb5193c1c14840a7af6a40b")),
        ("an api key with markup", lambda d: d.update(apiKey=KEY + '"><script>')),
        ("a fee above 3%", lambda d: d["affiliate"].update(percent=3.01)),
        ("a negative fee", lambda d: d["affiliate"].update(percent=-1)),
        ("a fee given as text", lambda d: d["affiliate"].update(percent="1")),
        ("a fee given as true", lambda d: d["affiliate"].update(percent=True)),
        ("a fee without a ref", lambda d: d["affiliate"].update(ref="")),
        ("a ref with odd characters", lambda d: d["affiliate"].update(ref="a b&c")),
        ("an address with one wrong character", lambda d: d["affiliate"]["wallets"].update(BSC=ADDR[:-1] + "c")),
        ("an all-lower-case address (no checksum to protect it)", lambda d: d["affiliate"]["wallets"].update(BSC=ADDR.lower())),
        ("a short address", lambda d: d["affiliate"]["wallets"].update(BSC=ADDR[:-2])),
        ("an EVM address for Solana", lambda d: d["affiliate"]["wallets"].update(SOLANA=ADDR)),
        ("a bad chain name", lambda d: d["affiliate"]["wallets"].update({"bsc": ADDR})),
        ("an extra key under affiliate", lambda d: d["affiliate"].update(to="x")),
    ]:
        d = copy.deepcopy(GOOD)
        mut(d)
        bad(d, name)
    bad([], "settings that are not an object")
    ok(B.check({**GOOD, "affiliate": {"ref": "Ab12Cd", "percent": 3, "wallets": {}}})["affiliate"]["percent"] == 3, "3% itself is allowed")

    # ---- the committed settings and page
    live = B.load()
    committed = open(B.OUT, encoding="utf-8").read()
    ok(committed == B.page(live), "swap/index.html is what scripts/build_swap.py builds from the committed settings")
    raw = json.load(open(B.CONFIG, encoding="utf-8"))
    blob = json.dumps(raw).lower()
    ok(not any(w in blob for w in ("private", "mnemonic", "seed", "secret", "password")), "the settings file holds no secret-looking field")

    for name, cfg in (("off", {"enabled": False}), ("on", B.check(copy.deepcopy(GOOD)))):
        doc = B.page(cfg)
        csp = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]*)">', doc)
        ok(bool(csp) and doc.index(csp.group(0)) < doc.index("<link") and doc.index(csp.group(0)) < doc.index("<script"), f"[{name}] the policy comes before anything is loaded")
        pol = dict((p.strip().split(" ", 1) + [""])[:2] for p in csp.group(1).split(";") if p.strip())
        ok(pol.get("default-src") == "'none'", f"[{name}] default-src 'none'")
        ok(pol.get("script-src") == "'self'" and pol.get("style-src") == "'self'", f"[{name}] scripts and styles from this site only, nothing inline")
        ok(pol.get("frame-src") == "https://widget.rango.exchange", f"[{name}] the only frame allowed is Rango's widget")
        ok(pol.get("connect-src") == "'none'" and pol.get("object-src") == "'none'" and pol.get("base-uri") == "'none'" and pol.get("form-action") == "'none'", f"[{name}] no connections, plug-ins, <base> or forms")
        ok("unsafe" not in csp.group(1) and "*" not in csp.group(1) and "data:" not in csp.group(1) and "blob:" not in csp.group(1), f"[{name}] no unsafe-*, wildcard, data: or blob: in the policy")
        sc = scripts_of(doc)
        ok(len(sc) == 1 and 'src="/assets/swap/swap.js"' in sc[0], f"[{name}] exactly one script: assets/swap/swap.js")
        for rel in ("assets/swap/swap.js", "assets/swap/swap.css"):
            h = "sha384-" + base64.b64encode(hashlib.sha384(open(os.path.join(ROOT, rel), "rb").read()).digest()).decode()
            ok(f'/{rel}" integrity="{h}"' in doc, f"[{name}] {rel} is pinned by its SHA-384")
        ok(not re.search(r"\son[a-z]+\s*=", doc) and "javascript:" not in doc.lower() and "<style" not in doc and " style=" not in doc, f"[{name}] no inline handler, javascript: link or inline style")
        hosts = set(re.findall(r'(?:src|href)="(https?://[^/"]+)', doc))
        ok(hosts <= {"https://entekhab.net", "https://rango.exchange"}, f"[{name}] no other host is referenced ({sorted(hosts)})")
        ok(not re.search(r'<(?:script|link|img|iframe)\b[^>]*(?:src|href)="https?://(?!entekhab\.net)', doc), f"[{name}] nothing is loaded from another host by the markup")
        ok("<iframe" not in doc, f"[{name}] the frame is not in the markup; the script adds it only after its checks")
        ok(re.search(r"<html[^>]*\sdata-noar", doc[:800]) is not None, f"[{name}] marked data-noar, so the translation layers add no script")
        ok('target="_blank"' not in doc or all("noopener noreferrer" in a for a in re.findall(r"<a\b[^>]*target=\"_blank\"[^>]*>", doc)), f"[{name}] outside links open with noopener noreferrer")
        ok('name="referrer" content="no-referrer"' in doc, f"[{name}] no referrer leaves the page")
        ok(("noindex" in doc) == (name == "off"), f"[{name}] kept out of search only while switched off")
        box = re.search(r'<div id="sw-box" data-c="([^"]*)">', doc)
        import html as H
        ok(json.loads(H.unescape(box.group(1))) == cfg, f"[{name}] the page carries exactly the checked settings")
    ok("0٫۵٪".replace("0", "۰") in B.page(B.check(copy.deepcopy(GOOD))), "the site's fee is printed on the page as it is (۰٫۵٪)")
    ok("کارمزدی نمی‌گیرد" in B.page(B.check({"enabled": True, "apiKey": KEY, "walletConnectProjectId": WC})), "switched on with no fee: the page says so")
    ok("کارمزد انتخاب" not in B.page({"enabled": False}) and "کارمزدی نمی‌گیرد" not in B.page({"enabled": False}), "switched off: no fee is promised either way")

    # ---- the deploy passes must leave the page as it is (no site script, no translation layer, no inline code)
    import i18n_ar, i18n_site, seo_tidy, seo_struct, chrome  # noqa: E401
    ok("swap" not in chrome.STATIC, "the site header/footer injection does not touch /swap/")
    for name, cfg in (("off", {"enabled": False}), ("on", B.check(copy.deepcopy(GOOD)))):
        tmp = tempfile.mkdtemp()
        try:
            p = os.path.join(tmp, "index.html")
            open(p, "w", encoding="utf-8").write(B.page(cfg))
            i18n_ar.inject(p)
            i18n_site.inject(p)
            doc = seo_tidy.tidy(open(p, encoding="utf-8").read())
            try:
                doc = seo_struct.enrich(doc, "/swap/", seo_struct.Site(ROOT))
            except Exception as ex:  # noqa: BLE001
                ok(False, f"[{name}] seo_struct failed: {ex}")
            sc = scripts_of(doc)
            ok(len(sc) == 1 and 'src="/assets/swap/swap.js"' in sc[0], f"[{name}] after the deploy passes there is still exactly one script")
            ok("<style" not in doc and "ek-tr" not in doc and "ek-ar" not in doc and "chrome.js" not in doc, f"[{name}] after the deploy passes: no inline style, no translation layer, no site script")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    # ---- the menu lists /swap/ only when it is switched on
    listed = any(i[0] == "/swap/" for c in chrome.NAV for i in c["items"])
    ok(listed == bool(live.get("enabled")), "the site menu lists /swap/ exactly when swaps are on")

    # ---- the script itself
    js = open(os.path.join(ROOT, "assets", "swap", "swap.js"), encoding="utf-8").read()
    code = re.sub(r"/\*.*?\*/", "", js, flags=re.S)
    code = re.sub(r"(?m)(^|\s)//.*$", "", code)          # not the // inside https://
    for word in ("eval(", "new Function", "innerHTML", "outerHTML", "document.write", "insertAdjacentHTML", "fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "importScripts", "postMessage", "addEventListener('message'", "cookie", "srcdoc", "apiUrl", "customEthereumRPC", "allow-top-navigation"):
        ok(word not in code, f"swap.js never uses {word}")
    ok(re.findall(r"https?://[^'\"\s)]+", code) == ["https://widget.rango.exchange/"], "the only address in swap.js is Rango's widget")
    ok("sandbox" in code and "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms" in code, "the frame is sandboxed, without top-navigation")
    ok(re.findall(r"localStorage\.(\w+)\('([^']+)'", code) == [("getItem", "ck_lang"), ("setItem", "ck_lang")], "the only thing kept in the browser is the chosen language")

    print("\n" + ("ALL PASS" if not FAILS else f"{len(FAILS)} FAILED"))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
