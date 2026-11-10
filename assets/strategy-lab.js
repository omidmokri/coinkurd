/* Strategy lab — write a trading rule, back-test it after costs, then check whether the edge is real.
   Everything runs in the visitor's browser: prices from Binance spot (data-api.binance.vision), market
   context (Fear & Greed, BTC regime, funding) from /data/lab_context.json.

   Honesty rules kept by the engine:
   - a signal is read on a bar's CLOSE and acted on at the NEXT bar's OPEN (no look-ahead);
   - stop-loss / take-profit are checked inside each bar; if both could have been hit in the same bar,
     the stop is assumed (the worse case); a gap through a level fills at the open;
   - fee + slippage are charged on both sides of every trade;
   - the permutation test shuffles the bars (gaps and intrabar moves separately, as in T. Masters'
     Monte-Carlo permutation test), re-runs the identical rule and counts how often noise does as well;
   - walk-forward re-runs the rule on later, unseen stretches; with an optimised parameter the value is
     picked on the past only and judged on the next stretch. */
(function () {
  'use strict';
  var root = document.getElementById('slab');
  if (!root) return;
  var API = 'https://data-api.binance.vision/api/v3/klines';
  var REG = ['bull', 'bear', 'sideways', 'high_vol'];
  var COINS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'TRX', 'AVAX', 'LINK', 'DOT', 'LTC', 'BCH', 'NEAR', 'ATOM', 'UNI',
    'ETC', 'XLM', 'FIL', 'APT', 'ARB', 'OP', 'SUI', 'INJ', 'AAVE', 'TON', 'PEPE', 'SHIB', 'RNDR', 'FET', 'TIA', 'SEI', 'HBAR', 'ALGO', 'ICP'];

  /* ------------------------------------------------------------------ language */
  var S = {
    load: ['دریافت داده‌ها…', 'وەرگرتنی داتا…', 'Loading data…'],
    coin: ['ارز', 'دراو', 'Coin'], tf: ['تایم‌فریم', 'کاتەکان', 'Timeframe'], from: ['از تاریخ', 'لە بەرواری', 'From'],
    side: ['جهت', 'ئاڕاستە', 'Side'], long: ['خرید (لانگ)', 'کڕین (لۆنگ)', 'Long'], short: ['فروش (شورت)', 'فرۆشتن (شۆرت)', 'Short'],
    entry: ['شرط ورود', 'مەرجی چوونەژوورەوە', 'Entry rule'], exit: ['شرط خروج', 'مەرجی دەرچوون', 'Exit rule'],
    all: ['همهٔ شرط‌ها برقرار باشد', 'هەموو مەرجەکان', 'all conditions true'], any: ['یکی از شرط‌ها کافی است', 'یەکێک بەسە', 'any condition true'],
    add: ['+ افزودن شرط', '+ مەرج زیاد بکە', '+ add condition'], del: ['حذف', 'سڕینەوە', 'remove'],
    risk: ['مدیریت ریسک و هزینه', 'بەڕێوەبردنی مەترسی و تێچوو', 'Risk and costs'],
    sl: ['حد ضرر ٪ (۰ = ندارد)', 'سنووری زیان ٪ (٠ = نییە)', 'Stop-loss % (0 = none)'],
    tp: ['حد سود ٪ (۰ = ندارد)', 'سنووری قازانج ٪ (٠ = نییە)', 'Take-profit % (0 = none)'],
    hold: ['حداکثر نگهداری (کندل، ۰ = بی‌نهایت)', 'زۆرترین ماوە (مۆم، ٠ = بێ سنوور)', 'Max bars held (0 = no limit)'],
    fee: ['کارمزد هر طرف ٪', 'کرێی هەر لایەک ٪', 'Fee per side %'], slip: ['لغزش هر طرف ٪', 'خلیسکان هەر لایەک ٪', 'Slippage per side %'],
    run: ['اجرای بک‌تست', 'بەکارخستنی باکتێست', 'Run back-test'], presets: ['نمونه‌های آماده', 'نموونە ئامادەکان', 'Ready-made examples'],
    share: ['کپی لینک این استراتژی', 'لینکی ئەم ستراتیژە کۆپی بکە', 'Copy link to this strategy'], copied: ['لینک کپی شد', 'لینک کۆپی کرا', 'Link copied'],
    num: ['عدد', 'ژمارە', 'number'],
    close: ['قیمت بسته‌شدن', 'نرخی داخستن', 'close'], open: ['قیمت باز شدن', 'نرخی کردنەوە', 'open'],
    sma: ['میانگین ساده', 'ناوەندی سادە', 'SMA'], ema: ['میانگین نمایی', 'ناوەندی هێڵکاری', 'EMA'], rsi: ['RSI', 'RSI', 'RSI'],
    ret: ['تغییر ٪ در n کندل', 'گۆڕان ٪ لە n مۆم', '% change over n bars'], dist: ['فاصله ٪ از میانگین n', 'دووری ٪ لە ناوەندی n', '% distance from SMA n'],
    vr: ['حجم ÷ میانگین حجم n', 'قەبارە ÷ ناوەندی قەبارە n', 'volume ÷ avg volume n'], atr: ['ATR ٪', 'ATR ٪', 'ATR %'],
    hh: ['بالاترین سقف n کندل قبل', 'بەرزترین لوتکەی n مۆمی پێشوو', 'highest high of prior n'],
    ll: ['پایین‌ترین کف n کندل قبل', 'نزمترین بنی n مۆمی پێشوو', 'lowest low of prior n'],
    fng: ['ترس و طمع', 'ترس و تەماح', 'Fear & Greed'], hmm: ['رژیم BTC (مدل احتمالی)', 'دۆخی BTC (مۆدێلی ئەگەری)', 'BTC regime (HMM)'],
    rule: ['رژیم BTC (قاعده‌محور)', 'دۆخی BTC (یاسایی)', 'BTC regime (rules)'], fund: ['فاندینگ ٪', 'فاندینگ ٪', 'funding %'],
    xa: ['از پایین قطع کند', 'لە خوارەوە ببڕێت', 'crosses above'], xb: ['از بالا قطع کند', 'لە سەرەوە ببڕێت', 'crosses below'],
    is: ['برابر است با', 'یەکسانە بە', 'is'], isnt: ['نیست', 'نییە', 'is not'],
    bull: ['صعودی', 'بەرزبوونەوە', 'bull'], bear: ['نزولی', 'دابەزین', 'bear'], sideways: ['خنثی', 'مامناوەند', 'sideways'],
    high_vol: ['پرنوسانِ بی‌جهت', 'هەڵاوسانی بێ ئاڕاستە', 'volatile, no trend'],
    res: ['نتیجهٔ بک‌تست', 'ئەنجامی باکتێست', 'Back-test result'],
    k_ret: ['بازده خالص', 'قازانجی پاک', 'Net return'], k_cagr: ['بازده سالانه', 'قازانجی ساڵانە', 'CAGR'],
    k_dd: ['حداکثر افت', 'زۆرترین داکەوتن', 'Max drawdown'], k_n: ['معامله', 'مامەڵە', 'Trades'], k_win: ['نرخ برد', 'ڕێژەی بردنەوە', 'Win rate'],
    k_pf: ['ضریب سود', 'هۆکاری قازانج', 'Profit factor'], k_avg: ['میانگین هر معامله', 'ناوەندی هەر مامەڵە', 'Avg trade'],
    k_exp: ['زمان در بازار', 'کات لە بازاڕ', 'Time in market'], k_sh: ['شارپ', 'شارپ', 'Sharpe'],
    k_so: ['سورتینو', 'سۆرتینۆ', 'Sortino'],
    of: ['آیا بهینه‌سازی فریبنده است؟ (PBO و شارپ تعدیل‌شده)', 'ئایا باشترکردن فریودەرە؟ (PBO و شارپی ڕاستکراوە)', 'Is the optimisation fooling you? (PBO and deflated Sharpe)'],
    of_lead: ['وقتی چندین مقدار پارامتر امتحان می‌شود، بهترینشان تا حدی فقط از شانس بهترین است. دو آزمون استاندارد این را می‌سنجند: احتمال بیش‌برازش بک‌تست (PBO، روش CSCV با ۸ بخش و ۷۰ ترکیب) و نسبت شارپ تعدیل‌شده (DSR) که شارپ بهترین مقدار را با تعداد آزمون‌ها، چولگی و کشیدگی بازده‌ها می‌سنجد.',
      'کاتێک چەندین بەهای پارامەتەر تاقی دەکرێتەوە، باشترینیان تا ڕادەیەک تەنها بە هەڵکەوت باشترینە. دوو تاقیکردنەوەی ستاندارد ئەمە دەپێون: ئەگەری زیادەگونجاندنی باکتێست (PBO، ڕێبازی CSCV بە ٨ بەش و ٧٠ تێکەڵە) و ڕێژەی شارپی ڕاستکراوە (DSR).',
      'When many parameter values are tried, the best one is partly best by luck. Two standard tests measure this: the Probability of Backtest Overfitting (PBO, CSCV with 8 blocks and 70 combinations) and the Deflated Sharpe Ratio (DSR), which judges the best value\'s Sharpe against the number of trials and the skew and kurtosis of its returns.'],
    of_pbo: ['احتمال بیش‌برازش (PBO)', 'ئەگەری زیادەگونجاندن (PBO)', 'Probability of overfitting (PBO)'],
    of_dsr: ['شارپ تعدیل‌شده (DSR)', 'شارپی ڕاستکراوە (DSR)', 'Deflated Sharpe (DSR)'], of_n: ['مقدارهای آزموده', 'بەها تاقیکراوەکان', 'Values tried'],
    of_p_ok: ['PBO پایین: مقداری که در گذشته بهترین بود، معمولاً روی دادهٔ دیده‌نشده هم بالای میانه ماند.', 'PBO نزم: باشترین بەهای ڕابردوو زۆرجار لەسەر داتای نەبینراویش سەرووی ناوەند مایەوە.', 'Low PBO: the value that was best in-sample usually stayed above the median out of sample.'],
    of_p_mid: ['PBO متوسط: انتخاب بهترین مقدار تا حدی به شانس وابسته است.', 'PBO مامناوەند: هەڵبژاردنی باشترین بەها تا ڕادەیەک بە هەڵکەوتە.', 'Moderate PBO: picking the best value depends partly on luck.'],
    of_p_bad: ['PBO بالا: بهترین مقدار گذشته در بیشتر ترکیب‌ها روی دادهٔ دیده‌نشده زیر میانه رفت؛ نشانهٔ بیش‌برازش.', 'PBO بەرز: باشترین بەهای ڕابردوو لە زۆربەی تێکەڵەکاندا لەسەر داتای نەبینراو چووە خوار ناوەند؛ نیشانەی زیادەگونجاندن.', 'High PBO: the in-sample best fell below the median out of sample in most combinations — a sign of overfitting.'],
    of_d_ok: ['DSR بالای ۹۵٪: شارپ بهترین مقدار حتی با حساب تعداد آزمون‌ها معنادار است.', 'DSR سەرووی ٩٥٪: شارپی باشترین بەها تەنانەت بە ژماردنی تاقیکردنەوەکانیش واتادارە.', 'DSR above 95%: the best value\'s Sharpe is significant even after counting the trials.'],
    of_d_no: ['DSR زیر ۹۵٪: با این تعداد آزمون، شارپ بهترین مقدار از شانس قابل تشخیص نیست.', 'DSR خوار ٩٥٪: بەم ژمارەیە تاقیکردنەوە، شارپی باشترین بەها لە هەڵکەوت جیا ناکرێتەوە.', 'DSR below 95%: with this many trials, the best value\'s Sharpe cannot be told apart from luck.'],
    of_few: ['برای این آزمون دست‌کم ۳ مقدار پارامتر و ۸۰ کندل لازم است.', 'بۆ ئەم تاقیکردنەوەیە لانیکەم ٣ بەها و ٨٠ مۆم پێویستە.', 'This test needs at least 3 parameter values and 80 bars.'], k_ca: ['کالمار (بازده سالانه ÷ افت)', 'کالمار', 'Calmar (CAGR ÷ drawdown)'],
    mc: ['مونت‌کارلو: اگر ترتیب و ترکیب معامله‌ها فرق می‌کرد؟', 'مۆنت کارلۆ: ئەگەر ڕیز و تێکەڵەی مامەڵەکان جیاواز بوایە؟', 'Monte Carlo: what if the trades had come in another order and mix?'],
    mc_lead: ['همین معامله‌ها ۲٬۰۰۰ بار با جایگذاری بازنمونه‌گیری می‌شوند (هر بار همان تعداد معامله، با ترتیب تصادفی). این آزمون لبه را ثابت نمی‌کند — کار آزمون جایگشت است — بلکه نشان می‌دهد با همین نوع معامله‌ها، چه بازه‌ای از بازده و افت سرمایه را باید انتظار داشت.',
      'هەمان مامەڵەکان ٢٬٠٠٠ جار بە گەڕاندنەوە دووبارە نموونە دەگیرێن (هەر جارێک هەمان ژمارەی مامەڵە، بە ڕیزی هەڕەمەکی). ئەمە لێوار ناسەلمێنێت — ئەوە کاری تاقیکردنەوەی جێگۆڕکێیە — بەڵکو نیشان دەدات بە هەمان جۆری مامەڵە، چ مەودایەکی قازانج و داکەوتن چاوەڕوان دەکرێت.',
      'The same trades are resampled 2,000 times with replacement (same number of trades each time, random order). This does not prove an edge — that is the permutation test\'s job — it shows the range of returns and drawdowns to expect from trades like these.'],
    mc_p5: ['بازده بد (صدک ۵)', 'قازانجی خراپ (سەدەکی ٥)', 'Bad case return (5th pct)'], mc_p50: ['بازده میانه', 'قازانجی ناوەند', 'Median return'],
    mc_p95: ['بازده خوب (صدک ۹۵)', 'قازانجی باش (سەدەکی ٩٥)', 'Good case return (95th pct)'],
    mc_dd50: ['افت معمول (میانه)', 'داکەوتنی ئاسایی (ناوەند)', 'Typical drawdown (median)'], mc_dd95: ['افت بد (صدک ۹۵)', 'داکەوتنی خراپ (سەدەکی ٩٥)', 'Bad drawdown (95th pct)'],
    mc_loss: ['احتمال زیان کل', 'ئەگەری زیانی گشتی', 'Chance of a net loss'],
    mc_few: ['برای مونت‌کارلو دست‌کم ۱۰ معامله لازم است.', 'بۆ مۆنت کارلۆ لانیکەم ١٠ مامەڵە پێویستە.', 'Monte Carlo needs at least 10 trades.'],
    mc_dd_note: ['افت این‌جا بین معامله‌ها حساب می‌شود (نه داخل هر معامله)، پس افت واقعی می‌تواند کمی بیشتر باشد.', 'داکەوتن لێرە لە نێوان مامەڵەکاندا دەژمێردرێت (نەک لەناو هەر مامەڵەیەک)، بۆیە داکەوتنی ڕاستەقینە دەکرێت کەمێک زیاتر بێت.', 'Drawdown here is measured between trades (not inside each one), so the real drawdown can be somewhat larger.'],
    k_bh: ['خرید و نگهداری', 'کڕین و ڕاگرتن', 'Buy & hold'], k_bhdd: ['افت خرید و نگهداری', 'داکەوتنی کڕین و ڕاگرتن', 'Buy & hold drawdown'],
    eq: ['منحنی سرمایه (لگاریتمی)', 'هێڵی سەرمایە (لۆگاریتمی)', 'Equity curve (log)'], strat: ['استراتژی', 'ستراتیژ', 'strategy'],
    trades: ['آخرین معامله‌ها', 'دوایین مامەڵەکان', 'Latest trades'],
    th_tr: ['ورود|خروج|قیمت ورود|قیمت خروج|کندل|خالص|دلیل خروج', 'چوونە|دەرچوون|نرخی چوونە|نرخی دەرچوون|مۆم|پاک|هۆی دەرچوون',
      'Entry|Exit|Entry price|Exit price|Bars|Net|Exit reason'],
    r_sig: ['شرط خروج', 'مەرجی دەرچوون', 'exit rule'], r_sl: ['حد ضرر', 'سنووری زیان', 'stop'], r_tp: ['حد سود', 'سنووری قازانج', 'target'],
    r_time: ['سقف زمان', 'سنووری کات', 'time'], r_end: ['پایان داده', 'کۆتایی داتا', 'end of data'],
    perm: ['آزمون جایگشت: لبه واقعی است یا شانس؟', 'تاقیکردنەوەی جێگۆڕکێ: لێوار ڕاستەقینەیە یان هەڵکەوت؟', 'Permutation test: real edge or luck?'],
    perm_lead: ['کندل‌ها صدها بار به‌هم ریخته می‌شوند (همان توزیع بازده، بدون الگو) و همین قانون روی هر نسخه اجرا می‌شود. اگر نسخه‌های تصادفی هم به همین خوبی برسند، لبه‌ای در کار نیست.',
      'مۆمەکان سەدان جار تێکەڵ دەکرێن (هەمان دابەشبوونی قازانج، بێ شێواز) و هەمان یاسا لەسەر هەر وەشانێک دەکرێت. ئەگەر وەشانە هەڕەمەکییەکانیش هێندە باش بن، لێوارێک نییە.',
      'The bars are shuffled hundreds of times (same return distribution, no pattern) and the same rule is run on each copy. If random copies do as well, there is no edge.'],
    perm_run: ['اجرای آزمون', 'دەستپێکردنی تاقیکردنەوە', 'Run the test'], perm_n: ['تعداد جایگشت', 'ژمارەی جێگۆڕکێ', 'Permutations'],
    perm_p: ['p-value', 'p-value', 'p-value'], perm_beat: ['نسخه‌های تصادفی بهتر یا مساوی', 'وەشانی هەڕەمەکیی باشتر یان یەکسان', 'random copies as good or better'],
    perm_yes: ['لبهٔ معنادار: کمتر از ۵٪ نسخه‌های تصادفی به این نتیجه رسیدند.', 'لێواری واتادار: کەمتر لە ٥٪ی وەشانە هەڕەمەکییەکان گەیشتنە ئەم ئەنجامە.', 'Significant edge: fewer than 5% of random copies did this well.'],
    perm_mid: ['شواهد ضعیف: بین ۵ تا ۱۰ درصد نسخه‌های تصادفی هم به این نتیجه رسیدند.', 'بەڵگەی لاواز: ٥ تا ١٠٪ی وەشانە هەڕەمەکییەکانیش گەیشتنە ئەم ئەنجامە.', 'Weak evidence: 5–10% of random copies did as well.'],
    perm_no: ['لبه‌ای دیده نمی‌شود: نتیجه از شانس قابل تشخیص نیست.', 'لێوارێک نابینرێت: ئەنجامەکە لە هەڵکەوت جیا ناکرێتەوە.', 'No edge: the result cannot be told apart from luck.'],
    wf: ['واک-فوروارد: روی داده‌های دیده‌نشده هم کار می‌کند؟', 'واک-فۆروارد: لەسەر داتای نەبینراویش کار دەکات؟', 'Walk-forward: does it hold on unseen data?'],
    wf_lead: ['دوره به بخش‌های پشت‌سرهم تقسیم می‌شود. اگر پارامتری برای بهینه‌سازی انتخاب کنید، بهترین مقدار فقط روی گذشته انتخاب و روی بخش بعدی سنجیده می‌شود.',
      'ماوەکە دابەش دەکرێت بۆ بەشی یەک لە دوای یەک. ئەگەر پارامەتەرێک بۆ باشترکردن هەڵبژێریت، باشترین بەها تەنها لەسەر ڕابردوو هەڵدەبژێردرێت و لەسەر بەشی دواتر دەپێورێت.',
      'The period is cut into consecutive stretches. If you pick a parameter to optimise, its best value is chosen on the past only and judged on the next stretch.'],
    wf_par: ['پارامتر بهینه‌سازی', 'پارامەتەری باشترکردن', 'Parameter to optimise'], wf_none: ['بدون بهینه‌سازی', 'بێ باشترکردن', 'none'],
    wf_min: ['از', 'لە', 'from'], wf_max: ['تا', 'تا', 'to'], wf_step: ['گام', 'هەنگاو', 'step'], wf_run: ['اجرای واک-فوروارد', 'دەستپێکردنی واک-فۆروارد', 'Run walk-forward'],
    th_wf: ['بخش|دوره|مقدار انتخاب‌شده|بازده آموزش|بازده آزمون|خرید و نگهداری|معامله', 'بەش|ماوە|بەهای هەڵبژێردراو|قازانجی ڕاهێنان|قازانجی تاقیکردنەوە|کڕین و ڕاگرتن|مامەڵە',
      'Fold|Period|Chosen value|In-sample|Out-of-sample|Buy & hold|Trades'],
    wf_pos: ['بخش‌های مثبت', 'بەشە ئەرێنییەکان', 'Positive stretches'], wf_beat: ['بخش‌های بهتر از خرید و نگهداری', 'بەشەکانی باشتر لە کڕین و ڕاگرتن', 'Stretches beating buy & hold'],
    wf_eff: ['کارایی واک-فوروارد', 'کارایی واک-فۆروارد', 'Walk-forward efficiency'], wf_oos: ['بازده کل خارج از نمونه', 'قازانجی گشتیی دەرەوەی نموونە', 'Total out-of-sample return'],
    wf_effnote: ['نسبت بازده سالانهٔ آزمون به آموزش؛ بالای ۵۰٪ یعنی بیشتر لبه روی دادهٔ دیده‌نشده هم ماند.', 'ڕێژەی قازانجی ساڵانەی تاقیکردنەوە بۆ ڕاهێنان؛ سەرووی ٥٠٪ واتە زۆربەی لێوار مایەوە.',
      'Annualised out-of-sample ÷ in-sample; above 50% means most of the edge survived on unseen data.'],
    busy: ['در حال محاسبه…', 'حیساب دەکرێت…', 'Computing…'],
    err_sym: ['این ارز در بایننس اسپات (جفت USDT) پیدا نشد.', 'ئەم دراوە لە بایننس سپۆت (USDT) نەدۆزرایەوە.', 'This coin was not found on Binance spot (USDT pair).'],
    err_net: ['اتصال به بایننس برقرار نشد؛ دوباره امتحان کنید.', 'پەیوەندی بە بایننس نەکرا؛ دووبارە هەوڵ بدەرەوە.', 'Could not reach Binance; please try again.'],
    err_few: ['داده برای این بازه کافی نیست.', 'داتا بۆ ئەم ماوەیە بەس نییە.', 'Not enough data for this period.'],
    no_tr: ['در این دوره هیچ معامله‌ای انجام نشد؛ شرط‌ها را بازتر کنید.', 'لەم ماوەیەدا هیچ مامەڵەیەک نەکرا؛ مەرجەکان فراوانتر بکە.', 'No trades in this period; loosen the rules.'],
    warn_opt: ['مقدار هر بخش فقط با داده‌های قبل از آن انتخاب شد؛ «بازده کل خارج از نمونه» برآورد صادقانهٔ عملکرد این روش بهینه‌سازی است. اگر همین پارامتر را روی کل دوره بهینه کنید، نتیجهٔ بک‌تست اصلی خوش‌بینانه می‌شود.',
      'بەهای هەر بەشێک تەنها بە داتای پێش خۆی هەڵبژێردرا؛ «قازانجی گشتیی دەرەوەی نموونە» خەمڵاندنی ڕاستگۆیانەیە. ئەگەر هەمان پارامەتەر لەسەر هەموو ماوەکە باشتر بکەیت، باکتێستی سەرەکی گەشبینانە دەبێت.',
      'Each stretch\'s value was chosen on earlier data only, so the total out-of-sample return is the honest estimate of this tuning method. Tuning the same parameter on the whole period would make the main back-test optimistic.'],
    ctxnote: ['ترس و طمع از ۲۰۱۸، رژیم BTC از ۲۰۱۹ و فاندینگ فقط برای BTC و ETH و حدود چند ماه اخیر موجود است؛ در روزهای بدون داده آن شرط برقرار نیست.',
      'ترس و تەماح لە ٢٠١٨ەوە، دۆخی BTC لە ٢٠١٩ەوە، فاندینگ تەنها بۆ BTC و ETH و چەند مانگی دوایی هەیە؛ لە ڕۆژانی بێ داتا ئەو مەرجە ڕاست نییە.',
      'Fear & Greed exists from 2018, the BTC regime from 2019 and funding only for BTC and ETH over recent months; on days without data that condition is false.'],
    bars: ['کندل', 'مۆم', 'bars'],
  };
  function lang() { var l = (document.documentElement.getAttribute('lang') || 'fa').toLowerCase(); return l.indexOf('ckb') === 0 ? 'ckb' : l.indexOf('en') === 0 ? 'en' : 'fa'; }
  function t(k) { var v = S[k]; if (!v) return k; return v[{ fa: 0, ckb: 1, en: 2 }[lang()]]; }
  var DIG = { fa: '۰۱۲۳۴۵۶۷۸۹', ckb: '٠١٢٣٤٥٦٧٨٩' };
  function loc(s) { var d = DIG[lang()]; s = String(s); if (!d) return s; return s.replace(/[0-9]/g, function (c) { return d[+c]; }).replace(/\./g, '٫').replace(/,/g, '٬').replace(/-/g, '−'); }
  function nf(x, dec, sign) { if (x == null || !isFinite(x)) return '—'; if (+Math.abs(x).toFixed(dec || 0) === 0) x = 0; var s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); return loc((x < 0 ? '-' : sign && x > 0 ? '+' : '') + s); }
  function pc(x, dec, sign) { return x == null || !isFinite(x) ? '—' : nf(x * 100, dec == null ? 1 : dec, sign) + (lang() === 'en' ? '%' : '٪'); }
  function g2j(gy, gm, gd) { // Gregorian -> Jalali
    var g = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], gy2 = gm > 2 ? gy + 1 : gy;
    var days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g[gm - 1];
    var jy = -1595 + 33 * Math.floor(days / 12053); days %= 12053; jy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30), jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
    return [jy, jm, jd];
  }
  function fdate(ms, withTime) {
    var d = new Date(ms), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, dd = d.getUTCDate();
    var hm = withTime ? ' ' + String(d.getUTCHours()).padStart(2, '0') + ':00' : '';
    if (lang() === 'fa') { var j = g2j(y, m, dd); return loc(j[0] + '/' + String(j[1]).padStart(2, '0') + '/' + String(j[2]).padStart(2, '0') + hm); }
    return loc(y + '-' + String(m).padStart(2, '0') + '-' + String(dd).padStart(2, '0') + hm);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ------------------------------------------------------------------ operands */
  // k: kind; p: needs a period; ctx: daily context series; cat: categorical (regime)
  var KINDS = {
    num: {}, close: {}, open: {}, sma: { p: 50 }, ema: { p: 20 }, rsi: { p: 14 }, ret: { p: 10 }, dist: { p: 200 }, vr: { p: 20 },
    atr: { p: 14 }, hh: { p: 20 }, ll: { p: 20 }, fng: { ctx: 1 }, fund: { ctx: 1 }, hmm: { ctx: 1, cat: 1 }, rule: { ctx: 1, cat: 1 }
  };
  var LEFT = ['close', 'open', 'sma', 'ema', 'rsi', 'ret', 'dist', 'vr', 'atr', 'fng', 'fund', 'hmm', 'rule'];
  var RIGHT = ['num', 'close', 'open', 'sma', 'ema', 'rsi', 'ret', 'dist', 'vr', 'atr', 'hh', 'll', 'fng', 'fund'];

  /* ------------------------------------------------------------------ indicators */
  function sma(a, p) { var o = new Array(a.length).fill(NaN), s = 0; for (var i = 0; i < a.length; i++) { s += a[i]; if (i >= p) s -= a[i - p]; if (i >= p - 1) o[i] = s / p; } return o; }
  function ema(a, p) { var o = new Array(a.length).fill(NaN), k = 2 / (p + 1), e = NaN, s = 0; for (var i = 0; i < a.length; i++) { if (i < p) { s += a[i]; if (i === p - 1) { e = s / p; o[i] = e; } } else { e = a[i] * k + e * (1 - k); o[i] = e; } } return o; }
  function rsi(c, p) {
    var o = new Array(c.length).fill(NaN), ag = 0, al = 0;
    for (var i = 1; i < c.length; i++) {
      var d = c[i] - c[i - 1], g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
      if (i <= p) { ag += g; al += l; if (i === p) { ag /= p; al /= p; o[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } }
      else { ag = (ag * (p - 1) + g) / p; al = (al * (p - 1) + l) / p; o[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); }
    }
    return o;
  }
  function atrp(D, p) {
    var n = D.c.length, o = new Array(n).fill(NaN), a = 0;
    for (var i = 1; i < n; i++) {
      var tr = Math.max(D.h[i] - D.l[i], Math.abs(D.h[i] - D.c[i - 1]), Math.abs(D.l[i] - D.c[i - 1]));
      if (i <= p) { a += tr; if (i === p) { a /= p; o[i] = a / D.c[i] * 100; } } else { a = (a * (p - 1) + tr) / p; o[i] = a / D.c[i] * 100; }
    }
    return o;
  }
  function series(D, op, cache) {
    var key = op.k + ':' + (op.p || '') + ':' + (op.k === 'num' ? op.v : '');
    if (cache[key]) return cache[key];
    var n = D.c.length, o, i, p = Math.max(1, Math.round(+op.p || 1));
    switch (op.k) {
      case 'num': o = new Array(n).fill(+op.v); break;
      case 'close': o = D.c; break;
      case 'open': o = D.o; break;
      case 'sma': o = sma(D.c, p); break;
      case 'ema': o = ema(D.c, p); break;
      case 'rsi': o = rsi(D.c, p); break;
      case 'ret': o = D.c.map(function (x, j) { return j >= p ? (x / D.c[j - p] - 1) * 100 : NaN; }); break;
      case 'dist': var m = sma(D.c, p); o = D.c.map(function (x, j) { return (x / m[j] - 1) * 100; }); break;
      case 'vr': var mv = sma(D.v, p); o = D.v.map(function (x, j) { return j >= p ? x / mv[j - 1] : NaN; }); break;
      case 'atr': o = atrp(D, p); break;
      case 'hh': o = new Array(n).fill(NaN); for (i = p; i < n; i++) { var mx = -Infinity; for (var j = i - p; j < i; j++) if (D.h[j] > mx) mx = D.h[j]; o[i] = mx; } break;
      case 'll': o = new Array(n).fill(NaN); for (i = p; i < n; i++) { var mn = Infinity; for (var j2 = i - p; j2 < i; j2++) if (D.l[j2] < mn) mn = D.l[j2]; o[i] = mn; } break;
      default: o = D.ctx[op.k] || new Array(n).fill(NaN);
    }
    cache[key] = o;
    return o;
  }
  function condFn(D, c, cache) {
    var A = series(D, c.a, cache);
    if (KINDS[c.a.k].cat) { var want = REG.indexOf(c.b.v); return function (i) { var x = A[i]; if (x == null || isNaN(x)) return false; return c.op === 'is' ? x === want : x !== want; }; }
    var B = series(D, c.b, cache);
    switch (c.op) {
      case '<': return function (i) { return A[i] < B[i]; };
      case '>': return function (i) { return A[i] > B[i]; };
      case 'xa': return function (i) { return i > 0 && A[i - 1] <= B[i - 1] && A[i] > B[i]; };
      case 'xb': return function (i) { return i > 0 && A[i - 1] >= B[i - 1] && A[i] < B[i]; };
    }
    return function () { return false; };
  }
  function ruleFn(D, conds, mode, cache) {
    var fs = conds.map(function (c) { return condFn(D, c, cache); });
    if (!fs.length) return function () { return false; };
    return mode === 'any' ? function (i) { for (var k = 0; k < fs.length; k++) if (fs[k](i)) return true; return false; }
      : function (i) { for (var k = 0; k < fs.length; k++) if (!fs[k](i)) return false; return true; };
  }

  /* ------------------------------------------------------------------ back-test engine */
  // a, b: bar-index range allowed to trade [a, b); positions are closed at b's open (or at the last close)
  function backtest(D, st, a, b, wantEquity) {
    var n = D.c.length; a = a == null ? 0 : a; b = b == null ? n : b;
    var cache = {}, enter = ruleFn(D, st.entry, st.entryMode, cache), exitR = st.exit.length ? ruleFn(D, st.exit, st.exitMode, cache) : null;
    var cost = (+st.fee + +st.slip) / 100, sl = +st.sl / 100, tp = +st.tp / 100, hold = Math.round(+st.hold) || 0, sh = st.side === 'short';
    var trades = [], pos = null, pend = 0, eq = 1, eqs = wantEquity ? [] : null, inBars = 0, peak = 1, mdd = 0, rets = [];
    var prevMark = 1;
    function close(i, px, why) {
      var r = sh ? (pos.px * (1 - cost) - px * (1 + cost)) / (pos.px * (1 - cost)) : (px * (1 - cost)) / (pos.px * (1 + cost)) - 1;
      eq *= 1 + r; trades.push({ ei: pos.i, xi: i, ep: pos.px, xp: px, r: r, why: why }); pos = null;
    }
    for (var i = Math.max(1, a); i < b; i++) {
      // 1) orders decided at the previous close fill at this open
      if (pend === 1 && !pos) { pos = { i: i, px: D.o[i] }; }
      else if (pend === -1 && pos) { close(i, D.o[i], pos.why || 'sig'); }
      pend = 0;
      // 2) inside the bar: stop first (worse case), then target; a gap through a level fills at the open
      if (pos) {
        var hit = null, px = 0;
        if (sl > 0) {
          var sp = sh ? pos.px * (1 + sl) : pos.px * (1 - sl);
          if (sh ? D.h[i] >= sp : D.l[i] <= sp) { hit = 'sl'; px = sh ? Math.max(sp, D.o[i]) : Math.min(sp, D.o[i]); if (i === pos.i) px = sp; }
        }
        if (!hit && tp > 0) {
          var tpp = sh ? pos.px * (1 - tp) : pos.px * (1 + tp);
          if (sh ? D.l[i] <= tpp : D.h[i] >= tpp) { hit = 'tp'; px = sh ? Math.min(tpp, D.o[i]) : Math.max(tpp, D.o[i]); if (i === pos.i) px = tpp; }
        }
        if (hit) close(i, px, hit);
      }
      // 3) at the close: signals for the next open
      if (pos) {
        inBars++;
        if (exitR && exitR(i)) { pend = -1; pos.why = 'sig'; }
        else if (hold > 0 && i - pos.i + 1 >= hold) { pend = -1; pos.why = 'time'; }
      } else if (enter(i) && i < b - 1) pend = 1;
      // mark-to-market equity
      var mark = eq;
      if (pos) { var u = sh ? (pos.px * (1 - cost) - D.c[i] * (1 + cost)) / (pos.px * (1 - cost)) : (D.c[i] * (1 - cost)) / (pos.px * (1 + cost)) - 1; mark = eq * (1 + u); }
      if (mark > peak) peak = mark; var dd = mark / peak - 1; if (dd < mdd) mdd = dd;
      rets.push(mark / prevMark - 1); prevMark = mark;
      if (eqs) eqs.push([D.t[i], mark]);
    }
    if (pos) { close(b - 1, D.c[b - 1], 'end'); if (eqs && eqs.length) eqs[eqs.length - 1][1] = eq; }
    return { trades: trades, eq: eq, mdd: mdd, inBars: inBars, bars: Math.max(1, b - Math.max(1, a)), rets: rets, curve: eqs };
  }
  function stats(D, R, a, b) {
    a = Math.max(1, a || 0); b = b || D.c.length;
    var tr = R.trades, w = tr.filter(function (x) { return x.r > 0; }), l = tr.filter(function (x) { return x.r <= 0; });
    var gw = w.reduce(function (s, x) { return s + x.r; }, 0), gl = -l.reduce(function (s, x) { return s + x.r; }, 0);
    var yrs = (D.t[b - 1] - D.t[a]) / 31557600000 || 1e-9;
    var m = R.rets.reduce(function (s, x) { return s + x; }, 0) / (R.rets.length || 1);
    var sd = Math.sqrt(R.rets.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / Math.max(1, R.rets.length - 1));
    var perYear = R.rets.length / yrs;
    var dsd = Math.sqrt(R.rets.reduce(function (s, x) { return s + (x < 0 ? x * x : 0); }, 0) / Math.max(1, R.rets.length));   // downside deviation (target 0)
    // buy & hold over the same bars (no costs)
    var bh = D.c[b - 1] / D.o[a] - 1, pk = D.o[a], bdd = 0;
    for (var i = a; i < b; i++) { if (D.c[i] > pk) pk = D.c[i]; var dd = D.c[i] / pk - 1; if (dd < bdd) bdd = dd; }
    return {
      ret: R.eq - 1, cagr: R.eq > 0 ? Math.pow(R.eq, 1 / yrs) - 1 : -1, mdd: R.mdd, n: tr.length, win: tr.length ? w.length / tr.length : null,
      pf: gl > 0 ? gw / gl : (gw > 0 ? Infinity : null), avg: tr.length ? tr.reduce(function (s, x) { return s + x.r; }, 0) / tr.length : null,
      exp: R.inBars / R.bars, sharpe: sd > 0 ? m / sd * Math.sqrt(perYear) : null, sortino: dsd > 0 ? m / dsd * Math.sqrt(perYear) : null, calmar: R.mdd < 0 && R.eq > 0 ? (Math.pow(R.eq, 1 / yrs) - 1) / -R.mdd : null, bh: bh, bhdd: bdd, yrs: yrs
    };
  }

  /* ------------------------------------------------------------------ permutation (Masters-style) */
  function rng(seed) { var s = seed >>> 0; return function () { s += 0x6D2B79F5; var x = s; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(a, r) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function permute(D, start, r) {
    // bars before `start` are kept (warm-up); after it, overnight gaps and intrabar shapes are shuffled separately
    var n = D.c.length, gap = [], body = [], i;
    for (i = start; i < n; i++) gap.push(Math.log(D.o[i] / D.c[i - 1]));
    for (i = start; i < n; i++) body.push([Math.log(D.h[i] / D.o[i]), Math.log(D.l[i] / D.o[i]), Math.log(D.c[i] / D.o[i]), D.v[i]]);
    shuffle(gap, r); shuffle(body, r);
    var P = { t: D.t, o: D.o.slice(), h: D.h.slice(), l: D.l.slice(), c: D.c.slice(), v: D.v.slice(), ctx: D.ctx };
    for (i = start; i < n; i++) {
      var k = i - start, o = P.c[i - 1] * Math.exp(gap[k]), bd = body[k];
      P.o[i] = o; P.h[i] = o * Math.exp(bd[0]); P.l[i] = o * Math.exp(bd[1]); P.c[i] = o * Math.exp(bd[2]); P.v[i] = bd[3];
    }
    return P;
  }

  /* ------------------------------------------------------------------ data */
  var KL = {}, CTX = null;
  function fetchJSON(u) { return fetch(u).then(function (r) { if (!r.ok) { var e = new Error('http ' + r.status); e.status = r.status; throw e; } return r.json(); }); }
  function klines(sym, tf, from) {
    var key = sym + tf + from; if (KL[key]) return Promise.resolve(KL[key]);
    var out = [], start = from;
    function step() {
      return fetchJSON(API + '?symbol=' + sym + 'USDT&interval=' + tf + '&limit=1000&startTime=' + start).then(function (rows) {
        rows.forEach(function (k) { out.push(k); });
        if (rows.length === 1000) { start = rows[rows.length - 1][0] + 1; return step(); }
      });
    }
    return step().then(function () {
      var now = Date.now(), D = { t: [], o: [], h: [], l: [], c: [], v: [] };
      out.forEach(function (k) { if (k[6] < now) { D.t.push(k[0]); D.o.push(+k[1]); D.h.push(+k[2]); D.l.push(+k[3]); D.c.push(+k[4]); D.v.push(+k[7]); } });
      KL[key] = D; return D;
    });
  }
  function context() { if (CTX) return Promise.resolve(CTX); return fetchJSON('/data/lab_context.json').then(function (j) { CTX = j; return j; }).catch(function () { CTX = {}; return CTX; }); }
  function attachCtx(D, coin) {
    var d0 = CTX && CTX.from ? Date.parse(CTX.from + 'T00:00:00Z') : 0, n = D.t.length;
    function col(arr) { var o = new Array(n); for (var i = 0; i < n; i++) { var k = Math.floor((D.t[i] - d0) / 86400000); var v = arr && k >= 0 && k < arr.length ? arr[k] : null; o[i] = v == null ? NaN : v; } return o; }
    D.ctx = { fng: col(CTX.fng), hmm: col(CTX.hmm), rule: col(CTX.rule), fund: col(((CTX.fund || {})[coin]) || null) };
    return D;
  }

  /* ------------------------------------------------------------------ strategy state */
  var PRESETS = [
    { id: 'dip', n: ['خرید اصلاح در روند صعودی', 'کڕینی داکەوتن لە ڕەوتی بەرزدا', 'Buy the dip in an uptrend'],
      s: { coin: 'BTC', tf: '1d', from: '2018-01-01', side: 'long', entryMode: 'all', exitMode: 'any', sl: 10, tp: 0, hold: 0,
        entry: [{ a: { k: 'rsi', p: 14 }, op: '<', b: { k: 'num', v: 35 } }, { a: { k: 'close' }, op: '>', b: { k: 'sma', p: 200 } }],
        exit: [{ a: { k: 'rsi', p: 14 }, op: '>', b: { k: 'num', v: 60 } }] } },
    { id: 'gx', n: ['تقاطع طلایی ۵۰/۲۰۰', 'یەکتربڕینی زێڕین ٥٠/٢٠٠', 'Golden cross 50/200'],
      s: { coin: 'BTC', tf: '1d', from: '2018-01-01', side: 'long', entryMode: 'all', exitMode: 'any', sl: 0, tp: 0, hold: 0,
        entry: [{ a: { k: 'sma', p: 50 }, op: 'xa', b: { k: 'sma', p: 200 } }], exit: [{ a: { k: 'sma', p: 50 }, op: 'xb', b: { k: 'sma', p: 200 } }] } },
    { id: 'bo', n: ['شکست سقف ۲۰ روزه با حجم', 'شکاندنی لوتکەی ٢٠ ڕۆژە بە قەبارە', '20-day breakout with volume'],
      s: { coin: 'ETH', tf: '1d', from: '2019-01-01', side: 'long', entryMode: 'all', exitMode: 'any', sl: 8, tp: 0, hold: 0,
        entry: [{ a: { k: 'close' }, op: '>', b: { k: 'hh', p: 20 } }, { a: { k: 'vr', p: 20 }, op: '>', b: { k: 'num', v: 1.5 } }],
        exit: [{ a: { k: 'close' }, op: 'xb', b: { k: 'sma', p: 20 } }] } },
    { id: 'fear', n: ['خرید در ترس شدید', 'کڕین لە ترسی زۆردا', 'Buy extreme fear'],
      s: { coin: 'BTC', tf: '1d', from: '2018-03-01', side: 'long', entryMode: 'all', exitMode: 'any', sl: 0, tp: 0, hold: 0,
        entry: [{ a: { k: 'fng' }, op: '<', b: { k: 'num', v: 20 } }], exit: [{ a: { k: 'fng' }, op: '>', b: { k: 'num', v: 65 } }] } },
    { id: 'reg', n: ['روند فقط در رژیم صعودی', 'ڕەوت تەنها لە دۆخی بەرزبوونەوەدا', 'Trend only in a bull regime'],
      s: { coin: 'SOL', tf: '1d', from: '2021-01-01', side: 'long', entryMode: 'all', exitMode: 'any', sl: 12, tp: 0, hold: 0,
        entry: [{ a: { k: 'close' }, op: '>', b: { k: 'ema', p: 50 } }, { a: { k: 'rule' }, op: 'is', b: { k: 'reg', v: 'bull' } }],
        exit: [{ a: { k: 'close' }, op: 'xb', b: { k: 'ema', p: 50 } }] } },
    { id: 'rev', n: ['شورت اشباع خرید ۴ ساعته', 'شۆرتی زیادە کڕینی ٤ کاتژمێری', '4h overbought short'],
      s: { coin: 'BTC', tf: '4h', from: '2022-01-01', side: 'short', entryMode: 'all', exitMode: 'any', sl: 4, tp: 6, hold: 30,
        entry: [{ a: { k: 'rsi', p: 14 }, op: '>', b: { k: 'num', v: 78 } }], exit: [{ a: { k: 'rsi', p: 14 }, op: '<', b: { k: 'num', v: 50 } }] } }
  ];
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  var ST = clone(PRESETS[0].s); ST.fee = 0.1; ST.slip = 0.05;
  try { if (location.hash.length > 3) { var hs = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1))))); if (hs && hs.entry) ST = Object.assign(ST, hs); } } catch (e) { }
  var OPT = { par: '', min: 20, max: 40, step: 5 };
  var LAST = null, BUSY = false;

  /* ------------------------------------------------------------------ UI */
  function sel(cls, opts, val, data) {
    return '<select class="' + cls + '"' + (data || '') + '>' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }
  function inp(cls, val, data, w) { return '<input class="' + cls + '" type="number" step="any" value="' + esc(val) + '"' + (data || '') + ' style="width:' + (w || 72) + 'px">'; }
  function operandHTML(op, side, path) {
    var list = side === 'a' ? LEFT : RIGHT, kind = KINDS[op.k] || {};
    var h = sel('sl-k', list.map(function (k) { return [k, t(k)]; }), op.k, ' data-p="' + path + '"');
    if (kind.p) h += inp('sl-p', op.p, ' data-p="' + path + '" title="n"', 62);
    if (op.k === 'num') h += inp('sl-v', op.v, ' data-p="' + path + '"', 84);
    return h;
  }
  function condHTML(c, grp, i) {
    var p = grp + '.' + i, cat = KINDS[c.a.k] && KINDS[c.a.k].cat, h = '<div class="sl-cond">' + operandHTML(c.a, 'a', p + '.a');
    if (cat) {
      h += sel('sl-op', [['is', t('is')], ['isnt', t('isnt')]], c.op, ' data-p="' + p + '"');
      h += sel('sl-reg', REG.map(function (r) { return [r, t(r)]; }), c.b.v, ' data-p="' + p + '.b"');
    } else {
      h += sel('sl-op', [['<', '<'], ['>', '>'], ['xa', t('xa')], ['xb', t('xb')]], c.op, ' data-p="' + p + '"');
      h += operandHTML(c.b, 'b', p + '.b');
    }
    return h + '<button type="button" class="sl-x" data-del="' + p + '" aria-label="' + esc(t('del')) + '">✕</button></div>';
  }
  function numParams() {
    // every numeric value a rule uses, for the walk-forward optimiser
    var out = [['', t('wf_none')]];
    ['entry', 'exit'].forEach(function (g) {
      ST[g].forEach(function (c, i) {
        [['a', c.a], ['b', c.b]].forEach(function (x) {
          if (!x[1]) return; var lab = t(g) + ' ' + loc(i + 1) + ': ';
          if (x[1].k === 'num') out.push([g + '.' + i + '.' + x[0] + '.v', lab + t('num')]);
          else if (KINDS[x[1].k] && KINDS[x[1].k].p) out.push([g + '.' + i + '.' + x[0] + '.p', lab + t(x[1].k) + ' (n)']);
        });
      });
    });
    out.push(['sl', t('sl')], ['tp', t('tp')], ['hold', t('hold')]);
    return out;
  }
  function render() {
    var L = lang(); root.dir = L === 'en' ? 'ltr' : 'rtl'; root.lang = L;
    var h = '<div class="rc-card sl-form">';
    h += '<div class="sl-pre"><b>' + t('presets') + ':</b> ' + PRESETS.map(function (p) { return '<button type="button" class="rc-btn2" data-pre="' + p.id + '">' + esc(p.n[{ fa: 0, ckb: 1, en: 2 }[L]]) + '</button>'; }).join(' ') + '</div>';
    h += '<div class="sl-row">' +
      '<label>' + t('coin') + '<input class="sl-coin" list="sl-coins" value="' + esc(ST.coin) + '" style="width:96px" dir="ltr"><datalist id="sl-coins">' + COINS.map(function (c) { return '<option value="' + c + '">'; }).join('') + '</datalist></label>' +
      '<label>' + t('tf') + sel('sl-tf', [['1d', '1D'], ['4h', '4H'], ['1w', '1W']], ST.tf) + '</label>' +
      '<label>' + t('from') + '<input class="sl-from" type="date" value="' + esc(ST.from) + '" dir="ltr"></label>' +
      '<label>' + t('side') + sel('sl-side', [['long', t('long')], ['short', t('short')]], ST.side) + '</label></div>';
    ['entry', 'exit'].forEach(function (g) {
      h += '<h3>' + t(g) + ' ' + sel('sl-mode', [['all', t('all')], ['any', t('any')]], ST[g + 'Mode'], ' data-g="' + g + '"') + '</h3>';
      h += ST[g].map(function (c, i) { return condHTML(c, g, i); }).join('');
      h += '<button type="button" class="rc-btn2" data-add="' + g + '">' + t('add') + '</button>';
    });
    h += '<h3>' + t('risk') + '</h3><div class="sl-row">' +
      ['sl', 'tp', 'hold', 'fee', 'slip'].map(function (k) { return '<label>' + t(k) + inp('sl-r', ST[k], ' data-r="' + k + '"') + '</label>'; }).join('') + '</div>';
    h += '<p class="note">' + t('ctxnote') + '</p>';
    h += '<div class="sl-row"><button type="button" class="sl-run">' + t('run') + '</button><button type="button" class="rc-btn2 sl-share">' + t('share') + '</button><span class="sl-msg mut"></span></div></div>';
    h += '<div class="sl-out"></div>';
    root.innerHTML = h;
    if (LAST) showResult(LAST);
  }
  function getPath(path) { var o = ST, ps = path.split('.'); for (var i = 0; i < ps.length; i++) o = o[ps[i]]; return o; }
  function setPath(obj, path, val) { var ps = path.split('.'), o = obj; for (var i = 0; i < ps.length - 1; i++) o = o[ps[i]]; o[ps[ps.length - 1]] = val; }
  root.addEventListener('change', function (e) {
    var x = e.target, p = x.getAttribute('data-p');
    if (x.classList.contains('sl-k')) {
      var op = getPath(p), k = x.value, d = KINDS[k] || {};
      op.k = k; if (d.p && !op.p) op.p = d.p; if (k === 'num' && op.v == null) op.v = 0;
      if (/\.a$/.test(p)) { var c = getPath(p.slice(0, -2)); if (d.cat) { c.op = 'is'; c.b = { k: 'reg', v: 'bull' }; } else if (c.b.k === 'reg') { c.op = '>'; c.b = { k: 'num', v: 0 }; } }
      render(); return;
    }
    if (x.classList.contains('sl-p')) getPath(p).p = Math.max(1, Math.round(+x.value || 1));
    else if (x.classList.contains('sl-v')) getPath(p).v = +x.value;
    else if (x.classList.contains('sl-op')) getPath(p).op = x.value;
    else if (x.classList.contains('sl-reg')) getPath(p).v = x.value;
    else if (x.classList.contains('sl-mode')) ST[x.getAttribute('data-g') + 'Mode'] = x.value;
    else if (x.classList.contains('sl-r')) ST[x.getAttribute('data-r')] = Math.max(0, +x.value || 0);
    else if (x.classList.contains('sl-coin')) ST.coin = x.value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/USDT$/, '');
    else if (x.classList.contains('sl-tf')) ST.tf = x.value;
    else if (x.classList.contains('sl-from')) ST.from = x.value;
    else if (x.classList.contains('sl-side')) ST.side = x.value;
    else if (x.classList.contains('wf-par')) { OPT.par = x.value; }
    else if (x.classList.contains('wf-n')) { OPT[x.getAttribute('data-o')] = +x.value; }
  });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-pre')) { var pr = PRESETS.filter(function (p) { return p.id === b.getAttribute('data-pre'); })[0]; ST = Object.assign(clone(pr.s), { fee: ST.fee, slip: ST.slip }); LAST = null; OPT.par = ''; render(); return; }
    if (b.hasAttribute('data-add')) { ST[b.getAttribute('data-add')].push({ a: { k: 'rsi', p: 14 }, op: '<', b: { k: 'num', v: 30 } }); render(); return; }
    if (b.hasAttribute('data-del')) { var ps = b.getAttribute('data-del').split('.'); ST[ps[0]].splice(+ps[1], 1); render(); return; }
    if (b.classList.contains('pm-run')) { runPerm(+root.querySelector('.pm-n').value || 200); return; }
    if (b.classList.contains('wf-run')) { runWF(); return; }
    if (b.classList.contains('sl-run')) { run(); return; }
    if (b.classList.contains('sl-share')) {
      var u = location.origin + location.pathname + '#' + btoa(unescape(encodeURIComponent(JSON.stringify(ST))));
      try { history.replaceState(null, '', u); } catch (e2) { }
      var done = function () { msg(t('copied')); };
      if (navigator.clipboard) navigator.clipboard.writeText(u).then(done, done); else done();
      return;
    }
  });
  function msg(s) { var m = root.querySelector('.sl-msg'); if (m) m.textContent = s || ''; }
  window.addEventListener('ek-lang', function () { setTimeout(render, 0); });
  new MutationObserver(function () { if (root.lang !== lang()) render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  /* ------------------------------------------------------------------ run */
  function load() {
    var from = Date.parse((ST.from || '2018-01-01') + 'T00:00:00Z'), warm = 250 * { '1d': 86400000, '4h': 14400000, '1w': 604800000 }[ST.tf];
    return Promise.all([klines(ST.coin, ST.tf, Math.max(Date.parse('2017-08-01T00:00:00Z'), from - warm)), context()]).then(function (r) {
      var D = attachCtx(r[0], ST.coin), a = 0; while (a < D.t.length && D.t[a] < from) a++;
      return { D: D, a: a };
    });
  }
  function run() {
    if (BUSY) return; BUSY = true; msg(t('load'));
    var snap = clone(ST);
    load().then(function (X) {
      if (X.D.c.length - X.a < 30) { msg(t('err_few')); return; }
      var R = backtest(X.D, snap, X.a, X.D.c.length, true), s = stats(X.D, R, X.a);
      LAST = { D: X.D, a: X.a, st: snap, R: R, s: s, perm: null, wf: null };
      msg(''); showResult(LAST);
      var out = root.querySelector('.sl-out'); if (out) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (e) { msg(e && e.status === 400 ? t('err_sym') : t('err_net')); }).then(function () { BUSY = false; });
  }
  function kpi(k, v, cls) { return '<div class="rc-kpi"><small>' + t(k) + '</small><b class="' + (cls || '') + '">' + v + '</b></div>'; }
  function cl(x) { return x > 0 ? 'up' : x < 0 ? 'down' : ''; }
  function showResult(X) {
    var out = root.querySelector('.sl-out'); if (!out) return;
    var s = X.s, R = X.R, D = X.D, wt = X.st.tf === '4h';
    var h = '<section class="rc-sec"><h2>' + t('res') + ' · <span dir="ltr">' + esc(X.st.coin) + 'USDT ' + esc(X.st.tf.toUpperCase()) + '</span></h2>';
    h += '<p class="mut">' + fdate(D.t[X.a]) + ' – ' + fdate(D.t[D.t.length - 1]) + ' · ' + nf(D.t.length - X.a) + ' ' + t('bars') + '</p>';
    if (!R.trades.length) h += '<p class="note">' + t('no_tr') + '</p>';
    h += '<div class="rc-kpis">' + kpi('k_ret', pc(s.ret, 1, true), cl(s.ret)) + kpi('k_cagr', pc(s.cagr, 1, true), cl(s.cagr)) + kpi('k_dd', pc(s.mdd, 1), 'down') +
      kpi('k_n', nf(s.n)) + kpi('k_win', pc(s.win, 1)) + kpi('k_pf', s.pf === Infinity ? '∞' : nf(s.pf, 2)) + kpi('k_avg', pc(s.avg, 2, true), cl(s.avg)) +
      kpi('k_exp', pc(s.exp, 0)) + kpi('k_sh', nf(s.sharpe, 2)) + kpi('k_so', nf(s.sortino, 2)) + kpi('k_ca', nf(s.calmar, 2)) + kpi('k_bh', pc(s.bh, 1, true), cl(s.bh)) + kpi('k_bhdd', pc(s.bhdd, 1), 'down') + '</div>';
    h += '<h3>' + t('eq') + '</h3><div class="rc-legend"><span><i style="background:#f59e0b"></i>' + t('strat') + '</span><span><i style="background:#64748b"></i>' + t('k_bh') + '</span></div><div id="sl-eq" class="rc-chart" style="height:300px"></div>';
    if (R.trades.length) {
      var cols = t('th_tr').split('|'), rows = R.trades.slice(-40).reverse().map(function (x) {
        return '<tr><td>' + fdate(D.t[x.ei], wt) + '</td><td>' + fdate(D.t[x.xi], wt) + '</td><td><span class="rc-num">' + nf(x.ep, x.ep < 1 ? 5 : 2) + '</span></td><td><span class="rc-num">' + nf(x.xp, x.xp < 1 ? 5 : 2) + '</span>' +
          '</td><td>' + nf(x.xi - x.ei + 1) + '</td><td class="' + cl(x.r) + '">' + pc(x.r, 2, true) + '</td><td>' + t({ sig: 'r_sig', sl: 'r_sl', tp: 'r_tp', time: 'r_time', end: 'r_end' }[x.why]) + '</td></tr>';
      });
      h += '<h3>' + t('trades') + '</h3><div class="rc-tbl"><table><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
    }
    h += '</section>';
    h += mcHTML(R.trades);
    // permutation
    h += '<section class="rc-sec"><h2>' + t('perm') + '</h2><p class="rc-lead">' + t('perm_lead') + '</p><div class="sl-row"><label>' + t('perm_n') +
      sel('pm-n', [['100', loc(100)], ['200', loc(200)], ['500', loc(500)]], X.permN || 200) + '</label><button type="button" class="sl-run pm-run"' + (R.trades.length ? '' : ' disabled') + '>' + t('perm_run') + '</button><span class="pm-msg mut"></span></div><div class="pm-out">' + (X.perm ? permHTML(X.perm) : '') + '</div></section>';
    // walk-forward
    h += '<section class="rc-sec"><h2>' + t('wf') + '</h2><p class="rc-lead">' + t('wf_lead') + '</p><div class="sl-row"><label>' + t('wf_par') +
      sel('wf-par', numParams(), OPT.par) + '</label><label>' + t('wf_min') + inp('wf-n', OPT.min, ' data-o="min"', 70) + '</label><label>' + t('wf_max') + inp('wf-n', OPT.max, ' data-o="max"', 70) +
      '</label><label>' + t('wf_step') + inp('wf-n', OPT.step, ' data-o="step"', 64) + '</label><button type="button" class="sl-run wf-run">' + t('wf_run') + '</button><span class="wf-msg mut"></span></div><div class="wf-out">' + (X.wf ? wfHTML(X.wf) : '') + (X.wf && X.of !== undefined ? '<p class="note">' + t('warn_opt') + '</p><h3>' + t('of') + '</h3><p class="rc-lead">' + t('of_lead') + '</p>' + ofHTML(X.of) : '') + '</div></section>';
    out.innerHTML = h;
    drawEq(X);
  }
  function drawEq(X) {
    var el = document.getElementById('sl-eq'); if (!el || !window.LightweightCharts || !X.R.curve.length) return;
    var c = LightweightCharts.createChart(el, { height: 300, layout: { background: { color: 'transparent' }, textColor: '#9a9a94', fontFamily: 'Vazirmatn' },
      grid: { vertLines: { color: '#ffffff0d' }, horzLines: { color: '#ffffff0d' } }, rightPriceScale: { mode: 1, borderColor: '#ffffff1a' }, timeScale: { borderColor: '#ffffff1a' },
      localization: { priceFormatter: function (p) { return nf(p, p < 10 ? 2 : 0); } } });
    var D = X.D, base = D.o[Math.max(1, X.a)], sec = function (ms) { return Math.floor(ms / 1000); };
    var bh = c.addLineSeries({ color: '#64748b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    var st = c.addLineSeries({ color: '#f59e0b', lineWidth: 2, priceLineVisible: false });
    var s0 = Math.max(1, X.a);
    bh.setData(X.R.curve.map(function (p, i) { return { time: sec(p[0]), value: D.c[s0 + i] / base }; }));
    st.setData(X.R.curve.map(function (p) { return { time: sec(p[0]), value: p[1] }; }));
    c.timeScale().fitContent();
    new ResizeObserver(function () { c.applyOptions({ width: el.clientWidth }); }).observe(el);
  }

  /* ------------------------------------------------------------------ permutation runner */
  function permHTML(P) {
    var v = P.p < 0.05 ? 'perm_yes' : P.p < 0.10 ? 'perm_mid' : 'perm_no', col = P.p < 0.05 ? 'up' : P.p < 0.10 ? '' : 'down';
    // histogram of the random copies' log returns with the real result marked
    var xs = P.dist, lo = Math.min.apply(null, xs.concat([P.real])), hi = Math.max.apply(null, xs.concat([P.real])), nb = 30, w = (hi - lo) / nb || 1, bins = new Array(nb).fill(0);
    xs.forEach(function (x) { bins[Math.min(nb - 1, Math.floor((x - lo) / w))]++; });
    var mx = Math.max.apply(null, bins), W = 600, H = 120, bw = W / nb;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + (H + 18) + '" style="width:100%;max-width:640px;direction:ltr" role="img">' +
      bins.map(function (b, i) { var bh = b / mx * H; return '<rect x="' + (i * bw + 1) + '" y="' + (H - bh) + '" width="' + (bw - 2) + '" height="' + bh + '" fill="#64748b" rx="2"/>'; }).join('') +
      '<line x1="' + ((P.real - lo) / (hi - lo || 1) * W) + '" x2="' + ((P.real - lo) / (hi - lo || 1) * W) + '" y1="0" y2="' + H + '" stroke="#f59e0b" stroke-width="3"/>' +
      '<text x="' + Math.min(W - 60, Math.max(2, (P.real - lo) / (hi - lo || 1) * W + 4)) + '" y="' + (H + 14) + '" fill="#f59e0b" font-size="12">' + esc(t('strat')) + '</text></svg>';
    return '<div class="rc-kpis">' + kpi('perm_p', '<span class="' + col + '">' + nf(P.p, 3) + '</span>') + kpi('perm_beat', nf(P.beat) + ' / ' + nf(P.n)) + '</div><p class="' + col + '"><b>' + t(v) + '</b></p>' + svg;
  }
  /* Monte Carlo resampling of the realised trades: the spread of outcomes from trades like these */
  function monteCarlo(trades, N) {
    var r = rng(777), n = trades.length, fin = [], dds = [], loss = 0;
    for (var k = 0; k < N; k++) {
      var eq = 1, pk = 1, mdd = 0;
      for (var j = 0; j < n; j++) {
        eq *= 1 + trades[Math.floor(r() * n)].r;
        if (eq > pk) pk = eq; var dd = eq / pk - 1; if (dd < mdd) mdd = dd;
      }
      fin.push(eq - 1); dds.push(mdd); if (eq < 1) loss++;
    }
    fin.sort(function (x, y) { return x - y; }); dds.sort(function (x, y) { return y - x; });   // drawdowns: mildest first
    var q = function (a, p) { return a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))]; };
    return { n: N, p5: q(fin, 0.05), p50: q(fin, 0.5), p95: q(fin, 0.95), dd50: q(dds, 0.5), dd95: q(dds, 0.95), loss: loss / N };
  }
  function mcHTML(trades) {
    var h = '<section class="rc-sec"><h2>' + t('mc') + '</h2><p class="rc-lead">' + t('mc_lead') + '</p>';
    if (trades.length < 10) return h + '<p class="note">' + t('mc_few') + '</p></section>';
    var M = monteCarlo(trades, 2000);
    return h + '<div class="rc-kpis">' + kpi('mc_p5', pc(M.p5, 1, true), cl(M.p5)) + kpi('mc_p50', pc(M.p50, 1, true), cl(M.p50)) + kpi('mc_p95', pc(M.p95, 1, true), cl(M.p95)) +
      kpi('mc_dd50', pc(M.dd50, 1), 'down') + kpi('mc_dd95', pc(M.dd95, 1), 'down') + kpi('mc_loss', pc(M.loss, 1), M.loss > 0.2 ? 'down' : '') + '</div><p class="mut">' + t('mc_dd_note') + '</p></section>';
  }
  function runPerm(N) {
    if (!LAST || BUSY) return; BUSY = true; LAST.permN = N;
    var X = LAST, m = root.querySelector('.pm-msg'), r = rng(12345), dist = [], i = 0, beat = 0;
    var real = Math.log(Math.max(1e-9, X.R.eq));
    // shuffle only after the warm-up, so indicators start from real history
    var start = Math.max(X.a, 1);
    function chunk() {
      var t0 = performance.now();
      while (i < N && performance.now() - t0 < 40) {
        var P = permute(X.D, start, r), R = backtest(P, X.st, X.a, P.c.length, false), v = Math.log(Math.max(1e-9, R.eq));
        dist.push(v); if (v >= real) beat++; i++;
      }
      if (m) m.textContent = t('busy') + ' ' + loc(Math.round(i / N * 100)) + (lang() === 'en' ? '%' : '٪');
      if (i < N) return setTimeout(chunk, 0);
      X.perm = { n: N, beat: beat, p: (beat + 1) / (N + 1), real: real, dist: dist };
      if (m) m.textContent = '';
      var o = root.querySelector('.pm-out'); if (o) o.innerHTML = permHTML(X.perm);
      BUSY = false;
    }
    chunk();
  }

  /* ------------------------------------------------------------------ walk-forward runner */
  function wfHTML(W) {
    var cols = t('th_wf').split('|'), wt = LAST && LAST.st.tf === '4h';
    var rows = W.folds.map(function (f, i) {
      return '<tr><td>' + nf(i + 1) + '</td><td>' + fdate(f.t0, wt) + ' – ' + fdate(f.t1, wt) + '</td><td><span class="rc-num">' + (f.val == null ? '—' : nf(f.val, f.val % 1 ? 2 : 0)) + '</span>' +
        '</td><td class="' + cl(f.isr) + '">' + (f.isr == null ? '—' : pc(f.isr, 1, true)) + '</td><td class="' + cl(f.oos) + '"><b>' + pc(f.oos, 1, true) + '</b></td><td class="' + cl(f.bh) + '">' + pc(f.bh, 1, true) + '</td><td>' + nf(f.n) + '</td></tr>';
    });
    var h = '<div class="rc-kpis">' + kpi('wf_oos', pc(W.total, 1, true), cl(W.total)) + kpi('wf_pos', nf(W.pos) + ' / ' + nf(W.folds.length)) + kpi('wf_beat', nf(W.beat) + ' / ' + nf(W.folds.length));
    if (W.eff != null) h += kpi('wf_eff', pc(W.eff, 0), W.eff >= 0.5 ? 'up' : 'down');
    h += '</div><div class="rc-tbl"><table><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
    if (W.eff != null) h += '<p class="note">' + t('wf_effnote') + '</p>';
    return h;
  }
  /* ---------------- overfitting statistics for a parameter sweep (Bailey, Borwein, López de Prado & Zhu 2014; Bailey & López de Prado 2014) */
  function ncdf(x) { var t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804 * Math.exp(-x * x / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
  function ninv(p) { // Acklam's rational approximation
    var a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924], b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857],
      c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878], d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742], q, r;
    if (p < 0.02425) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - 0.02425) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function combos(n, k) { var out = [], cur = []; (function go(i) { if (cur.length === k) { out.push(cur.slice()); return; } for (var j = i; j < n; j++) { cur.push(j); go(j + 1); cur.pop(); } })(0); return out; }
  function overfit(D, st0, a, par, vals) {
    var n = D.c.length, S = 8;
    if (vals.length < 3 || n - a < 80) return null;
    var M = [], SR = [], RR = [];
    vals.forEach(function (val) {
      var st = clone(st0); setPath(st, par, val);
      var R = backtest(D, st, a, n, false), r = R.rets, L = r.length, blk = [];
      for (var k = 0; k < S; k++) { var s = 0, i0 = Math.floor(k * L / S), i1 = Math.floor((k + 1) * L / S); for (var i = i0; i < i1; i++) s += Math.log(Math.max(1e-9, 1 + r[i])); blk.push(s); }
      var m = r.reduce(function (p, x) { return p + x; }, 0) / (L || 1), sd = Math.sqrt(r.reduce(function (p, x) { return p + (x - m) * (x - m); }, 0) / Math.max(1, L - 1));
      M.push(blk); SR.push(sd > 0 ? m / sd : 0); RR.push(r);
    });
    // PBO by combinatorially symmetric cross-validation
    var N = vals.length, cs = combos(S, S / 2), bad = 0;
    cs.forEach(function (isB) {
      var inS = {}; isB.forEach(function (k) { inS[k] = 1; });
      var isP = M.map(function (b) { return b.reduce(function (p, x, k) { return p + (inS[k] ? x : 0); }, 0); }), oosP = M.map(function (b) { return b.reduce(function (p, x, k) { return p + (inS[k] ? 0 : x); }, 0); });
      var best = isP.indexOf(Math.max.apply(null, isP)), rank = oosP.filter(function (x) { return x < oosP[best]; }).length + 1, w = rank / (N + 1);
      if (Math.log(w / (1 - w)) <= 0) bad++;
    });
    // Deflated Sharpe of the best value over the whole period
    var bi = SR.indexOf(Math.max.apply(null, SR)), r = RR[bi], T = r.length, sr = SR[bi];
    var mSR = SR.reduce(function (p, x) { return p + x; }, 0) / N, vSR = SR.reduce(function (p, x) { return p + (x - mSR) * (x - mSR); }, 0) / Math.max(1, N - 1), g = 0.5772156649;
    var sr0 = Math.sqrt(vSR) * ((1 - g) * ninv(1 - 1 / N) + g * ninv(1 - 1 / (N * Math.E)));
    var m = r.reduce(function (p, x) { return p + x; }, 0) / T, sd = Math.sqrt(r.reduce(function (p, x) { return p + (x - m) * (x - m); }, 0) / T) || 1e-12;
    var sk = r.reduce(function (p, x) { return p + Math.pow((x - m) / sd, 3); }, 0) / T, ku = r.reduce(function (p, x) { return p + Math.pow((x - m) / sd, 4); }, 0) / T;
    var den = 1 - sk * sr + (ku - 1) / 4 * sr * sr, dsr = den > 0 ? ncdf((sr - sr0) * Math.sqrt(T - 1) / Math.sqrt(den)) : null;
    return { pbo: bad / cs.length, dsr: dsr, n: N, best: vals[bi] };
  }
  function ofHTML(O) {
    if (!O) return '<p class="note">' + t('of_few') + '</p>';
    var pv = O.pbo < 0.1 ? 'of_p_ok' : O.pbo <= 0.5 ? 'of_p_mid' : 'of_p_bad', dv = O.dsr != null && O.dsr >= 0.95 ? 'of_d_ok' : 'of_d_no';
    return '<div class="rc-kpis">' + kpi('of_n', nf(O.n)) + kpi('of_pbo', '<span class="' + (O.pbo < 0.1 ? 'up' : O.pbo > 0.5 ? 'down' : '') + '">' + pc(O.pbo, 0) + '</span>') +
      kpi('of_dsr', '<span class="' + (O.dsr >= 0.95 ? 'up' : 'down') + '">' + pc(O.dsr, 0) + '</span>') + '</div><p>' + t(pv) + '</p><p>' + t(dv) + '</p>';
  }
  function runWF() {
    if (!LAST || BUSY) return; BUSY = true;
    var X = LAST, D = X.D, n = D.c.length, a = X.a, m = root.querySelector('.wf-msg');
    if (m) m.textContent = t('busy');
    setTimeout(function () {
      try {
        var folds = [], par = OPT.par, vals = [];
        if (par) { for (var v = +OPT.min; v <= +OPT.max + 1e-9 && vals.length < 60; v += Math.max(1e-9, +OPT.step)) vals.push(Math.round(v * 1e6) / 1e6); }
        // without optimisation: 5 equal stretches; with it: first 40% trains only, the rest is cut into 4 out-of-sample folds (anchored)
        var K = par ? 4 : 5, first = par ? a + Math.floor((n - a) * 0.4) : a, len = Math.floor((n - first) / K);
        var IS = 0, ISy = 0, OOSy = 0;
        for (var k = 0; k < K; k++) {
          var s0 = first + k * len, s1 = k === K - 1 ? n : s0 + len, chosen = null, isr = null;
          if (par) {
            var best = -Infinity;
            vals.forEach(function (val) {
              var st = clone(X.st); setPath(st, par, val);
              var R = backtest(D, st, a, s0, false);
              var sc = Math.log(Math.max(1e-9, R.eq)) - (R.trades.length >= 3 ? 0 : 100);   // too few trades: ranked last, still ranked
              if (sc > best) { best = sc; chosen = val; isr = R.eq - 1; }
            });
            var isYears = (D.t[s0 - 1] - D.t[a]) / 31557600000; if (isr != null && isYears > 0) { IS += 1; ISy += Math.log(1 + isr) / isYears; }
          }
          var st2 = clone(X.st); if (par && chosen != null) setPath(st2, par, chosen);
          var R2 = backtest(D, st2, s0, s1, false), y = (D.t[s1 - 1] - D.t[s0]) / 31557600000;
          OOSy += y > 0 ? Math.log(Math.max(1e-9, R2.eq)) / y : 0;
          folds.push({ t0: D.t[s0], t1: D.t[s1 - 1], val: chosen, isr: isr, oos: R2.eq - 1, bh: D.c[s1 - 1] / D.o[s0] - 1, n: R2.trades.length });
        }
        var total = folds.reduce(function (p, f) { return p * (1 + f.oos); }, 1) - 1;
        var eff = par && IS ? (OOSy / K) / (ISy / IS) : null;
        if (eff != null && !(ISy > 0)) eff = null;
        X.wf = { folds: folds, total: total, pos: folds.filter(function (f) { return f.oos > 0; }).length, beat: folds.filter(function (f) { return f.oos > f.bh; }).length, eff: eff };
        X.of = par ? overfit(D, X.st, a, par, vals) : undefined;
        var o = root.querySelector('.wf-out'); if (o) o.innerHTML = wfHTML(X.wf) + (par ? '<p class="note">' + t('warn_opt') + '</p><h3>' + t('of') + '</h3><p class="rc-lead">' + t('of_lead') + '</p>' + ofHTML(X.of) : '');
      } finally { if (m) m.textContent = ''; BUSY = false; }
    }, 20);
  }

  // test hook (used by the site's own checks; harmless for visitors)
  window.__slab = { backtest: backtest, stats: stats, permute: permute, rng: rng, rsi: rsi, sma: sma, overfit: overfit, ncdf: ncdf, ninv: ninv };
  render();
})();
