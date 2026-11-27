#!/usr/bin/env python3
"""
The languages of /market/ (the live-market workspace) and the currencies a price can be shown in.

One table, two readers:
  * this module, for the CI scripts (scripts/pro_l10n.py translates into these languages, scripts/build_market_l10n.py
    writes one page per language at /market/<path>/);
  * assets/pro/langs.js, which this script writes, for the page itself (language menu, direction, date locale, the
    currency a visitor starts with).

The site's own four languages (ckb, fa, ar, en) keep living at /market/ and keep their hand-written strings in
assets/pro/i18n.js. The other 47 come from the owner's list (2026-11-15) with the paths he gave (/cn/, /iw/, /jp/ …);
the eleven he gave without a path use their ISO code. Their strings are machine-translated from English by CI.

Order of the menu (owner's rule for every language switch on the site): Kurdish first, then Persian and Arabic,
the rest by English name, English last.

Currency a visitor starts with (they can change it, or type their own rate, at any time; assets/pro/fx.js):
  the currency of the country of the browser's time zone (P.TZCC: IANA zone -> country, P.CCCUR: country -> currency)
  when it is known, otherwise the language's home currency below. Persian stays in toman (Afghanistan: afghani,
  Tajikistan: somoni) and Kurdish in toman (Iraq: dinar). Iran is the toman at tgju's free-market rate, not the
  official rial.

CLI:
  python3 scripts/pro_langs.py            write assets/pro/langs.js
  python3 scripts/pro_langs.py --check    exit 1 when the committed files differ from what this table makes
  python3 scripts/pro_langs.py --cldr     refresh scripts/pro_cldr.json from CLDR (needs `pip install babel`) and the
                                          system tz database (/usr/share/zoneinfo); review the diff before committing
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLDR = os.path.join(ROOT, "scripts", "pro_cldr.json")
OUT_JS = os.path.join(ROOT, "assets", "pro", "langs.js")

# code (the page's key and, for new languages, the URL path), native name, English name, Intl locale, hreflang,
# direction, home currency. The site's own four languages have no path of their own: they live at /market/.
# Kurdish comes first — it is this site's own language, and its two dialects are one language, counted once in
# LANG_COUNT. Every other language follows by English name, so a reader looks a language up where they expect it.
LANGS = [
    ("ckb", "کوردی", "Kurdish (Sorani)", "ckb-IQ", "ckb", "rtl", "IRT"),
    ("kmr", "Kurmancî", "Kurdish (Kurmanji)", "kmr-TR", "kmr", "ltr", "TRY"),
    ("ar", "العربية", "Arabic", "ar", "ar", "rtl", "USD"),
    ("bn", "বাংলা", "Bengali", "bn-BD", "bn", "ltr", "BDT"),
    ("bg", "Български", "Bulgarian", "bg-BG", "bg", "ltr", "EUR"),
    ("cat", "Català", "Catalan", "ca-ES", "ca", "ltr", "EUR"),
    ("cn", "简体中文", "Chinese (Simplified)", "zh-CN", "zh-Hans", "ltr", "CNY"),
    ("tw", "繁體中文", "Chinese (Traditional)", "zh-TW", "zh-Hant", "ltr", "TWD"),
    ("hr", "Hrvatski", "Croatian", "hr-HR", "hr", "ltr", "EUR"),
    ("cz", "Čeština", "Czech", "cs-CZ", "cs", "ltr", "CZK"),
    ("da", "Dansk", "Danish", "da-DK", "da", "ltr", "DKK"),
    ("nl", "Nederlands", "Dutch", "nl-NL", "nl", "ltr", "EUR"),
    ("en", "English", "English", "en-GB", "en", "ltr", "USD"),
    ("et", "Eesti", "Estonian", "et-EE", "et", "ltr", "EUR"),
    ("fil", "Filipino", "Filipino", "fil-PH", "fil", "ltr", "PHP"),
    ("fi", "Suomi", "Finnish", "fi-FI", "fi", "ltr", "EUR"),
    ("fr", "Français", "French", "fr-FR", "fr", "ltr", "EUR"),
    ("de", "Deutsch", "German", "de-DE", "de", "ltr", "EUR"),
    ("gr", "Ελληνικά", "Greek", "el-GR", "el", "ltr", "EUR"),
    ("iw", "עברית", "Hebrew", "he-IL", "he", "rtl", "ILS"),
    ("hi", "हिन्दी", "Hindi", "hi-IN", "hi", "ltr", "INR"),
    ("hu", "Magyar", "Hungarian", "hu-HU", "hu", "ltr", "HUF"),
    ("id", "Bahasa Indonesia", "Indonesian", "id-ID", "id", "ltr", "IDR"),
    ("it", "Italiano", "Italian", "it-IT", "it", "ltr", "EUR"),
    ("jp", "日本語", "Japanese", "ja-JP", "ja", "ltr", "JPY"),
    ("kr", "한국어", "Korean", "ko-KR", "ko", "ltr", "KRW"),
    ("lv", "Latviešu", "Latvian", "lv-LV", "lv", "ltr", "EUR"),
    ("lt", "Lietuvių", "Lithuanian", "lt-LT", "lt", "ltr", "EUR"),
    ("ms", "Bahasa Melayu", "Malay", "ms-MY", "ms", "ltr", "MYR"),
    ("mr", "मराठी", "Marathi", "mr-IN", "mr", "ltr", "INR"),
    ("no", "Norsk", "Norwegian", "nb-NO", "nb", "ltr", "NOK"),
    ("fa", "فارسی", "Persian", "fa-IR", "fa", "rtl", "IRT"),
    ("pl", "Polski", "Polish", "pl-PL", "pl", "ltr", "PLN"),
    ("pt", "Português", "Portuguese", "pt-PT", "pt-PT", "ltr", "EUR"),
    ("br", "Português (Brasil)", "Portuguese (Brazil)", "pt-BR", "pt-BR", "ltr", "BRL"),
    ("pa", "ਪੰਜਾਬੀ", "Punjabi", "pa-IN", "pa", "ltr", "INR"),
    ("ro", "Română", "Romanian", "ro-RO", "ro", "ltr", "RON"),
    ("ru", "Русский", "Russian", "ru-RU", "ru", "ltr", "RUB"),
    ("sr", "Српски", "Serbian", "sr-Cyrl-RS", "sr", "ltr", "RSD"),
    ("sk", "Slovenčina", "Slovak", "sk-SK", "sk", "ltr", "EUR"),
    ("sl", "Slovenščina", "Slovenian", "sl-SI", "sl", "ltr", "EUR"),
    ("es", "Español", "Spanish", "es-ES", "es", "ltr", "EUR"),
    ("sw", "Kiswahili", "Swahili", "sw-KE", "sw", "ltr", "KES"),
    ("se", "Svenska", "Swedish", "sv-SE", "sv", "ltr", "SEK"),
    ("ta", "தமிழ்", "Tamil", "ta-IN", "ta", "ltr", "INR"),
    ("te", "తెలుగు", "Telugu", "te-IN", "te", "ltr", "INR"),
    ("th", "ไทย", "Thai", "th-TH", "th", "ltr", "THB"),
    ("tr", "Türkçe", "Turkish", "tr-TR", "tr", "ltr", "TRY"),
    ("uk", "Українська", "Ukrainian", "uk-UA", "uk", "ltr", "UAH"),
    ("ur", "اردو", "Urdu", "ur-PK", "ur", "rtl", "PKR"),
    ("vi", "Tiếng Việt", "Vietnamese", "vi-VN", "vi", "ltr", "VND"),
]
# The flag shown beside each language: a file in assets/pro/flags/ (flag-icons, MIT — see the README there).
# A language is not a country, so this is the flag readers most associate with it, not a claim about borders:
# Kurdish, both Sorani and Kurmanji, carries the flag of the Kurdistan Region, drawn for this site because the
# flag-icons set holds sovereign states only. Catalan uses the senyera, Swahili Kenya, English the UK.
FLAG = {
    "ckb": "kurdistan", "kmr": "kurdistan", "fa": "ir", "ar": "sa", "en": "gb",
    "bn": "bd", "bg": "bg", "cat": "es-ct", "cn": "cn", "tw": "tw", "hr": "hr", "cz": "cz", "da": "dk", "nl": "nl",
    "et": "ee", "fil": "ph", "fi": "fi", "fr": "fr", "de": "de", "gr": "gr", "iw": "il", "hi": "in", "hu": "hu",
    "id": "id", "it": "it", "jp": "jp", "kr": "kr", "lv": "lv", "lt": "lt", "ms": "my", "mr": "in", "no": "no",
    "pl": "pl", "pt": "pt", "br": "br", "pa": "in", "ro": "ro", "ru": "ru", "sr": "rs", "sk": "sk", "sl": "si",
    "es": "es", "sw": "ke", "se": "se", "ta": "in", "te": "in", "th": "th", "tr": "tr", "uk": "ua", "ur": "pk",
    "vi": "vn",
}
FLAG_DIR = "/assets/pro/flags/"


def flag(code):
    """the address of a language's flag, or None"""
    f = FLAG.get(code)
    return (FLAG_DIR + f + ".svg") if f else None


