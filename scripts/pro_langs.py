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

# The line under every language list that says why Kurdish counts once (owner, 2026-11-27: "Kurdish has two
# dialects, so it is 50 languages, not 51"). Written by hand in every language, not left to machine translation,
# because it is the first thing a reader asks about the number. {n} is LANG_COUNT, in the language's own digits.
KURD_NOTE = {
    "ckb": "کوردی یەک زمانە بە دوو شێوەزار، سۆرانی و کورمانجی، بۆیە یەک جار دەژمێردرێت: سەرجەم {n} زمان.",
    "kmr": "Kurdî zimanek e bi du zaravayan, Soranî û Kurmancî, loma carekê tê hejmartin: bi giştî {n} ziman.",
    "fa": "کوردی یک زبان با دو لهجه است، سورانی و کرمانجی؛ برای همین یک بار شمرده می‌شود: در مجموع {n} زبان.",
    "ar": "الكردية لغة واحدة بلهجتين، السورانية والكرمانجية، لذلك تُحسب مرة واحدة: {n} لغة في المجموع.",
    "en": "Kurdish is one language with two dialects, Sorani and Kurmanji, so it counts once: {n} languages in all.",
    "bn": "কুর্দি একটি ভাষা, যার দুটি উপভাষা আছে: সোরানি ও কুরমানজি। তাই এটি একবারই গোনা হয়: মোট {n}টি ভাষা।",
    "bg": "Кюрдският е един език с два диалекта, сорани и курманджи, затова се брои веднъж: общо {n} езика.",
    "cat": "El kurd és una sola llengua amb dos dialectes, el sorani i el kurmanji, per això compta una sola vegada: {n} llengües en total.",
    "cn": "库尔德语是一种语言，有索拉尼和库尔曼吉两种方言，因此只算一种：共 {n} 种语言。",
    "tw": "庫德語是一種語言，有索拉尼和庫爾曼吉兩種方言，因此只算一種：共 {n} 種語言。",
    "hr": "Kurdski je jedan jezik s dva dijalekta, soranijem i kurmandžijem, pa se broji jednom: ukupno {n} jezika.",
    "cz": "Kurdština je jeden jazyk se dvěma dialekty, soránštinou a kurmándžštinou, proto se počítá jednou: celkem {n} jazyků.",
    "da": "Kurdisk er ét sprog med to dialekter, sorani og kurmanji, så det tæller én gang: {n} sprog i alt.",
    "nl": "Koerdisch is één taal met twee dialecten, Sorani en Kurmanji, en telt daarom één keer: {n} talen in totaal.",
    "et": "Kurdi keel on üks keel kahe murdega, sorani ja kurmandži, seega loetakse seda üks kord: kokku {n} keelt.",
    "fil": "Iisang wika ang Kurdish na may dalawang diyalekto, Sorani at Kurmanji, kaya isang beses lang itong binibilang: {n} wika lahat.",
    "fi": "Kurdi on yksi kieli, jolla on kaksi murretta, sorani ja kurmandži, joten se lasketaan kerran: yhteensä {n} kieltä.",
    "fr": "Le kurde est une seule langue avec deux dialectes, le sorani et le kurmandji ; il ne compte donc qu’une fois : {n} langues au total.",
    "de": "Kurdisch ist eine Sprache mit zwei Dialekten, Sorani und Kurmandschi, und zählt daher einmal: insgesamt {n} Sprachen.",
    "gr": "Τα κουρδικά είναι μία γλώσσα με δύο διαλέκτους, σορανί και κουρμαντζί, γι’ αυτό μετρούν μία φορά: συνολικά {n} γλώσσες.",
    "iw": "כורדית היא שפה אחת עם שני ניבים, סוראני וכורמנג'י, ולכן היא נספרת פעם אחת: {n} שפות בסך הכול.",
    "hi": "कुर्दी एक ही भाषा है जिसकी दो बोलियाँ हैं, सोरानी और कुरमांजी, इसलिए इसे एक बार गिना जाता है: कुल {n} भाषाएँ।",
    "hu": "A kurd egyetlen nyelv két nyelvjárással, a szoránival és a kurmandzsival, ezért egyszer számít: összesen {n} nyelv.",
    "id": "Bahasa Kurdi adalah satu bahasa dengan dua dialek, Sorani dan Kurmanji, sehingga dihitung satu kali: total {n} bahasa.",
    "it": "Il curdo è una sola lingua con due dialetti, il sorani e il kurmanji, quindi conta una volta: {n} lingue in tutto.",
    "jp": "クルド語はソラニー方言とクルマンジー方言をもつ一つの言語なので、一つと数えます：全部で{n}言語です。",
    "kr": "쿠르드어는 소라니와 쿠르만지라는 두 방언을 가진 하나의 언어이므로 한 번만 셉니다: 모두 {n}개 언어입니다.",
    "lv": "Kurdu valoda ir viena valoda ar diviem dialektiem, sorani un kurmandži, tāpēc to skaita vienreiz: kopā {n} valodas.",
    "lt": "Kurdų kalba yra viena kalba su dviem tarmėmis, sorani ir kurmandži, todėl ji skaičiuojama vieną kartą: iš viso {n} kalbų.",
    "ms": "Bahasa Kurdi ialah satu bahasa dengan dua dialek, Sorani dan Kurmanji, jadi ia dikira sekali: {n} bahasa kesemuanya.",
    "mr": "कुर्दी ही सोरानी आणि कुरमांजी या दोन बोलींची एकच भाषा आहे, म्हणून ती एकदाच मोजली जाते: एकूण {n} भाषा.",
    "no": "Kurdisk er ett språk med to dialekter, sorani og kurmanji, så det telles én gang: {n} språk i alt.",
    "pl": "Kurdyjski to jeden język z dwoma dialektami, sorani i kurmandżi, dlatego liczy się go raz: łącznie {n} języków.",
    "pt": "O curdo é uma só língua com dois dialetos, o sorani e o kurmanji, por isso conta uma vez: {n} línguas no total.",
    "br": "O curdo é um único idioma com dois dialetos, sorani e kurmanji, por isso conta uma vez só: {n} idiomas no total.",
    "pa": "ਕੁਰਦੀ ਇੱਕੋ ਭਾਸ਼ਾ ਹੈ ਜਿਸ ਦੀਆਂ ਦੋ ਉਪ-ਬੋਲੀਆਂ ਹਨ, ਸੋਰਾਨੀ ਅਤੇ ਕੁਰਮਾਂਜੀ, ਇਸ ਲਈ ਇਸ ਨੂੰ ਇੱਕ ਵਾਰ ਗਿਣਿਆ ਜਾਂਦਾ ਹੈ: ਕੁੱਲ {n} ਭਾਸ਼ਾਵਾਂ।",
    "ro": "Kurda este o singură limbă cu două dialecte, sorani și kurmanji, de aceea se numără o dată: {n} de limbi în total.",
    "ru": "Курдский — один язык с двумя диалектами, сорани и курманджи, поэтому он считается один раз: всего {n} языков.",
    "sr": "Курдски је један језик са два дијалекта, сорани и курманџи, па се рачуна једном: укупно {n} језика.",
    "sk": "Kurdčina je jeden jazyk s dvoma nárečiami, soránčinou a kurmándžčinou, preto sa počíta raz: spolu {n} jazykov.",
    "sl": "Kurdščina je en jezik z dvema narečjema, soranijem in kurmandžijem, zato šteje enkrat: skupaj {n} jezikov.",
    "es": "El kurdo es una sola lengua con dos dialectos, el sorani y el kurmanji, por eso cuenta una vez: {n} idiomas en total.",
    "sw": "Kikurdi ni lugha moja yenye lahaja mbili, Kisorani na Kikurmanji, kwa hiyo huhesabiwa mara moja: lugha {n} kwa jumla.",
    "se": "Kurdiska är ett språk med två dialekter, sorani och kurmanji, så det räknas en gång: {n} språk totalt.",
    "ta": "குர்திஷ் என்பது சொரானி, குர்மாஞ்சி என இரண்டு வட்டார வழக்குகளைக் கொண்ட ஒரே மொழி, எனவே ஒருமுறை மட்டுமே எண்ணப்படுகிறது: மொத்தம் {n} மொழிகள்.",
    "te": "కుర్దిష్ సొరానీ, కుర్మాంజీ అనే రెండు మాండలికాలు ఉన్న ఒకే భాష, కాబట్టి దీన్ని ఒక్కసారే లెక్కిస్తారు: మొత్తం {n} భాషలు.",
    "th": "ภาษาเคิร์ดเป็นภาษาเดียวที่มีสองสำเนียง คือโซรานีและคุรมันจี จึงนับเพียงครั้งเดียว: รวม {n} ภาษา",
    "tr": "Kürtçe, Sorani ve Kurmanci olmak üzere iki lehçesi olan tek bir dildir; bu yüzden bir kez sayılır: toplam {n} dil.",
    "uk": "Курдська — одна мова з двома діалектами, сорані та курманджі, тому вона рахується один раз: загалом {n} мов.",
    "ur": "کردی ایک ہی زبان ہے جس کی دو بولیاں ہیں، سورانی اور کرمانجی، اس لیے اسے ایک بار گنا جاتا ہے: کل {n} زبانیں۔",
    "vi": "Tiếng Kurd là một ngôn ngữ với hai phương ngữ, Sorani và Kurmanji, nên chỉ tính một lần: tổng cộng {n} ngôn ngữ.",
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
