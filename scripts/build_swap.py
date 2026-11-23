#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
/swap/ — cross-chain token swaps on entekhab.net, routed by LI.FI.

Why LI.FI and not Rango: on 2026-11-23 every Rango host (widget, app, site and api.rango.exchange) was closed to
readers inside Iran — the main audience — so a Rango page would have been furniture. LI.FI's service answers, and its
route and transaction come back over one plain HTTPS call, which means this page needs no third-party code at all.

The page is a member of the site: it carries the site's header, menu, tab bar and footer (scripts/chrome.py), follows
the header's language buttons, and is read by the translation layers like any other page, so it appears in every
language the site has. What stays different from the other pages is its policy. The site's own policy has to allow a
dozen data hosts and inline script; this page allows neither:

  script-src 'self'              only files of this site — no inline script, no other host
  connect-src 'self' li.quest    the site's own files (translations, the menu) and the one price service
  img-src 'self' data:           every network and token picture is a file of this site (scripts/swap_icons.py),
                                 so no third-party host ever learns who is looking at which token
  frame-src 'none'               nothing is embedded, and assets/swap/swap.js refuses to run inside another site's frame

The site's chat assistant, which talks to another host, is not loaded here. The swap engine itself is pinned by its
SHA-384. Every figure and address on the page is marked translate="no": the translation layers may re-word a label,
they can never touch an amount.

The transaction is never built here: assets/swap/swap.js asks LI.FI for it and checks every field of the answer
(chain, both tokens, the amount, the reader's own address, the contract pinned for that chain, how much the call
carries) before the wallet is opened, and asks the wallet again which chain and account it is on right before sending.

Settings — scripts/swap_config.json:
  enabled      false → the page says swaps are not on yet and nothing is loaded from outside
  integrator   the name registered with LI.FI; without it a swap still works, it simply earns the site nothing
  fee          0 … 0.03 — the site's share of each swap, as a fraction (0.005 = 0.5%). LI.FI forwards it straight to
               the wallet registered with that integrator name, so no wallet address is needed here and none is kept
  slippage     the default price movement a reader accepts (0.005 = 0.5%), never above 0.05

Nothing in that file is a secret: all of it travels in the request anyway. LI.FI's own API key is deliberately NOT
supported — it is meant for a server, and anything in this page is public.

Data — scripts/swap_chains.json: the chains and the short token list, every address read from LI.FI itself.

The page is committed, like /charts/. Rebuild it whenever the site menu or its scripts' versions change:
    python3 scripts/build_swap.py
