# -*- coding: utf-8 -*-
"""
آکادمی داخل ربات — همان درس‌های entekhab.net/academy/ ، خواندنی و پیگیری‌شدنی در خود تلگرام.

کسی که ربات را دارد نباید برای یادگیری مجبور به باز کردن سایت باشد: فهرست دانشکده‌ها، دوره‌ها،
متن درس در سه سطح، مثال واقعی، واژگان، نکات کلیدی، اشتباهات رایج، تمرین عملی و آزمون دکمه‌ای،
همه اینجا هستند. پیشرفت هر کاربر روی رکورد خودش ذخیره می‌شود و «ادامه» او را سر جای قبلی برمی‌گرداند.

فضای نام کال‌بک‌ها  ak:<کار>:<آرگومان‌ها>  (سقف ۶۴ بایت تلگرام رعایت شده است):
    ak:f                      فهرست دانشکده‌ها
    ak:c:<fid>                دوره‌ها و درس‌های یک دانشکده
    ak:l:<lid>:<sec>:<page>   یک بخش از درس، صفحه‌بندی‌شده
    ak:q:<lid>:<qi>           سؤال آزمون
    ak:a:<lid>:<qi>:<choice>  پاسخ کاربر
    ak:go                     ادامه از همان‌جا که رها کرده
"""
import html

SITE = "https://entekhab.net"
PAGE = 2900          # سقف امن برای یک پیام تلگرام (محدودیت واقعی ۴۰۹۶ است)
PASS = 0.8           # حدنصاب قبولی آزمون، همان عدد سایت

_CACHE = {}
_FA_DIG = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
_AR_DIG = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")

SECS = [("b", "beginner", "🌱"), ("i", "intermediate", "📘"), ("x", "expert", "🔬")]

