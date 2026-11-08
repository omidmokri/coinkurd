# -*- coding: utf-8 -*-
"""/kids/ — "Bitcoin for Juniors": the open My First Bitcoin curriculum for children aged 8-12,
in Persian, Central Kurdish (Sorani) and English.

The lesson text is NOT written in this file.  It lives in content/b4j/<lang>/**.md (see
content/b4j/README.md for where it comes from, the licence and what was changed) and is read here.
Every translation is compared with the English file block by block before a page is made from it;
if the structure differs, the build stops instead of publishing a page that could be wrong.

Pages
  /kids/                       the course: modules, where to start, progress
  /kids/<module>/              one module: its overview and its activities           (m1 .. m6)
  /kids/<module>/<activity>/   one activity (lesson plan) with materials checklist, print, timer
  /kids/foreword/ /kids/how-to-use/ /kids/parents/ /kids/faq/ /kids/glossary/
  /kids/about/                 source, licence (CC BY-SA 4.0), what we changed, how it was translated
  /kids/start/ money/ chain/ safe/ chart/ studio/   short pages that send old links to /kids/
"""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import b4j_md as MD          # noqa: E402
import build_pages as BP     # noqa: E402
import build_reality as BR   # noqa: E402

ROOT = BP.ROOT
SITE = BP.SITE
e = BP.e
VER = "5"
CONTENT = os.environ.get("B4J_CONTENT") or os.path.join(ROOT, "content", "b4j")      # the env var is for tests only
LANGS = ("fa", "ckb", "en")
HEAD = f'<link rel="stylesheet" href="/assets/kids.css?v={VER}">'
FOOT = f'<script src="/assets/kids.js?v={VER}" defer></script>'

SRC_REPO = "https://github.com/MyFirstBitcoin/mfb-curriculum"
LICENCE_URL = "https://creativecommons.org/licenses/by-sa/4.0/"
ORG_URL = "https://myfirstbitcoin.org/"
FOLDER = "programs/bitcoin-for-juniors/educator-guide/en"

# colour + symbol of each module (only decoration; the words come from the content files)
MOD_STYLE = {1: ("#f7931a", "🤝"), 2: ("#4ade80", "⏳"), 3: ("#38bdf8", "🖥️"),
             4: ("#a78bfa", "🔐"), 5: ("#f472b6", "💰"), 6: ("#facc15", "₿")}
SEC_ICON = {"objectives": "🎯", "materials": "🧰", "setup": "🛠️", "procedure": "🧭", "key-points": "🔑",
            "discussion-questions": "💬", "notes": "📝", "additional-resources": "🔗",
            "foreword": "🌱", "overarching-objectives": "🎯", "what-to-look-forward-to": "🔭",
            "why-it-matters-for-bitcoin": "₿"}
CHECKED_SECTIONS = ("materials", "setup")           # these lists get tick boxes


# ------------------------------------------------------------------ small helpers
def tri(fa, ckb, en, tag="span", cls=""):
    c = f' class="{cls}"' if cls else ""
    return (f'<{tag}{c} data-lang="fa">{fa}</{tag}><{tag}{c} data-lang="ckb" hidden>{ckb}</{tag}>'
            f'<{tag}{c} data-lang="en" hidden dir="ltr">{en}</{tag}>')


def t3(v, tag="span", cls=""):
    return tri(e(v[0]), e(v[1]), e(v[2]), tag, cls)


