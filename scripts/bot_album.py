"""
گزارش تصویری روزانه — the owner's twice-daily picture report, posted to @Coin_Kurd.

At 07:30 and 19:30 Tehran time (04:00 and 16:00 UTC — Iran keeps no daylight saving) album.build() reads the
site's data and Binance, writes, draws ten 1080×1350 pictures and the caption, and runs the owner's checklist.
Only a report that passes every check is posted: ONE album, the caption on its first picture. The message link
is recorded (bot state, and data/album.json for the site); the admins get the link with the check results — or
the plain reason it was not posted. A send that ended without Telegram's answer (a timeout) is never repeated
blindly: the admins are told the result is unknown, because a second try could post the album twice.

Also here: /album (admins) draws a preview into the admin's own chat without touching the channel, and the bot's
«📸 گزارش تصویری» button copies the latest album into the user's chat.
"""
import json
import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone

import requests

import album as A

log = logging.getLogger("album")

SLOTS = (("m", 4, 0), ("e", 16, 0))          # UTC → 07:30 and 19:30 Tehran
LEAD = 8 * 60                                 # build eight minutes before the slot, post on the minute
LATE = 75 * 60                                # a slot missed by a restart is still posted within 75 minutes
RETRY = 4 * 60                                # a failed build is tried again after four minutes …
MAX_TRIES = 3                                 # … three times at most
START = datetime(2026, 11, 12, 16, 0, tzinfo=timezone.utc)      # the first live edition (19:30 Tehran, 21 Aban)
KEEP = 30

REQ_URL = ("https://raw.githubusercontent.com/" + os.environ.get("GITHUB_REPOSITORY", "omidmokri/coinkurd")
           + "/main/data/album_request.json")    # an extra edition asked for outside the timetable
_req = {"t": 0.0}

LOCK = threading.Lock()                       # held while an album is being sent and recorded
CLOSING = threading.Event()                   # the run is ending: no new send may start
CFG = {}


def state(s):
    st = s.setdefault("album", {})
    st.setdefault("done", {})
    return st


def fa_time(t):
    return A.hm(t)


def edition_name(ed):
    return A.EDITION[ed]["name"]


# ------------------------------------------------------------------ Telegram
def _post(method, data=None, files=None, timeout=60):
    """→ ("ok", result) | ("error", description, retry_after) | ("unknown", reason): no answer from Telegram"""
    if not CFG.get("api"):
        return ("error", "picture-report module not started", None)
    try:
        if files:
            r = requests.post(CFG["api"] + method, data=data, files=files, timeout=timeout)
        else:
            r = requests.post(CFG["api"] + method, json=data, timeout=timeout)
    except requests.exceptions.ConnectionError as ex:
        if "Connection refused" in str(ex) or "Name or service not known" in str(ex) or "NewConnectionError" in str(ex):
            return ("error", f"no connection to Telegram: {ex}", 30)          # never reached Telegram
        return ("unknown", str(ex))
    except requests.exceptions.RequestException as ex:
        return ("unknown", str(ex))
    try:
        j = r.json()
    except ValueError:
        return ("unknown", f"HTTP {r.status_code} without a JSON answer")
    if j.get("ok"):
        return ("ok", j.get("result"))
    return ("error", j.get("description") or f"HTTP {r.status_code}", (j.get("parameters") or {}).get("retry_after"))


def say(chat_id, text):
    _post("sendMessage", {"chat_id": chat_id, "text": text, "parse_mode": "HTML",
                          "link_preview_options": {"is_disabled": True}})


def tell_admins(text):
    for a in CFG.get("admins") or []:
        try:
            say(a, text)
        except Exception:
            log.exception("admin report not sent")


def send_album(chat_id, pics, cap):
    media = [{"type": "photo", "media": f"attach://p{i}"} for i in range(len(pics))]
    media[0]["caption"] = cap
    media[0]["parse_mode"] = "HTML"
    files = {f"p{i}": (f"coin_kurd_{i + 1:02d}.jpg", b, "image/jpeg") for i, b in enumerate(pics)}
    for attempt in range(3):
        res = _post("sendMediaGroup", {"chat_id": chat_id, "media": json.dumps(media, ensure_ascii=False)}, files, 180)
        if res[0] == "error" and res[2] and attempt < 2:          # flood limit: Telegram says when to retry
            time.sleep(min(int(res[2]) + 2, 120))
            continue
        return res
    return res


