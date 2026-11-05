# -*- coding: utf-8 -*-
"""
روان‌شناسی معامله در ربات — همان محتوای /academy/psychology/ ، خواندنی و قابل استفاده در تلگرام.

سه کار می‌کند:
  ۱) آموزش: ده بُعد، دوازده الگوی مخرب و شش پروتکل تمرین، همه با دکمه.
  ۲) چک‌این روزانه: شش پرسش پیش از معامله و یک امتیاز آمادگی، و ثبت لحظه‌ای هیجان.
  ۳) همگام‌سازی: کدی که کاربر از سایت می‌گیرد، اینجا خلاصهٔ پیشرفتش را نشان می‌دهد.

هیچ دادهٔ معاملاتی‌ای اینجا ساخته یا تحلیل نمی‌شود؛ تحلیل سنگین در مرورگر خود کاربر است.
فضای نام کال‌بک‌ها: py:<کار>:<آرگومان>
"""
import base64
import binascii
import html
import json

SITE = "https://entekhab.net"
PAGE = SITE + "/academy/psychology/"
_FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
_AR = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def _d():
    try:
        import psych_data as PD
        return PD
    except Exception:
        return None


def num(n, lang="fa"):
    s = str(n)
    return s.translate(_FA) if lang == "fa" else s.translate(_AR) if lang in ("ckb", "ar") else s


def e(s):
    return html.escape(str(s or ""))


T = {
    "title": {"fa": "🧠 <b>روان‌شناسی معامله‌گر</b>", "ckb": "🧠 <b>دەروونناسیی مامەڵەکار</b>", "en": "🧠 <b>Trading psychology</b>"},
    "lead": {"fa": "ذهن خودتان را به داده تبدیل کنید: ده بُعد رفتاری، دوازده الگوی مخرب و تمرین‌های علمی.",
             "ckb": "مێشکی خۆت بکە بە داتا: دە ڕەهەندی ڕەفتاری، دوازدە شێوازی وێرانکەر و ڕاهێنان.",
             "en": "Turn your own mind into data: ten behavioural dimensions, twelve destructive patterns and exercises."},
    "b_dims": {"fa": "📊 ده بُعد رفتاری", "ckb": "📊 دە ڕەهەندی ڕەفتاری", "en": "📊 Ten dimensions"},
    "b_pats": {"fa": "⚠️ دوازده الگوی مخرب", "ckb": "⚠️ دوازدە شێوازی وێرانکەر", "en": "⚠️ Twelve patterns"},
    "b_proto": {"fa": "🧰 تمرین‌ها", "ckb": "🧰 ڕاهێنانەکان", "en": "🧰 Exercises"},
    "b_check": {"fa": "✅ چک‌این پیش از معامله", "ckb": "✅ پشکنینی پێش مامەڵە", "en": "✅ Pre-trade check"},
    "b_emo": {"fa": "🌊 ثبت هیجان", "ckb": "🌊 تۆمارکردنی هەست", "en": "🌊 Log an emotion"},
    "b_site": {"fa": "🌐 سنجش کامل در سایت", "ckb": "🌐 پێوانەی تەواو لە ماڵپەڕ", "en": "🌐 Full assessment on the site"},
    "b_back": {"fa": "‹ بازگشت", "ckb": "‹ گەڕانەوە", "en": "‹ Back"},
    "b_home": {"fa": "🏠 خانه", "ckb": "🏠 ماڵەوە", "en": "🏠 Home"},
    "nfa": {"fa": "ابزار خودارزیابی و آموزش است، نه تشخیص بالینی و نه جایگزین روان‌شناس.",
            "ckb": "ئامرازی هەڵسەنگاندنی خۆیە، نەک دەستنیشانکردنی پزیشکی.",
            "en": "A self-assessment and learning tool — not a clinical diagnosis, and not a substitute for a psychologist."},
    "pick": {"fa": "یکی را انتخاب کنید:", "ckb": "یەکێک هەڵبژێرە:", "en": "Pick one:"},
    "ready": {"fa": "آمادگی روانی امروز: <b>{s} از ۱۰۰</b>", "ckb": "ئامادەیی دەروونیی ئەمڕۆ: <b>{s} لە ١٠٠</b>", "en": "Today's readiness: <b>{s}/100</b>"},
    "r_go": {"fa": "وضعیت مناسب است. طبق پلن پیش بروید.", "ckb": "دۆخەکە باشە. بەپێی پلان بڕۆ.", "en": "Good to go — follow your plan."},
    "r_care": {"fa": "با احتیاط: حجم را کم کنید و فقط ستاپ اصلی را بگیرید.", "ckb": "بە وریاییەوە: قەبارە کەم بکە.", "en": "Careful: cut size, take only your main setup."},
    "r_stop": {"fa": "امروز شرایط روانی مناسب معامله نیست. معامله‌نکردن هم یک تصمیم معتبر است.",
               "ckb": "ئەمڕۆ دۆخی دەروونی گونجاو نییە. مامەڵەنەکردنیش بڕیارێکی دروستە.",
               "en": "Not a good day to trade. Not trading is a valid decision."},
    "synced": {"fa": "کد خوانده شد: {n} معامله ثبت‌شده و امتیاز کل {s}. برای جزئیات به سایت بروید.",
               "ckb": "کۆد خوێندرایەوە: {n} مامەڵە و نمرەی گشتی {s}.",
               "en": "Code read: {n} trades, overall score {s}. See the site for detail."},
    "bad_code": {"fa": "این کد خوانده نشد. در صفحهٔ روان‌شناسی سایت، بخش تنظیمات، دوباره بسازیدش.",
                 "ckb": "ئەم کۆدە نەخوێندرایەوە.", "en": "Could not read that code."},
}

