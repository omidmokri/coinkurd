#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
/swap/ — cross-chain token swaps on entekhab.net, routed by LI.FI, on a page kept apart from the rest of the site.

Why LI.FI and not Rango: on 2026-11-23 every Rango host (widget, app, site and api.rango.exchange) was closed to
readers inside Iran — the main audience — so a Rango page would have been furniture. LI.FI's service answers, and its
route and transaction come back over one plain HTTPS call, which means this page needs no third-party code at all.

Why the page is apart: a page where people connect a wallet must run as little code as possible. /swap/ carries no site
header, no site scripts, no translation layer and no counter. It has one stylesheet, one script (assets/swap/swap.js,
both pinned by their SHA-384) and a Content-Security-Policy that allows those two files and one connection, to
https://li.quest. No token logos are loaded, because each one would tell a third-party host who is reading the page.

The transaction is never built here: assets/swap/swap.js asks LI.FI for it and checks every field of the answer
(chain, both tokens, the amount, the reader's own address, how much the call carries) before the wallet is opened.

Settings — scripts/swap_config.json:
  enabled      false → the page says swaps are not on yet and nothing is loaded from outside
  integrator   the name registered with LI.FI; without it a swap still works, it simply earns the site nothing
  fee          0 … 0.03 — the site's share of each swap, as a fraction (0.005 = 0.5%). LI.FI pays it to the wallet
               registered with that integrator name, so no wallet address is needed here and none is kept here
  slippage     the default price movement a reader accepts (0.005 = 0.5%), never above 0.05

Nothing in that file is a secret: all of it travels in the request anyway. LI.FI's own API key is deliberately NOT
supported — it is meant for a server, and anything in this page is public.

Data — scripts/swap_chains.json: the chains and the short token list, every address read from LI.FI itself.

The page is committed, like /charts/:  python3 scripts/build_swap.py
Tests: python3 tests/test_swap.py · node tests/test_swap.js
"""
import base64
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
KEYS = {"enabled", "integrator", "fee", "slippage"}
INTEGRATOR = re.compile(r"^[A-Za-z0-9_.-]{1,40}$")
EVM = re.compile(r"^0x[0-9a-fA-F]{40}$")
LIFI_LINK = '<a href="https://li.fi/" rel="noopener noreferrer" target="_blank">LI.FI</a>'

# The one policy of this page. No 'unsafe-inline', no second host, no frames at all. Trusted Types means any attempt to
# build markup from text that came back from the service would throw instead of running. frame-ancestors cannot be set
# from a <meta>, so assets/swap/swap.js refuses to start inside another site's frame instead.
CSP = ("default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; "
       f"connect-src {SERVICE}; frame-src 'none'; manifest-src 'self'; base-uri 'none'; form-action 'none'; "
       "object-src 'none'; require-trusted-types-for 'script'; upgrade-insecure-requests")


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
    return {"enabled": True, "integrator": integrator, "fee": float(fee), "slippage": float(slip)}


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
        for k in ("name", "coin", "explorer", "rpc", "contract"):
            if not isinstance(c.get(k), str) or not c[k]:
                raise ConfigError(f"chain {c['id']}: {k} is missing")
        for k in ("explorer", "rpc"):
            if not c[k].startswith("https://"):
                raise ConfigError(f"chain {c['id']}: {k} must be https")
        if not EVM.match(c["contract"]) or c["contract"] != eip55(c["contract"]):
            raise ConfigError(f"chain {c['id']}: contract is not a checksummed address")
        ids.add(c["id"])
        out["chains"].append({"id": c["id"], "name": c["name"], "coin": c["coin"], "explorer": c["explorer"],
                              "rpc": c["rpc"], "contract": c["contract"]})
    if not out["chains"]:
        raise ConfigError("no chains")
    for cid, toks in raw.get("tokens", {}).items():
        if not cid.isdigit() or int(cid) not in ids:
            raise ConfigError(f"tokens for a chain that is not listed: {cid!r}")
        seen = set()
        rows = []
        for tk in toks:
            a = tk.get("address")
            if not isinstance(a, str) or not EVM.match(a):
                raise ConfigError(f"chain {cid}: {a!r} is not an address")
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
        out["tokens"][cid] = rows
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


def tri(fa, ckb, en, tag="span"):
    return (f'<{tag} class="l-fa" lang="fa" dir="rtl">{fa}</{tag}><{tag} class="l-ckb" lang="ckb" dir="rtl">{ckb}</{tag}>'
            f'<{tag} class="l-en" lang="en" dir="ltr">{en}</{tag}>')


def fee_block(cfg):
    if not cfg.get("enabled"):
        return ""
    p = percent(cfg)
    if p > 0:
        return tri(
            f"کارمزد انتخاب: <b><bdi>{_n(p, 'fa')}٪</bdi></b> از مبلغ هر تبدیل، که صرف کاشت بذر و نهال در زاگرس می‌شود.",
            f"کرێی ئینتیخاب: <b><bdi>٪{_n(p, 'ckb')}</bdi></b> لە بڕی هەر گۆڕینەوەیەک، کە بۆ چاندنی تۆو و نەمام لە زاگرۆس خەرج دەکرێت.",
            f"Entekhab's fee: <b><bdi>{_n(p, 'en')}%</bdi></b> of each swap, spent on planting seeds and saplings in the Zagros.", "p")
    return tri("انتخاب از این تبدیل‌ها کارمزدی نمی‌گیرد.", "ئینتیخاب لەم گۆڕینەوانە هیچ کرێیەک وەرناگرێت.",
               "Entekhab takes no fee on these swaps.", "p")


def controls():
    """the tool itself. Every label is here in three languages; assets/swap/swap.js only fills in numbers."""
    def lbl(fa, ckb, en):
        return tri(fa, ckb, en)
    slips = "".join(f'<option value="{v}"{" selected" if v == 0.005 else ""}>{p}</option>'
                    for v, p in ((0.001, "0.1%"), (0.005, "0.5%"), (0.01, "1%"), (0.03, "3%")))
    return f"""<div class="sw-row">
<label class="sw-f"><span class="sw-lab">{lbl("از شبکهٔ", "لە تۆڕی", "From network")}</span><select id="sw-from-chain"></select></label>
<label class="sw-f"><span class="sw-lab">{lbl("توکن مبدأ", "تۆکنی سەرچاوە", "Token in")}</span><select id="sw-from-token"></select></label>
</div>
<input id="sw-from-custom" class="sw-addr" type="text" inputmode="latin" spellcheck="false" autocomplete="off" dir="ltr" placeholder="CAKE  |  0x…" hidden>
<div class="sw-row sw-amt">
<label class="sw-f"><span class="sw-lab">{lbl("مبلغ", "بڕ", "Amount")}</span>
<input id="sw-amount" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" dir="ltr" placeholder="0.0"></label>
<button type="button" id="sw-max" class="sw-small">{lbl("همه", "هەموو", "Max")}</button>
</div>
<div class="sw-bal"><span id="sw-balance" dir="ltr"></span></div>
<div class="sw-mid"><button type="button" id="sw-flip" class="sw-small" aria-label="swap direction">⇅</button></div>
<div class="sw-row">
<label class="sw-f"><span class="sw-lab">{lbl("به شبکهٔ", "بۆ تۆڕی", "To network")}</span><select id="sw-to-chain"></select></label>
<label class="sw-f"><span class="sw-lab">{lbl("توکن مقصد", "تۆکنی مەبەست", "Token out")}</span><select id="sw-to-token"></select></label>
</div>
<input id="sw-to-custom" class="sw-addr" type="text" inputmode="latin" spellcheck="false" autocomplete="off" dir="ltr" placeholder="CAKE  |  0x…" hidden>
<div id="sw-tokenwarn" class="sw-warnline"></div>
<div id="sw-quote" class="sw-quote" data-has="0">
<div class="sw-q"><span>{lbl("دریافت می‌کنید", "وەری دەگریت", "You receive")}</span><b id="sw-receive" dir="ltr"></b></div>
<div class="sw-q"><span>{lbl("حداقل دریافتی", "کەمترین وەرگرتن", "At least")}</span><b id="sw-min" dir="ltr"></b></div>
<div class="sw-q"><span>{lbl("مسیر", "ڕێگا", "Route")}</span><b id="sw-route" dir="ltr"></b></div>
<div class="sw-q"><span>{lbl("کارمزد شبکه", "کرێی تۆڕ", "Network fee")}</span><b id="sw-gas" dir="ltr"></b></div>
<div class="sw-q"><span>{lbl("کارمزد سرویس", "کرێی خزمەتگوزاری", "Service fee")}</span><b id="sw-fee" dir="ltr"></b></div>
<div class="sw-q"><span>{lbl("زمان تقریبی", "کاتی نزیکەیی", "About")}</span><b id="sw-time" dir="ltr"></b></div>
</div>
<div class="sw-row sw-slip"><label class="sw-f"><span class="sw-lab">{lbl("حداکثر تغییر قیمت", "زۆرترین گۆڕانی نرخ", "Max price move")}</span>
<select id="sw-slip">{slips}</select></label><span id="sw-account" class="sw-acct" dir="ltr"></span></div>
<button type="button" id="sw-action" class="sw-go" disabled></button>
<div id="sw-msg" class="sw-msg"></div>
<div id="sw-status" class="sw-status"></div>"""


def page(cfg, data):
    on = bool(cfg.get("enabled"))
    public = {k: cfg[k] for k in ("enabled", "integrator", "fee", "slippage") if k in cfg}
    cdata = html.escape(json.dumps(public, ensure_ascii=True, separators=(",", ":"), sort_keys=True), quote=True)
    ddata = html.escape(json.dumps(data, ensure_ascii=False, separators=(",", ":")), quote=True)
    title = "تبدیل رمزارز (سواپ) بین شبکه‌ها | entekhab.net"
    desc = ("تبدیل غیرامانی رمزارز بین بایننس اسمارت چین، اتریوم، آربیتروم، پالیگان و شبکه‌های دیگر؛ "
            "دارایی همیشه در کیف پول خود شما می‌ماند.")
    robots = "" if on else '<meta name="robots" content="noindex">'
    doc = f"""<!DOCTYPE html>
<html lang="fa" dir="rtl" data-noar>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
{robots}<link rel="canonical" href="https://entekhab.net/swap/">
<link rel="icon" href="/assets/favicon-32.png">
<link rel="stylesheet" href="/assets/swap/swap.css" integrity="{sri('assets/swap/swap.css')}">
</head>
<body>
<header class="sw-top">
<a href="/"><img src="/assets/logo-h.webp" alt="entekhab.net" width="128" height="32"></a>
<div class="sw-lang"><button type="button" data-set-l="fa">فارسی</button><button type="button" data-set-l="ckb">کوردی</button><button type="button" data-set-l="en">English</button></div>
<a class="sw-home" href="/">{tri("بازگشت به سایت", "گەڕانەوە بۆ ماڵپەڕ", "Back to the site")}</a>
</header>
<main>
<h1>{tri("تبدیل رمزارز (سواپ)", "گۆڕینەوەی دراوی دیجیتاڵ (سواپ)", "Swap")}
<small>{tri("بین شبکه‌ها، از کیف پول خودتان", "لە نێوان تۆڕەکان، لە جزدانی خۆتەوە", "Across chains, from your own wallet")}</small></h1>
<div id="sw-app" class="sw-app" data-c="{cdata}" data-d="{ddata}">
<div class="sw-note s-none">{tri("<p>این بخش به جاوااسکریپت نیاز دارد.</p>", "<p>ئەم بەشە پێویستی بە جاڤاسکریپتە.</p>", "<p>This part needs JavaScript.</p>", "div")}</div>
<div class="sw-note s-off">{tri(
    "<p><strong>تبدیل هنوز فعال نشده است.</strong></p><p>این صفحه آماده است و پس از تأیید نهایی روشن می‌شود. تا آن زمان هیچ چیزی از بیرونِ این سایت در این صفحه بارگذاری نمی‌شود.</p>",
    "<p><strong>گۆڕینەوە هێشتا چالاک نەکراوە.</strong></p><p>ئەم پەڕەیە ئامادەیە و دوای پشتڕاستکردنەوەی کۆتایی دەکرێتەوە. تا ئەو کاتە هیچ شتێک لە دەرەوەی ئەم ماڵپەڕە لەم پەڕەیەدا بار ناکرێت.</p>",
    "<p><strong>Swaps are not switched on yet.</strong></p><p>This page is ready and goes live after a final check. Until then nothing from outside this site is loaded here.</p>", "div")}</div>
<div class="sw-note s-framed">{tri(
    "<p><strong>این صفحه درون قاب یک سایت دیگر باز شده است.</strong></p><p>برای امنیت شما ابزار در این حالت کار نمی‌کند. نشانی <bdi>entekhab.net/swap/</bdi> را مستقیم در مرورگر باز کنید.</p>",
    "<p><strong>ئەم پەڕەیە لەناو چوارچێوەی ماڵپەڕێکی تردا کراوەتەوە.</strong></p><p>بۆ پاراستنت، ئامرازەکە لەم دۆخەدا کار ناکات. ناونیشانی <bdi>entekhab.net/swap/</bdi> ڕاستەوخۆ لە وێبگەڕەکەت بکەرەوە.</p>",
    "<p><strong>This page was opened inside another site's frame.</strong></p><p>For your safety the tool does not work this way. Open <bdi>entekhab.net/swap/</bdi> directly in your browser.</p>", "div")}</div>
<div class="sw-form s-on">{controls()}</div>
</div>
<div class="sw-info">
<section class="sw-warn"><h2>{tri("پیش از هر تبدیل", "پێش هەر گۆڕینەوەیەک", "Before every swap")}</h2>
{tri(
    "<ul><li>نشانی بالای مرورگر باید <bdi>entekhab.net</bdi> باشد.</li><li>عبارت بازیابی (۱۲ یا ۲۴ کلمه) و کلید خصوصی را هیچ‌جا وارد نکنید؛ این صفحه هرگز آن را نمی‌خواهد.</li><li>مبلغ، توکن و نشانی مقصد را در خودِ کیف پول بخوانید و بعد امضا کنید. تراکنش امضاشده برنمی‌گردد.</li><li>بار اول با مبلغ کم امتحان کنید.</li><li>برای توکنی که خودتان نشانی‌اش را وارد می‌کنید، نشانی را از منبع معتبر بگیرید؛ توکن جعلی با نام آشنا فراوان است.</li></ul>",
    "<ul><li>ناونیشانی سەرەوەی وێبگەڕ دەبێت <bdi>entekhab.net</bdi> بێت.</li><li>دەستەواژەی گەڕاندنەوە (١٢ یان ٢٤ وشە) و کلیلی تایبەت لە هیچ شوێنێک مەنووسە؛ ئەم پەڕەیە هەرگیز داوای ناکات.</li><li>بڕ، تۆکن و ناونیشانی مەبەست لەناو جزدانەکەتدا بخوێنەرەوە، ئینجا واژۆ بکە. مامەڵەی واژۆکراو ناگەڕێتەوە.</li><li>یەکەم جار بە بڕێکی کەم تاقی بکەرەوە.</li><li>بۆ تۆکنێک کە خۆت ناونیشانەکەی دەنووسیت، لە سەرچاوەیەکی متمانەپێکراو وەریبگرە؛ تۆکنی ساختە بە ناوی ناسراو زۆرن.</li></ul>",
    "<ul><li>The address bar must read <bdi>entekhab.net</bdi>.</li><li>Never type your recovery phrase (12 or 24 words) or a private key anywhere; this page never asks for it.</li><li>Read the amount, the token and the destination in your wallet itself, then sign. A signed transaction cannot be undone.</li><li>Try a small amount the first time.</li><li>If you paste a token address yourself, take it from a source you trust; fake tokens with familiar names are common.</li></ul>", "div")}</section>
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
    "<p>این صفحه هیچ شمارنده، ردیاب یا کد شخص ثالثی ندارد، تصویر توکن‌ها را هم از میزبان دیگری نمی‌گیرد و چیزی از شما ذخیره نمی‌کند. تنها ارتباط بیرونی‌اش با سرویس قیمت است؛ کیف پول شما از خود مرورگر صدا زده می‌شود، نه از شبکه. تراکنش‌ها روی بلاک‌چین عمومی‌اند.</p>",
    "<p>ئەم پەڕەیە هیچ ژمێرەر، شوێنپێهەڵگر یان کۆدی لایەنی سێیەمی نییە، وێنەی تۆکنەکانیش لە میوانداری تر وەرناگرێت و هیچ شتێک لە تۆ هەڵناگرێت. تەنیا پەیوەندیی دەرەکیی لەگەڵ خزمەتگوزاریی نرخە؛ جزدانەکەت لە خودی وێبگەڕەوە بانگ دەکرێت، نەک لە تۆڕەوە. مامەڵەکان لەسەر بلۆکچەین گشتین.</p>",
    "<p>This page has no counter, tracker or third-party code, does not fetch token pictures from another host, and stores nothing about you. Its only outside connection is to the price service; your wallet is reached through the browser itself, not over the network. Transactions are public on the blockchain.</p>", "div")}
{tri("این صفحه توصیهٔ سرمایه‌گذاری نیست.", "ئەم پەڕەیە ئامۆژگاریی وەبەرهێنان نییە.", "Nothing here is investment advice.", "p")}</section>
</div>
</main>
<script src="/assets/swap/swap.js" integrity="{sri('assets/swap/swap.js')}"></script>
</body>
</html>
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
