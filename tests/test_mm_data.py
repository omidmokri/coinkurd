#!/usr/bin/env python3
"""Tests for scripts/mm_data.py on fixtures in the sources' real formats (no network).

Formats were read from the live APIs on 2026-11-12: CoinGecko /coins/markets (sparkline + 1h,24h,7d,30d,1y), Binance
/api/v3/klines (12 fields, field 7 = quote volume, field 10 = taker-buy quote volume), /ticker/price, /ticker/bookTicker,
/depth, DefiLlama /stablecoins and /stablecoincharts/all.  Every expected number below is worked out by hand.
Run: python3 tests/test_mm_data.py
"""
import json
import os
import re
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "scripts"))
import mm_data as M  # noqa: E402

FAIL = []


def check(name, got, want):
    if got != want:
        FAIL.append(f"{name}: got {got!r}, want {want!r}")


def approx(name, got, want, tol=1e-9):
    if got is None or abs(got - want) > tol:
        FAIL.append(f"{name}: got {got!r}, want ≈{want!r}")


# ---------------------------------------------------------------- fixtures in the real formats
def cg_coin(cid, sym, name, rank, price, mcap, ch=(0.1, -3.5, -5.9, -13.8, -29.2), spark=None):
    return {"id": cid, "symbol": sym.lower(), "name": name, "image": f"https://coin-images.coingecko.com/coins/images/{rank}/large/{cid}.png?1",
            "current_price": price, "market_cap": mcap, "market_cap_rank": rank, "fully_diluted_valuation": mcap * 1.05,
            "total_volume": mcap / 50, "high_24h": price * 1.02, "low_24h": price * 0.97, "price_change_24h": -price * 0.035,
            "price_change_percentage_24h": ch[1], "market_cap_change_24h": 0, "market_cap_change_percentage_24h": ch[1],
            "circulating_supply": mcap / price, "total_supply": mcap / price, "max_supply": None, "ath": price * 2, "ath_change_percentage": -50,
            "ath_date": "2025-10-06T10:57:42.000Z", "atl": price / 100, "atl_change_percentage": 9900, "atl_date": "2013-07-05T16:00:00.000Z",
            "roi": None, "last_updated": "2026-11-12T18:18:39.000Z", "sparkline_in_7d": {"price": spark or [price * (1 + 0.001 * i) for i in range(168)]},
            "price_change_percentage_1h_in_currency": ch[0], "price_change_percentage_1y_in_currency": ch[4],
            "price_change_percentage_24h_in_currency": ch[1], "price_change_percentage_30d_in_currency": ch[3],
            "price_change_percentage_7d_in_currency": ch[2]}


MARKETS = [
    cg_coin("bitcoin", "btc", "Bitcoin", 1, 148.0, 1_444_771_555_820),        # Binance price below is 148 → same coin
    cg_coin("ethereum", "eth", "Ethereum", 2, 2018.7, 246_710_000_000),
    cg_coin("tether", "usdt", "Tether", 3, 1.0, 175_655_097_676, ch=(0, 0, 0.01, 0, 0.05)),
    cg_coin("staked-ether", "steth", "Lido Staked Ether", 9, 2018.0, 19_670_000_000),
    cg_coin("dogecoin", "doge", "Dogecoin", 11, 0.0661, 10_360_000_000),
    cg_coin("leo-token", "leo", "LEO Token", 13, 9.24, 8_440_000_000),           # not on Binance
    cg_coin("fakecoin", "fake", "Fake Coin", 40, 2.0, 1_000_000_000),            # Binance FAKEUSDT is a different coin (price 9)
    cg_coin("nologo", "nolo", "No Logo", 41, 1.0, 900_000_000),                  # no logo anywhere → never on the map
    cg_coin("dogecoin-dup", "doge", "Doge Copy", 120, 0.5, 10_000_000),          # duplicate ticker → the larger one wins
]
CATS = {"stablecoins": ["tether"], "liquid-staking-tokens": ["staked-ether"], "meme-token": ["dogecoin", "dogecoin-dup"],
        "layer-1": ["ethereum", "bitcoin"], "exchange-based-tokens": ["leo-token"]}


def kl(n, o0, step, qv, tb, close_add):
    """n klines in Binance's 12-field format; bar i: open o0+i·step, close open+close_add"""
    rows = []
    for i in range(n):
        o = o0 + i * step
        rows.append([1794500000000 + i * 300000, f"{o:.8f}", f"{o + 2:.8f}", f"{o - 1:.8f}", f"{o + close_add:.8f}", "10.0",
                     1794500299999 + i * 300000, f"{qv:.8f}", 100, "5.0", f"{tb:.8f}", "0"])
    return rows


