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


GIFT = "0xe9D4C279e2c6BBf170Cbe5d54719Aa6A4A0253d0"
GOOD = {"enabled": True, "integrator": "entekhab", "fee": 0.005, "slippage": 0.005, "donate": GIFT}


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
    ok(c == {"enabled": True, "integrator": "entekhab", "fee": 0.005, "slippage": 0.005, "donate": GIFT}, "a good config passes whole")
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
    evm = [c for c in data["chains"] if not c.get("kind")]
    only_to = [c for c in data["chains"] if c.get("to_only")]
    far = [c for c in data["chains"] if c.get("kind") and not c.get("to_only")]
    ok({c["coin"] for c in far} == {"TRX", "SOL", "BTC"}, "Tron, Solana and Bitcoin are the networks off EVM a swap may start on")
    ok(all("rpc" not in c for c in far), "…and neither brings a node of its own into the page")
    rank = B.market_rank()
    ok(rank.get("BTC") == 1 and rank.get("USDT", 99) <= 10 and len(rank) > 200, "the ranking knows the largest coins, and is not a short list")
    coins = {str(c["id"]): c["coin"] for c in data["chains"]}
    ok(all(ts[0]["symbol"].upper() == coins[cid].upper()
           for cid, ts in data["tokens"].items()
           if any(t["symbol"].upper() == coins[cid].upper() for t in ts)),
       "a list that holds the network's own coin opens with it, the one its fees are paid in")
    def ordered(ts):
        got = [rank.get(t["symbol"].upper(), B.BIG) for t in ts[1:]]
        return all(got[i] <= got[i + 1] for i in range(len(got) - 1))
    ok(all(ordered(ts) for ts in data["tokens"].values()), "…and everything after it reads biggest first, by market capitalisation")
    ok([t["symbol"] for t in data["tokens"]["56"]][:4] == ["BNB", "USDT", "USDC", "XRP"], "on BNB Smart Chain that reads BNB, USDT, USDC, XRP")

    ok(next(c for c in far if c["coin"] == "TRX").get("contract") == "TU3ymitEKCWQFtASkEeHaPb8NfZcJtCHLt",
       "Tron pins LI.FI's own contract there, in Tron's address form")
    ok(all("contract" not in c for c in far if c["coin"] in ("SOL", "BTC")), "Solana and Bitcoin pin none, because they have none")
    ok(next(c for c in far if c["coin"] == "BTC")["kind"] == "utxo", "Bitcoin is read as Bitcoin's own kind of address")
    ok(all(x["contract"] == B.eip55(x["contract"]) for x in evm), "every network a swap can start on pins a checksummed contract address")
    ok(len(only_to) >= 3 and all("contract" not in c and "rpc" not in c and c["kind"] in B.ADDRESS for c in only_to),
       f"the {len(only_to)} networks a swap can only end on carry no contract and no node, and each has an address shape")
    ok({c["coin"] for c in only_to} >= {"ZEC", "SUI"}, "Zcash and Sui are among them")
    for c in only_to + far:
        toks = data["tokens"][str(c["id"])]
        ok(toks[0]["symbol"] == c["coin"], f"{c['name']}'s own coin comes first in its list")
        ok(not any(re.search(r"[\s\u200b\u00a0]", t["symbol"]) for t in toks),
           f"{c['name']} has no coin whose name hides a space — that is how the fake USDTs are written")
    tron = data["tokens"][str(next(c["id"] for c in far if c["coin"] == "TRX"))]
    ok(any(t["symbol"] == "USDT" and t["address"] == "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" for t in tron),
       "Tron's USDT is the real contract, not a look-alike")
    ok({c["id"]: c["contract"] for c in evm}.get(56) == LIFI and {c["id"]: c["contract"] for c in evm}.get(1) == LIFI,
       "BNB Smart Chain and Ethereum pin LI.FI's main contract")
    ok(len({c["id"] for c in data["chains"]}) == len(data["chains"]), "no chain is listed twice")
    ok(len(data["chains"]) >= 30, f"the page offers plenty of networks ({len(data['chains'])})")
    ok(all(c["rpc"].startswith("https://") for c in evm) and all(c["explorer"].startswith("https://") for c in data["chains"]),
       "every chain's node and explorer are https")
    n = sum(len(v) for v in data["tokens"].values())
    ok(n >= 150, f"the short list has enough tokens ({n})")
    ok(all(len({t["symbol"].lower() for t in v}) == len(v) for v in data["tokens"].values()), "no symbol appears twice on one chain")
    ok(all(len({t["address"].lower() for t in v}) == len(v) for v in data["tokens"].values()), "no address appears twice on one chain")
    evm_ids = {str(c["id"]) for c in evm}
    ok(all(t["address"] == B.eip55(t["address"]) for cid, v in data["tokens"].items() if cid in evm_ids
           for t in v if t["address"] != B.ZERO),
       "every token address on an EVM network carries a correct EIP-55 checksum")
    ok(not any("logo" in t for v in data["tokens"].values() for t in v), "no token picture is kept, so no other host is ever asked for one")
    # One contract address deployed to several networks is the same token, so its places should not differ. Where the
    # source disagrees with itself the token is left out rather than offered: a gift of it would be wrong by powers
    # of ten, and the swap would simply refuse to work.
    places = {}
    for cid, v in data["tokens"].items():
        for t in v:
            places.setdefault(t["address"].lower(), set()).add((t["symbol"], t["decimals"]))
    muddled = {a: sorted(v) for a, v in places.items() if len({d for _, d in v}) > 1}
    ok(not muddled, f"no contract is listed with different places on different networks: {muddled}")

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
    ok(committed == B.page(live, data), "swap/index.html is exactly what the builder makes (rebuild it after the menu or a script version changes)")
    raw_cfg = json.load(open(B.CONFIG, encoding="utf-8"))
    blob = json.dumps(raw_cfg).lower()
    ok(not any(w in blob for w in ("private", "mnemonic", "seed", "secret", "password", "apikey")), "the settings file holds no secret-looking field")

    def loaders(doc):
        """(tag, address) of everything the markup makes the browser fetch"""
        out = []
        for m in re.finditer(r"<(script|link|img|iframe|source|video|audio|embed|object)\b([^>]*)>", doc, re.I):
            tag, attrs = m.group(1).lower(), m.group(2)
            if tag == "link" and not re.search(r'rel="(?:stylesheet|preload|icon|apple-touch-icon|manifest|modulepreload)"', attrs):
                continue                      # canonical, alternate … are names, not downloads
            u = re.search(r'(?:src|href|data)="([^"]*)"', attrs)
            if u:
                out.append((tag, u.group(1)))
        return out

    icons = B.with_icons(data)
    for name, cfg in (("off", {"enabled": False}), ("on", B.check(copy.deepcopy(GOOD)))):
        doc = B.page(cfg, data)
        csp = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]*)">', doc)
        ok(bool(csp) and doc.index(csp.group(0)) < doc.index("<link") and doc.index(csp.group(0)) < doc.index("<script"),
           f"[{name}] the policy comes before anything is loaded")
        pol = dict((p.strip().split(" ", 1) + [""])[:2] for p in csp.group(1).split(";") if p.strip())
        ok(pol.get("default-src") == "'none'", f"[{name}] default-src 'none'")
        ok(pol.get("script-src") == "'self' 'inline-speculation-rules'", f"[{name}] scripts: this site's files only — no inline script, no other host")
        want_hosts = [B.SERVICE] + ((B.far_hosts(data) + (B.rpc_hosts(data) if cfg.get("donate") else [])) if cfg.get("enabled") else [])
        ok(pol.get("connect-src") == "'self' " + " ".join(want_hosts),
           f"[{name}] connections: this site, the price service and (when a gift panel is on) those networks' own nodes, nothing else")
        ok(pol.get("img-src") == "'self' data:", f"[{name}] pictures come from this site only (no token logos from elsewhere)")
        ok(pol.get("frame-src") == "'none'", f"[{name}] no frames at all")
        ok(pol.get("object-src") == "'none'" and pol.get("base-uri") == "'none'" and pol.get("form-action") == "'none'",
           f"[{name}] no plug-ins, no <base>, no form may be submitted")
        ok(not re.search(r"script-src[^;]*unsafe", csp.group(1)) and "*" not in csp.group(1) and "blob:" not in csp.group(1)
           and "http:" not in csp.group(1) and "wss:" not in csp.group(1),
           f"[{name}] no unsafe script, wildcard, blob:, plain http or socket host in the policy")
        hosts_in_policy = set(re.findall(r"https://[^\s;]+", csp.group(1)))
        ok(hosts_in_policy == set(want_hosts), f"[{name}] the policy names no host beyond those: {sorted(hosts_in_policy)}")

        sc = scripts_of(doc)
        srcs = [re.search(r'src="([^"?]*)', x).group(1) if 'src="' in x else None for x in sc]
        ok(all(x is not None for x in srcs), f"[{name}] no inline script anywhere in the page")
        ok(set(srcs) <= B.MAY_RUN and srcs[0] == "/assets/swap/swap.js",
           f"[{name}] only the swap engine and the site's own interface scripts run, the engine first ({srcs})")
        for rel in ("assets/swap/swap.js", "assets/swap/swap.css"):
            h = "sha384-" + base64.b64encode(hashlib.sha384(open(os.path.join(ROOT, rel), "rb").read()).digest()).decode()
            ok(f'/{rel}{B.ver(rel)}" integrity="{h}"' in doc, f"[{name}] {rel} is pinned by its SHA-384")
            ok(B.ver(rel)[3:] in h.replace("+", "").replace("/", "").replace("=", ""),
               f"[{name}] …and its address carries that same hash, so no browser keeps an older copy of it")
        ok(not re.search(r"<[^>]+\son[a-z]+\s*=", doc) and "javascript:" not in doc.lower(), f"[{name}] no inline event handler and no javascript: link")
        outside = [(t, u) for t, u in loaders(doc) if re.match(r"(?:https?:)?//", u)]
        ok(not outside, f"[{name}] the markup loads nothing from another host ({outside[:3]})")
        ok("<iframe" not in doc, f"[{name}] no frame is embedded")
        ok(not re.search(r"<html[^>]*\sdata-noar", doc[:800]), f"[{name}] the page is open to the site's translation layers, like any other page")
        ok('id="ekh"' in doc and 'id="ekb"' in doc and 'id="ekf"' in doc and 'href="/swap/"' in doc,
           f"[{name}] the site's header, tab bar and footer are on the page")
        ok(doc.count('id="ek-main"') == 1, f"[{name}] the header's skip target appears once (a second one collapsed the page)")
        ok(all("noopener" in a for a in re.findall(r"<a\b[^>]*target=\"_blank\"[^>]*>", doc[doc.index('id="sw-main"'):doc.index('id="ekb"')])),
           f"[{name}] outside links in the page body open with noopener")
        ok('name="referrer" content="no-referrer"' in doc, f"[{name}] no referrer leaves the page")
        ok(("noindex" in doc) == (name == "off"), f"[{name}] kept out of search only while switched off")

        box = re.search(r'<section id="sw-app" class="sw-card" data-s="" data-c="([^"]*)" data-d="([^"]*)">', doc)
        ok(bool(box), f"[{name}] the tool's box carries its settings and its data")
        ok(json.loads(H.unescape(box.group(1))) == cfg, f"[{name}] the page carries exactly the checked settings")
        want = dict(icons, watch=B.watch_list(icons) if cfg.get("donate") else [])
        want["addr"] = {k: B.ADDRESS[k] for k in sorted({c["kind"] for c in data["chains"] if c.get("kind")})}
        ok(json.loads(H.unescape(box.group(2))) == want, f"[{name}] …and exactly the checked chains and tokens, with their pictures")
        for el in ("fc", "fc-i", "fc-n", "ft", "ft-i", "ft-n", "tc", "tc-i", "tc-n", "tt", "tt-i", "tt-n", "amount", "max", "balance",
                   "from-usd", "to-usd", "flip", "receive", "quote", "rate", "min", "route", "gas", "fee", "time", "impact", "slip",
                   "tokenwarn", "ackbox", "ack", "account", "action", "action-l", "action-x", "msg", "status", "dlg", "dlg-title",
                   "dlg-q", "dlg-list", "dlg-find", "dlg-close"):
            ok(doc.count(f'id="sw-{el}"') == 1, f"[{name}] the page has sw-{el}, once")
        # every figure, address and name the engine fills in is out of the translation layers' reach
        for el in ("amount", "receive", "balance", "from-usd", "to-usd", "rate", "min", "route", "gas", "fee", "time", "impact",
                   "account", "action-x", "fc-n", "ft-n", "tc-n", "tt-n", "dlg-q"):
            tag = re.search(rf'<[a-z]+\b[^>]*id="sw-{el}"[^>]*>', doc).group(0)
            ok('translate="no"' in tag, f"[{name}] sw-{el} is marked translate=\"no\": a label may be re-worded, a figure never")
        body = doc[doc.index('id="sw-main"'):doc.index('id="ekb"')]
        ok(body.count('data-lang="fa"') == body.count('data-lang="ckb"') == body.count('data-lang="en"') > 30,
           f"[{name}] every piece of text is there in Persian, Sorani and English")
        ok("عبارت بازیابی" in body and "recovery phrase" in body, f"[{name}] the warning never to type a recovery phrase is on the page")

    on_doc = B.page(B.check(copy.deepcopy(GOOD)), data)
    ok("۰٫۰۰۵" in on_doc and "۰٫۵٪" not in on_doc,
       "the site's fee is printed as the fraction it is (۰٫۰۰۵ of each swap), not as a percentage")
    ok("زاگرس" in on_doc and "Zagros" in on_doc, "…and what the fee is spent on is said in every language")

    # ---------------------------------------------------------------- the gift panel
    ok(f'data-a="{GIFT}"' in on_doc and on_doc.count(GIFT) >= 2,
       "the address a gift goes to is written into the page itself")
    for el in ("dnc", "dnc-n", "dnt", "dnt-n", "dn-amount", "dn-bal", "dn-go", "dn-go-l", "dn-go-x", "dn-msg",
               "dn-status", "dn-addr", "dn-copy", "dn-total"):
        ok(on_doc.count(f'id="sw-{el}"') == 1, f"the gift panel has sw-{el}, once")
    for el in ("dnc-n", "dnt-n", "dn-amount", "dn-bal", "dn-go-x", "dn-addr", "dn-total"):
        tag = re.search(rf'<[a-z]+\b[^>]*id="sw-{el}"[^>]*>', on_doc).group(0)
        ok('translate="no"' in tag, f'sw-{el} is marked translate="no": an address or a figure is never re-worded')
    watch = B.watch_list(B.with_icons(data))
    ok(len(watch) >= 4 and all(w["token"] and w["decimals"] in (6, 18) for w in watch),
       f"the wallet is read on {len(watch)} networks, each with its own USDT contract")
    for w in watch:
        ok(f'id="sw-dn-b{w["id"]}"' in on_doc, f"network {w['id']} has its own line in the panel")
        ok(f'{w["explorer"].rstrip("/")}/token/{w["token"]}?a={GIFT}' in on_doc,
           f"…and a link to {w['id']}'s own explorer, where anyone can check the figure")
    pol_on = dict((p.strip().split(" ", 1) + [""])[:2] for p in
                  re.search(r'Content-Security-Policy" content="([^"]+)"', on_doc).group(1).split(";") if p.strip())
    ok(pol_on["connect-src"] == "'self' " + " ".join([B.SERVICE] + B.far_hosts(data) + B.rpc_hosts(data)),
       "the policy opens for the price service and those networks' nodes, and nothing else")
    ok(all(h.startswith("https://") for h in B.rpc_hosts(data)), "every node is reached over https")

    no_gift = B.page(B.check({"enabled": True, "integrator": "entekhab", "fee": 0.005, "slippage": 0.005}), data)
    ok("sw-gift" not in no_gift and GIFT not in no_gift, "no address in the settings: no gift panel and no address anywhere")
    ok('connect-src \'self\' https://li.quest https://api.trongrid.io;' in no_gift, "…and the policy opens only for the price service and Tron's public node")
    ok(B.far_hosts(data) == ["https://api.trongrid.io"], "Tron's node is the one host a swap that starts off EVM adds")
    flipped = "0x" + "".join(ch.lower() if ch.isupper() else ch.upper() if ch.islower() else ch for ch in GIFT[2:])
    for wrong in ("0xe9d4c279e2c6bbf170cbe5d54719aa6a4a0253d0", "0x1234", "nope", flipped, GIFT + "0"):
        try:
            B.check(dict(GOOD, donate=wrong))
            ok(False, f"a donate address that is not checksummed is refused ({wrong[:12]})")
        except B.ConfigError:
            ok(True, f"a donate address that is not checksummed is refused ({wrong[:12]})")

    ok("کارمزدی نمی‌گیرد" in B.page(B.check({"enabled": True, "integrator": "", "fee": 0, "slippage": 0.005}), data),
       "switched on with no fee: the page says so")
    off_doc = B.page({"enabled": False}, data)
    ok("کارمزد انتخاب" not in off_doc and "کارمزدی نمی‌گیرد" not in off_doc, "switched off: no fee is promised either way")

    # ---------------------------------------------------------------- the pictures
    ICON = re.compile(r"^[ct]/[a-z0-9-]{1,32}\.(?:svg|webp)$")
    used = {c["ic"] for c in icons["chains"] if "ic" in c} | {t["ic"] for v in icons["tokens"].values() for t in v if "ic" in t}
    ok(all(ICON.match(u) and os.path.isfile(os.path.join(B.ICONS_DIR, u)) for u in used), "every picture the page names is a file in assets/swap/ic/")
    ok(all("ic" in c for c in icons["chains"]), "every network has its picture")
    n_t = sum(len(v) for v in icons["tokens"].values())
    n_i = sum(1 for v in icons["tokens"].values() for t in v if "ic" in t)
    ok(n_i >= n_t * 0.85, f"nearly every token has a picture ({n_i} of {n_t}; the rest get a letter badge)")
    bad_svg = re.compile(rb"<script|\son[a-z]+\s*=|<foreignObject|javascript:|(?:href|src)\s*=\s*[\"']\s*(?:https?:)?//", re.I)
    svgs = [os.path.join(B.ICONS_DIR, "c", f) for f in os.listdir(os.path.join(B.ICONS_DIR, "c"))]
    ok(all(f.endswith(".svg") and os.path.getsize(f) < 60000 and not bad_svg.search(open(f, "rb").read()) for f in svgs),
       "no network picture carries a script, an event handler or an outside reference")
    webps = [os.path.join(B.ICONS_DIR, "t", f) for f in os.listdir(os.path.join(B.ICONS_DIR, "t"))]
    ok(all(f.endswith(".webp") and open(f, "rb").read(12)[8:12] == b"WEBP" and os.path.getsize(f) < 20000 for f in webps),
       "every token picture is a small WebP redrawn here")

    # ---------------------------------------------------------------- the deploy passes: what they add must be the site's own
    import i18n_ar, i18n_site, seo_tidy, seo_struct, chrome  # noqa: E401
    ok("swap" not in chrome.STATIC, "the generic header injection (which would also swap in the site-wide policy) does not touch /swap/")
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
            csp_at = doc.index('http-equiv="Content-Security-Policy"')
            after = scripts_of(doc[csp_at:])
            srcs = [re.search(r'src="([^"?]*)', x).group(1) if 'src="' in x else None for x in after]
            ok(all(x in B.MAY_RUN for x in srcs), f"[{name}] after the deploy passes, every script under the policy is one of the site's own ({srcs})")
            ok({"/assets/ar.js", "/assets/i18n.js"} <= set(srcs), f"[{name}] the two translation layers are added, so the page appears in every language of the site")
            ok(len(re.findall(r'http-equiv="Content-Security-Policy"', doc)) == 1 and "li.quest" in doc[csp_at:csp_at + 600],
               f"[{name}] the deploy passes leave this page's own policy in place")
            outside = [(t, u) for t, u in loaders(doc) if re.match(r"(?:https?:)?//", u)]
            ok(not outside, f"[{name}] after the deploy passes the markup still loads nothing from another host")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    # ---------------------------------------------------------------- the translation layers can read it
    pg = i18n_ar.Page()
    pg.feed(B.page(B.check(copy.deepcopy(GOOD)), data))
    for words in ("You send", "You receive", "Before every swap", "Max price move", "Search on the network"):
        ok(words in pg.out, f"the site's translator finds the page's English: “{words}”")
    ok(not any(re.search(r"0x[0-9a-fA-F]{40}", x) for x in pg.out), "no address is handed to the translator")
    js_en = i18n_ar.js_strings(open(os.path.join(ROOT, "assets", "swap", "swap.js"), encoding="utf-8").read())
    for words in ("Connect wallet", "Swap", "Finding the best price…", "Approve token", "Choose a coin"):
        ok(words in js_en, f"…and the engine's English: “{words}”")

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