def num(n, lang):
    s = str(n)
    if lang == "fa":
        return s.translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))
    if lang == "ckb":
        return s.translate(str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩"))
    return s


def n3(n):
    return tuple(num(n, lg) for lg in LANGS)


def fill(v, **kw):
    """fill {placeholders} of a (fa, ckb, en) triple; numbers are written in each language's digits"""
    out = []
    for lg, s in zip(LANGS, v):
        out.append(s.format(**{k: (num(x, lg) if isinstance(x, int) else x) for k, x in kw.items()}))
    return tuple(out)


DIGIT_FIX = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def ascii_digits(s):
    return s.translate(DIGIT_FIX)


# ------------------------------------------------------------------ the words of the pages themselves
UI = {
    "prog": ("بیت‌کوین برای کودکان", "بیتکۆین بۆ منداڵان", "Bitcoin for Juniors"),
    "tag": ("برنامهٔ درسی پر از بازی و گفت‌وگو برای کودکان ۸ تا ۱۲ ساله — بدون پول واقعی، بدون نیاز به گوشی یا رایانه",
            "پرۆگرامێکی وانەیی پڕ لە یاری و گفتوگۆ بۆ منداڵانی ٨ بۆ ١٢ ساڵ — بێ پارەی ڕاستەقینە، بێ پێویستی بە مۆبایل یان کۆمپیوتەر",
            "A course full of games and discussion for children aged 8 to 12 — no real money, no phones or computers needed"),
    "learn": ("آموزش", "فێربوون", "Learn"),
    "home": ("خانه", "سەرەکی", "Home"),
    "modules": ("فصل‌ها", "بەشەکان", "Modules"),
    "module": ("فصل", "بەشی", "Module"),
    "activity": ("فعالیت", "چالاکی", "Activity"),
    "activities": ("فعالیت", "چالاکی", "activities"),
    "n_mod": ("{n} فصل", "{n} بەش", "{n} modules"),
    "n_act": ("{n} فعالیت", "{n} چالاکی", "{n} activities"),
    "ages": ("۸ تا ۱۲ سال", "٨ بۆ ١٢ ساڵ", "ages 8 to 12"),
    "no_money": ("بدون پول واقعی", "بێ پارەی ڕاستەقینە", "no real money"),
    "free": ("رایگان و با مجوز باز", "بێبەرامبەر و بە مۆڵەتی کراوە", "free and openly licensed"),
    "start": ("شروع از فصل ۱", "دەستپێکردن لە بەشی ١", "Start with module 1"),
    "start_h": ("از اینجا شروع کنید", "لێرەوە دەست پێ بکەن", "Start here"),
    "who_h": ("برای چه کسانی است؟", "بۆ کێیە؟", "Who is it for?"),
    "who": ("معلم‌ها، خانواده‌هایی که فرزندشان را در خانه آموزش می‌دهند، مربی‌های محلی و والدینی که می‌خواهند فرزندشان را زود با آگاهی مالی آشنا کنند. هر فعالیت یک طرح درس آماده است: بازی، کاردستی، قصه و گفت‌وگو؛ بدون گوشی، بدون رایانه و بدون پول واقعی.",
            "مامۆستایان، ئەو خێزانانەی لە ماڵەوە منداڵەکانیان فێر دەکەن، پەروەردەکارانی ناوچەیی و ئەو دایک و باوکانەی دەیانەوێت زوو منداڵەکانیان بە هۆشیاریی دارایی ئاشنا بکەن. هەر چالاکییەک پلانێکی وانەی ئامادەیە: یاری، دەستکاری، چیرۆک و گفتوگۆ؛ بێ مۆبایل، بێ کۆمپیوتەر و بێ پارەی ڕاستەقینە.",
            "Teachers, homeschooling families, community educators and parents who want to introduce financial awareness early. Every activity is a ready lesson plan: games, crafts, stories and discussion — no phones, no computers, no real money."),
    "foreword": ("پیش‌گفتار", "پێشەکی", "Foreword"),
    "foreword_d": ("چرا این برنامه ساخته شد", "بۆچی ئەم پرۆگرامە دروست کرا", "Why this course exists"),
    "howto": ("چطور از طرح درس‌ها استفاده کنیم", "چۆن پلانی وانەکان بەکار بهێنین", "Using the lesson plans"),
    "howto_d": ("ساختار هر طرح درس و شیوهٔ استفاده از آن", "پێکهاتەی هەر پلانێکی وانە و شێوازی بەکارهێنانی", "How each lesson plan is built and how to use it"),
    "parents": ("راهنمای والدین", "ڕێنمایی دایک و باوکان", "Parent guide"),
    "parents_d": ("پاسخ به پرسش‌های رایج والدین", "وەڵامی پرسیارە باوەکانی دایک و باوکان", "Answers to common parent questions"),
    "faq": ("پرسش‌های متداول", "پرسیارە باوەکان", "FAQ"),
    "faq_d": ("برنامه چیست، برای چه کسی است و چه یاد می‌دهد", "پرۆگرام چییە، بۆ کێیە و چی فێر دەکات", "What the course is, who it is for and what it teaches"),
    "glossary": ("واژه‌نامه", "وشەنامە", "Key terms"),
    "glossary_d": ("{n} اصطلاح کلیدی با تعریف ساده", "{n} زاراوەی سەرەکی بە پێناسەی ساکار", "{n} key terms in plain words"),
    "about": ("دربارهٔ این برنامه", "دەربارەی ئەم پرۆگرامە", "About this course"),
    "about_d": ("منبع، مجوز و تغییرهایی که داده‌ایم", "سەرچاوە، مۆڵەت و گۆڕانکارییەکانی ئێمە", "Source, licence and the changes we made"),
    "hub_credit": ("این بخش ترجمه و بازنشر برنامهٔ درسی باز «Bitcoin for Juniors» از سازمان غیرانتفاعی My First Bitcoin است (مجوز CC BY-SA 4.0). ترجمهٔ فارسی و کردی سورانی غیررسمی است.",
                   "ئەم بەشە بریتییە لە وەرگێڕان و دووبارە بڵاوکردنەوەی پرۆگرامی وانەیی کراوەی «Bitcoin for Juniors»، کە ڕێکخراوی ناقازانجی My First Bitcoin دروستی کردووە (مۆڵەتی CC BY-SA 4.0). وەرگێڕانی فارسی و کوردیی سۆرانی فەرمی نییە.",
                   "This section is a translation and republication of the open “Bitcoin for Juniors” curriculum by the non-profit My First Bitcoin (licence CC BY-SA 4.0). The Persian and Sorani Kurdish versions are unofficial."),
    "more": ("بیشتر بدانید", "زیاتر بزانە", "Read more"),
    "open": ("باز کردن", "کردنەوە", "Open"),
    "done_n": ("{a} از {b} انجام شده", "{a} لە {b} ئەنجامدراوە", "{a} of {b} done"),
    "print": ("چاپ", "چاپکردن", "Print"),
    "mark": ("این فعالیت را انجام دادیم", "ئەم چالاکییەمان ئەنجامدا", "We did this activity"),
    "marked": ("انجام شد ✓", "ئەنجامدرا ✓", "Done ✓"),
    "timer": ("زمان‌سنج", "کاتژمێر", "Timer"),
    "prev": ("قبلی", "پێشوو", "Previous"),
    "next": ("بعدی", "دواتر", "Next"),
    "all_mods": ("همهٔ فصل‌ها", "هەموو بەشەکان", "All modules"),
    "allact": ("فعالیت‌های این فصل", "چالاکییەکانی ئەم بەشە", "Activities in this module"),
    "overview": ("نگاه کلی به این فصل", "ڕوانینێکی گشتی بۆ ئەم بەشە", "Module overview"),
    "on_page": ("در این صفحه", "لەم پەڕەیەدا", "On this page"),
    "lex": ("فرهنگ‌نامهٔ رسمی", "فەرهەنگی فەرمی", "Official lexicon"),
    "apx": ("ضمیمه‌های چاپی در متنِ بازِ منبع نیستند و در این ترجمه هم نیامده‌اند؛ برای آن‌ها به سایت رسمی My First Bitcoin مراجعه کنید.",
            "پاشکۆ چاپکراوەکان لە دەقی کراوەی سەرچاوەدا نین و لەم وەرگێڕانەشدا نەهاتوون؛ بۆ ئەوانە سەیری ماڵپەڕی فەرمیی My First Bitcoin بکەن.",
            "The printable appendices are not part of the open source text and are not included in this translation; see the official My First Bitcoin website for them."),
    "timer_go": ("شروع", "دەست پێ بکە", "Start"),
    "timer_pause": ("توقف", "ڕاگرە", "Pause"),
    "timer_reset": ("از نو", "دووبارە", "Reset"),
    "timer_min": ("دقیقه", "خولەک", "min"),
    "timer_up": ("وقت تمام شد!", "کات تەواو بوو!", "Time is up!"),
    "moved_h": ("این بخش اکنون «بیت‌کوین برای کودکان» است", "ئەم بەشە گۆڕدرا بۆ «بیتکۆین بۆ منداڵان»", "This section has become “Bitcoin for Juniors”"),
    "moved": ("به‌جای بازی‌ها و فیلم‌های قبلی، حالا برنامهٔ درسی کامل و باز «بیت‌کوین برای کودکان» را به فارسی، کردی سورانی و انگلیسی داریم.",
              "لە جیاتی یاری و فیلمە پێشووەکان، ئێستا پرۆگرامی وانەیی تەواو و کراوەی «بیتکۆین بۆ منداڵان» بە فارسی، کوردیی سۆرانی و ئینگلیزی بەردەستە.",
              "In place of the earlier games and films there is now the complete open “Bitcoin for Juniors” course in Persian, Sorani Kurdish and English."),
    "moved_go": ("رفتن به برنامه", "بڕۆ بۆ پرۆگرام", "Go to the course"),
}


# ------------------------------------------------------------------ the content files
_cache = {}


def load(rel):
    """the three versions of one content file, parsed — and proven to have the structure of the English one"""
    if rel in _cache:
        return _cache[rel]
    out = {}
    for lg in LANGS:
        p = os.path.join(CONTENT, lg, rel)
        if not os.path.exists(p):
            raise SystemExit(f"kids: content/b4j/{lg}/{rel} is missing")
        out[lg] = MD.parse(open(p, encoding="utf-8").read())
    for lg in ("fa", "ckb"):
        bad = MD.parity(out["en"], out[lg])
        if bad:
            raise SystemExit(f"kids: {lg}/{rel} does not match the English structure: " + "; ".join(bad[:4]))
    _cache[rel] = out
    return out


def source_info():
    p = os.path.join(CONTENT, "SOURCE.json")
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}


SRC = source_info()
NUMPFX = re.compile(r"^[\d۰-۹٠-٩]+[.][\d۰-۹٠-٩]+\s*")


def h1(rel, lg):
    return next(b["t"] for b in load(rel)[lg] if b["k"] == "h" and b["n"] == 1)


def bare(t):
    """'1.4 Ship Rekt' -> 'Ship Rekt'"""
    return NUMPFX.sub("", MD.plain(t)).strip()


def catalog():
    """six modules, each with an overview file and its activities, in order"""
    mods = []
    for n in range(1, 7):
        d = f"m{n}"
        files = sorted(f for f in os.listdir(os.path.join(CONTENT, "en", d)) if f.endswith(".md"))
        ov = [f for f in files if f.endswith("-overview.md")]
        if len(ov) != 1:
            raise SystemExit(f"kids: module {n} needs exactly one overview file")
        acts = []
        for f in files:
            if f == ov[0]:
                continue
            m = re.match(r"(\d+\.\d+)-(.+)\.md$", f)
            if not m:
                raise SystemExit(f"kids: unexpected file name {d}/{f}")
            acts.append({"rel": f"{d}/{f}", "num": m.group(1), "mod": n,
                         "slug": m.group(1).replace(".", "-") + "-" + m.group(2)})
        mods.append({"n": n, "dir": d, "ov": f"{d}/{ov[0]}", "acts": acts})
    titles = [b["t"] for b in load("front/modules.md")["en"] if b["k"] == "li"]
    if len(titles) != 6:
        raise SystemExit("kids: front/modules.md must list six modules")
    for m in mods:
        m["title"] = {lg: [b["t"] for b in load("front/modules.md")[lg] if b["k"] == "li"][m["n"] - 1] for lg in LANGS}
        m["color"], m["icon"] = MOD_STYLE[m["n"]]
        m["url"] = f"/kids/{m['dir']}/"
        for a in m["acts"]:
            a["url"] = f"/kids/{m['dir']}/{a['slug']}/"
            a["title"] = {lg: h1(a["rel"], lg) for lg in LANGS}
    return mods


