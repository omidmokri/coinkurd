/* entekhab.net — the Observatory: /charts/volume-profile/ — where the market actually did its business.
   Data: /data/obs/vprofile.json (scripts/obs_vprofile.py, Binance spot candles).
   The bars run sideways: price up the side, dollars traded across. Buying and selling are drawn apart, so the
   page shows not only WHERE the business was done but which side was crossing the spread to do it. */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, d = document;
  var BUY = '#2ec27e', SELL = '#ff5a4d', POC = '#f0b429';
  var RANGES = ['7', '30', '90', '365'], SIDES = ['both', 'net'];
  var DEF = { coin: 'btc', range: '30', side: 'both' };
  var S = (function () {
    var s = OB.store.get('ek_obs_vprof', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    var q = new URLSearchParams(location.search);
    if (q.get('coin')) o.coin = String(q.get('coin')).toLowerCase();
    if (RANGES.indexOf(q.get('range')) >= 0) o.range = q.get('range');
    if (SIDES.indexOf(q.get('side')) >= 0) o.side = q.get('side');
    return o;
  })();
  var save = OB.debounce(function () { OB.store.set('ek_obs_vprof', S); }, 300);
  var V = { el: null, doc: null, seq: 0 };

  function money(v) { return OB.fmtUsd(v); }
  function status(h, k) { var s = $('#ob-status', V.el); if (s) { s.innerHTML = h || ''; s.className = 'ob-status' + (k ? ' ' + k : ''); s.hidden = !h; } }
  function tile(label, value, sub, cls) {
    return '<div class="ob-tile"><small>' + esc(label) + '</small><b class="ob-n"' +
      (cls ? ' style="color:' + cls + '"' : '') + '>' + value + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>';
  }
  /* the price a bin covers, named by its middle */
  function mid(p, i) { return p.lo + (i + 0.5) * p.step; }
  /* A price axis needs every band to read differently, so the number of decimals follows the band's own width
     rather than the size of the price: $80,588 for Bitcoin, $0.1642 for Dogecoin. fmtUsd would shorten both to
     "$80.6K" and "$0.2", which would print the same label on band after band. */
  function dp(step) {
    if (!(step > 0)) return 2;
    var d = Math.ceil(-Math.log10(step)) + 1;
    return Math.max(0, Math.min(8, d));
  }
  function price(v, step) {
    if (v == null || !isFinite(v)) return '—';
    var n = dp(step);
    return OB.ltr('$' + v.toLocaleString('en-US', { minimumFractionDigits: n, maximumFractionDigits: n }));
  }

  function current() {
    var a = (V.doc && V.doc.assets) ? V.doc.assets[S.coin] : null;
    return a && a.ranges ? a.ranges[S.range] : null;
  }

  function rows(p) {
    var out = '', i, b, s, tot, net, w, maxTot = 0, maxNet = 0;
    for (i = 0; i < p.n; i++) {
      tot = p.buy[i] + p.sell[i];
      if (tot > maxTot) maxTot = tot;
      net = Math.abs(p.buy[i] - p.sell[i]);
      if (net > maxNet) maxNet = net;
    }
    if (!(maxTot > 0)) return '';
    /* highest price at the top, the way a price axis reads */
    for (i = p.n - 1; i >= 0; i--) {
      b = p.buy[i]; s = p.sell[i]; tot = b + s; net = b - s;
      var isPoc = i === p.poc, inVa = i >= p.val && i <= p.vah;
      var cls = 'ob-vprow' + (isPoc ? ' ob-vppoc' : '') + (inVa ? ' ob-vpva' : '');
      var bar;
      if (S.side === 'net') {
        w = maxNet > 0 ? Math.abs(net) / maxNet * 50 : 0;
        bar = '<span class="ob-vpbar ob-vpnet">' +
          '<i class="ob-vpl" style="width:' + (net < 0 ? w.toFixed(2) : 0) + '%;background:' + SELL + '"></i>' +
          '<i class="ob-vpr" style="width:' + (net > 0 ? w.toFixed(2) : 0) + '%;background:' + BUY + '"></i></span>';
      } else {
        bar = '<span class="ob-vpbar">' +
          '<i style="width:' + (b / maxTot * 100).toFixed(2) + '%;background:' + BUY + '"></i>' +
          '<i style="width:' + (s / maxTot * 100).toFixed(2) + '%;background:' + SELL + '"></i></span>';
      }
      out += '<div class="' + cls + '" title="' + esc(price(mid(p, i), p.step) + ' · ' + money(tot)) + '">' +
        '<span class="ob-vppx ob-n">' + esc(price(mid(p, i), p.step)) + '</span>' + bar +
        '<span class="ob-vpv ob-n">' + esc(OB.ltr(money(tot))) + '</span></div>';
    }
    return out;
  }

  function render() {
    var el = V.el, p = current();
    if (!p) { status('<b>' + esc(T('err_view')) + '</b>', 'err'); $('#ob-vp', el).innerHTML = ''; $('#ob-tiles', el).innerHTML = ''; return; }
    status('');
    var pocPx = mid(p, p.poc), vahPx = mid(p, p.vah), valPx = mid(p, p.val);
    var buy = 0, sell = 0, i;
    for (i = 0; i < p.n; i++) { buy += p.buy[i]; sell += p.sell[i]; }
    var share = (buy + sell) > 0 ? buy / (buy + sell) * 100 : null;
    $('#ob-tiles', el).innerHTML =
      tile(T('vp_t_poc'), esc(price(pocPx, p.step)), T('vp_t_poc_s'), POC) +
      tile(T('vp_t_va'), esc(OB.ltr(price(valPx, p.step) + ' – ' + price(vahPx, p.step))), T('vp_t_va_s')) +
      tile(T('vp_t_total'), esc(OB.ltr(money(p.total))), T('vp_t_total_s')) +
      tile(T('vp_t_buy'), share == null ? '—' : esc(OB.ltr(share.toFixed(1) + '%')), T('vp_t_buy_s'),
           share != null && share >= 50 ? BUY : SELL);
    $('#ob-vp', el).innerHTML = rows(p);
    var meta = $('#ob-meta', el);
    if (meta) meta.textContent = T('vp_meta').replace('{n}', OB.ltr(String(p.candles))).replace('{bins}', OB.ltr(String(p.n)));
  }

  function exportCsv() {
    var p = current();
    if (!p) return;
    var rowsOut = [['price_low', 'price_high', 'buy_usd', 'sell_usd', 'total_usd', 'is_point_of_control', 'in_value_area']];
    for (var i = 0; i < p.n; i++) {
      rowsOut.push([p.lo + i * p.step, p.lo + (i + 1) * p.step, p.buy[i], p.sell[i], p.buy[i] + p.sell[i],
                    i === p.poc ? 1 : 0, (i >= p.val && i <= p.vah) ? 1 : 0]);
    }
    OB.csv('volume-profile-' + S.coin + '-' + S.range + 'd', rowsOut);
  }

  /* the asset buttons carry the coin's logo before its name, the way the other pages show a coin */
  function coins() {
    var doc = V.doc, order = (doc && doc.order) || [];
    return order.map(function (k) {
      var a = doc.assets[k], base = k.toUpperCase();
      var lg = OB.hasLogo(base) === false ? '' : OB.logo(base, 18);
      return [k, lg + '<span>' + esc(a.name || base) + '</span>', a.name];
    });
  }

  function paint() {
    var el = V.el, seg = $('#ob-c', el);
    if (seg) seg.outerHTML = OB.ui.seg('ob-c', coins(), S.coin, 'ob-vpcoins', true);
    render();
  }

  function load(force) {
    var seq = ++V.seq;
    status('<b>' + esc(T('loading')) + '</b>');
    OB.getJSON('/data/obs/vprofile.json', force).then(function (doc) {
      if (seq !== V.seq) return;
      V.doc = doc;
      if (!doc || !doc.assets || !Object.keys(doc.assets).length) { status('<b>' + esc(T('err_view')) + '</b>', 'err'); return; }
      if (!doc.assets[S.coin]) S.coin = (doc.order && doc.order[0]) || Object.keys(doc.assets)[0];
      paint();
    }).catch(function () {
      if (seq !== V.seq) return;
      status('<b>' + esc(T('err_view')) + '</b> <button id="ob-retry" class="ob-btn">' + esc(T('retry')) + '</button>', 'err');
    });
  }

  function mount(el) {
    V.el = el;
    el.innerHTML =
      '<div class="ob-top"><div class="ob-tools">' +
        '<label class="ob-lbl"><span>' + esc(T('asset')) + '</span><span id="ob-c"></span></label>' +
        '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' +
          OB.ui.seg('ob-r', RANGES.map(function (r) { return [r, T('vp_r_' + r)]; }), S.range, 'ob-rng') + '</label>' +
        '<label class="ob-lbl"><span>' + esc(T('vp_side')) + '</span>' +
          OB.ui.seg('ob-s', SIDES.map(function (s) { return [s, T('vp_s_' + s)]; }), S.side) + '</label>' +
        OB.ui.acts(true) +
      '</div></div>' +
      '<div class="ob-tiles" id="ob-tiles"></div>' +
      '<div id="ob-status" class="ob-status" hidden></div>' +
      '<div class="ob-vplegend"><span><i style="background:' + BUY + '"></i>' + esc(T('vp_buy')) + '</span>' +
        '<span><i style="background:' + SELL + '"></i>' + esc(T('vp_sell')) + '</span>' +
        '<span><i class="ob-vpkpoc"></i>' + esc(T('vp_t_poc')) + '</span>' +
        '<span><i class="ob-vpkva"></i>' + esc(T('vp_t_va')) + '</span></div>' +
      '<div id="ob-vp" class="ob-vp"></div>' +
      '<p class="ob-note" id="ob-meta"></p>' +
      '<p class="ob-note">' + esc(T('vp_note')) + '</p>';
    el.onclick = function (e) {
      var b = e.target.closest && e.target.closest('button'); if (!b || !el.contains(b)) return;
      var seg = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null, v = b.getAttribute('data-v');
      if (seg === 'ob-c' && v !== S.coin) { S.coin = v; OB.ui.setSeg(el, 'ob-c', v); save(); render(); }
      else if (seg === 'ob-r' && v !== S.range) { S.range = v; OB.ui.setSeg(el, 'ob-r', v); save(); render(); }
      else if (seg === 'ob-s' && v !== S.side) { S.side = v; OB.ui.setSeg(el, 'ob-s', v); save(); render(); }
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') load(true);
      else if (b.id === 'ob-full') OB.fullscreen(d.getElementById('ob'));
      else if (b.id === 'ob-share') OB.ui.share({ coin: S.coin, range: S.range, side: S.side });
      else if (b.id === 'ob-csv') exportCsv();
    };
    load();
  }
  function unmount() { V.seq++; V.doc = null; }
  OB.views.vprof = { mount: mount, unmount: unmount };
})();
