#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
/world/ — «جهان زنده» (live world counters and a post studio): the static page with its title, description and readable
text in کوردی · فارسی · العربية · English for search engines and visitors without JavaScript, plus
assets/world/facts.json (scripts/world_data.py FACTS). The app is assets/world/{math,i18n,world,studio}.js + world.css;
the shared header, footer and CSP are put in by scripts/chrome.py ("world" is in chrome.STATIC).

Run: python3 scripts/build_world.py && python3 scripts/chrome.py
"""
import html
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import world_data as WD  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://entekhab.net"
V = "2"                      # asset version: bump with any change to assets/world/* (and V in world.js)
LANGS = ("fa", "ckb", "ar", "en")
URL = SITE + "/world/"


def e(s):
    return html.escape(str(s), quote=True)


T = {
    "title": "جهان زنده: شمارنده‌های جهان و بیت‌کوین | entekhab.net",
    "desc": "شمارنده‌های زندهٔ جهان با منبع: جمعیت، تولد و مرگ، بیت‌کوین استخراج‌شده، تولید جهان، نفت، CO₂ و سلامت؛ با ساخت پست برای شبکه‌های اجتماعی.",
    "og": "جهان زنده — شمارنده‌های جهان و بیت‌کوین، ثانیه به ثانیه",
    "h1": {"fa": "جهان زنده", "ckb": "جیهانی زیندوو", "ar": "العالم مباشرةً", "en": "The world, live"},
    "p": {"fa": "جمعیت، اقتصاد، انرژی، سلامت و بیت‌کوین — ثانیه به ثانیه، هر عدد با منبعش؛ و از هر عدد یک پست آماده برای اینستاگرام، تلگرام و ایکس بسازید",
          "ckb": "دانیشتووان، ئابووری، وزە، تەندروستی و بیتکۆین — چرکە بە چرکە، هەر ژمارەیەک لەگەڵ سەرچاوەکەی؛ و لە هەر ژمارەیەک پۆستێکی ئامادە بۆ ئینستاگرام، تێلێگرام و ئێکس دروست بکە",
          "ar": "السكان والاقتصاد والطاقة والصحة والبيتكوين — ثانيةً بثانية، كل رقم بمصدره؛ واصنع من أي رقم منشورًا جاهزًا لإنستغرام وتيليغرام وإكس",
          "en": "Population, economy, energy, health and Bitcoin — second by second, every number with its source; turn any of them into a ready post for Instagram, Telegram and X"},
    "about": {
        "fa": [("این صفحه چه نشان می‌دهد", [
            "<b>بیت‌کوین از روی زنجیرهٔ واقعی:</b> بیت‌کوین‌های ساخته‌شده تا این لحظه، استخراج امروز و امسال (بلاک به بلاک)، باقی‌مانده تا ۲۱ میلیون، فاصله تا هاوینگ بعدی، قیمت زنده و ارزش کل بازار کریپتو.",
            "<b>جمعیت:</b> جمعیت جهان در همین لحظه، تولدها، مرگ‌ها و رشد خالص امروز و امسال (برآورد سازمان ملل).",
            "<b>اقتصاد و پول:</b> تولید ناخالص جهان، هزینهٔ نظامی، بدهی ملی آمریکا (از خزانه‌داری آمریکا) و طلای استخراج‌شده.",
            "<b>انرژی و محیط زیست:</b> انرژی مصرفی، نفت تولیدی، انتشار CO₂ و نابودی جنگل‌ها.",
            "<b>سلامت و جامعه:</b> مرگ کودکان، دخانیات، سل، تصادفات، مالاریا، ایدز و کاربران اینترنت.",
            "<b>استودیوی پست:</b> از هر عدد یا از «جهان امروز»، «هر ثانیه در جهان» و «بیت‌کوین و طلا» تصویر مربع، پست، استوری یا افقی بسازید، با متن و هشتگ آماده به چهار زبان، و مستقیم به تلگرام، ایکس و واتس‌اپ بفرستید."]),
               ("روش و منابع", [
            "هر شمارنده رقم سالانهٔ یک منبع بین‌المللی است (سازمان ملل، صندوق بین‌المللی پول، SIPRI، آژانس بین‌المللی انرژی، مؤسسهٔ انرژی، پروژهٔ جهانی کربن، سازمان جهانی بهداشت، UNAIDS، یونیسف، ITU و شورای جهانی طلا) که به‌طور یکنواخت روی سال و روز تقویم شما پخش شده است؛ سال و نام منبع کنار هر عدد آمده و با یک کلیک دیده می‌شود.",
            "بیت‌کوین مدل نیست: از ارتفاع واقعی بلاک‌ها و جدول پاداش بلاک محاسبه می‌شود. عددی که منبعی برایش نیست نشان داده نمی‌شود. توصیهٔ مالی نیست."])],
        "ckb": [("ئەم پەڕەیە چی پیشان دەدات", [
            "<b>بیتکۆین لەسەر زنجیرەی ڕاستەقینە:</b> بیتکۆینی دروستکراو تا ئێستا، دەرهێنانی ئەمڕۆ و ئەمساڵ، ماوە تا ٢١ ملیۆن، مەودا تا هاڵڤینگی داهاتوو، نرخی زیندوو و بەهای گشتیی بازاڕی کریپتۆ.",
            "<b>دانیشتووان:</b> دانیشتووانی جیهان لەم ساتەدا، لەدایکبوون، مردن و گەشەی خاوێنی ئەمڕۆ و ئەمساڵ.",
            "<b>ئابووری، وزە، ژینگە و تەندروستی:</b> بەرهەمی جیهان، خەرجیی سەربازی، قەرزی ئەمریکا، زێڕ، نەوت، CO₂، دارستان و هۆکارەکانی مردن.",
            "<b>ستۆدیۆی پۆست:</b> لە هەر ژمارەیەک وێنەی چوارگۆشە، پۆست، ستۆری یان ئاسۆیی دروست بکە، بە دەق و هاشتاگی ئامادە بە چوار زمان."]),
                ("ڕێگا و سەرچاوەکان", ["هەر ژمێرەرێک ژمارەی ساڵانەی سەرچاوەیەکی نێودەوڵەتییە کە بە یەکسانی بەسەر ساڵ و ڕۆژەکەتدا دابەش کراوە؛ ساڵ و ناوی سەرچاوە لە تەنیشت هەر ژمارەیەکە. ئامۆژگاریی دارایی نییە."])],
        "ar": [("ماذا تعرض هذه الصفحة", [
            "<b>البيتكوين من السلسلة الحقيقية:</b> البيتكوين المُصدَر حتى الآن، تعدين اليوم وهذا العام، المتبقي حتى ٢١ مليونًا، المسافة حتى التنصيف القادم، السعر المباشر والقيمة الإجمالية لسوق العملات المشفرة.",
            "<b>السكان:</b> سكان العالم في هذه اللحظة، المواليد والوفيات وصافي النمو اليوم وهذا العام.",
            "<b>الاقتصاد والطاقة والبيئة والصحة:</b> الناتج العالمي، الإنفاق العسكري، الدين الأمريكي، الذهب، النفط، CO₂، الغابات وأسباب الوفاة.",
            "<b>استوديو المنشورات:</b> اصنع من أي رقم صورة مربعة أو منشورًا أو قصة أو صورة أفقية، مع نص ووسوم جاهزة بأربع لغات."]),
               ("المنهج والمصادر", ["كل عداد هو الرقم السنوي لمصدر دولي موزَّعًا بالتساوي على سنتك ويومك؛ السنة واسم المصدر بجانب كل رقم. ليست نصيحة مالية."])],
        "en": [("What this page shows", [
            "<b>Bitcoin from the real chain:</b> coins issued so far, mined today and this year (block by block), left until 21 million, the distance to the next halving, the live price and the whole crypto market's value.",
            "<b>Population:</b> the world's population right now; births, deaths and net growth today and this year (UN estimates).",
            "<b>Economy and money:</b> world GDP, military spending, the US national debt (from the US Treasury) and gold mined.",
            "<b>Energy and environment:</b> energy used, oil produced, CO₂ emitted and forests lost.",
            "<b>Health and society:</b> child deaths, tobacco, tuberculosis, road deaths, malaria, AIDS and Internet users.",
            "<b>Post studio:</b> turn any number — or «the world today», «every second» and «Bitcoin & gold» — into a square, portrait, story or wide image with a ready caption and hashtags in four languages, and send it to Telegram, X or WhatsApp."]),
               ("Method and sources", [
            "Every counter is a yearly figure from an international publisher (UN, IMF, SIPRI, IEA, Energy Institute, Global Carbon Project, WHO, UNAIDS, UNICEF, ITU, World Gold Council), spread evenly over your calendar year and day; the year and the publisher are beside every number, one click away.",
            "Bitcoin is not modelled: it is computed from the real block height and the block-subsidy schedule. A number with no source is not shown. Not financial advice."])],
    },
}


def about():
    out = []
    for lg in LANGS:
        hid = "" if lg == "fa" else " hidden"
        body = "".join(f"<h2>{e(h)}</h2><ul>" + "".join(f"<li>{x}</li>" for x in items) + "</ul>" for h, items in T["about"][lg])
        out.append(f'<section class="wl-about" data-lang="{lg}" lang="{lg}" dir="{"ltr" if lg == "en" else "rtl"}"{hid}>{body}</section>')
    # the sources, readable without JavaScript (English titles: the publishers' own)
    rows = "".join(f'<li><b>{e(f["src"]["pub"])}</b> — {e(f["src"]["t"])} ({e(f["src"]["d"])})</li>' for f in WD.FACTS)
    out.append(f'<details class="wl-about wl-srcs"><summary>Sources · منابع · سەرچاوەکان · المصادر</summary><ul dir="ltr" lang="en">{rows}'
               '<li><b>Bitcoin</b> — block height: mempool.space; issuance: the block-subsidy schedule</li>'
               '<li><b>US Treasury</b> — Debt to the Penny (fiscaldata.treasury.gov), every business day</li>'
               '<li><b>Prices</b> — Binance public data; crypto market value: CoinGecko</li></ul></details>')
    return "\n".join(out)


def page():
    h1 = "".join(f'<span data-lang="{lg}"{"" if lg == "fa" else " hidden"}>{e(T["h1"][lg])}</span>' for lg in LANGS)
    p = "".join(f'<span data-lang="{lg}"{"" if lg == "fa" else " hidden"}>{e(T["p"][lg])}</span>' for lg in LANGS)
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": "Entekhab — The world, live", "alternateName": T["h1"]["fa"], "url": URL,
          "applicationCategory": "ReferenceApplication", "operatingSystem": "Any (web browser)", "inLanguage": ["ckb", "fa", "ar", "en"],
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
          "publisher": {"@type": "Organization", "name": "Entekhab (entekhab.net)", "url": SITE}, "description": T["p"]["en"]}
    return f"""<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(T["title"])}</title>
