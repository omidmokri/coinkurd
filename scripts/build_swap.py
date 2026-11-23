#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
/swap/ — token swaps through Rango Exchange's own widget, on a page kept apart from the rest of the site.

Why apart: a page where people connect a wallet must run as little code as possible. So /swap/ does not carry the
site header, its scripts, the translation layers or any counter. It has one stylesheet, one script (assets/swap/swap.js,
pinned by its SHA-384) and one sandboxed frame to https://widget.rango.exchange/ — and a Content-Security-Policy that
allows exactly those. The wallet talks to the widget inside that frame; this site never sees a key or a transaction.

The settings live in scripts/swap_config.json and are checked here before they reach the page:

  enabled                  false → the page explains that swaps are not switched on yet and loads nothing from outside
  apiKey                   the production key Rango issued for entekhab.net (the key from Rango's documentation is refused)
  walletConnectProjectId   the owner's own WalletConnect project id (the one from the documentation is refused)
  affiliate.ref            the referral code made at app.rango.exchange/affiliate with the owner's own wallet
  affiliate.percent        the site's fee, 0 … 3 (Rango's ceiling); shown to the reader on the page as it is
  affiliate.wallets        optional {CHAIN: address}; EVM addresses must carry a correct EIP-55 checksum, so one wrong
                           character stops the build instead of sending the fees to nobody

Nothing here is a secret: all of these values are public by nature (they travel in the frame address). No private key,
seed phrase or password belongs in that file, and none is ever asked for.

The page is committed (like /charts/): python3 scripts/build_swap.py      Tests: tests/test_swap.py, tests/test_swap.js
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
OUT = os.path.join(ROOT, "swap", "index.html")
WIDGET = "https://widget.rango.exchange"
MAX_PERCENT = 3
TEST_VALUES = {"c6381a79-2817-4602-83bf-6a641a409e32", "e24844c5deb5193c1c14840a7af6a40b"}   # from Rango's documentation
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
HEX32 = re.compile(r"^[0-9a-f]{32}$")
REF = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
CHAIN = re.compile(r"^[A-Z][A-Z0-9_]{1,23}$")
EVM = re.compile(r"^0x[0-9a-fA-F]{40}$")
_B58 = "[1-9A-HJ-NP-Za-km-z]"
OTHER = {"SOLANA": re.compile(f"^{_B58}{{32,44}}$"), "TRON": re.compile(f"^T{_B58}{{33}}$")}
RANGO_LINK = '<a href="https://rango.exchange/" rel="noopener noreferrer" target="_blank">Rango Exchange</a>'
KEYS = {"enabled", "apiKey", "walletConnectProjectId", "affiliate"}
AFF_KEYS = {"ref", "percent", "wallets"}

# the one policy of this page. No 'unsafe-inline', no other host; frame-ancestors cannot be set from a <meta>, so
# assets/swap/swap.js refuses to start inside another site's frame.
CSP = ("default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; "
       f"frame-src {WIDGET}; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; "
       "require-trusted-types-for 'script'; upgrade-insecure-requests")


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
    """scripts/swap_config.json → the clean settings, or ConfigError saying what is wrong"""
    if not isinstance(raw, dict):
        raise ConfigError("the settings must be an object")
    extra = set(raw) - KEYS
    if extra:
        raise ConfigError(f"unknown setting(s): {', '.join(sorted(extra))}")     # apiUrl, custom RPCs … never get through
    if not isinstance(raw.get("enabled"), bool):
        raise ConfigError("enabled must be true or false")
    if not raw["enabled"]:
        return {"enabled": False}
    key, wc = raw.get("apiKey"), raw.get("walletConnectProjectId")
    if not isinstance(key, str) or not UUID.match(key):
        raise ConfigError("apiKey is not a Rango key (lower-case UUID)")
    if not isinstance(wc, str) or not HEX32.match(wc):
        raise ConfigError("walletConnectProjectId is not a WalletConnect project id (32 hex characters)")
    if key in TEST_VALUES or wc in TEST_VALUES:
        raise ConfigError("that is the test key from Rango's documentation; the live page needs the owner's own")
    out = {"enabled": True, "apiKey": key, "walletConnectProjectId": wc}
    a = raw.get("affiliate")
    if a is None:
        return out
    if not isinstance(a, dict) or set(a) - AFF_KEYS:
        raise ConfigError("affiliate takes ref, percent and wallets only")
    ref, pct, ws = a.get("ref", ""), a.get("percent", 0), a.get("wallets", {})
    if not isinstance(ref, str) or (ref and not REF.match(ref)):
        raise ConfigError("affiliate.ref is not a referral code")
    if isinstance(pct, bool) or not isinstance(pct, (int, float)) or not 0 <= pct <= MAX_PERCENT:
        raise ConfigError(f"affiliate.percent must be between 0 and {MAX_PERCENT}")
    if not isinstance(ws, dict):
        raise ConfigError("affiliate.wallets must be an object of CHAIN: address")
    for chain, addr in ws.items():
        if not CHAIN.match(chain) or not isinstance(addr, str):
            raise ConfigError(f"affiliate.wallets: bad entry {chain!r}")
        if chain in OTHER:
            if not OTHER[chain].match(addr):
                raise ConfigError(f"affiliate.wallets.{chain}: not a {chain} address")
        elif not EVM.match(addr):
            raise ConfigError(f"affiliate.wallets.{chain}: not an EVM address")
        elif addr != eip55(addr):
            raise ConfigError(f"affiliate.wallets.{chain}: the EIP-55 checksum does not match — copy the address again from the wallet")
    if (pct > 0 or ws) and not ref:
        raise ConfigError("a fee or a wallet without affiliate.ref has nobody to be credited to")
    if ref:
        out["affiliate"] = {"ref": ref, "percent": pct, "wallets": dict(sorted(ws.items()))}
    return out


