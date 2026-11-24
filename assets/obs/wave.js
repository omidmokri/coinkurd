/* entekhab.net — the Observatory: /charts/block-cycle/ — where the four-year cycle stands, read off block height alone.

   The indicator is the Wolfy Wave Index, published by WolfyXBT (@wolfyxbt, wolfyxbt.github.io/wolfy-wave-index): a pure
   function of block height, no price in it anywhere. Its author states it plainly enough for anyone to recompute, which
   is what this file does — none of his code or data is used here. The page is credited to him on screen.

   Model: one halving every 210,000 blocks is one cycle; the bull takes 157,500 blocks of it and the bear 52,500; the
   halving sits in the middle of the bull. So for a height h, with s = (h + 78,750) mod 210,000, the index is s/157,500
   while s < 157,500 and 1 − (s − 157,500)/52,500 after that: zero at the model's bottom, one at its top, one half at
   every halving.

   The x axis is block height, never time — that is the whole point: halvings fall at equal distances. Heights become
   dates only for the reader, by straight lines between the four halvings (real block timestamps, verified on the chain)
   and the tip, and at ten minutes a block past it; every such date is written with a ≈.
   Prices: /data/obs/chain_btc.json, the site's own daily series (Coin Metrics, as on the other on-chain pages). */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, d = document, w = window;
  var HALVING = 210000, BULL = 157500, BEAR = 52500, HALF = 78750, DAY = 864e5, BLOCK_MS = 600000;
  var ANCHOR = [[0, '2009-01-03'], [210000, '2012-11-28'], [420000, '2016-07-09'], [630000, '2020-05-11'], [840000, '2024-04-20']];
  var BUCKET = { d: 144, w: 1008, m: 4368 };                 /* a day, a week and a month of blocks */
  var INK = '#e8e8e3', GREY = '#8d8d86';
  /* the spectrum the whole page reads by: 0 deep blue, 1 red. Quantised into steps so a 6,000-point line
     is drawn as a few dozen strokes rather than six thousand. */
  var STOPS = [[0x2b, 0x4c, 0xd8], [0x35, 0xb7, 0xe8], [0x3f, 0xbf, 0x57], [0xd9, 0xd9, 0x3a], [0xf5, 0x9e, 0x0b], [0xe2, 0x3b, 0x2e]];
  var STEPS = 56, RAMP = [], RAMPF = [];
  (function () {
    for (var i = 0; i < STEPS; i++) {
      var u = i / (STEPS - 1) * (STOPS.length - 1), k = Math.min(STOPS.length - 2, Math.floor(u)), f = u - k, a = STOPS[k], b = STOPS[k + 1];
      var r = Math.round(a[0] + (b[0] - a[0]) * f), g = Math.round(a[1] + (b[1] - a[1]) * f), bl = Math.round(a[2] + (b[2] - a[2]) * f);
      RAMP.push('rgb(' + r + ',' + g + ',' + bl + ')');
      RAMPF.push('rgba(' + r + ',' + g + ',' + bl + ',.42)');                /* the same colour for the part that has not happened yet */
    }
  })();
  function hue(v, future) { var i = OB.clamp(Math.round(v * (STEPS - 1)), 0, STEPS - 1); return future ? RAMPF[i] : RAMP[i]; }

  /* ---------------------------------------------------------------- the index */
  function wwi(h) { var s = ((h + HALF) % HALVING + HALVING) % HALVING; return s < BULL ? s / BULL : 1 - (s - BULL) / BEAR; }
  function isBull(h) { var s = ((h + HALF) % HALVING + HALVING) % HALVING; return s < BULL; }

  /* ---------------------------------------------------------------- height ↔ date */
  var A = null;
  function anchors(tipH, tipMs) {
    var a = ANCHOR.map(function (x) { return [x[0], Date.parse(x[1] + 'T00:00:00Z')]; });
    if (tipH > a[a.length - 1][0] && tipMs) a.push([tipH, tipMs]);
    return a;
  }
  function dateAt(h) {                                        /* a height's ≈ date */
    var a = A, n = a.length;
    if (h <= a[0][0]) return a[0][1] + (h - a[0][0]) * BLOCK_MS;
    for (var i = 1; i < n; i++) if (h <= a[i][0]) { var p = a[i - 1], q = a[i]; return p[1] + (q[1] - p[1]) * (h - p[0]) / (q[0] - p[0]); }
    return a[n - 1][1] + (h - a[n - 1][0]) * BLOCK_MS;
  }
  function heightAt(t) {                                      /* a date's height */
    var a = A, n = a.length;
    if (t <= a[0][1]) return a[0][0] + (t - a[0][1]) / BLOCK_MS;
    for (var i = 1; i < n; i++) if (t <= a[i][1]) { var p = a[i - 1], q = a[i]; return p[0] + (q[0] - p[0]) * (t - p[1]) / (q[1] - p[1]); }
    return a[n - 1][0] + (t - a[n - 1][1]) / BLOCK_MS;
  }
  function dstr(h) { return OB.fmtDate(dateAt(h)); }                        /* with the year: the next halving is years out */
  function dax(h) { var t = new Date(dateAt(h)); return OB.loc(t.getFullYear() + '/' + ('0' + (t.getMonth() + 1)).slice(-2)); }   /* the axis: a tick is about two years wide, so year and month are enough */
  function num(n) { return OB.loc(Math.round(n).toLocaleString('en-US')); }

  /* ---------------------------------------------------------------- state */
  var DEF = { style: 'wave', bucket: 'd', log: true, halv: true, phase: true };
  var S = (function () {
    var s = OB.store.get('ek_obs_wv', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    var q = new URLSearchParams(location.search);
    if (/^(wave|candle|line)$/.test(q.get('style') || '')) o.style = q.get('style');
    if (/^(d|w|m)$/.test(q.get('bucket') || '')) o.bucket = q.get('bucket');
    return o;
  })();
  var save = OB.debounce(function () { OB.store.set('ek_obs_wv', S); }, 300);
  var V = { el: null, ts: null, D: null, seq: 0 };

  function tile(label, value, sub, cls) { return '<div class="ob-tile"><small>' + esc(label) + '</small><b class="ob-n' + (cls ? ' ' + cls : '') + '">' + value + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>'; }
  function status(html, cls) { var s = $('#ob-status', V.el); if (s) { s.innerHTML = html || ''; s.className = 'ob-status' + (cls ? ' ' + cls : ''); s.hidden = !html; } }

  /* ---------------------------------------------------------------- data */
  function tip() {                                            /* the chain's height; without it, counted on from the last halving */
    return OB.getJSON('https://mempool.space/api/blocks/tip/height', 7000).then(function (h) {
      return (typeof h === 'number' && h > 840000) ? { h: h, live: true, t: Date.now() } : null;
    }).catch(function () { return null; }).then(function (r) {
      if (r) return r;
      var last = ANCHOR[ANCHOR.length - 1], t0 = Date.parse(last[1] + 'T00:00:00Z');
      return { h: Math.floor(last[0] + (Date.now() - t0) / BLOCK_MS), live: false, t: Date.now() };
    });
  }
  function load(force) {
    var seq = ++V.seq;
    status('<span class="ob-spin"></span> ' + esc(T('loading')));
    Promise.all([OB.getJSON('/data/obs/chain_btc.json' + (force ? '?r=' + Date.now() : ''), 20000), tip()]).then(function (r) {
      if (seq !== V.seq) return;
      var j = r[0], tp = r[1];
      A = anchors(tp.h, tp.t);
      var col = j.cols && j.cols.price; if (!col || !col.v || !col.v.length) throw new Error('no price');
      var t0 = Date.parse(j.t0 + 'T00:00:00Z'), off = col.o || 0, days = [];
      for (var i = 0; i < col.v.length; i++) { var v = col.v[i]; if (v != null && isFinite(v) && v > 0) days.push([t0 + (off + i) * DAY, v]); }
      V.D = { days: days, tip: tp, updated: j.updated_at || '' };
      status('');
      render();
    }, function (e) {
      if (seq !== V.seq) return;
      if (w.console) console.error(e);
      status('<b>' + esc(T('err_file')) + '</b><br><span>' + esc(T('err_file_d')) + '</span><br><button type="button" class="ob-btn" id="ob-retry">' + esc(T('retry')) + '</button>', 'err');
    });
  }

  /* ---------------------------------------------------------------- the series */
  function build() {
    var D = V.D, B = BUCKET[S.bucket], tipH = D.tip.h;
    var rows = [], cur = null;
    for (var i = 0; i < D.days.length; i++) {
      var h = heightAt(D.days[i][0]), p = D.days[i][1], k = Math.floor(h / B) * B;
      if (!cur || cur[0] !== k) { cur = [k, p, p, p, p]; rows.push(cur); }
      else { if (p > cur[2]) cur[2] = p; if (p < cur[3]) cur[3] = p; cur[4] = p; }
    }
    /* the index, over the whole span and on past the tip to the next top the model points at */
    var endH = Math.ceil((tipH - HALF) / HALVING) * HALVING + HALF + B;    /* the next height where the index reads 1 */
    var idx = [], icol = [], h2;
    for (h2 = rows.length ? rows[0][0] : 0; h2 <= endH; h2 += B) { var vv = wwi(h2); idx.push([h2, vv]); icol.push(hue(vv, h2 > tipH)); }
    var pcol = rows.map(function (r) { return hue(wwi(r[0] + B / 2), false); });
    /* the bull and the bear of every cycle the chart covers, bands across both panes */
    var bands = [], h0 = Math.floor((rows.length ? rows[0][0] : 0) / HALVING) * HALVING - HALVING;
    for (var hv = h0; hv <= endH + HALVING; hv += HALVING) {
      bands.push({ x0: hv - HALF, x1: hv + HALF, bull: true });
      bands.push({ x0: hv + HALF, x1: hv + HALVING - HALF, bull: false });
    }
    var halv = [];
    for (var k2 = Math.max(0, h0); k2 <= endH + HALVING; k2 += HALVING) halv.push(k2);
    return { rows: rows, pcol: pcol, idx: idx, icol: icol, bands: bands, halv: halv, endH: endH, tipH: tipH };
  }

  function render() {
    if (!V.D || !V.ts) return;
    var G = V.G = build(), tipH = G.tipH, now = wwi(tipH), bull = isBull(tipH);
    var last = G.rows.length ? G.rows[G.rows.length - 1][4] : null;
    var nextHalv = Math.ceil((tipH + 1) / HALVING) * HALVING;
    var prog = bull ? now : 1 - now;

    $('#ob-tiles', V.el).innerHTML =
      tile(T('wv_t_h'), num(tipH), esc(V.D.tip.live ? T('wv_h_live') : T('wv_h_est'))) +
      tile(T('wv_t_idx'), OB.loc(now.toFixed(3)), esc(T(bull ? 'wv_bull' : 'wv_bear')), bull ? 'up' : 'dn') +
      tile(T('wv_t_prog'), OB.loc(Math.round(prog * 100) + '%'), esc(T(bull ? 'wv_prog_bull' : 'wv_prog_bear'))) +
      tile(T('wv_t_next'), num(nextHalv), '≈ ' + esc(dstr(nextHalv))) +
      tile(T('p_price'), last == null ? '—' : OB.fmtUsd(last, 0), esc(T('wv_px_day')));

    var vb = [], vl = [];
    if (S.phase) G.bands.forEach(function (b) {
      vb.push({ x0: b.x0, x1: b.x1, color: b.bull ? 'rgba(52,211,153,.085)' : 'rgba(255,90,77,.085)', label: T(b.bull ? 'wv_bull' : 'wv_bear'), ink: b.bull ? 'rgba(52,211,153,.7)' : 'rgba(255,90,77,.7)' });
    });
    if (S.halv) G.halv.forEach(function (h) {
      vl.push({ x: h, color: h > tipH ? 'rgba(233,233,228,.22)' : 'rgba(233,233,228,.4)', dash: h > tipH ? [4, 4] : null, label: T('wv_halv_at', { h: num(h) }), ink: 'rgba(233,233,228,.55)' });
    });
    vl.push({ x: tipH, color: 'rgba(247,147,26,.85)', width: 1.5, label: T('wv_now'), ink: 'rgba(247,147,26,.9)' });

    var price = S.style === 'candle'
      ? { name: T('p_price'), type: 'candle', color: INK, data: G.rows.map(function (r) { return [r[0], r[1], r[2], r[3], r[4]]; }) }
      : { name: T('p_price'), type: 'line', color: '#f7931a', width: 1.9, data: G.rows.map(function (r) { return [r[0], r[4]]; }) };
    if (S.style === 'wave') price.colors = G.pcol;

    V.ts.set({
      label: T('aria_wave'), xmode: 'num',
      xfmt: function (x) { return [num(x), '≈ ' + dax(x)]; },
      xtip: function (x) { return T('wv_tip', { h: num(x), d: dstr(x) }); },
      panes: [
        { weight: 2.6, log: S.log, title: T('p_price'), fmt: function (v) { return OB.compact(v); }, vbands: vb, vlines: vl, series: [price] },
        { weight: 1, min: 0, max: 1, title: T('wv_name'), fmt: function (v) { return OB.loc(v.toFixed(2)); }, vbands: vb, vlines: vl,
          series: [{ name: T('wv_name'), type: 'line', color: '#3fbf57', width: 2, data: G.idx, colors: G.icol }] }
      ]
    });
    var note = $('#ob-note', V.el); if (note) note.textContent = T('note_wave');
  }

  /* ---------------------------------------------------------------- the colour scale beside the chart */
  function scaleHtml() {
    var stops = [];
    for (var i = 0; i < STEPS; i++) stops.push(RAMP[STEPS - 1 - i] + ' ' + Math.round(i / (STEPS - 1) * 100) + '%');
    return '<div class="ob-wvsc" aria-hidden="true"><span>' + esc(T('wv_top')) + '</span><i style="background:linear-gradient(to bottom,' + stops.join(',') + ')"></i><span>' + esc(T('wv_bottom')) + '</span></div>';
  }

  function exportCsv() {
    var D = V.D; if (!D) return;
    var G = build(), rows = [['block_height', 'date_approx', 'price_usd', 'wave_index', 'phase']];
    G.rows.forEach(function (r) { var h = r[0]; rows.push([h, new Date(dateAt(h)).toISOString().slice(0, 10), r[4], wwi(h).toFixed(6), isBull(h) ? 'bull' : 'bear']); });
    OB.csv('entekhab-block-cycle.csv', rows);
  }

  function mount(el) {
    V.el = el; V.D = null;
    el.innerHTML = '<div class="ob-tools">' +
      '<label class="ob-lbl"><span>' + esc(T('wv_style')) + '</span>' + OB.ui.seg('ob-st', [['wave', T('wv_wave')], ['candle', T('wv_candle')], ['line', T('wv_line')]], S.style) + '</label>' +
      '<label class="ob-lbl"><span>' + esc(T('wv_bucket')) + '</span>' + OB.ui.seg('ob-bk', [['d', T('wv_d')], ['w', T('wv_w')], ['m', T('wv_m')]], S.bucket, 'ob-rng') + '</label>' +
      '<button type="button" class="ob-ib ob-gear" id="ob-gear" aria-expanded="false" aria-controls="ob-more" aria-label="' + esc(T('more')) + '" title="' + esc(T('more')) + '">' + OB.icon('gear') + '</button>' +
      '<div class="ob-more" id="ob-more">' +
      '<label class="ob-lbl"><span>' + esc(T('scale')) + '</span>' + OB.ui.seg('ob-sc', [['log', T('sc_log')], ['lin', T('sc_lin')]], S.log ? 'log' : 'lin') + '</label>' +
      '<label class="ob-lbl"><span>' + esc(T('wv_marks')) + '</span>' + OB.ui.seg('ob-hv', [['on', T('wv_halv')], ['off', T('wv_off')]], S.halv ? 'on' : 'off') +
      OB.ui.seg('ob-ph', [['on', T('wv_phases')], ['off', T('wv_off')]], S.phase ? 'on' : 'off') + '</label></div>' +
      OB.ui.acts(true) + '</div><div class="ob-tiles" id="ob-tiles"></div>' +
      '<div class="ob-tsbox ob-wvbox"><div class="ob-ts" id="ob-ts"></div>' + scaleHtml() + '<div class="ob-status" id="ob-status"></div></div>' +
      '<p class="ob-note" id="ob-note"></p>' +
      '<p class="ob-note ob-small" id="ob-credit">' + T('wv_credit') + '</p>';
    V.ts = new OB.TS($('#ob-ts', el));
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      var seg = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null, v = b.getAttribute('data-v');
      if (seg === 'ob-st' && v !== S.style) { S.style = v; OB.ui.setSeg(el, 'ob-st', v); save(); render(); }
      else if (seg === 'ob-bk' && v !== S.bucket) { S.bucket = v; OB.ui.setSeg(el, 'ob-bk', v); save(); render(); }
      else if (seg === 'ob-sc') { S.log = v === 'log'; OB.ui.setSeg(el, 'ob-sc', v); save(); render(); }
      else if (seg === 'ob-hv') { S.halv = v === 'on'; OB.ui.setSeg(el, 'ob-hv', v); save(); render(); }
      else if (seg === 'ob-ph') { S.phase = v === 'on'; OB.ui.setSeg(el, 'ob-ph', v); save(); render(); }
      else if (b.id === 'ob-gear') { var op = !$('.ob-tools', el).classList.contains('open'); $('.ob-tools', el).classList.toggle('open', op); b.setAttribute('aria-expanded', op ? 'true' : 'false'); if (V.ts) V.ts.onResize(); }
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') load(true);
      else if (b.id === 'ob-full') OB.fullscreen(d.getElementById('ob'));
      else if (b.id === 'ob-png') { if (V.ts && V.D) V.ts.png('BTC · ' + T('wv_name'), T('wv_png_sub'), 'entekhab-block-cycle.png'); }
      else if (b.id === 'ob-share') OB.ui.share({ style: S.style, bucket: S.bucket });
      else if (b.id === 'ob-csv') exportCsv();
    };
    load();
  }
  function unmount() { V.seq++; if (V.ts) V.ts.destroy(); V.ts = null; V.D = null; V.G = null; }
  OB.views.wave = { mount: mount, unmount: unmount };
  OB._wv = { wwi: wwi, heightAt: function (t) { return heightAt(t); }, dateAt: function (h) { return dateAt(h); }, setA: function (a) { A = a; }, S: S, V: V };
})();