Tests: python3 tests/test_swap.py · node tests/test_swap.js
"""
import base64
import copy
import hashlib
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "scripts", "swap_config.json")
CHAINS = os.path.join(ROOT, "scripts", "swap_chains.json")
OUT = os.path.join(ROOT, "swap", "index.html")
SERVICE = "https://li.quest"
MAX_FEE = 0.03
MAX_SLIP = 0.05
ZERO = "0x" + "0" * 40
KEYS = {"enabled", "integrator", "fee", "slippage", "donate"}
INTEGRATOR = re.compile(r"^[A-Za-z0-9_.-]{1,40}$")
EVM = re.compile(r"^0x[0-9a-fA-F]{40}$")
# Where a swap ends on a network that is not EVM, the reader types the address themselves and the money leaves our
# hands for good. These are the shapes those addresses take; anything else is refused before the wallet ever opens.
ADDRESS = {
    "utxo": r"^(?:bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,39})$",
    "zcash": r"^(?:t1[1-9A-HJ-NP-Za-km-z]{33}|t3[1-9A-HJ-NP-Za-km-z]{33}|u1[02-9ac-hj-np-z]{70,})$",
    "tron": r"^T[1-9A-HJ-NP-Za-km-z]{33}$",
    "solana": r"^[1-9A-HJ-NP-Za-km-z]{32,44}$",
    "sui": r"^0x[0-9a-fA-F]{64}$",
    "stellar": r"^G[A-Z2-7]{55}$",
}
TOKEN_ADDR = re.compile(r"^[0-9A-Za-z:_.-]+$")
LIFI_LINK = '<a href="https://li.fi/" rel="noopener noreferrer" target="_blank">LI.FI</a>'

# The policy of this page (see the top of the file). frame-ancestors cannot be set from a <meta>, so the engine checks
# for a parent frame itself. 'inline-speculation-rules' lets the site's menu ask the browser to preload the next page a
# reader hovers (assets/ui2.js) and allows no script at all. 'unsafe-inline' is for *styles* only: the site's header and translation layers write
# style rules, which can restyle but not run.
# The wallet that takes the fee and the gifts is read out loud on the page, so anyone can see what has come in. The
# balance is read straight from these networks' own public nodes — read-only calls, no key, nothing sent but the
# question "how much USDT does this address hold". A node that is unreachable simply leaves its line blank.
WATCH = (56, 1, 137, 8453, 10, 43114)


def watch_list(data):
    """the watched chains, each with its USDT contract, as the page needs them"""
    out = []
    by = {c["id"]: c for c in data["chains"]}
    for cid in WATCH:
        c = by.get(cid)
        if not c:
            continue
        for tk in data["tokens"].get(str(cid), []):
            if tk["symbol"] == "USDT":
                out.append({"id": cid, "name": c["name"], "rpc": c["rpc"], "explorer": c["explorer"],
                            "ic": c.get("ic"), "token": tk["address"], "decimals": tk["decimals"]})
                break
    return out


def rpc_hosts(data):
    from urllib.parse import urlparse
    seen = []
    for w in watch_list(data):
        o = urlparse(w["rpc"])
        u = f"{o.scheme}://{o.netloc}"
        if u not in seen:
            seen.append(u)
    return seen


def csp(data):
    hosts = " ".join([SERVICE] + rpc_hosts(data))
    return ("default-src 'none'; script-src 'self' 'inline-speculation-rules'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
            f"font-src 'self' data:; connect-src 'self' {hosts}; frame-src 'none'; manifest-src 'self'; worker-src 'self'; "
            "base-uri 'none'; form-action 'none'; object-src 'none'; upgrade-insecure-requests")


CSP = ("default-src 'none'; script-src 'self' 'inline-speculation-rules'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
       f"font-src 'self' data:; connect-src 'self' {SERVICE}; frame-src 'none'; manifest-src 'self'; worker-src 'self'; "
       "base-uri 'none'; form-action 'none'; object-src 'none'; upgrade-insecure-requests")
# the site's own scripts this page runs, in order; the two translation layers are added by the deploy (i18n_ar, i18n_site)
SITE_SCRIPTS = ("ui2.js", "nx.js", "deep.js", "chrome.js")
MAY_RUN = {"/assets/swap/swap.js", "/assets/ui2.js", "/assets/nx.js", "/assets/deep.js", "/assets/chrome.js",
           "/assets/ar.js", "/assets/i18n.js"}
ICONS_DIR = os.path.join(ROOT, "assets", "swap", "ic")
ICON_ALIAS = {"usdc-e": "usdc", "usdce": "usdc", "usdt-e": "usdt", "usdt0": "usdt", "weth-e": "weth", "wbnb": "bnb", "xdai": "dai"}


class ConfigError(ValueError):
    pass


# ------------------------------------------------------------------ Keccak-256 (for the EIP-55 address checksum)
_RC = [0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000, 0x000000000000808B,
       0x0000000080000001, 0x8000000080008081, 0x8000000000008009, 0x000000000000008A, 0x0000000000000088,
       0x0000000080008009, 0x000000008000000A, 0x000000008000808B, 0x800000000000008B, 0x8000000000008089,
       0x8000000000008003, 0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
       0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008]
_ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]]
_M = (1 << 64) - 1


def _rol(x, n):
    return ((x << n) | (x >> (64 - n))) & _M if n else x


def _f(a):
    for rc in _RC:
        c = [a[x][0] ^ a[x][1] ^ a[x][2] ^ a[x][3] ^ a[x][4] for x in range(5)]
        d = [c[(x - 1) % 5] ^ _rol(c[(x + 1) % 5], 1) for x in range(5)]
        a = [[a[x][y] ^ d[x] for y in range(5)] for x in range(5)]
        b = [[0] * 5 for _ in range(5)]
        for x in range(5):
            for y in range(5):
                b[y][(2 * x + 3 * y) % 5] = _rol(a[x][y], _ROT[x][y])
        a = [[b[x][y] ^ ((~b[(x + 1) % 5][y]) & b[(x + 2) % 5][y]) for y in range(5)] for x in range(5)]
        a[0][0] ^= rc
    return a


def keccak256(data):
    rate = 136
    p = bytearray(data) + b"\x01" + b"\x00" * ((-len(data) - 2) % rate) + b"\x80" if (len(data) + 1) % rate else bytearray(data) + b"\x81"
    a = [[0] * 5 for _ in range(5)]
    for off in range(0, len(p), rate):
        for i in range(rate // 8):
            a[i % 5][i // 5] ^= int.from_bytes(p[off + 8 * i:off + 8 * i + 8], "little")
        a = _f(a)
    return b"".join(a[i % 5][i // 5].to_bytes(8, "little") for i in range(4))


def eip55(addr):
    """the address with its checksum capitals (EIP-55)"""
    h = addr[2:].lower()
    k = keccak256(h.encode("ascii")).hex()
    return "0x" + "".join(c.upper() if c in "abcdef" and int(k[i], 16) >= 8 else c for i, c in enumerate(h))


# ------------------------------------------------------------------ the settings
def check(raw):
    """scripts/swap_config.json → the clean settings, or ConfigError saying exactly what is wrong"""
    if not isinstance(raw, dict):
        raise ConfigError("the settings must be an object")
    extra = set(raw) - KEYS
    if extra:
        raise ConfigError(f"unknown setting(s): {', '.join(sorted(extra))}")
    if not isinstance(raw.get("enabled"), bool):
        raise ConfigError("enabled must be true or false")
    integrator = raw.get("integrator", "")
    if not isinstance(integrator, str) or (integrator and not INTEGRATOR.match(integrator)):
        raise ConfigError("integrator is not a LI.FI integrator name")
    fee, slip = raw.get("fee", 0), raw.get("slippage", 0.005)
    for name, v, lo, hi in (("fee", fee, 0, MAX_FEE), ("slippage", slip, 0, MAX_SLIP)):
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not lo <= v <= hi:
            raise ConfigError(f"{name} must be between {lo} and {hi} (a fraction: 0.005 is 0.5%)")
    if slip <= 0:
        raise ConfigError("slippage must be above 0")
    if not raw["enabled"]:
        return {"enabled": False}
    if fee > 0 and not integrator:
        raise ConfigError("a fee needs the integrator name registered with LI.FI; without it the fee is paid to nobody")
    out = {"enabled": True, "integrator": integrator, "fee": float(fee), "slippage": float(slip)}
    donate = raw.get("donate", "")
    if donate:
        if not isinstance(donate, str) or not EVM.match(donate) or donate != eip55(donate):
            raise ConfigError("donate must be a checksummed EVM address (the gifts are sent straight to it)")
        out["donate"] = donate
    return out


def load(path=CONFIG):
    with open(path, encoding="utf-8") as f:
        return check(json.load(f))


def chains(path=CHAINS):
    """scripts/swap_chains.json → what the page may offer, checked hard: a wrong address here would cost somebody money"""
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    out = {"chains": [], "tokens": {}}
    ids = set()
    for c in raw.get("chains", []):
        if not isinstance(c.get("id"), int) or c["id"] <= 0 or c["id"] in ids:
            raise ConfigError(f"chain id is missing or repeated: {c.get('id')!r}")
        # A `to_only` network is one a swap may end on but not start on: Bitcoin, Tron, Solana, Sui, Stellar, Zcash.
        # The transaction is still signed on the EVM network the swap starts from, so these need no contract of their
        # own and no node — only a name, a coin, an explorer, and the shape a recipient address takes there.
        to_only = c.get("to_only") is True
        need = ("name", "coin", "explorer") + (("kind",) if to_only else ("rpc", "contract"))
        for k in need:
            if not isinstance(c.get(k), str) or not c[k]:
                raise ConfigError(f"chain {c['id']}: {k} is missing")
        for k in ("explorer",) if to_only else ("explorer", "rpc"):
            if not c[k].startswith("https://"):
                raise ConfigError(f"chain {c['id']}: {k} must be https")
        row = {"id": c["id"], "name": c["name"], "coin": c["coin"], "explorer": c["explorer"]}
        if to_only:
            if c["kind"] not in ADDRESS:
                raise ConfigError(f"chain {c['id']}: {c['kind']!r} is not an address shape this page knows")
            row["to_only"] = True
            row["kind"] = c["kind"]
            if c.get("contract") or c.get("rpc"):
                raise ConfigError(f"chain {c['id']}: a to_only network must carry no contract and no node")
        else:
            if not EVM.match(c["contract"]) or c["contract"] != eip55(c["contract"]):
                raise ConfigError(f"chain {c['id']}: contract is not a checksummed address")
            row["rpc"] = c["rpc"]
            row["contract"] = c["contract"]
        ids.add(c["id"])
        out["chains"].append(row)
    if not out["chains"]:
        raise ConfigError("no chains")
    for cid, toks in raw.get("tokens", {}).items():
        if not cid.isdigit() or int(cid) not in ids:
            raise ConfigError(f"tokens for a chain that is not listed: {cid!r}")
        seen = set()
        rows = []
        native = {c["id"]: c.get("to_only") is True for c in out["chains"]}[int(cid)]
        for tk in toks:
            a = tk.get("address")
            if not isinstance(a, str) or not a or len(a) > 120 or not TOKEN_ADDR.match(a):
                raise ConfigError(f"chain {cid}: {a!r} is not an address")
            if not native:
                if not EVM.match(a):
                    raise ConfigError(f"chain {cid}: {a!r} is not an EVM address")
                if a != ZERO and a != eip55(a):
                    raise ConfigError(f"chain {cid}: the EIP-55 checksum of {a} does not match — copy it again from LI.FI")
            if a.lower() in seen:
                raise ConfigError(f"chain {cid}: {a} is listed twice")
            seen.add(a.lower())
            d = tk.get("decimals")
            if not isinstance(d, int) or isinstance(d, bool) or not 0 <= d <= 36:
                raise ConfigError(f"chain {cid}: {a} has no sensible decimals")
            for k in ("symbol", "name"):
                if not isinstance(tk.get(k), str) or not tk[k] or len(tk[k]) > 40:
                    raise ConfigError(f"chain {cid}: {a} has no {k}")
            rows.append({"symbol": tk["symbol"], "name": tk["name"], "address": a, "decimals": d})
        if not rows:
            raise ConfigError(f"chain {cid}: no tokens")
        # the network's own coin, the stablecoins and the few majors stay on top as written; the long tail reads A to Z
        out["tokens"][cid] = rows[:8] + sorted(rows[8:], key=lambda t: t["symbol"].lower())
    for c in out["chains"]:
        if str(c["id"]) not in out["tokens"]:
            raise ConfigError(f"chain {c['id']} has no token list")
    return out


def percent(cfg):
    return cfg.get("fee", 0) * 100 if cfg.get("enabled") else 0


# ------------------------------------------------------------------ the page
def sri(rel):
    with open(os.path.join(ROOT, rel), "rb") as f:
        return "sha384-" + base64.b64encode(hashlib.sha384(f.read()).digest()).decode()


_FA = str.maketrans("0123456789.", "۰۱۲۳۴۵۶۷۸۹٫")
_CKB = str.maketrans("0123456789.", "٠١٢٣٤٥٦٧٨٩٫")


def _n(v, lg):
    s = f"{v:g}"
    return s.translate(_FA) if lg == "fa" else s.translate(_CKB) if lg == "ckb" else s


def tri(fa, ckb, en, tag="span", cls=""):
    """one piece of text in the page's three languages, by the site's contract: [data-lang] blocks, of which the
    engine shows one. Persian is the one visible before any script runs. The English copy is what the site's
    translation layers read for every other language."""
    c = f' class="{cls}"' if cls else ""
    return (f'<{tag}{c} data-lang="fa">{fa}</{tag}><{tag}{c} data-lang="ckb" hidden>{ckb}</{tag}>'
            f'<{tag}{c} data-lang="en" lang="en" dir="ltr" hidden>{en}</{tag}>')


def icon_key(symbol):
    s = symbol.lower().replace("₮", "t").replace(".", "-")
    return re.sub(r"[^a-z0-9-]", "", s)[:24]


def with_icons(data):
    """the checked data plus, for every network and token that has one, the name of its picture in assets/swap/ic/.
    A token without a picture of its own wears the one of the asset it stands for (USDC.e → USDC), the chain's own
    coin and its wrapped form wear the chain's; anything else gets a letter badge drawn by the page."""
    out = copy.deepcopy(data)

    def has(rel):
        return os.path.isfile(os.path.join(ICONS_DIR, rel))
    for c in out["chains"]:
        if has(f"c/{c['id']}.svg"):
            c["ic"] = f"c/{c['id']}.svg"
    by_id = {str(c["id"]): c for c in out["chains"]}
    for cid, rows in out["tokens"].items():
        ch = by_id[cid]
        for t in rows:
            k = icon_key(t["symbol"])
            if k and has(f"t/{k}.webp"):
                t["ic"] = f"t/{k}.webp"
            elif ICON_ALIAS.get(k) and has(f"t/{ICON_ALIAS[k]}.webp"):
                t["ic"] = f"t/{ICON_ALIAS[k]}.webp"
            elif (t["address"] == ZERO or t["symbol"].upper() == "W" + ch["coin"].upper()) and ch.get("ic"):
                t["ic"] = ch["ic"]
    return out


