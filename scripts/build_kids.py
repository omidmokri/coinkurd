# -*- coding: utf-8 -*-
"""/kids/ — builds the children's and teenagers' academy.

Four pages plus one per world:
  /kids/            the map of worlds, the stars and the badges
  /kids/start/      pick an age group and a companion (nothing else is asked)
  /kids/<world>/    the lessons, the games and the quiz of one world
  /kids/parents/    what the academy teaches, what it stores, and how to use it

Lessons are written into the HTML in both age versions and all three languages, so the
page still says something to a search engine and to someone with JavaScript off; the
games and the quiz are drawn in the browser from the same data.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import academy_data as AD    # noqa: E402
import build_pages as BP     # noqa: E402
import build_reality as BR   # noqa: E402
import kids_data as KD       # noqa: E402
import kids_media as KM      # noqa: E402

ROOT = BP.ROOT
SITE = BP.SITE
e = BP.e
VER = "1"
HEAD = (f'<link rel="stylesheet" href="/assets/kids.css?v={VER}">'
        f'<link rel="stylesheet" href="/assets/kids-film.css?v={VER}">')
FOOT = (f'<script src="/assets/kids-sound.js?v={VER}" defer></script>'
        f'<script src="/assets/kids-film.js?v={VER}" defer></script>'
        f'<script src="/assets/kids.js?v={VER}" defer></script>')


def media_payload(eps=(), songs=()):
    """the shorts and the songs a page needs, with their music inlined"""
    E = {}
    for ep in eps:
        d = {k: v for k, v in ep.items() if k != "music"}
        d["music"] = KM.THEMES.get(ep["music"])
        E[ep["id"]] = d
    G = {}
    for sg in songs:
        d = {k: v for k, v in sg.items() if k != "music"}
        d["music"] = KM.THEMES.get(sg["music"])
        G[sg["id"]] = d
    return {"eps": E, "songs": G}


def storyboard(ep):
    """the same episode in words — a text alternative, and a shot list to hand to a studio"""
    rows = []
    for n, sc in enumerate(ep["scenes"], 1):
        who = "، ".join(KM.CAST_NAMES.get(c["who"], c["who"]) for c in sc["cast"])
        says = " ".join(f'<i>{e(l["t"][0])}</i>' for l in sc["lines"])
        rows.append(f'<li><b>{n}.</b> {e(sc["bg"])} · {e(who)} · '
                    f'{"زوم" if (sc.get("cam") or [1])[0] != 1 else "ثابت"} — {says}</li>')
    return (f'<details class="kf-sb"><summary>'
            + tri("سناریو و استوری‌بورد (متنِ همین انیمیشن)",
                  "سیناریۆ و ستۆریبۆرد (دەقی هەمان ئەنیمەیشن)",
                  "Script and storyboard (this animation, in words)")
            + f'</summary><ol>{"".join(rows)}</ol></details>')


def tri(fa, ckb, en, tag="span"):
    return (f'<{tag} data-lang="fa">{fa}</{tag}><{tag} data-lang="ckb" hidden>{ckb}</{tag}>'
            f'<{tag} data-lang="en" hidden dir="ltr">{en}</{tag}>')


def t3(v, tag="span"):
    return tri(e(v[0]), e(v[1]), e(v[2]), tag)


def U(k, tag="span"):
    return t3(KD.UI[k], tag)


def shell(body, extra=""):
    return (HEAD + FOOT + f"<style>{BP.LEARN_CSS}</style>" + extra
            + f"<script>document.addEventListener('DOMContentLoaded',function(){{{BP.LANG_JS}}})</script>")


def me_bar():
    """who you are, your stars, and the sound switch — filled in by the browser"""
    return ('<div class="kd-me" id="kdMe"><span class="av">🦊</span><b class="who">—</b>'
            '<span class="kd-sp"><span class="kd-st">⭐ 0</span>'
            '<button class="kd-chip kd-snd" type="button" aria-label="sound">🔊</button>'
            f'<a class="kd-chip" href="/kids/start/">{U("change")}</a>'
            f'<a class="kd-chip" href="/kids/parents/">{U("parents")}</a></span></div>')


def rest_box():
    return ('<div class="kd-rest" id="kdRest">' + U("rest")
            + f'<div><button class="kd-btn" type="button">{U("done")}</button></div></div>')


def ui_payload():
    keys = ("right", "wrong", "next", "again", "score", "of", "done", "cont", "moves",
            "g_match", "g_sort", "g_mem", "g_path", "tap_pair", "check", "locked")
    return {k: list(KD.UI[k]) for k in keys}


# ------------------------------------------------------------------ pages
def page_start():
    ages = "".join(
        f'<button class="kd-age" type="button" data-a="{e(a["id"])}" aria-pressed="false">'
        f'<i>{a["icon"]}</i>{t3(a["t"], "b")}<small>{t3(a["r"])}</small></button>'
        for a in KD.AGES)
    avs = "".join(
        f'<button class="kd-av" type="button" data-v="{e(i)}" aria-pressed="false" style="--c:{c}">'
        f'<i>{ic}</i><small>{t3(n)}</small></button>'
        for i, ic, n, c in KD.AVATARS)
    body = (f'<div class="kd" data-age="kid"><div class="kd-set" id="kdSet">'
            f'<h1>{U("t")}</h1>{BP.LSW}'
            f'<p class="lead">{U("lead")}</p>'
            f'<div class="kd-step"><b>{U("pick_age")}</b><div class="kd-ages">{ages}</div></div>'
            f'<div class="kd-step"><b>{U("pick_av")}</b><div class="kd-avs">{avs}</div></div>'
            f'<div class="kd-step"><b>{U("pick_nm")}</b>'
            f'<input class="kd-nm" id="kdNm" maxlength="24" autocomplete="off" '
            f'placeholder="{e(KD.UI["nm_ph"][0])}" data-ph-fa="{e(KD.UI["nm_ph"][0])}" '
            f'data-ph-ckb="{e(KD.UI["nm_ph"][1])}" data-ph-en="{e(KD.UI["nm_ph"][2])}"></div>'
            f'<button class="kd-go" id="kdGo" type="button" data-next="/kids/" disabled>{U("start")}</button>'
            f'<p class="kd-note">{U("privacy")}</p></div></div>'
            f'<script type="application/json" id="kdAvs">{BP.sj([[i, ic, list(n), c] for i, ic, n, c in KD.AVATARS])}</script>'
            f'<script type="application/json" id="kdUI">{BP.sj(ui_payload())}</script>')
    return BP.page("kids/start/", "شروع آکادمی کودکان و نوجوانان — entekhab",
                   KD.UI["lead"][0], body, shell(""))


BADGES = [
    ("money:quiz", "🪙", ("قهرمان پول", "پاڵەوانی پارە", "Money champion")),
    ("chain:quiz", "⛓️", ("قهرمان بلاک‌چین", "پاڵەوانی بلۆکچەین", "Blockchain champion")),
    ("safe:quiz", "🛡️", ("نگهبان", "پاسەوان", "Guardian")),
    ("chart:quiz", "📈", ("نمودارخوان", "هێڵکاری‌خوێن", "Chart reader")),
]


def page_hub():
    cards, payload = [], []
    for w in KD.WORLDS:
        items = [l["id"] for l in w["lessons"]] + [g["id"] for g in w["games"]] + ["quiz"]
        payload.append({"id": w["id"], "items": items})
        cards.append(
            f'<a class="kd-w" data-w="{e(w["id"])}" href="/kids/{e(w["id"])}/" style="--c:{w["c"]}">'
            f'<i>{w["icon"]}</i>{t3(w["t"], "h3")}<p>{t3(w["lead"])}</p>'
            f'<span class="kd-bar"><i></i></span>'
            f'<span class="kd-n"><span class="kd-pc">0/{len(items)}</span>'
            f'<span>{U("lessons")} · {U("games")} · {U("quiz")}</span></span></a>')
    badges = "".join(
        f'<div class="kd-badge" data-b="{e(k)}"><i>{ic}</i><small>{t3(n)}</small></div>'
        for k, ic, n in BADGES)
    body = (f'<div class="kd" data-age="kid" id="kdHub">'
            f'<h1>{U("t")}</h1>{BP.LSW}<p class="lead">{U("lead")}</p>'
            f'{me_bar()}'
            f'<div class="kd-bar" style="margin:0 0 14px">'
            f'<button class="kd-chip" id="kdTheme" type="button" data-theme="academy">'
            + tri("🎵 آهنگ آکادمی", "🎵 ئاوازی ئەکادیمیا", "🎵 The academy theme") + "</button>"
            f'<a class="kd-chip" href="/kids/studio/">'
            + tri("🎬 استودیوی انیمیشن و موسیقی", "🎬 ستۆدیۆی ئەنیمەیشن و مۆسیقا",
                  "🎬 Animation &amp; Music Studio") + "</a></div>"
            f'<h2>{U("worlds")}</h2><div class="kd-grid">{"".join(cards)}</div>'
            f'<h2 style="margin-top:26px">{U("badges")}</h2>'
            f'<div class="kd-badges" id="kdBadges">{badges}</div>'
            f'<p class="kd-note">{U("note")}<br>{U("privacy")}</p></div>'
            f'{rest_box()}'
            f'<script type="application/json" id="kdWorlds">{BP.sj(payload)}</script>'
            f'<script type="application/json" id="kdMedia">{BP.sj({"music": {"academy": KM.THEMES["academy"]}})}</script>'
            f'<script type="application/json" id="kdAvs">{BP.sj([[i, ic, list(n), c] for i, ic, n, c in KD.AVATARS])}</script>'
            f'<script type="application/json" id="kdUI">{BP.sj(ui_payload())}</script>')
    ld = {"@context": "https://schema.org", "@type": "Course", "name": KD.UI["t"][0],
          "description": KD.UI["lead"][0], "url": f"{SITE}/kids/", "inLanguage": ["fa", "ckb", "en"],
          "isAccessibleForFree": True, "typicalAgeRange": "6-18",
          "provider": {"@type": "Organization", "name": "entekhab.net", "url": SITE},
          "hasPart": [{"@type": "Course", "name": w["t"][0], "url": f"{SITE}/kids/{w['id']}/",
                       "description": w["lead"][0],
                       "provider": {"@type": "Organization", "name": "entekhab.net"}} for w in KD.WORLDS]}
    return BP.page("kids/", "آکادمی کودکان و نوجوانان — پول، بلاک‌چین و نمودار با بازی",
                   KD.UI["lead"][0], body,
                   shell(f'<script type="application/ld+json">{BP.sj(ld)}</script>'))


def page_world(w, prev_w, next_w):
    fac = next((f for f in AD.FACULTIES if f["id"] == w["from"]), None)
    eps = [x for x in KM.EPISODES if x["world"] == w["id"]]
    sgs = [x for x in KM.SONGS if x["world"] == w["id"]]
    dots, secs = [], []
    for ep in eps:
        dots.append(f'<a class="kd-dot" data-k="film:{e(ep["id"])}" href="#{e(ep["id"])}">🎬</a>')
        secs.append(
            f'<section class="kd-game" id="{e(ep["id"])}">'
            f'<h2><span>🎬</span>{t3(ep["t"])}</h2>'
            f'<p class="how">{t3(ep["logline"])}</p>'
            f'<div data-ep="{e(ep["id"])}"></div>{storyboard(ep)}</section>')
    for sg in sgs:
        dots.append(f'<a class="kd-dot" data-k="song:{e(sg["id"])}" href="#{e(sg["id"])}">🎵</a>')
        secs.append(
            f'<section class="kf-song" id="{e(sg["id"])}">'
            f'<h3>{sg["icon"]} {t3(sg["t"])}</h3>'
            f'<p class="meta">{t3(sg["goal"])}<br>{t3(sg["style"])} · {t3(sg["inst"])}</p>'
            f'<div data-song="{e(sg["id"])}"></div></section>')
    for i, l in enumerate(w["lessons"], 1):
        dots.append(f'<a class="kd-dot" data-k="{e(l["id"])}" href="#{e(l["id"])}">{i}</a>')
        secs.append(
            f'<section class="kd-les" id="{e(l["id"])}" data-les="{e(l["id"])}">'
            f'<h2><span>{l["icon"]}</span>{t3(l["t"])}</h2>'
            f'<p data-for="kid">{t3(l["kid"])}</p>'
            f'<p data-for="teen">{t3(l["teen"])}</p>'
            f'<p class="kd-key">{U("key", "b")}{t3(l["key"])}</p>'
            f'<div class="kd-nav"><span></span>'
            f'<button class="kd-btn pri kd-read" type="button">{KD.UI["cont"][0]}</button></div></section>')
    for g in w["games"]:
        dots.append(f'<a class="kd-dot" data-k="{e(g["id"])}" href="#{e(g["id"])}">🎮</a>')
        secs.append(f'<section class="kd-game" id="{e(g["id"])}">'
                    f'<h2><span>🎮</span>{t3(g["t"])}</h2><div id="g-{e(g["id"])}"></div></section>')
    dots.append('<a class="kd-dot" data-k="quiz" href="#quiz">🏁</a>')
    secs.append(f'<section class="kd-q" id="quiz"><h2 style="margin:0 0 12px;font-size:1.15rem">'
                f'<span>🏁</span> {U("quiz")}</h2><div id="kdQuiz"></div></section>')

    nav = '<nav class="kd-nav" style="margin-top:20px">'
    nav += (f'<a class="kd-btn" href="/kids/{e(prev_w["id"])}/">← {t3(prev_w["t"])}</a>'
            if prev_w else '<span></span>')
    nav += f'<a class="kd-btn" href="/kids/">{U("map")}</a>'
    nav += (f'<a class="kd-btn" href="/kids/{e(next_w["id"])}/">{t3(next_w["t"])} →</a>'
            if next_w else '<span></span>')
    nav += "</nav>"
    grown = ""
    if fac:
        grown = (f'<p class="kd-note">{U("from_fac")} '
                 f'<a href="/map/{e(fac["id"])}/">{e(fac["title"])}</a></p>')

    payload = {"id": w["id"],
               "games": [{k: v for k, v in g.items()} for g in w["games"]],
               "quiz": w["quiz"]}
    body = (f'<div class="kd" data-age="kid" id="kdWorld">'
            f'<div class="meta"><a href="/kids/">{U("t")}</a> / {t3(w["t"])}</div>'
            f'{BP.LSW}<h1><span>{w["icon"]}</span> {t3(w["t"])}</h1>'
            f'<p class="lead">{t3(w["lead"])}</p>{me_bar()}'
            f'<div class="kd-steps">{"".join(dots)}</div>'
            f'{"".join(secs)}{nav}{grown}'
            f'<p class="kd-note">{U("note")}</p></div>{rest_box()}'
            f'<script type="application/json" id="kdW">{BP.sj(payload)}</script>'
            f'<script type="application/json" id="kdMedia">{BP.sj(media_payload(eps, sgs))}</script>'
            f'<script type="application/json" id="kdAvs">{BP.sj([[i, ic, list(n), c] for i, ic, n, c in KD.AVATARS])}</script>'
            f'<script type="application/json" id="kdUI">{BP.sj(ui_payload())}</script>')
    return BP.page(f"kids/{w['id']}/", f"{w['t'][0]} — آکادمی کودکان و نوجوانان entekhab",
                   w["lead"][0], body, shell(""))


PARENT = {
 "t": ("صفحهٔ والدین و آموزگاران", "پەڕەی دایک و باوک و مامۆستایان", "For parents and teachers"),
 "secs": [
  (("این آکادمی چه چیزی یاد می‌دهد؟", "ئەم ئەکادیمیایە چی فێر دەکات؟", "What this academy teaches"),
   ("چهار دنیا: پول و قیمت، بلاک‌چین و رمزنگاری، امنیت و کلاهبرداری، و خواندن نمودار. هر دنیا سه درس، دو بازی و یک آزمون دارد و هر درس دو نسخه دارد: یکی برای ۶ تا ۱۲ سال و یکی برای ۱۳ تا ۱۸ سال. همهٔ مطالب از درس‌های آکادمی اصلی همین سایت ساده‌سازی شده‌اند.",
    "چوار جیهان: پارە و نرخ، بلۆکچەین و نهێنینووسین، ئاسایش و فێڵ، و خوێندنەوەی هێڵکاری. هەر جیهانێک سێ وانە، دوو یاری و یەک تاقیکردنەوەی هەیە و هەر وانەیەک دوو وەشانی هەیە: یەکێک بۆ ٦ تا ١٢ ساڵ و یەکێک بۆ ١٣ تا ١٨ ساڵ. هەموو بابەتەکان لە وانەکانی ئەکادیمیای سەرەکیی هەمان ماڵپەڕەوە ساکارکراون.",
    "Four worlds: money and prices, blockchains and cryptography, security and scams, and reading a chart. Each world has three lessons, two games and a quiz, and each lesson is written twice — once for ages 6-12 and once for 13-18. Every topic is a simplified door into a lesson of this site's main academy.")),
  (("چه چیزی ذخیره می‌شود؟", "چی هەڵدەگیرێت؟", "What is stored"),
   ("فقط سه چیز و فقط در همین مرورگر: گروه سنی، همراهِ انتخاب‌شده، و نام کوچکی که کودک خودش می‌نویسد (اختیاری است و می‌تواند خالی بماند) به‌همراه ستاره‌ها و درس‌های تمام‌شده. هیچ حسابی ساخته نمی‌شود، هیچ چیزی به سروری فرستاده نمی‌شود، و پاک‌کردن داده‌های مرورگر همه‌چیز را پاک می‌کند. هیچ سؤالی دربارهٔ جنسیت، مدرسه، شهر یا راه تماس پرسیده نمی‌شود.",
    "تەنها سێ شت و تەنها لەم وێبگەڕەدا: گرووپی تەمەن، هاوڕێی هەڵبژێردراو، و ناوێکی بچووک کە منداڵەکە خۆی دەینووسێت (ئارەزوومەندانەیە و دەتوانێت بەتاڵ بمێنێتەوە) لەگەڵ ئەستێرەکان و وانە تەواوکراوەکان. هیچ هەژمارێک دروست ناکرێت، هیچ شتێک بۆ ڕاژەیەک نانێردرێت، و سڕینەوەی داتای وێبگەڕ هەموو شتێک دەسڕێتەوە. هیچ پرسیارێک دەربارەی ڕەگەز، قوتابخانە، شار یان ڕێگای پەیوەندی ناکرێت.",
    "Three things only, and only in this browser: the age group, the chosen companion, and a first name the child types (optional — it can stay empty), along with the stars and the finished lessons. No account is created, nothing is sent to a server, and clearing the browser's data clears all of it. Nothing is asked about gender, school, city or any way to contact the child.")),
  (("دربارهٔ انتخاب همراه", "دەربارەی هەڵبژاردنی هاوڕێ", "About the companion"),
   ("به‌جای پرسیدن جنسیت، کودک یک همراه و یک رنگ انتخاب می‌کند. دلیلش دو چیز است: جنسیت کودک دادهٔ شخصی است و لازم نیست ذخیره شود، و مسیر آموزشی هم نباید بر اساس آن تغییر کند. هر کودکی به همهٔ درس‌ها و همهٔ بازی‌ها دسترسی یکسان دارد.",
    "لەبری پرسینی ڕەگەز، منداڵەکە هاوڕێیەک و ڕەنگێک هەڵدەبژێرێت. هۆکارەکەی دوو شتە: ڕەگەزی منداڵ داتایەکی کەسییە و پێویست ناکات هەڵبگیرێت، و ڕێڕەوی فێرکاریش نابێت لەسەر بنەمای ئەو بگۆڕێت. هەر منداڵێک دەستڕاگەیشتنی وەک یەکی بۆ هەموو وانە و هەموو یارییەکان هەیە.",
    "Instead of asking for gender, the child picks a companion and a colour. Two reasons: a child's gender is personal data that does not need storing, and the learning path should not change because of it. Every child gets the same lessons and the same games.")),
  (("زمان استفاده", "کاتی بەکارهێنان", "Screen time"),
   ("بعد از بیست دقیقه، یادآوری دوستانه‌ای روی صفحه ظاهر می‌شود که کمی استراحت کند. محدودیت سخت‌گیرانه‌تر از این را بهتر است در تنظیمات دستگاه یا کنترل والدین سیستم‌عامل بگذارید، چون آن‌ها قابل دور زدن نیستند.",
    "دوای بیست خولەک، بیرخستنەوەیەکی دۆستانە لەسەر پەڕەکە دەردەکەوێت کە کەمێک بحەسێتەوە. سنووردارکردنی توندتر لەمە باشترە لە ڕێکخستنەکانی ئامێر یان کۆنتڕۆڵی دایک و باوکی سیستەمەکەدا دابنێیت، چونکە ئەوانە ناکرێت بەلایاندا بچیتەوە.",
    "After twenty minutes a friendly reminder appears on the page suggesting a break. For a firmer limit, use the device's own settings or the operating system's parental controls — those cannot be bypassed from a web page.")),
  (("چه چیزی اینجا نیست", "چی لێرە نییە", "What is not here"),
   ("هیچ توصیهٔ خرید و فروش، هیچ قیمت زنده، هیچ لینک صرافی، هیچ تبلیغ و هیچ چیزی برای فروش. هدف فهمیدن است، نه معامله‌کردن. اگر نوجوانی بخواهد جلوتر برود، مسیر بعدی‌اش آکادمی اصلی همین سایت است که در پایان هر دنیا لینک شده.",
    "هیچ ئامۆژگاریی کڕین و فرۆشتن، هیچ نرخی زیندوو، هیچ بەستەری بۆرسە، هیچ ڕیکلام و هیچ شتێک بۆ فرۆشتن. ئامانج تێگەیشتنە، نەک مامەڵەکردن. ئەگەر هەرزەکارێک بیەوێت پێشتر بچێت، ڕێڕەوی دواتری ئەکادیمیای سەرەکیی هەمان ماڵپەڕە کە لە کۆتایی هەر جیهانێکدا بەستراوە.",
    "No buy-or-sell advice, no live prices, no exchange links, no advertising and nothing for sale. The aim is understanding, not trading. A teenager who wants to go further is pointed at this site's main academy, linked at the end of each world.")),
 ],
}


def page_parents():
    secs = "".join(f'<section class="kd-les">{t3(h, "h2")}<p>{t3(b)}</p></section>'
                   for h, b in PARENT["secs"])
    body = (f'<div class="kd" data-age="teen">'
            f'<div class="meta"><a href="/kids/">{U("t")}</a> / {t3(PARENT["t"])}</div>'
            f'{BP.LSW}<h1>{t3(PARENT["t"])}</h1>{secs}'
            f'<p class="kd-note">{U("note")}</p>'
            f'<div class="kd-nav"><a class="kd-btn" href="/kids/">{U("map")}</a></div></div>')
    return BP.page("kids/parents/", "صفحهٔ والدین — آکادمی کودکان و نوجوانان entekhab",
                   PARENT["secs"][1][1][0][:155], body, shell(""))



STUDIO = {
 "t": ("استودیوی انیمیشن و موسیقی", "ستۆدیۆی ئەنیمەیشن و مۆسیقا", "Animation & Music Studio"),
 "lead": ("فیلم‌های کوتاه، ترانه‌های اختصاصی و شخصیت‌های آکادمی — همه در همین صفحه پخش می‌شوند.",
          "فیلمە کورتەکان، گۆرانییە تایبەتەکان و کەسایەتییەکانی ئەکادیمیا — هەموویان لەم پەڕەیەدا دەخرێنە کار.",
          "The short films, the academy's own songs and its cast — all of them play right here."),
 "how": ("هیچ فایل ویدئویی یا صوتی روی این صفحه نیست. انیمیشن‌ها SVG هستند که مرورگر حرکتشان می‌دهد، "
         "و موسیقی نت‌به‌نت در همان لحظه ساخته می‌شود. برای همین هر فیلم به هر سه زبان پخش می‌شود، "
         "روی اینترنت کند هم باز می‌شود، و هیچ موسیقی‌ای از کسی قرض گرفته نشده است.",
         "هیچ فایلێکی ڤیدیۆ یان دەنگ لەم پەڕەیەدا نییە. ئەنیمەیشنەکان SVG ن کە وێبگەڕ دەیانجوڵێنێت، "
         "و مۆسیقا نۆتە بە نۆتە لە هەمان ساتدا دروست دەبێت. لەبەر ئەوە هەر فیلمێک بە هەر سێ زمان دەخرێتە کار، "
         "لەسەر ئینتەرنێتی خاویش دەکرێتەوە، و هیچ مۆسیقایەک لە کەس بە قەرز وەرنەگیراوە.",
         "There is not one video or audio file on this page. The animations are SVG that the browser moves, "
         "and the music is synthesised note by note as it plays. That is why every film runs in all three "
         "languages, opens on a slow connection, and borrows no music from anyone."),
 "films": ("فیلم‌های کوتاه", "فیلمە کورتەکان", "The short films"),
 "songs": ("ترانه‌ها", "گۆرانییەکان", "The songs"),
 "cast": ("شخصیت‌های آکادمی", "کەسایەتییەکانی ئەکادیمیا", "The cast"),
 "who": {
  "roj": (("رۆژ، روباه راهنما", "ڕۆژ، ڕێوییە ڕێنوێن", "Roj, the guide fox"),
          ("صبور و شوخ. سؤال می‌پرسد تا خودت جواب را پیدا کنی.",
           "ئارامگر و گاڵتەجاڕ. پرسیار دەکات تا خۆت وەڵامەکە بدۆزیتەوە.",
           "Patient and playful. Asks questions so you find the answer yourself.")),
  "aso": (("ئاسۆ، جغد معلم", "ئاسۆ، کوندەپەپووی مامۆستا", "Aso, the teacher owl"),
          ("دقیق و آرام. چیزهای سخت را به تکه‌های کوچک می‌شکند.",
           "وردبین و ئارام. شتە قورسەکان دەکات بە پارچەی بچووک.",
           "Precise and calm. Breaks hard things into small pieces.")),
  "zip": (("زیپ، ربات کنجکاو", "زیپ، ڕۆبۆتی حەزلێکەر", "Zip, the curious robot"),
          ("همان کسی است که سؤال‌های شما را می‌پرسد — و گاهی اشتباه می‌کند.",
           "هەر ئەو کەسەیە کە پرسیارەکانی ئێوە دەکات — و هەندێک جار هەڵە دەکات.",
           "The one who asks your questions — and sometimes gets it wrong.")),
  "fel": (("فێڵباز، شیّاد داستان", "فێڵباز، فێڵبازی چیرۆک", "The Trickster"),
          ("شخصیت منفی مهربانِ داستان: هر بار یک ترفند کلاهبرداری واقعی را نشان می‌دهد.",
           "کەسایەتیی خراپی میهرەبانی چیرۆک: هەر جارێک فێڵێکی ڕاستەقینە نیشان دەدات.",
           "The story's gentle villain: each time he demonstrates one real scam trick.")),
 },
 "prod": ("می‌خواهید نسخهٔ ویدئویی بسازید؟", "دەتانەوێت وەشانی ڤیدیۆیی دروست بکەن؟",
          "Want to make a video version?"),
 "prodtxt": ("زیر هر فیلم، «سناریو و استوری‌بورد» را باز کنید: صحنه‌به‌صحنه، با محیط، شخصیت‌ها، "
             "حرکت دوربین و همهٔ دیالوگ‌ها. متن کامل ترانه‌ها هم زیر هر آهنگ هست. این‌ها دقیقاً همان "
             "چیزی است که یک استودیو یا یک ابزار ویدئوسازی برای ساخت نسخهٔ فیلم لازم دارد.",
             "لە ژێر هەر فیلمێکدا، «سیناریۆ و ستۆریبۆرد» بکەرەوە: دیمەن بە دیمەن، بە ژینگە، کەسایەتییەکان، "
             "جووڵەی کامێرا و هەموو دیالۆگەکان. دەقی تەواوی گۆرانییەکانیش لە ژێر هەر ئاوازێکدایە. ئەمانە "
             "هەر ئەو شتەن کە ستۆدیۆیەک یان ئامرازێکی ڤیدیۆسازی پێویستیەتی.",
             "Under each film, open “Script and storyboard”: scene by scene, with the set, the cast, the "
             "camera move and every line of dialogue. The full lyrics sit under each song. That is exactly "
             "what a studio, or a video tool, needs to shoot a filmed version."),
}


def page_studio():
    films = "".join(
        f'<section class="kd-game" id="{e(ep["id"])}">'
        f'<h2><span>{ep["icon"]}</span>{t3(ep["t"])}</h2>'
        f'<p class="how">{t3(ep["logline"])}</p>'
        f'<div data-ep="{e(ep["id"])}"></div>{storyboard(ep)}'
        f'<p class="kd-note"><a href="/kids/{e(ep["world"])}/">{U("world_of")} {t3(wt(ep["world"]))} →</a></p>'
        f'</section>' for ep in KM.EPISODES)
    songs = "".join(
        f'<section class="kf-song" id="{e(sg["id"])}">'
        f'<h3>{sg["icon"]} {t3(sg["t"])}</h3>'
        f'<p class="meta">{t3(sg["goal"])}<br>{t3(sg["style"])} · {t3(sg["inst"])}</p>'
        f'<div data-song="{e(sg["id"])}"></div></section>' for sg in KM.SONGS)
    cast = "".join(
        f'<div class="kd-badge kd-castcard on" data-char="{e(k)}">'
        f'{t3(v[0], "b")}<small>{t3(v[1])}</small></div>'
        for k, v in STUDIO["who"].items())
    body = (f'<div class="kd" data-age="kid">'
            f'<div class="meta"><a href="/kids/">{U("t")}</a> / {t3(STUDIO["t"])}</div>'
            f'{BP.LSW}<h1>🎬 {t3(STUDIO["t"])}</h1>'
            f'<p class="lead">{t3(STUDIO["lead"])}</p>{me_bar()}'
            f'<h2>{t3(STUDIO["films"])}</h2>{films}'
            f'<h2 style="margin-top:26px">{t3(STUDIO["songs"])}</h2>{songs}'
            f'<h2 style="margin-top:26px">{t3(STUDIO["cast"])}</h2>'
            f'<div class="kd-badges kd-cast">{cast}</div>'
            f'<section class="kd-les" style="margin-top:22px">{t3(STUDIO["prod"], "h2")}'
            f'<p>{t3(STUDIO["prodtxt"])}</p></section>'
            f'<p class="kd-note">{t3(STUDIO["how"])}</p>'
            f'<div class="kd-nav"><a class="kd-btn" href="/kids/">{U("map")}</a></div></div>'
            f'{rest_box()}'
            f'<script type="application/json" id="kdMedia">{BP.sj(media_payload(KM.EPISODES, KM.SONGS))}</script>'
            f'<script type="application/json" id="kdAvs">{BP.sj([[i, ic, list(n), c] for i, ic, n, c in KD.AVATARS])}</script>'
            f'<script type="application/json" id="kdUI">{BP.sj(ui_payload())}</script>')
    return BP.page("kids/studio/", "استودیوی انیمیشن و موسیقی — آکادمی کودکان entekhab",
                   STUDIO["lead"][0], body, shell(""))


def wt(world_id):
    for w in KD.WORLDS:
        if w["id"] == world_id:
            return w["t"]
    return ("", "", "")


def build():
    urls = [page_start(), page_hub(), page_parents(), page_studio()]
    for i, w in enumerate(KD.WORLDS):
        urls.append(page_world(w, KD.WORLDS[i - 1] if i else None,
                               KD.WORLDS[i + 1] if i + 1 < len(KD.WORLDS) else None))
    BR.add_to_sitemap(urls)
    les = sum(len(w["lessons"]) for w in KD.WORLDS)
    gms = sum(len(w["games"]) for w in KD.WORLDS)
    qs = sum(len(w["quiz"]) for w in KD.WORLDS)
    sc = sum(len(x["scenes"]) for x in KM.EPISODES)
    ln = sum(len(s_["lines"]) for x in KM.EPISODES for s_ in x["scenes"])
    print(f"kids pages: {len(urls)} · worlds {len(KD.WORLDS)} · lessons {les} (×2 ages ×3 langs) "
          f"· games {gms} · questions {qs} · films {len(KM.EPISODES)} ({sc} scenes, {ln} lines) "
          f"· songs {len(KM.SONGS)} · themes {len(KM.THEMES)}")
    return urls


if __name__ == "__main__":
    build()
