"""
The market map (/heatmap/, /bubbles/, /money-flow/, /liquidity/, /etf/) in the bot: section "mmap".

  * what the five pages offer, and a short live summary from the same files they read: how many of the top 100 rose
    or fell over 24 h, the biggest movers, the sectors with the most net buying and selling on Binance over 24 h
    (data/mm.json, data/mm_flow.json), the stablecoin supply over seven days and the last reported ETF day
    (data/etf.json);
  * the ways in: each page inside Telegram (Web App buttons) and the heatmap in the browser.

Read-only: nothing is stored or sent. A missing or broken file only drops its own line; numbers are never made up.
Self-test: python3 scripts/bot_mm.py
"""
import html
from datetime import datetime, timezone

from bot_i18n import pick

SITE = "https://entekhab.net"
URL = SITE + "/heatmap/"
TOP = 100                       # the site's money-flow page also starts with the top 100 (stablecoins and wrapped tokens left out)
DIG = {"fa": "۰۱۲۳۴۵۶۷۸۹", "ckb": "٠١٢٣٤٥٦٧٨٩", "ar": "٠١٢٣٤٥٦٧٨٩"}

TXT = {
    "title": {"fa": "🗺 <b>نقشهٔ بازار</b>", "ckb": "🗺 <b>نەخشەی بازاڕ</b>", "kmr": "🗺 <b>Nexşeya bazarê</b>", "ar": "🗺 <b>خريطة السوق</b>",
              "en": "🗺 <b>Market map</b>"},
    "body": {
        "fa": ("کل بازار در یک نگاه، زنده و در ۹ تایم‌فریم (۵ دقیقه تا یک سال):\n"
               "• 🟩 نقشهٔ حرارتی: ۲۵۰ ارز بزرگ در بخش‌هایشان، دوبعدی یا «شهر سه‌بعدی بازار»\n"
               "• 🫧 حباب‌ها: هر ارز یک حباب به اندازهٔ حرکتش، دوبعدی یا سه‌بعدی\n"
               "• 💸 جریان پول: خرید و فروش تهاجمی هر ارز و بخش، استیبل‌کوین‌ها، دامیننس و اهرم\n"
               "• 💧 نقدینگی: نقشهٔ حرارتی زندهٔ دفتر سفارش، عمق بازار و لیکوئیدیشن‌ها\n"
               "• 🏛 ETF و نهادها: جریان روزانهٔ ETFهای بیت‌کوین و اتریوم و ذخایر شرکت‌ها\n"
               "روی هر ارز بزنید: نمودار، جریان پول، دفتر سفارش، مشتقات و داده‌های انتخاب، یک‌جا."),
        "ckb": ("هەموو بازاڕ بە یەک نیگا، زیندوو و لە ٩ تایمفرەیمدا (٥ خولەک تا ساڵێک):\n"
                "• 🟩 نەخشەی گەرمی: ٢٥٠ دراوی گەورە لە بەشەکانیاندا، دووڕەهەندی یان «شاری سێڕەهەندیی بازاڕ»\n"
                "• 🫧 بڵقەکان: هەر دراوێک بڵقێک بە قەبارەی جووڵەکەی، دووڕەهەندی یان سێڕەهەندی\n"
                "• 💸 ڕەوتی پارە: کڕین و فرۆشتنی هێرشبەرانەی هەر دراو و بەشێک، ستەیبڵکۆینەکان، باڵادەستی و لێڤەرێج\n"
                "• 💧 نەختینەیی: نەخشەی گەرمیی زیندووی دەفتەری داواکاری، قووڵایی بازاڕ و لیکویدەیشنەکان\n"
                "• 🏛 ETF و دامەزراوەکان: ڕەوتی ڕۆژانەی ETFەکانی بیتکۆین و ئیتریۆم و یەدەگی کۆمپانیاکان\n"
                "لەسەر هەر دراوێک دابگرە: چارت، ڕەوتی پارە، دەفتەری داواکاری، دیریڤەیتیڤ و داتاکانی ئینتیخاب پێکەوە."),
        "kmr": ("Hemû bazar bi nêrînekê, zindî û di 9 deman de (5 deqe heta salekê):\n"
                "• 🟩 Nexşeya germiyê: 250 coinên mezin di beşên xwe de, 2D an «bajarê bazarê» yê 3D\n"
                "• 🫧 Bilbil: her coin bilbilek bi qasî tevgera xwe, 2D an 3D\n"
                "• 💸 Herikîna pereyan: kirîn û firotina êrîşkar a her coin û beşê, stablecoin, serdestî û leverage\n"
                "• 💧 Likîdîte: nexşeya germiyê ya zindî ya pirtûka fermanan, kûrahiya bazarê û tasfiye\n"
                "• 🏛 ETF û sazî: herikîna rojane ya ETFyên Bitcoin û Ether û rezervên şirketan\n"
                "Li ser her coinê bitikîne: grafîk, herikîn, pirtûka fermanan, derivatîv û daneyên Entekhab bi hev re."),
        "ar": ("السوق كلّه بنظرة واحدة، مباشرةً وعلى ٩ أطر زمنية (من ٥ دقائق حتى سنة):\n"
               "• 🟩 الخريطة الحرارية: أكبر ٢٥٠ عملة في قطاعاتها، ثنائية الأبعاد أو «مدينة السوق» ثلاثية الأبعاد\n"
               "• 🫧 الفقاعات: كل عملة فقاعة بحجم حركتها، ثنائية أو ثلاثية الأبعاد\n"
               "• 💸 تدفق الأموال: الشراء والبيع الهجومي لكل عملة وقطاع، العملات المستقرة، الهيمنة والرافعة\n"
               "• 💧 السيولة: خريطة حرارية حيّة لدفتر الأوامر، عمق السوق والتصفيات\n"
               "• 🏛 الصناديق والمؤسسات: التدفقات اليومية لصناديق ETF لبيتكوين وإيثريوم واحتياطيات الشركات\n"
               "اضغط على أي عملة: الرسم والتدفق ودفتر الأوامر والمشتقات وبيانات انتخاب في مكان واحد."),
        "en": ("The whole market at a glance, live, on nine timeframes (5 minutes to a year):\n"
               "• 🟩 Heatmap: the 250 largest coins in their sectors, flat or as a 3D “market city”\n"
               "• 🫧 Bubbles: every coin a bubble as big as its move, 2D or 3D\n"
               "• 💸 Money flow: aggressive buying and selling per coin and sector, stablecoins, dominance, leverage\n"
               "• 💧 Liquidity: a live order-book heatmap, market depth and liquidations\n"
               "• 🏛 ETFs & institutions: daily Bitcoin and Ether ETF flows, company treasuries\n"
               "Tap any coin: chart, money flow, order book, derivatives and Entekhab's own data in one place."),
    },
    "live": {"fa": "📊 <b>۲۴ ساعت گذشته · ۱۰۰ ارز برتر</b>", "ckb": "📊 <b>٢٤ کاتژمێری ڕابردوو · ١٠٠ دراوی سەرەوە</b>",
             "kmr": "📊 <b>24 saetên dawî · 100 coinên pêşîn</b>", "ar": "📊 <b>آخر ٢٤ ساعة · أكبر ١٠٠ عملة</b>",
             "en": "📊 <b>Last 24 h · top 100</b>"},
    "breadth": {"fa": "🟢 {up} صعودی · 🔴 {dn} نزولی", "ckb": "🟢 {up} بەرزبوو · 🔴 {dn} دابەزیو", "kmr": "🟢 {up} bilind bûn · 🔴 {dn} daketin",
                "ar": "🟢 {up} صاعدة · 🔴 {dn} هابطة", "en": "🟢 {up} up · 🔴 {dn} down"},
    "buy": {"fa": "💸 بیشترین خرید خالص (بایننس): <b>{s}</b> {v}", "ckb": "💸 زۆرترین کڕینی خاوێن (بایننس): <b>{s}</b> {v}",
            "kmr": "💸 Herî zêde kirîna net (Binance): <b>{s}</b> {v}", "ar": "💸 أكبر صافي شراء (Binance): <b>{s}</b> {v}",
            "en": "💸 Most net buying (Binance): <b>{s}</b> {v}"},
    "sell": {"fa": "🔻 بیشترین فروش خالص: <b>{s}</b> {v}", "ckb": "🔻 زۆرترین فرۆشتنی خاوێن: <b>{s}</b> {v}",
             "kmr": "🔻 Herî zêde firotina net: <b>{s}</b> {v}", "ar": "🔻 أكبر صافي بيع: <b>{s}</b> {v}",
             "en": "🔻 Most net selling: <b>{s}</b> {v}"},
    "stable": {"fa": "💵 استیبل‌کوین‌ها: {t} (۷ روز: {d})", "ckb": "💵 ستەیبڵکۆینەکان: {t} (٧ ڕۆژ: {d})", "kmr": "💵 Stablecoin: {t} (7 roj: {d})",
               "ar": "💵 العملات المستقرة: {t} (٧ أيام: {d})", "en": "💵 Stablecoins: {t} (7 days: {d})"},
    "etf": {"fa": "🏛 ETFها ({d}): بیت‌کوین {b} · اتریوم {e}", "ckb": "🏛 ETFەکان ({d}): بیتکۆین {b} · ئیتریۆم {e}",
            "kmr": "🏛 ETF ({d}): Bitcoin {b} · Ether {e}", "ar": "🏛 صناديق ETF ({d}): بيتكوين {b} · إيثريوم {e}",
            "en": "🏛 ETFs ({d}): Bitcoin {b} · Ether {e}"},
    "age": {"fa": "🕒 به‌روزرسانی {m} دقیقه پیش", "ckb": "🕒 نوێکرایەوە {m} خولەک لەمەوبەر", "kmr": "🕒 {m} deqe berê hate nûkirin",
            "ar": "🕒 حُدّث قبل {m} دقيقة", "en": "🕒 updated {m} min ago"},
    "nfa": {"fa": "این‌ها عدد بازارند، نه توصیهٔ مالی.", "ckb": "ئەمانە ژمارەی بازاڕن، نەک ئامۆژگاریی دارایی.",
            "kmr": "Ev hejmarên bazarê ne, ne şîreta darayî ne.", "ar": "هذه أرقام السوق، وليست نصيحة مالية.",
            "en": "These are market figures, not financial advice."},
    "b_heat": {"fa": "🟩 نقشهٔ حرارتی", "ckb": "🟩 نەخشەی گەرمی", "kmr": "🟩 Nexşeya germiyê", "ar": "🟩 الخريطة الحرارية", "en": "🟩 Heatmap"},
    "b_bub": {"fa": "🫧 حباب‌ها", "ckb": "🫧 بڵقەکان", "kmr": "🫧 Bilbil", "ar": "🫧 الفقاعات", "en": "🫧 Bubbles"},
    "b_flow": {"fa": "💸 جریان پول", "ckb": "💸 ڕەوتی پارە", "kmr": "💸 Herikîna pereyan", "ar": "💸 تدفق الأموال", "en": "💸 Money flow"},
    "b_liq": {"fa": "💧 نقدینگی", "ckb": "💧 نەختینەیی", "kmr": "💧 Likîdîte", "ar": "💧 السيولة", "en": "💧 Liquidity"},
    "b_etf": {"fa": "🏛 ETF و نهادها", "ckb": "🏛 ETF و دامەزراوەکان", "kmr": "🏛 ETF û sazî", "ar": "🏛 الصناديق والمؤسسات", "en": "🏛 ETFs & institutions"},
    "b_web": {"fa": "🌐 باز کردن در مرورگر", "ckb": "🌐 کردنەوە لە وێبگەڕ", "kmr": "🌐 Di gerokê de veke", "ar": "🌐 افتح في المتصفح",
              "en": "🌐 Open in the browser"},
}

