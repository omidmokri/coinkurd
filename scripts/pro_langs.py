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
LANGS = [
    ("ckb", "کوردی", "Kurdish (Sorani)", "ckb-IQ", "ckb", "rtl", "IRT"),
    ("kmr", "Kurmancî", "Kurdish (Kurmanji)", "kmr-TR", "kmr", "ltr", "TRY"),
    ("fa", "فارسی", "Persian", "fa-IR", "fa", "rtl", "IRT"),
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
    ("en", "English", "English", "en-GB", "en", "ltr", "USD"),
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
            "  P.FLAG = " + json.dumps(FLAG, separators=(",", ":"), sort_keys=True) + ";\n"
            "  P.FLAG_DIR = " + json.dumps(FLAG_DIR) + ";\n"
            "  P.flag = function (c) { var f = P.FLAG[c]; return f ? P.FLAG_DIR + f + \".svg\" : \"\"; };\n"
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
