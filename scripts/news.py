#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
خبرخوان چندمنبعی (RSS رایگان، بدون کلید) — نسخهٔ ۲

- سه بخش: «فارسی» (کریپتو + اقتصاد ایران + خلاصه‌های کوین کورد)، «کریپتو جهانی» و «بازارهای جهانی»
- از هر خبر: تیتر، لینک منبع، تصویر شاخص و «چکیدهٔ کوتاه» همان‌که خود ناشر در RSS منتشر کرده
  (متن کامل خبر کپی نمی‌شود؛ چکیده حداکثر ~۶۰۰ نویسه و همیشه با نام و لینک منبع)
- خبرهای تکراری بین منابع با شباهت تیتر ادغام می‌شوند و همهٔ منابع نگه داشته می‌شوند
- اگر یک منبع از کار بیفتد بقیه ادامه می‌دهند؛ خبرهای قبلی حفظ می‌شوند
- ترجمه‌های ساخته‌شده توسط news_tr.py (data/news_tr.json) دوباره به خبرها چسبانده می‌شوند

خروجی:
  data/news.json       ← سبک؛ برای صفحهٔ اصلی (تیتر، تصویر، منبع، تیتر ترجمه‌شده)
  data/news_body.json  ← چکیده‌ها و ترجمهٔ چکیده‌ها؛ فقط وقتی کاربر خبری را باز می‌کند بارگذاری می‌شود
