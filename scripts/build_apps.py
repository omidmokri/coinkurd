#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
/app/ — every way to have Entekhab: Android, iPhone & iPad, Windows (64-bit), the browser extension, the Telegram bot
and the trading bot, on one page in Persian, Sorani Kurdish and English (Arabic through assets/ar.js).

Nothing here is invented: versions, sizes and SHA-256 fingerprints come from the files that publish each app
(app/app.json, app/windows.json — written by the Windows CI after its install-and-run test — extension/latest.json,
trade-bot/strategies.json). A platform whose file is not published yet shows "coming soon" instead of a number.
The visitor's own device is detected in the page and its download comes first.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402

ROOT = BP.ROOT
e = BP.e


def L(fa, ckb, en):
    return {"fa": fa, "ckb": ckb, "en": en}


def _json(path):
    p = os.path.join(ROOT, path)
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


_FA = str.maketrans("0123456789.,", "۰۱۲۳۴۵۶۷۸۹٫٬")
_CKB = str.maketrans("0123456789.,", "٠١٢٣٤٥٦٧٨٩٫٬")


def dg(s, lg):
    s = str(s)
    return s.translate(_FA) if lg == "fa" else s.translate(_CKB) if lg == "ckb" else s


def dv(v, lg):
    """a version number: local digits, but the dots stay dots (۱.۶.۰, not ۱٫۶٫۰)"""
    return dg(str(v).replace(".", "\u0000"), lg).replace("\u0000", ".")


def parts(*xs):
    return " · ".join(f"<bdi>{x}</bdi>" for x in xs if x)


def size(n, lg):
    if not n:
        return ""
    kb = n / 1024
    if kb >= 1000:
        v, u = f"{kb / 1024:.1f}", L("مگابایت", "مێگابایت", "MB")[lg]
    else:
        v, u = f"{round(kb)}", L("کیلوبایت", "کیلۆبایت", "KB")[lg]
    return f"{dg(v, lg)} {u}"