def fee_block(cfg):
    if not cfg.get("enabled"):
        return ""
    p = cfg.get("fee", 0)
    if p > 0:
        return tri(
            f'کارمزد انتخاب: <b translate="no"><bdi>{_n(p, "fa")}</bdi></b> از مبلغ هر تبدیل. همهٔ آن صرف کاشت بذر و نهال در زاگرس می‌شود.',
            f'کرێی ئینتیخاب: <b translate="no"><bdi>{_n(p, "ckb")}</bdi></b> لە بڕی هەر گۆڕینەوەیەک. هەمووی بۆ چاندنی تۆو و نەمام لە زاگرۆس خەرج دەکرێت.',
            f'Entekhab\'s fee: <b translate="no"><bdi>{_n(p, "en")}</bdi></b> of each swap. All of it is spent on planting seeds and saplings in the Zagros.', "p")
    return tri("انتخاب از این تبدیل‌ها کارمزدی نمی‌گیرد.", "ئینتیخاب لەم گۆڕینەوانە هیچ کرێیەک وەرناگرێت.",
               "Entekhab takes no fee on these swaps.", "p")


_CHEV = '<svg class="sw-chev" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
_FLIP = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M7 4v14m0 0l-3.5-3.5M7 18l3.5-3.5M17 20V6m0 0l-3.5 3.5M17 6l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def side(which):
    """one half of the form: where from (an amount to type) or where to (the amount that would arrive)"""
    f = which == "f"
    head = tri("می‌فرستید", "دەینێریت", "You send") if f else tri("می‌گیرید", "وەری دەگریت", "You receive")
    amount = ('<input id="sw-amount" class="sw-num" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" dir="ltr" placeholder="0.0" aria-label="amount" translate="no">'
              if f else '<output id="sw-receive" class="sw-num" dir="ltr" translate="no" aria-live="polite"></output>')
    bal = (f'<span class="sw-bal">{tri("موجودی", "ماوە", "Balance")} <b id="sw-balance" dir="ltr" translate="no"></b>'
           f'<button type="button" id="sw-max" class="sw-max">{tri("همه", "هەموو", "Max")}</button></span>') if f else ""
    p = "f" if f else "t"
    return f"""<div class="sw-side" data-side="{'from' if f else 'to'}">
<div class="sw-side-h"><span class="sw-lab">{head}</span>{bal}</div>
<div class="sw-side-b">{amount}
<button type="button" id="sw-{p}t" class="sw-pill" aria-haspopup="dialog"><span id="sw-{p}t-i" class="sw-ic"></span><b id="sw-{p}t-n" translate="no"></b>{_CHEV}</button></div>
<div class="sw-side-f"><span id="sw-{'from' if f else 'to'}-usd" class="sw-usd" dir="ltr" translate="no"></span>
<button type="button" id="sw-{p}c" class="sw-net" aria-haspopup="dialog"><span id="sw-{p}c-i" class="sw-ic sw-ic-s"></span><span id="sw-{p}c-n" translate="no"></span>{_CHEV}</button></div>
</div>"""


