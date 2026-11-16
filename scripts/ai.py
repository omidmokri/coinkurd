#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
لایهٔ مشترک هوش مصنوعی — Google Gemini (AI Studio، سطح رایگان)

چند کلید (استخر کلیدها)
-----------------------
مالک سایت چند کلید رایگان AI Studio دارد (هر کلید از یک حساب گوگل، با سهمیهٔ روزانهٔ مستقل). هر مرحله‌ای که سهمیهٔ
یک کلید تمام شود، خودکار با کلید بعدی ادامه می‌دهد؛ فقط وقتی سهمیهٔ همهٔ کلیدها روی یک مدل تمام شد سراغ مدل بعدی
می‌رود. کلیدها از این منابع خوانده می‌شوند (به همین ترتیب):

  * GEMINI_API_KEY        — یک کلید، یا چند کلید جداشده با کاما/فاصله/خط جدید
  * COIN_KURD_API_KEY     — اگر شکل کلید جمنای داشته باشد (AIza… یا AQ.…)
  * هر متغیر محیطی دیگری که نامش به _KEY ختم شود و مقدارش شکل کلید جمنای داشته باشد
    (ALI_API_KEY، HAMA_ADI_KEY، SARA_API_KEY …)
  * GEMINI_KEYS — خروجی toJSON(secrets) در ورک‌فلو: هر کلیدی که مالک در گیت‌هاب اضافه کند بدون دست‌زدن به
    ورک‌فلو یا به کد، خودکار وارد استخر می‌شود.

ترتیب کلیدها قطعی است (بر اساس نام متغیر)، تا اجراها تکرارپذیر بمانند. مقدار هیچ کلیدی چاپ نمی‌شود؛ در لاگ فقط
اثر انگشت کوتاه (۶ نویسه) و شمارهٔ کلید دیده می‌شود.

