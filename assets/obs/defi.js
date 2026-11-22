/* entekhab.net — the Observatory: /charts/defi/ — what is locked in DeFi, where it sits and what it earns.
   Data: /data/obs/defi.json (scripts/obs_defi.py, about every three hours, from DefiLlama).
   Exchange reserves are in no figure here: money on an exchange is not locked in a protocol.
   The chart is the site's own OB.TS; the tables carry a bar behind the first cell so a row's size reads at a glance. */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, d = document;
  var INK = '#e8e8e3', ACC = '#f0b429', GRN = '#34d399', RED = '#ff5a4d', BLUE = '#60a5fa';
  var RANGES = ['1y', '3y', 'all'], SPAN = { '1y': 365, '3y': 1095 };
  var DEF = { range: 'all', log: false, pool: 'all' };
  var S = (function () {
    var s = OB.store.get('ek_obs_defi', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    var q = new URLSearchParams(location.search);
    if (RANGES.indexOf(q.get('range')) >= 0) o.range = q.get('range');
    if (['all', 'stable', 'safe'].indexOf(q.get('pool')) >= 0) o.pool = q.get('pool');
    return o;
  })();
  var save = OB.debounce(function () { OB.store.set('ek_obs_defi', S); }, 300);
  var V = { el: null, doc: null, ts: null, seq: 0, loading: false };

  function tile(label, value, sub, id) {
    return '<div class="ob-tile"' + (id ? ' id="' + id + '"' : '') + '><small>' + esc(label) +
      '</small><b class="ob-n">' + value + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>';
  }
  function status(html, k) {
    var s = $('#ob-status', V.el);
    if (s) { s.innerHTML = html || ''; s.className = 'ob-status' + (k ? ' ' + k : ''); s.hidden = !html; }
  }
  function usdM(m) { return m == null || !isFinite(m) ? '—' : '$' + OB.compact(m * 1e6); }
  function pct(v, dp) {
    if (v == null || !isFinite(v)) return '—';
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(dp == null ? 1 : dp) + '%';
  }
  function mv(v) { return v > 0 ? GRN : v < 0 ? RED : 'inherit'; }
  /* a tinted bar behind the first cell, so the shape of a table is visible before any number is read */
  function cell(name, share, color) {
    return '<td class="ob-dfn"><i class="ob-dfbar" style="width:' + Math.max(1.5, share * 100).toFixed(1) +
      '%;background:' + color + '"></i><span>' + esc(name) + '</span></td>';
  }
  function grid(head, rows, id) {
    return '<div class="ob-tblw"><table class="ob-grid"' + (id ? ' id="' + id + '"' : '') + '><thead><tr>' +
      head.map(function (h, i) { return '<th' + (i ? '' : ' style="text-align:start"') + '>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + (rows.join('') || '<tr><td colspan="' + head.length + '">—</td></tr>') + '</tbody></table></div>';
  }

  function series(doc) {
    var t = doc.tvl || {}, v = t.v || [], out = [];
    var keep = SPAN[S.range] || v.length, from = Math.max(0, v.length - keep);
    for (var i = from; i < v.length; i++) if (v[i] != null) out.push([(t.t0 + i * 86400) * 1000, +v[i]]);
    return out;
  }

  function drawChart(doc) {
    if (!V.ts) return;
    var data = series(doc);
    V.ts.set({
      daily: true, label: T('df_h_hist'),
      panes: [{
        weight: 3, log: S.log, title: T('df_t_tvl'),
        fmt: function (x) { return '$' + OB.compact(x * 1e6); },
        series: [{ name: T('df_t_tvl'), type: 'area', color: ACC, width: 1.8, data: data }]
      }]
    });
  }

  function pools(doc) {
    var a = doc.pools || [];
    if (S.pool === 'stable') a = a.filter(function (p) { return p.stable; });
    else if (S.pool === 'safe') a = a.filter(function (p) { return !p.il; });
    return a;
  }

  function render() {
    var doc = V.doc, el = V.el;
    if (!doc) return;
    var v = (doc.tvl || {}).v || [], now = v.length ? v[v.length - 1] : null, peak = 0, peakI = -1;
    for (var i = 0; i < v.length; i++) if (v[i] > peak) { peak = v[i]; peakI = i; }
    var yr = v.length > 365 ? v[v.length - 366] : null, chg = yr ? (now / yr - 1) * 100 : null;
    var chains = doc.chains || [], cats = doc.cats || [], protos = doc.protos || [], cnt = doc.counts || {};
    var peakDay = peakI >= 0 ? new Date((doc.tvl.t0 + peakI * 86400) * 1000).toISOString().slice(0, 7) : '—';

    $('#ob-tiles', el).innerHTML =
      tile(T('df_t_tvl'), esc(OB.ltr(usdM(now))),
           chg == null ? '' : '<span style="color:' + mv(chg) + '">' + esc(OB.ltr(pct(chg))) + '</span> ' + esc(T('df_t_yr'))) +
      tile(T('df_t_peak'), esc(OB.ltr(peak ? (now / peak * 100).toFixed(1) + '%' : '—')),
           esc(OB.ltr(usdM(peak) + ' · ' + peakDay))) +
      tile(T('df_t_chain'), esc(chains.length ? chains[0].name : '—'),
           esc(OB.ltr(chains.length ? usdM(chains[0].usd) + ' · ' + (now ? (chains[0].usd / now * 100).toFixed(0) + '%' : '') : ''))) +
      tile(T('df_t_protos'), esc(OB.loc(String(cnt.protocols || protos.length))),
           esc(T('df_t_pools_n', { n: OB.loc(String(cnt.pools || 0)) })));

    drawChart(doc);

    var cTop = chains.length ? chains[0].usd : 1;
    $('#ob-chains', el).innerHTML = grid([T('df_c_chain'), T('df_c_tvl'), T('df_c_share')],
      chains.map(function (c) {
        return '<tr>' + cell(c.name, c.usd / cTop, 'rgba(240,180,41,.22)') +
          '<td class="ob-n">' + esc(OB.ltr(usdM(c.usd))) + '</td>' +
          '<td class="ob-n">' + esc(OB.ltr(now ? (c.usd / now * 100).toFixed(1) + '%' : '—')) + '</td></tr>';
      }));

    var kTop = cats.length ? cats[0].usd : 1;
    $('#ob-cats', el).innerHTML = grid([T('df_c_cat'), T('df_c_tvl'), T('df_c_share')],
      cats.map(function (c) {
        return '<tr>' + cell(c.name, c.usd / kTop, 'rgba(96,165,250,.22)') +
          '<td class="ob-n">' + esc(OB.ltr(usdM(c.usd))) + '</td>' +
          '<td class="ob-n">' + esc(OB.ltr(now ? (c.usd / now * 100).toFixed(1) + '%' : '—')) + '</td></tr>';
      }));

    var pTop = protos.length ? protos[0].usd : 1;
    $('#ob-protos', el).innerHTML = grid(
      [T('df_c_name'), T('df_c_cat'), T('df_c_chain'), T('df_c_tvl'), T('df_c_1d'), T('df_c_7d')],
      protos.map(function (p) {
        return '<tr>' + cell(p.name, p.usd / pTop, 'rgba(52,211,153,.18)') +
          '<td>' + esc(p.cat) + '</td><td>' + esc(p.chain) + '</td>' +
          '<td class="ob-n">' + esc(OB.ltr(usdM(p.usd))) + '</td>' +
          '<td class="ob-n" style="color:' + mv(p.d1) + '">' + esc(OB.ltr(pct(p.d1))) + '</td>' +
          '<td class="ob-n" style="color:' + mv(p.d7) + '">' + esc(OB.ltr(pct(p.d7))) + '</td></tr>';
      }));

    var list = pools(doc), aTop = list.length ? list[0].apy : 1;
    $('#ob-pools', el).innerHTML = grid(
      [T('df_c_pool'), T('df_c_proj'), T('df_c_chain'), T('df_c_tvl'), T('df_c_apy'), T('df_c_base'), T('df_c_rew'), T('df_risk')],
      list.map(function (p) {
        var tags = (p.stable ? '<em class="ob-dftag ok">' + esc(T('df_stable')) + '</em>' : '') +
                   (p.il ? '<em class="ob-dftag warn">' + esc(T('df_il')) + '</em>' : '');
        return '<tr>' + cell(p.sym, Math.min(1, p.apy / (aTop || 1)), 'rgba(240,180,41,.18)') +
          '<td>' + esc(p.proj) + '</td><td>' + esc(p.chain) + '</td>' +
          '<td class="ob-n">' + esc(OB.ltr(usdM(p.usd))) + '</td>' +
          '<td class="ob-n"><b>' + esc(OB.ltr(pct(p.apy, 2))) + '</b></td>' +
          '<td class="ob-n">' + esc(OB.ltr(pct(p.base, 2))) + '</td>' +
          '<td class="ob-n">' + esc(OB.ltr(pct(p.rew, 2))) + '</td>' +
          '<td>' + (tags || '—') + '</td></tr>';
      }));

    $('#ob-note', el).innerHTML = esc(T('df_note')) + ' ' + esc(T('df_pool_note')) +
      ' <span dir="ltr">' + esc(String(doc.updated_at || '').slice(0, 16).replace('T', ' ')) + ' UTC</span>';
    OB.ui.setSeg(el, 'ob-r', S.range);
    OB.ui.setSeg(el, 'ob-sc', S.log ? 'log' : 'lin');
    OB.ui.setSeg(el, 'ob-pf', S.pool);
    status('');
  }

  function load(force) {
    var seq = ++V.seq; V.loading = true;
    status('<span class="ob-spin"></span>' + esc(T('loading')));
    OB.getJSON('/data/obs/defi.json' + (force ? '?t=' + Date.now() : ''), 45000).then(function (j) {
      if (seq !== V.seq) return;
      if (!j || !j.tvl) throw new Error('empty');
      V.doc = j; V.loading = false; render();
    }).catch(function () {
      if (seq !== V.seq) return;
      V.loading = false;
      status('<b>' + esc(T('err_view')) + '</b> <button type="button" class="ob-b" id="ob-retry">' +
             esc(T('retry')) + '</button>', 'err');
    });
  }

  function mount(el) {
    V.el = el;
    el.innerHTML =
      '<div class="ob-top"><div class="ob-tools">' +
        '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' +
          OB.ui.seg('ob-r', RANGES.map(function (k) { return [k, T('cr_' + k)]; }), S.range, 'ob-rng') + '</label>' +
        '<label class="ob-lbl"><span>' + esc(T('scale')) + '</span>' +
          OB.ui.seg('ob-sc', [['log', T('sc_log')], ['lin', T('sc_lin')]], S.log ? 'log' : 'lin') + '</label>' +
        OB.ui.acts() +
      '</div></div>' +
      '<div class="ob-tiles" id="ob-tiles"></div>' +
      '<div class="ob-tsbox"><div class="ob-ts" id="ob-ts"></div><div class="ob-status" id="ob-status"></div></div>' +
      '<div class="ob-dfcols">' +
        '<section><h3 class="ob-dfh">' + esc(T('df_h_chains')) + '</h3><div id="ob-chains"></div></section>' +
        '<section><h3 class="ob-dfh">' + esc(T('df_h_cats')) + '</h3><div id="ob-cats"></div></section>' +
      '</div>' +
      '<h3 class="ob-dfh">' + esc(T('df_h_protos')) + '</h3><div id="ob-protos"></div>' +
      '<div class="ob-dfbar2"><h3 class="ob-dfh">' + esc(T('df_h_pools')) + '</h3>' +
        OB.ui.seg('ob-pf', [['all', T('df_f_all')], ['stable', T('df_f_stable')], ['safe', T('df_f_safe')]], S.pool, 'ob-rng') +
      '</div><div id="ob-pools"></div>' +
      '<p class="ob-note" id="ob-note"></p>';
    V.ts = new OB.TS($('#ob-ts', el));      /* made at once: it gives the page its height while the data loads */
    el.onclick = function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b || !el.contains(b)) return;
      var seg = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null;
      var v = b.getAttribute('data-v');
      if (seg === 'ob-r' && v !== S.range) { S.range = v; OB.ui.setSeg(el, 'ob-r', v); save(); drawChart(V.doc); }
      else if (seg === 'ob-sc') { S.log = v === 'log'; OB.ui.setSeg(el, 'ob-sc', v); save(); drawChart(V.doc); }
      else if (seg === 'ob-pf' && v !== S.pool) { S.pool = v; OB.ui.setSeg(el, 'ob-pf', v); save(); render(); }
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') load(true);
      else if (b.id === 'ob-full') OB.fullscreen(d.getElementById('ob'));
      else if (b.id === 'ob-png') { if (V.ts && V.doc) V.ts.png(T('df_t_tvl'), T('df_h_hist'), 'entekhab-defi.png'); }
      else if (b.id === 'ob-share') OB.ui.share({ range: S.range, pool: S.pool });
    };
    load();
  }
  function unmount() { V.seq++; if (V.ts) { V.ts.destroy(); V.ts = null; } V.doc = null; }
  OB.views.defi = { mount: mount, unmount: unmount };
})();
