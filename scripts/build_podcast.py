#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""/podcast/ — the daily crypto podcast «نبض کریپتو» in four languages (fa · ckb · en · ar).

Reads data/podcast/index.json and data/podcast/<date>.json, written by .github/workflows/podcast.yml
(scripts/podcast/publish.py). The audio itself lives in the repo's GitHub Releases (podcast-<date>), so the Pages
site stays small. Each episode page has one tab per language — the address /podcast/<date>/#ckb opens the
Sorani version, which is how the Telegram album links each audio to its own text.
Nothing here computes a number: titles, points, chapters and transcripts come from the episode record.
"""
import html
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
import reality_common as R  # noqa: E402

e = BP.e
L = R.L
ROOT = BP.ROOT
D = os.path.join(ROOT, "data", "podcast")
ORDER = ("fa", "ckb", "en", "ar")
DIRS = {"fa": "rtl", "ckb": "rtl", "en": "ltr", "ar": "rtl"}
TAG = {"fa": "🟢 فارسی", "ckb": "☀️ کوردی", "en": "🔵 English", "ar": "🟠 العربية"}

S = {
    "title": L("پادکست روزانه بازار کریپتو", "پۆدکاستی ڕۆژانەی بازاڕی کریپتۆ", "Daily crypto podcast"),
    "lead": L("«نبض کریپتو»: هر روز ساعت ۱۹:۰۰ به وقت تهران، گزارش صوتی بازار به فارسی، کوردی سورانی، انگلیسی و عربی — همه اعداد از داده‌های همین سایت.",
              "«نەبزی کریپتۆ»: هەموو ڕۆژێک کاتژمێر ١٩:٠٠ بە کاتی تاران، ڕاپۆرتی دەنگیی بازاڕ بە فارسی، کوردیی سۆرانی، ئینگلیزی و عەرەبی — هەموو ژمارەکان لە داتای ئەم ماڵپەڕەوەن.",
              "“Crypto Intelligence Daily”: every day at 19:00 Tehran time, an audio market report in Persian, Sorani Kurdish, English and Arabic — every figure from this site's own data."),
    "eps": L("قسمت‌ها", "ئەڵقەکان", "Episodes"),
    "none": L("هنوز قسمتی منتشر نشده است.", "هێشتا هیچ ئەڵقەیەک بڵاو نەکراوەتەوە.", "No episode has been published yet."),
    "nfa": L("تحلیل و اطلاع‌رسانی است، نه توصیهٔ مالی. صداها با هوش مصنوعی ساخته شده‌اند.",
             "شیکاری و زانیارییە، نەک ئامۆژگاریی دارایی. دەنگەکان بە ژیریی دەستکرد دروست کراون.",
             "Analysis and information, not financial advice. The voices are synthetic."),
    "tg": L("هر قسمت در کانال تلگرام کوین کورد", "هەر ئەڵقەیەک لە کەناڵی تێلێگرامی کۆین کورد", "Every episode on the Coin Kurd Telegram channel"),
}
UI = {
    "fa": dict(summary="خلاصه", points="نکات کلیدی", chapters="فصل‌ها", transcript="متن کامل", sources="منابع", mp3="دانلود MP3",
               srt="زیرنویس", min="دقیقه", held="این نسخه امروز منتشر نشد (کنترل کیفیت)."),
    "ckb": dict(summary="پوختە", points="خاڵە سەرەکییەکان", chapters="بەشەکان", transcript="دەقی تەواو", sources="سەرچاوەکان",
                mp3="داگرتنی MP3", srt="ژێرنووس", min="خولەک", held="ئەم وەشانە ئەمڕۆ بڵاو نەکرایەوە (کۆنترۆڵی کوالیتی)."),
    "en": dict(summary="Summary", points="Key points", chapters="Chapters", transcript="Full transcript", sources="Sources",
               mp3="Download MP3", srt="Subtitles", min="min", held="This version was not published today (quality control)."),
    "ar": dict(summary="الملخص", points="النقاط الرئيسية", chapters="الفصول", transcript="النص الكامل", sources="المصادر",
               mp3="تنزيل MP3", srt="الترجمة", min="دقيقة", held="لم تُنشر هذه النسخة اليوم (مراقبة الجودة)."),
}

CSS = """
.pc-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.pc-tabs button{background:none;border:1px solid var(--line);color:var(--ink);
border-radius:99px;padding:7px 15px;font:inherit;cursor:pointer}.pc-tabs button.on{background:var(--acc);border-color:var(--acc);color:#000;font-weight:800}
.pc-ep{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px 18px;margin:10px 0}
.pc-ep h2{margin:4px 0 10px;font-size:1.25rem;line-height:1.7}.pc-ep audio{width:100%;margin:10px 0}
.pc-meta{color:var(--mute);font-size:.85rem}.pc-dl{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px}
.pc-dl a{border:1px solid var(--line);border-radius:99px;padding:5px 12px;font-size:.85rem}
.pc-ch{list-style:none;padding:0;margin:6px 0}.pc-ch li{margin:4px 0}.pc-ch button{background:none;border:0;color:var(--acc);font:inherit;cursor:pointer;padding:0}
.pc-ch .t{font-family:'Space Grotesk',monospace;color:var(--mute);margin-inline-end:8px;direction:ltr;display:inline-block}
.pc-tr h3{font-size:1rem;margin:16px 0 6px}.pc-tr p{line-height:2;color:#d6d6d0}
.pc-list a{display:block;border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:8px 0;color:var(--ink)}
.pc-list a:hover{border-color:var(--acc);text-decoration:none}.pc-list small{color:var(--mute)}
"""

JS = r"""(function(){var tabs=document.querySelectorAll('.pc-tabs button'),eps=document.querySelectorAll('.pc-ep[data-pl]');
if(!tabs.length)return;function show(l){var ok=false;eps.forEach(function(x){var on=x.getAttribute('data-pl')===l;x.hidden=!on;if(on)ok=true});
if(!ok)return false;tabs.forEach(function(b){b.classList.toggle('on',b.getAttribute('data-pl')===l)});
eps.forEach(function(x){if(x.hidden){var a=x.querySelector('audio');if(a)a.pause()}});return true}
tabs.forEach(function(b){b.addEventListener('click',function(){var l=b.getAttribute('data-pl');show(l);try{history.replaceState(null,'','#'+l)}catch(e){}})});
var h=(location.hash||'').slice(1),sl;try{sl=localStorage.getItem('ck_lang')}catch(e){}
if(!show(h)&&!show(sl||'fa'))show(eps[0].getAttribute('data-pl'));
document.querySelectorAll('.pc-ch button[data-t]').forEach(function(b){b.addEventListener('click',function(){
var a=b.closest('.pc-ep').querySelector('audio');if(a){a.currentTime=+b.getAttribute('data-t');a.play()}})})})();"""


def mmss(s):
    s = int(round(s))
    return f"{s // 60}:{s % 60:02d}"


def load():
    p = os.path.join(D, "index.json")
    idx = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {"episodes": []}
    eps = []
    for x in idx.get("episodes", []):
        f = os.path.join(D, f"{x['date']}.json")
        if os.path.exists(f):
            eps.append(json.load(open(f, encoding="utf-8")))
    eps.sort(key=lambda r: r["date"], reverse=True)
    return eps


def panel(rec, lang):
    v, u = rec["langs"][lang], UI[lang]
    pts = "".join(f"<li>{e(p)}</li>" for p in v["key_points"])
    ch = "".join(f"<li><span class='t'>{mmss(c['start'])}</span><button type='button' data-t='{c['start']}'>{e(c['title'])}</button></li>"
                 for c in v["chapters"])
    tr = "".join(f"<h3>{e(s['title'])}</h3>" + "".join(f"<p>{e(p)}</p>" for p in s["paras"]) for s in v["transcript"])
    src = rec.get("sources", {})
    sl = "".join(f"<li><a href='{e(x)}' rel='noopener'>{e(x.replace('https://', ''))}</a></li>" for x in src.get("site", []) + src.get("channel", []))
    sl += "".join(f"<li><a href='{e(n['urls'][0])}' rel='noopener nofollow' target='_blank' dir='ltr'>{e(n['title'])}</a> <small>({e(', '.join(n['outlets']))})</small></li>"
                  for n in src.get("news", []) if n.get("urls"))
    return (f"<article class='pc-ep' data-pl='{lang}' lang='{lang}' dir='{DIRS[lang]}' id='ep-{lang}'>"
            f"<div class='pc-meta'>{e(TAG[lang])} · {e(v['episode_label'])} · {e(v['date_label'])} · {round(v['duration'] / 60)} {u['min']}</div>"
            f"<h2>{e(v['title'])}</h2><audio controls preload='none' src='{e(v['audio'])}'></audio>"
            f"<div class='pc-dl'><a href='{e(v['audio'])}'>⬇ {u['mp3']} ({v['size_mb']} MB)</a><a href='{e(v['srt'])}'>{u['srt']} (SRT)</a></div>"
            f"<h3>{u['summary']}</h3><p>{e(v['summary'])}</p><h3>{u['points']}</h3><ul>{pts}</ul>"
            f"<h3>{u['chapters']}</h3><ol class='pc-ch'>{ch}</ol>"
            f"<details class='pc-tr'><summary>{u['transcript']}</summary>{tr}</details>"
            f"<details><summary>{u['sources']}</summary><ul>{sl}</ul><p class='note'>{e(src.get('data', ''))}</p></details></article>")


def episode_page(rec):
    langs = [l for l in ORDER if l in rec["langs"]]
    tabs = "".join(f"<button type='button' data-pl='{l}'>{e(TAG[l])}</button>" for l in langs)
    held = "".join(f"<p class='note'>{e(TAG[l])}: {UI[l]['held']}</p>" for l in ORDER if l in rec.get("held", {}))
    fa = rec["langs"].get("fa") or rec["langs"][langs[0]]

    def head(lg):
        return (f"<div class='meta'><a href='/'>{e(BR.s('home', lg))}</a> / <a href='/podcast/'>{e(S['title'][lg])}</a> / {e(rec['date'])}</div>"
                f"<h1>{e(S['title'][lg])}</h1><p class='note'>{e(S['nfa'][lg])}</p>")
    body = BR.finish("", BR.tri(head) + f"<div class='pc-tabs' role='tablist'>{tabs}</div>"
                     + "".join(panel(rec, l) for l in langs) + held + f"<script>{JS}</script>")
    ld = {"@context": "https://schema.org", "@type": "PodcastEpisode", "name": fa["title"], "description": fa["summary"],
          "datePublished": rec["release_utc"], "episodeNumber": rec["n"], "url": f"{BP.SITE}/podcast/{rec['date']}/",
          "inLanguage": langs, "timeRequired": f"PT{round(fa['duration'] / 60)}M",
          "associatedMedia": [{"@type": "MediaObject", "contentUrl": rec["langs"][l]["audio"], "encodingFormat": "audio/mpeg",
                               "inLanguage": l} for l in langs],
          "partOfSeries": {"@type": "PodcastSeries", "name": "نبض کریپتو · Crypto Intelligence Daily", "url": f"{BP.SITE}/podcast/"}}
    extra = (f"<style>{BR.RCSS}{CSS}</style><script type='application/ld+json'>{BP.sj(ld)}</script>"
             f"<meta property='og:image' content='{e(fa['social'])}'>")
    BP.page(f"podcast/{rec['date']}", f"{fa['title']} | {S['title']['fa']}", fa.get("meta_description") or fa["summary"], body, extra)


def index_page(eps):
    def b(lg):
        h = (f"<div class='meta'><a href='/'>{e(BR.s('home', lg))}</a> / {e(S['title'][lg])}</div>"
             f"<h1>{e(S['title'][lg])}</h1><p class='rc-lead'>{e(S['lead'][lg])}</p>")
        if not eps:
            return h + f"<p class='note'>{e(S['none'][lg])}</p>"
        items = ""
        for r in eps:
            v = r["langs"].get(lg) or r["langs"].get("fa") or next(iter(r["langs"].values()))
            items += (f"<a href='/podcast/{r['date']}/#{lg if lg in r['langs'] else 'fa'}'><small>{e(v['episode_label'])} · {e(v['date_label'])} · "
                      f"{' '.join(TAG[l].split()[0] for l in ORDER if l in r['langs'])}</small><br><b>{e(v['title'])}</b></a>")
        return (h + BR.sec(e(S["eps"][lg]), f"<div class='pc-list'>{items}</div>")
                + f"<p><a href='https://t.me/Coin_Kurd' rel='noopener'>{e(S['tg'][lg])}</a> · <span class='note'>{e(S['nfa'][lg])}</span></p>")
    BP.page("podcast", S["title"]["fa"], S["lead"]["fa"], BR.finish("", BR.tri(b)), f"<style>{BR.RCSS}{CSS}</style>")


def build():
    eps = load()
    index_page(eps)
    for r in eps:
        episode_page(r)
    BR.add_to_sitemap([f"{BP.SITE}/podcast/"] + [f"{BP.SITE}/podcast/{r['date']}/" for r in eps])
    print("podcast pages:", 1 + len(eps))


if __name__ == "__main__":
    build()
