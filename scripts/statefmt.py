#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Readable cards for the indicators' live outputs.

A TradingView alert reaches us as one machine line, e.g.

    #ESTATE kmix|BINANCE:BTCUSDT|60|73216.01|2026-11-10T16:00:00Z|dir=short|decision=Weak|score=52|...

Nobody should have to read that. estate_card() turns such a state into a human card in Persian,
Sorani or English — every field named, every value translated, plus one sentence saying what it means.
Used by the bot (indicator section) and by the relay worker that rewrites the raw channel posts.
"""
from datetime import datetime, timezone

# ---------------------------------------------------------------- field names
LAB = {
    "dir": ("جهت", "ئاراستە", "Direction"),
    "decision": ("تصمیم", "بڕیار", "Decision"),
    "score": ("امتیاز", "خاڵ", "Score"),
    "conf": ("اطمینان", "دڵنیایی", "Confidence"),
    "prob": ("احتمال موفقیت", "ئەگەری سەرکەوتن", "Probability"),
    "trend": ("روند", "ڕەوت", "Trend"),
    "regime": ("رژیم بازار", "دۆخی بازاڕ", "Market regime"),
    "phase": ("فاز بازار", "قۆناغی بازاڕ", "Phase"),
    "risk": ("ریسک", "مەترسی", "Risk"),
    "bull": ("قدرت خریداران", "هێزی کڕیاران", "Bull power"),
    "bear": ("قدرت فروشندگان", "هێزی فرۆشیاران", "Bear power"),
    "rsi": ("آر‌اس‌آی", "RSI", "RSI"),
    "entry": ("نقطهٔ ورود", "خاڵی چوونەژوورەوە", "Entry"),
    "sl": ("حد ضرر", "وەستاندنی زیان", "Stop loss"),
    "stop": ("حد ضرر", "وەستاندنی زیان", "Stop loss"),
    "tp1": ("هدف اول", "ئامانجی یەکەم", "Target 1"),
    "tp2": ("هدف دوم", "ئامانجی دووەم", "Target 2"),
    "tp3": ("هدف سوم", "ئامانجی سێیەم", "Target 3"),
    "zone": ("ناحیهٔ قیمتی", "ناوچەی نرخ", "Zone"),
    "quality": ("کیفیت سیگنال", "کوالیتی", "Quality"),
    "valuation": ("ارزش‌گذاری", "نرخاندن", "Valuation"),
    "cycle": ("جایگاه در چرخه", "شوێن لە سووڕدا", "Cycle position"),
    "hurst": ("شاخص هرست", "پێوەری هێرست", "Hurst"),
    "cmo": ("مومنتوم", "مۆمێنتۆم", "Momentum"),
    "s2f": ("مدل S2F", "مۆدێلی S2F", "S2F model"),
    "line": ("خط مدل", "هێڵی مۆدێل", "Model line"),
    "buy": ("فشار خرید", "پەستانی کڕین", "Buy pressure"),
    "sell": ("فشار فروش", "پەستانی فرۆشتن", "Sell pressure"),
    "note": ("یادداشت", "تێبینی", "Note"),
}
ICON = {"dir": "🧭", "decision": "⚖️", "score": "📈", "conf": "🎯", "prob": "🎲", "trend": "📉", "regime": "🌀",
        "phase": "🔄", "risk": "⚠️", "bull": "🐂", "bear": "🐻", "rsi": "📊", "entry": "📍", "sl": "🛑",
        "stop": "🛑", "tp1": "🥇", "tp2": "🥈", "tp3": "🥉", "zone": "🏷", "quality": "💎", "valuation": "💰",
        "cycle": "🔁", "hurst": "🧮", "cmo": "⚡️", "s2f": "🪙", "line": "📐", "buy": "🟢", "sell": "🔴", "note": "📝"}

# ---------------------------------------------------------------- field values
VAL = {
    "long": ("صعودی (خرید)", "بەرزبوونەوە (کڕین)", "Long"),
    "short": ("نزولی (فروش)", "دابەزین (فرۆشتن)", "Short"),
    "buy": ("خرید", "کڕین", "Buy"),
    "sell": ("فروش", "فرۆشتن", "Sell"),
    "flat": ("بدون پوزیشن", "بێ پۆزیشن", "Flat"),
    "neutral": ("خنثی", "بێلایەن", "Neutral"),
    "wait": ("صبر کن", "چاوەڕێ بکە", "Wait"),
    "weak": ("ضعیف", "لاواز", "Weak"),
    "strong": ("قوی", "بەهێز", "Strong"),
    "moderate": ("متوسط", "مامناوەند", "Moderate"),
    "medium": ("متوسط", "مامناوەند", "Medium"),
    "low": ("کم", "کەم", "Low"),
    "high": ("زیاد", "زۆر", "High"),
    "extreme": ("خیلی زیاد", "زۆر زۆر", "Extreme"),
    "accumulate": ("خرید پله‌ای", "کڕینی پلەیی", "Accumulate"),
    "accumulation": ("انباشت (جمع‌آوری آرام)", "کۆکردنەوە", "Accumulation"),
    "distribution": ("توزیع (فروش آرام)", "دابەشکردن", "Distribution"),
    "transition": ("گذار (بازار در حال تغییر)", "گواستنەوە", "Transition"),
    "compression": ("فشردگی (آرامش پیش از حرکت)", "پەستانەوە", "Compression"),
    "expansion": ("گسترش (حرکت بزرگ)", "فراوانبوون", "Expansion"),
    "recovery": ("بازیابی", "چاکبوونەوە", "Recovery"),
    "markup": ("رشد", "بەرزبوونەوە", "Markup"),
    "markdown": ("ریزش", "دابەزین", "Markdown"),
    "trending_bull": ("روند صعودی", "ڕەوتی بەرزبوونەوە", "Trending bull"),
    "trending_bear": ("روند نزولی", "ڕەوتی دابەزین", "Trending bear"),
    "weak_trend": ("روند ضعیف", "ڕەوتی لاواز", "Weak trend"),
    "strong_trend": ("روند قوی", "ڕەوتی بەهێز", "Strong trend"),
    "no_trend": ("بدون روند", "بێ ڕەوت", "No trend"),
    "ranging": ("نوسان در محدوده", "جووڵە لە ناوچەدا", "Ranging"),
    "bullish": ("صعودی", "بەرزبوونەوە", "Bullish"),
    "bearish": ("نزولی", "دابەزین", "Bearish"),
    "long_setup": ("آمادهٔ خرید", "ئامادەی کڕین", "Long setup"),
    "short_setup": ("آمادهٔ فروش", "ئامادەی فرۆشتن", "Short setup"),
    "bullish_setup": ("آمادهٔ صعود", "ئامادەی بەرزبوونەوە", "Bullish setup"),
    "bearish_setup": ("آمادهٔ ریزش", "ئامادەی دابەزین", "Bearish setup"),
    "cheap": ("ارزان", "هەرزان", "Cheap"),
    "expensive": ("گران", "گران", "Expensive"),
    "fair": ("منصفانه", "گونجاو", "Fair"),
    "buy_zone": ("ناحیهٔ خرید", "ناوچەی کڕین", "Buy zone"),
    "sell_zone": ("ناحیهٔ فروش", "ناوچەی فرۆشتن", "Sell zone"),
    "bearish_alignment": ("هم‌راستایی نزولی (همهٔ نشانه‌ها نزولی)", "هاوئاراستەیی دابەزین", "Bearish alignment"),
    "bullish_alignment": ("هم‌راستایی صعودی (همهٔ نشانه‌ها صعودی)", "هاوئاراستەیی بەرزبوونەوە", "Bullish alignment"),
    "heavy_bid": ("تقاضای سنگین خرید", "داواکاریی قورسی کڕین", "Heavy bid"),
    "heavy_ask": ("عرضهٔ سنگین فروش", "پێشکەشی قورسی فرۆشتن", "Heavy ask"),
    "dca": ("ناحیهٔ خرید پله‌ای", "ناوچەی کڕینی پلەیی", "DCA zone"),
    "range": ("محدودهٔ نوسان", "ناوچەی جووڵە", "Range"),
    "trend": ("روند‌دار", "ڕەوتدار", "Trend"),
    "neutral_setup": ("بدون ستاپ مشخص", "بێ ستاپی دیار", "Neutral setup"),
    "accum": ("انباشت (جمع‌آوری آرام)", "کۆکردنەوە", "Accumulation"),
    "distrib": ("توزیع (فروش آرام)", "دابەشکردن", "Distribution"),
    "fire_sale": ("حراج (قیمت خیلی ارزان)", "هەراج (زۆر هەرزان)", "Fire sale"),
    "expensive_zone": ("ناحیهٔ گران", "ناوچەی گران", "Expensive zone"),
    "manipulation": ("دستکاری (حرکت فریبنده)", "دەستکاری (جووڵەی فریودەر)", "Manipulation"),
    "exhaustion": ("خستگی روند (احتمال برگشت)", "ماندووبوونی ڕەوت", "Exhaustion"),
    "capitulation": ("تسلیم (فروش هیجانی)", "خۆبەدەستەوەدان", "Capitulation"),
    "euphoria": ("سرخوشی (هیجان خرید)", "سەرخۆشی", "Euphoria"),
    "bearish_alignment": ("هم‌راستایی نزولی", "هاوئاراستەیی دابەزین", "Bearish alignment"),
    "overbought": ("اشباع خرید", "زۆر کڕدراو", "Overbought"),
    "oversold": ("اشباع فروش", "زۆر فرۆشراو", "Oversold"),
}
COIN = {"BTC": ("بیت‌کوین", "بیتکۆین", "Bitcoin"), "ETH": ("اتریوم", "ئیتریۆم", "Ethereum"),
        "SOL": ("سولانا", "سۆلانا", "Solana"), "XRP": ("ریپل", "ڕیپڵ", "XRP"), "BNB": ("بی‌ان‌بی", "BNB", "BNB"),
        "DOGE": ("دوج‌کوین", "دۆجکۆین", "Dogecoin"), "ADA": ("کاردانو", "کاردانۆ", "Cardano"),
        "TON": ("تون‌کوین", "تۆنکۆین", "Toncoin"), "LINK": ("چین‌لینک", "چەینلینک", "Chainlink")}
TF = {"1m": ("۱ دقیقه", "١ خولەک", "1m"), "3m": ("۳ دقیقه", "٣ خولەک", "3m"), "5m": ("۵ دقیقه", "٥ خولەک", "5m"),
      "15m": ("۱۵ دقیقه", "١٥ خولەک", "15m"), "30m": ("۳۰ دقیقه", "٣٠ خولەک", "30m"),
      "1h": ("۱ ساعته", "١ کاتژمێر", "1h"), "2h": ("۲ ساعته", "٢ کاتژمێر", "2h"), "4h": ("۴ ساعته", "٤ کاتژمێر", "4h"),
      "6h": ("۶ ساعته", "٦ کاتژمێر", "6h"), "12h": ("۱۲ ساعته", "١٢ کاتژمێر", "12h"),
      "1d": ("روزانه", "ڕۆژانە", "Daily"), "1w": ("هفتگی", "هەفتانە", "Weekly"), "1M": ("ماهانه", "مانگانە", "Monthly")}
PCT = {"conf", "prob", "bull", "bear", "quality"}      # shown as a percentage
OF100 = {"score"}                                      # shown as "52 of 100"
I = {"fa": 0, "ckb": 1}


def pick(tup, lang):
    return tup[I.get(lang, 2)]


def norm(v):
    return str(v).strip().lower().replace("-", "_").replace(" ", "_")


def lab(k, lang):
    return pick(LAB[k], lang) if k in LAB else k


def val(k, v, lang):
    if isinstance(v, (int, float)):
        n = f"{v:,.2f}".rstrip("0").rstrip(".")
        if k in OF100 and 0 <= v <= 100:
            return pick((f"{n} از 100", f"{n} لە 100", f"{n}/100"), lang)
        return n + (("٪" if lang != "en" else "%") if k in PCT else "")
    t = VAL.get(norm(v))
    return pick(t, lang) if t else str(v)


def tfname(tf, lang):
    return pick(TF[tf], lang) if tf in TF else str(tf)


def coinname(sym, lang):
    base = str(sym or "").split(":")[-1]
    for q in ("USDT", "USD", "PERP", "USDC"):
        if base.endswith(q) and len(base) > len(q):
            base = base[: -len(q)]
            break
    t = COIN.get(base.upper())
    return f"{pick(t, lang)} ({base})" if t else base


def ago(iso, lang):
    try:
        m = int((datetime.now(timezone.utc) - datetime.fromisoformat(str(iso).replace("Z", "+00:00"))).total_seconds() // 60)
    except Exception:
        return ""
    m = max(m, 0)
    if m < 60:
        return pick((f"{m} دقیقه پیش", f"{m} خولەک لەمەوبەر", f"{m}m ago"), lang)
    if m < 1440:
        return pick((f"{m // 60} ساعت پیش", f"{m // 60} کاتژمێر لەمەوبەر", f"{m // 60}h ago"), lang)
    return pick((f"{m // 1440} روز پیش", f"{m // 1440} ڕۆژ لەمەوبەر", f"{m // 1440}d ago"), lang)


def price(p):
    try:
        p = float(p)
    except (TypeError, ValueError):
        return "—"
    return f"{p:,.2f}" if p >= 100 else f"{p:,.6g}"


# ---------------------------------------------------------------- the sentence
def verdict(f, lang):
    """one sentence: what this state means for someone who just wants the answer"""
    d = norm(f.get("dir") or f.get("side") or "")
    dec = norm(f.get("decision") or "")
    sc, cf = f.get("score"), f.get("conf")
    strong = (isinstance(sc, (int, float)) and sc >= 65) or dec in ("strong", "long", "short", "buy", "sell")
    weak = dec in ("weak", "wait", "neutral") or (isinstance(sc, (int, float)) and sc < 55)
    side = pick(("صعودی", "بەرزبوونەوە", "upward"), lang) if d in ("long", "buy", "up", "bull") else \
        pick(("نزولی", "دابەزین", "downward"), lang) if d in ("short", "sell", "down", "bear") else ""
    if not side:
        return pick(("فعلاً جهت مشخصی اعلام نشده؛ یعنی اندیکاتور منتظر است",
                     "ئێستا ئاراستەیەکی ڕوون ڕانەگەیەنراوە؛ واتە ئیندیکاتۆرەکە چاوەڕێیە",
                     "No clear direction yet — the indicator is waiting"), lang)
    if weak and not strong:
        return pick((f"اندیکاتور جهت {side} را نشان می‌دهد، ولی سیگنالش ضعیف است — یعنی هنوز سیگنال ورود قطعی نیست و بهتر است صبر کنی",
                     f"ئیندیکاتۆرەکە مەیلی بۆ {side} هەیە، بەڵام سیگناڵەکە لاوازە — باشترە چاوەڕێ بکەیت",
                     f"The indicator leans {side}, but the signal is weak — not a confirmed entry, better to wait"), lang)
    if strong:
        return pick((f"اندیکاتور سیگنال {side} نسبتاً قوی می‌دهد؛ باز هم مدیریت ریسک و حد ضرر لازم است",
                     f"ئیندیکاتۆرەکە سیگناڵێکی {side}ی بەهێز دەدات؛ هێشتا بەڕێوەبردنی مەترسی پێویستە",
                     f"The indicator gives a fairly strong {side} signal; still use risk management"), lang)
    return pick((f"جهت فعلی {side} است با قدرت متوسط",
                 f"ئاراستەی ئێستا {side}ە بە هێزی مامناوەند",
                 f"Current direction is {side} with moderate strength"), lang)


# ---------------------------------------------------------------- cards
HEAD = ("📊 <b>تحلیل زندهٔ اندیکاتور</b>", "📊 <b>شیکاریی زیندووی ئیندیکاتۆر</b>", "📊 <b>Live indicator analysis</b>")
MEAN = ("💬 <b>یعنی چه؟</b>", "💬 <b>واتە چی؟</b>", "💬 <b>What it means</b>")
DISC = ("⚠️ این تحلیل خودکار است و سیگنال قطعی خرید و فروش نیست",
        "⚠️ ئەمە شیکاریی خۆکارە و سیگناڵی تەواوی کڕین و فرۆشتن نییە",
        "⚠️ Automated analysis, not financial advice")
ORDER = ["dir", "decision", "score", "conf", "prob", "trend", "regime", "phase", "zone", "risk", "bull", "bear",
         "quality", "valuation", "cycle", "entry", "sl", "stop", "tp1", "tp2", "tp3"]


BAR = {"conf", "prob", "quality", "score"}           # 0..100 values that also get a bar


def bar(v, n=10):
    try:
        v = max(0.0, min(100.0, float(v)))
    except (TypeError, ValueError):
        return ""
    k = int(round(v / 100 * n))
    return "▰" * k + "▱" * (n - k)


def clock(iso, lang):
    """Tehran wall-clock time of the state (stays right in a channel post, unlike 'x minutes ago')"""
    try:
        from datetime import timedelta
        t = datetime.fromisoformat(str(iso).replace("Z", "+00:00")) + timedelta(hours=3, minutes=30)
    except Exception:
        return ""
    return pick((f"{t:%H:%M} تهران", f"{t:%H:%M} تاران", f"{t:%H:%M} Tehran"), lang)


def side_dot(f):
    d = norm(f.get("dir") or f.get("side") or "")
    return "🟢" if d in ("long", "buy", "up", "bull") else "🔴" if d in ("short", "sell", "down", "bear") else "⚪️"


def estate_card(st, lang="fa", name=None, head=True, rel=True):
    """st: {ind|name, tv_sym|sym, tf, price, t, f:{...}} -> html card (rel=False: clock time instead of 'x ago')"""
    f = dict(st.get("f") or {})
    dot = side_dot(f)
    title = name or pick(HEAD, lang)
    out = [f"{dot} <b>{title}</b>"]
    when = ago(st.get("t") or st.get("ts"), lang) if rel else clock(st.get("t") or st.get("ts"), lang)
    out.append(f"🪙 {coinname(st.get('tv_sym') or st.get('sym'), lang)} · ⏱ {tfname(st.get('tf'), lang)} · "
               f"💵 {price(st.get('price'))}" + (f" · 🕒 {when}" if when else ""))
    out.append("━━━━━━━━━━━━━━")
    bull, bear = f.pop("bull", None), f.pop("bear", None)
    keys = [k for k in ORDER if k in f] + [k for k in f if k not in ORDER]
    for k in keys[:14]:
        line = f"{ICON.get(k, '•')} {lab(k, lang)}: <b>{val(k, f[k], lang)}</b>"
        if k in BAR and isinstance(f[k], (int, float)) and 0 <= f[k] <= 100:
            line += f"  {bar(f[k])}"
        out.append(line)
    if isinstance(bull, (int, float)) and isinstance(bear, (int, float)):
        out.append(f"🐂 {lab('bull', lang)} <b>{bull:g}</b>  ⚔️  <b>{bear:g}</b> {lab('bear', lang)} 🐻")
    out += ["━━━━━━━━━━━━━━", f"{pick(MEAN, lang)} {verdict(f | ({'dir': st.get('f', {}).get('dir')}), lang)}", "",
            f"<i>{pick(DISC, lang)}</i>"]
    return "\n".join(out)


ACT = {
    ("long", "entry"): ("🟢 سیگنال خرید (ورود)", "🟢 سیگناڵی کڕین (چوونەژوورەوە)", "🟢 Long entry"),
    ("short", "entry"): ("🔴 سیگنال فروش (ورود)", "🔴 سیگناڵی فرۆشتن (چوونەژوورەوە)", "🔴 Short entry"),
    ("long", "exit"): ("⚪️ خروج از معاملهٔ خرید", "⚪️ دەرچوون لە کڕین", "⚪️ Long exit"),
    ("short", "exit"): ("⚪️ خروج از معاملهٔ فروش", "⚪️ دەرچوون لە فرۆشتن", "⚪️ Short exit"),
    ("long", "partial"): ("🟢 به‌روزرسانی پوزیشن خرید", "🟢 نوێکردنەوەی پۆزیشنی کڕین", "🟢 Long update"),
    ("short", "partial"): ("🔴 به‌روزرسانی پوزیشن فروش", "🔴 نوێکردنەوەی پۆزیشنی فرۆشتن", "🔴 Short update"),
}


def esig_card(sg, lang="fa", name=None):
    """sg: {side, kind, tv_sym|sym, tf, price, sl, tp, ts|t} -> html card for a trade signal"""
    side, kind = norm(sg.get("side") or ""), norm(sg.get("kind") or "entry")
    head = pick(ACT.get((side, kind)) or ACT.get((side, "entry")) or ("📍 سیگنال", "📍 سیگناڵ", "📍 Signal"), lang)
    out = [f"<b>{head}</b>" + (f" — {name}" if name else ""), ""]
    when = ago(sg.get("t") or sg.get("ts"), lang)
    out.append(f"🪙 {coinname(sg.get('tv_sym') or sg.get('sym'), lang)} · ⏱ {tfname(sg.get('tf'), lang)} · "
               f"💵 {price(sg.get('price'))}" + (f" · 🕒 {when}" if when else ""))
    for k, ic, lk in (("sl", "🛑", "sl"), ("tp", "🎯", "tp1"), ("tp2", "🥈", "tp2")):
        if sg.get(k):
            out.append(f"{ic} {lab(lk, lang)}: <b>{price(sg[k])}</b>")
    out += ["", pick(DISC, lang)]
    return "\n".join(out)