def load(path=CONFIG):
    with open(path, encoding="utf-8") as f:
        return check(json.load(f))


def percent(cfg):
    return (cfg.get("affiliate") or {}).get("percent", 0) if cfg.get("enabled") else 0


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
        return ""                      # nothing is charged or promised while swaps are off
    p = percent(cfg)
    if p > 0:
        return tri(
            f"کارمزد انتخاب: <b><bdi>{_n(p, 'fa')}٪</bdi></b> از مبلغ هر تبدیل. همهٔ آن صرف کاشت بذر و نهال در زاگرس می‌شود.",
            f"کرێی ئینتیخاب: <b><bdi>٪{_n(p, 'ckb')}</bdi></b> لە بڕی هەر گۆڕینەوەیەک. هەمووی بۆ چاندنی تۆو و نەمام لە زاگرۆس خەرج دەکرێت.",
            f"Entekhab's fee: <b><bdi>{_n(p, 'en')}%</bdi></b> of each swap. All of it goes to planting seeds and saplings in the Zagros.", "p")
    return tri("انتخاب از این تبدیل‌ها کارمزدی نمی‌گیرد.", "ئینتیخاب لەم گۆڕینەوانە هیچ کرێیەک وەرناگرێت.",
               "Entekhab takes no fee on these swaps.", "p")