PRE_Q = [
    ("anx", {"fa": "سطح اضطراب فعلی؟", "ckb": "ئاستی دڵەڕاوکێ؟", "en": "Anxiety right now?"}, ["۰-۲", "۳-۵", "۶-۸", "۹-۱۰"], 12),
    ("rev", {"fa": "تمایل به جبران ضرر قبلی؟", "ckb": "حەزی قەرەبووکردنەوە؟", "en": "Urge to win losses back?"}, ["هیچ", "کم", "متوسط", "زیاد"], 14),
    ("foc", {"fa": "تمرکز فعلی؟", "ckb": "سەرنجدان؟", "en": "Focus?"}, ["بسیار کم", "کم", "متوسط", "زیاد"], -10),
    ("pln", {"fa": "برای هر معامله حد ضرر و ریسک مشخص دارید؟", "ckb": "وەستاندنی زیان دیاریکراوت هەیە؟", "en": "Stop and risk defined?"}, ["خیر", "بله"], -25),
    ("must", {"fa": "احساس می‌کنید حتماً باید امروز معامله کنید؟", "ckb": "هەست دەکەیت دەبێت ئەمڕۆ مامەڵە بکەیت؟", "en": "Feel you must trade today?"}, ["خیر", "تا حدی", "بله"], 9),
    ("fomo", {"fa": "الان دنبال حرکتی هستید که جا مانده‌اید؟", "ckb": "دوای جوڵەیەکیت کە لێت دواکەوتووە؟", "en": "Chasing a move you missed?"}, ["خیر", "تا حدی", "بله"], 9),
]


def L(d, lang, **kw):
    s = d.get(lang) or d.get("en") or d.get("fa") or ""
    return s.format(**kw) if kw else s


def btn(t, data):
    return {"text": t[:60], "callback_data": data}


def menu(lang):
    out = [L(T["title"], lang), "", L(T["lead"], lang), "", "<i>" + L(T["nfa"], lang) + "</i>"]
    rows = [[btn(L(T["b_check"], lang), "py:chk:0")],
            [btn(L(T["b_dims"], lang), "py:dims"), btn(L(T["b_pats"], lang), "py:pats")],
            [btn(L(T["b_proto"], lang), "py:proto"), btn(L(T["b_emo"], lang), "py:emo")],
            [{"text": L(T["b_site"], lang), "url": PAGE}],
            [btn(L(T["b_home"], lang), "m:main")]]
    return "\n".join(out), rows