def controls():
    """the tool itself. Every label is here in three languages; assets/swap/swap.js only fills in names and numbers."""
    def q(id_, fa, ckb, en):
        return f'<div class="sw-q"><span>{tri(fa, ckb, en)}</span><b id="sw-{id_}" dir="ltr" translate="no"></b></div>'
    slips = "".join(f'<button type="button" data-slip="{v}" aria-pressed="false" translate="no">{p}</button>'
                    for v, p in ((0.001, "0.1%"), (0.005, "0.5%"), (0.01, "1%"), (0.03, "3%")))
    return f"""{side("f")}
<div class="sw-mid"><button type="button" id="sw-flip" class="sw-flip" aria-label="swap direction">{_FLIP}</button></div>
{side("t")}
<div id="sw-rcp-box" class="sw-rcp" hidden>
<label for="sw-rcp">{tri("نشانی دریافت روی <b id=\'sw-rcp-c\' translate=\'no\'></b>", "ناونیشانی وەرگرتن لەسەر <b id=\'sw-rcp-c\' translate=\'no\'></b>", "Receiving address on <b id=\'sw-rcp-c\' translate=\'no\'></b>")}</label>
<input id="sw-rcp" type="text" autocomplete="off" spellcheck="false" autocapitalize="off" dir="ltr" placeholder="" aria-describedby="sw-rcp-h" translate="no">
<div id="sw-rcp-h" class="sw-rcp-h">{tri(
    "این شبکه EVM نیست؛ نشانی را از کیف پول همان شبکه کپی کنید. تبدیل‌شده به همین نشانی می‌رود و بازگشتی ندارد.",
    "ئەم تۆڕە EVM نییە؛ ناونیشان لە جزدانی هەمان تۆڕ لەبەربگرە. ئەوەی گۆڕدرا بۆ هەمان ناونیشان دەچێت و ناگەڕێتەوە.",
    "This network is not EVM; copy the address from a wallet of that network. What you swap goes there and cannot come back.")}</div>
</div>
<div id="sw-quote" class="sw-quote" data-has="0">
{q("rate", "نرخ", "نرخ", "Rate")}
{q("min", "حداقل دریافتی", "کەمترین وەرگرتن", "At least")}
{q("impact", "اثر بر ارزش", "کاریگەری لەسەر بەها", "Value lost")}
{q("route", "مسیر", "ڕێگا", "Route")}
{q("gas", "کارمزد شبکه", "کرێی تۆڕ", "Network fee")}
{q("fee", "کارمزد سرویس", "کرێی خزمەتگوزاری", "Service fee")}
{q("time", "زمان تقریبی", "کاتی نزیکەیی", "About")}
</div>
<div class="sw-slip"><span class="sw-lab">{tri("حداکثر تغییر قیمت", "زۆرترین گۆڕانی نرخ", "Max price move")}</span><span id="sw-slip" class="sw-chips">{slips}</span></div>
<div id="sw-tokenwarn" class="sw-warnline" role="status"></div>
<label id="sw-ackbox" class="sw-ack" hidden><input type="checkbox" id="sw-ack"><span><span>{tri(
    "خطر این تبدیل را می‌دانم و می‌خواهم ادامه دهم.", "مەترسیی ئەم گۆڕینەوەیە دەزانم و دەمەوێت بەردەوام بم.",
    "I understand the risk of this swap and want to go on.")}</span><code id="sw-ack-a" dir="ltr" translate="no"></code></span></label>
<button type="button" id="sw-action" class="sw-go" disabled><span id="sw-action-l"></span> <b id="sw-action-x" translate="no"></b></button>
<div id="sw-msg" class="sw-msg" role="status" aria-live="polite"></div>
<div id="sw-status" class="sw-status"></div>
<div class="sw-acct"><span id="sw-account" dir="ltr" translate="no"></span></div>"""


