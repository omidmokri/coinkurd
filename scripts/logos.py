#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
لوگوی کوین‌ها — از CoinGecko (رایگان) برای کوین‌های اسکن‌شده دانلود و روی همین سایت ذخیره می‌شود
(هم‌مبدأ = بدون مشکل CORS در three.js). فقط لوگوهای جدید دانلود می‌شوند.
خروجی: data/logos/<SYM>.png + data/logos/index.json
"""
import json
import os
import time

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
L = os.path.join(D, "logos")


def main():
    os.makedirs(L, exist_ok=True)
    try:
        want = {c["coin"] for c in json.load(open(os.path.join(D, "market.json")))["coins"]}
    except Exception:  # noqa: BLE001
        want = set()
    have = {f[:-4] for f in os.listdir(L) if f.endswith(".png")}
    need = want - have
    print("coins:", len(want), "have:", len(have), "need:", len(need))
    if need:
        img = {}
        for page in (1, 2, 3):
            try:
                r = requests.get("https://api.coingecko.com/api/v3/coins/markets", params={"vs_currency": "usd", "order": "market_cap_desc", "per_page": 250, "page": page}, timeout=30)
                if r.status_code != 200:
                    print("coingecko", r.status_code)
                    break
                for c in r.json():
                    s = c["symbol"].upper()
                    if s not in img and c.get("image"):  # اولین = بزرگ‌ترین ارزش بازار (رفع ابهام نمادهای تکراری)
                        img[s] = c["image"].replace("/large/", "/small/")
            except Exception as e:  # noqa: BLE001
                print("coingecko err", e)
            time.sleep(6)
        got = 0
        for s in sorted(need):
            u = img.get(s)
            if not u:
                continue
            try:
                r = requests.get(u, timeout=20)
                if r.status_code == 200 and len(r.content) > 200:
                    open(os.path.join(L, f"{s}.png"), "wb").write(r.content)
                    got += 1
            except Exception:  # noqa: BLE001
                pass
        print("downloaded:", got, "| no logo on CoinGecko top-750:", sorted(s for s in need if s not in img)[:40])
    have = sorted(f[:-4] for f in os.listdir(L) if f.endswith(".png"))
    json.dump(have, open(os.path.join(L, "index.json"), "w"), separators=(",", ":"))
    print("total logos:", len(have))


if __name__ == "__main__":
    main()
