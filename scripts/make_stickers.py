"""Publish the Coin_Kurd animated sticker packs to Telegram.

The sticker files live in assets/stickers/ with assets/stickers/index.json giving each one its
emoji.  A bot can only create a set that belongs to a real user, so the set is created for the
first id in ADMIN_IDS and its short name must end in _by_<bot username> -- that suffix is
Telegram's rule, not a choice.

Run it from the Stickers workflow.  It is safe to run again: a set that already exists is topped
up with whatever is missing instead of being rebuilt.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("STICKER_DIR") or os.path.join(ROOT, "assets", "stickers", "build")
TOKEN = os.environ.get("REF_BOT_TOKEN") or os.environ.get("TG_BOT_TOKEN") or ""
OWNER = next((int(x) for x in os.environ.get("ADMIN_IDS", "").split(",") if x.strip().lstrip("-").isdigit()), 0)
PER_SET = 120                                  # Telegram's ceiling for one pack
FIRST = 50                                     # how many may ride along with the create call
TITLES = ["کوین کورد | Coin Kurd", "کوین کورد ۲ | Coin Kurd 2"]
API = "https://api.telegram.org/bot%s/" % TOKEN


def call(method, fields=None, files=None, tries=4):
    """Call the Bot API. JSON when there is nothing to upload, multipart when there is.
    Every failure comes back with a description, so a bad call is never a silent one."""
    fields = fields or {}
    for attempt in range(tries):
        if files:
            boundary = "----ck%d" % time.time_ns()
            body = b""
            for k, v in fields.items():
                body += ("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n"
                         % (boundary, k, v)).encode()
            for k, (name, blob) in files.items():
                body += ("--%s\r\nContent-Disposition: form-data; name=\"%s\"; filename=\"%s\"\r\n"
                         "Content-Type: video/webm\r\n\r\n" % (boundary, k, name)).encode()
                body += blob + b"\r\n"
            body += ("--%s--\r\n" % boundary).encode()
            ctype = "multipart/form-data; boundary=" + boundary
        else:
            body = json.dumps(fields).encode()
            ctype = "application/json"
        req = urllib.request.Request(API + method, data=body, headers={"Content-Type": ctype})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except urllib.error.HTTPError as ex:
            raw = ex.read().decode("utf-8", "replace").strip()
            try:
                data = json.loads(raw)
                if not data.get("description"):
                    data["description"] = "HTTP %d, body %s" % (ex.code, raw[:200] or "(empty)")
            except Exception:
                data = {"ok": False, "description": "HTTP %d, body %s" % (ex.code, raw[:200] or "(empty)")}
            if ex.code == 429 and attempt < tries - 1:
                time.sleep(int((data.get("parameters") or {}).get("retry_after") or 5) + 1)
                continue
            return data
        except Exception as ex:                 # a dropped connection should not cost the run
            if attempt < tries - 1:
                time.sleep(4)
                continue
            return {"ok": False, "description": "network: %r" % (ex,)}


def existing(name):
    r = call("getStickerSet", {"name": name})
    return r.get("result") if r.get("ok") else None


def main():
    if not TOKEN or not OWNER:
        print("missing REF_BOT_TOKEN/TG_BOT_TOKEN or ADMIN_IDS", file=sys.stderr)
        return 1
    print("token length %d, owner %d" % (len(TOKEN), OWNER))
    me = call("getMe")
    if not me.get("ok"):
        print("getMe failed: %s" % (me.get("description") or me), file=sys.stderr)
        return 1
    user = me["result"]["username"]
    items = json.load(open(os.path.join(SRC, "index.json"), encoding="utf-8"))
    print("%d stickers, bot @%s, owner %d" % (len(items), user, OWNER))

    links, failed = [], []
    for s in range(0, len(items), PER_SET):
        chunk = items[s:s + PER_SET]
        n = s // PER_SET
        name = ("CoinKurd_%d_by_%s" % (n + 1, user))[:64]
        title = TITLES[n] if n < len(TITLES) else "کوین کورد %d" % (n + 1)
        have = existing(name)
        done = len(have["stickers"]) if have else 0
        if done >= len(chunk):
            print("%s already holds %d" % (name, done))
            links.append("https://t.me/addstickers/" + name)
            continue
        if not have:
            head = chunk[:FIRST]
            files, meta = {}, []
            for i, it in enumerate(head):
                key = "f%d" % i
                files[key] = (it["file"], open(os.path.join(SRC, it["file"]), "rb").read())
                meta.append({"sticker": "attach://" + key, "format": "video", "emoji_list": [it["emoji"]]})
            r = call("createNewStickerSet", {"user_id": str(OWNER), "name": name, "title": title,
                                             "stickers": json.dumps(meta)}, files)
            if not r.get("ok"):
                print("create %s failed: %s" % (name, r.get("description")), file=sys.stderr)
                failed.append(name)
                continue
            done = len(head)
            print("created %s with %d" % (name, done))
        for it in chunk[done:]:
            blob = open(os.path.join(SRC, it["file"]), "rb").read()
            r = call("addStickerToSet", {"user_id": str(OWNER), "name": name,
                                         "sticker": json.dumps({"sticker": "attach://f", "format": "video",
                                                                "emoji_list": [it["emoji"]]})},
                     {"f": (it["file"], blob)})
            if not r.get("ok"):
                print("add %s -> %s failed: %s" % (it["file"], name, r.get("description")), file=sys.stderr)
                failed.append(it["file"])
            time.sleep(1.2)                     # stay well inside the per-bot rate limit
        links.append("https://t.me/addstickers/" + name)
        print("%s done" % name)

    note = "🎨 بسته‌های استیکر متحرک کوین کورد آماده شد:\n\n" + "\n".join(links)
    if failed:
        note += "\n\n⚠️ %d مورد ناموفق: %s" % (len(failed), ", ".join(failed[:8]))
    call("sendMessage", {"chat_id": str(OWNER), "text": note, "disable_web_page_preview": "true"})
    print(note)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
