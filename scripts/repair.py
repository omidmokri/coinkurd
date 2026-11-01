#!/usr/bin/env python3
"""ترمیم پست‌های ذخیره‌شده: حذف لینک‌های پنهان تکراری، جداکردن فوتر شبکه‌های اجتماعی و اصلاح عنوان"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import split_footer  # noqa: E402
P = sys.argv[1] if len(sys.argv) > 1 else "data/posts.json"
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
    title = ""
    for ln in p["text"].split("\n"):
        c = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r"\1", ln)
        c = re.sub(r"#\S+", "", c).strip(" :–-—|•\t")
        if len(re.findall(r"[\w؀-ۿ]", c)) >= 3:
            title = c[:117] + ("…" if len(c) > 120 else c[117:120]) if len(c) > 120 else c
            break
    if title:
        p["title"] = title
json.dump(ps, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(f"repaired {n}; with footer {sum(1 for p in ps if p.get('footer'))}")