# the site's sectors (assets/mm/i18n.js sec_*), plus Kurmanji
SEC = {
    "btc": {"fa": "بیت‌کوین", "ckb": "بیتکۆین", "kmr": "Bitcoin", "ar": "بيتكوين", "en": "Bitcoin"},
    "l1": {"fa": "پلتفرم‌های قرارداد هوشمند", "ckb": "پلاتفۆرمەکانی گرێبەستی زیرەک", "kmr": "Platformên peymanên jîr", "ar": "منصات العقود الذكية",
           "en": "Smart-contract platforms"},
    "defi": {"fa": "دیفای", "ckb": "دیفای", "kmr": "DeFi", "ar": "التمويل اللامركزي", "en": "DeFi"},
    "l2": {"fa": "لایهٔ دوم", "ckb": "چینی دووەم", "kmr": "Qata duyem", "ar": "الطبقة الثانية", "en": "Layer 2"},
    "ai": {"fa": "هوش مصنوعی", "ckb": "زیرەکیی دەستکرد", "kmr": "Zekaya çêkirî", "ar": "الذكاء الاصطناعي", "en": "AI"},
    "meme": {"fa": "میم‌کوین‌ها", "ckb": "میمکۆینەکان", "kmr": "Meme", "ar": "عملات الميم", "en": "Memes"},
    "rwa": {"fa": "دارایی‌های دنیای واقعی", "ckb": "سامانی جیهانی ڕاستەقینە", "kmr": "Hebûnên cîhana rast", "ar": "الأصول الحقيقية",
            "en": "Real-world assets"},
    "exch": {"fa": "توکن صرافی‌ها", "ckb": "تۆکنی ئاڵوگۆڕگەکان", "kmr": "Tokenên borsayan", "ar": "رموز المنصات", "en": "Exchange tokens"},
    "privacy": {"fa": "حریم خصوصی", "ckb": "تایبەتمەندی", "kmr": "Taybetî", "ar": "الخصوصية", "en": "Privacy"},
    "game": {"fa": "گیمینگ", "ckb": "یاری", "kmr": "Lîstik", "ar": "الألعاب", "en": "Gaming"},
    "infra": {"fa": "زیرساخت و DePIN", "ckb": "ژێرخان و DePIN", "kmr": "Binesazî û DePIN", "ar": "البنية التحتية وDePIN", "en": "Infrastructure & DePIN"},
    "other": {"fa": "سایر", "ckb": "ئەوانی تر", "kmr": "Yên din", "ar": "أخرى", "en": "Other"},
}


