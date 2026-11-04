"""
Watchers and personal tools for the Coin_Kurd bot (all read-only — no keys, no trading):

  * whale alerts        big on-chain transfers from data/whales.json (min size chosen by the user)
  * volume alerts       1h volume spikes on the 40 most traded Binance coins, quality-filtered
  * signal alerts       new signals of the Kurdistani indicators, always shown with their real track record
  * % alerts            helpers for "+5%", "-5%", "±5%" price alerts
  * portfolio           coins the user types in + read-only wallets (Ethereum, Tron, Solana)
  * wallet follow       watch a wallet (trusted list curated by admins, or your own) and get told when it
                        buys or sells — a transparent "copy-trade lite": you decide, nothing is executed
  * DCA plans           reminders + a personal log of buys with average cost and P/L
  * position size       risk-based order size for a manual trade on any exchange
"""
import logging
import statistics
import threading
import time

import requests

from bot_i18n import pick

log = logging.getLogger("refbot.watch")
UA = {"User-Agent": "CoinKurdBot/1.0 (+https://entekhab.net)"}
BINANCE = ["https://data-api.binance.vision", "https://api.binance.com"]
STABLE = {"USDC", "FDUSD", "TUSD", "USDP", "DAI", "EUR", "AEUR", "BUSD", "USDE", "XUSD", "USD1", "BFUSD", "PAXG"}


def L(d, lang, /, **kw):
    s = pick(d, lang)
    return s.format(**kw) if kw else s


