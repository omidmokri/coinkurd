# -*- coding: utf-8 -*-
"""Trading songs the channel has posted.

These are other artists' recordings, so nothing is hosted on entekhab.net: each entry is a
description plus a link to the channel post where the owner published it. Fill ITEMS with one
dict per track:

    {"id":"...", "cat":"song", "title":"<the track's own name>", "by":"<artist>", "lvl":"beg",
     "t":{"fa":"...","ckb":"...","en":"..."},          # shown as the card title
     "d":{"fa":"...","ckb":"...","en":"..."},          # what the song is
     "l":{"fa":"...","ckb":"...","en":"..."},          # what a trader takes from it
     "cta":{"fa":"شنیدن در تلگرام","ckb":"گوێگرتن لە تێلێگرام","en":"Listen on Telegram"},
     "url":"https://t.me/..."}

Until a track has a verified link it does not go in.
"""
ITEMS = []
