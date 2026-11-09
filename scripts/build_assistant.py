#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
نمایهٔ «پشتیبان انتخاب» — data/assistant.json

جستجوگر هوشمند سایت که در صفحهٔ اصلی به‌صورت چت ظاهر می‌شود. نمایه از خود سایت ساخته می‌شود:
  • نقشهٔ کامل سایت (همان منوی chrome.py، با عنوان و توضیح سه‌زبانه)
  • ۵۰۶ مدخل دانشنامه (encyclopedia/index.json) با کلیدواژه‌های سه‌زبانه
  • دانشکده‌ها و درس‌های آکادمی
  • آخرین پست‌های کانال Coin_Kurd (عنوان، دسته، کوین)
  • پرسش‌های پرتکرار پشتیبانی (دست‌نویس، سه‌زبانه)
  • «پاسخ‌های زنده»: الگوهایی که ویجت با آن‌ها از فایل‌های JSON سایت عدد لحظه‌ای می‌خواند

هیچ کلید API در مرورگر قرار نمی‌گیرد؛ همه‌چیز از دادهٔ عمومی خود سایت خوانده می‌شود.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reality_common as R  # noqa: E402
import assistant_kb as KB  # noqa: E402

TG_ADMIN = "Kurdistan_Coin"
MAX_POSTS = 140
L = R.L


def tri(x, fa_fallback=""):
    """normalise a 3-language dict coming from different modules"""
    if isinstance(x, dict):
        return {"fa": x.get("fa") or fa_fallback, "ckb": x.get("ckb") or x.get("fa") or fa_fallback, "en": x.get("en") or x.get("fa") or fa_fallback}
    s = x or fa_fallback
    return {"fa": s, "ckb": s, "en": s}


def doc(url, title, desc="", kws=(), group="page"):
    d = {"u": url, "t": tri(title), "g": group}
    de = tri(desc) if desc else None
    if de and any(de.values()):
        d["d"] = de
    k = " ".join(str(x) for x in kws if x)
    if k:
        d["k"] = k[:400]
    return d


# ------------------------------------------------------------------ sources
def from_menu():
    """every page the site's own menu points at — titles and descriptions already in 3 languages"""
    import chrome as C
    out, seen = [], set()
    for cat in C.NAV:
        label = tri(cat.get("t"))
        for href, _icon, t, de in cat["items"]:
            if not href.startswith("/") or href in seen:
                continue
            seen.add(href)
            tt, dd = tri(t), tri(de)
            kws = [label["fa"], label["ckb"], label["en"], tt["ckb"], tt["en"], dd["fa"], dd["ckb"], dd["en"],
                   href.strip("/").replace("-", " ").replace("/", " ")]
            out.append(doc(href, t, de, kws, "page"))
    for href, t, de, kws in EXTRA_PAGES:          # pages that live outside the mega-menu
        if href not in seen:
            seen.add(href)
            out.append(doc(href, t, de, kws, "page"))
    return out


EXTRA_PAGES = [
    ("/battle/", L("میدان نبرد", "مەیدانی شەڕ", "Battlefield"),
     L("بازار زندهٔ بیت‌کوین به شکل یک نبرد سه‌بعدی", "بازاڕی زیندووی بیتکۆین وەک شەڕێکی سێ‌ڕەهەندی", "The live bitcoin market as a 3D battle"),
     ["نبرد", "battle", "شەڕ", "سه بعدی", "3d"]),
    ("/extension/", L("افزونهٔ کروم و فایرفاکس", "پێوەکراوی کرۆم و فایەرفۆکس", "Chrome & Firefox extension"),
     L("قیمت، گزارش، تحلیل، واقعیت‌سنج، دانشنامه و هشدار در نوار مرورگر", "نرخ، ڕاپۆرت، شیکاری و ئاگاداری لە وێبگەڕدا", "Prices, report, analysis, reality check, encyclopedia and alerts in your browser"),
     ["افزونه", "اکستنشن", "extension", "chrome", "firefox", "کروم", "فایرفاکس", "پێوەکراو"]),
]


def _nav():
    import chrome as C
    m = {}
    for cat in C.NAV:
        for href, _icon, t, de in cat["items"]:
            m[href] = (tri(t), tri(de))
    for href, t, de, _k in EXTRA_PAGES:
        m.setdefault(href, (tri(t), tri(de)))
    return m


