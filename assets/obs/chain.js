/* entekhab.net — the Observatory: /charts/mvrv/ · /charts/exchange-flows/ · /charts/network/ · /charts/bitcoin-cycle/.
   Data: /data/obs/chain_<asset>.json — one value a day, written by scripts/obs_chain.py from Coin Metrics' community data
   (CC BY-NC 4.0, named on the page). Every other figure is derived by assets/obs/chainmath.js, whose head is the list of
   definitions. Charts: assets/obs/ts.js. Nothing here is live: the last point is the last closed UTC day, and the page
   says which day that is. The tinted bands are conventions from past cycles, shown with how much of history sat at or
   below today's value — never a signal. */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, d = document, w = window, CM = w.OBChain;
  var DAY = 86400000, YEAR = 365.25 * DAY;
  var INK = '#e8e8e3', ACC = '#f7931a', BLUE = '#3987e5', TEAL = '#199e70', RED = '#ff5a4d', GRN = '#34d399', PUR = '#a78bfa', GOLD = '#c98500', GREY = '#8d8d86', INC = '#d95926';
  var ZHI = 'rgba(255,90,77,.11)', ZLO = 'rgba(52,211,153,.10)';
  var NZC = ['rgba(255,90,77,.13)', 'rgba(247,147,26,.11)', 'rgba(201,133,0,.10)', 'rgba(52,211,153,.10)', 'rgba(57,135,229,.13)'];

  var KINDS = {
    mvrv: { assets: ['btc', 'eth'], ms: ['mvrv', 'z', 'nupl', 'caps'] },
    flows: { assets: ['btc', 'eth'], ms: ['reserve', 'net', 'inout'] },
    /* Bitcoin only: hash rate, miner revenue, Puell, stock-to-flow. Ether has had no miners since September 2022 and burns most of its fees,
       so "issuance + fees" would not be anybody's revenue there */
    network: { assets: ['btc', 'eth'], ms: ['adr', 'tx', 'hash', 'rev', 'puell', 's2f'], btcOnly: { hash: 1, rev: 1, puell: 1, s2f: 1 } },
    cycle: { assets: ['btc'], ms: ['mayer', 'w200', 'pi', 'y2', 'gold', 'dd'] }
  };
  var RANGES = ['1y', '2y', '4y', '8y', 'all'], RYEARS = { '1y': 1, '2y': 2, '4y': 4, '8y': 8 };
  var DEF = { asset: 'btc', m_mvrv: 'mvrv', m_flows: 'reserve', m_network: 'adr', m_cycle: 'mayer', range: '4y', log: true };
  var S = (function () {
    var s = OB.store.get('ek_obs_ch', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    var q = new URLSearchParams(location.search);
    if (/^(btc|eth)$/.test(q.get('asset') || '')) o.asset = q.get('asset');
    if (RANGES.indexOf(q.get('range')) >= 0) o.range = q.get('range');
    o._m = q.get('m');
    return o;
  })();
  var save = OB.debounce(function () { var c = Object.assign({}, S); delete c._m; OB.store.set('ek_obs_ch', c); }, 300);
  var V = { kind: null, el: null, ts: null, D: null, seq: 0, loading: false, sub: '' };
  var FILES = {};

  function file(asset, force) {
    if (force || !FILES[asset]) {
      FILES[asset] = OB.getJSON('/data/obs/chain_' + asset + '.json' + (force ? '?t=' + Date.now() : ''), 45000).then(function (j) {
        if (!j || !j.cols || !j.cols.price || !(j.n > 0)) { var e = new Error('no file'); e.status = 404; throw e; }
        return CM.unpack(j);
      });
      FILES[asset].catch(function () { delete FILES[asset]; });
    }
    return FILES[asset];
  }
  OB.chainFile = file;

  /* ---------------------------------------------------------------- small pieces */
  function coin() { return S.asset.toUpperCase(); }
  function mKey() { return 'm_' + V.kind; }
  function metrics() { var K = KINDS[V.kind]; return K.ms.filter(function (m) { return S.asset === 'btc' || !(K.btcOnly && K.btcOnly[m]); }); }
  function curM() { var ms = metrics(); if (ms.indexOf(S[mKey()]) < 0) S[mKey()] = ms[0]; return S[mKey()]; }
  function tile(label, value, sub) { return '<div class="ob-tile"><small>' + esc(label) + '</small><b class="ob-n">' + value + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>'; }
  function status(html, cls) { var s = $('#ob-status', V.el); if (s) { s.innerHTML = html || ''; s.className = 'ob-status' + (cls ? ' ' + cls : ''); s.hidden = !html; } }
  function usd(v) { return v == null || !isFinite(v) ? '—' : '$' + OB.fmtP(v); }
  function fx(v, dp) { return v == null || !isFinite(v) ? '—' : v.toFixed(dp == null ? 2 : dp); }
  function sgn(v, f) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '-' : '') + f(Math.abs(v)); }
  function qty(v) { return v == null || !isFinite(v) ? '—' : OB.compact(v); }
  function pctTxt(v, dp) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(dp == null ? 1 : dp) + '%'; }
  function locPct(v) { return OB.loc(v == null ? '—' : (v >= 99.95 ? '100' : v.toFixed(v < 10 ? 1 : 0))); }
  function rankTxt(p) { return p == null ? '' : esc(T('t_rank', { p: locPct(p) })); }
  function dateTxt(iso) { return iso ? OB.fmtDate(Date.parse(iso + 'T00:00:00Z')) : '—'; }
  function zoneTxt(k, v) { var z = CM.zoneOf(k, v); return z == null ? '' : T(z > 0 ? 'z_high' : z < 0 ? 'z_low' : 'z_mid'); }
  function bandTxt(k) {
    var z = CM.ZONES[k]; if (!z || Array.isArray(z)) return '';
    return z.lo != null && z.hi != null ? T('band_lo_hi', { lo: OB.ltr(String(z.lo)), hi: OB.ltr(String(z.hi)) }) : z.hi != null ? T('band_hi', { hi: OB.ltr(String(z.hi)) }) : T('band_lo', { lo: OB.ltr(String(z.lo)) });
  }
  function zonesOf(k) { var z = CM.ZONES[k], out = []; if (z.hi != null) out.push({ y0: z.hi, y1: Infinity, color: ZHI }); if (z.lo != null) out.push({ y0: -Infinity, y1: z.lo, color: ZLO }); return out; }
  function marksOf(k) { var z = CM.ZONES[k], out = []; if (z.hi != null) out.push({ y: z.hi, color: 'rgba(255,90,77,.55)', label: String(z.hi) }); if (z.lo != null) out.push({ y: z.lo, color: 'rgba(52,211,153,.5)', label: String(z.lo) }); return out; }

  /* ---------------------------------------------------------------- panes */
  function build(D) {
    var Z = CM.series(D), m = curM(), c = coin();
    function P(a) { return CM.pairs(D, a, 0); }
    function line(name, a, color, wd) { return { name: name, type: 'line', color: color, width: wd || 1.5, data: P(a) }; }
    function price(extra, wt) { return { weight: wt || 3, log: S.log, title: T('p_price'), fmt: function (v) { return OB.fmtP(v); }, series: [line(T('p_price'), Z.price, INK, 1.6)].concat(extra || []) }; }
    function ratio(k, a, title, dp) { return { weight: 2, title: title, fmt: function (v) { return v.toFixed(dp == null ? 2 : dp); }, zones: zonesOf(k), marks: marksOf(k), series: [line(title, a, ACC, 1.6)] }; }
    var usdc = function (v) { return '$' + OB.compact(v); }, pc = function (v) { return v.toFixed(1) + '%'; };
    switch (m) {
      case 'mvrv': return [price([line(T('s_rprice'), Z.rprice, ACC)]), ratio('mvrv', Z.mvrv, T('cm_mvrv'))];
      case 'z': return [price(), ratio('mvrvz', Z.mvrvz, T('cm_z'))];
      case 'nupl': return [price(), { weight: 2, title: T('cm_nupl'), fmt: function (v) { return v.toFixed(2); },
        zones: [{ y0: -Infinity, y1: 0, color: NZC[0] }, { y0: 0, y1: 0.25, color: NZC[1] }, { y0: 0.25, y1: 0.5, color: NZC[2] }, { y0: 0.5, y1: 0.75, color: NZC[3] }, { y0: 0.75, y1: Infinity, color: NZC[4] }],
        marks: [{ y: 0, color: 'rgba(255,255,255,.35)', label: '0' }], series: [line(T('cm_nupl'), Z.nupl, ACC, 1.6)] }];
      case 'caps': return [{ weight: 3, log: S.log, title: T('cm_caps'), fmt: usdc, series: [line(T('s_mcap'), Z.mcap, INK, 1.6), line(T('s_rcap'), Z.rcap, ACC, 1.6)] }];
      case 'reserve': return [price(null, 2), { weight: 3, title: T('pt_coins', { coin: c }), fmt: OB.compact, series: [{ name: T('cm_reserve'), type: 'area', color: BLUE, width: 1.6, data: P(Z.sex) }] },
        { weight: 2, title: T('pt_share'), fmt: pc, series: [line(T('pt_share'), Z.sexshare, PUR)] }];
      case 'net': return [price(null, 2), { weight: 3, title: T('s_net', { coin: c }), fmt: OB.compact, series: [{ name: T('s_net', { coin: c }), type: 'bars', color: INC, neg: TEAL, data: P(Z.net) }] },
        { weight: 2, title: T('s_net30', { coin: c }), fmt: OB.compact, zero: true, marks: [{ y: 0, color: 'rgba(255,255,255,.3)' }], series: [line(T('s_net30', { coin: c }), Z.net30, ACC, 1.6)] }];
      case 'inout': return [price(null, 2), { weight: 3, title: T('pt_coins_day', { coin: c }), fmt: OB.compact, series: [line(T('s_fin'), Z.fin7, INC, 1.6), line(T('s_fout'), Z.fout7, TEAL, 1.6)] }];
      case 'adr': return [price(null, 2), { weight: 3, title: T('cm_adr'), fmt: OB.compact, series: [line(T('s_raw'), Z.adr, GREY, 1), line(T('s_ma7'), Z.adr7, ACC, 1.7)] }];
      case 'tx': return [price(null, 2), { weight: 3, title: T('cm_tx'), fmt: OB.compact, series: [line(T('s_tx7'), Z.tx7, ACC, 1.7), line(T('s_tfr7'), Z.tfr7, BLUE, 1.5)] }];
      case 'hash': return [price(null, 2), { weight: 3, log: S.log, title: T('pt_eh'), fmt: function (v) { return OB.compact(v); }, series: [line(T('s_raw'), Z.hash, GREY, 1), line(T('s_ma30'), Z.hash30, ACC, 1.7), line(T('s_ma60'), Z.hash60, BLUE, 1.5)] }];
      case 'rev': return [price(null, 2), { weight: 3, log: S.log, title: T('pt_usd_day'), fmt: usdc, series: [line(T('cm_rev'), Z.revusd, ACC, 1.5)] },
        { weight: 2, title: T('s_fee'), fmt: pc, min: 0, series: [line(T('s_fee'), Z.feeshare, BLUE, 1.3)] }];
      case 'puell': return [price(), ratio('puell', Z.puell, T('cm_puell'))];
      case 's2f': return [price(), { weight: 2, title: T('cm_s2f'), fmt: function (v) { return v.toFixed(0); }, series: [line(T('cm_s2f'), Z.s2f, ACC, 1.6)] }];
      case 'mayer': return [price([line(T('s_ma200'), Z.ma200, ACC)]), ratio('mayer', Z.mayer, T('cm_mayer'))];
      case 'w200': return [price([line(T('s_ma1400'), Z.ma1400, ACC)]), ratio('w200', Z.w200, T('pt_w200'))];
      case 'pi': return [price([line(T('s_ma111'), Z.ma111, ACC), line(T('s_ma350x2'), Z.ma350x2, GRN)]), ratio('pi', Z.pi, T('pt_pi'))];
      case 'y2': return [price([line(T('s_ma730'), Z.ma730, GRN), line(T('s_ma730x5'), Z.ma730x5, RED)]), ratio('y2', Z.y2, T('pt_y2'))];
      case 'gold': return [price([line(T('s_ma350'), Z.ma350, GRN), line(T('s_g16'), Z.gold16, GOLD, 1.2), line(T('s_g3'), Z.gold3, ACC, 1.2), line(T('s_g5'), Z.gold5, RED, 1.2)], 4)];
      case 'dd': return [price(null, 2), { weight: 3, title: T('cm_dd'), fmt: function (v) { return v.toFixed(0) + '%'; }, max: 0, series: [{ name: T('cm_dd'), type: 'area', color: RED, width: 1.4, data: P(Z.dd) }] }];
    }
    return [price()];
  }

  /* ---------------------------------------------------------------- tiles and tables */
  function tiles(D, s) {
    var c = coin(), h = '';
    if (V.kind === 'mvrv') {
      h += tile(T('cm_mvrv'), fx(s.mvrv), rankTxt(s.mvrv_pct));
      h += tile(T('s_rprice'), esc(usd(s.rprice)), s.rprice ? esc(T('t_vs', { p: OB.ltr(pctTxt((s.price / s.rprice - 1) * 100)) })) : '');
      h += tile(T('cm_nupl'), fx(s.nupl), s.nupl == null ? '' : esc(T('nz' + CM.nuplZone(s.nupl))));
      h += tile(T('cm_z'), fx(s.mvrvz), rankTxt(s.mvrvz_pct));
    } else if (V.kind === 'flows') {
      h += tile(T('cm_reserve'), esc(qty(s.sex) + ' ' + c), s.sex == null ? '' : esc(T('t_res_s', { usd: OB.ltr(OB.fmtUsd(s.sex_usd)), p: OB.ltr(fx(s.sex_share, 1) + '%') })));
      h += tile(T('t_chg30'), esc(sgn(s.sex_chg30, qty) + ' ' + c), s.sex_chg30 == null || !s.sex ? '' : esc(OB.ltr(pctTxt(s.sex_chg30 / (s.sex - s.sex_chg30) * 100, 2))));
      h += tile(T('t_net1'), esc(sgn(s.net1, qty) + ' ' + c), s.net1 == null ? '' : esc(T(s.net1 >= 0 ? 't_into' : 't_outof')) + ' · ' + esc(dateTxt(s.flow_date)));
      h += tile(T('t_net7'), esc(sgn(s.net7, qty) + ' ' + c), s.net30 == null ? '' : esc(T('t_net30', { v: OB.ltr(sgn(s.net30, qty)) })));
    } else if (V.kind === 'network') {
      h += tile(T('t_adr7'), esc(qty(s.adr7)), '');
      h += tile(T('t_tx7'), esc(qty(s.tx7)), '');
      if (s.hash != null) h += tile(T('cm_hash'), esc(fx(s.hash, 1) + ' EH/s'), s.hash30 == null || s.hash60 == null ? '' : esc(T(s.hash30 >= s.hash60 ? 't_rib_up' : 't_rib_dn')));
      if (S.asset === 'btc') h += tile(T('cm_rev'), esc(OB.fmtUsd(s.rev_usd)), s.fee_share == null ? '' : esc(T('t_fee', { p: OB.ltr(fx(s.fee_share, 1) + '%') })));
      if (s.puell != null && S.asset === 'btc') h += tile(T('cm_puell'), fx(s.puell), rankTxt(s.puell_pct));
    } else {
      h += tile(T('p_price'), esc(usd(s.price)), esc(dateTxt(s.date)));
      h += tile(T('cm_mayer'), fx(s.mayer), rankTxt(s.mayer_pct));
      h += tile(T('pt_w200'), fx(s.w200), s.ma1400 == null ? '' : esc(T('t_avg', { v: OB.ltr(usd(s.ma1400)) })));
      h += tile(T('cm_dd'), esc(s.dd == null ? '—' : pctTxt(s.dd)), rankTxt(s.dd_pct));
    }
    $('#ob-tiles', V.el).innerHTML = h;
  }
  function cycleTable(s) {
    var rows = [['mayer', 'cm_mayer', s.mayer, s.mayer_pct, 2], ['w200', 'pt_w200', s.w200, s.w200_pct, 2], ['pi', 'pt_pi', s.pi, s.pi_pct, 2], ['y2', 'pt_y2', s.y2, s.y2_pct, 2],
      ['mvrv', 'cm_mvrv', s.mvrv, s.mvrv_pct, 2], ['mvrvz', 'cm_z', s.mvrvz, s.mvrvz_pct, 2], ['puell', 'cm_puell', s.puell, s.puell_pct, 2]];
    var body = rows.filter(function (r) { return r[2] != null; }).map(function (r) {
      var z = CM.zoneOf(r[0], r[2]);
      return '<tr><td>' + esc(T(r[1])) + '</td><td class="ob-n">' + fx(r[2], r[4]) + '</td><td>' + esc(bandTxt(r[0])) + '</td><td' + (z > 0 ? ' class="dn"' : z < 0 ? ' class="up"' : '') + '>' + esc(zoneTxt(r[0], r[2])) +
        '</td><td class="ob-barc"><span class="ob-bar"><i style="width:' + (r[3] == null ? 0 : r[3]).toFixed(1) + '%;background:' + ACC + '"></i></span><span class="ob-n">' + (r[3] == null ? '—' : r[3].toFixed(r[3] < 10 ? 1 : 0) + '%') + '</span></td></tr>';
    }).join('');
    if (s.nupl != null) body += '<tr><td>' + esc(T('cm_nupl')) + '</td><td class="ob-n">' + fx(s.nupl) + '</td><td>—</td><td>' + esc(T('nz' + CM.nuplZone(s.nupl))) + '</td><td class="ob-barc">—</td></tr>';
    if (s.dd != null) body += '<tr><td>' + esc(T('cm_dd')) + '</td><td class="ob-n">' + esc(pctTxt(s.dd)) + '</td><td>—</td><td>—</td><td class="ob-barc"><span class="ob-bar"><i style="width:' + (s.dd_pct || 0).toFixed(1) + '%;background:' + ACC +
      '"></i></span><span class="ob-n">' + (s.dd_pct == null ? '—' : s.dd_pct.toFixed(s.dd_pct < 10 ? 1 : 0) + '%') + '</span></td></tr>';
    return '<h3>' + esc(T('tbl_cycle', { d: dateTxt(s.date) })) + '</h3><p class="ob-note ob-small">' + esc(T('tbl_cycle_n')) + '</p><div class="ob-tblw"><table class="ob-grid" id="ob-ctbl"><thead><tr><th>' + esc(T('th_ind')) + '</th><th>' +
      esc(T('th_now')) + '</th><th>' + esc(T('th_band')) + '</th><th>' + esc(T('th_state')) + '</th><th>' + esc(T('th_rank')) + '</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }
  function flowsTable(D) {
    var c = D.cols, n = D.n, j = Math.min(CM.last(c.fin), CM.last(c.fout), CM.last(c.sex)), rows = '';
    if (j < 0) return '';
    for (var i = j; i > j - 14 && i >= 0; i--) {
      if (c.fin[i] == null || c.fout[i] == null) continue;
      var net = c.fin[i] - c.fout[i];
      rows += '<tr><td>' + esc(dateTxt(CM.dayStr(D.t0, i))) + '</td><td class="ob-n">' + esc(qty(c.fin[i])) + '</td><td class="ob-n">' + esc(qty(c.fout[i])) + '</td><td class="ob-n" style="color:' + (net >= 0 ? INC : TEAL) + '">' +
        esc(sgn(net, qty)) + '</td><td class="ob-n">' + esc(c.sex[i] == null ? '—' : Math.round(c.sex[i]).toLocaleString('en-US')) + '</td></tr>';
    }
    return '<h3>' + esc(T('tbl_flows', { coin: coin() })) + '</h3><div class="ob-tblw"><table class="ob-grid" id="ob-ftbl"><thead><tr><th>' + esc(T('th_date')) + '</th><th>' + esc(T('th_in')) + '</th><th>' + esc(T('th_out')) +
      '</th><th>' + esc(T('th_net')) + '</th><th>' + esc(T('th_res')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------------------------------------------------------------- render */
  function render() {
    var D = V.D; if (!D || !V.ts) return;
    var s = V.sum = CM.summary(D), m = curM(), i = CM.last(D.cols.price), tEnd = D.t0 + i * DAY;
    tiles(D, s);
    var yrs = RYEARS[S.range], f0 = 0;
    while (f0 < D.n && D.cols.price[f0] == null) f0++;                               /* "all" begins with the first day that has a price */
    var t0 = yrs ? Math.max(D.t0 + f0 * DAY, tEnd - yrs * YEAR) : D.t0 + f0 * DAY, span = tEnd - t0;
    V.sub = T('cr_' + S.range) + ' · Coin Metrics · ' + (s.date || '');
    V.ts.set({ daily: true, label: T('aria_chain', { m: T('cm_' + m), coin: coin() }), view: [t0, tEnd + span * 0.02], panes: build(D) });
    var tb = $('#ob-tbl', V.el), html = V.kind === 'cycle' ? cycleTable(s) : V.kind === 'flows' ? flowsTable(D) : '';
    tb.innerHTML = html; tb.hidden = !html;
    $('#ob-note', V.el).textContent = T('note_' + V.kind) + ' ' + T('src_cm', { d: dateTxt(s.date) });
    OB.ui.setSeg(V.el, 'ob-m', m); var sel = $('#ob-msel', V.el); if (sel) sel.value = m;
  }
  function load(force) {
    var seq = ++V.seq; V.loading = true;
    status('<span class="ob-spin"></span>' + esc(T('loading3')));
    file(S.asset, force).then(function (D) {
      if (seq !== V.seq) return;
      V.D = D; V.loading = false; status(''); render();
    }, function (e) {
      if (seq !== V.seq) return;
      V.loading = false; if (w.console) console.warn(e);
      status('<b>' + esc(T(e && e.status === 404 ? 'no_file' : 'err_file')) + '</b><br><span>' + esc(T(e && e.status === 404 ? 'no_file_d' : 'err_file_d')) + '</span><br><button type="button" class="ob-btn" id="ob-retry">' + esc(T('retry')) + '</button>', 'err');
    });
  }
  function measureCtl() {
    var ms = metrics(), cur = curM();
    return '<label class="ob-lbl ob-wide"><span>' + esc(T('measure')) + '</span>' + OB.ui.seg('ob-m', ms.map(function (k) { return [k, T('cm_' + k)]; }), cur, 'ob-rng') + '</label>' +
      '<label class="ob-lbl ob-narrow"><span>' + esc(T('measure')) + '</span><select class="ob-sel" id="ob-msel">' + ms.map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(T('cm_' + k)) + '</option>'; }).join('') + '</select></label>';
  }
  function mount(kind, el) {
    V.kind = kind; V.el = el; V.D = null;
    var K = KINDS[kind];
    if (K.assets.indexOf(S.asset) < 0) S.asset = K.assets[0];
    if (S._m && K.ms.indexOf(S._m) >= 0) { S[mKey()] = S._m; } S._m = null;
    el.innerHTML = '<div class="ob-tools">' +
      (K.assets.length > 1 ? '<label class="ob-lbl"><span>' + esc(T('asset')) + '</span>' + OB.ui.seg('ob-as', K.assets.map(function (a) { return [a, a.toUpperCase()]; }), S.asset, 'ob-num') + '</label>' : '') +
      '<span id="ob-mwrap" style="display:contents">' + measureCtl() + '</span>' +
      '<button type="button" class="ob-ib ob-gear" id="ob-gear" aria-expanded="false" aria-controls="ob-more" aria-label="' + esc(T('more')) + '" title="' + esc(T('more')) + '">' + OB.icon('gear') + '</button>' +
      '<div class="ob-more" id="ob-more"><label class="ob-lbl"><span>' + esc(T('range')) + '</span>' + OB.ui.seg('ob-r', RANGES.map(function (k) { return [k, T('cr_' + k)]; }), S.range, 'ob-rng') + '</label>' +
      '<label class="ob-lbl"><span>' + esc(T('scale')) + '</span>' + OB.ui.seg('ob-sc', [['log', T('sc_log')], ['lin', T('sc_lin')]], S.log ? 'log' : 'lin') + '</label></div>' +
      OB.ui.acts() + '</div><div class="ob-tiles" id="ob-tiles"></div><div class="ob-tsbox"><div class="ob-ts" id="ob-ts"></div><div class="ob-status" id="ob-status"></div></div>' +
      '<div class="ob-tblbox" id="ob-tbl" hidden></div><p class="ob-note" id="ob-note"></p>';
    V.ts = new OB.TS($('#ob-ts', el));
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      var seg = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null, v = b.getAttribute('data-v');
      if (seg === 'ob-as' && v !== S.asset) { S.asset = v; OB.ui.setSeg(el, 'ob-as', v); $('#ob-mwrap', el).innerHTML = measureCtl(); save(); load(); }
      else if (seg === 'ob-m' && v !== S[mKey()]) { S[mKey()] = v; save(); render(); }
      else if (seg === 'ob-r' && v !== S.range) { S.range = v; OB.ui.setSeg(el, 'ob-r', v); save(); render(); }
      else if (seg === 'ob-sc') { S.log = v === 'log'; OB.ui.setSeg(el, 'ob-sc', v); save(); render(); }
      else if (b.id === 'ob-gear') { var op = !$('.ob-tools', el).classList.contains('open'); $('.ob-tools', el).classList.toggle('open', op); b.setAttribute('aria-expanded', op ? 'true' : 'false'); if (V.ts) V.ts.onResize(); }
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') load(true);
      else if (b.id === 'ob-full') OB.fullscreen(d.getElementById('ob'));
      else if (b.id === 'ob-png') { if (V.ts && V.D) V.ts.png(coin() + ' · ' + T('cm_' + curM()), V.sub, 'entekhab-' + curM() + '-' + coin() + '.png'); }
      else if (b.id === 'ob-share') OB.ui.share({ asset: S.asset, m: curM(), range: S.range });
    };
    el.onchange = function (e) { if (e.target.id === 'ob-msel' && e.target.value !== S[mKey()]) { S[mKey()] = e.target.value; save(); render(); } };
    load();
  }
  function unmount() { V.seq++; if (V.ts) V.ts.destroy(); V.ts = null; V.D = null; }
  Object.keys(KINDS).forEach(function (k) { OB.views[k] = { mount: function (el) { mount(k, el); }, unmount: unmount }; });
  OB._ch = { V: V, S: S, KINDS: KINDS };
})();