SITE = ("ckb", "fa", "ar", "en")            # the site's own languages: hand-written strings, live at /market/

# Sorani and Kurmanji are two ways of writing one language, so the site offers 50 languages, not 51. Anything that
# tells a reader how many there are counts them this way.
SAME = {"kmr": "ckb"}                       # dialect -> the language it belongs to
LANG_COUNT = len({SAME.get(r[0], r[0]) for r in LANGS})
LANG_MAX = 66                               # the room the site, /market/, the app and the bot are built for
# Adding a language up to LANG_MAX: one row in LANGS, its flag in FLAG (and the SVG in assets/pro/flags/), its line in
# KURD_NOTE, then `python3 scripts/pro_langs.py`. Its place in the translation queue (pro_l10n.PRIORITY), its script
# check and Google's code (i18n_gt.gcode) follow from the row; tests/test_pro_langs.py says what is still missing.
assert LANG_COUNT <= LANG_MAX, "more languages than the room kept for them"

# The line under every language list about Kurdish and its dialects (owner, 2026-11-27, approved wording:
# «زبان کردی زبانی کهن و غنی با گویش‌های گوناگون است. دو گویش اصلی آن، سورانی و کرمانجی، در این سایت در دسترس‌اند.»).
# Written by hand in every language, not left to machine translation. A line may carry {n} (LANG_COUNT, in the
# language's own digits), though the approved wording does not.
KURD_NOTE = {
    "ckb": "کوردی زمانێکی کۆن و دەوڵەمەندە و چەندین شێوەزاری جۆراوجۆری هەیە. دوو شێوەزاری سەرەکیی، سۆرانی و کورمانجی، لەم ماڵپەڕەدا بەردەستن.",
    "kmr": "Kurdî zimanekî kevnar û dewlemend e û gelek zaravayên wê yên cuda hene. Du zaravayên wê yên sereke, Soranî û Kurmancî, li vê malperê amade ne.",
    "fa": "زبان کردی زبانی کهن و غنی با گویش‌های گوناگون است. دو گویش اصلی آن، سورانی و کرمانجی، در این سایت در دسترس‌اند.",
    "ar": "اللغة الكردية لغة عريقة وغنية ذات لهجات متعددة. ولهجتاها الرئيسيتان، السورانية والكرمانجية، متاحتان في هذا الموقع.",
    "en": "Kurdish is an ancient and rich language with many dialects. Its two main dialects, Sorani and Kurmanji, are available on this site.",
    "bn": "কুর্দি একটি প্রাচীন ও সমৃদ্ধ ভাষা, যার নানা উপভাষা রয়েছে। এর দুটি প্রধান উপভাষা, সোরানি ও কুরমানজি, এই সাইটে পাওয়া যায়।",
    "bg": "Кюрдският е древен и богат език с много диалекти. Двата му основни диалекта, сорани и курманджи, са достъпни на този сайт.",
    "cat": "El kurd és una llengua antiga i rica amb molts dialectes. Els seus dos dialectes principals, el sorani i el kurmanji, són disponibles en aquest lloc.",
    "cn": "库尔德语是一门古老而丰富的语言，拥有多种方言。其中两大主要方言——索拉尼语和库尔曼吉语——在本网站均可使用。",
    "tw": "庫德語是一門古老而豐富的語言，擁有多種方言。其中兩大主要方言——索拉尼語和庫爾曼吉語——在本網站皆可使用。",
    "hr": "Kurdski je drevan i bogat jezik s mnogo dijalekata. Njegova dva glavna dijalekta, sorani i kurmandži, dostupna su na ovoj stranici.",
    "cz": "Kurdština je starobylý a bohatý jazyk s mnoha nářečími. Její dvě hlavní nářečí, soránština a kurmándžština, jsou na tomto webu k dispozici.",
    "da": "Kurdisk er et gammelt og rigt sprog med mange dialekter. Dets to hoveddialekter, sorani og kurmanji, findes på dette websted.",
    "nl": "Koerdisch is een oude en rijke taal met veel dialecten. De twee belangrijkste dialecten, Sorani en Kurmanji, zijn op deze site beschikbaar.",
    "et": "Kurdi keel on iidne ja rikas keel, millel on palju murdeid. Selle kaks peamist murret, sorani ja kurmandži, on sellel saidil saadaval.",
    "fil": "Ang Kurdish ay isang sinauna at mayamang wika na may maraming diyalekto. Ang dalawang pangunahing diyalekto nito, Sorani at Kurmanji, ay makukuha sa site na ito.",
    "fi": "Kurdi on ikivanha ja rikas kieli, jolla on monia murteita. Sen kaksi päämurretta, sorani ja kurmandži, ovat saatavilla tällä sivustolla.",
    "fr": "Le kurde est une langue ancienne et riche, aux nombreux dialectes. Ses deux principaux dialectes, le sorani et le kurmandji, sont disponibles sur ce site.",
    "de": "Kurdisch ist eine alte und reiche Sprache mit vielen Dialekten. Ihre beiden Hauptdialekte, Sorani und Kurmandschi, sind auf dieser Website verfügbar.",
    "gr": "Τα κουρδικά είναι μια αρχαία και πλούσια γλώσσα με πολλές διαλέκτους. Οι δύο κύριες διάλεκτοί τους, σορανί και κουρμαντζί, είναι διαθέσιμες σε αυτόν τον ιστότοπο.",
    "iw": "כורדית היא שפה עתיקה ועשירה בעלת ניבים רבים. שני הניבים העיקריים שלה, סוראני וכורמנג'י, זמינים באתר זה.",
    "hi": "कुर्दी एक प्राचीन और समृद्ध भाषा है, जिसकी अनेक बोलियाँ हैं। इसकी दो प्रमुख बोलियाँ, सोरानी और कुरमांजी, इस साइट पर उपलब्ध हैं।",
    "hu": "A kurd ősi és gazdag nyelv, sok nyelvjárással. Két fő nyelvjárása, a szoráni és a kurmandzsi, elérhető ezen az oldalon.",
    "id": "Bahasa Kurdi adalah bahasa kuno dan kaya dengan banyak dialek. Dua dialek utamanya, Sorani dan Kurmanji, tersedia di situs ini.",
    "it": "Il curdo è una lingua antica e ricca, con molti dialetti. I suoi due dialetti principali, il sorani e il kurmanji, sono disponibili su questo sito.",
    "jp": "クルド語は、多くの方言をもつ古く豊かな言語です。主要な二つの方言、ソラニー語とクルマンジー語を、このサイトでご利用いただけます。",
    "kr": "쿠르드어는 여러 방언을 지닌 오래되고 풍부한 언어입니다. 두 주요 방언인 소라니어와 쿠르만지어를 이 사이트에서 이용할 수 있습니다.",
    "lv": "Kurdu valoda ir sena un bagāta valoda ar daudzām izloksnēm. Tās divas galvenās izloksnes, sorani un kurmandži, ir pieejamas šajā vietnē.",
    "lt": "Kurdų kalba yra sena ir turtinga kalba, turinti daug tarmių. Dvi pagrindinės jos tarmės, sorani ir kurmandži, yra prieinamos šioje svetainėje.",
    "ms": "Bahasa Kurdi ialah bahasa purba yang kaya dengan pelbagai dialek. Dua dialek utamanya, Sorani dan Kurmanji, tersedia di laman ini.",
    "mr": "कुर्दी ही अनेक बोली असलेली प्राचीन आणि समृद्ध भाषा आहे. तिच्या दोन प्रमुख बोली, सोरानी आणि कुरमांजी, या साइटवर उपलब्ध आहेत.",
    "no": "Kurdisk er et gammelt og rikt språk med mange dialekter. De to hoveddialektene, sorani og kurmanji, er tilgjengelige på dette nettstedet.",
    "pl": "Kurdyjski to starożytny i bogaty język o wielu dialektach. Jego dwa główne dialekty, sorani i kurmandżi, są dostępne w tym serwisie.",
    "pt": "O curdo é uma língua antiga e rica, com muitos dialetos. Os seus dois dialetos principais, o sorani e o kurmanji, estão disponíveis neste site.",
    "br": "O curdo é uma língua antiga e rica, com muitos dialetos. Seus dois dialetos principais, o sorani e o kurmanji, estão disponíveis neste site.",
    "pa": "ਕੁਰਦੀ ਇੱਕ ਪੁਰਾਤਨ ਅਤੇ ਅਮੀਰ ਭਾਸ਼ਾ ਹੈ, ਜਿਸ ਦੀਆਂ ਕਈ ਉਪ-ਬੋਲੀਆਂ ਹਨ। ਇਸ ਦੀਆਂ ਦੋ ਮੁੱਖ ਉਪ-ਬੋਲੀਆਂ, ਸੋਰਾਨੀ ਅਤੇ ਕੁਰਮਾਂਜੀ, ਇਸ ਸਾਈਟ 'ਤੇ ਉਪਲਬਧ ਹਨ।",
    "ro": "Kurda este o limbă veche și bogată, cu multe dialecte. Cele două dialecte principale ale sale, sorani și kurmanji, sunt disponibile pe acest site.",
    "ru": "Курдский — древний и богатый язык со множеством диалектов. Два его основных диалекта, сорани и курманджи, доступны на этом сайте.",
    "sr": "Курдски је древан и богат језик са много дијалеката. Његова два главна дијалекта, сорани и курманџи, доступна су на овом сајту.",
    "sk": "Kurdčina je starobylý a bohatý jazyk s mnohými nárečiami. Jej dve hlavné nárečia, soránčina a kurmándžčina, sú dostupné na tejto stránke.",
    "sl": "Kurdščina je star in bogat jezik s številnimi narečji. Njeni glavni narečji, sorani in kurmandži, sta na voljo na tem spletnem mestu.",
    "es": "El kurdo es una lengua antigua y rica, con muchos dialectos. Sus dos dialectos principales, el sorani y el kurmanji, están disponibles en este sitio.",
    "sw": "Kikurdi ni lugha ya kale na tajiri yenye lahaja nyingi. Lahaja zake mbili kuu, Kisorani na Kikurmanji, zinapatikana kwenye tovuti hii.",
    "se": "Kurdiska är ett gammalt och rikt språk med många dialekter. Dess två huvuddialekter, sorani och kurmanji, finns på den här webbplatsen.",
    "ta": "குர்திஷ் பல வட்டார வழக்குகளைக் கொண்ட தொன்மையான, வளமான மொழி. அதன் இரண்டு முதன்மை வழக்குகளான சொரானி, குர்மாஞ்சி இரண்டும் இந்தத் தளத்தில் கிடைக்கின்றன.",
    "te": "కుర్దిష్ అనేక మాండలికాలు కలిగిన ప్రాచీనమైన, సుసంపన్నమైన భాష. దాని రెండు ప్రధాన మాండలికాలు, సొరానీ మరియు కుర్మాంజీ, ఈ సైట్‌లో అందుబాటులో ఉన్నాయి.",
    "th": "ภาษาเคิร์ดเป็นภาษาเก่าแก่และอุดมสมบูรณ์ที่มีหลายสำเนียง สองสำเนียงหลักคือโซรานีและคุรมันจีมีให้ใช้บนเว็บไซต์นี้",
    "tr": "Kürtçe, pek çok lehçesi olan köklü ve zengin bir dildir. Başlıca iki lehçesi olan Sorani ve Kurmanci bu sitede kullanılabilir.",
    "uk": "Курдська — давня й багата мова з багатьма діалектами. Два її основні діалекти, сорані та курманджі, доступні на цьому сайті.",
    "ur": "کردی ایک قدیم اور بھرپور زبان ہے جس کی کئی بولیاں ہیں۔ اس کی دو بڑی بولیاں، سورانی اور کرمانجی، اس سائٹ پر دستیاب ہیں۔",
    "vi": "Tiếng Kurd là một ngôn ngữ cổ xưa và phong phú với nhiều phương ngữ. Hai phương ngữ chính của nó, Sorani và Kurmanji, hiện có trên trang này.",
}
# a language whose own digits are not 0-9 shows the count in them
DIGITS = {"ckb": "٠١٢٣٤٥٦٧٨٩", "ar": "٠١٢٣٤٥٦٧٨٩", "fa": "۰۱۲۳۴۵۶۷۸۹", "bn": "০১২৩৪৫৬৭৮৯"}


