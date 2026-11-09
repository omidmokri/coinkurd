"""One plain-language sentence for every scanner finding — "why this coin?" — in fa / ckb / en.

Built only from fields the scanner itself recorded (market.py): the pattern and its measurement, plus whether
the 4h / daily trends agree. Where the Signal Truth Lab (data/truth.json) has judged the pattern, its verdict
is added, negative or not. Levels, strength and confidence stay in their own columns.
Used by market.py (site + app) and the Telegram bot.
"""
LANGS = ("fa", "ckb", "en")
DIG = {"fa": str.maketrans("0123456789.,-", "۰۱۲۳۴۵۶۷۸۹٫٬−"), "ckb": str.maketrans("0123456789.,-", "٠١٢٣٤٥٦٧٨٩٫٬−"), "en": None}


def _n(x, lg, d=1):
    s = f"{x:.{d}f}"
    return s.translate(DIG[lg]) if DIG[lg] else s


def _p(x, lg, d=1):
    s = f"{abs(x):.{d}f}"
    s = s.translate(DIG[lg]) if DIG[lg] else s
    return s + ("٪" if lg != "en" else "%")


PAT = {
    "rsi_oversold": ("RSI ساعتی به {rsi} رسیده (زیر ۳۰)؛ فروش بیش از حد شده و احتمال یک برگشت کوتاه هست",
                     "RSIی کاتژمێری گەیشتووەتە {rsi} (خوار ٣٠)؛ فرۆشتن زۆر بووە و ئەگەری گەڕانەوەیەکی کورت هەیە",
                     "Hourly RSI has dropped to {rsi} (below 30): selling looks overdone and a short bounce is possible"),
    "rsi_overbought": ("RSI ساعتی {rsi} است (بالای ۷۰)؛ خرید داغ شده و احتمال یک اصلاح کوتاه هست",
                       "RSIی کاتژمێری {rsi}ە (سەرووی ٧٠)؛ کڕین گەرم بووە و ئەگەری ڕاستکردنەوەیەکی کورت هەیە",
                       "Hourly RSI is {rsi} (above 70): buying looks stretched and a short pullback is possible"),
    "bull_divergence": ("قیمت کف پایین‌تری زد ولی RSI کف بالاتری ساخت ({rsi})؛ فشار فروش در حال ضعیف شدن است",
                        "نرخ بنێکی نزمتری دا بەڵام RSI بنێکی بەرزتری دروست کرد ({rsi})؛ فشاری فرۆشتن لاواز دەبێت",
                        "Price made a lower low but RSI made a higher one ({rsi}): selling pressure is fading"),
    "bear_divergence": ("قیمت سقف بالاتری زد ولی RSI سقف پایین‌تری ساخت ({rsi})؛ قدرت خریداران در حال ضعیف شدن است",
                        "نرخ لوتکەیەکی بەرزتری دا بەڵام RSI لوتکەیەکی نزمتری دروست کرد ({rsi})؛ هێزی کڕیاران لاواز دەبێت",
                        "Price made a higher high but RSI made a lower one ({rsi}): buying power is fading"),
    "ema_golden_cross": ("میانگین ۲۰ ساعته از میانگین ۵۰ ساعته بالاتر رفت؛ روند کوتاه‌مدت رو به بالا چرخیده",
                         "ناوەندی ٢٠ کاتژمێری چووە سەرووی ناوەندی ٥٠ کاتژمێری؛ ڕەوتی کورتخایەن بەرەو سەرەوە سوڕاوە",
                         "The 20-hour average crossed above the 50-hour one: the short-term trend has turned up"),
    "ema_death_cross": ("میانگین ۲۰ ساعته زیر میانگین ۵۰ ساعته رفت؛ روند کوتاه‌مدت رو به پایین چرخیده",
                        "ناوەندی ٢٠ کاتژمێری چووە خوار ناوەندی ٥٠ کاتژمێری؛ ڕەوتی کورتخایەن بەرەو خوارەوە سوڕاوە",
                        "The 20-hour average crossed below the 50-hour one: the short-term trend has turned down"),
    "breakout_up": ("قیمت بالای سقف ۴۸ ساعت اخیر ({level}) بسته شد",
                    "نرخ لە سەرووی لوتکەی ٤٨ کاتژمێری ڕابردوو ({level}) داخرا",
                    "Price closed above its 48-hour high ({level})"),
    "breakdown": ("قیمت زیر کف ۴۸ ساعت اخیر ({level}) بسته شد",
                  "نرخ لە خوار بنی ٤٨ کاتژمێری ڕابردوو ({level}) داخرا",
                  "Price closed below its 48-hour low ({level})"),
    "volume_spike": ("حجم این ساعت {x} برابر میانگین ۲۰ ساعت قبل است؛ کسی با حجم بالا وارد شده",
                     "قەبارەی ئەم کاتژمێرە {x} هێندەی ناوەندی ٢٠ کاتژمێری پێشووە",
                     "This hour's volume is {x}× the previous 20-hour average: someone moved size"),
}
MTF = {2: ("روند ۴ ساعته و روزانه هم با آن هم‌جهت است", "ڕەوتی ٤ کاتژمێری و ڕۆژانەش هاوئاڕاستەن", "the 4h and daily trends agree"),
       -2: ("اما روند ۴ ساعته و روزانه خلاف آن است", "بەڵام ڕەوتی ٤ کاتژمێری و ڕۆژانە پێچەوانەن", "but the 4h and daily trends point the other way")}
