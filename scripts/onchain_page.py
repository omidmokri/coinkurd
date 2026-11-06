#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
/onchain/ — the channel's own market analysis on the site, and a plain statement of how it is made.

The report itself is written by scripts/bot_onchain.py. This module only presents it: the eight
sections it always has, the rules it is held to, the sources with their timestamps, and the
indicators it has no access to — so a reader can judge the analysis instead of trusting it.
It also shapes the compact form that the extension, the apps and the bot show.
"""
METHOD_SECTIONS = [
    ("رژیم بازار", "بازار در کدام حالت است — انباشت، توزیع، روندی، گسترش، فشردگی یا گذار — و چرا"),
    ("داده‌های کلیدی", "عددهای خام قیمت، حجم، موقعیت باز، نرخ تأمین مالی و جریان سفارش‌ها"),
    ("تحلیل ترکیبی", "تکنیکال و مشتقات و کلان کنار هم؛ تضاد سیگنال‌ها و اینکه کدام عامل وزن بیشتری دارد"),
    ("نقشهٔ نقدینگی", "حمایت و مقاومت و نواحی تجمع نقدینگی، همه با عدد و بازهٔ زمانی مشخص"),
    ("عوامل ریسک", "رویدادهای پیش‌رو، بازده واقعی، شاخص دلار، احساسات بازار و ریسک اهرم"),
    ("سه سناریو", "پایه، صعودی و نزولی؛ هر کدام با احتمال، شرط فعال‌سازی، هدف و نقطهٔ ابطال — مجموع احتمال‌ها دقیقاً ۱۰۰"),
    ("فرصت‌های معاملاتی", "فقط وقتی ستاپ قابل دفاع باشد؛ در غیر این صورت صریحاً می‌نویسد ستاپی نیست"),
    ("ارزیابی نهایی", "جهت‌گیری غالب، درجهٔ اطمینان، عامل مخالف، و یک استدلال متقابل علیه تز خودِ تحلیل"),
]
METHOD_RULES = [
    "هیچ عددی از تحلیل‌گر ساخته نمی‌شود؛ گزارش فقط به داده‌ای دسترسی دارد که همین‌جا جمع و زمان‌دار شده است",
    "داده از برداشت جدا است: خط‌های «داده» واقعیت‌اند و خط‌های «تحلیل» نظر",
    "شاخص‌هایی که در دسترس نیستند با نام ذکر می‌شوند، نه با عدد حدسی",
    "سطوح لیکوئیدیشن «ناحیهٔ احتمالی» نوشته می‌شوند، نه قیمت قطعی آینده",
    "هر سناریو و هر ستاپ نقطهٔ ابطال دارد؛ «ستاپی نیست» هم یک پاسخ معتبر است",
    "پیش از انتشار، گزارش از یک بازرسی خودکار رد می‌شود؛ اگر قاعده‌ای شکسته باشد بازنویسی می‌شود و اگر باز هم نشد، منتشر نمی‌شود",
]


def _an_lines(it):
    return [x.strip() for x in (it.get("fa") or "").split("\n") if x.strip()]


def _an_line(it, prefix):
    return next((x for x in _an_lines(it) if x.startswith(prefix)), "")


def _an_section(it, head, tag, limit=3):
    """the tagged lines of one section — the compact form every other platform shows"""
    out, cur = [], False
    for ln in _an_lines(it):
        if any(h[0] in ln and h[1] in ln for h in [(head.split(". ")[0], head.split(". ")[1])]):
            cur = True
            continue
        if cur and any(ln.startswith(x) for x in ("۱.", "۲.", "۳.", "۴.", "۵.", "۶.", "۷.", "۸.")):
            break
        if cur and any(h in ln for h in ("۱. ", "۲. ", "۳. ", "۴. ", "۵. ", "۶. ", "۷. ", "۸. ")):
            break
        if cur and ln.startswith(tag):
            out.append(ln.split(":", 1)[1].strip())
    return out[:limit]


def _an_scenarios(it):
    out = []
    for ln in _an_lines(it):
        if "احتمال:" in ln:
            out.append(ln)
    return out[:3]


def analysis_block(load, e, fmt_date):
    """the full block for the page; `load`, `e` and `fmt_date` come from build_pages"""
    d = load("onchain_analysis.json", {})
    items = d.get("items", [])
    secs = "".join(f'<li><b>{e(a)}</b> — {e(b)}</li>' for a, b in METHOD_SECTIONS)
    rules = "".join(f'<li>{e(x)}</li>' for x in METHOD_RULES)
    missing = (items[0].get("missing") if items else []) or []
    gone = ("<p class=\"note\" style=\"margin-top:10px\">شاخص‌هایی که این گزارش به آن‌ها دسترسی ندارد و دربارهٔ عددشان حرفی نمی‌زند: "
            + e("، ".join(missing)) + "</p>") if missing else ""
    stamps = ""
    if items and items[0].get("stamps"):
        stamps = ('<p class="note">زمان آخرین به‌روزرسانی هر منبع در لحظهٔ نگارش: '
                  + e("، ".join(f"{k} {str(v)[:16].replace('T', ' ')}" for k, v in items[0]["stamps"].items())) + "</p>")
    how = ('<details class="faq" style="margin:16px 0"><summary>این تحلیل چگونه نوشته می‌شود؟</summary>'
           '<p>هر گزارش در هشت بخش ثابت نوشته می‌شود:</p>'
           f'<ol style="padding-inline-start:20px">{secs}</ol>'
           '<p>و این قاعده‌ها بر آن حاکم‌اند:</p>'
           f'<ul style="padding-inline-start:20px">{rules}</ul>'
           + gone + stamps +
           '<p class="note">منبع عددها: بایننس برای قیمت و مشتقات، شاخص ترس و طمع، دادهٔ کلان بازارهای سنتی، '
           'و شبکهٔ بیت‌کوین برای نرخ هش و کارمزد. همه در همین مخزن جمع و زمان‌دار می‌شوند.</p></details>')
    cards = ""
    for it in items[:12]:
        img = it.get("img") or ""
        txt = e(it.get("fa", "")).replace("\n", "<br>")
        cards += ('<article class="txt" style="border:1px solid var(--acc);border-radius:14px;padding:16px;margin:14px 0">'
                  + (f'<img class="img" src="{e(img)}" alt="" loading="lazy">' if img.startswith("/data/analysis/") else "")
                  + f'<small class="note">تحلیل بازار · {fmt_date(it.get("at", ""))}</small>'
                  f'<div lang="fa" dir="rtl">{txt}</div></article>')
    if not cards:
        return how
    return f'<h2>تحلیل بازار انتخاب</h2>{how}{cards}<h2>خلاصهٔ تحلیل‌های آنچین</h2>'




def api(load, site):
    """the compact form the extension, the apps and the bot all read — one shape, one source"""
    an = (load("onchain_analysis.json", {}).get("items") or [{}])[0]
    return {"at": an.get("at"), "headline": _an_line(an, "₿"),
            "regime": _an_section(an, "۱. رژیم بازار", "تحلیل:"),
            "scenarios": _an_scenarios(an),
            "verdict": _an_section(an, "۸. ارزیابی نهایی", "تحلیل:"),
            "missing": an.get("missing", []), "stamps": an.get("stamps", {}),
            "url": f"{site}/onchain/", "method": METHOD_SECTIONS, "rules": METHOD_RULES}
