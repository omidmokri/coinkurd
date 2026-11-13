/* entekhab.net — the market map: ETFs and institutions (/etf/), the SoSoValue-style desk.
   * US spot Bitcoin and Ether ETFs: daily net flow of every fund (US$ millions, Farside Investors' public tables, read by
     CI into data/etf.json), the total, five and 21 trading days, cumulative since launch and the current streak.
   * Public companies holding BTC and ETH (CoinGecko public treasuries).
   * Sector movers (share of the market and change over the chosen timeframe) and the distribution of ups and downs,
     computed live from the coin universe.
   A day the funds have not reported yet is not shown as zero. Not financial advice. */
(function () {
  'use strict';
  var MM = window.MM, d = document, S = MM.S, D = MM.D, T = MM.T, esc = MM.esc, h = MM.h;
  var V = MM.views.etf = {};
  var st = null;

  function m(v) { return v == null ? '—' : (v > 0 ? '+' : v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 }) + 'M'; }
  function mb(v) { return v == null ? '—' : Math.abs(v) >= 1000 ? (v > 0 ? '+' : v < 0 ? '-' : '') + '$' + (Math.abs(v) / 1000).toFixed(2) + 'B' : m(v); }

  function kpis(x) {
    var k = function (lbl, val, sub, cls) { return '<div class="mm-kpi' + (cls ? ' ' + cls : '') + '"><small>' + esc(lbl) + '</small><b class="mm-n">' + val + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>'; };
    var sk = x.streak || 0;
    return '<div class="mm-kpis">' +
      k(T('e_last'), mb(x.last.t), esc(MM.fmtDate(x.last.d)), MM.cls(x.last.t)) +
      k(T('e_w5'), mb(x.w5.t), esc(T('e_w5s')), MM.cls(x.w5.t)) +
      k(T('e_w21'), mb(x.w21.t), esc(T('e_w21s')), MM.cls(x.w21.t)) +
      k(T('e_cum'), mb(x.cum_total), esc(T('e_since', { d: MM.fmtDate(x.first) })), MM.cls(x.cum_total)) +
      k(T('e_streak'), sk ? MM.loc(Math.abs(sk)) : '—', esc(T(sk > 0 ? 'e_in' : sk < 0 ? 'e_out' : 'e_flat')), sk > 0 ? 'up' : sk < 0 ? 'dn' : '') +
      '</div>';
  }
  function chart(x, n, W) {
    W = Math.max(280, Math.round(W || 1000));
    var days = x.days.slice(-n), H = W < 640 ? 220 : 300, P = 4, top = 22;
    if (days.length < 2) return '';
    var mx = 1, cum = [], c = x.cum_total - x.days.slice(x.days.length - days.length).reduce(function (s, r) { return s + r[1]; }, 0);
    days.forEach(function (r) { mx = Math.max(mx, Math.abs(r[1])); c += r[1]; cum.push(c); });
    var cl = Math.min.apply(null, cum), ch = Math.max.apply(null, cum);
    var bw = (W - 2 * P) / days.length, mid = top + (H - top - 20) / 2, half = (H - top - 20) / 2;
    var up = MM.upc(), dn = MM.dnc();
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mm-svg mm-etfc" role="img" aria-label="' + esc(T('e_chart')) + '">' +
      '<line x1="0" x2="' + W + '" y1="' + mid + '" y2="' + mid + '" stroke="rgba(255,255,255,.15)"/>';
    days.forEach(function (r, i) {
      var v = r[1], hh = Math.abs(v) / mx * half, y = v >= 0 ? mid - hh : mid;
      s += '<rect x="' + (P + i * bw + bw * 0.12).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(1, bw * 0.76).toFixed(1) + '" height="' + Math.max(0.6, hh).toFixed(1) + '" fill="' + (v >= 0 ? up : dn) + '" fill-opacity=".85"><title>' + esc(MM.fmtDate(r[0]) + ' · ' + mb(v)) + '</title></rect>';
    });
    var Y = function (v) { return (top + (1 - (v - cl) / ((ch - cl) || 1)) * (H - top - 20)).toFixed(1); };
    s += '<polyline points="' + cum.map(function (v, i) { return (P + i * bw + bw / 2).toFixed(1) + ',' + Y(v); }).join(' ') + '" fill="none" stroke="#f7931a" stroke-width="2" vector-effect="non-scaling-stroke"/>';
    s += MM.svgText(W - 4, 14, 'end', 'mm-ax', T('e_cumL') + ' ' + MM.ltr(mb(ch))) + '<text x="4" y="14" class="mm-ax">' + mb(mx) + '</text>' +
      MM.svgText(4, H - 4, 'start', 'mm-ax', MM.fmtDate(days[0][0])) + MM.svgText(W - 4, H - 4, 'end', 'mm-ax', MM.fmtDate(days[days.length - 1][0])) + '</svg>';
    return s;
  }
  function funds(x) {
    var rows = x.funds.map(function (f, i) {
      var spark = x.days.slice(-20).map(function (r) { return r[2][i]; });
      return { f: f, info: (x.info || {})[f] || [], last: x.last.by[f], w5: x.w5.by[f], w21: x.w21.by[f], cum: x.cum[f], spark: spark };
    }).sort(function (a, b) { return (b.cum || 0) - (a.cum || 0); });
    var pos = rows.reduce(function (s, r) { return s + Math.max(0, r.cum || 0); }, 0) || 1;
    var mini = function (a) {
      var mx = Math.max.apply(null, a.map(function (v) { return Math.abs(v || 0); })) || 1;
      return '<svg viewBox="0 0 60 20" class="mm-mini" aria-hidden="true">' + a.map(function (v, i) { var hh = Math.abs(v || 0) / mx * 9; return '<rect x="' + (i * 3) + '" y="' + (v >= 0 ? 10 - hh : 10) + '" width="2.2" height="' + Math.max(0.4, hh) + '" fill="' + (v == null ? '#444' : v >= 0 ? MM.upc() : MM.dnc()) + '"/>'; }).join('') + '</svg>';
    };
    return '<div class="mm-tw"><table class="mm-ft"><thead><tr><th>' + esc(T('e_fund')) + '</th><th>' + esc(T('e_sponsor')) + '</th><th>' + esc(MM.fmtDate(x.last.d)) + '</th><th>' + esc(T('e_w5')) + '</th><th>' + esc(T('e_w21')) + '</th><th>' + esc(T('e_cum')) + '</th><th>' + esc(T('e_share')) + '</th><th>' + esc(T('e_20d')) + '</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td><b>' + esc(r.f) + '</b><small>' + esc(r.info[1] || '') + '</small></td><td>' + esc(r.info[0] || '—') + '</td><td class="mm-n ' + MM.cls(r.last) + '">' + m(r.last) + '</td><td class="mm-n ' + MM.cls(r.w5) + '">' + m(r.w5) + '</td><td class="mm-n ' + MM.cls(r.w21) + '">' + m(r.w21) + '</td><td class="mm-n ' + MM.cls(r.cum) + '">' + mb(r.cum) + '</td>' +
          '<td class="mm-n">' + (r.cum > 0 ? (r.cum / pos * 100).toFixed(1) + '%' : '—') + '</td><td>' + mini(r.spark) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function flag(cc) { cc = String(cc || '').toUpperCase(); return /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(127397 + cc.charCodeAt(0), 127397 + cc.charCodeAt(1)) : ''; }
  function treasury(t, coin) {
    if (!t) return '<p class="mm-p-note">' + esc(T('noData')) + '</p>';
    var c = D.by[coin], px = c ? c.p : null;
    return '<div class="mm-kpis sm"><div class="mm-kpi"><small>' + esc(T('t_total', { c: coin })) + '</small><b class="mm-n">' + MM.fmtQty(t.total) + ' ' + coin + '</b><span class="mm-n">' + MM.fmtUsd(px ? t.total * px : t.value) + '</span></div>' +
      '<div class="mm-kpi"><small>' + esc(T('t_dom')) + '</small><b class="mm-n">' + (t.dom != null ? t.dom + '%' : '—') + '</b><span>' + esc(T('t_n', { n: MM.loc(t.n) })) + '</span></div></div>' +
      '<div class="mm-tw"><table class="mm-ft"><thead><tr><th>' + esc(T('t_co')) + '</th><th>' + esc(T('t_hold')) + '</th><th>' + esc(T('t_val')) + '</th><th>' + esc(T('t_pl')) + '</th><th>' + esc(T('t_sup')) + '</th></tr></thead><tbody>' +
      t.top.slice(0, 15).map(function (r) {
        var val = px ? r.h * px : r.v, pl = r.e ? (val / r.e - 1) * 100 : null;
        return '<tr><td><b>' + esc(r.n) + '</b><small>' + flag(r.c) + ' ' + esc(r.s) + '</small></td><td class="mm-n">' + MM.fmtQty(r.h) + '</td><td class="mm-n">' + MM.fmtUsd(val) + '</td><td class="mm-n ' + MM.cls(pl) + '">' + MM.fmtPct(pl) + '</td><td class="mm-n">' + (r.p != null ? MM.loc((+r.p).toFixed(+r.p >= 1 ? 2 : 3)) + '%' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="mm-p-note">' + esc(T('t_note')) + '</p>';
  }
  /* Bitcoin Treasuries: who holds BTC (by holder type) and the 100 listed companies with the most */
  var BT_CATS = ['pub', 'priv', 'gov', 'etf', 'defi'], BT_COL = { pub: '#f7931a', priv: '#c084fc', gov: '#60a5fa', etf: '#34d399', defi: '#94a3b8' };
  function btCard(b) {
    if (!b || !b.top) return '';
    var c = D.by.BTC, px = c ? c.p : null, cats = b.cats || {}, tot = 0;
    BT_CATS.forEach(function (k) { tot += cats[k] || 0; });
    var bar = tot ? '<div class="mm-btbar">' + BT_CATS.filter(function (k) { return cats[k]; }).map(function (k) {
      return '<i style="width:' + (cats[k] / tot * 100).toFixed(2) + '%;background:' + BT_COL[k] + '" title="' + esc(T('bt_' + k)) + '"></i>'; }).join('') + '</div>' +
      '<div class="mm-btleg">' + BT_CATS.filter(function (k) { return cats[k]; }).map(function (k) {
        return '<span><i style="background:' + BT_COL[k] + '"></i>' + esc(T('bt_' + k)) + ' <b class="mm-n">' + MM.fmtQty(cats[k]) + ' ₿</b> <small class="mm-n">' + (px ? MM.fmtUsd(cats[k] * px) : '') + ' · ' + (cats[k] / 21e6 * 100).toFixed(2) + '%</small></span>'; }).join('') + '</div>' +
      '<p class="mm-p-note">' + esc(T('bt_all', { b: MM.loc(Math.round(tot).toLocaleString('en-US')), p: MM.loc((tot / 21e6 * 100).toFixed(2)) + '%' })) + '</p>' : '';
    var all = st.btAll, rows = b.top.slice(0, all ? 100 : 20);
    var tb = '<div class="mm-tw"><table class="mm-ft mm-bt"><thead><tr><th>#</th><th>' + esc(T('bt_co')) + '</th><th>' + esc(T('bt_btc')) + '</th><th>' + esc(T('bt_val')) + '</th><th>' + esc(T('bt_mc')) + '</th><th>' + esc(T('bt_ratio')) + '</th><th>' + esc(T('bt_21')) + '</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var v = px ? r.h * px : r.v, ratio = r.mc ? v / r.mc : null;
        return '<tr><td class="mm-n">' + MM.loc(r.r) + '</td><td><b>' + esc(r.n) + '</b><small>' + flag(r.c) + ' ' + esc(r.s) + '</small></td><td class="mm-n">' + MM.fmtQty(r.h) + '</td><td class="mm-n">' + MM.fmtUsd(v) + '</td><td class="mm-n">' + (r.mc ? MM.fmtUsd(r.mc) : '—') + '</td>' +
          '<td class="mm-n">' + (ratio != null ? MM.loc((ratio * 100).toFixed(ratio >= 1 ? 0 : 1)) + '%' : '—') + '</td><td class="mm-n">' + (r.p != null ? MM.loc((+r.p).toFixed(+r.p >= 1 ? 2 : 3)) + '%' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return '<section class="mm-card"><div class="mm-ch"><h3>' + esc(T('bt_t')) + '</h3></div><p class="mm-sub">' + esc(T('bt_sub')) + '</p>' + bar + tb +
      (b.top.length > 20 ? '<p><button type="button" class="mm-btn" data-btall>' + esc(T(all ? 'bt_less' : 'bt_more', { n: MM.loc(b.top.length) })) + '</button></p>' : '') +
      '<p class="mm-p-note">' + esc(T('bt_note', { t: MM.fmtDate(b.t, true) })) + '</p></section>';
  }
  /* the world's largest assets (8marketcap), Bitcoin's place among them */
  var W_ICON = { co: '🏢', etf: '📊', metal: '🥇', crypto: '' };
  function worldCard(w) {
    if (!w || !w.top) return '';
    var rows = w.top.slice(0, 20), btc = w.btc, gold = w.top.filter(function (r) { return r.s === 'GOLD'; })[0];
    if (btc && !rows.some(function (r) { return r.s === 'BTC' && r.k === 'crypto'; })) rows.push(btc);
    var k = '<div class="mm-kpis sm">' + (btc ? '<div class="mm-kpi"><small>' + esc(T('w_rank')) + '</small><b class="mm-n">#' + MM.loc(btc.r) + '</b><span class="mm-n">' + MM.fmtUsd(btc.mc) + '</span></div>' : '') +
      (btc && gold ? '<div class="mm-kpi"><small>' + esc(T('w_gold')) + '</small><b class="mm-n">' + MM.loc((btc.mc / gold.mc * 100).toFixed(1)) + '%</b><span class="mm-n">' + MM.fmtUsd(gold.mc) + '</span></div>' : '') + '</div>';
    var tb = '<div class="mm-tw"><table class="mm-ft"><thead><tr><th>#</th><th>' + esc(T('w_asset')) + '</th><th>' + esc(T('w_mc')) + '</th><th>' + esc(T('w_px')) + '</th><th>' + esc(T('w_d1')) + '</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var ic = r.k === 'crypto' && MM.A.meta && MM.A.meta.i && MM.A.meta.i[r.s] != null ? MM.logo(r.s, 16) : '<span aria-hidden="true">' + (W_ICON[r.k] || '') + '</span>';
        return '<tr' + (r.s === 'BTC' && r.k === 'crypto' ? ' class="mm-hl"' : '') + '><td class="mm-n">' + MM.loc(r.r) + '</td><td>' + ic + ' <b>' + esc(r.n) + '</b><small>' + esc(T('w_' + r.k)) + ' · ' + esc(r.s) + '</small></td><td class="mm-n">' + MM.fmtUsd(r.mc) + '</td><td class="mm-n">' + (r.p != null ? MM.fmtP(r.p) : '—') + '</td><td class="mm-n ' + MM.cls(r.d1) + '">' + MM.fmtPct(r.d1) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return '<section class="mm-card"><div class="mm-ch"><h3>' + esc(T('w_t')) + '</h3></div><p class="mm-sub">' + esc(T('w_sub')) + '</p>' + k + tb +
      '<p class="mm-p-note">' + esc(T('w_note', { s: '8marketcap', t: MM.fmtDate(w.t, true) })) + '</p></section>';
  }
  function movers() {
    var tf = S.tf, list = D.coins.filter(function (c) { return c.sec !== 'wrapped'; }).slice(0, 250), tot = list.reduce(function (s, c) { return s + (c.mc || 0); }, 0), by = {};
    list.forEach(function (c) { var g = by[c.sec] = by[c.sec] || { k: c.sec, mc: 0, w: 0, wm: 0, n: 0 }; g.mc += c.mc || 0; g.n++; var v = c.ch[tf]; if (v != null) { g.w += (c.mc || 0) * v; g.wm += c.mc || 0; } });
    var gs = Object.keys(by).map(function (k) { var g = by[k]; g.ch = g.wm ? g.w / g.wm : null; return g; }).sort(function (a, b) { return b.mc - a.mc; });
    return '<div class="mm-movers">' + gs.map(function (g) {
      var col = MM.rgb(g.ch);
      return '<button type="button" class="mm-mv" data-sec="' + g.k + '" style="background:linear-gradient(160deg,' + MM.css(col, 0.55) + ',' + MM.css(col, 0.18) + ')"><small>' + esc(MM.secName(g.k)) + '</small><b class="mm-n">' + MM.fmtPct(g.ch) + '</b><span class="mm-n">' + esc(T('domShort')) + ' ' + (g.mc / tot * 100).toFixed(2) + '% · ' + MM.loc(g.n) + '</span></button>';
    }).join('') + '</div>';
  }
  function distribution(W) {
    var tf = S.tf, sat = MM.SAT[tf], list = D.coins.filter(function (c) { return c.sec !== 'wrapped' && c.sec !== 'stable' && c.ch[tf] != null; }).slice(0, 250);
    W = Math.max(280, Math.round(W || 1000));
    var edges = [-1, -0.75, -0.5, -0.3, -0.15, -0.05, 0.05, 0.15, 0.3, 0.5, 0.75, 1].map(function (x) { return x * sat; });
    var bins = new Array(edges.length + 1).fill(0), up = 0, dn = 0;
    list.forEach(function (c) { var v = c.ch[tf], i = 0; while (i < edges.length && v >= edges[i]) i++; bins[i]++; if (v > 0) up++; else if (v < 0) dn++; });
    var mx = Math.max.apply(null, bins) || 1, H = 220, bw = W / bins.length, every = bw < 46 ? 2 : 1;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mm-svg" role="img" aria-label="' + esc(T('distT')) + '">';
    bins.forEach(function (n, i) {
      var lo = i ? edges[i - 1] : null, hi = i < edges.length ? edges[i] : null, mid = lo == null ? hi * 1.2 : hi == null ? lo * 1.2 : (lo + hi) / 2;
      var hh = n / mx * (H - 46), x = i * bw;
      var gp = Math.min(4, bw * 0.12);
      s += '<rect x="' + (x + gp).toFixed(1) + '" y="' + (H - 24 - hh).toFixed(1) + '" width="' + (bw - 2 * gp).toFixed(1) + '" height="' + Math.max(1, hh).toFixed(1) + '" rx="3" fill="' + MM.css(MM.rgb(mid)) + '"><title>' + esc(MM.loc(n)) + '</title></rect>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 30 - hh).toFixed(1) + '" text-anchor="middle" class="mm-ax">' + MM.loc(n) + '</text>' +
        (i % every === 0 || i === bins.length - 1 ? '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="mm-ax">' + esc(MM.loc(lo == null ? '<' + hi.toFixed(sat < 3 ? 1 : 0) : hi == null ? '>' + lo.toFixed(sat < 3 ? 1 : 0) : (mid > 0 ? '+' : '') + mid.toFixed(sat < 3 ? 2 : 1))) + '%</text>' : '');
    });
    return s + '</svg><p class="mm-p-note"><b class="up">↑ ' + MM.loc(up) + '</b> · <b class="dn">↓ ' + MM.loc(dn) + '</b> — ' + esc(T('distNote', { n: MM.loc(list.length), tf: T('tfn_' + tf) })) + '</p>';
  }
  function render() {
    if (!st) return;
    st.raf = 0;
    var e = st.etf, a = st.asset, x = e && e[a];
    var tabs = '<div class="mm-seg" role="group">' + ['btc', 'eth'].map(function (k) { return '<button type="button" data-asset="' + k + '" class="' + (k === a ? 'on' : '') + '">' + MM.logo(k.toUpperCase(), 18) + esc(T('e_' + k)) + '</button>'; }).join('') + '</div>';
    var range = '<div class="mm-seg sm" role="group">' + [60, 120, 250, 0].map(function (n) { return '<button type="button" data-n="' + n + '" class="' + (st.n === n ? 'on' : '') + '">' + esc(n ? T('span_d', { n: MM.loc(n) }) : T('all')) + '</button>'; }).join('') + '</div>';
    var src = e && e.src ? (e.src['farside_' + a] ? T('e_src', { t: MM.fmtDate(e.src['farside_' + a], true) }) : T('e_noSrc')) : '';
    st.box.innerHTML =
      '<section class="mm-card"><div class="mm-ch"><h3>' + esc(T('e_title')) + '</h3>' + tabs + '</div>' +
      (x ? kpis(x) + '<div class="mm-ch"><h4>' + esc(T('e_chart')) + '</h4>' + range + '</div>' + MM.slot('etfc') +
        '<div class="mm-lgd"><span><i style="background:' + MM.upc() + '"></i>' + esc(T('e_inL')) + '</span><span><i style="background:' + MM.dnc() + '"></i>' + esc(T('e_outL')) + '</span><span><i style="background:#f7931a"></i>' + esc(T('e_cumL')) + '</span></div>' +
        '<h4>' + esc(T('e_funds')) + '</h4>' + funds(x) : '<p class="mm-p-note">' + esc(T(e ? 'e_none' : 'loading')) + '</p>') +
      '<p class="mm-p-note">' + esc(src) + ' ' + esc(T('e_note')) + '</p></section>' +
      (e && e.bt ? btCard(e.bt) : '') +
      '<div class="mm-two cards">' + (e && e.bt ? '' : '<section class="mm-card"><div class="mm-ch"><h3>' + esc(T('t_btc')) + '</h3></div>' + treasury(e && e.tre && e.tre.btc, 'BTC') + '</section>') +
      '<section class="mm-card"><div class="mm-ch"><h3>' + esc(T('t_eth')) + '</h3></div>' + treasury(e && e.tre && e.tre.eth, 'ETH') + '</section>' + (e && e.world ? worldCard(e.world) : '') + '</div>' +
      '<div class="mm-two cards"><section class="mm-card"><div class="mm-ch"><h3>' + esc(T('moversT', { tf: MM.TFLBL[S.tf] })) + '</h3></div><p class="mm-sub">' + esc(T('moversSub')) + '</p>' + (D.ok ? movers() : '') + '</section>' +
      '<section class="mm-card"><div class="mm-ch"><h3>' + esc(T('distT')) + '</h3></div>' + (D.ok ? MM.slot('dist') : '') + '</section></div>';
    if (x) MM.fill(st.box, 'etfc', function (w) { return chart(x, st.n || x.days.length, w); });
    if (D.ok) MM.fill(st.box, 'dist', distribution);
  }
  function later() { if (st && !st.raf) st.raf = requestAnimationFrame(render); }
  V.mount = function (stage) {
    st = { asset: MM.store.get('ek_mm_etf', 'btc'), n: MM.store.get('ek_mm_etfn', 120), raf: 0, etf: null };
    st.box = h('<div class="mm-dash"><div class="mm-wait">' + esc(T('loading')) + '</div></div>');
    stage.appendChild(st.box);
    st.box.addEventListener('click', function (e) {
      var a = e.target.closest('[data-asset]'); if (a) { st.asset = a.getAttribute('data-asset'); MM.store.set('ek_mm_etf', st.asset); render(); return; }
      var n = e.target.closest('[data-n]'); if (n) { st.n = +n.getAttribute('data-n'); MM.store.set('ek_mm_etfn', st.n); render(); return; }
      if (e.target.closest('[data-btall]')) { st.btAll = !st.btAll; render(); return; }
      var sc = e.target.closest('[data-sec]'); if (sc) { MM.pendingZoom = sc.getAttribute('data-sec'); MM.switchTo('heatmap'); }
    });
    st.onData = MM.debounce(later, 500);
    MM.on('data', st.onData);
    st.unwatch = MM.watchWidth(st.box, later);
    MM.getJSON('/data/etf.json?v=' + Math.floor(Date.now() / 600000), 20000).then(function (j) { if (st) { st.etf = j; render(); } }, function () { if (st) { st.etf = {}; render(); } });
    render();
  };
  V.update = function () { later(); };
  V.unmount = function () { if (!st) return; MM.off('data', st.onData); if (st.unwatch) st.unwatch(); if (st.raf) cancelAnimationFrame(st.raf); st = null; };
})();
