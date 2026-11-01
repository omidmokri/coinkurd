#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
واکشی پست‌های عمومی کانال تلگرام از پیش‌نمایش وب (t.me/s/<channel>)،
دسته‌بندی خودکار و ذخیره در data/posts.json

استفاده:
  python scripts/fetch.py                 # افزایشی: فقط پست‌های جدید
  python scripts/fetch.py --pages 40      # بک‌فیل: تا ۴۰ صفحه (~۸۰۰ پست) به عقب برو
  python scripts/fetch.py --channel X     # کانال دیگر
"""
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from categories import CATEGORIES, DEFAULT_CATEGORY, COINS, SHORT_TOKENS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
POSTS_FILE = os.path.join(DATA_DIR, "posts.json")
META_FILE = os.path.join(DATA_DIR, "meta.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "fa,en;q=0.8",
}

# ---------------------------------------------------------------- normalize

ARABIC_MAP = str.maketrans({"ي": "ی", "ك": "ک", "ۀ": "ه", "ة": "ه", "‌": " ", "‏": "", "‎": ""})


def norm(text: str) -> str:
    t = (text or "").lower().translate(ARABIC_MAP)
    t = re.sub(r"[_\-]+", " ", t)
    t = re.sub(r"\s+", " ", t)
    return t


def contains_kw(text_n: str, kw: str) -> bool:
    k = norm(kw).strip()
    if not k:
        return False
    if k in SHORT_TOKENS or (k.isascii() and len(k) <= 4):
        return re.search(r"(?<![a-z0-9])" + re.escape(k) + r"(?![a-z0-9])", text_n) is not None
    if len(k) <= 3:  # واژه‌های کوتاه فارسی: نباید در میانهٔ کلمهٔ دیگر باشند
        return re.search(r"(?<![\u0600-\u06FF])" + re.escape(k), text_n) is not None
    return k in text_n


# ---------------------------------------------------------------- classify

def classify(text: str, hashtags: list) -> dict:
    text_n = norm(text)
    tags_n = " ".join(norm(h) for h in hashtags)
    scores = {}
    for cat in CATEGORIES:
        s = 0
        seen = set()
        for kw in cat["keywords"]:
            kn = norm(kw).strip()
            if kn in seen:
                continue
            seen.add(kn)
            if contains_kw(tags_n, kw):
                s += 2
            elif contains_kw(text_n, kw):
                s += 1
        if s:
            scores[cat["id"]] = round(s * cat.get("weight", 1.0), 2)
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    primary = ranked[0][0] if ranked else DEFAULT_CATEGORY
    secondary = [c for c, s in ranked[1:3] if s >= 2]
    return {"category": primary, "tags": secondary, "scores": scores}


def detect_coins(text: str, hashtags: list) -> list:
    blob = norm(text + " " + " ".join(hashtags))
    found = []
    for ticker, names in COINS.items():
        if any(contains_kw(blob, n.lstrip("#")) for n in names):
            found.append(ticker)
    return found


HASHTAG_RE = re.compile(r"#([\w؀-ۿ‌]+)")

MDLINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)")


def split_footer(text: str):
    """خطوط پایانی که عمدتاً لینک شبکه‌های اجتماعی‌اند را جدا می‌کند → (متن، [{label,url}])"""
    lines = text.split("\n")
    footer = []
    while lines:
        last = lines[-1].strip()
        if not last:
            lines.pop()
            continue
        links = MDLINK_RE.findall(last)
        rest = re.sub(r"[\s\W]", "", MDLINK_RE.sub("", last))
        if links and len(rest) <= 2:
            footer = [{"label": l.strip(), "url": u} for l, u in links] + footer
            lines.pop()
        else:
            break
    return "\n".join(lines).strip(), footer


def extract_hashtags(text: str) -> list:
    return list(dict.fromkeys(HASHTAG_RE.findall(text or "")))


# ---------------------------------------------------------------- parse

def parse_messages(html: str, channel: str) -> list:
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for wrap in soup.select("div.tgme_widget_message"):
        data_post = wrap.get("data-post", "")
        if "/" not in data_post:
            continue
        ch, mid = data_post.rsplit("/", 1)
        try:
            mid = int(mid)
        except ValueError:
            continue

        text_el = wrap.select_one(".tgme_widget_message_text")
        text = ""
        if text_el:
            for br in text_el.find_all("br"):
                br.replace_with("\n")
            # لینک‌ها را به شکل مارک‌داون نگه می‌داریم تا در سایت فعال باشند
            for a in text_el.find_all("a"):
                href = a.get("href", "")
                label = a.get_text("", strip=False)
                if href.startswith("?q=") or not href:  # لینک هشتگ تلگرام
                    a.replace_with(label)
                elif not re.sub(r"[\s\u200b-\u200f\u2060\ufeff]", "", label):
                    a.replace_with("")  # لینک بدون متن (پنهان) → حذف
                elif label.strip() and label.strip() != href:
                    a.replace_with(f"[{label.strip()}]({href})")
                else:
                    a.replace_with(href)
            text = text_el.get_text("", strip=False)
            text = re.sub(r"[ \t]+\n", "\n", text)
            text = re.sub(r"\n{3,}", "\n\n", text).strip()
        text, footer = split_footer(text)

        time_el = wrap.select_one("time[datetime]")
        dt = time_el["datetime"] if time_el else None

        views_el = wrap.select_one(".tgme_widget_message_views")
        views = views_el.get_text(strip=True) if views_el else None

        photos = []
        for p in wrap.select(".tgme_widget_message_photo_wrap, .tgme_widget_message_video_thumb"):
            style = p.get("style", "")
            m = re.search(r"url\('?\"?([^'\")]+)'?\"?\)", style)
            if m:
                photos.append(m.group(1))
        video = wrap.select_one("video.tgme_widget_message_video")
        video_src = video.get("src") if video else None

        preview = wrap.select_one("a.tgme_widget_message_link_preview")
        link_preview = None
        if preview:
            title = preview.select_one(".link_preview_title")
            desc = preview.select_one(".link_preview_description")
            site = preview.select_one(".link_preview_site_name")
            link_preview = {
                "url": preview.get("href"),
                "title": title.get_text(strip=True) if title else None,
                "description": desc.get_text(strip=True) if desc else None,
                "site": site.get_text(strip=True) if site else None,
            }

        is_service = wrap.select_one(".tgme_widget_message_service") is not None or \
            "service_message" in " ".join(wrap.get("class", []))
        if is_service or (not text and not photos and not video_src):
            continue

        hashtags = extract_hashtags(text)
        cls = classify(text, hashtags)
        title = ""
        for ln in text.split("\n"):
            cand = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r"\1", ln)
            cand = re.sub(r"#\S+", "", cand).strip(" :–-—|•\t")
            if len(re.findall(r"[\w\u0600-\u06FF]", cand)) >= 3:
                title = cand
                break
        title = title or cls["category"]
        if len(title) > 120:
            title = title[:117].rstrip() + "…"

        out.append({
            "id": mid,
            "url": f"https://t.me/{ch}/{mid}",
            "date": dt,
            "title": title,
            "text": text,
            "hashtags": hashtags,
            "category": cls["category"],
            "tags": cls["tags"],
            "coins": detect_coins(text, hashtags),
            "views": views,
            "photos": photos,
            "video": video_src,
            "link": link_preview,
            "footer": footer,
        })
    return out


def fetch_page(session, channel: str, before: int = None) -> str:
    url = f"https://t.me/s/{channel}"
    params = {"before": before} if before else None
    r = session.get(url, params=params, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text


def load_existing() -> dict:
    if os.path.exists(POSTS_FILE):
        with open(POSTS_FILE, encoding="utf-8") as f:
            return {p["id"]: p for p in json.load(f)}
    return {}


def save(posts: dict, channel: str, channel_meta: dict):
    os.makedirs(DATA_DIR, exist_ok=True)
    items = sorted(posts.values(), key=lambda p: -p["id"])
    with open(POSTS_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=0)

    by_cat, by_coin = {}, {}
    for p in items:
        by_cat[p["category"]] = by_cat.get(p["category"], 0) + 1
        for c in p["coins"]:
            by_coin[c] = by_coin.get(c, 0) + 1
    meta = {
        "channel": channel,
        "channel_url": f"https://t.me/{channel}",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(items),
        "by_category": by_cat,
        "by_coin": dict(sorted(by_coin.items(), key=lambda kv: -kv[1])),
        "categories": [{k: v for k, v in c.items() if k != "keywords"} for c in CATEGORIES],
        **channel_meta,
    }
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    return meta


def channel_info(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    title = soup.select_one(".tgme_channel_info_header_title")
    desc = soup.select_one(".tgme_channel_info_description")
    photo = soup.select_one(".tgme_channel_info_header img, .tgme_page_photo_image img")
    counters = {}
    for c in soup.select(".tgme_channel_info_counter"):
        v = c.select_one(".counter_value")
        t = c.select_one(".counter_type")
        if v and t:
            counters[t.get_text(strip=True)] = v.get_text(strip=True)
    return {
        "channel_title": title.get_text(strip=True) if title else None,
        "channel_description": desc.get_text(" ", strip=True) if desc else None,
        "channel_photo": photo.get("src") if photo else None,
        "counters": counters,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--channel", default=os.environ.get("TG_CHANNEL", "Coin_Kurd"))
    ap.add_argument("--pages", type=int, default=int(os.environ.get("MAX_PAGES", "3")),
                    help="حداکثر صفحات به عقب (هر صفحه ~۲۰ پست)")
    ap.add_argument("--delay", type=float, default=1.2)
    ap.add_argument("--html", help="برای تست: فایل HTML محلی به‌جای شبکه")
    ap.add_argument("--backfill", action="store_true", default=os.environ.get("BACKFILL", "") == "1",
                    help="تا سقف --pages به عقب برو حتی اگر به پست‌های شناخته‌شده رسیدیم")
    args = ap.parse_args()

    existing = load_existing()
    known_max = max(existing) if existing else 0
    session = requests.Session()
    new_count = 0
    before = None
    info = {}

    for page in range(args.pages):
        if args.html:
            with open(args.html, encoding="utf-8") as f:
                html = f.read()
        else:
            html = fetch_page(session, args.channel, before)
        if page == 0:
            info = channel_info(html)
        msgs = parse_messages(html, args.channel)
        if not msgs:
            break
        for m in msgs:
            if m["id"] not in existing:
                new_count += 1
            elif existing[m["id"]].get("tr"):
                m["tr"] = existing[m["id"]]["tr"]  # ترجمه را نگه دار
            existing[m["id"]] = m  # به‌روزرسانی بازدیدها/ویرایش‌ها
        oldest = min(m["id"] for m in msgs)
        print(f"page {page+1}: {len(msgs)} posts, oldest id {oldest}")
        # در حالت افزایشی: اگر به پست‌های شناخته‌شده رسیدیم، ادامه ندهیم
        if known_max and oldest <= known_max and not args.backfill and not args.html:
            break
        if args.html:
            break
        before = oldest
        time.sleep(args.delay)

    meta = save(existing, args.channel, info)
    print(f"new: {new_count}, total: {meta['count']}, by_category: {meta['by_category']}")


if __name__ == "__main__":
    main()
