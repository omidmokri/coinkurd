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
  /* everything one timeframe's row needs, from its closed bars */
  M.row = function (B) {
    if (!B || B.length < 60) return { err: 'short' };
    var c = B.map(function (b) { return b.c; }), n = c.length - 1, e20 = M.ema(c, 20), e50 = M.ema(c, 50), e200 = M.ema(c, 200), r = M.rsi(c, 14), at = M.atr(B, 14), ad = M.adx(B, 14);
    var f12 = M.ema(c, 12), f26 = M.ema(c, 26), macd = c.map(function (_, i) { return f12[i] != null && f26[i] != null ? f12[i] - f26[i] : null; }), mv = macd.filter(function (v) { return v != null; }), sig = M.ema(mv, 9), hist = mv.map(function (v, i) { return sig[i] != null ? v - sig[i] : null; });
    var hN = hist[hist.length - 1], hP = hist[hist.length - 2];
    var out = { close: c[n], e20: e20[n], e50: e50[n], e200: e200[n], rsi: r[n], atr: at[n], adx: ad[n], hist: hN, histUp: hN != null && hP != null ? hN > hP : null };
    out.trend = out.e50 == null ? 'na' : (out.e200 != null ? (c[n] > e20[n] && e20[n] > e50[n] && e50[n] > e200[n] ? 'up' : c[n] < e20[n] && e20[n] < e50[n] && e50[n] < e200[n] ? 'down' : 'mixed') : (c[n] > e20[n] && e20[n] > e50[n] ? 'up' : c[n] < e20[n] && e20[n] < e50[n] ? 'down' : 'mixed'));
    out.struct = M.structure(B);
    var vs = 0, vk = 0; for (var i = n - 20; i < n; i++) if (i >= 0) { vs += B[i].v || 0; vk++; } out.volX = vk && vs > 0 ? (B[n].v || 0) / (vs / vk) : null;
    var ap = B.map(function (b, i) { return at[i] != null && b.c ? at[i] / b.c : null; }).slice(-200); out.volaPct = M.pct(ap, ap[ap.length - 1]);
    out.regime = M.regime(B, { e50: e50, e200: e200, atr: at, adx: ad });
    var v = 0; v += out.trend === 'up' ? 1 : out.trend === 'down' ? -1 : 0; v += out.struct.k === 'up' ? 1 : out.struct.k === 'down' ? -1 : 0; v += out.rsi > 55 ? 1 : out.rsi < 45 ? -1 : 0; v += hN > 0 ? 1 : hN < 0 ? -1 : 0;
    out.votes = v; out.lean = v >= 2 ? 'up' : v <= -2 ? 'down' : 'flat';
    return out;
  };
  /* the regime of a series, as labels with the numbers behind them.
     trend:  bull   close > EMA 50 > EMA 200 and ADX >= 20      bear   the mirror      range   ADX < 20      else  mixed
     vol:    high   ATR/close in the top fifth of its last 200 values      low   in the bottom fifth
     band:   squeeze  Bollinger(20,2) width in its lowest tenth of the last 200      expansion  in its top tenth and wider than 5 bars ago
     shock:  selloff  the last 3 bars fell by 3 ATRs or more with the last bar on at least twice its 20-bar volume
     `rules` lists each test with its value; `agree` counts those pointing the trend's way — a tally, not a probability. */
  M.regime = function (B, pre) {
    var c = B.map(function (b) { return b.c; }), n = c.length - 1; pre = pre || {};
    var e50 = pre.e50 || M.ema(c, 50), e200 = pre.e200 || M.ema(c, 200), at = pre.atr || M.atr(B, 14), ad = pre.adx || M.adx(B, 14);
    if (e50[n] == null || at[n] == null || ad[n] == null) return { err: 'short' };
    var has200 = e200[n] != null, adx = ad[n], up = c[n] > e50[n] && (!has200 || e50[n] > e200[n]), dn = c[n] < e50[n] && (!has200 || e50[n] < e200[n]);
    var trend = adx < 20 ? 'range' : up ? 'bull' : dn ? 'bear' : 'mixed';
    var ap = B.map(function (b, i) { return at[i] != null && b.c ? at[i] / b.c : null; }).slice(-200), vp = M.pct(ap, ap[ap.length - 1]);
    var bw = [], i; for (i = 19; i <= n; i++) { var s = 0, q = 0; for (var j = i - 19; j <= i; j++) s += c[j]; s /= 20; for (j = i - 19; j <= i; j++) q += (c[j] - s) * (c[j] - s); bw.push(s ? 4 * Math.sqrt(q / 20) / s : null); }
    var bwl = bw.slice(-200), wp = M.pct(bwl, bwl[bwl.length - 1]), widening = bw.length > 5 && bw[bw.length - 1] > bw[bw.length - 6];
    var drop = n >= 3 ? c[n - 3] - c[n] : 0, vs = 0, vk = 0; for (i = n - 20; i < n; i++) if (i >= 0) { vs += B[i].v || 0; vk++; }
    var volX = vk && vs > 0 ? (B[n].v || 0) / (vs / vk) : 0, selloff = drop >= 3 * at[n] && volX >= 2;
    /* how long the trend label has stood: bars back while the same test still gives the same answer */
    var held = 0; for (i = n; i >= 0 && e50[i] != null && ad[i] != null; i--) { var a2 = ad[i], u2 = c[i] > e50[i] && (e200[i] == null || e50[i] > e200[i]), d2 = c[i] < e50[i] && (e200[i] == null || e50[i] < e200[i]), t2 = a2 < 20 ? 'range' : u2 ? 'bull' : d2 ? 'bear' : 'mixed'; if (t2 !== trend) break; held++; }
    var slope = n >= 5 && e50[n - 5] != null ? e50[n] - e50[n - 5] : 0;
    var rules = [['close_vs_e50', c[n] > e50[n] ? 1 : -1], ['e50_vs_e200', has200 ? (e50[n] > e200[n] ? 1 : -1) : 0], ['e50_slope', slope > 0 ? 1 : slope < 0 ? -1 : 0], ['adx', adx >= 20 ? 1 : 0]];
    var side = trend === 'bull' ? 1 : trend === 'bear' ? -1 : 0, agree = side ? rules.filter(function (r) { return r[0] === 'adx' ? r[1] === 1 : r[1] === side; }).length : rules.filter(function (r) { return r[0] === 'adx' && r[1] === 0; }).length;
    return { trend: trend, vol: vp >= 80 ? 'high' : vp <= 20 ? 'low' : 'normal', band: wp <= 10 ? 'squeeze' : wp >= 90 && widening ? 'expansion' : 'normal', selloff: selloff,
      adx: adx, volaPct: vp, widthPct: wp, held: held, agree: agree, of: side ? rules.length : 1, e50: e50[n], e200: has200 ? e200[n] : null, close: c[n], atr: at[n] };
  };

  var A = P.app; if (!A) return;
  var T = A.T, esc = A.esc, h = A.h, $ = A.$, $$ = A.$$, S = P.store;
  function f(v, dg) { return v != null && isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: dg == null ? 2 : dg }) : '—'; }
  function px(v) { return v != null && isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: v >= 100 ? 2 : v >= 1 ? 4 : 8 }) : '—'; }
  var ALL = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '12h', '1d', '3d', '1w', '1M'];
  var PICK = S.get('ek_pro_mtf', null); if (!Array.isArray(PICK)) PICK = ['15m', '1h', '4h', '1d', '1w']; PICK = PICK.filter(function (x) { return ALL.indexOf(x) >= 0; }).slice(0, 8); if (!PICK.length) PICK = ['1h', '4h', '1d'];
  function bars(sym, tf) { var t = P.parseTF(tf), now = Date.now(); return P.history(sym, tf, now - 420 * t.sec * 1000, now).then(function (b) { return b.length > 1 ? b.slice(0, -1) : b; }); }   /* the bar still forming is left out */
  function tag(k, txt) { return '<span class="pm-mt pm-mt-' + k + '">' + esc(txt) + '</span>'; }
  function regimeText(R) { if (!R || R.err) return '—'; var a = [T('rg_' + R.trend)]; if (R.band !== 'normal') a.push(T('rg_' + R.band)); if (R.vol !== 'normal') a.push(T('rg_v' + R.vol)); if (R.selloff) a.push(T('rg_selloff')); return a.join(' · '); }

  P.mtf = function () {
    var a = A.active(), sym = a.cfg.sym, box = h('<div class="pm-mtf"><div class="pm-rgc"></div><div class="pm-idt pm-mtfp"></div><div class="pm-tw"><table class="pm-tbl pm-mtft"><thead><tr></tr></thead><tbody></tbody></table></div><div class="pm-mtfs"></div><p class="pm-enote"></p></div>');
    $('p', box).textContent = T('mtfNote');
    ['mtfTf', 'mtfTrend', 'mtfStruct', 'RSI', 'MACD', 'mtfVol', 'mtfVola', 'mtfRegime', 'mtfLean'].forEach(function (k) { var th = h('<th></th>'); th.textContent = /^[A-Z]+$/.test(k) ? k : T(k); $('thead tr', box).appendChild(th); });
    var tb = $('tbody', box), sum = $('.pm-mtfs', box), pk = $('.pm-mtfp', box), rg = $('.pm-rgc', box), run = 0;
    function chips() { pk.innerHTML = ''; ALL.forEach(function (tf) { var b = h('<button type="button" class="pm-chip' + (PICK.indexOf(tf) >= 0 ? ' on' : '') + '"></button>'); b.textContent = A.tfLabel ? A.tfLabel(tf) : tf; b.onclick = function () { var k = PICK.indexOf(tf); if (k >= 0) { if (PICK.length > 1) PICK.splice(k, 1); } else if (PICK.length < 8) PICK.push(tf); PICK.sort(function (x, y) { return ALL.indexOf(x) - ALL.indexOf(y); }); S.set('ek_pro_mtf', PICK); chips(); load(); }; pk.appendChild(b); }); }
    function regimeCard() {
      var B = a.bars.length > 1 ? a.bars.slice(0, -1) : a.bars, R = B.length >= 60 ? P.mtfCalc.regime(B) : { err: 'short' };
      if (R.err) { rg.innerHTML = '<div class="pm-enote">' + esc(T('rgShort')) + '</div>'; return; }
      var inv = R.trend === 'bull' ? T('rgInvBull', { p: px(R.e50) }) : R.trend === 'bear' ? T('rgInvBear', { p: px(R.e50) }) : R.trend === 'range' ? T('rgInvRange') : T('rgInvMixed');
      rg.innerHTML = '<div class="pm-rgh"><small>' + esc(T('rgTitle', { s: P.pair ? P.pair(sym) : sym, tf: a.cfg.tf })) + '</small><b>' + esc(regimeText(R)) + '</b></div>' +
        '<div class="pm-co">' + [[T('rgAgree'), R.agree + ' / ' + R.of], [T('rgHeld'), f(R.held, 0)], ['ADX (14)', f(R.adx, 1)], [T('rgVolaPct'), f(R.volaPct, 0) + '%'], [T('rgWidthPct'), f(R.widthPct, 0) + '%'], ['EMA 50', px(R.e50)], ['EMA 200', px(R.e200)]].map(function (x) { return '<div class="pm-cor"><small>' + esc(x[0]) + '</small><b class="pm-num" dir="ltr">' + esc(x[1]) + '</b></div>'; }).join('') +
        '<div class="pm-cw2">' + esc(inv) + '</div></div>';
    }
    function load() {
      var my = ++run; tb.innerHTML = ''; sum.textContent = T('loading');
      var rows = {}; PICK.forEach(function (tf) { var tr = h('<tr><td class="pm-num" dir="ltr"></td><td colspan="8" class="pm-enote"></td></tr>'); $$('td', tr)[0].textContent = A.tfLabel ? A.tfLabel(tf) : tf; $$('td', tr)[1].textContent = '…'; tb.appendChild(tr); rows[tf] = tr; });
      var done = 0, res = {};
      PICK.forEach(function (tf) {
        bars(sym, tf).then(function (B) { return P.mtfCalc.row(B); }, function () { return { err: 'data' }; }).then(function (r) {
          if (my !== run) return; res[tf] = r; done++;
          var tr = rows[tf], lab = $$('td', tr)[0].textContent;
          if (r.err) { $$('td', tr)[1].textContent = T(r.err === 'short' ? 'mtfShort' : 'mtfNoData'); }
          else {
            var k3 = { up: 'u', down: 'd', mixed: 'n', na: 'n', flat: 'n' };
            tr.innerHTML = '<td class="pm-num" dir="ltr">' + esc(lab) + '</td><td>' + tag(k3[r.trend], T('mt_' + r.trend)) + '</td><td>' + tag(k3[r.struct.k], r.struct.k === 'na' ? '—' : (r.struct.hh ? 'HH' : 'LH') + ' / ' + (r.struct.hl ? 'HL' : 'LL')) + '</td>' +
              '<td class="pm-num" dir="ltr">' + tag(r.rsi > 55 ? 'u' : r.rsi < 45 ? 'd' : 'n', f(r.rsi, 0)) + '</td><td>' + tag(r.hist > 0 ? 'u' : r.hist < 0 ? 'd' : 'n', (r.hist > 0 ? '+' : r.hist < 0 ? '−' : '0') + (r.histUp == null ? '' : r.histUp ? ' ↑' : ' ↓')) + '</td>' +
              '<td class="pm-num" dir="ltr">' + (r.volX == null ? '—' : tag(r.volX >= 1.5 ? 'h' : 'n', f(r.volX, 2) + '×')) + '</td><td class="pm-num" dir="ltr">' + tag(r.volaPct >= 80 ? 'h' : 'n', f(r.volaPct, 0) + '%') + '</td>' +
              '<td>' + esc(regimeText(r.regime)) + '</td><td>' + tag(k3[r.lean], T('mt_' + r.lean) + ' (' + (r.votes > 0 ? '+' : '') + r.votes + ')') + '</td>';
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
