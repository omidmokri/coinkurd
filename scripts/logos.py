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
SYM = re.compile(r"^[A-Z0-9]{1,12}$")                # Binance has one-letter coins too (S, W, T, A…)
MULT = re.compile(r"^(?:1000000|1000|1M)(?=[A-Z])")    # 1000SATS, 1MBABYDOGE: the same coin, priced per 1000 / per million
ALIAS = {"RONIN": "RON", "BTTC": "BTT"}                  # Binance's ticker ≠ the coin's own symbol on CoinGecko


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
        t_gecko = time.time() + 120                          # the CI step has 6 minutes: paging and searching stop in time to download and index
        for page in range(1, 7):
            if not (need - set(img)) or time.time() > t_gecko:
                break
            for attempt in range(3):                         # CoinGecko's free tier answers 429 when asked too fast: wait, ask again
                try:
                    r = requests.get("https://api.coingecko.com/api/v3/coins/markets", params={"vs_currency": "usd", "order": "market_cap_desc", "per_page": 250, "page": page},
                                     headers=UA, timeout=30)
                except Exception as e:  # noqa: BLE001
                    print("coingecko err", e)
                    r = None
                if r is not None and r.status_code == 429 and attempt < 2 and time.time() + 60 < t_gecko:
                    wait = min(90, int(r.headers.get("Retry-After") or 0) or 60)
                    print("coingecko 429, page", page, "waiting", wait, "s")
                    time.sleep(wait)
                    continue
                break
            if r is None or r.status_code != 200:
                print("coingecko", r.status_code if r is not None else "-", "page", page)
                continue
            for c in r.json():
                s = c["symbol"].upper()
                if s not in img and c.get("image"):  # اولین = بزرگ‌ترین ارزش بازار (رفع ابهام نمادهای تکراری)
                    img[s] = c["image"].replace("/large/", "/small/")
            time.sleep(13)
        # a multiplier token (1000SATS) is the coin itself (SATS): its logo
        for s in need:
            base = ALIAS.get(s) or MULT.sub("", s)
            if s not in img and base != s and base in img:
                img[s] = img[base]
        # the few CoinGecko does not list in its first pages (fan tokens, new listings): its search, by exact symbol.
        # A symbol it found nothing for (Binance's tokenized stocks, mostly) is asked again only after a week.
        nologo_path = os.path.join(L, "nologo.json")
        try:
            nologo = json.load(open(nologo_path))
            nologo = nologo if isinstance(nologo, dict) else {}
        except Exception:  # noqa: BLE001
            nologo = {}
        now = int(time.time())
        t_search, asked = time.time() + 75, 0
        for s in sorted(x for x in need if x not in img and now - int(nologo.get(x, 0)) > 7 * 86400):
            if time.time() > t_search or asked >= 30:
                break
            q = MULT.sub("", s)
            try:
                asked += 1
                r = requests.get("https://api.coingecko.com/api/v3/search", params={"query": q}, headers=UA, timeout=20)
                if r.status_code == 429:
                    print("coingecko search 429 — the rest next run")
                    break
                hits = [c for c in (r.json().get("coins") or []) if str(c.get("symbol", "")).upper() == q and (c.get("large") or c.get("thumb"))]
                hits.sort(key=lambda c: c.get("market_cap_rank") or 10 ** 9)
                if hits:
                    img[s] = (hits[0].get("large") or hits[0]["thumb"]).replace("/large/", "/small/").replace("/thumb/", "/small/")
                else:
                    nologo[s] = now
            except Exception as e:  # noqa: BLE001
                print("coingecko search err", s, e)
            time.sleep(3)
        got, coincap = 0, 0
        # a capped batch per run, so the index is always written: the coins CoinGecko knows first, then the rest (CoinCap)
        t_dl = time.time() + 90
        for s in sorted(need, key=lambda x: (x not in img, x))[:360]:
            if time.time() > t_dl:
                break
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
        print("downloaded:", got, f"(coincap {coincap}) | searched: {asked} | no logo anywhere:", len(missing), missing[:40])
        json.dump({k: v for k, v in sorted(nologo.items()) if k in missing}, open(nologo_path, "w"), separators=(",", ":"))
    have = sorted(f[:-4] for f in os.listdir(L) if f.endswith(".png"))
    json.dump(have, open(os.path.join(L, "index.json"), "w"), separators=(",", ":"))
    print("total logos:", len(have))


if __name__ == "__main__":
    main()