def esc(s):
    return str(s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def short(a):
    return f"{a[:6]}…{a[-4:]}" if a and len(a) > 12 else (a or "?")


def usd(x):
    if x is None:
        return "—"
    for d, s in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if abs(x) >= d:
            return f"${x / d:.2f}{s}"
    return f"${x:,.0f}"


def subs(x):
    return x.setdefault("subs", {})


class Hourly:
    """global per-hour cap for one kind of broadcast"""

    def __init__(self, cap):
        self.cap, self.h, self.n = cap, None, 0

    def take(self):
        h = int(time.time() // 3600)
        if h != self.h:
            self.h, self.n = h, 0
        if self.n >= self.cap:
            return False
        self.n += 1
        return True


# ================================================================== texts
T = {
    "whale": {"fa": "🐋 <b>انتقال نهنگ</b>: {amt} {asset} (≈{usd})\n{a} → {b}",
              "ckb": "🐋 <b>گواستنەوەی نەهەنگ</b>: {amt} {asset} (≈{usd})\n{a} ← {b}",
              "kmr": "🐋 <b>Veguhastina nehengê</b>: {amt} {asset} (≈{usd})\n{a} → {b}",
              "ar": "🐋 <b>تحويل حوت</b>: {amt} {asset} (≈{usd})\n{a} ← {b}",
              "en": "🐋 <b>Whale transfer</b>: {amt} {asset} (≈{usd})\n{a} → {b}"},
    "whale_note": {"fa": "ℹ️ انتقال بزرگ لزوماً خرید یا فروش نیست (ممکن است جابه‌جایی داخلی صرافی باشد).",
                   "ckb": "ℹ️ گواستنەوەی گەورە هەمیشە کڕین یان فرۆشتن نییە.",
                   "kmr": "ℹ️ Veguhastina mezin her tim kirîn an firotin nîne.",
                   "ar": "ℹ️ التحويل الكبير ليس بالضرورة شراءً أو بيعاً (قد يكون نقلاً داخلياً في منصة).",
                   "en": "ℹ️ A big transfer is not necessarily a buy or sell (it may be an internal exchange move)."},
    "vol": {"fa": "📊 <b>جهش حجم: {c}</b>\nحجم ۱ ساعت اخیر ×{x} میانهٔ ۲۴ ساعت ({v}) · قیمت در همین ساعت {r}",
            "ckb": "📊 <b>بازدانی قەبارە: {c}</b>\nقەبارەی ١ کاتژمێر ×{x} ناوەندی ٢٤ک ({v}) · نرخ {r}",
            "kmr": "📊 <b>Bazdana qebareyê: {c}</b>\nQebareya 1 saetê ×{x} navîn 24s ({v}) · biha {r}",
            "ar": "📊 <b>قفزة في الحجم: {c}</b>\nحجم الساعة الأخيرة ×{x} من وسيط 24 ساعة ({v}) · السعر خلالها {r}",
            "en": "📊 <b>Volume spike: {c}</b>\nLast 1h volume ×{x} the 24h median ({v}) · price {r} that hour"},
    "sig": {"fa": "📡 <b>سیگنال اندیکاتور کردستانی</b>\n{ind} · {sym} {tf}\n{side} @ {price}{state}\n📈 کارنامهٔ واقعی این اندیکاتور: {n} سیگنال، موفقیت {win}٪، میانگین {avg}٪",
            "ckb": "📡 <b>سیگناڵی ئیندیکاتۆری کوردستانی</b>\n{ind} · {sym} {tf}\n{side} @ {price}{state}\n📈 ئەنجامی ڕاستەقینە: {n} سیگناڵ، سەرکەوتن {win}٪، تێکڕا {avg}٪",
            "kmr": "📡 <b>Sînyala îndîkatora Kurdistanî</b>\n{ind} · {sym} {tf}\n{side} @ {price}{state}\n📈 Encama rastîn: {n} sînyal, serkeftin {win}%, navîn {avg}%",
            "ar": "📡 <b>إشارة المؤشر الكردستاني</b>\n{ind} · {sym} {tf}\n{side} @ {price}{state}\n📈 السجل الفعلي: {n} إشارة، نجاح {win}٪، متوسط {avg}٪",
            "en": "📡 <b>Kurdistani indicator signal</b>\n{ind} · {sym} {tf}\n{side} @ {price}{state}\n📈 Real track record: {n} signals, {win}% win, avg {avg}%"},
    "sig_note": {"fa": "⚠️ سیگنال اجرا نمی‌شود؛ خودت تصمیم بگیر. برای حجم معامله: <code>/size ورود حدضرر ریسک$</code>",
                 "ckb": "⚠️ سیگناڵ جێبەجێ ناکرێت؛ خۆت بڕیار بدە. بۆ قەبارە: <code>/size entry stop risk</code>",
                 "kmr": "⚠️ Sînyal nayê bicîhanîn; tu biryarê bide. Ji bo mezinahiyê: <code>/size entry stop risk</code>",
                 "ar": "⚠️ لا تُنفَّذ الإشارة تلقائياً؛ القرار لك. لحجم الصفقة: <code>/size الدخول الوقف المخاطرة$</code>",
                 "en": "⚠️ Nothing is executed; you decide. For size: <code>/size entry stop risk$</code>"},
    # ---------------------------------------------------- alert centre
    "center": {"fa": "🔔 <b>مرکز هشدارها</b>\nهر کدام را خواستی روشن کن:", "ckb": "🔔 <b>ناوەندی ئاگادارییەکان</b>\nهەرکامێکت ویست هەڵیبکە:",
               "kmr": "🔔 <b>Navenda hişyariyan</b>\nKîjan ku tu dixwazî veke:", "ar": "🔔 <b>مركز التنبيهات</b>\nفعّل ما تريد:",
               "en": "🔔 <b>Alert centre</b>\nSwitch on what you want:"},
    "b_whale": {"fa": "🐋 نهنگ‌ها ≥ {m}", "ckb": "🐋 نەهەنگەکان ≥ {m}", "kmr": "🐋 Neheng ≥ {m}", "ar": "🐋 الحيتان ≥ {m}",
                "en": "🐋 Whales ≥ {m}"},
    "b_vol": {"fa": "📊 جهش حجم", "ckb": "📊 بازدانی قەبارە", "kmr": "📊 Bazdana qebareyê", "ar": "📊 قفزات الحجم", "en": "📊 Volume spikes"},
    "b_launch": {"fa": "🚀 لانچ جدید (پرریسک)", "ckb": "🚀 لانچی نوێ (پڕمەترسی)", "kmr": "🚀 Destpêka nû (bi xeter)",
                 "ar": "🚀 الإطلاقات الجديدة (عالية المخاطر)", "en": "🚀 New launches (high risk)"},
    "b_sig": {"fa": "📡 سیگنال اندیکاتورها", "ckb": "📡 سیگناڵی ئیندیکاتۆرەکان", "kmr": "📡 Sînyalên îndîkatoran",
              "ar": "📡 إشارات المؤشرات", "en": "📡 Indicator signals"},
    "b_outage": {"fa": "🆘 قطعی/وصل اینترنت ایران", "ckb": "🆘 پچڕان/گەڕانەوەی ئینتەرنێتی ئێران", "kmr": "🆘 Qutbûna înterneta Îranê",
                 "ar": "🆘 انقطاع/عودة إنترنت إيران", "en": "🆘 Iran internet outage/restore"},
    "b_price": {"fa": "💲 هشدارهای قیمت من", "ckb": "💲 ئاگادارییەکانی نرخم", "kmr": "💲 Hişyariyên bihayê min",
                "ar": "💲 تنبيهات أسعاري", "en": "💲 My price alerts"},
    "on": {"fa": "✅", "ckb": "✅", "kmr": "✅", "ar": "✅", "en": "✅"},
    "off": {"fa": "▫️", "ckb": "▫️", "kmr": "▫️", "ar": "▫️", "en": "▫️"},
    # ---------------------------------------------------- portfolio
    "pf_head": {"fa": "💼 <b>پورتفولیوی من</b>", "ckb": "💼 <b>پۆرتفۆلیۆکەم</b>", "kmr": "💼 <b>Portfolyoya min</b>",
                "ar": "💼 <b>محفظتي</b>", "en": "💼 <b>My portfolio</b>"},
    "pf_empty": {"fa": "هنوز چیزی اضافه نکرده‌ای.", "ckb": "هێشتا هیچت زیاد نەکردووە.", "kmr": "Te hêj tiştek zêde nekiriye.",
                 "ar": "لم تضف شيئاً بعد.", "en": "Nothing added yet."},
    "pf_help": {"fa": ("➕ کوین: <code>/pf add BTC 0.05</code> · حذف: <code>/pf del BTC</code>\n"
                       "👛 کیف پول (فقط خواندنی): <code>/wallet add آدرس</code> — اتریوم، ترون (TRX/USDT)، سولانا\n"
                       "🔐 هیچ‌وقت عبارت بازیابی یا کلید خصوصی نفرست؛ آدرس عمومی کافی است."),
                "ckb": ("➕ دراو: <code>/pf add BTC 0.05</code> · سڕینەوە: <code>/pf del BTC</code>\n"
                        "👛 جزدان (تەنها خوێندنەوە): <code>/wallet add ناونیشان</code> — ئیتریۆم، ترۆن، سۆلانا\n"
                        "🔐 هەرگیز ڕستەی گەڕاندنەوە یان کلیلی تایبەت مەنێرە."),
                "kmr": ("➕ Coin: <code>/pf add BTC 0.05</code> · jêbirin: <code>/pf del BTC</code>\n"
                        "👛 Cûzdan (tenê xwendin): <code>/wallet add navnîşan</code> — Ethereum, Tron, Solana\n"
                        "🔐 Tu carî hevoka vegerandinê an mifteya taybet neşîne."),
                "ar": ("➕ عملة: <code>/pf add BTC 0.05</code> · حذف: <code>/pf del BTC</code>\n"
                       "👛 محفظة (قراءة فقط): <code>/wallet add العنوان</code> — إيثريوم، ترون، سولانا\n"
                       "🔐 لا ترسل أبداً عبارة الاسترداد أو المفتاح الخاص؛ العنوان العام يكفي."),
                "en": ("➕ Coin: <code>/pf add BTC 0.05</code> · remove: <code>/pf del BTC</code>\n"
                       "👛 Wallet (read-only): <code>/wallet add address</code> — Ethereum, Tron (TRX/USDT), Solana\n"
                       "🔐 Never send a recovery phrase or private key; the public address is enough.")},
    "pf_total": {"fa": "💰 جمع: <b>{v}</b>{toman} · ۲۴س {ch}", "ckb": "💰 کۆ: <b>{v}</b>{toman} · ٢٤ک {ch}",
                 "kmr": "💰 Tevahî: <b>{v}</b>{toman} · 24s {ch}", "ar": "💰 المجموع: <b>{v}</b>{toman} · 24س {ch}",
                 "en": "💰 Total: <b>{v}</b>{toman} · 24h {ch}"},
    "pf_added": {"fa": "✅ اضافه شد.", "ckb": "✅ زیادکرا.", "kmr": "✅ Hat zêdekirin.", "ar": "✅ تمت الإضافة.", "en": "✅ Added."},
    "pf_removed": {"fa": "🗑 حذف شد.", "ckb": "🗑 سڕایەوە.", "kmr": "🗑 Hat jêbirin.", "ar": "🗑 تم الحذف.", "en": "🗑 Removed."},
    "pf_bad": {"fa": "فرمت درست نیست. مثال: <code>/pf add BTC 0.05</code>", "ckb": "شێوازەکە هەڵەیە. نموونە: <code>/pf add BTC 0.05</code>",
               "kmr": "Forma şaş e. Mînak: <code>/pf add BTC 0.05</code>", "ar": "الصيغة غير صحيحة. مثال: <code>/pf add BTC 0.05</code>",
               "en": "Wrong format. Example: <code>/pf add BTC 0.05</code>"},
    "w_bad": {"fa": "آدرس پشتیبانی نمی‌شود. اتریوم (0x…)، ترون (T…) یا سولانا.", "ckb": "ناونیشانەکە پشتگیری ناکرێت.",
              "kmr": "Navnîşan nayê piştgirîkirin.", "ar": "العنوان غير مدعوم. إيثريوم (0x…) أو ترون (T…) أو سولانا.",
              "en": "Unsupported address. Ethereum (0x…), Tron (T…) or Solana."},
    "w_max": {"fa": "حداکثر ۳ کیف پول.", "ckb": "زۆرترین ٣ جزدان.", "kmr": "Herî zêde 3 cûzdan.", "ar": "الحد الأقصى 3 محافظ.",
              "en": "Max 3 wallets."},
    "loading": {"fa": "در حال خواندن… چند ثانیه بعد 🔄 بزن", "ckb": "خەریکی خوێندنەوەیە… دواتر 🔄 دابگرە",
                "kmr": "Tê xwendin… piştî çend çirkeyan 🔄 bitikîne", "ar": "جارٍ القراءة… اضغط 🔄 بعد ثوانٍ",
                "en": "reading… tap 🔄 in a few seconds"},
    "w_fail": {"fa": "خواندن موجودی ممکن نشد", "ckb": "خوێندنەوەی باڵانس نەکرا", "kmr": "Balans nehat xwendin", "ar": "تعذّرت قراءة الرصيد",
               "en": "couldn't read balance"},
    # ---------------------------------------------------- wallet follow
    "fw_head": {"fa": "👀 <b>دنبال کردن کیف‌پول‌ها (کپی‌ترید محدود)</b>", "ckb": "👀 <b>شوێنکەوتنی جزدانەکان</b>",
                "kmr": "👀 <b>Şopandina cûzdanan</b>", "ar": "👀 <b>متابعة المحافظ (نسخ تداول محدود)</b>",
                "en": "👀 <b>Follow wallets (copy-trade lite)</b>"},
    "fw_warn": {"fa": ("⚠️ <b>ریسک بالا</b>: ربات فقط خبر می‌دهد کیف چه خرید یا فروخت؛ هیچ معامله‌ای اجرا نمی‌کند. خبر با تأخیر می‌رسد، "
                       "صاحب کیف ممکن است اطلاعاتی داشته باشد که تو نداری، یا عمداً کیف را برای فریب دیگران استفاده کند. "
                       "سود گذشتهٔ یک کیف تضمینی برای آینده نیست."),
                "ckb": "⚠️ <b>مەترسی بەرز</b>: بۆت تەنها هەواڵ دەدات؛ هیچ مامەڵەیەک ناکات. هەواڵ بە دواکەوتن دەگات و قازانجی ڕابردوو گەرەنتی نییە.",
                "kmr": "⚠️ <b>Xetera bilind</b>: bot tenê agahdar dike; tu bazirganiyê nake. Agahî dereng tê û qezenca berê ne garantî ye.",
                "ar": "⚠️ <b>مخاطر عالية</b>: البوت يُخبرك فقط بما اشترته المحفظة أو باعته ولا ينفّذ أي صفقة. التنبيه متأخر، وقد يملك صاحبها معلومات لا تملكها أو يستخدمها لخداع المتابعين. الأرباح السابقة لا تضمن المستقبل.",
                "en": ("⚠️ <b>High risk</b>: the bot only tells you what a wallet bought or sold; it executes nothing. Alerts arrive late, "
                       "the owner may know things you don't or use the wallet to bait followers. Past profits guarantee nothing.")},
    "fw_list": {"fa": "⭐️ کیف‌های پیشنهادی ادمین (دنبال کن/لغو):", "ckb": "⭐️ جزدانە پێشنیارکراوەکان:",
                "kmr": "⭐️ Cûzdanên pêşniyarkirî:", "ar": "⭐️ محافظ يقترحها المشرف:", "en": "⭐️ Admin-suggested wallets (follow/unfollow):"},
    "fw_none": {"fa": "هنوز کیفی پیشنهاد نشده. آدرس دلخواه: <code>/follow آدرس</code>", "ckb": "هێشتا جزدانێک پێشنیار نەکراوە. <code>/follow ناونیشان</code>",
                "kmr": "Hêj cûzdan nehatiye pêşniyarkirin. <code>/follow navnîşan</code>", "ar": "لا توجد محافظ مقترحة بعد. عنوان خاص: <code>/follow العنوان</code>",
                "en": "No suggested wallets yet. Any address: <code>/follow address</code>"},
    "fw_mine": {"fa": "کیف‌هایی که دنبال می‌کنی: {n}/5 · لغو: <code>/unfollow آدرس</code>", "ckb": "جزدانەکانت: {n}/5",
                "kmr": "Cûzdanên ku tu dişopînî: {n}/5", "ar": "المحافظ التي تتابعها: {n}/5", "en": "Wallets you follow: {n}/5 · stop: <code>/unfollow address</code>"},
    "fw_buy": {"fa": "🟢 <b>{w}</b> خرید/دریافت کرد: {amt} {sym} (≈{usd})", "ckb": "🟢 <b>{w}</b> کڕی/وەرگرت: {amt} {sym} (≈{usd})",
               "kmr": "🟢 <b>{w}</b> kirî/wergirt: {amt} {sym} (≈{usd})", "ar": "🟢 <b>{w}</b> اشترى/استلم: {amt} {sym} (≈{usd})",
               "en": "🟢 <b>{w}</b> bought/received: {amt} {sym} (≈{usd})"},
    "fw_sell": {"fa": "🔴 <b>{w}</b> فروخت/ارسال کرد: {amt} {sym} (≈{usd})", "ckb": "🔴 <b>{w}</b> فرۆشتی/نارد: {amt} {sym} (≈{usd})",
                "kmr": "🔴 <b>{w}</b> firot/şand: {amt} {sym} (≈{usd})", "ar": "🔴 <b>{w}</b> باع/أرسل: {amt} {sym} (≈{usd})",
                "en": "🔴 <b>{w}</b> sold/sent: {amt} {sym} (≈{usd})"},
    "fw_ok": {"fa": "✅ دنبال می‌کنی. وقتی این کیف بیش از $1000 خرید یا فروش کند خبرت می‌کنم.",
              "ckb": "✅ شوێنی دەکەویت. کاتێک زیاتر لە $1000 بکڕێت یان بفرۆشێت ئاگادارت دەکەم.",
              "kmr": "✅ Tu dişopînî. Dema ku ji $1000 zêdetir bikire an bifiroşe, ez ê te agahdar bikim.",
              "ar": "✅ أنت تتابعها الآن. سأنبهك عند شراء أو بيع بأكثر من 1000$.",
              "en": "✅ Following. I'll tell you when it buys or sells more than $1,000."},
    "fw_max": {"fa": "حداکثر ۵ کیف.", "ckb": "زۆرترین ٥ جزدان.", "kmr": "Herî zêde 5 cûzdan.", "ar": "الحد الأقصى 5 محافظ.", "en": "Max 5 wallets."},
    # ---------------------------------------------------- DCA
    "dca_help": {"fa": ("📆 <b>خرید پله‌ای (DCA)</b> — یادآور + دفترچهٔ شخصی؛ ربات چیزی نمی‌خرد.\n"
                        "<code>/dca BTC 20 weekly</code> (daily | weekly | monthly)\n<code>/dca del 1</code>"),
                 "ckb": ("📆 <b>کڕینی پلەیی (DCA)</b> — بیرخەرەوە + تۆماری کەسی؛ بۆت هیچ ناکڕێت.\n"
                         "<code>/dca BTC 20 weekly</code> (daily | weekly | monthly)\n<code>/dca del 1</code>"),
                 "kmr": ("📆 <b>Kirîna gav bi gav (DCA)</b> — bîrxistin + defter; bot tiştekî nakire.\n"
                         "<code>/dca BTC 20 weekly</code> (daily | weekly | monthly)\n<code>/dca del 1</code>"),
                 "ar": ("📆 <b>الشراء الدوري (DCA)</b> — تذكير + سجل شخصي؛ البوت لا يشتري شيئاً.\n"
                        "<code>/dca BTC 20 weekly</code> (daily | weekly | monthly)\n<code>/dca del 1</code>"),
                 "en": ("📆 <b>DCA plans</b> — reminders + a personal log; the bot buys nothing.\n"
                        "<code>/dca BTC 20 weekly</code> (daily | weekly | monthly)\n<code>/dca del 1</code>")},
    "dca_row": {"fa": "{i}. {c} · ${a} · {every} · {n} خرید · میانگین {avg} · سود/زیان {pnl}",
                "ckb": "{i}. {c} · ${a} · {every} · {n} کڕین · تێکڕا {avg} · قازانج/زیان {pnl}",
                "kmr": "{i}. {c} · ${a} · {every} · {n} kirîn · navîn {avg} · Q/Z {pnl}",
                "ar": "{i}. {c} · ${a} · {every} · {n} عمليات · المتوسط {avg} · الربح/الخسارة {pnl}",
                "en": "{i}. {c} · ${a} · {every} · {n} buys · avg {avg} · P/L {pnl}"},
    "dca_due": {"fa": "📆 <b>وقت خرید پله‌ای:</b> ${a} {c} (قیمت فعلی {p}). اگر خریدی ✅ بزن تا در دفترچه ثبت شود.",
                "ckb": "📆 <b>کاتی کڕینی پلەیی:</b> ${a} {c} (نرخ {p}). ئەگەر کڕیت ✅ دابگرە.",
                "kmr": "📆 <b>Dema DCA:</b> ${a} {c} (biha {p}). Heke te kirî ✅ bitikîne.",
                "ar": "📆 <b>موعد الشراء الدوري:</b> ${a} {c} (السعر {p}). إذا اشتريت اضغط ✅ لتسجيلها.",
                "en": "📆 <b>DCA time:</b> ${a} of {c} (now {p}). Tap ✅ if you bought, to log it."},
    "dca_set": {"fa": "✅ برنامهٔ DCA ثبت شد.", "ckb": "✅ پلانی DCA تۆمارکرا.", "kmr": "✅ Plana DCA hat tomarkirin.",
                "ar": "✅ تم حفظ خطة DCA.", "en": "✅ DCA plan saved."},
    "dca_log": {"fa": "📝 ثبت شد: ${a} {c} @ {p}", "ckb": "📝 تۆمارکرا: ${a} {c} @ {p}", "kmr": "📝 Hat tomarkirin: ${a} {c} @ {p}",
                "ar": "📝 تم التسجيل: ${a} {c} @ {p}", "en": "📝 Logged: ${a} {c} @ {p}"},
    "b_bought": {"fa": "✅ خریدم", "ckb": "✅ کڕیم", "kmr": "✅ Min kirî", "ar": "✅ اشتريت", "en": "✅ Bought"},
    "b_skip": {"fa": "⏭ این بار نه", "ckb": "⏭ ئەم جارە نا", "kmr": "⏭ Vê carê na", "ar": "⏭ ليس هذه المرة", "en": "⏭ Skip"},
    # ---------------------------------------------------- position size
    "size_help": {"fa": ("📏 <b>محاسبهٔ حجم معامله</b>\n<code>/size ورود حدضرر ریسک$ [هدف]</code>\n"
                         "مثال: <code>/size 77000 75500 20 80000</code> یعنی اگر حد ضرر بخورد فقط ۲۰ دلار از دست بدهی."),
                  "ckb": ("📏 <b>ژمێرەری قەبارەی مامەڵە</b>\n<code>/size entry stop risk$ [target]</code>\n"
                          "نموونە: <code>/size 77000 75500 20 80000</code>"),
                  "kmr": ("📏 <b>Hesabkera mezinahiya bazirganiyê</b>\n<code>/size entry stop risk$ [target]</code>\n"
                          "Mînak: <code>/size 77000 75500 20 80000</code>"),
                  "ar": ("📏 <b>حاسبة حجم الصفقة</b>\n<code>/size الدخول الوقف المخاطرة$ [الهدف]</code>\n"
                         "مثال: <code>/size 77000 75500 20 80000</code> أي تخسر 20$ فقط إذا ضُرب الوقف."),
                  "en": ("📏 <b>Position size calculator</b>\n<code>/size entry stop risk$ [target]</code>\n"
                         "Example: <code>/size 77000 75500 20 80000</code> = lose only $20 if the stop is hit.")},
    "size_out": {"fa": "📏 {side} · فاصلهٔ حدضرر {d}\nمقدار: <b>{q}</b> واحد · ارزش پوزیشن: <b>{v}</b>{rr}\n⚠️ اهرم = ریسک بیشتر. اول حد ضرر بگذار.",
                 "ckb": "📏 {side} · دووری ستۆپ {d}\nبڕ: <b>{q}</b> · بەهای پۆزیشن: <b>{v}</b>{rr}\n⚠️ لیڤەرێج = مەترسی زیاتر.",
                 "kmr": "📏 {side} · dûrahiya stopê {d}\nMîqdar: <b>{q}</b> · nirxa pozîsyonê: <b>{v}</b>{rr}\n⚠️ Leverage = xetera zêdetir.",
                 "ar": "📏 {side} · مسافة الوقف {d}\nالكمية: <b>{q}</b> · قيمة الصفقة: <b>{v}</b>{rr}\n⚠️ الرافعة = مخاطرة أكبر. ضع الوقف أولاً.",
                 "en": "📏 {side} · stop distance {d}\nQuantity: <b>{q}</b> · position value: <b>{v}</b>{rr}\n⚠️ Leverage = more risk. Set the stop first."},
}


# ================================================================== whale alerts
WHALE_LEVELS = [1_000_000, 5_000_000, 10_000_000, 50_000_000]
_whale_last = [0.0]
_whale_cap = {}


def whale_label(m):
    return usd(m).replace(".00", "")


def scan_whales(s, D, send):
    """every 5 min. send(uid, text, rows)"""
    if time.time() - _whale_last[0] < 300:
        return False
    _whale_last[0] = time.time()
    subs_ = [(uid, x) for uid, x in list(s["users"].items()) if subs(x).get("whale")]
    w = D.load("whales") or {}
    ev = w.get("events") or []
    first = "whale_seen" not in s
    seen = s.setdefault("whale_seen", [])
    new = [e for e in ev if e.get("tx") and e["tx"] not in seen]
    seen += [e["tx"] for e in new]
    del seen[:-600]
    if first or not subs_ or not new:
        return bool(new)
    for e in sorted(new, key=lambda e: -(e.get("usd") or 0))[:6]:
        link = (f"https://mempool.space/tx/{e['tx']}" if e.get("asset") == "BTC" else f"https://etherscan.io/tx/{e['tx']}")
        for uid, x in subs_:
            if (e.get("usd") or 0) < subs(x)["whale"]:
                continue
            cap = _whale_cap.setdefault(uid, Hourly(6))
            if not cap.take():
                continue
            lang = x.get("lang", "fa")
            amt = f"{e.get('amount', 0):,.0f}" if (e.get("amount") or 0) >= 100 else f"{e.get('amount', 0):,.2f}"
            text = L(T["whale"], lang, amt=amt, asset=e.get("asset", "?"), usd=usd(e.get("usd")),
                     a=short(e.get("from")), b=short(e.get("to"))) + "\n" + L(T["whale_note"], lang)
            send(int(uid), text, [[{"text": "🔗 tx", "url": link}]])
    return True


# ================================================================== volume spikes
_vol_last = [0.0]
_vol_cap = Hourly(6)


def _bget(path, params):
    for base in BINANCE:
        try:
            r = requests.get(base + path, params=params, timeout=20, headers=UA)
            if r.ok:
                return r.json()
        except Exception:
            continue
    return None


def spike(klines):
    """-> (ratio, quote_volume, return%) of the last CLOSED hour vs the median of the 24 before, or None"""
    if not klines or len(klines) < 20:
        return None
    closed = klines[:-1]                                    # the last kline is still forming
    last = closed[-1]
    prev = [float(k[7]) for k in closed[-25:-1]]
    med = statistics.median(prev) if prev else 0
    qv = float(last[7])
    o, c = float(last[1]), float(last[4])
    if not med or not o:
        return None
    return qv / med, qv, (c / o - 1) * 100


def scan_volume(s, send, top_n=40):
    """every 15 min; quality filter: ×3 the median, ≥ $3M in the hour, price moved ≥ 1.5%, once per coin per 6 h"""
    if time.time() - _vol_last[0] < 900:
        return False
    _vol_last[0] = time.time()
    subs_ = [(uid, x) for uid, x in list(s["users"].items()) if subs(x).get("vol")]
    if not subs_:
        return False
    tick = _bget("/api/v3/ticker/24hr", {"type": "MINI"}) or []
    rows = [(t["symbol"][:-4], float(t.get("quoteVolume") or 0)) for t in tick
            if t.get("symbol", "").endswith("USDT") and t["symbol"][:-4] not in STABLE]
    rows.sort(key=lambda r: -r[1])
    last_sent = s.setdefault("vol_sent", {})
    hits = []
    for coin, _ in rows[:top_n]:
        if time.time() - last_sent.get(coin, 0) < 6 * 3600:
            continue
        k = _bget("/api/v3/klines", {"symbol": coin + "USDT", "interval": "1h", "limit": 27})
        sp = spike(k)
        if sp and sp[0] >= 3 and sp[1] >= 3_000_000 and abs(sp[2]) >= 1.5:
            hits.append((coin, sp))
    for coin, (ratio, qv, ret) in sorted(hits, key=lambda h: -h[1][0])[:3]:
        if not _vol_cap.take():
            break
        last_sent[coin] = time.time()
        for uid, x in subs_:
            lang = x.get("lang", "fa")
            send(int(uid), L(T["vol"], lang, c=coin, x=f"{ratio:.1f}", v=usd(qv), r=f"{ret:+.1f}%"),
                 [[{"text": "🪙 " + coin, "callback_data": f"c:{coin}"}]])
    return True


# ================================================================== indicator signals (transparent)
_sig_last = [0.0]


def scan_signals(s, D, send):
    if time.time() - _sig_last[0] < 900:
        return False
    _sig_last[0] = time.time()
    data = D.load("signals") or {}
    sigs = data.get("signals") or []
    stats = data.get("stats") or {}
    first = "sig_seen" not in s
    seen = s.setdefault("sig_seen", [])
    new = [g for g in sigs if g.get("id") and g["id"] not in seen]
    seen += [g["id"] for g in new]
    del seen[:-400]
    subs_ = [(uid, x) for uid, x in list(s["users"].items()) if subs(x).get("sig")]
    if first or not new or not subs_:
        return bool(new)
    for g in new[:3]:
        st = stats.get(g.get("ind"), {})
        side = {"long": "🟢 LONG", "short": "🔴 SHORT"}.get(g.get("side"), "ℹ️ " + str(g.get("side", "info")).upper())
        state = f" · {g['state']}" if g.get("state") else ""
        for uid, x in subs_:
            lang = x.get("lang", "fa")
            txt = L(T["sig"], lang, ind=g.get("ind", "?"), sym=g.get("sym", "?"), tf=g.get("tf", ""), side=side,
                    price=D.fp(g.get("price")), state=state, n=st.get("eval", st.get("n", "?")),
                    win=st.get("win", "?"), avg=st.get("avg", "?"))
            send(int(uid), txt + "\n" + L(T["sig_note"], lang), [[{"text": "📡", "url": D.SITE + "/indicators/"}]])
    return True


# ================================================================== % alerts
def parse_pct(val):
    """'+5%' -> ('+', 5.0); '-3%' -> ('-', 3.0); '5%' / '±5%' -> ('±', 5.0); else None"""
    v = (val or "").strip().replace("٪", "%").translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))
    if not v.endswith("%"):
        return None
    v = v[:-1].strip()
    sign = "±"
    if v and v[0] in "+-±":
        sign, v = v[0], v[1:]
    try:
        p = float(v)
    except ValueError:
        return None
    if not 0.1 <= p <= 500:
        return None
    return sign, p


