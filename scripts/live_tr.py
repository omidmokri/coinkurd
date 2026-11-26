#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The homepage's live English (news headlines, the market brain's AI report) in the languages the globe offers.

Why: assets/i18n.js translates the page from dictionaries of the site's own strings, but a headline or the AI report
changes every few minutes and is never in them, so a reader who picked Hindi or German saw them in English.

What it does, each data run (update.yml), with Google's free web endpoint (scripts/i18n_gt.py, no Gemini calls):
  - the newest channel posts' English titles (posts_week.json tr.en) and the newest headlines of the "Global crypto" and "World markets" tabs -> data/live_tr/<code>.json {"news": {id: title}, "posts": {id: title}}
    (a file per language, fetched only by a reader in that language, so news.json stays the size it was)
  - the AI report's English headline and bullets -> data/brain.json report[<code>] (read where report[lang] is read)
Each string is translated once (data/live_tr/_cache.json); only what is still shown is kept. A run stops at Google's
first "too many requests" and keeps what it has; the next run goes on.

The languages are the ones the live globe offers (https://entekhab.net/i18n/langs.json), else LIVE below.

CLI:  python3 scripts/live_tr.py [--max-requests 80]
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i18n_gt as G  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUTDIR = os.path.join(DATA, "live_tr")
CACHE = os.path.join(OUTDIR, "_cache.json")
LIVE = ["kmr", "cn", "nl", "fr", "de", "hi", "it", "pt", "br", "ru", "es", "tr", "vi"]   # the globe on 2026-11-26
OWN = {"fa", "ckb", "en", "ar"}
N_NEWS, N_WORLD, N_POSTS = 40, 20, 16


def load(p, d):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return d


def dump(p, obj):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def langs():
    try:
        import requests
        r = requests.get("https://entekhab.net/i18n/langs.json", timeout=15)
        got = [x["code"] for x in (r.json().get("ready") or []) if x.get("code") and x["code"] not in OWN]
        if got:
            return got
    except Exception as e:  # noqa: BLE001
        print("langs.json unreadable, using the fixed list:", str(e)[:100])
    return list(LIVE)


def report_lines(rep):
    """the English report as the homepage shows it: the headline, then one line per bullet"""
    body = [ln.strip().lstrip("•-* ").strip() for ln in (rep.get("body") or "").split("\n")]
    return [(rep.get("headline") or "").strip()] + [b for b in body if b]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-requests", type=int, default=int(os.environ.get("LIVE_TR_MAX", "80")))
    a = ap.parse_args()

    news = load(os.path.join(DATA, "news.json"), {})
    brain_p = os.path.join(DATA, "brain.json")
    brain = load(brain_p, {})
    items = (news.get("items") or [])[:N_NEWS] + ((news.get("world") or {}).get("items") or [])[:N_WORLD]
    items = [i for i in items if i.get("id") and i.get("title")]
    posts = [p for p in load(os.path.join(DATA, "posts_week.json"), []) if isinstance(p, dict) and p.get("id")
             and p.get("q") != "low" and ((p.get("tr") or {}).get("en") or {}).get("title")][:N_POSTS]
    ptitle = {p["id"]: p["tr"]["en"]["title"].strip() for p in posts}
    narr = load(os.path.join(DATA, "narratives.json"), {})
    heads = list(dict.fromkeys((h.get("title") or "").strip() for n in (narr.get("narratives") or [])[:10]
                               for h in (n.get("headlines") or [])[:2] if (h.get("title") or "").strip()))
    rep_en = ((brain.get("report") or {}).get("en")) or {}
    rlines = report_lines(rep_en) if rep_en.get("headline") else []
    want = list(dict.fromkeys(rlines + list(ptitle.values()) + [i["title"].strip() for i in items] + heads))

    codes = langs()
    cache = load(CACHE, {})
    pace = G.Pace(G.RATE)
    make = G.gtx_factory(pace)
    used = [0]
    stopped = False

    def counted(fn):
        def tr(text):
            if used[0] >= a.max_requests:
                raise RuntimeError("request budget spent")
            used[0] += 1
            return fn(text)
        return tr

    # the report first, then the channel's posts, then headlines, a language at a time
    for code in codes:
        c = cache.setdefault(code, {})
        todo = [k for k in want if k not in c]
        if stopped or not todo:
            continue
        tr_fn = counted(make(code))
        for chunk in G.chunks(todo):
            try:
                c.update(G.translate_chunk(code, chunk, tr_fn))
            except Exception as e:  # noqa: BLE001
                print(f"{code}: stopped ({str(e)[:80]})")
                stopped = True
                break

    # keep only what is still shown
    keep = set(want)
    cache = {code: {k: v for k, v in m.items() if k in keep} for code, m in cache.items() if code in codes}
    dump(CACHE, cache)

    for code in codes:
        c = cache.get(code, {})
        dump(os.path.join(OUTDIR, code + ".json"),
             {"news": {i["id"]: c[i["title"].strip()] for i in items if i["title"].strip() in c},
              "posts": {pid: c[t] for pid, t in ptitle.items() if t in c},
              "heads": {t: c[t] for t in heads if t in c},
              "at": news.get("updated_at")})
    for f in os.listdir(OUTDIR):                     # a language the globe no longer offers
        if f.endswith(".json") and not f.startswith("_") and f[:-5] not in codes:
            os.remove(os.path.join(OUTDIR, f))

    if rlines and brain.get("report"):
        rep = brain["report"]
        for k in [k for k in rep if k not in ("fa", "ckb", "en")]:
            del rep[k]
        n = 0
        for code in codes:
            c = cache.get(code, {})
            if all(ln in c for ln in rlines):         # whole or not at all: never half English
                rep[code] = {"headline": c[rlines[0]], "body": "\n".join("• " + c[ln] for ln in rlines[1:])}
                n += 1
        dump(brain_p, brain)
        print(f"AI report in {n}/{len(codes)} languages")
    print(f"live_tr: {len(codes)} languages, {len(want)} strings, {used[0]} requests"
          + (" (stopped early)" if stopped else ""))


if __name__ == "__main__":
    main()