def features():
    """One answer per feature that says what it does and every place it can be opened: the site page,
    the bot section and the extension tab. The bot's own labels come from bot_menu.S, so a feature added
    to the bot is known here without a second edit."""
    import bot_menu as M
    nav, out, used = _nav(), [], set()
    langs = ("fa", "ckb", "en")

    def bot_label(k, lg):
        ic, t, d = M.S[k]
        return (t.get(lg) or t["fa"]), ((d or {}).get(lg) or (d or {}).get("fa") or "")

    for href, keys, ext in KB.FEATURES:
        keys = [k for k in keys if k in M.S]
        used.update(keys)
        title, desc = nav.get(href, (None, None))
        if not title:
            continue
        ans = {}
        for lg in langs:
            parts = [desc[lg] + "." if desc[lg] and not desc[lg].endswith((".", "؟", "!")) else desc[lg]]
            parts.append(f"{KB.WHERE['site'][lg]}: «{title[lg]}».")
            if keys:
                parts.append(f"{KB.WHERE['bot'][lg]}: " + "، ".join(f"«{bot_label(k, lg)[0]}»" for k in keys)
                             + (" — " + bot_label(keys[0], lg)[1] if bot_label(keys[0], lg)[1] else ""))
            if ext:
                parts.append(f"{KB.WHERE['ext'][lg]} «{KB.EXT_TAB[ext][lg]}».")
            parts.append(KB.WHERE["app"][lg])
            ans[lg] = " ".join(p for p in parts if p)
        q = [title[lg] for lg in langs] + [bot_label(k, lg)[0] for k in keys for lg in langs]
        out.append({"q": q, "t": title, "a": ans, "u": href, "g": "feature",
                    **({"u2": KB.bot_url(keys[0])} if keys else {})})
    for k in [x for g in M.GROUPS.values() for x in g] + [x for x in M.HOME_ITEMS if not x.startswith("g_")]:
        if k in used or k not in M.S:
            continue
        used.add(k)
        t = {lg: bot_label(k, lg)[0] for lg in langs}
        a = {lg: (bot_label(k, lg)[1] + " " if bot_label(k, lg)[1] else "") + f"{KB.WHERE['bot'][lg]}: «{t[lg]}»." for lg in langs}
        out.append({"q": list(t.values()) + [k], "t": t, "a": a, "u": KB.bot_url(k), "g": "feature"})
    return out


def from_encyclopedia():
    p = os.path.join(R.ROOT, "encyclopedia", "index.json")
    if not os.path.exists(p):
        return []
    rows = json.load(open(p, encoding="utf-8"))
    out = []
    for x in rows:
        t = x.get("t") or {}
        if not t.get("fa"):
            continue
        titles = " ".join(str(v) for v in t.values()).lower()
        extra = [k for k in (x.get("k") or []) if str(k).lower() not in titles][:5]
        out.append(doc(f"/encyclopedia/#{x['i']}", t, "", extra, "term"))
    return out


def from_academy():
    try:
        import academy_data as AD
    except Exception:  # noqa: BLE001
        return []
    out = []
    for f in AD.FACULTIES:
        out.append(doc(f"/academy/{f['id']}/", L(f["title"], f["title"], f.get("en") or f["title"]),
                       L(f.get("summary", ""), f.get("summary", ""), ""), ["academy", "آکادمی", "دانشکده", f.get("en", "")], "academy"))
    try:
        content = AD.load_content()
    except Exception:  # noqa: BLE001
        content = {}
    for fid, mod in (content or {}).items():
        for course in (getattr(mod, "COURSES", None) or []):
            for lesson in course.get("lessons", []) or []:
                t = lesson.get("title")
                if t:
                    out.append(doc(f"/academy/{fid}/{course.get('id', '')}/#{lesson.get('id', '')}",
                                   L(t, t, ""), "", ["درس", "آکادمی", course.get("title", "")], "academy"))
    return out[:400]