def glossary_terms():
    """English slug -> {lang: (term, definition blocks)} straight from front/glossary.md"""
    d = load("front/glossary.md")
    out = {}
    for lg in LANGS:
        for i, b in enumerate(d[lg]):
            if b["k"] == "h" and b["n"] == 2:
                out.setdefault(MD.slug(d["en"][i]["t"]), {})[lg] = i
    return out


def make_fix(terms):
    lex = re.compile(r"^https://curriculum\.myfirstbitcoin\.org/lexicon/en/#([\w-]+)$")

    def fix(u):
        m = lex.match(u)
        if m and m.group(1) in terms:
            return f"/kids/glossary/#{m.group(1)}", False
        return u, True
    return fix


# ------------------------------------------------------------------ turning one content file into HTML
TIME_RE = re.compile(r"^\*\*\d+(?:\s*[–-]\s*\d+)?\s*minutes?\*\*$", re.I)


def blocks_html(lg, tr, en, hm, fix, base=0, key="", check=False):
    """a run of blocks -> HTML.  The English block at the same position decides what kind of line it is."""
    out, i, n = [], 0, len(tr)
    while i < n:
        b, eb = tr[i], en[i]
        k = b["k"]
        if k == "li":
            j = i
            while j < n and tr[j]["k"] == "li":
                j += 1
            at = None
            if check:
                def at(idx, it, i=i):
                    if it["lvl"]:
                        return ""
                    return f'<input type="checkbox" class="b4j-ck" data-k="{e(key)}:{base + i + idx}" aria-label="✓"> '
            out.append(MD.render_list(tr[i:j], fix, at))
            i = j
            continue
        if k == "tr":
            j = i
            while j < n and tr[j]["k"] == "tr":
                j += 1
            out.append(MD.render_table(tr[i:j], fix))
            i = j
            continue
        if k == "h":
            lv = hm[b["n"]]
            out.append(f"<h{lv}>{MD.inline(b['t'], fix)}</h{lv}>")
        elif k == "p":
            out.append(f"<p>{MD.inline(b['t'], fix)}</p>")
        elif k == "pb":
            et = eb["t"]
            cls = "tm" if TIME_RE.match(et) else "apx" if et.lower().startswith("**appendix") else "bl"
            out.append(f'<p class="{cls}">{MD.inline(b["t"], fix)}</p>')
        else:  # pi
            out.append(f'<p class="it">{MD.inline(b["t"], fix)}</p>')
        i += 1
    return "".join(out)


def split_sections(tr):
    """blocks -> (head blocks, [(index of heading, heading level, [blocks of the section])]) at the lowest heading level"""
    lv = sorted({b["n"] for b in tr if b["k"] == "h" and b["n"] > 1})
    if not lv:
        return list(enumerate(tr)), []
    top = lv[0]
    head, secs = [], []
    for i, b in enumerate(tr):
        if b["k"] == "h" and b["n"] == top:
            secs.append([i, top, []])
        elif secs:
            secs[-1][2].append((i, b))
        else:
            head.append((i, b))
    return head, secs


def chips(text):
    parts = [x.strip() for x in MD.plain(text).strip("_ ").split("·")]
    return "".join(f"<span>{e(x)}</span>" for x in parts if x)


def render_doc(lg, rel, fix, key="", cards=True, check_in=()):
    """one content file in one language -> {title, head, body, toc, plain lead}"""
    d = load(rel)
    tr, en = d[lg], d["en"]
    hm = MD.head_map(tr)
    head, secs = split_sections(tr)
    title = next((b["t"] for b in tr if b["k"] == "h" and b["n"] == 1), "")
    meta = lead = ""
    pre = []
    plain_lead = ""
    for i, b in head:
        if b["k"] == "h" and b["n"] == 1:
            continue
        if b["k"] == "pi" and not meta:
            meta = f'<div class="b4j-chips">{chips(b["t"])}</div>'
        elif b["k"] == "p" and not lead:
            lead = f'<p class="lead">{MD.inline(b["t"], fix)}</p>'
            plain_lead = MD.plain(b["t"])
        else:
            pre.append((i, b))
    pre_html = blocks_html(lg, [b for _, b in pre], [en[i] for i, _ in pre], hm, fix, key=key) if pre else ""
    body, toc = [], []
    for si, (hi, top, items) in enumerate(secs):
        slug_ = MD.slug(en[hi]["t"]) or f"s{si}"
        sid = f"{lg}-{slug_}"
        inner = blocks_html(lg, [b for _, b in items], [en[i] for i, _ in items], hm, fix,
                            base=hi + 1, key=key, check=slug_ in check_in)
        label = MD.plain(tr[hi]["t"])
        toc.append((sid, label))
        if cards:
            ic = SEC_ICON.get(slug_, "")
            ic = f'<i class="ic" aria-hidden="true">{ic}</i>' if ic else ""
            body.append(f'<section class="b4j-s s-{slug_}" id="{sid}"><h2>{ic}{MD.inline(tr[hi]["t"], fix)}</h2>{inner}</section>')
        else:
            body.append(f'<section class="b4j-s" id="{sid}"><h2>{MD.inline(tr[hi]["t"], fix)}</h2>{inner}</section>')
    has_apx = any(b["k"] == "pb" and b["t"].lower().startswith("**appendix") for b in en)
    return {"title": title, "meta": meta, "lead": lead, "pre": pre_html, "body": "".join(body),
            "toc": toc, "plain_lead": plain_lead, "has_apx": has_apx}


def toc_html(toc):
    return ('<nav class="b4j-toc" aria-label="toc">'
            + "".join(f'<a href="#{i}">{e(t)}</a>' for i, t in toc) + "</nav>") if len(toc) > 1 else ""


# ------------------------------------------------------------------ page furniture
def shell(extra=""):
    return (HEAD + FOOT + f"<style>{BP.LEARN_CSS}</style>" + extra
            + f"<script>document.addEventListener('DOMContentLoaded',function(){{{BP.LANG_JS}}})</script>")


def wrap(per_lang, tag="div", cls=""):
    """{'fa': html, 'ckb': html, 'en': html} -> three language copies of one block"""
    c = f' class="{cls}"' if cls else ""
    return (f'<{tag}{c} data-lang="fa">{per_lang["fa"]}</{tag}>'
            f'<{tag}{c} data-lang="ckb" hidden>{per_lang["ckb"]}</{tag}>'
            f'<{tag}{c} data-lang="en" hidden dir="ltr">{per_lang["en"]}</{tag}>')


