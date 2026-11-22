"""Who is on the other side of a large transfer.

The whale radar used to print raw addresses, which say nothing to a reader. This turns the ones that are publicly
known into a name -- "Binance 8", "Coinbase 10", "OFAC sanctioned" -- and leaves the rest alone.

The table is kept in the repository (data/whale_labels.json) rather than fetched while a page is built, so a page
never depends on someone else's server being up and every label can be read in a diff. Rebuild it deliberately:

    python3 scripts/whale_labels.py --refresh

Coverage is modest and that is the nature of the material: on a sample of real events about one address in ten is
publicly known. Most counterparties in a large transfer are private wallets that no free source has a name for.
An address with no entry keeps its raw form, which is the honest answer rather than a guess.
"""
import json, os, re, sys, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "whale_labels.json")

# Ethereum: Etherscan's public labels. A June 2023 snapshot, so it names long-lived wallets (the big exchanges keep
# theirs for years) and knows nothing newer.
ETH_SRC = ("https://raw.githubusercontent.com/brianleect/etherscan-labels/main/"
           "data/etherscan/combined/combinedAllLabels.json")
# Bitcoin: exchange wallets from DefiLlama plus the OFAC sanctions list. The same file also carries ~58k addresses
# for mixers that were seized years ago (Bitcoin Fog, Helix); those are left out -- they are most of the file and
# say nothing about the market today.
BTC_SRC = ("https://raw.githubusercontent.com/sorukumar/bitcoin-address-labels/main/"
           "data/03_publish/address_map.json")

CEX = {"binance", "coinbase", "kraken", "okx", "bitfinex", "bybit", "kucoin", "huobi", "gate-io", "crypto-com",
       "bitget", "mexc", "upbit", "bithumb", "gemini", "bitstamp", "robinhood", "deribit", "htx", "poloniex",
       "bitmex", "ftx", "exchange", "cex"}
CAT = {"bridge", "mev-bot", "mining", "staking", "dex", "blocked", "phish-hack", "heist"}
# a desk or fund worth naming even when Etherscan files it under no category of its own
ENTITY = ("binance", "coinbase", "kraken", "okx", "bitfinex", "bybit", "kucoin", "huobi", "gate", "crypto.com",
          "bitget", "mexc", "upbit", "bithumb", "gemini", "bitstamp", "robinhood", "deribit", "htx", "poloniex",
          "bitmex", "ftx", "wintermute", "jump", "alameda", "cumberland", "falconx", "galaxy", "grayscale",
          "tether", "circle", "bridge", "pool")
BTC_KEEP = {"exchange", "sanctioned", "hacker", "exchange, government"}
EVM = re.compile(r"^0[xX][0-9a-fA-F]{40}$")


FRAG = re.compile(r"\s*[:\-]?\s*0x[0-9a-fA-F]{3,}\s*\.{2,}\s*[0-9a-fA-F]+\s*$")


def _tidy(name):
    """Etherscan sometimes writes a wallet as "FalconX: 0x115...101"; the address fragment helps no reader."""
    return FRAG.sub("", name or "").strip(" :-")


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "entekhab.net whale labels"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode("utf-8"))


def refresh():
    table = {}
    eth = _get(ETH_SRC)
    for addr, v in eth.items():
        if not EVM.match(addr):
            continue
        labels = {str(x).lower() for x in v.get("labels", [])}
        name = (v.get("name") or "").strip()
        if labels & CEX:
            cat = "cex"
        elif labels & CAT:
            cat = sorted(labels & CAT)[0]
        elif any(h in name.lower() for h in ENTITY):
            cat = "entity"
        else:
            continue
        table[addr.lower()] = [_tidy(name) or sorted(labels)[0].title(), cat]
    n_eth = len(table)

    btc = _get(BTC_SRC)
    for addr, v in btc.items():
        cat = str(v.get("category", "")).strip().lower()
        if cat not in BTC_KEEP:
            continue
        name = str(v.get("entity", "")).strip()
        if not name:
            continue
        # base58 and bech32 are case-sensitive: a Bitcoin address is stored exactly as it is written
        table[addr] = [name, "sanctioned" if cat == "sanctioned" else "cex"]

    doc = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "sources": [ETH_SRC, BTC_SRC],
           "note": "Ethereum labels are an Etherscan snapshot; Bitcoin exchange wallets come from DefiLlama and the "
                   "sanctions entries from the OFAC SDN list. An address absent from this table is left as written.",
           "counts": {"ethereum": n_eth, "bitcoin": len(table) - n_eth, "total": len(table)},
           "a": dict(sorted(table.items()))}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    return doc


_cache = None


def table():
    """{address: [name, category]} -- empty when the file has not been built yet"""
    global _cache
    if _cache is None:
        try:
            with open(OUT, encoding="utf-8") as f:
                _cache = json.load(f).get("a", {})
        except Exception:
            _cache = {}
    return _cache


def look(addr):
    """(name, category) for an address, or (None, None). Ethereum ignores case, Bitcoin does not."""
    if not addr:
        return None, None
    t = table()
    hit = t.get(addr) or (t.get(addr.lower()) if EVM.match(addr or "") else None)
    return (hit[0], hit[1]) if hit else (None, None)


if __name__ == "__main__":
    if "--refresh" in sys.argv:
        d = refresh()
        print(f"wrote {OUT}: {d['counts']}")
    else:
        print(json.dumps({"loaded": len(table())}, indent=1))
