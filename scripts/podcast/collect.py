"""Collect today's facts for the episode from the site's own committed data (data/*.json).

Output: facts.json — every number the scripts may use, each with its source page on entekhab.net,
the upstream source and the time it was measured. The writer (human or model) may only use these
numbers; qc.py checks every number in every script against this file.

Run: python3 collect.py <repo_root> <out_dir>
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ta  # noqa: E402

TEHRAN = timezone(timedelta(hours=3, minutes=30))  # Iran has kept UTC+3:30 all year since 2023
SITE = "https://entekhab.net"


def J(root, name):
    with open(os.path.join(root, "data", name)) as f:
        return json.load(f)


def fact(value, page, source, at, unit=""):
    return {"value": value, "unit": unit, "page": SITE + page, "source": source, "at": at}


def collect(root):
    """Each part is independent: a feed that is missing or changed shape drops only its own facts (listed in
    meta.missing), so one broken data file never stops the episode."""
    def L(name):
        try:
            return J(root, name)
        except Exception as ex:  # noqa: BLE001
            missing.append(f"{name}: {ex}")
            return {}
    missing = []
    tk = J(root, "ticker.json")   # without prices there is no episode
    mk, br = L("market.json"), L("brain.json")
    de, mc, fr = L("derivatives.json"), L("macro.json"), L("friction.json")
    ev, al, se = L("events.json"), L("altseason.json"), L("sentiment.json")
    rg, lv, ss = L("regime.json"), L("live.json"), L("scanstats.json")
    at = tk["t"]
    coins = {c["coin"]: c for c in mk.get("coins", [])}
    F = {}
    now = datetime.fromisoformat(at)

    # ---- market snapshot
    def part0():
        for s in ("BTC", "ETH"):
            F[f"{s}.price"] = fact(round(tk["c"][s]["p"], 2), f"/coins/{s.lower()}/", "Binance spot via entekhab.net market feed", at, "USD")
            F[f"{s}.chg24"] = fact(tk["c"][s]["ch"], f"/coins/{s.lower()}/", "Binance 24h change", at, "%")
            F[f"{s}.rsi1h"] = fact(coins[s]["rsi"], "/#intel", "entekhab.net scanner (1h RSI-14)", mk["updated_at"])
            F[f"{s}.hi48"] = fact(coins[s]["hi48"], "/#intel", "Binance 1h candles, 48h high", mk["updated_at"], "USD")
            F[f"{s}.lo48"] = fact(coins[s]["lo48"], "/#intel", "Binance 1h candles, 48h low", mk["updated_at"], "USD")
        g = mk["global"]
        F["mcap"] = fact(round(g["mcap"] / 1e12, 2), "/#market", "CoinGecko global", mk["sources"]["coingecko"], "USD trillion")
        F["mcap.chg24"] = fact(g["mcap_chg24"], "/#market", "CoinGecko global", mk["sources"]["coingecko"], "%")
        F["vol24"] = fact(round(g["vol"] / 1e9, 1), "/#market", "CoinGecko global", mk["sources"]["coingecko"], "USD billion")
        F["btc.dom"] = fact(g["btc_d"], "/#market", "CoinGecko global", mk["sources"]["coingecko"], "%")
        F["eth.dom"] = fact(g["eth_d"], "/#market", "CoinGecko global", mk["sources"]["coingecko"], "%")
        F["stable.dom"] = fact(g["stable_d"], "/#market", "CoinGecko global", mk["sources"]["coingecko"], "%")
        F["fng"] = fact(mk["fng"]["value"], "/fear-greed/", "alternative.me Fear & Greed", mk["sources"]["fng"])
        F["fng.hist8"] = fact([[datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d"), v] for t, v in mk["fng"]["history"][-8:]],
                              "/fear-greed/", "alternative.me", mk["sources"]["fng"])
        b = br["regime"]["breadth"]
        for k in ("up_pct", "down_pct", "range_pct", "avg_chg24", "n", "rsi_lt30", "rsi_gt70"):
            F[f"breadth.{k}"] = fact(b[k], "/#command", "entekhab.net scanner, Binance 1h", br["updated_at"])
        F["gainers"] = fact(br["gainers"][:4], "/#command", "entekhab.net scanner", br["updated_at"])
        F["losers"] = fact(br["losers"][:5], "/#command", "entekhab.net scanner", br["updated_at"])
        F["altseason"] = fact(al["value"], "/sectors/", "CoinGecko caps + Binance closes, 90 days", al["updated_at"])
        F["sentiment.news"] = fact(se["now"], "/sentiment/", "entekhab.net headline sentiment (24h)", se["updated_at"])
        F["sentiment.btc"] = fact(se["coins"]["BTC"]["v"], "/sentiment/", "entekhab.net headline sentiment (24h)", se["updated_at"])
    try:
        part0()
    except Exception as ex:  # noqa: BLE001
        missing.append("market snapshot: %r" % ex)
    # ---- regime models
    def part1():
        F["regime.breadth"] = fact(br["regime"]["regime"], "/regime/", "breadth & trend rule (brain)", br["updated_at"])
        F["regime.radar"] = fact({"state": br["radar"]["rule"], "days_in": br["radar"]["days_in"], "mean_days": br["radar"]["mean_days"]},
                                 "/regime/", "rule-based radar", br["updated_at"])
        F["regime.hmm"] = fact({"state": rg["now"]["top"], "confidence": round(rg["now"]["confidence"] * 100, 1),
                                "switch_risk": round(rg["now"]["switch_risk"] * 100, 1), "date": rg["now"]["date"]},
                               "/regime/", "4-state Gaussian HMM on BTC daily", rg["updated_at"])
    try:
        part1()
    except Exception as ex:  # noqa: BLE001
        missing.append("regime models: %r" % ex)
    # ---- technical levels (computed here from the committed candles)
    def part2():
        for s in ("BTC", "ETH"):
            F[f"{s}.ta"] = fact(ta.levels(root, s, tk["c"][s]["p"]), f"/coins/{s.lower()}/", "Binance candles snapshot (data/candles)", at)
    try:
        part2()
    except Exception as ex:  # noqa: BLE001
        missing.append("technical levels (computed here from the committed candles): %r" % ex)
    # ---- the owner's indicators (outputs only, as published on /indicators/)
    def part3():
        ind = {}
        for k, v in lv["items"].items():
            st = (v.get("states") or [])
            if st:
                f0 = st[0]["f"]
                ind[k] = {"tf": st[0]["tf"], "dir": f0.get("dir"), "decision": f0.get("decision"), "regime": f0.get("regime"),
                          "phase": f0.get("phase"), "zone": f0.get("zone"), "s2f": f0.get("s2f"), "t": st[0].get("t")}
        F["indicators"] = fact(ind, "/indicators/", "TradingView alert relay @Entekhab_Live_Relay", lv["updated_at"])
    try:
        part3()
    except Exception as ex:  # noqa: BLE001
        missing.append("the owner's indicators (outputs only, as published on /indicators/): %r" % ex)
    # ---- derivatives (OKX)
    def part4():
        for s in ("BTC", "ETH"):
            x = de[s]
            F[f"{s}.funding"] = fact(x["funding"], "/derivatives/", "OKX perpetual swap funding (per 8h)", de["updated_at"], "%")
            F[f"{s}.funding_ann"] = fact(x["funding_ann"], "/derivatives/", "OKX", de["updated_at"], "%/yr")
            F[f"{s}.ls"] = fact(x["long_short"][-1][1], "/derivatives/", "OKX long/short account ratio", de["updated_at"])
            F[f"{s}.liq24"] = fact({"long": round(x["liq"]["long_usd_24h"] / 1e6, 2), "short": round(x["liq"]["short_usd_24h"] / 1e6, 2)},
                                   "/derivatives/", "OKX liquidations, 24h", de["updated_at"], "USD million")
            F[f"{s}.oi"] = fact(round(x["oi_usd"] / 1e9, 2), "/derivatives/", "OKX swap open interest", de["updated_at"], "USD billion")
    try:
        part4()
    except Exception as ex:  # noqa: BLE001
        missing.append("derivatives (OKX): %r" % ex)
    # ---- macro
    def part5():
        F["macro.last"] = fact(mc["last"], "/iran-correlation/", "FRED / Binance", mc["updated_at"])
        F["macro.chg1m"] = fact(mc["chg_1m"], "/iran-correlation/", "FRED / Binance", mc["updated_at"], "%")
        F["macro.corr3m"] = fact({k: mc["windows"]["3m"]["matrix"]["BTC"][k] for k in ("SPX", "NDX", "GOLD")},
                                 "/iran-correlation/", "63 trading days", mc["updated_at"])
    try:
        part5()
    except Exception as ex:  # noqa: BLE001
        missing.append("macro: %r" % ex)
    # ---- Iran
    def part6():
        p = fr["prices"]
        F["iran.usdt"] = fact(p["usdt"], "/iran-friction/", "Telegram price boards (see page)", p["usdt_time"], "toman")
        F["iran.usd"] = fact(p["usd"], "/iran-friction/", "Telegram price boards (see page)", p["usd_time"], "toman")
        F["iran.btc_gap"] = fact(fr["paper"]["gap_pct"], "/iran-friction/", "Iranian exchanges vs global", fr["updated_at"], "%")
        F["iran.friction"] = fact({"score": fr["score"], "level": fr["level"]}, "/iran-friction/", "entekhab.net friction index", fr["updated_at"])
    try:
        part6()
    except Exception as ex:  # noqa: BLE001
        missing.append("Iran: %r" % ex)
    # ---- calendar
    def part7():
        up = []
        for e in ev["events"]:
            t = datetime.fromisoformat(e["date"])
            if t >= now - timedelta(hours=1):
                up.append({"title": e["title"], "kind": e["kind"], "impact": e["impact"], "utc": t.strftime("%Y-%m-%d %H:%M"),
                           "tehran": t.astimezone(TEHRAN).strftime("%Y-%m-%d %H:%M"), "forecast": e["forecast"], "previous": e["previous"]})
        F["events.next"] = fact(up, "/#market", ev["source"], ev["updated_at"])
        last_cpi = [e for e in ev["events"] if e["kind"] == "CPI" and "btc_4h" in e]
        if last_cpi:
            e = last_cpi[-1]
            F["events.last_cpi"] = fact({"date": e["date"][:10], "btc_4h": e["btc_4h"], "range_4h": e["btc_range_4h"], "base_4h": e["base_range_4h"]},
                                        "/#market", "Binance 1h around the release", ev["updated_at"], "%")
        a = ev["reaction_stats"]["_all"]
        F["events.stats"] = fact({"n": a["n"], "wider": a["wider"], "p": a["p"]}, "/#market", a["test"], ev["updated_at"])
    try:
        part7()
    except Exception as ex:  # noqa: BLE001
        missing.append("calendar: %r" % ex)
    # ---- scanner honesty numbers
    def part8():
        st = ss["stats"]
        F["scan.rsi_oversold"] = fact({k: st["rsi_oversold"][k] for k in ("n24", "win24", "avg24", "n72", "win72", "avg72")},
                                      "/#intel", "entekhab.net scanner record since " + ss["since"][:10], ss["updated_at"])
        F["scan.all"] = fact({k: st["_all"][k] for k in ("n24", "win24", "avg24")}, "/#intel", "entekhab.net scanner record", ss["updated_at"])
        opp = sorted(mk.get("opportunities") or [], key=lambda o: -(o.get("vol_x") or 0))[:4]
        F["scan.top"] = fact([{k: o.get(k) for k in ("coin", "type", "tf", "dir", "price", "vol_x", "inval", "mtf")} | {"detail": o.get("detail")}
                              for o in opp], "/#intel", "entekhab.net scanner (largest volume multiples)", mk["updated_at"])

    try:
        part8()
    except Exception as ex:  # noqa: BLE001
        missing.append("scanner honesty numbers: %r" % ex)
    meta = {"missing": missing, "snapshot_utc": at, "snapshot_tehran": datetime.fromisoformat(at).astimezone(TEHRAN).strftime("%Y-%m-%d %H:%M")}
    return {"meta": meta, "facts": F}


def inputs(root, at, hours=26, max_news=30, max_posts=20):
    """The day's raw material besides numbers: headlines from the site's news feed (clustered across outlets) and
    the channel's own posts. The writer may only report news that is here, and says which outlet reported it."""
    now = datetime.fromisoformat(at)
    since = now - timedelta(hours=hours)

    def when(x):
        try:
            return datetime.fromisoformat(x)
        except Exception:  # noqa: BLE001
            return None
    news = []
    try:
        for it in J(root, "news.json").get("items", []):
            d = when(it.get("date", ""))
            if not d or d < since or d > now + timedelta(minutes=10):
                continue
            srcs = [x.get("source") for x in (it.get("sources") or []) if x.get("source")] or [it.get("source")]
            news.append({"id": it.get("id"), "title": it.get("title"), "title_fa": it.get("tfa"), "date": it["date"],
                         "outlets": sorted(set(filter(None, srcs))), "url": it.get("url"),
                         "urls": [x.get("url") for x in (it.get("sources") or []) if x.get("url")][:4]})
    except Exception as ex:  # noqa: BLE001
        print("news.json:", ex)
    news.sort(key=lambda x: (-len(x["outlets"]), x["date"]), reverse=False)
    posts = []
    try:
        for p in J(root, "posts.json"):
            d = when(p.get("date", ""))
            if d and since <= d <= now + timedelta(minutes=10):
                posts.append({"url": p.get("url"), "date": p["date"], "text": (p.get("text") or "")[:1500]})
    except Exception as ex:  # noqa: BLE001
        print("posts.json:", ex)
    posts.sort(key=lambda x: x["date"], reverse=True)
    return {"news": news[:max_news], "posts": posts[:max_posts]}


if __name__ == "__main__":
    root, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    d = collect(root)
    with open(os.path.join(out, "facts.json"), "w") as f:
        json.dump(d, f, ensure_ascii=False, indent=1, default=str)
    with open(os.path.join(out, "inputs.json"), "w") as f:
        json.dump(inputs(root, d["meta"]["snapshot_utc"]), f, ensure_ascii=False, indent=1)
    print("facts:", len(d["facts"]), "snapshot", d["meta"])