def pct_alert(coin, now, sign, p, iran=False):
    """alert dict understood by refbot.check_alerts"""
    a = {"coin": coin, "at": int(time.time()), "ref": now, "pct": p}
    if iran:
        a["iran"] = True
    if sign == "+":
        a.update(op=">", price=now * (1 + p / 100))
    elif sign == "-":
        a.update(op="<", price=now * (1 - p / 100))
    else:
        a.update(op="±", price=now)
    return a


def pct_hit(a, now):
    return now is not None and a.get("ref") and abs(now / a["ref"] - 1) * 100 >= a["pct"]


# ================================================================== portfolio
TRON_USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
TRON_USDC = "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8"
SOL_RPC = "https://api.mainnet-beta.solana.com"
_wcache = {}


def chain_of(addr):
    import bot_token as TK
    if TK.EVM_RE.fullmatch(addr or ""):
        return "eth"
    if TK.TRON_RE.fullmatch(addr or ""):
        return "tron"
    if TK.SOL_RE.fullmatch(addr or ""):
        return "sol"
    return None


def wallet_holdings(addr, D, ttl=300):
    """-> {SYMBOL: (amount, usd)} or None. Read-only public endpoints."""
    ent = _wcache.get(addr)
    if ent and time.time() - ent[0] < ttl:
        return ent[1]
    ch = chain_of(addr)
    out = None
    try:
        if ch == "eth":
            rsp = requests.get(f"https://api.ethplorer.io/getAddressInfo/{addr}", params={"apiKey": "freekey"},
                               headers=UA, timeout=25)
            rsp.raise_for_status()
            r = rsp.json()
            if r.get("error") or "ETH" not in r:
                raise ValueError(f"ethplorer: {r.get('error')}")
            out = {}
            eth = r.get("ETH") or {}
            if eth.get("balance"):
                out["ETH"] = (float(eth["balance"]), float(eth["balance"]) * float((eth.get("price") or {}).get("rate") or 0))
            for tkn in r.get("tokens") or []:
                info = tkn.get("tokenInfo") or {}
                dec = int(info.get("decimals") or 0)
                amt = float(tkn.get("rawBalance") or tkn.get("balance") or 0) / (10 ** dec)
                price = (info.get("price") or {}) if isinstance(info.get("price"), dict) else {}
                val = amt * float(price.get("rate") or 0)
                if amt > 0:                                 # unpriced tokens kept at $0 so they never look "sold"
                    sym = esc(info.get("symbol") or "?")[:12]
                    out[sym] = (out.get(sym, (0, 0))[0] + amt, out.get(sym, (0, 0))[1] + val)
        elif ch == "tron":
            rsp = requests.get(f"https://api.trongrid.io/v1/accounts/{addr}", headers=UA, timeout=25)
            rsp.raise_for_status()
            r = rsp.json()
            if r.get("success") is False or r.get("Error") or "data" not in r:
                raise ValueError("trongrid error")
            acc = (r.get("data") or [{}])[0]
            out = {}
            trx = float(acc.get("balance") or 0) / 1e6
            px = D.live_prices()
            if trx:
                out["TRX"] = (trx, trx * (px.get("TRX") or (0,))[0])
            for row in acc.get("trc20") or []:
                for c, raw in row.items():
                    if c in (TRON_USDT, TRON_USDC):
                        amt = float(raw) / 1e6
                        out["USDT" if c == TRON_USDT else "USDC"] = (amt, amt)
        elif ch == "sol":
            def rpc(method, params):
                rsp = requests.post(SOL_RPC, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
                                    headers=UA, timeout=25)
                rsp.raise_for_status()
                j = rsp.json()
                if j.get("error") or j.get("result") is None:
                    raise ValueError(f"solana rpc: {j.get('error')}")
                return j["result"]
            out = {}
            lam = (rpc("getBalance", [addr]) or {}).get("value") or 0
            px = D.live_prices()
            if lam:
                out["SOL"] = (lam / 1e9, lam / 1e9 * (px.get("SOL") or (0,))[0])
            accs = (rpc("getTokenAccountsByOwner", [addr, {"programId": "TokenkegQfeZyiNwAJbNbBNhv5Lf7tc9EXLmBsRBAtVM"},
                                                   {"encoding": "jsonParsed"}]) or {}).get("value") or []
            mints = {}
            for a in accs:
                info = (((a.get("account") or {}).get("data") or {}).get("parsed") or {}).get("info") or {}
                amt = float(((info.get("tokenAmount") or {}).get("uiAmount")) or 0)
                if amt > 0:
                    mints[info.get("mint")] = mints.get(info.get("mint"), 0) + amt
            if mints:
                import bot_token as TK
                top = sorted(mints, key=lambda m: -mints[m])[:30]
                pairs = TK.pairs_for(top)
                for m in mints:
                    p = TK.best_pair(pairs, m) if m in top else None
                    val = mints[m] * float(p.get("priceUsd") or 0) if p else 0.0
                    sym = esc((p.get("baseToken") or {}).get("symbol") if p else m[:6])[:12]
                    sym = sym if sym not in out else f"{sym}·{m[:4]}"
                    out[sym] = (mints[m], val)
    except Exception as ex:  # noqa: BLE001
        log.info("wallet %s read failed: %s", short(addr), ex)
        out = None
    if out is not None:
        _wcache[addr] = (time.time(), out)
        if len(_wcache) > 300:
            for k in sorted(_wcache, key=lambda k: _wcache[k][0])[:100]:
                _wcache.pop(k, None)
    elif ent:
        out = ent[1]
    return out


