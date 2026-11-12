#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
/extension/ — the Entekhab browser extension (Chrome, Edge, Brave, Opera, Firefox): installable packages + page.

The extension's source is chrome-extension/src (Manifest V3). On every site build this script:
  * checks THE LOGO RULE (below) and refuses to package anything that breaks it;
  * builds /extension/entekhab-chrome-<version>.zip and /extension/entekhab-firefox-<version>.xpi;
  * writes /extension/latest.json, which the popup reads to tell users a newer version is out;
  * builds the /extension/ page in Persian, Sorani Kurdish and English (Arabic through assets/ar.js).
When the extension is published in the Chrome Web Store, put its address in STORE_URL for a one-click install button.

⚠️⚠️⚠️ THE LOGO RULE — the site owner's, and repeated by him: THE EXTENSION'S LOGO IS NEVER COVERED. ⚠️⚠️⚠️
Chrome paints any badge text OVER the toolbar icon, so the extension never sets badge text, a badge colour or a
painted icon; the price lives in the icon's tooltip. logo_guard() enforces this and the build STOPS (SystemExit,
which the site build does not swallow) if it is broken: the last good version stays online, and the failed run says
why. tests/test_extension_logo.py additionally renders the popup in every language and checks nothing overlaps the logo.
"""
import datetime as dt
import hashlib
import json
import os
import re
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402

STORE_URL = ""  # e.g. https://chromewebstore.google.com/detail/<id>
SRC = os.path.join(BP.ROOT, "chrome-extension", "src")
OUT = os.path.join(BP.ROOT, "extension")
GECKO_ID = "entekhab@entekhab.net"
e = BP.e


# ------------------------------------------------------------------------------------------------- THE LOGO RULE
def logo_guard(src=None):
    """Every way the extension could cover its own logo, checked in the code. Returns the problems (none = fine)."""
    src = src or SRC
    out = []
    for dp, _, fs in os.walk(src):
        for f in sorted(fs):
            if not f.endswith((".js", ".html", ".css")):
                continue
            path = os.path.join(dp, f)
            rel = os.path.relpath(path, src)
            code = open(path, encoding="utf-8", errors="replace").read()
            if f.endswith((".js", ".css")):
                code = re.sub(r"/\*[\s\S]*?\*/", "", code)          # comments may describe the rule; code may not break it
            if f.endswith(".js"):
                code = re.sub(r"(?m)^\s*//.*$", "", code)
            if f.endswith(".html"):
                code = re.sub(r"<!--[\s\S]*?-->", "", code)
            for m in re.finditer(r"setBadgeText\s*\(", code):
                if not re.match(r"\s*\{\s*text\s*:\s*(''|\"\")\s*\}\s*\)", code[m.end():m.end() + 60]):
                    out.append(f"{rel}: setBadgeText with something to show — Chrome paints it over the logo")
            for bad, what in (("setBadgeBackgroundColor", "a badge colour"), ("setBadgeTextColor", "a badge colour"),
                              ("setIcon", "a repainted toolbar icon"), ("OffscreenCanvas", "a repainted toolbar icon")):
                if bad in code:
                    out.append(f"{rel}: {bad} — {what} covers or replaces the logo")
    html_p = os.path.join(src, "popup.html")
    if os.path.exists(html_p):
        html = re.sub(r"<!--[\s\S]*?-->", "", open(html_p, encoding="utf-8").read())
        if not re.search(r'class="brand"[^>]*>\s*<img id="logo" src="icons/icon\d+\.png"', html):
            out.append('popup.html: the header must open with the logo (<a class="brand"><img id="logo" src="icons/…">)')
    man_p = os.path.join(src, "manifest.json")
    if os.path.exists(man_p):
        man = json.load(open(man_p, encoding="utf-8"))
        for size, rel in {**man.get("icons", {}), **man.get("action", {}).get("default_icon", {})}.items():
            if not os.path.exists(os.path.join(src, rel)):
                out.append(f"manifest.json: the {size}px logo {rel} is missing")
    return out


def enforce_logo_rule():
    problems = logo_guard()
    if problems:
        msg = "THE LOGO RULE is broken — the extension's logo must never be covered: " + " | ".join(problems)
        print(f"::error title=Extension logo rule::{msg}")
        raise SystemExit(msg)   # deliberately not an Exception: the site build stops, the last good version stays online


# ------------------------------------------------------------------------------------------------- packages
def firefox_manifest(man):
    """the same extension for Firefox: no MV3 service worker there, and it wants an add-on id.
    Generated from the Chrome manifest so the two can never drift apart."""
    m = dict(man)
    m["background"] = {"scripts": ["background.js"]}          # Firefox MV3 uses an event page
    m["browser_specific_settings"] = {"gecko": {"id": GECKO_ID, "strict_min_version": "128.0"}}
    m.pop("minimum_chrome_version", None)
    return m


def _zip(path, extra_manifest=None):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for dp, _, fs in os.walk(SRC):
            for f in sorted(fs):
                full = os.path.join(dp, f)
                rel = os.path.relpath(full, SRC)
                if rel == "manifest.json" and extra_manifest is not None:
                    z.writestr(rel, json.dumps(extra_manifest, ensure_ascii=False, indent=2))
                else:
                    z.write(full, rel)
    return os.path.getsize(path)


def _sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def package():
    enforce_logo_rule()
    man = json.load(open(os.path.join(SRC, "manifest.json"), encoding="utf-8"))
    ver = man["version"]
    os.makedirs(OUT, exist_ok=True)
    name = f"entekhab-chrome-{ver}.zip"
    fx = f"entekhab-firefox-{ver}.xpi"
    size = _zip(os.path.join(OUT, name))
    fx_size = _zip(os.path.join(OUT, fx), firefox_manifest(man))
    latest = {"version": ver, "date": dt.date.today().isoformat(),
              "chrome": {"file": f"{BP.SITE}/extension/{name}", "size": size, "sha256": _sha(os.path.join(OUT, name))},
              "firefox": {"file": f"{BP.SITE}/extension/{fx}", "size": fx_size, "sha256": _sha(os.path.join(OUT, fx))}}
    json.dump(latest, open(os.path.join(OUT, "latest.json"), "w", encoding="utf-8"), indent=1)
    return ver, name, size, fx, fx_size, latest


# ------------------------------------------------------------------------------------------------- the page
def L(fa, ckb, en):
    return {"fa": fa, "ckb": ckb, "en": en}


T = {
    "crumb": L("افزونهٔ مرورگر", "پێوەکراوی وێبگەڕ", "Browser extension"),
    "apps": L("اپلیکیشن‌ها", "ئەپەکان", "Apps"),
    "home": L("خانه", "سەرەکی", "Home"),
    "h1": L("افزونهٔ مرورگر انتخاب", "پێوەکراوی وێبگەڕی ئینتیخاب", "The Entekhab browser extension"),
    "lead": L("بازار کریپتو همیشه یک کلیک با شما فاصله دارد: قیمت زنده، ترس و طمع، گزارش روزانه، تحلیل، دانشنامه، ماشین‌حساب، پست‌های Coin_Kurd و هشدار قیمت — بدون باز کردن سایت.",
              "بازاڕی کریپتۆ هەمیشە یەک کلیک لێتەوە دوورە: نرخی زیندوو، ترس و تەماح، ڕاپۆرتی ڕۆژانە، شیکاری، زانستنامە، ژمێرەر، پۆستەکانی Coin_Kurd و ئاگاداریی نرخ — بەبێ کردنەوەی ماڵپەڕ.",
              "The crypto market, one click away: live prices, Fear & Greed, the daily report, analysis, the encyclopedia, calculators, Coin_Kurd posts and price alerts — without opening the site."),
    "chips": L(["رایگان", "بدون تبلیغ", "بدون ردیابی", "کوردی · فارسی · العربية · English"],
               ["بێبەرامبەر", "بێ ڕیکلام", "بێ شوێنکەوتن", "کوردی · فارسی · العربية · English"],
               ["Free", "No ads", "No tracking", "کوردی · فارسی · العربية · English"]),
    "dl_cr": L("دانلود برای کروم، اج، بریو و اپرا", "داگرتن بۆ کرۆم، ئێج، بڕەیڤ و ئۆپێرا", "Download for Chrome, Edge, Brave & Opera"),
    "dl_fx": L("دانلود برای فایرفاکس", "داگرتن بۆ فایەرفۆکس", "Download for Firefox"),
    "src": L("کد منبع", "کۆدی سەرچاوە", "Source code"),
    "ver": L("نسخه", "وەشان", "Version"),
    "kb": L("کیلوبایت", "کیلۆبایت", "KB"),
    "new_h": L("تازه‌های نسخهٔ {v}", "نوێیەکانی وەشانی {v}", "New in {v}"),
    "new": L(["لوگوی انتخاب روی آیکون همیشه کامل و بدون پوشش است؛ قیمت حالا با نگه‌داشتن ماوس روی آیکون نمایش داده می‌شود و هیچ عددی روی لوگو نمی‌نشیند.",
              "چهار زبان به ترتیب کوردی، فارسی، العربية و English — عربی تازه اضافه شد.",
              "خود افزونه خبر می‌دهد وقتی نسخهٔ تازه‌ای منتشر شود.",
              "دسترسی سریع به داستان ساتوشی، نقشهٔ یادگیری، نبرد من و همهٔ اپلیکیشن‌ها؛ عنوان پست‌های کانال به زبان شما."],
             ["لۆگۆی ئینتیخاب لەسەر ئایکۆنەکە هەمیشە تەواو و داپۆشراو نییە؛ نرخ ئێستا بە ڕاگرتنی ماوس لەسەر ئایکۆن دەردەکەوێت و هیچ ژمارەیەک لەسەر لۆگۆ نانیشێت.",
              "چوار زمان بە ڕیزی کوردی، فارسی، العربية و English — عەرەبی تازە زیادکرا.",
              "پێوەکراوەکە خۆی پێت دەڵێت کاتێک وەشانێکی نوێ بڵاو بکرێتەوە.",
              "دەستڕاگەیشتنی خێرا بە چیرۆکی ساتۆشی، نەخشەی فێربوون، شەڕی من و هەموو ئەپەکان؛ ناونیشانی پۆستەکان بە زمانی خۆت."],
             ["The Entekhab logo on the toolbar icon is always whole and uncovered: the price now shows when you hover over the icon, and no number ever sits on the logo.",
              "Four languages, in the order Kurdish, Persian, Arabic, English — Arabic is new.",
              "The extension itself tells you when a newer version is published.",
              "Quick links to Satoshi's story, the learning map, My Battle and all the apps; channel post titles in your language."]),
    "feat_h": L("هرچه در یک کلیک", "هەموو شتێک لە یەک کلیکدا", "Everything in one click"),
    "feats": [
        ("📈", L("قیمت زنده", "نرخی زیندوو", "Live prices"), L("بیش از ۱۰۰ رمزارز با تغییر ۲۴ ساعته و نمودار کوچک", "زیاتر لە ١٠٠ دراو لەگەڵ گۆڕانی ٢٤ کاتژمێر و هێڵکاریی بچووک", "100+ coins with 24h change and sparklines")),
        ("🖱️", L("قیمت در راهنمای آیکون", "نرخ لە ڕێنمایی ئایکۆن", "Price in the icon tooltip"), L("قیمت کوین دلخواه با نگه‌داشتن ماوس روی آیکون؛ لوگو همیشه کامل", "نرخی دراوی دڵخواز بە ڕاگرتنی ماوس لەسەر ئایکۆن؛ لۆگۆ هەمیشە تەواو", "Your coin's price when you hover the icon; the logo always whole")),
        ("🧭", L("گزارش و تحلیل", "ڕاپۆرت و شیکاری", "Report & analysis"), L("گزارش روزانهٔ بازار، تحلیل آن‌چین و واقعیت‌سنج", "ڕاپۆرتی ڕۆژانەی بازاڕ، شیکاریی ئۆنچەین و ڕاستیپێو", "The daily report, on-chain analysis and the reality check")),
        ("🔔", L("هشدار قیمت", "ئاگاداریی نرخ", "Price alerts"), L("وقتی کوین به قیمت شما برسد اعلان می‌گیرید", "کاتێک دراوەکە بگاتە نرخی تۆ ئاگادار دەکرێیتەوە", "A notification when a coin reaches your level")),
        ("🧮", L("ماشین‌حساب معامله", "ژمێرەری مامەڵە", "Trade calculators"), L("حجم پوزیشن، ریسک به بازده، سود و زیان، لیکوئید و کارمزد", "قەبارەی پۆزیشن، مەترسی بۆ قازانج، قازانج و زیان، لیکوید و کرێ", "Position size, risk/reward, P&L, liquidation and fees")),
        ("📚", L("دانشنامه", "زانستنامە", "Encyclopedia"), L("۵۰۶ مدخل بازارهای مالی، همان‌جا در افزونه", "٥٠٦ وشەی بازاڕە داراییەکان، هەر لە پێوەکراوەکەدا", "506 entries on financial markets, right in the popup")),
        ("✈️", L("کانال Coin_Kurd", "کەناڵی Coin_Kurd", "Coin_Kurd channel"), L("آخرین پست‌ها و اعلان پست تازه (اختیاری)", "دوایین پۆستەکان و ئاگاداریی پۆستی نوێ (ئارەزوومەندانە)", "Latest posts, and optional new-post notifications")),
        ("⌨️", L("جست‌وجو از نوار آدرس", "گەڕان لە شریتی ناونیشان", "Address-bar search"), L("بنویسید ek و فاصله، سپس btc یا satoshi یا map", "بنووسە ek و بۆشایی، پاشان btc یان satoshi یان map", "Type ek, a space, then btc, satoshi or map")),
    ],
    "inst_h": L("نصب در کروم، اج، بریو و اپرا", "دامەزراندن لە کرۆم، ئێج، بڕەیڤ و ئۆپێرا", "Install in Chrome, Edge, Brave & Opera"),
    "inst": L(["فایل zip را دانلود کنید و در یک پوشهٔ ثابت از حالت فشرده خارج کنید (این پوشه را پاک نکنید).",
               "در نوار آدرس بنویسید <code dir=\"ltr\">chrome://extensions</code> (در اج: <code dir=\"ltr\">edge://extensions</code>) و Enter بزنید.",
               "گزینهٔ <b>Developer mode</b> را روشن کنید.",
               "روی <b>Load unpacked</b> بزنید و همان پوشه را انتخاب کنید.",
               "از منوی پازل 🧩 آیکون انتخاب را سنجاق (Pin) کنید؛ با نگه‌داشتن ماوس روی آن قیمت را می‌بینید."],
              ["فایلی zip دابگرە و لە بوخچەیەکی جێگیردا بیکەرەوە (ئەم بوخچەیە مەسڕەوە).",
               "لە شریتی ناونیشان بنووسە <code dir=\"ltr\">chrome://extensions</code> (لە ئێج: <code dir=\"ltr\">edge://extensions</code>) و Enter دابگرە.",
               "<b>Developer mode</b> هەڵبکە.",
               "<b>Load unpacked</b> دابگرە و هەمان بوخچە هەڵبژێرە.",
               "لە لیستی 🧩 ئایکۆنی ئینتیخاب بچەسپێنە (Pin)؛ بە ڕاگرتنی ماوس لەسەری نرخەکە دەبینیت."],
              ["Download the zip and extract it into a folder you keep (do not delete that folder).",
               "Type <code dir=\"ltr\">chrome://extensions</code> in the address bar (Edge: <code dir=\"ltr\">edge://extensions</code>) and press Enter.",
               "Turn on <b>Developer mode</b>.",
               "Click <b>Load unpacked</b> and choose that folder.",
               "Pin the Entekhab icon from the 🧩 puzzle menu; hover over it to see the price."]),
    "fx_h": L("نصب در فایرفاکس", "دامەزراندن لە فایەرفۆکس", "Install in Firefox"),
    "fx": L(["فایل xpi را دانلود کنید.",
             "بنویسید <code dir=\"ltr\">about:debugging#/runtime/this-firefox</code> و روی <b>Load Temporary Add-on…</b> بزنید و همان فایل را انتخاب کنید.",
             "فایرفاکس افزونهٔ امضانشده را فقط تا بستن مرورگر نگه می‌دارد؛ نسخهٔ امضاشده پس از تأیید Mozilla منتشر می‌شود."],
            ["فایلی xpi دابگرە.",
             "بنووسە <code dir=\"ltr\">about:debugging#/runtime/this-firefox</code> و <b>Load Temporary Add-on…</b> دابگرە و هەمان فایل هەڵبژێرە.",
             "فایەرفۆکس پێوەکراوی واژۆنەکراو تەنها تا داخستنی وێبگەڕ دەهێڵێتەوە؛ وەشانی واژۆکراو دوای پەسەندی Mozilla بڵاو دەکرێتەوە."],
            ["Download the xpi file.",
             "Open <code dir=\"ltr\">about:debugging#/runtime/this-firefox</code>, click <b>Load Temporary Add-on…</b> and choose the file.",
             "Firefox keeps an unsigned add-on only until it closes; a signed version follows Mozilla's review."]),
    "up_h": L("به‌روزرسانی از نسخهٔ قبلی", "نوێکردنەوە لە وەشانی پێشوو", "Updating from an older version"),
    "up": L("zip تازه را دانلود کنید، محتوای آن را جایگزین محتوای همان پوشهٔ قبلی کنید و در صفحهٔ extensions روی دکمهٔ ⟳ (Reload) افزونه بزنید. تنظیمات و هشدارهای شما سر جایشان می‌مانند.",
            "zipی نوێ دابگرە، ناوەڕۆکەکەی بخەرە جێی ناوەڕۆکی هەمان بوخچەی پێشوو و لە پەڕەی extensions دوگمەی ⟳ (Reload)ی پێوەکراوەکە دابگرە. ڕێکخستن و ئاگادارییەکانت دەمێننەوە.",
            "Download the new zip, replace the contents of your existing folder with it, and press the extension's ⟳ (Reload) button on the extensions page. Your settings and alerts stay."),
    "perm_h": L("دسترسی‌ها و حریم خصوصی", "دەسەڵاتەکان و تایبەتمەندی", "Permissions & privacy"),
    "perms": [("storage", L("ذخیرهٔ تنظیمات، هشدارها و آخرین داده‌ها فقط روی همین مرورگر", "هەڵگرتنی ڕێکخستن، ئاگاداری و دوایین داتا تەنها لەم وێبگەڕەدا", "Settings, alerts and the latest data, kept in this browser only")),
              ("alarms", L("به‌روزرسانی خودکار هر ۵ دقیقه", "نوێکردنەوەی خۆکار هەر ٥ خولەک", "Refreshes every 5 minutes")),
              ("notifications", L("هشدار قیمت و پست تازه", "ئاگاداریی نرخ و پۆستی نوێ", "Price alerts and new posts")),
              ("entekhab.net · data-api.binance.vision", L("فقط داده‌های عمومی بازار؛ هیچ صفحه‌ای از سایت‌های دیگر خوانده نمی‌شود", "تەنها داتای گشتیی بازاڕ؛ هیچ پەڕەیەکی ماڵپەڕی تر ناخوێندرێتەوە", "Public market data only; no other site's pages are read"))],
    "priv": L("افزونه هیچ اطلاعات شخصی، تاریخچهٔ مرور یا داده‌ای از صفحه‌های دیگر جمع نمی‌کند و چیزی به سرور ما نمی‌فرستد.",
              "پێوەکراوەکە هیچ زانیارییەکی کەسی، مێژووی گەڕان یان داتای پەڕەکانی تر کۆ ناکاتەوە و هیچ شتێک بۆ ڕاژەکارەکەمان نانێرێت.",
              "The extension collects no personal data, browsing history or data from other pages, and sends nothing to our servers."),
    "nfa": L("اطلاعات آموزشی است، توصیهٔ مالی نیست.", "زانیاریی فێرکارییە، ئامۆژگاریی دارایی نییە.", "Educational, not financial advice."),
    "privacy": L("حریم خصوصی", "تایبەتمەندی", "Privacy"),
    "store_soon": L("نسخهٔ فروشگاه کروم به‌زودی؛ تا آن زمان بستهٔ رسمی همین صفحه را نصب کنید.", "وەشانی فرۆشگای کرۆم بەم زووانە؛ تا ئەوکات پاکێجی فەرمیی ئەم پەڕەیە دابمەزرێنە.", "A Chrome Web Store listing is coming; until then install the official package from this page."),
    "sha": L("اثر انگشت SHA-256", "پەنجەمۆری SHA-256", "SHA-256 fingerprint"),
    "alt": L("پنجرهٔ افزونهٔ انتخاب", "پەنجەرەی پێوەکراوی ئینتیخاب", "The Entekhab extension popup"),
}

CSS = """
.xp{--g:linear-gradient(135deg,#ffcf7a,#f7931a 55%,#c2410c)}
.xp-hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:34px;align-items:center;margin:8px 0 34px;padding:30px;border:1px solid var(--line);border-radius:28px;
  background:radial-gradient(120% 90% at 100% 0%,rgba(247,147,26,.16),transparent 55%),linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.01));overflow:hidden}
