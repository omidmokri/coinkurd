#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ریل خبری چهارزبانهٔ entekhab.net  →  data/newsreel.json

- منبع اول (اگر کلید CRYPTOPANIC_TOKEN تنظیم شده باشد): CryptoPanic API v2 ـ /api/<plan>/v2/posts/
- منبع دوم (همیشه؛ و در نبودِ کلید تنها منبع): خبرخوان خودمان data/news.json
  (همان ناشرانی که CryptoPanic هم جمع می‌کند: CryptoSlate، U.Today، Bitcoin.com، CryptoPotato، …)
- فقط «تیتر + نام ناشر + لینک اصل خبر» برداشته می‌شود؛ متن خبر هیچ‌وقت کپی نمی‌شود.
- تیتر هر خبر یک بار به فارسی، کوردیی سۆرانی و عربی ترجمه و در data/newsreel_tr.json نگهداری می‌شود
  (ترجمه‌های آمادهٔ news.json ـ tfa/tckb ـ دوباره ترجمه نمی‌شوند).

خروجی سبک است (بدون متن خبر) چون خوانندگان سایت بیشتر روی اینترنت ایران‌اند.
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ai  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "newsreel.json")
TR = os.path.join(ROOT, "data", "newsreel_tr.json")
NEWS = os.path.join(ROOT, "data", "news.json")

KEEP = int(os.environ.get("REEL_KEEP", "30"))        # چند خبر در ستون‌های صفحهٔ اخبار
OC_KEEP = int(os.environ.get("REEL_OC_KEEP", "12"))  # دست‌کم چند خبر آنچینی برای صفحهٔ /onchain/
TR_MAX = int(os.environ.get("REEL_TR_MAX", "44"))    # سقف ترجمهٔ هر اجرا
BATCH = 10
PLAN = os.environ.get("CRYPTOPANIC_PLAN", "developer").strip() or "developer"
TOKEN = os.environ.get("CRYPTOPANIC_TOKEN", "").strip()
UA = {"User-Agent": "Mozilla/5.0 (compatible; entekhab.net newsreel)"}

GLOSS = ("Glossary — Bitcoin→بیت‌کوین/بیتکۆین/بيتكوين, Ethereum→اتریوم/ئیسریۆم/إيثريوم, "
         "exchange→صرافی/ئاڵوگۆڕگە/منصة تداول, whale→نهنگ/نەهەنگ/حوت, stablecoin→استیبل‌کوین/ستەیبڵکۆین/عملة مستقرة, "
         "liquidation→لیکوئید شدن/لیکویدەیشن/تصفية, ETF→ای‌تی‌اف/ئی‌تی‌ئێف/صندوق متداول. "
         "Keep tickers (BTC, ETH, ETF, SEC, Fed) and every number exactly as in the source.")


def load(p, d):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return d


def norm(s):
    """تیتر را برای تشخیص تکراری ساده می‌کند"""
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def iso(s):
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
    except Exception:  # noqa: BLE001
        return ""


def from_cryptopanic():
    """CryptoPanic API v2 — فقط اگر کلید داشته باشیم (نسخهٔ رایگان Developer: ۱۰۰۰ درخواست در ماه)"""
    if not TOKEN:
        return []
    url = f"https://cryptopanic.com/api/{PLAN}/v2/posts/"
    try:
        r = requests.get(url, params={"auth_token": TOKEN, "public": "true", "kind": "news"},
                         headers=UA, timeout=25)
        if r.status_code != 200:
            print(f"cryptopanic {r.status_code}: {r.text[:120]}")
            return []
        rows = (r.json() or {}).get("results") or []
    except Exception as ex:  # noqa: BLE001
        print(f"cryptopanic failed: {str(ex)[:120]}")
        return []
    out = []
    for p in rows:
        title = (p.get("title") or "").strip()
        if not title:
            continue
        src = (p.get("source") or {})
        if (src.get("region") or "en") != "en":          # ریل از تیتر انگلیسی ترجمه می‌شود
            continue
        out.append({
            "id": "cp" + str(p.get("id")),
            "at": iso(p.get("published_at") or p.get("created_at")),
            "url": p.get("original_url") or p.get("url") or "",
            "source": (src.get("title") or src.get("domain") or "CryptoPanic").strip(),
            "img": p.get("image") or "",
            "coins": [c.get("code") for c in (p.get("instruments") or []) if c.get("code")][:3],
            "t": {"en": title},
        })
    print(f"cryptopanic: {len(out)} items")
    return out