def pf(x):
    p = x.setdefault("pf", {})
    p.setdefault("coins", {})
    p.setdefault("wallets", [])
    return p


def pf_cmd(x, arg, lang, D):
    """/pf add BTC 0.5 | /pf del BTC  -> reply text, or None to show the portfolio"""
    parts = arg.split()
    if not parts:
        return None
    p = pf(x)
    if parts[0].lower() in ("add", "+", "اضافه", "زیاد") and len(parts) == 3:
        try:
            amt = float(parts[2].replace(",", ""))
        except ValueError:
            return L(T["pf_bad"], lang)
        sym = parts[1].upper().lstrip("$")
        if sym != "USDT" and not D.find_coin(sym):
            return L(T["pf_bad"], lang)
        if amt <= 0 or len(p["coins"]) >= 30 and sym not in p["coins"]:
            return L(T["pf_bad"], lang)
        p["coins"][sym] = p["coins"].get(sym, 0) + amt
        return L(T["pf_added"], lang)
    if parts[0].lower() in ("del", "rm", "-", "حذف") and len(parts) == 2:
        p["coins"].pop(parts[1].upper(), None)
        return L(T["pf_removed"], lang)
    return L(T["pf_bad"], lang)


def wallet_cmd(x, arg, lang):
    parts = arg.split()
    p = pf(x)
    if len(parts) == 2 and parts[0].lower() in ("add", "+"):
        if not chain_of(parts[1]):
            return L(T["w_bad"], lang)
        if len(p["wallets"]) >= 3:
            return L(T["w_max"], lang)
        if parts[1] not in p["wallets"]:
            p["wallets"].append(parts[1])
        return L(T["pf_added"], lang)
    if len(parts) == 2 and parts[0].lower() in ("del", "rm", "-"):
        p["wallets"] = [w for i, w in enumerate(p["wallets"], 1) if w != parts[1] and str(i) != parts[1]]
        return L(T["pf_removed"], lang)
    return L(T["pf_help"], lang)


