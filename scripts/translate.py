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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS_FILE = os.path.join(ROOT, "data", "posts.json")

LANGS = {"ckb": "Central Kurdish (Sorani, Arabic script)", "en": "English"}
PERSIAN_RE = re.compile(r"[؀-ۿ]")


def has_persian(t: str) -> bool:
    return bool(t) and len(PERSIAN_RE.findall(t)) >= 3


# ------------------------------------------------------------------ engines

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
        json={"model": os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-5"), "max_tokens": 2000,
              "messages": [{"role": "user", "content": prompt}]},
        timeout=60,
    )
    r.raise_for_status()
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

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=int(os.environ.get("TRANSLATE_LIMIT", "40")),
                    help="حداکثر پست برای ترجمه در هر اجرا")
    ap.add_argument("--force", action="store_true", help="ترجمهٔ مجدد همه")
    args = ap.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    engine = "claude" if api_key else ("openai" if os.environ.get("OPENAI_API_KEY", "").strip() else "google")

    with open(POSTS_FILE, encoding="utf-8") as f:
        posts = json.load(f)

    todo = [p for p in posts if has_persian(p.get("text", "")) and (args.force or not p.get("tr"))]
    todo = todo[: args.limit]  # جدیدترین‌ها اول (فایل نزولی است)
    print(f"engine={engine}, to translate: {len(todo)} of {len(posts)}")

    done = 0
    for p in todo:
        try:
            tr = {"engine": engine}
            for lang in LANGS:
                tr[lang] = {
                    "title": translate(p["title"], lang, api_key) if has_persian(p["title"]) else p["title"],
                    "text": translate(p["text"], lang, api_key),
                }
            p["tr"] = tr
            done += 1
            print(f"  {p['id']} ok")
        except Exception as e:  # noqa: BLE001
            print(f"  {p['id']} FAILED: {e}", file=sys.stderr)
            # اگر گوگل ما را محدود کرد، بقیه را برای اجرای بعدی بگذاریم
            if "429" in str(e) or "too many" in str(e).lower():
                print("rate-limited; stopping for this run", file=sys.stderr)
                break
        if done and done % 10 == 0:
            _save(posts)
    _save(posts)
    print(f"translated {done}")


def _save(posts):
    with open(POSTS_FILE, "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=0)


if __name__ == "__main__":
    main()
