#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
صفحهٔ «میزگرد» — /roundtable/  (فارسی / کوردی سورانی / English)

میزگرد مشاورهٔ انتخاب: پنج تحلیل‌گر هوش مصنوعی با تخصص‌های جدا هر روز یک تصمیم بازار را
جلوی هم می‌گذارند، شواهدشان را می‌آورند، اختلافشان ثبت می‌شود و رأی‌شان در «دفتر عملکرد
سیگنال‌ها» قفل می‌شود تا دقتشان در طول زمان قابل‌سنجش باشد.

این صفحه سه چیز را کنار هم می‌گذارد:
  ۱. نتیجهٔ میزگرد امروز و شواهد هر صندلی
  ۲. کارنامهٔ واقعی هر صندلی (از data/ledger.json)
  ۳. راهنمای «چطور سؤال بپرسم» با فرم ساخت پرسش و دستورهای کوتاه

هیچ صندلی‌ای به نام یک آدم واقعی نیست: هر صندلی یک تخصص است، نه یک شخص.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
import reality_common as R  # noqa: E402

e = BP.e
L = R.L
TG_GROUP = "Coin_Kurd_Group"

SEATS = {
    "technical": (L("صندلی تکنیکال", "کورسیی تەکنیکی", "Technical seat"),
                  L("نمودار چه می‌گوید؟ روند، سطح‌ها، اندیکاتورها.", "هێڵکاری چی دەڵێت؟ ئاڕاستە و ئاستەکان.", "What does the chart say — trend, levels, indicators?")),
    "derivatives": (L("صندلی مشتقات", "کورسیی مەشتەقە", "Derivatives seat"),
                    L("پول اهرم‌دار کجاست؟ فاندینگ، اوپن‌اینترست، لیکوئید.", "پارەی لیڤەرەج لە کوێیە؟ فاندینگ و OI.", "Where is leveraged money — funding, open interest, liquidations?")),
    "sentiment": (L("صندلی احساسات", "کورسیی هەست", "Sentiment seat"),
                  L("بازار چه حسی دارد؟ ترس و طمع، اخبار، جریان ETF.", "بازاڕ چ هەستێکی هەیە؟ ترس و تەماح و هەواڵ.", "How does the market feel — fear and greed, news, ETF flows?")),
    "macro": (L("صندلی کلان", "کورسیی ماکرۆ", "Macro seat"),
              L("بیرون از کریپتو چه خبر است؟ دلار، نرخ بهره، بازار سهام.", "لە دەرەوەی کریپتۆ چی هەیە؟ دۆلار و ڕێژەی سوو.", "What is happening outside crypto — the dollar, rates, equities?")),
    "history": (L("صندلی تاریخ بازار", "کورسیی مێژووی بازاڕ", "Market-history seat"),
                L("قبلاً در شرایط مشابه چه شد؟ نمونه‌های تاریخی و احتمال‌ها.", "پێشتر لە دۆخی هاوشێوەدا چی ڕوویدا؟", "What happened last time conditions looked like this?")),
}
STANCE = {
    "bullish": ("#22c55e", L("صعودی", "بەرزبوونەوە", "Bullish")),
    "bearish": ("#ef4444", L("نزولی", "دابەزین", "Bearish")),
    "neutral": ("#eab308", L("خنثی", "بێلایەن", "Neutral")),
}
S = {
    "title": L("میزگرد — مشاورهٔ هوش مصنوعی انتخاب", "میزگرد — ئامۆژگاریی AIی Entekhab", "The Roundtable — Entekhab's AI council"),
    "desc": L("پنج تحلیل‌گر هوش مصنوعی با پنج تخصص جدا، هر روز یک تصمیم بازار را جلوی هم می‌گذارند؛ شواهد هر کدام، اختلافشان و کارنامهٔ دقتشان همین‌جا باز است.",
              "پێنج شیکارکەری AI بە پێنج پسپۆڕیی جیاواز، هەموو ڕۆژێک بڕیارێکی بازاڕ تاوتوێ دەکەن.",
              "Five AI analysts, five separate specialities, put one market decision to each other every day — with their evidence, their disagreements and their accuracy record all open here."),
    "verdict": L("نتیجهٔ میزگرد امروز", "ئەنجامی میزگردی ئەمڕۆ", "Today's verdict"),
    "disagree": L("جایی که اختلاف داشتند", "ئەو شوێنەی ناکۆک بوون", "Where they disagreed"),
    "seats": L("صندلی‌های میزگرد", "کورسییەکانی میزگرد", "The seats"),
    "evidence": L("شواهدی که آورد", "بەڵگەکانی", "Evidence it brought"),
    "conf": L("اطمینان", "متمانە", "Confidence"),
    "record": L("کارنامه", "کارنامە", "Record"),
    "acc": L("دقت {a} در {n} رأی تعیین‌تکلیف‌شده", "وردیی {a} لە {n} دەنگدا", "{a} accuracy over {n} decided calls"),
    "norec": L("هنوز رأی تعیین‌تکلیف‌شده‌ای ندارد", "هێشتا دەنگی یەکلابووەوەی نییە", "No decided calls yet"),
    "early": L("در حال جمع‌آوری کارنامه ({n} رأی تا حالا — زیر ۵ رأی عدد دقت معنا ندارد)",
               "لە کۆکردنەوەی کارنامەدایە ({n} دەنگ تا ئێستا)", "Still building a record ({n} calls so far — accuracy means little under 5)"),
    "how": L("چطور سؤال بپرسم؟", "چۆن پرسیار بکەم؟", "How do I ask?"),
    "how_lead": L("میزگرد وقتی خوب جواب می‌دهد که سؤال کامل باشد. این شش تکه را بدهید تا به‌جای یک جواب کلی، یک تصمیم بگیرید:",
                  "میزگرد کاتێک باش وەڵام دەداتەوە کە پرسیارەکە تەواو بێت. ئەم شەش بەشە بدە:",
                  "The roundtable is only as good as the question. Give it these six pieces and you get a decision instead of a generic answer:"),
    "build": L("سؤالتان را اینجا بسازید", "پرسیارەکەت لێرە دروست بکە", "Build your question here"),
    "copy": L("کپی سؤال", "کۆپیی پرسیار", "Copy the question"),
    "copied": L("کپی شد", "کۆپی کرا", "Copied"),
    "eg": L("مثال", "نموونە", "Example"),
    "ask_tg": L("پرسیدن در گروه تلگرام", "پرسین لە گرووپی تەلەگرام", "Ask in the Telegram group"),
    "cmds": L("دستورهای کوتاه", "فەرمانە کورتەکان", "Short commands"),
    "cmds_lead": L("اول خط سؤالتان یکی از این‌ها را بگذارید تا معلوم باشد از میزگرد چه می‌خواهید:",
                   "لە سەرەتای پرسیارەکەت یەکێک لەمانە دابنێ:",
                   "Start your question with one of these so the table knows what you want:"),
    "note": L("میزگرد ابزار آموزشی است و توصیهٔ مالی نیست. هیچ صندلی‌ای نمایندهٔ یک آدم واقعی نیست؛ هر صندلی یک تخصص است.",
              "میزگرد ئامرازێکی فێرکارییە و ئامۆژگاریی دارایی نییە. هیچ کورسییەک نوێنەری کەسێکی ڕاستەقینە نییە.",
              "The roundtable is an educational tool, not financial advice. No seat represents a real person — each seat is a speciality."),
    "ledger": L("رأی هر صندلی در لحظهٔ صدور قفل می‌شود و نتیجه‌اش خودکار حساب می‌گردد.", "دەنگی هەر کورسییەک لە ساتی دەرچووندا قوفڵ دەکرێت.",
                "Each seat's vote is locked the moment it is cast and settled automatically."),
    "ledger_link": L("دیدن دفتر کامل", "بینینی تۆماری تەواو", "See the full ledger"),
    "nodata": L("هنوز میزگردی ثبت نشده؛ اولین اجرا به‌زودی.", "هێشتا میزگردێک تۆمار نەکراوە.", "No session recorded yet — the first run is coming up."),
}
# the six pieces a good question has
PIECES = L(
    [("تصمیم", "در یک خط: دقیقاً بین چه چیزی مرددید؟", "بین نگه‌داشتن و فروش بیت‌کوین مردد هستم"),
     ("گزینه‌ها", "دو یا سه گزینه. «همین کاری که الان می‌کنم» هم یک گزینه است.", "همه را بفروشم / نصفش را بفروشم / دست نزنم"),
     ("عددها", "سرمایه، سهم این دارایی از کل، قیمت میانگین خریدتان.", "۳۰۰ میلیون تومان، ۶۰٪ پرتفوی، میانگین خرید ۸۲ هزار دلار"),
     ("محدودیت‌ها", "افق زمانی، پولی که نباید از دست برود، میزان تحملتان.", "تا اسفند به این پول نیاز ندارم، بیشتر از ۲۰٪ ضرر را تحمل نمی‌کنم"),
     ("موفقیت یعنی چه", "چه چیزی برایتان یعنی این تصمیم درست بود، و تا کی.", "تا اسفند حفظ قدرت خرید تومانی"),
     ("الان به کدام سمت متمایلید", "و چرا. میزگرد همین تمایل را به چالش می‌کشد، نه اینکه تأییدش کند.", "متمایل به فروش نصف، چون خبرها بد است")],
    [("بڕیار", "لە یەک دێڕدا: لە نێوان چی دوودڵیت؟", "لە نێوان هێشتنەوە و فرۆشتنی بیتکۆین دوودڵم"),
     ("هەڵبژاردەکان", "دوو یان سێ هەڵبژاردە.", "هەمووی بفرۆشم / نیوەی بفرۆشم / دەستی لێ نەدەم"),
     ("ژمارەکان", "سەرمایە، پشکی ئەم دارایییە، نرخی ناوەندیی کڕین.", "٣٠٠ ملیۆن تمەن، ٦٠٪ی پۆرتفۆلیۆ"),
     ("سنوورەکان", "ماوەی کات، ئەو پارەی نابێت لەدەست بچێت.", "تا ئازار پێویستم پێی نییە"),
     ("سەرکەوتن واتە چی", "چی بۆ تۆ واتە بڕیارەکە ڕاست بوو.", "پاراستنی هێزی کڕین بە تمەن"),
     ("ئێستا بەرەو کوێ لاتە", "و بۆچی. میزگرد هەر ئەم لایەنگرییە تاقی دەکاتەوە.", "بەرەو فرۆشتنی نیوەی")],
    [("The decision", "In one line: what exactly are you torn between?", "I'm torn between holding and selling my bitcoin"),
     ("Your options", "Two or three. “keep doing what I do now” counts.", "Sell all / sell half / do nothing"),
     ("Your numbers", "Capital, this asset's share of the portfolio, your average entry.", "300M toman, 60% of the portfolio, average entry $82k"),
     ("Your limits", "Time horizon, money that must not be lost, how much you can stomach.", "I don't need this money until March; I can't take more than a 20% drawdown"),
     ("What success looks like", "What would make this the right call, and by when.", "Keeping my toman purchasing power through March"),
     ("Which way you're leaning", "And why. The table tests that lean instead of agreeing with it.", "Leaning toward selling half, because the news looks bad")])

