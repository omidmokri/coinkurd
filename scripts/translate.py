#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ربات ترجمهٔ خودکار: متن فارسی هر پست → کوردی سورانی (ckb) و انگلیسی (en)

موتور ترجمه (به ترتیب اولویت):
  1. Claude (Anthropic)  ← اگر ANTHROPIC_API_KEY تنظیم شده باشد (کیفیت بالا، دقیق)
  2. OpenAI              ← اگر OPENAI_API_KEY تنظیم شده باشد
  3. Google Translate (رایگان، deep-translator) ← پیش‌فرض؛ از IP گیت‌هاب اغلب محدود می‌شود

خروجی در هر پست: p["tr"] = {"ckb": {"title":..., "text":...}, "en": {...}, "engine": "claude"|"google"}
فقط پست‌هایی ترجمه می‌شوند که هنوز ترجمه ندارند؛ سقف هر اجرا با --limit.
"""
import argparse
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ai  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS_FILE = os.path.join(ROOT, "data", "posts.json")

LANGS = {"ckb": "Central Kurdish (Sorani, Arabic script)", "en": "English"}
PERSIAN_RE = re.compile(r"[؀-ۿ]")


def has_persian(t: str) -> bool:
    return bool(t) and len(PERSIAN_RE.findall(t)) >= 3


# ------------------------------------------------------------------ engines

_claude_model = None


def claude_model(api_key: str) -> str:
    """مدل را از تنظیمات یا از لیست مدل‌های در دسترس حساب انتخاب می‌کند."""
    global _claude_model
    if _claude_model:
        return _claude_model
    env = os.environ.get("CLAUDE_MODEL", "").strip()
    if env:
        _claude_model = env
        return env
    import requests
    try:
        r = requests.get("https://api.anthropic.com/v1/models?limit=100",
                         headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"}, timeout=30)
        r.raise_for_status()
        ids = [m["id"] for m in r.json().get("data", [])]
        pick = next((i for i in ids if "sonnet" in i), None) or next((i for i in ids if "haiku" in i), None) or (ids[0] if ids else None)
        if pick:
            print(f"claude model: {pick}")
            _claude_model = pick
            return pick
    except Exception as e:  # noqa: BLE001
        print(f"could not list models: {e}", file=sys.stderr)
    _claude_model = "claude-sonnet-4-5"
    return _claude_model


def claude_translate(text: str, lang: str, api_key: str) -> str:
    import requests
    prompt = (
        f"Translate the following Persian (Farsi) crypto-channel post into {LANGS[lang]}. "
        "Keep the meaning exact, keep numbers, tickers (BTC, ETH…), hashtags, emojis, URLs and line breaks unchanged. "
        "For Sorani use standard Sorani Kurdish orthography in Arabic script. "
        "Return ONLY the translated text, nothing else.\n\n" + text
    )
    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        json={"model": claude_model(api_key), "max_tokens": 2000,
              "messages": [{"role": "user", "content": prompt}]},
        timeout=60,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"{r.status_code}: {r.text[:300]}")
    return "".join(b.get("text", "") for b in r.json()["content"]).strip()


def openai_translate(text: str, lang: str, api_key: str) -> str:
    import requests
    prompt = (
        f"Translate the following Persian (Farsi) crypto-channel post into {LANGS[lang]}. "
        "Keep the meaning exact, keep numbers, tickers, hashtags, emojis, URLs and line breaks unchanged. "
        "For Sorani use standard Sorani Kurdish orthography in Arabic script. Return ONLY the translation.\n\n" + text
    )
    r = requests.post("https://api.openai.com/v1/chat/completions",
                      headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
                      json={"model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"), "temperature": 0.2,
                            "messages": [{"role": "user", "content": prompt}]}, timeout=60)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


_google = {}


def google_translate(text: str, lang: str) -> str:
    from deep_translator import GoogleTranslator
    if lang not in _google:
        _google[lang] = GoogleTranslator(source="fa", target=lang)
    # گوگل محدودیت ۵۰۰۰ کاراکتر دارد؛ پاراگراف‌به‌پاراگراف ترجمه می‌کنیم
    out = []
    for para in text.split("\n"):
        if not para.strip() or not has_persian(para):
            out.append(para)
            continue
        out.append(_google[lang].translate(para[:4900]) or para)
        time.sleep(0.4)
    return "\n".join(out)


def translate(text: str, lang: str, api_key: str) -> str:
    if api_key:
        return claude_translate(text, lang, api_key)
    oa = os.environ.get("OPENAI_API_KEY", "").strip()
    if oa:
        return openai_translate(text, lang, oa)
    return google_translate(text, lang)


# ------------------------------------------------------------------ main

TR_FILE = os.path.join(ROOT, "data", "translations.json")
GLOSSARY = """Crypto glossary (Persian → Sorani / English) — use these consistently:
بیت‌کوین → بیتکۆین / Bitcoin; اتریوم → ئیسریۆم / Ethereum; رمزارز / ارز دیجیتال → دراوی دیجیتاڵ / cryptocurrency;
صرافی → ئاڵوگۆڕگە / exchange; نهنگ → نەهەنگ / whale; حمایت → پاڵپشتی / support; مقاومت → بەرگری / resistance;
خط روند → هێڵی ڕەوت / trendline; روند صعودی → ڕەوتی سەعودی / uptrend; روند نزولی → ڕەوتی دابەزین / downtrend;
حد ضرر → سنووری زیان / stop loss; حد سود / تارگت → ئامانج / take profit, target; لیکوییدیشن → لیکویدەیشن / liquidation;
نرخ تأمین مالی (فاندینگ) → Funding Rate (keep English term); اوپن اینترست → Open Interest (keep); ETF → ETF (keep);
صندوق → سندووق / fund; خزانه‌داری → گەنجینە / treasury; هک → هاک / hack; استیبل‌کوین → ستەیبڵکۆین / stablecoin;
اندیکاتور → ئیندیکاتۆر / indicator; واگرایی → لادان / divergence; اشباع خرید → زیادە کڕین / overbought; اشباع فروش → زیادە فرۆشتن / oversold."""


def gemini_translate(p):
    prompt = (
        "You are a professional financial translator. Translate this Persian (Farsi) crypto-channel post into\n"
        "1) Central Kurdish (Sorani, Arabic script, standard orthography with ە ێ ۆ ڵ ڕ ڤ) and 2) English.\n"
        "Rules: exact meaning, no additions or commentary; keep numbers, tickers, emojis, URLs and markdown links "
        "[label](url) unchanged; translate hashtag words but keep # and underscores; keep line breaks.\n"
        "If the title is emoji-only, write a short headline from the post.\n"
        + GLOSSARY +
        "\nReturn JSON exactly: {\"ckb\":{\"title\":\"\",\"text\":\"\"},\"en\":{\"title\":\"\",\"text\":\"\"}}\n\n"
        f"TITLE:\n{p['title']}\n\nTEXT:\n{p['text']}"
    )
    r = ai.generate(prompt, as_json=True, max_tokens=8192)
    for lg in ("ckb", "en"):
        if not (r.get(lg) or {}).get("text"):
            raise RuntimeError(f"incomplete {lg}")
    if not re.search(r"[ەێۆڵڕ]", r["ckb"]["text"]):
        raise RuntimeError("ckb output has no Sorani letters")
    en_body = re.sub(r"#\S+", "", r["en"]["text"])
    if len(re.findall(r"[\u0600-\u06FF]", en_body)) > max(10, len(en_body) * 0.03):
        raise RuntimeError("en output contains Persian")
    return {"engine": "gemini", "ckb": r["ckb"], "en": r["en"]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=int(os.environ.get("TRANSLATE_LIMIT", "40")),
                    help="حداکثر پست برای ترجمه در هر اجرا")
    ap.add_argument("--force", action="store_true", help="ترجمهٔ مجدد همه")
    args = ap.parse_args()

    # کلید عمومی COIN_KURD_API_KEY: نوع آن از پیشوند تشخیص داده می‌شود
    gen = os.environ.get("COIN_KURD_API_KEY", "").strip()
    print(f"COIN_KURD_API_KEY: {'set, len=%d, prefix=%s' % (len(gen), gen[:6]) if gen else 'EMPTY / not set'}")
    if gen:
        # (ورک‌فلو متغیرهای خالی می‌فرستد؛ پس باید صریحاً جایگزین کنیم)
        if gen.startswith("sk-ant-"):
            os.environ["ANTHROPIC_API_KEY"] = gen
        elif gen.startswith("sk-"):
            os.environ["OPENAI_API_KEY"] = gen
        elif gen.startswith(("AIza", "AQ.")):
            os.environ["GEMINI_API_KEY"] = gen
        else:
            os.environ["ANTHROPIC_API_KEY"] = gen
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    engine = "gemini" if ai.available() else "claude" if api_key else ("openai" if os.environ.get("OPENAI_API_KEY", "").strip() else "google")

    with open(POSTS_FILE, encoding="utf-8") as f:
        posts = json.load(f)

    todo = [p for p in posts if has_persian(p.get("text", "")) and (args.force or not p.get("tr"))]
    todo = todo[: args.limit]  # جدیدترین‌ها اول (فایل نزولی است)
    print(f"engine={engine}, to translate: {len(todo)} of {len(posts)}")

    store = json.load(open(TR_FILE, encoding="utf-8")) if os.path.exists(TR_FILE) else {}
    done, fails = 0, 0
    if engine == "gemini":
        print(f"gemini model: {ai.model()}")
    for p in todo:
        if fails >= 3:
            print("3 consecutive failures; stopping for this run", file=sys.stderr)
            break
        try:
            if engine == "gemini":
                tr = gemini_translate(p)
            else:
                tr = {"engine": engine}
                for lang in LANGS:
                    tr[lang] = {
                        "title": translate(p["title"], lang, api_key) if has_persian(p["title"]) else p["title"],
                        "text": translate(p["text"], lang, api_key),
                    }
            p["tr"] = tr
            fails = 0
            store[str(p["id"])] = {"ckb": tr["ckb"], "en": tr["en"]}
            done += 1
            print(f"  {p['id']} ok")
        except Exception as e:  # noqa: BLE001
            print(f"  {p['id']} FAILED: {e}", file=sys.stderr)
            fails += 1
            # اگر گوگل ما را محدود کرد، بقیه را برای اجرای بعدی بگذاریم
            if isinstance(e, ai.QuotaError) or "429" in str(e) or "too many" in str(e).lower() or "credit balance" in str(e).lower() or "401" in str(e):
                print("rate-limited; stopping for this run", file=sys.stderr)
                break
        if done and done % 10 == 0:
            _save(posts)
    _save(posts)
    json.dump(store, open(TR_FILE, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"translated {done}")
    arabic(posts, store, engine, api_key)



FA_ONLY = re.compile(r"[پچژگیکۀ‌]")      # letters/marks Persian uses and Arabic does not
AR_ONLY = re.compile(r"[يكةىإأؤئ]")


def arabic_ok(s):
    """Arabic, not Persian echoed back: Persian-only marks must be rare next to Arabic-only ones."""
    f, a = len(FA_ONLY.findall(s or "")), len(AR_ONLY.findall(s or ""))
    return a >= 2 and f <= max(2, a // 12)


def ar_fix(s):
    """Arabic spelling for the few Persian letters a model leaves behind (ی→ي, ک→ك, ۀ→ة, no ZWNJ)."""
    return (s or "").replace("ی", "ي").replace("ک", "ك").replace("ۀ", "ة").replace("‌", " ")


AR_DAYS = 30            # the owner's choice (2026-11-12): posts of the last month and every new one get Arabic
AR_PROMPT = ("Translate the following Persian (Farsi) crypto-channel post into Modern Standard Arabic (فصحى). "
             "Keep the meaning exact; keep numbers, tickers (BTC, ETH…), hashtags, emojis, URLs, markdown links and line "
             "breaks unchanged. Use standard Arabic crypto terms. The output must be Arabic, never Persian: no Persian words or "
             "letters (پ چ ژ گ ی ک), Arabic spelling (ي ك ة), Persian digits written as Western digits (۱۲ → 12). Translate the "
             "title too. Return JSON exactly: {\"title\":\"…\",\"text\":\"…\"}\n\n")


def arabic(posts, store, engine, api_key):
    """/ar/p/<id>/: an Arabic translation for each post of the last AR_DAYS days, AR_LIMIT a run"""
    import datetime as dt
    cut = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=AR_DAYS)).isoformat()
    lim = int(os.environ.get("AR_POST_LIMIT", "30"))
    todo = [p for p in posts if (p.get("date") or "") >= cut and has_persian(p.get("text", "")) and isinstance(p.get("tr"), dict)
            and not ((p["tr"].get("ar") or {}).get("text"))][:lim]
    print(f"arabic: {len(todo)} posts to translate (last {AR_DAYS} days)")
    done = fails = 0
    for p in todo:
        if fails >= 3:
            break
        try:
            body = "TITLE: " + (p.get("title") or "") + "\n\nTEXT:\n" + p["text"]
            if engine == "gemini":
                r = ai.generate(AR_PROMPT + body, as_json=True, temperature=0.1, max_tokens=8192)
            elif engine == "claude":
                import requests
                q = requests.post("https://api.anthropic.com/v1/messages", timeout=120,
                                  headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                                  json={"model": claude_model(api_key), "max_tokens": 4000, "messages": [{"role": "user", "content": AR_PROMPT + body}]})
                q.raise_for_status()
                r = json.loads(re.search(r"\{.*\}", "".join(b.get("text", "") for b in q.json()["content"]), re.S).group(0))
            else:
                return
            if isinstance(r, str):
                r = json.loads(re.search(r"\{.*\}", r, re.S).group(0))
            t, x = (r.get("title") or "").strip(), (r.get("text") or "").strip()
            if not x or not arabic_ok(x) or (t and not arabic_ok(t + " " + x[:400])):
                raise RuntimeError("not Arabic")
            p["tr"]["ar"] = {"title": ar_fix(t) or p.get("title", ""), "text": ar_fix(x)}
            store.setdefault(str(p["id"]), {})["ar"] = p["tr"]["ar"]
            done += 1
            fails = 0
        except Exception as e:  # noqa: BLE001
            print(f"  ar {p.get('id')} FAILED: {str(e)[:160]}", file=sys.stderr)
            fails += 1
            if isinstance(e, ai.QuotaError) or "429" in str(e):
                break
    if done:
        _save(posts)
        json.dump(store, open(TR_FILE, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"arabic: translated {done}")


def _save(posts):
    with open(POSTS_FILE, "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=0)


if __name__ == "__main__":
    main()
