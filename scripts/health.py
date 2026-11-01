#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
نگهبان سلامت (Watchdog) — بعد از هر اجرای ورک‌فلو

بررسی‌ها: تازگی پست‌های تلگرام، تازگی داده‌های بازار، سالم‌بودن فایل‌های JSON،
افت ناگهانی تعداد پست‌ها، نتیجهٔ هر مرحلهٔ ورک‌فلو (از متغیرهای STEP_*).

خروجی: data/health.json
هشدار تلگرام: اگر TG_BOT_TOKEN و TG_ALERT_CHAT تنظیم شده باشند و وضعیت عوض شود
(سالم → خطا یا خطا → سالم) پیام می‌فرستد؛ پیام تکراری نمی‌فرستد.
"""
import json
import os
from datetime import datetime, timezone

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
OUT = os.path.join(D, "health.json")


def load(name):
    try:
        return json.load(open(os.path.join(D, name), encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        return e


def age_h(iso):
    return (datetime.now(timezone.utc) - datetime.fromisoformat(iso)).total_seconds() / 3600


def main():
    prev = load("health.json")
    prev = prev if isinstance(prev, dict) else {}
    checks = []

    def add(name, ok, msg, level="error"):
        checks.append({"name": name, "ok": bool(ok), "level": "ok" if ok else level, "msg": msg})

    posts = load("posts.json")
    if isinstance(posts, Exception):
        add("posts_json", False, f"posts.json خراب است: {posts}")
    else:
        add("posts_json", True, f"{len(posts)} پست")
        newest = max((p["date"] for p in posts if p.get("date")), default=None)
        if newest:
            h = age_h(newest)
            add("telegram_fresh", h < 36, f"آخرین پست {h:.1f} ساعت پیش", "warn")
        pc = prev.get("post_count")
        add("no_data_loss", not pc or len(posts) >= pc * 0.9, f"قبلی {pc}، فعلی {len(posts)}")
        tr = sum(1 for p in posts if p.get("tr"))
        add("translations", True, f"{tr} پست ترجمه‌شده")
    m = load("market.json")
    if isinstance(m, Exception):
        add("market_json", False, f"market.json: {m}", "warn")
    else:
        h = age_h(m["updated_at"])
        add("market_fresh", h < 1.5 and not m.get("stale"), f"بازار {h*60:.0f} دقیقه پیش، {len(m.get('coins', []))} کوین", "warn")
        add("market_sources", not m.get("errors"), "; ".join(m.get("errors", [])[:3]) or "همهٔ منابع پاسخ دادند", "warn")
    for k, v in os.environ.items():
        if k.startswith("STEP_") and v:
            add(k[5:].lower(), v in ("success", "skipped"), f"مرحلهٔ {k[5:].lower()}: {v}")

    errors = [c for c in checks if c["level"] == "error"]
    warns = [c for c in checks if c["level"] == "warn"]
    status = "error" if errors else "warn" if warns else "ok"
    out = {"checked_at": datetime.now(timezone.utc).isoformat(), "status": status, "checks": checks,
           "post_count": len(posts) if isinstance(posts, list) else prev.get("post_count"),
           "last_alert_status": prev.get("last_alert_status", "ok")}

    tok, chat = os.environ.get("TG_BOT_TOKEN"), os.environ.get("TG_ALERT_CHAT")
    if tok and chat and status != out["last_alert_status"]:
        icon = {"ok": "✅", "warn": "⚠️", "error": "🚨"}[status]
        lines = [f"{icon} entekhab.net — وضعیت: {status}"] + [f"• {c['name']}: {c['msg']}" for c in errors + warns]
        try:
            requests.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                          json={"chat_id": chat, "text": "\n".join(lines)}, timeout=20).raise_for_status()
            out["last_alert_status"] = status
        except Exception as e:  # noqa: BLE001
            print(f"alert failed: {e}")
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(status, [c["name"] for c in errors + warns])


if __name__ == "__main__":
    main()