_warming = set()


def _warm(addr, D):
    """read a wallet in the background so the update loop never waits on a slow public API"""
    if addr in _warming:
        return
    _warming.add(addr)

    def run():
        try:
            wallet_holdings(addr, D)
        finally:
            _warming.discard(addr)
    threading.Thread(target=run, name="wallet", daemon=True).start()


def pf_view(x, lang, D, IR, cached_only=False):
    p = pf(x)
    px = D.live_prices()
    lines, total, total_prev = [L(T["pf_head"], lang), ""], 0.0, 0.0
    for sym, amt in sorted(p["coins"].items()):
        price, ch = (1.0, 0.0) if sym == "USDT" else (px.get(sym) or (None, 0.0))
        if price is None:
            lines.append(f"• {esc(sym)}: {amt:g} — ?")
            continue
        val = amt * price
        total += val
        total_prev += val / (1 + ch / 100) if ch > -100 else val
        lines.append(f"• {esc(sym)}: {amt:g} × {D.fp(price)} = <b>{usd(val)}</b> ({ch:+.1f}%)")
    for i, w in enumerate(p["wallets"], 1):
        if cached_only and w not in _wcache:
            _warm(w, D)
            lines.append(f"👛 {i}. <code>{short(w)}</code> — ⏳ " + L(T["loading"], lang))
            continue
        if cached_only and time.time() - _wcache[w][0] > 300:
            _warm(w, D)                                   # show the cached figure now, refresh behind it
        h = _wcache[w][1] if cached_only else wallet_holdings(w, D)
        if h is None:
            lines.append(f"👛 {i}. <code>{short(w)}</code> — {L(T['w_fail'], lang)}")
            continue
        wv = sum(v for _, v in h.values())
        total += wv
        total_prev += wv
        top = ", ".join(f"{k} {usd(v)}" for k, (_, v) in sorted(h.items(), key=lambda kv: -kv[1][1])[:5])
        lines.append(f"👛 {i}. <code>{short(w)}</code> {chain_of(w)} = <b>{usd(wv)}</b>  ({top or '—'})")
    if len(lines) == 2:
        lines.append(L(T["pf_empty"], lang))
    else:
        rate = IR.snapshot().get("usdt") if lang in ("fa", "ckb") else None
        toman = f" ≈ {IR.toman(total * rate)} " + ("تومان" if lang == "fa" else "تمەن") if rate else ""
        ch = (total / total_prev - 1) * 100 if total_prev else 0
        lines += ["", L(T["pf_total"], lang, v=usd(total), toman=toman, ch=f"{ch:+.2f}%")]
    lines += ["", L(T["pf_help"], lang)]
    return "\n".join(lines)