T = {
    "sec_b": {"fa": "🌱 ساده", "ckb": "🌱 ئاسان", "en": "🌱 Simple"},
    "sec_i": {"fa": "📘 متوسط", "ckb": "📘 مامناوەند", "en": "📘 Medium"},
    "sec_x": {"fa": "🔬 تخصصی", "ckb": "🔬 پسپۆڕانە", "en": "🔬 Expert"},
    "sec_e": {"fa": "🌍 مثال واقعی", "ckb": "🌍 نموونەی ڕاستەقینە", "en": "🌍 Real example"},
    "sec_t": {"fa": "🔤 واژگان", "ckb": "🔤 وشەنامە", "en": "🔤 Terms"},
    "sec_k": {"fa": "🔑 نکات کلیدی", "ckb": "🔑 خاڵە سەرەکییەکان", "en": "🔑 Key points"},
    "sec_m": {"fa": "⚠️ اشتباهات رایج", "ckb": "⚠️ هەڵە باوەکان", "en": "⚠️ Common mistakes"},
    "sec_w": {"fa": "🛠 تمرین عملی", "ckb": "🛠 ڕاهێنانی کردەیی", "en": "🛠 Exercise"},
    "quiz": {"fa": "📝 آزمون", "ckb": "📝 تاقیکردنەوە", "en": "📝 Quiz"},
    "goal": {"fa": "🎯 هدف", "ckb": "🎯 ئامانج", "en": "🎯 Goal"},
    "mastery": {"fa": "🏁 معیار تسلط", "ckb": "🏁 پێوەری شارەزایی", "en": "🏁 Mastery"},
    "check": {"fa": "معیار درستی", "ckb": "پێوەری ڕاستی", "en": "Success check"},
    "src": {"fa": "📎 منابع", "ckb": "📎 سەرچاوەکان", "en": "📎 Sources"},
    "prev": {"fa": "‹ قبلی", "ckb": "‹ پێشوو", "en": "‹ Prev"},
    "next": {"fa": "بعدی ›", "ckb": "دواتر ›", "en": "Next ›"},
    "plesson": {"fa": "‹ درس قبل", "ckb": "‹ وانەی پێشوو", "en": "‹ Prev lesson"},
    "nlesson": {"fa": "درس بعد ›", "ckb": "وانەی دواتر ›", "en": "Next lesson ›"},
    "faclist": {"fa": "🏛 دانشکده‌ها", "ckb": "🏛 کۆلێژەکان", "en": "🏛 Faculties"},
    "back_fac": {"fa": "‹ درس‌های دانشکده", "ckb": "‹ وانەکانی کۆلێژ", "en": "‹ Faculty lessons"},
    "home": {"fa": "🏠 خانه", "ckb": "🏠 ماڵەوە", "en": "🏠 Home"},
    "cont": {"fa": "▶️ ادامهٔ یادگیری", "ckb": "▶️ بەردەوامبوون", "en": "▶️ Continue"},
    "onsite": {"fa": "🌐 همین درس در سایت", "ckb": "🌐 هەمان وانە لە ماڵپەڕ", "en": "🌐 This lesson on the site"},
    "soon": {"fa": "در حال تولید", "ckb": "لە بەردەستدایە", "en": "in production"},
    "progress": {"fa": "پیشرفت شما: {d} از {t} درس خوانده‌شده · {q} آزمون قبول",
                 "ckb": "پێشکەوتنت: {d} لە {t} وانە خوێندراوە · {q} تاقیکردنەوە سەرکەوتوو",
                 "en": "Your progress: {d} of {t} lessons read · {q} quizzes passed"},
    "pick_fac": {"fa": "یک دانشکده را انتخاب کنید. هر درس را همین‌جا در ربات می‌خوانید و آزمونش را می‌دهید.",
                 "ckb": "کۆلێژێک هەڵبژێرە. هەر وانەیەک لێرە لە بۆتدا دەخوێنیتەوە و تاقیکردنەوەکەی دەدەیت.",
                 "en": "Pick a faculty. You read every lesson and take its quiz right here in the bot."},
    "no_data": {"fa": "محتوای آکادمی در دسترس نیست.", "ckb": "ناوەڕۆکی ئەکادیمیا بەردەست نییە.", "en": "Academy content unavailable."},
    "q_of": {"fa": "سؤال {i} از {n}", "ckb": "پرسیاری {i} لە {n}", "en": "Question {i} of {n}"},
    "right": {"fa": "✅ درست", "ckb": "✅ ڕاستە", "en": "✅ Correct"},
    "wrong": {"fa": "❌ نادرست — پاسخ درست: {a}", "ckb": "❌ هەڵەیە — وەڵامی ڕاست: {a}", "en": "❌ Wrong — correct answer: {a}"},
    "score": {"fa": "🏁 نتیجه: {c} از {n} ({p}٪)", "ckb": "🏁 ئەنجام: {c} لە {n} ({p}٪)", "en": "🏁 Result: {c} of {n} ({p}%)"},
    "passed": {"fa": "قبول شدید. این درس به کارنامهٔ شما اضافه شد.", "ckb": "سەرکەوتوو بوویت. ئەم وانەیە زیادکرا.", "en": "Passed — this lesson is now on your record."},
    "failed": {"fa": "حدنصاب ۸۰٪ است. یک بار دیگر متن درس را بخوانید و دوباره امتحان کنید.",
               "ckb": "پێویستی بە ٨٠٪ هەیە. دیسان دەقی وانەکە بخوێنەوە و هەوڵ بدەرەوە.",
               "en": "The bar is 80%. Read the lesson again and retry."},
    "retry": {"fa": "🔁 آزمون دوباره", "ckb": "🔁 دووبارە", "en": "🔁 Retry quiz"},
    "read_first": {"fa": "اول متن درس", "ckb": "سەرەتا دەقی وانە", "en": "Read the lesson first"},
    "nfa": {"fa": "آموزشی است، توصیهٔ مالی نیست.", "ckb": "فێرکارییە، ئامۆژگاریی دارایی نییە.", "en": "Educational, not financial advice."},
}


def t(key, lang, **kw):
    d = T.get(key, {})
    s = d.get(lang) or d.get("en") or d.get("fa") or key
    return s.format(**kw) if kw else s


def num(n, lang):
    s = str(n)
    return s.translate(_FA_DIG) if lang == "fa" else s.translate(_AR_DIG) if lang in ("ckb", "ar") else s