def crumbs(items, url):
    """visible breadcrumb row + BreadcrumbList JSON-LD.  items: [(path or None, (fa, ckb, en))] after Home"""
    row = [f'<a href="/">{t3(UI["home"])}</a>']
    ld = [{"@type": "ListItem", "position": 1, "name": UI["home"][0], "item": SITE + "/"}]
    for i, (path, tt) in enumerate(items):
        last = i == len(items) - 1
        row.append(t3(tt) if (last or not path) else f'<a href="{path}">{t3(tt)}</a>')
        ld.append({"@type": "ListItem", "position": i + 2, "name": tt[0], "item": url if last else SITE + path})
    nav = f'<nav class="b4j-bc" aria-label="breadcrumb">{" <i>/</i> ".join(row)}</nav>'
    return nav, {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": ld}


def ldjson(*objs):
    return "".join(f'<script type="application/ld+json">{BP.sj(o)}</script>' for o in objs)


def meta_line(rel, lg):
    return next((b["t"] for b in load(rel)[lg] if b["k"] == "pi"), "")


def mod_label(m):
    return fill(("فصل {n}", "بەشی {n}", "Module {n}"), n=m["n"])


def act_label(a):
    return tuple(f"{UI['activity'][i]} {num(a['num'], lg)}" for i, lg in enumerate(LANGS))


def stops(M):
    """the reading order: module page, its activities, next module page, ..."""
    out = []
    for m in M:
        out.append({"url": m["url"], "t": tuple(f"{mod_label(m)[i]} — {bare(m['title'][lg])}" for i, lg in enumerate(LANGS))})
        for a in m["acts"]:
            out.append({"url": a["url"], "t": tuple(f"{act_label(a)[i]} — {bare(a['title'][lg])}" for i, lg in enumerate(LANGS))})
    return out


def pn_nav(M, url):
    st = stops(M)
    i = next(k for k, s in enumerate(st) if s["url"] == url)
    arrows = {"prev": ("→ ", "→ ", "← "), "next": (" ←", " ←", " →")}
    out = []
    if i > 0:
        p = st[i - 1]
        out.append(f'<a class="p" rel="prev" href="{p["url"]}"><small>{t3(UI["prev"])}</small>'
                   + tri(*(e(arrows["prev"][k] + p["t"][k]) for k in range(3))) + "</a>")
    if i + 1 < len(st):
        n = st[i + 1]
        out.append(f'<a class="n" rel="next" href="{n["url"]}"><small>{t3(UI["next"])}</small>'
                   + tri(*(e(n["t"][k] + arrows["next"][k]) for k in range(3))) + "</a>")
    return f'<nav class="b4j-pn b4j-np">{"".join(out)}</nav>'


def timer_box():
    presets = "".join(f'<button type="button" data-min="{m}">{m}</button>' for m in (1, 2, 3, 5, 10, 15))
    return ('<div class="b4j-timer b4j-np" id="b4jTimer" hidden>'
            f'<div class="pr" role="group" aria-label="{e(UI["timer"][2])}">{presets}'
            f'<span class="mn">{t3(UI["timer_min"])}</span></div>'
            '<output class="tm" aria-live="off">05:00</output>'
            f'<div class="ct"><button type="button" data-t="go">{t3(UI["timer_go"])}</button>'
            f'<button type="button" data-t="pause">{t3(UI["timer_pause"])}</button>'
            f'<button type="button" data-t="reset">{t3(UI["timer_reset"])}</button></div>'
            f'<p class="up" hidden>{t3(UI["timer_up"])}</p></div>')


def hub_data(M):
    return (f'<script type="application/json" id="b4jData">'
            + BP.sj({"mods": [{"id": m["dir"], "acts": [a["num"] for a in m["acts"]]} for m in M],
                     "ui": {"done_n": list(UI["done_n"])}}) + "</script>")


def trim(s, n=158):
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) <= n:
        return s
    cut = s[:n].rsplit(" ", 1)[0]
    return cut.rstrip("،,.;؛:") + "…"


# ------------------------------------------------------------------ pages
def act_card(a):
    en_t = e(bare(h1(a["rel"], "en")))
    titles = tri(*(e(bare(a["title"][lg])) for lg in LANGS), tag="b", cls="tt")
    small = tri(en_t, en_t, "", tag="small", cls="b4j-en")
    meta = wrap({lg: f'<span class="b4j-chips">{chips(meta_line(a["rel"], lg))}</span>' for lg in LANGS}, "span")
    no = tri(*(e(num(a["num"], lg)) for lg in LANGS), tag="span", cls="no")
    return (f'<a class="b4j-ac" href="{a["url"]}" data-act="{a["num"]}">{no}'
            f'<span class="tx">{titles}{small}{meta}</span><i class="ok" aria-hidden="true">✓</i></a>')


def page_hub(M, docs):
    total = sum(len(m["acts"]) for m in M)
    cards = []
    for m in M:
        cards.append(
            f'<a class="b4j-mod" href="{m["url"]}" data-mod="{m["dir"]}" style="--c:{m["color"]}">'
            f'<span class="ic" aria-hidden="true">{m["icon"]}</span><small>{t3(mod_label(m))}</small>'
            + tri(*(e(bare(m["title"][lg])) for lg in LANGS), tag="h3")
            + f'<p class="cnt">{t3(fill(UI["n_act"], n=len(m["acts"])))}</p>'
            '<span class="b4j-bar"><i></i></span><span class="pc"></span></a>')
    nterms = len(glossary_terms())
    facts = [fill(UI["n_mod"], n=len(M)), fill(UI["n_act"], n=total), UI["ages"], UI["no_money"], UI["free"]]
    start = "".join(
        f'<a class="b4j-sc" href="{u}"><span class="ic" aria-hidden="true">{ic}</span>'
        f'<b>{t3(UI[k])}</b><small>{t3(fill(UI[k + "_d"], n=nterms))}</small></a>'
        for u, ic, k in docs)
    body = (
        f'<article class="b4j b4j-hubp">{BP.LSW}'
        f'<div class="b4j-hero"><p class="kick">{t3(UI["learn"])} · My First Bitcoin</p>'
        f'<h1>{t3(UI["prog"])}</h1><p class="lead">{t3(UI["tag"])}</p>'
        f'<ul class="b4j-facts">{"".join("<li>" + t3(f) + "</li>" for f in facts)}</ul>'
        f'<div class="b4j-cta"><a class="go" href="{M[0]["url"]}">{t3(UI["start"])}</a>'
        f'<a class="alt" href="/kids/parents/">{t3(UI["parents"])}</a></div>'
        f'<p class="b4j-all" id="b4jAll" hidden></p></div>'
        f'<section><h2>{t3(UI["who_h"])}</h2><p class="b4j-who">{t3(UI["who"])}</p></section>'
        f'<section><h2>{t3(UI["modules"])}</h2><div class="b4j-grid">{"".join(cards)}</div></section>'
        f'<section><h2>{t3(UI["start_h"])}</h2><div class="b4j-grid sm">{start}</div></section>'
        f'<aside class="b4j-credit"><p>{t3(UI["hub_credit"])}</p>'
        f'<p class="lk" dir="ltr"><a href="{SRC_REPO}" target="_blank" rel="noopener noreferrer">GitHub</a> · '
        f'<a href="{ORG_URL}" target="_blank" rel="noopener noreferrer">My First Bitcoin</a> · '
        f'<a href="{LICENCE_URL}" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a> · '
        f'<a href="/kids/about/">{t3(UI["about"])}</a></p></aside></article>' + hub_data(M))
    url = f"{SITE}/kids/"
    ld = {"@context": "https://schema.org", "@type": "Course", "name": UI["prog"][0], "description": UI["tag"][0],
          "url": url, "inLanguage": ["fa", "ckb", "en"], "isAccessibleForFree": True,
          "typicalAgeRange": "8-12", "license": LICENCE_URL, "isBasedOn": SRC_REPO,
          "provider": {"@type": "Organization", "name": "entekhab.net", "url": SITE},
          "author": {"@type": "Organization", "name": "My First Bitcoin", "url": ORG_URL},
          "hasPart": [{"@type": "Course", "name": bare(m["title"]["fa"]), "url": SITE + m["url"],
                       "provider": {"@type": "Organization", "name": "entekhab.net"}} for m in M]}
    return BP.page("kids/", UI["prog"][0] + " — برنامهٔ درسی باز برای کودکان ۸ تا ۱۲ ساله", UI["tag"][0], body,
                   shell(ldjson(ld)))


