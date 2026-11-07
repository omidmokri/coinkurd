#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
صفحهٔ «ماشین حساب هزینه فرصت تومان» — /opportunity/  (فارسی / کوردی سورانی / English)

کاربر ارز، تاریخ خرید و مبلغ را می‌دهد؛ صفحه چهار سناریو را کنار هم می‌گذارد:
رمزارز، دلار آزاد، طلای ۱۸ عیار و سپردهٔ بانکی — همه به تومان، با نمودار و دکمهٔ اشتراک‌گذاری تلگرام.
همهٔ محاسبه در مرورگر روی data/opportunity.json انجام می‌شود.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
import reality_common as R  # noqa: E402

e = BP.e
L = R.L
S = {
    "title": L("ماشین حساب هزینه فرصت تومان", "ژمێرەری تێچووی دەرفەتی تمەن", "Toman Opportunity Cost Calculator"),
    "desc": L("اگر همان پول را به‌جای رمزارز، دلار آزاد یا طلا یا سپردهٔ بانکی نگه می‌داشتید، امروز چقدر داشتید؟ مقایسه به تومان، با دادهٔ واقعی بازار ایران.",
              "ئەگەر هەمان پارەت لە جیاتی کریپتۆ، بە دۆلاری ئازاد یان زێڕ یان پارێزراوی بانکی هێشتبایەوە، ئەمڕۆ چەندت دەبوو؟",
              "If you had held free-market dollars, gold or a bank deposit instead of that coin, what would you have today? Compared in toman, with real Iranian market data."),
    "coin": L("ارز", "دراو", "Coin"),
    "date": L("تاریخ خرید", "بەرواری کڕین", "Purchase date"),
    "amount": L("مبلغ (تومان)", "بڕ (تمەن)", "Amount (toman)"),
    "rate": L("سود سالانهٔ سپرده", "قازانجی ساڵانەی پارێزراو", "Annual deposit rate"),
    "rate_note": L("فرض پیش‌فرض است؛ نرخ بانک خودتان را بگذارید.", "گریمانەیە؛ ڕێژەی بانکی خۆت دابنێ.", "This is an assumption — use your own bank's rate."),
    "calc": L("محاسبه کن", "بیژمێرە", "Calculate"),
    "today": L("ارزش امروز", "نرخی ئەمڕۆ", "Value today"),
    "profit": L("سود", "قازانج", "Gain"),
    "loss": L("زیان", "زیان", "Loss"),
    "best": L("بهترین", "باشترین", "Best"),
    "worst": L("بدترین", "خراپترین", "Worst"),
    "vs_best": L("نسبت به بهترین گزینه", "بەراورد لەگەڵ باشترین", "vs the best option"),
    "chart": L("ارزش هر گزینه از روز خرید تا امروز (تومان)", "نرخی هەر هەڵبژاردەیەک لە ڕۆژی کڕینەوە (تمەن)", "Value of each option since the purchase date (toman)"),
    "share": L("اشتراک‌گذاری نتیجه در تلگرام", "بڵاوکردنەوە لە تەلەگرام", "Share this result on Telegram"),
    "copy": L("کپی متن نتیجه", "کۆپیی دەق", "Copy the result"),
    "copied": L("کپی شد", "کۆپی کرا", "Copied"),
    "range": L("دادهٔ موجود از {a} تا {b} — بازهٔ تاریخی هر روز بلندتر می‌شود.", "داتا لە {a} تا {b} — ڕۆژ بە ڕۆژ درێژتر دەبێت.",
               "Data available from {a} to {b} — the range grows every day."),
    "nodata": L("هنوز دادهٔ کافی جمع نشده؛ به‌زودی.", "هێشتا داتای پێویست کۆ نەبووەتەوە.", "Not enough data collected yet."),
    "pick_date": L("تاریخ را در بازهٔ موجود انتخاب کنید.", "بەروار لە ماوەی بەردەستدا هەڵبژێرە.", "Pick a date inside the available range."),
    "result_for": L("اگر در {d} به ارزش {a} تومان {c} می‌خریدید:", "ئەگەر لە {d} بە بڕی {a} تمەن {c}ت بکڕیایە:", "If on {d} you had put {a} toman into {c}:"),
    "head_note": L("این ابزار آموزشی است و توصیهٔ مالی نیست. گذشته تضمین آینده نیست.",
                   "ئەمە فێرکارییە و ئامۆژگاریی دارایی نییە.", "Educational only — not financial advice. The past does not guarantee the future."),
    "amount_help": L("مثلاً ۱۰۰٬۰۰۰٬۰۰۰", "بۆ نموونە ١٠٠٬٠٠٠٬٠٠٠", "e.g. 100,000,000"),
    "toman": L("تومان", "تمەن", "toman"),
    "method": L("روش محاسبه", "شێوازی ژماردن", "Method"),
    "twins": L("تا وقتی تاریخچهٔ تابلوی داخلی کوتاه است، طلا و سکه درصد یکسانی نشان می‌دهند، چون هر دو از یک انس جهانی و یک دلار ساخته شده‌اند؛ با جمع‌شدن نرخ واقعی روزها از هم جدا می‌شوند.",
               "تا مێژووی تابلۆی ناوخۆیی کورتە، زێڕ و سکە هەمان ڕێژە پیشان دەدەن، چونکە هەردووکیان لە یەک ئۆنس و یەک دۆلارەوە دروست بوون.",
               "While the domestic board history is short, gold and the coin show the same percentage — both are built from the same ounce and the same dollar. They separate as real board days accumulate."),
    "calib": L("طلا و سکه از انس جهانی بازسازی و با نرخ واقعی تابلو کالیبره می‌شوند (ضریب فعلی طلا {g} و سکه {c}).",
               "زێڕ و سکە لە ئۆنسی جیهانییەوە دروست دەکرێنەوە و کالیبرە دەکرێن (زێڕ {g}، سکە {c}).",
               "Gold and the coin are rebuilt from the global ounce and calibrated against the real board (current factors: gold {g}, coin {c})."),
    "sub": L("اگر به‌جای رمزارز، دلار یا طلا خریده بودید الان چقدر داشتید؟", "ئەگەر لە جیاتی کریپتۆ، دۆلار یان زێڕت بکڕیایە ئێستا چەندت دەبوو؟",
             "Had you bought dollars or gold instead of crypto, what would you have now?"),
    "mode_t": L("مبلغ به تومان", "بڕ بە تمەن", "Amount in toman"),
    "mode_c": L("مقدار ارز", "بڕی دراو", "Coin quantity"),
    "qty": L("تعداد ارز", "ژمارەی دراو", "Coin quantity"),
    "qty_help": L("مثلاً ۰٫۵", "بۆ نموونە ٠٫٥", "e.g. 0.5"),
    "q1": L("۱ ماه پیش", "١ مانگ لەمەوبەر", "1 month ago"), "q3": L("۳ ماه پیش", "٣ مانگ لەمەوبەر", "3 months ago"),
    "q6": L("۶ ماه پیش", "٦ مانگ لەمەوبەر", "6 months ago"), "q12": L("۱ سال پیش", "١ ساڵ لەمەوبەر", "1 year ago"),
    "q24": L("شروع ۲۰۲۴", "سەرەتای ٢٠٢٤", "Start of 2024"),
    "clamped": L("دادهٔ قیمت از {a} به بعد موجود است؛ محاسبه از اولین روز موجود انجام شد.",
                 "داتای نرخ لە {a}ەوە هەیە؛ ژماردن لە یەکەم ڕۆژی بەردەستەوە کرا.",
                 "Price data starts on {a}; the calculation used the first available day."),
    "nodate": L("برای این تاریخ داده قیمت در دسترس نیست. تاریخ نزدیک‌تر را امتحان کنید.",
                "بۆ ئەم بەروارە داتای نرخ نییە. بەروارێکی نزیکتر تاقی بکەرەوە.",
                "No price data for this date. Try a more recent one."),
    "badamt": L("مبلغ یا مقدار را درست وارد کنید.", "بڕەکە بە دروستی بنووسە.", "Enter a valid amount."),
    "recalc": L("محاسبهٔ مجدد", "دووبارە بیژمێرە", "Recalculate"),
    "empty": L("پس از محاسبه نمایش داده می‌شود", "دوای ژماردن پیشان دەدرێت", "Shown after you calculate"),
    "card_coin": L("اگر {c} نگه می‌داشتید", "ئەگەر {c}ت هێشتبایەوە", "If you had kept {c}"),
    "card_usd": L("اگر دلار آزاد می‌خریدید", "ئەگەر دۆلاری ئازادت بکڕیایە", "If you had bought free-market dollars"),
    "card_gold": L("اگر طلای ۱۸ عیار می‌خریدید", "ئەگەر زێڕی ١٨ عەیارت بکڕیایە", "If you had bought 18k gold"),
    "card_coin2": L("اگر سکه امامی می‌خریدید", "ئەگەر سکەی ئیمامیت بکڕیایە", "If you had bought an Emami coin"),
    "card_dep": L("اگر در بانک سپرده می‌گذاشتید", "ئەگەر لە بانک دات بنایە", "If you had kept a bank deposit"),
    "initial": L("ارزش اولیه در تاریخ خرید: {v} تومان", "نرخی سەرەتا لە ڕۆژی کڕین: {v} تمەن", "Value on the purchase date: {v} toman"),
    "better": L("بهتر از {c}", "باشتر لە {c}", "better than {c}"), "worse": L("بدتر از {c}", "خراپتر لە {c}", "worse than {c}"),
    "r_buy": L("از تاریخ خرید", "لە ڕۆژی کڕینەوە", "Since purchase"), "r_30": L("۳۰ روز اخیر", "٣٠ ڕۆژی ڕابردوو", "Last 30 days"),
    "r_all": L("کل دوره", "هەموو ماوەکە", "Whole period"),
    "sum_vs": L("از {d} تا امروز، نگه‌داشتن {c} ارزش دارایی شما را {x}٪ {dir} از خرید دلار آزاد کرده است.",
                "لە {d}ەوە تا ئەمڕۆ، هێشتنەوەی {c} نرخی سامانەکەتی {x}٪ {dir} لە کڕینی دۆلاری ئازاد کردووە.",
                "From {d} to today, holding {c} left you {x}% {dir} than buying free-market dollars."),
    "sum_gold": L("در همین بازه طلای ۱۸ عیار {y}٪ {dir} از {c} عمل کرده است.",
                  "لە هەمان ماوەدا زێڕی ١٨ عەیار {y}٪ {dir} لە {c} بووە.",
                  "Over the same period 18k gold did {y}% {dir} than {c}."),
    "more": L("بیشتر", "زیاتر", "better off"), "less": L("کمتر", "کەمتر", "worse off"),
    "g_better": L("بهتر", "باشتر", "better"), "g_worse": L("بدتر", "خراپتر", "worse"),
    "img": L("ساخت تصویر نتیجه", "دروستکردنی وێنەی ئەنجام", "Make a result image"),
    "save": L("ذخیره در فضای من", "پاشەکەوت لە شوێنی من", "Save to My space"),
    "saved": L("ذخیره شد ✓", "پاشەکەوت کرا ✓", "Saved ✓"),
    "other_date": L("محاسبه با تاریخ دیگر", "ژماردن بە بەروارێکی تر", "Try another date"),
    "other_coin": L("مقایسه با ارز دیگر", "بەراورد لەگەڵ دراوێکی تر", "Compare another coin"),
    "learn": L("هزینه فرصت یعنی ارزشی که با انتخاب یک گزینه، از گزینه‌های دیگر از دست می‌دهید.",
               "تێچووی دەرفەت ئەو نرخەیە کە بە هەڵبژاردنی ڕێگایەک لە ڕێگاکانی تر لەدەستی دەدەیت.",
               "Opportunity cost is the value you give up from the other options when you choose one."),
    "img_buy": L("خرید", "کڕین", "Bought"), "img_now": L("محاسبه", "ژماردن", "Calculated"),
}
METHOD = L(
    ["همهٔ قیمت‌ها روزانه و در ساعت ۱۵:۳۰ تهران نمونه‌برداری می‌شوند.",
     "دلار آزاد و تتر از آرشیو کامل کانال‌های عمومی تیک قیمت (@NerkhDollarIRT و @USDTTetherp) خوانده می‌شوند.",
     "ارزش تومانی رمزارز = قیمت دلاری آن روز در Binance × نرخ تتر بازار ایران در همان روز؛ یعنی همان چیزی که واقعاً در ایران می‌پرداختید یا می‌گرفتید.",
     "طلای ۱۸ عیار و سکه از انس جهانی بازسازی می‌شوند — چون تابلوی داخلی پست‌های قدیمی را پاک می‌کند: (انس ÷ ۳۱٫۱۰۳۵) × عیار × دلار آزاد، سپس با نرخ واقعی روزهایی که داریم کالیبره می‌شود. برای روزهایی که نرخ واقعی تابلو را داریم، همان استفاده می‌شود.",
     "سپردهٔ بانکی با سود مرکب روزانه از نرخ سالانه‌ای که خودتان وارد می‌کنید حساب می‌شود؛ این عدد فرض شماست، نه نرخ اعلام‌شدهٔ بانک.",
     "کارمزد خرید و فروش، مالیات و اختلاف خرید/فروش صرافی در هیچ‌کدام از چهار سناریو حساب نشده است."],
    ["هەموو نرخەکان ڕۆژانە و لە کاتژمێر ١٥:٣٠ی تاران وەردەگیرێن.",
     "دۆلاری ئازاد و تەتەر لە ئەرشیفی کەناڵە گشتییەکانی نرخەوە دێن.",
     "نرخی تمەنیی کریپتۆ = نرخی دۆلاریی ئەو ڕۆژە لە Binance × تەتەری بازاڕی ئێران.",
     "زێڕ و سکە لە ئۆنسی جیهانییەوە دروست دەکرێنەوە و کالیبرە دەکرێن.",
     "پارێزراوی بانکی بە قازانجی ڕۆژانەی لێکدراو لەو ڕێژەیەی خۆت دەینووسیت دەژمێردرێت.",
     "کرێی کڕین و فرۆشتن و جیاوازیی نرخی کڕین/فرۆشتن لە هیچ کام لە چوار دۆخەکەدا نەژمێردراوە."],
    ["Every price is sampled daily at 15:30 Tehran time.",
     "The free dollar and tether come from the full archive of public tick channels (@NerkhDollarIRT, @USDTTetherp).",
     "A coin's toman value = its Binance close that day × the Iranian tether rate the same day — what you would really have paid or received in Iran.",
     "18k gold and the Emami coin are rebuilt from the global ounce, because the domestic board deletes old posts: (ounce ÷ 31.1035) × karat × free dollar, then calibrated against the real board days we do have. Where a real board price exists for a day, it is used instead.",
     "The bank deposit compounds daily from the annual rate you type in; that number is your assumption, not a published bank rate.",
     "Trading fees, taxes and exchange buy/sell spreads are not included in any of the four scenarios."])


