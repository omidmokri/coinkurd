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
  * COIN_KURD_API_KEY     — همین‌طور: هر بخشی که شکل کلید جمنای داشته باشد (AIza… یا AQ.…) برداشته می‌شود و
                            بقیه (مثلاً یک کلید sk-ant-) دست‌نخورده برای مصرف‌کنندهٔ خودش می‌ماند. چون این متغیر
                            همین حالا به همهٔ مرحله‌های ورک‌فلو داده می‌شود، گذاشتن چند کلید جداشده با کاما در
                            همین یک راز، بدون هیچ تغییری در ورک‌فلو، کل استخر را فعال می‌کند.
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
    """این کلید تا فردا روی این مدل کاری از دستش برنمی‌آید (سهمیهٔ روزانه، یا پروژه‌ای که سطح رایگان ندارد)"""


class RateLimited(RuntimeError):
    """فقط خیلی سریع درخواست دادیم؛ کلید سالم است و کمی بعد دوباره جواب می‌دهد"""


# ------------------------------------------------------------------ استخر کلیدها
def _kid(k):
    """اثر انگشت کوتاه و بی‌خطرِ یک کلید، برای لاگ و برای ردگیری سهمیه (خودِ کلید هرگز چاپ نمی‌شود)"""
    return hashlib.sha1((k or "").encode("utf-8")).hexdigest()[:6]


def _is_key(v):
    return bool(GKEY.match((v or "").strip()))


_names = {}      # اثرانگشت کلید -> نام متغیری که از آن آمده (برای گزارش؛ خودِ کلید هرگز)
_reason = {}     # اثرانگشت کلید -> چرا کنار گذاشته شد


def keys():
    """همهٔ کلیدهای جمنای که این اجرا می‌تواند استفاده کند، به ترتیبی قطعی و بدون تکرار"""
    out, seen = [], set()

    def add(v, name="?"):
        v = (v or "").strip()
        if v and v not in seen:
            seen.add(v)
            out.append(v)
            _names.setdefault(_kid(v), name)

    # کلید صریح: هر شکلی داشته باشد پذیرفته می‌شود (تست‌ها و اجرای دستی هم از همین راه کلید می‌دهند)
    for v in re.split(r"[,\s]+", os.environ.get("GEMINI_API_KEY", "")):
        add(v, "GEMINI_API_KEY")
    # همین متغیر هم می‌تواند چند کلید داشته باشد؛ هر چیزی که کلید جمنای نباشد (مثل sk-ant-…) نادیده گرفته می‌شود
    for v in re.split(r"[,\s]+", os.environ.get("COIN_KURD_API_KEY", "")):
        if _is_key(v):
            add(v, "COIN_KURD_API_KEY")
    # بقیهٔ کلیدهای مالک: یا هرکدام در یک متغیر جدا، یا همه با هم در GEMINI_KEYS (toJSON(secrets))
    for name in sorted(os.environ):
        if name.endswith("_KEY") and name not in ("GEMINI_API_KEY", "COIN_KURD_API_KEY") and _is_key(os.environ[name]):
            add(os.environ[name], name)
    try:
        d = json.loads(os.environ.get("GEMINI_KEYS", "") or "{}")
    except ValueError:
        d = {}
    if isinstance(d, dict):
        for name in sorted(d):
            if _is_key(d.get(name)):
                add(d[name], name)
    elif isinstance(d, list):
        for v in d:
            if _is_key(v):
                add(v, "GEMINI_KEYS")
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
    ks = keys()
    names = ", ".join(_names.get(_kid(k), "?") for k in ks)
    return f"{len(ks)} Gemini key{'s' if len(ks) != 1 else ''} in the pool: {names}"


def retire(api_key, why, m=None):
    """این کلید را روی این مدل کنار بگذار و دلیلش را برای گزارش پایان اجرا نگه دار"""
    fp = _kid(api_key)
    _exhausted.add((fp, m or model()))
    _reason.setdefault(fp, why)


def pool_report():
    """یک خط برای هر کلید: نام رازش، و اینکه در این اجرا کار کرد یا چرا نکرد"""
    out = []
    for k in keys():
        fp = _kid(k)
        out.append(f"  {_names.get(fp, '?'):<20} {fp}  " + (_reason.get(fp) or "working"))
    return "\n".join(out)