# ================================================================== wallet follow
MAX_FOLLOW = 5
MIN_MOVE_USD = 1000
_fw_last = [0.0]


def follow(x, addr, lang):
    if not chain_of(addr):
        return L(T["w_bad"], lang)
    f = x.setdefault("follow", [])
    if addr in f:
        return L(T["fw_ok"], lang)
    if len(f) >= MAX_FOLLOW:
        return L(T["fw_max"], lang)
    f.append(addr)
    return L(T["fw_ok"], lang) + "\n\n" + L(T["fw_warn"], lang)


def unfollow(x, addr, lang):
    f = x.setdefault("follow", [])
    if addr in f:
        f.remove(addr)
    return L(T["pf_removed"], lang)


def follow_view(s, x, lang):
    lines = [L(T["fw_head"], lang), "", L(T["fw_warn"], lang), ""]
    rows = []
    tr = s.get("trusted") or []
    if tr:
        lines.append(L(T["fw_list"], lang))
        mine = set(x.get("follow") or [])
        for i, w in enumerate(tr, 1):
            mark = "✅" if w["a"] in mine else "▫️"
            lines.append(f"{i}. {w.get('label', '')} · {chain_of(w['a'])} · <code>{short(w['a'])}</code>")
            rows.append([{"text": f"{mark} {i}. {w.get('label', short(w['a']))}"[:40], "callback_data": f"fw:{i}"}])
    else:
        lines.append(L(T["fw_none"], lang))
    lines += ["", L(T["fw_mine"], lang, n=len(x.get("follow") or []))]
    return "\n".join(lines), rows


