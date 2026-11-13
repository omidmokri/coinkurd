#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
لوگوی کوین‌ها — برای همهٔ کوین‌های اسکن‌شده و همهٔ ارزهایی که در بایننس با تتر معامله می‌شوند (+ خود تتر برای بازار تومانی)
روی همین سایت ذخیره می‌شود (هم‌مبدأ = بدون مشکل CORS). فقط لوگوهای جدید دانلود می‌شوند.
منبع: CoinGecko (بزرگ‌ترین ارزش بازار برای هر نماد، ۱۵۰۰ کوین اول)، و برای باقی آیکون‌های CoinCap.
کوینی که هیچ‌جا لوگو ندارد در سایت نشان داده نمی‌شود (قانون سایت: هیچ کوینی بدون لوگوی خودش).
خروجی: data/logos/<SYM>.png + data/logos/index.json
"""
import json
import os
import re
import time

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
L = os.path.join(D, "logos")
BINANCE = "https://data-api.binance.vision/api/v3/"
UA = {"User-Agent": "entekhab.net coin logos"}
SYM = re.compile(r"^[A-Z0-9]{2,12}$")


def binance_bases():
    """every base asset traded against USDT on Binance spot right now"""
    try:
        j = requests.get(BINANCE + "exchangeInfo", params={"permissions": "SPOT", "symbolStatus": "TRADING"}, headers=UA, timeout=30).json()
        out = {s["baseAsset"] for s in j.get("symbols", []) if s.get("quoteAsset") == "USDT" and s.get("status") == "TRADING"}
        if out:
            return out
    except Exception as e:  # noqa: BLE001
        print("binance exchangeInfo err", e)
    try:
        a = requests.get(BINANCE + "ticker/price", headers=UA, timeout=30).json()
        return {x["symbol"][:-4] for x in a if x["symbol"].endswith("USDT")}
    except Exception as e:  # noqa: BLE001
        print("binance ticker err", e)
        return set()


def png_ok(b):
    return len(b) > 200 and (b[:8] == b"\x89PNG\r\n\x1a\n" or b[:3] == b"\xff\xd8\xff" or b[:4] == b"RIFF")


def main():
    os.makedirs(L, exist_ok=True)
    try:
        want = {c["coin"] for c in json.load(open(os.path.join(D, "market.json")))["coins"]}
    except Exception:  # noqa: BLE001
        want = set()
    bb = binance_bases()
    want |= bb | {"USDT"}                                   # tether: the toman market's own coin
    want = {s for s in want if SYM.match(s)}
    have = {f[:-4] for f in os.listdir(L) if f.endswith(".png")}
    need = want - have
    print("coins:", len(want), f"(binance usdt: {len(bb)})", "have:", len(have), "need:", len(need))
    if need:
        img = {}
        for page in range(1, 7):
            if not (need - set(img)):
                break
            try:
                r = requests.get("https://api.coingecko.com/api/v3/coins/markets", params={"vs_currency": "usd", "order": "market_cap_desc", "per_page": 250, "page": page},
                                 headers=UA, timeout=30)
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
        got, coincap = 0, 0
        for s in sorted(need)[:220]:                         # a capped batch per run, so the index is always written
            urls = ([img[s]] if s in img else []) + [f"https://assets.coincap.io/assets/icons/{s.lower()}@2x.png"]
            for u in urls:
                try:
                    r = requests.get(u, headers=UA, timeout=20)
                    if r.status_code == 200 and png_ok(r.content):
                        open(os.path.join(L, f"{s}.png"), "wb").write(r.content)
                        got += 1
                        coincap += "coincap" in u
                        break
                except Exception:  # noqa: BLE001
                    pass
        missing = sorted(s for s in need if not os.path.exists(os.path.join(L, f"{s}.png")))
        print("downloaded:", got, f"(coincap {coincap}) | no logo anywhere:", len(missing), missing[:40])
    have = sorted(f[:-4] for f in os.listdir(L) if f.endswith(".png"))
    json.dump(have, open(os.path.join(L, "index.json"), "w"), separators=(",", ":"))
    print("total logos:", len(have))


if __name__ == "__main__":
    main()
