/* entekhab.net — the Observatory: /charts/defi/ — what is locked in DeFi, where it sits and what it earns.
   Data: /data/obs/defi.json (scripts/obs_defi.py, about every three hours, from DefiLlama).
   Exchange reserves are not in any figure here: money on an exchange is not locked in a protocol. */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, d = document;
  var V = { el: null, doc: null, ts: null, seq: 0 };
  var DAY = 86400000;

  function tile(label, value, sub) {
    return '<div class="ob-tile"><small>' + esc(label) + '</small><b class="ob-n">' + value +
           '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>';
  }
  function usdM(m) { return m == null || !isFinite(m) ? '—' : OB.fmtUsd(m * 1e6); }
  function pct(v, dp) {
    if (v == null || !isFinite(v)) return '—';
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(dp == null ? 2 : dp) + '%';
  }
  function cls(v) { return v > 0 ? 'ob-up' : v < 0 ? 'ob-dn' : ''; }
  function status(html, k) {
    var s = $('#ob-status', V.el);
    if (s) { s.innerHTML = html || ''; s.className = 'ob-status' + (k ? ' ' + k : ''); s.hidden = !html; }
  }
  /* a share of the widest bar, so a row's size is readable without reading the number */
  function bar(share) { return '<i class="ob-bar" style="width:' + Math.max(1, Math.round(share * 100)) + '%"></i>'; }

  function table(head, rows) {
    return '<div class="ob-tw"><table class="ob-t"><thead><tr>' +
      head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function render() {
    var doc = V.doc, el = V.el;
    if (!doc) return;
    var tvl = doc.tvl || {}, v = tvl.v || [], now = v[v.length - 1];
    var peak = 0;
    for (var i = 0; i < v.length; i++) if (v[i] > peak) peak = v[i];
    var chains = doc.chains || [], cats = doc.cats || [], protos = doc.protos || [], pools = doc.pools || [];

    $('#ob-tiles', el).innerHTML =
      tile(T('df_t_tvl'), esc(OB.ltr(usdM(now))), esc(OB.ltr(usdM(peak)) + ' ' + T('df_t_peak'))) +
      tile(T('df_t_peak'), esc(OB.ltr(peak ? (now / peak * 100).toFixed(1) + '%' : '—')), '') +
      tile(T('df_t_chain'), esc(chains.length ? chains[0].name : '—'),
           esc(chains.length ? OB.ltr(usdM(chains[0].usd)) : '')) +
      tile(T('df_t_pools'), esc(OB.loc(String((doc.counts || {}).pools || pools.length))), '');

    /* the daily series */
    var pts = [];
    if (tvl.t0 && v.length) {
      for (var j = 0; j < v.length; j++) {
        if (v[j] == null) continue;
        pts.push({ time: (tvl.t0 + j * 86400) | 0, value: +v[j] });
      }
    }
    if (V.ts) { V.ts.destroy(); V.ts = null; }
    var host = $('#ob-hist', el);
    if (host && pts.length && OB.ts) {
      V.ts = OB.ts(host, { h: 300 });
      V.ts.area(pts, { title: T('df_h_hist') });
    }

    var top = chains.length ? chains[0].usd : 1;
    $('#ob-chains', el).innerHTML = table([T('df_c_chain'), T('df_c_tvl')],
      chains.map(function (c) {
        return '<tr><td>' + bar(c.usd / top) + esc(c.name) + '</td><td dir="ltr">' + esc(usdM(c.usd)) + '</td></tr>';
      }));

    var ctop = cats.length ? cats[0].usd : 1;
    $('#ob-cats', el).innerHTML = table([T('df_c_cat'), T('df_c_tvl')],
      cats.map(function (c) {
        return '<tr><td>' + bar(c.usd / ctop) + esc(c.name) + '</td><td dir="ltr">' + esc(usdM(c.usd)) + '</td></tr>';
      }));

    $('#ob-protos', el).innerHTML = table(
      [T('df_c_name'), T('df_c_cat'), T('df_c_chain'), T('df_c_tvl'), T('df_c_1d'), T('df_c_7d')],
      protos.map(function (p) {
        return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.cat) + '</td><td>' + esc(p.chain) +
          '</td><td dir="ltr">' + esc(usdM(p.usd)) + '</td><td dir="ltr" class="' + cls(p.d1) + '">' + esc(pct(p.d1, 1)) +
          '</td><td dir="ltr" class="' + cls(p.d7) + '">' + esc(pct(p.d7, 1)) + '</td></tr>';
      }));

    $('#ob-pools', el).innerHTML = table(
      [T('df_c_pool'), T('df_c_proj'), T('df_c_chain'), T('df_c_tvl'), T('df_c_apy'),
       T('df_c_base'), T('df_c_rew'), T('df_risk')],
      pools.map(function (p) {
        var risk = [];
        if (p.stable) risk.push('<em class="ob-ok">' + esc(T('df_stable')) + '</em>');
        if (p.il) risk.push('<em class="ob-warn">' + esc(T('df_il')) + '</em>');
        return '<tr><td>' + esc(p.sym) + '</td><td>' + esc(p.proj) + '</td><td>' + esc(p.chain) +
          '</td><td dir="ltr">' + esc(usdM(p.usd)) + '</td><td dir="ltr"><b>' + esc(pct(p.apy, 2)) + '</b></td>' +
          '<td dir="ltr">' + esc(pct(p.base, 2)) + '</td><td dir="ltr">' + esc(pct(p.rew, 2)) + '</td>' +
          '<td>' + (risk.join(' ') || '—') + '</td></tr>';
      }));

    var when = String(doc.updated_at || '').slice(0, 16).replace('T', ' ');
    $('#ob-foot', el).innerHTML = esc(T('df_note')) + ' ' + esc(T('df_pool_note')) +
      ' <span dir="ltr">' + esc(when) + ' UTC</span>';
    status('');
  }

  function load(force) {
    var seq = ++V.seq;
    status('<span class="ob-wait">…</span>');
    OB.getJSON('/data/obs/defi.json' + (force ? '?t=' + Date.now() : ''), 45000).then(function (j) {
      if (seq !== V.seq) return;
      if (!j || !j.tvl) throw new Error('empty');
      V.doc = j;
      render();
    }).catch(function () {
      if (seq !== V.seq) return;
      status('<b>' + esc(T('err_view')) + '</b> <button id="ob-retry" class="ob-b">' +
             esc(T('retry')) + '</button>', 'err');
    });
  }

  function mount(el) {
    V.el = el;
    el.innerHTML =
      '<div id="ob-status" class="ob-status" hidden></div>' +
      '<div id="ob-tiles" class="ob-tiles"></div>' +
      '<h2 class="ob-h2">' + esc(T('df_h_hist')) + '</h2><div id="ob-hist" class="ob-chart"></div>' +
      '<div class="ob-two">' +
        '<div><h2 class="ob-h2">' + esc(T('df_h_chains')) + '</h2><div id="ob-chains"></div></div>' +
        '<div><h2 class="ob-h2">' + esc(T('df_h_cats')) + '</h2><div id="ob-cats"></div></div>' +
      '</div>' +
      '<h2 class="ob-h2">' + esc(T('df_h_protos')) + '</h2><div id="ob-protos"></div>' +
      '<h2 class="ob-h2">' + esc(T('df_h_pools')) + '</h2><div id="ob-pools"></div>' +
      '<p class="ob-foot" id="ob-foot"></p>';
    el.onclick = function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (b && b.id === 'ob-retry') load(true);
    };
    load();
  }
  function unmount() { V.seq++; if (V.ts) { V.ts.destroy(); V.ts = null; } V.doc = null; }
  OB.views.defi = { mount: mount, unmount: unmount };
})();