VERD = {"edge_strong": ("در آزمایشگاه حقیقت پس از هزینه لبهٔ معنادار داشته", "لە تاقیگەی ڕاستی دوای تێچوو لێواری واتاداری هەبووە", "the Truth Lab finds a significant edge after costs"),
        "edge": ("در آزمایشگاه حقیقت پس از هزینه لبهٔ احتمالی داشته", "لە تاقیگەی ڕاستی دوای تێچوو لێواری ئەگەری هەبووە", "the Truth Lab finds a probable edge after costs"),
        "maybe": ("در آزمایشگاه حقیقت مثبت ولی غیرمعنادار بوده", "لە تاقیگەی ڕاستی ئەرێنی بەڵام بێ‌واتا بووە", "the Truth Lab finds it positive but not significant"),
        "no_edge": ("در آزمایشگاه حقیقت پس از هزینه لبه‌ای نداشته", "لە تاقیگەی ڕاستی دوای تێچوو لێواری نەبووە", "the Truth Lab finds no edge after costs"),
        "loses": ("⚠️ در آزمایشگاه حقیقت پس از هزینه زیان‌ده بوده", "⚠️ لە تاقیگەی ڕاستی دوای تێچوو زیانبەخش بووە", "⚠️ the Truth Lab finds it loses money after costs")}


def _price(x):
    if x is None:
        return None
    return f"{x:,.6f}".rstrip("0").rstrip(".") if x < 1 else f"{x:,.{0 if x >= 1000 else 2}f}"


def why(o, verdicts=None):
    """-> {"fa": str, "ckb": str, "en": str}"""
    tpl = PAT.get(o.get("type"))
    if not tpl:
        return None
    d = o.get("detail") or {}
    out = {}
    for i, lg in enumerate(LANGS):
        loc = lambda s: s.translate(DIG[lg]) if DIG[lg] else s  # noqa: E731
        vals = {"rsi": _n(d.get("rsi", 0), lg), "x": _n(d.get("x", 0), lg), "level": loc(_price(d.get("level")) or "—")}
        head = tpl[i].format(**vals)
        extra = []
        mt = o.get("mtf_align")
        if mt in MTF:
            extra.append(MTF[mt][i])
        v = (verdicts or {}).get(o.get("type"))
        if v in VERD:
            extra.append(VERD[v][i])
        sep = "؛ " if lg != "en" else "; "
        s = head + (sep + sep.join(extra) if extra else "")
        out[lg] = s + "."
    return out


def verdicts():
    """{pattern: verdict} from the Signal Truth Lab, if it has run"""
    try:
        import reality_common as R
        pats = ((R.load("truth.json", {}).get("scanner") or {}).get("patterns")) or {}
        return {k: v.get("verdict") for k, v in pats.items() if k != "_all"}
    except Exception:  # noqa: BLE001
        return {}
