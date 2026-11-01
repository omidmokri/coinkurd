#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
خبرخوان چندمنبعی (RSS رایگان، بدون کلید)

- از چند منبع معتبر کریپتو تیتر و لینک می‌گیرد (متن کامل خبر کپی نمی‌شود؛ فقط تیتر + لینک منبع)
- خبرهای تکراری بین منابع را با شباهت تیتر ادغام می‌کند و همهٔ منابع را نگه می‌دارد
- کوین‌های مرتبط و دستهٔ خبر را تشخیص می‌دهد
- اگر یک منبع از کار بیفتد بقیه ادامه می‌دهند؛ خبرهای قبلی حفظ می‌شوند

خروجی: data/news.json
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from difflib import SequenceMatcher
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from categories import COINS, CATEGORIES  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "news.json")
FEEDS = {
    "CoinDesk": "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "Cointelegraph": "https://cointelegraph.com/rss",
    "Decrypt": "https://decrypt.co/feed",
    "The Block": "https://www.theblock.co/rss.xml",
    "Bitcoin Magazine": "https://bitcoinmagazine.com/.rss/full/",
    "CryptoSlate": "https://cryptoslate.com/feed/",
    "Blockworks": "https://blockworks.co/feed",
    "U.Today": "https://u.today/rss",
}
UA = {"User-Agent": "Mozilla/5.0 (entekhab.net news bot; +https://entekhab.net)"}
KEEP_DAYS = 7


def norm(t):
    return re.sub(r"[^a-z0-9 ]+", " ", t.lower()).strip()


def parse_date(s):
    if not s:
        return None
    try:
        return parsedate_to_datetime(s).astimezone(timezone.utc)
    except Exception:  # noqa: BLE001
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)
        except Exception:  # noqa: BLE001
            return None


def fetch(name, url):
    r = requests.get(url, headers=UA, timeout=20)
    r.raise_for_status()
    root = ET.fromstring(r.content)
    items = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
    out = []
    for it in items[:40]:
        def tx(tag):
            el = it.find(tag)
            if el is None:
                el = it.find("{http://www.w3.org/2005/Atom}" + tag)
            return (el.text or "").strip() if el is not None and el.text else ""
        title = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", tx("title")))
        link = tx("link")
        if not link:
            le = it.find("{http://www.w3.org/2005/Atom}link")
            link = le.get("href") if le is not None else ""
        d = parse_date(tx("pubDate") or tx("published") or tx("updated"))
        if title and link and d:
            out.append({"title": title, "url": link, "source": name, "date": d.isoformat()})
    return out


EN_COINS = {k: [n for n in v if n.isascii()] for k, v in COINS.items()}
CAT_EN = {
    "security": r"hack|exploit|stolen|breach|scam|drain|phish",
    "regulation": r"\bsec\b|regulat|law|bill|senat|congress|ban|court|tax|cftc|policy|government|reserve",
    "etf_institutional": r"\betf\b|blackrock|fidelity|treasury|institution|grayscale|inflow|outflow|strategy|microstrategy|bank",
    "onchain": r"on-chain|onchain|whale|hashrate|miner|liquidat|open interest|funding",
    "technical": r"support|resistance|breakout|chart|technical|rsi|pattern|rally|price analysis",
}


def tag(n):
    t = " " + n["title"].lower() + " "
    coins = []
    for k, names in EN_COINS.items():
        for nm in names:
            if re.search(r"(?<![a-z0-9])" + re.escape(nm.lower()) + r"(?![a-z0-9])", t):
                coins.append(k)
                break
    n["coins"] = coins
    n["category"] = next((c for c, rx in CAT_EN.items() if re.search(rx, t)), "news")
    return n


def main():
    old = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {"items": []}
    items, status = list(old.get("items", [])), {}
    for name, url in FEEDS.items():
        try:
            got = fetch(name, url)
            status[name] = {"ok": True, "n": len(got)}
            items.extend(got)
        except Exception as e:  # noqa: BLE001
            status[name] = {"ok": False, "err": str(e)[:120]}
        time.sleep(0.3)
    cutoff = datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)
    items = [i for i in items if datetime.fromisoformat(i["date"]) >= cutoff]
    items.sort(key=lambda i: i["date"])
    merged = []
    for it in items:
        nt = norm(it["title"])
        dup = None
        for m in merged[-150:]:
            if m["url"] == it["url"] or SequenceMatcher(None, m["_n"], nt).ratio() > 0.72:
                dup = m
                break
        if dup:
            srcs = {s["source"] for s in dup["sources"]}
            for s in it.get("sources", [{"source": it["source"], "url": it["url"]}]):
                if s["source"] not in srcs:
                    dup["sources"].append(s)
        else:
            it = dict(it)
            it["_n"] = nt
            it["sources"] = it.get("sources") or [{"source": it["source"], "url": it["url"]}]
            merged.append(tag(it))
    merged.sort(key=lambda i: i["date"], reverse=True)
    for m in merged:
        m.pop("_n", None)
    ok = sum(1 for s in status.values() if s["ok"])
    json.dump({"updated_at": datetime.now(timezone.utc).isoformat(), "feeds": status, "items": merged[:400]},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"feeds ok {ok}/{len(FEEDS)}; items {len(merged)}; multi-source {sum(1 for m in merged if len(m['sources']) > 1)}")
    if ok == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
