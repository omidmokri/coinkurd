#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Site chrome for entekhab.net — ONE header, ONE footer and ONE mobile tab bar for every page.

  * Desktop (>= 1180px): mega-menu header with categories (no hamburger).
  * Mobile/tablet: compact top bar + bottom tab bar; the "All" tab opens a categorised sheet (built by assets/chrome.js).
  * Binance-style footer: brand + apps + community (social networks) + six link columns + legal row.

Labels carry all three languages in data attributes (data-fa / data-ckb / data-en); assets/chrome.js switches them when
the page language changes, so this file is the single source of truth for navigation.

CLI:  python3 scripts/chrome.py            -> inject/refresh the chrome in every static page of the repo
      (build_pages.py imports header()/footer()/bottom() for generated pages)
"""
import html
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VER = "10"  # bump to bust caches of chrome.css / chrome.js
LANGS = ("fa", "ckb", "en")

# ---------------------------------------------------------------- icons (generic line glyphs, 24x24)
_P = {
    "home": '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    "gauge": '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 18 4.5-6.5"/><circle cx="12" cy="18" r="1.3"/>',
    "terminal": '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 9 3 3-3 3"/><path d="M13 15h4"/>',
    "coins": '<ellipse cx="9" cy="6.5" rx="6" ry="3"/><path d="M3 6.5v4.5c0 1.7 2.7 3 6 3"/><ellipse cx="15" cy="13.5" rx="6" ry="3"/><path d="M9 13.5V18c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"/>',
    "thermo": '<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z"/><path d="M12 9v7.5"/>',
    "pie": '<path d="M12 3v9h9"/><path d="M20.4 15.5A9 9 0 1 1 8.6 3.6"/>',
    "scale": '<path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7 2.5 13a2.6 2.6 0 0 0 5 0Z"/><path d="m19 7-2.5 6a2.6 2.6 0 0 0 5 0Z"/><path d="M8 21h8"/>',
    "swords": '<path d="M3 3h4l10 10"/><path d="m14.5 15.5 2.5 2.5"/><path d="M21 3h-4L7 13"/><path d="m9.5 15.5-2.5 2.5"/><path d="m5 15 4 4"/><path d="m19 15-4 4"/><path d="m3.5 20.5 2-2"/><path d="m20.5 20.5-2-2"/>',
    "signal": '<path d="M5 19a10 10 0 0 1 0-14"/><path d="M19 5a10 10 0 0 1 0 14"/><path d="M8.5 15.5a5 5 0 0 1 0-7"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><circle cx="12" cy="12" r="1.4"/>',
    "flask": '<path d="M9 3h6"/><path d="M10 3v6l-5.4 9.4A1.8 1.8 0 0 0 6.2 21h11.6a1.8 1.8 0 0 0 1.6-2.6L14 9V3"/><path d="M7.4 15h9.2"/>',
    "dna": '<path d="M7 3c0 5 10 5 10 9s-10 4-10 9"/><path d="M17 3c0 5-10 5-10 9s10 4 10 9"/><path d="M8.6 6.5h6.8"/><path d="M8.6 17.5h6.8"/>',
    "rewind": '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5V9H8"/><path d="M12 8v4.2l3 1.8"/>',
    "calendar": '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h3v3H8z"/>',
    "news": '<rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2"/><path d="M7 8h7M7 12h7M7 16h4"/>',
    "archive": '<rect x="3" y="4" width="18" height="5" rx="1.2"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>',
    "tag": '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
    "rss": '<circle cx="5.5" cy="18.5" r="1.4"/><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/>',
    "calc": '<rect x="5" y="3" width="14" height="18" rx="2.2"/><path d="M8 7h8"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
    "shield": '<path d="M12 3 4.5 6v6c0 4.9 3.2 8.2 7.5 9 4.3-.8 7.5-4.1 7.5-9V6Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    "code": '<path d="m8 8-5 4 5 4"/><path d="m16 8 5 4-5 4"/><path d="m14 4-4 16"/>',
    "cap": '<path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 9v6"/>',
    "users": '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16.5 5.4a3.2 3.2 0 0 1 0 5.2"/><path d="M18 14.3a6.5 6.5 0 0 1 3.5 5.7"/>',
    "calc": '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M8 6.5h8"/><path d="M8.5 11h0M12 11h0M15.5 11h0M8.5 14.5h0M12 14.5h0M15.5 14.5h0M8.5 18h0M12 18h0M15.5 18h0"/>',
    "brain": '<path d="M9.5 3A2.5 2.5 0 0 0 7 5.5 2.5 2.5 0 0 0 4.5 8c0 .9.5 1.7 1.2 2.1A2.5 2.5 0 0 0 4 12.5c0 1 .6 1.9 1.5 2.3A2.5 2.5 0 0 0 8 19c.7 0 1.4-.3 1.8-.8V3.4A2.5 2.5 0 0 0 9.5 3Z"/><path d="M14.5 3A2.5 2.5 0 0 1 17 5.5 2.5 2.5 0 0 1 19.5 8c0 .9-.5 1.7-1.2 2.1A2.5 2.5 0 0 1 20 12.5c0 1-.6 1.9-1.5 2.3A2.5 2.5 0 0 1 16 19c-.7 0-1.4-.3-1.8-.8V3.4A2.5 2.5 0 0 1 14.5 3Z"/><path d="M12 3v18"/>',
    "book": '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5Z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"/><path d="M8 7h8"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>',
    "activity": '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
    "phone": '<rect x="6" y="2" width="12" height="20" rx="2.6"/><path d="M12 6.5v7"/><path d="m9 10.5 3 3 3-3"/><path d="M10.5 18h3"/>',
    "lock": '<rect x="4" y="10" width="16" height="11" rx="2.2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/>',
    "file": '<path d="M14 3H6.2A1.2 1.2 0 0 0 5 4.2v15.6A1.2 1.2 0 0 0 6.2 21h11.6a1.2 1.2 0 0 0 1.2-1.2V8Z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h5"/>',
    "grid": '<rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/>',
    "speaker": '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    "chev": '<path d="m6 9 6 6 6-6"/>',
    "close": '<path d="M6 6l12 12M18 6 6 18"/>',
    "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/>',
    "map": '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',
    "group": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2a5 5 0 0 1 5.5 5"/>',
    "download": '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    "chat": '<path d="M4 5h16v11H9l-5 4Z"/><path d="M8 9.5h8M8 12.5h5"/>',
    "library": '<path d="M3 20V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14"/><path d="M13 20V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14"/><path d="M3 20h18"/><path d="M6 8h2"/><path d="M16 8h2"/>',
    "eye": '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    "hourglass": '<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 10 5 10 9s-10 4-10 9"/><path d="M17 3c0 5-10 5-10 9s10 4 10 9"/>',
    "exit": '<path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h10"/>',
    "matrix": '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    "robot": '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4"/><circle cx="12" cy="3" r="1.3"/><path d="M9 13h.01"/><path d="M15 13h.01"/><path d="M9.5 16.2h5"/>',
}


def icon(name, cls="ek-svg"):
    return (f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{_P[name]}</svg>')


def e(s):
    return html.escape(str(s), quote=True)


def tri(d, lang, cls="ek-i", tag="span", extra=""):
    """A label that carries all three languages; rendered in `lang`."""
    attrs = "".join(f' data-{k}="{e(d[k])}"' for k in LANGS)
    return f'<{tag} class="{cls}"{attrs}{extra}>{e(d[lang])}</{tag}>'


def aria(d, lang):
    """aria-label/title in `lang` + data-a* for the other languages."""
    return (f' aria-label="{e(d[lang])}" title="{e(d[lang])}"' + "".join(f' data-a{k}="{e(d[k])}"' for k in LANGS))


# ---------------------------------------------------------------- live counts (never hard-code them in a label)
_FA_D = "۰۱۲۳۴۵۶۷۸۹"
_AR_D = "٠١٢٣٤٥٦٧٨٩"


def num(n, lang="fa"):
    """عدد با رقم‌های همان زبان: فارسی ۱۳، سۆرانی ١٣، انگلیسی 13."""
    d = {"fa": _FA_D, "ckb": _AR_D}.get(lang)
    return "".join(d[int(c)] for c in str(n)) if d else str(n)


def n_fac():
    """شمار دانشکده‌های آکادمی — از academy_data خوانده می‌شود تا برچسب‌ها هرگز کهنه نشوند."""
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import academy_data as AD
        return len(AD.FACULTIES)
    except Exception:
        return 0


NFAC = n_fac()

def L(fa, ckb, en):
    return {"fa": fa, "ckb": ckb, "en": en}


# ---------------------------------------------------------------- navigation (single source of truth)
NAV = [
    {"k": "mkt", "t": L("بازار", "بازاڕ", "Markets"), "items": [
        ("/dashboard/", "gauge", L("داشبورد هوشمند", "داشبۆردی زیرەک", "Smart dashboard"),
         L("رژیم بازار، اسکنر فرصت‌ها و امتیاز انتخاب", "ڕژێمی بازاڕ، سکانەری دەرفەت و خاڵی Entekhab", "Market regime, opportunity scanner, Entekhab score")),
        ("/terminal/", "terminal", L("ترمینال", "تێرمیناڵ", "Terminal"),
         L("مشتقات، لیکوئیدها، جریان سرمایه و کره‌زمین", "مەشتەقە، لیکوێد، ڕەوتی سەرمایە و گۆی زەوی", "Derivatives, liquidations, capital flow, globe")),
        ("/coins/", "coins", L("کوین‌ها", "دراوەکان", "Coins"),
         L("پروفایل، قیمت زنده و تحلیل هر ارز", "پرۆفایل، نرخی زیندوو و شیکاریی هەر دراوێک", "Profile, live price and analysis for every coin")),
        ("/fear-greed/", "thermo", L("شاخص ترس و طمع", "پێوەری ترس و تەماح", "Fear & Greed index"),
         L("احساسات امروز بازار و تاریخچهٔ آن", "هەستی ئەمڕۆی بازاڕ و مێژووەکەی", "Today's market mood and its history")),
        ("/sectors/", "pie", L("بخش‌های بازار", "بەشەکانی بازاڕ", "Market sectors"),
         L("DeFi، هوش مصنوعی، RWA، میم و …", "DeFi، AI، RWA، میم و …", "DeFi, AI, RWA, memes and more")),
        ("/compare/", "scale", L("مقایسهٔ ارزها", "بەراوردی دراوەکان", "Compare coins"),
         L("مقایسهٔ داده‌محور دو ارز", "بەراوردی داتایی دوو دراو", "Data-driven head-to-head")),
    ]},
    {"k": "ana", "t": L("تحلیل", "شیکاری", "Analysis"), "items": [
        ("/indicators/", "signal", L("اندیکاتورهای اختصاصی", "ئیندیکاتۆرە تایبەتەکان", "Signature indicators"),
         L("سیگنال‌های اندیکاتورهای Coin_Kurd در TradingView", "سیگناڵی ئیندیکاتۆرەکانی Coin_Kurd لە TradingView", "Signals from Coin_Kurd's TradingView indicators")),
        ("/lab/", "flask", L("آزمایشگاه بازار", "تاقیگەی بازاڕ", "Market lab"),
         L("حافظهٔ بازار، مونت‌کارلو و بک‌تست", "بیرەوەریی بازاڕ، مۆنتی‌کارلۆ و باک‌تێست", "Market memory, Monte Carlo, backtests")),
        ("/dna/", "dna", L("DNA بازار", "DNAی بازاڕ", "Market DNA"),
         L("ژن‌های هر ارز و ارزهای مشابه", "جینەکانی هەر دراو و دراوە هاوشێوەکان", "Each coin's genes and look-alikes")),
        ("/replay/", "rewind", L("بازپخش بازار", "دووبارە پەخشی بازاڕ", "Market replay"),
         L("بازار در هر لحظه از گذشته", "بازاڕ لە هەر ساتێکی ڕابردوو", "The market at any past moment")),
        ("/onchain/", "activity", L("تحلیل آنچین", "ئاناڵیزی ئانچین", "On-chain analysis"),
         L("خلاصهٔ تحلیل‌های آنچین به فارسی و کوردی", "پوختەی شیکارییە ئانچینەکان بە کوردی و فارسی", "On-chain analysis digests in Persian and Kurdish")),
        ("/crypto-news/", "news", L("اخبار کریپتو", "هەواڵی کریپتۆ", "Crypto news"),
         L("خلاصهٔ اخبار روز بازار", "پوختەی هەواڵەکانی ڕۆژ", "Today's crypto news, summarised")),
        ("/sentiment/", "activity", L("شاخص احساسات اخبار", "پێوەری هەستی هەواڵ", "News sentiment index"),
         L("حس و حال اخبار امروز بازار", "هەستی هەواڵەکانی ئەمڕۆ", "Today's news mood")),
        ("/whales/", "activity", L("رادار نهنگ‌ها", "ڕاداری نەهەنگەکان", "Whale radar"),
         L("انتقال‌های بزرگ روی زنجیره", "گواستنەوە گەورەکان", "Large on-chain transfers")),
        ("/predict/", "rewind", L("بازی پیش‌بینی", "یاری پێشبینی", "Prediction game"),
         L("پیش‌بینی کن، امتیاز بگیر", "پێشبینی بکە، خاڵ وەربگرە", "Predict and earn points")),
        ("/dossier/", "news", L("پرونده‌های تحلیلی", "دۆسیە شیکارییەکان", "Analysis dossiers"),
         L("تحلیل عمیق رویدادهای مهم روز", "شیکاری قووڵی ڕووداوە گرنگەکان", "Deep dives on the day's key stories")),
        ("/today/", "calendar", L("امروز در بازار", "ئەمڕۆ لە بازاڕ", "Today in the market"),
         L("۲۴ ساعت گذشته در یک صفحه", "٢٤ کاتژمێری ڕابردوو لە یەک پەڕەدا", "The last 24 hours on one page")),
        ("/class/", "calendar", L("کلاس شبانه", "وانەی شەوانە", "Nightly class"),
         L("هر شب ۲۰:۰۰ تهران در دیسکورد", "هەموو شەوێک ٢٠:٠٠ تاران لە دیسکۆرد", "Every night 20:00 Tehran on Discord")),
        ("/daily/", "calendar", L("گزارش روزانه", "ڕاپۆرتی ڕۆژانە", "Daily report"),
         L("خلاصهٔ هوشمند هر روز بازار", "پوختەی زیرەکی هەر ڕۆژێکی بازاڕ", "A smart summary of every market day")),
        ("/weekly/", "news", L("مجلهٔ هفتگی", "گۆڤاری هەفتانە", "Weekly magazine"),
         L("مرور هفته و مهم‌ترین رویدادها", "پێداچوونەوەی هەفتە و گرنگترین ڕووداوەکان", "The week in review")),
    ]},
    {"k": "reality", "t": L("واقعیت‌سنج", "ڕاستی‌پێو", "Reality check"), "items": [
        ("/reality/", "eye", L("واقعیت‌سنج انتخاب", "ڕاستی‌پێوی Entekhab", "Entekhab reality check"),
         L("فاصلهٔ حرف و واقعیت بازار، با دادهٔ قابل‌بازبینی", "مەودای قسە و ڕاستیی بازاڕ", "The gap between what the market says and does")),
        ("/track-record/", "lock", L("کارنامهٔ واقعی کانال", "کارنامەی ڕاستەقینەی کەناڵ", "The channel's real record"),
         L("بعد از پست‌ها چه شد، در برابر ساعت‌های تصادفی", "دوای پۆستەکان چی ڕوویدا، بەرامبەر کاتژمێرە هەڕەمەکییەکان", "After the posts, against random hours")),
        ("/roundtable/", "users", L("میزگرد مشاوره", "میزگردی ئامۆژگاری", "The Roundtable"),
         L("پنج تحلیل‌گر هوش مصنوعی، شواهدشان و راهنمای پرسیدن", "پێنج شیکارکەری AI و ڕێنمایی پرسیار", "Five AI analysts, their evidence and how to ask")),
        ("/opportunity/", "calc", L("هزینه فرصت تومان", "تێچووی دەرفەتی تمەن", "Toman opportunity cost"),
         L("اگر دلار یا طلا می‌خریدید امروز چقدر داشتید؟", "ئەگەر دۆلار یان زێڕت بکڕیایە چەندت دەبوو؟", "What if you had bought dollars or gold instead?")),
        ("/ledger/", "lock", L("دفتر عملکرد سیگنال‌ها", "تۆماری ئەنجامی سیگناڵەکان", "Signal ledger"),
         L("هر پیش‌بینی با قفل زمانی؛ دقت واقعی هر منبع", "هەر پێشبینییەک بە قوفڵی کات؛ وردیی ڕاستەقینە", "Time-locked calls and each source's real accuracy")),
        ("/truth/", "scale", L("آزمایشگاه حقیقت سیگنال‌ها", "تاقیگەی ڕاستیی سیگناڵەکان", "Signal Truth Lab"),
         L("پس از کارمزد، برون‌نمونه، با اصلاح آزمون چندگانه", "دوای کرێ، دەرەوەی نموونە، بە ڕاستکردنەوەی تاقیکردنەوە زۆرەکان", "Net of costs, out-of-sample, corrected for multiple tests")),
        ("/regime/", "activity", L("رادار رژیم بازار", "ڕاداری دۆخی بازاڕ", "Market-regime radar"),
         L("احتمال صعودی، نزولی، خنثی یا پرنوسان بودن بازار", "ئەگەری بەرزبوونەوە، دابەزین، مامناوەند یان هەڵاوسان", "How likely bull, bear, sideways or high volatility is")),
        ("/anomalies/", "signal", L("شکارچی ناهنجاری", "ڕاوکەری نائاسایی", "Anomaly hunter"),
         L("حجم، قیمت، OI و فاندینگ غیرعادی امروز", "قەبارە، نرخ، OI و فاندینگی نائاسایی ئەمڕۆ", "Today's unusual volume, price, OI and funding")),
        ("/iran-friction/", "gauge", L("اصطکاک محلی ایران", "لێکخشانی ناوخۆیی ئێران", "Iran friction score"),
         L("تتر، اسپرد صرافی‌ها، اینترنت و اخبار محلی", "تەتەر، سپرێدی ئاڵوگۆڕ، ئینتەرنێت و هەواڵ", "Tether gap, exchange spread, internet, local news")),
        ("/hype/", "hourglass", L("نیمه‌عمر هیاهو", "نیوەتەمەنی هایپ", "Hype half-life"),
         L("عمر و اثر واقعی روایت‌های بازار", "تەمەن و کاریگەریی چیرۆکەکانی بازاڕ", "How long narratives live and what they move")),
        ("/silent-exit/", "exit", L("خروج خاموش", "چوونەدەرەوەی بێدەنگ", "Silent exit"),
         L("تناقض حرف و عمل نهنگ‌ها", "ناکۆکیی قسە و کرداری نەهەنگەکان", "When whales' actions contradict the talk")),
        ("/iran-correlation/", "matrix", L("همبستگی محلی", "پەیوەندیی ناوخۆیی", "Local correlation"),
         L("کریپتو در برابر دلار، تتر، طلا و سکه", "کریپتۆ بەرامبەر دۆلار، تەتەر، زێڕ و سکە", "Crypto vs dollar, tether, gold, coins")),
    ]},
    {"k": "tools", "t": L("ابزارها", "ئامرازەکان", "Tools"), "items": [
        ("/tools/", "calc", L("ابزارهای معامله‌گر", "ئامرازەکانی بازرگان", "Trader tools"),
         L("حجم پوزیشن، ریسک، تبدیل و مقایسه", "قەبارەی پۆزیشن، ڕیسک، گۆڕین و بەراورد", "Position size, risk, converter, compare")),
        ("/safety/", "shield", L("بررسی امنیت توکن", "پشکنینی ئاسایشی تۆکن", "Token safety check"),
         L("هانی‌پات، مالیات معامله و نقدینگی", "هانی‌پۆت، باجی مامەڵە و نەختینە", "Honeypot, trading tax and liquidity")),
        ("/me/", "user", L("فضای من", "بۆشاییی من", "My space"),
         L("واچ‌لیست، هشدارها و معاملهٔ آزمایشی", "لیستی چاودێری، ئاگادارکەرەوە و مامەڵەی تاقیکاری", "Watchlist, alerts and paper trading")),
        ("/developers/", "code", L("API توسعه‌دهندگان", "API بۆ گەشەپێدەران", "Developer API"),
         L("داده‌های باز JSON برای ساخت ابزار", "داتای کراوەی JSON بۆ دروستکردنی ئامراز", "Open JSON data to build on")),
        ("/trade-bot/", "robot", L("ربات معامله‌گر انتخاب", "بۆتی بازرگانیی ئەنتخاب", "Entekhab trading bot"),
         L("توزیع متن‌باز Freqtrade، خودمیزبان — توصیهٔ مالی نیست", "دابەشکردنی سەرچاوەکراوەی Freqtrade، خۆمیوانداری — ئامۆژگاریی دارایی نییە", "A self-hosted, open-source Freqtrade distribution — not financial advice")),
    ]},
    {"k": "learn", "t": L("آموزش", "فێربوون", "Learn"), "items": [
        ("/map/", "map", L("نقشهٔ یادگیری", "نەخشەی فێربوون", "Learning map"),
         L("هر چیزی که باید بلد باشید، روی یک نقشه — با تیک زدن پیشرفت", "هەر شتێک کە دەبێت بیزانیت، لەسەر یەک نەخشە — بە نیشانەکردنی پێشکەوتن", "Everything there is to learn on one map — tick your way through it")),
        ("/kids/", "cap", L("بیت‌کوین برای کودکان", "بیتکۆین بۆ منداڵان", "Bitcoin for Juniors"),
         L("برنامهٔ درسی آزاد و رایگان برای ۸ تا ۱۲ سال: ۶ فصل و ۲۱ فعالیت با بازی، قصه و کاردستی — به فارسی، کوردی و انگلیسی",
           "بەرنامەی وانەیی کراوە و بێبەرامبەر بۆ ٨ تا ١٢ ساڵ: ٦ بەش و ٢١ چالاکی بە یاری، چیرۆک و دەستکاری — بە فارسی، کوردی و ئینگلیزی",
           "A free, open curriculum for ages 8–12: 6 modules and 21 activities of games, stories and crafts — in Persian, Kurdish and English")),
        ("/encyclopedia/", "library", L("دانشنامهٔ بازارهای مالی", "زانستنامەی بازاڕە داراییەکان", "Encyclopedia of financial markets"),
         L("۵۰۶ مدخل به فارسی، کوردی و انگلیسی، با فرمول و منبع", "٥٠٦ خاڵ بە فارسی، کوردی و ئینگلیزی، بە فۆرموڵ و سەرچاوە", "506 entries in Persian, Kurdish and English, with formulas and sources")),
        ("/academy/", "cap", L("آکادمی کریپتو", "ئەکادیمیای کریپتۆ", "Crypto Academy"),
         L(f"{num(NFAC)} دانشکده از صفر تا حرفه‌ای، با آزمون و شبیه‌ساز", f"{num(NFAC, 'ckb')} کۆلێژ لە سفرەوە تا پرۆفیشناڵ، بە تاقیکردنەوە و سیمولەیتەر", f"{NFAC} faculties, zero to pro, with quizzes and a simulator")),
        ("/academy/psychology/", "brain", L("روان‌شناسی معامله‌گر", "دەروونناسیی بازرگان", "Trader psychology"),
         L("سنجش، تحلیل رفتار، ژورنال و مغز سه‌بعدی", "پێوان، شیکاری ڕەفتار، ژۆرناڵ و مێشکی سێ‌ڕەهەندی", "Assessment, behaviour analysis, journal and a 3D brain")),
        ("/academy/lab/", "flask", L("آزمایشگاه آکادمی", "تاقیگەی ئەکادیمیا", "Academy lab"),
         L("شبیه‌ساز معامله، بک‌تست و ماشین‌حساب‌ها", "سیمولەیتەری مامەڵە، باکتێست و ژمێرەرەکان", "Paper trading, backtests and calculators")),
        ("/learn/", "cap", L("مسیر یادگیری", "ڕێڕەوی فێربوون", "Learning path"),
         L("از مبتدی تا پیشرفته، همراه آزمون", "لە سەرەتاییەوە تا پێشکەوتوو، لەگەڵ تاقیکردنەوە", "Beginner to advanced, with quizzes")),
        ("/glossary/", "book", L("واژه‌نامه", "فەرهەنگ", "Glossary"),
         L("اصطلاحات کریپتو به زبان ساده", "زاراوەکانی کریپتۆ بە زمانی سادە", "Crypto terms in plain words")),
    ]},
    {"k": "arc", "t": L("آرشیو", "ئەرشیڤ", "Archive"), "items": [
        ("/#feed", "archive", L("آرشیو مطالب", "ئەرشیڤی بابەتەکان", "Post archive"),
         L("همهٔ تحلیل‌های کانال Coin_Kurd", "هەموو شیکارییەکانی کەناڵی Coin_Kurd", "Every analysis from the Coin_Kurd channel")),
        ("/#library", "library", L("کتابخانهٔ بازارهای مالی", "کتێبخانەی بازاڕە داراییەکان", "Financial markets library"),
         L("فیلم، مستند، کتاب، ابزار و منبع آموزشی رایگان — با معرفی فارسی، کوردی و انگلیسی",
           "فیلم، دۆکیۆمێنتاری، کتێب، ئامراز و سەرچاوەی فێرکاریی بێبەرامبەر — بە فارسی، کوردی و ئینگلیزی",
           "Films, documentaries, books, tools and free courses — described in Persian, Kurdish and English")),
        ("/#hall", "tag", L("دسته‌بندی‌ها", "پۆلەکان", "Categories"),
         L("مطالب بر اساس موضوع", "بابەتەکان بەپێی بابەت", "Posts by topic")),
        ("/feed.xml", "rss", L("خوراک RSS", "فیدی RSS", "RSS feed"),
         L("دریافت خودکار مطالب تازه", "وەرگرتنی ئۆتۆماتیکی بابەتی نوێ", "New posts, automatically")),
    ]},
    {"k": "more", "t": L("بیشتر", "زیاتر", "More"), "items": [
        ("/about/", "info", L("درباره انتخاب", "دەربارەی Entekhab", "About Entekhab"),
         L("چطور کار می‌کند و نقشهٔ راه", "چۆن کار دەکات و نەخشەی ڕێگا", "How it works and the roadmap")),
        ("/methodology/", "file", L("روش کار و منابع داده", "ڕێگای کار و سەرچاوەی داتا", "Methodology & data sources"),
         L("فرمول امتیاز، اسکنر و محدودیت‌ها", "فۆرموولی خاڵ، سکانەر و سنوورەکان", "Score formula, scanner, limits")),
        ("/status/", "activity", L("شفافیت و وضعیت", "ڕوونی و دۆخ", "Transparency & status"),
         L("سلامت منابع داده و کارنامهٔ سیگنال‌ها", "تەندروستیی سەرچاوەکانی داتا و تۆماری سیگناڵەکان", "Data health and signal track record")),
        ("/app/", "phone", L("اپلیکیشن اندروید", "ئەپی ئەندرۆید", "Android app"),
         L("دانلود مستقیم و نصب امن", "داگرتنی ڕاستەوخۆ و دامەزراندنی سەلامەت", "Direct, verified download")),
        ("/privacy/", "lock", L("حریم خصوصی", "پاراستنی تایبەتمەندی", "Privacy"),
         L("چه داده‌ای نگه می‌داریم (تقریباً هیچ)", "چ داتایەک هەڵدەگرین (نزیکەی هیچ)", "What we keep (almost nothing)")),
        ("/terms/", "file", L("شرایط استفاده", "مەرجەکانی بەکارهێنان", "Terms of use"),
         L("سلب مسئولیت و قوانین استفاده", "ڕاگەیاندنی بەرپرسیارێتی و یاساکان", "Disclaimer and rules of use")),
    ]},
]
BATTLE = ("/battle/", "swords", L("میدان نبرد", "مەیدانی شەڕ", "Battlefield"))
# the order of the top bar: Markets, Analysis, Tools, Learn, Archive, Battlefield (direct), More
TOP_ORDER = ["mkt", "ana", "reality", "tools", "learn", "arc", "BATTLE", "more"]

SOCIAL = [  # (key, url, icon file, label)  — links taken from the footer of every Coin_Kurd channel post
    ("tg", "https://t.me/Coin_Kurd", "telegram", L("کانال تلگرام", "کەناڵی تێلێگرام", "Telegram channel")),
    ("tgg", "https://t.me/Coin_Kurd_Group", "telegram", L("سوپرگروه تلگرام", "سوپەرگرووپی تێلێگرام", "Telegram supergroup")),
    ("yt", "https://www.youtube.com/channel/UCUzxNwejhNtSGaOZaI2ku5w", "youtube", L("یوتیوب", "یوتیوب", "YouTube")),
    ("x", "https://x.com/omid_mokri", "x", L("ایکس (توییتر)", "ئێکس (تویتەر)", "X (Twitter)")),
    ("ig", "https://www.instagram.com/coin_kurd", "instagram", L("اینستاگرام", "ئینستاگرام", "Instagram")),
    ("dc", "https://discord.gg/TtT2BHmZyJ", "discord", L("دیسکورد", "دیسکۆرد", "Discord")),
    ("tv", "https://www.tradingview.com/u/Coin_Kurd/", "tradingview", L("تریدینگ‌ویو", "تریدینگ ڤیو", "TradingView")),
]

T = {
    "search": L("جستجو", "گەڕان", "Search"),
    "read": L("خواندن با صدا", "خوێندنەوە بە دەنگ", "Read aloud"),
    "app": L("دانلود اپ", "داگرتنی ئەپ", "Get the app"),
    "me": L("فضای من", "بۆشاییی من", "My space"),
    "tg": L("تلگرام", "تێلێگرام", "Telegram"),
    "home": L("خانه", "ماڵەوە", "Home"),
    "mkt": L("بازار", "بازاڕ", "Markets"),
    "battle": L("نبرد", "شەڕ", "Battle"),
    "learn": L("آموزش", "فێربوون", "Learn"),
    "all": L("همه", "هەموو", "All"),
    "lang": L("زبان", "زمان", "Language"),
    "tagline": L("بازار را بفهم، نه فقط دنبال کن.", "لە بازاڕ تێبگە، تەنها دوای مەکەوە.", "Understand the market, don't just follow it."),
    "about": L("تحلیل، داده و آموزش بازار کریپتو به فارسی، کوردی و انگلیسی؛ به‌روزرسانی خودکار از کانال Coin_Kurd و منابع باز داده.",
               "شیکاری، داتا و فێرکاریی بازاڕی کریپتۆ بە فارسی، کوردی و ئینگلیزی؛ نوێکردنەوەی ئۆتۆماتیکی لە کەناڵی Coin_Kurd و سەرچاوە کراوەکانی داتا.",
               "Crypto market analysis, data and education in Persian, Kurdish and English — updated automatically from the Coin_Kurd channel and open data sources."),
    "dl": L("دانلود مستقیم", "داگرتنی ڕاستەوخۆ", "Direct download"),
    "andr": L("اپ اندروید", "ئەپی ئەندرۆید", "Android app"),
    "anyd": L("روی هر دستگاه", "لەسەر هەر ئامێرێک", "On any device"),
    "pwa": L("نسخهٔ وب (PWA)", "وەشانی وێب (PWA)", "Web app (PWA)"),
    "join": L("به جامعهٔ ما بپیوندید", "پەیوەندی بکە بە کۆمەڵگاکەمانەوە", "Join our community"),
    "contact": L("تماس با ما", "پەیوەندیمان پێوە بکە", "Contact us"),
    "rights": L("همهٔ حقوق محفوظ است", "هەموو مافەکان پارێزراون", "All rights reserved"),
    "nfa": L("هیچ‌یک از مطالب این سایت توصیهٔ مالی نیست؛ معامله در بازار کریپتو ریسک بالایی دارد.",
             "هیچ بابەتێکی ئەم ماڵپەڕە ئامۆژگاریی دارایی نییە؛ مامەڵە لە بازاڕی کریپتۆدا ڕیسکی زۆرە.",
             "Nothing on this site is financial advice; crypto trading carries high risk."),
    "sitemap": L("نقشهٔ سایت", "نەخشەی ماڵپەڕ", "Sitemap"),
    "autopilot": L("گزارش کار خودکار", "ڕاپۆرتی کاری خۆکار", "Autopilot log"),
    "skip": L("پرش به محتوا", "بازدان بۆ ناوەڕۆک", "Skip to content"),
}
FOOT_COLS = ["mkt", "ana", "reality", "tools", "learn", "arc", "more"]   # every NAV group — the footer is the full map of the site


# مسیرهایی که حاشیهٔ نور چرخان می‌گیرند (کلاس ekg در assets/chrome.css)
GLOW = {"/academy/", "/academy/f13/"}


def _item(href, ic, title, desc, lang):
    ext = href.startswith("http")
    tgt = ' target="_blank" rel="noopener noreferrer"' if ext else ""
    cls = "ek-it ekg" if href in GLOW else "ek-it"
    return (f'<a class="{cls}" href="{href}"{tgt}><span class="ek-ic">{icon(ic)}</span>'
            f'<span class="ek-tx">{tri(title, lang, "ek-i ek-tt", "b")}{tri(desc, lang, "ek-i ek-ds", "small")}</span></a>')


def _social(key, url, ico, label, lang, cls="ek-soc"):
    return (f'<a class="{cls} s-{key}" href="{url}" target="_blank" rel="noopener noreferrer me"{aria(label, lang)}>'
            f'<i class="ek-si b-{ico}" aria-hidden="true"></i>{"<i class=ek-gb aria-hidden=true>" + icon("group") + "</i>" if key == "tgg" else ""}'
            f'{tri(label, lang, "ek-i ek-sl")}</a>')


def header(lang="fa"):
    cats = {c["k"]: c for c in NAV}
    parts = []
    for i, k in enumerate(TOP_ORDER):
        if k == "BATTLE":
            href, ic, t = BATTLE
            parts.append(f'<a class="ek-ml ek-hot" href="{href}">{icon(ic)}{tri(t, lang)}</a>')
            continue
        c = cats[k]
        end = " ek-end" if i >= len(TOP_ORDER) - 2 else ""
        items = "".join(_item(h, ic, t, d, lang) for h, ic, t, d in c["items"])
        mt = "ek-mt ekg ekg-pill" if k == "learn" else "ek-mt"
        parts.append(f'<div class="ek-mi{end}" data-k="{k}"><button class="{mt}" type="button" aria-expanded="false" aria-haspopup="true">'
                     f'{tri(c["t"], lang)}{icon("chev", "ek-svg ek-chev")}</button><div class="ek-mp"><div class="ek-mg">{items}</div></div></div>')
    tools = (f'<button class="ek-ib ek-sb" type="button"{aria(T["search"], lang)}>{icon("search")}</button>'
             f'<button class="ek-ib ek-rdb" type="button" aria-haspopup="menu"{aria(T["read"], lang)}>{icon("speaker")}</button>'
             f'<a class="ek-ib ek-tgb" href="https://t.me/Coin_Kurd" target="_blank" rel="noopener noreferrer"{aria(T["tg"], lang)}><i class="ek-si b-telegram"></i></a>'
             f'<div class="ek-lang" id="langs" role="group" aria-label="language"><button type="button" data-l="fa" lang="fa">فا</button>'
             f'<button type="button" data-l="ckb" lang="ckb">کو</button><button type="button" data-l="en" lang="en">EN</button></div>'
             f'<a class="ek-appb" href="/app/"><i class="ek-si b-android"></i>{tri(T["app"], lang)}</a>'
             f'<a class="ek-ib ek-meb" href="/me/"{aria(T["me"], lang)}>{icon("user")}</a>')
    return (f'<!--ek:header--><a class="ek-skip" href="#ek-main">{e(T["skip"][lang])}</a>'
            f'<div class="ekh" id="ekh" role="banner" data-lang="{lang}"><div class="ek-w">'
            f'<a class="ek-brand" href="/" aria-label="entekhab.net"><img src="/assets/logo-h.webp" alt="" width="64" height="40"><span>entekhab<b>.net</b></span></a>'
            f'<div class="ek-nav" role="navigation" aria-label="main">{"".join(parts)}</div>'
            f'<div class="ek-tools">{tools}</div></div></div><span id="ek-main"></span><!--/ek:header-->')


def bottom(lang="fa"):
    tabs = [("/", "home", T["home"], ""), ("/dashboard/", "gauge", T["mkt"], ""), ("/battle/", "swords", T["battle"], " ek-hot"),
            ("/map/", "map", T["learn"], ""), ("#ekf", "grid", T["all"], " ek-all")]
    a = "".join(f'<a class="ek-tab{c}" href="{h}">{icon(ic)}{tri(t, lang)}</a>' for h, ic, t, c in tabs)
    return f'<!--ek:bottom--><div class="ekb" id="ekb" role="navigation" aria-label="tabs">{a}</div><!--/ek:bottom-->'


def footer(lang="fa"):
    cats = {c["k"]: c for c in NAV}
    cols = []
    for k in FOOT_COLS:
        c = cats[k]
        items = list(c["items"])
        if k == "mkt":
            items.append((BATTLE[0], BATTLE[1], BATTLE[2], BATTLE[2]))
        lis = "".join(f'<li><a href="{h}">{tri(t, lang)}</a></li>' for h, ic, t, d in items)
        if k == "more":
            lis += f'<li><a href="https://t.me/Coin_Kurd_Group" target="_blank" rel="noopener noreferrer">{tri(T["contact"], lang)}</a></li>'
        cols.append(f'<details class="ekf-col" open><summary>{tri(c["t"], lang)}{icon("chev", "ek-svg ek-chev")}</summary><ul>{lis}</ul></details>')
    soc = "".join(_social(k, u, i, lab, lang) for k, u, i, lab in SOCIAL)
    apps = (f'<a class="ek-badge" href="/app/"><i class="ek-si b-android"></i><span>{tri(T["dl"], lang, "ek-i", "small")}{tri(T["andr"], lang, "ek-i", "b")}</span></a>'
            f'<a class="ek-badge" href="/app/#web">{icon("globe")}<span>{tri(T["anyd"], lang, "ek-i", "small")}{tri(T["pwa"], lang, "ek-i", "b")}</span></a>')
    lab = {h: t for h, ic, t, d in cats["more"]["items"]}   # by address: inserting a menu item must not shift these labels
    legal = (f'<a href="/privacy/">{tri(lab["/privacy/"], lang)}</a><a href="/terms/">{tri(lab["/terms/"], lang)}</a>'
             f'<a href="/methodology/">{tri(lab["/methodology/"], lang)}</a><a href="/autopilot/">{tri(T["autopilot"], lang)}</a><a href="/sitemap.xml">{tri(T["sitemap"], lang)}</a><a href="/feed.xml">RSS</a>')
    return (f'<!--ek:footer--><div class="ekf" id="ekf" role="contentinfo" data-lang="{lang}"><div class="ek-w">'
            f'<div class="ekf-top"><div class="ekf-brand"><a class="ek-brand" href="/" aria-label="entekhab.net"><img src="/assets/logo-h.webp" alt="" width="64" height="40" loading="lazy"><span>entekhab<b>.net</b></span></a>'
            f'{tri(T["tagline"], lang, "ek-i ekf-tag", "p")}{tri(T["about"], lang, "ek-i ekf-ab", "p")}<div class="ekf-apps">{apps}</div></div>'
            f'<div class="ekf-com">{tri(T["join"], lang, "ek-i ekf-h", "p")}<div class="ekf-soc">{soc}</div></div></div>'
            f'<div class="ekf-cols">{"".join(cols)}</div>'
            f'<div class="ekf-bot"><span class="ekf-cr">© <span class="ek-yr">2026</span> entekhab.net — {tri(T["rights"], lang)}</span>'
            f'{tri(T["nfa"], lang, "ek-i ekf-nfa")}<span class="ekf-lg">{legal}</span></div>'
            f'</div></div><!--/ek:footer-->')


HEAD_TAGS = (f'<link rel="stylesheet" href="/assets/chrome.css?v={VER}">'
             f'<meta name="referrer" content="strict-origin-when-cross-origin">')
BODY_TAGS = f'<script src="/assets/chrome.js?v={VER}" defer></script>'

# Content-Security-Policy as a <meta> (GitHub Pages cannot send response headers).
# Inline scripts stay allowed because every page ships its app code inline; everything else is pinned
# to the hosts the site really talks to. three.js is self-hosted (assets/vendor), so the only
# third-party script host is TradingView's widget loader.
# 'wasm-unsafe-eval' lets the read-aloud engine compile its self-hosted WebAssembly (tts/); it
# allows WebAssembly compilation only, not JavaScript eval.
CSP = ("default-src 'self'; "
       "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://s3.tradingview.com; "
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src 'self' https://fonts.gstatic.com data:; "
       "img-src 'self' data: blob: https:; "
       "media-src 'self' data: blob:; "
       "connect-src 'self' https://data-api.binance.vision wss://data-stream.binance.vision wss://fstream.binance.com "
       "https://www.okx.com wss://ws.okx.com wss://stream.bybit.com https://mempool.space "
       "https://api.gopluslabs.io https://api.dexscreener.com https://open.er-api.com; "
       "frame-src https://*.tradingview.com https://*.tradingview-widget.com; "
       "worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; "
       "upgrade-insecure-requests")
CSP_META = f'<meta http-equiv="Content-Security-Policy" content="{CSP}">'


def with_csp(doc):
    """Put (or refresh) the CSP meta right after <meta charset>, before any script or stylesheet."""
    doc = re.sub(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">', "", doc)
    m = re.search(r'<meta charset="?utf-8"?\s*/?>', doc, re.I)
    if not m:
        return doc.replace("<head>", "<head>" + CSP_META, 1)
    return doc[:m.end()] + CSP_META + doc[m.end():]


def chrome_all(lang="fa"):
    return header(lang), bottom(lang), footer(lang)


# ---------------------------------------------------------------- injection into static pages
def _replace_block(doc, name, new):
    a, b = f"<!--ek:{name}-->", f"<!--/ek:{name}-->"
    i, j = doc.find(a), doc.find(b)
    if i >= 0 and j > i:
        return doc[:i] + new + doc[j + len(b):], True
    return doc, False


def inject_doc(doc, lang="fa", credits_from_footer=True):
    """Insert or refresh header/bottom/footer + css/js tags in one HTML document (idempotent)."""
    hd, bt, ft = chrome_all(lang)
    doc, ok_h = _replace_block(doc, "header", hd)
    doc, ok_b = _replace_block(doc, "bottom", bt)
    doc, ok_f = _replace_block(doc, "footer", ft)
    if not ok_h:
        # tool pages: <header><div class="wrap"> brand / #tabs / #langs </div></header>
        m = re.search(r'<header><div class="wrap">.*?</div></header>', doc, re.S)
        if not m:
            raise ValueError("no header found")
        old = m.group(0)
        keep_tabs = 'id="tabs"' in old and "$('#tabs').innerHTML=[[" in doc  # lab keeps its own section tabs under the header
        sub = '<div class="ek-sub"><div class="wrap"><nav class="tabs" id="tabs"></nav></div></div>' if keep_tabs else ""
        doc = doc.replace(old, hd + sub, 1)
    if not ok_f:
        ms = list(re.finditer(r"<footer>(.*?)</footer>", doc, re.S))
        if ms:
            m = ms[-1]
            inner = m.group(1).strip()
            # keep page-specific data credits as a line above the shared footer; drop the duplicated disclaimer
            inner = re.sub(r'\s*—?\s*<span data-t="nfa"></span>\s*', " ", inner)
            inner = re.sub(r"^entekhab\.net\s*[·—-]?\s*", "", inner).strip(" ·—-")
            credit = f'<p class="ek-credit">{inner}</p>' if inner and credits_from_footer else ""
            doc = doc[:m.start()] + credit + bt + ft + doc[m.end():]
        else:
            doc = doc.replace("</body>", bt + ft + "</body>", 1)
    elif not ok_b:
        doc = doc.replace("<!--ek:footer-->", bt + "<!--ek:footer-->", 1)
    if "/assets/chrome.css" not in doc:
        doc = doc.replace("</head>", HEAD_TAGS + "</head>", 1)
    else:
        doc = re.sub(r"/assets/chrome\.css\?v=\w+", f"/assets/chrome.css?v={VER}", doc)
    if "/assets/chrome.js" not in doc:
        doc = doc.replace("</body>", BODY_TAGS + "</body>", 1)
    else:
        doc = re.sub(r"/assets/chrome\.js\?v=\w+", f"/assets/chrome.js?v={VER}", doc)
    return with_csp(doc)


STATIC = ["about", "battle", "developers", "dna", "indicators", "lab", "me", "safety", "status", "terminal", "tools",
          "privacy", "terms", "app", "trade-bot"]


def inject_static():
    done = []
    for d in STATIC:
        p = os.path.join(ROOT, d, "index.html")
        if not os.path.exists(p):
            continue
        doc = open(p, encoding="utf-8").read()
        new = inject_doc(doc)
        if new != doc:
            open(p, "w", encoding="utf-8").write(new)
            done.append(d)
    for p in ("index.html", "404.html"):
        fp = os.path.join(ROOT, p)
        if os.path.exists(fp):
            doc = open(fp, encoding="utf-8").read()
            if "<!--ek:header-->" in doc:          # the homepage is converted by hand once; afterwards it is refreshed here
                new = inject_doc(doc)
                if new != doc:
                    open(fp, "w", encoding="utf-8").write(new)
                    done.append(p)
    return done


if __name__ == "__main__":
    print("chrome: refreshed", inject_static())
