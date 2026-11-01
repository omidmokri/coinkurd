"""
Coin_Kurd referral bot — runs inside GitHub Actions (no server needed).

Each run long-polls Telegram for RUN_SECONDS, then exits; the workflow
commits data/bot/referrals.json so state survives between runs.
Only `requests` (already in requirements.txt) is needed.

Env:
  REF_BOT_TOKEN   bot token (falls back to TG_BOT_TOKEN)
  CHANNEL         @Coin_Kurd            channel to check membership in
  CHANNEL_LINK    https://t.me/Coin_Kurd
  GROUP           @Coin_Kurd_Group      group with join-gate ("" = off)
  ADMIN_IDS       comma-separated numeric ids
  REWARD_AT       5
  REWARD_TEXT     message sent to the referrer when REWARD_AT is reached
  RUN_SECONDS     840
"""
import json, logging, os, sys, time, urllib.parse
import requests

TOKEN = os.environ.get("REF_BOT_TOKEN") or os.environ.get("TG_BOT_TOKEN") or ""
CHANNEL = os.environ.get("CHANNEL", "@Coin_Kurd")
CHANNEL_LINK = os.environ.get("CHANNEL_LINK", "https://t.me/Coin_Kurd")
GROUP = os.environ.get("GROUP", "@Coin_Kurd_Group").strip()
ADMIN_IDS = {int(x) for x in os.environ.get("ADMIN_IDS", "").split(",") if x.strip().lstrip("-").isdigit()}
REWARD_AT = int(os.environ.get("REWARD_AT", "5"))
REWARD_TEXT = os.environ.get("REWARD_TEXT") or "🎁 تبریک! به {n} دعوت رسیدی. برای دریافت پاداش به ادمین پیام بده."
RUN_SECONDS = int(os.environ.get("RUN_SECONDS", "840"))
STATE = os.environ.get("STATE_PATH", "data/bot/referrals.json")
PUBLIC = os.environ.get("PUBLIC_PATH", "data/bot/leaderboard.json")
API = f"https://api.telegram.org/bot{TOKEN}/"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("refbot")

# ------------------------------------------------------------------ state
def load_state():
    try:
        with open(STATE, encoding="utf-8") as f:
            s = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        s = {}
    s.setdefault("offset", 0)
    s.setdefault("users", {})          # uid(str) -> {username, name, referrer, joined, created}
    return s

def save_state(s):
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    tmp = STATE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1)
    os.replace(tmp, STATE)
    # public leaderboard (no ids) for the website
    with open(PUBLIC, "w", encoding="utf-8") as f:
        json.dump({"updated": int(time.time()), "reward_at": REWARD_AT,
                   "top": [{"name": n, "points": p} for _, n, p in leaderboard(s, 20)]},
                  f, ensure_ascii=False, indent=1)

def upsert(s, user, referrer=None):
    uid = str(user["id"])
    u = s["users"].get(uid)
    if u is None:
        if referrer is not None and str(referrer) == uid:
            referrer = None                     # no self-referral
        s["users"][uid] = {"username": user.get("username"), "name": user.get("first_name", ""),
                           "referrer": referrer, "joined": False, "created": int(time.time())}
    else:
        u["username"] = user.get("username"); u["name"] = user.get("first_name", "")

def mark_joined(s, uid):
    """Returns referrer id the first time this user is confirmed, else None."""
    u = s["users"].get(str(uid))
    if not u or u["joined"]:
        return None
    u["joined"] = True
    return u["referrer"]

def points(s, uid):
    return sum(1 for u in s["users"].values() if u["referrer"] == uid and u["joined"])

def leaderboard(s, n=10):
    counts = {}
    for u in s["users"].values():
        if u["joined"] and u["referrer"] is not None:
            counts[u["referrer"]] = counts.get(u["referrer"], 0) + 1
    rows = []
    for uid, p in sorted(counts.items(), key=lambda x: -x[1])[:n]:
        info = s["users"].get(str(uid), {})
        name = f"@{info['username']}" if info.get("username") else (info.get("name") or str(uid))
        rows.append((uid, name, p))
    return rows

# ------------------------------------------------------------------ telegram
def tg(method, **params):
    try:
        r = requests.post(API + method, json=params, timeout=60)
        data = r.json()
        if not data.get("ok"):
            log.warning("%s -> %s", method, data.get("description"))
        return data
    except Exception as e:
        log.warning("%s failed: %s", method, e)
        return {"ok": False}

