/* entekhab.net — the Observatory: the extra on-chain pages.
     /charts/thermocap/  /charts/price-models/  /charts/capital-flow/  /charts/hashprice/  /charts/eth-supply/
     /charts/network-value/  /charts/onchain-score/  /charts/cycle-compass/  /charts/capital-rotation/  /charts/decentralization/
   Data: files the site already collects (see the head of assets/obs/xchainmath.js, where every measure is defined in one
   line). Charts: assets/obs/ts.js; the compass is drawn here on its own canvas. Nothing here is live: the last point is
   the last closed UTC day, and the page says which day. Bands and zones are conventions or past behaviour, shown with how
   much of history sat at or below today — never a signal. Every string comes from assets/obs/i18n.js; every number put
   into markup goes through OB.esc. */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, d = document, w = window, CM = w.OBChain, X = w.OBX;
  var DAY = 86400000, YEAR = 365.25 * DAY;
  var INK = '#e8e8e3', ACC = '#f7931a', BLUE = '#3987e5', TEAL = '#199e70', RED = '#ff5a4d', GRN = '#34d399', PUR = '#a78bfa', GOLD = '#c98500', GREY = '#8d8d86', INC = '#d95926', PINK = '#f472b6';
  var BANDC = ['#3987e5', '#199e70', '#c98500', '#f7931a', '#ff5a4d'];
  var BANDZ = ['rgba(57,135,229,.12)', 'rgba(25,158,112,.10)', 'rgba(201,133,0,.09)', 'rgba(247,147,26,.10)', 'rgba(255,90,77,.13)'];
  var ASSET_C = { btc: ACC, eth: '#8c8cf7', ltc: '#a6a9aa', bch: GRN, doge: GOLD, ada: BLUE, xrp: INK };
  var ALL7 = ['btc', 'eth', 'ltc', 'bch', 'doge', 'ada', 'xrp'];

  /* view key → its chains, its measures and what it reads */
  var KINDS = {
    thermo: { assets: ['btc', 'ltc', 'bch', 'doge', 'eth'], ms: ['tmult', 'rtc', 'tcap'] },
    models: { assets: ALL7, ms: ['bands', 'chpos'] },
    capflow: { assets: ALL7, ms: ['flow30', 'flow90', 'pct'] },
    hashp: { assets: ['btc'], ms: ['hpusd', 'hpsat'] },
    ethsup: { assets: ['eth'], ms: ['merge', 'infl', 'burn'] },
    nvm: { assets: ALL7, ms: ['nvm', 'nvmz'] },
    score: { assets: ALL7, ms: ['score', 'parts'] },
    compass: { assets: ['btc', 'eth', 'ltc'], ms: [] },
    rotation: { assets: [], ms: ['real', 'market'], file: 'rot' },
    pools: { assets: [], ms: [], file: 'pools' }
  };
  var RANGES = ['1y', '2y', '4y', '8y', 'all'], RYEARS = { '1y': 1, '2y': 2, '4y': 4, '8y': 8 };
  var DEF = { asset: 'btc', range: '4y', log: true, m_thermo: 'tmult', m_models: 'bands', m_capflow: 'flow30', m_hashp: 'hpusd', m_ethsup: 'merge', m_nvm: 'nvm', m_score: 'score', m_rotation: 'real' };
  var S = (function () {
    var s = OB.store.get('ek_obs_xch', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    if (ALL7.indexOf(o.asset) < 0) o.asset = 'btc';
    if (RANGES.indexOf(o.range) < 0) o.range = '4y';
    var q = new URLSearchParams(location.search);
    if (ALL7.indexOf(q.get('asset') || '') >= 0) o.asset = q.get('asset');        /* only values from the fixed lists are taken from the address */
    if (RANGES.indexOf(q.get('range')) >= 0) o.range = q.get('range');
    o._m = /^[a-z0-9]{1,12}$/.test(q.get('m') || '') ? q.get('m') : null;
    return o;
  })();
  var save = OB.debounce(function () { var c = Object.assign({}, S); delete c._m; OB.store.set('ek_obs_xch', c); }, 300);
  var V = { kind: null, el: null, ts: null, D: null, seq: 0, sub: '', cv: null, off: null };
  var FILES = {};

  function chain(asset, force) {
    if (OB.chainFile) return OB.chainFile(asset, force);                       /* chain.js shares its cache when it is on the page */
    if (force || !FILES[asset]) {
      FILES[asset] = OB.getJSON('/data/obs/chain_' + asset + '.json' + (force ? '?t=' + Date.now() : ''), 45000).then(function (j) {
        if (!j || !j.cols || !j.cols.price || !(j.n > 0)) { var e = new Error('no file'); e.status = 404; throw e; }
        return CM.unpack(j);
      });
      FILES[asset].catch(function () { delete FILES[asset]; });
    }
    return FILES[asset];
  }
  function other(name, force) {
    var url = name === 'rot' ? '/data/obs/xchain_rot.json' : '/data/btcinfo.json';
    var k = '_' + name;
    if (force || !FILES[k]) {
      FILES[k] = (name === 'pools' ? Promise.all([OB.getJSON(url + (force ? '?t=' + Date.now() : ''), 30000), OB.getJSON('/data/obs/xchain_now.json' + (force ? '?t=' + Date.now() : ''), 30000).catch(function () { return null; })])
        .then(function (r) { if (!r[0] || !r[0].pools) { var e = new Error('no file'); e.status = 404; throw e; } return { info: r[0], now: r[1] }; })
        : OB.getJSON(url + (force ? '?t=' + Date.now() : ''), 45000).then(function (j) { if (!j || !j.t || !j.t.length) { var e = new Error('no file'); e.status = 404; throw e; } return j; }));
      FILES[k].catch(function () { delete FILES[k]; });
    }
    return FILES[k];
  }

  /* ---------------------------------------------------------------- small pieces */
  function coin() { return S.asset.toUpperCase(); }
  function mKey() { return 'm_' + V.kind; }
  function curM() { var ms = KINDS[V.kind].ms; if (!ms.length) return ''; if (ms.indexOf(S[mKey()]) < 0) S[mKey()] = ms[0]; return S[mKey()]; }
  function tile(label, value, sub) { return '<div class="ob-tile"><small>' + esc(label) + '</small><b class="ob-n">' + value + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>'; }
  function status(html, cls) { var s = $('#ob-status', V.el); if (s) { s.innerHTML = html || ''; s.className = 'ob-status' + (cls ? ' ' + cls : ''); s.hidden = !html; } }
  function ok(v) { return v != null && isFinite(v); }
  function usd(v) { return ok(v) ? '$' + OB.fmtP(v) : '—'; }
  function fx(v, dp) { return ok(v) ? v.toFixed(dp == null ? 2 : dp) : '—'; }
  function pctTxt(v, dp) { return ok(v) ? (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(dp == null ? 1 : dp) + '%' : '—'; }
  function sgnUsd(v) { return ok(v) ? (v > 0 ? '+' : v < 0 ? '-' : '') + OB.fmtUsd(Math.abs(v)) : '—'; }
  function qty(v) { return ok(v) ? OB.compact(v) : '—'; }
  function locPct(v) { return OB.loc(v == null ? '—' : (v >= 99.95 ? '100' : v.toFixed(v < 10 ? 1 : 0))); }
  function rankTxt(p) { return p == null ? '' : esc(T('t_rank', { p: locPct(p) })); }
  function dateTxt(iso) { return iso ? OB.fmtDate(Date.parse(iso + 'T00:00:00Z')) : '—'; }
  function logoSeg(assets) { return assets.map(function (a) { var A = a.toUpperCase(); return [a, (OB.hasLogo(A) === false ? '' : OB.logo(A, 16)) + '<span>' + esc(A) + '</span>']; }); }
  function line(D, name, a, color, wd) { return { name: name, type: 'line', color: color, width: wd || 1.5, data: CM.pairs(D, a, 0) }; }
  function bandOf(v) { return X.band(v); }

  /* ---------------------------------------------------------------- panes of the time-series views */
  function build(D) {
    var Z = X.xseries(D), m = curM(), c = coin();
    function L(name, a, color, wd) { return line(D, name, a, color, wd); }
    function price(extra, wt) { return { weight: wt || 3, log: S.log, title: T('p_price'), fmt: function (v) { return OB.fmtP(v); }, series: [L(T('p_price'), Z.price, INK, 1.6)].concat(extra || []) }; }
    var usdc = function (v) { return '$' + OB.compact(v); }, pc = function (v) { return v.toFixed(1) + '%'; };
    switch (V.kind + ':' + m) {
      case 'thermo:tmult': return [price(), { weight: 2, log: true, title: T('x_tmult'), fmt: function (v) { return v.toFixed(1); }, series: [L(T('x_tmult'), Z.tmult, ACC, 1.6)] }];
      case 'thermo:rtc': return [price(), { weight: 2, log: true, title: T('x_rtc'), fmt: function (v) { return v.toFixed(1); }, series: [L(T('x_rtc'), Z.rtc, PUR, 1.6)] }];
      case 'thermo:tcap': return [{ weight: 3, log: S.log, title: T('x_caps'), fmt: usdc, series: [L(T('s_mcap'), Z.mcap, INK, 1.6), L(T('s_rcap'), Z.rcap, ACC, 1.5), L(T('x_thermo'), Z.thermo, TEAL, 1.6)] }];
      case 'models:bands': return [price([L(T('x_top'), Z.topprice, RED, 1.3), L(T('s_rprice'), Z.rprice, ACC, 1.4), L(T('x_avg'), Z.avgprice, BLUE, 1.3), L(T('x_delta'), Z.deltaprice, GRN, 1.4)], 4)];
      case 'models:chpos': return [price(null, 2), { weight: 3, title: T('x_chpos'), fmt: function (v) { return v.toFixed(0) + '%'; },
        zones: [{ y0: -Infinity, y1: 0, color: BANDZ[0] }, { y0: 80, y1: Infinity, color: BANDZ[4] }], marks: [{ y: 0, color: 'rgba(52,211,153,.5)', label: '0' }, { y: 100, color: 'rgba(255,90,77,.55)', label: '100' }],
        series: [L(T('x_chpos'), Z.chpos, ACC, 1.6)] }];
      case 'capflow:flow30': return [price(null, 2), { weight: 3, title: T('x_flow30'), fmt: usdc, zero: true, marks: [{ y: 0, color: 'rgba(255,255,255,.3)' }],
        series: [{ name: T('x_flow30'), type: 'bars', color: TEAL, neg: RED, data: CM.pairs(D, Z.rflow30, 0) }] }];
      case 'capflow:flow90': return [price(null, 2), { weight: 3, title: T('x_flow90'), fmt: usdc, zero: true, marks: [{ y: 0, color: 'rgba(255,255,255,.3)' }],
        series: [{ name: T('x_flow90'), type: 'bars', color: TEAL, neg: RED, data: CM.pairs(D, Z.rflow90, 0) }] }];
      case 'capflow:pct': return [price(null, 2), { weight: 3, title: T('x_pct'), fmt: pc, zero: true, marks: [{ y: 0, color: 'rgba(255,255,255,.3)' }],
        series: [L(T('x_pct30'), Z.rpct30, ACC, 1.4), L(T('x_pct90'), Z.rpct90, BLUE, 1.6)] }];
      case 'hashp:hpusd': return [price(null, 2), { weight: 3, log: S.log, title: T('x_hpusd'), fmt: function (v) { return '$' + OB.compact(v); }, series: [L(T('s_raw'), Z.hpusd, GREY, 1), L(T('s_ma30'), Z.hpusd30, ACC, 1.7)] }];
      case 'hashp:hpsat': return [price(null, 2), { weight: 3, log: S.log, title: T('x_hpsat'), fmt: function (v) { return OB.compact(v); }, series: [L(T('x_hpsat'), Z.hpsat, GOLD, 1.5)] }];
      case 'ethsup:merge': return [price(null, 2), { weight: 3, title: T('x_since'), fmt: function (v) { return OB.compact(v); }, zero: true, marks: [{ y: 0, color: 'rgba(255,255,255,.35)', label: '0' }],
        series: [{ name: T('x_since'), type: 'area', color: PUR, width: 1.6, data: CM.pairs(D, Z.sincemerge, 0) }] }];
      case 'ethsup:infl': return [price(null, 2), { weight: 3, title: T('x_infl'), fmt: function (v) { return v.toFixed(2) + '%'; }, zero: true, marks: [{ y: 0, color: 'rgba(255,255,255,.35)', label: '0' }],
        series: [L(T('x_infl365'), Z.infl365, ACC, 1.7), L(T('x_infl90'), Z.infl90, BLUE, 1.3), L(T('x_israte'), Z.israte365, GREY, 1.2)] }];
      case 'ethsup:burn': return [price(null, 2), { weight: 3, log: S.log, title: T('x_burnp'), fmt: function (v) { return OB.compact(v); }, series: [L(T('x_iss365'), Z.iss365, TEAL, 1.5), L(T('x_burn365'), Z.burn365, RED, 1.7)] }];
      case 'nvm:nvm': return [price(), { weight: 2, log: true, title: T('x_nvm'), fmt: function (v) { return v.toFixed(2); }, marks: [{ y: 1, color: 'rgba(255,255,255,.35)', label: '1' }], series: [L(T('x_nvm'), Z.nvm, ACC, 1.6)] }];
      case 'nvm:nvmz': return [price(), { weight: 2, title: T('x_nvmz'), fmt: function (v) { return v.toFixed(1); }, zones: [{ y0: 2, y1: Infinity, color: BANDZ[4] }, { y0: -Infinity, y1: -2, color: BANDZ[0] }],
        marks: [{ y: 0, color: 'rgba(255,255,255,.3)', label: '0' }], series: [L(T('x_nvmz'), Z.nvmz, ACC, 1.6)] }];
      case 'score:score': {
        var sc = [], cl = [];
        for (var i = 0; i < D.n; i++) if (Z.score[i] != null) { sc.push([D.t0 + i * DAY, Z.score[i]]); cl.push(BANDC[bandOf(Z.score[i])]); }
        return [price(null, 3), { weight: 3, title: T('x_score'), fmt: function (v) { return v.toFixed(0); }, min: 0, max: 100,
          zones: [0, 1, 2, 3, 4].map(function (b) { return { y0: X.BANDS[b], y1: b === 4 ? Infinity : X.BANDS[b + 1], color: BANDZ[b] }; }),
          series: [{ name: T('x_score'), type: 'line', color: ACC, width: 1.8, data: sc, colors: cl }] }];
      }
      case 'score:parts': {
        var col = { mvrvz: ACC, puell: TEAL, mayer: BLUE, w200: PUR, y2: GOLD, tmult: PINK };
        return [price(null, 2), { weight: 4, title: T('x_parts'), fmt: function (v) { return v.toFixed(0); }, min: 0, max: 100,
          series: X.SCORE_KEYS.map(function (k) { return L(T('xp_' + k), Z.pct[k], col[k], 1.2); }) }];
      }
    }
    return [price()];
  }

  /* ---------------------------------------------------------------- tiles */
  function tiles(D, s) {
    var c = coin(), h = '', k = V.kind;
    if (k === 'thermo') {
      h += tile(T('x_tmult'), fx(s.tmult, 1), rankTxt(s.tmult_pct));
      h += tile(T('x_thermo'), esc(OB.fmtUsd(s.thermo)), esc(dateTxt(s.thermo_date)));
      h += tile(T('x_rtc'), fx(s.rtc, 1), '');
      h += tile(T('p_price'), esc(usd(s.price)), esc(dateTxt(s.date)));
    } else if (k === 'models') {
      h += tile(T('x_delta'), esc(usd(s.deltaprice)), s.deltaprice ? esc(T('t_vs', { p: OB.ltr(pctTxt((s.price / s.deltaprice - 1) * 100)) })) : '');
      h += tile(T('s_rprice'), esc(usd(s.rprice)), s.rprice ? esc(T('t_vs', { p: OB.ltr(pctTxt((s.price / s.rprice - 1) * 100)) })) : '');
      h += tile(T('x_top'), esc(usd(s.topprice)), s.topprice ? esc(T('t_vs', { p: OB.ltr(pctTxt((s.price / s.topprice - 1) * 100)) })) : '');
      h += tile(T('x_chpos'), esc(s.chpos == null ? '—' : OB.ltr(s.chpos.toFixed(0) + '%')), esc(dateTxt(s.val_date)));
    } else if (k === 'capflow') {
      h += tile(T('x_flow30'), esc(sgnUsd(s.rflow30)), esc(OB.ltr(pctTxt(s.rpct30, 2))));
      h += tile(T('x_flow90'), esc(sgnUsd(s.rflow90)), esc(OB.ltr(pctTxt(s.rpct90, 2))));
      h += tile(T('s_rcap'), esc(OB.fmtUsd(s.rcap)), esc(dateTxt(s.val_date)));
      h += tile(T('x_dir'), esc(T(s.rflow30 == null ? 'x_none' : s.rflow30 >= 0 ? 'x_in' : 'x_out')), '');
    } else if (k === 'hashp') {
      h += tile(T('x_hpusd'), esc(s.hpusd == null ? '—' : '$' + s.hpusd.toFixed(1)), rankTxt(s.hpusd_pct));
      h += tile(T('s_ma30'), esc(s.hpusd30 == null ? '—' : '$' + s.hpusd30.toFixed(1)), esc(dateTxt(s.hp_date)));
      h += tile(T('x_hpsat'), esc(fx(s.hpsat, 1)), '');
      h += tile(T('p_price'), esc(usd(s.price)), esc(dateTxt(s.date)));
    } else if (k === 'ethsup') {
      h += tile(T('x_sply'), esc(qty(s.sply) + ' ETH'), esc(dateTxt(s.eth_date)));
      h += tile(T('x_since'), esc((s.sincemerge > 0 ? '+' : '') + qty(s.sincemerge) + ' ETH'), '');
      h += tile(T('x_infl365'), esc(OB.ltr(pctTxt(s.infl365, 2))), esc(T('x_israte_s', { p: OB.ltr(fx(s.israte365, 2) + '%') })));
      h += tile(T('x_burn365'), esc(qty(s.burn365) + ' ETH'), s.iss365 ? esc(T('x_burn_s', { p: OB.ltr(fx(s.burn365 / s.iss365 * 100, 1) + '%') })) : '');
    } else if (k === 'nvm') {
      h += tile(T('x_nvm'), fx(s.nvm), rankTxt(s.nvm_pct));
      h += tile(T('x_nvmz'), esc(s.nvmz == null ? '—' : OB.ltr((s.nvmz > 0 ? '+' : '') + s.nvmz.toFixed(2))), esc(dateTxt(s.nvm_date)));
      h += tile(T('p_price'), esc(usd(s.price)), esc(dateTxt(s.date)));
    } else if (k === 'score' || k === 'compass') {
      var b = s.score_band;
      h += '<div class="ob-tile x-temp" style="--x-c:' + (b == null ? GREY : BANDC[b]) + '"><small>' + esc(T('x_score')) + '</small><b class="ob-n">' + esc(s.score == null ? '—' : s.score.toFixed(0)) +
        '<i>/100</i></b><span>' + esc(b == null ? '' : T('xb_' + b)) + '</span><div class="x-meter" aria-hidden="true"><i style="inset-inline-start:' + (s.score == null ? 0 : s.score).toFixed(1) + '%"></i></div></div>';
      h += tile(T('x_score30'), esc(s.score30 == null ? '—' : s.score30.toFixed(0)), s.score30 == null || s.score == null ? '' : esc(OB.ltr((s.score - s.score30 >= 0 ? '+' : '') + (s.score - s.score30).toFixed(1))));
      h += tile(k === 'compass' ? T('x_pct90') : T('p_price'), esc(k === 'compass' ? OB.ltr(pctTxt(s.rpct90, 1)) : usd(s.price)), esc(dateTxt(s.score_date)));
    }
    $('#ob-tiles', V.el).innerHTML = h;
  }

  /* ---------------------------------------------------------------- tables */
  function scoreTable(D, s) {
    if (!s.parts) return '';
    var rows = X.SCORE_KEYS.filter(function (k) { return s.parts[k] != null; }).map(function (k) {
      var p = s.parts[k];
      return '<tr><td>' + esc(T('xp_' + k)) + '</td><td class="ob-barc"><span class="ob-bar"><i style="width:' + p.toFixed(1) + '%;background:' + BANDC[bandOf(p)] + '"></i></span><span class="ob-n">' + esc(p >= 99.95 ? '100' : p.toFixed(p < 10 ? 1 : 0)) + '%</span></td></tr>';
    }).join('');
    var bt = X.backtest(D, 365).map(function (r) {
      return '<tr><td><span class="x-dot" style="background:' + BANDC[r.band] + '"></span>' + esc(T('xb_' + r.band)) + ' <small class="ob-n">' + esc(OB.ltr(X.BANDS[r.band] + '–' + Math.round(X.BANDS[r.band + 1]))) + '</small></td>' +
        '<td class="ob-n">' + esc(r.n ? String(r.n) : '—') + '</td><td class="ob-n" style="color:' + (r.median == null ? INK : r.median >= 0 ? GRN : RED) + '">' + esc(OB.ltr(pctTxt(r.median, 0))) + '</td><td class="ob-n">' + esc(r.up == null ? '—' : r.up.toFixed(0) + '%') + '</td></tr>';
    }).join('');
    return '<div class="x-two"><div><h3>' + esc(T('x_tbl_parts', { d: dateTxt(s.score_date) })) + '</h3><p class="ob-note ob-small">' + esc(T('x_tbl_parts_n')) + '</p><div class="ob-tblw"><table class="ob-grid" id="x-ptbl"><thead><tr><th>' + esc(T('th_ind')) +
      '</th><th>' + esc(T('th_rank')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div><h3>' + esc(T('x_tbl_bt', { coin: coin() })) + '</h3><p class="ob-note ob-small">' + esc(T('x_tbl_bt_n')) + '</p><div class="ob-tblw"><table class="ob-grid" id="x-btbl"><thead><tr><th>' + esc(T('x_th_band')) + '</th><th>' + esc(T('x_th_days')) +
      '</th><th>' + esc(T('x_th_med')) + '</th><th>' + esc(T('x_th_up')) + '</th></tr></thead><tbody>' + bt + '</tbody></table></div></div></div>';
  }

  /* ---------------------------------------------------------------- the compass (its own canvas) */
  var EPOCHS = [['2012-11-28', '#3987e5'], ['2016-07-09', '#34d399'], ['2020-05-11', '#a78bfa'], ['2024-04-20', '#f7931a']];
  function compassData(D) {
    var Z = X.xseries(D), pts = [];
    for (var i = 0; i < D.n; i++) if (Z.score[i] != null && Z.rpct90[i] != null) pts.push({ i: i, t: D.t0 + i * DAY, x: Z.score[i], y: Z.rpct90[i] });
    return pts;
  }
  function epochOf(t) { var e = -1; for (var k = 0; k < EPOCHS.length; k++) if (t >= Date.parse(EPOCHS[k][0] + 'T00:00:00Z')) e = k; return e; }
  function drawCompass() {
    var cv = V.cv, D = V.D; if (!cv || !D) return;
    var box = cv.parentNode, W = box.clientWidth || 600, H = Math.max(320, Math.min(620, Math.round(W * 0.62))), r = w.devicePixelRatio || 1;
    /* the canvas is resized only when its box changed: a hover just repaints */
    if (cv.width !== Math.round(W * r) || cv.height !== Math.round(H * r)) { cv.width = Math.round(W * r); cv.height = Math.round(H * r); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    var g = cv.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, W, H); if ('direction' in g) g.direction = 'inherit';
    var pts = V.pts || (V.pts = compassData(D)); if (!pts.length) return;
    var ys = pts.map(function (p) { return p.y; }).sort(function (a, b) { return a - b; });
    /* the 90-day change ran to several hundred percent in the early years, so the axis is asinh-scaled:
       close to linear near zero, squeezed far out, and every year stays readable */
    var lo = Math.min(-10, ys[Math.floor(ys.length * 0.005)]), hi = Math.max(10, ys[Math.min(ys.length - 1, Math.floor(ys.length * 0.995))]);
    function f(y) { return Math.asinh(y / 10); }
    var flo = f(lo), fhi = f(hi);
    var rtl = OB.rtl(), padL = 56, padR = 14, padT = 14, padB = 34, pw = W - padL - padR, ph = H - padT - padB;
    function sx(x) { var u = x / 100; return padL + (rtl ? 1 - u : u) * pw; }
    function sy(y) { y = Math.max(lo, Math.min(hi, y)); return padT + (1 - (f(y) - flo) / (fhi - flo)) * ph; }
    V.map = { sx: sx, sy: sy, lo: lo, hi: hi, padL: padL, padT: padT, pw: pw, ph: ph, rtl: rtl };
    /* four quarters: cold or hot, capital arriving or leaving */
    var x50 = sx(50), y0 = sy(0), F = '11px "Space Grotesk", system-ui, sans-serif';
    [[0, 50, 0, hi, 'rgba(25,158,112,.07)', 'x_q_acc'], [50, 100, 0, hi, 'rgba(247,147,26,.08)', 'x_q_heat'], [50, 100, lo, 0, 'rgba(255,90,77,.08)', 'x_q_dist'], [0, 50, lo, 0, 'rgba(57,135,229,.08)', 'x_q_cap']].forEach(function (q) {
      var xa = sx(q[0]), xb = sx(q[1]), ya = sy(q[3]), yb = sy(q[2]);
      g.fillStyle = q[4]; g.fillRect(Math.min(xa, xb), ya, Math.abs(xb - xa), yb - ya);
      g.fillStyle = 'rgba(232,232,227,.55)'; g.font = '600 12px "Vazirmatn", "Space Grotesk", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(T(q[5]), (xa + xb) / 2, q[2] === 0 ? ya + 16 : yb - 14);
    });
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x50, padT); g.lineTo(x50, padT + ph); g.moveTo(padL, y0); g.lineTo(padL + pw, y0); g.stroke();
    /* axes */
    g.fillStyle = GREY; g.font = F; g.textAlign = 'center'; g.textBaseline = 'top';
    [0, 20, 40, 60, 80, 100].forEach(function (v) { g.fillText(String(v), sx(v), padT + ph + 6); });
    g.textAlign = 'right'; g.textBaseline = 'middle'; if ('direction' in g) g.direction = 'ltr';
    [-80, -50, -20, -10, 0, 10, 20, 50, 100, 200, 400, 800].forEach(function (v) { if (v >= lo && v <= hi) g.fillText((v > 0 ? '+' : '') + v + '%', padL - 6, sy(v)); });
    /* every day so far, faint, by halving epoch; the last 365 days as a trail; today as a ring */
    var last = pts[pts.length - 1], trailFrom = last.t - 365 * DAY;
    pts.forEach(function (p) {
      if (p.t >= trailFrom) return;
      var e = epochOf(p.t); g.fillStyle = e < 0 ? 'rgba(141,141,134,.25)' : EPOCHS[e][1] + '33';
      g.fillRect(sx(p.x) - 1, sy(p.y) - 1, 2, 2);
    });
    var trail = pts.filter(function (p) { return p.t >= trailFrom; });
    for (var k = 1; k < trail.length; k++) {
      var a = trail[k - 1], b = trail[k], u = k / trail.length;
      g.strokeStyle = 'rgba(247,147,26,' + (0.15 + 0.85 * u).toFixed(3) + ')'; g.lineWidth = 1 + 1.6 * u;
      g.beginPath(); g.moveTo(sx(a.x), sy(a.y)); g.lineTo(sx(b.x), sy(b.y)); g.stroke();
    }
    g.fillStyle = ACC; g.beginPath(); g.arc(sx(last.x), sy(last.y), 5.5, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(sx(last.x), sy(last.y), 9, 0, 7); g.stroke();
    if (V.hover) {
      var hp = V.hover; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(sx(hp.x), sy(hp.y), 6, 0, 7); g.stroke();
    }
  }
  /* at most one repaint a frame however fast the pointer moves (slow phones) */
  var hoverEv = null, hoverRaf = 0;
  function compassHover(e) {
    hoverEv = { clientX: e.clientX, clientY: e.clientY };
    if (hoverRaf) return;
    var go = function () { hoverRaf = 0; if (hoverEv) hoverAt(hoverEv); };
    hoverRaf = w.requestAnimationFrame ? w.requestAnimationFrame(go) : setTimeout(go, 16);
  }
  function hoverAt(e) {
    var M = V.map, pts = V.pts; if (!M || !pts) return;
    var rc = V.cv.getBoundingClientRect(), mx = e.clientX - rc.left, my = e.clientY - rc.top, best = null, bd = 144;
    for (var k = 0; k < pts.length; k++) { var dx = M.sx(pts[k].x) - mx, dy = M.sy(pts[k].y) - my, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = pts[k]; } }
    V.hover = best; drawCompass();
    var tip = $('#x-ctip', V.el);
    if (!best) { tip.hidden = true; return; }
    tip.innerHTML = '<b>' + esc(OB.fmtDate(best.t)) + '</b><span>' + esc(T('x_score')) + ': <b class="ob-n">' + esc(String(best.x.toFixed(0))) + '</b></span><span>' + esc(T('x_pct90')) + ': <b class="ob-n">' + esc(OB.ltr(pctTxt(best.y, 1))) + '</b></span>';
    tip.hidden = false;
    var tx = Math.min(rc.width - 170, Math.max(4, mx + 12)), ty = Math.max(4, my - 64);
    tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
  }
  function compassLegend() {
    return '<div class="ob-lgd x-clgd">' + EPOCHS.map(function (e, k) { return '<span><i style="background:' + e[1] + '"></i>' + esc(T('x_ep' + k)) + '</span>'; }).join('') +
      '<span><i style="background:' + ACC + ';width:18px;height:3px"></i>' + esc(T('x_trail')) + '</span></div>';
  }

  /* ---------------------------------------------------------------- the pools view (plain markup, no chart) */
  function renderPools(R) {
    var P = X.pools(R.info && R.info.pools), now = R.now, h = '';
    if (!P) { status('<b>' + esc(T('no_file')) + '</b>', 'err'); return; }
    var nt = now && now.nodes && now.nodes.total;
    h += tile(T('x_nc'), esc(String(P.nakamoto == null ? '—' : P.nakamoto)), esc(T('x_nc_s')));
    h += tile(T('x_top2'), esc(OB.ltr(P.top2.toFixed(1) + '%')), esc(T('x_top2_s', { a: P.rows[0].name, b: P.rows[1] ? P.rows[1].name : '' })));
    h += tile(T('x_hhi'), esc(Math.round(P.hhi).toLocaleString('en-US')), esc(T(P.hhi >= 2500 ? 'x_hhi_hi' : P.hhi >= 1500 ? 'x_hhi_mid' : 'x_hhi_lo')));
    if (nt) h += tile(T('x_nodes'), esc(nt.toLocaleString('en-US')), esc(T('x_nodes_s')));
    $('#ob-tiles', V.el).innerHTML = h;
    var rows = P.rows.map(function (r, k) {
      var cross = k + 1 === P.nakamoto;
      return '<tr' + (cross ? ' class="x-cross"' : '') + '><td class="ob-n">' + esc(String(k + 1)) + '</td><td>' + esc(r.name) + '</td><td class="ob-n">' + esc(String(r.blocks)) + '</td><td class="ob-barc"><span class="ob-bar"><i style="width:' + Math.min(100, r.share * 2).toFixed(1) +
        '%;background:' + (k < (P.nakamoto || 0) ? RED : ACC) + '"></i></span><span class="ob-n">' + esc(r.share.toFixed(1)) + '%</span></td><td class="ob-n">' + esc(r.cum.toFixed(1)) + '%</td></tr>';
    }).join('');
    rows += '<tr><td></td><td>' + esc(T('x_others')) + '</td><td class="ob-n">' + esc(String(P.rest)) + '</td><td class="ob-barc"><span class="ob-bar"><i style="width:' + Math.min(100, P.rest_share * 2).toFixed(1) + '%;background:' + GREY + '"></i></span><span class="ob-n">' + esc(P.rest_share.toFixed(1)) + '%</span></td><td class="ob-n">100%</td></tr>';
    var tb = $('#ob-tbl', V.el);
    tb.innerHTML = '<h3>' + esc(T('x_tbl_pools', { n: OB.loc(P.total) })) + '</h3><p class="ob-note ob-small">' + esc(T('x_tbl_pools_n')) + '</p><div class="ob-tblw x-wide"><table class="ob-grid" id="x-pools"><thead><tr><th>#</th><th>' + esc(T('x_th_pool')) + '</th><th>' + esc(T('x_th_blocks')) +
      '</th><th>' + esc(T('th_share')) + '</th><th>' + esc(T('x_th_cum')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    tb.hidden = false;
    $('#ob-note', V.el).textContent = T('note_x_pools');
    V.csvRows = [['rank', 'pool', 'blocks', 'share_pct', 'cumulative_pct']].concat(P.rows.map(function (r, k) { return [k + 1, r.name, r.blocks, +r.share.toFixed(3), +r.cum.toFixed(3)]; }));
  }

  /* ---------------------------------------------------------------- the rotation view */
  function renderRotation(R) {
    var Q = X.rotation(R); if (!Q) { status('<b>' + esc(T('no_file')) + '</b>', 'err'); return; }
    var m = curM(), sh = m === 'real' ? Q.rshare : Q.mshare, n = Q.t.length;
    function P(a) { var o = []; for (var i = 0; i < n; i++) if (sh[a][i] != null) o.push([Q.t[i], sh[a][i]]); return o; }
    var big = ['btc', 'eth'], small = Q.assets.filter(function (a) { return big.indexOf(a) < 0; });
    var tEnd = Q.t[n - 1], yrs = RYEARS[S.range], t0 = yrs ? Math.max(Q.t[0], tEnd - yrs * YEAR) : Q.t[0];
    V.sub = T('cr_' + S.range) + ' · Coin Metrics';
    V.ts.set({ daily: true, label: T('x_aria_rot'), view: [t0, tEnd + (tEnd - t0) * 0.02], panes: [
      { weight: 3, title: T('x_rot_big'), fmt: function (v) { return v.toFixed(1) + '%'; }, series: big.map(function (a) { return { name: a.toUpperCase(), type: 'line', color: ASSET_C[a], width: 1.7, data: P(a) }; }) },
      { weight: 3, title: T('x_rot_small'), fmt: function (v) { return v.toFixed(2) + '%'; }, series: small.map(function (a) { return { name: a.toUpperCase(), type: 'line', color: ASSET_C[a], width: 1.4, data: P(a) }; }) }] });
    var last = n - 1, h = '';
    ['btc', 'eth'].forEach(function (a) {
      var r = Q.rshare[a][last], mm = Q.mshare[a][last];
      h += tile(T('x_rdom', { coin: a.toUpperCase() }), esc(OB.ltr(fx(r, 1) + '%')), esc(T('x_mdom', { p: OB.ltr(fx(mm, 1) + '%') })));
    });
    var o = 0, om = 0; small.forEach(function (a) { o += Q.rshare[a][last] || 0; om += Q.mshare[a][last] || 0; });
    h += tile(T('x_rdom_o'), esc(OB.ltr(o.toFixed(1) + '%')), esc(T('x_mdom', { p: OB.ltr(om.toFixed(1) + '%') })));
    h += tile(T('th_date'), esc(OB.fmtDate(Q.t[last])), '');
    $('#ob-tiles', V.el).innerHTML = h;
    $('#ob-note', V.el).textContent = T('note_x_rotation') + ' ' + T('src_cm', { d: OB.fmtDate(Q.t[last]) });
    V.csvRows = [['date'].concat(Q.assets.map(function (a) { return a + '_realized_share_pct'; }), Q.assets.map(function (a) { return a + '_market_share_pct'; }))];
    for (var i = 0; i < n; i++) V.csvRows.push([new Date(Q.t[i]).toISOString().slice(0, 10)].concat(Q.assets.map(function (a) { return Q.rshare[a][i] == null ? null : +Q.rshare[a][i].toFixed(4); }), Q.assets.map(function (a) { return Q.mshare[a][i] == null ? null : +Q.mshare[a][i].toFixed(4); })));
  }

  /* ---------------------------------------------------------------- render and load */
  function render() {
    var K = KINDS[V.kind];
    if (K.file === 'rot') { if (V.R) renderRotation(V.R); setSegs(); return; }
    if (K.file === 'pools') { if (V.R) renderPools(V.R); return; }
    var D = V.D; if (!D) return;
    var s = V.sum = X.summary(D), i = CM.last(D.cols.price), tEnd = D.t0 + i * DAY;
    tiles(D, s);
    if (V.kind === 'compass') {
      V.pts = null; V.hover = null; drawCompass();
      $('#ob-note', V.el).textContent = T('note_x_compass') + ' ' + T('src_cm', { d: dateTxt(s.score_date) });
      return;
    }
    var yrs = RYEARS[S.range], f0 = 0;
    while (f0 < D.n && D.cols.price[f0] == null) f0++;
    if (V.kind === 'ethsup') f0 = Math.max(f0, Math.round((Date.parse('2021-08-05T00:00:00Z') - D.t0) / DAY) - 365);   /* the burn began with London (August 2021) */
    var t0 = yrs ? Math.max(D.t0 + f0 * DAY, tEnd - yrs * YEAR) : D.t0 + f0 * DAY, span = tEnd - t0;
    V.sub = T('cr_' + S.range) + ' · Coin Metrics · ' + (s.date || '');
    V.ts.set({ daily: true, label: T('x_aria', { m: T('xm_' + V.kind + '_' + curM()), coin: coin() }), view: [t0, tEnd + span * 0.02], panes: build(D) });
    var tb = $('#ob-tbl', V.el), html = V.kind === 'score' ? scoreTable(D, s) : '';
    tb.innerHTML = html; tb.hidden = !html;
    $('#ob-note', V.el).textContent = T('note_x_' + V.kind) + ' ' + T('src_cm', { d: dateTxt(s.date) });
    setSegs();
  }
  function setSegs() { var m = curM(); if (m) { OB.ui.setSeg(V.el, 'ob-m', m); var sel = $('#ob-msel', V.el); if (sel) sel.value = m; } }
  function load(force) {
    var seq = ++V.seq, K = KINDS[V.kind];
    status('<span class="ob-spin"></span>' + esc(T('loading3')));
    (K.file ? other(K.file, force) : chain(S.asset, force)).then(function (r) {
      if (seq !== V.seq) return;
      if (K.file) V.R = r; else V.D = r;
      status('');
      try { render(); } catch (err) { fail(err); }               /* a malformed file shows the error and Retry, never a blank view */
    }, function (e) {
      if (seq !== V.seq) return;
      fail(e);
    });
  }
  function fail(e) {
    if (w.console) console.warn(e);
    status('<b>' + esc(T(e && e.status === 404 ? 'no_file' : 'err_file')) + '</b><br><span>' + esc(T(e && e.status === 404 ? 'no_file_d' : 'err_file_d')) + '</span><br><button type="button" class="ob-btn" id="ob-retry">' + esc(T('retry')) + '</button>', 'err');
  }
  function measureCtl() {
    var ms = KINDS[V.kind].ms, cur = curM(); if (!ms.length) return '';
    return '<label class="ob-lbl ob-wide"><span>' + esc(T('measure')) + '</span>' + OB.ui.seg('ob-m', ms.map(function (k) { return [k, T('xm_' + V.kind + '_' + k)]; }), cur, 'ob-rng') + '</label>' +
      '<label class="ob-lbl ob-narrow"><span>' + esc(T('measure')) + '</span><select class="ob-sel" id="ob-msel">' + ms.map(function (k) { return '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(T('xm_' + V.kind + '_' + k)) + '</option>'; }).join('') + '</select></label>';
  }
  function exportCsv() {
    if (V.csvRows) { OB.csv('entekhab-' + V.kind + '.csv', V.csvRows); return; }
    var D = V.D; if (!D) return;
    var Z = X.xseries(D), keys = ['price', 'rprice', 'thermo', 'tmult', 'rtc', 'avgprice', 'deltaprice', 'topprice', 'chpos', 'rflow30', 'rflow90', 'rpct30', 'rpct90', 'hpusd', 'hpsat', 'nvm', 'nvmz', 'sincemerge', 'infl365', 'burn365', 'score'];
    keys = keys.filter(function (k) { return Z[k] && Z[k].some(function (v) { return v != null; }); });
    var rows = [['date'].concat(keys)];
    for (var i = 0; i < D.n; i++) {
      var r = [CM.dayStr(D.t0, i)], any = false;
      keys.forEach(function (k) { var v = Z[k][i]; if (v != null && isFinite(v)) { any = true; r.push(+v.toPrecision(8)); } else r.push(null); });
      if (any) rows.push(r);
    }
    OB.csv('entekhab-' + S.asset + '-' + V.kind + '.csv', rows);
  }

  function mount(kind, el) {
    V.kind = kind; V.el = el; V.D = null; V.R = null; V.csvRows = null; V.cv = null; V.pts = null;
    var K = KINDS[kind];
    if (K.assets.length && K.assets.indexOf(S.asset) < 0) S.asset = K.assets[0];
    if (S._m && K.ms.indexOf(S._m) >= 0) S[mKey()] = S._m; S._m = null;
    var chartBox = kind === 'compass' ? '<div class="ob-tsbox x-cbox"><canvas id="x-compass" role="img" aria-label="' + esc(T('x_aria_compass')) + '"></canvas><div class="x-ctip" id="x-ctip" hidden></div><div class="ob-status" id="ob-status"></div></div>' + compassLegend()
      : kind === 'pools' ? '<div class="ob-tsbox x-nobox"><div class="ob-status" id="ob-status"></div></div>'
        : '<div class="ob-tsbox"><div class="ob-ts" id="ob-ts"></div><div class="ob-status" id="ob-status"></div></div>';
    var hasRange = kind !== 'compass' && kind !== 'pools';
    el.innerHTML = '<div class="ob-tools">' +
      (K.assets.length > 1 ? '<label class="ob-lbl"><span>' + esc(T('asset')) + '</span>' + OB.ui.seg('ob-as', logoSeg(K.assets), S.asset, 'ob-num x-coins', true) + '</label>' : '') +
      '<span id="ob-mwrap" style="display:contents">' + measureCtl() + '</span>' +
      (hasRange ? '<button type="button" class="ob-ib ob-gear" id="ob-gear" aria-expanded="false" aria-controls="ob-more" aria-label="' + esc(T('more')) + '" title="' + esc(T('more')) + '">' + OB.icon('gear') + '</button>' +
        '<div class="ob-more" id="ob-more"><label class="ob-lbl"><span>' + esc(T('range')) + '</span>' + OB.ui.seg('ob-r', RANGES.map(function (k) { return [k, T('cr_' + k)]; }), S.range, 'ob-rng') + '</label>' +
        (kind === 'rotation' ? '' : '<label class="ob-lbl"><span>' + esc(T('scale')) + '</span>' + OB.ui.seg('ob-sc', [['log', T('sc_log')], ['lin', T('sc_lin')]], S.log ? 'log' : 'lin') + '</label>') + '</div>' : '') +
      OB.ui.acts(true) + '</div><div class="ob-tiles" id="ob-tiles"></div>' + chartBox +
      '<div class="ob-tblbox" id="ob-tbl" hidden></div><p class="ob-note" id="ob-note"></p>';
    if (kind === 'pools') { var pb = $('#ob-png', el); if (pb) pb.remove(); }
    if (kind === 'compass') {
      V.cv = $('#x-compass', el);
      V.cv.addEventListener('mousemove', compassHover);
      V.cv.addEventListener('mouseleave', function () { hoverEv = null; V.hover = null; var t = $('#x-ctip', el); if (t) t.hidden = true; drawCompass(); });
      V.cv.addEventListener('touchstart', function (e) { if (e.touches[0]) compassHover(e.touches[0]); }, { passive: true });
      V.off = function () { drawCompass(); }; OB.on('resize', V.off);
    } else if (kind !== 'pools') V.ts = new OB.TS($('#ob-ts', el));
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      var seg = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null, v = b.getAttribute('data-v');
      if (seg === 'ob-as' && v !== S.asset && K.assets.indexOf(v) >= 0) { S.asset = v; OB.ui.setSeg(el, 'ob-as', v); save(); load(); }
      else if (seg === 'ob-m' && v !== S[mKey()] && K.ms.indexOf(v) >= 0) { S[mKey()] = v; save(); render(); }
      else if (seg === 'ob-r' && v !== S.range && RANGES.indexOf(v) >= 0) { S.range = v; OB.ui.setSeg(el, 'ob-r', v); save(); render(); }
      else if (seg === 'ob-sc') { S.log = v === 'log'; OB.ui.setSeg(el, 'ob-sc', v); save(); render(); }
      else if (b.id === 'ob-gear') { var op = !$('.ob-tools', el).classList.contains('open'); $('.ob-tools', el).classList.toggle('open', op); b.setAttribute('aria-expanded', op ? 'true' : 'false'); if (V.ts) V.ts.onResize(); }
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') load(true);
      else if (b.id === 'ob-full') { OB.fullscreen(d.getElementById('ob')); if (V.cv) drawCompass(); }
      else if (b.id === 'ob-png') {
        if (V.ts && (V.D || V.R)) V.ts.png((K.assets.length ? coin() + ' · ' : '') + T('tab_' + V.kind), V.sub, 'entekhab-' + V.kind + '-' + (curM() || 'view') + '.png');
        else if (V.cv) { var a = d.createElement('a'); a.href = V.cv.toDataURL('image/png'); a.download = 'entekhab-' + V.kind + '.png'; d.body.appendChild(a); a.click(); a.remove(); }
      }
      else if (b.id === 'ob-share') OB.ui.share({ asset: K.assets.length ? S.asset : null, m: curM() || null, range: hasRange ? S.range : null });
      else if (b.id === 'ob-csv') exportCsv();
    };
    el.onchange = function (e) { if (e.target.id === 'ob-msel' && e.target.value !== S[mKey()] && K.ms.indexOf(e.target.value) >= 0) { S[mKey()] = e.target.value; save(); render(); } };
    load();
  }
  function unmount() { V.seq++; if (V.ts) V.ts.destroy(); V.ts = null; V.D = null; V.R = null; if (V.off) OB.off('resize', V.off); V.off = null; V.cv = null; }
  Object.keys(KINDS).forEach(function (k) { OB.views[k] = { mount: function (el) { mount(k, el); }, unmount: unmount }; });
  OB._xch = { V: V, S: S, KINDS: KINDS };
})();
