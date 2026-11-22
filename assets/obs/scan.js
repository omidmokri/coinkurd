/* entekhab.net — the Observatory: /charts/scanner/ — every coin the site follows, filtered by conditions you set.
   Data: /data/market.json (scripts/market.py): price, 24h change and volume, RSI, EMA20 and EMA50, the trend
   those three give, and the 48-hour high and low. Nothing is computed here that the file does not already carry;
   the filtering and sorting happen in the page, so a change is instant and nothing is sent anywhere. */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, d = document;
  var GRN = '#34d399', RED = '#ff5a4d';
  var DEF = { rsiLo: 0, rsiHi: 100, chgLo: -100, chgHi: 100, trend: 'any', ema: 'any',
              volMin: 0, near: 'any', sort: 'chg24', desc: true };
  var S = (function () {
    var s = OB.store.get('ek_obs_scan', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    var q = new URLSearchParams(location.search);
    ['rsiLo', 'rsiHi', 'chgLo', 'chgHi', 'volMin'].forEach(function (k) {
      var v = parseFloat(q.get(k)); if (isFinite(v)) o[k] = v;
    });
    ['trend', 'ema', 'near', 'sort'].forEach(function (k) { if (q.get(k)) o[k] = q.get(k); });
    return o;
  })();
  var save = OB.debounce(function () { OB.store.set('ek_obs_scan', S); }, 300);
  var V = { el: null, doc: null, seq: 0 };

  function pct(v, dp) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(dp == null ? 2 : dp) + '%'; }
  function status(h, k) { var s = $('#ob-status', V.el); if (s) { s.innerHTML = h || ''; s.className = 'ob-status' + (k ? ' ' + k : ''); s.hidden = !h; } }

  /* where the price sits between the 48-hour low and high: 0 at the low, 100 at the high */
  function band(c) {
    if (c.hi48 == null || c.lo48 == null || !(c.hi48 > c.lo48)) return null;
    return (c.price - c.lo48) / (c.hi48 - c.lo48) * 100;
  }

  function matches(c) {
    if (c.rsi == null || c.rsi < S.rsiLo || c.rsi > S.rsiHi) return false;
    if (c.chg24 == null || c.chg24 < S.chgLo || c.chg24 > S.chgHi) return false;
    if (S.trend !== 'any' && c.trend !== S.trend) return false;
    if ((c.qvol || c.vol24 || 0) < S.volMin) return false;
    if (S.ema === 'above' && !(c.price > c.ema20 && c.price > c.ema50)) return false;
    if (S.ema === 'below' && !(c.price < c.ema20 && c.price < c.ema50)) return false;
    if (S.ema === 'cross' && !(c.ema20 > c.ema50)) return false;
    if (S.near !== 'any') {
      var b = band(c);
      if (b == null) return false;
      if (S.near === 'high' && b < 90) return false;
      if (S.near === 'low' && b > 10) return false;
      if (S.near === 'mid' && (b < 35 || b > 65)) return false;
    }
    return true;
  }

  function sortKey(c) {
    switch (S.sort) {
      case 'coin': return c.coin;
      case 'price': return c.price;
      case 'rsi': return c.rsi == null ? -1 : c.rsi;
      case 'vol': return c.qvol || c.vol24 || 0;
      case 'band': return band(c) == null ? -1 : band(c);
      default: return c.chg24 == null ? -999 : c.chg24;
    }
  }

  function render() {
    var doc = V.doc, el = V.el;
    if (!doc) return;
    var all = doc.coins || [];
    var hit = all.filter(matches).sort(function (a, b) {
      var x = sortKey(a), y = sortKey(b);
      var r = typeof x === 'string' ? String(x).localeCompare(String(y)) : (x - y);
      return S.desc ? -r : r;
    });

    $('#ob-count', el).innerHTML = esc(T('sc_count', { n: OB.loc(String(hit.length)), t: OB.loc(String(all.length)) })) +
      (hit.length ? '' : ' — ' + esc(T('sc_none')));

    var cols = [['coin', T('sc_c_coin')], ['price', T('sc_c_price')], ['chg24', T('sc_c_chg')],
                ['rsi', T('sc_c_rsi')], ['trend', T('sc_c_trend')], ['band', T('sc_c_band')], ['vol', T('sc_c_vol')]];
    var head = cols.map(function (c) {
      var on = S.sort === c[0];
      return '<th' + (c[0] === 'coin' ? ' style="text-align:start"' : '') + '><button type="button" class="ob-sortb' +
        (on ? ' on' : '') + '" data-sort="' + c[0] + '">' + esc(c[1]) + (on ? (S.desc ? ' ▾' : ' ▴') : '') + '</button></th>';
    }).join('');

    $('#ob-rows', el).innerHTML = '<div class="ob-tblw"><table class="ob-grid"><thead><tr>' + head +
      '</tr></thead><tbody>' + hit.slice(0, 200).map(function (c) {
        var b = band(c), tr = c.trend || 'range';
        return '<tr><td><a class="ob-scoin" href="/coins/' + esc(String(c.coin).toLowerCase()) + '/">' +
            (OB.hasLogo(c.coin) !== false ? OB.logo(c.coin, 18) : '<i class="ob-dfnone"></i>') +
            '<b>' + esc(c.coin) + '</b></a></td>' +
          '<td class="ob-n">' + esc(OB.ltr('$' + OB.fmtP(c.price))) + '</td>' +
          '<td class="ob-n" style="color:' + (c.chg24 > 0 ? GRN : c.chg24 < 0 ? RED : 'inherit') + '">' + esc(OB.ltr(pct(c.chg24))) + '</td>' +
          '<td class="ob-n">' + esc(OB.ltr(c.rsi == null ? '—' : c.rsi.toFixed(1))) + '</td>' +
          '<td><em class="ob-sctr ' + esc(tr) + '">' + esc(T('sc_tr_' + tr)) + '</em></td>' +
          '<td class="ob-n">' + (b == null ? '—' : '<span class="ob-scband"><i style="width:' + Math.max(2, Math.min(100, b)).toFixed(0) + '%"></i></span> ' + esc(OB.ltr(b.toFixed(0) + '%'))) + '</td>' +
          '<td class="ob-n">' + esc(OB.ltr(OB.fmtUsd(c.qvol || c.vol24))) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (hit.length > 200 ? '<p class="ob-note">' + esc(T('sc_capped', { n: OB.loc('200') })) + '</p>' : '');

    $('#ob-when', el).textContent = String(doc.updated_at || '').slice(0, 16).replace('T', ' ') + ' UTC';
    OB.ui.setSeg(el, 'ob-tr', S.trend);
    OB.ui.setSeg(el, 'ob-em', S.ema);
    OB.ui.setSeg(el, 'ob-nr', S.near);
    save();
  }

  function exportCsv() {
    var doc = V.doc; if (!doc) return;
    var hit = (doc.coins || []).filter(matches);
    var rows = [['coin', 'price_usd', 'change_24h_pct', 'rsi', 'trend', 'ema20', 'ema50', 'high_48h', 'low_48h', 'band_pct', 'volume_24h_usd']];
    hit.forEach(function (c) {
      var b = band(c);
      rows.push([c.coin, c.price, c.chg24, c.rsi, c.trend, c.ema20, c.ema50, c.hi48, c.lo48,
                 b == null ? null : +b.toFixed(2), c.qvol || c.vol24]);
    });
    OB.csv('entekhab-scanner.csv', rows);
  }

  function num(id, fallback) {
    var e = $('#' + id, V.el);
    if (!e) return fallback;
    var v = parseFloat(e.value);
    return isFinite(v) ? v : fallback;
  }

  function load(force) {
    var seq = ++V.seq;
    status('<span class="ob-spin"></span>' + esc(T('loading')));
    OB.getJSON('/data/market.json' + (force ? '?t=' + Date.now() : ''), 45000).then(function (j) {
      if (seq !== V.seq) return;
      if (!j || !j.coins || !j.coins.length) throw new Error('empty');
      V.doc = j; status(''); render();
    }).catch(function () {
      if (seq !== V.seq) return;
      status('<b>' + esc(T('err_view')) + '</b> <button type="button" class="ob-b" id="ob-retry">' + esc(T('retry')) + '</button>', 'err');
    });
  }

  function mount(el) {
    V.el = el;
    function seg(id, items, cur) { return OB.ui.seg(id, items, cur, 'ob-rng'); }
    el.innerHTML =
      '<div class="ob-top"><div class="ob-tools">' + OB.ui.acts(true) + '</div></div>' +
      '<div id="ob-status" class="ob-status" hidden></div>' +
      '<div class="ob-scform">' +
        '<label><span>' + esc(T('sc_f_rsi')) + '</span><span class="ob-scpair">' +
          '<input id="sc-rsilo" type="number" min="0" max="100" step="1" inputmode="decimal" value="' + S.rsiLo + '">' +
          '<i>–</i><input id="sc-rsihi" type="number" min="0" max="100" step="1" inputmode="decimal" value="' + S.rsiHi + '"></span></label>' +
        '<label><span>' + esc(T('sc_f_chg')) + '</span><span class="ob-scpair">' +
          '<input id="sc-chglo" type="number" step="any" inputmode="decimal" value="' + S.chgLo + '">' +
          '<i>–</i><input id="sc-chghi" type="number" step="any" inputmode="decimal" value="' + S.chgHi + '"></span></label>' +
        '<label><span>' + esc(T('sc_f_vol')) + '</span><input id="sc-vol" type="number" min="0" step="any" inputmode="decimal" value="' + S.volMin + '"></label>' +
      '</div>' +
      '<div class="ob-scsegs">' +
        '<label class="ob-lbl"><span>' + esc(T('sc_f_trend')) + '</span>' +
          seg('ob-tr', [['any', T('sc_any')], ['up', T('sc_tr_up')], ['range', T('sc_tr_range')], ['down', T('sc_tr_down')]], S.trend) + '</label>' +
        '<label class="ob-lbl"><span>' + esc(T('sc_f_ema')) + '</span>' +
          seg('ob-em', [['any', T('sc_any')], ['above', T('sc_em_above')], ['below', T('sc_em_below')], ['cross', T('sc_em_cross')]], S.ema) + '</label>' +
        '<label class="ob-lbl"><span>' + esc(T('sc_f_near')) + '</span>' +
          seg('ob-nr', [['any', T('sc_any')], ['high', T('sc_nr_high')], ['mid', T('sc_nr_mid')], ['low', T('sc_nr_low')]], S.near) + '</label>' +
        '<button type="button" class="ob-b" id="sc-reset">' + esc(T('sc_reset')) + '</button>' +
      '</div>' +
      '<p class="ob-sccount" id="ob-count"></p>' +
      '<div id="ob-rows"></div>' +
      '<p class="ob-note">' + esc(T('sc_note')) + ' <span dir="ltr" id="ob-when"></span></p>';

    el.oninput = function (e) {
      if (!/^sc-/.test(e.target.id)) return;
      S.rsiLo = num('sc-rsilo', 0); S.rsiHi = num('sc-rsihi', 100);
      S.chgLo = num('sc-chglo', -100); S.chgHi = num('sc-chghi', 100);
      S.volMin = num('sc-vol', 0);
      render();
    };
    el.onclick = function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b || !el.contains(b)) return;
      var seg_ = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null;
      var v = b.getAttribute('data-v');
      if (seg_ === 'ob-tr') { S.trend = v; OB.ui.setSeg(el, 'ob-tr', v); render(); }
      else if (seg_ === 'ob-em') { S.ema = v; OB.ui.setSeg(el, 'ob-em', v); render(); }
      else if (seg_ === 'ob-nr') { S.near = v; OB.ui.setSeg(el, 'ob-nr', v); render(); }
      else if (b.getAttribute('data-sort')) {
        var k = b.getAttribute('data-sort');
        if (k === S.sort) S.desc = !S.desc; else { S.sort = k; S.desc = k !== 'coin'; }
        render();
      }
      else if (b.id === 'sc-reset') {
        Object.keys(DEF).forEach(function (k) { S[k] = DEF[k]; });
        OB.store.set('ek_obs_scan', S);
        mount(el);                                  /* rebuilt rather than patched: every field returns to its default */
      }
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') load(true);
      else if (b.id === 'ob-csv') exportCsv();
      else if (b.id === 'ob-full') OB.fullscreen(d.getElementById('ob'));
      else if (b.id === 'ob-png') OB.toast(T('sc_nopng'));
      else if (b.id === 'ob-share') OB.ui.share({ rsiLo: S.rsiLo, rsiHi: S.rsiHi, chgLo: S.chgLo, chgHi: S.chgHi,
                                                  volMin: S.volMin, trend: S.trend, ema: S.ema, near: S.near, sort: S.sort });
    };
    load();
  }
  function unmount() { V.seq++; V.doc = null; }
  OB.views.scanner = { mount: mount, unmount: unmount };
})();
