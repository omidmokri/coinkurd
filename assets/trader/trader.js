/* /trader/ — «مسیر تریدر»: the plan sheet every level ends with, the checklist ticks, and the small helpers of the
   position cards (put a position or an example into the plan sheet, warn when a check is old or an entry window has
   closed). The cards, the record and the "today" strip are rendered at build time (scripts/trader_pos.py). Everything
   here runs in the visitor's browser; nothing is sent and nothing is fetched.

   The plan (TR.plan, pure; node tests/test_trader.js checks it against figures worked out by hand):
     d        = +1 long, −1 short
     exec stop = stop × (1 − d·slip)                       a stop is a market order and can fill worse
     fund/unit = d × funding × entry × hours / 8           funding is paid by longs when positive, received when negative
     loss/unit = d·(entry − exec stop) + fee·entry + fee·exec stop + fund/unit
     gain/unit = Σ share·[d·(target − entry) − fee·entry − fee·target] − fund/unit      (one or two targets)
     risk money = capital × risk%        size = risk money / loss per unit     (capped by capital × leverage)
     R = gain/unit ÷ loss/unit           break-even win rate = 1 / (1 + R)
     liquidation (linear USDT-M, isolated; the same model as /tools/#liq):
               long = entry × (1 − 1/lev) / (1 − mm),   short = entry × (1 + 1/lev) / (1 + mm)
     expectancy (R)  = p·R − (1 − p)
     Kelly (share of capital to risk) = p − (1 − p) / R;  suggested risk = min(your risk, fraction × Kelly, heat room)
     drawdown after n straight losses = 1 − (1 − risk)^n
   Educational only: no number here is a forecast or a recommendation. */
