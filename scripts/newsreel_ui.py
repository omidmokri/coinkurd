#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ریل خبری چهارزبانهٔ صفحهٔ /crypto-news/  (داده: data/newsreel.json ساختهٔ scripts/newsreel.py)

هر تیتر در چهار زبان کوردی · فارسی · العربية · English همان‌جا در HTML نوشته می‌شود؛ پس:
  • هیچ درخواست شبکه‌ای تازه‌ای لازم نیست (اینترنت ایران),
  • با جاوااسکریپت خاموش هم خوانا و ایندکس‌شدنی است,
  • تغییر زبان با همان کلید زبان سایت و بی‌درنگ انجام می‌شود.
جهت متن برای فارسی/کوردی/عربی راست‌به‌چپ و برای انگلیسی چپ‌به‌راست تنظیم می‌شود.
"""
LANGS = ("fa", "ckb", "ar", "en")
DIR = {"fa": "rtl", "ckb": "rtl", "ar": "rtl", "en": "ltr"}

TICK = 10          # چند تیتر در نوار روان
CARDS = 20         # چند کارت در ریل

UI = {
    "title": {"fa": "ریل خبری زنده", "ckb": "ڕیلی هەواڵی زیندوو", "ar": "شريط الأخبار المباشر", "en": "Live news reel"},
    "aria": {"fa": "ریل خبری زنده", "ckb": "ڕیلی هەواڵی زیندوو", "ar": "شريط الأخبار المباشر", "en": "Live news reel"},
    "foot": {"fa": "تیتر و نشانی هر خبر از ناشر اصلی است؛ برای خواندن متن کامل روی تیتر بزنید. ترجمهٔ تیترها خودکار است.",
             "ckb": "ناونیشان و بەستەری هەر هەواڵێک لە بڵاوکەرەوەی سەرەکییەوەیە؛ بۆ خوێندنی تەواوی دەقەکە لە ناونیشانەکە بدە. وەرگێڕانی ناونیشانەکان خۆکارە.",
             "ar": "عنوان كل خبر ورابطه من الناشر الأصلي؛ اضغط العنوان لقراءة النص الكامل. ترجمة العناوين تلقائية.",
             "en": "Every headline and link belongs to its original publisher; tap a headline for the full story. Headline translations are automatic."},
    "swipe": {"fa": "برای دیدن خبرهای بیشتر بکشید →", "ckb": "بۆ بینینی هەواڵی زیاتر ڕابکێشە →",
              "ar": "اسحب لرؤية المزيد من الأخبار →", "en": "Swipe for more headlines →"},
}

CSS = """.nrl{margin:22px 0 30px;border:1px solid var(--line);border-radius:18px;overflow:hidden;
background:linear-gradient(180deg,rgba(247,147,26,.08),rgba(247,147,26,0) 58%),var(--card)}
.nrl-h{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line)}
.nrl-ttl{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:.97rem}
.nrl-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;flex:none;animation:nrlp 2.4s infinite}
@keyframes nrlp{0%{box-shadow:0 0 0 0 rgba(34,197,94,.65)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
.nrl-up{color:var(--mute);font-size:.76rem;font-family:'Space Grotesk',monospace;direction:ltr;unicode-bidi:isolate}
.nrl-tick{overflow:hidden;border-bottom:1px solid var(--line);background:rgba(0,0,0,.28);
-webkit-mask-image:linear-gradient(90deg,transparent,#000 46px,#000 calc(100% - 46px),transparent);
mask-image:linear-gradient(90deg,transparent,#000 46px,#000 calc(100% - 46px),transparent)}
.nrl-run{display:flex;align-items:center;width:max-content;padding:10px 0}
.nrl.on .nrl-run{animation:nrlm 90s linear infinite}
html[dir=rtl] .nrl.on .nrl-run{animation-name:nrlmr}
.nrl-tick:hover .nrl-run,.nrl-tick:focus-within .nrl-run{animation-play-state:paused}
@keyframes nrlm{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes nrlmr{from{transform:translateX(0)}to{transform:translateX(50%)}}
.nrl-i{display:inline-flex;align-items:center;gap:9px;padding:0 18px;white-space:nowrap;color:var(--ink);font-size:.89rem;border-inline-end:1px solid var(--line)}
.nrl-i:hover{color:var(--acc);text-decoration:none}
.nrl-i i{font-style:normal;color:var(--acc)}
.nrl-rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x proximity;padding:14px 16px;scrollbar-width:thin;overscroll-behavior-x:contain}
.nrl-rail::-webkit-scrollbar{height:6px}
.nrl-rail::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:9px}
.nrl-c{flex:0 0 280px;scroll-snap-align:start;display:flex;flex-direction:column;gap:8px;min-height:152px;
border:1px solid var(--line);border-radius:14px;background:#0d0d0d;padding:13px 14px;transition:border-color .2s,transform .2s}
.nrl-c:hover,.nrl-c:focus-visible{border-color:rgba(247,147,26,.55);transform:translateY(-2px);text-decoration:none}
.nrl-src{display:flex;align-items:center;gap:7px;color:var(--mute);font-size:.73rem;min-width:0}
.nrl-src b{font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;unicode-bidi:isolate}
.nrl-mono{width:21px;height:21px;border-radius:7px;flex:none;display:grid;place-items:center;
background:rgba(247,147,26,.15);color:var(--acc);font:700 .64rem/1 'Space Grotesk',monospace}
.nrl-c h3{font-size:.95rem;line-height:1.6;font-weight:700;color:var(--ink);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.nrl-c h3 [data-fl]{display:block}
.nrl-c h3 [data-fl][hidden]{display:none}
.nrl-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto}
.nrl-c time{color:var(--mute);font-size:.72rem;unicode-bidi:isolate;flex:none;white-space:nowrap}
.nrl-chips{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
.nrl-chip{border:1px solid var(--line);border-radius:999px;padding:0 8px;font:600 .68rem/1.75 'Space Grotesk',monospace;color:var(--acc)}
.nrl-f{padding:10px 16px;border-top:1px solid var(--line);color:var(--mute);font-size:.74rem;display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap}
.nrl-f span[data-fl]{max-width:46em}
@media(max-width:600px){.nrl-c{flex:0 0 238px}.nrl-i{font-size:.84rem;padding:0 14px}}
@media(prefers-reduced-motion:reduce){.nrl.on .nrl-run{animation:none}.nrl-dot{animation:none}
.nrl-tick{overflow-x:auto}.nrl-c:hover{transform:none}}"""

JS = """(function(){var r=document.querySelector('.nrl');if(!r)return;var run=r.querySelector('.nrl-run');
var D={fa:'\\u06f0\\u06f1\\u06f2\\u06f3\\u06f4\\u06f5\\u06f6\\u06f7\\u06f8\\u06f9',
ckb:'\\u0660\\u0661\\u0662\\u0663\\u0664\\u0665\\u0666\\u0667\\u0668\\u0669',
ar:'\\u0660\\u0661\\u0662\\u0663\\u0664\\u0665\\u0666\\u0667\\u0668\\u0669'};
var L={fa:{n:'\\u0647\\u0645\\u06cc\\u0646 \\u062d\\u0627\\u0644\\u0627',m:' \\u062f\\u0642\\u06cc\\u0642\\u0647 \\u067e\\u06cc\\u0634',h:' \\u0633\\u0627\\u0639\\u062a \\u067e\\u06cc\\u0634',d:' \\u0631\\u0648\\u0632 \\u067e\\u06cc\\u0634'},
ckb:{n:'\\u0626\\u06ce\\u0633\\u062a\\u0627',m:' \\u062e\\u0648\\u0644\\u06d5\\u06a9 \\u067e\\u06ce\\u0634',h:' \\u06a9\\u0627\\u062a\\u0698\\u0645\\u06ce\\u0631 \\u067e\\u06ce\\u0634',d:' \\u0695\\u06c6\\u0698 \\u067e\\u06ce\\u0634'},
ar:{n:'\\u0627\\u0644\\u0622\\u0646',m:' \\u062f\\u0642\\u064a\\u0642\\u0629',h:' \\u0633\\u0627\\u0639\\u0629',d:' \\u064a\\u0648\\u0645',p:'\\u0645\\u0646\\u0630 '},
en:{n:'just now',m:'m ago',h:'h ago',d:'d ago'}};
function num(n,l){var d=D[l];return d?String(n).replace(/[0-9]/g,function(c){return d[+c]}):String(n)}
function ago(iso,l){var s=(Date.now()-Date.parse(iso))/1000,o=L[l]||L.fa;if(!isFinite(s)||s<0)s=0;
var u='m',v=Math.round(s/60);if(s<60)return o.n;if(v>=60){u='h';v=Math.round(s/3600)}if(v>=24&&u==='h'){u='d';v=Math.round(s/86400)}
return (o.p||'')+num(v,l)+o[u]}
function paint(l){r.querySelectorAll('time[data-at]').forEach(function(t){var s=ago(t.getAttribute('data-at'),l);t.textContent=s;t.setAttribute('dir',l==='en'?'ltr':'rtl')})}
if(run&&!run.dataset.dup){run.dataset.dup='1';[].slice.call(run.children).forEach(function(k){var c=k.cloneNode(true);c.setAttribute('aria-hidden','true');c.tabIndex=-1;run.appendChild(c)});r.classList.add('on')}
function pick(){try{if(localStorage.getItem('ek_ar')==='1')return 'ar'}catch(e){}
if((document.documentElement.getAttribute('lang')||'')==='ar')return 'ar';
return window.EKL?window.EKL():(document.documentElement.lang||'fa')}
function apply(){var l=pick();if(!L[l])l='fa';
r.querySelectorAll('[data-fl]').forEach(function(x){x.hidden=x.getAttribute('data-fl')!==l});paint(l)}
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
    """HTML ریل خبری؛ data = محتوای data/newsreel.json"""
    items = [x for x in (data.get("items") or []) if (x.get("t") or {}).get("en") and x.get("url")]
    if not items:
        return ""
    def t4(x):
        tt = x.get("t") or {}
        return {lg: e(tt.get(lg) or tt.get("en") or "") for lg in LANGS}

    ticks = ""
    for x in items[:TICK]:
        tt = t4(x)
        chip = f'<i>{e((x.get("coins") or ["•"])[0])}</i>'
        ticks += (f'<a class="nrl-i" href="{e(x["url"])}" rel="noopener nofollow" target="_blank">{chip}'
                  + _fl(tt) + "</a>")

    cards = ""
    for x in items[:CARDS]:
        tt = t4(x)
        chips = "".join(f'<span class="nrl-chip">{e(c)}</span>' for c in (x.get("coins") or [])[:2])
        src = e(x.get("source") or "")
        at = e(x.get("at") or "")
        cards += (f'<a class="nrl-c" href="{e(x["url"])}" rel="noopener nofollow" target="_blank">'
                  f'<span class="nrl-src"><span class="nrl-mono" aria-hidden="true">{_mono(x.get("source"))}</span>'
                  f'<b>{src}</b></span><h3>{_fl(tt)}</h3>'
                  f'<span class="nrl-meta"><time data-at="{at}" datetime="{at}">{e(fmt_date(x.get("at") or ""))}</time>'
                  f'<span class="nrl-chips">{chips}</span></span></a>')

    srcs = " · ".join(e(s) for s in (data.get("sources") or []))
    return ('<section class="nrl" aria-label="' + e(UI["aria"]["fa"]) + '">'
            '<div class="nrl-h"><span class="nrl-ttl"><span class="nrl-dot" aria-hidden="true"></span>'
            + _fl(UI["title"]) + '</span>'
            f'<span class="nrl-up" title="{e(fmt_date(data.get("updated_at") or ""))}">{e(fmt_date(data.get("updated_at") or ""))}</span></div>'
            f'<div class="nrl-tick"><div class="nrl-run">{ticks}</div></div>'
            f'<div class="nrl-rail">{cards}</div>'
            '<div class="nrl-f">' + _fl(UI["foot"]) + f'<span class="nrl-up">{srcs}</span></div>'
            f'</section><style>{CSS}</style><script>{JS}</script>')
