#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""The channel's own stickers, custom emoji and GIFs — made once, by the bot, owned by the owner.

The artwork is in assets/packs/ (drawn by scripts/packart.py): 512 px video stickers and 100 px custom emoji,
both VP9 with a transparent background, under two seconds and well under Telegram's 256 KB, plus a few short
mp4s for the channel's saved GIFs.

Telegram lets a bot create a set that belongs to a user (createNewStickerSet takes the owner's user_id), so the
owner does nothing at all: the packs appear under his own account and the set name ends in _by_<bot>, as the API
requires. Anyone can send a sticker or a GIF; sending a custom emoji is a Telegram Premium feature, which is why
the emoji pack is the extra rather than the main thing.

Run once; the state remembers it. /packs from an admin makes it run again (new drawings are added to the same set).
"""
import json
import logging
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKS = os.path.join(ROOT, "assets", "packs")
log = logging.getLogger("packs")

TITLE = "Coin Kurd"
TITLE_E = "Coin Kurd Emoji"
MAX_NEW = 50                      # createNewStickerSet takes at most 50 at once


def files(kind):
    d = os.path.join(PACKS, kind)
    return sorted(os.path.join(d, f) for f in os.listdir(d)) if os.path.isdir(d) else []


def emoji_map():
    try:
        return json.load(open(os.path.join(PACKS, "emoji.json"), encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}


def _name(stem, bot):
    return f"{stem}_by_{bot}"


def _stickers(paths, emo):
    """-> (the stickers field, the files to upload beside it)"""
    out, up = [], {}
    for i, p in enumerate(paths):
        key = f"s{i}"
        up[key] = (os.path.basename(p), open(p, "rb"), "video/webm")
        out.append({"sticker": f"attach://{key}", "format": "video",
                    "emoji_list": [emo.get(os.path.basename(p).rsplit(".", 1)[0], "🪙")]})
    return out, up


def make(post_fn, owner, bot, kind, stem, title, sticker_type):
    """create the set, or add to it if it is already there; -> the set's name or None"""
    paths, emo = files(kind), emoji_map()
    if not paths:
        log.warning("no artwork in assets/packs/%s", kind)
        return None
    name = _name(stem, bot)
    got = post_fn("getStickerSet", {"name": name})
    have = {s.get("emoji") for s in (got.get("result") or {}).get("stickers", [])} if got.get("ok") else None
    if have is None:                                   # not there yet: create it with the first batch
        first, rest = paths[:MAX_NEW], paths[MAX_NEW:]
        st, up = _stickers(first, emo)
        r = post_fn("createNewStickerSet",
                    {"user_id": owner, "name": name, "title": title,
                     "sticker_type": sticker_type, "stickers": json.dumps(st)}, files=up)
        if not r.get("ok"):
            log.warning("pack %s not created: %s", name, r.get("description"))
            return None
        log.info("pack %s created with %s", name, len(first))
    else:
        rest = [p for p in paths if emo.get(os.path.basename(p).rsplit(".", 1)[0]) not in have]
    for p in rest:                                     # the rest one at a time, as the API wants
        st, up = _stickers([p], emo)
        r = post_fn("addStickerToSet", {"user_id": owner, "name": name, "sticker": json.dumps(st[0])}, files=up)
        if not r.get("ok"):
            log.info("sticker %s not added: %s", os.path.basename(p), r.get("description"))
    return name


def run(post_fn, send_fn, owner, bot):
    """both packs and the GIFs; -> a short line for the owner"""
    lines = []
    for kind, stem, title, kinda in (("stickers", "coinkurd", TITLE, "regular"),
                                     ("emoji", "coinkurd_emoji", TITLE_E, "custom_emoji")):
        n = make(post_fn, owner, bot, kind, stem, title, kinda)
        if n:
            lines.append(f"https://t.me/addstickers/{n}" if kinda == "regular" else f"https://t.me/addemoji/{n}")
    for p in files("gifs"):                            # saved GIFs are not a pack: they are sent, then kept
        with open(p, "rb") as f:
            post_fn("sendAnimation", {"chat_id": owner}, files={"animation": (os.path.basename(p), f, "video/mp4")})
    if lines and send_fn:
        send_fn(owner, "🎨 بسته‌های کوین کورد آماده شد:\n" + "\n".join(lines)
                       + "\n\nگیف‌ها را هم همین‌جا فرستادم؛ روی هرکدام «ذخیره» بزنی، در بخش گیف‌های خودت می‌ماند.")
    return lines