# ------------------------------------------------------------------ one edition
def due(now, st):
    for day in (now.date() - timedelta(days=1), now.date()):
        for ed, h, m in SLOTS:
            t = datetime(day.year, day.month, day.day, h, m, tzinfo=timezone.utc)
            key = f"{t:%Y-%m-%d}:{ed}"
            if t < START or (st["done"].get(key) or {}).get("state") in ("ok", "failed", "unknown"):
                continue
            if t - timedelta(seconds=LEAD) <= now <= t + timedelta(seconds=LATE):
                return key, ed, t
    return None


def make(ed, t, st):
    """→ (album or None, problems)"""
    try:
        alb = A.build(now=datetime.now(timezone.utc), edition=ed, prev=st.get("last"), use_ai=True,
                      sig=CFG.get("sig", ""), pub=max(t, datetime.now(timezone.utc)))
        return alb, alb["problems"]
    except A.AlbumError as ex:
        return None, [str(ex)]
    except Exception as ex:                        # a bug must not take the bot down, and must be reported
        log.exception("album build crashed")
        return None, [f"internal error: {type(ex).__name__}: {ex}"]


def report_ok(ed, t, alb, link):
    f, tx = alb["f"], alb["tx"]
    lines = [f"✅ <b>گزارش تصویری {edition_name(ed)} منتشر شد</b>",
             f"🔗 {link}",
             f"🕢 نوبت {fa_time(t)} · انتشار {fa_time(datetime.now(timezone.utc))} · ۱۰ تصویر · کپشن "
             f"{A.fnum(A.utf16(A.visible(alb['caption'])))} نویسه · ۴ هشتگ",
             "☑️ کنترل کیفیت: همهٔ موارد فهرست کنترل گذرانده شد",
             "🤖 متن‌های هوش مصنوعی (پس از بررسی اعداد): " + ("، ".join(tx["ai"]) if tx["ai"] else "استفاده نشد؛ قالب‌های ثابت")]
    sk = (f.get("movers") or {}).get("skipped") or []
    if sk:
        lines.append("ℹ️ ارزهای بدون نشان تأییدشده کنار گذاشته شدند: " + "، ".join(sk))
    tell_admins("\n".join(lines))


def report_fail(ed, t, problems, unknown=False):
    head = (f"⚠️ <b>نتیجهٔ ارسال گزارش تصویری {edition_name(ed)} ({fa_time(t)}) نامعلوم است</b>\n"
            "تلگرام پاسخی نداد؛ ممکن است آلبوم منتشر شده باشد یا نه. برای جلوگیری از انتشار دوباره، تلاش دیگری نشد؛ "
            "لطفاً کانال را بررسی کنید." if unknown else
            f"❌ <b>گزارش تصویری {edition_name(ed)} ({fa_time(t)}) منتشر نشد</b>\nهیچ پستی در کانال گذاشته نشد.")
    body = "\n".join("• " + A.IC.clean(p)[:300] for p in problems[:6])
    tell_admins(head + "\n\nعلت:\n" + body)


def site_record(st):
    """data/album.json — the published editions with their links, for the site"""
    if not (CFG.get("push") and CFG.get("worktree")):
        return
    items = [dict(v, key=k) for k, v in sorted(st["done"].items(), reverse=True) if v.get("state") == "ok"][:KEEP]
    doc = {"updated_at": datetime.now(timezone.utc).isoformat(), "channel": CFG["channel"], "items": items}
    try:
        CFG["push"](CFG["worktree"], {"data/album.json": json.dumps(doc, ensure_ascii=False, indent=1)},
                    "chore: picture report published")
    except Exception:
        log.exception("album record not pushed")


