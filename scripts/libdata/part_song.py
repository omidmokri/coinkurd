# -*- coding: utf-8 -*-
"""Trading songs: sound to work to, not music the channel owns.

Nothing is hosted on entekhab.net. Each entry is a description plus a link to a public
Spotify playlist, and every playlist id below was resolved against Spotify's own oembed
endpoint (open.spotify.com/oembed) on 2026-11-08 - the `title` field is the name Spotify
itself returned, not a name copied from a third-party playlist directory.

These are brainwave and frequency playlists, so `note` carries the evidence caveat wherever
the playlist's own title makes a health or performance claim. Curator names are deliberately
left out: the directories that list them are not Spotify, and they were not verified.

Entries are kept in `_DATA` below and assembled by `_s`. Until a playlist's link has been
resolved against Spotify it does not go in.
"""
import json
import os

CTA = {"fa": "شنیدن در اسپاتیفای", "ckb": "گوێگرتن لە سپۆتیفای", "en": "Listen on Spotify"}

_DATA = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                    "part_song.json"), encoding="utf-8"))


def _s(e):
    it = {"id": e["id"], "cat": "song", "title": e["title"], "lvl": "beg",
          "t": e["t"], "d": e["d"], "l": e["l"]}
    if e.get("note"):
        it["note"] = e["note"]
    it["free"] = True
    it["cta"] = CTA
    it["url"] = "https://open.spotify.com/playlist/" + e["id"]
    return it


ITEMS = [_s(e) for e in _DATA]
