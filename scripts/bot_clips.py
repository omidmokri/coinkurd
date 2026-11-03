"""
Video clips from a source Telegram channel (default @bitcoin) → @Coin_Kurd, as soon as they are published.

Each new post that carries a video: the video file is downloaded from the channel's public web preview and
uploaded again (downloadable in Telegram), with a caption written by the house prompt (Persian, ≤1024 chars
with the signature, no source/link/English) and the exact channel signature.
Owner's decision: re-upload the video itself.
"""
import html
import logging
import os
import re
import threading
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

import bot_feeds as F
from bot_videos import SIG, SIG_LEN

log = logging.getLogger("clips")
SOURCES = [x.strip().lstrip("@") for x in os.environ.get("CLIP_SOURCES", "bitcoin").split(",") if x.strip()]
CHECK_EVERY = 180
MAX_BYTES = 49 * 1024 * 1024            # Bot API upload limit is 50 MB
BACKFILL_HOURS = 24
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}


def read(channel):
    """-> [{id, iso, text, video}] for posts with a downloadable video, oldest first"""
    r = requests.get(f"https://t.me/s/{channel}", headers=UA, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    out = []
    for m in soup.select(".tgme_widget_message"):
        post = m.get("data-post") or ""
        try:
            pid = int(post.rsplit("/", 1)[1])
        except Exception:
            continue
        v = m.select_one("video[src]")
        if not v:
            continue
        t = m.select_one(".tgme_widget_message_text")
        for br in (t.find_all("br") if t else []):
            br.replace_with("\n")
        tm = m.select_one(".tgme_widget_message_date time[datetime]")
        out.append({"id": pid, "iso": tm["datetime"] if tm else "", "text": t.get_text().strip() if t else "",
                    "video": v["src"]})
    return sorted(out, key=lambda x: x["id"])


def download(url):
    try:
        with requests.get(url, headers=UA, timeout=120, stream=True) as r:
            r.raise_for_status()
            buf = bytearray()
            for chunk in r.iter_content(1 << 16):
                buf += chunk
                if len(buf) > MAX_BYTES:
                    return None
            return bytes(buf) if len(buf) > 10_000 else None
    except Exception as ex:
        log.info("video download failed: %s", ex)
        return None


def tick(s, send_fn, channel):
    st = s.setdefault("clips", {})
    if time.time() - st.get("checked", 0) < CHECK_EVERY:
        return False
    st["checked"] = time.time()
    last = st.setdefault("last", {})
    changed = False
    for src in SOURCES:
        try:
            posts = read(src)
        except Exception as ex:
            log.info("clips %s: %s", src, ex)
            continue
        if src not in last:                       # first run: only the last BACKFILL_HOURS
            cut = time.time() - BACKFILL_HOURS * 3600
            older = [p["id"] for p in posts if p["iso"] and datetime.fromisoformat(p["iso"]).timestamp() < cut]
            last[src] = max(older) if older else (posts[0]["id"] - 1 if posts else 0)
            changed = True
        for p in posts:
            if p["id"] <= last[src]:
                continue
            last[src] = p["id"]                   # never retry a post forever
            changed = True
            if len(p["text"]) < 25:
                log.info("clip %s/%s skipped: no text to summarise", src, p["id"])
                continue
            cap = F.summarize(p["text"], "fa", limit=1024 - SIG_LEN - 2)
            if not cap:
                log.info("clip %s/%s skipped: no valid summary", src, p["id"])
                continue
            vid = download(p["video"])
            if not vid:
                log.info("clip %s/%s skipped: video not downloadable", src, p["id"])
                continue
            r = send_fn(channel, html.escape(cap, quote=False) + "\n\n" + SIG, video=vid)
            log.info("clip %s/%s -> %s", src, p["id"], "posted" if r.get("ok") else r.get("description"))
            time.sleep(20)
    return changed


def start(s, send_fn, channel):
    def loop():
        time.sleep(40)
        while True:
            try:
                if tick(s, send_fn, channel):
                    F.DIRTY.set()
            except Exception:
                log.exception("clips error")
            time.sleep(30)

    th = threading.Thread(target=loop, name="clips", daemon=True)
    th.start()
    return th