CMDS = L(
    [("/میزگرد", "تصمیم کامل: هر پنج صندلی بحث می‌کنند و نتیجه می‌دهند."),
     ("/میزگرد سریع", "تصمیم کوچک و قابل‌برگشت: کوتاه‌تر و سریع‌تر."),
     ("/میزگرد تکنیکال", "فقط یک صندلی؛ به‌جای تکنیکال هر تخصص دیگری را هم می‌شود نوشت."),
     ("/میزگرد ریسک", "همان تصمیم، اما فقط از زاویهٔ آنچه ممکن است خراب شود.")],
    [("/میزگرد", "بڕیاری تەواو: هەر پێنج کورسی."),
     ("/میزگرد سریع", "بڕیاری بچووک و گەڕانەوەپێکراو."),
     ("/میزگرد تکنیکال", "تەنها یەک کورسی."),
     ("/میزگرد ریسک", "هەمان بڕیار، تەنها لە ڕووی مەترسییەوە.")],
    [("/roundtable", "A full decision: all five seats argue and return a verdict."),
     ("/roundtable quick", "A small, reversible call: shorter and faster."),
     ("/roundtable technical", "One seat only — name any speciality instead of technical."),
     ("/roundtable risk", "The same decision, but only from the angle of what could go wrong.")])