def L(key, lang, **kw):
    s = pick(TXT[key], lang)
    return s.format(**kw) if kw else s


def loc(n, lang):
    """a count in the reader's digits (Persian, Sorani and Arabic prose never shows Latin digits)"""
    m = DIG.get(lang)
    s = str(n)
    return "".join(m[int(c)] if c.isdigit() else c for c in s) if m else s


def usd(v, sign=True):
    """+$12.3M / −$4.56B / $290B — dollars, as the site writes them (Latin digits, like every price in the bot)"""
    if v is None:
        return "—"
    a = abs(float(v))
    for d, u in ((1e12, "T"), (1e9, "B"), (1e6, "M"), (1e3, "K")):
        if a >= d:
            x = a / d
            body = f"${x:.2f}{u}" if x < 10 else f"${x:.1f}{u}" if x < 100 else f"${x:.0f}{u}"
            break
    else:
        body = f"${a:.0f}"
    return ("+" if v > 0 else "−" if v < 0 else "") + body if sign else body


def ltr(s, lang):
    """a signed figure inside Persian, Sorani or Arabic text: kept left-to-right, or the minus/plus sign jumps to the other
    side of the number (Unicode bidi): −$67.5M would read $67.5M− """
    return "\u202a" + s + "\u202c" if lang in ("fa", "ckb", "ar") else s


