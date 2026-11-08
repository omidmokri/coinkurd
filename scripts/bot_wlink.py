#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Site -> bot watchlist hand-off (AUTOPILOT Backlog #6, slice A).

The site keeps a trader's starred coins in localStorage['ek_watch']. A pill on the site opens
t.me/<bot>?start=w_BTC-ETH-SOL ; the bot then shows a read-only snapshot of exactly those coins from
data/market.json (the same file the site reads). Nothing is stored and nothing is posted anywhere:
the link itself is the identity. Telegram limits the start payload to 64 chars of [A-Za-z0-9_-].
"""
import json
import os
import re

SITE = "https://entekhab.net"
MAXLEN = 64
_SYM = re.compile(r"^[A-Z0-9]{2,12}$")

S = {"title": {"fa": "⭐ لیست مراقبت شما از سایت", "ckb": "⭐ لیستی چاودێریی تۆ لە ماڵپەڕ", "en": "⭐ Your watchlist from the site"},
     "none": {"fa": "هنوز داده‌ای نیست", "ckb": "هێشتا داتا نییە", "en": "no data yet"},
     "empty": {"fa": "در این پیوند نماد معتبری نبود.", "ckb": "لەم بەستەرەدا هێمای دروست نەبوو.",
               "en": "This link had no valid symbols."},
     "upd": {"fa": "به‌روزرسانی داده", "ckb": "نوێکردنەوەی داتا", "en": "Data updated"},
     "site": {"fa": "صفحهٔ هر ارز و اخبار لیست شما در سایت", "ckb": "پەڕەی هەر دراو و هەواڵی لیستەکەت لە ماڵپەڕ",
              "en": "Each coin's page and your list's news on the site"},
     "nfa": {"fa": "توصیهٔ مالی نیست.", "ckb": "ئامۆژگاریی دارایی نییە.", "en": "Not financial advice."}}


def _l(k, lang):
    return S[k].get(lang) or S[k]["fa"]


def parse(arg):
    """'w_btc-ETH-eth-x!-SOL' -> ['BTC','ETH','SOL'] (upper-cased, deduped, junk dropped, order kept)."""
    if not isinstance(arg, str) or not arg.startswith("w_") or len(arg) > MAXLEN:
        return []
    out = []
    for p in arg[2:].split("-"):
        p = p.strip().upper()
        if _SYM.match(p) and p not in out:
            out.append(p)
    return out


def _market(root):
    try:
        return json.load(open(os.path.join(root, "data", "market.json"), encoding="utf-8"))
    except Exception:
        return {}


def _price(p):
    if p >= 1000:
        return f"{p:,.0f}"
    if p >= 1:
        return f"{p:,.2f}"
    return f"{p:.6g}"


def site_link(syms):
    """Home page with ?w= — the site asks before saving the coins into this browser's watchlist."""
    return f"{SITE}/?w={','.join(syms[:20])}#newsBox"


def screen(syms, lang, market=None, root=None):
    """Return the message text (HTML) for the hand-off."""
    if market is None:
        market = _market(root or os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if not syms:
        return _l("empty", lang)
    by = {c.get("coin"): c for c in (market.get("coins") or []) if isinstance(c, dict)}
    lines = [f"<b>{_l('title', lang)}</b>", ""]
    for s in syms:
        c = by.get(s)
        if c and isinstance(c.get("price"), (int, float)):
            ch = c.get("chg24")
            chs = f" · {'🟢' if ch >= 0 else '🔴'} {ch:+.1f}%" if isinstance(ch, (int, float)) else ""
            lines.append(f'<a href="{SITE}/coins/{s.lower()}/">{s}</a>: ${_price(c["price"])}{chs}')
        else:
            lines.append(f"{s}: {_l('none', lang)}")
    if market.get("updated_at"):
        lines += ["", f"{_l('upd', lang)}: {str(market['updated_at'])[:16].replace('T', ' ')} UTC"]
    lines += [f'{_l("site", lang)}: <a href="{site_link(syms)}">{SITE}</a>', "", _l("nfa", lang)]
    return "\n".join(lines)


if __name__ == "__main__":       # self-test
    assert parse("") == [] and parse(None) == [] and parse("s_today") == []
    assert parse("w_") == []
    assert parse("w_btc-ETH-eth-x!-SOL") == ["BTC", "ETH", "SOL"]
    assert parse("w_" + "-".join(["BTC"] * 30)) == []          # > 64 chars
    assert parse("w_A-TOOLONGSYMBOL1") == []
    m = {"updated_at": "2026-11-08T09:22:20", "coins": [{"coin": "BTC", "price": 75897.82, "chg24": -0.2}]}
    t = screen(["BTC", "ZZZ"], "en", m)
    assert "$75,898" in t and "-0.2%" in t and "ZZZ: no data yet" in t and "Not financial advice" in t
    assert site_link(["BTC", "ETH"]) == "https://entekhab.net/?w=BTC,ETH#newsBox" and site_link(["BTC", "ZZZ"]) in t
    assert screen([], "ckb", m) == S["empty"]["ckb"]
    print("ok")