def dialog():
    return f"""<div id="sw-dlg" class="sw-dlg" role="dialog" aria-modal="true" aria-labelledby="sw-dlg-title" hidden>
<div class="sw-dlg-box">
<div class="sw-dlg-h"><b id="sw-dlg-title"></b><button type="button" id="sw-dlg-close" class="sw-x" aria-label="close">×</button></div>
<input id="sw-dlg-q" class="sw-search" type="search" autocomplete="off" spellcheck="false" dir="auto" placeholder="🔍" aria-label="search" translate="no">
<div id="sw-dlg-list" class="sw-list"></div>
<button type="button" id="sw-dlg-find" class="sw-find" hidden>{tri("جست‌وجو روی شبکه", "گەڕان لەسەر تۆڕ", "Search on the network")}</button>
</div></div>"""


def short_chain(name):
    """'BNB Smart Chain Mainnet' -> 'BNB Smart Chain': the chips are small and the word adds nothing"""
    out = re.sub(r"\s+(Mainnet|Network|C-Chain)$", "", name).strip()
    return out or name


def donate_block(cfg, watch):
    """the gift panel and, above it, the wallet laid open: its address, and what it holds right now

    The address is written into the page at build time and the engine checks it again before the wallet opens, so
    nothing the page downloads can ever change where a gift goes. The reader chooses the network, the coin and the
    amount; the transfer is an ordinary one from their own wallet to that address.
    """
    if not cfg.get("donate"):
        return ""
    addr = cfg["donate"]
    chips = "".join(
        f'<a class="sw-dn-chain" href="{w["explorer"].rstrip("/")}/token/{w["token"]}?a={addr}" '
        f'target="_blank" rel="noopener noreferrer" data-id="{w["id"]}">'
        f'<span class="sw-ic sw-ic-s">{"<img src=/assets/swap/ic/" + w["ic"] + " alt=\"\" width=18 height=18>" if w.get("ic") else ""}</span>'
        f'<span translate="no">{html.escape(short_chain(w["name"]))}</span>'
        f'<b id="sw-dn-b{w["id"]}" dir="ltr" translate="no">—</b></a>' for w in watch)
    return f"""<section class="sw-gift" id="sw-gift" data-a="{addr}">
<div class="sw-gift-h"><h2>{tri("حمایت", "پشتگیری", "Support")}</h2>
<p>{tri("کیف پول باز است؛ هر مقدار و با هر کوینی که بخواهید.",
        "جزدان کراوەیە؛ هەر بڕێک و بە هەر دراوێک کە بتەوێت.",
        "The wallet is open; any amount, in any coin you like.")}</p></div>
<div class="sw-open">
<div class="sw-open-t"><span>{tri("موجودی تتر", "ماوەی تێتەر", "USDT held")}</span>
<b id="sw-dn-total" dir="ltr" translate="no">—</b></div>
<div class="sw-open-a"><code id="sw-dn-addr" dir="ltr" translate="no">{addr}</code>
<button type="button" id="sw-dn-copy" class="sw-copy">{tri("کپی", "لەبەرگرتنەوە", "Copy")}</button></div>
<div class="sw-dn-chains">{chips}</div>
</div>
<div class="sw-gift-f">
<div class="sw-side-b"><input id="sw-dn-amount" class="sw-num" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" dir="ltr" placeholder="0.0" aria-label="amount" translate="no">
<button type="button" id="sw-dnt" class="sw-pill" aria-haspopup="dialog"><span id="sw-dnt-i" class="sw-ic"></span><b id="sw-dnt-n" translate="no"></b>{_CHEV}</button></div>
<div class="sw-side-f"><span id="sw-dn-bal" class="sw-usd" dir="ltr" translate="no"></span>
<button type="button" id="sw-dnc" class="sw-net" aria-haspopup="dialog"><span id="sw-dnc-i" class="sw-ic sw-ic-s"></span><span id="sw-dnc-n" translate="no"></span>{_CHEV}</button></div>
<button type="button" id="sw-dn-go" class="sw-go sw-go-2" disabled><span id="sw-dn-go-l"></span> <b id="sw-dn-go-x" translate="no"></b></button>
<div id="sw-dn-msg" class="sw-msg" role="status" aria-live="polite"></div>
<div id="sw-dn-status" class="sw-status"></div>
</div></section>"""