# ----------------------------------------------------------------------------------------------------- icons
SV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{}</svg>'
IC = {
    "android": '<i class="ek-si b-android" aria-hidden="true"></i>',
    "iphone": SV.format('<rect x="6.5" y="2" width="11" height="20" rx="2.8"/><path d="M10.5 4.6h3"/><path d="M11 19h2"/>'),
    "windows": SV.format('<rect x="2.5" y="4" width="19" height="13" rx="1.8"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M2.5 7.5h19"/>'),
    "extension": SV.format('<path d="M9 3h4a1 1 0 0 1 1 1v1.5a1.5 1.5 0 1 0 3 0V4a1 1 0 0 1 1-1h1a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1h-1.5a1.5 1.5 0 1 0 0 3H20a1 1 0 0 1 1 1v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a1 1 0 0 1 1-1h1.5a1.5 1.5 0 1 0 0-3H4a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2z"/>'),
    "telegram": '<i class="ek-si b-telegram" aria-hidden="true"></i>',
    "tradebot": SV.format('<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4"/><circle cx="12" cy="3.2" r="1"/><circle cx="9" cy="13.5" r="1.3"/><circle cx="15" cy="13.5" r="1.3"/><path d="M9.5 17h5"/><path d="M2 13v3M22 13v3"/>'),
    "check": SV.format('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    "shield": SV.format('<path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>'),
    "down": SV.format('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>'),
}

# ----------------------------------------------------------------------------------------------------- words
T = {
    "crumb": L("اپلیکیشن‌ها", "ئەپەکان", "Apps"),
    "home": L("خانه", "سەرەکی", "Home"),
    "kick": L("اپلیکیشن‌های انتخاب", "ئەپەکانی ئینتیخاب", "The Entekhab apps"),
    "h1": L("انتخاب، روی هر صفحه‌ای که دارید", "ئینتیخاب، لەسەر هەر شاشەیەک کە هەتە", "Entekhab, on every screen you own"),
    "lead": L("اندروید، آیفون، ویندوز، مرورگر و تلگرام — همه رایگان، بدون تبلیغ و بدون ردیابی، به کوردی، فارسی، عربی و انگلیسی.",
              "ئەندرۆید، ئایفۆن، ویندۆز، وێبگەڕ و تێلێگرام — هەمووی بێبەرامبەر، بێ ڕیکلام و بێ شوێنکەوتن، بە کوردی، فارسی، عەرەبی و ئینگلیزی.",
              "Android, iPhone, Windows, your browser and Telegram — all free, with no ads and no tracking, in Kurdish, Persian, Arabic and English."),
    "trust": L(["رایگان", "بدون تبلیغ", "بدون ردیابی", "کد منبع باز"], ["بێبەرامبەر", "بێ ڕیکلام", "بێ شوێنکەوتن", "کۆدی سەرچاوەی کراوە"],
               ["Free", "No ads", "No tracking", "Open source"]),
    "all": L("همهٔ نسخه‌ها", "هەموو وەشانەکان", "All versions"),
    "pwa": L("نصب نسخهٔ وب روی همین رایانه", "دامەزراندنی وەشانی وێب لەسەر ئەم کۆمپیوتەرە", "Install the web app on this computer"),
    "smart_android": L("دانلود برای اندروید", "داگرتن بۆ ئەندرۆید", "Download for Android"),
    "smart_iphone": L("نصب روی آیفون و آیپد", "دامەزراندن لەسەر ئایفۆن و ئایپاد", "Install on iPhone & iPad"),
    "smart_windows": L("دانلود برای ویندوز ۶۴ بیتی", "داگرتن بۆ ویندۆزی ٦٤ بیت", "Download for Windows (64-bit)"),
    "smart_iphone_s": L("بدون دانلود · با چند لمس در سافاری", "بێ داگرتن · بە چەند دەستلێدانێک لە سافاری", "No download · a few taps in Safari"),
    "yours": L("مناسب دستگاه شما", "گونجاو بۆ ئامێرەکەت", "For your device"),
    "soon": L("به‌زودی", "بەم زووانە", "Coming soon"),
    "guide": L("راهنما", "ڕێنمایی", "Guide"),
    "ver": L("نسخهٔ", "وەشانی", "v"),
    "plat_h": L("یکی را انتخاب کنید", "یەکێک هەڵبژێرە", "Pick yours"),
    "qr": L("روی گوشی باز کنید: این کد را با دوربین گوشی اسکن کنید.", "لەسەر مۆبایل بیکەرەوە: ئەم کۆدە بە کامێرای مۆبایل سکان بکە.", "Open it on your phone: scan this code with the phone's camera."),
    "sha": L("اثر انگشت SHA-256", "پەنجەمۆری SHA-256", "SHA-256 fingerprint"),
    "sha_why": L("هر فایل اثر انگشت دارد تا مطمئن شوید همان فایل اصلی انتخاب است.", "هەر فایلێک پەنجەمۆری هەیە تا دڵنیا بیت هەمان فایلی ڕەسەنی ئینتیخابە.", "Every file has a fingerprint, so you can check it is the original."),
    "src": L("کد منبع", "کۆدی سەرچاوە", "Source code"),
    "nfa": L("اطلاعات آموزشی است، توصیهٔ مالی نیست.", "زانیاریی فێرکارییە، ئامۆژگاریی دارایی نییە.", "Educational, not financial advice."),
}

CARDS = {
    "android": (L("اندروید", "ئەندرۆید", "Android"),
                L("اپ سبک و امن با همهٔ بخش‌های سایت؛ بدون نیاز به گوگل‌پلی.", "ئەپێکی سووک و سەلامەت بە هەموو بەشەکانی ماڵپەڕ؛ بێ پێویستی بە گووگڵ پلەی.", "A light, locked-down app with every part of the site; no Google Play needed."),
                L("دانلود APK", "داگرتنی APK", "Download APK")),
    "iphone": (L("آیفون و آیپد", "ئایفۆن و ئایپاد", "iPhone & iPad"),
               L("از خود سافاری نصب می‌شود: تمام‌صفحه، با آیکون خودش و همیشه به‌روز.", "لە خودی سافارییەوە دادەمەزرێت: پڕشاشە، بە ئایکۆنی خۆی و هەمیشە نوێ.", "Installs straight from Safari: full screen, its own icon, always up to date."),
               L("راهنمای نصب", "ڕێنمایی دامەزراندن", "How to install")),
    "windows": (L("ویندوز", "ویندۆز", "Windows"),
                L("برنامهٔ دسکتاپ ۶۴ بیتی، با قیمت زندهٔ بیت‌کوین روی آیکون سینی ویندوز.", "بەرنامەی دێسکتۆپی ٦٤ بیت، بە نرخی زیندووی بیتکۆین لەسەر ئایکۆنی سینیی ویندۆز.", "A 64-bit desktop app, with the live bitcoin price on its tray icon."),
                L("دانلود نصب‌کننده", "داگرتنی دامەزرێنەر", "Download installer")),
    "extension": (L("افزونهٔ مرورگر", "پێوەکراوی وێبگەڕ", "Browser extension"),
                  L("قیمت‌ها، گزارش، دانشنامه و هشدار قیمت در یک کلیک؛ کروم، اج، بریو، اپرا و فایرفاکس.", "نرخ، ڕاپۆرت، زانستنامە و ئاگاداریی نرخ لە یەک کلیکدا؛ کرۆم، ئێج، بڕەیڤ، ئۆپێرا و فایەرفۆکس.", "Prices, the report, the encyclopedia and price alerts in one click; Chrome, Edge, Brave, Opera and Firefox."),
                  L("دریافت افزونه", "وەرگرتنی پێوەکراو", "Get the extension")),
    "telegram": (L("ربات تلگرام", "بۆتی تێلێگرام", "Telegram bot"),
                 L("قیمت دلار و تتر، هشدار قیمت، گزارش روزانه و آموزش — داخل خود تلگرام.", "نرخی دۆلار و تەتەر، ئاگاداریی نرخ، ڕاپۆرتی ڕۆژانە و فێرکاری — لە ناو تێلێگرامدا.", "Dollar and tether rates, price alerts, the daily report and lessons — inside Telegram."),
                 L("باز کردن در تلگرام", "کردنەوە لە تێلێگرام", "Open in Telegram")),
    "tradebot": (L("ربات معامله‌گر", "بۆتی بازرگانی", "Trading bot"),
                 L("توزیع فارسی Freqtrade برای سرور خودتان، با {n} استراتژی متن‌باز.", "دابەشکراوی فارسیی Freqtrade بۆ ڕاژەکاری خۆت، بە {n} ستراتیژیی کۆد-کراوە.", "A Persian Freqtrade distribution for your own server, with {n} open-source strategies."),
                 L("مشاهده", "بینین", "See it")),
}

SEC = {
    "android": {
        "h": L("اندروید — نصب مستقیم و امن", "ئەندرۆید — دامەزراندنی ڕاستەوخۆ و سەلامەت", "Android — direct and safe"),
        "steps": L(["فایل APK را دانلود کنید ({size}).", "فایل را باز کنید. اگر گوشی اجازه خواست، برای مرورگر یا مدیر فایل «نصب از منابع ناشناس» را روشن کنید.", "«نصب» را بزنید و انتخاب را از صفحهٔ اصلی گوشی باز کنید."],
                   ["فایلی APK دابگرە ({size}).", "فایلەکە بکەرەوە. ئەگەر مۆبایلەکە مۆڵەتی خواست، بۆ وێبگەڕ یان بەڕێوەبەری فایل «دامەزراندن لە سەرچاوەی نەناسراو» هەڵبکە.", "«دامەزراندن» دابگرە و ئینتیخاب لە شاشەی سەرەکی بکەرەوە."],
                   ["Download the APK ({size}).", "Open it. If the phone asks, allow “install unknown apps” for your browser or file manager.", "Tap “Install” and open Entekhab from your home screen."]),
        "pts": L(["فقط entekhab.net داخل اپ باز می‌شود؛ تلگرام، یوتیوب و سایت‌های دیگر در اپ یا مرورگر خودشان.", "تنها دسترسی: اینترنت — بدون موقعیت، دوربین، میکروفون یا مخاطبین.", "وقتی نسخهٔ تازه منتشر شود، خود اپ خبر می‌دهد."],
                 ["تەنها entekhab.net لە ناو ئەپەکەدا دەکرێتەوە؛ تێلێگرام، یوتیوب و ماڵپەڕەکانی تر لە ئەپ یان وێبگەڕی خۆیاندا.", "تاکە دەسەڵات: ئینتەرنێت — بێ شوێن، کامێرا، مایکرۆفۆن یان ناوەکان.", "کاتێک وەشانێکی نوێ بڵاو بکرێتەوە، ئەپەکە خۆی ئاگادارت دەکاتەوە."],
                 ["Only entekhab.net opens inside the app; Telegram, YouTube and other sites open in their own app or browser.", "One permission only: the internet — no location, camera, microphone or contacts.", "The app tells you itself when a newer version is published."]),
    },
    "iphone": {
        "h": L("آیفون و آیپد — نصب از سافاری", "ئایفۆن و ئایپاد — دامەزراندن لە سافارییەوە", "iPhone & iPad — install from Safari"),
        "why": L("اپ‌استور برای ایران در دسترس نیست و اپل نصب برنامه از بیرون آن را اجازه نمی‌دهد. برای همین انتخاب روی آیفون به‌شکل «وب‌اپ» نصب می‌شود: تمام‌صفحه، با آیکون خودش در صفحهٔ اصلی، بدون نوار مرورگر و همیشه با تازه‌ترین نسخه — بدون Apple ID و بدون هیچ دانلودی.",
                 "ئەپ ستۆر بۆ ئێران بەردەست نییە و ئەپڵ ڕێگە بە دامەزراندنی بەرنامە لە دەرەوەی ئەو نادات. بۆیە ئینتیخاب لەسەر ئایفۆن وەک «وێب-ئەپ» دادەمەزرێت: پڕشاشە، بە ئایکۆنی خۆی لە شاشەی سەرەکی، بێ شریتی وێبگەڕ و هەمیشە نوێترین وەشان — بێ Apple ID و بێ هیچ داگرتنێک.",
                 "The App Store is not available for Iran, and Apple allows no apps from outside it. So on iPhone, Entekhab installs as a web app: full screen, with its own icon on the home screen, no browser bar, and always the newest version — no Apple ID and nothing to download."),
        "steps": L(["entekhab.net را در <b>سافاری</b> باز کنید.",
                    "دکمهٔ <b>•••</b> کنار نوار آدرس را بزنید و <b>Share</b> را انتخاب کنید. (در iOS 18 و قدیمی‌تر، دکمهٔ Share — مربع با فلش رو به بالا — در نوار ابزار است.)",
                    "پایین بروید و <b>Add to Home Screen</b> (افزودن به صفحهٔ اصلی) را بزنید.",
                    "<b>Open as Web App</b> روشن بماند؛ <b>Add</b> را بزنید. آیکون انتخاب در صفحهٔ اصلی است."],
                   ["entekhab.net لە <b>سافاری</b> بکەرەوە.",
                    "دوگمەی <b>•••</b> لە تەنیشت شریتی ناونیشان دابگرە و <b>Share</b> هەڵبژێرە. (لە iOS 18 و کۆنتر، دوگمەی Share — چوارگۆشە بە تیرێکی بەرەو سەر — لە شریتی ئامرازدایە.)",
                    "بڕۆ خوارەوە و <b>Add to Home Screen</b> دابگرە.",
                    "<b>Open as Web App</b> هەڵکراو بهێڵە؛ <b>Add</b> دابگرە. ئایکۆنی ئینتیخاب لە شاشەی سەرەکییە."],
                   ["Open entekhab.net in <b>Safari</b>.",
                    "Tap <b>•••</b> beside the address bar and choose <b>Share</b>. (On iOS 18 and earlier, the Share button — a square with an up arrow — is in the toolbar.)",
                    "Scroll down and tap <b>Add to Home Screen</b>.",
                    "Leave <b>Open as Web App</b> on and tap <b>Add</b>. Entekhab is on your home screen."]),
        "pts": L(["همیشه به‌روز: هر بار که باز می‌کنید، تازه‌ترین نسخهٔ سایت است.", "در کروم آیفون هم از منوی Share همین گزینه هست؛ تجربهٔ تمام‌صفحه با سافاری بهتر است.", "برای حذف: آیکون را نگه دارید و Remove App را بزنید."],
                 ["هەمیشە نوێ: هەر جارێک بیکەیتەوە، نوێترین وەشانی ماڵپەڕە.", "لە کرۆمی ئایفۆنیش لە لیستی Share هەمان بژاردە هەیە؛ ئەزموونی پڕشاشە لەگەڵ سافاری باشترە.", "بۆ سڕینەوە: ئایکۆنەکە ڕابگرە و Remove App دابگرە."],
                 ["Always current: every time you open it, it is the newest version of the site.", "Chrome on iPhone has the same option in its Share menu; the full-screen experience is best with Safari.", "To remove it: hold the icon and tap Remove App."]),
    },
    "windows": {
        "h": L("ویندوز — برنامهٔ دسکتاپ ۶۴ بیتی", "ویندۆز — بەرنامەی دێسکتۆپی ٦٤ بیت", "Windows — the 64-bit desktop app"),
        "steps": L(["نصب‌کننده را دانلود کنید ({size}).",
                    "اجرایش کنید. چون فایل امضای تجاری ندارد، ویندوز ممکن است بگوید «Windows protected your PC»؛ روی <b>More info</b> و بعد <b>Run anyway</b> بزنید.",
                    "زبان نصب‌کننده را انتخاب کنید (فارسی، عربی یا انگلیسی) و «نصب» را بزنید — به دسترسی مدیر نیاز ندارد.",
                    "انتخاب را از منوی استارت یا میز کار باز کنید."],
                   ["دامەزرێنەرەکە دابگرە ({size}).",
                    "کاری پێبکە. لەبەر ئەوەی فایلەکە واژووی بازرگانیی نییە، لەوانەیە ویندۆز بڵێت «Windows protected your PC»؛ <b>More info</b> و پاشان <b>Run anyway</b> دابگرە.",
                    "زمانی دامەزرێنەر هەڵبژێرە (فارسی، عەرەبی یان ئینگلیزی) و «دامەزراندن» دابگرە — پێویستی بە دەسەڵاتی بەڕێوەبەر نییە.",
                    "ئینتیخاب لە لیستی ستارت یان مێزی کار بکەرەوە."],
                   ["Download the installer ({size}).",
                    "Run it. The file has no commercial signature, so Windows may say “Windows protected your PC”: click <b>More info</b>, then <b>Run anyway</b>.",
                    "Pick the installer's language (Persian, Arabic or English) and install — no administrator rights needed.",
                    "Open Entekhab from the Start menu or the desktop."]),
        "pts": L(["قیمت زندهٔ بیت‌کوین روی آیکون سینی ویندوز (با نگه‌داشتن ماوس).", "فقط entekhab.net داخل برنامه باز می‌شود؛ تلگرام و سایت‌های دیگر در مرورگر خودتان.", "تنظیمات، هشدارها و پیشرفت شما روی همین رایانه می‌ماند و با به‌روزرسانی پاک نمی‌شود.", "نسخهٔ تازه که بیاید، خود برنامه خبر می‌دهد. حذف: Settings ← Apps."],
                 ["نرخی زیندووی بیتکۆین لەسەر ئایکۆنی سینیی ویندۆز (بە ڕاگرتنی ماوس).", "تەنها entekhab.net لە ناو بەرنامەکەدا دەکرێتەوە؛ تێلێگرام و ماڵپەڕەکانی تر لە وێبگەڕی خۆتدا.", "ڕێکخستن، ئاگاداری و پێشکەوتنت لەسەر ئەم کۆمپیوتەرە دەمێنێتەوە و بە نوێکردنەوە ناسڕێتەوە.", "کاتێک وەشانێکی نوێ بێت، بەرنامەکە خۆی ئاگادارت دەکاتەوە. سڕینەوە: Settings ← Apps."],
                 ["The live bitcoin price on the tray icon (hover over it).", "Only entekhab.net opens inside the app; Telegram and other sites open in your own browser.", "Your settings, alerts and progress stay on this computer and survive updates.", "The app tells you when a newer version is out. To remove it: Settings → Apps."]),
        "req": L("ویندوز ۱۰ (نسخهٔ 1903 به بعد) یا ۱۱، ۶۴ بیتی. موتور نمایش Microsoft Edge WebView2 است که در ویندوز ۱۱ هست و در ویندوز ۱۰ همراه Edge نصب می‌شود.",
                 "ویندۆز ١٠ (وەشانی 1903 بەدواوە) یان ١١، ٦٤ بیت. بزوێنەری پیشاندان Microsoft Edge WebView2ـە کە لە ویندۆز ١١دا هەیە و لە ویندۆز ١٠ لەگەڵ Edge دادەمەزرێت.",
                 "Windows 10 (1903 or later) or 11, 64-bit. Pages are drawn by Microsoft Edge WebView2, which is part of Windows 11 and comes with Edge on Windows 10."),
        "tested": L("هر نسخه پیش از انتشار روی یک ویندوز واقعی ساخته، نصب، اجرا و حذف می‌شود.", "هەر وەشانێک پێش بڵاوبوونەوە لەسەر ویندۆزێکی ڕاستەقینە دروست، دامەزراندن، کارپێکردن و سڕینەوەی بۆ دەکرێت.", "Every version is built, installed, run and uninstalled on a real Windows machine before it is published."),
    },
    "extension": {
        "h": L("افزونهٔ مرورگر", "پێوەکراوی وێبگەڕ", "Browser extension"),
        "txt": L("پنجرهٔ کوچکی کنار نوار آدرس: قیمت زنده، ترس و طمع، گزارش روزانه، تحلیل، دانشنامه، ماشین‌حساب، پست‌های Coin_Kurd و هشدار قیمت. قیمت کوین دلخواه با نگه‌داشتن ماوس روی آیکون دیده می‌شود و هیچ چیز روی لوگو نمی‌نشیند.",
                 "پەنجەرەیەکی بچووک لە تەنیشت شریتی ناونیشان: نرخی زیندوو، ترس و تەماح، ڕاپۆرتی ڕۆژانە، شیکاری، زانستنامە، ژمێرەر، پۆستەکانی Coin_Kurd و ئاگاداریی نرخ. نرخی دراوی دڵخواز بە ڕاگرتنی ماوس لەسەر ئایکۆن دەبینرێت و هیچ شتێک لەسەر لۆگۆ نانیشێت.",
                 "A small window beside the address bar: live prices, Fear & Greed, the daily report, analysis, the encyclopedia, calculators, Coin_Kurd posts and price alerts. Hover over the icon for your coin's price — nothing ever sits on the logo."),
        "more": L("راهنمای کامل نصب", "ڕێنمایی تەواوی دامەزراندن", "Full install guide"),
    },
    "telegram": {
        "h": L("ربات تلگرام", "بۆتی تێلێگرام", "Telegram bot"),
        "txt": L("@Kurd_kurdistan_bot به کوردی سورانی، کرمانجی، فارسی، عربی و انگلیسی: قیمت دلار، تتر، طلا و کریپتو، هشدار قیمت، بررسی توکن، گزارش روزانه، پروکسی اضطراری و آموزش شروع امن.",
                 "@Kurd_kurdistan_bot بە کوردیی سۆرانی، کورمانجی، فارسی، عەرەبی و ئینگلیزی: نرخی دۆلار، تەتەر، زێڕ و کریپتۆ، ئاگاداریی نرخ، پشکنینی تۆکن، ڕاپۆرتی ڕۆژانە، پرۆکسیی فریاکەوتن و فێربوونی دەستپێکی ئارام.",
                 "@Kurd_kurdistan_bot in Sorani, Kurmanji, Persian, Arabic and English: dollar, tether, gold and crypto prices, price alerts, token checks, the daily report, emergency proxies and a safe start."),
        "more": L("دربارهٔ ربات", "دەربارەی بۆت", "About the bot"),
    },
    "tradebot": {
        "h": L("ربات معامله‌گر انتخاب", "بۆتی بازرگانیی ئینتیخاب", "The Entekhab trading bot"),
        "txt": L("برای کسانی که سرور خودشان را دارند: Freqtrade با رابط فارسی و {n} استراتژی متن‌باز، با Docker. هیچ عدد عملکردی برای استراتژی‌ها ادعا نمی‌شود؛ پیش از هر استفاده بک‌تست کنید.",
                 "بۆ ئەوانەی ڕاژەکاری خۆیان هەیە: Freqtrade بە ڕووکاری فارسی و {n} ستراتیژیی کۆد-کراوە، بە Docker. هیچ ژمارەیەکی ئەنجام بۆ ستراتیژییەکان بانگەشە ناکرێت؛ پێش هەر بەکارهێنانێک باکتێست بکە.",
                 "For people with their own server: Freqtrade with a Persian interface and {n} open-source strategies, on Docker. No performance figures are claimed for the strategies; backtest before any use."),
        "more": L("صفحهٔ ربات معامله‌گر", "پەڕەی بۆتی بازرگانی", "Trading bot page"),
    },
}

FAQ = [
    (L("همه رایگان است؟", "هەمووی بێبەرامبەرە؟", "Is it all free?"),
     L("بله. همهٔ نسخه‌ها رایگان‌اند، تبلیغ ندارند و هیچ ردیابی‌ای در آن‌ها نیست.", "بەڵێ. هەموو وەشانەکان بێبەرامبەرن، ڕیکلامیان نییە و هیچ شوێنکەوتنێکیان تێدا نییە.", "Yes. Every version is free, with no ads and no tracking.")),
    (L("چرا در گوگل‌پلی و اپ‌استور نیست؟", "بۆچی لە گووگڵ پلەی و ئەپ ستۆر نییە؟", "Why not Google Play or the App Store?"),
     L("فروشگاه‌ها برای ایران محدودیت دارند و اپ‌های ایرانی را حذف می‌کنند؛ برای همین هر نسخه مستقیم از همین سایت منتشر می‌شود و هر فایل اثر انگشت SHA-256 دارد تا مطمئن شوید همان فایل اصلی است.",
       "فرۆشگاکان بۆ ئێران سنووردارن و ئەپە ئێرانییەکان لادەبەن؛ بۆیە هەر وەشانێک ڕاستەوخۆ لەم ماڵپەڕەوە بڵاو دەکرێتەوە و هەر فایلێک پەنجەمۆری SHA-256ی هەیە تا دڵنیا بیت فایلە ڕەسەنەکەیە.",
       "The stores restrict Iran and remove Iranian apps, so every version is published directly here, and each file carries a SHA-256 fingerprint so you can check it is the original.")),
    (L("چطور به‌روز می‌مانند؟", "چۆن نوێ دەمێننەوە؟", "How do they stay up to date?"),
     L("محتوای همهٔ نسخه‌ها همان سایت است و همیشه تازه است. خود برنامه‌ها — اندروید، ویندوز و افزونه — هم وقتی نسخهٔ جدیدی بیاید خبر می‌دهند.",
       "ناوەڕۆکی هەموو وەشانەکان هەمان ماڵپەڕە و هەمیشە نوێیە. خودی بەرنامەکانیش — ئەندرۆید، ویندۆز و پێوەکراو — کاتێک وەشانێکی نوێ بێت ئاگادارت دەکەنەوە.",
       "Every version shows the site itself, so the content is always current. The apps themselves — Android, Windows and the extension — also tell you when a new version is out.")),
    (L("اطلاعات من کجا می‌رود؟", "زانیارییەکانم بۆ کوێ دەچن؟", "Where does my data go?"),
     L("هیچ‌جا. تنظیمات، هشدارها و پیشرفت شما فقط روی دستگاه خودتان می‌ماند.", "هیچ شوێنێک. ڕێکخستن، ئاگاداری و پێشکەوتنت تەنها لەسەر ئامێری خۆت دەمێنێتەوە.", "Nowhere. Your settings, alerts and progress stay on your own device.")),
]


# ----------------------------------------------------------------------------------------------------- iPhone pictures
def _phone(inner):
    return ('<svg class="ap-ill" viewBox="0 0 120 210" direction="ltr" style="direction:ltr" aria-hidden="true"><rect x="3" y="3" width="114" height="204" rx="20" fill="#111" stroke="#3a3a3a" stroke-width="2"/>'
            '<rect x="44" y="9" width="32" height="7" rx="3.5" fill="#000"/>' + inner + "</svg>")


ACC = "#f7931a"
ILL = [
    _phone('<rect x="10" y="24" width="100" height="140" rx="6" fill="#1b1b1b"/><text x="60" y="98" font-size="9" fill="#a8a49c" text-anchor="middle">entekhab.net</text>'
           '<rect x="12" y="176" width="78" height="20" rx="10" fill="#2a2a2a"/><text x="51" y="189.5" font-size="7.5" fill="#ddd" text-anchor="middle">entekhab.net</text>'
           f'<circle cx="102" cy="186" r="10" fill="#2a2a2a" stroke="{ACC}" stroke-width="2"/><text x="102" y="189" font-size="10" fill="#fff" text-anchor="middle">•••</text>'
           f'<circle cx="102" cy="186" r="15" fill="none" stroke="{ACC}" stroke-opacity=".45" stroke-width="2"><animate attributeName="r" values="11;17;11" dur="1.8s" repeatCount="indefinite"/></circle>'),
    _phone('<rect x="10" y="24" width="100" height="150" rx="6" fill="#1b1b1b"/>'
           '<rect x="40" y="96" width="70" height="78" rx="8" fill="#2a2a2a"/>'
           f'<rect x="44" y="102" width="62" height="16" rx="5" fill="rgba(247,147,26,.18)" stroke="{ACC}"/>'
           '<path d="M51 114v-7m0 0-2.5 2.5M51 107l2.5 2.5M47.5 110v5h7v-5" stroke="#fff" stroke-width="1" fill="none"/><text x="60" y="113.5" font-size="7.5" fill="#fff">Share</text>'
           '<rect x="44" y="124" width="62" height="12" rx="4" fill="#333"/><rect x="44" y="140" width="62" height="12" rx="4" fill="#333"/><rect x="44" y="156" width="62" height="12" rx="4" fill="#333"/>'),
    _phone('<rect x="10" y="60" width="100" height="140" rx="12" fill="#1f1f1f"/>'
           '<rect x="16" y="70" width="88" height="14" rx="4" fill="#2c2c2c"/><rect x="16" y="88" width="88" height="14" rx="4" fill="#2c2c2c"/>'
           f'<rect x="16" y="106" width="88" height="18" rx="5" fill="rgba(247,147,26,.18)" stroke="{ACC}"/><rect x="21" y="110" width="10" height="10" rx="2.5" fill="none" stroke="#fff"/><path d="M26 112.5v5M23.5 115h5" stroke="#fff"/>'
           '<text x="35" y="118" font-size="6.3" fill="#fff">Add to Home Screen</text><rect x="16" y="128" width="88" height="14" rx="4" fill="#2c2c2c"/><rect x="16" y="146" width="88" height="14" rx="4" fill="#2c2c2c"/>'),
    _phone('<rect x="10" y="24" width="100" height="176" rx="6" fill="#1b1b1b"/><text x="18" y="38" font-size="7" fill="#aaa">Cancel</text>'
           f'<text x="102" y="38" font-size="7.5" fill="{ACC}" text-anchor="end" font-weight="700">Add</text><circle cx="96" cy="35" r="11" fill="none" stroke="{ACC}" stroke-opacity=".55" stroke-width="2"><animate attributeName="r" values="9;14;9" dur="1.8s" repeatCount="indefinite"/></circle>'
           '<rect x="18" y="50" width="84" height="38" rx="8" fill="#262626"/><image href="/assets/apple-touch-icon.png" x="23" y="55" width="28" height="28"/><text x="58" y="66" font-size="8" fill="#fff">انتخاب</text><text x="58" y="78" font-size="6" fill="#999">entekhab.net</text>'
           '<rect x="18" y="96" width="84" height="20" rx="6" fill="#262626"/><text x="24" y="109" font-size="6.5" fill="#fff">Open as Web App</text>'
           '<rect x="80" y="100" width="18" height="11" rx="5.5" fill="#34c759"/><circle cx="92.5" cy="105.5" r="4.4" fill="#fff"/>'),
]


# ----------------------------------------------------------------------------------------------------- the page
CSS = """
.ap{--g:linear-gradient(135deg,#ffcf7a,#f7931a 55%,#c2410c)}
.ap-hero{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);gap:28px;align-items:center;margin:6px 0 30px;padding:34px;border:1px solid var(--line);border-radius:30px;overflow:hidden;
  background:radial-gradient(90% 120% at 0% 0%,rgba(247,147,26,.18),transparent 55%),radial-gradient(60% 80% at 100% 100%,rgba(194,65,12,.12),transparent 60%),linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.01))}
.ap-k{display:inline-block;font-size:.78rem;letter-spacing:.04em;color:#f7931a;border:1px solid rgba(247,147,26,.4);border-radius:99px;padding:3px 12px;margin:0 0 12px}
.ap h1{font-size:clamp(1.8rem,3.6vw,2.7rem);line-height:1.3;margin:0 0 12px}
.ap .lead{font-size:1.03rem;line-height:2;color:rgba(255,255,255,.82);margin:0 0 18px}
.ap-cta{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 14px}
.ap-b{display:inline-flex;align-items:center;gap:10px;padding:12px 18px;border-radius:16px;font-weight:800;text-decoration:none;border:1px solid var(--line);color:#fff;background:rgba(255,255,255,.04);transition:transform .15s,border-color .15s,box-shadow .15s;cursor:pointer;font:inherit;font-weight:800}
.ap-b:hover{transform:translateY(-2px);border-color:rgba(247,147,26,.6)}
.ap-b.p{background:var(--g);color:#111;border:0;box-shadow:0 14px 34px rgba(247,147,26,.3)}
.ap-b small{display:block;font-weight:500;font-size:.72rem;opacity:.8}
.ap-b svg,.ap-b .ek-si{width:22px;height:22px;flex:none}
.ap-smart{display:none}
html:not([data-plat]) .ap-smart[data-p=web],html[data-plat=web] .ap-smart[data-p=web],html[data-plat=android] .ap-smart[data-p=android],
html[data-plat=iphone] .ap-smart[data-p=iphone],html[data-plat=windows] .ap-smart[data-p=windows]{display:inline-flex}
html[data-plat=web] .ap-alllink{display:none}
.ap-pwa{display:none}html.ap-pwa-ok .ap-pwa{display:inline-flex}
.ap-trust{display:flex;flex-wrap:wrap;gap:8px 14px;margin:6px 0 0;padding:0;list-style:none;font-size:.82rem;color:rgba(255,255,255,.7)}
.ap-trust li{display:inline-flex;align-items:center;gap:6px}.ap-trust svg{width:16px;height:16px;color:#34d399}
.ap-show{position:relative;height:430px;perspective:1400px}
.ap-lap{position:absolute;inset-inline-end:0;top:18px;width:86%;transform:rotateY(-9deg) rotateX(4deg);transform-origin:center;animation:ap-f 7s ease-in-out infinite alternate}
.ap-lap .sc{border-radius:14px 14px 4px 4px;border:9px solid #1a1a1a;border-bottom-width:12px;background:#000;box-shadow:0 30px 70px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.07)}
.ap-lap .sc img{display:block;width:100%;height:auto;border-radius:4px}
.ap-lap .ba{height:12px;margin:0 -7%;border-radius:0 0 14px 14px;background:linear-gradient(#2a2a2a,#141414);box-shadow:0 14px 30px rgba(0,0,0,.5)}
.ap-ph{position:absolute;inset-inline-start:2%;bottom:0;width:30%;padding:7px;border-radius:30px;background:#141414;box-shadow:0 26px 60px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.1);animation:ap-f 6s ease-in-out -2s infinite alternate}
.ap-ph img{display:block;width:100%;height:auto;border-radius:24px}
.ap-ph::before{content:"";position:absolute;top:12px;left:50%;width:30%;height:8px;transform:translateX(-50%);border-radius:99px;background:#000;z-index:1}
.ap-pop{position:absolute;inset-inline-end:-2%;bottom:-10px;width:30%;border-radius:16px;overflow:hidden;border:1px solid rgba(247,147,26,.35);box-shadow:0 26px 60px rgba(0,0,0,.6);animation:ap-f 8s ease-in-out -4s infinite alternate}
.ap-pop img{display:block;width:100%;height:auto}
@keyframes ap-f{to{translate:0 -10px}}
@media (prefers-reduced-motion:reduce){.ap-lap,.ap-ph,.ap-pop{animation:none}}
.ap h2.ap-h{font-size:1.4rem;margin:0 0 14px}
.ap-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin:0 0 30px}
.ap-c{position:relative;display:flex;flex-direction:column;gap:8px;padding:20px;border-radius:22px;border:1px solid var(--line);background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.015));transition:border-color .2s,transform .2s}
.ap-c:hover{border-color:rgba(247,147,26,.45);transform:translateY(-2px)}
.ap-c .ic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:rgba(247,147,26,.12);color:#f7931a}
.ap-c .ic svg,.ap-c .ic .ek-si{width:24px;height:24px}
.ap-c h3{margin:4px 0 0;font-size:1.12rem}.ap-c p{margin:0;font-size:.9rem;line-height:1.85;color:rgba(255,255,255,.72);flex:1}
.ap-c .m{font-size:.76rem;color:rgba(255,255,255,.5)}
.ap-c .act{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.ap-c .act a{padding:9px 14px;border-radius:12px;font-weight:700;font-size:.86rem;text-decoration:none;border:1px solid var(--line);color:#fff}
.ap-c .act a.p{background:var(--g);color:#111;border:0}
.ap-c .yb{display:none;position:absolute;inset-inline-end:14px;top:14px;font-size:.7rem;font-weight:800;color:#111;background:#34d399;border-radius:99px;padding:2px 9px}
html[data-plat=android] .ap-c[data-p=android],html[data-plat=iphone] .ap-c[data-p=iphone],html[data-plat=windows] .ap-c[data-p=windows]{border-color:rgba(52,211,153,.6);box-shadow:0 0 0 1px rgba(52,211,153,.25),0 18px 40px rgba(0,0,0,.35)}
html[data-plat=android] .ap-c[data-p=android] .yb,html[data-plat=iphone] .ap-c[data-p=iphone] .yb,html[data-plat=windows] .ap-c[data-p=windows] .yb{display:block}
.ap-c.soon{opacity:.6}
.ap-sec{margin:0 0 26px;padding:24px;border-radius:24px;border:1px solid var(--line);background:rgba(255,255,255,.02);scroll-margin-top:90px;transition:border-color .4s,box-shadow .4s}
.ap-sec.hl{border-color:rgba(247,147,26,.7);box-shadow:0 0 0 3px rgba(247,147,26,.18)}
.ap-sec h2{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:1.3rem}.ap-sec h2 svg,.ap-sec h2 .ek-si{width:24px;height:24px;color:#f7931a}
.ap-sec p{line-height:2}
.ap-steps{counter-reset:s;list-style:none;margin:0 0 14px;padding:0;display:grid;gap:10px}
.ap-steps li{counter-increment:s;position:relative;padding:11px 16px;padding-inline-start:54px;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.025);line-height:1.9}
.ap-steps li::before{content:counter(s);position:absolute;inset-inline-start:14px;top:11px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:900;color:#111;background:var(--g)}
.ap-pts{margin:0 0 12px;padding:0;list-style:none;display:grid;gap:6px}
.ap-pts li{display:flex;gap:8px;align-items:flex-start;line-height:1.9}.ap-pts li svg{flex:none;width:18px;height:18px;margin-top:5px;color:#34d399}
.ap-ills{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 16px}
.ap-ills figure{margin:0;text-align:center}.ap-ill{width:100%;max-width:150px;height:auto}
.ap-ills figcaption{font-size:.78rem;color:rgba(255,255,255,.6);margin-top:4px}
.ap-sha{font-size:.72rem;color:rgba(255,255,255,.5);word-break:break-all;direction:ltr;unicode-bidi:isolate;text-align:start}
.ap-qr{display:flex;gap:16px;align-items:center;margin:0 0 30px;padding:16px 20px;border-radius:20px;border:1px dashed var(--line)}
.ap-qr img{width:96px;height:96px;border-radius:10px;background:#fff;padding:4px;flex:none}
html[data-plat=android] .ap-qr,html[data-plat=iphone] .ap-qr{display:none}
.ap-faq details{border:1px solid var(--line);border-radius:16px;padding:12px 16px;margin:0 0 10px;background:rgba(255,255,255,.02)}
.ap-faq summary{cursor:pointer;font-weight:700}
.ap .note svg{width:16px;height:16px;vertical-align:-3px;color:#34d399}.ap-faq p{margin:8px 0 0;line-height:2;color:rgba(255,255,255,.78)}
@media (max-width:900px){.ap-hero{grid-template-columns:1fr;padding:22px}.ap-show{height:300px}.ap-ills{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:520px){.ap-show{height:230px}.ap-pop{display:none}.ap-ph{width:34%}}
"""

JS = r"""(function(){var u=navigator.userAgent,de=document.documentElement,
ios=/iP(hone|od|ad)/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1),an=/Android/i.test(u),wi=/Windows NT/.test(u)&&!/Windows Phone/.test(u);
de.setAttribute('data-plat',ios?'iphone':an?'android':wi?'windows':'web');
function pwa(){de.classList.toggle('ap-pwa-ok',!!window.EK_PWA)}document.addEventListener('ek:pwa',pwa);pwa();
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-pwa]');if(b&&window.EK_PWA){e.preventDefault();window.EK_PWA.prompt();}});
/* the same section exists once per language: go to the one being shown */
function go(){var h=(location.hash||'').slice(1);if(!h)return;var blk=document.querySelector('[data-rl]:not([hidden])')||document,s=blk.querySelector('[data-sec="'+h+'"]');if(!s)return;
s.scrollIntoView({behavior:'smooth',block:'start'});s.classList.add('hl');setTimeout(function(){s.classList.remove('hl')},2600)}
addEventListener('hashchange',go);document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(a&&a.getAttribute('href').length>1&&location.hash===a.getAttribute('href')){e.preventDefault();go()}});addEventListener('ek-lang',function(){setTimeout(go,50)});setTimeout(go,350);})();"""


def build():
    an = _json("app/app.json") or {}
    wi = _json("app/windows.json") or {}
    ex = _json("extension/latest.json") or {}
    try:
        ext_ver = json.load(open(os.path.join(ROOT, "chrome-extension", "src", "manifest.json"), encoding="utf-8"))["version"]
    except Exception:  # noqa: BLE001
        ext_ver = ex.get("version", "")
    tb = _json("trade-bot/strategies.json") or {}
    n_strat = (tb.get("meta") or {}).get("count") or len(tb.get("strategies") or [])
    has_apk = bool(an.get("file")) and os.path.exists(os.path.join(ROOT, "app", an.get("file", "")))
    has_win = bool(wi.get("file")) and os.path.exists(os.path.join(ROOT, "app", "windows", wi.get("file", "")))
    apk_url = f"/app/{an['file']}" if has_apk else ""
    win_url = f"/app/windows/{wi['file']}" if has_win else ""
    ext_size = (ex.get("chrome") or {}).get("size")

    def block(lg):
        t = lambda k: T[k][lg]  # noqa: E731
        chk = IC["check"]
        trust = "".join(f"<li>{chk}{e(x)}</li>" for x in t("trust"))
        # the visitor's own platform first (data-plat is set by the page script)
        smart = ""
        if has_apk:
            smart += (f'<a class="ap-b p ap-smart" data-p="android" href="{apk_url}" download>{IC["android"]}<span>{e(t("smart_android"))}'
                      f'<small>{parts("APK", e(size(an.get("size"), lg)), e(t("ver")) + " " + e(dv(an.get("version", ""), lg)))}</small></span></a>')
        smart += (f'<a class="ap-b p ap-smart" data-p="iphone" href="#iphone">{IC["iphone"]}<span>{e(t("smart_iphone"))}'
                  f'<small>{e(t("smart_iphone_s"))}</small></span></a>')
        if has_win:
            smart += (f'<a class="ap-b p ap-smart" data-p="windows" href="{win_url}" download>{IC["windows"]}<span>{e(t("smart_windows"))}'
                      f'<small>{parts(e(size(wi.get("size"), lg)), "Windows 10 / 11", e(t("ver")) + " " + e(dv(wi.get("version", ""), lg)))}</small></span></a>')
        else:
            smart += f'<a class="ap-b p ap-smart" data-p="windows" href="#platforms">{IC["windows"]}<span>{e(T["all"][lg])}</span></a>'
        smart += f'<a class="ap-b p ap-smart" data-p="web" href="#platforms">{IC["down"]}<span>{e(t("all"))}</span></a>'
        smart += f'<a class="ap-b ap-alllink" href="#platforms">{e(t("all"))}</a>'
        smart += f'<button type="button" class="ap-b ap-pwa" data-pwa>{IC["down"]}<span>{e(t("pwa"))}</span></button>'
        pic = "en" if lg == "en" else "fa"
        pop = "en" if lg == "en" else ("ckb" if lg == "ckb" else "fa")
        show = (f'<div class="ap-show" aria-hidden="true"><div class="ap-lap"><div class="sc"><img src="/assets/apps/desk-{pic}.webp" alt="" width="960" height="600" decoding="async"></div><div class="ba"></div></div>'
                f'<div class="ap-ph"><img src="/assets/apps/phone-{pic}.webp" alt="" width="520" height="1125" decoding="async" loading="lazy"></div>'
                f'<div class="ap-pop"><img src="/chrome-extension/store/popup-{pop}.webp" alt="" width="760" height="1180" decoding="async" loading="lazy"></div></div>')

        # the six cards
        def card(key, href, meta, soon=False, download=False, extra=""):
            name, desc, btn = CARDS[key]
            d = desc[lg].replace("{n}", dg(n_strat, lg)) if n_strat else desc[lg].replace(" {n}", "").replace("{n} ", "")
            act = (f'<a class="p" href="{href}"{" download" if download else ""}{" target=_blank rel=noopener" if href.startswith("http") else ""}>{e(btn[lg])}</a>'
                   if not soon else f'<a href="#{key}">{e(T["soon"][lg])}</a>')
            return (f'<div class="ap-c{" soon" if soon else ""}" data-p="{key}"><span class="yb">{e(t("yours"))}</span><span class="ic">{IC[key]}</span>'
                    f'<h3>{e(name[lg])}</h3><p>{e(d)}</p><span class="m">{meta}</span>'
                    f'<div class="act">{act}<a href="#{key}">{e(t("guide"))}</a>{extra}</div></div>')

        cards = (card("android", apk_url, (parts(e(t("ver")) + " " + e(dv(an.get("version", ""), lg)), e(size(an.get("size"), lg)), "Android 5+") if has_apk else ""), soon=not has_apk, download=True)
                 + card("iphone", "#iphone", parts("iOS 16.4+", "iPadOS"))
                 + card("windows", win_url, (parts(e(t("ver")) + " " + e(dv(wi.get("version", ""), lg)), e(size(wi.get("size"), lg)), "Windows 10 / 11 · x64") if has_win else ""), soon=not has_win, download=True)
                 + card("extension", "/extension/", parts(e(t("ver")) + " " + e(dv(ext_ver, lg)), e(size(ext_size, lg)) if ext_size else "", "Chrome · Edge · Firefox"))
                 + card("telegram", "https://t.me/Kurd_kurdistan_bot", '<bdi>@Kurd_kurdistan_bot</bdi>')
                 + card("tradebot", "/trade-bot/", parts("Freqtrade · Docker")))

        def steps(key, sz=""):
            return '<ol class="ap-steps">' + "".join(f"<li>{x.replace('{size}', e(sz))}</li>" for x in SEC[key]["steps"][lg]) + "</ol>"

        def pts(key):
            return '<ul class="ap-pts">' + "".join(f"<li>{chk}<span>{e(x)}</span></li>" for x in SEC[key]["pts"][lg]) + "</ul>"

        def sha(label, v):
            return f'<p class="ap-sha">{e(t("sha"))} · {e(label)}: {e(v)}</p>' if v else ""

        android = (f'<section class="ap-sec" data-sec="android"><h2>{IC["android"]}{e(SEC["android"]["h"][lg])}</h2>'
                   + (f'<div class="ap-cta"><a class="ap-b p" href="{apk_url}" download>{IC["down"]}<span>{e(CARDS["android"][2][lg])}<small>{e(an.get("file", ""))}</small></span></a></div>' if has_apk else "")
                   + steps("android", size(an.get("size"), lg)) + pts("android")
                   + sha(an.get("file", "APK"), an.get("sha256", "")) + (f'<p class="ap-sha">cert · {e(an.get("cert_sha256", ""))}</p>' if an.get("cert_sha256") else "")
                   + "</section>")
        caps = [L("سافاری", "سافاری", "Safari"), L("Share", "Share", "Share"), L("Add to Home Screen", "Add to Home Screen", "Add to Home Screen"), L("Add", "Add", "Add")]
        ills = '<div class="ap-ills">' + "".join(f"<figure>{svg}<figcaption>{dg(i + 1, lg)} · {e(caps[i][lg])}</figcaption></figure>" for i, svg in enumerate(ILL)) + "</div>"
        iphone = (f'<section class="ap-sec" data-sec="iphone"><h2>{IC["iphone"]}{e(SEC["iphone"]["h"][lg])}</h2><p>{e(SEC["iphone"]["why"][lg])}</p>'
                  + ills + steps("iphone") + pts("iphone") + "</section>")
        windows = (f'<section class="ap-sec" data-sec="windows"><h2>{IC["windows"]}{e(SEC["windows"]["h"][lg])}</h2>'
                   + (f'<div class="ap-cta"><a class="ap-b p" href="{win_url}" download>{IC["down"]}<span>{e(CARDS["windows"][2][lg])}<small>{e(wi.get("file", ""))}</small></span></a></div>'
                      if has_win else f'<p class="note">{e(T["soon"][lg])}</p>')
                   + steps("windows", size(wi.get("size"), lg)) + pts("windows") + f'<p class="note">{e(SEC["windows"]["req"][lg])}</p>'
                   + f'<p class="note">{chk} {e(SEC["windows"]["tested"][lg])} · <a href="https://github.com/omidmokri/coinkurd/tree/main/windows" rel="noopener" target="_blank">{e(t("src"))}</a></p>'
                   + sha(wi.get("file", "EXE"), wi.get("sha256", "")) + "</section>")
        ext = (f'<section class="ap-sec" data-sec="extension"><h2>{IC["extension"]}{e(SEC["extension"]["h"][lg])}</h2><p>{e(SEC["extension"]["txt"][lg])}</p>'
               f'<div class="ap-cta"><a class="ap-b p" href="/extension/">{IC["extension"]}<span>{e(SEC["extension"]["more"][lg])}</span></a></div></section>')
        tg = (f'<section class="ap-sec" data-sec="telegram"><h2>{IC["telegram"]}{e(SEC["telegram"]["h"][lg])}</h2><p>{e(SEC["telegram"]["txt"][lg])}</p>'
              f'<div class="ap-cta"><a class="ap-b p" href="https://t.me/Kurd_kurdistan_bot" target="_blank" rel="noopener">{IC["telegram"]}<span>{e(CARDS["telegram"][2][lg])}</span></a>'
              f'<a class="ap-b" href="/bot/">{e(SEC["telegram"]["more"][lg])}</a></div></section>')
        tbt = SEC["tradebot"]["txt"][lg].replace("{n}", dg(n_strat, lg)) if n_strat else SEC["tradebot"]["txt"][lg].replace(" {n}", "")
        trb = (f'<section class="ap-sec" data-sec="tradebot"><h2>{IC["tradebot"]}{e(SEC["tradebot"]["h"][lg])}</h2><p>{e(tbt)}</p>'
               f'<div class="ap-cta"><a class="ap-b" href="/trade-bot/">{e(SEC["tradebot"]["more"][lg])}</a></div></section>')
        faq = '<div class="ap-faq">' + "".join(f"<details><summary>{e(q[lg])}</summary><p>{e(a[lg])}</p></details>" for q, a in FAQ) + "</div>"
        return (f'<div class="ap"><div class="meta"><a href="/">{e(t("home"))}</a> / {e(t("crumb"))}</div>'
                f'<section class="ap-hero"><div><span class="ap-k">{e(t("kick"))}</span><h1>{e(t("h1"))}</h1><p class="lead">{e(t("lead"))}</p>'
                f'<div class="ap-cta">{smart}</div><ul class="ap-trust">{trust}</ul></div>{show}</section>'
                f'<h2 class="ap-h" data-sec="platforms">{e(t("plat_h"))}</h2><div class="ap-grid">{cards}</div>'
                f'<div class="ap-qr"><img src="/assets/apps/qr-app.svg" alt="entekhab.net/app" width="96" height="96" loading="lazy"><p>{e(t("qr"))}<br><b dir="ltr">entekhab.net/app</b></p></div>'
                f'{android}{iphone}{windows}{ext}{tg}{trb}{faq}'
                f'<p class="note">{IC["shield"]} {e(t("sha_why"))} · {e(t("nfa"))}</p></div>')

    import build_reality as BR
    body = BR.tri(block) + f"<script>{BR.LANG_JS}</script><script>{JS}</script>"
    ld = {"@context": "https://schema.org", "@type": "ItemList", "name": "Entekhab apps", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "item": it} for i, it in enumerate([
            {"@type": "MobileApplication", "name": "Entekhab for Android", "operatingSystem": "Android 5+", "applicationCategory": "FinanceApplication",
             "softwareVersion": an.get("version", ""), "downloadUrl": f"{BP.SITE}{apk_url}" if has_apk else f"{BP.SITE}/app/", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}},
            {"@type": "WebApplication", "name": "Entekhab for iPhone & iPad", "operatingSystem": "iOS, iPadOS", "applicationCategory": "FinanceApplication",
             "url": f"{BP.SITE}/", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}},
            {"@type": "SoftwareApplication", "name": "Entekhab for Windows", "operatingSystem": "Windows 10, Windows 11 (64-bit)", "applicationCategory": "FinanceApplication",
             "softwareVersion": wi.get("version", ""), "downloadUrl": f"{BP.SITE}{win_url}" if has_win else f"{BP.SITE}/app/", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}},
            {"@type": "SoftwareApplication", "name": "Entekhab browser extension", "operatingSystem": "Chrome, Edge, Brave, Opera, Firefox", "applicationCategory": "BrowserApplication",
             "softwareVersion": ext_ver, "url": f"{BP.SITE}/extension/", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}},
        ])]}
    url = BP.page("app/", "اپلیکیشن‌های انتخاب — اندروید، آیفون، ویندوز، افزونهٔ مرورگر و ربات تلگرام",
                  "انتخاب روی هر صفحه‌ای: اپ اندروید، وب‌اپ آیفون و آیپد، برنامهٔ ویندوز ۶۴ بیتی، افزونهٔ کروم و فایرفاکس و ربات تلگرام — رایگان، بدون تبلیغ و بدون ردیابی",
                  body, f"<style>{CSS}</style><script type=\"application/ld+json\">{BP.sj(ld)}</script>")
    print(f"apps page: android={an.get('version')} windows={wi.get('version') if has_win else '-'} extension={ext_ver}")
    return [url]


if __name__ == "__main__":
    build()
