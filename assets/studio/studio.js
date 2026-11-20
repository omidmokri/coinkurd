/* Entekhab Pine Studio — write Pine Script, see it live on a Binance chart, back-test strategies, and add
   Smart Money Concepts and Kronos forecast layers. Free software under the GNU AGPL v3 (it runs PineTS by LuxAlgo):
   source https://github.com/omidmokri/coinkurd/tree/main/assets/studio . Everything runs in the visitor's browser;
   prices come straight from Binance spot (data-api.binance.vision). Scripts are saved only in this browser. */
(function () {
  'use strict';
  var root = document.getElementById('studio');
  if (!root || !window.LightweightCharts) return;
  var LW = window.LightweightCharts;
  var API = 'https://data-api.binance.vision/api/v3/';
  var WS = 'wss://data-stream.binance.vision/ws/';
  var TFS = [['1m', 6e4], ['5m', 3e5], ['15m', 9e5], ['1h', 36e5], ['4h', 144e5], ['1d', 864e5], ['1w', 6048e5]];
  var PINE_TF = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D', '1w': 'W' };
  var COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'TRX', 'AVAX', 'LINK', 'TON', 'SUI', 'DOT', 'LTC', 'BCH', 'NEAR', 'APT', 'ARB', 'OP', 'PEPE', 'SHIB', 'INJ', 'AAVE', 'UNI', 'ATOM', 'FIL', 'ETC', 'HBAR', 'TIA', 'SEI', 'FET', 'RENDER', 'WLD', 'ENA', 'ONDO', 'TAO'];

  /* ------------------------------------------------------------------ language */
  var S = {
    run: ['▶ اجرا', '▶ جێبەجێکردن', '▶ Run'], runK: ['Ctrl+Enter', 'Ctrl+Enter', 'Ctrl+Enter'],
    live: ['زنده', 'زیندوو', 'Live'], coin: ['ارز', 'دراو', 'Coin'], bars: ['کندل', 'مۆم', 'bars'],
    examples: ['نمونه‌ها', 'نموونەکان', 'Examples'], mine: ['کدهای من', 'کۆدەکانم', 'My scripts'],
    save: ['ذخیره', 'پاشەکەوت', 'Save'], share: ['لینک اشتراک', 'بەستەری هاوبەشی', 'Share link'], dl: ['دانلود .pine', 'داگرتنی .pine', 'Download .pine'],
    newS: ['کد تازه', 'کۆدی نوێ', 'New script'], del: ['حذف', 'سڕینەوە', 'Delete'],
    tester: ['تستر استراتژی', 'تاقیکەری ستراتیژ', 'Strategy tester'], trades: ['معاملات', 'مامەڵەکان', 'Trades'],
    console: ['کنسول', 'کۆنسۆڵ', 'Console'], smc: ['اسمارت مانی', 'سمارت مەنی', 'Smart Money'], kronos: ['پیش‌بینی Kronos', 'پێشبینیی Kronos', 'Kronos forecast'],
    loading: ['دریافت کندل‌ها از بایننس…', 'وەرگرتنی مۆمەکان لە بایننس…', 'Loading candles from Binance…'],
    running: ['در حال اجرا…', 'جێبەجێدەکرێت…', 'Running…'], ranIn: ['اجرا شد در', 'جێبەجێ کرا لە', 'ran in'], ms: ['میلی‌ثانیه', 'میلیچرکە', 'ms'],
    err: ['خطا', 'هەڵە', 'Error'], line: ['خط', 'هێڵ', 'line'], noStrat: ['این کد استراتژی نیست. برای بک‌تست، به‌جای indicator() از strategy() و دستورهای strategy.entry / strategy.close استفاده کن.',
      'ئەم کۆدە ستراتیژ نییە. بۆ باکتێست لەجیاتی indicator() لە strategy() و strategy.entry / strategy.close کەڵک وەربگرە.',
      'This script is not a strategy. To back-test, use strategy() instead of indicator(), with strategy.entry / strategy.close.'],
    noTrades: ['استراتژی در این بازه هیچ معامله‌ای نکرد.', 'ستراتیژەکە لەم ماوەیەدا هیچ مامەڵەیەکی نەکرد.', 'The strategy made no trades in this range.'],
    net: ['سود خالص', 'قازانجی پاک', 'Net profit'], ntr: ['تعداد معاملات', 'ژمارەی مامەڵە', 'Trades'], win: ['درصد برد', 'ڕێژەی بردنەوە', 'Win rate'],
    pf: ['ضریب سود', 'هاوکۆلکەی قازانج', 'Profit factor'], mdd: ['بیشترین افت سرمایه', 'زۆرترین داکەوتن', 'Max drawdown'], sharpe: ['شارپ', 'شارپ', 'Sharpe'],
    sortino: ['سورتینو', 'سۆرتینۆ', 'Sortino'], bh: ['خرید و نگهداری', 'کڕین و هەڵگرتن', 'Buy & hold'], avg: ['میانگین هر معامله', 'تێکڕای هەر مامەڵە', 'Avg trade'],
    open: ['معاملهٔ باز', 'مامەڵەی کراوە', 'Open trade'], entry: ['ورود', 'چوونەژوورەوە', 'Entry'], exit: ['خروج', 'دەرچوون', 'Exit'], pnl: ['سود/زیان', 'قازانج/زیان', 'P&L'],
    eq: ['منحنی سرمایه', 'هێڵی سەرمایە', 'Equity curve'],
    smcOn: ['لایهٔ اسمارت مانی روی نمودار', 'چینی سمارت مەنی لەسەر چارت', 'Smart Money layer on the chart'],
    kroOn: ['لایهٔ پیش‌بینی Kronos', 'چینی پێشبینیی Kronos', 'Kronos forecast layer'],
    trendUp: ['ساختار صعودی', 'پێکهاتەی بەرزبوونەوە', 'Bullish structure'], trendDn: ['ساختار نزولی', 'پێکهاتەی دابەزین', 'Bearish structure'], trendNa: ['ساختار نامشخص', 'پێکهاتەی نادیار', 'No clear structure'],
    ob: ['اوردر بلاک', 'ئۆردەر بلۆک', 'Order block'], fvg: ['شکاف ارزش منصفانه', 'بۆشایی بەهای دادپەروەرانە', 'Fair value gap'], liq: ['نقدینگی', 'شلەیی', 'Liquidity'],
    pdh: ['سقف/کف دیروز', 'لوتکە/بنی دوێنێ', 'Previous day high/low'], prem: ['منطقهٔ پریمیوم / دیسکانت', 'ناوچەی پرێمیۆم / دیسکاونت', 'Premium / discount'],
    kroNone: ['برای این ارز و تایم‌فریم هنوز پیش‌بینی Kronos ساخته نشده. پیش‌بینی‌ها هر ساعت برای ارزهای اصلی در تایم‌فریم ۱ ساعته ساخته می‌شوند.',
      'بۆ ئەم دراو و کاتە هێشتا پێشبینیی Kronos دروست نەکراوە. پێشبینییەکان هەموو کاتژمێرێک بۆ دراوە سەرەکییەکان لە کاتی ١ کاتژمێری دروست دەکرێن.',
      'No Kronos forecast for this coin and timeframe yet. Forecasts are made every hour for the main coins on the 1-hour chart.'],
    kroAt: ['ساخته شده در', 'دروستکراوە لە', 'made at'], kroH: ['ساعت آینده', 'کاتژمێری داهاتوو', 'hours ahead'],
    kroNote: ['Kronos مدل پایهٔ هوش مصنوعی برای کندل‌هاست (مجوز MIT). این یک برآورد آماری است، نه سیگنال یا توصیهٔ مالی.',
      'Kronos مۆدێلی بنەڕەتی AI بۆ مۆمەکانە (مۆڵەتی MIT). ئەمە خەمڵاندنێکی ئامارییە، نەک سیگناڵ یان ئامۆژگاری.',
      'Kronos is a foundation model for candlesticks (MIT licence). This is a statistical estimate, not a signal or financial advice.'],
    saved: ['ذخیره شد', 'پاشەکەوت کرا', 'Saved'], copied: ['لینک کپی شد', 'بەستەر کۆپی کرا', 'Link copied'],
    name: ['نام کد', 'ناوی کۆد', 'Script name'], alerts: ['هشدارها', 'ئاگادارکردنەوەکان', 'Alerts'], warn: ['هشدار', 'ئاگاداری', 'Warning'],
    hint: ['Pine Script نسخهٔ ۵ و ۶ را مستقیم بنویس یا از TradingView کپی کن. اجرا کاملاً در مرورگر خودت است.',
      'Pine Script v5 و v6 ڕاستەوخۆ بنووسە یان لە TradingView کۆپی بکە. جێبەجێکردن تەواو لە وێبگەڕی خۆتدایە.',
      'Write Pine Script v5/v6 or paste it from TradingView. It all runs in your own browser.'],
    fail: ['دریافت داده ناموفق بود. اتصال را بررسی کن.', 'وەرگرتنی داتا سەرنەکەوت.', 'Could not load data. Check your connection.'],
    scan: ['اسکرینر Pine', 'سکانەری Pine', 'Pine screener'], scanRun: ['▶ اسکن بازار', '▶ سکانی بازاڕ', '▶ Scan the market'], scanStop: ['توقف', 'ڕاگرتن', 'Stop'],
    universe: ['ارزها', 'دراوەکان', 'Coins'], top: ['برتر بر اساس حجم', 'باشترین بە قەبارە', 'top by volume'], fwd: ['بازده بعد از', 'گەڕانەوە دوای', 'Return after'],
    scanHelp: ['شرط فیلتر را با Pine بنویس: plot(شرط ? 1 : 0, "match") ردیف‌هایی را نشان می‌دهد که روی آخرین کندل بسته‌شده برقرارند. هر plot دیگر یک ستون جدول می‌شود. همهٔ توابع Pine (ta.*، math.*، var، حلقه…) مجازند.',
      'مەرجی فلتەر بە Pine بنووسە: plot(مەرج ? 1 : 0, "match") ئەو ڕیزانە پیشان دەدات کە لە دوایین مۆمی داخراودا ڕاستن. هەر plotێکی تر دەبێتە ستوونێک.',
      'Write the filter in Pine: plot(condition ? 1 : 0, "match") keeps the coins where it is true on the last closed candle. Every other plot becomes a table column. All of Pine is allowed (ta.*, math.*, var, loops…).'],
    scanEdge: ['آزمون فیلتر روی گذشته: هر بار در این بازه که شرط برقرار شد، بازده N کندل بعد ثبت شده است.', 'تاقیکردنەوەی فلتەر لە ڕابردوودا: هەر جارێک مەرجەکە ڕاست بووە، گەڕانەوەی N مۆم دواتر تۆمار کراوە.',
      'Filter tested on the past: every time the condition was true in this range, the return N candles later was recorded.'],
    hits: ['دفعات', 'جار', 'hits'], avgRet: ['میانگین بازده', 'تێکڕای گەڕانەوە', 'avg return'], winR: ['درصد مثبت', 'ڕێژەی ئەرێنی', 'positive'],
    tvhook: ['هشدارهای TradingView', 'ئاگادارکردنەوەکانی TradingView', 'TradingView alerts'],
    hookHow: ['هشدارهای TradingView خودت را این‌جا ببین: در TradingView هنگام ساخت هشدار، گزینهٔ Webhook URL را روشن کن و این نشانی را بگذار. متن پیام می‌تواند ساده یا JSON مثل نمونهٔ زیر باشد. هشدارها زنده در فهرست زیر می‌آیند.',
      'ئاگادارکردنەوەکانی TradingViewی خۆت لێرە ببینە: لە TradingView لە کاتی دروستکردنی ئاگادارکردنەوە Webhook URL چالاک بکە و ئەم ناونیشانە دابنێ. پەیامەکە دەتوانێت دەقی سادە یان JSON بێت.',
      'See your own TradingView alerts here: when creating an alert in TradingView, turn on “Webhook URL” and paste this address. The message can be plain text or JSON like the sample below. Alerts appear live in the list.'],
    hookUrl: ['نشانی Webhook', 'ناونیشانی Webhook', 'Webhook URL'], hookMsg: ['نمونهٔ پیام', 'نموونەی پەیام', 'Sample message'], copy: ['کپی', 'کۆپی', 'Copy'],
    hookNone: ['هنوز هشداری نرسیده.', 'هێشتا هیچ ئاگادارکردنەوەیەک نەگەیشتووە.', 'No alerts yet.'],
    matched: ['مطابق', 'گونجاو', 'match'], scanned: ['اسکن شد', 'سکان کرا', 'scanned'], open2: ['باز کردن روی نمودار', 'کردنەوە لەسەر چارت', 'open on the chart']
  };
  function lang() { var l = (document.documentElement.getAttribute('lang') || 'fa').toLowerCase(); return l.indexOf('ckb') === 0 ? 'ckb' : l.indexOf('en') === 0 ? 'en' : 'fa'; }
  function t(k) { var v = S[k]; return v ? v[{ fa: 0, ckb: 1, en: 2 }[lang()]] : k; }
  var DIG = { fa: '۰۱۲۳۴۵۶۷۸۹', ckb: '٠١٢٣٤٥٦٧٨٩' };
  function loc(s) { var d = DIG[lang()]; s = String(s); return d ? s.replace(/[0-9]/g, function (c) { return d[+c]; }) : s; }
  function nf(x, dec) { if (x == null || !isFinite(x)) return '—'; return loc(Number(x).toLocaleString('en-US', { maximumFractionDigits: dec == null ? 2 : dec, minimumFractionDigits: 0 })); }
  function pc(x, dec) { return x == null || !isFinite(x) ? '—' : loc((x >= 0 ? '+' : '') + x.toFixed(dec == null ? 2 : dec)) + (lang() === 'en' ? '%' : '٪'); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtT(ms) { var d = new Date(ms); return loc(d.toISOString().slice(0, 16).replace('T', ' ')); }

  /* ------------------------------------------------------------------ examples */
  var EX = {
    ema: ['EMA cross (strategy)', '//@version=5\nstrategy("EMA cross", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.1)\nfastLen = input.int(12, "Fast EMA")\nslowLen = input.int(26, "Slow EMA")\nfast = ta.ema(close, fastLen)\nslow = ta.ema(close, slowLen)\nplot(fast, "Fast", color=color.orange, linewidth=2)\nplot(slow, "Slow", color=color.aqua, linewidth=2)\nif ta.crossover(fast, slow)\n    strategy.entry("Long", strategy.long)\nif ta.crossunder(fast, slow)\n    strategy.close("Long")\n'],
    st: ['Supertrend (strategy)', '//@version=5\nstrategy("Supertrend", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.1)\natrLen = input.int(10, "ATR length")\nmult = input.float(3.0, "Multiplier")\n[st, dir] = ta.supertrend(mult, atrLen)\nplot(dir < 0 ? st : na, "Up", color=color.lime, linewidth=2, style=plot.style_linebr)\nplot(dir > 0 ? st : na, "Down", color=color.red, linewidth=2, style=plot.style_linebr)\nif ta.change(dir) < 0\n    strategy.entry("Long", strategy.long)\nif ta.change(dir) > 0\n    strategy.close("Long")\n'],
    bb: ['Bollinger reversion + stop (strategy)', '//@version=5\nstrategy("Bollinger reversion", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.1)\nlen = input.int(20, "Length")\nk = input.float(2.0, "StdDev")\n[mid, up, lo] = ta.bb(close, len, k)\nplot(mid, "Basis", color=color.gray)\nplot(up, "Upper", color=color.teal)\nplot(lo, "Lower", color=color.teal)\nif ta.crossover(close, lo)\n    strategy.entry("Long", strategy.long)\nif ta.crossover(close, mid)\n    strategy.close("Long")\nstrategy.exit("Stop", "Long", loss = 400, profit = 800)\n'],
    rsi: ['RSI zones (indicator)', '//@version=5\nindicator("RSI zones", overlay=false)\nlen = input.int(14, "Length")\nr = ta.rsi(close, len)\nsig = ta.sma(r, 9)\nplot(r, "RSI", color=r > 70 ? color.red : r < 30 ? color.lime : color.yellow, linewidth=2)\nplot(sig, "Signal", color=color.gray)\nhline(70, "Overbought")\nhline(30, "Oversold")\nbgcolor(r > 70 ? color.new(color.red, 85) : r < 30 ? color.new(color.green, 85) : na)\nplotshape(ta.crossover(r, 30), "Buy", shape.triangleup, location.bottom, color.lime)\nplotshape(ta.crossunder(r, 70), "Sell", shape.triangledown, location.top, color.red)\n'],
    macd: ['MACD (indicator)', '//@version=5\nindicator("MACD", overlay=false)\n[m, s, h] = ta.macd(close, 12, 26, 9)\nplot(h, "Histogram", color=h >= 0 ? color.new(color.green, 30) : color.new(color.red, 30), style=plot.style_columns)\nplot(m, "MACD", color=color.blue, linewidth=2)\nplot(s, "Signal", color=color.orange)\nhline(0, "Zero")\n'],
    piv: ['Pivots & breakouts (labels, alerts)', '//@version=5\nindicator("Pivots & breakouts", overlay=true, max_labels_count=100)\nlen = input.int(8, "Pivot length")\nph = ta.pivothigh(high, len, len)\npl = ta.pivotlow(low, len, len)\nvar float lastH = na\nvar float lastL = na\nif not na(ph)\n    lastH := ph\n    label.new(bar_index - len, ph, "H", color=color.new(color.red, 20), textcolor=color.white, style=label.style_label_down)\nif not na(pl)\n    lastL := pl\n    label.new(bar_index - len, pl, "L", color=color.new(color.green, 20), textcolor=color.white, style=label.style_label_up)\nplot(lastH, "Resistance", color=color.red, style=plot.style_stepline)\nplot(lastL, "Support", color=color.green, style=plot.style_stepline)\nalertcondition(ta.crossover(close, lastH), "Breakout", "Price broke the last pivot high")\n']
  };

  var SCAN_EX = {
    rsi: ['RSI oversold in an uptrend', '//@version=5\nindicator("Oversold in uptrend")\nr = ta.rsi(close, 14)\nema200 = ta.ema(close, 200)\nplot(r < 35 and close > ema200 ? 1 : 0, "match")\nplot(r, "RSI")\nplot((close / ema200 - 1) * 100, "% above EMA200")\n'],
    vol: ['Volume breakout', '//@version=5\nindicator("Volume breakout")\nhh = ta.highest(high, 20)[1]\nvr = volume / ta.sma(volume, 20)\nplot(close > hh and vr > 2 ? 1 : 0, "match")\nplot(vr, "Volume ×")\nplot((close / hh - 1) * 100, "% over 20-bar high")\n'],
    st: ['Supertrend just turned up', '//@version=5\nindicator("Supertrend flip")\n[st, dir] = ta.supertrend(3, 10)\nplot(ta.change(dir) < 0 ? 1 : 0, "match")\nplot((close / st - 1) * 100, "% from Supertrend")\nplot(ta.rsi(close, 14), "RSI")\n'],
    sq: ['Bollinger squeeze', '//@version=5\nindicator("Squeeze")\n[m, u, l] = ta.bb(close, 20, 2)\nw = (u - l) / m * 100\nplot(w <= ta.lowest(w, 120) * 1.1 ? 1 : 0, "match")\nplot(w, "BB width %")\n[dp, dm, adx] = ta.dmi(14, 14)\nplot(adx, "ADX")\n'],
    choch: ['Bullish change of character (pivots)', '//@version=5\nindicator("Bullish CHoCH")\nph = ta.pivothigh(high, 5, 5)\npl = ta.pivotlow(low, 5, 5)\nvar float lh = na\nvar float ll = na\nvar int trend = 0\nvar int flip = -1\nif not na(ph)\n    lh := ph\nif not na(pl)\n    ll := pl\nif not na(lh) and close > lh and trend <= 0\n    trend := 1\n    flip := bar_index\n    lh := na\nif not na(ll) and close < ll and trend >= 0\n    trend := -1\n    ll := na\nplot(trend == 1 and bar_index - flip <= 3 ? 1 : 0, "match")\nplot(bar_index - flip, "bars since flip")\n']
  };

  /* ------------------------------------------------------------------ state */
  var LS = window.localStorage, st = { sym: 'BTCUSDT', tf: '1h', n: 1000, live: true, smc: true, kro: true, src: '', name: '' };
  try { var sv = JSON.parse(LS.getItem('ek_studio') || '{}'); for (var k in sv) if (k in st) st[k] = sv[k]; } catch (e) { }
  var hash = /[#&]s=([^&]+)/.exec(location.hash);
  if (hash) { try { st.src = decodeURIComponent(escape(atob(hash[1].replace(/-/g, '+').replace(/_/g, '/')))); st.name = ''; } catch (e) { } }
  var q = /[?&]symbol=([A-Z0-9]+)/i.exec(location.search); if (q) st.sym = q[1].toUpperCase().replace(/USDT$/, '') + 'USDT';
  if (!st.src) st.src = EX.ema[1];
  function persist() { try { LS.setItem('ek_studio', JSON.stringify(st)); } catch (e) { } }
  function myScripts() { try { return JSON.parse(LS.getItem('ek_studio_scripts') || '{}'); } catch (e) { return {}; } }

  /* ------------------------------------------------------------------ layout */
  root.innerHTML = '';
  var bar = el('div', 'ps-bar'); root.appendChild(bar);
  var coinSel = el('input', 'ps-coin'); coinSel.setAttribute('list', 'ps-coins'); coinSel.value = st.sym.replace(/USDT$/, ''); coinSel.setAttribute('aria-label', 'coin'); coinSel.spellcheck = false;
  var dl = el('datalist'); dl.id = 'ps-coins'; COINS.forEach(function (c) { var o = el('option'); o.value = c; dl.appendChild(o); });
  var tfBox = el('div', 'ps-seg'); TFS.forEach(function (x) { var b = el('button', '', x[0]); b.type = 'button'; b.dataset.tf = x[0]; tfBox.appendChild(b); });
  var nSel = el('select', 'ps-n'); [500, 1000, 2000, 5000].forEach(function (v) { var o = el('option', '', v); o.value = v; nSel.appendChild(o); }); nSel.value = st.n;
  var runB = el('button', 'ps-run'); runB.type = 'button';
  var liveB = el('label', 'ps-chk'); var liveC = el('input'); liveC.type = 'checkbox'; liveC.checked = st.live; liveB.appendChild(liveC); var liveT = el('span'); liveB.appendChild(liveT);
  var smcB = el('label', 'ps-chk'); var smcC = el('input'); smcC.type = 'checkbox'; smcC.checked = st.smc; smcB.appendChild(smcC); var smcT = el('span'); smcB.appendChild(smcT);
  var kroB = el('label', 'ps-chk'); var kroC = el('input'); kroC.type = 'checkbox'; kroC.checked = st.kro; kroB.appendChild(kroC); var kroT = el('span'); kroB.appendChild(kroT);
  var price = el('b', 'ps-price', '…');
  [coinSel, dl, tfBox, nSel, runB, liveB, smcB, kroB, price].forEach(function (x) { bar.appendChild(x); });

  var main = el('div', 'ps-main'); root.appendChild(main);
  var chartBox = el('div', 'ps-chart'); main.appendChild(chartBox);
  var chartEl = el('div', 'ps-chart-in'); chartBox.appendChild(chartEl);
  var ovl = el('canvas', 'ps-ovl'); chartBox.appendChild(ovl);
  var status = el('div', 'ps-status'); chartBox.appendChild(status);
  var legend = el('div', 'ps-legend'); chartBox.appendChild(legend);

  var side = el('div', 'ps-side'); main.appendChild(side);
  var edBar = el('div', 'ps-edbar'); side.appendChild(edBar);
  var exSel = el('select', 'ps-ex'); var mySel = el('select', 'ps-ex');
  var nameIn = el('input', 'ps-name'); nameIn.value = st.name || ''; nameIn.spellcheck = false;
  var saveB = el('button', 'ps-btn'); saveB.type = 'button'; var shareB = el('button', 'ps-btn'); shareB.type = 'button'; var dlB = el('button', 'ps-btn'); dlB.type = 'button';
  [exSel, mySel, nameIn, saveB, shareB, dlB].forEach(function (x) { edBar.appendChild(x); });
  var ed = el('div', 'ps-ed'); side.appendChild(ed);
  var gut = el('pre', 'ps-gut'); var hl = el('pre', 'ps-hl'); var ta = el('textarea', 'ps-ta'); ta.spellcheck = false; ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocomplete', 'off'); ta.wrap = 'off'; ta.value = st.src;
  ed.appendChild(gut); ed.appendChild(hl); ed.appendChild(ta);
  var hint = el('p', 'ps-hint'); side.appendChild(hint);

  var tabs = el('div', 'ps-tabs'); root.appendChild(tabs);
  var panes = el('div', 'ps-panes'); root.appendChild(panes);
  var TABS = ['tester', 'trades', 'scan', 'tvhook', 'console', 'smc', 'kronos'], tabEls = {}, paneEls = {};
  TABS.forEach(function (k) { var b = el('button', '', ''); b.type = 'button'; b.dataset.k = k; tabs.appendChild(b); tabEls[k] = b; var p = el('div', 'ps-pane'); p.hidden = true; panes.appendChild(p); paneEls[k] = p; });
  var curTab = 'tester';
  function showTab(k) { curTab = k; if (k === 'tvhook' && typeof loadHook === 'function') loadHook(); TABS.forEach(function (x) { tabEls[x].classList.toggle('on', x === k); paneEls[x].hidden = x !== k; }); if (k === 'tester' && eqChart) setTimeout(function () { eqChart.timeScale().fitContent(); }, 0); }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) showTab(b.dataset.k); });

  function texts() {
    runB.innerHTML = t('run') + ' <small>' + t('runK') + '</small>'; liveT.textContent = t('live'); smcT.textContent = 'SMC'; kroT.textContent = 'Kronos';
    smcB.title = t('smcOn'); kroB.title = t('kroOn'); nameIn.placeholder = t('name');
    saveB.textContent = t('save'); shareB.textContent = t('share'); dlB.textContent = t('dl'); hint.textContent = t('hint');
    exSel.innerHTML = '<option value="">' + esc(t('examples')) + '</option>' + Object.keys(EX).map(function (k) { return '<option value="' + k + '">' + esc(EX[k][0]) + '</option>'; }).join('');
    fillMine();
    TABS.forEach(function (k) { tabEls[k].textContent = t(k); });
    Array.prototype.forEach.call(nSel.options, function (o) { o.textContent = loc(o.value) + ' ' + t('bars'); });
    if (last) { renderTester(last); renderTrades(last); renderConsole(last); } renderSMCpane(); renderKro();
  }
  function fillMine() {
    var M = myScripts();
    mySel.innerHTML = '<option value="">' + esc(t('mine')) + '</option><option value="__new">+ ' + esc(t('newS')) + '</option>' +
      Object.keys(M).map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + '</option>'; }).join('');
  }

  /* ------------------------------------------------------------------ editor (light Pine highlighting) */
  var KW = /\b(if|else|for|to|by|while|switch|var|varip|and|or|not|true|false|na|import|export|method|type|return|continue|break|series|simple|const|int|float|bool|string|color|line|label|box|table|array|matrix|map)\b/g;
  var NS = /\b(ta|math|str|strategy|input|request|color|plot|shape|location|size|label|line|box|table|array|matrix|map|chart|syminfo|timeframe|barstate|session|ticker|alert|alertcondition|indicator|plotshape|plotchar|plotarrow|hline|fill|bgcolor|barcolor|nz|na|time|close|open|high|low|volume|hl2|hlc3|ohlc4|bar_index)\b/g;
  function hiLite(s) {
    var out = '', lines = s.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i], ci = L.indexOf('//'), code = ci >= 0 ? L.slice(0, ci) : L, com = ci >= 0 ? L.slice(ci) : '';
      var h = esc(code).replace(/(&quot;.*?&quot;|&#39;.*?&#39;)/g, '\u0001$1\u0002')
        .replace(/\b(\d+\.?\d*)\b/g, '<i class="n">$1</i>').replace(KW, '<i class="k">$1</i>').replace(NS, '<i class="f">$1</i>')
        .replace(/\u0001(.*?)\u0002/g, function (m, x) { return '<i class="s">' + x.replace(/<[^>]+>/g, '') + '</i>'; });
      out += (errLine === i + 1 ? '<span class="ps-errl">' : '') + h + (com ? '<i class="c">' + esc(com) + '</i>' : '') + (errLine === i + 1 ? '</span>' : '') + '\n';
    }
    return out;
  }
  var errLine = null;
  function edUpdate() {
    var v = ta.value; hl.innerHTML = hiLite(v) + ' ';
    var n = v.split('\n').length, g = ''; for (var i = 1; i <= n; i++) g += i + '\n'; gut.textContent = g;
    hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop;
  }
  ta.addEventListener('input', function () { st.src = ta.value; errLine = null; edUpdate(); persist(); });
  ta.addEventListener('scroll', function () { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; });
  ta.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runScript(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveScript(); return; }
    if (e.key === 'Tab') { e.preventDefault(); var a = ta.selectionStart; ta.setRangeText('    ', a, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
    if (e.key === 'Enter') {
      var p = ta.selectionStart, ls = ta.value.lastIndexOf('\n', p - 1) + 1, cur = ta.value.slice(ls, p), ind = (/^\s*/.exec(cur) || [''])[0];
      if (/^\s*(if|else|for|while|switch)\b.*$/.test(cur) || /=>\s*$/.test(cur)) ind += '    ';
      e.preventDefault(); ta.setRangeText('\n' + ind, p, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input'));
    }
  });

  /* ------------------------------------------------------------------ chart */
  var css = getComputedStyle(document.documentElement);
  var chart = LW.createChart(chartEl, {
    autoSize: true, layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#9aa4b2', fontFamily: 'Vazirmatn, Space Grotesk, sans-serif', panes: { separatorColor: '#1f2937', enableResize: true } },
    grid: { vertLines: { color: 'rgba(148,163,184,.06)' }, horzLines: { color: 'rgba(148,163,184,.06)' } },
    rightPriceScale: { borderColor: '#1f2937' }, timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false, rightOffset: 8 },
    crosshair: { mode: 0 }, localization: { locale: 'en-US' }
  });
  var cs = chart.addSeries(LW.CandlestickSeries, { upColor: '#16c784', downColor: '#ea3943', borderVisible: false, wickUpColor: '#16c784', wickDownColor: '#ea3943' }, 0);
  var vs = chart.addSeries(LW.HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false }, 0);
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
  var csMarkers = LW.createSeriesMarkers ? LW.createSeriesMarkers(cs, []) : null;
  var kroSeries = null, kroBand = [];
  var B = [], tfMs = 36e5, last = null, scriptSeries = [], priceLines = [], smcRes = null, kro = null;

  function tfOf(x) { for (var i = 0; i < TFS.length; i++) if (TFS[i][0] === x) return TFS[i][1]; return 36e5; }
  function setStatus(s, err) { status.textContent = s || ''; status.className = 'ps-status' + (err ? ' err' : '') + (s ? ' on' : ''); }

  async function loadBars() {
    setStatus(t('loading'));
    tfMs = tfOf(st.tf);
    var want = st.n, end = null, out = [];
    try {
      while (out.length < want) {
        var lim = Math.min(1000, want - out.length);
        var u = API + 'klines?symbol=' + st.sym + '&interval=' + st.tf + '&limit=' + lim + (end ? '&endTime=' + end : '');
        var r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status);
        var a = await r.json(); if (!a.length) break;
        out = a.map(function (k) { return { t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }; }).concat(out);
        end = a[0][0] - 1; if (a.length < lim) break;
      }
    } catch (e) { setStatus(t('fail') + ' (' + e.message + ')', true); return false; }
    B = out; setStatus('');
    cs.setData(B.map(function (b) { return { time: b.t / 1000, open: b.o, high: b.h, low: b.l, close: b.c }; }));
    vs.setData(B.map(function (b) { return { time: b.t / 1000, value: b.v, color: b.c >= b.o ? 'rgba(22,199,132,.28)' : 'rgba(234,57,67,.28)' }; }));
    price.textContent = nf(B[B.length - 1].c, 6);
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, B.length - 220), to: B.length + 8 });
    return true;
  }

  /* ------------------------------------------------------------------ live stream */
  var sock = null, sockKey = '';
  function connect() {
    var key = st.sym.toLowerCase() + '@kline_' + st.tf;
    if (!st.live) { if (sock) { sock.close(); sock = null; } sockKey = ''; return; }
    if (sock && sockKey === key) return;
    if (sock) sock.close();
    sockKey = key; sock = new WebSocket(WS + key);
    sock.onmessage = function (ev) {
      var k = JSON.parse(ev.data).k; if (!k || !B.length) return;
      var b = { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v }, lb = B[B.length - 1];
      if (b.t === lb.t) B[B.length - 1] = b; else if (b.t > lb.t) { B.push(b); if (B.length > st.n) B.shift(); }
      cs.update({ time: b.t / 1000, open: b.o, high: b.h, low: b.l, close: b.c });
      vs.update({ time: b.t / 1000, value: b.v, color: b.c >= b.o ? 'rgba(22,199,132,.28)' : 'rgba(234,57,67,.28)' });
      price.textContent = nf(b.c, 6); price.className = 'ps-price ' + (b.c >= lb.c ? 'up' : 'dn');
      if (k.x) { scheduleRun(300); } else if (last && last.ms < 350) scheduleRun(2500);
      if (smcRes && k.x) { smcRes = window.SMC ? SMC.run(B) : null; renderSMCpane(); }
      drawOverlay();
    };
    sock.onclose = function () { if (st.live && sockKey === key) setTimeout(function () { if (sockKey === key) { sock = null; sockKey = ''; connect(); } }, 3000); };
  }

  /* ------------------------------------------------------------------ worker */
  var worker = null, runId = 0, busy = false, again = false, timer = null;
  function getWorker() { if (!worker) { worker = new Worker('/assets/studio/worker.js?v=1'); worker.onmessage = onResult; worker.onerror = function (e) { busy = false; setStatus(t('err') + ': ' + (e.message || 'worker'), true); }; } return worker; }
  function scheduleRun(ms) { clearTimeout(timer); timer = setTimeout(runScript, ms || 0); }
  function runScript() {
    if (!B.length) return;
    if (busy) { again = true; return; }
    busy = true; again = false; runId++;
    runB.classList.add('busy');
    getWorker().postMessage({ type: 'run', id: runId, src: ta.value, bars: B, symbol: st.sym, tf: PINE_TF[st.tf] || '60', tfMs: tfMs });
  }
  function onResult(ev) {
    var r = ev.data; busy = false; runB.classList.remove('busy');
    if (r.type === 'error') {
      errLine = r.line; edUpdate();
      last = last ? Object.assign({}, last, { error: r }) : { error: r, plots: [], drawings: {}, alerts: [], warnings: [] };
      renderConsole(last); if (curTab !== 'console' && !last.plots.length) showTab('console');
      setStatus(t('err') + (r.line ? ' (' + t('line') + ' ' + loc(r.line) + ')' : '') + ': ' + r.msg.slice(0, 160), true);
    } else {
      errLine = null; edUpdate(); last = r; setStatus('');
      drawScript(r); renderTester(r); renderTrades(r); renderConsole(r);
      if (r.indicator.strategy && curTab === 'console') showTab('tester');
    }
    if (again) runScript();
  }

  /* ------------------------------------------------------------------ draw script output */
  function clearScript() {
    scriptSeries.forEach(function (s) { try { chart.removeSeries(s); } catch (e) { } });
    priceLines.forEach(function (p) { try { p.s.removePriceLine(p.l); } catch (e) { } });
    scriptSeries = []; priceLines = [];
    while (chart.panes().length > 1) { try { chart.removePane(chart.panes().length - 1); } catch (e) { break; } }
  }
  function rgba(c, fb) { if (!c) return fb; if (/^#[0-9a-f]{8}$/i.test(c)) { var a = parseInt(c.slice(7), 16) / 255; return 'rgba(' + parseInt(c.slice(1, 3), 16) + ',' + parseInt(c.slice(3, 5), 16) + ',' + parseInt(c.slice(5, 7), 16) + ',' + a.toFixed(3) + ')'; } return c; }
  var PAL = ['#f7931a', '#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#facc15'];
  var paneOf = { ov: 0, sub: 1 }, bgBars = { ov: null, sub: null }, scriptPaneSeries = null;
  function drawScript(r) {
    clearScript();
    var n = B.length, markers = [], ci = 0, hasSub = r.plots.some(function (p) { return !p.overlay && p.style !== 'background' && p.style !== 'barcolor'; });
    bgBars = { ov: null, sub: null }; scriptPaneSeries = null;
    var legendHtml = '<b>' + esc(r.indicator.title || '') + '</b>';
    r.plots.forEach(function (p) {
      var pane = p.overlay ? 0 : 1, col = rgba(p.color, PAL[ci++ % PAL.length]);
      if (p.style === 'background') { bgBars[p.overlay ? 'ov' : (hasSub ? 'sub' : 'ov')] = p.cols.map(function (c, i) { return p.vals[i] ? rgba(c, 'rgba(56,189,248,.12)') : null; }); return; }
      if (p.style === 'barcolor') return;
      if (p.style === 'shape' || p.style === 'char' || p.style === 'arrow') {
        var up = /up/.test(p.shape || '') || p.location === 'Bottom' || p.location === 'belowbar' || p.location === 'BelowBar';
        for (var i = 0; i < n; i++) if (p.vals[i] != null) markers.push({ time: B[i].t / 1000, position: up ? 'belowBar' : 'aboveBar', color: rgba(p.cols[i], col), shape: /circle/.test(p.shape || '') ? 'circle' : /square/.test(p.shape || '') ? 'square' : up ? 'arrowUp' : 'arrowDown', text: p.text || '' });
        return;
      }
      if (p.style === 'hline') {
        var host = pane === 0 ? cs : null;
        if (!host) { host = ensureSubHost(); }
        var v0 = null; for (var j = n - 1; j >= 0; j--) if (p.vals[j] != null) { v0 = p.vals[j]; break; }
        if (v0 != null) priceLines.push({ s: host, l: host.createPriceLine({ price: v0, color: 'rgba(148,163,184,.55)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: p.title }) });
        return;
      }
      var type = /columns|histogram/.test(p.style) ? LW.HistogramSeries : /area/.test(p.style) ? LW.AreaSeries : LW.LineSeries;
      var opts = { color: col, lineWidth: Math.min(4, p.linewidth || 1), priceLineVisible: false, lastValueVisible: true, title: p.title };
      if (/stepline/.test(p.style)) opts.lineType = 1;
      if (/circles|cross/.test(p.style)) { opts.lineVisible = false; opts.pointMarkersVisible = true; opts.pointMarkersRadius = 2; }
      if (type === LW.AreaSeries) { opts.lineColor = col; opts.topColor = rgba(col, col); opts.bottomColor = 'rgba(0,0,0,0)'; delete opts.color; }
      var s = chart.addSeries(type, opts, pane);
      var data = [];
      for (var i2 = 0; i2 < n; i2++) {
        var v = p.vals[i2];
        if (v == null) { data.push({ time: B[i2].t / 1000 }); continue; }
        var d = { time: B[i2].t / 1000, value: v }; if (p.cols[i2]) d.color = rgba(p.cols[i2], col);
        // the chart joins a line across empty bars; Pine leaves a gap (na), so the segment leaving the last value before a gap is invisible
        if (type === LW.LineSeries && i2 + 1 < n && p.vals[i2 + 1] == null) d.color = 'rgba(0,0,0,0)';
        data.push(d);
      }
      s.setData(data); scriptSeries.push(s);
      if (pane === 1 && !scriptPaneSeries) scriptPaneSeries = s;
      legendHtml += ' <span style="color:' + col + '">● ' + esc(p.title) + '</span>';
    });
    // strategy trades on the candles
    if (r.strategy && r.strategy.trades) {
      r.strategy.trades.slice(-300).forEach(function (tr) {
        if (B[tr.eb]) markers.push({ time: B[tr.eb].t / 1000, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: tr.id });
        if (B[tr.xb]) markers.push({ time: B[tr.xb].t / 1000, position: 'aboveBar', color: tr.profit >= 0 ? '#22c55e' : '#ef4444', shape: 'arrowDown', text: nf(tr.profit, 0) });
      });
      (r.strategy.open || []).forEach(function (o) { if (B[o.eb]) markers.push({ time: B[o.eb].t / 1000, position: 'belowBar', color: '#facc15', shape: 'arrowUp', text: o.id }); });
    }
    markers.sort(function (a, b) { return a.time - b.time; });
    if (csMarkers) csMarkers.setMarkers(markers);
    if (chart.panes()[1]) chart.panes()[1].setHeight(Math.max(110, Math.round(chartEl.clientHeight * 0.28)));
    legend.innerHTML = legendHtml + ' <small>' + loc(r.ms) + ' ' + t('ms') + '</small>';
    drawOverlay();
  }
  function ensureSubHost() {
    if (scriptPaneSeries) return scriptPaneSeries;
    var s = chart.addSeries(LW.LineSeries, { color: 'rgba(0,0,0,0)', lastValueVisible: false, priceLineVisible: false }, 1);
    s.setData(B.map(function (b) { return { time: b.t / 1000 }; })); scriptSeries.push(s); scriptPaneSeries = s; return s;
  }

  /* ------------------------------------------------------------------ canvas overlay: drawings, background colours, SMC, Kronos */
  var dpr = window.devicePixelRatio || 1;
  function paneTop(i) { var ps = chart.panes(), y = 0; for (var k = 0; k < i && k < ps.length; k++) y += ps[k].getHeight() + 1; return y; }
  function X(i) { return chart.timeScale().logicalToCoordinate(i); }
  function drawOverlay() {
    var w = chartEl.clientWidth, h = chartEl.clientHeight;
    if (ovl.width !== Math.round(w * dpr) || ovl.height !== Math.round(h * dpr)) { ovl.width = Math.round(w * dpr); ovl.height = Math.round(h * dpr); ovl.style.width = w + 'px'; ovl.style.height = h + 'px'; }
    var g = ovl.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    if (!B.length) return;
    var plotW = w - chart.priceScale('right').width();
    g.save(); g.beginPath(); g.rect(0, 0, plotW, h); g.clip();
    var vr = chart.timeScale().getVisibleLogicalRange(); if (!vr) { g.restore(); return; }
    var i0 = Math.max(0, Math.floor(vr.from) - 1), i1 = Math.min(B.length - 1, Math.ceil(vr.to) + 1), bw = Math.max(1, (X(1) || 0) - (X(0) || 0));
    // background colours from bgcolor()
    [['ov', 0], ['sub', 1]].forEach(function (pp) {
      var arr = bgBars[pp[0]]; if (!arr) return; var ps = chart.panes()[pp[1]]; if (!ps) return;
      var top = paneTop(pp[1]), ph = ps.getHeight();
      for (var i = i0; i <= i1; i++) if (arr[i]) { var x = X(i); if (x == null) continue; g.fillStyle = arr[i]; g.fillRect(x - bw / 2, top, bw + .5, ph); }
    });
    var P0 = function (p) { return cs.priceToCoordinate(p); };
    // SMC and Kronos belong to the price pane only
    g.save(); g.beginPath(); g.rect(0, 0, plotW, chart.panes()[0].getHeight()); g.clip();
    if (st.smc && smcRes) drawSMC(g, P0, plotW, i1);
    if (st.kro && kro && kro.sym === st.sym && kro.tf === st.tf) drawKro(g, P0);
    g.restore();
    // script drawings (lines, boxes, labels)
    if (last && last.drawings) {
      var Py = last.indicator.overlay ? P0 : function (p) { var s = scriptPaneSeries; var y = s ? s.priceToCoordinate(p) : null; return y == null ? null : y + paneTop(1); };
      (last.drawings.boxes || []).forEach(function (b) {
        var xa = X(b.left), xb = X(b.extend === 'right' || b.extend === 'both' ? i1 + 50 : b.right), ya = Py(b.top), yb = Py(b.bottom);
        if (xa == null || xb == null || ya == null || yb == null) return;
        g.fillStyle = rgba(b.bgcolor, 'rgba(56,189,248,.15)'); g.fillRect(xa, ya, xb - xa, yb - ya);
        g.strokeStyle = rgba(b.border_color, 'rgba(56,189,248,.6)'); g.lineWidth = b.border_width || 1; g.strokeRect(xa, ya, xb - xa, yb - ya);
        if (b.text) { g.fillStyle = rgba(b.text_color, '#e5e7eb'); g.font = '11px Vazirmatn,sans-serif'; g.textAlign = 'center'; g.fillText(b.text, (xa + xb) / 2, (ya + yb) / 2 + 4); }
      });
      (last.drawings.lines || []).forEach(function (L) {
        var xa = X(L.x1), xb = X(L.x2), ya = Py(L.y1), yb = Py(L.y2); if (xa == null || xb == null || ya == null || yb == null) return;
        if (L.extend === 'right' || L.extend === 'both') { var k = (yb - ya) / ((xb - xa) || 1); xb = plotW; yb = ya + k * (xb - xa); }
        g.strokeStyle = rgba(L.color, '#38bdf8'); g.lineWidth = L.width || 1; g.setLineDash(/dash/.test(L.style) ? [6, 4] : /dot/.test(L.style) ? [2, 3] : []);
        g.beginPath(); g.moveTo(xa, ya); g.lineTo(xb, yb); g.stroke(); g.setLineDash([]);
      });
      (last.drawings.labels || []).forEach(function (L) {
        var x = X(L.x), y = Py(L.y); if (x == null || y == null) return;
        var down = /down|upper/.test(L.style || ''), tx = String(L.text || ''); g.font = '600 11px Vazirmatn,sans-serif';
        var tw = Math.max(14, g.measureText(tx).width + 10), th = 18, yy = down ? y - th - 6 : y + 6;
        if (!/none/.test(L.style || '')) { g.fillStyle = rgba(L.color, '#2563eb'); roundRect(g, x - tw / 2, yy, tw, th, 4); g.fill(); }
        g.fillStyle = rgba(L.textcolor, '#fff') || '#fff'; g.textAlign = 'center'; g.fillText(tx, x, yy + 13);
      });
    }
    g.restore();
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function tag(g, x, y, txt, col) { g.font = '600 10px Vazirmatn,sans-serif'; var w = g.measureText(txt).width + 8; g.fillStyle = col; roundRect(g, x, y - 8, w, 15, 3); g.fill(); g.fillStyle = '#05080f'; g.textAlign = 'left'; g.fillText(txt, x + 4, y + 3); }
  function drawSMC(g, P, plotW, i1) {
    var R = smcRes, right = plotW;
    if (R.zone) { var yt = P(R.zone.top), ye = P(R.zone.eq), yb = P(R.zone.bot), xz = X(R.zone.from);
      if (yt != null && yb != null && xz != null) { g.fillStyle = 'rgba(234,57,67,.05)'; g.fillRect(xz, yt, right - xz, ye - yt); g.fillStyle = 'rgba(22,199,132,.05)'; g.fillRect(xz, ye, right - xz, yb - ye);
        g.strokeStyle = 'rgba(148,163,184,.35)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(xz, ye); g.lineTo(right, ye); g.stroke(); g.setLineDash([]); } }
    R.obs.forEach(function (o) { var xa = X(o.i), xb = o.end != null ? X(o.end) : right, ya = P(o.top), yb = P(o.bot); if (xa == null || ya == null || yb == null) return;
      g.fillStyle = o.dir === 1 ? (o.end == null ? 'rgba(22,199,132,.18)' : 'rgba(22,199,132,.06)') : (o.end == null ? 'rgba(234,57,67,.18)' : 'rgba(234,57,67,.06)');
      g.fillRect(xa, ya, (xb == null ? right : xb) - xa, yb - ya); if (o.end == null) tag(g, xa + 2, ya + 9, 'OB', o.dir === 1 ? '#16c784' : '#ea3943'); });
    R.fvgs.forEach(function (f) { var xa = X(f.i), xb = f.end != null ? X(f.end) : right, ya = P(f.top), yb = P(f.bot); if (xa == null || ya == null || yb == null) return;
      g.fillStyle = f.end == null ? 'rgba(250,204,21,.13)' : 'rgba(250,204,21,.04)'; g.fillRect(xa, ya, (xb == null ? right : xb) - xa, yb - ya);
      if (f.end == null && Math.abs(yb - ya) > 8) tag(g, xa + 2, (ya + yb) / 2, 'FVG', '#facc15'); });
    R.events.slice(-14).forEach(function (e) { var xa = X(e.from), xb = X(e.i), y = P(e.p); if (xa == null || xb == null || y == null) return;
      var c = e.kind === 'CHoCH' ? '#a78bfa' : (e.dir === 1 ? '#16c784' : '#ea3943');
      g.strokeStyle = c; g.lineWidth = 1.2; g.setLineDash(e.kind === 'CHoCH' ? [5, 3] : []); g.beginPath(); g.moveTo(xa, y); g.lineTo(xb, y); g.stroke(); g.setLineDash([]);
      g.font = '600 10px Vazirmatn,sans-serif'; g.fillStyle = c; g.textAlign = 'center'; g.fillText(e.kind, (xa + xb) / 2, y + (e.dir === 1 ? -4 : 12)); });
    R.liq.forEach(function (L) { var xa = X(L.i), xb = L.swept != null ? X(L.swept) : right, y = P(L.p); if (xa == null || y == null) return;
      g.strokeStyle = L.swept != null ? 'rgba(148,163,184,.35)' : '#38bdf8'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(xa, y); g.lineTo(xb == null ? right : xb, y); g.stroke(); g.setLineDash([]);
      g.font = '600 10px Vazirmatn,sans-serif'; g.fillStyle = g.strokeStyle; g.textAlign = 'left'; g.fillText('$$$' + (L.swept != null ? ' ✕' : ''), xa + 2, y - 3); });
    (R.pd || []).concat(R.pw || []).forEach(function (d, k) { var isW = k >= (R.pd || []).length;
      [['h', d.h], ['l', d.l]].forEach(function (x) { var y = P(x[1]); if (y == null) return; g.strokeStyle = isW ? 'rgba(244,114,182,.55)' : 'rgba(250,204,21,.45)'; g.setLineDash([8, 4]);
        g.beginPath(); g.moveTo(X(d.from) || 0, y); g.lineTo(right, y); g.stroke(); g.setLineDash([]); g.font = '10px Vazirmatn,sans-serif'; g.fillStyle = g.strokeStyle; g.textAlign = 'right';
        g.fillText((isW ? 'PW' : 'PD') + (x[0] === 'h' ? 'H' : 'L'), right - 4, y - 3); }); });
  }
  function drawKro(g, P) {
    var F = kro.f, n = B.length; if (!F || !F.length) return;
    var lastT = B[n - 1].t;
    for (var i = 0; i < F.length; i++) {
      var f = F[i], idx = n - 1 + Math.round((f.t - lastT) / tfMs); if (idx < n) continue;
      var x = X(idx), bw = Math.max(1, ((X(1) || 0) - (X(0) || 0)) * .6); if (x == null) continue;
      if (f.hi != null && f.lo != null) { var yh = P(f.hi), yl = P(f.lo); if (yh != null && yl != null) { g.fillStyle = 'rgba(167,139,250,.10)'; g.fillRect(x - bw, yh, bw * 2, yl - yh); } }
      var yo = P(f.o), yc = P(f.c), yH = P(f.h), yL = P(f.l); if (yo == null || yc == null) continue;
      var up = f.c >= f.o; g.strokeStyle = up ? 'rgba(52,211,153,.75)' : 'rgba(244,114,182,.75)'; g.fillStyle = up ? 'rgba(52,211,153,.25)' : 'rgba(244,114,182,.25)';
      g.beginPath(); g.moveTo(x, yH); g.lineTo(x, yL); g.stroke(); g.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(1, Math.abs(yc - yo))); g.strokeRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(1, Math.abs(yc - yo)));
    }
  }
  chart.timeScale().subscribeVisibleLogicalRangeChange(function () { drawOverlay(); });
  new ResizeObserver(function () { drawOverlay(); }).observe(chartEl);
  chart.subscribeCrosshairMove(function () { });

  /* ------------------------------------------------------------------ panes: tester, trades, console, SMC, Kronos */
  var eqChart = null, eqSeries = null, bhSeries = null;
  function card(lbl, val, cls) { return '<div class="ps-card"><small>' + esc(lbl) + '</small><b class="' + (cls || '') + '">' + val + '</b></div>'; }
  function renderTester(r) {
    var P = paneEls.tester;
    if (!r || r.type !== 'done' && !r.indicator) { P.innerHTML = ''; return; }
    var s = r.strategy;
    if (!r.indicator || !r.indicator.strategy || !s) { P.innerHTML = '<p class="ps-mut">' + esc(t('noStrat')) + '</p>'; eqChart = null; return; }
    if (s.empty || (!s.trades.length && !s.open.length)) { P.innerHTML = '<p class="ps-mut">' + esc(t('noTrades')) + '</p>'; eqChart = null; return; }
    var S2 = s.stats, cap = S2.initial_capital || 1, T = s.trades, wins = T.filter(function (x) { return x.profit > 0; }), gp = wins.reduce(function (a, x) { return a + x.profit; }, 0),
      gl = T.filter(function (x) { return x.profit < 0; }).reduce(function (a, x) { return a - x.profit; }, 0), net = S2.netprofit;
    var html = '<div class="ps-cards">' +
      card(t('net'), nf(net, 2) + ' <small>(' + pc(net / cap * 100) + ')</small>', net >= 0 ? 'up' : 'dn') +
      card(t('ntr'), nf(T.length, 0)) + card(t('win'), T.length ? pc(wins.length / T.length * 100, 1).replace('+', '') : '—') +
      card(t('pf'), gl > 0 ? nf(gp / gl, 2) : (gp > 0 ? '∞' : '—')) +
      card(t('mdd'), S2.max_drawdown != null ? nf(S2.max_drawdown, 2) + (S2.max_drawdown_percent_value != null ? ' <small>(' + pc(-Math.abs(S2.max_drawdown_percent_value)) + ')</small>' : '') : '—', 'dn') +
      card(t('avg'), T.length ? nf(net / T.length, 2) : '—') + card(t('sharpe'), nf(S2.sharpe_ratio, 2)) + card(t('sortino'), nf(S2.sortino_ratio, 2)) +
      card(t('bh'), S2.buy_and_hold_per_gain != null ? pc(S2.buy_and_hold_per_gain) : (B.length ? pc((B[B.length - 1].c / B[0].c - 1) * 100) : '—')) +
      (s.open.length ? card(t('open'), nf(s.open.reduce(function (a, o) { return a + (B[B.length - 1].c - o.ep) * o.size; }, 0), 2)) : '') +
      '</div><h4>' + esc(t('eq')) + '</h4><div class="ps-eq"></div>';
    P.innerHTML = html;
    var box = P.querySelector('.ps-eq');
    eqChart = LW.createChart(box, { autoSize: true, layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#9aa4b2' }, grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(148,163,184,.06)' } }, rightPriceScale: { borderColor: '#1f2937' }, timeScale: { borderColor: '#1f2937', timeVisible: true } });
    eqSeries = eqChart.addSeries(LW.AreaSeries, { lineColor: '#f7931a', topColor: 'rgba(247,147,26,.35)', bottomColor: 'rgba(247,147,26,0)', lineWidth: 2, priceLineVisible: false });
    eqSeries.setData(s.equity.map(function (v, i) { return { time: B[i].t / 1000, value: v }; }));
    bhSeries = eqChart.addSeries(LW.LineSeries, { color: 'rgba(148,163,184,.6)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: t('bh') });
    var c0 = B[0].c; bhSeries.setData(B.map(function (b) { return { time: b.t / 1000, value: cap * b.c / c0 }; }));
    eqChart.timeScale().fitContent();
  }
  function renderTrades(r) {
    var P = paneEls.trades, s = r && r.strategy;
    if (!s || !s.trades || !s.trades.length) { P.innerHTML = '<p class="ps-mut">' + esc(s ? t('noTrades') : t('noStrat')) + '</p>'; return; }
    var rows = s.trades.slice().reverse().slice(0, 500).map(function (x, k) {
      var pct = x.ep ? (x.xp / x.ep - 1) * 100 * (x.size < 0 ? -1 : 1) : null;
      return '<tr><td>' + loc(s.trades.length - k) + '</td><td>' + esc(x.id) + '</td><td>' + (B[x.eb] ? fmtT(B[x.eb].t) : '—') + '<br><small>' + nf(x.ep, 6) + '</small></td><td>' +
        (B[x.xb] ? fmtT(B[x.xb].t) : '—') + '<br><small>' + nf(x.xp, 6) + '</small></td><td class="' + (x.profit >= 0 ? 'up' : 'dn') + '">' + nf(x.profit, 2) + '<br><small>' + pc(pct) + '</small></td></tr>';
    }).join('');
    P.innerHTML = '<div class="ps-tw"><table class="ps-tbl"><thead><tr><th>#</th><th>ID</th><th>' + esc(t('entry')) + '</th><th>' + esc(t('exit')) + '</th><th>' + esc(t('pnl')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function renderConsole(r) {
    var P = paneEls.console, h = '';
    if (r && r.error) h += '<p class="ps-e">✖ ' + esc(t('err')) + (r.error.line ? ' — ' + esc(t('line')) + ' ' + loc(r.error.line) : '') + '<br><code>' + esc(r.error.msg) + '</code></p>';
    if (r && r.ms != null && !r.error) h += '<p class="ps-ok">✔ ' + esc(t('ranIn')) + ' ' + loc(r.ms) + ' ' + esc(t('ms')) + ' — ' + loc(B.length) + ' ' + esc(t('bars')) + '</p>';
    (r && r.warnings || []).forEach(function (w) { h += '<p class="ps-w">⚠ ' + esc(w) + '</p>'; });
    if (r && r.alerts && r.alerts.length) h += '<h4>' + esc(t('alerts')) + '</h4>' + r.alerts.slice(-20).reverse().map(function (a) { return '<p class="ps-a">🔔 ' + esc(a.msg) + (a.bar != null && B[a.bar] ? ' <small>' + fmtT(B[a.bar].t) + '</small>' : '') + '</p>'; }).join('');
    P.innerHTML = h || '<p class="ps-mut">—</p>';
  }
  function renderSMCpane() {
    var P = paneEls.smc; if (!smcRes) { P.innerHTML = '<p class="ps-mut">—</p>'; return; }
    var R = smcRes, lp = B.length ? B[B.length - 1].c : 0;
    var tr = R.trend === 1 ? '<b class="up">' + t('trendUp') + '</b>' : R.trend === -1 ? '<b class="dn">' + t('trendDn') + '</b>' : t('trendNa');
    var ev = R.events.slice(-6).reverse().map(function (e) { return '<li><b style="color:' + (e.kind === 'CHoCH' ? '#a78bfa' : e.dir === 1 ? '#16c784' : '#ea3943') + '">' + e.kind + (e.dir === 1 ? ' ▲' : ' ▼') + '</b> ' + nf(e.p, 6) + ' <small>' + fmtT(B[e.i].t) + '</small></li>'; }).join('');
    var near = function (arr, nm) { var live = arr.filter(function (x) { return x.end == null; }).map(function (x) { return { x: x, d: Math.abs((x.top + x.bot) / 2 - lp) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 3);
      return live.map(function (o) { return '<li>' + nm + ' ' + (o.x.dir === 1 ? '▲' : '▼') + ' ' + nf(o.x.bot, 6) + ' – ' + nf(o.x.top, 6) + ' <small>(' + pc(((o.x.top + o.x.bot) / 2 / lp - 1) * 100) + ')</small></li>'; }).join(''); };
    var liq = R.liq.filter(function (l) { return l.swept == null; }).map(function (l) { return '<li>$$$ ' + (l.dir === 1 ? '▲' : '▼') + ' ' + nf(l.p, 6) + ' <small>×' + loc(l.n) + '</small></li>'; }).join('');
    P.innerHTML = '<div class="ps-smc"><p>' + tr + (R.zone ? ' — ' + esc(t('prem')) + ': ' + (lp > R.zone.eq ? 'Premium' : 'Discount') + ' <small>(EQ ' + nf(R.zone.eq, 6) + ')</small>' : '') + '</p>' +
      '<div class="ps-cols"><div><h4>BOS / CHoCH</h4><ul>' + ev + '</ul></div><div><h4>' + esc(t('ob')) + ' & ' + esc(t('fvg')) + '</h4><ul>' + near(R.obs, 'OB') + near(R.fvgs, 'FVG') + '</ul></div><div><h4>' + esc(t('liq')) + '</h4><ul>' + (liq || '<li>—</li>') + '</ul></div></div></div>';
  }
  function renderKro() {
    var P = paneEls.kronos;
    if (!kro || kro.sym !== st.sym || kro.tf !== st.tf) { P.innerHTML = '<p class="ps-mut">' + esc(t('kroNone')) + '</p><p class="ps-mut"><small>' + esc(t('kroNote')) + '</small></p>'; return; }
    var F = kro.f, lp = B.length ? B[B.length - 1].c : kro.last, end = F[F.length - 1];
    var hi = Math.max.apply(null, F.map(function (f) { return f.hi != null ? f.hi : f.h; })), lo = Math.min.apply(null, F.map(function (f) { return f.lo != null ? f.lo : f.l; }));
    P.innerHTML = '<div class="ps-cards">' + card('Kronos', esc(kro.model || 'Kronos')) + card(loc(F.length) + ' ' + t('kroH'), nf(end.c, 6) + ' <small>(' + pc((end.c / lp - 1) * 100) + ')</small>', end.c >= lp ? 'up' : 'dn') +
      card('↑', nf(hi, 6)) + card('↓', nf(lo, 6)) + card(t('kroAt'), fmtT(kro.at)) + '</div><p class="ps-mut"><small>' + esc(t('kroNote')) + '</small></p>';
  }
  async function loadKro() {
    kro = null; renderKro();
    if (!st.kro) { drawOverlay(); return; }
    try { var r = await fetch('/data/kronos/' + st.sym + '_' + st.tf + '.json', { cache: 'no-cache' }); if (r.ok) { var j = await r.json(); kro = { sym: st.sym, tf: st.tf, f: j.forecast, at: j.at, model: j.model, last: j.last }; } } catch (e) { }
    renderKro();
    if (kro && B.length) { var vr = chart.timeScale().getVisibleLogicalRange(); if (vr && vr.to < B.length + kro.f.length + 2) chart.timeScale().setVisibleLogicalRange({ from: vr.from + kro.f.length * .3, to: B.length + kro.f.length + 4 }); }
    drawOverlay();
  }


  /* ------------------------------------------------------------------ Pine screener: any Pine condition over up to 100 coins, with the filter's past edge */
  var SC = { src: SCAN_EX.rsi[1], n: 50, tf: '4h', fwd: 6, rows: [], run: 0, stop: false };
  try { var sv2 = JSON.parse(LS.getItem('ek_studio_scan') || '{}'); for (var k2 in sv2) if (k2 in SC && k2 !== 'rows' && k2 !== 'run') SC[k2] = sv2[k2]; } catch (e) { }
  var scPane = paneEls.scan, scHead = el('div', 'ps-bar'), scEx = el('select', 'ps-ex'), scN = el('select', 'ps-n'), scTf = el('select', 'ps-n'), scF = el('select', 'ps-n'), scGo = el('button', 'ps-run'), scProg = el('span', 'ps-mut');
  scGo.type = 'button';
  [20, 50, 100].forEach(function (v) { var o = el('option'); o.value = v; scN.appendChild(o); }); scN.value = SC.n;
  TFS.forEach(function (x) { if (x[0] === '1m') return; var o = el('option', '', x[0]); o.value = x[0]; scTf.appendChild(o); }); scTf.value = SC.tf;
  [3, 6, 12, 24].forEach(function (v) { var o = el('option'); o.value = v; scF.appendChild(o); }); scF.value = SC.fwd;
  [scEx, scN, scTf, scF, scGo, scProg].forEach(function (x) { scHead.appendChild(x); });
  var scHelp = el('p', 'ps-hint'), scEd = el('textarea', 'ps-scta'); scEd.spellcheck = false; scEd.wrap = 'off'; scEd.value = SC.src;
  var scEdge = el('div', ''), scRes = el('div', 'ps-tw');
  [scHead, scHelp, scEd, scEdge, scRes].forEach(function (x) { scPane.appendChild(x); });
  function scSave() { try { LS.setItem('ek_studio_scan', JSON.stringify({ src: SC.src, n: SC.n, tf: SC.tf, fwd: SC.fwd })); } catch (e) { } }
  function scTexts() {
    scEx.innerHTML = '<option value="">' + esc(t('examples')) + '</option>' + Object.keys(SCAN_EX).map(function (k) { return '<option value="' + k + '">' + esc(SCAN_EX[k][0]) + '</option>'; }).join('');
    Array.prototype.forEach.call(scN.options, function (o) { o.textContent = loc(o.value) + ' ' + t('top'); });
    Array.prototype.forEach.call(scF.options, function (o) { o.textContent = t('fwd') + ' ' + loc(o.value) + ' ' + t('bars'); });
    scGo.textContent = SC.run ? t('scanStop') : t('scanRun'); scHelp.textContent = t('scanHelp'); renderScan();
  }
  scEx.addEventListener('change', function () { var k = scEx.value; scEx.value = ''; if (!SCAN_EX[k]) return; scEd.value = SC.src = SCAN_EX[k][1]; scSave(); });
  scEd.addEventListener('input', function () { SC.src = scEd.value; scSave(); });
  scEd.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); scanAll(); } if (e.key === 'Tab') { e.preventDefault(); scEd.setRangeText('    ', scEd.selectionStart, scEd.selectionEnd, 'end'); } });
  [[scN, 'n'], [scTf, 'tf'], [scF, 'fwd']].forEach(function (x) { x[0].addEventListener('change', function () { SC[x[1]] = x[1] === 'tf' ? x[0].value : +x[0].value; scSave(); if (x[1] === 'fwd' && SC.rows.length) renderScan(); }); });
  scGo.addEventListener('click', function () { if (SC.run) { SC.stop = true; return; } scanAll(); });

  var pool = [], poolQ = [];
  function poolRun(msg) {
    return new Promise(function (res) {
      var w = pool.find(function (x) { return !x.busy; });
      if (!w && pool.length < 3) { w = { wk: new Worker('/assets/studio/worker.js?v=1'), busy: false }; w.wk.onmessage = function (ev) { var cb = w.cb; w.busy = false; w.cb = null; cb(ev.data); var nx = poolQ.shift(); if (nx) start(w, nx[0], nx[1]); }; pool.push(w); }
      if (w) start(w, msg, res); else poolQ.push([msg, res]);
    });
    function start(w, m, cb) { w.busy = true; w.cb = cb; w.wk.postMessage(m); }
  }
  async function universe(n) {
    var r = await fetch(API + 'ticker/24hr'); var a = await r.json();
    var bad = /^(USDC|FDUSD|TUSD|BUSD|USDP|DAI|EUR|AEUR|USDE|PAXG|WBTC|BFUSD|XUSD|USD1)USDT$|(UP|DOWN|BULL|BEAR)USDT$/;
    return a.filter(function (x) { return /USDT$/.test(x.symbol) && !bad.test(x.symbol) && +x.quoteVolume > 0 && x.count > 0; })
      .sort(function (a2, b2) { return +b2.quoteVolume - +a2.quoteVolume; }).slice(0, n)
      .map(function (x) { return { sym: x.symbol, chg: +x.priceChangePercent, last: +x.lastPrice, qv: +x.quoteVolume }; });
  }
  async function scanAll() {
    SC.run = ++runId; SC.stop = false; SC.rows = []; scGo.textContent = t('scanStop'); scEdge.innerHTML = ''; renderScan();
    var my = SC.run, U;
    try { U = await universe(SC.n); } catch (e) { scProg.textContent = t('fail'); SC.run = 0; scGo.textContent = t('scanRun'); return; }
    var tms = tfOf(SC.tf), done = 0, errs = 0;
    async function one(u) {
      if (SC.stop || SC.run !== my) return;
      try {
        var r = await fetch(API + 'klines?symbol=' + u.sym + '&interval=' + SC.tf + '&limit=500'); var a = await r.json();
        var bars = a.map(function (k) { return { t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }; });
        if (bars.length < 50) throw new Error('short');
        var res = await poolRun({ type: 'run', id: u.sym, src: SC.src, bars: bars, symbol: u.sym, tf: PINE_TF[SC.tf], tfMs: tms });
        if (res.type === 'error') { errs++; if (errs === 1) scProg.textContent = t('err') + ': ' + res.msg.slice(0, 140); throw new Error(res.msg); }
        var n = bars.length, lc = bars[n - 1].t + tms > Date.now() ? n - 2 : n - 1;
        var mp = res.plots.find(function (p) { return /^match$/i.test(p.title); }) || res.plots[0];
        var cols = res.plots.filter(function (p) { return p !== mp && p.style !== 'hline' && p.style !== 'background'; }).slice(0, 4);
        var hits = [];
        if (mp) for (var i = 0; i < n - 1; i++) if (mp.vals[i]) hits.push(i);
        SC.rows.push({ u: u, match: !!(mp && mp.vals[lc]), cols: cols.map(function (p) { return [p.title, p.vals[lc]]; }), hits: hits, close: bars.map(function (b) { return b.c; }), lc: lc });
      } catch (e) { SC.rows.push({ u: u, err: true }); }
      done++; scProg.textContent = loc(done) + ' / ' + loc(U.length) + ' ' + t('scanned');
      if (done % 5 === 0) renderScan();
    }
    var idx = 0;
    await Promise.all([0, 1, 2, 3, 4].map(async function () { while (idx < U.length && !SC.stop && SC.run === my) await one(U[idx++]); }));
    if (SC.run === my) { SC.run = 0; scGo.textContent = t('scanRun'); }
    renderScan();
  }
  function renderScan() {
    var R = SC.rows.filter(function (r) { return !r.err; }), F = SC.fwd;
    if (!R.length) { scRes.innerHTML = ''; scEdge.innerHTML = ''; return; }
    // the filter's edge: forward returns after every past hit, on every coin scanned
    var rets = [];
    R.forEach(function (r) { r.hits.forEach(function (i) { if (i + F <= r.lc) rets.push(r.close[i + F] / r.close[i] - 1); }); });
    var base = [];
    R.forEach(function (r) { for (var i = 0; i + F <= r.lc; i += F) base.push(r.close[i + F] / r.close[i] - 1); });
    var avg = function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; };
    var pos = function (a) { return a.length ? a.filter(function (x) { return x > 0; }).length / a.length : null; };
    scEdge.innerHTML = '<div class="ps-cards">' + card(t('hits'), nf(rets.length, 0)) + card(t('avgRet') + ' (' + loc(F) + ' ' + t('bars') + ')', pc(avg(rets) * 100), avg(rets) >= 0 ? 'up' : 'dn') +
      card(t('winR'), rets.length ? pc(pos(rets) * 100, 1).replace('+', '') : '—') + card(t('avgRet') + ' — ' + t('bh'), pc(avg(base) * 100)) + card(t('matched'), nf(R.filter(function (r) { return r.match; }).length, 0) + ' / ' + nf(R.length, 0)) +
      '</div><p class="ps-mut"><small>' + esc(t('scanEdge')) + '</small></p>';
    var heads = (R.find(function (r) { return r.cols.length; }) || { cols: [] }).cols.map(function (c) { return '<th>' + esc(c[0]) + '</th>'; }).join('');
    R.sort(function (a, b) { return (b.match - a.match) || (b.u.qv - a.u.qv); });
    scRes.innerHTML = '<table class="ps-tbl ps-scan"><thead><tr><th></th><th>' + esc(t('coin')) + '</th><th>$</th><th>24h</th>' + heads + '<th>' + esc(t('hits')) + '</th><th>' + esc(t('avgRet')) + '</th></tr></thead><tbody>' +
      R.map(function (r) {
        var rr = r.hits.filter(function (i) { return i + F <= r.lc; }).map(function (i) { return r.close[i + F] / r.close[i] - 1; }), a = avg(rr);
        return '<tr data-s="' + r.u.sym + '" class="' + (r.match ? 'hit' : '') + '"><td>' + (r.match ? '✅' : '') + '</td><td><b>' + esc(r.u.sym.replace(/USDT$/, '')) + '</b></td><td>' + nf(r.u.last, 6) + '</td><td class="' + (r.u.chg >= 0 ? 'up' : 'dn') + '">' + pc(r.u.chg) + '</td>' +
          r.cols.map(function (c) { return '<td>' + nf(c[1], 2) + '</td>'; }).join('') + '<td>' + nf(rr.length, 0) + '</td><td class="' + (a >= 0 ? 'up' : 'dn') + '">' + (a == null ? '—' : pc(a * 100)) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  scRes.addEventListener('click', function (e) { var tr = e.target.closest('tr[data-s]'); if (!tr) return; st.sym = tr.dataset.s; st.tf = SC.tf; coinSel.value = st.sym.replace(/USDT$/, ''); reload(); root.scrollIntoView({ behavior: 'smooth' }); });
  window.addEventListener('ek-lang', scTexts);


  /* ------------------------------------------------------------------ TradingView alerts (webhook → Cloudflare Worker → this feed) */
  var HOOK = 'https://entekhab-tv.omid-mokri.workers.dev', hookPane = paneEls.tvhook, hookT = null;
  var HOOK_MSG = '{"symbol":"{{ticker}}","tf":"{{interval}}","price":{{close}},"side":"{{strategy.order.action}}","text":"{{strategy.order.comment}}"}';
  function hookTexts() {
    hookPane.innerHTML = '<p class="ps-mut">' + esc(t('hookHow')) + '</p>' +
      '<div class="ps-hook"><small>' + esc(t('hookUrl')) + '</small><code>' + esc(HOOK + '/tv') + '</code><button type="button" class="ps-btn" data-c="u">' + esc(t('copy')) + '</button></div>' +
      '<div class="ps-hook"><small>' + esc(t('hookMsg')) + '</small><code>' + esc(HOOK_MSG) + '</code><button type="button" class="ps-btn" data-c="m">' + esc(t('copy')) + '</button></div>' +
      '<div class="ps-feed"></div>';
    loadHook();
  }
  hookPane.addEventListener('click', function (e) { var b = e.target.closest('button[data-c]'); if (!b) return; var v = b.dataset.c === 'u' ? HOOK + '/tv' : HOOK_MSG; (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { toast(t('copied').replace(/لینک|بەستەر|Link/, '✓')); }, function () { prompt('', v); }); });
  async function loadHook() {
    var box = hookPane.querySelector('.ps-feed'); if (!box) return;
    try {
      var j = await (await fetch(HOOK + '/alerts?limit=50', { cache: 'no-store' })).json(), A = j.alerts || [];
      box.innerHTML = A.length ? '<table class="ps-tbl"><tbody>' + A.map(function (a) {
        return '<tr><td><small>' + fmtT(a.at) + '</small></td><td><b>' + esc(a.symbol || '—') + '</b> ' + esc(a.tf || '') + '</td><td>' + (a.side ? '<b class="' + (/buy|long/i.test(a.side) ? 'up' : /sell|short/i.test(a.side) ? 'dn' : '') + '">' + esc(a.side) + '</b>' : '') + '</td><td>' + (a.price != null ? nf(a.price, 6) : '') + '</td><td>' + esc(a.text || '') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="ps-mut">' + esc(t('hookNone')) + '</p>';
    } catch (e) { box.innerHTML = '<p class="ps-mut">' + esc(t('fail')) + '</p>'; }
  }
  setInterval(function () { if (curTab === 'tvhook' && !document.hidden) loadHook(); }, 15000);
  window.addEventListener('ek-lang', hookTexts);

  /* ------------------------------------------------------------------ controls */
  function markTf() { Array.prototype.forEach.call(tfBox.children, function (b) { b.classList.toggle('on', b.dataset.tf === st.tf); }); }
  async function reload() {
    persist(); markTf(); clearScript(); if (csMarkers) csMarkers.setMarkers([]); last = null;
    if (await loadBars()) { smcRes = st.smc && window.SMC ? SMC.run(B) : null; renderSMCpane(); connect(); runScript(); loadKro(); }
  }
  coinSel.addEventListener('change', function () { var v = coinSel.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!v) return; st.sym = v.replace(/USDT$/, '') + 'USDT'; coinSel.value = v.replace(/USDT$/, ''); reload(); });
  coinSel.addEventListener('keydown', function (e) { if (e.key === 'Enter') coinSel.blur(); });
  tfBox.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b || b.dataset.tf === st.tf) return; st.tf = b.dataset.tf; reload(); });
  nSel.addEventListener('change', function () { st.n = +nSel.value; reload(); });
  runB.addEventListener('click', runScript);
  liveC.addEventListener('change', function () { st.live = liveC.checked; persist(); connect(); });
  smcC.addEventListener('change', function () { st.smc = smcC.checked; persist(); smcRes = st.smc && window.SMC ? SMC.run(B) : null; renderSMCpane(); drawOverlay(); });
  kroC.addEventListener('change', function () { st.kro = kroC.checked; persist(); loadKro(); });
  exSel.addEventListener('change', function () { var k = exSel.value; exSel.value = ''; if (!EX[k]) return; ta.value = EX[k][1]; st.name = ''; nameIn.value = ''; ta.dispatchEvent(new Event('input')); runScript(); });
  mySel.addEventListener('change', function () {
    var k = mySel.value; mySel.value = ''; if (!k) return;
    if (k === '__new') { ta.value = '//@version=5\nindicator("My script", overlay=true)\nplot(ta.sma(close, 20), "SMA 20")\n'; st.name = ''; nameIn.value = ''; ta.dispatchEvent(new Event('input')); runScript(); return; }
    var M = myScripts(); if (M[k] == null) return; ta.value = M[k]; st.name = k; nameIn.value = k; ta.dispatchEvent(new Event('input')); runScript();
  });
  function toast(s) { var x = el('div', 'ps-toast', esc(s)); root.appendChild(x); setTimeout(function () { x.remove(); }, 1800); }
  function saveScript() {
    var nm = (nameIn.value || '').trim() || ((/(?:indicator|strategy)\(\s*"([^"]+)"/.exec(ta.value) || [])[1]) || 'Script';
    var M = myScripts(); M[nm] = ta.value; try { LS.setItem('ek_studio_scripts', JSON.stringify(M)); } catch (e) { }
    st.name = nm; nameIn.value = nm; persist(); fillMine(); toast(t('saved'));
  }
  saveB.addEventListener('click', saveScript);
  shareB.addEventListener('click', function () {
    var enc = btoa(unescape(encodeURIComponent(ta.value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    var url = location.origin + location.pathname + '?symbol=' + st.sym.replace(/USDT$/, '') + '#s=' + enc;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast(t('copied')); }, function () { prompt('URL', url); });
  });
  dlB.addEventListener('click', function () {
    var a = el('a'); a.href = URL.createObjectURL(new Blob([ta.value], { type: 'text/plain' })); a.download = ((nameIn.value || 'script').replace(/[^\w\-]+/g, '_')) + '.pine'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  window.addEventListener('ek-lang', texts);

  edUpdate(); texts(); scTexts(); hookTexts(); showTab('tester'); markTf(); reload();
})();