def head_block(lg, kick, title, en_title="", meta=""):
    ent = "" if lg == "en" or not en_title else f'<p class="b4j-en" lang="en" dir="ltr">{e(en_title)}</p>'
    return f'<div class="b4j-h"><p class="kick">{kick}</p><h1>{title}</h1>{ent}{meta}</div>'


def page_module(M, fix, m):
    per = {}
    for i, lg in enumerate(LANGS):
        r = render_doc(lg, m["ov"], fix)
        per[lg] = (head_block(lg, f'{m["icon"]} {e(mod_label(m)[i])}', e(bare(m["title"][lg])), m["title"]["en"])
                   + toc_html(r["toc"] + [("acts", UI["allact"][i])]) + r["body"])
    cards = "".join(act_card(a) for a in m["acts"])
    url = SITE + m["url"]
    nav, bld = crumbs([("/kids/", UI["prog"]), (None, tuple(f"{mod_label(m)[i]} — {bare(m['title'][lg])}" for i, lg in enumerate(LANGS)))], url)
    body = (f'{nav}<article class="b4j" style="--c:{m["color"]}">{BP.LSW}{wrap(per)}'
            f'<section class="b4j-s" id="acts"><h2><i class="ic" aria-hidden="true">🧩</i>{t3(UI["allact"])}</h2>'
            f'<div class="b4j-list">{cards}</div></section>'
            f'{pn_nav(M, m["url"])}</article>' + hub_data(M))
    ld = {"@context": "https://schema.org", "@type": "Course", "name": bare(m["title"]["fa"]), "url": url,
          "inLanguage": ["fa", "ckb", "en"], "isAccessibleForFree": True, "license": LICENCE_URL,
          "isPartOf": {"@type": "Course", "name": UI["prog"][0], "url": SITE + "/kids/"},
          "provider": {"@type": "Organization", "name": "entekhab.net"},
          "hasPart": [{"@type": "LearningResource", "name": bare(a["title"]["fa"]), "url": SITE + a["url"]} for a in m["acts"]]}
    desc = trim(render_doc("fa", m["ov"], fix)["plain_lead"] or " ".join(
        MD.plain(b["t"]) for b in load(m["ov"])["fa"] if b["k"] == "p")[:400])
    return BP.page(m["url"].strip("/"), f'{bare(m["title"]["fa"])} — {UI["prog"][0]}', desc, body,
                   shell(ldjson(bld, ld)))


def page_activity(M, fix, m, a):
    per, desc, apx = {}, "", False
    for i, lg in enumerate(LANGS):
        r = render_doc(lg, a["rel"], fix, key=a["num"], check_in=CHECKED_SECTIONS)
        if lg == "fa":
            desc = trim(r["plain_lead"])
        apx = apx or r["has_apx"]
        kick = f'<a href="{m["url"]}">{e(mod_label(m)[i])} — {e(bare(m["title"][lg]))}</a>'
        per[lg] = (head_block(lg, kick, MD.inline(r["title"], fix), bare(h1(a["rel"], "en")), r["meta"])
                   + r["lead"] + r["pre"] + toc_html(r["toc"]) + r["body"])
    url = SITE + a["url"]
    nav, bld = crumbs([("/kids/", UI["prog"]), (m["url"], tuple(f"{mod_label(m)[i]} — {bare(m['title'][lg])}" for i, lg in enumerate(LANGS))),
                       (None, tuple(f"{num(a['num'], lg)} {bare(a['title'][lg])}" for lg in LANGS))], url)
    bar = (f'<div class="b4j-bar2 b4j-np">{BP.LSW}<span class="sp"></span>'
           f'<button type="button" class="b4j-btn" data-timer-toggle aria-expanded="false">⏱ {t3(UI["timer"])}</button>'
           f'<button type="button" class="b4j-btn" data-print>🖨 {t3(UI["print"])}</button></div>')
    done = (f'<div class="b4j-donebar b4j-np"><button type="button" class="b4j-done" data-done="{a["num"]}" aria-pressed="false">'
            f'<span class="off">{t3(UI["mark"])}</span><span class="on">{t3(UI["marked"])}</span></button></div>')
    body = (f'{nav}<article class="b4j b4j-act" data-act="{a["num"]}" style="--c:{m["color"]}">{bar}{timer_box()}'
            f'{wrap(per)}'
            + (f'<p class="b4j-note">{t3(UI["apx"])}</p>' if apx else "")
            + f'{done}{pn_nav(M, a["url"])}</article>' + hub_data(M))
    src = SRC.get("files", {}).get(a["rel"], {}).get("src", "")
    ld = {"@context": "https://schema.org", "@type": "LearningResource", "name": bare(a["title"]["fa"]), "url": url,
          "description": desc, "inLanguage": ["fa", "ckb", "en"], "learningResourceType": "lesson plan",
          "educationalLevel": "ages 8-12", "isAccessibleForFree": True, "license": LICENCE_URL,
          "isPartOf": {"@type": "Course", "name": UI["prog"][0], "url": SITE + "/kids/"},
          "author": {"@type": "Organization", "name": "My First Bitcoin", "url": ORG_URL},
          "translator": {"@type": "Organization", "name": "entekhab.net", "url": SITE}}
    if src and SRC.get("commit"):
        ld["isBasedOn"] = f"{SRC_REPO}/blob/{SRC['commit']}/{FOLDER}/{src}"
    return BP.page(a["url"].strip("/"), f'{bare(a["title"]["fa"])} — {UI["prog"][0]}', desc, body, shell(ldjson(bld, ld)))


def page_doc(M, fix, path, rel, kick_key):
    per = {}
    for i, lg in enumerate(LANGS):
        r = render_doc(lg, rel, fix)
        per[lg] = (head_block(lg, e(UI[kick_key][i]), MD.inline(r["title"], fix)) + r["lead"] + r["pre"]
                   + toc_html(r["toc"]) + r["body"])
    url = f"{SITE}/{path}/"
    nav, bld = crumbs([("/kids/", UI["prog"]), (None, UI[kick_key])], url)
    body = (f'{nav}<article class="b4j">{BP.LSW}{wrap(per)}<div class="b4j-np"><p class="b4j-back">'
            f'<a href="/kids/">{t3(UI["all_mods"])}</a></p></div></article>' + hub_data(M))
    fa = render_doc("fa", rel, fix)
    desc = trim(fa["plain_lead"] or next((MD.plain(b["t"]) for b in load(rel)["fa"] if b["k"] == "p"), UI["tag"][0]))
    return BP.page(path, f'{UI[kick_key][0]} — {UI["prog"][0]}', desc, body, shell(ldjson(bld)))


def page_glossary(M, fix):
    d = load("front/glossary.md")
    per = {}
    nav_pills = {}
    for i, lg in enumerate(LANGS):
        tr, en = d[lg], d["en"]
        idx = [k for k, b in enumerate(tr) if b["k"] == "h" and b["n"] == 2]
        arts, pills = [], []
        for n_, k in enumerate(idx):
            j = idx[n_ + 1] if n_ + 1 < len(idx) else len(tr)
            sl = MD.slug(en[k]["t"])
            inner = blocks_html(lg, tr[k + 1:j], en[k + 1:j], {1: 1, 2: 2}, fix)
            eng = MD.plain(en[k]["t"])
            tag = ""
            if lg != "en" and eng.lower() not in MD.plain(tr[k]["t"]).lower():
                tag = f' <span class="en" lang="en" dir="ltr">{e(eng)}</span>'
            arts.append(f'<article class="b4j-term" id="{lg}-{sl}"><h2>{MD.inline(tr[k]["t"], fix)}{tag}</h2>{inner}</article>')
            pills.append((f"{lg}-{sl}", MD.plain(tr[k]["t"])))
        title = next(b["t"] for b in tr if b["k"] == "h" and b["n"] == 1)
        per[lg] = (head_block(lg, e(UI["glossary"][i]), MD.inline(title, fix)) + toc_html(pills)
                   + f'<div class="b4j-terms">{"".join(arts)}</div>')
    url = f"{SITE}/kids/glossary/"
    nav, bld = crumbs([("/kids/", UI["prog"]), (None, UI["glossary"])], url)
    lex = (f'<p class="b4j-back" dir="ltr"><a href="https://curriculum.myfirstbitcoin.org/lexicon/en/" target="_blank" '
           f'rel="noopener noreferrer">Bitcoin Lexicon — My First Bitcoin</a></p>')
    body = (f'{nav}<article class="b4j">{BP.LSW}{wrap(per)}{lex}</article>' + hub_data(M))
    return BP.page("kids/glossary", f'{UI["glossary"][0]} — {UI["prog"][0]}',
                   fill(UI["glossary_d"], n=len(glossary_terms()))[0], body, shell(ldjson(bld)))


