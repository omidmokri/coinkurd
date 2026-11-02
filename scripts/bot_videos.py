"""
Daily videos for the main channel (@Coin_Kurd) + daily drafts for the admin.

- Reads the RSS feeds of well-known crypto YouTube channels, keeps Bitcoin/Ethereum videos of the last 48h,
  ranks them by views per hour and posts the top 5 each day as Coin_Kurd's OWN short vertical clip (bot_reel:
  branded slides of the Persian summary + real BTC chart, downloadable in Telegram) with the house-prompt caption
  and the channel signature. Other people's videos are never re-uploaded.
- Rule: one day's videos come from different sources (max one per source per day, never the same twice in a row).
- 10 drafts a day (Persian summaries of the day's news/on-chain items + signature) go to the admins' private
  chat, ready to be forwarded to Saved Messages and given a picture.
- Posted videos are also written to data/videos.json on main for the site.
"""
import html
import json
import logging
import os
import re
import subprocess
import threading
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import requests

import bot_data as D
import bot_feeds as F
import bot_reel as R

log = logging.getLogger("videos")

CHANNELS = [x for x in os.environ.get("VIDEO_CHANNELS", ",".join([
    "UCqK_GSMbpiV8spgD3ZGloSw",   # Coin Bureau
    "UCRvqjQPSeaWn-uEx-w0XOIg",   # Benjamin Cowen
    "UCAl9Ld79qaZxp9JzEOwd3aA",   # Bankless
    "UCbLhGKVY-bJPcawebgtNfbw",   # Altcoin Daily
    "UCN9Nj4tjXbVTLYWN0EKly_Q",   # Crypto Banter
    "UClgJyzwGs-GyaNxUHcLZrkg",   # InvestAnswers
    "UCl2oCaw8hdR_kbqyqd2klIA",   # Lark Davis
    "UC4VPa7EOvObpyCRI4YKRQRw",   # Paul Barron Network
    "UCBH5VZE_Y4F3CMcPIzPEB5A",   # Real Vision
    "UCCatR7nWbYrkVXdxXb4cGXw",   # DataDash
    "UCjemQfjaXAzA-95RKoy9n_g",   # Discover Crypto
    "UCMtJYS0PrtiUwlk6zjGDEMA",   # EllioTrades
    "UCiUnrCUGCJTCC7KjuW493Ww",   # Crypto Zombie
    "UCxODjeUwZHk3p-7TU-IsDOA",   # Boxmining
])).split(",") if x]
PER_DAY = int(os.environ.get("VIDEOS_PER_DAY", "0"))   # off: owner turned automatic videos off
DRAFTS_PER_DAY = int(os.environ.get("DRAFTS_PER_DAY", "10"))
SLOTS_UTC = [5, 8, 11, 15, 19]          # posting hours (Iran ≈ +3:30)
GAP_FIRST_DAY = 180                       # seconds between posts when catching up
KEYS = re.compile(r"\b(bitcoin|btc|ethereum|eth|ether|crypto|etf|halving|altcoin)", re.I)
NS = {"a": "http://www.w3.org/2005/Atom", "m": "http://search.yahoo.com/mrss/",
      "yt": "http://www.youtube.com/xml/schemas/2015"}

SIG = ('<a href="https://t.me/+QdxOfpXU3tdhOTA0">🅲🅾️🅸🅽 🅺🆄🆁🅳 </a>👾<a href="https://discord.gg/BewcJHRBZ">Discord</a> '
       '🎥<a href="https://www.youtube.com/channel/UCUzxNwejhNtSGaOZaI2ku5w">Youtube</a> '
       '📸<a href="https://www.instagram.com/coin_kurd">Instagram</a> 💬<a href="https://twitter.com/omid_mokri">X</a>')
SIG_LEN = 75                              # visible length of the signature in the caption


