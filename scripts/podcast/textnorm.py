"""Turn the display script (what listeners read in the transcript) into what each voice should say.

The voices read through espeak-ng. espeak guesses the short vowels of Persian loanwords and reads
"بیت‌کوین" as "beyt-kavin"; it reads thousands separators as "comma"; it cannot read clock times.
Each language therefore gets: a pronunciation lexicon (checked word by word with pipeline/phon.py),
and number / time / percent normalisation. Nothing here changes a number's value.
"""
import re

from num2words import num2words

FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")

# ---------------------------------------------------------------- lexicons (display word -> spoken spelling)
LEX = {
    "fa": {
        "بیت‌کوین": "بیتْکُیْن", "بیتکوین": "بیتْکُیْن", "آلت‌کوین‌ها": "آلْت‌کُیْن‌ها", "آلت‌کوین": "آلْت‌کُیْن",
        "تتر": "تِتِر", "تتری": "تِتِری", "ترون": "تْرُن", "بلک‌راک": "بِلَک‌راک", "متاپلنت": "مِتاپْلَنِت", "لانگ": "لانْگ", "شورت": "شُرْت",
        "دامیننس": "دامینِنْس", "کوین کورد": "کُیْن کورْد", "آی‌بیت": "آیْبیتْ", "نیر": "نییِر", "پپه": "پِپِه",
        "کندل": "کَندِل", "کندل‌های": "کَندِل‌های", "تایم‌فریم": "تایمْ‌فْرِیم", "وارن": "وارِن", "کوین‌دسک": "کُیْن دِسْک",
        "دیکریپت": "دیکْریپْت", "اوکی‌ایکس": "اوکِی ایکْس", "استاک‌تو‌فلو": "اِستاکْ تو فْلو", "پلی‌مارکت": "پالی‌مارْکِت",
        "کلشی": "کَلْشی", "چین‌آنالیسیس": "چِین‌آنالیسیس", "انویدیا": "اِنویدیا", "نزدک": "نَزْدَک", "اتریوم": "اِتریوم",
        "استراتژی": "اِستراتِژی", "بایننس‌کوین": "بایْنَنْس‌کُیْن", "اِم‌اِس‌سی‌آی": "اِم‌اِس‌سی‌آی", "آر‌اس‌آی": "آر‌اِس‌آی",
        "لیکویید": "لیکْوید", "جی‌پی‌مورگان": "جی‌پی مُرْگان", "اس‌اند‌پی": "اِس اَند پی", "انتخاب دات نت": "اِنتِخاب دات نِت",
        "اینیشیا": "اینیشیا", "مرکلی": "مِرکلی", "دویچه‌بانک": "دویچه‌بانک", "کریپتو": "کْریپْتو",
    },
    "tr": {
        "Bitcoin'in": "Bitkoyn'in", "Bitcoin'i": "Bitkoyn'i", "Bitcoin'e": "Bitkoyn'e", "Bitcoin'de": "Bitkoyn'de",
        "Bitcoin": "Bitkoyn", "Ethereum'un": "Eteryum'un", "Ethereum": "Eteryum", "BlackRock'ın": "Blekrok'un", "BlackRock": "Blekrok",
        "ETF'lerden": "e te fe'lerden", "ETF'lerin": "e te fe'lerin", "ETF'ler": "e te fe'ler", "ETF": "e te fe",
        "MSCI'ın": "em es si ay'ın", "MSCI": "em es si ay", "Strategy'nin": "Strateci'nin", "Strategy": "Strateci",
        "Metaplanet": "Metaplanet", "Nvidia'nın": "Envidya'nın", "Nvidia": "Envidya", "Deutsche Bank": "Doyçe Bank",
        "Tether": "Teter", "Chainalysis": "Çeynalisis", "Kalshi": "Kalşi", "Polymarket": "Polimarket", "RSI": "ar es ay",
        "OKX": "o ke iks", "S&P 500": "es end pi beş yüz", "BNB": "bi en bi", "Coin Kurd": "Koyn Kurd",
        "entekhab.net": "Entehab nokta net", "IBIT": "ay bit", "PEPE": "Pepe", "NEAR": "Nir", "Initia": "İnişya",
        "JPMorgan": "Cey Pi Morgan", "UTC": "u te ce", "TSİ": "Türkiye saatiyle", "S2F": "stok tu flou", "CoinDesk": "Koyndesk",
        "Decrypt": "Dikript", "short": "şort", "Warren": "Vorın", "Merkley": "Mörkli", "Tron": "Tron", "PPI": "pe pe i",
        "kripto": "kripto", "coin": "koyn", "coinin": "koynin", "coinler": "koynler", "coinlerin": "koynlerin",
        "Altcoin": "Altkoyn", "ERA": "Era", "ONE": "Van", "altcoin": "altkoyn", "altcoinler": "altkoynler", "altcoinlerin": "altkoynlerin", "altcoinlerde": "altkoynlerde",
    },
    "en": {
        "MSCI": "M S C I", "OKX": "O K X", "RSI": "R S I", "UTC": "U T C", "ETF": "E T F", "ETFs": "E T Fs", "PPI": "P P I",
        "entekhab.net": "Entekab dot net", "Entekhab": "Entekab", "S2F": "stock to flow", "BNB": "B N B", "JPMorgan": "J P Morgan",
        "CPI": "C P I", "Initia": "Initia",
    },
    "ar": {"بِالْمِئَةِ": "بِلْمِئَةِ"},  # hamzat al-wasl: "bil-mi'a", not "bi-al-mi'a"
}


