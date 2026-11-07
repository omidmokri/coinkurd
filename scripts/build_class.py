#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""/class/ — the nightly Coin Kurd class, described only from what the channel's own posts say (scripts/class_facts.py).

No syllabus or book titles are invented: the repo has none. The page shows the schedule as the channel announces it
(quoted, with a link to the announcing post), the current invite, a live countdown, and the posts that refer back to
the class. Missing data says "no data yet".
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
import class_facts as CF  # noqa: E402
import reality_common as R  # noqa: E402

e = BP.e
L = R.L

S = {
    "title": L("کلاس شبانهٔ کوین کورد", "وانەی شەوانەی کۆین کورد", "The nightly Coin Kurd class"),
    "desc": L("کلاس زندهٔ هر شب ساعت ۲۰:۰۰ به وقت تهران در دیسکورد کوین کورد — زمان، لینک ورود و آنچه کانال دربارهٔ آن گفته.",
              "وانەی ڕاستەوخۆی هەموو شەوێک کاتژمێر ٢٠:٠٠ بە کاتی تاران لە دیسکۆردی کۆین کورد — کات، بەستەری چوونەژوورەوە و ئەوەی کەناڵ دەڵێت.",
              "The live class every night at 20:00 Tehran time on the Coin Kurd Discord — schedule, join link and what the channel says about it."),
    "lead": L("هر شب (به‌جز روزهای تعطیل) ساعت ۲۰:۰۰ به وقت تهران، کلاس زندهٔ کوین کورد در دیسکورد برگزار می‌شود. همه‌چیز این صفحه از پست‌های خود کانال برداشته شده.",
              "هەموو شەوێک (جگە لە ڕۆژانی پشوو) کاتژمێر ٢٠:٠٠ بە کاتی تاران، وانەی ڕاستەوخۆی کۆین کورد لە دیسکۆرد دەبێت. هەموو شتێکی ئەم پەڕەیە لە پۆستەکانی خودی کەناڵەوە وەرگیراوە.",
              "Every night (except holidays) at 20:00 Tehran time the live Coin Kurd class runs on Discord. Everything on this page is taken from the channel's own posts."),
    "next": L("کلاس بعدی", "وانەی داهاتوو", "Next class"),
    "in": L("شروع تا", "دەستپێک تا", "Starts in"), "h": L("ساعت", "کاتژمێر", "h"), "m": L("دقیقه", "خولەک", "min"),
    "local": L("به وقت شما", "بە کاتی تۆ", "your time"),
    "join": L("ورود به دیسکورد کوین کورد", "چوونە ناو دیسکۆردی کۆین کورد", "Join the Coin Kurd Discord"),
    "what": L("کانال دربارهٔ کلاس چه می‌گوید", "کەناڵ دەربارەی وانەکە چی دەڵێت", "What the channel says about it"),
    "what_l": L("نقل مستقیم از تازه‌ترین اطلاعیهٔ کانال (به فارسی):", "وەرگرتنی ڕاستەوخۆ لە نوێترین ڕاگەیاندنی کەناڵ (بە فارسی):",
                "Quoted from the channel's latest announcement (in Persian):"),
    "pts": L("در اطلاعیه‌ها آمده: جامعه‌ای برای تبادل نظر دربارهٔ کریپتو با آموزش؛ تجربه‌ها و معاملات هر روز به اشتراک گذاشته می‌شود؛ می‌توانید سؤال بپرسید و از تجربهٔ دیگران یاد بگیرید.",
             "لە ڕاگەیاندنەکاندا هاتووە: کۆمەڵگەیەک بۆ ئاڵوگۆڕی بیروڕا دەربارەی کریپتۆ لەگەڵ فێرکاری؛ ئەزموون و مامەڵەکان هەموو ڕۆژێک هاوبەش دەکرێن؛ دەتوانیت پرسیار بکەیت و لە ئەزموونی کەسانی تر فێربیت.",
             "The announcements say: a community for discussing crypto, with teaching; experiences and trades are shared every day; you can ask questions and learn from others' experience."),
    "src": L("اطلاعیهٔ منبع", "ڕاگەیاندنی سەرچاوە", "Source announcement"),
    "cnt": L("{n} اطلاعیهٔ کلاس در آرشیو سایت، از {d}.", "{n} ڕاگەیاندنی وانە لە ئەرشیفی ماڵپەڕ، لە {d}ەوە.",
             "{n} class announcements in the site's archive, since {d}."),
    "men": L("پست‌هایی که به کلاس ارجاع می‌دهند", "ئەو پۆستانەی ئاماژە بە وانەکە دەدەن", "Posts that refer back to the class"),
    "men_none": L("هنوز پستی پیدا نشده.", "هێشتا پۆستێک نەدۆزراوەتەوە.", "None found yet."),
    "more": L("کلاس روی نقشهٔ روز", "وانە لە نەخشەی ڕۆژدا", "The class on the daily page"),
    "nfa": L("محتوای کلاس آموزشی است و توصیهٔ مالی نیست.", "ناوەڕۆکی وانەکە فێرکارییە و ئامۆژگاریی دارایی نییە.",
             "The class is educational and is not financial advice."),
    "nd": L("هنوز داده‌ای نیست.", "هێشتا داتا نییە.", "No data yet."),
}


