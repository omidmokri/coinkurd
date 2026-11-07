#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Archive enrichment (rule-based, transparent, no AI) → fields added to every post in data/posts.json
  kind  : news · analysis · signal · education · opinion · product · notice · promo   (post type label)
  q     : "low" for promos, near-duplicates and posts with almost no text  → hidden from the main feed by default
  dup   : id of the newest identical / near-identical post this one repeats (older copies collapse into the newest)
  dupn  : on the newest copy: how many times the same text was posted
  ents  : named entities found in the text (exchanges, people, institutions, events) — canonical English names
Also writes data/posts_lite.json: the archive without full texts (first ~300 characters) for a fast first page load;
the homepage fetches the full posts.json only when a post is opened or the archive is searched.
"""
import json
import os
import re
from collections import defaultdict
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
P = os.path.join(D, "posts.json")

EMOJI = re.compile(r"[\U0001F000-\U0001FFFF☀-➿️‍⬀-⯿←-⇿]")
MDL = re.compile(r"\[([^\]]*)\]\([^)]*\)")


def strip(t):
    t = MDL.sub(r"\1", t or "")
    t = re.sub(r"https?://\S+|t\.me/\S+|@\w+", " ", t)
    t = re.sub(r"#\S+", " ", t)
    t = EMOJI.sub(" ", t)
    t = re.sub(r"[*_~`>|➖—–\-=•·]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def norm(t):
    t = strip(t).lower().replace("ي", "ی").replace("ك", "ک").replace("‌", " ").replace("ـ", "")
    t = re.sub(r"[ً-ٰٟ]", "", t)
    return re.sub(r"[^\w\s]", " ", t)


PROMO = re.compile(r"(دیسکورد|discord|یوتیوب|youtube|اینستاگرام|instagram|عضو\s*شوید|بپیوندید|با\s*ما\s*به\s*روز|لینک\s*دعوت|join\s+us|subscribe|کانال\s*ما|گروه\s*ما)", re.I)
OPINION = re.compile(r"(به\s*نظر\s*من|به\s*نظرم|فکر\s*می\s*کنم|فکر\s*می‌کنم|معتقدم|شخصا|شخصاً|پیش\s*بینی\s*من|حدس\s*من|in\s+my\s+opinion|i\s+think)", re.I)
SIGNALW = re.compile(r"(تارگت|حد\s*ضرر|استاپ|نقطه\s*ورود|ورود\s*:|\bTP\s*\d|\bSL\b|لانگ|شورت|long\b|short\b|entry\b|stop\s*loss)", re.I)
EDUW = re.compile(r"(آموزش|نکته|یادبگیر|چیست\؟|چیست|چطور|چگونه|راهنما|اصطلاح|تعریف)", re.I)
KIND_OF_CAT = {"news": "news", "etf_institutional": "news", "regulation": "news", "security": "news", "onchain": "news",
               "technical": "analysis", "signal": "signal", "education": "education", "products": "product", "community": "notice"}

# canonical entity → patterns (Persian + English); kept small and explicit on purpose
ENTS = {
    # exchanges
    "Binance": r"binance|بایننس", "Coinbase": r"coinbase|کوین\s*بیس", "OKX": r"\bokx\b|اوکی\s*ایکس", "Bybit": r"bybit|بای\s*بیت",
    "Kraken": r"kraken|کراکن", "KuCoin": r"kucoin|کوکوین", "Bitget": r"bitget|بیت\s*گت", "HTX": r"\bhtx\b|huobi|هوبی", "Gate.io": r"gate\.io|گیت\s*آیو",
    "Bitfinex": r"bitfinex|بیتفینکس", "Robinhood": r"robinhood|رابین\s*هود", "Upbit": r"upbit|آپ\s*بیت", "Nobitex": r"nobitex|نوبیتکس",
    # institutions / companies
    "SEC": r"\bsec\b|کمیسیون\s*بورس", "CFTC": r"\bcftc\b", "Federal Reserve": r"federal\s*reserve|\bfed\b|فدرال\s*رزرو|فدرال‌رزرو|بانک\s*مرکزی\s*آمریکا",
    "BlackRock": r"blackrock|بلک\s*راک", "Fidelity": r"fidelity|فیدلیتی", "Grayscale": r"grayscale|گری\s*اسکیل", "ARK Invest": r"ark\s*invest|آرک\s*اینوست",
    "Strategy (MicroStrategy)": r"microstrategy|مایکرو\s*استراتژی|\bstrategy\b\s*\(?mstr|\bmstr\b", "Tesla": r"tesla|تسلا", "Tether": r"tether|تتر\b|\busdt\b",
    "Circle": r"\bcircle\b|سرکل", "JPMorgan": r"jpmorgan|jp\s*morgan|جی\s*پی\s*مورگان", "Goldman Sachs": r"goldman|گلدمن", "IMF": r"\bimf\b|صندوق\s*بین\s*المللی\s*پول",
    "ECB": r"\becb\b|بانک\s*مرکزی\s*اروپا", "US Treasury": r"u\.?s\.?\s*treasury|treasury\s*(department|secretary)|bessent|خزانه\s*داری\s*آمریکا|وزارت\s*خزانه|بسنت", "Corporate BTC treasuries": r"treasury\s*compan|bitcoin\s*treasur|خزانه\s*(بیت|شرکت|داری\s*بیت)|شرکت(\u200c|\s)?های\s*خزانه", "White House": r"white\s*house|کاخ\s*سفید", "Congress": r"congress|کنگره",
    "Ethereum Foundation": r"ethereum\s*foundation|بنیاد\s*اتریوم", "Ripple": r"\bripple\b|ریپل\b", "Polymarket": r"polymarket|پالی\s*مارکت",
    # people
    "Donald Trump": r"trump|ترامپ", "Jerome Powell": r"powell|جروم\s*پاول|پاول(?!\s*دورو)", "Michael Saylor": r"saylor|سیلور|سیلر", "Changpeng Zhao (CZ)": r"changpeng|\bcz\b|چانگ\s*پنگ",
    "Vitalik Buterin": r"vitalik|buterin|ویتالیک|بوترین", "Elon Musk": r"elon\s*musk|\bmusk\b|ایلان", "Larry Fink": r"larry\s*fink|لری\s*فینک",
    "Cathie Wood": r"cathie|کتی\s*وود", "Paul Atkins": r"atkins|اتکینز", "Gary Gensler": r"gensler|گنسلر", "Brian Armstrong": r"armstrong|آرمسترانگ",
    "Satoshi Nakamoto": r"satoshi|ساتوشی", "Pavel Durov": r"durov|دورو[فو]", "Richard Teng": r"richard\s*teng|ریچارد\s*تنگ",
    # events / themes
    "ETF": r"\betf\b|ای\s*تی\s*اف|صندوق\s*(های\s*)?قابل\s*معامله", "Halving": r"halving|هاوینگ|هالوینگ", "FOMC": r"\bfomc\b|نشست\s*فدرال|کمیته\s*بازار\s*باز",
    "CPI / inflation": r"\bcpi\b|inflation|تورم", "Interest rates": r"interest\s*rate|نرخ\s*بهره", "Hack / exploit": r"\bhack|exploit|هک\b|هک\s|حمله\s*سایبری",
    "Airdrop": r"airdrop|ایردراپ|ایر\s*دراپ", "Token unlock": r"unlock|آنلاک", "Stablecoins": r"stablecoin|استیبل\s*کوین", "Staking": r"staking|استیکینگ",
    "Tariffs": r"tariff|تعرفه", "Liquidations": r"liquidat|لیکوئید|لیکویید", "Mining": r"\bmining\b|\bminers?\b|استخراج|ماینر",
}
ENT_RE = {k: re.compile(v, re.I) for k, v in ENTS.items()}


def entities(p):
    txt = " ".join([p.get("title") or "", p.get("text") or "", ((p.get("tr") or {}).get("en") or {}).get("text", "") if isinstance((p.get("tr") or {}).get("en"), dict) else ""])
    return [k for k, r in ENT_RE.items() if r.search(txt)][:8]


def shingles(t):
    w = t.split()
    return {" ".join(w[i:i + 3]) for i in range(max(1, len(w) - 2))} if w else set()


def main():
    posts = json.load(open(P, encoding="utf-8"))
    by_new = sorted(posts, key=lambda p: p.get("date") or "", reverse=True)
    sig = {}
    for p in by_new:
        n = norm(p.get("text") or p.get("title") or "")
        sig[p["id"]] = (n, shingles(n))
    # near-duplicates: compare with newer posts (same first 40 chars bucket or high shingle overlap)
    groups = defaultdict(list)
    for p in by_new:
        groups[sig[p["id"]][0][:40]].append(p)
    dup_of, dupn = {}, defaultdict(int)
    newest = []
    for p in by_new:
        n, sh = sig[p["id"]]
        if len(n) < 25:
            continue
        hit = None
        for q in groups[n[:40]]:
            if q is p:
                break
            if q["id"] in dup_of:
                continue
            nq, shq = sig[q["id"]]
            if nq == n or (sh and shq and len(sh & shq) / len(sh | shq) >= 0.85):
                hit = q
                break
        if not hit:
            for q in newest[-400:]:
                nq, shq = sig[q["id"]]
                if abs(len(nq) - len(n)) < 0.2 * len(n) and sh and shq and len(sh & shq) / len(sh | shq) >= 0.85:
                    hit = q
                    break
        if hit:
            dup_of[p["id"]] = hit["id"]
            dupn[hit["id"]] += 1
        else:
            newest.append(p)
    stats = defaultdict(int)
    for p in posts:
        txt = p.get("text") or ""
        s = strip(txt)
        cat = p.get("category")
        kind = KIND_OF_CAT.get(cat, "news")
        if cat == "community" and PROMO.search(txt):
            kind = "promo"
        elif kind in ("news", "analysis", "notice") and OPINION.search(s):
            kind = "opinion"
        elif kind in ("analysis", "news", "notice") and SIGNALW.search(s) and p.get("coins"):
            kind = "signal" if cat in ("technical", "signal") else kind
        elif kind == "notice" and EDUW.search(s[:200]):
            kind = "education"
        low = kind == "promo" or p["id"] in dup_of or (len(s) < 25 and not p.get("coins")) or (len(s) < 12)
        p["kind"] = kind
        p["q"] = "low" if low else "ok"
        if p["id"] in dup_of:
            p["dup"] = dup_of[p["id"]]
        else:
            p.pop("dup", None)
        if dupn.get(p["id"]):
            p["dupn"] = dupn[p["id"]] + 1
        else:
            p.pop("dupn", None)
        p["ents"] = entities(p)
        stats[kind] += 1
        stats["low"] += low
        stats["dup"] += p["id"] in dup_of
    json.dump(posts, open(P, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    def cut(t, n=240):
        t = t or ""
        return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + "…"
    lite = []
    for p in posts:
        x = {k: p.get(k) for k in ("id", "date", "title", "category", "coins", "hashtags", "tags", "views", "url", "link", "kind", "q", "dup", "dupn", "ents") if p.get(k) is not None}
        # نسخهٔ ذخیره‌شده در مخزن مقدم است؛ نشانی cdn4.telesco.pe منقضی می‌شود (scripts/postimg.py)
        local = p.get("img") or ""
        x["photos"] = [local] if local.startswith(("/data/postimg/", "/data/deepimg/")) else (p.get("photos") or [])[:1]
        if p.get("video"):
            x["video"] = True
        x["text"] = cut(p.get("text"))
        tr = {}
        for lg, v in (p.get("tr") or {}).items():
            if isinstance(v, dict) and v.get("title"):
                tr[lg] = {"title": v.get("title"), "text": cut(v.get("text"))}
        if tr:
            x["tr"] = tr
        lite.append(x)
    json.dump(lite, open(os.path.join(D, "posts_lite.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"enriched {len(posts)} posts at {datetime.now(timezone.utc):%H:%M} | " + ", ".join(f"{k}: {v}" for k, v in sorted(stats.items())))


if __name__ == "__main__":
    main()