def s(k, lg, **kw):
    t = S[k].get(lg) or S[k]["fa"]
    return t.format(**kw) if kw else t


CSS = """
/* ---- the panel: one card, controls that look like controls ---- */
.oc-grid{display:grid;gap:20px}
@media(min-width:900px){.oc-grid{grid-template-columns:minmax(290px,1fr) 1.7fr;align-items:start}
  .oc-grid .oc-form{grid-template-columns:1fr}
  .oc-in{position:sticky;top:78px}}
.oc-in{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px}
.oc-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:15px;margin:0 0 14px}
.oc-f label{display:block;font-size:.8rem;color:var(--mute);margin-bottom:7px;letter-spacing:.01em}
.oc-f input{width:100%;min-height:46px;background:rgba(255,255,255,.045);color:var(--ink);border:1px solid var(--line);
  border-radius:12px;padding:11px 13px;font:inherit;font-size:.95rem;transition:border-color .15s,box-shadow .15s,background .15s}
.oc-f input:focus{outline:0;border-color:var(--acc);background:rgba(255,255,255,.07);box-shadow:0 0 0 3px rgba(247,147,26,.16)}
.oc-coinrow{display:flex;gap:9px;align-items:center}
.oc-coinrow img{width:28px;height:28px;border-radius:50%;flex:none;background:#111}
.oc-jd{display:block;font-size:.78rem;color:var(--mute);margin-top:6px}
.oc-quick{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.oc-quick button,.oc-rng button{background:rgba(255,255,255,.045);color:var(--mute);border:1px solid transparent;border-radius:99px;
  padding:5px 12px;font:inherit;font-size:.78rem;cursor:pointer;transition:color .15s,border-color .15s,background .15s}
.oc-quick button:hover,.oc-rng button:hover{color:var(--ink);border-color:var(--line)}
.oc-rng button.on{background:var(--acc);color:#000;border-color:var(--acc);font-weight:700}
/* two modes = one segmented control, not two loose chips */
.oc-tabs{display:flex;width:100%;background:rgba(255,255,255,.045);border:1px solid var(--line);border-radius:99px;padding:3px;margin-bottom:9px}
.oc-tabs button{flex:1;background:none;border:0;color:var(--mute);border-radius:99px;padding:7px 10px;font:inherit;font-size:.82rem;cursor:pointer;transition:color .15s}
.oc-tabs button:hover{color:var(--ink)}
.oc-tabs button.on{background:var(--acc);color:#000;font-weight:700}
.oc-go{width:100%;background:var(--acc);color:#000;border:0;border-radius:12px;padding:13px 24px;font:inherit;font-weight:800;cursor:pointer;font-size:.98rem}
.oc-go:hover{filter:brightness(1.08)}
.oc-go[disabled]{opacity:.7;cursor:wait;filter:none}
.oc-go .spin{display:none;width:14px;height:14px;border:2px solid rgba(0,0,0,.25);border-top-color:#000;border-radius:50%;
  margin-inline-start:8px;vertical-align:-2px;animation:ocs .7s linear infinite}
.oc-go.busy .spin{display:inline-block}@keyframes ocs{to{transform:rotate(360deg)}}
.oc-hint{font-size:.8rem;color:var(--mute);margin:11px 0 0;line-height:1.85}
.oc-err:empty{display:none}
.oc-err{color:#f87171;margin:10px 0 0;font-size:.86rem;line-height:1.8}
.oc-err.mut{color:var(--mute)}
/* ---- results ---- */
.oc-range{display:inline-block;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:99px;
  padding:6px 14px;font-size:.79rem;color:var(--mute);margin:12px 0 20px}
.oc-lead{font-size:1.02rem;line-height:1.95;margin:0 0 13px}
.oc-lead:empty{display:none}
.oc-cards{display:grid;grid-template-columns:1fr;gap:13px;margin:13px 0 0}
@media(min-width:520px){.oc-cards{grid-template-columns:repeat(2,1fr)}}
.oc-cards .oc-card{display:flex;flex-direction:column}
.oc-cards .ini{margin-top:auto}
.oc-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:15px 17px;animation:ocf .35s ease both}
@keyframes ocf{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.oc-card .hd{display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:9px}
.oc-card h3{margin:0;font-size:.92rem;font-weight:600;color:var(--mute)}
.oc-val{font-family:'Space Grotesk',Vazirmatn,monospace;font-size:1.5rem;font-weight:800;direction:ltr;unicode-bidi:isolate;
  font-variant-numeric:tabular-nums;display:inline-block;line-height:1.25}
.oc-card .unit{font-size:.78rem;color:var(--mute);margin-inline-start:6px}
.oc-card .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px}
.oc-chg{font-family:'Space Grotesk',monospace;font-size:.92rem;font-weight:700;direction:ltr;unicode-bidi:isolate;
  border-radius:99px;padding:3px 10px;display:inline-block}
.oc-chg.up{color:#4ade80;background:rgba(34,197,94,.13)}
.oc-chg.down{color:#f87171;background:rgba(239,68,68,.13)}
.oc-vs{font-size:.78rem;color:var(--mute)}
.oc-vs b{font-weight:700;font-family:'Space Grotesk',monospace;direction:ltr;unicode-bidi:isolate}
.oc-vs.up b{color:#4ade80}.oc-vs.down b{color:#f87171}
.oc-card .ini{margin:11px 0 0;padding-top:10px;border-top:1px solid var(--line);font-size:.76rem;color:var(--mute)}
.oc-tag{font-size:.69rem;font-weight:800;padding:3px 10px;border-radius:99px;white-space:nowrap;flex:none}
.oc-tag.b{background:rgba(34,197,94,.16);color:#4ade80}
.oc-tag.w{background:rgba(239,68,68,.14);color:#f87171}
.oc-card.best{border-color:rgba(34,197,94,.55);background:linear-gradient(180deg,rgba(34,197,94,.07),transparent 60%),var(--card)}
.oc-card.worst{border-color:rgba(239,68,68,.4)}
.oc-card.ghost{opacity:.5;border-style:dashed}
.oc-empty{margin:0;color:var(--mute);font-size:.88rem}
/* the asset the person actually held leads the comparison */
.oc-hero .oc-card{display:flex;flex-wrap:wrap;align-items:center;gap:0 16px;padding:20px 22px}
.oc-hero .hd{flex:1 0 100%;margin-bottom:13px;justify-content:flex-start;gap:10px}
.oc-hero h3{font-size:1rem}
.oc-hero .oc-val{font-size:2.15rem}
.oc-hero .row{margin:0}
.oc-hero .oc-chg{font-size:1rem;padding:4px 12px}
.oc-hero .ini{flex:1 0 100%}
.oc-sum{background:rgba(247,147,26,.06);border:1px solid rgba(247,147,26,.22);border-inline-start:3px solid var(--acc);
  border-radius:14px;padding:13px 16px;line-height:2.05;margin:18px 0 0;font-size:.94rem}
.oc-after h2{font-size:1.06rem;margin:22px 0 9px}
.oc-rng{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}
.oc-chartwrap{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 12px 6px}
.oc-acts{display:flex;gap:9px;flex-wrap:wrap;margin:18px 0 0}
.oc-acts button{background:none;color:var(--ink);border:1px solid var(--line);border-radius:99px;padding:9px 17px;font:inherit;
  cursor:pointer;font-size:.86rem;transition:border-color .15s,color .15s,background .15s}
.oc-acts button:hover{border-color:var(--acc);color:var(--acc)}
.oc-acts .oc-tg{background:#229ED9;color:#fff;border-color:#229ED9;font-weight:700}
.oc-acts .oc-tg:hover{background:#1b8cc2;color:#fff;border-color:#1b8cc2}
.oc-acts .oc-sv{border-color:rgba(247,147,26,.45)}
.oc-acts .oc-ok,.oc-acts .oc-ok:hover{color:#22c55e;border-color:rgba(34,197,94,.55)}
.oc-learn{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:14px;padding:12px 16px;
  color:var(--mute);font-size:.87rem;margin-top:20px;line-height:1.95}
.oc-res{display:block}
"""