"""
import hashlib
import html
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from difflib import SequenceMatcher
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from categories import COINS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "news.json")
BODY = os.path.join(ROOT, "data", "news_body.json")
TR = os.path.join(ROOT, "data", "news_tr.json")
CK = os.path.join(ROOT, "data", "cryptonews.json")

# کریپتو جهانی (انگلیسی) — همین فهرست items است که narratives/score/brain/... از آن استفاده می‌کنند
FEEDS = {
    "CoinDesk": "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "Cointelegraph": "https://cointelegraph.com/rss",
    "Decrypt": "https://decrypt.co/feed",
    "The Block": "https://www.theblock.co/rss.xml",
    "Bitcoin Magazine": "https://bitcoinmagazine.com/.rss/full/",
    "CryptoSlate": "https://cryptoslate.com/feed/",
    "Blockworks": "https://blockworks.co/feed",
    "U.Today": "https://u.today/rss",
    "Bitcoinist": "https://bitcoinist.com/feed/",
    "NewsBTC": "https://www.newsbtc.com/feed/",
    "CryptoPotato": "https://cryptopotato.com/feed/",
    "BeInCrypto": "https://beincrypto.com/feed/",
    "crypto.news": "https://crypto.news/feed/",
    "The Daily Hodl": "https://dailyhodl.com/feed/",
    "Bitcoin.com News": "https://news.bitcoin.com/feed/",
    "CoinGape": "https://coingape.com/feed/",
    "Crypto Briefing": "https://cryptobriefing.com/feed/",
    "AMBCrypto": "https://ambcrypto.com/feed/",
    "The Defiant": "https://thedefiant.io/api/feed",
    "CoinJournal": "https://coinjournal.net/feed/",
}
# بازارهای جهانی (اقتصاد کلان، سهام، طلا و نفت) — جدا از items تا روایت‌ها و امتیاز کریپتو آلوده نشوند
FEEDS_WORLD = {
    "BBC Business": "https://feeds.bbci.co.uk/news/business/rss.xml",
    "CNBC Markets": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "CNBC Economy": "https://www.cnbc.com/id/20910258/device/rss/rss.html",
    "MarketWatch": "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    "Yahoo Finance": "https://finance.yahoo.com/news/rssindex",
    "Guardian Business": "https://www.theguardian.com/uk/business/rss",
    "Al Jazeera Economy": "https://www.aljazeera.com/xml/rss/all.xml",
}
# فارسی: کریپتو
FEEDS_FA = {
    "ارزدیجیتال": "https://arzdigital.com/feed/",
    "رمزارز": "https://ramzarz.news/feed/",
    "مجله نوبیتکس": "https://nobitex.ir/mag/feed/",
    "میهن بلاکچین": "https://mihanblockchain.com/feed/",
    "بلاگ والکس": "https://wallex.ir/blog/feed/",
    "ارز تودی": "https://arztoday.com/feed/",
    "کوین ایران": "https://coiniran.com/feed",
    "دیجی ارز": "https://digiarz.com/feed/",
}
# فارسی: اقتصاد ایران (فقط خبرهای مرتبط با بازارها نگه داشته می‌شوند)
FEEDS_FA_ECON = {
    "تجارت نیوز": "https://www.tejaratnews.com/feed",
    "دنیای اقتصاد": "https://donya-e-eqtesad.com/feeds",
    "اقتصادنیوز": "https://www.eghtesadnews.com/feeds/",
    "اکوایران": "https://ecoiran.com/feeds/",
    "ایسنا اقتصادی": "https://www.isna.ir/rss/tp/34",
}
MARKET_FA = re.compile(r"دلار|یورو|طلا|سکه|نقره|بورس|سهام|شاخص|ارز|تورم|نفت|بانک مرکزی|بازار|رمزارز|بیت ?کوین|کریپتو|تتر|"
                       r"نرخ|قیمت|بهره|فدرال|ریال|صادرات|واردات|مسکن|خودرو|سرمایه|تحریم|اقتصاد|بودجه|نقدینگی|صندوق")
WORLD_KEEP = re.compile(r"market|stock|share|econom|inflation|\bfed\b|rate|bank|dollar|oil|gold|bond|yield|trade|tariff|"
                        r"price|invest|crypto|bitcoin|currenc|gdp|jobs|earning|wall street|nasdaq|s&p|dow|opec|recession", re.I)

UA = {"User-Agent": "Mozilla/5.0 (entekhab.net news bot; +https://entekhab.net)",
      "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8"}
KEEP_DAYS = 7
NS = {"media": "http://search.yahoo.com/mrss/", "content": "http://purl.org/rss/1.0/modules/content/",
      "atom": "http://www.w3.org/2005/Atom"}
URL_OK = re.compile(r"^https?://[^\s\"'<>]+$", re.I)


def nid(url):
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:11]


def norm(t):
    return re.sub(r"[^a-z0-9 ]+", " ", t.lower()).strip()


def norm_fa(t):
    t = re.sub(r"[‌ً-ٟ]", "", t).replace("ي", "ی").replace("ك", "ک")
    return re.sub(r"[^\w ]+", " ", t).strip()


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


JUNK = [
    re.compile(r"The post .{0,300}? appeared first on .{0,120}?\.?$", re.S | re.I),
    re.compile(r"نوشته .{0,300}? (?:اولین بار|نخستین بار) در .{0,120}? (?:پدیدار شد|منتشر شد)\.?$", re.S),
    re.compile(r"(?:Continue reading|Read more|Read More|ادامه مطلب|ادامه خبر|بیشتر بخوانید).{0,200}$", re.S),
    re.compile(r"\[(?:…|\.\.\.|&#8230;)\]"),
]


def clean_text(raw, limit=600):
    if not raw:
        return ""
    t = re.sub(r"<(script|style|figure|figcaption)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
    t = re.sub(r"<br\s*/?>|</p>|</li>|</h\d>", "\n", t, flags=re.I)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    for rx in JUNK:
        t = rx.sub("", t)
    t = re.sub(r"[ \t ]+", " ", t)
    t = re.sub(r"\s*\n\s*", "\n", t).strip()
    if len(t) > limit:                        # فقط یک چکیدهٔ کوتاه، بریده در مرز جمله
        cut = t[:limit]
        m = max(cut.rfind(". "), cut.rfind(".\n"), cut.rfind("؟"), cut.rfind("! "), cut.rfind("۔"))
        t = (cut[:m + 1] if m > limit * 0.5 else cut.rsplit(" ", 1)[0]) + " …"
    return t


def first_img(*htmls):
    for h in htmls:
        if not h:
            continue
        m = re.search(r"<img[^>]+(?:data-src|src)=[\"'](https?://[^\"']+)[\"']", h, re.I)
        if m and not re.search(r"(pixel|feedburner|gravatar|emoji|\.gif)(\b|$)", m.group(1), re.I):
            return html.unescape(m.group(1))
    return ""


def fetch(name, url, n=40):
    r = requests.get(url, headers=UA, timeout=20)
    r.raise_for_status()
    root = ET.fromstring(r.content)
    items = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
    out = []
    for it in items[:n]:
        def tx(tag):
            el = it.find(tag, NS) if ":" in tag else it.find(tag)
            if el is None and ":" not in tag:
                el = it.find("{http://www.w3.org/2005/Atom}" + tag)
            return (el.text or "").strip() if el is not None and el.text else ""
        title = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", tx("title")))).strip()
        link = tx("link")
        if not link:
            le = it.find("{http://www.w3.org/2005/Atom}link")
            link = le.get("href") if le is not None else ""
        link = (link or "").strip()
        d = parse_date(tx("pubDate") or tx("published") or tx("updated") or tx("{http://purl.org/dc/elements/1.1/}date"))
        if not URL_OK.match(link) or not title or not d:   # never publish javascript:/data: links from a feed
            continue
        desc, content = tx("description") or tx("summary"), tx("content:encoded") or tx("content")
        img = ""
        for tag in ("media:content", "media:thumbnail"):
            for el in it.findall(tag, NS):
                u = el.get("url") or ""
                if URL_OK.match(u) and (el.get("medium") in (None, "image") or re.search(r"\.(jpe?g|png|webp)", u, re.I)):
                    img = u
                    break
            if img:
                break
        if not img:
            for el in it.findall(".//media:group/media:content", NS):
                if URL_OK.match(el.get("url") or ""):
                    img = el.get("url")
                    break
        if not img:
            enc = it.find("enclosure")
            if enc is not None and (enc.get("type") or "").startswith("image") and URL_OK.match(enc.get("url") or ""):
                img = enc.get("url")
        img = img or first_img(content, desc)
        summ = clean_text(desc) or clean_text(content, 450)
        nk = norm if title.isascii() else norm_fa
        if summ and nk(summ)[:60] == nk(title)[:60] and len(summ) < len(title) + 20:
            summ = ""
        row = {"title": title, "url": link, "source": name, "date": d.isoformat(), "_s": summ}
        if img and URL_OK.match(img):
            row["img"] = img
        out.append(row)
    return out


def fetch_all(feeds, n=40):
    status, got = {}, []

    def one(kv):
        name, url = kv
        for attempt in (0, 1):
            try:
                return name, fetch(name, url, n), None
            except Exception as e:  # noqa: BLE001
                err = str(e)[:120]
                time.sleep(1.5)
        return name, [], err
    with ThreadPoolExecutor(8) as ex:
        for name, rows, err in ex.map(one, feeds.items()):
            status[name] = {"ok": err is None, "n": len(rows)} if err is None else {"ok": False, "err": err}
            got.extend(rows)
    return got, status


EN_COINS = {k: [n for n in v if n.isascii()] for k, v in COINS.items()}
CAT_EN = {
    "security": r"hack|exploit|stolen|breach|scam|drain|phish",
    "regulation": r"\bsec\b|regulat|law|bill|senat|congress|ban|court|tax|cftc|policy|government|reserve",
    "etf_institutional": r"\betf\b|blackrock|fidelity|treasury|institution|grayscale|inflow|outflow|strategy|microstrategy|bank",
    "onchain": r"on-chain|onchain|whale|hashrate|miner|liquidat|open interest|funding",
    "technical": r"support|resistance|breakout|chart|technical|rsi|pattern|rally|price analysis|price prediction",
}
CAT_WORLD = {
    "w_rates": r"\bfed\b|federal reserve|rate|inflation|cpi|ecb|central bank|bond|yield|treasur",
    "w_stocks": r"stock|share|nasdaq|s&p|dow|wall street|earning|ipo",
    "w_commod": r"\boil\b|opec|gold|silver|copper|gas price|commodit",
    "w_fx": r"dollar|currenc|yen|euro|yuan|sterling|pound",
    "w_trade": r"tariff|trade|export|import|sanction",
}
CAT_FA = {
    "f_gold": r"طلا|سکه|نقره",
    "f_fx": r"دلار|یورو|ارز|درهم|ریال",
    "f_stock": r"بورس|سهام|شاخص کل|صندوق",
    "f_oil": r"نفت|بنزین|اوپک|گاز",
    "f_crypto": r"رمزارز|بیت ?کوین|کریپتو|تتر|اتریوم|آلت ?کوین|صرافی|توکن|بلاکچین|ارز دیجیتال",
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


def merge_dupes(items, key, ratio=0.72):
    items.sort(key=lambda i: i["date"])
    merged = []
    for it in items:
        nt = key(it["title"])
        dup = None
        for m in merged[-200:]:
            if m["url"] == it["url"] or (nt and SequenceMatcher(None, m["_n"], nt).ratio() > ratio):
                dup = m
                break
        if dup:
            srcs = {s["source"] for s in dup["sources"]}
            for s in it.get("sources") or [{"source": it["source"], "url": it["url"]}]:
                if s["source"] not in srcs:
                    dup["sources"].append(s)
            for f in ("img", "_s"):
                if not dup.get(f) and it.get(f):
                    dup[f] = it[f]
        else:
            it = dict(it)
            it["_n"] = nt
            it["sources"] = it.get("sources") or [{"source": it["source"], "url": it["url"]}]
            merged.append(it)
    merged.sort(key=lambda i: i["date"], reverse=True)
    return merged


def load(path, default):
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return default


def coinkurd_items():
    """خلاصه‌های فارسی/سورانی ربات کوین کورد (data/cryptonews.json) — محتوای خود سایت؛ متن کامل نمایش داده می‌شود"""
    out = []
    for it in (load(CK, {}).get("items") or [])[:24]:
        fa = (it.get("fa") or "").strip()
        if not fa or not it.get("at"):
            continue
        lines = [x for x in fa.split("\n") if x.strip()]
        title = re.sub(r"\s*[\U0001F300-\U0001FAFF☀-➿]+\s*$", "", lines[0]).strip()
        body = "\n".join(x for x in lines[1:] if not x.strip().startswith("#"))
        ck = [x for x in (it.get("ckb") or "").split("\n") if x.strip()]
        row = {"id": "ck" + nid(it["id"]), "title": title, "url": "https://t.me/Coin_Kurd", "source": "کوین کورد",
               "date": datetime.fromisoformat(it["at"]).astimezone(timezone.utc).isoformat(), "own": 1,
               "_s": body, "_ckb": "\n".join(x for x in ck[1:] if not x.strip().startswith("#")),
               "_ckt": ck[0] if ck else ""}
        if it.get("img"):
            row["img"] = it["img"]
        out.append(row)
    return out


def main():
    old = load(OUT, {"items": []})
    tr = load(TR, {})
    body = {}

    def attach(it, keep_body=True):
        it.setdefault("id", nid(it["url"]))
        s = it.pop("_s", "")
        t = tr.get(it["id"]) or {}
        b = {}
        if keep_body and s:
            b["s"] = s
        for lg in ("fa", "ckb", "en"):
            if t.get(lg + "_t"):
                it["t" + lg] = t[lg + "_t"]
            if keep_body and t.get(lg + "_s"):
                b[lg] = t[lg + "_s"]
        if b:
            body[it["id"]] = b
        return it

    # ---------------------------------------------------------------- global crypto (items)
    got, status = fetch_all(FEEDS)
    prev = [dict(i) for i in old.get("items", [])]
    prev_body = load(BODY, {}).get("b", {})
    for p in prev:                                     # چکیدهٔ خبرهای قبلی را نگه دار
        pid = p.get("id") or nid(p["url"])
        if prev_body.get(pid, {}).get("s"):
            p["_s"] = prev_body[pid]["s"]
    cutoff = datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)
    items = [i for i in prev + got if datetime.fromisoformat(i["date"]) >= cutoff]
    merged = [tag(m) for m in merge_dupes(items, norm)][:400]
    for k, m in enumerate(merged):
        m.pop("_n", None)
        for f in ("tfa", "tckb", "ten"):
            m.pop(f, None)
        attach(m, keep_body=k < 160)

    # ---------------------------------------------------------------- world markets
    wgot, wstatus = fetch_all(FEEDS_WORLD, 30)
    wgot = [w for w in wgot if WORLD_KEEP.search(w["title"] + " " + w.get("_s", "")[:200])]
    wprev = [dict(i) for i in (old.get("world") or {}).get("items", [])]
    for p in wprev:
        if prev_body.get(p.get("id", ""), {}).get("s"):
            p["_s"] = prev_body[p["id"]]["s"]
    wcut = datetime.now(timezone.utc) - timedelta(days=3)
    world = merge_dupes([i for i in wprev + wgot if datetime.fromisoformat(i["date"]) >= wcut], norm, 0.7)[:90]
    for w in world:
        w.pop("_n", None)
        for f in ("tfa", "tckb", "ten"):
            w.pop(f, None)
        t = w["title"].lower()
        w["category"] = next((c for c, rx in CAT_WORLD.items() if re.search(rx, t)), "w_macro")
        w["coins"] = [k for k, names in EN_COINS.items()
                      if any(re.search(r"(?<![a-z0-9])" + re.escape(nm.lower()) + r"(?![a-z0-9])", t) for nm in names)][:3]
        attach(w)
    if not world:
        world = (old.get("world") or {}).get("items", [])

    # ---------------------------------------------------------------- Persian (crypto + Iran economy + Coin Kurd)
    rgot, rstatus = fetch_all(FEEDS_FA, 30)
    egot, estatus = fetch_all(FEEDS_FA_ECON, 40)
    for e in egot:
        e["_econ"] = 1
    egot = [e for e in egot if MARKET_FA.search(e["title"])]
    rprev = [dict(i) for i in (old.get("regional") or {}).get("items", []) if not i.get("own")]
    for p in rprev:
        if prev_body.get(p.get("id", ""), {}).get("s"):
            p["_s"] = prev_body[p["id"]]["s"]
        if p.get("sec") == "economy":
            p["_econ"] = 1
    rcut = datetime.now(timezone.utc) - timedelta(days=3)
    reg = [i for i in rprev + rgot + egot if datetime.fromisoformat(i["date"]) >= rcut]
    regional = merge_dupes(reg, norm_fa, 0.8)
    for it in regional:
        it.pop("_n", None)
        it.pop("ten", None)
        t = it["title"].lower()
        it["coins"] = [k for k, names in COINS.items() if any(nm.lower() in t for nm in names if len(nm) > 2)][:4]
        it["sec"] = "economy" if it.pop("_econ", None) else "crypto"
        it["category"] = next((c for c, rx in CAT_FA.items() if re.search(rx, t)), "f_news")
    own = coinkurd_items()
    for o in own:
        o["sec"], o["category"], o["coins"] = "coinkurd", "f_crypto", []
        o["sources"] = [{"source": o["source"], "url": o["url"]}]
        ckb_s, ckb_t = o.pop("_ckb", ""), o.pop("_ckt", "")
        attach(o)
        if ckb_t:
            o["tckb"] = ckb_t
        if ckb_s:
            body.setdefault(o["id"], {})["ckb"] = ckb_s
    regional = sorted(regional + own, key=lambda i: i["date"], reverse=True)[:180]
    for it in regional:
        if not it.get("own"):
            attach(it)
    if not [r for r in regional if not r.get("own")]:   # همهٔ منابع فارسی شکست خوردند → فهرست قبلی
        regional = (old.get("regional") or {}).get("items", []) or regional

    ok = sum(1 for s in status.values() if s["ok"])
    rstatus.update(estatus)
    data = {"updated_at": datetime.now(timezone.utc).isoformat(), "feeds": status, "items": merged,
            "regional": {"feeds": rstatus, "items": regional},
            "world": {"feeds": wstatus, "items": world}}
    json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    keep = {i["id"] for i in merged + world + regional}
    json.dump({"updated_at": data["updated_at"], "b": {k: v for k, v in body.items() if k in keep}},
              open(BODY, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"crypto feeds ok {ok}/{len(FEEDS)}; items {len(merged)}; multi-source {sum(1 for m in merged if len(m['sources']) > 1)}")
    print(f"world ok {sum(1 for s in wstatus.values() if s['ok'])}/{len(FEEDS_WORLD)} → {len(world)}; "
          f"persian ok {sum(1 for s in rstatus.values() if s['ok'])}/{len(rstatus)} → {len(regional)} (own {len(own)}); bodies {len(body)}")
    if ok == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