def diff(old, new):
    """-> [(sym, delta_amount, delta_usd)] meaningful changes between two holdings snapshots"""
    out = []
    for sym in set(old) | set(new):
        a0, v0 = old.get(sym, (0, 0))
        a1, v1 = new.get(sym, (0, 0))
        da = a1 - a0
        if not a0 and not a1:
            continue
        price = (v1 / a1) if a1 else ((v0 / a0) if a0 else 0)
        dv = da * price
        base = max(abs(a0), 1e-12)
        if abs(dv) >= MIN_MOVE_USD and (a0 == 0 or abs(da) / base >= 0.2):
            out.append((sym, da, dv))
    return sorted(out, key=lambda r: (-abs(r[2]), r[0]))


def scan_follows(s, D, send):
    """every 15 min: holdings snapshot per followed wallet → buy/sell notices"""
    if time.time() - _fw_last[0] < 900:
        return False
    _fw_last[0] = time.time()
    followers = {}
    for uid, x in list(s["users"].items()):
        for a in x.get("follow") or []:
            followers.setdefault(a, []).append((uid, x))
    if not followers:
        return False
    snaps = s.setdefault("wsnap", {})
    for a in list(snaps):
        if a not in followers:
            snaps.pop(a, None)
    labels = {w["a"]: w.get("label") for w in s.get("trusted") or []}
    for addr, fl in list(followers.items())[:60]:
        h = wallet_holdings(addr, D, ttl=600)
        if h is None:
            continue
        old = snaps.get(addr)
        # store only the 40 biggest, but diff against the FULL new holdings: a token that merely drops
        # out of the top 40 is still present in `h`, so it is never reported as "sold"
        snaps[addr] = {k: [v[0], v[1]] for k, v in sorted(h.items(), key=lambda kv: -kv[1][1])[:40]}
        if old is None:
            continue
        old_t = {k: tuple(v) for k, v in old.items()}
        ch = diff(old_t, {k: v for k, v in h.items() if k in old_t or v[1] >= MIN_MOVE_USD})[:4]
        for sym, da, dv in ch:
            for uid, x in fl:
                lang = x.get("lang", "fa")
                key = "fw_buy" if da > 0 else "fw_sell"
                send(int(uid), L(T[key], lang, w=labels.get(addr) or short(addr), amt=f"{abs(da):,.4g}", sym=sym, usd=usd(abs(dv)))
                     + "\n" + L({"fa": "⚠️ این سیگنال خرید نیست.", "ckb": "⚠️ ئەمە سیگناڵی کڕین نییە.", "kmr": "⚠️ Ev ne sînyala kirînê ye.",
                                 "ar": "⚠️ هذه ليست إشارة شراء.", "en": "⚠️ Not a buy signal."}, lang), None)
    return True