مدل به‌طور خودکار از فهرست مدل‌های در دسترس حساب انتخاب می‌شود (اولویت: flash).
محدودیت نرخ سطح رایگان رعایت می‌شود: فاصلهٔ حداقل بین درخواست‌ها برای هر کلید جداگانه (هر کلید سهمیهٔ دقیقه‌ای
خودش را دارد) + تلاش مجدد روی 429/503.
"""
import hashlib
import json
import os
import re
import time

import requests

BASE = "https://generativelanguage.googleapis.com/v1beta"
_model = None
_exhausted = set()        # جفت‌های (اثرانگشت کلید، مدل) که سهمیهٔ روزانه‌شان در این اجرا تمام شده
_ki = 0                   # کلید فعلی در keys()
_last = {}                # اثرانگشت کلید -> آخرین زمان استفاده (هر کلید سهمیهٔ دقیقه‌ای خودش را دارد)
MIN_GAP = float(os.environ.get("GEMINI_MIN_GAP", "4.5"))  # ثانیه بین درخواست‌های یک کلید (~۱۳ در دقیقه)

# شکل کلید جمنای: کلیدهای AI Studio با AIza شروع می‌شوند، کلیدهای جدیدتر با .AQ
GKEY = re.compile(r"^(?:AIza[\w-]{30,}|AQ\.[\w.-]{20,})$")


def thinking(mname):
    """تفکر داخلی را تا حد ممکن خاموش کن: برای ترجمه/خلاصه لازم نیست و کندی و هزینه می‌آورد"""
    if "2.5" in mname:
        return {"thinkingBudget": 0}
    if re.search(r"gemini-([3-9]|\d\d)", mname) or "latest" in mname:
        return {"thinkingLevel": "minimal"}
    return None


class QuotaError(RuntimeError):
    pass


# ------------------------------------------------------------------ استخر کلیدها
def _kid(k):
    """اثر انگشت کوتاه و بی‌خطرِ یک کلید، برای لاگ و برای ردگیری سهمیه (خودِ کلید هرگز چاپ نمی‌شود)"""
    return hashlib.sha1((k or "").encode("utf-8")).hexdigest()[:6]


def _is_key(v):
    return bool(GKEY.match((v or "").strip()))


def keys():
    """همهٔ کلیدهای جمنای که این اجرا می‌تواند استفاده کند، به ترتیبی قطعی و بدون تکرار"""
    out, seen = [], set()

    def add(v):
        v = (v or "").strip()
        if v and v not in seen:
            seen.add(v)
            out.append(v)

    # کلید صریح: هر شکلی داشته باشد پذیرفته می‌شود (تست‌ها و اجرای دستی هم از همین راه کلید می‌دهند)
    for v in re.split(r"[,\s]+", os.environ.get("GEMINI_API_KEY", "")):
        add(v)
    g = os.environ.get("COIN_KURD_API_KEY", "").strip()
    if _is_key(g):
        add(g)
    # بقیهٔ کلیدهای مالک: یا هرکدام در یک متغیر جدا، یا همه با هم در GEMINI_KEYS (toJSON(secrets))
    for name in sorted(os.environ):
        if name.endswith("_KEY") and name not in ("GEMINI_API_KEY", "COIN_KURD_API_KEY") and _is_key(os.environ[name]):
            add(os.environ[name])
    try:
        d = json.loads(os.environ.get("GEMINI_KEYS", "") or "{}")
    except ValueError:
        d = {}
    if isinstance(d, dict):
        for name in sorted(d):
            if _is_key(d.get(name)):
                add(d[name])
    elif isinstance(d, list):
        for v in d:
            if _is_key(v):
                add(v)
    return out


def key():
    """کلید فعلی"""
    ks = keys()
    if not ks:
        return ""
    return ks[_ki] if 0 <= _ki < len(ks) else ks[0]


def available():
    return bool(keys())


def live_keys(m=None):
    """کلیدهایی که سهمیهٔ روزانه‌شان روی این مدل هنوز تمام نشده"""
    m = m or model()
    return [k for k in keys() if (_kid(k), m) not in _exhausted]


def rotate_key(m=None):
    """برو روی کلید بعدی که سهمیه‌اش روی این مدل باقی است؛ False یعنی هیچ کلیدی نمانده"""
    global _ki
    ks = keys()
    m = m or model()
    for step in range(1, len(ks) + 1):
        i = (_ki + step) % len(ks)
        if (_kid(ks[i]), m) not in _exhausted:
            _ki = i
            return True
    return False


def _model_spent(m):
    """سهمیهٔ این مدل روی همهٔ کلیدها تمام شده؟"""
    ks = keys()
    return bool(ks) and all((_kid(k), m) in _exhausted for k in ks)


def pool_note():
    n = len(keys())
    return f"{n} Gemini key{'s' if n != 1 else ''} in the pool"


def reset():
    """وضعیت اجرا را پاک می‌کند (تست‌ها)"""
    global _model, _ki, _exhausted, _last
    _model, _ki = None, 0
    _exhausted = set()
    _last = {}


# ------------------------------------------------------------------ مدل
def model():
    global _model
    if _model:
        return _model
    env = os.environ.get("GEMINI_MODEL", "").strip()
    if env:
        _model = env
        return env
    try:  # مدلی که ai_check.py آزموده و انتخاب کرده
        cached = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "ai_model.json")))
        if cached.get("model"):
            _model = cached["model"]
            return _model
    except Exception:  # noqa: BLE001
        pass
    try:
        r = requests.get(f"{BASE}/models", params={"pageSize": 200}, headers={"x-goog-api-key": key()}, timeout=30)
        r.raise_for_status()
        names = [m["name"].split("/", 1)[1] for m in r.json().get("models", [])
                 if "generateContent" in m.get("supportedGenerationMethods", [])]
        fl = [n for n in names if re.fullmatch(r"gemini-\d+(?:\.\d+)?-flash", n)]
        fl.sort(key=lambda n: -float(re.search(r"gemini-(\d+(?:\.\d+)?)", n).group(1)))
        names = fl + [n for n in names if n not in fl]
        _model = names[0] if names else "gemini-2.0-flash"
    except Exception as e:  # noqa: BLE001
        print(f"gemini model list failed: {e}")
        _model = "gemini-2.0-flash"
    print(f"gemini model: {_model}")
    return _model


def fallbacks():
    try:
        c = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "ai_model.json")))
        fb = c.get("fallbacks") or ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-lite-latest"]
    except Exception:  # noqa: BLE001
        fb = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"]
    return [m for m in fb if not _model_spent(m)]


# ------------------------------------------------------------------ تولید
def generate(prompt, as_json=False, temperature=0.2, max_tokens=4096, tries=3, timeout=90):
    """ابتدا همهٔ کلیدها روی مدل فعلی؛ وقتی سهمیهٔ همه تمام شد، مدل بعدی دوباره با همهٔ کلیدها"""
    global _model, _ki
    while True:
        try:
            return _generate(prompt, as_json, temperature, max_tokens, tries, timeout)
        except QuotaError:
            _exhausted.add((_kid(key()), model()))
            if rotate_key():
                print(f"quota out on a key; {len(live_keys())} of {len(keys())} keys left on {model()}")
                continue
            nxt = fallbacks()
            if not nxt:
                raise
            print(f"quota out on {_model} for every key; switching to {nxt[0]}")
            _model, _ki = nxt[0], 0


def generate_on_model(prompt, as_json=False, temperature=0.2, max_tokens=4096, tries=3, timeout=90):
    """generate() بدون عقب‌نشینی به مدل‌های دیگر: فقط مدل همین اجرا، ولی با همهٔ کلیدها به نوبت.

    scripts/pro_l10n.py با این ترجمه می‌کند تا یک اجرای طولانیِ ترجمه، مدل‌هایی را که مراحل خود سایت (ترجمهٔ پست‌ها،
    اخبار، عربی، گزارش‌ها) لازم دارند مصرف نکند. وقتی سهمیهٔ همهٔ کلیدها روی این مدل تمام شد QuotaError می‌دهد.
    """
    if keys() and not live_keys():
        raise QuotaError("every key's quota for this model ran out earlier in this run")
    while True:
        try:
            return _generate(prompt, as_json, temperature, max_tokens, tries, timeout)
        except QuotaError:
            _exhausted.add((_kid(key()), model()))
            if not rotate_key():
                raise
            print(f"quota out on a key; {len(live_keys())} of {len(keys())} keys left on {model()}")


def generate_with(api_key, prompt, as_json=False, temperature=0.2, max_tokens=4096, tries=3, timeout=90):
    """یک درخواست روی یک کلید مشخص — برای اجرایی که چند کلید را هم‌زمان به کار می‌گیرد.
    QuotaError آن کلید را روی این مدل «تمام‌شده» علامت می‌زند و دوباره بالا می‌رود."""
    try:
        return _generate(prompt, as_json, temperature, max_tokens, tries, timeout, api_key=api_key)
    except QuotaError:
        _exhausted.add((_kid(api_key), model()))
        raise


def _generate(prompt, as_json=False, temperature=0.2, max_tokens=4096, tries=3, timeout=90, api_key=None):
    k = api_key or key()
    if not k:
        raise RuntimeError("no Gemini key")
    fp = _kid(k)
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens}}
    if as_json:
        body["generationConfig"]["responseMimeType"] = "application/json"
    mname = model()
    tc = thinking(mname)
    if tc:
        body["generationConfig"]["thinkingConfig"] = tc
    for i in range(tries):
        wait = MIN_GAP - (time.time() - _last.get(fp, 0.0))
        if wait > 0:
            time.sleep(wait)
        _last[fp] = time.time()
        try:
            r = requests.post(f"{BASE}/models/{mname}:generateContent", headers={"x-goog-api-key": k}, json=body, timeout=timeout)
        except requests.exceptions.Timeout:
            if i == tries - 1:
                raise
            continue
        if r.status_code == 400 and "thinking" in r.text.lower() and "thinkingConfig" in body["generationConfig"]:
            body["generationConfig"].pop("thinkingConfig")
            continue
        if r.status_code in (429, 500, 503):
            if r.status_code == 429:
                m = re.search(r'"retryDelay":\s*"(\d+(?:\.\d+)?)s"', r.text)
                delay = float(m.group(1)) if m else None
                print(f"429 on {mname} (key {fp}): retryDelay={delay} {('PerDay' in r.text) and 'per-day quota' or ''}")
                if delay is not None and delay <= 90 and i < tries - 1:
                    time.sleep(delay + 1)   # سهمیهٔ دقیقه‌ای: صبر کن و دوباره
                    continue
                if "PerDay" in r.text or "per day" in r.text.lower() or delay is None or delay > 90:
                    raise QuotaError("daily quota exhausted")
            time.sleep(15 * (i + 1))
            continue
        if r.status_code >= 400:
            raise RuntimeError(f"{r.status_code}: {r.text[:300]}")
        data = r.json()
        try:
            text = "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"])
        except (KeyError, IndexError):
            raise RuntimeError(f"empty response: {str(data)[:300]}")
        if not as_json:
            return text.strip()
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
        return json.loads(text)
    raise QuotaError("rate limited after retries")