JS = r"""
(function(){var D=null,LOAD=null,LOGOS={};
function nf(n,d,lg){if(n==null||!isFinite(n))return '—';return Number(n).toLocaleString(lg==='en'?'en-US':'fa-IR',{maximumFractionDigits:d==null?0:d})}
function load(){if(LOAD)return LOAD;LOAD=fetch('/data/opportunity.json',{cache:'no-store'}).then(function(r){return r.json()}).then(function(j){D=j;return j});return LOAD}
function last(a,i){for(var k=i;k>=0;k--)if(a[k]!=null)return a[k];return null}
function tomanSeries(coin){var t=D.toman.USDT,u=D.usd[coin],o=[];for(var i=0;i<D.days.length;i++){var a=last(u,i),b=last(t,i);o.push(a&&b?a*b:null)}return o}
function dayNum(s){var p=s.split('-');return Date.UTC(+p[0],+p[1]-1,+p[2])/86400000}
function iso(dn){return new Date(dn*86400000).toISOString().slice(0,10)}
var JM=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
var JK=['خاکەلێوە','گوڵان','جۆزەردان','پووشپەڕ','گەلاوێژ','خەرمانان','ڕەزبەر','گەڵاڕێزان','سەرماوەز','بەفرانبار','ڕێبەندان','ڕەشەمە'];
function g2j(gy,gm,gd){var m=[0,31,59,90,120,151,181,212,243,273,304,334],y2=gm>2?gy+1:gy;
 var dd=355666+365*gy+((y2+3)/4|0)-((y2+99)/100|0)+((y2+399)/400|0)+gd+m[gm-1],jy=-1595+33*((dd/12053)|0);
 dd%=12053;jy+=4*((dd/1461)|0);dd%=1461;if(dd>365){jy+=((dd-1)/365)|0;dd=(dd-1)%365}
 return dd<186?[jy,1+((dd/31)|0),1+dd%31]:[jy,7+(((dd-186)/30)|0),1+(dd-186)%30]}
function fdate(s,lg){var p=s.split('-').map(Number);if(lg==='en')return s;
 var j=g2j(p[0],p[1],p[2]);return (j[2]+' '+(lg==='ckb'?JK:JM)[j[1]-1]+' '+j[0]).replace(/\d/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'[d]})}
function both(s,lg){return lg==='en'?s:fdate(s,lg)+' · '+s}
function depositSeries(i0,amount,rate){var o=[],r=Math.pow(1+rate/100,1/365),d0=dayNum(D.days[i0]);
 for(var i=0;i<D.days.length;i++){o.push(i<i0?null:amount*Math.pow(r,dayNum(D.days[i])-d0))}return o}
function num(v){v=String(v||'').replace(/[۰-۹]/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)}).replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d)}).replace(/[٫]/g,'.').replace(/[^\d.]/g,'');return parseFloat(v)}
function idxOn(date){if(date<D.from)return -1;var k=-1;for(var i=0;i<D.days.length;i++){if(D.days[i]<=date)k=i;else break}return k}
var KEY='ck_oc_last',SAVE='ck_oc_saved';
function store(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function read(k,d){try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}}
function run(blk,quiet){
 var g=function(s){return blk.querySelector(s)},ds=blk.dataset,lg=ds.lg;
 var coin=String(g('.oc-coin').value||'').trim().toUpperCase(),date=g('.oc-date').value,mode=blk.__mode||'t',raw=num(g('.oc-amt').value),rate=parseFloat(g('.oc-rate').value)||0;
 var err=g('.oc-err');err.textContent='';err.className='oc-err';
 if(D.coins.indexOf(coin)<0){err.textContent=ds.pick;return}
 var i0=idxOn(date);
 if(i0<0){err.textContent=ds.nodate;return}
 if(D.days[i0]!==date){date=D.days[i0];g('.oc-date').value=date;showJ(blk)}
 if(!raw||raw<=0){err.textContent=ds.badamt;return}
 var n=D.days.length-1,series={};
 series[coin]=tomanSeries(coin);
 var p0=last(series[coin],i0);if(!p0){err.textContent=ds.nodate;return}
 var amt=mode==='c'?raw*p0:raw;
 ['USD','GOLD18','COIN'].forEach(function(k){series[k]=D.toman[k].slice()});
 var rows=[];
 Object.keys(series).forEach(function(k){var a=last(series[k],i0),b=last(series[k],n);if(!a||!b)return;
   var units=amt/a,val=units*b;rows.push({k:k,val:val,chg:(val/amt-1)*100,path:series[k].map(function(v,i){return i<i0||v==null?null:v*units})})});
 var dep=depositSeries(i0,amt,rate);rows.push({k:'DEPOSIT',val:last(dep,n),chg:(last(dep,n)/amt-1)*100,path:dep});
 var sorted=rows.slice().sort(function(a,b){return b.val-a.val}),best=sorted[0],worst=sorted[sorted.length-1];
 var order=[coin,'USD','GOLD18','COIN','DEPOSIT'];rows.sort(function(a,b){return order.indexOf(a.k)-order.indexOf(b.k)});
 var title={USD:ds.cardusd,GOLD18:ds.cardgold,COIN:ds.cardcoin2,DEPOSIT:ds.carddep};
 var nm=function(k){return k===coin?coin:((D.names[k]&&(D.names[k][lg]||D.names[k].fa))||k)};
 var cv=rows[0].val;
 var card=function(r,hero){
   var cls=(r===best?' best':(r===worst?' worst':''))+(hero?' lead':''),up=r.chg>=0;
   var tag=r===best?'<span class="oc-tag b">👑 '+ds.best+'</span>':(r===worst?'<span class="oc-tag w">'+ds.worst+'</span>':'');
   var vs='';
   if(r.k!==coin){var x=(r.val/cv-1)*100;
     vs='<span class="oc-vs '+(x>=0?'up':'down')+'"><b>'+(x>=0?'+':'')+nf(x,1,lg)+'%</b> '+(x>=0?ds.better:ds.worse).replace('{c}',coin)+'</span>'}
   return '<div class="oc-card'+cls+'">'+
     '<div class="hd"><h3>'+(r.k===coin?ds.cardcoin.replace('{c}',coin):title[r.k])+'</h3>'+tag+'</div>'+
     '<div class="hv"><span class="oc-val">'+nf(r.val,0,lg)+'</span><small class="unit">'+ds.toman+'</small></div>'+
     '<div class="row"><span class="oc-chg '+(up?'up':'down')+'">'+(up?'+':'')+nf(r.chg,1,lg)+'%</span>'+vs+'</div>'+
     '<p class="ini">'+ds.initial.replace('{v}',nf(amt,0,lg))+'</p></div>';
 };
 g('.oc-hero').innerHTML=card(rows[0],true);
 g('.oc-cards').innerHTML=rows.slice(1).map(function(r){return card(r,false)}).join('');
 g('.oc-lead').textContent=ds.resfor.replace('{d}',fdate(date,lg)).replace('{a}',nf(amt,0,lg)).replace('{c}',coin);
 // grounded summary: only numbers computed above
 var usd=rows.filter(function(r){return r.k==='USD'})[0],gold=rows.filter(function(r){return r.k==='GOLD18'})[0],sum='';
 if(usd){var x=(cv/usd.val-1)*100;sum=ds.sumvs.replace('{d}',fdate(date,lg)).replace('{c}',coin).replace('{x}',nf(Math.abs(x),1,lg)).replace('{dir}',x>=0?ds.more:ds.less)}
 if(gold){var y=(gold.val/cv-1)*100;sum+=' '+ds.sumgold.replace('{c}',coin).replace('{y}',nf(Math.abs(y),1,lg)).replace('{dir}',y>=0?ds.gbetter:ds.gworse)}
 var sb=g('.oc-sum');sb.textContent=sum;sb.hidden=!sum;
 g('.oc-after').hidden=false;
 // chart
 var colors={USD:'#22c55e',GOLD18:'#eab308',COIN:'#a3a3a3',DEPOSIT:'#60a5fa'};colors[coin]='#3b82f6';
 var box=g('.oc-chart');box.innerHTML='';blk.__chart=null;
 if(window.LightweightCharts){
   var c=LightweightCharts.createChart(box,{height:300,layout:{background:{color:'transparent'},textColor:'#9a9a94',fontFamily:'Vazirmatn'},
    grid:{vertLines:{color:'rgba(255,255,255,.05)'},horzLines:{color:'rgba(255,255,255,.05)'}},rightPriceScale:{borderVisible:false},
    timeScale:{borderVisible:false},localization:{priceFormatter:function(v){return nf(v/1e6,1,lg)+'M'}}});
   rows.forEach(function(r){var s=c.addLineSeries({color:colors[r.k]||'#888',lineWidth:r.k===coin?3:2,priceLineVisible:false,lastValueVisible:false});
     s.setData(D.days.map(function(d,i){return r.path[i]!=null?{time:d,value:r.path[i]}:null}).filter(Boolean))});
   c.timeScale().fitContent();blk.__chart=c;blk.__i0=i0;
   new ResizeObserver(function(){if(box.clientWidth)c.applyOptions({width:box.clientWidth})}).observe(box);
   blk.querySelectorAll('.oc-rng button').forEach(function(b){b.classList.toggle('on',b.dataset.r==='buy')});
 }
 g('.oc-legend').innerHTML=rows.map(function(r){return '<span><i style="background:'+(colors[r.k]||'#888')+'"></i>'+nm(r.k)+'</span>'}).join('');
 // a link that reopens this exact calculation
 var link='https://entekhab.net/opportunity/?c='+coin+'&d='+date+'&'+(mode==='c'?'q':'a')+'='+raw+'&r='+rate;
 blk.__res={coin:coin,date:date,amt:amt,rows:rows,best:best,link:link,nm:nm};
 blk.__txt=ds.resfor.replace('{d}',fdate(date,lg)).replace('{a}',nf(amt,0,lg)).replace('{c}',coin)+'\n'+
   rows.map(function(r){return (r===best?'👑 ':'')+nm(r.k)+': '+nf(r.val,0,lg)+' '+ds.toman+' ('+(r.chg>=0?'+':'')+nf(r.chg,1,lg)+'%)'}).join('\n')+(sum?'\n\n'+sum:'')+'\n\n'+link;
 store(KEY,{c:coin,d:date,m:mode,v:raw,r:rate});
 var go=g('.oc-go .lbl');go.textContent=ds.recalc;
 try{history.replaceState(null,'',link.replace('https://entekhab.net',''))}catch(e){}
}
function showJ(blk){var d=blk.querySelector('.oc-date').value,lg=blk.dataset.lg;blk.querySelector('.oc-jd').textContent=d&&lg!=='en'?fdate(d,lg):''}
function setLogo(blk){var c=String(blk.querySelector('.oc-coin').value||'').trim().toUpperCase(),im=blk.querySelector('.oc-logo');
 if(D&&D.coins.indexOf(c)>=0){im.src='/data/logos/'+c+'.png';im.style.visibility='visible'}else im.style.visibility='hidden'}
function setMode(blk,m){blk.__mode=m;blk.querySelectorAll('.oc-tabs button').forEach(function(b){b.classList.toggle('on',b.dataset.m===m)});
 var a=blk.querySelector('.oc-amt');a.placeholder=a.dataset['ph'+m.toUpperCase()]||a.placeholder;
 if(m==='c'&&num(a.value)>1e5)a.value='0.5';if(m==='t'&&num(a.value)<1e4)a.value='100000000'}
function quick(blk,q){var to=dayNum(D.to),t;if(q==='24')t='2024-01-01';else{var d=new Date(to*86400000);d.setUTCMonth(d.getUTCMonth()-(+q));t=d.toISOString().slice(0,10)}
 var err=blk.querySelector('.oc-err');err.textContent='';
 if(t<D.from){t=D.from;err.textContent=blk.dataset.clamped.replace('{a}',fdate(D.from,blk.dataset.lg));err.className='oc-err mut'}
 blk.querySelector('.oc-date').value=t;showJ(blk)}
function busy(blk,on){var b=blk.querySelector('.oc-go');b.disabled=on;b.classList.toggle('busy',on)}
function calc(blk){busy(blk,true);setTimeout(function(){try{run(blk)}finally{busy(blk,false)}},120)}
function image(blk){var R=blk.__res;if(!R)return;var ds=blk.dataset,lg=ds.lg,W=1080,H=1350,cv=document.createElement('canvas');cv.width=W;cv.height=H;var x=cv.getContext('2d');
 var gr=x.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#16120b');gr.addColorStop(1,'#050505');x.fillStyle=gr;x.fillRect(0,0,W,H);
 x.direction=lg==='en'?'ltr':'rtl';var rtl=lg!=='en',X=rtl?W-70:70;x.textAlign=rtl?'right':'left';
 var F=function(w,s){return w+' '+s+'px Vazirmatn, Tahoma, sans-serif'};
 x.fillStyle='#f7931a';x.font=F(900,54);x.fillText(ds.title,X,150);
 x.fillStyle='#bdbdb6';x.font=F(500,32);x.fillText(ds.imgbuy+': '+fdate(R.date,lg)+'   ·   '+ds.imgnow+': '+fdate(D.to,lg),X,212);
 x.fillStyle='#fff';x.font=F(700,36);x.fillText(R.coin+' · '+nf(R.amt,0,lg)+' '+ds.toman,X,282);
 var show=R.rows.filter(function(r){return r.k===R.coin||r.k==='USD'||r.k==='GOLD18'}),y=360;
 show.forEach(function(r){var best=r===R.best;x.fillStyle=best?'rgba(34,197,94,.14)':'rgba(255,255,255,.05)';x.strokeStyle=best?'#22c55e':'rgba(255,255,255,.12)';x.lineWidth=3;
   x.beginPath();if(x.roundRect)x.roundRect(60,y,W-120,230,28);else x.rect(60,y,W-120,230);x.fill();x.stroke();
   x.fillStyle='#d4d4cf';x.font=F(700,36);x.fillText((best?'👑 ':'')+R.nm(r.k),X,y+70);
   x.fillStyle='#fff';x.font=F(900,64);x.fillText(nf(r.val,0,lg)+' '+ds.toman,X,y+150);
   var line=(r.chg>=0?'+':'')+nf(r.chg,1,lg)+'%';
   if(r.k!==R.coin){var dv=(r.val/R.rows[0].val-1)*100;line+='   ·   '+(dv>=0?'+':'')+nf(dv,1,lg)+'% '+(dv>=0?ds.better:ds.worse).replace('{c}',R.coin)}
   x.fillStyle=r.chg>=0?'#22c55e':'#ef4444';x.font=F(800,38);x.fillText(line,X,y+205);y+=262});
 x.fillStyle='#f7931a';x.fillRect(0,H-150,W,4);x.fillStyle='#fff';x.font=F(800,38);x.fillText('entekhab.net/opportunity',X,H-80);
 var done=function(){cv.toBlob(function(b){var f=new File([b],'entekhab-opportunity.png',{type:'image/png'});
   if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],text:R.link}).catch(function(){})}
   else{var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='entekhab-opportunity.png';document.body.appendChild(a);a.click();a.remove()}},'image/png')};
 var lo=new Image();lo.onload=function(){var h=90,w=lo.width*h/lo.height;x.drawImage(lo,rtl?70:W-70-w,H-128,w,h);done()};lo.onerror=done;lo.src='/assets/logo-h.webp'}
function init(blk){
 load().then(function(){
  var ds=blk.dataset,lg=ds.lg;
  blk.querySelector('datalist').innerHTML=D.coins.map(function(c){return '<option value="'+c+'">'}).join('');
  var dt=blk.querySelector('.oc-date');dt.min=D.from;dt.max=D.to;dt.value=D.from;
  blk.querySelector('.oc-range').textContent=ds.range.replace('{a}',both(D.from,lg)).replace('{b}',both(D.to,lg));
  var cal=(blk.parentNode||document).querySelector('.oc-calib');if(cal&&D.calibration)cal.textContent=ds.calib.replace('{g}',D.calibration.gold_k).replace('{c}',D.calibration.coin_k);
  var q=new URLSearchParams(location.search),last_=read(KEY,null),auto=false;
  var src=q.get('c')?{c:q.get('c'),d:q.get('d'),m:q.get('q')?'c':'t',v:q.get('q')||q.get('a'),r:q.get('r')}:last_;
  setMode(blk,src&&src.m==='c'?'c':'t');
  if(src){if(src.c)blk.querySelector('.oc-coin').value=String(src.c).toUpperCase();if(src.d)dt.value=src.d;if(src.v)blk.querySelector('.oc-amt').value=src.v;if(src.r!=null&&src.r!=='')blk.querySelector('.oc-rate').value=src.r;auto=!!q.get('c')}
  showJ(blk);setLogo(blk);
  blk.querySelector('.oc-coin').addEventListener('input',function(){setLogo(blk)});
  dt.addEventListener('change',function(){showJ(blk)});
  blk.querySelectorAll('.oc-quick button').forEach(function(b){b.onclick=function(){quick(blk,b.dataset.q)}});
  blk.querySelectorAll('.oc-tabs button').forEach(function(b){b.onclick=function(){setMode(blk,b.dataset.m)}});
  blk.querySelector('.oc-go').onclick=function(){calc(blk)};
  blk.querySelectorAll('.oc-rng button').forEach(function(b){b.onclick=function(){var c=blk.__chart;if(!c)return;
    blk.querySelectorAll('.oc-rng button').forEach(function(z){z.classList.toggle('on',z===b)});
    if(b.dataset.r==='30')c.timeScale().setVisibleRange({from:iso(dayNum(D.to)-30),to:D.to});
    else if(b.dataset.r==='buy')c.timeScale().setVisibleRange({from:D.days[blk.__i0||0],to:D.to});else c.timeScale().fitContent()}});
  blk.querySelector('.oc-tg').onclick=function(){var R=blk.__res;
    var u='https://t.me/share/url?url='+encodeURIComponent(R?R.link:'https://entekhab.net/opportunity/')+'&text='+encodeURIComponent(blk.__txt||'');
    var a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove()};
  blk.querySelector('.oc-img').onclick=function(){image(blk)};
  blk.querySelector('.oc-cp:not(.oc-od):not(.oc-oc)').onclick=function(){var b=this;try{navigator.clipboard.writeText(blk.__txt||'');b.textContent=ds.copied}catch(e){}};
  blk.querySelector('.oc-sv').onclick=function(){var R=blk.__res;if(!R)return;var a=read(SAVE,[]);
    a.unshift({at:new Date().toISOString(),c:R.coin,d:R.date,amt:R.amt,link:R.link,best:R.best.k,val:R.rows[0].val});store(SAVE,a.slice(0,20));this.textContent=ds.saved;this.classList.add('oc-ok')};
  blk.querySelector('.oc-od').onclick=function(){dt.focus();dt.scrollIntoView({block:'center',behavior:'smooth'})};
  blk.querySelector('.oc-oc').onclick=function(){var c=blk.querySelector('.oc-coin');c.value='';c.focus();c.scrollIntoView({block:'center',behavior:'smooth'})};
  if(auto)calc(blk);
 }).catch(function(){blk.querySelector('.oc-range').textContent=blk.dataset.nodata});
}
document.querySelectorAll('.oc-blk').forEach(init);
})();
"""


