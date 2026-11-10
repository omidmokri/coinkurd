#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Readable relay channel.

TradingView webhooks land in the relay channel as one machine line:

    #ESTATE kmix|BINANCE:BTCUSDT|60|73216.01|2026-11-10T16:00:00Z|dir=short|decision=Weak|...

scripts/signals.py needs that line exactly as it is, so this worker never replaces it: it edits the bot's own
post and appends a Persian card underneath (statefmt), so a reader sees words instead of a machine line.
Parsing stays safe because signals.py reads the channel line by line and stops at the first #ESTATE/#ESIG line.
"""
import logging
import os
import re
import time

import requests
from bs4 import BeautifulSoup

import bot_data as D
import statefmt as SF

log = logging.getLogger("relay")
EVERY = int(os.environ.get("RELAY_FMT_EVERY", "180"))
UA = {"User-Agent": "Mozilla/5.0 (compatible; CoinKurdBot/1.0)"}
MARK = "💬"                                   # already-rewritten posts carry the card's "what it means" line
MAXLEN = 4000


def channel():
    d = D.load("indicators") or {}
    return (os.environ.get("SIGNALS_CHANNEL") or (d.get("relay") or {}).get("channel") or "").strip().lstrip("@")


def maps():
    """esig code / id -> indicator id, and indicator id -> display name"""
    d = D.load("indicators") or {}
    codes, names = {}, {}
    for it in d.get("items", []):
        names[it["id"]] = it.get("name") or it["id"]
        codes[it["id"].lower()] = it["id"]
        if it.get("esig"):
            codes[str(it["esig"]).lower()] = it["id"]
    return codes, names


def posts(ch, pages=2):
    """newest posts of the public channel preview -> [(mid, text)]"""
    out, before = [], None
    for _ in range(pages):
        try:
            r = requests.get(f"https://t.me/s/{ch}" + (f"?before={before}" if before else ""), headers=UA, timeout=30)
            r.raise_for_status()
        except Exception as ex:
            log.info("relay read failed: %s", ex)
            break
        soup = BeautifulSoup(r.text, "html.parser")
        msgs = soup.select("div.tgme_widget_message")
        if not msgs:
            break
        ids = []
        for w in msgs:
            try:
                mid = int((w.get("data-post") or "").rsplit("/", 1)[-1])
            except ValueError:
                continue
            ids.append(mid)
            te = w.select_one(".tgme_widget_message_text")
            if not te:
                continue
            for br in te.find_all("br"):
                br.replace_with("\n")
            out.append((mid, te.get_text()))
        if not ids or min(ids) <= 1:
            break
        before = min(ids)
    return out


def card_for(text, codes, names, lang="fa"):
    """-> Persian card for the first machine line of the post, or None"""
    try:
        from signals import parse_esig, parse_estate
    except Exception as ex:                   # pragma: no cover - only if bs4/requests missing
        log.info("parser unavailable: %s", ex)
        return None
    for line in text.splitlines():
        up, line = line.upper(), line.strip()
        if "|" not in line:
            continue
        if "ESTATE" in up:
            st = parse_estate(line, codes)
            if st and (st.get("f") or {}):
                return SF.estate_card(st, lang, name=names.get(st["ind"]), head=False)
            return None
        if "ESIG" in up:
            sg = parse_esig(line, codes)
            if sg:
                return SF.esig_card(sg, lang, name=names.get(sg["ind"]))
            return None
    return None


def tick(s, tg):
    st = s.setdefault("relay_fmt", {})
    if time.time() - st.get("at", 0) < EVERY:
        return False
    st["at"] = time.time()
    ch = channel()
    if not ch:
        return False
    codes, names = maps()
    if not codes:
        return False
    done = st.setdefault("done", [])
    first = not done
    limit = 3 if first else 8                 # on the very first run only the newest posts get an answer
    replies, changed = 0, False
    for mid, text in sorted(posts(ch), reverse=True)[: 12 if first else 40]:
        if mid in done or MARK in text:
            continue
        card = card_for(text, codes, names)
        if not card:
            done.append(mid)                  # nothing to explain in this post
            continue
        raw = D.e(re.sub(r"\n{3,}", "\n\n", text.strip()))     # the machine line stays, escaped so HTML mode is safe
        r = tg("editMessageText", chat_id=f"@{ch}", message_id=mid, text=(raw + "\n\n" + card)[:MAXLEN],
               parse_mode="HTML", link_preview_options={"is_disabled": True})
        ok = r.get("ok") or "not modified" in str(r.get("description", ""))
        if not ok and replies < limit:        # a post of another bot cannot be edited: answer it instead
            replies += 1
            r = tg("sendMessage", chat_id=f"@{ch}", text=card[:MAXLEN], parse_mode="HTML",
                   reply_to_message_id=mid, link_preview_options={"is_disabled": True})
            ok = r.get("ok")
        if not ok:
            log.info("relay %s not explained: %s", mid, r.get("description"))
        changed = changed or bool(ok)
        done.append(mid)                      # never hammer the same post twice
        time.sleep(2)
    del done[:-500]
    return changed