def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and x == x


def summary(lang, load):
    """the live lines; each needs its own file and is skipped (never guessed) when that file is missing or odd"""
    out = []
    obj = lambda x: x if isinstance(x, dict) else {}       # noqa: E731
    mm = obj(load("mm"))
    tfs = mm.get("tf") if isinstance(mm.get("tf"), list) else []
    i = tfs.index("1d") if "1d" in tfs else 5
    coins = [c for c in (mm.get("c") if isinstance(mm.get("c"), list) else []) if isinstance(c, dict) and isinstance(c.get("s"), str)
             and c.get("sec") not in ("stable", "wrapped")][:TOP]

    def ch(c):
        v = c.get("ch") if isinstance(c.get("ch"), list) else []
        return v[i] if len(v) > i and _num(v[i]) else None

    have = [c for c in coins if ch(c) is not None]
    if len(have) >= 10:
        out.append(L("breadth", lang, up=loc(sum(1 for c in have if ch(c) > 0), lang), dn=loc(sum(1 for c in have if ch(c) < 0), lang)))
        up = [c for c in sorted(have, key=ch, reverse=True) if ch(c) > 0][:3]
        dn = [c for c in sorted(have, key=ch) if ch(c) < 0][:3]
        if up:
            out.append("🚀 " + " · ".join(ltr(f"{html.escape(c['s'])} {ch(c):+.1f}%", lang) for c in up))
        if dn:
            out.append("📉 " + " · ".join(ltr(f"{html.escape(c['s'])} {ch(c):+.1f}%", lang) for c in dn))
    fl = obj(load("mm_flow"))
    f = obj(fl.get("f"))
    by = {}
    for c in coins:
        x = obj(f.get(c["s"])).get("1d")
        if isinstance(x, list) and len(x) == 2 and _num(x[0]):
            by[c["sec"]] = by.get(c["sec"], 0.0) + x[0]
    if by:
        best = max(by.items(), key=lambda kv: kv[1])
        worst = min(by.items(), key=lambda kv: kv[1])
        if best[1] > 0:
            out.append(L("buy", lang, s=pick(SEC.get(best[0], SEC["other"]), lang), v=ltr(usd(best[1]), lang)))
        if worst[1] < 0:
            out.append(L("sell", lang, s=pick(SEC.get(worst[0], SEC["other"]), lang), v=ltr(usd(worst[1]), lang)))
    st = obj(fl.get("st"))
    if _num(st.get("tot")) and st["tot"] > 0:
        out.append(L("stable", lang, t=ltr(usd(st["tot"], sign=False), lang), d=ltr(usd(st["d7"]), lang) if _num(st.get("d7")) else "—"))
    etf = obj(load("etf"))
    b, e = obj(obj(etf.get("btc")).get("last")), obj(obj(etf.get("eth")).get("last"))
    if _num(b.get("t")) and b.get("d"):
        m = lambda x: ltr(usd(x * 1e6), lang) if _num(x) else "—"      # noqa: E731  (Farside reports US$ millions)
        out.append(L("etf", lang, d=ltr(html.escape(str(b["d"])), lang), b=m(b["t"]), e=m(e.get("t")) if e.get("d") == b["d"] else "—"))
    if not out:
        return ""
    try:
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(str(mm.get("t")).replace("Z", "+00:00"))).total_seconds() / 60
        tail = [L("age", lang, m=loc(max(0, int(age)), lang))] if age < 7 * 24 * 60 else []
    except (TypeError, ValueError):
        tail = []
    return "\n".join([L("live", lang)] + out + tail)


