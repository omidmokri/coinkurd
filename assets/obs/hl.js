/* entekhab.net — the Observatory: /charts/hyperliquid/ — where real positions on Hyperliquid would be liquidated.
   Data: /data/obs/hl_liq.json (scripts/obs_hl.py, about once an hour): Hyperliquid publishes every account's positions with
   their liquidation prices; CI reads as many accounts as fit in a few minutes (the largest and the most active) and keeps,
   per coin, each position's liquidation price, its size in dollars and its side, and how much of Hyperliquid's open
   interest the accounts read hold. Nothing is modelled or added for the accounts not read: the coverage is on the page.
   Arithmetic: assets/obs/flowmath.js (hlBins, hlNear). The bars: OB.Bars (assets/obs/opt.js). */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, d = document, w = window, F = w.OBFlow;
  var INK = '#e8e8e3', GRN = '#34d399', RED = '#ff5a4d', NB = 64, ZOOM = [5, 10, 20, 30];
  var DEF = { coin: 'BTC', zoom: 10 };
  var S = (function () {
    var s = OB.store.get('ek_obs_hl', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    var q = new URLSearchParams(location.search), v = q.get('coin');
    if (v && /^[A-Z0-9]{1,14}$/.test(v)) o.coin = v;
    if (ZOOM.indexOf(+q.get('zoom')) >= 0) o.zoom = +q.get('zoom');
    return o;
  })();
  var save = OB.debounce(function () { OB.store.set('ek_obs_hl', S); }, 300);
  var V = { el: null, chart: null, doc: null, seq: 0, timer: null, sub: '', loading: false };

  function tile(label, value, sub, id) { return '<div class="ob-tile"' + (id ? ' id="' + id + '"' : '') + '><small>' + esc(label) + '</small><b class="ob-n">' + value + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>'; }
  function status(html, cls) { var s = $('#ob-status', V.el); if (s) { s.innerHTML = html || ''; s.className = 'ob-status' + (cls ? ' ' + cls : ''); s.hidden = !html; } }
  function usd(v) { return v == null || !isFinite(v) ? '—' : OB.fmtUsd(v); }
  function px(v) { return v == null || !isFinite(v) ? '—' : '$' + OB.fmtP(v); }
  function pctS(v, dp) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(dp == null ? 1 : dp) + '%'; }
  function utc(iso) { return iso ? String(iso).slice(0, 16).replace('T', ' ') + ' UTC' : '—'; }
  /* the coins of the file that have their own logo on the site, in the file's order (largest open interest first) */
  function coins() { var c = (V.doc && V.doc.coins) || {}; return Object.keys(c).filter(function (k) { return OB.hasLogo(k) !== false; }); }

  function render() {
    var doc = V.doc, el = V.el; if (!doc) return;
    var list = coins(); if (!list.length) { status('<b>' + esc(T('hl_none')) + '</b>', 'err'); return; }
    if (list.indexOf(S.coin) < 0) S.coin = list.indexOf('BTC') >= 0 ? 'BTC' : list[0];
    $('#ob-cpick', el).innerHTML = OB.ui.seg('ob-c', list.map(function (k) { return [k, OB.logo(k, 16) + '<span>' + esc(k) + '</span>']; }), S.coin, 'ob-coins', true);
    var c = doc.coins[S.coin], mark = c.mark, z = S.zoom / 100, a = doc.accounts || {};
    var bins = F.hlBins(c.pos, mark, z, NB), n5 = F.hlNear(c.pos, mark, 5), n10 = F.hlNear(c.pos, mark, 10);
    var covL = c.oi > 0 ? c.long / c.oi * 100 : null, covS = c.oi > 0 ? c.short / c.oi * 100 : null;
    $('#ob-tiles', el).innerHTML =
      tile(T('hl_t_down'), esc(usd(n5.long)), esc(T('hl_t_10', { v: OB.ltr(usd(n10.long)) })), 'ob-t-hdn') +
      tile(T('hl_t_up'), esc(usd(n5.short)), esc(T('hl_t_10', { v: OB.ltr(usd(n10.short)) })), 'ob-t-hup') +
      tile(T('hl_t_cov'), esc(OB.ltr((covL == null ? '—' : covL.toFixed(1) + '%') + ' · ' + (covS == null ? '—' : covS.toFixed(1) + '%'))), esc(T('hl_t_cov_s')), 'ob-t-hcov') +
      tile(T('hl_t_acc'), esc(OB.loc((a.read || 0).toLocaleString('en-US'))), esc(T('hl_t_acc_s', { n: OB.loc((a.listed || 0).toLocaleString('en-US')), t: OB.ltr(utc(doc.updated_at)) })), 'ob-t-hacc');
    var cats = bins.map(function (b) { return OB.fmtP(b.mid); }), slot = (mark - mark * (1 - z)) / (2 * mark * z) * NB - 0.5;
    V.sub = S.coin + ' · ±' + S.zoom + '% · Hyperliquid · ' + utc(doc.updated_at);
    V.chart.set({ cats: cats, stacked: false, fmt: function (v) { return '$' + OB.compact(v); }, label: T('aria_hl', { coin: S.coin }),
      series: [{ name: T('hl_longs'), color: RED, data: bins.map(function (b) { return b.long; }) }, { name: T('hl_shorts'), color: GRN, data: bins.map(function (b) { return b.short; }) }],
      vmarks: [{ pos: slot, color: INK, label: T('hl_mark') + ' ' + OB.ltr(px(mark)) }],
      tip: function (i) {
        var b = bins[i];
        return '<div class="ob-tip-t">' + esc(px(b.lo)) + ' – ' + esc(px(b.hi)) + ' · ' + esc(pctS((b.mid / mark - 1) * 100)) + '</div>' +
          '<div class="ob-tip-r"><i class="ob-key" style="background:' + RED + '"></i>' + esc(T('hl_longs')) + '<b class="ob-n">' + esc(usd(b.long)) + ' · ' + OB.loc(b.nl) + '</b></div>' +
          '<div class="ob-tip-r"><i class="ob-key" style="background:' + GRN + '"></i>' + esc(T('hl_shorts')) + '<b class="ob-n">' + esc(usd(b.short)) + ' · ' + OB.loc(b.ns) + '</b></div>';
      } });
    /* the largest positions read (no addresses: sizes, prices and leverage only) */
    var rows = (c.top || []).map(function (p) {
      var dist = p[3] ? (p[3] / mark - 1) * 100 : null;
      return '<tr><td class="' + (p[0] > 0 ? 'up' : 'dn') + '">' + esc(T(p[0] > 0 ? 'hl_long' : 'hl_short')) + '</td><td class="ob-n">' + esc(usd(p[1])) + '</td><td class="ob-n">' + esc(px(p[2])) +
        '</td><td class="ob-n">' + esc(p[3] ? px(p[3]) : T('hl_free')) + '</td><td class="ob-n">' + esc(pctS(dist)) + '</td><td class="ob-n">' + (p[4] ? esc(OB.loc(p[4] + '×')) : '—') + '</td></tr>';
    }).join('');
    $('#ob-tbl', el).innerHTML = '<h3>' + esc(T('hl_tbl', { coin: S.coin })) + '</h3><div class="ob-tblw"><table class="ob-grid" id="ob-htbl"><thead><tr><th>' + esc(T('th_side')) + '</th><th>' + esc(T('th_value')) + '</th><th>' + esc(T('hl_entry')) +
      '</th><th>' + esc(T('hl_liqpx')) + '</th><th>' + esc(T('hl_dist')) + '</th><th>' + esc(T('hl_lev')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    $('#ob-tbl', el).hidden = !rows;
    $('#ob-note', el).textContent = T('note_hl') + ' ' + T('hl_counts', { l: OB.loc(c.n_long), s: OB.loc(c.n_short), f: OB.loc(c.n_free) });
    OB.ui.setSeg(el, 'ob-z', String(S.zoom));
  }
  function load(force) {
    var seq = ++V.seq; V.loading = true;
    if (!V.doc) status('<span class="ob-spin"></span>' + esc(T('loading3')));
    Promise.all([OB.getJSON('/data/obs/hl_liq.json' + (force ? '?t=' + Date.now() : ''), 45000), OB.loadLogos().catch(function () { return null; })]).then(function (r) {
      if (seq !== V.seq) return;
      var j = r[0]; V.loading = false;
      if (!j || !j.coins || !Object.keys(j.coins).length) throw Object.assign(new Error('empty'), { status: 404 });
      V.doc = j; status(''); render();
    }).catch(function (e) {
      if (seq !== V.seq) return; V.loading = false; if (w.console) console.warn(e);
      if (V.doc) return;
      status('<b>' + esc(T(e && e.status === 404 ? 'no_file' : 'err_file')) + '</b><br><span>' + esc(T(e && e.status === 404 ? 'no_file2_d' : 'err_file_d')) + '</span><br><button type="button" class="ob-btn" id="ob-retry">' + esc(T('retry')) + '</button>', 'err');
    });
  }
  function mount(el) {
    V.el = el; V.doc = null;
    el.innerHTML = '<div class="ob-tools"><div class="ob-lbl ob-cpick" id="ob-cpick"></div>' +
      '<label class="ob-lbl"><span>' + esc(T('hl_zoom')) + '</span>' + OB.ui.seg('ob-z', ZOOM.map(function (k) { return [String(k), '±' + k + '%']; }), String(S.zoom), 'ob-num') + '</label>' +
      OB.ui.acts() + '</div><div class="ob-tiles" id="ob-tiles"></div><div class="ob-tsbox"><div class="ob-ts" id="ob-ts"></div><div class="ob-status" id="ob-status"></div></div>' +
      '<p class="ob-note" id="ob-note"></p><div class="ob-tblbox" id="ob-tbl" hidden></div>';
    V.chart = new OB.Bars($('#ob-ts', el));
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      var seg = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null, v = b.getAttribute('data-v');
      if (seg === 'ob-c' && v !== S.coin) { S.coin = v; save(); render(); }
      else if (seg === 'ob-z' && +v !== S.zoom) { S.zoom = +v; save(); render(); }
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') load(true);
      else if (b.id === 'ob-full') OB.fullscreen(d.getElementById('ob'));
      else if (b.id === 'ob-png') { if (V.doc) V.chart.png(S.coin + ' · ' + T('tab_hl'), V.sub, 'entekhab-hyperliquid-' + S.coin + '.png'); }
      else if (b.id === 'ob-share') OB.ui.share({ coin: S.coin, zoom: String(S.zoom) });
    };
    clearInterval(V.timer);
    V.timer = setInterval(function () { if (!d.hidden && !V.loading) load(true); }, 10 * 60000);       /* the file changes about once an hour */
    load();
  }
  function unmount() { V.seq++; clearInterval(V.timer); if (V.chart) V.chart.destroy(); V.chart = null; }
  OB.views.hl = { mount: mount, unmount: unmount };
  OB._hl = { V: V, S: S };
})();
