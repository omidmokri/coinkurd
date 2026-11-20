#!/usr/bin/env python3
"""The /market/ language table (scripts/pro_langs.py → assets/pro/langs.js):
  * langs.js is exactly what the table makes (nobody edited the generated file);
  * the owner's list (2026-11-15): 43 new languages with the paths he gave, plus the site's own four; Kurdish first,
    English last; right-to-left for Kurdish, Persian, Arabic, Hebrew and Urdu only;
  * every home currency exists, and the time-zone table sends a visitor to the currency of their country
    (Tehran → toman, Sofia → euro since 2026, Kolkata → rupee, both old and new IANA names).
Run: python3 tests/test_pro_langs.py"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import pro_langs as PL  # noqa: E402

FAILS = []


def ok(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f" — {extra}" if extra and not cond else ""))
    if not cond:
        FAILS.append(name)


OWNER = {  # the owner's list: English name -> path (the last eleven came without one: their ISO code)
    "Arabic": "ar", "Bulgarian": "bg", "Catalan": "cat", "Chinese (Simplified)": "cn", "Chinese (Traditional)": "tw",
    "Croatian": "hr", "Czech": "cz", "Danish": "da", "Dutch": "nl", "English": "en", "Finnish": "fi", "French": "fr",
    "German": "de", "Greek": "gr", "Hebrew": "iw", "Hungarian": "hu", "Italian": "it", "Japanese": "jp", "Korean": "kr",
    "Latvian": "lv", "Lithuanian": "lt", "Norwegian": "no", "Persian": "fa", "Polish": "pl", "Portuguese (Brazil)": "br", "Punjabi": "pa",
    "Portuguese": "pt", "Romanian": "ro", "Russian": "ru", "Serbian": "sr", "Slovak": "sk", "Spanish": "es", "Swahili": "sw", "Swedish": "se",
    "Thai": "th", "Turkish": "tr", "Ukrainian": "uk", "Bengali": "bn", "Estonian": "et", "Filipino": "fil", "Hindi": "hi",
    "Indonesian": "id", "Malay": "ms", "Marathi": "mr", "Slovenian": "sl", "Tamil": "ta", "Telugu": "te", "Urdu": "ur", "Vietnamese": "vi",
}


def main():
    r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "pro_langs.py"), "--check"], capture_output=True, text=True)
    ok("assets/pro/langs.js is what scripts/pro_langs.py makes", r.returncode == 0, r.stdout + r.stderr)
    by_en = {row[2]: row[0] for row in PL.LANGS}
    ok("all 46 languages of the owner's list, with his paths", all(by_en.get(k) == v for k, v in OWNER.items()), {k: (by_en.get(k), v) for k, v in OWNER.items() if by_en.get(k) != v})
    ok("51 in all (the owner's 50 + Kurmanji), 47 of them new", len(PL.LANGS) == 51 and len(PL.NEW) == 47 and set(PL.SITE) == {"ckb", "fa", "ar", "en"})
    ok("menu order: both Kurdish first, then Persian and Arabic, English last", [x[0] for x in PL.LANGS[:4]] == ["ckb", "kmr", "fa", "ar"] and PL.LANGS[-1][0] == "en")
    mid = [x[2] for x in PL.LANGS[4:-1]]
    ok("…the others by English name", mid == sorted(mid), mid)
    ok("right to left: Kurdish, Persian, Arabic, Hebrew, Urdu — and only those", sorted(x[0] for x in PL.LANGS if x[5] == "rtl") == ["ar", "ckb", "fa", "iw", "ur"])
    ok("paths are URL-safe and unique", all(re.fullmatch(r"[a-z]{2,3}", x[0]) for x in PL.LANGS) and len({x[0] for x in PL.LANGS}) == 51)
    js = subprocess.run(["node", "-e", "global.window=globalThis;require(process.argv[1]);process.stdout.write(JSON.stringify({L:PRO.LANGS.length,"
                         "teh:PRO.CCCUR[PRO.TZCC['Asia/Tehran']],sof:PRO.CCCUR[PRO.TZCC['Europe/Sofia']],kol:PRO.CCCUR[PRO.TZCC['Asia/Kolkata']],cal:PRO.CCCUR[PRO.TZCC['Asia/Calcutta']],"
                         "kyiv:PRO.CCCUR[PRO.TZCC['Europe/Kyiv']],kiev:PRO.CCCUR[PRO.TZCC['Europe/Kiev']],bag:PRO.CCCUR[PRO.TZCC['Asia/Baghdad']],utc:PRO.TZCC['UTC']||null,"
                         "jpy:PRO.CUR_DIG.JPY,irt:PRO.CUR_DIG.IRT,eur:PRO.CUR_DIG.EUR||2}))", os.path.join(ROOT, "assets", "pro", "langs.js")], capture_output=True, text=True)
    j = json.loads(js.stdout or "{}")
    ok("time zone → currency: Tehran toman, Sofia euro, Kolkata/Calcutta rupee, Kyiv/Kiev hryvnia, Baghdad dinar", j.get("teh") == "IRT" and j.get("sof") == "EUR" and j.get("kol") == "INR" and j.get("cal") == "INR"
       and j.get("kyiv") == "UAH" and j.get("kiev") == "UAH" and j.get("bag") == "IQD", j)
    ok("UTC names no country (the language decides then)", j.get("utc") is None)
    ok("digits: yen and toman none, euro two", j.get("jpy") == 0 and j.get("irt") == 0 and j.get("eur") == 2, j)
    cur = set(PL.cc_cur().values()) | {"USD", "IRT"}
    ok("every home currency is a real one", all(x[6] in cur for x in PL.LANGS), [x for x in PL.LANGS if x[6] not in cur])
    flags = os.path.join(ROOT, "assets", "pro", "flags")
    miss = [c for c in cur if not c.startswith("X") and not os.path.exists(os.path.join(flags, ("eu" if c == "EUR" else "ir" if c == "IRT" else c[:2].lower()) + ".svg"))]
    ok("every currency has its flag (the site rule: nothing shown without its own picture)", not miss and os.path.exists(os.path.join(ROOT, "assets", "pro", "ic", "cur.svg")), miss)
    big = [f for f in os.listdir(flags) if f.endswith(".svg") and os.path.getsize(os.path.join(flags, f)) > 25000]
    ok("no flag over 25 kB (coats of arms are kept as a small picture inside the SVG)", not big, big)
    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nOK")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
