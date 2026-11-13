/* entekhab.net — the Observatory: /charts/liquidation-heatmap/ and /charts/liquidation-map/.
   Data: assets/obs/src.js (Binance + Bybit public data in the browser). Model: assets/obs/liqmodel.js (documented there).
   The heatmap is drawn on a canvas (time →, price ↑, heat = dollars of positions estimated to be liquidated at that price),
   candles on top, the real liquidation orders (OKX history, Binance/Bybit live) as rings, the present levels as a profile. */
(function () {
  'use strict';
  var OB = window.OB, M = window.OBLiq, T = OB.T, esc = OB.esc, $ = OB.$, $$ = OB.$$, clamp = OB.clamp;
  var w = window, d = document;

  /* ---------------------------------------------------------------- palettes: every one runs dark → light (semantic heat) */
  var PAL = {
    fire: [[0, 24, 12, 44], [0.14, 66, 18, 84], [0.32, 128, 26, 92], [0.5, 198, 54, 44], [0.68, 247, 147, 26], [0.86, 255, 214, 102], [1, 255, 250, 224]],
    viridis: [[0, 68, 1, 84], [0.13, 72, 40, 120], [0.25, 62, 73, 137], [0.38, 49, 104, 142], [0.5, 38, 130, 142], [0.63, 31, 158, 137], [0.75, 53, 183, 121], [0.86, 110, 206, 88], [0.94, 181, 222, 43], [1, 253, 231, 37]],
    ice: [[0, 10, 24, 54], [0.2, 13, 54, 107], [0.45, 28, 92, 171], [0.65, 57, 135, 229], [0.85, 158, 197, 244], [1, 240, 247, 255]],
    mono: [[0, 34, 34, 37], [0.5, 128, 128, 131], [1, 255, 255, 255]]
  };
  var PALS = ['fire', 'viridis', 'ice', 'mono'];
  function ramp(stops, x) {
    for (var i = 1; i < stops.length; i++) if (x <= stops[i][0]) { var a = stops[i - 1], b = stops[i], t = (x - a[0]) / (b[0] - a[0]); return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]; }
    var l = stops[stops.length - 1]; return [l[1], l[2], l[3]];
  }
  var LUTS = {};
  function lut(name) {                        /* 256 packed little-endian RGBA values; entry 0 is transparent */
    if (LUTS[name]) return LUTS[name];
    var u = new Uint32Array(256), st = PAL[name] || PAL.fire;
    for (var i = 1; i < 256; i++) { var c = ramp(st, (i - 1) / 254); u[i] = (255 << 24) | ((c[2] & 255) << 16) | ((c[1] & 255) << 8) | (c[0] & 255); }
    return (LUTS[name] = u);
  }
  function cssAt(name, x) { var c = ramp(PAL[name] || PAL.fire, x); return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }
  var UP = '#e9fff5', DN = '#ff4d6a', LONGC = '#ff5a4d', SHORTC = '#34d399';
  /* leverage is an ordered scale: one hue per side, lighter = higher leverage (nearer to the price) */
  /* (both ramps pass the ordinal checks of the palette validator on the dark surface: one hue, even lightness steps, darkest step ≥ 2:1) */
  var TIER_L = { 5: '#a03226', 10: '#c23f2f', 25: '#e2503d', 50: '#ff7a66', 100: '#ffb9ac' };
  var TIER_S = { 5: '#157050', 10: '#1a8a63', 25: '#22a67a', 50: '#3fd9a0', 100: '#9cefd0' };
  var GAMMA = 0.95;       /* nearly linear: only the strongest levels are bright (checked on live data: 0.55 lit up every band) */

  /* ---------------------------------------------------------------- settings (this browser only; a shared link overrides them once) */
  var DEF = { coin: 'BTC', range: '24h', ex: 'all', model: 1, tiers: { 5: 0, 10: 1, 25: 1, 50: 1, 100: 1 }, pal: 'fire', thr: 6, real: true, prof: true, mapw: 10, maplb: '7d' };
  var S = (function () {
    var s = OB.store.get('ek_obs_liq', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (s[k] != null && typeof s[k] === typeof o[k]) o[k] = s[k]; });
    var q = new URLSearchParams(location.search), v;
    if ((v = q.get('coin')) && /^[A-Z0-9]{1,14}$/.test(v)) o.coin = v;
    if ((v = q.get('range')) && OB.LIQ_RANGES.some(function (r) { return r.k === v; })) o.range = v;
    if ((v = q.get('ex')) && /^(all|binance|bybit)$/.test(v)) o.ex = v;
    if ((v = q.get('model')) && /^[123]$/.test(v)) o.model = +v;
    if (!o.tiers || typeof o.tiers !== 'object') o.tiers = JSON.parse(JSON.stringify(DEF.tiers));
    if (PALS.indexOf(o.pal) < 0) o.pal = 'fire';
    return o;
  })();
  var save = OB.debounce(function () { OB.store.set('ek_obs_liq', S); }, 300);
  var MAP_LB = { '24h': '24h', '3d': '3d', '7d': '1w', '30d': '1m' }, MAP_MS = { '24h': 864e5, '3d': 3 * 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5 };

  /* ---------------------------------------------------------------- shared state of the two views */
  var V = { kind: null, el: null, data: null, feeds: null, cols: null, res: null, coin: null, coins: null, loading: false, err: null,
    liqs: [], live: null, timer: null, chart: null, px: null, seq: 0 };

  function exList() { return S.ex === 'all' ? ['binance', 'bybit'] : [S.ex]; }
  function tierSel() { var o = {}; M.TIERS.forEach(function (t) { if (S.tiers[t]) o[t] = 1; }); return o; }
  function curRange() { return V.kind === 'liqmap' ? OB.liqRange(MAP_LB[S.maplb] || '1w') : OB.liqRange(S.range); }

  /* ================================================================ toolbar */
  var seg = OB.ui.seg;
  function toolbar() {
    var heat = V.kind === 'liqheat';
    var ranges = OB.LIQ_RANGES.map(function (r) { return [r.k, T('r_' + r.k)]; });
    var h = '<div class="ob-tools">' +
      OB.ui.coinBtn(S.coin) +
      '<label class="ob-lbl"><span>' + esc(T('exch')) + '</span>' + seg('ob-ex', [['all', T('ex_all')], ['binance', 'Binance'], ['bybit', 'Bybit']], S.ex) + '</label>';
    if (heat) {
      h += '<label class="ob-lbl ob-wide"><span>' + esc(T('range')) + '</span>' + seg('ob-range', ranges, S.range, 'ob-rng') + '</label>' +
        '<label class="ob-lbl ob-narrow"><span>' + esc(T('range')) + '</span><select id="ob-range-s" class="ob-sel">' + ranges.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === S.range ? ' selected' : '') + '>' + esc(r[1]) + '</option>'; }).join('') + '</select></label>';
    } else {
      h += '<label class="ob-lbl"><span>' + esc(T('lookback')) + '</span>' + seg('ob-lb', [['24h', T('r_24h')], ['3d', T('r_3d')], ['7d', T('r_1w')], ['30d', T('r_1m')]], S.maplb) + '</label>' +
        '<label class="ob-lbl"><span>' + esc(T('width')) + '</span>' + seg('ob-mw', [[5, '±5%'], [10, '±10%'], [15, '±15%'], [20, '±20%']], S.mapw, 'ob-num') + '</label>';
    }
    h += '<label class="ob-lbl"><span>' + esc(T('model')) + '</span>' + seg('ob-model', [[1, OB.loc(1), T('m1')], [2, OB.loc(2), T('m2')], [3, OB.loc(3), T('m3')]], S.model, 'ob-num') +
      '<button type="button" class="ob-ib ob-sm" id="ob-minfo" aria-label="' + esc(T('model_info')) + '" title="' + esc(T('model_info')) + '">' + OB.icon('info') + '</button></label>' +
      '<button type="button" class="ob-ib ob-gear" id="ob-gear" aria-expanded="false" aria-controls="ob-more" aria-label="' + esc(T('more')) + '" title="' + esc(T('more')) + '">' + OB.icon('gear') + '</button>' +
      '<div class="ob-more" id="ob-more"><label class="ob-lbl"><span>' + esc(T('lev')) + '</span><div class="ob-seg ob-num ob-multi" id="ob-lev" role="group">' + M.TIERS.map(function (t) {
        return '<button type="button" data-v="' + t + '"' + (S.tiers[t] ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + t + 'x</button>';
      }).join('') + '</div></label>';
    if (heat) {
      h += '<label class="ob-lbl"><span>' + esc(T('palette')) + '</span><div class="ob-pals" id="ob-pal" role="group">' + PALS.map(function (p) {
        return '<button type="button" data-v="' + p + '"' + (p === S.pal ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + ' title="' + esc(T('pal_' + p)) + '" aria-label="' + esc(T('pal_' + p)) +
          '" style="background:linear-gradient(90deg,' + cssAt(p, 0.05) + ',' + cssAt(p, 0.5) + ',' + cssAt(p, 1) + ')"></button>';
      }).join('') + '</div></label>' +
        '<label class="ob-lbl ob-thr"><span>' + esc(T('thr')) + ' <b id="ob-thr-v" class="ob-n">' + S.thr + '%</b></span><input type="range" id="ob-thr" min="0" max="60" step="1" value="' + S.thr + '"></label>' +
        '<label class="ob-chk"><input type="checkbox" id="ob-real"' + (S.real ? ' checked' : '') + '><span>' + esc(T('real_liq')) + '</span></label>' +
        '<label class="ob-chk"><input type="checkbox" id="ob-prof"' + (S.prof ? ' checked' : '') + '><span>' + esc(T('profile')) + '</span></label>';
    }
    h += '</div><span class="ob-grow"></span><span class="ob-acts">' +
      '<button type="button" class="ob-ib" id="ob-refresh" aria-label="' + esc(T('refresh')) + '" title="' + esc(T('refresh')) + '">' + OB.icon('refresh') + '</button>' +
      '<button type="button" class="ob-ib" id="ob-png" aria-label="' + esc(T('png')) + '" title="' + esc(T('png')) + '">' + OB.icon('camera') + '</button>' +
      '<button type="button" class="ob-ib" id="ob-share" aria-label="' + esc(T('share')) + '" title="' + esc(T('share')) + '">' + OB.icon('share') + '</button>' +
      '<button type="button" class="ob-ib" id="ob-full" aria-label="' + esc(T('full')) + '" title="' + esc(T('full')) + '">' + OB.icon('full') + '</button></span></div>';
    return h;
  }
  function setSeg(id, v) { OB.ui.setSeg(V.el, id, v); }

  function bindTools() {
    var el = V.el;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      var p = b.parentNode, v = b.getAttribute('data-v');
      if (p.id === 'ob-ex') { if (S.ex === v) return; S.ex = v; setSeg('ob-ex', v); save(); load(true); }
      else if (p.id === 'ob-range') { if (S.range === v) return; S.range = v; setSeg('ob-range', v); var s = $('#ob-range-s', el); if (s) s.value = v; save(); load(true); }
      else if (p.id === 'ob-lb') { if (S.maplb === v) return; S.maplb = v; setSeg('ob-lb', v); save(); load(true); }
      else if (p.id === 'ob-mw') { S.mapw = +v; setSeg('ob-mw', v); save(); compute(); }
      else if (p.id === 'ob-model') {
        if (S.model === +v) return; S.model = +v; setSeg('ob-model', v); save();
        if (S.model >= 2 && V.data && !V.data.hasLs) load(true); else compute();
      }
      else if (p.id === 'ob-lev') {
        var t = +v, on = !S.tiers[t];
        if (!on && M.TIERS.filter(function (x) { return S.tiers[x]; }).length === 1) return;        /* at least one tier stays on */
        S.tiers[t] = on ? 1 : 0; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); save(); compute();
      }
      else if (p.id === 'ob-pal') { S.pal = v; setSeg('ob-pal', v); save(); if (V.chart) V.chart.restyle(); }
      else if (b.id === 'ob-gear') { var op = !$('.ob-tools', el).classList.contains('open'); $('.ob-tools', el).classList.toggle('open', op); b.setAttribute('aria-expanded', op ? 'true' : 'false'); if (V.chart) V.chart.onResize(); }
      else if (b.id === 'ob-coin') pickCoin();
      else if (b.id === 'ob-minfo') modelInfo();
      else if (b.id === 'ob-refresh') load(true);
      else if (b.id === 'ob-png') exportPng();
      else if (b.id === 'ob-share') share();
      else if (b.id === 'ob-full') { OB.fullscreen(d.getElementById('ob')); }
      else if (b.id === 'ob-retry') load(true);
    });
    var rs = $('#ob-range-s', el); if (rs) rs.addEventListener('change', function () { S.range = rs.value; setSeg('ob-range', S.range); save(); load(true); });
    var th = $('#ob-thr', el); if (th) th.addEventListener('input', function () { S.thr = +th.value; $('#ob-thr-v', el).textContent = S.thr + '%'; save(); if (V.chart) V.chart.restyle(); });
    var rl = $('#ob-real', el); if (rl) rl.addEventListener('change', function () { S.real = rl.checked; save(); if (V.chart) V.chart.draw(); });
    var pf = $('#ob-prof', el); if (pf) pf.addEventListener('change', function () { S.prof = pf.checked; save(); if (V.chart) V.chart.draw(); });
  }

  /* ================================================================ coin picker */
  function coinLabel() { OB.ui.coinLabel(V.el, S.coin); }
  function pickCoin() { OB.ui.pickCoin({ current: function () { return S.coin; }, onPick: function (base) { S.coin = base; save(); coinLabel(); load(true); } }); }
  function modelInfo() {
    var old = d.getElementById('ob-mi'); if (old) { old.remove(); return; }
    var box = OB.h('<div class="ob-pick ob-mi" id="ob-mi" role="dialog"><div class="ob-pick-h"><b>' + esc(T('model_info')) + '</b><button type="button" class="ob-ib ob-sm" aria-label="' + esc(T('close')) + '">' + OB.icon('close') + '</button></div>' +
      '<div class="ob-mi-b">' + [1, 2, 3].map(function (i) { return '<p><b>' + esc(T('model')) + ' ' + OB.loc(i) + ' — ' + esc(T('m' + i)) + '</b><br>' + esc(T('m' + i + '_d')) + '</p>'; }).join('') +
      '<p class="ob-mut">' + esc(T('model_note')) + '</p></div></div>');
    d.getElementById('ob').appendChild(box);
    box.addEventListener('click', function (e) { if (e.target.closest('button')) box.remove(); });
  }

  /* ================================================================ data → model → picture */
  function status(html, cls) { var s = $('#ob-status', V.el); if (s) { s.innerHTML = html || ''; s.className = 'ob-status' + (cls ? ' ' + cls : ''); s.hidden = !html; } }
  function findCoin(list) { for (var i = 0; i < list.length; i++) if (list[i].base === S.coin) return list[i]; return null; }

  function load(fresh) {
    var seq = ++V.seq, el = V.el;
    V.loading = true; V.err = null;
    var st = $('#ob-stage', el); if (st) st.classList.add('busy');
    status('<span class="ob-spin"></span>' + esc(T('loading')));
    stopLive();
    var down = [];
    OB.coins(fresh).then(function (list) {
      if (seq !== V.seq) return;
      V.coins = list;
      down = exList().filter(function (e) { return !list.ok[e]; });           /* an exchange whose list did not load is unreachable from here */
      var coin = findCoin(list) || list.filter(function (c) { return c.base === 'BTC'; })[0] || list[0];
      if (coin.base !== S.coin) { S.coin = coin.base; }
      V.coin = coin; coinLabel();
      var exs = exList().filter(function (e) { return e === 'binance' ? coin.bn : coin.by; });
      if (!exs.length) exs = [coin.bn ? 'binance' : 'bybit'];
      return OB.liqLoad(coin, curRange(), exs, S.model >= 2);
    }).then(function (data) {
      if (seq !== V.seq || !data) return;
      down.forEach(function (e) { if (data.failed.indexOf(e) < 0) data.failed.push(e); });
      V.data = data; V.loading = false; V.liqs = []; V.okx = null;
      if (st) st.classList.remove('busy');
      compute(true);
      startLive();
      /* the real liquidation orders of the last hours (OKX), drawn over the model */
      /* OKX keeps them in pages of 100, newest first: a busy day needs dozens of pages for the window, so they arrive page by page */
      V.okxFrom = null;
      OB.src.okx.liqs(data.coin.base, data.now - Math.min(data.R.span, 36 * 3600000), 60, function (part, oldest) {
        if (seq !== V.seq) return false;
        V.liqs = V.liqs.concat(part); V.okx = (V.okx || 0) + part.length; if (isFinite(oldest)) V.okxFrom = oldest;
        if (V.chart) V.chart.setLiqs(V.liqs); cards();
        return true;
      }).then(function () { if (seq === V.seq) cards(); }, function () { if (seq === V.seq) { if (!V.okx) V.okx = null; cards(); } });
    }).catch(function (e) {
      if (seq !== V.seq) return;
      V.loading = false; V.err = e; if (st) st.classList.remove('busy');
      if (w.console) console.error(e);
      status('<b>' + esc(T(e && e.message === 'not listed' ? 'err_list' : 'err_net')) + '</b><br><span>' + esc(T('err_net_d')) + '</span><br><button type="button" class="ob-btn" id="ob-retry">' + esc(T('retry')) + '</button>', 'err');
    });
  }

  function compute(first) {
    var data = V.data; if (!data) return;
    var feeds = OB.liqFeeds(data), C = OB.liqColumns(data), tiers = tierSel();
    var lo = Infinity, hi = -Infinity, last = null;
    C.cols.forEach(function (c) { if (c) { if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; last = c; } });
    if (!last) { status('<b>' + esc(T('err_net')) + '</b>', 'err'); return; }
    var px = V.px = last.c, grid, since = -Infinity;
    if (V.kind === 'liqmap') {
      var wd = S.mapw / 100 + 0.01; grid = M.makeGrid(px * (1 - wd), px * (1 + wd), 400);
      since = data.now - (MAP_MS[S.maplb] || MAP_MS['7d']);
    } else grid = M.makeGrid(lo * 0.88, hi * 1.12, 480);
    var list = feeds.map(function (f) {
      var ff = f;
      if (isFinite(since)) {                       /* the map counts only positions opened inside its look-back */
        ff = Object.assign({}, f, { oi0: f.oi0.slice(), oi1: f.oi1.slice() });
        for (var i = 0; i < f.t.length; i++) if (f.t[i] < since) { ff.oi0[i] = NaN; ff.oi1[i] = NaN; }
      }
      return M.run(ff, { model: S.model, tiers: tiers, grid: grid, colEnds: C.ends });
    });
    var res = M.sum(list);
    V.feeds = feeds; V.cols = C; V.res = res; V.lo = lo; V.hi = hi;
    status('');
    if (V.kind === 'liqheat') {
      if (!V.chart) V.chart = new HeatChart($('#ob-stage', V.el));
      V.chart.setData({ cols: C.cols, step: C.step, start: C.start, res: res, lo: lo, hi: hi, px: px, keepView: !first });
      V.chart.setLiqs(V.liqs);
    } else drawMap();
    cards();
  }

  function startLive() {
    stopLive();
    if (!V.coin) return;
    V.live = OB.liqLive(V.coin, {
      onPrice: function (p) { if (!(p > 0)) return; V.px = p; if (V.chart) V.chart.setPrice(p); },
      onLiq: function (x) { V.liqs.push(x); if (V.liqs.length > 4000) V.liqs.splice(0, V.liqs.length - 4000); if (V.chart) V.chart.setLiqs(V.liqs); }
    });
    V.timer = setInterval(function () {
      if (d.hidden || !V.data || V.loading) return;
      var seq = V.seq;
      OB.liqRefresh(V.data).then(function () { if (seq === V.seq) compute(); }, function () { });
    }, 30000);
  }
  function stopLive() { if (V.live) { V.live.close(); V.live = null; } clearInterval(V.timer); V.timer = null; }

  /* ================================================================ cards under the chart */
  function cards() {
    var box = $('#ob-cards', V.el); if (!box || !V.res) return;
    var cl = M.clusters(V.res, V.px, 3), data = V.data, names = data.raws.map(function (r) { return OB.src[r.ex].name; });
    function rows(list, side) {
      if (!list.length) return '<p class="ob-mut">' + esc(T('cl_none')) + '</p>';
      return '<table class="ob-tb"><thead><tr><th>' + esc(T('th_price')) + '</th><th>' + esc(T('th_dist')) + '</th><th>' + esc(T('th_est')) + '</th></tr></thead><tbody>' + list.map(function (c) {
        return '<tr><td class="ob-n">' + esc(OB.fmtP(c.lo)) + ' – ' + esc(OB.fmtP(c.hi)) + '</td><td class="ob-n">' + esc(OB.fmtPct(c.dist)) + '</td><td class="ob-n"><i class="ob-dot" style="background:' + (side === 'long' ? LONGC : SHORTC) + '"></i>' + esc(OB.fmtUsd(c.usd)) + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
    var oiUsd = 0, cover = null;
    V.feeds.forEach(function (f) { if (isFinite(f.oiLast) && isFinite(f.pxLast)) oiUsd += f.oiLast * f.pxLast; if (f.oiFrom != null && (cover == null || f.oiFrom < cover)) cover = f.oiFrom; });
    var n = V.cols.cols.length, tl = V.res.trackL[n - 1], ts = V.res.trackS[n - 1];
    var failed = data.failed && data.failed.length ? '<p class="ob-warn">' + esc(T('part_fail', { ex: data.failed.map(function (e) { return OB.src[e].name; }).join(', ') })) + '</p>' : '';
    var okx = V.okx == null ? '' : '<div><dt>' + esc(T('d_real')) + '</dt><dd>' + esc(T('d_real_v', { n: OB.loc(V.liqs.length), t: V.okxFrom ? OB.fmtDate(V.okxFrom, true) : '—' })) + '</dd></div>';
    box.innerHTML =
      '<section class="ob-card"><h3><i class="ob-dot" style="background:' + SHORTC + '"></i>' + esc(T('cl_above')) + '</h3>' + rows(cl.above, 'short') + '</section>' +
      '<section class="ob-card"><h3><i class="ob-dot" style="background:' + LONGC + '"></i>' + esc(T('cl_below')) + '</h3>' + rows(cl.below, 'long') + '</section>' +
      '<section class="ob-card"><h3>' + esc(T('data_t')) + '</h3><dl class="ob-dl">' +
      '<div><dt>' + esc(T('d_px')) + '</dt><dd class="ob-n">$' + esc(OB.fmtP(V.px)) + '</dd></div>' +
      '<div><dt>' + esc(T('d_ex')) + '</dt><dd>' + esc(names.join(' + ')) + '</dd></div>' +
      '<div><dt>' + esc(T('d_oi')) + '</dt><dd class="ob-n">' + esc(OB.fmtUsd(oiUsd)) + '</dd></div>' +
      '<div><dt>' + esc(T('d_track')) + '</dt><dd class="ob-n">' + esc(OB.fmtUsd(tl)) + ' / ' + esc(OB.fmtUsd(ts)) + '</dd></div>' +
      (cover ? '<div><dt>' + esc(T('d_cover')) + '</dt><dd>' + esc(OB.fmtDate(cover, false)) + '</dd></div>' : '') + okx +
      '<div><dt>' + esc(T('d_upd')) + '</dt><dd>' + esc(OB.fmtDate(data.now, true)) + '</dd></div></dl>' + failed + '</section>';
  }

  /* ================================================================ the heatmap canvas */
  function HeatChart(stage) {
    var self = this;
    this.stage = stage;
    stage.innerHTML = '<canvas class="ob-cv" tabindex="0" role="img"></canvas><div class="ob-tip" hidden></div>' +
      '<div class="ob-zoom"><button type="button" data-z="in" aria-label="' + esc(T('zoom_in')) + '" title="' + esc(T('zoom_in')) + '">+</button><button type="button" data-z="out" aria-label="' + esc(T('zoom_out')) + '" title="' + esc(T('zoom_out')) + '">−</button><button type="button" data-z="reset" aria-label="' + esc(T('reset')) + '" title="' + esc(T('reset')) + '">⟲</button></div>' +
      '<div class="ob-status" id="ob-status" hidden></div>';
    this.cv = $('canvas', stage); this.ctx = this.cv.getContext('2d'); this.tip = $('.ob-tip', stage);
    this.img = d.createElement('canvas'); this.D = null; this.liq = []; this.hover = null; this.raf = 0;
    this.onResize = function () { self.size(); self.draw(); };
    OB.on('resize', this.onResize);
    if (w.ResizeObserver) { this.ro = new ResizeObserver(OB.debounce(this.onResize, 60)); this.ro.observe(stage); }
    this.bind(); this.size();
  }
  HeatChart.prototype.destroy = function () { if (this.ro) this.ro.disconnect(); OB.off('resize', this.onResize); this.dead = true; };
  HeatChart.prototype.size = function () {
    var r = this.stage.getBoundingClientRect(), dpr = Math.min(2.5, w.devicePixelRatio || 1);
    this.W = Math.max(280, Math.floor(r.width)); this.H = Math.max(240, Math.floor(r.height)); this.dpr = dpr;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
  };
  HeatChart.prototype.setData = function (o) {
    var keep = o.keepView && this.D && this.D.cols.length <= o.cols.length && this.D.step === o.step && this.D.res.grid.rows === o.res.grid.rows;
    var grew = keep ? o.cols.length - this.D.cols.length : 0, v = this.v;
    this.D = o; this.n = o.cols.length; this.g = o.res.grid; this.px = o.px;
    this.build();
    if (keep && v) { if (grew && v.x1 >= this.n - grew) { v.x0 += grew; v.x1 += grew; } } else this.resetView();
    this.aria(); this.draw();
  };
  HeatChart.prototype.setLiqs = function (a) { this.liq = a || []; this.agg = null; this.schedule(); };      /* the strip appears with the first order */
  HeatChart.prototype.setPrice = function (p) {
    if (!this.D) return; this.px = p;
    var c = this.D.cols[this.n - 1]; if (c) { c.c = p; if (p > c.h) c.h = p; if (p < c.l) c.l = p; }
    this.schedule();
  };
  HeatChart.prototype.schedule = function () { var s = this; if (s.raf) return; s.raf = requestAnimationFrame(function () { s.raf = 0; s.draw(); }); };
  HeatChart.prototype.resetView = function () {
    var D = this.D, pad = Math.max(0.4 * (D.hi - D.lo), 0.02 * D.px), g = this.g, top = g.pmin + g.rows * g.step;
    var x1 = this.n + Math.max(2, this.n * 0.03), G = this.geom(), fit = G.heatW / 1.6;       /* at least 1.6 px a candle: a phone opens on the latest part */
    this.v = { x0: x1 > fit ? x1 - fit : 0, x1: x1, y0: Math.max(g.pmin, D.lo - pad), y1: Math.min(top, D.hi + pad) };
  };
  HeatChart.prototype.restyle = function () { this.build(); this.draw(); };
  /* matrix → a cols × rows picture through the palette, the threshold and the gamma */
  HeatChart.prototype.build = function () {
    var res = this.D.res, rows = res.grid.rows, cols = res.cols, mat = res.mat, mx = 0, i;
    for (i = 0; i < mat.length; i++) if (mat[i] > mx) mx = mat[i];
    this.max = mx;
    this.img.width = cols; this.img.height = rows;
    var ictx = this.img.getContext('2d'), im = ictx.createImageData(cols, rows), u = new Uint32Array(im.data.buffer), L = lut(S.pal);
    var thr = mx * S.thr / 100, span = mx - thr, c, r, v, k;
    if (mx > 0) for (c = 0; c < cols; c++) for (r = 0; r < rows; r++) {
      v = mat[c * rows + r]; if (!(v > thr)) continue;
      k = 1 + Math.min(254, Math.floor(254 * Math.pow((v - thr) / span, GAMMA)));
      u[(rows - 1 - r) * cols + c] = L[k];
    }
    ictx.putImageData(im, 0, 0);
  };
  HeatChart.prototype.aria = function () {
    var D = this.D; this.cv.setAttribute('aria-label', T('aria_heat', { coin: S.coin, range: T('r_' + S.range), max: OB.fmtUsd(this.max) }));
  };
  HeatChart.prototype.geom = function () {
    var W = this.W, H = this.H, narrow = W < 560;
    var L = narrow ? 34 : 58, R = this.axisW || 64, Tp = 10, B = 24;
    var plotW = W - L - R, pw = S.prof ? clamp(Math.round(plotW * 0.14), 44, 150) : 0;
    var lh = S.real && this.liq.length ? (narrow ? 42 : 56) : 0, all = H - Tp - B;      /* the strip of real liquidations under the heat */
    return { L: L, R: R, T: Tp, B: B, plotW: plotW, heatW: plotW - pw, pw: pw, plotH: all - (lh ? lh + 8 : 0), liqH: lh, liqY: Tp + all - lh, narrow: narrow };
  };
  /* axis labels in dollars: no needless decimals ("$300M", "$1.5B") */
  function axUsd(v, step) {
    if (!v) return '$0';
    var u = v >= 1e9 ? [1e9, 'B'] : v >= 1e6 ? [1e6, 'M'] : v >= 1e3 ? [1e3, 'K'] : [1, ''], x = v / u[0], st = step / u[0];
    return '$' + x.toFixed(st >= 1 || Math.abs(x - Math.round(x)) < 1e-9 ? 0 : st >= 0.1 ? 1 : 2) + u[1];
  }
  function niceStep(span, n) { var raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }
  var TSTEPS = [300e3, 900e3, 1800e3, 3600e3, 2 * 3600e3, 4 * 3600e3, 6 * 3600e3, 12 * 3600e3, 864e5, 2 * 864e5, 7 * 864e5, 14 * 864e5, 30 * 864e5, 60 * 864e5, 90 * 864e5];

  HeatChart.prototype.draw = function (target) {
    if (!this.D || this.dead) return;
    var ctx = target ? target.ctx : this.ctx, dpr = target ? target.dpr : this.dpr, D = this.D, g = this.g, v = this.v, n = this.n;
    /* the price axis is as wide as its widest label */
    ctx.setTransform(dpr, 0, 0, dpr, 0, target ? (target.oy || 0) * dpr : 0);
    ctx.font = '11px "Space Grotesk", system-ui, sans-serif';
    this.axisW = Math.max(52, Math.ceil(ctx.measureText(OB.fmtP(v.y1)).width) + 18);
    var G = this.geom(), W = this.W, H = this.H, x0 = G.L, y0 = G.T, hw = G.heatW, ph = G.plotH;
    var xs = hw / (v.x1 - v.x0), ys = ph / (v.y1 - v.y0);
    function X(c) { return x0 + (c - v.x0) * xs; }
    function Y(p) { return y0 + (v.y1 - p) * ys; }
    this._X = X; this._Y = Y; this._G = G;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0d0d11'; ctx.fillRect(x0, y0, G.plotW, ph);

    /* grid: hairlines one shade off the surface */
    var gtop = g.pmin + g.rows * g.step, ps = niceStep(v.y1 - v.y0, Math.max(3, Math.floor(ph / 54))), p;
    ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1; ctx.beginPath();
    for (p = Math.ceil(v.y0 / ps) * ps; p <= v.y1; p += ps) { var yy = Math.round(Y(p)) + 0.5; ctx.moveTo(x0, yy); ctx.lineTo(x0 + G.plotW, yy); }
    ctx.stroke();

    /* heat */
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, hw, ph); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    var sx0 = Math.max(0, v.x0), sx1 = Math.min(n, v.x1), py1 = Math.min(gtop, v.y1), py0 = Math.max(g.pmin, v.y0);
    if (sx1 > sx0 && py1 > py0 && this.max > 0) {
      ctx.drawImage(this.img, sx0, (gtop - py1) / g.step, sx1 - sx0, (py1 - py0) / g.step, X(sx0), Y(py1), (sx1 - sx0) * xs, (py1 - py0) * ys);
    }
    /* candles */
    var a = Math.max(0, Math.floor(v.x0)), b = Math.min(n - 1, Math.ceil(v.x1)), k, c, bw = Math.max(1, Math.min(14, xs * 0.66)), thin = xs < 3;
    for (k = a; k <= b; k++) {
      c = D.cols[k]; if (!c) continue;
      var cx = X(k + 0.5), up = c.c >= c.o, yo = Y(c.o), yc = Y(c.c), yh = Y(c.h), yl = Y(c.l);
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = thin ? 2 : 3; ctx.beginPath(); ctx.moveTo(cx, yh); ctx.lineTo(cx, yl); ctx.stroke();
      ctx.strokeStyle = up ? UP : DN; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, yh); ctx.lineTo(cx, yl); ctx.stroke();
      if (!thin) {
        var top = Math.min(yo, yc), hh = Math.max(1, Math.abs(yc - yo));
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(cx - bw / 2 - 1, top - 1, bw + 2, hh + 2);
        ctx.fillStyle = up ? UP : DN; ctx.fillRect(cx - bw / 2, top, bw, hh);
      }
    }
    ctx.restore();

    /* the profile: the levels standing now, summed over tiers, per screen row */
    if (G.pw) {
      var px0 = x0 + hw, res = D.res, NT = res.longT.length, binH = 3, nb = Math.ceil(ph / binH), bins = new Float64Array(nb), sideL = new Uint8Array(nb), mxb = 0, r;
      for (r = 0; r < g.rows; r++) {
        var tot = 0, tl = 0; for (k = 0; k < NT; k++) { tl += res.longT[k][r]; tot += res.longT[k][r] + res.shortT[k][r]; }
        if (!tot) continue;
        var bi = Math.floor((Y(M.priceOf(g, r)) - y0) / binH); if (bi < 0 || bi >= nb) continue;
        bins[bi] += tot; if (tl > tot - tl) sideL[bi] = 1;
      }
      for (k = 0; k < nb; k++) if (bins[k] > mxb) mxb = bins[k];
      ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fillRect(px0, y0, G.pw, ph);
      ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.beginPath(); ctx.moveTo(px0 + 0.5, y0); ctx.lineTo(px0 + 0.5, y0 + ph); ctx.stroke();
      if (mxb > 0) for (k = 0; k < nb; k++) if (bins[k] > 0) {
        var bl = Math.max(1, bins[k] / mxb * (G.pw - 8));
        ctx.fillStyle = sideL[k] ? LONGC : SHORTC; ctx.globalAlpha = 0.85; ctx.fillRect(px0 + 2, y0 + k * binH, bl, binH - 1); ctx.globalAlpha = 1;
      }
      this.profMax = mxb;
      ctx.fillStyle = '#9a9a94'; ctx.textBaseline = 'top'; ctx.font = '10px Vazirmatn, system-ui, sans-serif';
      ctx.direction = OB.rtl() ? 'rtl' : 'ltr'; ctx.textAlign = 'center';
      ctx.fillText(T('prof_now'), px0 + G.pw / 2, y0 + 3); ctx.direction = 'ltr';
    }

    /* the real liquidation orders, per column: shorts up (green), longs down (red), around a middle line */
    if (G.liqH) {
      if (!this.agg) this.agg = aggLiqs(this.liq, D.start, D.step, n);
      var ly0 = G.liqY, lmid = ly0 + G.liqH / 2, lmx = 0, q;
      for (k = a; k <= b; k++) { q = this.agg[k]; if (q) { if (q[0] > lmx) lmx = q[0]; if (q[2] > lmx) lmx = q[2]; } }
      ctx.fillStyle = '#0d0d11'; ctx.fillRect(x0, ly0, G.plotW, G.liqH);
      ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, ly0 + 0.5, G.plotW - 1, G.liqH - 1);
      ctx.beginPath(); ctx.moveTo(x0, Math.round(lmid) + 0.5); ctx.lineTo(x0 + hw, Math.round(lmid) + 0.5); ctx.stroke();
      if (lmx > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(x0, ly0, hw, G.liqH); ctx.clip();
        var lw = Math.max(1, Math.min(12, xs - (xs > 4 ? 2 : 0))), half = G.liqH / 2 - 3;
        for (k = a; k <= b; k++) {
          q = this.agg[k]; if (!q) continue;
          var lx = X(k + 0.5) - lw / 2;
          if (q[2] > 0) { var hs = Math.max(1, q[2] / lmx * half); ctx.fillStyle = SHORTC; ctx.fillRect(lx, lmid - hs, lw, hs); }
          if (q[0] > 0) { var hl = Math.max(1, q[0] / lmx * half); ctx.fillStyle = LONGC; ctx.fillRect(lx, lmid + 1, lw, hl); }
        }
        ctx.restore();
      }
      this.liqMax = lmx;
      /* its label and scale sit beside it, physically left-aligned in every language (the chart itself is left-to-right) */
      ctx.font = '10px Vazirmatn, system-ui, sans-serif'; ctx.fillStyle = '#9a9a94'; ctx.textBaseline = 'top'; ctx.direction = OB.rtl() ? 'rtl' : 'ltr'; ctx.textAlign = 'left';
      ctx.fillText(T('real_strip'), x0 + hw + 6, ly0 + 5);
      ctx.direction = 'ltr'; ctx.font = '10px "Space Grotesk", system-ui, sans-serif';
      if (lmx > 0) ctx.fillText('±' + OB.fmtUsd(lmx, 1), x0 + hw + 6, ly0 + 21);
    }

    /* the price now */
    var yp = Y(this.px);
    if (yp >= y0 && yp <= y0 + ph) {
      ctx.strokeStyle = 'rgba(247,147,26,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, Math.round(yp) + 0.5); ctx.lineTo(x0 + G.plotW, Math.round(yp) + 0.5); ctx.stroke();
    }
    /* frame */
    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, G.plotW - 1, ph - 1);

    /* price axis */
    ctx.font = '11px "Space Grotesk", system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#b9b9b3';
    for (p = Math.ceil(v.y0 / ps) * ps; p <= v.y1; p += ps) { var ty = Y(p); if (ty > y0 + 6 && ty < y0 + ph - 4) ctx.fillText(OB.fmtP(p), x0 + G.plotW + 8, ty); }
    if (yp >= y0 && yp <= y0 + ph) {
      var lab = OB.fmtP(this.px), tw = ctx.measureText(lab).width + 12;
      ctx.fillStyle = '#f7931a'; ctx.fillRect(x0 + G.plotW + 2, yp - 9, tw, 18); ctx.fillStyle = '#16100a'; ctx.font = '600 11px "Space Grotesk", system-ui, sans-serif'; ctx.fillText(lab, x0 + G.plotW + 8, yp + 0.5);
    }
    /* time axis */
    var spanMs = (v.x1 - v.x0) * D.step, want = spanMs / Math.max(2, Math.floor(hw / 92)), ts = TSTEPS[TSTEPS.length - 1], i;
    for (i = 0; i < TSTEPS.length; i++) if (TSTEPS[i] >= want) { ts = TSTEPS[i]; break; }
    var tz = new Date().getTimezoneOffset() * 60000, t0 = D.start + v.x0 * D.step, t1 = D.start + v.x1 * D.step, t;
    ctx.font = '11px "Space Grotesk", system-ui, sans-serif'; ctx.fillStyle = '#9a9a94'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (t = Math.ceil((t0 - tz) / ts) * ts + tz; t <= t1; t += ts) {
      var tx = X((t - D.start) / D.step); if (tx < x0 + 16 || tx > x0 + hw - 16) continue;
      var dt = new Date(t), mid = dt.getHours() === 0 && dt.getMinutes() === 0;
      ctx.fillStyle = mid ? '#e8e8e3' : '#9a9a94';
      var ay = G.liqH ? G.liqY + G.liqH : y0 + ph;
      ctx.fillText(ts >= 864e5 || mid ? OB.axisDay(t) : OB.axisTime(t), tx, ay + 6);
      ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.beginPath(); ctx.moveTo(Math.round(tx) + 0.5, ay); ctx.lineTo(Math.round(tx) + 0.5, ay + 4); ctx.stroke();
    }
    /* colour scale with its maximum */
    if (!G.narrow) {
      var bx = 12, bw2 = 10, by = y0 + 22, bh = Math.min(ph - 44, 260), gr = ctx.createLinearGradient(0, by + bh, 0, by);
      for (i = 0; i <= 10; i++) gr.addColorStop(i / 10, cssAt(S.pal, i / 10));
      ctx.fillStyle = gr; ctx.fillRect(bx, by, bw2, bh); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.strokeRect(bx + 0.5, by + 0.5, bw2 - 1, bh - 1);
      ctx.fillStyle = '#e8e8e3'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.font = '600 10.5px "Space Grotesk", system-ui, sans-serif'; ctx.fillText(OB.fmtUsd(this.max, 1), 6, by - 5);
      ctx.fillStyle = '#9a9a94'; ctx.textBaseline = 'top'; ctx.font = '10px "Space Grotesk", system-ui, sans-serif'; ctx.fillText(S.thr ? OB.fmtUsd(this.max * S.thr / 100, 1) : '0', 6, by + bh + 5);
    }
    if (!target) this.cross(ctx);
  };

  /* liquidation orders → per column: [long dollars, long average price, short dollars, short average price] */
  function aggLiqs(list, start, step, n) {
    var out = new Array(n), i, x, k, q;
    for (i = 0; i < list.length; i++) {
      x = list[i]; k = Math.floor((x.t - start) / step); if (k < 0 || k >= n) continue;
      q = out[k] || (out[k] = [0, 0, 0, 0]);
      var s = x.side === 'short' ? 2 : 0; q[s + 1] = (q[s + 1] * q[s] + x.px * x.usd) / (q[s] + x.usd); q[s] += x.usd;
    }
    return out;
  }

  HeatChart.prototype.cross = function (ctx) {
    var h = this.hover, G = this._G; if (!h || !G) { this.tip.hidden = true; return; }
    var v = this.v, D = this.D, g = this.g, x0 = G.L, y0 = G.T;
    var bottom = G.liqH ? G.liqY + G.liqH : y0 + G.plotH, inStrip = G.liqH && h.y >= G.liqY;
    if (h.x < x0 || h.x > x0 + G.plotW || h.y < y0 || h.y > bottom || (!inStrip && h.y > y0 + G.plotH)) { this.tip.hidden = true; return; }
    var col = Math.floor(v.x0 + (h.x - x0) / G.heatW * (v.x1 - v.x0)), price = v.y1 - (h.y - y0) / G.plotH * (v.y1 - v.y0);
    var inHeat = h.x <= x0 + G.heatW;
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath();
    if (!inStrip) { ctx.moveTo(x0, Math.round(h.y) + 0.5); ctx.lineTo(x0 + G.plotW, Math.round(h.y) + 0.5); }
    if (inHeat) { var cx = Math.round(this._X(col + 0.5)) + 0.5; ctx.moveTo(cx, y0); ctx.lineTo(cx, bottom); }
    ctx.stroke();
    if (inStrip) {
      var qs = inHeat && this.agg && col >= 0 && col < this.n ? this.agg[col] : null, th = '';
      if (inHeat && col >= 0 && col < this.n) {
        th = '<div class="ob-tip-t">' + esc(OB.fmtDate(D.start + col * D.step, true)) + '</div><div class="ob-tip-r"><span>' + esc(T('tip_real')) + '</span></div>' +
          '<div class="ob-tip-r"><i class="ob-dot" style="background:' + SHORTC + '"></i><span>' + esc(T('tip_short')) + '</span><b class="ob-n">' + esc(qs && qs[2] ? OB.fmtUsd(qs[2]) : '—') + '</b></div>' +
          '<div class="ob-tip-r"><i class="ob-dot" style="background:' + LONGC + '"></i><span>' + esc(T('tip_long')) + '</span><b class="ob-n">' + esc(qs && qs[0] ? OB.fmtUsd(qs[0]) : '—') + '</b></div>';
      }
      this.place(th, h); return;
    }
    var lab = OB.fmtP(price); ctx.font = '600 11px "Space Grotesk", system-ui, sans-serif'; var tw = ctx.measureText(lab).width + 12;
    ctx.fillStyle = '#2a2b31'; ctx.fillRect(x0 + G.plotW + 2, h.y - 9, tw, 18); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(lab, x0 + G.plotW + 8, h.y + 0.5);
    /* the read-out */
    var row = M.rowOf(g, price), rows = g.rows, tip = this.tip, html = '';
    var plo = g.pmin + row * g.step, phi = plo + g.step, inGrid = row >= 0 && row < rows;
    if (inHeat && col >= 0 && col < this.n) {
      var c = D.cols[col], val = inGrid ? D.res.mat[col * rows + row] : 0;
      html += '<div class="ob-tip-t">' + esc(OB.fmtDate(D.start + col * D.step, true)) + '</div>';
      if (c) html += '<div class="ob-tip-o ob-n">O ' + esc(OB.fmtP(c.o)) + ' · H ' + esc(OB.fmtP(c.h)) + ' · L ' + esc(OB.fmtP(c.l)) + ' · C ' + esc(OB.fmtP(c.c)) + '</div>';
      html += '<div class="ob-tip-v"><b class="ob-n">' + esc(val > 0 ? OB.fmtUsd(val) : '—') + '</b><span>' + esc(T('tip_liq')) + (val > 0 && c ? ' · ' + esc(T(price < c.c ? 'tip_long' : 'tip_short')) : '') + '</span></div>';
      html += '<div class="ob-tip-r"><span class="ob-n">' + esc(OB.fmtP(plo)) + ' – ' + esc(OB.fmtP(phi)) + '</span></div>';
    } else if (!inHeat && inGrid) {
      var res = D.res, tl = 0, ts2 = 0, k; for (k = 0; k < res.longT.length; k++) { tl += res.longT[k][row]; ts2 += res.shortT[k][row]; }
      html += '<div class="ob-tip-t">' + esc(T('prof_now')) + '</div><div class="ob-tip-v"><b class="ob-n">' + esc(tl + ts2 > 0 ? OB.fmtUsd(tl + ts2) : '—') + '</b><span>' + esc(T('tip_liq')) + (tl + ts2 > 0 ? ' · ' + esc(T(tl > ts2 ? 'tip_long' : 'tip_short')) : '') + '</span></div>' +
        '<div class="ob-tip-r"><span class="ob-n">' + esc(OB.fmtP(plo)) + ' – ' + esc(OB.fmtP(phi)) + '</span></div>';
    }
    this.place(html, h);
  };
  HeatChart.prototype.place = function (html, h) {
    var tip = this.tip;
    if (!html) { tip.hidden = true; return; }
    tip.innerHTML = html; tip.hidden = false; tip.setAttribute('dir', OB.rtl() ? 'rtl' : 'ltr');
    var twd = tip.offsetWidth, thh = tip.offsetHeight, lx = h.x + 16, ly = h.y + 16;
    if (lx + twd > this.W - 6) lx = h.x - twd - 16; if (lx < 4) lx = 4;
    if (ly + thh > this.H - 6) ly = h.y - thh - 16; if (ly < 4) ly = 4;
    tip.style.left = lx + 'px'; tip.style.top = ly + 'px';
  };

  HeatChart.prototype.zoomX = function (f, ax) {
    var v = this.v, span = v.x1 - v.x0, ns = clamp(span * f, 12, this.n * 1.15), c = ax == null ? (v.x0 + v.x1) / 2 : ax, t = (c - v.x0) / span;
    v.x0 = c - ns * t; v.x1 = v.x0 + ns; this.fitX(); this.schedule();
  };
  HeatChart.prototype.zoomY = function (f, ap) {
    var v = this.v, g = this.g, top = g.pmin + g.rows * g.step, span = v.y1 - v.y0, ns = clamp(span * f, g.step * 12, top - g.pmin), c = ap == null ? (v.y0 + v.y1) / 2 : ap, t = (c - v.y0) / span;
    v.y0 = c - ns * t; v.y1 = v.y0 + ns; this.fitY(); this.schedule();
  };
  HeatChart.prototype.fitX = function () { var v = this.v, sp = v.x1 - v.x0, lo = -sp * 0.2, hi = this.n + sp * 0.35; if (v.x0 < lo) { v.x0 = lo; v.x1 = lo + sp; } if (v.x1 > hi) { v.x1 = hi; v.x0 = hi - sp; } };
  HeatChart.prototype.fitY = function () { var v = this.v, g = this.g, top = g.pmin + g.rows * g.step, sp = v.y1 - v.y0; if (v.y0 < g.pmin) { v.y0 = g.pmin; v.y1 = g.pmin + sp; } if (v.y1 > top) { v.y1 = top; v.y0 = top - sp; } };

  HeatChart.prototype.bind = function () {
    var self = this, cv = this.cv, pts = {}, drag = null, pinch = null;
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function colAt(x) { var G = self._G, v = self.v; return v.x0 + (x - G.L) / G.heatW * (v.x1 - v.x0); }
    function priceAt(y) { var G = self._G, v = self.v; return v.y1 - (y - G.T) / G.plotH * (v.y1 - v.y0); }
    cv.addEventListener('pointerdown', function (e) {
      if (!self.D || !self._G) return;
      var p = pos(e); pts[e.pointerId] = p; try { cv.setPointerCapture(e.pointerId); } catch (er) { }
      var ids = Object.keys(pts);
      if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, span: self.v.x1 - self.v.x0, c: colAt((a.x + b.x) / 2) }; drag = null; return; }
      var G = self._G;
      drag = { x: p.x, y: p.y, v: { x0: self.v.x0, x1: self.v.x1, y0: self.v.y0, y1: self.v.y1 }, axis: p.x > G.L + G.plotW, touch: e.pointerType === 'touch', moved: false };
    });
    cv.addEventListener('pointermove', function (e) {
      if (!self.D || !self._G) return;
      var p = pos(e), G = self._G, v = self.v;
      if (pts[e.pointerId]) pts[e.pointerId] = p;
      if (pinch) {
        var ids = Object.keys(pts); if (ids.length < 2) return;
        var a = pts[ids[0]], b = pts[ids[1]], dd = Math.hypot(a.x - b.x, a.y - b.y) || 1, ns = clamp(pinch.span * pinch.d / dd, 12, self.n * 1.15);
        var t = ((a.x + b.x) / 2 - G.L) / G.heatW; v.x0 = pinch.c - ns * t; v.x1 = v.x0 + ns; self.fitX(); self.hover = null; self.schedule(); return;
      }
      if (drag) {
        var dx = p.x - drag.x, dy = p.y - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (drag.axis) { var f = Math.exp(dy / 160), mid = (drag.v.y0 + drag.v.y1) / 2, sp = (drag.v.y1 - drag.v.y0) * f; v.y0 = mid - sp / 2; v.y1 = mid + sp / 2; self.zoomY(1); }
        else {
          var sx = (drag.v.x1 - drag.v.x0) / G.heatW; v.x0 = drag.v.x0 - dx * sx; v.x1 = drag.v.x1 - dx * sx; self.fitX();
          if (!drag.touch) { var sy = (drag.v.y1 - drag.v.y0) / G.plotH; v.y0 = drag.v.y0 + dy * sy; v.y1 = drag.v.y1 + dy * sy; self.fitY(); }
        }
        self.hover = drag.touch ? null : p; self.schedule(); return;
      }
      self.hover = p; cv.style.cursor = p.x > G.L + G.plotW ? 'ns-resize' : 'crosshair'; self.schedule();
    });
    function up(e) {
      var wasTap = drag && drag.touch && !drag.moved, p = pts[e.pointerId];
      delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = null;
      if (wasTap && p) { self.hover = p; self.schedule(); }
      drag = null;
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch' && !drag) { self.hover = null; self.schedule(); } });
    /* the wheel zooms only when asked for (Ctrl/⌘, full screen, or after a click inside): the page must stay scrollable */
    cv.addEventListener('wheel', function (e) {
      if (!self.D || !self._G) return;
      var fs = d.getElementById('ob').classList.contains('ob-fs');
      if (!(e.ctrlKey || e.metaKey || fs || d.activeElement === cv)) { self.hint(); return; }
      e.preventDefault();
      var p = pos(e), G = self._G, f = Math.exp(clamp(e.deltaY, -120, 120) / 320);
      if (p.x > G.L + G.plotW || e.shiftKey) self.zoomY(f, priceAt(p.y)); else self.zoomX(f, colAt(p.x));
    }, { passive: false });
    cv.addEventListener('dblclick', function () { if (self.D) { self.resetView(); self.draw(); } });
    cv.addEventListener('keydown', function (e) {
      if (!self.D) return; var v = self.v, sp = v.x1 - v.x0, k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') { var m = sp * 0.12 * (k === 'ArrowLeft' ? -1 : 1); v.x0 += m; v.x1 += m; self.fitX(); }
      else if (k === 'ArrowUp' || k === 'ArrowDown') { var my = (v.y1 - v.y0) * 0.12 * (k === 'ArrowUp' ? 1 : -1); v.y0 += my; v.y1 += my; self.fitY(); }
      else if (k === '+' || k === '=') self.zoomX(0.8); else if (k === '-' || k === '_') self.zoomX(1.25); else if (k === '0' || k === 'Home') self.resetView(); else return;
      e.preventDefault(); self.schedule();
    });
    this.stage.addEventListener('click', function (e) {
      var b = e.target.closest('.ob-zoom button'); if (!b || !self.D) return;
      var z = b.getAttribute('data-z'); if (z === 'in') self.zoomX(0.7); else if (z === 'out') self.zoomX(1.4); else { self.resetView(); self.draw(); }
    });
  };
  HeatChart.prototype.hint = function () {
    if (HeatChart.hinted) return; HeatChart.hinted = true;        /* once per visit is enough */
    OB.toast(T('wheel_hint'), 2600);
  };

  /* ================================================================ picture and link */
  function exportPng() {
    if (V.kind === 'liqmap') return exportSvg();
    var ch = V.chart; if (!ch || !ch.D) return;
    var dpr = 2, head = 46, c = d.createElement('canvas'); c.width = ch.W * dpr; c.height = (ch.H + head) * dpr;
    var ctx = c.getContext('2d'); ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0, 0, c.width, c.height);
    var keep = ch.hover; ch.hover = null; ch.draw({ ctx: ctx, dpr: dpr, oy: head }); ch.hover = keep;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f2f2ee'; ctx.font = '700 16px "Space Grotesk", Vazirmatn, system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(S.coin + ' · Liquidation heatmap · ' + S.range, 14, 17);
    ctx.fillStyle = '#9a9a94'; ctx.font = '11px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(V.data.raws.map(function (r) { return OB.src[r.ex].name; }).join(' + ') + ' · model ' + S.model + ' · ' + new Date(V.data.now).toISOString().slice(0, 16).replace('T', ' ') + ' UTC · estimate, not a forecast', 14, 35);
    ctx.fillStyle = '#f7931a'; ctx.font = '700 15px "Space Grotesk", system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('entekhab.net', ch.W - 14, 23);
    ch.draw();
    c.toBlob(function (b) { if (!b) return; dl(URL.createObjectURL(b), 'entekhab-liquidation-heatmap-' + S.coin + '-' + S.range + '.png'); }, 'image/png');
  }
  function exportSvg() {
    var svg = $('#ob-map svg', V.el); if (!svg) return;
    var s = new XMLSerializer().serializeToString(svg), img = new Image(), W = svg.viewBox.baseVal.width, H = svg.viewBox.baseVal.height;
    img.onload = function () {
      var c = d.createElement('canvas'); c.width = W * 2; c.height = H * 2; var ctx = c.getContext('2d'); ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      ctx.fillStyle = '#f7931a'; ctx.font = '700 28px "Space Grotesk", system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('entekhab.net', c.width - 24, 40);
      c.toBlob(function (b) { if (b) dl(URL.createObjectURL(b), 'entekhab-liquidation-map-' + S.coin + '.png'); }, 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }
  function dl(url, name) { var a = d.createElement('a'); a.href = url; a.download = name; d.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000); }
  function share() {
    var q = new URLSearchParams(); q.set('coin', S.coin); if (V.kind === 'liqheat') q.set('range', S.range); q.set('ex', S.ex); q.set('model', S.model);
    var url = location.origin + location.pathname + '?' + q.toString();
    if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { navigator.share({ title: d.title, url: url }).catch(function () { }); return; }
    OB.copy(url).then(function (ok) { OB.toast(T(ok ? 'copied' : 'copy_fail')); });
  }

  /* ================================================================ the liquidation map (levels standing now, by price) */
  function drawMap() {
    var box = $('#ob-map', V.el), res = V.res, g = res.grid, px = V.px; if (!box) return;
    var W = Math.max(300, Math.floor(box.clientWidth || 900)), narrow = W < 560, H1 = narrow ? 250 : 340, H2 = narrow ? 130 : 170, L = narrow ? 44 : 62, R = 14, T0 = 26, GAP = 34, B = 30;
    var H = T0 + H1 + GAP + H2 + B, pw = W - L - R, wd = S.mapw / 100, p0 = px * (1 - wd), p1 = px * (1 + wd);
    var nb = Math.max(40, Math.min(160, Math.floor(pw / 6))), bs = (p1 - p0) / nb, tiers = M.TIERS, NT = tiers.length, k, r, b;
    var bl = [], bsh = []; for (k = 0; k < NT; k++) { bl.push(new Float64Array(nb)); bsh.push(new Float64Array(nb)); }
    for (r = 0; r < g.rows; r++) { var pr = M.priceOf(g, r); b = Math.floor((pr - p0) / bs); if (b < 0 || b >= nb) continue; for (k = 0; k < NT; k++) { bl[k][b] += res.longT[k][r]; bsh[k][b] += res.shortT[k][r]; } }
    var tot = new Float64Array(nb), mx = 0, sumL = 0, sumS = 0;
    for (b = 0; b < nb; b++) { for (k = 0; k < NT; k++) { tot[b] += bl[k][b] + bsh[k][b]; sumL += bl[k][b]; sumS += bsh[k][b]; } if (tot[b] > mx) mx = tot[b]; }
    /* cumulative from the price outward */
    var cumL = new Float64Array(nb), cumS = new Float64Array(nb), mid = Math.floor((px - p0) / bs), acc = 0;
    for (b = mid; b >= 0; b--) { for (k = 0; k < NT; k++) acc += bl[k][b]; cumL[b] = acc; }
    acc = 0; for (b = mid; b < nb; b++) { for (k = 0; k < NT; k++) acc += bsh[k][b]; cumS[b] = acc; }
    var cmx = Math.max(cumL[0] || 0, cumS[nb - 1] || 0);
    function X(p) { return L + (p - p0) / (p1 - p0) * pw; }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(T('aria_map', { coin: S.coin })) + '" xmlns="http://www.w3.org/2000/svg" style="direction:ltr;font-family:\'Space Grotesk\',Vazirmatn,system-ui,sans-serif">';      /* the page may be right-to-left; the chart's geometry is not */
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#0a0a0c"/>';
    function txt(x, y, anchor, t, o) { o = o || {}; return '<text x="' + x + '" y="' + y + '" text-anchor="' + anchor + '" font-size="' + (o.fs || 11) + '" fill="' + (o.fill || '#9a9a94') + '"' + (o.w ? ' font-weight="' + o.w + '"' : '') + (o.rtl ? ' direction="rtl" unicode-bidi="embed"' : '') + '>' + esc(t) + '</text>'; }
    var rtl = OB.rtl();
    /* panel 1: dollars per price band, stacked by leverage */
    var y1 = T0, yb = T0 + H1, st = niceStep(mx || 1, 4), yv;
    s += txt(rtl ? W - R : L, 15, 'start', T(narrow ? 'map_p1s' : 'map_p1'), { fill: '#e8e8e3', fs: narrow ? 11 : 12, w: 700, rtl: rtl });      /* with direction:rtl "start" is the right end */
    for (yv = 0; yv <= mx * 1.001; yv += st) { var gy = yb - (mx ? yv / mx * (H1 - 8) : 0); s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '" stroke="rgba(255,255,255,.06)"/>' + txt(L - 6, gy + 4, 'end', axUsd(yv, st)); }
    var bwid = Math.max(1, pw / nb - 2);
    for (b = 0; b < nb; b++) {
      if (!tot[b]) continue;
      var x = L + b * pw / nb + 1, yy = yb, hh;
      for (k = 0; k < NT; k++) {
        var vL = bl[k][b], vS = bsh[k][b];
        if (vL > 0) { hh = vL / mx * (H1 - 8); yy -= hh; s += '<rect x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bwid.toFixed(1) + '" height="' + Math.max(0.5, hh).toFixed(1) + '" fill="' + TIER_L[tiers[k]] + '"/>'; }
        if (vS > 0) { hh = vS / mx * (H1 - 8); yy -= hh; s += '<rect x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bwid.toFixed(1) + '" height="' + Math.max(0.5, hh).toFixed(1) + '" fill="' + TIER_S[tiers[k]] + '"/>'; }
      }
    }
    /* panel 2: cumulative dollars from the price outward */
    var y2 = yb + GAP, yb2 = y2 + H2, st2 = niceStep(cmx || 1, 3);
    s += txt(rtl ? W - R : L, y2 - 9, 'start', T('map_p2'), { fill: '#e8e8e3', fs: narrow ? 11 : 12, w: 700, rtl: rtl });
    for (yv = 0; yv <= cmx * 1.001; yv += st2) { var gy2 = yb2 - (cmx ? yv / cmx * (H2 - 8) : 0); s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy2.toFixed(1) + '" y2="' + gy2.toFixed(1) + '" stroke="rgba(255,255,255,.06)"/>' + txt(L - 6, gy2 + 4, 'end', axUsd(yv, st2)); }
    function area(arr, from, to, col) {
      var pts = [], i; for (i = from; i <= to; i++) pts.push((L + (i + 0.5) * pw / nb).toFixed(1) + ',' + (yb2 - (cmx ? arr[i] / cmx * (H2 - 8) : 0)).toFixed(1));
      if (pts.length < 2) return '';
      var xa = (L + (from + 0.5) * pw / nb).toFixed(1), xb = (L + (to + 0.5) * pw / nb).toFixed(1);
      return '<polygon points="' + xa + ',' + yb2 + ' ' + pts.join(' ') + ' ' + xb + ',' + yb2 + '" fill="' + col + '" fill-opacity=".16"/><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round"/>';
    }
    s += area(cumL, 0, mid, LONGC) + area(cumS, mid, nb - 1, SHORTC);
    /* shared price axis and the price now */
    var pst = niceStep(p1 - p0, Math.max(3, Math.floor(pw / 90))), p;
    for (p = Math.ceil(p0 / pst) * pst; p <= p1; p += pst) { var tx = X(p); if (tx < L + 20 || tx > W - R - 20) continue; s += '<line x1="' + tx.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y1="' + yb2 + '" y2="' + (yb2 + 4) + '" stroke="rgba(255,255,255,.2)"/>' + txt(tx, yb2 + 18, 'middle', OB.fmtP(p)); }
    var xp = X(px);
    s += '<line x1="' + xp.toFixed(1) + '" x2="' + xp.toFixed(1) + '" y1="' + (y1 - 4) + '" y2="' + yb2 + '" stroke="#f7931a" stroke-width="1.4"/>' +
      '<rect x="' + (xp - 34).toFixed(1) + '" y="' + (y1 - 8) + '" width="68" height="17" rx="4" fill="#f7931a"/>' + txt(xp, y1 + 4.5, 'middle', OB.fmtP(px), { fill: '#16100a', w: 700 });
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yb + '" y2="' + yb + '" stroke="rgba(255,255,255,.18)"/><line x1="' + L + '" x2="' + (W - R) + '" y1="' + yb2 + '" y2="' + yb2 + '" stroke="rgba(255,255,255,.18)"/>';
    s += '<line id="ob-mx" x1="0" x2="0" y1="' + y1 + '" y2="' + yb2 + '" stroke="rgba(255,255,255,.4)" visibility="hidden"/></svg>';
    var dirA = ' dir="' + (rtl ? 'rtl' : 'ltr') + '"';
    var legend = '<div class="ob-lgd"><span class="ob-lgd-g"' + dirA + '><b>' + esc(T('lg_long')) + '</b>' + res.tiers.map(function (t) { return '<i style="background:' + TIER_L[t] + '"></i><span class="ob-n">' + t + 'x</span>'; }).join('') + '</span>' +
      '<span class="ob-lgd-g"' + dirA + '><b>' + esc(T('lg_short')) + '</b>' + res.tiers.map(function (t) { return '<i style="background:' + TIER_S[t] + '"></i><span class="ob-n">' + t + 'x</span>'; }).join('') + '</span></div>';
    box.innerHTML = legend + '<div class="ob-map-w">' + s + '<div class="ob-tip" hidden></div></div>' +
      '<div class="ob-kpis"><div' + dirA + '><small>' + esc(T('total_long', { w: OB.loc(S.mapw) })) + '</small><b class="ob-n"><i class="ob-dot" style="background:' + LONGC + '"></i>' + esc(OB.fmtUsd(cumL[0] || 0)) + '</b></div>' +
      '<div' + dirA + '><small>' + esc(T('total_short', { w: OB.loc(S.mapw) })) + '</small><b class="ob-n"><i class="ob-dot" style="background:' + SHORTC + '"></i>' + esc(OB.fmtUsd(cumS[nb - 1] || 0)) + '</b></div></div>';
    /* hover: one read-out for the band under the pointer */
    var wrap = $('.ob-map-w', box), svg = $('svg', wrap), tip = $('.ob-tip', wrap), ln = $('#ob-mx', wrap);
    function move(e) {
      var rc = svg.getBoundingClientRect(), mxp = (e.clientX - rc.left) * (W / rc.width), my = e.clientY - rc.top, bi = Math.floor((mxp - L) / pw * nb);
      if (bi < 0 || bi >= nb) { tip.hidden = true; ln.setAttribute('visibility', 'hidden'); return; }
      var cxm = L + (bi + 0.5) * pw / nb; ln.setAttribute('x1', cxm); ln.setAttribute('x2', cxm); ln.setAttribute('visibility', 'visible');
      var lo2 = p0 + bi * bs, hi2 = lo2 + bs, isL = bi <= mid, rowsH = '';
      res.tiers.forEach(function (t) { var ki = tiers.indexOf(t), v2 = isL ? bl[ki][bi] : bsh[ki][bi]; if (v2 > 0) rowsH += '<div class="ob-tip-r"><i class="ob-dot" style="background:' + (isL ? TIER_L[t] : TIER_S[t]) + '"></i><span class="ob-n">' + t + 'x</span> <b class="ob-n">' + esc(OB.fmtUsd(v2)) + '</b></div>'; });
      tip.innerHTML = '<div class="ob-tip-t ob-n">' + esc(OB.fmtP(lo2)) + ' – ' + esc(OB.fmtP(hi2)) + ' (' + esc(OB.fmtPct(((lo2 + hi2) / 2 / px - 1) * 100)) + ')</div>' +
        '<div class="ob-tip-v"><b class="ob-n">' + esc(tot[bi] > 0 ? OB.fmtUsd(tot[bi]) : '—') + '</b><span>' + esc(T(isL ? 'tip_long' : 'tip_short')) + '</span></div>' + rowsH +
        '<div class="ob-tip-r"><span>' + esc(T('tip_cum')) + '</span> <b class="ob-n">' + esc(OB.fmtUsd(isL ? cumL[bi] : cumS[bi])) + '</b></div>';
      tip.hidden = false; tip.setAttribute('dir', rtl ? 'rtl' : 'ltr');
      var tw = tip.offsetWidth, lx = (e.clientX - rc.left) + 14; if (lx + tw > rc.width - 4) lx = (e.clientX - rc.left) - tw - 14; tip.style.left = Math.max(4, lx) + 'px'; tip.style.top = Math.max(4, Math.min(my + 12, rc.height - tip.offsetHeight - 4)) + 'px';
    }
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', function () { tip.hidden = true; ln.setAttribute('visibility', 'hidden'); });
  }

  /* ================================================================ the two views */
  function mount(kind, el) {
    V.kind = kind; V.el = el; V.chart = null; V.data = null; V.res = null;
    el.innerHTML = toolbar() +
      (kind === 'liqheat' ? '<div class="ob-stage" id="ob-stage"><div class="ob-status" id="ob-status"><span class="ob-spin"></span>' + esc(T('loading')) + '</div></div>'
        : '<div class="ob-mapbox" id="ob-stage"><div id="ob-map"></div><div class="ob-status" id="ob-status"><span class="ob-spin"></span>' + esc(T('loading')) + '</div></div>') +
      '<p class="ob-note">' + esc(T(kind === 'liqheat' ? 'note_heat' : 'note_map')) + '</p><div class="ob-cards" id="ob-cards"></div>';
    bindTools(); coinLabel();
    OB.loadLogos().then(coinLabel);
    V.onVis = function (vis) { if (vis && V.data && !V.loading && Date.now() - V.data.now > 45000) { var seq = V.seq; OB.liqRefresh(V.data).then(function () { if (seq === V.seq) compute(); }, function () { }); } };
    V.onRs = function () { if (V.kind === 'liqmap' && V.res) drawMap(); };
    OB.on('visible', V.onVis); OB.on('resize', V.onRs);
    load(true);
  }
  function unmount() { V.seq++; stopLive(); OB.off('visible', V.onVis); OB.off('resize', V.onRs); if (V.chart) V.chart.destroy(); V.chart = null; var p = d.getElementById('ob-pick'); if (p) p.remove(); p = d.getElementById('ob-mi'); if (p) p.remove(); }
  OB.views.liqheat = { mount: function (el) { mount('liqheat', el); }, unmount: unmount };
  OB.views.liqmap = { mount: function (el) { mount('liqmap', el); }, unmount: unmount };
  OB._liq = { V: V, S: S, aggLiqs: aggLiqs };
})();
