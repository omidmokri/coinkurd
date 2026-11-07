# -*- coding: utf-8 -*-
"""Facts about the nightly Coin Kurd class, taken ONLY from the channel's own posts (data/posts.json).

Nothing here is typed in by hand: the invite link is the one the newest class announcement uses, the schedule line is
quoted from that announcement, and "mentions" are posts where the founder refers back to the class. If the archive
holds no announcement, every field is empty and the pages say "no data yet".
"""
import re

INVITE = re.compile(r"https?://discord\.gg/[A-Za-z0-9]+")
ANNOUNCE = re.compile(r"دیسکورد\s*کوین\s*کورد")
SCHED = re.compile(r"[^.\n:]*هر شب[^.\n:]*")
MENTION = re.compile(r"(?:در|توی|تو)\s+کلاس|کلاس\s+(?:امشب|دیشب|زنده)")


def facts(posts):
    ann = [p for p in posts or [] if INVITE.search(p.get("text") or "") and ANNOUNCE.search(p.get("text") or "")]
    ann.sort(key=lambda p: p.get("date") or "", reverse=True)
    out = {"invite": "", "schedule": "", "source": None, "n_announce": len(ann), "first": None, "mentions": []}
    if ann:
        top = ann[0]
        t = top.get("text") or ""
        out["invite"] = INVITE.findall(t)[-1]
        m = SCHED.search(t)
        if m:
            out["schedule"] = re.sub(r"[^\w\s:‌،]", "", m.group(0)).strip()
        out["source"] = {"id": top.get("id"), "url": top.get("url"), "date": top.get("date")}
        out["first"] = min((p.get("date") or "") for p in ann) or None
    men = [p for p in posts or [] if MENTION.search(p.get("text") or "") and p not in ann]
    men.sort(key=lambda p: p.get("date") or "", reverse=True)
    out["mentions"] = [{"id": p.get("id"), "url": p.get("url"), "date": p.get("date"), "title": (p.get("title") or "")[:120]}
                       for p in men]
    return out