def fetch(cid):
    try:
        r = requests.get("https://www.youtube.com/feeds/videos.xml?channel_id=" + cid, timeout=30)
        root = ET.fromstring(r.content)
    except Exception as ex:
        log.warning("rss %s: %s", cid, ex)
        return []
    out = []
    for e in root.findall("a:entry", NS):
        vid = e.findtext("yt:videoId", "", NS)
        g = e.find("m:group", NS)
        st = g.find("m:community/m:statistics", NS) if g is not None else None
        out.append({
            "vid": vid, "title": e.findtext("a:title", "", NS),
            "author": e.findtext("a:author/a:name", "", NS),
            "at": e.findtext("a:published", "", NS),
            "desc": g.findtext("m:description", "", NS) if g is not None else "",
            "views": int(st.get("views", 0)) if st is not None else 0,
        })
    return out


def clean_desc(d):
    keep = []
    for ln in (d or "").split("\n"):
        if re.search(r"https?://|www\.|@|#|👉|discount|sponsor|affiliate|subscribe|disclaimer|timestamps?",
                     ln, re.I):
            continue
        if re.match(r"^\s*\d{1,2}:\d{2}", ln):
            continue
        keep.append(ln.strip())
    return "\n".join(x for x in keep if x)[:2500]


def candidates(seen):
    now = time.time()
    vids = []
    for cid in CHANNELS:
        for v in fetch(cid):
            try:
                ts = datetime.fromisoformat(v["at"]).timestamp()
            except Exception:
                continue
            age_h = (now - ts) / 3600
            if v["vid"] in seen or age_h > 72 or "#shorts" in v["title"].lower():
                continue
            if not KEYS.search(v["title"] + " " + v["desc"][:600]):
                continue
            v["text"] = clean_desc(v["desc"])
            if len(v["text"]) < 120:      # too little to summarise honestly
                continue
            v["score"] = v["views"] / max(age_h, 1)
            v["cid"] = cid
            vids.append(v)
    vids.sort(key=lambda v: -v["score"])
    return vids


# Rule (part of the posting prompt): videos of one day must come from different people —
# at most one video per source channel per day, and never two in a row from the same source.
def diverse(vids, st):
    today = {p.get("cid") for p in st["posted"] if p.get("at", "")[:10] == st["day"]}
    last = st["posted"][0].get("cid") if st["posted"] else None
    return [v for v in vids if v["cid"] not in today and v["cid"] != last]


def thumb(vid):
    for q in ("maxresdefault", "hqdefault"):
        u = f"https://i.ytimg.com/vi/{vid}/{q}.jpg"
        try:
            r = requests.head(u, timeout=15)
            if r.ok:
                return u
        except Exception:
            pass
    return None


