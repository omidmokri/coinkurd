#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CRYPTO MASTER ACADEMY — ساخت صفحات ثابت /academy/

  /academy/                       صفحهٔ اصلی: نقشهٔ راه ۱۲ دانشکده، جست‌وجو، سطح‌بندی، ادامهٔ مسیر
  /academy/<fid>/                 صفحهٔ دانشکده: دوره‌ها، درس‌ها، آزمون جامع، پروژهٔ عملی، گواهی
  /academy/<fid>/<lesson-id>/     درس: سه سطح توضیح، مثال واقعی، واژگان، تمرین، آزمون تطبیقی، پرسش تشریحی، دستیار
  /academy/me/                    داشبورد دانشجو
  /academy/review/                مرور هوشمند (تکرار فاصله‌دار)
  /academy/placement/             آزمون تعیین سطح
  /academy/glossary/              بانک اصطلاحات فارسی/انگلیسی
  /academy/lab/                   آزمایشگاه: شبیه‌ساز معامله، ماشین‌حساب‌ها، هش، امضا، تراکنش، ژورنال، بک‌تست
  /academy/data/*.json            بانک سؤال، نمایهٔ دستیار، کندل‌های پشتیبان (برای وقتی Binance در دسترس نیست)

پیشرفت هر دانشجو فقط در مرورگر خودش (localStorage) ذخیره می‌شود و قابل خروجی‌گرفتن/بازگردانی است.
اجرا:  python scripts/build_academy.py   (build_pages.py هم آن را صدا می‌زند)
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import academy_data as AD  # noqa: E402
import build_pages as BP  # noqa: E402

e = BP.e
SITE = BP.SITE
OUT = os.path.join(BP.ROOT, "academy")
VER = "1"
SECS = [("beginner", "🌱 توضیح ساده"), ("intermediate", "📘 توضیح متوسط"), ("expert", "🔬 توضیح تخصصی")]
SEC_FA = {"beginner": "توضیح ساده", "intermediate": "توضیح متوسط", "expert": "توضیح تخصصی", "example": "مثال واقعی",
          "key": "نکات کلیدی", "mistakes": "اشتباهات رایج"}
LV_FA = {n: fa for n, _, fa, _ in AD.LEVELS}
LV_EN = {n: en for n, en, _, _ in AD.LEVELS}
FADIG = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


def fa(n):
    return str(n).translate(FADIG)


HEAD = (f'<link rel="stylesheet" href="/assets/academy.css?v={VER}">'
        "<script>try{var t=JSON.parse(localStorage.getItem('ek_academy')||'{}').theme;if(t)document.documentElement.dataset.acTheme=t}catch(e){}</script>")


def foot_js(extra=""):
    return f'<script src="/assets/academy.js?v={VER}" defer></script>{extra}'


def topbar(crumbs):
    c = " / ".join(crumbs)
    return (f'<div class="meta">{c}</div>'
            '<div class="ac-top"><a class="ac-chip" href="/academy/">🏛 آکادمی</a><a class="ac-chip" href="/academy/me/">📊 داشبورد من</a>'
            '<a class="ac-chip" href="/academy/review/">🔁 مرور <b class="ac-due" hidden></b></a><a class="ac-chip" href="/academy/lab/">🧪 آزمایشگاه</a>'
            '<a class="ac-chip" href="/academy/glossary/">📖 اصطلاحات</a><button class="ac-chip" id="acTheme" type="button" aria-label="تغییر حالت روشن و تاریک">🌓</button></div>')


def ordered():
    """faculties with their content module, courses and lessons in teaching order"""
    content = AD.load_content()
    out = []
    for f in AD.FACULTIES:
        m = content.get(f["id"])
        courses = []
        if m:
            for c in m.COURSES:
                courses.append({**c, "lessons": [L for L in m.LESSONS if L["course"] == c["id"]]})
        out.append({**f, "mod": m, "courses": courses, "lessons": [L for c in courses for L in c["lessons"]]})
    return out


def acmap(F):
    """small map inlined into every academy page: unlock rules and navigation"""
    facs, lessons = [], []
    for f in F:
        facs.append({"id": f["id"], "n": f["n"], "t": f["title"], "i": f["icon"], "live": bool(f["mod"]),
                     "ls": [L["id"] for L in f["lessons"]]})
        for L in f["lessons"]:
            lessons.append({"id": L["id"], "f": f["id"], "t": L["title"], "lv": L["level"], "m": L["minutes"],
                            "pre": L.get("prereq", []), "u": f"/academy/{f['id']}/{L['id']}/", "nq": len(L["quiz"])})
    return {"facs": facs, "lessons": lessons, "pass": AD.PASS,
            "levels": [{"n": n, "en": en, "fa": fa_, "xp": xp} for n, en, fa_, xp in AD.LEVELS]}


def mapscript(M):
    return f'<script type="application/json" id="acMap">{BP.sj(M)}</script>'


def paras(ps):
    return "".join(f"<p>{e(p)}</p>" for p in ps)


# ------------------------------------------------------------------ lesson
def lesson_page(f, L, prev, nxt, M, pre_titles):
    lid = L["id"]
    tabs = "".join(f'<button type="button" role="tab" class="ac-tab" data-tab="{k}" aria-controls="{k}">{t}</button>' for k, t in SECS)
    panes = "".join(f'<section class="ac-pane" id="{k}" role="tabpanel" data-pane="{k}"><h3>{t}</h3>{paras(L[k])}</section>' for k, t in SECS)
    terms = "".join(f'<div class="ac-term" id="t-{i}"><b>{e(t["fa"])}</b> <span class="ac-en" dir="ltr">({e(t["en"])})</span>'
                    f'<p>{e(t["def"])}</p><p class="ac-ex">مثال: {e(t["ex"])}</p></div>' for i, t in enumerate(L["terms"]))
    ex = L["exercise"]
    tool = (f'<p><a class="ac-btn ghost" href="{e(ex["tool"])}">🧪 باز کردن ابزار مربوط</a></p>' if ex.get("tool") else "")
    pre = ("".join(f'<a class="ac-pre" data-pre="{p}" href="{e(next((x["u"] for x in M["lessons"] if x["id"] == p), "#"))}">{e(pre_titles.get(p, p))}</a>'
                   for p in L.get("prereq", [])) or "ندارد")
    src = "".join(f'<li><a href="{e(BP.su(s["u"]))}" rel="noopener nofollow" target="_blank">{e(s["t"])}</a></li>' for s in L["sources"])
    quiz = [{"q": q["q"], "o": q["o"], "a": q["a"], "why": q["why"], "sec": q["sec"], "k": q["kind"]} for q in L["quiz"]]
    nav = ""
    if prev:
        nav += f'<a class="ac-btn ghost" href="/academy/{prev[0]}/{prev[1]["id"]}/">→ {e(prev[1]["title"])}</a>'
    if nxt:
        nav += f'<a class="ac-btn ghost ac-next" href="/academy/{nxt[0]}/{nxt[1]["id"]}/">{e(nxt[1]["title"])} ←</a>'
    body = (
        topbar(['<a href="/academy/">آکادمی</a>', f'<a href="/academy/{f["id"]}/">{e(f["title"])}</a>', e(L["title"])])
        + f'<div id="ac" data-page="lesson" data-lid="{lid}" data-fid="{f["id"]}">'
        f'<p class="ac-kicker">{f["icon"]} دانشکدهٔ {fa(f["n"])} · {e(next(c["title"] for c in f["courses"] if c["id"] == L["course"]))}</p>'
        f'<h1>{e(L["title"])}</h1><p class="ac-en" dir="ltr">{e(L["en"])}</p>'
        f'<div class="ac-facts"><span>سطح {fa(L["level"])} · {LV_FA[L["level"]]} <small dir="ltr">({LV_EN[L["level"]]})</small></span>'
        f'<span>⏱ {fa(L["minutes"])} دقیقه</span><span>❓ {fa(len(L["quiz"]))} سؤال در بانک</span><span class="ac-state" id="acState"></span></div>'
        f'<div class="ac-lock" id="acLock" hidden></div>'
        f'<div class="ac-goal"><b>🎯 هدف آموزشی:</b> {e(L["goal"])}<br><b>پیش‌نیازها:</b> {pre}</div>'
        f'<nav class="ac-toc" aria-label="بخش‌های درس"><a href="#learn">آموزش</a><a href="#example">مثال واقعی</a><a href="#terms">واژگان</a>'
        f'<a href="#key">نکات کلیدی</a><a href="#mistakes">اشتباهات رایج</a><a href="#exercise">تمرین عملی</a><a href="#quiz">آزمون</a><a href="#essay">پرسش تشریحی</a><a href="#tutor">دستیار</a></nav>'
        f'<section id="learn"><h2>📚 آموزش در سه سطح</h2><p class="note">از سطح ساده شروع کنید؛ اگر روشن بود، سطح بعد را بخوانید. سطح مناسب شما ذخیره می‌شود.</p>'
        f'<div class="ac-tabs" role="tablist">{tabs}</div>{panes}</section>'
        f'<section id="example" class="ac-box"><h2>🌍 مثال واقعی: {e(L["example"]["title"])}</h2>{paras(L["example"]["body"])}</section>'
        f'<section id="terms"><h2>🔤 واژگان تخصصی</h2><div class="ac-terms">{terms}</div></section>'
        f'<section id="key"><h2>🔑 نکات کلیدی</h2><ul class="ac-list">{"".join(f"<li>{e(x)}</li>" for x in L["key"])}</ul></section>'
        f'<section id="mistakes"><h2>⚠️ اشتباهات رایج</h2><ul class="ac-list warn">{"".join(f"<li>{e(x)}</li>" for x in L["mistakes"])}</ul></section>'
        f'<section id="exercise" class="ac-box"><h2>🛠 تمرین عملی: {e(ex["title"])}</h2><ol class="ac-steps">{"".join(f"<li>{e(s)}</li>" for s in ex["steps"])}</ol>'
        f'<p><b>✅ معیار درستی:</b> {e(ex["check"])}</p>{tool}'
        f'<p class="ac-safe">🔒 در هیچ تمرینی از سرمایهٔ واقعی، عبارت بازیابی (Seed Phrase)، کلید خصوصی یا اتصال کیف پول اصلی استفاده نکنید.</p>'
        f'<label class="ac-check"><input type="checkbox" id="acEx"> تمرین را انجام دادم و با معیار بالا بررسی کردم</label></section>'
        f'<section id="quiz"><h2>📝 آزمون تطبیقی</h2><p class="note">هر بار ۵ سؤال از بانک {fa(len(L["quiz"]))} سؤالی این درس انتخاب می‌شود؛ سؤال‌هایی که قبلاً اشتباه زده‌اید زودتر برمی‌گردند. '
        f'حدنصاب قبولی {fa(int(AD.PASS * 100))}٪ (۴ از ۵) است و درس بعد با قبولی باز می‌شود.</p><div id="acQuiz" class="ac-quiz"></div></section>'
        f'<section id="essay" class="ac-box"><h2>✍️ پرسش تشریحی</h2><p><b>{e(L["essay"]["q"])}</b></p>'
        f'<textarea id="acEssay" rows="6" placeholder="پاسخ خود را اینجا بنویسید؛ فقط در مرورگر خودتان ذخیره می‌شود."></textarea>'
        f'<details class="ac-rub"><summary>بعد از نوشتن، پاسخ خود را با این معیارها بسنجید</summary><p class="note">خودارزیابی: هر نکته‌ای را که پاسخ شما به‌روشنی پوشش داده علامت بزنید.</p>'
        + "".join(f'<label class="ac-check"><input type="checkbox" class="acRub" data-i="{i}"> {e(r)}</label>' for i, r in enumerate(L["essay"]["rubric"]))
        + f'<p class="ac-out" id="acEssayOut"></p></details></section>'
        f'<section id="tutor" class="ac-box"><h2>🤖 دستیار آموزشی</h2><p class="note">دستیار آفلاین آکادمی: پاسخ‌ها فقط از متن درس‌ها و واژگان همین آکادمی پیدا می‌شوند و منبع هر پاسخ نشان داده می‌شود. '
        f'هوش مصنوعی مولد نیست، حدس نمی‌زند و هیچ سیگنال خرید و فروشی نمی‌دهد.</p>'
        f'<div class="ac-tutor"><div id="acChat" class="ac-chat" aria-live="polite"></div>'
        f'<form id="acAsk" class="ac-ask"><input id="acQ" maxlength="200" placeholder="مثلاً: فرق کلید عمومی و خصوصی چیست؟" autocomplete="off"><button class="ac-btn" type="submit">بپرس</button></form>'
        f'<div class="ac-quick"><button type="button" class="ac-chip" data-tq="simple">ساده‌تر توضیح بده</button><button type="button" class="ac-chip" data-tq="example">مثال بزن</button>'
        f'<button type="button" class="ac-chip" data-tq="quizme">از من سؤال بپرس</button><button type="button" class="ac-chip" data-tq="weak">نقطهٔ ضعف من چیست؟</button></div></div></section>'
        f'<section id="sources"><h2>📎 منابع مطالعاتی</h2><ul class="ac-list">{src}</ul>'
        f'<p class="ac-mastery"><b>🏁 معیار تسلط بر این درس:</b> {e(L["mastery"])}</p></section>'
        f'<div class="ac-nav">{nav}</div></div>'
        f'<script type="application/json" id="acQ0">{BP.sj(quiz)}</script>{mapscript(M)}'
    )
    ld = {"@context": "https://schema.org", "@type": "LearningResource", "name": L["title"], "inLanguage": "fa", "isAccessibleForFree": True,
          "educationalLevel": LV_EN[L["level"]], "timeRequired": f"PT{L['minutes']}M", "teaches": L["goal"],
          "isPartOf": {"@type": "Course", "name": f"CRYPTO MASTER ACADEMY — {f['title']}", "url": f"{SITE}/academy/{f['id']}/"},
          "provider": {"@type": "Organization", "name": "entekhab.net"}}
    return BP.page(f"academy/{f['id']}/{lid}/", f"{L['title']} — آکادمی کریپتو", L["goal"], body,
                   HEAD + f'<script type="application/ld+json">{BP.sj(ld)}</script>' + foot_js())


# ------------------------------------------------------------------ faculty
def faculty_page(f, M):
    if f["mod"]:
        cs = ""
        for c in f["courses"]:
            items = "".join(f'<li class="ac-li" data-lid="{L["id"]}"><a href="/academy/{f["id"]}/{L["id"]}/"><span class="ac-dot"></span>'
                            f'<span class="ac-lt">{e(L["title"])}</span><small>سطح {fa(L["level"])} · {fa(L["minutes"])} دقیقه</small><span class="ac-sc"></span></a></li>'
                            for L in c["lessons"])
            cs += f'<div class="ac-course"><h3>{e(c["title"])} <small class="ac-en" dir="ltr">{e(c.get("en", ""))}</small></h3><ul class="ac-ul">{items}</ul></div>'
        pj = f["mod"].PROJECT
        tool = f'<p><a class="ac-btn ghost" href="{e(pj["tool"])}">🧪 ابزار پروژه</a></p>' if pj.get("tool") else ""
        proj = (f'<section id="project" class="ac-box"><h2>🧩 پروژهٔ عملی: {e(pj["title"])}</h2><p>{e(pj["brief"])}</p>'
                f'<h3>خروجی‌های لازم</h3><ol class="ac-steps">{"".join(f"<li>{e(x)}</li>" for x in pj["deliverables"])}</ol>{tool}'
                f'<h3>تحویل و ارزیابی</h3><p class="note">گزارش یا خلاصهٔ پروژه را بنویسید (یا لینک سند خود را بگذارید)، سپس با معیارهای زیر خودارزیابی کنید. '
                f'پروژه وقتی پذیرفته می‌شود که همهٔ معیارها برقرار باشد. هرگز عبارت بازیابی، کلید خصوصی یا اطلاعات حساب را در گزارش ننویسید.</p>'
                f'<textarea id="acProj" rows="7" placeholder="گزارش پروژه یا لینک آن…"></textarea>'
                + "".join(f'<label class="ac-check"><input type="checkbox" class="acPR" data-i="{i}"> {e(r)}</label>' for i, r in enumerate(pj["rubric"]))
                + '<p><button class="ac-btn" id="acProjBtn" type="button">ثبت پروژه</button> <span class="ac-out" id="acProjOut"></span></p></section>')
        exam = ('<section id="exam" class="ac-box"><h2>🏛 آزمون جامع دانشکده</h2><p class="note">۱۵ سؤال تصادفی از همهٔ درس‌های دانشکده؛ حدنصاب قبولی ۸۰٪. '
                'بعد از تسلط بر همهٔ درس‌ها باز می‌شود. قبولی در این آزمون، دانشکدهٔ بعد را باز می‌کند.</p><div id="acExam" class="ac-quiz"></div></section>')
        cert = ('<section id="cert" class="ac-box"><h2>🏅 گواهی دانشکده</h2><div id="acCert"></div>'
                '<p class="note">گواهی درون‌سامانه‌ای entekhab.net است و مدرک رسمی یا مجوز حرفه‌ای محسوب نمی‌شود.</p></section>')
        bank = [{"l": L["id"], "i": i, "q": q["q"], "o": q["o"], "a": q["a"], "why": q["why"], "sec": q["sec"], "t": L["title"]}
                for L in f["lessons"] for i, q in enumerate(L["quiz"])]
        main = (f'<div class="pbar"><i id="acFacBar" style="width:0"></i></div><p class="note" id="acFacTxt"></p>'
                f'<h2>📚 دوره‌ها و درس‌ها</h2>{cs}{exam}{proj}{cert}'
                f'<script type="application/json" id="acBank">{BP.sj(bank)}</script>')
    else:
        pl = "".join(f'<div class="ac-course planned"><h3>{e(t)}</h3><ul class="ac-ul">{"".join(f"<li><span class=ac-dot></span> {e(x)}</li>" for x in ls)}</ul></div>'
                     for t, ls in f.get("planned", []))
        main = (f'<div class="ac-wip">🛠 محتوای کامل این دانشکده در حال تولید است. سرفصل‌های برنامه‌ریزی‌شده در زیر آمده است؛ '
                f'درس‌ها پس از تکمیل محتوای علمی، تمرین و آزمون منتشر می‌شوند. تا آن زمان می‌توانید از <a href="/academy/lab/">آزمایشگاه</a> استفاده کنید.</div>'
                f'<h2>🗺 سرفصل‌های برنامه‌ریزی‌شده</h2>{pl}')
    lo, hi = f["lv"]
    body = (topbar(['<a href="/academy/">آکادمی</a>', e(f["title"])])
            + f'<div id="ac" data-page="faculty" data-fid="{f["id"]}"><p class="ac-kicker">دانشکدهٔ {fa(f["n"])} از ۱۲</p>'
            f'<h1>{f["icon"]} {e(f["title"])}</h1><p class="ac-en" dir="ltr">{e(f["en"])}</p>'
            f'<div class="ac-facts"><span>سطح {fa(lo)} تا {fa(hi)} · {LV_FA[lo]} تا {LV_FA[hi]}</span>'
            + (f'<span>{fa(len(f["lessons"]))} درس</span><span>{fa(sum(len(L["quiz"]) for L in f["lessons"]))} سؤال</span>' if f["mod"] else '<span>در حال تولید</span>')
            + f'</div><div class="ac-lock" id="acLock" hidden></div><p class="txt">{e(f["summary"])}</p><div class="ac-goal"><b>🎯 خروجی دانشکده:</b> {e(f["outcome"])}</div>'
            f'{main}</div>{mapscript(M)}')
    return BP.page(f"academy/{f['id']}/", f"{f['title']} — آکادمی کریپتو entekhab", f["summary"], body, HEAD + foot_js())


# ------------------------------------------------------------------ home
def home_page(F, M):
    n_l = sum(len(f["lessons"]) for f in F)
    n_q = sum(len(L["quiz"]) for f in F for L in f["lessons"])
    rows = ""
    for f in F:
        lo, hi = f["lv"]
        st = f'{fa(len(f["lessons"]))} درس' if f["mod"] else "در حال تولید"
        rows += (f'<a class="ac-fac{"" if f["mod"] else " wip"}" data-fid="{f["id"]}" href="/academy/{f["id"]}/"><span class="ac-n">{fa(f["n"])}</span>'
                 f'<span class="ac-fi">{f["icon"]}</span><span class="ac-ft"><b>{e(f["title"])}</b><small>{e(f["outcome"])}</small></span>'
                 f'<span class="ac-fm"><small>سطح {fa(lo)} تا {fa(hi)} · {st}</small><span class="pbar"><i style="width:0"></i></span><span class="ac-fs"></span></span></a>')
    levels = "".join(f'<li data-lv="{n}"><b>{fa(n)}. {fa_}</b> <small dir="ltr">{en}</small></li>' for n, en, fa_, _ in AD.LEVELS)
    cycle = "".join(f"<li><b>{a}</b> {b}</li>" for a, b in [
        ("آموزش مفهومی", "در سه سطح ساده، متوسط و تخصصی"), ("مثال واقعی", "رویدادهای تاریخ‌دار و قابل بررسی"),
        ("دستیار آموزشی", "پرسش و پاسخ با ارجاع به متن درس"), ("تمرین عملی", "با ابزارهای آزمایشگاه و محیط آزمایشی"),
        ("آزمون تطبیقی", "سؤال‌های سناریومحور و محاسباتی"), ("تحلیل اشتباه", "توضیح هر پاسخ و بازگشت به بخش مربوط"),
        ("مجوز مرحلهٔ بعد", "فقط با کسب ۸۰٪ باز می‌شود")])
    body = (topbar(['<a href="/academy/">آکادمی</a>'])
            + '<div id="ac" data-page="home"><section class="ac-hero"><p class="ac-kicker">CRYPTO MASTER ACADEMY</p>'
            '<h1>آکادمی کریپتو؛ از صفر تا متخصص بازار دارایی‌های دیجیتال</h1>'
            '<p class="txt">یک مسیر دانشگاهی، مرحله‌ای و ارزیابی‌محور: می‌خوانید، تمرین می‌کنید، آزمون می‌دهید، در شبیه‌ساز با پول مجازی معامله می‌کنید و تا مهارتی را واقعاً یاد نگرفته‌اید، به مرحلهٔ بعد نمی‌روید. رایگان و بدون ثبت‌نام.</p>'
            f'<div class="ac-stats"><div><b>{fa(12)}</b><small>دانشکده</small></div><div><b>{fa(n_l)}</b><small>درس منتشرشده</small></div>'
            f'<div><b>{fa(n_q)}</b><small>سؤال آزمون</small></div><div><b>{fa(12)}</b><small>ابزار آزمایشگاه</small></div></div>'
            '<div class="ac-cta"><a class="ac-btn" id="acGo" href="/academy/f1/">شروع از درس اول</a><a class="ac-btn ghost" href="/academy/placement/">آزمون تعیین سطح</a>'
            '<a class="ac-btn ghost" href="/academy/me/">داشبورد من</a></div><p class="note" id="acHello"></p></section>'
            '<div class="ac-search"><input id="acSearch" type="search" placeholder="جست‌وجوی درس، مفهوم یا اصطلاح… (مثلاً هش، استیبل‌کوین، فیشینگ)" aria-label="جست‌وجو در درس‌ها"><div id="acSearchOut"></div></div>'
            f'<h2>🗺 نقشهٔ راه: ۱۲ دانشکده</h2><div class="ac-facs">{rows}</div>'
            f'<h2>🔄 چرخهٔ یادگیری هر درس</h2><ol class="ac-cycle">{cycle}</ol>'
            f'<h2>🪜 سطح‌بندی</h2><p class="note">ارتقای سطح فقط با شواهد یادگیری انجام می‌شود: امتیاز آزمون‌ها و پروژه‌ها، و تعداد دانشکده‌هایی که آزمون جامعشان را قبول شده‌اید.</p><ol class="ac-levels" id="acLevels">{levels}</ol>'
            '<div class="ac-box"><h2>🔒 اصل امنیت</h2><p>در تمام تمرین‌ها استفاده از سرمایهٔ واقعی، وارد کردن عبارت بازیابی یا کلید خصوصی و اتصال کیف پول اصلی ممنوع است. '
            'این آکادمی هرگز رمز، عبارت بازیابی یا کلید خصوصی شما را نمی‌خواهد. پیشرفت شما فقط در مرورگر خودتان ذخیره می‌شود؛ از داشبورد می‌توانید از آن نسخهٔ پشتیبان بگیرید.</p>'
            '<p class="note">آموزشی است و توصیهٔ مالی، سیگنال خرید و فروش یا وعدهٔ سود نیست.</p></div></div>'
            + mapscript(M))
    ld = {"@context": "https://schema.org", "@type": "Course", "name": "CRYPTO MASTER ACADEMY — آکادمی کریپتو entekhab.net",
          "description": "آموزش جامع و تعاملی ارزهای دیجیتال به فارسی، از صفر تا سطح تخصصی، با آزمون تطبیقی، تمرین عملی، شبیه‌ساز معامله و پروژه",
          "provider": {"@type": "Organization", "name": "entekhab.net", "sameAs": "https://t.me/Coin_Kurd"}, "inLanguage": "fa", "isAccessibleForFree": True,
          "hasCourseInstance": {"@type": "CourseInstance", "courseMode": "online", "courseWorkload": "PT40H"}}
    return BP.page("academy/", "آکادمی کریپتو — آموزش جامع ارز دیجیتال از صفر تا حرفه‌ای با آزمون و شبیه‌ساز",
                   "CRYPTO MASTER ACADEMY: ۱۲ دانشکده آموزش کریپتو به فارسی؛ بلاک‌چین، کیف پول و امنیت، تحلیل تکنیکال، فاندامنتال، آنچین و مدیریت ریسک با آزمون تطبیقی، تمرین عملی و شبیه‌ساز معامله",
                   body, HEAD + f'<script type="application/ld+json">{BP.sj(ld)}</script>' + foot_js())


def simple_page(path, title, desc, crumb, inner, M, extra=""):
    body = topbar(['<a href="/academy/">آکادمی</a>', e(crumb)]) + inner + mapscript(M)
    return BP.page(path, title, desc, body, HEAD + foot_js(extra))


def glossary_page(F, M):
    seen, cards = set(), []
    for f in F:
        for L in f["lessons"]:
            for t in L["terms"]:
                k = re.sub(r"\W+", "", t["en"].lower())
                if k in seen:
                    continue
                seen.add(k)
                cards.append((t["fa"], f'<div class="ac-term" data-s="{e((t["fa"] + " " + t["en"] + " " + t["def"]).lower())}"><b>{e(t["fa"])}</b> '
                                        f'<span class="ac-en" dir="ltr">({e(t["en"])})</span><p>{e(t["def"])}</p><p class="ac-ex">مثال: {e(t["ex"])}</p>'
                                        f'<a class="note" href="/academy/{f["id"]}/{L["id"]}/#terms">درس: {e(L["title"])}</a></div>'))
    cards.sort(key=lambda x: x[0])
    inner = (f'<div id="ac" data-page="glossary"><h1>📖 بانک اصطلاحات آکادمی</h1><p class="txt">{fa(len(cards))} اصطلاح فارسی و انگلیسی با تعریف دقیق و مثال کاربردی، هرکدام با پیوند به درسی که آن را آموزش می‌دهد. '
             f'واژه‌نامهٔ عمومی سایت هم در <a href="/glossary/">/glossary/</a> است.</p>'
             f'<input id="acGl" type="search" class="ac-in" placeholder="جست‌وجو به فارسی یا انگلیسی…"><p class="note" id="acGlN"></p>'
             f'<div class="ac-terms" id="acGlList">{"".join(c for _, c in cards)}</div></div>')
    return simple_page("academy/glossary/", "بانک اصطلاحات کریپتو فارسی و انگلیسی — آکادمی entekhab",
                       "اصطلاحات بلاک‌چین، رمزارز، کیف پول و بازار با نام فارسی و انگلیسی، تعریف دقیق و مثال", "اصطلاحات", inner, M)


def lab_page(M):
    import academy_lab as LAB
    return simple_page("academy/lab/", "آزمایشگاه آکادمی کریپتو — شبیه‌ساز معامله، ماشین‌حساب‌ها، هش، امضا و بک‌تست",
                       "شبیه‌ساز معامله با پول مجازی روی کندل‌های تاریخی بدون دیدن آینده، ماشین‌حساب اندازهٔ پوزیشن، ریسک به بازده، لیکوئید، کارمزد و توکنومیکس، آزمایشگاه هش و امضای دیجیتال، بررسی تراکنش واقعی و بک‌تست آموزشی",
                       "آزمایشگاه", LAB.HTML, M, f'<script src="/assets/academy-lab.js?v={VER}" defer></script>')


# ------------------------------------------------------------------ data files
def norm(t):
    t = t.replace("ي", "ی").replace("ك", "ک").replace("‌", " ").replace("ۀ", "ه").replace("ة", "ه")
    t = re.sub(r"[ً-ٰٟ]", "", t)
    return t


def write_json(name, obj):
    os.makedirs(os.path.join(OUT, "data"), exist_ok=True)
    with open(os.path.join(OUT, "data", name), "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))


def data_files(F):
    bank, idx = [], []
    for f in F:
        for L in f["lessons"]:
            u = f"/academy/{f['id']}/{L['id']}/"
            for i, q in enumerate(L["quiz"]):
                bank.append({"l": L["id"], "f": f["id"], "i": i, "q": q["q"], "o": q["o"], "a": q["a"], "why": q["why"], "sec": q["sec"], "k": q["kind"], "t": L["title"]})
            for k in ("beginner", "intermediate", "expert"):
                for p in L[k]:
                    idx.append({"l": L["id"], "s": k, "u": u + "#" + k, "t": L["title"], "x": p})
            for p in L["example"]["body"]:
                idx.append({"l": L["id"], "s": "example", "u": u + "#example", "t": L["title"], "x": p})
            for x in L["key"]:
                idx.append({"l": L["id"], "s": "key", "u": u + "#key", "t": L["title"], "x": x})
            for x in L["mistakes"]:
                idx.append({"l": L["id"], "s": "mistakes", "u": u + "#mistakes", "t": L["title"], "x": x})
            for t in L["terms"]:
                idx.append({"l": L["id"], "s": "term", "u": u + "#terms", "t": L["title"], "x": f'{t["fa"]} ({t["en"]}): {t["def"]} مثال: {t["ex"]}',
                            "term": [norm(t["fa"]).lower(), t["en"].lower()]})
    write_json("bank.json", bank)
    write_json("index.json", idx)
    return len(bank), len(idx)


def candles():
    """Fallback candles for the lab, fetched at build time (the browser tries Binance live first).
    Visitors whose network blocks Binance still get history served from entekhab.net itself."""
    try:
        import requests
    except Exception:  # noqa: BLE001
        return 0
    n = 0
    for sym in ("BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"):
        for iv in ("1d", "4h", "1h"):
            try:
                r = requests.get("https://data-api.binance.vision/api/v3/klines", params={"symbol": sym, "interval": iv, "limit": 1000}, timeout=20)
                r.raise_for_status()
                k = [[int(x[0]), float(x[1]), float(x[2]), float(x[3]), float(x[4]), round(float(x[5]), 3)] for x in r.json()]
                if len(k) > 100:
                    write_json(f"k_{sym}_{iv}.json", k)
                    n += 1
            except Exception as ex:  # noqa: BLE001
                print("academy candles:", sym, iv, ex)
                if not n:
                    return 0  # network unreachable — don't wait on every symbol
    return n


def build():
    F = ordered()
    M = acmap(F)
    urls = [home_page(F, M)]
    titles = {L["id"]: L["title"] for f in F for L in f["lessons"]}
    seq = [(f["id"], L) for f in F for L in f["lessons"]]
    for i, (fid, L) in enumerate(seq):
        f = next(x for x in F if x["id"] == fid)
        urls.append(lesson_page(f, L, seq[i - 1] if i else None, seq[i + 1] if i + 1 < len(seq) else None, M, titles))
    for f in F:
        urls.append(faculty_page(f, M))
    urls.append(simple_page("academy/me/", "داشبورد دانشجو — آکادمی کریپتو", "پیشرفت، نمرات، مهارت‌ها، نقاط ضعف، نشان‌ها و گواهی‌های شما در آکادمی کریپتو",
                            "داشبورد من", '<div id="ac" data-page="me"><h1>📊 داشبورد دانشجو</h1><div id="acMe"><p class="note">در حال بارگذاری…</p></div></div>', M))
    urls.append(simple_page("academy/review/", "مرور هوشمند — آکادمی کریپتو", "مرور فاصله‌دار سؤال‌هایی که اشتباه زده‌اید یا موعد تکرارشان رسیده است",
                            "مرور هوشمند", '<div id="ac" data-page="review"><h1>🔁 مرور هوشمند</h1><p class="txt">تکرار فاصله‌دار: سؤال‌هایی که اشتباه زده‌اید فوراً، و سؤال‌هایی که درست زده‌اید با فاصلهٔ ۱، ۳، ۷، ۱۶ و ۳۵ روز دوباره می‌آیند تا فراموش نشوند.</p><div id="acRev" class="ac-quiz"></div></div>', M))
    urls.append(simple_page("academy/placement/", "آزمون تعیین سطح — آکادمی کریپتو", "اگر از قبل با کریپتو آشنایید، با آزمون تعیین سطح دانشکده‌هایی را که بلدید رد کنید",
                            "آزمون تعیین سطح", '<div id="ac" data-page="placement"><h1>🧭 آزمون تعیین سطح</h1><p class="txt">برای هر دانشکدهٔ منتشرشده ۶ سؤال سناریومحور می‌آید. '
                            'اگر در یک دانشکده دست‌کم ۵ از ۶ پاسخ درست بدهید، آن دانشکده «معاف با آزمون» می‌شود و دانشکدهٔ بعدی باز می‌شود. '
                            'معافیت جای گواهی را نمی‌گیرد؛ برای گواهی باید آزمون جامع و پروژهٔ همان دانشکده را بگذرانید.</p><div id="acPl" class="ac-quiz"></div></div>', M))
    urls.append(glossary_page(F, M))
    urls.append(lab_page(M))
    nb, ni = data_files(F)
    nc = candles()
    print(f"academy pages: {len(urls)} · bank {nb} · index {ni} · candle files {nc}")
    return urls


if __name__ == "__main__":
    build()
