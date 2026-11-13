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

tick() is called from refbot.minute_jobs (about once a minute) and is idempotent: what was sent is kept in
s["econ"], which lives in the bot's state branch like everything else. Self-test: python3 scripts/bot_econ.py
"""
import html
import time
from datetime import datetime, timezone, timedelta

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

T = {
    "pre_h": {"fa": "⏰ <b>{m} دقیقه تا خبر مهم آمریکا</b>", "ckb": "⏰ <b>{m} خولەک ماوە بۆ هەواڵی گرنگی ئەمریکا</b>",
              "en": "⏰ <b>{m} minutes to a key US release</b>", "ar": "⏰ <b>{m} دقيقة على خبر أمريكي مهم</b>",
              "kmr": "⏰ <b>{m} deqe heta nûçeya girîng a DYA</b>"},
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
    "sec_on": {"fa": "🔔 اعلان شما روشن است: ۳۰ دقیقه قبل از هر خبر و بعد از نتیجه پیام می‌گیرید.",
               "ckb": "🔔 ئاگاداریت هەڵکراوە: ٣٠ خولەک پێش هەر هەواڵ و دوای ئەنجام پەیام وەردەگریت.",
               "en": "🔔 Your alerts are on: a message 30 minutes before each release and one with the result.",
               "ar": "🔔 تنبيهاتك مفعّلة: رسالة قبل كل خبر بـ٣٠ دقيقة وأخرى بالنتيجة.",
               "kmr": "🔔 Hişyariyên te vekirî ne."},
    "sec_off": {"fa": "🔕 اعلان شما خاموش است. با دکمهٔ زیر، ۳۰ دقیقه قبل از هر خبر مهم و بعد از نتیجه خبرتان می‌کنیم.",
                "ckb": "🔕 ئاگاداریت کوژاوەتەوە. بە دوگمەی خوارەوە، ٣٠ خولەک پێش هەر هەواڵی گرنگ و دوای ئەنجام ئاگادارت دەکەینەوە.",
                "en": "🔕 Your alerts are off. Turn them on below for a message 30 minutes before each key release and one with the result.",
                "ar": "🔕 تنبيهاتك متوقفة. فعّلها أدناه لتصلك رسالة قبل كل خبر مهم بـ٣٠ دقيقة وأخرى بالنتيجة.",
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


def pre_text(t, ev_list, events, fed, lang, now):
    utc = datetime.fromtimestamp(t, timezone.utc)
    mins = max(1, round((t - now) / 60))
    lines = [L("pre_h", lang, m=mins),
             L("when", lang, utc=utc.strftime("%H:%M"), teh=utc.astimezone(TEHRAN).strftime("%H:%M"),
               erb=utc.astimezone(ERBIL).strftime("%H:%M")), ""]
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
    out = [L("sec_h", lang), ""]
    shown = 0
    for t, lst in groups(ev, now):
        if t < now - 3 * 3600:
            continue
        d = datetime.fromtimestamp(t, TEHRAN if lang == "fa" else ERBIL if lang in ("ckb", "ar") else timezone.utc)
        day = DAY[lang][d.weekday()] if lang in DAY else d.strftime("%a")
        out.append(f"<b>{e(day)} {_date(t, lang)} · {d:%H:%M}</b>")
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
    out += ["", L("sec_on" if (x or {}).get("ec") else "sec_off", lang)]
    return "\n".join(out)


def rows(x, lang):
    on = (x or {}).get("ec")
    return [[{"text": L("b_off" if on else "b_on", lang), "callback_data": "ec:off" if on else "ec:on"}],
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
    Returns True when s changed."""
    st = s.setdefault("econ", {})
    done = st.setdefault("done", {})
    ev = (load("ecocal") or {}).get("events") or []
    fed = load("fed") or {}
    subs = [(uid, x.get("lang", "fa")) for uid, x in (users or {}).items() if x.get("ec")]
    changed = False
    for t, lst in groups(ev, now):
        k = str(t)
        rec = done.get(k) or {}
        if not rec.get("pre") and PRE_LATEST <= t - now <= PRE_MIN:
            mid = post_group(pre_text(t, lst, ev, fed, "fa", now), kb_post("fa", st.get("bot_user")))
            rec["pre"] = mid or -1
            for uid, lang in subs:
                dm(uid, pre_text(t, lst, ev, fed, lang, now), kb_post(lang))
            done[k] = rec
            changed = True
        if rec.get("pre") and not rec.get("res") and now >= t + 60:
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
                reply_group(result_text(lst, acts, btc, "fa"), kb_post("fa", st.get("bot_user")),
                            rec["pre"] if rec["pre"] and rec["pre"] > 0 else None)
                for uid, lang in subs:
                    dm(uid, result_text(lst, acts, btc, lang), kb_post(lang))
                rec["res"] = 1
            done[k] = rec
            changed = True
        elif not rec and t < now - PRE_LATEST:          # missed entirely (bot was down): never post late heads-ups
            done[k] = {"pre": 0, "res": 1, "skip": 1}
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
    print("bot_econ self-test:", f"{sum(ok)}/{len(ok)} ok", "" if all(ok) else ok)
    return all(ok)


if __name__ == "__main__":
    import sys
    sys.exit(0 if _selftest() else 1)
