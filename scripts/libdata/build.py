# -*- coding: utf-8 -*-
"""Assembles data/library.json from the verified parts. Run: python3 -I scripts/libdata/build.py"""
import datetime, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import part_film, part_doc, part_book, part_bio, part_tool, part_free, part_song

CATS = [
 {"k":"film","t":{"fa":"فیلم‌های سینمایی","ckb":"فیلمە سینەماییەکان","en":"Feature films"}},
 {"k":"doc","t":{"fa":"مستندها","ckb":"دۆکیۆمێنتارییەکان","en":"Documentaries"}},
 {"k":"book","t":{"fa":"کتاب‌ها","ckb":"کتێبەکان","en":"Books"}},
 {"k":"tool","t":{"fa":"ابزارها و پلتفرم‌ها","ckb":"ئامراز و پلاتفۆرمەکان","en":"Tools & platforms"}},
 {"k":"free","t":{"fa":"آموزش رایگان","ckb":"فێرکاریی بێبەرامبەر","en":"Free learning"}},
 {"k":"bio","t":{"fa":"زندگی‌نامه‌ها","ckb":"ژیاننامەکان","en":"Lives & stories"}},
 {"k":"song","t":{"fa":"آهنگ ترید","ckb":"گۆرانیی بازرگانی","en":"Trading songs"}},
]
items = (part_film.ITEMS + part_doc.ITEMS + part_book.ITEMS
         + part_tool.ITEMS + part_free.ITEMS + part_bio.ITEMS + part_song.ITEMS)

# ---- checks: every entry must be complete and sane before it is written out
ids, errs = set(), []
cat_keys = {c["k"] for c in CATS}
LAT = re.compile(r"[A-Za-z]")
for it in items:
    i = it.get("id", "?")
    if i in ids: errs.append(f"{i}: duplicate id")
    ids.add(i)
    if it["cat"] not in cat_keys: errs.append(f"{i}: unknown category {it['cat']}")
    for f in ("t", "d", "l"):
        if set(it.get(f, {})) != {"fa", "ckb", "en"}: errs.append(f"{i}: {f} is not in three languages")
        for lg, v in it.get(f, {}).items():
            if not v.strip(): errs.append(f"{i}: {f}.{lg} is empty")
    if "note" in it and set(it["note"]) != {"fa", "ckb", "en"}: errs.append(f"{i}: note is not in three languages")
    if "cta" in it and set(it["cta"]) != {"fa", "ckb", "en"}: errs.append(f"{i}: cta is not in three languages")
    if it.get("lvl") not in ("beg", "mid", "adv"): errs.append(f"{i}: bad level {it.get('lvl')}")
    u = it.get("url", "")
    if u and not u.startswith("https://"): errs.append(f"{i}: url is not https")
    if it.get("year") and not (1900 <= it["year"] <= 2026): errs.append(f"{i}: implausible year")
    # Persian and Sorani text must not carry Arabic ya/kaf, which the site's own checks forbid
    for f in ("t", "d", "l", "note"):
        for lg in ("fa", "ckb"):
            v = (it.get(f) or {}).get(lg, "")
            if "ي" in v or "ك" in v: errs.append(f"{i}: {f}.{lg} has an Arabic ya/kaf")
            if lg == "fa" and re.search(r"[٠-٩]", v): errs.append(f"{i}: {f}.fa has Arabic-Indic digits")
            if lg == "ckb" and re.search(r"[۰-۹]", v): errs.append(f"{i}: {f}.ckb has Persian digits")
if errs:
    print("PROBLEMS:"); [print(" -", e) for e in errs]; sys.exit(1)

out = {"updated_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
       "source": "entekhab.net — every entry checked against the linked source",
       "cats": CATS, "items": items}
open("data/library.json", "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
by = {c["k"]: sum(1 for i in items if i["cat"] == c["k"]) for c in CATS}
print("library:", len(items), "entries ·", " · ".join(f"{k} {v}" for k, v in by.items()),
      "· with a link:", sum(1 for i in items if i.get("url")))
