#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Narrative Radar — رادار روایت‌های داغ بازار

برای هر روایت (AI، RWA، DePIN، میم‌کوین، لایهٔ ۲، DeFi، ETF، استیبل‌کوین، ...):
  - توجه رسانه‌ای: تعداد تیترهای ۲۴ ساعت اخیر (وزن‌دار با تعداد منابع) در برابر میانگین روزانهٔ ۶ روز قبل
  - عملکرد قیمت: میانگین تغییر ۲۴h کوین‌های عضو روایت که در اسکنر هستند
  - تیترهای نمونه با لینک منبع
خروجی: data/narratives.json  (+ تاریخچهٔ روزانه برای نمودار)
"""
import json
import os
import re
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")

NARR = {
    "ai": {"name": {"fa": "هوش مصنوعی", "ckb": "ژیری دەستکرد", "en": "AI"},
           "kw": r"\bai\b|artificial intelligence|agent|agentic|llm|openai|nvidia|gpu",
           "coins": ["FET", "RENDER", "TAO", "WLD", "AGIX", "ARKM", "VIRTUAL", "AI16Z", "GRT", "IO", "NEAR"]},
    "rwa": {"name": {"fa": "دارایی‌های واقعی توکنیزه (RWA)", "ckb": "دارایی ڕاستەقینەی تۆکەنکراو", "en": "RWA / Tokenization"},
            "kw": r"\brwa\b|real[- ]world asset|tokeniz|tokenis|treasur(y|ies) token|buidl",
            "coins": ["ONDO", "PENDLE", "OM", "POLYX", "LINK", "PLUME", "CFG"]},
    "depin": {"name": {"fa": "DePIN", "ckb": "DePIN", "en": "DePIN"},
              "kw": r"depin|decentralized physical|helium|filecoin|storage network",
              "coins": ["FIL", "AR", "HNT", "IOTX", "RNDR", "RENDER", "THETA", "AKT"]},
    "meme": {"name": {"fa": "میم‌کوین", "ckb": "مێمکۆین", "en": "Memecoins"},
             "kw": r"meme ?coin|memecoin|\bdoge|shiba|\bpepe\b|\bbonk\b|\bwif\b|pump\.fun|trump coin|\$trump",
             "coins": ["DOGE", "SHIB", "PEPE", "BONK", "WIF", "FLOKI", "TRUMP", "BOME", "MEME", "PENGU"]},
    "l2": {"name": {"fa": "لایهٔ ۲ و مقیاس‌پذیری", "ckb": "چینی ٢", "en": "Layer 2"},
           "kw": r"layer[- ]?2|\bl2\b|rollup|arbitrum|optimism|\bbase\b chain|zksync|starknet|polygon",
           "coins": ["ARB", "OP", "POL", "STRK", "ZK", "MNT", "IMX", "METIS"]},
    "defi": {"name": {"fa": "دیفای (DeFi)", "ckb": "دیفای", "en": "DeFi"},
             "kw": r"\bdefi\b|\bdex\b|lending|liquidity pool|aave|uniswap|curve|yield|staking|restaking|tvl",
             "coins": ["UNI", "AAVE", "CRV", "MKR", "LDO", "COMP", "SUSHI", "CAKE", "JUP", "ENA", "PENDLE"]},
    "etf": {"name": {"fa": "ETF و نهادی", "ckb": "ETF و دامەزراوەیی", "en": "ETFs & Institutions"},
            "kw": r"\betf\b|blackrock|fidelity|grayscale|institutional|treasury company|microstrategy|strategy inc|inflow|outflow",
            "coins": ["BTC", "ETH", "SOL", "XRP"]},
    "stable": {"name": {"fa": "استیبل‌کوین و پرداخت", "ckb": "ستەیبڵکۆین و پارەدان", "en": "Stablecoins & Payments"},
               "kw": r"stablecoin|usdt|usdc|tether|circle|payment|genius act|cbdc",
               "coins": ["XRP", "XLM", "TRX", "ENA"]},
    "reg": {"name": {"fa": "قانون‌گذاری", "ckb": "یاسادانان", "en": "Regulation"},
            "kw": r"\bsec\b|regulat|lawmaker|senate|congress|bill\b|lawsuit|court|ban\b|cftc|mica",
            "coins": []},
    "security": {"name": {"fa": "امنیت و هک", "ckb": "ئاسایش و هاک", "en": "Security & Hacks"},
                 "kw": r"hack|exploit|stolen|breach|drain|phishing|vulnerab|attack",
                 "coins": []},
    "gaming": {"name": {"fa": "گیمینگ و متاورس", "ckb": "یاری و مێتاڤێرس", "en": "Gaming & Metaverse"},
               "kw": r"gaming|game\b|metaverse|nft\b|play[- ]to[- ]earn",
               "coins": ["IMX", "SAND", "MANA", "AXS", "GALA", "BEAM", "RON", "APE"]},
    "btc_eco": {"name": {"fa": "اکوسیستم بیت‌کوین", "ckb": "ئیکۆسیستەمی بیتکۆین", "en": "Bitcoin ecosystem"},
                "kw": r"ordinals|runes|brc-20|bitcoin l2|lightning|halving|miner|hashrate|babylon",
                "coins": ["BTC", "STX", "ORDI", "SATS", "RUNE"]},
}


def load(n, d):
    try:
        return json.load(open(os.path.join(D, n), encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return d


def main():
    news = load("news.json", {}).get("items", [])
    mk = {c["coin"]: c for c in load("market.json", {}).get("coins", [])}
    prev = load("narratives.json", {})
    now = datetime.now(timezone.utc)
    d1, d7 = now - timedelta(hours=24), now - timedelta(days=7)
    out = []
    for nid, n in NARR.items():
        rx = re.compile(n["kw"], re.I)
        hits = [i for i in news if rx.search(i["title"])]
        h24 = [i for i in hits if datetime.fromisoformat(i["date"]) >= d1]
        prior = [i for i in hits if d7 <= datetime.fromisoformat(i["date"]) < d1]
        w24 = sum(len(i.get("sources", [1])) for i in h24)
        days = max(1, min(6, (d1 - min((datetime.fromisoformat(i["date"]) for i in news), default=d1)).days or 1))
        base = sum(len(i.get("sources", [1])) for i in prior) / days
        mom = round((w24 + 1) / (base + 1), 2)
        mem = [mk[c] for c in dict.fromkeys(n["coins"]) if c in mk and mk[c].get("chg24") is not None]
        perf = round(sum(c["chg24"] for c in mem) / len(mem), 2) if mem else None
        out.append({"id": nid, "name": n["name"], "mentions_24h": w24, "baseline_daily": round(base, 1), "momentum": mom,
                    "perf_24h": perf, "members": [{"coin": c["coin"], "chg24": c["chg24"]} for c in sorted(mem, key=lambda c: -c["chg24"])],
                    "headlines": [{"title": i["title"], "url": i["url"], "source": i["source"], "date": i["date"]} for i in h24[:4]]})
    out.sort(key=lambda x: (-(x["mentions_24h"] * min(x["momentum"], 4)), -(x["perf_24h"] or -99)))
    hist = prev.get("history", {})
    day = now.strftime("%Y-%m-%d")
    for x in out:
        h = hist.setdefault(x["id"], [])
        rec = [day, x["mentions_24h"], x["perf_24h"]]
        if h and h[-1][0] == day:
            h[-1] = rec
        else:
            h.append(rec)
        hist[x["id"]] = h[-90:]
    json.dump({"updated_at": now.isoformat(), "narratives": out, "history": hist,
               "method": "mentions = headlines in last 24h weighted by number of sources; momentum = (mentions+1)/(avg daily of previous days+1); perf = mean 24h change of member coins present in the scanner"},
              open(os.path.join(D, "narratives.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("narratives:", [(x["id"], x["mentions_24h"], x["momentum"], x["perf_24h"]) for x in out[:6]])


if __name__ == "__main__":
    main()