def s(k, lg, **kw):
    t = S[k].get(lg) or S[k]["fa"]
    return t.format(**kw) if kw else t


def tx(d, lg):
    return d.get(lg) or d.get("fa") or ""


CSS = """
.rt-seat{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:15px 17px}
.rt-seat h3{margin:0 0 4px;font-size:1rem;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.rt-seat .q{color:var(--mute);font-size:.84rem;margin:0 0 10px;line-height:1.8}
.rt-ev{margin:8px 0 0;padding-inline-start:18px}.rt-ev li{margin:5px 0;line-height:1.9;font-size:.9rem}
.rt-dots{display:inline-flex;gap:3px;vertical-align:middle}
.rt-dots i{width:7px;height:7px;border-radius:50%;background:#ffffff22;display:inline-block}
.rt-dots i.on{background:var(--acc)}
.rt-rec{font-size:.8rem;color:var(--mute);border-top:1px solid var(--line);margin-top:11px;padding-top:9px}
.rt-piece{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 15px;margin:9px 0}
.rt-piece b{color:var(--acc)}.rt-piece p{margin:4px 0;font-size:.89rem;line-height:1.9;color:#d6d6d0}
.rt-piece textarea{width:100%;background:#000;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 11px;font:inherit;font-size:.9rem;margin-top:7px;resize:vertical;min-height:46px}
.rt-piece textarea:focus{outline:0;border-color:var(--acc)}
.rt-piece .eg{font-size:.8rem;color:#7d7d77}
.rt-cmd{display:grid;grid-template-columns:auto 1fr;gap:8px 14px;align-items:baseline;margin:10px 0}
.rt-cmd code{background:#000;border:1px solid var(--line);border-radius:8px;padding:3px 10px;color:var(--acc);font-size:.86rem;white-space:nowrap;direction:ltr;unicode-bidi:isolate;display:inline-block}
.rt-cmd span{font-size:.88rem;color:#d6d6d0;line-height:1.85}
.rt-out{background:#000;border:1px solid var(--line);border-radius:12px;padding:12px 14px;white-space:pre-wrap;font-size:.9rem;line-height:1.95;margin:10px 0;min-height:60px}
.rt-acts{display:flex;gap:9px;flex-wrap:wrap}
.rt-tg{background:#229ED9;color:#fff;border:0;border-radius:99px;padding:9px 18px;font:inherit;font-weight:700;cursor:pointer;font-size:.88rem}
.rt-cp{background:var(--acc);color:#000;border:0;border-radius:99px;padding:9px 18px;font:inherit;font-weight:800;cursor:pointer;font-size:.88rem}
"""