# ================================================================== DCA
EVERY = {"daily": 86400, "weekly": 7 * 86400, "monthly": 30 * 86400, "d": 86400, "w": 7 * 86400, "m": 30 * 86400,
         "روزانه": 86400, "هفتگی": 7 * 86400, "ماهانه": 30 * 86400}
EVERY_NAME = {86400: "daily", 7 * 86400: "weekly", 30 * 86400: "monthly"}
_dca_last = [0.0]


def dca_cmd(x, arg, lang, D):
    plans = x.setdefault("dca", [])
    parts = arg.split()
    if len(parts) == 2 and parts[0].lower() in ("del", "rm", "حذف") and parts[1].isdigit():
        i = int(parts[1]) - 1
        if 0 <= i < len(plans):
            plans.pop(i)
        return L(T["pf_removed"], lang)
    if len(parts) == 3:
        sym = parts[0].upper()
        try:
            amt = float(parts[1])
        except ValueError:
            amt = 0
        every = EVERY.get(parts[2].lower())
        if D.find_coin(sym) and amt > 0 and every and len(plans) < 3:
            plans.append({"c": sym, "a": amt, "every": every, "next": int(time.time()) + every, "buys": []})
            return L(T["dca_set"], lang) + "\n\n" + dca_view(x, lang, D)
    return dca_view(x, lang, D)


def dca_view(x, lang, D):
    lines = [L(T["dca_help"], lang), ""]
    px = D.live_prices()
    for i, p in enumerate(x.get("dca") or [], 1):
        buys = p.get("buys") or []
        spent = sum(b[2] for b in buys)
        qty = sum(b[2] / b[1] for b in buys if b[1])
        avg = spent / qty if qty else None
        now = (px.get(p["c"]) or (None,))[0]
        pnl = f"{(qty * now / spent - 1) * 100:+.1f}%" if qty and now and spent else "—"
        lines.append(L(T["dca_row"], lang, i=i, c=p["c"], a=f"{p['a']:g}", every=EVERY_NAME.get(p["every"], "?"),
                       n=len(buys), avg=D.fp(avg) if avg else "—", pnl=pnl))
    return "\n".join(lines)


def dca_due(s, D, send):
    if time.time() - _dca_last[0] < 600:
        return False
    _dca_last[0] = time.time()
    changed = False
    px = D.live_prices()
    for uid, x in list(s["users"].items()):
        for i, p in enumerate(x.get("dca") or [], 1):
            if time.time() < p.get("next", 0):
                continue
            p["next"] = int(time.time()) + p["every"]
            changed = True
            lang = x.get("lang", "fa")
            now = (px.get(p["c"]) or (None,))[0]
            send(int(uid), L(T["dca_due"], lang, a=f"{p['a']:g}", c=p["c"], p=D.fp(now)),
                 [[{"text": L(T["b_bought"], lang), "callback_data": f"db:{i}"},
                   {"text": L(T["b_skip"], lang), "callback_data": "noop"}]])
    return changed


def dca_log(x, i, lang, D):
    plans = x.get("dca") or []
    if not 1 <= i <= len(plans):
        return None
    p = plans[i - 1]
    now = (D.live_prices().get(p["c"]) or (None,))[0]
    if not now:
        return None
    p.setdefault("buys", []).append([int(time.time()), now, p["a"]])
    del p["buys"][:-200]
    return L(T["dca_log"], lang, a=f"{p['a']:g}", c=p["c"], p=D.fp(now))


# ================================================================== position size
def size(arg, lang, D):
    nums = []
    for w in arg.replace(",", "").split():
        try:
            nums.append(float(w.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")).lstrip("$")))
        except ValueError:
            return L(T["size_help"], lang)
    if len(nums) not in (3, 4) or nums[0] <= 0 or nums[1] <= 0 or nums[2] <= 0 or nums[0] == nums[1]:
        return L(T["size_help"], lang)
    entry, stop, risk = nums[:3]
    dist = abs(entry - stop)
    qty = risk / dist
    side = "🟢 LONG" if stop < entry else "🔴 SHORT"
    rr = ""
    if len(nums) == 4:
        tgt = nums[3]
        reward = (tgt - entry) if stop < entry else (entry - tgt)
        if reward > 0:
            rr = f"\n🎯 R:R = 1 : {reward / dist:.2f} · {usd(reward * qty)}"
    q = f"{qty:,.6f}".rstrip("0").rstrip(".") if qty < 100 else f"{qty:,.2f}"
    return L(T["size_out"], lang, side=side, d=f"{dist / entry * 100:.2f}%", q=q, v=usd(qty * entry), rr=rr)


# ================================================================== alert centre keyboard
def center_rows(x, lang, outage_on):
    sb = subs(x)
    m = sb.get("whale")
    mark = lambda on: L(T["on" if on else "off"], lang)
    return [
        [{"text": f"{mark(m)} " + L(T["b_whale"], lang, m=whale_label(m or WHALE_LEVELS[2])), "callback_data": "sb:whale"}],
        [{"text": f"{mark(sb.get('vol'))} " + L(T["b_vol"], lang), "callback_data": "sb:vol"},
         {"text": f"{mark(sb.get('sig'))} " + L(T["b_sig"], lang), "callback_data": "sb:sig"}],
        [{"text": f"{mark(sb.get('launch'))} " + L(T["b_launch"], lang), "callback_data": "sb:launch"}],
        [{"text": f"{mark(outage_on)} " + L(T["b_outage"], lang), "callback_data": "sb:kit"}],
        [{"text": L(T["b_price"], lang), "callback_data": "m:alerts"}],
    ]


def toggle(x, key):
    """cycle a subscription; whales cycle through the size levels then off"""
    sb = subs(x)
    if key == "whale":
        cur = sb.get("whale")
        if not cur:
            sb["whale"] = WHALE_LEVELS[0]
        elif cur in WHALE_LEVELS and WHALE_LEVELS.index(cur) + 1 < len(WHALE_LEVELS):
            sb["whale"] = WHALE_LEVELS[WHALE_LEVELS.index(cur) + 1]
        else:
            sb.pop("whale", None)
    elif key == "kit":
        x["kit"] = not x.get("kit")
    else:
        sb[key] = not sb.get(key)
        if not sb[key]:
            sb.pop(key, None)
