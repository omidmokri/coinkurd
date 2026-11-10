#!/usr/bin/env python3
"""Reads leverage data in the light of the market regime: one plain sentence for /derivatives/ and the bot.

The same funding rate means different things in different regimes: longs paying a premium while the trend is down
are crowded against the trend; the same premium in an uptrend is the trend's own fuel until it overheats.
This only describes the present combination (a condition), it does not forecast.

Inputs: data/regime.json (rule layer label, HMM top state) and one coin block of data/derivatives.json.
Thresholds match assets/derivatives.js: funding per 8 h, HIGH 0.02 %, EXTREME 0.05 %.
"""
HIGH, EXT = 0.02, 0.05
OI_MOVE = 3.0          # % change of open interest in 24 h that counts as "building" / "unwinding"
LS_CROWD = 2.0         # long/short account ratio above which most accounts are long

REG = {
    "bull": ("صعودی", "بەرزبوونەوە", "bull"),
    "bear": ("نزولی", "دابەزین", "bear"),
    "sideways": ("خنثی / رنج", "مامناوەند / ڕەینج", "sideways"),
}

# key -> (fa, ckb, en); {r} = regime name
MSG = {
    "bear_pos": ("بازار در رژیم «{r}» است، ولی فاندینگ مثبت است: لانگ‌ها خلاف روند پول می‌دهند. این ترکیب یعنی اهرم در سمت مخالف روند جمع شده و ریسک لیکوئید شدن لانگ‌ها بالاتر است.",
                 "بازاڕ لە دۆخی «{r}»دایە، بەڵام فاندینگ ئەرێنییە: لۆنگەکان دژی ڕەوت پارە دەدەن. ئەم تێکەڵەیە واتە لێوەر لە دژی ڕەوت کۆبووەتەوە و مەترسیی لیکویدبوونی لۆنگەکان زیاترە.",
                 "The market is in a “{r}” regime but funding is positive: longs are paying against the trend. Leverage has piled up on the wrong side of the trend, so the risk of long liquidations is higher."),
    "bear_neg": ("بازار در رژیم «{r}» است و فاندینگ منفی: شورت‌ها هم‌جهت روند شلوغ شده‌اند. روند هنوز نزولی است، ولی در جهش‌های کوتاه احتمال «شورت‌اسکوئیز» (بسته شدن اجباری شورت‌ها) بیشتر است.",
                 "بازاڕ لە دۆخی «{r}»دایە و فاندینگ نەرێنییە: شۆرتەکان لەگەڵ ڕەوت قەرەباڵغن. ڕەوت هێشتا دابەزینە، بەڵام لە بەرزبوونەوە کورتەکاندا ئەگەری «شۆرت‌سکویز» زیاترە.",
                 "The market is in a “{r}” regime and funding is negative: shorts are crowded with the trend. The trend is still down, but short bounces are more likely to turn into short squeezes."),
    "bear_flat": ("بازار در رژیم «{r}» است و فاندینگ نزدیک صفر: اهرم در هیچ سمتی شلوغ نیست و حرکت‌ها بیشتر از بازار نقدی می‌آیند تا از لیکوئید شدن‌ها.",
                  "بازاڕ لە دۆخی «{r}»دایە و فاندینگ نزیکی سفرە: لێوەر لە هیچ لایەک قەرەباڵغ نییە و جووڵەکان زیاتر لە بازاڕی نەختینەوە دێن.",
                  "The market is in a “{r}” regime and funding is near zero: leverage is not crowded on either side, so moves come more from spot than from liquidations."),
    "bull_hot": ("بازار در رژیم «{r}» است، ولی فاندینگ داغ است: لانگ‌ها برای ماندن در روند پول زیادی می‌دهند. روند سالم است تا وقتی اهرم بیش از حد گرم نشده؛ در این حالت اصلاح‌های تند می‌توانند زنجیرهٔ لیکوئید لانگ راه بیندازند.",
                 "بازاڕ لە دۆخی «{r}»دایە، بەڵام فاندینگ گەرمە: لۆنگەکان پارەیەکی زۆر دەدەن بۆ مانەوە لە ڕەوت. لەم حاڵەتەدا ڕاستکردنەوە تیژەکان دەتوانن زنجیرەی لیکویدی لۆنگ دەستپێبکەن.",
                 "The market is in a “{r}” regime but funding is hot: longs pay a lot to stay in the trend. Sharp pullbacks in this state can trigger chains of long liquidations."),
    "bull_pos": ("بازار در رژیم «{r}» است و فاندینگ مثبت ولی معمولی: لانگ‌ها هم‌جهت روندند و اهرم هنوز بیش از حد گرم نشده.",
                 "بازاڕ لە دۆخی «{r}»دایە و فاندینگ ئەرێنی بەڵام ئاساییە: لۆنگەکان لەگەڵ ڕەوتن و لێوەر هێشتا زۆر گەرم نەبووە.",
                 "The market is in a “{r}” regime with positive but ordinary funding: longs are with the trend and leverage is not overheated."),
    "bull_cool": ("بازار در رژیم «{r}» است و فاندینگ نزدیک صفر یا منفی: روند بدون شلوغی اهرم لانگ پیش می‌رود، که معمولاً نشانهٔ روندی کم‌التهاب‌تر است.",
                  "بازاڕ لە دۆخی «{r}»دایە و فاندینگ نزیکی سفر یان نەرێنییە: ڕەوت بەبێ قەرەباڵغیی لێوەری لۆنگ دەڕوات.",
                  "The market is in a “{r}” regime with funding near zero or negative: the trend is moving without crowded long leverage."),
    "side_build": ("بازار در رژیم «{r}» است و Open Interest در ۲۴ ساعت {oi} بالا رفته: در رنج اهرم جمع می‌شود. شکست رنج به هر سمت می‌تواند با زنجیرهٔ لیکوئید شدن‌ها تندتر شود.",
                   "بازاڕ لە دۆخی «{r}»دایە و Open Interest لە ٢٤ کاتژمێردا {oi} بەرزبووەتەوە: لێوەر لە ڕەنجدا کۆدەبێتەوە. شکاندنی ڕەنج بۆ هەر لایەک دەتوانێت بە زنجیرەی لیکویدبوون تیژتر بێت.",
                   "The market is in a “{r}” regime and open interest rose {oi} in 24 h: leverage is building inside the range. A break either way can be amplified by a chain of liquidations."),
    "side_hot": ("بازار در رژیم «{r}» است ولی فاندینگ داغ است: در بازار بدون روند، لانگ‌های پراهرم آسیب‌پذیرترند.",
                 "بازاڕ لە دۆخی «{r}»دایە بەڵام فاندینگ گەرمە: لە بازاڕی بێ ڕەوتدا لۆنگە پڕلێوەرەکان زیاتر مەترسیدارن.",
                 "The market is in a “{r}” regime but funding is hot: without a trend, highly leveraged longs are the more exposed side."),
    "side_calm": ("بازار در رژیم «{r}» است و هزینه و حجم اهرم آرام است (فاندینگ معمولی، Open Interest بدون جهش).",
                  "بازاڕ لە دۆخی «{r}»دایە و تێچوون و قەبارەی لێوەر هێمنە (فاندینگی ئاسایی، Open Interest بێ بازدان).",
                  "The market is in a “{r}” regime and the cost and size of leverage are calm (ordinary funding, no jump in open interest)."),
}
EXTRA = {
    "unwind": ("Open Interest در ۲۴ ساعت {oi} کم شده: اهرم در حال تخلیه است.", "Open Interest لە ٢٤ کاتژمێردا {oi} کەمبووەتەوە: لێوەر بەتاڵ دەبێتەوە.",
               "Open interest fell {oi} in 24 h: leverage is unwinding."),
    "crowd": ("{lp} حساب‌ها لانگ‌اند (نسبت {ls})؛ جمعیت یک‌طرفه است.", "{lp}ی هەژمارەکان لۆنگن (ڕێژە {ls})؛ خەڵک یەکلایەنەن.",
              "{lp} of accounts are long (ratio {ls}); the crowd is one-sided."),
    "vol": ("مدل HMM بازار را در رژیم پرنوسان می‌بیند ({c})؛ در این حالت حرکت‌های ناشی از لیکوئید شدن معمولاً بزرگ‌ترند.",
            "مۆدێلی HMM بازاڕ لە دۆخی هەڵاوسانی بەرزدا دەبینێت ({c})؛ لەم حاڵەتەدا جووڵە لیکویدییەکان زۆرجار گەورەترن.",
            "The HMM model sees a high-volatility regime ({c}); liquidation-driven moves are usually larger in this state."),
    "note": ("این توصیف شرایط فعلی است، نه پیش‌بینی.", "ئەمە وەسفی بارودۆخی ئێستایە، نەک پێشبینی.", "This describes the present conditions; it is not a forecast."),
}


