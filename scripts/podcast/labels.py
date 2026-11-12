"""Names, dates and digits for the four versions of the daily podcast (fa, ckb, en, ar).

Dates are computed here, never written by the model: the Persian/Sorani solar (Jalali) date, the Gregorian date
and the weekday, each in the language's own words and digits.
"""
import datetime as dt

LANGS = ("fa", "ckb", "en", "ar")
DIR = {"fa": "rtl", "ckb": "rtl", "en": "ltr", "ar": "rtl"}

SHOW = {
    "fa": ("نبض کریپتو", "نبض کریپتو؛ گزارش روزانه بازار و فرصت‌های معاملاتی"),
    "ckb": ("نەبزی کریپتۆ", "نەبزی کریپتۆ؛ ڕاپۆرتی ڕۆژانەی بازاڕ و دەرفەتەکانی مامەڵە"),
    "en": ("Crypto Intelligence Daily", "Crypto Intelligence Daily | The daily pulse of the crypto market"),
    "ar": ("نبض الكريبتو", "نبض الكريبتو | التقرير اليومي لسوق العملات المشفرة"),
}
LANG_NAME = {"fa": "فارسی", "ckb": "کوردی سۆرانی", "en": "English", "ar": "العربية"}
# how each version is labelled where all four sit together (Telegram album, site tabs)
TAG = {"fa": "🟢 فارسی", "ckb": "☀️ کوردی (سۆرانی)", "en": "🔵 English", "ar": "🟠 العربية"}

SECTION_IDS = ("open", "market", "news", "technical", "fundamental", "opportunities", "calendar", "lesson", "summary", "outro")
SECTION_TITLES = {
    "fa": ("شروع برنامه", "خلاصه وضعیت بازار", "مهم‌ترین اخبار روز", "تحلیل تکنیکال", "تحلیل فاندامنتال",
           "فرصت‌ها و هشدارهای معاملاتی", "تقویم رویدادها", "نکته آموزشی روز", "جمع‌بندی", "پایان برنامه"),
    "ckb": ("دەستپێکی بەرنامە", "پوختەی دۆخی بازاڕ", "گرنگترین هەواڵەکانی ئەمڕۆ", "شیکاری تەکنیکی", "شیکاری بنەڕەتی",
            "دەرفەت و ئاگادارییەکانی مامەڵە", "ڕۆژژمێری ڕووداوەکان", "خاڵی فێرکاریی ئەمڕۆ", "کورتەی ئەمڕۆ", "کۆتایی بەرنامە"),
    "en": ("Opening", "Market overview", "Top stories", "Technical analysis", "Fundamentals",
           "Opportunities and risk warnings", "Events calendar", "Lesson of the day", "Wrap-up", "Closing"),
    "ar": ("الافتتاح", "ملخص حالة السوق", "أهم أخبار اليوم", "التحليل الفني", "التحليل الأساسي",
           "الفرص والتحذيرات", "مفكرة الأحداث", "درس اليوم", "الخلاصة", "الختام"),
}

FA_DIG = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
AR_DIG = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def digits(s, lang):
    s = str(s)
    if lang == "fa":
        return s.translate(FA_DIG)
    if lang == "ckb":
        return s.translate(AR_DIG)
    return s


# ------------------------------------------------------------------ Jalali (solar Hijri) calendar
def to_jalali(d):
    """Gregorian date -> (jy, jm, jd). The standard arithmetic conversion (valid for 1600-2600)."""
    gy, gm, gd = d.year, d.month, d.day
    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    gy2 = gy + 1 if gm > 2 else gy
    days = 355666 + (365 * gy) + ((gy2 + 3) // 4) - ((gy2 + 99) // 100) + ((gy2 + 399) // 400) + gd + g_d_m[gm - 1]
    jy = -1595 + (33 * (days // 12053))
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm, jd = 1 + days // 31, 1 + days % 31
    else:
        jm, jd = 7 + (days - 186) // 30, 1 + (days - 186) % 30
    return jy, jm, jd


FA_JM = ("فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند")
CKB_JM = ("خاکەلێوە", "گوڵان", "جۆزەردان", "پووشپەڕ", "گەلاوێژ", "خەرمانان", "ڕەزبەر", "گەڵاڕێزان", "سەرماوەز",
          "بەفرانبار", "ڕێبەندان", "ڕەشەمە")
FA_GM = ("ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر")
CKB_GM = ("کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەمموز", "ئاب", "ئەیلوول", "تشرینی یەکەم",
          "تشرینی دووەم", "کانوونی یەکەم")
AR_GM = ("يناير (كانون الثاني)", "فبراير (شباط)", "مارس (آذار)", "أبريل (نيسان)", "مايو (أيار)", "يونيو (حزيران)",
         "يوليو (تموز)", "أغسطس (آب)", "سبتمبر (أيلول)", "أكتوبر (تشرين الأول)", "نوفمبر (تشرين الثاني)", "ديسمبر (كانون الأول)")
EN_GM = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
# Monday first, as datetime.weekday()
WD = {"fa": ("دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه", "یکشنبه"),
      "ckb": ("دووشەممە", "سێشەممە", "چوارشەممە", "پێنجشەممە", "هەینی", "شەممە", "یەکشەممە"),
      "en": ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"),
      "ar": ("الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد")}


def date_label(d, lang):
    jy, jm, jd = to_jalali(d)
    w = WD[lang][d.weekday()]
    if lang == "fa":
        return digits(f"{w} {jd} {FA_JM[jm - 1]} {jy} · {d.day} {FA_GM[d.month - 1]} {d.year}", "fa")
    if lang == "ckb":
        return digits(f"{w} {jd}ی {CKB_JM[jm - 1]}ی {jy} · {d.day}ی {CKB_GM[d.month - 1]}ی {d.year}", "ckb")
    if lang == "ar":
        return f"{w} {d.day} {AR_GM[d.month - 1]} {d.year}"
    return f"{w}, {d.day} {EN_GM[d.month - 1]} {d.year}"


def jalali_text(d, lang):
    jy, jm, jd = to_jalali(d)
    if lang == "fa":
        return digits(f"{jd} {FA_JM[jm - 1]} {jy}", "fa")
    if lang == "ckb":
        return digits(f"{jd}ی {CKB_JM[jm - 1]}ی {jy}", "ckb")
    return f"{jy}-{jm:02d}-{jd:02d}"


def episode_label(n, lang):
    return {"fa": f"قسمت {digits(n, 'fa')}", "ckb": f"ئەڵقەی {digits(n, 'ckb')}",
            "en": f"Episode {n}", "ar": f"الحلقة {n}"}[lang]


if __name__ == "__main__":
    d = dt.date(2026, 11, 12)
    assert to_jalali(d) == (1405, 8, 21), to_jalali(d)
    assert to_jalali(dt.date(2026, 3, 21)) == (1405, 1, 1)      # Nowruz 1405
    assert to_jalali(dt.date(2025, 3, 21)) == (1404, 1, 1)
    assert to_jalali(dt.date(2026, 3, 20)) == (1404, 12, 29)
    for l in LANGS:
        print(l, date_label(d, l), "|", episode_label(7, l))
    print("labels ok")
