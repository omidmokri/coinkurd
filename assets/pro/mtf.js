/* entekhab.net — /market/ multi-timeframe matrix and the market regime.
   One table instead of six charts: for the symbol on screen, each chosen timeframe gets its trend, structure, RSI,
   MACD, volume, volatility and regime, read from that timeframe's own candles (the same feeds the charts use).
   Every cell is a stated rule — nothing here is a model's opinion and nothing is predicted:
     trend      the order of close, EMA 20, EMA 50 and EMA 200
     structure  the last two swing highs and the last two swing lows (a swing = the extreme of 5 bars each side)
     RSI        Wilder's RSI(14);  MACD  the sign and the direction of the 12/26/9 histogram
     volume     the last closed bar against the average of the 20 before it
     volatility where ATR(14)/close stands among its own last 200 values (a percentile)
     regime     see regime() below: trend by EMA 50/200 and ADX(14), squeeze/expansion by Bollinger width, a sharp
                sell-off by a 3-bar drop of three ATRs on double volume. States that cannot be told from candles
                alone (accumulation, distribution, capitulation) are NOT guessed.
   The lean of a timeframe is the sum of four votes (trend, structure, RSI, MACD). Timeframes are slices of ONE price
   series, so their agreement is not independent evidence; the page says so next to the count.
   The maths is P.mtfCalc (pure, tested by tests/test_pro_mtf.js). */