def run_slot(s, key, ed, t, extra=False):
    st = state(s)
    rec = st["done"].setdefault(key, {"state": "pending", "tries": 0})
    if rec.get("next") and time.time() < rec["next"]:
        return False
    rec["tries"] = rec.get("tries", 0) + 1
    alb, problems = make(ed, t, st)
    if problems:
        log.warning("album %s try %s not ready: %s", key, rec["tries"], problems)
        late = datetime.now(timezone.utc) + timedelta(seconds=RETRY) > t + timedelta(seconds=LATE)
        if rec["tries"] < MAX_TRIES and not late and not extra:
            rec.update(next=time.time() + RETRY, problems=problems[:6])
            return True
        rec.update(state="failed", problems=problems[:6], at=datetime.now(timezone.utc).isoformat())
        report_fail(ed, t, problems)
        CFG["persist"]()
        return True
    while datetime.now(timezone.utc) < t:          # built early; post on the minute
        if CLOSING.is_set():
            return False                           # the run ends before the slot: the next run builds afresh
        time.sleep(3)
    try:                                           # the market may have run away while we waited
        live = A.tickers()["BTC"]["price"]
        if abs(live / alb["f"]["btc"]["price"] - 1) > 0.015:
            log.info("album %s: BTC moved %.2f%% since the build; drawing again", key, (live / alb["f"]["btc"]["price"] - 1) * 100)
            alb2, problems2 = make(ed, t, st)
            if problems2:
                rec.update(state="failed", problems=problems2[:6], at=datetime.now(timezone.utc).isoformat())
                report_fail(ed, t, problems2)
                CFG["persist"]()
                return True
            alb = alb2
    except Exception as ex:
        log.info("album %s: last price check skipped (%s)", key, ex)
    with LOCK:
        if CLOSING.is_set():
            return False
        res = send_album(CFG["channel"], alb["pics"], alb["caption"])
        now = datetime.now(timezone.utc)
        if res[0] == "unknown":
            rec.update(state="unknown", problems=[res[1]], at=now.isoformat())
            CFG["persist"]()
            report_fail(ed, t, [res[1]], unknown=True)
            return True
        if res[0] == "error":
            rec.update(state="failed", problems=[res[1]], at=now.isoformat())
            CFG["persist"]()
            report_fail(ed, t, [f"تلگرام نپذیرفت: {res[1]}"])
            return True
        msgs = res[1] or []
        chat = (msgs[0].get("chat") or {}) if msgs else {}
        user = chat.get("username") or CFG["channel"].lstrip("@")
        link = f"https://t.me/{user}/{msgs[0]['message_id']}" if msgs else ""
        wrong = []
        if len(msgs) != 10:
            wrong.append(f"تلگرام {len(msgs)} پیام برگرداند، نه ۱۰")
        if user.lower() != CFG["channel"].lstrip("@").lower():
            wrong.append(f"آلبوم در کانال دیگری ثبت شد: {user}")
        if len({m.get("media_group_id") for m in msgs}) > 1:
            wrong.append("تصویرها در یک آلبوم واحد قرار نگرفتند")
        rec.update(state="ok", link=link, ids=[m["message_id"] for m in msgs], chat=chat.get("id") or CFG["channel"],
                   at=now.isoformat(), slot=t.isoformat(), headline=alb["tx"]["headline"], ai=alb["tx"]["ai"],
                   check=wrong or ["passed"])
        rec.pop("next", None)
        rec.pop("problems", None)
        st["last"] = A.snapshot(alb, key)
        st["latest"] = {"key": key, "link": link, "ids": rec["ids"], "chat": rec["chat"], "at": rec["at"]}
        for k in sorted(st["done"])[:-KEEP]:
            del st["done"][k]
        CFG["persist"]()
    log.info("album %s posted: %s", key, link)
    if wrong:
        tell_admins(f"⚠️ گزارش تصویری {edition_name(ed)} ارسال شد ({link}) اما:\n" + "\n".join("• " + w for w in wrong))
    else:
        report_ok(ed, t, alb, link)
    site_record(st)
    return True