JS = r"""
document.querySelectorAll('.rt-builder').forEach(function(b){
 var outs=b.querySelector('.rt-out'),tas=[].slice.call(b.querySelectorAll('textarea'));
 function build(){
   var cmd=b.querySelector('.rt-cmdsel')?b.querySelector('.rt-cmdsel').value:'';
   var parts=tas.filter(function(t){return t.value.trim()}).map(function(t){return t.dataset.label+': '+t.value.trim()});
   var txt=(cmd?cmd+' ':'')+(parts.length?'\n'+parts.join('\n'):'');
   outs.textContent=txt.trim()||b.dataset.empty;b.__txt=txt.trim();
 }
 tas.forEach(function(t){t.addEventListener('input',build)});
 if(b.querySelector('.rt-cmdsel'))b.querySelector('.rt-cmdsel').addEventListener('change',build);
 b.querySelector('.rt-cp').onclick=function(){var x=this;try{navigator.clipboard.writeText(b.__txt||'');x.textContent=b.dataset.copied}catch(e){}};
 b.querySelector('.rt-tg').onclick=function(){
   try{navigator.clipboard.writeText(b.__txt||'')}catch(e){}
   var a=document.createElement('a');a.href='https://t.me/__GROUP__';a.target='_blank';a.rel='noopener';
   document.body.appendChild(a);a.click();a.remove();};
 build();
});"""


def seat_card(sid, agent, led_stats, lg):
    name, question = SEATS[sid]
    col, label = STANCE.get((agent or {}).get("stance"), ("#94a3b8", L("—", "—", "—")))
    conf = int((agent or {}).get("confidence") or 0)
    dots = "".join(f'<i class="{"on" if i < conf else ""}"></i>' for i in range(5))
    ev = ((agent or {}).get(lg) or {}).get("evidence") or []
    lis = "".join(f"<li>{e(x)}</li>" for x in ev[:4])
    st = led_stats.get(f"council.{sid}") or {}
    n = (st.get("win") or 0) + (st.get("loss") or 0)
    if n >= 5:                     # same bar as the ledger: fewer decided calls and the percentage is noise
        rec = s("acc", lg, a=BR.nf(st.get("acc"), lg, 0, pct=True), n=BR.nf(n, lg))
    elif n:
        rec = s("early", lg, n=BR.nf(n, lg))
    else:
        rec = s("norec", lg)
    return (f'<div class="rt-seat"><h3>{e(tx(name, lg))} '
            f'<span class="rc-badge" style="--c:{col}">{e(tx(label, lg))}</span></h3>'
            f'<p class="q">{e(tx(question, lg))}</p>'
            f'<p class="mut" style="font-size:.82rem">{s("conf", lg)} <span class="rt-dots">{dots}</span></p>'
            + (f'<p style="font-size:.85rem;margin:9px 0 0"><b>{s("evidence", lg)}</b></p><ul class="rt-ev">{lis}</ul>' if lis else "")
            + f'<p class="rt-rec">{rec}</p></div>')


