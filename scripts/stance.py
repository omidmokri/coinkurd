#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Directional study, slice 1: label each channel post's market stance with Gemini (CI only).

For every post in data/posts.json not yet labelled, ask the model for
  stance: "bullish" | "bearish" | "neutral"   (what the post implies for the coin's price)
  coin:   ticker the stance is about (default BTC)
  quote:  the exact phrase from the post that carries the stance
A label is kept ONLY if the quote appears verbatim in the post text (after whitespace/ZWNJ
normalisation) — that is the evidence, and it rejects hallucinated reasons. Rejected or failed
posts are retried on later runs (up to MAX_TRIES). No page reads this yet: hit rates will be
published only once >= 100 posts are labelled, against base rates (see AUTOPILOT.md Backlog #5).

Output: data/stance.json  {"labels": {id: {...}}, "tries": {id: n}, "model": str, "updated": iso}
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "stance.json")
POSTS = os.path.join(ROOT, "data", "posts.json")
STANCES = ("bullish", "bearish", "neutral")
BATCH = 8
MAX_TRIES = 3
TEXT_CAP = 1800


def norm(s):
    s = (s or "").replace("‌", "").replace("‏", "").replace("‎", "")
    s = s.replace("ي", "ی").replace("ك", "ک")
    return re.sub(r"\s+", " ", s).strip().lower()


GREET = ("با سلام", "سلام", "درود", "صبح بخیر", "صبحتون بخیر", "روز بخیر", "شب بخیر", "عصر بخیر",
         "سڵاو", "بەیانی باش", "ڕۆژ باش", "شەو باش", "hello", "hi ", "good morning")


def greeting_line(text):
    """Normalised first non-empty line if it is a greeting, else ''. Pure; unit-tested."""
    for ln in (text or "").splitlines():
        n = norm(ln)
        if n:
            return n if any(n.startswith(norm(g)) for g in GREET) else ""
    return ""


def weak_quote(quote, text):
    """True when the quote sits only inside the greeting line: no evidence of a direction."""
    g, q = greeting_line(text), norm(quote)
    if not g or q not in g:
        return False
    lines = (text or "").splitlines()
    first = next(i for i, ln in enumerate(lines) if norm(ln))
    rest = norm("\n".join(lines[first + 1:]))
    return q not in rest


def validate(item, posts_by_id):
    """Return a clean label dict or None. Pure; unit-tested."""
    try:
        pid = str(int(item.get("id")))
    except Exception:  # noqa: BLE001
        return None
    p = posts_by_id.get(pid)
    if not p:
        return None
    st = str(item.get("stance", "")).strip().lower()
    if st not in STANCES:
        return None
    q = str(item.get("quote", "")).strip()
    if len(norm(q)) < 6 or norm(q) not in norm(p.get("text", "")):
        return None
    if st != "neutral" and weak_quote(q, p.get("text", "")):
        return None
    coin = re.sub(r"[^A-Z0-9]", "", str(item.get("coin") or "BTC").upper())[:10] or "BTC"
    return {"stance": st, "coin": coin, "quote": q[:300], "date": p.get("date")}


def todo(posts, state, limit):
    lab, tries = state["labels"], state["tries"]
    out = []
    for p in sorted(posts, key=lambda x: x.get("date") or "", reverse=True):
        pid = str(p.get("id"))
        if pid in lab or tries.get(pid, 0) >= MAX_TRIES or len((p.get("text") or "").strip()) < 40:
            continue
        out.append(p)
        if len(out) >= limit:
            break
    return out


PROMPT = """You label posts of a Persian/Kurdish crypto Telegram channel.
For each post decide what it implies for the price of the main coin it discusses:
"bullish" (expects/argues price up), "bearish" (expects/argues price down), or
"neutral" (pure news, education, mixed, or no direction). Be strict: reporting a fact is neutral
unless the post itself draws a direction. "coin" = ticker (BTC if general market).
"quote" = a SHORT phrase copied EXACTLY, character for character, from the post that shows the stance
(for neutral, copy the headline phrase). Do not translate or paraphrase the quote.
Never quote the greeting line (e.g. "با سلام ..."): quote the sentence that carries the direction.
Return a JSON array: [{{"id": <id>, "stance": "...", "coin": "...", "quote": "..."}}]

POSTS:
{posts}"""


def load_state():
    try:
        s = json.load(open(OUT, encoding="utf-8"))
        s.setdefault("labels", {}); s.setdefault("tries", {})
        return s
    except Exception:  # noqa: BLE001
        return {"labels": {}, "tries": {}}


def drop_weak(state, by_id):
    """Remove directional labels whose only evidence is the greeting line, so they get relabelled."""
    bad = [pid for pid, l in state["labels"].items() if l.get("stance") != "neutral" and pid in by_id
           and weak_quote(l.get("quote", ""), by_id[pid].get("text", ""))]
    for pid in bad:
        state["labels"].pop(pid); state["tries"].pop(pid, None)
    return bad


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 48
    sys.path.insert(0, HERE)
    import ai
    if not ai.available():
        print("stance: no Gemini key; skipped"); return
    posts = json.load(open(POSTS, encoding="utf-8"))
    by_id = {str(p.get("id")): p for p in posts}
    state = load_state()
    dropped = drop_weak(state, by_id)
    if dropped:
        print(f"stance: dropped {len(dropped)} greeting-only labels for relabelling")
    work = todo(posts, state, limit)
    kept = 0
    t_end = time.time() + 240
    for i in range(0, len(work), BATCH):
        if time.time() > t_end:
            break
        chunk = work[i:i + BATCH]
        body = "\n\n".join(f"### id={p['id']}\n{(p.get('text') or '')[:TEXT_CAP]}" for p in chunk)
        try:
            res = ai.generate(PROMPT.format(posts=body), as_json=True, temperature=0.0)
        except Exception as e:  # noqa: BLE001
            print(f"stance: batch failed: {e}")
            if type(e).__name__ == "QuotaError":
                break
            continue
        got = {}
        for it in res if isinstance(res, list) else []:
            if isinstance(it, dict):
                v = validate(it, by_id)
                if v:
                    got[str(int(it["id"]))] = v
        for p in chunk:
            pid = str(p["id"])
            if pid in got:
                state["labels"][pid] = got[pid]; kept += 1
                state["tries"].pop(pid, None)
            else:
                state["tries"][pid] = state["tries"].get(pid, 0) + 1
    state["model"] = ai.model()
    state["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    c = {s: sum(1 for v in state["labels"].values() if v["stance"] == s) for s in STANCES}
    state["counts"] = c
    tmp = OUT + ".tmp"
    json.dump(state, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    os.replace(tmp, OUT)
    print(f"stance: asked {len(work)}, kept {kept}, total {len(state['labels'])} {c}")


if __name__ == "__main__":
    main()
