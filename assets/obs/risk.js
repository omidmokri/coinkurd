/* entekhab.net — the Observatory: /charts/risk/ — how much a position can lose, and how large it may be.
   Data: /data/obs/chain_btc.json and chain_eth.json (daily closes the site already keeps, Coin Metrics).
   Arithmetic: assets/obs/riskmath.js. Everything is measured on what actually happened; the normal-curve figure
   is shown only beside the measured one, to show where it falls short. */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, d = document, M = window.OBRisk;
  var ACC = '#f0b429', RED = '#ff5a4d', INK = '#e8e8e3';
  var COINS = ['BTC', 'ETH'], WINDOWS = ['1y', '3y', 'all'], DAYS = { '1y': 365, '3y': 1095 };
  var DEF = { coin: 'BTC', win: '3y', account: 10000, riskPct: 1, entry: 0, stop: 0 };
  var S = (function () {
    var s = OB.store.get('ek_obs_risk', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    var q = new URLSearchParams(location.search);
    if (COINS.indexOf(q.get('coin')) >= 0) o.coin = q.get('coin');
    if (WINDOWS.indexOf(q.get('win')) >= 0) o.win = q.get('win');
    return o;
  })();
  var save = OB.debounce(function () { OB.store.set('ek_obs_risk', S); }, 300);
  var V = { el: null, files: {}, px: null, seq: 0 };

  function tile(label, value, sub, cls) {
    return '<div class="ob-tile"><small>' + esc(label) + '</small><b class="ob-n"' +
      (cls ? ' style="color:' + cls + '"' : '') + '>' + value + '</b>' +
      (sub ? '<span>' + sub + '</span>' : '') + '</div>';
  }
  function pc(v, dp) { return v == null || !isFinite(v) ? '—' : (v * 100).toFixed(dp == null ? 1 : dp) + '%'; }
  function money(v) { return v == null || !isFinite(v) ? '—' : '$' + OB.compact(v); }
  function status(h, k) { var s = $('#ob-status', V.el); if (s) { s.innerHTML = h || ''; s.className = 'ob-status' + (k ? ' ' + k : ''); s.hidden = !h; } }

  function prices() {
    var doc = V.files[S.coin];
    if (!doc) return null;
    var col = (doc.cols || {}).price;
    if (!col || !col.v) return null;
    var all = col.v, keep = DAYS[S.win];
    return keep ? all.slice(Math.max(0, all.length - keep - 1)) : all;
  }

  function render() {
    var el = V.el, px = prices();
    if (!px || px.length < 30) { status('<b>' + esc(T('err_view')) + '</b>', 'err'); return; }
    var rets = M.returns(px);
    var v95 = M.varHist(rets, 0.95), v99 = M.varHist(rets, 0.99);
    var n95 = M.varNormal(rets, 0.95), es95 = M.shortfall(rets, 0.95);
    var dd = M.drawdown(px), vol = M.vol(rets);

    $('#ob-tiles', el).innerHTML =
      tile(T('rk_t_var95'), esc(OB.ltr(pc(v95, 2))), esc(T('rk_t_var_s', { n: OB.loc(String(rets.length)) })), RED) +
      tile(T('rk_t_var99'), esc(OB.ltr(pc(v99, 2))), esc(T('rk_t_es', { v: OB.ltr(pc(es95, 2)) })), RED) +
      tile(T('rk_t_vol'), esc(OB.ltr(pc(vol, 0))), esc(T('rk_t_vol_s'))) +
      tile(T('rk_t_dd'), esc(OB.ltr(pc(dd.worst, 1))), esc(T('rk_t_dd_s', { v: OB.ltr(pc(dd.now, 1)) })), RED);

    /* the measured figure beside the curve's, over the horizons that matter */
    var rows = [[1, T('rk_h_1')], [7, T('rk_h_7')], [30, T('rk_h_30')]].map(function (h) {
      var hr = h[0] === 1 ? rets : M.horizonReturns(px, h[0]);
      return '<tr><td>' + esc(h[1]) + '</td>' +
        '<td class="ob-n"><b>' + esc(OB.ltr(pc(M.varHist(hr, 0.95), 2))) + '</b></td>' +
        '<td class="ob-n"><b>' + esc(OB.ltr(pc(M.varHist(hr, 0.99), 2))) + '</b></td>' +
        '<td class="ob-n">' + esc(OB.ltr(pc(M.shortfall(hr, 0.95), 2))) + '</td>' +
        '<td class="ob-n ob-dim">' + esc(OB.ltr(pc(M.varNormal(hr, 0.95), 2))) + '</td></tr>';
    }).join('');
    $('#ob-horizons', el).innerHTML =
      '<div class="ob-tblw"><table class="ob-grid"><thead><tr><th style="text-align:start">' + esc(T('rk_c_hz')) +
      '</th><th>' + esc(T('rk_c_95')) + '</th><th>' + esc(T('rk_c_99')) + '</th><th>' + esc(T('rk_c_es')) +
      '</th><th>' + esc(T('rk_c_norm')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';

    drawHist(rets, v95);
    sizing();
    OB.ui.setSeg(el, 'ob-c', S.coin);
    OB.ui.setSeg(el, 'ob-w', S.win);
    status('');
  }

  /* where the losses sit, with the 95% cut marked: the shape of the tail, not a number about it */
  function drawHist(rets, cut) {
    var host = $('#ob-hist', V.el);
    if (!host) return;
    var bins = M.histogram(rets, 61), max = 0;
    bins.forEach(function (b) { if (b.n > max) max = b.n; });
    if (!max) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="ob-rkbars">' + bins.map(function (b) {
      var mid = (b.x0 + b.x1) / 2, bad = mid <= -cut;
      return '<i style="height:' + Math.max(1, b.n / max * 100).toFixed(1) + '%;background:' +
        (bad ? RED : mid < 0 ? 'rgba(255,90,77,.42)' : 'rgba(52,211,153,.5)') + '" title="' +
        esc(OB.ltr((mid * 100).toFixed(1) + '% · ' + b.n)) + '"></i>';
    }).join('') + '</div><p class="ob-rklegend"><span style="color:' + RED + '">■</span> ' +
      esc(T('rk_legend', { v: OB.ltr(pc(cut, 2)) })) + '</p>';
  }

  function sizing() {
    var el = V.el;
    var r = M.size(S.account, S.riskPct, S.entry, S.stop);
    var out = $('#ob-size-out', el);
    if (!r) { out.innerHTML = '<p class="ob-note">' + esc(T('rk_fill')) + '</p>'; return; }
    var px = prices(), rets = px ? M.returns(px) : [], v95 = rets.length ? M.varHist(rets, 0.95) : null;
    var dayLoss = v95 == null ? null : r.value * v95;
    out.innerHTML =
      '<div class="ob-tiles">' +
        tile(T('rk_s_units'), esc(OB.ltr(r.units < 1 ? r.units.toFixed(6) : r.units.toFixed(3))), esc(S.coin)) +
        tile(T('rk_s_value'), esc(OB.ltr(money(r.value))), esc(T('rk_s_lev', { v: OB.ltr(r.leverage.toFixed(2)) }))) +
        tile(T('rk_s_risk'), esc(OB.ltr(money(r.risk))), esc(T('rk_s_stop', { v: OB.ltr(r.stopPct.toFixed(2) + '%') })), RED) +
        tile(T('rk_s_day'), esc(OB.ltr(money(dayLoss))), esc(T('rk_s_day_s')), RED) +
      '</div>' +
      (r.leverage > 3 ? '<p class="ob-warn-box">' + esc(T('rk_s_warn', { v: OB.ltr(r.leverage.toFixed(1)) })) + '</p>' : '');
  }

  function load(force) {
    var seq = ++V.seq;
    status('<span class="ob-spin"></span>' + esc(T('loading')));
    var f = S.coin.toLowerCase();
    OB.getJSON('/data/obs/chain_' + f + '.json' + (force ? '?t=' + Date.now() : ''), 45000).then(function (j) {
      if (seq !== V.seq) return;
      if (!j || !j.cols || !j.cols.price) throw new Error('empty');
      V.files[S.coin] = j;
      render();
    }).catch(function () {
      if (seq !== V.seq) return;
      status('<b>' + esc(T('err_view')) + '</b> <button type="button" class="ob-b" id="ob-retry">' + esc(T('retry')) + '</button>', 'err');
    });
  }

  function num(id) { var e = $('#' + id, V.el); return e ? parseFloat(String(e.value).replace(/[^0-9.]/g, '')) || 0 : 0; }

  function mount(el) {
    V.el = el;
    el.innerHTML =
      '<div class="ob-top"><div class="ob-tools">' +
        '<label class="ob-lbl"><span>' + esc(T('asset')) + '</span>' +
          OB.ui.seg('ob-c', COINS.map(function (c) { return [c, c]; }), S.coin) + '</label>' +
        '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' +
          OB.ui.seg('ob-w', WINDOWS.map(function (w) { return [w, T('cr_' + w)]; }), S.win, 'ob-rng') + '</label>' +
        OB.ui.acts() +
      '</div></div>' +
      '<div class="ob-tiles" id="ob-tiles"></div>' +
      '<div id="ob-status" class="ob-status" hidden></div>' +
      '<h3 class="ob-dfh">' + esc(T('rk_h_hist')) + '</h3><div id="ob-hist" class="ob-rkhist"></div>' +
      '<h3 class="ob-dfh">' + esc(T('rk_h_table')) + '</h3><div id="ob-horizons"></div>' +
      '<h3 class="ob-dfh">' + esc(T('rk_h_size')) + '</h3>' +
      '<div class="ob-rkform">' +
        '<label><span>' + esc(T('rk_f_account')) + '</span><input id="rk-acct" type="number" min="0" step="any" inputmode="decimal" value="' + S.account + '"></label>' +
        '<label><span>' + esc(T('rk_f_risk')) + '</span><input id="rk-risk" type="number" min="0" max="100" step="any" inputmode="decimal" value="' + S.riskPct + '"></label>' +
        '<label><span>' + esc(T('rk_f_entry')) + '</span><input id="rk-entry" type="number" min="0" step="any" inputmode="decimal" value="' + (S.entry || '') + '"></label>' +
        '<label><span>' + esc(T('rk_f_stop')) + '</span><input id="rk-stop" type="number" min="0" step="any" inputmode="decimal" value="' + (S.stop || '') + '"></label>' +
      '</div><div id="ob-size-out"></div>' +
      '<p class="ob-note" id="ob-note">' + esc(T('rk_note')) + '</p>';
    el.oninput = function (e) {
      if (!/^rk-/.test(e.target.id)) return;
      S.account = num('rk-acct'); S.riskPct = num('rk-risk');
      S.entry = num('rk-entry'); S.stop = num('rk-stop');
      save(); sizing();
    };
    el.onclick = function (e) {
      var b = e.target.closest && e.target.closest('button'); if (!b || !el.contains(b)) return;
      var seg = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null, v = b.getAttribute('data-v');
      if (seg === 'ob-c' && v !== S.coin) { S.coin = v; OB.ui.setSeg(el, 'ob-c', v); save(); V.files[v] ? render() : load(); }
      else if (seg === 'ob-w' && v !== S.win) { S.win = v; OB.ui.setSeg(el, 'ob-w', v); save(); render(); }
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') load(true);
      else if (b.id === 'ob-full') OB.fullscreen(d.getElementById('ob'));
      else if (b.id === 'ob-share') OB.ui.share({ coin: S.coin, win: S.win });
    };
    load();
  }
  function unmount() { V.seq++; V.files = {}; }
  OB.views.risk = { mount: mount, unmount: unmount };
})();