# ------------------------------------------------------------------ the "about / licence" page
def dg(s, lg):
    return s.translate(str.maketrans("0123456789", {"fa": "۰۱۲۳۴۵۶۷۸۹", "ckb": "٠١٢٣٤٥٦٧٨٩", "en": "0123456789"}[lg]))


MONTHS = {
    "fa": ["ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"],
    "ckb": ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەمووز", "ئاب", "ئەیلوول",
            "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"],
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
           "November", "December"],
}


def dlong(iso, lg):
    """'2026-10-28' -> '۲۸ اکتبر ۲۰۲۶' / '٢٨ تشرینی یەکەم ٢٠٢٦' / '28 October 2026'"""
    y, mo, d = (int(x) for x in iso.split("-"))
    return f"{num(d, lg)} {MONTHS[lg][mo - 1]} {num(y, lg)}"


def page_about(M):
    n_m, n_a = len(M), sum(len(m["acts"]) for m in M)
    commit = SRC.get("commit", "")
    rel = SRC.get("release", "")
    when = SRC.get("commit_date", "")
    got = SRC.get("retrieved", "")
    c7 = commit[:7]
    tg = '<a href="https://t.me/Coin_Kurd" target="_blank" rel="noopener noreferrer">t.me/Coin_Kurd</a>'
    tgg = '<a href="https://t.me/Coin_Kurd_Group" target="_blank" rel="noopener noreferrer">t.me/Coin_Kurd_Group</a>'
    repo = f'<a href="{SRC_REPO}/tree/{commit}/{FOLDER}" target="_blank" rel="noopener noreferrer">MyFirstBitcoin/mfb-curriculum</a>'
    lic = f'<a href="{LICENCE_URL}" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>'
    org = f'<a href="{ORG_URL}" target="_blank" rel="noopener noreferrer">myfirstbitcoin.org</a>'
    T = {
        "fa": [
            ("این برنامه چیست؟",
             [f"«بیت‌کوین برای کودکان» (Bitcoin for Juniors) برنامهٔ درسی باز سازمان غیرانتفاعی My First Bitcoin برای کودکان ۸ تا ۱۲ ساله است: {dg(str(n_m), 'fa')} فصل و {dg(str(n_a), 'fa')} فعالیت که با بازی، کاردستی، قصه و گفت‌وگو مفهوم‌هایی مثل ارزش، قیمت، کمیابی، زمان، انرژی، انصاف و حریم خصوصی را یاد می‌دهند و تنها در پایان به بیت‌کوین می‌رسند. هیچ پول واقعی یا کیف پول بیت‌کوین در کار نیست. در entekhab.net همین طرح درس‌ها را به‌صورت صفحه‌های وب و به سه زبان فارسی، کردی سورانی و انگلیسی منتشر کرده‌ایم."]),
            ("منبع و مجوز",
             [f"متن انگلیسی اصلی از مخزن عمومی My First Bitcoin در GitHub ({repo}) برداشته شده است: نسخهٔ {dg(rel, 'fa')}، کامیت {c7}، به تاریخ {dlong(when, 'fa')}؛ دریافت‌شده در {dlong(got, 'fa')}. این مخزن اعلام می‌کند که مگر آنکه جایی خلاف آن ذکر شده باشد، مطالب آن با مجوز Creative Commons Attribution-ShareAlike 4.0 ({lic}) منتشر شده‌اند. بر پایهٔ همین مجوز، ترجمه‌ها و اقتباس‌های این بخش هم با مجوز {lic} در اختیار شماست: می‌توانید متن را با ذکر منبع کپی، چاپ و ترجمه کنید یا از آن اقتباس کنید، به شرط آنکه تغییرهای خود را اعلام کنید و نتیجه را با همین مجوز منتشر کنید. این مجوز شامل متن درس‌ها می‌شود؛ کد و طراحی این وب‌سایت و بقیهٔ مطالب آن شرایط جداگانه‌ای دارند. سازمان: {org}."]),
            ("تغییرهایی که ما داده‌ایم",
             ["متن را به فارسی و کردی سورانی ترجمه کرده‌ایم.",
              "در متن انگلیسی فقط قالب‌بندی را اصلاح کرده‌ایم: شماره‌گذاری فهرست‌های تودرتو و مرحله‌ها در چند درس، اصلاح جای یک نشانهٔ زمان، یک عنوان فرعی که درست نوشته نشده بود و یک پیوند قدیمی؛ فاصله‌های اضافی را هم یکدست کرده‌ایم. خود جمله‌ها دست نخورده‌اند.",
              "پیش‌گفتار، مقدمه (راهنمای استفاده از طرح درس‌ها)، راهنمای والدین و پرسش‌های متداول را به صفحه‌های جدا تبدیل کرده‌ایم؛ نگاه کلی هر فصل در صفحهٔ همان فصل آمده است.",
              "واژه‌نامهٔ این سایت از مدخل‌هایی از فرهنگ‌نامهٔ رسمی (lexicon) ساخته شده است که طرح درس‌ها به آن‌ها پیوند داده‌اند، و تعریف‌هایش ترجمه شده‌اند؛ پیوندهای فرهنگ‌نامه در متن درس‌ها اکنون به همین واژه‌نامه می‌روند.",
              "امکان‌های تازه افزوده‌ایم: چک‌لیست وسایل و آماده‌سازی، علامت‌گذاری فعالیت‌های انجام‌شده (فقط در همین مرورگر ذخیره می‌شود)، زمان‌سنج، قالب چاپ و تغییر زبان.",
              "عنوان انگلیسی هر فعالیت را زیر عنوان ترجمه‌شده نشان می‌دهیم تا تطبیقش با نسخهٔ رسمی آسان باشد."]),
            ("ترجمه چگونه انجام شد؟",
             ["ترجمهٔ فارسی و کردی سورانی را هوش مصنوعی از روی متن انگلیسی انجام داده است، نه مترجم انسانی. برای کم کردن خطا، هر فایل با یک ابزار خودکار بند به بند با متن انگلیسی مقایسه شد (ساختار، تعداد بندها و موارد فهرست‌ها، پیوندها، عددها، و حرف‌ها و رقم‌های مجاز) و سپس بازبین‌های مستقل، که آن‌ها هم هوش مصنوعی بودند، ترجمه را دوباره با متن انگلیسی سنجیدند. با وجود این، هیچ مترجم یا معلم انسانی آن را تأیید نکرده است؛ ممکن است جمله‌ای ناهموار یا واژه‌ای نامأنوس مانده باشد، به‌ویژه در کردی سورانی. اگر در کلاس به ایرادی برخوردید، لطفاً به ما خبر بدهید. هر جا میان نسخه‌ها اختلافی باشد، متن انگلیسی مرجع است."]),
            ("آنچه در این نسخه نیست",
             ["ضمیمه‌های چاپی A و B و C که طرح درس‌ها به آن‌ها ارجاع می‌دهند در متنِ بازِ مخزن نیستند و در اینجا نیامده‌اند. در پرسش‌های متداولِ خودِ برنامه آمده است که برنامه به‌صورت یک راهنمای معلم PDF و برگه‌ها و مواد چاپی دانش‌آموز عرضه می‌شود. ما فقط از متنِ بازِ «راهنمای مربی» (Educator Guide) در مخزن استفاده کرده‌ایم، نه از آن PDF و نه از برگه‌های چاپی؛ بنابراین ممکن است PDF رسمی با این نسخه تفاوت‌هایی داشته باشد. برای مواد رسمی به سایت سازمان مراجعه کنید."]),
            ("غیررسمی بودن و سلب مسئولیت",
             ["این ترجمه رسمی نیست. My First Bitcoin آن را تأیید نکرده است و entekhab.net وابسته به آن سازمان نیست. دیدگاه‌هایی که در پیش‌گفتار و متن درس‌ها آمده، دیدگاه نویسندگان اصلی است. این صفحه‌ها آموزشی‌اند و توصیهٔ مالی یا سرمایه‌گذاری نیستند."]),
            ("گزارش خطا",
             [f"لطفاً ایراد ترجمه یا قالب را در کانال یا گروه تلگرام ما بنویسید: {tg} · {tgg}"]),
        ],
        "ckb": [
            ("ئەم پرۆگرامە چییە؟",
             [f"«بیتکۆین بۆ منداڵان» (Bitcoin for Juniors) پرۆگرامێکی وانەیی کراوەیە کە ڕێکخراوی ناقازانجی My First Bitcoin بۆ منداڵانی ٨ بۆ ١٢ ساڵ دروستی کردووە: {dg(str(n_m), 'ckb')} بەش و {dg(str(n_a), 'ckb')} چالاکی کە بە یاری، دەستکاری، چیرۆک و گفتوگۆ چەمکەکانی وەک بەها، نرخ، کەمیابی، کات، وزە، دادپەروەری و تایبەتێتی فێر دەکەن و تەنیا لە کۆتاییدا دەگەنە بیتکۆین. هیچ پارەی ڕاستەقینە یان جزدانی بیتکۆین لە ئارادا نییە. لە entekhab.net هەمان پلانی وانەکان وەک پەڕەی وێب و بە سێ زمانی فارسی، کوردیی سۆرانی و ئینگلیزی بڵاومان کردووەتەوە."]),
            ("سەرچاوە و مۆڵەت",
             [f"دەقی ئینگلیزیی ئەسڵی لە کۆگای گشتیی My First Bitcoin لە GitHub ({repo}) وەرگیراوە: وەشانی {dg(rel, 'ckb')}، کامیتی {c7}، بە بەرواری {dlong(when, 'ckb')}؛ کاتی وەرگرتن: {dlong(got, 'ckb')}. کۆگاکە ڕایدەگەیەنێت کە ئەگەر لە شوێنێک بە پێچەوانەوە نەنووسرابێت، ناوەڕۆکەکان بە مۆڵەتی Creative Commons Attribution-ShareAlike 4.0 ({lic}) بڵاوکراونەتەوە. بەپێی هەمان مۆڵەت، وەرگێڕان و گونجاندنەکانی ئەم بەشەش بە هەمان مۆڵەتی {lic} بۆ ئێوە بەردەستن: دەتوانن دەقەکە بە ئاماژەدان بە سەرچاوە کۆپی بکەن، چاپی بکەن، وەریبگێڕن و بیگۆڕن، بەو مەرجەی گۆڕانکارییەکانتان ڕابگەیەنن و ئەنجامەکە بە هەمان مۆڵەت بڵاو بکەنەوە. ئەم مۆڵەتە تایبەتە بە دەقی وانەکان؛ کۆد و دیزاینی ئەم ماڵپەڕە و ناوەڕۆکەکانی تری مەرجی جیاوازیان هەیە. ڕێکخراو: {org}."]),
            ("گۆڕانکارییەکانی ئێمە",
             ["دەقەکەمان وەرگێڕاوەتە سەر فارسی و کوردیی سۆرانی.",
              "لە دەقی ئینگلیزیدا تەنیا ڕێکخستنەکەمان ڕاست کردووەتەوە: ژمارەبەندیی لیستەکانی ناو لیست و هەنگاوەکان لە چەند وانەیەکدا، گواستنەوەی نیشانەیەکی کات، ژێرسەردێڕێک کە بە دروستی نەنووسرابوو و بەستەرێکی کۆن؛ بۆشاییە زیادەکانیشمان یەکسان کردووە. خودی ڕستەکان نەگۆڕاون.",
              "پێشەکی، ناساندن (چۆن پلانی وانەکان بەکار بهێنین)، ڕێنمایی دایک و باوکان و پرسیارە باوەکانمان کردوونەتە پەڕەی جیا؛ ڕوانینی گشتیی هەر بەشێک لە پەڕەی هەمان بەشدا هاتووە.",
              "وشەنامەی ئەم ماڵپەڕە لەو زاراوانەی فەرهەنگی فەرمی (lexicon) دروست کراوە کە پلانی وانەکان بەستەریان پێوە کردوون و پێناسەکان وەرگێڕدراون؛ بەستەرەکانی فەرهەنگ لە دەقی وانەکاندا ئێستا دەچنە سەر هەمان وشەنامە.",
              "چەند تایبەتمەندییەکی نوێمان زیاد کردووە: لیستی پشکنینی کەرەستە و ئامادەکاری، نیشانەکردنی چالاکییە ئەنجامدراوەکان (تەنیا لەم وێبگەڕەدا هەڵدەگیرێت)، کاتژمێر، شێوازی چاپ و گۆڕینی زمان.",
              "ناونیشانی ئینگلیزیی هەر چالاکییەک لە ژێر ناونیشانە وەرگێڕدراوەکەدا نیشان دەدەین تا بەراوردکردنی لەگەڵ وەشانی فەرمی ئاسان بێت."]),
            ("وەرگێڕان چۆن کرا؟",
             ["وەرگێڕانی فارسی و کوردیی سۆرانی لەلایەن زیرەکیی دەستکردەوە لە دەقی ئینگلیزییەوە کراوە، نەک لەلایەن وەرگێڕێکی مرۆڤەوە. بۆ کەمکردنەوەی هەڵە، هەر فایلێک بە ئامرازێکی خۆکار بڕگە بە بڕگە لەگەڵ دەقی ئینگلیزی بەراورد کرا (پێکهاتە، ژمارەی بڕگە و لیستەکان، بەستەرەکان، ژمارەکان، و پیت و ڕەقەمە ڕێگەپێدراوەکان) و پاشان چەند پشکنەری سەربەخۆ، کە ئەوانیش زیرەکیی دەستکرد بوون، وەرگێڕانەکەیان دووبارە لەگەڵ دەقی ئینگلیزی هەڵسەنگاند. لەگەڵ ئەوەشدا هیچ وەرگێڕ یان مامۆستایەکی مرۆڤ پەسەندی نەکردووە؛ لەوانەیە ڕستەیەکی ناڕێک یان وشەیەکی نامۆ مابێتەوە، بەتایبەتی لە کوردیی سۆرانیدا. ئەگەر لە پۆلدا هەڵەیەکتان بینی، تکایە ئاگادارمان بکەنەوە. ئەگەر جیاوازییەک هەبوو، دەقی ئینگلیزی پێوەرە."]),
            ("ئەوەی لەم وەشانەدا نییە",
             ["پاشکۆ چاپکراوەکانی A و B و C، کە پلانی وانەکان ئاماژەیان پێ دەکەن، لە دەقی کراوەی کۆگاکەدا نین و لێرە نەهاتوون. پرسیارە باوەکانی خودی پرۆگرامەکە دەڵێت پرۆگرامەکە بە شێوەی ڕێبەرییەکی مامۆستا (PDF) و پەڕە و کەرەستەی چاپکراوی قوتابی پێشکەش دەکرێت. ئێمە تەنیا لەسەر دەقی کراوەی «ڕێبەری پەروەردەکار» (Educator Guide) لە کۆگاکەدا کارمان کردووە، نەک لەسەر ئەو PDFە و پەڕە چاپکراوەکان؛ بۆیە لەوانەیە PDFی فەرمی لەم وەشانە جیاواز بێت. بۆ کەرەستە فەرمییەکان سەیری ماڵپەڕی ڕێکخراوەکە بکەن."]),
            ("فەرمی نەبوون و ڕەتکردنەوەی بەرپرسیارێتی",
             ["ئەم وەرگێڕانە فەرمی نییە. My First Bitcoin پەسەندی نەکردووە و entekhab.net سەر بەو ڕێکخراوە نییە. ئەو بۆچوونانەی لە پێشەکی و دەقی وانەکاندا هاتوون، بۆچوونی نووسەرانی ئەسڵین. ئەم پەڕانە فێرکارین و ئامۆژگاریی دارایی یان وەبەرهێنان نین."]),
            ("ڕاپۆرتکردنی هەڵە",
             [f"هەڵەی وەرگێڕان یان ڕێکخستن لە کەناڵ یان گرووپی تێلێگرامی ئێمەدا بنووسن: {tg} · {tgg}"]),
        ],
        "en": [
            ("What is this?",
             [f"“Bitcoin for Juniors” is an open curriculum by the non-profit My First Bitcoin for children aged 8 to 12: {n_m} modules and {n_a} activities that use games, crafts, stories and discussion to teach ideas such as value, price, scarcity, time, energy, fairness and privacy, and only at the end arrive at Bitcoin. No real money or Bitcoin wallets are involved. On entekhab.net we publish the same lesson plans as web pages in Persian, Sorani Kurdish and English."]),
            ("Source and licence",
             [f"The English text comes from the public My First Bitcoin repository on GitHub ({repo}): release {rel}, commit {c7}, dated {dlong(when, 'en')}; retrieved on {dlong(got, 'en')}. The repository states that, unless stated otherwise, its content is licensed under the Creative Commons Attribution-ShareAlike 4.0 licence ({lic}). On the same terms, the translations and adaptations in this section are available to you under {lic}: you may copy, print, translate and adapt the text if you credit the source, say what you changed, and share the result under the same licence. The licence covers the lesson text; the code and design of this website and its other content have their own terms. Organisation: {org}."]),
            ("What we changed",
             ["We translated the text into Persian and Sorani Kurdish.",
              "In the English text we corrected formatting only: the numbering of nested lists and steps in a few lessons, one misplaced time marker, one malformed sub-heading and one outdated link; we also normalised stray spaces. The sentences themselves are untouched.",
              "We turned the foreword, introduction (how to use the lesson plans), parent guide and FAQ into separate pages; each module’s overview sits on that module’s page.",
              "This site’s glossary is built from the entries of the official lexicon that the lesson plans link to, and its definitions are translated; links to the lexicon inside the lessons now lead to this glossary.",
              "We added: a checklist for materials and preparation, a way to mark activities as done (stored only in this browser), a timer, a print layout and a language switch.",
              "Each activity’s English title is shown under the translated title so it is easy to match with the official edition."]),
            ("How the translation was made",
             ["The Persian and Sorani Kurdish versions were translated from the English by an AI, not by a human translator. To reduce errors, every file was compared with the English block by block by an automated tool (structure, number of paragraphs and list items, links, numbers, and permitted letters and digits), and independent AI reviewers then checked each translation against the English again. Even so, no human translator or teacher has approved it; an awkward sentence or an unfamiliar word may remain, especially in Sorani Kurdish. If you notice a mistake in class, please tell us. Wherever the versions differ, the English text is the reference."]),
            ("What is not included",
             ["The printable appendices A, B and C, to which the lesson plans refer, are not part of the open text in the repository and are not reproduced here. The programme’s own FAQ says that the programme is delivered as a Teacher Guide PDF plus printable student handouts and materials. We worked only from the open Educator Guide text in the repository, not from that PDF or the handouts, so the official PDF may differ from this edition. For the official materials, please see the organisation’s website."]),
            ("Unofficial, and a disclaimer",
             ["This translation is unofficial. My First Bitcoin has not endorsed it, and entekhab.net is not affiliated with that organisation. The views expressed in the foreword and in the lesson text are those of the original authors. These pages are educational and are not financial or investment advice."]),
            ("Reporting a mistake",
             [f"Please write to us about translation or layout mistakes in our Telegram channel or group: {tg} · {tgg}"]),
        ],
    }
    per = {}
    for i, lg in enumerate(LANGS):
        parts = [head_block(lg, e(UI["about"][i]), e(UI["about"][i]))]
        for h, paras in T[lg]:
            if len(paras) > 1:
                parts.append(f'<section class="b4j-s"><h2>{h}</h2><ul>' + "".join(f"<li>{p}</li>" for p in paras) + "</ul></section>")
            else:
                parts.append(f'<section class="b4j-s"><h2>{h}</h2><p>{paras[0]}</p></section>')
        per[lg] = "".join(parts)
    url = f"{SITE}/kids/about/"
    nav, bld = crumbs([("/kids/", UI["prog"]), (None, UI["about"])], url)
    body = f'{nav}<article class="b4j">{BP.LSW}{wrap(per)}</article>' + hub_data(M)
    return BP.page("kids/about", f'{UI["about"][0]} — {UI["prog"][0]}', UI["about_d"][0], body, shell(ldjson(bld)))