def dims(lang):
    PD = _d()
    if not PD:
        return L(T["title"], lang), [[btn(L(T["b_back"], lang), "py:m")]]
    out = [L(T["title"], lang), "", L(T["pick"], lang), ""]
    rows, pair = [], []
    for i, d in enumerate(PD.DIMENSIONS):
        out.append(f'{d["icon"]} <b>{e(d["fa"])}</b> — {e(d["construct"])}')
        pair.append(btn(f'{d["icon"]} {d["fa"]}', f"py:dim:{d['id']}"))
        if len(pair) == 2:
            rows.append(pair); pair = []
    if pair:
        rows.append(pair)
    rows.append([btn(L(T["b_back"], lang), "py:m"), btn(L(T["b_home"], lang), "m:main")])
    return "\n".join(out), rows


def dim(did, lang):
    PD = _d()
    d = next((x for x in (PD.DIMENSIONS if PD else []) if x["id"] == did), None)
    if not d:
        return L(T["title"], lang), [[btn(L(T["b_back"], lang), "py:dims")]]
    out = [f'{d["icon"]} <b>{e(d["fa"])}</b>  <i>{e(d["en"])}</i>', "",
           f'<b>این بُعد چیست؟</b> {e(d["construct"])}', "",
           f'<b>چطور اندازه گرفته می‌شود؟</b> {e(d["operational"])}', "",
           "<b>در رفتار چه چیزی دیده می‌شود؟</b>"]
    out += [" • " + e(x) for x in d["behavioral"]]
    out += ["", "<b>تمرین اصلاحی</b>"]
    out += [" • " + e(x) for x in d["interventions"]]
    return "\n".join(out), [[btn(L(T["b_back"], lang), "py:dims"), btn(L(T["b_home"], lang), "m:main")]]


def pats(lang):
    PD = _d()
    out = [L(T["title"], lang), "", L(T["pick"], lang)]
    rows, pair = [], []
    for p in (PD.PATTERNS if PD else []):
        pair.append(btn(f'{p["icon"]} {p["fa"]}', f"py:pat:{p['id']}"))
        if len(pair) == 2:
            rows.append(pair); pair = []
    if pair:
        rows.append(pair)
    rows.append([btn(L(T["b_back"], lang), "py:m"), btn(L(T["b_home"], lang), "m:main")])
    return "\n".join(out), rows


def pat(pid, lang):
    PD = _d()
    p = next((x for x in (PD.PATTERNS if PD else []) if x["id"] == pid), None)
    if not p:
        return L(T["title"], lang), [[btn(L(T["b_back"], lang), "py:pats")]]
    out = [f'{p["icon"]} <b>{e(p["fa"])}</b>  <i>{e(p["en"])}</i>', "",
           f'<b>محرک:</b> {e(p["trigger"])}',
           f'<b>فکر خودکار:</b> {e(p["thought"])}',
           f'<b>احساس:</b> {e(p["emotion"])}',
           f'<b>رفتار:</b> {e(p["behavior"])}',
           f'<b>پیامد:</b> {e(p["consequence"])}', "", "<b>اصلاح</b>"]
    out += [" • " + e(x) for x in p["fix"]]
    out += ["", f'<i>برای اینکه ببینید این الگو در معامله‌های خودتان هست یا نه، دست‌کم {num(p["min"], lang)} '
                f'نمونهٔ ثبت‌شده لازم است. سنجش در سایت انجام می‌شود.</i>']
    return "\n".join(out), [[{"text": L(T["b_site"], lang), "url": PAGE}],
                            [btn(L(T["b_back"], lang), "py:pats"), btn(L(T["b_home"], lang), "m:main")]]