BOOK = {"lastUpdateId": 1, "bids": [["99.5", "10"], ["99.0", "10"], ["98.5", "10"], ["97.0", "10"]],
        "asks": [["100.5", "10"], ["101.0", "10"], ["101.5", "10"], ["103.0", "10"]]}

LLAMA_ST = {"peggedAssets": [
    {"id": "1", "name": "Tether", "symbol": "USDT", "gecko_id": "tether", "pegType": "peggedUSD", "priceSource": "x", "pegMechanism": "fiat-backed",
     "circulating": {"peggedUSD": 175_655_097_676.34}, "circulatingPrevDay": {"peggedUSD": 175_737_884_800.92},
     "circulatingPrevWeek": {"peggedUSD": 177_725_878_454.88}, "circulatingPrevMonth": {"peggedUSD": 183_971_963_905.42},
     "chainCirculating": {}, "chains": ["Tron", "Ethereum", "BSC", "Solana", "Plasma"], "price": None},
    {"id": "2", "name": "USD Coin", "symbol": "USDC", "gecko_id": "usd-coin", "pegType": "peggedUSD", "priceSource": "x", "pegMechanism": "fiat-backed",
     "circulating": {"peggedUSD": 69_500_000_000}, "circulatingPrevDay": {"peggedUSD": 69_000_000_000},
     "circulatingPrevWeek": {"peggedUSD": 70_000_000_000}, "circulatingPrevMonth": {"peggedUSD": 68_000_000_000},
     "chainCirculating": {}, "chains": ["Ethereum", "Solana"], "price": None},
    {"id": "3", "name": "Euro Coin", "symbol": "EURC", "gecko_id": "euro-coin", "pegType": "peggedEUR", "priceSource": "x", "pegMechanism": "fiat-backed",
     "circulating": {"peggedEUR": 200_000_000}, "circulatingPrevDay": {"peggedEUR": 1}, "circulatingPrevWeek": {}, "circulatingPrevMonth": {},
     "chainCirculating": {}, "chains": ["Ethereum"], "price": None},
], "chains": []}
LLAMA_HIST = [{"date": str(1794441600 - 86400 * (59 - i)), "totalCirculating": {"peggedUSD": 2.8e11 + i * 1e8, "peggedEUR": 1e9},
               "totalUnreleased": {"peggedUSD": 1}, "totalCirculatingUSD": {"peggedUSD": 2.8e11 + i * 1e8, "peggedEUR": 1.1e9}} for i in range(60)]


class FakeNet:
    def __init__(self):
        self.calls = 0
        self.log = []

    def get(self, url, params=None, timeout=30):
        self.calls += 1
        p = params or {}
        self.log.append((url, dict(p)))
        if url.endswith("/coins/markets"):
            if "category" in p:
                ids = CATS.get(p["category"], [])
                return [{"id": i, "symbol": "x", "name": i} for i in ids]
            return MARKETS
        if url.endswith("/ticker/price"):
            return [{"symbol": "BTCUSDT", "price": "148.00000000"}, {"symbol": "ETHUSDT", "price": "2020.10000000"},
                    {"symbol": "DOGEUSDT", "price": "0.06600000"}, {"symbol": "FAKEUSDT", "price": "9.00000000"},
                    {"symbol": "STETHUSDT", "price": "2018.00000000"}, {"symbol": "USDTDAI", "price": "1.0"}]
        if url.endswith("/klines"):
            iv, lim = p["interval"], p["limit"]
            if iv == "5m":
                return kl(lim, 100, 1, 1000, 600, 1)          # bar i: open 100+i, close 101+i
            if iv == "1h":
                return kl(lim, 1000, 1, 2000, 900, 0.5)       # open 1000+i, close 1000.5+i
            if iv == "1d":
                return kl(lim, 50, 0, 10000, 5500, 0)
            if iv == "1w":
                return kl(lim, 50, 0, 100000, 40000, 0)
        if url.endswith("/ticker/bookTicker"):
            return [{"symbol": "BTCUSDT", "bidPrice": "99.99000000", "bidQty": "2.00000000", "askPrice": "100.01000000", "askQty": "3.00000000"},
                    {"symbol": "ETHUSDT", "bidPrice": "2020.00000000", "bidQty": "1.0", "askPrice": "2020.10000000", "askQty": "1.0"}]
        if url.endswith("/depth"):
            return BOOK
        if url.endswith("/stablecoins"):
            return LLAMA_ST
        if url.endswith("/stablecoincharts/all"):
            return LLAMA_HIST
        raise RuntimeError("unexpected url " + url)

    def raw(self, url, timeout=30):
        raise RuntimeError("no downloads in the test")