<meta name="description" content="{e(T["desc"])}">
<link rel="canonical" href="{URL}">
<meta name="theme-color" content="#f7931a">
<meta property="og:title" content="{e(T["og"])}">
<meta property="og:description" content="{e(T["desc"])}">
<meta property="og:url" content="{URL}"><meta property="og:site_name" content="entekhab.net">
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><meta property="og:image" content="https://entekhab.net/assets/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://data-api.binance.vision" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/world/world.css?v={V}">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False, separators=(",", ":"))}</script>
</head>
<body>
<!--ek:header--><!--/ek:header-->
<main class="wl-page" id="wl-main" translate="no">
  <div class="wl-head">
    <h1>{h1}</h1>
    <p>{p}</p>
  </div>
  <div id="wl" class="wl" translate="no"><div class="wl-wait">…</div></div>
  <noscript><p class="wl-about">این صفحه با جاوااسکریپت کار می‌کند. / This page needs JavaScript.</p></noscript>
{about()}
</main>
<!--ek:bottom--><!--/ek:bottom-->
<!--ek:footer--><!--/ek:footer-->
<script src="/assets/world/math.js?v={V}" defer></script>
<script src="/assets/world/i18n.js?v={V}" defer></script>
<script src="/assets/world/world.js?v={V}" defer></script>
<script src="/assets/ui.js" defer></script>
</body>
</html>
"""


def main():
    WD.write_facts()
    d = os.path.join(ROOT, "world")
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
        f.write(page())
    assert len(T["title"]) <= 60, len(T["title"])
    assert len(T["desc"]) <= 160, len(T["desc"])
    print(f"/world/ written (title {len(T['title'])}, description {len(T['desc'])} characters) + assets/world/facts.json")


if __name__ == "__main__":
    main()
