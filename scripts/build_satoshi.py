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
VER = "1"
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
                f"<button type='button' class='sx-btn' data-dec hidden data-a='{e(T['decode'][lg])}' data-b='{e(T['encode'][lg])}'>{e(T['decode'][lg])}</button>"
                f"<p class='sx-hash'><span>{e(T['hash'][lg])}</span><code dir='ltr'>{GENESIS_HASH}</code></p></div>")
    if kind == "pizza":
        return (f"<div class='sx-art sx-kp'><div><small>{e(T['pizza'][lg])}</small><b dir='ltr' data-mul='10000'>—</b></div></div>"
                f"<p class='sx-src'>{e(T['livenote'][lg])}</p>")
    if kind == "legacy":
        return (f"<div class='sx-art sx-kp'><div><small>{e(T['mil'][lg])}</small><b dir='ltr' data-mul='1000000'>—</b></div>"
                f"<div><small>{e(T['days'][lg])}</small><b dir='ltr' data-days>—</b></div>"
                f"<div><small>{e(T['height'][lg])}</small><b dir='ltr' data-height>—</b></div></div>"
                f"<p class='sx-src'>{e(T['livenote'][lg])}</p>")
    return ""


CSS = """
main.w{max-width:none;padding:0}
.sx{--or:#f7931a;--gold:#ffd27a;position:relative;isolation:isolate;color:#fff;background:#000;overflow:hidden;padding-bottom:30px}
.sx *{box-sizing:border-box}
.sx::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(60vw 50vh at 12% 8%,rgba(13,74,82,.4),transparent 70%),radial-gradient(50vw 40vh at 92% 100%,rgba(247,147,26,.16),transparent 70%)}
.sx-w{max-width:1200px;margin:0 auto;padding:0 20px}
.sx .meta{padding-top:22px;font-size:.82rem;color:rgba(255,255,255,.55)}.sx .meta a{color:var(--gold)}
.sx h1{margin:.45em 0 .25em;max-width:34ch;font:900 clamp(1.6rem,3.1vw,2.5rem)/1.3 Vazirmatn,'Space Grotesk',sans-serif;text-wrap:balance;color:#fff}
html[lang=en] .sx h1{font-family:'Space Grotesk',Vazirmatn,sans-serif;font-weight:700;letter-spacing:-.02em;line-height:1.14;max-width:30ch}
.sx-lead{max-width:84ch;margin:0;font-size:.98rem;line-height:1.95;color:rgba(255,255,255,.7)}
.sx-stage{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:24px;margin-top:20px;align-items:stretch}
.sx-fig{position:relative;min-height:380px;border-radius:26px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:radial-gradient(80% 60% at 50% 100%,rgba(247,147,26,.12),transparent 70%),#020304}
.sx-fig canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.sx-fig p{position:absolute;inset-inline:0;bottom:14px;margin:0;text-align:center;font-size:.8rem;color:rgba(255,255,255,.55)}
.sx-chain{list-style:none;margin:0;padding:0;min-width:0}
.sx-b{position:relative;margin:0 0 16px;padding:24px 26px 26px;border-radius:24px;border:1px solid rgba(255,255,255,.1);
  background:linear-gradient(155deg,rgba(255,255,255,.075),rgba(255,255,255,.015) 48%,rgba(255,255,255,.04)),#060607;box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.sx-b+.sx-b::before{content:"";position:absolute;inset-inline-start:44px;top:-17px;width:2px;height:16px;background:linear-gradient(var(--or),rgba(247,147,26,.2))}
.sx-hd{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:.84rem;color:rgba(255,255,255,.62)}
.sx-n{padding:3px 12px;border-radius:99px;background:rgba(247,147,26,.15);color:var(--gold);font-weight:800}
.sx-b time{font-family:'Space Grotesk',Vazirmatn,sans-serif;font-weight:600}
.sx-b h2{margin:.5em 0 .35em;font:900 clamp(1.45rem,3.2vw,2.5rem)/1.3 Vazirmatn,'Space Grotesk',sans-serif;border:0;padding:0}
html .sx-b h2{color:#fff}
html[lang=en] .sx-b h2{font-family:'Space Grotesk',Vazirmatn,sans-serif;font-weight:700;letter-spacing:-.015em}
.sx-b>p{max-width:60ch;margin:0;font-size:1.02rem;line-height:2.05;color:rgba(255,255,255,.84)}
.sx-art{margin-top:16px}
.sx-hex{padding:14px 16px;border-radius:16px;border:1px solid rgba(247,147,26,.3);background:rgba(0,0,0,.55)}
.sx-msg{display:block;min-height:3.4em;font:500 .86rem/1.8 'Space Grotesk',ui-monospace,monospace;color:var(--gold);word-break:break-word;white-space:pre-wrap;background:none;padding:0;border:0}
.sx-msg.hex{color:rgba(255,255,255,.62);letter-spacing:.02em;word-break:break-all}
.sx-src{margin:8px 0 0;font-size:.76rem;line-height:1.8;color:rgba(255,255,255,.5)}
.sx-btn{margin-top:10px;height:40px;padding:0 16px;border-radius:12px;border:0;background:linear-gradient(100deg,#fff1c9,#ffd27a 24%,#f7931a 60%,#a65a07);color:#000;font:800 .84rem Vazirmatn,sans-serif;cursor:pointer}
.sx-hash{margin:12px 0 0;font-size:.74rem;color:rgba(255,255,255,.5)}
.sx-hash code{display:block;margin-top:2px;font:500 .74rem/1.7 'Space Grotesk',ui-monospace,monospace;color:rgba(255,255,255,.75);word-break:break-all;background:none;padding:0;border:0}
.sx-kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.sx-kp div{padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08)}
.sx-kp small{display:block;font-size:.74rem;color:rgba(255,255,255,.56)}
.sx-kp b{display:block;margin-top:3px;font:700 1.3rem 'Space Grotesk',Vazirmatn,sans-serif;color:var(--gold);font-variant-numeric:tabular-nums;text-align:start}
.sx-nav{display:none}
.sx-facts{margin-top:34px}
.sx-facts h2{font:900 clamp(1.3rem,2.6vw,1.9rem)/1.4 Vazirmatn,'Space Grotesk',sans-serif;margin:0 0 14px;border:0;padding:0}
.sx-fl{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.sx-fl li{padding:16px 18px;border-radius:18px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);font-size:.94rem;line-height:1.95;color:rgba(255,255,255,.82)}
.sx-fl b{display:block;margin-bottom:4px;font-size:.78rem;color:var(--or)}
.sx-note{margin:22px 0 0;max-width:80ch;font-size:.8rem;line-height:1.9;color:rgba(255,255,255,.5)}
.sx :focus-visible{outline:2px solid var(--gold);outline-offset:3px;border-radius:8px}
/* wide screens with script: one block at a time, walked with the chain under it */
@media (min-width:900px){
  .sx-js .sx-stage{min-height:min(56vh,520px)}
  .sx-js .sx-chain{display:grid}
  .sx-js .sx-b{grid-area:1/1;margin:0;visibility:hidden;opacity:0;transform:translateY(18px);transition:opacity .45s,transform .55s cubic-bezier(.2,.8,.2,1),visibility 0s .45s;display:flex;flex-direction:column;justify-content:center}
  .sx-js .sx-b.on{visibility:visible;opacity:1;transform:none;transition:opacity .45s .08s,transform .55s cubic-bezier(.2,.8,.2,1) .08s}
  .sx-js .sx-b+.sx-b::before{display:none}
  .sx-js .sx-nav{display:flex;align-items:center;gap:14px;margin-top:16px;padding:10px 12px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:rgba(10,10,12,.7)}
  .sx-nav button.sx-ar{flex:0 0 auto;width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#fff;cursor:pointer;display:grid;place-items:center}
  .sx-nav button.sx-ar:hover{border-color:var(--or)}
  .sx-nav button.sx-ar svg{width:18px;height:18px}
  [dir=rtl] .sx-nav .sx-ar[data-go="-1"] svg,[dir=ltr] .sx-nav .sx-ar[data-go="1"] svg{transform:scaleX(-1)}
  .sx-ticks{flex:1 1 auto;display:flex;align-items:center;min-width:0}
  .sx-ticks button{position:relative;flex:1 1 0;height:44px;min-width:0;border:0;background:none;cursor:pointer;padding:0}
  .sx-ticks button::before{content:"";position:absolute;inset-inline:0;top:50%;height:2px;margin-top:-1px;background:rgba(255,255,255,.14)}
  .sx-ticks button:first-child::before{inset-inline-start:50%}.sx-ticks button:last-child::before{inset-inline-end:50%}
  .sx-ticks button::after{content:"";position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:4px;background:#000;border:2px solid rgba(255,255,255,.35);transition:transform .25s,background .25s,border-color .25s}
  .sx-ticks button.done::before{background:var(--or)}
  .sx-ticks button.done::after{border-color:var(--or)}
  .sx-ticks button.on::after{background:var(--or);border-color:var(--gold);transform:scale(1.45) rotate(45deg);box-shadow:0 0 18px rgba(247,147,26,.8)}
  .sx-ticks button:hover::after{border-color:var(--gold)}
  .sx-pos{flex:0 0 auto;min-width:5.5ch;text-align:center;font:700 .84rem 'Space Grotesk',Vazirmatn,sans-serif;color:rgba(255,255,255,.7)}
}
@media (max-width:899px){
  .sx-stage{grid-template-columns:minmax(0,1fr);gap:18px}
  .sx-fig{min-height:260px}
  .sx-b{padding:18px 18px 20px;border-radius:20px}
  .sx-b+.sx-b::before{inset-inline-start:34px}
}
@media (prefers-reduced-motion:reduce){.sx-js .sx-b,.sx-js .sx-b.on,.sx-ticks button::after{transition:none}}
"""


