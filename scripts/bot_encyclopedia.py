# -*- coding: utf-8 -*-
"""دانشنامه در ربات — the same 506 entries the site publishes, searchable from Telegram.

The search index is built once from encyclopedia/index.json and the one-line definition each
term page already carries, so the bot can never define a word differently from the site.
"""
import io
import json
import logging
import os
import re

log = logging.getLogger("enc")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://entekhab.net"
LANGS = ("fa", "ckb", "en")
_IDX = None

_AR = {"ي": "ی", "ك": "ک", "ۀ": "ه", "ة": "ه", "أ": "ا", "إ": "ا", "آ": "ا", "ؤ": "و", "ئ": "ی"}
_DIA = re.compile(r"[ً-ْٰ‌‏‎]")


def norm(s):
    """one spelling for search — Arabic/Persian letter pairs, diacritics and ZWNJ folded away"""
    s = (s or "").strip().lower()
    for a, b in _AR.items():
        s = s.replace(a, b)
    return _DIA.sub("", s)


def _desc(tid, lang):
    p = os.path.join(ROOT, "encyclopedia", "t", lang, tid + ".html")
    try:
        h = io.open(p, encoding="utf-8").read(4000)
    except OSError:
        return ""
    m = re.search(r'<meta name="description" content="([^"]+)"', h)
    return (m.group(1).strip() if m else "")


def build():
    """the search index: id, titles, folded keywords and the published one-liner per language"""
    p = os.path.join(ROOT, "encyclopedia", "index.json")
    try:
        terms = json.load(io.open(p, encoding="utf-8"))
    except Exception as ex:
        log.warning("encyclopedia index unreadable: %s", ex)
        return []
    out = []
    for t in terms:
        tid = t.get("i")
        if not tid:
            continue
        title = t.get("t") or {}
        keys = sorted({norm(k) for k in (t.get("k") or []) if k} |
                      {norm(v) for v in title.values() if v} | {norm(tid.replace("-", " "))})
        out.append({"i": tid, "t": {lg: title.get(lg) or title.get("en") or tid for lg in LANGS},
                    "d": {lg: _desc(tid, lg) for lg in LANGS}, "k": keys})
    return out


def index():
    global _IDX
    if _IDX is None:
        _IDX = build()
    return _IDX


def search(q, lang="fa", limit=8):
    """exact key first, then prefix, then contains — so a whole word never loses to a substring"""
    n = norm(q)
    if len(n) < 2:
        return []
    sp = n.replace(" ", "")                  # "مدل حساب محور" and "مدل حساب‌محور" are the same word
    exact, pref, part = [], [], []
    for t in index():
        keys = t["k"]
        if n in keys or sp in [k.replace(" ", "") for k in keys]:
            exact.append(t)
        elif any(k.startswith(n) for k in keys):
            pref.append(t)
        elif any(n in k for k in keys) or n in norm(t["d"].get(lang) or ""):
            part.append(t)
    return (exact + pref + part)[:limit]


def url(tid, lang):
    return f"{SITE}/encyclopedia/t/{lang if lang in LANGS else 'fa'}/{tid}.html"


def card(tid, lang="fa"):
    """one term, as the site states it — never a definition of the bot's own"""
    lg = lang if lang in LANGS else "fa"
    t = next((x for x in index() if x["i"] == tid), None)
    if not t:
        return None
    d = t["d"].get(lg) or t["d"].get("fa") or ""
    return f"<b>📖 {t['t'][lg]}</b>\n\n{d}\n\n🔗 {url(tid, lg)}"


ASK = {"fa": "📖 واژه‌ای را بنویس تا در دانشنامه بگردم — فارسی، کردی یا انگلیسی.",
       "ckb": "📖 وشەیەک بنووسە تا لە زانستنامە بگەڕێم — فارسی، کوردی یان ئینگلیزی.",
       "en": "📖 Type a word and I will look it up in the encyclopedia — Persian, Kurdish or English."}
NONE = {"fa": "چیزی با این واژه پیدا نشد. املای دیگری را امتحان کن یا واژهٔ انگلیسی‌اش را بنویس.",
        "ckb": "هیچ نەدۆزرایەوە. ڕێنووسێکی تر یان وشە ئینگلیزییەکەی بنووسە.",
        "en": "Nothing matched. Try another spelling, or the English word."}
MANY = {"fa": "چند واژه پیدا شد — یکی را انتخاب کن:", "ckb": "چەند وشەیەک دۆزرایەوە — یەکێک هەڵبژێرە:",
        "en": "Several entries matched — pick one:"}
COUNT = {"fa": "دانشنامه {n} واژه دارد.", "ckb": "زانستنامە {n} وشەی هەیە.", "en": "The encyclopedia holds {n} entries."}
FA_D = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


def ask(lang="fa"):
    lg = lang if lang in LANGS else "fa"
    n = str(len(index()))
    if lg != "en":
        n = n.translate(FA_D)
    return ASK.get(lg, ASK["fa"]) + "\n\n" + COUNT[lg].format(n=n)


def reply(q, lang="fa"):
    """(text, rows) — rows is a list of (label, callback) for the choices, empty when there is one hit"""
    lg = lang if lang in LANGS else "fa"
    hits = search(q, lg)
    if not hits:
        return NONE.get(lg, NONE["fa"]), []
    if len(hits) == 1:
        return card(hits[0]["i"], lg), []
    return MANY[lg], [(h["t"][lg], "enc:" + h["i"]) for h in hits]


def api():
    """what the extension and the apps search — one index, three languages"""
    return {"note": "the encyclopedia search index — titles, folded keywords and the published one-liner",
            "n": len(index()), "terms": index()}
