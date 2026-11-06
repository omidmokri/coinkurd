#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ساخت /academy/psychology/ — سامانهٔ هوش روان‌شناسی معامله‌گر.

بخشی جدا در آکادمی است، نه یک دانشکده: اینجا به‌جای درس و آزمون چهارگزینه‌ای،
رفتار واقعی معامله‌گر اندازه گرفته می‌شود. محتوای علمی از scripts/psych_data.py می‌آید،
محاسبه از assets/psych-core.js و رابط از assets/psych.js.

همهٔ دادهٔ کاربر فقط در مرورگر خودش می‌ماند (localStorage) و با یک کلیک قابل خروجی گرفتن است.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import psych_data as PD  # noqa: E402

e = BP.e
VER = "1"
OUT = "academy/psychology/"

TABS = [
    ("over", "🏠", "نمای کلی"), ("twin", "🧠", "مغز سه‌بعدی"), ("test", "📝", "مرکز آزمون"),
    ("emo", "🌊", "مرکز هیجان"), ("beh", "🧭", "تحلیل رفتار"), ("jr", "📒", "ژورنال"),
    ("dq", "⚖️", "کیفیت تصمیم"), ("heat", "🔥", "نقشهٔ حرارتی"), ("time", "🕒", "خط زمانی"),
    ("daily", "🗓", "پروتکل روزانه"), ("prog", "📈", "پیشرفت"), ("learn", "📚", "آموزش"),
    ("rep", "🧾", "گزارش"), ("set", "⚙️", "تنظیمات"),
]


def head():
    return (f'<link rel="stylesheet" href="/assets/academy.css?v={VER}">'
            f'<link rel="stylesheet" href="/assets/psych.css?v={VER}">')


def nav():
    b = "".join(f'<button class="ps-tab{" on" if i == 0 else ""}" data-p="{k}">{ic} {t}</button>'
                for i, (k, ic, t) in enumerate(TABS))
    return f'<nav class="ps-nav">{b}</nav>'


def dimension_cards():
    out = []
    for d in PD.DIMENSIONS:
        items = "".join(
            f'<div class="ps-q" data-dim="{d["id"]}" data-i="{i}" data-rev="{rev}">'
            f'<p>{e(txt)}</p><div class="ps-lk">'
            + "".join(f'<button type="button" data-v="{v}">{e(lbl)}</button>' for v, lbl in enumerate(PD.LIKERT))
            + "</div></div>"
            for i, (txt, rev) in enumerate(d["items"]))
        out.append(
            f'<details class="ps-dim" id="dim-{d["id"]}"><summary><b>{d["icon"]} {e(d["fa"])}</b>'
            f'<span class="ps-badge" data-score="{d["id"]}">—</span></summary>'
            f'<p class="note"><b>سازه:</b> {e(d["construct"])}</p>'
            f'<p class="note"><b>سنجش عملیاتی:</b> {e(d["operational"])}</p>'
            f'<div class="ps-items">{items}</div></details>')
    return "".join(out)


def pattern_cards():
    out = []
    for p in PD.PATTERNS:
        fix = "".join(f"<li>{e(x)}</li>" for x in p["fix"])
        out.append(
            f'<article class="ps-pat" data-pat="{p["id"]}">'
            f'<header><b>{p["icon"]} {e(p["fa"])}</b><span class="ps-verdict">—</span></header>'
            f'<div class="ps-chain">'
            f'<div><small>محرک</small>{e(p["trigger"])}</div>'
            f'<div><small>فکر خودکار</small>{e(p["thought"])}</div>'
            f'<div><small>احساس</small>{e(p["emotion"])}</div>'
            f'<div><small>رفتار</small>{e(p["behavior"])}</div>'
            f'<div><small>پیامد</small>{e(p["consequence"])}</div></div>'
            f'<div class="ps-ev"></div>'
            f'<details><summary>مداخلهٔ پیشنهادی</summary><ul>{fix}</ul></details></article>')
    return "".join(out)