def form(lg):
    keys = ("pick_date", "best", "worst", "vs_best", "toman", "nodata", "clamped", "nodate", "badamt", "recalc", "card_coin", "card_usd",
            "card_gold", "card_coin2", "card_dep", "initial", "better", "worse", "sum_vs", "sum_gold", "more", "less", "g_better",
            "g_worse", "saved", "img_buy", "img_now", "title", "copied")
    d = {("pick" if k == "pick_date" else k.replace("_", "")): S[k].get(lg) or S[k]["fa"] for k in keys}
    d.update({"resfor": S["result_for"].get(lg) or S["result_for"]["fa"], "range": S["range"].get(lg) or S["range"]["fa"],
              "calib": S["calib"].get(lg) or S["calib"]["fa"], "lg": lg})
    attrs = " ".join(f'data-{k}="{e(v)}"' for k, v in d.items())
    quick = "".join(f'<button type="button" data-q="{q}">{s("q" + q, lg)}</button>' for q in ("1", "3", "6", "12", "24"))

    def ghost(k, cls=""):
        return (f'<div class="oc-card ghost{cls}"><div class="hd"><h3>{s(k, lg).replace("{c}", "…")}</h3></div>'
                f'<p class="oc-empty">{s("empty", lg)}</p></div>')

    cards = "".join(ghost(k) for k in ("card_usd", "card_gold", "card_coin2", "card_dep"))
    return (f'<div class="oc-blk" {attrs}>'
            f'<p class="oc-range">…</p>'
            f'<div class="oc-grid">'
            # ---- the panel
            f'<div class="oc-in"><div class="oc-form">'
            f'<div class="oc-f"><label for="oc-coin-{lg}">{s("coin", lg)}</label><div class="oc-coinrow">'
            f'<img class="oc-logo" alt="" width="28" height="28">'
            f'<input id="oc-coin-{lg}" class="oc-coin" list="oc-coins-{lg}" value="BTC" autocomplete="off" spellcheck="false" dir="ltr">'
            f'<datalist id="oc-coins-{lg}"></datalist></div></div>'
            f'<div class="oc-f"><label for="oc-date-{lg}">{s("date", lg)}</label>'
            f'<input id="oc-date-{lg}" class="oc-date" type="date"><span class="oc-jd"></span><div class="oc-quick">{quick}</div></div>'
            f'<div class="oc-f"><div class="oc-tabs"><button type="button" class="on" data-m="t">{s("mode_t", lg)}</button>'
            f'<button type="button" data-m="c">{s("mode_c", lg)}</button></div>'
            f'<input class="oc-amt" type="text" inputmode="decimal" placeholder="{s("amount_help", lg)}" value="100000000"'
            f' data-ph-t="{s("amount_help", lg)}" data-ph-c="{s("qty_help", lg)}"></div>'
            f'<div class="oc-f"><label for="oc-rate-{lg}">{s("rate", lg)} %</label>'
            f'<input id="oc-rate-{lg}" class="oc-rate" type="number" min="0" max="80" step="0.5" value="20"></div>'
            f'</div><button type="button" class="oc-go"><span class="lbl">{s("calc", lg)}</span><i class="spin"></i></button>'
            f'<p class="oc-hint">{s("rate_note", lg)}</p><p class="oc-err"></p></div>'
            # ---- the results
            f'<div class="oc-res"><p class="oc-lead"></p>'
            f'<div class="oc-hero">{ghost("card_coin")}</div><div class="oc-cards">{cards}</div>'
            f'<div class="oc-sum" hidden></div>'
            f'<div class="oc-after" hidden><h2>{s("chart", lg)}</h2>'
            f'<div class="oc-rng"><button type="button" class="on" data-r="buy">{s("r_buy", lg)}</button>'
            f'<button type="button" data-r="30">{s("r_30", lg)}</button><button type="button" data-r="all">{s("r_all", lg)}</button></div>'
            f'<div class="oc-chartwrap"><div class="oc-chart rc-chart" style="height:300px"></div>'
            f'<div class="rc-legend oc-legend"></div></div>'
            f'<div class="oc-acts"><button type="button" class="oc-tg">✈ {s("share", lg)}</button>'
            f'<button type="button" class="oc-img">🖼 {s("img", lg)}</button>'
            f'<button type="button" class="oc-cp">{s("copy", lg)}</button><button type="button" class="oc-sv">⭐ {s("save", lg)}</button>'
            f'<button type="button" class="oc-cp oc-od">{s("other_date", lg)}</button>'
            f'<button type="button" class="oc-cp oc-oc">{s("other_coin", lg)}</button></div></div>'
            f'<p class="oc-learn">💡 {s("learn", lg)}</p></div></div></div>')


