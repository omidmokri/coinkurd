"""
One-time repair of the channel posts whose pictures had broken Persian text (reversed, disconnected letters).

Cause: on 3 Nov 2026 a helper module was added as scripts/bidi.py. Because scripts/ comes first on sys.path,
`from bidi.algorithm import get_display` imported that file instead of the python-bidi package, the import
failed silently and every picture/video made from 4 Nov on was drawn without Persian shaping.
Fix: the helper is now scripts/rtlfmt.py, and all images go through scripts/infocard.py, which self-tests the
shaping and refuses to draw instead of publishing broken text.

This job (runs once per post, remembered in state["mediafix_v1"]):
  • finds every affected post since FIX_FROM in @Coin_Kurd (public web preview t.me/s/…), matched by time
    with the bot's own records (state["deep"]["posts"] for dossiers, state["videos"]["posted"] for reels)
  • draws a NEW image in the owner's infographic design, with market data from Binance AS OF the post time
  • POSTS THE CORRECTED MESSAGE AGAIN and then removes the old one — in that order, so a failed
    send can never cost the channel a post (a failed delete only leaves a duplicate, which is reported).
    Editing in place was unreliable: Telegram keeps serving the cached link preview of the old card.
  • updates data/deep.json so the site shows the fixed cards too, then reports to the admins.
"""
import html
import json
import logging
import os
import threading
import time
from datetime import datetime, timezone

import requests

import bot_reel as R
import infocard as IC

log = logging.getLogger("fixmedia")
FIX_FROM = datetime(2026, 11, 4, 0, 0, tzinfo=timezone.utc)
KEY = "mediafix_v1"
RAW = "https://raw.githubusercontent.com/" + os.environ.get("GITHUB_REPOSITORY", "omidmokri/coinkurd") + "/main/"