def kurd_note(code):
    """the line that says Kurdish counts once, in that language, with the count in its own digits"""
    t = KURD_NOTE.get(code) or KURD_NOTE["en"]
    n = str(LANG_COUNT)
    dg = DIGITS.get(code)
    if dg:
        n = "".join(dg[int(c)] for c in n)
    return t.replace("{n}", n)

NEW = [r[0] for r in LANGS if r[0] not in SITE]
BY = {r[0]: {"code": r[0], "native": r[1], "english": r[2], "bcp": r[3], "hreflang": r[4], "dir": r[5], "cur": r[6],
             "path": None if r[0] in SITE else r[0], "flag": FLAG.get(r[0])} for r in LANGS}

# changes newer than the CLDR copy babel ships, and the site's own choices
CC_OVERRIDE = {
    "IR": "IRT",   # the toman at tgju's free-market rate (the official rial rate is not what Iranians trade at)
    "BG": "EUR",   # Bulgaria adopted the euro on 1 January 2026
}


def cldr_tables():
    with open(CLDR, encoding="utf-8") as f:
        return json.load(f)


def cc_cur():
    cc = dict(cldr_tables()["cc_cur"])
    cc.update(CC_OVERRIDE)
    return cc


def js_text():
    c = cldr_tables()
    langs = [[r[0], r[1], r[2], r[3], r[4], r[5], r[6]] for r in LANGS]
    head = ("/* entekhab.net — /market/: the workspace's languages, and what the page needs to pick a visitor's currency.\n"
            "   WRITTEN BY scripts/pro_langs.py: edit the table there and run it, never this file (tests/test_pro_langs.py).\n"
            "   LANGS rows: code (and URL path of a new language: /market/<code>/), native name, English name, Intl locale,\n"
            "   hreflang, direction, home currency. Order = the menu: Kurdish first, English last.\n"
            "   TZCC: IANA time zone -> country (tz database zone.tab + links); CCCUR: country -> currency (CLDR; Iran = toman,\n"
            "   Bulgaria = euro since 2026); CUR_DIG: a currency's minor digits when not 2 (CLDR). */\n")
    body = ("(function () {\n  'use strict';\n  var P = window.PRO = window.PRO || {};\n"
            "  P.LANGS = " + json.dumps(langs, ensure_ascii=False, separators=(",", ":")) + ";\n"
            "  P.SITE_LANGS = " + json.dumps(list(SITE)) + ";\n"
            "  P.SAME = " + json.dumps(SAME) + ";\n"
            "  P.LANG_COUNT = " + str(LANG_COUNT) + ";\n"
            "  P.KURD_NOTE = " + json.dumps({r[0]: kurd_note(r[0]) for r in LANGS}, ensure_ascii=False, separators=(",", ":")) + ";\n"
            "  P.FLAG = " + json.dumps(FLAG, separators=(",", ":"), sort_keys=True) + ";\n"
            "  P.FLAG_DIR = " + json.dumps(FLAG_DIR) + ";\n"
            "  /* langFlag, not flag: panels.js already puts a chart helper on P.flag */\n"
            "  P.langFlag = function (c) { var f = P.FLAG[c]; return f ? P.FLAG_DIR + f + \".svg\" : \"\"; };\n"
            "  P.CUR_DIG = " + json.dumps(c["digits"], separators=(",", ":"), sort_keys=True) + ";\n"
            "  P.CCCUR = " + json.dumps(cc_cur(), separators=(",", ":"), sort_keys=True) + ";\n"
            "  P.TZCC = " + json.dumps(c["tz_cc"], separators=(",", ":"), sort_keys=True) + ";\n"
            "})();\n")
    return head + body


