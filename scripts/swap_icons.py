#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The pictures of /swap/: one per network, one per token symbol — kept on this site.

A token's picture normally comes from whoever lists the token, which means the reader's browser asks a third-party
host for it and that host learns who is looking at what. /swap/ asks nobody: this script copies the pictures once,
from two public repositories on GitHub, into assets/swap/ic/, and the page's policy keeps img-src at 'self'.

  networks  LI.FI's own icons            github.com/lifinance/types    src/assets/icons/chains/<name>.svg
  tokens    Trust Wallet's asset list    github.com/trustwallet/assets blockchains/<chain>/assets/<address>/logo.png

An SVG is only kept if it carries no script, no event handler, no foreignObject and no outside reference (they are
shown through <img>, where none of that could run anyway — this is belt and braces). Token pictures are redrawn at
64×64 as WebP, so nothing of the original file's metadata comes along. A token nobody has a picture for gets a
letter badge drawn by the page; the chain's own coin falls back to the chain's icon.

Run by hand when scripts/swap_chains.json changes (it needs the network):  python3 scripts/swap_icons.py
The result is committed. scripts/build_swap.py only looks at which files exist.
"""
import io
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "swap", "ic")
RAW = "https://raw.githubusercontent.com"
ZERO = "0x" + "0" * 40

# chain id -> the file name of its icon in lifinance/types
CHAIN_ICON = {
    56: "bsc", 1: "ethereum", 16661: "0g", 2741: "abstract", 42161: "arbitrum", 43114: "avalanche", 8453: "base",
    25: "cronos", 99901: "elysium", 42793: "etherlink", 14: "flare", 747: "flow", 100: "gnosis", 999: "hyperevm",
    13371: "imx", 1776: "injective", 57073: "ink", 8217: "kaia", 747474: "katana", 59144: "linea", 5000: "mantle",
    4326: "megaeth", 1088: "metis", 143: "monad", 2818: "morph", 10: "optimism", 1672: "pharos", 137: "polygon",
    4663: "robinhood", 2020: "ronin", 534352: "scroll", 1868: "soneium", 146: "sonic", 40: "telo", 130: "unichain",
    1480: "vana", 88: "viction", 480: "world", 196: "xlayer", 324: "zksync",
}
# chain id -> its folder in trustwallet/assets (only the ones that repository has)
TW = {1: "ethereum", 56: "smartchain", 137: "polygon", 42161: "arbitrum", 10: "optimism", 8453: "base",
      43114: "avalanchec", 100: "xdai", 59144: "linea", 534352: "scroll", 324: "zksync", 5000: "mantle",
      146: "sonic", 25: "cronos", 2020: "ronin", 8217: "klaytn"}
# a bridged or renamed copy wears the picture of the asset it stands for
ALIAS = {"usdc-e": "usdc", "usdce": "usdc", "usdt-e": "usdt", "usdt0": "usdt", "weth-e": "weth", "wbnb": "bnb",
         "xdai": "dai"}
# symbols this page lists only on networks Trust Wallet has no folder for: their picture is taken from the asset's home
# network instead. A wrong entry here could only cost a picture (the page then draws a letter badge), never funds.
EXTRA = {"link": ("ethereum", "0x514910771AF9Ca656af840dff83E8264EcF986CA"),
         "cake": ("smartchain", "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"),
         "ape": ("ethereum", "0x4d224452801ACEd8B2F0aebE155379bb5D594381"),
         "weeth": ("ethereum", "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee"),
         "susde": ("ethereum", "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497"),
         "reth": ("ethereum", "0xae78736Cd615f374D3085123A210448E74Fc6393")}
BAD_SVG = re.compile(r"<script|\son[a-z]+\s*=|<foreignObject|javascript:|(?:href|src)\s*=\s*[\"']\s*(?:https?:)?//", re.I)


def key(symbol):
    """a token symbol as a safe file name: usd₮0 -> usdt0, USDC.e -> usdc-e"""
    s = symbol.lower().replace("₮", "t").replace(".", "-")
    return re.sub(r"[^a-z0-9-]", "", s)[:24]


def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "entekhab-icons"}), timeout=25) as r:
            return r.read() if r.status == 200 else None
    except Exception:  # noqa: BLE001
        return None


def webp(png):
    from PIL import Image
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    im.thumbnail((64, 64), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=82, method=6)
    return buf.getvalue()


def main():
    data = json.load(open(os.path.join(ROOT, "scripts", "swap_chains.json"), encoding="utf-8"))
    os.makedirs(os.path.join(OUT, "c"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "t"), exist_ok=True)
    got_c = got_t = 0
    for c in data["chains"]:
        dst = os.path.join(OUT, "c", f"{c['id']}.svg")
        if os.path.exists(dst):
            got_c += 1
            continue
        name = CHAIN_ICON.get(c["id"])
        raw = get(f"{RAW}/lifinance/types/main/src/assets/icons/chains/{name}.svg") if name else None
        if not raw or len(raw) > 60000 or BAD_SVG.search(raw.decode("utf-8", "replace")) or b"<svg" not in raw[:600]:
            print("  no icon for chain", c["id"], c["name"], "(bad, big or missing)")
            continue
        open(dst, "wb").write(raw)
        got_c += 1
    want = {}
    for cid, rows in data["tokens"].items():
        for t in rows:
            if t["address"] != ZERO:
                want.setdefault(key(t["symbol"]), []).append((int(cid), t["address"]))
    missing = []
    for k, places in sorted(want.items()):
        dst = os.path.join(OUT, "t", f"{k}.webp")
        if os.path.exists(dst):
            got_t += 1
            continue
        png = None
        for cid, addr in sorted(places, key=lambda p: (p[0] != 1, p[0] != 56, p[0])):
            if cid in TW:
                png = get(f"{RAW}/trustwallet/assets/master/blockchains/{TW[cid]}/assets/{addr}/logo.png")
                if png:
                    break
        if not png and k in EXTRA:
            png = get(f"{RAW}/trustwallet/assets/master/blockchains/{EXTRA[k][0]}/assets/{EXTRA[k][1]}/logo.png")
        if not png:
            missing.append(k)
            continue
        try:
            open(dst, "wb").write(webp(png))
            got_t += 1
        except Exception as ex:  # noqa: BLE001
            print("  could not redraw", k, ex)
    # the chain's own coin where Trust Wallet has one (the page falls back to the chain icon otherwise)
    for sym, folder in (("bnb", "smartchain"), ("eth", "ethereum"), ("pol", "polygon"), ("avax", "avalanchec")):
        dst = os.path.join(OUT, "t", f"{sym}.webp")
        if not os.path.exists(dst):
            png = get(f"{RAW}/trustwallet/assets/master/blockchains/{folder}/info/logo.png")
            if png:
                open(dst, "wb").write(webp(png))
    print(f"swap_icons: {got_c}/{len(data['chains'])} networks, {got_t}/{len(want)} token symbols; no picture: {' '.join(missing) or '-'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
