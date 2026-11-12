#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ستون‌های خبری چهارزبانهٔ حاشیهٔ صفحهٔ /crypto-news/  (داده: data/newsreel.json ساختهٔ scripts/newsreel.py)

هر تیتر در چهار زبان کوردی · فارسی · العربية · English همان‌جا در HTML نوشته می‌شود؛ پس:
  • هیچ درخواست شبکه‌ای تازه‌ای لازم نیست (اینترنت ایران),
  • با جاوااسکریپت خاموش هم خوانا و ایندکس‌شدنی است,
  • تغییر زبان با همان کلید زبان سایت و بی‌درنگ انجام می‌شود.
جهت متن برای فارسی/کوردی/عربی راست‌به‌چپ و برای انگلیسی چپ‌به‌راست تنظیم می‌شود.
"""
LANGS = ("fa", "ckb", "ar", "en")
DIR = {"fa": "rtl", "ckb": "rtl", "ar": "rtl", "en": "ltr"}

SIDE = 9           # چند تیتر در هر ستون کناری (راست و چپ)

UI = {
    "title": {"fa": "آخرین خبرها", "ckb": "دوایین هەواڵەکان", "ar": "آخر الأخبار", "en": "Latest headlines"},
    "aria_r": {"fa": "آخرین خبرها — ستون راست", "ckb": "دوایین هەواڵەکان — ستوونی ڕاست",
               "ar": "آخر الأخبار — العمود الأيمن", "en": "Latest headlines — right column"},
    "aria_l": {"fa": "آخرین خبرها — ستون چپ", "ckb": "دوایین هەواڵەکان — ستوونی چەپ",
               "ar": "آخر الأخبار — العمود الأيسر", "en": "Latest headlines — left column"},
    "foot": {"fa": "تیتر و نشانی هر خبر از ناشر اصلی است.", "ckb": "ناونیشان و بەستەری هەر هەواڵێک لە بڵاوکەرەوەی سەرەکییەوەیە.",
             "ar": "عنوان كل خبر ورابطه من الناشر الأصلي.", "en": "Each headline and link belongs to its publisher."},
}

CSS = """.nrs{position:fixed;top:104px;bottom:92px;width:clamp(158px,15vw,218px);z-index:3;display:none;
flex-direction:column;border:1px solid var(--line);border-radius:16px;overflow:hidden;
background:linear-gradient(180deg,rgba(247,147,26,.07),rgba(247,147,26,0) 42%),var(--card)}
.nrs-r{inset-inline-end:max(16px,calc(((100vw - 1000px)/2 - clamp(158px,15vw,218px))/2))}
.nrs-l{inset-inline-start:max(16px,calc(((100vw - 1000px)/2 - clamp(158px,15vw,218px))/2))}
@media(min-width:1320px){.nrs{display:flex}}
.nrs-h{display:flex;align-items:center;gap:7px;padding:9px 12px;border-bottom:1px solid var(--line);
font-size:.8rem;font-weight:700;flex:none}
.nrs-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;flex:none;animation:nrsp 2.4s infinite}
@keyframes nrsp{0%{box-shadow:0 0 0 0 rgba(34,197,94,.6)}70%{box-shadow:0 0 0 7px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
.nrs-win{flex:1;overflow:hidden;position:relative;
-webkit-mask-image:linear-gradient(180deg,transparent,#000 26px,#000 calc(100% - 26px),transparent);
mask-image:linear-gradient(180deg,transparent,#000 26px,#000 calc(100% - 26px),transparent)}
.nrs-run{display:flex;flex-direction:column}
.nrs.on .nrs-run{animation:nrsm var(--sp,150s) linear infinite}
.nrs-win:hover .nrs-run,.nrs-win:focus-within .nrs-run{animation-play-state:paused}
@keyframes nrsm{from{transform:translateY(0)}to{transform:translateY(-50%)}}
.nrs-i{display:block;padding:11px 12px;border-bottom:1px solid var(--line);color:var(--ink)}
.nrs-i:hover{background:rgba(247,147,26,.07);text-decoration:none}
.nrs-i .s{display:flex;align-items:center;gap:6px;color:var(--mute);font-size:.68rem;margin-bottom:5px}
.nrs-i .s b{font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;unicode-bidi:isolate}
.nrs-mono{width:17px;height:17px;border-radius:5px;flex:none;display:grid;place-items:center;
background:rgba(247,147,26,.15);color:var(--acc);font:700 .58rem/1 'Space Grotesk',monospace}
.nrs-i h3{font-size:.8rem;line-height:1.65;font-weight:700;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.nrs-i h3 [data-fl]{display:block}
.nrs-i h3 [data-fl][hidden]{display:none}
.nrs-i .m{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:6px;color:var(--mute);font-size:.66rem}
.nrs-i time{unicode-bidi:isolate;white-space:nowrap}
.nrs-chip{border:1px solid var(--line);border-radius:999px;padding:0 6px;font:600 .62rem/1.7 'Space Grotesk',monospace;color:var(--acc)}
.nrs-f{flex:none;padding:7px 12px;border-top:1px solid var(--line);color:var(--mute);font-size:.66rem;line-height:1.6}
@media(prefers-reduced-motion:reduce){.nrs.on .nrs-run{animation:none}.nrs-dot{animation:none}
.nrs-win{overflow-y:auto;scrollbar-width:thin}}"""

JS = """(function(){var R=[].slice.call(document.querySelectorAll('.nrs'));if(!R.length)return;
var D={fa:'\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9',
ckb:'\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669',
ar:'\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'};
var L={fa:{n:'\u0647\u0645\u06cc\u0646 \u062d\u0627\u0644\u0627',m:' \u062f\u0642\u06cc\u0642\u0647 \u067e\u06cc\u0634',h:' \u0633\u0627\u0639\u062a \u067e\u06cc\u0634',d:' \u0631\u0648\u0632 \u067e\u06cc\u0634'},
ckb:{n:'\u0626\u06ce\u0633\u062a\u0627',m:' \u062e\u0648\u0644\u06d5\u06a9 \u067e\u06ce\u0634',h:' \u06a9\u0627\u062a\u0698\u0645\u06ce\u0631 \u067e\u06ce\u0634',d:' \u0695\u06c6\u0698 \u067e\u06ce\u0634'},
ar:{n:'\u0627\u0644\u0622\u0646',m:' \u062f\u0642\u064a\u0642\u0629',h:' \u0633\u0627\u0639\u0629',d:' \u064a\u0648\u0645',p:'\u0645\u0646\u0630 '},
en:{n:'just now',m:'m ago',h:'h ago',d:'d ago'}};
function num(n,l){var d=D[l];return d?String(n).replace(/[0-9]/g,function(c){return d[+c]}):String(n)}
function ago(iso,l){var s=(Date.now()-Date.parse(iso))/1000,o=L[l]||L.fa;if(!isFinite(s)||s<0)s=0;
if(s<60)return o.n;var u='m',v=Math.round(s/60);if(v>=60){u='h';v=Math.round(s/3600)}
if(u==='h'&&v>=24){u='d';v=Math.round(s/86400)}return (o.p||'')+num(v,l)+o[u]}
function pick(){try{if(localStorage.getItem('ek_ar')==='1')return 'ar'}catch(e){}
if((document.documentElement.getAttribute('lang')||'')==='ar')return 'ar';
return window.EKL?window.EKL():(document.documentElement.lang||'fa')}
function apply(){var l=pick();if(!L[l])l='fa';
R.forEach(function(r){r.querySelectorAll('[data-fl]').forEach(function(x){x.hidden=x.getAttribute('data-fl')!==l});
r.querySelectorAll('time[data-at]').forEach(function(t){t.textContent=ago(t.getAttribute('data-at'),l);t.setAttribute('dir',l==='en'?'ltr':'rtl')})})}
R.forEach(function(r){var run=r.querySelector('.nrs-run');if(!run||run.dataset.dup)return;run.dataset.dup='1';
[].slice.call(run.children).forEach(function(k){var c=k.cloneNode(true);c.setAttribute('aria-hidden','true');c.tabIndex=-1;run.appendChild(c)});
r.style.setProperty('--sp',Math.max(70,run.children.length*9)+'s');r.classList.add('on')});
apply();addEventListener('ek-lang',apply);setTimeout(apply,0);setTimeout(apply,600);setInterval(apply,60000)})();"""


def _fl(vals, tag="span", cls=""):
    """یک رشته در چهار زبان؛ فقط زبان فعال دیده می‌شود و جهت هر کدام جداگانه تنظیم است"""
    c = f' class="{cls}"' if cls else ""
    out = ""
    for n, lg in enumerate(LANGS):
        v = vals.get(lg) or vals.get("fa") or vals.get("en") or ""
        hid = "" if lg == "fa" else " hidden"
        out += f'<{tag}{c} data-fl="{lg}" lang="{lg}" dir="{DIR[lg]}"{hid}>{v}</{tag}>'
    return out


def _mono(src):
    s = (src or "?").strip()
    first = next((ch for ch in s if ch.isalnum()), "?")
    return first.upper()


def block(data, e, fmt_date):
    """دو ستون خبری در حاشیهٔ راست و چپ صفحه؛ data = محتوای data/newsreel.json"""
    items = [x for x in (data.get("items") or []) if (x.get("t") or {}).get("en") and x.get("url")]
    if len(items) < 4:
        return ""
    items = items[:SIDE * 2]
    right, left = items[0::2], items[1::2]      # تازه‌ترین‌ها نوبتی بین دو ستون پخش می‌شوند

    def one(x):
        tt = x.get("t") or {}
        t4 = {lg: e(tt.get(lg) or tt.get("en") or "") for lg in LANGS}
        at = e(x.get("at") or "")
        chip = (x.get("coins") or [None])[0]
        return (f'<a class="nrs-i" href="{e(x["url"])}" rel="noopener nofollow" target="_blank">'
                f'<span class="s"><span class="nrs-mono" aria-hidden="true">{_mono(x.get("source"))}</span>'
                f'<b>{e(x.get("source") or "")}</b></span>'
                f'<h3>{_fl(t4)}</h3>'
                f'<span class="m"><time data-at="{at}" datetime="{at}">{e(fmt_date(x.get("at") or ""))}</time>'
                + (f'<span class="nrs-chip">{e(chip)}</span>' if chip else "")
                + "</span></a>")

    def col(rows, side):
        return ('<aside class="nrs nrs-' + side + '" aria-label="' + e(UI["aria_r" if side == "r" else "aria_l"]["fa"]) + '">'
                '<div class="nrs-h"><span class="nrs-dot" aria-hidden="true"></span>' + _fl(UI["title"]) + '</div>'
                '<div class="nrs-win"><div class="nrs-run">' + "".join(one(x) for x in rows) + '</div></div>'
                '<div class="nrs-f">' + _fl(UI["foot"]) + '</div></aside>')

    return col(right, "r") + col(left, "l") + f"<style>{CSS}</style><script>{JS}</script>"