def _pct(x, lang, dec=1, sign=True):
    s = f"{x:+.{dec}f}" if sign else f"{x:.{dec}f}"
    if lang == "en":
        return s + "%"
    return s.translate(str.maketrans("0123456789.-+", "۰۱۲۳۴۵۶۷۸۹٫−+")) + "٪"


def _num(x, lang, dec=2):
    s = f"{x:.{dec}f}"
    return s if lang == "en" else s.translate(str.maketrans("0123456789.", "۰۱۲۳۴۵۶۷۸۹٫"))


def oi_change(c):
    oh = c.get("oi_hist") or []
    if len(oh) >= 25 and oh[-25][1]:
        return 100 * (oh[-1][1] / oh[-25][1] - 1)
    return None


def read(regime, coin):
    """{'regime','key','extra':[...], 'fa','ckb','en'} for one derivatives coin block, or None if data is missing."""
    rule = (regime or {}).get("rule") or {}
    lab = (rule.get("now") or {}).get("label")
    f = (coin or {}).get("funding")
    if lab not in REG or f is None:
        return None
    oi = oi_change(coin)
    ls = ((coin.get("long_short") or [[0, None]])[-1] or [0, None])[1]
    if lab == "bear":
        key = "bear_pos" if f >= 0.01 else "bear_neg" if f < 0 else "bear_flat"
    elif lab == "bull":
        key = "bull_hot" if f >= HIGH else "bull_pos" if f >= 0.005 else "bull_cool"
    else:
        key = "side_build" if oi is not None and oi >= OI_MOVE else "side_hot" if f >= HIGH else "side_calm"
    extra = []
    if oi is not None and oi <= -OI_MOVE:
        extra.append("unwind")
    if ls is not None and ls >= LS_CROWD:
        extra.append("crowd")
    now = (regime or {}).get("now") or {}
    if now.get("top") == "high_vol" and (now.get("confidence") or 0) >= 0.6:
        extra.append("vol")
    out = {"regime": lab, "key": key, "extra": extra, "funding": f, "oi_24h": None if oi is None else round(oi, 2), "ls": ls}
    for i, lg in enumerate(("fa", "ckb", "en")):
        r = REG[lab][i]
        parts = [MSG[key][i].format(r=r, oi=_pct(oi or 0, lg))]
        for k in extra:
            lp = 100 * ls / (1 + ls) if ls else 0
            parts.append(EXTRA[k][i].format(oi=_pct(oi or 0, lg), lp=_pct(lp, lg, 0, False), ls=_num(ls or 0, lg),
                                             c=_pct(100 * (now.get("confidence") or 0), lg, 0, False)))
        parts.append(EXTRA["note"][i])
        out[lg] = " ".join(parts)
    return out