def e(s):
    return html.escape(str(s or ""))


# ---------------------------------------------------------------- دادهٔ آکادمی
def data():
    """دانشکده‌ها و محتوای درس‌ها؛ یک بار خوانده و کش می‌شود."""
    if "f" in _CACHE:
        return _CACHE["f"], _CACHE["c"]
    try:
        import academy_data as AD
        _CACHE["f"], _CACHE["c"] = AD.FACULTIES, AD.load_content()
    except Exception:
        _CACHE["f"], _CACHE["c"] = [], {}
    return _CACHE["f"], _CACHE["c"]


def lessons_of(fid):
    _, content = data()
    return list(getattr(content.get(fid), "LESSONS", []) or [])


def courses_of(fid):
    _, content = data()
    return list(getattr(content.get(fid), "COURSES", []) or [])


def find_lesson(lid):
    fid = lid.split("-")[0]
    for L in lessons_of(fid):
        if L["id"] == lid:
            return fid, L
    return fid, None


def all_lessons():
    facs, _ = data()
    out = []
    for f in facs:
        out += [(f, L) for L in lessons_of(f["id"])]
    return out


def fac_of(fid):
    facs, _ = data()
    return next((f for f in facs if f["id"] == fid), None)


# ---------------------------------------------------------------- پیشرفت کاربر
def prog(x):
    p = x.setdefault("ac", {})
    p.setdefault("read", [])      # شناسهٔ درس‌هایی که متنشان خوانده شده
    p.setdefault("pass", [])      # درس‌هایی که آزمونشان قبول شده
    p.setdefault("last", "")      # آخرین درس باز‌شده
    p.setdefault("qi", {})        # وضعیت آزمون جاری: lid -> [درست‌ها, شمارهٔ سؤال]
    return p


def mark_read(x, lid):
    p = prog(x)
    if lid not in p["read"]:
        p["read"].append(lid)
    p["last"] = lid


# ---------------------------------------------------------------- نماها
def btn(text, data_):
    return {"text": text[:60], "callback_data": data_}


def faculties_view(x, lang):
    facs, _ = data()
    if not facs:
        return t("no_data", lang), [[btn(t("home", lang), "m:main")]]
    p = prog(x)
    done = len(p["read"])
    total = sum(len(lessons_of(f["id"])) for f in facs)
    out = [f"<b>🏛 {'آکادمی کریپتو انتخاب' if lang == 'fa' else 'Entekhab Crypto Academy'}</b>", "",
           t("pick_fac", lang), "",
           t("progress", lang, d=num(done, lang), t=num(total, lang), q=num(len(p["pass"]), lang))]
    rows = []
    if p["last"]:
        rows.append([btn(t("cont", lang), "ak:go")])
    pair = []
    for f in facs:
        n = len(lessons_of(f["id"]))
        if not n:
            continue
        mine = sum(1 for L in lessons_of(f["id"]) if L["id"] in p["read"])
        tag = f" {num(mine, lang)}/{num(n, lang)}" if mine else ""
        pair.append(btn(f'{f["icon"]} {f["title"] if lang == "fa" else f.get("en", f["title"])}{tag}', f'ak:c:{f["id"]}'))
        if len(pair) == 1:
            rows.append(pair)
            pair = []
    if pair:
        rows.append(pair)
    rows.append([btn(t("home", lang), "m:main")])
    return "\n".join(out), rows


def courses_view(x, fid, lang):
    f = fac_of(fid)
    ls = lessons_of(fid)
    if not f or not ls:
        return t("no_data", lang), [[btn(t("faclist", lang), "ak:f")]]
    p = prog(x)
    cs = {c["id"]: c for c in courses_of(fid)}
    out = [f'<b>{f["icon"]} {e(f["title"] if lang == "fa" else f.get("en", f["title"]))}</b>', ""]
    rows, cur = [], None
    for L in ls:
        if L["course"] != cur:
            cur = L["course"]
            c = cs.get(cur, {})
            out.append(f'\n<b>{e(c.get("title") or cur)}</b>')
        mark = "🏅" if L["id"] in p["pass"] else "✅" if L["id"] in p["read"] else "▫️"
        out.append(f'{mark} {e(L["title"])} · {num(L["minutes"], lang)}′')
        rows.append([btn(f'{mark} {L["title"]}', f'ak:l:{L["id"]}:b:0')])
    out += ["", t("nfa", lang)]
    rows.append([btn(t("faclist", lang), "ak:f"), btn(t("home", lang), "m:main")])
    return "\n".join(out), rows