def refresh_cldr():
    """CLDR (babel) and the tz database -> scripts/pro_cldr.json"""
    import datetime
    from babel import numbers
    from babel.core import get_global
    today = datetime.date.today()
    cc_cur = {}
    for t in get_global("territory_currencies"):
        if len(t) == 2 and t.isalpha():
            cur = numbers.get_territory_currencies(t, today, tender=True)
            if cur:
                cc_cur[t] = cur[0]
    digits = {}
    for cur in sorted(set(cc_cur.values()) | {"USD"}):
        d = numbers.get_currency_precision(cur)
        if d != 2:
            digits[cur] = d
    digits["IRT"] = 0
    tz = {}
    for line in open("/usr/share/zoneinfo/zone.tab", encoding="utf-8"):
        if line.startswith("#") or not line.strip():
            continue
        p = line.rstrip("\n").split("\t")
        tz[p[2]] = p[0]
    links = {}
    for line in open("/usr/share/zoneinfo/tzdata.zi", encoding="utf-8"):
        if line.startswith("L "):
            _, target, alias = line.split()
            links[alias] = target
    for a, t in links.items():
        hops = 0
        while t not in tz and t in links and hops < 5:
            t, hops = links[t], hops + 1
        if a not in tz and t in tz:
            tz[a] = tz[t]
    with open(CLDR, "w", encoding="utf-8") as f:
        json.dump({"cc_cur": cc_cur, "digits": digits, "tz_cc": tz}, f, ensure_ascii=False, indent=0, sort_keys=True)
        f.write("\n")
    print(f"pro_cldr.json: {len(cc_cur)} countries, {len(set(cc_cur.values()))} currencies, {len(tz)} time zones")


def main():
    args = sys.argv[1:]
    if "--cldr" in args:
        refresh_cldr()
    want = {OUT_JS: js_text()}
    if "--check" in args:
        bad = [p for p, t in want.items() if not os.path.exists(p) or open(p, encoding="utf-8").read() != t]
        for p in bad:
            print("OUT OF DATE:", os.path.relpath(p, ROOT), "— run python3 scripts/pro_langs.py")
        sys.exit(1 if bad else 0)
    for p, t in want.items():
        with open(p, "w", encoding="utf-8") as f:
            f.write(t)
        print("wrote", os.path.relpath(p, ROOT), len(t.encode()), "bytes")


if __name__ == "__main__":
    main()