def png(path, color, flat=False, size=50):
    """a small logo-like picture: a coloured disc with a white mark (flat=True: one colour, like a placeholder)"""
    from PIL import Image, ImageDraw
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0) if not flat else color)
    if not flat:
        d = ImageDraw.Draw(im)
        d.ellipse((1, 1, size - 2, size - 2), fill=color)
        d.rectangle((size // 3, size // 3, size // 2, 2 * size // 3), fill=(255, 255, 255, 255))
    im.save(path)


def main():
    # ---------- pure helpers
    check("sig 6", M.sig(71839.123456), 71839.1)
    check("sig small", M.sig(0.00000435123456), 4.35123e-06)
    check("sig int", M.sig(1444771555820), 1444770000000)
    check("pct", M.pct(148, 100), 48.0)
    check("pct none", M.pct(0, 100), None)
    bars = M.kl_parse(kl(48, 100, 1, 1000, 600, 1))
    check("window 5m", M.window(bars, 1), (round((148 / 147 - 1) * 100, 2), 200, 1000))
    check("window 15m", M.window(bars, 3), (round((148 / 145 - 1) * 100, 2), 600, 3000))
    check("window 1h", M.window(bars, 12), (round((148 / 136 - 1) * 100, 2), 2400, 12000))
    check("window 4h", M.window(bars, 48), (48.0, 9600, 48000))
    check("window short", M.window(bars, 49), (None, None, None))
    check("kl_parse bad row", M.kl_parse([[1, "x"]]), [])
    d = M.depth_bands(BOOK, 100.0)
    check("depth", d, {"b1": 1985, "a1": 2015, "b2": 2970, "a2": 3030, "rng": 3.0})
    sp = M.spark([10 + i for i in range(168)])
    check("spark ends", (sp[0], sp[1], sp[2][0], sp[2][-1], len(sp[2])), (10, 177, 0, 99, M.SPARK_N))
    check("spark flat", M.spark([5] * 20)[2][:3], [50, 50, 50])
    check("spark short", M.spark([1, 2]), None)
    cats = {c: {"ids": ids} for c, ids in CATS.items()}
    check("sector btc", M.sector_of("bitcoin", "BTC", "Bitcoin", cats), "btc")
    check("sector l1", M.sector_of("ethereum", "ETH", "Ethereum", cats), "l1")
    check("sector stable", M.sector_of("tether", "USDT", "Tether", cats), "stable")
    check("sector wrapped (category)", M.sector_of("staked-ether", "STETH", "Lido Staked Ether", cats), "wrapped")
    check("sector wrapped (name)", M.sector_of("wrapped-x", "WX", "Wrapped X", {}), "wrapped")
    check("sector meme", M.sector_of("dogecoin", "DOGE", "Dogecoin", cats), "meme")
    check("sector exch", M.sector_of("leo-token", "LEO", "LEO Token", cats), "exch")
    check("sector other", M.sector_of("x", "X", "Something", cats), "other")
    check("meme beats l1", M.sector_of("dual", "D", "Dual", {"layer-1": {"ids": ["dual"]}, "meme-token": {"ids": ["dual"]}}), "meme")

    # ---------- the whole run on fixtures, in a scratch copy of the folders
    tmp = tempfile.mkdtemp()
    try:
        for k in ("DATA", "LOGOS", "ART3D", "ART_GLOSSY"):
            os.makedirs(os.path.join(tmp, k), exist_ok=True)
        M.DATA, M.LOGOS, M.ART3D, M.ART_GLOSSY = (os.path.join(tmp, k) for k in ("DATA", "LOGOS", "ART3D", "ART_GLOSSY"))
        for s in ("BTC", "ETH", "USDT", "STETH", "DOGE", "LEO", "FAKE"):
            png(os.path.join(M.LOGOS, s + ".png"), (200, 100, 20, 255))
        png(os.path.join(M.ART3D, "BTC.png"), (247, 147, 26, 255))
        json.dump({"global": {"mcap": 2.4e12, "vol": 7e10, "btc_d": 59.6, "eth_d": 10.1, "stable_d": 10.1, "mcap_chg24": -5.4},
                   "fng": {"value": 28, "class": "Fear"}, "coins": [{"coin": "BTC"}, {"coin": "ETH"}]}, open(os.path.join(M.DATA, "market.json"), "w"))
        json.dump([{"id": 1, "coins": ["DOGE"]}], open(os.path.join(M.DATA, "posts.json"), "w"))
        json.dump({"coins": {"BTC": {}, "ETH": {}}}, open(os.path.join(M.DATA, "dna.json"), "w"))
        M.MIN_COINS = 5
        cache = {}
        net = FakeNet()
        slept = []
        mm, fl = M.build(net, cache, sleep=slept.append, workers=2)
        cc = {c["s"]: c for c in mm["c"]}
        check("on map", sorted(cc), ["BTC", "DOGE", "ETH", "FAKE", "LEO", "STETH", "USDT"])
        check("duplicate ticker keeps the larger", cc["DOGE"]["id"], "dogecoin")
        check("a cold cache fills a few categories per run", sum(1 for u, p in net.log if "category" in p), M.CAT_COLD)
        check("gap between coingecko calls", all(s == M.CAT_GAP for s in slept), True)
        check("binance mapping", {s: c.get("bn") for s, c in cc.items()},
              {"BTC": "BTCUSDT", "ETH": "ETHUSDT", "USDT": None, "STETH": "STETHUSDT", "DOGE": "DOGEUSDT", "LEO": None, "FAKE": None})
        check("cold cache: the first six categories already sort these", {s: cc[s]["sec"] for s in ("BTC", "USDT", "STETH", "DOGE")},
              {"BTC": "btc", "USDT": "stable", "STETH": "wrapped", "DOGE": "meme"})
        i = {tf: k for k, tf in enumerate(M.TFS)}
        btc = cc["BTC"]["ch"]
        check("btc 5m from klines", btc[i["5m"]], round((148 / 147 - 1) * 100, 2))
        check("btc 4h from klines", btc[i["4h"]], 48.0)
        check("btc 1d from 1h klines", btc[i["1d"]], round((1167.5 / 1144 - 1) * 100, 2))
        check("btc 7d from coingecko", btc[i["7d"]], -5.9)
        check("btc 30d from coingecko", btc[i["30d"]], -13.8)
        check("btc 1y from coingecko", btc[i["1y"]], -29.2)
        check("leo has no 5m (not on binance)", cc["LEO"]["ch"][i["5m"]], None)
        check("leo 1h from coingecko", cc["LEO"]["ch"][i["1h"]], 0.1)
        f = fl["f"]["BTC"]
        check("flow 5m", f["5m"], [200, 1000])
        check("flow 1h", f["1h"], [2400, 12000])
        check("flow 4h", f["4h"], [9600, 48000])
        check("flow 1d", f["1d"], [-4800, 48000])
        check("flow 7d", f["7d"], [-33600, 336000])
        check("flow 30d", f["30d"], [30000, 300000])
        check("flow 1y", f["1y"], [-1040000, 5200000])
        check("no flow for wrapped", "5m" in fl["f"].get("STETH", {}), False)
        check("spread btc", f["bk"], [2.0, round(99.99 * 2), round(100.01 * 3)])
        check("depth btc", {k: v for k, v in f["dp"].items() if k != "t"}, {"b1": 1985, "a1": 2015, "b2": 2970, "a2": 3030, "rng": 3.0})
        check("pages", (cc["BTC"].get("ek"), cc["BTC"].get("pg"), cc["DOGE"].get("pg"), cc["LEO"].get("pg")), (1, 1, 1, None))
        check("dna pages", (cc["BTC"].get("dn"), cc["DOGE"].get("dn")), (1, None))
        st = fl["st"]
        check("stable total", st["tot"], round(175_655_097_676.34 + 69_500_000_000))
        check("stable d1", st["d1"], round((175_655_097_676.34 - 175_737_884_800.92) + (69_500_000_000 - 69_000_000_000)))
        check("stable d30", st["d30"], round((175_655_097_676.34 - 183_971_963_905.42) + (69_500_000_000 - 68_000_000_000)))
        check("stable usd only", [r["s"] for r in st["top"]], ["USDT", "USDC"])
        check("stable history", (len(st["hist"]), st["hist"][-1]), (60, [1794441600, round(2.8e11 + 59e8)]))
        check("global", mm["g"]["btc_d"], 59.6)
        check("fng", mm["fng"], {"v": 28, "k": "Fear"})
        check("no logo url leaks into the output", any("img" in c for c in mm["c"]), False)
        a = json.load(open(os.path.join(M.LOGOS, "atlas.json")))
        check("atlas (wrapped tokens load their own file)", (a["n"], sorted(a["i"]), a["cell"]), (6, ["BTC", "DOGE", "ETH", "FAKE", "LEO", "USDT"], 48))
        check("atlas file named by its content hash", bool(re.fullmatch(r"atlas-[0-9a-f]{12}\.webp", a.get("img", ""))) and os.path.exists(os.path.join(M.LOGOS, a["img"])), True)
        mt = os.path.getmtime(os.path.join(M.LOGOS, a["img"]))
        meta2, changed = M.build_atlas(list(a["i"]))
        check("atlas not rewritten when nothing changed", (changed, os.path.getmtime(os.path.join(M.LOGOS, a["img"])) == mt), (False, True))
        png(os.path.join(M.LOGOS, "DOGE.png"), (10, 200, 10, 255))
        meta3, changed = M.build_atlas(list(a["i"]))
        check("atlas rewritten when a logo changed", changed, True)
        check("a changed atlas gets a new file name", meta3["img"] != a["img"], True)
        png(os.path.join(M.LOGOS, "ETH.png"), (10, 10, 200, 255))
        meta4, _ = M.build_atlas(list(a["i"]))
        sheets = sorted(f for f in os.listdir(M.LOGOS) if f.startswith("atlas-"))
        check("only the current and the previous sheet are kept", sheets, sorted([meta3["img"], meta4["img"]]))
        # logo checks: a placeholder is not a logo, and a placeholder offered by the source is refused
        png(os.path.join(tmp, "flat.png"), (90, 90, 90, 255), flat=True)
        png(os.path.join(tmp, "tiny.png"), (200, 10, 10, 255), size=10)
        check("flat picture is not a logo", M.logo_ok(os.path.join(tmp, "flat.png")), False)
        check("tiny picture is not a logo", M.logo_ok(os.path.join(tmp, "tiny.png")), False)
        check("a disc with a mark is a logo", M.logo_ok(os.path.join(M.LOGOS, "BTC.png")), True)
        png(os.path.join(M.LOGOS, "NOLO.png"), (90, 90, 90, 255), flat=True)       # an old placeholder in the folder
        check("placeholder file does not count", "NOLO" in M.logo_have(), False)

        class Dl(FakeNet):
            def raw(self, url, timeout=30):
                import io as _io
                from PIL import Image as _I, ImageDraw as _D
                im = _I.new("RGBA", (50, 50), (0, 0, 0, 0))
                _D.Draw(im).ellipse((2, 2, 47, 47), fill=(30, 120, 220, 255))
                _D.Draw(im).rectangle((20, 15, 30, 35), fill=(255, 255, 255, 255))
                b = _io.BytesIO()
                im.save(b, "PNG")
                self.got = getattr(self, "got", []) + [url]
                return b.getvalue()
        dl = Dl()
        have = M.logo_have()
        n = M.fetch_logos(dl, [{"s": "NOLO", "img": "https://x/coins/images/1/large/nolo.png"},
                               {"s": "MISS", "img": "https://x/coins/images/2/large/missing_large.png"}], have)
        check("placeholder replaced by the real logo, missing refused", (n, "NOLO" in have, "MISS" in have, dl.got), (1, True, False, ["https://x/coins/images/1/small/nolo.png"]))
        # the second run refreshes only the two stalest categories
        net2 = FakeNet()
        M.build(net2, cache, sleep=lambda s: None, workers=2)
        check("still cold: the next missing ones", sum(1 for u, p in net2.log if "category" in p), M.CAT_COLD)
        for _ in range(3):
            M.build(FakeNet(), cache, sleep=lambda s: None, workers=2)
        check("cache full", sorted(cache["cats"]) == sorted(set(M.CATS)), True)
        net3 = FakeNet()
        M.build(net3, cache, sleep=lambda s: None, workers=2)
        check("warm cache: two categories per run", sum(1 for u, p in net3.log if "category" in p), M.CAT_PER_RUN)
        mm3, _ = M.build(FakeNet(), cache, sleep=lambda s: None, workers=2)
        check("sectors", {c["s"]: c["sec"] for c in mm3["c"]},
              {"BTC": "btc", "ETH": "l1", "USDT": "stable", "STETH": "wrapped", "DOGE": "meme", "LEO": "exch", "FAKE": "other",
               "NOLO": "other"})   # NOLO got its real logo in the download check above
        check("depth rotates", sum(1 for u, p in net2.log if u.endswith("/depth")), 3)   # BTC, ETH and DOGE are the only candidates
        size = len(json.dumps(mm, separators=(",", ":")))
        check("compact", size < 4000, True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if FAIL:
        print("\n".join("FAIL " + f for f in FAIL))
        print(f"{len(FAIL)} failures")
        sys.exit(1)
    print("mm_data: all checks passed")


if __name__ == "__main__":
    main()
