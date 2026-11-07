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


class Dead(Exception):
    """the address answered, but not with a picture — an expired Telegram link, not a network fault"""


def grab(session, url):
    """the picture's bytes; Dead when the link has expired, a requests error when the network failed"""
    r = session.get(url, headers=UA, timeout=30)
    if not r.ok or len(r.content) < 1500 or not r.headers.get("content-type", "").startswith("image"):
        raise Dead(url)
    return r.content


def fresh_urls(session, channel, ids):
    """Fresh picture addresses for the given posts, read from the channel's public pages.
    A stored cdn4.telesco.pe address dies after a while; the page always carries a live one. Each
    page holds about twenty posts, so the whole archive costs a few dozen requests, not one per post."""
    from fetch import fetch_page, parse_messages
    want, found = set(ids), {}
    before = max(want) + 1 if want else None
    pages = 0
    while want and before and pages < 120:
        try:
            html = fetch_page(session, channel, before)
        except Exception as ex:                       # a failed page is skipped, the rest still count
            print(f"postimg: page before {before} failed ({ex})")
            break
        pages += 1
        msgs = parse_messages(html, channel)
        if not msgs:
            break
        for m in msgs:
            if m["id"] in want and m.get("photos"):
                found[m["id"]] = m["photos"][0]
        lowest = min(m["id"] for m in msgs)
        want = {i for i in want if i < lowest}        # everything at or above this page is settled
        before = max(want) + 1 if want else None
        time.sleep(0.8)
    print(f"postimg: {pages} channel pages read, {len(found)} fresh addresses")
    return found


CAT_FA = {"news": "خبر", "analysis": "تحلیل", "education": "آموزش", "signal": "سیگنال", "product": "ابزار",
          "promo": "کوین کورد", "notice": "اطلاعیه"}


def card_for(p):
    """a picture for a post that never had one, made from its own headline and opening lines"""
    from datetime import datetime
    import infocard as IC
    when = None
    try:
        when = datetime.fromisoformat(p.get("date") or "")
    except Exception:
        pass
    return IC.title_card(p.get("title") or "", p.get("text") or "",
                         badge=CAT_FA.get(p.get("kind") or "", "کوین کورد"), when=when)


def store(pid, raw):
    data, ext = shrink(raw)
    if not data:
        return None
    with open(os.path.join(IMGDIR, f"{pid}.{ext}"), "wb") as fh:
        fh.write(data)
    return f"{WEB}{pid}.{ext}"


def local(p):
    return str(p.get("img") or "").startswith((WEB, "/data/deepimg/"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=400, help="حداکثر تصویر تازه در هر اجرا")
    ap.add_argument("--channel", default=os.environ.get("TG_CHANNEL", "Coin_Kurd"))
    ap.add_argument("--cards", type=int, default=60, help="حداکثر کارت ساختنی برای پست‌های بی‌تصویر")
    a = ap.parse_args()

    doc = load()
    ps = posts_of(doc)
    os.makedirs(IMGDIR, exist_ok=True)
    files = {f.rsplit(".", 1)[0]: f for f in os.listdir(IMGDIR)}
    for p in ps:                                       # a file already here: point the post at it
        f = files.get(str(p.get("id")))
        if f and not local(p):
            p["img"] = WEB + f

    need = sorted((p for p in ps if not local(p)), key=lambda x: x.get("id", 0), reverse=True)
    session = requests.Session()
    done = dead = 0
    stale = []
    gone = set()                                       # links that no fresh page could bring back
    # 1. the stored address, while it still works — newest first, so a cut-short run saves what matters
    for p in need:
        if done >= a.limit:
            break
        src = (p.get("photos") or [None])[0]
        if not src or src.startswith("/"):
            continue
        try:
            path = store(p["id"], grab(session, src))
        except Dead:
            stale.append(p)
            continue
        except requests.RequestException as ex:      # the network, not the link: stop and keep what we have
            print(f"postimg: network error ({ex}) — stopping this pass")
            break
        if path:
            p["img"], done = path, done + 1
        time.sleep(0.1)

    # 2. expired addresses: one fresh address per post from the channel pages, then download again
    if stale and done < a.limit:
        fresh = fresh_urls(session, a.channel, [p["id"] for p in stale])
        for p in stale:
            if done >= a.limit:
                break
            src = fresh.get(p["id"])
            if not src:
                if fresh:                              # pages were read and this post's picture is not there
                    gone.add(p["id"])
                dead += 1
                continue
            try:
                path = store(p["id"], grab(session, src))
            except Dead:
                gone.add(p["id"]); dead += 1
                continue
            except requests.RequestException:
                dead += 1
                continue
            if path:
                p["img"], p["photos"], done = path, [src], done + 1
            time.sleep(0.1)

    # 3. posts with no picture anywhere — or whose picture is gone for good — get a card of their own headline
    made = 0
    for p in need:
        if made >= a.cards or local(p) or (p.get("photos") and p["id"] not in gone):
            continue
        if "/data/deepimg/" in str((p.get("link") or {}).get("url") if isinstance(p.get("link"), dict) else ""):
            continue                                  # a dossier: repair.py points it at its own card
        try:
            path = store(p["id"], card_for(p))
        except Exception as ex:                       # one post's card must not stop the rest
            print(f"postimg: no card for {p.get('id')} ({ex})")
            continue
        if path:
            p["img"], made = path, made + 1

    save(doc)
    have = sum(1 for p in ps if local(p))
    print(f"postimg: {done} downloaded, {made} cards made, {dead} still unreachable · {have}/{len(ps)} posts have a picture")


if __name__ == "__main__":
    main()