.xp h1{font-size:clamp(1.7rem,3.4vw,2.5rem);line-height:1.35;margin:6px 0 10px}
.xp .lead{font-size:1.02rem;line-height:2;color:rgba(255,255,255,.82);margin:0 0 14px}
.xp-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px;padding:0;list-style:none}
.xp-chips li{padding:4px 12px;border-radius:99px;border:1px solid var(--line);font-size:.8rem;color:rgba(255,255,255,.75);background:rgba(255,255,255,.03)}
.xp-dl{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 10px}
.xp-b{display:inline-flex;align-items:center;gap:10px;padding:12px 18px;border-radius:16px;font-weight:800;text-decoration:none;border:1px solid var(--line);color:#fff;background:rgba(255,255,255,.04);transition:transform .15s,border-color .15s}
.xp-b:hover{transform:translateY(-2px);border-color:rgba(247,147,26,.6)}
.xp-b.p{background:var(--g);color:#111;border:0;box-shadow:0 12px 30px rgba(247,147,26,.28)}
.xp-b small{display:block;font-weight:500;font-size:.72rem;opacity:.8}
.xp-b i{font-style:normal;font-size:1.3rem}
.xp-meta{font-size:.8rem;color:rgba(255,255,255,.55);margin:6px 0 0}
.xp-shot{position:relative;justify-self:center;width:min(100%,340px)}
.xp-shot img{display:block;width:100%;height:auto;border-radius:22px;border:1px solid rgba(247,147,26,.35);box-shadow:0 30px 70px rgba(0,0,0,.55),0 0 0 7px rgba(255,255,255,.03)}
.xp-new{margin:0 0 34px;padding:22px 24px;border-radius:22px;border:1px solid rgba(247,147,26,.4);background:rgba(247,147,26,.06)}
.xp-new h2{margin:0 0 10px;font-size:1.15rem}.xp-new ul{margin:0;padding-inline-start:20px;line-height:2}
.xp h2.xp-h{font-size:1.35rem;margin:0 0 14px}
.xp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:0 0 34px}
.xp-f{padding:16px 18px;border-radius:18px;border:1px solid var(--line);background:var(--card,rgba(255,255,255,.03))}
.xp-f i{font-style:normal;font-size:1.5rem}.xp-f b{display:block;margin:6px 0 2px}.xp-f p{margin:0;font-size:.88rem;line-height:1.8;color:rgba(255,255,255,.7)}
.xp-steps{counter-reset:s;list-style:none;margin:0 0 30px;padding:0;display:grid;gap:10px}
.xp-steps li{counter-increment:s;position:relative;padding:12px 16px;padding-inline-start:54px;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.025);line-height:1.9}
.xp-steps li::before{content:counter(s);position:absolute;inset-inline-start:14px;top:12px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:900;color:#111;background:var(--g)}
.xp code{background:rgba(255,255,255,.07);border-radius:6px;padding:1px 6px}
.xp-perm{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:8px}
.xp-perm li{padding:10px 14px;border-radius:14px;border:1px solid var(--line)}.xp-perm b{color:var(--acc,#f7931a);direction:ltr;unicode-bidi:isolate}
.xp-sha{font-size:.72rem;color:rgba(255,255,255,.5);word-break:break-all;direction:ltr;unicode-bidi:isolate}
@media (max-width:820px){.xp-hero{grid-template-columns:1fr;padding:22px;gap:22px}.xp-shot{width:min(100%,260px)}}
"""


def build():
    ver, name, size, fx, fx_size, latest = package()
    shots = {lg: f"/chrome-extension/store/popup-{lg}.webp" for lg in ("fa", "ckb", "en")
             if os.path.exists(os.path.join(BP.ROOT, "chrome-extension", "store", f"popup-{lg}.webp"))}

    def block(lg):
        t = lambda k: T[k][lg]  # noqa: E731
        chips = "".join(f"<li>{e(x)}</li>" for x in t("chips"))
        shot = (f'<div class="xp-shot"><img src="{shots[lg]}" alt="{e(t("alt"))}" width="380" height="590" loading="eager" decoding="async"></div>'
                if lg in shots else "")
        store = (f'<a class="xp-b" href="{e(STORE_URL)}" rel="noopener" target="_blank"><i>🛒</i>Chrome Web Store</a>' if STORE_URL else "")
        feats = "".join(f'<div class="xp-f"><i>{ic}</i><b>{e(a[lg])}</b><p>{e(b[lg])}</p></div>' for ic, a, b in T["feats"])
        new = "".join(f"<li>{e(x)}</li>" for x in t("new"))
        inst = "".join(f"<li>{x}</li>" for x in t("inst"))
        fxs = "".join(f"<li>{x}</li>" for x in t("fx"))
        perms = "".join(f"<li><b>{e(a)}</b> — {e(b[lg])}</li>" for a, b in T["perms"])
        return (f'<div class="xp"><div class="meta"><a href="/">{e(t("home"))}</a> / <a href="/app/">{e(t("apps"))}</a> / {e(t("crumb"))}</div>'
                f'<section class="xp-hero"><div><h1>🧩 {e(t("h1"))}</h1><p class="lead">{e(t("lead"))}</p><ul class="xp-chips">{chips}</ul>'
                f'<div class="xp-dl"><a class="xp-b p" href="/extension/{name}" download><i>⬇</i><span>{e(t("dl_cr"))}<small><bdi>ZIP</bdi> · {size // 1024} {e(t("kb"))}</small></span></a>'
                f'<a class="xp-b" href="/extension/{fx}" download><i>🦊</i><span>{e(t("dl_fx"))}<small><bdi>XPI</bdi> · {fx_size // 1024} {e(t("kb"))}</small></span></a>{store}</div>'
                f'<p class="xp-meta">{e(t("ver"))} {e(ver)} · <a href="https://github.com/omidmokri/coinkurd/tree/main/chrome-extension/src" rel="noopener" target="_blank">{e(t("src"))}</a>'
                f'{"" if STORE_URL else " · " + e(t("store_soon"))}</p></div>{shot}</section>'
                f'<section class="xp-new"><h2>✨ {e(t("new_h").format(v=ver))}</h2><ul>{new}</ul></section>'
                f'<h2 class="xp-h">{e(t("feat_h"))}</h2><div class="xp-grid">{feats}</div>'
                f'<h2 class="xp-h">{e(t("inst_h"))}</h2><ol class="xp-steps">{inst}</ol>'
                f'<h2 class="xp-h">🦊 {e(t("fx_h"))}</h2><ol class="xp-steps">{fxs}</ol>'
                f'<h2 class="xp-h">⟳ {e(t("up_h"))}</h2><p class="txt">{e(t("up"))}</p>'
                f'<h2 class="xp-h">🔒 {e(t("perm_h"))}</h2><ul class="xp-perm">{perms}</ul>'
                f'<p class="note">{e(t("priv"))} <a href="/privacy/">{e(t("privacy"))}</a> · {e(t("nfa"))}</p>'
                f'<p class="xp-sha">{e(t("sha"))} · {name}: {latest["chrome"]["sha256"]}<br>{fx}: {latest["firefox"]["sha256"]}</p></div>')

    import build_reality as BR
    body = BR.tri(block) + f"<script>{BR.LANG_JS}</script>"
    ld = {"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Entekhab — browser extension", "applicationCategory": "BrowserApplication",
          "operatingSystem": "Chrome, Edge, Brave, Opera, Firefox", "softwareVersion": ver, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
          "downloadUrl": f"{BP.SITE}/extension/{name}", "inLanguage": ["ckb", "fa", "ar", "en"]}
    og = f"<meta property='og:image' content='{BP.SITE}/chrome-extension/store/market.png'>" if os.path.exists(os.path.join(BP.ROOT, "chrome-extension", "store", "market.png")) else ""
    url = BP.page("extension/", "افزونهٔ مرورگر انتخاب — قیمت کریپتو، گزارش بازار و هشدار قیمت برای کروم، اج و فایرفاکس",
                  "افزونهٔ رایگان entekhab.net برای کروم، اج، بریو، اپرا و فایرفاکس: قیمت زندهٔ رمزارزها، ترس و طمع، گزارش روزانهٔ بازار، پست‌های Coin_Kurd و هشدار قیمت",
                  body, f"<style>{CSS}</style>{og}<script type=\"application/ld+json\">{BP.sj(ld)}</script>")
    print(f"extension page: {name} ({size} bytes), {fx} ({fx_size} bytes)")
    return [url]


if __name__ == "__main__":
    build()