def from_house(limit=120):
    """خبرخوان خودمان: تیتر انگلیسی + ترجمه‌های آمادهٔ فارسی و سورانی"""
    items = (load(NEWS, {}) or {}).get("items", [])
    out = []
    for x in items[:limit]:
        title = (x.get("title") or "").strip()
        if not title:
            continue
        t = {"en": title}
        if x.get("tfa"):
            t["fa"] = x["tfa"].strip()
        if x.get("tckb"):
            t["ckb"] = x["tckb"].strip()
        out.append({
            "id": "hs" + str(x.get("id") or norm(title)[:24]),
            "at": iso(x.get("date")),
            "url": x.get("url") or "",
            "source": (x.get("source") or "").strip(),
            "img": x.get("img") or "",
            "coins": (x.get("coins") or [])[:3],
            "cat": x.get("category") or "",
            "t": t,
        })
    print(f"house feed: {len(out)} items")
    return out


def merge(*lists):
    """ادغام با حذف تکراری‌ها (بر پایهٔ تیتر و لینک)، تازه‌ترین اول"""
    seen_t, seen_u, out = set(), set(), []
    rows = [x for lst in lists for x in lst]
    rows.sort(key=lambda x: x.get("at") or "", reverse=True)
    for x in rows:
        k, u = norm(x["t"]["en"])[:70], (x.get("url") or "").split("?")[0]
        if not k or k in seen_t or (u and u in seen_u):
            continue
        seen_t.add(k)
        if u:
            seen_u.add(u)
        out.append(x)
    return out


# واژگان آنچین — برای ستون‌های کنار صفحهٔ /onchain/ (با norm() یکسان‌سازی می‌شوند)
OC = ("on chain", "onchain", "whale", "whales", "netflow", "net flow", "exchange reserve",
      "exchange reserves", "exchange inflow", "exchange inflows", "exchange outflow", "exchange outflows",
      "exchange balance", "exchange balances", "hashrate", "hash rate", "mining difficulty", "miner", "miners",
      "circulating supply", "supply held", "dormant", "realized cap", "realized price", "sopr", "mvrv", "nupl",
      "utxo", "utxos", "active addresses", "addresses", "wallets", "holders", "long term holders",
      "staking", "staked", "unstaked", "burned", "minted", "accumulation", "accumulating",
      "etf inflow", "etf inflows", "etf outflow", "etf outflows", "etf flows", "open interest",
      "stablecoin supply", "mempool", "block reward", "halving", "transaction fees", "on-chain")
OCN = tuple(" " + norm(k) + " " for k in OC if norm(k))
# خبرهایی که گاهی اشتباهی «آنچین» دسته‌بندی می‌شوند ولی دربارهٔ دادهٔ زنجیره نیستند
NOT_OC = tuple(" " + norm(k) + " " for k in
               ("ipo", "valuation", "funding round", "raises", "funding", "resigns", "appoints",
                "hires", "lawsuit", "sues", "acquires", "acquisition"))


def is_oc(x):
    """آیا خبر آنچینی است؟ اول دستهٔ خودِ خوراک، بعد واژگان بالا (ستون‌های /onchain/ فقط همین‌ها را می‌گیرند)"""
    t = " " + norm(x["t"]["en"]) + " "
    if any(k in t for k in OCN):
        return True
    return (x.get("cat") or "") == "onchain" and not any(k in t for k in NOT_OC)


def spread(rows):
    """ریل از یک ناشر پر نشود: نوبتی از هر ناشر یکی برمی‌داریم (تازه‌ترینِ هر ناشر جلوتر)"""
    buckets, order = {}, []
    for x in rows:
        k = (x.get("source") or "?").lower()
        if k not in buckets:
            buckets[k], _ = [], order.append(k)
        buckets[k].append(x)
    out = []
    while any(buckets[k] for k in order):
        for k in order:
            if buckets[k]:
                out.append(buckets[k].pop(0))
    return out


def ask(batch):
    """ترجمهٔ دسته‌ای تیترها با Gemini (ai.py)"""
    src = [{"i": n, "t": x["t"]["en"]} for n, x in enumerate(batch)]
    prompt = ("Translate these crypto/finance news headlines from English into fluent, natural Persian (Farsi), "
              "Central Kurdish (Sorani, Arabic script) and Modern Standard Arabic. News-agency headline style: "
              "faithful, compact, no additions, no commentary, no final full stop. " + GLOSS +
              '\nReturn ONLY a JSON array of objects: {"i": <same i>, "fa": "...", "ckb": "...", "ar": "..."}\n\n'
              + json.dumps(src, ensure_ascii=False))
    out = ai.generate(prompt, as_json=True, temperature=0.2, max_tokens=4096)
    txt = (out if isinstance(out, str) else json.dumps(out)).strip().strip("`")
    if txt.startswith("json"):
        txt = txt[4:]
    arr = json.loads(txt)
    if isinstance(arr, dict):
        arr = arr.get("items") or arr.get("results") or list(arr.values())[0]
    res = {}
    for r in arr:
        try:
            k = int(r.get("i", -1))
        except Exception:  # noqa: BLE001
            continue
        if 0 <= k < len(batch) and (r.get("fa") or r.get("ar")):
            res[batch[k]["id"]] = {g: (r.get(g) or "").strip() for g in ("fa", "ckb", "ar")}
    return res