def expire(s):
    """a slot whose window closed without a post is reported once — also when the bot was not running at all"""
    st = state(s)
    now = datetime.now(timezone.utc)
    for day in (now.date() - timedelta(days=1), now.date()):
        for ed, h, m in SLOTS:
            t = datetime(day.year, day.month, day.day, h, m, tzinfo=timezone.utc)
            key = f"{t:%Y-%m-%d}:{ed}"
            if t < START or now <= t + timedelta(seconds=LATE):
                continue
            rec = st["done"].get(key)
            if rec and rec.get("state") in ("ok", "failed", "unknown"):
                continue
            problems = (rec or {}).get("problems") or ["ربات در بازهٔ انتشار (تا ۷۵ دقیقه پس از نوبت) فرصت ساختن و ارسال گزارش را نداشت"]
            st["done"][key] = dict(rec or {}, state="failed", problems=problems, at=now.isoformat())
            report_fail(ed, t, problems)
            CFG["persist"]()


def pending_request(s):
    """an extra edition: queued by an admin (/album post) or asked for in data/album_request.json on the site
    ({"id": "...", "requested_at": ISO}); a request older than two hours is ignored, each id is served once"""
    st = state(s)
    q = st.setdefault("queue", [])
    if q:
        return q[0]
    if time.time() - _req["t"] < 120:
        return None
    _req["t"] = time.time()
    try:
        r = requests.get(REQ_URL, params={"t": int(time.time())}, timeout=20)
        j = r.json() if r.ok else None
    except Exception:
        j = None
    if not isinstance(j, dict) or not j.get("id"):
        return None
    rid = str(j["id"])[:40]
    served = st.setdefault("requests", [])
    if rid in served:
        return None
    at = A.parse_dt(j.get("requested_at"))
    last = A.parse_dt((st.get("latest") or {}).get("at"))
    if not at or datetime.now(timezone.utc) - at > timedelta(hours=2) or (last and last >= at):
        served.append(rid)                           # stale, or a timetable edition has already answered it
        return None
    q.append({"id": rid, "at": at.isoformat(), "by": "site"})
    return q[0]


def request_now(s, chat_id):
    """/album post — an admin asks for an extra edition now; it goes through the same checks"""
    st = state(s)
    rid = f"admin{int(time.time())}"
    st.setdefault("queue", []).append({"id": rid, "at": datetime.now(timezone.utc).isoformat(), "by": chat_id})
    say(chat_id, "📸 درخواست ثبت شد: یک گزارش تصویری تازه ساخته می‌شود و اگر همهٔ موارد فهرست کنترل را بگذراند، "
                 "تا حدود دو دقیقهٔ دیگر در کانال منتشر می‌شود. نتیجه و لینک همین‌جا گزارش می‌شود.")


def tick(s):
    expire(s)
    st = state(s)
    now = datetime.now(timezone.utc)
    d = due(now, st)
    if d:
        return run_slot(s, *d)
    if d is None and not any(t - timedelta(seconds=LEAD + 600) <= now <= t for t in upcoming(now)):
        req = pending_request(s)                     # never right before a timetable slot
        if req:
            st["queue"].pop(0)
            st.setdefault("requests", []).append(req["id"])     # served once, even if this run dies midway
            del st["requests"][:-50]
            key = f"{now:%Y-%m-%d}:x{req['id']}"
            return run_slot(s, key, "m" if A.teh(now).hour < 13 else "e", now, extra=True)
    return False


def upcoming(now):
    return [datetime(d.year, d.month, d.day, h, m, tzinfo=timezone.utc)
            for d in (now.date(), now.date() + timedelta(days=1)) for _, h, m in SLOTS]


def wait_idle(timeout=150):
    """called when the run ends: no new send starts, and a send in progress is allowed to finish and be recorded"""
    CLOSING.set()
    if LOCK.acquire(timeout=timeout):
        LOCK.release()


def start(s, api, channel, admins, sig, persist, push=None, worktree=""):
    CFG.update(api=api, channel=channel, admins=list(admins or []), sig=sig, persist=persist, push=push, worktree=worktree)

    def loop():
        time.sleep(20)
        st = state(s)
        if not st.get("preview_sent"):                # once, when this feature first runs: the admins see the
            st["preview_sent"] = datetime.now(timezone.utc).isoformat()       # report before it reaches the channel
            for a in CFG["admins"]:
                preview_to(a, first=True)
            CFG["persist"]()
        while not CLOSING.is_set():
            try:
                tick(s)
            except Exception:
                log.exception("album loop error")
            time.sleep(20)

    th = threading.Thread(target=loop, name="album", daemon=True)
    th.start()
    return th


