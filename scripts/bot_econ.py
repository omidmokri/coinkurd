#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The economic calendar in Telegram (owner's request, 2026-11-13).

  * 30 minutes before every red US release (FOMC included) a heads-up goes to @Coin_Kurd_Group, topic 47540
    («اخبار اقتصادی»): the events, Tehran/Erbil time, forecast and previous, how bitcoin usually moved after the same
    release, what a beat or a miss usually means, and Kalshi's odds for the next FOMC meeting.
  * after the release the result is posted as a reply to that message: the official number (BLS / the Fed's own
    statement, through econ_src), beat or miss, and bitcoin's move since the minute of the release.
  * the same two messages go privately to every bot user who switched them on (opt-in, owner's choice) — section
    «📅 تقویم اقتصادی» (key "events"), deep link t.me/<bot>?start=ec, callbacks ec:on / ec:off.
  * each user picks their own clock and lead times (owner's request, 2026-11-13): x["tz"] is a city from ZONES (IANA,
    summer time handled) or a fixed "o<minutes>" offset from UTC; x["ecl"] the minutes before a release to be told
    (several allowed). Callbacks ec:tz / ez:<zone> and ec:ld / el:<minutes>; the site's bot link hands its settings
    over as ?start=ec_<zone>_l<minutes> (apply_link). The group posts keep Tehran / Erbil / UTC.

tick() is called from refbot.minute_jobs (about once a minute) and is idempotent: what was sent is kept in
s["econ"], which lives in the bot's state branch like everything else. Self-test: python3 scripts/bot_econ.py
"""
import html
import time
from datetime import datetime, timezone, timedelta

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

import econ_src as S
from bot_i18n import pick

SITE = "https://entekhab.net"
PAGE = SITE + "/calendar/"
TOPIC = 47540
PRE_MIN, PRE_LATEST = 30 * 60, 8 * 60          # heads-up 30 min before; still sent if the bot comes up late, not under 8 min
RESULT_GIVEUP = 45 * 60                         # post whatever we have 45 min after the release
TEHRAN = timezone(timedelta(hours=3, minutes=30))
ERBIL = timezone(timedelta(hours=3))
LANGS = ("fa", "ckb", "en", "ar", "kmr")

# the cities a user can pick (summer time follows the city); the same list is in /calendar/cal.js
ZONES = [
    ("Asia/Tehran", "تهران", "تاران", "Tehran", "طهران", "Tehran"),
    ("Asia/Baghdad", "هولیر و بغداد", "هەولێر و بەغدا", "Erbil & Baghdad", "أربيل وبغداد", "Hewlêr û Bexda"),
    ("Europe/Istanbul", "استانبول و آنکارا", "ئەستەنبوڵ و ئەنقەرە", "Istanbul & Ankara", "إسطنبول وأنقرة", "Stenbol û Enqere"),
    ("Asia/Damascus", "دمشق", "دیمەشق", "Damascus", "دمشق", "Şam"),
    ("Asia/Dubai", "دبی", "دوبەی", "Dubai", "دبي", "Dubai"),
    ("Asia/Kabul", "کابل", "کابول", "Kabul", "كابول", "Kabul"),
    ("Europe/Moscow", "مسکو", "مۆسکۆ", "Moscow", "موسكو", "Moskova"),
    ("Europe/London", "لندن", "لەندەن", "London", "لندن", "London"),
    ("Europe/Berlin", "برلین، پاریس، آمستردام", "بەرلین، پاریس، ئەمستەردام", "Berlin, Paris, Amsterdam", "برلين، باريس، أمستردام", "Berlîn, Parîs, Amsterdam"),
    ("Europe/Stockholm", "استکهلم، اسلو، کپنهاگ", "ستۆکهۆڵم، ئۆسلۆ، کۆپنهاگن", "Stockholm, Oslo, Copenhagen", "ستوكهولم، أوسلو، كوبنهاغن", "Stockholm, Oslo, Kopenhag"),
    ("Europe/Helsinki", "هلسینکی و آتن", "هێلسینکی و ئەسینا", "Helsinki & Athens", "هلسنكي وأثينا", "Helsînkî û Atîna"),
    ("America/New_York", "نیویورک و تورنتو", "نیویۆرک و تۆرۆنتۆ", "New York & Toronto", "نيويورك وتورنتو", "New York û Toronto"),
    ("America/Chicago", "شیکاگو", "شیکاگۆ", "Chicago", "شيكاغو", "Chicago"),
    ("America/Los_Angeles", "لس‌آنجلس و ونکوور", "لۆس ئەنجلس و ڤانکۆڤەر", "Los Angeles & Vancouver", "لوس أنجلوس وفانكوفر", "Los Angeles û Vancouver"),
    ("Asia/Tokyo", "توکیو", "تۆکیۆ", "Tokyo", "طوكيو", "Tokyo"),
    ("Australia/Sydney", "سیدنی و ملبورن", "سیدنی و مێلبۆرن", "Sydney & Melbourne", "سيدني وملبورن", "Sydney û Melbourne"),
]
ZNAME = {z[0]: dict(zip(("fa", "ckb", "en", "ar", "kmr"), z[1:])) for z in ZONES}
# every offset from UTC in use somewhere, in minutes (for a fixed clock without summer time)
OFFSETS = [-720, -660, -600, -570, -540, -480, -420, -360, -300, -240, -210, -180, -120, -60, 0, 60, 120, 180, 210, 240, 270,
           300, 330, 345, 360, 390, 420, 480, 525, 540, 570, 600, 630, 660, 720, 765, 780, 840]
LEADS = [5, 10, 15, 30, 60, 120, 240, 1440]     # minutes before a release a user can be told (several at once)
DEF_LEAD = [30]

T = {
    "pre_h": {"fa": "⏰ <b>{m} تا خبر مهم آمریکا</b>", "ckb": "⏰ <b>{m} ماوە بۆ هەواڵی گرنگی ئەمریکا</b>",
              "en": "⏰ <b>{m} to a key US release</b>", "ar": "⏰ <b>{m} على خبر أمريكي مهم</b>",
              "kmr": "⏰ <b>{m} heta nûçeya girîng a DYA</b>"},
    "u_min": {"fa": "دقیقه", "ckb": "خولەک", "en": "min", "ar": "دقيقة", "kmr": "deqe"},
    "u_hour": {"fa": "ساعت", "ckb": "کاتژمێر", "en": "h", "ar": "ساعة", "kmr": "saet"},
    "u_day": {"fa": "روز", "ckb": "ڕۆژ", "en": "day", "ar": "يوم", "kmr": "roj"},
    "sep": {"fa": "، ", "ckb": "، ", "en": ", ", "ar": "، ", "kmr": ", "},
    "and": {"fa": " و ", "ckb": " و ", "en": " and ", "ar": " و", "kmr": " û "},
    "when_u": {"fa": "🕐 {d}، ساعت <b>{h}</b> به وقت شما — {z}", "ckb": "🕐 {d}، کاتژمێر <b>{h}</b> بە کاتی خۆت — {z}",
               "en": "🕐 {d}, <b>{h}</b> your time — {z}", "ar": "🕐 {d}، الساعة <b>{h}</b> بتوقيتك — {z}",
               "kmr": "🕐 {d}, saet <b>{h}</b> bi dema te — {z}"},
    "sec_tz": {"fa": "🕐 ساعت‌ها به وقت: <b>{z}</b>", "ckb": "🕐 کاتەکان بە کاتی: <b>{z}</b>", "en": "🕐 Times in: <b>{z}</b>",
               "ar": "🕐 الأوقات بتوقيت: <b>{z}</b>", "kmr": "🕐 Dem bi: <b>{z}</b>"},
    "b_tz": {"fa": "🕐 منطقهٔ زمانی: {z} · تغییر", "ckb": "🕐 ناوچەی کات: {z} · گۆڕین", "en": "🕐 Time zone: {z} · change",
             "ar": "🕐 المنطقة الزمنية: {z} · تغيير", "kmr": "🕐 Herêma demê: {z} · biguherîne"},
    "b_ld": {"fa": "⏱ زمان هشدار: {l} قبل · تغییر", "ckb": "⏱ کاتی ئاگاداری: {l} پێشتر · گۆڕین", "en": "⏱ Alert: {l} before · change",
             "ar": "⏱ التنبيه: قبل {l} · تغيير", "kmr": "⏱ Hişyarî: {l} berê · biguherîne"},
    "tz_h": {"fa": "🕐 <b>منطقهٔ زمانی شما</b>\n\nساعت خبرها و پیام‌های خصوصی بر اساس انتخاب شما نوشته می‌شود. الان: <b>{z}</b>\n\n"
                   "• شهر را بزنید تا تغییر ساعت تابستانی خودکار حساب شود.\n• یا اختلاف ساعت با گرینویچ (UTC) را مستقیم انتخاب کنید؛ مثلاً تهران +3:30 و هولیر +3 است.",
             "ckb": "🕐 <b>ناوچەی کاتی تۆ</b>\n\nکاتی هەواڵەکان و پەیامە تایبەتەکان بەپێی هەڵبژاردنی تۆ دەنووسرێت. ئێستا: <b>{z}</b>\n\n"
                    "• شارەکە هەڵبژێرە تا گۆڕانی کاتی هاوین خۆکار حیساب بکرێت.\n• یان جیاوازیی کات لەگەڵ گرینویچ (UTC) ڕاستەوخۆ هەڵبژێرە؛ بۆ نموونە هەولێر +3 و تاران +3:30.",
             "en": "🕐 <b>Your time zone</b>\n\nRelease times and your private alerts follow your choice. Now: <b>{z}</b>\n\n"
                   "• Pick a city and summer time is handled for you.\n• Or pick your offset from Greenwich (UTC) directly — e.g. Tehran +3:30, Erbil +3.",
             "ar": "🕐 <b>منطقتك الزمنية</b>\n\nأوقات الأخبار وتنبيهاتك الخاصة تتبع اختيارك. الآن: <b>{z}</b>\n\n"
                   "• اختر مدينة ليُحسب التوقيت الصيفي تلقائياً.\n• أو اختر فرق التوقيت عن غرينتش (UTC) مباشرة — مثلاً أربيل +3 وطهران +3:30.",
             "kmr": "🕐 <b>Herêma demê ya te</b>\n\nDemên nûçeyan li gorî hilbijartina te ne. Niha: <b>{z}</b>\n\n"
                    "• Bajarekî hilbijêre, dema havînê bixweber e.\n• An ferqa ji Greenwich (UTC) rasterast hilbijêre."},
    "tz_fixed": {"fa": "اختلاف ثابت با UTC (بدون ساعت تابستانی):", "ckb": "جیاوازیی جێگیر لەگەڵ UTC (بێ کاتی هاوین):",
                 "en": "Fixed offset from UTC (no summer time):", "ar": "فرق ثابت عن UTC (بدون توقيت صيفي):", "kmr": "Ferqa sabît ji UTC:"},
    "ld_h": {"fa": "⏱ <b>چه زمانی قبل از خبر خبرتان کنیم؟</b>\n\nهر چند تا را که بخواهید علامت بزنید؛ برای هر کدام یک پیام جدا می‌آید و بعد از انتشار عدد، نتیجه هم فرستاده می‌شود.\nالان: <b>{l}</b>",
             "ckb": "⏱ <b>چەند پێش هەواڵ ئاگادارت بکەینەوە؟</b>\n\nهەر چەندێکت دەوێت نیشانە بکە؛ بۆ هەر یەکێک پەیامێکی جیا دێت و دوای بڵاوبوونەوەی ژمارە، ئەنجامیش دەنێردرێت.\nئێستا: <b>{l}</b>",
             "en": "⏱ <b>How long before a release should we tell you?</b>\n\nTick as many as you like; each sends its own message, and the result follows once the number is out.\nNow: <b>{l}</b>",
             "ar": "⏱ <b>كم قبل الخبر ننبّهك؟</b>\n\nاختر ما تشاء؛ لكلٍّ رسالة مستقلة، وتصلك النتيجة بعد صدور الرقم.\nالآن: <b>{l}</b>",
             "kmr": "⏱ <b>Çiqas berî nûçeyê em te agahdar bikin?</b>\n\nÇend dixwazî nîşan bike.\nNiha: <b>{l}</b>"},
    "b_done": {"fa": "✅ تمام", "ckb": "✅ تەواو", "en": "✅ Done", "ar": "✅ تم", "kmr": "✅ Temam"},
    "tz_ok": {"fa": "✅ منطقهٔ زمانی: {z}", "ckb": "✅ ناوچەی کات: {z}", "en": "✅ Time zone: {z}", "ar": "✅ المنطقة الزمنية: {z}",
              "kmr": "✅ Herêma demê: {z}"},
    "ld_min": {"fa": "دست‌کم یک زمان باید انتخاب شده بماند.", "ckb": "لانیکەم یەک کات دەبێت هەڵبژێردراو بمێنێت.",
               "en": "Keep at least one time selected.", "ar": "يجب أن يبقى وقت واحد على الأقل.", "kmr": "Herî kêm yek bimîne."},
    "link_ok": {"fa": "✅ منطقهٔ زمانی و زمان هشدار از سایت گرفته شد.", "ckb": "✅ ناوچەی کات و کاتی ئاگاداری لە ماڵپەڕەوە وەرگیرا.",
                "en": "✅ Your time zone and alert time were taken from the site.", "ar": "✅ أُخذت منطقتك الزمنية ووقت التنبيه من الموقع.",
                "kmr": "✅ Herêma demê ji malperê hat girtin."},
    "when": {"fa": "🕐 ساعت {teh} به وقت تهران ({utc} UTC)", "ckb": "🕐 کاتژمێر {erb} بە کاتی هەولێر · {teh} تاران ({utc} UTC)",
             "en": "🕐 {utc} UTC · {teh} Tehran", "ar": "🕐 الساعة {erb} بتوقيت أربيل/بغداد ({utc} UTC)",
             "kmr": "🕐 {utc} UTC · {erb} Hewlêr"},
    "fp": {"fa": "پیش‌بینی {f} · قبلی {p}", "ckb": "پێشبینی {f} · پێشوو {p}", "en": "forecast {f} · previous {p}",
           "ar": "التوقع {f} · السابق {p}", "kmr": "pêşbînî {f} · berê {p}"},
    "hist": {"fa": "📊 بعد از همین خبر در {n} بار گذشته، بیت‌کوین در ۱ ساعت به‌طور میانگین {m}٪ جابه‌جا شد (بیشترین {x}٪).",
             "ckb": "📊 دوای هەمان هەواڵ لە {n} جاری ڕابردوودا، بیتکۆین لە ١ کاتژمێردا بە تێکڕایی {m}٪ جووڵا (زۆرترین {x}٪).",
             "en": "📊 After the last {n} releases of this kind, bitcoin moved {m}% on average in the first hour (largest {x}%).",
             "ar": "📊 بعد آخر {n} مرات من هذا الخبر، تحرّك البيتكوين بمتوسط {m}% في الساعة الأولى (الأكبر {x}%).",
             "kmr": "📊 Piştî {n} weşanên berê, bitcoin di saeta yekem de bi navînî {m}% tevgeriya (herî zêde {x}%)."},
    "hawk": {"fa": "💡 عدد <b>بالاتر</b> از پیش‌بینی: معمولاً فدرال رزرو سخت‌گیرتر، دلار قوی‌تر و فشار روی بیت‌کوین. عدد <b>پایین‌تر</b>: معمولاً برعکس.",
             "ckb": "💡 ژمارەی <b>بەرزتر</b> لە پێشبینی: زۆرجار فیدراڵ ڕیزێرڤ توندتر، دۆلار بەهێزتر و فشار لەسەر بیتکۆین. ژمارەی <b>نزمتر</b>: زۆرجار پێچەوانە.",
             "en": "💡 A number <b>above</b> forecast usually means a tougher Fed, a stronger dollar and pressure on bitcoin; <b>below</b> usually the opposite.",
             "ar": "💡 رقم <b>أعلى</b> من التوقع يعني عادة فيدرالياً أكثر تشدداً ودولاراً أقوى وضغطاً على البيتكوين؛ و<b>الأدنى</b> عادة العكس.",
             "kmr": "💡 Hejmareke <b>bilindtir</b> ji pêşbîniyê bi gelemperî Fedeke hişktir û zexta li ser bitcoin e; <b>nizmtir</b> berevajî."},
    "dove": {"fa": "💡 عدد <b>پایین‌تر</b> از پیش‌بینی: معمولاً فدرال رزرو سخت‌گیرتر و فشار روی بیت‌کوین. عدد <b>بالاتر</b>: معمولاً برعکس.",
             "ckb": "💡 ژمارەی <b>نزمتر</b> لە پێشبینی: زۆرجار فیدراڵ ڕیزێرڤ توندتر و فشار لەسەر بیتکۆین. ژمارەی <b>بەرزتر</b>: زۆرجار پێچەوانە.",
             "en": "💡 A number <b>below</b> forecast usually means a tougher Fed and pressure on bitcoin; <b>above</b> usually the opposite.",
             "ar": "💡 رقم <b>أدنى</b> من التوقع يعني عادة فيدرالياً أكثر تشدداً وضغطاً على البيتكوين؛ و<b>الأعلى</b> عادة العكس.",
             "kmr": "💡 Hejmareke <b>nizmtir</b> ji pêşbîniyê bi gelemperî Fedeke hişktir e; <b>bilindtir</b> berevajî."},
    "fomc": {"fa": "💡 تصمیم نرخ بهره و سخنان رئیس فدرال رزرو؛ افزایش نرخ یا لحن سخت‌گیرانه معمولاً برای بیت‌کوین منفی است.",
             "ckb": "💡 بڕیاری ڕێژەی سوود و قسەکانی سەرۆکی فیدراڵ ڕیزێرڤ؛ بەرزکردنەوەی ڕێژە یان تۆنی توند زۆرجار بۆ بیتکۆین نەرێنییە.",
             "en": "💡 The rate decision and the Fed chair's words; a hike or a tough tone is usually negative for bitcoin.",
             "ar": "💡 قرار الفائدة وكلام رئيس الفيدرالي؛ الرفع أو النبرة المتشددة سلبيان عادة للبيتكوين.",
             "kmr": "💡 Biryara rêjeya faîzê; zêdekirin an dengê hişk bi gelemperî ji bo bitcoin neyênî ye."},
    "odds": {"fa": "🏦 احتمال‌های بازار برای جلسهٔ {d} فدرال رزرو (Kalshi): {o}", "ckb": "🏦 ئەگەرەکانی بازاڕ بۆ کۆبوونەوەی {d}ی فیدراڵ ڕیزێرڤ (Kalshi): {o}",
             "en": "🏦 Market odds for the Fed's {d} meeting (Kalshi): {o}", "ar": "🏦 احتمالات السوق لاجتماع الفيدرالي في {d} (Kalshi): {o}",
             "kmr": "🏦 Îhtîmalên bazarê ji bo civîna Fedê ya {d} (Kalshi): {o}"},
    "risk": {"fa": "⚠️ دقیقه‌های اول بعد از خبر پرنوسان است؛ حد ضرر را فراموش نکنید.", "ckb": "⚠️ یەکەم خولەکەکانی دوای هەواڵ پڕ لە هەڵبەزین و دابەزینە؛ ستۆپ لۆس لەبیر مەکە.",
             "en": "⚠️ The first minutes after a release are volatile; mind your stop-loss.", "ar": "⚠️ الدقائق الأولى بعد الخبر شديدة التقلب؛ لا تنسَ وقف الخسارة.",
             "kmr": "⚠️ Deqeyên yekem piştî nûçeyê bi tevlihevî ne; stop-loss ji bîr neke."},
    "res_h": {"fa": "✅ <b>نتیجهٔ خبر</b>", "ckb": "✅ <b>ئەنجامی هەواڵ</b>", "en": "✅ <b>The result</b>", "ar": "✅ <b>النتيجة</b>",
              "kmr": "✅ <b>Encam</b>"},
    "act": {"fa": "واقعی <b>{a}</b> · پیش‌بینی {f} · قبلی {p}", "ckb": "ڕاستەقینە <b>{a}</b> · پێشبینی {f} · پێشوو {p}",
            "en": "actual <b>{a}</b> · forecast {f} · previous {p}", "ar": "الفعلي <b>{a}</b> · التوقع {f} · السابق {p}",
            "kmr": "rastî <b>{a}</b> · pêşbînî {f} · berê {p}"},
    "noact": {"fa": "عدد رسمی هنوز به دست ما نرسیده؛ در صفحهٔ تقویم ثبت می‌شود.", "ckb": "ژمارە فەرمییەکە هێشتا نەگەیشتووە؛ لە پەڕەی ڕۆژژمێر تۆمار دەکرێت.",
              "en": "The official number is not in yet; it will appear on the calendar page.", "ar": "الرقم الرسمي لم يصل بعد؛ سيظهر في صفحة التقويم.",
              "kmr": "Hejmara fermî hîn negihîştiye; li rûpela salnameyê dê derkeve."},
    "s1": {"fa": "🔺 انقباضی‌تر از انتظار (معمولاً منفی برای بیت‌کوین)", "ckb": "🔺 توندتر لە چاوەڕوانی (زۆرجار نەرێنی بۆ بیتکۆین)",
           "en": "🔺 Hawkish surprise (usually negative for bitcoin)", "ar": "🔺 مفاجأة متشددة (سلبية عادة للبيتكوين)",
           "kmr": "🔺 Sûrprîza hişk (bi gelemperî neyênî)"},
    "s-1": {"fa": "🔻 انبساطی‌تر از انتظار (معمولاً مثبت برای بیت‌کوین)", "ckb": "🔻 نەرمتر لە چاوەڕوانی (زۆرجار ئەرێنی بۆ بیتکۆین)",
            "en": "🔻 Dovish surprise (usually positive for bitcoin)", "ar": "🔻 مفاجأة تيسيرية (إيجابية عادة للبيتكوين)",
            "kmr": "🔻 Sûrprîza nerm (bi gelemperî erênî)"},
    "s0": {"fa": "⚖️ مطابق انتظار", "ckb": "⚖️ وەک چاوەڕوانی", "en": "⚖️ In line with expectations", "ar": "⚖️ مطابق للتوقعات",
           "kmr": "⚖️ Li gorî pêşbîniyê"},
    "fed_dec": {"fa": "🏦 تصمیم فدرال رزرو: <b>{m}</b> — بازهٔ نرخ {lo}٪ تا {hi}٪", "ckb": "🏦 بڕیاری فیدراڵ ڕیزێرڤ: <b>{m}</b> — ڕێژە {lo}٪ تا {hi}٪",
                "en": "🏦 Fed decision: <b>{m}</b> — target range {lo}%–{hi}%", "ar": "🏦 قرار الفيدرالي: <b>{m}</b> — النطاق {lo}%–{hi}%",
                "kmr": "🏦 Biryara Fedê: <b>{m}</b> — rêjeya {lo}%–{hi}%"},
    "raise": {"fa": "افزایش نرخ", "ckb": "بەرزکردنەوە", "en": "a hike", "ar": "رفع", "kmr": "zêdekirin"},
    "lower": {"fa": "کاهش نرخ", "ckb": "دابەزاندن", "en": "a cut", "ar": "خفض", "kmr": "kêmkirin"},
    "maintain": {"fa": "بدون تغییر", "ckb": "بێ گۆڕان", "en": "no change", "ar": "تثبيت", "kmr": "bê guhertin"},
    "btc": {"fa": "₿ بیت‌کوین از لحظهٔ خبر: <b>{c}</b> ({p0} ← {p1}) · بالاترین {h} · پایین‌ترین {l}",
            "ckb": "₿ بیتکۆین لە ساتی هەواڵەوە: <b>{c}</b> ({p0} ← {p1}) · بەرزترین {h} · نزمترین {l}",
            "en": "₿ Bitcoin since the release: <b>{c}</b> ({p0} → {p1}) · high {h} · low {l}",
            "ar": "₿ البيتكوين منذ الخبر: <b>{c}</b> ({p0} ← {p1}) · الأعلى {h} · الأدنى {l}",
            "kmr": "₿ Bitcoin ji nûçeyê ve: <b>{c}</b> ({p0} → {p1}) · herî bilind {h} · herî nizm {l}"},
    "b_page": {"fa": "🗓 تقویم کامل در سایت", "ckb": "🗓 ڕۆژژمێری تەواو لە ماڵپەڕ", "en": "🗓 Full calendar", "ar": "🗓 التقويم الكامل",
               "kmr": "🗓 Salnameya temam"},
    "b_bot": {"fa": "🔔 اعلان خصوصی در ربات", "ckb": "🔔 ئاگاداری تایبەت لە بۆت", "en": "🔔 Private alerts in the bot",
              "ar": "🔔 تنبيهات خاصة في البوت", "kmr": "🔔 Hişyariyên taybet"},
    "b_on": {"fa": "🔔 روشن کردن اعلان خبرها", "ckb": "🔔 هەڵکردنی ئاگاداری هەواڵەکان", "en": "🔔 Turn release alerts on",
             "ar": "🔔 تفعيل تنبيهات الأخبار", "kmr": "🔔 Hişyariyan veke"},
    "b_off": {"fa": "🔕 خاموش کردن اعلان خبرها", "ckb": "🔕 کوژاندنەوەی ئاگاداری", "en": "🔕 Turn release alerts off",
              "ar": "🔕 إيقاف التنبيهات", "kmr": "🔕 Hişyariyan bigire"},
    "sec_h": {"fa": "📅 <b>تقویم اقتصادی — خبرهای مهم آمریکا</b>", "ckb": "📅 <b>ڕۆژژمێری ئابووری — هەواڵە گرنگەکانی ئەمریکا</b>",
              "en": "📅 <b>Economic calendar — key US releases</b>", "ar": "📅 <b>التقويم الاقتصادي — أهم الأخبار الأمريكية</b>",
              "kmr": "📅 <b>Salnameya aborî — nûçeyên girîng ên DYA</b>"},
    "sec_none": {"fa": "این هفته خبر قرمز دیگری نمانده.", "ckb": "ئەم هەفتەیە هەواڵی سووری تر نەماوە.", "en": "No more red releases this week.",
                 "ar": "لا أخبار حمراء أخرى هذا الأسبوع.", "kmr": "Vê hefteyê nûçeya sor nema."},
    "sec_on": {"fa": "🔔 اعلان شما روشن است: {l} قبل از هر خبر و بعد از نتیجه پیام می‌گیرید.",
               "ckb": "🔔 ئاگاداریت هەڵکراوە: {l} پێش هەر هەواڵ و دوای ئەنجام پەیام وەردەگریت.",
               "en": "🔔 Your alerts are on: {l} before each release, and again with the result.",
               "ar": "🔔 تنبيهاتك مفعّلة: قبل كل خبر بـ{l}، ثم رسالة بالنتيجة.",
               "kmr": "🔔 Hişyariyên te vekirî ne: {l} berê."},
    "sec_off": {"fa": "🔕 اعلان شما خاموش است. با دکمهٔ زیر، {l} قبل از هر خبر مهم و بعد از نتیجه خبرتان می‌کنیم.",
                "ckb": "🔕 ئاگاداریت کوژاوەتەوە. بە دوگمەی خوارەوە، {l} پێش هەر هەواڵی گرنگ و دوای ئەنجام ئاگادارت دەکەینەوە.",
                "en": "🔕 Your alerts are off. Turn them on below for a message {l} before each key release and one with the result.",
                "ar": "🔕 تنبيهاتك متوقفة. فعّلها أدناه لتصلك رسالة قبل كل خبر مهم بـ{l} وأخرى بالنتيجة.",
                "kmr": "🔕 Hişyariyên te girtî ne."},
    "on_ok": {"fa": "✅ روشن شد.", "ckb": "✅ هەڵکرا.", "en": "✅ On.", "ar": "✅ تم التفعيل.", "kmr": "✅ Vebû."},
    "off_ok": {"fa": "خاموش شد.", "ckb": "کوژایەوە.", "en": "Off.", "ar": "تم الإيقاف.", "kmr": "Hat girtin."},
    "foot": {"fa": "آموزشی است، توصیهٔ مالی نیست.", "ckb": "فێرکارییە، ئامۆژگاریی دارایی نییە.", "en": "Educational, not financial advice.",
             "ar": "تعليمي وليس نصيحة مالية.", "kmr": "Perwerdeyî ye, ne şîreta darayî."},
}
OUT_NAME = {"C26": {"fa": "کاهش ۵۰+", "ckb": "دابەزاندنی ٥٠+", "en": "cut 50+", "ar": "خفض 50+", "kmr": "kêmkirin 50+"},
            "C25": {"fa": "کاهش ۲۵", "ckb": "دابەزاندنی ٢٥", "en": "cut 25", "ar": "خفض 25", "kmr": "kêmkirin 25"},
            "H0": {"fa": "بدون تغییر", "ckb": "بێ گۆڕان", "en": "hold", "ar": "تثبيت", "kmr": "bê guhertin"},
            "H25": {"fa": "افزایش ۲۵", "ckb": "بەرزکردنەوەی ٢٥", "en": "hike 25", "ar": "رفع 25", "kmr": "zêdekirin 25"},
            "H26": {"fa": "افزایش ۵۰+", "ckb": "بەرزکردنەوەی ٥٠+", "en": "hike 50+", "ar": "رفع 50+", "kmr": "zêdekirin 50+"}}
MON = {"fa": ["ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"],
       "ckb": ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەممووز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"],
       "ar": ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]}
DAY = {"fa": ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه", "یکشنبه"],
       "ckb": ["دووشەممە", "سێشەممە", "چوارشەممە", "پێنجشەممە", "هەینی", "شەممە", "یەکشەممە"],
       "ar": ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]}


def L(k, lang, **kw):
    s = pick(T[k], lang)
    return s.format(**kw) if kw else s


def e(x):
    return html.escape(str(x if x is not None else "—"), quote=False)


def title(ev, lang):
    tr = ev.get("tr") or {}
    return tr.get(lang) or (tr.get("fa") if lang == "fa" else None) or ev["n"]


def _date(t, lang):
    d = datetime.fromtimestamp(t, TEHRAN if lang == "fa" else ERBIL)
    if lang in MON:
        return f"{d.day} {MON[lang][d.month - 1]}"
    return d.strftime("%b %-d")


# ------------------------------------------------------------------ each user's clock and lead times
FA_DIG = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


def human(m, lang):
    """minutes -> «۲ ساعت و ۳۰ دقیقه» / "2 h 30 min" """
    m = max(0, int(round(m)))
    d, h, mi = m // 1440, m % 1440 // 60, m % 60
    bits = [f"{v} {L(u, lang)}" for v, u in ((d, "u_day"), (h, "u_hour"), (mi, "u_min")) if v] or [f"0 {L('u_min', lang)}"]
    out = L("and", lang).join(bits)
    return out.translate(FA_DIG) if lang == "fa" else out


def leads_of(x):
    v = [int(m) for m in (x or {}).get("ecl") or [] if int(m) in LEADS]
    return sorted(set(v)) or list(DEF_LEAD)


def leads_text(x, lang):
    return L("sep", lang).join(human(m, lang) for m in leads_of(x))       # "15 min, 2 h": never reads as one span


def default_tz(lang):
    return "Asia/Tehran" if lang == "fa" else "o0" if lang == "en" else "Asia/Baghdad"


def valid_tz(v):
    if v in ZNAME:
        return True
    try:
        return v[:1] == "o" and int(v[1:]) in OFFSETS
    except ValueError:
        return False


def tz_code(x, lang):
    v = (x or {}).get("tz")
    return v if v and valid_tz(v) else default_tz(lang)


def tzinfo_of(code):
    if code in ZNAME and ZoneInfo:
        try:
            return ZoneInfo(code)
        except Exception:  # noqa: BLE001 - no tz database: fall back to the city's offset today is not knowable; use UTC
            pass
    if code[:1] == "o":
        return timezone(timedelta(minutes=int(code[1:])))
    return {"Asia/Tehran": TEHRAN, "Asia/Baghdad": ERBIL}.get(code, timezone.utc)


def fmt_off(minutes):
    sg = "+" if minutes >= 0 else "−"
    a = abs(int(minutes))
    return f"UTC{sg}{a // 60}" + (f":{a % 60:02d}" if a % 60 else "")


def tz_label(code, lang, t=None):
    """«تهران (UTC+3:30)» or "UTC−5" — the offset as it is at time t (summer time included)"""
    off = datetime.fromtimestamp(t or time.time(), tzinfo_of(code)).utcoffset().total_seconds() / 60
    if code in ZNAME:
        return f"{pick(ZNAME[code], lang)} ({fmt_off(off)})"
    return fmt_off(off)


def set_tz(x, code):
    if not valid_tz(code):
        return False
    x["tz"] = code
    return True


def toggle_lead(x, m):
    """add or remove one lead time; never leaves the list empty. Returns False when refused."""
    m = int(m)
    if m not in LEADS:
        return False
    cur = leads_of(x)
    if m in cur:
        if len(cur) == 1:
            return False
        cur.remove(m)
    else:
        cur.append(m)
    x["ecl"] = sorted(cur)
    return True


def apply_link(x, arg):
    """?start=ec_<zone>_l<minutes> from the calendar page: zone is o<offset> or z<Area-City>. True when anything was set."""
    got = False
    for part in arg.split("_")[1:]:
        if part[:1] == "o" and set_tz(x, part):
            got = True
        elif part[:1] == "z" and set_tz(x, part[1:].replace("-", "/", 1)):
            got = True
        elif part[:1] == "l" and part[1:].isdigit() and int(part[1:]) in LEADS:
            x["ecl"] = [int(part[1:])]
            got = True
    return got


def tz_view(x, lang):
    cur = tz_code(x, lang)
    rows_ = []
    zs = [{"text": ("✓ " if c == cur else "") + pick(ZNAME[c], lang), "callback_data": "ez:" + c} for c, *_ in ZONES]
    rows_ += [zs[i:i + 2] for i in range(0, len(zs), 2)]
    rows_.append([{"text": "— " + L("tz_fixed", lang) + " —", "callback_data": "ec:tz"}])
    os_ = [{"text": ("✓ " if "o%d" % o == cur else "") + fmt_off(o).replace("UTC", ""), "callback_data": "ez:o%d" % o} for o in OFFSETS]
    rows_ += [os_[i:i + 4] for i in range(0, len(os_), 4)]
    rows_.append([{"text": L("b_done", lang), "callback_data": "m:events"}])
    return L("tz_h", lang, z=e(tz_label(cur, lang))), {"inline_keyboard": rows_}


def lead_view(x, lang):
    cur = leads_of(x)
    bs = [{"text": ("✅ " if m in cur else "▫️ ") + human(m, lang), "callback_data": "el:%d" % m} for m in LEADS]
    rows_ = [bs[i:i + 2] for i in range(0, len(bs), 2)]
    rows_.append([{"text": L("b_done", lang), "callback_data": "m:events"}])
    return L("ld_h", lang, l=e(leads_text(x, lang))), {"inline_keyboard": rows_}


def groups(events, now):
    """alert events by release minute, upcoming and recent: [(t, [events])]"""
    by = {}
    for ev in events:
        if S.is_alert_event(ev) and now - 6 * 3600 < ev["t"] < now + 8 * 86400:
            by.setdefault(ev["t"], []).append(ev)
    return sorted(by.items())


def history_line(ev_list, events, lang):
    """how bitcoin moved in the hour after the same releases in the past (from ecocal's b1)"""
    names = {ev["n"] for ev in ev_list}
    t0 = min(ev["t"] for ev in ev_list)
    seen, moves = set(), []
    for x in events:
        if x.get("c") == "USD" and x["n"] in names and x["t"] < t0 and x.get("b1") is not None and x["t"] not in seen:
            seen.add(x["t"])
            moves.append(abs(float(x["b1"])))
    if len(moves) < 2:
        return ""
    return L("hist", lang, n=len(moves), m=f"{sum(moves) / len(moves):.2f}", x=f"{max(moves):.2f}")


def odds_line(fed, lang, now):
    ms = [m for m in (fed or {}).get("meetings") or [] if m.get("date", 0) > now - 3600]
    if not ms:
        return ""
    m = ms[0]
    p = sorted(((v, k) for k, v in m["p"].items() if v >= 1), reverse=True)[:3]
    o = " · ".join(f"{pick(OUT_NAME[k], lang)} {v:.0f}%" for v, k in p)
    return L("odds", lang, d=_date(m["date"], lang), o=o)


def guide(ev_list, lang):
    if any(ev["n"] in S.FED_TITLES or "FOMC" in ev["n"] for ev in ev_list):
        return L("fomc", lang)
    d = [S.DIRECTION.get(ev["n"]) for ev in ev_list if S.DIRECTION.get(ev["n"])]
    if not d:
        return ""
    return L("hawk" if sum(d) >= 0 else "dove", lang)


def _day(d, lang):
    day = DAY[lang][d.weekday()] if lang in DAY else d.strftime("%a")
    date = f"{d.day} {MON[lang][d.month - 1]}" if lang in MON else d.strftime("%b %-d")
    return f"{day} {date}"


def pre_text(t, ev_list, events, fed, lang, now, tz=None):
    """tz: the reader's zone code (private messages); None = the group's Tehran / Erbil / UTC line"""
    utc = datetime.fromtimestamp(t, timezone.utc)
    mins = max(1, round((t - now) / 60))
    if tz:
        loc = utc.astimezone(tzinfo_of(tz))
        when = L("when_u", lang, d=_day(loc, lang), h=loc.strftime("%H:%M"), z=e(tz_label(tz, lang, t)))
    else:
        when = L("when", lang, utc=utc.strftime("%H:%M"), teh=utc.astimezone(TEHRAN).strftime("%H:%M"),
                 erb=utc.astimezone(ERBIL).strftime("%H:%M"))
    lines = [L("pre_h", lang, m=human(mins, lang)), when, ""]
    for ev in ev_list:
        fp = L("fp", lang, f=e(ev.get("f") or "—"), p=e(ev.get("p") or "—")) if (ev.get("f") or ev.get("p")) else ""
        lines.append(f"🔴 <b>{e(title(ev, lang))}</b>" + (f" — {fp}" if fp else ""))
    extra = [x for x in (history_line(ev_list, events, lang), guide(ev_list, lang), odds_line(fed, lang, now)) if x]
    if extra:
        lines += [""] + extra
    lines += ["", L("risk", lang), f"<i>{L('foot', lang)}</i>"]
    return "\n".join(lines)


def _fmt_p(p):
    return f"${p:,.0f}"


def result_text(ev_list, acts, btc, lang):
    lines = [L("res_h", lang), ""]
    sign, fed_done = 0, False
    for ev in ev_list:
        a = acts.get(ev["n"]) or {}
        name = f"🔴 <b>{e(title(ev, lang))}</b>"
        if a.get("move"):
            if fed_done:                         # "FOMC Statement" and "Federal Funds Rate" are the same decision
                continue
            fed_done = True
            lines.append(name)
            lines.append(L("fed_dec", lang, m=pick(T[a["move"]], lang), lo=f'{a["lo"]:g}', hi=f'{a["hi"]:g}'))
            sign += {"raise": 1, "lower": -1}.get(a["move"], 0)
        elif a.get("a"):
            lines.append(name + "\n" + L("act", lang, a=e(a["a"]), f=e(ev.get("f") or "—"), p=e(ev.get("p") or "—")))
            sg = S.surprise(ev["n"], a["a"], ev.get("f"))
            if sg is not None:
                sign += sg
                lines.append(L(f"s{sg}", lang))
        else:
            lines.append(name + "\n" + L("noact", lang))
    if btc:
        lines += ["", L("btc", lang, c=f"{btc['chg']:+.2f}%", p0=_fmt_p(btc["p0"]), p1=_fmt_p(btc["p1"]),
                        h=_fmt_p(btc["hi"]), l=_fmt_p(btc["lo"]))]
    lines += ["", f"<i>{L('foot', lang)}</i>"]
    return "\n".join(lines)


def kb_post(lang, bot_user=None):
    rows = [[{"text": L("b_page", lang), "url": PAGE}]]
    if bot_user:
        rows.append([{"text": L("b_bot", lang), "url": f"https://t.me/{bot_user}?start=ec"}])
    return {"inline_keyboard": rows}


# ------------------------------------------------------------------ the bot section
def section(x, lang, load, now=None):
    now = now or time.time()
    ev = (load("ecocal") or {}).get("events") or []
    acts = ((load("econ_actual") or {}).get("v")) or {}
    tz = tz_code(x, lang)
    tzi = tzinfo_of(tz)
    out = [L("sec_h", lang), L("sec_tz", lang, z=e(tz_label(tz, lang, now))), ""]
    shown = 0
    for t, lst in groups(ev, now):
        if t < now - 3 * 3600:
            continue
        d = datetime.fromtimestamp(t, tzi)
        out.append(f"<b>{e(_day(d, lang))} · {d:%H:%M}</b>")
        for x2 in lst:
            a = (acts.get(f'{x2["t"]}|USD|{x2["n"]}') or {}).get("a")
            bits = [f"F {x2['f']}" if x2.get("f") else "", f"P {x2['p']}" if x2.get("p") else "", f"<b>A {a}</b>" if a else ""]
            out.append(f"  🔴 {e(title(x2, lang))}" + (" — " + " · ".join(b for b in bits if b) if any(bits) else ""))
        shown += 1
        if shown >= 8:
            break
    if not shown:
        out.append(L("sec_none", lang))
    ol = odds_line(load("fed") or {}, lang, now)
    if ol:
        out += ["", ol]
    out += ["", L("sec_on" if (x or {}).get("ec") else "sec_off", lang, l=e(leads_text(x, lang)))]
    return "\n".join(out)


def rows(x, lang):
    on = (x or {}).get("ec")
    tz = tz_code(x, lang)
    short = pick(ZNAME[tz], lang).split("،")[0].split(",")[0].split(" و ")[0].split(" & ")[0] if tz in ZNAME else tz_label(tz, lang)
    return [[{"text": L("b_off" if on else "b_on", lang), "callback_data": "ec:off" if on else "ec:on"}],
            [{"text": L("b_tz", lang, z=short), "callback_data": "ec:tz"}],
            [{"text": L("b_ld", lang, l=leads_text(x, lang)), "callback_data": "ec:ld"}],
            [{"text": L("b_page", lang), "url": PAGE}]]


# ------------------------------------------------------------------ the minute job
def btc_move(klines, t):
    """Binance 1m klines from the release minute -> {p0, p1, hi, lo, chg}"""
    k = [b for b in klines or [] if int(b[0]) >= (t // 60) * 60 * 1000]
    if not k:
        return None
    p0, p1 = float(k[0][1]), float(k[-1][4])
    hi, lo = max(float(b[2]) for b in k), min(float(b[3]) for b in k)
    return {"p0": p0, "p1": p1, "hi": hi, "lo": lo, "chg": (p1 / p0 - 1) * 100}


def tick(s, now, load, fetch_actuals, klines, post_group, reply_group, dm, users):
    """one pass. load(name) -> data dict; fetch_actuals(ev_list) -> {title: {...}}; klines(t) -> Binance 1m klines;
    post_group(text, kb) -> message_id; reply_group(text, kb, reply_to); dm(uid, text, kb); users -> {uid: user}.
    Returns True when s changed.

    done[t] = {"pre": group message id (-1 failed, 0 missed), "dm": {uid: smallest lead already sent}, "res": 1, ...}
    Private heads-ups follow each user's own lead times (x["ecl"]) and clock (x["tz"]); a user is told once per lead
    window, and never with under a minute to go. When the bot comes up late, one message covers every lead passed."""
    st = s.setdefault("econ", {})
    done = st.setdefault("done", {})
    ev = (load("ecocal") or {}).get("events") or []
    fed = load("fed") or {}
    subs = [(uid, x) for uid, x in (users or {}).items() if x.get("ec")]
    changed = False
    for t, lst in groups(ev, now):
        k = str(t)
        rec = done.get(k) or {}
        if rec.get("skip"):
            continue
        left = t - now
        if "pre" not in rec and PRE_LATEST <= left <= PRE_MIN:
            mid = post_group(pre_text(t, lst, ev, fed, "fa", now), kb_post("fa", st.get("bot_user")))
            rec["pre"] = mid or -1
            done[k] = rec
            changed = True
        elif "pre" not in rec and left < PRE_LATEST:
            rec["pre"] = 0                                  # the group heads-up was missed: no late post in the group
            done[k] = rec
            changed = True
        if left > 60:
            sent = rec.setdefault("dm", {})
            for uid, x in subs:
                due = [m for m in leads_of(x) if left <= m * 60]
                if not due:
                    continue
                m = min(due)
                if str(uid) in sent and sent[str(uid)] <= m:
                    continue
                lang = x.get("lang", "fa")
                dm(uid, pre_text(t, lst, ev, fed, lang, now, tz_code(x, lang)), kb_post(lang))
                sent[str(uid)] = m
                done[k] = rec
                changed = True
            if not sent:
                rec.pop("dm", None)
        if not rec.get("res") and now >= t + 60 and (rec.get("pre") or rec.get("dm")):
            if now - rec.get("try", 0) < 110:
                continue
            rec["try"] = now
            acts = rec.setdefault("acts", {})
            want = [x for x in lst if (x["n"] in S.SPECS or x["n"] in S.FED_TITLES) and x["n"] not in acts]
            if want:
                try:
                    acts.update(fetch_actuals(want) or {})
                except Exception:  # noqa: BLE001
                    pass
            complete = all(x["n"] in acts for x in lst if x["n"] in S.SPECS or x["n"] in S.FED_TITLES)
            ready = (complete and now >= t + 5 * 60) or (not want and now >= t + 15 * 60) or now >= t + RESULT_GIVEUP
            if ready:
                try:
                    btc = btc_move(klines(t), t)
                except Exception:  # noqa: BLE001
                    btc = None
                if rec.get("pre"):
                    reply_group(result_text(lst, acts, btc, "fa"), kb_post("fa", st.get("bot_user")),
                                rec["pre"] if rec["pre"] > 0 else None)
                for uid, x in subs:
                    lang = x.get("lang", "fa")
                    dm(uid, result_text(lst, acts, btc, lang), kb_post(lang))
                rec["res"] = 1
            done[k] = rec
            changed = True
        elif not rec.get("res") and not rec.get("pre") and not rec.get("dm") and t < now - PRE_LATEST:
            done[k] = {"pre": 0, "res": 1, "skip": 1}      # missed entirely (bot was down): never post late
            changed = True
    for k in list(done):
        if int(k) < now - 10 * 86400:
            done.pop(k)
    return changed


def _selftest():
    now = 1_800_000_000
    ev = [{"t": now + 20 * 60, "c": "USD", "i": "H", "n": "CPI m/m", "f": "0.3%", "p": "0.6%", "tr": {"fa": "تورم ماهانه"}},
          {"t": now + 20 * 60, "c": "USD", "i": "H", "n": "Core CPI m/m", "f": "0.2%", "p": "0.3%"},
          {"t": now + 20 * 60, "c": "EUR", "i": "H", "n": "ECB", "f": "", "p": ""},
          {"t": now - 30 * 86400, "c": "USD", "i": "H", "n": "CPI m/m", "b1": 0.8},
          {"t": now - 60 * 86400, "c": "USD", "i": "H", "n": "CPI m/m", "b1": -1.2}]
    fed = {"meetings": [{"date": now + 20 * 86400, "p": {"C26": 0, "C25": 1, "H0": 4, "H25": 85, "H26": 10}}]}
    data = {"ecocal": {"events": ev}, "fed": fed}
    sent = []
    s = {}

    def post_group(text, kb):
        sent.append(("pre", text))
        return 77

    def reply_group(text, kb, to):
        sent.append(("res", text, to))

    def dm(uid, text, kb):
        sent.append(("dm", uid, text[:30]))
    users = {"1": {"ec": 1, "lang": "ckb"}, "2": {"lang": "fa"}}
    acts = {"CPI m/m": {"a": "0.4%"}, "Core CPI m/m": {"a": "0.2%"}}
    kl = [[(now + 20 * 60) * 1000, "70000", "70500", "69000", "69300"]]
    args = (lambda n: data.get(n), lambda w: {x["n"]: acts[x["n"]] for x in w}, lambda t: kl, post_group, reply_group, dm, users)
    ok = []
    ok.append(tick(s, now, *args) and sent[0][0] == "pre" and "تورم ماهانه" in sent[0][1] and "۲ بار" not in sent[0][1])
    ok.append(len([x for x in sent if x[0] == "dm"]) == 1)                       # opt-in only
    ok.append("2 " in sent[0][1] or "در 2 بار" in sent[0][1])                     # history line from the two past CPIs
    ok.append(not tick(s, now + 60, *args))                                        # nothing twice
    tick(s, now + 26 * 60, *args)                                                  # 6 min after: both actuals in -> result
    res = [x for x in sent if x[0] == "res"]
    ok.append(len(res) == 1 and res[0][2] == 77 and "0.4%" in res[0][1] and "🔺" in res[0][1] and "-1.00%" in res[0][1])
    tick(s, now + 40 * 60, *args)
    ok.append(len([x for x in sent if x[0] == "res"]) == 1)
    s2 = {}
    sent.clear()
    tick(s2, now + 25 * 60, *args)                                                 # bot up after the release: silent
    ok.append(not sent)
    sec = section({"ec": 1}, "fa", lambda n: data.get(n), now)
    ok.append("تورم ماهانه" in sec and "افزایش ۲۵ 85%" in sec)
    # each user's own clock and lead times
    ok.append(tz_label("Asia/Tehran", "en", now) == "Tehran (UTC+3:30)" and tz_label("o-300", "en") == "UTC−5"
              and tz_label("Europe/Berlin", "en", now).endswith("(UTC+1)") and tz_label("Europe/Berlin", "en", now + 180 * 86400).endswith("(UTC+2)"))
    ok.append(human(150, "fa") == "۲ ساعت و ۳۰ دقیقه" and human(1440, "en") == "1 day" and human(5, "ckb") == "5 خولەک")
    u = {"lang": "en"}
    ok.append(apply_link(u, "ec_zEurope-Berlin_l60") and u == {"lang": "en", "tz": "Europe/Berlin", "ecl": [60]}
              and apply_link(u, "ec_o-210") and u["tz"] == "o-210" and not apply_link(u, "ec_o999_l7_zMars-Base") and u["tz"] == "o-210")
    ok.append(toggle_lead(u, 15) and leads_of(u) == [15, 60] and toggle_lead(u, 60) and not toggle_lead(u, 15) and leads_of(u) == [15]
              and not toggle_lead(u, 7))
    ev2 = [{"t": now + 3 * 3600, "c": "USD", "i": "H", "n": "Retail Sales m/m", "f": "0.2%", "p": "0.1%"}]
    d2 = {"ecocal": {"events": ev2}, "fed": {}}
    sent.clear()
    us2 = {"5": {"ec": 1, "lang": "en", "tz": "Europe/Berlin", "ecl": [15, 60]}, "6": {"ec": 1, "lang": "fa"}}
    a2 = (lambda n: d2.get(n), lambda w: {}, lambda t: [], post_group, reply_group, dm, us2)
    s3 = {}
    tick(s3, now + 3 * 3600 - 50 * 60, *a2)                                       # 50 min before: only the 60-min user
    dms = [x for x in sent if x[0] == "dm"]
    ok.append(len(dms) == 1 and dms[0][1] == "5" and not [x for x in sent if x[0] == "pre"])
    tick(s3, now + 3 * 3600 - 40 * 60, *a2)
    ok.append(len([x for x in sent if x[0] == "dm"]) == 1)                         # no repeat inside the same window
    tick(s3, now + 3 * 3600 - 25 * 60, *a2)                                        # 25 min: group post + the 30-min user
    ok.append([x[1] for x in sent if x[0] == "dm"] == ["5", "6"] and len([x for x in sent if x[0] == "pre"]) == 1)
    tick(s3, now + 3 * 3600 - 14 * 60, *a2)                                        # 14 min: the 15-min lead
    ok.append([x[1] for x in sent if x[0] == "dm"] == ["5", "6", "5"])
    full = pre_text(now + 3 * 3600, ev2, ev2, {}, "en", now + 3 * 3600 - 14 * 60, "Europe/Berlin")
    ok.append("14 min to a key US release" in full and "<b>12:00</b> your time — Berlin, Paris, Amsterdam (UTC+1)" in full)
    late = {}                                                                      # bot comes up 20 min before: one message
    sent.clear()
    tick(late, now + 3 * 3600 - 20 * 60, *(d2.get, lambda w: {}, lambda t: [], post_group, reply_group, dm,
                                          {"7": {"ec": 1, "lang": "fa", "ecl": [60, 120, 30]}}))
    ok.append(len([x for x in sent if x[0] == "dm"]) == 1)
    tv = tz_view({"tz": "o210"}, "fa")
    lv = lead_view({}, "en")
    ok.append(any(b["text"] == "✓ +3:30" for r in tv[1]["inline_keyboard"] for b in r)
              and any(b["text"] == "✅ 30 min" for r in lv[1]["inline_keyboard"] for b in r))
    ok.append(all(len(b["callback_data"].encode()) <= 64 for r in tv[1]["inline_keyboard"] for b in r))
    print("bot_econ self-test:", f"{sum(ok)}/{len(ok)} ok", "" if all(ok) else ok)
    return all(ok)


if __name__ == "__main__":
    import sys
    sys.exit(0 if _selftest() else 1)
