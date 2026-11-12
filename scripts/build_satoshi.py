#!/usr/bin/env python3
"""Builds /satoshi/ — the story of Satoshi Nakamoto told as a chain of twelve blocks (fa / ckb / en in one page).

Every block is a dated, checkable event (the chain itself, the cryptography mailing list, the BitcoinTalk archive).
Nothing about Satoshi's identity or appearance is guessed: the figure on the page is an empty outline.
Without JavaScript the page is a plain article; assets/satoshi.js turns it into a block-by-block player on wide screens,
decodes the message of block zero from its bytes, and fills the live values from the real price. Run after build_pages.py."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
from reality_common import L  # noqa: E402

e = BP.e
VER = "5"
GENESIS_MSG = "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks"
GENESIS_HASH = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f"
MON = {
    "fa": ["ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"],
    "ckb": ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەممووز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"],
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
}
T = {
    "title": L("داستان ساتوشی ناکاموتو: از مقالهٔ ۹ صفحه‌ای تا سکوت", "چیرۆکی ساتۆشی ناکامۆتۆ: لە توێژینەوەی ٩ لاپەڕەییەوە تا بێدەنگی",
               "The story of Satoshi Nakamoto: from a nine-page paper to silence"),
    "h1": L("ساتوشی ناکاموتو: نامی که ماند، چهره‌ای که هرگز دیده نشد", "ساتۆشی ناکامۆتۆ: ناوێک کە مایەوە، ڕوخسارێک کە هەرگیز نەبینرا",
            "Satoshi Nakamoto: the name that stayed, the face nobody saw"),
    "desc": L("زنجیره‌ای از ۱۲ بلاک: ثبت bitcoin.org، مقالهٔ بیت‌کوین، بلاک پیدایش، اولین تراکنش، دو پیتزا، آخرین پیام و میراثی که هنوز دست‌نخورده است؛ با تاریخ دقیق و بدون حدس دربارهٔ هویت.",
              "زنجیرەیەک لە ١٢ بلۆک: تۆمارکردنی bitcoin.org، توێژینەوەی بیتکۆین، بلۆکی سەرەتا، یەکەم مامەڵە، دوو پیتزا، دوایین پەیام و میراتێک کە هێشتا دەستی لێ نەدراوە؛ بە بەرواری ورد و بێ مەزەندە دەربارەی ناسنامە.",
              "A chain of twelve blocks: bitcoin.org, the Bitcoin paper, the genesis block, the first transaction, two pizzas, the last message and a legacy nobody has touched; exact dates, no guessing about identity."),
    "lead": L("بیت‌کوین را کسی ساخت که هیچ‌کس او را ندیده است. آنچه از او مانده، تاریخ‌هایی است که روی خودِ زنجیره و در بایگانی‌های عمومی ثبت شده‌اند. این صفحه همان تاریخ‌ها را، بلاک‌به‌بلاک، مرور می‌کند.",
              "بیتکۆین کەسێک دروستی کرد کە هیچ کەس نەیبینیوە. ئەوەی لێی ماوەتەوە ئەو بەروارانەن کە لەسەر خودی زنجیرەکە و لە ئەرشیفە گشتییەکاندا تۆمار کراون. ئەم پەڕەیە هەمان بەروارەکان، بلۆک بە بلۆک، دەخوێنێتەوە.",
              "Bitcoin was built by someone nobody has ever seen. What is left of that person are dates, recorded on the chain itself and in public archives. This page walks through those dates, block by block."),
    "home": L("خانه", "ماڵەوە", "Home"),
    "crumb": L("داستان ساتوشی", "چیرۆکی ساتۆشی", "Satoshi's story"),
    "block": L("بلاک", "بلۆک", "Block"),
    "today": L("امروز", "ئەمڕۆ", "Today"),
    "nofig": L("چهره‌ای وجود ندارد که نشان بدهیم.", "ڕوخسارێک نییە پیشانی بدەین.", "There is no face to show."),
    "prev": L("بلاک قبلی", "بلۆکی پێشوو", "Previous block"),
    "next": L("بلاک بعدی", "بلۆکی دواتر", "Next block"),
    "decode": L("رمزگشایی پیام", "کردنەوەی پەیام", "Decode the message"),
    "encode": L("نمایش بایت‌ها", "پیشاندانی بایتەکان", "Show the bytes"),
    "msgsrc": L("تیتر صفحهٔ اول روزنامهٔ تایمز، ۳ ژانویهٔ ۲۰۰۹؛ نوشته‌شده در بلاک صفر", "سەردێڕی لاپەڕەی یەکەمی ڕۆژنامەی تایمز، ٣ی کانوونی دووەمی ٢٠٠٩؛ نووسراو لە بلۆکی سفردا",
                "Front-page headline of The Times, 3 January 2009; written into block zero"),
    "hash": L("هش بلاک صفر", "هاشی بلۆکی سفر", "Hash of block zero"),
    "pizza": L("ارزش امروزِ آن ۱۰٬۰۰۰ بیت‌کوین", "بەهای ئەمڕۆی ئەو ١٠٬٠٠٠ بیتکۆینە", "Those 10,000 bitcoins today"),
    "mil": L("ارزش امروزِ یک میلیون بیت‌کوین", "بەهای ئەمڕۆی یەک ملیۆن بیتکۆین", "One million bitcoins today"),
    "days": L("روز از بلاک صفر", "ڕۆژ لە بلۆکی سفرەوە", "Days since block zero"),
    "height": L("آخرین بلاک ثبت‌شده", "دوایین بلۆکی تۆمارکراو", "Latest recorded block"),
    "livenote": L("با قیمت لحظه‌ای بیت‌کوین حساب می‌شود؛ اگر اتصال زنده نباشد، با آخرین قیمت ثبت‌شدهٔ سایت.", "بە نرخی ڕاستەوخۆی بیتکۆین دەژمێردرێت؛ ئەگەر پەیوەندیی زیندوو نەبێت، بە دوایین نرخی تۆمارکراوی ماڵپەڕ.",
                  "Worked out from the live Bitcoin price; without a live connection, from the site's last recorded price."),
    "known": L("آنچه می‌دانیم و آنچه نمی‌دانیم", "ئەوەی دەیزانین و ئەوەی نایزانین", "What we know, and what we do not"),
    "src": L("تاریخ‌ها از خودِ زنجیرهٔ بیت‌کوین، فهرست پستی رمزنگاری و بایگانی انجمن BitcoinTalk گرفته شده‌اند. شمار سکه‌های ساتوشی برآورد پژوهشگران است، نه عدد قطعی. دربارهٔ هویت ساتوشی هیچ حدسی در این صفحه نیامده است.",
             "بەروارەکان لە خودی زنجیرەی بیتکۆین، لیستی پۆستی کریپتۆگرافی و ئەرشیفی مەکۆی BitcoinTalk وەرگیراون. ژمارەی دراوەکانی ساتۆشی مەزەندەی توێژەرانە، نەک ژمارەیەکی دڵنیا. دەربارەی ناسنامەی ساتۆشی هیچ مەزەندەیەک لەم پەڕەیەدا نەهاتووە.",
             "Dates come from the Bitcoin chain itself, the cryptography mailing list and the BitcoinTalk archive. The number of Satoshi's coins is a research estimate, not a confirmed figure. This page makes no guess about who Satoshi is."),
}
KNOWN = L([
    ("می‌دانیم", "سقف عرضه ۲۱ میلیون است و در خودِ کد نوشته شده؛ هیچ‌کس، حتی سازنده، نمی‌تواند تنها آن را عوض کند."),
    ("می‌دانیم", "ساتوشی کلید هیچ «در پشتی» را نگه نداشت: شبکه از روز اول با قواعدی کار می‌کند که همه می‌توانند بخوانند و بسنجند."),
    ("نمی‌دانیم", "ساتوشی یک نفر بود یا چند نفر، کجا زندگی می‌کرد و چرا رفت. هر نامی که تا امروز مطرح شده، بدون امضای رمزنگاری مانده است."),
], [
    ("دەیزانین", "سنووری دابینکردن ٢١ ملیۆنە و لە خودی کۆدەکەدا نووسراوە؛ هیچ کەس، تەنانەت دروستکەرەکەش، بە تەنیا ناتوانێت بیگۆڕێت."),
    ("دەیزانین", "ساتۆشی کلیلی هیچ «دەرگای پشتەوە»ی نەهێشتەوە: تۆڕەکە لە ڕۆژی یەکەمەوە بە یاسایەک کار دەکات کە هەمووان دەتوانن بیخوێننەوە و بیپێون."),
    ("نایزانین", "ساتۆشی یەک کەس بوو یان چەند کەس، لە کوێ دەژیا و بۆچی ڕۆیشت. هەر ناوێک تا ئێستا باس کراوە، بێ واژۆی کریپتۆگرافی ماوەتەوە."),
], [
    ("Known", "The supply cap is 21 million and it is written in the code itself; nobody, not even the creator, can change it alone."),
    ("Known", "Satoshi kept no back door: from day one the network has run on rules anyone can read and verify."),
    ("Unknown", "Whether Satoshi was one person or several, where they lived, and why they left. Every name put forward so far has come without a cryptographic signature."),
])
# (date or None for "today", title, text, artifact)
B = [
    ("2008-08-18", L("نامی بی‌صاحب", "ناوێکی بێ خاوەن", "A name with no owner"),
     L("دامنهٔ bitcoin.org از راه یک سرویس ثبت ناشناس ثبت می‌شود. هنوز هیچ‌کس نمی‌داند این نام قرار است به چه چیزی اشاره کند.",
       "دۆمەینی bitcoin.org لە ڕێگەی خزمەتگوزارییەکی تۆمارکردنی نەناسراوەوە تۆمار دەکرێت. هێشتا کەس نازانێت ئەم ناوە ئاماژە بە چی دەکات.",
       "The domain bitcoin.org is registered through an anonymous registration service. Nobody yet knows what the name will stand for."), None),
    ("2008-09-15", L("بحران", "قەیران", "The crisis"),
     L("بانک لیمن برادرز ورشکست می‌شود و بحران مالی به اوج می‌رسد. دولت‌ها با پول عمومی به نجات بانک‌ها می‌روند و اعتماد به واسطه‌های مالی ترک برمی‌دارد.",
       "بانکی لیمان براذەرز مایەپووچ دەبێت و قەیرانی دارایی دەگاتە لووتکە. حکومەتەکان بە پارەی گشتی بانکەکان ڕزگار دەکەن و متمانە بە ناوەندگیرە داراییەکان درز دەبات.",
       "Lehman Brothers goes bankrupt and the financial crisis peaks. Governments rescue banks with public money, and trust in financial middlemen cracks."), None),
    ("2008-10-31", L("نُه صفحه", "نۆ لاپەڕە", "Nine pages"),
     L("کسی با امضای ساتوشی ناکاموتو مقاله‌ای نُه‌صفحه‌ای به یک فهرست پستی رمزنگاری می‌فرستد: «بیت‌کوین: یک سیستم پول نقد الکترونیکی همتابه‌همتا». ایده ساده است: پرداخت مستقیم از یک نفر به نفر دیگر، بدون بانک، روی دفتری که همه نگهش می‌دارند.",
       "کەسێک بە واژۆی ساتۆشی ناکامۆتۆ توێژینەوەیەکی نۆ لاپەڕەیی بۆ لیستێکی پۆستی کریپتۆگرافی دەنێرێت: «بیتکۆین: سیستەمێکی پارەی نەختی ئەلیکترۆنیی هاوتا بە هاوتا». بیرۆکەکە سادەیە: پارەدان ڕاستەوخۆ لە کەسێکەوە بۆ کەسێکی تر، بێ بانک، لەسەر دەفتەرێک کە هەمووان دەیپارێزن.",
       "Someone signing as Satoshi Nakamoto posts a nine-page paper to a cryptography mailing list: “Bitcoin: A Peer-to-Peer Electronic Cash System”. The idea is simple: payments straight from one person to another, with no bank, on a ledger everyone keeps."), None),
    ("2009-01-03", L("بلاک صفر", "بلۆکی سفر", "Block zero"),
     L("اولین بلاک زنجیره، بلاک پیدایش، ساخته می‌شود. ساتوشی تیتر آن روزِ روزنامهٔ تایمز را در آن می‌نویسد: هم مُهر زمان است، هم اشاره‌ای به دلیل ساختن بیت‌کوین. پاداش ۵۰ بیت‌کوینیِ این بلاک هرگز قابل خرج‌کردن نیست.",
       "یەکەم بلۆکی زنجیرەکە، بلۆکی سەرەتا، دروست دەکرێت. ساتۆشی سەردێڕی ئەو ڕۆژەی ڕۆژنامەی تایمز تێیدا دەنووسێت: هەم مۆری کاتە، هەم ئاماژەیەکە بۆ هۆکاری دروستکردنی بیتکۆین. پاداشتی ٥٠ بیتکۆینیی ئەم بلۆکە هەرگیز خەرج ناکرێت.",
       "The first block of the chain, the genesis block, is created. Satoshi writes that day's headline of The Times into it: a timestamp, and a hint at why Bitcoin was built. Its 50-bitcoin reward can never be spent."), "genesis"),
    ("2009-01-09", L("نسخهٔ ۰٫۱", "وەشانی ٠٫١", "Version 0.1"),
     L("نرم‌افزار بیت‌کوین به‌صورت متن‌باز منتشر می‌شود. هال فینی، رمزنگار، از اولین کسانی است که آن را اجرا می‌کند و دو روز بعد می‌نویسد: «Running bitcoin».",
       "نەرمەکاڵای بیتکۆین بە سەرچاوەی کراوە بڵاو دەکرێتەوە. هاڵ فینی، کریپتۆگرافەر، لە یەکەم کەسانەیە کە کاری پێ دەکات و دوو ڕۆژ دواتر دەنووسێت: «Running bitcoin».",
       "The Bitcoin software is released as open source. Cryptographer Hal Finney is among the first to run it, and two days later he writes: “Running bitcoin”."), None),
    ("2009-01-12", L("اولین تراکنش", "یەکەم مامەڵە", "The first transaction"),
     L("در بلاک ۱۷۰، ساتوشی ۱۰ بیت‌کوین برای هال فینی می‌فرستد: اولین انتقال بیت‌کوین میان دو نفر.",
       "لە بلۆکی ١٧٠دا ساتۆشی ١٠ بیتکۆین بۆ هاڵ فینی دەنێرێت: یەکەم گواستنەوەی بیتکۆین لە نێوان دوو کەسدا.",
       "In block 170 Satoshi sends 10 bitcoins to Hal Finney: the first transfer of bitcoin between two people."), None),
    ("2009-10-05", L("اولین قیمت", "یەکەم نرخ", "The first price"),
     L("سایتی به نام New Liberty Standard اولین نرخ تبدیل را منتشر می‌کند: هر دلار، ۱٬۳۰۹٫۰۳ بیت‌کوین؛ حساب‌شده از روی هزینهٔ برق استخراج.",
       "ماڵپەڕێک بە ناوی New Liberty Standard یەکەم نرخی گۆڕینەوە بڵاو دەکاتەوە: هەر دۆلارێک ١٬٣٠٩٫٠٣ بیتکۆین؛ لەسەر بنەمای تێچووی کارەبای کانکاری.",
       "A site called New Liberty Standard publishes the first exchange rate: 1,309.03 bitcoins to the dollar, worked out from the electricity cost of mining."), None),
    ("2010-05-22", L("دو پیتزا", "دوو پیتزا", "Two pizzas"),
     L("لازلو هانیه‌تس، برنامه‌نویسی در فلوریدا، ۱۰٬۰۰۰ بیت‌کوین می‌دهد و دو پیتزا می‌گیرد: اولین خرید کالای واقعی با بیت‌کوین.",
       "لازلۆ هانیێتس، پرۆگرامسازێک لە فلۆریدا، ١٠٬٠٠٠ بیتکۆین دەدات و دوو پیتزا وەردەگرێت: یەکەم کڕینی کاڵای ڕاستەقینە بە بیتکۆین.",
       "Laszlo Hanyecz, a programmer in Florida, pays 10,000 bitcoins for two pizzas: the first purchase of real goods with bitcoin."), "pizza"),
    ("2010-08-15", L("خطای ۱۸۴ میلیاردی", "هەڵەی ١٨٤ ملیاردی", "The 184-billion bug"),
     L("یک خطای سرریز عدد در بلاک ۷۴٬۶۳۸ حدود ۱۸۴ میلیارد بیت‌کوین از هیچ می‌سازد. ساتوشی و توسعه‌دهندگان ظرف چند ساعت وصله می‌دهند و زنجیره به مسیر درست برمی‌گردد. سقف ۲۱ میلیون سر جایش می‌ماند.",
       "هەڵەیەکی سەرڕێژبوونی ژمارە لە بلۆکی ٧٤٬٦٣٨دا نزیکەی ١٨٤ ملیارد بیتکۆین لە هیچەوە دروست دەکات. ساتۆشی و گەشەپێدەرەکان لە ماوەی چەند کاتژمێرێکدا چاکی دەکەن و زنجیرەکە دەگەڕێتەوە سەر ڕێگای دروست. سنووری ٢١ ملیۆن لە جێی خۆی دەمێنێتەوە.",
       "An integer overflow in block 74,638 creates about 184 billion bitcoins out of nothing. Satoshi and other developers ship a fix within hours and the chain returns to the valid path. The 21-million cap holds."), None),
    ("2010-12-12", L("آخرین پست", "دوایین پۆست", "The last post"),
     L("ساتوشی آخرین پیام عمومی‌اش را در انجمن BitcoinTalk می‌نویسد؛ دربارهٔ یک جزئیات فنی نرم‌افزار. بدون خداحافظی.",
       "ساتۆشی دوایین پەیامی گشتیی خۆی لە مەکۆی BitcoinTalk دەنووسێت؛ دەربارەی وردەکارییەکی تەکنیکیی نەرمەکاڵاکە. بێ ماڵئاوایی.",
       "Satoshi writes a last public message on the BitcoinTalk forum, about a technical detail of the software. No goodbye."), None),
    ("2011-04-23", L("کارهای دیگر", "کاری تر", "Other things"),
     L("در ایمیلی به یکی از توسعه‌دهندگان می‌نویسد که سراغ کارهای دیگری رفته و پروژه در دست‌های خوبی است. چند روز بعد آخرین ایمیل شناخته‌شده‌اش فرستاده می‌شود. از آن پس، سکوت.",
       "لە ئیمەیڵێکدا بۆ یەکێک لە گەشەپێدەرەکان دەنووسێت کە ڕووی لە کاری تر کردووە و پڕۆژەکە لە دەستی باشدایە. چەند ڕۆژێک دواتر دوایین ئیمەیڵی ناسراوی دەنێردرێت. دوای ئەوە، بێدەنگی.",
       "In an email to a developer, Satoshi says he has moved on to other things and that the project is in good hands. A few days later comes the last known email. Then, silence."), None),
    (None, L("آنچه مانده است", "ئەوەی ماوەتەوە", "What remains"),
     L("پژوهشگران برآورد می‌کنند ساتوشی در سال اول حدود یک میلیون بیت‌کوین استخراج کرده باشد. این سکه‌ها هرگز جابه‌جا نشده‌اند. اینکه او کیست، یا آن‌ها کیستند، هنوز معلوم نیست: هیچ ادعایی تا امروز با اثبات رمزنگاری همراه نبوده است.",
       "توێژەران مەزەندە دەکەن ساتۆشی لە ساڵی یەکەمدا نزیکەی یەک ملیۆن بیتکۆینی کانکاری کردبێت. ئەو دراوانە هەرگیز نەجووڵاون. ئەو کێیە، یان کێن، هێشتا نەزانراوە: هیچ بانگەشەیەک تا ئێستا بەڵگەی کریپتۆگرافیی لەگەڵ نەبووە.",
       "Researchers estimate that Satoshi mined around one million bitcoins in the first year. Those coins have never moved. Who he, she or they are is still unknown: no claim so far has come with cryptographic proof."), "legacy"),
]


def num(n, lg):
    s = str(n)
    if lg == "fa":
        return s.translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))
    if lg == "ckb":
        return s.translate(str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩"))
    return s


def date_h(iso, lg):
    y, m, d = (int(x) for x in iso.split("-"))
    if lg == "en":
        return f"{d} {MON['en'][m - 1]} {y}"
    if lg == "ckb":
        return f"{num(d, lg)}ی {MON['ckb'][m - 1]}ی {num(y, lg)}"
    return f"{num(d, lg)} {MON['fa'][m - 1]} {num(y, lg)}"


def art(kind, lg):
    if kind == "genesis":
        return (f"<div class='sx-art sx-hex'><code class='sx-msg' dir='ltr' data-msg='{e(GENESIS_MSG)}'>{e(GENESIS_MSG)}</code>"
                f"<p class='sx-src'>{e(T['msgsrc'][lg])}</p>"
                f"<button type='button' class='sx-btn' data-dec hidden data-a='{e(T['decode'][lg])}' data-b='{e(T['encode'][lg])}'>{e(T['decode'][lg])}</button></div>")
    if kind == "pizza":
        return (f"<div class='sx-art sx-kp'><div><small>{e(T['pizza'][lg])}</small><b dir='ltr' data-mul='10000'>—</b></div></div>"
                f"<p class='sx-src'>{e(T['livenote'][lg])}</p>")
    if kind == "legacy":
        return (f"<div class='sx-art sx-kp'><div><small>{e(T['mil'][lg])}</small><b dir='ltr' data-mul='1000000'>—</b></div>"
                f"<div><small>{e(T['days'][lg])}</small><b dir='ltr' data-days>—</b></div>"
                f"<div><small>{e(T['height'][lg])}</small><b dir='ltr' data-height>—</b></div></div>"
                f"<p class='sx-src'>{e(T['livenote'][lg])}</p>")
    return ""


# One exhibit per block: the thing itself (an address bar, nine sheets, a terminal, a transfer…), drawn in markup, always left-to-right.
PIZZA = ("<svg viewBox='0 0 60 60' aria-hidden='true'><circle cx='30' cy='30' r='27' fill='#c9772a'/><circle cx='30' cy='30' r='22' fill='#f2b24a'/>"
         "<g fill='#b5341f'><circle cx='22' cy='22' r='4'/><circle cx='38' cy='25' r='4'/><circle cx='27' cy='38' r='4'/><circle cx='40' cy='39' r='3.4'/><circle cx='18' cy='33' r='3'/></g>"
         "<g stroke='#c9772a' stroke-width='1.2'><path d='M30 8v44M8 30h44M14.5 14.5l31 31M45.5 14.5l-31 31'/></g></svg>")
EX = [
    "<div class='ex ex-url'><div class='ex-bar'><i></i><i></i><i></i><span>bitcoin.org</span></div><dl><dt>registered</dt><dd>2008-08-18</dd><dt>registrar</dt><dd>anonymousspeech.com</dd><dt>registrant</dt><dd><s>&nbsp;</s></dd></dl></div>",
    "<div class='ex ex-fall'><svg viewBox='0 0 300 120' preserveAspectRatio='none' aria-hidden='true'><path d='M0 22L28 26 52 20 80 34 104 30 128 46 150 42 172 64 196 58 218 86 244 80 268 104 300 110' fill='none' stroke='#ff5a4d' stroke-width='2.5' stroke-linejoin='round'/><path d='M0 22L28 26 52 20 80 34 104 30 128 46 150 42 172 64 196 58 218 86 244 80 268 104 300 110V120H0Z' fill='#ff5a4d' opacity='.12'/></svg><b>LEHMAN BROTHERS</b><span>15 Sep 2008 · $639B</span></div>",
    "<div class='ex ex-paper'><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><div><b>Bitcoin: A Peer-to-Peer Electronic Cash System</b><span>Satoshi Nakamoto</span><u></u><u></u><u></u><u></u><u></u></div><em>9 pages · 8 references</em></div>",
    f"<div class='ex ex-gen'><span>block 0</span><b>50 BTC</b><code>{GENESIS_HASH}</code></div>",
    "<div class='ex ex-term'><div class='ex-bar'><i></i><i></i><i></i><span>bitcoin v0.1.0</span></div><p>2009-01-09 &nbsp; release</p><p class='tw'><b>@halfin</b> · 11 Jan 2009<br><q>Running bitcoin</q></p></div>",
    "<div class='ex ex-tx'><span class='n'>Satoshi</span><span class='w'><i></i><b>10 BTC</b></span><span class='n'>Hal Finney</span><em>block 170 · 2009-01-12</em></div>",
    "<div class='ex ex-rate'><span>New Liberty Standard · 2009-10-05</span><b>$1 = 1,309.03 BTC</b><em>1 BTC ≈ $0.00076</em></div>",
    f"<div class='ex ex-pizza'>{PIZZA}{PIZZA}<b>10,000 BTC</b></div>",
    "<div class='ex ex-bug'><span>block 74,638</span><b><s>184,467,440,737.09551616 BTC</s></b><em>21,000,000</em></div>",
    "<div class='ex ex-post'><div class='ex-bar'><i></i><i></i><i></i><span>bitcointalk.org</span></div><p><b>satoshi</b> · December 12, 2010</p><u></u><u></u><u class='h'></u><i class='cur'></i></div>",
    "<div class='ex ex-mail'><dl><dt>from</dt><dd>satoshi</dd><dt>date</dt><dd>23 Apr 2011</dd><dt>last</dt><dd>26 Apr 2011</dd></dl><u></u><u></u><u class='h'></u></div>",
    "<div class='ex ex-vault'><i></i><b>≈ 1,000,000 BTC</b><span>1 dot = 1,000 BTC</span></div>",
]

T.update({
    "alt": L("تصویر هنری: پیکری کلاه‌دار و بی‌چهره پشت سکهٔ بیت‌کوین", "وێنەی هونەری: پەیکەرێکی کڵاودار و بێ‌ڕوخسار لە پشت دراوی بیتکۆین", "Artwork: a hooded, faceless figure behind a Bitcoin coin"),
    "story": L("داستان، در دوازده بلاک", "چیرۆکەکە، لە دوازدە بلۆکدا", "The story, in twelve blocks"),
    "hint": L("با کلیدهای جهت یا زنجیرهٔ پایین، بلاک‌به‌بلاک جلو بروید.", "بە کلیلەکانی ئاراستە یان زنجیرەی خوارەوە، بلۆک بە بلۆک بڕۆ پێش.", "Walk it block by block with the arrow keys or the chain below."),
    "now": L("بیت‌کوین، همین حالا", "بیتکۆین، هەر ئێستا", "Bitcoin, right now"),
    "nowl": L("آنچه ساتوشی راه انداخت هنوز حدوداً هر ده دقیقه یک بلاک می‌سازد. این اعداد مستقیم از خودِ شبکه خوانده می‌شوند و جلوی چشم شما عوض می‌شوند. روی بلاک‌های در صف بزنید تا تک‌تک تراکنش‌هایش را زنده ببینید؛ هر تراکنش یا آدرسی را هم می‌توانید جست‌وجو کنید.",
              "ئەوەی ساتۆشی دەستی پێکرد هێشتا نزیکەی هەر دە خولەک بلۆکێک دروست دەکات. ئەم ژمارانە ڕاستەوخۆ لە خودی تۆڕەکەوە دەخوێنرێنەوە و لەبەرچاوت دەگۆڕێن. بلۆکە چاوەڕوانەکان دابگرە بۆ ئەوەی هەموو مامەڵەکانی بە زیندوویی ببینیت؛ دەتوانیت بەدوای هەر مامەڵە یان ناونیشانێکیشدا بگەڕێیت.",
              "What Satoshi started still makes a block about every ten minutes. These numbers are read straight from the network and change as you watch. Tap a waiting block to watch every one of its transactions live, or look up any transaction or address."),
})
CHIPS = L([("۲۰۰۸", "مقالهٔ نُه‌صفحه‌ای"), ("۲۰۰۹", "بلاک صفر"), ("۲۰۱۱", "آخرین پیام"), ("≈ ۱ میلیون", "بیت‌کوینِ دست‌نخورده")],
          [("٢٠٠٨", "توێژینەوەی نۆ لاپەڕەیی"), ("٢٠٠٩", "بلۆکی سفر"), ("٢٠١١", "دوایین پەیام"), ("≈ ١ ملیۆن", "بیتکۆینی دەستلێنەدراو")],
          [("2008", "the nine-page paper"), ("2009", "block zero"), ("2011", "the last message"), ("≈ 1 million", "bitcoins never moved")])

CSS = """
main.w{max-width:none;padding:0}
.sx{--or:#f7931a;--gold:#ffd27a;--ln:rgba(255,255,255,.1);position:relative;isolation:isolate;color:#fff;background:#000;overflow:hidden;padding-bottom:34px}
.sx *{box-sizing:border-box}
.sx-w{max-width:1240px;margin-inline:auto;padding-inline:20px}
.sx h2.sx-h{margin:0;padding:0;border:0;font:900 clamp(1.5rem,3.2vw,2.5rem)/1.3 Vazirmatn,'Space Grotesk',sans-serif;color:#fff}
html[lang=en] .sx h2.sx-h,html[lang=en] .sx h1{font-family:'Space Grotesk',Vazirmatn,sans-serif;font-weight:700;letter-spacing:-.02em}
.sx-sub{margin:6px 0 0;max-width:70ch;font-size:.95rem;line-height:1.9;color:rgba(255,255,255,.62)}
.sx :focus-visible{outline:2px solid var(--gold);outline-offset:3px;border-radius:8px}
/* ---- the picture: the user's own artwork, alive but never explicit */
.sx-art0{position:relative;overflow:hidden;height:clamp(280px,74vh,820px);background:#000}
.sx-pic{position:absolute;top:0;left:50%;height:100%;aspect-ratio:16/9;translate:-50% 0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent);mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent)}
.sx-pic img{position:absolute;inset:0;width:100%;height:100%;display:block;scale:1.04;translate:calc(var(--px,0)*-14px) calc(var(--py,0)*-9px);transition:translate .6s cubic-bezier(.2,.8,.2,1);animation:sx-breathe 18s ease-in-out infinite alternate}
@keyframes sx-breathe{to{scale:1.09}}
.sx-g{position:absolute;border-radius:50%;pointer-events:none;mix-blend-mode:screen;translate:-50% -50%}
.sx-g.e1,.sx-g.e2{top:28.9%;width:5.2%;aspect-ratio:1.5;background:radial-gradient(closest-side,rgba(255,196,84,.95),rgba(247,147,26,.4) 55%,transparent);animation:sx-eye 7s steps(1,end) infinite}
.sx-g.e1{left:49.7%}.sx-g.e2{left:59.1%;animation-delay:.12s}
@keyframes sx-eye{0%,100%{opacity:.25}6%{opacity:1}8%{opacity:.2}10%{opacity:.9}34%{opacity:.5}36%{opacity:1}60%{opacity:.35}82%{opacity:.95}84%{opacity:.15}86%{opacity:.8}}
.sx-g.c{left:52.6%;top:67.6%;width:27%;aspect-ratio:1;background:radial-gradient(closest-side,rgba(255,170,60,.5),rgba(247,147,26,.14) 60%,transparent);animation:sx-pulse 5.5s ease-in-out infinite}
@keyframes sx-pulse{50%{opacity:.35;scale:1.12}}
.sx-g.h{left:54.5%;top:24%;width:30%;aspect-ratio:1;mix-blend-mode:multiply;background:radial-gradient(closest-side,rgba(0,0,0,.75),transparent);animation:sx-hood 9s ease-in-out infinite}
@keyframes sx-hood{50%{opacity:.25}}
.sx-emb{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.sx-art0::after{content:"";position:absolute;inset:auto 0 0 0;height:38%;background:linear-gradient(transparent,#000 92%);pointer-events:none}
.sx-head{position:relative;z-index:2;margin-top:-72px}
.sx-hc{padding:22px 26px 24px;border-radius:26px;border:1px solid var(--ln);background:linear-gradient(155deg,rgba(255,255,255,.085),rgba(255,255,255,.02) 46%,rgba(255,255,255,.045)),rgba(6,6,8,.82);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 30px 80px rgba(0,0,0,.6)}
.sx .meta{font-size:.8rem;color:rgba(255,255,255,.55)}.sx .meta a{color:var(--gold)}
.sx h1{margin:.35em 0 .25em;max-width:40ch;font:900 clamp(1.6rem,3.6vw,2.9rem)/1.28 Vazirmatn,'Space Grotesk',sans-serif;color:#fff;text-wrap:balance;animation:sx-title 1.4s cubic-bezier(.2,.7,.1,1) both}
@keyframes sx-title{from{opacity:0;filter:blur(14px);translate:0 14px}}
.sx-lead{max-width:76ch;margin:0;font-size:1rem;line-height:1.95;color:rgba(255,255,255,.72)}
.sx-chips{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;padding:0;list-style:none}
.sx-chips li{display:flex;align-items:baseline;gap:8px;padding:7px 14px;border-radius:13px;border:1px solid var(--ln);background:rgba(255,255,255,.035);font-size:.82rem;color:rgba(255,255,255,.7)}
.sx-chips b{font:700 1rem 'Space Grotesk',Vazirmatn,sans-serif;color:var(--gold)}
/* ---- the story */
.sx-story{margin-top:46px}
.sx-chain{list-style:none;margin:20px 0 0;padding:0;min-width:0}
.sx-b{position:relative;display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:22px;align-items:stretch;margin:0 0 18px;padding:18px;border-radius:26px;border:1px solid var(--ln);
  background:linear-gradient(155deg,rgba(255,255,255,.07),rgba(255,255,255,.012) 48%,rgba(255,255,255,.035)),#050506;box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.sx-tx{display:flex;flex-direction:column;justify-content:center;min-width:0;padding:8px 10px}
.sx-hd{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:.84rem;color:rgba(255,255,255,.62)}
.sx-n{padding:3px 12px;border-radius:99px;background:rgba(247,147,26,.15);color:var(--gold);font-weight:800}
.sx-b time{font-family:'Space Grotesk',Vazirmatn,sans-serif;font-weight:600}
.sx-b h3{margin:.45em 0 .3em;padding:0;border:0;font:900 clamp(1.5rem,3.1vw,2.5rem)/1.3 Vazirmatn,'Space Grotesk',sans-serif;color:#fff}
html[lang=en] .sx-b h3{font-family:'Space Grotesk',Vazirmatn,sans-serif;font-weight:700;letter-spacing:-.015em}
.sx-tx>p{max-width:58ch;margin:0;font-size:1.02rem;line-height:2.05;color:rgba(255,255,255,.84)}
.sx-art{margin-top:14px}
.sx-hex{padding:12px 14px;border-radius:14px;border:1px solid rgba(247,147,26,.3);background:rgba(0,0,0,.55)}
.sx-msg{display:block;min-height:3.4em;font:500 .84rem/1.8 'Space Grotesk',ui-monospace,monospace;color:var(--gold);word-break:break-word;white-space:pre-wrap;background:none;padding:0;border:0}
.sx-msg.hex{color:rgba(255,255,255,.62);word-break:break-all}
.sx-src{margin:8px 0 0;font-size:.76rem;line-height:1.8;color:rgba(255,255,255,.5)}
.sx-btn{margin-top:10px;height:40px;padding:0 16px;border-radius:12px;border:0;background:linear-gradient(100deg,#fff1c9,#ffd27a 24%,#f7931a 60%,#a65a07);color:#000;font:800 .84rem Vazirmatn,sans-serif;cursor:pointer}
.sx-kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.sx-kp div{padding:11px 13px;border-radius:14px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08)}
.sx-kp small{display:block;font-size:.72rem;color:rgba(255,255,255,.56)}
.sx-kp b{display:block;margin-top:3px;font:700 1.2rem 'Space Grotesk',Vazirmatn,sans-serif;color:var(--gold);font-variant-numeric:tabular-nums;text-align:start}
/* exhibits */
.ex{position:relative;display:grid;place-content:center;justify-items:center;gap:10px;min-height:300px;padding:26px;border-radius:18px;overflow:hidden;direction:ltr;text-align:center;color:#fff;
  font-family:'Space Grotesk',ui-monospace,monospace;border:1px solid rgba(255,210,122,.2);
  background:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px) 0 0/100% 25%,linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px) 0 0/25% 100%,radial-gradient(110% 80% at 50% 0%,rgba(247,147,26,.13),transparent 62%),#030304}
.ex b{font-weight:700}.ex em{font-style:normal;color:rgba(255,255,255,.55);font-size:.82rem}.ex span{color:rgba(255,255,255,.6);font-size:.82rem}
.ex-bar{display:flex;align-items:center;gap:6px;width:100%;padding:9px 12px;border-radius:12px 12px 0 0;background:rgba(255,255,255,.07)}
.ex-bar i{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.22)}
.ex-bar span{flex:1;margin-inline-start:8px;padding:3px 12px;border-radius:8px;background:rgba(0,0,0,.5);color:var(--gold);font-size:.86rem;text-align:start}
.ex dl{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:0;width:100%;padding:14px 16px;text-align:start;font-size:.86rem;border:1px solid rgba(255,255,255,.1);border-top:0;border-radius:0 0 12px 12px}
.ex dt{color:rgba(255,255,255,.45)}.ex dd{margin:0;color:#fff}
.ex dd s{display:inline-block;width:9.5em;height:1em;vertical-align:-.15em;border-radius:3px;background:repeating-linear-gradient(90deg,#fff 0 6px,transparent 6px 8px);opacity:.75;text-decoration:none}
.ex-url,.ex-term,.ex-post{gap:0;place-content:center stretch;justify-items:stretch}
.ex-mail dl{border-top:1px solid rgba(255,255,255,.1);border-radius:12px}
.ex-fall svg{position:absolute;inset:18% 0 0 0;width:100%;height:82%}
.ex-fall b{position:relative;font-size:clamp(1.3rem,2.6vw,2rem);letter-spacing:.04em}.ex-fall span{position:relative}
.ex-paper{place-content:center}
.ex-paper>i,.ex-paper>div{grid-area:1/1;width:188px;height:236px;border-radius:5px;background:#f3ecdd;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.ex-paper>i:nth-child(1){transform:translate(28px,22px) rotate(7deg);opacity:.35}.ex-paper>i:nth-child(2){transform:translate(24px,19px) rotate(6deg);opacity:.4}.ex-paper>i:nth-child(3){transform:translate(20px,16px) rotate(5deg);opacity:.48}
.ex-paper>i:nth-child(4){transform:translate(16px,13px) rotate(4deg);opacity:.56}.ex-paper>i:nth-child(5){transform:translate(12px,10px) rotate(3deg);opacity:.64}.ex-paper>i:nth-child(6){transform:translate(8px,7px) rotate(2deg);opacity:.74}
.ex-paper>i:nth-child(7){transform:translate(5px,4px) rotate(1.2deg);opacity:.84}.ex-paper>i:nth-child(8){transform:translate(2px,2px) rotate(.5deg);opacity:.92}
.ex-paper>div{position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;padding:22px 16px;color:#1a1408}
.ex-paper>div b{font:700 .72rem/1.35 Georgia,serif}.ex-paper>div span{font:400 .6rem Georgia,serif;color:#5b4a2a;margin-bottom:6px}
.ex-paper u{display:block;width:100%;height:5px;border-radius:2px;background:#cbbf9f;text-decoration:none}.ex-paper u:nth-of-type(3){width:86%}.ex-paper u:nth-of-type(5){width:62%}
.ex-paper em{grid-area:2/1}
.ex-gen b{font-size:clamp(2rem,4.6vw,3.4rem);color:var(--gold);line-height:1}
.ex-gen code{max-width:26ch;font:500 .74rem/1.7 'Space Grotesk',ui-monospace,monospace;color:rgba(255,255,255,.7);word-break:break-all;background:none;border:0;padding:0}
.ex-term p{margin:0;padding:12px 16px;text-align:start;font-size:.86rem;color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.1);border-top:0}
.ex-term p.tw{border-radius:0 0 12px 12px;color:rgba(255,255,255,.6)}.ex-term p.tw b{color:var(--gold)}
.ex-term q{display:block;margin-top:4px;font-size:1.5rem;font-weight:700;color:#fff;quotes:none}
.ex-term q::after{content:"";display:inline-block;width:.5em;height:1em;margin-inline-start:6px;vertical-align:-.12em;background:var(--or);animation:sx-cur 1s steps(1) infinite}
@keyframes sx-cur{50%{opacity:0}}
.ex-tx{grid-template-columns:auto minmax(60px,1fr) auto;align-items:center;column-gap:12px;width:100%}
.ex-tx .n{padding:10px 14px;border-radius:12px;border:1px solid rgba(255,210,122,.4);color:#fff;font-size:.9rem;font-weight:700;background:rgba(247,147,26,.08)}
.ex-tx .w{position:relative;height:36px;display:grid;place-items:center}
.ex-tx .w::before{content:"";position:absolute;inset:50% 0 auto 0;height:2px;background:linear-gradient(90deg,rgba(247,147,26,.2),var(--or))}
.ex-tx .w i{position:absolute;top:50%;left:0;width:12px;height:12px;margin:-6px;border-radius:50%;background:var(--gold);box-shadow:0 0 14px var(--or);animation:sx-send 2.6s cubic-bezier(.6,0,.3,1) infinite}
@keyframes sx-send{0%{left:0;opacity:0}12%{opacity:1}88%{opacity:1}100%{left:100%;opacity:0}}
.ex-tx .w b{position:relative;top:-16px;font-size:.84rem;color:var(--gold)}
.ex-tx em{grid-column:1/-1}
.ex-rate b{font-size:clamp(1.5rem,3.4vw,2.6rem);color:var(--gold)}
.ex-pizza{grid-template-columns:auto auto;column-gap:16px}
.ex-pizza svg{width:clamp(84px,11vw,128px);height:auto;filter:drop-shadow(0 10px 18px rgba(0,0,0,.6))}
.ex-pizza svg+svg{transform:rotate(24deg)}
.ex-pizza b{grid-column:1/-1;font-size:clamp(1.4rem,3vw,2.2rem);color:var(--gold)}
.ex-bug b{font-size:clamp(1rem,2.2vw,1.55rem);color:#ff5a4d}.ex-bug b s{text-decoration-thickness:2px}
.ex-bug em{font-size:clamp(1.6rem,3.6vw,2.8rem);font-weight:700;color:var(--gold)}
.ex-post p{margin:0;padding:12px 16px 4px;text-align:start;font-size:.84rem;color:rgba(255,255,255,.6);border-inline:1px solid rgba(255,255,255,.1)}.ex-post p b{color:var(--gold)}
.ex-post u,.ex-mail u{display:block;height:7px;margin:8px 16px 0;border-radius:3px;background:rgba(255,255,255,.14);text-decoration:none}.ex-post u.h,.ex-mail u.h{width:42%}
.ex-post .cur{display:block;width:9px;height:16px;margin:10px 16px 14px;background:rgba(255,255,255,.5);animation:sx-stop 6s steps(1) infinite}
@keyframes sx-stop{0%,10%,20%,30%{opacity:1}5%,15%,25%{opacity:0}40%,100%{opacity:.12}}
.ex-mail{place-content:center stretch;justify-items:stretch;gap:0}
.ex-vault i{width:min(100%,300px);aspect-ratio:40/25;background:radial-gradient(circle,var(--gold) 0 26%,transparent 30%) 0 0/2.5% 4%;opacity:.85;animation:sx-shim 5s ease-in-out infinite}
@keyframes sx-shim{50%{opacity:.5}}
.ex-vault b{font-size:clamp(1.4rem,3vw,2.2rem);color:var(--gold)}
.sx-nav{display:none}
.sx-facts{margin-top:40px}
.sx-fl{list-style:none;margin:16px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.sx-fl li{padding:16px 18px;border-radius:18px;border:1px solid var(--ln);background:rgba(255,255,255,.03);font-size:.94rem;line-height:1.95;color:rgba(255,255,255,.82)}
.sx-fl b{display:block;margin-bottom:4px;font-size:.78rem;color:var(--or)}
.sx-note{margin-top:22px;max-width:86ch;font-size:.8rem;line-height:1.9;color:rgba(255,255,255,.5)}
@media (min-width:900px){
  .sx-js .sx-chain{display:grid}
  .sx-js .sx-b{grid-area:1/1;margin:0;visibility:hidden;opacity:0;transform:translateY(18px);transition:opacity .45s,transform .55s cubic-bezier(.2,.8,.2,1),visibility 0s .45s}
  .sx-js .sx-b.on{visibility:visible;opacity:1;transform:none;transition:opacity .45s .08s,transform .55s cubic-bezier(.2,.8,.2,1) .08s}
  .sx-js .sx-nav{display:flex;align-items:center;gap:14px;margin-top:14px;padding:9px 12px;border-radius:20px;border:1px solid var(--ln);background:rgba(10,10,12,.8)}
  .sx-nav button.sx-ar{flex:0 0 auto;width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#fff;cursor:pointer;display:grid;place-items:center}
  .sx-nav button.sx-ar:hover{border-color:var(--or)}.sx-nav button.sx-ar:disabled{opacity:.35;cursor:default}
  .sx-nav button.sx-ar svg{width:18px;height:18px}
  [dir=rtl] .sx-nav .sx-ar[data-go="-1"] svg,[dir=ltr] .sx-nav .sx-ar[data-go="1"] svg{transform:scaleX(-1)}
  .sx-ticks{flex:1 1 auto;display:flex;align-items:center;min-width:0}
  .sx-ticks button{position:relative;flex:1 1 0;height:44px;min-width:0;border:0;background:none;cursor:pointer;padding:0}
  .sx-ticks button::before{content:"";position:absolute;inset-inline:0;top:50%;height:2px;margin-top:-1px;background:rgba(255,255,255,.14)}
  .sx-ticks button:first-child::before{inset-inline-start:50%}.sx-ticks button:last-child::before{inset-inline-end:50%}
  .sx-ticks button::after{content:"";position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:4px;background:#000;border:2px solid rgba(255,255,255,.35);transition:transform .25s,background .25s,border-color .25s}
  .sx-ticks button.done::before{background:var(--or)}.sx-ticks button.done::after{border-color:var(--or)}
  .sx-ticks button.on::after{background:var(--or);border-color:var(--gold);transform:scale(1.45) rotate(45deg);box-shadow:0 0 18px rgba(247,147,26,.8)}
  .sx-ticks button:hover::after{border-color:var(--gold)}
  .sx-pos{flex:0 0 auto;min-width:5.5ch;text-align:center;font:700 .84rem 'Space Grotesk',Vazirmatn,sans-serif;color:rgba(255,255,255,.7)}
}
@media (max-width:899px){
  .sx-art0{height:clamp(260px,58vh,520px)}
  .sx-head{margin-top:-70px}.sx-hc{padding:18px 18px 20px;border-radius:22px}
  .sx-b{grid-template-columns:minmax(0,1fr);gap:12px;padding:12px;border-radius:22px}
  .ex{min-height:210px;padding:18px}
  .sx-tx{padding:4px 6px 8px}
}
/* ---- Bitcoin, right now */
.bx{margin-top:54px}
.bx-st{display:inline-flex;align-items:center;gap:7px;margin-top:10px;padding:5px 12px;border-radius:99px;border:1px solid var(--ln);font-size:.76rem;color:rgba(255,255,255,.65)}
.bx-st i{width:7px;height:7px;border-radius:50%;background:#77777d}.bx-st.live i{background:#34d399;animation:bx-ping 2.2s infinite}.bx-st.snap i{background:var(--gold)}
@keyframes bx-ping{0%{box-shadow:0 0 0 0 rgba(52,211,153,.55)}70%,100%{box-shadow:0 0 0 7px rgba(52,211,153,0)}}
.bx-hud{position:relative;margin-top:18px;min-height:520px;border-radius:26px;border:1px solid var(--ln);overflow:hidden;
  background:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px) 0 0/100% 25%,linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px) 0 0/16.666% 100%,radial-gradient(46% 60% at 50% 46%,rgba(247,147,26,.2),transparent 70%),#020203}
.bx-core{position:absolute;left:50%;top:50%;width:min(46%,430px);aspect-ratio:1.3;translate:-50% -50%}
.bx-core canvas{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .6s}
.bx-core.gl canvas{opacity:1}
.bx-core img{position:absolute;left:50%;top:50%;height:70%;aspect-ratio:1;translate:-50% -50%;transition:opacity .5s}
.bx-core.gl img{opacity:0}
.bx-ln{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.bx-ln path{fill:none;stroke:rgba(255,255,255,.5);stroke-width:1}.bx-ln rect{fill:none;stroke:#fff;stroke-width:1}
.bx-co{position:absolute;width:min(27%,290px);direction:ltr;text-align:start}
[dir=rtl] .bx-co{direction:rtl}
.bx-co.l{left:3.2%}.bx-co.r{right:3.2%}
.bx-co.y1{top:9%}.bx-co.y2{top:39%}.bx-co.y3{top:69%}
.bx-lb{display:block;font-size:.78rem;color:rgba(255,255,255,.66)}
.bx-lb::before{content:"[ "}.bx-lb::after{content:" ]"}
.bx-co b{display:block;margin-top:4px;direction:ltr;unicode-bidi:isolate;font:700 clamp(1.25rem,2.5vw,2.05rem)/1.15 'Space Grotesk',Vazirmatn,sans-serif;font-variant-numeric:tabular-nums;color:#fff}
[dir=rtl] .bx-co b{text-align:right}
.bx-co small{display:block;margin-top:4px;font-size:.78rem;line-height:1.6;color:rgba(255,255,255,.55)}
.bx-co small bdi{color:var(--gold);font-family:'Space Grotesk',Vazirmatn,sans-serif}
/* blocks: waiting on one side of "now", mined on the other */
/* the way back: search, slider from now to block zero, milestones */
.bx-tm{margin-top:26px;padding:16px 18px 14px;border-radius:22px;border:1px solid var(--ln);background:linear-gradient(155deg,rgba(255,255,255,.065),rgba(255,255,255,.012) 48%,rgba(255,255,255,.03)),#050506}
.bx-find{display:flex;gap:8px}
.bx-find input{flex:1 1 auto;min-width:0;height:46px;padding:0 16px;border-radius:99px;border:1px solid rgba(255,210,122,.3);background:rgba(0,0,0,.55);color:#fff;font:500 .92rem Vazirmatn,'Space Grotesk',sans-serif;outline:0;transition:border-color .2s,box-shadow .2s}
.bx-find input::placeholder{color:rgba(255,255,255,.42)}
.bx-find input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(247,147,26,.22)}
.bx-find button{flex:0 0 auto;height:46px;padding:0 24px;border:0;border-radius:99px;cursor:pointer;font:800 .92rem Vazirmatn,sans-serif;color:#1a0f00;background:linear-gradient(180deg,#ffd27a,#f7931a)}
.bx-tm.busy .bx-find button{opacity:.6;pointer-events:none}
.bx-sl{display:flex;align-items:flex-end;gap:12px;margin-top:14px;direction:ltr}
.bx-sl>button,.bx-marks button{flex:0 0 auto;padding:7px 13px;border-radius:99px;border:1px solid var(--ln);background:rgba(255,255,255,.04);color:rgba(255,255,255,.82);cursor:pointer;font:700 .76rem Vazirmatn,sans-serif;white-space:nowrap;transition:border-color .2s,color .2s,background .2s}
.bx-sl>button:hover,.bx-marks button:hover{border-color:rgba(255,210,122,.6);color:#fff}
.bx-sl>button.on,.bx-marks button.on{border-color:var(--gold);color:var(--gold);background:rgba(247,147,26,.12)}
.bx-rg{flex:1 1 auto;min-width:0}
.bx-rd{display:block;margin-bottom:6px;text-align:center;font:700 .86rem Vazirmatn,'Space Grotesk',sans-serif;color:var(--gold);font-variant-numeric:tabular-nums}
[dir=rtl] .bx-rd{direction:rtl}
.bx-rd bdi{font-family:'Space Grotesk',Vazirmatn,sans-serif}
.bx-rg input{display:block;width:100%;height:22px;margin:0;background:none;cursor:pointer;-webkit-appearance:none;appearance:none}
.bx-rg input::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:linear-gradient(90deg,#ffd27a,#f7931a 35%,#6b3a04)}
.bx-rg input::-moz-range-track{height:6px;border-radius:3px;background:linear-gradient(90deg,#ffd27a,#f7931a 35%,#6b3a04)}
.bx-rg input::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;margin-top:-8px;border-radius:5px;border:2px solid #fff;background:linear-gradient(135deg,#ffd27a,#f7931a);box-shadow:0 0 14px rgba(247,147,26,.8);rotate:45deg}
.bx-rg input::-moz-range-thumb{width:18px;height:18px;border-radius:5px;border:2px solid #fff;background:linear-gradient(135deg,#ffd27a,#f7931a);box-shadow:0 0 14px rgba(247,147,26,.8);rotate:45deg}
.bx-marks{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}
.bx-marks button{display:inline-flex;align-items:center;gap:6px}
.bx-marks button b{font-family:'Space Grotesk',Vazirmatn,sans-serif;color:var(--gold);direction:ltr;unicode-bidi:isolate}
.bx-msg{min-height:1.5em;margin:10px 2px 0;font-size:.8rem;line-height:1.7;color:var(--gold)}
.bx-msg:empty{display:none}
.bx-tm.busy .bx-rd::after{content:"";display:inline-block;width:11px;height:11px;margin-inline-start:8px;vertical-align:-1px;border-radius:50%;border:2px solid rgba(255,210,122,.3);border-top-color:var(--gold);animation:bx-spin .7s linear infinite}
@keyframes bx-spin{to{rotate:360deg}}
/* the blocks: real cubes, three faces each; a face is painted as high as the block was full */
.bx-belt{position:relative;display:flex;align-items:flex-end;gap:0;margin-top:14px;padding:30px 0 10px;overflow-x:auto;scrollbar-width:thin;direction:ltr;scrollbar-color:#3a3a40 transparent}
.bx-q,.bx-m{display:flex;gap:22px;padding-inline:22px}
.bx-q{flex-direction:row-reverse;margin-inline-start:auto}
.bx-belt.hist .bx-q,.bx-belt.hist .bx-now{display:none}
.bx-now{flex:0 0 auto;align-self:stretch;position:relative;width:2px;margin-inline:6px;background:repeating-linear-gradient(var(--gold) 0 6px,transparent 6px 12px)}
.bx-now span{position:absolute;top:-24px;left:50%;translate:-50% 0;white-space:nowrap;font:700 .72rem Vazirmatn,sans-serif;color:var(--gold)}
.bx-b{--s:124px;position:relative;flex:0 0 auto;width:var(--s);height:var(--s);margin:22px 16px 60px;padding:0;border:0;background:none;cursor:pointer;color:#fff;font-family:'Space Grotesk',Vazirmatn,sans-serif;perspective:820px}
.bx-b::after{content:"";position:absolute;inset:auto -14% -22px -14%;height:26px;border-radius:50%;background:radial-gradient(closest-side,rgba(247,147,26,.5),rgba(247,147,26,.12) 60%,transparent);filter:blur(5px);pointer-events:none;transition:opacity .35s,scale .35s}
.bx-m .bx-b+.bx-b::before{content:"";position:absolute;top:50%;left:-40px;width:26px;height:2px;background:linear-gradient(90deg,rgba(255,210,122,.75),rgba(255,210,122,.15));pointer-events:none}
.bx-c{position:absolute;inset:0;display:block;transform-style:preserve-3d;transform:rotateX(-13deg) rotateY(24deg);transition:transform .45s cubic-bezier(.2,.8,.2,1)}
.bx-c>*{position:absolute;inset:0;display:block;backface-visibility:hidden;border-radius:4px}
.bx-c .ft{overflow:hidden;line-height:1.25;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:8px 6px;transform:translateZ(calc(var(--s)/2));text-shadow:0 1px 3px rgba(0,0,0,.65);
  background:repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 15.5px),repeating-linear-gradient(0deg,rgba(0,0,0,.09) 0 1px,transparent 1px 15.5px),
    linear-gradient(0deg,transparent var(--fill,100%),rgba(14,9,3,.86) var(--fill,100%)),linear-gradient(165deg,#ffb955,#f7931a 48%,#bf6607);
  box-shadow:inset 0 0 0 1px rgba(255,226,170,.5),inset 0 0 26px rgba(255,200,110,.22)}
.bx-c .sd{transform:rotateY(-90deg) translateZ(calc(var(--s)/2));
  background:linear-gradient(0deg,transparent var(--fill,100%),rgba(8,5,2,.9) var(--fill,100%)),linear-gradient(180deg,#a55a07,#5e3203);box-shadow:inset 0 0 0 1px rgba(255,200,120,.28)}
.bx-c .tp{transform:rotateX(90deg) translateZ(calc(var(--s)/2));background:repeating-linear-gradient(90deg,rgba(255,255,255,.14) 0 1px,transparent 1px 15.5px),linear-gradient(135deg,#ffe2a6,#f2a233);box-shadow:inset 0 0 0 1px rgba(255,240,200,.6)}
.bx-b.lo .tp{background:linear-gradient(135deg,rgba(255,226,166,.2),rgba(242,162,51,.07));box-shadow:inset 0 0 0 1px rgba(255,226,166,.55)}
.bx-b:hover .bx-c,.bx-b:focus-visible .bx-c{transform:translateY(-9px) rotateX(-18deg) rotateY(36deg)}
.bx-b.sel .bx-c{transform:translateY(-12px) rotateX(-13deg) rotateY(24deg)}
.bx-b.sel .bx-c>*{box-shadow:inset 0 0 0 2px #fff,inset 0 0 26px rgba(255,255,255,.25)}
.bx-b:hover::after,.bx-b.sel::after{opacity:.6;scale:.84}
.bx-b .f{font-size:.92rem;font-weight:700}.bx-b .r{font-size:.66rem;opacity:.9}.bx-b .ft b{font-size:1.02rem;margin-top:2px}.bx-b .x{font-size:.72rem}.bx-b .a{font-size:.66rem;opacity:.92;margin-top:2px}
.bx-b em{position:absolute;inset:auto -12px -40px -12px;font-style:normal;font-size:.82rem;font-weight:700;color:var(--gold);text-align:center;white-space:nowrap}
.bx-b cite{position:absolute;inset:auto -16px -56px -16px;font-style:normal;font-size:.64rem;color:rgba(255,255,255,.5);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* waiting blocks: glass, hovering */
.bx-b.q{cursor:pointer}
.bx-b.q.on .bx-c>*{box-shadow:inset 0 0 0 2px #fff,inset 0 0 26px rgba(255,255,255,.22)}.bx-b.q.on::after{opacity:.8}
.bx-b.q .ft{background:linear-gradient(0deg,rgba(247,147,26,.42) var(--fill,50%),rgba(255,255,255,.05) var(--fill,50%));box-shadow:inset 0 0 0 1px rgba(255,210,122,.55),inset 0 0 22px rgba(247,147,26,.18)}
.bx-b.q .sd{background:linear-gradient(0deg,rgba(166,90,7,.5) var(--fill,50%),rgba(255,255,255,.03) var(--fill,50%));box-shadow:inset 0 0 0 1px rgba(255,210,122,.35)}
.bx-b.q .tp{background:rgba(255,226,166,.1);box-shadow:inset 0 0 0 1px rgba(255,210,122,.5)}
.bx-b.q::after{opacity:.45}
.bx-b.q .bx-c{animation:bx-bob 4.6s ease-in-out infinite}.bx-b.q:nth-child(2) .bx-c{animation-delay:-1.5s}.bx-b.q:nth-child(3) .bx-c{animation-delay:-3s}
@keyframes bx-bob{50%{transform:translateY(-7px) rotateX(-13deg) rotateY(24deg)}}
/* block zero: gold */
.bx-b.gen .ft{color:#231400;text-shadow:none;background:repeating-linear-gradient(90deg,rgba(255,255,255,.16) 0 1px,transparent 1px 15.5px),linear-gradient(165deg,#fff3c9,#ffd27a 45%,#c08a17);box-shadow:inset 0 0 0 1px #fff6d8,inset 0 0 30px rgba(255,255,255,.4)}
.bx-b.gen .sd{background:linear-gradient(180deg,#c08a17,#7a5406)}.bx-b.gen .tp{background:linear-gradient(135deg,#fffbe8,#ffd27a)}
.bx-b.gen::after{background:radial-gradient(closest-side,rgba(255,226,140,.8),rgba(255,210,122,.2) 60%,transparent)}
/* the door to older blocks */
.bx-b.more .ft{background:rgba(255,255,255,.03);box-shadow:inset 0 0 0 1px rgba(255,210,122,.5)}
.bx-b.more .sd,.bx-b.more .tp{background:rgba(255,255,255,.02);box-shadow:inset 0 0 0 1px rgba(255,210,122,.3)}
.bx-b.more .ft b{font-size:2.2rem;line-height:1;color:var(--gold)}.bx-b.more .a{font:700 .72rem Vazirmatn,sans-serif;color:var(--gold);opacity:1}
.bx-b.more::after{opacity:.3}
.bx-tm.busy+.bx-belt .bx-b.more .bx-c{animation:bx-bob 1s ease-in-out infinite}
.bx-b.new{animation:bx-new 1.2s cubic-bezier(.2,.8,.2,1)}
@keyframes bx-new{from{translate:-140px 0;opacity:0}}
.bx-det{margin-top:6px;padding:14px 16px;border-radius:18px;border:1px solid rgba(255,210,122,.25);background:rgba(255,255,255,.03)}
.bx-det h4{margin:0 0 10px;font:800 1rem Vazirmatn,sans-serif;color:#fff}
.bx-det a{color:var(--gold);word-break:break-all;font:500 .78rem 'Space Grotesk',ui-monospace,monospace}
.bx-dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:10px 0 0}
.bx-dl div{padding:9px 12px;border-radius:12px;background:rgba(255,255,255,.04)}
.bx-dl small,.bx-row small{display:block;font-size:.72rem;color:rgba(255,255,255,.55)}
.bx-dl b{display:block;margin-top:2px;direction:ltr;unicode-bidi:isolate;text-align:start;font:700 .98rem 'Space Grotesk',Vazirmatn,sans-serif;font-variant-numeric:tabular-nums}
[dir=rtl] .bx-dl b{text-align:right}
/* the live mempool: a block's panel (stats, fee curve, transaction map), a transaction, an address, the stream */
.bx-det{scroll-margin-top:90px}
.mp-hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.bx-det .mp-hd h4{margin:0;font:800 1.2rem Vazirmatn,sans-serif;color:#fff}
.mp-sub{font-size:.8rem;color:rgba(255,255,255,.6)}
.mp-x{margin-inline-start:auto;width:36px;height:36px;border-radius:50%;border:1px solid var(--ln);background:rgba(255,255,255,.04);color:#fff;font:400 1.3rem/1 sans-serif;cursor:pointer}
.mp-x:hover{border-color:rgba(255,210,122,.6)}
.mp-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 11px;border-radius:99px;border:1px solid var(--ln);font-size:.74rem;color:rgba(255,255,255,.75)}
.mp-pill[hidden]{display:none}
.mp-pill i{width:7px;height:7px;border-radius:50%;background:#77777d}.mp-pill.live i{background:#34d399;animation:bx-ping 2.2s infinite}.mp-pill.wait i,.mp-pill.rest i{background:var(--gold)}.mp-pill.fail i{background:#f87171}
.bx-det .mp-hash{display:block;margin-top:6px}
.mp-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);gap:20px;margin-top:14px;align-items:start}
.mp-l .bx-dl{margin-top:0;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.mp-tb{display:grid;gap:2px}
.mp-tr{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:8px 14px;border-radius:10px}
.mp-tr:nth-child(odd){background:rgba(255,255,255,.04)}
.mp-tr>span{font-size:.88rem;color:rgba(255,255,255,.75)}
.mp-tr>b{direction:ltr;unicode-bidi:isolate;font:700 1rem 'Space Grotesk',Vazirmatn,sans-serif;font-variant-numeric:tabular-nums;color:#fff;text-align:end}
.mp-tr>b small{margin-inline-start:8px;font-weight:500;font-size:.78rem;color:rgba(255,255,255,.55)}
.mp-bar{position:relative;display:block;width:190px;max-width:100%;height:22px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden}
.mp-bar i{position:absolute;inset:0 auto 0 0;border-radius:6px;background:linear-gradient(90deg,#a65a07,#f7931a)}
.mp-bar em{position:relative;display:block;text-align:center;font:700 .76rem/22px 'Space Grotesk',sans-serif;font-style:normal;color:#fff}
.mp-ch{margin-top:14px}
.mp-ch h5,.mp-rb h5,.mp-io h5,.mp-body>h5{margin:0 0 8px;font:700 .82rem Vazirmatn,sans-serif;color:rgba(255,255,255,.72)}
.mp-ch svg{display:block;width:100%;height:auto;direction:ltr;overflow:visible;touch-action:pan-y}
.mp-ch .g{stroke:rgba(255,255,255,.08);stroke-width:1}
.mp-ch .ya{fill:rgba(255,255,255,.5);font:500 11px 'Space Grotesk',sans-serif;text-anchor:end}
.mp-ch .xa{fill:rgba(255,255,255,.5);font:500 11px 'Space Grotesk',sans-serif;text-anchor:middle}
.mp-ch .ar{fill:url(#mpg)}.mp-ch .ln{fill:none;stroke:#f7931a;stroke-width:2;stroke-linejoin:round}
.mp-ch .mk{fill:#050506;stroke:#ffd27a;stroke-width:2}
.mp-ch .lb{fill:#fff;font:700 11.5px 'Space Grotesk',sans-serif;text-anchor:middle;paint-order:stroke;stroke:#050506;stroke-width:4px}
.mp-ch .xh line{stroke:rgba(255,255,255,.45);stroke-width:1}.mp-ch .xh circle{fill:#ffd27a;stroke:#050506;stroke-width:2}
.mp-ch .xh rect{fill:rgba(10,10,12,.95);stroke:rgba(255,210,122,.45)}.mp-ch .xh text{fill:#fff;font:700 12px 'Space Grotesk',sans-serif;text-anchor:middle}
.mp-ch .hit{fill:transparent;cursor:crosshair}
.mp-no{margin:6px 0 0;font-size:.82rem;color:rgba(255,255,255,.6)}
.mp-gg{margin-bottom:10px}.mp-ggb{display:flex;flex-wrap:wrap;gap:6px}
.mp-gg button{min-height:30px;padding:4px 11px;border-radius:99px;border:1px solid var(--ln);background:rgba(255,255,255,.035);color:rgba(255,255,255,.78);font:600 .74rem Vazirmatn,'Space Grotesk',sans-serif;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.mp-gg button:hover{border-color:rgba(255,210,122,.55);color:#fff}
.mp-gg button.on{border-color:var(--gold);background:var(--gold);color:#1a0f00}
.mp-ggr{display:block;min-height:1.3em;margin-top:6px;font-size:.76rem;color:var(--gold)}
.mp-cv{position:relative;aspect-ratio:1;border-radius:14px;background:#0a0a0c;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07);overflow:hidden}
.mp-cv canvas{display:block;width:100%;height:100%;cursor:crosshair;touch-action:manipulation}
.mp-ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:22px;text-align:center;font-size:.88rem;line-height:1.8;color:rgba(255,255,255,.8);background:rgba(8,8,10,.8)}
.mp-ov:empty{display:none}.mp-ov.dim{background:rgba(8,8,10,.55)}
.mp-ov p{margin:0}.mp-ov small{font-size:.74rem;color:rgba(255,255,255,.55)}
.mp-ov button,.mp-pz,.mp-id button,.mp-id a{min-height:36px;padding:6px 16px;border:0;border-radius:99px;cursor:pointer;font:800 .82rem Vazirmatn,sans-serif;color:#1a0f00;background:linear-gradient(180deg,#ffd27a,#f7931a);text-decoration:none;display:inline-flex;align-items:center}
.mp-ld::before{content:"";display:inline-block;width:12px;height:12px;margin-inline-end:9px;vertical-align:-1px;border-radius:50%;border:2px solid rgba(255,210,122,.3);border-top-color:var(--gold);animation:bx-spin .7s linear infinite}
.mp-tip{position:absolute;z-index:3;width:280px;max-width:calc(100% - 8px);padding:10px 12px;border-radius:12px;border:1px solid rgba(255,210,122,.35);background:rgba(10,10,12,.97);box-shadow:0 14px 34px rgba(0,0,0,.6);font-size:.76rem;line-height:1.65;color:#fff;pointer-events:none}
.mp-tip.pin{pointer-events:auto}
.mp-tip strong{display:block;color:var(--gold)}
.mp-tip code{display:block;margin-bottom:4px;direction:ltr;text-align:left;font:600 .74rem ui-monospace,monospace;color:var(--gold)}
.mp-tip div{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:baseline}.mp-tip div span{white-space:nowrap;color:rgba(255,255,255,.62)}
.mp-tip div b{direction:ltr;unicode-bidi:isolate;font:700 .76rem 'Space Grotesk',Vazirmatn,sans-serif;text-align:end}
.mp-tip p{margin:4px 0 0;color:var(--gold);font-weight:700}.mp-tip small{display:block;margin-top:4px;color:rgba(255,255,255,.5)}
.mp-tip button{margin-top:8px;width:100%;min-height:34px;border:0;border-radius:99px;cursor:pointer;font:800 .78rem Vazirmatn,sans-serif;color:#1a0f00;background:linear-gradient(180deg,#ffd27a,#f7931a)}
.mp-lg{display:flex;align-items:center;gap:10px;margin-top:10px;direction:ltr;font:500 .72rem 'Space Grotesk',sans-serif;color:rgba(255,255,255,.6)}
.mp-lgb{position:relative;flex:1;height:26px}
.mp-lgb i{position:absolute;inset:0 0 auto;height:8px;border-radius:4px;background:linear-gradient(90deg,#4d2a0a,#7a420b,#b8640d,#f7931a,#ffc978,#ffeccc)}
.mp-lgb span{position:absolute;top:11px;translate:-50% 0;white-space:nowrap}.mp-lgb span:first-of-type{translate:0 0}.mp-lgb span:last-of-type{translate:-100% 0}
.mp-cap{margin:8px 0 0;font-size:.76rem;line-height:1.8;color:rgba(255,255,255,.55)}
.mp-cnt{color:rgba(255,255,255,.75)}
/* a transaction, an address */
.mp-st{display:inline-flex;align-items:center;padding:3px 11px;border-radius:99px;border:1px solid var(--ln);font-size:.75rem;color:rgba(255,255,255,.8)}
.mp-st[hidden]{display:none}.mp-st.ok{border-color:rgba(52,211,153,.5);color:#6ee7b7}.mp-st.wait{border-color:rgba(255,210,122,.5);color:var(--gold)}
.mp-body{margin-top:10px}.mp-body>.mp-ld{margin:6px 0}
.mp-id{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:4px 0 12px}
.mp-id code{flex:1 1 100%;direction:ltr;text-align:left;word-break:break-all;font:500 .82rem/1.6 ui-monospace,monospace;color:var(--gold)}
.bx-det .mp-id a{font:800 .8rem Vazirmatn,sans-serif;color:#1a0f00;word-break:normal}
.mp-id button,.mp-id a{min-height:32px;padding:4px 14px;font-size:.78rem}
.mp-lk{padding:0;border:0;background:none;color:var(--gold);font:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.mp-io{display:grid;grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr);gap:12px;margin-top:16px;align-items:start}
.mp-io h5 small{font-weight:500;color:rgba(255,255,255,.5)}
.mp-io ol,.mp-hist{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.mp-io li{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:38px;padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.04);font-size:.78rem}
.mp-io li .ad{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:left;padding:0;border:0;background:none;color:#fff;font:500 .78rem ui-monospace,monospace;cursor:pointer}
.mp-io li .ad:hover{color:var(--gold)}
.mp-io li .cb{color:var(--gold);font-weight:700}.mp-io li .ty{color:rgba(255,255,255,.6)}
.mp-io li b{flex:0 0 auto;direction:ltr;unicode-bidi:isolate;font:700 .8rem 'Space Grotesk',sans-serif;white-space:nowrap}
.mp-io li.more{justify-content:center;color:rgba(255,255,255,.55);background:none}
.mp-arr{align-self:center;text-align:center;font-size:1.3rem;color:var(--gold)}.mp-arr::before{content:"→"}[dir=rtl] .mp-arr::before{content:"←"}
.mp-body>h5{margin-top:16px}
.mp-hist button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;min-height:44px;padding:6px 12px;border:0;border-radius:10px;background:rgba(255,255,255,.04);color:#fff;cursor:pointer;text-align:start}
.mp-hist button:hover{background:rgba(247,147,26,.12)}
.mp-hist code{display:block;direction:ltr;font:500 .78rem ui-monospace,monospace}.mp-hist small{display:block;font-size:.7rem;color:rgba(255,255,255,.55)}
.mp-hist b{direction:ltr;unicode-bidi:isolate;font:700 .86rem 'Space Grotesk',sans-serif;white-space:nowrap}.mp-hist .pos{color:#6ee7b7}.mp-hist .neg{color:#fca5a5}
/* the stream */
.mp-sx{margin-top:16px;padding:16px 18px 12px;border-radius:22px;border:1px solid var(--ln);background:linear-gradient(155deg,rgba(255,255,255,.065),rgba(255,255,255,.012) 48%,rgba(255,255,255,.03)),#050506}
.mp-sx[hidden]{display:none}
.mp-sh{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.mp-sh h4{margin:0;font:800 1.05rem Vazirmatn,sans-serif;color:var(--gold)}
.mp-pz{margin-inline-start:auto;min-height:34px;padding:5px 14px;font-size:.78rem}
.mp-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}
.mp-kpi div{padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.04)}
.mp-kpi small{display:block;font-size:.72rem;color:rgba(255,255,255,.58)}
.mp-kpi b{display:block;margin-top:3px;direction:ltr;unicode-bidi:isolate;text-align:start;font:700 1.02rem 'Space Grotesk',Vazirmatn,sans-serif;font-variant-numeric:tabular-nums;color:#fff}
[dir=rtl] .mp-kpi b{text-align:right}
.mp-kpi span{display:block;font-size:.7rem;color:rgba(255,255,255,.5);direction:ltr;text-align:start}[dir=rtl] .mp-kpi span{direction:rtl}
.mp-c2{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,1fr);gap:18px;margin-top:14px}
.mp-fh,.mp-feed button{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,.8fr) minmax(0,.75fr);gap:10px;align-items:center}
.mp-fh{padding:0 12px 6px;font-size:.72rem;color:rgba(255,255,255,.5)}
.mp-feed,.mp-rb ol{list-style:none;margin:0;padding:0;display:grid;gap:5px}
.mp-feed button{width:100%;min-height:46px;padding:6px 12px;border:0;border-radius:10px;background:rgba(255,255,255,.035);color:#fff;cursor:pointer;text-align:start}
.mp-feed button:hover,.mp-rb button:hover{background:rgba(247,147,26,.12)}
.mp-feed .v b{font:700 .9rem 'Space Grotesk',sans-serif;direction:ltr;unicode-bidi:isolate}
.mp-feed .v small{display:block;font-size:.7rem;color:rgba(255,255,255,.55);direction:ltr;text-align:start}[dir=rtl] .mp-feed .v small{text-align:right}
.mp-feed .v em{display:inline-block;margin-inline-start:6px;padding:0 7px;border-radius:99px;font:700 .64rem/1.6 Vazirmatn,sans-serif;font-style:normal;color:#1a0f00;background:var(--gold);vertical-align:2px}
.mp-feed .r,.mp-feed .z{font:600 .82rem 'Space Grotesk',sans-serif;direction:ltr;unicode-bidi:isolate}
.mp-feed small{color:rgba(255,255,255,.5);font-weight:500}
.mp-feed time{font-size:.72rem;color:rgba(255,255,255,.6)}
.mp-feed li.big button{box-shadow:inset 0 0 0 1px rgba(255,210,122,.45)}.mp-feed li.big .v b{color:var(--gold)}
.mp-feed li.n button{animation:mp-in .8s cubic-bezier(.2,.8,.2,1)}
@keyframes mp-in{from{opacity:0;transform:translateY(-8px);background:rgba(247,147,26,.32)}}
.mp-emp{padding:14px 12px;font-size:.82rem;color:rgba(255,255,255,.55)}
.mp-rb button{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;width:100%;min-height:44px;padding:6px 12px;border:0;border-radius:10px;background:rgba(255,255,255,.035);color:#fff;cursor:pointer;text-align:start;font:600 .8rem 'Space Grotesk',Vazirmatn,sans-serif}
.mp-rb button>span{direction:ltr;unicode-bidi:isolate}.mp-rb button>small{direction:ltr;unicode-bidi:isolate;color:#6ee7b7;font-weight:700}
.mp-rb em{padding:0 7px;border-radius:99px;font:700 .64rem/1.6 Vazirmatn,sans-serif;font-style:normal;color:rgba(255,255,255,.8);border:1px solid var(--ln)}.mp-rb em.ok{color:#6ee7b7;border-color:rgba(52,211,153,.4)}
.mp-note{margin:12px 2px 0;font-size:.74rem;line-height:1.9;color:rgba(255,255,255,.48)}
/* the tables */
.bx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-top:22px}
.bx-card{padding:16px 18px 10px;border-radius:22px;border:1px solid var(--ln);background:linear-gradient(155deg,rgba(255,255,255,.065),rgba(255,255,255,.012) 48%,rgba(255,255,255,.03)),#050506}
.bx-card h4{margin:0 0 6px;font:800 1rem Vazirmatn,sans-serif;color:var(--gold)}
.bx-row{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:9px 0;border-top:1px solid rgba(255,255,255,.07)}
.bx-row span{font-size:.86rem;color:rgba(255,255,255,.72)}
.bx-row b{flex:0 0 auto;direction:ltr;unicode-bidi:isolate;font:700 .95rem 'Space Grotesk',Vazirmatn,sans-serif;font-variant-numeric:tabular-nums;color:#fff;text-align:end}
.bx-row b small{display:inline;margin-inline-start:6px;font-weight:500;font-size:.74rem;color:rgba(255,255,255,.5)}
.bx-pool{display:grid;grid-template-columns:minmax(90px,auto) 1fr auto;align-items:center;gap:10px;padding:7px 0;border-top:1px solid rgba(255,255,255,.07);font-size:.84rem}
.bx-pool span{color:rgba(255,255,255,.8);direction:ltr;text-align:start}.bx-pool i{height:8px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden}
.bx-pool i::before{content:"";display:block;height:100%;width:var(--w,0%);border-radius:4px;background:linear-gradient(90deg,#a65a07,#f7931a,#ffd27a)}
.bx-pool b{font:700 .84rem 'Space Grotesk',Vazirmatn,sans-serif;direction:ltr}
.bx-spark{display:block;width:100%;height:92px;margin-top:6px}
.bx-foot{margin-top:14px;font-size:.76rem;line-height:1.9;color:rgba(255,255,255,.48)}
@media (max-width:899px){
  .bx-hud{min-height:0;padding:16px 14px 18px;display:grid;grid-template-columns:1fr 1fr;gap:14px 12px}
  .bx-core{position:relative;left:auto;top:auto;translate:none;grid-column:1/-1;width:100%;max-width:340px;margin-inline:auto}
  .bx-ln{display:none}
  .bx-co,.bx-co.l,.bx-co.r{position:static;width:auto}
  .bx-b{--s:104px;margin-inline:13px}.bx-c .ft{padding:4px 3px}.bx-b .f{font-size:.8rem}.bx-b .r{font-size:.6rem}.bx-b .ft b{font-size:.9rem;margin-top:0}.bx-b .x{font-size:.66rem}.bx-b .a{font-size:.58rem;margin-top:0}.bx-q,.bx-m{gap:16px}.bx-m .bx-b+.bx-b::before{left:-32px;width:20px}
  .bx-tm{padding:14px 12px 12px}.bx-find input{font-size:.8rem;padding:0 13px}.bx-find button{padding:0 18px}.bx-sl{gap:8px}.bx-sl>button{padding:7px 10px;font-size:.7rem}
  .bx-det{padding:12px}.mp-cols,.mp-c2{grid-template-columns:minmax(0,1fr)}.mp-r{order:-1}.mp-ggb{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}.mp-ggb button{flex:0 0 auto}.mp-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}
  .mp-io{grid-template-columns:minmax(0,1fr)}.mp-arr::before,[dir=rtl] .mp-arr::before{content:"↓"}.mp-sx{padding:14px 12px 10px}
  .mp-fh,.mp-feed button{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,.8fr)}.mp-fh span:nth-child(3),.mp-feed .z{display:none}
}
@media (prefers-reduced-motion:reduce){.sx-pic img,.sx-g,.sx h1,.ex *,.bx-b.new,.bx-c,.bx-b.q .bx-c,.bx-rd::after,.mp-feed li.n button,.mp-pill.live i,.mp-ld::before,.bx-st.live i,.sx-js .sx-b,.sx-js .sx-b.on{animation:none!important;transition:none!important}}
"""


def page():
    import chrome

    def block(lg):
        items = []
        for i, (iso, title, text, kind) in enumerate(B):
            when = f"<time datetime='{iso}'>{e(date_h(iso, lg))}</time>" if iso else f"<span>{e(T['today'][lg])}</span>"
            items.append(f"<li class='sx-b{' on' if i == 0 else ''}' data-h='{i}'>{EX[i]}<div class='sx-tx'><div class='sx-hd'><span class='sx-n'>{e(T['block'][lg])} {num(i, lg)}</span>{when}</div>"
                         f"<h3>{e(title[lg])}</h3><p>{e(text[lg])}</p>{art(kind, lg)}</div></li>")
        facts = "".join(f"<li><b>{e(k)}</b>{e(v)}</li>" for k, v in KNOWN[lg])
        chips = "".join(f"<li><b>{e(a)}</b>{e(b)}</li>" for a, b in CHIPS[lg])
        return (f"<article class='sx' data-sx><header class='sx-hero'><div class='sx-art0'><div class='sx-pic'>"
                f"<picture><source media='(max-width:700px)' srcset='/assets/satoshi-hero-900.webp'><img src='/assets/satoshi-hero.webp' alt='{e(T['alt'][lg])}' width='1600' height='900' fetchpriority='high' decoding='async'></picture>"
                f"<i class='sx-g h'></i><i class='sx-g e1'></i><i class='sx-g e2'></i><i class='sx-g c'></i><canvas class='sx-emb' aria-hidden='true'></canvas></div></div>"
                f"<div class='sx-head sx-w'><div class='sx-hc'><div class='meta'><a href='/'>{T['home'][lg]}</a> / {e(T['crumb'][lg])}</div>"
                f"<h1>{e(T['h1'][lg])}</h1><p class='sx-lead'>{e(T['lead'][lg])}</p><ul class='sx-chips'>{chips}</ul></div></div></header>"
                f"<section class='sx-story sx-w'><h2 class='sx-h'>{e(T['story'][lg])}</h2><p class='sx-sub'>{e(T['hint'][lg])}</p>"
                f"<ol class='sx-chain'>{''.join(items)}</ol><div class='sx-nav' data-prev='{e(T['prev'][lg])}' data-next='{e(T['next'][lg])}'></div></section>"
                f"<section class='bx sx-w' data-bx><h2 class='sx-h'>{e(T['now'][lg])}</h2><p class='sx-sub'>{e(T['nowl'][lg])}</p><div data-bx-root></div></section>"
                f"<section class='sx-facts sx-w'><h2 class='sx-h'>{e(T['known'][lg])}</h2><ul class='sx-fl'>{facts}</ul></section>"
                f"<p class='sx-note sx-w'>{e(T['src'][lg])}</p></article>")

    body = (BR.tri(block) + f"<script>{BR.LANG_JS}</script><script src='/assets/nx-coin.js?v={chrome.NX_VER}' defer></script>"
            f"<script src='/assets/btc-live.js?v={VER}' defer></script><script src='/assets/satoshi.js?v={VER}' defer></script>")
    ld = {"@context": "https://schema.org", "@type": "Article", "headline": T["title"]["fa"], "alternativeHeadline": T["title"]["en"],
          "description": T["desc"]["en"], "url": "https://entekhab.net/satoshi/", "inLanguage": ["fa", "ckb", "en"], "image": "https://entekhab.net/assets/satoshi-og.jpg",
          "about": {"@type": "Thing", "name": "Satoshi Nakamoto"}, "isAccessibleForFree": True,
          "publisher": {"@type": "Organization", "name": "entekhab.net", "url": "https://entekhab.net/"}}
    extra = (f"<style>{BR.RCSS}{CSS}</style><meta property='og:image' content='https://entekhab.net/assets/satoshi-og.jpg'><meta name='twitter:card' content='summary_large_image'>"
             f"<link rel='preload' as='image' href='/assets/satoshi-hero.webp' media='(min-width:701px)' fetchpriority='high'>"
             f"<script type='application/ld+json'>{BP.sj(ld)}</script>")
    return BP.page("satoshi/", T["title"]["fa"], T["desc"]["fa"], body, extra)


def main():
    url = page()
    BR.add_to_sitemap([url])
    print("satoshi:", url)


if __name__ == "__main__":
    main()