# ------------------------------------------------------------------ old addresses
OLD_URLS = ["kids/start", "kids/money", "kids/chain", "kids/safe", "kids/chart", "kids/studio"]


def page_moved(path):
    body = (f'<article class="b4j"><div class="b4j-h"><h1>{t3(UI["moved_h"])}</h1></div>'
            f'<p class="lead">{t3(UI["moved"])}</p><p><a class="b4j-go" href="/kids/">{t3(UI["moved_go"])}</a></p></article>')
    head = ('<meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=/kids/">'
            + shell("") + "<script>location.replace('/kids/')</script>")
    return BP.page(path, UI["moved_h"][0], UI["moved"][0], body, head)


# ------------------------------------------------------------------ build
def build():
    M = catalog()
    terms = glossary_terms()
    fix = make_fix(set(terms))
    docs = [("/kids/foreword/", "🌱", "foreword"), ("/kids/how-to-use/", "🧭", "howto"),
            ("/kids/parents/", "👪", "parents"), ("/kids/faq/", "❓", "faq"),
            ("/kids/glossary/", "📖", "glossary"), ("/kids/about/", "ℹ️", "about")]
    urls = [page_hub(M, docs)]
    for m in M:
        urls.append(page_module(M, fix, m))
        for a in m["acts"]:
            urls.append(page_activity(M, fix, m, a))
    urls.append(page_doc(M, fix, "kids/foreword", "front/foreword.md", "foreword"))
    urls.append(page_doc(M, fix, "kids/how-to-use", "front/how-to-use.md", "howto"))
    urls.append(page_doc(M, fix, "kids/parents", "front/parent-guide.md", "parents"))
    urls.append(page_doc(M, fix, "kids/faq", "front/faq.md", "faq"))
    urls.append(page_glossary(M, fix))
    urls.append(page_about(M))
    BR.add_to_sitemap(urls)
    for p in OLD_URLS:                       # old links keep working, but are not listed in the sitemap
        page_moved(p)
    print(f"kids pages: {len(urls)} · modules {len(M)} · activities {sum(len(m['acts']) for m in M)} "
          f"· glossary terms {len(terms)} · languages {len(LANGS)} · redirects {len(OLD_URLS)}")
    return urls


if __name__ == "__main__":
    build()
