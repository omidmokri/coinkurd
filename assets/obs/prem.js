/* entekhab.net — the Observatory: /charts/basis/ (the Coinbase premium, the perpetual's premium, the futures curve) and
   /charts/stablecoins/ (the supply of dollar stablecoins and Bitcoin's value against it).
   Data
     /data/obs/premium.json, premium_d.json   Coinbase's and Binance's hourly (90 days) and daily closes of BTC and ETH, and
                              Coinbase's USDT-USD (scripts/obs_premium.py; Coinbase does not answer in every country, so CI reads it)
     /data/obs/stables.json, stables_now.json  DefiLlama's daily total of dollar stablecoins, Tether and USDC, Bitcoin's market
                              value (Coin Metrics) and their ratio; the latest day's figures and DefiLlama's list of coins now
                              (scripts/obs_stables.py)
     Bybit    api.bybit.com    v5/market/premium-index-price-kline — the perpetual's premium index, read in the browser
     Deribit  www.deribit.com  public/get_book_summary_by_currency (kind=future) — every dated future, read in the browser
     /data/obs/curve_hist.json   the yearly basis at a constant 30, 90 and 180 days, one value a day since 2019, from Deribit's
                              daily candles of every monthly and quarterly future and Coinbase's daily close (scripts/obs_curve.py)
   The tiles of the two file-fed views show the summary CI wrote (the bot reads the same figures); the lines are
   plain arithmetic on the closes (assets/obs/flowmath.js). Nothing is a signal: no bands, no verdicts. */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, d = document, w = window, F = w.OBFlow, SRC = OB.src;
  var H = 3600000, DAY = 86400000, YEAR = 365.25 * DAY, MS = OB.IVMS;
  var INK = '#e8e8e3', ACC = '#f7931a', BLUE = '#3987e5', GRN = '#34d399', RED = '#ff5a4d', TEAL = '#199e70', PUR = '#a78bfa', GREY = '#8d8d86';
  var BY = 'https://api.bybit.com/v5/market/', DB = 'https://www.deribit.com/api/v2/public/';
  var BYK = { '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D' };

  var BVIEWS = ['cb', 'perp', 'curve', 'hist'], HI_R = ['1y', '2y', '4y', 'all'], CB_R = ['1w', '1m', '3m', '1y', 'all'], CB_SPAN = { '1w': 7 * DAY, '1m': 30 * DAY, '3m': 90 * DAY, '1y': 365 * DAY };
  var PP_R = ['24h', '3d', '1w', '1m', '3m', '1y'];
  var ST_M = ['supply', 'ssr', 'chg', 'mix'], ST_R = ['1y', '2y', '4y', 'all'], ST_YEARS = { '1y': 1, '2y': 2, '4y': 4 };
  /* the dollar stablecoins named in the table, by ticker and CoinGecko id: each is the largest coin of its ticker, so the site's
     logo of that ticker (the largest coin CoinGecko has under it) is the coin's own. Any other coin of the list is not named. */
  var KNOWN = { USDT: 'tether', USDC: 'usd-coin', USDS: 'usds', USDE: 'ethena-usde', DAI: 'dai', USD1: 'usd1-wlfi', RLUSD: 'ripple-usd', USDG: 'global-dollar',
    PYUSD: 'paypal-usd', FDUSD: 'first-digital-usd', TUSD: 'true-usd', USDD: 'usdd' };
  var DEF = { asset: 'btc', bview: 'cb', cb_r: '1m', pp_r: '1w', hi_r: '2y', st_m: 'supply', st_r: '4y', log: true };
  var S = (function () {
    var s = OB.store.get('ek_obs_pr', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    var q = new URLSearchParams(location.search);
    if (/^(btc|eth)$/.test(q.get('asset') || '')) o.asset = q.get('asset');
    if (BVIEWS.indexOf(q.get('view')) >= 0) o.bview = q.get('view');
    if (ST_M.indexOf(q.get('m')) >= 0) o.st_m = q.get('m');
    o._range = q.get('range');
    return o;
  })();
  var save = OB.debounce(function () { var c = Object.assign({}, S); delete c._range; OB.store.set('ek_obs_pr', c); }, 300);
  var V = { kind: null, el: null, ts: null, seq: 0, timer: null, data: null, loading: false, sub: '', tick: 0 };
  var FILES = {};

  function file(name, force) {
    if (force || !FILES[name]) {
      FILES[name] = OB.getJSON('/data/obs/' + name + '.json' + (force ? '?t=' + Date.now() : ''), 45000).then(function (j) {
        var okf = j && (name === 'premium' ? j.h && j.h.btc && j.summary : name === 'premium_d' ? j.d && j.d.btc : name === 'stables' ? j.cols && j.cols.usd && j.n > 0 : !!j.summary);
        if (!okf) { var e = new Error('no file'); e.status = 404; throw e; }
        return j;
      });
      FILES[name].catch(function () { delete FILES[name]; });
    }
    return FILES[name];
  }
  function tile(label, value, sub, id) { return '<div class="ob-tile"' + (id ? ' id="' + id + '"' : '') + '><small>' + esc(label) + '</small><b class="ob-n">' + value + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>'; }
  function status(html, cls) { var s = $('#ob-status', V.el); if (s) { s.innerHTML = html || ''; s.className = 'ob-status' + (cls ? ' ' + cls : ''); s.hidden = !html; } }
  function fail(head, text) { status('<b>' + esc(head) + '</b><br><span>' + esc(text) + '</span><br><button type="button" class="ob-btn" id="ob-retry">' + esc(T('retry')) + '</button>', 'err'); }
  function coin() { return S.asset.toUpperCase(); }
  function pct(v, dp) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(dp == null ? 2 : dp) + '%'; }
  function usd(v) { return v == null || !isFinite(v) ? '—' : '$' + OB.fmtP(v); }
  function big(v) { return v == null || !isFinite(v) ? '—' : OB.fmtUsd(v); }
  function sgnBig(v) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '-' : '') + OB.fmtUsd(Math.abs(v)); }
  function locPct(v) { return OB.loc(v == null ? '—' : (v >= 99.95 ? '100' : v.toFixed(v < 10 ? 1 : 0))); }
  function rankTxt(p) { return p == null ? '' : esc(T('t_rank', { p: locPct(p) })); }
  function utc(ms) { return new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; }
  function dayTxt(iso) { return iso ? OB.fmtDate(F.dayMs(iso) + 12 * H) : '—'; }       /* a UTC day is named by its noon, so every time zone reads the same date */
  function rangeKey(key, list, def) { if (S._range) { if (list.indexOf(S._range) >= 0) S[key] = S._range; S._range = null; } if (list.indexOf(S[key]) < 0) S[key] = def; return S[key]; }
  function rLabel(k) { return k === 'all' ? T('cr_all') : T('r_' + k); }

  /* ================================================================ the Coinbase premium (file) */
  function cbHourly(R) { return !!CB_SPAN[R] && CB_SPAN[R] <= 90 * DAY; }
  function renderCb(P) {
    var el = V.el, a = S.asset, R = rangeKey('cb_r', CB_R, '1m'), hourly = cbHourly(R), G = hourly ? P.h : P.d;
    if (!G) { load(); return; }                                      /* the daily file is read the first time a daily range is chosen */
    var cb = F.col(G[a] && G[a].cb, G.n), bn = F.col(G[a] && G[a].bn, G.n), us = F.col(G.usdt, G.n), pr = F.premium(cb, bn, us);
    var i1 = F.last(pr.raw); if (i1 < 0) { fail(T('no_file'), T('no_file2_d')); return; }
    var span = CB_SPAN[R], i0 = span ? Math.max(0, i1 - Math.round(span / G.step) + 1) : 0, sh = hourly ? G.step : 0;      /* an hour's close is drawn at its closing time, a day's at the day */
    while (i0 < i1 && pr.raw[i0] == null) i0++;
    var t0 = G.t0 + sh, s = (P.summary || {})[a] || {};
    function line(name, arr, color, wd) { return { name: name, type: 'line', color: color, width: wd || 1.5, data: F.pairs(t0, G.step, arr, 0) }; }       /* the whole file: the range is only what is on screen first */
    var p3 = function (v) { return pct(v, 3); };
    $('#ob-tiles', el).innerHTML =
      tile(T('pm_now'), esc(p3(s.now)), s.now_adj == null ? '' : esc(T('pm_adj', { v: OB.ltr(p3(s.now_adj)) })), 'ob-t-now') +
      tile(T('pm_h24'), esc(p3(s.h24)), s.h24_adj == null ? '' : esc(T('pm_adj', { v: OB.ltr(p3(s.h24_adj)) })), 'ob-t-h24') +
      tile(T('pm_d7'), esc(p3(s.d7)), s.d30 == null ? '' : esc(T('pm_d30', { v: OB.ltr(p3(s.d30)) })), 'ob-t-d7') +
      tile(T('pm_day', { d: dayTxt(s.day) }), esc(p3(s.day_prem)), rankTxt(s.day_pct), 'ob-t-day') +
      tile(T('pm_usdt'), esc(s.usdt == null ? '—' : '$' + (+s.usdt).toFixed(4)), s.usdt == null ? '' : esc(T('pm_usdt_s', { v: OB.ltr(pct((s.usdt - 1) * 100, 2)) })), 'ob-t-usdt');
    var panes = [
      { weight: 2, title: T('p_cb_price', { coin: coin() }), fmt: function (v) { return OB.fmtP(v); }, series: [line(T('p_cb_price', { coin: coin() }), cb, INK, 1.6)] },
      { weight: 3, title: T('p_prem'), fmt: function (v) { return v.toFixed(3) + '%'; }, zero: true, marks: [{ y: 0, color: 'rgba(255,255,255,.35)' }],
        series: [line(T('s_prem'), pr.raw, ACC, 1.7), line(T('s_prem_adj'), pr.adj, BLUE, 1.4)] }
    ];
    if (F.last(us) >= i0) panes.push({ weight: 1.3, title: T('p_usdt'), fmt: function (v) { return v.toFixed(4); }, marks: [{ y: 1, color: 'rgba(255,255,255,.3)', label: '1.0000' }], series: [line(T('p_usdt'), us, TEAL, 1.4)] });
    var tEnd = t0 + i1 * G.step, tBeg = t0 + i0 * G.step;
    V.sub = rLabel(R) + ' · Coinbase / Binance · ' + utc(s.t || tEnd);
    V.ts.set({ daily: !hourly, label: T('aria_cb', { coin: coin() }), view: [tBeg, tEnd + (tEnd - tBeg) * 0.02], panes: panes });
    $('#ob-tbl', el).hidden = true;
    $('#ob-note', el).textContent = T('note_cb') + ' ' + T('src_pm', { t: s.t ? OB.fmtDate(s.t, true) : '—' });
  }

  /* ================================================================ the perpetual's premium index (Bybit, live) */
  function loadPerp(now) {
    var R = OB.dvRange(rangeKey('pp_r', PP_R, '1w')), iv = MS[R.iv], t0 = Math.floor((now - R.span) / iv) * iv, sym = coin() + 'USDT';
    var prem = OB.getJSON(BY + 'premium-index-price-kline?category=linear&symbol=' + sym + '&interval=' + BYK[R.iv] + '&start=' + t0 + '&end=' + now + '&limit=1000', 20000).then(function (j) {
      if (!j || j.retCode !== 0 || !j.result) throw new Error('bybit');
      var seen = {}, out = [];
      (j.result.list || []).forEach(function (k) { var t = +k[0], c = +k[4]; if (!(t > 0) || !isFinite(c) || seen[t]) return; seen[t] = 1; out.push([t, c * 100]); });
      if (!out.length) throw new Error('bybit: no rows');
      return out.sort(function (x, y) { return x[0] - y[0]; });
    });
    return Promise.all([prem, SRC.bybit.klines(sym, R.iv, t0, now).catch(function () { return null; })]).then(function (r) { return { view: 'perp', R: R, now: now, t0: t0, prem: r[0], candles: r[1] }; });
  }
  function renderPerp(D0) {
    var el = V.el, R = D0.R, step = MS[R.iv], daily = step >= DAY, sh = daily ? 0 : step / 2, rows = D0.prem;
    var lastRow = rows[rows.length - 1], sum = 0, hi = rows[0], lo = rows[0], pos = 0;
    rows.forEach(function (x) { sum += x[1]; if (x[1] > hi[1]) hi = x; if (x[1] < lo[1]) lo = x; if (x[1] > 0) pos++; });
    var p4 = function (v) { return pct(v, 4); }, tm = function (x) { return daily ? OB.fmtDate(x[0] + 12 * H) : OB.fmtDate(x[0], true); };
    $('#ob-tiles', el).innerHTML =
      tile(T('pp_now'), esc(p4(lastRow[1])), esc(T(lastRow[1] >= 0 ? 'pp_above' : 'pp_below')), 'ob-t-now') +
      tile(T('pp_mean', { r: T('r_' + R.k) }), esc(p4(sum / rows.length)), esc(T('pp_pos', { p: OB.ltr((pos / rows.length * 100).toFixed(0) + '%') })), 'ob-t-mean') +
      tile(T('pp_hi'), esc(p4(hi[1])), esc(tm(hi)), 'ob-t-hi') + tile(T('pp_lo'), esc(p4(lo[1])), esc(tm(lo)), 'ob-t-lo');
    var cs = (D0.candles || []).map(function (b) { return [b.t, b.o, b.h, b.l, b.c]; });
    var panes = [];
    if (cs.length) panes.push({ weight: 2, title: T('p_price'), fmt: function (v) { return OB.fmtP(v); }, series: [{ name: T('p_price'), type: 'candle', data: cs }] });
    panes.push({ weight: 3, title: T('p_pprem'), fmt: function (v) { return v.toFixed(4) + '%'; }, zero: true, marks: [{ y: 0, color: 'rgba(255,255,255,.35)' }],
      series: [{ name: T('p_pprem'), type: 'line', color: ACC, width: 1.6, data: rows.map(function (x) { return [x[0] + sh, x[1]]; }) }] });
    V.sub = T('r_' + R.k) + ' · Bybit · ' + utc(D0.now);
    V.ts.set({ daily: daily, keepView: V.keep, label: T('aria_pp', { coin: coin() }), view: [rows[0][0], lastRow[0] + step * 1.5], panes: panes });
    $('#ob-tbl', el).hidden = true;
    $('#ob-note', el).textContent = T('note_pp');
  }

  /* ================================================================ the futures curve (Deribit, live) */
  function loadCurve(now) {
    return OB.getJSON(DB + 'get_book_summary_by_currency?currency=' + coin() + '&kind=future', 30000).then(function (j) {
      if (!j || !Array.isArray(j.result)) throw new Error('deribit');
      var c = F.curve(j.result, now); if (c.index == null || !c.exps.length) throw new Error('deribit: no futures');
      return { view: 'curve', now: now, curve: c };
    });
  }
  function renderCurve(D0) {
    var el = V.el, c = D0.curve, now = D0.now, ex = c.exps, main = null;
    ex.forEach(function (x) { if (x.ann != null && (!main || (x.oi || 0) > (main.oi || 0))) main = x; });
    var p2 = function (v) { return pct(v, 2); }, p3 = function (v) { return pct(v, 3); };
    var sg = function (v) { return v == null ? '—' : (v > 0 ? '+' : v < 0 ? '-' : '') + '$' + OB.fmtP(Math.abs(v)); };
    $('#ob-tiles', el).innerHTML =
      tile(T('cu_index', { coin: coin() }), esc(usd(c.index)), 'Deribit', 'ob-t-idx') +
      tile(T('cu_perp'), esc(c.perp ? p3(c.perp.basis) : '—'), c.perp ? esc(OB.ltr(sg(c.perp.usd))) : '', 'ob-t-perp') +
      tile(main ? T('cu_main', { name: main.code }) : T('cu_ann'), esc(main ? p2(main.ann) : '—'), main ? esc(T('cu_main_s', { b: OB.ltr(p2(main.basis)), n: OB.loc(Math.round(main.days)) })) : '', 'ob-t-main') +
      tile(T('cu_oi'), esc(big(c.oi)), esc(T('cu_oi_s', { n: OB.loc(ex.length) })), 'ob-t-oi');
    var price = [[now, c.index]].concat(ex.map(function (x) { return [x.ts, x.mark]; })), ann = ex.filter(function (x) { return x.ann != null; }).map(function (x) { return [x.ts, x.ann]; });
    var panes = [{ weight: 3, title: T('p_curve', { coin: coin() }), fmt: function (v) { return OB.fmtP(v); }, marks: [{ y: c.index, color: 'rgba(255,255,255,.35)', label: T('cu_idx_mark') }],
      series: [{ name: T('p_curve', { coin: coin() }), type: 'line', color: ACC, width: 1.8, data: price }] }];
    if (ann.length > 1) panes.push({ weight: 2, title: T('p_ann'), fmt: function (v) { return v.toFixed(2) + '%'; }, zero: true, marks: [{ y: 0, color: 'rgba(255,255,255,.35)' }],
      series: [{ name: T('p_ann'), type: 'line', color: BLUE, width: 1.8, data: ann }] });
    var tl = ex[ex.length - 1].ts;
    V.sub = 'Deribit · ' + utc(now);
    V.ts.set({ daily: true, keepView: V.keep, label: T('aria_cu', { coin: coin() }), view: [now - (tl - now) * 0.03, tl + (tl - now) * 0.05], panes: panes });
    function row(x, perp) {
      return '<tr><td><b class="ob-n">' + esc(x.name) + '</b></td><td>' + (perp ? '—' : esc(OB.fmtDate(x.ts))) + '</td><td class="ob-n">' + (perp ? '—' : (x.days < 10 ? x.days.toFixed(1) : x.days.toFixed(0))) + '</td><td class="ob-n">$' + esc(OB.fmtP(x.mark)) +
        '</td><td class="ob-n ' + (x.usd >= 0 ? 'up' : 'dn') + '">' + esc(sg(x.usd)) + '</td><td class="ob-n">' + esc(p3(x.basis)) + '</td><td class="ob-n">' + (perp || x.ann == null ? '—' : esc(p2(x.ann))) + '</td><td class="ob-n">' + esc(big(x.oi)) + '</td><td class="ob-n">' + esc(big(x.vol)) + '</td></tr>';
    }
    $('#ob-tbl', el).innerHTML = '<h3>' + esc(T('tbl_cu', { coin: coin() })) + '</h3><p class="ob-mut ob-small">' + esc(T('tbl_cu_n')) + '</p><div class="ob-tblw"><table class="ob-grid" id="ob-ctbl"><thead><tr><th>' + esc(T('th_contract')) + '</th><th>' +
      esc(T('th_exp')) + '</th><th>' + esc(T('th_days')) + '</th><th>' + esc(T('t_price')) + '</th><th>' + esc(T('th_bas_usd')) + '</th><th>' + esc(T('th_bas')) + '</th><th>' + esc(T('th_ann')) + '</th><th>' + esc(T('th_oi')) + '</th><th>' + esc(T('th_vol24')) +
      '</th></tr></thead><tbody>' + (c.perp ? row(c.perp, true) : '') + ex.map(function (x) { return row(x, false); }).join('') + '</tbody></table></div>';
    $('#ob-tbl', el).hidden = false;
    $('#ob-note', el).textContent = T('note_cu');
  }

  /* ================================================================ the curve's history (file) */
  function renderHist(D0) {
    var el = V.el, doc = D0.file, n = doc.n, t0 = F.dayMs(doc.t0), a = doc[S.asset] || {}, s = (doc.summary || {})[S.asset] || {}, R = rangeKey('hi_r', HI_R, '2y');
    var cm30 = F.col(a.cm30, n), cm90 = F.col(a.cm90, n), cm180 = F.col(a.cm180, n), px = F.col(a.px, n), k = F.col(a.k, n);
    var i1 = Math.max(F.last(cm90), F.last(cm30)), yrs = ST_YEARS[R], i0 = yrs ? Math.max(0, i1 - Math.round(yrs * 365.25)) : 0;
    function line(name, arr, color, wd) { return { name: name, type: 'line', color: color, width: wd || 1.5, data: F.pairs(t0, DAY, arr, 0) }; }
    var p2 = function (v) { return pct(v, 2); }, i30 = F.last(cm30), i180 = F.last(cm180);
    $('#ob-tiles', el).innerHTML =
      tile(T('hi_t90', { d: dayTxt(s.day) }), esc(p2(s.cm90)), rankTxt(s.rank), 'ob-t-h90') +
      tile(T('hi_t30'), esc(p2(i30 >= 0 ? cm30[i30] : null)), esc(T('hi_t180', { v: OB.ltr(p2(i180 >= 0 ? cm180[i180] : null)) })), 'ob-t-h30') +
      tile(T('hi_avg'), esc(p2(s.avg365)), esc(T('hi_avg_s')), 'ob-t-havg') +
      tile(T('hi_range'), esc(p2(s.lo)) + ' … ' + esc(p2(s.hi)), esc(dayTxt(s.lo_day) + ' · ' + dayTxt(s.hi_day)), 'ob-t-hrng');
    var panes = [];
    if (F.last(px) >= 0) panes.push({ weight: 2, log: true, title: T('p_cb_price', { coin: coin() }), fmt: function (v) { return OB.fmtP(v); }, series: [line(T('p_cb_price', { coin: coin() }), px, INK, 1.5)] });
    panes.push({ weight: 3, title: T('p_hist'), fmt: function (v) { return v.toFixed(1) + '%'; }, zero: true, marks: [{ y: 0, color: 'rgba(255,255,255,.35)' }],
      series: [line(T('hi_cm180'), cm180, PUR, 1.3), line(T('hi_cm90'), cm90, ACC, 2), line(T('hi_cm30'), cm30, BLUE, 1.3)] });
    V.sub = rLabel(R) + ' · Deribit / Coinbase · ' + dayTxt(s.day);
    V.ts.set({ daily: true, label: T('aria_hist', { coin: coin() }), view: V.keep ? null : [t0 + i0 * DAY, t0 + i1 * DAY + DAY], panes: panes });
    $('#ob-tbl', el).hidden = true;
    $('#ob-note', el).textContent = T('note_hist') + (F.last(k) >= 0 ? ' ' + T('hi_k', { n: OB.loc(String(k[F.last(k)])) }) : '');
  }

  /* ================================================================ stablecoins (file) */
  function renderStables(D, N) {
    var el = V.el, n = D.n, t0 = F.dayMs(D.t0), M = 1e6, s = (N && N.summary) || {}, m = ST_M.indexOf(S.st_m) >= 0 ? S.st_m : (S.st_m = 'supply'), R = rangeKey('st_r', ST_R, '4y');
    var usdA = F.col(D.cols.usd, n), usdt = F.col(D.cols.usdt, n), usdc = F.col(D.cols.usdc, n), cap = F.col(D.cols.cap, n), ssr = F.col(D.cols.ssr, n);
    var i1 = F.last(usdA), tEnd = t0 + i1 * DAY, yrs = ST_YEARS[R], i0 = yrs ? Math.max(0, i1 - Math.round(yrs * 365.25)) : 0;
    function P(a, k) { return F.pairs(t0, DAY, k ? a.map(function (v) { return v == null ? null : v * k; }) : a, 0); }
    function line(name, a, color, wd, k) { return { name: name, type: 'line', color: color, width: wd || 1.5, data: P(a, k) }; }
    var money = function (v) { return OB.fmtUsd(v); }, capPane = { weight: 2, log: S.log, title: T('p_btc_cap'), fmt: money, series: [line(T('p_btc_cap'), cap, INK, 1.6, M)] };
    $('#ob-tiles', el).innerHTML =
      tile(T('st_total'), esc(big(s.usd)), esc(dayTxt(s.date)), 'ob-t-tot') +
      tile(T('st_chg30'), esc(sgnBig(s.chg30)), s.chg30_pct == null ? '' : esc(OB.ltr(pct(s.chg30_pct, 2))) + (s.chg7 == null ? '' : ' · ' + esc(T('st_chg7', { v: OB.ltr(sgnBig(s.chg7)) }))), 'ob-t-chg') +
      tile(T('st_ssr'), esc(s.ssr == null ? '—' : (+s.ssr).toFixed(2)), rankTxt(s.ssr_pct) + (s.ssr_date && s.ssr_date !== s.date ? ' · ' + esc(dayTxt(s.ssr_date)) : ''), 'ob-t-ssr') +
      tile(T('st_usdt'), esc(s.usdt_share == null ? '—' : (+s.usdt_share).toFixed(1) + '%'), s.usdc_share == null ? '' : esc(T('st_usdc', { p: OB.ltr((+s.usdc_share).toFixed(1) + '%') })), 'ob-t-usdt');
    var panes;
    if (m === 'ssr') panes = [{ weight: 2, log: S.log, title: T('p_two'), fmt: money, series: [line(T('p_btc_cap'), cap, INK, 1.6, M), line(T('sm_supply'), usdA, TEAL, 1.6, M)] },
      { weight: 3, title: T('sm_ssr'), fmt: function (v) { return v.toFixed(2); }, series: [line(T('sm_ssr'), ssr, ACC, 1.7)] }];
    else if (m === 'chg') panes = [capPane, { weight: 3, title: T('p_chg30'), fmt: money, marks: [{ y: 0, color: 'rgba(255,255,255,.3)' }],
      series: [{ name: T('p_chg30'), type: 'bars', color: GRN, neg: RED, data: P(F.diff(usdA, 30), M) }] }];
    else if (m === 'mix') {
      var rest = usdA.map(function (v, i) { return v == null || usdt[i] == null || usdc[i] == null ? null : v - usdt[i] - usdc[i]; });
      panes = [{ weight: 3, log: S.log, title: T('p_mix'), fmt: money, series: [line('USDT', usdt, TEAL, 1.7, M), line('USDC', usdc, BLUE, 1.7, M), line(T('s_rest'), rest, GREY, 1.4, M)] },
        { weight: 2, title: T('p_usdt_share'), fmt: function (v) { return v.toFixed(1) + '%'; }, series: [line(T('p_usdt_share'), F.ratio(usdt, usdA, 100), PUR, 1.5)] }];
    } else panes = [capPane, { weight: 3, log: S.log, title: T('p_supply'), fmt: money, series: [{ name: T('p_supply'), type: 'area', color: TEAL, width: 1.7, data: P(usdA, M) }] }];
    var tBeg = t0 + i0 * DAY;
    V.sub = T('cr_' + R) + ' · DefiLlama' + (m === 'ssr' || m === 'supply' || m === 'chg' ? ' / Coin Metrics' : '') + ' · ' + (s.date || '');
    V.ts.set({ daily: true, label: T('aria_st', { m: T('sm_' + m) }), view: [tBeg, tEnd + (tEnd - tBeg) * 0.02], panes: panes });
    /* the coins now: the well-known ones, each with its own logo */
    var top = N && Array.isArray(N.top) ? N.top : [], rows = '';
    function chg(v) { return '<td class="ob-n ' + (v > 0 ? 'up' : v < 0 ? 'dn' : '') + '">' + esc(v == null ? '—' : sgnBig(v)) + '</td>'; }
    top.forEach(function (c) {
      var sym = String(c.s || '').toUpperCase(); if (KNOWN[sym] !== c.g || OB.hasLogo(sym) === false || !(c.c > 0)) return;
      rows += '<tr><td><span class="ob-rowc">' + OB.logo(sym, 18) + '<b>' + esc(c.s) + '</b></span> <small>' + esc(c.n || '') + '</small></td><td class="ob-n">' + esc(big(c.c)) + '</td>' + chg(c.d1) + chg(c.d7) + chg(c.d30) + '</tr>';
    });
    var tb = $('#ob-tbl', el);
    tb.innerHTML = rows ? '<h3>' + esc(T('tbl_st')) + '</h3><p class="ob-mut ob-small">' + esc(T('tbl_st_n', { t: N.top_at ? OB.fmtDate(Date.parse(N.top_at), true) : '—' })) + '</p><div class="ob-tblw"><table class="ob-grid" id="ob-stbl"><thead><tr><th>' + esc(T('th_coin')) + '</th><th>' +
      esc(T('th_supply')) + '</th><th>' + esc(T('th_d1')) + '</th><th>' + esc(T('th_d7')) + '</th><th>' + esc(T('th_d30')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '';
    tb.hidden = !rows;
    $('#ob-note', el).textContent = T('note_st') + ' ' + T('src_st', { d: dayTxt(s.date) });
    OB.ui.setSeg(el, 'ob-m', m); var sel = $('#ob-msel', el); if (sel) sel.value = m;
  }

  /* ================================================================ frame */
  function render() {
    var D0 = V.data; if (!D0 || !V.ts) return;
    status('');                                                      /* what is drawn is valid data: an earlier error of another range goes */
    if (V.kind === 'stables') renderStables(D0.file, D0.now);
    else if (D0.view === 'cb') renderCb(D0);
    else if (D0.view === 'perp') renderPerp(D0);
    else if (D0.view === 'hist') renderHist(D0);
    else renderCurve(D0);
  }
  function load(quiet, force) {
    var seq = ++V.seq, now = Date.now(), view = V.kind === 'stables' ? 'st' : S.bview; V.loading = true;
    if (!quiet) status('<span class="ob-spin"></span>' + esc(T(view === 'perp' ? 'loading_by' : view === 'curve' ? 'loading_cu' : 'loading3')));
    var p = view === 'st' ? Promise.all([file('stables', force), file('stables_now', force)]).then(function (r) { return { view: 'st', file: r[0], now: r[1] }; })
      : view === 'cb' ? Promise.all([file('premium', force), cbHourly(rangeKey('cb_r', CB_R, '1m')) ? (FILES.premium_d || null) : file('premium_d', force)]).then(function (r) {
        return { view: 'cb', h: r[0].h, summary: r[0].summary, d: r[1] ? r[1].d : null };
      }) : view === 'hist' ? file('curve_hist', force).then(function (f) { if (!f || !f.n) throw Object.assign(new Error('empty'), { status: 404 }); return { view: 'hist', file: f }; })
      : view === 'perp' ? loadPerp(now) : loadCurve(now);
    p.then(function (data) {
      if (seq !== V.seq) return;
      V.keep = !!quiet && !!V.data && V.data.view === view;            /* a quiet refresh of the same view leaves the reader's zoom alone */
      V.data = data; V.loading = false; status(''); render(); V.keep = false;
    }, function (e) {
      if (seq !== V.seq) return;
      V.loading = false; if (w.console) console.warn(e);
      if (quiet && V.data && V.data.view === view) return;
      if (view === 'st' || view === 'cb' || view === 'hist') fail(T(e && e.status === 404 ? 'no_file' : 'err_file'), T(e && e.status === 404 ? 'no_file2_d' : 'err_file_d'));
      else if (view === 'perp') fail(T('err_ex'), T('err_bybit_d'));
      else fail(T('err_ex'), T('err_deribit'));
    });
  }
  function rangeCtl() {
    if (V.kind === 'stables') return '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' + OB.ui.seg('ob-r', ST_R.map(function (k) { return [k, T('cr_' + k)]; }), rangeKey('st_r', ST_R, '4y'), 'ob-rng') + '</label>' +
      '<label class="ob-lbl"><span>' + esc(T('scale')) + '</span>' + OB.ui.seg('ob-sc', [['log', T('sc_log')], ['lin', T('sc_lin')]], S.log ? 'log' : 'lin') + '</label>';
    if (S.bview === 'cb') return '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' + OB.ui.seg('ob-r', CB_R.map(function (k) { return [k, rLabel(k)]; }), rangeKey('cb_r', CB_R, '1m'), 'ob-rng') + '</label>';
    if (S.bview === 'perp') return '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' + OB.ui.seg('ob-r', PP_R.map(function (k) { return [k, T('r_' + k)]; }), rangeKey('pp_r', PP_R, '1w'), 'ob-rng') + '</label>';
    if (S.bview === 'hist') return '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' + OB.ui.seg('ob-r', HI_R.map(function (k) { return [k, T('cr_' + k)]; }), rangeKey('hi_r', HI_R, '2y'), 'ob-rng') + '</label>';
    return '';
  }
  function pickCtl() {
    if (V.kind === 'stables') {
      var cur = ST_M.indexOf(S.st_m) >= 0 ? S.st_m : 'supply';
      return '<label class="ob-lbl ob-wide"><span>' + esc(T('measure')) + '</span>' + OB.ui.seg('ob-m', ST_M.map(function (k) { return [k, T('sm_' + k)]; }), cur, 'ob-rng') + '</label>' +
        '<label class="ob-lbl ob-narrow"><span>' + esc(T('measure')) + '</span><select class="ob-sel" id="ob-msel">' + ST_M.map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(T('sm_' + k)) + '</option>'; }).join('') + '</select></label>';
    }
    return '<label class="ob-lbl"><span>' + esc(T('asset')) + '</span>' + OB.ui.seg('ob-as', [['btc', 'BTC'], ['eth', 'ETH']], S.asset, 'ob-num') + '</label>' +
      '<label class="ob-lbl ob-wide"><span>' + esc(T('view')) + '</span>' + OB.ui.seg('ob-v', BVIEWS.map(function (k) { return [k, T('bv_' + k)]; }), S.bview, 'ob-rng') + '</label>' +
      '<label class="ob-lbl ob-narrow"><span>' + esc(T('view')) + '</span><select class="ob-sel" id="ob-vsel">' + BVIEWS.map(function (k) { return '<option value="' + k + '"' + (k === S.bview ? ' selected' : '') + '>' + esc(T('bv_' + k)) + '</option>'; }).join('') + '</select></label>';
  }
  function setView(v) {
    if (BVIEWS.indexOf(v) < 0 || v === S.bview) return;
    S.bview = v; save(); OB.ui.setSeg(V.el, 'ob-v', v); var sel = $('#ob-vsel', V.el); if (sel) sel.value = v;
    var rc = rangeCtl(); $('#ob-more', V.el).innerHTML = rc; $('#ob-gear', V.el).classList.toggle('ob-off', !rc); V.data = null; $('#ob-tiles', V.el).innerHTML = ''; $('#ob-tbl', V.el).hidden = true; load();
  }
  function mount(kind, el) {
    V.kind = kind; V.el = el; V.data = null; V.tick = 0;
    if (BVIEWS.indexOf(S.bview) < 0) S.bview = 'cb';
    el.innerHTML = '<div class="ob-tools">' + pickCtl() +
      '<button type="button" class="ob-ib ob-gear' + (rangeCtl() ? '' : ' ob-off') + '" id="ob-gear" aria-expanded="false" aria-controls="ob-more" aria-label="' + esc(T('more')) + '" title="' + esc(T('more')) + '">' + OB.icon('gear') + '</button>' +
      '<div class="ob-more" id="ob-more">' + rangeCtl() + '</div>' + OB.ui.acts() + '</div><div class="ob-tiles" id="ob-tiles"></div><div class="ob-tsbox"><div class="ob-ts" id="ob-ts"></div><div class="ob-status" id="ob-status"></div></div>' +
      '<p class="ob-note" id="ob-note"></p><div class="ob-tblbox" id="ob-tbl" hidden></div>';
    V.ts = new OB.TS($('#ob-ts', el));
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      var seg = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null, v = b.getAttribute('data-v');
      if (seg === 'ob-as' && v !== S.asset) { S.asset = v; OB.ui.setSeg(el, 'ob-as', v); save(); if ((S.bview === 'cb' || S.bview === 'hist') && V.data && V.data.view === S.bview) render(); else load(); }
      else if (seg === 'ob-v') setView(v);
      else if (seg === 'ob-m' && v !== S.st_m) { S.st_m = v; save(); render(); }
      else if (seg === 'ob-r') {
        var key = V.kind === 'stables' ? 'st_r' : S.bview === 'cb' ? 'cb_r' : S.bview === 'hist' ? 'hi_r' : 'pp_r'; if (v === S[key]) return;
        S[key] = v; OB.ui.setSeg(el, 'ob-r', v); save(); if (V.kind === 'stables' || S.bview === 'cb' || S.bview === 'hist') render(); else load();
      }
      else if (seg === 'ob-sc') { S.log = v === 'log'; OB.ui.setSeg(el, 'ob-sc', v); save(); render(); }
      else if (b.id === 'ob-gear') { var op = !$('.ob-tools', el).classList.contains('open'); $('.ob-tools', el).classList.toggle('open', op); b.setAttribute('aria-expanded', op ? 'true' : 'false'); if (V.ts) V.ts.onResize(); }
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') load(false, true);
      else if (b.id === 'ob-full') OB.fullscreen(d.getElementById('ob'));
      else if (b.id === 'ob-png') { if (V.ts && V.data) V.ts.png(V.kind === 'stables' ? T('sm_' + S.st_m) : coin() + ' · ' + T('bv_' + S.bview), V.sub, 'entekhab-' + (V.kind === 'stables' ? 'stablecoins-' + S.st_m : 'basis-' + S.bview + '-' + coin()) + '.png'); }
      else if (b.id === 'ob-share') OB.ui.share(V.kind === 'stables' ? { m: S.st_m, range: S.st_r } : { asset: S.asset, view: S.bview, range: S.bview === 'cb' ? S.cb_r : S.bview === 'perp' ? S.pp_r : S.bview === 'hist' ? S.hi_r : null });
    };
    el.onchange = function (e) {
      if (e.target.id === 'ob-msel' && e.target.value !== S.st_m) { S.st_m = e.target.value; save(); render(); }
      else if (e.target.id === 'ob-vsel') setView(e.target.value);
    };
    clearInterval(V.timer);
    /* live views refresh quietly while the tab is in view: the curve every minute, the perpetual's premium every two */
    V.timer = setInterval(function () {
      V.tick++;
      if (d.hidden || V.loading || !V.data || V.kind !== 'basis') return;
      if (S.bview === 'curve' || (S.bview === 'perp' && V.tick % 2 === 0)) load(true);
    }, 60000);
    load();
  }
  function unmount() { V.seq++; clearInterval(V.timer); if (V.ts) V.ts.destroy(); V.ts = null; V.data = null; }
  OB.views.basis = { mount: function (el) { mount('basis', el); }, unmount: unmount };
  OB.views.stables = { mount: function (el) { mount('stables', el); }, unmount: unmount };
  OB._pr = { V: V, S: S, FILES: FILES, KNOWN: KNOWN };
})();
