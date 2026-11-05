#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
نگهداری تصویر پست‌های کانال در خود مخزن.

چرا لازم است: پست‌ها در data/posts.json فقط نشانی cdn4.telesco.pe را داشتند و آن نشانی‌ها
منقضی می‌شوند؛ نتیجه این بود که تصویر پست‌های قدیمی روی سایت نمایش داده نمی‌شد.
این اسکریپت یک نسخهٔ کوچک WebP از تصویر هر پست را در data/postimg/<id>.webp ذخیره می‌کند
و مسیر محلی را در فیلد img همان پست می‌نویسد. از آن پس سایت به تلگرام وابسته نیست.

  python scripts/postimg.py                 # تا سقف پیش‌فرض، از تازه‌ترین پست‌ها به عقب
  python scripts/postimg.py --limit 400     # بک‌فیل بزرگ‌تر در یک اجرا
  python scripts/postimg.py --refresh 20    # برای پست‌هایی که نشانی‌شان مرده، ۲۰ صفحه را دوباره اسکرپ کن
"""
import argparse
import io
import json
import os
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
POSTS = os.path.join(D, "posts.json")
IMGDIR = os.path.join(D, "postimg")
WEB = "/data/postimg/"
UA = {"User-Agent": "Mozilla/5.0 (compatible; entekhab.net/1.0)"}
MAXPX, QUALITY = 720, 62


def load():
    with open(POSTS, encoding="utf-8") as fh:
        return json.load(fh)


def posts_of(doc):
    return doc if isinstance(doc, list) else doc.get("posts", [])


def save(doc):
    with open(POSTS, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))


def shrink(data):
    """به WebP کوچک تبدیل می‌کند؛ اگر Pillow نبود، اصل تصویر برمی‌گردد."""
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(data))
        im = im.convert("RGB")
        im.thumbnail((MAXPX, MAXPX))
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=QUALITY, method=6)
        return buf.getvalue(), "webp"
    except Exception:
        return (data, "jpg") if len(data) < 900_000 else (None, None)


def grab(session, url):
    """تصویر را می‌گیرد؛ None یعنی نشانی مرده یا پاسخ بی‌اعتبار است."""
    try:
        r = session.get(url, headers=UA, timeout=30)
    except Exception:
        return None
    if not r.ok or len(r.content) < 1500 or not r.headers.get("content-type", "").startswith("image"):
        return None
    return r.content


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=150, help="حداکثر تصویر در هر اجرا")
    ap.add_argument("--refresh", type=int, default=0, help="پیش از دانلود، این تعداد صفحه را دوباره اسکرپ کن")
    ap.add_argument("--tries", type=int, default=0, help="سقف تلاش (پیش‌فرض: سه برابر limit)")
    a = ap.parse_args()

    if a.refresh:                      # نشانی‌های تازه برای پست‌هایی که لینکشان منقضی شده
        import subprocess
        subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "fetch.py"),
                        "--pages", str(a.refresh), "--backfill"], check=False)

    doc = load()
    ps = posts_of(doc)
    os.makedirs(IMGDIR, exist_ok=True)
    have = {f.rsplit(".", 1)[0] for f in os.listdir(IMGDIR)}

    done = dead = kept = tried = 0
    streak = 0                      # شکست‌های پشت‌سرهم
    tries_cap = a.tries or a.limit * 3
    session = requests.Session()
    # از تازه‌ترین به قدیمی‌ترین: اگر اجرا نصفه ماند، مهم‌ترین‌ها ذخیره شده‌اند
    for p in sorted(ps, key=lambda x: x.get("id", 0), reverse=True):
        pid = str(p.get("id"))
        if pid in have:                                   # فایلش هست، فقط مسیر را مطمئن شو
            if not str(p.get("img", "")).startswith(WEB):
                ext = next((f.rsplit(".", 1)[1] for f in os.listdir(IMGDIR) if f.startswith(pid + ".")), "webp")
                p["img"] = f"{WEB}{pid}.{ext}"
            kept += 1
            continue
        src = (p.get("photos") or [None])[0]
        if not src:
            continue
        if done >= a.limit or tried >= tries_cap:
            break
        # بیست شکست پشت‌سرهم یعنی شبکه یا خود CDN قطع است، نه اینکه لینک‌ها منقضی شده باشند:
        # ادامه دادن فقط وقت اجرا را می‌سوزاند، پس همان‌جا می‌ایستیم.
        if streak >= 20:
            print("postimg: 20 failures in a row — stopping; the CDN or the network looks down")
            break
        tried += 1
        raw = grab(session, src)
        if raw is None:
            dead += 1
            streak += 1
            continue
        streak = 0
        data, ext = shrink(raw)
        if not data:
            dead += 1
            continue
        with open(os.path.join(IMGDIR, f"{pid}.{ext}"), "wb") as fh:
            fh.write(data)
        p["img"] = f"{WEB}{pid}.{ext}"
        done += 1
        time.sleep(0.15)

    save(doc)
    with_img = sum(1 for p in ps if str(p.get("img", "")).startswith(WEB))
    want = sum(1 for p in ps if p.get("photos"))
    print(f"postimg: saved {done}, already had {kept}, failed {dead} of {tried} tried · "
          f"{with_img}/{want} posts now have a local image")


if __name__ == "__main__":
    main()