def from_posts():
    rows = R.load("posts_lite.json", [])
    rows = sorted([x for x in rows if x.get("date") and x.get("title")], key=lambda x: x["date"], reverse=True)[:MAX_POSTS]
    out = []
    for x in rows:
        title = re.sub(r"\s+", " ", str(x["title"]))[:120]
        out.append({"u": f"/p/{x['id']}/", "t": tri(title), "g": "post", "dt": x["date"][:10],
                    "k": " ".join([*(x.get("coins") or []), *(x.get("hashtags") or [])[:6], x.get("category", "")])[:200]})
    return out


# ------------------------------------------------------------------ support FAQ (hand-written, 3 languages)
def faq():
    F = [
        (["سایت انتخاب چیست", "entekhab چیست", "این سایت چیست", "about", "درباره"],
         L("انتخاب چیست؟", "Entekhab چییە؟", "What is Entekhab?"),
         L("entekhab.net یک مرکز تحلیل و دادهٔ کریپتو به فارسی، کوردی سورانی و انگلیسی است: داشبورد هوشمند، اسکنر تکنیکال، امتیاز اختصاصی هر کوین، رادار نهنگ‌ها، بررسی امنیت توکن، آکادمی، دانشنامه و لایهٔ واقعیت‌سنج. همهٔ داده‌ها از منابع عمومی و به‌صورت خودکار به‌روز می‌شوند.",
           "entekhab.net ناوەندێکی شیکاری و داتای کریپتۆیە بە فارسی، کوردیی سۆرانی و ئینگلیزی: داشبۆرد، سکانەر، خاڵی تایبەت، ڕاداری نەهەنگ، ئەکادیمیا و زانستنامە.",
           "entekhab.net is a crypto analysis and data hub in Persian, Sorani Kurdish and English: a smart dashboard, technical scanner, a per-coin score, whale radar, token safety checks, an academy, an encyclopedia and the reality-check layer."),
         "/about/"),
        (["امتیاز انتخاب", "entekhab score", "score چطور", "امتیاز کوین", "coin score", "how is the score", "خاڵی"],
         L("امتیاز انتخاب چطور حساب می‌شود؟", "خاڵی Entekhab چۆن دەژمێردرێت؟", "How is the Entekhab score computed?"),
         L("امتیاز هر کوین از ترکیب شفاف چند مؤلفهٔ تکنیکال، نقدینگی، مشتقات و احساسات بازار ساخته می‌شود و در صفحهٔ هر کوین، اجزای آن جداگانه نشان داده می‌شود.",
           "خاڵی هەر دراوێک لە تێکەڵەی ڕوونی چەند پێکهاتەی تەکنیکی، شلەیی، مەشتەقە و هەستی بازاڕ دروست دەبێت.",
           "Each coin's score is a transparent blend of technical, liquidity, derivatives and sentiment components; every component is shown separately on the coin's page."),
         "/coins/"),
        (["دفتر سیگنال", "ledger", "دقت سیگنال", "کارنامه سیگنال", "قفل زمانی", "signal accuracy", "how accurate are the signals", "track record", "وردیی سیگناڵ", "تۆماری سیگناڵ"],
         L("دفتر عملکرد سیگنال‌ها چیست؟", "تۆماری ئەنجامی سیگناڵەکان چییە؟", "What is the signal ledger?"),
         L("هر پیش‌بینی در لحظهٔ انتشار با قیمت مبنا، جهت و بازه قفل می‌شود و نتیجه‌اش خودکار حساب می‌شود. هر ردیف هش دارد و سرِ زنجیره روی بلاک‌چین بیت‌کوین مهر زمانی می‌خورد، پس هیچ ردیفی بعداً قابل تغییر نیست.",
           "هەر پێشبینییەک لە ساتی بڵاوبوونەوەدا قوفڵ دەکرێت و ئەنجامەکەی خۆکارانە دەژمێردرێت؛ هەر ڕیزێک هاشی هەیە.",
           "Every call is locked at publication with its reference price, direction and horizon, and settled automatically. Each row is hashed and the chain head is timestamped on Bitcoin, so no row can be changed later."),
         "/ledger/"),
        (["آزمایشگاه استراتژی", "بک‌تست استراتژی", "استراتژی خودم", "strategy lab", "backtest my", "آزمون جایگشت", "walk-forward", "واک فوروارد", "تاقیگەی ستراتیژ"],
         L("چطور استراتژی خودم را بک‌تست کنم؟", "چۆن ستراتیژی خۆم باکتێست بکەم؟", "How do I back-test my own strategy?"),
         L("در آزمایشگاه استراتژی شرط ورود و خروج را با RSI، میانگین‌ها، حجم، ترس و طمع، رژیم بازار و … بسازید. نتیجه پس از کارمزد و لغزش نمایش داده می‌شود، آزمون جایگشت می‌گوید لبه واقعی است یا شانس، و واک-فوروارد پایداری را روی دادهٔ دیده‌نشده می‌سنجد. همه‌چیز در مرورگر خودتان اجرا می‌شود.",
           "لە تاقیگەی ستراتیژ مەرجی چوونە و دەرچوون دروست بکە؛ ئەنجام دوای کرێ پیشان دەدرێت و تاقیکردنەوەی جێگۆڕکێ و واک-فۆروارد ڕاستیی لێوارەکە دەپێون.",
           "In the strategy lab, build entry and exit rules from RSI, moving averages, volume, Fear & Greed, the market regime and more. Results are shown after fees and slippage, a permutation test tells a real edge from luck, and walk-forward checks it on unseen data. Everything runs in your browser."),
         "/strategy-lab/"),
        (["آزمایشگاه حقیقت", "حقیقت سیگنال", "truth lab", "signal truth", "کالیبراسیون", "brier", "بک‌تست", "backtest", "تاقیگەی ڕاستی"],
         L("آزمایشگاه حقیقت سیگنال‌ها چیست؟", "تاقیگەی ڕاستیی سیگناڵەکان چییە؟", "What is the Signal Truth Lab?"),
         L("سخت‌گیرانه‌ترین ممیزی سیگنال‌های سایت: نتیجه‌ها پس از کارمزد و لغزش، بک‌تست جدا از نتیجهٔ زنده، با اصلاح آزمون‌های چندگانه (بنجامینی–هوخبرگ و هولم)، کالیبراسیون احتمال (Brier) و تفکیک بر اساس رژیم بازار. نتیجه‌های منفی هم منتشر می‌شوند.",
           "توندترین وردبینیی سیگناڵەکان: دوای کرێ و خلیسکان، باکتێست جیا لە ڕاستەوخۆ، بە ڕاستکردنەوەی تاقیکردنەوە زۆرەکان و ڕێکخستنی ئەگەر.",
           "The strictest audit of the site's signals: results net of fees and slippage, backtest kept apart from live, corrected for multiple tests (Benjamini–Hochberg and Holm), probability calibration (Brier) and a split by market regime. Negative results are published too."),
         "/truth/"),
        (["رژیم بازار", "رادار رژیم", "regime", "بازار صعودی است", "بازار نزولی است", "bull or bear", "دۆخی بازاڕ"],
         L("رادار رژیم بازار چه می‌گوید؟", "ڕاداری دۆخی بازاڕ چی دەڵێت؟", "What does the market-regime radar say?"),
         L("یک مدل مارکوف پنهان روی دادهٔ روزانهٔ بیت‌کوین می‌گوید امروز با چه احتمالی در رژیم صعودی، نزولی، خنثی یا پرنوسان هستیم و احتمال تغییر رژیم تا فردا چقدر است. تاریخچه‌اش برون‌نمونه است.",
           "مۆدێلێکی مارکۆڤی شاراوە دەڵێت ئەمڕۆ بە چ ئەگەرێک لە دۆخی بەرزبوونەوە، دابەزین، مامناوەند یان هەڵاوساندایین.",
           "A hidden Markov model on daily Bitcoin data gives the probability that we are in a bull, bear, sideways or high-volatility regime today, and the chance of a switch by tomorrow. Its history is out-of-sample."),
         "/regime/"),
        (["ناهنجاری", "حجم غیرعادی", "anomaly", "anomalies", "unusual volume", "فاندینگ غیرعادی", "نائاسایی"],
         L("شکارچی ناهنجاری چیست؟", "ڕاوکەری نائاسایی چییە؟", "What is the anomaly hunter?"),
         L("هر روز حجم، حرکت قیمت، سهم خرید تهاجمی، اوپن‌اینترست و فاندینگ حدود ۶۰ ارز را با ۳۰ روز گذشتهٔ خودشان مقایسه می‌کند (z مقاوم) و موارد غیرعادی را نشان می‌دهد؛ همراه با بک‌تست اینکه بعد از هر نوع ناهنجاری معمولاً چه شده است.",
           "هەموو ڕۆژێک قەبارە، جووڵەی نرخ، OI و فاندینگی نزیکەی ٦٠ دراو لەگەڵ ٣٠ ڕۆژی ڕابردووی خۆیان بەراورد دەکات.",
           "Every day it compares volume, price move, aggressive-buy share, open interest and funding of about 60 coins with their own previous 30 days (robust z-score) and lists what is unusual, with a back-test of what typically followed."),
         "/anomalies/"),
        (["اصطکاک ایران", "تتر گران", "قیمت تتر", "دلار آزاد", "friction", "iran friction", "tether gap", "لێکخشانی ئێران", "تەتەر"],
         L("شاخص اصطکاک ایران چه می‌گوید؟", "پێوەری لێکخشانی ئێران چی دەڵێت؟", "What does the Iran friction score say?"),
         L("نشان می‌دهد قیمت جهانی چقدر با واقعیت کاربر ایرانی فاصله دارد: اختلاف نرخ تتر با دلار آزاد، فاصلهٔ قیمت بین صرافی‌های ایرانی، وضعیت دسترسی اینترنت و اخبار منفی محلی.",
           "پیشان دەدات نرخی جیهانی چەند لە ڕاستیی بەکارهێنەری ئێرانی دوورە.",
           "It shows how far the global price is from an Iranian user's reality: the tether gap against the free dollar, the spread between Iranian exchanges, internet access and local negative news."),
         "/iran-friction/"),
        (["ربات معامله گر", "freqtrade", "ربات ترید", "trade bot", "trading bot", "بۆتی مامەڵە"],
         L("ربات معامله‌گر انتخاب چیست؟", "بۆتی مامەڵەکەری Entekhab چییە؟", "What is the Entekhab trading bot?"),
         L("یک توزیع متن‌باز بر پایهٔ Freqtrade است که خودتان روی سرور خودتان نصب می‌کنید؛ کلید صرافی شما هرگز به سایت نمی‌آید. این توصیهٔ مالی نیست.",
           "دابەشکردنێکی سەرچاوەکراوەیە لەسەر بنەمای Freqtrade کە خۆت دایدەمەزرێنیت.",
           "An open-source Freqtrade distribution you install on your own server; your exchange keys never reach this site. Not financial advice."),
         "/trade-bot/"),
        (["آکادمی", "آموزش", "از کجا شروع کنم", "مبتدی", "یادگیری", "where do i start", "beginner", "learn", "دەست پێ بکەم", "فێربوون"],
         L("از کجا شروع کنم؟", "لە کوێوە دەست پێ بکەم؟", "Where should I start?"),
         L("اگر تازه‌کارید از «مسیر یادگیری» شروع کنید، بعد آکادمی را دانشکده‌به‌دانشکده جلو بروید و هر اصطلاح ناآشنا را در دانشنامه بخوانید. بخش روان‌شناسی معامله‌گر هم رفتار خودتان را می‌سنجد.",
           "ئەگەر تازەکاریت لە «ڕێڕەوی فێربوون» دەست پێ بکە، پاشان ئەکادیمیا.",
           "If you are new, start with the learning path, then work through the academy faculty by faculty, and look up every unfamiliar term in the encyclopedia. The trader-psychology section measures your own behaviour."),
         "/learn/"),
        (["روانشناسی", "روان شناسی معامله گر", "psychology", "ژورنال", "trader psychology", "mindset", "journal", "دەروونناسی"],
         L("بخش روان‌شناسی معامله‌گر چه می‌کند؟", "بەشی دەروونناسیی بازرگان چی دەکات؟", "What does the trader-psychology section do?"),
         L("ذهن شما را به داده تبدیل می‌کند: آزمون‌ها، ژورنال رفتاری، کیفیت تصمیم مستقل از سود و زیان و یک مغز سه‌بعدی تعاملی. همهٔ محاسبه در مرورگر خودتان انجام می‌شود و هیچ داده‌ای جایی فرستاده نمی‌شود. این ابزار تشخیص بالینی نیست.",
           "مێشکت دەکاتە داتا: تاقیکردنەوە، ژۆرناڵ و کوالیتیی بڕیار. هەموو ژماردنەکان لە وێبگەڕی خۆتدا دەکرێن.",
           "It turns your mind into data: assessments, a behaviour journal, decision quality independent of profit and loss, and an interactive 3D brain. Everything runs in your own browser and nothing is sent anywhere. It is not a clinical diagnosis."),
         "/academy/psychology/"),
        (["امنیت توکن", "هانی پات", "honeypot", "اسکم", "کلاهبرداری", "scam", "rug pull", "token safety", "فێڵ", "ئاسایشی دراو"],
         L("چطور بفهمم یک توکن کلاهبرداری است؟", "چۆن بزانم دراوێک فێڵە؟", "How do I check whether a token is a scam?"),
         L("آدرس قرارداد را در بخش «بررسی امنیت توکن» بگذارید: هانی‌پات بودن، مالیات خرید و فروش، قفل نقدینگی و اختیارات مالک بررسی می‌شود. نتیجه راهنماست، نه تضمین.",
           "ناونیشانی گرێبەست لە بەشی «پشکنینی ئاسایشی دراو» دابنێ.",
           "Put the contract address into the token-safety checker: honeypot behaviour, buy/sell tax, liquidity lock and owner privileges are checked. The result is guidance, not a guarantee."),
         "/safety/"),
        (["api", "توسعه دهنده", "developer", "دیتا"],
         L("API دارید؟", "API هەیە؟", "Do you have an API?"),
         L("بله، بخش توسعه‌دهندگان آدرس همهٔ فایل‌های JSON عمومی سایت را می‌دهد؛ همان داده‌ای که خود صفحه‌ها از آن استفاده می‌کنند.",
           "بەڵێ، بەشی گەشەپێدەران هەموو فایلە JSONە گشتییەکان دەدات.",
           "Yes — the developers page lists every public JSON file the site itself uses."),
         "/developers/"),
        (["تماس", "پشتیبانی", "ارتباط", "contact", "support", "ادمین", "admin", "help", "human", "پەیوەندی", "پشتگیری"],
         L("چطور با شما تماس بگیرم؟", "چۆن پەیوەندیت پێوە بکەم؟", "How do I contact you?"),
         L(f"از دکمهٔ «گفتگو با پشتیبان» همین پنجره، گفتگو در تلگرام با @{TG_ADMIN} باز می‌شود و متن پرسش‌تان هم کپی می‌شود تا فقط بچسبانید و بفرستید.",
           f"لە دوگمەی «گفتوگۆ لەگەڵ پشتگیری» تەلەگرام لەگەڵ @{TG_ADMIN} دەکرێتەوە.",
           f"Use the “talk to a human” button in this window: it opens a Telegram chat with @{TG_ADMIN} and copies your question so you only have to paste and send."),
         f"https://t.me/{TG_ADMIN}"),
        (["رایگان", "هزینه", "اشتراک", "subscription", "free", "پولی", "cost", "pricing", "بێبەرامبەر"],
         L("استفاده از سایت رایگان است؟", "بەکارهێنانی سایتەکە بێبەرامبەرە؟", "Is the site free?"),
         L("بله، همهٔ بخش‌های سایت رایگان و بدون ثبت‌نام است. چیزی برای فروش نداریم و هیچ سیگنال پولی نمی‌فروشیم.",
           "بەڵێ، هەموو بەشەکان بێبەرامبەرن و بێ تۆمارکردن.",
           "Yes — everything on the site is free and needs no sign-up. Nothing is for sale and no paid signals are sold."),
         "/about/"),
        (["کانال تلگرام", "گروه", "telegram", "coin kurd"],
         L("کانال و گروه تلگرام کجاست؟", "کەناڵ و گرووپی تەلەگرام لە کوێیە؟", "Where are the Telegram channel and group?"),
         L("کانال t.me/Coin_Kurd و گروه گفتگو t.me/Coin_Kurd_Group. آرشیو کامل پست‌های کانال با دسته‌بندی در خود سایت هم هست.",
           "کەناڵ t.me/Coin_Kurd و گرووپ t.me/Coin_Kurd_Group.",
           "Channel t.me/Coin_Kurd and discussion group t.me/Coin_Kurd_Group. The full categorised archive is on the site too."),
         "/archive/"),
        (["توصیه مالی", "مسئولیت", "ریسک", "advice"],
         L("آیا این‌ها توصیهٔ مالی است؟", "ئایا ئەمانە ئامۆژگاریی دارایین؟", "Is any of this financial advice?"),
         L("نه. هیچ‌کدام از مطالب این سایت توصیهٔ مالی نیست؛ ابزار و دادهٔ آموزشی است و تصمیم و ریسک با خود شماست. معامله در بازار کریپتو ریسک بالایی دارد.",
           "نەخێر. هیچ شتێکی ئەم سایتە ئامۆژگاریی دارایی نییە.",
           "No. Nothing here is financial advice; these are educational tools and data, and the decision and the risk are yours. Crypto trading carries high risk."),
         "/terms/"),
    ]
    kb = [{"q": q, "t": tri(t), "a": tri(a), "u": u, "g": "faq"} for q, t, a, u in KB.FAQ]
    covered = {x["t"]["en"] for x in kb} | {"How do I contact you?", "Is the site free?", "Where are the Telegram channel and group?"}
    old = [{"q": q, "t": tri(t), "a": tri(a), "u": u, "g": "faq"} for q, t, a, u in F if tri(t)["en"] not in covered]
    return kb + old