def build():
    def b(lg):
        h = (f'<div class="meta"><a href="/">{BR.s("home", lg)}</a> / <a href="/reality/">{BR.s("hub", lg)}</a> / {e(s("title", lg))}</div>'
              f'<h1>{e(s("title", lg))}</h1><p class="rc-lead"><b>{e(s("sub", lg))}</b> {e(s("desc", lg))}</p>')
        h += form(lg)
        items = "".join(f"<li>{e(x)}</li>" for x in (METHOD.get(lg) or METHOD["fa"]))
        h += (f'<details class="rc-meth"><summary>{s("method", lg)}</summary><ul>{items}</ul>'
              f'<p class="note oc-calib"></p><p class="note">{e(s("twins", lg))}</p></details>')
        h += f'<p class="note">{e(s("head_note", lg))}</p>'
        return h

    body = BR.finish("", BR.tri(b), JS)
    extra = f"<style>{BR.RCSS}{CSS}</style>"
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": S["title"]["fa"],
          "url": f"{BP.SITE}/opportunity/", "applicationCategory": "FinanceApplication",
          "operatingSystem": "Any", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "IRR"},
          "description": S["desc"]["fa"]}
    return BP.page("opportunity/", S["title"]["fa"], S["desc"]["fa"], body, extra + f'<script type="application/ld+json">{BP.sj(ld)}</script>')


def main():
    url = build()
    BR.add_to_sitemap([url])
    print("opportunity page:", url)


if __name__ == "__main__":
    main()