def section(lang, load=None):
    """text of the section; `load` is bot_data.load (injected so the self-test runs without the data folder)"""
    parts = [L("title", lang), L("body", lang)]
    if load:
        try:
            s = summary(lang, load)
            if s:
                parts.append(s)
        except Exception:      # a missing or broken data file never breaks the section
            pass
    parts.append("<i>" + L("nfa", lang) + "</i>")
    return "\n\n".join(parts)


def open_rows(lang):
    """the five pages inside Telegram (Web App), and the heatmap in the browser; put above the standard navigation"""
    def w(k, path):
        return {"text": L("b_" + k, lang), "web_app": {"url": SITE + path}}
    return [[w("heat", "/heatmap/"), w("bub", "/bubbles/")], [w("flow", "/money-flow/"), w("liq", "/liquidity/")], [w("etf", "/etf/")],
            [{"text": L("b_web", lang), "url": URL}]]


if __name__ == "__main__":
    bad = 0
    now = datetime.now(timezone.utc)
    tf = ["5m", "15m", "1h", "2h", "4h", "1d", "7d", "30d", "1y"]

    def coin(s, sec, d1):
        return {"s": s, "sec": sec, "ch": [0, 0, 0, 0, 0, d1, 0, 0, 0]}
    COINS = [coin("BTC", "btc", 2.1), coin("USDT", "stable", 0.0), coin("WBTC", "wrapped", 9.0), coin("ETH", "l1", -1.4), coin("SOL", "l1", 5.25),
             coin("DOGE", "meme", -7.5), coin("PEPE", "meme", -3.0), coin("FET", "ai", 11.0), coin("UNI", "defi", 0.4), coin("ARB", "l2", -0.2),
             coin("LINK", "infra", 1.0), coin("ONDO", "rwa", 0.0), coin("<i>", "other", 20.0)]
    DATA = {"mm": {"t": (now.replace(microsecond=0)).isoformat(), "tf": tf, "c": COINS},
            "mm_flow": {"f": {"SOL": {"1d": [12_300_000, 1e9]}, "ETH": {"1d": [-2_000_000, 1e9]}, "DOGE": {"1d": [-45_600_000, 5e8]},
                              "PEPE": {"1d": [-1_000_000, 1e8]}, "FET": {"1d": [3_000_000, 1e8]}, "WBTC": {"1d": [9e9, 1e10]}},
                        "st": {"tot": 289_503_379_559, "d7": -2_070_780_778}},
            "etf": {"btc": {"last": {"d": "2026-11-11", "t": 163.7}}, "eth": {"last": {"d": "2026-11-11", "t": -12.0}}}}
    for lang in ("fa", "ckb", "kmr", "ar", "en"):
        txt = section(lang, load=lambda n: DATA.get(n))
        if lang in ("fa", "ckb", "ar") and ("\u202a−$46.6M\u202c" not in txt or "\u202aDOGE -7.5%\u202c" not in txt):
            print("FAIL", lang, "signed figures not kept left-to-right")
            bad += 1
        txt = txt.replace("\u202a", "").replace("\u202c", "")
        want = ["&lt;i&gt; +20.0%", "FET +11.0%", "SOL +5.2%", "DOGE -7.5%", "+$10.3M", "−$46.6M", "$290B", "−$2.07B", "+$164M", "−$12.0M", "2026-11-11"]
        for w in want:
            if w not in txt:
                print("FAIL", lang, "missing", w)
                bad += 1
        if "WBTC" in txt or "USDT" in txt or "<i> +20" in txt:
            print("FAIL", lang, "wrapped/stable coin shown or symbol not escaped")
            bad += 1
        if len(txt) > 4096 or "None" in txt:
            print("FAIL", lang, "size or None", len(txt))
            bad += 1
        br = next((ln for ln in txt.split("\n") if ln.startswith("🟢")), "")
        if not br or (lang in ("fa", "ckb", "ar") and any(d in br for d in "0123456789")):
            print("FAIL", lang, "breadth line missing or in Latin digits", br)
            bad += 1
        rows = open_rows(lang)
        urls = [b.get("web_app", {}).get("url") or b.get("url") for r in rows for b in r]
        if urls != [SITE + p for p in ("/heatmap/", "/bubbles/", "/money-flow/", "/liquidity/", "/etf/", "/heatmap/")]:
            print("FAIL", lang, "buttons", urls)
            bad += 1
        if any(len(b["text"]) > 40 for r in rows for b in r):
            print("FAIL", lang, "button text too long")
            bad += 1
        bare = section(lang, load=lambda n: None)
        if L("title", lang) not in bare or "📊" in bare:
            print("FAIL", lang, "no data must mean no live lines")
            bad += 1
        broken = section(lang, load=lambda n: {"c": "x", "f": [1], "st": {"tot": "?"}, "btc": []})
        if "📊" in broken or L("title", lang) not in broken:
            print("FAIL", lang, "odd files must not break or invent lines")
            bad += 1
    # the 24-hour column is found by name, not assumed
    DATA["mm"]["tf"] = ["1d"] + tf[:5] + tf[6:]
    for c in COINS:
        c["ch"] = [c["ch"][5]] + c["ch"][:5] + c["ch"][6:]
    if "SOL +5.2%" not in section("en", load=lambda n: DATA.get(n)):
        print("FAIL timeframe lookup by name")
        bad += 1
    if usd(0) != "$0" or usd(-1234) != "−$1.23K" or usd(2.5e12, sign=False) != "$2.50T" or usd(None) != "—":
        print("FAIL usd", usd(0), usd(-1234), usd(2.5e12, sign=False))
        bad += 1
    if loc(61, "fa") != "۶۱" or loc(39, "ckb") != "٣٩" or loc(7, "en") != "7":
        print("FAIL loc")
        bad += 1
    print(f"bot_mm self-test: {bad} failures")
    raise SystemExit(1 if bad else 0)