def _apply_lex(text, lang):
    lex = LEX.get(lang) or {}
    for k in sorted(lex, key=len, reverse=True):
        if lang in ("fa", "ar"):
            text = re.sub(r"(?<![\w‌])" + re.escape(k) + r"(?![\w‌])", lex[k], text)
        else:
            text = re.sub(r"(?<![\w'])" + re.escape(k) + r"(?![\w])", lex[k], text)
    return text


# ---------------------------------------------------------------- numbers
TR_ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"]
TR_TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"]


def tr_int(n):
    if n == 0:
        return "sıfır"
    parts = []
    for val, name in ((10 ** 9, "milyar"), (10 ** 6, "milyon"), (1000, "bin")):
        if n >= val:
            q, n = divmod(n, val)
            parts.append(name if (val == 1000 and q == 1) else tr_int(q) + " " + name)
    if n >= 100:
        h, n = divmod(n, 100)
        parts.append("yüz" if h == 1 else TR_ONES[h] + " yüz")
    if n >= 10:
        parts.append(TR_TENS[n // 10]); n %= 10
    if n:
        parts.append(TR_ONES[n])
    return " ".join(parts)


def _frac_words(frac, lang):
    """Digits after the decimal point, read as a number the way broadcasters do (1.24 -> one point two four in en)."""
    if lang == "en":
        return " ".join(num2words(int(d), lang="en") for d in frac)
    if lang == "tr":
        return " ".join(tr_int(int(d)) for d in frac) if frac.startswith("0") else tr_int(int(frac))
    if lang == "ar":
        return " ".join(num2words(int(d), lang="ar") for d in frac) if frac.startswith("0") else num2words(int(frac), lang="ar")
    raise ValueError(lang)


def _decimal(intpart, frac, lang):
    i = int(intpart)
    if lang == "fa":
        w = num2words(float(f"{intpart}.{frac}"), lang="fa")
        return w[len("صفر و "):] if i == 0 and w.startswith("صفر و ") else w
    if lang == "en":
        return f"{num2words(i, lang='en')} point {_frac_words(frac, 'en')}"
    if lang == "tr":
        return f"{tr_int(i)} virgül {_frac_words(frac, 'tr')}"
    if lang == "ar":  # espeak reads Arabic digits with full vowels; spelled-out words come without them
        return f"{i} فاصلة {' '.join(frac) if frac.startswith('0') else int(frac)}"


def _clock(h, m, lang):
    h, m = int(h), int(m)
    if lang == "fa":
        hw = num2words(h, lang="fa")
        return hw if m == 0 else (hw + " و نیم" if m == 30 else f"{hw} و {num2words(m, lang='fa')} دقیقه")
    if lang == "en":
        return num2words(h, lang="en") + ("" if m == 0 else (" oh " + num2words(m, lang="en") if m < 10 else " " + num2words(m, lang="en")))
    if lang == "tr":
        return tr_int(h) + ("" if m == 0 else " " + tr_int(m))
    if lang == "ar":
        return num2words(h, lang="ar") + ("" if m == 0 else " و" + num2words(m, lang="ar") + " دقيقة")


def normalize(text, lang):
    t = text.translate(FA_DIGITS)
    t = _apply_lex(t, lang)
    t = t.replace("\u0652\u0650", "\u0650")  # respelled word ending in sukun, then an ezafe kasre
    # clock times 13:30
    t = re.sub(r"\b(\d{1,2}):(\d{2})\b", lambda m: _clock(m.group(1), m.group(2), lang), t)
    if lang == "tr":  # Turkish: 73.071 thousands, 1,24 decimal, %1,2 percent first
        t = re.sub(r"(?<=\d)\.(?=\d{3}\b)", "", t)
        t = re.sub(r"%\s?(\d+(?:,\d+)?)", r"yüzde \1", t)
        t = re.sub(r"\b(\d+),(\d+)\b", lambda m: _decimal(m.group(1), m.group(2), "tr"), t)
        t = re.sub(r"\b\d+\b", lambda m: tr_int(int(m.group(0))), t)
        return re.sub(r"\s+", " ", t).strip()
    # fa / en / ar: 73,071 or 73٬071 thousands; 1.24 or 1٫24 decimal
    t = re.sub(r"(?<=\d)[,٬](?=\d{3}\b)", "", t)
    if lang == "en":
        t = re.sub(r"\$(\d+(?:\.\d+)?)\s?(trillion|billion|million|thousand)", r"\1 \2 dollars", t)
        t = re.sub(r"\$(\d+(?:\.\d+)?)", r"\1 dollars", t)
    t = re.sub(r"\b(\d+)[.٫](\d+)\b", lambda m: _decimal(m.group(1), m.group(2), lang), t)
    if lang == "en":
        t = t.replace("%", " percent")
        t = re.sub(r"(?<!\w)-(\d)", r"minus \1", t)
    return re.sub(r"\s+", " ", t).strip()


def strip_diacritics(text):
    """Arabic display text: the voice reads the vowelled script, readers get the usual unvowelled one."""
    return re.sub(r"[ً-ْٰ]", "", text)


if __name__ == "__main__":
    tests = {"fa": "بیت‌کوین حدود ۷۳٬۰۷۱ دلار است، ۱٫۲ درصد پایین‌تر؛ ساعت ۱۷:۰۰ و ۱۵:۰۷ و ۰٫۸۲ درصد.",
             "en": "Bitcoin trades near $73,071, down 1.2%; total value $2.42 trillion at 13:30 UTC; MSCI and OKX; -20.",
             "tr": "Bitcoin 73.071 dolar, %1,2 düşüşle; 2,42 trilyon dolar; TSİ 16:30; MSCI ve ETF'ler; 0,82.",
             "ar": "البيتكوين عند 73,071 دولاراً، بانخفاض 1.2 بالمئة؛ الساعة 13:30؛ 0.82."}
    for k, v in tests.items():
        print(k, "|", normalize(v, k))