def reset():
    """وضعیت اجرا را پاک می‌کند (تست‌ها)"""
    global _model, _ki, _exhausted, _last, _names, _reason
    _model, _ki = None, 0
    _exhausted = set()
    _last = {}
    _names, _reason = {}, {}


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
    limited = 0
    while True:
        try:
            return _generate(prompt, as_json, temperature, max_tokens, tries, timeout)
        except RateLimited:
            # کلید سالم است، فقط شلوغ: برو سراغ کلید بعدی، ولی این یکی را کنار نگذار
            limited += 1
            if limited > len(keys()) or not rotate_key():
                raise
        except QuotaError as e:
            retire(key(), str(e)[:80])
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
    limited = 0
    while True:
        try:
            return _generate(prompt, as_json, temperature, max_tokens, tries, timeout)
        except RateLimited:
            limited += 1
            if limited > len(keys()) or not rotate_key():
                raise
        except QuotaError as e:
            retire(key(), str(e)[:80])
            if not rotate_key():
                raise
            print(f"quota out on a key; {len(live_keys())} of {len(keys())} keys left on {model()}")


def generate_with(api_key, prompt, as_json=False, temperature=0.2, max_tokens=4096, tries=3, timeout=90):
    """یک درخواست روی یک کلید مشخص — برای اجرایی که چند کلید را هم‌زمان به کار می‌گیرد.
    QuotaError آن کلید را روی این مدل «تمام‌شده» علامت می‌زند و دوباره بالا می‌رود."""
    try:
        return _generate(prompt, as_json, temperature, max_tokens, tries, timeout, api_key=api_key)
    except QuotaError as e:
        retire(api_key, str(e)[:80])
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
                # فقط وقتی کلید را کنار می‌گذاریم که گوگل صریحاً سهمیهٔ روزانه را گفته باشد (یا مهلتی چند ساعته داده
                # باشد). ۴۲۹ بدون این نشانه معمولاً سهمیهٔ دقیقه‌ای است؛ قبلاً آن را هم «روزانه» می‌گرفتیم و کلیدِ
                # سالم تا آخر اجرا از دست می‌رفت
                per_day = ("PerDay" in r.text or "per day" in r.text.lower()
                           or (delay is not None and delay > 300))
                print(f"429 on {mname} (key {fp}): retryDelay={delay}" + (" per-day quota" if per_day else ""))
                if per_day:
                    raise QuotaError("daily quota exhausted")
                if i < tries - 1:
                    time.sleep(delay + 1 if (delay is not None and delay <= 90) else 20 * (i + 1))
                    continue
                raise RateLimited(f"key {fp}: rate limited on {mname} after {tries} tries")
            time.sleep(15 * (i + 1))
            continue
        if r.status_code == 403 and "free tier" in r.text.lower():
            # کلیدی که پروژه‌اش سطح رایگان ندارد: تا آخر این اجرا هیچ درخواستی را جواب نمی‌دهد، پس کنارش می‌گذاریم
            # تا کارگرش بی‌جهت دسته‌های بعدی را نسوزاند
            raise QuotaError("this key's Google project has no Gemini free tier (it needs billing)")
        # A key that Google rejects outright (deleted, revoked, mistyped when it was pasted into the secret) used to
        # raise from here and take the whole attempt down with it, so one dead key among twenty-five held three
        # languages out of the 2026-11-21 episode. Retire it for this run and carry on with the next key, the way a
        # spent quota does; pool_report() names its secret at the end of the run so it can be replaced.
        if r.status_code in (400, 401, 403) and re.search(
                r"API[ _]key[ _]not[ _]valid|API_KEY_INVALID|API[ _]key[ _]expired|API[ _]key[ _]not[ _]found",
                r.text, re.I):
            raise QuotaError(f"Google rejects this key ({r.status_code}: not valid) — replace the secret")
        if r.status_code >= 400:
            raise RuntimeError(f"{r.status_code} on key {fp}: {r.text[:300]}")
        data = r.json()
        try:
            text = "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"])
        except (KeyError, IndexError):
            raise RuntimeError(f"empty response: {str(data)[:300]}")
        if not as_json:
            return text.strip()
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
        try:
            return json.loads(text)
        except json.JSONDecodeError as ex:
            # A long answer can come back cut in half (finishReason MAX_TOKENS) or, now and then, simply
            # malformed. Both used to burn one of the caller's few attempts — on 2026-11-21 two of the
            # podcast writer's three attempts went this way and the day's episode was lost. Ask again on the
            # same key instead, and only give up when the retries are spent.
            why = (data.get("candidates") or [{}])[0].get("finishReason", "?")
            if i < tries - 1:
                print(f"invalid JSON from {mname} (finishReason={why}, {len(text)} chars): {ex}; asking again")
                continue
            raise RuntimeError(f"invalid JSON from {mname} after {tries} tries "
                               f"(finishReason={why}, {len(text)} chars): {ex}") from ex
    raise RateLimited("rate limited after retries")
