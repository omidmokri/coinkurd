#!/usr/bin/env python3
"""ادغام فایل‌های ترجمهٔ tests/out/batch_*.json در data/posts.json (با پاک‌سازی فوتر و هشتگ‌ها)"""
import json, re, glob, sys, os
POSTS = sys.argv[1] if len(sys.argv) > 1 else "data/posts.json"
FOOT = re.compile(r"^[\s🅲🅾️🅸🅽🅺🆄🆁🅳👾🎥📸💬]*(Discord|Youtube|YouTube|Instagram|X|[\s🅲🅾️🅸🅽🅺🆄🆁🅳👾🎥📸💬]+)?[\s]*$")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import drop_label, is_label  # noqa: E402  — a stored translation must not bring the channel's label back
def clean(t):
    t = drop_label(t)
    lines = t.split("\n")
    while lines and (FOOT.match(lines[-1]) ):
        lines.pop()
    t = "\n".join(lines)
    # هشتگ‌های پشت‌سرهم که با خط خالی/فاصله جدا شده‌اند → یک خط
    t = re.sub(r"(#\S+)(?:\n\s*\n?)+(?=#)", r"\1 ", t)
    # ایموجی تنها در یک خط + خط بعد → یک خط
    t = re.sub(r"\n([^\w\s#؀-ۿ]{1,3})\n\s*", r"\n\1 ", t)
    return re.sub(r"\n{3,}", "\n\n", t).strip()
posts = json.load(open(POSTS, encoding="utf-8"))
tr = {}
import os
if os.path.exists("data/translations.json"):
    tr.update(json.load(open("data/translations.json", encoding="utf-8")))
for f in sorted(glob.glob("tests/out/batch_*.json")):
    tr.update(json.load(open(f, encoding="utf-8")))
n = 0
for p in posts:
    t = tr.get(str(p["id"]))
    if t and not p.get("tr"):
        p["tr"] = {"engine": "claude-session",
                   "ckb": {"title": t["ckb"]["title"].strip(), "text": clean(t["ckb"]["text"])},
                   "en": {"title": t["en"]["title"].strip(), "text": clean(t["en"]["text"])}}
        n += 1
def good_title(tt, text):
    if not is_label(tt or "") and len(re.findall(r"[\w\u0600-\u06FF]", re.sub(r"\d", "", tt or ""))) >= 3:
        return tt.strip()
    for ln in (text or "").split("\n"):
        if is_label(ln):
            continue
        c = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r"\1", ln)
        c = re.sub(r"#\S+", "", c).strip(" :–-—|•\t")
        if len(re.findall(r"[\w\u0600-\u06FF]", c)) >= 3:
            return c[:117] + "…" if len(c) > 120 else c
    return tt
fixed = 0
for p in posts:
    for lg in ("ckb", "en"):
        t = (p.get("tr") or {}).get(lg)
        if t:
            nt = good_title(t.get("title"), t.get("text"))
            if nt != t.get("title"):
                t["title"], fixed = nt, fixed + 1
print(f"fixed {fixed} translated titles")
json.dump(posts, open(POSTS, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(f"merged {n}, total translated {sum(1 for p in posts if p.get('tr'))}")