def send(chat_id, text, kb=None, **kw):
    p = dict(chat_id=chat_id, text=text, parse_mode="HTML", disable_web_page_preview=True, **kw)
    if kb: p["reply_markup"] = kb
    return tg("sendMessage", **p)

def is_member(uid):
    d = tg("getChatMember", chat_id=CHANNEL, user_id=uid)
    return d.get("ok") and d["result"]["status"] in ("member", "administrator", "creator")

def join_kb():
    return {"inline_keyboard": [[{"text": "📢 عضویت در کانال Coin_Kurd", "url": CHANNEL_LINK}],
                                [{"text": "✅ عضو شدم", "callback_data": "check"}]]}

def main_kb(link):
    share = "https://t.me/share/url?" + urllib.parse.urlencode(
        {"url": link, "text": "تحلیل روزانه کریپتو به فارسی و کوردی 📊"})
    return {"inline_keyboard": [
        [{"text": "🔗 لینک دعوت من", "callback_data": "mylink"}],
        [{"text": "📊 امتیاز من", "callback_data": "score"}, {"text": "🏆 برترین‌ها", "callback_data": "top"}],
        [{"text": "↗️ اشتراک‌گذاری لینک", "url": share}]]}

def welcome(link, p):
    return (f"سڵاو / سلام 👋\n\nبا دعوت دوستانت به کانال <b>Coin_Kurd</b> امتیاز بگیر.\n"
            f"هر دوستی که با لینک تو عضو کانال شود = ۱ امتیاز.\n"
            f"با <b>{REWARD_AT}</b> امتیاز پاداش می‌گیری.\n\n"
            f"🔗 لینک دعوت تو:\n<code>{link}</code>\n\n📊 امتیاز فعلی: <b>{p}</b>")

def format_top(s):
    rows = leaderboard(s)
    if not rows:
        return "هنوز کسی امتیازی نگرفته. اولین نفر باش! 🚀"
    medals = ["🥇", "🥈", "🥉"]
    out = ["🏆 <b>برترین دعوت‌کننده‌ها</b>\n"]
    for i, (_, name, p) in enumerate(rows):
        out.append(f"{medals[i] if i < 3 else str(i+1)+'.'} {name} — <b>{p}</b>")
    return "\n".join(out)

# ------------------------------------------------------------------ handlers
BOT_USERNAME = None
def invite_link(uid):
    return f"https://t.me/{BOT_USERNAME}?start={uid}"

def after_verified(s, uid, chat_id, edit_msg_id=None):
    referrer = mark_joined(s, uid)
    if referrer is not None:
        p = points(s, referrer)
        send(referrer, f"🎉 یکی از دوستانت با لینک تو عضو شد! امتیاز: <b>{p}</b>")
        if p == REWARD_AT:
            send(referrer, REWARD_TEXT.format(n=REWARD_AT))
    link = invite_link(uid)
    text = welcome(link, points(s, uid))
    if edit_msg_id:
        tg("editMessageText", chat_id=chat_id, message_id=edit_msg_id, text=text,
           parse_mode="HTML", disable_web_page_preview=True, reply_markup=main_kb(link))
    else:
        send(chat_id, text, main_kb(link))

def handle_private(s, msg):
    user, uid, chat_id = msg["from"], msg["from"]["id"], msg["chat"]["id"]
    text = (msg.get("text") or "").strip()
    cmd, _, arg = text.partition(" ")
    cmd = cmd.split("@")[0].lower()
    if cmd == "/start":
        ref = int(arg) if arg.strip().isdigit() else None
        upsert(s, user, ref)
        if is_member(uid):
            after_verified(s, uid, chat_id)
        else:
            send(chat_id, "برای استفاده از ربات اول عضو کانال شو، بعد روی «عضو شدم» بزن 👇", join_kb())
    elif cmd == "/top":
        send(chat_id, format_top(s))
    elif cmd == "/id":
        send(chat_id, f"user_id: <code>{uid}</code>")
    elif cmd == "/stats" and uid in ADMIN_IDS:
        us = s["users"].values()
        send(chat_id, "📊 <b>آمار ربات</b>\n"
             f"کاربران ربات: {len(s['users'])}\n"
             f"تأییدشدهٔ عضو کانال: {sum(u['joined'] for u in us)}\n"
             f"عضو شده از طریق دعوت: {sum(1 for u in us if u['joined'] and u['referrer'] is not None)}\n"
             f"کاربر جدید ۲۴ ساعت اخیر: {sum(1 for u in us if u['created'] > time.time()-86400)}")
    elif cmd == "/export" and uid in ADMIN_IDS:
        lines = ["id,username,name,referrer,joined,points"]
        for k, u in s["users"].items():
            lines.append(f"{k},{u.get('username') or ''},{(u.get('name') or '').replace(',', ' ')},"
                         f"{u['referrer'] or ''},{int(u['joined'])},{points(s, int(k))}")
        requests.post(API + "sendDocument", data={"chat_id": chat_id},
                      files={"document": ("referrals.csv", "﻿" + "\n".join(lines))}, timeout=60)
    else:
        upsert(s, user)
        link = invite_link(uid)
        send(chat_id, welcome(link, points(s, uid)), main_kb(link))

