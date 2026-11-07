#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""/autopilot/ — the public log of the site's autonomous improvement loop.

Renders the "Log" section of AUTOPILOT.md (repo root) so every autonomous change is visible on the site,
with links to the git history. Entries are written in English by the loop; the frame is trilingual.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
import reality_common as R  # noqa: E402

e = BP.e
L = R.L
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = "https://github.com/omidmokri/coinkurd"
HIST = f"{REPO}/commits/main/AUTOPILOT.md"
SEARCH = f"{REPO}/commits/main/?search=autopilot%3A"

S = {
    "title": L("گزارش کار خودکار سایت", "ڕاپۆرتی کاری خۆکاری ماڵپەڕ", "The site's autopilot log"),
    "desc": L("هر تغییری که حلقهٔ خودکار بهبود سایت انجام داده: چه نیازی دید، چه ساخت، چطور آزمایش کرد و قدم بعدی — همه با لینک به تاریخچهٔ کد.",
              "هەر گۆڕانکارییەک کە خولی خۆکاری باشترکردنی ماڵپەڕ کردوویەتی: چ پێویستییەکی بینی، چی دروست کرد، چۆن تاقی کردەوە — هەمووی بە بەستەر بۆ مێژووی کۆد.",
              "Every change made by the site's autonomous improvement loop: the need it saw, what it built, how it was tested and what comes next — all linked to the code history."),
    "lead": L("هر ساعت یک جلسهٔ خودکار یکی از نیازهای واقعی تریدرها را انتخاب می‌کند، می‌سازد، آزمایش می‌کند و منتشر می‌کند. این صفحه دفتر همان کار است، بی‌سانسور. متن گزارش‌ها به انگلیسی و فنی نوشته می‌شود.",
              "هەموو کاتژمێرێک دانیشتنێکی خۆکار یەکێک لە پێویستییە ڕاستەقینەکانی ترەیدەران هەڵدەبژێرێت، دروستی دەکات، تاقی دەکاتەوە و بڵاوی دەکاتەوە. ئەم پەڕەیە تۆماری ئەو کارەیە. دەقی ڕاپۆرتەکان بە ئینگلیزی و تەکنیکی نووسراون.",
              "Every hour an automated session picks one real trader need, builds it, tests it and publishes it. This page is that work's logbook, uncensored."),
    "n": L("{n} گزارش", "{n} ڕاپۆرت", "{n} entries"),
    "hist": L("تاریخچهٔ این دفتر در گیت‌هاب", "مێژووی ئەم تۆمارە لە گیتهەب", "This log's history on GitHub"),
    "commits": L("همهٔ کامیت‌های autopilot", "هەموو کۆمیتەکانی autopilot", "All autopilot commits"),
    "rules": L("قانون‌های ثابت: هیچ عدد ساختگی، هیچ توصیهٔ خرید و فروش، هیچ پیام به کاربران، هیچ تغییر مخرب.",
               "یاسا جێگیرەکان: هیچ ژمارەی دەستکرد، هیچ پێشنیاری کڕین و فرۆشتن، هیچ نامە بۆ بەکارهێنەران، هیچ گۆڕانکاریی وێرانکەر.",
               "Fixed rules: no invented numbers, no buy/sell advice, no messages to users, nothing destructive."),
    "none": L("هنوز گزارشی نیست.", "هێشتا ڕاپۆرت نییە.", "No entries yet."),
}


def s(k, lg, **kw):
    t = S[k].get(lg) or S[k]["fa"]
    return t.format(**kw) if kw else t


def inline(t):
    """escape, then the two markdown marks the log uses: **bold** and `code`"""
    t = e(t)
    t = re.sub(r"`([^`]+)`", r"<code dir='ltr'>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    return t


def parse(md):
    """→ [{date, title, items:[str]}] from the '## Log' section, newest first as written"""
    m = re.search(r"^## Log[^\n]*\n(.*?)(?=^## |\Z)", md, re.S | re.M)
    if not m:
        return []
    out = []
    for blk in re.split(r"^### ", m.group(1), flags=re.M)[1:]:
        head, _, rest = blk.partition("\n")
        date, _, title = head.partition("·")
        items = []
        for line in rest.splitlines():
            if line.startswith("- "):
                items.append(line[2:].strip())
            elif line.strip() and items:
                items[-1] += " " + line.strip()
        out.append({"date": date.strip(), "title": title.strip() or date.strip(), "items": items})
    return out


CSS = """.ap-e{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:12px 0}
.ap-e h2{font-size:1.05rem;margin:0 0 4px}.ap-e time{color:var(--acc);font-family:'Space Grotesk',monospace;font-size:.8rem}
.ap-e ul{margin:8px 0 0;padding-inline-start:20px}.ap-e li{margin:6px 0;line-height:1.85;color:#d6d6d0;font-size:.9rem;overflow-wrap:anywhere}
.ap-e code{background:#000;border:1px solid var(--line);border-radius:6px;padding:0 5px;font-size:.82rem;unicode-bidi:isolate}
.ap-links{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}"""


def build(md):
    entries = parse(md)

    def b(lg):
        h = (f"<div class='meta'><a href='/'>{e(BR.s('home', lg))}</a> / {e(s('title', lg))}</div>"
             f"<h1>{e(s('title', lg))}</h1><p class='rc-lead'>{e(s('lead', lg))}</p><p class='note'>{e(s('rules', lg))}</p>"
             f"<div class='ap-links'><span class='rc-pill'>{e(s('n', lg, n=BR.nf(len(entries), lg)))}</span>"
             f"<a class='rc-btn2' href='{HIST}' target='_blank' rel='noopener'>{e(s('hist', lg))}</a>"
             f"<a class='rc-btn2' href='{SEARCH}' target='_blank' rel='noopener'>{e(s('commits', lg))}</a></div>")
        if not entries:
            return h + f"<p class='note'>{e(s('none', lg))}</p>"
        for x in entries:
            lis = "".join(f"<li>{inline(i)}</li>" for i in x["items"])
            h += (f"<article class='ap-e' lang='en' dir='ltr'><time dir='ltr'>{e(x['date'])}</time>"
                  f"<h2>{inline(x['title'])}</h2><ul>{lis}</ul></article>")
        return h

    body = BR.finish("", BR.tri(b))
    return BP.page("autopilot/", s("title", "fa"), s("desc", "fa"), body, f"<style>{BR.RCSS}{CSS}</style>")


def main():
    with open(os.path.join(ROOT, "AUTOPILOT.md"), encoding="utf-8") as f:
        url = build(f.read())
    BR.add_to_sitemap([url])
    print("autopilot page:", url)


if __name__ == "__main__":
    main()