def page(cfg, data):
    import chrome                       # here, not at the top: scripts/chrome.py imports this module for its menu
    on = bool(cfg.get("enabled"))
    public = {k: cfg[k] for k in ("enabled", "integrator", "fee", "slippage", "donate") if k in cfg}
    cdata = html.escape(json.dumps(public, ensure_ascii=True, separators=(",", ":"), sort_keys=True), quote=True)
    rich = with_icons(data)
    rich["addr"] = {k: ADDRESS[k] for k in sorted({c["kind"] for c in data["chains"] if c.get("to_only")})}
    watch = watch_list(rich) if cfg.get("donate") else []
    ddata = html.escape(json.dumps(dict(rich, watch=watch), ensure_ascii=False, separators=(",", ":")), quote=True)
    n_chain, n_tok = len(data["chains"]), sum(len(v) for v in data["tokens"].values())
    title = "تبدیل رمزارز (سواپ) بین شبکه‌ها | entekhab.net"
    desc = (f"تبدیل غیرامانی رمزارز بین {_n(n_chain, 'fa')} شبکه، از بایننس اسمارت چین و اتریوم تا آربیتروم و پالیگان؛ "
            "دارایی همیشه در کیف پول خود شما می‌ماند.")
    robots = "" if on else '<meta name="robots" content="noindex">'
    styles = "".join(f'<link rel="stylesheet" href="/assets/{f}?v={v}">' for f, v in (
        ("chrome.css", chrome.VER), ("ui2.css", chrome.UI2_VER), ("nx.css", chrome.NX_VER), ("deep.css", chrome.DEEP_VER)))
    vers = {"ui2.js": chrome.UI2_VER, "nx.js": chrome.NX_VER, "deep.js": chrome.DEEP_VER, "chrome.js": chrome.VER}
    scripts = "".join(f'<script src="/assets/{f}?v={vers[f]}" defer></script>' for f in SITE_SCRIPTS)
    chips = "".join(f'<span class="sw-chip">{x}</span>' for x in (
        tri("غیرامانی: دارایی در کیف پول خودتان", "نائەمانەتی: دارایی لە جزدانی خۆت", "Non-custodial: funds stay in your wallet"),
        tri(f'<b translate="no">{_n(n_chain, "fa")}</b> شبکه', f'<b translate="no">{_n(n_chain, "ckb")}</b> تۆڕ', f'<b translate="no">{n_chain}</b> networks'),
        tri("کارمزد شفاف، پیش از امضا", "کرێی ڕوون، پێش واژۆ", "Fees shown before you sign")))
    doc = f"""<!doctype html><html lang="fa" dir="rtl" class="ek-v2 ek-v3 ek-deep"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="{csp(data) if watch else CSP}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
{robots}<link rel="canonical" href="https://entekhab.net/swap/">
<meta property="og:title" content="{title}"><meta property="og:description" content="{desc}"><meta property="og:url" content="https://entekhab.net/swap/"><meta property="og:site_name" content="entekhab.net">
<meta property="og:image" content="https://entekhab.net/assets/og.jpg"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f7931a">{chrome.FONTS}
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
{styles}<link rel="stylesheet" href="/assets/swap/swap.css" integrity="{sri('assets/swap/swap.css')}">
</head><body class="sw-body">
{chrome.header("fa")}
<main class="sw-wrap" id="sw-main">
<div class="sw-hero">
<h1>{tri("تبدیل رمزارز", "گۆڕینەوەی دراوی دیجیتاڵ", "Swap")}</h1>
<p class="sw-sub">{tri("هر توکن، روی هر شبکه، مستقیم از کیف پول خودتان", "هەر تۆکنێک، لەسەر هەر تۆڕێک، ڕاستەوخۆ لە جزدانی خۆتەوە", "Any token, on any network, straight from your own wallet")}</p>
<div class="sw-chips-row">{chips}</div>
</div>
<div class="sw-grid">
<section id="sw-app" class="sw-card" data-s="" data-c="{cdata}" data-d="{ddata}">
<div class="sw-note s-none">{tri("<p>این بخش به جاوااسکریپت نیاز دارد.</p>", "<p>ئەم بەشە پێویستی بە جاڤاسکریپتە.</p>", "<p>This part needs JavaScript.</p>", "div")}</div>
<div class="sw-note s-off">{tri(
    "<p><strong>تبدیل هنوز فعال نشده است.</strong></p><p>این صفحه آماده است و پس از تأیید نهایی روشن می‌شود.</p>",
    "<p><strong>گۆڕینەوە هێشتا چالاک نەکراوە.</strong></p><p>ئەم پەڕەیە ئامادەیە و دوای پشتڕاستکردنەوەی کۆتایی دەکرێتەوە.</p>",
    "<p><strong>Swaps are not switched on yet.</strong></p><p>This page is ready and goes live after a final check.</p>", "div")}</div>
<div class="sw-note s-framed">{tri(
    '<p><strong>این صفحه درون قاب یک سایت دیگر باز شده است.</strong></p><p>برای امنیت شما ابزار در این حالت کار نمی‌کند. نشانی <bdi translate="no">entekhab.net/swap/</bdi> را مستقیم در مرورگر باز کنید.</p>',
    '<p><strong>ئەم پەڕەیە لەناو چوارچێوەی ماڵپەڕێکی تردا کراوەتەوە.</strong></p><p>بۆ پاراستنت، ئامرازەکە لەم دۆخەدا کار ناکات. ناونیشانی <bdi translate="no">entekhab.net/swap/</bdi> ڕاستەوخۆ لە وێبگەڕەکەت بکەرەوە.</p>',
    '<p><strong>This page was opened inside another site\'s frame.</strong></p><p>For your safety the tool does not work this way. Open <bdi translate="no">entekhab.net/swap/</bdi> directly in your browser.</p>', "div")}</div>
<div class="sw-form s-on">{controls()}</div>
</section>
{donate_block(cfg, watch)}
<aside class="sw-info">
<section class="sw-warn"><h2>{tri("پیش از هر تبدیل", "پێش هەر گۆڕینەوەیەک", "Before every swap")}</h2>
{tri(
    '<ul><li>نشانی بالای مرورگر باید <bdi translate="no">https://entekhab.net/swap</bdi> باشد.</li><li>عبارت بازیابی (۱۲ یا ۲۴ کلمه) و کلید خصوصی را هیچ‌جا وارد نکنید؛ این صفحه هرگز آن را نمی‌خواهد.</li><li>مبلغ، توکن و نشانی را در خودِ کیف پول بخوانید و بعد امضا کنید. تراکنش امضاشده برنمی‌گردد.</li><li>بار اول با مبلغ کم امتحان کنید.</li><li>برای توکنی که خودتان جست‌وجو می‌کنید، نشانی قرارداد را از منبع معتبر بگیرید؛ توکن جعلی با نام آشنا فراوان است.</li></ul>',
    '<ul><li>ناونیشانی سەرەوەی وێبگەڕ دەبێت <bdi translate="no">https://entekhab.net/swap</bdi> بێت.</li><li>دەستەواژەی گەڕاندنەوە (١٢ یان ٢٤ وشە) و کلیلی تایبەت لە هیچ شوێنێک مەنووسە؛ ئەم پەڕەیە هەرگیز داوای ناکات.</li><li>بڕ، تۆکن و ناونیشان لەناو جزدانەکەتدا بخوێنەرەوە، ئینجا واژۆ بکە. مامەڵەی واژۆکراو ناگەڕێتەوە.</li><li>یەکەم جار بە بڕێکی کەم تاقی بکەرەوە.</li><li>بۆ تۆکنێک کە خۆت بەدوایدا دەگەڕێیت، ناونیشانی گرێبەستەکە لە سەرچاوەیەکی متمانەپێکراو وەربگرە؛ تۆکنی ساختە بە ناوی ناسراو زۆرن.</li></ul>',
    '<ul><li>The address bar must read <bdi translate="no">https://entekhab.net/swap</bdi>.</li><li>Never type your recovery phrase (12 or 24 words) or a private key anywhere; this page never asks for it.</li><li>Read the amount, the token and the address in your wallet itself, then sign. A signed transaction cannot be undone.</li><li>Try a small amount the first time.</li><li>For a token you search for yourself, take the contract address from a source you trust; fake tokens with familiar names are common.</li></ul>', "div")}</section>
<section><h2>{tri("چطور کار می‌کند", "چۆن کار دەکات", "How it works")}</h2>
{tri(
    "<ol><li>کیف پول را وصل کنید؛ صفحه روی همان شبکه‌ای باز می‌شود که کیف پول روی آن است.</li><li>توکن و مبلغ را انتخاب کنید؛ بهترین مسیر، مبلغ دریافتی و همهٔ کارمزدها نشان داده می‌شود.</li><li>اگر توکن برای اولین بار فروخته می‌شود، یک اجازهٔ برداشت دقیقاً به اندازهٔ همین تبدیل می‌دهید.</li><li>تراکنش را در کیف پول امضا می‌کنید. تبدیل بین دو شبکه تا رسیدن به مقصد پیگیری می‌شود.</li></ol>",
    "<ol><li>جزدانەکەت ببەستەوە؛ پەڕەکە لەسەر هەمان ئەو تۆڕە دەکرێتەوە کە جزدانەکەی لەسەرە.</li><li>تۆکن و بڕ هەڵبژێرە؛ باشترین ڕێگا، بڕی وەرگیراو و هەموو کرێکان پیشان دەدرێن.</li><li>ئەگەر تۆکنەکە بۆ یەکەم جار دەفرۆشرێت، ڕێپێدانێکی دەرهێنان تەنیا بە ئەندازەی ئەم گۆڕینەوەیە دەدەیت.</li><li>مامەڵەکە لە جزدانەکەتدا واژۆ دەکەیت. گۆڕینەوەی نێوان دوو تۆڕ تا گەیشتن بە مەبەست شوێنی دەکەوترێت.</li></ol>",
    "<ol><li>Connect your wallet; the page opens on the network the wallet is already on.</li><li>Choose the token and the amount; the best route, what you would receive and every fee are shown.</li><li>If the token is being sold for the first time, you grant a permission for exactly this swap's amount.</li><li>You sign the transaction in your wallet. A swap between two networks is followed until it arrives.</li></ol>", "div")}</section>
<section><h2>{tri("چه کسی چه کاری می‌کند", "کێ چی دەکات", "Who does what")}</h2>
{tri(
    f"<p>مسیر تبدیل را {LIFI_LINK} پیدا می‌کند و صرافی‌های غیرمتمرکز و پل‌های خودِ شبکه‌ها انجامش می‌دهند. دارایی از کیف پول شما مستقیم به قرارداد می‌رود و برمی‌گردد؛ انتخاب هیچ‌وقت آن را نگه نمی‌دارد و به کلید شما دسترسی ندارد.</p><p>این صفحه تراکنش را خودش نمی‌سازد: آن را از سرویس می‌گیرد، تک‌تک فیلدهایش را با درخواست شما مقایسه می‌کند و تنها در صورت تطابق کامل به کیف پول می‌دهد.</p>",
    f"<p>ڕێگای گۆڕینەوەکە {LIFI_LINK} دەدۆزێتەوە و ئاڵوگۆڕگە نامەرکەزییەکان و پردەکانی تۆڕەکان خۆیان جێبەجێی دەکەن. دارایی لە جزدانی تۆوە ڕاستەوخۆ دەچێتە گرێبەست و دەگەڕێتەوە؛ ئینتیخاب هەرگیز هەڵیناگرێت و دەستی بە کلیلەکەت ناگات.</p><p>ئەم پەڕەیە مامەڵەکە خۆی دروست ناکات: لە خزمەتگوزارییەکەوە وەریدەگرێت، هەر خانەیەکی لەگەڵ داواکاریی تۆ بەراورد دەکات و تەنیا لە کاتی یەکگرتنی تەواودا دەیداتە جزدانەکەت.</p>",
    f"<p>The route is found by {LIFI_LINK} and carried out by the decentralised exchanges and bridges of the networks themselves. Your assets go from your wallet straight to the contract and back; Entekhab never holds them and has no access to your keys.</p><p>This page does not build the transaction: it takes it from the service, compares every field with what you asked for, and hands it to your wallet only if they match exactly.</p>", "div")}</section>
<section class="sw-fee"><h2>{tri("کارمزد", "کرێ", "Fees")}</h2>
{fee_block(cfg)}
{tri("کارمزد شبکه، کارمزد سرویس و حداقل مبلغ دریافتی، پیش از امضا در همین صفحه و بعد در کیف پول نشان داده می‌شود.",
     "کرێی تۆڕ، کرێی خزمەتگوزاری و کەمترین بڕی وەرگیراو، پێش واژۆ لەم پەڕەیەدا و پاشان لە جزدانەکەدا پیشان دەدرێن.",
     "The network fee, the service fee and the least you would receive are shown here before you sign, and again in your wallet.", "p")}</section>
<section><h2>{tri("حریم خصوصی", "تایبەتمەندی", "Privacy")}</h2>
{tri(
    "<p>این صفحه هیچ شمارنده یا ردیابی ندارد و چیزی از شما ذخیره نمی‌کند. تصویر شبکه‌ها و توکن‌ها از خود این سایت می‌آید، نه از میزبان دیگر. تنها ارتباط بیرونی‌اش با سرویس قیمت است؛ کیف پول شما از خود مرورگر صدا زده می‌شود. تراکنش‌ها روی بلاک‌چین عمومی‌اند.</p>",
    "<p>ئەم پەڕەیە هیچ ژمێرەر یان شوێنپێهەڵگرێکی نییە و هیچ شتێک لە تۆ هەڵناگرێت. وێنەی تۆڕ و تۆکنەکان لە خودی ئەم ماڵپەڕەوە دێن، نەک لە میوانداری تر. تەنیا پەیوەندیی دەرەکیی لەگەڵ خزمەتگوزاریی نرخە؛ جزدانەکەت لە خودی وێبگەڕەوە بانگ دەکرێت. مامەڵەکان لەسەر بلۆکچەین گشتین.</p>",
    "<p>This page has no counter or tracker and stores nothing about you. The pictures of networks and tokens come from this site itself, not from another host. Its only outside connection is to the price service; your wallet is reached through the browser itself. Transactions are public on the blockchain.</p>", "div")}
{tri("این صفحه توصیهٔ سرمایه‌گذاری نیست.", "ئەم پەڕەیە ئامۆژگاریی وەبەرهێنان نییە.", "Nothing here is investment advice.", "p")}</section>
</aside>
</div>
{dialog()}
</main>
{chrome.bottom("fa")}{chrome.footer("fa")}
<script src="/assets/swap/swap.js" integrity="{sri('assets/swap/swap.js')}" defer></script>{scripts}
</body></html>
"""
    return doc


def nav_on():
    """True once swaps are switched on: only then does the site menu (and with it the bot and the extension) list /swap/"""
    try:
        return bool(load().get("enabled"))
    except Exception:  # noqa: BLE001
        return False


def main():
    try:
        cfg, data = load(), chains()
    except ConfigError as ex:
        print("build_swap:", ex, file=sys.stderr)
        return 1
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(page(cfg, data))
    n = sum(len(v) for v in data["tokens"].values())
    print(f"build_swap: /swap/ written — {'ON' if cfg['enabled'] else 'off'}, {len(data['chains'])} chains, {n} tokens")
    return 0


if __name__ == "__main__":
    sys.exit(main())
