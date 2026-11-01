#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
انتخاب خودکار مدل Gemini (خودترمیمی): چند مدل flash را با یک درخواست کوچک امتحان می‌کند،
سریع‌ترین مدلی را که پاسخ درست می‌دهد در data/ai_model.json ذخیره می‌کند. هر ۱۲ ساعت یک بار.
"""
import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ai  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "ai_model.json")
CANDIDATES = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-flash-lite-latest"]
import re  # noqa: E402


def ranked(names):
    """جدیدترین مدل‌های flash پایدار (بدون preview/tts/image/live) اول"""
    fl = [n for n in names if re.fullmatch(r"gemini-\d+(?:\.\d+)?-flash(?:-lite)?", n)]
    ver = lambda n: float(re.search(r"gemini-(\d+(?:\.\d+)?)", n).group(1))  # noqa: E731
    fl.sort(key=lambda n: (-ver(n), "lite" in n))
    return fl[:6] + [c for c in CANDIDATES if c in names and c not in fl]


def main():
    if not ai.available():
        print("no Gemini key")
        return
    prev = json.load(open(OUT)) if os.path.exists(OUT) else {}
    if prev.get("checked_at") and datetime.now(timezone.utc) - datetime.fromisoformat(prev["checked_at"]) < timedelta(hours=12) \
            and os.environ.get("AI_CHECK_FORCE") != "1" and prev.get("model"):
        print("cached model:", prev["model"])
        return
    k = ai.key()
    try:
        r = requests.get(f"{ai.BASE}/models", params={"pageSize": 200}, headers={"x-goog-api-key": k}, timeout=30)
        print("list models:", r.status_code)
        names = [m["name"].split("/", 1)[1] for m in r.json().get("models", []) if "generateContent" in m.get("supportedGenerationMethods", [])]
        print("available:", ", ".join(n for n in names if "gemini" in n)[:1500])
    except Exception as e:  # noqa: BLE001
        names = []
        print("list failed:", e)
    cands = ranked(names) if names else CANDIDATES
    results = []
    for m in cands:
        body = {"contents": [{"role": "user", "parts": [{"text": "Translate to English, reply with JSON {\"en\":\"...\"}: بیت‌کوین رشد کرد"}]}],
                "generationConfig": {"temperature": 0, "maxOutputTokens": 200, "responseMimeType": "application/json"}}
        tc = ai.thinking(m)
        if tc:
            body["generationConfig"]["thinkingConfig"] = tc
        t0 = time.time()
        try:
            r = requests.post(f"{ai.BASE}/models/{m}:generateContent", headers={"x-goog-api-key": k}, json=body, timeout=40)
            if r.status_code == 400 and tc:
                body["generationConfig"].pop("thinkingConfig")
                r = requests.post(f"{ai.BASE}/models/{m}:generateContent", headers={"x-goog-api-key": k}, json=body, timeout=40)
            dt = round(time.time() - t0, 2)
            ok = r.status_code == 200 and "itcoin" in r.text
            if r.status_code == 429:
                print(f"{m}: quota exhausted now; kept as fallback")
            print(f"{m}: {r.status_code} {dt}s {'OK' if ok else r.text[:160]}")
            if ok:
                results.append((dt, m))
                if len(results) >= 2:
                    break
        except Exception as e:  # noqa: BLE001
            print(f"{m}: error {e}")
        time.sleep(4)
    if results:
        results.sort()
        rest = [m for m in ranked(names) if m not in {x[1] for x in results}] if names else []
        json.dump({"model": results[0][1], "latency_s": results[0][0], "checked_at": datetime.now(timezone.utc).isoformat(),
                   "all": results, "fallbacks": [x[1] for x in results[1:]] + rest}, open(OUT, "w"), indent=1)
        print("selected:", results[0][1])
    else:
        print("no working Gemini model")


if __name__ == "__main__":
    main()