(function () {
  'use strict';
  var P = window.PRO = window.PRO || {};
  var M = P.mtfCalc = {};
  M.ema = function (v, n) { var o = new Array(v.length), k = 2 / (n + 1), e = 0, s = 0; for (var i = 0; i < v.length; i++) { if (i < n) { s += v[i]; e = s / (i + 1); o[i] = i === n - 1 ? e : null; } else { e = v[i] * k + e * (1 - k); o[i] = e; } } return o; };
  M.rsi = function (c, n) { var o = new Array(c.length), g = 0, l = 0; n = n || 14; for (var i = 0; i < c.length; i++) { if (!i) { o[i] = null; continue; } var ch = c[i] - c[i - 1], u = ch > 0 ? ch : 0, d = ch < 0 ? -ch : 0; if (i <= n) { g += u / n; l += d / n; } else { g = (g * (n - 1) + u) / n; l = (l * (n - 1) + d) / n; } o[i] = i < n ? null : (l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l)); } return o; };
  M.atr = function (B, n) { var o = new Array(B.length), a = 0; n = n || 14; for (var i = 0; i < B.length; i++) { var tr = i ? Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c)) : B[i].h - B[i].l; if (i < n) { a += tr / n; o[i] = i === n - 1 ? a : null; } else { a = (a * (n - 1) + tr) / n; o[i] = a; } } return o; };
  /* Wilder's ADX(14) */
  M.adx = function (B, n) {
    n = n || 14; var o = new Array(B.length), tr = 0, pd = 0, nd = 0, dxs = 0, adx = null, i;
    for (i = 0; i < B.length; i++) {
      o[i] = null; if (!i) continue;
      var up = B[i].h - B[i - 1].h, dn = B[i - 1].l - B[i].l, p = up > dn && up > 0 ? up : 0, q = dn > up && dn > 0 ? dn : 0, t = Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
      if (i <= n) { tr += t; pd += p; nd += q; if (i < n) continue; } else { tr = tr - tr / n + t; pd = pd - pd / n + p; nd = nd - nd / n + q; }
      var pdi = tr ? 100 * pd / tr : 0, ndi = tr ? 100 * nd / tr : 0, dx = pdi + ndi ? 100 * Math.abs(pdi - ndi) / (pdi + ndi) : 0;
      if (i < 2 * n) { dxs += dx; if (i === 2 * n - 1) { adx = dxs / n; o[i] = adx; } } else { adx = (adx * (n - 1) + dx) / n; o[i] = adx; }
    }
    return o;
  };
  M.pct = function (arr, x) { var a = arr.filter(function (v) { return v != null && isFinite(v); }); if (!a.length || x == null) return null; var k = 0; a.forEach(function (v) { if (v <= x) k++; }); return k / a.length * 100; };
  /* swings: a bar whose high (low) is the extreme of `w` bars on each side. A tie counts for the earlier bar only:
     with a strict test on both sides two equal highs would cancel each other and a real double top would be no swing. */
  M.swings = function (B, w) {
    w = w || 5; var hi = [], lo = [];
    for (var i = w; i < B.length - w; i++) { var H = true, L = true; for (var j = i - w; j <= i + w; j++) { if (j === i) continue; if (j < i ? B[j].h >= B[i].h : B[j].h > B[i].h) H = false; if (j < i ? B[j].l <= B[i].l : B[j].l < B[i].l) L = false; } if (H) hi.push(B[i].h); if (L) lo.push(B[i].l); }
    return { hi: hi, lo: lo };
  };
  M.structure = function (B) {
    var s = M.swings(B, 5), h = s.hi, l = s.lo; if (h.length < 2 || l.length < 2) return { k: 'na' };
    var hh = h[h.length - 1] > h[h.length - 2], hl = l[l.length - 1] > l[l.length - 2];
    return { k: hh && hl ? 'up' : !hh && !hl ? 'down' : 'mixed', hh: hh, hl: hl };
  };
  /* only the bars that have closed by `nowSec`: a bar opening at t closes at t + sec. When the timeframe is built from a
     smaller one, the first bar may be only part of its period (the window started inside it), so it is left out too. */
  M.closedOnly = function (B, sec, nowSec, built) {
    var o = (B || []).filter(function (b) { return b && isFinite(b.t) && b.t + sec <= nowSec + 1e-6; });
    if (built && o.length && B[0] && o[0] === B[0]) o = o.slice(1);
    return o;
  };
  /* how firm a row's reading is, as one of five stated states (a rule, not a confidence score):
     insufficient  fewer than 200 closed bars, so EMA 200 and the 200-bar percentiles are not available
     conflicting   the EMA order and the swing structure point opposite ways, or the trend and MACD do
     confirmed     trend, structure and lean all point the same way
     developing    the lean points one way but trend or structure has not joined it yet
     neutral       none of the above (no lean) */
  M.state = function (r) {
    if (!r || r.err || r.bars < 200) return 'insufficient';
    var d = function (k) { return k === 'up' ? 1 : k === 'down' ? -1 : 0; }, t = d(r.trend), st = d(r.struct.k), l = d(r.lean), m = r.hist > 0 ? 1 : r.hist < 0 ? -1 : 0;
    if ((t && st && t !== st) || (t && m && t !== m)) return 'conflicting';
    if (l && t === l && st === l) return 'confirmed';
    if (l) return 'developing';
    return 'neutral';
  };
  M.TH = { adx: 20, volHi: 80, volLo: 20, sqz: 10, exp: 90, shockAtr: 3, shockVol: 2 };
  /* everything one timeframe's row needs, from its closed bars */
  M.row = function (B) {
    if (!B || B.length < 60) return { err: 'short' };
    var c = B.map(function (b) { return b.c; }), n = c.length - 1, e20 = M.ema(c, 20), e50 = M.ema(c, 50), e200 = M.ema(c, 200), r = M.rsi(c, 14), at = M.atr(B, 14), ad = M.adx(B, 14);
    var f12 = M.ema(c, 12), f26 = M.ema(c, 26), macd = c.map(function (_, i) { return f12[i] != null && f26[i] != null ? f12[i] - f26[i] : null; }), mv = macd.filter(function (v) { return v != null; }), sig = M.ema(mv, 9), hist = mv.map(function (v, i) { return sig[i] != null ? v - sig[i] : null; });
    var hN = hist[hist.length - 1], hP = hist[hist.length - 2];
    var out = { bars: B.length, close: c[n], e20: e20[n], e50: e50[n], e200: e200[n], rsi: r[n], atr: at[n], adx: ad[n], hist: hN, histUp: hN != null && hP != null ? hN > hP : null };
    out.trend = out.e50 == null ? 'na' : (out.e200 != null ? (c[n] > e20[n] && e20[n] > e50[n] && e50[n] > e200[n] ? 'up' : c[n] < e20[n] && e20[n] < e50[n] && e50[n] < e200[n] ? 'down' : 'mixed') : (c[n] > e20[n] && e20[n] > e50[n] ? 'up' : c[n] < e20[n] && e20[n] < e50[n] ? 'down' : 'mixed'));
    out.struct = M.structure(B);
    var vs = 0, vk = 0; for (var i = n - 20; i < n; i++) if (i >= 0) { vs += B[i].v || 0; vk++; } out.volX = vk && vs > 0 ? (B[n].v || 0) / (vs / vk) : null;
    var ap = B.map(function (b, i) { return at[i] != null && b.c ? at[i] / b.c : null; }).slice(-200); out.volaPct = M.pct(ap, ap[ap.length - 1]);
    out.regime = M.regime(B, { e50: e50, e200: e200, atr: at, adx: ad });
    var v = 0; v += out.trend === 'up' ? 1 : out.trend === 'down' ? -1 : 0; v += out.struct.k === 'up' ? 1 : out.struct.k === 'down' ? -1 : 0; v += out.rsi > 55 ? 1 : out.rsi < 45 ? -1 : 0; v += hN > 0 ? 1 : hN < 0 ? -1 : 0;
    out.votes = v; out.lean = v >= 2 ? 'up' : v <= -2 ? 'down' : 'flat'; out.state = M.state(out);
    return out;
  };
  /* the regime of a series, as labels with the numbers behind them.
     trend:  bull   close > EMA 50 > EMA 200 and ADX >= 20      bear   the mirror      range   ADX < 20      else  mixed
     vol:    high   ATR/close in the top fifth of its last 200 values      low   in the bottom fifth
     band:   squeeze  Bollinger(20,2) width in its lowest tenth of the last 200      expansion  in its top tenth and wider than 5 bars ago
     shock:  selloff  the last 3 bars fell by 3 ATRs or more with the last bar on at least twice its 20-bar volume
     `rules` lists each test with its value; `agree` counts those pointing the trend's way — a tally, not a probability. */
  M.regime = function (B, pre, th) {
    var c = B.map(function (b) { return b.c; }), n = c.length - 1; pre = pre || {}; th = Object.assign({}, M.TH, th || {});
    if (n < 59) return { err: 'short' };
    var e50 = pre.e50 || M.ema(c, 50), e200 = pre.e200 || M.ema(c, 200), at = pre.atr || M.atr(B, 14), ad = pre.adx || M.adx(B, 14);
    if (e50[n] == null || at[n] == null || ad[n] == null) return { err: 'short' };
    var has200 = e200[n] != null, adx = ad[n], up = c[n] > e50[n] && (!has200 || e50[n] > e200[n]), dn = c[n] < e50[n] && (!has200 || e50[n] < e200[n]);
    var trend = adx < th.adx ? 'range' : up ? 'bull' : dn ? 'bear' : 'mixed';
    var ap = B.map(function (b, i) { return at[i] != null && b.c ? at[i] / b.c : null; }).slice(-200), vp = M.pct(ap, ap[ap.length - 1]);
    var bw = [], i; for (i = 19; i <= n; i++) { var s = 0, q = 0; for (var j = i - 19; j <= i; j++) s += c[j]; s /= 20; for (j = i - 19; j <= i; j++) q += (c[j] - s) * (c[j] - s); bw.push(s ? 4 * Math.sqrt(q / 20) / s : null); }
    var bwl = bw.slice(-200), wp = M.pct(bwl, bwl[bwl.length - 1]), widening = bw.length > 5 && bw[bw.length - 1] > bw[bw.length - 6];
    var drop = n >= 3 ? c[n - 3] - c[n] : 0, vs = 0, vk = 0; for (i = n - 20; i < n; i++) if (i >= 0) { vs += B[i].v || 0; vk++; }
    var volX = vk && vs > 0 ? (B[n].v || 0) / (vs / vk) : 0, selloff = drop >= th.shockAtr * at[n] && volX >= th.shockVol, surge = -drop >= th.shockAtr * at[n] && volX >= th.shockVol;
    /* how long the trend label has stood: bars back while the same test still gives the same answer */
    var held = 0; for (i = n; i >= 0 && e50[i] != null && ad[i] != null; i--) { var a2 = ad[i], u2 = c[i] > e50[i] && (e200[i] == null || e50[i] > e200[i]), d2 = c[i] < e50[i] && (e200[i] == null || e50[i] < e200[i]), t2 = a2 < th.adx ? 'range' : u2 ? 'bull' : d2 ? 'bear' : 'mixed'; if (t2 !== trend) break; held++; }
    var slope = n >= 5 && e50[n - 5] != null ? e50[n] - e50[n - 5] : 0;
    var rules = [['close_vs_e50', c[n] > e50[n] ? 1 : -1], ['e50_vs_e200', has200 ? (e50[n] > e200[n] ? 1 : -1) : 0], ['e50_slope', slope > 0 ? 1 : slope < 0 ? -1 : 0], ['adx', adx >= th.adx ? 1 : 0]];
    var side = trend === 'bull' ? 1 : trend === 'bear' ? -1 : 0, agree = side ? rules.filter(function (r) { return r[0] === 'adx' ? r[1] === 1 : r[1] === side; }).length : rules.filter(function (r) { return r[0] === 'adx' && r[1] === 0; }).length;
        /* a percentile over fewer than 100 values is not a percentile worth naming: those labels are left out */
    var nVol = ap.filter(function (x) { return x != null; }).length, nBw = bwl.filter(function (x) { return x != null; }).length;
    var vol = vp == null || nVol < 100 ? 'na' : vp >= th.volHi ? 'high' : vp <= th.volLo ? 'low' : 'normal', band = wp == null || nBw < 100 ? 'na' : wp <= th.sqz ? 'squeeze' : wp >= th.exp && widening ? 'expansion' : 'normal';
    return { trend: trend, vol: vol, band: band, selloff: selloff, surge: surge, partial: !has200, slope: slope, volX: volX, th: th,
      adx: adx, volaPct: vp, widthPct: wp, held: held, agree: agree, of: side ? rules.length : 1, e50: e50[n], e200: has200 ? e200[n] : null, close: c[n], atr: at[n] };
  };

  /* the trend label bar by bar (same rule as regime().trend), for the strip of past regimes. No look-ahead: bar i is
     labelled from bars 0..i only, because EMA, ADX and the comparison at i use nothing after i. */
  M.regimeSeries = function (B, th) {
    th = Object.assign({}, M.TH, th || {}); var c = B.map(function (b) { return b.c; }), e50 = M.ema(c, 50), e200 = M.ema(c, 200), ad = M.adx(B, 14);
    return c.map(function (x, i) { if (e50[i] == null || ad[i] == null) return null; var u = x > e50[i] && (e200[i] == null || e50[i] > e200[i]), d = x < e50[i] && (e200[i] == null || e50[i] < e200[i]); return ad[i] < th.adx ? 'range' : u ? 'bull' : d ? 'bear' : 'mixed'; });
  };

  var A = P.app; if (!A) return;
  var T = A.T, esc = A.esc, h = A.h, $ = A.$, $$ = A.$$, S = P.store;
  function f(v, dg) { return v != null && isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: dg == null ? 2 : dg }) : '—'; }
  function px(v) { return v != null && isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: v >= 100 ? 2 : v >= 1 ? 4 : 8 }) : '—'; }
  var ALL = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '12h', '1d', '3d', '1w', '1M'];
  var PICK = S.get('ek_pro_mtf', null); if (!Array.isArray(PICK)) PICK = ['15m', '1h', '4h', '1d', '1w']; PICK = PICK.filter(function (x) { return ALL.indexOf(x) >= 0; }).slice(0, 8); if (!PICK.length) PICK = ['1h', '4h', '1d'];
  function bars(sym, tf) { var t = P.parseTF(tf), now = Date.now(); return P.history(sym, tf, now - 420 * t.sec * 1000, now).then(function (b) { return M.closedOnly(b, t.sec, now / 1000, t.ratio > 1); }); }
  function tag(k, txt) { return '<span class="pm-mt pm-mt-' + k + '">' + esc(txt) + '</span>'; }
  function regimeText(R) { if (!R || R.err) return '—'; var a = [T('rg_' + R.trend)]; if (R.band !== 'normal' && R.band !== 'na') a.push(T('rg_' + R.band)); if (R.vol !== 'normal' && R.vol !== 'na') a.push(T('rg_v' + R.vol)); if (R.selloff) a.push(T('rg_selloff')); if (R.surge) a.push(T('rg_surge')); return a.join(' · '); }
  var TH = S.get('ek_pro_rgth', null); if (!TH || typeof TH !== 'object' || Array.isArray(TH)) TH = {};
  Object.keys(TH).forEach(function (k) { if (!(k in M.TH) || !isFinite(TH[k]) || TH[k] < 0 || TH[k] > 100) delete TH[k]; });
  var CLR = { bull: '#26a69a', bear: '#ef5350', range: '#8a8f98', mixed: '#c9a227' };

  P.mtf = function () {
    var a = A.active(), sym = a.cfg.sym, box = h('<div class="pm-mtf"><div class="pm-rgc"></div><div class="pm-idt pm-mtfp"></div><div class="pm-tw"><table class="pm-tbl pm-mtft"><thead><tr></tr></thead><tbody></tbody></table></div><div class="pm-mtfs"></div><p class="pm-enote"></p></div>');
    $('p', box).textContent = T('mtfNote');
    ['mtfTf', 'mtfTrend', 'mtfStruct', 'RSI', 'MACD', 'mtfVol', 'mtfVola', 'mtfRegime', 'mtfLean', 'mtfState'].forEach(function (k) { var th = h('<th></th>'); th.textContent = /^[A-Z]+$/.test(k) ? k : T(k); $('thead tr', box).appendChild(th); });
    var tb = $('tbody', box), sum = $('.pm-mtfs', box), pk = $('.pm-mtfp', box), rg = $('.pm-rgc', box), run = 0;
    function chips() { pk.innerHTML = ''; ALL.forEach(function (tf) { var b = h('<button type="button" class="pm-chip' + (PICK.indexOf(tf) >= 0 ? ' on' : '') + '"></button>'); b.textContent = A.tfLabel ? A.tfLabel(tf) : tf; b.onclick = function () { var k = PICK.indexOf(tf); if (k >= 0) { if (PICK.length > 1) PICK.splice(k, 1); } else if (PICK.length < 8) PICK.push(tf); PICK.sort(function (x, y) { return ALL.indexOf(x) - ALL.indexOf(y); }); S.set('ek_pro_mtf', PICK); chips(); load(); }; pk.appendChild(b); }); }
    function regimeCard() {
      var B = a.bars.length > 1 ? a.bars.slice(0, -1) : a.bars, R = B.length >= 60 ? P.mtfCalc.regime(B, null, TH) : { err: 'short' };
      if (R.err) { rg.innerHTML = '<div class="pm-enote">' + esc(T('rgShort')) + '</div>'; return; }
      var inv = R.trend === 'bull' ? T('rgInvBull', { p: px(R.e50) }) : R.trend === 'bear' ? T('rgInvBear', { p: px(R.e50) }) : R.trend === 'range' ? T('rgInvRange') : T('rgInvMixed');
      var why = [['ADX (14)', f(R.adx, 1) + (R.adx >= R.th.adx ? ' ≥ ' : ' < ') + R.th.adx], [T('rgSlope'), R.slope > 0 ? T('rgPos') : R.slope < 0 ? T('rgNeg') : '0'],
        [T('rgVolaPct'), R.vol === 'na' ? T('ms_insufficient') : f(R.volaPct, 0) + '%'], [T('rgWidthPct'), R.band === 'na' ? T('ms_insufficient') : f(R.widthPct, 0) + '%'],
        [T('rgVolX'), f(R.volX, 2) + '×'], ['EMA 50', px(R.e50)], ['EMA 200', R.partial ? T('ms_insufficient') : px(R.e200)], [T('rgAgree'), R.agree + ' / ' + R.of], [T('rgHeld'), f(R.held, 0)]];
      /* past regimes: one thin bar per candle, coloured by that candle's own trend label (no look-ahead) */
      var ser = P.mtfCalc.regimeSeries(B, TH).slice(-240), W = ser.length;
      var strip = '<svg class="pm-rgstrip" viewBox="0 0 ' + W + ' 10" preserveAspectRatio="none" role="img" aria-label="' + esc(T('rgHist')) + '">' + ser.map(function (k, i) { return k ? '<rect x="' + i + '" y="0" width="1.05" height="10" fill="' + CLR[k] + '"><title>' + esc(T('rg_' + k)) + '</title></rect>' : ''; }).join('') + '</svg>';
      var rule = 'bull: close > EMA50 > EMA200 and ADX ≥ ' + R.th.adx + ' · bear: mirror · range: ADX < ' + R.th.adx + ' · volatility high/low: ATR% percentile ≥ ' + R.th.volHi + ' / ≤ ' + R.th.volLo +
        ' · squeeze/expansion: Bollinger width percentile ≤ ' + R.th.sqz + ' / ≥ ' + R.th.exp + ' and widening · sell-off/surge: 3-bar move ≥ ' + R.th.shockAtr + ' ATR on ≥ ' + R.th.shockVol + '× volume';
      rg.innerHTML = '<div class="pm-rgh"><small>' + esc(T('rgTitle', { s: P.pair ? P.pair(sym) : sym, tf: a.cfg.tf })) + '</small><b>' + esc(regimeText(R)) + '</b></div>' +
        '<details class="pm-rgw"><summary>' + esc(T('rgWhy')) + '</summary><div class="pm-co">' + why.map(function (x) { return '<div class="pm-cor"><small>' + esc(x[0]) + '</small><b class="pm-num" dir="ltr">' + esc(x[1]) + '</b></div>'; }).join('') + '</div>' +
        '<code class="pm-cfm" dir="ltr">' + esc(rule) + '</code><div class="pm-cg pm-rgth"></div></details>' +
        '<div class="pm-rgsh"><small>' + esc(T('rgHist')) + ' · ' + W + '</small>' + strip + '</div>' +
        (R.partial ? '<div class="pm-enote">' + esc(T('rgPartial')) + '</div>' : '') + '<div class="pm-cw2">' + esc(inv) + '</div>';
      var thb = $('.pm-rgth', rg);
      [['adx', 'ADX'], ['volHi', T('rgThVh')], ['volLo', T('rgThVl')], ['sqz', T('rgThSq')], ['exp', T('rgThEx')], ['shockAtr', T('rgThAtr')], ['shockVol', T('rgThVol')]].forEach(function (x) {
        var w = h('<label class="pm-cf"><span></span><input class="pm-in" inputmode="decimal" dir="ltr"></label>'), inp = $('input', w); $('span', w).textContent = x[1]; inp.value = TH[x[0]] != null ? TH[x[0]] : M.TH[x[0]];
        inp.onchange = function () { var v = parseFloat(inp.value); if (isFinite(v) && v >= 0 && v <= 100) TH[x[0]] = v; else delete TH[x[0]]; S.set('ek_pro_rgth', TH); regimeCard(); var d = $('details', rg); if (d) d.open = true; };
        thb.appendChild(w);
      });
      var rb = h('<button type="button" class="pm-btn"></button>'); rb.textContent = T('rgThReset');
      rb.onclick = function () { TH = {}; S.set('ek_pro_rgth', TH); regimeCard(); var d = $('details', rg); if (d) d.open = true; }; thb.appendChild(rb);
    }
    function load() {
      var my = ++run; tb.innerHTML = ''; sum.textContent = T('loading');
      var rows = {}; PICK.forEach(function (tf) { var tr = h('<tr><td class="pm-num" dir="ltr"></td><td colspan="9" class="pm-enote"></td></tr>'); $$('td', tr)[0].textContent = A.tfLabel ? A.tfLabel(tf) : tf; $$('td', tr)[1].textContent = '…'; tb.appendChild(tr); rows[tf] = tr; });
      var done = 0, res = {};
      PICK.forEach(function (tf) {
        bars(sym, tf).then(function (B) { return P.mtfCalc.row(B); }, function () { return { err: 'data' }; }).then(function (r) {
          if (my !== run) return; res[tf] = r; done++;
          var tr = rows[tf], lab = $$('td', tr)[0].textContent;
          if (r.err) { $$('td', tr)[1].textContent = T(r.err === 'short' ? 'mtfShort' : 'mtfNoData') + ' · ' + T('ms_insufficient'); }
          else {
            var k3 = { up: 'u', down: 'd', mixed: 'n', na: 'n', flat: 'n' };
            tr.innerHTML = '<td class="pm-num" dir="ltr">' + esc(lab) + '</td><td>' + tag(k3[r.trend], T('mt_' + r.trend)) + '</td><td>' + tag(k3[r.struct.k], r.struct.k === 'na' ? '—' : (r.struct.hh ? 'HH' : 'LH') + ' / ' + (r.struct.hl ? 'HL' : 'LL')) + '</td>' +
              '<td class="pm-num" dir="ltr">' + tag(r.rsi > 55 ? 'u' : r.rsi < 45 ? 'd' : 'n', f(r.rsi, 0)) + '</td><td>' + tag(r.hist > 0 ? 'u' : r.hist < 0 ? 'd' : 'n', (r.hist > 0 ? '+' : r.hist < 0 ? '−' : '0') + (r.histUp == null ? '' : r.histUp ? ' ↑' : ' ↓')) + '</td>' +
              '<td class="pm-num" dir="ltr">' + (r.volX == null ? '—' : tag(r.volX >= 1.5 ? 'h' : 'n', f(r.volX, 2) + '×')) + '</td><td class="pm-num" dir="ltr">' + tag(r.volaPct >= 80 ? 'h' : 'n', f(r.volaPct, 0) + '%') + '</td>' +
              '<td>' + esc(regimeText(r.regime)) + '</td><td>' + tag(k3[r.lean], T('mt_' + r.lean) + ' (' + (r.votes > 0 ? '+' : '') + r.votes + ')') + '</td><td title="' + esc(T('ms_tip_' + r.state)) + '">' + tag(r.state === 'confirmed' ? (r.lean === 'down' ? 'd' : 'u') : r.state === 'conflicting' ? 'h' : 'n', T('ms_' + r.state)) + '</td>';
          }
          if (done === PICK.length) {
            var ok = PICK.filter(function (t) { return res[t] && !res[t].err; }), up = ok.filter(function (t) { return res[t].lean === 'up'; }).length, dn = ok.filter(function (t) { return res[t].lean === 'down'; }).length;
            sum.textContent = ok.length ? T('mtfSum', { u: up, d: dn, n: ok.length }) : T('mtfNoData');
          }
        });
      });
    }
    chips(); regimeCard(); load();
    A.modal(T('mtfTitle') + ' · ' + (P.pair ? P.pair(sym) : sym), box, { wide: true, nofocus: true });
  };
})();