def builder(lg):
    pieces = PIECES.get(lg) or PIECES["fa"]
    cmds = CMDS.get(lg) or CMDS["fa"]
    opts = "".join(f'<option value="{e(c)}">{e(c)} — {e(d)}</option>' for c, d in cmds)
    rows = "".join(f'<div class="rt-piece"><b>{e(t)}</b><p>{e(d)}</p>'
                   f'<textarea rows="1" data-label="{e(t)}" placeholder="{e(eg)}"></textarea>'
                   f'<div class="eg">{s("eg", lg)}: {e(eg)}</div></div>' for t, d, eg in pieces)
    empty = {"fa": "سؤالتان اینجا ساخته می‌شود…", "ckb": "پرسیارەکەت لێرە دروست دەبێت…", "en": "Your question appears here…"}[lg]
    return (f'<div class="rt-builder" data-empty="{e(empty)}" data-copied="{e(s("copied", lg))}">'
            f'<p><select class="rt-cmdsel" style="background:#000;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px 12px;font:inherit;font-size:.88rem;max-width:100%">{opts}</select></p>'
            f'{rows}<div class="rt-out"></div>'
            f'<div class="rt-acts"><button type="button" class="rt-cp">{s("copy", lg)}</button>'
            f'<button type="button" class="rt-tg">✈ {s("ask_tg", lg)}</button></div></div>')


def build():
    c = R.load("council.json", {})
    led = R.load("ledger.json", {})
    stats = led.get("stats", {})
    council = c.get("council") or {}
    agents = {a["id"]: a for a in council.get("agents", [])}

    def b(lg):
        h = (f'<div class="meta"><a href="/">{BR.s("home", lg)}</a> / <a href="/reality/">{BR.s("hub", lg)}</a> / {e(s("title", lg))}</div>'
             f'<h1>{e(s("title", lg))}</h1><p class="rc-lead">{e(s("desc", lg))}</p>')
        v = council.get(lg) or council.get("fa") or {}
        if v.get("summary"):
            dis = "".join(f"<li>{e(x)}</li>" for x in (v.get("disagreements") or [])[:3])
            h += BR.sec(s("verdict", lg),
                        f'<div class="rc-card"><p style="line-height:2">{e(v["summary"])}</p>'
                        + (f'<p style="margin-top:10px"><b>{s("disagree", lg)}</b></p><ul class="rt-ev">{dis}</ul>' if dis else "")
                        + f'<p class="note">{BR.s("upd", lg)}: {BR.fdate(c.get("at"), lg, True)}</p></div>', "verdict")
        else:
            h += f'<p class="note">{s("nodata", lg)}</p>'
        cards = "".join(seat_card(sid, agents.get(sid), stats, lg) for sid in SEATS)
        h += BR.sec(s("seats", lg), f'<div class="rc-grid">{cards}</div>'
                    f'<p class="note">{s("ledger", lg)} <a href="/ledger/#src-council.majority">{s("ledger_link", lg)} ←</a></p>', "seats")
        cmds = CMDS.get(lg) or CMDS["fa"]
        crows = "".join(f'<code>{e(k)}</code><span>{e(d)}</span>' for k, d in cmds)
        h += BR.sec(s("how", lg),
                    f'<p class="rc-lead">{e(s("how_lead", lg))}</p>'
                    f'<h3>{s("cmds", lg)}</h3><p class="mut" style="font-size:.88rem">{e(s("cmds_lead", lg))}</p>'
                    f'<div class="rt-cmd">{crows}</div>'
                    f'<h3>{s("build", lg)}</h3>{builder(lg)}', "how")
        h += f'<p class="note">{e(s("note", lg))}</p>'
        return h

    body = BR.finish("", BR.tri(b), JS.replace("__GROUP__", TG_GROUP))
    extra = f"<style>{BR.RCSS}{CSS}</style>"
    return BP.page("roundtable/", S["title"]["fa"], S["desc"]["fa"], body, extra)


def main():
    url = build()
    BR.add_to_sitemap([url])
    print("roundtable page:", url)


if __name__ == "__main__":
    main()