def page():
    def block(lg):
        items = []
        last = len(B) - 1
        for i, (iso, title, text, kind) in enumerate(B):
            when = f"<time datetime='{iso}'>{e(date_h(iso, lg))}</time>" if iso else f"<span>{e(T['today'][lg])}</span>"
            items.append(f"<li class='sx-b{' on' if i == 0 else ''}' data-h='{i}'><div class='sx-hd'><span class='sx-n'>{e(T['block'][lg])} {num(i, lg)}</span>{when}</div>"
                         f"<h2>{e(title[lg])}</h2><p>{e(text[lg])}</p>{art(kind, lg)}</li>")
        facts = "".join(f"<li><b>{e(k)}</b>{e(v)}</li>" for k, v in KNOWN[lg])
        return (f"<article class='sx' data-sx data-last='{last}'><div class='sx-w'>"
                f"<div class='meta'><a href='/'>{T['home'][lg]}</a> / {e(T['crumb'][lg])}</div>"
                f"<h1>{e(T['h1'][lg])}</h1><p class='sx-lead'>{e(T['lead'][lg])}</p>"
                f"<div class='sx-stage'><div class='sx-fig' aria-hidden='true'><canvas></canvas><p>{e(T['nofig'][lg])}</p></div>"
                f"<ol class='sx-chain'>{''.join(items)}</ol></div>"
                f"<div class='sx-nav' data-prev='{e(T['prev'][lg])}' data-next='{e(T['next'][lg])}'></div>"
                f"<section class='sx-facts'><h2>{e(T['known'][lg])}</h2><ul class='sx-fl'>{facts}</ul></section>"
                f"<p class='sx-note'>{e(T['src'][lg])}</p></div></article>")

    body = BR.tri(block) + f"<script>{BR.LANG_JS}</script><script src='/assets/satoshi.js?v={VER}' defer></script>"
    ld = {"@context": "https://schema.org", "@type": "Article", "headline": T["title"]["fa"], "alternativeHeadline": T["title"]["en"],
          "description": T["desc"]["en"], "url": "https://entekhab.net/satoshi/", "inLanguage": ["fa", "ckb", "en"],
          "about": {"@type": "Thing", "name": "Satoshi Nakamoto"}, "isAccessibleForFree": True,
          "publisher": {"@type": "Organization", "name": "entekhab.net", "url": "https://entekhab.net/"}}
    extra = f"<style>{BR.RCSS}{CSS}</style><script type='application/ld+json'>{BP.sj(ld)}</script>"
    return BP.page("satoshi/", T["title"]["fa"], T["desc"]["fa"], body, extra)


def main():
    url = page()
    BR.add_to_sitemap([url])
    print("satoshi:", url)


if __name__ == "__main__":
    main()