# ------------------------------------------------------------------ live answers
def live():
    """patterns the widget answers from the site's own live JSON files"""
    return [
        {"id": "price", "src": "/data/market.json", "kind": "coin_price",
         "re": "قیمت|نرخ|چند|price|نرخی|بها|چنده", "t": tri(L("قیمت لحظه‌ای", "نرخی ئێستا", "Live price")), "u": "/coins/"},
        {"id": "fng", "src": "/data/market.json", "kind": "fng", "re": "ترس|طمع|fear|greed|احساسات بازار",
         "t": tri(L("شاخص ترس و طمع", "پێوەری ترس و تەماح", "Fear & Greed index")), "u": "/"},
        {"id": "friction", "src": "/data/friction.json", "kind": "friction",
         "re": "اصطکاک|تتر|دلار آزاد|friction|tether|حباب", "t": tri(L("اصطکاک محلی ایران", "لێکخشانی ناوخۆیی ئێران", "Iran friction")), "u": "/iran-friction/"},
        {"id": "ledger", "src": "/data/ledger.json", "kind": "ledger",
         "re": "دقت|کارنامه|سیگنال|ledger|accuracy|عملکرد", "t": tri(L("دقت سیگنال‌ها", "وردیی سیگناڵەکان", "Signal accuracy")), "u": "/ledger/"},
        {"id": "silent", "src": "/data/silent_exit.json", "kind": "silent",
         "re": "خروج خاموش|نهنگ|silent|whale", "t": tri(L("خروج خاموش", "چوونەدەرەوەی بێدەنگ", "Silent exit")), "u": "/silent-exit/"},
    ]


def main():
    docs = []
    for name, fn in (("menu", from_menu), ("encyclopedia", from_encyclopedia), ("academy", from_academy), ("posts", from_posts)):
        try:
            got = fn()
            docs += got
            print(f"  {name}: {len(got)}")
        except Exception as ex:  # noqa: BLE001
            print(f"  {name} failed: {ex}")
    try:
        feats = features()
        print(f"  features: {len(feats)}")
    except Exception as ex:  # noqa: BLE001
        print(f"  features failed: {ex}")
        feats = []
    out = {"updated_at": R.iso(R.now()), "admin": TG_ADMIN, "docs": docs, "faq": faq() + feats, "live": live(),
           "syn": KB.SYNONYMS, "bot": KB.BOT}
    R.save("assistant.json", out)
    size = os.path.getsize(os.path.join(R.D, "assistant.json"))
    print(f"assistant index: {len(docs)} docs + {len(out['faq'])} faq ({size // 1024} KB)")


if __name__ == "__main__":
    main()