def _pages(parts):
    """پاراگراف‌ها را به صفحه‌هایی زیر سقف پیام تلگرام تقسیم می‌کند."""
    pages, buf = [], ""
    for s in parts:
        if buf and len(buf) + len(s) + 2 > PAGE:
            pages.append(buf)
            buf = s
        else:
            buf = (buf + "\n\n" + s) if buf else s
    if buf:
        pages.append(buf)
    return pages or [""]


def _body(L, sec, lang):
    """متن یک بخش از درس، به‌صورت فهرست پاراگراف‌های آمادهٔ HTML تلگرام."""
    if sec in ("b", "i", "x"):
        key = {"b": "beginner", "i": "intermediate", "x": "expert"}[sec]
        return [e(p) for p in L.get(key, [])]
    if sec == "e":
        ex = L.get("example") or {}
        return [f'<b>{e(ex.get("title"))}</b>'] + [e(p) for p in ex.get("body", [])]
    if sec == "t":
        return [f'<b>{e(x["fa"])}</b> <i>{e(x["en"])}</i>\n{e(x["def"])}\n<i>{e(x["ex"])}</i>' for x in L.get("terms", [])]
    if sec == "k":
        return [f'🔑 {e(s)}' for s in L.get("key", [])]
    if sec == "m":
        return [f'⚠️ {e(s)}' for s in L.get("mistakes", [])]
    if sec == "w":
        ex = L.get("exercise") or {}
        steps = "\n".join(f"{num(i + 1, lang)}. {e(s)}" for i, s in enumerate(ex.get("steps", [])))
        return [f'<b>{e(ex.get("title"))}</b>', steps, f'<b>{t("check", lang)}:</b> {e(ex.get("check"))}']
    return []


def lesson_view(x, lid, sec, page, lang):
    fid, L = find_lesson(lid)
    if not L:
        return t("no_data", lang), [[btn(t("faclist", lang), "ak:f")]]
    mark_read(x, lid)
    pages = _pages(_body(L, sec, lang))
    page = max(0, min(page, len(pages) - 1))
    head = [f'<b>{e(L["title"])}</b>']
    if page == 0 and sec == "b":
        head.append(f'<i>{t("goal", lang)}:</i> {e(L["goal"])}')
    head.append(f'<i>{t("sec_" + sec, lang)}</i>'
                + (f'  ({num(page + 1, lang)}/{num(len(pages), lang)})' if len(pages) > 1 else ""))
    out = head + ["", pages[page]]
    if sec == "x" and page == len(pages) - 1:
        out += ["", f'<i>{t("mastery", lang)}:</i> {e(L.get("mastery"))}']

    rows = []
    nav = []
    if page > 0:
        nav.append(btn(t("prev", lang), f"ak:l:{lid}:{sec}:{page - 1}"))
    if page < len(pages) - 1:
        nav.append(btn(t("next", lang), f"ak:l:{lid}:{sec}:{page + 1}"))
    if nav:
        rows.append(nav)
    tabs = [s for s in ("b", "i", "x", "e", "t", "k", "m", "w") if _body(L, s, lang)]
    line = []
    for s in tabs:
        label = ("• " if s == sec else "") + t("sec_" + s, lang)
        line.append(btn(label, f"ak:l:{lid}:{s}:0"))
        if len(line) == 2:
            rows.append(line)
            line = []
    if line:
        rows.append(line)
    if L.get("quiz"):
        rows.append([btn(f'{t("quiz", lang)} ({num(len(L["quiz"]), lang)})', f"ak:q:{lid}:0")])

    ls = [y["id"] for y in lessons_of(fid)]
    i = ls.index(lid)
    jump = []
    if i > 0:
        jump.append(btn(t("plesson", lang), f"ak:l:{ls[i - 1]}:b:0"))
    if i < len(ls) - 1:
        jump.append(btn(t("nlesson", lang), f"ak:l:{ls[i + 1]}:b:0"))
    if jump:
        rows.append(jump)
    rows.append([{"text": t("onsite", lang), "url": f"{SITE}/academy/{fid}/{lid}/"}])
    rows.append([btn(t("back_fac", lang), f"ak:c:{fid}"), btn(t("home", lang), "m:main")])
    return "\n".join(out), rows