def page(cfg):
    on = bool(cfg.get("enabled"))
    public = {k: cfg[k] for k in ("enabled", "apiKey", "walletConnectProjectId", "affiliate") if k in cfg}
    data = html.escape(json.dumps(public, ensure_ascii=True, separators=(",", ":"), sort_keys=True), quote=True)
    title = "تبدیل رمزارز (سواپ) بین شبکه‌ها | entekhab.net"
    desc = ("تبدیل غیرامانی رمزارز بین بایننس اسمارت چین، اتریوم، ترون، سولانا و ده‌ها شبکهٔ دیگر با ویجت رنگو؛ "
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
<small>{tri("بین شبکه‌ها، از کیف پول خودتان، با مسیریاب رنگو", "لە نێوان تۆڕەکان، لە جزدانی خۆتەوە، بە ڕێدۆزەری ڕەنگۆ", "Across chains, from your own wallet, routed by Rango")}</small></h1>
<div id="sw-box" data-c="{data}">
<div class="sw-note s-none">{tri("<p>این بخش برای نمایش ویجت تبدیل به جاوااسکریپت نیاز دارد.</p>", "<p>ئەم بەشە بۆ پیشاندانی ویجێتی گۆڕینەوە پێویستی بە جاڤاسکریپتە.</p>", "<p>This part needs JavaScript to show the swap widget.</p>", "div")}</div>
<div class="sw-note s-off">{tri(
    "<p><strong>تبدیل هنوز فعال نشده است.</strong></p><p>این صفحه آماده است و پس از دریافت کلید رسمی از رنگو روشن می‌شود. تا آن زمان هیچ چیزی از بیرونِ این سایت در این صفحه بارگذاری نمی‌شود.</p>",
    "<p><strong>گۆڕینەوە هێشتا چالاک نەکراوە.</strong></p><p>ئەم پەڕەیە ئامادەیە و دوای وەرگرتنی کلیلی فەرمی لە ڕەنگۆ دەکرێتەوە. تا ئەو کاتە هیچ شتێک لە دەرەوەی ئەم ماڵپەڕە لەم پەڕەیەدا بار ناکرێت.</p>",
    "<p><strong>Swaps are not switched on yet.</strong></p><p>This page is ready and goes live once Rango issues the production key. Until then nothing from outside this site is loaded here.</p>", "div")}</div>
<div class="sw-note s-framed">{tri(
    "<p><strong>این صفحه درون قاب یک سایت دیگر باز شده است.</strong></p><p>برای امنیت شما ویجت در این حالت بارگذاری نمی‌شود. نشانی <bdi>entekhab.net/swap/</bdi> را مستقیم در مرورگر باز کنید.</p>",
    "<p><strong>ئەم پەڕەیە لەناو چوارچێوەی ماڵپەڕێکی تردا کراوەتەوە.</strong></p><p>بۆ پاراستنت، ویجێت لەم دۆخەدا بار ناکرێت. ناونیشانی <bdi>entekhab.net/swap/</bdi> ڕاستەوخۆ لە وێبگەڕەکەت بکەرەوە.</p>",
    "<p><strong>This page was opened inside another site's frame.</strong></p><p>For your safety the widget does not load this way. Open <bdi>entekhab.net/swap/</bdi> directly in your browser.</p>", "div")}</div>
</div>
<div class="sw-info">
<section class="sw-warn"><h2>{tri("پیش از هر تبدیل", "پێش هەر گۆڕینەوەیەک", "Before every swap")}</h2>
{tri(
    "<ul><li>نشانی بالای مرورگر باید <bdi>entekhab.net</bdi> باشد.</li><li>عبارت بازیابی (۱۲ یا ۲۴ کلمه) و کلید خصوصی را هیچ‌جا وارد نکنید؛ نه این صفحه و نه ویجت هرگز آن را نمی‌خواهند.</li><li>مبلغ، توکن و نشانی مقصد را در خودِ کیف پول بخوانید و بعد امضا کنید. تراکنش امضاشده برنمی‌گردد.</li><li>بار اول با مبلغ کم امتحان کنید.</li></ul>",
    "<ul><li>ناونیشانی سەرەوەی وێبگەڕ دەبێت <bdi>entekhab.net</bdi> بێت.</li><li>دەستەواژەی گەڕاندنەوە (١٢ یان ٢٤ وشە) و کلیلی تایبەت لە هیچ شوێنێک مەنووسە؛ نە ئەم پەڕەیە و نە ویجێتەکە هەرگیز داوای ناکەن.</li><li>بڕ، تۆکن و ناونیشانی مەبەست لەناو جزدانەکەتدا بخوێنەرەوە، ئینجا واژۆ بکە. مامەڵەی واژۆکراو ناگەڕێتەوە.</li><li>یەکەم جار بە بڕێکی کەم تاقی بکەرەوە.</li></ul>",
    "<ul><li>The address bar must read <bdi>entekhab.net</bdi>.</li><li>Never type your recovery phrase (12 or 24 words) or a private key anywhere; neither this page nor the widget ever asks for it.</li><li>Read the amount, the token and the destination in your wallet itself, then sign. A signed transaction cannot be undone.</li><li>Try a small amount the first time.</li></ul>", "div")}</section>
<section><h2>{tri("چه کسی چه کاری می‌کند", "کێ چی دەکات", "Who does what")}</h2>
{tri(
    "<p>تبدیل را %RANGO% مسیریابی می‌کند و صرافی‌های غیرمتمرکز و پل‌های خودِ شبکه‌ها انجامش می‌دهند. دارایی از کیف پول شما مستقیم به قرارداد می‌رود و برمی‌گردد؛ انتخاب هیچ‌وقت آن را نگه نمی‌دارد و به کلید شما دسترسی ندارد.</p><p>این سرویس از آنِ رنگو است و شرایط استفادهٔ خود رنگو بر آن حاکم است؛ دسترس‌پذیری‌اش در هر منطقه را هم رنگو و تأمین‌کنندگان نقدینگی تعیین می‌کنند، نه این سایت.</p>",
    "<p>گۆڕینەوەکە %RANGO% ڕێدۆزی دەکات و ئاڵوگۆڕگە نامەرکەزییەکان و پردەکانی تۆڕەکان خۆیان جێبەجێی دەکەن. دارایی لە جزدانی تۆوە ڕاستەوخۆ دەچێتە گرێبەست و دەگەڕێتەوە؛ ئینتیخاب هەرگیز هەڵیناگرێت و دەستی بە کلیلەکەت ناگات.</p><p>ئەم خزمەتگوزارییە هی ڕەنگۆیە و مەرجەکانی بەکارهێنانی ڕەنگۆ خۆی بەسەریدا جێبەجێ دەبن؛ بەردەستبوونی لە هەر ناوچەیەکیش ڕەنگۆ و دابینکەرانی نەختینەیی دیاری دەکەن، نەک ئەم ماڵپەڕە.</p>",
    "<p>The swap is routed by %RANGO% and carried out by the decentralised exchanges and bridges of the networks themselves. Your assets go from your wallet straight to the contract and back; Entekhab never holds them and has no access to your keys.</p><p>The service is Rango's and Rango's own terms of use apply to it; where it is available is decided by Rango and the liquidity providers, not by this site.</p>", "div")}</section>
<section class="sw-fee"><h2>{tri("کارمزد", "کرێ", "Fees")}</h2>
{fee_block(cfg)}
{tri("کارمزد خود رنگو، کارمزد شبکه و مبلغ دقیق دریافتی، پیش از تأیید در ویجت نشان داده می‌شود.",
     "کرێی ڕەنگۆ خۆی، کرێی تۆڕ و بڕی وردی وەرگیراو، پێش پشتڕاستکردنەوە لە ویجێتەکەدا پیشان دەدرێت.",
     "Rango's own fee, the network fee and the exact amount you receive are shown in the widget before you confirm.", "p")}</section>
<section><h2>{tri("حریم خصوصی", "تایبەتمەندی", "Privacy")}</h2>
{tri(
    "<p>این صفحه هیچ شمارنده، ردیاب یا کد شخص ثالثی ندارد و چیزی از شما ذخیره یا ارسال نمی‌کند. ویجت در قابی جدا و از سرور رنگو بارگذاری می‌شود؛ رنگو، کیف پول شما و شبکه‌ها مثل هر سرویس اینترنتی دیگر درخواست‌های شما را می‌بینند و تراکنش‌ها روی بلاک‌چین عمومی‌اند.</p>",
    "<p>ئەم پەڕەیە هیچ ژمێرەر، شوێنپێهەڵگر یان کۆدی لایەنی سێیەمی نییە و هیچ شتێک لە تۆ هەڵناگرێت یان نانێرێت. ویجێتەکە لە چوارچێوەیەکی جیادا و لە ڕاژەکاری ڕەنگۆوە بار دەکرێت؛ ڕەنگۆ، جزدانەکەت و تۆڕەکان وەک هەر خزمەتگوزارییەکی تری ئینتەرنێت داواکارییەکانت دەبینن و مامەڵەکان لەسەر بلۆکچەین گشتین.</p>",
    "<p>This page has no counter, tracker or third-party code, and stores or sends nothing about you. The widget loads in a separate frame from Rango's server; Rango, your wallet and the networks see your requests as any internet service does, and transactions are public on the blockchain.</p>", "div")}
{tri("این صفحه توصیهٔ سرمایه‌گذاری نیست.", "ئەم پەڕەیە ئامۆژگاریی وەبەرهێنان نییە.", "Nothing here is investment advice.", "p")}</section>
</div>
</main>
<script src="/assets/swap/swap.js" integrity="{sri('assets/swap/swap.js')}"></script>
</body>
</html>
"""
    return doc.replace("%RANGO%", RANGO_LINK)


def nav_on():
    """True once swaps are switched on: only then does the site menu (and with it the bot and the extension) list /swap/"""
    try:
        return bool(load().get("enabled"))
    except Exception:  # noqa: BLE001
        return False


def main():
    try:
        cfg = load()
    except ConfigError as ex:
        print("build_swap: scripts/swap_config.json —", ex, file=sys.stderr)
        return 1
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(page(cfg))
    print("build_swap: /swap/ written —", "ON" if cfg["enabled"] else "off (waiting for the owner's keys)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