def proto(lang, pid=None):
    PD = _d()
    lst = PD.PROTOCOLS if PD else []
    if pid:
        x = next((y for y in lst if y["id"] == pid), None)
        if x:
            out = [f'<b>{e(x["fa"])}</b>  <i>{e(x["en"])}</i>', "", e(x["use"]), ""]
            out += [f'{num(i + 1, lang)}. {e(s)}' for i, s in enumerate(x["steps"])]
            out += ["", "<i>" + L(T["nfa"], lang) + "</i>"]
            return "\n".join(out), [[btn(L(T["b_back"], lang), "py:proto"), btn(L(T["b_home"], lang), "m:main")]]
    out = [L(T["title"], lang), "", L(T["pick"], lang)]
    rows = [[btn(x["fa"], f"py:proto:{x['id']}")] for x in lst]
    rows.append([btn(L(T["b_back"], lang), "py:m"), btn(L(T["b_home"], lang), "m:main")])
    return "\n".join(out), rows


def check(x, step, lang, pick=None):
    """چک‌این پیش از معامله: شش پرسش، امتیاز آمادگی و یک توصیهٔ روشن."""
    st = x.setdefault("py", {}).setdefault("chk", {})
    if step == 0 and pick is None:
        st.clear()
    if pick is not None and step > 0:
        st[PRE_Q[step - 1][0]] = pick
    if step >= len(PRE_Q):
        score = 100
        for k, _, opts, w in PRE_Q:
            v = st.get(k, 0)
            score -= (w * v) if w > 0 else (abs(w) * (len(opts) - 1 - v))
        score = max(0, min(100, score))
        x["py"]["last"] = score
        tip = T["r_go"] if score >= 70 else T["r_care"] if score >= 40 else T["r_stop"]
        return (L(T["ready"], lang, s=num(score, lang)) + "\n\n" + L(tip, lang) + "\n\n<i>" + L(T["nfa"], lang) + "</i>",
                [[btn("🔁 دوباره", "py:chk:0")], [{"text": L(T["b_site"], lang), "url": PAGE}],
                 [btn(L(T["b_back"], lang), "py:m"), btn(L(T["b_home"], lang), "m:main")]])
    k, q, opts, _ = PRE_Q[step]
    out = [L(T["title"], lang), "", f'<i>{num(step + 1, lang)} / {num(len(PRE_Q), lang)}</i>', "", f'<b>{L(q, lang)}</b>']
    rows = [[btn(o, f"py:chk:{step + 1}:{i}")] for i, o in enumerate(opts)]
    rows.append([btn(L(T["b_back"], lang), "py:m")])
    return "\n".join(out), rows


def sync(code, lang):
    """کد همگام‌سازی سایت: فقط شمار معامله و امتیاز کل، نه جزئیات معامله‌ها."""
    try:
        raw = base64.b64decode(code + "=" * (-len(code) % 4)).decode("utf-8")
        d = json.loads(raw)
        s = d.get("tps")
        return L(T["synced"], lang, n=num(d.get("n", 0), lang),
                 s=(num(round(s), lang) if isinstance(s, (int, float)) else "—"))
    except (ValueError, binascii.Error, UnicodeDecodeError):
        return L(T["bad_code"], lang)


def route(x, val, lang):
    parts = (val or "m").split(":")
    k = parts[0] or "m"
    try:
        if k == "dims":
            return dims(lang)
        if k == "dim":
            return dim(parts[1], lang)
        if k == "pats":
            return pats(lang)
        if k == "pat":
            return pat(parts[1], lang)
        if k == "proto":
            return proto(lang, parts[1] if len(parts) > 1 else None)
        if k == "chk":
            return check(x, int(parts[1]), lang, int(parts[2]) if len(parts) > 2 else None)
        if k == "emo":
            x["await"] = "pyemo"
            return ("🌊 در یک پیام بنویسید: <b>حس</b> و <b>شدت صفر تا ده</b> و اینکه چه چیزی باعثش شد.\n"
                    "<i>مثال: اضطراب ۷ چون دو ضرر پشت سر هم خوردم</i>",
                    [[btn(L(T["b_back"], lang), "py:m")]])
    except (IndexError, ValueError):
        pass
    return menu(lang)