(function (root) {
  'use strict';

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v == null ? '' : v).trim()
      .replace(/[۰-۹]/g, function (c) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)); })
      .replace(/[٠-٩]/g, function (c) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)); })
      .replace(/[٬\s]/g, '').replace(/٫/g, '.').replace(/\u2212/g, '-');
    if (/^[-+]?\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) s = s.replace(/,/g, '');     /* 60,000 or 1,250.5: thousands */
    else if (/^[^,]*,[^,]*$/.test(s) && s.indexOf('.') < 0) s = s.replace(',', '.');  /* 1,5 or 0,25: a decimal comma */
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    var n = parseFloat(s); return isFinite(n) ? n : NaN;
  }

  /* x: {cap, risk, entry, stop, tp1, tp2?, share?, side?, fee?, lev?, mm?, funding?, hours?, slip?, win?, kf?, heat?, maxheat?}
     returns {ok:false, err:<key>} or {ok:true, …} */
  function plan(x) {
    var d = x.side === 'short' ? -1 : 1;
    var cap = num(x.cap), risk = num(x.risk), E = num(x.entry), S = num(x.stop), T1 = num(x.tp1);
    var T2 = num(x.tp2), share = isNaN(num(x.share)) ? 50 : num(x.share);
    var opt = function (v, dflt) { return v == null || String(v).trim() === '' ? dflt : num(v); };   /* empty: default; junk: NaN */
    var fee = opt(x.fee, 0) / 100, slip = opt(x.slip, 0) / 100, fr = opt(x.funding, 0) / 100, hrs = opt(x.hours, 0);
    if (x.tp2 != null && String(x.tp2).trim() !== '' && !(T2 > 0)) return { ok: false, err: 'eTp2' };
    var lev = isNaN(num(x.lev)) ? 1 : num(x.lev), mm = (num(x.mm) || 0) / 100;
    if (!(cap > 0)) return { ok: false, err: 'eCap' };
    if (!(risk > 0 && risk <= 100)) return { ok: false, err: 'eRisk' };
    if (!(E > 0 && S > 0 && T1 > 0)) return { ok: false, err: 'eNeed' };
    if (!(d * (E - S) > 0)) return { ok: false, err: d > 0 ? 'eStopL' : 'eStopS' };
    if (!(d * (T1 - E) > 0)) return { ok: false, err: d > 0 ? 'eTpL' : 'eTpS' };
    var two = T2 > 0;
    if (two && !(d * (T2 - T1) > 0)) return { ok: false, err: 'eTp2' };
    if (two && !(share > 0 && share < 100)) return { ok: false, err: 'eShare' };
    if (!(fee >= 0 && fee < 0.05) || !(slip >= 0 && slip < 0.5) || !(hrs >= 0 && hrs <= 8760) || Math.abs(fr) >= 0.05) return { ok: false, err: 'eCost' };
    if (!(lev >= 1 && lev <= 200) || !(mm >= 0 && mm < 0.5)) return { ok: false, err: 'eLev' };

    var sx = S * (1 - d * slip);
    var fundU = d * fr * E * hrs / 8;
    var lossU = d * (E - sx) + fee * E + fee * sx + fundU;
    var g = function (t) { return d * (t - E) - fee * E - fee * t; };
    var w = two ? share / 100 : 1;
    var gainU = w * g(T1) + (two ? (1 - w) * g(T2) : 0) - fundU;
    if (!(lossU > 0)) return { ok: false, err: fundU < 0 ? 'eFund' : 'eCost' };

    var riskMoney = cap * risk / 100;
    var qty = riskMoney / lossU, capped = false;
    var qmax = cap * lev / E;
    if (qty > qmax) { qty = qmax; capped = true; }
    if (!isFinite(qty) || !(qty > 0)) return { ok: false, err: 'eCost' };
    var notional = qty * E, loss = qty * lossU, gain = qty * gainU;
    var riskPct = loss / cap * 100;
    var R = gainU / lossU;
    var r = {
      ok: true, side: d > 0 ? 'long' : 'short', entry: E, stop: S, tp1: T1, tp2: two ? T2 : null, share: two ? share : 100,
      stopDist: Math.abs(E - S) / E * 100, tpDist: Math.abs(T1 - E) / E * 100,
      rrChart: Math.abs((two ? w * T1 + (1 - w) * T2 : T1) - E) / Math.abs(E - S),
      R: R, be: R > 0 ? 100 / (1 + R) : null,
      riskMoney: riskMoney, loss: loss, gain: gain, riskPct: riskPct, qty: qty, notional: notional, margin: notional / lev,
      capped: capped, lev: lev,
      dd5: (1 - Math.pow(1 - riskPct / 100, 5)) * 100, dd10: (1 - Math.pow(1 - riskPct / 100, 10)) * 100,
      liq: null, liqOk: null
    };
    r.costs = qty * (fee * E + fee * sx + Math.abs(S - sx) + fundU);      /* fees + stop slippage + funding, on the losing path */
    if (lev > 1 || (d < 0 && x.lev != null)) {          /* a 1x short perpetual still has a liquidation price */
      r.liq = d > 0 ? E * (1 - 1 / lev) / (1 - mm) : E * (1 + 1 / lev) / (1 + mm);
      r.liqOk = d > 0 ? sx > r.liq : sx < r.liq;          /* where the stop really fills, after slippage */
    }
    var p = num(x.win) / 100;
    if (p > 0 && p < 1) {
      r.p = p;
      r.ev = p * R - (1 - p);
      r.evMoney = r.ev * loss;
      if (x.kf != null && x.kf !== '') {
        var kf = num(x.kf); if (!(kf > 0 && kf <= 1)) kf = 0.25;
        var heat = Math.max(0, num(x.heat) || 0), maxh = num(x.maxheat); if (!(maxh > 0)) maxh = 6;
        r.kelly = R > 0 ? (p - (1 - p) / R) * 100 : -100;
        r.kellyF = r.kelly * kf;
        r.room = Math.max(0, maxh - heat);
        r.sugg = Math.max(0, Math.min(r.riskPct, r.kellyF, r.room));
        r.heatAfter = heat + riskPct;
        r.heatOk = r.heatAfter <= maxh + 1e-9;
        r.maxheat = maxh; r.kf = kf;
      }
    }
    return r;
  }

  var TR = { plan: plan, num: num };
  if (typeof module !== 'undefined' && module.exports) { module.exports = TR; return; }
  root.TR = TR;
  if (typeof document === 'undefined') return;

  /* ------------------------------------------------------------------ strings [fa, ckb, en] */
  var S = {
    cap: ['سرمایهٔ کل معامله‌ات (هر واحدی: تومان یا دلار)', 'هەموو سەرمایەی مامەڵەت (هەر یەکەیەک: تمەن یان دۆلار)', 'Your total trading capital (any unit: toman or dollars)'],
    risk: ['ریسک این معامله (٪ سرمایه)', 'مەترسیی ئەم مامەڵەیە (٪ی سەرمایە)', 'Risk on this trade (% of capital)'],
    riskB: ['چند درصد از کل پول را حاضری در این معامله از دست بدهی؟', 'ئامادەیت چەند لە سەدی هەموو پارەکەت لەم مامەڵەیەدا لەدەست بدەیت؟', 'What percent of all your money are you willing to lose on this trade?'],
    side: ['جهت', 'ئاراستە', 'Side'], long: ['لانگ (خرید)', 'لۆنگ (کڕین)', 'Long (buy)'], short: ['شورت (فروش)', 'شۆرت (فرۆشتن)', 'Short (sell)'],
    entry: ['قیمت ورود', 'نرخی چوونەژوورەوە', 'Entry price'], entryB: ['کجا می‌خری؟ (قیمت)', 'لە کوێ دەکڕیت؟ (نرخ)', 'Where do you buy? (price)'],
    stop: ['حد ضرر', 'سنووری زیان', 'Stop-loss'], stopB: ['اگر اشتباه کردی، کجا می‌فروشی؟', 'ئەگەر هەڵە بوویت، لە کوێ دەفرۆشیت؟', 'If you are wrong, where do you sell?'],
    tp1: ['تارگت اول', 'ئامانجی یەکەم', 'First target'], tp1B: ['اگر درست بود، کجا سود را برمی‌داری؟', 'ئەگەر ڕاست بوو، لە کوێ قازانجەکە هەڵدەگریت؟', 'If you are right, where do you take profit?'],
    tp2: ['تارگت دوم (اختیاری)', 'ئامانجی دووەم (ئارەزوومەندانە)', 'Second target (optional)'],
    share: ['درصدی که در تارگت اول می‌بندی', 'ئەو لە سەدەی لە ئامانجی یەکەم دایدەخەیت', 'Share closed at the first target (%)'],
    fee: ['کارمزد هر طرف (٪)', 'کرێی هەر لایەک (٪)', 'Fee per side (%)'],
    lev: ['اهرم (x)', 'لێڤەرێج (x)', 'Leverage (x)'], mm: ['نرخ مارجین نگه‌داری (٪)', 'ڕێژەی مارجینی ڕاگرتن (٪)', 'Maintenance margin (%)'],
    funding: ['فاندینگ هر ۸ ساعت (٪، منفی یعنی دریافت لانگ)', 'فەندینگی هەر ٨ کاتژمێر (٪، نەرێنی واتە لۆنگ وەریدەگرێت)', 'Funding per 8h (%, negative = longs receive)'],
    hours: ['مدت نگه‌داری (ساعت)', 'ماوەی هێشتنەوە (کاتژمێر)', 'Holding time (hours)'],
    slip: ['لغزش حد ضرر (٪)', 'خلیسکانی ستۆپ (٪)', 'Stop slippage (%)'],
    win: ['درصد برد از ژورنال خودت (اختیاری)', 'ڕێژەی بردنەوە لە ژۆرناڵی خۆت (ئارەزوومەندانە)', 'Win rate from your own journal (optional)'],
    kf: ['کسر کلی (۰٫۲۵ = یک‌چهارم)', 'بەشی کێلی (٠٫٢٥ = چارەکێک)', 'Kelly fraction (0.25 = a quarter)'],
    heat: ['ریسک معامله‌های باز دیگر (٪)', 'مەترسیی مامەڵە کراوەکانی تر (٪)', 'Risk of your other open trades (%)'],
    maxheat: ['سقف حرارت پورتفوی (٪)', 'سنووری گەرمیی پۆرتفۆلیۆ (٪)', 'Portfolio heat cap (%)'],
    /* results */
    head: ['برنامهٔ تو', 'پلانەکەت', 'Your plan'],
    oEntry: ['ورود', 'چوونەژوورەوە', 'Entry'], oStop: ['حد ضرر', 'سنووری زیان', 'Stop'], oTp: ['تارگت', 'ئامانج', 'Target'],
    oRisk: ['ریسک', 'مەترسی', 'Risk'], oSize: ['حجم', 'قەبارە', 'Size'], oR: ['R (بعد از هزینه)', 'R (دوای تێچوو)', 'R (after costs)'],
    units: ['واحد ارز', 'یەکەی دراو', 'coin units'], value: ['ارزش', 'بەها', 'value'], away: ['فاصله', 'مەودا', 'away'],
    ofCap: ['از سرمایه', 'لە سەرمایە', 'of capital'],
    lose: ['اگر حد ضرر بخورد از دست می‌دهی', 'ئەگەر سنووری زیان بکەوێت لەدەستی دەدەیت', 'If the stop is hit you lose'],
    win2: ['اگر به تارگت برسد به دست می‌آوری', 'ئەگەر بگاتە ئامانج بەدەستی دەهێنیت', 'If the target is reached you gain'],
    perR: ['در برابر هر ۱ واحد ریسک', 'بەرامبەر هەر ١ یەکەی مەترسی', 'for every 1 unit you risk'],
    be: ['درصد بردِ لازم برای سر به سر', 'ڕێژەی بردنەوەی پێویست بۆ نە قازانج نە زیان', 'Win rate needed to break even'],
    chartRR: ['R:R روی چارت (بدون هزینه)', 'R:R لەسەر چارت (بێ تێچوو)', 'Chart R:R (no costs)'],
    costs: ['هزینه‌ها در مسیر ضرر (کارمزد، لغزش، فاندینگ)', 'تێچووەکان لە ڕێگای زیاندا (کرێ، خلیسکان، فەندینگ)', 'Costs on the losing path (fees, slippage, funding)'],
    margin: ['مارجین لازم', 'مارجینی پێویست', 'Margin needed'],
    liq: ['قیمت تقریبی لیکوییدیشن', 'نرخی نزیکەیی لیکویدکردن', 'Approx. liquidation price'],
    ev: ['امید ریاضی هر معامله', 'چاوەڕوانیی بیرکاریی هەر مامەڵەیەک', 'Expectancy per trade'],
    kelly: ['کلی کامل (ریسک)', 'کێلیی تەواو (مەترسی)', 'Full Kelly (risk)'], kellyF: ['کسر کلی', 'بەشی کێلی', 'Fractional Kelly'],
    sugg: ['سقف ریسک با کلی (از آمار خودت)', 'سەقفی مەترسی بە کێلی (لە ئاماری خۆت)', 'Kelly-capped risk ceiling (from your stats)'],
    heatA: ['حرارت پورتفوی بعد از ورود', 'گەرمیی پۆرتفۆلیۆ دوای چوونەژوورەوە', 'Portfolio heat after entry'],
    dd: ['اگر ۵ و ۱۰ بار پشت سر هم حد ضرر بخورد', 'ئەگەر ٥ و ١٠ جار لەسەریەک سنووری زیان بکەوێت', 'After 5 and 10 stops in a row'],
    checks: ['چک‌های انجام‌شده', 'پشکنینە کراوەکان', 'Checks done'],
    copy: ['کپی برنامه', 'کۆپیکردنی پلان', 'Copy the plan'], copied: ['کپی شد ✓', 'کۆپی کرا ✓', 'Copied ✓'],
    reset: ['پاک کردن', 'سڕینەوە', 'Clear'],
    /* verdicts */
    vBad: ['سود این برنامه بعد از هزینه از ضررش کمتر است؛ فقط با درصد برد خیلی بالا به سود می‌رسد. تارگت دورتر یا ورود بهتر را بسنج.', 'قازانجی ئەم پلانە دوای تێچوو لە زیانەکەی کەمترە؛ تەنها بە ڕێژەی بردنەوەی زۆر بەرز قازانج دەکات. ئامانجی دوورتر یان چوونەژوورەوەی باشتر بپێوە.', 'After costs this plan makes less than it risks; it only pays with a very high win rate. Weigh a further target or a better entry.'],
    vMid: ['قابل قبول ولی تنگ: برای سود، باید در بیش از {be}٪ این‌جور معامله‌ها ببری.', 'قبووڵکراو بەڵام تەنگ: بۆ قازانج، دەبێت لە زیاتر لە {be}٪ی ئەم جۆرە مامەڵانە ببەیتەوە.', 'Acceptable but tight: to come out ahead you need to win more than {be}% of such trades.'],
    vOk: ['نسبت سود به ضرر سالم است؛ این به‌تنهایی نمی‌گوید معامله درست درمی‌آید. اگر وارد شدی، به برنامه پایبند بمان.', 'ڕێژەی قازانج بە زیان تەندروستە؛ ئەمە بە تەنها ناڵێت مامەڵەکە سەردەکەوێت. ئەگەر چوویتە ژوورەوە، پابەندی پلانەکە بە.', 'A healthy reward to risk; on its own that does not say the trade will work. If you take it, stick to the plan.'],
    vNoGain: ['بعد از کارمزد و فاندینگ، رسیدن به این تارگت سودی نمی‌دهد.', 'دوای کرێ و فەندینگ، گەیشتن بەم ئامانجە هیچ قازانجێک نادات.', 'After fees and funding, reaching this target earns nothing.'],
    wRisk: ['ریسک بیشتر از ۲٪ در یک معامله: چند ضرر پشت سر هم می‌تواند بخش بزرگی از سرمایه را ببرد.', 'مەترسی زیاتر لە ٢٪ لە یەک مامەڵەدا: چەند زیانی لەسەریەک دەتوانێت بەشێکی گەورەی سەرمایە ببات.', 'Over 2% on one trade: a few losses in a row can take a large part of the capital.'],
    wCap: ['با این سرمایه و اهرم نمی‌شود این حجم را گرفت؛ حجم به بیشترین ممکن محدود شد و ریسک واقعی کمتر از چیزی است که خواستی.', 'بەم سەرمایە و لێڤەرێجە ناکرێت ئەم قەبارەیە بگیرێت؛ قەبارە بە زۆرترینی گونجاو سنووردار کرا و مەترسیی ڕاستەقینە لەوەی ویستت کەمترە.', 'This capital and leverage cannot carry that size; it was capped at the maximum, so the real risk is below what you asked for.'],
    wLiq: ['⚠️ لیکوییدیشن قبل از حد ضرر می‌رسد؛ حد ضرر تو عملاً کار نمی‌کند. اهرم را کم کن.', '⚠️ لیکویدکردن پێش سنووری زیان دەگات؛ سنووری زیانەکەت لە کرداردا کار ناکات. لێڤەرێج کەم بکەرەوە.', '⚠️ Liquidation comes before your stop, so the stop never works. Lower the leverage.'],
    okLiq: ['حد ضرر تقریباً قبل از لیکوییدیشن فعال می‌شود ✓', 'سنووری زیان نزیکەی پێش لیکویدکردن کار دەکات ✓', 'The stop triggers before the approximate liquidation price ✓'],
    wEv: ['با این درصد برد، امید ریاضی منفی است: در بلندمدت این برنامه پول می‌بازد.', 'بەم ڕێژەی بردنەوەیە، چاوەڕوانیی بیرکاری نەرێنییە: لە درێژخایەندا ئەم پلانە پارە دەدۆڕێنێت.', 'At this win rate the expectancy is negative: over time this plan loses money.'],
    wKelly: ['کلی منفی یا صفر است: آمار تو برای این معامله لبه‌ای نشان نمی‌دهد.', 'کێلی نەرێنی یان سفرە: ئامارەکەت بۆ ئەم مامەڵەیە هیچ لێوارێک پیشان نادات.', 'Kelly is zero or negative: your stats show no edge for this trade.'],
    wHeat: ['با این معامله از سقف حرارت پورتفوی رد می‌شوی.', 'بەم مامەڵەیە لە سنووری گەرمیی پۆرتفۆلیۆ تێدەپەڕیت.', 'This trade takes you over your portfolio heat cap.'],
    eCap: ['سرمایه را وارد کن.', 'سەرمایە بنووسە.', 'Enter your capital.'],
    eRisk: ['ریسک باید بین ۰ و ۱۰۰ درصد باشد.', 'مەترسی دەبێت لە نێوان ٠ و ١٠٠ لە سەددا بێت.', 'Risk must be between 0 and 100%.'],
    eNeed: ['ورود، حد ضرر و تارگت را وارد کن.', 'چوونەژوورەوە، سنووری زیان و ئامانج بنووسە.', 'Enter the entry, the stop and the target.'],
    eStopL: ['در خرید (لانگ)، حد ضرر باید زیر قیمت ورود باشد.', 'لە کڕین (لۆنگ)دا، سنووری زیان دەبێت لە خوار نرخی چوونەژوورەوە بێت.', 'For a long, the stop must be below the entry.'],
    eStopS: ['در شورت، حد ضرر باید بالای قیمت ورود باشد.', 'لە شۆرتدا، سنووری زیان دەبێت لە سەرووی نرخی چوونەژوورەوە بێت.', 'For a short, the stop must be above the entry.'],
    eTpL: ['در خرید (لانگ)، تارگت باید بالای قیمت ورود باشد.', 'لە کڕین (لۆنگ)دا، ئامانج دەبێت لە سەرووی نرخی چوونەژوورەوە بێت.', 'For a long, the target must be above the entry.'],
    eTpS: ['در شورت، تارگت باید زیر قیمت ورود باشد.', 'لە شۆرتدا، ئامانج دەبێت لە خوار نرخی چوونەژوورەوە بێت.', 'For a short, the target must be below the entry.'],
    eTp2: ['تارگت دوم باید از تارگت اول دورتر باشد.', 'ئامانجی دووەم دەبێت لە ئامانجی یەکەم دوورتر بێت.', 'The second target must lie beyond the first.'],
    eShare: ['درصد بستن در تارگت اول باید بین ۰ و ۱۰۰ باشد.', 'لە سەدی داخستن لە ئامانجی یەکەم دەبێت لە نێوان ٠ و ١٠٠ دا بێت.', 'The share closed at the first target must be between 0 and 100.'],
    eFund: ['فاندینگ دریافتی از فاصلهٔ حد ضرر بیشتر است؛ مدت یا فاندینگ را بررسی کن.', 'ئەو فەندینگەی وەریدەگریت لە مەودای سنووری زیان زیاترە؛ ماوە یان فەندینگ بپشکنە.', 'The funding you receive is larger than the distance to your stop; check the holding time or the funding.'],
    eCost: ['کارمزد، فاندینگ، لغزش یا مدت عدد معقولی نیست.', 'کرێ، فەندینگ، خلیسکان یان ماوە ژمارەیەکی گونجاو نییە.', 'The fee, funding, slippage or holding time is not a sensible number.'],
    eLev: ['اهرم بین ۱ و ۲۰۰ و مارجین نگه‌داری زیر ۵۰٪.', 'لێڤەرێج لە نێوان ١ و ٢٠٠ و مارجینی ڕاگرتن لە خوار ٥٠٪.', 'Leverage between 1 and 200, maintenance margin below 50%.']
  };
  function lg() { var l = (root.EKL && root.EKL()) || document.documentElement.lang || 'fa'; return l === 'ckb' ? 1 : l === 'en' ? 2 : 0; }
  function t(k) { var v = Object.prototype.hasOwnProperty.call(S, k) ? S[k] : null; return v ? v[lg()] : k; }
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function fmt(v, dg) {
    if (v == null || !isFinite(v)) return '—';
    if (dg == null) { var a = Math.abs(v); dg = a >= 1000 ? 0 : a >= 100 ? 2 : a >= 1 ? 2 : a >= 0.01 ? 4 : 8; }
    return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dg });
  }
  function nt(str) { var s = el('span', 'rc-num', str); s.dir = 'ltr'; return s; }      /* several figures read as one, left to right */
  function nm(v, dg, suf) { var s = el('span', 'rc-num', fmt(v, dg).replace(/^-/, '−') + (suf || '')); s.dir = 'ltr'; return s; }
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function load(k) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }

  /* ------------------------------------------------------------------ checklist */
  function checks(level) {
    var key = 'ek_tr_chk_' + level, saved = load(key) || {};
    var boxes = document.querySelectorAll('input.tr-chk[data-k]');
    boxes.forEach(function (b) {
      b.checked = !!saved[b.getAttribute('data-k')];
      b.addEventListener('change', function () {
        var k = b.getAttribute('data-k'), v = load(key) || {};
        if (b.checked) v[k] = 1; else delete v[k];
        store(key, v);
        document.querySelectorAll('input.tr-chk[data-k="' + k + '"]').forEach(function (o) { o.checked = b.checked; });   /* the other language blocks */
        window.dispatchEvent(new CustomEvent('tr-checks'));
      });
    });
  }
  function checkCount() {
    var ks = {}, done = {};
    document.querySelectorAll('input.tr-chk[data-k]').forEach(function (b) { var k = b.getAttribute('data-k'); ks[k] = 1; if (b.checked) done[k] = 1; });
    return [Object.keys(done).length, Object.keys(ks).length];
  }

  /* ------------------------------------------------------------------ plan sheet */
  var FIELDS = {
    base: [['cap', '1000'], ['risk', '1'], ['entry', ''], ['stop', ''], ['tp1', '']],
    side: [['side', 'long']], fee: [['fee', '0.1']], tp2: [['tp2', ''], ['share', '50']],
    lev: [['lev', '1'], ['mm', '0.5']], carry: [['funding', '0.01'], ['hours', '24'], ['slip', '0.05']],
    edge: [['win', '']], port: [['kf', '0.25'], ['heat', '0'], ['maxheat', '6']]
  };
  function planUI(box) {
    var level = box.getAttribute('data-level') || 'x', groups = (box.getAttribute('data-fields') || 'base').split(' ');
    var simple = groups.length === 1, key = 'ek_tr_plan_' + level, saved = load(key) || {};
    var form = el('div', 'tr-form'), out = el('div', 'tr-out'), inputs = {};
    groups.forEach(function (g) {
      (FIELDS[g] || []).forEach(function (f) {
        var id = f[0], lab = el('label', 'tr-f'), cap = el('span', 'tr-lab'), inp;
        cap.setAttribute('data-k', simple && S[id + 'B'] ? id + 'B' : id === 'risk' && simple ? 'riskB' : id);
        if (id === 'side') {
          inp = el('select');
          ['long', 'short'].forEach(function (v) { var o = el('option'); o.value = v; o.setAttribute('data-k', v); inp.appendChild(o); });
        } else {
          inp = el('input'); inp.type = 'text'; inp.inputMode = id === 'funding' ? 'text' : 'decimal'; inp.autocomplete = 'off'; inp.spellcheck = false;
          inp.setAttribute('dir', 'ltr'); inp.maxLength = 24; if (f[1]) inp.placeholder = f[1];
        }
        inp.id = 'tr-' + level + '-' + id;
        var v = saved[id] != null ? String(saved[id]) : f[1];
        if (id === 'side') inp.value = v === 'short' ? 'short' : 'long'; else inp.value = v;
        lab.htmlFor = inp.id;
        lab.appendChild(cap); lab.appendChild(inp); form.appendChild(lab);
        inputs[id] = inp;
        inp.addEventListener('input', go); inp.addEventListener('change', go);
      });
    });
    var bar = el('div', 'tr-bar'), bCopy = el('button', 'rc-btn2'), bReset = el('button', 'rc-btn2');
    bCopy.type = bReset.type = 'button'; bCopy.setAttribute('data-k', 'copy'); bReset.setAttribute('data-k', 'reset');
    bar.appendChild(bCopy); bar.appendChild(bReset);
    box.textContent = ''; box.appendChild(form); box.appendChild(out); box.appendChild(bar);
    var last = null;

    function vals() { var x = {}; Object.keys(inputs).forEach(function (k) { x[k] = inputs[k].value.trim().slice(0, 24); }); return x; }
    function labels() {
      box.querySelectorAll('[data-k]').forEach(function (n) { if (n.tagName !== 'INPUT') n.textContent = t(n.getAttribute('data-k')); });
    }
    function row(parent, k, main, sub, tone) {
      var r = el('div', 'tr-kpi' + (tone ? ' ' + tone : '')); r.appendChild(el('small', null, t(k)));
      var b = el('b'); if (typeof main === 'string') b.textContent = main; else b.appendChild(main); r.appendChild(b);
      if (sub) { var s = el('em'); if (typeof sub === 'string') s.textContent = sub; else s.appendChild(sub); r.appendChild(s); }
      parent.appendChild(r);
    }
    function frag() { var f = el('span'); for (var i = 0; i < arguments.length; i++) { var a = arguments[i]; f.appendChild(typeof a === 'string' ? document.createTextNode(a) : a); } return f; }
    function note(cls, k, be) { out.appendChild(el('p', 'tr-v ' + cls, t(k).replace('{be}', be == null ? '' : fmt(be, 1)))); }

    function go() {
      var x = vals(); store(key, x);
      if (inputs.side == null) x.side = 'long';
      if (inputs.lev == null) x.lev = 1;
      if (inputs.fee == null) x.fee = 0.1;          /* a beginner pays fees too: a typical spot fee, said in the method note */
      if (inputs.kf) x.kf = x.kf || '0.25';
      var r = plan(x); last = r; out.textContent = '';
      var cc = checkCount();
      if (!r.ok) { out.appendChild(el('p', 'tr-v tr-err', t(r.err))); return; }
      out.appendChild(el('h3', 'tr-h', t('head')));
      var g = el('div', 'tr-kpis'); out.appendChild(g);
      row(g, 'oEntry', nm(r.entry), t(r.side === 'long' ? 'long' : 'short'));
      row(g, 'oStop', nm(r.stop), frag(nm(r.stopDist, 2, '%'), ' ', t('away')), 'dn');
      row(g, 'oTp', r.tp2 ? nt(fmt(r.tp1) + ' · ' + fmt(r.tp2)) : nm(r.tp1), frag(nm(r.tpDist, 2, '%'), ' ', t('away')), 'up');
      row(g, 'oRisk', nm(r.loss), frag(nm(r.riskPct, 2, '%'), ' ', t('ofCap')), 'dn');
      row(g, 'oSize', nm(r.qty), frag(t('units'), ' · ', t('value'), ' ', nm(r.notional)));
      row(g, 'oR', nm(r.R, 2, 'R'), frag(t('be'), ': ', nm(r.be, 1, '%')), r.R >= 1.5 ? 'up' : r.R < 1 ? 'dn' : '');
      var g2 = el('div', 'tr-lines'); out.appendChild(g2);
      var line = function (k, v) { var p = el('p'); p.appendChild(el('span', null, t(k) + ': ')); p.appendChild(v); g2.appendChild(p); };
      line('lose', nm(r.loss)); line('win2', frag(nm(r.gain), ' (', nm(r.R, 2), ' ', t('perR'), ')'));
      if (!simple) { line('chartRR', nm(r.rrChart, 2)); line('costs', nm(r.costs)); }
      if (r.lev > 1) { line('margin', nm(r.margin)); line('liq', nm(r.liq)); }
      line('dd', nt('−' + fmt(r.dd5, 1) + '% · −' + fmt(r.dd10, 1) + '%'));
      if (r.p != null) line('ev', nt(fmt(r.ev, 2) + 'R · ' + fmt(r.evMoney)));
      if (r.kelly != null) {
        line('kelly', nm(r.kelly, 2, '%')); line('kellyF', nm(r.kellyF, 2, '%'));
        line('sugg', nm(r.sugg, 2, '%')); line('heatA', nt(fmt(r.heatAfter, 2) + '% / ' + fmt(r.maxheat, 2) + '%'));
      }
      if (cc[1]) line('checks', nt(cc[0] + ' / ' + cc[1]));
      if (r.gain <= 0) note('tr-err', 'vNoGain'); else note(r.R < 1 ? 'tr-err' : r.R < 1.5 ? 'tr-warn' : 'tr-ok', r.R < 1 ? 'vBad' : r.R < 1.5 ? 'vMid' : 'vOk', r.be);
      if (r.riskPct > 2) note('tr-warn', 'wRisk');
      if (r.capped) note('tr-warn', 'wCap');
      if (r.liq != null) note(r.liqOk ? 'tr-ok' : 'tr-err', r.liqOk ? 'okLiq' : 'wLiq');
      if (r.ev != null && r.ev < 0) note('tr-err', 'wEv');
      if (r.kelly != null && r.kelly <= 0) note('tr-err', 'wKelly');
      if (r.heatOk === false) note('tr-warn', 'wHeat');
    }
    function text() {
      if (!last || !last.ok) return '';
      var r = last, L = [t('head') + ' — entekhab.net/trader/'];
      L.push(t('oEntry') + ': ' + fmt(r.entry) + ' (' + t(r.side) + ')');
      L.push(t('oStop') + ': ' + fmt(r.stop) + ' (' + fmt(r.stopDist, 2) + '%)');
      L.push(t('oTp') + ': ' + fmt(r.tp1) + (r.tp2 ? ' · ' + fmt(r.tp2) : ''));
      L.push(t('oRisk') + ': ' + fmt(r.loss) + ' (' + fmt(r.riskPct, 2) + '%)');
      L.push(t('oSize') + ': ' + fmt(r.qty) + ' ' + t('units') + ' · ' + t('value') + ' ' + fmt(r.notional));
      L.push(t('oR') + ': ' + fmt(r.R, 2) + 'R · ' + t('be') + ' ' + fmt(r.be, 1) + '%');
      if (r.liq != null) L.push(t('liq') + ': ' + fmt(r.liq));
      return L.join('\n');
    }
    bCopy.addEventListener('click', function () {
      var s = text(); if (!s) return;
      var done = function () { bCopy.textContent = t('copied'); setTimeout(function () { bCopy.textContent = t('copy'); }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(done, function () {});
    });
    bReset.addEventListener('click', function () {
      store(key, null);
      groups.forEach(function (gg) { (FIELDS[gg] || []).forEach(function (f) { var i = inputs[f[0]]; if (i) i.value = f[1]; }); });
      go();
    });
    window.addEventListener('ek-lang', function () { labels(); go(); });
    window.addEventListener('tr-checks', go);
    labels(); go();
  }

  /* ------------------------------------------------------------------ position cards */
  var PLAN_KEYS = ['side', 'entry', 'stop', 'tp1', 'tp2', 'share', 'lev', 'win', 'cap', 'risk', 'fee', 'mm', 'funding', 'hours', 'slip', 'kf', 'heat', 'maxheat'];
  function loader() {
    document.querySelectorAll('button.tr-load[data-plan]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var box = document.querySelector('.tr-plan[data-level]'); if (!box) return;
        var p; try { p = JSON.parse(btn.getAttribute('data-plan') || '{}'); } catch (e) { return; }
        if (!p || typeof p !== 'object') return;
        var key = 'ek_tr_plan_' + box.getAttribute('data-level'), cur = load(key) || {};
        PLAN_KEYS.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(p, k)) cur[k] = String(p[k]).slice(0, 24); });
        store(key, cur);
        planUI(box);
        var lab = btn.textContent; btn.textContent = btn.getAttribute('data-done') || lab;
        setTimeout(function () { btn.textContent = lab; }, 2400);
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }
  function freshness() {
    var now = Date.now();
    document.querySelectorAll('.tr-upd[data-upd]').forEach(function (p) {
      var u = +p.getAttribute('data-upd'); if (!u || now - u < 2 * 3600e3) return;
      var w = el('p', 'tr-v tr-warn', (p.getAttribute('data-stale') || '').replace('{h}', String(Math.round((now - u) / 3600e3))));
      p.parentNode.insertBefore(w, p.nextSibling);
    });
    document.querySelectorAll('.tr-pos[data-valid]').forEach(function (c) {
      var v = +c.getAttribute('data-valid'); if (!v || now <= v) return;
      c.classList.add('tr-old');
      var x = c.querySelector('.tr-expired'); if (x) x.hidden = false;
      c.querySelectorAll('button.tr-load').forEach(function (b) { b.disabled = true; });
    });
  }

  function boot() {
    var lv = document.querySelector('[data-tr-level]');
    if (lv) checks(lv.getAttribute('data-tr-level'));
    document.querySelectorAll('.tr-plan[data-fields]').forEach(planUI);
    loader(); freshness();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : this);