def state(s):
    v = s.setdefault("videos", {})
    v.setdefault("posted", [])        # [{vid, at, fa, title, img}]
    v.setdefault("seen", [])
    v.setdefault("day", "")
    v.setdefault("today", 0)
    v.setdefault("last_post", 0)
    v.setdefault("drafts_day", "")
    v.setdefault("fail_note", 0)
    if not v.get("reel_v1"):                       # switch to own clips: post today's five again as clips
        v["reel_v1"] = True
        v["day"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        v["today"] = 0
        v["catchup"] = v["day"]
    return v


def post_one(s, st, send_fn, channel, admins):
    for v in diverse(candidates(set(st["seen"])), st):
        st["seen"].append(v["vid"])
        src = f"عنوان ویدیو: {v['title']}\n\n{v['text']}"
        fa = F.summarize(src, "fa", limit=1024 - SIG_LEN - 2)
        if not fa:
            continue
        series, label = btc_series()
        clip = R.make_reel(fa, series, label)
        if not clip:
            log.warning("reel render failed for %s", v["vid"])
            continue
        cap = html.escape(fa, quote=False) + "\n\n" + SIG
        r = send_fn(channel, cap, video=clip)
        if not r.get("ok"):
            log.warning("channel post failed: %s", r.get("description"))
            if time.time() - st["fail_note"] > 6 * 3600:
                st["fail_note"] = time.time()
                for a in admins:
                    send_fn(a, "⚠️ ارسال ویدیو به کانال انجام نشد: " + html.escape(str(r.get("description"))))
            return False
        st["posted"].insert(0, {"vid": v["vid"], "cid": v["cid"], "title": v["title"], "fa": fa,
                                "at": datetime.now(timezone.utc).isoformat()})
        del st["posted"][40:]
        del st["seen"][:-600]
        log.info("video posted: %s (%s)", v["vid"], v["author"])
        return True
    return False


def btc_series():
    try:
        m = D.load("market") or {}
        c = next(x for x in m.get("coins", []) if x.get("coin") == "BTC")
        return c.get("spark") or None, "بیت‌کوین ۴۸ ساعت"
    except Exception:
        return None, ""


def drafts(s, st, send_fn, admins):
    f = F.feed_state(s)
    items = []
    for kind in ("news", "onchain"):
        items += [it for it in f["items"].get(kind, []) if it.get("fa")][:12]
    pref = [it for it in items if re.search(r"بیت|اتریوم|اتر", it["fa"])]
    pick = (pref + [it for it in items if it not in pref])[:DRAFTS_PER_DAY]
    if not pick:
        return False
    for a in admins:
        send_fn(a, f"📝 <b>{len(pick)} پیش‌نویس امروز</b> — هر کدام را به «پیام‌های ذخیره‌شده» فوروارد کن و عکسش را بساز")
        for i, it in enumerate(pick, 1):
            send_fn(a, f"<b>{i}/{len(pick)}</b>\n\n" + html.escape(it["fa"], quote=False) + "\n\n" + SIG)
            time.sleep(1.5)
    return True


def export(st, worktree):
    if not worktree:
        return
    git = lambda *a: subprocess.run(["git", "-C", worktree, *a], capture_output=True, text=True, timeout=120)
    try:
        git("fetch", "-q", "origin", "main")
        git("reset", "-q", "--hard", "origin/main")
        path = os.path.join(worktree, "data", "videos.json")
        json.dump({"updated_at": datetime.now(timezone.utc).isoformat(), "items": st["posted"]},
                  open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        git("add", "data/videos.json")
        if git("diff", "--cached", "--quiet").returncode == 0:
            return
        git("commit", "-q", "-m", "chore: daily videos for site")
        for _ in range(4):
            if git("push", "-q", "origin", "HEAD:main").returncode == 0:
                F.rebuild_site()
                return
            git("fetch", "-q", "origin", "main")
            git("rebase", "-q", "-X", "theirs", "origin/main")
    except Exception:
        log.exception("videos export failed")


def tick(s, send_fn, channel, admins, worktree):
    st = state(s)
    now = datetime.now(timezone.utc)
    day = now.strftime("%Y-%m-%d")
    if st["day"] != day:
        st["day"], st["today"] = day, 0
    changed = False
    due = sum(1 for h in SLOTS_UTC if now.hour >= h)
    first_run = not st["posted"]
    target = PER_DAY if first_run or st.get("catchup") == day else min(due, PER_DAY)
    if st["today"] < target and time.time() - st["last_post"] > GAP_FIRST_DAY:
        st["last_post"] = time.time()
        if first_run:
            st["catchup"] = day
        if post_one(s, st, send_fn, channel, admins):
            st["today"] += 1
            export(st, worktree)
        changed = True
    if st["drafts_day"] != day and now.hour >= 6 and admins:
        if drafts(s, st, send_fn, admins):
            st["drafts_day"] = day
            changed = True
    return changed


def start(s, send_fn, channel, admins, worktree=""):
    state(s)

    def loop():
        time.sleep(30)
        while True:
            try:
                if tick(s, send_fn, channel, admins, worktree):
                    F.DIRTY.set()
            except Exception:
                log.exception("video worker error")
            time.sleep(60)

    th = threading.Thread(target=loop, name="videos", daemon=True)
    th.start()
    return th
