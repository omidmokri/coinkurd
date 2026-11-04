#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
اعتبارسنجی محتوای آکادمی:  python scripts/academy_check.py   (خروج با کد ۱ در صورت خطا)

ساختار هر فایل scripts/academy_content/f<n>.py:

COURSES = [{"id": "c1", "title": "عنوان فارسی دوره", "en": "English title"}, ...]
LESSONS = [{
    "id": "f1-c1-l1",            # f<faculty>-c<course>-l<n>، یکتا در کل آکادمی
    "course": "c1",
    "title": "عنوان فارسی", "en": "English title",
    "level": 1,                  # ۱ تا ۶ (Beginner … Expert)
    "minutes": 15,               # زمان تقریبی مطالعه
    "prereq": [],                # شناسهٔ درس‌های پیش‌نیاز
    "goal": "هدف آموزشی در یک جمله",
    "beginner": [پاراگراف‌ها],     # توضیح ساده
    "intermediate": [پاراگراف‌ها], # توضیح متوسط
    "expert": [پاراگراف‌ها],       # توضیح تخصصی
    "example": {"title": "...", "body": [پاراگراف‌ها]},   # مثال واقعی و قابل بررسی (با تاریخ)
    "terms": [{"fa": "...", "en": "...", "def": "...", "ex": "..."}],
    "key": [نکات کلیدی], "mistakes": [اشتباهات رایج],
    "exercise": {"title": "...", "steps": [...], "check": "معیار درستی", "tool": "" یا "/academy/lab/#..."},
    "quiz": [{"q": "...", "o": [۳ یا ۴ گزینه], "a": اندیس پاسخ درست, "why": "توضیح",
              "sec": "beginner|intermediate|expert|example|key|mistakes", "kind": "mcq|scenario|calc"}],  # دست‌کم ۸ سؤال
    "essay": {"q": "سؤال تشریحی", "rubric": [نکاتی که پاسخ خوب باید داشته باشد]},
    "sources": [{"t": "نام منبع", "u": "https://..."}],
    "mastery": "معیار تسلط",
}]
PROJECT = {"title": "...", "brief": "...", "deliverables": [...], "rubric": [...], "tool": ""}
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import academy_data as AD  # noqa: E402

SECS = {"beginner", "intermediate", "expert", "example", "key", "mistakes"}
KINDS = {"mcq", "scenario", "calc"}
FA = re.compile(r"[؀-ۿ]")


def check():
    errs, ids, n_l, n_q = [], set(), 0, 0
    content = AD.load_content()
    for fid, m in content.items():
        def err(msg, where=fid):
            errs.append(f"{where}: {msg}")
        courses = {c["id"] for c in getattr(m, "COURSES", [])}
        if not courses:
            err("COURSES is empty")
        pj = getattr(m, "PROJECT", None)
        if not pj or not all(pj.get(k) for k in ("title", "brief", "deliverables", "rubric")):
            err("PROJECT incomplete")
        for L in getattr(m, "LESSONS", []):
            lid = L.get("id", "?")
            w = f"{fid}/{lid}"
            n_l += 1
            if not re.fullmatch(rf"{fid}-c\d+-l\d+", lid):
                err("bad id", w)
            if lid in ids:
                err("duplicate id", w)
            ids.add(lid)
            if L.get("course") not in courses:
                err("unknown course", w)
            for k in ("title", "en", "goal", "mastery"):
                if not isinstance(L.get(k), str) or not L[k].strip():
                    err(f"missing {k}", w)
            if not FA.search(L.get("title", "")):
                err("title not Persian", w)
            if L.get("level") not in range(1, 7):
                err("level out of range", w)
            if not isinstance(L.get("minutes"), int) or not 5 <= L["minutes"] <= 90:
                err("minutes", w)
            for k, mn in (("beginner", 2), ("intermediate", 2), ("expert", 2), ("key", 4), ("mistakes", 3), ("terms", 3), ("sources", 1)):
                if not isinstance(L.get(k), list) or len(L[k]) < mn:
                    err(f"{k} needs >= {mn}", w)
            words = sum(len(p.split()) for k in ("beginner", "intermediate", "expert") for p in L.get(k, []))
            if words < 450:
                err(f"explanations too short ({words} words, need >= 450)", w)
            ex = L.get("example") or {}
            if not ex.get("title") or not ex.get("body"):
                err("example incomplete", w)
            for t in L.get("terms", []):
                if not all(t.get(k) for k in ("fa", "en", "def", "ex")):
                    err(f"term incomplete: {t}", w)
            exr = L.get("exercise") or {}
            if not exr.get("title") or len(exr.get("steps", [])) < 2 or not exr.get("check"):
                err("exercise incomplete", w)
            if exr.get("tool") and not exr["tool"].startswith("/"):
                err("exercise tool must be site-relative", w)
            q = L.get("quiz", [])
            if len(q) < 8:
                err(f"quiz needs >= 8 questions ({len(q)})", w)
            for i, x in enumerate(q):
                n_q += 1
                o = x.get("o", [])
                if not x.get("q") or not 3 <= len(o) <= 4 or len(set(o)) != len(o):
                    err(f"q{i + 1} options", w)
                if not isinstance(x.get("a"), int) or not 0 <= x["a"] < len(o):
                    err(f"q{i + 1} answer index", w)
                if not x.get("why"):
                    err(f"q{i + 1} why", w)
                if x.get("sec") not in SECS:
                    err(f"q{i + 1} sec", w)
                if x.get("kind") not in KINDS:
                    err(f"q{i + 1} kind", w)
            if len({x.get("a") for x in q}) < 2:
                err("all answers share one position — vary the correct option", w)
            es = L.get("essay") or {}
            if not es.get("q") or len(es.get("rubric", [])) < 3:
                err("essay incomplete", w)
            for s in L.get("sources", []):
                if not s.get("t") or not str(s.get("u", "")).startswith("https://"):
                    err(f"source {s}", w)
            blob = repr(L)
            if re.search(r"TODO|lorem|XXX", blob, re.I):
                err("placeholder text", w)
        for L in getattr(m, "LESSONS", []):
            for p in L.get("prereq", []):
                if p not in ids and not any(p == x.get("id") for mm in content.values() for x in mm.LESSONS):
                    err(f"unknown prereq {p}", L.get("id"))
    return errs, n_l, n_q


if __name__ == "__main__":
    errs, n_l, n_q = check()
    for x in errs:
        print("✗", x)
    print(f"{n_l} lessons, {n_q} questions, {len(errs)} problems")
    sys.exit(1 if errs else 0)