def quiz_view(x, lid, qi, lang, picked=None):
    fid, L = find_lesson(lid)
    q = (L or {}).get("quiz") or []
    if not q:
        return t("no_data", lang), [[btn(t("faclist", lang), "ak:f")]]
    p = prog(x)
    if qi == 0 and picked is None:
        p["qi"][lid] = [0, 0]
    if qi >= len(q):                                           # پایان آزمون
        correct = (p["qi"].get(lid) or [0, 0])[0]
        pct = round(correct / len(q) * 100)
        ok = correct / len(q) >= PASS
        if ok and lid not in p["pass"]:
            p["pass"].append(lid)
        out = [f'<b>{e(L["title"])}</b>', "",
               t("score", lang, c=num(correct, lang), n=num(len(q), lang), p=num(pct, lang)), "",
               t("passed" if ok else "failed", lang)]
        rows = [[btn(t("retry", lang), f"ak:q:{lid}:0")] if not ok else
                [btn(t("nlesson", lang), f"ak:c:{fid}")],
                [btn(t("back_fac", lang), f"ak:c:{fid}"), btn(t("home", lang), "m:main")]]
        return "\n".join(out), rows

    item = q[qi]
    out = [f'<b>{e(L["title"])}</b>', f'<i>{t("q_of", lang, i=num(qi + 1, lang), n=num(len(q), lang))}</i>', "",
           f'<b>{e(item["q"])}</b>']
    rows = []
    if picked is None:
        for j, o in enumerate(item["o"]):
            out.append(f'{num(j + 1, lang)}) {e(o)}')
            rows.append([btn(f'{num(j + 1, lang)}) {o}', f"ak:a:{lid}:{qi}:{j}")])
    else:
        right = picked == item["a"]
        st = p["qi"].setdefault(lid, [0, 0])
        if right:
            st[0] += 1
        for j, o in enumerate(item["o"]):
            tick = "✅" if j == item["a"] else ("❌" if j == picked else "▫️")
            out.append(f'{tick} {e(o)}')
        out += ["", t("right", lang) if right else t("wrong", lang, a=e(item["o"][item["a"]])),
                f'<i>{e(item.get("why"))}</i>']
        rows.append([btn(t("next", lang), f"ak:q:{lid}:{qi + 1}")])
    rows.append([btn(t("back_fac", lang), f"ak:c:{fid}"), btn(t("home", lang), "m:main")])
    return "\n".join(out), rows


def resume(x, lang):
    """ادامه از همان درسی که کاربر رها کرده بود."""
    p = prog(x)
    if p["last"] and find_lesson(p["last"])[1]:
        return lesson_view(x, p["last"], "b", 0, lang)
    al = all_lessons()
    return (lesson_view(x, al[0][1]["id"], "b", 0, lang) if al else faculties_view(x, lang))


def route(x, val, lang):
    """val همان بخش پس از «ak:» است؛ -> (متن، ردیف دکمه‌ها)"""
    parts = (val or "f").split(":")
    kind = parts[0] or "f"
    try:
        if kind == "c":
            return courses_view(x, parts[1], lang)
        if kind == "l":
            return lesson_view(x, parts[1], parts[2] if len(parts) > 2 else "b",
                               int(parts[3]) if len(parts) > 3 else 0, lang)
        if kind == "q":
            return quiz_view(x, parts[1], int(parts[2]), lang)
        if kind == "a":
            return quiz_view(x, parts[1], int(parts[2]), lang, picked=int(parts[3]))
        if kind == "go":
            return resume(x, lang)
    except (IndexError, ValueError):
        pass
    return faculties_view(x, lang)