_g = {}


def google(batch):
    """جایگزین رایگان وقتی کلید/سهمیهٔ هوش مصنوعی نیست"""
    from deep_translator import GoogleTranslator
    res = {}
    for x in batch:
        row = {}
        for lg in ("fa", "ckb", "ar"):
            try:
                if lg not in _g:
                    _g[lg] = GoogleTranslator(source="en", target=lg)
                row[lg] = _g[lg].translate(x["t"]["en"][:900]) or ""
                time.sleep(0.4)
            except Exception as ex:  # noqa: BLE001
                print(f"google {lg}: {str(ex)[:70]}")
        if row.get("fa") or row.get("ar"):
            res[x["id"]] = row
    return res


def translate(items):
    """هر تیتر یک بار؛ ترجمه‌ها در data/newsreel_tr.json می‌مانند"""
    mem = load(TR, {})
    todo = []
    for x in items:
        have = dict(mem.get(x["id"]) or {})
        have.update({k: v for k, v in x["t"].items() if k != "en" and v})   # tfa/tckb آمادهٔ news.json
        mem[x["id"]] = have
        if not all(have.get(g) for g in ("fa", "ckb", "ar")):
            todo.append(x)
    todo = todo[:TR_MAX]
    if todo:
        eng = "gemini" if ai.available() else "google"
        for n in range(0, len(todo), BATCH):
            part = todo[n:n + BATCH]
            try:
                got = ask(part) if eng == "gemini" else google(part)
            except Exception as ex:  # noqa: BLE001
                print(f"{eng} batch failed: {str(ex)[:120]}")
                if eng == "gemini":
                    eng = "google"
                    try:
                        got = google(part)
                    except Exception as ex2:  # noqa: BLE001
                        print(f"google batch failed: {str(ex2)[:120]}")
                        got = {}
                else:
                    got = {}
            for k, v in got.items():
                row = dict(mem.get(k) or {})
                for g in ("fa", "ckb", "ar"):
                    if v.get(g) and not row.get(g):
                        row[g] = v[g]
                mem[k] = row
        print(f"translated: {len(todo)} headlines via {eng}")
    for x in items:                                   # هر زبانی که نبود، انگلیسی می‌ماند
        for g in ("fa", "ckb", "ar"):
            v = (mem.get(x["id"]) or {}).get(g)
            if v:
                x["t"][g] = v
    # حافظه را به شناسه‌های موجود + ۴۰۰ شناسهٔ آخر محدود کن تا فایل بی‌نهایت رشد نکند
    keep = {x["id"] for x in items}
    trimmed = {k: v for k, v in list(mem.items())[-400:]}
    trimmed.update({k: mem[k] for k in keep if k in mem})
    with open(TR, "w", encoding="utf-8") as f:
        json.dump(trimmed, f, ensure_ascii=False, indent=1, sort_keys=True)
    return items


def main():
    cp = from_cryptopanic()
    rows = merge(cp, from_house(400))          # کل خوراک، تازه‌ترین اول
    items = spread([x for x in rows[:140]])[:KEEP]
    have = {x["id"] for x in items}
    for x in [y for y in rows if is_oc(y)]:    # ستون‌های /onchain/ خوراک آنچینی جدا می‌خواهند
        if sum(1 for y in items if is_oc(y)) >= OC_KEEP:
            break
        if x["id"] not in have:
            items.append(x)
            have.add(x["id"])
    for x in items:
        x["oc"] = 1 if is_oc(x) else 0
    items = translate(items)
    full = [x for x in items if all(x["t"].get(g) for g in ("fa", "ckb", "ar", "en"))]
    if len(full) >= 12:                      # خبری که هنوز ترجمه نشده نمایش داده نمی‌شود
        items = full
    out = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "sources": (["CryptoPanic"] if cp else []) + ["entekhab.net"],
        "items": items,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    done = sum(1 for x in items if all(x["t"].get(g) for g in ("fa", "ckb", "ar", "en")))
    print(f"newsreel.json: {len(items)} items ({done} fully translated), {os.path.getsize(OUT)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