def s(k, lg, **kw):
    t = S[k].get(lg) or S[k]["fa"]
    return t.format(**kw) if kw else t


def build():
    posts = R.load("posts.json", []) or []
    f = CF.facts(posts)

    def b(lg):
        h = (f"<div class='meta'><a href='/'>{e(BR.s('home', lg))}</a> / {e(s('title', lg))}</div>"
             f"<h1>{e(s('title', lg))}</h1><p class='rc-lead'>{e(s('lead', lg))}</p>")
        cd = (f"<p class='cl-cd' data-h='{e(s('h', lg))}' data-m='{e(s('m', lg))}'>{e(s('in', lg))}: <b class='cl-v'>—</b></p>"
              f"<p class='note'>{e(s('local', lg))}: <b class='cl-loc' dir='ltr'>—</b></p>")
        if f["invite"]:
            cd += f"<p><a class='cl-go' href='{e(f['invite'])}' target='_blank' rel='noopener'>{e(s('join', lg))} ←</a></p>"
        h += BR.sec(e(s("next", lg)), cd)
        if f["source"]:
            src = f["source"]
            inner = (f"<p>{e(s('pts', lg))}</p><p class='note'>{e(s('what_l', lg))}</p>"
                     f"<blockquote dir='rtl' lang='fa'>«{e(f['schedule'])}»</blockquote>" if f["schedule"] else f"<p>{e(s('pts', lg))}</p>")
            inner += (f"<p class='note'><a href='{e(src['url'] or '')}' target='_blank' rel='noopener'>{e(s('src', lg))}</a> · "
                      f"{BR.fdate(src['date'], lg, True)} · "
                      + e(s('cnt', lg, n=BR.nf(f['n_announce'], lg), d='\x00')).replace('\x00', BR.fdate(f['first'], lg)) + "</p>")
        else:
            inner = f"<p class='note'>{e(s('nd', lg))}</p>"
        h += BR.sec(e(s("what", lg)), inner)
        if f["mentions"]:
            li = "".join(f"<li><a href='{e(m['url'] or '')}' target='_blank' rel='noopener'><bdi dir='auto'>{e(m['title'])}</bdi></a> "
                         f"<small class='mut'>{BR.fdate(m['date'], lg)}</small></li>" for m in f["mentions"][:20])
            inner = f"<ul>{li}</ul>"
        else:
            inner = f"<p class='note'>{e(s('men_none', lg))}</p>"
        h += BR.sec(e(s("men", lg)), inner)
        h += f"<p class='note'><a href='/today/'>{e(s('more', lg))} ←</a></p><p class='note'>{e(s('nfa', lg))}</p>"
        return h

    js = ("(function(){function u(){var n=new Date(),t=new Date(n.getTime());"
          "t.setUTCHours(16,30,0,0);if(t<=n)t.setUTCDate(t.getUTCDate()+1);var d=Math.round((t-n)/60000);"
          "var lo=t.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});"
          "document.querySelectorAll('.cl-cd').forEach(function(p){p.querySelector('.cl-v').textContent="
          "Math.floor(d/60)+' '+p.dataset.h+' '+(d%60)+' '+p.dataset.m;});"
          "document.querySelectorAll('.cl-loc').forEach(function(x){x.textContent=lo;});}u();setInterval(u,30000);})();")
    body = BR.finish("", BR.tri(b)) + f"<script>{js}</script>"
    css = (".cl-cd b{color:var(--acc);font-size:1.4em}.cl-go{display:inline-block;padding:10px 20px;border-radius:999px;"
           "background:var(--acc);color:#111;font-weight:700;text-decoration:none}"
           "blockquote{margin:8px 0;padding:10px 14px;border-inline-start:3px solid var(--acc);background:var(--card);border-radius:12px}")
    extra = f"<style>{BR.RCSS}{css}</style>"
    return BP.page("class/", s("title", "fa") + " — entekhab", s("desc", "fa"), body, extra)


def main():
    url = build()
    BR.add_to_sitemap([url])
    print("class page:", url)


if __name__ == "__main__":
    main()
