#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Capital flow & crypto globe — CoinGecko free API → data/flows.json
  - sectors: 24h market-cap change of ~20 non-overlapping sectors (implied USD change = price × supply effect;
             a proxy for where value moved, NOT a measured net inflow — the page says so)
  - dominance history (BTC / ETH / stablecoins / others share of total market cap), hourly, kept 30 days
  - exchanges: 24h volume of the top-100 exchanges aggregated by their registered country (for the crypto globe)
Runs at most once per hour (CoinGecko free rate limits).
"""
import json
import os
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "flows.json")
CG = "https://api.coingecko.com/api/v3"
NOW = datetime.now(timezone.utc)

SECTORS = [
    ("layer-1", "L1"), ("layer-2", "L2"), ("decentralized-finance-defi", "DeFi"), ("meme-token", "Meme"),
    ("artificial-intelligence", "AI"), ("real-world-assets-rwa", "RWA"), ("gaming", "Gaming"), ("stablecoins", "Stablecoins"),
    ("decentralized-exchange", "DEX"), ("liquid-staking-tokens", "Liquid staking"), ("depin", "DePIN"), ("oracle", "Oracles"),
    ("privacy-coins", "Privacy"), ("exchange-based-tokens", "Exchange tokens"), ("zero-knowledge-zk", "ZK"),
    ("non-fungible-tokens-nft", "NFT"), ("lending-borrowing", "Lending"), ("perpetuals", "Perps"),
    ("bitcoin-ecosystem", "Bitcoin ecosystem"), ("solana-ecosystem", "Solana ecosystem"),
]
# approximate centroids (lat, lon) for exchange-registration countries
GEO = {
    "United States": (39, -98), "Cayman Islands": (19.3, -81.3), "Seychelles": (-4.6, 55.5), "Singapore": (1.35, 103.8),
    "Hong Kong": (22.3, 114.2), "Japan": (36, 138), "South Korea": (36.5, 127.8), "United Kingdom": (54, -2), "Malta": (35.9, 14.4),
    "Estonia": (58.6, 25), "Lithuania": (55.2, 23.9), "British Virgin Islands": (18.4, -64.6), "Turkey": (39, 35), "Brazil": (-10, -52),
    "India": (21, 78), "Indonesia": (-2, 118), "Thailand": (15, 101), "Australia": (-25, 134), "Canada": (56, -106), "Germany": (51, 10),
    "Switzerland": (46.8, 8.2), "Luxembourg": (49.8, 6.1), "United Arab Emirates": (24, 54), "Bahamas": (25, -77.4), "Panama": (8.5, -80),
    "Belize": (17.2, -88.5), "Mexico": (23, -102), "Argentina": (-34, -64), "Vietnam": (16, 107), "Philippines": (13, 122),
    "Nigeria": (9, 8), "South Africa": (-29, 24), "Austria": (47.5, 14.5), "Netherlands": (52.1, 5.3), "France": (46.6, 2.2),
    "Spain": (40.4, -3.7), "Italy": (42.8, 12.5), "Poland": (52, 19), "Ukraine": (49, 32), "Georgia": (42.3, 43.4),
    "Kazakhstan": (48, 67), "Taiwan": (23.7, 121), "China": (35, 103), "Ireland": (53.4, -8), "Gibraltar": (36.1, -5.35),
    "Saint Vincent and the Grenadines": (13.25, -61.2), "Bermuda": (32.3, -64.8), "Mauritius": (-20.3, 57.6), "Cyprus": (35, 33),
    "Czech Republic": (49.8, 15.5), "Slovenia": (46.1, 14.8), "Denmark": (56, 10), "Sweden": (62, 15), "Norway": (61, 8), "Finland": (64, 26),
    "Israel": (31, 35), "Iran": (32, 53), "Pakistan": (30, 70), "Bangladesh": (24, 90), "Malaysia": (4, 102), "New Zealand": (-41, 174),
    "Chile": (-35, -71), "Colombia": (4, -72), "Peru": (-10, -76), "Venezuela": (7, -66), "Kenya": (0, 38), "Egypt": (27, 30),
    "Saint Kitts and Nevis": (17.3, -62.7), "Curaçao": (12.2, -69), "Marshall Islands": (7.1, 171), "Samoa": (-13.8, -172),
    "Anguilla": (18.2, -63.1), "Liechtenstein": (47.2, 9.6), "Bulgaria": (42.7, 25.5), "Romania": (46, 25), "Hungary": (47.2, 19.5),
    "Belgium": (50.6, 4.6), "Vanuatu": (-15.4, 166.9), "Costa Rica": (9.7, -83.8), "Isle of Man": (54.2, -4.5), "Lebanon": (33.9, 35.9), "Hong Kong SAR": (22.3, 114.2), "Jersey": (49.2, -2.1), "Guernsey": (49.45, -2.58), "Portugal": (39.6, -8), "Greece": (39, 22), "Russia": (61, 99), "Belarus": (53.7, 28), "Armenia": (40.1, 45),
    "Uzbekistan": (41.4, 64.6), "Saudi Arabia": (24, 45), "Bahrain": (26, 50.5), "Qatar": (25.3, 51.2), "Kuwait": (29.3, 47.6),
}


def get(path, params=None):
    for i in range(3):
        try:
            r = requests.get(CG + path, params=params, timeout=40, headers={"User-Agent": "entekhab.net/1.0", "accept": "application/json"})
            if r.status_code == 200:
                return r.json()
            print("  http", r.status_code, path)
            if r.status_code == 429:
                time.sleep(25)
                continue
        except Exception as e:  # noqa: BLE001
            print("  err", str(e)[:100], path)
        time.sleep(4 + i * 4)
    return None


def main():
    try:
        prev = json.load(open(OUT, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        prev = {}
    if prev.get("updated_at") and NOW - datetime.fromisoformat(prev["updated_at"]) < timedelta(minutes=55) and os.environ.get("FLOWS_FORCE") != "1":
        print("flows not due")
        return
    out = dict(prev)
    out["errors"] = {}
    cats = get("/coins/categories")
    if cats:
        by = {c["id"]: c for c in cats}
        rows = []
        for cid, short in SECTORS:
            c = by.get(cid)
            if not c or not c.get("market_cap"):
                continue
            mc, ch = float(c["market_cap"]), c.get("market_cap_change_24h")
            delta = None if ch is None else mc - mc / (1 + ch / 100.0)
            rows.append({"id": cid, "name": c.get("name"), "short": short, "mcap": round(mc), "chg24": None if ch is None else round(ch, 2),
                         "suspect": ch is not None and abs(ch) > 25,   # >25% sector move in 24h is almost always a constituent/data change
                         "delta_usd": None if delta is None else round(delta), "vol24": round(c.get("volume_24h") or 0),
                         "top": (c.get("top_3_coins") or [])[:3]})
        rows.sort(key=lambda r: -(r["delta_usd"] or 0))
        out["sectors"] = rows
    else:
        out["errors"]["sectors"] = "coingecko categories unavailable"
    # dominance from market.json (market.py already calls CoinGecko /global — avoids a second, rate-limited call)
    try:
        g = json.load(open(os.path.join(ROOT, "data", "market.json"), encoding="utf-8")).get("global") or {}
    except Exception:  # noqa: BLE001
        g = {}
    if g.get("btc_d"):
        point = {"t": int(NOW.timestamp()), "mcap": round(g.get("mcap") or 0), "btc": g["btc_d"], "eth": g.get("eth_d") or 0, "stable": g.get("stable_d") or 0}
        point["others"] = round(100 - point["btc"] - point["eth"] - point["stable"], 3)
        hist = [h for h in prev.get("dominance", []) if h["t"] >= NOW.timestamp() - 30 * 86400]
        if not hist or point["t"] - hist[-1]["t"] >= 50 * 60:
            hist.append(point)
        out["dominance"] = hist
    time.sleep(3)
    ex = get("/exchanges", {"per_page": 100, "page": 1})
    if ex:
        agg, names = defaultdict(float), defaultdict(list)
        for e in ex:
            v, cty = e.get("trade_volume_24h_btc_normalized") or e.get("trade_volume_24h_btc") or 0, e.get("country")
            if not cty or not v:
                continue
            agg[cty] += float(v)
            names[cty].append(e.get("name"))
        rows = []
        for cty, v in sorted(agg.items(), key=lambda kv: -kv[1]):
            ll = GEO.get(cty)
            rows.append({"country": cty, "vol_btc": round(v, 1), "n": len(names[cty]), "top": names[cty][:3], "lat": ll[0] if ll else None, "lon": ll[1] if ll else None})
        out["exchanges"] = rows
        out["exchanges_note"] = "CoinGecko top-100 exchanges, normalized 24h volume (BTC), grouped by registered country"
    out["updated_at"] = NOW.isoformat()
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    s = out.get("sectors") or []
    print("sectors:", len(s), "| top:", [(r["short"], r["chg24"]) for r in s[:3]], "| bottom:", [(r["short"], r["chg24"]) for r in s[-3:]],
          "| dominance pts:", len(out.get("dominance") or []), "| countries:", len(out.get("exchanges") or []),
          "| unmapped:", [r["country"] for r in (out.get("exchanges") or []) if r["lat"] is None][:8], "| errors:", out["errors"])


if __name__ == "__main__":
    main()