def handle_callback(s, cb):
    uid, data = cb["from"]["id"], cb.get("data", "")
    chat_id = cb["message"]["chat"]["id"]; mid = cb["message"]["message_id"]
    if data == "check":
        if is_member(uid):
            upsert(s, cb["from"])
            after_verified(s, uid, chat_id, edit_msg_id=mid)
            tg("answerCallbackQuery", callback_query_id=cb["id"], text="✅ تأیید شد")
        else:
            tg("answerCallbackQuery", callback_query_id=cb["id"], text="هنوز عضو کانال نشدی ❌", show_alert=True)
    elif data == "mylink":
        send(chat_id, f"🔗 لینک دعوت تو:\n<code>{invite_link(uid)}</code>\n\nاین لینک را برای دوستانت بفرست.")
        tg("answerCallbackQuery", callback_query_id=cb["id"])
    elif data == "score":
        p = points(s, uid)
        tg("answerCallbackQuery", callback_query_id=cb["id"], show_alert=True,
           text=f"امتیاز تو: {p}\nتا پاداش: {max(REWARD_AT-p, 0)} دعوت دیگر")
    elif data == "top":
        send(chat_id, format_top(s))
        tg("answerCallbackQuery", callback_query_id=cb["id"])

def handle_group(s, msg):
    """Join-gate: delete messages from people who are not channel members."""
    user = msg.get("from") or {}
    if not GROUP or user.get("is_bot") or user.get("id") in ADMIN_IDS:
        return
    chat = msg["chat"]
    if GROUP.lstrip("-").isdigit():
        if str(chat["id"]) != GROUP: return
    elif (chat.get("username") or "").lower() != GROUP.lstrip("@").lower():
        return
    if (msg.get("text") or "").split("@")[0] == "/id":
        send(chat["id"], f"chat_id: <code>{chat['id']}</code>", reply_to_message_id=msg["message_id"]); return
    if is_member(user["id"]):
        return
    tg("deleteMessage", chat_id=chat["id"], message_id=msg["message_id"])
    name = user.get("first_name", "کاربر")
    send(chat["id"], f'<a href="tg://user?id={user["id"]}">{name}</a> برای گفتگو در گروه اول عضو کانال شو 👇',
         {"inline_keyboard": [[{"text": "📢 عضویت در کانال", "url": CHANNEL_LINK}]]})

def handle_update(s, up):
    if "message" in up:
        m = up["message"]
        if m["chat"]["type"] == "private":
            handle_private(s, m)
        elif m["chat"]["type"] in ("group", "supergroup"):
            handle_group(s, m)
    elif "callback_query" in up:
        handle_callback(s, up["callback_query"])

# ------------------------------------------------------------------ main loop
def main():
    global BOT_USERNAME
    if not TOKEN:
        log.error("REF_BOT_TOKEN missing"); return 1
    me = tg("getMe")
    if not me.get("ok"):
        log.error("bad token"); return 1
    BOT_USERNAME = me["result"]["username"]
    tg("deleteWebhook")                                      # polling mode
    s = load_state()
    log.info("running as @%s for %ss, %d users", BOT_USERNAME, RUN_SECONDS, len(s["users"]))
    deadline = time.time() + RUN_SECONDS
    handled = 0
    while time.time() < deadline:
        d = tg("getUpdates", offset=s["offset"], timeout=25,
               allowed_updates=["message", "callback_query"])
        if not d.get("ok"):
            time.sleep(5); continue
        for up in d["result"]:
            s["offset"] = up["update_id"] + 1
            try:
                handle_update(s, up); handled += 1
            except Exception:
                log.exception("update %s failed", up["update_id"])
        if d["result"]:
            save_state(s)
    save_state(s)
    log.info("done: %d updates handled", handled)
    return 0

if __name__ == "__main__":
    sys.exit(main())
