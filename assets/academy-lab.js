/* CRYPTO MASTER ACADEMY — Lab (entekhab.net/academy/lab/)
   Paper trading on historical candles without lookahead, journal, educational backtest, calculators,
   SHA-256 / proof-of-work playground, key & signature demo, real Bitcoin transaction explorer.
   Virtual money only. State: localStorage 'ek_acad_lab' (journal) — stays in this browser. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var LK = 'ek_acad_lab', LAB;
  try { LAB = JSON.parse(localStorage.getItem(LK) || '{}') || {}; } catch (e) { LAB = {}; }
  LAB.journal = LAB.journal || [];
  function save() { try { localStorage.setItem(LK, JSON.stringify(LAB)); } catch (e) { } }
  function used(k) { try { if (window.ACAD) window.ACAD.act('lab:' + k); } catch (e) { } }
  var FAD = { '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9, '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9 };
  function num(id) { var el = document.getElementById(id); if (!el) return NaN; var v = String(el.value).replace(/[۰-۹٠-٩]/g, function (d) { return FAD[d]; }).replace(/[,٬\s]/g, '').replace('٫', '.'); return v === '' ? NaN : parseFloat(v); }
  function f(n, d) { if (n == null || !isFinite(n)) return '—'; d = d == null ? (Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 1 ? 4 : 8) : d; return n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 }); }
  function usd(n) { return isFinite(n) ? (n < 0 ? '-$' : '$') + f(Math.abs(n), 2) : '—'; }
  function pc(n, d) { return isFinite(n) ? f(n, d == null ? 2 : d) + '%' : '—'; }
  function cls(n) { return n > 0 ? 'up' : n < 0 ? 'down' : ''; }
  function out(id, items) { var el = document.getElementById(id); if (el) el.innerHTML = items.map(function (x) { return '<div><small>' + x[0] + '</small><b class="' + (x[2] || '') + '">' + x[1] + '</b></div>'; }).join(''); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function on(ids, fn) { ids.forEach(function (id) { var el = document.getElementById(id); if (el) { el.addEventListener('input', fn); el.addEventListener('change', fn); } }); fn(); }

  // ------------------------------------------------------------ candles (Binance live → entekhab.net fallback)
  var CACHE = {};
  function getK(sym, iv) {
    var key = sym + iv; if (CACHE[key]) return Promise.resolve(CACHE[key]);
    function live() {
      var ctl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
      return fetch('https://data-api.binance.vision/api/v3/klines?symbol=' + sym + '&interval=' + iv + '&limit=1000', ctl ? { signal: ctl.signal } : {})
        .then(function (r) { clearTimeout(tm); if (!r.ok) throw 0; return r.json(); })
        .then(function (d) { return d.map(function (x) { return [+x[0], +x[1], +x[2], +x[3], +x[4], +x[5]]; }); });
    }
    function local() { return fetch('/academy/data/k_' + sym + '_' + iv + '.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }); }
    return live().catch(local).then(function (d) {
      if (!d || d.length < 200) throw new Error('short');
      var k = d.map(function (x) { return { t: x[0], o: x[1], h: x[2], l: x[3], c: x[4], v: x[5] }; });
      CACHE[key] = k; return k;
    });
  }
  function ema(arr, n) { var k = 2 / (n + 1), o = [], p; arr.forEach(function (v, i) { p = i === 0 ? v : v * k + p * (1 - k); o.push(i < n - 1 ? null : p); }); return o; }
  function rsi(cl, n) {
    var o = [null], g = 0, l = 0;
    for (var i = 1; i < cl.length; i++) {
      var d = cl[i] - cl[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
      if (i <= n) { g += up; l += dn; o.push(i === n ? (l === 0 ? 100 : 100 - 100 / (1 + g / l)) : null); if (i === n) { g /= n; l /= n; } }
      else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; o.push(l === 0 ? 100 : 100 - 100 / (1 + g / l)); }
    }
    return o;
  }

  // ------------------------------------------------------------ chart
  function setup(cv) {
    var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(10, r.width * dpr); cv.height = Math.max(10, r.height * dpr);
    var x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return { x: x, w: r.width, h: r.height };
  }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888'; }
  function drawCandles(cv, k, from, to, opt) {
    var g = setup(cv), x = g.x, W = g.w, H = g.h, padR = 64, volH = H * 0.16, top = 10, bot = H - volH - 18;
    var vis = k.slice(from, to + 1), n = vis.length; x.clearRect(0, 0, W, H);
    if (!n) return null;
    var hi = -Infinity, lo = Infinity, vmax = 0;
    vis.forEach(function (c) { hi = Math.max(hi, c.h); lo = Math.min(lo, c.l); vmax = Math.max(vmax, c.v); });
    (opt.lines || []).forEach(function (l) { if (l.p) { hi = Math.max(hi, l.p); lo = Math.min(lo, l.p); } });
    var pad = (hi - lo) * 0.06 || 1; hi += pad; lo -= pad;
    var cw = (W - padR) / Math.max(n, 60), Y = function (p) { return top + (hi - p) / (hi - lo) * (bot - top); };
    var line = css('--line'), mute = css('--mute');
    x.font = '11px "Space Grotesk",sans-serif'; x.fillStyle = mute; x.strokeStyle = line; x.lineWidth = 1;
    for (var i = 0; i <= 4; i++) { var p = lo + (hi - lo) * i / 4, y = Y(p); x.beginPath(); x.moveTo(0, y); x.lineTo(W - padR, y); x.stroke(); x.fillText(f(p, p >= 100 ? 0 : 4), W - padR + 4, y + 4); }
    vis.forEach(function (c, j) {
      var cx = j * cw + cw / 2, up = c.c >= c.o, col = up ? '#22c55e' : '#ef4444';
      x.strokeStyle = col; x.fillStyle = col; x.beginPath(); x.moveTo(cx, Y(c.h)); x.lineTo(cx, Y(c.l)); x.stroke();
      var y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c)); x.fillRect(cx - Math.max(1, cw * 0.35), y1, Math.max(1, cw * 0.7), Math.max(1, y2 - y1));
      x.globalAlpha = 0.35; var vh = vmax ? c.v / vmax * volH : 0; x.fillRect(cx - Math.max(1, cw * 0.35), H - 14 - vh, Math.max(1, cw * 0.7), vh); x.globalAlpha = 1;
    });
    (opt.series || []).forEach(function (s) {
      x.strokeStyle = s.c; x.lineWidth = 1.4; x.beginPath(); var st = false;
      for (var j = 0; j < n; j++) { var v = s.d[from + j]; if (v == null) { st = false; continue; } var cx = j * cw + cw / 2; if (!st) { x.moveTo(cx, Y(v)); st = true; } else x.lineTo(cx, Y(v)); }
      x.stroke(); x.lineWidth = 1;
    });
    (opt.lines || []).forEach(function (l) {
      if (!l.p) return; var y = Y(l.p); x.strokeStyle = l.c; x.setLineDash(l.dash ? [5, 4] : []); x.beginPath(); x.moveTo(0, y); x.lineTo(W - padR, y); x.stroke(); x.setLineDash([]);
      x.fillStyle = l.c; x.fillRect(W - padR, y - 8, padR, 16); x.fillStyle = '#000'; x.fillText(l.t || f(l.p, l.p >= 100 ? 0 : 4), W - padR + 3, y + 4);
    });
    (opt.marks || []).forEach(function (m) { var j = m.i - from; if (j < 0 || j >= n) return; var cx = j * cw + cw / 2; x.fillStyle = m.c; x.beginPath(); x.arc(cx, Y(m.p), 4, 0, 7); x.fill(); });
    return { Yinv: function (y) { return hi - (y - top) / (bot - top) * (hi - lo); } };
  }

  // ------------------------------------------------------------ simulator
  var SIM = null, scale = null, drawMode = false, timer = null;
  var FEE = { spot: 0.001, fut: 0.0005 }, MMR = 0.005, START = 10000, WIN = 120;
  function simMsg(t, err) { var m = $('#sMsg'); m.textContent = t || ''; m.className = 'lab-msg' + (err ? ' err' : ''); }
  function newSim() {
    stopPlay(); simMsg('در حال بارگذاری کندل‌ها…');
    var sym = $('#sSym').value, iv = $('#sIv').value, mode = $('#sMode').value;
    getK(sym, iv).then(function (k) {
      var start = 150 + Math.floor(Math.random() * Math.max(1, k.length - 150 - 120));
      var cl = k.map(function (c) { return c.c; });
      SIM = { k: k, sym: sym, iv: iv, mode: mode, start: start, i: start, cash: START, pos: null, ord: null, trades: [], peak: START, mdd: 0, levels: [], e20: ema(cl, 20), e50: ema(cl, 50) };
      $('#oSide').querySelector('[value=short]').disabled = mode !== 'fut';
      if (mode !== 'fut') $('#oSide').value = 'long';
      $('#oLev').disabled = mode !== 'fut';
      simMsg('دورهٔ تازه شروع شد. تاریخ‌ها پنهان‌اند تا حافظهٔ شما از گذشته به تحلیل کمک نکند.'); render(); used('sim');
    }).catch(function () { simMsg('دادهٔ کندل در دسترس نیست (نه از Binance و نه از نسخهٔ پشتیبان سایت). بعداً دوباره امتحان کنید.', true); });
  }
  function px() { return SIM.k[SIM.i].c; }
  function unreal(p) { var s = SIM.pos; if (!s) return 0; return (p - s.en) * s.q * (s.side === 'long' ? 1 : -1); }
  function equity(p) { var s = SIM.pos; if (!s) return SIM.cash; return SIM.mode === 'spot' ? SIM.cash + s.q * p : SIM.cash + s.m + unreal(p); }
  function closePos(exit, why) {
    var s = SIM.pos, fee = exit * s.q * FEE[SIM.mode], pnl;
    if (why === 'liq') { pnl = -s.m; fee = 0; }
    else if (SIM.mode === 'spot') { SIM.cash += s.q * exit - fee; pnl = (exit - s.en) * s.q - fee - s.fee; }
    else { var g = unreal(exit); SIM.cash += s.m + g - fee; pnl = g - fee - s.fee; }
    var risk = s.sl ? Math.abs(s.en - s.sl) * s.q : null;
    var tr = { src: 'sim', sym: SIM.sym + ' ' + SIM.iv, side: s.side, en: s.en, ex: exit, q: s.q, sl: s.sl || null, tp: s.tp || null, pnl: pnl, r: risk ? pnl / risk : null, why: why, mode: SIM.mode, lev: s.lev, bars: SIM.i - s.i0, t: Date.now(), emo: '', note: '' };
    SIM.trades.push(tr); LAB.journal.unshift(tr); LAB.journal = LAB.journal.slice(0, 500); save(); SIM.pos = null;
    var W = { tp: 'حد سود', sl: 'حد ضرر', liq: 'لیکوئید شد!', manual: 'بستن دستی', end: 'پایان دوره' }[why];
    simMsg('پوزیشن بسته شد (' + W + ') · ' + (pnl >= 0 ? 'سود ' : 'زیان ') + usd(Math.abs(pnl)), pnl < 0); journal();
  }
  function step() {
    if (!SIM) return;
    if (SIM.i >= SIM.k.length - 1) { endSim(); return; }
    SIM.i++; var c = SIM.k[SIM.i], o = SIM.ord;
    if (o) {
      var fill = null;
      if (o.type === 'market' || o.type === 'close') fill = c.o;
      else if (o.type === 'limit') { if (o.side === 'long' && c.l <= o.px) fill = Math.min(o.px, c.o); if (o.side === 'short' && c.h >= o.px) fill = Math.max(o.px, c.o); }
      else if (o.type === 'stop') { if (o.side === 'long' && c.h >= o.px) fill = Math.max(o.px, c.o); if (o.side === 'short' && c.l <= o.px) fill = Math.min(o.px, c.o); }
      if (fill != null) {
        SIM.ord = null;
        if (o.type === 'close') { if (SIM.pos) closePos(fill, 'manual'); }
        else openPos(o, fill);
      }
    }
    var s = SIM.pos;
    if (s && s.i0 <= SIM.i) {
      var L = s.side === 'long';
      if (s.liq && (L ? c.l <= s.liq : c.h >= s.liq)) closePos(s.liq, 'liq');
      else if (s.sl && (L ? c.l <= s.sl : c.h >= s.sl)) closePos(L ? Math.min(s.sl, c.o) : Math.max(s.sl, c.o), 'sl');
      else if (s.tp && (L ? c.h >= s.tp : c.l <= s.tp)) closePos(L ? Math.max(s.tp, c.o) : Math.min(s.tp, c.o), 'tp');
    }
    var eq = equity(c.c); SIM.peak = Math.max(SIM.peak, eq); SIM.mdd = Math.max(SIM.mdd, (SIM.peak - eq) / SIM.peak);
    render();
  }
  function openPos(o, fill) {
    var eq = equity(fill), q = o.q, fee;
    if (o.sl && Math.abs(fill - o.sl) > 0 && o.risk) q = eq * o.risk / 100 / Math.abs(fill - o.sl);
    if (SIM.mode === 'spot') { var maxQ = SIM.cash / (fill * (1 + FEE.spot)); q = Math.min(q, maxQ); }
    else { var maxQf = SIM.cash * o.lev / (fill * (1 + FEE.fut * o.lev)); q = Math.min(q, maxQf); }
    if (!(q > 0)) { simMsg('موجودی کافی برای این سفارش نیست.', true); return; }
    fee = fill * q * FEE[SIM.mode];
    var p = { side: o.side, q: q, en: fill, sl: o.sl, tp: o.tp, lev: SIM.mode === 'fut' ? o.lev : 1, fee: fee, i0: SIM.i, m: 0, liq: null };
    if (SIM.mode === 'spot') SIM.cash -= q * fill + fee;
    else { p.m = q * fill / o.lev; SIM.cash -= p.m + fee; p.liq = o.side === 'long' ? fill * (1 - 1 / o.lev + MMR) : fill * (1 + 1 / o.lev - MMR); }
    if (p.sl && ((o.side === 'long' && p.sl >= fill) || (o.side === 'short' && p.sl <= fill))) p.sl = null;
    SIM.pos = p; simMsg('سفارش پر شد: ' + (o.side === 'long' ? 'لانگ' : 'شورت') + ' ' + f(q) + ' واحد در ' + f(fill) + (p.sl ? '' : ' · ⚠️ بدون حد ضرر'), !p.sl);
  }
  function endSim() {
    stopPlay(); if (SIM.pos) closePos(px(), 'end');
    var a = new Date(SIM.k[SIM.start].t), b = new Date(SIM.k[SIM.i].t);
    simMsg('پایان داده. این دوره از ' + a.toISOString().slice(0, 10) + ' تا ' + b.toISOString().slice(0, 10) + ' بود. برای دورهٔ تازه «شروع دورهٔ تازه» را بزنید.');
  }
  function render() {
    if (!SIM) return;
    var from = Math.max(0, SIM.i - WIN + 1), lines = (SIM.levels || []).map(function (p) { return { p: p, c: '#a78bfa', dash: true }; });
    var s = SIM.pos, o = SIM.ord;
    if (s) { lines.push({ p: s.en, c: '#60a5fa', t: 'ورود' }); if (s.sl) lines.push({ p: s.sl, c: '#ef4444', t: 'SL' }); if (s.tp) lines.push({ p: s.tp, c: '#22c55e', t: 'TP' }); if (s.liq) lines.push({ p: s.liq, c: '#f59e0b', t: 'LIQ', dash: true }); }
    if (o && o.px) lines.push({ p: o.px, c: '#eab308', t: o.type === 'limit' ? 'LMT' : 'STP', dash: true });
    var series = $('#sEma').checked ? [{ d: SIM.e20, c: '#f7931a' }, { d: SIM.e50, c: '#38bdf8' }] : [];
    scale = drawCandles($('#sCv'), SIM.k, from, SIM.i, { lines: lines, series: series });
    var p = px(), eq = equity(p), tr = SIM.trades, wins = tr.filter(function (t) { return t.pnl > 0; }).length;
    var rs = tr.filter(function (t) { return t.r != null; }), avgR = rs.length ? rs.reduce(function (a, t) { return a + t.r; }, 0) / rs.length : NaN;
    out('sAcct', [
      ['کندل', (SIM.i - SIM.start + 1) + ' / ' + (SIM.k.length - SIM.start)], ['قیمت فعلی', f(p)], ['ارزش حساب (مجازی)', usd(eq), cls(eq - START)], ['بازده دوره', pc((eq / START - 1) * 100), cls(eq - START)],
      ['نقد آزاد', usd(SIM.cash)], ['پوزیشن', s ? (s.side === 'long' ? 'لانگ ' : 'شورت ') + f(s.q) + (s.lev > 1 ? ' ×' + s.lev : '') : '—'],
      ['سود/زیان باز', s ? usd(unreal(p)) : '—', cls(unreal(p))], ['معامله‌ها / برد', tr.length + ' / ' + (tr.length ? pc(wins / tr.length * 100, 0) : '—')],
      ['میانگین R', isFinite(avgR) ? f(avgR, 2) + 'R' : '—', cls(avgR)], ['بیشترین افت سرمایه', pc(-SIM.mdd * 100), SIM.mdd ? 'down' : ''], ['سفارش باز', o ? (o.type + ' ' + (o.px ? f(o.px) : '')) : '—']
    ]);
    $('#sTbl').innerHTML = tr.length ? '<tr><th>#</th><th>جهت</th><th>ورود</th><th>خروج</th><th>دلیل</th><th>سود/زیان</th><th>R</th></tr>' + tr.slice().reverse().map(function (t, i) {
      return '<tr><td>' + (tr.length - i) + '</td><td>' + (t.side === 'long' ? 'لانگ' : 'شورت') + '</td><td>' + f(t.en) + '</td><td>' + f(t.ex) + '</td><td>' + t.why + '</td><td class="' + cls(t.pnl) + '">' + usd(t.pnl) + '</td><td>' + (t.r != null ? f(t.r, 2) : '—') + '</td></tr>';
    }).join('') : '';
    calcOrder();
  }
  function calcOrder() {
    if (!SIM) return; var ref = $('#oType').value === 'market' ? px() : num('oPx'), sl = num('oSl'), r = num('oRisk'), eq = equity(px());
    var t = '';
    if (isFinite(ref) && isFinite(sl) && sl > 0 && isFinite(r)) { var q = eq * r / 100 / Math.abs(ref - sl); t = 'با ریسک ' + f(r, 2) + '٪ (' + usd(eq * r / 100) + ') حجم تقریبی ' + f(q) + ' واحد به ارزش ' + usd(q * ref) + ' است' + (SIM.mode === 'fut' ? ' · مارجین لازم با اهرم ' + num('oLev') + ': ' + usd(q * ref / Math.max(1, num('oLev'))) : '') + '.'; }
    else t = 'حد ضرر را وارد کنید تا حجم بر اساس درصد ریسک محاسبه شود؛ بدون حد ضرر، ۱۰٪ موجودی وارد معامله می‌شود.';
    $('#oCalc').textContent = t;
  }
  function placeOrder() {
    if (!SIM) { simMsg('اول یک دوره شروع کنید.', true); return; }
    if (SIM.pos) { simMsg('در این شبیه‌ساز در هر لحظه یک پوزیشن باز مجاز است؛ اول پوزیشن فعلی را ببندید.', true); return; }
    var side = $('#oSide').value, type = $('#oType').value, p = num('oPx'), sl = num('oSl'), tp = num('oTp'), lev = Math.min(20, Math.max(1, Math.round(num('oLev') || 1)));
    if (SIM.mode === 'spot' && side === 'short') { simMsg('در اسپات فقط خرید ممکن است.', true); return; }
    if (type !== 'market' && !(p > 0)) { simMsg('برای Limit و Stop قیمت سفارش لازم است.', true); return; }
    var ref = type === 'market' ? px() : p;
    if (sl > 0 && ((side === 'long' && sl >= ref) || (side === 'short' && sl <= ref))) { simMsg('حد ضرر باید در جهت زیان باشد (لانگ: پایین‌تر از ورود؛ شورت: بالاتر).', true); return; }
    if (tp > 0 && ((side === 'long' && tp <= ref) || (side === 'short' && tp >= ref))) { simMsg('حد سود باید در جهت سود باشد.', true); return; }
    var eq = equity(px()), q = sl > 0 ? eq * (num('oRisk') || 1) / 100 / Math.abs(ref - sl) : eq * 0.1 / ref;
    SIM.ord = { side: side, type: type, px: type === 'market' ? null : p, sl: sl > 0 ? sl : null, tp: tp > 0 ? tp : null, lev: SIM.mode === 'fut' ? lev : 1, q: q, risk: sl > 0 ? (num('oRisk') || 1) : null };
    simMsg(type === 'market' ? 'سفارش Market در باز شدن کندل بعد اجرا می‌شود.' : 'سفارش ' + type + ' ثبت شد و تا پر شدن یا لغو منتظر می‌ماند.'); render();
  }
  function stopPlay() { if (timer) { clearInterval(timer); timer = null; var b = $('#sPlay'); if (b) b.textContent = '⏯ پخش خودکار'; } }
  if ($('#sCv')) {
    $('#sNew').onclick = newSim; $('#sNext').onclick = step; $('#sNext5').onclick = function () { for (var i = 0; i < 5; i++) step(); };
    $('#sPlay').onclick = function () { if (timer) { stopPlay(); return; } if (!SIM) return; this.textContent = '⏸ توقف'; timer = setInterval(step, 600); };
    $('#sDraw').onclick = function () { drawMode = !drawMode; this.classList.toggle('on', drawMode); simMsg(drawMode ? 'روی نمودار کلیک کنید تا سطح افقی رسم شود.' : ''); };
    $('#sClr').onclick = function () { if (SIM) { SIM.levels = []; render(); } };
    $('#sCv').addEventListener('click', function (ev) {
      if (!drawMode || !SIM || !scale) return; var r = this.getBoundingClientRect(), p = scale.Yinv(ev.clientY - r.top);
      SIM.levels.push(p); drawMode = false; $('#sDraw').classList.remove('on'); simMsg('سطح ' + f(p) + ' رسم شد.'); render();
    });
    $('#sEma').onchange = render; ['sSym', 'sIv', 'sMode'].forEach(function (id) { $('#' + id).onchange = newSim; });
    $('#oGo').onclick = placeOrder;
    $('#oClose').onclick = function () { if (SIM && SIM.pos) { SIM.ord = { type: 'close' }; simMsg('پوزیشن در باز شدن کندل بعد بسته می‌شود.'); render(); } };
    $('#oCancel').onclick = function () { if (SIM) { SIM.ord = null; simMsg('سفارش‌های باز لغو شد.'); render(); } };
    ['oType', 'oPx', 'oSl', 'oRisk', 'oLev'].forEach(function (id) { $('#' + id).addEventListener('input', calcOrder); });
    window.addEventListener('resize', function () { render(); });
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) { if (en[0].isIntersecting && !SIM) { newSim(); io.disconnect(); } }) : null;
    if (io) io.observe($('#sCv')); else newSim();
  }

  // ------------------------------------------------------------ journal
  function journal() {
    var J = LAB.journal, tb = $('#jTbl'); if (!tb) return;
    var EMO = { calm: 'آرام', fomo: 'FOMO', revenge: 'انتقام', unsure: 'مردد', '': '—' };
    tb.innerHTML = J.length ? '<tr><th>منبع</th><th>نماد</th><th>جهت</th><th>ورود</th><th>خروج</th><th>SL</th><th>سود/زیان</th><th>R</th><th>حس</th><th>یادداشت</th><th></th></tr>' + J.slice(0, 100).map(function (t, i) {
      return '<tr><td>' + (t.src === 'sim' ? 'شبیه‌ساز' : 'دستی') + '</td><td>' + esc(t.sym) + '</td><td>' + (t.side === 'long' ? 'لانگ' : 'شورت') + '</td><td>' + f(t.en) + '</td><td>' + f(t.ex) + '</td><td>' + (t.sl ? f(t.sl) : '⚠️') + '</td>' +
        '<td class="' + cls(t.pnl) + '">' + usd(t.pnl) + '</td><td>' + (t.r != null ? f(t.r, 2) : '—') + '</td>' +
        '<td><select data-emo="' + i + '" class="lab-in" style="padding:2px">' + Object.keys(EMO).filter(Boolean).map(function (k) { return '<option value="' + k + '"' + (t.emo === k ? ' selected' : '') + '>' + EMO[k] + '</option>'; }).join('') + '<option value=""' + (!t.emo ? ' selected' : '') + '>—</option></select></td>' +
        '<td><input data-note="' + i + '" class="lab-in" style="padding:2px 6px;min-width:140px;direction:rtl;text-align:right" value="' + esc(t.note || '') + '" maxlength="200"></td><td><button class="ac-chip" data-del="' + i + '" type="button">✕</button></td></tr>';
    }).join('') : '<tr><td class="note">ژورنال خالی است. در شبیه‌ساز معامله کنید یا معاملهٔ فرضی اضافه کنید.</td></tr>';
    var n = J.length, w = J.filter(function (t) { return t.pnl > 0; }), l = J.filter(function (t) { return t.pnl < 0; });
    var gw = w.reduce(function (a, t) { return a + t.pnl; }, 0), gl = -l.reduce(function (a, t) { return a + t.pnl; }, 0), rs = J.filter(function (t) { return t.r != null; });
    var exp = rs.length ? rs.reduce(function (a, t) { return a + t.r; }, 0) / rs.length : NaN, nosl = J.filter(function (t) { return !t.sl; }).length;
    var emo = J.filter(function (t) { return t.emo === 'fomo' || t.emo === 'revenge'; }), emoPnl = emo.reduce(function (a, t) { return a + t.pnl; }, 0);
    out('jStats', [['تعداد', n], ['نرخ برد', n ? pc(w.length / n * 100, 1) : '—'], ['جمع سود/زیان', usd(gw - gl), cls(gw - gl)], ['ضریب سود (Profit Factor)', gl ? f(gw / gl, 2) : (gw ? '∞' : '—')],
      ['امید ریاضی (میانگین R)', isFinite(exp) ? f(exp, 2) + 'R' : '—', cls(exp)], ['بدون حد ضرر', nosl + (n ? ' (' + pc(nosl / n * 100, 0) + ')' : ''), nosl ? 'down' : ''],
      ['معامله‌های هیجانی (FOMO/انتقام)', emo.length ? emo.length + ' · ' + usd(emoPnl) : '—', cls(emoPnl)]]);
  }
  if ($('#jTbl')) {
    journal();
    $('#jTbl').addEventListener('change', function (ev) {
      var t = ev.target; if (t.dataset.emo != null) { LAB.journal[+t.dataset.emo].emo = t.value; save(); journal(); }
      if (t.dataset.note != null) { LAB.journal[+t.dataset.note].note = t.value.slice(0, 200); save(); }
    });
    $('#jTbl').addEventListener('click', function (ev) { var b = ev.target.closest('[data-del]'); if (b && confirm('این ردیف حذف شود؟')) { LAB.journal.splice(+b.dataset.del, 1); save(); journal(); } });
    $('#jAdd').onclick = function () {
      var en = num('jEn'), ex = num('jEx'), q = num('jQty'), sl = num('jSl'), side = $('#jSide').value;
      if (!(en > 0 && ex > 0 && q > 0)) { alert('ورود، خروج و مقدار را وارد کنید.'); return; }
      var pnl = (ex - en) * q * (side === 'long' ? 1 : -1), risk = sl > 0 ? Math.abs(en - sl) * q : null;
      LAB.journal.unshift({ src: 'manual', sym: ($('#jSym').value || '').slice(0, 20), side: side, en: en, ex: ex, q: q, sl: sl > 0 ? sl : null, pnl: pnl, r: risk ? pnl / risk : null, emo: $('#jEmo').value, note: ($('#jNote').value || '').slice(0, 200), t: Date.now() });
      save(); journal(); used('journal');
    };
    $('#jCsv').onclick = function () {
      var rows = [['source', 'symbol', 'side', 'entry', 'exit', 'qty', 'stop', 'pnl', 'R', 'emotion', 'note', 'time']].concat(LAB.journal.map(function (t) { return [t.src, t.sym, t.side, t.en, t.ex, t.q, t.sl || '', t.pnl, t.r == null ? '' : t.r, t.emo || '', (t.note || '').replace(/"/g, "'"), new Date(t.t).toISOString()]; }));
      var csv = '﻿' + rows.map(function (r) { return r.map(function (c) { return '"' + c + '"'; }).join(','); }).join('\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'academy-journal.csv'; a.click();
    };
    $('#jClr').onclick = function () { if (confirm('همهٔ ژورنال پاک شود؟')) { LAB.journal = []; save(); journal(); } };
  }

  // ------------------------------------------------------------ backtest (signals on closed bars, fills at next open)
  var DEF = { ema: [20, 50], rsi: [30, 70], brk: [20, 10] };
  if ($('#bStrat')) $('#bStrat').onchange = function () { var d = DEF[this.value]; $('#bP1').value = d[0]; $('#bP2').value = d[1]; };
  function backtest(k, st, p1, p2, fee, slp) {
    var cl = k.map(function (c) { return c.c; }), sig = [], i;
    if (st === 'ema') { var a = ema(cl, p1), b = ema(cl, p2); for (i = 0; i < k.length; i++) sig.push(a[i] == null || b[i] == null || a[i - 1] == null || b[i - 1] == null ? 0 : (a[i] > b[i] && a[i - 1] <= b[i - 1] ? 1 : a[i] < b[i] && a[i - 1] >= b[i - 1] ? -1 : 0)); }
    else if (st === 'rsi') { var r = rsi(cl, 14); for (i = 0; i < k.length; i++) sig.push(r[i] == null || r[i - 1] == null ? 0 : (r[i - 1] < p1 && r[i] >= p1 ? 1 : r[i] >= p2 ? -1 : 0)); }
    else { for (i = 0; i < k.length; i++) { if (i < Math.max(p1, p2)) { sig.push(0); continue; } var hh = -Infinity, ll = Infinity, j; for (j = i - p1; j < i; j++) hh = Math.max(hh, k[j].h); for (j = i - p2; j < i; j++) ll = Math.min(ll, k[j].l); sig.push(cl[i] > hh ? 1 : cl[i] < ll ? -1 : 0); } }
    var eq = [1], cash = 1, pos = null, trades = [], inBars = 0;
    for (i = 1; i < k.length; i++) {
      var c = k[i];
      if (pos == null && sig[i - 1] === 1) { pos = { en: c.o, q: cash * (1 - fee) / c.o, i: i }; cash = 0; }
      else if (pos && sig[i - 1] === -1) { cash = pos.q * c.o * (1 - fee); trades.push({ ret: c.o / pos.en - 1, i0: pos.i, i1: i }); pos = null; }
      if (pos && slp > 0 && c.l <= pos.en * (1 - slp)) { var ex = Math.min(c.o, pos.en * (1 - slp)); cash = pos.q * ex * (1 - fee); trades.push({ ret: ex / pos.en - 1, i0: pos.i, i1: i, sl: 1 }); pos = null; }
      if (pos) inBars++;
      eq.push(pos ? pos.q * c.c : cash);
    }
    return { eq: eq, trades: trades, expo: inBars / k.length };
  }
  function stats(eq, trades, k, a, b) {
    var e = eq.slice(a, b + 1), base = e[0], pk = base, dd = 0;
    e.forEach(function (v) { pk = Math.max(pk, v); dd = Math.max(dd, (pk - v) / pk); });
    var tr = trades.filter(function (t) { return t.i0 >= a && t.i0 <= b; }), w = tr.filter(function (t) { return t.ret > 0; });
    var gw = w.reduce(function (s, t) { return s + t.ret; }, 0), gl = -tr.filter(function (t) { return t.ret <= 0; }).reduce(function (s, t) { return s + t.ret; }, 0);
    return { ret: (e[e.length - 1] / base - 1) * 100, bh: (k[b].c / k[a].c - 1) * 100, dd: dd * 100, n: tr.length, win: tr.length ? w.length / tr.length * 100 : NaN, pf: gl ? gw / gl : NaN };
  }
  if ($('#bRun')) $('#bRun').onclick = function () {
    var m = $('#bMsg'); m.textContent = 'در حال بارگذاری و اجرا…'; m.className = 'lab-msg';
    getK($('#bSym').value, $('#bIv').value).then(function (k) {
      var p1 = Math.max(2, Math.round(num('bP1'))), p2 = Math.max(2, Math.round(num('bP2'))), fee = Math.max(0, num('bFee') || 0) / 100, sl = Math.max(0, num('bSl') || 0) / 100;
      var sp = Math.min(60, Math.max(0, Math.round(num('bSplit') || 0))), cut = Math.floor(k.length * (1 - sp / 100));
      var r = backtest(k, $('#bStrat').value, p1, p2, fee, sl), A = stats(r.eq, r.trades, k, 0, cut - 1), B = sp ? stats(r.eq, r.trades, k, cut - 1, k.length - 1) : null;
      var g = setup($('#bCv')), x = g.x, W = g.w, H = g.h, mx = Math.max.apply(null, r.eq), mn = Math.min.apply(null, r.eq), bh = k.map(function (c) { return c.c / k[0].c; });
      mx = Math.max(mx, Math.max.apply(null, bh)); mn = Math.min(mn, Math.min.apply(null, bh));
      var X = function (i) { return i / (k.length - 1) * (W - 8) + 4; }, Y = function (v) { return 8 + (mx - v) / (mx - mn || 1) * (H - 26); };
      x.clearRect(0, 0, W, H);
      [[bh, '#9a9a94'], [r.eq, '#f7931a']].forEach(function (s) { x.strokeStyle = s[1]; x.lineWidth = 1.5; x.beginPath(); s[0].forEach(function (v, i) { if (i) x.lineTo(X(i), Y(v)); else x.moveTo(X(i), Y(v)); }); x.stroke(); });
      if (sp) { x.strokeStyle = '#a78bfa'; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(X(cut), 0); x.lineTo(X(cut), H); x.stroke(); x.setLineDash([]); }
      x.fillStyle = css('--mute'); x.font = '11px Vazirmatn,sans-serif'; x.fillText('نارنجی: استراتژی · خاکستری: خرید و نگهداری' + (sp ? ' · خط بنفش: شروع دورهٔ خارج از نمونه' : ''), 6, H - 6);
      function row(t, s) { return [[t + ' بازده', pc(s.ret, 1), cls(s.ret)], [t + ' خرید و نگهداری', pc(s.bh, 1), cls(s.bh)], [t + ' معامله / برد', s.n + ' / ' + (isFinite(s.win) ? pc(s.win, 0) : '—')], [t + ' بیشترین افت', pc(-s.dd, 1), 'down'], [t + ' ضریب سود', isFinite(s.pf) ? f(s.pf, 2) : '—']]; }
      var d0 = new Date(k[0].t).toISOString().slice(0, 10), d1 = new Date(k[k.length - 1].t).toISOString().slice(0, 10);
      out('bOut', row('درون نمونه:', A).concat(B ? row('خارج از نمونه:', B) : []).concat([['دورهٔ داده', d0 + ' → ' + d1], ['زمان حضور در بازار', pc(r.expo * 100, 0)]]));
      m.textContent = (B && A.ret > 0 && B.ret < 0) ? '⚠️ نتیجهٔ درون نمونه مثبت ولی خارج از نمونه منفی است؛ نشانهٔ احتمالی بیش‌برازش.' : 'انجام شد. نتیجهٔ گذشته تضمینی برای آینده نیست.';
      used('backtest');
    }).catch(function () { m.textContent = 'دادهٔ کندل در دسترس نیست.'; m.className = 'lab-msg err'; });
  };

  // ------------------------------------------------------------ calculators
  if ($('#zOut')) on(['zCap', 'zRisk', 'zEn', 'zSl'], function () {
    var cap = num('zCap'), r = num('zRisk'), en = num('zEn'), sl = num('zSl'), d = Math.abs(en - sl), q = cap * r / 100 / d;
    out('zOut', [['مبلغ ریسک', usd(cap * r / 100)], ['فاصلهٔ حد ضرر', pc(d / en * 100)], ['حجم (واحد)', f(q)], ['ارزش پوزیشن', usd(q * en)],
      ['اهرم لازم', q * en > cap ? f(q * en / cap, 2) + '×' : 'بدون اهرم', q * en > cap ? 'down' : ''], ['زیان در صورت برخورد به حد ضرر', usd(-q * d), 'down']]);
  });
  if ($('#rOut')) on(['rEn', 'rSl', 'rTp', 'rFee', 'rWin'], function () {
    var en = num('rEn'), sl = num('rSl'), tp = num('rTp'), fee = (num('rFee') || 0) / 100 * en, w = num('rWin') / 100;
    var risk = Math.abs(en - sl) + fee, rew = Math.abs(tp - en) - fee, rr = rew / risk, be = 1 / (1 + rr), ev = w * rew - (1 - w) * risk;
    out('rOut', [['نسبت ریسک به بازده (با کارمزد)', '1 : ' + f(rr, 2)], ['نرخ برد سربه‌سر', pc(be * 100, 1)], ['امید ریاضی هر معامله', f(ev / risk, 2) + 'R', cls(ev)],
      ['وضعیت با نرخ برد شما', w > be ? 'مثبت' : w < be ? 'منفی' : 'سربه‌سر', cls(w - be)]]);
  });
  if ($('#pOut')) on(['pSide', 'pEn', 'pEx', 'pQty', 'pLev', 'pFee'], function () {
    var d = $('#pSide').value === 'long' ? 1 : -1, en = num('pEn'), ex = num('pEx'), q = num('pQty'), lev = Math.max(1, num('pLev') || 1), fr = (num('pFee') || 0) / 100;
    var g = (ex - en) * q * d, fee = (en + ex) * q * fr, n = g - fee, m = en * q / lev;
    out('pOut', [['سود/زیان ناخالص', usd(g), cls(g)], ['کارمزد کل', usd(-fee), 'down'], ['سود/زیان خالص', usd(n), cls(n)], ['مارجین / سرمایهٔ درگیر', usd(m)], ['بازده روی مارجین (ROE)', pc(n / m * 100), cls(n)], ['تغییر قیمت', pc((ex / en - 1) * 100), cls((ex - en) * d)]]);
  });
  if ($('#lOut')) on(['lSide', 'lEn', 'lLev', 'lMm'], function () {
    var L = $('#lSide').value === 'long', en = num('lEn'), lev = Math.max(1, num('lLev')), mm = (num('lMm') || 0) / 100;
    var liq = L ? en * (1 - 1 / lev + mm) : en * (1 + 1 / lev - mm);
    out('lOut', [['قیمت تقریبی لیکوئید', f(liq), 'down'], ['فاصله تا لیکوئید', pc(Math.abs(liq / en - 1) * 100)], ['حرکت خلاف جهتی که کل مارجین را می‌برد', '≈ ' + pc(100 / lev, 2)]]);
  });
  if ($('#fOut1')) on(['fAmt', 'fMk', 'fTk', 'fN', 'fRate', 'fVb', 'fBtc', 'fGas', 'fBase', 'fTip', 'fEth'], function () {
    var a = num('fAmt'), mk = num('fMk') / 100, tk = num('fTk') / 100, n = num('fN');
    out('fOut1', [['ورود و خروج Taker', usd(a * tk * 2)], ['ورود Maker و خروج Taker', usd(a * (mk + tk))], ['هزینهٔ ماهانه (Taker)', usd(a * tk * 2 * n), 'down'], ['حرکت لازم برای سربه‌سر شدن', pc(tk * 2 * 100, 3)]]);
    var sat = num('fRate') * num('fVb'); out('fOut2', [['کارمزد (ساتوشی)', f(sat, 0)], ['کارمزد (BTC)', f(sat / 1e8, 8)], ['کارمزد (دلار)', usd(sat / 1e8 * num('fBtc'))]]);
    var gwei = num('fGas') * (num('fBase') + num('fTip')); out('fOut3', [['کارمزد (gwei)', f(gwei, 0)], ['کارمزد (ETH)', f(gwei / 1e9, 8)], ['کارمزد (دلار)', usd(gwei / 1e9 * num('fEth'))], ['سهم سوزانده‌شده (Base fee)', pc(num('fBase') / (num('fBase') + num('fTip')) * 100, 1)]]);
  });
  if ($('#cOut')) on(['cPx', 'cCirc', 'cTot', 'cMax', 'cUnl', 'cVol'], function () {
    var p = num('cPx'), c = num('cCirc'), t = num('cTot'), mx = num('cMax'), u = num('cUnl'), v = num('cVol'), full = isFinite(mx) ? mx : t;
    var mc = p * c, fdv = p * full;
    out('cOut', [['ارزش بازار (Market Cap)', usd(mc)], ['ارزش رقیق‌شدهٔ کامل (FDV)', usd(fdv)], ['نسبت ارزش بازار به FDV', pc(mc / fdv * 100, 1)], ['سهم عرضهٔ در گردش', pc(c / full * 100, 1)],
      ['رقیق‌شدن تا عرضهٔ کامل', pc((full / c - 1) * 100, 1), 'down'], ['ماه تا آزادسازی کامل', u > 0 ? f(Math.max(0, (full - c) / u), 1) : '—'],
      ['فشار عرضهٔ ماهانه به ارزش امروز', u > 0 ? usd(u * p) : '—'], ['گردش روزانه (حجم ÷ ارزش بازار)', pc(v / mc * 100, 2)], ['عرضهٔ حداکثری', isFinite(mx) ? f(mx, 0) : 'نامحدود / تورمی']]);
  });

  // ------------------------------------------------------------ hash & mining
  function hex(buf) { return [].map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function sha(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(hex); }
  var lastHash = null, mining = false;
  function bits(h) { return h.split('').map(function (c) { return ('000' + parseInt(c, 16).toString(2)).slice(-4); }).join(''); }
  if ($('#hIn')) {
    if (!(window.crypto && crypto.subtle)) { $('#hOut').textContent = 'مرورگر شما Web Crypto را پشتیبانی نمی‌کند.'; }
    else {
      var hUpd = function () {
        sha($('#hIn').value).then(function (h) {
          $('#hOut').textContent = h;
          if (lastHash && lastHash !== h) { var a = bits(lastHash), b = bits(h), d = 0; for (var i = 0; i < 256; i++) if (a[i] !== b[i]) d++; $('#hDiff').textContent = 'نسبت به ورودی قبلی، ' + d + ' بیت از ۲۵۶ بیت (' + Math.round(d / 2.56) + '٪) عوض شد.'; }
          lastHash = h;
        });
      };
      $('#hIn').addEventListener('input', hUpd); hUpd();
      $('#hMine').onclick = function () {
        if (mining) return; mining = true; used('hash');
        var z = +$('#hDiffSel').value, pre = '0'.repeat(z), data = $('#hIn').value, n = 0, t0 = performance.now(), o = $('#hMineOut');
        (function batch() {
          if (!mining) { o.textContent = 'متوقف شد بعد از ' + n.toLocaleString('en-US') + ' تلاش.'; return; }
          var ps = []; for (var i = 0; i < 400; i++) ps.push(sha(data + n++).then((function (nn) { return function (h) { return [nn, h]; }; })(n - 1)));
          Promise.all(ps).then(function (rs) {
            var hit = rs.filter(function (r) { return r[1].indexOf(pre) === 0; })[0], dt = (performance.now() - t0) / 1000;
            if (hit) { mining = false; o.innerHTML = 'nonce = <b>' + hit[0] + '</b><br>' + hit[1] + '<br>' + n.toLocaleString('en-US') + ' تلاش در ' + dt.toFixed(2) + ' ثانیه (' + Math.round(n / dt).toLocaleString('en-US') + ' هش در ثانیه). شبکهٔ بیت‌کوین صدها اگزاهش در ثانیه انجام می‌دهد.'; return; }
            o.textContent = 'در حال جست‌وجو… ' + n.toLocaleString('en-US') + ' تلاش'; setTimeout(batch, 0);
          });
        })();
      };
      $('#hStop').onclick = function () { mining = false; };
    }
  }

  // ------------------------------------------------------------ keys & signatures
  var KP = null, SIG = null, SIGMSG = null;
  function b64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), o = ''; for (var i = 0; i < b.length; i++) o += ('0' + b.charCodeAt(i).toString(16)).slice(-2); return o; }
  if ($('#kGen')) {
    var kRes = function (t, ok) { var r = $('#kRes'); r.textContent = t; r.className = 'lab-msg' + (ok === false ? ' err' : ''); r.style.color = ok ? '#22c55e' : ''; };
    $('#kGen').onclick = function () {
      if (!(window.crypto && crypto.subtle)) { kRes('Web Crypto در دسترس نیست.', false); return; }
      crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']).then(function (kp) {
        KP = kp; SIG = null; $('#kSig').textContent = '—';
        return Promise.all([crypto.subtle.exportKey('raw', kp.publicKey), crypto.subtle.exportKey('jwk', kp.privateKey)]);
      }).then(function (r) { $('#kPub').textContent = hex(r[0]); $('#kPriv').textContent = b64u(r[1].d); kRes('جفت کلید ساخته شد. کلید عمومی را می‌توان منتشر کرد؛ کلید خصوصی راز است.', true); used('keys'); });
    };
    $('#kSign').onclick = function () {
      if (!KP) { kRes('اول جفت کلید بسازید.', false); return; }
      SIGMSG = $('#kMsg').value;
      crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, KP.privateKey, new TextEncoder().encode(SIGMSG)).then(function (s) { SIG = s; $('#kSig').textContent = hex(s); kRes('پیام امضا شد. حالا تأیید کنید یا پیام را دستکاری کنید.', true); });
    };
    $('#kVer').onclick = function () {
      if (!KP || !SIG) { kRes('اول پیام را امضا کنید.', false); return; }
      crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, KP.publicKey, SIG, new TextEncoder().encode($('#kMsg').value)).then(function (ok) {
        kRes(ok ? '✅ امضا معتبر است: این پیام دقیقاً همان است که صاحب کلید خصوصی امضا کرده.' : '❌ امضا نامعتبر است: پیام بعد از امضا تغییر کرده (یا امضا مال کلید دیگری است).', ok);
      });
    };
    $('#kTamper').onclick = function () { var m = $('#kMsg'); m.value = m.value.replace(/[۰-۹0-9]/, function (d) { return d === '۰' || d === '0' ? '۹' : '۰'; }); if (m.value === SIGMSG) m.value += ' '; $('#kVer').click(); };
  }

  // ------------------------------------------------------------ real bitcoin transaction (mempool.space)
  var MP = 'https://mempool.space/api';
  function tmsg(t, err) { var m = $('#tMsg'); m.textContent = t || ''; m.className = 'lab-msg' + (err ? ' err' : ''); }
  function btc(s) { return (s / 1e8).toLocaleString('en-US', { maximumFractionDigits: 8 }) + ' BTC'; }
  function showTx(id) {
    id = (id || '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(id)) { tmsg('txid باید ۶۴ کاراکتر هگز باشد.', true); return; }
    tmsg('در حال خواندن از mempool.space…');
    Promise.all([fetch(MP + '/tx/' + id).then(function (r) { if (!r.ok) throw r.status; return r.json(); }), fetch(MP + '/blocks/tip/height').then(function (r) { return r.ok ? r.text() : null; }).catch(function () { return null; })]).then(function (r) {
      var tx = r[0], tip = +r[1], vs = Math.ceil(tx.weight / 4), ins = tx.vin.reduce(function (a, v) { return a + (v.prevout ? v.prevout.value : 0); }, 0), outs = tx.vout.reduce(function (a, v) { return a + v.value; }, 0);
      var conf = tx.status.confirmed ? (tip ? tip - tx.status.block_height + 1 : '?') : 0;
      var h = '<div class="lab-out">' + [['وضعیت', tx.status.confirmed ? '✅ تأییدشده در بلاک ' + tx.status.block_height : '⏳ در mempool (تأییدنشده)'], ['تعداد تأیید', String(conf)],
      ['زمان بلاک', tx.status.block_time ? new Date(tx.status.block_time * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—'], ['اندازهٔ مجازی', vs + ' vB'], ['وزن', tx.weight + ' WU'],
      ['کارمزد', btc(tx.fee) + ' (' + tx.fee.toLocaleString('en-US') + ' sat)'], ['نرخ کارمزد', (tx.fee / vs).toFixed(1) + ' sat/vB'], ['جمع ورودی‌ها', btc(ins)], ['جمع خروجی‌ها', btc(outs)],
      ['ورودی − خروجی', btc(ins - outs) + (ins - outs === tx.fee ? ' = کارمزد ✓' : '')]].map(function (x) { return '<div><small>' + x[0] + '</small><b>' + esc(x[1]) + '</b></div>'; }).join('') + '</div>';
      h += '<h3>ورودی‌ها (' + tx.vin.length + ')</h3><div class="lab-scroll"><table class="lab-tbl"><tr><th>#</th><th>آدرس مبدأ</th><th>مقدار</th><th>نوع</th></tr>' + tx.vin.slice(0, 30).map(function (v, i) {
        return '<tr><td>' + i + '</td><td dir="ltr">' + (v.is_coinbase ? 'coinbase (پاداش استخراج)' : esc(v.prevout && v.prevout.scriptpubkey_address || '—')) + '</td><td dir="ltr">' + (v.prevout ? btc(v.prevout.value) : '—') + '</td><td>' + esc(v.prevout ? v.prevout.scriptpubkey_type : '') + '</td></tr>';
      }).join('') + '</table></div><h3>خروجی‌ها (' + tx.vout.length + ')</h3><div class="lab-scroll"><table class="lab-tbl"><tr><th>#</th><th>آدرس مقصد</th><th>مقدار</th><th>نوع</th></tr>' + tx.vout.slice(0, 30).map(function (v, i) {
        return '<tr><td>' + i + '</td><td dir="ltr">' + esc(v.scriptpubkey_address || (v.scriptpubkey_type === 'op_return' ? 'OP_RETURN (داده)' : '—')) + '</td><td dir="ltr">' + btc(v.value) + '</td><td>' + esc(v.scriptpubkey_type) + '</td></tr>';
      }).join('') + '</table></div>';
      h += '<p class="note">چه می‌بینید؟ هر ورودی یک خروجیِ خرج‌نشدهٔ قبلی (UTXO) را خرج می‌کند و با امضای صاحبش باز می‌شود. خروجی‌ها UTXOهای تازه می‌سازند؛ معمولاً یکی برای گیرنده و یکی «باقی‌مانده» (change) به خود فرستنده. '
        + 'تفاوت جمع ورودی‌ها و خروجی‌ها کارمزدی است که به استخراج‌کننده می‌رسد. هر بلاکی که بعد از بلاک این تراکنش ساخته شود، یک تأیید اضافه می‌کند. '
        + '<a href="https://mempool.space/tx/' + id + '" target="_blank" rel="noopener">دیدن در mempool.space</a></p>';
      $('#tOut').innerHTML = h; tmsg(''); used('tx');
    }).catch(function (e) { tmsg(e === 404 || e === 400 ? 'تراکنشی با این شناسه پیدا نشد.' : 'mempool.space در دسترس نیست (ممکن است در شبکهٔ شما مسدود باشد).', true); });
  }
  if ($('#tGo')) {
    $('#tGo').onclick = function () { showTx($('#tId').value); };
    $('#tId').addEventListener('keydown', function (e) { if (e.key === 'Enter') showTx(this.value); });
    $('#tRecent').onclick = function () {
      tmsg('در حال دریافت تراکنش‌های تازه…');
      fetch(MP + '/mempool/recent').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (a) { if (!a.length) throw 0; var t = a[Math.floor(Math.random() * a.length)].txid; $('#tId').value = t; showTx(t); })
        .catch(function () { tmsg('mempool.space در دسترس نیست (ممکن است در شبکهٔ شما مسدود باشد).', true); });
    };
  }

  // open the tool named in the URL hash (links from lessons)
  if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(function () { t.scrollIntoView(); }, 50); }
})();
