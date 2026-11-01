#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
لایهٔ مشترک هوش مصنوعی — Google Gemini (AI Studio، سطح رایگان)

کلید از یکی از این متغیرها خوانده می‌شود: GEMINI_API_KEY یا COIN_KURD_API_KEY (اگر با AIza یا AQ. شروع شود).
مدل به‌طور خودکار از فهرست مدل‌های در دسترس حساب انتخاب می‌شود (اولویت: flash).
محدودیت نرخ سطح رایگان رعایت می‌شود (فاصلهٔ حداقل بین درخواست‌ها + تلاش مجدد روی 429/503).
"""
import json
import os
import re
import time

import requests

BASE = "https://generativelanguage.googleapis.com/v1beta"
_model = None
_exhausted = set()
_last = 0.0
MIN_GAP = float(os.environ.get("GEMINI_MIN_GAP", "4.5"))  # ثانیه بین درخواست‌ها (~۱۳ در دقیقه)


def thinking(mname):
    """تفکر داخلی را تا حد ممکن خاموش کن: برای ترجمه/خلاصه لازم نیست و کندی و هزینه می‌آورد"""
    if "2.5" in mname:
        return {"thinkingBudget": 0}
    if re.search(r"gemini-([3-9]|\d\d)", mname) or "latest" in mname:
        return {"thinkingLevel": "minimal"}
    return None


class QuotaError(RuntimeError):
    pass


def key():
    k = os.environ.get("GEMINI_API_KEY", "").strip()
    if k:
        return k
    g = os.environ.get("COIN_KURD_API_KEY", "").strip()
    return g if g.startswith(("AIza", "AQ.")) else ""


def available():
    return bool(key())


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
        return [m for m in fb if m not in _exhausted]
    except Exception:  # noqa: BLE001
        return [m for m in ("gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest") if m not in _exhausted]


def generate(prompt, as_json=False, temperature=0.2, max_tokens=4096, tries=3):
    """اگر سهمیهٔ روزانهٔ مدل فعلی تمام شد، خودکار به مدل بعدی می‌رود"""
    global _model
    while True:
        try:
            return _generate(prompt, as_json, temperature, max_tokens, tries)
        except QuotaError:
            _exhausted.add(model())
            nxt = fallbacks()
            if not nxt:
                raise
            print(f"quota exhausted on {_model}; switching to {nxt[0]}")
            _model = nxt[0]


def _generate(prompt, as_json=False, temperature=0.2, max_tokens=4096, tries=3):
    global _last
    k = key()
    if not k:
        raise RuntimeError("no Gemini key")
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens}}
    if as_json:
        body["generationConfig"]["responseMimeType"] = "application/json"
    mname = model()
    tc = thinking(mname)
    if tc:
        body["generationConfig"]["thinkingConfig"] = tc
    for i in range(tries):
        wait = MIN_GAP - (time.time() - _last)
        if wait > 0:
            time.sleep(wait)
        _last = time.time()
        try:
            r = requests.post(f"{BASE}/models/{mname}:generateContent", headers={"x-goog-api-key": k}, json=body, timeout=90)
        except requests.exceptions.Timeout:
            if i == tries - 1:
                raise
            continue
        if r.status_code == 400 and "thinking" in r.text.lower() and "thinkingConfig" in body["generationConfig"]:
            body["generationConfig"].pop("thinkingConfig")
            continue
        if r.status_code in (429, 500, 503):
            if r.status_code == 429 and ("PerDay" in r.text or "per day" in r.text.lower()):
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