def protocol_cards():
    out = []
    for p in PD.PROTOCOLS:
        steps = "".join(f"<li>{e(x)}</li>" for x in p["steps"])
        out.append(f'<details class="ps-proto"><summary><b>{e(p["fa"])}</b> <small dir="ltr">{e(p["en"])}</small></summary>'
                   f'<p class="note">{e(p["use"])}</p><ol>{steps}</ol>'
                   f'<button class="ac-btn ghost ps-run" data-proto="{p["id"]}">شروع تمرین و ثبت نتیجه</button></details>')
    return "".join(out)


def learn_cards():
    """نیمهٔ آموزشی: هر بُعد یک درس، با نشانگرهای رفتاری و مداخله‌ها."""
    out = []
    for d in PD.DIMENSIONS:
        beh = "".join(f"<li>{e(x)}</li>" for x in d["behavioral"])
        tr = "".join(f"<li>{e(x)}</li>" for x in d["trade"])
        iv = "".join(f"<li>{e(x)}</li>" for x in d["interventions"])
        out.append(
            f'<details class="ps-lesson"><summary><b>{d["icon"]} {e(d["fa"])}</b> <small dir="ltr">{e(d["en"])}</small></summary>'
            f'<p><b>این بُعد چیست؟</b> {e(d["construct"])}</p>'
            f'<p><b>چطور اندازه گرفته می‌شود؟</b> {e(d["operational"])}</p>'
            f'<p><b>چه چیزی در رفتار دیده می‌شود؟</b></p><ul>{beh}</ul>'
            f'<p><b>چه چیزی در دادهٔ معاملات دیده می‌شود؟</b></p><ul>{tr}</ul>'
            f'<p><b>تمرین اصلاحی</b></p><ul>{iv}</ul></details>')
    return "".join(out)