# ------------------------------------------------------------------ admins and users
def preview_to(chat_id, first=False):
    """/album: the report as it would be posted now, into the admin's own chat — the channel is not touched"""
    def job():
        if first:
            nxt = next((t for t in sorted(datetime(d.year, d.month, d.day, h, m, tzinfo=timezone.utc)
                                          for d in (datetime.now(timezone.utc).date(), datetime.now(timezone.utc).date() + timedelta(days=1))
                                          for _, h, m in SLOTS) if t >= max(START, datetime.now(timezone.utc))), None)
            say(chat_id, "📸 <b>گزارش تصویری روزانه راه‌اندازی شد</b>\nهر روز ساعت ۷:۳۰ و ۱۹:۳۰ به وقت تهران، ده تصویر و یک کپشن، "
                "پس از کنترل کیفیت، خودکار در کانال منتشر می‌شود و نتیجه و لینک آن همین‌جا گزارش می‌شود."
                + (f"\nنخستین انتشار: {A.jdate(nxt)} ساعت {A.hm(nxt)}" if nxt else "")
                + "\nپیش‌نمایش با داده‌های همین لحظه در پیام بعدی می‌آید. فرمان /album هر وقت پیش‌نمایش تازه می‌سازد.")
        say(chat_id, "⏳ در حال ساختن پیش‌نمایش گزارش تصویری (حدود یک دقیقه)…")
        now = datetime.now(timezone.utc)
        ed = "m" if A.teh(now).hour < 13 else "e"
        alb, problems = make(ed, now, {})
        if alb is None:
            return say(chat_id, "❌ پیش‌نمایش ساخته نشد:\n" + "\n".join("• " + p for p in problems))
        res = send_album(chat_id, alb["pics"], alb["caption"])
        verdict = ("☑️ همهٔ موارد فهرست کنترل گذرانده شد" if not problems else
                   "⚠️ این نسخه به کانال نمی‌رفت:\n" + "\n".join("• " + p for p in problems))
        say(chat_id, "🧪 <b>پیش‌نمایش؛ به کانال ارسال نشد</b>\n" + verdict + "\n🤖 هوش مصنوعی: "
            + ("، ".join(alb["tx"]["ai"]) or "استفاده نشد") + ("" if res[0] == "ok" else f"\nارسال پیش‌نمایش: {res[1]}"))
    threading.Thread(target=job, name="album-preview", daemon=True).start()


TXT = {"none": {"fa": "📸 هنوز گزارش تصویری‌ای منتشر نشده است. نوبت‌ها: هر روز ساعت ۷:۳۰ و ۱۹:۳۰ به وقت تهران در کانال کوین کورد.",
                "ckb": "📸 هێشتا ڕاپۆرتی وێنەیی بڵاو نەکراوەتەوە. کاتەکان: هەموو ڕۆژێک کاتژمێر ٧:٣٠ و ١٩:٣٠ بە کاتی تاران لە کەناڵی کۆین کورد.",
                "en": "📸 No picture report has been published yet. Editions: every day at 07:30 and 19:30 Tehran time on the Coin Kurd channel."},
       "fail": {"fa": "📸 آخرین گزارش تصویری در کانال: {link}", "ckb": "📸 دوایین ڕاپۆرتی وێنەیی لە کەناڵ: {link}",
                "en": "📸 Latest picture report on the channel: {link}"}}


def latest_text(s, chat_id, lang, tg):
    """the bot's «📸 گزارش تصویری» button: copies the latest album into the user's chat (albums stay grouped);
    → a line to show under it when there is nothing to copy, else None"""
    lt = state(s).get("latest")
    pick = lambda d: d.get(lang) or d["fa"]
    if not lt:
        return pick(TXT["none"])
    r = tg("copyMessages", chat_id=chat_id, from_chat_id=lt["chat"], message_ids=lt["ids"]) or {}
    return None if r.get("ok") else pick(TXT["fail"]).format(link=lt["link"])