def _dt(x):
    try:
        d = datetime.fromisoformat(str(x).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def channel_posts(channel, pages=10):
    """posts of the public channel newer than FIX_FROM: [{id, date(dt), text, video, photos, link}]"""
    import fetch as FE
    out, before = {}, None
    ses = requests.Session()
    for _ in range(pages):
        try:
            page = FE.fetch_page(ses, channel, before)
        except Exception as ex:
            log.warning("channel page failed: %s", ex)
            break
        items = FE.parse_messages(page, channel)
        if not items:
            break
        for p in items:
            p["dt"] = _dt(p.get("date"))
            out[p["id"]] = p
        oldest = min(items, key=lambda p: p["id"])
        if oldest["dt"] and oldest["dt"] < FIX_FROM:
            break
        before = oldest["id"]
        time.sleep(2)
    return sorted((p for p in out.values() if p["dt"] and p["dt"] >= FIX_FROM), key=lambda p: p["id"])


def _near(posts, at, pred, secs=240):
    best = None
    for p in posts:
        gap = abs((p["dt"] - at).total_seconds())
        if gap <= secs and pred(p) and (best is None or gap < best[0]):
            best = (gap, p)
    return best[1] if best else None


def _ok(r):
    return r.get("ok") or "not modified" in str(r.get("description", "")).lower()


def _mid(r):
    return ((r or {}).get("result") or {}).get("message_id")


def _drop(post_fn, channel, mid, stuck):
    """remove the old message; only ever called once its replacement is already up"""
    if not mid:
        return
    r = post_fn("deleteMessage", {"chat_id": channel, "message_id": mid})
    if not r.get("ok"):
        log.warning("old message %s not removed: %s", mid, r.get("description"))
        stuck.append(mid)


def run(s, post_fn, fmt, channel, worktree, push_files, admins, notify, sig):
    """post_fn(method, data, files=None) -> Telegram JSON; fmt = the bot's fix_amp; sig = channel signature"""
    st = s.setdefault(KEY, {"done": [], "failed": []})
    if IC.mode() is None:
        log.error("media repair postponed: Persian shaping unavailable on this runner")
        return False
    posts = channel_posts(channel.lstrip("@"))
    log.info("media repair: %d channel posts since %s", len(posts), FIX_FROM.date())
    hist = s.setdefault("visual", {})
    fixed, failed, stuck, changed_site = [], [], [], False

    # ---- dossiers (link-preview card, or the "🧠" photo fallback)
    deep = (s.get("deep") or {}).get("posts") or []
    for item in deep:
        at = _dt(item.get("at"))
        key = "deep:" + str(item.get("id"))
        if not at or at < FIX_FROM or key in st["done"]:
            continue
        p = None
        if item.get("msg_id"):
            p = next((x for x in posts if x["id"] == item["msg_id"]), None) or {"id": item["msg_id"], "link": True}
        p = p or _near(posts, at, lambda x: (x.get("text") or "").startswith("🧠 پروندهٔ"))
        if not p:
            log.info("dossier %s: channel post not found", item.get("id"))
            continue
        img = None
        try:
            img = IC.render(IC.parse_dossier(item["fa"]), hist=hist, mk=IC.market(at))
        except IC.TextError as ex:
            log.error("dossier %s: Persian check failed, not edited: %s", item.get("id"), ex)
        if not img:
            failed.append(p["id"])
            continue
        body = fmt(item["fa"] + "\n\n" + sig)
        photo_msg = _near(posts, at, lambda x: (x.get("text") or "").strip() in ("🧠", "") and x.get("photos")
                          and x["id"] < p["id"], 120)
        new_id, r = None, {}
        path = f"data/deepimg/{item['id']}-v2.jpg"
        if push_files(worktree, {path: img}, "fix: dossier card with correct Persian text"):
            time.sleep(8)                          # let raw.githubusercontent.com serve the new file
            r = post_fn("sendMessage", {"chat_id": channel, "text": body, "parse_mode": "HTML",
                                        "link_preview_options": {"url": RAW + path, "prefer_large_media": True,
                                                                 "show_above_text": True}})
            new_id = _mid(r)
            if new_id:
                item["img"] = "/" + path
                changed_site = True
        if not new_id:                             # fallback form: the picture, then the text under it
            r = post_fn("sendPhoto", {"chat_id": channel, "caption": "🧠"},
                        files={"photo": ("card.jpg", img, "image/jpeg")})
            if r.get("ok"):
                r2 = post_fn("sendMessage", {"chat_id": channel, "text": body, "parse_mode": "HTML",
                                             "link_preview_options": {"is_disabled": True}})
                new_id = _mid(r2) or _mid(r)
        if new_id:                                 # the old post goes only now that the new one is up
            _drop(post_fn, channel, photo_msg and photo_msg["id"], stuck)
            _drop(post_fn, channel, p["id"], stuck)
            fixed.append(new_id)
            st["done"].append(key)
            item["msg_id"] = new_id
        else:
            failed.append(p["id"])
            log.warning("dossier %s (msg %s) not posted again: %s", item.get("id"), p["id"], r.get("description"))
        time.sleep(4)

    # ---- bot-made reel videos (not the re-uploaded clips of other channels: those have no drawn text)
    vids = (s.get("videos") or {}).get("posted") or []
    for v in vids:
        at = _dt(v.get("at"))
        key = "reel:" + str(v.get("vid"))
        if not at or at < FIX_FROM or key in st["done"] or v.get("reel") == 2:
            continue
        p = _near(posts, at, lambda x: bool(x.get("video") or x.get("photos")), 120)
        if not p:
            log.info("reel %s: channel post not found", v.get("vid"))
            continue
        mk = IC.market(at)
        series = [c[3] for c in mk.get("series") or []] or None
        clip = R.make_reel(v["fa"], series, "بیت‌کوین ۴۸ ساعت", hist=hist, mk=mk)
        if not clip:
            failed.append(p["id"])
            continue
        cap = fmt(html.escape(v["fa"], quote=False) + "\n\n" + sig)
        r = post_fn("sendVideo", {"chat_id": channel, "caption": cap, "parse_mode": "HTML",
                                  "supports_streaming": "true"},
                    files={"reel": ("coin_kurd.mp4", clip, "video/mp4")})
        new_id = _mid(r)
        if new_id:
            _drop(post_fn, channel, p["id"], stuck)
            fixed.append(new_id)
            st["done"].append(key)
            v["msg_id"], v["reel"] = new_id, 2
        else:
            failed.append(p["id"])
            log.warning("reel msg %s not posted again: %s", p["id"], r.get("description"))
        time.sleep(6)

    if changed_site:
        push_files(worktree, {"data/deep.json": json.dumps({"updated_at": datetime.now(timezone.utc).isoformat(),
                                                            "items": deep}, ensure_ascii=False, indent=1)},
                   "fix: dossier cards with correct Persian text (site)")
    st["failed"] = sorted(set(failed))
    st["last_run"] = datetime.now(timezone.utc).isoformat()
    if fixed or failed:
        msg = ("🛠 اصلاح تصاویر کانال: " + (f"{len(fixed)} پست دوباره فرستاده شد و نسخهٔ قدیمی حذف شد"
                                           if fixed else "این بار پستی اصلاح نشد"))
        if fixed:
            msg += "\n" + " ".join(f"t.me/{channel.lstrip('@')}/{i}" for i in fixed)
        if stuck:
            msg += ("\n⚠️ نسخهٔ قدیمی این پیام‌ها پاک نشد و باید دستی حذف شوند: "
                    + " ".join(f"t.me/{channel.lstrip('@')}/{i}" for i in stuck))
        if failed:
            msg += f"\n⚠️ {len(failed)} پست اصلاح نشد؛ در اجرای بعدی دوباره امتحان می‌شود"
        for a in admins:
            notify(a, msg)
    log.info("media repair: fixed %s, failed %s", fixed, failed)
    return bool(fixed or failed)


def start(s, post_fn, fmt, channel, worktree, push_files, admins, notify, sig, dirty):
    def job():
        time.sleep(90)
        try:
            if run(s, post_fn, fmt, channel, worktree, push_files, admins, notify, sig):
                dirty.set()
        except Exception:
            log.exception("media repair failed")

    th = threading.Thread(target=job, name="fixmedia", daemon=True)
    th.start()
    return th
