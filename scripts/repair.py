#!/usr/bin/env python3
"""ترمیم پست‌های ذخیره‌شده: حذف لینک‌های پنهان تکراری، جداکردن فوتر شبکه‌های اجتماعی و اصلاح عنوان"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import split_footer, post_title, drop_label  # noqa: E402
P = sys.argv[1] if len(sys.argv) > 1 else "data/posts.json"
# Discord invites in older posts have expired; this permanent invite of the COIN_KURD server still works (checked 2026-11-02)
DISCORD = "https://discord.gg/TtT2BHmZyJ"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEEPIMG_RE = re.compile(r"https://raw\.githubusercontent\.com/omidmokri/coinkurd/[^/]+/(data/deepimg/[\w.-]+\.(?:jpe?g|png|webp))")
DISCORD_RE = re.compile(r"https?://(?:www\.)?(?:discord\.gg|discord(?:app)?\.com/invite)/[\w-]+", re.I)
ps = json.load(open(P, encoding="utf-8"))
n = 0
for p in ps:
    t = p["text"]
    t2 = re.sub(r"(\))https?://t\.me/\+[\w-]+", r"\1", t)          # لینک پنهان بعد از لینک
    t2 = re.sub(r"(\]\(https?://[^)\s]+\))\s*(?=[^\n]*\]\()", r"\1 ", t2)
    body, footer = split_footer(t2)
    if footer or t2 != t:
        p["text"], n = body, n + 1
        if footer:
            p["footer"] = footer
    # the channel's own label is never the subject: drop it from the text, here and in every translation
    dropped = drop_label(p["text"])
    if dropped != p["text"]:
        p["text"], n = dropped, n + 1
    title = post_title(p["text"])
    if title:
        p["title"] = title
    for lg in (p.get("tr") or {}).values():
        if isinstance(lg, dict) and lg.get("text"):
            lg["text"] = drop_label(lg["text"])
            lg["title"] = post_title(lg["text"], lg.get("title") or "")
    # a dossier card is sent as a large preview of the card's own file in this repository — that file is the picture
    lk = (p.get("link") or {}).get("url") or "" if isinstance(p.get("link"), dict) else ""
    m = DEEPIMG_RE.match(lk)
    if m and os.path.exists(os.path.join(ROOT, m.group(1))):       # the real card always wins over a drawn one
        p["img"] = "/" + m.group(1)
    for f in p.get("footer") or []:
        if DISCORD_RE.fullmatch(f.get("url", "")):
            f["url"] = DISCORD
    if DISCORD_RE.search(p["text"]):
        p["text"] = DISCORD_RE.sub(DISCORD, p["text"])
    for lg in (p.get("tr") or {}).values():
        if isinstance(lg, dict) and DISCORD_RE.search(lg.get("text") or ""):
            lg["text"] = DISCORD_RE.sub(DISCORD, lg["text"])
    if isinstance(p.get("link"), dict) and DISCORD_RE.fullmatch(p["link"].get("url") or ""):
        p["link"]["url"] = DISCORD
json.dump(ps, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(f"repaired {n}; with footer {sum(1 for p in ps if p.get('footer'))}")
