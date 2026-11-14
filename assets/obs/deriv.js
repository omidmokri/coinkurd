/* entekhab.net — the Observatory: /charts/open-interest/ · /charts/funding-rate/ · /charts/long-short/.
   Data: assets/obs/src.js (public endpoints of Binance, Bybit, OKX, Bitget, Hyperliquid and Gate, read in the browser).
   Charts: assets/obs/ts.js (OB.TS). Every number on these pages is what an exchange returned, or simple arithmetic
   on it that the page names (a sum, a share, a rate brought to 8 hours, a rate × 3 × 365). */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, $$ = OB.$$, clamp = OB.clamp, d = document, w = window;
  var H = 3600000, D = 86400000, lastLE = OB.TS.lastLE;
  var INK = '#e8e8e3', UPC = '#34d399', DNC = '#ff5a4d';
  var LSC = { bn_all: '#3987e5', by_all: '#d95926', bn_top_acc: '#199e70', bn_top_pos: '#c98500', gt_all: '#2bb673', gt_top_acc: '#9b6bdf', gt_top_pos: '#e0559a' };

  var DEF = { coin: 'BTC', oi_r: '1w', oi_u: 'usd', fr_r: '1m', fr_u: '8h', ls_r: '1w' };
  var S = (function () {
    var s = OB.store.get('ek_obs_dv', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    var q = new URLSearchParams(location.search), v = q.get('coin');
    if (v && /^[A-Z0-9]{1,14}$/.test(v)) o.coin = v;
    o._range = q.get('range');
    return o;
  })();
  var save = OB.debounce(function () { var c = Object.assign({}, S); delete c._range; OB.store.set('ek_obs_dv', c); }, 300);
  var V = { kind: null, el: null, coin: null, seq: 0, ts: null, timer: null, data: null };

  function pct(x, dp) { return x == null || !isFinite(x) ? '—' : (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(dp == null ? 4 : dp) + '%'; }
  function tile(label, value, sub, cls) { return '<div class="ob-tile"><small>' + esc(label) + '</small><b class="ob-n' + (cls ? ' ' + cls : '') + '">' + value + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>'; }
  function status(html, cls) { var s = $('#ob-status', V.el); if (s) { s.innerHTML = html || ''; s.className = 'ob-status' + (cls ? ' ' + cls : ''); s.hidden = !html; } }
  function fail(e) {
    if (w.console) console.error(e);
    status('<b>' + esc(T(e && e.message === 'not listed' ? 'err_list' : 'err_net')) + '</b><br><span>' + esc(T('err_net_d')) + '</span><br><button type="button" class="ob-btn" id="ob-retry">' + esc(T('retry')) + '</button>', 'err');
  }
  function pickCoinObj(list) { for (var i = 0; i < list.length; i++) if (list[i].base === S.coin) return list[i]; return list.filter(function (c) { return c.base === 'BTC'; })[0] || list[0]; }
  function rangeKey(k, allowed) { if (S._range && allowed.indexOf(S._range) >= 0) { S[k] = S._range; S._range = null; } if (allowed.indexOf(S[k]) < 0) S[k] = allowed[Math.min(2, allowed.length - 1)]; return S[k]; }
  function priceAt(candles, t) { var i = lastLE(candles, t); return i < 0 ? (candles.length ? candles[0][1] : NaN) : (candles[i][0] === t ? candles[i][1] : candles[i][4]); }

  /* ================================================================ shared frame */
  function frame(kind, el, tools, body) {
    V.kind = kind; V.el = el; V.ts = null; V.data = null;
    el.innerHTML = '<div class="ob-tools">' + OB.ui.coinBtn(S.coin) + tools + OB.ui.acts() + '</div>' + body;
    OB.ui.coinLabel(el, S.coin); OB.loadLogos().then(function () { OB.ui.coinLabel(el, S.coin); });
    V.ts = new OB.TS($('#ob-ts', el));                       /* made at once: it gives the page its height while the data loads */
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      if (b.id === 'ob-coin') OB.ui.pickCoin({ current: function () { return S.coin; }, onPick: setCoin });
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') load();
      else if (b.id === 'ob-full') OB.fullscreen(d.getElementById('ob'));
      else if (b.id === 'ob-png') { if (V.ts) V.ts.png(S.coin + ' · ' + T('tab_' + V.kind, null), V.sub || '', 'entekhab-' + V.kind + '-' + S.coin + '.png'); }
      else if (b.id === 'ob-share') OB.ui.share({ coin: S.coin, range: S[{ oi: 'oi_r', funding: 'fr_r', ls: 'ls_r' }[V.kind]] });
    });
    clearInterval(V.timer);
    /* a quiet refresh while the tab is in view: every 90 seconds for the small lists, every 2 minutes where the page reads
       the exchanges' whole lists of contracts (a megabyte before compression) */
    V.timer = setInterval(function () { if (!d.hidden && V.data && !V.loading) load(true); }, kind === 'ls' ? 90000 : 120000);
  }
  function setCoin(base) { S.coin = base; save(); OB.ui.coinLabel(V.el, base); load(); }
  function load(quiet) {
    var seq = ++V.seq; V.loading = true;
    if (!quiet) status('<span class="ob-spin"></span>' + esc(T('loading2')));
    OB.coins(!quiet).then(function (list) {
      if (seq !== V.seq) return;
      var coin = pickCoinObj(list); if (coin.base !== S.coin) { S.coin = coin.base; OB.ui.coinLabel(V.el, S.coin); }
      V.coin = coin; V.coins = list;
      return LOAD[V.kind](coin, Date.now());
    }).then(function (data) {
      if (seq !== V.seq || !data) return;
      V.data = data; V.loading = false; status(''); RENDER[V.kind](data);
    }).catch(function (e) { if (seq !== V.seq) return; V.loading = false; if (!quiet || !V.data) fail(e); });
  }
  function chart(o) { if (V.ts) V.ts.set(o); }
  function unmount() { V.seq++; clearInterval(V.timer); if (V.ts) V.ts.destroy(); V.ts = null; var p = d.getElementById('ob-pick'); if (p) p.remove(); }
  var LOAD = {}, RENDER = {};

  /* ================================================================ open interest */
  var OI_R = ['24h', '3d', '1w', '1m', '3m', '1y'];
  LOAD.oi = function (coin, now) {
    var R = OB.dvRange(rangeKey('oi_r', OI_R));
    return Promise.all([OB.candles(coin, R, now), OB.oiHistory(coin, R, now), OB.snapshot(coin), OB.oiChange(coin, now).catch(function () { return null; })]).then(function (r) {
      return { coin: coin, R: R, now: now, candles: r[0], hist: r[1], snap: r[2], chg: r[3] };
    });
  };
  RENDER.oi = function (D0) {
    var el = V.el, cs = D0.candles.rows, usd = S.oi_u === 'usd', snap = D0.snap;
    /* table: the present open interest on every exchange that answered */
    var ref = cs[cs.length - 1][4], odd = [];
    var rows = OB.EX.map(function (ex) {
      var s = snap[ex.id]; if (!s || !(s.oi > 0)) return null;
      if (!OB.samePx(s.px, ref)) { odd.push(ex.name); return null; }          /* another coin or unit under this name there: not added in */
      return { ex: ex, oi: s.oi, usd: s.oiUsd != null ? s.oiUsd : s.oi * (s.px || ref), fr8: s.fr8 };
    }).filter(Boolean);
    var tot = rows.reduce(function (a, r) { return a + r.usd; }, 0), totC = rows.reduce(function (a, r) { return a + r.oi; }, 0);
    rows.sort(function (a, b) { return b.usd - a.usd; });
    var missing = OB.EX.filter(function (ex) { return !(snap[ex.id] && snap[ex.id].oi > 0); }).map(function (ex) { return ex.name; });
    /* history: one line per exchange, and their sum where every one of them has a value */
    var series = [], sum = null, lines = D0.hist.filter(function (h) { return h.rows && h.rows.length > 1; });
    lines.forEach(function (h) {
      var ex = OB.exById(h.ex), data = h.rows.map(function (x) { return [x[0], usd ? x[1] * priceAt(cs, x[0]) : x[1]]; });
      series.push({ name: ex.name, type: 'line', color: ex.color, data: data, width: 1.6 });
    });
    if (lines.length > 1) {
      var maps = series.map(function (s) { var m = {}; s.data.forEach(function (x) { m[x[0]] = x[1]; }); return m; });
      sum = series[0].data.filter(function (x) { return maps.every(function (m) { return m[x[0]] != null; }); }).map(function (x) { return [x[0], maps.reduce(function (a, m) { return a + m[x[0]]; }, 0)]; });
      series.unshift({ name: T('s_total', { n: OB.loc(lines.length) }), type: 'area', color: INK, data: sum, width: 2 });
    }
    var chg = D0.chg ? (usd ? D0.chg.usd : D0.chg.coin) : null, px = cs[cs.length - 1][4];
    $('#ob-tiles', el).innerHTML =
      tile(T('t_total_oi', { n: OB.loc(rows.length) }), esc(OB.fmtUsd(tot)), '<span class="ob-n">' + esc(OB.compact(totC)) + ' ' + esc(D0.coin.base) + '</span>') +
      tile(T(usd ? 't_chg24' : 't_chg24_c'), esc(chg == null ? '—' : OB.fmtPct(chg)), esc(T('t_chg24_s', { ex: D0.chg ? D0.chg.ex.map(function (id) { return OB.exById(id).name; }).join(' + ') : '—' })), chg == null ? '' : chg > 0 ? 'up' : chg < 0 ? 'dn' : '') +
      tile(T('t_price'), '$' + esc(OB.fmtP(px)), esc(OB.exById(D0.candles.ex).name));
    V.sub = T('r_' + S.oi_r) + ' · ' + lines.map(function (h) { return OB.exById(h.ex).name; }).join(' + ') + ' · ' + new Date(D0.now).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    chart({ daily: D0.R.iv === '1d', label: T('aria_oi', { coin: D0.coin.base }), panes: [
      { weight: 3, title: T('p_price'), fmt: function (v) { return OB.fmtP(v); }, series: [{ name: T('p_price'), type: 'candle', data: cs }] },
      { weight: 3, title: T(usd ? 'p_oi_usd' : 'p_oi_coin', { coin: D0.coin.base }), fmt: usd ? function (v) { return OB.fmtUsd(v); } : OB.compact, series: series.length ? series : [{ name: '—', type: 'line', color: INK, data: [] }] }
    ] });
    var short = D0.hist.filter(function (h) { return h.ex === 'binance' && h.rows && h.rows.length && h.rows[0][0] > D0.candles.t0 + 2 * D; }).length;
    $('#ob-note', el).textContent = T('note_oi') + (short ? ' ' + T('oi_note_30') : '');
    var th = '<thead><tr><th>' + esc(T('th_ex')) + '</th><th>' + esc(T('th_oi')) + '</th><th class="ob-barh">' + esc(T('th_share')) + '</th><th>' + esc(T('th_coins', { coin: D0.coin.base })) + '</th><th>' + esc(T('th_fr')) + '</th></tr></thead>';
    var tb = rows.map(function (r) {
      var sh = tot ? r.usd / tot * 100 : 0;
      return '<tr><td><i class="ob-dot" style="background:' + r.ex.color + '"></i>' + esc(r.ex.name) + '</td><td class="ob-n">' + esc(OB.fmtUsd(r.usd)) + '</td><td class="ob-barc"><span class="ob-bar"><i style="width:' + sh.toFixed(1) + '%;background:' + r.ex.color + '"></i></span><span class="ob-n">' + sh.toFixed(1) + '%</span></td><td class="ob-n">' + esc(OB.compact(r.oi)) + '</td><td class="ob-n">' + esc(pct(r.fr8 == null ? null : r.fr8 * 100)) + '</td></tr>';
    }).join('');
    $('#ob-table', el).innerHTML = '<h3>' + esc(T('tbl_oi', { coin: D0.coin.base })) + '</h3><div class="ob-tblw"><table class="ob-tb ob-grid">' + th + '<tbody>' + tb + '</tbody><tfoot><tr><td>' + esc(T('total')) + '</td><td class="ob-n">' + esc(OB.fmtUsd(tot)) + '</td><td></td><td class="ob-n">' + esc(OB.compact(totC)) + '</td><td></td></tr></tfoot></table></div>' +
      (missing.length ? '<p class="ob-mut ob-small" id="ob-miss">' + esc(T('ex_missing', { ex: missing.join(', ') })) + '</p>' : '') +
      (odd.length ? '<p class="ob-mut ob-small" id="ob-odd">' + esc(T('ex_odd', { ex: odd.join(', ') })) + '</p>' : '');
  };
  OB.views.oi = {
    mount: function (el) {
      frame('oi', el,
        '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' + OB.ui.seg('ob-r', OI_R.map(function (k) { return [k, T('r_' + k)]; }), rangeKey('oi_r', OI_R), 'ob-rng') + '</label>' +
        '<label class="ob-lbl"><span>' + esc(T('unit')) + '</span>' + OB.ui.seg('ob-u', [['usd', T('u_usd')], ['coin', T('u_coin')]], S.oi_u) + '</label>',
        '<div class="ob-tiles" id="ob-tiles"></div><div class="ob-tsbox"><div class="ob-ts" id="ob-ts"></div><div class="ob-status" id="ob-status"></div></div><p class="ob-note" id="ob-note"></p><div class="ob-tblbox" id="ob-table"></div>');
      el.addEventListener('click', function (e) {
        var b = e.target.closest('.ob-seg button'); if (!b) return; var v = b.getAttribute('data-v');
        if (b.parentNode.id === 'ob-r' && S.oi_r !== v) { S.oi_r = v; OB.ui.setSeg(el, 'ob-r', v); save(); load(); }
        if (b.parentNode.id === 'ob-u' && S.oi_u !== v) { S.oi_u = v; OB.ui.setSeg(el, 'ob-u', v); save(); if (V.data) RENDER.oi(V.data); }
      });
      load();
    }, unmount: unmount };

  /* ================================================================ funding rate */
  var FR_R = ['1w', '1m', '3m', '1y'], FR_EX = ['binance', 'bybit', 'okx', 'bitget', 'hyperliquid'];
  LOAD.funding = function (coin, now) {
    var R = OB.dvRange(rangeKey('fr_r', FR_R));
    return Promise.all([OB.candles(coin, R, now), OB.fundingHistory(coin, now - R.span, now), OB.fundingTable()]).then(function (r) {
      return { coin: coin, R: R, now: now, candles: r[0], hist: r[1], table: r[2] };
    });
  };
  /* a rate per 8 hours → the unit on screen (per cent per 8 hours, or per year: × 3 × 365) */
  function frShow(fr8) { return fr8 == null || !isFinite(fr8) ? null : S.fr_u === 'apr' ? fr8 * 3 * 365 * 100 : fr8 * 100; }
  function frTxt(fr8) { var v = frShow(fr8); return pct(v, S.fr_u === 'apr' ? 1 : 4); }
  /* background of a table cell: blue when shorts pay (negative), orange when longs pay (positive), nothing near zero */
  function frBg(fr8) {
    if (fr8 == null || !isFinite(fr8)) return '';
    var x = clamp(fr8 / 0.0006, -1, 1), a = (0.07 + 0.55 * Math.abs(x)).toFixed(2);
    return Math.abs(x) < 0.04 ? '' : 'background:rgba(' + (x < 0 ? '57,135,229' : '247,147,26') + ',' + a + ')';
  }
  RENDER.funding = function (D0) {
    var el = V.el, cs = D0.candles.rows, base = D0.coin.base, tab = D0.table;
    /* a rate counts only where the exchange's price for that name is the price of the same coin (OB.samePx) */
    function refOf(b) { var x = tab.binance && tab.binance[b], y = tab.bybit && tab.bybit[b]; return x && x.px > 0 ? x.px : y && y.px > 0 ? y.px : null; }
    function cell(id, b) { var m = tab[id], x = m && m[b]; return x && x.fr8 != null && isFinite(x.fr8) && OB.samePx(x.px, refOf(b)) ? x.fr8 : null; }
    var now8 = FR_EX.map(function (id) { var v = cell(id, base); return v == null ? null : { ex: OB.exById(id), fr8: v }; }).filter(Boolean);
    var mean = now8.length ? now8.reduce(function (a, x) { return a + x.fr8; }, 0) / now8.length : null;
    var hi = now8.slice().sort(function (a, b) { return b.fr8 - a.fr8; })[0], lo = now8.slice().sort(function (a, b) { return a.fr8 - b.fr8; })[0];
    $('#ob-tiles', el).innerHTML =
      tile(T('fr_mean', { n: OB.loc(now8.length) }), esc(pct(mean == null ? null : mean * 100)), esc(T('fr_per8'))) +      /* no green or red: a positive rate is not good news or bad */
      tile(T('fr_ann'), esc(pct(mean == null ? null : mean * 3 * 365 * 100, 1)), esc(T('fr_ann_s'))) +
      tile(T('fr_high'), esc(hi ? pct(hi.fr8 * 100) : '—'), esc(hi ? hi.ex.name : '')) +
      tile(T('fr_low'), esc(lo ? pct(lo.fr8 * 100) : '—'), esc(lo ? lo.ex.name : ''));
    var series = D0.hist.filter(function (h) { return h.rows && h.rows.length > 1 && !(tab[h.ex] && tab[h.ex][base] && !OB.samePx(tab[h.ex][base].px, refOf(base))); }).map(function (h) {
      var ex = OB.exById(h.ex); return { name: ex.name, type: 'step', color: ex.color, data: h.rows.map(function (x) { return [x[0], frShow(x[1])]; }), width: 1.6 };
    });
    V.sub = T('r_' + S.fr_r) + ' · ' + series.map(function (s) { return s.name; }).join(' / ') + ' · ' + T(S.fr_u === 'apr' ? 'u_apr' : 'u_8h') + ' · ' + new Date(D0.now).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    chart({ daily: D0.R.iv === '1d', label: T('aria_fr', { coin: base }), panes: [
      { weight: 2, title: T('p_price'), fmt: function (v) { return OB.fmtP(v); }, series: [{ name: T('p_price'), type: 'candle', data: cs }] },
      { weight: 3, zero: true, title: T(S.fr_u === 'apr' ? 'p_fr_apr' : 'p_fr_8h'), fmt: function (v) { return pct(v, S.fr_u === 'apr' ? 1 : 4); }, marks: [{ y: 0, color: 'rgba(255,255,255,.35)' }], series: series.length ? series : [{ name: '—', type: 'line', color: INK, data: [] }] }
    ] });
    $('#ob-note', el).textContent = T('note_fr');
    /* the table: the most traded coins × the exchanges */
    var coins = (V.coins || []).filter(function (c) { return OB.hasLogo(c.base) !== false; }).slice(0, 40).map(function (c) {
      var cells = FR_EX.map(function (id) { return cell(id, c.base); }), have = cells.filter(function (x) { return x != null; });
      if (have.length < 2) return null;
      return { c: c, cells: cells, avg: have.reduce(function (a, x) { return a + x; }, 0) / have.length, spread: Math.max.apply(null, have) - Math.min.apply(null, have) };
    }).filter(Boolean);
    var sort = V.frSort || 'vol';
    if (sort === 'avg') coins.sort(function (a, b) { return b.avg - a.avg; });
    else if (sort === 'spread') coins.sort(function (a, b) { return b.spread - a.spread; });
    else if (FR_EX.indexOf(sort) >= 0) { var si = FR_EX.indexOf(sort); coins.sort(function (a, b) { return (b.cells[si] == null ? -9 : b.cells[si]) - (a.cells[si] == null ? -9 : a.cells[si]); }); }
    function thS(k, label) { return '<th><button type="button" class="ob-ths' + (sort === k ? ' on' : '') + '" data-sort="' + k + '">' + esc(label) + '</button></th>'; }
    var dead = FR_EX.filter(function (id) { return !tab[id]; }).map(function (id) { return OB.exById(id).name; });
    var th = '<thead><tr>' + thS('vol', T('th_coin')) + FR_EX.map(function (id) { return thS(id, OB.exById(id).name); }).join('') + thS('avg', T('th_avg')) + thS('spread', T('th_spread')) + '</tr></thead>';
    var tb = coins.map(function (r) {
      return '<tr data-c="' + esc(r.c.base) + '"' + (r.c.base === base ? ' class="on"' : '') + '><td><button type="button" class="ob-rowc" data-c="' + esc(r.c.base) + '">' + OB.logo(r.c.base, 18) + '<b>' + esc(r.c.base) + '</b></button></td>' +
        r.cells.map(function (x) { return '<td class="ob-n ob-frc" style="' + frBg(x) + '">' + esc(frTxt(x)) + '</td>'; }).join('') +
        '<td class="ob-n ob-frc" style="' + frBg(r.avg) + '">' + esc(frTxt(r.avg)) + '</td><td class="ob-n">' + esc(pct(frShow(r.spread), S.fr_u === 'apr' ? 1 : 4).replace(/^\+/, '')) + '</td></tr>';
    }).join('');
    $('#ob-table', el).innerHTML = '<h3>' + esc(T('tbl_fr')) + '</h3><p class="ob-mut ob-small">' + esc(T(S.fr_u === 'apr' ? 'tbl_fr_apr' : 'tbl_fr_8h')) + '</p><div class="ob-tblw"><table class="ob-tb ob-grid ob-frt">' + th + '<tbody>' + tb + '</tbody></table></div>' +
      '<p class="ob-frk"><i style="background:rgba(57,135,229,.5)"></i>' + esc(T('fr_neg')) + '<i style="background:rgba(247,147,26,.5)"></i>' + esc(T('fr_pos')) + '</p>' +
      (dead.length ? '<p class="ob-warn">' + esc(T('part_fail2', { ex: dead.join(', ') })) + '</p>' : '');
  };
  OB.views.funding = {
    mount: function (el) {
      frame('funding', el,
        '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' + OB.ui.seg('ob-r', FR_R.map(function (k) { return [k, T('r_' + k)]; }), rangeKey('fr_r', FR_R), 'ob-rng') + '</label>' +
        '<label class="ob-lbl"><span>' + esc(T('unit')) + '</span>' + OB.ui.seg('ob-u', [['8h', T('u_8h')], ['apr', T('u_apr')]], S.fr_u) + '</label>',
        '<div class="ob-tiles" id="ob-tiles"></div><div class="ob-tsbox"><div class="ob-ts" id="ob-ts"></div><div class="ob-status" id="ob-status"></div></div><p class="ob-note" id="ob-note"></p><div class="ob-tblbox" id="ob-table"></div>');
      el.addEventListener('click', function (e) {
        var b = e.target.closest('.ob-seg button');
        if (b) { var v = b.getAttribute('data-v');
          if (b.parentNode.id === 'ob-r' && S.fr_r !== v) { S.fr_r = v; OB.ui.setSeg(el, 'ob-r', v); save(); load(); }
          if (b.parentNode.id === 'ob-u' && S.fr_u !== v) { S.fr_u = v; OB.ui.setSeg(el, 'ob-u', v); save(); if (V.data) RENDER.funding(V.data); }
          return; }
        var s = e.target.closest('.ob-ths'); if (s) { V.frSort = s.getAttribute('data-sort'); if (V.data) RENDER.funding(V.data); return; }
        var r = e.target.closest('.ob-rowc'); if (r) { setCoin(r.getAttribute('data-c')); w.scrollTo({ top: Math.max(0, d.getElementById('ob').getBoundingClientRect().top + w.pageYOffset - 80), behavior: 'smooth' }); }
      });
      load();
    }, unmount: unmount };

  /* ================================================================ long / short */
  var LS_R = ['24h', '3d', '1w', '1m', '3m', '1y'], LS_IDS = ['gt_all', 'bn_all', 'by_all', 'bn_top_acc', 'bn_top_pos', 'gt_top_acc', 'gt_top_pos'];
  LOAD.ls = function (coin, now) {
    var R = OB.dvRange(rangeKey('ls_r', LS_R));
    return Promise.all([OB.candles(coin, R, now), OB.lsHistory(coin, R, now)]).then(function (r) { return { coin: coin, R: R, now: now, candles: r[0], ls: r[1] }; });
  };
  RENDER.ls = function (D0) {
    var el = V.el, cs = D0.candles.rows, ls = D0.ls, tiles = '', series = [];
    LS_IDS.forEach(function (id) {
      var a = ls[id]; if (!a || a.length < 2) return;
      var data = a.map(function (x) { return [x[0], x[1] * 100]; }), last = data[data.length - 1][1];
      series.push({ name: T('ls_' + id), type: 'line', color: LSC[id], data: data, width: id === 'gt_all' ? 2.2 : 1.7 });
      var g = ls.gt_last, sub = T('ls_short_is', { v: OB.ltr((100 - last).toFixed(1) + '%') });
      if (id === 'gt_all' && g) sub = T('ls_gt_n', { l: OB.ltr(Math.round(g.long).toLocaleString('en-US')), s: OB.ltr(Math.round(g.short).toLocaleString('en-US')) });
      if (id === 'gt_top_acc' && g && g.tl + g.ts > 0) sub = T('ls_gt_top_n', { l: OB.ltr(String(g.tl)), s: OB.ltr(String(g.ts)) });
      tiles += tile(T('ls_' + id), last.toFixed(1) + '%', esc(sub));
    });
    $('#ob-tiles', el).innerHTML = tiles || tile(T('tab_ls'), '—', '');
    var tk = ls.bn_taker && ls.bn_taker.length > 1 ? ls.bn_taker.map(function (x) { return [x[0], x[1] - x[2]]; }) : null;
    var exs = []; if (ls.gt_all && ls.gt_all.length > 1) exs.push('Gate'); if (ls.bn_all && ls.bn_all.length > 1) exs.push('Binance'); if (ls.by_all && ls.by_all.length > 1) exs.push('Bybit');
    V.sub = T('r_' + S.ls_r) + ' · ' + (exs.join(' + ') || '—') + ' · ' + new Date(D0.now).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    var panes = [
      { weight: 3, title: T('p_price'), fmt: function (v) { return OB.fmtP(v); }, series: [{ name: T('p_price'), type: 'candle', data: cs }] },
      { weight: 3, title: T('p_ls'), fmt: function (v) { return v.toFixed(1) + '%'; }, marks: [{ y: 50, color: 'rgba(255,255,255,.35)', label: T('mark_50') }], series: series.length ? series : [{ name: '—', type: 'line', color: INK, data: [] }] }
    ];
    if (tk) panes.push({ weight: 2, title: T('p_taker', { coin: D0.coin.base }), fmt: OB.compact, series: [{ name: T('taker_net'), type: 'bars', color: UPC, neg: DNC, data: tk }] });      /* a row's time is the start of its interval, like a candle's */
    chart({ daily: false, label: T('aria_ls', { coin: D0.coin.base }), panes: panes });
    /* an exchange that lists the coin but sent nothing is named */
    var okx = (V.coins && V.coins.ok) || {}, dead = [];
    if ((D0.coin.bn || okx.binance === false) && !(ls.bn_all && ls.bn_all.length > 1)) dead.push('Binance');
    if ((D0.coin.by || okx.bybit === false) && !(ls.by_all && ls.by_all.length > 1)) dead.push('Bybit');
    if (!(ls.gt_all && ls.gt_all.length > 1)) dead.push('Gate');
    var longR = S.ls_r === '3m' || S.ls_r === '1y';
    $('#ob-note', el).textContent = T('note_ls') + ' ' + T('note_ls_gt') + (longR ? ' ' + T('note_ls_long') : '') + (dead.length ? ' ' + T('part_fail2', { ex: dead.join(', ') }) : '');
  };
  OB.views.ls = {
    mount: function (el) {
      frame('ls', el,
        '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' + OB.ui.seg('ob-r', LS_R.map(function (k) { return [k, T('r_' + k)]; }), rangeKey('ls_r', LS_R), 'ob-rng') + '</label>',
        '<div class="ob-tiles" id="ob-tiles"></div><div class="ob-tsbox"><div class="ob-ts" id="ob-ts"></div><div class="ob-status" id="ob-status"></div></div><p class="ob-note" id="ob-note"></p>');
      el.addEventListener('click', function (e) {
        var b = e.target.closest('.ob-seg button'); if (!b) return; var v = b.getAttribute('data-v');
        if (b.parentNode.id === 'ob-r' && S.ls_r !== v) { S.ls_r = v; OB.ui.setSeg(el, 'ob-r', v); save(); load(); }
      });
      load();
    }, unmount: unmount };
  OB._dv = { V: V, S: S };
})();
