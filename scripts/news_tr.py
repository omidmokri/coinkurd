#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ترجمهٔ هم‌زمان اخبار جهانی → فارسی و کوردی سورانی

- تیتر + چکیدهٔ جدیدترین خبرهای «کریپتو جهانی» و «بازارهای جهانی» را ترجمه می‌کند
- موتور: Gemini (ai.py، دسته‌ای و JSON) ← اگر کلید/سهمیه نبود: Google Translate رایگان (deep-translator)
- حافظهٔ ترجمه در data/news_tr.json (هر خبر یک بار ترجمه می‌شود)؛ سپس ترجمه‌ها در news.json و news_body.json درج می‌شوند
- سقف هر اجرا: NEWS_TR_MAX (پیش‌فرض ۲۴ خبر)
"""
import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ai  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWS = os.path.join(ROOT, "data", "news.json")
BODY = os.path.join(ROOT, "data", "news_body.json")
TR = os.path.join(ROOT, "data", "news_tr.json")
MAX = int(os.environ.get("NEWS_TR_MAX", "24"))
BATCH = 12
GLOSS = ("Glossary: Bitcoin→بیت‌کوین/بیتکۆین, Ethereum→اتریوم/ئیسریۆم, exchange→صرافی/ئاڵوگۆڕگە, whale→نهنگ/نەهەنگ, "
         "stablecoin→استیبل‌کوین/ستەیبڵکۆین, liquidation→لیکوئید شدن/لیکویدەیشن, hack→هک/هاک, Fed→فدرال رزرو/فیدراڵ ڕیزێرڤ. "
         "Keep tickers (BTC, ETH, ETF, SEC) and numbers exactly as in the source.")


def load(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return d


def gemini(batch):
    src = [{"i": k, "t": it["title"], "s": it.get("s", "")[:700]} for k, it in enumerate(batch)]
    prompt = ("Translate these financial/crypto news headlines (t) and summaries (s) from English into fluent, natural "
              "Persian (Farsi) and Central Kurdish (Sorani, Arabic script). News-agency style, faithful, no additions, "
              "no commentary. " + GLOSS + "\nReturn ONLY a JSON array of objects: "
              '{"i": <same i>, "fa_t": "...", "fa_s": "...", "ckb_t": "...", "ckb_s": "..."} '
              "(use an empty string for s when the input s is empty).\n\n" + json.dumps(src, ensure_ascii=False))
    out = ai.generate(prompt, as_json=True, temperature=0.2, max_tokens=8192)
    txt = out if isinstance(out, str) else json.dumps(out)
    txt = txt.strip().strip("`")
    if txt.startswith("json"):
        txt = txt[4:]
    arr = json.loads(txt)
    if isinstance(arr, dict):
        arr = arr.get("items") or arr.get("results") or list(arr.values())[0]
    res = {}
    for r in arr:
        k = int(r.get("i", -1))
        if 0 <= k < len(batch) and r.get("fa_t"):
            res[batch[k]["id"]] = {f: (r.get(f) or "").strip() for f in ("fa_t", "fa_s", "ckb_t", "ckb_s")}
    return res


_g = {}


def google(batch):
    from deep_translator import GoogleTranslator
    res = {}
    for it in batch:
        row = {}
        for lg in ("fa", "ckb"):
            try:
                if lg not in _g:
                    _g[lg] = GoogleTranslator(source="en", target=lg)
                row[lg + "_t"] = _g[lg].translate(it["title"][:4500]) or ""
                row[lg + "_s"] = _g[lg].translate(it["s"][:4500]) if it.get("s") else ""
                time.sleep(0.4)
            except Exception as e:  # noqa: BLE001
                print(f"google {lg} failed: {str(e)[:80]}")
        if row.get("fa_t"):
            row["eng"] = "google"
            res[it["id"]] = row
    return res


def main():
    news, body = load(NEWS, {}), load(BODY, {"b": {}})
    tr = load(TR, {})
    b = body.setdefault("b", {})
    pool = sorted((news.get("items") or [])[:80] + ((news.get("world") or {}).get("items") or [])[:50],
                  key=lambda i: i["date"], reverse=True)
    todo = [{"id": i["id"], "title": i["title"], "s": (b.get(i["id"]) or {}).get("s", "")}
            for i in pool if i.get("id") and i["id"] not in tr][:MAX]
    done, engine = {}, "gemini"
    for k in range(0, len(todo), BATCH):
        chunk = todo[k:k + BATCH]
        got = {}
        if engine == "gemini" and ai.available():
            try:
                got = gemini(chunk)
            except Exception as e:  # noqa: BLE001
                print(f"gemini translate failed: {str(e)[:120]} → google")
                engine = "google"
        if not got:
            try:
                got = google(chunk)
            except Exception as e:  # noqa: BLE001
                print(f"google translate failed: {str(e)[:120]}")
        done.update(got)
    now = datetime.now(timezone.utc).isoformat()
    for k, v in done.items():
        v["at"] = now
        tr[k] = v
    cut = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()   # حافظه را کوچک نگه دار
    tr = {k: v for k, v in tr.items() if v.get("at", now) >= cut}
    json.dump(tr, open(TR, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    # درج در خروجی‌ها (news.py هم در اجرای بعدی از همین حافظه درج می‌کند)
    for sec in (news.get("items") or [], (news.get("world") or {}).get("items") or []):
        for it in sec:
            t = tr.get(it.get("id"))
            if not t:
                continue
            for lg in ("fa", "ckb"):
                if t.get(lg + "_t"):
                    it["t" + lg] = t[lg + "_t"]
                if t.get(lg + "_s"):
                    b.setdefault(it["id"], {})[lg] = t[lg + "_s"]
    if news:
        json.dump(news, open(NEWS, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        json.dump(body, open(BODY, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"news translated this run: {len(done)}/{len(todo)}; cache {len(tr)}")


if __name__ == "__main__":
    main()