def build():
    cfg = {"dims": [{k: d[k] for k in ("id", "icon", "fa", "ckb", "en")} for d in PD.DIMENSIONS],
           "items": {d["id"]: [{"t": t, "r": r} for t, r in d["items"]] for d in PD.DIMENSIONS},
           "pats": [{k: p[k] for k in ("id", "icon", "fa", "rule", "min")} for p in PD.PATTERNS],
           "weights": PD.TPS_WEIGHTS, "min": PD.MIN_TRADES, "tradeOnly": PD.TRADE_ONLY}

    body = f'''<div id="ps" data-page="psych">
<div class="meta"><a href="/">خانه</a> / <a href="/academy/">آکادمی</a> / روان‌شناسی معامله‌گر</div>
<h1>🧠 سامانهٔ هوش روان‌شناسی معامله‌گر</h1>
<p class="txt">این بخش ذهن شما را به داده تبدیل می‌کند: چه چیزی گفتید، در معامله واقعاً چه کردید، و فاصلهٔ این دو کجاست.
همهٔ محاسبه در مرورگر خودتان انجام می‌شود و هیچ داده‌ای جایی فرستاده نمی‌شود.</p>
<div class="ps-warn"><b>پیش از شروع بخوانید.</b>
پرسشنامه‌های این بخش <b>ابزار اختصاصی این محصول</b> هستند و آزمون روان‌شناختی اعتبارسنجی‌شده نیستند.
خروجی آن‌ها تشخیص بالینی نیست و جای روان‌شناس یا روان‌پزشک را نمی‌گیرد. الگوهای رفتاری به‌صورت
<b>فرضیه</b> گزارش می‌شوند، نه حکم قطعی. نمای مغز هم یک <b>استعارهٔ بصری</b> از شاخص‌های رفتاری است،
نه تصویر فعالیت واقعی مغز شما.</div>
{nav()}

<section class="ps-pane on" data-p="over">
  <div class="ps-kpis" id="psKpi"></div>
  <div class="ps-grid2">
    <div class="ps-card"><h3>رادار ده‌محوره</h3><div id="psRadar"></div>
      <p class="note">خاکستری یعنی هنوز دادهٔ کافی برای آن محور نیست.</p></div>
    <div class="ps-card"><h3>آنچه بیشترین اثر را دارد</h3><div id="psTop"></div></div>
  </div>
  <div class="ps-card"><h3>شکاف گفته و کرده</h3><div id="psGap"></div>
    <p class="note">اختلاف میان چیزی که در پرسشنامه دربارهٔ خودتان گفتید و چیزی که در معامله‌ها انجام دادید.</p></div>
</section>

<section class="ps-pane" data-p="twin">
  <div class="ps-card"><h3>Digital Trader Twin</h3>
    <p class="note">نواحی این مدل، <b>استعارهٔ</b> ده بُعد رفتاری‌اند. رنگ هر ناحیه از دادهٔ خود شما می‌آید:
    سبز یعنی پایدار، نارنجی یعنی در حال توسعه، قرمز یعنی نیازمند توجه و خاکستری یعنی دادهٔ ناکافی.
    این نقشه هیچ ادعایی دربارهٔ فعالیت واقعی مغز شما ندارد.</p>
    <div id="psTwin" class="ps-twin"></div>
    <div id="psTwinInfo" class="ps-twininfo"></div>
  </div>
</section>

<section class="ps-pane" data-p="test">
  <div class="ps-card"><h3>مرکز آزمون — ده بُعد، شصت گویه</h3>
  <p class="note">بر اساس رفتار دو هفتهٔ گذشتهٔ خودتان پاسخ دهید، نه بر اساس آنچه دوست دارید باشید.
  بعضی گویه‌ها معکوس نمره‌گذاری می‌شوند تا پاسخ‌دادن خودکار بی‌اثر شود.</p>
  {dimension_cards()}
  <div class="ps-bar"><button class="ac-btn" id="psSave">ثبت پاسخ‌ها و محاسبه</button>
  <button class="ac-btn ghost" id="psClearTest">پاک‌کردن پاسخ‌ها</button><span id="psTestMsg" class="note"></span></div>
  </div>
</section>

<section class="ps-pane" data-p="emo">
  <div class="ps-card"><h3>ثبت لحظه‌ای هیجان</h3>
  <p class="note">هر وقت چیزی حس کردید ثبتش کنید؛ همین ثبت ساده، خودش رفتار را تغییر می‌دهد.</p>
  <div class="ps-form" id="psEmoForm"></div><div id="psEmoList"></div></div>
</section>

<section class="ps-pane" data-p="beh">
  <div class="ps-card"><h3>دوازده الگوی رفتاری</h3>
  <p class="note">هر الگو یک قاعدهٔ قطعی روی دادهٔ معاملات شماست. جایی که نمونه کافی نیست،
  به‌جای حدس، «دادهٔ ناکافی» نوشته می‌شود.</p>
  <div class="ps-pats">{pattern_cards()}</div></div>
</section>

<section class="ps-pane" data-p="jr">
  <div class="ps-card"><h3>ژورنال رفتاری</h3>
  <p class="note">فیلدهای پلن و ریسک همان چیزی هستند که شاخص‌ها از آن‌ها ساخته می‌شوند.
  هر چه کامل‌تر پر کنید، تحلیل دقیق‌تر می‌شود — و هر معاملهٔ ناقص، به‌جای قضاوت، کنار گذاشته می‌شود.</p>
  <div class="ps-form" id="psJForm"></div>
  <div class="ps-bar"><button class="ac-btn" id="psJAdd">افزودن</button>
    <label class="ac-btn ghost" for="psCsv">⬆ ورود CSV</label><input id="psCsv" type="file" accept=".csv,text/csv" hidden>
    <button class="ac-btn ghost" id="psFromLab">🧪 آوردن از ژورنال آزمایشگاه</button>
    <button class="ac-btn ghost" id="psJCsv">⬇ خروجی CSV</button>
    <span id="psJMsg" class="note"></span></div>
  <div class="ps-scroll"><table class="ps-tbl" id="psJTbl"></table></div></div>
</section>

<section class="ps-pane" data-p="dq">
  <div class="ps-card"><h3>آزمایشگاه کیفیت تصمیم</h3>
  <p class="note">دو امتیاز مستقل: کیفیت فرایند تصمیم، و نتیجهٔ مالی. معاملهٔ سودده خلاف پلن
  امتیاز تصمیم بالا نمی‌گیرد و معاملهٔ زیان‌ده طبق پلن امتیاز پایین نمی‌گیرد.</p>
  <div id="psDQ"></div></div>
</section>

<section class="ps-pane" data-p="heat">
  <div class="ps-card"><h3>نقشهٔ حرارتی رفتار</h3>
  <p class="note">نرخ تخلف به تفکیک روز هفته و ساعت. فقط وقتی نمایش داده می‌شود که نمونهٔ کافی باشد.</p>
  <div id="psHeat"></div></div>
</section>

<section class="ps-pane" data-p="time">
  <div class="ps-card"><h3>خط زمانی روان‌شناختی</h3>
  <p class="note">معامله‌ها، هیجان‌های ثبت‌شده و تخلف‌ها کنار هم. روی هر رویداد بزنید تا زنجیرهٔ احتمالی را ببینید.</p>
  <div id="psTime"></div></div>
</section>

<section class="ps-pane" data-p="daily">
  <div class="ps-card"><h3>پیش از معامله</h3><div class="ps-form" id="psPre"></div>
    <button class="ac-btn" id="psPreGo">سنجش آمادگی</button><div id="psPreOut"></div></div>
  <div class="ps-card"><h3>حین معامله</h3><div id="psMid"></div></div>
  <div class="ps-card"><h3>پس از معامله</h3><div class="ps-form" id="psPost"></div>
    <button class="ac-btn" id="psPostGo">ثبت مرور</button><div id="psPostOut"></div></div>
</section>

<section class="ps-pane" data-p="prog">
  <div class="ps-card"><h3>روند در طول زمان</h3><div id="psProg"></div>
  <p class="note">هر نقطه یک اسنپ‌شات هفتگی است. تا وقتی دست‌کم دو اسنپ‌شات نباشد، روندی نشان داده نمی‌شود.</p></div>
</section>

<section class="ps-pane" data-p="learn">
  <div class="ps-card"><h3>ده بُعد — آموزش</h3>{learn_cards()}</div>
  <div class="ps-card"><h3>پروتکل‌های تمرین</h3>
  <p class="note">این‌ها ابزار خودیاری و آموزش رفتارند، نه روان‌درمانی بالینی. اگر فشار روانی‌تان از
  حد معامله فراتر رفته، سراغ متخصص بروید.</p>{protocol_cards()}</div>
</section>

<section class="ps-pane" data-p="rep">
  <div class="ps-card"><h3>گزارش دوره‌ای</h3>
  <div class="ps-bar"><button class="ac-btn" id="psRepGo">ساخت گزارش</button>
    <button class="ac-btn ghost" id="psPrint">🖨 چاپ یا PDF</button></div>
  <div id="psRep"></div></div>
</section>

<section class="ps-pane" data-p="set">
  <div class="ps-card"><h3>تنظیمات</h3><div class="ps-form" id="psSet"></div>
  <div class="ps-bar"><button class="ac-btn" id="psSetSave">ذخیره</button></div></div>
  <div class="ps-card"><h3>دادهٔ شما</h3>
  <p class="note">همهٔ داده فقط در همین مرورگر ذخیره می‌شود. ما نسخه‌ای از آن نداریم و نمی‌توانیم بازیابی‌اش کنیم،
  پس هر چند وقت یک بار پشتیبان بگیرید.</p>
  <div class="ps-bar"><button class="ac-btn ghost" id="psExport">⬇ خروجی کامل (JSON)</button>
    <label class="ac-btn ghost" for="psImport">⬆ بازگردانی</label><input id="psImport" type="file" accept=".json" hidden>
    <button class="ac-btn ghost" id="psBot">🤖 کد همگام‌سازی ربات</button>
    <button class="ac-btn ghost danger" id="psWipe">حذف همهٔ داده</button></div>
  <div id="psDataMsg" class="note"></div></div>
</section>
</div>
<script>window.PSY_CFG = {json.dumps(cfg, ensure_ascii=False)};</script>
<script src="/assets/psych-core.js?v={VER}" defer></script>
<script src="/assets/psych.js?v={VER}" defer></script>
<script src="/assets/psych-voice.js?v={VER}" defer></script>'''

    return BP.page(OUT, "روان‌شناسی معامله‌گر — سنجش، تحلیل و تمرین | آکادمی انتخاب",
                   "سامانهٔ سنجش و تمرین روان‌شناسی معامله‌گری: ده بُعد رفتاری، دوازده الگوی مخرب، "
                   "کیفیت تصمیم مستقل از سود و زیان، ژورنال رفتاری و مغز سه‌بعدی تعاملی — همه در مرورگر خودتان.",
                   body, head())


if __name__ == "__main__":
    u = build()
    print("psychology page built:", u)
